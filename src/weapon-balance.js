(function(){
  'use strict';
  // Combat-balance v1. Visual preview, relic collection and legacy radial combat
  // retain their own tuning. All distances are logical px, times are seconds.
  const params=new URLSearchParams(window.location.search);
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const integer=(v,min,max,fallback)=>{const n=Number(v);return v!==null&&v!==''&&Number.isInteger(n)&&n>=min&&n<=max?n:fallback;};
  const level=integer(params.get('weaponLevel'),1,3,1);
  const slots=integer(params.get('weaponSlots'),4,10,10);
  const enemyCount=integer(params.get('enemyCount'),1,200,null);
  const balanceWave=integer(params.get('balanceWave'),1,200,null);
  const data=Object.freeze({
    rock:{range:280,damage:[10,13,16],cooldown:[.8,.75,.7]},
    'paper-plane':{range:420,damage:[12,15,18],cooldown:[1.4,1.35,1.3]},
    balloon:{range:320,damage:[10,12,15],cooldown:[2.2,2.1,2]},
    boomerang:{range:320,damage:[8,10,12],cooldown:[2.2,2.1,2]},
    wheel:{range:360,damage:[[12,8,4],[14,9,5],[16,11,6]],cooldown:[3.2,3.1,3]},
    flowerpot:{range:350,damage:[[28,6],[34,8],[42,10]],cooldown:[2.6,2.5,2.4],direct:12,radius:38},
    'bouncy-ball':{range:300,damage:[[10,8,6],[12,10,8],[15,12,9]],cooldown:[1.8,1.7,1.6]},
    'yellow-floor':{range:300,damage:[0,0,0],cooldown:[5,4.8,4.6],duration:4,slow:[.4,.45,.5]},
    sprinkler:{range:330,damage:[3,4,5],cooldown:[4.8,4.6,4.4],duration:3.2,repeat:.45,maxHits:6,radius:44},
    broom:{range:250,damage:[6,8,10],cooldown:[5.2,5,4.8],duration:3.6,repeat:1.2,maxHits:3,push:12}
  });
  const loadout=Object.freeze((params.get('weaponLoadout')||'').split(',').map(id=>id.trim()).filter(id=>Object.prototype.hasOwnProperty.call(data,id)).slice(0,slots));
  const stats=(id,lvl=1)=>{
    const d=data[id];if(!d)return null;const n=clamp(Math.trunc(lvl)||1,1,3)-1;
    return {...d,level:n+1,damage:d.damage[n],cooldown:d.cooldown[n],slow:d.slow?.[n]};
  };
  const hp=e=>({approach:10,charge:12,jump:10,fly:8}[e.attackType]||10)*e.level;
  const finiteTarget=(total,elapsed,active,spawned)=>Math.min(200,active+Math.max(0,Math.min(total,Math.floor(elapsed*10)+1)-spawned));
  const groundContact=e=>(e.lift??0)<=3;
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const ground=e=>({x:e.x,y:e.ground??e.y});
  const threat=e=>e.phase==='return'||e.phase==='recover'?-2:1+5/(.35+Math.max(0,e.attackIn??4));
  const groundKinds=new Set(['balloon','flowerpot','yellow-floor','sprinkler','broom','wheel']);
  const eligibleHeight=(id,e)=>{
    if(id==='yellow-floor'||id==='broom'||id==='balloon'||id==='flowerpot')return groundContact(e);
    if(id==='sprinkler')return (e.lift??0)<=12;
    if(id==='wheel')return (e.lift??0)<=28;
    return true;
  };
  function nominalDps(id,lvl){
    const s=stats(id,lvl);if(!s)return 0;
    const d=Array.isArray(s.damage)?s.damage[0]:s.damage;
    return Math.round(10*d*(id==='boomerang'?2:s.maxHits||1)/s.cooldown)/10;
  }
  function amount(id,s,hitIndex=0,direct=false){
    if(id==='wheel')return s.damage[Math.min(2,Math.floor(hitIndex/3))];
    if(id==='flowerpot')return s.damage[direct?0:1];
    if(id==='bouncy-ball')return s.damage[Math.min(2,hitIndex)];
    return s.damage;
  }
  // Predict known scripted enemy motion instead of a frame-dependent velocity
  // extrapolation. Only the sampled future position is used; no teleporting.
  function target(actor){
    const M=window.GardenEnemyMotion,E=window.GardenEnemyPreview,e=actor.entry;
    const attackAge=M.travelTime(e,actor.path,0)+M.profiles[e.id].windup+M.profiles[e.id].strike;
    const elapsed=actor.populationTime||0,slow=elapsed<(actor.slowUntil||0)?actor.slowAmount||0:0;
    const sample=seconds=>{
      const slowed=Math.min(seconds,Math.max(0,(actor.slowUntil||0)-elapsed));
      const age=Math.min(actor.duration-1e-7,actor.age+seconds-slowed*slow);
      const p=seconds===0?actor.pose:E.worldPose(null,actor.path,M.sample(e,'auto',age,actor.path,0),e);
      const h=(e.height||e.span)*Math.abs(p.sy),w=(e.width||e.span)*Math.abs(p.sx);
      return {id:actor.id,x:p.x,y:p.ground-h/2-p.lift,ground:p.ground,lift:p.lift,width:w,height:h,radius:Math.min(w,h)*.42,
        hp:actor.hp,level:e.level,attackType:e.attackType,phase:p.phase,attackIn:Math.max(0,(attackAge-age)/(1-slow)),flower:actor.path.flower};
    };
    return {...sample(0),predict:sample};
  }
  function aimPoint(id,e,origin,tuning,balloonFlight){
    const g=groundKinds.has(id),p=g?ground(e):e,d=distance(p,origin);
    let t=0;
    if(id==='balloon')t=balloonFlight(d);
    else if(id==='flowerpot')t=tuning.flowerpot.fall;
    else if(id==='rock')t=d/tuning.rock.speed;
    else if(id==='boomerang')t=clamp(.12+d/tuning.boomerang.speed,tuning.boomerang.minFlight,tuning.boomerang.maxFlight);
    else if(id==='wheel')t=Math.max(0,(d-38)/310);
    else if(id==='bouncy-ball')t=d/tuning['bouncy-ball'].speed;
    else if(id==='yellow-floor')t=.55;
    else if(id==='sprinkler'||id==='broom')t=.65;
    const q=e.predict?e.predict(t):e;
    const aim=g?ground(q):{x:q.x,y:q.y};
    // The rock trajectory ends at the predicted center; the bow is visual motion.
    return {aim,predicted:q,delay:t};
  }
  function choose(id,level,origin,targets,shots,valid,tuning,balloonFlight,size){
    const s=stats(id,level),single=id==='rock'||id==='paper-plane'||id==='flowerpot';
    const reserved=new Map();
    for(const shot of shots)if(!shot.done&&shot.targetId!=null&&['rock','paper-plane','flowerpot'].includes(shot.kind)&&!shot.burstDone&&!shot.hit?.has(shot.targetId)){
      const a=stats(shot.kind,shot.level);reserved.set(shot.targetId,(reserved.get(shot.targetId)||0)+amount(shot.kind,a,0,true));
    }
    const options=[];
    for(const e of targets){
      if(e.phase==='return'||e.phase==='recover')continue;
      const {aim:point,predicted,delay}=aimPoint(id,e,origin,tuning,balloonFlight);
      if(!eligibleHeight(id,predicted))continue;
      let aim=point;
      const legal=p=>valid(p)&&distance(p,origin)<=s.range;
      if(id==='sprinkler'||id==='broom'||id==='yellow-floor'){
        // Place the spray/sweep ring beside the predicted target, not directly
        // on the hub. Ground traps can also cover a near-garden target from
        // an adjacent legal outside position.
        const r=id==='sprinkler'?24:id==='broom'?26:17;
        const angle=Math.atan2(origin.y-point.y,origin.x-point.x);
        const choices=Array.from({length:8},(_,i)=>({x:point.x+Math.cos(angle+i*Math.PI/4)*r,y:point.y+Math.sin(angle+i*Math.PI/4)*r}));
        if(id==='yellow-floor')choices.unshift(point);else choices.push(point);
        aim=choices.find(legal);if(!aim)continue;
      }else if(!legal(aim))continue;
      let score=threat(e);
      const remain=Math.max(0,(e.hp??10)-(reserved.get(e.id)||0));
      if(single&&remain===0&&e.attackIn>delay+.15)continue;
      if(single&&remain===0)score-=30;
      if(id==='rock')score+=(remain>0&&remain<=s.damage?4:0)-distance(origin,aim)/180;
      if(id==='paper-plane')score+=(e.attackType==='fly'?5:e.attackType==='jump'?3:0)+(distance(origin,aim)>280?1:0);
      if(id==='flowerpot')score+=Math.min(4,remain/8)+(e.attackType==='charge'?2:0);
      if(id==='wheel'||id==='boomerang'){
        const dx=aim.x-origin.x,dy=aim.y-origin.y,den=dx*dx+dy*dy;
        let n=0;
        for(const other of targets){
          if(!eligibleHeight(id,other))continue;
          const q=id==='wheel'?ground(other):other,along=((q.x-origin.x)*dx+(q.y-origin.y)*dy)/Math.max(1,den);
          if(along>0&&along<(id==='wheel'?1.6:1.15)&&Math.hypot(q.x-origin.x-dx*along,q.y-origin.y-dy*along)<(id==='wheel'?24:42)+(other.radius||0))n++;
        }
        score+=n*1.3;
      }
      if(id==='balloon'||id==='flowerpot'||id==='bouncy-ball'||id==='yellow-floor'||id==='sprinkler'||id==='broom'){
        const r=id==='balloon'?48:id==='bouncy-ball'?120:id==='yellow-floor'?25:id==='broom'?50:s.radius||44;
        let n=0;for(const other of targets){if(!eligibleHeight(id,other))continue;if(distance(ground(other),aim)<=r+(other.radius||0))n++;}
        score+=Math.min(id==='bouncy-ball'?3:20,n)*1.25;
      }
      if(['yellow-floor','sprinkler','broom'].includes(id)){
        for(const shot of shots)if(!shot.done&&shot.kind===id&&distance({x:shot.tx,y:shot.ty},aim)<(id==='yellow-floor'?44:80))score-=18;
        // Complement unlike installations, particularly glue + water.
        for(const shot of shots)if(shot.kind==='yellow-floor'&&id!=='yellow-floor'&&distance({x:shot.tx,y:shot.ty},aim)<50)score+=5;
      }
      options.push({target:e,aim,score,delay});
    }
    options.sort((a,b)=>b.score-a.score||a.target.id-b.target.id);
    return options[0]||null;
  }
  window.GardenWeaponBalance=Object.freeze({data,stats,hp,level,slots,enemyCount,balanceWave,loadout,finiteTarget,groundContact,eligibleHeight,ground,target,amount,nominalDps,choose});
}());
