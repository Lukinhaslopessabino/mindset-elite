import express from "express";
import fs from "fs";
import cors from "cors";
import crypto from "crypto";
import http from "http";
import multer from "multer";
import { WebSocketServer } from "ws";
import speakeasy from "speakeasy";
import QRCode from "qrcode";

const app = express();
app.set("trust proxy", 1); // ✅ IP real no Render/Proxy

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(
  cors({
    origin: [
      "https://mindset-elite-fcmg.com.br",
      "https://www.mindset-elite-fcmg.com.br",
    ],
  })
);

app.use(express.json());
app.use(express.static("./"));

const PORT = process.env.PORT || 3000;

/* ===================================================== */
/* 🔐 ADMINS + ROLES + 2FA SECRET (env) */
/* ===================================================== */
const ADMINS = [
  {
    senha: process.env.SUPERADMIN_PASSWORD,
    role: "superadmin",
    twoFASecret: process.env.SUPERADMIN_2FA_SECRET || "", // base32
  },
  {
    senha: process.env.MODERADOR_PASSWORD,
    role: "moderador",
    twoFASecret: process.env.MODERADOR_2FA_SECRET || "", // base32
  },
];

/* ===================================================== */
/* 🔐 SESSIONS */
/* ===================================================== */
const SESSIONS = {}; // token -> { role, expira, ip }
const SESSION_EXPIRATION = 30 * 60 * 1000;

/* ===================================================== */
/* 🚫 IP BLOCK LOGIN */
/* ===================================================== */
const LOGIN_TENTATIVAS = {}; // ip -> count
const IP_BLOQUEADO = {}; // ip -> untilTimestamp
const MAX_TENTATIVAS = 5;
const BLOQUEIO_TEMPO = 15 * 60 * 1000;

/* ===================================================== */
/* 📁 FILES */
/* ===================================================== */
const DB_FILE = "./database.json";
const LOG_FILE = "./logs.json";
const IMAGES_DIR = "./images";

/* ===================================================== */
/* 📦 UPLOAD */
/* ===================================================== */
if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR);

const storage = multer.diskStorage({
  destination: IMAGES_DIR,
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

/* ===================================================== */
/* 🔥 WEBSOCKET */
/* ===================================================== */
function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(msg);
  });
}

wss.on("connection", (ws) => {
  ws.send(JSON.stringify({ type: "connected" }));
});

/* ===================================================== */
/* 📜 LOGS */
/* ===================================================== */
function lerLogs() {
  if (!fs.existsSync(LOG_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(LOG_FILE));
  } catch {
    return [];
  }
}

function salvarLog(tipo, detalhes, role, ip) {
  const log = {
    data: new Date().toISOString(),
    tipo,
    role: role || null,
    ip: ip || null,
    detalhes: detalhes || null,
  };

  const logs = lerLogs();
  logs.push(log);
  fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));
  broadcast({ type: "log_update" });
}

/* ===================================================== */
/* 💾 DATABASE */
/* ===================================================== */
function lerBanco() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ vagas: 1, inscritos: [] }, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_FILE));
}

function salvarBanco(dados) {
  fs.writeFileSync(DB_FILE, JSON.stringify(dados, null, 2));
  broadcast({ type: "data_update" });
}

/* ===================================================== */
/* 🔑 TOKEN */
/* ===================================================== */
function gerarToken() {
  return crypto.randomBytes(32).toString("hex");
}

/* ===================================================== */
/* 🔐 MIDDLEWARE ADMIN */
/* ===================================================== */
function middlewareAdmin(req, res, next) {
  const token = req.headers["x-admin-token"];
  if (!token || !SESSIONS[token]) return res.status(401).json({ erro: "Sessão inválida" });

  const sess = SESSIONS[token];

  if (Date.now() > sess.expira) {
    delete SESSIONS[token];
    return res.status(401).json({ erro: "Sessão expirada" });
  }

  // ✅ Renova expiração (sliding session)
  sess.expira = Date.now() + SESSION_EXPIRATION;

  req.adminRole = sess.role;
  req.adminIp = req.ip;
  next();
}

/* ===================================================== */
/* ✅ ROTAS PÚBLICAS */
/* ===================================================== */
app.get("/vagas", (req, res) => {
  const banco = lerBanco();
  res.json({ vagas: banco.vagas });
});

app.get("/ranking", (req, res) => {
  const banco = lerBanco();
  const ranking = banco.inscritos.map((u, i) => ({
    id: u.id,
    nome: u.nome,
    idade: u.idade,
    rank: i + 1,
    foto: u.foto || null,
    data: u.data,
  }));
  res.json({ ranking });
});

