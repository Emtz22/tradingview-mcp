/**
 * Core Pine Script logic — shared between MCP tools and CLI.
 * All functions accept plain options objects and return plain JS objects.
 * They throw on error (callers catch and format).
 */
import { createHash } from 'node:crypto';
import { evaluate, evaluateAsync, getClient } from '../connection.js';
import {
  compilePineInstanceScript,
  newPineInstanceScript,
  openPineInstanceScript,
  pineEditorInstanceId,
  readPineInstanceConsole,
  readPineEditorInstances,
  readPineInstanceMarkers,
  savePineInstanceScript,
  selectPineEditorInstance,
  setPineInstanceSource,
  typedPineError,
} from './pine-instance.js';

// ── Monaco finder (injected into TV page) ──
const FIND_MONACO = `
  (function findMonacoEditor() {
    var container = document.querySelector('.monaco-editor.pine-editor-monaco');
    if (!container) return null;
    var el = container;
    var fiberKey;
    for (var i = 0; i < 20; i++) {
      if (!el) break;
      fiberKey = Object.keys(el).find(function(k) { return k.startsWith('__reactFiber$'); });
      if (fiberKey) break;
      el = el.parentElement;
    }
    if (!fiberKey) return null;
    var current = el[fiberKey];
    for (var d = 0; d < 15; d++) {
      if (!current) break;
      if (current.memoizedProps && current.memoizedProps.value && current.memoizedProps.value.monacoEnv) {
        var env = current.memoizedProps.value.monacoEnv;
        if (env.editor && typeof env.editor.getEditors === 'function') {
          var editors = env.editor.getEditors();
          if (editors.length > 0) return { editor: editors[0], env: env };
        }
      }
      current = current.return;
    }
    return null;
  })()
`;

const UNTITLED_SCRIPT = /^Untitled script$/i;
const PINE_TEMPLATES = Object.freeze({
  indicator: '//@version=6\nindicator("My script")\nplot(close)',
  strategy: '//@version=6\nstrategy("My strategy", overlay=true)\n',
  library: '//@version=6\n// @description TODO: add library description here\nlibrary("MyLibrary")\n',
});

function resolvePineDeps(deps) {
  return {
    evaluate: deps?.evaluate || evaluate,
    evaluateAsync: deps?.evaluateAsync || deps?.evaluate || evaluateAsync,
    getClient: deps?.getClient || getClient,
    ensureEditor: deps?.ensureEditor || ensurePineEditorOpen,
    sleep: deps?.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
    platform: deps?.platform || process.platform,
    getEditorSnapshot: deps?.getEditorSnapshot,
    getSavedScripts: deps?.getSavedScripts,
    getCanonicalSource: deps?.getCanonicalSource,
    setEditorSource: deps?.setEditorSource,
    createNativeDraft: deps?.createNativeDraft,
    activateMenuAction: deps?.activateMenuAction,
    selectOpenScript: deps?.selectOpenScript,
    saveNewScript: deps?.saveNewScript,
    readEditorInstances: deps?.readEditorInstances,
    setInstanceSource: deps?.setInstanceSource,
    newInstanceScript: deps?.newInstanceScript,
    openInstanceScript: deps?.openInstanceScript,
    saveInstanceScript: deps?.saveInstanceScript,
    compileInstanceScript: deps?.compileInstanceScript,
    readInstanceMarkers: deps?.readInstanceMarkers,
    readInstanceConsole: deps?.readInstanceConsole,
    deleteSavedScript: deps?.deleteSavedScript,
    legacySnapshotMode: typeof deps?.getEditorSnapshot === 'function',
  };
}

export function pineSourceSha256(source) {
  return createHash('sha256').update(String(source)).digest('hex');
}

export function pineNormalizedSourceSha256(source) {
  return pineSourceSha256(String(source).replace(/\r\n/g, '\n'));
}

function normalizeSavedScript(script) {
  return {
    id: script.id || script.scriptIdPart || null,
    name: script.name || script.scriptName || script.scriptTitle || 'Untitled',
    title: script.title || script.scriptTitle || null,
    version: script.version || null,
    modified: script.modified || null,
  };
}

export function reconcileScriptContext(snapshot, savedScripts) {
  if (!snapshot || typeof snapshot.source !== 'string') throw new Error('Pine editor snapshot is unavailable');
  const visibleName = String(snapshot.visible_name || '').trim();
  const sourceSha256 = pineSourceSha256(snapshot.source);
  const normalized = (savedScripts || []).map(normalizeSavedScript);
  const target = visibleName.toLowerCase();
  const matches = normalized.filter((script) =>
    String(script.name || '').toLowerCase() === target || String(script.title || '').toLowerCase() === target
  );
  let status = 'ambiguous';
  let saved = null;
  if (UNTITLED_SCRIPT.test(visibleName)) status = 'draft';
  else if (matches.length === 1) { status = 'saved'; saved = matches[0]; }
  const modelUri = snapshot.model_uri ? String(snapshot.model_uri) : null;
  const draftToken = status === 'draft'
    ? pineSourceSha256(`pine-draft-v1\0${modelUri || ''}\0${sourceSha256}`)
    : null;
  return {
    success: true,
    status,
    visible_name: visibleName || null,
    model_uri: modelUri,
    saved_script_id: saved?.id || null,
    saved_version: saved?.version || null,
    saved_modified: saved?.modified || null,
    identity_match_count: matches.length,
    source_sha256: sourceSha256,
    source_normalized_sha256: pineNormalizedSourceSha256(snapshot.source),
    line_count: snapshot.source.split('\n').length,
    char_count: snapshot.source.length,
    draft_token: draftToken,
  };
}

export function reconcileInstanceContext(instance, savedScripts) {
  if (!instance || typeof instance.source !== 'string') {
    throw typedPineError('PINE_EDITOR_INSTANCE_READ_FAILED', 'Selected Pine editor instance has no readable source');
  }
  const normalized = (savedScripts || []).map(normalizeSavedScript);
  const activeId = instance.active_script?.id || null;
  const matches = activeId ? normalized.filter((script) => script.id === activeId) : [];
  const saved = matches.length === 1 ? matches[0] : null;
  const status = activeId === null ? 'draft' : (saved ? 'saved' : 'ambiguous');
  const sourceSha256 = instance.source_sha256 || pineSourceSha256(instance.source);
  const modelUri = instance.model_uri ? String(instance.model_uri) : null;
  const editorInstanceId = instance.editor_instance_id || pineEditorInstanceId(instance.placement);
  const draftToken = status === 'draft'
    ? pineSourceSha256(`pine-draft-v2\0${editorInstanceId}\0${instance.placement}\0${modelUri || ''}\0${sourceSha256}`)
    : null;
  return {
    success: true,
    status,
    editor_instance_id: editorInstanceId,
    placement: instance.placement,
    visible_name: instance.active_script?.name || instance.active_script?.title || null,
    model_uri: modelUri,
    original_model_uri: instance.original_model_uri || null,
    saved_script_id: saved?.id || null,
    saved_version: saved?.version || instance.active_script?.version || null,
    saved_modified: saved?.modified || null,
    identity_match_count: matches.length,
    source_sha256: sourceSha256,
    source_normalized_sha256: instance.source_normalized_sha256 || pineNormalizedSourceSha256(instance.source),
    original_source_sha256: instance.original_source_sha256 || pineSourceSha256(instance.original_source ?? instance.source),
    modified: instance.modified === true,
    line_count: instance.line_count ?? instance.source.split('\n').length,
    char_count: instance.char_count ?? instance.source.length,
    draft_token: draftToken,
    store_source_matches: instance.store_source_matches === true,
    capability_status: instance.capability_status,
    supports: instance.supports,
  };
}

async function readEditorSnapshot(resolved) {
  if (resolved.getEditorSnapshot) return resolved.getEditorSnapshot();
  return resolved.evaluate(`
    (function() {
      var m = ${FIND_MONACO};
      if (!m || !m.editor || !m.editor.getModel()) return null;
      var nameNode = Array.from(document.querySelectorAll('div,button,[role="button"]')).find(function(el) {
        return String(el.className || '').indexOf('nameButton-') !== -1;
      });
      return {
        visible_name: nameNode ? (nameNode.innerText || nameNode.textContent || '').trim() : '',
        model_uri: String(m.editor.getModel().uri || ''),
        source: m.editor.getValue()
      };
    })()
  `);
}

async function fetchSavedScripts(resolved) {
  if (resolved.getSavedScripts) return resolved.getSavedScripts();
  const result = await resolved.evaluateAsync(`
    fetch('https://pine-facade.tradingview.com/pine-facade/list/?filter=saved', { credentials: 'include' })
      .then(function(response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
  `);
  if (!Array.isArray(result)) throw new Error('pine-facade returned an unexpected saved-script list');
  return result.map(normalizeSavedScript);
}

