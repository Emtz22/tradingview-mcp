import { z } from 'zod';
import { jsonResult } from './_format.js';
import * as core from '../core/alerts.js';

/**
 * Project core.list() output into the tool response: compact by default
 * (drops the heavy nested condition/series), with an opt-in full `detail`
 * mode and a row `limit` (default 50; 0 = all). `alert_count` is always the
 * true total. Pure (no I/O) so it is unit-testable. */
export function buildAlertListResponse(res, { detail, limit } = {}) {
  if (!res || !Array.isArray(res.alerts)) return res;
  const total = res.alerts.length;
  let alerts = detail
    ? res.alerts
    : res.alerts.map(a => ({ alert_id: a.alert_id, symbol: a.symbol, type: a.type, active: a.active, message: a.message }));
  const lim = limit === undefined ? 50 : limit;
  const truncated = lim > 0 && alerts.length > lim;
  if (truncated) alerts = alerts.slice(0, lim);
  return { success: res.success, alert_count: total, returned: alerts.length, truncated, detail: !!detail, source: res.source, alerts, error: res.error };
}

export function registerAlertTools(server) {
  server.tool('alert_create', 'Create a price alert via the TradingView alert dialog', {
    condition: z.string().describe('Alert condition (e.g., "crossing", "greater_than", "less_than")'),
    price: z.coerce.number().describe('Price level for the alert'),
    message: z.string().optional().describe('Alert message'),
  }, async ({ condition, price, message }) => {
    try { return jsonResult(await core.create({ condition, price, message })); }
    catch (err) { return jsonResult({ success: false, error: err.message }, true); }
  });

  server.tool('alert_list', 'List active alerts. Compact by default (alert_id, symbol, type, active, message); pass detail=true for full condition/series objects, limit to cap rows (default 50, 0 = all).', {
    detail: z.coerce.boolean().optional().describe('Return full alert objects incl. nested condition/series (default false = compact)'),
    limit: z.coerce.number().optional().describe('Max alerts to return (default 50; 0 = all). alert_count always reflects the true total.'),
  }, async ({ detail, limit }) => {
    try { return jsonResult(buildAlertListResponse(await core.list(), { detail, limit })); }
    catch (err) { return jsonResult({ success: false, error: err.message }, true); }
  });

  server.tool('alert_delete', 'Delete all alerts or open context menu for deletion', {
    delete_all: z.coerce.boolean().optional().describe('Delete all alerts'),
  }, async ({ delete_all }) => {
    try { return jsonResult(await core.deleteAlerts({ delete_all })); }
    catch (err) { return jsonResult({ success: false, error: err.message }, true); }
  });
}
