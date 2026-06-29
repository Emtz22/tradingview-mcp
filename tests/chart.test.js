/**
 * Tests for all chart functions in src/core/chart.js.
 * Covers: getState, setSymbol, setTimeframe, setType, manageIndicator,
 *         getVisibleRange, setVisibleRange, scrollToDate, symbolInfo, symbolSearch.
 *
 * Pattern (mirrors replay.test.js): import the REAL exported functions and inject a
 * mock `evaluate`/`evaluateAsync`/`waitForChartReady` via `_deps`. This is what makes
 * the suite a regression net for the "evaluate is not defined" DI bug class — a function
 * that calls bare `evaluate` (missing its `const {evaluate}=_resolve(_deps)` line) throws
 * a ReferenceError under these tests, failing loudly.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  getState, setSymbol, setTimeframe, setType, manageIndicator,
  getVisibleRange, setVisibleRange, scrollToDate, symbolInfo, symbolSearch,
} from '../src/core/chart.js';

// ── Mock helpers ───────────────────────────────────────────────────────────

function mockFn(responses = {}, sequence) {
  let i = 0;
  const calls = [];
  const fn = async (expr) => {
    calls.push(expr);
    if (sequence && i < sequence.length) return sequence[i++];
    for (const [k, v] of Object.entries(responses)) {
      if (String(expr).includes(k)) return typeof v === 'function' ? v(i++) : v;
    }
    return undefined;
  };
  fn.calls = calls;
  return fn;
}

/**
 * @param opts.evalResp / opts.evalSeq — responses/sequence for evaluate
 * @param opts.asyncResp — responses for evaluateAsync
 * @param opts.ready — value waitForChartReady resolves to (default true)
 */
function mockDeps({ evalResp = {}, evalSeq, asyncResp = {}, ready = true } = {}) {
  const evaluate = mockFn(evalResp, evalSeq);
  const evaluateAsync = mockFn(asyncResp);
  const wcrCalls = [];
  const waitForChartReady = async (...args) => { wcrCalls.push(args); return ready; };
  waitForChartReady.calls = wcrCalls;
  return { _deps: { evaluate, evaluateAsync, waitForChartReady }, evaluate, evaluateAsync, waitForChartReady };
}

// ── getState() ─────────────────────────────────────────────────────────────

describe('getState()', () => {
  it('returns success + spread chart state', async () => {
    const { _deps, evaluate } = mockDeps({
      evalSeq: [{ symbol: 'FX:XAUUSD', resolution: '60', chartType: 1, studies: [{ id: 'a', name: 'RSI' }] }],
    });
    const r = await getState({ _deps });
    assert.equal(r.success, true);
    assert.equal(r.symbol, 'FX:XAUUSD');
    assert.equal(r.resolution, '60');
    assert.deepEqual(r.studies, [{ id: 'a', name: 'RSI' }]);
    assert.ok(evaluate.calls[0].includes('getAllStudies'), 'queries studies');
  });
});

// ── setSymbol() ────────────────────────────────────────────────────────────

describe('setSymbol()', () => {
  it('awaits evaluateAsync then waitForChartReady; propagates chart_ready', async () => {
    const { _deps, evaluateAsync, waitForChartReady } = mockDeps({ ready: true });
    const r = await setSymbol({ symbol: 'OANDA:EURUSD', _deps });
    assert.equal(r.success, true);
    assert.equal(r.symbol, 'OANDA:EURUSD');
    assert.equal(r.chart_ready, true);
    assert.ok(evaluateAsync.calls[0].includes('setSymbol'), 'calls setSymbol via evaluateAsync');
    assert.equal(waitForChartReady.calls.length, 1);
  });

  it('escapes the symbol through safeString (injection-safe)', async () => {
    const { _deps, evaluateAsync } = mockDeps();
    await setSymbol({ symbol: 'A");evil("', _deps });
    const call = evaluateAsync.calls[0];
    assert.ok(!call.includes('A");evil("'), 'raw unescaped symbol must not appear verbatim');
  });

  it('reports chart_ready=false when readiness times out', async () => {
    const { _deps } = mockDeps({ ready: false });
    const r = await setSymbol({ symbol: 'X', _deps });
    assert.equal(r.chart_ready, false);
  });
});

