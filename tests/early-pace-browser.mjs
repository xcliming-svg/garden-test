// Independent verification. These gates are fixed before executing this reference study.
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {prepare,readJson,root,saveJson} from '../simulation/io.mjs';
import {captureGeometry,runBrowser} from '../simulation/browser.mjs';
import {loadModels} from '../simulation/models.mjs';
import {profileFor} from '../simulation/agents.mjs';
import {distribution} from '../simulation/metrics.mjs';
import {configFor,evaluate,assess,protocol} from '../simulation/experiments/early-pace-search.mjs';
const map=process.argv[2],output=process.argv[3];
assert.ok(protocol.maps.includes(map));
const base=prepare(),w=loadModels(base.sources),manifest=readJson(join(root,'simulation','experiments','early-pace-selected.json')),p=manifest.result[map].p;
const geometry=await captureGeometry(base),candidate=prepare(configFor(w,map,p),geometry),control=prepare(configFor(w,map,null),geometry);
const measured=[],seed=12101,runs=16;
for(const [dt,agents] of [[.05,protocol.validate.agents],[.025,['normal']]]){
  for(const agent of agents){
    const opts={seed,runs,agent,dt,geometry};
    const before=evaluate(base.sources,w,map,null,opts),after=evaluate(base.sources,w,map,p,opts);
    const assessment=assess(map,after,before);
    measured.push({dt,agent,before,after,assessment});
    console.log('MEASURED '+JSON.stringify({map,dt,agent,wins:after.wins,assessment,seconds:[before.seconds.p50,after.seconds.p50],alive:[before.alive30.p50,after.alive30.p50],kills:[before.kills30.p50,after.kills30.p50],gear:[before.filled.p50,after.filled.p50]}));
  }
}
function metrics(r){
  const early=r.timeline.filter(x=>x.time<=30),last=early.at(-1);
  const after=r.timeline.filter(x=>x.time<=60).at(-1);
  return {seed:r.seed,result:r.result,seconds:r.seconds,completed:r.completed,alive30:early.reduce((s,x)=>s+x.enemies,0)/early.length,
    kills30:last.kills,kills60:after.kills,spawn30:last.spawned,peak:Math.max(...r.timeline.map(x=>x.enemies)),firstItem:r.events.find(e=>e.type==='card_spawn'&&e.kind==='item')?.t??null,
    gear:r.gear.filter(Boolean).length,actions:r.actions.filter(a=>a.type==='DRAG_END'&&a.ok).length};
}
const browser=[];
for(let seed=13101;seed<13104;seed++){
  const opts={seed,dt:.05,maxSeconds:90,trace:true};
  const before=metrics(await runBrowser(control,profileFor('normal'),opts));
  const after=metrics(await runBrowser(candidate,profileFor('normal'),opts));
  browser.push({before,after});
  console.log('BROWSER '+JSON.stringify({map,before,after}));
}
const median=(side,k)=>distribution(browser.map(r=>r[side][k])).p50;
const ratios={alive:median('after','alive30')/median('before','alive30'),kills:median('after','kills30')/median('before','kills30'),kills60:median('after','kills60')/median('before','kills60')};
const browserPass=browser.every(r=>r.after.result!=='defeat'&&r.after.completed>=4&&r.after.actions>0)&&ratios.alive>=1.5&&ratios.kills>=1.5&&ratios.kills60>=1.5;
const pass=measured.every(r=>r.assessment.pass)&&browserPass;
const report={schemaVersion:1,...base.fingerprint,map,parameters:p,geometry,measured,browser,ratios,browserPass,pass};
saveJson(output,report);
console.log('REFERENCE '+JSON.stringify({map,pass,browserPass,ratios,measuredPass:measured.map(r=>({dt:r.dt,agent:r.agent,pass:r.assessment.pass}))}));
assert.ok(pass,'Measured model or browser gate failed: '+map);
