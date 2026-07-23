import assert from 'node:assert/strict';
import {buildTimeline, exportSrt, normalizeLyricCoverage, parseLyrics, validateTimeline} from '../skills/cimu/scripts/timeline-editor-core.mjs';

const srt = `1\n00:00:01,200 --> 00:00:02,800\n第一句\n\n2\n00:00:03,000 --> 00:00:04,500\n第二句\n`;
const ass = `[Events]\nDialogue: 0,0:00:01.20,0:00:02.80,Default,,0,0,0,,{\\i1}第一句\\N第二句`;
const lrc = `[00:01.20]第一句\n[00:02.80]第二句`;

assert.deepEqual(parseLyrics(srt, 'srt').map((line) => line.text), ['第一句', '第二句']);
assert.equal(parseLyrics(ass, 'ass')[0].text, '第一句 第二句');
const timeline = buildTimeline({contents:lrc, format:'lrc', durationSeconds:5, title:'测试'});
assert.equal(timeline.lines.length, 2);
assert.equal(timeline.lines[0].end, 2.8);
assert.match(exportSrt(timeline), /00:00:01,200 --> 00:00:02,800/);
const plainTimeline = buildTimeline({contents:'第一句\n第二句\n第三句', format:'plain-text'});
assert.equal(validateTimeline({...plainTimeline, review:{required:false}}).errors.length, 0);
const report = validateTimeline({...timeline, lines:[...timeline.lines, {start:4.8,end:5.1,text:'越界',groups:['越界'],groupStarts:[4.9]}]});
assert.ok(report.errors.some((issue) => issue.code === 'line-outside-duration'));
assert.ok(report.warnings.some((issue) => issue.code === 'short-dwell'));
assert.equal(normalizeLyricCoverage(' Don\'t  Touch\nMy Code '), "don'ttouchmycode");
const droppedWords = validateTimeline({durationSeconds:3, lines:[{
  start:0, end:3, text:'我们代表新一代那种高级商贩', groups:['新一代','高级','商贩'], groupStarts:[.2, 1, 1.8]
}]});
assert.ok(droppedWords.errors.some((issue) => issue.code === 'group-text-coverage'));
console.log('timeline-editor-core tests passed');
