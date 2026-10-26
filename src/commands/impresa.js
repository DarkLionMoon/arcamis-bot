import { embed, errore } from '../util.js';

const MONETE = {
  PP: 1000,
  GP: 100,
  EP: 50,
  SP: 10,
  CP: 1,
};

const NOME_MAX = 80;
const CAPO_STAFF_ROLE_ID = '1493170263448354867';

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
        },
      ],
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
                {
          type: 3,
          name: 'impresa',
          description: 'Nome impresa da gestire (capo-staff)',
          required: false,
          max_length: NOME_MAX,
        },
      ],
    },
    
    {
      type: 1,
      name: 'saldo',
      description: 'Mostra il saldo dell’impresa',
      options: [
        {
          type: 3,
          name: 'impresa',
          description: 'Nome impresa da consultare (capo-staff)',
          required: false,
          max_length: NOME_MAX,
        },
      ],
    },
    {
      type: 1,
      name: 'storico',
      description: 'Mostra gli ultimi movimenti dell’impresa',
      options: [
        {
          type: 3,
          name: 'impresa',
          description: 'Nome impresa da consultare (capo-staff)',
          required: false,
          max_length: NOME_MAX,
        },
      ],
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

function eCapoStaff(i) {
  return (i.member?.roles ?? []).includes(CAPO_STAFF_ROLE_ID);
}

async function selezionaImpresa(DB, i, opzioni) {
  const nomeRichiesto = String(opzioni.impresa ?? '').trim();

  if (eCapoStaff(i)) {
    if (!nomeRichiesto) {
      return {
        errore: 'Indica il nome dell’impresa nel campo impresa.',
      };
    }

    const impresa = await DB.prepare(
      `SELECT id, nome, ruolo_id
       FROM finanze_gilde
       WHERE discord_guild_id = ?
         AND nome = ? COLLATE NOCASE
       LIMIT 1`
    ).bind(i.guild_id, nomeRichiesto).first();

    if (!impresa) {
      return {
        errore: 'Impresa non trovata. Usa /impresa elenco per vedere i nomi disponibili.',
      };
    }

    return { impresa };
  }

  if (nomeRichiesto) {
    return {
      errore: 'Il campo impresa è riservato a capo-staff. Omettilo per usare la tua impresa.',
    };
  }

  return impresaUtente(DB, i);
}

async function impresaUtente(DB, i) {
  const guildId = i.guild_id;
  const ruoliUtente = i.member?.roles ?? [];

  if (!guildId) {
    return { errore: 'Questo comando può essere usato solo in un server Discord.' };
  }

  const imprese = await impreseDelServer(DB, guildId);

  if (imprese.length === 0) {
    return { errore: 'Non ci sono imprese configurate. Un amministratore può usare `/impresa crea`.' };
  }

  const corrispondenze = imprese.filter((x) => ruoliUtente.includes(x.ruolo_id));

  if (corrispondenze.length === 0) {
    return { errore: 'Non hai il ruolo Discord associato a nessuna impresa.' };
  }

  if (corrispondenze.length > 1) {
    return {
      errore: `Hai ruoli associati a più imprese (${corrispondenze.map((x) => x.nome).join(', ')}). Per evitare errori, devi avere un solo ruolo d’impresa per usare questa funzione.`,
    };
  }

  return { impresa: corrispondenze[0] };
}


function risposta(titolo, descrizione, campi) {
  return {
    embeds: [embed({ titolo, descrizione, campi, colore: '#c9a227' })],
  };
}


export default {
  descrizione: 'Gestione delle imprese e delle loro finanze',
  opzioni: opzioniFinanze(),

  async run(opzioni = {}, ctx = {}) {
    const i = ctx.i;
    const DB = ctx.env?.DB;

    if (!i) return errore('Contesto Discord non disponibile.');
    if (!DB) return errore('Database D1 non configurato: controlla il binding DB in wrangler.toml.');

    const azione = opzioni.subcommand;
    const guildId = i.guild_id;

    if (!guildId) return errore('Usa questo comando dentro un server Discord.');

    if (azione === 'crea') {
      if (!amministratore(i)) return errore('Solo gli amministratori del server possono creare imprese.');

      const nome = String(opzioni.nome ?? '').trim();
      const ruoloId = String(opzioni.ruolo ?? '');

      if (!nome || nome.length > NOME_MAX) {
        return errore(`Il nome deve contenere da 1 a ${NOME_MAX} caratteri.`);
      }

      try {
        await DB.prepare(
          `INSERT INTO finanze_gilde
            (discord_guild_id, nome, ruolo_id, creato_da)
           VALUES (?, ?, ?, ?)`
        ).bind(guildId, nome, ruoloId, i.member?.user?.id ?? i.user?.id ?? '').run();

        return risposta('Impresa creata', `L’impresa **${nome}** è stata creata e collegata al ruolo <@&${ruoloId}>.`);
      } catch (err) {
        if (String(err?.message ?? '').includes('UNIQUE')) {
          return errore('Esiste già un’impresa con questo nome in questo server.');
        }
        console.error('Errore creazione impresa:', err);
        return errore('Non è stato possibile creare l’impresa. Controlla i log del Worker.');
      }
    }

    if (azione === 'elenco') {
      const imprese = await impreseDelServer(DB, guildId);
      if (!imprese.length) return risposta('Imprese', 'Non è stata ancora creata nessuna impresa.');

      return risposta(
        'Imprese del server',
        imprese.map((x) => `• **${x.nome}** — <@&${x.ruolo_id}>`).join('\n')
      );
    }

    const selezione = await selezionaImpresa(DB, i, opzioni);
    if (!selezione.impresa) return errore(selezione.errore);

    const impresa = selezione.impresa;

    if (azione === 'finanze') {
      const movimento = analizzaMovimento(opzioni.movimento);
      const motivo = String(opzioni.motivo ?? '').trim();

      if (!movimento) return errore('Formato non valido. Usa, per esempio, `+100 GP` per un’entrata oppure `-25 PP` per un’uscita. Monete ammesse: PP, GP, EP, SP, CP.');
      if (!motivo) return errore('Inserisci il motivo del movimento.');

      try {
        await DB.prepare(
          `INSERT INTO finanze_movimenti
            (gilda_id, tipo, moneta, quantita, valore_cp, motivo, autore_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          impresa.id,
          movimento.tipo,
          movimento.moneta,
          movimento.quantita,
          movimento.valore_cp,
          motivo,
          i.member?.user?.id ?? i.user?.id ?? ''
        ).run();

        const segno = movimento.tipo === 'entrata' ? '+' : '−';

        return risposta(
          'Movimento registrato',
          `**Impresa:** ${impresa.nome}\n**Operazione:** ${segno}${movimento.quantita} ${movimento.moneta}\n**Motivo:** ${motivo}`
        );
      } catch (err) {
        console.error('Errore registrazione movimento:', err);
        return errore('Non è stato possibile registrare il movimento nel database.');
      }
    }

    
if (azione === 'saldo') {
  const r = await DB.prepare(
    `SELECT
       COALESCE(SUM(CASE WHEN tipo = 'entrata' THEN valore_cp ELSE -valore_cp END), 0) AS saldo_cp,
       COALESCE(SUM(CASE WHEN tipo = 'entrata' AND moneta = 'PP' THEN quantita WHEN tipo = 'uscita' AND moneta = 'PP' THEN -quantita ELSE 0 END), 0) AS pp,
       COALESCE(SUM(CASE WHEN tipo = 'entrata' AND moneta = 'GP' THEN quantita WHEN tipo = 'uscita' AND moneta = 'GP' THEN -quantita ELSE 0 END), 0) AS gp,
       COALESCE(SUM(CASE WHEN tipo = 'entrata' AND moneta = 'EP' THEN quantita WHEN tipo = 'uscita' AND moneta = 'EP' THEN -quantita ELSE 0 END), 0) AS ep,
       COALESCE(SUM(CASE WHEN tipo = 'entrata' AND moneta = 'SP' THEN quantita WHEN tipo = 'uscita' AND moneta = 'SP' THEN -quantita ELSE 0 END), 0) AS sp,
       COALESCE(SUM(CASE WHEN tipo = 'entrata' AND moneta = 'CP' THEN quantita WHEN tipo = 'uscita' AND moneta = 'CP' THEN -quantita ELSE 0 END), 0) AS cp
     FROM finanze_movimenti
     WHERE gilda_id = ?`
  ).bind(impresa.id).first();

  const saldo = Number(r?.saldo_cp ?? 0);
  const segno = saldo < 0 ? '-' : '';
  let resto = Math.abs(saldo);

  const monete = {};
  for (const [nome, valore] of Object.entries(MONETE)) {
    monete[nome] = Math.floor(resto / valore);
    resto %= valore;
  }

  
const dettaglio = [
  `💎 ${monete.PP} PP`,
  `🟡 ${monete.GP} GP`,
  `⚪ ${monete.EP} EP`,
  `🔺 ${monete.SP} SP`,
  `🟤 ${monete.CP} CP`,
].join('\n');

const totaleMO = (saldo / MONETE.GP).toLocaleString('it-IT', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

return risposta(
  `Saldo — ${impresa.nome}`,
  `${dettaglio}\n\n**Valore totale**\n🟡 ${totaleMO} MO`
);
}



    if (azione === 'storico') {
      const r = await DB.prepare(
        `SELECT tipo, moneta, quantita, motivo, autore_id, creato_il
         FROM finanze_movimenti
         WHERE gilda_id = ?
         ORDER BY id DESC
         LIMIT 10`
      ).bind(impresa.id).all();

      const movimenti = r.results ?? [];
      if (!movimenti.length) return risposta(`Storico — ${impresa.nome}`, 'Non ci sono ancora movimenti.');

      return risposta(
        `Storico — ${impresa.nome}`,
        movimenti.map((m) => {
          const segno = m.tipo === 'entrata' ? '+' : '−';
          return `**${segno}${m.quantita} ${m.moneta}** — ${m.motivo}\n<@${m.autore_id}> · ${m.creato_il}`;
        }).join('\n\n')
      );
    }

    return errore('Sottocomando non riconosciuto.');
  },
};

