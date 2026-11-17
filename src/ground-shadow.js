(function(){
  'use strict';
  // Ground-contact ellipses only: no rings, texture or gameplay changes.
  const params=new URLSearchParams(window.location.search);
  const flag=name=>params.get(name)==='1'||(params.get(name)!=='0'&&params.get('shadows')!=='0');
  const config=Object.freeze({enemy:flag('enemyShadow'),fairy:flag('fairyShadow')});
  const depth=.75;
  function create(scene,name,enabled,mask){
    // The previous dark ink matched the default field and its fill/object
    // alphas multiplied. Use an actual darker shade and a single alpha.
    const color=window.GardenPalette.uiType===1?window.GardenPalette.reference.n.shadow:0x000000;
    const shadow=scene.add.ellipse(0,0,1,1,color,1).setDepth(depth).setName(name).setVisible(enabled);
    if(mask)shadow.setMask(mask);
    return shadow;
  }
  function pose(width,height,lift=0){
    const h=Math.max(0,lift),base=window.GardenPalette.uiType===1?.30:.76;
    return {width:width*Math.max(.5,1-h*.009),height,alpha:base/(1+h*.055)};
  }
  function update(shadow,x,ground,width,height,lift=0){
    const p=pose(width,height,lift);
    shadow.setPosition(x,ground+1).setDisplaySize(p.width,p.height).setAlpha(p.alpha);
  }
  window.GardenGroundShadow=Object.freeze({config,depth,create,pose,update});
}());
