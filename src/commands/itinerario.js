import mappa from '../../data/mappa.json' with { type: 'json' };
import { embed, errore, trovaNome, suggerimenti } from '../util.js';

const nodi = [...new Set(mappa.strade.flatMap(([x, y]) => [x, y]))];
const chiaviMezzi = Object.keys(mappa.mezzi);

// Percorso più breve (Dijkstra, grafo piccolo: basta la versione semplice).
function percorsoMinimo(strade, da, a) {
  const adj = {};
  for (const [x, y, d] of strade) {
    (adj[x] ||= []).push([y, d]);
    (adj[y] ||= []).push([x, d]);
  }
  const dist = { [da]: 0 };
  const prec = {};
  const daVisitare = new Set(Object.keys(adj));
  while (daVisitare.size) {
    let u = null;
    for (const n of daVisitare) if (dist[n] !== undefined && (u === null || dist[n] < dist[u])) u = n;
    if (u === null) break;
    daVisitare.delete(u);
    if (u === a) break;
    for (const [v, d] of adj[u]) {
      if (dist[v] === undefined || dist[u] + d < dist[v]) {
        dist[v] = dist[u] + d;
        prec[v] = u;
      }
    }
  }
  if (dist[a] === undefined) return null;
  const percorso = [a];
  while (percorso[0] !== da) percorso.unshift(prec[percorso[0]]);
  return { nodi: percorso, miglia: dist[a] };
}

function durata(ore, oreGiorno) {
  const giorni = Math.floor(ore / oreGiorno);
  const resto = Math.round((ore - giorni * oreGiorno) * 10) / 10;
  const parti = [];
  if (giorni) parti.push(`${giorni} ${giorni === 1 ? 'giorno' : 'giorni'}`);
  if (resto || !giorni) parti.push(`${resto} ${resto === 1 ? 'ora' : 'ore'}`);
  return parti.join(' e ');
}

export default {
  descrizione: 'Calcola il percorso e il tempo di viaggio tra due luoghi',
  opzioni: [
    { name: 'da', description: 'Luogo di partenza', type: 3, required: true, autocomplete: true },
    { name: 'a', description: 'Destinazione', type: 3, required: true, autocomplete: true },
    {
      name: 'mezzo',
      description: 'Mezzo di trasporto (predefinito: a piedi)',
      type: 3,
      required: false,
      choices: chiaviMezzi.map((k) => ({ name: mappa.mezzi[k].nome, value: k })),
    },
  ],

  autocomplete(opzione, valore) {
    return opzione === 'da' || opzione === 'a' ? suggerimenti(nodi, valore) : [];
  },

  run({ da: daRichiesta, a: aRichiesta, mezzo: chiaveMezzo = 'piedi' }) {
    const da = trovaNome(nodi, daRichiesta);
    const a = trovaNome(nodi, aRichiesta);
    if (!da.nome) return errore(`Partenza non trovata: **${daRichiesta}**.\nLuoghi: ${nodi.join(', ')}.`);
    if (!a.nome) return errore(`Destinazione non trovata: **${aRichiesta}**.\nLuoghi: ${nodi.join(', ')}.`);
    if (da.nome === a.nome) return errore('Partenza e destinazione coincidono.');

    const mezzo = mappa.mezzi[chiaveMezzo];
    if (!mezzo) return errore(`Mezzo non valido. Mezzi disponibili: ${chiaviMezzi.join(', ')}.`);

    const p = percorsoMinimo(mappa.strade, da.nome, a.nome);
    if (!p) return errore('Non esiste un percorso tra questi due luoghi.');

    const oreGiorno = mappa.ore_di_viaggio_al_giorno;
    const sconto = mappa.sconto_strade_percento || 0;
    const ore = (p.miglia / (mezzo.miglia_giorno / oreGiorno)) * (1 - sconto / 100);

    const campi = [
      { nome: 'Percorso', valore: p.nodi.join('  →  ') },
      { nome: 'Distanza', valore: `${p.miglia} miglia`, inline: true },
      { nome: 'Mezzo', valore: mezzo.nome, inline: true },
      { nome: 'Tempo di viaggio', valore: durata(ore, oreGiorno), inline: true },
    ];
    if (sconto) campi.push({ nome: 'Bonus strade', valore: `-${sconto}% sul tempo`, inline: true });

    return {
      embeds: [embed({ titolo: `Itinerario: ${da.nome} → ${a.nome}`, campi, footer: `${oreGiorno} ore di marcia al giorno` })],
    };
  },
};