// ── setTimeframe() ─────────────────────────────────────────────────────────

describe('setTimeframe()', () => {
  it('sets resolution and propagates chart_ready', async () => {
    const { _deps, evaluate, waitForChartReady } = mockDeps({ ready: true });
    const r = await setTimeframe({ timeframe: '15', _deps });
    assert.equal(r.success, true);
    assert.equal(r.timeframe, '15');
    assert.equal(r.chart_ready, true);
    assert.ok(evaluate.calls[0].includes('setResolution'));
    assert.deepEqual(waitForChartReady.calls[0], [null, '15']);
  });
});

// ── setType() — pure mapping + validation (richest edge surface) ────────────

describe('setType() — mapping and validation', () => {
  for (const [name, num] of [['Bars', 0], ['Candles', 1], ['Line', 2], ['HeikinAshi', 8], ['HollowCandles', 9]]) {
    it(`maps name "${name}" → ${num}`, async () => {
      const { _deps } = mockDeps();
      const r = await setType({ chart_type: name, _deps });
      assert.equal(r.success, true);
      assert.equal(r.type_num, num);
    });
  }

  it('accepts a numeric string', async () => {
    const { _deps } = mockDeps();
    const r = await setType({ chart_type: '5', _deps });
    assert.equal(r.type_num, 5);
  });

  it('accepts a raw number', async () => {
    const { _deps } = mockDeps();
    const r = await setType({ chart_type: 3, _deps });
    assert.equal(r.type_num, 3);
  });

  for (const bad of ['Foo', '-1', '10', '1.5', 'NaN']) {
    it(`rejects invalid chart type ${JSON.stringify(bad)} before any CDP call`, async () => {
      const { _deps, evaluate } = mockDeps();
      await assert.rejects(() => setType({ chart_type: bad, _deps }), (e) => /Unknown chart type/.test(e.message));
      assert.equal(evaluate.calls.length, 0, 'no evaluate call for invalid type');
    });
  }

  it('treats "" as Bars/0 (Number("")===0 coercion quirk)', async () => {
    const { _deps } = mockDeps();
    const r = await setType({ chart_type: '', _deps });
    assert.equal(r.type_num, 0);
  });
});

// ── manageIndicator() ──────────────────────────────────────────────────────

describe('manageIndicator()', () => {
  it('add: diffs study ids and returns the new entity_id', async () => {
    const { _deps, evaluate } = mockDeps({ evalSeq: [['a'], undefined, ['a', 'b']] });
    const r = await manageIndicator({ action: 'add', indicator: 'Relative Strength Index', _deps });
    assert.equal(r.success, true);
    assert.equal(r.action, 'add');
    assert.equal(r.entity_id, 'b');
    assert.equal(r.new_study_count, 1);
    assert.ok(evaluate.calls.some((c) => c.includes('createStudy')));
  });

  it('add: success=false when no new study appears', async () => {
    const { _deps } = mockDeps({ evalSeq: [['a'], undefined, ['a']] });
    const r = await manageIndicator({ action: 'add', indicator: 'X', _deps });
    assert.equal(r.success, false);
    assert.equal(r.entity_id, null);
  });

  it('add: parses inputs given as a JSON string into id/value pairs', async () => {
    const { _deps, evaluate } = mockDeps({ evalSeq: [[], undefined, ['z']] });
    await manageIndicator({ action: 'add', indicator: 'X', inputs: '{"length":21}', _deps });
    const createCall = evaluate.calls.find((c) => c.includes('createStudy'));
    assert.ok(createCall.includes('"id":"length"') && createCall.includes('"value":21'), 'inputs serialized as id/value');
  });

  it('remove: requires entity_id', async () => {
    const { _deps, evaluate } = mockDeps();
    await assert.rejects(() => manageIndicator({ action: 'remove', _deps }), (e) => /entity_id required/.test(e.message));
    assert.equal(evaluate.calls.length, 0);
  });

  it('remove: calls removeEntity with the id', async () => {
    const { _deps, evaluate } = mockDeps();
    const r = await manageIndicator({ action: 'remove', entity_id: 'abc', _deps });
    assert.equal(r.success, true);
    assert.equal(r.entity_id, 'abc');
    assert.ok(evaluate.calls[0].includes('removeEntity'));
  });

  it('throws on an unknown action', async () => {
    const { _deps } = mockDeps();
    await assert.rejects(() => manageIndicator({ action: 'toggle', _deps }), (e) => /action must be/.test(e.message));
  });
});

