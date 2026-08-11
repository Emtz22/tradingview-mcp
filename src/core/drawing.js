/**
 * Registry-driven chart drawing logic.
 */
import {
  evaluate as _evaluate,
  evaluateAsync as _evaluateAsync,
  getChartApi as _getChartApi,
  safeString,
  requireFinite,
} from '../connection.js';
import {
  DRAWING_REGISTRY,
  getDrawingCapability,
  listDrawingCapabilities,
} from './drawing-registry.js';

const FORBIDDEN_OVERRIDE_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const EXACT_BAR_NOTE_SHAPES = new Set([
  'text', 'text_note', 'price_note', 'note', 'callout',
  'comment', 'price_label', 'signpost', 'flag',
]);
const POSITION_SHAPES = new Set(['long_position', 'short_position']);
const MAX_POINTS = 100;

function _resolve(deps) {
  return {
    evaluate: deps?.evaluate || _evaluate,
    evaluateAsync: deps?.evaluateAsync || deps?.evaluate || _evaluateAsync,
    getChartApi: deps?.getChartApi || _getChartApi,
    exactBarExists: deps?.exactBarExists,
  };
}

function validateJsonValue(value, path = 'overrides', depth = 0) {
  if (depth > 8) throw new Error(`${path} exceeds maximum nesting depth`);
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`${path} contains a non-finite number`);
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > 200) throw new Error(`${path} array is too large`);
    value.forEach((item, index) => validateJsonValue(item, `${path}[${index}]`, depth + 1));
    return;
  }
  if (typeof value !== 'object') throw new Error(`${path} must contain only JSON values`);
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) throw new Error(`${path} must be a plain object`);
  const entries = Object.entries(value);
  if (entries.length > 200) throw new Error(`${path} has too many keys`);
  for (const [key, item] of entries) {
    if (FORBIDDEN_OVERRIDE_KEYS.has(key)) throw new Error(`${path}.${key} is not allowed`);
    validateJsonValue(item, `${path}.${key}`, depth + 1);
  }
}

export function parseOverrides(raw) {
  if (raw === undefined || raw === null || raw === '') return {};
  let value = raw;
  if (typeof raw === 'string') {
    try { value = JSON.parse(raw); }
    catch (error) { throw new Error(`overrides must be valid JSON: ${error.message}`); }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('overrides must be a JSON object');
  }
  validateJsonValue(value);
  return JSON.parse(JSON.stringify(value));
}

function validatePoint(point, name) {
  if (!point || typeof point !== 'object' || Array.isArray(point)) {
    throw new Error(`${name} must be an object with finite time and price`);
  }
  return {
    time: requireFinite(point.time, `${name}.time`),
    price: requireFinite(point.price, `${name}.price`),
  };
}

export function normalizePoints({ points, point, point2 } = {}) {
  let values;
  if (points !== undefined) {
    if (!Array.isArray(points)) throw new Error('points must be an array');
    if (point !== undefined || point2 !== undefined) throw new Error('Use points or point/point2, not both');
    values = points;
  } else {
    values = point === undefined ? [] : [point, ...(point2 === undefined ? [] : [point2])];
  }
  if (values.length > MAX_POINTS) throw new Error(`points cannot exceed ${MAX_POINTS}`);
  return values.map((value, index) => validatePoint(value, `points[${index}]`));
}

export function validateArity(capability, points) {
  if (!capability) throw new Error('Unknown drawing capability');
  if (capability.route === 'anchored') return;
  if (capability.arity === -1) {
    if (points.length < capability.minPoints) {
      throw new Error(`${capability.shape} requires at least ${capability.minPoints} points, got ${points.length}`);
    }
    return;
  }
  if (points.length !== capability.arity) {
    throw new Error(`${capability.shape} requires exactly ${capability.arity} point${capability.arity === 1 ? '' : 's'}, got ${points.length}`);
  }
}

