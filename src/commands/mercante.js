// /mercante — catalogo consultabile di oggetti 5e (SRD 5.1/5.2, licenza CC BY 4.0).
// Dati: data/mercante.json, generato da scripts/importa-mercante.js (GitHub Action "Importa catalogo mercante").
// Id dei componenti:  mer|h (categorie)  mer|c (menu categorie)  mer|l|<cat>|<pag>|<testo> (lista)  mer|s|<cat>|<pag>|<testo> (menu oggetti)
import dati from '../../data/mercante.json' with { type: 'json' };
import { embed, errore, norm, trovaNome, suggerimenti } from '../util.js';

const OGG = dati.oggetti ?? [];
const PER_PAGINA = 25;
const COLORE = '#c9a227';

// Solo i DM: chi ha il ruolo indicato in MERCANTE_RUOLO (variabile in wrangler.toml); se non è impostata,
// chi ha i permessi di staff (Amministratore o Gestire i messaggi). Senza `ctx.i` (test) il controllo è saltato.
function autorizzato(ctx = {}, env = {}) {
  const i = ctx.i;
  if (!i) return true;
  const ruolo = env.MERCANTE_RUOLO;
  if (ruolo && !String(ruolo).startsWith('INCOLLA')) return (i.member?.roles ?? []).includes(String(ruolo));
  try {
    const perm = BigInt(i.member?.permissions ?? 0);
    return (perm & 0x8n) !== 0n || (perm & 0x2000n) !== 0n;
  } catch {
    return false;
  }
}

const ETICHETTE = {
  weapon: 'Armi',
  armor: 'Armature',
  'adventuring-gear': 'Equipaggiamento',
  tool: 'Strumenti',
  mount: 'Cavalcature',
  vehicle: 'Veicoli',
  ammunition: 'Munizioni',
  'trade-good': 'Merci',
  'wondrous-item': 'Oggetti meravigliosi',
  potion: 'Pozioni',
  magico: 'Oggetti magici',
  altro: 'Altro',
};
const titolo = (s) => String(s).replace(/-/g, ' ').replace(/^\p{L}/u, (c) => c.toUpperCase());
const etichettaCat = (c) => ETICHETTE[c] ?? titolo(c);

const RARITA = {
  common: ['Comune', '#95a5a6'],
  uncommon: ['Non comune', '#2ecc71'],
  rare: ['Raro', '#3498db'],
  'very-rare': ['Molto raro', '#9b59b6'],
  legendary: ['Leggendario', '#e67e22'],
  artifact: ['Artefatto', '#e74c3c'],
  varies: ['Variabile', '#95a5a6'],
};
const etichettaRar = (r) => (r ? (RARITA[r]?.[0] ?? titolo(r)) : null);

const CATS = [...new Set(OGG.map((o) => o.c))].sort((a, b) =>
  etichettaCat(a).localeCompare(etichettaCat(b), 'it'),
);
const ETICHETTE_CATS = CATS.map(etichettaCat);
const NOMI = OGG.map((o) => o.n);

// Costi in monete d'oro nel file; qui si mostrano nella moneta più comoda (mo, ma, mr).
function costo(k) {
  if (k == null) return '—';
  const f = (x) => String(Math.round(x * 100) / 100).replace('.', ',');
  if (k >= 1 || k === 0) return `${f(k)} mo`;
  if (k >= 0.1) return `${f(k * 10)} ma`;
  return `${f(k * 100)} mr`;
}
const peso = (p) => (p == null ? '—' : `${String(p).replace('.', ',')} lb (${String(Math.round(p * 453.6) / 1000).replace('.', ',')} kg)`);

const catArg = (c) => (c === 'x' || c === undefined ? 'x' : Number.parseInt(c, 10));
const filtra = (cat, q) => {
  const nq = norm(q || '');
  const out = [];
  OGG.forEach((o, i) => {
    if (cat !== 'x' && o.c !== CATS[cat]) return;
    if (nq && !norm(o.n).includes(nq)) return;
    out.push(i);
  });
  return out;
};
const pulisciQ = (q) => String(q ?? '').replace(/\|/g, ' ').slice(0, 50);

