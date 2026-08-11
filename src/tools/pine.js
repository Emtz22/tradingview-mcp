import { z } from 'zod';
import { jsonResult } from './_format.js';
import * as core from '../core/pine.js';

const placement = z.string().min(1).describe('Exact Pine editor placement from pine_list_editor_instances (for example bottom or dialog)');
const instanceMutationGuards = {
  placement,
  expected_editor_instance_id: z.string().min(1).describe('Exact editor_instance_id from pine_get_context'),
  expected_model_uri: z.string().min(1).describe('Exact model_uri from pine_get_context'),
  expected_script_id: z.string().optional().describe('Exact selected saved-script ID from pine_get_context'),
  expected_draft_token: z.string().optional().describe('Exact selected draft token from pine_new/pine_get_context'),
  expected_source_sha256: z.string().length(64).describe('Exact current source SHA-256 from pine_get_context'),
};

function errorResult(err, extra = {}) {
  return jsonResult({
    success: false,
    ...extra,
    error: err.message,
    error_code: err.code || 'PINE_OPERATION_FAILED',
    details: err.details || undefined,
  }, true);
}

export function registerPineTools(server) {
  server.tool('pine_list_editor_instances', 'List every live React-owned Pine editor instance and unsupported orphan Monaco model without exposing source text', {}, async () => {
    try { return jsonResult(await core.listEditorInstances()); }
    catch (err) { return errorResult(err); }
  });

  server.tool('pine_get_context', 'Read one placement-bound Pine script identity, model URI, saved/draft status, and source SHA-256 before mutation', {
    placement: placement.optional(),
  }, async (args) => {
    try { return jsonResult(await core.getCurrentScriptContext(args)); }
    catch (err) { return errorResult(err); }
  });

  server.tool('pine_get_source', 'Get Pine source from one explicit editor placement', {
    placement: placement.optional(),
  }, async (args) => {
    try { return jsonResult(await core.getSource(args)); }
    catch (err) { return errorResult(err); }
  });

  server.tool('pine_set_source', 'Set source only in the guarded Pine editor instance/model', {
    source: z.string().describe('Pine Script source code to inject'),
    ...instanceMutationGuards,
  }, async (args) => {
    try { return jsonResult(await core.setSource(args)); }
    catch (err) { return errorResult(err); }
  });

  server.tool('pine_compile', 'Compile/add only the guarded Pine editor instance and read markers from the same model', {
    ...instanceMutationGuards,
  }, async (args) => {
    try { return jsonResult(await core.compile(args)); }
    catch (err) { return errorResult(err); }
  });

  server.tool('pine_get_errors', 'Get Monaco markers from one explicit Pine editor placement', {
    placement: placement.optional(),
  }, async (args) => {
    try { return jsonResult(await core.getErrors(args)); }
    catch (err) { return errorResult(err); }
  });

  server.tool('pine_save', 'Save an existing script through its guarded editor facade and verify canonical source', {
    placement,
    expected_editor_instance_id: instanceMutationGuards.expected_editor_instance_id,
    expected_model_uri: instanceMutationGuards.expected_model_uri,
    expected_script_id: z.string().describe('Exact selected saved-script ID from pine_get_context'),
    expected_source_sha256: instanceMutationGuards.expected_source_sha256,
  }, async (args) => {
    try { return jsonResult(await core.save(args)); }
    catch (err) { return errorResult(err); }
  });

  server.tool('pine_save_as', 'Save under a unique name, verify canonical source, and bind the exact new ID to the same guarded editor', {
    name: z.string().min(1).max(200),
    ...instanceMutationGuards,
  }, async (args) => {
    try { return jsonResult(await core.saveAs(args)); }
    catch (err) { return errorResult(err); }
  });

  server.tool('pine_get_console', 'Read Pine console/log output scoped to one editor placement', {
    placement: placement.optional(),
  }, async (args) => {
    try { return jsonResult(await core.getConsole(args)); }
    catch (err) { return errorResult(err); }
  });

  server.tool('pine_smart_compile', 'Compile the guarded editor facade, read same-model markers, and report explicit study-count diagnostics', {
    ...instanceMutationGuards,
  }, async (args) => {
    try { return jsonResult(await core.smartCompile(args)); }
    catch (err) { return errorResult(err); }
  });

  server.tool('pine_new', 'Create a native draft through one guarded editor facade and require an observable model transition', {
    type: z.enum(['indicator', 'strategy', 'library']).describe('Type of script to create'),
    ...instanceMutationGuards,
  }, async (args) => {
    try { return jsonResult(await core.newScript(args)); }
    catch (err) { return errorResult(err); }
  });

  server.tool('pine_open', 'Open one exact saved script through the guarded editor facade', {
    name: z.string().describe('Name of the saved script to open (case-insensitive match)'),
    ...instanceMutationGuards,
  }, async (args) => {
    try { return jsonResult(await core.openScript(args)); }
    catch (err) { return errorResult(err, { source: 'instance_facade' }); }
  });

  server.tool('pine_list_scripts', 'List saved Pine Scripts', {}, async () => {
    try { return jsonResult(await core.listScripts()); }
    catch (err) { return errorResult(err); }
  });

  server.tool('pine_delete_script', 'Delete one saved Pine script by exact ID after exact name/version guards, then verify absence; no bulk delete is exposed', {
    script_id: z.string().min(1).describe('Exact saved script ID from pine_list_scripts or pine_save_as'),
    expected_name: z.string().min(1).describe('Exact current saved script name'),
    expected_version: z.string().min(1).describe('Exact current saved script version'),
  }, async (args) => {
    try { return jsonResult(await core.deleteScript(args)); }
    catch (err) { return errorResult(err); }
  });

  server.tool('pine_analyze', 'Run static analysis on Pine Script code WITHOUT compiling — catches array out-of-bounds, unguarded array.first()/last(), bad loop bounds, and implicit bool casts. Works offline, no TradingView connection needed.', {
    source: z.string().describe('Pine Script source code to analyze'),
  }, async ({ source }) => {
    try { return jsonResult(core.analyze({ source })); }
    catch (err) { return errorResult(err); }
  });

  server.tool('pine_check', 'Compile Pine Script via TradingView\'s server API without needing the chart open. Returns compilation errors/warnings. Useful for validating code before injecting into the chart.', {
    source: z.string().describe('Pine Script source code to compile/validate'),
  }, async ({ source }) => {
    try { return jsonResult(await core.check({ source })); }
    catch (err) { return errorResult(err); }
  });
}
