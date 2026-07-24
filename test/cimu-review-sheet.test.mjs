import assert from 'node:assert/strict';
import {existsSync, mkdtempSync, rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const temporary = mkdtempSync('/private/tmp/cimu-review-sheet-');
const video = resolve(temporary, 'input.mp4');
const sheet = resolve(temporary, 'review.jpg');
try {
  const fixture = spawnSync('ffmpeg', ['-hide_banner','-loglevel','error','-y','-f','lavfi','-i','color=c=navy:s=320x180:d=1','-f','lavfi','-i','sine=frequency=440:duration=1','-shortest','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac',video], {encoding:'utf8'});
  assert.equal(fixture.status, 0, fixture.stderr);
  const result = spawnSync(process.execPath, [resolve('skills/cimu/scripts/generate-review-sheet.mjs'), '--input', video, '--out', sheet], {encoding:'utf8'});
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.ok(existsSync(sheet));
  assert.match(result.stdout, /^PASS stage=review-sheet .* frames=5\n$/);
  assert.equal(result.stderr, '');
} finally {
  rmSync(temporary, {recursive:true, force:true});
}
console.log('cimu review-sheet tests passed');
