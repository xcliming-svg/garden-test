(function(){
  'use strict';
  const P=window.GardenPalette.n,U=window.GardenUI;
  function installBall(scene){
    if(scene.textures.exists('combat:ball'))return;
    const n=8,t=scene.textures.createCanvas('combat:ball',n,n),ctx=t.getContext(),im=ctx.createImageData(n,n);
    for(let y=0;y<n;y++)for(let x=0;x<n;x++){
      const d=Math.hypot(x-3.5,y-3.5);
      if(d>3.9)continue;
      const c=d<=2.9?P.gold:P.slate;
      im.data.set([(c>>16)&255,(c>>8)&255,c&255,255],(y*n+x)*4);
    }
    ctx.putImageData(im,0,0);t.refresh();t.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  function card(scene,x,y,size,iconSize,kind='card',name,flowerSize=22){
    installBall(scene);
    const R=window.GardenPalette.reference.n;
    const border=U.pixelBox(scene,0,0,size,size,R.tabBorder);
    const face=U.pixelBox(scene,0,0,size-2,size-2,R.tab,{cut:false});
    const tex=kind==='flower'?window.GardenFlowerHeadPreview.key(name,flowerSize):'combat:ball';
    const image=scene.add.image(0,0,tex).setDisplaySize(iconSize,iconSize);
    const group=scene.add.container(x,y,[border,face,image]).setSize(size,size);
    group.setStrokeStyle=(_width,_color,alpha)=>{
      border.setFillStyle(alpha?(kind==='flower'?R.flowerBorder:R.itemBorder):R.tabBorder,1);return group;
    };
    return group;
  }
  const ballItem=Object.freeze({name:'공 카드',desc:'자동 공격 발사체 +1 · 균등 방사형 발사',stats:Object.freeze({})});
  function attach(scene,spec,garden,itemPreview){
    installBall(scene);
    const L=window.GardenGameLayout,g=spec.garden,actors=new Map();
    let dragging=null,target=-1;
    const ghost=scene.add.image(0,0,window.GardenFlowerHeadPreview.key('daisy',g.cell))
      .setDepth(15).setAlpha(0.45).setVisible(false).setName('combat-flower-ghost');
    const point=p=>scene.cameras.main.getWorldPoint(p.x,p.y);
    const hit=p=>L.gardenHit(p.x,p.y,g);
    function refresh(){
      garden.refresh(dragging?target:null);
      ghost.setVisible(false);
      if(dragging&&L.gardenCandidates(garden.occupied).has(target)){
        const p=garden.center(target);
        ghost.setTexture(window.GardenFlowerHeadPreview.key(dragging.data.name,g.cell))
          .setDisplaySize(g.cell,g.cell).setPosition(p.x,p.y).setVisible(true);
      }
    }
    function move(pointer){
      if(!dragging)return;
      const p=point(pointer);
      const next=hit(p),valid=L.gardenCandidates(garden.occupied).has(next);
      if(next!==target){target=next;refresh();}
      dragging.obj.setPosition(p.x,p.y).setAlpha(valid?0.25:1);
    }
    function finish(pointer,accept){
      if(!dragging)return;
      const entry=dragging,d=entry.data,i=accept&&pointer?hit(point(pointer)):-1;
      dragging=null;target=-1;d.dragging=false;
      entry.obj.setPosition(d.x,d.y).setAlpha(1).setDepth(5).setStrokeStyle(0,0,0);
      if(L.gardenCandidates(garden.occupied).has(i)&&garden.plant(entry.model,d,i)){
        entry.obj.disableInteractive().setVisible(false);
      }
      refresh();
    }
    function create(d,model){
      let obj;
      if(d.kind==='gem'){
        obj=scene.add.rectangle(d.x,d.y,L.assets.gem.size,L.assets.gem.size,P.sky)
          .setStrokeStyle(1,P.slate).setDepth(4).setName('combat-drop:gem:'+d.id);
      }else{
        const size=d.kind==='flower'?L.assets.flower.dropSize:L.assets.item.dropSize;
        obj=card(scene,d.x,d.y,size,16,d.kind,d.name,g.cell).setDepth(5).setName('combat-drop:'+d.kind+':'+d.id);
      }
      const entry={data:d,obj,model};
      if(d.kind==='card'){
        entry.card={id:d.id,marker:obj,x:d.x,y:d.y,item:ballItem,drop:d,consumed:false};
        itemPreview.register(entry.card);
      }else if(d.kind==='flower'){
        obj.setInteractive({useHandCursor:true,draggable:true});scene.input.setDraggable(obj);
        obj.on('pointerover',()=>{if(!dragging)obj.setStrokeStyle(1,P.growth,1);});
        obj.on('pointerout',()=>{if(!dragging)obj.setStrokeStyle(0,0,0);});
        obj.on('dragstart',p=>{
          if(dragging)return;
          dragging=entry;d.dragging=true;target=-1;
          obj.setDepth(30).setStrokeStyle(1,P.growth,1);refresh();move(p);
        });
        obj.on('drag',p=>{if(dragging===entry)move(p);});
        obj.on('dragend',p=>{if(dragging===entry)finish(p,true);});
      }
      actors.set(d.id,entry);
    }
    function sync(drops,model){
      const ids=new Set();
      for(const d of drops){ids.add(d.id);if(!actors.has(d.id))create(d,model);}
      for(const [id,e] of actors)if(!ids.has(id)){
        if(e.card)itemPreview.unregister(e.card);
        e.obj.destroy();actors.delete(id);
      }
    }
    const cancel=()=>finish(null,false);
    scene.input.on('gameout',cancel);scene.events.on('pause',cancel);
    scene.events.once('shutdown',()=>{scene.input.off('gameout',cancel);scene.events.off('pause',cancel);actors.clear();});
    return {sync};
  }
  window.GardenLootPreview=Object.freeze({installBall,card,attach,ballItem});
}());