function validateAnchoredPosition(position) {
  if (!position || typeof position !== 'object' || Array.isArray(position)) {
    throw new Error('anchored_position is required for anchored drawings');
  }
  const x = requireFinite(position.x, 'anchored_position.x');
  const y = requireFinite(position.y, 'anchored_position.y');
  if (x < 0 || x > 1 || y < 0 || y > 1) {
    throw new Error('anchored_position x and y must be between 0 and 1');
  }
  return { x, y };
}

function validateIcon(icon) {
  const value = requireFinite(icon, 'icon');
  if (!Number.isInteger(value) || value < 0 || value > 0x10ffff) {
    throw new Error('icon must be an integer Unicode codepoint between 0 and 0x10ffff');
  }
  return value;
}

function optionsExpression({ shape, overrides, text, icon }) {
  const entries = [`shape: ${safeString(shape)}`, `overrides: ${JSON.stringify(overrides)}`];
  if (text !== undefined) entries.push(`text: ${safeString(text)}`);
  if (icon !== undefined) entries.push(`icon: ${icon}`);
  return `{ ${entries.join(', ')} }`;
}

async function createRegisteredDrawing({ capability, points, anchored_position, overrides, text, icon, _deps }) {
  const { evaluateAsync, getChartApi } = _resolve(_deps);
  const apiPath = await getChartApi();
  const options = optionsExpression({ shape: capability.shape, overrides, text, icon });
  let call;
  if (capability.route === 'anchored') {
    const anchored = validateAnchoredPosition(anchored_position);
    call = `${apiPath}.createAnchoredShape(${JSON.stringify(anchored)}, ${options})`;
  } else if (capability.route === 'single') {
    call = `${apiPath}.createShape(${JSON.stringify(points[0])}, ${options})`;
  } else {
    call = `${apiPath}.createMultipointShape(${JSON.stringify(points)}, ${options})`;
  }
  const entityId = await evaluateAsync(`
    (async function() {
      var id = await ${call};
      return id == null ? null : String(id);
    })()
  `);
  if (!entityId) throw new Error(`TradingView did not return an entity ID for ${capability.shape}`);
  return entityId;
}

export async function drawShape({ shape, points, point, point2, anchored_position, overrides: overridesRaw, text, icon, _deps }) {
  const capability = getDrawingCapability(shape);
  if (!capability) throw new Error(`Unknown drawing shape: ${shape}. Call draw_capabilities for supported names.`);
  if (capability.status === 'ui_only') throw new Error(`${shape} is a selectable UI mode, not a persistent drawing`);
  if (capability.status !== 'supported') throw new Error(`${shape} is blocked: ${capability.status}`);
  if (!capability.genericAllowed) {
    if (POSITION_SHAPES.has(capability.shape)) throw new Error(`Use draw_position for ${capability.shape}`);
    throw new Error(`${shape} is not available through generic draw_shape`);
  }

  const suppliedPointGeometry = points !== undefined || point !== undefined || point2 !== undefined;
  if (capability.route === 'anchored' && suppliedPointGeometry) {
    throw new Error(`${shape} uses anchored_position, not time/price points`);
  }
  const normalized = capability.route === 'anchored' ? [] : normalizePoints({ points, point, point2 });
  validateArity(capability, normalized);
  const overrides = parseOverrides(overridesRaw);
  const validatedIcon = capability.requiredOption === 'icon' ? validateIcon(icon) : undefined;
  const entityId = await createRegisteredDrawing({
    capability,
    points: normalized,
    anchored_position,
    overrides,
    text,
    icon: validatedIcon,
    _deps,
  });
  return { success: true, shape: capability.shape, entity_id: entityId, route: capability.route };
}

