import {readFileSync} from 'node:fs';
function audit(sources){
 const check=(ok,msg)=>{if(!ok)throw Error(msg)};
 const w={location:{search:""},GardenPalette:{n:{slate:0,growth:0}}};
 for(const p of Object.keys(sources).filter(p=>!p.endsWith("game-layout.js")))new Function("window","URLSearchParams",sources[p])(w,class{get(){return null;}});
 const F=w.GardenFairyPatrol,M=w.GardenEnemyMotion,E=w.GardenEnemyPreview,B=w.GardenPebbleBoundary,G=w.GardenFlowerGrowth;
 const candidateSource=sources["src/game-layout.js"].match(/function gardenCandidates\(occupied\) \{[\s\S]*?\n  \}/)[0];
 const gait={frequency:1.6,lift:.5,tilt:1.25,lean:.5};
 const specFor=cell=>{const pitch=cell+1,size=10*pitch+1;return {width:960,height:540,top:32,bottom:40,fieldHeight:468,garden:{x:Math.floor((960-size)/2),y:Math.floor(32+(468-size)/2),columns:10,rows:10,cell,line:1,pitch,outer:cell+2,size}};};
 let combinations=0,poses=0,minPass=Infinity,minDefault=Infinity,worst=null,states=0,initial=0,full=0;
 const round=x=>+x.toFixed(3);
 for(const type of ["approach","jump","charge","fly"]){
  const list=E.roster.filter(e=>e.attackType===type).sort((a,b)=>a.level-b.level);
  check(list.length===3,"type count");
  for(let i=1;i<list.length;i++){const a=list[i-1],b=list[i];check(a.span<b.span&&M.speed(a)<M.speed(b)&&M.speed(a,5)<M.speed(b,5)&&M.profiles[a.id].reach<M.profiles[b.id].reach,"level progression "+type);}
 }
 for(let i=0;i<11;i++){const a=G.stateAt(i*5),b=G.stateAt(i*5+4.999);check(a.stage===b.stage&&a.hp===b.hp&&a.stage>=1&&a.stage<=3&&[100,66,33].includes(a.hp),"flower growth");states++;}
 check(JSON.stringify(G.stateAt(55))===JSON.stringify(G.stateAt(0)),"flower cycle");
 for(const cell of [12,22,32]){
 const spec=specFor(cell);const candidates=new Function("spec",candidateSource+";return gardenCandidates;")(spec);w.GardenGameLayout={gardenCandidates:candidates};
 for(const shape of ["compact","right","left"]){
  const occupied=new Set([44,45,54,55]);while(true){
   const n=occupied.size;
   if(cell===22||n===4||n===100)for(const requested of [24,40,56]){
    const garden=w.GardenDashedGridPreview.geometry(spec,occupied,0,0).garden,bd=B.layout(spec,garden,requested,gait,F.count);
    check(bd.length/F.count>=bd.height*1.2+4-1e-6,"fairy separation");
    if(cell===22&&requested===40&&shape==="compact"){if(n===4)initial=bd.length;if(n===100)full=bd.length;}
    for(const a of E.roster)for(const erank of F.ranks){
     const route=E.route(spec,bd,a,[...occupied]),profile=M.profiles[a.id],travel=M.travelTime(a,route,erank),impact=travel+profile.windup+profile.strike;
     check(occupied.has(route.flower),"target");
     check(M.speed(a,erank)<F.maxSpeed,"max speed ordering");
     check(Math.abs((route.start-route.stage)/travel-M.speed(a,erank))<1e-7,"travel speed");
     for(const rank of F.ranks){
      const v=F.speedAt(F.speed,rank,F.maxSpeed),gap=bd.length/F.count/v,ratio=impact/gap;
      if(ratio<minPass){minPass=ratio;worst={n,cell,requested,shape,v,id:a.id,erank,impact:round(impact),gap:round(gap)};}
      if(cell===22&&requested===40){minDefault=Math.min(minDefault,ratio);check(ratio>=1,"default patrol interval");}
      combinations++;
     }
     for(const mode of M.modes){
       const hit=mode==="move"?M.travelTime(a,route,erank,mode):mode==="auto"?impact:profile.windup+profile.strike;
       const dur=M.duration(a,mode,route,erank);
       for(let i=0;i<=33;i++){
        const p=M.sample(a,mode,i===33?hit:dur*i/32,route,erank);
        check(Object.values(p).every(x=>typeof x!=="number"||Number.isFinite(x)),"finite pose");
        const r=p.angle*Math.PI/180,hw=a.span*p.sx/2,hh=a.span*p.sy/2;
        const ex=Math.abs(Math.cos(r))*hw+Math.abs(Math.sin(r))*hh,ey=Math.abs(Math.sin(r))*hw+Math.abs(Math.cos(r))*hh;
        const y=route.ground-hh-p.lift;
        check(p.x-ex>=8-1e-6&&p.x+ex<=spec.width-8+1e-6&&y-ey>=spec.top-1e-6&&route.ground+Math.abs(Math.sin(r))*hw<=spec.height-spec.bottom+1e-6,"screen bounds "+a.id+" "+n+" "+cell+" "+requested);
        if(i===33){
         check(Math.abs(p.x-route.target)<1e-6,"hit "+a.id+" "+mode);
         const b=bd.border,m=bd.frame/2;
         check(p.x-ex>=b.left+m-1e-6&&p.x+ex<=b.right-m+1e-6&&y-ey>=b.top+m-1e-6&&route.ground+Math.abs(Math.sin(r))*hw<=b.bottom-m+1e-6,"inner wall "+a.id+" "+n+" "+cell+" "+requested);
        }
        poses++;
       }
     }
    }
   }
   if(n===100)break;
   const score=i=>{const x=i%10,y=Math.floor(i/10),d=(x-4.5)**2+(y-4.5)**2;return shape==="compact"?d:shape==="right"?-x*100+d:x*100+d;};
   const next=[...candidates(occupied)].sort((a,b)=>score(a)-score(b)||a-b)[0];check(next!==undefined,"growth");occupied.add(next);
  }
 }
 }
 return {combinations,poses,states,minPass:round(minPass),minDefault:round(minDefault),worst,initial,full};
}
const paths=["src/fairy-patrol.js","src/enemy-motion.js","src/enemy-preview.js","src/pebble-boundary.js","src/flower-growth.js","src/dashed-grid-preview.js","src/game-layout.js"];
const sources=Object.fromEntries(paths.map(path=>[path,readFileSync(path,'utf8')]));
console.log(JSON.stringify(audit(sources),null,2));
