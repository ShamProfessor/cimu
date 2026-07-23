#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildTimeline, exportSrt, parseLyrics, validateTimeline} from './timeline-editor-core.mjs';
import {SCENE_ENGINES, WEBGL_SUPPORTED_EFFECTS, resolveSections, sceneEngineForProfile} from './style-plan-core.mjs';

const srt = `1\n00:00:01,200 --> 00:00:02,800\n第一句\n\n2\n00:00:03,000 --> 00:00:04,500\n第二句\n`;
const ass = `[Events]\nDialogue: 0,0:00:01.20,0:00:02.80,Default,,0,0,0,,{\\i1}第一句\\N第二句`;
assert.deepEqual(parseLyrics(srt, 'srt').map((line) => line.text), ['第一句', '第二句']);
assert.equal(parseLyrics(ass, 'ass')[0].text, '第一句 第二句');
const timeline = buildTimeline({contents:'[00:01.20]第一句\n[00:02.80]第二句', format:'lrc', durationSeconds:5, title:'self-test'});
assert.equal(timeline.lines[0].end, 2.8);
assert.match(exportSrt(timeline), /00:00:01,200 --> 00:00:02,800/);
assert.equal(validateTimeline({...timeline, review:{required:false}}).passed, true);
assert.ok(validateTimeline({...timeline, lines:[...timeline.lines, {start:4.8,end:5.1,text:'越界',groups:['越界'],groupStarts:[4.9]}]}).errors.some((issue) => issue.code === 'line-outside-duration'));
assert.equal(Object.keys(SCENE_ENGINES).length, 8);
assert.equal(sceneEngineForProfile('folk-city-walk'), 'city-route');
assert.equal(resolveSections({...timeline, lines:[{start:0,end:1,role:'verse'},{start:1,end:2,role:'hook'},{start:2,end:3,role:'verse'}]}, {sceneEngine:'editorial-depth'}).length, 3);
const rendererSource = readFileSync(new URL('../assets/webgl-hiphop-hook.html', import.meta.url), 'utf8');
for (const effect of WEBGL_SUPPORTED_EFFECTS) assert.ok(rendererSource.includes(`'${effect}'`), `Renderer capability ${effect} is not implemented by name.`);
console.log('cimu self-test passed');
