/**
 * golfScoringUtils — unit tests
 *
 * These tests protect against scoring regressions across ALL future tournaments
 * (Masters, US Open, The Open, PGA Championship, etc.) and any new pools.
 *
 * Key invariants:
 *  1. Stroke play (stroke_play / total_score / total_strokes): lowest = rank 1
 *  2. TourneyRun:  highest = rank 1
 *  3. Points race: highest = rank 1
 *  4. Color: under par = green, over par = red (stroke play only)
 */

import { describe, it, expect } from 'vitest';
import {
  STROKE_BASED_STYLES,
  isStrokeBased,
  computeRanks,
  scoreColor,
} from '../golfScoringUtils';


// ── STROKE_BASED_STYLES & isStrokeBased ───────────────────────────────────────

describe('isStrokeBased', () => {

  it.each(STROKE_BASED_STYLES)('%s is stroke-based', (style) => {
    expect(isStrokeBased(style)).toBe(true);
  });

  it('"tourneyrun" is NOT stroke-based', () => {
    expect(isStrokeBased('tourneyrun')).toBe(false);
  });

  it('"points_race" is NOT stroke-based', () => {
    expect(isStrokeBased('points_race')).toBe(false);
  });

  it('undefined / empty string / null are NOT stroke-based', () => {
    expect(isStrokeBased(undefined)).toBe(false);
    expect(isStrokeBased('')).toBe(false);
    expect(isStrokeBased(null)).toBe(false);
  });

});


// ── computeRanks — STROKE PLAY (lowest wins) ──────────────────────────────────

describe('computeRanks — stroke_play (lowest wins)', () => {

  // Houston Open scenario: team at -6 must be rank 1
  it('team at -6 is rank 1, team at +2 is last', () => {
    const standings = [
      { season_points: -6 },
      { season_points: -3 },
      { season_points:  0 },
      { season_points:  2 },
    ];
    const ranks = computeRanks(standings, 'stroke_play');
    expect(ranks[0].rank).toBe(1); // -6 = best
    expect(ranks[1].rank).toBe(2);
    expect(ranks[2].rank).toBe(3);
    expect(ranks[3].rank).toBe(4); // +2 = worst
  });

  it('works identically for total_score (same math, different name)', () => {
    const standings = [
      { season_points: -6 },
      { season_points: -3 },
      { season_points:  2 },
    ];
    const ranks = computeRanks(standings, 'total_score');
    expect(ranks[0].rank).toBe(1);
    expect(ranks[2].rank).toBe(3);
  });

  it('works identically for total_strokes (legacy Beta name)', () => {
    const standings = [
      { season_points: -10 },
      { season_points:  -5 },
      { season_points:   0 },
    ];
    const ranks = computeRanks(standings, 'total_strokes');
    expect(ranks[0].rank).toBe(1); // -10 = best
    expect(ranks[1].rank).toBe(2);
    expect(ranks[2].rank).toBe(3);
  });

  it('ties in stroke play are detected and assigned same rank', () => {
    const standings = [
      { season_points: -5 },
      { season_points: -3 },
      { season_points: -3 },
      { season_points:  1 },
    ];
    const ranks = computeRanks(standings, 'stroke_play');
    expect(ranks[0].rank).toBe(1);
    expect(ranks[0].tied).toBe(false);
    expect(ranks[1].rank).toBe(2);
    expect(ranks[1].tied).toBe(true);
    expect(ranks[2].rank).toBe(2);
    expect(ranks[2].tied).toBe(true);
    expect(ranks[3].rank).toBe(4); // skips 3 after two T2s
  });

  it('even par (0) beats over par (+2) in stroke play', () => {
    const standings = [
      { season_points: 0 },
      { season_points: 2 },
    ];
    const ranks = computeRanks(standings, 'stroke_play');
    expect(ranks[0].rank).toBe(1);
    expect(ranks[1].rank).toBe(2);
  });

  it('null season_points treated as 0 (even par)', () => {
    const standings = [
      { season_points: null },
      { season_points: -3 },
    ];
    const ranks = computeRanks(standings, 'stroke_play');
    expect(ranks[1].rank).toBe(1); // -3 beats null (treated as 0)
    expect(ranks[0].rank).toBe(2);
  });

});


// ── computeRanks — TOURNEYRUN (highest wins) ──────────────────────────────────

