import express from "express";
import fs from "fs";
import cors from "cors";
import fetch from "node-fetch";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import rateLimit from "express-rate-limit";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("./"));

const PORT = 3000;

// 🔐 CONFIGURAÇÕES
const JWT_SECRET = "mindset_ultra_secret_2026";

// ⚠️ GERE O HASH UMA VEZ E COLE AQUI
// senha original: mindset2026
const ADMIN_USER = "admin";
const ADMIN_HASH = "$2b$10$Fos6XXRXxecWEz0K4rIZL.2xbgJA9CTkdBabLrGSC.hGjWREsB8Fi"; 

const TELEGRAM_TOKEN = "8575303881:AAG8eV7o6lZIRghNYWBF4BUQ4QiNwq8lKgw";
const TELEGRAM_CHAT_ID = "6499587542";


// 🛡️ RATE LIMIT GLOBAL (100 requisições / 15 min por IP)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { erro: "Muitas requisições. Tente novamente mais tarde." }
});
app.use(globalLimiter);

// 🛡️ RATE LIMIT LOGIN (5 tentativas / 15 min)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { erro: "Muitas tentativas de login. Aguarde 15 minutos." }
});

function lerBanco() {
  return JSON.parse(fs.readFileSync("./database.json"));
}

function salvarBanco(dados) {
  fs.writeFileSync("./database.json", JSON.stringify(dados, null, 2));
}


// 🔥 LOGIN ADMIN COM BCRYPT
app.post("/admin/login", loginLimiter, async (req, res) => {
  const { usuario, senha } = req.body;

  if (usuario !== ADMIN_USER)
    return res.status(401).json({ erro: "Credenciais inválidas" });

  const senhaValida = await bcrypt.compare(senha, ADMIN_HASH);

  if (!senhaValida)
    return res.status(401).json({ erro: "Credenciais inválidas" });

  const token = jwt.sign({ usuario }, JWT_SECRET, { expiresIn: "2h" });

  res.json({ token });
});


// 🔐 MIDDLEWARE JWT
function verificarToken(req, res, next) {
  const auth = req.headers.authorization;

  if (!auth) return res.status(401).json({ erro: "Sem token" });

  const token = auth.split(" ")[1];

  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ erro: "Token inválido ou expirado" });
  }
}


// 🔥 STATUS VAGAS
app.get("/vagas", (req, res) => {
  const banco = lerBanco();
  res.json({ vagas: banco.vagas });
});


// 🔥 INSCRIÇÃO COM RATE LIMIT
const formularioLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 3,
  message: { erro: "Muitas tentativas. Aguarde alguns minutos." }
});

app.post("/inscrever", formularioLimiter, async (req, res) => {
  const { nome, idade, telegram } = req.body;
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  const banco = lerBanco();

  if (banco.vagas <= 0)
    return res.status(400).json({ erro: "Vagas esgotadas." });

  if (banco.ipsBloqueados.includes(ip))
    return res.status(400).json({ erro: "Este IP já realizou inscrição." });

  if (!telegram || !telegram.startsWith("@"))
    return res.status(400).json({ erro: "Telegram inválido." });

  if (!idade || idade < 16)
    return res.status(400).json({ erro: "Idade mínima 16 anos." });

  banco.vagas--;
  banco.inscritos.push({ nome, idade, telegram, ip });
  banco.ipsBloqueados.push(ip);

  salvarBanco(banco);

  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: `🚀 Nova Inscrição\n👤 ${nome}\n🎂 ${idade}\n📲 ${telegram}\n🌐 ${ip}`
      })
    });
  } catch {}

  res.json({ sucesso: true });
});


// 🔥 PAINEL PROTEGIDO
app.get("/admin/inscritos", verificarToken, (req, res) => {
  const banco = lerBanco();
  res.json({ inscritos: banco.inscritos, vagas: banco.vagas });
});

app.post("/admin/reset", verificarToken, (req, res) => {
  const banco = lerBanco();
  banco.vagas = 1;
  salvarBanco(banco);
  res.json({ sucesso: true });
});

app.post("/admin/limpar", verificarToken, (req, res) => {
  const banco = lerBanco();
  banco.inscritos = [];
  banco.ipsBloqueados = [];
  salvarBanco(banco);
  res.json({ sucesso: true });
});


app.listen(PORT, () => {
  console.log("Servidor seguro rodando na porta " + PORT);
});
