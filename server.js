import express from "express";
import fs from "fs";
import cors from "cors";
import crypto from "crypto";
import http from "http";
import multer from "multer";
import { WebSocketServer } from "ws";
import speakeasy from "speakeasy";
import QRCode from "qrcode";
import path from "path";

const app = express();
app.set("trust proxy", 1); 

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors({
  origin: ["https://mindset-elite-fcmg.com.br", "https://www.mindset-elite-fcmg.com.br"]
}));

app.use(express.json({ limit: "60kb" }));
app.use(express.static("./"));

const PORT = process.env.PORT || 3000;

/* --- CONFIGURAÇÕES DE ARQUIVOS --- */
const DB_FILE = "./database.json";
const LOG_FILE = "./logs.json";
const IMAGES_DIR = "./images";
if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR);

/* --- SESSÕES E SEGURANÇA --- */
const SESSIONS = {}; 
const SESSION_EXPIRATION = 30 * 60 * 1000;
const LOGIN_TENTATIVAS = {}; 
const IP_BLOQUEADO = {}; 
const MAX_TENTATIVAS = 5;
const BLOQUEIO_TEMPO = 15 * 60 * 1000;

const ADMINS = [
  { senha: process.env.SUPERADMIN_PASSWORD, role: "superadmin", twoFASecret: process.env.SUPERADMIN_2FA_SECRET || "" },
  { senha: process.env.MODERADOR_PASSWORD, role: "moderador", twoFASecret: process.env.MODERADOR_2FA_SECRET || "" }
];

/* --- WEBSOCKET BROADCAST --- */
function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(msg);
  });
}

/* --- PERSISTÊNCIA SEGURA --- */
function lerBanco() {
  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({ vagas: 1, inscritos: [] }));
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
  } catch (e) {
    return { vagas: 1, inscritos: [] };
  }
}

function salvarBanco(dados) {
  // Escrita atômica para evitar corrupção de dados
  const tempPath = DB_FILE + ".tmp";
  fs.writeFileSync(tempPath, JSON.stringify(dados, null, 2));
  fs.renameSync(tempPath, DB_FILE);
  
  broadcast({ type: "data_update", vagas: dados.vagas });
}

/* --- LÓGICA DE XP --- */
function recomputeXPAndLevels(banco) {
  const inscritos = banco.inscritos || [];
  const byOldest = [...inscritos].sort((a, b) => new Date(a.data) - new Date(b.data));
  const oldestIndex = new Map(byOldest.map((u, i) => [u.id, i]));

  for (const u of inscritos) {
    const idx = oldestIndex.get(u.id) || 0;
    const idade = Math.max(16, Math.min(Number(u.idade || 0), 80));
    const days = Math.floor((Date.now() - new Date(u.data).getTime()) / (1000 * 60 * 60 * 24));
    
    const xp = Math.round(200 + (days * 15) + (Math.max(0, 500 - idx * 12)) + (idade * 2));
    u.xp = xp;
    u.nivel = xp >= 1600 ? "Diamond" : xp >= 1100 ? "Gold" : xp >= 700 ? "Silver" : "Bronze";
  }
}

/* --- ROTAS --- */
app.get("/vagas", (req, res) => res.json({ vagas: lerBanco().vagas }));

app.post("/inscrever", async (req, res) => {
  const { nome, idade, telegram, token, hp } = req.body;
  const ip = req.ip;

  if (hp) return res.status(403).json({ erro: "Bot detectado." });

  const banco = lerBanco();
  if (banco.vagas <= 0) return res.status(400).json({ erro: "Vagas esgotadas." });
  
  if (banco.inscritos.some(u => u.telegram.toLowerCase() === telegram.toLowerCase())) {
    return res.status(409).json({ erro: "Telegram já cadastrado." });
  }

  const novo = {
    id: crypto.randomBytes(4).toString("hex"),
    nome, idade, telegram,
    data: new Date().toISOString(),
    foto: null, ip
  };

  banco.inscritos.push(novo);
  banco.vagas--;
  recomputeXPAndLevels(banco);
  salvarBanco(banco);

  res.json({ ok: true });
});

// Rota de Setup 2FA (Apenas para configuração inicial)
app.post("/admin/2fa/setup", async (req, res) => {
    const { senha } = req.body;
    const admin = ADMINS.find(a => a.senha === senha);
    if (!admin) return res.status(401).json({ erro: "Acesso negado." });

    const secret = speakeasy.generateSecret({ name: `MindsetElite:${admin.role}` });
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);
    
    res.json({ secret: secret.base32, qrCode: qrCodeUrl });
});

app.post("/admin/2fa", (req, res) => {
    const { senha, codigo } = req.body;
    const admin = ADMINS.find(a => a.senha === senha);
    
    if (!admin) return res.status(401).json({ erro: "Senha incorreta." });

    const verificado = speakeasy.totp.verify({
        secret: admin.twoFASecret,
        encoding: 'base32',
        token: codigo,
        window: 1
    });

    if (!verificado) return res.status(401).json({ erro: "Código 2FA inválido." });

    const token = crypto.randomBytes(32).toString("hex");
    SESSIONS[token] = { role: admin.role, expira: Date.now() + SESSION_EXPIRATION };
    
    res.json({ token, role: admin.role });
});

/* --- START SERVER --- */
server.listen(PORT, () => console.log(`🚀 Servidor Ativo na porta ${PORT}`));
