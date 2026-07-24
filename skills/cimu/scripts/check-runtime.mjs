#!/usr/bin/env node
import {inspectRuntime} from './runtime.mjs';

const asJson = process.argv.includes('--json');
const summaryJson = process.argv.includes('--summary-json');
const report = inspectRuntime();
if (asJson) console.log(JSON.stringify(report, null, 2));
else if (summaryJson) console.log(JSON.stringify({status:report.passed?'passed':'failed',stage:'runtime',checks:report.checks.map(({name,passed})=>({name,passed}))}));
else {
  for (const check of report.checks) console.log(`${check.passed ? 'PASS' : 'FAIL'} ${check.name}: ${check.actual ?? 'not found'}${check.path ? ` (${check.path})` : ''}`);
  if (!report.passed) console.error('Set LYRIC_MV_CHROME_PATH to a Chrome/Chromium executable when automatic discovery is not sufficient.');
}
if (!report.passed) process.exit(1);
