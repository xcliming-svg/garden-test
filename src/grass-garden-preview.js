(function(){
  'use strict';
  // Derived tints of the existing Garden 16 ink and growth roles.
  const P=window.GardenPalette.n;
  function tint(t){
    return [16,8,0].reduce((n,s)=>n|(Math.round(((P.ink>>s)&255)*(1-t)+((P.growth>>s)&255)*t)<<s),0);
  }
  const colors=Object.freeze({planted:[tint(0.29),tint(0.21),tint(0.42)],candidate:[tint(0.22),tint(0.15),tint(0.34)]});
  const css=c=>'#'+c.toString(16).padStart(6,'0');
  function visible(occupied,candidates){return new Set([...candidates,...occupied]);}
  function draw(ctx,g,z,raster,occupied,candidates){
    ctx.clearRect(0,0,raster.width,raster.height);
    // A stable logical-pixel pattern: no per-frame noise or tile-boundary grid.
    // Small three-pixel tufts and occasional dark flecks on a muted green base.
    function rect(x,y,w,h,color){
      const x0=Math.round((g.x+x)*z)-raster.x,y0=Math.round((g.y+y)*z)-raster.y;
      const x1=Math.round((g.x+x+w)*z)-raster.x,y1=Math.round((g.y+y+h)*z)-raster.y;
      ctx.fillStyle=css(color);ctx.fillRect(x0,y0,x1-x0,y1-y0);
    }
    function cell(i,palette){
      const x=i%g.columns*g.pitch,y=Math.floor(i/g.columns)*g.pitch;
      const right=x+g.outer,bottom=y+g.outer;
      rect(x,y,g.outer,g.outer,palette[0]);
      const point=(px,py,c)=>{if(px>=x&&px<right&&py>=y&&py<bottom)rect(px,py,1,1,c);};
      for(let by=Math.floor(y/7);by*7<bottom;by++)for(let bx=Math.floor(x/7);bx*7<right;bx++){
        const hash=(Math.imul(bx+1,73856093)^Math.imul(by+1,19349663))>>>0;
        const px=bx*7+1+(hash%4),py=by*7+1+((hash>>>8)%4);
        point(px,py,palette[2]);point(px+1,py+1,palette[2]);point(px+1,py,palette[1]);
        if(hash%3===0)point(bx*7+5,by*7+5,palette[1]);
      }
    }
    ctx.globalAlpha=1;
    for(const i of candidates)cell(i,colors.candidate);
    for(const i of occupied)cell(i,colors.planted);
  }
  window.GardenGrassPreview=Object.freeze({colors,visible,draw});
}());