function fonte() {
  return `${dati.meta?.licenza ?? 'CC BY 4.0'} · SRD © Wizards of the Coast · via Open5e`;
}

function vistaCategorie() {
  const conteggi = CATS.map((c, i) => `• **${ETICHETTE_CATS[i]}** — ${OGG.filter((o) => o.c === c).length}`);
  return {
    embeds: [
      embed({
        titolo: '🛒 Il Mercante',
        descrizione: `Catalogo consultabile di **${OGG.length}** oggetti.\nScegli una categoria, oppure usa \`/mercante nome:\` per cercare.\n\n${conteggi.join('\n')}`,
        colore: COLORE,
        footer: fonte(),
      }),
    ],
    components: [
      {
        type: 1,
        components: [
          {
            type: 3,
            custom_id: 'mer|c',
            placeholder: 'Scegli una categoria',
            options: [
              { label: 'Tutto il catalogo', value: 'x' },
              ...CATS.slice(0, 24).map((c, i) => ({ label: ETICHETTE_CATS[i].slice(0, 100), value: String(i) })),
            ],
          },
        ],
      },
    ],
  };
}

function vistaLista(catRaw, pagRaw, qRaw) {
  const cat = catArg(catRaw);
  if (cat !== 'x' && !CATS[cat]) return vistaCategorie();
  const q = pulisciQ(qRaw);
  const ids = filtra(cat, q);
  if (ids.length === 0) {
    return errore(`Nessun oggetto trovato${q ? ` per «${q}»` : ''}.`);
  }
  const pagine = Math.ceil(ids.length / PER_PAGINA);
  const pag = Math.min(pagine - 1, Math.max(0, Number.parseInt(pagRaw, 10) || 0));
  const fetta = ids.slice(pag * PER_PAGINA, (pag + 1) * PER_PAGINA);
  const righe = fetta.map((i) => {
    const o = OGG[i];
    return `• **${o.n}** — ${costo(o.k)}${o.r ? ` · ${etichettaRar(o.r)}` : ''}`;
  });
  const base = `${cat}|`;
  const tasto = (label, p, disabled) => ({
    type: 2,
    style: 2,
    label,
    disabled,
    custom_id: `mer|l|${base}${p}|${q}`,
  });
  return {
    embeds: [
      embed({
        titolo: `🛒 Mercante — ${cat === 'x' ? 'Catalogo' : ETICHETTE_CATS[cat]}${q ? ` · «${q}»` : ''}`,
        descrizione: righe.join('\n'),
        colore: COLORE,
        footer: `Pagina ${pag + 1} di ${pagine} · ${ids.length} oggetti · ${fonte()}`,
      }),
    ],
    components: [
      {
        type: 1,
        components: [
          {
            type: 3,
            custom_id: `mer|s|${base}${pag}|${q}`,
            placeholder: 'Apri la scheda di un oggetto',
            options: fetta.map((i) => ({
              label: OGG[i].n.slice(0, 100),
              value: String(i),
              description: `${etichettaCat(OGG[i].c)} · ${costo(OGG[i].k)}`.slice(0, 100),
            })),
          },
        ],
      },
      {
        type: 1,
        components: [
          tasto('◀', pag - 1, pag === 0),
          tasto('▶', pag + 1, pag >= pagine - 1),
          { type: 2, style: 2, label: '🏠 Categorie', custom_id: 'mer|h' },
        ],
      },
    ],
  };
}

