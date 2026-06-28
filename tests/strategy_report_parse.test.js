/**
 * Unit tests for parseRenderedReport() and stability helpers (Bug 2 & Bug 3 fixes).
 * No TradingView connection needed — pure offline logic.
 *
 * Run: node --test tests/strategy_report_parse.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseRenderedReport, hashText, isStableSequence } from '../src/core/data.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = readFileSync(join(__dirname, 'fixtures', 'strategy_report_sample.txt'), 'utf8');

// ─── Bug 2: parseRenderedReport ──────────────────────────────────────────────

describe('parseRenderedReport — main fixture', () => {
  let m;
  it('parses without throwing', () => {
    m = parseRenderedReport(FIXTURE);
    assert.ok(typeof m === 'object' && m !== null);
  });

  it('total_pnl_pct ≈ 7230.73', () => {
    m = m || parseRenderedReport(FIXTURE);
    assert.ok(Math.abs(m.total_pnl_pct - 7230.73) < 0.01, `got ${m.total_pnl_pct}`);
  });

  it('total_pnl_usd ≈ 723073.28', () => {
    m = m || parseRenderedReport(FIXTURE);
    assert.ok(Math.abs(m.total_pnl_usd - 723073.28) < 0.01, `got ${m.total_pnl_usd}`);
  });

  it('profit_factor ≈ 1.307', () => {
    m = m || parseRenderedReport(FIXTURE);
    assert.ok(Math.abs(m.profit_factor - 1.307) < 0.001, `got ${m.profit_factor}`);
  });

  it('profitable_pct ≈ 28.02', () => {
    m = m || parseRenderedReport(FIXTURE);
    assert.ok(Math.abs(m.profitable_pct - 28.02) < 0.01, `got ${m.profitable_pct}`);
  });

  it('trades_won === 760', () => {
    m = m || parseRenderedReport(FIXTURE);
    assert.strictEqual(m.trades_won, 760);
  });

  it('trades_total === 2712', () => {
    m = m || parseRenderedReport(FIXTURE);
    assert.strictEqual(m.trades_total, 2712);
  });

  it('sharpe ≈ 0.32', () => {
    m = m || parseRenderedReport(FIXTURE);
    assert.ok(Math.abs(m.sharpe - 0.32) < 0.01, `got ${m.sharpe}`);
  });

  it('max_drawdown_pct ≈ 26.43', () => {
    m = m || parseRenderedReport(FIXTURE);
    assert.ok(Math.abs(m.max_drawdown_pct - 26.43) < 0.01, `got ${m.max_drawdown_pct}`);
  });

  it('cagr ≈ 28.01', () => {
    m = m || parseRenderedReport(FIXTURE);
    assert.ok(Math.abs(m.cagr - 28.01) < 0.01, `got ${m.cagr}`);
  });

  it('avg_pnl_pct ≈ 0.07', () => {
    m = m || parseRenderedReport(FIXTURE);
    assert.ok(Math.abs(m.avg_pnl_pct - 0.07) < 0.001, `got ${m.avg_pnl_pct}`);
  });

  it('total_trades is absent (not in fixture)', () => {
    m = m || parseRenderedReport(FIXTURE);
    assert.strictEqual(m.total_trades, undefined);
  });
});

// ─── Bug 2: unicode minus handling ───────────────────────────────────────────

describe('parseRenderedReport — unicode minus (U+2212) fixture', () => {
  // Use the recognized "Average PnL" label with a unicode-minus negative value
  const unicodeMinusFix = `Key stats

Average PnL
−60.31
USD
−0.31%`;

  it('parses unicode minus in avg_pnl_usd correctly', () => {
    const m = parseRenderedReport(unicodeMinusFix);
    assert.ok(m.avg_pnl_usd !== undefined, 'avg_pnl_usd should be present');
    assert.ok(Math.abs(m.avg_pnl_usd - (-60.31)) < 0.01, `got ${m.avg_pnl_usd}`);
  });

  it('parses unicode minus in avg_pnl_pct correctly', () => {
    const m = parseRenderedReport(unicodeMinusFix);
    assert.ok(m.avg_pnl_pct !== undefined, 'avg_pnl_pct should be present');
    assert.ok(Math.abs(m.avg_pnl_pct - (-0.31)) < 0.001, `got ${m.avg_pnl_pct}`);
  });
});

// ─── Bug 2: edge cases ────────────────────────────────────────────────────────

describe('parseRenderedReport — edge cases', () => {
  it('returns empty object for empty string', () => {
    const m = parseRenderedReport('');
    assert.deepStrictEqual(m, {});
  });

  it('returns empty object for null', () => {
    const m = parseRenderedReport(null);
    assert.deepStrictEqual(m, {});
  });

  it('does not confuse Average PnL with Total PnL', () => {
    const text = `Total PnL
+100.00
USD
+10.00%
Average PnL
5.00
USD
0.50%`;
    const m = parseRenderedReport(text);
    assert.ok(Math.abs(m.total_pnl_usd - 100.00) < 0.01, `total_pnl_usd got ${m.total_pnl_usd}`);
    assert.ok(Math.abs(m.avg_pnl_usd - 5.00) < 0.01, `avg_pnl_usd got ${m.avg_pnl_usd}`);
    assert.ok(Math.abs(m.total_pnl_pct - 10.00) < 0.01, `total_pnl_pct got ${m.total_pnl_pct}`);
    assert.ok(Math.abs(m.avg_pnl_pct - 0.50) < 0.001, `avg_pnl_pct got ${m.avg_pnl_pct}`);
  });

  it('handles comma thousands separators in USD values', () => {
    const text = `Total PnL
+1,234,567.89
USD
+1,234.57%`;
    const m = parseRenderedReport(text);
    assert.ok(Math.abs(m.total_pnl_usd - 1234567.89) < 0.01, `got ${m.total_pnl_usd}`);
    assert.ok(Math.abs(m.total_pnl_pct - 1234.57) < 0.01, `got ${m.total_pnl_pct}`);
  });
});

// ─── Bug 3: hashText + isStableSequence pure helpers ─────────────────────────

describe('hashText', () => {
  it('returns a string', () => {
    assert.strictEqual(typeof hashText('hello'), 'string');
  });

  it('same input → same hash', () => {
    assert.strictEqual(hashText('abc'), hashText('abc'));
  });

  it('different input → different hash (high probability)', () => {
    assert.notStrictEqual(hashText('abc'), hashText('abd'));
  });

  it('handles empty string', () => {
    assert.strictEqual(hashText(''), '');
  });

  it('handles null/undefined gracefully', () => {
    assert.strictEqual(hashText(null), '');
    assert.strictEqual(hashText(undefined), '');
  });
});

describe('isStableSequence', () => {
  const T = (text, ts) => ({ text, ts });

  it('returns false with fewer than 2 snapshots', () => {
    assert.strictEqual(isStableSequence([T('hello', 0)]), false);
    assert.strictEqual(isStableSequence([]), false);
    assert.strictEqual(isStableSequence(null), false);
  });

  it('returns false when last two have different text', () => {
    const snaps = [T('text-a', 0), T('text-b', 700)];
    assert.strictEqual(isStableSequence(snaps, 600), false);
  });

  it('returns false when gap is too small', () => {
    const snaps = [T('same', 0), T('same', 300)];
    assert.strictEqual(isStableSequence(snaps, 600), false);
  });

  it('returns true when same text and gap ≥ minGapMs', () => {
    const snaps = [T('same', 0), T('same', 700)];
    assert.strictEqual(isStableSequence(snaps, 600), true);
  });

  it('only checks last two snapshots — earlier ones irrelevant', () => {
    const snaps = [T('a', 0), T('b', 100), T('c', 200), T('c', 900)];
    assert.strictEqual(isStableSequence(snaps, 600), true);
  });

  it('returns false even if non-last pair matches but last two differ', () => {
    const snaps = [T('c', 0), T('c', 700), T('d', 1400)];
    assert.strictEqual(isStableSequence(snaps, 600), false);
  });

  it('uses default gap of 600 ms', () => {
    // exact boundary: gap === 600 → true
    const ok = [T('x', 0), T('x', 600)];
    assert.strictEqual(isStableSequence(ok), true);
    // gap 599 → false
    const notOk = [T('x', 0), T('x', 599)];
    assert.strictEqual(isStableSequence(notOk), false);
  });
});
