import express from "express";
import fs from "fs";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("./"));

const PORT = process.env.PORT || 3000;

// 🔐 COLOQUE SEU TOKEN (sem "bot")
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const DB_PATH = "./database.json";

/* =========================
   GARANTIR QUE BANCO EXISTE
========================= */
if (!fs.existsSync(DB_PATH)) {
  fs.writeFileSync(DB_PATH, JSON.stringify({
    vagas: 1,
    inscritos: [],
    ipsBloqueados: []
  }, null, 2));
}

function lerBanco() {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH));
  } catch {
    return { vagas: 1, inscritos: [], ipsBloqueados: [] };
  }
}

function salvarBanco(dados) {
  fs.writeFileSync(DB_PATH, JSON.stringify(dados, null, 2));
}

/* =========================
   ROTA CONSULTAR VAGAS
========================= */
app.get("/vagas", (req, res) => {
  const banco = lerBanco();
  res.json({ vagas: banco.vagas });
});

/*=========================
ROTA FORMULÁRIO
=========================*/
app.get("/formulario", (req, res) => {
  res.sendFile(process.cwd() + "/formulario.html");
});

/* =========================
   ROTA INSCRIÇÃO
========================= */
app.post("/inscrever", async (req, res) => {
  try {
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

    // Atualizar banco
    banco.vagas -= 1;
    banco.inscritos.push({ nome, idade, telegram, ip, data: new Date() });
    banco.ipsBloqueados.push(ip);

    salvarBanco(banco);

    // Enviar Telegram
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

  } catch (err) {
    console.log("Erro geral:", err);
    res.status(500).json({ erro: "Erro interno no servidor." });
  }
});

/* =========================
   INICIAR SERVIDOR
========================= */
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});