#!/usr/bin/env node
import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

function option(name, fallback = null) { const index=process.argv.indexOf(`--${name}`); return index===-1?fallback:process.argv[index+1]; }
const input=option('input'), timelinePath=option('timeline'), output=option('out');
if(!input||!timelinePath) throw new Error('Usage: validate-rendered-mv.mjs --input output.mp4 --timeline direction.json [--fps 30] [--width pixels] [--height pixels] [--out report.json]');
const fps=Number(option('fps','30')), timeline=JSON.parse(readFileSync(resolve(timelinePath),'utf8'));
const allowBlackBackground=process.argv.includes('--allow-black-background');
const expectedWidth=Number(option('width','0')), expectedHeight=Number(option('height','0'));
const probe=spawnSync('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_type,codec_name,width,height','-of','json',resolve(input)],{encoding:'utf8'});
if(probe.status!==0) throw new Error(probe.stderr||'ffprobe failed');
const info=JSON.parse(probe.stdout), video=info.streams.find((stream)=>stream.codec_type==='video'), audio=info.streams.find((stream)=>stream.codec_type==='audio'), duration=Number(info.format.duration);
const errors=[], warnings=[];
if(video?.codec_name!=='h264'||audio?.codec_name!=='aac') errors.push({code:'codec',video:video?.codec_name??null,audio:audio?.codec_name??null});
if(!video?.width||!video?.height) errors.push({code:'missing-video-dimensions'});
if(expectedWidth>0&&expectedHeight>0&&(video?.width!==expectedWidth||video?.height!==expectedHeight)) errors.push({code:'dimension-mismatch',expected:{width:expectedWidth,height:expectedHeight},actual:{width:video?.width??null,height:video?.height??null}});
if(Math.abs(duration-Number(timeline.durationSeconds))>1/fps+.05) errors.push({code:'duration-drift',expected:timeline.durationSeconds,actual:Number(duration.toFixed(3))});
const temporary=mkdtempSync('/private/tmp/rap-mv-qa-'); const samples=[.15,.5,.85]; const edges=[];
try {
  for(const ratio of samples){const raw=spawnSync('ffmpeg',['-v','error','-ss',String(Math.max(0,duration*ratio)),'-i',resolve(input),'-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','pipe:1'],{encoding:null,maxBuffer:64*1024*1024});if(raw.status!==0){warnings.push({code:'frame-probe-failed',ratio});continue;}const bytes=raw.stdout,w=video.width,h=video.height;let dark=0,total=0;for(let y=0;y<h;y+=1)for(let x=0;x<w;x+=1){if(x>2&&x<w-3&&y>2&&y<h-3)continue;const offset=(y*w+x)*3,luma=(bytes[offset]+bytes[offset+1]+bytes[offset+2])/3;dark+=luma<10?1:0;total+=1;}edges.push({ratio,darkEdgeRatio:Number((dark/total).toFixed(4))});}
} finally { rmSync(temporary,{recursive:true,force:true}); }
if(!allowBlackBackground&&edges.some((entry)=>entry.darkEdgeRatio>.94)) errors.push({code:'black-edge-seam',samples:edges});
const report={schemaVersion:1,input:resolve(input),timeline:resolve(timelinePath),duration:Number(duration.toFixed(3)),dimensions:{width:video?.width??null,height:video?.height??null},intentionalBlackBackground:allowBlackBackground,edgeSamples:edges,errors,warnings,passed:errors.length===0};
if(output){mkdirSync(dirname(resolve(output)),{recursive:true});writeFileSync(resolve(output),JSON.stringify(report,null,2));}
const summary={status:report.passed?'passed':'failed',stage:'videoQa',passed:report.passed,errorCodes:errors.map((entry)=>entry.code),warningCount:warnings.length,report:output?resolve(output):null};
if(process.argv.includes('--verbose')) console.log(JSON.stringify(report,null,2));
else console.log(process.argv.includes('--summary-json')?JSON.stringify(summary):`${report.passed?'PASS':'FAIL'} stage=videoQa report=${summary.report??'none'} errors=${summary.errorCodes.join(',')||'none'} warnings=${summary.warningCount}`);
if(errors.length)process.exit(1);
