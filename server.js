import express from "express";
import fs from "fs";
import cors from "cors";
import crypto from "crypto";
import http from "http";
import { WebSocketServer } from "ws";
import speakeasy from "speakeasy";
import QRCode from "qrcode";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors({
  origin: [
    "https://mindset-elite-fcmg.com.br",
    "https://www.mindset-elite-fcmg.com.br"
  ]
}));

app.use(express.json());
app.use(express.static("./"));

const PORT = process.env.PORT || 3000;

/* ===================================================== */
/* 🔐 ADMIN CONFIG */
/* ===================================================== */

const ADMINS = [
  {
    senha: process.env.SUPERADMIN_PASSWORD,
    role: "superadmin",
    twoFASecret: process.env.SUPERADMIN_2FA_SECRET
  },
  {
    senha: process.env.MODERADOR_PASSWORD,
    role: "moderador",
    twoFASecret: process.env.MODERADOR_2FA_SECRET
  }
];

const SESSIONS = {};
const SESSION_EXPIRATION = 30 * 60 * 1000;

/* ===================================================== */
/* 🚫 IP BLOCK */
/* ===================================================== */

const LOGIN_TENTATIVAS = {};
const IP_BLOQUEADO = {};
const MAX_TENTATIVAS = 5;
const BLOQUEIO_TEMPO = 15 * 60 * 1000;

/* ===================================================== */
/* 📜 LOG */
/* ===================================================== */

function salvarLog(tipo, detalhes, role, ip) {

  const log = {
    data: new Date().toISOString(),
    tipo,
    role,
    ip,
    detalhes
  };

  let logs = [];

  if (fs.existsSync("./logs.json")) {
    logs = JSON.parse(fs.readFileSync("./logs.json"));
  }

  logs.push(log);
  fs.writeFileSync("./logs.json", JSON.stringify(logs, null, 2));

  broadcast({ type: "log_update" });
}

/* ===================================================== */
/* 💾 DATABASE */
/* ===================================================== */

function lerBanco() {
  if (!fs.existsSync("./database.json")) {
    fs.writeFileSync("./database.json",
      JSON.stringify({ vagas: 1, inscritos: [] }, null, 2)
    );
  }
  return JSON.parse(fs.readFileSync("./database.json"));
}

function salvarBanco(dados) {
  fs.writeFileSync("./database.json", JSON.stringify(dados, null, 2));
  broadcast({ type: "data_update" });
}

/* ===================================================== */
/* 🔑 TOKEN */
/* ===================================================== */

function gerarToken() {
  return crypto.randomBytes(32).toString("hex");
}

/* ===================================================== */
/* 🔐 MIDDLEWARE */
/* ===================================================== */

function middlewareAdmin(req, res, next) {

  const token = req.headers["x-admin-token"];

  if (!token || !SESSIONS[token])
    return res.status(401).json({ erro: "Sessão inválida" });

  if (Date.now() > SESSIONS[token].expira) {
    delete SESSIONS[token];
    return res.status(401).json({ erro: "Sessão expirada" });
  }

  SESSIONS[token].expira = Date.now() + SESSION_EXPIRATION;

  req.adminRole = SESSIONS[token].role;
  req.adminIp = req.ip;

  next();
}

/* ===================================================== */
/* 🔐 LOGIN COM 2FA REAL */
/* ===================================================== */

app.post("/admin/login", (req, res) => {

  const ip = req.ip;

  if (IP_BLOQUEADO[ip] && Date.now() < IP_BLOQUEADO[ip])
    return res.status(403).json({ erro: "IP bloqueado" });

  const { senha } = req.body;
  const admin = ADMINS.find(a => a.senha === senha);

  if (!admin) {
    LOGIN_TENTATIVAS[ip] = (LOGIN_TENTATIVAS[ip] || 0) + 1;

    if (LOGIN_TENTATIVAS[ip] >= MAX_TENTATIVAS) {
      IP_BLOQUEADO[ip] = Date.now() + BLOQUEIO_TEMPO;
      salvarLog("IP_BLOQUEADO", "Excesso de login", null, ip);
    }

    return res.status(401).json({ erro: "Senha incorreta" });
  }

  res.json({
    precisa2FA: true,
    role: admin.role
  });
});

/* ===================================================== */
/* 🔐 VALIDAR 2FA */
/* ===================================================== */

app.post("/admin/2fa", (req, res) => {

  const { senha, codigo } = req.body;
  const admin = ADMINS.find(a => a.senha === senha);

  if (!admin)
    return res.status(401).json({ erro: "Admin inválido" });

  const verificado = speakeasy.totp.verify({
    secret: admin.twoFASecret,
    encoding: "base32",
    token: codigo,
    window: 1
  });

  if (!verificado)
    return res.status(401).json({ erro: "Código 2FA inválido" });

  const token = gerarToken();

  SESSIONS[token] = {
    role: admin.role,
    expira: Date.now() + SESSION_EXPIRATION
  };

  salvarLog("LOGIN_SUCESSO", "2FA validado", admin.role, req.ip);

  res.json({ token, role: admin.role });
});

/* ===================================================== */
/* 📊 MÉTRICAS AVANÇADAS */
/* ===================================================== */

app.post("/admin/metricas", middlewareAdmin, (req, res) => {

  const banco = lerBanco();
  const inscritos = banco.inscritos;

  const total = inscritos.length;

  const porDia = {};
  inscritos.forEach(i => {
    const dia = new Date(i.data).toISOString().split("T")[0];
    porDia[dia] = (porDia[dia] || 0) + 1;
  });

  const dias = Object.keys(porDia).length || 1;
  const mediaDiaria = (total / dias).toFixed(2);

  res.json({
    total,
    mediaDiaria,
    crescimento: porDia
  });
});

/* ===================================================== */
/* ❌ EXCLUIR */
/* ===================================================== */

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
  salvarLog("EXCLUSAO", id, req.adminRole, req.adminIp);

  res.json({ ok: true });
});

/* ===================================================== */
/* 📜 LOGS */
/* ===================================================== */

app.post("/admin/logs", middlewareAdmin, (req, res) => {

  if (!fs.existsSync("./logs.json"))
    return res.json([]);

  const logs = JSON.parse(fs.readFileSync("./logs.json"));
  res.json(logs.reverse());
});

/* ===================================================== */
/* 🔥 WEBSOCKET REAL */
/* ===================================================== */

function broadcast(data) {
  wss.clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(JSON.stringify(data));
    }
  });
}

wss.on("connection", (ws) => {
  ws.send(JSON.stringify({ type: "connected" }));
});

/* ===================================================== */

server.listen(PORT, () => {
  console.log("🚀 SaaS Server rodando com WebSocket + 2FA");
});
