# TradingView MCP — Claude Instructions

86 tools for reading and controlling a live TradingView Desktop chart via CDP (port 9222).

## Decision Tree — Which Tool When

### "What's on my chart right now?"
1. `chart_get_state` → symbol, timeframe, chart type, list of all indicators with entity IDs
2. `data_get_study_values` → current numeric values from all visible indicators (RSI, MACD, BBands, EMAs, etc.)
3. `quote_get` → real-time price, OHLC, volume for current symbol

### "What levels/lines/labels are showing?"
Custom Pine indicators draw with `line.new()`, `label.new()`, `table.new()`, `box.new()`. These are invisible to normal data tools. Use:

1. `data_get_pine_lines` → horizontal price levels drawn by indicators (deduplicated, sorted high→low)
2. `data_get_pine_labels` → text annotations with prices (e.g., "PDH 24550", "Bias Long ✓")
3. `data_get_pine_tables` → table data formatted as rows (e.g., session stats, analytics dashboards)
4. `data_get_pine_boxes` → price zones / ranges as {high, low} pairs

Use `study_filter` parameter to target a specific indicator by name substring (e.g., `study_filter: "Profiler"`).

### "Give me price data"
- `data_get_ohlcv` with `summary: true` → compact stats (high, low, range, change%, avg volume, last 5 bars)
- `data_get_ohlcv` without summary → all bars (use `count` to limit, default 100)
- `quote_get` → single latest price snapshot

### "Analyze my chart" (full report workflow)
1. `quote_get` → current price
2. `data_get_study_values` → all indicator readings
3. `data_get_pine_lines` → key price levels from custom indicators
4. `data_get_pine_labels` → labeled levels with context (e.g., "Settlement", "ASN O/U")
5. `data_get_pine_tables` → session stats, analytics tables
6. `data_get_ohlcv` with `summary: true` → price action summary
7. `capture_screenshot` → visual confirmation

### "Change the chart"
- `chart_set_symbol` → switch ticker (e.g., "AAPL", "ES1!", "NYMEX:CL1!")
- `chart_set_timeframe` → switch resolution (e.g., "1", "5", "15", "60", "D", "W")
- `chart_set_type` → switch chart style (Candles, HeikinAshi, Line, Area, Renko, etc.)
- `chart_manage_indicator` → add or remove studies (use full name: "Relative Strength Index", not "RSI")
- `chart_scroll_to_date` → jump to a date (ISO format: "2025-01-15")
- `chart_set_visible_range` → zoom to exact date range (unix timestamps)

### "Work on Pine Script"
1. `ui_open_panel pine-editor open` → open and authoritatively await the bottom editor when working at `placement: "bottom"`
2. `pine_list_editor_instances` → inventory the visible live `bottom`/`dialog` facades and unsupported hidden/orphan Monaco models
3. `pine_get_context` with `placement` → read the exact editor instance, model URI, saved/draft identity, and source SHA-256
4. `pine_new` → create a native draft through that same facade and require a changed model URI
5. `pine_set_source` → pass placement, exact editor instance/model/source guards, and exactly one saved ID or draft token
6. `pine_smart_compile` → compile through that same facade and read markers from the same model
7. `pine_get_errors` / `pine_get_console` with `placement` → inspect scoped results
8. `pine_save` → persist an existing saved script; `pine_save_as` → create and bind an exact new ID on the same facade
9. `pine_open` → exact-name/ID selection with canonical source verification
10. `pine_delete_script` → remove one disposable saved script by exact ID/name/version and verify absence; there is no bulk Pine delete

Every Pine lifecycle mutation requires `placement`, `expected_editor_instance_id`, `expected_model_uri`, `expected_source_sha256`, and exactly one `expected_script_id` or `expected_draft_token`. Hidden or stale facades are rejected before mutation. Never treat a UI label, Monaco text, or compile result alone as identity/persistence proof. Production lifecycle routes do not use focus-dependent menu or keyboard fallbacks.

### "Backtest a strategy" (Strategy Tester)
The script must be a Pine `strategy()` **bound** to the tester — one strategy on the chart auto-binds; with several, none does.
1. `pine_check` → validate the source offline (server compile, no chart needed)
2. Use the guarded Pine workflow above to create/set/save the strategy
3. `pine_smart_compile` → call the selected facade's add-to-chart route and verify same-model markers; inspect `study_added` plus any explicit study-count diagnostics
4. `ui_open_panel strategy-tester open`
5. `data_get_strategy_results` → performance metrics; `data_get_trades` → entries/closes; `data_get_equity` → equity curve

### "Practice trading with replay"
1. `replay_start` with `date: "2025-03-01"` → enter replay mode
2. `replay_step` → advance one bar
3. `replay_autoplay` → auto-advance (set speed with `speed` param in ms)
4. `replay_trade` with `action: "buy"/"sell"/"close"` → execute trades
5. `replay_status` → check position, P&L, current date
6. `replay_stop` → return to realtime

