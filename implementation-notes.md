# tradingview-mcp — Implementation Notes

## 2026-06-28 — Four bug fixes (branch: agent/fix-strategy-tester)

**Bug 1 — batch_run get_strategy_results (src/core/batch.js:58-73)**
Replaced the primitive inline DOM scrape (`[data-name="backtesting"]` → `[class*="reportItem"]`) with a call to the robust `getStrategyResults()` from `data.js` (imported at the top of batch.js). This ensures batch_run uses the same internal-API + DOM-fallback path as the single-call MCP tool, and returns results in the same `results[].result` shape.

**Bug 2 — "0 metrics" parse failure (src/core/data.js)**
Added `parseRenderedReport(text)` (exported) that extracts 14 structured metric keys from the Strategy Tester panel's innerText. Key design decisions:
- Label matching is position-anchored (full line = label), not substring, to prevent "Average PnL" colliding with "Total PnL".
- Numeric normalizer strips unicode minus U+2212, thousands commas, leading `+`, and trailing `%`/`USD`.
- The `trades_won`/`trades_total` pair comes from the `"760/2712"` fraction line beneath `Profitable trades`.
- `total_trades` (a separate "Total trades" label) is supported but absent from the primary fixture — correctly returns undefined.
- DOM fallback now calls `parseRenderedReport` and sets `metric_count` and `metrics` from parsed output while keeping `rendered_report`.
- Also exported: `hashText(text)` and `isStableSequence(snapshots, minGapMs)` (pure helpers for Bug 3 testing).
- Fixture stored at: tests/fixtures/strategy_report_sample.txt

**Bug 3 — stale read after symbol/input change (src/core/data.js)**
Added `waitStableStrategyResults({ waitStable, stableGapMs, timeoutMs })` (exported). When `waitStable:true`, polls the DOM panel text until two consecutive reads separated by ≥600ms produce the same hash, then delegates to `getStrategyResults()`. Default fast-path (skip polling when already stable) preserved by keeping `getStrategyResults()` unchanged. The stability logic lives in the pure `isStableSequence()` helper so it can be tested without a browser.

**Bug 4 — smartCompile clicks wrong button (src/core/pine.js:505-526)**
Broadened button matching: only considers visible buttons (offsetParent !== null); uses looser regex for `add to chart` and `update on/to chart` (allows surrounding whitespace/icons, case-insensitive). When no add/update button is found, re-scans once AFTER clicking save for a newly-appeared add/update button. When no button is found at all, returns `{ no_button_found: true, available_buttons: [...] }` (all visible button texts). This object is truthy so the keyboard fallback (`Ctrl+Enter`) still fires correctly (via the `noButtonFound` check). The `button_clicked` field in the return value carries `available_buttons` for debuggability. CANNOT verify live click behavior offline — orchestrator must verify against real TradingView.

**Tests: tests/strategy_report_parse.test.js** — 30 tests covering parseRenderedReport (main fixture, unicode minus, edge cases, PnL label collision, comma separators) and the hashText/isStableSequence helpers. All 46 offline tests pass (node --test).

## 2026-06-26 — v3.2.0 strategy-report extraction: end-to-end validation

**What:** Validated `data_get_strategy_results` (and the fresh-spawn CLI `tv data strategy`)
against a live, computed strategy on TradingView Desktop v3.2.0. Fixture: the chartable
"Track B Survivor (proxy)" Pine strategy on `COINBASE:BTCUSD`, Daily.

**Result — PASS.** Tool returned **83 metrics**, `source: "internal_api"`:
- Net Profit **$1,511,317.83 / +151.13%**  · Profit Factor **2.144** · Closed trades **51**
  (19W / 32L, 37.25% profitable) · Avg W/L 3.61 · commission $11,167 · long-only (`short_*` = 0).
- `data_get_trades` returned the long entries / closes (MARKET), earliest fills ~$257–277
  (Coinbase full history).
- **Cross-check vs rendered Strategy Tester panel:** Total P/L **+1,511,317.83 / +151.13%**,
  Max Drawdown **49.07%** — matches the API to the cent (not a half-rendered capture).
- **MCP server and fresh-spawn CLI returned byte-identical numbers** → committed code is correct
  on both paths; the long-running server is not stale.

**Key finding — the internal model DOES populate when a strategy is bound.**
The earlier "v3.2.0 stores the report only in the DOM, model is empty" was the *unbound /
placeholder* state, not a fundamental v3.2.0 model failure. Once the strategy is properly bound
to the tester, the bf43 `isTVScriptStrategy` detection surfaces the full `performance()` model
(`internal_api`, 83 metrics). The DOM-panel fallback I added is a genuine safety net for the
truly-empty-model case, but is not the primary path.

**Binding gotchas for the LLM "add strategy → read report" loop (v3.2.0):**
1. `pine_smart_compile` may click **"Pine Save"** (not "Add to chart") and report
   `study_added:false` when the editor still associates the source with a study that was removed.
   Must then explicitly click the editor's **"Add to chart"** button.
2. That button's DOM `textContent` is **doubled** ("Add to chartAdd to chart"), so
   `ui_click by:text` needs that exact string (or click by coordinates via `ui_find_element`).
   Plain "Add to chart" does not match.
3. The Strategy Tester's **"Choose strategy"** button opens the *Add-Indicator* dialog
   (built-in strategies), NOT a binder for an existing chart study. With several strategies on
   the chart, none auto-binds.
4. `chart_manage_indicator add` does **not** resolve built-in strategy names
   (e.g. "MACD Strategy") — it's indicator-oriented.

**Working loop (verified):**
`chart_set_symbol` → `chart_set_timeframe` → `ui_open_panel pine-editor`
→ `pine_set_source` → `pine_smart_compile` (Save) → `ui_click "Add to chartAdd to chart"`
→ `ui_open_panel strategy-tester` → `data_get_strategy_results` / `data_get_trades`.

**Proxy ≠ Track B.** These are the chartable-proxy shell's numbers (SMA-200 trend base +
20-bar breakdown gate, long/flat, 0.02% commission). They validate the *extraction tool*, NOT
Track B's edge — the real strategy is an xgboost long/flat signal (Python backtest 478% /
Sharpe 0.92) that cannot be expressed in Pine and is not comparable.

Screenshots: `screenshots/trackb_report_validated.png` (panel matching the API),
`screenshots/pine_editor_buttons.png`, `screenshots/trackb_choose_strategy.png`.
