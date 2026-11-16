(function () {
  'use strict';
  // Continuous wilt deformation of the existing SVG-derived texture.
  // No path deletion, holes, sprite-sheet recropping or palette quantization.
  // Geometry is measured in the existing artboard, with root (500,856) fixed.
  const severity=Object.freeze({100:0,66:.45,33:.90});
  const clamp=(x,lo=0,hi=1)=>Math.min(hi,Math.max(lo,x));
  const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
  function prepare(image,size){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(image,0,0,size,size);
    const pixels=ctx.getImageData(0,0,size,size);
    let left=size,right=-1,top=size,bottom=-1;
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      if(pixels.data[(y*size+x)*4+3]===0)continue;
      left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
    }
    if(right<left)throw Error('Empty flower source');
    const rootX=size*.5,rootY=size*.856;
    return {pixels,size,left,right,top,bottom,rootX,rootY,
      halfWidth:Math.max(rootX-left,right+1-rootX,1),height:Math.max(rootY-top,1)};
  }
  // u = horizontal distance from root / silhouette half-width.
  // v = height above the fixed root / silhouette height.
  // The base remains unchanged; upper stem leans, leaves curl inward, and
  // outer petals sag farther than the centre. All source parts stay connected.
  function coefficients(v,d,lean){
    const lift=smooth(v*4);
    return [1-d*(.16+.10*clamp(v))*lift,d*lean*v*v];
  }
  function sag(u,v,d,mature){
    const edge=clamp(Math.abs(u))**2;
    return v*(1-d*((mature?.23:.28)+(mature?.24:.27)*edge));
  }
  function draw(ctx,source,hp,nameIndex,stage){
    const d=severity[hp];
    if(d===undefined)throw Error('Unknown flower health');
    const {pixels,size,left,right,top,bottom,rootX,rootY,halfWidth,height}=source;
    ctx.clearRect(0,0,size,size);
    if(d===0){ctx.putImageData(pixels,0,0);return;}
    const out=ctx.createImageData(size,size),src=pixels.data,dst=out.data;
    const lean=(nameIndex%2?-1:1)*(.18+.035*Math.sin(nameIndex*1.7));
    const mature=stage===3;
    // Inverse mapping: solve vertical sag monotonically and invert the horizontal
    // curl analytically. Sampling is premultiplied-alpha bilinear, not nearest.
    const x0=Math.max(0,Math.floor(left-halfWidth*.28)-2);
    const x1=Math.min(size-1,Math.ceil(right+halfWidth*.28)+2);
    for(let j=Math.max(0,top-2);j<=Math.min(size-1,bottom+2);j++){
      const tv=(rootY-j-.5)/height;
      for(let i=x0;i<=x1;i++){
        const tu=(i+.5-rootX)/halfWidth;
        let u=tu,v=tv;
        if(tv>0){
          let lo=0,hi=1.02;
          const max=coefficients(hi,d,lean);
          if(sag((tu-max[1])/max[0],hi,d,mature)<tv)continue;
          for(let k=0;k<14;k++){
            v=(lo+hi)*.5;
            const [a,b]=coefficients(v,d,lean);
            u=(tu-b)/a;
            if(sag(u,v,d,mature)<tv)lo=v;else hi=v;
          }
          v=(lo+hi)*.5;
          const [a,b]=coefficients(v,d,lean);u=(tu-b)/a;
        }
        const sx=rootX+u*halfWidth-.5,sy=rootY-v*height-.5;
        const ix=Math.floor(sx),iy=Math.floor(sy);
        if(ix<0||iy<0||ix>=size-1||iy>=size-1)continue;
        const fx=sx-ix,fy=sy-iy;
        const indices=[(iy*size+ix)*4,(iy*size+ix+1)*4,((iy+1)*size+ix)*4,((iy+1)*size+ix+1)*4];
        const weights=[(1-fx)*(1-fy),fx*(1-fy),(1-fx)*fy,fx*fy];
        let alpha=0,r=0,g=0,b=0;
        for(let k=0;k<4;k++){
          const p=indices[k],w=weights[k]*src[p+3]/255;
          alpha+=w;r+=w*src[p];g+=w*src[p+1];b+=w*src[p+2];
        }
        if(alpha<=0)continue;
        r/=alpha;g/=alpha;b/=alpha;
        // Reference-inspired yellowing and desaturation, with a gentle dry-tip
        // gradient. No arbitrary damage speckles or hard color quantization.
        const edge=clamp(Math.abs(u)),rise=clamp(v);
        const mix=d*(.32+.16*edge+.13*rise);
        const lum=.2126*r+.7152*g+.0722*b;
        const green=g>r*1.08&&g>b*1.15;
        const target=green?[95+lum*.36,75+lum*.30,27+lum*.19]:
          [110+lum*.30,76+lum*.25,49+lum*.22];
        const shade=1-d*(.07+.08*edge);
        const p=(j*size+i)*4;
        dst[p]=(r+(target[0]-r)*mix)*shade;
        dst[p+1]=(g+(target[1]-g)*mix)*shade;
        dst[p+2]=(b+(target[2]-b)*mix)*shade;
        dst[p+3]=alpha*255;
      }
    }
    ctx.putImageData(out,0,0);
  }
  window.GardenFlowerDamage=Object.freeze({prepare,draw,severity});
}());
