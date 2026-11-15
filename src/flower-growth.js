(function () {
  'use strict';
  // Display-only growth and damage cycle; no combat or real HP simulation.
  const names=Object.freeze(['daisy','sunflower','tulip','hydrangea','rose','lavender']);
  const enabled=new URLSearchParams(window.location.search).get('flowerheads')!=='1';
  const sequence=Object.freeze([
    [0,1,100],[10,2,100],[20,3,100],[30,4,100],
    [40,4,66],[45,4,33],[50,3,100],[55,3,50],
    [60,2,100],[65,2,50],[70,1,100],[75,1,50]
  ].map(Object.freeze));
  const period=80, size=64;
  const sourceKey=(name,stage)=>'flower-growth-svg:'+name+':'+stage;
  const key=(name,stage,hp)=>'flower-growth:'+name+':'+stage+':'+hp;
  const path=(name,stage)=>'assets/flowers/0'+(names.indexOf(name)+1)+'_'+name+'_0'+stage+'.svg';
  function stateAt(seconds){
    const t=((Math.max(0,seconds)%period)+period)%period;
    let state=sequence[0];
    for(const item of sequence){if(item[0]>t)break;state=item;}
    return {stage:state[1],hp:state[2]};
  }
  function preload(scene){
    if(!enabled)return;
    for(const name of names)for(let stage=1;stage<=4;stage++){
      const k=sourceKey(name,stage);
      if(!scene.textures.exists(k))scene.load.svg(k,path(name,stage),{width:128,height:128});
    }
  }
  // Jagged bites enter from actual silhouette edges, rather than tinting the
  // entire flower. Preserve the lower 18% (roots/stem), original pixels and anchor.
  // Candidate masks are derived from each flower's own silhouette.
  function damageMasks(bytes,n){
    const rows=[];let top=n,bottom=-1,total=0;
    for(let y=0;y<n;y++){
      const xs=[];
      for(let x=0;x<n;x++)if(bytes[(y*n+x)*4+3]){xs.push(x);total++;}
      rows.push(xs);
      if(xs.length){top=Math.min(top,y);bottom=y;}
    }
    if(!total)throw Error('Empty flower raster');
    const h=bottom-top+1, candidates=[];
    const limit=bottom-Math.max(1,Math.round(h*.18));
    for(const side of [0,1])for(const fraction of [.13,.30,.47,.63]){
      for(const strength of [.30,.45,.60]){
        const mid=top+Math.round((h-1)*fraction),radius=Math.max(1,Math.round(h*.24));
        const pixels=[];
        for(let y=Math.max(top,mid-radius);y<=Math.min(limit,mid+radius);y++){
          const xs=rows[y];if(xs.length<2)continue;
          // Coarse, connected notches: interpolate irregular vertices instead of
          // alternating individual rows (which looks like a scan-line glitch).
          const profile=side?[0,.30,.78,.48,1,.68,.22,0]:[0,.25,.67,1,.57,.81,.30,0];
          const t=Math.max(0,Math.min(profile.length-1,(y-mid+radius)/(2*radius)*(profile.length-1)));
          const a=Math.floor(t),b=Math.min(profile.length-1,a+1);
          const weight=profile[a]+(profile[b]-profile[a])*(t-a);
          const count=Math.min(Math.floor(xs.length*.60),Math.max(0,Math.round(xs.length*strength*weight)));
          for(let i=0;i<count;i++)pixels.push(y*n+xs[side?xs.length-1-i:i]);
        }
        if(pixels.length)candidates.push({side,mid,pixels});
      }
    }
    const removed=new Set();
    function add(target,previous=null){
      let best=null,score=Infinity;
      for(const c of candidates){
        const gain=c.pixels.filter(i=>!removed.has(i)).length;if(!gain)continue;
        const ratio=(removed.size+gain)/total;
        const penalty=previous && c.side===previous.side ? .035 : 0;
        const s=Math.abs(ratio-target)+penalty;
        if(s<score){score=s;best=c;}
      }
      if(best)for(const i of best.pixels)removed.add(i);
      return best;
    }
    const first=add(.12);
    const light=new Set(removed);
    const second=add(.23,first);
    const medium=new Set(removed);
    add(.32,second);
    return {66:light,50:medium,33:new Set(removed)};
  }
  function install(scene){
    for(const name of names)for(let stage=1;stage<=4;stage++){
      const healthy=key(name,stage,100);
      if(scene.textures.exists(healthy))continue;
      const source=scene.textures.get(sourceKey(name,stage)).getSourceImage();
      const texture=scene.textures.createCanvas(healthy,size,size),ctx=texture.getContext();
      ctx.drawImage(source,0,0,size,size);
      const base=ctx.getImageData(0,0,size,size);
      // Native pixel-art raster, original SVG colors and geometry preserved.
      for(let i=0;i<base.data.length;i+=4){
        if(base.data[i+3]<128)base.data.fill(0,i,i+4);else base.data[i+3]=255;
      }
      ctx.putImageData(base,0,0);texture.refresh();texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      const masks=damageMasks(base.data,size);
      for(const hp of stage===4?[66,33]:[50]){
        const t=scene.textures.createCanvas(key(name,stage,hp),size,size),c=t.getContext();
        const image=c.createImageData(size,size);image.data.set(base.data);
        for(const i of masks[hp])image.data.fill(0,i*4,i*4+4);
        c.putImageData(image,0,0);t.refresh();t.setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
    }
  }
  function draw(scene,g){
    install(scene);
    // Six planted examples, fixed 3x2 layout. Keep full original 1000x1000
    // alignment (including the approved sunflower/rose offsets) in every frame.
    const display=Math.min(64,Math.floor(g.size/3)-4);
    const sprites=names.map((name,i)=>{
      const x=g.x+g.size*((i%3)+.5)/3;
      const y=g.y+g.size*(Math.floor(i/3)+.5)/2;
      return scene.add.image(x,y,key(name,1,100)).setDisplaySize(display,display)
        .setDepth(1).setName('garden-preview-flower:'+name);
    });
    let elapsed=0,last='';
    function render(){
      const {stage,hp}=stateAt(elapsed);
      const state=stage+':'+hp;if(state===last)return;
      last=state;
      sprites.forEach((sprite,i)=>sprite.setTexture(key(names[i],stage,hp)).setDisplaySize(display,display));
    }
    function advance(seconds){elapsed+=Math.max(0,seconds);render();return stateAt(elapsed);}
    const update=(_time,delta)=>advance(Math.max(0,delta)/1000);
    scene.events.on('update',update);
    scene.flowerGrowth={sprites,advance,state:()=>stateAt(elapsed),elapsed:()=>elapsed};
    scene.events.once('shutdown',()=>{scene.events.off('update',update);delete scene.flowerGrowth;});
    render();
  }
  window.GardenFlowerGrowth=Object.freeze({enabled,names,sequence,period,size,stateAt,path,key,preload,damageMasks,draw});
}());
