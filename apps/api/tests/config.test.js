import { describe, it, expect } from 'vitest';
import { parseDurationMs } from '../src/config.js';

describe('parseDurationMs', () => {
  it('parses supported shorthand durations', () => {
    expect(parseDurationMs('15m')).toBe(15 * 60 * 1000);
    expect(parseDurationMs('8h')).toBe(8 * 60 * 60 * 1000);
    expect(parseDurationMs('30d')).toBe(30 * 24 * 60 * 60 * 1000);
    expect(parseDurationMs('45s')).toBe(45 * 1000);
  });

  it('accepts plain milliseconds and falls back when missing', () => {
    expect(parseDurationMs('9000')).toBe(9000);
    expect(parseDurationMs(undefined, 1234)).toBe(1234);
  });

  it('throws on unsupported formats without fallback', () => {
    expect(() => parseDurationMs('1w')).toThrow(/Unsupported duration format/);
  });
});
