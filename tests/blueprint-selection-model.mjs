import assert from 'node:assert/strict';
import {sourceSet,prepare} from '../simulation/io.mjs';
import {loadModels,resolveConfig} from '../simulation/models.mjs';
import {createEngine} from '../simulation/engine.mjs';
import {play,profileFor} from '../simulation/agents.mjs';
import {experimentCases,runStudy,concise} from '../simulation/experiments/blueprint-baseline.mjs';
const sources=sourceSet(),w=loadModels(sources),R=w.GardenRunRules,defaultBlueprint=R.blueprint;
assert.deepEqual(R.catalog.map(p=>p.blueprint.length),[16,18,27,32,33,56]);
for(const p of R.catalog){
  const config=resolveConfig(w,{initial:p.initial,blueprint:p.blueprint});
  assert.equal(config.initial.length,4);assert.equal(config.blueprint.length,p.blueprint.length);
  assert.equal(R.selectBlueprint(p.id),true);
  assert.equal(R.selectedBlueprintId,p.id);
  assert.equal(R.completion(new Map(R.initial.map(([id,name])=>[id,{name,stage:3}]))),Math.floor(400/p.blueprint.length));
}
assert.equal(R.selectBlueprint('invalid'),false);R.selectBlueprint('classic');
assert.deepEqual(R.blueprint,defaultBlueprint);
assert.throws(()=>resolveConfig(w,{flowerWeights:{rose:0}}),/Invalid config/);
assert.throws(()=>resolveConfig(w,{flowerWeights:{unknown:1}}),/Invalid config/);
const weighted=resolveConfig(w,{run:{neededFlowerBias:0},flowerWeights:{rose:1000}});
const W=loadModels(sources,weighted).GardenRunRules;
assert.equal(W.chooseFlower(new Map(),()=>.5),'rose');
assert.equal(W.selectBlueprint('heart'),false);
const cases=experimentCases(w);for(const c of cases)resolveConfig(w,c.patch);
const stages=cases.filter(c=>c.group==='stages');
assert.equal(stages.length,6);
assert.deepEqual(stages.map(c=>c.patch.flowerPool.length),[1,2,3,4,6,6]);
assert.deepEqual(stages.map(c=>c.patch.run.maxSlots),[3,5,6,8,10,10]);
assert.deepEqual(stages.map(c=>c.research.levelCap),[1,1,2,2,3,3]);
assert.equal(stages.at(-1).patch.blueprint.length,88);
for(const c of stages){
  const cfg=resolveConfig(w,c.patch),m=loadModels(sources,cfg),rr=m.GardenRunRules;
  for(let k=0;k<50;k++)assert.ok(cfg.flowerPool.includes(rr.chooseFlower(new Map(),()=>k/50)));
  const engine=createEngine(m,{seed:42,dt:.05,maxSeconds:45,research:c.research});
  const outcome=play(engine,profileFor('normal'));
  assert.ok(outcome.gear.length===cfg.run.maxSlots);
  assert.ok(outcome.timeline.every(t=>t.gearLevels.every(l=>l===null||l<=c.research.levelCap)));
}
assert.throws(()=>resolveConfig(w,{flowerPool:['daisy']}),/Invalid config/);
assert.throws(()=>resolveConfig(w,{flowerPool:['daisy','daisy']}),/Invalid config/);
const sample=runStudy(sources,{group:'maps',caseId:'heart-normal',runs:2,seed:42,maxSeconds:600});
const repeat=runStudy(sources,{group:'maps',caseId:'heart-normal',runs:2,seed:42,maxSeconds:600});
assert.deepEqual(sample,repeat);assert.equal(sample.cases[0].summary.wins,2);
const fixture=cases.find(c=>c.id==='10-rock'),f=resolveConfig(w,fixture.patch);
const e=createEngine(loadModels(sources,f),{seed:1,dt:.05,maxSeconds:1,research:fixture.research});
assert.equal(e.observe().gear.filter(g=>g?.id==='rock').length,10);
assert.equal(play(e,profileFor('idle')).research.fixedLoadout.length,10);
console.log('PASS blueprint model',JSON.stringify(concise(sample)));
