import { z } from 'zod';
import { jsonResult } from './_format.js';
import * as core from '../core/drawing.js';
import { GENERIC_DRAWING_SHAPES } from '../core/drawing-registry.js';

const pointSchema = z.object({
  time: z.coerce.number().describe('Unix timestamp'),
  price: z.coerce.number().describe('Price'),
});
const overridesSchema = z.union([
  z.string().describe('JSON object string'),
  z.record(z.string(), z.unknown()).describe('JSON object'),
]).optional();
const noteStyles = ['text', 'text_note', 'price_note', 'note', 'callout', 'comment', 'price_label', 'signpost', 'flag'];

export function registerDrawingTools(server) {
  server.tool('draw_capabilities', 'List typed drawing capabilities, arity, API route, and unsupported dispositions', {}, async () => {
    try { return jsonResult(core.drawingCapabilities()); }
    catch (err) { return jsonResult({ success: false, error: err.message }, true); }
  });

  server.tool('draw_shape', 'Create a registry-approved TradingView drawing; unknown and blocked shapes fail closed', {
    shape: z.enum(GENERIC_DRAWING_SHAPES).describe('Registry-approved TradingView API shape name'),
    points: z.array(pointSchema).max(100).optional().describe('Ordered points for fixed or N-point drawings'),
    point: pointSchema.optional().describe('Legacy first point; use points for new callers'),
    point2: pointSchema.optional().describe('Legacy second point; use points for new callers'),
    anchored_position: z.object({ x: z.coerce.number(), y: z.coerce.number() }).optional().describe('0..1 viewport coordinates for anchored_text or anchored_note'),
    overrides: overridesSchema.describe('Validated style override object or JSON object string'),
    text: z.string().max(10000).optional().describe('Text for text-capable drawings'),
    icon: z.coerce.number().int().min(0).max(0x10ffff).optional().describe('Numeric Unicode icon codepoint; required for icon'),
  }, async (args) => {
    try { return jsonResult(await core.drawShape(args)); }
    catch (err) { return jsonResult({ success: false, error: err.message }, true); }
  });

  server.tool('draw_position', 'Create a native Long Position or Short Position with entry, stop, target, and time horizon', {
    side: z.enum(['long', 'short']),
    entry: z.coerce.number(),
    stop: z.coerce.number(),
    target: z.coerce.number(),
    start_time: z.coerce.number().describe('Unix timestamp for the entry/start point'),
    end_time: z.coerce.number().describe('Unix timestamp for the time-horizon endpoint'),
    tick_size: z.coerce.number().positive().optional().describe('Explicit tick size; otherwise derived from current symbol metadata'),
    overrides: overridesSchema.describe('Validated style overrides; stopLevel/profitLevel are computed and protected'),
  }, async (args) => {
    try { return jsonResult(await core.drawPosition(args)); }
    catch (err) { return jsonResult({ success: false, error: err.message }, true); }
  });

  server.tool('draw_note', 'Create an exact-loaded-bar text, note, price note, callout, comment, label, signpost, or flag', {
    style: z.enum(noteStyles).default('text'),
    time: z.coerce.number().describe('Exact loaded bar Unix timestamp; missing bars fail instead of shifting'),
    price: z.coerce.number(),
    text: z.string().min(1).max(10000),
    overrides: overridesSchema,
  }, async (args) => {
    try { return jsonResult(await core.drawNote(args)); }
    catch (err) { return jsonResult({ success: false, error: err.message }, true); }
  });

  server.tool('draw_list', 'List all shapes/drawings on the chart', {}, async () => {
    try { return jsonResult(await core.listDrawings()); }
    catch (err) { return jsonResult({ success: false, error: err.message }, true); }
  });

  server.tool('draw_get_properties', 'Get properties and points of a specific drawing', {
    entity_id: z.string().describe('Entity ID of the drawing (from draw_list)'),
  }, async ({ entity_id }) => {
    try { return jsonResult(await core.getProperties({ entity_id })); }
    catch (err) { return jsonResult({ success: false, error: err.message }, true); }
  });

  server.tool('draw_update', 'Update one drawing by exact entity ID with registry arity validation', {
    entity_id: z.string(),
    points: z.array(pointSchema).max(100).optional(),
    anchored_position: z.object({ x: z.coerce.number(), y: z.coerce.number() }).optional(),
    overrides: overridesSchema,
    text: z.string().max(10000).optional(),
  }, async (args) => {
    try { return jsonResult(await core.updateDrawing(args)); }
    catch (err) { return jsonResult({ success: false, error: err.message }, true); }
  });

  server.tool('draw_remove_one', 'Remove a specific drawing by exact entity ID', {
    entity_id: z.string().describe('Entity ID of the drawing to remove (from draw_list)'),
  }, async ({ entity_id }) => {
    try { return jsonResult(await core.removeOne({ entity_id })); }
    catch (err) { return jsonResult({ success: false, error: err.message }, true); }
  });

  server.tool('draw_clear', 'DESTRUCTIVE legacy operation: remove every drawing from the chart', {}, async () => {
    try { return jsonResult(await core.clearAll()); }
    catch (err) { return jsonResult({ success: false, error: err.message }, true); }
  });
}
