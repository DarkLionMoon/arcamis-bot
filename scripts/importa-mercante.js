// Scarica da Open5e gli oggetti con licenza CC-BY-4.0 (SRD 5.1 e 5.2) e li salva in data/mercante.json.
// Uso: node scripts/importa-mercante.js [percorso-uscita]   (di solito lo lancia la GitHub Action "Importa catalogo mercante")
// Per aggiungere altre fonti aperte modifica FONTI_V2 (chiavi dei documenti Open5e v2) rispettandone la licenza.
import { writeFile } from 'node:fs/promises';

const API = process.env.OPEN5E_API || 'https://api.open5e.com';
const USCITA = process.argv[2] || 'data/mercante.json';
const FONTI_V2 = { 'srd-2014': 'SRD 5.1', 'srd-2024': 'SRD 5.2' }; // in ordine di priorità se un nome è doppio
const DOC_V1 = 'wotc-srd'; // oggetti magici dello SRD 5.1
const MAX_DESC = 1800;

const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const num = (x) => {
  const n = Number.parseFloat(x);
  return Number.isFinite(n) ? n : null;
};

async function scarica(url) {
  const out = [];
  while (url) {
    const r = await fetch(url, { headers: { accept: 'application/json' } });
    if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
    const j = await r.json();
    out.push(...(j.results ?? []));
    url = j.next;
  }
  return out;
}

const taglia = (t) => {
  const s = String(t ?? '').trim();
  return s.length > MAX_DESC ? `${s.slice(0, MAX_DESC - 1)}…` : s;
};

function chiaveRarita(r) {
  const v = typeof r === 'string' ? r : (r?.key ?? r?.name ?? '');
  const k = norm(v).replace(/\s+/g, '-');
  return !k || ['none', 'mundane', 'nessuna'].includes(k) ? null : k;
}

function statistiche(it) {
  const out = [];
  const w = it.weapon;
  if (w) {
    const dmg = [w.damage_dice, w.damage_type?.name ?? w.damage_type].filter(Boolean).join(' ');
    if (dmg) out.push(`Danno: ${dmg}`);
    const pr = (w.properties ?? []).map((p) => p.property?.name ?? p.name ?? p).filter((p) => typeof p === 'string');
    if (pr.length) out.push(`Proprietà: ${pr.join(', ')}`);
  }
  const a = it.armor;
  if (a && a.ac_base != null) {
    let ca = `CA ${a.ac_base}`;
    if (a.ac_add_dexmod) ca += ` + Des${a.ac_cap_dexmod != null ? ` (max ${a.ac_cap_dexmod})` : ''}`;
    out.push(ca);
    if (a.strength_score_required) out.push(`Richiede For ${a.strength_score_required}`);
    if (a.grants_stealth_disadvantage) out.push('Svantaggio a Furtività');
  }
  return out.join(' · ');
}

function daV2(it) {
  const rar = chiaveRarita(it.rarity);
  const magico = Boolean(it.is_magic_item) || Boolean(rar);
  const attun = it.requires_attunement ?? it.attunement;
  return {
    n: it.name,
    c: magico ? 'magico' : (it.category?.key ?? 'altro'),
    t: magico ? (it.category?.name ?? '') : '',
    k: num(it.cost),
    p: num(it.weight),
    r: rar,
    a: attun ? (typeof attun === 'string' ? attun.replace(/^requires attunement\s*/i, '').trim() || true : true) : null,
    s: statistiche(it),
    d: taglia(it.desc),
    f: FONTI_V2[it.document?.key],
  };
}

function daV1(m) {
  const att = String(m.requires_attunement ?? '').trim();
  return {
    n: m.name,
    c: 'magico',
    t: m.type ?? '',
    k: null,
    p: null,
    r: chiaveRarita(m.rarity),
    a: att ? att.replace(/^requires attunement\s*/i, '').trim() || true : null,
    s: '',
    d: taglia(m.desc),
    f: 'SRD 5.1',
  };
}

const v2 = (await scarica(`${API}/v2/items/?limit=200`)).filter((x) => FONTI_V2[x.document?.key]);
let v1 = [];
try {
  v1 = (await scarica(`${API}/v1/magicitems/?limit=500&document__slug=${DOC_V1}`)).filter(
    (x) => !x.document__slug || x.document__slug === DOC_V1,
  );
} catch (e) {
  console.warn('Oggetti magici v1 non scaricati:', e.message);
}

// Priorità: SRD 5.1 (v2), poi oggetti magici v1, poi SRD 5.2. Un nome già presente non viene sovrascritto.
const ordine = [
  ...v2.filter((x) => x.document.key === 'srd-2014').map(daV2),
  ...v1.map(daV1),
  ...v2.filter((x) => x.document.key !== 'srd-2014').map(daV2),
];
const visti = new Set();
const oggetti = [];
for (const o of ordine) {
  if (!o.n || !o.f) continue;
  const k = norm(o.n);
  if (visti.has(k)) continue;
  visti.add(k);
  oggetti.push(Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== '' && v !== undefined)));
}
oggetti.sort((x, y) => x.n.localeCompare(y.n, 'en'));

if (oggetti.length === 0) {
  console.error('Nessun oggetto scaricato: file non modificato.');
  process.exit(1);
}

const meta = {
  generato: new Date().toISOString().slice(0, 10),
  licenza: 'CC BY 4.0',
  attribuzione:
    'Contiene materiale del System Reference Document 5.1 / 5.2 © Wizards of the Coast LLC, licenza CC BY 4.0. Dati via Open5e.',
};
const testo = `{"meta":${JSON.stringify(meta)},"oggetti":[\n${oggetti.map((o) => JSON.stringify(o)).join(',\n')}\n]}\n`;
await writeFile(USCITA, testo);

const per = {};
for (const o of oggetti) per[o.c] = (per[o.c] ?? 0) + 1;
console.log(`Scritti ${oggetti.length} oggetti in ${USCITA}`, per);
