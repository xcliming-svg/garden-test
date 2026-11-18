(function(){
  'use strict';
  const R=window.GardenRunRules;
  function attach(scene,spec,assets,equipment,layout){
    const I=window.GardenItemCards,G=window.GardenFlowerGrowth,L=window.GardenGameLayout;
    const drops=new Map();let serial=0;
    const choose=items=>items[Math.floor(Math.random()*items.length)];
    function spawn(kind,x,y,id){
      const half=kind==='flower'?assets.flower.dropSize/2:assets.item.dropSize/2;
      x=Math.max(half+2,Math.min(spec.width-half-2,x));
      y=Math.max(spec.top+half+5,Math.min(spec.height-spec.bottom-half-2,y));
      const b=spec.blueprint;
      if(x-half<b.x+b.width&&y-half<b.y+b.height)x=b.x+b.width+half+3;
      if(kind==='flower'&&!id){
        // Bias toward outstanding blueprint flowers; preserve random variety.
        const needed=R.blueprint.filter(([cell,name])=>scene.flowerGrowth.entries.get(cell)?.name!==name).map(([,name])=>name);
        id=choose(needed.length&&Math.random()<.75?needed:G.names);
      }
      if(kind==='item'&&!id)id=choose([...I.entries,I.water]).id;
      const card=I.createDrop(scene,spec,assets,kind,id,x,y,serial++);
      card.age=0;card.kind=kind;card.id=id;
      card.float=L.floatingDrop(card.marker,serial);
      drops.set(card.marker,card);
      if(kind==='flower')scene.runGarden.register(card);else equipment.register(card);
      return card;
    }
    function consume(card){card.consumed=true;}
    function discard(card){
      if(card.kind==='item')equipment.unregister(card);
      drops.delete(card.marker);I.disposeCard(card.marker);
    }
    function result(outcome){
      if(scene.run.state.result)return;
      scene.run.state.result=outcome;
      scene.fairyPatrol.setState(outcome==='Victory'?'win':'lose');
      const state=scene.run.state;
      scene.scene.start(outcome,{elapsed:state.elapsed,kills:scene.enemyPreview.model.kills,gems:state.gems,progress:R.completion(scene.flowerGrowth.entries)});
    }
    let lastGems=-1;
    function update(_time,delta){
      const dt=Math.max(0,delta/1000);
      scene.run.tick(dt);
      for(const card of [...drops.values()]){
        if(card.consumed){discard(card);continue;}
        const dragging=card.kind==='flower'?scene.runGarden.isDragging(card):equipment.isDragging(card);
        if(!dragging)card.age+=dt;
        if(!dragging&&card.age>=R.tuning.cardLifetime){discard(card);continue;}
        card.float(scene.run.state.elapsed*1000);
      }
      if(lastGems!==scene.run.state.gems){lastGems=scene.run.state.gems;layout.updateCost();}
      scene.fairyPatrol.refreshHud();
      if(!scene.runGarden.occupied.size)result('Defeat');
      else if(R.completion(scene.flowerGrowth.entries)===100)result('Victory');
    }
    scene.runDrops={spawn,consume,drops};
    scene.events.on('update',update);
    scene.events.once('shutdown',()=>{scene.events.off('update',update);drops.clear();delete scene.runDrops;delete scene.run;});
    return scene.runDrops;
  }
  window.GardenRunDrops=Object.freeze({attach});
}());
