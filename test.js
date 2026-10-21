// Test offline: nessun token e nessuna connessione a Discord necessari.
const assert = require('assert');
const { tokenize, trovaNome } = require('./lib/util');
const locanda = require('./handlers/locanda');
const itinerario = require('./handlers/itinerario');

assert.deepStrictEqual(tokenize('"Forte Vigilus" Arcamis cavallo'), ['Forte Vigilus', 'Arcamis', 'cavallo']);
assert.strictEqual(trovaNome(['Arcamis', 'Aurenthar'], 'arc').nome, 'Arcamis');
assert.strictEqual(trovaNome(['Arcamis', 'Aurenthar'], 'a').nome, undefined);

const tutte = locanda.run([]);
assert.ok(tutte.embeds[0].fields.length >= 2, 'locanda: un campo per città');
assert.ok(locanda.run(['forte']).embeds[0].title.includes('Forte Vigilus'));
assert.ok(locanda.run(['inesistente']).embeds[0].title === 'Errore');

// Arcamis -> Foresta Infinita: Arcamis-Passo(45)+Passo-Foresta(60)=105 miglia, preferibile a via Forte (30+20+60=110).
const it = itinerario.run(['Arcamis', 'Foresta Infinita']);
const campi = Object.fromEntries(it.embeds[0].fields.map((f) => [f.name, f.value]));
assert.strictEqual(campi['Distanza'], '105 miglia');
assert.ok(campi['Percorso'].includes('Passo di Julius'));
assert.strictEqual(campi['Tempo di viaggio'], '4 giorni e 3 ore'); // 105 miglia / 3 mph = 35 ore = 4 giorni da 8h + 3h

console.log('Tutti i test passati');
