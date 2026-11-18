import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const ids=['rock','paper-plane','balloon','boomerang','wheel','flowerpot','bouncy-ball','yellow-floor','sprinkler','broom'];
const window={location:{search:'?enemies=1&weapons=1'},GardenFairyPatrol:{enabled:true,speedAt:(b,r)=>r===5?b*1.5:b,blinkSchedule:()=>()=> 'normal'},
  GardenFlowerGrowth:{enabled:true},GardenItemCards:{entries:ids.map(id=>({id}))}};
for(const path of ['src/fairy-attack.js','src/relic-collection.js','src/weapon-balance.js','src/enemy-motion.js','src/enemy-preview.js','src/pebble-boundary.js','src/hero-weapon-preview.js'])
  vm.runInNewContext(readFileSync(path,'utf8'),{window,URLSearchParams});
const B=window.GardenWeaponBalance,A=window.GardenHeroWeaponPreview,E=window.GardenEnemyPreview,M=window.GardenEnemyMotion;
const spec={width:960,height:540,top:32,bottom:40,garden:{x:364,y:150,columns:10,rows:10,pitch:23,cell:22,line:1},slots:{max:10}};
const garden={left:433,right:526,top:219,bottom:312},occupied=[44,45,54,55];
const boundary=window.GardenPebbleBoundary.layout(spec,garden,40,{lift:.5,tilt:1.25,lean:.5},11);
const patrol={bounds:boundary.patrol,boundary,occupied,finished:false},hero={index:0,type:'garden',visibleHeight:40,center:{x:480,y:boundary.patrol.top}};
function seeded(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;};
const step=(m,dt,targets=[],damage=null,slow=null,push=null,h=hero,p=patrol)=>m.step(dt,h,targets,damage,slow,p,push);
const enemy=(id,x,y,extra={})=>({id,x,y,ground:y,lift:0,radius:6,height:20,hp:100,attackType:'approach',phase:'move',attackIn:5,...extra});
const model=()=>A.create(spec,seeded(4),A.defaultSize,true);
for(const id of ids)for(let level=1;level<=3;level++){
 const st=B.stats(id,level);ok(st.range<=550&&st.cooldown>0&&Number.isFinite(B.nominalDps(id,level)),'finite stats '+id);
 ok(st.level===level,'level');
 const m=model();for(let i=0;i<10;i++)ok(m.equip(i,id,level),'ten slots');ok(!m.equip(10,id,level),'slot limit');
 step(m,1,[],()=>({killed:false,hp:100}));ok(m.state.fired===0,'no empty-field combat firing');
}
for(const entry of E.roster)ok(B.hp(entry)===({approach:10,charge:12,jump:10,fly:8}[entry.attackType])*entry.level,'enemy hp');
ok([0,3,6].every((n,i)=>B.amount('wheel',B.stats('wheel',1),n)===[12,8,4][i]),'wheel tiers');
ok([0,1,2].every((n)=>B.amount('bouncy-ball',B.stats('bouncy-ball',1),n)===[10,8,6][n]),'chain tiers');
ok(!B.eligibleHeight('yellow-floor',{lift:12})&&!B.eligibleHeight('balloon',{lift:15})&&B.eligibleHeight('wheel',{lift:20})&&B.eligibleHeight('paper-plane',{lift:30}),'height');
{
 const m=model();m.equip(0,'rock',3);const e=enemy(1,480,hero.center.y-90);let total=0;
 for(let i=0;i<80;i++)step(m,.025,[e],(_,n)=>{total+=n;return {killed:false,hp:100};});
 ok(m.state.fired===3&&total===48,'rock level3 fire and damage');
 const x=model();x.equip(0,'rock');step(x,.05,[enemy(2,20,40)],()=>({killed:false}));ok(x.state.fired===0,'range');
}
{
 const m=model();m.equip(0,'boomerang');const e=enemy(1,480,hero.center.y-100,{radius:9});let damage=0;
 for(let i=0;i<85;i++)step(m,.025,[e],(_,n)=>{damage+=n;return {killed:false,hp:100};});
 ok(damage===16&&m.state.fired===1,'two boomerang legs');
}
{
 const m=model();m.equip(0,'balloon');let hits={};const e=enemy(1,480,100),air=enemy(2,480,100,{lift:18,attackType:'fly'});
 for(let i=0;i<70;i++)step(m,.025,[e,air],(id,n)=>{hits[id]=(hits[id]||0)+n;return {killed:false,hp:100};});
 ok(hits[1]===10&&!hits[2],'ground splash once');
}
{
 const m=model();m.equip(0,'flowerpot');const e=enemy(1,480,100),other=enemy(2,510,100);let hit={};
 for(let i=0;i<75;i++)step(m,.025,[e,other],(id,n)=>{hit[id]=(hit[id]||0)+n;return {killed:false,hp:100};});
 ok(hit[1]===28&&hit[2]===6||hit[1]===6&&hit[2]===28,'pot direct and splash');
}
{
 const m=model();m.equip(0,'yellow-floor',3);const e=enemy(1,480,100),air=enemy(2,480,100,{lift:15}),charge=enemy(3,480,100,{attackType:'charge',phase:'strike'});let values=[];
 for(let i=0;i<150;i++)step(m,.025,[e,air,charge],()=>({killed:false}),(...a)=>values.push(a));
 ok(values.length>0&&values.every(a=>a[0]===1&&a[1]===.5),'sticky ground only');ok(m.state.shots[0].life===4,'sticky duration');
}
{
 const m=model();m.equip(0,'sprinkler',2);const e=enemy(1,480,100,{radius:10}),air=enemy(2,480,100,{lift:18});let hit={};
 for(let i=0;i<130;i++)step(m,.025,[e,air],(id,n)=>{hit[id]=(hit[id]||0)+n;return {killed:false,hp:100};});
 ok((hit[1]||0)>=8&&(hit[1]||0)<=24&&!hit[2],'sprinkler repeated spray '+JSON.stringify(hit));
}
{
 const m=model();for(let i=0;i<10;i++)m.equip(i,'rock');const es=[enemy(1,480,100,{hp:10}),enemy(2,510,100,{hp:10})];
 step(m,.8,es,()=>({killed:false,hp:10}));ok(m.state.fired===2,'avoid redundant target reservation');
}
const entries=E.roster.map(e=>({...e,width:e.span,height:e.span}));
{
 const p=E.createPopulation(spec,patrol,entries.filter(e=>e.attackType==='approach'),seeded(17),()=>1,null,true);p.advance(0);const a=p.actors[0];
 ok(a.hp===B.hp(a.entry),'population HP');ok(p.damage(a.id,1).hp===B.hp(a.entry)-1,'population damage');
 const t=B.target(a);ok(Number.isFinite(t.attackIn)&&t.predict(.3).id===a.id,'predict');
 ok(p.slow(a.id,.5,.4)&&!p.slow(a.id,.4,.6)&&a.slowAmount===.5,'strongest slow only');p.advance(.1);
 ok(p.push(a.id,12)&&!p.push(a.id,12),'push cooldown');
}
function simulate(label,loadout,seconds,target,level=1,full=false){
 const rng=seeded(42),g=full?{left:364,right:595,top:150,bottom:381}:garden,cells=full?Array.from({length:100},(_,i)=>i):occupied;
 const b=window.GardenPebbleBoundary.layout(spec,g,40,{lift:.5,tilt:1.25,lean:.5},11),p={bounds:b.patrol,boundary:b,occupied:cells,finished:false},h={...hero,center:{x:0,y:0}};
 const pop=E.createPopulation(spec,p,entries,rng,target,null,true),m=A.create(spec,rng,A.defaultSize,true);
 loadout.forEach((id,i)=>m.equip(i,id,level));
 const dt=.05,w=p.bounds.right-p.bounds.left,v=p.bounds.bottom-p.bounds.top,L=2*(w+v);let flowerStrikes=0,peak=0,activeShots=0;
 for(let t=0;t<seconds-1e-8;t+=dt){
   let d=t*40%L;
   h.center=d<w?{x:p.bounds.left+d,y:p.bounds.top}:d<w+v?{x:p.bounds.right,y:p.bounds.top+d-w}:d<2*w+v?{x:p.bounds.right-(d-w-v),y:p.bounds.bottom}:{x:p.bounds.left,y:p.bounds.bottom-(d-2*w-v)};
   pop.advance(dt);peak=Math.max(peak,pop.actors.length);
   for(const a of pop.actors)if(!a.flowerHit&&['recover','return'].includes(a.pose.phase)){a.flowerHit=true;flowerStrikes++;}
   step(m,dt,pop.actors.map(B.target),pop.damage,pop.slow,pop.push,h,p);
   activeShots=Math.max(activeShots,m.state.shots.length);
   for(const s of m.state.shots){
     ok(Object.values(A.pose(s,h)).every(Number.isFinite),'finite combat pose');
     if(['yellow-floor','sprinkler','broom'].includes(s.kind))ok(A.installationSafe(spec,s.kind,{x:s.tx,y:s.ty},g,s.size),'safe placement');
     if(s.kind==='wheel')ok(!A.segmentIntersects({x:s.x,y:s.y},{x:s.x+s.dx*s.exitDistance,y:s.y+s.dy*s.exitDistance},{left:g.left-s.size.width/2,right:g.right+s.size.width/2,top:g.top-s.size.height/2,bottom:g.bottom+s.size.height/2}),'protected wheel path');
   }
 }
 ok(pop.kills<=pop.spawned&&peak<=200&&activeShots<150,'bounded simulation');
 return {label,seconds,peak,spawned:pop.spawned,kills:pop.kills,flowerStrikes,fired:m.state.fired,hits:m.state.hits,damage:m.state.damage,activeShots};
}
const mixed=['rock','rock','paper-plane','wheel','wheel','balloon','balloon','yellow-floor','sprinkler','broom'];
// Square-span proxies for enemy SVG bounds; actual paths and population/weapon models.
const results=[
 simulate('early4',['rock','paper-plane','flowerpot','balloon'],20,()=>2),
 simulate('mid6',['rock','paper-plane','balloon','wheel','bouncy-ball','yellow-floor'],20,()=>50),
 simulate('late10-mixed',mixed,20,()=>200),
 simulate('late10-rock',Array(10).fill('rock'),20,()=>200),
 simulate('late10-wheel',Array(10).fill('wheel'),20,()=>200),
 simulate('full10-L3',mixed,20,()=>200,3,true)
];
console.log('BALANCE RESULTS',JSON.stringify(results));
console.log('PASS weapon balance:',checks,'checks');
