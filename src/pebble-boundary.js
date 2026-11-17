(function(){
  'use strict';
  // Decorative outer boundary, not a physics wall. Sizes in logical pixels.
  // Keep the established route geometry, but never draw the decorative wall.
  const gap=5,roles=['stone','silver'],assetSize=256,halfW=11/32,halfH=8.25/32;
  const key=role=>'garden-pebble:'+role;
  const expand=(r,x,y=x)=>({left:r.left-x,right:r.right+x,top:r.top-y,bottom:r.bottom+y});
  function preload(scene){
    for(const role of roles)if(!scene.textures.exists(key(role)))
      scene.load.svg(key(role),window.GardenSvgPalette.path('pebbles/garden-pebble-'+role+'.svg'),{width:assetSize,height:assetSize});
  }
  // Include full visible body, pivot rotation and lift, not transparent canvas.
  function layout(spec,garden,requestedHeight,gait,count){
    const angle=(gait.tilt+gait.lean)*Math.PI/180;
    const hx=430/716/2+Math.sin(angle);
    const hy=.5+430/716/2*Math.sin(angle)+gait.lift/40+1-Math.cos(angle);
    const frameRatio=assetSize/716;
    // Oversized comparison modes cannot fit both gaps in the fixed field.
    // Fit the group uniformly only when needed; never clip under the HUD.
    const available=Math.min(garden.top-spec.top,spec.height-spec.bottom-garden.bottom);
    const fit=Math.floor((available-2*gap-1)/(2*hy+frameRatio*(halfH+halfW)));
    const height=Math.max(1,Math.min(requestedHeight,fit));
    const frame=height*frameRatio,body={x:hx*height,y:hy*height};
    const patrol=expand(garden,gap+body.x,gap+body.y);
    const perimeter=()=>2*(patrol.right-patrol.left+patrol.bottom-patrol.top);
    const extra=Math.max(0,(count*(height*1.2+4)-perimeter())/4);
    patrol.left-=extra;patrol.right+=extra;
    const swept=expand(patrol,body.x,body.y);
    // Stones turn to follow each side; use the normal half-thickness.
    const border=expand(swept,gap+frame*halfH);
    const points=[],w=border.right-border.left,h=border.bottom-border.top;
    const pitch=2*frame*halfW+2;
    const nx=Math.max(1,Math.floor(w/pitch)),ny=Math.max(1,Math.floor(h/pitch));
    function side(n,point,angle){
      for(let i=0;i<n;i++){
        const p=point(i/n);
        points.push({...p,angle,role:roles[points.length%2]});
      }
    }
    side(nx,t=>({x:border.left+t*w,y:border.top}),0);
    side(ny,t=>({x:border.right,y:border.top+t*h}),90);
    side(nx,t=>({x:border.right-t*w,y:border.bottom}),180);
    side(ny,t=>({x:border.left,y:border.bottom-t*h}),270);
    return {garden,patrol,swept,border,points,height,frame,body,gap,requestedHeight,length:perimeter()};
  }
  function attach(scene){
    for(const role of roles)scene.textures.get(key(role)).setFilter(Phaser.Textures.FilterMode.LINEAR);
    let images=[];
    function render(info){
      for(const image of images)image.destroy();
      images=[];
    }
    return {render,get images(){return images;}};
  }
  window.GardenPebbleBoundary=Object.freeze({preload,layout,attach,key,gap,halfW,halfH});
}());
