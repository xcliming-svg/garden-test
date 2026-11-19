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
  classic:{drops:[.795,.10,.065,.04],cooldown:35,waves:[[1.25,8,2],[1.125,10,2],[1,12,2],[1,13,2],[.9375,14,2],[.875,15,2]]},
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
  if(map==='classic'){
    assert.deepEqual(R.itemSupply,{cap:3});
    for(const t of [0,90,180,300,10000])assert.deepEqual(R.itemPool(t),['rock','boomerang']);
    const events=[],fresh=R.create((type,data)=>events.push({type,...data})),items=[];
    for(let i=0;i<6;i++){
      const kind=fresh.rewardDrop(()=>.99999);
      if(kind==='item')items.push(fresh.pickItem(()=>.99999));
      else assert.equal(kind,'gem');
      fresh.tick(35);
    }
    assert.deepEqual(items,['boomerang','boomerang','boomerang']);
    assert.equal(events.filter(e=>e.reason==='stage_item_cap').length,3);
    assert.equal(fresh.rewardDrop(()=>.85),'heart');
    assert.equal(fresh.rewardDrop(()=>.92),'flower');
    const reset=R.create();assert.equal(reset.rewardDrop(()=>.99999),'item');assert.equal(reset.pickItem(()=>.99999),'boomerang');
    // Every three-card ordering is reachable, with replacement.
    for(let mask=0;mask<8;mask++){
      const r=R.create(),actual=[],expected=[];
      for(let i=0;i<3;i++){
        const bit=(mask>>i)&1;expected.push(bit?'boomerang':'rock');
        assert.equal(r.rewardDrop(()=>.99999),'item');actual.push(r.pickItem(()=>bit?.75:.25));r.tick(35);
      }
      assert.deepEqual(actual,expected);assert.equal(r.rewardDrop(()=>.99999),'gem');
    }
  }else{
    assert.equal(R.itemSupply,null);
    assert.deepEqual(R.itemUnlocks,baseline.itemUnlocks);
    assert.ok(R.itemPool(90).includes('water-fairy'));
    const fresh=R.create();
    for(let i=0;i<5;i++){assert.equal(fresh.rewardDrop(()=>.99999),'item');fresh.tick(R.tuning.itemInterval);}
  }
  const w=loadModels(sourceSet());
  const cfg=resolveConfig(w,{initial:R.initial,blueprint:R.blueprint,run:{dropWeights:R.tuning.dropWeights,itemInterval:R.tuning.itemInterval},waves:R.waves.map(x=>[x.start,x.interval,x.cap,x.batch,x.pool])});
  assert.equal(cfg.blueprint.length,R.blueprint.length);
}
check('classic');for(const map of ['cross','heart','flower','butterfly','large-heart','classic']){assert.equal(R.selectBlueprint(map),true);check(map);}
assert.equal(R.selectBlueprint('no-such-map'),false);check('classic');
assert.equal(baseline.selectBlueprint('heart'),true);assert.deepEqual(baseline.tuning.dropWeights,[.69,.1,.18,.03]);assert.equal(baseline.spawnInterval(0),3);assert.equal(baseline.itemSupply,null);
const explicit=create({run:{dropWeights:[.6,.1,.2,.1],itemInterval:12}});
assert.equal(explicit.selectBlueprint('cross'),true);assert.deepEqual(explicit.tuning.dropWeights,[.6,.1,.2,.1]);assert.equal(explicit.tuning.itemInterval,12);assert.equal(explicit.spawnInterval(0),3);
const lab=create(undefined,false);assert.equal(lab.spawnInterval(0),3);assert.deepEqual(lab.tuning.dropWeights,[.69,.1,.18,.03]);
console.log('PASS early pace devel trial rules, transitions, cooldown and simulation isolation');
