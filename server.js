import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import crypto from "crypto";
import http from "http";
import multer from "multer";
import { WebSocketServer } from "ws";
import speakeasy from "speakeasy";
import QRCode from "qrcode";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set("trust proxy", 1); 

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

/* ===================================================== */
/* ✅ CONFIGURAÇÕES DE DIRETÓRIOS E ARQUIVOS */
/* ===================================================== */
const DB_FILE = path.join(__dirname, "database.json");
const LOG_FILE = path.join(__dirname, "logs.json");
const IMAGES_DIR = path.join(__dirname, "images");

if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });

/* ===================================================== */
/* ✅ MIDDLEWARES */
/* ===================================================== */
app.use(cors({
  origin: [
    "https://mindset-elite-fcmg.com.br",
    "https://www.mindset-elite-fcmg.com.br",
  ],
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "x-admin-token", "x-setup-key"]
}));

app.use(express.json({ limit: "60kb" }));
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;

/* ===================================================== */
/* 🔐 SEGURANÇA E SESSÕES */
/* ===================================================== */
const ADMINS = [
  {
    senha: process.env.SUPERADMIN_PASSWORD,
    role: "superadmin",
    twoFASecret: process.env.SUPERADMIN_2FA_SECRET || "", 
  },
  {
    senha: process.env.MODERADOR_PASSWORD,
    role: "moderador",
    twoFASecret: process.env.MODERADOR_2FA_SECRET || "", 
  },
];

const SESSIONS = {}; 
const SESSION_EXPIRATION = 30 * 60 * 1000;
const LOGIN_TENTATIVAS = {}; 
const IP_BLOQUEADO = {}; 
const MAX_TENTATIVAS = 5;
const BLOQUEIO_TEMPO = 15 * 60 * 1000;

const signupCooldown = new Map(); 
const rlMap = new Map();

/* ===================================================== */
/* 💾 PERSISTÊNCIA DE DADOS (CORRIGIDA) */
/* ===================================================== */
function lerBanco() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ vagas: 1, inscritos: [] }, null, 2));
  }
  try {
    const data = fs.readFileSync(DB_FILE, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Erro ao ler banco, resetando para padrão.");
    return { vagas: 1, inscritos: [] };
  }
}

function salvarBanco(dados) {
  try {
    const tempFile = DB_FILE + ".tmp";
    fs.writeFileSync(tempFile, JSON.stringify(dados, null, 2));
    fs.renameSync(tempFile, DB_FILE); // Operação atômica
    broadcast({ type: "data_update", vagas: dados.vagas });
  } catch (err) {
    console.error("Erro crítico ao salvar banco:", err);
  }
}

/* ===================================================== */
/* 🔥 WEBSOCKETS E LOGS */
/* ===================================================== */
function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(msg);
  });
}

function salvarLog(tipo, detalhes, role, ip) {
  const log = { data: new Date().toISOString(), tipo, role, ip, detalhes };
  let logs = [];
  if (fs.existsSync(LOG_FILE)) {
    try { logs = JSON.parse(fs.readFileSync(LOG_FILE, "utf-8")); } catch (e) { logs = []; }
  }
  logs.push(log);
  if (logs.length > 500) logs.shift(); // Mantém apenas os últimos 500 logs
  fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));
  broadcast({ type: "log_update" });
}

/* ===================================================== */
/* 🔐 MIDDLEWARE ADMIN */
/* ===================================================== */
function middlewareAdmin(req, res, next) {
  const token = req.headers["x-admin-token"];
  const sess = SESSIONS[token];
  if (!token || !sess || Date.now() > sess.expira) {
    if (token) delete SESSIONS[token];
    return res.status(401).json({ erro: "Sessão inválida ou expirada" });
  }
  sess.expira = Date.now() + SESSION_EXPIRATION;
  req.adminRole = sess.role;
  next();
}

/* ===================================================== */
/* ✅ ROTAS PÚBLICAS (VAGAS E RANKING) */
/* ===================================================== */
app.get("/vagas", (req, res) => {
  const banco = lerBanco();
  res.json({ vagas: banco.vagas });
});

app.get("/ranking", (req, res) => {
  const banco = lerBanco();
  const ranking = [...banco.inscritos]
    .sort((a, b) => (b.xp || 0) - (a.xp || 0))
    .map((u, i) => ({ ...u, rank: i + 1 }));
  res.json({ ranking });
});

/* ===================================================== */
/* 📝 INSCRIÇÃO */
/* ===================================================== */
app.post("/inscrever", async (req, res) => {
  const ip = req.ip || "unknown";
  const { nome, idade, telegram, hp } = req.body;

  if (hp) return res.status(403).json({ erro: "Acesso negado." });

  const banco = lerBanco();
  if (banco.vagas <= 0) return res.status(400).json({ erro: "Vagas esgotadas." });

  const novoInscrito = {
    id: crypto.randomBytes(4).toString("hex"),
    nome: nome.trim(),
    idade: Number(idade),
    telegram: telegram.trim(),
    data: new Date().toISOString(),
    xp: 200, // XP Inicial
    nivel: "Bronze",
    ip
  };

  banco.inscritos.push(novoInscrito);
  banco.vagas = Math.max(0, banco.vagas - 1);
  salvarBanco(banco);
  salvarLog("INSCRICAO", `Novo membro: ${nome}`, null, ip);

  res.json({ ok: true });
});

/* ===================================================== */
/* 🔐 LOGIN E 2FA */
/* ===================================================== */
app.post("/admin/login", (req, res) => {
  const { senha } = req.body;
  const admin = ADMINS.find(a => a.senha === senha && senha !== undefined);
  
  if (!admin) return res.status(401).json({ erro: "Credenciais inválidas." });
  
  res.json({ precisa2FA: true, role: admin.role });
});

app.post("/admin/2fa", (req, res) => {
  const { senha, codigo } = req.body;
  const admin = ADMINS.find(a => a.senha === senha);

  if (!admin) return res.status(401).json({ erro: "Erro de autenticação." });

  const verificado = speakeasy.totp.verify({
    secret: admin.twoFASecret,
    encoding: "base32",
    token: codigo,
    window: 1
  });

  if (!verificado) return res.status(401).json({ erro: "Código 2FA incorreto." });

  const token = crypto.randomBytes(32).toString("hex");
  SESSIONS[token] = { role: admin.role, expira: Date.now() + SESSION_EXPIRATION };
  
  res.json({ token, role: admin.role });
});

/* ===================================================== */
/* 📊 DASHBOARD ADMIN */
/* ===================================================== */
app.post("/admin/inscritos", middlewareAdmin, (req, res) => {
  const banco = lerBanco();
  res.json({ inscritos: banco.inscritos, vagas: banco.vagas });
});

app.post("/admin/excluir", middlewareAdmin, (req, res) => {
  if (req.adminRole !== "superadmin") return res.status(403).json({ erro: "Apenas Superadmin." });
  const { id } = req.body;
  const banco = lerBanco();
  banco.inscritos = banco.inscritos.filter(u => u.id !== id);
  banco.vagas++;
  salvarBanco(banco);
  res.json({ ok: true });
});

app.get("/health", (req, res) => res.json({ status: "online" }));

/* ===================================================== */
/* 🚀 INICIAR SERVIDOR */
/* ===================================================== */
server.listen(PORT, () => {
  console.log(`🚀 HQ Mindset Elite online na porta ${PORT}`);
});
