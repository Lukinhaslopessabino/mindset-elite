import express from "express";
import fs from "fs";
import cors from "cors";
import crypto from "crypto";
import multer from "multer";

const app = express();

app.use(cors({
  origin: [
    "https://mindset-elite-fcmg.com.br",
    "https://www.mindset-elite-fcmg.com.br"
  ]
}));

app.use(express.json());
app.use(express.static("./"));

const PORT = process.env.PORT || 3000;

/* ============================= */
/* 🔐 ADMINS */
/* ============================= */

const ADMINS = [
  { senha: process.env.SUPERADMIN_PASSWORD, role: "superadmin" },
  { senha: process.env.MODERADOR_PASSWORD, role: "moderador" }
];

/* ============================= */
/* 🔐 SESSÕES */
/* ============================= */

const SESSIONS = {};
const SESSION_EXPIRATION = 30 * 60 * 1000;

/* ============================= */
/* 📜 LOG DE AUDITORIA */
/* ============================= */

function salvarLog(acao, adminRole) {
  const log = {
    data: new Date().toISOString(),
    acao,
    role: adminRole
  };

  let logs = [];
  if (fs.existsSync("./logs.json")) {
    logs = JSON.parse(fs.readFileSync("./logs.json"));
  }

  logs.push(log);
  fs.writeFileSync("./logs.json", JSON.stringify(logs, null, 2));
}

/* ============================= */
/* 💾 BANCO */
/* ============================= */

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

/* ============================= */
/* 🔑 TOKEN */
/* ============================= */

function gerarToken() {
  return crypto.randomBytes(32).toString("hex");
}

/* ============================= */
/* 🔐 MIDDLEWARE */
/* ============================= */

function middlewareAdmin(req, res, next) {
  const token = req.headers["x-admin-token"];

  if (!token || !SESSIONS[token])
    return res.status(401).json({ erro: "Sessão inválida" });

  if (Date.now() > SESSIONS[token].expira) {
    delete SESSIONS[token];
    return res.status(401).json({ erro: "Sessão expirada" });
  }

  req.adminRole = SESSIONS[token].role;
  next();
}

/* ============================= */
/* 🔐 LOGIN + 2FA */
/* ============================= */

app.post("/admin/login", (req, res) => {
  const { senha } = req.body;
  const admin = ADMINS.find(a => a.senha === senha);

  if (!admin)
    return res.status(401).json({ erro: "Senha incorreta" });

  // gera código 2FA
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  SESSIONS[otp] = {
    role: admin.role,
    expira: Date.now() + 5 * 60 * 1000
  };

  console.log("🔐 Código 2FA:", otp);

  res.json({ precisa2FA: true });
});

/* ============================= */
/* 🔐 VALIDAR 2FA */
/* ============================= */

app.post("/admin/2fa", (req, res) => {
  const { codigo } = req.body;

  if (!SESSIONS[codigo])
    return res.status(401).json({ erro: "Código inválido" });

  const session = SESSIONS[codigo];

  const token = gerarToken();

  SESSIONS[token] = {
    role: session.role,
    expira: Date.now() + SESSION_EXPIRATION
  };

  delete SESSIONS[codigo];

  res.json({ token, role: session.role });
});

/* ============================= */
/* 📊 ADMIN */
/* ============================= */

app.post("/admin/inscritos", middlewareAdmin, (req, res) => {
  const banco = lerBanco();
  res.json({
    inscritos: banco.inscritos,
    vagas: banco.vagas
  });
});

app.post("/admin/excluir", middlewareAdmin, (req, res) => {

  if (req.adminRole !== "superadmin")
    return res.status(403).json({ erro: "Permissão negada" });

  const { id } = req.body;
  const banco = lerBanco();

  const index = banco.inscritos.findIndex(u => u.id === id);

  if (index === -1)
    return res.status(400).json({ erro: "ID inválido" });

  banco.inscritos.splice(index, 1);
  banco.vagas++;

  salvarBanco(banco);
  salvarLog("Exclusão de membro", req.adminRole);

  res.json({ ok: true });
});

/* ============================= */

app.listen(PORT, () => {
  console.log("🚀 Servidor rodando...");
});
