(function(){
  'use strict';
  // Survival-only deterministic timeline. Minute marks and speeds are trial values,
  // not approved balance targets. Normal enemy motion remains untouched.
  const bosses=Object.freeze({
    beetle:Object.freeze({enemy:'4_beetle',label:'왕딱정벌레',speed:15,size:2.2,hpFactor:10,summons:[]}),
    frog:Object.freeze({enemy:'2_frog',label:'개구리 왕',speed:17,size:2.35,hpFactor:13,summons:['2_frog','3_caterpillar']}),
    pigeon:Object.freeze({enemy:'6_pigeon',label:'비둘기 대장',speed:19,size:2.4,hpFactor:16,summons:['6_sparrow','6_pigeon']}),
    bulldog:Object.freeze({enemy:'5_bulldog',label:'불독 대장',speed:14,size:2.3,hpFactor:19,summons:['6_rabbit','5_bulldog']}),
    monarch:Object.freeze({enemy:'4_beetle',label:'정원 침공 대장',speed:12,size:3,hpFactor:30,summons:['6_mouse','6_sparrow','5_bulldog']})
  });
  const raids=Object.freeze({
    swarm:Object.freeze({label:'해충 대이동',pattern:'pack',enemies:['3_caterpillar','4_beetle']}),
    surround:Object.freeze({label:'사방 포위',pattern:'ring',enemies:['4_beetle','2_frog','2_gray_bug']}),
    air:Object.freeze({label:'공중 습격',pattern:'pincer',enemies:['6_sparrow','6_pigeon']}),
    tunnel:Object.freeze({label:'땅굴 침입',pattern:'near',enemies:['6_mouse','1_cat']}),
    shield:Object.freeze({label:'방패 행렬',pattern:'pack',enemies:['4_beetle','2_grasshopper']}),
    charge:Object.freeze({label:'광란의 돌진',pattern:'pincer',enemies:['6_rabbit','5_bulldog']}),
    double:Object.freeze({label:'이중 침공',pattern:'pincer',enemies:['1_cat','5_bulldog']}),
    'tunnel-air':Object.freeze({label:'땅굴·공중 복합 침공',pattern:'ring',enemies:['6_mouse','6_sparrow','6_pigeon']}),
    'surround-shield':Object.freeze({label:'사방 방패 포위',pattern:'ring',enemies:['4_beetle','2_gray_bug','5_bulldog']})
  });
  const first=Object.freeze({5:'beetle',10:'swarm',15:'frog',20:'surround',25:'air',30:'pigeon',
    35:'tunnel',40:'shield',45:'bulldog',50:'charge',55:'double',60:'monarch'});
  const repeat=Object.freeze({5:'surround',10:'tunnel',15:'frog',20:'air',25:'shield',30:'pigeon',
    35:'swarm',40:'charge',45:'bulldog',50:'tunnel-air',55:'surround-shield',60:'monarch'});
  function atMinute(minute){
    if(!Number.isInteger(minute)||minute<5||minute%5!==0)return null;
    const slot=((minute-1)%60)+1,tier=Math.floor((minute-1)/60),id=(minute<=60?first:repeat)[slot];
    if(!id)return null;
    if(bosses[id])return Object.freeze({minute,id,kind:'boss',label:bosses[id].label,tier,boss:bosses[id]});
    return Object.freeze({minute,id,kind:'raid',label:raids[id].label,tier,
      pattern:raids[id].pattern,enemies:raids[id].enemies,count:Math.min(18,10+tier*2)});
  }
  function create(onEvent=null){
    let next=1,warning=null,active=null;
    function advance(elapsed){
      if(active&&elapsed+1e-7>=active.until){
        onEvent?.('survival_event_end',{minute:active.minute,id:active.id,kind:active.kind,time:elapsed});
        active=null;
      }
      const time=next*300;
      if(!warning&&elapsed+1e-7>=time-20){
        const event=atMinute(next*5);
        warning={...event,time};
        onEvent?.('survival_event_warning',{minute:event.minute,id:event.id,kind:event.kind,time:elapsed});
      }
      if(warning&&elapsed+1e-7>=time){
        active={...warning,started:time,until:time+(warning.kind==='boss'?90:35),
          spawned:0,nextSpawn:time};
        warning=null;next++;
        onEvent?.('survival_event_start',{minute:active.minute,id:active.id,kind:active.kind,tier:active.tier,time:elapsed});
      }
      return active;
    }
    return {advance,get active(){return active;},get warning(){return warning;},get nextMinute(){return next*5;}};
  }
  // Direction patterns reuse the game's existing spawn route and species motion.
  function pointFor(event,index,spec,entry){
    const sides=event.pattern==='pincer'?['left','right']:
      event.pattern==='ring'?['left','top','right','bottom']:['right','right','left'];
    const side=sides[index%sides.length];
    const span=entry.span;
    const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
    const offset=(index%5-2)*Math.min(25,span);
    const x=clamp(spec.width/2+offset,span*2,spec.width-span*2);
    const y=clamp((spec.top+spec.height-spec.bottom)/2+offset,spec.top+span*2,spec.height-spec.bottom-span*2);
    if(event.pattern==='near'){
      const g=spec.garden;
      const boundaryX=side==='left'?g.x-42:g.x+(g.width||g.size)+42;
      return {side,x:clamp(boundaryX,span*2,spec.width-span*2),y};
    }
    if(side==='left'||side==='right')return {side,x:side==='left'?span*.74+12:spec.width-span*.74-12,y};
    return {side,x,y:side==='top'?spec.top+span*2:spec.height-spec.bottom-span};
  }
  window.GardenSurvivalEvents=Object.freeze({enabled:!!window.GardenRunRules?.survival,bosses,raids,first,repeat,atMinute,create,pointFor});
}());