async function fetchCanonicalSource(scriptId, version, resolved) {
  if (resolved.getCanonicalSource) return resolved.getCanonicalSource(scriptId, version);
  const result = await resolved.evaluateAsync(`
    fetch('https://pine-facade.tradingview.com/pine-facade/get/' + encodeURIComponent(${JSON.stringify(String(scriptId))}) + '/' + encodeURIComponent(${JSON.stringify(String(version || 1))}), { credentials: 'include' })
      .then(function(response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
      .then(function(data) { return data && typeof data.source === 'string' ? data.source : null; })
  `);
  if (typeof result !== 'string') throw new Error(`Saved Pine source unavailable for ${scriptId}`);
  return result;
}

async function readInstanceInventory(resolved) {
  return resolved.readEditorInstances
    ? resolved.readEditorInstances()
    : readPineEditorInstances(resolved.evaluate);
}

async function readScriptState(resolved, placement) {
  if (resolved.legacySnapshotMode) {
    if (!await resolved.ensureEditor()) throw new Error('Could not open Pine Editor.');
    const [snapshot, scripts] = await Promise.all([readEditorSnapshot(resolved), fetchSavedScripts(resolved)]);
    return { snapshot, scripts, context: reconcileScriptContext(snapshot, scripts), instance: null, inventory: null };
  }
  const [inventory, scripts] = await Promise.all([readInstanceInventory(resolved), fetchSavedScripts(resolved)]);
  const instance = selectPineEditorInstance(inventory, placement);
  const context = reconcileInstanceContext(instance, scripts);
  return {
    snapshot: {
      visible_name: context.visible_name,
      model_uri: instance.model_uri,
      source: instance.source,
    },
    scripts,
    context,
    instance,
    inventory,
  };
}

export async function listEditorInstances({ _deps } = {}) {
  const resolved = resolvePineDeps(_deps);
  const inventory = await readInstanceInventory(resolved);
  return {
    success: true,
    instances: (inventory.instances || []).map(({ source, original_source, ...receipt }) => receipt),
    orphan_models: inventory.orphan_models || [],
    read_errors: inventory.read_errors || [],
    count: inventory.instances?.length || 0,
  };
}

export async function getCurrentScriptContext({ placement, _deps } = {}) {
  const resolved = resolvePineDeps(_deps);
  return (await readScriptState(resolved, placement)).context;
}

export function assertScriptPrecondition(context, {
  expected_editor_instance_id,
  expected_model_uri,
  expected_script_id,
  expected_draft_token,
  expected_source_sha256,
} = {}) {
  if (context.status === 'ambiguous') {
    throw typedPineError('PINE_EDITOR_SCRIPT_AMBIGUOUS', 'Selected Pine script identity is ambiguous; refusing mutation');
  }
  if (expected_editor_instance_id !== undefined && context.editor_instance_id !== expected_editor_instance_id) {
    throw typedPineError('PINE_EDITOR_CROSS_INSTANCE_REFUSED', `Selected Pine editor instance mismatch: expected ${expected_editor_instance_id}, got ${context.editor_instance_id || 'legacy/unbound'}`);
  }
  if (expected_model_uri !== undefined && context.model_uri !== expected_model_uri) {
    throw typedPineError('PINE_EDITOR_MODEL_STALE', `Selected Pine editor model mismatch: expected ${expected_model_uri}, got ${context.model_uri || 'none'}`);
  }
  const identityCount = Number(expected_script_id !== undefined) + Number(expected_draft_token !== undefined);
  if (identityCount !== 1) throw new Error('Provide exactly one of expected_script_id or expected_draft_token');
  if (expected_script_id !== undefined) {
    if (context.status !== 'saved' || context.saved_script_id !== expected_script_id) {
      throw new Error(`Selected saved script mismatch: expected ${expected_script_id}, got ${context.saved_script_id || context.status}`);
    }
  } else if (context.status !== 'draft' || context.draft_token !== expected_draft_token) {
    throw new Error('Selected draft token mismatch; refusing mutation');
  }
  if (expected_source_sha256 !== undefined && context.source_sha256 !== expected_source_sha256) {
    throw new Error(`Selected source hash mismatch: expected ${expected_source_sha256}, got ${context.source_sha256}`);
  }
  return true;
}

function assertInstanceMutationPrecondition(context, guards) {
  if (typeof guards.expected_editor_instance_id !== 'string' || guards.expected_editor_instance_id.length === 0) {
    throw typedPineError('PINE_EDITOR_INSTANCE_GUARD_REQUIRED', 'expected_editor_instance_id is required for Pine editor mutation');
  }
  if (typeof guards.expected_model_uri !== 'string' || guards.expected_model_uri.length === 0) {
    throw typedPineError('PINE_EDITOR_MODEL_GUARD_REQUIRED', 'expected_model_uri is required for Pine editor mutation');
  }
  if (typeof guards.expected_source_sha256 !== 'string' || guards.expected_source_sha256.length !== 64) {
    throw typedPineError('PINE_EDITOR_SOURCE_GUARD_REQUIRED', 'expected_source_sha256 is required for Pine editor mutation');
  }
  return assertScriptPrecondition(context, guards);
}

/**
 * Opens the Pine Editor panel and waits for Monaco to become available.
 * Returns true if editor is accessible, false on timeout.
 */
export async function ensurePineEditorOpen({ _deps } = {}) {
  const runEvaluate = _deps?.evaluate || evaluate;
  const runSleep = _deps?.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  // Check if Monaco exists AND is visible (not in a hidden/background tab)
  const already = await runEvaluate(`
    (function() {
      var bwb = window.TradingView && window.TradingView.bottomWidgetBar;
      var mode = bwb && bwb._mode && typeof bwb._mode.value === 'function' ? bwb._mode.value() : null;
      if (mode === 'minimized') return false;
      var m = ${FIND_MONACO};
      if (!m || !m.editor) return false;
      var model = m.editor.getModel();
      if (!model) return false;
      var el = document.querySelector('.monaco-editor.pine-editor-monaco');
      if (!el) return false;
      // Check visibility: element must have non-zero dimensions
      return el.offsetHeight > 20;
    })()
  `);
  if (already) return true;

  // Try internal API first (most reliable)
  await runEvaluate(`
    (async function() {
      var bwb = window.TradingView && window.TradingView.bottomWidgetBar;
      if (!bwb) return false;
      var mode = bwb._mode && typeof bwb._mode.value === 'function' ? bwb._mode.value() : null;
      if (mode === 'minimized') {
        if (typeof bwb.open !== 'function') return false;
        await Promise.resolve(bwb.open());
      }
      if (typeof bwb.showWidget === 'function') await Promise.resolve(bwb.showWidget('scripteditor'));
      else if (typeof bwb.activateScriptEditorTab === 'function') await Promise.resolve(bwb.activateScriptEditorTab());
      else return false;
      return true;
    })()
  `);

  // Fallback: try clicking the tab via multiple possible selectors
  await runEvaluate(`
    (function() {
      var btn = document.querySelector('[aria-label="Pine"]')
        || document.querySelector('[aria-label="Open Pine Editor"]')
        || document.querySelector('[aria-label="Pine Editor"]')
        || document.querySelector('[data-name="pine-dialog-button"]')
        || document.querySelector('[data-name="scriptEditor"]');
      if (btn) btn.click();
    })()
  `);

  for (let i = 0; i < 50; i++) {
    await runSleep(200);
    const ready = await runEvaluate(`
      (function() {
        var bwb = window.TradingView && window.TradingView.bottomWidgetBar;
        var mode = bwb && bwb._mode && typeof bwb._mode.value === 'function' ? bwb._mode.value() : null;
        if (mode === 'minimized') return false;
        var m = ${FIND_MONACO};
        if (!m || !m.editor) return false;
        var model = m.editor.getModel();
        return model !== null;
      })()
    `);
    if (ready) return true;
  }
  return false;
}

// ── Pure / offline functions ──

