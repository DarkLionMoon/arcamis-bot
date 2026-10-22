// /forfun: proponi una sessione "For Fun" (bozza → post con iscrizioni), gestiscila e ricevi il promemoria.
// Nessun database: la bozza, gli iscritti e lo stato (iscrizioni chiuse, promemoria inviato) vivono nei messaggi stessi.
// Campi, suggerimenti e limiti si modificano in data/forfun.json.
import cfg from '../../data/forfun.json' with { type: 'json' };
import { embed, errore } from '../util.js';

const CAMPI = cfg.campi;
const PER_MODULO = 5; // limite di Discord: 5 campi di testo per modulo
const GRUPPI = Math.ceil(CAMPI.length / PER_MODULO);
const VUOTO = '*Non impostato*';
const PREFISSO = '>>> '; // blocco citazione: nel messaggio appare con la barra a sinistra
const API = 'https://discord.com/api/v10';
const FUSO = cfg.fuso ?? 'Europe/Rome';
const ANTICIPO = (cfg.promemoria_minuti ?? 60) * 60000;
const CHIUSA = '🔒 Iscrizioni chiuse';
const PROMEMORIA = '🔔 Promemoria inviato';
const INIZIATA = '▶️ Iniziata';

const intervallo = (g) => [(g - 1) * PER_MODULO + 1, Math.min(g * PER_MODULO, CAMPI.length)];
const sigla = (a, b) => (a === b ? `${a}` : `${a}-${b}`);
const indiceRuolo = (r) => CAMPI.findIndex((c) => c.ruolo === r) + 1;
const maxDaPosti = (testo) => Number(/\d+/.exec(testo ?? '')?.[0] ?? 0);
const raw = (f) => ({ name: f.nome, value: f.valore, inline: Boolean(f.inline) });

