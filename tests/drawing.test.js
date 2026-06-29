/**
 * Tests for all drawing functions in src/core/drawing.js.
 * Covers: drawShape, listDrawings, getProperties, removeOne, clearAll.
 *
 * Same DI regression strategy as chart/replay: call the REAL functions with a mock
 * `evaluate`+`getChartApi` injected via `_deps`. listDrawings/getProperties/removeOne/
 * clearAll all lacked the `_resolve(_deps)` line (bare `evaluate`/`getChartApi`) — these
 * tests fail with a ReferenceError if that regresses.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { drawShape, listDrawings, getProperties, removeOne, clearAll } from '../src/core/drawing.js';

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

function mockDeps({ evalResp = {}, evalSeq, api = 'window.__api' } = {}) {
  const evaluate = mockFn(evalResp, evalSeq);
  const apiCalls = [];
  const getChartApi = async () => { apiCalls.push(1); return api; };
  getChartApi.calls = apiCalls;
  return { _deps: { evaluate, getChartApi }, evaluate, getChartApi };
}

// ── drawShape() ────────────────────────────────────────────────────────────

describe('drawShape()', () => {
  it('single point → createShape, returns the new entity id', async () => {
    const { _deps, evaluate } = mockDeps({ evalSeq: [['x'], undefined, ['x', 'new1']] });
    const r = await drawShape({ shape: 'horizontal_line', point: { time: 1700000000, price: 2000 }, _deps });
    assert.equal(r.success, true);
    assert.equal(r.shape, 'horizontal_line');
    assert.equal(r.entity_id, 'new1');
    assert.ok(evaluate.calls.some((c) => c.includes('createShape')));
    assert.ok(!evaluate.calls.some((c) => c.includes('createMultipointShape')), 'single-point uses createShape');
  });

  it('two points → createMultipointShape', async () => {
    const { _deps, evaluate } = mockDeps({ evalSeq: [[], undefined, ['m']] });
    const r = await drawShape({
      shape: 'trend_line',
      point: { time: 1, price: 10 },
      point2: { time: 2, price: 20 },
      _deps,
    });
    assert.equal(r.entity_id, 'm');
    assert.ok(evaluate.calls.some((c) => c.includes('createMultipointShape')));
  });

  it('serializes overrides given as a JSON string', async () => {
    const { _deps, evaluate } = mockDeps({ evalSeq: [[], undefined, ['z']] });
    await drawShape({ shape: 'rectangle', point: { time: 1, price: 1 }, overrides: '{"linecolor":"#f00"}', _deps });
    const createCall = evaluate.calls.find((c) => c.includes('createShape'));
    assert.ok(createCall.includes('linecolor') && createCall.includes('#f00'), 'overrides embedded');
  });

  it('returns null entity_id when no new shape appears', async () => {
    const { _deps } = mockDeps({ evalSeq: [['x'], undefined, ['x']] });
    const r = await drawShape({ shape: 'horizontal_line', point: { time: 1, price: 1 }, _deps });
    assert.equal(r.entity_id, null);
  });

  it('rejects a non-finite point coordinate', async () => {
    const { _deps, evaluate } = mockDeps();
    await assert.rejects(() => drawShape({ shape: 'horizontal_line', point: { time: 'abc', price: 1 }, _deps }));
    assert.equal(evaluate.calls.length, 0, 'requireFinite throws before any shape evaluate');
  });
});

// ── listDrawings() — REGRESSION (bare evaluate/getChartApi) ─────────────────

describe('listDrawings()', () => {
  it('returns count + shapes', async () => {
    const { _deps } = mockDeps({ evalSeq: [[{ id: 'a', name: 'Trend' }, { id: 'b', name: 'Rect' }]] });
    const r = await listDrawings({ _deps });
    assert.equal(r.success, true);
    assert.equal(r.count, 2);
    assert.equal(r.shapes[0].id, 'a');
  });

  it('count is 0 for an empty chart', async () => {
    const { _deps } = mockDeps({ evalSeq: [[]] });
    const r = await listDrawings({ _deps });
    assert.equal(r.count, 0);
  });

  it('does not throw "evaluate is not defined" (DI bug regression)', async () => {
    const { _deps } = mockDeps({ evalSeq: [[]] });
    await assert.doesNotReject(() => listDrawings({ _deps }));
  });
});

// ── getProperties() — REGRESSION ───────────────────────────────────────────

describe('getProperties()', () => {
  it('returns success + spread properties', async () => {
    const { _deps } = mockDeps({ evalSeq: [{ entity_id: 'a', visible: true, points: [{ time: 1, price: 2 }] }] });
    const r = await getProperties({ entity_id: 'a', _deps });
    assert.equal(r.success, true);
    assert.equal(r.entity_id, 'a');
    assert.equal(r.visible, true);
  });

  it('throws when the shape is not found (result.error)', async () => {
    const { _deps } = mockDeps({ evalSeq: [{ error: 'Shape not found: zzz' }] });
    await assert.rejects(() => getProperties({ entity_id: 'zzz', _deps }), (e) => /Shape not found/.test(e.message));
  });

  it('does not throw "evaluate is not defined" (DI bug regression)', async () => {
    const { _deps } = mockDeps({ evalSeq: [{ entity_id: 'a' }] });
    await assert.doesNotReject(() => getProperties({ entity_id: 'a', _deps }));
  });
});

// ── removeOne() — REGRESSION ───────────────────────────────────────────────

describe('removeOne()', () => {
  it('returns removed=true on success', async () => {
    const { _deps } = mockDeps({ evalSeq: [{ removed: true, entity_id: 'a', remaining_shapes: 2 }] });
    const r = await removeOne({ entity_id: 'a', _deps });
    assert.equal(r.success, true);
    assert.equal(r.removed, true);
    assert.equal(r.remaining_shapes, 2);
  });

  it('throws when the shape is not found', async () => {
    const { _deps } = mockDeps({ evalSeq: [{ error: 'Shape not found: zzz', removed: false }] });
    await assert.rejects(() => removeOne({ entity_id: 'zzz', _deps }), (e) => /Shape not found/.test(e.message));
  });

  it('does not throw "evaluate is not defined" (DI bug regression)', async () => {
    const { _deps } = mockDeps({ evalSeq: [{ removed: true, entity_id: 'a' }] });
    await assert.doesNotReject(() => removeOne({ entity_id: 'a', _deps }));
  });
});

// ── clearAll() — REGRESSION ────────────────────────────────────────────────

describe('clearAll()', () => {
  it('removes all shapes', async () => {
    const { _deps, evaluate } = mockDeps();
    const r = await clearAll({ _deps });
    assert.equal(r.success, true);
    assert.equal(r.action, 'all_shapes_removed');
    assert.ok(evaluate.calls[0].includes('removeAllShapes'));
  });

  it('does not throw "evaluate is not defined" (DI bug regression)', async () => {
    const { _deps } = mockDeps();
    await assert.doesNotReject(() => clearAll({ _deps }));
  });
});

// ── Source-level regression lock for the DI bug class ──────────────────────

describe('DI wiring regression lock', () => {
  const src = readFileSync(new URL('../src/core/drawing.js', import.meta.url), 'utf8');
  for (const fn of ['listDrawings', 'getProperties', 'removeOne', 'clearAll']) {
    it(`${fn} resolves evaluate+getChartApi via _resolve(_deps) (was the bug)`, () => {
      const re = new RegExp(`function ${fn}\\([^)]*\\)\\s*\\{\\s*const \\{[^}]*\\} = _resolve\\(_deps\\)`);
      assert.ok(re.test(src), `${fn} must open with const { ... } = _resolve(_deps)`);
    });
  }
});
