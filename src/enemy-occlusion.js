(function(){
  'use strict';
  // Rendering-only comparison: choose whether enemies or fairies are in front.
  const fairyFront=new URLSearchParams(window.location.search).get('occlusion')==='fairy';
  const config=Object.freeze({fairyFront,flowerAlpha:.4,fairyAlpha:.5,enemyAlpha:.5,fadeIn:.1,fadeOut:.2});
  const cache=new WeakMap();
  function silhouette(texture){
    if(cache.has(texture))return cache.get(texture);
    const src=texture.getSourceImage(),w=src.width,h=src.height;
    const canvas=typeof src.getContext==='function'?src:document.createElement('canvas');
    if(canvas!==src){canvas.width=w;canvas.height=h;canvas.getContext('2d').drawImage(src,0,0);}
    const rgba=canvas.getContext('2d').getImageData(0,0,w,h).data,mask=new Uint8Array(w*h);
    let l=w,t=h,r=0,b=0;
    for(let i=0;i<mask.length;i++)if(rgba[i*4+3]>=128){
      mask[i]=1;const x=i%w,y=Math.floor(i/w);
      l=Math.min(l,x);r=Math.max(r,x+1);t=Math.min(t,y);b=Math.max(b,y+1);
    }
    const result={w,h,mask,l,t,r,b};cache.set(texture,result);return result;
  }
  function shape(image){
    const m=silhouette(image.texture),sx=image.scaleX*(image.flipX?-1:1),sy=image.scaleY*(image.flipY?-1:1);
    if(!sx||!sy||m.l>=m.r||m.t>=m.b)return null;
    const cos=Math.cos(image.rotation),sin=Math.sin(image.rotation);
    const ox=image.displayOriginX,oy=image.displayOriginY,x=image.x,y=image.y;
    let l=Infinity,t=Infinity,r=-Infinity,b=-Infinity;
    for(const px of [m.l,m.r])for(const py of [m.t,m.b]){
      const dx=(px-ox)*sx,dy=(py-oy)*sy,wx=x+dx*cos-dy*sin,wy=y+dx*sin+dy*cos;
      l=Math.min(l,wx);r=Math.max(r,wx);t=Math.min(t,wy);b=Math.max(b,wy);
    }
    return {m,sx,sy,cos,sin,ox,oy,x,y,l,t,r,b,depth:image.depth};
  }
  function opaqueAt(s,x,y){
    const dx=x-s.x,dy=y-s.y;
    const u=Math.floor((dx*s.cos+dy*s.sin)/s.sx+s.ox),v=Math.floor((-dx*s.sin+dy*s.cos)/s.sy+s.oy);
    return u>=0&&u<s.m.w&&v>=0&&v<s.m.h&&s.m.mask[v*s.m.w+u]===1;
  }
  function covers(lower,upper,field){
    if(!lower||!upper||upper.depth<=lower.depth)return false;
    const l=Math.max(lower.l,upper.l,field.left),r=Math.min(lower.r,upper.r,field.right);
    const t=Math.max(lower.t,upper.t,field.top),b=Math.min(lower.b,upper.b,field.bottom);
    if(l>=r||t>=b)return false;
    const nx=Math.max(1,Math.ceil(r-l)),ny=Math.max(1,Math.ceil(b-t));
    for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
      const x=l+(i+.5)*(r-l)/nx,y=t+(j+.5)*(b-t)/ny;
      if(opaqueAt(lower,x,y)&&opaqueAt(upper,x,y))return true;
    }
    return false;
  }
  function nextAlpha(alpha,covered,min,seconds){
    const step=(1-min)*Math.max(0,seconds)/(covered?config.fadeIn:config.fadeOut);
    return covered?Math.max(min,alpha-step):Math.min(1,alpha+step);
  }
  function attach(scene,spec,patrol){
    const field={left:0,right:spec.width,top:spec.top,bottom:spec.height-spec.bottom};
    const visible=image=>image&&image.active&&image.visible;
    function update(images,seconds){
      // The current opacity does not alter geometric overlap; no cascading
      // or compounded fading when a fairy covers an enemy over a flower.
      const enemyImages=Array.from(images).filter(visible);
      const enemyShapes=enemyImages.map(shape);
      const fairies=patrol.actors.map(a=>a.image).filter(visible);
      function apply(image,min,uppers,lower=shape(image)){
        if(!visible(image))return;
        const covered=uppers.some(upper=>covers(lower,upper,field));
        image.setAlpha(nextAlpha(image.alpha,covered,min,seconds));
      }
      if(fairyFront){
        const fairyShapes=fairies.map(shape);
        for(const fairy of fairies)fairy.setAlpha(1);
        for(let i=0;i<enemyImages.length;i++)apply(enemyImages[i],config.enemyAlpha,fairyShapes,enemyShapes[i]);
      }else{
        for(const enemy of enemyImages)enemy.setAlpha(1);
        for(const fairy of fairies)apply(fairy,config.fairyAlpha,enemyShapes);
      }
      for(const actor of patrol.actors){
        if(actor.outline)actor.outline.setAlpha(actor.image.alpha);
        for(const tear of actor.tears)if(tear.sprite.visible)
          tear.sprite.setAlpha(tear.baseAlpha*actor.image.alpha);
      }
      if(scene.flowerGrowth)for(const entry of scene.flowerGrowth.entries.values())apply(entry.image,config.flowerAlpha,enemyShapes);
      else for(const image of scene.children.list)if(image.name?.startsWith('garden-preview-flower:'))apply(image,config.flowerAlpha,enemyShapes);
    }
    return {update};
  }
  window.GardenEnemyOcclusion=Object.freeze({config,shape,covers,nextAlpha,attach});
}());
