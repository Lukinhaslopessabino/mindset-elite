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
app.set("trust proxy", 1); // IP real no Render/Proxy

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

/* ===================================================== */
/* ✅ CORS */
/* ===================================================== */
app.use(
  cors({
    origin: [
      "https://mindset-elite-fcmg.com.br",
      "https://www.mindset-elite-fcmg.com.br",
    ],
  })
);

/* JSON com limite pra não deixar bot mandar payload gigante */
app.use(express.json({ limit: "60kb" }));
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

  sess.expira = Date.now() + SESSION_EXPIRATION;
  req.adminRole = sess.role;
  req.adminIp = req.ip;

  next();
}

/* ===================================================== */
/* 🛡️ RATE LIMIT + ANTI-BOT (PUBLIC) */
/* ===================================================== */
/**
 * Regras:
 * - rate limit por IP: 20 requests / 5 min (no /inscrever)
 * - cooldown de inscrição por IP: 1 inscrição a cada 60s
 */
const RL_WINDOW_MS = 5 * 60 * 1000;
const RL_MAX_REQ = 20;
const SIGNUP_COOLDOWN_MS = 60 * 1000;

const rlMap = new Map(); // ip -> { count, resetAt }
const signupCooldown = new Map(); // ip -> nextAllowedAt

function publicAntiBot(req, res, next) {
  const ip = req.ip || "unknown";

  // user-agent mínimo (bloqueia muita request de bot “vazia”)
  const ua = String(req.headers["user-agent"] || "");
  if (ua.length < 8) {
    salvarLog("ANTIBOT", "User-Agent suspeito (curto)", null, ip);
    return res.status(403).json({ erro: "Requisição bloqueada (UA suspeito)." });
  }

  // rate limit simples
  const now = Date.now();
  const cur = rlMap.get(ip);
  if (!cur || now > cur.resetAt) {
    rlMap.set(ip, { count: 1, resetAt: now + RL_WINDOW_MS });
  } else {
    cur.count += 1;
    if (cur.count > RL_MAX_REQ) {
      salvarLog("RATE_LIMIT", `IP excedeu ${RL_MAX_REQ}/${RL_WINDOW_MS}ms`, null, ip);
      return res.status(429).json({ erro: "Muitas requisições. Tente novamente mais tarde." });
    }
  }

  next();
}

/* ===================================================== */
/* ✅ reCAPTCHA V2 verify (BACKEND REAL) */
/* ===================================================== */
async function verifyRecaptchaV2(recaptchaToken, ip) {
  const secret = process.env.RECAPTCHA_SECRET;
  if (!secret) {
    // Sem secret = sem validação real (não recomendado)
    return { ok: false, erro: "RECAPTCHA_SECRET não configurado no servidor." };
  }

  if (!recaptchaToken || String(recaptchaToken).trim().length < 20) {
    return { ok: false, erro: "Token reCAPTCHA inválido." };
  }

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", recaptchaToken);
  if (ip) body.set("remoteip", ip);

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 5000);

  try {
    const resp = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: controller.signal,
    });

    const data = await resp.json().catch(() => null);
    if (!data || data.success !== true) {
      return { ok: false, erro: "Falha na validação do reCAPTCHA." };
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, erro: "Erro ao validar reCAPTCHA (timeout/conexão)." };
  } finally {
    clearTimeout(t);
  }
}

/* ===================================================== */
/* ⚡ XP + NÍVEIS AUTOMÁTICOS */
/* ===================================================== */
function calcXP(user, indexByOldest) {
  const idade = Math.max(0, Math.min(Number(user?.idade || 0), 60));
  const ageBonus = idade * 2; // até 120

  const dt = user?.data ? new Date(user.data) : new Date();
  const days = Math.max(0, Math.floor((Date.now() - dt.getTime()) / (1000 * 60 * 60 * 24)));

  const timeXP = days * 15;
  const joinBonus = Math.max(0, 500 - indexByOldest * 12);

  return Math.round(200 + timeXP + joinBonus + ageBonus);
}

function levelFromXP(xp) {
  if (xp >= 1600) return "Diamond";
  if (xp >= 1100) return "Gold";
  if (xp >= 700) return "Silver";
  return "Bronze";
}

function recomputeXPAndLevels(banco) {
  const inscritos = banco.inscritos || [];

  // mais antigo primeiro
  const byOldest = [...inscritos].sort((a, b) => new Date(a.data || 0) - new Date(b.data || 0));
  const oldestIndex = new Map(byOldest.map((u, i) => [u.id, i]));

  for (const u of inscritos) {
    const idx = oldestIndex.has(u.id) ? oldestIndex.get(u.id) : 9999;
    const xp = calcXP(u, idx);
    u.xp = xp;
    u.nivel = levelFromXP(xp);
  }
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

  // garante que xp/nivel existem (caso banco antigo)
  recomputeXPAndLevels(banco);

  // ordena por xp desc
  const ranking = [...banco.inscritos]
    .sort((a, b) => (b.xp || 0) - (a.xp || 0))
    .map((u, i) => ({
      id: u.id,
      nome: u.nome,
      idade: u.idade,
      rank: i + 1,
      foto: u.foto || null,
      data: u.data,
      xp: u.xp || 0,
      nivel: u.nivel || "Bronze",
      telegram: u.telegram || "",
    }));

  res.json({ ranking });
});

/* ===================================================== */
/* 📝 INSCRIÇÃO (PUBLIC) */
/* ===================================================== */
/**
 * body esperado:
 * { nome, idade, telegram, token, hp, ts }
 * - token: reCAPTCHA response
 * - hp: honeypot (deve vir vazio)
 * - ts: timestamp do cliente (Date.now()) pra validar tempo mínimo
 */
