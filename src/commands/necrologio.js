// Port dell'alias Draconic !necrologio (registro dei caduti), con autocompletamento e menu per passare da uno all'altro.
// Dati: data/necrologi.json (nome → causa, data_morte, epitaffio, citazione, immagine). Si aggiorna con un commit.
import necrologi from '../../data/necrologi.json' with { type: 'json' };
import { embed, errore, trovaNome, suggerimenti } from '../util.js';

const COLORE = '#7f8c8d';
const SEP = '▱'.repeat(20);
const chiavi = Object.keys(necrologi);

// Come str.title() di Python: iniziali maiuscole, resto minuscolo ("d'artagnan" → "D'Artagnan").
const titolo = (s) => s.toLowerCase().replace(/(^|[^\p{L}])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());
const nomiBelli = chiavi.map(titolo);
const chiaveDi = (testo) => chiavi.find((k) => k.toLowerCase() === testo.toLowerCase());

// Menu per aprire un necrologio (massimo 25 voci: oltre, restano gli ultimi 25 del file; l'autocompletamento li trova tutti).
function menu(attuale) {
  return {
    type: 1,
    components: [
      {
        type: 3,
        custom_id: 'nec|s',
        placeholder: 'Apri un necrologio',
        options: chiavi.slice(-25).map((k) => ({
          label: titolo(k).slice(0, 100),
          value: k.slice(0, 100),
          description: necrologi[k].data_morte?.slice(0, 100),
          default: k === attuale,
        })),
      },
    ],
  };
}

function elenco() {
  if (chiavi.length === 0) {
    return { embeds: [embed({ titolo: '⚰️ Necrologi di Arcamis', descrizione: 'Nessun caduto registrato... per ora.', colore: COLORE })] };
  }
  const righe = chiavi.map((k) => `💀 **${titolo(k)}** — ${necrologi[k].data_morte || '???'}`);
  return {
    embeds: [
      embed({
        titolo: '⚰️ Necrologi di Arcamis',
        descrizione: righe.join('\n'),
        colore: COLORE,
        footer: `Usa /necrologio [nome] o il menu per i dettagli · ${chiavi.length} anime perdute`,
      }),
    ],
    components: [menu()],
  };
}

function dettaglio(k) {
  const d = necrologi[k];
  let desc = d.epitaffio ? `*${d.epitaffio}*` : '';
  if (d.citazione) desc += `${desc ? '\n\n' : ''}*${d.citazione}*`;
  desc += `${desc ? '\n\n' : ''}${SEP}`;
  return {
    embeds: [
      embed({
        titolo: `⚰️ Necrologio — ${titolo(k)}`,
        descrizione: desc,
        colore: COLORE,
        campi: [
          { nome: '☠️ Causa', valore: d.causa || 'Sconosciuta', inline: true },
          { nome: '📅 Data della morte', valore: d.data_morte || 'Sconosciuta', inline: true },
        ],
        immagine: d.immagine || undefined,
        footer: 'Arcamis · Riposi in pace',
      }),
    ],
    components: [menu(k), { type: 1, components: [{ type: 2, style: 2, label: '◀ Elenco', custom_id: 'nec|l' }] }],
  };
}

export default {
  descrizione: 'Il registro dei caduti di Arcamis',
  opzioni: [{ name: 'nome', description: 'Nome del caduto (vuoto: elenco completo)', type: 3, required: false, autocomplete: true }],

  autocomplete(opzione, valore) {
    return opzione === 'nome' ? suggerimenti(nomiBelli, valore) : [];
  },

  run({ nome }) {
    if (nome === undefined || String(nome).trim() === '') return elenco();
    // Come l'originale, se più nomi corrispondono vale il primo; prima però si preferiscono nome esatto e inizio nome.
    const r = trovaNome(chiavi, nome);
    const k = r.nome ?? r.ambigui[0];
    if (!k) {
      // Stesso aspetto dell'originale, ma visibile solo a chi ha scritto il comando.
      return {
        embeds: [embed({ titolo: '⚰️ Necrologi di Arcamis', descrizione: '❌ Nessun caduto trovato con questo nome.', colore: '#e74c3c' })],
        flags: 64,
      };
    }
    return dettaglio(k);
  },

  // Menu (nec|s) e pulsante "Elenco" (nec|l).
  componente(id, valori = []) {
    if (id === 'nec|l') return elenco();
    if (id !== 'nec|s') return null;
    const k = chiaveDi(String(valori[0] ?? ''));
    return k ? dettaglio(k) : errore('Caduto non trovato: rilancia il comando.');
  },
};
