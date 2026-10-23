import { verifyKey } from 'discord-interactions';
import { esegui, suggerisci, componente, promemoria } from './registry.js';

// Tipi di interazione e di risposta di Discord.
const PING = 1;
const COMANDO = 2;
const COMPONENTE = 3;
const AUTOCOMPLETAMENTO = 4;
const INVIO_MODULO = 5;
const R_PONG = 1;
const R_MESSAGGIO = 4;
const R_AGGIORNA = 7;
const R_SUGGERIMENTI = 8;
const R_MODULO = 9;
const R_CANCELLA_MESSAGGIO = 6;

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });

export default {
  // Cron (vedi [triggers] in wrangler.toml): promemoria delle sessioni For Fun in arrivo.
  async scheduled(_evento, env, ctx) {
    ctx.waitUntil(promemoria(env).catch((err) => console.error('Errore nel promemoria:', err)));
  },

  async fetch(request, env) {
    // Una visita dal browser serve solo a controllare che il Worker sia vivo.
    if (request.method === 'GET') return new Response('Bot attivo');
    if (request.method !== 'POST') return new Response('Metodo non consentito', { status: 405 });

    if (!env.DISCORD_PUBLIC_KEY || env.DISCORD_PUBLIC_KEY.startsWith('INCOLLA')) {
      return new Response('DISCORD_PUBLIC_KEY non configurata', { status: 500 });
    }

    // Discord firma ogni richiesta: senza firma valida si risponde 401 (anche per il suo test iniziale).
    const firma = request.headers.get('x-signature-ed25519');
    const timestamp = request.headers.get('x-signature-timestamp');
    const corpo = await request.text();
    let valida = false;
    try {
      valida = Boolean(firma && timestamp && (await verifyKey(corpo, firma, timestamp, env.DISCORD_PUBLIC_KEY)));
    } catch {
      valida = false;
    }
    if (!valida) return new Response('Firma non valida', { status: 401 });

    let i;
    try {
      i = JSON.parse(corpo);
    } catch {
      return new Response('Richiesta non valida', { status: 400 });
    }

    if (i.type === PING) return json({ type: R_PONG });

    if (i.type === AUTOCOMPLETAMENTO) {
      return json({ type: R_SUGGERIMENTI, data: { choices: suggerisci(i.data.name, i.data.options) } });
    }

   

    // Clic su menu o pulsanti, e invio dei moduli (finestre di testo).
    if (i.type === COMPONENTE || i.type === INVIO_MODULO) {
      const id = String(i.data.custom_id || '');

      if (id.startsWith('bmr|') && (i.message?.flags & 64)) {
        return json({ type: R_CANCELLA_MESSAGGIO });
      }

      let dati = null;

      try {
        const valori = i.type === INVIO_MODULO ? i.data.components : i.data.values;
        dati = await componente(i.data.custom_id, valori, { i, env });
      } catch (err) {
        console.error('Errore nel componente:', err);
      }

      if (!dati) {
        return json({
          type: R_MESSAGGIO,
          data: {
            content: 'Questo messaggio non è più valido: rilancia il comando.',
            flags: 64,
          },
        });
      }

      if (dati.modale) {
        return json({ type: R_MODULO, data: dati.modale });
      }

      const personale =
        id.startsWith('og|') ||
        id.startsWith('ogm|') ||
        id.startsWith('bol|') ||
        id.startsWith('bog|') ||
        id.startsWith('bmd|') ||
        id.startsWith('bmr|') ||
        id.startsWith('itd|') ||
        id.startsWith('ita|') ||
        id.startsWith('itp|');

      const { flags: _flags, ...risposta } = dati;

      // Primo clic dal messaggio pubblico: crea una risposta privata.
      if (personale && !(i.message?.flags & 64)) {
        return json({
          type: R_MESSAGGIO,
          data: {
            ...risposta,
            flags: 64,
            allowed_mentions: { parse: [] },
          },
        });
      }

      // Se il messaggio è già privato, aggiorna soltanto quello.
      if (personale && (i.message?.flags & 64)) {
        return json({
          type: R_AGGIORNA,
          data: {
            ...risposta,
            allowed_mentions: { parse: [] },
          },
        });
      }

      // Comportamento originale per gli altri componenti.
      if (dati.flags === 64) {
        return json({
          type: R_MESSAGGIO,
          data: {
            ...dati,
            allowed_mentions: { parse: [] },
          },
        });
      }

      return json({
        type: R_AGGIORNA,
        data: {
          ...risposta,
          allowed_mentions: { parse: [] },
        },
      });
    }

      
    if (i.type === COMANDO) {
      let dati;
      try {
        dati = await esegui(i.data.name, i.data.options, { i, env });
      } catch (err) {
        console.error(`Errore nel comando ${i.data.name}:`, err);
        dati = {
          embeds: [{
            title: 'Errore',
            description: 'Qualcosa è andato storto nel comando.',
            color: 0xb3261e,
          }],
          flags: 64,
        };
      }

      // Niente menzioni a catena dai testi dei comandi.
      return json({
        type: R_MESSAGGIO,
        data: { ...dati, allowed_mentions: { parse: [] } },
      });
    }

    return new Response('Tipo di interazione non gestito', { status: 400 });
  },
};
