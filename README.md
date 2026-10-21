# Arcamis Bot su Cloudflare Workers

Bot Discord a **slash command** (`/locanda`, `/itinerario`, `/aiuto`, ...). Non tiene nessuna connessione aperta: Discord chiama il Worker a ogni comando, quindi il piano gratuito basta e non serve nessun trucco per tenerlo sveglio.

Conseguenze da sapere:
- il bot nell'elenco membri risulta **offline**, ma risponde ai comandi;
- i comandi con `!` non esistono: Workers non può ascoltare i messaggi del server;
- non serve il Message Content Intent.

## Messa online

### 1. Applicazione Discord
1. https://discord.com/developers/applications → New Application.
2. In **General Information** copia `APPLICATION ID` e `PUBLIC KEY`.
3. In **Bot** premi Reset Token e copia il token (non metterlo mai nel codice né su GitHub).
4. In **OAuth2 → URL Generator** scegli gli scope `bot` e `applications.commands`, permessi *Send Messages* ed *Embed Links*, apri il link e invita il bot nel server.

### 2. Deploy su Cloudflare
1. In `wrangler.toml` sostituisci `INCOLLA_QUI_LA_PUBLIC_KEY` con la PUBLIC KEY (non è un segreto).
2. `npm install`
3. `npx wrangler login` (una volta sola), poi `npm run deploy`.
4. Wrangler stampa l'URL, tipo `https://arcamis-bot.<tuo-account>.workers.dev`.

In alternativa: carica il progetto su GitHub e in Cloudflare vai su Workers & Pages → Create → Import a repository. Build command vuoto, Deploy command `npx wrangler deploy`.

### 3. Collega Discord al Worker
Nel Developer Portal, **General Information → Interactions Endpoint URL**: incolla l'URL del Worker e salva. Discord invia un test firmato: se salva senza errori, la firma funziona.

### 4. Registra i comandi
Da terminale, nella cartella del progetto:

```
DISCORD_TOKEN=il_token DISCORD_APPLICATION_ID=l_id DISCORD_GUILD_ID=id_del_server npm run register
```

Con `DISCORD_GUILD_ID` (clic destro sul server con la modalità sviluppatore attiva → Copia ID) i comandi compaiono subito. Senza, sono globali e possono volerci fino a circa un'ora.
Su Windows PowerShell: `$env:DISCORD_TOKEN="..."; $env:DISCORD_APPLICATION_ID="..."; npm run register`.

Va rifatto **solo** quando aggiungi, togli o rinomini comandi o le loro opzioni. Modificare i testi nei JSON richiede solo il deploy.

## Modificare i contenuti
- `data/locande.json`: locande per città
- `data/mappa.json`: strade, mezzi, ore di marcia, sconto strade
- `data/comandi.json`: comandi semplici (testo + embed)

Dopo ogni modifica: `npm run deploy` (o commit su GitHub se usi l'integrazione).

## Aggiungere un comando semplice (zero codice)
In `data/comandi.json` (nome in minuscolo, senza spazi né accenti):

```json
"nomecomando": {
  "alias": ["altronome"],
  "descrizione": "Compare in /aiuto e nell'elenco di Discord (max 100 caratteri)",
  "embed": { "titolo": "...", "descrizione": "...", "colore": "#c9a227", "campi": [{ "nome": "...", "valore": "..." }] }
}
```
Poi `npm run deploy` e `npm run register`.

## Aggiungere un comando con logica
Copia `src/commands/locanda.js`, cambia opzioni e `run`, registralo in `gestori` dentro `src/registry.js`, poi deploy e register.

## Prove
- `npm test`: test offline con richieste firmate come quelle di Discord.
- `npm run register:dry`: controlla le definizioni senza inviare nulla.

## Limiti del piano gratuito (da verificare sul sito Cloudflare)
Circa 100.000 richieste al giorno e 10 ms di CPU per richiesta. Per comandi di consultazione come questi è largamente sufficiente. I comandi devono rispondere entro 3 secondi.

## Se qualcosa non va
- *Discord rifiuta l'Interactions Endpoint URL*: controlla che `DISCORD_PUBLIC_KEY` in `wrangler.toml` sia quella dell'applicazione giusta e di aver rifatto il deploy.
- *I comandi non compaiono*: hai invitato il bot con lo scope `applications.commands`? Con `DISCORD_GUILD_ID` il server è quello giusto?
- *"L'applicazione non ha risposto"*: guarda i log con `npx wrangler tail`.
