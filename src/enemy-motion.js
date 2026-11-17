(function(){
  'use strict';
  // Single-art motion design. Distances and timing are preview values, not combat stats.
  // hz, bob, rock, squash, lift, baseSpeed (logical px/s), reach, windup, strike, impactLift, attackTilt.
  const profiles=Object.freeze(Object.fromEntries(Object.entries({
    '3_caterpillar':[2.0,.7,2,.055,0,20,19,.42,.38,0,5],
    '4_beetle':[4.0,.8,3,.018,0,26,22,.32,.24,0,7],
    '6_mouse':[4.8,1.3,3.5,.025,0,36,26,.26,.20,0,9],
    '2_grasshopper':[1.8,.5,5,.06,12,36,28,.30,.42,20,13],
    '2_frog':[1.35,.5,3,0.05,15,38,30,.40,.50,24,2],
    '6_rabbit':[2.25,.6,6,.05,18,44,35,.30,.40,27,12],
    '2_gray_bug':[3.2,.6,4,.04,0,24,42,.42,.23,0,15],
    '1_cat':[2.6,0.65,2.2,.035,0,30,48,.52,.22,0,9],
    '5_bulldog':[3.8,0,0,0,0,36,56,.48,.27,0,11],
    '1_butterfly':[4.8,2.2,5,.018,15,40,27,.27,.37,8,12],
    '6_sparrow':[5.2,1.0,3,.015,18,46,34,.23,.26,11,16],
    '6_pigeon':[3.2,1.5,3,.018,20,48,39,.33,.34,12,11]
  }).map(([id,v])=>[id,Object.freeze({hz:v[0],bob:v[1],rock:v[2],squash:v[3],lift:v[4],baseSpeed:v[5],reach:v[6],windup:v[7],strike:v[8],impactLift:v[9],attackTilt:v[10]})])));
  const modes=Object.freeze(['auto','move','attack']),clamp=x=>Math.max(0,Math.min(1,x)),smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
  const lerp=(a,b,t)=>a+(b-a)*t,pi=Math.PI;
  const speed=(e,rank=0)=>window.GardenFairyPatrol.speedAt(profiles[e.id].baseSpeed,rank);
  const travelTime=(e,route,rank=0,mode='auto')=>Math.max(.01,Math.abs(route.start-(mode==='move'?route.target:route.stage))/speed(e,rank));
  function duration(e,mode,route,rank=0){const p=profiles[e.id],move=travelTime(e,route,rank,mode),attack=p.windup+p.strike+.55;return mode==='move'?2*move:mode==='attack'?attack+.8:2*move+attack;}
  function gait(e,t,progress,returning,route,moveTime){
    const p=profiles[e.id],phase=t*p.hz*2*pi,wave=Math.sin(phase);
    const direction=returning?-1:1;
    let lift=0,angle=wave*p.rock,sx=1,sy=1;
    let travel=clamp(progress);
    if(e.attackType==='jump'){
      const steps=Math.max(1,Math.round(moveTime*p.hz)),n=travel*steps,k=Math.min(steps-1,Math.floor(n)),u=travel===1?1:n-k;
      travel=(k+smooth(u))/steps;lift=Math.sin(pi*u)*p.lift;angle=Math.sin(2*pi*u)*p.rock;
      sx=1+p.squash*Math.cos(2*pi*u);sy=1-p.squash*Math.cos(2*pi*u);
    }else if(e.attackType==='fly'){
      lift=p.lift+p.bob*wave;angle=p.rock*Math.sin(phase*.65);
      sx=1+p.squash*wave;sy=1-p.squash*wave;
    }else{
      lift=Math.abs(wave)*p.bob;
      sx=1+p.squash*wave;sy=1-p.squash*wave;
    }
    // Original art faces left (frog faces front); mirror only for retreat.
    const x=returning?lerp(route.stage,route.start,travel):lerp(route.start,route.stage,travel);
    return {phase:returning?'return':'move',x,lift,angle:angle*direction,sx,sy,flip:returning&&e.id!=='2_frog'};
  }
  function sample(e,mode,time,route,rank=0){
    const p=profiles[e.id],recovery=.55,retreat=.8;
    const moveTime=travelTime(e,route,rank,mode),period=duration(e,mode,route,rank);
    let t=((time%period)+period)%period;
    if(mode==='move'){
      const path={...route,stage:route.target};
      return t<moveTime?gait(e,t,t/moveTime,false,path,moveTime):gait(e,t-moveTime,(t-moveTime)/moveTime,true,path,moveTime);
    }
    if(mode==='auto'){
      if(t<moveTime)return gait(e,t,t/moveTime,false,route,moveTime);
      t-=moveTime;
    }
    const fly=e.attackType==='fly',jump=e.attackType==='jump',charge=e.attackType==='charge',baseLift=fly?p.lift:0;
    const pose=(phase,x,lift,angle,sx,sy)=>({phase,x,lift,angle,sx,sy,flip:false});
    if(t<p.windup){
      const u=smooth(t/p.windup);
      return pose('windup',route.stage+5*u,baseLift*(1+.20*u),p.attackTilt*.45*u,1+.05*u,1-(jump?.14:.07)*u);
    }
    t-=p.windup;
    if(t<p.strike){
      const u=clamp(t/p.strike),v=charge?u*u:smooth(u),arc=Math.sin(pi*u);
      const lift=jump?p.impactLift*arc:fly?baseLift*(1+.2*(1-u))*(1-v):0;
      return pose('strike',lerp(route.stage+5,route.target,v),lift,p.attackTilt*(.45*(1-u)-arc),1+.05*(1-u)+.07*arc,1-(jump?.14:.07)*(1-u)-.04*arc);
    }
    t-=p.strike;
    if(t<recovery){
      const u=clamp(t/recovery),pulse=Math.sin(pi*u);
      return pose('recover',lerp(route.target,route.stage,smooth(u)),baseLift*smooth(u),-p.attackTilt*.28*pulse,1+.035*pulse,1-.06*pulse);
    }
    t-=recovery;
    if(mode==='auto')return gait(e,t,t/moveTime,true,route,moveTime);
    return pose('ready',route.stage,baseLift,0,1,1);
  }
  window.GardenEnemyMotion=Object.freeze({profiles,modes,sample,speed,travelTime,duration});
}());
