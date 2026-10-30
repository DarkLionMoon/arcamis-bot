// Test offline: simula Discord firmando le richieste con una chiave Ed25519 generata al volo.
import assert from 'node:assert';
import { generateKeyPairSync, sign } from 'node:crypto';
import worker from '../src/index.js';
import { definizioni } from '../src/registry.js';

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const chiaveHex = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('hex');
const env = { DISCORD_PUBLIC_KEY: chiaveHex };

async function invia(oggetto, { firmaValida = true } = {}) {
  const corpo = JSON.stringify(oggetto);
  const ts = String(Math.floor(Date.now() / 1000));
  let firma = sign(null, Buffer.from(ts + corpo), privateKey).toString('hex');
  if (!firmaValida) firma = firma.replace(/^../, (x) => (x === '00' ? '01' : '00'));
  const req = new Request('https://bot.example/', {
    method: 'POST',
    headers: { 'x-signature-ed25519': firma, 'x-signature-timestamp': ts, 'content-type': 'application/json' },
    body: corpo,
  });
  return worker.fetch(req, env);
}
const comando = (name, options) => ({ type: 2, data: { name, options } });
const campi = (r) => Object.fromEntries(r.data.embeds[0].fields.map((f) => [f.name, f.value]));

// 1) GET e metodi
assert.strictEqual(await (await worker.fetch(new Request('https://bot.example/'), env)).text(), 'Bot attivo');
assert.strictEqual((await worker.fetch(new Request('https://bot.example/', { method: 'PUT' }), env)).status, 405);

// 2) Firma: PING valido -> PONG; firma alterata -> 401; senza firma -> 401
let res = await invia({ type: 1 });
assert.strictEqual(res.status, 200);
assert.deepStrictEqual(await res.json(), { type: 1 });
assert.strictEqual((await invia({ type: 1 }, { firmaValida: false })).status, 401);
assert.strictEqual(
  (await worker.fetch(new Request('https://bot.example/', { method: 'POST', body: '{"type":1}' }), env)).status,
  401
);
assert.strictEqual(
  (await worker.fetch(new Request('https://bot.example/', { method: 'POST', body: '{}' }), { DISCORD_PUBLIC_KEY: 'INCOLLA_QUI' })).status,
  500
);

// 3) Comandi
let r = await (await invia(comando('locanda'))).json();
assert.strictEqual(r.type, 4);
assert.ok(r.data.embeds[0].fields.length >= 2);
r = await (await invia(comando('locanda', [{ name: 'citta', type: 3, value: 'forte' }]))).json();
assert.ok(r.data.embeds[0].title.includes('Forte Vigilus'));
r = await (await invia(comando('locanda', [{ name: 'citta', type: 3, value: 'xyz' }]))).json();
assert.strictEqual(r.data.embeds[0].title, 'Errore');
assert.strictEqual(r.data.flags, 64);

r = await (await invia(comando('itinerario', [
  { name: 'da', type: 3, value: 'Arcamis' },
  { name: 'a', type: 3, value: 'foresta' },
]))).json();
assert.strictEqual(campi(r)['Distanza'], '105 miglia'); // via Passo di Julius (45+60), meglio di via Forte (30+20+60)
assert.strictEqual(campi(r)['Tempo di viaggio'], '4 giorni e 3 ore'); // 105 miglia a 3 mph = 35 ore
assert.ok(campi(r)['Percorso'].includes('Passo di Julius'));
r = await (await invia(comando('itinerario', [
  { name: 'da', type: 3, value: 'Arcamis' },
  { name: 'a', type: 3, value: 'Foresta Infinita' },
  { name: 'mezzo', type: 3, value: 'cavallo' },
]))).json();
assert.strictEqual(campi(r)['Tempo di viaggio'], '2 giorni e 1.5 ore'); // 105 miglia a 6 mph = 17.5 ore
r = await (await invia(comando('itinerario', [{ name: 'da', type: 3, value: 'Arcamis' }, { name: 'a', type: 3, value: 'Arcamis' }]))).json();
assert.strictEqual(r.data.embeds[0].title, 'Errore');

// 3b) Test accredito Avrae: accesso negato senza ruolo, istruzioni visibili a Capo-Staff.
const STAFF_ROLE_ID = '1493170263448354867';
r = await (await invia({
  type: 2,
  guild_id: 'test-guild',
  data: { name: 'test-avrae-credit', options: [] },
  member: { roles: [] },
})).json();
assert.strictEqual(r.data.embeds[0].title, 'Errore');
assert.strictEqual(r.data.flags, 64);
r = await (await invia({
  type: 2,
  guild_id: 'test-guild',
  data: { name: 'test-avrae-credit', options: [] },
  member: { roles: [STAFF_ROLE_ID] },
})).json();
assert.ok(r.data.embeds[0].title.includes('Test integrazione Avrae'));
assert.strictEqual(r.data.flags, 64);

// 4) Comandi semplici, alias e aiuto
r = await (await invia(comando('regole'))).json();
assert.strictEqual(r.data.embeds[0].title, 'Regolamento di Arcamis');
r = await (await invia(comando('regolamento'))).json();
assert.strictEqual(r.data.embeds[0].title, 'Regolamento di Arcamis');
r = await (await invia(comando('aiuto'))).json();
assert.ok(r.data.embeds[0].description.includes('/locanda') && r.data.embeds[0].description.includes('/itinerario'));
r = await (await invia(comando('inesistente'))).json();
assert.strictEqual(r.data.embeds[0].title, 'Errore');
assert.deepStrictEqual(r.data.allowed_mentions, { parse: [] });

// 5) Autocompletamento
r = await (await invia({ type: 4, data: { name: 'itinerario', options: [{ name: 'da', type: 3, value: 'for', focused: true }] } })).json();
assert.strictEqual(r.type, 8);
assert.deepStrictEqual(r.data.choices.map((c) => c.value).sort(), ['Foresta Infinita', 'Forte Vigilus']);
r = await (await invia({ type: 4, data: { name: 'locanda', options: [{ name: 'citta', type: 3, value: '', focused: true }] } })).json();
assert.strictEqual(r.data.choices.length, 2);

// 6) Definizioni per Discord: valide e senza duplicati
const defs = definizioni();
assert.ok(defs.length <= 100);
for (const d of defs) {
  assert.ok(d.description.length >= 1 && d.description.length <= 100, `descrizione: ${d.name}`);
  for (const o of d.options || []) assert.ok(/^[a-z0-9_-]{1,32}$/.test(o.name), `opzione: ${o.name}`);
}
const opzioniObbligatorie = defs.find((d) => d.name === 'itinerario').options.map((o) => !!o.required);
assert.deepStrictEqual(opzioniObbligatorie, [true, true, false], 'le opzioni obbligatorie vanno prima di quelle facoltative');

console.log('Tutti i test passati');
