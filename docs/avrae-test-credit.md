# Test accredito Avrae per Arcamis

Alias temporaneo di prova. Accredita **esattamente 1 MO** al personaggio Avrae attivo.

## Installazione

Da un account autorizzato a creare alias server, eseguire in Discord:

```text
!servalias arcamiscredit <drac2>
ruoli = ctx.author.get_roles()
autorizzato = False
for ruolo in ruoli:
    if ruolo.name.lower() == "capo-staff":
        autorizzato = True
        break

if not autorizzato:
    err("Comando riservato al ruolo Capo-Staff.")

ch = character()
if ch.owner != ctx.author.id:
    err("Il personaggio attivo non risulta di tua proprietà. Seleziona un tuo PG con !char.")

prima = str(ch.coinpurse)
ch.coinpurse.modify_coins(gp=1)
dopo = str(ch.coinpurse)

return f"🧪 Accredito di prova completato.\n**Personaggio:** {ch.name}\n**Accreditato:** +1 MO\n**Prima:** {prima}\n**Dopo:** {dopo}"
</drac2>
```

## Prova

1. Usa `/test-avrae-credit` su Arcamis: il comando è riservato al ruolo Capo-Staff.
2. In Avrae seleziona il personaggio da testare: `!char "Nome PG"`.
3. Controlla il nome del personaggio attivo.
4. Esegui `!arcamiscredit`.
5. Verifica che il portamonete sia aumentato di 1 MO.

L'alias controlla nuovamente il ruolo Capo-Staff e che il personaggio attivo appartenga all'utente che esegue il comando.

**Nota:** questo è un test manuale del passaggio Arcamis → istruzione → Avrae. Arcamis non può invocare direttamente un altro bot; il giocatore esegue l'alias Avrae. Non modifica il comando stipendio e non registra pagamenti reali.
