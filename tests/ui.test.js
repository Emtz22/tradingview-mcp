import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { openPanel } from '../src/core/ui.js';
import { uiErrorPayload } from '../src/tools/ui.js';

function panelRuntime({ mode = 'normal', activeWidget = 'scripteditor', supportsClose = true } = {}) {
  const state = { mode, activeWidget };
  const bar = {
    _mode: { value: () => state.mode },
    _activeWidget: { value: () => state.activeWidget },
    isVisible: () => state.mode !== 'minimized',
    open: async () => { state.mode = 'normal'; },
    showWidget: async (name) => { state.activeWidget = name; },
  };
  if (supportsClose) bar.close = async () => { state.mode = 'minimized'; };
  const document = {
    querySelector(selector) {
      if (selector.includes('layout__area--bottom')) return { offsetHeight: state.mode === 'minimized' ? 0 : 200 };
      if (selector === '.monaco-editor.pine-editor-monaco') return state.activeWidget === 'scripteditor' ? {} : null;
      if (selector.includes('backtesting') || selector.includes('strategyReport')) return null;
      return null;
    },
  };
  const run = async (expression) => Function('window', 'document', `return (${expression.trim()})`)(
    { TradingView: { bottomWidgetBar: bar } },
    document,
  );
  return { run, state };
}

describe('openPanel — authoritative bottom-widget lifecycle', () => {
  it('awaits open and reports the verified active Script Editor widget', async () => {
    const runtime = panelRuntime({ mode: 'minimized', activeWidget: 'backtesting' });
    let asyncCalls = 0;
    const result = await openPanel({
      panel: 'pine-editor',
      action: 'open',
      _deps: {
        evaluate: async () => { throw new Error('synchronous evaluator must not own the async panel route'); },
        evaluateAsync: async (expression) => { asyncCalls += 1; return runtime.run(expression); },
      },
    });
    assert.equal(asyncCalls, 1);
    assert.equal(result.performed, 'opened');
    assert.equal(result.route, 'open+showWidget');
    assert.equal(result.mode_after, 'normal');
    assert.equal(result.active_widget_after, 'scripteditor');
  });

  it('awaits close and verifies minimized mode', async () => {
    const runtime = panelRuntime();
    const result = await openPanel({
      panel: 'pine-editor',
      action: 'close',
      _deps: { evaluateAsync: runtime.run },
    });
    assert.equal(result.performed, 'closed');
    assert.equal(result.route, 'close');
    assert.equal(result.mode_after, 'minimized');
  });

  it('returns typed unsupported evidence instead of a clean success', async () => {
    const runtime = panelRuntime({ supportsClose: false });
    await assert.rejects(openPanel({
      panel: 'pine-editor',
      action: 'close',
      _deps: { evaluateAsync: runtime.run },
    }), (error) => {
      assert.equal(error.code, 'BOTTOM_PANEL_CLOSE_UNSUPPORTED');
      assert.equal(error.details.error.code, 'BOTTOM_PANEL_CLOSE_UNSUPPORTED');
      return true;
    });
  });

  it('fails closed when the async runtime returns no authoritative receipt', async () => {
    await assert.rejects(openPanel({
      panel: 'pine-editor',
      action: 'open',
      _deps: { evaluateAsync: async () => undefined },
    }), (error) => {
      assert.equal(error.code, 'BOTTOM_PANEL_INVALID_RESULT');
      assert.deepEqual(error.details, { panel: 'pine-editor', action: 'open', result: null });
      return true;
    });
  });
});

describe('ui_open_panel — typed MCP error surface', () => {
  it('preserves runtime error code and details', () => {
    const error = new Error('close unavailable');
    error.code = 'BOTTOM_PANEL_CLOSE_UNSUPPORTED';
    error.details = { route: null };
    assert.deepEqual(uiErrorPayload(error), {
      success: false,
      error: 'close unavailable',
      error_code: 'BOTTOM_PANEL_CLOSE_UNSUPPORTED',
      details: { route: null },
    });
  });
});
