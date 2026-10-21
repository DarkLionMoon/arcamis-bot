import { verifyKey } from 'discord-interactions';
import { esegui, suggerisci } from './registry.js';
import itinerario from './commands/itinerario.js';

// Tipi di interazione e di risposta di Discord.
const PING = 1;
const COMANDO = 2;
const COMPONENTE = 3;
const AUTOCOMPLETAMENTO = 4;
const R_PONG = 1;
const R_MESSAGGIO = 4;
const R_AGGIORNA = 7;
const R_SUGGERIMENTI = 8;

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });

export default {
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

    // Clic su menu a tendina o pulsanti del messaggio di /itinerario.
    if (i.type === COMPONENTE) {
      let dati = null;
      try {
        dati = itinerario.componente(i.data.custom_id, i.data.values);
      } catch (err) {
        console.error('Errore nel componente:', err);
      }
      if (!dati) {
        return json({ type: R_MESSAGGIO, data: { content: 'Questo messaggio non è più valido: rilancia il comando.', flags: 64 } });
      }
      // Errore: risposta privata. Altrimenti si aggiorna il messaggio esistente.
      if (dati.flags === 64) return json({ type: R_MESSAGGIO, data: dati });
      return json({ type: R_AGGIORNA, data: { ...dati, allowed_mentions: { parse: [] } } });
    }

    if (i.type === COMANDO) {
      let dati;
      try {
        dati = esegui(i.data.name, i.data.options);
      } catch (err) {
        console.error(`Errore nel comando ${i.data.name}:`, err);
        dati = {
          embeds: [{ title: 'Errore', description: 'Qualcosa è andato storto nel comando.', color: 0xb3261e }],
          flags: 64,
        };
      }
      // Niente menzioni a catena dai testi dei comandi.
      return json({ type: R_MESSAGGIO, data: { ...dati, allowed_mentions: { parse: [] } } });
    }

    return new Response('Tipo di interazione non gestito', { status: 400 });
  },
};
