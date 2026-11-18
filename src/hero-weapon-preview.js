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
    balloon:{life:1.5,span:16},boomerang:{life:1.7,span:18},wheel:{life:1.4,span:20},
    flowerpot:{life:1.15,span:20},'paper-plane':{life:1.55,span:18},
    'bouncy-ball':{life:1.7,span:14},'yellow-floor':{life:2.6,span:24},
    sprinkler:{life:1.9,span:20},rock:{life:1.1,span:12},broom:{life:.7,span:28}
  });
  const outward={right:[0,-1],down:[1,0],left:[0,1],up:[-1,0]};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const mix=(a,b,t)=>a+(b-a)*t;
  const interval=1.6,range=550;
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  function segmentDistance(a,b,p){
    const dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy;
    const t=den?clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/den,0,1):0;
    return Math.hypot(a.x+t*dx-p.x,a.y+t*dy-p.y);
  }
  function create(spec){
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
    function step(dt,hero,targets=[],damage=null,slow=null){
      if(!(dt>0))return;
      state.elapsed+=dt;
      const live=targets.filter(e=>e.x>=0&&e.x<=spec.width&&e.y>=spec.top&&e.y<=spec.height-spec.bottom);
      const dead=new Set();
      for(const s of state.shots){
        const previous=s.previous||pose(s,hero);
        s.age=Math.min(tuning[s.kind].life,s.age+dt);
        if(s.kind==='paper-plane'&&s.targetId!==null){
          const target=live.find(e=>e.id===s.targetId);
          if(target){s.tx=target.x;s.ty=target.y;}
        }
        const p=pose(s,hero);
        if(!s.preview&&damage){
          const candidates=live.filter(e=>!dead.has(e.id)&&!s.hit.has(e.id));
          const area=s.kind==='balloon'||s.kind==='flowerpot';
          const hits=candidates.filter(e=>{
            const r=e.radius||0;
            if(area)return p.ring>0&&distance(p,e)<=p.ring+r;
            if(s.kind==='yellow-floor')return p.t>=.22&&distance(p,e)<=tuning[s.kind].span*.9+r;
            if(s.kind==='sprinkler')return p.t>.25&&distance(p,e)<=44+r;
            return segmentDistance(previous,p,e)<=tuning[s.kind].span*.4+r;
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
                const other=live.filter(q=>q.id!==e.id&&!dead.has(q.id)&&!s.hit.has(q.id)).sort((a,b)=>distance(p,a)-distance(p,b))[0];
                if(other&&s.hit.size<3){
                  s.bounce={x:p.x,y:p.y,tx:other.x,ty:other.y,age:s.age};s.targetId=other.id;
                }else s.done=true;
              }else if(single)s.done=true;
            }
          }
        }
        s.previous=p;
      }
      state.shots=state.shots.filter(s=>!s.done&&s.age<tuning[s.kind].life);
      if(!hero||hero.index!==0||hero.type!=='garden'||!outward[hero.direction])return;
      const slots=state.equipped.flatMap((id,index)=>id?[{id,index,preview:false}]:[]);
      if(!slots.length&&state.selected)slots.push({id:state.selected,index:-1,preview:true});
      for(const slot of slots){
        if(state.elapsed<(next.get(slot.index)||0))continue;
        const x=hero.center.x,y=hero.center.y;
        let [dx,dy]=outward[hero.direction];
        const target=!slot.preview&&damage?live.filter(e=>!dead.has(e.id)&&distance(hero.center,e)<=range)
          .sort((a,b)=>distance(hero.center,a)-distance(hero.center,b))[0]:null;
        if(!slot.preview&&damage&&!target)continue;
        const left=24,right=spec.width-24,top=spec.top+24,bottom=spec.height-spec.bottom-24;
        const tx=target?target.x:clamp(x+dx*150,left,right),ty=target?target.y:clamp(y+dy*150,top,bottom);
        if(target){const d=Math.hypot(tx-x,ty-y)||1;dx=(tx-x)/d;dy=(ty-y)/d;}
        state.shots.push({id:serial++,owner:0,slot:slot.index,preview:slot.preview,kind:slot.id,x,y,tx,ty,dx,dy,age:0,targetId:target?.id??null,hit:new Set()});
        state.fired++;next.set(slot.index,state.elapsed+interval);
      }
    }
    return {state,select,equip,step};
  }
  // In the hidden-enemy mode the target is an invisible preview point.
  function pose(s,hero){
    const t=clamp(s.age/tuning[s.kind].life,0,1),a=Math.atan2(s.dy,s.dx);
    const px=-s.dy,py=s.dx;let x=mix(s.x,s.tx,t),y=mix(s.y,s.ty,t),angle=0,alpha=1,scale=1,ring=0,kind=s.kind;
    switch(kind){
      case 'balloon':{
        const u=Math.min(1,t/.7);x=mix(s.x,s.tx,u);y=mix(s.y,s.ty,u)-Math.sin(Math.PI*u)*36;
        if(t>.7){alpha=0;ring=8+45*(t-.7)/.3;}break;
      }
      case 'boomerang':{
        const u=t<.5?t*2:(1-t)*2;
        const end=hero?.center||{x:s.x,y:s.y};
        x=mix(t<.5?s.x:end.x,s.tx,u)+px*Math.sin(Math.PI*u)*24;
        y=mix(t<.5?s.y:end.y,s.ty,u)+py*Math.sin(Math.PI*u)*24;angle=t*12;break;
      }
      case 'wheel':angle=t*14;break;
      case 'flowerpot':{
        x=s.tx;y=s.ty-75*(1-Math.min(1,t/.7));
        if(t>.7){alpha=0;ring=5+33*(t-.7)/.3;}break;
      }
      case 'paper-plane':x+=px*Math.sin(Math.PI*t)*20;y+=py*Math.sin(Math.PI*t)*20;angle=a+Math.PI/4;break;
      case 'bouncy-ball':{
        const u=t<.55?t/.55:(t-.55)/.45;
        x=t<.55?mix(s.x,s.tx,u):s.tx-s.dx*45*u+px*85*u;
        y=t<.55?mix(s.y,s.ty,u):s.ty-s.dy*45*u+py*85*u;
        y-=Math.abs(Math.sin(t*3*Math.PI))*18;break;
      }
      case 'yellow-floor':x=mix(s.x,s.tx,Math.min(1,t/.22));y=mix(s.y,s.ty,Math.min(1,t/.22));scale=t<.22?1:1.8;alpha=t>.8?(1-t)/.2:1;break;
      case 'sprinkler':x=mix(s.x,s.tx,Math.min(1,t/.25));y=mix(s.y,s.ty,Math.min(1,t/.25));if(t>.25)ring=12+32*((t-.25)*4%1);break;
      case 'rock':angle=t*5;break;
      case 'broom':{
        const p=hero?.center||{x:s.x,y:s.y},sweep=a-1.15+2.3*t;
        x=p.x+Math.cos(sweep)*27;y=p.y+Math.sin(sweep)*27;angle=sweep+Math.PI/4;break;
      }
    }
    return {x,y,angle,alpha,scale,ring,t};
  }
  function attach(scene,spec,patrol){
    if(!enabled)return null;
    const I=window.GardenItemCards,P=window.GardenPalette,model=create(spec),images=new Map();
    const clip=scene.make.graphics({x:0,y:0,add:false});
    clip.fillStyle(0xffffff,1).fillRect(0,spec.top,spec.width,spec.height-spec.top-spec.bottom);
    const mask=clip.createGeometryMask();
    const fx=scene.add.graphics().setDepth(6).setMask(mask).setName('hero-weapon:effects');
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
    function clear(){for(const obj of images.values())I.destroyRelic(obj.image);images.clear();fx.clear();}
    function choose(id){if(!model.select(id))return false;select.value=id;render();return true;}
    function equip(index,id){if(!model.equip(index,id))return false;select.disabled=model.state.equipped.some(Boolean);select.value=model.state.selected;render();return true;}
    select.addEventListener('change',()=>{choose(select.value);select.blur();});
    const pause=()=>{select.blur();select.hidden=true;};
    const resume=()=>{select.hidden=false;};
    // The native control must not swallow the game's Escape pause action.
    select.addEventListener('keydown',e=>{if(e.key==='Escape')select.blur();});
    function render(){
      fx.clear();const live=new Set(),hero=patrol.actors[0];
      for(const s of model.state.shots){
        live.add(s.id);
        if(!images.has(s.id)){
          const image=I.weaponImage(scene,s.kind,s.x,s.y,tuning[s.kind].span).setDepth(6).setMask(mask).setName('hero-weapon:'+s.kind+':'+s.id);
          images.set(s.id,{image,width:image.displayWidth,height:image.displayHeight});
        }
        const p=pose(s,hero),obj=images.get(s.id);
        obj.image.setPosition(p.x,p.y).setRotation(p.angle).setAlpha(p.alpha)
          .setDisplaySize(obj.width*p.scale,obj.height*p.scale);
        if(p.ring){
          const c=s.kind==='flowerpot'?P.n.clay:P.n.skyLight;
          fx.lineStyle(1.5,c,Math.max(.15,1-p.t)).strokeCircle(p.x,p.y,p.ring);
          if(s.kind==='sprinkler')for(let i=0;i<8;i++){const a=i*Math.PI/4+p.t*5;fx.fillStyle(c,.85).fillCircle(p.x+Math.cos(a)*p.ring,p.y+Math.sin(a)*p.ring,2);}
        }
      }
      for(const [id,obj] of images)if(!live.has(id)){I.destroyRelic(obj.image);images.delete(id);}
    }
    // Only this actor is ever passed to the preview model. No enemy or damage state exists.
    function update(_time,delta){if(patrol.finished)return;model.step(Math.min(.1,Math.max(0,delta/1000)),patrol.actors[0]);render();}
    scene.events.on('update',update);scene.events.on('pause',pause);scene.events.on('resume',resume);scene.scale.on('resize',resize);
    scene.events.once('shutdown',()=>{
      scene.events.off('update',update);scene.events.off('pause',pause);scene.events.off('resume',resume);scene.scale.off('resize',resize);
      select.remove();images.clear();mask.destroy();clip.destroy();delete scene.heroWeaponPreview;
    });
    scene.heroWeaponPreview={model,select:choose,equip,render,control:select};
    return scene.heroWeaponPreview;
  }
  window.GardenHeroWeaponPreview=Object.freeze({enabled,combat,ids,tuning,interval,range,create,pose,attach});
}());
