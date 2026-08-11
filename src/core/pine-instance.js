import { createHash } from 'node:crypto';

const INSTANCE_PREFIX = 'pine-editor-v1:';

function sha256(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

export function pineEditorInstanceId(placement) {
  return `${INSTANCE_PREFIX}${placement}`;
}

export function typedPineError(code, message, details = undefined) {
  const error = new Error(message);
  error.code = code;
  if (details !== undefined) error.details = details;
  return error;
}

const PAGE_INSTANCE_HELPER = `
  function pineEditorContainerState(container) {
    var rect = container && typeof container.getBoundingClientRect === 'function'
      ? container.getBoundingClientRect()
      : null;
    return {
      visible: !!(container && container.offsetParent && rect && rect.width > 0 && rect.height > 0),
      bounds: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null
    };
  }
  function findPineEditorInstances() {
    function findFiber(element) {
      var current = element;
      for (var depth = 0; depth < 20 && current; depth++, current = current.parentElement) {
        var key = Object.keys(current).find(function(candidate) { return candidate.indexOf('__reactFiber$') === 0; });
        if (key) return current[key];
      }
      return null;
    }
    var containers = Array.from(document.querySelectorAll('.monaco-editor.pine-editor-monaco'));
    var found = [];
    for (var index = 0; index < containers.length; index++) {
      var container = containers[index];
      var fiber = findFiber(container);
      var facade = null;
      var placement = null;
      var monacoEnv = null;
      for (var depth = 0; depth < 20 && fiber; depth++, fiber = fiber.return) {
        var props = fiber.memoizedProps;
        if (!props || typeof props !== 'object') continue;
        var candidates = [props, props.value];
        for (var candidateIndex = 0; candidateIndex < candidates.length; candidateIndex++) {
          var candidate = candidates[candidateIndex];
          if (!candidate || typeof candidate !== 'object') continue;
          if (!facade && candidate.facade) facade = candidate.facade;
          if (placement === null && candidate.placement !== undefined) placement = candidate.placement;
          if (!monacoEnv && candidate.monacoEnv) monacoEnv = candidate.monacoEnv;
        }
      }
      if (!facade) continue;
      if (found.some(function(entry) { return entry.facade === facade; })) continue;
      found.push({
        facade: facade,
        placement: String(placement || facade.placement || facade._placement || 'unknown'),
        container: container,
        monacoEnv: monacoEnv
      });
    }
    return found;
  }
  function resolvePineEditorInstance(placement) {
    var all = findPineEditorInstances();
    var placementMatches = all.filter(function(entry) { return entry.placement === placement; });
    var matches = placementMatches.filter(function(entry) { return pineEditorContainerState(entry.container).visible; });
    if (matches.length === 0 && placementMatches.length > 0) {
      return { error: { code: 'PINE_EDITOR_INSTANCE_NOT_VISIBLE', message: 'No visible React-owned Pine editor instance for placement ' + placement, inactive_count: placementMatches.length } };
    }
    if (matches.length === 0) return { error: { code: 'PINE_EDITOR_INSTANCE_NOT_FOUND', message: 'No React-owned Pine editor instance for placement ' + placement } };
    if (matches.length > 1) return { error: { code: 'PINE_EDITOR_INSTANCE_DUPLICATE', message: 'Multiple visible React-owned Pine editor instances for placement ' + placement, count: matches.length } };
    var instance = matches[0];
    var facade = instance.facade;
    var store = facade && facade._editorStore;
    var editorRef = facade && facade._editorRef && facade._editorRef.current;
    if (!store || !editorRef) return { error: { code: 'PINE_EDITOR_INSTANCE_STALE', message: 'Pine editor facade is missing its store or editor ref' } };
    return { instance: instance, facade: facade, store: store, editorRef: editorRef };
  }
  function snapshotPineEditorInstance(resolved) {
    var instance = resolved.instance;
    var facade = resolved.facade;
    var store = resolved.store;
    var editorRef = resolved.editorRef;
    var active = store.getEditorActiveScript();
    var source = editorRef.getValue();
    var originalModel = typeof editorRef.getOriginalModel === 'function' ? editorRef.getOriginalModel() : null;
    var modifiedModel = typeof editorRef.getModifiedModel === 'function' ? editorRef.getModifiedModel() : null;
    var originalSource = originalModel && typeof originalModel.getValue === 'function' ? originalModel.getValue() : source;
    var modelUri = modifiedModel && modifiedModel.uri ? String(modifiedModel.uri) : (instance.container.getAttribute('data-uri') || null);
    var containerState = pineEditorContainerState(instance.container);
    var rect = containerState.bounds;
    return {
      placement: instance.placement,
      model_uri: modelUri,
      original_model_uri: originalModel && originalModel.uri ? String(originalModel.uri) : null,
      source: source,
      original_source: originalSource,
      store_source_matches: !!active && active.scriptSource === source,
      visible: containerState.visible,
      container: {
        id: instance.container.id || null,
        class_name: String(instance.container.className || ''),
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
      },
      active_script: active ? {
        id: active.scriptIdPart || null,
        name: active.scriptName || null,
        title: active.scriptTitle || null,
        version: active.version || null,
        pine_version: active.pineVersion || null
      } : null,
      supports: {
        new_script: typeof facade.openNewScript === 'function',
        set_source: typeof facade.setScript === 'function' || typeof editorRef.setValue === 'function',
        open_script: typeof facade.openScript === 'function',
        save: typeof facade.saveScript === 'function',
        compile_add: typeof facade.addToChart === 'function'
      }
    };
  }
  function guardPineEditorInstance(resolved, expected) {
    var snapshot = snapshotPineEditorInstance(resolved);
    if (snapshot.model_uri !== expected.model_uri) {
      return { error: { code: 'PINE_EDITOR_MODEL_STALE', message: 'Pine editor model URI changed before mutation', expected: expected.model_uri, actual: snapshot.model_uri } };
    }
    if (snapshot.source !== expected.source) {
      return { error: { code: 'PINE_EDITOR_SOURCE_STALE', message: 'Pine editor source changed before mutation' } };
    }
    var actualId = snapshot.active_script && snapshot.active_script.id;
    if (expected.script_id !== undefined && expected.script_id !== null && actualId !== expected.script_id) {
      return { error: { code: 'PINE_EDITOR_SCRIPT_STALE', message: 'Selected saved script changed before mutation', expected: expected.script_id, actual: actualId } };
    }
    if (expected.expect_draft === true && actualId !== null) {
      return { error: { code: 'PINE_EDITOR_SCRIPT_STALE', message: 'Selected draft changed to a saved script before mutation', actual: actualId } };
    }
    return { snapshot: snapshot };
  }
`;

function normalizeRawInstance(raw) {
  const source = String(raw.source ?? '');
  const originalSource = String(raw.original_source ?? source);
  return {
    editor_instance_id: pineEditorInstanceId(raw.placement),
    placement: raw.placement,
    model_uri: raw.model_uri,
    original_model_uri: raw.original_model_uri,
    source,
    original_source: originalSource,
    source_sha256: sha256(source),
    source_normalized_sha256: sha256(source.replace(/\r\n/g, '\n')),
    original_source_sha256: sha256(originalSource),
    modified: source !== originalSource,
    line_count: source.split('\n').length,
    char_count: source.length,
    store_source_matches: raw.store_source_matches === true,
    visible: raw.visible === true,
    container: raw.container,
    active_script: raw.active_script,
    supports: raw.supports,
    capability_status: 'runtime_private_verified',
  };
}

function throwPageError(result, fallbackCode) {
  if (!result?.error) return result;
  throw typedPineError(result.error.code || fallbackCode, result.error.message || fallbackCode, result.error);
}

export async function readPineEditorInstances(evaluateFn) {
  const result = await evaluateFn(`
    (function() {
      ${PAGE_INSTANCE_HELPER}
      var instances = findPineEditorInstances();
      var snapshots = [];
      var readErrors = [];
      for (var index = 0; index < instances.length; index++) {
        try {
          snapshots.push(snapshotPineEditorInstance({
            instance: instances[index],
            facade: instances[index].facade,
            store: instances[index].facade._editorStore,
            editorRef: instances[index].facade._editorRef && instances[index].facade._editorRef.current
          }));
        } catch (error) {
          var failedState = pineEditorContainerState(instances[index].container);
          readErrors.push({
            code: 'PINE_EDITOR_INSTANCE_READ_FAILED',
            placement: instances[index].placement,
            message: String(error && error.message || error),
            visible: failedState.visible,
            bounds: failedState.bounds
          });
        }
      }
      var ownedNodes = instances.map(function(entry) { return entry.container; });
      var orphanModels = [];
      var seenEnvs = [];
      for (var instanceIndex = 0; instanceIndex < instances.length; instanceIndex++) {
        var env = instances[instanceIndex].monacoEnv;
        if (!env || seenEnvs.indexOf(env) !== -1) continue;
        seenEnvs.push(env);
        var editors = env.editor && typeof env.editor.getEditors === 'function' ? env.editor.getEditors() : [];
        for (var editorIndex = 0; editorIndex < editors.length; editorIndex++) {
          var node = typeof editors[editorIndex].getDomNode === 'function' ? editors[editorIndex].getDomNode() : null;
          if (ownedNodes.indexOf(node) !== -1) continue;
          var model = typeof editors[editorIndex].getModel === 'function' ? editors[editorIndex].getModel() : null;
          var value = typeof editors[editorIndex].getValue === 'function' ? editors[editorIndex].getValue() : '';
          var rect = node && node.getBoundingClientRect ? node.getBoundingClientRect() : null;
          orphanModels.push({
            model_uri: model && model.uri ? String(model.uri) : null,
            source: value,
            visible: !!(node && node.offsetParent && rect && rect.width > 0 && rect.height > 0),
            bounds: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null
          });
        }
      }
      return { instances: snapshots, orphan_models: orphanModels, read_errors: readErrors };
    })()
  `);
  const instances = (result?.instances || []).map(normalizeRawInstance);
  const placementCounts = new Map();
  for (const instance of instances) {
    if (instance.visible) placementCounts.set(instance.placement, (placementCounts.get(instance.placement) || 0) + 1);
  }
  for (const instance of instances) {
    if (!instance.visible) instance.capability_status = 'inactive_hidden_unsupported';
    else if (placementCounts.get(instance.placement) > 1) instance.capability_status = 'ambiguous_duplicate_placement';
  }
  return {
    instances,
    orphan_models: (result?.orphan_models || []).map((model) => ({
      model_uri: model.model_uri,
      source_sha256: sha256(model.source || ''),
      line_count: String(model.source || '').split('\n').length,
      char_count: String(model.source || '').length,
      visible: model.visible === true,
      bounds: model.bounds,
      capability_status: 'orphan_model_unsupported',
    })),
    read_errors: result?.read_errors || [],
  };
}

export function selectPineEditorInstance(inventory, placement) {
  const instances = inventory?.instances || [];
  const relevantReadErrors = (inventory?.read_errors || []).filter((error) =>
    error.visible !== false && (!placement || error.placement === placement)
  );
  if (relevantReadErrors.length > 0) {
    throw typedPineError('PINE_EDITOR_INSTANCE_READ_FAILED', `A visible Pine editor facade${placement ? ` for placement ${placement}` : ''} could not be read safely`, {
      read_errors: relevantReadErrors,
    });
  }
  if (!placement) {
    const visibleInstances = instances.filter((instance) => instance.visible === true);
    if (visibleInstances.length === 0 && instances.length > 0) {
      throw typedPineError('PINE_EDITOR_INSTANCE_NOT_VISIBLE', 'No visible Pine editor instance is available', {
        inactive_instances: instances.map(({ editor_instance_id, placement: value, model_uri }) => ({ editor_instance_id, placement: value, model_uri })),
      });
    }
    if (visibleInstances.length !== 1) {
      throw typedPineError('PINE_EDITOR_INSTANCE_AMBIGUOUS', `Expected one visible Pine editor instance, found ${visibleInstances.length}; provide placement`, {
        available_instances: instances.map(({ editor_instance_id, placement: value, model_uri, visible }) => ({ editor_instance_id, placement: value, model_uri, visible })),
      });
    }
    const selected = visibleInstances[0];
    if (!selected.store_source_matches) {
      throw typedPineError('PINE_EDITOR_READBACK_FAILED', `Pine editor store/source disagreement for placement ${selected.placement}`, {
        editor_instance_id: selected.editor_instance_id,
        model_uri: selected.model_uri,
      });
    }
    return selected;
  }
  const placementMatches = instances.filter((instance) => instance.placement === placement);
  const matches = placementMatches.filter((instance) => instance.visible === true);
  if (matches.length === 0 && placementMatches.length > 0) {
    throw typedPineError('PINE_EDITOR_INSTANCE_NOT_VISIBLE', `No visible Pine editor instance for placement ${placement}`, {
      inactive_model_uris: placementMatches.map((instance) => instance.model_uri),
    });
  }
  if (matches.length === 0) throw typedPineError('PINE_EDITOR_INSTANCE_NOT_FOUND', `No Pine editor instance for placement ${placement}`);
  if (matches.length > 1) throw typedPineError('PINE_EDITOR_INSTANCE_DUPLICATE', `Multiple visible Pine editor instances for placement ${placement}`);
  if (!matches[0].store_source_matches) {
    throw typedPineError('PINE_EDITOR_READBACK_FAILED', `Pine editor store/source disagreement for placement ${placement}`, {
      editor_instance_id: matches[0].editor_instance_id,
      model_uri: matches[0].model_uri,
    });
  }
  return matches[0];
}

function expectedPayload(instance, context) {
  return {
    model_uri: instance.model_uri,
    source: instance.source,
    script_id: context.status === 'saved' ? context.saved_script_id : null,
    expect_draft: context.status === 'draft',
  };
}

export async function setPineInstanceSource(evaluateAsyncFn, instance, context, source) {
  const result = await evaluateAsyncFn(`
    (async function() {
      ${PAGE_INSTANCE_HELPER}
      var resolved = resolvePineEditorInstance(${JSON.stringify(instance.placement)});
      if (resolved.error) return resolved;
      var guarded = guardPineEditorInstance(resolved, ${JSON.stringify(expectedPayload(instance, context))});
      if (guarded.error) return guarded;
      if (typeof resolved.editorRef.setValue === 'function') resolved.editorRef.setValue(${JSON.stringify(source)});
      else if (typeof resolved.facade.setScript === 'function') await resolved.facade.setScript(${JSON.stringify(source)});
      else return { error: { code: 'PINE_SET_SOURCE_UNSUPPORTED', message: 'Selected Pine editor facade cannot set source' } };
      var after = null;
      for (var attempt = 0; attempt < 40; attempt++) {
        after = snapshotPineEditorInstance(resolved);
        if (after.source === ${JSON.stringify(source)} && after.store_source_matches) {
          return { success: true, model_uri: after.model_uri };
        }
        await new Promise(function(resolve) { setTimeout(resolve, 25); });
      }
      return {
        error: {
          code: 'PINE_EDITOR_READBACK_FAILED',
          message: 'Selected Pine editor source/store readback did not converge after mutation',
          model_uri: after && after.model_uri,
          editor_source_matches: !!after && after.source === ${JSON.stringify(source)},
          store_source_matches: !!after && after.store_source_matches
        }
      };
    })()
  `);
  return throwPageError(result, 'PINE_SET_SOURCE_FAILED');
}

export async function newPineInstanceScript(evaluateAsyncFn, instance, context, type) {
  const result = await evaluateAsyncFn(`
    (async function() {
      ${PAGE_INSTANCE_HELPER}
      var resolved = resolvePineEditorInstance(${JSON.stringify(instance.placement)});
      if (resolved.error) return resolved;
      var guarded = guardPineEditorInstance(resolved, ${JSON.stringify(expectedPayload(instance, context))});
      if (guarded.error) return guarded;
      if (guarded.snapshot.source !== guarded.snapshot.original_source) {
        return { error: { code: 'PINE_EDITOR_DIRTY', message: 'Refusing Pine New because the selected editor has unsaved modifications' } };
      }
      if (typeof resolved.facade.openNewScript !== 'function') {
        return { error: { code: 'PINE_NEW_UNSUPPORTED', message: 'Selected Pine editor facade does not expose openNewScript' } };
      }
      await resolved.facade.openNewScript(${JSON.stringify(type)});
      return { success: true };
    })()
  `);
  return throwPageError(result, 'PINE_NEW_FAILED');
}

export async function openPineInstanceScript(evaluateAsyncFn, instance, context, target, { allow_dirty = false } = {}) {
  const result = await evaluateAsyncFn(`
    (async function() {
      ${PAGE_INSTANCE_HELPER}
      var resolved = resolvePineEditorInstance(${JSON.stringify(instance.placement)});
      if (resolved.error) return resolved;
      var guarded = guardPineEditorInstance(resolved, ${JSON.stringify(expectedPayload(instance, context))});
      if (guarded.error) return guarded;
      if (!${JSON.stringify(allow_dirty === true)} && guarded.snapshot.source !== guarded.snapshot.original_source) {
        return { error: { code: 'PINE_EDITOR_DIRTY', message: 'Refusing Pine Open because the selected editor has unsaved modifications' } };
      }
      if (typeof resolved.facade.openScript !== 'function') {
        return { error: { code: 'PINE_OPEN_UNSUPPORTED', message: 'Selected Pine editor facade does not expose openScript' } };
      }
      await resolved.facade.openScript({ scriptIdPart: ${JSON.stringify(target.id)}, version: ${JSON.stringify(target.version)} });
      return { success: true };
    })()
  `);
  return throwPageError(result, 'PINE_OPEN_FAILED');
}

export async function savePineInstanceScript(evaluateAsyncFn, instance, context) {
  const result = await evaluateAsyncFn(`
    (async function() {
      ${PAGE_INSTANCE_HELPER}
      var resolved = resolvePineEditorInstance(${JSON.stringify(instance.placement)});
      if (resolved.error) return resolved;
      var guarded = guardPineEditorInstance(resolved, ${JSON.stringify(expectedPayload(instance, context))});
      if (guarded.error) return guarded;
      if (typeof resolved.facade.saveScript !== 'function') {
        return { error: { code: 'PINE_SAVE_UNSUPPORTED', message: 'Selected Pine editor facade does not expose saveScript' } };
      }
      await resolved.facade.saveScript();
      return { success: true };
    })()
  `);
  return throwPageError(result, 'PINE_SAVE_FAILED');
}

export async function compilePineInstanceScript(evaluateAsyncFn, instance, context) {
  const result = await evaluateAsyncFn(`
    (async function() {
      ${PAGE_INSTANCE_HELPER}
      var resolved = resolvePineEditorInstance(${JSON.stringify(instance.placement)});
      if (resolved.error) return resolved;
      var guarded = guardPineEditorInstance(resolved, ${JSON.stringify(expectedPayload(instance, context))});
      if (guarded.error) return guarded;
      if (typeof resolved.facade.addToChart !== 'function') {
        return { error: { code: 'PINE_COMPILE_UNSUPPORTED', message: 'Selected Pine editor facade does not expose addToChart' } };
      }
      await resolved.facade.addToChart();
      return { success: true };
    })()
  `);
  return throwPageError(result, 'PINE_COMPILE_FAILED');
}

export async function readPineInstanceMarkers(evaluateFn, placement) {
  const result = await evaluateFn(`
    (function() {
      ${PAGE_INSTANCE_HELPER}
      var resolved = resolvePineEditorInstance(${JSON.stringify(placement)});
      if (resolved.error) return resolved;
      try {
        var markers = typeof resolved.editorRef.getCurrentModelMarkers === 'function'
          ? resolved.editorRef.getCurrentModelMarkers()
          : (typeof resolved.editorRef.getModelMarkers === 'function' ? resolved.editorRef.getModelMarkers() : []);
        return {
          markers: (markers || []).map(function(marker) {
            return {
              line: marker.startLineNumber || marker.line || null,
              column: marker.startColumn || marker.column || null,
              message: marker.message || String(marker),
              severity: marker.severity || null
            };
          })
        };
      } catch (error) {
        return { error: { code: 'PINE_MARKERS_READ_FAILED', message: String(error && error.message || error) } };
      }
    })()
  `);
  throwPageError(result, 'PINE_MARKERS_READ_FAILED');
  return result?.markers || [];
}

export async function readPineInstanceConsole(evaluateFn, placement) {
  const result = await evaluateFn(`
    (function() {
      ${PAGE_INSTANCE_HELPER}
      var resolved = resolvePineEditorInstance(${JSON.stringify(placement)});
      if (resolved.error) return resolved;
      try {
        var container = resolved.instance.container;
        var root = resolved.instance.placement === 'dialog'
          ? container.closest('[role="dialog"]')
          : container.closest('[class*="layout__area--bottom"], [class*="bottom-widgetbar"]');
        if (!root) {
          return { error: { code: 'PINE_CONSOLE_SCOPE_UNSUPPORTED', message: 'Selected Pine editor has no authoritative placement-scoped console container' } };
        }
        var rows = Array.from(root.querySelectorAll('[class*="consoleRow"], [class*="consoleLine"], [class*="log-"]'));
        return {
          entries: rows.map(function(row) {
            var text = (row.textContent || '').trim();
            var className = String(row.className || '');
            var type = /error/i.test(className) ? 'error' : (/warn/i.test(className) ? 'warning' : (/compil/i.test(text) ? 'compile' : 'info'));
            var timestamp = (text.match(/^(?:\d{4}-\d{2}-\d{2}\s+)?\d{2}:\d{2}:\d{2}/) || [null])[0];
            return { timestamp: timestamp, type: type, message: text };
          }).filter(function(entry) { return entry.message.length > 0; })
        };
      } catch (error) {
        return { error: { code: 'PINE_CONSOLE_READ_FAILED', message: String(error && error.message || error) } };
      }
    })()
  `);
  throwPageError(result, 'PINE_CONSOLE_READ_FAILED');
  return result?.entries || [];
}
