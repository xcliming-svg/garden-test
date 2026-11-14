(function(){
  'use strict';
  // User supplied sheets, 4 frames each. Alpha >=128, largest connected
  // silhouette per quarter, cropped and sampled to 26x38. Palette indices:
  // 0 transparent, 1 slate, 2 growth, 3 red, 4 sand, 5 bark.
  // Each byte packs a run length (high 5 bits) and palette index (low 3).
  const sheets=[
    [
      "MCo4GlA6IDJIQhBCQEIIQlCCUHpoYngTGhuAIxozWINIi0iTMKMowwjLCPsMwxybCBMskxBEexgcCSxjKBwJLFs4FAksWzhMS0hMO2BEK4A6kEKIDEIMeBQyHHgMMixwDDIseDociEWQRZBFkEWQRVA=",
      "OCKoMiAySEIQQkCSSIJQgmBqcBM6eCMaK2AzGjtIi0iTMKMouxDLCPsMwxybCBMskxBEexgcCSxrIBwJLFswHAksWzhMS0hES1BEM4AygBxCcCw6FGAsMiRYLCosaAwIOiRwFToUeFV4XXA1EC1wJRgteBUoHUg=",
      "OCI4GlA6IDJIQhBCQEIISkiCUHpoYngTGiNwKxozWINIk0CTMKMouxDLCPsUuxybCBM0ixgUCSxzGBwJLGsgHAksWzhMUzhMS0hMO2BMG4g6kEKQChQyiCwigAosIoAKLCKIChwimDWgNagtsCWwJVg=",
      "MCI4IlA6GDpAQhBCSIpIglh6YGKAExojcCsaM1iDSJM4mzCrIMMIywj7DMMcmwgTLJMQHAkkexgcCSxjKBwJLFs4FAk0UzhMS0hMO2BMG4g6iBxCcCQ6FGgsKiRgLCoLHGgUQhR4DTIViFV4ZXAtCC14JRglgBWA"
    ],
    [
      "KCo4Elg6IDJIQghKQJJIglh6aFpwGyIjaCsaO1CLSItAmzCzGMMI+wsMwxS7JCMUYwgTXFsYCxQRJBEcQygUESQRHDswCzwRFEM4XDtIXCtYXBtwQohSgAxCFHAUMixoFDIsaAw6LGgMQhyADTIViE2ITYhNiEWYPVA=",
      "KCpAElA6IDpAQhBCQJJIikiCYGpwGzJ4IyIzWCsiO0iLSJM4oyDDEMMI+wsMwxwjDGsIGywTHGMQEwwRRFMgCwwRJBEcOzALFAkkERw7ODwJHDtIXDNQVCtwCiQSgBRKcCRCDGAsMiRYJDI0WBQIOixoDUIcaC0iFXBtaDUQLWgtGDVgJSglsB1I",
      "KCpAElA6IDpAQhBCQJJIikiCYGJwGyIrYCsiM1CLSJM4mzCzGMMI+wsMwxS7JCMUYwgbDAsJPFsYCxQRJAkLHEMoFBEkERw7MAs8ERQ7QFw7SFwrYEwIG3BCiFKADDIkcBQqLHAUKixwDDIsgDIciE2QPZg9oDWgLbAdYA==",
      "KCpAElA6IDpAQhBCQJJIikiCaFpwGyIrYCsiM1CLSJM4mzCzGMMI+wsMwxS7JCMMawgTFAtEWxgLFBEkCRxLKBQRHBEcQzALNBEcO0BcO0hcK2BMI3BCeBxSYCw6HFgsMixQLDIsWBw6JHANQggMgEWQTYBVgE2ILbAdeA=="
    ]
  ];
  const mode=new URLSearchParams(window.location.search).get('personstyle');
  const type=mode==='1'?1:mode==='2'?2:0;
  const fps=6,roles=[null,'slate','growth','red','sand','bark'];
  function pixels(type,frame,w,h){
    const data=atob(sheets[type-1][frame]),src=[];
    for(let i=0;i<data.length;i++){
      const v=data.charCodeAt(i);
      for(let n=0;n<(v>>3);n++)src.push(v&7);
    }
    if(src.length!==26*38)throw Error('Invalid guardian walk frame');
    // One logical pixel outline; keep 30x40 envelope at default height,
    // center the narrower natural aspect ratio rather than stretch the art.
    const ih=h-2,iw=Math.min(w-2,Math.round(ih*26/38)),ox=Math.floor((w-iw)/2),core=new Uint8Array(w*h);
    for(let y=0;y<ih;y++)for(let x=0;x<iw;x++)
      core[(y+1)*w+x+ox]=src[Math.floor((y+.5)*38/ih)*26+Math.floor((x+.5)*26/iw)];
    const result=core.slice();
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const i=y*w+x;if(core[i])continue;
      if((x>0&&core[i-1])||(x<w-1&&core[i+1])||(y>0&&core[i-w])||(y<h-1&&core[i+w]))result[i]=1;
    }
    return result;
  }
  function install(scene,w,h){
    if(!type)return null;
    const keys=[];
    for(let f=0;f<4;f++){
      const key='guardian-walk:'+type+':'+h+':'+f;keys.push(key);
      if(scene.textures.exists(key))continue;
      const texture=scene.textures.createCanvas(key,w,h),ctx=texture.getContext(),im=ctx.createImageData(w,h),data=pixels(type,f,w,h);
      for(let i=0;i<data.length;i++){
        if(!data[i])continue;
        const c=window.GardenPalette.n[roles[data[i]]];
        im.data.set([(c>>16)&255,(c>>8)&255,c&255,255],i*4);
      }
      ctx.putImageData(im,0,0);texture.refresh();texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    return keys;
  }
  function animator(guardian,keys){
    if(!keys)return null;
    let lastX=guardian.x,faceRight=true;
    guardian.setFlipX(true);
    return state=>{
      const dx=state.guardian.x-lastX;
      if(Math.abs(dx)>1e-6)faceRight=dx>0;
      lastX=state.guardian.x;
      const f=Math.floor(state.elapsed*fps+1e-7)%4;
      if(guardian.texture.key!==keys[f])guardian.setTexture(keys[f]);
      guardian.setFlipX(faceRight);
    };
  }
  window.GardenGuardianWalkPreview=Object.freeze({type,fps,pixels,install,animator});
}());
