import assert from 'node:assert/strict';
import {join} from 'node:path';
import {readFileSync} from 'node:fs';
import {prepare,root,readJson} from '../simulation/io.mjs';
import {createEngine} from '../simulation/engine.mjs';
import {researchSources,makeWorld,startOverrides,startGear,startProtocol,runStage} from '../simulation/experiments/campaign-50.mjs';
const folder=join(root,'simulation','experiments'),p=prepare(),sources=researchSources(p.sources,readFileSync(join(folder,'campaign-formation-source.js'),'utf8'));
for(let stage=1;stage<=50;stage++)for(const variant of startProtocol.variants){
  const {model,env,gear}=makeWorld(sources,stage,'counter-first','campaign-drop',startOverrides(stage,variant),stage>=20?'gradual':null);
  const cards=startGear(model,gear,stage,variant,29501);
  const engine=createEngine(model,{seed:29501,maxSeconds:1,research:{progression:'campaign-drop',campaign:{...gear,itemCap:env.itemCap,startingGear:cards}}});
  const obs=engine.observe();
  assert.equal(obs.slotCount,model.GardenRunRules.tuning.initialSlots);
  assert.equal(obs.gear.filter(Boolean).length,cards.length);
  assert.deepEqual(obs.gear.filter(Boolean).map(({id,level})=>({id,level})),cards);
  assert.ok(cards.every(c=>c.level<=gear.levelCaps[c.id]));
  assert.ok(obs.gear.some(c=>c?.stats.dps>0));
  assert.equal(obs.completed,4);
}
const geometry=readJson(join(folder,'stage-gear-geometry.json'));
const result=runStage(sources,geometry,30,'counter-first',{seed:29501,runs:1,start:'half',variant:'gradual'});
assert.ok(result.rows[0].startingGear.length>1);
console.log('PASS 300 startup configurations and campaign starting inventory smoke');
