(function(){
  'use strict';
  // Static enemy size comparison only. The source SVGs keep their embedded eyes hidden.
  const enabled=window.GardenFairyPatrol.enabled&&new URLSearchParams(window.location.search).get('enemies')!=='0';
  const size=512,root='assets/enemies/',anchorKey='enemy-preview:anchors';
  const key=(id,expression)=>'enemy-preview:'+id+':'+expression;
  const baseKey=id=>key(id,'base');
  // Longest visible side in logical px: one 22px flower cell for small pests,
  // 40px garden fairy for medium animals, and up to 1.6x fairy height for large threats.
  // The order maps into two outer field lanes, not combat tiers or spawn rules.
  const roster=Object.freeze([
    {id:'1_butterfly',span:26,side:'left',row:0,col:0},
    {id:'2_grasshopper',span:28,side:'left',row:0,col:1},
    {id:'6_mouse',span:32,side:'left',row:1,col:0},
    {id:'2_gray_bug',span:22,side:'left',row:1,col:1},
    {id:'1_cat',span:56,side:'left',row:2,col:0},
    {id:'3_caterpillar',span:28,side:'left',row:2,col:1},
    {id:'6_sparrow',span:32,side:'right',row:0,col:0},
    {id:'6_pigeon',span:40,side:'right',row:0,col:1},
    {id:'4_beetle',span:28,side:'right',row:1,col:0},
    {id:'2_frog',span:36,side:'right',row:1,col:1},
    {id:'6_rabbit',span:48,side:'right',row:2,col:0},
    {id:'5_bulldog',span:64,side:'right',row:2,col:1}
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
    return roster.map(e=>{
      const art=m.characters[e.id];
      if(!art)throw Error('Missing enemy anchor '+e.id);
      const body=scene.textures.get(baseKey(e.id)).getSourceImage();
      let b;
      for(const expression of ['normal','closed']){
        const k=key(e.id,expression);
        const tex=scene.textures.exists(k)?scene.textures.get(k):scene.textures.createCanvas(k,size,size);
        const ctx=tex.getContext();ctx.clearRect(0,0,size,size);ctx.drawImage(body,0,0,size,size);
        if(!b)b=bounds(ctx);
        // Quantize the body before compositing the existing eye silhouettes;
        // leave their antialiased edges intact rather than quantizing the blend.
        if(window.GardenSvgPalette.enabled)ctx.putImageData(window.GardenSvgPalette.apply(ctx.getImageData(0,0,size,size)),0,0);
        const f=fairy.sheets.eyes.frames[expression],w=f.width/2;
        for(const [i,side] of ['left','right'].entries()){
          const a=art.eyes[side],c=fairy.sourceEyeCenters[side];
          // The shared atlas already includes the source eye normalization.
          const sx=f.x+i*w,sy=f.y;
          const dx=(a.x-(c.x-i*w)*a.scale)*factor;
          const dy=(a.y-c.y*a.scale)*factor;
          ctx.drawImage(atlas,sx,sy,w,f.height,dx,dy,w*a.scale*factor,f.height*a.scale*factor);
        }
        tex.refresh();tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
      }
      return {...e,name:art.name,bounds:b};
    });
  }
  function layout(spec,border,entries){
    // Full garden / enlarged guardian modes still retain two clear side lanes.
    const pad=12,clearance=10,fieldBottom=spec.height-spec.bottom;
    const laneEdges={left:[pad,border.left-clearance],right:[border.right+clearance,spec.width-pad]};
    // Left rows start below the blueprint; right rows below the status label.
    const top=Math.max(spec.top+24,spec.blueprint.y+spec.blueprint.height+12);
    const bottom=fieldBottom-pad,rowHeight=(bottom-top)/3;
    const rightTop=spec.top+30,rightRowHeight=(bottom-rightTop)/3;
    return entries.map(e=>{
      const [lo,hi]=laneEdges[e.side],columnWidth=(hi-lo)/2;
      const rh=e.side==='left'?rowHeight:rightRowHeight;
      const scale=Math.min(e.span,columnWidth-10,rh-10)/Math.max(e.bounds.width,e.bounds.height);
      return {...e,x:lo+(e.col+.5)*columnWidth,y:(e.side==='left'?top:rightTop)+(e.row+.5)*rh,
        scale,width:e.bounds.width*scale,height:e.bounds.height*scale};
    });
  }
  function attach(scene,spec,patrol){
    if(!enabled)return null;
    const entries=install(scene);
    const b=patrol.boundary;
    // Stone alpha extends beyond its center line; reserve its maximum half-frame.
    const border={left:b.border.left-b.frame/2,right:b.border.right+b.frame/2};
    const actors=layout(spec,border,entries).map((e,i)=>{
      const r=e.bounds;
      const image=scene.add.image(e.x,e.y,key(e.id,'normal'))
        .setOrigin((r.left+r.right)/2/size,(r.top+r.bottom)/2/size)
        .setDisplaySize(size*e.scale,size*e.scale).setDepth(2).setName('enemy-preview:'+e.id);
      return {...e,image,blink:window.GardenFairyPatrol.blinkSchedule(i+11),expression:'normal'};
    });
    let elapsed=0;
    function advance(seconds){
      elapsed+=Math.max(0,seconds);
      for(const a of actors){
        const expression=a.blink(elapsed);
        if(expression!==a.expression){a.expression=expression;a.image.setTexture(key(a.id,expression));}
      }
      return elapsed;
    }
    const update=(_time,delta)=>advance(Math.min(.1,Math.max(0,delta/1000)));
    scene.events.on('update',update);
    scene.events.once('shutdown',()=>{scene.events.off('update',update);delete scene.enemyPreview;});
    scene.enemyPreview={actors,advance,get elapsed(){return elapsed;}};
    return scene.enemyPreview;
  }
  window.GardenEnemyPreview=Object.freeze({enabled,roster,preload,attach,key,layout});
}());
