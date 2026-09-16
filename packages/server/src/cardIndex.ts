// Card reference index, per design doc §5.2. Persisted on disk (not user state — see §4's
// clarification), with the game process holding only what a given game touches in RAM (§5.2.3,
// handled by the OS page cache / SQLite itself rather than a bespoke LRU for now).

import type Database from 'better-sqlite3';
import type { Card, CardFace } from '@command-table/common';

interface CardRow {
  oracle_id: string;
  scryfall_id: string;
  name: string;
  mana_cost: string | null;
  cmc: number;
  type_line: string;
  oracle_text: string | null;
  power: string | null;
  toughness: string | null;
  loyalty: string | null;
  defense: string | null;
  colors: string;
  color_identity: string;
  layout: string;
  card_faces: string | null;
  image_uris: string | null;
  set_code: string;
  collector_number: string;
}

export class CardIndex {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cards (
        scryfall_id TEXT PRIMARY KEY,
        oracle_id TEXT NOT NULL,
        name TEXT NOT NULL,
        name_lower TEXT NOT NULL,
        mana_cost TEXT,
        cmc REAL NOT NULL,
        type_line TEXT NOT NULL,
        oracle_text TEXT,
        power TEXT,
        toughness TEXT,
        loyalty TEXT,
        defense TEXT,
        colors TEXT NOT NULL,
        color_identity TEXT NOT NULL,
        layout TEXT NOT NULL,
        card_faces TEXT,
        image_uris TEXT,
        set_code TEXT NOT NULL,
        collector_number TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_cards_name_lower ON cards(name_lower);
      CREATE INDEX IF NOT EXISTS idx_cards_set_collector ON cards(set_code, collector_number);

      CREATE TABLE IF NOT EXISTS card_face_aliases (
        name_lower TEXT NOT NULL,
        scryfall_id TEXT NOT NULL,
        PRIMARY KEY (name_lower, scryfall_id)
      );
    `);
  }

  upsert(card: Card): void {
    this.db
      .prepare(
        `INSERT INTO cards (
          scryfall_id, oracle_id, name, name_lower, mana_cost, cmc, type_line, oracle_text,
          power, toughness, loyalty, defense, colors, color_identity, layout, card_faces,
          image_uris, set_code, collector_number
        ) VALUES (
          @scryfall_id, @oracle_id, @name, @name_lower, @mana_cost, @cmc, @type_line, @oracle_text,
          @power, @toughness, @loyalty, @defense, @colors, @color_identity, @layout, @card_faces,
          @image_uris, @set_code, @collector_number
        )
        ON CONFLICT(scryfall_id) DO UPDATE SET
          oracle_id = excluded.oracle_id,
          name = excluded.name,
          name_lower = excluded.name_lower,
          mana_cost = excluded.mana_cost,
          cmc = excluded.cmc,
          type_line = excluded.type_line,
          oracle_text = excluded.oracle_text,
          power = excluded.power,
          toughness = excluded.toughness,
          loyalty = excluded.loyalty,
          defense = excluded.defense,
          colors = excluded.colors,
          color_identity = excluded.color_identity,
          layout = excluded.layout,
          card_faces = excluded.card_faces,
          image_uris = excluded.image_uris,
          set_code = excluded.set_code,
          collector_number = excluded.collector_number`
      )
      .run(toRow(card));

    this.db.prepare('DELETE FROM card_face_aliases WHERE scryfall_id = ?').run(card.scryfallId);
    if (card.cardFaces) {
      const insertAlias = this.db.prepare(
        'INSERT OR IGNORE INTO card_face_aliases (name_lower, scryfall_id) VALUES (?, ?)'
      );
      for (const face of card.cardFaces) {
        insertAlias.run(face.name.toLowerCase(), card.scryfallId);
      }
    }
  }

  findByName(name: string): Card | undefined {
    const nameLower = name.toLowerCase();
    const row = this.db
      .prepare<[string], CardRow>('SELECT * FROM cards WHERE name_lower = ? LIMIT 1')
      .get(nameLower);
    if (row) {
      return fromRow(row);
    }

    const aliased = this.db
      .prepare<
        [string],
        CardRow
      >('SELECT cards.* FROM cards JOIN card_face_aliases ON cards.scryfall_id = card_face_aliases.scryfall_id WHERE card_face_aliases.name_lower = ? LIMIT 1')
      .get(nameLower);
    return aliased ? fromRow(aliased) : undefined;
  }

  findByPrinting(name: string, set: string, collectorNumber: string): Card | undefined {
    const row = this.db
      .prepare<[string, string, string], CardRow>(
        'SELECT * FROM cards WHERE name_lower = ? AND set_code = ? AND collector_number = ? LIMIT 1'
      )
      .get(name.toLowerCase(), set.toLowerCase(), collectorNumber);
    if (row) {
      return fromRow(row);
    }
    return this.findByName(name);
  }

  findByScryfallId(scryfallId: string): Card | undefined {
    const row = this.db.prepare<[string], CardRow>('SELECT * FROM cards WHERE scryfall_id = ? LIMIT 1').get(scryfallId);
    return row ? fromRow(row) : undefined;
  }

  suggestNames(query: string, limit: number): string[] {
    const rows = this.db.prepare<[], { name: string }>('SELECT DISTINCT name FROM cards').all();
    const q = query.toLowerCase();
    return rows
      .map((r) => ({ name: r.name, distance: levenshtein(q, r.name.toLowerCase()) }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit)
      .map((r) => r.name);
  }

  close(): void {
    this.db.close();
  }
}

function toRow(card: Card): CardRow & { name_lower: string; set_code: string } {
  return {
    scryfall_id: card.scryfallId,
    oracle_id: card.oracleId,
    name: card.name,
    name_lower: card.name.toLowerCase(),
    mana_cost: card.manaCost,
    cmc: card.cmc,
    type_line: card.typeLine,
    oracle_text: card.oracleText,
    power: card.power,
    toughness: card.toughness,
    loyalty: card.loyalty,
    defense: card.defense,
    colors: JSON.stringify(card.colors),
    color_identity: JSON.stringify(card.colorIdentity),
    layout: card.layout,
    card_faces: card.cardFaces ? JSON.stringify(card.cardFaces) : null,
    image_uris: card.imageUris ? JSON.stringify(card.imageUris) : null,
    set_code: card.set.toLowerCase(),
    collector_number: card.collectorNumber,
  };
}

function fromRow(row: CardRow): Card {
  return {
    oracleId: row.oracle_id,
    scryfallId: row.scryfall_id,
    name: row.name,
    manaCost: row.mana_cost,
    cmc: row.cmc,
    typeLine: row.type_line,
    oracleText: row.oracle_text,
    power: row.power,
    toughness: row.toughness,
    loyalty: row.loyalty,
    defense: row.defense,
    colors: JSON.parse(row.colors) as string[],
    colorIdentity: JSON.parse(row.color_identity) as string[],
    layout: row.layout,
    cardFaces: row.card_faces ? (JSON.parse(row.card_faces) as CardFace[]) : null,
    imageUris: row.image_uris ? JSON.parse(row.image_uris) : null,
    set: row.set_code,
    collectorNumber: row.collector_number,
  };
}

function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[a.length][b.length];
}