/* ===================================================== */
/* 🔐 LOGIN (PASSO 1) -> pede 2FA */
/* ===================================================== */
app.post("/admin/login", (req, res) => {
  const ip = req.ip;

  // ainda bloqueado?
  if (IP_BLOQUEADO[ip] && Date.now() < IP_BLOQUEADO[ip]) {
    salvarLog("LOGIN_BLOQUEADO", "Tentou logar com IP bloqueado", null, ip);
    return res.status(403).json({ erro: "IP bloqueado temporariamente" });
  }

  // se tempo já passou, remove bloqueio
  if (IP_BLOQUEADO[ip] && Date.now() >= IP_BLOQUEADO[ip]) delete IP_BLOQUEADO[ip];

  const { senha } = req.body;
  const admin = ADMINS.find((a) => a.senha && a.senha === senha);

  if (!admin) {
    LOGIN_TENTATIVAS[ip] = (LOGIN_TENTATIVAS[ip] || 0) + 1;

    if (LOGIN_TENTATIVAS[ip] >= MAX_TENTATIVAS) {
      IP_BLOQUEADO[ip] = Date.now() + BLOQUEIO_TEMPO;
      salvarLog("IP_BLOQUEADO", "Excesso de tentativas de login", null, ip);
      return res.status(403).json({ erro: "IP bloqueado temporariamente" });
    }

    salvarLog("LOGIN_FALHA", "Senha incorreta", null, ip);
    return res.status(401).json({ erro: "Senha incorreta" });
  }

  // ✅ reset tentativas no sucesso
  LOGIN_TENTATIVAS[ip] = 0;

  const hasSecret = !!admin.twoFASecret && String(admin.twoFASecret).trim().length >= 16;

  res.json({
    precisa2FA: true,
    role: admin.role,
    precisaConfigurar2FA: !hasSecret,
    dica: !hasSecret
      ? "Falta configurar o 2FA secret no Render. Use /admin/2fa/setup para gerar QR/secret."
      : undefined,
  });
});

/* ===================================================== */
/* 🔧 SETUP 2FA (GERA SECRET + QR) */
/* ===================================================== */
app.post("/admin/2fa/setup", async (req, res) => {
  const ip = req.ip;
  const { senha } = req.body;

  // Opcional (recomendado): defina SETUP_KEY no Render e mande no header
  const setupKey = process.env.SETUP_KEY;
  if (setupKey) {
    const headerKey = req.headers["x-setup-key"];
    if (!headerKey || headerKey !== setupKey) {
      salvarLog("SETUP_2FA_NEGADO", "SETUP_KEY inválida", null, ip);
      return res.status(403).json({ erro: "Setup negado" });
    }
  }

  const admin = ADMINS.find((a) => a.senha && a.senha === senha);
  if (!admin) return res.status(401).json({ erro: "Senha inválida" });

  const label = `MindsetElite:${admin.role}`;
  const secret = speakeasy.generateSecret({ name: label, length: 20 });
  const qrDataUrl = await QRCode.toDataURL(secret.otpauth_url);

  salvarLog("SETUP_2FA", "Gerou secret/QR (copiar para ENV)", admin.role, ip);

  res.json({
    role: admin.role,
    secretBase32: secret.base32,
    otpauthUrl: secret.otpauth_url,
    qrDataUrl,
    instrucoes:
      admin.role === "superadmin"
        ? "Copie secretBase32 para SUPERADMIN_2FA_SECRET no Render."
        : "Copie secretBase32 para MODERADOR_2FA_SECRET no Render.",
  });
});

/* ===================================================== */
/* 🔐 VALIDAR 2FA (PASSO 2) -> emite token */
/* ===================================================== */
app.post("/admin/2fa", (req, res) => {
  const ip = req.ip;
  const { senha, codigo } = req.body;

  const admin = ADMINS.find((a) => a.senha && a.senha === senha);
  if (!admin) return res.status(401).json({ erro: "Admin inválido" });

  const secret = String(admin.twoFASecret || "").trim();
  if (!secret) {
    return res.status(400).json({
      erro: "2FA não configurado no servidor",
      dica: "Gere no /admin/2fa/setup e cole o secret no Render ENV.",
    });
  }

  const ok = speakeasy.totp.verify({
    secret,
    encoding: "base32",
    token: String(codigo || "").trim(),
    window: 1,
  });

  if (!ok) {
    salvarLog("2FA_FALHA", "Código inválido", admin.role, ip);
    return res.status(401).json({ erro: "Código 2FA inválido" });
  }

  const token = gerarToken();
  SESSIONS[token] = {
    role: admin.role,
    expira: Date.now() + SESSION_EXPIRATION,
    ip,
  };

  salvarLog("LOGIN_SUCESSO", "2FA validado e token emitido", admin.role, ip);
  res.json({ token, role: admin.role });
});

