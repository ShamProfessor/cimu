#!/usr/bin/env node
import {existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {basename, dirname, resolve} from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {createServer} from 'node:net';
import {findChrome} from './runtime.mjs';

const assetDirectory = resolve(dirname(new URL(import.meta.url).pathname), '../assets');
const defaultTemplate = resolve(assetDirectory, 'kinetic-code-grid.html');
const templates = {
  'rap-adaptive-collage': resolve(assetDirectory, 'rap-adaptive-collage.html'),
  'hiphop-editorial-collage': resolve(assetDirectory, 'hiphop-editorial-collage.html'),
  'webgl-hiphop-hook': resolve(assetDirectory, 'webgl-hiphop-hook.html'),
  'webgl-hiphop-editorial': resolve(assetDirectory, 'webgl-hiphop-hook.html'),
  'webgl-lyric-stage': resolve(assetDirectory, 'webgl-hiphop-hook.html'),
  'webgl-folk-lyric-stage': resolve(assetDirectory, 'webgl-hiphop-hook.html'),
  'webgl-pop-memory-stage': resolve(assetDirectory, 'webgl-hiphop-hook.html'),
  'webgl-rock-stage': resolve(assetDirectory, 'webgl-hiphop-hook.html'),
  'webgl-rock-indie-stage': resolve(assetDirectory, 'webgl-hiphop-hook.html'),
  'folk-city-walk-lyric': resolve(assetDirectory, 'folk-city-walk-lyric.html'),
  'folk-letterpress-lyric': resolve(assetDirectory, 'folk-letterpress-lyric.html'),
  'ballad-cover-lyric': resolve(assetDirectory, 'ballad-cover-lyric.html')
};

function parseArgs(argv) {
  const values = {start: 0, from: 0, duration: 30, timelineDuration: null, width: 1280, height: 720, fps: 30, port: null, startupTimeout: 30, renderTimeout: 360, encodeTimeout: 240};
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith('--')) continue;
    const name = key.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) throw new Error(`Missing value for ${key}`);
    const normalized = {'timeline-duration':'timelineDuration', 'startup-timeout':'startupTimeout', 'render-timeout':'renderTimeout', 'encode-timeout':'encodeTimeout'}[name] ?? name;
    if (!['audio', 'audio-data', 'lrc', 'timeline', 'style-plan', 'template', 'out', 'chrome', 'start', 'from', 'duration', 'timelineDuration', 'width', 'height', 'fps', 'port', 'startupTimeout', 'renderTimeout', 'encodeTimeout'].includes(normalized)) {
      throw new Error(`Unknown option: ${key}`);
    }
    values[normalized] = ['start', 'from', 'duration', 'timelineDuration', 'width', 'height', 'fps', 'port'].includes(normalized) ? Number(next) : next;
    if (['startupTimeout', 'renderTimeout', 'encodeTimeout'].includes(normalized)) values[normalized] = Number(next);
    i += 1;
  }
  for (const key of ['audio', 'out']) if (!values[key]) throw new Error(`Required option: --${key}`);
  if (!values.lrc && !values.timeline) throw new Error('Required option: --lrc or --timeline');
  if (values.timelineDuration === null) values.timelineDuration = values.duration;
  if (values.from < 0 || values.duration <= 0 || values.timelineDuration <= 0 || values.width <= 0 || values.height <= 0 || values.fps <= 0 || !Number.isFinite(values.startupTimeout) || values.startupTimeout <= 0 || !Number.isFinite(values.renderTimeout) || values.renderTimeout <= 0 || !Number.isFinite(values.encodeTimeout) || values.encodeTimeout <= 0) throw new Error('from, duration, dimensions, fps, and timeout values must be valid positive values.');
  if (values.port !== null && (!Number.isInteger(values.port) || values.port < 0 || values.port > 65535)) throw new Error('--port must be an integer from 0 to 65535.');
  return values;
}

function parseLrc(text) {
  const rows = [];
  for (const line of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const timestamps = [...line.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];
    const lyric = line.replace(/\[(\d+):(\d+(?:\.\d+)?)\]/g, '').trim();
    if (!lyric) continue;
    for (const timestamp of timestamps) rows.push({start: Number(timestamp[1]) * 60 + Number(timestamp[2]), text: lyric});
  }
  return rows.sort((a, b) => a.start - b.start);
}

