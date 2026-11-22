import assert from 'node:assert/strict';
import {readSurvivalSources,makeHeadlessRun} from '../simulation/survival-runtime.mjs';
import {captureSurvivalGeometry,runSurvivalReference,compareSurvival} from '../simulation/survival-browser.mjs';
const packageData=readSurvivalSources(),cfg={seed:42,seconds:60,dt:.05,policy:'idle'};
const geometry=await captureSurvivalGeometry({seed:cfg.seed},packageData);
assert.equal(Object.keys(geometry.enemies).length,12,'Measured every live enemy');
assert.equal(Object.keys(geometry.weapons).length,11,'Measured every weapon and effect');
for(const policy of ['idle','focused']){
  const opts={...cfg,policy};
  const model=makeHeadlessRun(opts,geometry,packageData).runTo(opts.seconds,[0,5,10,30,60]);
  const browser=await runSurvivalReference(opts,[0,5,10,30,60]);
  const result=compareSurvival(model,browser);
  assert.equal(result.status,'PASS',JSON.stringify(result.differences.slice(0,15),null,2));
  console.log('PASS Phaser current-survival parity',JSON.stringify({
    commit:process.env.GITHUB_SHA||null,sourceHash:model.sourceHash,assetHash:model.assetHash,
    seed:cfg.seed,dt:cfg.dt,seconds:cfg.seconds,policy,checkpoints:model.timeline.map(s=>s.time),
    final:model.final,assumptions:model.assumptions,limitations:model.limitations}));
}
