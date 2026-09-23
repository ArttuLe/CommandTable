import { describe, expect, it } from 'vitest';
import { LABEL_PRESETS, labelTone } from './labels.js';

describe('labelTone', () => {
  it('gives the evergreen keywords the colour they are printed in', () => {
    expect(labelTone('flying')).toBe('white');
    expect(labelTone('haste')).toBe('red');
    expect(labelTone('trample')).toBe('green');
    expect(labelTone('deathtouch')).toBe('black');
  });

  it('does not care how it was typed', () => {
    expect(labelTone('Flying')).toBe('white');
    expect(labelTone('  FIRST STRIKE  ')).toBe('white');
  });

  it('falls back to neutral for anything the table invented', () => {
    expect(labelTone('goaded by Alice')).toBe('neutral');
    expect(labelTone('')).toBe('neutral');
  });
});

describe('LABEL_PRESETS', () => {
  it('offers the keywords that actually come up, each with a tone of its own', () => {
    expect(LABEL_PRESETS).toContain('flying');
    expect(LABEL_PRESETS).toContain('goaded');
    // Every preset must be recognised by labelTone, or the picker would offer grey pills that
    // then turn out to have a colour once typed by hand.
    for (const preset of LABEL_PRESETS) {
      expect(labelTone(preset)).not.toBe('neutral');
    }
  });

  it('lists each preset once', () => {
    expect(new Set(LABEL_PRESETS).size).toBe(LABEL_PRESETS.length);
  });
});
