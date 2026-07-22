#!/usr/bin/env node
import {spawnSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

const input = option('input');
const output = option('out');
const start = Number(option('start', '0'));
const duration = Number(option('duration', '30'));
const fps = Number(option('fps', '30'));
if (!input || !output || !Number.isFinite(start) || !Number.isFinite(duration) || !Number.isFinite(fps)) {
  throw new Error('Usage: extract-audio-profile.mjs --input track.mp3 --start 0 --duration 30 --fps 30 --out audio.json');
}

const sampleRate = 12000;
const result = spawnSync('ffmpeg', [
  '-hide_banner', '-loglevel', 'error', '-ss', String(start), '-t', String(duration), '-i', resolve(input),
  '-vn', '-ac', '1', '-ar', String(sampleRate), '-f', 'f32le', 'pipe:1',
], {encoding: null, maxBuffer: 1024 * 1024 * 64});
if (result.status !== 0) throw new Error(result.stderr?.toString() || 'ffmpeg audio decode failed');

const samples = new Float32Array(result.stdout.buffer, result.stdout.byteOffset, Math.floor(result.stdout.byteLength / 4));
const frameSize = Math.max(1, Math.floor(sampleRate / fps));
const frames = [];
function energyAt(offset, frequency) {
  const length = Math.min(frameSize, samples.length - offset);
  if (length < 4) return 0;
  const omega = 2 * Math.PI * frequency / sampleRate;
  let coeff = 2 * Math.cos(omega), q0 = 0, q1 = 0, q2 = 0;
  for (let i = 0; i < length; i += 1) { q0 = coeff * q1 - q2 + samples[offset + i]; q2 = q1; q1 = q0; }
  return Math.sqrt(q1 * q1 + q2 * q2 - coeff * q1 * q2) / length;
}
for (let offset = 0; offset < samples.length; offset += frameSize) {
  const end = Math.min(samples.length, offset + frameSize);
  let rms = 0;
  for (let i = offset; i < end; i += 1) rms += samples[i] * samples[i];
  rms = Math.sqrt(rms / Math.max(1, end - offset));
  frames.push({rms, bass: energyAt(offset, 90) + energyAt(offset, 150), mid: energyAt(offset, 650), treble: energyAt(offset, 2800)});
}
for (const key of ['rms', 'bass', 'mid', 'treble']) {
  const peak = Math.max(...frames.map((frame) => frame[key]), 0.00001);
  frames.forEach((frame) => { frame[key] = Number(Math.min(1, frame[key] / peak).toFixed(4)); });
}
const beats = [];
for (let index = 2; index < frames.length - 2; index += 1) {
  const current = frames[index];
  const local = (frames[index - 2].bass + frames[index - 1].bass + frames[index + 1].bass + frames[index + 2].bass) / 4;
  if (current.bass > 0.54 && current.bass > local * 1.35 && (!beats.length || index / fps - beats.at(-1) > 0.18)) beats.push(Number((index / fps).toFixed(3)));
}
writeFileSync(resolve(output), JSON.stringify({fps, duration, frames, beats}, null, 2));
console.log(`Audio profile: ${frames.length} frames, ${beats.length} beat candidates → ${resolve(output)}`);
