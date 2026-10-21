const fs = require('fs');
const path = require('path');
const express = require('express');
const { Client, GatewayIntentBits } = require('discord.js');
const { embed, errore, tokenize, norm } = require('./lib/util');

const PREFIX = process.env.PREFIX || '!';

// --- Server web: serve solo a Render e a UptimeRobot per tenere il processo sveglio ---
const app = express();
app.get('/', (req, res) => res.send('Bot attivo'));
app.get('/health', (req, res) => res.json({ ok: true, uptime: process.uptime() }));
app.listen(process.env.PORT || 3000, () => console.log('Server web in ascolto'));

// --- Comandi ---
// 1) Comandi semplici: tutto in data/comandi.json (nessun codice da scrivere).
// 2) Comandi con logica: un file in handlers/, registrato qui sotto.
const gestori = {
  locanda: require('./handlers/locanda'),
  itinerario: require('./handlers/itinerario'),
};

function caricaSemplici() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'comandi.json'), 'utf8'));
}

function cercaComando(nome) {
  const n = norm(nome);
  if (n === 'aiuto' || n === 'help') return { tipo: 'aiuto' };
  if (gestori[n]) return { tipo: 'gestore', gestore: gestori[n] };
  const semplici = caricaSemplici();
  for (const [chiave, def] of Object.entries(semplici)) {
    if (norm(chiave) === n || (def.alias || []).some((a) => norm(a) === n)) return { tipo: 'semplice', def };
  }
  return null;
}

function risposteAiuto() {
  const righe = [];
  for (const [nome, g] of Object.entries(gestori)) righe.push(`\`${g.uso || PREFIX + nome}\`: ${g.descrizione}`);
  for (const [nome, def] of Object.entries(caricaSemplici())) righe.push(`\`${PREFIX}${nome}\`: ${def.descrizione || ''}`);
  return { embeds: [embed({ titolo: 'Comandi disponibili', descrizione: righe.join('\n') })] };
}

// --- Bot Discord ---
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

// 'ready' è stato rinominato 'clientReady' nelle versioni recenti di discord.js: ascolto entrambi.
let avviato = false;
const pronto = () => {
  if (avviato) return;
  avviato = true;
  console.log(`Online come ${client.user.tag}`);
};
client.once('clientReady', pronto);
client.once('ready', pronto);

client.on('messageCreate', async (msg) => {
  if (msg.author.bot || !msg.content.startsWith(PREFIX)) return;
  const [nome, ...resto] = tokenize(msg.content.slice(PREFIX.length));
  if (!nome) return;

  const cmd = cercaComando(nome);
  if (!cmd) return; // comando sconosciuto: silenzio, come Avrae con i comandi di altri bot

  try {
    let risposta;
    if (cmd.tipo === 'aiuto') risposta = risposteAiuto();
    else if (cmd.tipo === 'gestore') risposta = await cmd.gestore.run(resto, msg);
    else {
      const e = cmd.def.embed || {};
      risposta = { embeds: [embed(e)] };
    }
    await msg.reply({ ...risposta, allowedMentions: { repliedUser: false } });
  } catch (err) {
    console.error(`Errore nel comando ${nome}:`, err);
    await msg.reply({ ...errore('Qualcosa è andato storto nel comando.'), allowedMentions: { repliedUser: false } }).catch(() => {});
  }
});

if (!process.env.DISCORD_TOKEN) {
  console.error('Manca la variabile DISCORD_TOKEN.');
  process.exit(1);
}
client.login(process.env.DISCORD_TOKEN);
