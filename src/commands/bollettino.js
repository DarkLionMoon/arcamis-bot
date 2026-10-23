// Port dell'alias Draconic !bollettino (meteo giornaliero), con autocompletamento, giorno a scelta,
// menu per cambiare luogo e pulsanti per scorrere i giorni.
// Dati: data/bollettino.json (luogo: [nome, temperatura base, zona meteo]) e data/meteo.json (tabelle meteo per zona).
import meteo from '../../data/meteo.json' with { type: 'json' };
import luoghi from '../../data/bollettino.json' with { type: 'json' };
import { embed, errore, trovaNome, suggerimenti, giornoArcamis } from '../util.js';

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

function dettagliSimulati(nome, temperatura, minima, g, zona) {
  // Valori deterministici: stessa località e stesso giorno = stessi risultati.
  const seed = (g * 7919 + zona * 104729 + 37) >>> 0;
  const valore = (n) => {
    const x = Math.sin(seed * 0.001 + n * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  };

  const pioggia = ['Pioggia', 'Pioggia Forte', 'Tempesta'].includes(nome);
  const tempesta = nome === 'Tempesta';
  const neve = ['Neve', 'Bufera'].includes(nome);
  const nebbia = ['Nebbia Fitta', 'Foschia'].includes(nome);
  const sereno = ['Sole', 'Sereno'].includes(nome);

  const ventoBase = tempesta || nome === 'Bufera' ? 24
    : nome === 'Pioggia Forte' ? 17
      : pioggia || nebbia || neve ? 11 : 6;

  const vento = Math.round(ventoBase + valore(1) * 8);
  const raffica = Math.round(vento * (1.15 + valore(2) * 0.45));
  const direzioni = [
    'Nord', 'Nord Nordest', 'Nordest', 'Est Nordest',
    'Est', 'Est Sudest', 'Sudest', 'Sud Sudest',
    'Sud', 'Sud Sudovest', 'Sudovest', 'Ovest Sudovest',
    'Ovest', 'Ovest Nordovest', 'Nordovest', 'Nord Nordovest',
  ];
  const direzione = direzioni[Math.floor(valore(3) * direzioni.length)];

  const umidita = Math.round(
    nebbia ? 88 + valore(4) * 10
      : pioggia || neve ? 75 + valore(4) * 20
        : 40 + valore(4) * 35,
  );

  const copertura = Math.round(
    sereno ? valore(5) * 20
      : nebbia ? 80 + valore(5) * 20
        : pioggia || neve ? 65 + valore(5) * 35
          : 25 + valore(5) * 50,
  );

  const probabilitaPioggia = neve ? 65 + Math.round(valore(6) * 30)
    : tempesta ? 80 + Math.round(valore(6) * 20)
      : nome === 'Pioggia Forte' ? 70 + Math.round(valore(6) * 25)
        : pioggia ? 45 + Math.round(valore(6) * 35)
          : nebbia ? 10 + Math.round(valore(6) * 25)
            : Math.round(valore(6) * 25);

  const precipitazioni = neve ? 0
    : tempesta ? 2 + valore(7) * 8
      : nome === 'Pioggia Forte' ? 1 + valore(7) * 5
        : pioggia ? valore(7) * 2
          : 0;

  const visibilita = nebbia ? 0.5 + valore(8) * 3
    : tempesta || nome === 'Pioggia Forte' ? 2 + valore(8) * 5
      : 8 + valore(8) * 2;

  const uv = Math.round(
    Math.max(0, Math.min(11, (temperatura + 5) / 4 * (1 - copertura / 120))),
  ) / 1;

  const puntoRugiada = Math.round(
    (temperatura - (100 - umidita) / 5) * 10,
  ) / 10;

  const sensazione = Math.round(
    temperatura - (vento > 15 ? (vento - 15) * 0.12 : 0),
  );

  const mediaUmidita = Math.max(25, Math.min(100, umidita + Math.round((valore(9) - 0.5) * 16)));

  // Orari simulati, con variazioni stagionali leggere.
  const alba = 6 * 60 + 30 + Math.round(valore(10) * 100);
  const tramonto = 17 * 60 + 30 + Math.round(valore(11) * 100);
  const orario = (minuti) =>
    `${String(Math.floor(minuti / 60) % 24).padStart(2, '0')}:${String(minuti % 60).padStart(2, '0')}`;

  const faseIndice = Math.floor((g % 28) / 7);
  const fasiLunari = ['Luna Nuova', 'Primo Quarto', 'Luna Piena', 'Ultimo Quarto'];
  const illuminazione = [2, 50, 97, 50][faseIndice] + Math.round(valore(12) * 3);

  const allerte = [];
  if (tempesta) allerte.push('⛈️ **Temporale simulato:** possibili raffiche intense e precipitazioni');
  if (nome === 'Pioggia Forte') allerte.push('🌧️ **Pioggia intensa:** prudenza negli spostamenti');
  if (raffica >= 25) allerte.push('💨 **Raffiche sostenute:** attenzione nelle zone esposte');
  if (nebbia && visibilita < 3) allerte.push('🌫️ **Visibilità ridotta:** procedere con cautela');
  if (neve) allerte.push('❄️ **Neve simulata:** possibili difficoltà negli spostamenti');
  if (temperatura >= 32) allerte.push('🥵 **Caldo elevato:** idratarsi e limitare gli sforzi');
  if (temperatura <= 0) allerte.push('🥶 **Gelo simulato:** attenzione alle superfici fredde');

  return {
    vento, raffica, direzione, umidita, mediaUmidita, copertura,
    probabilitaPioggia, precipitazioni: precipitazioni.toFixed(1),
    visibilita: visibilita.toFixed(1), uv, puntoRugiada, sensazione,
    temperatura, minima, massima: temperatura + Math.round(valore(13) * 5),
    alba: orario(alba), tramonto: orario(tramonto),
    levataLuna: orario(17 * 60 + Math.round(valore(14) * 180)),
    tramontoLuna: orario(3 * 60 + Math.round(valore(15) * 180)),
    faseLunare: fasiLunari[faseIndice],
    illuminazione: Math.min(100, illuminazione),
    allerte,
  };
}

const nomi = Object.values(luoghi).map((x) => x[0]);
const chiaveDi = (nome) => Object.keys(luoghi).find((k) => luoghi[k][0] === nome);
const elenco = Object.entries(luoghi).sort((a, b) => a[1][0].localeCompare(b[1][0], 'it'));

const modulo = (x, n) => ((x % n) + n) % n; // come l'operatore % di Python, mai negativo (vale anche per i BigInt)
const giornoOggi = (ctx) => giornoArcamis(ctx);
// Il moltiplicatore si scrive come in Python: 1.0 resta "1.0", non "1".
const fmtMod = (m) => (Number.isInteger(m) ? m.toFixed(1) : String(m));

// Giorno dell'anno (0-364) come data: 1 = 1 gennaio, 0 = 31 dicembre. Calendario di 365 giorni, senza anni bisestili.
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const GIORNI_MESE = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
function dataDi(g) {
  if (g === 0) return '31 dicembre';
  let resto = g;
  for (let m = 0; m < 12; m++) {
    if (resto <= GIORNI_MESE[m]) return `${resto} ${MESI[m]}`;
    resto -= GIORNI_MESE[m];
  }
}

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
    `📅 **${dataDi(g)}** · ${stagione} ${stIco}${nota}\n` +
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

function testoSezione(sezione, d) {
  const vento = [
    `**Velocità:** ${d.vento} km/h`,
    `**Direzione:** ${d.direzione}`,
    `**Velocità massima:** ${d.raffica} km/h`,
    `**Raffiche:** ${d.raffica} km/h`,
    `**Windchill:** ${d.sensazione}°C`,
  ].join('\n');

  const atmosfera = [
    `**Umidità:** ${d.umidita}%`,
    `**Umidità media:** ${d.mediaUmidita}%`,
    `**Punto di rugiada:** ${d.puntoRugiada}°C`,
    `**Precipitazioni:** ${d.precipitazioni} mm`,
    `**Copertura nuvolosa:** ${d.copertura}%`,
    `**Visibilità:** ${d.visibilita} km`,
    `**Indice UV:** ${d.uv}`,
    `**Probabilità di pioggia:** ${d.probabilitaPioggia}%`,
  ].join('\n');

  const soleLuna = [
    `**Alba:** ${d.alba}`,
    `**Tramonto:** ${d.tramonto}`,
    `**Levata lunare:** ${d.levataLuna}`,
    `**Tramonto lunare:** ${d.tramontoLuna}`,
    `**Fase lunare:** ${d.faseLunare}`,
    `**Illuminazione:** ${d.illuminazione}%`,
  ].join('\n');

  const allerte = d.allerte.length
    ? d.allerte.join('\n\n')
    : '✅ Nessuna allerta simulata per queste condizioni.';

  const riepilogo = [
    `**Condizioni:** ${d.temperatura}°C`,
    `**Percepita:** ${d.sensazione}°C`,
    `**Massima simulata:** ${d.massima}°C`,
    `**Minima:** ${d.minima}°C`,
    `**Pioggia:** ${d.probabilitaPioggia}%`,
    `**Vento:** ${d.vento} km/h da ${d.direzione}`,
    `**Raffiche:** ${d.raffica} km/h`,
    `**Umidità:** ${d.umidita}%`,
    `**Punto di rugiada:** ${d.puntoRugiada}°C`,
    `**Precipitazioni:** ${d.precipitazioni} mm`,
    `**Nuvole:** ${d.copertura}%`,
    `**Visibilità:** ${d.visibilita} km`,
    `**UV:** ${d.uv}`,
    `**Alba / tramonto:** ${d.alba} / ${d.tramonto}`,
    `**Luna:** ${d.faseLunare} · ${d.illuminazione}%`,
  ].join('\n');

  return ({
    vento: ['💨 Vento', vento],
    atmosfera: ['🌫️ Atmosfera', atmosfera],
    soleluna: ['🌙 Sole / Luna', soleLuna],
    allerte: ['⚠️ Allerte meteo', allerte],
    dettagli: ['🌦️ Tutti i dettagli', riepilogo],
  })[sezione];
}

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
      components: [
        { type: 2, style: 2, label: '💨 Vento', custom_id: `bmd|${chiave}|${g}|vento` },
        { type: 2, style: 2, label: '🌫️ Atmosfera', custom_id: `bmd|${chiave}|${g}|atmosfera` },
        { type: 2, style: 2, label: '🌙 Sole / Luna', custom_id: `bmd|${chiave}|${g}|soleluna` },
      ],
    },
    {
      type: 1,
      components: [
        { type: 2, style: 2, label: '⚠️ Allerte', custom_id: `bmd|${chiave}|${g}|allerte` },
        { type: 2, style: 2, label: '🌦️ Tutti i dettagli', custom_id: `bmd|${chiave}|${g}|dettagli` },
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
      description: "Giorno dell'anno, da 0 a 364 (1 = 1 gennaio; predefinito: oggi)",
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
    
    const parti = String(id).split('|');

    if (parti[0] === 'bmd') {
      const [, chiave, giorno, sezione] = parti;
      const g = Number(giorno);

      if (!luoghi[chiave] || !Number.isInteger(g)) {
        return errore('Località o giorno non riconosciuti.');
      }

      const base = costruisci(chiave, g, ctx);
      const titolo = base.embeds[0].title;
      const descrizione = base.embeds[0].description;

      // Recupera i valori già usati dal riepilogo simulato.
      const temperatura = Number(
        descrizione.match(/\*\*(-?\d+)°C\*\*/)?.[1] ?? 15,
      );
      const minima = Number(
        descrizione.match(/\/ (-?\d+)°C/)?.[1] ?? temperatura - 5,
      );

      const nome = Object.keys(STILE).find(
        (k) => titolo.includes(STILE[k][2]),
      ) ?? 'Sereno';

      const dati = dettagliSimulati(
        nome, temperatura, minima, g, luoghi[chiave][2],
      );

      const [titoloSezione, testo] = testoSezione(sezione, dati) ?? [
        'Meteo', 'Sezione non riconosciuta.',
      ];

      return {
        embeds: [{
          title: `${titoloSezione} — ${luoghi[chiave][0]}`,
          description: testo,
          color: base.embeds[0].color,
          footer: {
            text: `Arcamis 2026 · Dati meteo simulati · ${g}`,
          },
        }],
        components: [
          {
            type: 1,
            components: [{
              type: 2,
              style: 2,
              label: '↩ Riepilogo',
              custom_id: `bmr|${chiave}|${g}`,
            }],
          },
          ...base.components,
        ],
      };
    }

    const [tipo, x, y, z] = String(id).split('|');
    if (tipo === 'bmr') {
  const chiaveRitorno = x;
  const giornoRitorno = Number(y);

  if (!luoghi[chiaveRitorno] || !Number.isInteger(giornoRitorno)) {
    return errore('Località o giorno non riconosciuti.');
  }

  return costruisci(
    chiaveRitorno,
    modulo(giornoRitorno, 365),
    ctx
  );
}
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
