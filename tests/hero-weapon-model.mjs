import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const window={location:{search:''},GardenFairyPatrol:{enabled:true},GardenEnemyPreview:{enabled:false},
  GardenFlowerGrowth:{enabled:true},GardenItemCards:{entries:['shoe','shield','balloon','boomerang','wheel','flowerpot','paper-plane','bouncy-ball','yellow-floor','sprinkler','rock','broom'].map(id=>({id}))}};
for(const file of ['src/fairy-attack.js','src/relic-collection.js','src/hero-weapon-preview.js'])vm.runInNewContext(readFileSync(file,'utf8'),{window,URLSearchParams});
const A=window.GardenHeroWeaponPreview,spec={width:960,height:540,top:32,bottom:38};
const hero={index:0,type:'garden',direction:'right',visibleHeight:40,center:{x:480,y:200}};
const R=window.GardenRelicCollection,patrol={bounds:{left:380,right:580,top:200,bottom:340}};
function seeded(seed){return ()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};}
const rng=seeded(123);
const advance=(m,dt,h=hero,targets=[],damage=null,slow=null,p=patrol)=>m.step(dt,h,targets,damage,slow,p);
let checks=0;
const ok=(v,m)=>{assert.ok(v,m);checks++;};
for(const id of A.ids){
  const m=A.create(spec,rng);
  m.equip(0,id);advance(m,.05,{...hero,index:1,type:'water'});
  ok(m.state.fired===0,'water fairy never fires');
  advance(m,.05,hero);
  ok(m.state.shots[0].kind===id&&m.state.shots[0].slot===0&&!m.state.shots[0].preview,'equipped '+id);
  for(let t=0;t<3;t+=.05){
    for(const shot of m.state.shots){
      ok(Object.values(A.pose(shot,hero)).every(Number.isFinite),'finite pose');
      ok(shot.owner===0,'hero owner');
      ok(R.eligible({x:shot.tx,y:shot.ty},shot.origin,{bounds:shot.bounds}),'aim within shared pickup range');
    }
    advance(m,.05,hero);
  }
  m.equip(0,'shield');ok(m.state.shots.length===0,'replace');
  const f=m.state.fired;advance(m,3,hero);ok(m.state.fired===f,'shield never fires');
  const c=A.create(spec,rng);c.equip(0,id);
  let hits=0,slows=0;
  const target={id:1,x:480,y:id==='broom'?174:110,radius:8};
  for(let t=0;t<3;t+=.02)advance(c,.02,hero,[target],()=>{hits++;return {killed:false};},()=>{slows++;});
  ok(id==='yellow-floor'?slows>0&&hits===0:hits>0,'combat '+id);
}
const m=A.create(spec,rng);
m.select('balloon');advance(m,.05,hero,[{id:1,x:480,y:110,radius:8}],()=>{throw Error('preview damaged');});
m.equip(0,'rock');m.equip(2,'wheel');advance(m,.05,hero);
ok(m.state.shots.length===2&&m.state.shots.every(s=>!s.preview),'multiple equipped weapons');
m.equip(0,'shoe');ok(m.state.shots.length===1&&m.state.shots[0].kind==='wheel','replacement only');
ok(A.range===window.GardenFairyAttack.range&&A.range===550,'shared range');
// Every weapon, all four sides and corners: random points satisfy the exact pickup predicate.
for(const center of [{x:480,y:200},{x:580,y:270},{x:480,y:340},{x:380,y:270},{x:380,y:200},{x:580,y:200},{x:580,y:340},{x:380,y:340}]){
  const h={...hero,center};
  for(const id of A.ids){
    const unique=new Set();
    for(let i=0;i<40;i++){
      const m=A.create(spec,rng);m.select(id);advance(m,.01,h);
      const q=m.state.shots[0];ok(!!q,'shot at every patrol point');
      ok(R.eligible({x:q.tx,y:q.ty},center,patrol),'exact collection predicate');
      ok(q.tx>=0&&q.tx<=spec.width&&q.ty>=spec.top&&q.ty<=spec.height-spec.bottom,'aim inside field');
      unique.add(q.tx.toFixed(3)+','+q.ty.toFixed(3));
    }
    ok(unique.size>35,'random aims '+id);
  }
}
let reference=null;
// Compare speed only while all four wheels are still inside the viewport.
for(const [cx,cy,dx,dy] of [[480,200,0,-1],[580,270,1,0],[480,340,0,1],[380,270,-1,0]]){
  const h={...hero,center:{x:cx,y:cy}},m=A.create(spec,()=>.5);m.equip(0,'wheel');
  const target={id:1,x:cx+dx*80,y:cy+dy*80,radius:5};
  advance(m,.01,h,[target],()=>({killed:false}));
  const q=m.state.shots[0];ok(q.span===28,'wheel height');
  ok(Math.abs(q.x-cx-dx*38)<1e-6&&Math.abs(q.y-cy-dy*38)<1e-6,'ahead of body');
  let last=0,delta=Infinity;const distances=[];
  for(let i=1;i<=8;i++){
    q.age=i*.04;const p=A.pose(q,h),d=A.wheelTravel(q);
    ok(d-last<=delta+1e-6,'monotonic deceleration');
    ok(Math.abs(Math.abs(p.angle)*14-d)<1e-6,'rolling without slip');
    ok(Math.sign(p.angle)===(dx?Math.sign(dx):Math.sign(dy)),'roll direction');
    ok(Math.abs(Math.hypot(p.x-q.x,p.y-q.y)-d)<1e-6,'linear distance agrees');
    distances.push(d);delta=d-last;last=d;
  }
  if(reference)ok(distances.every((d,i)=>Math.abs(d-reference[i])<1e-8),'same speed all directions');else reference=distances;
  const exit=q.exitDistance;ok(exit>0,'exit distance');
  q.age=6;const end=A.pose(q,h);
  ok(A.wheelTravel(q)>=exit,'enough travel to exit');
  ok(end.x<=-15+1e-8||end.x>=975-1e-8||end.y<=17+1e-8||end.y>=517-1e-8,'fully outside field');
  q.age=0;let time=0;
  while(m.state.shots.includes(q)&&time<6.1){advance(m,.02,h,[target],()=>({killed:false}));time+=.02;}
  ok(!m.state.shots.includes(q)&&A.wheelTravel(q)>=exit,'removed after leaving');
}
{
  const h={...hero,visibleHeight:32},m=A.create(spec,rng);m.select('wheel');advance(m,.01,h);
  ok(m.state.shots[0].span===28,'wheel height stays fixed at agreed logical height');
}
{
  const near={id:1,x:480,y:160,radius:5},far={id:2,x:480,y:70,radius:5},bad={id:3,x:100,y:200,radius:5};
  const chosen=new Set();
  for(let i=0;i<80;i++){
    const m=A.create(spec,rng);m.equip(0,'rock');advance(m,.01,hero,[near,far,bad],()=>({killed:false}));
    chosen.add(m.state.shots[0].targetId);
  }
  ok(chosen.has(1)&&chosen.has(2)&&!chosen.has(3),'random eligible enemies');
}
{
  const m=A.create(spec,rng);m.select('flowerpot');advance(m,.01,hero);const q=m.state.shots[0];
  const ys=[0,.1,.2,.3,.4].map(age=>A.pose({...q,age},hero).y);
  for(let i=2;i<ys.length;i++)ok(ys[i]-ys[i-1]>ys[i-1]-ys[i-2],'gravity accelerates');
  q.age=.51;ok(A.pose(q,hero).alpha===1&&A.potFragments(q).length===0,'intact until impact');
  q.age=.52;ok(A.pose(q,hero).alpha===0&&A.potFragments(q).length===12,'shatters on impact');
  q.age=.8;ok(A.potFragments(q).every(p=>Object.values(p).filter(v=>typeof v==='number').every(Number.isFinite)),'finite shards');
  q.age=1.15;ok(A.potFragments(q).every(p=>p.alpha<1e-8),'shards fade');
}
{
  const m=A.create(spec,rng);m.select('yellow-floor');advance(m,.01,hero);const q=m.state.shots[0];
  let previous=0;
  for(const age of [0,.08,.16,.24,.32]){
    const p=A.pose({...q,age},hero);
    ok(p.x===q.tx&&p.y===q.ty,'stationary ground placement');
    ok(p.scale>=previous,'spreads outward');
    previous=p.scale;
  }
  ok(A.tuning['yellow-floor'].span===44&&previous===1,'44px visible height ground');
}
// Ballistic balloon and one-time ground impact use the same randomly chosen target.
{
  const cfg=A.tuning.balloon;
  const target={id:51,x:480,y:110,ground:125,radius:5};
  const m=A.create(spec,()=>.5);m.equip(0,'balloon');
  let hits=0;
  const damage=()=>{hits++;return {killed:false};};
  advance(m,.01,hero,[target],damage);
  const q=m.state.shots[0];
  ok(q.tx===target.x&&q.ty===target.ground,'ground target chosen');
  ok(R.eligible({x:q.tx,y:q.ty},q.origin,patrol),'balloon uses relic range');
  ok(q.flight>=cfg.minFlight&&q.flight<=cfg.maxFlight,'bounded flight time');
  const samples=[0,.2,.4,.6,.8,1].map(u=>{
    const a=A.pose({...q,age:q.flight*u},hero);
    return {u,x:a.x,y:a.y,z:(q.y+(q.ty-q.y)*u)-a.y-cfg.span/2};
  });
  for(let i=0;i<samples.length-1;i++){
    const p=samples[i];
    const expected=cfg.launchHeight*(1-p.u)+.5*cfg.gravity*q.flight*q.flight*p.u*(1-p.u);
    ok(Math.abs(p.z-expected)<1e-8,'true parabolic height');
    ok(Math.abs(p.x-(q.x+(q.tx-q.x)*p.u))<1e-8,'constant ground-plane velocity');
  }
  ok(samples[2].z>samples[0].z&&samples[2].z>samples[4].z,'rises then falls');
  const before={...q,age:q.flight-1e-6},impact={...q,age:q.flight};
  ok(A.pose(before,hero).alpha===1&&A.balloonSplash(before)===null&&A.balloonDroplets(before).length===0,'intact before contact');
  ok(Math.abs(A.pose(before,hero).y+cfg.span/2-q.ty)<.001,'balloon bottom reaches ground');
  ok(A.pose(impact,hero).alpha===0&&A.balloonSplash(impact)!==null,'replaced at exact contact');
  ok(A.balloonSplash(impact).x===q.tx&&A.balloonSplash(impact).y===q.ty,'puddle stationary at impact');
  ok(A.balloonDroplets(impact).length===12,'12 water droplets');
  let previous=0;
  for(const age of [0,.035,.07,.105,.14,.25]){
    const a=A.balloonSplash({...q,age:q.flight+age});
    ok(a.scale>=previous-1e-8&&a.x===q.tx&&a.y===q.ty,'puddle spreads without moving');previous=a.scale;
  }
  ok(previous===1&&cfg.splashSpan===44,'maximum puddle height');
  const spray=A.balloonDroplets({...q,age:q.flight+.15});
  ok(spray.every(p=>Object.values(p).every(Number.isFinite))&&spray.some(p=>Math.hypot(p.x-q.tx,p.y-q.ty)>5),'droplet motion');
  ok(A.balloonDroplets({...q,age:q.flight+.4}).length===0,'droplets expire');
  ok(A.balloonSplash({...q,age:q.life}).alpha<1e-8,'puddle fades');
  advance(m,q.flight-1e-6,hero,[target],damage);
  ok(hits===0,'no damage in flight');
  advance(m,.00001,hero,[target],damage);
  ok(hits===1&&q.burstDone,'one impact hit');
  const late={...target,id:52};
  advance(m,.1,hero,[target,late],damage);
  advance(m,.1,hero,[target,late],damage);
  ok(hits===1,'no repeat or late puddle damage');
  advance(m,q.life-q.age+.001,hero,[target],damage);
  ok(!m.state.shots.includes(q),'splash removed after lifetime');
}

