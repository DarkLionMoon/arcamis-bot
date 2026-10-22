// /forfun: modulo guidato per proporre una sessione "For Fun".
// La bozza è un messaggio privato (ephemeral): niente database, ogni clic rilegge i campi dall'embed stesso.
// Campi, suggerimenti e limiti si modificano in data/forfun.json.
import cfg from '../../data/forfun.json' with { type: 'json' };
import { embed, errore } from '../util.js';

const CAMPI = cfg.campi;
const PER_MODULO = 5; // limite di Discord: 5 campi di testo per modulo
const GRUPPI = Math.ceil(CAMPI.length / PER_MODULO);
const VUOTO = '*Non impostato*';
const PREFISSO = '>>> '; // blocco citazione: nel messaggio appare con la barra a sinistra
const API = 'https://discord.com/api/v10';

const intervallo = (g) => [(g - 1) * PER_MODULO + 1, Math.min(g * PER_MODULO, CAMPI.length)];
const sigla = (a, b) => (a === b ? `${a}` : `${a}-${b}`);
const indiceRuolo = (r) => CAMPI.findIndex((c) => c.ruolo === r) + 1;

// Valori già inseriti, riletti dall'embed del messaggio: { numeroCampo: testo }.
function leggi(msg) {
  const valori = {};
  for (const f of msg?.embeds?.[0]?.fields ?? []) {
    const n = Number(/^\[(\d+)\]/.exec(f.name)?.[1]);
    if (n && f.value.startsWith(PREFISSO)) valori[n] = f.value.slice(PREFISSO.length);
  }
  return valori;
}

const mancanti = (valori) => CAMPI.filter((c, k) => c.obbligatorio && !valori[k + 1]);

function bozza(valori, env) {
  const dove = env?.FORFUN_CANALE ? ` in <#${env.FORFUN_CANALE}>` : '';
  const tasti = [];
  for (let g = 1; g <= GRUPPI; g++) {
    const [a, b] = intervallo(g);
    tasti.push({ type: 2, style: 1, label: `Modifica ${sigla(a, b)}`, custom_id: `ff|m|${g}` });
  }
  tasti.push({ type: 2, style: 4, label: 'Annulla', custom_id: 'ff|x' });
  tasti.push({ type: 2, style: 3, label: 'Pubblica', custom_id: 'ff|p', disabled: mancanti(valori).length > 0 });

  return {
    embeds: [
      embed({
        titolo: `${cfg.titolo} — Nuova sessione`,
        descrizione:
          `Compila i campi con i pulsanti qui sotto, poi premi **Pubblica**: il post uscirà${dove} e verrà creato un thread per accordarvi.`,
        colore: cfg.colore,
        campi: CAMPI.map((c, k) => ({
          nome: `[${k + 1}] ${c.nome}${c.obbligatorio ? '' : ' (opzionale)'}`,
          valore: valori[k + 1] ? PREFISSO + valori[k + 1] : `${VUOTO} – ${c.hint}`,
        })),
        footer: 'Arcamis 2026 · Solo tu puoi vedere questa bozza',
      }),
    ],
    components: [{ type: 1, components: tasti }],
    flags: 64,
  };
}

function modale(g, valori) {
  const [a, b] = intervallo(g);
  return {
    custom_id: `ffm|${g}`,
    title: `${cfg.titolo} — campi ${sigla(a, b)}`.slice(0, 45),
    components: CAMPI.slice(a - 1, b).map((c, k) => {
      const n = a + k;
      const campo = {
        type: 4,
        custom_id: `c${n}`,
        label: c.nome.slice(0, 45),
        style: c.lungo ? 2 : 1,
        max_length: Math.min(c.max ?? 1000, 1000),
        required: Boolean(c.obbligatorio),
        placeholder: c.hint.slice(0, 100),
      };
      if (valori[n]) campo.value = valori[n];
      return { type: 1, components: [campo] };
    }),
  };
}

