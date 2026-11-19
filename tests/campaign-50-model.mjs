import assert from 'node:assert/strict';
import {join} from 'node:path';
import {readFileSync} from 'node:fs';
import {prepare,root,readJson} from '../simulation/io.mjs';
import {dataset,makeWorld,researchSources,stageGear,policies,runStage} from '../simulation/experiments/campaign-50.mjs';
const folder=join(root,'simulation','experiments'),p=prepare(),sources=researchSources(p.sources,readFileSync(join(folder,'campaign-formation-source.js'),'utf8'));
const data=dataset();assert.deepEqual(data,readJson(join(folder,'campaign-50-dataset.json')));
for(const schedule of Object.values(data.schedules)){
  assert.equal(schedule.length,33);
  for(const c of schedule)if(c.level>1)assert.ok(schedule.find(x=>x.id===c.id&&x.level===c.level-1).stage<c.stage);
  assert.ok(schedule.find(c=>c.id==='water-fairy').stage>=26);
}
for(const stage of data.stages)for(const policy of policies){
  const {env,model,gear}=makeWorld(sources,stage.stage,policy);
  assert.equal(env.count,env.blueprint.length);
  assert.equal(env.initial.length,4);
  assert.equal(model.GardenRunRules.itemPool(10000).length,new Set(gear.pool.map(c=>c.id)).size);
  for(const c of gear.pool)assert.ok(c.stage<=stage.stage);
  for(const [at,pattern,id,count] of env.formations){assert.ok(env.eligible.includes(id));assert.ok(count<=env.patch.waves.findLast(w=>w[0]<=at)[2]);}
}
const geometry=readJson(join(folder,'stage-gear-geometry.json'));
const trial=runStage(sources,geometry,3,'counter-first',{runs:1});
assert.equal(trial.rows[0].result,'victory');assert.equal(trial.rows[0].seconds,136.2);
console.log('PASS 150 campaign config combinations, 99 unlock rows, deterministic smoke');
