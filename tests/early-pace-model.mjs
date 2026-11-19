import assert from 'node:assert/strict';
import {join} from 'node:path';
import {readJson,root,sourceSet} from '../simulation/io.mjs';
import {loadModels,resolveConfig} from '../simulation/models.mjs';
import {configFor,assess,searchPhase,protocol} from '../simulation/experiments/early-pace-search.mjs';
const folder=join(root,'simulation','experiments');
const manifest=readJson(join(folder,'early-pace-selected.json')),sources=sourceSet(),w=loadModels(sources);
let total=0;
for(const map of protocol.maps){
  const m=manifest.result[map];
  let count=0,prior=null;
  for(const phase of m.phases){
    const r=readJson(join(folder,'pace-'+map+'-'+phase+'.json'));
    assert.equal(r.map,map);assert.equal(r.phase,phase);
    count+=r.simulations;
    for(const row of r.results){
      const c=resolveConfig(w,configFor(w,map,row.p));
      assert.equal(c.blueprint.length,w.GardenRunRules.catalog.find(p=>p.id===map).blueprint.length);
      if(row.assessment&&row.rows){
        assert.deepEqual(row.assessment,assess(map,row,r.bases.find(b=>b.agent===row.agent)));
        assert.equal(row.rows.length,row.runs);
      }
    }
    if(phase==='density'){
      // Reproduce original search from actual source and fixed seeds.
      assert.deepEqual(searchPhase(sources,map,phase),r);
    }
    if(['validate','sensitivity','revalidate','resensitivity','heartValidate','heartSensitivity'].includes(phase)){
      assert.ok(r.selected.every(p=>prior.selected.some(x=>JSON.stringify(x)===JSON.stringify(p))));
      const eligible=prior.selected.filter(p=>r.results.filter(x=>JSON.stringify(x.p)===JSON.stringify(p)).every(x=>x.assessment.pass));
      assert.deepEqual(r.selected,eligible);
    }
    prior=r;
  }
  assert.equal(count,m.count);
  assert.deepEqual(prior.selected[0],m.p);
  assert.deepEqual(prior.selected,m.alternatives);
  const config=resolveConfig(w,configFor(w,map,m.p));
  assert.deepEqual(config.waves.slice(6),w.GardenRunRules.waves.slice(6).map(x=>[x.start,x.interval,x.cap,x.batch,x.pool]));
  assert.deepEqual(config.enemyUnlocks,w.GardenRunRules.enemyUnlocks);
  assert.equal(config.run.itemInterval,m.p.cooldown);
  assert.deepEqual(config.run.dropWeights.slice(1),[.1,m.p.flower,m.p.item]);
  assert.equal(config.run.initialSlots,w.GardenRunRules.tuning.initialSlots);
  assert.equal(config.run.maxSlots,w.GardenRunRules.tuning.maxSlots);
  total+=count;
  console.log('PACE MODEL',JSON.stringify({map,count,parameters:m.p,waves:config.waves.slice(0,6),dropWeights:config.run.dropWeights}));
}
assert.equal(total,2702);assert.equal(total,manifest.total);
console.log('PASS archived search protocol, validation and 171-run deterministic reproduction');
