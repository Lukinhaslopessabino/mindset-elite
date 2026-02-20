import express from "express";
import fs from "fs";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("./"));

const PORT = 3000;

/////////////////////////////
// 🔐 CONFIGURAÇÃO
/////////////////////////////

const JWT_SECRET = "mindset_segredo_super_forte_2026";
const ADMIN_USER = "admin";

// senha real: 123456
const ADMIN_HASH = "$2b$10$Yz4yZrW2k1LrN0KqJ9Fq7eF3uP7CkYb3i8y5cVbLrW2nQmJk8zZy6";

/////////////////////////////
// 📦 BANCO
/////////////////////////////

function lerBanco() {
  if (!fs.existsSync("./database.json")) {
    fs.writeFileSync("./database.json", JSON.stringify({
      vagas: 1,
      inscritos: [],
      ipsBloqueados: []
    }, null, 2));
  }
  return JSON.parse(fs.readFileSync("./database.json"));
}

function salvarBanco(dados) {
  fs.writeFileSync("./database.json", JSON.stringify(dados, null, 2));
}

/////////////////////////////
// 🔐 LOGIN ADMIN
/////////////////////////////

app.post("/admin/login", async (req, res) => {
  const { usuario, senha } = req.body;

  if (usuario !== ADMIN_USER) {
    return res.status(401).json({ erro: "Usuário inválido" });
  }

  const valido = await bcrypt.compare(senha, ADMIN_HASH);

  if (!valido) {
    return res.status(401).json({ erro: "Senha incorreta" });
  }

  const token = jwt.sign({ usuario }, JWT_SECRET, { expiresIn: "2h" });

  res.json({ token });
});

/////////////////////////////
// 🔒 MIDDLEWARE PROTEÇÃO
/////////////////////////////

function verificarToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ erro: "Token não enviado" });
  }

  const token = authHeader.split(" ")[1];

  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ erro: "Token inválido ou expirado" });
  }
}

/////////////////////////////
// 📊 DASHBOARD PROTEGIDO
/////////////////////////////

app.get("/admin/dashboard", verificarToken, (req, res) => {
  const banco = lerBanco();

  res.json({
    vagas: banco.vagas,
    totalInscritos: banco.inscritos.length,
    bloqueados: banco.ipsBloqueados
  });
});

/////////////////////////////

app.listen(PORT, () => {
  console.log("Servidor rodando em http://localhost:" + PORT);
});