// ---------- Date (fuso orario del server, ora legale compresa) ----------
const OPZ_DATA = { timeZone: FUSO, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' };
const parti = (ms) =>
  Object.fromEntries(new Intl.DateTimeFormat('en-US', OPZ_DATA).formatToParts(new Date(ms)).map((x) => [x.type, Number(x.value)]));
function scostamento(ms) {
  const p = parti(ms);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000;
}

// "25/10/2026 21:00" (anno facoltativo) → secondi Unix, oppure null se non valida.
export function leggiData(testo, adesso = Date.now()) {
  const m = /^\s*(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?[\s,]+(?:ore\s*)?(\d{1,2})[:.](\d{2})\s*$/i.exec(String(testo ?? ''));
  if (!m) return null;
  const [g, me, h, mi] = [m[1], m[2], m[4], m[5]].map(Number);
  const calcola = (anno) => {
    const muro = Date.UTC(anno, me - 1, g, h, mi);
    const d = new Date(muro);
    if (d.getUTCMonth() !== me - 1 || d.getUTCDate() !== g || h > 23 || mi > 59) return null;
    let u = muro - scostamento(muro);
    u = muro - scostamento(u);
    return u;
  };
  let u;
  if (m[3]) {
    const a = Number(m[3]);
    u = calcola(a < 100 ? 2000 + a : a);
  } else {
    const anno = parti(adesso).year;
    u = calcola(anno);
    if (u !== null && u <= adesso) u = calcola(anno + 1);
  }
  return u === null ? null : Math.floor(u / 1000);
}

export function formattaData(sec) {
  const p = parti(sec * 1000);
  const z = (n) => String(n).padStart(2, '0');
  return `${z(p.day)}/${z(p.month)}/${p.year} ${z(p.hour)}:${z(p.minute)}`;
}

// ---------- Bozza ----------
// Valori già inseriti, riletti dall'embed del messaggio: { numeroCampo: testo }.
function leggi(msg) {
  const valori = {};
  for (const f of msg?.embeds?.[0]?.fields ?? []) {
    const n = Number(/^\[(\d+)\]/.exec(f.name)?.[1]);
    if (n && f.value.startsWith(PREFISSO)) valori[n] = f.value.slice(PREFISSO.length);
  }
  return valori;
}

const mancanti = (valori) => CAMPI.filter((c, k) => c.obbligatorio && !valori[k + 1]);
const postDiBozza = (msg) => /Modifica post (\d+)/.exec(msg?.embeds?.[0]?.footer?.text ?? '')?.[1] ?? '';

function bozza(valori, env, { avviso = '', post = '' } = {}) {
  const dove = env?.FORFUN_CANALE ? ` in <#${env.FORFUN_CANALE}>` : '';
  const tasti = [];
  for (let g = 1; g <= GRUPPI; g++) {
    const [a, b] = intervallo(g);
    tasti.push({ type: 2, style: 1, label: `Modifica ${sigla(a, b)}`, custom_id: `ff|m|${g}` });
  }
  tasti.push({ type: 2, style: 4, label: 'Annulla', custom_id: 'ff|x' });
  tasti.push({
    type: 2, style: 3, label: post ? 'Salva' : 'Pubblica', custom_id: post ? 'ff|s' : 'ff|p', disabled: mancanti(valori).length > 0,
  });

  const intro = post
    ? 'Cambia i campi con i pulsanti, poi premi **Salva**: il post si aggiorna e gli iscritti restano al loro posto.'
    : `Compila i campi con i pulsanti qui sotto, poi premi **Pubblica**: il post uscirà${dove} e verrà creato un thread per accordarvi.`;
  return {
    embeds: [
      embed({
        titolo: `${cfg.titolo} — ${post ? 'Modifica sessione' : 'Nuova sessione'}`,
        descrizione: intro + (avviso ? `\n\n⚠️ ${avviso}` : ''),
        colore: cfg.colore,
        campi: CAMPI.map((c, k) => ({
          nome: `[${k + 1}] ${c.nome}${c.obbligatorio ? '' : ' (opzionale)'}`,
          valore: valori[k + 1] ? PREFISSO + valori[k + 1] : `${VUOTO} – ${c.hint}`,
        })),
        footer: `Arcamis 2026 · ${post ? `Modifica post ${post} · ` : ''}Solo tu puoi vedere questa bozza`,
      }),
    ],
    components: [{ type: 1, components: tasti }],
  };
}

function modale(g, valori) {
  const [a, b] = intervallo(g);
  return {
    custom_id: `ffm|${g}`,
    title: `${cfg.titolo} — campi ${sigla(a, b)}`.slice(0, 45),
    components: CAMPI.slice(a - 1, b).map((c, k) => {
      const n = a + k;
      const campo = {
        type: 4,
        custom_id: `c${n}`,
        label: c.nome.slice(0, 45),
        style: c.lungo ? 2 : 1,
        max_length: Math.min(c.max ?? 1000, 1000),
        required: Boolean(c.obbligatorio),
        placeholder: c.hint.slice(0, 100),
      };
      if (valori[n]) campo.value = valori[n];
      return { type: 1, components: [campo] };
    }),
  };
}

// ---------- Post pubblicato: iscrizioni ----------
// L'elenco vive nei campi finali del post (menzioni). Il numero di posti è nell'id del pulsante: ffr|p|<posti> (0 = illimitati).
const ID_UTENTE = /<@(\d+)>/g;
const idsDi = (f) => (f ? [...f.value.matchAll(ID_UTENTE)].map((m) => m[1]) : []);
const elenco = (l) => (l.length ? l.slice(0, 40).map((u) => `<@${u}>`).join('\n') : '—');
const campiIscritti = (presenti, riserve, assenti, max) => [
  { nome: `✅ Presenti (${presenti.length}${max ? `/${max}` : ''})`, valore: elenco(presenti) },
  ...(riserve.length ? [{ nome: `🕐 Riserve (${riserve.length})`, valore: elenco(riserve) }] : []),
  { nome: `❔ Tentativi (${assenti.length})`, valore: elenco(assenti) },
];
// A posti pieni "Ci sono" diventa "Mettiti in riserva"; a iscrizioni chiuse i due pulsanti si spengono.
const tastiIscrizione = (max, piena = false, chiusa = false) => [
  {
    type: 1,
    components: [
      { type: 2, style: piena ? 1 : 3, label: piena ? 'Mettiti in riserva' : 'Ci sono', custom_id: `ffr|p|${max}`, disabled: chiusa },
      { type: 2, style: 2, label: 'Tentativo', emoji: { name: '❔' }, custom_id: `ffr|a|${max}`, disabled: chiusa },
      { type: 2, style: 2, label: '⚙️ Gestisci', custom_id: 'ffg|g' },
    ],
  },
];

const proponente = (m) => /^<@(\d+)>/.exec(m?.content ?? '')?.[1];
const maxDi = (m) => Number(m?.components?.[0]?.components?.find((c) => c.custom_id?.startsWith('ffr|p|'))?.custom_id.split('|')[2]) || 0;
const chiusaDi = (m) => (m?.embeds?.[0]?.footer?.text ?? '').includes(CHIUSA);
const annullata = (m) => (m?.embeds?.[0]?.title ?? '').startsWith('❌');
const conMarcatore = (testo, marcatore, attivo) => {
  const base = testo.replace(` · ${marcatore}`, '');
  return attivo ? `${base} · ${marcatore}` : base;
};

function iscritti(e) {
  const campi = e?.fields ?? [];
  const fp = campi.find((f) => f.name.startsWith('✅ Presenti'));
  const fr = campi.find((f) => f.name.startsWith('🕐 Riserve'));
  const fa = campi.find((f) => f.name.startsWith('❔ Tentativi') || f.name.startsWith('❌ Assenti')); // il secondo: post vecchi
  return {
    fp, fa,
    altri: campi.filter((f) => f !== fp && f !== fr && f !== fa),
    presenti: idsDi(fp), riserve: idsDi(fr), assenti: idsDi(fa),
  };
}

// Embed del post con modifiche; il resto resta com'è.
const pulisci = (e, extra = {}) => {
  const n = { title: e.title, description: e.description, color: e.color, fields: e.fields ?? [] };
  if (e.footer?.text) n.footer = { text: e.footer.text };
  return { ...n, ...extra };
};

// Dopo un cambio di posti o di iscritti: eccedenti in riserva, riserve in testa promosse. Restituisce i promossi.
function riequilibra(presenti, riserve, max) {
  const saliti = [];
  if (max) {
    while (presenti.length > max) riserve.unshift(presenti.pop());
    while (presenti.length < max && riserve.length) {
      const u = riserve.shift();
      presenti.push(u);
      saliti.push(u);
    }
  }
  return saliti;
}

const api = (env, metodo, percorso, corpo) =>
  fetch(`${API}${percorso}`, {
    method: metodo,
    headers: { Authorization: `Bot ${env.DISCORD_TOKEN}`, 'Content-Type': 'application/json', 'User-Agent': 'DiscordBot (arcamis-bot, 1.0)' },
    ...(corpo ? { body: JSON.stringify(corpo) } : {}),
  });

// Il thread creato dal post ha lo stesso id del post. Scrive senza bloccare il resto; ping solo agli `utenti` indicati.
async function scriviNelThread(env, postId, contenuto, utenti) {
  if (!utenti.length || !env?.DISCORD_TOKEN) return;
  try {
    await api(env, 'POST', `/channels/${postId}/messages`, { content: contenuto, allowed_mentions: { users: utenti } });
  } catch (err) {
    console.error('Messaggio nel thread fallito:', err);
  }
}
const avvisoPromossi = (env, postId, saliti) =>
  scriviNelThread(env, postId, `${saliti.map((u) => `<@${u}>`).join(' ')} si è liberato un posto: sei tra i **presenti** ✅`, saliti);

async function rispondi(op, max, { i, env }) {
  const msg = i?.message;
  const e = msg?.embeds?.[0];
  const s = iscritti(e);
  if (!s.fp || !s.fa) return null;
  if (chiusaDi(msg)) return errore('Le iscrizioni di questa sessione sono chiuse.');
  const utente = (i.member?.user ?? i.user).id;
  let { presenti, riserve, assenti } = s;
  const eraAssente = assenti.includes(utente);
  const eraIscritto = presenti.includes(utente) || riserve.includes(utente);
  // Ogni pulsante è un interruttore: un secondo clic toglie la risposta data.
  presenti = presenti.filter((u) => u !== utente);
  riserve = riserve.filter((u) => u !== utente);
  assenti = assenti.filter((u) => u !== utente);
  if (op === 'p' && !eraIscritto) {
    if (max && presenti.length >= max) riserve.push(utente);
    else presenti.push(utente);
  } else if (op === 'a' && !eraAssente) {
    assenti.push(utente);
  }
  const saliti = riequilibra(presenti, riserve, max);
  const nuovo = pulisci(e, { fields: [...s.altri, ...campiIscritti(presenti, riserve, assenti, max).map(raw)] });
  if (saliti.length) await avvisoPromossi(env, msg.id, saliti);
  return { embeds: [nuovo], components: tastiIscrizione(max, max > 0 && presenti.length >= max) };
}

// Campi del post (tutti tranne titolo e trama, che vanno in testa); la data diventa un orario Discord nel fuso di chi legge.
function campiPost(valori) {
  const iT = indiceRuolo('titolo');
  const iD = indiceRuolo('descrizione');
  const iQ = indiceRuolo('quando');
  return CAMPI.map((c, k) => ({ c, n: k + 1 }))
    .filter(({ n }) => n !== iT && n !== iD && valori[n])
    .map(({ c, n }) => {
      let valore = valori[n];
      const t = n === iQ ? leggiData(valore) : null;
      if (t) valore = `<t:${t}:F> (<t:${t}:R>)`;
      return { nome: c.nome, valore, inline: !c.lungo };
    });
}

// Valori di una bozza ricostruiti da un post già pubblicato (per "Modifica").
function valoriDaPost(e) {
  const v = {};
  const iT = indiceRuolo('titolo');
  const iD = indiceRuolo('descrizione');
  const iQ = indiceRuolo('quando');
  if (iT) v[iT] = e.title;
  if (iD && e.description) v[iD] = e.description;
  for (const f of e.fields ?? []) {
    const n = CAMPI.findIndex((c) => c.nome === f.name) + 1;
    if (!n) continue;
    const t = n === iQ ? /<t:(\d+):F>/.exec(f.value)?.[1] : null;
    v[n] = t ? formattaData(Number(t)) : f.value;
  }
  return v;
}

const nonConfigurato = () =>
  errore('Pubblicazione non configurata: mancano `DISCORD_TOKEN` (segreto) o `FORFUN_CANALE` (ID del canale) nel Worker.');

function controllaData(valori) {
  const iQ = indiceRuolo('quando');
  if (!iQ) return null;
  const t = leggiData(valori[iQ]);
  if (!t) return 'Data non valida: usa il formato GG/MM/AAAA HH:MM (es. 25/10/2026 21:00).';
  if (t * 1000 <= Date.now()) return 'La data è già passata.';
  return null;
}

async function pubblica(valori, { i, env }) {
  if (!env?.DISCORD_TOKEN || !env?.FORFUN_CANALE) return nonConfigurato();
  const m = mancanti(valori);
  if (m.length) return errore(`Mancano campi obbligatori: ${m.map((c) => c.nome).join(', ')}.`);
  const problema = controllaData(valori);
  if (problema) return errore(problema);

  const utente = i.member?.user ?? i.user;
  const nome = i.member?.nick ?? utente.global_name ?? utente.username;
  const max = maxDaPosti(valori[indiceRuolo('posti')]);
  const ruolo = cfg.ruolo_notifica || '';

  const r = await api(env, 'POST', `/channels/${env.FORFUN_CANALE}/messages`, {
    content: `<@${utente.id}> propone una sessione **${cfg.titolo}**${ruolo ? `\n<@&${ruolo}>` : ''}`,
    embeds: [
      embed({
        titolo: valori[indiceRuolo('titolo')],
        descrizione: valori[indiceRuolo('descrizione')],
        colore: cfg.colore,
        campi: [...campiPost(valori), ...campiIscritti([], [], [], max)],
        footer: `Arcamis 2026 · ${cfg.titolo} · proposta da ${nome}`,
      }),
    ],
    components: tastiIscrizione(max),
    allowed_mentions: { parse: [], roles: ruolo ? [ruolo] : [] }, // ping solo al ruolo, mai al proponente
  });
  if (!r.ok) {
    console.error('Pubblicazione fallita:', r.status, await r.text());
    const causa =
      r.status === 401 ? 'il token del bot non è valido'
      : r.status === 403 || r.status === 404 ? 'il bot non vede il canale o non ha i permessi (servono: Visualizza canale, Invia messaggi, Incorpora link, Crea thread pubblici)'
      : `Discord ha risposto ${r.status}`;
    return errore(`Non sono riuscito a pubblicare: ${causa}.`);
  }
  const post = await r.json();

  let nota = '';
  const t = await api(env, 'POST', `/channels/${env.FORFUN_CANALE}/messages/${post.id}/threads`, {
    name: valori[indiceRuolo('titolo')].slice(0, 100),
    auto_archive_duration: 10080,
  });
  if (!t.ok) {
    console.error('Thread fallito:', t.status, await t.text());
    nota = '\n⚠️ Post pubblicato, ma non sono riuscito a creare il thread (permesso "Crea thread pubblici").';
  }
  return {
    content: `✅ Sessione pubblicata: https://discord.com/channels/${i.guild_id}/${env.FORFUN_CANALE}/${post.id}${nota}`,
    embeds: [],
    components: [],
  };
}

// ---------- Gestione del proprio post ----------
const puoGestire = (i, proponenteId) => {
  const utente = (i.member?.user ?? i.user).id;
  if (utente === proponenteId) return true;
  try {
    const p = BigInt(i.member?.permissions ?? 0);
    return (p & 0x8n) !== 0n || (p & 0x2000n) !== 0n; // Amministratore o Gestisci messaggi
  } catch {
    return false;
  }
};
const NON_AUTORIZZATO = 'Solo chi ha proposto la sessione, o lo staff, può gestirla.';
const urlPost = (i, env, id) => `https://discord.com/channels/${i.guild_id}/${env.FORFUN_CANALE}/${id}`;

async function leggiPost(env, id) {
  try {
    const r = await api(env, 'GET', `/channels/${env.FORFUN_CANALE}/messages/${id}`);
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}
const modificaPost = (env, id, corpo) => api(env, 'PATCH', `/channels/${env.FORFUN_CANALE}/messages/${id}`, corpo);

function pannello(post, id) {
  const e = post.embeds[0];
  const chiusa = chiusaDi(post);
  return {
    embeds: [
      embed({
        titolo: 'Gestisci sessione',
        descrizione: `**${e.title}**\n${chiusa ? '🔒 Iscrizioni chiuse' : '🟢 Iscrizioni aperte'}`,
        colore: cfg.colore,
      }),
    ],
    components: [
      {
        type: 1,
        components: [
          { type: 2, style: 1, label: 'Modifica', custom_id: `ffg|m|${id}` },
          { type: 2, style: 2, label: chiusa ? 'Riapri iscrizioni' : 'Chiudi iscrizioni', custom_id: `ffg|c|${id}` },
          { type: 2, style: 4, label: 'Annulla sessione', custom_id: `ffg|a|${id}` },
        ],
      },
    ],
  };
}

// op: g = apri il pannello (dal post), p = torna al pannello, m = modifica, c = chiudi/riapri, a = chiedi conferma, A = annulla davvero.
async function gestisci(op, idPost, { i, env }) {
  if (!env?.DISCORD_TOKEN || !env?.FORFUN_CANALE) return nonConfigurato();
  if (op === 'g') {
    if (!puoGestire(i, proponente(i.message))) return errore(NON_AUTORIZZATO);
    return { ...pannello(i.message, i.message.id), flags: 64 };
  }
  const post = await leggiPost(env, idPost);
  if (!post) return errore('Non trovo più il post della sessione.');
  if (!puoGestire(i, proponente(post))) return errore(NON_AUTORIZZATO);
  if (annullata(post)) return errore('Questa sessione è già annullata.');
  const e = post.embeds[0];

  if (op === 'p') return pannello(post, idPost);
  if (op === 'm') return bozza(valoriDaPost(e), env, { post: idPost });

  if (op === 'c') {
    const chiudi = !chiusaDi(post);
    const nuovo = pulisci(e, { footer: { text: conMarcatore(e.footer?.text ?? '', CHIUSA, chiudi) } });
    const max = maxDi(post);
    const r = await modificaPost(env, idPost, {
      embeds: [nuovo],
      components: tastiIscrizione(max, max > 0 && iscritti(e).presenti.length >= max, chiudi),
    });
    if (!r.ok) return errore('Non sono riuscito a modificare il post.');
    return pannello({ ...post, embeds: [nuovo] }, idPost);
  }

  if (op === 'a') {
    return {
      embeds: [
        embed({
          titolo: 'Annullare la sessione?',
          descrizione: `**${e.title}** verrà segnata come annullata e gli iscritti riceveranno un avviso nel thread.`,
          colore: '#b3261e',
        }),
      ],
      components: [
        {
          type: 1,
          components: [
            { type: 2, style: 4, label: 'Sì, annulla', custom_id: `ffg|A|${idPost}` },
            { type: 2, style: 2, label: 'Indietro', custom_id: `ffg|p|${idPost}` },
          ],
        },
      ],
    };
  }

  if (op === 'A') {
    const s = iscritti(e);
    const r = await modificaPost(env, idPost, {
      embeds: [pulisci(e, { title: `❌ ANNULLATA — ${e.title}`.slice(0, 256), color: 0x95a5a6 })],
      components: [],
    });
    if (!r.ok) return errore('Non sono riuscito ad annullare il post.');
    await scriviNelThread(env, idPost, `❌ La sessione **${e.title}** è stata annullata.\n${[...s.presenti, ...s.riserve].map((u) => `<@${u}>`).join(' ')}`, [...s.presenti, ...s.riserve]);
    try {
      await api(env, 'PATCH', `/channels/${idPost}`, { archived: true });
    } catch (err) {
      console.error('Archiviazione thread fallita:', err);
    }
    return { content: '❌ Sessione annullata.', embeds: [], components: [] };
  }
  return null;
}

// "Salva" dalla bozza di modifica: aggiorna il post tenendo iscritti, riserve e stato.
async function salva(valori, { i, env }) {
  const idPost = postDiBozza(i.message);
  if (!idPost) return errore('Bozza non trovata: riapri ⚙️ Gestisci → Modifica.');
  if (!env?.DISCORD_TOKEN || !env?.FORFUN_CANALE) return nonConfigurato();
  const m = mancanti(valori);
  if (m.length) return errore(`Mancano campi obbligatori: ${m.map((c) => c.nome).join(', ')}.`);
  const problema = controllaData(valori);
  if (problema) return errore(problema);

  const post = await leggiPost(env, idPost);
  if (!post) return errore('Non trovo più il post della sessione.');
  if (!puoGestire(i, proponente(post))) return errore(NON_AUTORIZZATO);
  if (annullata(post)) return errore('Questa sessione è già annullata.');

  const e = post.embeds[0];
  const s = iscritti(e);
  const max = maxDaPosti(valori[indiceRuolo('posti')]);
  const presenti = [...s.presenti];
  const riserve = [...s.riserve];
  const saliti = riequilibra(presenti, riserve, max);

  // Se l'orario cambia, il promemoria deve poter partire di nuovo.
  const iQ = indiceRuolo('quando');
  const prima = /<t:(\d+):F>/.exec(e.fields?.find((f) => f.name === CAMPI[iQ - 1]?.nome)?.value ?? '')?.[1];
  const dopo = iQ ? leggiData(valori[iQ]) : null;
  let footer = e.footer?.text ?? '';
  if (dopo && Number(prima) !== dopo) {
    const eraIniziata = footer.includes(INIZIATA);
    footer = conMarcatore(conMarcatore(footer, PROMEMORIA, false), INIZIATA, false);
    // Spostata nel futuro dopo la chiusura automatica: si riaprono anche le iscrizioni.
    if (eraIniziata && dopo * 1000 > Date.now()) footer = conMarcatore(footer, CHIUSA, false);
  }

  const titolo = valori[indiceRuolo('titolo')] ?? e.title;
  const nuovo = pulisci(e, {
    title: titolo,
    description: valori[indiceRuolo('descrizione')],
    footer: { text: footer },
    fields: [...campiPost(valori).map(raw), ...campiIscritti(presenti, riserve, s.assenti, max).map(raw)],
  });
  const r = await modificaPost(env, idPost, {
    embeds: [nuovo],
    components: tastiIscrizione(max, max > 0 && presenti.length >= max, footer.includes(CHIUSA)),
  });
  if (!r.ok) {
    console.error('Modifica fallita:', r.status, await r.text());
    return errore('Non sono riuscito a modificare il post.');
  }
  if (titolo !== e.title) {
    try {
      await api(env, 'PATCH', `/channels/${idPost}`, { name: titolo.slice(0, 100) });
    } catch (err) {
      console.error('Rinomina thread fallita:', err);
    }
  }
  if (saliti.length) await avvisoPromossi(env, idPost, saliti);
  return { content: `✅ Modifiche salvate: ${urlPost(i, env, idPost)}`, embeds: [], components: [] };
}

// ---------- Lavoro automatico (chiamato dal cron del Worker) ----------
// Legge gli ultimi 100 messaggi del canale e, per ogni post For Fun:
// - entro `promemoria_minuti` dall'inizio scrive nel thread citando presenti, riserve e tentativi;
// - all'orario di inizio chiude le iscrizioni (una sola volta: se lo staff le riapre, restano aperte).
// Il post viene marcato prima di scrivere, per non ripetere mai un'azione. Restituisce i promemoria inviati.
export async function promemoria(env, adesso = Date.now()) {
  if (!env?.DISCORD_TOKEN || !env?.FORFUN_CANALE) return 0;
  const nomeQuando = CAMPI[indiceRuolo('quando') - 1]?.nome;
  if (!nomeQuando) return 0;
  const r = await api(env, 'GET', `/channels/${env.FORFUN_CANALE}/messages?limit=100`);
  if (!r.ok) {
    console.error('Lettura canale fallita:', r.status);
    return 0;
  }
  let inviati = 0;
  for (const m of await r.json()) {
    const e = m.embeds?.[0];
    if (!e || annullata(m) || !m.components?.[0]?.components?.some((c) => c.custom_id?.startsWith('ffr|p|'))) continue;
    const footer = e.footer?.text ?? '';
    const t = /<t:(\d+):F>/.exec(e.fields?.find((f) => f.name === nomeQuando)?.value ?? '')?.[1];
    if (!t) continue;
    const inizio = Number(t) * 1000;
    if (adesso >= inizio) {
      if (footer.includes(INIZIATA)) continue;
      const max = maxDi(m);
      const chiuso = await modificaPost(env, m.id, {
        embeds: [pulisci(e, { footer: { text: conMarcatore(conMarcatore(footer, CHIUSA, true), INIZIATA, true) } })],
        components: tastiIscrizione(max, max > 0 && iscritti(e).presenti.length >= max, true),
      });
      if (!chiuso.ok) console.error('Chiusura automatica fallita:', chiuso.status);
      continue;
    }
    if (footer.includes(PROMEMORIA) || adesso < inizio - ANTICIPO) continue;

    const marcato = await modificaPost(env, m.id, { embeds: [pulisci(e, { footer: { text: conMarcatore(footer, PROMEMORIA, true) } })] });
    if (!marcato.ok) {
      console.error('Marcatura promemoria fallita:', marcato.status);
      continue;
    }
    const s = iscritti(e);
    const utenti = [...s.presenti, ...s.riserve];
    await scriviNelThread(
      env,
      m.id,
      `🔔 **${e.title}** inizia <t:${t}:R>!\n${s.presenti.map((u) => `<@${u}>`).join(' ')}` +
        (s.riserve.length ? `\nRiserve, tenetevi pronti: ${s.riserve.map((u) => `<@${u}>`).join(' ')}` : '') +
        (s.assenti.length ? `\nIn dubbio, confermate se potete: ${s.assenti.map((u) => `<@${u}>`).join(' ')}` : ''),
      [...utenti, ...s.assenti],
    );
    inviati++;
  }
  return inviati;
}

export default {
  descrizione: 'Proponi una sessione "For Fun" con un modulo guidato',
  opzioni: [],

  run(_opzioni, ctx = {}) {
    return { ...bozza({}, ctx.env), flags: 64 };
  },

  // Pulsanti: ff|m|<gruppo>, ff|x, ff|p, ff|s (bozza); ffr|p/a|<posti> (iscrizioni); ffg|<op>|<post> (gestione). Moduli: ffm|<gruppo>.
  async componente(id, valori = [], ctx = {}) {
    const [tipo, op, g] = String(id).split('|');
    if (tipo === 'ff') {
      if (op === 'x') return { content: 'Bozza annullata.', embeds: [], components: [] };
      const corrente = leggi(ctx.i?.message);
      if (op === 'm') {
        const n = Number(g);
        return n >= 1 && n <= GRUPPI ? { modale: modale(n, corrente) } : null;
      }
      if (op === 'p') return pubblica(corrente, ctx);
      if (op === 's') return salva(corrente, ctx);
      return null;
    }
    if (tipo === 'ffr') return rispondi(op, Number(g) || 0, ctx);
    if (tipo === 'ffg') return gestisci(op, g, ctx);
    if (tipo === 'ffm') {
      if (!ctx.i?.message) return errore('Bozza non trovata: rilancia `/forfun`.');
      const corrente = leggi(ctx.i.message);
      let avviso = '';
      for (const riga of valori) {
        for (const x of riga.components ?? []) {
          const n = Number(/^c(\d+)$/.exec(x.custom_id)?.[1]);
          if (!n || n > CAMPI.length) continue;
          const testo = String(x.value ?? '').trim();
          if (!testo) {
            delete corrente[n];
          } else if (CAMPI[n - 1].ruolo === 'quando') {
            const t = leggiData(testo);
            if (!t) avviso = `${CAMPI[n - 1].nome}: usa il formato GG/MM/AAAA HH:MM (es. 25/10/2026 21:00).`;
            else if (t * 1000 <= Date.now()) avviso = `${CAMPI[n - 1].nome}: la data è già passata.`;
            else corrente[n] = formattaData(t);
          } else {
            corrente[n] = testo;
          }
        }
      }
      return bozza(corrente, ctx.env, { avviso, post: postDiBozza(ctx.i.message) });
    }
    return null;
  },
};
