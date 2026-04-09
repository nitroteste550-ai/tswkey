const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const { Client: PG } = require("pg");
const express = require("express");
const crypto = require("crypto");
const axios = require("axios");

// ==========================================
// ⚙️ CONFIGURAÇÃO MANUAL (PREENCHA AQUI)
// ==========================================
const TOKEN = process.env.DISCORD_TOKEN; 
const DATABASE_URL = "postgresql://postgres:bHMMljVUTbKOLLwukQFGIVhDCqHyKTHi@postgres.railway.internal:5432/railway";
const ADMINS = ["1092114875435724940"]; 
const WEBHOOK_LOGS = "https://discord.com/api/webhooks/1491927784073728110/Yp2SUhRs9fFe0f0oSxn9bsTX647gZkOx-iaVcCHm7iIvmlftQ2CtqdEQAbVf0iTvevPm"; 

// ==========================================
// 🐘 CONEXÃO COM O BANCO DE DADOS
// ==========================================
const db = new PG({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

db.connect()
  .then(() => console.log("🟢 [BANCO] Conectado com sucesso ao PostgreSQL"))
  .catch(err => console.error("🔴 [BANCO] Erro ao conectar:", err));

// ==========================================
// 🌐 SERVIDOR WEB (API PARA O ROBLOX)
// ==========================================
const app = express();
app.use(express.json());

app.get("/", (req, res) => res.send("Souza Methods API Online ✅"));

// ROTA PARA VERIFICAR KEY
app.post("/verify", async (req, res) => {
  try {
    const { key, hwid } = req.body;

    const result = await db.query(
      "SELECT * FROM keys WHERE key = $1 AND ativa = true",
      [key]
    );

    if (result.rows.length === 0) return res.json({ status: "invalid" });

    const row = result.rows[0];

    // Se a key não tem HWID, ela prende no primeiro que logar
    if (!row.hwid) {
      await db.query("UPDATE keys SET hwid = $1 WHERE key = $2", [hwid, key]);
      return res.json({ status: "success" });
    }

    // Se já tem HWID, verifica se é o mesmo
    if (row.hwid === hwid) {
      return res.json({ status: "success" });
    }

    return res.json({ status: "locked" });

  } catch (err) {
    console.error(err);
    res.json({ status: "error" });
  }
});

// ROTA DE LOGS DO SCRIPT
app.post("/log", async (req, res) => {
  try {
    const { username, userId, rank, hwid, key } = req.body;

    await axios.post(WEBHOOK_LOGS, {
      embeds: [{
        title: "🚀 SOUZA METHODS - ACESSO DETECTADO",
        color: 0x00B8FF,
        fields: [
          { name: "👤 Jogador", value: `[${username}](https://www.roblox.com/users/${userId}/profile)`, inline: true },
          { name: "📊 Rank", value: rank, inline: true },
          { name: "🔑 Key Usada", value: `\`${key}\``, inline: false },
          { name: "🖥️ HWID", value: `\`${hwid}\``, inline: false }
        ],
        footer: { text: "Sistema de Monitoramento Ice Hub" },
        timestamp: new Date()
      }]
    });

    res.json({ success: true });
  } catch (e) {
    res.json({ success: false });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 [WEB] API rodando na porta ${PORT}`));

// ==========================================
// 🤖 BOT DO DISCORD
// ==========================================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

function gerarKey() {
  return "ICE-" + crypto.randomBytes(4).toString("hex").toUpperCase();
}

client.once("ready", () => {
  console.log(`🤖 [BOT] Logado como ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const args = message.content.split(" ");
  const cmd = args[0];

  // COMANDO !GEN [QUANTIDADE]
  if (cmd === "!gen") {
    if (!ADMINS.includes(message.author.id)) {
        return message.reply("❌ Apenas o **Gustavo** pode gerar keys.");
    }

    const quantidade = parseInt(args[1]) || 1;
    let keys = [];

    for (let i = 0; i < quantidade; i++) {
      const key = gerarKey();
      await db.query(
        "INSERT INTO keys (user_id, key, ativa) VALUES ($1, $2, true)",
        [message.author.id, key]
      );
      keys.push(key);
    }

    const embed = new EmbedBuilder()
      .setTitle("🔑 Keys Geradas com Sucesso")
      .setDescription(`As chaves foram salvas no banco de dados.\n\n${keys.map(k => `\`${k}\``).join("\n")}`)
      .setColor(0x00B8FF);

    return message.reply({ embeds: [embed] });
  }

  // COMANDO !RESET [KEY]
  if (cmd === "!reset") {
    if (!ADMINS.includes(message.author.id)) return;
    const key = args[1];
    if (!key) return message.reply("❌ Use: `!reset ICE-XXXX` ");

    await db.query("UPDATE keys SET hwid = NULL WHERE key = $1", [key]);
    return message.reply(`♻️ HWID da key \`${key}\` resetado com sucesso!`);
  }

  // COMANDO !DELETE [KEY]
  if (cmd === "!delete") {
    if (!ADMINS.includes(message.author.id)) return;
    const key = args[1];
    await db.query("DELETE FROM keys WHERE key = $1", [key]);
    return message.reply(`🗑️ Key \`${key}\` deletada.`);
  }
});

client.login(TOKEN);
