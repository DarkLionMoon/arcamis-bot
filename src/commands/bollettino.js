// Port dell'alias Draconic !bollettino (meteo giornaliero), con autocompletamento, giorno a scelta,
// menu per cambiare luogo e pulsanti per scorrere i giorni.
// Dati: data/bollettino.json (luogo: [nome, temperatura base, zona meteo]) e data/meteo.json (tabelle meteo per zona).
import meteo from '../../data/meteo.json' with { type: 'json' };
import luoghi from '../../data/bollettino.json' with { type: 'json' };
import { embed, errore, trovaNome, suggerimenti } from '../util.js';

const SEP = '▱'.repeat(20);
const FASI = ['🌑 Luna Nuova', '🌓 Primo Quarto', '🌕 Luna Piena', '🌗 Ultimo Quarto'];
const VENTI_FORTI = ['Tempesta', 'Bufera', 'Pioggia Forte'];
const VENTI_MEDI = ['Pioggia', 'Neve', 'Foschia'];
const STILE = {
  Sole: ['☀️', 'f1c40f', 'Una Mattina Serena'],
  Sereno: ['☀️', 'f1c40f', 'Cielo Terso'],
  Pioggia: ['🌧️', '3498db', 'Un Giorno Grigio'],
  'Pioggia Forte': ['⛈️', '2c3e50', 'Acqua a Dirotto'],
  Tempesta: ['⛈️', '2c3e50', 'Una Tempesta si Abbatte'],
  Neve: ['🌨️', 'ecf0f1', 'Il Silenzio della Neve'],
  Bufera: ['❄️', 'ecf0f1', 'La Bufera Imperversa'],
  'Nebbia Fitta': ['🌫️', '95a5a6', 'Nel Velo della Nebbia'],
  Foschia: ['🌫️', 'bdc3c7', 'Una Foschia Mattutina'],
};

const nomi = Object.values(luoghi).map((x) => x[0]);
const chiaveDi = (nome) => Object.keys(luoghi).find((k) => luoghi[k][0] === nome);
const elenco = Object.entries(luoghi).sort((a, b) => a[1][0].localeCompare(b[1][0], 'it'));

const modulo = (x, n) => ((x % n) + n) % n; // come l'operatore % di Python, mai negativo (vale anche per i BigInt)
const giornoOggi = (ctx) => modulo((ctx.ora ?? Math.floor(Date.now() / 86400000)) - 20453, 365);
// Il moltiplicatore si scrive come in Python: 1.0 resta "1.0", non "1".
const fmtMod = (m) => (Number.isInteger(m) ? m.toFixed(1) : String(m));

// Messaggio del bollettino per il luogo `chiave` (chiave di bollettino.json) nel giorno `g` (0-364).
function costruisci(chiave, g, ctx = {}, nota = '') {
  const [n, base, z] = luoghi[chiave];

  const gSt = (g + 10) % 365;
  let stagione, stOff, stIco;
  if (gSt < 91) [stagione, stOff, stIco] = ['Inverno', -14, '❄️'];
  else if (gSt < 182) [stagione, stOff, stIco] = ['Primavera', -5, '🌸'];
  else if (gSt < 273) [stagione, stOff, stIco] = ['Estate', 6, '☀️'];
  else [stagione, stOff, stIco] = ['Autunno', -3, '🍂'];

  // Generatore deterministico: BigInt perché s * 1103515245 supera 2^53 (con i numeri normali di JS sarebbe sbagliato).
  const s = (BigInt(g) * 1000003n + BigInt(z) * BigInt(meteo.seed_mult ?? 777)) & 0x7fffffffn;
  const p = (s * 1664525n + 1013904223n) & 0x7fffffffn;
  const d = Number(modulo((s * 1103515245n + 12345n) % 100n + (p % 31n) - 15n, 100n));

  const zc = meteo.zone[String(z)] ?? meteo.zone.default;
  let [resNome, resMod] = zc.default;
  for (const [soglia, nome, mod] of zc.stagioni?.[stagione] ?? []) {
    if (d > soglia) {
      [resNome, resMod] = [nome, mod];
      break;
    }
  }

  const tm = Math.trunc(base + stOff + (Number(s % 5n) - 2) + (Number(p % 3n) - 1));
  const tn = tm - Math.trunc(6 + Number(p % 5n));
  const fase = FASI[Math.floor((g % 28) / 7)];

  let vento;
  if (VENTI_FORTI.includes(resNome) || (VENTI_MEDI.includes(resNome) && [2, 3].includes(z))) vento = '💨 Forte';
  else if (VENTI_MEDI.includes(resNome) || [2, 3].includes(z)) vento = '🍃 Moderato';
  else vento = '🌬️ Leggero';

  const [ico, col, titoloMeteo] = STILE[resNome] ?? ['☁️', 'bdc3c7', 'Tempo Incerto'];

  // Barra della temperatura con scala cromatica.
  const tNorm = Math.max(0, Math.min(10, Math.trunc((tm + 20) / 6)));
  const bIco = tm < 0 ? '🟦' : tm < 10 ? '🟨' : tm < 20 ? '🟧' : '🟥';
  const barra = bIco.repeat(tNorm) + '⬜'.repeat(10 - tNorm);

  const descrizione =
    `📅 Giorno **${g}** · ${stagione} ${stIco}${nota}\n` +
    `${SEP}\n` +
    `🌡️ ${barra}  **${tm}°C** / ${tn}°C\n` +
    `${SEP}\n` +
    `🌙 Fase Lunare: ${fase}`;

  return {
    embeds: [
      embed({
        titolo: `${ico} ${titoloMeteo} — ${n}`,
        descrizione,
        colore: `#${col}`,
        campi: [
          { nome: '🚶 Difficoltà Viaggio', valore: `x${fmtMod(resMod)}`, inline: true },
          { nome: '🌬️ Vento', valore: vento, inline: true },
        ],
        footer: `Arcamis 2026 · ${zc.nome ?? ''}`,
      }),
    ],
    components: componenti(chiave, g, ctx),
  };
}

