(function(){
  'use strict';
  // Filled, feathered ground contact shadows; no ring or gameplay change.
  const params=new URLSearchParams(window.location.search);
  const flag=name=>params.get(name)==='1'||(params.get(name)!=='0'&&params.get('shadows')!=='0');
  const config=Object.freeze({enemy:flag('enemyShadow'),fairy:flag('fairyShadow'),contrast:params.get('shadowStyle')!=='dark'});
  const depth=.75;
  function style(){
    const P=window.GardenPalette,light=P.uiType===1;
    if(!config.contrast)return {color:light?P.reference.n.shadow:0,alpha:light?.30:.76,scaleX:1,scaleY:1,offset:1};
    return {color:light?P.reference.n.shadow:P.n.stone,alpha:light?.55:.90,scaleX:1.25,scaleY:1.5,offset:3};
  }
  function create(scene,name,enabled,mask){
    const p=style();
    let shadow;
    if(config.contrast){
      const key='ground-shadow:soft:'+p.color;
      if(!scene.textures.exists(key)){
        const t=scene.textures.createCanvas(key,64,64),ctx=t.getContext();
        const color='#'+p.color.toString(16).padStart(6,'0');
        const gradient=ctx.createRadialGradient(32,32,0,32,32,32);
        gradient.addColorStop(0,color);gradient.addColorStop(.55,color);
        gradient.addColorStop(1,'rgba('+[(p.color>>16)&255,(p.color>>8)&255,p.color&255].join(',')+',0)');
        ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);t.refresh();t.setFilter(Phaser.Textures.FilterMode.LINEAR);
      }
      shadow=scene.add.image(0,0,key);
    }else shadow=scene.add.ellipse(0,0,1,1,p.color,1);
    shadow.setDepth(depth).setName(name).setVisible(enabled);
    if(mask)shadow.setMask(mask);
    return shadow;
  }
  function pose(width,height,lift=0){
    const h=Math.max(0,lift),p=style();
    return {width:width*p.scaleX*Math.max(.5,1-h*.009),height:height*p.scaleY,alpha:p.alpha/(1+h*.055),offset:p.offset};
  }
  function update(shadow,x,ground,width,height,lift=0){
    const p=pose(width,height,lift);
    shadow.setPosition(x,ground+p.offset).setDisplaySize(p.width,p.height).setAlpha(p.alpha);
  }
  window.GardenGroundShadow=Object.freeze({config,depth,create,pose,update,style});
}());
