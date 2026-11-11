// Maps a raw Scryfall bulk-data card object to our display-only Card type.
// Multi-faced layouts (transform/MDFC/flip/split/adventure) put most display fields on
// `card_faces` instead of the top level — we prefer the front face for those, since the client
// shows the front face by default (`currentFace: 0`).

import type { Card, CardFace, ImageUris } from '@command-table/common';

interface RawImageUris {
  normal?: string;
  art_crop?: string;
}

type Opt<T> = T | null | undefined;

interface RawCardFace {
  name: string;
  mana_cost?: Opt<string>;
  type_line?: Opt<string>;
  oracle_text?: Opt<string>;
  power?: Opt<string>;
  toughness?: Opt<string>;
  loyalty?: Opt<string>;
  defense?: Opt<string>;
  image_uris?: RawImageUris;
}

interface RawCard {
  id: string;
  oracle_id: string;
  name: string;
  mana_cost?: Opt<string>;
  cmc: number;
  type_line: string;
  oracle_text?: Opt<string>;
  power?: Opt<string>;
  toughness?: Opt<string>;
  loyalty?: Opt<string>;
  defense?: Opt<string>;
  colors?: string[];
  color_identity: string[];
  layout: string;
  card_faces?: RawCardFace[];
  image_uris?: RawImageUris;
  set: string;
  collector_number: string;
}

export function mapScryfallCard(raw: RawCard): Card {
  const frontFace = raw.card_faces?.[0];

  return {
    oracleId: raw.oracle_id,
    scryfallId: raw.id,
    name: raw.name,
    manaCost: nonEmpty(raw.mana_cost) ?? nonEmpty(frontFace?.mana_cost) ?? null,
    cmc: raw.cmc,
    typeLine: raw.type_line,
    oracleText: nonEmpty(raw.oracle_text) ?? nonEmpty(frontFace?.oracle_text) ?? null,
    power: raw.power ?? frontFace?.power ?? null,
    toughness: raw.toughness ?? frontFace?.toughness ?? null,
    loyalty: raw.loyalty ?? frontFace?.loyalty ?? null,
    defense: raw.defense ?? frontFace?.defense ?? null,
    colors: raw.colors ?? [],
    colorIdentity: raw.color_identity,
    layout: raw.layout,
    cardFaces: raw.card_faces ? raw.card_faces.map(mapCardFace) : null,
    imageUris: mapImageUris(raw.image_uris),
    set: raw.set,
    collectorNumber: raw.collector_number,
  };
}

function mapCardFace(face: RawCardFace): CardFace {
  return {
    name: face.name,
    manaCost: nonEmpty(face.mana_cost) ?? null,
    typeLine: face.type_line ?? null,
    oracleText: nonEmpty(face.oracle_text) ?? null,
    power: face.power ?? null,
    toughness: face.toughness ?? null,
    loyalty: face.loyalty ?? null,
    defense: face.defense ?? null,
    imageUris: mapImageUris(face.image_uris),
  };
}

function mapImageUris(raw: RawImageUris | undefined): ImageUris | null {
  if (!raw?.normal || !raw?.art_crop) {
    return null;
  }
  return { normal: raw.normal, artCrop: raw.art_crop };
}

function nonEmpty(value: Opt<string>): string | undefined {
  return value === '' || value == null ? undefined : value;
}
