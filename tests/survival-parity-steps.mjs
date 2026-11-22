import assert from 'node:assert/strict';
import {readSurvivalSources,makeHeadlessRun} from '../simulation/survival-runtime.mjs';
import {captureSurvivalGeometry,runSurvivalReference,compareSurvival} from '../simulation/survival-browser.mjs';
const p=readSurvivalSources(),cfg={seed:42,seconds:35,dt:.05,policy:'idle'};
const t=Array.from({length:701},(_,i)=>Number((i*.05).toFixed(6)));
const geometry=await captureSurvivalGeometry({seed:42},p);
const model=makeHeadlessRun(cfg,geometry,p).runTo(cfg.seconds,t);
const browser=await runSurvivalReference(cfg,t);
const result=compareSurvival(model,browser);
assert.equal(result.status,'PASS',JSON.stringify(result.differences.slice(0,20),null,2));
console.log('PASS 701 consecutive Phaser survival checkpoints',JSON.stringify({
  seed:cfg.seed,dt:cfg.dt,seconds:cfg.seconds,sourceHash:model.sourceHash,
  sourceCommit:model.sourceCommit,checked:model.timeline.length,final:model.final}));
