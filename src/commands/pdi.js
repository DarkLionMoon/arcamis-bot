// Port dell'alias Draconic !pdi (punti di interesse), ora divisi per regione, con autocompletamento, menu e pagine.
// Dati: data/pdi.json. Per aggiungere una regione: nuova voce in "regioni" con "nome" e "pdi" (stessi campi di Arcamis).
// Se una regione ha tanti luoghi, l'elenco si divide da solo in pagine (limiti di Discord: 6000 caratteri per messaggio, 25 voci per menu).
import dati from '../../data/pdi.json' with { type: 'json' };
import itinerario from './itinerario.js';
import { embed, errore, trovaNome, suggerimenti } from '../util.js';

const SEP = '▱'.repeat(20);
const COLORE = '#2ecc71';
const MAX_CAMPO = 1024;
const MAX_TESTO_PAGINA = 5000; // margine sotto i 6000 caratteri dell'embed (titolo, descrizione e piè di pagina esclusi)
const PER_PAGINA = 25;

const ICO_TIPO = dati.icone_tipo;
const ICO_PERICOLO = dati.icone_pericolo;
const regioni = dati.regioni;
const chiaviRegioni = Object.keys(regioni);
const nomiRegioni = chiaviRegioni.map((k) => regioni[k].nome);

// Come str.title() di Python: iniziali maiuscole, resto minuscolo.
const titolo = (s) => s.toLowerCase().replace(/(^|[^\p{L}])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());

const INDICE = `## Indice\n${Object.entries(ICO_PERICOLO).map(([n, i]) => `- ${i} ${n}`).join('\n')}\n${SEP}`;

function riga(k, v) {
  const lord = v.lord && v.lord !== 'Nessuno' ? `\n👑 ${v.lord}` : '';
  return `${ICO_TIPO[v.tipo] ?? '📍'} **${titolo(k)}** ${ICO_PERICOLO[v.pericolo] ?? '⚪'}${lord}\n*${v.desc}*`;
}

// Luoghi di una regione nell'ordine dei gruppi (città, fortezze, ...), poi divisi in pagine per lunghezza.
function pagineDi(chiave) {
  const reg = regioni[chiave];
  const gruppi = dati.gruppi.map((g) => g.titolo);
  const voci = [];
  const usati = new Set();
  dati.gruppi.forEach((g, gi) => {
    for (const [k, v] of Object.entries(reg.pdi)) {
      if (g.tipi.includes(v.gruppo ?? v.tipo)) { // "gruppo" (facoltativo) sposta un luogo in un altro blocco senza cambiarne il tipo
        voci.push({ k, v, gi, testo: riga(k, v) });
        usati.add(k);
      }
    }
  });
  // Tipi non previsti nei gruppi: finiscono in coda, così nessun luogo sparisce.
  const resto = Object.entries(reg.pdi).filter(([k]) => !usati.has(k));
  if (resto.length) {
    gruppi.push('📍 ═══ ALTRI LUOGHI ═══');
    for (const [k, v] of resto) voci.push({ k, v, gi: gruppi.length - 1, testo: riga(k, v) });
  }

  const pagine = [];
  let corrente = [];
  let lunghezza = 0;
  let gruppoPrec = -1;
  for (const voce of voci) {
    const costo = voce.testo.length + 2 + (voce.gi !== gruppoPrec ? gruppi[voce.gi].length + 2 : 0);
    if (corrente.length && (lunghezza + costo > MAX_TESTO_PAGINA || corrente.length >= PER_PAGINA)) {
      pagine.push(corrente);
      corrente = [];
      lunghezza = 0;
      gruppoPrec = -1;
    }
    lunghezza += voce.testo.length + 2 + (voce.gi !== gruppoPrec ? gruppi[voce.gi].length + 2 : 0);
    gruppoPrec = voce.gi;
    corrente.push(voce);
  }
  if (corrente.length) pagine.push(corrente);
  return { pagine, gruppi };
}

// Un campo per gruppo (intestazione + luoghi), diviso in più campi se supera il limite di Discord.
function campiPagina(voci, gruppi) {
  const campi = [];
  let gi = -1;
  let testo = '';
  const chiudi = () => {
    if (testo) campi.push({ nome: '​', valore: testo, inline: false });
    testo = '';
  };
  for (const voce of voci) {
    if (voce.gi !== gi) {
      chiudi();
      gi = voce.gi;
      testo = `${gruppi[gi]}\n\n${voce.testo}`;
    } else if (`${testo}\n\n${voce.testo}`.length > MAX_CAMPO) {
      chiudi();
      testo = voce.testo;
    } else {
      testo += `\n\n${voce.testo}`;
    }
  }
  chiudi();
  return campi;
}

