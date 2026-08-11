import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { registerHealthTools } from './tools/health.js';
import { registerChartTools } from './tools/chart.js';
import { registerPineTools } from './tools/pine.js';
import { registerDataTools } from './tools/data.js';
import { registerCaptureTools } from './tools/capture.js';
import { registerDrawingTools } from './tools/drawing.js';
import { registerAlertTools } from './tools/alerts.js';
import { registerBatchTools } from './tools/batch.js';
import { registerReplayTools } from './tools/replay.js';
import { registerIndicatorTools } from './tools/indicators.js';
import { registerWatchlistTools } from './tools/watchlist.js';
import { registerUiTools } from './tools/ui.js';
import { registerPaneTools } from './tools/pane.js';
import { registerTabTools } from './tools/tab.js';

const SERVER_INFO = {
  name: 'tradingview',
  version: '2.0.0',
  description: 'AI-assisted TradingView chart analysis and Pine Script development via Chrome DevTools Protocol',
};

const SERVER_OPTIONS = {
  instructions: `TradingView MCP — 86 tools for reading and controlling a live TradingView Desktop chart.

TOOL SELECTION GUIDE — use this to pick the right tool:

Reading your chart:
- chart_get_state → get symbol, timeframe, all indicator names + entity IDs (call first)
- data_get_study_values → get current numeric values from ALL visible indicators (RSI, MACD, BB, EMA, etc.)
- quote_get → get real-time price snapshot (last, OHLC, volume)
- data_get_ohlcv → get price bars. ALWAYS pass summary=true unless you need individual bars

Reading custom Pine indicator output (line.new/label.new/table.new/box.new drawings):
- data_get_pine_lines → horizontal price levels from custom indicators (deduplicated, sorted)
- data_get_pine_labels → text annotations with prices ("PDH 24550", "Bias Long", etc.)
- data_get_pine_tables → table data as formatted rows (session stats, analytics dashboards)
- data_get_pine_boxes → price zones as {high, low} pairs
- ALWAYS pass study_filter to target a specific indicator by name (e.g., study_filter="Profiler")
- Indicators must be VISIBLE on chart for these to work

Changing the chart:
- chart_set_symbol, chart_set_timeframe, chart_set_type → change ticker/resolution/style
- chart_manage_indicator → add/remove studies. USE FULL NAMES: "Relative Strength Index" not "RSI"
- chart_scroll_to_date → jump to a date (ISO format)
- indicator_set_inputs → change indicator settings (length, source, etc.)

Pine Script development:
- pine_list_editor_instances → inventory every live facade/placement plus unsupported orphan Monaco models
- pine_get_context / pine_get_source → pass placement; omitted placement fails when multiple instances are live
- Every lifecycle mutation requires placement, exact editor_instance_id, model_uri, source SHA-256, and one saved ID or draft token
- pine_new / pine_open / pine_set_source / pine_save / pine_save_as → same-facade lifecycle with authoritative readback; no focus-dependent menu/keyboard fallback
- pine_smart_compile → same-facade compile + same-model errors + explicit study-count diagnostics
- pine_get_errors / pine_get_console → placement-scoped reads
- pine_delete_script → exact ID + exact name/version cleanup with absence verification; no bulk Pine delete
- WARNING: pine_get_source can return 200KB+ for complex scripts — avoid unless editing

Screenshots: capture_screenshot → regions: "full", "chart", "strategy_tester"
Replay: replay_start → replay_step → replay_trade → replay_status → replay_stop
Batch: batch_run → run action across multiple symbols/timeframes
Drawing:
- draw_capabilities → authoritative names, arity, API routes, and unsupported dispositions
- draw_position → native Long Position / Short Position with entry, stop, target, and horizon
- draw_note → exact-loaded-bar text, note, callout, and label annotations
- draw_shape → registry-approved chart drawings; pass points matching advertised arity
- draw_list / draw_get_properties / draw_update / draw_remove_one → exact-ID lifecycle
- draw_clear is destructive legacy behavior; never use it for temporary cleanup
Alerts: alert_create, alert_list, alert_delete
Launch: tv_launch → auto-detect and start TradingView with CDP on any platform
Panes: pane_list, pane_set_layout (s, 2h, 2v, 4, 6, 8), pane_focus, pane_set_symbol
Tabs: tab_list, tab_new, tab_close, tab_switch

CONTEXT MANAGEMENT:
- ALWAYS use summary=true on data_get_ohlcv
- ALWAYS use study_filter on pine tools when you know which indicator you want
- NEVER use verbose=true unless user specifically asks for raw data
- Prefer capture_screenshot for visual context over pulling large datasets
- Call chart_get_state ONCE at start, reuse entity IDs`,
};