// ── getVisibleRange() — REGRESSION (was broken: bare evaluate) ──────────────

describe('getVisibleRange()', () => {
  it('returns visible_range and bars_range', async () => {
    const { _deps } = mockDeps({ evalSeq: [{ visible_range: { from: 1, to: 2 }, bars_range: { from: 3, to: 4 } }] });
    const r = await getVisibleRange({ _deps });
    assert.equal(r.success, true);
    assert.deepEqual(r.visible_range, { from: 1, to: 2 });
    assert.deepEqual(r.bars_range, { from: 3, to: 4 });
  });

  it('does not throw "evaluate is not defined" (DI bug regression)', async () => {
    const { _deps } = mockDeps({ evalSeq: [{ visible_range: {}, bars_range: {} }] });
    await assert.doesNotReject(() => getVisibleRange({ _deps }));
  });
});

// ── setVisibleRange() ──────────────────────────────────────────────────────

describe('setVisibleRange()', () => {
  it('returns requested + actual on finite inputs', async () => {
    const { _deps } = mockDeps({ evalSeq: [undefined, { from: 100, to: 200 }] });
    const r = await setVisibleRange({ from: 100, to: 250, _deps });
    assert.equal(r.success, true);
    assert.deepEqual(r.requested, { from: 100, to: 250 });
    assert.deepEqual(r.actual, { from: 100, to: 200 });
  });

  for (const bad of [NaN, Infinity, 'abc', undefined]) {
    it(`rejects non-finite from=${JSON.stringify(bad)} before any CDP call`, async () => {
      const { _deps, evaluate } = mockDeps();
      await assert.rejects(() => setVisibleRange({ from: bad, to: 200, _deps }));
      assert.equal(evaluate.calls.length, 0, 'requireFinite throws before evaluate');
    });
  }

  it('coerces null to 0 via requireFinite (Number(null)===0; no throw)', async () => {
    const { _deps } = mockDeps({ evalSeq: [undefined, { from: 0, to: 5 }] });
    await assert.doesNotReject(() => setVisibleRange({ from: null, to: 5, _deps }));
  });
});

// ── scrollToDate() — REGRESSION (was broken: bare evaluate) ─────────────────

describe('scrollToDate()', () => {
  it('accepts a unix-timestamp string and centers on it', async () => {
    const { _deps } = mockDeps({ evalResp: { resolution: '60' } });
    const r = await scrollToDate({ date: '1700000000', _deps });
    assert.equal(r.success, true);
    assert.equal(r.centered_on, 1700000000);
    // 60-min bars → 3600 s/bar, 25-bar half-window = 90000 s
    assert.equal(r.window.from, 1700000000 - 90000);
    assert.equal(r.window.to, 1700000000 + 90000);
  });

  it('accepts an ISO date string', async () => {
    const { _deps } = mockDeps({ evalResp: { resolution: '60' } });
    const r = await scrollToDate({ date: '2026-01-15', _deps });
    assert.equal(r.success, true);
    assert.equal(r.date, '2026-01-15');
    assert.equal(r.centered_on, Math.floor(new Date('2026-01-15').getTime() / 1000));
  });

  it('scales the window by resolution (daily → 86400 s/bar)', async () => {
    const { _deps } = mockDeps({ evalResp: { resolution: 'D' } });
    const r = await scrollToDate({ date: '1700000000', _deps });
    assert.equal(r.window.from, 1700000000 - 25 * 86400);
  });

  it('throws on an unparseable date', async () => {
    const { _deps, evaluate } = mockDeps();
    await assert.rejects(() => scrollToDate({ date: 'not-a-date', _deps }), (e) => /Could not parse date/.test(e.message));
    assert.equal(evaluate.calls.length, 0, 'parse check precedes evaluate');
  });

  it('does not throw "evaluate is not defined" (DI bug regression)', async () => {
    const { _deps } = mockDeps({ evalResp: { resolution: '60' } });
    await assert.doesNotReject(() => scrollToDate({ date: '1700000000', _deps }));
  });
});

