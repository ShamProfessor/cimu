/**
 * Shared lyric timeline contract used by the CLI validator and the local editor.
 * It deliberately has no Node-only dependency so the editor can import it from a
 * local file URL without a build step.
 */

export const MIN_LINE_DURATION_SECONDS = 0.6;
export const FINAL_GROUP_HOLD_RATIO = 0.35;

export function cleanText(value) {
  return String(value ?? '').replace(/\uFEFF/g, '').replace(/\s+/g, ' ').trim();
}

export function parseTime(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = String(value ?? '').trim();
  if (!text) return Number.NaN;
  if (/^\d+(?:\.\d+)?$/.test(text)) return Number(text);
  const match = text.match(/^(?:(\d+):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?$/);
  if (!match) return Number.NaN;
  const fraction = Number((match[4] ?? '0').padEnd(3, '0')) / 1000;
  return Number(match[1] ?? 0) * 3600 + Number(match[2]) * 60 + Number(match[3]) + fraction;
}

export function formatClock(seconds, precision = 3) {
  if (!Number.isFinite(seconds)) return '—';
  const safe = Math.max(0, seconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const remaining = safe % 60;
  const whole = Math.floor(remaining);
  const fraction = Math.round((remaining - whole) * 10 ** precision).toString().padStart(precision, '0');
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(whole).padStart(2, '0')}.${fraction}`;
}

export function formatSrtClock(seconds) {
  return formatClock(seconds, 3).replace('.', ',');
}

function parseLrc(contents) {
  const rows = [];
  contents.split(/\r?\n/).forEach((raw) => {
    const matches = [...raw.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];
    const text = cleanText(raw.replace(/\[[^\]]+\]/g, ''));
    if (!matches.length || !text || isCreditRow(text)) return;
    matches.forEach((match) => rows.push({start:Number(match[1]) * 60 + Number(match[2]), text}));
  });
  return rows.sort((left, right) => left.start - right.start);
}

function parseSrt(contents) {
  const rows = [];
  for (const block of contents.replace(/^\uFEFF/, '').split(/\r?\n\s*\r?\n/)) {
    const lines = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const timeIndex = lines.findIndex((line) => line.includes('-->'));
    if (timeIndex === -1) continue;
    const [startRaw, endRaw] = lines[timeIndex].split('-->').map((value) => value.trim().split(/\s+/)[0]);
    const start = parseTime(startRaw);
    const end = parseTime(endRaw);
    const text = cleanText(lines.slice(timeIndex + 1).join(' ').replace(/<[^>]*>/g, '').replace(/\\[Nnh]/g, ' '));
    if (Number.isFinite(start) && Number.isFinite(end) && end > start && text && !isCreditRow(text)) rows.push({start, end, text});
  }
  return rows;
}

function parseAss(contents) {
  const rows = [];
  for (const source of contents.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    if (!/^Dialogue\s*:/i.test(source)) continue;
    const fields = source.replace(/^Dialogue\s*:/i, '').split(',');
    if (fields.length < 10) continue;
    const start = parseTime(fields[1]);
    const end = parseTime(fields[2]);
    const text = cleanText(fields.slice(9).join(',').replace(/\{[^}]*\}/g, '').replace(/\\[Nnh]/g, ' '));
    if (Number.isFinite(start) && Number.isFinite(end) && end > start && text && !isCreditRow(text)) rows.push({start, end, text});
  }
  return rows;
}

function isCreditRow(text) {
  return /^(作词|作曲|编曲|制作人|贝斯|鼓|钢琴|箱琴|笛子|弦乐|和声|童声|录音|混音|母带)\s*[:：]/.test(text);
}

export function inferFormat(fileName, contents = '') {
  const match = String(fileName ?? '').toLowerCase().match(/\.([a-z0-9]+)$/);
  if (['lrc', 'srt', 'ass'].includes(match?.[1])) return match[1];
  if (/^\s*\[\d+:\d+/m.test(contents)) return 'lrc';
  if (/^\s*Dialogue\s*:/mi.test(contents)) return 'ass';
  if (/-->/m.test(contents)) return 'srt';
  return 'plain-text';
}

export function parseLyrics(contents, format) {
  if (format === 'lrc') return parseLrc(contents);
  if (format === 'srt') return parseSrt(contents);
  if (format === 'ass') return parseAss(contents);
  return contents.split(/\r?\n/).map(cleanText).filter((text) => text && !text.startsWith('#')).map((text) => ({text}));
}

export function withGroups(line) {
  const start = Number(line.start ?? 0);
  const end = Number(line.end ?? start + 1);
  const groups = Array.isArray(line.groups) && line.groups.length ? line.groups.map(cleanText).filter(Boolean) : [cleanText(line.text)];
  const delay = Math.min(0.1, Math.max(0.03, (end - start) * 0.08));
  const groupStarts = Array.isArray(line.groupStarts) && line.groupStarts.length === groups.length
    ? line.groupStarts.map(Number)
    : groups.map((_, index) => Number((start + delay + index * Math.max(0.08, (end - start) / groups.length)).toFixed(3)));
  return {...line, start:Number(start.toFixed(3)), end:Number(end.toFixed(3)), text:cleanText(line.text), groups, groupStarts};
}

export function buildTimeline({contents, format, title = null, sourceName = null, durationSeconds = null, sourceStartSeconds = 0}) {
  const kind = format === 'plain-text' ? 'plain-text' : format;
  const parsed = parseLyrics(contents, format);
  if (!parsed.length) throw new Error('未找到可用歌词行。');
  const finalEnd = Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : null;
  const sourceRows = parsed.map((row, index) => {
    const start = Number.isFinite(row.start) ? row.start : index * 3;
    const nextStart = Number.isFinite(parsed[index + 1]?.start) ? parsed[index + 1].start : (format === 'plain-text' && index < parsed.length - 1 ? (index + 1) * 3 : undefined);
    const end = Number.isFinite(row.end) ? row.end : (Number.isFinite(nextStart) ? nextStart : (finalEnd ?? start + 4));
    return withGroups({...row, start, end:Math.max(start + MIN_LINE_DURATION_SECONDS, end), confidence:format === 'plain-text' ? 0 : 1, timingSource:format === 'plain-text' ? 'draft' : format});
  });
  const inferredDuration = finalEnd ?? Math.max(...sourceRows.map((row) => row.end));
  return {
    schemaVersion: 2,
    title,
    audio: null,
    cover: null,
    sourceStartSeconds:Number(sourceStartSeconds) || 0,
    durationSeconds:Number(inferredDuration.toFixed(3)),
    lyricSource:{kind, path:sourceName, alignment:null, timingStatus:format === 'plain-text' ? 'draft-no-alignment' : `timed-${format}`},
    review:{required:format === 'plain-text', reason:format === 'plain-text' ? '纯文本歌词需要人工填写并复核时间。' : null},
    lines:sourceRows
  };
}

export function validateTimeline(timeline, {minimumLineDuration = MIN_LINE_DURATION_SECONDS} = {}) {
  const lines = timeline.lines ?? timeline.lyrics ?? [];
  const errors = [];
  const warnings = [];
  const duration = Number(timeline.durationSeconds);
  if (!lines.length) errors.push({code:'no-lines', message:'没有带时间的歌词行。'});
  if (!Number.isFinite(duration) || duration <= 0) warnings.push({code:'no-duration', message:'未设置有效总时长，无法完成越界检查。'});
  if (timeline.review?.required) errors.push({code:'timing-review-required', message:timeline.review.reason ?? '时间轴尚未标记为已审核。'});
  let previousEnd = 0;
  lines.forEach((line, index) => {
    const label = `第 ${index + 1} 行`;
    const start = Number(line.start);
    const end = Number(line.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) errors.push({code:'invalid-range', line:index, message:`${label} 的入场或出场时间无效。`});
    if (Number.isFinite(start) && start < -0.001) errors.push({code:'line-before-zero', line:index, message:`${label} 的入场时间早于 0 秒。`});
    if (Number.isFinite(end) && Number.isFinite(duration) && end > duration + 0.001) errors.push({code:'line-outside-duration', line:index, message:`${label} 的出场时间超出总时长。`});
    if (Number.isFinite(start) && start < previousEnd - 0.001) errors.push({code:'line-overlap', line:index, message:`${label} 与上一行重叠。`});
    if (Number.isFinite(start) && Number.isFinite(end) && end - start < minimumLineDuration) warnings.push({code:'short-dwell', line:index, message:`${label} 停留不足 ${minimumLineDuration.toFixed(1)} 秒。`});
    previousEnd = Math.max(previousEnd, Number.isFinite(end) ? end : 0);
    if (!cleanText(line.text)) errors.push({code:'empty-text', line:index, message:`${label} 没有歌词文本。`});
    const groups = line.groups?.length ? line.groups : [line.text];
    const starts = line.groupStarts ?? [];
    if (starts.length && starts.length !== groups.length) errors.push({code:'group-count', line:index, message:`${label} 的分组起点数量不匹配。`});
    starts.forEach((groupStart, groupIndex) => {
      const point = Number(groupStart);
      if (!Number.isFinite(point) || point < start || point >= end) errors.push({code:'group-outside-line', line:index, group:groupIndex, message:`${label} 的第 ${groupIndex + 1} 个分组起点不在行内。`});
      if (groupIndex && point < Number(starts[groupIndex - 1])) errors.push({code:'group-order', line:index, group:groupIndex, message:`${label} 的分组起点顺序错误。`});
    });
    const finalStart = Number(starts.at(-1));
    if (Number.isFinite(finalStart) && Number.isFinite(start) && Number.isFinite(end) && end - finalStart < (end - start) * FINAL_GROUP_HOLD_RATIO) errors.push({code:'unreadable-final-group', line:index, message:`${label} 的最后分组可读停留不足 ${(FINAL_GROUP_HOLD_RATIO * 100).toFixed(0)}%。`});
  });
  return {schemaVersion:1, durationSeconds:Number.isFinite(duration) ? duration : null, lineCount:lines.length, errors, warnings, passed:errors.length === 0};
}

export function exportSrt(timeline) {
  return (timeline.lines ?? []).map((line, index) => `${index + 1}\n${formatSrtClock(Number(line.start))} --> ${formatSrtClock(Number(line.end))}\n${cleanText(line.text)}`).join('\n\n') + '\n';
}
