/**
 * Tests for the alert_list response projection (src/tools/alerts.js).
 *
 * The tool layer was changed to compact-by-default to avoid dumping ~145K chars
 * (208 alerts × full nested condition/series) into the model context on every call.
 * The projection is extracted as the pure `buildAlertListResponse` helper so it can
 * be unit-tested directly without mocking the live CDP layer.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildAlertListResponse } from '../src/tools/alerts.js';

function fakeAlerts(n) {
  return Array.from({ length: n }, (_, i) => ({
    alert_id: 1000 + i,
    symbol: `SYM${i}`,
    type: 'drawing',
    active: i % 2 === 0,
    message: `msg ${i}`,
    // the heavy nested payload that compact mode must drop:
    condition: { type: 'greater', frequency: 'on_first_fire', series: [{ type: 'barset' }, { type: 'line', price1: 1.23, offset1: 227 }] },
  }));
}
const res = (n, extra = {}) => ({ success: true, alert_count: n, source: 'internal_api', alerts: fakeAlerts(n), error: undefined, ...extra });

describe('buildAlertListResponse() — compact default', () => {
  it('drops the heavy nested fields, keeps the summary fields', () => {
    const out = buildAlertListResponse(res(3));
    assert.equal(out.detail, false);
    const a = out.alerts[0];
    assert.deepEqual(Object.keys(a).sort(), ['active', 'alert_id', 'message', 'symbol', 'type']);
    assert.equal(a.condition, undefined, 'condition must be stripped in compact mode');
    assert.equal(a.alert_id, 1000);
    assert.equal(a.symbol, 'SYM0');
  });

  it('defaults to a 50-row cap; alert_count reflects the TRUE total', () => {
    const out = buildAlertListResponse(res(208));
    assert.equal(out.alert_count, 208, 'true total preserved');
    assert.equal(out.returned, 50);
    assert.equal(out.truncated, true);
    assert.equal(out.alerts.length, 50);
  });

  it('does not mark truncated when count <= limit', () => {
    const out = buildAlertListResponse(res(5));
    assert.equal(out.returned, 5);
    assert.equal(out.truncated, false);
  });
});

describe('buildAlertListResponse() — limit', () => {
  it('honors a custom limit', () => {
    const out = buildAlertListResponse(res(10), { limit: 3 });
    assert.equal(out.returned, 3);
    assert.equal(out.truncated, true);
    assert.equal(out.alert_count, 10);
  });

  it('limit=0 returns everything', () => {
    const out = buildAlertListResponse(res(208), { limit: 0 });
    assert.equal(out.returned, 208);
    assert.equal(out.truncated, false);
  });
});

describe('buildAlertListResponse() — detail mode', () => {
  it('detail=true returns full objects incl. condition', () => {
    const out = buildAlertListResponse(res(2), { detail: true });
    assert.equal(out.detail, true);
    assert.ok(out.alerts[0].condition, 'condition retained in detail mode');
    assert.deepEqual(out.alerts[0].condition.series[0], { type: 'barset' });
  });

  it('detail still respects limit', () => {
    const out = buildAlertListResponse(res(100), { detail: true, limit: 10 });
    assert.equal(out.returned, 10);
    assert.equal(out.truncated, true);
  });
});

describe('buildAlertListResponse() — edge cases', () => {
  it('empty alert set', () => {
    const out = buildAlertListResponse(res(0));
    assert.equal(out.alert_count, 0);
    assert.equal(out.returned, 0);
    assert.equal(out.truncated, false);
    assert.deepEqual(out.alerts, []);
  });

  it('passes through an error response that has no alerts array', () => {
    const errRes = { success: false, error: 'pricealerts unavailable' };
    assert.equal(buildAlertListResponse(errRes), errRes);
  });

  it('returns null unchanged (malformed input)', () => {
    assert.equal(buildAlertListResponse(null), null);
  });

  it('preserves source and error fields', () => {
    const out = buildAlertListResponse(res(2, { source: 'internal_api', error: 'partial' }));
    assert.equal(out.source, 'internal_api');
    assert.equal(out.error, 'partial');
  });
});
