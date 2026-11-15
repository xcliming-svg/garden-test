(function () {
  'use strict';
  // Preserve the supplied vector files; never quantize to a pixel palette or
  // synthesize damage from raster pixels. Phaser's SVG loader performs ordinary
  // high-resolution rasterization for the GPU with linear sampling.
  const names=Object.freeze(['daisy','sunflower','tulip','hydrangea','rose','lavender']);
  const enabled=new URLSearchParams(window.location.search).get('flowerheads')!=='1';
  const sequence=Object.freeze([[1,100],[2,100],[3,100],[4,100],[4,66],[4,33],[3,100],[3,50],[2,100],[2,50],[1,100],[1,50]].map(Object.freeze));
  const stepSeconds=5,period=sequence.length*stepSeconds,sourceSize=512;
  const key=(name,stage,hp=100)=>'flower-svg:'+name+':'+stage+':'+hp;
  function path(name,stage){
    if(!names.includes(name)||!Number.isInteger(stage)||stage<1||stage>4)throw Error('Unknown flower state');
    const stem='0'+(names.indexOf(name)+1)+'_'+name+'_0'+stage;
    return 'assets/flowers/'+stem+'.svg';
  }
  function stateAt(seconds){
    const [stage,hp]=sequence[Math.floor((Math.max(0,seconds)+1e-7)/stepSeconds)%sequence.length];
    return {stage,hp};
  }
  function preload(scene){
    if(!enabled)return;
    for(const name of names)for(let stage=1;stage<=4;stage++){
      const id=key(name,stage);
      if(!scene.textures.exists(id))scene.load.svg(id,path(name,stage),{width:sourceSize,height:sourceSize});
      if(!scene.cache.text.exists(id))scene.load.text(id,path(name,stage));
    }
  }
  function install(scene){
    for(const name of names)for(let stage=1;stage<=4;stage++){
      const id=key(name,stage);
      if(!scene.textures.exists(id))throw Error('Missing original SVG: '+id);
      scene.textures.get(id).setFilter(Phaser.Textures.FilterMode.LINEAR);
      const D=window.GardenFlowerDamage,parts=D.parse(scene.cache.text.get(id));
      for(const hp of stage===4?[66,33]:[50]){
        const k=key(name,stage,hp);
        if(scene.textures.exists(k))continue;
        const t=scene.textures.createCanvas(k,sourceSize,sourceSize);
        D.draw(t.getContext(),parts,name,stage,hp,sourceSize);
        t.refresh();t.setFilter(Phaser.Textures.FilterMode.LINEAR);
      }
    }
  }
  // Maximum original bloom width is <85% of the 1000px artboard.
  // Keep the common authored root at y=856 and fit within the existing cell.
  const displaySize=cell=>cell/.85;
  function attach(scene,g){
    install(scene);
    const entries=new Map();
    function plant(index,name,center,born=0){
      const size=displaySize(g.cell);
      const image=scene.add.image(center.x,center.y+g.cell/2-1,key(name,1))
        .setOrigin(.5,.856).setDisplaySize(size,size).setDepth(1).setName('garden-preview-flower:'+index);
      entries.set(index,{name,born,image,last:'1:100'});
      return image;
    }
    function render(elapsed){
      for(const entry of entries.values()){
        const {stage,hp}=stateAt(elapsed-entry.born),state=stage+':'+hp;
        if(state===entry.last)continue;
        entry.last=state;
        const size=displaySize(g.cell);
        entry.image.setTexture(key(entry.name,stage,hp)).setDisplaySize(size,size);
      }
    }
    const controller={entries,plant,render};
    scene.flowerGrowth=controller;
    scene.events.once('shutdown',()=>{entries.clear();delete scene.flowerGrowth;});
    return controller;
  }
  window.GardenFlowerGrowth=Object.freeze({enabled,names,sequence,stepSeconds,period,sourceSize,key,path,stateAt,preload,attach,displaySize});
}());
