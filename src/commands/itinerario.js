// Port fedele dell'alias Draconic !itinerario ("Navigatore Arcamis"), con menu a tendina e pulsante "Inverti".
// I dati (ex gvar) sono in data/: luoghi.json, meteo.json, velocita.json, prezzi.json.
import luoghi from '../../data/luoghi.json' with { type: 'json' };
import meteo from '../../data/meteo.json' with { type: 'json' };
import velocita from '../../data/velocita.json' with { type: 'json' };
import prezzi from '../../data/prezzi.json' with { type: 'json' };
import { embed, errore, trovaNome, suggerimenti } from '../util.js';

const CHIAVE_GATEWAY = 'foresta infinita';
const PDI_ESTERNI = ['aurenthar', 'lavenia'];
const BONUS_STRADA = 0.5; // moltiplicatore del tempo su tutte le tratte (0.5 = -50%)
const BONUS_TRENO = BONUS_STRADA; // per escludere il treno dallo sconto: 1.0
// Prezzi di riserva se data/prezzi.json non contiene la voce.
const PREZZI_RISERVA = { cavallo: { tariffa: 0.2, min: 2, posti: 1 }, treno: { tariffa: 0.3, min: 2, posti: 1 } };

const ZONE_DURE = [2, 3, 4];
const METEO_BRUTTO = ['Tempesta', 'Bufera', 'Pioggia Forte'];
const METEO_MEDIO = ['Pioggia', 'Neve', 'Nebbia Fitta', 'Foschia'];
const ICONE = {
  Sole: '☀️', Sereno: '☀️', Pioggia: '🌧️', 'Pioggia Forte': '⛈️', Tempesta: '⛈️',
  Neve: '🌨️', Bufera: '❄️', 'Nebbia Fitta': '🌫️', Foschia: '🌫️',
};

const nomiLuoghi = Object.values(luoghi).map((x) => x[2]);
const luogoPerNome = (nome) => Object.entries(luoghi).find(([, x]) => x[2] === nome);

// --- Meteo deterministico (LCG a doppio seme) ---
// Si usa BigInt perché s * 1103515245 supera 2^53: con i numeri normali di JS il risultato sarebbe sbagliato.
const modulo = (x, n) => ((x % n) + n) % n; // come l'operatore % di Python, mai negativo

function meteoZona(z, giorno, stagione) {
  const zc = meteo.zone[String(z)] ?? meteo.zone.default;
  const s = (BigInt(giorno) * 1000003n + BigInt(z) * BigInt(meteo.seed_mult ?? 777)) & 0x7fffffffn;
  const pp = (s * 1664525n + 1013904223n) & 0x7fffffffn;
  const d = Number(modulo(modulo(s * 1103515245n + 12345n, 100n) + (pp % 31n) - 15n, 100n));
  for (const [soglia, nome, moltiplicatore] of zc.stagioni?.[stagione] ?? []) {
    if (d > soglia) return [nome, moltiplicatore];
  }
  return zc.default;
}

// --- Distanze e tempi ---
function distanza(c1, c2) {
  const dx = c2[0] - c1[0];
  const dy = c2[1] - c1[1];
  return Math.sqrt(Math.floor((dx ** 2 + dy ** 2) / 100)) * 10 * 0.0313;
}

function viaggioMin(dt, sp, mm, ts, bonus) {
  const ve = sp / mm;
  const distGiorno = ve * ts;
  const giorni = Math.trunc(dt / distGiorno);
  const resto = dt - giorni * distGiorno;
  const tt = (giorni * (ts + 8) + (resto > 0.01 ? resto / ve : 0)) * bonus;
  return Math.trunc(tt * 60);
}

function viaggioMinTreno(dt, sp, mm, bonus) {
  return Math.trunc((dt / (sp / mm)) * bonus * 60);
}

// Stessa formula, ma con l'arrotondamento dei minuti dell'alias originale per i percorsi diretti.
function viaggioTesto(d, sp, mm, ts) {
  const ve = sp / mm;
  const distGiorno = ve * ts;
  const giorni = Math.trunc(d / distGiorno);
  const resto = d - giorni * distGiorno;
  const tt = (giorni * (ts + 8) + (resto > 0.01 ? resto / ve : 0)) * BONUS_STRADA;
  const h = Math.trunc(tt);
  const mn = Math.trunc((tt % 1) * 60);
  return (h >= 24 ? `${Math.floor(h / 24)}g ` : '') + `${h % 24}h ${mn}m`;
}

