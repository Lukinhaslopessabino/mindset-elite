import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import crypto from "crypto";
import http from "http";
import { WebSocketServer } from "ws";
import speakeasy from "speakeasy";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set("trust proxy", 1); 

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

/* --- CONFIGS --- */
const DB_FILE = path.join(__dirname, "database.json");
const LOG_FILE = path.join(__dirname, "logs.json");

app.use(cors({
  origin: ["https://mindset-elite-fcmg.com.br", "https://www.mindset-elite-fcmg.com.br"],
  methods: ["GET", "POST"]
}));
app.use(express.json({ limit: "60kb" }));
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;

const SESSIONS = {}; 
const SESSION_EXPIRATION = 30 * 60 * 1000;

/* --- BANCO DE DADOS --- */
function lerBanco() {
  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({ vagas: 1, inscritos: [] }));
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
  } catch (e) {
    return { vagas: 1, inscritos: [] };
  }
}

function salvarBanco(dados) {
  const temp = DB_FILE + ".tmp";
  fs.writeFileSync(temp, JSON.stringify(dados, null, 2));
  fs.renameSync(temp, DB_FILE);
  broadcast({ type: "data_update", vagas: dados.vagas });
}

/* --- TELEGRAM --- */
async function enviarMensagemTelegram(nome, telegram, idade) {
  const token = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const texto = `🚀 *Nova Inscrição*\n👤 *Nome:* ${nome}\n📱 *Telegram:* ${telegram}\n🎂 *Idade:* ${idade}`;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: texto, parse_mode: "Markdown" }),
    });
  } catch (e) { console.error("Erro Telegram:", e); }
}

function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(c => { if (c.readyState === 1) c.send(msg); });
}

/* --- ROTAS --- */
app.get("/vagas", (req, res) => res.json({ vagas: lerBanco().vagas }));

app.post("/inscrever", async (req, res) => {
  const { nome, idade, telegram, hp } = req.body;
  if (hp) return res.status(403).end();

  const banco = lerBanco();
  if (banco.vagas <= 0) return res.status(400).json({ erro: "Esgotado" });

  const novo = {
    id: crypto.randomBytes(4).toString("hex"),
    nome: nome?.trim() || "Anônimo",
    idade: Number(idade) || 0,
    telegram: telegram?.trim() || "N/A",
    data: new Date().toISOString(),
    xp: 200, nivel: "Bronze"
  };

  banco.inscritos.push(novo);
  banco.vagas = Math.max(0, banco.vagas - 1);
  salvarBanco(banco);
  
  await enviarMensagemTelegram(novo.nome, novo.telegram, novo.idade);
  res.json({ ok: true });
});

/* --- ADMIN --- */
app.post("/admin/login", (req, res) => {
  const { senha } = req.body;
  const isAdmin = (senha === process.env.SUPERADMIN_PASSWORD || senha === process.env.MODERADOR_PASSWORD);
  if (!isAdmin) return res.status(401).json({ erro: "Senha incorreta" });
  res.json({ precisa2FA: true });
});

app.post("/admin/2fa", (req, res) => {
  const { senha, codigo } = req.body;
  const secret = senha === process.env.SUPERADMIN_PASSWORD ? process.env.SUPERADMIN_2FA_SECRET : process.env.MODERADOR_2FA_SECRET;

  const verificado = speakeasy.totp.verify({
    secret: secret || "",
    encoding: "base32",
    token: codigo,
    window: 1
  });

  if (!verificado) return res.status(401).json({ erro: "Código inválido" });

  const token = crypto.randomBytes(32).toString("hex");
  SESSIONS[token] = { expira: Date.now() + SESSION_EXPIRATION };
  res.json({ token });
});

server.listen(PORT, () => console.log(`🚀 Mindset Elite Online na porta ${PORT}`));
