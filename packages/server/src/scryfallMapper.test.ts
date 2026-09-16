import { describe, expect, it } from 'vitest';
import { mapScryfallCard } from './scryfallMapper.js';

describe('mapScryfallCard', () => {
  it('maps a single-faced card', () => {
    const raw = {
      id: 'scryfall-id-1',
      oracle_id: 'oracle-id-1',
      name: 'Sol Ring',
      mana_cost: '{1}',
      cmc: 1,
      type_line: 'Artifact',
      oracle_text: '{T}: Add {C}{C}.',
      power: null,
      toughness: null,
      loyalty: null,
      colors: [],
      color_identity: [],
      layout: 'normal',
      image_uris: {
        normal: 'https://example.com/normal.jpg',
        art_crop: 'https://example.com/art.jpg',
      },
      set: 'lea',
      collector_number: '1',
    };

    const card = mapScryfallCard(raw);

    expect(card).toEqual({
      oracleId: 'oracle-id-1',
      scryfallId: 'scryfall-id-1',
      name: 'Sol Ring',
      manaCost: '{1}',
      cmc: 1,
      typeLine: 'Artifact',
      oracleText: '{T}: Add {C}{C}.',
      power: null,
      toughness: null,
      loyalty: null,
      defense: null,
      colors: [],
      colorIdentity: [],
      layout: 'normal',
      cardFaces: null,
      imageUris: { normal: 'https://example.com/normal.jpg', artCrop: 'https://example.com/art.jpg' },
      set: 'lea',
      collectorNumber: '1',
    });
  });

  it('maps a transform card, preferring front-face fields for display and per-face image_uris', () => {
    const raw = {
      id: 'scryfall-id-2',
      oracle_id: 'oracle-id-2',
      name: 'Delver of Secrets // Insectile Aberration',
      mana_cost: '',
      cmc: 1,
      type_line: 'Creature — Human Wizard // Creature — Human Insect',
      oracle_text: '',
      colors: ['U'],
      color_identity: ['U'],
      layout: 'transform',
      set: 'isd',
      collector_number: '51',
      card_faces: [
        {
          name: 'Delver of Secrets',
          mana_cost: '{U}',
          type_line: 'Creature — Human Wizard',
          oracle_text: 'At the beginning of your upkeep...',
          power: '1',
          toughness: '1',
          image_uris: { normal: 'https://example.com/front.jpg', art_crop: 'https://example.com/front-art.jpg' },
        },
        {
          name: 'Insectile Aberration',
          mana_cost: '',
          type_line: 'Creature — Human Insect',
          oracle_text: 'Flying',
          power: '3',
          toughness: '2',
          image_uris: { normal: 'https://example.com/back.jpg', art_crop: 'https://example.com/back-art.jpg' },
        },
      ],
    };

    const card = mapScryfallCard(raw);

    expect(card.cardFaces).toHaveLength(2);
    expect(card.cardFaces?.[0].name).toBe('Delver of Secrets');
    expect(card.cardFaces?.[1].name).toBe('Insectile Aberration');
    // No top-level image_uris on a transform card; the client renders currentFace from cardFaces.
    expect(card.imageUris).toBeNull();
    // Front face supplies the display power/toughness when the top level omits them.
    expect(card.power).toBe('1');
    expect(card.toughness).toBe('1');
  });

  it('defaults missing optional fields to null', () => {
    const raw = {
      id: 'scryfall-id-3',
      oracle_id: 'oracle-id-3',
      name: 'Plains',
      mana_cost: '',
      cmc: 0,
      type_line: 'Basic Land — Plains',
      colors: [],
      color_identity: [],
      layout: 'normal',
      set: 'lea',
      collector_number: '288',
    };

    const card = mapScryfallCard(raw);

    expect(card.oracleText).toBeNull();
    expect(card.power).toBeNull();
    expect(card.loyalty).toBeNull();
    expect(card.defense).toBeNull();
    expect(card.imageUris).toBeNull();
  });
});