function fmtMin(minuti) {
  const h = Math.floor(minuti / 60);
  const gg = Math.floor(h / 24);
  return (gg > 0 ? `${gg}g ` : '') + `${h % 24}h ${minuti % 60}m`;
}

function costo(mezzo, d) {
  const x = prezzi[mezzo] ?? PREZZI_RISERVA[mezzo];
  return `${Math.max(x.min, Math.floor((d * x.tariffa) / x.posti + 0.5))} mo`;
}

const mi = (d) => `${d.toFixed(1)} mi`; // "12.0 mi" come str(round(d, 1)) di Python

// --- Menu a tendina e pulsante ---
// Gli id dei componenti portano con sé la tratta attuale: itd|<arrivo> (cambia partenza),
// ita|<partenza> (cambia arrivo), iti|<partenza>|<arrivo> (inverti). Massimo 100 caratteri.
// Discord consente al massimo 25 voci per menu: con più di 25 luoghi servirebbe un menu a pagine.
function componenti(k1, k2) {
  const voci = (corrente) =>
    Object.entries(luoghi)
      .slice(0, 25)
      .map(([k, x]) => ({
        label: x[2],
        value: k,
        description: meteo.zone[String(x[3])]?.nome,
        default: k === corrente,
      }));
  return [
    { type: 1, components: [{ type: 3, custom_id: `itd|${k2}`, placeholder: 'Cambia partenza', options: voci(k1) }] },
    { type: 1, components: [{ type: 3, custom_id: `ita|${k1}`, placeholder: 'Cambia destinazione', options: voci(k2) }] },
    { type: 1, components: [{ type: 2, style: 2, custom_id: `iti|${k1}|${k2}`, label: 'Inverti percorso', emoji: { name: '↔️' } }] },
  ];
}