// Agreed vertical dimensions, including wide art and the water splash.
{
 const heights={balloon:22,boomerang:20,wheel:28,flowerpot:22,'paper-plane':22,'bouncy-ball':22,'yellow-floor':44,sprinkler:22,rock:20,broom:44};
 for(const id of A.ids){
   const m=A.create(spec,rng);m.select(id);advance(m,.01);const q=m.state.shots[0];
   ok(q.size.height===heights[id]&&q.span===heights[id],'agreed visible height '+id);
   ok(q.size.width>0,'preserved aspect '+id);
 }
 ok(A.defaultSize('boomerang',20).width>40,'wide boomerang');
 ok(A.defaultSize('water-splash',44).width>100,'wide puddle');
}
// Broom deploys at the random ground point, independently of subsequent hero movement.
{
 const m=A.create(spec,()=>.5);m.equip(0,'broom');
 const e={id:81,x:480,y:110,ground:110,radius:5};let hits=0;
 advance(m,.01,hero,[e],()=>{hits++;return {killed:false};});
 const q=m.state.shots[0],first=A.pose(q,hero),moved={...hero,center:{x:550,y:340}};
 ok(q.tx===480&&q.ty===110,'broom deployed at target');
 for(const age of [0,.3,.6,.9,1.2,1.8,2.3]){
   const p=A.pose({...q,age},moved),same=A.pose({...q,age},hero);
   ok(Math.abs(Math.hypot(p.x-q.tx,p.y-q.ty)-A.tuning.broom.orbit)<1e-8,'constant orbit radius');
   ok(Math.abs(p.x-same.x)+Math.abs(p.y-same.y)<1e-8,'independent of fairy');
 }
 const full=A.pose({...q,age:A.tuning.broom.period},moved);
 ok(Math.hypot(first.x-full.x,first.y-full.y)<1e-8,'full revolution');
 for(let i=0;i<45;i++)advance(m,.02,moved,[e],()=>{hits++;return {killed:false};});
 ok(hits===1,'broom sweeps target once per instance');
}
// Sprinkler remains at installation point.
{
 const m=A.create(spec,rng);m.select('sprinkler');advance(m,.01);const q=m.state.shots[0];
 for(const age of [0,.1,.5,1,1.8]){
  const p=A.pose({...q,age},hero);ok(p.x===q.tx&&p.y===q.ty,'stationary sprinkler');
 }
}
// Boomerang returns on the opposite curve and reaches the moving fairy.
{
 const m=A.create(spec,rng);m.select('boomerang');advance(m,.01);const q=m.state.shots[0];
 const out=A.pose({...q,age:q.flight*.5},hero),back=A.pose({...q,age:q.flight+(q.life-q.flight)*.5},hero);
 ok(Math.hypot(out.x-back.x,out.y-back.y)>1,'separate outbound and return arcs');
 const h={...hero,center:{x:530,y:220}},end=A.pose({...q,age:q.life},h);
 ok(Math.hypot(end.x-h.center.x,end.y-h.center.y)<1e-8,'returns to moving fairy');
}
// Rock flight time scales with distance rather than fixed lifetime.
{
 const m=A.create(spec,()=>.5);m.equip(0,'rock');advance(m,.01,hero,[{id:1,x:480,y:100,radius:1}],()=>({killed:false}));
 const q=m.state.shots[0];ok(Math.abs(q.life-100/A.tuning.rock.speed)<1e-8,'distance-dependent flight time');
 const p=A.pose({...q,age:q.life*.5},hero);ok(p.y<150&&p.y>140,'short ballistic arc');
}
// Plane steers continuously instead of interpolating to a moving endpoint.
{
 const m=A.create(spec,()=>.5);m.equip(0,'paper-plane');const e={id:1,x:480,y:80,radius:1};advance(m,.01,hero,[e],()=>({killed:false}));
 const q=m.state.shots[0],p=A.pose(q,hero);advance(m,.05,hero,[{...e,x:500}],()=>({killed:false}));
 const n=A.pose(q,hero);ok(Math.hypot(n.x-p.x,n.y-p.y)<=A.tuning['paper-plane'].speed*.05+1e-8,'bounded glide velocity');
 ok(Math.abs(q.glide.heading+Math.PI/2)<=A.tuning['paper-plane'].turn*.05+1e-8,'bounded turn rate');
}
// Ball starts its next leg at impact position and moves toward the next enemy.
{
 const m=A.create(spec,()=>.5);m.equip(0,'bouncy-ball');
 const e={id:1,x:480,y:130,radius:10},f={id:2,x:540,y:125,radius:10};let count=0;
 advance(m,.01,hero,[e],()=>({killed:false}));const q=m.state.shots[0];
 for(let i=0;i<40&&!q.hit.has(1);i++)advance(m,.01,hero,[e,f],()=>({killed:false}));
 ok(q.hit.has(1)&&q.targetId===2,'ball retargets after contact');
 ok(q.leg.tx===f.x&&q.leg.ty===f.y&&q.leg.speed<A.tuning['bouncy-ball'].speed,'actual slower second leg');
 const p=A.pose(q,hero);ok(Math.hypot(p.x-q.leg.x,p.y-q.leg.y)<1e-8,'continuous bounce origin');
 for(let i=0;i<80&&!q.hit.has(2);i++)advance(m,.01,hero,[e,f],()=>({killed:false}));
 ok(q.hit.has(2),'second target actually hit');
}
console.log('PASS equipped weapon model:',checks,'checks');
