// Temporary card factory wrapper, loaded before game-layout.js.
(function(){
  'use strict';
  const t=window.TerrainPreviewTheme;if(!t)return;
  const S=window.GardenTestSprites,R=window.GardenPalette.reference.n;
  const n=h=>parseInt(h.slice(1),16);
  function flowerCard(...args){
    const o=S.flowerCard(...args),face=o.list[1],edge=o.list[0];
    face.setFillStyle(n(t.flowerFace),1);edge.setFillStyle(n(t.flowerEdge),1);
    o.setStrokeStyle=(_width,_color,alpha)=>{edge.setFillStyle(alpha?R.flowerBorder:n(t.flowerEdge),1);return o;};
    return o;
  }
  window.GardenTestSprites=Object.freeze({...S,flowerCard});
}());