// Builds a fresh MCP server for each transport session. Tool handlers share the
// same underlying TradingView Desktop CDP singleton.
export function createMcpServer() {
  const server = new McpServer(SERVER_INFO, SERVER_OPTIONS);
  registerHealthTools(server);
  registerChartTools(server);
  registerPineTools(server);
  registerDataTools(server);
  registerCaptureTools(server);
  registerDrawingTools(server);
  registerAlertTools(server);
  registerBatchTools(server);
  registerReplayTools(server);
  registerIndicatorTools(server);
  registerWatchlistTools(server);
  registerUiTools(server);
  registerPaneTools(server);
  registerTabTools(server);
  return server;
}

const STARTUP_NOTICE = [
  '⚠  tradingview-mcp  |  Unofficial tool. Not affiliated with TradingView Inc. or Anthropic.\n',
  "   Ensure your usage complies with TradingView's Terms of Use.\n\n",
];
const DEFAULT_HTTP_PORT = 17781;

// `--http` uses the default port; `--http=<port>` and `--http <port>` select one.
export function parseHttpPort(argv) {
  const httpIdx = argv.findIndex((arg) => arg === '--http' || arg.startsWith('--http='));
  if (httpIdx === -1) return null;
  const flag = argv[httpIdx];
  if (flag.includes('=')) {
    const port = Number(flag.split('=')[1]);
    return Number.isInteger(port) && port > 0 && port <= 65535 ? port : DEFAULT_HTTP_PORT;
  }
  const next = argv[httpIdx + 1];
  const port = Number(next);
  return next && Number.isInteger(port) && port > 0 && port <= 65535 ? port : DEFAULT_HTTP_PORT;
}

async function startStdio() {
  const server = createMcpServer();
  process.stderr.write(STARTUP_NOTICE[0]);
  process.stderr.write(STARTUP_NOTICE[1]);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

async function startHttp(port) {
  const { default: express } = await import('express');
  const app = express();
  app.use(express.json());
  /** @type {Record<string, StreamableHTTPServerTransport>} */
  const transports = {};

  app.post('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'];
    try {
      let transport;
      if (sessionId && transports[sessionId]) {
        transport = transports[sessionId];
      } else if (!sessionId && isInitializeRequest(req.body)) {
        const server = createMcpServer();
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sid) => { transports[sid] = transport; },
        });
        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid && transports[sid]) delete transports[sid];
        };
        await server.connect(transport);
      } else {
        res.status(400).json({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Bad Request: No valid session ID provided' },
          id: null,
        });
        return;
      }
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error('Error handling MCP request:', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        });
      }
    }
  });

  const handleSessionRequest = async (req, res) => {
    const sessionId = req.headers['mcp-session-id'];
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }
    await transports[sessionId].handleRequest(req, res);
  };
  app.get('/mcp', handleSessionRequest);
  app.delete('/mcp', handleSessionRequest);

  await new Promise((resolve) => {
    app.listen(port, '127.0.0.1', () => {
      process.stderr.write(STARTUP_NOTICE[0]);
      process.stderr.write(STARTUP_NOTICE[1]);
      process.stderr.write(`   Streamable HTTP listening on http://127.0.0.1:${port}/mcp\n\n`);
      resolve();
    });
  });
}

const httpPort = parseHttpPort(process.argv.slice(2));
if (httpPort) await startHttp(httpPort);
else await startStdio();
