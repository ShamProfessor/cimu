#!/usr/bin/env node
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

function option(name){const index=process.argv.indexOf(`--${name}`);return index===-1?null:process.argv[index+1];}
const jobPath=option('job'), outputRoot=option('out');
if(!jobPath||!outputRoot)throw new Error('Usage: render-job.mjs --job job.json --out output-directory');
const job=JSON.parse(readFileSync(resolve(jobPath),'utf8'));
for(const key of ['audio','timeline'])if(!job[key])throw new Error(`Job requires ${key}.`);
const root=resolve(outputRoot), scriptRoot=resolve(new URL('.',import.meta.url).pathname), run=(script,args)=>{console.log(`Run ${script}`);const result=spawnSync('node',[resolve(scriptRoot,script),...args],{stdio:'inherit',detached:true});if(result.status!==0)throw new Error(`${script} failed (${result.status??result.signal??'unknown'})`);console.log(`Passed ${script}`);};
mkdirSync(root,{recursive:true});
const timeline=resolve(job.timeline), audio=resolve(job.audio), duration=Number(job.durationSeconds??JSON.parse(readFileSync(timeline,'utf8')).durationSeconds), start=Number(job.sourceStartSeconds??JSON.parse(readFileSync(timeline,'utf8')).sourceStartSeconds??0), fps=Number(job.fps??30);
const width=Number(job.width??1920), height=Number(job.height??1080);
const videoName=width*9===height*16?'master-16x9.mp4':width*16===height*9?'master-9x16.mp4':`master-${width}x${height}.mp4`;
const audioProfile=resolve(root,'audio.json'), songProfile=resolve(root,'song-profile.json'), direction=resolve(root,'direction.json'), stylePlan=resolve(root,'style-plan.json'), stylePlanValidation=resolve(root,'style-plan-validation.json'), timelineValidation=resolve(root,'timeline-validation.json'), video=resolve(root,videoName), videoValidation=resolve(root,'delivery-validation.json');
run('validate-lyric-timeline.mjs',['--timeline',timeline,'--out',timelineValidation]);
run('extract-audio-profile.mjs',['--input',audio,'--start',String(start),'--duration',String(duration),'--fps',String(fps),'--out',audioProfile]);
const profileArgs=['--timeline',timeline,'--audio-data',audioProfile,'--out',songProfile]; if(job.genre)profileArgs.push('--genre',job.genre); if(job.visualProfile)profileArgs.push('--visual-profile',job.visualProfile); run('analyze-song-profile.mjs',profileArgs);
run('propose-lyric-direction.mjs',['--timeline',timeline,'--song-profile',songProfile,'--regroup','--out',direction]);
run('resolve-style-plan.mjs',['--timeline',direction,'--song-profile',songProfile,'--out',stylePlan]);
run('validate-style-plan.mjs',['--style-plan',stylePlan,'--timeline',direction,'--out',stylePlanValidation]);
run('validate-lyric-timeline.mjs',['--timeline',direction,'--out',timelineValidation]);
run('render-browser-sample.mjs',['--timeline',direction,'--style-plan',stylePlan,'--audio-data',audioProfile,'--audio',audio,'--start',String(start),'--from','0','--duration',String(duration),'--timeline-duration',String(duration),'--width',String(job.width??1920),'--height',String(job.height??1080),'--fps',String(fps),'--out',video]);
run('validate-rendered-mv.mjs',['--input',video,'--timeline',direction,'--fps',String(fps),'--width',String(width),'--height',String(height),'--out',videoValidation]);
writeFileSync(resolve(root,'delivery-manifest.json'),JSON.stringify({schemaVersion:1,job:resolve(jobPath),audio,timeline,artifacts:{audioProfile,songProfile,direction,stylePlan,stylePlanValidation,timelineValidation,video,videoValidation},status:'passed'},null,2));
console.log(`Delivery package → ${root}`);
