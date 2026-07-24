import assert from 'node:assert/strict';
import {existsSync, mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {compactSummary, planStages, writeContextCard} from '../skills/cimu/scripts/pipeline-utils.mjs';

const temporary = mkdtempSync('/private/tmp/cimu-context-pipeline-');
try {
  assert.deepEqual(planStages('revision', 'style').stages, ['style', 'timelineQa', 'render', 'videoQa', 'reviewSheet']);
  assert.deepEqual(planStages('revision', 'format').stages, ['render', 'videoQa', 'reviewSheet']);
  assert.ok(!planStages('revision', 'style').stages.includes('audio'));
  assert.ok(!planStages('revision', 'format').stages.includes('direction'));
  const session = {
    song:'test-song', latestRun:'run-1', inputs:{audio:{path:'/audio.mp3'}, lyrics:{path:'/lyrics.lrc'}, timeline:{path:'/timeline.json'}},
    artifacts:{video:'/preview.mp4', direction:'/direction.json', stylePlan:'/style-plan.json'}, reviewStatus:'passed'
  };
  const cardPath = writeContextCard({deliveryRoot:temporary, session, lastChange:'style', reviewStatus:'passed'});
  assert.ok(existsSync(cardPath));
  assert.ok(readFileSync(cardPath).byteLength <= 1024);
  const successful = compactSummary({status:'passed', stage:'delivery', video:'/preview.mp4', duration:20, resolution:'1280x720', log:'/run.log'});
  assert.ok(Buffer.byteLength(successful) <= 600);
  const failed = compactSummary({status:'failed', stage:'render', code:'exit-1', log:'/run.log', errorLines:Array.from({length:20}, (_, index) => `error ${index}`)});
  assert.ok(Buffer.byteLength(failed) <= 4096);
  const command = spawnSync(process.execPath, [resolve('skills/cimu/scripts/run-delivery.mjs'), '--out', temporary, '--mode', 'new', '--changed', 'audio', '--summary-json'], {encoding:'utf8'});
  assert.notEqual(command.status, 0);
  assert.ok(Buffer.byteLength(`${command.stdout}${command.stderr}`) <= 4096);
  assert.doesNotMatch(`${command.stdout}${command.stderr}`, /at .*\.mjs:/);
  assert.doesNotThrow(() => JSON.parse(command.stdout));
  const loggedFailure = spawnSync(process.execPath, [resolve('skills/cimu/scripts/cimu-run.mjs'), '--out', temporary, '--mode', 'revision', '--changed', 'style', '--summary-json'], {encoding:'utf8'});
  assert.notEqual(loggedFailure.status, 0);
  assert.ok(Buffer.byteLength(`${loggedFailure.stdout}${loggedFailure.stderr}`) <= 4096);
  assert.doesNotMatch(`${loggedFailure.stdout}${loggedFailure.stderr}`, /Cimu pipeline log|\[runtime\]/);
} finally {
  rmSync(temporary, {recursive:true, force:true});
}
console.log('cimu context pipeline tests passed');
