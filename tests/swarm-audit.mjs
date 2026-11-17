import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
function audit(sources){
 const w={location:{search:''}};
 for(const n of ['fairy-patrol','enemy-motion','enemy-preview','pebble-boundary'])
  new Function('window','URLSearchParams',sources['src/'+n+'.js'])(w,class{get(){return null;}});
 const E=w.GardenEnemyPreview,B=w.GardenPebbleBoundary;
 const milestones=[[0,1],[15,6],[30,25],[60,75],[90,140],[120,200],[180,200]];
 for(const [t,n] of milestones)assert.equal(E.targetCount(t),n);
 assert.equal(E.spawning.maxActive,200);
 for(let i=0;i<1800;i++)assert.ok(E.targetCount(i/10)<=E.targetCount((i+1)/10));
 const spec={width:960,height:540,top:32,bottom:40,fieldHeight:468,garden:{x:364,y:150,columns:10,rows:10,cell:22,line:1,pitch:23,outer:24,size:231}},g=spec.garden;
 const report=[];
 for(const full of [false,true])for(let seed=1;seed<=5;seed++){
  let state=seed;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  const occupied=full?Array.from({length:100},(_,i)=>i):[44,45,54,55];
  const garden=full?{left:g.x,right:g.x+231,top:g.y,bottom:g.y+231}:{left:g.x+3*23,right:g.x+6*23+24,top:g.y+3*23,bottom:g.y+6*23+24};
  const boundary=B.layout(spec,garden,40,{frequency:1.6,lift:.5,tilt:1.25,lean:.5},11);
  assert.equal(boundary.height,40);
  const patrol={occupied,boundary,finished:false};
  const p=E.createPopulation(spec,patrol,E.roster,random),spawned=new Map(),counts=[];
  p.advance(0);assert.equal(p.actors.length,1);
  let minPlateau=200,maxPlateau=0,samples=0;
  for(let step=1;step<=1800;step++){
   p.advance(.1);
   assert.ok(p.actors.length<=E.targetCount(p.elapsed));
   assert.ok(p.actors.length<=200);
   for(const a of p.actors){
    spawned.set(a.id,a.entry);
    assert.ok(occupied.includes(a.path.flower));
    assert.ok(Number.isFinite(a.pose.x)&&Number.isFinite(a.pose.ground));
    samples++;
   }
   if(step%150===0)counts.push([step/10,p.actors.length]);
   if(step>=1210){minPlateau=Math.min(minPlateau,p.actors.length);maxPlateau=Math.max(maxPlateau,p.actors.length);}
  }
  assert.ok(minPlateau>=192&&maxPlateau===200,JSON.stringify({full,seed,minPlateau,maxPlateau}));
  const seq=[...spawned.entries()].sort((a,b)=>a[0]-b[0]).map(x=>x[1]);
  assert.equal(new Set(seq.slice(0,12).map(x=>x.id)).size,12);
  for(let j=12;j+40<=seq.length;j+=40){
   const bag=seq.slice(j,j+40);
   assert.deepEqual([1,2,3].map(l=>bag.filter(x=>x.level===l).length),[24,12,4]);
   assert.equal(new Set(bag.map(x=>x.id)).size,12);
  }
  const frozen=p.elapsed,ids=p.actors.map(a=>a.id);
  patrol.finished=true;p.advance(5);assert.equal(p.elapsed,frozen);assert.deepEqual(p.actors.map(a=>a.id),ids);
  report.push({full,seed,counts,minPlateau,maxPlateau,spawned:p.spawned,completed:p.completed,samples});
 }
 return report;
}
const paths=['src/fairy-patrol.js','src/enemy-motion.js','src/enemy-preview.js','src/pebble-boundary.js'];
const sources=Object.fromEntries(paths.map(path=>[path,readFileSync(path,'utf8')]));
console.log(JSON.stringify(audit(sources),null,2));
