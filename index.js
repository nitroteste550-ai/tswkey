const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const { Client: PG } = require("pg");
const express = require("express");
const crypto = require("crypto");
const axios = require("axios");

// ===== CONFIGURAÇÃO =====
const TOKEN = process.env.DISCORD_TOKEN;
const DATABASE_URL = process.env.DATABASE_URL;
const WEBHOOK_LOGS = "https://discord.com/api/webhooks/1491927784073728110/Yp2SUhRs9fFe0f0oSxn9bsTX647gZkOx-iaVcCHm7iIvmlftQ2CtqdEQAbVf0iTvevPm"; // Para os logs de login
const ADMINS = ["1092114875435724940"]; // Seu ID para comandos VIP

// ===== CONEXÃO COM O BANCO =====
const db = new PG({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

db.connect().then(() => console.log("🟢 Banco de Dados Conectado")).catch(err => console.error("🔴 Erro no Banco:", err));

// ===== WEB SERVER (API PARA O ROBLOX) =====
const app = express();
app.use(express.json());

// Rota de Verificação (O que o Roblox consulta)
app.post("/verify", async (req, res) => {
  const { key, hwid } = req.body;
  try {
    const result = await db.query("SELECT * FROM keys WHERE key = $1 AND ativa = true", [key]);
    if (result.rows.length === 0) return res.json({ status: "invalid" });

    const row = result.rows[0];
    if (!row.hwid) {
      await db.query("UPDATE keys SET hwid = $1 WHERE key = $2", [hwid, key]);
      return res.json({ status: "success" });
    }
    if (row.hwid === hwid) return res.json({ status: "success" });
    
    return res.json({ status: "locked" });
  } catch (err) { res.json({ status: "error" }); }
});

// Rota de Log (O que o Roblox avisa quando abre)
app.post("/log", async (req, res) => {
  const { username, userId, rank, hwid, key } = req.body;
  try {
    await axios.post(WEBHOOK_LOGS, {
      embeds: [{
        title: "🚀 SOUZA METHODS - ACESSO DETECTADO",
        color: 0x00B8FF,
        fields: [
          { name: "👤 Jogador", value: `${username} (${userId})`, inline: true },
          { name: "📊 Rank", value: rank, inline: true },
          { name: "🔑 Key", value: `\`${key}\``, inline: false },
          { name: "🖥️ HWID", value: `\`${hwid}\``, inline: false }
        ],
        timestamp: new Date()
      }]
    });
    res.json({ success: true });
  } catch (e) { res.json({ success: false }); }
});

app.listen(process.env.PORT || 3000, () => console.log("🌐 API Online"));

// ===== BOT DO DISCORD =====
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

function gerarKey() { return "ICE-" + crypto.randomBytes(4).toString("hex").toUpperCase(); }

client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;
  const args = msg.content.split(" ");
  const cmd = args[0];

  // COMANDO !GEN (Só para você)
  if (cmd === "!gen" && ADMINS.includes(msg.author.id)) {
    const quant = parseInt(args[1]) || 1;
    let geradas = [];
    for (let i = 0; i < quant; i++) {
      const k = gerarKey();
      await db.query("INSERT INTO keys (key, user_id, ativa) VALUES ($1, $2, true)", [k, msg.author.id]);
      geradas.push(k);
    }
    msg.reply(`✅ **${quant} Keys Geradas:**\n${geradas.map(k => `\`${k}\``).join("\n")}`);
  }

  // COMANDO !RESET (Resetar HWID de uma key)
  if (cmd === "!reset" && ADMINS.includes(msg.author.id)) {
    const k = args[1];
    await db.query("UPDATE keys SET hwid = NULL WHERE key = $1", [k]);
    msg.reply(`♻️ HWID da key \`${k}\` foi resetado!`);
  }
});

client.login(TOKEN);
