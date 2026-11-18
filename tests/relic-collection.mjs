import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const window={location:{search:''}};
for(const file of ['fairy-attack','relic-collection'])new Function('window',readFileSync('src/'+file+'.js','utf8'))(window);
const A=window.GardenFairyAttack,{create,tuning:T,eligible,reachable}=window.GardenRelicCollection;
const spec={width:960,height:540,top:30,bottom:40,blueprint:{x:8,y:38,width:100,height:120},
  garden:{x:360,y:160,columns:10,pitch:23,line:1,cell:22}};
let checks=0;
const check=(value,message)=>{checks++;assert.ok(value,message);};
const bounds={left:400,right:560,top:180,bottom:350};
const length=2*(bounds.right-bounds.left+bounds.bottom-bounds.top);
const frame=(direction='down',b=bounds,speed=40)=>({bounds:b,direction,length:2*(b.right-b.left+b.bottom-b.top),speed});
const hero={x:560,y:250};
const advance=(model,seconds,point=hero,patrol=frame())=>{for(let left=seconds;left>1e-8;){const dt=Math.min(.05,left);model.step(dt,point,patrol);left-=dt;}};
const make=(random=()=>.99)=>{const m=create(spec,random);m.syncFlowers([44,45,54,55]);return m;};
{
  let i=0;const m=make(()=>((i++)%100)/100);
  for(let n=0;n<100;n++)m.death(700,250);
  check(m.state.spawnedGems===100,'one gem per kill');
  check(m.state.spawnedHearts===10,'independent 10% chance');
  check(m.state.drops.length===110,'separate drops');
  advance(m,T.lifetime-.05,{x:480,y:350},frame('left'));
  check(m.state.drops.length===110,'not removed before lifetime');
  advance(m,.05,{x:480,y:350},frame('left'));
  check(m.state.drops.length===0&&m.state.expired===110,'both expire if patrol never visits');
}
{
  const m=make();m.death(950,250);const d=m.state.drops[0];
  advance(m,.5,{x:480,y:350},frame('left'));check(d.x===950&&!d.attracted,'outside fan waits');
  advance(m,.05,hero);check(d.x<950&&d.attracted,'far gem attracted on right edge');
  const x=d.x;advance(m,.05,{x:480,y:350},frame('left'));check(d.x<x&&d.attracted,'keeps tracking after turning');
  advance(m,3,{x:480,y:350},frame('left'));check(m.state.gems===1&&!m.state.drops.length,'gem credits exactly once');
  advance(m,1);check(m.state.gems===1,'no duplicate credit');
}
{
  const m=make(()=>0);m.damageFlower(44,60);m.damageFlower(45,40);m.damageFlower(54,20);m.death(700,250);
  advance(m,1,{x:480,y:350},frame('left'));check(m.state.hearts===0&&m.state.drops.some(d=>d.kind==='heart'),'heart waits outside fan');
  advance(m,3);check(m.state.flowers.get(44).energy===60,'weakest recovers exactly 20');
  check(m.state.flowers.get(45).energy===60&&m.state.flowers.get(54).energy===80,'other flowers unchanged');
  check(m.state.hearts===1,'heart consumed once');
  m.death(700,250);m.damageFlower(45,50);
  advance(m,3);check(m.state.flowers.get(45).energy===30,'new lowest gets next heart');
  m.syncFlowers([44,45,54,55,56]);check(m.state.flowers.get(56).energy===100,'new flower starts full');
  check(m.state.flowers.get(45).energy===30,'sync preserves energy');
}
{
  const m=make(()=>0);m.damageFlower(44,5);m.death(700,250);
  advance(m,3);check(m.state.flowers.get(44).energy===100,'heal capped at maximum');
  m.death(700,250);advance(m,3);check(m.state.hearts===2&&m.state.flowers.get(44).energy===100,'full garden collects without overheal');
  m.damageFlower(44,1000);check(m.state.flowers.get(44).energy===0,'damage capped at zero');
  m.damageFlower(45,1000);check(m.weakest().id===44,'ties resolved by cell index');
  m.death(8,30);check(m.state.drops.every(d=>d.x>=6&&d.y>=spec.top+6),'drops constrained to field');
}
{
  const m=make(()=>0);m.damageFlower(44,80);m.damageFlower(45,50);m.death(700,250);
  advance(m,.3);m.damageFlower(45,40);
  advance(m,3);check(m.state.flowers.get(45).energy===30&&m.state.flowers.get(44).energy===20,'heart retargets in flight');
  const before=m.state.drops.map(d=>d.age);m.step(0,hero,frame());
  check(JSON.stringify(before)===JSON.stringify(m.state.drops.map(d=>d.age)),'paused time does not age drops');
}
check(A.range===A.tuning.speed*A.tuning.life,'same range as projectiles');
check(eligible({x:950,y:250},hero,frame()),'long-range right edge');
check(!eligible({x:1120,y:250},hero,frame()),'beyond actual projectile range');
check(T.magnetAngle===100,'100 degree fan');
const north={x:480,y:180},nf=frame('right');
check(eligible({x:480,y:80},north,nf),'north directly outward');
check(!eligible({x:100,y:80},north,nf)&&!eligible({x:860,y:80},north,nf),'far top corners not swept at top center');
check(eligible({x:450,y:80},north,nf)===eligible({x:510,y:80},north,nf),'left right symmetry');
check(eligible({x:480,y:184},north,nf),'near contact pickup');
check(eligible({x:480,y:250},north,nf),'inner drop remains reachable');
check(!eligible({x:900,y:190},north,nf),'outside angle despite within range');
for(const x of [400,420,480,540,560])for(const [dx,dy] of [[100,-100],[100,-20],[0,-200],[-200,-100]]){
  const p={x,y:180},q={x:x+dx,y:180+dy};
  check(eligible(q,p,nf)===eligible({x:960-q.x,y:q.y},{x:960-x,y:180},nf),'mirror symmetry');
}
{
  const b={left:301,right:460,top:82,bottom:250},p={x:954,y:494};
  const q=reachable(p,b);
  check(Math.hypot(q.x-b.right,q.y-b.bottom)<=A.range,'out-of-range corner corrected on spawn');
  const m=make(()=>0);m.death(p.x,p.y,b);
  check(m.state.drops.every(d=>Math.hypot(d.x-b.right,d.y-b.bottom)<=A.range),'both drops corrected');
}
// Sweep every sampled field position on real clockwise rectangular routes,
// with drops born just after a visit, including a full lap longer than 20s.
for(const [b,speed] of [[bounds,40],[{left:340,right:620,top:110,bottom:420},40],[{left:340,right:620,top:110,bottom:420},80]]){
  const w=b.right-b.left,h=b.bottom-b.top,len=2*(w+h),lap=len/speed;
  function pose(d){
    d=((d%len)+len)%len;
    if(d<w)return [{x:b.left+d,y:b.top},'right'];
    if((d-=w)<h)return [{x:b.right,y:b.top+d},'down'];
    if((d-=h)<w)return [{x:b.right-d,y:b.bottom},'left'];
    return [{x:b.left,y:b.bottom-(d-w)},'up'];
  }
  const m=make(()=>0);
  for(let x=6;x<=954;x+=48)for(let y=36;y<=494;y+=40)m.death(x,y,b);
  for(const x of [6,954,b.left,b.right,(b.left+b.right)/2])for(const y of [36,494,b.top,b.bottom,(b.top+b.bottom)/2])m.death(x,y,b);
  for(const d of m.state.drops)check(Number.isFinite(d.x)&&Number.isFinite(d.y),'valid drop position');
  for(let time=.05;time<=lap+T.settleSeconds+3;time+=.05){
    const [point,direction]=pose(w+.1+time*speed);m.step(.05,point,frame(direction,b,speed));
    if(time>=lap+T.settleSeconds&&time<lap+T.settleSeconds+.05)
      check(m.state.drops.every(d=>d.attracted),'all drops captured by next lap');
  }
  check(m.state.expired===0,'no loss before next lap');
  check(m.state.gems===m.state.spawnedGems&&m.state.hearts===m.state.spawnedHearts,'all field drops collected');
}
console.log('PASS relic collection:',checks,'checks');
