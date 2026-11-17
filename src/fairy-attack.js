(function(){
  'use strict';
  // Temporary combat tuning for the current 11-fairy/12-enemy comparison.
  // Pure combat state and collision geometry are independent of display alpha/depth.
  const enabled=new URLSearchParams(window.location.search).get('attack')!=='0';
  const tuning=Object.freeze({interval:1,firstShot:.2,stagger:.08,speed:220,radius:3,life:2.5,damage:1,hitSeconds:.12,deathSeconds:.14,depth:6,step:.05,
    counts:Object.freeze({garden:5,water:2}),colors:Object.freeze({garden:'red',water:'gold'})});
  const target=actor=>{
    const p=actor.pose,e=actor.entry;
    return {id:actor.id,x:p.x,y:p.ground-e.height*p.sy/2-p.lift,
      radius:Math.min(e.width*Math.abs(p.sx),e.height*Math.abs(p.sy))*.42};
  };
  function create(spec){
    const field={left:0,right:spec.width,top:spec.top,bottom:spec.height-spec.bottom};
    const inside=p=>p.x>=field.left&&p.x<=field.right&&p.y>=field.top&&p.y<=field.bottom;
    const hitTime=window.GardenCombatPreview.hitTime;
    const state={elapsed:0,bullets:[],deaths:[],shotsFired:0,hits:0,kills:0,volleys:0,byShooter:{},lastVolleys:{}};
    const next=new Map();let serial=0;
    function fire(shooter,targets){
      if(!inside(shooter))return;
      let nearest=null,dist=Infinity;
      for(const e of targets){
        if(!inside(e))continue;
        const d=(e.x-shooter.x)**2+(e.y-shooter.y)**2;
        if(d<dist){nearest=e;dist=d;}
      }
      if(!nearest)return;
      const angle=Math.atan2(nearest.y-shooter.y,nearest.x-shooter.x);
      const count=tuning.counts[shooter.type],volley=[];
      for(let i=0;i<count;i++){
        const a=angle+i*2*Math.PI/count;
        const b={id:serial++,owner:shooter.index,type:shooter.type,x:shooter.x,y:shooter.y,vx:Math.cos(a)*tuning.speed,vy:Math.sin(a)*tuning.speed,age:0};
        state.bullets.push(b);volley.push({...b});
      }
      state.shotsFired+=count;state.volleys++;
      state.byShooter[shooter.index]=(state.byShooter[shooter.index]||0)+count;
      state.lastVolleys[shooter.index]=volley;
    }
    function step(dt,shooters,targets,oldTargets,damage){
      if(!(dt>0))return state;
      state.elapsed+=dt;
      for(const d of state.deaths)d.age+=dt;
      state.deaths=state.deaths.filter(d=>d.age<tuning.deathSeconds);
      const killed=new Set();
      // Continuous relative segment test against each moving target circle.
      // A projectile hits only its earliest target and cannot pierce.
      for(const b of state.bullets){
        const x=b.x,y=b.y;b.x+=b.vx*dt;b.y+=b.vy*dt;b.age+=dt;
        let earliest=Infinity,hit=null;
        for(const e of targets){
          if(killed.has(e.id)||!inside(e))continue;
          const old=oldTargets.get(e.id)||e;
          const t=hitTime(x-old.x,y-old.y,b.x-e.x,b.y-e.y,e.radius+tuning.radius);
          if(t<earliest){earliest=t;hit=e;}
        }
        if(hit){
          const result=damage(hit.id,tuning.damage);
          if(result){
            b.dead=true;state.hits++;
            if(result.killed){killed.add(hit.id);state.kills++;state.deaths.push({x:hit.x,y:hit.y,age:0});}
          }
        }
        if(b.age>=tuning.life||!inside(b))b.dead=true;
      }
      state.bullets=state.bullets.filter(b=>!b.dead);
      const alive=targets.filter(e=>!killed.has(e.id));
      for(const shooter of shooters){
        if(!next.has(shooter.index))next.set(shooter.index,tuning.firstShot+shooter.index*tuning.stagger);
        if(state.elapsed+1e-8>=next.get(shooter.index)){
          fire(shooter,alive);
          next.set(shooter.index,next.get(shooter.index)+tuning.interval);
        }
      }
      return state;
    }
    return {state,step};
  }
  function attach(scene,spec,patrol,population,mask){
    const model=create(spec),gfx=scene.add.graphics().setDepth(tuning.depth).setMask(mask).setName('fairy-attack:projectiles');
    const positions=()=>population.actors.map(target);
    function step(dt,previous){
      const shooters=patrol.actors.map(a=>({index:a.index,type:a.type,x:a.center.x,y:a.center.y}));
      return model.step(dt,shooters,positions(),previous,population.damage);
    }
    function render(){
      const P=window.GardenPalette.n;gfx.clear();
      for(const b of model.state.bullets){
        gfx.fillStyle(P.bark,1).fillCircle(b.x,b.y,tuning.radius);
        gfx.fillStyle(P[tuning.colors[b.type]],1).fillCircle(b.x,b.y,tuning.radius-.7);
        gfx.fillStyle(P.paper,.8).fillCircle(b.x-.65,b.y-.65,.65);
      }
      for(const d of model.state.deaths){
        const t=d.age/tuning.deathSeconds;
        gfx.lineStyle(1,P.paper,.65*(1-t)).strokeCircle(d.x,d.y,4+6*t);
      }
    }
    return {model,state:model.state,gfx,positions,step,render};
  }
  window.GardenFairyAttack=Object.freeze({enabled,tuning,target,create,attach});
}());