function vistaDettaglio(idx, indietro) {
  const o = OGG[idx];
  if (!o) return errore('Oggetto non trovato: rilancia il comando.');
  const campi = [
    { nome: '📦 Categoria', valore: o.t ? `${etichettaCat(o.c)} · ${o.t}` : etichettaCat(o.c), inline: true },
    { nome: '💰 Costo', valore: costo(o.k), inline: true },
    { nome: '⚖️ Peso', valore: peso(o.p), inline: true },
  ];
  if (o.r) campi.push({ nome: '✨ Rarità', valore: etichettaRar(o.r), inline: true });
  if (o.a != null) campi.push({ nome: '🔗 Sintonia', valore: typeof o.a === 'string' ? `Richiesta (${o.a})` : 'Richiesta', inline: true });
  if (o.s) campi.push({ nome: '📊 Statistiche', valore: o.s, inline: false });
  return {
    embeds: [
      embed({
        titolo: `🛒 ${o.n}`,
        descrizione: o.d || '*Nessuna descrizione nello SRD.*',
        colore: RARITA[o.r]?.[1] ?? COLORE,
        campi,
        footer: `${o.f ?? 'SRD'} · ${fonte()}`,
      }),
    ],
    components: [
      {
        type: 1,
        components: [
          { type: 2, style: 2, label: indietro.startsWith('mer|l') ? '◀ Torna alla lista' : '◀ Categorie', custom_id: indietro },
          { type: 2, style: 2, label: '🏠 Categorie', custom_id: 'mer|h' },
        ].slice(0, indietro.startsWith('mer|l') ? 2 : 1),
      },
    ],
  };
}

export default {
  descrizione: 'Catalogo consultabile degli oggetti 5e (SRD)',
  opzioni: [
    { name: 'nome', description: "Nome dell'oggetto (anche parziale)", type: 3, required: false, autocomplete: true },
    { name: 'categoria', description: 'Filtra per categoria (armi, armature, oggetti magici...)', type: 3, required: false, autocomplete: true },
  ],

  autocomplete(opzione, valore, opzioni = {}) {
    if (opzione === 'categoria') return suggerimenti(ETICHETTE_CATS, valore);
    if (opzione !== 'nome') return [];
    const r = opzioni.categoria ? trovaNome(ETICHETTE_CATS, opzioni.categoria) : {};
    const c = r.nome ? ETICHETTE_CATS.indexOf(r.nome) : null;
    const pool = c == null ? NOMI : OGG.filter((o) => o.c === CATS[c]).map((o) => o.n);
    return suggerimenti(pool, valore);
  },

  // Risposta privata (flag 64): le schede non intasano il canale; i clic successivi aggiornano lo stesso messaggio.
  run({ nome, categoria } = {}, ctx = {}) {
    if (!autorizzato(ctx, ctx.env)) return errore('Il Mercante è riservato ai DM.');
    if (OGG.length === 0) {
      return errore('Il catalogo è vuoto: lo staff deve avviare l\'azione "Importa catalogo mercante" su GitHub.');
    }
    let cat = 'x';
    if (categoria && String(categoria).trim()) {
      const r = trovaNome(ETICHETTE_CATS, categoria);
      const nomeCat = r.nome ?? r.ambigui[0];
      if (!nomeCat) return errore(`Categoria non riconosciuta: **${categoria}**. Disponibili: ${ETICHETTE_CATS.join(', ')}.`);
      cat = ETICHETTE_CATS.indexOf(nomeCat);
    }
    let vista;
    if (nome && String(nome).trim()) {
      const ids = filtra(cat, nome);
      const esatto = ids.find((i) => norm(OGG[i].n) === norm(nome));
      if (esatto !== undefined) vista = vistaDettaglio(esatto, 'mer|h');
      else if (ids.length === 1) vista = vistaDettaglio(ids[0], 'mer|h');
      else vista = vistaLista(cat, 0, nome);
    } else if (cat !== 'x') {
      vista = vistaLista(cat, 0, '');
    } else {
      vista = vistaCategorie();
    }
    return { ...vista, flags: vista.flags ?? 64 };
  },

  componente(id, valori = [], ctx = {}) {
    const [pre, op, cat, pag, q] = String(id).split('|');
    if (pre !== 'mer') return null;
    if (!autorizzato(ctx, ctx.env)) return errore('Il Mercante è riservato ai DM.');
    if (op === 'h') return vistaCategorie();
    if (op === 'c') return vistaLista(valori[0], 0, '');
    if (op === 'l') return vistaLista(cat, pag, q);
    if (op === 's') {
      return vistaDettaglio(Number.parseInt(valori[0], 10), `mer|l|${cat}|${pag}|${pulisciQ(q)}`);
    }
    return null;
  },
};