// ── symbolInfo() — REGRESSION (was broken: bare evaluate) ───────────────────

describe('symbolInfo()', () => {
  it('returns success + spread symbol metadata', async () => {
    const { _deps } = mockDeps({ evalSeq: [{ symbol: 'XAUUSD', exchange: 'FX', type: 'commodity', resolution: '60' }] });
    const r = await symbolInfo({ _deps });
    assert.equal(r.success, true);
    assert.equal(r.symbol, 'XAUUSD');
    assert.equal(r.exchange, 'FX');
  });

  it('does not throw "evaluate is not defined" (DI bug regression)', async () => {
    const { _deps } = mockDeps({ evalSeq: [{}] });
    await assert.doesNotReject(() => symbolInfo({ _deps }));
  });
});

// ── symbolSearch() — uses global fetch, not _deps ──────────────────────────

describe('symbolSearch()', () => {
  let savedFetch;
  function stubFetch(impl) { savedFetch = globalThis.fetch; globalThis.fetch = impl; }
  function restoreFetch() { globalThis.fetch = savedFetch; }

  it('strips <em> tags and builds full_name', async () => {
    stubFetch(async () => ({ ok: true, json: async () => ({ symbols: [
      { symbol: '<em>XAU</em>USD', description: '<em>Gold</em>', exchange: 'OANDA', type: 'forex' },
    ] }) }));
    try {
      const r = await symbolSearch({ query: 'xau' });
      assert.equal(r.success, true);
      assert.equal(r.count, 1);
      assert.equal(r.results[0].symbol, 'XAUUSD');
      assert.equal(r.results[0].description, 'Gold');
      assert.equal(r.results[0].full_name, 'OANDA:XAUUSD');
    } finally { restoreFetch(); }
  });

  it('caps results at 15', async () => {
    const many = Array.from({ length: 50 }, (_, i) => ({ symbol: `S${i}`, exchange: 'X' }));
    stubFetch(async () => ({ ok: true, json: async () => ({ symbols: many }) }));
    try {
      const r = await symbolSearch({ query: 'a' });
      assert.equal(r.count, 15);
    } finally { restoreFetch(); }
  });

  it('handles an empty result set', async () => {
    stubFetch(async () => ({ ok: true, json: async () => ({ symbols: [] }) }));
    try {
      const r = await symbolSearch({ query: 'zzz' });
      assert.equal(r.count, 0);
      assert.deepEqual(r.results, []);
    } finally { restoreFetch(); }
  });

  it('throws on a non-ok HTTP response', async () => {
    stubFetch(async () => ({ ok: false, status: 503 }));
    try {
      await assert.rejects(() => symbolSearch({ query: 'a' }), (e) => /503/.test(e.message));
    } finally { restoreFetch(); }
  });
});

// ── Source-level regression lock for the DI bug class ──────────────────────

describe('DI wiring regression lock', () => {
  const src = readFileSync(new URL('../src/core/chart.js', import.meta.url), 'utf8');
  for (const fn of ['getVisibleRange', 'scrollToDate', 'symbolInfo']) {
    it(`${fn} resolves evaluate via _resolve(_deps) (was the bug)`, () => {
      const re = new RegExp(`function ${fn}\\([^)]*\\)\\s*\\{\\s*const \\{[^}]*\\} = _resolve\\(_deps\\)`);
      assert.ok(re.test(src), `${fn} must open with const { ... } = _resolve(_deps)`);
    });
  }

  it('no-arg-callable fns default their destructured arg to {} (safe bare call)', () => {
    for (const fn of ['getState', 'getVisibleRange', 'scrollToDate', 'symbolInfo']) {
      const re = new RegExp(`function ${fn}\\(\\{[^}]*\\} = \\{\\}\\)`);
      assert.ok(re.test(src), `${fn} must default its destructured arg to {}`);
    }
  });
});
