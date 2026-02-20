import express from "express";
import fs from "fs";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("./"));

const PORT = 3000;
const ADMIN_PASSWORD = "iu;d@@.&$+0df_a)++k8"; // 🔐 MUDE ISSO

function lerBanco() {
  return JSON.parse(fs.readFileSync("./database.json"));
}

function salvarBanco(dados) {
  fs.writeFileSync("./database.json", JSON.stringify(dados, null, 2));
}

/* ============================= */
/* ====== ROTAS PUBLICAS ======= */
/* ============================= */

app.get("/vagas", (req, res) => {
  const banco = lerBanco();
  res.json({ vagas: banco.vagas });
});

app.post("/inscrever", (req, res) => {
  const { nome, idade, telegram } = req.body;
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  const banco = lerBanco();

  if (banco.vagas <= 0) {
    return res.status(400).json({ erro: "Vagas esgotadas." });
  }

  if (!telegram || !telegram.startsWith("@")) {
    return res.status(400).json({ erro: "Telegram inválido." });
  }

  if (!idade || idade < 16) {
    return res.status(400).json({ erro: "Idade mínima é 16 anos." });
  }

  banco.vagas -= 1;
  banco.inscritos.push({ nome, idade, telegram, ip });

  salvarBanco(banco);

  res.json({ sucesso: true });
});

/* ============================= */
/* ====== ROTAS ADMIN ========= */
/* ============================= */

app.post("/admin/login", (req, res) => {
  const { senha } = req.body;

  if (senha !== ADMIN_PASSWORD) {
    return res.status(401).json({ erro: "Senha incorreta" });
  }

  res.json({ sucesso: true });
});

app.post("/admin/resetar", (req, res) => {
  const { senha } = req.body;

  if (senha !== ADMIN_PASSWORD) {
    return res.status(401).json({ erro: "Senha incorreta" });
  }

  const banco = lerBanco();
  banco.vagas = 1;
  salvarBanco(banco);

  res.json({ sucesso: true });
});

app.post("/admin/inscritos", (req, res) => {
  const { senha } = req.body;

  if (senha !== ADMIN_PASSWORD) {
    return res.status(401).json({ erro: "Senha incorreta" });
  }

  const banco = lerBanco();
  res.json({ inscritos: banco.inscritos });
});

app.listen(PORT, () => {
  console.log("Servidor rodando");
});



