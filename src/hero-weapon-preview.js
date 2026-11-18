(function(){
  'use strict';
  // Equipped weapons and isolated selector comparison share one attack model.
  const params=new URLSearchParams(window.location.search);
  const combat=window.GardenEnemyPreview.enabled&&params.get('weapons')==='1'&&params.get('attack')!=='0';
  const enabled=window.GardenFairyPatrol.enabled&&(!window.GardenEnemyPreview.enabled||combat)&&
    window.GardenFlowerGrowth.enabled&&params.get('cards')!=='0'&&params.get('cards')!=='legacy';
  const items=window.GardenItemCards.entries.filter(i=>i.id!=='shoe'&&i.id!=='shield');
  const ids=Object.freeze(items.map(i=>i.id));
  const tuning=Object.freeze({
    balloon:{life:1.55,span:22,minFlight:.64,maxFlight:.94,gravity:440,launchHeight:8,splashLife:.58,splashSpan:44,spread:.14},
    boomerang:{life:3.8,span:28,speed:380,minFlight:.46,maxFlight:1.6,curve:65,minCurve:30},wheel:{life:6,span:28,initialSpeed:420,minSpeed:180,drag:1.6},
    flowerpot:{life:1.15,span:22,fall:.52,height:120},'paper-plane':{life:3.2,span:22,speed:310,turn:4.2,minFlight:.55,bank:22},
    'bouncy-ball':{life:3.2,span:22,speed:340,hop:.34,lift:18,chainRange:120},'yellow-floor':{life:2.6,span:44,spread:.32},
    sprinkler:{life:1.9,span:24,radius:44,turn:4,emitInterval:.045,dropLife:.32,start:.12},rock:{life:1.5,span:16,speed:520,gravity:180},broom:{life:2.4,span:44,orbit:26,period:1.2}
  });
  // Model fallback ratios from the cropped approved SVGs. The scene uses the actual
  // measured raster bounds, including the existing diagonal broom normalization.
  const ratios={balloon:.853,boomerang:100/47.6,wheel:100/99.5,flowerpot:100/89.1,'paper-plane':.951,'bouncy-ball':.966,'yellow-floor':100/99.5,sprinkler:100/85.3,rock:100/78,broom:.972,'water-splash':100/41.1};
  function defaultSize(id,span){
    const height=id==='boomerang'?span/Math.max(1,ratios[id]):span;
    const size={width:height*ratios[id],height};
    if(id==='sprinkler'){
      size.pivot={x:.495,y:.379};
      size.nozzles=[{x:97*height/182,y:-49*height/182},{x:-96*height/182,y:-49*height/182},{x:0,y:103*height/182}];
    }
    return size;
  }
  const sizeOf=s=>s.size||defaultSize(s.kind,tuning[s.kind].span);
  const wrapAngle=a=>Math.atan2(Math.sin(a),Math.cos(a));
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const mix=(a,b,t)=>a+(b-a)*t;
  const interval=1.6,range=window.GardenFairyAttack.range;
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  function segmentDistance(a,b,p){
    const dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy;
    const t=den?clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/den,0,1):0;
    return Math.hypot(a.x+t*dx-p.x,a.y+t*dy-p.y);
  }
  // Wheel displacement and angular displacement share a single physical distance.
  // Right/down are clockwise, left/up counter-clockwise in screen coordinates.
  const wheelSign=(dx,dy)=>Math.abs(dx)>=Math.abs(dy)?Math.sign(dx)||1:Math.sign(dy)||1;
  function wheelTravel(s){
    const t=Math.max(0,s.age),w=tuning.wheel;
    // Integral of v(t)=min+(initial-min)*exp(-drag*t). Independent of direction,
    // aim distance and distance to the boundary; residual rolling speed stays positive.
    return w.minSpeed*t+(w.initialSpeed-w.minSpeed)*(1-Math.exp(-w.drag*t))/w.drag;
  }
  function wheelExit(spec,x,y,dx,dy,r){
    const bounds={left:-r-1,right:spec.width+r+1,top:spec.top-r-1,bottom:spec.height-spec.bottom+r+1};
    if(x<bounds.left||x>bounds.right||y<bounds.top||y>bounds.bottom)return 0;
    const times=[];
    if(dx>1e-6)times.push((bounds.right-x)/dx);
    if(dx<-1e-6)times.push((bounds.left-x)/dx);
    if(dy>1e-6)times.push((bounds.bottom-y)/dy);
    if(dy<-1e-6)times.push((bounds.top-y)/dy);
    return Math.max(0,Math.min(...times));
  }
  function potFragments(s){
    const age=s.age-tuning.flowerpot.fall;
    if(age<0)return [];
    const life=tuning.flowerpot.life-tuning.flowerpot.fall,t=clamp(age/life,0,1);
    // Deterministic shards, with ground-plane travel and a ballistic vertical bounce.
    return Array.from({length:12},(_,i)=>{
      const a=i*Math.PI*2/12+(i%3)*.13,velocity=45+(i*37%67),lift=45+(i*19%47);
      const landing=2*lift/340,air=Math.min(age,landing);
      const z=Math.max(0,lift*air-170*air*air);
      const d=velocity*Math.min(age,.24)+velocity*.22*Math.max(0,age-.24);
      return {x:s.tx+Math.cos(a)*d,y:s.ty+Math.sin(a)*d*.45-z,
        angle:a+age*(i%2?8:-9),size:3+i%4,alpha:Math.min(1,(1-t)*3),dark:i%3===0};
    });
  }
  function balloonFlight(distance){
    const c=tuning.balloon;
    return mix(c.minFlight,c.maxFlight,clamp(distance/range,0,1));
  }
  // One continuous arc for short and long throws. Never shift the landing point.
  function balloonHeight(s,u){
    const c=tuning.balloon,flight=s.flight??balloonFlight(distance(s,{x:s.tx,y:s.ty}));
    return c.launchHeight*(1-u)+.5*c.gravity*flight*flight*u*(1-u);
  }
  const bezier=(a,b,c,d,u)=>{const v=1-u;return v*v*v*a+3*v*v*u*b+3*v*u*u*c+u*u*u*d;};
  function boomerangPath(s,hero){
    const cfg=tuning.boomerang,d=distance(s,{x:s.tx,y:s.ty}),flight=s.flight||.85;
    const out=s.age<=flight,u=clamp(out?s.age/flight:(s.age-flight)/(shotLife(s)-flight),0,1);
    const curve=clamp(d*.32,cfg.minCurve,cfg.curve),lead=Math.max(32,d*.42),over=Math.max(18,d*.15);
    const origin={x:s.x,y:s.y},target={x:s.tx,y:s.ty},end=hero?.center||origin;
    const shift=(p,f,n)=>({x:p.x+s.dx*f-s.dy*n,y:p.y+s.dy*f+s.dx*n});
    // Paired cubic tangents agree at the exact target; the minimum bow keeps
    // near throws legible, rather than compressing them into a jittering line.
    const a=out?origin:target,b=out?shift(origin,lead,curve*.42):shift(target,-over,-curve),
      c=out?shift(target,over,curve):shift(end,lead,-curve*.42),z=out?target:end;
    return {x:bezier(a.x,b.x,c.x,z.x,u),y:bezier(a.y,b.y,c.y,z.y,u)};
  }
  function planeFlight(d){return clamp(.42+d/285,tuning['paper-plane'].minFlight,2.4);}
  function planePath(s,age){
    const d=distance(s,{x:s.tx,y:s.ty}),flight=s.flight??planeFlight(d),u=clamp(age/flight,0,1);
    const bend=clamp(d*.12,10,34),lift=clamp(d*.05,6,16);
    const bow=Math.sin(Math.PI*u)**2,derivative=Math.PI*Math.sin(2*Math.PI*u);
    const x=mix(s.x,s.tx,u)-s.dy*bend*bow,y=mix(s.y,s.ty,u)+(s.dx*bend-lift)*bow;
    const vx=s.tx-s.x-s.dy*bend*derivative,vy=s.ty-s.y+(s.dx*bend-lift)*derivative;
    return {x,y,heading:Math.atan2(vy,vx)};
  }
  // Rotating three-arm head, fixed at the hub. A drop retains the angle at
  // emission and moves out from the physical nozzle, not around the hub.
  function sprinklerDrops(s){
    const cfg=tuning.sprinkler,size=sizeOf(s),nozzles=size.nozzles||defaultSize('sprinkler',cfg.span).nozzles;
    const drops=[],last=Math.floor((s.age-cfg.start)/cfg.emitInterval+1e-8);
    if(last<0)return drops;
    const first=Math.max(0,last-Math.ceil(cfg.dropLife/cfg.emitInterval));
    for(let i=first;i<=last;i++){
      const emitted=cfg.start+i*cfg.emitInterval,age=s.age-emitted;
      if(age<0||age>=cfg.dropLife)continue;
      const u=age/cfg.dropLife,rotation=emitted*cfg.turn,c=Math.cos(rotation),n=Math.sin(rotation);
      for(let j=0;j<nozzles.length;j++){
        const q=nozzles[j],nx=q.x*c-q.y*n,ny=q.x*n+q.y*c,r=Math.hypot(nx,ny);
        const a=Math.atan2(ny,nx)+((i+j)%5-2)*.035*u;
        const travel=(cfg.radius-r)*(1-(1-u)**1.25);
        const x=s.tx+nx+Math.cos(a)*travel,y=s.ty+ny+Math.sin(a)*travel;
        drops.push({x,y,angle:a,alpha:Math.min(1,(1-u)*3),size:1.25+u*.65,length:2.6+u*1.4,
          nx:s.tx+nx,ny:s.ty+ny,emitted,arm:j});
      }
    }
    return drops;
  }
  function balloonSplash(s){
    const cfg=tuning.balloon,age=s.age-s.flight;
    if(age<0)return null;
    const u=clamp(age/cfg.spread,0,1),fade=clamp((cfg.splashLife-age)/.2,0,1);
    return {x:s.tx,y:s.ty,scale:.42+.58*(1-(1-u)**3),alpha:fade};
  }
  function balloonDroplets(s){
    const age=s.age-s.flight;
    if(age<0||age>=.38)return [];
    return Array.from({length:12},(_,i)=>{
      const a=i*Math.PI/6+(i%3)*.12,v=65+(i*29%80),lift=55+(i*17%55);
      const air=Math.min(age,2*lift/580),z=Math.max(0,lift*air-290*air*air);
      const d=v*Math.min(age,.23)+v*.22*Math.max(0,age-.23);
      return {x:s.tx+Math.cos(a)*d,y:s.ty+Math.sin(a)*d*.48-z,
        size:1.4+(i%4)*.5,alpha:clamp((.38-age)/.13,0,1)};
    });
  }
  const shotLife=s=>s.life??tuning[s.kind].life;
  // Weapon aim is independent of the collection fan: only its nominal 550px
  // distance is retained. The current visible garden (not the patrol rectangle)
  // is the protected obstacle, including the candidate planting cells.
  const inAttackRange=(point,origin)=>distance(point,origin)<=range+1e-8;
  const installations=new Set(['yellow-floor','sprinkler','broom']);
  const groundAim=new Set(['balloon','flowerpot',...installations]);
  const insideField=(spec,p)=>p.x>=0&&p.x<=spec.width&&p.y>=spec.top&&p.y<=spec.height-spec.bottom;
  const gardenOf=patrol=>patrol?.boundary?.garden||patrol?.bounds||null;
  const expanded=(g,x,y=x)=>({left:g.left-x,right:g.right+x,top:g.top-y,bottom:g.bottom+y});
  const insideRect=(p,g)=>!!g&&p.x>=g.left&&p.x<=g.right&&p.y>=g.top&&p.y<=g.bottom;
  function segmentIntersects(a,b,g){
    if(!g)return false;
    let lo=0,hi=1;
    for(const [k,min,max] of [['x',g.left,g.right],['y',g.top,g.bottom]]){
      const d=b[k]-a[k];
      if(Math.abs(d)<1e-9){if(a[k]<min||a[k]>max)return false;continue;}
      const p=(min-a[k])/d,q=(max-a[k])/d;
      lo=Math.max(lo,Math.min(p,q));hi=Math.min(hi,Math.max(p,q));
      if(lo>hi)return false;
    }
    return true;
  }
  function placementExtent(kind,size){
    if(kind==='yellow-floor')return {x:Math.max(size.width,size.height)/2+1,y:size.height/2+1};
    if(kind==='sprinkler'){
      const p=size.pivot||{x:.5,y:.5};
      const r=Math.max(tuning.sprinkler.radius+3,Math.hypot(size.width*Math.max(p.x,1-p.x),size.height*Math.max(p.y,1-p.y)))+1;
      return {x:r,y:r};
    }
    if(kind==='broom'){
      const diagonal=Math.hypot(size.width,size.height);
      const r=tuning.broom.orbit+Math.max(diagonal/2,diagonal*.4+size.height*.18)+1;
      return {x:r,y:r};
    }
    return null;
  }
  function installationSafe(spec,kind,p,garden,size){
    const e=placementExtent(kind,size);
    return !!e&&p.x-e.x>=0&&p.x+e.x<=spec.width&&p.y-e.y>=spec.top&&p.y+e.y<=spec.height-spec.bottom&&
      (!garden||!insideRect(p,expanded(garden,e.x,e.y)));
  }
  const wheelRadius=size=>Math.max(size.width,size.height)/2;
  function wheelPath(spec,origin,aim,garden,size,heroHeight=40){
    const d=distance(origin,aim);
    if(d<1e-6)return null;
    const dx=(aim.x-origin.x)/d,dy=(aim.y-origin.y)/d,r=wheelRadius(size),offset=heroHeight/2+r+4;
    const start={x:origin.x+dx*offset,y:origin.y+dy*offset};
    const exit=wheelExit(spec,start.x,start.y,dx,dy,r);
    if(exit<=1e-6)return null;
    const end={x:start.x+dx*exit,y:start.y+dy*exit};
    if(garden&&(segmentIntersects(origin,start,garden)||segmentIntersects(start,end,expanded(garden,r+1))))return null;
    return {start,dx,dy,exit,r};
  }
  function validAim(spec,kind,p,origin,garden,size,heroHeight=40,hasEnemy=false){
    if(!insideField(spec,p)||!inAttackRange(p,origin)||distance(p,origin)<1e-6)return false;
    if(kind==='wheel')return !!wheelPath(spec,origin,p,garden,size,heroHeight);
    if(installations.has(kind))return installationSafe(spec,kind,p,garden,size);
    if(!hasEnemy&&(kind==='balloon'||kind==='flowerpot')&&insideRect(p,garden))return false;
    return true;
  }
  function randomPoint(spec,origin,garden,random,kind='rock',size=defaultSize(kind,tuning[kind].span),heroHeight=40){
    const left=Math.max(0,origin.x-range),right=Math.min(spec.width,origin.x+range);
    const top=Math.max(spec.top,origin.y-range),bottom=Math.min(spec.height-spec.bottom,origin.y+range);
    if(!(right>left&&bottom>top))return null;
    const valid=p=>validAim(spec,kind,p,origin,garden,size,heroHeight,false);
    // Wheels sample angle, not screen area: every safe direction is equally
    // likely even on the short sides of the viewport. No inward fan exception.
    if(kind==='wheel'){
      const along=a=>{
        const dx=Math.cos(a),dy=Math.sin(a),times=[range];
        if(dx>1e-9)times.push((right-origin.x)/dx);else if(dx<-1e-9)times.push((left-origin.x)/dx);
        if(dy>1e-9)times.push((bottom-origin.y)/dy);else if(dy<-1e-9)times.push((top-origin.y)/dy);
        const d=Math.min(...times);return d>1e-6?{x:origin.x+dx*d*.9,y:origin.y+dy*d*.9}:null;
      };
      for(let i=0;i<160;i++){const p=along(random()*Math.PI*2);if(p&&valid(p))return p;}
      for(let i=0;i<360;i++){const p=along(i*Math.PI/180);if(p&&valid(p))return p;}
      return null;
    }
    // Uniform area sampling, with deterministic full-field fallback for an
    // injected constant RNG or a very narrow valid placement zone.
    for(let i=0;i<240;i++){
      const p={x:mix(left,right,random()),y:mix(top,bottom,random())};
      if(valid(p))return p;
    }
    for(let y=top+1;y<=bottom;y+=4)for(let x=left+1;x<=right;x+=4){
      const p={x,y};if(valid(p))return p;
    }
    return null;
  }
  function create(spec,random=Math.random,measure=defaultSize){
    const state={selected:'',equipped:[],shots:[],fired:0,hits:0,elapsed:0};
    let serial=0;
    const next=new Map();
    function select(id){
      if(id!==''&&!ids.includes(id))return false;
      state.selected=id;
      state.shots=state.shots.filter(s=>!s.preview);next.delete(-1);return true;
    }
    function equip(index,id){
      if(!Number.isInteger(index)||index<0||index>=9)return false;
      const weapon=ids.includes(id)?id:'';
      if((state.equipped[index]||'')===weapon)return true;
      state.equipped[index]=weapon;next.delete(index);
      if(weapon){state.selected='';next.delete(-1);}
      state.shots=state.shots.filter(s=>s.slot!==index&&!s.preview);
      return true;
    }
    function startLeg(s,x,y,tx,ty,age,speed){
      s.leg={x,y,tx,ty,age,speed,duration:Math.max(.04,Math.hypot(tx-x,ty-y)/speed)};
    }
    function step(dt,hero,targets=[],damage=null,slow=null,patrol=null){
      if(!(dt>0))return;
      state.elapsed+=dt;
      const live=targets.filter(e=>e.x>=0&&e.x<=spec.width&&e.y>=spec.top&&e.y<=spec.height-spec.bottom);
      const dead=new Set(),garden=gardenOf(patrol);
      // Planting may expand the garden while an attack is already active.
      // Remove only ground attacks whose remaining footprint becomes unsafe.
      for(const s of state.shots){
        if(installations.has(s.kind)&&!installationSafe(spec,s.kind,{x:s.tx,y:s.ty},garden,sizeOf(s))){s.done=true;continue;}
        if(s.kind==='wheel'&&garden){
          const p=pose(s,hero),end={x:s.x+s.dx*s.exitDistance,y:s.y+s.dy*s.exitDistance};
          if(segmentIntersects(p,end,expanded(garden,wheelRadius(sizeOf(s))+1))){s.done=true;continue;}
        }
        const previous=s.previous||pose(s,hero),oldAge=s.age;
        s.age=Math.min(shotLife(s),s.age+dt);
        const delta=s.age-oldAge;
        if(s.kind==='paper-plane'){
          const target=live.find(e=>e.id===s.targetId&&!dead.has(e.id));
          if(target&&inAttackRange(target,s.origin)){s.tx=target.x;s.ty=target.y;}
          const cfg=tuning[s.kind],q=s.glide;
          if(s.targetId===null){
            // Empty-field preview is a stable glide with a gentle bow, ending
            // exactly at its randomly selected point.
            Object.assign(q,planePath(s,s.age));
            if(s.age>=s.flight)s.done=true;
          }else{
            const d=Math.hypot(s.tx-q.x,s.ty-q.y);
            const direct=Math.atan2(s.ty-q.y,s.tx-q.x);
            const launch=Math.sin(Math.PI*clamp(s.age/.65,0,1))*.20*Math.min(1,d/80);
            const desired=direct+launch;
            q.heading+=clamp(wrapAngle(desired-q.heading),-cfg.turn*delta,cfg.turn*delta);
            const speed=Math.min(cfg.speed,Math.max(65,d/.42))*(.65+.35*Math.min(1,s.age/.24));
            const travel=speed*delta;
            if(d<=travel&&Math.abs(wrapAngle(direct-q.heading))<.5){q.x=s.tx;q.y=s.ty;if(!target)s.done=true;}
            else{q.x+=Math.cos(q.heading)*travel;q.y+=Math.sin(q.heading)*travel;}
          }
        }
        const p=pose(s,hero);
        if(!s.preview&&damage){
          const candidates=live.filter(e=>!dead.has(e.id)&&!s.hit.has(e.id));
          const area=s.kind==='balloon'||s.kind==='flowerpot';
          const hits=candidates.filter(e=>{
            const r=e.radius||0;
            if(s.kind==='balloon'){
              const q=s.splashSize||defaultSize('water-splash',tuning.balloon.splashSpan);
              return !s.burstDone&&s.age>=s.flight&&Math.hypot((e.x-p.x)/(q.width/2+r),((e.ground??e.y)-p.y)/(q.height/2+r))<=1;
            }
            if(area)return p.ring>0&&distance(p,e)<=p.ring+r;
            if(s.kind==='yellow-floor')return distance(p,e)<=sizeOf(s).height*p.scale/2+r;
            if(s.kind==='wheel')return segmentDistance(previous,p,e)<=sizeOf(s).height/2+r;
            if(s.kind==='sprinkler')return s.age>=.15&&distance(p,e)<=tuning.sprinkler.radius+r;
            if(s.kind==='broom'){
              const reach=Math.hypot(sizeOf(s).width,sizeOf(s).height)*.4;
              const tip=q=>({x:q.x+Math.cos(q.angle+3*Math.PI/4)*reach,y:q.y+Math.sin(q.angle+3*Math.PI/4)*reach});
              const handle=q=>({x:q.x-Math.cos(q.angle+3*Math.PI/4)*reach,y:q.y-Math.sin(q.angle+3*Math.PI/4)*reach});
              return Math.min(segmentDistance(previous,p,e),segmentDistance(tip(previous),tip(p),e),segmentDistance(handle(p),tip(p),e),segmentDistance(handle(previous),tip(previous),e))<=sizeOf(s).height*.18+r;
            }
            return segmentDistance(previous,p,e)<=Math.min(sizeOf(s).width,sizeOf(s).height)*.4+r;
          }).sort((a,b)=>distance(previous,a)-distance(previous,b));
          if(s.kind==='yellow-floor'){
            for(const e of hits)slow?.(e.id,.3,.25);
          }else{
            const single=['rock','paper-plane','bouncy-ball'].includes(s.kind);
            for(const e of single?hits.slice(0,1):hits){
              const result=damage(e.id,1);
              if(!result)continue;
              s.hit.add(e.id);state.hits++;
              if(result.killed)dead.add(e.id);
              if(s.kind==='bouncy-ball'){
                const options=live.filter(q=>q.id!==e.id&&!dead.has(q.id)&&!s.hit.has(q.id)&&distance(p,q)<=tuning['bouncy-ball'].chainRange&&inAttackRange(q,s.origin));
                const other=options[Math.floor(random()*options.length)];
                if(other&&s.hit.size<3){
                  const speed=Math.max(180,s.leg.speed*.82);
                  startLeg(s,p.x,p.y,other.x,other.y,s.age,speed);s.targetId=other.id;
                }else s.done=true;
              }else if(single)s.done=true;
            }
          }
        }
        if(s.kind==='balloon'&&s.age>=s.flight)s.burstDone=true;
        if(s.kind==='bouncy-ball'&&s.age>=s.leg.age+s.leg.duration+.08)s.done=true;
        s.previous=p;
      }
      state.shots=state.shots.filter(s=>!s.done&&s.age<shotLife(s)&&
        (s.kind!=='wheel'||wheelTravel(s)<s.exitDistance));
      if(!hero||hero.index!==0||hero.type!=='garden'||!patrol?.bounds)return;
      const slots=state.equipped.flatMap((id,index)=>id?[{id,index,preview:false}]:[]);
      if(!slots.length&&state.selected)slots.push({id:state.selected,index:-1,preview:true});
      for(const slot of slots){
        if(state.elapsed<(next.get(slot.index)||0))continue;
        const x=hero.center.x,y=hero.center.y,origin={x,y},bounds={...patrol.bounds};
        const cfg=tuning[slot.id],size=measure(slot.id,cfg.span),heroHeight=hero.visibleHeight||40;
        // Ground effects use the actual ground coordinate, never the projected
        // airborne sprite center as a fallback for a forbidden installation.
        const aimOf=e=>({x:e.x,y:groundAim.has(slot.id)&&Number.isFinite(e.ground)?e.ground:e.y});
        const options=!slot.preview&&damage?live.filter(e=>!dead.has(e.id)&&validAim(spec,slot.id,aimOf(e),origin,garden,size,heroHeight,true)):[];
        const target=options[Math.floor(random()*options.length)]||null;
        const aim=target?aimOf(target):randomPoint(spec,origin,garden,random,slot.id,size,heroHeight);
        if(!aim)continue;
        const tx=aim.x,ty=aim.y,d=Math.hypot(tx-x,ty-y)||1,dx=(tx-x)/d,dy=(ty-y)/d;
        const shot={id:serial++,owner:0,slot:slot.index,preview:slot.preview,kind:slot.id,x,y,tx,ty,dx,dy,origin,bounds,age:0,targetId:target?.id??null,hit:new Set(),size,span:cfg.span};
        if(slot.id==='balloon'){
          shot.launchY=y+heroHeight*.30;
          shot.flight=balloonFlight(d);shot.life=shot.flight+tuning.balloon.splashLife;
          shot.splashSize=measure('water-splash',cfg.splashSpan);
        }
        if(slot.id==='boomerang'){
          shot.flight=clamp(.12+d/cfg.speed,cfg.minFlight,cfg.maxFlight);shot.life=shot.flight*2;
        }
        if(slot.id==='paper-plane'){
          shot.flight=planeFlight(d);
          if(shot.targetId===null)shot.life=shot.flight;
          shot.glide={x,y,heading:Math.atan2(dy,dx)};
        }
        if(slot.id==='bouncy-ball')startLeg(shot,x,y,tx,ty,0,cfg.speed);
        if(slot.id==='rock')shot.life=Math.max(.06,d/cfg.speed);
        if(slot.id==='wheel'){
          const path=wheelPath(spec,origin,aim,garden,size,heroHeight);
          if(!path)continue;
          shot.x=path.start.x;shot.y=path.start.y;shot.exitDistance=path.exit;
        }
        state.shots.push(shot);
        state.fired++;next.set(slot.index,state.elapsed+interval);
      }
    }
    return {state,select,equip,step};
  }
  // In the hidden-enemy mode the target is an invisible preview point.
  function pose(s,hero){
    const t=clamp(s.age/shotLife(s),0,1),a=Math.atan2(s.dy,s.dx);
    const px=-s.dy,py=s.dx;let x=mix(s.x,s.tx,t),y=mix(s.y,s.ty,t),angle=0,alpha=1,scale=1,ring=0,kind=s.kind;
    switch(kind){
      case 'balloon':{
        const cfg=tuning.balloon,flight=s.flight??balloonFlight(distance(s,{x:s.tx,y:s.ty}));
        const u=clamp(s.age/flight,0,1);
        x=mix(s.x,s.tx,u);
        // Constant horizontal velocity on the ground plane and constant gravity in height.
        const height=balloonHeight(s,u);
        y=mix(s.launchY??s.y,s.ty,u)-height-cfg.span/2;angle=s.dx*.16*Math.sin(Math.PI*u);
        if(u>=1){x=s.tx;y=s.ty;alpha=0;ring=(s.splashSize||defaultSize('water-splash',cfg.splashSpan)).width/2;}
        break;
      }
      case 'boomerang':{
        const q=boomerangPath(s,hero);x=q.x;y=q.y;angle=s.age*18;break;
      }
      case 'wheel':{
        const d=Math.min(wheelTravel(s),s.exitDistance??Infinity),r=(s.span??tuning.wheel.span)/2;
        x=s.x+s.dx*d;y=s.y+s.dy*d;angle=wheelSign(s.dx,s.dy)*d/r;
        break;
      }
      case 'flowerpot':{
        const cfg=tuning.flowerpot,u=clamp(s.age/cfg.fall,0,1);
        x=s.tx;y=s.ty-cfg.span/2-cfg.height*(1-u*u);
        if(u>=1){y=s.ty;alpha=0;ring=38;}
        break;
      }
      case 'paper-plane':{
        const q=s.glide||{x:s.x,y:s.y,heading:a};
        x=q.x;y=q.y;angle=q.heading+Math.PI/2;break;
      }
      case 'bouncy-ball':{
        const leg=s.leg||{x:s.x,y:s.y,tx:s.tx,ty:s.ty,age:0,duration:1};
        const u=clamp((s.age-leg.age)/leg.duration,0,1);
        const hops=Math.max(1,Math.round(leg.duration/tuning['bouncy-ball'].hop));
        x=mix(leg.x,leg.tx,u);y=mix(leg.y,leg.ty,u)-Math.abs(Math.sin(Math.PI*u*hops))*tuning['bouncy-ball'].lift;
        angle=(s.age-leg.age)*7;break;
      }
      case 'yellow-floor':{
        const u=clamp(s.age/tuning['yellow-floor'].spread,0,1);
        x=s.tx;y=s.ty;scale=.08+.92*(1-(1-u)**3);alpha=t>.85?(1-t)/.15:1;
        break;
      }
      case 'sprinkler':{
        x=s.tx;y=s.ty;angle=s.age*tuning.sprinkler.turn;break;
      }
      case 'rock':{
        // Short ballistic bow with constant ground-plane speed and modest spin.
        y-=.5*tuning.rock.gravity*shotLife(s)**2*t*(1-t);angle=s.age*4;break;
      }
      case 'broom':{
        const cfg=tuning.broom,sweep=a+s.age*2*Math.PI/cfg.period;
        x=s.tx+Math.cos(sweep)*cfg.orbit;y=s.ty+Math.sin(sweep)*cfg.orbit;
        angle=sweep-3*Math.PI/4;break;
      }
    }
    return {x,y,angle,alpha,scale,ring,t};
  }
  function attach(scene,spec,patrol){
    if(!enabled)return null;
    const I=window.GardenItemCards,P=window.GardenPalette,model=create(spec,Math.random,(id,height)=>I.attackSize(scene,id,height)),images=new Map();
    const clip=scene.make.graphics({x:0,y:0,add:false});
    clip.fillStyle(0xffffff,1).fillRect(0,spec.top,spec.width,spec.height-spec.top-spec.bottom);
    const mask=clip.createGeometryMask();
    const fx=scene.add.graphics().setDepth(6).setMask(mask).setName('hero-weapon:effects');
    const groundFx=scene.add.graphics().setDepth(.8).setMask(mask).setName('hero-weapon:ground-effects');
    const select=document.createElement('select');select.id='hero-weapon-select';
    select.setAttribute('aria-label','나뭇잎 요정 무기');
    for(const item of [{id:'',name:'무기 선택 (없음)'},...items]){
      const option=document.createElement('option');option.value=item.id;option.textContent=item.name;select.appendChild(option);
    }
    const parent=document.getElementById('game');
    Object.assign(select.style,{position:'absolute',zIndex:'2',right:'1.05%',top:'9.6%',width:'17%',height:'4.8%',
      color:P.hex.paper,background:P.hex.graphite,border:'1px solid '+P.hex.slate,fontFamily:'Garden Fusion, sans-serif',padding:'0 4px'});
    function resize(){select.style.fontSize=Math.max(8,parent.clientWidth/spec.width*12)+'px';}
    parent.appendChild(select);resize();
    function choose(id){if(!model.select(id))return false;select.value=id;render();return true;}
    function equip(index,id){if(!model.equip(index,id))return false;select.disabled=model.state.equipped.some(Boolean);select.value=model.state.selected;render();return true;}
    select.addEventListener('change',()=>{choose(select.value);select.blur();});
    const pause=()=>{select.blur();select.hidden=true;};
    const resume=()=>{select.hidden=false;};
    // The native control must not swallow the game's Escape pause action.
    select.addEventListener('keydown',e=>{if(e.key==='Escape')select.blur();});
    function render(){
      fx.clear();groundFx.clear();const live=new Set(),hero=patrol.actors[0];
      for(const s of model.state.shots){
        live.add(s.id);
        const splash=s.kind==='balloon'?balloonSplash(s):null;
        let obj=images.get(s.id);
        const phase=splash?'splash':'flight';
        if(!obj||obj.phase!==phase){
          if(obj)I.destroyRelic(obj.image);
          const image=(splash?I.effectImage(scene,'water-splash',s.tx,s.ty,tuning.balloon.splashSpan):
            I.weaponImage(scene,s.kind,s.x,s.y,s.span??tuning[s.kind].span))
            .setDepth(splash?.82:s.kind==='yellow-floor'?.8:['broom','sprinkler'].includes(s.kind)?1.8:6).setMask(mask)
            .setName('hero-weapon:'+s.kind+':'+(splash?'splash:':'')+s.id);
          obj={image,phase,width:image.displayWidth,height:image.displayHeight};images.set(s.id,obj);
        }
        const p=pose(s,hero),visible=splash||p;
        obj.image.setPosition(visible.x,visible.y).setRotation(splash?0:p.angle).setAlpha(visible.alpha)
          .setDisplaySize(obj.width*visible.scale,obj.height*visible.scale);
        if(s.kind==='balloon'){
          if(!splash){
            const u=clamp(s.age/s.flight,0,1);
            groundFx.fillStyle(P.n.ink,.20+.20*u).fillEllipse(mix(s.x,s.tx,u),mix(s.launchY??s.y,s.ty,u),10+5*u,4+2*u);
          }else{
            for(const part of balloonDroplets(s)){
              fx.fillStyle(P.n.sky,part.alpha).fillEllipse(part.x,part.y,part.size*1.6,part.size*2.2);
              fx.fillStyle(P.n.skyLight,part.alpha*.85).fillCircle(part.x-.4,part.y-.5,part.size*.45);
            }
          }
        }else if(s.kind==='flowerpot'){
          if(s.age<tuning.flowerpot.fall){
            const u=clamp(s.age/tuning.flowerpot.fall,0,1);
            fx.fillStyle(P.n.ink,.15+.25*u).fillEllipse(s.tx,s.ty,13+6*u,4+2*u);
          }else{
            for(const part of potFragments(s)){
              const c=Math.cos(part.angle),n=Math.sin(part.angle),r=part.size;
              fx.fillStyle(part.dark?P.n.bark:P.n.clay,part.alpha).fillTriangle(
                part.x+c*r,part.y+n*r,part.x-c*r*.8-n*r*.6,part.y-n*r*.8+c*r*.6,
                part.x-c*r*.6+n*r*.7,part.y-n*r*.6-c*r*.7);
            }
          }
        }else if(s.kind==='sprinkler'){
          // A fixed ground hub; the SVG head spins about its true central cap.
          groundFx.fillStyle(P.n.ink,.3).fillEllipse(s.tx,s.ty,18,10);
          for(const part of sprinklerDrops(s)){
            const dx=Math.cos(part.angle)*part.length/2,dy=Math.sin(part.angle)*part.length/2;
            fx.lineStyle(part.size,P.n.sky,part.alpha).lineBetween(part.x-dx,part.y-dy,part.x+dx,part.y+dy);
            fx.fillStyle(P.n.skyLight,part.alpha*.88).fillCircle(part.x+dx*.45,part.y+dy*.45,part.size*.45);
          }
        }else if(s.kind==='broom'){
          // The deployment point is stationary even while the fairy patrols.
          groundFx.fillStyle(P.n.stone,.28).fillCircle(s.tx,s.ty,3);
          groundFx.fillStyle(P.n.ink,.2).fillEllipse(p.x,p.y+8,20,5);
        }else if(p.ring){
          const c=s.kind==='flowerpot'?P.n.clay:P.n.skyLight;
          fx.lineStyle(1.5,c,Math.max(.15,1-p.t)).strokeCircle(p.x,p.y,p.ring);

        }
      }
      for(const [id,obj] of images)if(!live.has(id)){I.destroyRelic(obj.image);images.delete(id);}
    }
    // Equipped attacks use the live enemy population only in the explicit combat mode.
    function update(_time,delta){
      if(patrol.finished)return;
      const population=combat?scene.enemyPreview?.model:null;
      const targets=population?population.actors.map(a=>({...window.GardenFairyAttack.target(a),ground:a.pose.ground})):[];
      model.step(Math.min(.1,Math.max(0,delta/1000)),patrol.actors[0],targets,population?.damage,population?.slow,patrol);
      render();
    }
    scene.events.on('update',update);scene.events.on('pause',pause);scene.events.on('resume',resume);scene.scale.on('resize',resize);
    scene.events.once('shutdown',()=>{
      scene.events.off('update',update);scene.events.off('pause',pause);scene.events.off('resume',resume);scene.scale.off('resize',resize);
      select.remove();images.clear();mask.destroy();clip.destroy();delete scene.heroWeaponPreview;
    });
    scene.heroWeaponPreview={model,select:choose,equip,render,control:select};
    return scene.heroWeaponPreview;
  }
  window.GardenHeroWeaponPreview=Object.freeze({enabled,combat,ids,tuning,interval,range,create,pose,defaultSize,wheelTravel,wheelExit,wheelPath,placementExtent,installationSafe,segmentIntersects,validAim,randomPoint,inAttackRange,potFragments,balloonFlight,balloonHeight,balloonSplash,balloonDroplets,boomerangPath,planeFlight,planePath,sprinklerDrops,attach});
}());