function createTimeline(lrc, start, duration) {
  const parsed = parseLrc(lrc);
  return parsed.map((line, index) => ({...line, end: parsed[index + 1]?.start ?? start + duration}))
    .filter((line) => line.start < start + duration && line.end > start)
    .map((line, index) => ({
      index,
      start: Math.max(0, line.start - start),
      end: Math.min(duration, line.end - start),
      text: line.text,
    }));
}

function delay(ms) { return new Promise((resolveDelay) => setTimeout(resolveDelay, ms)); }

async function freePort() {
  return new Promise((resolvePort, rejectPort) => {
    const probe = createServer();
    probe.once('error', rejectPort);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      probe.close((error) => error ? rejectPort(error) : resolvePort(address.port));
    });
  });
}

async function waitForChrome(port, timeoutSeconds) {
  const address = `http://127.0.0.1:${port}/json/list`;
  const attempts = Math.ceil(timeoutSeconds * 10);
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(address);
      if (response.ok) return response.json();
    } catch {}
    await delay(100);
  }
  throw new Error(`Chrome DevTools did not become ready within ${timeoutSeconds}s.`);
}

function stopBrowser(browser) {
  if (!browser?.pid || browser.exitCode !== null) return;
  try {
    // Keep cleanup confined to this browser process. Sending a negative PID can
    // terminate a parent production runner when the host assigns a shared group.
    browser.kill('SIGTERM');
  } catch {
    browser.kill('SIGTERM');
  }
}

function connect(url) {
  const socket = new WebSocket(url);
  const pending = new Map();
  let nextId = 0;
  socket.addEventListener('message', ({data}) => {
    const message = JSON.parse(data);
    if (message.id && pending.has(message.id)) {
      const {resolveCall, rejectCall} = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) rejectCall(new Error(message.error.message)); else resolveCall(message.result);
    }
  });
  const opened = new Promise((resolveOpen, rejectOpen) => {
    socket.addEventListener('open', resolveOpen, {once: true});
    socket.addEventListener('error', () => rejectOpen(new Error('Chrome DevTools socket failed.')), {once: true});
  });
  const call = async (method, params = {}) => {
    await opened;
    const id = ++nextId;
    return new Promise((resolveCall, rejectCall) => {
      pending.set(id, {resolveCall, rejectCall});
      socket.send(JSON.stringify({id, method, params}));
    });
  };
  return {call, close: () => socket.close()};
}

