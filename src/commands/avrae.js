// /avrae — pubblica il pannello delle liste dei comandi Avrae.
import { embed, errore } from '../util.js';

const CANALE = '1521930654575755424';
const API = 'https://discord.com/api/v10';
const INTRO = 'Vuoi una lista di ogni singolo comando necessario di Avrae? Clicca il pulsante corrispondente alla categoria che cerchi! (In alternativa, con il comando `!aiuto`, avrete a disposizione delle liste carine intra-Avrae degli stessi comandi).\n\nCi teniamo a ringraziare **<@334071748850876416>** per averci fornito una lista dei comandi non-homebrew di Avrae!';

const CATEGORIE = {
  homebrew: {
    titolo: '🏰 Comandi Homebrew - Arcamis',
    testo: `### Lavoro
- ` + '`!stipendio`' + ` Calcola lo stipendio da prendere il giorno 1 di ogni mese (Obbligatorio impostare il lavoro effettuato sulla tessera con ` + '`!tessera lavoro <lavoro>`' + `).
Lavori validi: biblioteca, bottega farmaceutica, corporazione dei costruttori, forgia, locanda, officina, ospedale, sartoria, tribunale. Giorni: minimo 5, massimo 25.

### Locanda
- ` + '`!locanda`' + ` Visualizza lo status del pagamento.
- ` + '`!locanda paga <tipologia> <mensile/trimestrale/semestrale>`' + ` Paga l'affitto alla locanda (2 mo per la Tessera + il costo della stanza, variabile in base al pagamento scelto).
- ` + '`!locanda lista`' + ` Visualizza le tipologie di pagamento e la lista delle locande.

### Mondo
- ` + '`!edifici <ora>`' + ` Visualizza gli orari di apertura e di lavoro degli edifici.
- ` + '`!pdi`' + ` (sul nuovo bot: ` + '`/pdi`' + `) Visualizza la lista dei Punti di Interesse.
- ` + '`!itinerario <PDI> <PDI>`' + ` (sul nuovo bot: ` + '`/itinerario`' + `) Visualizza i tempi di percorrenza tra 2 PDI.
- ` + '`!bollettino <PDI>`' + ` (sul nuovo bot: ` + '`/bollettino`' + `) Visualizza il meteo di un PDI.
- ` + '`!necrologio`' + ` (sul nuovo bot: ` + '`/necrologio`' + `) Visualizza i necrologi.

### Personaggio
- ` + '`!aiuto tessera`' + ` Visualizza la lista dei comandi per la tessera avventuriero.
- ` + '`!tessera`' + ` Visualizza la tua tessera avventuriero.
- ` + '`!tessera lavoro <nome lavoro>`' + ` Aggiunge il lavoro del PG alla tessera.
- ` + '`!tessera mestiere <nome mestiere> <livello mestiere>`' + ` Aggiunge il mestiere del PG con il relativo livello.
Mestieri validi: Alchimista, Architetto, Artigiano, Artista, Falegname, Meccanico, Metallurgo, Oste, Sarto.`,
  },
  pg: {
    titolo: '🧙 Creazione & Gestione PG',
    testo: `### Importare la scheda
- ` + '`!import [link scheda]`' + ` Importa il tuo PG dal link.
- ` + '`!update`' + ` Aggiorna la scheda dopo eventuali modifiche.
- ` + '`!char server ' + "'Nome del PG'" + '`' + ` Imposta un PG come PG del server.

### Gestione zaino
- ` + '`!bag create ' + "'nome bag'" + '`' + ` Crea uno zaino.
- ` + '`!bag pack ' + "'Explorer's Pack'" + '`' + ` Aggiunge un pack specifico (usa ` + '`!pacchetto`' + ` per aggiornare con i pacchetti del 2024).
- ` + '`!bag ' + "'nome'" + ` +/-[qtà] ` + "'Oggetto'" + '`' + ` Aggiunge a una borsa una quantità specifica di un oggetto.

### Gestione monete
- ` + '`!g coin +/-[quantità] [tipo]`' + ` Aggiunge o rimuove monete dalla coinpurse.
Tipi: pp, gp, ep, sp, cp. Esempio: ` + '`!g coin +120 gp`' + `.

### Esperienza
- ` + '`!xp +/-[quantità] ["Descrizione"]`' + ` Aggiunge o rimuove XP, con descrizione facoltativa.

### Riposi
- ` + '`!g lr`' + ` Riposo lungo.
- ` + '`!g sr`' + ` Riposo breve.

### Custom Counter
- ` + '`!cc create ' + "'Nome'" + ' -reset <long/short> -min <n> -max <n>' + '`' + ` Crea un counter.

Argomenti validi:
- ` + '`-name <name>`' + ` Rinomina il counter.
- ` + '`-title <"title">`' + ` Imposta un titolo; [name] viene rimpiazzato col nome del player.
- ` + '`-desc <"desc">`' + ` Imposta la descrizione.
- ` + '`-reset <short|long|none>`' + ` Imposta quando si resetta; senza opzione, si resetta solo con ` + '`!cc reset`' + `.
- ` + '`-max <max value>`' + ` Imposta il valore massimo.
- ` + '`-min <min value>`' + ` Imposta il valore minimo.
- ` + '`-type <bubble|square|hex|star|default>`' + ` Mostra bolle, quadrati, esagoni, stelle o numeri.
- ` + '`-resetto <value>`' + ` Imposta il valore di reset (predefinito: massimo).
- ` + '`-resetby <value>`' + ` Invece di impostare un valore, aggiunge/rimuove questo numero al reset.`,
  },
  combat: {
    titolo: '⚔️ Abilità & Combattimento',
    testo: `### Check abilità
- ` + '`!c [abilità]`' + ` in inglese (esempio: ` + '`!c perception`' + `).
In italiano: ` + '`!forza`' + `, ` + '`!destrezza`' + `, ` + '`!costituzione`' + `, ` + '`!intelligenza`' + `, ` + '`!saggezza`' + `, ` + '`!carisma`' + `.

### Tiro salvezza
- ` + '`!s [stat]`' + ` in inglese. Non esiste una versione italiana.
Tipi: ` + '`str`' + `, ` + '`dex`' + `, ` + '`con`' + `, ` + '`int`' + `, ` + '`wis`' + `, ` + '`cha`' + `.

### Attacchi
- ` + '`!a ' + "'nome'" + ' -t ' + "'bersaglio'" + '`' + `

### Spell
- ` + '`!cast ' + "'nome spell'" + ' -t ' + "'bersaglio'" + '`' + `

### Modificatori per attacchi e spell
- ` + '`-adv`' + ` Vantaggio.
- ` + '`-dis`' + ` Svantaggio.
- ` + '`-d [dado]`' + ` Dadi extra.
- ` + '`-b [dado]`' + ` Bonus danni.
- ` + '`-t [target]`' + ` Colpisce uno specifico bersaglio.
- ` + '`-rr [numero]`' + ` Numero di attacchi uguali nello stesso turno.

### Iniziativa
- ` + '`!init join`' + ` Tira iniziativa.
- ` + '`!init join -adv`' + ` Tira iniziativa con vantaggio.
- ` + '`!init join -p [x]`' + ` Entra in iniziativa con un valore già tirato.
- ` + '`!init next`' + ` (oppure ` + '`!i n`' + `) Passa al prossimo turno.`,
  },
  downtime: {
    titolo: '📖 Guida Downtime',
    testo: `Gestisci i tuoi downtime con i seguenti comandi.

### Avvia
- ` + '`!downtime <tipo> start <totale> [descrizione]`' + `

### Registra sessione
- ` + '`!downtime <tipo> log <progresso> <ora_inizio> <ora_fine> <link>`' + ` Il link è obbligatorio.

### Stato
- ` + '`!downtime <tipo> status`' + ` Visualizza lo stato di un downtime specifico attivo del tuo PG.
- ` + '`!downtime status`' + ` Visualizza lo stato di tutti i downtime attivi del tuo PG.

### Cambia descrizione
- ` + '`!downtime <tipo> label <testo>`' + `

### Azzera
- ` + '`!downtime <tipo> reset`' + `

Tipi disponibili: Crafting, Lettura, Altro.
Esempio: ` + '`!downtime lettura log 2 6 14 https://discord.com/...`' + `.`,
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
    components: [
      { type: 1, components: [
        { type: 2, style: 1, label: 'HOMEBREW', custom_id: 'avrae|cat|homebrew' },
        { type: 2, style: 1, label: 'PG', custom_id: 'avrae|cat|pg' },
        { type: 2, style: 1, label: 'COMBAT', custom_id: 'avrae|cat|combat' },
        { type: 2, style: 1, label: 'DOWNTIME', custom_id: 'avrae|cat|downtime' },
      ] },
    ],
  };
}

export default {
  descrizione: 'Pubblica il pannello con le liste dei comandi Avrae',
  opzioni: [],

  async run(_opzioni, ctx = {}) {
    const token = ctx.env?.DISCORD_TOKEN;
    if (!token) return errore('Configurazione mancante: il Worker deve avere il segreto DISCORD_TOKEN.');
    const r = await fetch(`${API}/channels/${CANALE}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...pannello(), allowed_mentions: { parse: [] } }),
    });
    if (!r.ok) {
      console.error('Pubblicazione pannello Avrae fallita:', r.status, await r.text());
      return errore(r.status === 403 || r.status === 404
        ? 'Non riesco a pubblicare nel canale configurato. Verifica che il bot possa visualizzare il canale e inviare messaggi.'
        : `Discord ha risposto con errore ${r.status} durante la pubblicazione.`);
    }
    return { content: '✅ Pannello dei comandi Avrae pubblicato nel canale <#' + CANALE + '>.', flags: 64 };
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
