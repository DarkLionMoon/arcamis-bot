import { verifyKey } from 'discord-interactions';
import {
  esegui,
  suggerisci,
  componente,
  promemoria,
} from './registry.js';

// Tipi di interazione Discord.
const PING = 1;
const COMANDO = 2;
const COMPONENTE = 3;
const AUTOCOMPLETAMENTO = 4;
const INVIO_MODULO = 5;

// Tipi di risposta Discord.
const R_PONG = 1;
const R_MESSAGGIO = 4;
const R_CANCELLA_MESSAGGIO = 6;
const R_AGGIORNA = 7;
const R_SUGGERIMENTI = 8;
const R_MODULO = 9;

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export default {
  // Promemoria automatici configurati in wrangler.toml.
  async scheduled(_evento, env, ctx) {
    ctx.waitUntil(
      promemoria(env).catch((err) => {
        console.error('Errore nel promemoria:', err);
      })
    );
  },

  async fetch(request, env, ctx) {
    // Controllo rapido per verificare che il Worker sia attivo.
    if (request.method === 'GET') {
      return new Response('Bot attivo');
    }

    if (request.method !== 'POST') {
      return new Response('Metodo non consentito', { status: 405 });
    }

    if (
      !env.DISCORD_PUBLIC_KEY ||
      env.DISCORD_PUBLIC_KEY.startsWith('INCOLLA')
    ) {
      console.error('DISCORD_PUBLIC_KEY non configurata');

      return new Response('DISCORD_PUBLIC_KEY non configurata', {
        status: 500,
      });
    }

    // Verifica della firma della richiesta Discord.
    const firma = request.headers.get('x-signature-ed25519');
    const timestamp = request.headers.get('x-signature-timestamp');
    const corpo = await request.text();

    let valida = false;

    try {
      valida = Boolean(
        firma &&
          timestamp &&
          (await verifyKey(
            corpo,
            firma,
            timestamp,
            env.DISCORD_PUBLIC_KEY
          ))
      );
    } catch (err) {
      console.error('Errore verifica firma:', err);
    }

    if (!valida) {
      return new Response('Firma non valida', { status: 401 });
    }

    let i;

    try {
      i = JSON.parse(corpo);
    } catch {
      return new Response('Richiesta non valida', { status: 400 });
    }

    // Discord verifica l'endpoint tramite PING.
    if (i.type === PING) {
      return json({ type: R_PONG });
    }

    // Autocompletamento dei comandi.
    if (i.type === AUTOCOMPLETAMENTO) {
      try {
        return json({
          type: R_SUGGERIMENTI,
          data: {
            choices: suggerisci(i.data.name, i.data.options),
          },
        });
      } catch (err) {
        console.error('Errore autocompletamento:', err);

        return json({
          type: R_SUGGERIMENTI,
          data: { choices: [] },
        });
      }
    }

    // Pulsanti, menu a tendina e modali.
    if (i.type === COMPONENTE || i.type === INVIO_MODULO) {
      const id = String(i.data?.custom_id || '');

      // Pulsante "Menu principale" su un messaggio privato: lo elimina.
      if (id === 'menu|home' && (i.message?.flags & 64)) {
        if (!i.message?.id || !i.application_id || !i.token) {
          console.error('Eliminazione impossibile: dati del messaggio mancanti');
          return json({ type: R_CANCELLA_MESSAGGIO });
        }

        const url =
          `https://discord.com/api/v10/webhooks/${i.application_id}` +
          `/${i.token}/messages/${i.message.id}`;

        // In background, dopo che Discord ha ricevuto la conferma del clic.
        ctx.waitUntil(
          (async () => {
            try {
              await new Promise((r) => setTimeout(r, 700));
              const risposta = await fetch(url, { method: 'DELETE' });
              if (!risposta.ok) {
                console.error('Eliminazione fallita:', risposta.status, await risposta.text());
              }
            } catch (err) {
              console.error('Errore eliminazione:', err);
            }
          })()
        );

        // Conferma il clic senza modificare il messaggio.
        return json({ type: R_CANCELLA_MESSAGGIO });
      }

      let dati = null;

      try {
        const valori =
          i.type === INVIO_MODULO
            ? i.data.components
            : i.data.values;

        dati = await componente(i.data.custom_id, valori, { i, env });
      } catch (err) {
        console.error('Errore nel componente:', err);
      }

      if (!dati) {
        return json({
          type: R_MESSAGGIO,
          data: {
            content:
              'Questo messaggio non è più valido: rilancia il comando.',
            flags: 64,
          },
        });
      }

      // Apertura di un modale.
      if (dati.modale) {
        return json({
          type: R_MODULO,
          data: dati.modale,
        });
      }

      // Componenti che devono avere una risposta personale.
      const personale =
        id.startsWith('og|') ||
        id.startsWith('ogm|') ||
        id.startsWith('bol|') ||
        id.startsWith('bog|') ||
        id.startsWith('bmd|') ||
        id.startsWith('bmr|') ||
        id.startsWith('itd|') ||
        id.startsWith('ita|') ||
        id.startsWith('itp|') ||
        id.startsWith('avrae|');

      const { flags: _flags, ...risposta } = dati;

      // Primo clic su un messaggio pubblico: crea una risposta effimera.
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

      // Clic su un messaggio già effimero: aggiorna la risposta privata.
      if (personale && (i.message?.flags & 64)) {
        return json({
          type: R_AGGIORNA,
          data: {
            ...risposta,
            allowed_mentions: { parse: [] },
          },
        });
      }

      // Risposta effimera richiesta dal componente.
      if (dati.flags === 64) {
        return json({
          type: R_MESSAGGIO,
          data: {
            ...dati,
            allowed_mentions: { parse: [] },
          },
        });
      }

      // Comportamento predefinito: aggiorna il messaggio del componente.
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
        console.error(
          `Errore nel comando ${i.data.name}:`,
          err
        );

        dati = {
          embeds: [
            {
              title: 'Errore',
              description:
                'Qualcosa è andato storto nel comando.',
              color: 0xb3261e,
            },
          ],
          flags: 64,
        };
      }

      return json({
        type: R_MESSAGGIO,
        data: {
          ...dati,
          allowed_mentions: { parse: [] },
        },
      });
    }

       return new Response('Tipo di interazione non gestito', {
      status: 400,
    });
  },
};
