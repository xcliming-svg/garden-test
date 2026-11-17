(function(){
  'use strict';
  // Preview timing, not combat stats. Smaller deformation at larger spans.
  // hz, bob, rock, squash, lift, moveTime, reach, windup, strike, impactLift, attackTilt.
  const profiles=Object.freeze(Object.fromEntries(Object.entries({
    '3_caterpillar':[1.15,.35,.7,.024,0,7.0,19,.45,.42,0,3],
    '4_beetle':[2.0,.40,.8,.009,0,5.6,22,.35,.29,0,4],
    '6_mouse':[2.5,.45,.75,.005,0,4.8,26,.32,.26,0,4],
    '2_grasshopper':[1.05,.25,1.8,.025,9,6.0,28,.38,.50,18,8],
    '2_frog':[.8,.25,1.0,.020,11,7.0,30,.48,.58,22,2],
    '6_rabbit':[1.10,.25,1.2,.008,12,6.0,35,.40,.48,24,5],
    '2_gray_bug':[1.6,.30,1.1,.012,0,6.2,42,.48,.28,0,8],
    '1_cat':[1.35,.30,.65,.004,0,6.0,48,.60,.29,0,5],
    '5_bulldog':[1.65,.40,.55,.003,0,5.5,56,.58,.34,0,5],
    '1_butterfly':[3.0,4.5,2.0,0,32,5.8,27,.40,.55,8,7],
    '6_sparrow':[3.6,2.8,1.4,0,42,4.5,34,.35,.40,11,8],
    '6_pigeon':[2.4,3.4,1.2,0,48,5.2,39,.45,.48,12,7]
  }).map(([id,v])=>[id,Object.freeze({hz:v[0],bob:v[1],rock:v[2],squash:v[3],lift:v[4],moveTime:v[5],reach:v[6],windup:v[7],strike:v[8],impactLift:v[9],attackTilt:v[10]})])));
  const modes=Object.freeze(['auto','move','attack']),clamp=x=>Math.max(0,Math.min(1,x)),smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
  const lerp=(a,b,t)=>a+(b-a)*t,pi=Math.PI;
  function wing(e,t){
    if(e.attackType!=='fly')return 0;
    const p=profiles[e.id];
    // Alternating flutter/glide with a slow bank, independently of body scale.
    const envelope=e.id==='1_butterfly'?1:.5+.5*Math.sin(t*2*pi*.48)**2;
    return Math.round(2*Math.sin(t*p.hz*2*pi)*envelope);
  }
  function gait(e,t,progress,returning,route,destination){
    const p=profiles[e.id],phase=t*p.hz*2*pi,wave=Math.sin(phase),direction=returning?-1:1;
    let lift=0,angle=wave*p.rock,sx=1,sy=1,drift=0;
    let travel=clamp(progress);
    if(e.attackType==='jump'){
      const steps=Math.max(1,Math.round(p.moveTime*p.hz)),n=travel*steps,k=Math.min(steps-1,Math.floor(n)),u=travel===1?1:n-k;
      // Soft forward progression: small planted intervals, no exaggerated bounce or stretching.
      travel=(k+.6*u+.4*smooth(u))/steps;
      lift=Math.sin(pi*u)**2*p.lift;angle=Math.sin(2*pi*u)*p.rock;
      sx=1+p.squash*Math.cos(2*pi*u);sy=1-p.squash*Math.cos(2*pi*u);
    }else if(e.attackType==='fly'){
      // Flight altitude is independent of ground motion. Slow sweeping flight path.
      const arch=Math.sin(pi*travel)**2,slow=Math.sin(2*pi*travel);
      lift=p.lift+p.bob*wave+(e.id==='1_butterfly'?11:16)*arch;
      drift=(e.id==='1_butterfly'?12:8)*slow;
      angle=-direction*(1.5+p.rock*slow);
    }else{
      lift=Math.abs(wave)*p.bob;
      sx=1+p.squash*wave;sy=1-p.squash*wave;
    }
    const x=returning?lerp(destination,route.start,travel):lerp(route.start,destination,travel);
    return {phase:returning?'return':'move',x,lift,angle:angle*direction,sx,sy,drift,wing:wing(e,t),flip:returning&&e.id!=='2_frog'};
  }
  function duration(e,mode){
    const p=profiles[e.id],attack=p.windup+p.strike+.85;
    return mode==='move'?2*p.moveTime:mode==='attack'?attack+.85:2*p.moveTime+attack;
  }
  function sample(e,mode,time,route){
    const p=profiles[e.id],recovery=.85,moveTime=p.moveTime;
    let t=((time%duration(e,mode))+duration(e,mode))%duration(e,mode);
    if(mode==='move')return t<moveTime?gait(e,t,t/moveTime,false,route,route.target):gait(e,t-moveTime,(t-moveTime)/moveTime,true,route,route.target);
    if(mode==='auto'){
      if(t<moveTime)return gait(e,t,t/moveTime,false,route,route.stage);
      t-=moveTime;
    }
    const fly=e.attackType==='fly',jump=e.attackType==='jump',charge=e.attackType==='charge',baseLift=fly?p.lift:0;
    const deformation=e.span>=42?.45:1;
    const pose=(phase,x,lift,angle,sx,sy)=>({phase,x,lift,angle,sx:1+(sx-1)*deformation,sy:1+(sy-1)*deformation,drift:0,wing:wing(e,time),flip:false});
    if(t<p.windup){
      const u=smooth(t/p.windup);
      return pose('windup',route.stage+4*u,baseLift*(1+.12*u),p.attackTilt*.45*u,1+.025*u,1-(jump?.08:.035)*u);
    }
    t-=p.windup;
    if(t<p.strike){
      const u=clamp(t/p.strike),v=charge?u*u:smooth(u),arc=Math.sin(pi*u);
      const lift=jump?p.impactLift*arc:fly?baseLift*(1+.12*(1-u))*(1-v):0;
      return pose('strike',lerp(route.stage+4,route.target,v),lift,p.attackTilt*(.45*(1-u)-arc),1+.025*(1-u)+.035*arc,1-(jump?.08:.035)*(1-u)-.02*arc);
    }
    t-=p.strike;
    if(t<recovery){
      const u=clamp(t/recovery),pulse=Math.sin(pi*u);
      return pose('recover',lerp(route.target,route.stage,smooth(u)),baseLift*smooth(u),-p.attackTilt*.20*pulse,1+.012*pulse,1-.025*pulse);
    }
    t-=recovery;
    if(mode==='auto')return gait(e,t,t/moveTime,true,route,route.stage);
    return pose('ready',route.stage,baseLift,0,1,1);
  }
  window.GardenEnemyMotion=Object.freeze({profiles,modes,sample,duration});
}());
