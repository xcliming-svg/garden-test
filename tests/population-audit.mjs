import {readFileSync} from 'node:fs';
function populationAudit(sources){
 const w={location:{search:""}},check=(ok,msg)=>{if(!ok)throw Error(msg)};
 for(const path of ["src/fairy-patrol.js","src/enemy-motion.js","src/enemy-preview.js","src/pebble-boundary.js"])new Function("window","URLSearchParams",sources[path])(w,class{get(){return null;}});
 const E=w.GardenEnemyPreview,M=w.GardenEnemyMotion,B=w.GardenPebbleBoundary;
 let count=0,spawned=0,completed=0,samples=0,minConcurrent=8;
 for(const cell of [12,22,32])for(const size of [4,100])for(const hero of [24,40,56])for(let seed=1;seed<=6;seed++){
  let state=seed;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  const pitch=cell+1,gsize=10*pitch+1,spec={width:960,height:540,top:32,bottom:40,fieldHeight:468,garden:{x:Math.floor((960-gsize)/2),y:Math.floor(32+(468-gsize)/2),columns:10,rows:10,cell,line:1,pitch,outer:cell+2,size:gsize}},g=spec.garden;
  const occupied=size===4?[44,45,54,55]:Array.from({length:100},(_,i)=>i);
  const garden=size===4?{left:g.x+3*pitch,right:g.x+6*pitch+g.outer,top:g.y+3*pitch,bottom:g.y+6*pitch+g.outer}:{left:g.x,right:g.x+gsize,top:g.y,bottom:g.y+gsize};
  const boundary=B.layout(spec,garden,hero,{frequency:1.6,lift:.5,tilt:1.25,lean:.5},11),patrol={boundary,occupied,finished:false};
  const p=E.createPopulation(spec,patrol,E.roster,random),seen=new Set(),attacked=new Set(),entered=new Set(),ids=new Set(),sides=new Set(),first=[];
  let max=0;
  p.advance(0);
  for(let i=0;i<3600;i++){
   p.advance(.08);max=Math.max(max,p.actors.length);
   check(p.actors.length<=E.spawning.maxActive,"cap");
   for(const a of p.actors){
    const e=a.entry,q=a.pose,b=boundary.border,m=boundary.frame/2,r=q.angle*Math.PI/180,hw=e.span*q.sx/2,hh=e.span*q.sy/2,ex=Math.abs(Math.cos(r))*hw+Math.abs(Math.sin(r))*hh,ey=Math.abs(Math.sin(r))*hw+Math.abs(Math.cos(r))*hh,y=a.path.ground-hh-q.lift;
    if(!ids.has(a.id)){ids.add(a.id);first.push(e.id);sides.add(a.path.side);check(a.path.side==="left"?q.x+ex<b.left:q.x-ex>b.right,"outside");}
    seen.add(e.id);check(q.x-ex>=8-1e-6&&q.x+ex<=spec.width-8+1e-6&&y-ey>=spec.top-1e-6&&a.path.ground+Math.abs(Math.sin(r))*hw<=spec.height-spec.bottom+1e-6,"bounds "+JSON.stringify({cell,size,hero,id:e.id,side:a.path.side}));
    check(occupied.includes(a.path.flower),"actual flower");check(Math.abs((a.path.start-a.path.stage)/M.travelTime(e,a.path,0)-M.speed(e,0))<1e-7,"base speed");
    if(q.phase==="strike"){attacked.add(e.id);check(a.expression==="angry","attack eye");}
    if(q.phase==="recover"&&q.x-ex>=b.left+m&&q.x+ex<=b.right-m&&y-ey>=b.top+m&&a.path.ground+Math.abs(Math.sin(r))*hw<=b.bottom-m)entered.add(e.id);
    samples++;
   }
   if(seen.size===12&&attacked.size===12&&entered.size===12&&sides.size===2&&p.completed>=12)break;
  }
  check(seen.size===12&&attacked.size===12&&entered.size===12&&new Set(first.slice(0,12)).size===12&&sides.size===2&&p.completed>=12,"coverage "+JSON.stringify({cell,size,hero,seed,seen:[...seen],attacked:[...attacked],entered:[...entered],completed:p.completed}));
  const elapsed=p.elapsed,ages=p.actors.map(a=>a.age);patrol.finished=true;p.advance(5);check(elapsed===p.elapsed&&JSON.stringify(ages)===JSON.stringify(p.actors.map(a=>a.age)),"freeze");
  spawned+=p.spawned;completed+=p.completed;minConcurrent=Math.min(minConcurrent,max);count++;
 }
 return {count,spawned,completed,samples,minConcurrent};
}
const paths=["src/fairy-patrol.js","src/enemy-motion.js","src/enemy-preview.js","src/pebble-boundary.js"];
const sources=Object.fromEntries(paths.map(path=>[path,readFileSync(path,'utf8')]));
console.log(JSON.stringify(populationAudit(sources),null,2));
