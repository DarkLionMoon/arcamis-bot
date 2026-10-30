// Test isolato dell'accredito Avrae: nessuna modifica ai comandi economici esistenti.
import { embed, errore } from '../util.js';

const CAPO_STAFF_ROLE_ID = '1493170263448354867';

function eCapoStaff(i) {
  return (i?.member?.roles ?? []).includes(CAPO_STAFF_ROLE_ID);
}

export default {
  descrizione: 'Prepara un accredito di prova di 1 MO tramite Avrae (solo Capo-Staff)',
  opzioni: [],

  run(_opzioni, ctx = {}) {
    const i = ctx.i;
    if (!i) return errore('Contesto Discord non disponibile.');
    if (!i.guild_id) return errore('Usa questo comando in un server Discord.');
    if (!eCapoStaff(i)) return errore('Comando riservato al ruolo Capo-Staff.');

    return {
      embeds: [
        embed({
          titolo: '🧪 Test integrazione Avrae',
          descrizione: [
            'Arcamis ha autorizzato un test controllato di **+1 MO**.',
            '',
            '**Ora, nel canale in cui usi Avrae:**',
            '1. Seleziona prima il personaggio di prova con `!char "Nome PG"`.',
            '2. Controlla che sia il personaggio corretto.',
            '3. Esegui `!arcamiscredit`.',
            '',
            'L’alias verifica nuovamente il ruolo **Capo-Staff**, controlla che la scheda appartenga a chi esegue il comando e accredita esattamente **1 MO**.',
            '',
            'Questo test non modifica né registra lo stipendio di Arcamis.',
          ].join('\n'),
          colore: '#c9a227',
          footer: 'TEST · Accredito fisso di 1 MO · Personaggio attivo Avrae',
        }),
      ],
      flags: 64,
    };
  },
};
