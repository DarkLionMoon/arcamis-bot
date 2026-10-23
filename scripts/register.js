js
// Registra gli slash command su Discord.
// DISCORD_GUILD_ID può contenere più ID separati da virgola.
// Se è assente, i comandi vengono registrati globalmente.

import { definizioni } from '../src/registry.js';

const defs = definizioni();

if (process.argv.includes('--dry')) {
  console.log(JSON.stringify(defs, null, 2));
  console.log('\n' + defs.length + ' comandi validi (dry run, nulla inviato).');
  process.exit(0);
}

const {
  DISCORD_TOKEN,
  DISCORD_APPLICATION_ID,
  DISCORD_GUILD_ID,
} = process.env;

if (!DISCORD_TOKEN || !DISCORD_APPLICATION_ID) {
  console.error('Servono DISCORD_TOKEN e DISCORD_APPLICATION_ID.');
  process.exit(1);
}

const guildIds = DISCORD_GUILD_ID
  ? DISCORD_GUILD_ID.split(',').map((id) => id.trim()).filter(Boolean)
  : [null];

for (const guildId of guildIds) {
  let url = 'https://discord.com/api/v10/applications/' +
    DISCORD_APPLICATION_ID;

  if (guildId) {
    url += '/guilds/' + guildId + '/commands';
  } else {
    url += '/commands';
  }

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: 'Bot ' + DISCORD_TOKEN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(defs),
  });

  if (!res.ok) {
    console.error(
      'Errore ' + res.status + ' (' + (guildId || 'global') + '):',
      await res.text()
    );
    process.exit(1);
  }

  const registrati = await res.json();

  console.log(
    'Registrati ' + registrati.length + ' comandi ' +
    (guildId ? 'sul server ' + guildId : '(globali)') +
    ': ' + registrati.map((c) => '/' + c.name).join(', ')
  );
}