export function analyze({ source }) {
  const lines = source.split('\n');
  const diagnostics = [];

  let isV6 = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('//@version=6')) { isV6 = true; break; }
    if (trimmed.startsWith('//@version=')) break;
    if (trimmed === '' || trimmed.startsWith('//')) continue;
    break;
  }

  const arrays = new Map();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fromMatch = line.match(/(\w+)\s*=\s*array\.from\(([^)]*)\)/);
    if (fromMatch) {
      const name = fromMatch[1].trim();
      const args = fromMatch[2].trim();
      const size = args === '' ? 0 : args.split(',').length;
      arrays.set(name, { name, size, line: i + 1 });
      continue;
    }
    const newMatch = line.match(/(\w+)\s*=\s*array\.new(?:<\w+>|_\w+)\((\d+)?/);
    if (newMatch) {
      const name = newMatch[1].trim();
      const size = newMatch[2] !== undefined ? parseInt(newMatch[2], 10) : null;
      arrays.set(name, { name, size, line: i + 1 });
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const pattern = /array\.(get|set)\(\s*(\w+)\s*,\s*(-?\d+)/g;
    let match;
    while ((match = pattern.exec(line)) !== null) {
      const method = match[1];
      const arrName = match[2];
      const idx = parseInt(match[3], 10);
      const info = arrays.get(arrName);
      if (!info || info.size === null) continue;
      if (idx < 0 || idx >= info.size) {
        diagnostics.push({
          line: i + 1, column: match.index + 1,
          message: `array.${method}(${arrName}, ${idx}) — index ${idx} out of bounds (array size is ${info.size})`,
          severity: 'error',
        });
      }
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const firstLastPattern = /(\w+)\.(first|last)\(\)/g;
    let match;
    while ((match = firstLastPattern.exec(line)) !== null) {
      const arrName = match[1];
      if (arrName === 'array') continue;
      const info = arrays.get(arrName);
      if (info && info.size === 0) {
        diagnostics.push({
          line: i + 1, column: match.index + 1,
          message: `${arrName}.${match[2]}() called on possibly empty array (declared with size 0)`,
          severity: 'warning',
        });
      }
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed.includes('strategy.entry') || trimmed.includes('strategy.close')) {
      let hasStrategyDecl = false;
      for (const l of lines) {
        if (l.trim().startsWith('strategy(')) { hasStrategyDecl = true; break; }
      }
      if (!hasStrategyDecl) {
        diagnostics.push({
          line: i + 1, column: 1,
          message: 'strategy.entry/close used but no strategy() declaration found — did you mean to use indicator()?',
          severity: 'error',
        });
        break;
      }
    }
  }

  if (!isV6 && source.includes('//@version=')) {
    const vMatch = source.match(/\/\/@version=(\d+)/);
    if (vMatch && parseInt(vMatch[1]) < 5) {
      diagnostics.push({
        line: 1, column: 1,
        message: `Script uses Pine v${vMatch[1]} — consider upgrading to v6 for latest features`,
        severity: 'info',
      });
    }
  }

  return {
    success: true,
    issue_count: diagnostics.length,
    diagnostics,
    note: diagnostics.length === 0 ? 'No static analysis issues found. Use pine_compile or pine_smart_compile for full server-side compilation check.' : undefined,
  };
}

export async function check({ source }) {
  const formData = new URLSearchParams();
  formData.append('source', source);

  const response = await fetch(
    'https://pine-facade.tradingview.com/pine-facade/translate_light?user_name=Guest&pine_id=00000000-0000-0000-0000-000000000000',
    {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': 'https://www.tradingview.com/',
      },
      body: formData,
    }
  );

  if (!response.ok) {
    throw new Error(`TradingView API returned ${response.status}: ${response.statusText}`);
  }

  const result = await response.json();
  const errors = [];
  const warnings = [];
  const inner = result?.result;

  if (inner) {
    if (inner.errors2 && inner.errors2.length > 0) {
      for (const e of inner.errors2) {
        errors.push({
          line: e.start?.line, column: e.start?.column,
          end_line: e.end?.line, end_column: e.end?.column,
          message: e.message,
        });
      }
    }
    if (inner.warnings2 && inner.warnings2.length > 0) {
      for (const w of inner.warnings2) {
        warnings.push({ line: w.start?.line, column: w.start?.column, message: w.message });
      }
    }
  }

  if (result.error && typeof result.error === 'string') {
    errors.push({ message: result.error });
  }

  const compiled = errors.length === 0;
  return {
    success: true,
    compiled,
    error_count: errors.length,
    warning_count: warnings.length,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
    note: compiled ? 'Pine Script compiled successfully.' : undefined,
  };
}

// ── Functions requiring TradingView connection ──

function assertSameInstanceReadback(before, after, { allowModelChange = false } = {}) {
  if (after.editor_instance_id !== before.editor_instance_id || after.placement !== before.placement) {
    throw typedPineError('PINE_EDITOR_CROSS_INSTANCE_REFUSED', 'Pine lifecycle readback resolved a different editor instance', {
      before_editor_instance_id: before.editor_instance_id,
      after_editor_instance_id: after.editor_instance_id,
    });
  }
  if (!allowModelChange && after.model_uri !== before.model_uri) {
    throw typedPineError('PINE_EDITOR_MODEL_STALE', 'Pine editor model changed during a same-model mutation', {
      before_model_uri: before.model_uri,
      after_model_uri: after.model_uri,
    });
  }
}

export async function getSource({ placement, _deps } = {}) {
  const resolved = resolvePineDeps(_deps);
  const state = await readScriptState(resolved, placement);
  return { success: true, source: state.snapshot.source, ...state.context };
}

async function replaceEditorSource(source, resolved) {
  if (resolved.setEditorSource) return resolved.setEditorSource(source);
  const escaped = JSON.stringify(source);
  return resolved.evaluate(`
    (function() {
      var m = ${FIND_MONACO};
      if (!m) return false;
      var model = m.editor.getModel();
      if (!model) return false;
      // Use executeEdits with full range replacement to trigger TV's change detection
      var fullRange = model.getFullModelRange();
      m.editor.executeEdits('mcp-set-source', [{
        range: fullRange,
        text: ${escaped},
        forceMoveMarkers: true
      }]);
      return true;
    })()
  `);
}

export async function setSource({
  source,
  placement,
  expected_editor_instance_id,
  expected_model_uri,
  expected_script_id,
  expected_draft_token,
  expected_source_sha256,
  _deps,
}) {
  if (typeof source !== 'string') throw new Error('source must be a string');
  const resolved = resolvePineDeps(_deps);
  const beforeState = await readScriptState(resolved, placement);
  const before = beforeState.context;
  const guards = {
    expected_editor_instance_id,
    expected_model_uri,
    expected_script_id,
    expected_draft_token,
    expected_source_sha256,
  };
  if (resolved.legacySnapshotMode) assertScriptPrecondition(before, guards);
  else assertInstanceMutationPrecondition(before, guards);

  if (!resolved.legacySnapshotMode) {
    const mutate = resolved.setInstanceSource
      ? resolved.setInstanceSource
      : (instance, context, nextSource) => setPineInstanceSource(resolved.evaluateAsync, instance, context, nextSource);
    await mutate(beforeState.instance, before, source);
    const after = (await readScriptState(resolved, placement)).context;
    assertSameInstanceReadback(before, after);
    if (before.status !== after.status || before.saved_script_id !== after.saved_script_id) {
      throw typedPineError('PINE_EDITOR_SCRIPT_STALE', 'Selected Pine script identity changed during source replacement');
    }
    if (after.source_sha256 !== pineSourceSha256(source)) {
      throw typedPineError('PINE_EDITOR_READBACK_FAILED', 'Selected Pine editor source hash did not match after source replacement', {
        expected_source_sha256: pineSourceSha256(source),
        actual_source_sha256: after.source_sha256,
      });
    }
    return {
      success: true,
      lines_set: source.split('\n').length,
      before_source_sha256: before.source_sha256,
      source_sha256: after.source_sha256,
      context: after,
    };
  }

  const set = await replaceEditorSource(source, resolved);

  if (!set) throw new Error('Monaco found but executeEdits() failed.');
  const after = (await readScriptState(resolved, placement)).context;
  if (before.status === 'saved' && (after.status !== 'saved' || after.saved_script_id !== before.saved_script_id)) {
    throw new Error('Selected saved-script identity changed during source replacement');
  }
  if (before.status === 'draft' && after.status !== 'draft') {
    throw new Error('Selected draft identity changed during source replacement');
  }
  return {
    success: true,
    lines_set: source.split('\n').length,
    before_source_sha256: before.source_sha256,
    source_sha256: after.source_sha256,
    context: after,
  };
}

export async function compile({
  placement,
  expected_editor_instance_id,
  expected_model_uri,
  expected_script_id,
  expected_draft_token,
  expected_source_sha256,
  _deps,
} = {}) {
  const resolved = resolvePineDeps(_deps);
  if (!resolved.legacySnapshotMode) {
    const beforeState = await readScriptState(resolved, placement);
    const guards = {
      expected_editor_instance_id,
      expected_model_uri,
      expected_script_id,
      expected_draft_token,
      expected_source_sha256,
    };
    assertInstanceMutationPrecondition(beforeState.context, guards);
    const compileSelected = resolved.compileInstanceScript
      ? resolved.compileInstanceScript
      : (instance, context) => compilePineInstanceScript(resolved.evaluateAsync, instance, context);
    await compileSelected(beforeState.instance, beforeState.context);
    await resolved.sleep(300);
    const markers = resolved.readInstanceMarkers
      ? await resolved.readInstanceMarkers(placement)
      : await readPineInstanceMarkers(resolved.evaluate, placement);
    const after = (await readScriptState(resolved, placement)).context;
    assertSameInstanceReadback(beforeState.context, after);
    if (beforeState.context.source_sha256 !== after.source_sha256) {
      throw typedPineError('PINE_EDITOR_SOURCE_STALE', 'Selected Pine source changed during compile');
    }
    return {
      success: true,
      action: 'facade.addToChart',
      editor_instance_id: after.editor_instance_id,
      placement: after.placement,
      model_uri: after.model_uri,
      has_errors: markers.length > 0,
      errors: markers,
    };
  }
  const editorReady = await ensurePineEditorOpen();
  if (!editorReady) throw new Error('Could not open Pine Editor.');

  const clicked = await evaluate(`
    (function() {
      var btns = document.querySelectorAll('button');
      var fallback = null;
      var saveBtn = null;
      for (var i = 0; i < btns.length; i++) {
        var text = btns[i].textContent.trim();
        if (/save and add to chart/i.test(text)) {
          btns[i].click();
          return 'Save and add to chart';
        }
        if (!fallback && /^(Add to chart|Update on chart)/i.test(text)) {
          fallback = btns[i];
        }
        if (!saveBtn && btns[i].className.indexOf('saveButton') !== -1 && btns[i].offsetParent !== null) {
          saveBtn = btns[i];
        }
      }
      if (fallback) { fallback.click(); return fallback.textContent.trim(); }
      if (saveBtn) { saveBtn.click(); return 'Pine Save'; }
      return null;
    })()
  `);

  if (!clicked) {
    const c = await getClient();
    await c.Input.dispatchKeyEvent({ type: 'keyDown', modifiers: 2, key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await c.Input.dispatchKeyEvent({ type: 'keyUp', key: 'Enter', code: 'Enter' });
  }

  await new Promise(r => setTimeout(r, 2000));

  const markers = await evaluate(`
    (function() {
      var m = ${FIND_MONACO};
      if (!m) return [];
      var model = m.editor.getModel();
      if (!model) return [];
      var markers = m.env.editor.getModelMarkers({ resource: model.uri });
      return markers.map(function(mk) {
        return { line: mk.startLineNumber, column: mk.startColumn, message: mk.message, severity: mk.severity };
      });
    })()
  `);

  const errors = markers || [];
  return {
    success: true,
    button_clicked: clicked || 'keyboard_shortcut',
    source: 'dom_fallback',
    has_errors: errors.length > 0,
    errors,
  };
}

export async function getErrors({ placement, _deps } = {}) {
  const resolved = resolvePineDeps(_deps);
  if (!resolved.legacySnapshotMode) {
    const state = await readScriptState(resolved, placement);
    const errors = resolved.readInstanceMarkers
      ? await resolved.readInstanceMarkers(state.context.placement)
      : await readPineInstanceMarkers(resolved.evaluate, state.context.placement);
    return {
      success: true,
      editor_instance_id: state.context.editor_instance_id,
      placement: state.context.placement,
      model_uri: state.context.model_uri,
      has_errors: errors.length > 0,
      error_count: errors.length,
      errors,
    };
  }
  const editorReady = await ensurePineEditorOpen();
  if (!editorReady) throw new Error('Could not open Pine Editor.');

  const errors = await evaluate(`
    (function() {
      var m = ${FIND_MONACO};
      if (!m) return [];
      var model = m.editor.getModel();
      if (!model) return [];
      var markers = m.env.editor.getModelMarkers({ resource: model.uri });
      return markers.map(function(mk) {
        return { line: mk.startLineNumber, column: mk.startColumn, message: mk.message, severity: mk.severity };
      });
    })()
  `);

  return {
    success: true,
    has_errors: errors?.length > 0,
    error_count: errors?.length || 0,
    errors: errors || [],
  };
}

async function activatePineMenuAction(label, resolved) {
  if (resolved.activateMenuAction) return resolved.activateMenuAction(label);
  await resolved.evaluate(`
    (function() {
      var dialogs = Array.from(document.querySelectorAll('[role="dialog"]'));
      for (var i = 0; i < dialogs.length; i++) {
        if ((dialogs[i].innerText || dialogs[i].textContent || '').indexOf('Open my script') !== 0) continue;
        var close = Array.from(dialogs[i].querySelectorAll('button')).find(function(button) {
          return (button.innerText || button.textContent || '').trim() === 'Close menu';
        });
        if (close) close.click();
      }
      return true;
    })()
  `);
  await resolved.sleep(50);
  const opened = await resolved.evaluate(`
    (function() {
      var header = Array.from(document.querySelectorAll('div,button,[role="button"]')).find(function(el) {
        return String(el.className || '').indexOf('nameButton-') !== -1;
      });
      if (!header) return false;
      header.click();
      return true;
    })()
  `);
  if (!opened) return false;
  await resolved.sleep(100);
  return resolved.evaluate(`
    (function() {
      var label = ${JSON.stringify(label)};
      var item = Array.from(document.querySelectorAll('[role="menuitem"]')).find(function(el) {
        var text = (el.innerText || el.textContent || '').trim();
        return el.getAttribute('aria-label') === label || text === label || text.indexOf(label + '\\n') === 0;
      });
      if (!item) return false;
      item.click();
      return true;
    })()
  `);
}

async function createNativeDraft(type, resolved) {
  if (resolved.createNativeDraft) return resolved.createNativeDraft(type);
  const direct = await resolved.evaluate(`
    (async function() {
      var bar = window.TradingView && window.TradingView.bottomWidgetBar;
      var config = bar && bar._config && bar._config.scripteditor;
      var instance = config && config.ctor && typeof config.ctor.getInstance === 'function' ? config.ctor.getInstance() : null;
      var facade = instance && instance._facade;
      if (!facade || typeof facade.openNewScript !== 'function') return { activated: false, route: null };
      await facade.openNewScript(${JSON.stringify(type)});
      return { activated: true, route: 'scripteditor._facade.openNewScript' };
    })()
  `);
  if (direct?.activated) return true;
  const opened = await resolved.evaluate(`
    (function() {
      var header = Array.from(document.querySelectorAll('div,button,[role="button"]')).find(function(el) {
        return String(el.className || '').indexOf('nameButton-') !== -1;
      });
      if (!header) return false;
      header.click();
      return true;
    })()
  `);
  if (!opened) return false;
  await resolved.sleep(100);
  const createNewTarget = await resolved.evaluate(`
    (function() {
      var item = Array.from(document.querySelectorAll('[role="menuitem"]')).find(function(el) {
        var rect = el.getBoundingClientRect();
        return (el.innerText || el.textContent || '').trim() === 'Create new' && el.offsetParent && rect.width > 0 && rect.height > 0;
      });
      if (!item) return null;
      var rect = item.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })()
  `);
  if (!createNewTarget || !Number.isFinite(createNewTarget.x) || !Number.isFinite(createNewTarget.y)) return false;
  const client = await resolved.getClient();
  await client.Input.dispatchMouseEvent({ type: 'mouseMoved', x: createNewTarget.x, y: createNewTarget.y });
  await resolved.sleep(250);
  const label = type[0].toUpperCase() + type.slice(1);
  const target = await resolved.evaluate(`
    (function() {
      var item = Array.from(document.querySelectorAll('[role="menuitem"]')).find(function(el) {
        var rect = el.getBoundingClientRect();
        return el.getAttribute('aria-label') === ${JSON.stringify(label)} && el.offsetParent && rect.width > 0 && rect.height > 0;
      });
      if (!item) return null;
      var rect = item.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })()
  `);
  if (!target || !Number.isFinite(target.x) || !Number.isFinite(target.y)) return false;
  await client.Input.dispatchMouseEvent({ type: 'mouseMoved', x: target.x, y: target.y });
  await client.Input.dispatchMouseEvent({ type: 'mousePressed', x: target.x, y: target.y, button: 'left', clickCount: 1 });
  await client.Input.dispatchMouseEvent({ type: 'mouseReleased', x: target.x, y: target.y, button: 'left', clickCount: 1 });
  return true;
}

async function waitForCanonicalHash(scriptId, version, expectedNormalizedHash, resolved) {
  let lastError = null;
  let lastObservedHash = null;
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const source = await fetchCanonicalSource(scriptId, version, resolved);
      lastObservedHash = pineNormalizedSourceSha256(source);
      if (lastObservedHash === expectedNormalizedHash) {
        return { matched: true, last_error: null, last_observed_hash: lastObservedHash };
      }
    } catch (error) {
      lastError = {
        code: 'PINE_CANONICAL_SOURCE_FETCH_FAILED',
        message: String(error && error.message || error),
      };
    }
    await resolved.sleep(150);
  }
  return { matched: false, last_error: lastError, last_observed_hash: lastObservedHash };
}

async function saveNewScriptCanonical(name, source, resolved) {
  if (resolved.saveNewScript) return resolved.saveNewScript(name, source);
  const result = await resolved.evaluateAsync(`
    (function() {
      var base = new URL(window.PINE_URL || 'https://pine-facade.tradingview.com/pine-facade/', location.origin);
      if (!base.pathname.endsWith('/')) base.pathname += '/';
      var url = new URL('save/new', base);
      url.searchParams.set('name', ${JSON.stringify(name)});
      var form = new FormData();
      form.append('source', ${JSON.stringify(source)});
      return fetch(url.toString(), { method: 'POST', mode: 'cors', credentials: 'include', body: form })
        .then(function(response) { return response.json().then(function(body) { return { ok: response.ok, status: response.status, body: body }; }); });
    })()
  `);
  if (!result?.ok || result?.body?.error || result?.body?.success === false) {
    throw new Error(`Pine save/new failed with HTTP ${result?.status}: ${result?.body?.error || 'save rejected'}`);
  }
  return result.body;
}

export async function save({
  placement,
  expected_editor_instance_id,
  expected_model_uri,
  expected_script_id,
  expected_source_sha256,
  _deps,
} = {}) {
  const resolved = resolvePineDeps(_deps);
  const beforeState = await readScriptState(resolved, placement);
  const guards = {
    expected_editor_instance_id,
    expected_model_uri,
    expected_script_id,
    expected_source_sha256,
  };
  if (resolved.legacySnapshotMode) assertScriptPrecondition(beforeState.context, guards);
  else assertInstanceMutationPrecondition(beforeState.context, guards);
  if (beforeState.context.status !== 'saved') throw new Error('Use pine_save_as with a name for an unsaved draft');

  let action = 'facade.saveScript';
  if (resolved.legacySnapshotMode) {
    action = 'native_save_menu';
    const clicked = await activatePineMenuAction('Save script', resolved);
    if (!clicked) {
      const c = await resolved.getClient();
      const modifiers = resolved.platform === 'darwin' ? 4 : 2;
      action = resolved.platform === 'darwin' ? 'Meta+S' : 'Control+S';
      await c.Input.dispatchKeyEvent({ type: 'keyDown', modifiers, key: 's', code: 'KeyS', windowsVirtualKeyCode: 83 });
      await c.Input.dispatchKeyEvent({ type: 'keyUp', key: 's', code: 'KeyS' });
    }
  } else {
    const saveSelected = resolved.saveInstanceScript
      ? resolved.saveInstanceScript
      : (instance, context) => savePineInstanceScript(resolved.evaluateAsync, instance, context);
    await saveSelected(beforeState.instance, beforeState.context);
  }

  const persisted = await waitForCanonicalHash(
    beforeState.context.saved_script_id,
    beforeState.context.saved_version,
    beforeState.context.source_normalized_sha256,
    resolved,
  );
  if (!persisted.matched) {
    const detail = persisted.last_error
      ? ` Last canonical fetch error: ${persisted.last_error.message}`
      : ` Last observed normalized SHA-256: ${persisted.last_observed_hash || 'none'}`;
    const error = new Error(`Pine save was dispatched but canonical saved source did not match the editor hash.${detail}`);
    error.code = 'PINE_CANONICAL_SOURCE_VERIFY_FAILED';
    error.details = persisted;
    throw error;
  }
  const after = (await readScriptState(resolved, placement)).context;
  if (!resolved.legacySnapshotMode) {
    assertSameInstanceReadback(beforeState.context, after);
    if (after.status !== 'saved' || after.saved_script_id !== beforeState.context.saved_script_id) {
      throw typedPineError('PINE_EDITOR_SCRIPT_STALE', 'Selected Pine script changed during save readback');
    }
    if (after.source_normalized_sha256 !== beforeState.context.source_normalized_sha256) {
      throw typedPineError('PINE_EDITOR_SOURCE_STALE', 'Selected Pine source changed during save readback', {
        before_source_normalized_sha256: beforeState.context.source_normalized_sha256,
        after_source_normalized_sha256: after.source_normalized_sha256,
      });
    }
  }
  return { success: true, action, persisted: true, context: after };
}

export async function saveAs({
  name,
  placement,
  expected_editor_instance_id,
  expected_model_uri,
  expected_script_id,
  expected_draft_token,
  expected_source_sha256,
  _deps,
}) {
  const requestedName = String(name || '').trim();
  if (!requestedName || requestedName.length > 200) throw new Error('name must be 1 to 200 characters');
  const resolved = resolvePineDeps(_deps);
  const beforeState = await readScriptState(resolved, placement);
  const guards = {
    expected_editor_instance_id,
    expected_model_uri,
    expected_script_id,
    expected_draft_token,
    expected_source_sha256,
  };
  if (resolved.legacySnapshotMode) assertScriptPrecondition(beforeState.context, guards);
  else assertInstanceMutationPrecondition(beforeState.context, guards);
  const collision = beforeState.scripts.some((script) =>
    String(script.name || '').toLowerCase() === requestedName.toLowerCase() ||
    String(script.title || '').toLowerCase() === requestedName.toLowerCase()
  );
  if (collision) throw new Error(`A saved Pine script named "${requestedName}" already exists`);

  const saveResponse = await saveNewScriptCanonical(requestedName, beforeState.snapshot.source, resolved);
  const rawCreatedIdHint = saveResponse?.scriptIdPart || saveResponse?.script_id || saveResponse?.id || null;
  const createdIdHint = typeof rawCreatedIdHint === 'string' && rawCreatedIdHint.includes(';') ? rawCreatedIdHint : null;

  let lastCanonicalError = null;
  let lastObservedHash = null;
  let lastCandidateScriptIds = [];
  let created = null;
  for (let attempt = 0; attempt < 40; attempt++) {
    const scripts = (await fetchSavedScripts(resolved)).map(normalizeSavedScript);
    const nameMatches = scripts.filter((script) => String(script.name).toLowerCase() === requestedName.toLowerCase());
    const candidates = createdIdHint ? nameMatches.filter((script) => script.id === createdIdHint) : nameMatches;
    lastCandidateScriptIds = candidates.map((script) => script.id);
    if (candidates.length > 1) {
      throw typedPineError('PINE_SAVE_AS_CREATED_ID_AMBIGUOUS', `Pine save-as produced multiple candidate IDs for "${requestedName}"`, {
        candidate_script_ids: candidates.map((script) => script.id),
        created_id_hint: createdIdHint,
      });
    }
    const match = candidates[0];
    if (match) {
      try {
        const canonical = await fetchCanonicalSource(match.id, match.version, resolved);
        lastObservedHash = pineNormalizedSourceSha256(canonical);
        if (lastObservedHash === beforeState.context.source_normalized_sha256) {
          created = match;
          break;
        }
      } catch (error) {
        lastCanonicalError = {
          code: 'PINE_CANONICAL_SOURCE_FETCH_FAILED',
          message: String(error && error.message || error),
          script_id: match.id,
          version: match.version,
        };
      }
    }
    if (created) break;
    await resolved.sleep(150);
  }
  if (created && resolved.legacySnapshotMode) {
    return {
      success: true,
      action: 'saved_as_via_pine_facade',
      name: created.name,
      script_id: created.id,
      version: created.version,
      source_sha256: beforeState.context.source_sha256,
      source_normalized_sha256: beforeState.context.source_normalized_sha256,
    };
  }
  if (created) {
    const openSelected = resolved.openInstanceScript
      ? resolved.openInstanceScript
      : (instance, context, target, options) => openPineInstanceScript(resolved.evaluateAsync, instance, context, target, options);
    try {
      await openSelected(beforeState.instance, beforeState.context, created, { allow_dirty: true });
      for (let attempt = 0; attempt < 40; attempt++) {
        const after = (await readScriptState(resolved, placement)).context;
        assertSameInstanceReadback(beforeState.context, after, { allowModelChange: true });
        if (
          after.model_uri !== beforeState.context.model_uri &&
          after.status === 'saved' &&
          after.saved_script_id === created.id &&
          after.source_normalized_sha256 === beforeState.context.source_normalized_sha256
        ) {
          return {
            success: true,
            action: 'saved_as_via_pine_facade_and_bound',
            name: created.name,
            script_id: created.id,
            version: created.version,
            source_sha256: after.source_sha256,
            source_normalized_sha256: after.source_normalized_sha256,
            context: after,
          };
        }
        await resolved.sleep(150);
      }
    } catch (error) {
      throw typedPineError('PINE_SAVE_AS_CREATED_BIND_FAILED', `Pine script ${created.id} was created but could not be bound to the selected editor instance: ${error.message}`, {
        script_id: created.id,
        version: created.version,
        cause_code: error.code || null,
        cause_details: error.details || null,
      });
    }
    throw typedPineError('PINE_SAVE_AS_CREATED_BIND_FAILED', `Pine script ${created.id} was created but the selected editor did not expose a verified transition`, {
      script_id: created.id,
      version: created.version,
      editor_instance_id: beforeState.context.editor_instance_id,
      previous_model_uri: beforeState.context.model_uri,
    });
  }
  const detail = lastCanonicalError
    ? ` Last canonical fetch error: ${lastCanonicalError.message}`
    : ` Last observed normalized SHA-256: ${lastObservedHash || 'none'}`;
  const error = new Error(`Pine save-as did not produce a verified saved script named "${requestedName}".${detail}`);
  error.code = 'PINE_SAVE_AS_VERIFY_FAILED';
  error.details = {
    last_canonical_error: lastCanonicalError,
    last_observed_hash: lastObservedHash,
    candidate_script_ids: lastCandidateScriptIds,
    created_id_hint: createdIdHint,
  };
  throw error;
}

export async function readStudyCountDiagnostic(stage, { _deps } = {}) {
  const evaluateFn = _deps?.evaluate || evaluate;
  const result = await evaluateFn(`
    (function() {
      try {
        var chart = window.TradingViewApi._activeChartWidgetWV.value();
        if (!chart || typeof chart.getAllStudies !== 'function') {
          return {
            count: null,
            error: { code: 'PINE_STUDY_COUNT_UNSUPPORTED', stage: ${JSON.stringify(stage)}, message: 'getAllStudies is unavailable' }
          };
        }
        return { count: chart.getAllStudies().length, error: null };
      } catch(e) {
        return {
          count: null,
          error: { code: 'PINE_STUDY_COUNT_READ_FAILED', stage: ${JSON.stringify(stage)}, message: String(e && e.message || e) }
        };
      }
    })()
  `);
  if (!result || (result.count !== null && !Number.isInteger(result.count))) {
    return {
      count: null,
      error: { code: 'PINE_STUDY_COUNT_INVALID_RESULT', stage, message: 'Study-count probe returned an invalid result' },
    };
  }
  return result;
}

export async function getConsole({ placement, _deps } = {}) {
  const resolved = resolvePineDeps(_deps);
  if (!resolved.legacySnapshotMode) {
    const state = await readScriptState(resolved, placement);
    const entries = resolved.readInstanceConsole
      ? await resolved.readInstanceConsole(state.context.placement)
      : await readPineInstanceConsole(resolved.evaluate, state.context.placement);
    return {
      success: true,
      editor_instance_id: state.context.editor_instance_id,
      placement: state.context.placement,
      model_uri: state.context.model_uri,
      entries,
      entry_count: entries.length,
    };
  }
  const editorReady = await ensurePineEditorOpen();
  if (!editorReady) throw new Error('Could not open Pine Editor.');

  const entries = await evaluate(`
    (function() {
      var results = [];
      var rows = document.querySelectorAll('[class*="consoleRow"], [class*="log-"], [class*="consoleLine"]');
      if (rows.length === 0) {
        var bottomArea = document.querySelector('[class*="layout__area--bottom"]')
          || document.querySelector('[class*="bottom-widgetbar-content"]');
        if (bottomArea) {
          rows = bottomArea.querySelectorAll('[class*="message"], [class*="log"], [class*="console"]');
        }
      }
      if (rows.length === 0) {
        var pinePanel = document.querySelector('.pine-editor-container')
          || document.querySelector('[class*="pine-editor"]')
          || document.querySelector('[class*="layout__area--bottom"]');
        if (pinePanel) {
          var allSpans = pinePanel.querySelectorAll('span, div');
          for (var s = 0; s < allSpans.length; s++) {
            var txt = allSpans[s].textContent.trim();
            if (/^\\d{2}:\\d{2}:\\d{2}/.test(txt) || /error|warning|info/i.test(allSpans[s].className)) {
              rows = Array.from(rows || []);
              rows.push(allSpans[s]);
            }
          }
        }
      }
      for (var i = 0; i < rows.length; i++) {
        var text = rows[i].textContent.trim();
        if (!text) continue;
        var ts = null;
        var tsMatch = text.match(/^(\\d{4}-\\d{2}-\\d{2}\\s+)?\\d{2}:\\d{2}:\\d{2}/);
        if (tsMatch) ts = tsMatch[0];
        var type = 'info';
        var cls = rows[i].className || '';
        if (/error/i.test(cls) || /error/i.test(text.substring(0, 30))) type = 'error';
        else if (/compil/i.test(text.substring(0, 40))) type = 'compile';
        else if (/warn/i.test(cls)) type = 'warning';
        results.push({ timestamp: ts, type: type, message: text });
      }
      return results;
    })()
  `);

  return { success: true, entries: entries || [], entry_count: entries?.length || 0 };
}

export async function smartCompile(args = {}) {
  const resolved = resolvePineDeps(args._deps);
  if (!resolved.legacySnapshotMode) {
    const studiesBeforeDiagnostic = await readStudyCountDiagnostic('before', { _deps: args._deps });
    const compiled = await compile(args);
    const studiesAfterDiagnostic = await readStudyCountDiagnostic('after', { _deps: args._deps });
    const studyAdded = (
      studiesBeforeDiagnostic.count !== null && studiesAfterDiagnostic.count !== null
    ) ? studiesAfterDiagnostic.count > studiesBeforeDiagnostic.count : null;
    return {
      ...compiled,
      study_added: studyAdded,
      study_count_before_error: studiesBeforeDiagnostic.error,
      study_count_after_error: studiesAfterDiagnostic.error,
    };
  }
  const editorReady = await ensurePineEditorOpen();
  if (!editorReady) throw new Error('Could not open Pine Editor.');

  const studiesBeforeDiagnostic = await readStudyCountDiagnostic('before');
  const studiesBefore = studiesBeforeDiagnostic.count;

  // Capture markers BEFORE compile to detect when they change
  const markersBefore = await evaluate(`
    (function() {
      var m = ${FIND_MONACO};
      if (!m) return { count: -1, hash: '' };
      var model = m.editor.getModel();
      if (!model) return { count: -1, hash: '' };
      var markers = m.env.editor.getModelMarkers({ resource: model.uri });
      var hash = markers.map(function(mk) { return mk.startLineNumber + ':' + mk.message; }).join('|');
      return { count: markers.length, hash: hash };
    })()
  `);

  const buttonClicked = await evaluate(`
    (function() {
      function isVisible(el) { return el && el.offsetParent !== null; }
      var btns = document.querySelectorAll('button');
      var addBtn = null;
      var updateBtn = null;
      var saveBtn = null;
      var visibleTexts = [];
      for (var i = 0; i < btns.length; i++) {
        var b = btns[i];
        if (!isVisible(b)) continue;
        var text = b.textContent.trim();
        visibleTexts.push(text);
        if (/save\\s+and\\s+add\\s+to\\s+chart/i.test(text)) {
          b.click();
          return 'Save and add to chart';
        }
        if (!addBtn && /add\\s+to\\s+chart/i.test(text)) addBtn = b;
        if (!updateBtn && /update\\s+(on|to)\\s+chart/i.test(text)) updateBtn = b;
        if (!saveBtn && (b.className.indexOf('saveButton') !== -1 || /save/i.test(text)) && isVisible(b)) saveBtn = b;
      }
      if (addBtn) { addBtn.click(); return 'Add to chart'; }
      if (updateBtn) { updateBtn.click(); return 'Update on chart'; }
      if (saveBtn) {
        saveBtn.click();
        // Re-scan once for add/update button that may appear after save
        var btns2 = document.querySelectorAll('button');
        for (var j = 0; j < btns2.length; j++) {
          if (!isVisible(btns2[j])) continue;
          var t2 = btns2[j].textContent.trim();
          if (/add\\s+to\\s+chart/i.test(t2) || /update\\s+(on|to)\\s+chart/i.test(t2)) {
            btns2[j].click();
            return 'Pine Save then ' + t2;
          }
        }
        return 'Pine Save';
      }
      return { no_button_found: true, available_buttons: visibleTexts };
    })()
  `);

  // buttonClicked is a string on success, an object { no_button_found, available_buttons } when no button was found, or null
  const noButtonFound = !buttonClicked || (typeof buttonClicked === 'object' && buttonClicked.no_button_found);
  if (noButtonFound) {
    const c = await getClient();
    await c.Input.dispatchKeyEvent({ type: 'keyDown', modifiers: 2, key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await c.Input.dispatchKeyEvent({ type: 'keyUp', key: 'Enter', code: 'Enter' });
  }

  // Poll until markers change (compile complete) or timeout (8s)
  let errors = [];
  for (let attempt = 0; attempt < 40; attempt++) {
    await new Promise(r => setTimeout(r, 200));
    const current = await evaluate(`
      (function() {
        var m = ${FIND_MONACO};
        if (!m) return { markers: [], count: -1, hash: '' };
        var model = m.editor.getModel();
        if (!model) return { markers: [], count: -1, hash: '' };
        var markers = m.env.editor.getModelMarkers({ resource: model.uri });
        var hash = markers.map(function(mk) { return mk.startLineNumber + ':' + mk.message; }).join('|');
        return {
          markers: markers.map(function(mk) {
            return { line: mk.startLineNumber, column: mk.startColumn, message: mk.message, severity: mk.severity };
          }),
          count: markers.length,
          hash: hash
        };
      })()
    `);
    // Markers changed from before = compile finished
    if (current.hash !== markersBefore?.hash) {
      errors = current.markers;
      break;
    }
    // After minimum 2.5s, if still same markers and count is 0, assume clean compile
    if (attempt >= 12 && current.count === 0 && markersBefore?.count === 0) {
      errors = [];
      break;
    }
  }

  // Timeout: hash never changed (same errors re-compiled). Do one final read to capture current markers.
  if (errors.length === 0) {
    const finalMarkers = await evaluate(`
      (function() {
        var m = ${FIND_MONACO};
        if (!m) return [];
        var model = m.editor.getModel();
        if (!model) return [];
        var markers = m.env.editor.getModelMarkers({ resource: model.uri });
        return markers.map(function(mk) {
          return { line: mk.startLineNumber, column: mk.startColumn, message: mk.message, severity: mk.severity };
        });
      })()
    `);
    errors = finalMarkers || [];
  }

  const studiesAfterDiagnostic = await readStudyCountDiagnostic('after');
  const studiesAfter = studiesAfterDiagnostic.count;

  const studyAdded = (studiesBefore !== null && studiesAfter !== null) ? studiesAfter > studiesBefore : null;

  return {
    success: true,
    button_clicked: buttonClicked || 'keyboard_shortcut',
    has_errors: errors?.length > 0,
    errors: errors || [],
    study_added: studyAdded,
    study_count_before_error: studiesBeforeDiagnostic.error,
    study_count_after_error: studiesAfterDiagnostic.error,
  };
}

export async function newScript({
  type,
  placement,
  expected_editor_instance_id,
  expected_model_uri,
  expected_script_id,
  expected_draft_token,
  expected_source_sha256,
  _deps,
} = {}) {
  if (!Object.hasOwn(PINE_TEMPLATES, type)) throw new Error('type must be indicator, strategy, or library');
  const resolved = resolvePineDeps(_deps);
  const beforeState = await readScriptState(resolved, placement);
  const before = beforeState.context;
  if (!resolved.legacySnapshotMode) {
    const guards = {
      expected_editor_instance_id,
      expected_model_uri,
      expected_script_id,
      expected_draft_token,
      expected_source_sha256,
    };
    assertInstanceMutationPrecondition(before, guards);
    if (before.modified) {
      throw typedPineError('PINE_EDITOR_DIRTY', 'Refusing Pine New because the selected editor has unsaved modifications');
    }
    const createSelected = resolved.newInstanceScript
      ? resolved.newInstanceScript
      : (instance, context, scriptType) => newPineInstanceScript(resolved.evaluateAsync, instance, context, scriptType);
    await createSelected(beforeState.instance, before, type);
    for (let attempt = 0; attempt < 40; attempt++) {
      const afterState = await readScriptState(resolved, placement);
      const after = afterState.context;
      assertSameInstanceReadback(before, after, { allowModelChange: true });
      if (
        after.model_uri !== before.model_uri &&
        after.status === 'draft' &&
        after.saved_script_id === null &&
        after.draft_token &&
        after.store_source_matches === true &&
        afterState.scripts.length === beforeState.scripts.length
      ) {
        return {
          success: true,
          type,
          action: 'facade.openNewScript',
          previous_context: before,
          context: after,
        };
      }
      await resolved.sleep(100);
    }
    throw typedPineError('PINE_NEW_NO_OBSERVABLE_TRANSITION', 'Selected Pine editor facade returned from New without a verified same-instance model transition', {
      editor_instance_id: before.editor_instance_id,
      previous_model_uri: before.model_uri,
      previous_script_id: before.saved_script_id,
    });
  }
  if (!await createNativeDraft(type, resolved)) throw new Error(`Could not activate Create new > ${type}`);

  let draft = null;
  for (let attempt = 0; attempt < 40; attempt++) {
    const candidate = (await readScriptState(resolved)).context;
    if (candidate.status === 'draft' && candidate.visible_name && candidate.draft_token) {
      draft = candidate;
      break;
    }
    await resolved.sleep(100);
  }
  if (!draft) throw new Error('Native Pine New did not transition to a distinct Untitled draft; source was not changed');
  if (before.status === 'saved' && draft.saved_script_id === before.saved_script_id) {
    throw new Error('Native Pine New retained the selected saved script; source was not changed');
  }

  const set = await replaceEditorSource(PINE_TEMPLATES[type], resolved);
  if (!set) throw new Error('Draft was created but its template could not be initialized');
  const after = (await readScriptState(resolved)).context;
  if (after.status !== 'draft') throw new Error('Pine draft identity changed while initializing its template');
  return {
    success: true,
    type,
    action: 'native_draft_created',
    previous_context: before,
    context: after,
  };
}

async function selectOpenScript(name, resolved) {
  if (resolved.selectOpenScript) return resolved.selectOpenScript(name);
  for (let attempt = 0; attempt < 30; attempt++) {
    const selected = await resolved.evaluate(`
      (function() {
        var dialog = document.querySelector('[role="dialog"]');
        if (!dialog) return false;
        var node = Array.from(dialog.querySelectorAll('[data-name="open-script-dialog-item-name"]')).find(function(el) {
          return (el.innerText || el.textContent || '').trim() === ${JSON.stringify(name)};
        });
        if (node) { node.click(); return true; }
        var search = dialog.querySelector('input[role="searchbox"], input[placeholder="Search"]');
        if (search && search.value !== ${JSON.stringify(name)}) {
          var setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
          setter.call(search, ${JSON.stringify(name)});
          search.dispatchEvent(new Event('input', { bubbles: true }));
          search.dispatchEvent(new Event('change', { bubbles: true }));
          return 'searching';
        }
        return false;
      })()
    `);
    if (selected === true) return true;
    await resolved.sleep(100);
  }
  return false;
}

export async function openScript({
  name,
  placement,
  expected_editor_instance_id,
  expected_model_uri,
  expected_script_id,
  expected_draft_token,
  expected_source_sha256,
  _deps,
} = {}) {
  const requestedName = String(name || '').trim();
  if (!requestedName) throw new Error('name is required');
  const resolved = resolvePineDeps(_deps);
  const beforeState = await readScriptState(resolved, placement);
  const target = beforeState.scripts.map(normalizeSavedScript).filter((script) =>
    String(script.name).toLowerCase() === requestedName.toLowerCase() ||
    String(script.title || '').toLowerCase() === requestedName.toLowerCase()
  );
  if (target.length !== 1) throw new Error(`Expected one exact saved script named "${requestedName}", found ${target.length}`);
  const match = target[0];

  if (!resolved.legacySnapshotMode) {
    const guards = {
      expected_editor_instance_id,
      expected_model_uri,
      expected_script_id,
      expected_draft_token,
      expected_source_sha256,
    };
    assertInstanceMutationPrecondition(beforeState.context, guards);
    if (beforeState.context.modified) {
      throw typedPineError('PINE_EDITOR_DIRTY', 'Refusing Pine Open because the selected editor has unsaved modifications');
    }
    const canonical = await fetchCanonicalSource(match.id, match.version, resolved);
    const canonicalHash = pineNormalizedSourceSha256(canonical);
    if (beforeState.context.status === 'saved' && beforeState.context.saved_script_id === match.id) {
      if (beforeState.context.source_normalized_sha256 !== canonicalHash) {
        throw typedPineError('PINE_EDITOR_READBACK_FAILED', 'Already-selected Pine script does not match canonical saved source');
      }
      return {
        success: true,
        name: match.name,
        script_id: match.id,
        lines: beforeState.context.line_count,
        source: 'facade_already_selected_verified',
        opened: false,
        context: beforeState.context,
      };
    }
    const openSelected = resolved.openInstanceScript
      ? resolved.openInstanceScript
      : (instance, context, script) => openPineInstanceScript(resolved.evaluateAsync, instance, context, script);
    await openSelected(beforeState.instance, beforeState.context, match);
    for (let attempt = 0; attempt < 40; attempt++) {
      const after = (await readScriptState(resolved, placement)).context;
      assertSameInstanceReadback(beforeState.context, after, { allowModelChange: true });
      if (
        after.model_uri !== beforeState.context.model_uri &&
        after.status === 'saved' &&
        after.saved_script_id === match.id &&
        after.source_normalized_sha256 === canonicalHash
      ) {
        return {
          success: true,
          name: match.name,
          script_id: match.id,
          lines: after.line_count,
          source: 'facade_open_verified',
          opened: true,
          context: after,
        };
      }
      await resolved.sleep(100);
    }
    throw typedPineError('PINE_OPEN_NO_OBSERVABLE_TRANSITION', `Selected Pine editor did not transition to verified script ID ${match.id}`, {
      editor_instance_id: beforeState.context.editor_instance_id,
      previous_model_uri: beforeState.context.model_uri,
      target_script_id: match.id,
    });
  }

  if (beforeState.context.status === 'saved' && beforeState.context.saved_script_id === match.id) {
    const canonical = await fetchCanonicalSource(match.id, match.version, resolved);
    if (pineSourceSha256(canonical) !== beforeState.context.source_sha256) {
      if (!await replaceEditorSource(canonical, resolved)) throw new Error('Could not restore canonical source for selected script');
    }
  } else {
    if (!await activatePineMenuAction('Open script…', resolved)) throw new Error('Could not open the native Pine script picker');
    if (!await selectOpenScript(match.name, resolved)) throw new Error(`Could not select exact saved script "${match.name}"`);
  }

  for (let attempt = 0; attempt < 40; attempt++) {
    const context = (await readScriptState(resolved)).context;
    if (context.status === 'saved' && context.saved_script_id === match.id) {
      const canonical = await fetchCanonicalSource(match.id, match.version, resolved);
      const canonicalHash = pineNormalizedSourceSha256(canonical);
      if (context.source_normalized_sha256 !== canonicalHash) {
        if (!await replaceEditorSource(canonical, resolved)) throw new Error('Selected script source did not load and canonical restoration failed');
      }
      const verified = (await readScriptState(resolved)).context;
      if (verified.status !== 'saved' || verified.saved_script_id !== match.id || verified.source_normalized_sha256 !== canonicalHash) {
        throw new Error(`Native Pine open selected ${match.id} but canonical source verification failed`);
      }
      return { success: true, name: match.name, script_id: match.id, lines: verified.line_count, source: 'native_ui_verified', opened: true, context: verified };
    }
    await resolved.sleep(100);
  }
  throw new Error(`Native Pine open did not select verified script ID ${match.id}`);
}

export async function listScripts({ _deps } = {}) {
  const resolved = resolvePineDeps(_deps);
  const scripts = (await fetchSavedScripts(resolved)).map(normalizeSavedScript);
  return { success: true, scripts, count: scripts.length, source: 'internal_api' };
}

async function deleteSavedScriptExact(scriptId, resolved) {
  if (resolved.deleteSavedScript) return resolved.deleteSavedScript(scriptId);
  let result;
  try {
    result = await resolved.evaluateAsync(`
      (async function() {
        var bar = window.TradingView && window.TradingView.bottomWidgetBar;
        var config = bar && bar._config && bar._config.scripteditor;
        var widget = config && config.ctor && typeof config.ctor.getInstance === 'function' ? config.ctor.getInstance() : null;
        var bridge = widget && widget._bridge;
        if (bridge && typeof bridge.deleteScript === 'function') {
          var bridgeBody = await bridge.deleteScript(${JSON.stringify(String(scriptId))});
          return { ok: true, status: 200, body: bridgeBody || null, route: 'scripteditor._bridge.deleteScript' };
        }
        var base = new URL(window.PINE_URL || 'https://pine-facade.tradingview.com/pine-facade/', location.origin);
        if (!base.pathname.endsWith('/')) base.pathname += '/';
        var url = new URL('delete/' + ${JSON.stringify(String(scriptId))}, base);
        return fetch(url.toString(), { method: 'POST', mode: 'cors', credentials: 'include' })
          .then(function(response) {
            return response.text().then(function(text) {
              var body = null;
              if (text) {
                try { body = JSON.parse(text); }
                catch (error) { body = { raw_response: text.slice(0, 500), parse_error: String(error && error.message || error) }; }
              }
              return { ok: response.ok, status: response.status, body: body, route: 'pine-facade/delete/exact-id' };
            });
          });
      })()
    `);
  } catch (error) {
    throw typedPineError('PINE_DELETE_REQUEST_FAILED', `Exact-ID Pine delete request failed for ${scriptId}: ${error.message}`, {
      script_id: scriptId,
      cause_code: error.code || null,
    });
  }
  if (!result?.ok || result?.body?.error || result?.body?.success === false) {
    throw typedPineError('PINE_DELETE_REQUEST_FAILED', `Exact-ID Pine delete was rejected for ${scriptId}`, {
      script_id: scriptId,
      http_status: result?.status || null,
      response_error: result?.body?.error || null,
      parse_error: result?.body?.parse_error || null,
    });
  }
  return result;
}

export async function deleteScript({
  script_id,
  expected_name,
  expected_version,
  _deps,
}) {
  const scriptId = String(script_id || '').trim();
  const expectedName = String(expected_name || '').trim();
  const expectedVersion = String(expected_version || '').trim();
  if (!scriptId) throw new Error('script_id is required');
  if (!expectedName) throw new Error('expected_name is required');
  if (!expectedVersion) throw new Error('expected_version is required');
  const resolved = resolvePineDeps(_deps);
  const before = (await fetchSavedScripts(resolved)).map(normalizeSavedScript);
  const matches = before.filter((script) => script.id === scriptId);
  if (matches.length !== 1) {
    throw typedPineError('PINE_DELETE_IDENTITY_MISMATCH', `Expected one saved Pine script with ID ${scriptId}, found ${matches.length}`);
  }
  const target = matches[0];
  if (target.name !== expectedName || String(target.version) !== expectedVersion) {
    throw typedPineError('PINE_DELETE_IDENTITY_MISMATCH', 'Exact Pine delete name/version guard did not match', {
      script_id: scriptId,
      expected_name: expectedName,
      actual_name: target.name,
      expected_version: expectedVersion,
      actual_version: target.version,
    });
  }
  const deletion = await deleteSavedScriptExact(scriptId, resolved);
  for (let attempt = 0; attempt < 40; attempt++) {
    const after = (await fetchSavedScripts(resolved)).map(normalizeSavedScript);
    if (!after.some((script) => script.id === scriptId)) {
      const beforeOtherIds = before.filter((script) => script.id !== scriptId).map((script) => script.id);
      const afterIds = new Set(after.map((script) => script.id));
      const unrelatedMissingIds = beforeOtherIds.filter((id) => !afterIds.has(id));
      if (unrelatedMissingIds.length > 0) {
        throw typedPineError('PINE_DELETE_UNRELATED_CHANGE_DETECTED', 'Exact-ID Pine delete readback found unrelated saved scripts missing', {
          removed_script_id: scriptId,
          unrelated_missing_script_ids: unrelatedMissingIds,
        });
      }
      return {
        success: true,
        action: 'exact_id_delete_verified',
        route: deletion?.route || 'injected_delete_dependency',
        removed_script_id: scriptId,
        removed_name: target.name,
        removed_version: target.version,
        count_before: before.length,
        count_after: after.length,
      };
    }
    await resolved.sleep(150);
  }
  throw typedPineError('PINE_DELETE_VERIFY_FAILED', `Pine script ID ${scriptId} remained in the saved list after exact-ID delete`, {
    script_id: scriptId,
    expected_name: expectedName,
    expected_version: expectedVersion,
  });
}
