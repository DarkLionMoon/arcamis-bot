import { embed, errore } from '../util.js';

const CANALE = '1521930654575755424';
const API = 'https://discord.com/api/v10';
const INTRO = 'Vuoi una lista di ogni singolo comando necessario di Avrae? Clicca il pulsante corrispondente alla categoria che cerchi! (In alternativa, con il comando `!aiuto`, avrete a disposizione delle liste carine intra-Avrae degli stessi comandi).`n`nCi teniamo a ringraziare **<@334071748850876416>** per averci fornito una lista dei comandi non-homebrew di Avrae!';

const CATEGORIE = {
  homebrew: {
    titolo: '🏰 Comandi Homebrew - Arcamis',
    testo: [
      '### Lavoro',
      '- `!stipendio` Calcola lo stipendio il giorno 1 di ogni mese. Imposta prima il lavoro con `!tessera lavoro <lavoro>`.',
      'Lavori validi: biblioteca, bottega farmaceutica, corporazione dei costruttori, forgia, locanda, officina, ospedale, sartoria, tribunale. Giorni: minimo 5, massimo 25.',
      '',
      '### Locanda',
      '- `!locanda` Visualizza lo status del pagamento.',
      '- `!locanda paga <tipologia> <mensile/trimestrale/semestrale>` Paga l’affitto (2 mo per la Tessera + costo stanza variabile).',
      '- `!locanda lista` Visualizza le tipologie di pagamento e le locande.',
      '',
      '### Mondo',
      '- `!edifici <ora>` Visualizza orari di apertura e lavoro degli edifici.',
      '- `!pdi` (nuovo bot: `/pdi`) Lista dei Punti di Interesse.',
      '- `!itinerario <PDI> <PDI>` (nuovo bot: `/itinerario`) Tempi di percorrenza tra 2 PDI.',
      '- `!bollettino <PDI>` (nuovo bot: `/bollettino`) Meteo di un PDI.',
      '- `!necrologio` (nuovo bot: `/necrologio`) Visualizza i necrologi.',
      '',
      '### Personaggio',
      '- `!aiuto tessera` Lista dei comandi per la tessera avventuriero.',
      '- `!tessera` Visualizza la tessera avventuriero.',
      '- `!tessera lavoro <nome lavoro>` Aggiunge il lavoro del PG alla tessera.',
      '- `!tessera mestiere <nome mestiere> <livello mestiere>` Aggiunge il mestiere e il livello.',
      'Mestieri validi: Alchimista, Architetto, Artigiano, Artista, Falegname, Meccanico, Metallurgo, Oste, Sarto.',
    ].join('\n'),
  },
  pg: {
    titolo: '🧙 Creazione & Gestione PG',
    testo: [
      '### Importare la scheda',
      '- `!import [link scheda]` Importa il PG dal link.',
      '- `!update` Aggiorna la scheda dopo modifiche.',
      '- `!char server "Nome del PG"` Imposta un PG come PG del server.',
      '',
      '### Gestione zaino',
      '- `!bag create "nome bag"` Crea uno zaino.',
      '- `!bag pack "Explorer’s Pack"` Aggiunge un pack (usa `!pacchetto` per i pacchetti 2024).',
      '- `!bag "nome" +/-[qtà] "Oggetto"` Aggiunge una quantità di un oggetto a una borsa.',
      '',
      '### Gestione monete',
      '- `!g coin +/-[quantità] [tipo]` Aggiunge o rimuove monete.',
      'Tipi: pp, gp, ep, sp, cp. Esempio: `!g coin +120 gp`.',
      '',
      '### Esperienza',
      '- `!xp +/-[quantità] ["Descrizione"]` Aggiunge o rimuove XP, con descrizione facoltativa.',
      '',
      '### Riposi',
      '- `!g lr` Riposo lungo.',
      '- `!g sr` Riposo breve.',
      '',
      '### Custom Counter',
      '- `!cc create "Nome" -reset <long/short> -min <n> -max <n>` Crea un counter.',
      'Argomenti validi:',
      '- `-name <name>` Rinomina il counter.',
      '- `-title <"title">` Imposta un titolo; [name] viene sostituito col nome del player.',
      '- `-desc <"desc">` Imposta la descrizione.',
      '- `-reset <short|long|none>` Imposta quando si resetta; senza opzione, solo con `!cc reset`.',
      '- `-max <max value>` Valore massimo.',
      '- `-min <min value>` Valore minimo.',
      '- `-type <bubble|square|hex|star|default>` Visualizza bolle, quadrati, esagoni, stelle o numeri.',
      '- `-resetto <value>` Valore di reset (predefinito: massimo).',
      '- `-resetby <value>` Aggiunge/rimuove questo numero al reset.',
    ].join('\n'),
  },
  combat: {
    titolo: '⚔️ Abilità & Combattimento',
    testo: [
      '### Check abilità',
      '- `!c [abilità]` in inglese (esempio: `!c perception`).',
      'In italiano: `!forza` / `!destrezza` / `!costituzione` / `!intelligenza` / `!saggezza` / `!carisma`.',
      '',
      '### Tiro salvezza',
      '- `!s [stat]` in inglese; non esiste una versione italiana.',
      'Tipi: `str` / `dex` / `con` / `int` / `wis` / `cha`.',
      '',
      '### Attacchi',
      '- `!a "nome" -t "bersaglio"`',
      '',
      '### Spell',
      '- `!cast "nome spell" -t "bersaglio"`',
      '',
      '### Modificatori per attacchi e spell',
      '- `-adv` Vantaggio.',
      '- `-dis` Svantaggio.',
      '- `-d [dado]` Dadi extra.',
      '- `-b [dado]` Bonus danni.',
      '- `-t [target]` Bersaglio specifico.',
      '- `-rr [numero]` Numero di attacchi uguali nello stesso turno.',
      '',
      '### Iniziativa',
      '- `!init join` Tira iniziativa.',
      '- `!init join -adv` Tira con vantaggio.',
      '- `!init join -p [x]` Entra con un valore già tirato.',
      '- `!init next` (oppure `!i n`) Passa al prossimo turno.',
    ].join('\n'),
  },
  downtime: {
    titolo: '📖 Guida Downtime',
    testo: [
      'Gestisci i tuoi downtime con i seguenti comandi.',
      '',
      '### Avvia',
      '- `!downtime <tipo> start <totale> [descrizione]`',
      '',
      '### Registra sessione',
      '- `!downtime <tipo> log <progresso> <ora_inizio> <ora_fine> <link>` Link obbligatorio.',
      '',
      '### Stato',
      '- `!downtime <tipo> status` Stato di un downtime specifico attivo del PG.',
      '- `!downtime status` Stato di tutti i downtime attivi del PG.',
      '',
      '### Cambia descrizione',
      '- `!downtime <tipo> label <testo>`',
      '',
      '### Azzera',
      '- `!downtime <tipo> reset`',
      '',
      'Tipi disponibili: Crafting, Lettura, Altro.',
      'Esempio: `!downtime lettura log 2 6 14 https://discord.com/...`.',
    ].join('\n'),
  },
};

