import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readSurvivalSources,makeHeadlessRun} from '../simulation/survival-runtime.mjs';
import {captureSurvivalGeometry,runSurvivalReference,compareSurvival} from '../simulation/survival-browser.mjs';
const sources=readSurvivalSources(),commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const geometry=await captureSurvivalGeometry({seed:42},sources);
for(const [seed,policy] of [[42,'focused'],[17,'casual']]){
  const opts={seed,seconds:600,dt:.05,policy,commit};
  const headless=makeHeadlessRun(opts,geometry,sources).runTo(600,[0,60,180,300,600]);
  const browser=await runSurvivalReference(opts,headless.timeline.map(x=>x.time));
  const cmp=compareSurvival(headless,browser);
  assert.equal(cmp.status,'PASS',JSON.stringify(cmp.differences.slice(0,20),null,2));
  assert.ok(headless.actions.some(x=>x.kind==='expand'&&x.ok),'Actual expansion is exercised');
  assert.ok(headless.actions.some(x=>x.kind==='buy'&&x.ok),'Actual shop purchase is exercised');
  assert.ok(headless.actions.some(x=>x.kind==='upgrade'&&x.ok),'Actual upgrades are exercised');
  assert.ok(headless.final.equipped.length>1,'Multiple production weapons must be active');
  assert.ok(Object.keys(headless.final.enemiesById).length>1,'Species unlocks must advance');
  console.log('PASS long survival parity',JSON.stringify({
    sourceCommit:commit,sourceHash:headless.sourceHash,assetHash:headless.assetHash,
    seed,policy,dt:opts.dt,seconds:opts.seconds,checkpoints:headless.timeline.map(s=>s.time),
    actions:headless.actions.length,side:headless.final.side,equipped:headless.final.equipped,
    killed:headless.final.killed,waterCollected:headless.final.waterCollected,
    limitations:headless.limitations,assumptions:headless.assumptions}));
}
