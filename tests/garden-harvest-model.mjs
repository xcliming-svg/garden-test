import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

function load(search=''){
  const window={location:{search},GardenRunRules:{survival:true}};
  new Function('window','URLSearchParams',readFileSync('src/garden-harvest.js','utf8'))(window,URLSearchParams);
  return window.GardenHarvest;
}
for(const plot of ['a','c']){
  for(const harvest of ['auto','space']){
    const H=load('?plot='+plot+'&harvest='+harvest);
    assert.equal(H.enabled,true);
    assert.deepEqual(H.config,{plot,harvest});
    assert.deepEqual(H.names,['sunflower','rose','hydrangea','lavender']);
    assert.deepEqual([7,10,25,28].map((id,i)=>H.centerCell(i)),[7,10,25,28]);
    assert.equal(new Set(Array.from({length:36},(_,i)=>H.plotIndex(i))).size,4);
    for(let id=0;id<4;id++)assert.equal(Array.from({length:36},(_,i)=>i).filter(cell=>H.plotIndex(cell)===id).length,9);
    const m=H.create(),state=m.state;
    assert.equal(state.water,0);
    assert.deepEqual(state.plots.map(x=>x.count),[0,0,0,0]);
    assert.ok(state.plots.every(x=>x.progress===0));
    assert.equal(m.water(1,0),0,'empty droplet cannot water');
    assert.equal(m.gainWater(20),20);
    assert.equal(m.gainWater(200),80,'water capacity clamps to MAX');
    assert.equal(m.gainWater(1),0);
    assert.equal(state.water,100);
    assert.equal(m.water(1.36,0),34);
    assert.equal(m.stage(0),2);
    assert.equal(m.water(1.32,0),33);
    assert.equal(m.stage(0),3);
    assert.equal(m.water(1.32,0),33);
    assert.equal(state.water,0);
    assert.equal(state.plots[0].count,harvest==='auto'?1:0);
    assert.equal(state.plots[0].progress,harvest==='auto'?0:100);
    if(harvest==='space'){
      assert.equal(m.water(10,0),0,'mature plots stop accepting water');
      assert.equal(m.harvest(0),true,'explicit Space harvest');
      assert.equal(state.plots[0].count,1);
      assert.equal(state.plots[0].progress,0);
    }else assert.equal(m.harvest(0),false,'auto harvest never double counts');
    assert.ok(state.plots.slice(1).every(x=>x.count===0&&x.progress===0),'other plots independent');
  }
}
assert.deepEqual(load('?plot=nonsense&harvest=xxx').config,{plot:'a',harvest:'auto'});
assert.equal(load('?farm=legacy').enabled,false);
console.log('Garden harvest model PASS: A/C visual modes, auto/Space harvest, 6x6 four plots, three growth stages, water clamp, repeated harvest and plot independence');
