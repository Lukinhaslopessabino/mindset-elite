import express from "express";
import fs from "fs";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("./"));

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = "93724432134183714282"; // 🔐 MUDE ISSO
const RECAPTCHA_SECRET= 6LefpnEsAAAAANEn_ixy3kXuNTGGOmF55ZteFSMP;

/* ===================================== */
/* ========= BANCO SEGURO ============== */
/* ===================================== */

function lerBanco() {
  if (!fs.existsSync("./database.json")) {
    fs.writeFileSync("./database.json", JSON.stringify({
      vagas: 1,
      inscritos: []
    }, null, 2));
  }

  const dados = fs.readFileSync("./database.json");
  return JSON.parse(dados);
}

function salvarBanco(dados) {
  fs.writeFileSync("./database.json", JSON.stringify(dados, null, 2));
}

/* ===================================== */
/* ============ IP REAL ================= */
/* ===================================== */

function pegarIP(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.socket.remoteAddress ||
    "IP_DESCONHECIDO"
  );
}

/* ===================================== */
/* ============ ROTAS PUBLICAS ========= */
/* ===================================== */

app.get("/vagas", (req, res) => {
  try {
    const banco = lerBanco();
    res.json({ vagas: banco.vagas });
  } catch (err) {
    res.status(500).json({ erro: "Erro interno ao carregar vagas." });
  }
});

app.get("/ranking", (req, res) => {

  const banco = lerBanco();

  // Se não houver inscritos
  if (!banco.inscritos || banco.inscritos.length === 0) {
    return res.json({ ranking: [] });
  }

  // Criar ranking baseado na ordem de inscrição
  const ranking = banco.inscritos
    .map((user, index) => ({
      nome: user.nome,
      idade: user.idade,
      rank: index + 1,
      foto: user.foto || null
    }));

  res.json({ ranking });

});

app.post("/inscrever", (req, res) => {
  try {
    const { token } = req.body;

const verify = await fetch("https://www.google.com/recaptcha/api/siteverify", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: `secret=${RECAPTCHA_SECRET}&response=${token}`
});

const data = await verify.json();

if (!data.success) {
  return res.status(400).json({ erro: "Falha na verificação de segurança." });
}
    const { nome, idade, telegram } = req.body;
    const ip = pegarIP(req);
    const banco = lerBanco();

    /* 🔒 VALIDAÇÕES */

    if (!nome || nome.length < 2) {
      return res.status(400).json({ erro: "Nome inválido." });
    }

    if (!telegram || !telegram.startsWith("@")) {
      return res.status(400).json({ erro: "Telegram inválido." });
    }

    if (!idade || idade < 16) {
      return res.status(400).json({ erro: "Idade mínima é 16 anos." });
    }

    if (banco.vagas <= 0) {
      return res.status(400).json({ erro: "Vagas esgotadas." });
    }

    /* 🔥 EVITAR DUPLICAÇÃO DE TELEGRAM */
    const jaExiste = banco.inscritos.find(i => i.telegram === telegram);
    if (jaExiste) {
      return res.status(400).json({ erro: "Telegram já cadastrado." });
    }

    /* ✅ REGISTRAR */
    banco.vagas -= 1;

    banco.inscritos.push({
      nome,
      idade,
      telegram,
      ip,
      data: new Date().toISOString()
    });

    salvarBanco(banco);

    res.json({ sucesso: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro interno no servidor." });
  }
});

/* ===================================== */
/* ============ ROTAS ADMIN ============ */
/* ===================================== */

app.post("/admin/login", (req, res) => {
  const { senha } = req.body;

  if (!senha || senha !== ADMIN_PASSWORD) {
    return res.status(401).json({ erro: "Senha incorreta" });
  }

  res.json({ sucesso: true });
});

app.post("/admin/resetar", (req, res) => {
  const { senha } = req.body;

  if (!senha || senha !== ADMIN_PASSWORD) {
    return res.status(401).json({ erro: "Senha incorreta" });
  }

  const banco = lerBanco();
  banco.vagas = 1;
  salvarBanco(banco);

  res.json({ sucesso: true });
});

app.post("/admin/inscritos", (req, res) => {
  const { senha } = req.body;

  if (!senha || senha !== ADMIN_PASSWORD) {
    return res.status(401).json({ erro: "Senha incorreta" });
  }

  const banco = lerBanco();
  res.json({
    total: banco.inscritos.length,
    inscritos: banco.inscritos
  });
});

/* ===================================== */

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});





