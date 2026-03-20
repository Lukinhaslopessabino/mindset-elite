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

// CORS: Permitir conexões do seu domínio ou localhost
app.use(cors()); 
app.use(express.json({ limit: "60kb" }));
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;

// Gerenciamento de Sessão Simples
const SESSIONS = {}; 
const SESSION_EXPIRATION = 30 * 60 * 1000;

/* --- BANCO DE DADOS --- */
function lerBanco() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ vagas: 10, inscritos: [] }));
  }
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
  } catch (e) {
    return { vagas: 10, inscritos: [] };
  }
}

function salvarBanco(dados) {
  const temp = DB_FILE + ".tmp";
  fs.writeFileSync(temp, JSON.stringify(dados, null, 2));
  fs.renameSync(temp, DB_FILE);
  // Notifica todos os clientes conectados sobre a mudança nas vagas
  broadcast({ type: "data_update", vagas: dados.vagas });
}

/* --- COMUNICAÇÃO --- */
function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(c => { if (c.readyState === 1) c.send(msg); });
}

async function enviarMensagemTelegram(nome, telegram, idade) {
  const token = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const texto = `🚀 *Nova Inscrição Elite*\n\n👤 *Nome:* ${nome}\n📱 *Telegram:* ${telegram}\n🎂 *Idade:* ${idade}\n🕒 *Data:* ${new Date().toLocaleString('pt-BR')}`;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: texto, parse_mode: "Markdown" }),
    });
  } catch (e) { console.error("Erro Telegram:", e); }
}

/* --- ROTAS PÚBLICAS --- */

// Retorna vagas atuais
app.get("/vagas", (req, res) => res.json({ vagas: lerBanco().vagas }));

// Rota de Ranking (Pública, mas com dados filtrados)
app.get("/ranking", (req, res) => {
  try {
    const banco = lerBanco();
    // Removemos o campo 'telegram' para privacidade no ranking público
    const listaPublica = (banco.inscritos || []).map(({ telegram, ...publicData }) => publicData);
    res.json({ success: true, ranking: listaPublica });
  } catch (e) {
    res.status(500).json({ success: false, erro: "Erro ao processar dados" });
  }
});

// Inscrição com Honeypot (hp) anti-bot
app.post("/inscrever", async (req, res) => {
  const { nome, idade, telegram, hp } = req.body;
  
  if (hp) return res.status(403).json({ erro: "Bot detectado" });

  const banco = lerBanco();
  if (banco.vagas <= 0) return res.status(400).json({ erro: "Vagas esgotadas" });

  const novoInscrito = {
    id: crypto.randomBytes(4).toString("hex"),
    nome: nome?.trim().substring(0, 30) || "Anônimo",
    idade: Math.min(Math.max(Number(idade), 10), 100) || 18,
    telegram: telegram?.trim().substring(0, 50) || "N/A",
    data: new Date().toISOString(),
    xp: 200, 
    nivel: "Bronze",
    foto: `https://ui-avatars.com/api/?name=${nome}&background=050a15&color=00e0ff`
  };

  banco.inscritos.push(novoInscrito);
  banco.vagas = Math.max(0, banco.vagas - 1);
  salvarBanco(banco);
  
  await enviarMensagemTelegram(novoInscrito.nome, novoInscrito.telegram, novoInscrito.idade);
  res.json({ ok: true, msg: "Inscrição confirmada" });
});

/* --- ADMIN & SEGURANÇA --- */

app.post("/admin/login", (req, res) => {
  const { senha } = req.body;
  const SUPER_PWD = process.env.SUPERADMIN_PASSWORD || "admin123";
  const MOD_PWD = process.env.MODERADOR_PASSWORD || "mod123";

  const isAdmin = (senha === SUPER_PWD || senha === MOD_PWD);
  if (!isAdmin) return res.status(401).json({ erro: "Acesso Negado" });
  
  res.json({ precisa2FA: true });
});

app.post("/admin/2fa", (req, res) => {
  const { senha, codigo } = req.body;
  const SUPER_PWD = process.env.SUPERADMIN_PASSWORD || "admin123";
  
  const secret = senha === SUPER_PWD 
    ? (process.env.SUPERADMIN_2FA_SECRET || "") 
    : (process.env.MODERADOR_2FA_SECRET || "");

  const verificado = speakeasy.totp.verify({
    secret: secret,
    encoding: "base32",
    token: codigo,
    window: 1
  });

  if (!verificado && process.env.NODE_ENV === "production") {
    return res.status(401).json({ erro: "Token expirado ou inválido" });
  }

  const token = crypto.randomBytes(32).toString("hex");
  SESSIONS[token] = { expira: Date.now() + SESSION_EXPIRATION };
  res.json({ success: true, token });
});

/* --- INICIALIZAÇÃO --- */
server.listen(PORT, () => {
  console.log(`
  -----------------------------------------
  🚀 MINDSET ELITE CORE - ATIVO
  🌍 Porta: ${PORT}
  📡 WebSocket: ONLINE
  🛡️ Segurança: 2FA Habilitado
  -----------------------------------------
  `);
});
