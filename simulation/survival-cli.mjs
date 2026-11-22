import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {readSurvivalSources,makeHeadlessRun,validateOptions} from './survival-runtime.mjs';
import {captureSurvivalGeometry,runSurvivalReference,compareSurvival} from './survival-browser.mjs';
import {saveJson} from './io.mjs';

function argsOf(argv){
  const allowed=new Set(['seed','seconds','dt','policy','geometry','output','channel','parity','capture']);
  const a={};
  for(let i=0;i<argv.length;i++){
    const k=argv[i].replace(/^--/,'');
    if(!argv[i].startsWith('--')||!allowed.has(k))throw Error('Unknown argument '+argv[i]);
    if(k==='parity'||k==='capture')a[k]=true;
    else {if(!argv[i+1]||argv[i+1].startsWith('--'))throw Error('Missing argument '+k);a[k]=argv[++i];}
  }
  return a;
}
try{
  const args=argsOf(process.argv.slice(2)),options=validateOptions({
    seed:args.seed===undefined?42:Number(args.seed),
    seconds:args.seconds===undefined?60:Number(args.seconds),
    dt:args.dt===undefined?0.05:Number(args.dt),
    policy:args.policy||'idle'
  });
  const packageData=readSurvivalSources();
  const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
  let geometry=args.geometry?JSON.parse(readFileSync(args.geometry,'utf8')):null;
  if(args.parity||args.capture)geometry=await captureSurvivalGeometry({seed:options.seed,channel:args.channel||'chrome'},packageData);
  if(args.capture&&!args.parity){
    if(!args.output)throw Error('--capture requires --output');
    console.log(saveJson(args.output,geometry));process.exit(0);
  }
  const headless=makeHeadlessRun({...options,commit},geometry,packageData).runTo();
  let report={...headless};
  if(args.parity){
    const browser=await runSurvivalReference({...options,channel:args.channel||'chrome'},headless.timeline.map(s=>s.time));
    const parity=compareSurvival(headless,browser);
    report={schemaVersion:1,mode:'survival-parity',sourceHash:packageData.sourceHash,
      assetHash:packageData.assetHash,sourceCommit:commit,seed:options.seed,dt:options.dt,
      seconds:options.seconds,policy:options.policy,geometry:'browser-measured',
      assumptions:headless.assumptions,limitations:headless.limitations,
      parity,headless,browser};
  }
  if(args.output)console.log('Saved '+saveJson(args.output,report));
  else console.log(JSON.stringify(args.parity?{
    sourceCommit:commit,sourceHash:report.sourceHash,assetHash:report.assetHash,
    seed:options.seed,dt:options.dt,seconds:options.seconds,policy:options.policy,
    geometry:report.geometry,parity:report.parity,headless:headless.final,
    browser:report.browser?.final,limits:headless.limitations
  }:report,null,2));
  if(args.parity&&report.parity.status!=='PASS')process.exitCode=1;
}catch(e){console.error(e.stack||String(e));process.exitCode=1;}
