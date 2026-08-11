import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertScriptPrecondition,
  compile,
  deleteScript,
  ensurePineEditorOpen,
  getCurrentScriptContext,
  listEditorInstances,
  newScript,
  openScript,
  pineSourceSha256,
  readStudyCountDiagnostic,
  reconcileInstanceContext,
  reconcileScriptContext,
  save,
  saveAs,
  setSource,
} from '../src/core/pine.js';
import { setPineInstanceSource } from '../src/core/pine-instance.js';
import { registerPineTools } from '../src/tools/pine.js';

const SAVED = {
  id: 'USER;saved-id',
  name: 'Protected user script',
  title: 'Protected user script',
  version: '7.0',
  modified: 123,
};

function snapshot(visible_name, source, model_uri = 'file:///model.pine') {
  return { visible_name, source, model_uri };
}

function sequenced(values) {
  let index = 0;
  return async () => values[Math.min(index++, values.length - 1)];
}

function runPineBrowserExpression(expression, chartWidgetValue) {
  const window = {
    TradingViewApi: {
      _activeChartWidgetWV: { value: chartWidgetValue },
    },
  };
  return Function('window', `return (${expression.trim()})`)(window);
}

function editorInstance({
  placement = 'bottom',
  model_uri = `file:///${placement}.pine`,
  source = 'source',
  original_source = source,
  active_script = null,
  store_source_matches = true,
  supports = {},
} = {}) {
  return {
    editor_instance_id: `pine-editor-v1:${placement}`,
    placement,
    model_uri,
    original_model_uri: `inmemory:ORIGINAL.pine?placement=${placement}`,
    source,
    original_source,
    source_sha256: pineSourceSha256(source),
    source_normalized_sha256: pineSourceSha256(source.replace(/\r\n/g, '\n')),
    original_source_sha256: pineSourceSha256(original_source),
    modified: source !== original_source,
    line_count: source.split('\n').length,
    char_count: source.length,
    store_source_matches,
    visible: true,
    active_script,
    supports,
    capability_status: 'runtime_private_verified',
  };
}

function inventory(instance, orphan_models = []) {
  return { instances: [instance], orphan_models, read_errors: [] };
}

function instanceGuards(context) {
  return {
    placement: context.placement,
    expected_editor_instance_id: context.editor_instance_id,
    expected_model_uri: context.model_uri,
    expected_script_id: context.status === 'saved' ? context.saved_script_id : undefined,
    expected_draft_token: context.status === 'draft' ? context.draft_token : undefined,
    expected_source_sha256: context.source_sha256,
  };
}

describe('Pine editor readiness', () => {
  it('does not treat a minimized still-mounted Monaco editor as ready', async () => {
    const expressions = [];
    const results = [false, undefined, undefined, true];
    const ready = await ensurePineEditorOpen({
      _deps: {
        evaluate: async (expression) => {
          expressions.push(expression);
          return results.shift();
        },
        sleep: async () => {},
      },
    });
    assert.equal(ready, true);
    assert.match(expressions[0], /mode === 'minimized'/);
    assert.match(expressions[1], /bwb\.open\(\)/);
    assert.match(expressions[1], /showWidget\('scripteditor'\)/);
    assert.match(expressions[3], /mode === 'minimized'/);
  });
});

describe('Pine selected-script context', () => {
  it('reconciles one exact saved ID and hashes the selected Monaco source', () => {
    const source = '//@version=6\nindicator("Safe")';
    const context = reconcileScriptContext(snapshot(SAVED.name, source), [SAVED]);
    assert.equal(context.status, 'saved');
    assert.equal(context.saved_script_id, SAVED.id);
    assert.equal(context.source_sha256, pineSourceSha256(source));
    assert.equal(context.draft_token, null);
  });

  it('issues a source-bound token only for a native Untitled draft', () => {
    const context = reconcileScriptContext(snapshot('Untitled script', 'draft'), [SAVED]);
    assert.equal(context.status, 'draft');
    assert.equal(context.saved_script_id, null);
    assert.equal(context.draft_token.length, 64);
  });

  it('marks unknown or duplicate visible identities ambiguous', () => {
    assert.equal(reconcileScriptContext(snapshot('Unknown', 'x'), [SAVED]).status, 'ambiguous');
    assert.equal(reconcileScriptContext(snapshot(SAVED.name, 'x'), [SAVED, { ...SAVED, id: 'USER;other' }]).status, 'ambiguous');
  });

  it('returns a read-only context receipt', async () => {
    const source = '//@version=6\nindicator("Safe")';
    const context = await getCurrentScriptContext({ _deps: {
      ensureEditor: async () => true,
      getEditorSnapshot: async () => snapshot(SAVED.name, source),
      getSavedScripts: async () => [SAVED],
    } });
    assert.equal(context.saved_script_id, SAVED.id);
    assert.equal(context.source_sha256, pineSourceSha256(source));
  });
});

