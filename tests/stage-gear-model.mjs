import assert from 'node:assert/strict';
import {join} from 'node:path';
import {readdirSync} from 'node:fs';
import {prepare,readJson,root} from '../simulation/io.mjs';
import {stageCap} from '../simulation/experiments/stage-gear-search.mjs';
const folder=join(root,'simulation','experiments');
const read=name=>readJson(join(folder,'stage-gear-'+name+'.json'));
let count=0;
for(const name of readdirSync(folder).filter(n=>n.startsWith('stage-gear-')&&n.endsWith('.json'))){
  const r=readJson(join(folder,name));
  if(Number.isInteger(r.simulations))count+=r.simulations;
}
assert.equal(count,1001);
const candidate=read('cap-candidate')[0];
assert.deepEqual(candidate,{name:'m1',interval:1.25,cap:8,batch:2,rate:.04,cooldown:35,flower:.065});
const reports=['cap-validate-beginner','cap-validate-normal','cap-validate-expert','cap-fine'].map(read);
let wins=0,third=0;
for(const r of reports){
  const x=r.results[0];
  assert.deepEqual(x.p,candidate);assert.ok(x.assessment.pass&&x.strictOrder&&x.capRespected);
  assert.equal(x.itemCap,3);assert.equal(x.runs,16);wins+=x.wins;third+=x.thirdSeen;
  for(const row of x.rows)assert.deepEqual(row.itemNames,['rock','rock','boomerang'].slice(0,row.items));
}
assert.equal(wins,64);assert.equal(third,54);
const {sources}=prepare(),geometry=read('geometry');
const replay=stageCap(sources,geometry,candidate,'normal','capValidate');
assert.deepEqual(replay,read('cap-validate-normal'),'fixed-seed Node reproduction');
console.log('PASS stage gear archive, 1001 simulations, 64 final victories, capped ordered supply and 32-run replay');
