import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

function versionOf(command, args = ['--version']) {
  const result = spawnSync(command, args, {encoding:'utf8', timeout:10000});
  const output = String(result.stdout || result.stderr || '').trim().split(/\r?\n/)[0];
  // Some sandboxed FFmpeg builds return a non-zero status for `--version` even
  // though the executable is usable. A process-level spawn error still means it
  // cannot be invoked.
  if (result.error || !output) return null;
  return output;
}

function executable(candidate) {
  if (!candidate) return null;
  if (candidate.includes('/') || candidate.includes('\\')) return existsSync(candidate) ? resolve(candidate) : null;
  return versionOf(candidate) ? candidate : null;
}

export function findChrome({chromePath = process.env.LYRIC_MV_CHROME_PATH ?? process.env.CHROME_PATH} = {}) {
  if (chromePath) return executable(chromePath);
  const candidates = [
    process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : null,
    process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : null,
    process.platform === 'win32' ? 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe' : null,
    'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'chrome'
  ];
  for (const candidate of candidates) {
    const resolved = executable(candidate);
    if (resolved) return resolved;
  }
  return null;
}

export function inspectRuntime({requireChrome = true} = {}) {
  const nodeMajor = Number(String(process.versions.node).split('.')[0]);
  const chrome = findChrome();
  const checks = [
    {name:'node', required:'>=20', actual:process.version, passed:Number.isInteger(nodeMajor) && nodeMajor >= 20},
    {name:'ffmpeg', required:'available on PATH', actual:versionOf('ffmpeg'), passed:Boolean(versionOf('ffmpeg'))},
    {name:'ffprobe', required:'available on PATH', actual:versionOf('ffprobe'), passed:Boolean(versionOf('ffprobe'))},
    {name:'chrome', required:'Google Chrome or Chromium; set LYRIC_MV_CHROME_PATH when needed', actual:chrome ? versionOf(chrome) : null, path:chrome, passed:requireChrome ? Boolean(chrome) : true}
  ];
  return {schemaVersion:1, platform:process.platform, checks, passed:checks.every((check) => check.passed)};
}
