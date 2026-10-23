// /menu — pannello rapido per i comandi principali di Arcamis.
// Dopo aver aggiunto questo file, registrare il comando in src/registry.js (vedi README).
import semplici from '../../data/comandi.json' with { type: 'json' };
import oggi from './oggi.js';
import pdi from './pdi.js';
import bollettino from './bollettino.js';
import necrologio from './necrologio.js';
import forfun from './forfun.js';
import locanda from './locanda.js';
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
          { type: 2, style: 2, label: '🏨 Locanda', custom_id: 'menu|locanda' },
          { type: 2, style: 2, label: '📜 Regole', custom_id: 'menu|regole' },
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
  return { ...risultato, components: componenti };
}

function guidaItinerario() {
  return {
    embeds: [
      embed({
        titolo: '🧭 Pianifica un itinerario',
        descrizione:
          'Per calcolare distanza, tempi, costi e condizioni del viaggio, usa il comando **`/itinerario`** e seleziona sia la località di partenza sia la destinazione dai suggerimenti di Discord.',
        colore: '#c9a227',
        footer: 'Arcamis 2026 · Le due località sono obbligatorie',
      }),
    ],
    components: [HOME_ROW],
  };
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
          '`/locanda` — consulta le locande.',
          '`/regole` — leggi le regole del server.',
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
  locanda: () => locanda.run({}),
  itinerario: () => guidaItinerario(),
  regole: () => ({ embeds: [embed(semplici.regole?.embed ?? {
    titolo: 'Regolamento di Arcamis',
    descrizione: 'Il regolamento non è configurato.',
  })], components: [HOME_ROW] }),
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