// Menu per cambiare luogo e pulsanti per il giorno. Id: bol|<giorno> (menu), bog|<luogo>|<giorno>|-/0/+ (pulsanti).
// Discord ammette al massimo 25 voci per menu: oltre, servirebbe un menu a pagine (vedi /itinerario).
function componenti(chiave, g, ctx) {
  const tasto = (op, label, disabled = false) => ({
    type: 2, style: 2, label, disabled, custom_id: `bog|${chiave}|${g}|${op}`,
  });
  return [
    {
      type: 1,
      components: [
        {
          type: 3,
          custom_id: `bol|${g}`,
          placeholder: 'Cambia luogo',
          options: elenco.slice(0, 25).map(([k, x]) => ({
            label: x[0],
            value: k,
            description: meteo.zone[String(x[2])]?.nome,
            default: k === chiave,
          })),
        },
      ],
    },
    {
      type: 1,
      components: [tasto('-', '◀ Giorno prima'), tasto('0', 'Oggi', g === giornoOggi(ctx)), tasto('+', 'Giorno dopo ▶')],
    },
  ];
}

export default {
  descrizione: 'Bollettino meteo: tempo, temperature, vento e fase lunare',
  opzioni: [
    { name: 'luogo', description: 'Località (predefinita: Arcamis)', type: 3, required: false, autocomplete: true },
    {
      name: 'giorno',
      description: "Giorno dell'anno, da 0 a 364 (predefinito: oggi)",
      type: 4,
      required: false,
      min_value: 0,
      max_value: 364,
    },
  ],

  autocomplete(opzione, valore) {
    return opzione === 'luogo' ? suggerimenti(nomi, valore) : [];
  },

  // `ctx.ora` (giorni dall'epoca) serve solo ai test, per fissare la data.
  run({ luogo, giorno }, ctx = {}) {
    let chiave = 'arcamis';
    let nota = '';
    if (luogo !== undefined && String(luogo).trim() !== '') {
      const r = trovaNome(nomi, luogo);
      if (r.nome) chiave = chiaveDi(r.nome);
      else nota = '\n*⚠️ Location non riconosciuta, mostro Arcamis*';
    }
    const g = giorno === undefined ? giornoOggi(ctx) : modulo(Number(giorno), 365);
    return costruisci(chiave, g, ctx, nota);
  },

  // Clic su menu o pulsanti: messaggio aggiornato, errore (flags 64) o null se l'id non è di questo comando.
  componente(id, valori = [], ctx = {}) {
    const [tipo, x, y, z] = String(id).split('|');
    let chiave;
    let g;
    if (tipo === 'bol') {
      [chiave, g] = [valori[0], Number(x)];
    } else if (tipo === 'bog') {
      chiave = x;
      g = z === '+' ? Number(y) + 1 : z === '-' ? Number(y) - 1 : giornoOggi(ctx);
    } else {
      return null;
    }
    if (!luoghi[chiave] || !Number.isInteger(g)) return errore('Località non riconosciuta: rilancia il comando.');
    return costruisci(chiave, modulo(g, 365), ctx);
  },
};
