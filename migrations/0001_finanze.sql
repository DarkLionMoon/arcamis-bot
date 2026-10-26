CREATE TABLE IF NOT EXISTS finanze_gilde (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  discord_guild_id TEXT NOT NULL,
  nome TEXT NOT NULL,
  ruolo_id TEXT NOT NULL,
  creato_da TEXT NOT NULL,
  creato_il TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(discord_guild_id, nome)
);

CREATE TABLE IF NOT EXISTS finanze_movimenti (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gilda_id INTEGER NOT NULL,
  tipo TEXT NOT NULL CHECK (
    tipo IN ('entrata', 'uscita')
  ),
  moneta TEXT NOT NULL CHECK (
    moneta IN ('PP', 'GP', 'EP', 'SP', 'CP')
  ),
  quantita INTEGER NOT NULL CHECK (quantita > 0),
  valore_cp INTEGER NOT NULL CHECK (valore_cp > 0),
  motivo TEXT NOT NULL,
  autore_id TEXT NOT NULL,
  creato_il TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (gilda_id)
    REFERENCES finanze_gilde(id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_finanze_movimenti_gilda
ON finanze_movimenti(gilda_id, id);
