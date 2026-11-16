(function(){
  'use strict';
  // Static, low-contrast field experiments. No changes to game entities or HUD.
  const P=window.GardenPalette;
  const raw=new URLSearchParams(window.location.search).get('bgtype');
  // Night grass is the approved default; explicit 0 retains the plain black comparison.
  const type=/^[0-6]$/.test(raw||'')?Number(raw):6;
  const active=P.uiType===0?type:0;
  const base=P.n.ink,neutral=P.n.paper;
  const color=(t,target=neutral)=>{
    const channel=shift=>Math.round(((base>>shift)&255)*(1-t)+((target>>shift)&255)*t);
    return '#'+((channel(16)<<16)|(channel(8)<<8)|channel(0)).toString(16).padStart(6,'0');
  };
  function hash(x,y){let h=(Math.imul(x+17,374761393)+Math.imul(y+31,668265263))|0;h=Math.imul(h^(h>>>13),1274126177);return (h^(h>>>16))>>>0;}
  const styles=Object.freeze({
    1:Object.freeze({name:'checker',base:.035}),
    2:Object.freeze({name:'checker-dust',base:.035}),
    3:Object.freeze({name:'night-dust',base:.018}),
    4:Object.freeze({name:'woven-grid',base:.025}),
    5:Object.freeze({name:'staggered-tiles',base:.025}),
    6:Object.freeze({name:'night-grass',base:.045})
  });
  function paint(ctx,width,height,mode){
    const style=styles[mode];if(!style)throw Error('Unknown background pattern');
    function rect(x,y,w,h,t){ctx.fillStyle=color(t);ctx.fillRect(x,y,w,h);}
    rect(0,0,width,height,style.base);
    if(mode===6){
      // Near-black green soil with sparse, short grass blades, no tiled seams.
      // Derive all shades from the existing ink/growth roles.
      const green=P.n.growth;
      const grass=(t)=>color(t,green);
      ctx.fillStyle=grass(style.base);ctx.fillRect(0,0,width,height);
      for(let y=0;y<height;y+=12)for(let x=0;x<width;x+=12){
        const h=hash(x,y);
        if(h%5<2)continue;
        const px=x+2+h%8,py=y+3+(h>>>8)%7;
        const height=2+(h>>>16)%3;
        ctx.fillStyle=grass(.105+(h%3)*.025);
        ctx.fillRect(px,py-height,1,height+1);
        ctx.fillRect(px-1,py-2,1,2);
        if(h%3!==0)ctx.fillRect(px+1,py-3,1,2);
        if(h%7===0)ctx.fillRect(px-2,py-3,1,1);
      }
      // A few tiny ground flecks break up the repetitive silhouette.
      for(let y=0;y<height;y+=19)for(let x=0;x<width;x+=19){
        const h=hash(x+901,y+617);if(h%4!==0)continue;
        ctx.fillStyle=grass(.085);
        ctx.fillRect(x+2+h%15,y+2+(h>>>12)%15,1,1);
      }
      return;
    }
    if(mode===1||mode===2){
      const step=28;
      for(let y=0;y<height;y+=step)for(let x=0;x<width;x+=step)
        if(((x/step+y/step)&1)===0)rect(x,y,step,step,.050);
    }
    if(mode===2||mode===3){
      const step=mode===2?28:20;
      for(let y=0;y<height;y+=step)for(let x=0;x<width;x+=step){
        const h=hash(x,y);if(h%3===0)continue;
        const px=x+3+h%(step-6),py=y+3+(h>>>9)%(step-6);
        const large=h%11===0;
        rect(px,py,large?2:1,large?2:1,large?.105:.070+(h%3)*.01);
      }
    }
    if(mode===4){
      const step=24;
      for(let x=0;x<width;x+=step)rect(x,0,1,height,.047);
      for(let y=0;y<height;y+=step)rect(0,y,width,1,.047);
      for(let y=0;y<height;y+=step)for(let x=0;x<width;x+=step)
        rect(x,y,1,1,.075);
    }
    if(mode===5){
      const w=48,h=24;
      for(let y=0;y<height;y+=h){
        const shift=((y/h)&1)*w/2;
        for(let x=-shift;x<width;x+=w){
          rect(x+1,y+1,w-1,h-1,.036+(hash(x,y)%3)*.008);
          rect(x,y,w,1,.012);rect(x,y,1,h,.012);
        }
      }
    }
  }
  function field(scene,spec){
    if(!active)return null;
    const key='dark-field:'+active+':'+spec.width+'x'+spec.fieldHeight;
    if(!scene.textures.exists(key)){
      const t=scene.textures.createCanvas(key,spec.width,spec.fieldHeight);
      paint(t.getContext(),spec.width,spec.fieldHeight,active);
      t.refresh();t.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    return scene.add.image(spec.width/2,spec.top+spec.fieldHeight/2,key)
      .setDepth(-1.8).setName('dark-field-pattern');
  }
  window.GardenDarkFieldPreview=Object.freeze({type,active,styles,paint,field});
}());
