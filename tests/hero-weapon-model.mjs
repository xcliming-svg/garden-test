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
// Wheel creates a hero-height wheel ahead of the body, then rolls without slip.
for(const [direction,dx,dy] of [['right',0,-1],['down',1,0],['left',0,1],['up',-1,0]]){
  const h={...hero,direction,visibleHeight:40,center:{x:480,y:270}},m=A.create(spec);
  m.select('wheel');m.step(.01,h);const q=m.state.shots[0];
  ok(q.span===40,'wheel height');
  ok(Math.abs(q.x-h.center.x-dx*44)<1e-6&&Math.abs(q.y-h.center.y-dy*44)<1e-6,'ahead of body');
  let last=0,delta=Infinity;
  for(let i=1;i<=8;i++){
    q.age=i*.2;const p=A.pose(q,h),d=A.wheelTravel(q);
    ok(d-last<=delta+1e-6,'monotonic deceleration');
    ok(Math.abs(Math.abs(p.angle)*20-d)<1e-6,'rolling without slip');
    ok(Math.sign(p.angle)===(dx?Math.sign(dx):Math.sign(dy)),'roll direction');
    delta=d-last;last=d;
  }
}
{
  const m=A.create(spec);m.select('wheel');
  m.step(.01,{...hero,visibleHeight:40,center:{x:480,y:60}});
  ok(m.state.shots.length===0,'no wheel spawned into HUD or body');
  m.step(.01,{...hero,visibleHeight:32});
  ok(m.state.shots[0].span===32,'wheel follows actual hero height');
}
{
  const m=A.create(spec);m.select('flowerpot');m.step(.01,hero);const q=m.state.shots[0];
  const ys=[0,.1,.2,.3,.4].map(age=>A.pose({...q,age},hero).y);
  for(let i=2;i<ys.length;i++)ok(ys[i]-ys[i-1]>ys[i-1]-ys[i-2],'gravity accelerates');
  q.age=.51;ok(A.pose(q,hero).alpha===1&&A.potFragments(q).length===0,'intact until impact');
  q.age=.52;ok(A.pose(q,hero).alpha===0&&A.potFragments(q).length===12,'shatters on impact');
  q.age=.8;ok(A.potFragments(q).every(p=>Object.values(p).filter(v=>typeof v==='number').every(Number.isFinite)),'finite shards');
  q.age=1.15;ok(A.potFragments(q).every(p=>p.alpha<1e-8),'shards fade');
}
{
  const m=A.create(spec);m.select('yellow-floor');m.step(.01,hero);const q=m.state.shots[0];
  let previous=0;
  for(const age of [0,.08,.16,.24,.32]){
    const p=A.pose({...q,age},hero);
    ok(p.x===q.tx&&p.y===q.ty,'stationary ground placement');
    ok(p.scale>=previous,'spreads outward');
    previous=p.scale;
  }
  ok(A.tuning['yellow-floor'].span===72&&previous===1,'larger 72px ground');
}
console.log('PASS equipped weapon model:',checks,'checks');