export async function getSymbolTickSize({ tick_size, _deps } = {}) {
  if (tick_size !== undefined) {
    const explicit = requireFinite(tick_size, 'tick_size');
    if (explicit <= 0) throw new Error('tick_size must be greater than zero');
    return { tick_size: explicit, source: 'explicit' };
  }
  const { evaluate, getChartApi } = _resolve(_deps);
  const apiPath = await getChartApi();
  const info = await evaluate(`
    (function() {
      var info = ${apiPath}._chartWidget.model().mainSeries().symbolInfo();
      return info ? { minmov: info.minmov, pricescale: info.pricescale, minmove2: info.minmove2 || 0 } : null;
    })()
  `);
  const minmov = Number(info?.minmov);
  const pricescale = Number(info?.pricescale);
  const minmove2 = Number(info?.minmove2 || 0);
  if (!Number.isFinite(minmov) || minmov <= 0 || !Number.isFinite(pricescale) || pricescale <= 0 || !Number.isFinite(minmove2) || minmove2 < 0) {
    throw new Error('Unable to derive symbol tick size; pass an explicit positive tick_size');
  }
  return { tick_size: minmov / pricescale / (minmove2 || 1), source: 'symbol_info' };
}

export function priceDistanceToTicks(distance, tickSize, name) {
  const raw = requireFinite(distance, name) / requireFinite(tickSize, 'tick_size');
  const rounded = Math.round(raw);
  const tolerance = Math.max(1e-8, Math.abs(raw) * 1e-10);
  if (raw <= 0 || Math.abs(raw - rounded) > tolerance) {
    throw new Error(`${name} must be a positive whole-number multiple of tick_size`);
  }
  return rounded;
}

export async function drawPosition({ side, entry, stop, target, start_time, end_time, tick_size, overrides: overridesRaw, _deps }) {
  if (side !== 'long' && side !== 'short') throw new Error('side must be long or short');
  const entryPrice = requireFinite(entry, 'entry');
  const stopPrice = requireFinite(stop, 'stop');
  const targetPrice = requireFinite(target, 'target');
  const startTime = requireFinite(start_time, 'start_time');
  const endTime = requireFinite(end_time, 'end_time');
  if (endTime <= startTime) throw new Error('end_time must be greater than start_time');
  if (side === 'long' && !(stopPrice < entryPrice && entryPrice < targetPrice)) {
    throw new Error('Long position requires stop < entry < target');
  }
  if (side === 'short' && !(targetPrice < entryPrice && entryPrice < stopPrice)) {
    throw new Error('Short position requires target < entry < stop');
  }

  const tick = await getSymbolTickSize({ tick_size, _deps });
  const stopDistance = side === 'long' ? entryPrice - stopPrice : stopPrice - entryPrice;
  const profitDistance = side === 'long' ? targetPrice - entryPrice : entryPrice - targetPrice;
  const stopLevel = priceDistanceToTicks(stopDistance, tick.tick_size, 'stop distance');
  const profitLevel = priceDistanceToTicks(profitDistance, tick.tick_size, 'target distance');
  const overrides = parseOverrides(overridesRaw);
  if ('stopLevel' in overrides || 'profitLevel' in overrides) {
    throw new Error('stopLevel and profitLevel are computed from entry/stop/target and cannot be overridden');
  }
  overrides.stopLevel = stopLevel;
  overrides.profitLevel = profitLevel;
  const shape = side === 'long' ? 'long_position' : 'short_position';
  const capability = DRAWING_REGISTRY[shape];
  const points = [{ time: startTime, price: entryPrice }, { time: endTime, price: entryPrice }];
  const entityId = await createRegisteredDrawing({ capability, points, overrides, _deps });
  return {
    success: true,
    shape,
    side,
    entity_id: entityId,
    points,
    entry: entryPrice,
    stop: stopPrice,
    target: targetPrice,
    tick_size: tick.tick_size,
    tick_source: tick.source,
    stopLevel,
    profitLevel,
  };
}

async function assertExactBarTime(time, _deps) {
  const resolved = _resolve(_deps);
  if (resolved.exactBarExists) {
    if (!await resolved.exactBarExists(time)) throw new Error(`No loaded chart bar exists at exact time ${time}`);
    return;
  }
  const apiPath = await resolved.getChartApi();
  const exists = await resolved.evaluate(`
    (function() {
      var bars = ${apiPath}._chartWidget.model().mainSeries().bars();
      if (!bars || typeof bars.valueAt !== 'function') return false;
      var first = typeof bars.firstIndex === 'function' ? bars.firstIndex() : 0;
      var last = typeof bars.lastIndex === 'function' ? bars.lastIndex() : -1;
      for (var i = first; i <= last; i++) {
        var bar = bars.valueAt(i);
        if (bar && Number(bar[0]) === ${time}) return true;
      }
      return false;
    })()
  `);
  if (!exists) throw new Error(`No loaded chart bar exists at exact time ${time}; scroll/load that bar first`);
}

