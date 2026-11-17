import {readFileSync} from 'node:fs';
function populationAudit(sources){
 const w={location:{search:""},GardenPalette:{hex:{stone:"#706975"}}},check=(ok,msg)=>{if(!ok)throw Error(msg)};
 for(const path of ["src/fairy-patrol.js","src/enemy-motion.js","src/enemy-preview.js","src/pebble-boundary.js"])new Function("window","URLSearchParams",sources[path])(w,class{get(){return null;}});
 const E=w.GardenEnemyPreview,M=w.GardenEnemyMotion,B=w.GardenPebbleBoundary;
 let count=0,spawned=0,completed=0,samples=0,minConcurrent=8,directionCases=0,directionSamples=0,clippedStarts=0;
 for(const cell of [12,22,32])for(const size of [4,100])for(const hero of [24,40,56])for(let seed=1;seed<=6;seed++){
  let state=seed;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  const pitch=cell+1,gsize=10*pitch+1,spec={width:960,height:540,top:32,bottom:40,fieldHeight:468,garden:{x:Math.floor((960-gsize)/2),y:Math.floor(32+(468-gsize)/2),columns:10,rows:10,cell,line:1,pitch,outer:cell+2,size:gsize}},g=spec.garden;
  const occupied=size===4?[44,45,54,55]:Array.from({length:100},(_,i)=>i);
  const garden=size===4?{left:g.x+3*pitch,right:g.x+6*pitch+g.outer,top:g.y+3*pitch,bottom:g.y+6*pitch+g.outer}:{left:g.x,right:g.x+gsize,top:g.y,bottom:g.y+gsize};
  const boundary=B.layout(spec,garden,hero,{frequency:1.6,lift:.5,tilt:1.25,lean:.5},11),patrol={boundary,occupied,finished:false};
  // Check every species x direction at both approved speed ranks.
  if(seed===1)for(const e of E.roster)for(const side of E.directions)for(const rank of [0,5]){
   const path=E.route(spec,boundary,e,occupied,{side,random}),pr=M.profiles[e.id],travel=M.travelTime(e,path,rank),duration=M.duration(e,'auto',path,rank),hit=travel+pr.windup+pr.strike;
   const project=(time,mode='auto')=>E.worldPose(spec,path,M.sample(e,mode,time,path,rank),e);
   const start=project(0),stage=project(travel),end=project(hit),b=boundary.border,m=boundary.frame/2;
   check(Math.abs(Math.hypot(start.x-stage.x,start.ground-stage.ground)/travel-M.speed(e,rank))<1e-7,'2-D average speed');
   check(Math.abs(end.x-path.originX)<1e-6&&Math.abs(end.ground-path.originY)<1e-6,'target projection');
   check(Math.abs(Math.hypot(path.ux,path.uy)-1)<1e-8,'unit direction');
   check(side.includes('left')?path.ux<0:side.includes('right')?path.ux>0:Math.abs(path.ux)<1e-9,'horizontal entry direction');
   check(side.includes('top')?path.uy<0:side.includes('bottom')?path.uy>0:Math.abs(path.uy)<1e-9,'vertical entry direction');
   const bounds=q=>{const r=q.angle*Math.PI/180,hw=e.span*q.sx/2,hh=e.span*q.sy/2,ex=Math.abs(Math.cos(r))*hw+Math.abs(Math.sin(r))*hh,ey=Math.abs(Math.sin(r))*hw+Math.abs(Math.cos(r))*hh,y=q.ground-hh-q.lift;return {left:q.x-ex,right:q.x+ex,top:y-ey,bottom:y+ey};};
   const sb=bounds(start),eb=bounds(end);
   check(sb.right<b.left||sb.left>b.right||sb.bottom<b.top||sb.top>b.bottom,'spawn outside '+JSON.stringify({side,cell,size,hero,id:e.id,sb,b}));
   check(eb.left>=b.left+m-1e-6&&eb.right<=b.right-m+1e-6&&eb.top>=b.top+m-1e-6&&eb.bottom<=b.bottom-m+1e-6,'impact inside');
   if(sb.top<spec.top||sb.bottom>spec.height-spec.bottom)clippedStarts++;
   for(let k=0;k<=200;k++){
    const q=project(duration*k/200),bb=bounds(q),returning=q.phase==='return';
    check(Object.values(q).every(v=>typeof v!=='number'||Number.isFinite(v)),'finite world pose');
    check(q.flip===(path.ux<0?!returning:path.ux>0?returning:false),'facing '+e.id+' '+side+' '+q.phase);
    check(Math.abs(q.angle)<=Math.max(pr.rock,pr.attackTilt)+1e-6,'upright');
    check(bb.left>=8-1e-6&&bb.right<=spec.width-8+1e-6,'horizontal field bounds');
    // Only the deliberate vertical-edge entry/exit can clip into HUD.
    if(q.phase==='strike'||q.phase==='recover')check(bb.top>=spec.top-1e-6&&bb.bottom<=spec.height-spec.bottom+1e-6,'attack in field');
    directionSamples++;
   }
   directionCases++;
  }
  const p=E.createPopulation(spec,patrol,E.roster,random),seen=new Set(),attacked=new Set(),entered=new Set(),ids=new Set(),sides=new Set(),first=[];
  let max=0;
  p.advance(0);
  for(let i=0;i<3600;i++){
   p.advance(.08);max=Math.max(max,p.actors.length);
   check(p.actors.length<=E.spawning.maxActive,"cap");
   for(const a of p.actors){
    const e=a.entry,q=a.pose,b=boundary.border,m=boundary.frame/2,r=q.angle*Math.PI/180,hw=e.span*q.sx/2,hh=e.span*q.sy/2,ex=Math.abs(Math.cos(r))*hw+Math.abs(Math.sin(r))*hh,ey=Math.abs(Math.sin(r))*hw+Math.abs(Math.cos(r))*hh,y=q.ground-hh-q.lift;
    if(!ids.has(a.id)){ids.add(a.id);first.push(e.id);sides.add(a.path.side);check(q.x+ex<b.left||q.x-ex>b.right||y+ey<b.top||y-ey>b.bottom,"outside");}
    seen.add(e.id);check(q.x-ex>=8-1e-6&&q.x+ex<=spec.width-8+1e-6,"bounds "+JSON.stringify({cell,size,hero,id:e.id,side:a.path.side}));
    check(occupied.includes(a.path.flower),"actual flower");check(q.flip===(a.path.ux<0?q.phase!=="return":a.path.ux>0?q.phase==="return":false),"facing");check(Math.abs((a.path.start-a.path.stage)/M.travelTime(e,a.path,0)-M.speed(e,0))<1e-7,"base speed");
    if(q.phase==="strike"){attacked.add(e.id);check(a.expression==="angry","attack eye");}
    if(q.phase==="recover"&&q.x-ex>=b.left+m&&q.x+ex<=b.right-m&&y-ey>=b.top+m&&y+ey<=b.bottom-m)entered.add(e.id);
    samples++;
   }
   if(seen.size===12&&attacked.size===12&&entered.size===12&&sides.size===8&&p.completed>=12)break;
  }
  check(seen.size===12&&attacked.size===12&&entered.size===12&&new Set(first.slice(0,12)).size===12&&sides.size===8&&p.completed>=12,"coverage "+JSON.stringify({cell,size,hero,seed,seen:[...seen],attacked:[...attacked],entered:[...entered],completed:p.completed}));
  const elapsed=p.elapsed,ages=p.actors.map(a=>a.age);patrol.finished=true;p.advance(5);check(elapsed===p.elapsed&&JSON.stringify(ages)===JSON.stringify(p.actors.map(a=>a.age)),"freeze");
  spawned+=p.spawned;completed+=p.completed;minConcurrent=Math.min(minConcurrent,max);count++;
 }
 return {count,spawned,completed,samples,minConcurrent,directionCases,directionSamples,clippedStarts};
}
const paths=["src/fairy-patrol.js","src/enemy-motion.js","src/enemy-preview.js","src/pebble-boundary.js"];
const sources=Object.fromEntries(paths.map(path=>[path,readFileSync(path,'utf8')]));
console.log(JSON.stringify(populationAudit(sources),null,2));
