import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  clearAll,
  drawNote,
  drawPosition,
  drawShape,
  drawingCapabilities,
  getProperties,
  getSymbolTickSize,
  listDrawings,
  parseOverrides,
  priceDistanceToTicks,
  removeOne,
  updateDrawing,
  validateArity,
} from '../src/core/drawing.js';
import { DRAWING_REGISTRY, GENERIC_DRAWING_SHAPES } from '../src/core/drawing-registry.js';

function sequence(values, calls) {
  let index = 0;
  return async (expression) => {
    calls.push(String(expression));
    return values[Math.min(index++, values.length - 1)];
  };
}

function mockDeps({ evaluate = [], evaluateAsync = [], exactBarExists } = {}) {
  const evaluateCalls = [];
  const asyncCalls = [];
  const apiCalls = [];
  return {
    _deps: {
      evaluate: sequence(evaluate, evaluateCalls),
      evaluateAsync: sequence(evaluateAsync, asyncCalls),
      getChartApi: async () => { apiCalls.push(true); return 'window.__api'; },
      exactBarExists,
    },
    evaluateCalls,
    asyncCalls,
    apiCalls,
  };
}

function points(count) {
  return Array.from({ length: count }, (_, index) => ({ time: 1700000000 + index * 60, price: 100 + index }));
}

function runBrowserExpression(expression, api) {
  return Function('window', `return (${expression.trim()})`)({ __api: api });
}