export async function drawNote({ style = 'text', time, price, text, overrides: overridesRaw, _deps }) {
  if (!EXACT_BAR_NOTE_SHAPES.has(style)) {
    throw new Error(`Unsupported exact-bar note style: ${style}`);
  }
  if (typeof text !== 'string' || !text.trim()) throw new Error('text must be a non-empty string');
  if (text.length > 10000) throw new Error('text cannot exceed 10000 characters');
  const exactTime = requireFinite(time, 'time');
  const exactPrice = requireFinite(price, 'price');
  await assertExactBarTime(exactTime, _deps);
  const capability = DRAWING_REGISTRY[style];
  const point = { time: exactTime, price: exactPrice };
  const points = capability.arity === 2 ? [point, { ...point }] : [point];
  const overrides = parseOverrides(overridesRaw);
  const entityId = await createRegisteredDrawing({ capability, points, overrides, text, _deps });
  return { success: true, shape: style, entity_id: entityId, exact_bar: true, time: exactTime, price: exactPrice, text };
}

export function drawingCapabilities() {
  const capabilities = listDrawingCapabilities();
  const counts = capabilities.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});
  return { success: true, count: capabilities.length, counts, capabilities };
}

export async function listDrawings({ _deps } = {}) {
  const { evaluate, getChartApi } = _resolve(_deps);
  const apiPath = await getChartApi();
  const shapes = await evaluate(`
    (function() {
      var api = ${apiPath};
      return api.getAllShapes().map(function(s) { return { id: s.id, name: s.name }; });
    })()
  `);
  return { success: true, count: shapes?.length || 0, shapes: shapes || [] };
}

export async function getProperties({ entity_id, _deps } = {}) {
  const { evaluate, getChartApi } = _resolve(_deps);
  const apiPath = await getChartApi();
  const result = await evaluate(`
    (function() {
      var api = ${apiPath};
      var eid = ${safeString(entity_id)};
      var props = { entity_id: eid };
      var shape = api.getShapeById(eid);
      if (!shape) return { error: 'Shape not found: ' + eid };
      try { var pts = shape.getPoints(); if (pts) props.points = pts; } catch(e) { props.points_error = e.message; }
      try { var ovr = shape.getProperties(); if (ovr) props.properties = ovr; } catch(e) {
        try { var ovr2 = shape.properties(); if (ovr2) props.properties = ovr2; } catch(e2) { props.properties_error = e2.message; }
      }
      try { props.visible = shape.isVisible(); } catch(e) {
        props.visible_error = { code: 'DRAWING_VISIBLE_READ_FAILED', message: String(e && e.message || e) };
      }
      try { props.locked = shape.isLocked(); } catch(e) {
        props.locked_error = { code: 'DRAWING_LOCKED_READ_FAILED', message: String(e && e.message || e) };
      }
      try { props.selectable = shape.isSelectionEnabled(); } catch(e) {
        props.selectable_error = { code: 'DRAWING_SELECTABLE_READ_FAILED', message: String(e && e.message || e) };
      }
      var all = api.getAllShapes();
      for (var i = 0; i < all.length; i++) { if (all[i].id === eid) { props.name = all[i].name; break; } }
      return props;
    })()
  `);
  if (result?.error) throw new Error(result.error);
  return { success: true, ...result };
}