/* ===================================================== */
/* 📊 ADMIN DATA */
/* ===================================================== */
app.post("/admin/inscritos", middlewareAdmin, (req, res) => {
  const banco = lerBanco();
  res.json({ inscritos: banco.inscritos, vagas: banco.vagas, role: req.adminRole });
});

/* ===================================================== */
/* 🔄 RESETAR SÓ VAGAS (superadmin) */
/* ===================================================== */
app.post("/admin/resetar-vagas", middlewareAdmin, (req, res) => {
  if (req.adminRole !== "superadmin") return res.status(403).json({ erro: "Permissão negada" });

  const banco = lerBanco();
  banco.vagas = 1;

  salvarBanco(banco);
  salvarLog("RESET_VAGAS", "Vagas resetadas para 1", req.adminRole, req.adminIp);

  res.json({ ok: true });
});

/* ===================================================== */
/* 🔄 RESETAR SISTEMA (vagas + limpa inscritos) (superadmin) */
/* ===================================================== */
app.post("/admin/resetar", middlewareAdmin, (req, res) => {
  if (req.adminRole !== "superadmin") return res.status(403).json({ erro: "Permissão negada" });

  const banco = lerBanco();
  banco.vagas = 1;
  banco.inscritos = [];

  salvarBanco(banco);
  salvarLog("RESET_SISTEMA", "Sistema resetado (vagas=1 e inscritos=[]) ", req.adminRole, req.adminIp);

  res.json({ ok: true });
});

/* ===================================================== */
/* ❌ EXCLUIR POR ID (superadmin) */
/* ===================================================== */
app.post("/admin/excluir", middlewareAdmin, (req, res) => {
  if (req.adminRole !== "superadmin") return res.status(403).json({ erro: "Permissão negada" });

  const { id } = req.body;
  const banco = lerBanco();

  const index = banco.inscritos.findIndex((u) => u.id === id);
  if (index === -1) return res.status(400).json({ erro: "ID inválido" });

  banco.inscritos.splice(index, 1);
  banco.vagas++;

  salvarBanco(banco);
  salvarLog("EXCLUSAO", `Removeu id=${id}`, req.adminRole, req.adminIp);

  res.json({ ok: true });
});

/* ===================================================== */
/* 📜 LOGS (retorna {logs}) ✅ compatível com seu admin */
/* ===================================================== */
app.post("/admin/logs", middlewareAdmin, (req, res) => {
  const logs = lerLogs().reverse();
  res.json({ logs });
});

/* ===================================================== */
/* 📈 MÉTRICAS AVANÇADAS */
/* ===================================================== */
app.post("/admin/metricas", middlewareAdmin, (req, res) => {
  const banco = lerBanco();
  const inscritos = banco.inscritos;

  const total = inscritos.length;

  const porDia = {};
  inscritos.forEach((i) => {
    const dia = (i.data ? new Date(i.data) : new Date()).toISOString().split("T")[0];
    porDia[dia] = (porDia[dia] || 0) + 1;
  });

  const diasOrdenados = Object.keys(porDia).sort();
  const valores = diasOrdenados.map((d) => porDia[d]);

  const diasCount = Math.max(diasOrdenados.length, 1);
  const mediaDiaria = total / diasCount;

  let crescimentoPct = 0;
  if (valores.length >= 2) {
    const ontem = valores[valores.length - 2];
    const hoje = valores[valores.length - 1];
    crescimentoPct = ontem === 0 ? (hoje > 0 ? 100 : 0) : ((hoje - ontem) / ontem) * 100;
  }

  res.json({
    total,
    mediaDiaria: Number(mediaDiaria.toFixed(2)),
    crescimentoPct: Number(crescimentoPct.toFixed(2)),
    porDia: diasOrdenados.reduce((acc, d) => ((acc[d] = porDia[d]), acc), {}),
  });
});

/* ===================================================== */
/* 🖼 UPLOAD FOTO */
/* ===================================================== */
app.post("/admin/upload", middlewareAdmin, upload.single("foto"), (req, res) => {
  if (!req.file) return res.status(400).json({ erro: "Arquivo inválido" });

  salvarLog("UPLOAD", `arquivo=${req.file.filename}`, req.adminRole, req.adminIp);
  res.json({ arquivo: req.file.filename });
});

/* ===================================================== */
/* HEALTH */
/* ===================================================== */
app.get("/health", (req, res) => res.json({ ok: true }));

/* ===================================================== */
server.listen(PORT, () => {
  console.log("🚀 SaaS Server rodando com WebSocket + 2FA + Logs + Métricas");
});
