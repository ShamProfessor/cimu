#!/usr/bin/env node
import {readFileSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';

function option(name, fallback = undefined) { const index = process.argv.indexOf(`--${name}`); return index === -1 ? fallback : process.argv[index + 1]; }
const timelinePath = option('timeline');
const outputPath = option('out');
if (!timelinePath || !outputPath) throw new Error('Usage: analyze-song-profile.mjs --timeline timeline.json --out song-profile.json [--audio-data audio.json] [--genre folk|rap|pop] [--intent city-walk] [--visual-profile profile]');
const timeline = JSON.parse(readFileSync(resolve(timelinePath), 'utf8'));
const audioPath = option('audio-data');
const audio = audioPath ? JSON.parse(readFileSync(resolve(audioPath), 'utf8')) : null;
const text = (timeline.lines ?? timeline.lyrics ?? []).map((line) => line.text ?? '').join('\n');
const genreOverride = option('genre');
const intentOverride = option('intent');
const visualProfileOverride = option('visual-profile');
const has = (expression) => expression.test(text);
const average = (key) => audio?.frames?.length ? audio.frames.reduce((sum, frame) => sum + Number(frame[key] ?? 0), 0) / audio.frames.length : null;
const rms = average('rms');
const bass = average('bass');
let genre = genreOverride;
const reasons = [];
if (!genre) {
  if (has(/flow|verse|hook|punchline|freestyle|说唱|押韵|代码|赌|筹码|赌场/i)) { genre = 'rap'; reasons.push('lyric vocabulary suggests rhythmic delivery'); }
  else if (has(/成都|城市|街头|小城|故乡|夏天|秋天|九月|路|酒|垂柳|民谣/)) { genre = 'folk'; reasons.push('lyric imagery suggests narrative folk writing'); }
  else if (has(/摇滚|rock|吉他|鼓点|乐队|舞台|失真|live/i)) { genre = 'rock'; reasons.push('lyric imagery suggests live-band rock writing'); }
  else genre = 'pop';
}
let visualProfile;
if (genre === 'rap') {
  if (has(/代码|code|程序|bug|键盘/i)) visualProfile = 'rap-editorial';
  else if (has(/赌|牌|澳门|筹码|赌场/i)) visualProfile = 'macau-heritage';
  else if (has(/夜市|摊|烟火|街边|小城/i)) visualProfile = 'night-market-copy';
  else visualProfile = 'concrete-anthem';
} else if (genre === 'folk') {
  if (intentOverride === 'city-walk' || has(/成都|城市|街头|路|车站|小酒馆|灯/)) visualProfile = 'folk-city-walk';
  else visualProfile = 'folk-letterpress';
} else if (genre === 'rock') {
  visualProfile = 'rock-indie-melancholy';
} else visualProfile = 'pop-memory-release';
if (visualProfileOverride) {
  const allowedProfiles = new Set(['rap-editorial','code-collision','macau-heritage','night-market-copy','concrete-anthem','gangster-flash','rock-arena','rock-indie-melancholy','rock-punk-rebellion','rock-fury','pop-memory-release','folk-letterpress','folk-city-walk','ballad-editorial']);
  if (!allowedProfiles.has(visualProfileOverride)) throw new Error(`Unknown --visual-profile: ${visualProfileOverride}`);
  visualProfile = visualProfileOverride;
  reasons.push('visual profile explicitly selected by artist/editor');
}
const energy = rms === null ? 'unknown' : rms < .28 ? 'restrained' : rms < .55 ? 'measured' : 'driving';
const mood = visualProfile === 'folk-city-walk' ? 'city-memory-to-walk-home' : visualProfile === 'folk-letterpress' ? 'landscape-memory-to-release' : visualProfile === 'pop-memory-release' ? 'memory-to-release' : visualProfile === 'rock-indie-melancholy' ? 'night-drive-to-missed-connection' : visualProfile === 'rock-arena' ? 'tension-to-live-release' : 'impact-to-declaration';
const profile = {
  schemaVersion: 1,
  sourceTimeline: resolve(timelinePath),
  analysisMethod: 'deterministic-heuristics-v1',
  review: {required:true, reason:'Genre, imagery, and profile are a proposal; artist may override before style resolution.'},
  musicProfile: {
    genre,
    energy,
    vocalDensity: (timeline.lines ?? timeline.lyrics ?? []).length > 12 ? 'dense' : 'spacious',
    emotionalArc:mood,
    visualRegister:visualProfile,
    typeRegister:genre === 'rap' ? 'display-plus-emphasis' : 'literary-single-tone',
    backgroundStrategy:visualProfile === 'folk-city-walk' ? 'procedural-city-night-field' : visualProfile === 'folk-letterpress' ? 'procedural-ink-landscape' : visualProfile === 'pop-memory-release' ? 'procedural-memory-film' : visualProfile === 'rock-indie-melancholy' ? 'procedural-wet-night-drive' : visualProfile === 'rock-arena' ? 'procedural-live-stage' : 'profile-procedural-plate',
    motifPack:visualProfile === 'folk-city-walk' ? ['route-trace','sodium-light','print-flecks'] : visualProfile === 'folk-letterpress' ? ['ink-landscape','paper-fleck'] : visualProfile === 'rock-indie-melancholy' ? ['wet-asphalt','headlight-trail','torn-poster'] : visualProfile === 'rock-arena' ? ['backlight-beam','amp-grid','smoke'] : [],
    avoid:genre === 'rap' ? ['generic-red-black-default','system-emoji'] : ['cyber-grid','neon-hud','photoreal-concert-footage']
  },
  visualProfile,
  evidence:{lineCount:(timeline.lines ?? timeline.lyrics ?? []).length, rmsAverage:rms === null ? null : Number(rms.toFixed(4)), bassAverage:bass === null ? null : Number(bass.toFixed(4)), keywordReasons:reasons}
};
writeFileSync(resolve(outputPath), JSON.stringify(profile, null, 2));
console.log(`Inferred ${profile.visualProfile} from ${profile.evidence.lineCount} lyric rows → ${resolve(outputPath)}`);