export async function updateDrawing({ entity_id, points, anchored_position, overrides: overridesRaw, text, _deps } = {}) {
  const { evaluate, evaluateAsync, getChartApi } = _resolve(_deps);
  const apiPath = await getChartApi();
  const name = await evaluate(`
    (function() {
      var eid = ${safeString(entity_id)};
      var all = ${apiPath}.getAllShapes();
      for (var i = 0; i < all.length; i++) if (all[i].id === eid) return all[i].name;
      return null;
    })()
  `);
  if (!name) throw new Error(`Shape not found: ${entity_id}`);
  const capability = getDrawingCapability(name);
  if (!capability) throw new Error(`Existing shape has unknown capability: ${name}`);
  if (POSITION_SHAPES.has(name) && points !== undefined) {
    throw new Error('Position geometry must be replaced with draw_position, not generic draw_update');
  }
  const normalized = points === undefined ? null : normalizePoints({ points });
  if (normalized) validateArity(capability, normalized);
  const anchored = anchored_position === undefined ? null : validateAnchoredPosition(anchored_position);
  if (anchored && capability.route !== 'anchored') throw new Error(`${name} is not an anchored drawing`);
  const properties = parseOverrides(overridesRaw);
  if (POSITION_SHAPES.has(name) && ('stopLevel' in properties || 'profitLevel' in properties)) {
    throw new Error('Position levels cannot be changed through generic draw_update');
  }
  if (text !== undefined) {
    if (typeof text !== 'string') throw new Error('text must be a string');
    properties.text = text;
  }
  if (!normalized && !anchored && Object.keys(properties).length === 0) {
    throw new Error('draw_update requires points, anchored_position, overrides, or text');
  }
  const result = await evaluateAsync(`
    (async function() {
      var api = ${apiPath};
      var eid = ${safeString(entity_id)};
      var shape = api.getShapeById(eid);
      if (!shape) return { error: 'Shape not found: ' + eid };
      ${normalized ? `await Promise.resolve(shape.setPoints(${JSON.stringify(normalized)}));` : ''}
      ${anchored ? `await Promise.resolve(shape.setAnchoredPosition(${JSON.stringify(anchored)}));` : ''}
      ${Object.keys(properties).length ? `await Promise.resolve(shape.setProperties(${JSON.stringify(properties)}));` : ''}
      var currentPoints;
      try { currentPoints = shape.getPoints(); } catch(e) {
        return {
          error: 'Drawing update completed but authoritative points readback failed: ' + String(e && e.message || e),
          error_code: 'DRAWING_POINTS_READBACK_FAILED',
          entity_id: eid,
          name: ${safeString(name)}
        };
      }
      return { entity_id: eid, name: ${safeString(name)}, points: currentPoints, updated: true };
    })()
  `);
  if (result?.error) {
    const error = new Error(result.error);
    if (result.error_code) error.code = result.error_code;
    error.details = result;
    throw error;
  }
  return { success: true, ...result };
}

export async function removeOne({ entity_id, _deps } = {}) {
  const { evaluateAsync, getChartApi } = _resolve(_deps);
  const apiPath = await getChartApi();
  const result = await evaluateAsync(`
    (async function() {
      var api = ${apiPath};
      var eid = ${safeString(entity_id)};
      var before = api.getAllShapes();
      var found = before.some(function(s) { return s.id === eid; });
      if (!found) return { removed: false, error: 'Shape not found: ' + eid, available: before.map(function(s) { return s.id; }) };
      await Promise.resolve(api.removeEntity(eid));
      var after = api.getAllShapes();
      var stillExists = after.some(function(s) { return s.id === eid; });
      return { removed: !stillExists, entity_id: eid, remaining_shapes: after.length };
    })()
  `);
  if (result?.error) throw new Error(result.error);
  return { success: true, entity_id: result?.entity_id, removed: result?.removed, remaining_shapes: result?.remaining_shapes };
}

/** Legacy destructive operation. Never use for scoped/task cleanup. */
export async function clearAll({ _deps } = {}) {
  const { evaluate, getChartApi } = _resolve(_deps);
  const apiPath = await getChartApi();
  await evaluate(`${apiPath}.removeAllShapes()`);
  return { success: true, action: 'all_shapes_removed', warning: 'destructive_legacy_operation' };
}
