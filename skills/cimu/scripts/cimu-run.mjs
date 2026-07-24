#!/usr/bin/env node
// Preferred one-call entry point for agents. It uses the current directory as the delivery root.
import {dirname, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const scriptRoot = resolve(dirname(new URL(import.meta.url).pathname));
const args = process.argv.slice(2);
if (!args.includes('--out')) args.push('--out', process.cwd());
const result = spawnSync(process.execPath, [resolve(scriptRoot, 'run-delivery.mjs'), ...args], {encoding:'utf8', maxBuffer:8 * 1024 * 1024, stdio:['ignore', 'pipe', 'pipe']});
process.stdout.write(result.stdout ?? '');
if (result.status !== 0 && !result.stdout) process.stdout.write(`FAIL stage=entry code=exit-${result.status ?? 'signal'}\n`);
process.exit(result.status ?? 1);
