/**
 * Core batch execution logic.
 * Reuses proven core functions instead of custom JS evaluation.
 */
import { evaluate, getClient } from '../connection.js';
import { setSymbol, setTimeframe } from './chart.js';
import { getOhlcv } from './data.js';
import { getStrategyResults } from './data.js';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname, basename, resolve, sep } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = join(dirname(dirname(__dirname)), 'screenshots');

/**
 * Strip path separators, drive letters, and dot-segments from a user-supplied
 * string so it can be safely used as a plain filename component.
 */
function sanitizeBasename(str) {
  const stripped = String(str).replace(/^[a-zA-Z]:/, '').replace(/\.\./g, '');
  return basename(stripped).replace(/[/\\]/g, '') || '_';
}

/**
 * Verify that a resolved file path is strictly inside allowedDir.
 * Throws if the path escapes the directory.
 */
function assertUnderDir(filePath, allowedDir) {
  const resolvedFile = resolve(filePath);
  const resolvedDir = resolve(allowedDir);
  if (!resolvedFile.startsWith(resolvedDir + sep) &&
      resolvedFile !== resolvedDir) {
    throw new Error(`Path traversal detected: "${resolvedFile}" is outside "${resolvedDir}"`);
  }
}

export async function batchRun({ symbols, timeframes, action, delay_ms, ohlcv_count }) {
  const tfs = timeframes && timeframes.length > 0 ? timeframes : [null];
  const delay = delay_ms || 2000;
  const results = [];

  for (const symbol of symbols) {
    for (const tf of tfs) {
      const combo = { symbol, timeframe: tf };
      try {
        // Use proven setSymbol from chart.js
        await setSymbol({ symbol });

        if (tf) {
          await setTimeframe({ timeframe: tf });
        }

        await new Promise(r => setTimeout(r, delay));

        let actionResult;
        if (action === 'screenshot') {
          mkdirSync(SCREENSHOT_DIR, { recursive: true });
          const client = await getClient();
          const { data } = await client.Page.captureScreenshot({ format: 'png' });
          const ts = new Date().toISOString().replace(/[:.]/g, '-');
          const safeSymbol = sanitizeBasename(symbol);
          const safeTf = sanitizeBasename(tf || 'default');
          const fname = `batch_${safeSymbol}_${safeTf}_${ts}.png`;
          const filePath = join(SCREENSHOT_DIR, fname);
          assertUnderDir(filePath, SCREENSHOT_DIR);
          writeFileSync(filePath, Buffer.from(data, 'base64'));
          actionResult = { file_path: filePath };
        } else if (action === 'get_ohlcv') {
          // Use proven getOhlcv from data.js
          const ohlcvResult = await getOhlcv({ count: ohlcv_count || 100, summary: true });
          actionResult = {
            bar_count: ohlcvResult.bar_count,
            open: ohlcvResult.open,
            close: ohlcvResult.close,
            high: ohlcvResult.high,
            low: ohlcvResult.low,
            change_pct: ohlcvResult.change_pct,
          };
        } else if (action === 'get_strategy_results') {
          // Use proven getStrategyResults from data.js
          const stratResult = await getStrategyResults();
          actionResult = { metric_count: stratResult.metric_count, metrics: stratResult.metrics };
        } else {
          actionResult = { error: 'Unknown action: ' + action };
        }
        results.push({ ...combo, success: true, result: actionResult });
      } catch (err) {
        results.push({ ...combo, success: false, error: err.message });
      }
    }
  }

  const successCount = results.filter(r => r.success).length;
  return { success: true, total_iterations: results.length, successful: successCount, failed: results.length - successCount, results };
}
