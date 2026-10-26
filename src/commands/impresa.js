```javascript
import { embed, errore, norm } from '../util.js';

const MONETE = {
  PP: 1000,
  GP: 100,
  EP: 50,
  SP: 10,
  CP: 1,
};

const NOME_MAX = 80;

function opzioniFinanze() {
  return [
    {
      type: 1,
      name: 'crea',
      description: 'Crea un’impresa e associa un ruolo Discord',
      options: [
        {
          type: 3,
          name: 'nome',
          description: 'Nome dell’impresa',
          required: true,
          max_length: NOME_MAX,
        },
        {
          type: 8,
          name: 'ruolo',
          description: 'Ruolo Discord autorizzato per questa impresa',
          required: true,
      }],
    },
    {
      type: 1,
      name: 'elenco',
      description: 'Mostra le imprese configurate',
    },
    {
      type: 1,
      name: 'finanze',
      description: 'Registra un movimento finanziario',
      options: [
        {
          type: 3,
          name: 'movimento',
          description: 'Esempi: +100 GP oppure -25 PP',
          required: true,
          max_length: 30,
        },
        {
          type: 3,
          name: 'motivo',
          description: 'Motivo dell’entrata o dell’uscita',
          required: true,
          max_length: 200,
        },
      ],
    },
    {
      type: 1,
      name: 'saldo',
      description: 'Mostra il saldo dell’impresa',
    },
    {
      type: 1,
      name: 'storico',
      description: 'Mostra gli ultimi movimenti dell’impresa',
    },
  ];
}

function amministratore(i) {
  try {
    return (BigInt(i?.member?.permissions ?? 0) & 0x8n) !== 0n;
  } catch {
    return false;
  }
}

function analizzaMovimento(testo) {
  const m = String(testo ?? '')
    .trim()
    .match(/^([+-])\s*(\d+)\s*(PP|GP|EP|SP|CP)$/i);

  if (!m) return null;

  const quantita = Number(m[2]);
  const moneta = m[3].toUpperCase();

  if (!Number.isSafeInteger(quantita) || quantita <= 0) return null;

  const valore_cp = quantita * MONETE[moneta];
  if (!Number.isSafeInteger(valore_cp) || valore_cp <= 0) return null;

  return {
    tipo: m[1] === '+' ? 'entrata' : 'uscita',
    quantita,
    moneta,
    valore_cp,
  };
}

async function impreseDelServer(DB, guildId) {
  const result = await DB.prepare(
    `SELECT id, nome, ruolo_id
     FROM finanze_gilde
     WHERE discord_guild_id = ?
     ORDER BY nome`
  ).bind(guildId).all();

  return result.results ?? [];
}

async function impresaUtente(DB, i) {
  const guildId = i.guild_id;
  const
