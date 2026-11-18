import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const window={location:{search:''},GardenFairyPatrol:{enabled:true},GardenEnemyPreview:{enabled:false},
  GardenFlowerGrowth:{enabled:true},GardenItemCards:{entries:['shoe','shield','balloon','boomerang','wheel','flowerpot','paper-plane','bouncy-ball','yellow-floor','sprinkler','rock','broom'].map(id=>({id}))}};
vm.runInNewContext(readFileSync('src/hero-weapon-preview.js','utf8'),{window,URLSearchParams});
const A=window.GardenHeroWeaponPreview,spec={width:960,height:540,top:32,bottom:38};
const hero={index:0,type:'garden',direction:'right',center:{x:480,y:200}};
let checks=0;
const ok=(v,m)=>{assert.ok(v,m);checks++;};
for(const id of A.ids){
  const m=A.create(spec);
  m.equip(0,id);m.step(.05,{...hero,index:1,type:'water'});
  ok(m.state.fired===0,'water fairy never fires');
  m.step(.05,hero);
  ok(m.state.shots[0].kind===id&&m.state.shots[0].slot===0&&!m.state.shots[0].preview,'equipped '+id);
  for(let t=0;t<3;t+=.05){
    for(const shot of m.state.shots){
      ok(Object.values(A.pose(shot,hero)).every(Number.isFinite),'finite pose');
      ok(shot.owner===0,'hero owner');
    }
    m.step(.05,hero);
  }
  m.equip(0,'shield');ok(m.state.shots.length===0,'replace');
  const f=m.state.fired;m.step(3,hero);ok(m.state.fired===f,'shield never fires');
  const c=A.create(spec);c.equip(0,id);
  let hits=0,slows=0;
  const target={id:1,x:480,y:id==='broom'?174:110,radius:8};
  for(let t=0;t<3;t+=.02)c.step(.02,hero,[target],()=>{hits++;return {killed:false};},()=>{slows++;});
  ok(id==='yellow-floor'?slows>0&&hits===0:hits>0,'combat '+id);
}
const m=A.create(spec);
m.select('balloon');m.step(.05,hero,[{id:1,x:480,y:110,radius:8}],()=>{throw Error('preview damaged');});
m.equip(0,'rock');m.equip(2,'wheel');m.step(.05,hero);
ok(m.state.shots.length===2&&m.state.shots.every(s=>!s.preview),'multiple equipped weapons');
m.equip(0,'shoe');ok(m.state.shots.length===1&&m.state.shots[0].kind==='wheel','replacement only');
console.log('PASS equipped weapon model:',checks,'checks');
