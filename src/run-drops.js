(function(){
  'use strict';
  const R=window.GardenRunRules;
  function attach(scene,spec,assets,equipment,layout){
    const I=window.GardenItemCards,G=window.GardenFlowerGrowth,L=window.GardenGameLayout;
    const survival=!!R.survival;
    const drops=new Map();let serial=0;
    function spawn(kind,x,y,id,level=1){
      const size=kind==='flower'?assets.flower.dropSize:assets.item.dropSize;
      const p=R.cardPosition(spec,x,y,size,[...drops.values()].filter(c=>!c.consumed).map(c=>({x:c.x,y:c.y,size:c.marker.width})));
      if(!p)throw Error('No legal card position');
      x=p.x;y=p.y;
      if(survival&&kind==='flower')return null;
      if(kind==='flower'&&!id){
        // Bias toward outstanding blueprint flowers; preserve random variety.
        id=R.chooseFlower(scene.flowerGrowth.entries,window.GardenSimulationRng?.flower||Math.random);
      }
      if(kind==='item'&&!id){const choice=scene.run.pickItemCard(window.GardenSimulationRng?.item||Math.random);id=choice.id;level=choice.level;}
      const card=I.createDrop(scene,spec,assets,kind,id,x,y,serial++,level);
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
      const state=scene.run.state;
      // Freeze the entire run. Only the existing fairy emotion animates from ResultScene.
      scene.blueprintRefresh?.();
      scene.runGarden?.refreshSoil(null);
      scene.fairyPatrol.setState(outcome==='Victory'?'win':'lose');
      scene.scene.pause('Game');
      scene.scene.launch(outcome,{elapsed:state.elapsed,kills:scene.enemyPreview.model.kills,gems:state.gems,progress:R.completion(scene.flowerGrowth.entries)});
    }
    let lastGems=-1;
    function update(_time,delta){
      if(scene.run.state.result)return;
      const dt=Math.max(0,delta/1000);
      scene.run.tick(dt);
      for(const card of [...drops.values()]){
        if(card.consumed){discard(card);continue;}
        const dragging=card.kind==='flower'?scene.runGarden?.isDragging(card):equipment.isDragging(card);
        if(!dragging)card.age+=dt;
        if(!dragging&&card.age>=R.tuning.cardLifetime){discard(card);continue;}
        card.float(scene.run.state.elapsed*1000);
      }
      if(lastGems!==scene.run.state.gems){lastGems=scene.run.state.gems;layout.updateCost();}
      scene.fairyPatrol.refreshHud();
      if(!survival){
        if(!scene.runGarden.occupied.size)result('Defeat');
        else if(R.completion(scene.flowerGrowth.entries)===100)result('Victory');
      }
    }
    scene.runDrops={spawn,consume,drops};
    scene.events.on('update',update);
    scene.events.once('shutdown',()=>{scene.events.off('update',update);drops.clear();delete scene.runDrops;delete scene.run;});
    return scene.runDrops;
  }
  window.GardenRunDrops=Object.freeze({attach});
}());
