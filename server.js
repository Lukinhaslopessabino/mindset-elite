import express from "express";
import fs from "fs";
import cors from "cors";
import crypto from "crypto";
import multer from "multer";

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("./"));

const PORT = process.env.PORT || 3000;

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

/* ============================== */
/* SEGURANÇA */
/* ============================== */

const SESSIONS = {};
const TENTATIVAS = {};
const IP_BLOQUEADO = {};
const SESSION_EXPIRATION = 30 * 60 * 1000;
const MAX_TENTATIVAS = 5;

/* ============================== */
/* GARANTIR PASTA IMAGES */
/* ============================== */

if (!fs.existsSync("./images")) {
  fs.mkdirSync("./images");
}

/* ============================== */
/* UPLOAD */
/* ============================== */

const storage = multer.diskStorage({
  destination: "./images",
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});

const upload = multer({ storage });

/* ============================== */
/* BANCO */
/* ============================== */

function lerBanco() {
  if (!fs.existsSync("./database.json")) {
    fs.writeFileSync(
      "./database.json",
      JSON.stringify({ vagas: 1, inscritos: [] }, null, 2)
    );
  }
  return JSON.parse(fs.readFileSync("./database.json"));
}

function salvarBanco(dados) {
  fs.writeFileSync("./database.json", JSON.stringify(dados, null, 2));
}

/* ============================== */
/* TOKEN */
/* ============================== */

function gerarToken() {
  return crypto.randomBytes(32).toString("hex");
}

function middlewareAdmin(req, res, next) {
  const token = req.headers["x-admin-token"];

  if (!token || !SESSIONS[token]) {
    return res.status(401).json({ erro: "Sessão inválida" });
  }

  if (Date.now() > SESSIONS[token]) {
    delete SESSIONS[token];
    return res.status(401).json({ erro: "Sessão expirada" });
  }

  next();
}

/* ============================== */
/* ROTAS PÚBLICAS */
/* ============================== */

app.get("/vagas", (req, res) => {
  const banco = lerBanco();
  res.json({ vagas: banco.vagas });
});

app.get("/ranking", (req, res) => {
  const banco = lerBanco();

  const ranking = banco.inscritos.map((u, i) => ({
    nome: u.nome,
    idade: u.idade,
    rank: i + 1,
    foto: u.foto || null
  }));

  res.json({ ranking });
});

/* ============================== */
/* INSCRIÇÃO */
/* ============================== */

app.post("/inscrever", async (req, res) => {
  try {

    const { nome, idade, telegram, token } = req.body;

    if (!token)
      return res.status(400).json({ erro: "Captcha inválido" });

    const verify = await fetch(
      "https://www.google.com/recaptcha/api/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `secret=${RECAPTCHA_SECRET}&response=${token}`
      }
    );

    const captchaData = await verify.json();

    if (!captchaData.success)
      return res.status(400).json({ erro: "Falha captcha" });

    const banco = lerBanco();

    if (banco.inscritos.find(i => i.telegram === telegram))
      return res.status(400).json({ erro: "Telegram já cadastrado" });

    if (banco.vagas <= 0)
      return res.status(400).json({ erro: "Sem vagas" });

    banco.vagas--;

    banco.inscritos.push({
      nome,
      idade,
      telegram,
      data: new Date().toISOString()
    });

    salvarBanco(banco);

    /* ================= TELEGRAM ================= */

    if (TELEGRAM_TOKEN && TELEGRAM_CHAT_ID) {

      const mensagem = `
🚀 NOVA INSCRIÇÃO

👤 Nome: ${nome}
🎂 Idade: ${idade}
📩 Telegram: ${telegram}
`;

      await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: mensagem
        })
      });
    }

    res.json({ sucesso: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro interno" });
  }
});

/* ============================== */
/* ADMIN LOGIN */
/* ============================== */

app.post("/admin/login", (req, res) => {

  const ip = req.ip;

  if (IP_BLOQUEADO[ip])
    return res.status(403).json({ erro: "IP bloqueado temporariamente" });

  if (!TENTATIVAS[ip]) TENTATIVAS[ip] = 0;

  if (req.body.senha !== ADMIN_PASSWORD) {

    TENTATIVAS[ip]++;

    if (TENTATIVAS[ip] >= MAX_TENTATIVAS) {
      IP_BLOQUEADO[ip] = true;
      setTimeout(() => delete IP_BLOQUEADO[ip], 15 * 60 * 1000);
    }

    return res.status(401).json({ erro: "Senha incorreta" });
  }

  TENTATIVAS[ip] = 0;

  const token = gerarToken();
  SESSIONS[token] = Date.now() + SESSION_EXPIRATION;

  res.json({ token });
});

/* ============================== */
/* ADMIN PROTEGIDO */
/* ============================== */

app.post("/admin/inscritos", middlewareAdmin, (req, res) => {
  const banco = lerBanco();
  res.json({
    inscritos: banco.inscritos,
    vagas: banco.vagas
  });
});

app.post("/admin/resetar", middlewareAdmin, (req, res) => {
  const banco = lerBanco();
  banco.vagas = 1;
  salvarBanco(banco);
  res.json({ ok: true });
});

app.post("/admin/excluir", middlewareAdmin, (req, res) => {

  const { rank } = req.body;
  const banco = lerBanco();
  const index = rank - 1;

  if (index < 0 || index >= banco.inscritos.length)
    return res.status(400).json({ erro: "Rank inválido" });

  banco.inscritos.splice(index, 1);
  banco.vagas++;

  salvarBanco(banco);

  res.json({ ok: true });
});

/* ============================== */
/* UPLOAD FOTO */
/* ============================== */

app.post("/admin/upload", middlewareAdmin, upload.single("foto"), (req, res) => {

  if (!req.file)
    return res.status(400).json({ erro: "Arquivo inválido" });

  res.json({ arquivo: req.file.filename });
});

/* ============================== */

app.listen(PORT, () => {
  console.log("Servidor rodando...");
});