function pannello() {
  return {
    embeds: [embed({ titolo: '📚 Comandi di Avrae', descrizione: INTRO, colore: '#c9a227' })],
    components: [{ type: 1, components: [{ type: 2, style: 1, label: 'Apri lista comandi', custom_id: 'avrae|apri' }] }],
  };
}

function categorie() {
  return {
    embeds: [embed({ titolo: '📚 Comandi di Avrae', descrizione: INTRO, colore: '#c9a227' })],
    components: [{ type: 1, components: [
      { type: 2, style: 1, label: 'HOMEBREW', custom_id: 'avrae|cat|homebrew' },
      { type: 2, style: 1, label: 'PG', custom_id: 'avrae|cat|pg' },
      { type: 2, style: 1, label: 'COMBAT', custom_id: 'avrae|cat|combat' },
      { type: 2, style: 1, label: 'DOWNTIME', custom_id: 'avrae|cat|downtime' },
    ] }],
  };
}

export default {
  descrizione: 'Pubblica il pannello con le liste dei comandi Avrae',
  opzioni: [],
  async run(_opzioni, ctx = {}) {
    const token = ctx.env?.DISCORD_TOKEN;
    if (!token) return errore('Configurazione mancante: il Worker deve avere il segreto DISCORD_TOKEN.');
    const r = await fetch(API + '/channels/' + CANALE + '/messages', {
      method: 'POST',
      headers: { Authorization: 'Bot ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...pannello(), allowed_mentions: { parse: [] } }),
    });
    if (!r.ok) {
      console.error('Pubblicazione pannello Avrae fallita:', r.status, await r.text());
      return errore(r.status === 403 || r.status === 404
        ? 'Non riesco a pubblicare nel canale configurato. Verifica che il bot possa visualizzare il canale e inviare messaggi.'
        : 'Discord ha risposto con errore ' + r.status + ' durante la pubblicazione.');
    }
    return { content: '✅ Pannello dei comandi Avrae pubblicato nel canale <#' + CANALE + '>.' , flags: 64 };
  },
  componente(id) {
    const [prefisso, azione, categoria] = String(id).split('|');
    if (prefisso !== 'avrae') return null;
    if (azione === 'apri') return { ...categorie(), flags: 64 };
    if (azione === 'menu') return categorie();
    if (azione === 'cat') {
      const voce = CATEGORIE[categoria];
      if (!voce) return errore('Categoria non riconosciuta. Riapri il pannello dei comandi Avrae.');
      return {
        embeds: [embed({ titolo: voce.titolo, descrizione: voce.testo, colore: '#c9a227' })],
        components: [{ type: 1, components: [{ type: 2, style: 2, label: '↩ Categorie', custom_id: 'avrae|menu' }] }],
      };
    }
    return null;
  },
};