// --- Costruzione del messaggio per la tratta k1 -> k2 (chiavi di luoghi.json) ---
function costruisci(k1, k2, ctx = {}) {
  const c1 = luoghi[k1];
  const c2 = luoghi[k2];

  const ora = ctx.ora ?? Math.floor(Date.now() / 86400000);
  const giorno = modulo(ora - 20453, 365);
  const gSt = (giorno + 10) % 365;
  const stagione = gSt < 91 ? 'Inverno' : gSt < 182 ? 'Primavera' : gSt < 273 ? 'Estate' : 'Autunno';

  const piedi = velocita.piedi ?? 3;
  const cavallo = velocita.cavallo ?? 12;
  const carretto = velocita.carretto ?? 3;
  const carrozza = velocita.carrozza ?? 6;
  const tsTerra = velocita.ts_terra ?? 8;
  const tsCavallo = velocita.ts_cavallo ?? 4;
  const treno = velocita.treno ?? 25;
  const trenoVisibile = Boolean(velocita.treno_visibile);
  const icona = (nome) => ICONE[nome] ?? '🌥️';

  // Un PDI esterno (Aurenthar, Lavenia) si raggiunge sempre passando da Foresta Infinita.
  const esterno = PDI_ESTERNI.includes(k2) || PDI_ESTERNI.includes(k1);
  const k2Esterno = PDI_ESTERNI.includes(k2);
  const chiavePartenza = k2Esterno ? k1 : k2;
  const cPartenza = k2Esterno ? c1 : c2;
  const cEsterno = k2Esterno ? c2 : c1;

  let descrizione = '';
  let colore;
  let luoghiCampi; // partenza, centro, arrivo
  let mezzi; // [nome, tempo, costo|null]

  if (esterno && chiavePartenza !== CHIAVE_GATEWAY) {
    const cGw = luoghi[CHIAVE_GATEWAY];
    const dt1 = distanza(cPartenza, cGw);
    const dt2 = distanza(cGw, cEsterno);
    const r1s = meteoZona(cPartenza[3], giorno, stagione);
    const r1g = meteoZona(cGw[3], giorno, stagione);
    const r2g = meteoZona(cGw[3], giorno, stagione);
    const r2e = meteoZona(0, giorno, stagione);
    const mvm1 = (r1s[1] + r1g[1]) / 2;
    const mvm2 = (r2g[1] + r2e[1]) / 2;
    const b = BONUS_STRADA;

    const pi = viaggioMin(dt1, piedi, mvm1, tsTerra, b) + viaggioMin(dt2, piedi, mvm2, tsTerra, b);
    const ca = viaggioMin(dt1, cavallo, mvm1, tsCavallo, b) + viaggioMin(dt2, cavallo, mvm2, tsCavallo, b);
    const cr = viaggioMin(dt1, carretto, mvm1, tsTerra, b) + viaggioMin(dt2, carretto, mvm2, tsTerra, b);
    const cz = viaggioMin(dt1, carrozza, mvm1, tsTerra, b) + viaggioMin(dt2, carrozza, mvm2, tsTerra, b);
    const tr = trenoVisibile
      ? viaggioMinTreno(dt1, treno, mvm1, BONUS_TRENO) + viaggioMinTreno(dt2, treno, mvm2, BONUS_TRENO)
      : 0;
    const dtTot = dt1 + dt2;

    // I tempi non dipendono dal verso; il meteo e le tappe si mostrano nell'ordine richiesto da chi scrive.
    const invertito = !k2Esterno;
    const [meteoDa, meteoA] = invertito ? [r2e, r1s] : [r1s, r2e];
    const [t1, t2] = invertito ? [dt2, dt1] : [dt1, dt2];
    luoghiCampi = [
      { nome: '📍 Partenza', valore: `**${c1[2]}**\n${icona(meteoDa[0])} ${meteoDa[0]}`, inline: true },
      {
        nome: `🔀 Via ${cGw[2]}`,
        valore: `**${mi(dtTot)}**\n${icona(r1g[0])} ${r1g[0]}\n*${t1.toFixed(1)} + ${mi(t2)}*`,
        inline: true,
      },
      { nome: '🏁 Arrivo', valore: `**${c2[2]}**\n${icona(meteoA[0])} ${meteoA[0]}`, inline: true },
    ];

    const brutto = METEO_BRUTTO.includes(r1s[0]) || METEO_BRUTTO.includes(r2e[0]);
    const dura = ZONE_DURE.includes(cPartenza[3]) || ZONE_DURE.includes(cGw[3]);
    // Nel percorso esterno l'alias originale non considera il meteo "medio" per il colore.
    colore = brutto && dura ? '#e74c3c' : brutto ? '#e67e22' : dura ? '#f39c12' : '#2ecc71';

    mezzi = [
      ['🚶 A Piedi', fmtMin(pi), null],
      ['🛒 Carretto', fmtMin(cr), costo('carretto', dtTot)],
      ['🏇 Carrozza', fmtMin(cz), costo('carrozza', dtTot)],
      ['🐎 Cavallo', fmtMin(ca), costo('cavallo', dtTot)],
    ];
    if (trenoVisibile) mezzi.push(['🚂 Treno', fmtMin(tr), costo('treno', dtTot)]);
  } else {
    // Percorso diretto.
    const dt = distanza(c1, c2);
    const r1 = meteoZona(c1[3], giorno, stagione);
    const r2 = meteoZona(c2[3], giorno, stagione);
    const mvm = (r1[1] + r2[1]) / 2;

    const brutto = METEO_BRUTTO.includes(r1[0]) || METEO_BRUTTO.includes(r2[0]);
    const medio = METEO_MEDIO.includes(r1[0]) || METEO_MEDIO.includes(r2[0]);
    const dura = ZONE_DURE.includes(c1[3]) || ZONE_DURE.includes(c2[3]);

    const distTxt =
      dt < 5 ? 'Un breve cammino vi separa dalla meta.'
      : dt < 15 ? 'Il viaggio richiederà qualche ora di cammino.'
      : 'Una lunga strada si distende davanti a voi.';

    let meteoTxt;
    if (brutto && dura) meteoTxt = 'Le condizioni sono ostili — preparatevi al peggio.';
    else if (brutto) meteoTxt = 'Il tempo si fa minaccioso lungo il percorso.';
    else if (medio && dura) meteoTxt = 'Il terreno e il cielo non promettono nulla di buono.';
    else if (medio) meteoTxt = 'Qualche nuvola accompagnerà il vostro viaggio.';
    else if (dura) meteoTxt = 'Il percorso è impervio, ma il cielo è dalla vostra parte.';
    else meteoTxt = 'Il tempo è favorevole. Buon viaggio.';

    descrizione = `*${distTxt}*\n*${meteoTxt}*`;
    colore =
      brutto && dura ? '#e74c3c'
      : brutto || (medio && dura) ? '#e67e22'
      : medio || dura ? '#f39c12'
      : '#2ecc71';

    luoghiCampi = [
      { nome: '📍 Partenza', valore: `**${c1[2]}**\n${icona(r1[0])} ${r1[0]}`, inline: true },
      { nome: '📏 Distanza', valore: `**${mi(dt)}**`, inline: true },
      { nome: '🏁 Arrivo', valore: `**${c2[2]}**\n${icona(r2[0])} ${r2[0]}`, inline: true },
    ];

    mezzi = [
      ['🚶 A Piedi', viaggioTesto(dt, piedi, mvm, tsTerra), null],
      ['🛒 Carretto', viaggioTesto(dt, carretto, mvm, tsTerra), costo('carretto', dt)],
      ['🏇 Carrozza', viaggioTesto(dt, carrozza, mvm, tsTerra), costo('carrozza', dt)],
      ['🐎 Cavallo', viaggioTesto(dt, cavallo, mvm, tsCavallo), costo('cavallo', dt)],
    ];
    if (trenoVisibile) mezzi.push(['🚂 Treno', fmtMin(viaggioMinTreno(dt, treno, mvm, BONUS_TRENO)), costo('treno', dt)]);
  }

  const campi = [
    ...luoghiCampi,
    ...mezzi.map(([nome, tempo, prezzo]) => ({
      nome,
      valore: `**${tempo}**` + (prezzo ? `\n💰 ${prezzo} a persona` : ''),
      inline: true,
    })),
  ];

  return {
    embeds: [
      embed({
        titolo: `🧭 ${c1[2]} ➔ ${c2[2]}`,
        descrizione,
        colore,
        campi,
        footer: `Arcamis 2026 · ${stagione} · Usa i menu per cambiare tratta`,
      }),
    ],
    components: componenti(k1, k2),
  };
}

