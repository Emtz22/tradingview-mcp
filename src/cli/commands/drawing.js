import { register } from '../router.js';
import * as core from '../../core/drawing.js';

function parsePoints(raw) {
  if (!raw) return undefined;
  let value;
  try { value = JSON.parse(raw); }
  catch (error) { throw new Error(`--points must be valid JSON: ${error.message}`); }
  if (!Array.isArray(value)) throw new Error('--points must be a JSON array');
  return value;
}

register('draw', {
  description: 'Typed drawing tools (capabilities, shape, position, note, list, get, update, remove, clear)',
  subcommands: new Map([
    ['capabilities', {
      description: 'List drawing names, arity, routes, and unsupported dispositions',
      handler: () => core.drawingCapabilities(),
    }],
    ['shape', {
      description: 'Create a registry-approved TradingView drawing',
      options: {
        type: { type: 'string', short: 't', description: 'Shape name from `tv draw capabilities`' },
        points: { type: 'string', description: 'JSON array of {time,price} points (preferred)' },
        price: { type: 'string', short: 'p', description: 'Legacy first-point price' },
        time: { type: 'string', description: 'Legacy first-point Unix timestamp' },
        price2: { type: 'string', description: 'Legacy second-point price' },
        time2: { type: 'string', description: 'Legacy second-point Unix timestamp' },
        'anchored-position': { type: 'string', description: 'JSON {x,y} in 0..1 viewport coordinates' },
        text: { type: 'string', description: 'Text for text-capable drawings' },
        icon: { type: 'string', description: 'Numeric Unicode icon codepoint for icon' },
        overrides: { type: 'string', description: 'JSON style override object' },
      },
      handler: (opts) => {
        const points = parsePoints(opts.points);
        const anchored_position = opts['anchored-position'] ? JSON.parse(opts['anchored-position']) : undefined;
        const point = points || anchored_position ? undefined : { time: Number(opts.time), price: Number(opts.price) };
        const point2 = points || anchored_position || opts.price2 === undefined
          ? undefined
          : { time: Number(opts.time2), price: Number(opts.price2) };
        return core.drawShape({
          shape: opts.type || 'horizontal_line', points, point, point2, anchored_position,
          overrides: opts.overrides, text: opts.text,
          icon: opts.icon === undefined ? undefined : Number(opts.icon),
        });
      },
    }],
    ['position', {
      description: 'Create a native long/short position object',
      options: {
        side: { type: 'string', description: 'long or short' },
        entry: { type: 'string', description: 'Entry price' },
        stop: { type: 'string', description: 'Stop price' },
        target: { type: 'string', description: 'Target price' },
        'start-time': { type: 'string', description: 'Start Unix timestamp' },
        'end-time': { type: 'string', description: 'Time-horizon Unix timestamp' },
        'tick-size': { type: 'string', description: 'Explicit tick size; otherwise symbol metadata is used' },
        overrides: { type: 'string', description: 'JSON style override object' },
      },
      handler: (opts) => core.drawPosition({
        side: opts.side,
        entry: Number(opts.entry), stop: Number(opts.stop), target: Number(opts.target),
        start_time: Number(opts['start-time']), end_time: Number(opts['end-time']),
        tick_size: opts['tick-size'] === undefined ? undefined : Number(opts['tick-size']),
        overrides: opts.overrides,
      }),
    }],
    ['note', {
      description: 'Create an exact-loaded-bar text/callout/note',
      options: {
        style: { type: 'string', description: 'text, note, callout, price_note, comment, price_label, signpost, or flag' },
        time: { type: 'string', description: 'Exact loaded-bar Unix timestamp' },
        price: { type: 'string', short: 'p', description: 'Price' },
        text: { type: 'string', description: 'Non-empty note text' },
        overrides: { type: 'string', description: 'JSON style override object' },
      },
      handler: (opts) => core.drawNote({
        style: opts.style || 'text', time: Number(opts.time), price: Number(opts.price),
        text: opts.text, overrides: opts.overrides,
      }),
    }],
    ['list', {
      description: 'List all drawings on the chart',
      handler: () => core.listDrawings(),
    }],
    ['get', {
      description: 'Get properties of a drawing',
      handler: (opts, positionals) => core.getProperties({ entity_id: positionals[0] }),
    }],
    ['update', {
      description: 'Update one drawing by exact entity ID',
      options: {
        points: { type: 'string', description: 'JSON array of replacement points' },
        'anchored-position': { type: 'string', description: 'JSON {x,y} for anchored drawings' },
        text: { type: 'string', description: 'Replacement text' },
        overrides: { type: 'string', description: 'JSON property overrides' },
      },
      handler: (opts, positionals) => core.updateDrawing({
        entity_id: positionals[0],
        points: parsePoints(opts.points),
        anchored_position: opts['anchored-position'] ? JSON.parse(opts['anchored-position']) : undefined,
        text: opts.text,
        overrides: opts.overrides,
      }),
    }],
    ['remove', {
      description: 'Remove a drawing by exact entity ID',
      handler: (opts, positionals) => core.removeOne({ entity_id: positionals[0] }),
    }],
    ['clear', {
      description: 'DESTRUCTIVE legacy operation: remove every drawing',
      handler: () => core.clearAll(),
    }],
  ]),
});
