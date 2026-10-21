// Registra gli slash command su Discord. Da eseguire in locale, NON sul Worker:
//   DISCORD_TOKEN=... DISCORD_APPLICATION_ID=... npm run register
// Con DISCORD_GUILD_ID i comandi compaiono subito su quel server (consigliato mentre provi).
// Senza, diventano globali e Discord può impiegare fino a circa un'ora a mostrarli.
// `--dry` stampa le definizioni senza inviare nulla.
import { definizioni } from '../src/registry.js';

const defs = definizioni();

if (process.argv.includes('--dry')) {
  console.log(JSON.stringify(defs, null, 2));
  console.log(`\n${defs.length} comandi validi (dry run, nulla inviato).`);
  process.exit(0);
}

const { DISCORD_TOKEN, DISCORD_APPLICATION_ID, DISCORD_GUILD_ID } = process.env;
if (!DISCORD_TOKEN || !DISCORD_APPLICATION_ID) {
  console.error('Servono le variabili DISCORD_TOKEN e DISCORD_APPLICATION_ID.');
  process.exit(1);
}

const url = DISCORD_GUILD_ID
  ? `https://discord.com/api/v10/applications/${DISCORD_APPLICATION_ID}/guilds/${DISCORD_GUILD_ID}/commands`
  : `https://discord.com/api/v10/applications/${DISCORD_APPLICATION_ID}/commands`;

// PUT sostituisce l'intero elenco: i comandi che togli dal progetto spariscono anche da Discord.
const res = await fetch(url, {
  method: 'PUT',
  headers: { Authorization: `Bot ${DISCORD_TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(defs),
});

if (!res.ok) {
  console.error(`Errore ${res.status}:`, await res.text());
  process.exit(1);
}
const registrati = await res.json();
console.log(`Registrati ${registrati.length} comandi${DISCORD_GUILD_ID ? ' sul server di prova' : ' (globali)'}: ${registrati.map((c) => '/' + c.name).join(', ')}`);
