import {parseArgs} from 'node:util';
import {Worker} from 'node:worker_threads';
import {availableParallelism} from 'node:os';
import {join} from 'node:path';
import {loadModels,defaults,resolveConfig} from './models.mjs';
import {createEngine} from './engine.mjs';
import {play,profileFor,PROFILES} from './agents.mjs';
import {sourceSet,prepare,readJson,saveJson,hash,root} from './io.mjs';
import {summarize,compact} from './metrics.mjs';

const [command='help',...args]=process.argv.slice(2);
const parsed=parseArgs({args,options:{config:{type:'string'},geometry:{type:'string'},seed:{type:'string',default:'1'},runs:{type:'string',default:'100'},agent:{type:'string',default:'normal'},'agent-config':{type:'string'},dt:{type:'string',default:'0.05'},seconds:{type:'string',default:'1800'},workers:{type:'string',default:'1'},output:{type:'string'},trace:{type:'boolean',default:false},input:{type:'string'},engine:{type:'string',default:'model'},browser:{type:'string',default:'chrome'}},strict:true,allowPositionals:false});
const o=parsed.values;
function int(s,name,min,max){const n=Number(s);if(!/^\d+$/.test(s)||!Number.isSafeInteger(n)||n<min||n>max)throw Error('Invalid '+name);return n;}
function num(s,name,min,max){const n=Number(s);if(!Number.isFinite(n)||n<min||n>max)throw Error('Invalid '+name);return n;}
const profile=()=>profileFor(o.agent,o['agent-config']?readJson(o['agent-config']):{});
const options=()=>({seed:int(o.seed,'seed',0,0xffffffff),dt:num(o.dt,'dt',.001,.1),maxSeconds:num(o.seconds,'seconds',.001,7200)});
const patch=()=>o.config?readJson(o.config):{};
const geometry=()=>o.geometry?readJson(o.geometry):null;
const file=(report,tag)=>saveJson(o.output||join(root,'simulation','results',tag+'-'+Date.now()+'.json'),report);
function manifest(p,prof,opts,engine='model'){
  return {schemaVersion:1,engine,...p.fingerprint,configHash:hash(p.config),config:p.config,geometry:p.geometry,agent:prof,options:opts};
}
async function batch(p,prof,opts,seeds,workers){
  const groups=Array.from({length:Math.min(workers,seeds.length)},()=>[]);
  seeds.forEach((seed,i)=>groups[i%groups.length].push(seed));
  if(groups.length===1)return seeds.map(seed=>compact(play(createEngine(loadModels(p.sources,p.config),{...opts,seed,geometry:p.geometry}),prof)));
  const results=await Promise.all(groups.map(group=>new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('./worker.mjs',import.meta.url),{workerData:{sources:p.sources,config:p.config,geometry:p.geometry,profile:prof,seeds:group,dt:opts.dt,maxSeconds:opts.maxSeconds}});
    worker.once('message',resolve);worker.once('error',reject);worker.once('exit',code=>{if(code!==0)reject(Error('worker exit '+code));});
  })));
  return results.flat().sort((a,b)=>a.seed-b.seed);
}
function seedsFor(opts){const n=int(o.runs,'runs',1,100000);if(opts.seed+n-1>0xffffffff)throw Error('Seed range overflow');return Array.from({length:n},(_,i)=>opts.seed+i);}
async function main(){
  if(command==='help'){
    console.log('LEGACY stage/card simulator only — NOT current flower-economy survival.\n'+
      'For survival: node simulation/survival-preflight.mjs, then node simulation/garden-economy-balance.mjs simulation/experiments/garden-economy-10x10.json --summary.\n'+
      'Historical commands: defaults | agents | run | batch | sweep | replay | capture-geometry\n'+
      'run/batch: --config JSON --geometry JSON --agent NAME --agent-config JSON --seed N --dt SECONDS --seconds N --output FILE\n'+
      'run: --trace --engine model|browser; batch/sweep: --runs N --workers N; sweep/replay: --input FILE\n'+
      'capture-geometry: --output FILE [--browser chrome|chromium]');
    return;
  }
  if(command==='defaults'){
    const d=defaults(loadModels(sourceSet()));if(o.output)console.log(saveJson(o.output,d));else console.log(JSON.stringify(d,null,2));return;
  }
  if(command==='agents'){console.log(JSON.stringify(PROFILES,null,2));return;}
  if(command==='capture-geometry'){
    const {captureGeometry}=await import('./browser.mjs'),p=prepare();
    const measured=await captureGeometry(p,{channel:o.browser});console.log(file(measured,'geometry'));return;
  }
  if(command==='replay'){
    if(!o.input)throw Error('--input is required');
    const saved=readJson(o.input),m=saved.manifest;
    if(m.engine!=='model'||!saved.result?.actions)throw Error('Replay requires a model single-run report');
    const p=prepare(m.config,m.geometry);
    if(m.sourceHash!==p.fingerprint.sourceHash||m.assetHash!==p.fingerprint.assetHash||m.configHash!==hash(p.config))throw Error('Replay fingerprint mismatch');
    const e=createEngine(loadModels(p.sources,p.config),{...m.options,geometry:p.geometry,trace:o.trace});
    const actions=saved.result.actions;let index=0;
    while(!e.finished){
      while(index<actions.length&&actions[index].t<=e.time+1e-6){
        const {t,ok,reason,...action}=actions[index++];
        if(Math.abs(t-e.time)>1e-6)throw Error('Action clock mismatch at '+t);
        if(e.dispatch(action)!==ok)throw Error('Replay action mismatch at '+t);
      }
      e.step();
    }
    const result=e.result();
    if(index!==actions.length||hash(compact(result))!==hash(compact(saved.result)))throw Error('Replay result mismatch');
    console.log(JSON.stringify({replay:'PASS',seed:result.seed,result:result.result,seconds:result.seconds,actions:index}));
    if(o.output)console.log(saveJson(o.output,{manifest:m,result}));return;
  }
  const opts=options(),prof=profile();
  if(command==='run'){
    const p=prepare(patch(),geometry()),started=performance.now();
    let result;
    if(o.engine==='model')result=play(createEngine(loadModels(p.sources,p.config),{...opts,geometry:p.geometry,trace:o.trace}),prof);
    else if(o.engine==='browser'){
      const {runBrowser}=await import('./browser.mjs');result=await runBrowser(p,prof,{...opts,trace:o.trace,channel:o.browser});
    }else throw Error('Unknown engine '+o.engine);
    const wall=(performance.now()-started)/1000,path=file({manifest:manifest(p,prof,opts,o.engine),wallSeconds:wall,result},'run');
    console.log(JSON.stringify({file:path,engine:o.engine,seed:result.seed,result:result.result,seconds:result.seconds,completed:result.completed,kills:result.kills,wallSeconds:wall,acceleration:wall?result.seconds/wall:null}));return;
  }
  if(!['batch','sweep'].includes(command))throw Error('Unknown command '+command);
  if(o.engine!=='model')throw Error('Batch/sweep use the model engine; use run --engine browser for reference checks');
  const seeds=seedsFor(opts),workers=int(o.workers,'workers',1,Math.min(64,availableParallelism()*2)),started=performance.now();
  if(command==='batch'){
    const p=prepare(patch(),geometry()),rows=await batch(p,prof,opts,seeds,workers),summary=summarize(rows);
    const wall=(performance.now()-started)/1000,path=file({manifest:manifest(p,prof,{...opts,seeds}),wallSeconds:wall,summary,rows},'batch');
    console.log(JSON.stringify({file:path,wallSeconds:wall,...summary},null,2));return;
  }
  if(!o.input)throw Error('sweep requires --input experiment JSON');
  const experiment=readJson(o.input);
  if(!Array.isArray(experiment.variants)||!experiment.variants.length||experiment.variants.length>100)throw Error('Expected 1..100 experiment variants');
  const seen=new Set(),variants=[];
  for(const variant of experiment.variants){
    if(typeof variant.name!=='string'||!variant.name||seen.has(variant.name))throw Error('Unique variant name required');
    seen.add(variant.name);
    const p=prepare(variant.config??{},geometry()),policy=profileFor(variant.agent??o.agent,variant.agentConfig??{});
    const rows=await batch(p,policy,opts,seeds,workers);
    variants.push({name:variant.name,manifest:manifest(p,policy,{...opts,seeds}),summary:summarize(rows),rows});
  }
  const base=variants[0];
  const comparison=variants.slice(1).map(v=>({name:v.name,baseline:base.name,winRateDelta:v.summary.winRate-base.summary.winRate,
    meanProgressDelta:v.summary.metrics.progress.mean-base.summary.metrics.progress.mean,pairedWinsChanged:v.rows.reduce((a,r,i)=>a+((r.result==='victory')-(base.rows[i].result==='victory')),0)}));
  const wall=(performance.now()-started)/1000,path=file({schemaVersion:1,wallSeconds:wall,variants,comparison},'sweep');
  console.log(JSON.stringify({file:path,wallSeconds:wall,variants:variants.map(v=>({name:v.name,summary:v.summary})),comparison},null,2));
}
main().catch(e=>{console.error(e.stack||String(e));process.exitCode=1;});
