// /oggi: una sola schermata con giorno, stagione, luna e meteo di Arcamis (dal bollettino) + sessioni For Fun in arrivo.
// Il meteo è esattamente quello di /bollettino, che resta com'è.
import bollettino from './bollettino.js';
import { giornoArcamis } from '../util.js';
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
    
components: [
  {
    type: 1,
    components: [
      { type: 2, style: 2, label: '🔄 Aggiorna', custom_id: 'og|r' },
      { type: 2, style: 2, label: '💨 Vento', custom_id: 'ogm|vento' },
      { type: 2, style: 2, label: '🌫️ Atmosfera', custom_id: 'ogm|atmosfera' },
    ],
  },
  {
    type: 1,
    components: [
      { type: 2, style: 2, label: '🌙 Sole / Luna', custom_id: 'ogm|soleluna' },
      { type: 2, style: 2, label: '⚠️ Allerte', custom_id: 'ogm|allerte' },
      { type: 2, style: 2, label: '🌦️ Tutti i dettagli', custom_id: 'ogm|dettagli' },
    ],
  },
],

  };
}

export default {
  descrizione: 'Oggi ad Arcamis: giorno, stagione, luna, meteo e sessioni For Fun in arrivo',
  opzioni: [],
  run: (_opzioni, ctx = {}) => costruisci(ctx),

async componente(id, _valori, ctx = {}) {
  const [tipo, azione] = String(id).split('|');

  if (tipo !== 'og' && tipo !== 'ogm') return null;

  if (tipo === 'og' && azione === 'r') {
    return costruisci(ctx);
  }

  if (tipo === 'ogm') {
    const sezioni = [
      'vento',
      'atmosfera',
      'soleluna',
      'allerte',
      'dettagli',
    ];

    if (!sezioni.includes(azione)) return null;

    const g = giornoArcamis(ctx);
    const dettaglio = bollettino.componente(
      `bmd|arcamis|${g}|${azione}`,
      [],
      ctx
    );

    if (!dettaglio || !dettaglio.embeds?.[0]) {
      return {
        content: 'Non riesco a generare i dettagli meteo simulati.',
        flags: 64,
      };
    }

    const riepilogo = await costruisci(ctx);
    const campiForFun = (riepilogo.embeds[0].fields || [])
      .filter((f) =>
        f.name.startsWith('🎲') ||
        f.name.startsWith('📆')
      );

    return {
      embeds: [{
        ...dettaglio.embeds[0],
        fields: campiForFun,
      }],
      components: [
        {
          type: 1,
          components: [{
            type: 2,
            style: 2,
            label: '↩ Torna a Oggi',
            custom_id: 'og|r',
          }],
        },
      ],
    };
  }

  return null;
},

};