async function pubblica(valori, { i, env }) {
  if (!env?.DISCORD_TOKEN || !env?.FORFUN_CANALE) {
    return errore('Pubblicazione non configurata: mancano `DISCORD_TOKEN` (segreto) o `FORFUN_CANALE` (ID del canale) nel Worker.');
  }
  const m = mancanti(valori);
  if (m.length) return errore(`Mancano campi obbligatori: ${m.map((c) => c.nome).join(', ')}.`);

  const utente = i.member?.user ?? i.user;
  const nome = i.member?.nick ?? utente.global_name ?? utente.username;
  const iT = indiceRuolo('titolo');
  const iD = indiceRuolo('descrizione');
  const campi = CAMPI.map((c, k) => ({ c, n: k + 1 }))
    .filter(({ c, n }) => n !== iT && n !== iD && valori[n])
    .map(({ c, n }) => ({ nome: c.nome, valore: valori[n], inline: !c.lungo }));

  const chiama = (percorso, corpo) =>
    fetch(`${API}${percorso}`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${env.DISCORD_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'DiscordBot (arcamis-bot, 1.0)',
      },
      body: JSON.stringify(corpo),
    });

  const r = await chiama(`/channels/${env.FORFUN_CANALE}/messages`, {
    content: `<@${utente.id}> propone una sessione **${cfg.titolo}**`,
    embeds: [
      embed({
        titolo: valori[iT],
        descrizione: valori[iD],
        colore: cfg.colore,
        campi,
        footer: `Arcamis 2026 · ${cfg.titolo} · proposta da ${nome}`,
      }),
    ],
    allowed_mentions: { parse: [] },
  });
  if (!r.ok) {
    console.error('Pubblicazione fallita:', r.status, await r.text());
    const causa =
      r.status === 401 ? 'il token del bot non è valido'
      : r.status === 403 || r.status === 404 ? "il bot non vede il canale o non ha i permessi (servono: Visualizza canale, Invia messaggi, Incorpora link, Crea thread pubblici)"
      : `Discord ha risposto ${r.status}`;
    return errore(`Non sono riuscito a pubblicare: ${causa}.`);
  }
  const post = await r.json();

  let nota = '';
  const t = await chiama(`/channels/${env.FORFUN_CANALE}/messages/${post.id}/threads`, {
    name: valori[iT].slice(0, 100),
    auto_archive_duration: 10080,
  });
  if (!t.ok) {
    console.error('Thread fallito:', t.status, await t.text());
    nota = '\n⚠️ Post pubblicato, ma non sono riuscito a creare il thread (permesso "Crea thread pubblici").';
  }
  return {
    content: `✅ Sessione pubblicata: https://discord.com/channels/${i.guild_id}/${env.FORFUN_CANALE}/${post.id}${nota}`,
    embeds: [],
    components: [],
  };
}

export default {
  descrizione: 'Proponi una sessione "For Fun" con un modulo guidato',
  opzioni: [],

  run(_opzioni, ctx = {}) {
    return bozza({}, ctx.env);
  },

  // Pulsanti (ff|m|<gruppo>, ff|x, ff|p) e invio dei moduli (ffm|<gruppo>).
  async componente(id, valori = [], ctx = {}) {
    const [tipo, op, g] = String(id).split('|');
    if (tipo === 'ff') {
      if (op === 'x') return { content: 'Bozza annullata.', embeds: [], components: [] };
      const corrente = leggi(ctx.i?.message);
      if (op === 'm') {
        const n = Number(g);
        return n >= 1 && n <= GRUPPI ? { modale: modale(n, corrente) } : null;
      }
      if (op === 'p') return pubblica(corrente, ctx);
      return null;
    }
    if (tipo === 'ffm') {
      if (!ctx.i?.message) return errore('Bozza non trovata: rilancia `/forfun`.');
      const corrente = leggi(ctx.i.message);
      for (const riga of valori) {
        for (const x of riga.components ?? []) {
          const n = Number(/^c(\d+)$/.exec(x.custom_id)?.[1]);
          if (!n || n > CAMPI.length) continue;
          const testo = String(x.value ?? '').trim();
          if (testo) corrente[n] = testo;
          else delete corrente[n];
        }
      }
      return bozza(corrente, ctx.env);
    }
    return null;
  },
};
