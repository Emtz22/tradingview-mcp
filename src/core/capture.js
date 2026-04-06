/**
 * Core screenshot/capture logic.
 */
import { getClient, evaluate, getChartCollection } from '../connection.js';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname, resolve, basename, sep } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = join(dirname(dirname(__dirname)), 'screenshots');

/**
 * Strip path separators, drive letters, and dot-segments from a user-supplied
 * string so it can be safely used as a plain filename component.
 */
function sanitizeBasename(str) {
  // Remove drive letters (e.g. "C:"), then take only the final path component,
  // then strip any remaining characters that are not alphanumeric, hyphen,
  // underscore, or dot so that sequences like ".." become ".."-free tokens.
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

export async function captureScreenshot({ region, filename, method } = {}) {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const safeRegion = region ? sanitizeBasename(region) : 'full';
  const rawName = filename ? sanitizeBasename(filename) : `tv_${safeRegion}_${ts}`;
  // Ensure the extension is always .png and there is no embedded path component.
  const fname = rawName.replace(/\.png$/i, '');
  const filePath = join(SCREENSHOT_DIR, `${fname}.png`);
  assertUnderDir(filePath, SCREENSHOT_DIR);

  if (method === 'api') {
    try {
      const colPath = await getChartCollection();
      await evaluate(`${colPath}.takeScreenshot()`);
      return {
        success: true, method: 'api',
        note: 'takeScreenshot() triggered — TradingView will save/show the screenshot via its own UI',
      };
    } catch {
      // Fall through to CDP method
    }
  }

  const client = await getClient();
  let clip = undefined;

  if (region === 'chart') {
    const bounds = await evaluate(`
      (function() {
        var el = document.querySelector('[data-name="pane-canvas"]')
          || document.querySelector('[class*="chart-container"]')
          || document.querySelector('canvas');
        if (!el) return null;
        var rect = el.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      })()
    `);
    if (bounds) clip = { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, scale: 1 };
  } else if (region === 'strategy_tester') {
    const bounds = await evaluate(`
      (function() {
        var el = document.querySelector('[data-name="backtesting"]')
          || document.querySelector('[class*="strategyReport"]');
        if (!el) return null;
        var rect = el.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      })()
    `);
    if (bounds) clip = { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, scale: 1 };
  }

  const params = { format: 'png' };
  if (clip) params.clip = clip;

  const { data } = await client.Page.captureScreenshot(params);
  writeFileSync(filePath, Buffer.from(data, 'base64'));

  return {
    success: true, method: 'cdp', file_path: filePath, region,
    size_bytes: Buffer.from(data, 'base64').length,
  };
}
