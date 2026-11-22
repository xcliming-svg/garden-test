// Current-survival batch runner. This never invokes the legacy stage/card CLI.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readSurvivalSources,makeHeadlessRun,PROFILES,validateOptions} from './survival-runtime.mjs';
import {saveJson} from './io.mjs';

const checksum=s=>createHash('sha256').update(s).digest('hex');
function parse(argv){
  if(!argv[0]||argv[0].startsWith('--'))throw Error('Usage: node simulation/survival-batch.mjs <experiment.json> [--geometry path] [--check] [--summary] [--output path]');
  const out={file:argv[0]};
  for(let i=1;i<argv.length;i++){
    const k=argv[i];
    if(k==='--check'||k==='--summary')out[k.slice(2)]=true;
    else if(k==='--geometry'||k==='--output'){
      if(!argv[i+1]||argv[i+1].startsWith('--'))throw Error('Missing path after '+k);
      out[k.slice(2)]=argv[++i];
    }else throw Error('Unknown option '+k);
  }
  if(!out.check&&!out.summary)throw Error('Specify --check, --summary or both');
  return out;
}
function experiment(raw){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Experiment must be object');
  for(const key of Object.keys(raw))
    if(!['schemaVersion','id','durationSeconds','dt','seeds','policies','snapshots','assumptions'].includes(key))
      throw Error('Unknown experiment field '+key);
  if(raw.schemaVersion!==1)throw Error('Unsupported experiment schema');
  if(typeof raw.id!=='string'||!raw.id.trim())throw Error('Experiment requires id');
  if(!Array.isArray(raw.seeds)||!raw.seeds.length||raw.seeds.length>100||new Set(raw.seeds).size!==raw.seeds.length)
    throw Error('seeds must be unique nonempty list of <=100');
  if(!Array.isArray(raw.policies)||!raw.policies.length||new Set(raw.policies).size!==raw.policies.length)
    throw Error('policies must be unique nonempty list');
  if(!Array.isArray(raw.snapshots)||new Set(raw.snapshots).size!==raw.snapshots.length||
    raw.snapshots.some(n=>!Number.isFinite(n)||n<0||n>raw.durationSeconds))
    throw Error('snapshots must be unique times within duration');
  if(!Array.isArray(raw.assumptions)||raw.assumptions.some(v=>typeof v!=='string'))
    throw Error('assumptions must be string array');
  for(const seed of raw.seeds)for(const policy of raw.policies)validateOptions({
    seed,policy,seconds:raw.durationSeconds,dt:raw.dt});
  if(Math.abs(Math.round(raw.durationSeconds/raw.dt)*raw.dt-raw.durationSeconds)>1e-8)
    throw Error('durationSeconds must be divisible by dt');
  if(raw.snapshots.some(t=>Math.abs(Math.round(t/raw.dt)*raw.dt-t)>1e-8))
    throw Error('snapshot time must align with dt');
  return raw;
}
const mean=(rows,key)=>rows.reduce((a,v)=>a+v.final[key],0)/rows.length;
function summarize(rows,policies){
  return Object.fromEntries(policies.map(policy=>{
    const group=rows.filter(r=>r.policy===policy);
    return [policy,{count:group.length,timeLimitReached:group.filter(r=>r.outcome==='time_limit').length,
      defeated:group.filter(r=>r.outcome==='defeat').length,
      averageSecondsPlayed:mean(group,'time'),averageKills:mean(group,'killed'),
      averageShots:mean(group,'shots'),averageHits:mean(group,'hits'),
      averageWaterCollected:mean(group,'waterCollected'),
      averageWaterUsed:group.reduce((n,r)=>n+(r.final.events.garden_water_use||0),0)/group.length,
      averageHarvested:mean(group,'harvested'),averageSide:mean(group,'side'),
      averageGardenHp:mean(group,'gardenHp'),
      warning:'Deterministic bot policy, not empirical player outcome or accepted balance target'}];
  }));
}
try{
  const args=parse(process.argv.slice(2)),raw=readFileSync(args.file,'utf8'),cfg=experiment(JSON.parse(raw));
  const sources=readSurvivalSources(),geometry=args.geometry?JSON.parse(readFileSync(args.geometry,'utf8')):null;
  const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
  const changed=execFileSync('git',['status','--porcelain','--untracked-files=no'],{encoding:'utf8'}).trim();
  const metadata={schemaVersion:1,mode:'current-survival-batch',
    experiment:cfg.id,experimentHash:checksum(raw),sourceCommit:commit,
    workingTreeModified:!!changed,sourceHash:sources.sourceHash,assetHash:sources.assetHash,
    nodeVersion:process.version,seedList:cfg.seeds,policies:cfg.policies,
    seconds:cfg.durationSeconds,dt:cfg.dt,geometry:geometry?'browser-measured':'unmeasured-approximation',
    assumptions:[...cfg.assumptions,'UI policy is scripted, not measured human behavior',
      'Water fairy is disabled; effect/caps are not assigned'],
    limitations:['No long-run browser parity is implied by model determinism',
      'Synthetic-policy outcomes cannot establish final game balance']};
  function run(seed,policy){
    return makeHeadlessRun({seed,seconds:cfg.durationSeconds,dt:cfg.dt,policy,commit},geometry,sources)
      .runTo(cfg.durationSeconds,cfg.snapshots);
  }
  const results={metadata};
  if(args.check){
    const seed=cfg.seeds[0],policy=cfg.policies[0];
    const a=run(seed,policy),b=run(seed,policy);
    if(JSON.stringify([a.outcome,a.final,a.timeline,a.actions])!==
      JSON.stringify([b.outcome,b.final,b.timeline,b.actions]))
      throw Error('CHECK FAIL: seeded survival replay diverged');
    results.check={status:'PASS',seed,policy,
      measuredGeometry:!!geometry,repeated:2,sourceHash:sources.sourceHash};
  }
  if(args.summary){
    const rows=[];
    for(const seed of cfg.seeds)for(const policy of cfg.policies){
      const r=run(seed,policy);
      rows.push({seed,policy,outcome:r.outcome,final:r.final,timeline:r.timeline,actions:r.actions});
    }
    results.summary=summarize(rows,cfg.policies);
    results.runs=rows;
  }
  if(args.output)console.log('Saved '+saveJson(args.output,results));
  else console.log(JSON.stringify(results,null,2));
}catch(e){console.error(e.stack||String(e));process.exitCode=1;}
