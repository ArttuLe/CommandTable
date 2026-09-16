// Scryfall bulk ingestion, per design doc §5.2. Run via `npm run ingest --workspace server`,
// and thereafter as a weekly job. Stream-parses the gzip'd JSONL bulk file line by line so the
// process never holds the whole file in memory (§5.2's "do not JSON.parse the whole file").

import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';
import Database from 'better-sqlite3';
import { CardIndex } from './cardIndex.js';
import { mapScryfallCard } from './scryfallMapper.js';

const USER_AGENT = 'CommandTable/0.1 (private hobby project)';
const BULK_DATA_URL = 'https://api.scryfall.com/bulk-data';
const DB_PATH = process.env.CARD_DB_PATH ?? './data/cards.sqlite3';

interface BulkDataEntry {
  type: string;
  updated_at: string;
  jsonl_download_uri: string;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Scryfall request failed: ${res.status} ${res.statusText} (${url})`);
  }
  return (await res.json()) as T;
}

async function findBulkEntry(type: string): Promise<BulkDataEntry> {
  const list = await fetchJson<{ data: BulkDataEntry[] }>(BULK_DATA_URL);
  const entry = list.data.find((e) => e.type === type);
  if (!entry) {
    throw new Error(`No bulk-data entry of type "${type}"`);
  }
  return entry;
}

async function ingest(): Promise<void> {
  const entry = await findBulkEntry('oracle_cards');
  console.log(`Fetching ${entry.type} updated ${entry.updated_at}`);

  const res = await fetch(entry.jsonl_download_uri, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download bulk file: ${res.status} ${res.statusText}`);
  }

  const db = new Database(DB_PATH);
  const index = new CardIndex(db);
  const insertMany = db.transaction((cards: unknown[]) => {
    for (const raw of cards) {
      index.upsert(mapScryfallCard(raw as Parameters<typeof mapScryfallCard>[0]));
    }
  });

  const gunzip = createGunzip();
  Readable.fromWeb(res.body as import('stream/web').ReadableStream).pipe(gunzip);
  const lines = createInterface({ input: gunzip });

  let count = 0;
  let batch: unknown[] = [];
  const BATCH_SIZE = 1000;

  for await (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '') {
      continue;
    }
    batch.push(JSON.parse(trimmed));
    count++;
    if (batch.length >= BATCH_SIZE) {
      insertMany(batch);
      batch = [];
    }
  }
  if (batch.length > 0) {
    insertMany(batch);
  }

  index.close();
  console.log(`Ingested ${count} cards into ${DB_PATH}`);
}

ingest().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
