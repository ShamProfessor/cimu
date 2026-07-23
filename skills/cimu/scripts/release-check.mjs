#!/usr/bin/env node
import {dirname, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const asJson = process.argv.includes('--json');
const scriptRoot = resolve(dirname(new URL(import.meta.url).pathname));
const skillRoot = resolve(scriptRoot, '..');
const projectRoot = resolve(skillRoot, '../..');
const checks = [];
function run(name, script, args = []) {
  const result = spawnSync(process.execPath, [resolve(scriptRoot, script), ...args], {encoding:'utf8'});
  checks.push({name, passed:result.status === 0, output:`${result.stdout ?? ''}${result.stderr ?? ''}`.trim()});
}
run('runtime', 'check-runtime.mjs', ['--json']);
run('self-test', 'self-test.mjs');
const report = {schemaVersion:1, skillRoot, checks, passed:checks.every((check) => check.passed)};
if (asJson) console.log(JSON.stringify(report, null, 2));
else for (const check of checks) console.log(`${check.passed ? 'PASS' : 'FAIL'} ${check.name}${check.output ? `\n${check.output}` : ''}`);
if (!report.passed) process.exit(1);