app.post("/inscrever", publicAntiBot, async (req, res) => {
  const ip = req.ip || "unknown";
  const ua = String(req.headers["user-agent"] || "");

  try {
    const { nome, idade, telegram, token, hp, ts } = req.body || {};

    // honeypot: se vier preenchido, é bot
    if (hp && String(hp).trim().length > 0) {
      salvarLog("ANTIBOT", "Honeypot preenchido", null, ip);
      return res.status(403).json({ erro: "Requisição bloqueada." });
    }

    // tempo mínimo (evita bot que dispara instant)
    // (permite se não enviar ts, mas recomendo mandar)
    if (ts && Number.isFinite(Number(ts))) {
      const diff = Date.now() - Number(ts);
      if (diff < 2500) {
        salvarLog("ANTIBOT", `Tempo muito rápido (${diff}ms)`, null, ip);
        return res.status(403).json({ erro: "Envio muito rápido. Tente novamente." });
      }
    }

    // cooldown por IP (1 inscrição / 60s)
    const nextAllowed = signupCooldown.get(ip) || 0;
    if (Date.now() < nextAllowed) {
      return res.status(429).json({ erro: "Aguarde um pouco antes de tentar novamente." });
    }

    // validações fortes
    const nomeOk = String(nome || "").trim();
    const tgOk = String(telegram || "").trim();
    const idadeNum = Number(idade);

    if (nomeOk.length < 2 || nomeOk.length > 40) return res.status(400).json({ erro: "Nome inválido." });
    if (!tgOk.startsWith("@") || tgOk.length < 4 || tgOk.length > 32) return res.status(400).json({ erro: "Telegram inválido." });
    if (!Number.isFinite(idadeNum) || idadeNum < 16 || idadeNum > 80) return res.status(400).json({ erro: "Idade inválida." });

    // bloqueia caracteres muito “bot”
    if (/http|www\.|\.com|<|>|script|select\s|insert\s/i.test(nomeOk + " " + tgOk)) {
      salvarLog("ANTIBOT", "Padrão suspeito no payload", null, ip);
      return res.status(403).json({ erro: "Requisição bloqueada." });
    }

    // ✅ reCAPTCHA REAL
    const cap = await verifyRecaptchaV2(token, ip);
    if (!cap.ok) {
      salvarLog("RECAPTCHA_FAIL", cap.erro, null, ip);
      return res.status(403).json({ erro: cap.erro || "Falha no reCAPTCHA." });
    }

    const banco = lerBanco();

    if (banco.vagas <= 0) {
      return res.status(400).json({ erro: "Vagas esgotadas." });
    }

    // anti-fraude: não permitir telegram duplicado
    const tgLower = tgOk.toLowerCase();
    const exists = banco.inscritos.some((u) => String(u.telegram || "").toLowerCase() === tgLower);
    if (exists) return res.status(409).json({ erro: "Este Telegram já está inscrito." });

    // cria user
    const user = {
      id: crypto.randomBytes(10).toString("hex"),
      nome: nomeOk,
      idade: idadeNum,
      telegram: tgOk,
      data: new Date().toISOString(),
      foto: null,
      ip,
      ua: ua.slice(0, 180),
    };

    banco.inscritos.push(user);
    banco.vagas = Math.max(0, Number(banco.vagas || 0) - 1);

    // calcula XP/Nível e salva
    recomputeXPAndLevels(banco);

    salvarBanco(banco);

    // trava cooldown após sucesso
    signupCooldown.set(ip, Date.now() + SIGNUP_COOLDOWN_MS);

    salvarLog("INSCRICAO", `Novo inscrito: ${user.nome} (${user.telegram})`, null, ip);

    res.json({ ok: true });
  } catch (e) {
    salvarLog("ERRO_INSCRICAO", String(e?.message || e), null, ip);
    res.status(500).json({ erro: "Erro interno." });
  }
});

/* ===================================================== */
/* 🔐 LOGIN (PASSO 1) -> pede 2FA */
/* ===================================================== */
app.post("/admin/login", (req, res) => {
  const ip = req.ip;

  if (IP_BLOQUEADO[ip] && Date.now() < IP_BLOQUEADO[ip]) {
    salvarLog("LOGIN_BLOQUEADO", "Tentou logar com IP bloqueado", null, ip);
    return res.status(403).json({ erro: "IP bloqueado temporariamente" });
  }
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
/* 📜 LOGS (retorna {logs}) */
/* ===================================================== */
app.post("/admin/logs", middlewareAdmin, (req, res) => {
  const logs = lerLogs().reverse();
  res.json({ logs });
});

/* ===================================================== */
/* 📈 MÉTRICAS */
/* ===================================================== */
app.post("/admin/metricas", middlewareAdmin, (req, res) => {
  const banco = lerBanco();
  const inscritos = banco.inscritos || [];

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

  const banco = lerBanco();
  // aqui você pode amarrar foto a um user específico se quiser (por id)
  salvarLog("UPLOAD", `arquivo=${req.file.filename}`, req.adminRole, req.adminIp);
  res.json({ arquivo: req.file.filename });
});

/* ===================================================== */
/* HEALTH */
/* ===================================================== */
app.get("/health", (req, res) => res.json({ ok: true }));

/* ===================================================== */
server.listen(PORT, () => {
  console.log("🚀 SaaS Server rodando com WebSocket + 2FA + reCAPTCHA + AntiBot + Levels");
});
