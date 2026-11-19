import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {root,sourceSet} from '../simulation/io.mjs';
import {loadModels,resolveConfig} from '../simulation/models.mjs';
const code=readFileSync(join(root,'src','run-rules.js'),'utf8');
const create=(config,active=true)=>{
  const w=config===undefined?{}:{GardenSimulationConfig:config};
  new Function('window','document',code)(w,{documentElement:{dataset:{playable:String(active)}}});
  return w.GardenRunRules;
};
const baseline=create({}),R=create();
const expected={
  classic:{drops:[.72,.10,.10,.08],cooldown:25,waves:[[1.5,5,1],[1.35,7,1],[1.2,9,1],[1.2,10,1],[1.125,11,1],[1.05,12,1]]},
  cross:{drops:[.72,.10,.10,.08],cooldown:15,waves:[[2.5,11,2],[2.25,13,2],[2,15,2],[2,16,2],[1.875,17,2],[1.2,18,2]]},
  heart:{drops:[.75,.10,.09,.06],cooldown:30,waves:[[2,8,2],[1.8,10,2],[1.6,12,2],[1.6,13,2],[1.5,14,2],[1.2,15,2]]}
};
const waveValues=r=>r.waves.slice(0,6).map(x=>[x.interval,x.cap,x.batch]);
function check(map){
  const e=expected[map],base=baseline.tuning;
  assert.equal(R.selectedBlueprintId,map);
  assert.deepEqual(R.tuning.dropWeights,e?.drops??base.dropWeights);
  assert.equal(R.tuning.itemInterval,e?.cooldown??base.itemInterval);
  assert.deepEqual(waveValues(R),e?.waves??waveValues(baseline));
  assert.deepEqual(R.waves.slice(6),baseline.waves.slice(6));
  assert.deepEqual(R.waves.map(w=>w.pool),baseline.waves.map(w=>w.pool));
  assert.deepEqual({...R.tuning,dropWeights:base.dropWeights,itemInterval:base.itemInterval},base);
  const run=R.create();
  assert.equal(run.rewardDrop(()=>.99999),'item');
  run.tick(R.tuning.itemInterval-.1);assert.equal(run.rewardDrop(()=>.99999),'gem');
  run.tick(.1);assert.equal(run.rewardDrop(()=>.99999),'item');
  const w=loadModels(sourceSet());
  const cfg=resolveConfig(w,{initial:R.initial,blueprint:R.blueprint,run:{dropWeights:R.tuning.dropWeights,itemInterval:R.tuning.itemInterval},waves:R.waves.map(x=>[x.start,x.interval,x.cap,x.batch,x.pool])});
  assert.equal(cfg.blueprint.length,R.blueprint.length);
}
check('classic');for(const map of ['cross','heart','flower','butterfly','large-heart','classic']){assert.equal(R.selectBlueprint(map),true);check(map);}
assert.equal(R.selectBlueprint('no-such-map'),false);check('classic');
assert.equal(baseline.selectBlueprint('heart'),true);assert.deepEqual(baseline.tuning.dropWeights,[.69,.1,.18,.03]);assert.equal(baseline.spawnInterval(0),3);
const explicit=create({run:{dropWeights:[.6,.1,.2,.1],itemInterval:12}});
assert.equal(explicit.selectBlueprint('cross'),true);assert.deepEqual(explicit.tuning.dropWeights,[.6,.1,.2,.1]);assert.equal(explicit.tuning.itemInterval,12);assert.equal(explicit.spawnInterval(0),3);
const lab=create(undefined,false);assert.equal(lab.spawnInterval(0),3);assert.deepEqual(lab.tuning.dropWeights,[.69,.1,.18,.03]);
console.log('PASS early pace devel trial rules, transitions, cooldown and simulation isolation');