describe('Pine fail-closed source mutation', () => {
  it('requires exactly one saved ID or draft token', () => {
    const context = reconcileScriptContext(snapshot(SAVED.name, 'x'), [SAVED]);
    assert.throws(() => assertScriptPrecondition(context), /exactly one/);
    assert.throws(() => assertScriptPrecondition(context, { expected_script_id: SAVED.id, expected_draft_token: 'x' }), /exactly one/);
  });

  it('refuses a wrong selected saved ID before any Monaco write', async () => {
    const writes = [];
    await assert.rejects(setSource({
      source: 'replacement',
      expected_script_id: 'USER;wrong',
      _deps: {
        ensureEditor: async () => true,
        getEditorSnapshot: async () => snapshot(SAVED.name, 'original'),
        getSavedScripts: async () => [SAVED],
        setEditorSource: async (source) => { writes.push(source); return true; },
      },
    }), /mismatch/);
    assert.deepEqual(writes, []);
  });

  it('refuses a stale source hash before any Monaco write', async () => {
    const writes = [];
    await assert.rejects(setSource({
      source: 'replacement', expected_script_id: SAVED.id, expected_source_sha256: '0'.repeat(64),
      _deps: {
        ensureEditor: async () => true,
        getEditorSnapshot: async () => snapshot(SAVED.name, 'original'),
        getSavedScripts: async () => [SAVED],
        setEditorSource: async (source) => { writes.push(source); return true; },
      },
    }), /source hash mismatch/);
    assert.deepEqual(writes, []);
  });

  it('writes only after the exact saved identity/hash match and returns a new hash', async () => {
    const writes = [];
    const snapshots = sequenced([
      snapshot(SAVED.name, 'original'),
      snapshot(SAVED.name, 'replacement'),
    ]);
    const result = await setSource({
      source: 'replacement',
      expected_script_id: SAVED.id,
      expected_source_sha256: pineSourceSha256('original'),
      _deps: {
        ensureEditor: async () => true,
        getEditorSnapshot: snapshots,
        getSavedScripts: async () => [SAVED],
        setEditorSource: async (source) => { writes.push(source); return true; },
      },
    });
    assert.deepEqual(writes, ['replacement']);
    assert.equal(result.source_sha256, pineSourceSha256('replacement'));
    assert.equal(result.context.saved_script_id, SAVED.id);
  });
});

describe('native Pine New isolation', () => {
  it('refuses the reproduced false-positive when saved identity remains and performs zero writes', async () => {
    const writes = [];
    await assert.rejects(newScript({
      type: 'indicator',
      _deps: {
        ensureEditor: async () => true,
        getEditorSnapshot: async () => snapshot(SAVED.name, 'original'),
        getSavedScripts: async () => [SAVED],
        createNativeDraft: async () => true,
        setEditorSource: async (source) => { writes.push(source); return true; },
        sleep: async () => {},
      },
    }), /did not transition/);
    assert.deepEqual(writes, []);
  });

  it('initializes a template only after a distinct native draft is proven', async () => {
    const writes = [];
    const snapshots = sequenced([
      snapshot(SAVED.name, 'original', 'file:///saved.pine'),
      snapshot('Untitled script', 'original', 'file:///draft.pine'),
      snapshot('Untitled script', '//@version=6\nindicator("My script")\nplot(close)', 'file:///draft.pine'),
    ]);
    const result = await newScript({
      type: 'indicator',
      _deps: {
        ensureEditor: async () => true,
        getEditorSnapshot: snapshots,
        getSavedScripts: async () => [SAVED],
        createNativeDraft: async () => true,
        setEditorSource: async (source) => { writes.push(source); return true; },
      },
    });
    assert.equal(result.action, 'native_draft_created');
    assert.equal(result.context.status, 'draft');
    assert.equal(result.context.draft_token.length, 64);
    assert.equal(writes.length, 1);
  });

  it('uses a native pointer sequence for the visible Create new submenu item', async () => {
    const events = [];
    const evaluations = sequenced([{ activated: false, route: null }, true, { x: 100, y: 200 }, { x: 123, y: 456 }]);
    const snapshots = sequenced([
      snapshot(SAVED.name, 'original', 'file:///saved.pine'),
      snapshot('Untitled script', 'original', 'file:///draft.pine'),
      snapshot('Untitled script', '//@version=6\nindicator("My script")\nplot(close)', 'file:///draft.pine'),
    ]);
    const result = await newScript({
      type: 'indicator',
      _deps: {
        ensureEditor: async () => true,
        getEditorSnapshot: snapshots,
        getSavedScripts: async () => [SAVED],
        evaluate: evaluations,
        getClient: async () => ({ Input: { dispatchMouseEvent: async (event) => events.push(event) } }),
        setEditorSource: async () => true,
        sleep: async () => {},
      },
    });
    assert.equal(result.context.status, 'draft');
    assert.deepEqual(events.map((event) => event.type), ['mouseMoved', 'mouseMoved', 'mousePressed', 'mouseReleased']);
    assert.deepEqual(events.map(({ x, y }) => ({ x, y })), [
      { x: 100, y: 200 },
      { x: 123, y: 456 },
      { x: 123, y: 456 },
      { x: 123, y: 456 },
    ]);
  });

  it('prefers the authoritative Script Editor facade over menu automation', async () => {
    const expressions = [];
    const snapshots = sequenced([
      snapshot(SAVED.name, 'original', 'file:///saved.pine'),
      snapshot('Untitled script', 'original', 'file:///draft.pine'),
      snapshot('Untitled script', '//@version=6\nindicator("My script")\nplot(close)', 'file:///draft.pine'),
    ]);
    const result = await newScript({
      type: 'indicator',
      _deps: {
        ensureEditor: async () => true,
        getEditorSnapshot: snapshots,
        getSavedScripts: async () => [SAVED],
        evaluate: async (expression) => {
          expressions.push(expression);
          return { activated: true, route: 'scripteditor._facade.openNewScript' };
        },
        getClient: async () => { throw new Error('menu fallback must not run'); },
        setEditorSource: async () => true,
        sleep: async () => {},
      },
    });
    assert.equal(result.context.status, 'draft');
    assert.equal(expressions.length, 1);
    assert.match(expressions[0], /facade\.openNewScript/);
  });
});