const menuRegioni = (attuale) =>
  chiaviRegioni.length > 1
    ? [
        {
          type: 1,
          components: [
            {
              type: 3,
              custom_id: 'pdr',
              placeholder: 'Cambia regione',
              options: chiaviRegioni.slice(0, 25).map((k) => ({
                label: regioni[k].nome.slice(0, 100),
                value: k,
                description: `${Object.keys(regioni[k].pdi).length} luoghi`,
                default: k === attuale,
              })),
            },
          ],
        },
      ]
    : [];

function menuLuoghi(chiave, pagina, voci, attuale) {
  return {
    type: 1,
    components: [
      {
        type: 3,
        custom_id: `pds|${chiave}|${pagina}`,
        placeholder: 'Apri un luogo',
        options: voci.map(({ k, v }) => ({
          label: titolo(k).slice(0, 100),
          value: k.slice(0, 100),
          description: `${v.tipo} · ${v.pericolo}`.slice(0, 100),
          emoji: { name: ICO_TIPO[v.tipo] ?? '📍' },
          default: k === attuale,
        })),
      },
    ],
  };
}

// Vista di una regione (aspetto dell'alias originale), pagina `pagina` (0-based).
function vistaRegione(chiave, pagina = 0) {
  const reg = regioni[chiave];
  const { pagine, gruppi } = pagineDi(chiave);
  if (pagine.length === 0) {
    return {
      embeds: [embed({ titolo: `📍 ${reg.nome} — Punti di Interesse`, descrizione: 'Nessun punto di interesse registrato... per ora.', colore: COLORE, footer: 'Arcamis 2026' })],
      components: menuRegioni(chiave),
    };
  }
  const p = Math.min(Math.max(pagina, 0), pagine.length - 1);
  const componenti = [...menuRegioni(chiave), menuLuoghi(chiave, p, pagine[p])];
  if (pagine.length > 1) {
    componenti.push({
      type: 1,
      components: [
        { type: 2, style: 2, label: '◀ Pagina', custom_id: `pdp|${chiave}|${p - 1}`, disabled: p === 0 },
        { type: 2, style: 2, label: `${p + 1}/${pagine.length}`, custom_id: 'pdn', disabled: true },
        { type: 2, style: 2, label: 'Pagina ▶', custom_id: `pdp|${chiave}|${p + 1}`, disabled: p === pagine.length - 1 },
      ],
    });
  }
  return {
    embeds: [
      embed({
        titolo: `📍 ${reg.nome} — Punti di Interesse`,
        descrizione: INDICE,
        colore: COLORE,
        campi: campiPagina(pagine[p], gruppi),
        footer: pagine.length > 1 ? `Arcamis 2026 · pagina ${p + 1}/${pagine.length}` : 'Arcamis 2026',
      }),
    ],
    components: componenti,
  };
}

function vistaRegioni() {
  const righe = chiaviRegioni.map((k) => {
    const n = Object.keys(regioni[k].pdi).length;
    return `📍 **${regioni[k].nome}** — ${n ? `${n} luoghi` : '*in arrivo*'}`;
  });
  return {
    embeds: [embed({ titolo: '📍 Punti di Interesse', descrizione: righe.join('\n'), colore: COLORE, footer: 'Arcamis 2026 · Scegli una regione dal menu' })],
    components: menuRegioni(),
  };
}

// Scheda di un singolo luogo.
function dettaglio(chiave, k) {
  const reg = regioni[chiave];
  const v = reg.pdi[k];
  const { pagine } = pagineDi(chiave);
  const pagina = Math.max(0, pagine.findIndex((p) => p.some((x) => x.k === k)));
  const campi = [
    { nome: '🧭 Tipo', valore: v.tipo, inline: true },
    { nome: '⚠️ Pericolo', valore: `${ICO_PERICOLO[v.pericolo] ?? '⚪'} ${v.pericolo}`, inline: true },
  ];
  if (v.lord && v.lord !== 'Nessuno') campi.push({ nome: '👑 Signore', valore: v.lord, inline: true });
  if (v.note) campi.push({ nome: '📝 Note', valore: v.note, inline: false });
  return {
    embeds: [
      embed({
        titolo: `${ICO_TIPO[v.tipo] ?? '📍'} ${titolo(k)}`,
        descrizione: `*${v.desc}*\n${SEP}`,
        colore: dati.colori_pericolo?.[v.pericolo] ?? COLORE,
        campi,
        footer: `Arcamis 2026 · ${reg.nome}`,
      }),
    ],
    components: [
  ...(pagine[pagina] ? [menuLuoghi(chiave, pagina, pagine[pagina], k)] : []),
  {
    type: 1,
    components: [
      {
        type: 2,
        style: 2,
        label: `◀ ${reg.nome}`.slice(0, 80),
        custom_id: `pdl|${chiave}|${pagina}`,
      },
      {
        type: 2,
        style: 1,
        label: '🧭 Itinerario da Arcamis',
        custom_id: `pdiit|${chiave}|${k}`,
      },
    ],
  },
],
  };
}