### "Screen multiple symbols"
- `batch_run` with `symbols: ["ES1!", "NQ1!", "YM1!"]` and `action: "screenshot"` or `"get_ohlcv"`

### "Draw on the chart"
- `draw_capabilities` → authoritative shape names, arity, API routes, and unsupported dispositions
- `draw_position` → native Long/Short Position with entry, stop, target, and time horizon
- `draw_note` → exact-loaded-bar text, callout, note, comment, label, signpost, or flag
- `draw_shape` → registry-approved one/two/N-point chart drawings
- `draw_list` / `draw_get_properties` / `draw_update` / `draw_remove_one` → exact-ID lifecycle
- `draw_clear` is destructive legacy behavior. Never use it for temporary/task cleanup.

### "Manage alerts"
- `alert_create` → set price alert (condition: "crossing", "greater_than", "less_than")
- `alert_list` → view active alerts
- `alert_delete` → remove alerts

### "Navigate the UI"
- `ui_open_panel` → open/close pine-editor, strategy-tester, watchlist, alerts, trading
- `ui_click` → click buttons by aria-label, text, or data-name
- `layout_switch` → load a saved layout by name
- `ui_fullscreen` → toggle fullscreen
- `capture_screenshot` → take a screenshot (regions: "full", "chart", "strategy_tester")

### "TradingView isn't running"
- `tv_launch` → auto-detect and launch TradingView with CDP on Mac/Win/Linux
- `tv_health_check` → verify connection is working

### "Tabs, layouts, panes & indicator management"
- `tab_list` / `tab_new` / `tab_switch` / `tab_close` → chart tabs
- `layout_list` / `layout_switch` → saved layouts by name
- `pane_list` / `pane_focus` / `pane_set_layout` / `pane_set_symbol` → multi-pane charts
- `chart_manage_indicator` (add/remove) · `indicator_set_inputs` · `indicator_toggle_visibility` → manage studies
- `symbol_search` / `symbol_info` · `watchlist_add` / `watchlist_get` · `depth_get`

### "Validate Pine offline (no chart needed)"
- `pine_check` → server-side compile, returns errors/warnings
- `pine_analyze` → static analysis
- `pine_list_scripts` → list saved scripts

## Context Management Rules

These tools can return large payloads. Follow these rules to avoid context bloat:

1. **Always use `summary: true` on `data_get_ohlcv`** unless you specifically need individual bars
2. **Always use `study_filter`** on pine tools when you know which indicator you want — don't scan all studies unnecessarily
3. **Never use `verbose: true`** on pine tools unless the user specifically asks for raw drawing data with IDs/colors
4. **Avoid calling `pine_get_source`** on complex scripts — it can return 200KB+. Only read if you need to edit the code.
5. **Avoid calling `data_get_indicator`** on protected/encrypted indicators — their inputs are encoded blobs. Use `data_get_study_values` instead for current values.
6. **Use `capture_screenshot`** for visual context instead of pulling large datasets — a screenshot is ~300KB but gives you the full visual picture
7. **Call `chart_get_state` once** at the start to get entity IDs, then reference them — don't re-call repeatedly
8. **Cap your OHLCV requests** — `count: 20` for quick analysis, `count: 100` for deeper work, `count: 500` only when specifically needed

### Output Size Estimates (compact mode)
| Tool | Typical Output |
|------|---------------|
| `quote_get` | ~200 bytes |
| `data_get_study_values` | ~500 bytes (all indicators) |
| `data_get_pine_lines` | ~1-3 KB per study (deduplicated levels) |
| `data_get_pine_labels` | ~2-5 KB per study (capped at 50) |
| `data_get_pine_tables` | ~1-4 KB per study (formatted rows) |
| `data_get_pine_boxes` | ~1-2 KB per study (deduplicated zones) |
| `data_get_ohlcv` (summary) | ~500 bytes |
| `data_get_ohlcv` (100 bars) | ~8 KB |
| `capture_screenshot` | ~300 bytes (returns file path, not image data) |

## Tool Conventions

- All tools return `{ success: true/false, ... }`
- Entity IDs (from `chart_get_state`) are session-specific — don't cache across sessions
- Pine indicators must be **visible** on chart for pine graphics tools to read their data
- `chart_manage_indicator` requires **full indicator names**: "Relative Strength Index" not "RSI", "Moving Average Exponential" not "EMA", "Bollinger Bands" not "BB"
- Screenshots save to `screenshots/` directory with timestamps
- OHLCV capped at 500 bars, trades at 20 per request
- Pine labels capped at 50 per study by default (pass `max_labels` to override)

## Architecture

```
Claude Code ←→ MCP Server (stdio) ←→ CDP (localhost:9222) ←→ TradingView Desktop (Electron)
```

Pine graphics path: `study._graphics._primitivesCollection.dwglines.get('lines').get(false)._primitivesDataById`