describe('computeRanks — tourneyrun (highest wins)', () => {

  it('team at +45 is rank 1, team at -3 is last', () => {
    const standings = [
      { season_points: 45 },
      { season_points: 22 },
      { season_points: 10 },
      { season_points: -3 },
    ];
    const ranks = computeRanks(standings, 'tourneyrun');
    expect(ranks[0].rank).toBe(1); // 45 = best
    expect(ranks[1].rank).toBe(2);
    expect(ranks[2].rank).toBe(3);
    expect(ranks[3].rank).toBe(4); // -3 = worst
  });

  it('ties in tourneyrun are detected', () => {
    const standings = [
      { season_points: 100 },
      { season_points: 100 },
      { season_points:  50 },
    ];
    const ranks = computeRanks(standings, 'tourneyrun');
    expect(ranks[0].rank).toBe(1);
    expect(ranks[0].tied).toBe(true);
    expect(ranks[1].rank).toBe(1);
    expect(ranks[1].tied).toBe(true);
    expect(ranks[2].rank).toBe(3);
    expect(ranks[2].tied).toBe(false);
  });

  it('null season_points treated as 0 → ranks below positive scores', () => {
    const standings = [
      { season_points: null },
      { season_points: 50 },
    ];
    const ranks = computeRanks(standings, 'tourneyrun');
    expect(ranks[1].rank).toBe(1); // 50 beats null (0)
    expect(ranks[0].rank).toBe(2);
  });

});


// ── computeRanks — POINTS RACE (highest wins) ─────────────────────────────────

describe('computeRanks — points_race (highest wins)', () => {

  it('team at 120 pts = rank 1, team at 40 pts = last', () => {
    const standings = [
      { season_points: 120 },
      { season_points:  80 },
      { season_points:  40 },
    ];
    const ranks = computeRanks(standings, 'points_race');
    expect(ranks[0].rank).toBe(1);  // 120 = best
    expect(ranks[1].rank).toBe(2);
    expect(ranks[2].rank).toBe(3);  // 40 = worst
  });

});


// ── scoreColor — golf convention ──────────────────────────────────────────────

describe('scoreColor — stroke play uses golf convention', () => {

  it.each(STROKE_BASED_STYLES)('%s: under par → green', (style) => {
    expect(scoreColor(-4, style)).toBe('#22c55e');
    expect(scoreColor(-1, style)).toBe('#22c55e');
  });

  it.each(STROKE_BASED_STYLES)('%s: over par → red', (style) => {
    expect(scoreColor(1, style)).toBe('#ef4444');
    expect(scoreColor(4, style)).toBe('#ef4444');
  });

  it.each(STROKE_BASED_STYLES)('%s: even par (0) → neutral', (style) => {
    expect(scoreColor(0, style)).toBe('#9ca3af');
  });

});

describe('scoreColor — tourneyrun uses opposite convention', () => {

  it('positive pts → green (more points = good)', () => {
    expect(scoreColor(45, 'tourneyrun')).toBe('#22c55e');
  });

  it('negative pts → red (fewer points = bad)', () => {
    expect(scoreColor(-3, 'tourneyrun')).toBe('#ef4444');
  });

  it('zero → neutral', () => {
    expect(scoreColor(0, 'tourneyrun')).toBe('#9ca3af');
  });

});


// ── Anti-regression: the specific Houston Open bug ────────────────────────────

describe('Houston Open regression — stroke_play not recognized as stroke-based', () => {

  it('before fix: total_strokes was the only recognized stroke style — verify fix', () => {
    // This test would have FAILED before the fix because computeRanks used
    // lowerIsBetter = scoringStyle === 'total_strokes' (missed stroke_play).
    // Now all three names are handled.
    const standings = [
      { season_points: -6 },  // best team
      { season_points:  2 },  // worst team
    ];

    // stroke_play (current UI name) must sort correctly
    const ranksStrokePlay = computeRanks(standings, 'stroke_play');
    expect(ranksStrokePlay[0].rank).toBe(1); // -6 = rank 1
    expect(ranksStrokePlay[1].rank).toBe(2); // +2 = rank 2

    // total_score (second UI option) must also sort correctly
    const ranksTotalScore = computeRanks(standings, 'total_score');
    expect(ranksTotalScore[0].rank).toBe(1);
    expect(ranksTotalScore[1].rank).toBe(2);
  });

});
