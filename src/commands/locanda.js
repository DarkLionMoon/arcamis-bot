import locande from '../../data/locande.json' with { type: 'json' };
import { embed, errore, trovaNome, suggerimenti } from '../util.js';

const citta = Object.keys(locande);

export default {
  descrizione: 'Elenco delle locande, raggruppate per città',
  opzioni: [
    {
      name: 'citta',
      description: 'Mostra solo questa città (lascia vuoto per vederle tutte)',
      type: 3,
      required: false,
      autocomplete: true,
    },
  ],

  autocomplete(opzione, valore) {
    return opzione === 'citta' ? suggerimenti(citta, valore) : [];
  },

  run({ citta: richiesta }) {
    if (!richiesta) {
      return {
        embeds: [
          embed({
            titolo: 'Locande',
            descrizione: 'Usa `/locanda citta:<nome>` per vedere una sola città.',
            campi: citta.map((c) => ({
              nome: c,
              valore:
                locande[c].map((l) => `**${l.nome}**, ${l.prezzo_mo} mo/mese\n${l.note || ''}`.trim()).join('\n\n') ||
                'Nessuna locanda.',
            })),
          }),
        ],
      };
    }

    const { nome, ambigui } = trovaNome(citta, richiesta);
    if (!nome) {
      const suggerimento = ambigui.length ? ambigui.join(', ') : citta.join(', ');
      return errore(`Città non trovata. Prova con: ${suggerimento}.`);
    }
    return {
      embeds: [
        embed({
          titolo: `Locande di ${nome}`,
          campi: locande[nome].map((l) => ({
            nome: l.nome,
            valore: `${l.prezzo_mo} mo/mese\n${l.note || ''}`.trim(),
            inline: true,
          })),
        }),
      ],
    };
  },
};
