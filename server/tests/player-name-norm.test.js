'use strict';
/**
 * Tests for the shared playerNameNorm utility.
 *
 * All four cases from the Masters prep requirements:
 *   Thorbjørn Olesen → thorbjorn olesen
 *   J.T. Poston      → jt poston
 *   Rory McIlroy     → rory mcilroy
 *   Nicolai Højgaard → nicolai hojgaard
 */

const { normalizePlayerName, matchPlayerName } = require('../utils/playerNameNorm');

// ── normalizePlayerName ───────────────────────────────────────────────────────

describe('normalizePlayerName', () => {
  test('strips ø diacritic: Thorbjørn Olesen → thorbjorn olesen', () => {
    expect(normalizePlayerName('Thorbjørn Olesen')).toBe('thorbjorn olesen');
  });

  test('strips ø diacritic: Nicolai Højgaard → nicolai hojgaard', () => {
    expect(normalizePlayerName('Nicolai Højgaard')).toBe('nicolai hojgaard');
  });

  test('strips periods: J.T. Poston → jt poston', () => {
    expect(normalizePlayerName('J.T. Poston')).toBe('jt poston');
  });

  test('plain name unchanged (besides lowercase): Rory McIlroy → rory mcilroy', () => {
    expect(normalizePlayerName('Rory McIlroy')).toBe('rory mcilroy');
  });

  test('strips é: Adrien Dumont de Chassart stays unchanged (no diacritics)', () => {
    expect(normalizePlayerName('Adrien Dumont de Chassart')).toBe('adrien dumont de chassart');
  });

  test('strips ü: handles umlaut characters', () => {
    // Hypothetical: "Müller" → "muller"
    expect(normalizePlayerName('Müller')).toBe('muller');
  });

  test('strips å: handles ring-above', () => {
    expect(normalizePlayerName('Ludvig Åberg')).toBe('ludvig aberg');
  });

  test('strips ñ: handles tilde-n', () => {
    expect(normalizePlayerName('Ángel Hidalgo')).toBe('angel hidalgo');
  });

  test('collapses extra whitespace', () => {
    expect(normalizePlayerName('  Tiger  Woods  ')).toBe('tiger woods');
  });

  test('strips hyphens', () => {
    expect(normalizePlayerName('Byeong-Hun An')).toBe('byeongHun an'.toLowerCase());
  });

  test('strips curly apostrophes', () => {
    expect(normalizePlayerName("Corey O'Connell")).toBe('corey oconnell');
  });

  test('handles null/undefined gracefully', () => {
    expect(normalizePlayerName(null)).toBe('');
    expect(normalizePlayerName(undefined)).toBe('');
    expect(normalizePlayerName('')).toBe('');
  });
});

// ── matchPlayerName ───────────────────────────────────────────────────────────

describe('matchPlayerName', () => {
  const players = [
    { id: 'p1', name: 'Thorbjorn Olesen' },  // DB has no diacritic
    { id: 'p2', name: 'J.T. Poston' },
    { id: 'p3', name: 'Rory McIlroy' },
    { id: 'p4', name: 'Nicolai Hojgaard' },  // DB has no diacritic
    { id: 'p5', name: 'Tiger Woods' },
    { id: 'p6', name: 'Jon Rahm' },
  ];

  test('ESPN diacritic name matches DB plain name: Thorbjørn Olesen → p1', () => {
    const m = matchPlayerName('Thorbjørn Olesen', players, 'The Masters');
    expect(m?.id).toBe('p1');
  });

  test('ESPN diacritic name matches DB plain name: Nicolai Højgaard → p4', () => {
    const m = matchPlayerName('Nicolai Højgaard', players, 'The Masters');
    expect(m?.id).toBe('p4');
  });

  test('ESPN periods match DB periods: J.T. Poston → p2', () => {
    const m = matchPlayerName('J.T. Poston', players, 'The Masters');
    expect(m?.id).toBe('p2');
  });

  test('exact plain match: Rory McIlroy → p3', () => {
    const m = matchPlayerName('Rory McIlroy', players, 'The Masters');
    expect(m?.id).toBe('p3');
  });

  test('first-initial + last-name fallback: T. Woods → p5', () => {
    const m = matchPlayerName('T. Woods', players, 'The Masters');
    expect(m?.id).toBe('p5');
  });

  test('last-name-only fallback when unique: J. Rahm → p6', () => {
    // ESPN may abbreviate "J. Rahm" — first initial + last matches "Jon Rahm"
    const m = matchPlayerName('J. Rahm', players, 'The Masters');
    expect(m?.id).toBe('p6');
  });

  test('returns null and logs error for unknown player', () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const m = matchPlayerName('Scottie Scheffler', players, 'The Masters');
    expect(m).toBeNull();
    expect(errSpy).toHaveBeenCalledTimes(1);
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('Scottie Scheffler'));
    errSpy.mockRestore();
  });

  test('error log includes [sync] prefix for Railway filtering', () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    matchPlayerName('Unknown Player', players, 'RBC Heritage');
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('[sync]'));
    errSpy.mockRestore();
  });

  test('error log includes tournament name for diagnosis', () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    matchPlayerName('No One Here', players, 'Valero Texas Open');
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('Valero Texas Open'));
    errSpy.mockRestore();
  });
});
