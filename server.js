import express from "express";
import fs from "fs";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("./"));

const PORT = 3000;
const ADMIN_PASSWORD = "123456"; // 🔐 MUDE ISSO

// 🔐 SEU TELEGRAM
const TELEGRAM_TOKEN = "8575303881:AAG8eV7o6lZIRghNYWBF4BUQ4QiNwq8lKgw";
const TELEGRAM_CHAT_ID = "6499587542";

function lerBanco() {
  if (!fs.existsSync("./database.json")) {
    fs.writeFileSync("./database.json", JSON.stringify({
      vagas: 1,
      inscritos: [],
      ipsBloqueados: [],
      tentativas: {}
    }, null, 2));
  }
  return JSON.parse(fs.readFileSync("./database.json"));
}

function salvarBanco(dados) {
  fs.writeFileSync("./database.json", JSON.stringify(dados, null, 2));
}

////////////////////////////////////////////////////////
// 🔥 ROTA VAGAS
////////////////////////////////////////////////////////
app.get("/vagas", (req, res) => {
  const banco = lerBanco();
  res.json({ vagas: banco.vagas });
});

////////////////////////////////////////////////////////
// 🔥 ROTA INSCRIÇÃO
////////////////////////////////////////////////////////
app.post("/inscrever", async (req, res) => {
  const { nome, idade, telegram } = req.body;
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  const banco = lerBanco();

  if (banco.vagas <= 0) {
    return res.status(400).json({ erro: "Vagas esgotadas." });
  }

  if (banco.ipsBloqueados.includes(ip)) {
    return res.status(400).json({ erro: "Este IP já realizou inscrição." });
  }

  if (!telegram || !telegram.startsWith("@")) {
    return res.status(400).json({ erro: "Telegram inválido." });
  }

  if (!idade || idade < 16) {
    return res.status(400).json({ erro: "Idade mínima é 16 anos." });
  }

  banco.vagas -= 1;
  banco.inscritos.push({ nome, idade, telegram, ip });
  banco.ipsBloqueados.push(ip);

  salvarBanco(banco);

  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: `🚀 Nova Inscrição Mindset\n\n👤 Nome: ${nome}\n🎂 Idade: ${idade}\n📲 Telegram: ${telegram}\n🌐 IP: ${ip}`
      })
    });
  } catch (err) {
    console.log("Erro Telegram:", err);
  }

  res.json({ sucesso: true });
});

////////////////////////////////////////////////////////
// 🔥 ADMIN - LISTAR BLOQUEADOS
////////////////////////////////////////////////////////
app.post("/admin/bloqueados", (req, res) => {
  const { senha } = req.body;

  if (senha !== ADMIN_PASSWORD) {
    return res.status(401).json({ erro: "Senha incorreta." });
  }

  const banco = lerBanco();

  const lista = banco.ipsBloqueados.map(ip => ({ ip }));

  res.json({ bloqueados: lista });
});

////////////////////////////////////////////////////////
// 🔓 ADMIN - DESBLOQUEAR
////////////////////////////////////////////////////////
app.post("/admin/desbloquear", (req, res) => {
  const { senha, ip } = req.body;

  if (senha !== ADMIN_PASSWORD) {
    return res.status(401).json({ erro: "Senha incorreta." });
  }

  const banco = lerBanco();

  banco.ipsBloqueados = banco.ipsBloqueados.filter(i => i !== ip);

  salvarBanco(banco);

  res.json({ sucesso: true });
});

////////////////////////////////////////////////////////

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
