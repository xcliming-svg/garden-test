import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const window={};
new Function('window',readFileSync('src/relic-collection.js','utf8'))(window);
const {create,tuning:T}=window.GardenRelicCollection;
const spec={width:960,height:540,top:30,bottom:40,blueprint:{x:8,y:38,width:100,height:120},
  garden:{x:360,y:160,columns:10,pitch:23,line:1,cell:22}};
let checks=0;
const check=(value,message)=>{checks++;assert.ok(value,message);};
const advance=(model,seconds,hero)=>{for(let left=seconds;left>1e-8;){const dt=Math.min(.05,left);model.step(dt,hero);left-=dt;}};
const make=(random=()=>.99)=>{const m=create(spec,random);m.syncFlowers([44,45,54,55]);return m;};
{
  let i=0;const m=make(()=>((i++)%100)/100);
  for(let n=0;n<100;n++)m.death(700,250);
  check(m.state.spawnedGems===100,'one gem per kill');
  check(m.state.spawnedHearts===10,'independent 10% chance');
  check(m.state.drops.length===110,'separate gem and heart drops');
  advance(m,T.lifetime-.05,{x:100,y:400});
  check(m.state.drops.length===110,'not removed before lifetime');
  advance(m,.05,{x:100,y:400});
  check(m.state.drops.length===0&&m.state.expired===110,'both expire');
}
{
  const m=make();m.death(700,250);const d=m.state.drops[0];
  advance(m,.5,{x:100,y:400});check(d.x===700&&!d.attracted,'gem stays outside range');
  advance(m,.05,{x:730,y:250});check(d.x>700&&d.x<730&&d.attracted,'magnet starts with motion');
  const x=d.x;advance(m,.05,{x:820,y:250});check(d.x>x&&d.attracted,'tracks moving hero outside range');
  advance(m,1,{x:820,y:250});check(m.state.gems===1&&!m.state.drops.length,'gem credits exactly once at contact');
  advance(m,1,{x:820,y:250});check(m.state.gems===1,'no duplicate credit');
}
{
  const m=make(()=>0);m.death(700,250);
  advance(m,1,{x:100,y:400});check(m.state.hearts===0&&m.state.drops.some(d=>d.kind==='heart'),'full garden does not waste hearts');
  m.damageFlower(44,60);m.damageFlower(45,40);m.damageFlower(54,20);
  advance(m,2,{x:100,y:400});
  check(m.state.flowers.get(44).energy===60,'weakest recovers exactly 20');
  check(m.state.flowers.get(45).energy===60&&m.state.flowers.get(54).energy===80,'other flowers unchanged');
  check(m.state.hearts===1,'heart consumed once');
  m.death(700,250);m.damageFlower(45,50);
  advance(m,2,{x:100,y:400});check(m.state.flowers.get(45).energy===30,'new lowest gets next heart');
  m.syncFlowers([44,45,54,55,56]);check(m.state.flowers.get(56).energy===100,'new flower starts full');
  check(m.state.flowers.get(45).energy===30,'sync preserves energy');
}
{
  const m=make(()=>0);m.damageFlower(44,5);m.death(500,260);
  advance(m,2,{x:100,y:400});
  check(m.state.flowers.get(44).energy===100,'heal capped at maximum');
  m.damageFlower(44,1000);check(m.state.flowers.get(44).energy===0,'damage capped at zero');
  m.damageFlower(45,1000);check(m.weakest().id===44,'ties resolved by cell index');
  m.death(8,30);check(m.state.drops.every(d=>d.x>=6&&d.y>=spec.top+6),'drops constrained to field');
}
{
  const m=make(()=>0);m.damageFlower(44,80);m.damageFlower(45,50);m.death(700,250);
  advance(m,.3,{x:100,y:400});m.damageFlower(45,40);
  advance(m,2,{x:100,y:400});check(m.state.flowers.get(45).energy===30&&m.state.flowers.get(44).energy===20,'heart retargets lowest energy in flight');
  const before=m.state.drops.map(d=>d.age);m.step(0,{x:100,y:400});
  check(JSON.stringify(before)===JSON.stringify(m.state.drops.map(d=>d.age)),'paused time does not age drops');
}
console.log('PASS relic collection:',checks,'checks');