describe('drawing registry', () => {
  it('freezes all 99 runtime entries with explicit dispositions', () => {
    const result = drawingCapabilities();
    assert.equal(result.count, 99);
    assert.deepEqual(result.counts, {
      ui_only: 6,
      supported: 88,
      blocked_external_content_or_asset_contract: 5,
    });
    assert.equal(GENERIC_DRAWING_SHAPES.length, 86);
    assert.ok(Object.isFrozen(DRAWING_REGISTRY));
  });

  it('provides a supported representative for every persistent tool family', () => {
    const expected = new Set([
      'geometry', 'annotation', 'marker', 'lines', 'channels', 'volume',
      'pitchforks', 'gann_fibonacci', 'patterns', 'forecasting', 'icons',
    ]);
    const actual = new Set(Object.values(DRAWING_REGISTRY).filter((item) => item.status === 'supported').map((item) => item.family));
    assert.deepEqual(actual, expected);
  });

  it('covers fixed arities 1..7 and variable N-point tools', () => {
    const arities = [...new Set(Object.values(DRAWING_REGISTRY)
      .filter((item) => item.status === 'supported')
      .map((item) => item.arity))].sort((a, b) => a - b);
    assert.deepEqual(arities, [-1, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('rejects wrong arity for every non-anchored generic entry', () => {
    for (const shape of GENERIC_DRAWING_SHAPES) {
      const capability = DRAWING_REGISTRY[shape];
      if (capability.route === 'anchored') continue;
      const wrongCount = capability.arity === -1 ? capability.minPoints - 1 : capability.arity + 1;
      assert.throws(() => validateArity(capability, points(wrongCount)), undefined, shape);
    }
  });
});

describe('drawShape', () => {
  it('awaits the direct entity ID for single-point drawings', async () => {
    const deps = mockDeps({ evaluateAsync: ['single-id'] });
    const result = await drawShape({ shape: 'horizontal_line', points: points(1), _deps: deps._deps });
    assert.equal(result.entity_id, 'single-id');
    assert.equal(result.route, 'single');
    assert.match(deps.asyncCalls[0], /await window\.__api\.createShape/);
  });

  it('uses createMultipointShape for fixed and N-point drawings', async () => {
    const fixed = mockDeps({ evaluateAsync: ['fixed-id'] });
    await drawShape({ shape: 'fib_trend_ext', points: points(3), _deps: fixed._deps });
    assert.match(fixed.asyncCalls[0], /createMultipointShape/);
    const variable = mockDeps({ evaluateAsync: ['brush-id'] });
    await drawShape({ shape: 'brush', points: points(4), _deps: variable._deps });
    assert.match(variable.asyncCalls[0], /createMultipointShape/);
  });

  it('uses viewport coordinates only for anchored drawings', async () => {
    const deps = mockDeps({ evaluateAsync: ['anchored-id'] });
    const result = await drawShape({ shape: 'anchored_text', anchored_position: { x: 0.25, y: 0.75 }, text: 'note', _deps: deps._deps });
    assert.equal(result.route, 'anchored');
    assert.match(deps.asyncCalls[0], /createAnchoredShape/);
    await assert.rejects(
      drawShape({ shape: 'anchored_text', anchored_position: { x: 0.5, y: 0.5 }, points: points(1), _deps: deps._deps }),
      /uses anchored_position/,
    );
  });

  it('requires and validates icon codepoints', async () => {
    const deps = mockDeps({ evaluateAsync: ['icon-id'] });
    await assert.rejects(drawShape({ shape: 'icon', points: points(1), _deps: deps._deps }), /finite number/);
    await assert.rejects(drawShape({ shape: 'icon', points: points(1), icon: 0x110000, _deps: deps._deps }), /Unicode codepoint/);
    await drawShape({ shape: 'icon', points: points(1), icon: 0x2191, _deps: deps._deps });
    assert.match(deps.asyncCalls[0], /icon: 8593/);
  });

  it('fails unknown, UI-only, blocked, and first-class position names before evaluation', async () => {
    const deps = mockDeps();
    await assert.rejects(drawShape({ shape: 'not_real', points: points(1), _deps: deps._deps }), /Unknown drawing shape/);
    await assert.rejects(drawShape({ shape: 'cursor', _deps: deps._deps }), /selectable UI mode/);
    await assert.rejects(drawShape({ shape: 'image', points: points(1), _deps: deps._deps }), /blocked/);
    await assert.rejects(drawShape({ shape: 'long_position', points: points(2), _deps: deps._deps }), /Use draw_position/);
    assert.equal(deps.asyncCalls.length, 0);
  });

  it('rejects all non-finite coordinates before evaluation', async () => {
    for (const value of [NaN, Infinity, -Infinity, 'not-a-number']) {
      const deps = mockDeps();
      await assert.rejects(drawShape({ shape: 'horizontal_line', points: [{ time: value, price: 1 }], _deps: deps._deps }), /finite/);
      await assert.rejects(drawShape({ shape: 'horizontal_line', points: [{ time: 1, price: value }], _deps: deps._deps }), /finite/);
      assert.equal(deps.asyncCalls.length, 0);
    }
  });
});

describe('override validation', () => {
  it('accepts plain JSON objects and strings', () => {
    assert.deepEqual(parseOverrides('{"linecolor":"#f00","levels":[1,2]}'), { linecolor: '#f00', levels: [1, 2] });
    assert.deepEqual(parseOverrides({ linewidth: 2 }), { linewidth: 2 });
  });

  it('rejects malformed, non-object, non-finite, and prototype-bearing values', () => {
    assert.throws(() => parseOverrides('{bad'), /valid JSON/);
    assert.throws(() => parseOverrides([]), /JSON object/);
    assert.throws(() => parseOverrides({ value: Infinity }), /non-finite/);
    assert.throws(() => parseOverrides(Object.create({ inherited: true })), /plain object/);
    const polluted = JSON.parse('{"__proto__":{"polluted":true}}');
    assert.throws(() => parseOverrides(polluted), /not allowed/);
  });
});

describe('native positions', () => {
  it('creates long geometry and converts prices to exact tick levels', async () => {
    const deps = mockDeps({ evaluateAsync: ['long-id'] });
    const result = await drawPosition({
      side: 'long', entry: 100, stop: 99.5, target: 101.25,
      start_time: 1, end_time: 2, tick_size: 0.25, _deps: deps._deps,
    });
    assert.equal(result.shape, 'long_position');
    assert.deepEqual(result.points, [{ time: 1, price: 100 }, { time: 2, price: 100 }]);
    assert.equal(result.stopLevel, 2);
    assert.equal(result.profitLevel, 5);
    assert.match(deps.asyncCalls[0], /"stopLevel":2/);
    assert.match(deps.asyncCalls[0], /"profitLevel":5/);
  });

  it('creates side-correct short geometry', async () => {
    const deps = mockDeps({ evaluateAsync: ['short-id'] });
    const result = await drawPosition({
      side: 'short', entry: 100, stop: 101, target: 98,
      start_time: 1, end_time: 3, tick_size: 0.5, _deps: deps._deps,
    });
    assert.equal(result.shape, 'short_position');
    assert.equal(result.stopLevel, 2);
    assert.equal(result.profitLevel, 4);
  });

  it('derives tick size from symbol metadata', async () => {
    const deps = mockDeps({ evaluate: [{ minmov: 1, pricescale: 100000, minmove2: 0 }] });
    assert.deepEqual(await getSymbolTickSize({ _deps: deps._deps }), { tick_size: 0.00001, source: 'symbol_info' });
  });

  it('rejects side-invalid geometry, time reversal, protected levels, and fractional ticks', async () => {
    const base = { side: 'long', entry: 100, stop: 99, target: 101, start_time: 1, end_time: 2, tick_size: 0.25 };
    await assert.rejects(drawPosition({ ...base, stop: 101 }), /stop < entry < target/);
    await assert.rejects(drawPosition({ ...base, end_time: 1 }), /greater than/);
    await assert.rejects(drawPosition({ ...base, stop: 99.9 }), /whole-number multiple/);
    await assert.rejects(drawPosition({ ...base, overrides: { stopLevel: 99 } }), /cannot be overridden/);
    assert.throws(() => priceDistanceToTicks(Infinity, 0.1, 'distance'), /finite/);
  });
});

describe('exact-bar notes', () => {
  it('keeps exact time and duplicates callout points for runtime arity', async () => {
    const deps = mockDeps({ evaluateAsync: ['callout-id'], exactBarExists: async (time) => time === 1700000000 });
    const result = await drawNote({ style: 'callout', time: 1700000000, price: 42, text: 'Exact note', _deps: deps._deps });
    assert.equal(result.entity_id, 'callout-id');
    assert.equal(result.exact_bar, true);
    assert.match(deps.asyncCalls[0], /"time":1700000000/);
    assert.equal((deps.asyncCalls[0].match(/"time":1700000000/g) || []).length, 2);
  });

  it('rejects missing bars, empty text, and unknown styles without creation', async () => {
    const deps = mockDeps({ exactBarExists: async () => false });
    await assert.rejects(drawNote({ style: 'text', time: 1, price: 1, text: 'x', _deps: deps._deps }), /No loaded chart bar/);
    await assert.rejects(drawNote({ style: 'text', time: 1, price: 1, text: '', _deps: deps._deps }), /non-empty/);
    await assert.rejects(drawNote({ style: 'balloon', time: 1, price: 1, text: 'x', _deps: deps._deps }), /Unsupported/);
    assert.equal(deps.asyncCalls.length, 0);
  });
});

describe('exact-ID lifecycle', () => {
  it('lists and inspects drawings', async () => {
    const listDeps = mockDeps({ evaluate: [[{ id: 'a', name: 'trend_line' }]] });
    assert.deepEqual(await listDrawings({ _deps: listDeps._deps }), { success: true, count: 1, shapes: [{ id: 'a', name: 'trend_line' }] });
    const getDeps = mockDeps({ evaluate: [{ entity_id: 'a', name: 'trend_line', points: points(2) }] });
    assert.equal((await getProperties({ entity_id: 'a', _deps: getDeps._deps })).name, 'trend_line');
  });

  it('retains typed evidence when optional drawing accessors throw', async () => {
    const shape = {
      getPoints: () => points(2),
      getProperties: () => ({}),
      isVisible: () => { throw new Error('visible unavailable'); },
      isLocked: () => { throw new Error('locked unavailable'); },
      isSelectionEnabled: () => { throw new Error('selection unavailable'); },
    };
    const api = {
      getShapeById: () => shape,
      getAllShapes: () => [{ id: 'a', name: 'trend_line' }],
    };
    const result = await getProperties({ entity_id: 'a', _deps: {
      getChartApi: async () => 'window.__api',
      evaluate: async (expression) => runBrowserExpression(expression, api),
    } });
    assert.deepEqual(result.visible_error, {
      code: 'DRAWING_VISIBLE_READ_FAILED',
      message: 'visible unavailable',
    });
    assert.deepEqual(result.locked_error, {
      code: 'DRAWING_LOCKED_READ_FAILED',
      message: 'locked unavailable',
    });
    assert.deepEqual(result.selectable_error, {
      code: 'DRAWING_SELECTABLE_READ_FAILED',
      message: 'selection unavailable',
    });
  });

  it('validates update arity before setPoints', async () => {
    const deps = mockDeps({ evaluate: ['trend_line'] });
    await assert.rejects(updateDrawing({ entity_id: 'a', points: points(1), _deps: deps._deps }), /exactly 2 points/);
    assert.equal(deps.asyncCalls.length, 0);
  });

  it('updates points/properties for one exact ID', async () => {
    const deps = mockDeps({ evaluate: ['trend_line'], evaluateAsync: [{ entity_id: 'a', name: 'trend_line', points: points(2), updated: true }] });
    const result = await updateDrawing({ entity_id: 'a', points: points(2), overrides: { linewidth: 2 }, _deps: deps._deps });
    assert.equal(result.updated, true);
    assert.match(deps.asyncCalls[0], /getShapeById\(eid\)/);
    assert.match(deps.asyncCalls[0], /setPoints/);
    assert.match(deps.asyncCalls[0], /setProperties/);
  });

  it('fails closed with a typed error when post-update points readback throws', async () => {
    const shape = {
      setPoints: async () => {},
      getPoints: () => { throw new Error('authoritative readback unavailable'); },
    };
    const api = {
      getAllShapes: () => [{ id: 'a', name: 'trend_line' }],
      getShapeById: () => shape,
    };
    await assert.rejects(
      updateDrawing({ entity_id: 'a', points: points(2), _deps: {
        getChartApi: async () => 'window.__api',
        evaluate: async (expression) => runBrowserExpression(expression, api),
        evaluateAsync: async (expression) => runBrowserExpression(expression, api),
      } }),
      (error) => {
        assert.equal(error.code, 'DRAWING_POINTS_READBACK_FAILED');
        assert.equal(error.details.entity_id, 'a');
        assert.match(error.message, /authoritative readback unavailable/);
        return true;
      },
    );
  });

  it('removes only the requested ID and verifies absence', async () => {
    const deps = mockDeps({ evaluateAsync: [{ removed: true, entity_id: 'task-id', remaining_shapes: 4 }] });
    const result = await removeOne({ entity_id: 'task-id', _deps: deps._deps });
    assert.equal(result.removed, true);
    assert.match(deps.asyncCalls[0], /removeEntity\(eid\)/);
    assert.doesNotMatch(deps.asyncCalls[0], /removeAllShapes/);
  });

  it('retains clearAll only as explicitly destructive legacy behavior', async () => {
    const deps = mockDeps({ evaluate: [undefined] });
    const result = await clearAll({ _deps: deps._deps });
    assert.equal(result.warning, 'destructive_legacy_operation');
    assert.match(deps.evaluateCalls[0], /removeAllShapes/);
  });
});
