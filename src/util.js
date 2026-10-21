// Funzioni di utilità condivise dai comandi.

// Minuscolo e senza accenti, per confronti tolleranti ("Forte Vigilus" == "forte vigilus").
export function norm(s) {
  return String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

// Prima corrispondenza esatta, poi "inizia con", poi "contiene".
// `nome` è undefined se non c'è nulla o se la ricerca è ambigua (vedi `ambigui`).
export function trovaNome(lista, query) {
  const q = norm(query);
  const esatto = lista.find((n) => norm(n) === q);
  if (esatto) return { nome: esatto, ambigui: [] };
  let cand = lista.filter((n) => norm(n).startsWith(q));
  if (cand.length === 0) cand = lista.filter((n) => norm(n).includes(q));
  if (cand.length === 1) return { nome: cand[0], ambigui: [] };
  return { nome: undefined, ambigui: cand };
}

// Suggerimenti per l'autocompletamento di Discord (massimo 25, nome ≤ 100 caratteri).
export function suggerimenti(lista, query) {
  const q = norm(query || '');
  return lista
    .filter((n) => norm(n).includes(q))
    .slice(0, 25)
    .map((n) => ({ name: n.slice(0, 100), value: n.slice(0, 100) }));
}

export function colore(hex, predefinito = '#c9a227') {
  const h = String(hex || predefinito).replace('#', '');
  const n = parseInt(h, 16);
  return Number.isNaN(n) ? parseInt(predefinito.replace('#', ''), 16) : n;
}

// Embed come oggetto semplice, con i limiti di Discord applicati.
export function embed({ titolo, descrizione, colore: c, campi, footer, immagine, miniatura } = {}) {
  const e = { color: colore(c) };
  if (titolo) e.title = String(titolo).slice(0, 256);
  if (descrizione) e.description = String(descrizione).slice(0, 4096);
  if (campi && campi.length) {
    e.fields = campi.slice(0, 25).map((f) => ({
      name: String(f.nome).slice(0, 256) || '​',
      value: String(f.valore).slice(0, 1024) || '​',
      inline: Boolean(f.inline),
    }));
  }
  if (footer) e.footer = { text: String(footer).slice(0, 2048) };
  if (immagine) e.image = { url: immagine };
  if (miniatura) e.thumbnail = { url: miniatura };
  return e;
}

// Gli errori sono "ephemeral" (flag 64): li vede solo chi ha scritto il comando.
export function errore(messaggio) {
  return {
    embeds: [embed({ titolo: 'Errore', descrizione: messaggio, colore: '#b3261e' })],
    flags: 64,
  };
}
