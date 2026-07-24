#!/usr/bin/env node
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {CimuPipelineError, lastLines, option, outputMode} from './pipeline-utils.mjs';

function run(command, args) {
  const result = spawnSync(command, args, {encoding:'utf8', maxBuffer:8 * 1024 * 1024, stdio:['ignore', 'pipe', 'pipe']});
  if (result.status !== 0) throw new CimuPipelineError('reviewSheet', `exit-${result.status ?? 'signal'}`, `${command} failed.`, `${result.stdout ?? ''}${result.stderr ?? ''}`);
  return result.stdout;
}

function timestamp(value) { return `${Number(value).toFixed(2)}s`; }

const glyphs = {
  '0':['111','101','101','101','111'], '1':['010','110','010','010','111'], '2':['111','001','111','100','111'],
  '3':['111','001','111','001','111'], '4':['101','101','111','001','001'], '5':['111','100','111','001','111'],
  '6':['111','100','111','101','111'], '7':['111','001','010','010','010'], '8':['111','101','111','101','111'],
  '9':['111','101','111','001','111'], '.':['0','0','0','0','1'], 's':['011','100','010','001','110']
};
function annotateRgb(buffer, width, height, label) {
  const scale = 3, x0 = 18, y0 = 18, boxWidth = label.length * 4 * scale + 14, boxHeight = 5 * scale + 14;
  for (let y = y0 - 7; y < Math.min(height, y0 - 7 + boxHeight); y += 1) for (let x = x0 - 7; x < Math.min(width, x0 - 7 + boxWidth); x += 1) {
    const offset = (y * width + x) * 3; buffer[offset] = 0; buffer[offset + 1] = 0; buffer[offset + 2] = 0;
  }
  for (const [index, character] of [...label].entries()) for (const [row, cells] of (glyphs[character] ?? glyphs.s).entries()) for (const [column, cell] of [...cells].entries()) if (cell === '1') {
    for (let dy = 0; dy < scale; dy += 1) for (let dx = 0; dx < scale; dx += 1) {
      const x = x0 + index * 4 * scale + column * scale + dx, y = y0 + row * scale + dy;
      if (x >= width || y >= height) continue;
      const offset = (y * width + x) * 3; buffer[offset] = 255; buffer[offset + 1] = 255; buffer[offset + 2] = 255;
    }
  }
}

function chooseTimes(duration, timelinePath) {
  const defaults = [duration * .05, duration * .3, duration * .5, duration * .7, duration * .92];
  if (!timelinePath) return defaults;
  const lines = JSON.parse(readFileSync(resolve(timelinePath), 'utf8')).lines ?? [];
  if (!lines.length) return defaults;
  const dense = lines.reduce((best, line) => String(line.text ?? '').length > String(best.text ?? '').length ? line : best, lines[0]);
  const hook = lines.find((line) => line.role === 'hook') ?? lines[Math.floor(lines.length / 2)];
  const transition = lines.find((line) => Number(line.start) >= duration * .65) ?? lines.at(-1);
  return [lines[0].start, dense.start, hook.start, transition.start, Math.max(0, duration - Math.min(1, duration * .08))]
    .map((time) => Math.max(0, Math.min(duration - .01, Number(time))));
}

async function main() {
  const input = option(process.argv, 'input');
  const output = option(process.argv, 'out');
  const timeline = option(process.argv, 'timeline');
  if (!input || !output) throw new CimuPipelineError('inputs', 'invalid-usage', 'Usage: generate-review-sheet.mjs --input video.mp4 --out review-sheet.jpg [--timeline direction.json]');
  const probe = JSON.parse(run('ffprobe', ['-v','error','-show_entries','format=duration:stream=codec_type,width,height','-of','json',resolve(input)]));
  const duration = Number(probe.format?.duration);
  if (!(duration > 0)) throw new CimuPipelineError('reviewSheet', 'invalid-duration', 'Video duration is invalid.');
  const stream = probe.streams?.find((entry) => entry.codec_type === 'video');
  const width = 480, height = Math.max(2, Math.round(width * Number(stream.height) / Number(stream.width) / 2) * 2);
  const temporary = mkdtempSync('/private/tmp/cimu-review-sheet-');
  try {
    const frames = chooseTimes(duration, timeline);
    for (const [index, time] of frames.entries()) {
      const raw = spawnSync('ffmpeg', ['-hide_banner','-loglevel','error','-ss',String(time),'-i',resolve(input),'-frames:v','1','-vf',`scale=${width}:${height}`,'-f','rawvideo','-pix_fmt','rgb24','pipe:1'], {encoding:null, maxBuffer:16 * 1024 * 1024, stdio:['ignore','pipe','pipe']});
      if (raw.status !== 0) throw new CimuPipelineError('reviewSheet', `exit-${raw.status ?? 'signal'}`, 'Frame extraction failed.', raw.stderr?.toString());
      const pixels = Buffer.from(raw.stdout); annotateRgb(pixels, width, height, timestamp(time));
      writeFileSync(resolve(temporary, `frame-${index}.ppm`), Buffer.concat([Buffer.from(`P6\n${width} ${height}\n255\n`), pixels]));
    }
    const inputs = frames.flatMap((_, index) => ['-i', resolve(temporary, `frame-${index}.ppm`)]);
    run('ffmpeg', ['-hide_banner','-loglevel','error','-y',...inputs,'-filter_complex','hstack=inputs=5',resolve(output)]);
    const summary = {status:'passed', stage:'review-sheet', sheet:resolve(output), frames:5};
    process.stdout.write(`${process.argv.includes('--summary-json') ? JSON.stringify(summary) : `PASS stage=review-sheet sheet=${summary.sheet} frames=5`}\n`);
  } finally {
    rmSync(temporary, {recursive:true, force:true});
  }
}

main().catch((error) => {
  const normalized = error instanceof CimuPipelineError ? error : new CimuPipelineError('reviewSheet', 'unexpected', error instanceof Error ? error.message : String(error));
  const details = lastLines(normalized.details || normalized.message, 10);
  process.stdout.write(`FAIL stage=${normalized.stage} code=${normalized.code}\n${details.join('\n')}\n`);
  process.exit(1);
});
