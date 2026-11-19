(function () {
  'use strict';
  // Preserve the original vector files. The optional palette copies change only
  // vector fills, not shape or resolution. Phaser rasterizes with linear sampling.
  const names=Object.freeze(['daisy','sunflower','tulip','hydrangea','rose','lavender']);
  const enabled=new URLSearchParams(window.location.search).get('flowerheads')!=='1';
  const maxStage=3;
  const sequence=Object.freeze([[1,100],[2,100],[3,100],[3,66],[3,33],[2,100],[2,66],[2,33],[1,100],[1,66],[1,33]].map(Object.freeze));
  const stepSeconds=5,period=sequence.length*stepSeconds,sourceSize=512;
  const key=(name,stage,hp=100)=>'flower-svg:'+name+':'+stage+':'+hp;
  // Preserve the original filenames: logical stages 1–3 use art 2–4.
  function sourceStage(stage){
    if(!Number.isInteger(stage)||stage<1||stage>maxStage)throw Error('Unknown flower stage');
    return stage+1;
  }
  function path(name,stage){
    if(!names.includes(name))throw Error('Unknown flower name');
    const stem='0'+(names.indexOf(name)+1)+'_'+name+'_0'+sourceStage(stage);
    return window.GardenSvgPalette.path('flowers/'+stem+'.svg');
  }
  function stateAt(seconds){
    const [stage,hp]=sequence[Math.floor((Math.max(0,seconds)+1e-7)/stepSeconds)%sequence.length];
    return {stage,hp};
  }
  function preload(scene){
    if(!enabled)return;
    for(const name of names)for(let stage=1;stage<=maxStage;stage++){
      const id=key(name,stage);
      if(!scene.textures.exists(id))scene.load.svg(id,path(name,stage),{width:sourceSize,height:sourceSize});
    }
  }
  function install(scene){
    for(const name of names)for(let stage=1;stage<=maxStage;stage++){
      const id=key(name,stage);
      if(!scene.textures.exists(id))throw Error('Missing original SVG: '+id);
      scene.textures.get(id).setFilter(Phaser.Textures.FilterMode.LINEAR);
      const D=window.GardenFlowerDamage,source=D.prepare(scene.textures.get(id).getSourceImage(),sourceSize);
      for(const hp of [66,33]){
        const k=key(name,stage,hp);
        if(scene.textures.exists(k))continue;
        const t=scene.textures.createCanvas(k,sourceSize,sourceSize);
        D.draw(t.getContext(),source,hp,names.indexOf(name),stage);
        t.refresh();t.setFilter(Phaser.Textures.FilterMode.LINEAR);
      }
    }
  }
  // Every retained stage keeps its previous art size and root (500,856).
  const displaySize=cell=>cell/.85;
  function attach(scene,g){
    install(scene);
    const entries=new Map();
    function plant(index,name,center,born=0,mature=false){
      const size=displaySize(g.cell);
      const image=scene.add.image(center.x,center.y+g.cell/2-1,key(name,1))
        .setOrigin(.5,.856).setDisplaySize(size,size).setDepth(window.GardenRunRules?.active?window.GardenRunRules.depth.flower+center.y/2000:1).setName('garden-preview-flower:'+index);
      entries.set(index,{name,born,image,last:'1:100',stage:1,mature,center});
      return image;
    }
    function render(elapsed){
      for(const [index,entry] of entries){
        const sample=stateAt(elapsed-entry.born),stage=window.GardenRunRules?.active?(entry.mature?3:window.GardenRunRules.stageAt(elapsed-entry.born)):sample.stage;
        entry.stage=stage;
        if(window.GardenRunRules?.active){
          const wrong=window.GardenRunRules.blueprintStatus(entries,index)==='wrong';
          if(wrong&&!entry.wrongLabel){
            // A monochrome 7×9 pixel warning badge remains readable over any flower color.
            const P=window.GardenPalette.n,x=Math.round(entry.center.x+g.cell/2-8),y=Math.round(entry.center.y+g.cell/2-10);
            const badge=window.GardenUI.pixelGraphics(scene).setPosition(x,y).setDepth(window.GardenRunRules.depth.effects+.1).setName('garden-wrong:'+index);
            badge.fillStyle(P.ink,1).fillRect(0,0,7,9);
            badge.fillStyle(P.paper,1).fillRect(3,1,1,4).fillRect(3,6,1,2);
            entry.wrongLabel=badge;
          }
          entry.wrongLabel?.setVisible(wrong);
        }
        const energy=scene.relicCollection?.state.flowers.get(index)?.energy;
        const hp=window.GardenRunRules?.active?(energy===undefined||energy>=67?100:energy>=34?66:33):energy===undefined?sample.hp:energy>=100?100:energy>33?66:33;
        const state=stage+':'+hp;
        if(state===entry.last)continue;
        entry.last=state;
        const size=displaySize(g.cell);
        entry.image.setTexture(key(entry.name,stage,hp)).setDisplaySize(size,size);
      }
    }
    function remove(index){const entry=entries.get(index);if(!entry)return false;entry.wrongLabel?.destroy();entry.image.destroy();entries.delete(index);return true;}
    const controller={entries,plant,render,remove};
    scene.flowerGrowth=controller;
    scene.events.once('shutdown',()=>{entries.clear();delete scene.flowerGrowth;});
    return controller;
  }
  window.GardenFlowerGrowth=Object.freeze({enabled,names,maxStage,sequence,stepSeconds,period,sourceSize,key,path,sourceStage,stateAt,preload,attach,displaySize});
}());