describe('native Pine open identity', () => {
  it('uses the native picker and verifies the exact target saved ID', async () => {
    const target = { ...SAVED, id: 'USER;target', name: 'Exact target', title: 'Exact target' };
    const snapshots = sequenced([
      snapshot(SAVED.name, 'source-a'),
      snapshot(target.name, 'source-b'),
    ]);
    const actions = [];
    const selections = [];
    const result = await openScript({
      name: target.name,
      _deps: {
        ensureEditor: async () => true,
        getEditorSnapshot: snapshots,
        getSavedScripts: async () => [SAVED, target],
        getCanonicalSource: async () => 'source-b',
        activateMenuAction: async (action) => { actions.push(action); return true; },
        selectOpenScript: async (name) => { selections.push(name); return true; },
      },
    });
    assert.equal(result.script_id, target.id);
    assert.deepEqual(actions, ['Open script…']);
    assert.deepEqual(selections, [target.name]);
  });

  it('refuses partial or duplicate names before opening the picker', async () => {
    const actions = [];
    await assert.rejects(openScript({
      name: 'Protected',
      _deps: {
        ensureEditor: async () => true,
        getEditorSnapshot: async () => snapshot(SAVED.name, 'source'),
        getSavedScripts: async () => [SAVED],
        activateMenuAction: async (action) => { actions.push(action); return true; },
      },
    }), /Expected one exact/);
    assert.deepEqual(actions, []);
  });
});

