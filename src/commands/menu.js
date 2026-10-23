// /menu — pannello rapido per i comandi principali di Arcamis.
// Dopo aver aggiunto questo file, registrare il comando in src/registry.js (vedi README).
import semplici from '../../data/comandi.json' with { type: 'json' };
import oggi from './oggi.js';
import pdi from './pdi.js';
import bollettino from './bollettino.js';
import necrologio from './necrologio.js';
import forfun from './forfun.js';
import itinerario from './itinerario.js';
import { embed, errore } from '../util.js';

const HOME_ROW = {
  type: 1,
  components: [{ type: 2, style: 2, label: '↩ Menu principale', custom_id: 'menu|home' }],
};

function pannello() {
  return {
    embeds: [
      embed({
        titolo: '🧭 Arcamis — Pannello avventurieri',
        descrizione:
          'Scegli una funzione. Quando apri una sezione, usa **Menu principale** per tornare qui.',
        colore: '#c9a227',
        campi: [
          { nome: '🌍 Esplora', valore: 'Punti di interesse, viaggi e locande.', inline: true },
          { nome: '🌦️ Il mondo oggi', valore: 'Calendario e bollettino meteo.', inline: true },
          { nome: '🎲 Comunità', valore: 'Sessioni For Fun e necrologi.', inline: true },
        ],
        footer: 'Arcamis 2026 · Navigazione rapida',
      }),
    ],
    components: [
      {
        type: 1,
        components: [
          { type: 2, style: 1, label: '🗓️ Oggi', custom_id: 'menu|oggi' },
          { type: 2, style: 1, label: '📍 Punti di interesse', custom_id: 'menu|pdi' },
          { type: 2, style: 1, label: '🧭 Itinerario', custom_id: 'menu|itinerario' },
          { type: 2, style: 1, label: '🌦️ Bollettino', custom_id: 'menu|bollettino' },
          { type: 2, style: 1, label: '⚰️ Necrologi', custom_id: 'menu|necrologio' },
        ],
      },
      {
        type: 1,
        components: [
          { type: 2, style: 2, label: '🎲 For Fun', custom_id: 'menu|forfun' },
          { type: 2, style: 2, label: '❔ Aiuto', custom_id: 'menu|aiuto' },
        ],
      },
    ],
  };
}

function conRitorno(risultato) {
  if (!risultato || typeof risultato !== 'object') {
    return errore('La funzione selezionata non ha restituito una risposta valida.');
  }
  // I pulsanti esistenti vengono conservati; si aggiunge una riga separata per tornare al menu.
  const componenti = [...(risultato.components ?? [])];
  if (!componenti.some((riga) => (riga.components ?? []).some((c) => c.custom_id === 'menu|home'))) {
    componenti.push(HOME_ROW);
  }
  return { ...risultato, components: componenti, flags: 64 };
}

// Finestra di testo: i pulsanti non hanno l'autocompletamento, quindi si scrivono le prime lettere dei luoghi.
function modaleItinerario() {
  const campo = (id, label, placeholder) => ({
    type: 1,
    components: [{ type: 4, custom_id: id, label, style: 1, required: true, max_length: 60, placeholder }],
  });
  return {
    modale: {
      custom_id: 'menu|itm',
      title: '🧭 Pianifica un itinerario',
      components: [
        campo('da', 'Partenza', 'Es. Arcamis'),
        campo('a', 'Destinazione', 'Es. Aurenthar'),
      ],
    },
  };
}

// Legge i valori dei campi di una finestra di testo inviata.
function leggiModale(valori = []) {
  const out = {};
  for (const riga of valori) {
    for (const c of riga.components ?? []) out[c.custom_id] = String(c.value ?? '').trim();
  }
  return out;
}

function guidaAiuto() {
  return {
    embeds: [
      embed({
        titolo: '❔ Comandi di Arcamis',
        descrizione: [
          '`/oggi` — calendario, stagione, luna, meteo e sessioni in arrivo.',
          '`/pdi` — esplora regioni e punti di interesse.',
          '`/itinerario` — tempi, costi e condizioni di viaggio.',
          '`/bollettino` — meteo di una località e di un giorno.',
          '`/necrologio` — registro dei caduti.',
          '`/forfun` — proponi una sessione For Fun.',
        ].join('\n'),
        colore: '#c9a227',
        footer: 'Arcamis 2026',
      }),
    ],
    components: [HOME_ROW],
  };
}

const azioni = {
  oggi: (_valori, ctx) => oggi.run({}, ctx),
  pdi: (_valori, ctx) => pdi.run({}, ctx),
  bollettino: (_valori, ctx) => bollettino.run({}, ctx),
  necrologio: (_valori, ctx) => necrologio.run({}, ctx),
  forfun: (_valori, ctx) => forfun.run({}, ctx),
  aiuto: () => guidaAiuto(),
};

export default {
  descrizione: 'Pannello rapido con pulsanti per i comandi principali',
  opzioni: [],

  run() {
    return pannello();
  },

  async componente(id, valori = [], ctx = {}) {
    const [prefisso, azione] = String(id).split('|');
    if (prefisso !== 'menu') return null;
    if (azione === 'home') return pannello();
    if (azione === 'itinerario') return modaleItinerario();
    if (azione === 'itm') {
      const { da, a } = leggiModale(valori);
      try {
        return conRitorno(itinerario.run({ da, a }, ctx));
      } catch (e) {
        console.error('Errore itinerario dal pannello:', e);
        return errore('Non è stato possibile calcolare il viaggio. Riprova o usa `/itinerario`.');
      }
    }

    const esegui = azioni[azione];
    if (!esegui) return errore('Funzione non riconosciuta. Rilancia `/menu`.');
    try {
      const risultato = await esegui(valori, ctx);
      return conRitorno(risultato);
    } catch (e) {
      console.error('Errore nel pannello /menu:', e);
      return errore('Non è stato possibile aprire questa sezione. Riprova o usa il comando slash corrispondente.');
    }
  },
};
