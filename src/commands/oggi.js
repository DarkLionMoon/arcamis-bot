// /oggi: una sola schermata con giorno, stagione, luna e meteo di Arcamis (dal bollettino) + sessioni For Fun in arrivo.
// Il meteo è esattamente quello di /bollettino, che resta com'è.
import bollettino from './bollettino.js';
import { sessioniInArrivo } from './forfun.js';

const riga = (s, i, env) =>
  `<t:${s.t}:t> · **${s.titolo}** · ✅ ${s.presenti}${s.max ? `/${s.max}` : ''}${s.iniziata ? ' · ▶️ in corso' : ''} · ` +
  `[apri](https://discord.com/channels/${i?.guild_id}/${env.FORFUN_CANALE}/${s.id})`;

async function costruisci(ctx = {}) {
  const e = bollettino.run({}, ctx).embeds[0];
  const campi = [...e.fields];
  const lista = await sessioniInArrivo(ctx.env, ctx.ora ? ctx.ora * 86400000 : Date.now());
  if (lista) {
    const oggi = lista.filter((s) => s.oggi);
    const prossime = lista.filter((s) => !s.oggi).slice(0, 3);
    campi.push({
      name: '🎲 Sessioni For Fun di oggi',
      value: (oggi.length ? oggi.map((s) => riga(s, ctx.i, ctx.env)).join('\n') : '*Nessuna sessione in programma.*').slice(0, 1024),
      inline: false,
    });
    if (prossime.length) {
      campi.push({ name: '📆 Prossime sessioni', value: prossime.map((s) => riga(s, ctx.i, ctx.env)).join('\n').slice(0, 1024), inline: false });
    }
  }
  return {
    embeds: [{ ...e, title: '🗓️ Oggi ad Arcamis', description: `**${e.title}**\n${e.description}`, fields: campi }],
    components: [{ type: 1, components: [{ type: 2, style: 2, label: '🔄 Aggiorna', custom_id: 'og|r' }] }],
  };
}

export default {
  descrizione: 'Oggi ad Arcamis: giorno, stagione, luna, meteo e sessioni For Fun in arrivo',
  opzioni: [],
  run: (_opzioni, ctx = {}) => costruisci(ctx),
  componente: (id, _valori, ctx = {}) => (String(id) === 'og|r' ? costruisci(ctx) : null),
};