describe('verified Pine save and save-as', () => {
  it('uses Meta+S on macOS fallback and verifies canonical source hash', async () => {
    const events = [];
    const source = 'saved source';
    const result = await save({
      expected_script_id: SAVED.id,
      expected_source_sha256: pineSourceSha256(source),
      _deps: {
        ensureEditor: async () => true,
        getEditorSnapshot: async () => snapshot(SAVED.name, source),
        getSavedScripts: async () => [SAVED],
        getCanonicalSource: async () => source,
        activateMenuAction: async () => false,
        platform: 'darwin',
        getClient: async () => ({ Input: { dispatchKeyEvent: async (event) => events.push(event) } }),
      },
    });
    assert.equal(result.action, 'Meta+S');
    assert.equal(events[0].modifiers, 4);
    assert.equal(result.persisted, true);
  });

  it('fails save with typed last canonical-fetch evidence', async () => {
    const source = 'saved source';
    await assert.rejects(save({
      expected_script_id: SAVED.id,
      expected_source_sha256: pineSourceSha256(source),
      _deps: {
        ensureEditor: async () => true,
        getEditorSnapshot: async () => snapshot(SAVED.name, source),
        getSavedScripts: async () => [SAVED],
        getCanonicalSource: async () => { throw new Error('canonical endpoint unavailable'); },
        activateMenuAction: async () => true,
        sleep: async () => {},
      },
    }), (error) => {
      assert.equal(error.code, 'PINE_CANONICAL_SOURCE_VERIFY_FAILED');
      assert.equal(error.details.last_error.code, 'PINE_CANONICAL_SOURCE_FETCH_FAILED');
      assert.match(error.message, /canonical endpoint unavailable/);
      return true;
    });
  });

  it('refuses save-as name collisions before opening any menu', async () => {
    const saves = [];
    await assert.rejects(saveAs({
      name: SAVED.name,
      expected_script_id: SAVED.id,
      _deps: {
        ensureEditor: async () => true,
        getEditorSnapshot: async () => snapshot(SAVED.name, 'source'),
        getSavedScripts: async () => [SAVED],
        saveNewScript: async (...args) => { saves.push(args); return { success: true }; },
      },
    }), /already exists/);
    assert.deepEqual(saves, []);
  });

  it('saves an exact draft under a unique name and verifies canonical source', async () => {
    const source = 'draft source';
    const draft = reconcileScriptContext(snapshot('Untitled script', source), []);
    const created = { id: 'USER;created', name: 'Task disposable', title: 'Task disposable', version: '1.0', modified: 456 };
    const lists = sequenced([[], [created]]);
    const saves = [];
    const result = await saveAs({
      name: created.name,
      expected_draft_token: draft.draft_token,
      expected_source_sha256: draft.source_sha256,
      _deps: {
        ensureEditor: async () => true,
        getEditorSnapshot: async () => snapshot('Untitled script', source),
        getSavedScripts: lists,
        getCanonicalSource: async () => source,
        saveNewScript: async (name, savedSource) => { saves.push({ name, source: savedSource }); return { success: true }; },
      },
    });
    assert.equal(result.script_id, created.id);
    assert.deepEqual(saves, [{ name: created.name, source }]);
  });

  it('fails save-as with typed last canonical-fetch evidence', async () => {
    const source = 'draft source';
    const draft = reconcileScriptContext(snapshot('Untitled script', source), []);
    const created = { id: 'USER;created', name: 'Task disposable', title: 'Task disposable', version: '1.0', modified: 456 };
    const lists = sequenced([[], [created]]);
    await assert.rejects(saveAs({
      name: created.name,
      expected_draft_token: draft.draft_token,
      expected_source_sha256: draft.source_sha256,
      _deps: {
        ensureEditor: async () => true,
        getEditorSnapshot: async () => snapshot('Untitled script', source),
        getSavedScripts: lists,
        getCanonicalSource: async () => { throw new Error('canonical save-as read failed'); },
        saveNewScript: async () => ({ success: true }),
        sleep: async () => {},
      },
    }), (error) => {
      assert.equal(error.code, 'PINE_SAVE_AS_VERIFY_FAILED');
      assert.equal(error.details.last_canonical_error.code, 'PINE_CANONICAL_SOURCE_FETCH_FAILED');
      assert.equal(error.details.last_canonical_error.script_id, created.id);
      assert.deepEqual(error.details.candidate_script_ids, [created.id]);
      assert.match(error.message, /canonical save-as read failed/);
      return true;
    });
  });
});

describe('Pine study-count diagnostics', () => {
  it('retains typed before/after evidence when the chart accessor throws', async () => {
    for (const stage of ['before', 'after']) {
      const result = await readStudyCountDiagnostic(stage, { _deps: {
        evaluate: async (expression) => runPineBrowserExpression(expression, () => {
          throw new Error(`${stage} chart unavailable`);
        }),
      } });
      assert.equal(result.count, null);
      assert.deepEqual(result.error, {
        code: 'PINE_STUDY_COUNT_READ_FAILED',
        stage,
        message: `${stage} chart unavailable`,
      });
    }
  });
});

