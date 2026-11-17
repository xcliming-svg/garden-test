(function(){
  'use strict';
  // Single-enemy motion comparison. Original SVGs keep their embedded eyes hidden.
  const enabled=window.GardenFairyPatrol.enabled&&new URLSearchParams(window.location.search).get('enemies')!=='0';
  const size=512,root='assets/enemies/',anchorKey='enemy-preview:anchors';
  const key=(id,expression)=>'enemy-preview:'+id+':'+expression;
  const baseKey=id=>key(id,'base');
  // Longest visible side in logical px: 22px flower cell, 40px garden fairy.
  // Attack type and level select preview motion only, not combat rules.
  const roster=Object.freeze([
    {id:'1_butterfly',span:26,attackType:'fly',level:1,side:'left',row:0,col:0},
    {id:'2_grasshopper',span:28,attackType:'jump',level:1,side:'left',row:0,col:1},
    {id:'6_mouse',span:42,attackType:'approach',level:3,side:'left',row:1,col:0},
    {id:'2_gray_bug',span:30,attackType:'charge',level:1,side:'left',row:1,col:1},
    {id:'1_cat',span:48,attackType:'charge',level:2,side:'left',row:2,col:0},
    {id:'3_caterpillar',span:28,attackType:'approach',level:1,side:'left',row:2,col:1},
    {id:'6_sparrow',span:34,attackType:'fly',level:2,side:'right',row:0,col:0},
    {id:'6_pigeon',span:42,attackType:'fly',level:3,side:'right',row:0,col:1},
    {id:'4_beetle',span:34,attackType:'approach',level:2,side:'right',row:1,col:0},
    {id:'2_frog',span:36,attackType:'jump',level:2,side:'right',row:1,col:1},
    {id:'6_rabbit',span:48,attackType:'jump',level:3,side:'right',row:2,col:0},
    {id:'5_bulldog',span:60,attackType:'charge',level:3,side:'right',row:2,col:1}
  ].map(Object.freeze));
  function preload(scene){
    if(!enabled)return;
    if(!scene.cache.json.exists(anchorKey))scene.load.json(anchorKey,root+'eye_anchors.json');
    for(const e of roster)if(!scene.textures.exists(baseKey(e.id)))
      scene.load.svg(baseKey(e.id),root+e.id+'_1000.svg',{width:size,height:size});
  }
  function bounds(ctx){
    const data=ctx.getImageData(0,0,size,size).data;
    let l=size,t=size,r=-1,b=-1;
    for(let i=0;i<data.length;i+=4)if(data[i+3]>0){
      const x=i/4%size,y=Math.floor(i/4/size);
      l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y);
    }
    if(r<l)throw Error('Empty enemy body');
    return {left:l,top:t,right:r+1,bottom:b+1,width:r-l+1,height:b-t+1};
  }
  function install(scene){
    const m=scene.cache.json.get(anchorKey),fairy=scene.cache.json.get('fairy:manifest');
    if(!m||m.canvas[0]!==1000||m.canvas[1]!==1000||!fairy)throw Error('Invalid enemy eye anchors');
    const sharedAtlas=scene.textures.get('fairy:eyes').getSourceImage(),factor=size/1000;
    let atlas=sharedAtlas;
    if(window.GardenSvgPalette.enabled){
      // In the optional 16-color comparison, bark eyes merge into bark faces.
      // Keep the same shared eye silhouettes and use the existing ink role for contrast.
      atlas=document.createElement('canvas');atlas.width=sharedAtlas.width;atlas.height=sharedAtlas.height;
      const eyeContext=atlas.getContext('2d');eyeContext.drawImage(sharedAtlas,0,0);
      eyeContext.globalCompositeOperation='source-in';eyeContext.fillStyle=window.GardenPalette.hex.ink;
      eyeContext.fillRect(0,0,atlas.width,atlas.height);
    }
    // Read back from a dedicated software canvas so normal/closed use identical
    // source rasterization; Phaser texture upload remains unchanged.
    const work=document.createElement('canvas');work.width=work.height=size;
    const ctx=work.getContext('2d',{willReadFrequently:true});
    return roster.map(e=>{
      const art=m.characters[e.id];
      if(!art)throw Error('Missing enemy anchor '+e.id);
      const body=scene.textures.get(baseKey(e.id)).getSourceImage();
      ctx.clearRect(0,0,size,size);ctx.drawImage(body,0,0,size,size);
      const b=bounds(ctx),raw=ctx.getImageData(0,0,size,size);
      const base=window.GardenSvgPalette.enabled?window.GardenSvgPalette.apply(raw):raw;
      for(const expression of ['normal','closed']){
        const k=key(e.id,expression);
        const tex=scene.textures.exists(k)?scene.textures.get(k):scene.textures.createCanvas(k,size,size);
        // Both expressions start with the identical body pixels. Quantize only
        // the body, not the blended antialiased eye edges.
        ctx.putImageData(base,0,0);
        const f=fairy.sheets.eyes.frames[expression],w=f.width/2;
        for(const [i,side] of ['left','right'].entries()){
          const a=art.eyes[side],c=fairy.sourceEyeCenters[side];
          // The shared atlas already includes the source eye normalization.
          const sx=f.x+i*w,sy=f.y;
          const dx=(a.x-(c.x-i*w)*a.scale)*factor;
          const dy=(a.y-c.y*a.scale)*factor;
          ctx.drawImage(atlas,sx,sy,w,f.height,dx,dy,w*a.scale*factor,f.height*a.scale*factor);
        }
        tex.getContext().putImageData(ctx.getImageData(0,0,size,size),0,0);
        tex.refresh();tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
      }
      return {...e,name:art.name,bounds:b};
    });
  }
  function route(spec,boundary,e){
    // Reserve the complete transformed body outside the outermost stones.
    const margin=e.span*.74+12;
    const target=boundary.border.right+boundary.frame/2+margin;
    const start=spec.width-margin;
    const reach=Math.min(window.GardenEnemyMotion.profiles[e.id].reach,(start-target)*.55);
    return {start,stage:target+reach,target,ground:spec.top+spec.fieldHeight*.58};
  }
  function controls(scene,spec,entries,onSelect,onMode){
    const parent=document.getElementById('game'),P=window.GardenPalette.reference.hex;
    const panel=document.createElement('div');panel.id='enemy-preview-controls';
    Object.assign(panel.style,{position:'absolute',left:'0',top:'0',width:'226px',display:'flex',
      gap:'5px',alignItems:'center',transformOrigin:'0 0',zIndex:'2',fontFamily:'"Garden Fusion", sans-serif'});
    const make=(id,label,width)=>{
      const s=document.createElement('select');s.id=id;s.setAttribute('aria-label',label);
      Object.assign(s.style,{width:width+'px',height:'24px',fontFamily:'inherit',fontSize:'12px',
        background:P.panel,color:P.text,border:'1px solid '+P.border,borderRadius:'0',padding:'0 4px',cursor:'pointer'});
      panel.append(s);return s;
    };
    const select=make('enemy-character','적 캐릭터 선택',145),mode=make('enemy-motion-mode','적 모션 선택',76);
    const labels={approach:'접근',jump:'점프',charge:'돌진',fly:'비행'},names={'2_gray_bug':'공벌레','5_bulldog':'강아지'};
    const ordered=[...entries].sort((a,b)=>a.level-b.level||Object.keys(labels).indexOf(a.attackType)-Object.keys(labels).indexOf(b.attackType));
    for(const e of ordered)select.add(new Option('Lv.'+e.level+' '+labels[e.attackType]+' · '+(names[e.id]||e.name),e.id));
    for(const [v,label] of [['auto','이동+공격'],['move','이동'],['attack','공격']])mode.add(new Option(label,v));
    select.value='3_caterpillar';mode.value='auto';
    select.addEventListener('change',()=>{onSelect(select.value);select.blur();});
    mode.addEventListener('change',()=>{onMode(mode.value);mode.blur();});
    const resize=()=>{
      const z=parent.clientWidth/spec.width;
      panel.style.transform='translate('+((spec.width-236)*z)+'px,'+((spec.top+25)*z)+'px) scale('+z+')';
    };
    const pause=()=>{panel.style.display='none';select.blur();mode.blur();};
    const resume=()=>{panel.style.display='flex';resize();};
    parent.append(panel);resize();
    scene.scale.on('resize',resize);scene.events.on('pause',pause);scene.events.on('resume',resume);
    scene.events.once('shutdown',()=>{scene.scale.off('resize',resize);scene.events.off('pause',pause);scene.events.off('resume',resume);panel.remove();});
    return {panel,select,mode};
  }
  function attach(scene,spec,patrol){
    if(!enabled)return null;
    const entries=install(scene).map(e=>{
      const scale=e.span/Math.max(e.bounds.width,e.bounds.height);
      return {...e,scale,width:e.bounds.width*scale,height:e.bounds.height*scale};
    });
    let selected=entries.find(e=>e.id==='3_caterpillar'),mode='auto',elapsed=0,motionTime=0,expression='normal',pose=null;
    const image=scene.add.image(0,0,key(selected.id,'normal')).setDepth(2).setName('enemy-preview:actor');
    const shadow=scene.add.ellipse(0,0,1,1,window.GardenPalette.n.ink,.35).setDepth(.75).setName('enemy-preview:shadow');
    let blink=window.GardenFairyPatrol.blinkSchedule(11);
    function render(){
      const a=selected,r=a.bounds,path=route(spec,patrol.boundary,a);
      pose=window.GardenEnemyMotion.sample(a,mode,motionTime,path);
      const {x,lift,angle,sx,sy,flip}=pose;
      image.setPosition(x,path.ground-a.height*sy/2-lift)
        .setOrigin((r.left+r.right)/2/size,(r.top+r.bottom)/2/size)
        .setScale(a.scale*sx*(flip?-1:1),a.scale*sy).setAngle(angle);
      shadow.setPosition(x,path.ground+1).setDisplaySize(a.width*.72*(1-lift*.009),Math.max(2,a.height*.10))
        .setAlpha(.36/(1+lift*.055));
      const next=blink(elapsed);
      if(next!==expression){expression=next;image.setTexture(key(a.id,expression));}
    }
    function select(id){
      const a=entries.find(e=>e.id===id);if(!a)return false;
      selected=a;motionTime=0;elapsed=0;blink=window.GardenFairyPatrol.blinkSchedule(entries.indexOf(a)+11);
      expression='normal';image.setTexture(key(a.id,expression));render();return true;
    }
    function setMode(value){
      if(!window.GardenEnemyMotion.modes.includes(value))return false;
      mode=value;motionTime=0;render();return true;
    }
    const ui=controls(scene,spec,entries,select,setMode);
    function advance(seconds){const dt=Math.max(0,seconds);elapsed+=dt;motionTime+=dt;render();return elapsed;}
    const update=(_time,delta)=>advance(Math.min(.1,Math.max(0,delta/1000)));
    scene.events.on('update',update);
    scene.events.once('shutdown',()=>{scene.events.off('update',update);delete scene.enemyPreview;});
    scene.enemyPreview={entries,image,shadow,ui,select,setMode,advance,get selected(){return selected;},get pose(){return pose;},
      get mode(){return mode;},get expression(){return expression;},get elapsed(){return elapsed;},get motionTime(){return motionTime;}};
    render();return scene.enemyPreview;
  }
  window.GardenEnemyPreview=Object.freeze({enabled,roster,preload,attach,key,route});
}());
