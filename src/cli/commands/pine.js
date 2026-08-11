import { register } from '../router.js';
import * as core from '../../core/pine.js';
import { readFileSync } from 'fs';

async function readStdin() {
  if (process.stdin.isTTY) return null;
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf-8');
}

const placementOption = { type: 'string', description: 'Exact Pine editor placement from `tv pine instances`' };
const instanceGuardOptions = {
  placement: placementOption,
  'expected-editor-instance-id': { type: 'string', description: 'Exact editor instance ID from `tv pine context`' },
  'expected-model-uri': { type: 'string', description: 'Exact model URI from `tv pine context`' },
  'expected-script-id': { type: 'string', description: 'Exact saved ID from `tv pine context`' },
  'expected-draft-token': { type: 'string', description: 'Exact draft token from `tv pine context`' },
  'expected-source-sha256': { type: 'string', description: 'Exact current source SHA-256' },
};

function instanceGuards(opts) {
  return {
    placement: opts.placement,
    expected_editor_instance_id: opts['expected-editor-instance-id'],
    expected_model_uri: opts['expected-model-uri'],
    expected_script_id: opts['expected-script-id'],
    expected_draft_token: opts['expected-draft-token'],
    expected_source_sha256: opts['expected-source-sha256'],
  };
}

register('pine', {
  description: 'Pine Script tools',
  subcommands: new Map([
    ['instances', {
      description: 'List live Pine editor instances and unsupported orphan models',
      handler: () => core.listEditorInstances(),
    }],
    ['context', {
      description: 'Get placement-bound saved/draft identity, model URI, and source SHA-256',
      options: { placement: placementOption },
      handler: (opts) => core.getCurrentScriptContext({ placement: opts.placement }),
    }],
    ['get', {
      description: 'Get Pine source from one editor placement',
      options: { placement: placementOption },
      handler: (opts) => core.getSource({ placement: opts.placement }),
    }],
    ['set', {
      description: 'Set Pine Script source (reads stdin or --file)',
      options: {
        file: { type: 'string', short: 'f', description: 'Read source from file' },
        ...instanceGuardOptions,
      },
      handler: async (opts) => {
        let source;
        if (opts.file) {
          source = readFileSync(opts.file, 'utf-8');
        } else {
          source = await readStdin();
        }
        if (!source) throw new Error('No source provided. Pipe source via stdin or use --file.');
        return core.setSource({
          source,
          ...instanceGuards(opts),
        });
      },
    }],
    ['compile', {
      description: 'Compile the guarded editor facade and report markers/study diagnostics',
      options: instanceGuardOptions,
      handler: (opts) => core.smartCompile(instanceGuards(opts)),
    }],
    ['raw-compile', {
      description: 'Compile the guarded editor facade and report same-model markers',
      options: instanceGuardOptions,
      handler: (opts) => core.compile(instanceGuards(opts)),
    }],
    ['analyze', {
      description: 'Offline static analysis (no TradingView needed)',
      options: {
        file: { type: 'string', short: 'f', description: 'Read source from file' },
      },
      handler: async (opts) => {
        let source;
        if (opts.file) {
          source = readFileSync(opts.file, 'utf-8');
        } else {
          source = await readStdin();
        }
        if (!source) throw new Error('No source provided. Pipe source via stdin or use --file.');
        return core.analyze({ source });
      },
    }],
    ['check', {
      description: 'Server-side compile check (no chart needed)',
      options: {
        file: { type: 'string', short: 'f', description: 'Read source from file' },
      },
      handler: async (opts) => {
        let source;
        if (opts.file) {
          source = readFileSync(opts.file, 'utf-8');
        } else {
          source = await readStdin();
        }
        if (!source) throw new Error('No source provided. Pipe source via stdin or use --file.');
        return core.check({ source });
      },
    }],
    ['save', {
      description: 'Save the selected saved script after exact identity verification',
      options: instanceGuardOptions,
      handler: (opts) => core.save(instanceGuards(opts)),
    }],
    ['save-as', {
      description: 'Save a draft or copy under a new unique name',
      options: {
        name: { type: 'string', description: 'New unique Pine script name' },
        ...instanceGuardOptions,
      },
      handler: (opts, positionals) => core.saveAs({
        name: opts.name || positionals.join(' '),
        ...instanceGuards(opts),
      }),
    }],
    ['new', {
      description: 'Create a native draft through one guarded editor facade',
      options: instanceGuardOptions,
      handler: (opts, positionals) => {
        const type = positionals[0] || 'indicator';
        return core.newScript({ type, ...instanceGuards(opts) });
      },
    }],
    ['open', {
      description: 'Open an exact saved Pine script through one guarded editor facade',
      options: instanceGuardOptions,
      handler: (opts, positionals) => {
        if (!positionals[0]) throw new Error('Script name required. Usage: tv pine open "My Script"');
        return core.openScript({ name: positionals.join(' '), ...instanceGuards(opts) });
      },
    }],
    ['list', {
      description: 'List saved Pine Scripts',
      handler: () => core.listScripts(),
    }],
    ['delete', {
      description: 'Delete one saved Pine script by exact ID/name/version and verify absence',
      options: {
        id: { type: 'string', description: 'Exact script ID from `tv pine list` or `tv pine save-as`' },
        name: { type: 'string', description: 'Exact current script name' },
        version: { type: 'string', description: 'Exact current script version' },
      },
      handler: (opts) => core.deleteScript({
        script_id: opts.id,
        expected_name: opts.name,
        expected_version: opts.version,
      }),
    }],
    ['errors', {
      description: 'Get markers from one Pine editor placement',
      options: { placement: placementOption },
      handler: (opts) => core.getErrors({ placement: opts.placement }),
    }],
    ['console', {
      description: 'Get console/log output scoped to one Pine editor placement',
      options: { placement: placementOption },
      handler: (opts) => core.getConsole({ placement: opts.placement }),
    }],
  ]),
});