describe('placement-bound Pine editor architecture', () => {
  it('lists facade receipts and orphan evidence without exposing source text', async () => {
    const selected = editorInstance({ source: 'private source' });
    const result = await listEditorInstances({ _deps: {
      readEditorInstances: async () => inventory(selected, [{ model_uri: 'file:///orphan.pine', capability_status: 'orphan_model_unsupported' }]),
    } });
    assert.equal(result.count, 1);
    assert.equal(result.instances[0].editor_instance_id, 'pine-editor-v1:bottom');
    assert.equal(Object.hasOwn(result.instances[0], 'source'), false);
    assert.equal(Object.hasOwn(result.instances[0], 'original_source'), false);
    assert.equal(result.orphan_models[0].capability_status, 'orphan_model_unsupported');
  });

  it('sets source and verifies authoritative same-instance readback', async () => {
    const active = { id: SAVED.id, name: SAVED.name, title: SAVED.title, version: SAVED.version };
    const before = editorInstance({ source: 'original', active_script: active });
    const after = editorInstance({ source: 'replacement', original_source: 'original', active_script: active });
    const context = reconcileInstanceContext(before, [SAVED]);
    const writes = [];
    const result = await setSource({
      source: 'replacement',
      ...instanceGuards(context),
      _deps: {
        readEditorInstances: sequenced([inventory(before), inventory(after)]),
        getSavedScripts: async () => [SAVED],
        setInstanceSource: async (instance, selectedContext, source) => writes.push({ instance, selectedContext, source }),
      },
    });
    assert.equal(result.source_sha256, pineSourceSha256('replacement'));
    assert.equal(result.context.editor_instance_id, context.editor_instance_id);
    assert.equal(writes.length, 1);
    assert.equal(writes[0].instance.model_uri, before.model_uri);
  });

  it('retains typed evidence when page-side source/store convergence times out', async () => {
    const selected = editorInstance({ source: 'original' });
    const context = reconcileInstanceContext(selected, []);
    await assert.rejects(setPineInstanceSource(async (expression) => {
      assert.match(expression, /source\/store readback did not converge/);
      assert.match(expression, /setTimeout\(resolve, 25\)/);
      return {
        error: {
          code: 'PINE_EDITOR_READBACK_FAILED',
          message: 'Selected Pine editor source/store readback did not converge after mutation',
          model_uri: selected.model_uri,
          editor_source_matches: true,
          store_source_matches: false,
        },
      };
    }, selected, context, 'replacement'), (error) => {
      assert.equal(error.code, 'PINE_EDITOR_READBACK_FAILED');
      assert.equal(error.details.model_uri, selected.model_uri);
      assert.equal(error.details.editor_source_matches, true);
      assert.equal(error.details.store_source_matches, false);
      return true;
    });
  });

  it('refuses cross-instance and stale-model guards before mutation', async () => {
    const before = editorInstance({ source: 'original' });
    const context = reconcileInstanceContext(before, []);
    for (const mismatch of [
      { expected_editor_instance_id: 'pine-editor-v1:dialog', code: 'PINE_EDITOR_CROSS_INSTANCE_REFUSED' },
      { expected_model_uri: 'file:///stale.pine', code: 'PINE_EDITOR_MODEL_STALE' },
    ]) {
      const writes = [];
      await assert.rejects(setSource({
        source: 'replacement',
        ...instanceGuards(context),
        [Object.keys(mismatch)[0]]: Object.values(mismatch)[0],
        _deps: {
          readEditorInstances: async () => inventory(before),
          getSavedScripts: async () => [],
          setInstanceSource: async () => writes.push('write'),
        },
      }), (error) => {
        assert.equal(error.code, mismatch.code);
        return true;
      });
      assert.deepEqual(writes, []);
    }
  });

  it('refuses a stale facade/store readback before mutation', async () => {
    const stale = editorInstance({ source: 'original', store_source_matches: false });
    const writes = [];
    await assert.rejects(setSource({
      source: 'replacement',
      placement: 'bottom',
      expected_editor_instance_id: 'pine-editor-v1:bottom',
      expected_model_uri: stale.model_uri,
      expected_draft_token: 'x'.repeat(64),
      expected_source_sha256: stale.source_sha256,
      _deps: {
        readEditorInstances: async () => inventory(stale),
        getSavedScripts: async () => [],
        setInstanceSource: async () => writes.push('write'),
      },
    }), (error) => {
      assert.equal(error.code, 'PINE_EDITOR_READBACK_FAILED');
      return true;
    });
    assert.deepEqual(writes, []);
  });

  it('refuses a hidden same-placement facade before mutation', async () => {
    const hidden = { ...editorInstance({ source: 'original' }), visible: false };
    const writes = [];
    await assert.rejects(setSource({
      source: 'replacement',
      placement: 'bottom',
      expected_editor_instance_id: hidden.editor_instance_id,
      expected_model_uri: hidden.model_uri,
      expected_draft_token: 'x'.repeat(64),
      expected_source_sha256: hidden.source_sha256,
      _deps: {
        readEditorInstances: async () => inventory(hidden),
        getSavedScripts: async () => [],
        setInstanceSource: async () => writes.push('write'),
      },
    }), (error) => {
      assert.equal(error.code, 'PINE_EDITOR_INSTANCE_NOT_VISIBLE');
      return true;
    });
    assert.deepEqual(writes, []);
  });

  it('refuses an unreadable visible same-placement facade before mutation', async () => {
    const selected = editorInstance({ source: 'original' });
    const writes = [];
    await assert.rejects(setSource({
      source: 'replacement',
      ...instanceGuards(reconcileInstanceContext(selected, [])),
      _deps: {
        readEditorInstances: async () => ({
          instances: [selected],
          orphan_models: [],
          read_errors: [{
            code: 'PINE_EDITOR_INSTANCE_READ_FAILED',
            placement: 'bottom',
            visible: true,
            message: 'editor ref unavailable',
          }],
        }),
        getSavedScripts: async () => [],
        setInstanceSource: async () => writes.push('write'),
      },
    }), (error) => {
      assert.equal(error.code, 'PINE_EDITOR_INSTANCE_READ_FAILED');
      assert.equal(error.details.read_errors[0].message, 'editor ref unavailable');
      return true;
    });
    assert.deepEqual(writes, []);
  });

  it('creates a same-instance native draft only after a changed model URI', async () => {
    const before = editorInstance({ model_uri: 'file:///bottom-before.pine', source: 'clean draft' });
    const after = editorInstance({ model_uri: 'file:///bottom-after.pine', source: '//@version=6\nindicator("My script")' });
    const context = reconcileInstanceContext(before, []);
    const calls = [];
    const result = await newScript({
      type: 'indicator',
      ...instanceGuards(context),
      _deps: {
        readEditorInstances: sequenced([inventory(before), inventory(after)]),
        getSavedScripts: async () => [],
        newInstanceScript: async (instance, selectedContext, type) => calls.push({ instance, selectedContext, type }),
      },
    });
    assert.equal(result.action, 'facade.openNewScript');
    assert.equal(result.context.model_uri, after.model_uri);
    assert.equal(result.context.status, 'draft');
    assert.equal(calls.length, 1);
  });

  it('returns typed failure when New has no observable same-instance transition', async () => {
    const before = editorInstance({ source: 'clean draft' });
    const context = reconcileInstanceContext(before, []);
    let calls = 0;
    await assert.rejects(newScript({
      type: 'indicator',
      ...instanceGuards(context),
      _deps: {
        readEditorInstances: async () => inventory(before),
        getSavedScripts: async () => [],
        newInstanceScript: async () => { calls += 1; },
        sleep: async () => {},
      },
    }), (error) => {
      assert.equal(error.code, 'PINE_NEW_NO_OBSERVABLE_TRANSITION');
      return true;
    });
    assert.equal(calls, 1);
  });

  it('opens one exact saved script on the same facade and verifies canonical source', async () => {
    const target = { ...SAVED, id: 'USER;target', name: 'Exact target', title: 'Exact target' };
    const before = editorInstance({ model_uri: 'file:///draft.pine', source: 'clean draft' });
    const after = editorInstance({
      model_uri: 'file:///target.pine',
      source: 'target source',
      active_script: { id: target.id, name: target.name, title: target.title, version: target.version },
    });
    const context = reconcileInstanceContext(before, [target]);
    const opens = [];
    const result = await openScript({
      name: target.name,
      ...instanceGuards(context),
      _deps: {
        readEditorInstances: sequenced([inventory(before), inventory(after)]),
        getSavedScripts: async () => [target],
        getCanonicalSource: async () => 'target source',
        openInstanceScript: async (...args) => opens.push(args),
      },
    });
    assert.equal(result.script_id, target.id);
    assert.equal(result.context.model_uri, after.model_uri);
    assert.equal(opens.length, 1);
  });

  it('keeps public Open fail-closed for a dirty selected instance', async () => {
    const target = { ...SAVED, id: 'USER;target', name: 'Exact target', title: 'Exact target' };
    const dirty = editorInstance({ source: 'dirty draft', original_source: 'clean draft' });
    const context = reconcileInstanceContext(dirty, [target]);
    const opens = [];
    await assert.rejects(openScript({
      name: target.name,
      ...instanceGuards(context),
      _deps: {
        readEditorInstances: async () => inventory(dirty),
        getSavedScripts: async () => [target],
        getCanonicalSource: async () => 'target source',
        openInstanceScript: async (...args) => opens.push(args),
      },
    }), (error) => {
      assert.equal(error.code, 'PINE_EDITOR_DIRTY');
      return true;
    });
    assert.deepEqual(opens, []);
  });

  it('saves through the same facade and verifies canonical persistence', async () => {
    const active = { id: SAVED.id, name: SAVED.name, title: SAVED.title, version: SAVED.version };
    const before = editorInstance({ source: 'changed source', original_source: 'old source', active_script: active });
    const after = editorInstance({ source: 'changed source', original_source: 'changed source', active_script: active });
    const context = reconcileInstanceContext(before, [SAVED]);
    const saves = [];
    const result = await save({
      ...instanceGuards(context),
      _deps: {
        readEditorInstances: sequenced([inventory(before), inventory(after)]),
        getSavedScripts: async () => [SAVED],
        getCanonicalSource: async () => 'changed source',
        saveInstanceScript: async (...args) => saves.push(args),
      },
    });
    assert.equal(result.action, 'facade.saveScript');
    assert.equal(result.persisted, true);
    assert.equal(saves.length, 1);
  });

  it('fails a successful save mutation when authoritative source readback changed', async () => {
    const active = { id: SAVED.id, name: SAVED.name, title: SAVED.title, version: SAVED.version };
    const before = editorInstance({ source: 'expected source', original_source: 'old source', active_script: active });
    const after = editorInstance({ source: 'concurrent source', original_source: 'expected source', active_script: active });
    const context = reconcileInstanceContext(before, [SAVED]);
    await assert.rejects(save({
      ...instanceGuards(context),
      _deps: {
        readEditorInstances: sequenced([inventory(before), inventory(after)]),
        getSavedScripts: async () => [SAVED],
        getCanonicalSource: async () => 'expected source',
        saveInstanceScript: async () => {},
      },
    }), (error) => {
      assert.equal(error.code, 'PINE_EDITOR_SOURCE_STALE');
      assert.equal(error.details.before_source_normalized_sha256, before.source_normalized_sha256);
      assert.equal(error.details.after_source_normalized_sha256, after.source_normalized_sha256);
      return true;
    });
  });

  it('saves as, binds the exact new ID to the same facade, and verifies canonical source', async () => {
    const source = 'draft source';
    const created = { id: 'USER;created', name: 'Task disposable', title: 'Task disposable', version: '1.0', modified: 456 };
    const before = editorInstance({ model_uri: 'file:///draft.pine', source });
    const after = editorInstance({
      model_uri: 'file:///created.pine',
      source,
      active_script: { id: created.id, name: created.name, title: created.title, version: created.version },
    });
    const context = reconcileInstanceContext(before, []);
    const saves = [];
    const opens = [];
    const result = await saveAs({
      name: created.name,
      ...instanceGuards(context),
      _deps: {
        readEditorInstances: sequenced([inventory(before), inventory(after)]),
        getSavedScripts: sequenced([[], [created], [created]]),
        getCanonicalSource: async () => source,
        saveNewScript: async (...args) => saves.push(args),
        openInstanceScript: async (...args) => opens.push(args),
      },
    });
    assert.equal(result.action, 'saved_as_via_pine_facade_and_bound');
    assert.equal(result.script_id, created.id);
    assert.equal(saves.length, 1);
    assert.equal(opens.length, 1);
    assert.deepEqual(opens[0][3], { allow_dirty: true });
  });

  it('fails save-as with typed evidence when the created ID is ambiguous', async () => {
    const source = 'draft source';
    const before = editorInstance({ model_uri: 'file:///draft.pine', source });
    const context = reconcileInstanceContext(before, []);
    const first = { id: 'USER;created-a', name: 'Collision race', title: 'Collision race', version: '1.0' };
    const second = { ...first, id: 'USER;created-b' };
    await assert.rejects(saveAs({
      name: first.name,
      ...instanceGuards(context),
      _deps: {
        readEditorInstances: async () => inventory(before),
        getSavedScripts: sequenced([[], [first, second]]),
        saveNewScript: async () => ({ success: true }),
      },
    }), (error) => {
      assert.equal(error.code, 'PINE_SAVE_AS_CREATED_ID_AMBIGUOUS');
      assert.deepEqual(error.details.candidate_script_ids, [first.id, second.id]);
      return true;
    });
  });

  it('compiles one guarded facade and reads markers from the same placement', async () => {
    const before = editorInstance({ source: 'draft source' });
    const context = reconcileInstanceContext(before, []);
    const calls = [];
    const result = await compile({
      ...instanceGuards(context),
      _deps: {
        readEditorInstances: async () => inventory(before),
        getSavedScripts: async () => [],
        compileInstanceScript: async (...args) => calls.push(args),
        readInstanceMarkers: async (placement) => [{ line: 2, column: 1, message: `marker:${placement}`, severity: 8 }],
        sleep: async () => {},
      },
    });
    assert.equal(result.action, 'facade.addToChart');
    assert.equal(result.errors[0].message, 'marker:bottom');
    assert.equal(calls.length, 1);
  });

  it('restores only the protected dialog instance from its own original model source', async () => {
    const active = { id: SAVED.id, name: SAVED.name, title: SAVED.title, version: SAVED.version };
    const original = 'protected original';
    const modified = editorInstance({
      placement: 'dialog',
      model_uri: 'file:///protected-dialog.pine',
      source: `AAPL${original}`,
      original_source: original,
      active_script: active,
    });
    const restored = editorInstance({
      placement: 'dialog',
      model_uri: modified.model_uri,
      source: original,
      original_source: original,
      active_script: active,
    });
    const context = reconcileInstanceContext(modified, [SAVED]);
    const writes = [];
    const result = await setSource({
      source: original,
      ...instanceGuards(context),
      _deps: {
        readEditorInstances: sequenced([inventory(modified), inventory(restored)]),
        getSavedScripts: async () => [SAVED],
        setInstanceSource: async (_instance, _context, source) => writes.push(source),
      },
    });
    assert.deepEqual(writes, [original]);
    assert.equal(result.context.editor_instance_id, 'pine-editor-v1:dialog');
    assert.equal(result.context.modified, false);
    assert.equal(result.context.source_sha256, pineSourceSha256(original));
  });

  it('refuses exact-ID cleanup when the name/version guard differs', async () => {
    const deletes = [];
    await assert.rejects(deleteScript({
      script_id: SAVED.id,
      expected_name: 'Wrong name',
      expected_version: SAVED.version,
      _deps: {
        getSavedScripts: async () => [SAVED],
        deleteSavedScript: async (id) => deletes.push(id),
      },
    }), (error) => {
      assert.equal(error.code, 'PINE_DELETE_IDENTITY_MISMATCH');
      return true;
    });
    assert.deepEqual(deletes, []);
  });

  it('deletes one exact ID and verifies only that ID is absent', async () => {
    const other = { ...SAVED, id: 'USER;other', name: 'Other script' };
    const deletes = [];
    const result = await deleteScript({
      script_id: SAVED.id,
      expected_name: SAVED.name,
      expected_version: SAVED.version,
      _deps: {
        getSavedScripts: sequenced([[SAVED, other], [other]]),
        deleteSavedScript: async (id) => deletes.push(id),
      },
    });
    assert.deepEqual(deletes, [SAVED.id]);
    assert.equal(result.removed_script_id, SAVED.id);
    assert.equal(result.count_before, 2);
    assert.equal(result.count_after, 1);
  });

  it('fails exact-ID cleanup if authoritative readback loses an unrelated script', async () => {
    const other = { ...SAVED, id: 'USER;other', name: 'Other script' };
    await assert.rejects(deleteScript({
      script_id: SAVED.id,
      expected_name: SAVED.name,
      expected_version: SAVED.version,
      _deps: {
        getSavedScripts: sequenced([[SAVED, other], []]),
        deleteSavedScript: async () => ({ route: 'test.delete' }),
      },
    }), (error) => {
      assert.equal(error.code, 'PINE_DELETE_UNRELATED_CHANGE_DETECTED');
      assert.deepEqual(error.details.unrelated_missing_script_ids, [other.id]);
      return true;
    });
  });
});

