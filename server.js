import express from "express";
import fs from "fs";
import cors from "cors";

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
/* BANCO */
/* ============================== */

function lerBanco() {
  if (!fs.existsSync("./database.json")) {
    fs.writeFileSync(
      "./database.json",
      JSON.stringify(
        {
          vagas: 1,
          inscritos: []
        },
        null,
        2
      )
    );
  }

  return JSON.parse(fs.readFileSync("./database.json"));
}

function salvarBanco(dados) {
  fs.writeFileSync("./database.json", JSON.stringify(dados, null, 2));
}

/* ============================== */
/* ROTAS PUBLICAS */
/* ============================== */

app.get("/vagas", (req, res) => {
  try {
    const banco = lerBanco();
    res.json({ vagas: banco.vagas });
  } catch {
    res.status(500).json({ erro: "Erro ao carregar vagas." });
  }
});

app.get("/ranking", (req, res) => {
  const banco = lerBanco();

  if (!banco.inscritos.length) {
    return res.json({ ranking: [] });
  }

  const ranking = banco.inscritos.map((user, index) => ({
    nome: user.nome,
    idade: user.idade,
    rank: index + 1,
    foto: user.foto || null
  }));

  res.json({ ranking });
});

/* ============================== */
/* INSCRIÇÃO */
/* ============================== */

app.post("/inscrever", async (req, res) => {
  try {
    const { nome, idade, telegram, token } = req.body;

    if (!token) {
      return res.status(400).json({ erro: "Token reCAPTCHA ausente." });
    }

    /* VALIDAR RECAPTCHA */

    const verify = await fetch(
      "https://www.google.com/recaptcha/api/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `secret=${RECAPTCHA_SECRET}&response=${token}`
      }
    );

    const recaptchaData = await verify.json();

    if (!recaptchaData.success) {
      return res
        .status(400)
        .json({ erro: "Falha na verificação de segurança." });
    }

    const banco = lerBanco();

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

    const jaExiste = banco.inscritos.find(
      (i) => i.telegram === telegram
    );

    if (jaExiste) {
      return res
        .status(400)
        .json({ erro: "Telegram já cadastrado." });
    }

    banco.vagas -= 1;

    banco.inscritos.push({
      nome,
      idade,
      telegram,
      data: new Date().toISOString()
    });

    salvarBanco(banco);

    /* ENVIAR PARA TELEGRAM */

    if (TELEGRAM_TOKEN && TELEGRAM_CHAT_ID) {
      const mensagem = `
🚀 NOVA INSCRIÇÃO

👤 Nome: ${nome}
🎂 Idade: ${idade}
📩 Telegram: ${telegram}
`;

      await fetch(
        `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text: mensagem
          })
        }
      );
    }

    res.json({ sucesso: true });

  } catch (err) {
    console.error("ERRO:", err);
    res.status(500).json({ erro: "Erro interno no servidor." });
  }
});

/* ============================== */
/* ADMIN */
/* ============================== */

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

/* ============================== */

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