async function main() {
  const config = parseArgs(process.argv);
  const chrome = findChrome({chromePath:config.chrome});
  if (!chrome) throw new Error('Google Chrome or Chromium was not found. Set LYRIC_MV_CHROME_PATH or pass --chrome /path/to/chrome.');
  const timelineDocument = config.timeline ? JSON.parse(readFileSync(config.timeline, 'utf8')) : null;
  const timeline = timelineDocument
    ? timelineDocument.lines.map((line, index) => ({...line, index}))
    : createTimeline(readFileSync(config.lrc, 'utf8'), config.start, config.timelineDuration);
  const timelineMeta = timelineDocument ? Object.fromEntries(Object.entries(timelineDocument).filter(([key]) => key !== 'lines')) : {};
  if (config['style-plan']) timelineMeta.stylePlan = JSON.parse(readFileSync(resolve(config['style-plan']), 'utf8'));
  const styleTemplate = timelineMeta.stylePlan?.template;
  if (styleTemplate && !templates[styleTemplate]) throw new Error(`Unknown style-plan template: ${styleTemplate}`);
  const template = config.template ? resolve(config.template) : (styleTemplate ? templates[styleTemplate] : defaultTemplate);
  const requiredFiles = [config.audio, template, chrome, config.timeline ?? config.lrc];
  if (config['style-plan']) requiredFiles.push(config['style-plan']);
  if (config['audio-data']) requiredFiles.push(config['audio-data']);
  for (const path of requiredFiles) if (!path || !existsSync(path)) throw new Error(`File not found: ${path}`);
  if (config['audio-data']) {
    timelineMeta.audioData = JSON.parse(readFileSync(resolve(config['audio-data']), 'utf8'));
  } else if (timelineMeta.audioDataFile) {
    const audioDataPath = resolve(dirname(resolve(config.timeline)), timelineMeta.audioDataFile);
    if (!existsSync(audioDataPath)) throw new Error(`Audio-data file not found: ${audioDataPath}`);
    timelineMeta.audioData = JSON.parse(readFileSync(audioDataPath, 'utf8'));
  }
  if (timeline.length === 0) throw new Error('No lyric lines fall inside the requested range.');

  const output = resolve(config.out);
  const temporary = mkdtempSync('/private/tmp/cimu-');
  const profile = `${temporary}/chrome-profile`;
  const frames = `${temporary}/frames`;
  mkdirSync(frames);
  const pageUrl = `file://${template}`;
  const port = config.port || await freePort();
  const needsWebgl = basename(template) === 'webgl-hiphop-hook.html';
  let chromeError = '';
  const browser = spawn(chrome, [
    '--headless', ...(needsWebgl ? ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=swiftshader', '--allow-file-access-from-files'] : ['--disable-gpu']), '--disable-background-networking', '--disable-component-update', '--disable-extensions', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    `--window-size=${config.width},${config.height}`, '--force-device-scale-factor=1', pageUrl,
  ], {stdio: ['ignore', 'ignore', 'pipe'], detached: process.platform !== 'win32'});
  browser.stderr?.on('data', (chunk) => { chromeError = `${chromeError}${chunk}`.slice(-6000); });

  try {
    let pages;
    try {
      pages = await waitForChrome(port, config.startupTimeout);
    } catch (error) {
      const details = chromeError.trim() ? ` Chrome stderr: ${chromeError.trim()}` : '';
      throw new Error(`${error.message}${details}`);
    }
    const page = pages.find((entry) => entry.type === 'page' && entry.url.includes(basename(template)));
    if (!page) throw new Error('Could not locate the lyric MV page in Chrome.');
    const cdp = connect(page.webSocketDebuggerUrl);
    await cdp.call('Emulation.setDeviceMetricsOverride', {width: config.width, height: config.height, deviceScaleFactor: 1, mobile: false});
    await cdp.call('Runtime.evaluate', {expression: `window.__LYRICS=${JSON.stringify(timeline)};window.__TIMELINE_META=${JSON.stringify(timelineMeta)};window.__DURATION=${config.timelineDuration};window.__assetsReady=window.loadTimelineAssets?window.loadTimelineAssets(window.__TIMELINE_META):Promise.resolve();window.renderAt(${config.from});`});
    await cdp.call('Runtime.evaluate', {
      expression: `Promise.all([
        document.fonts.ready,
        ...Array.from(document.images).map((image) => image.complete
          ? Promise.resolve()
          : new Promise((resolveImage) => {
              image.addEventListener('load', resolveImage, {once: true});
              image.addEventListener('error', resolveImage, {once: true});
            })
        )
      ])`,
      awaitPromise: true,
    });
    await cdp.call('Runtime.evaluate', {expression: 'Promise.resolve(window.__assetsReady)', awaitPromise: true});
    const frameCount = Math.round(config.duration * config.fps);
    const renderDeadline = Date.now() + config.renderTimeout * 1000;
    for (let frame = 0; frame < frameCount; frame += 1) {
      if (Date.now() > renderDeadline) throw new Error(`Frame capture exceeded the ${config.renderTimeout}s render timeout after ${frame}/${frameCount} frames.`);
      const time = config.from + frame / config.fps;
      await cdp.call('Runtime.evaluate', {expression: `window.renderAt(${time.toFixed(6)})`});
      const shot = await cdp.call('Page.captureScreenshot', {format: 'png', clip: {x: 0, y: 0, width: config.width, height: config.height, scale: 1}});
      writeFileSync(`${frames}/frame-${String(frame).padStart(4, '0')}.png`, Buffer.from(shot.data, 'base64'));
    }
    cdp.close();
    const encode = spawnSync('ffmpeg', [
      '-hide_banner', '-y', '-framerate', String(config.fps), '-start_number', '0', '-i', `${frames}/frame-%04d.png`,
      '-ss', String(config.start + config.from), '-t', String(config.duration), '-i', config.audio,
      '-map', '0:v:0', '-map', '1:a:0', '-shortest', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
      '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', output,
    ], {stdio: 'inherit', timeout: config.encodeTimeout * 1000, killSignal: 'SIGTERM'});
    if (encode.error) throw new Error(`FFmpeg encode failed: ${encode.error.message}`);
    if (encode.status !== 0) throw new Error(`FFmpeg encode failed with status ${encode.status ?? 'unknown'}.`);
    console.log(`Rendered ${output}`);
  } finally {
    stopBrowser(browser);
    try {
      rmSync(temporary, {recursive: true, force: true, maxRetries: 8, retryDelay: 150});
    } catch (cleanupError) {
      console.warn(`Temporary render files kept at ${temporary}: ${cleanupError.message}`);
    }
  }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