describe('Pine MCP schema parity', () => {
  it('advertises instance inventory, exact deletion, and required lifecycle guards', () => {
    const registered = new Map();
    registerPineTools({
      tool(name, description, schema, handler) {
        registered.set(name, { description, schema, handler });
      },
    });
    assert.ok(registered.has('pine_list_editor_instances'));
    assert.ok(registered.has('pine_delete_script'));
    for (const name of ['pine_set_source', 'pine_compile', 'pine_save', 'pine_save_as', 'pine_smart_compile', 'pine_new', 'pine_open']) {
      const schema = registered.get(name)?.schema;
      assert.ok(schema, `${name} is registered`);
      for (const field of ['placement', 'expected_editor_instance_id', 'expected_model_uri', 'expected_source_sha256']) {
        assert.ok(schema[field], `${name} advertises ${field}`);
        assert.equal(schema[field].isOptional(), false, `${name}.${field} is required`);
      }
    }
    const deletion = registered.get('pine_delete_script').schema;
    for (const field of ['script_id', 'expected_name', 'expected_version']) {
      assert.ok(deletion[field], `pine_delete_script advertises ${field}`);
      assert.equal(deletion[field].isOptional(), false, `pine_delete_script.${field} is required`);
    }
    for (const name of ['pine_get_context', 'pine_get_source', 'pine_get_errors', 'pine_get_console']) {
      assert.equal(registered.get(name).schema.placement.isOptional(), true, `${name}.placement is optional for read-only discovery`);
    }
  });
});
