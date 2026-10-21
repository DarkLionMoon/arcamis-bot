# Arcamis Bot

Bot Discord con comandi personalizzati. I contenuti vivono nei file JSON in `data/`: per cambiare un testo basta modificare il file e fare commit su GitHub, Render ridistribuisce da solo.

## Comandi inclusi

- `!aiuto`: elenco generato automaticamente
- `!locanda [città]`: locande raggruppate per città (`data/locande.json`)
- `!itinerario "<da>" "<a>" [mezzo]`: percorso più breve e tempo di viaggio (`data/mappa.json`)
- `!regole`, `!benvenuto`: esempi di comandi semplici (`data/comandi.json`)

## Aggiungere un comando semplice (zero codice)

In `data/comandi.json` aggiungi una voce:

```json
"nomecomando": {
  "alias": ["altronome"],
  "descrizione": "Compare in !aiuto",
  "embed": { "titolo": "...", "descrizione": "...", "colore": "#c9a227", "campi": [{ "nome": "...", "valore": "..." }] }
}
```

## Aggiungere un comando con logica

Crea `handlers/mio.js` con `descrizione`, `uso` e `run(args, msg)` che restituisce `{ embeds: [...] }`, poi registralo nell'oggetto `gestori` in `index.js`.

## Messa online

1. Su https://discord.com/developers/applications crea l'applicazione, poi Bot, copia il token.
2. Nella stessa pagina Bot attiva **Message Content Intent** (obbligatorio per i comandi con `!`).
3. Invita il bot nel server con OAuth2, scope `bot`, permessi: Read Messages, Send Messages, Embed Links.
4. Carica questa cartella su un repository GitHub. Il token non va mai nel codice.
5. Su Render: New, Web Service, collega il repo. Build Command `npm install`, Start Command `node index.js`, piano Free.
6. In Environment aggiungi `DISCORD_TOKEN` con il token.
7. Su UptimeRobot crea un monitor HTTP verso l'URL di Render con intervallo 5 minuti.

## Prova locale

```
npm install
DISCORD_TOKEN=... node index.js
npm test        # test offline, senza token
```