export default {
  descrizione: 'Navigatore: tempi, costi e meteo del viaggio tra due località',
  opzioni: [
    { name: 'da', description: 'Località di partenza', type: 3, required: true, autocomplete: true },
    { name: 'a', description: 'Destinazione', type: 3, required: true, autocomplete: true },
  ],

  autocomplete(opzione, valore) {
    return opzione === 'da' || opzione === 'a' ? suggerimenti(nomiLuoghi, valore) : [];
  },

  // `ctx.ora` (giorni dall'epoca) serve solo ai test, per fissare la data.
  run({ da, a }, ctx = {}) {
    const rDa = trovaNome(nomiLuoghi, da);
    const rA = trovaNome(nomiLuoghi, a);
    if (!rDa.nome || !rA.nome) {
      const quale = !rDa.nome ? da : a;
      return errore(`Località non riconosciuta: **${quale}**. Scrivi le prime lettere e scegli dall'elenco proposto.`);
    }
    if (rDa.nome === rA.nome) return errore('Partenza e destinazione coincidono.');
    return costruisci(luogoPerNome(rDa.nome)[0], luogoPerNome(rA.nome)[0], ctx);
  },

  // Clic su un menu o sul pulsante: restituisce il messaggio aggiornato, un errore (flags 64) o null se l'id è sconosciuto.
  componente(id, valori = [], ctx = {}) {
    const [tipo, x, y] = String(id).split('|');
    let k1;
    let k2;
    if (tipo === 'itd') [k1, k2] = [valori[0], x];
    else if (tipo === 'ita') [k1, k2] = [x, valori[0]];
    else if (tipo === 'iti') [k1, k2] = [y, x];
    else return null;
    if (!luoghi[k1] || !luoghi[k2]) return errore('Località non riconosciuta: rilancia il comando.');
    if (k1 === k2) return errore('Partenza e destinazione coincidono.');
    return costruisci(k1, k2, ctx);
  },
};
