import semplici from '../data/comandi.json' with { type: 'json' };
import itinerario from './commands/itinerario.js';
import bollettino from './commands/bollettino.js';
import forfun from './commands/forfun.js';
import oggi from './commands/oggi.js';
import necrologio from './commands/necrologio.js';
import pdi from './commands/pdi.js';
import menu from './commands/menu.js';
import mercante from './commands/mercante.js';
import { embed, errore, norm } from './util.js';

// Comandi con logica: un file in src/commands/, registrato qui.
const gestori = { menu, itinerario, pdi, bollettino, oggi, necrologio, forfun, mercante };

export { promemoria } from './commands/forfun.js';

const NOME_VALIDO = /^[a-z0-9_-]{1,32}$/;

// Tutti i nomi con cui un comando semplice può essere invocato (chiave + alias).
function nomiSemplici() {
  const out = [];
  for (const [chiave, def] of Object.entries(semplici)) {
    out.push([chiave, def]);
    for (const a of def.alias || []) out.push([a, def]);
  }
  return out;
}


function righeAiuto() {
  const righe = [];
  const esclusi = new Set(['locanda', 'regole']);

  for (const [nome, g] of Object.entries(gestori)) {
    if (!esclusi.has(norm(nome))) {
      righe.push(`/${nome}: ${g.descrizione}`);
    }
  }

  for (const [nome, def] of Object.entries(semplici)) {
    if (!esclusi.has(norm(nome))) {
      righe.push(`/${nome}: ${def.descrizione || ''}`);
    }
  }

  return righe;
}


// Definizioni da inviare a Discord (le usa scripts/register.js).
export function definizioni() {
  const defs = [{ name: 'aiuto', description: 'Elenco dei comandi disponibili', type: 1 }];
  for (const [nome, g] of Object.entries(gestori)) {
    defs.push({ name: nome, description: g.descrizione.slice(0, 100), type: 1, options: g.opzioni || [] });
  }
  for (const [nome, def] of nomiSemplici()) {
  if (['locanda', 'regole'].includes(norm(nome))) continue;
  defs.push({ name: nome, description: (def.descrizione || nome).slice(0, 100), type: 1 });
}

  const visti = new Set();
  for (const d of defs) {
    if (!NOME_VALIDO.test(d.name)) {
      throw new Error(`Nome comando non valido: "${d.name}" (solo minuscole, numeri, - e _, massimo 32 caratteri)`);
    }
    if (visti.has(d.name)) throw new Error(`Nome comando duplicato: "${d.name}"`);
    visti.add(d.name);
  }
  return defs;
}

// Trasforma le opzioni di Discord in un oggetto semplice { nome: valore }.
export function leggiOpzioni(opzioni = []) {
  const out = {};
  for (const o of opzioni) out[o.name] = o.value;
  return out;
}

// Esegue un comando e restituisce i dati della risposta (embeds, flags).
export function esegui(nome, opzioni, ctx = {}) {
  const n = norm(nome);
  if (n === 'aiuto') return { embeds: [embed({ titolo: 'Comandi disponibili', descrizione: righeAiuto().join('\n') })] };
  if (gestori[n]) return gestori[n].run(leggiOpzioni(opzioni), ctx);
  const trovato = nomiSemplici().find(([k]) => norm(k) === n);
  if (trovato) return { embeds: [embed(trovato[1].embed || {})] };
  return errore('Comando non riconosciuto. Se è nuovo, esegui di nuovo `npm run register`.');
}

// Clic su menu o pulsanti: ogni comando riconosce i propri id e restituisce null per quelli altrui.
export async function componente(id, valori, ctx = {}) {
  for (const g of Object.values(gestori)) {
    const r = await g.componente?.(id, valori, ctx);
    if (r) return r;
  }
  return null;
}

// Suggerimenti di autocompletamento per l'opzione "in focus".
export function suggerisci(nome, opzioni) {
  const g = gestori[norm(nome)];
  const focus = opzioni.find((o) => o.focused);
  if (!g || !g.autocomplete || !focus) return [];
  return g.autocomplete(focus.name, String(focus.value ?? ''), leggiOpzioni(opzioni));
}