const chiaveRegione = (testo) => {
  const r = trovaNome(nomiRegioni, testo);
  const nome = r.nome ?? r.ambigui[0];
  return chiaviRegioni.find((k) => regioni[k].nome === nome);
};

const nonTrovato = (testo) => ({
  embeds: [embed({ titolo: '📍 Punti di Interesse', descrizione: `❌ ${testo}`, colore: '#e74c3c' })],
  flags: 64,
});

export default {
  descrizione: 'Punti di interesse di una regione, con pericolo e signori',
  opzioni: [
    { name: 'regione', description: 'Regione (predefinita: la prima)', type: 3, required: false, autocomplete: true },
    { name: 'luogo', description: 'Un luogo da vedere in dettaglio', type: 3, required: false, autocomplete: true },
  ],

  autocomplete(opzione, valore, altre = {}) {
    if (opzione === 'regione') return suggerimenti(nomiRegioni, valore);
    if (opzione !== 'luogo') return [];
    const k = altre.regione ? chiaveRegione(String(altre.regione)) : undefined;
    const fonte = k ? [k] : chiaviRegioni;
    return suggerimenti([...new Set(fonte.flatMap((c) => Object.keys(regioni[c].pdi).map(titolo)))], valore);
  },

  run({ regione, luogo }) {
    const haRegione = regione !== undefined && String(regione).trim() !== '';
    const haLuogo = luogo !== undefined && String(luogo).trim() !== '';
    let chiave;
    if (haRegione) {
      chiave = chiaveRegione(String(regione));
      if (!chiave) return nonTrovato('Regione non trovata.');
    }
    if (haLuogo) {
      const cerca = chiave ? [chiave] : chiaviRegioni;
      const trovati = cerca.flatMap((c) => Object.keys(regioni[c].pdi).map((k) => ({ c, k })));
      const r = trovaNome(trovati.map((x) => x.k), String(luogo));
      const k = r.nome ?? r.ambigui[0];
      const t = trovati.find((x) => x.k === k);
      return t ? dettaglio(t.c, t.k) : nonTrovato('Nessun punto di interesse trovato con questo nome.');
    }
    if (chiave) return vistaRegione(chiave);
    return chiaviRegioni.length === 1 ? vistaRegione(chiaviRegioni[0]) : vistaRegioni();
  },

  // pdr = cambio regione, pds = scelta di un luogo, pdp = cambio pagina, pdl = torna all'elenco della regione.
  componente(id, valori = [], ctx = {}) {
    const [tipo, chiave, n] = String(id).split('|');
    if (tipo === 'pdiit') {
  const luogo = n;

  if (!regioni[chiave]?.pdi[luogo]) {
    return errore('Punto di interesse non trovato: rilancia il comando.');
  }

  return itinerario.run({ da: 'Arcamis', a: luogo }, ctx);
}

if (tipo === 'pdit') {
  const luogo = chiave;
  const regione = chiaviRegioni.find((r) => regioni[r].pdi[luogo]);

  return regione
    ? dettaglio(regione, luogo)
    : errore('Questo luogo non è registrato nei Punti di Interesse.');
}
    if (tipo === 'pdr') return regioni[valori[0]] ? vistaRegione(valori[0]) : errore('Regione non trovata: rilancia il comando.');
    if (!['pds', 'pdp', 'pdl'].includes(tipo)) return null;
    if (!regioni[chiave]) return errore('Regione non trovata: rilancia il comando.');
    if (tipo === 'pds') return regioni[chiave].pdi[valori[0]] ? dettaglio(chiave, valori[0]) : errore('Luogo non trovato: rilancia il comando.');
    return vistaRegione(chiave, Number(n) || 0);
  },
};
