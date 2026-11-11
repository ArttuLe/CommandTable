// Card display data. Display-only: nothing here encodes what a card does.

export interface CardFace {
  name: string;
  manaCost: string | null;
  typeLine: string | null;
  oracleText: string | null;
  power: string | null;
  toughness: string | null;
  loyalty: string | null;
  defense: string | null;
  imageUris: ImageUris | null;
}

export interface ImageUris {
  normal: string;
  artCrop: string;
}

export interface Card {
  oracleId: string;
  scryfallId: string;
  name: string;
  manaCost: string | null;
  cmc: number;
  typeLine: string;
  oracleText: string | null;
  power: string | null;
  toughness: string | null;
  loyalty: string | null;
  defense: string | null;
  colors: string[];
  colorIdentity: string[];
  layout: string;
  cardFaces: CardFace[] | null;
  imageUris: ImageUris | null;
  set: string;
  collectorNumber: string;
}
