(function(){
  'use strict';
  // The default devel survival run is a four-plot watering/harvesting trial.
  // ?plot=a|c changes the visual representation, and ?harvest=auto|space
  // changes harvesting only. ?farm=legacy keeps the old survival comparator.
  const params=new URLSearchParams(window.location.search);
  const enabled=!!window.GardenRunRules?.survival&&params.get('farm')!=='legacy';
  const config=Object.freeze({
    plot:params.get('plot')==='c'?'c':'a',
    harvest:params.get('harvest')==='space'?'space':'auto'
  });
  const names=Object.freeze(['sunflower','rose','hydrangea','lavender']);
  const korean=Object.freeze(['해바라기','장미','수국','라벤더']);
  const origins=Object.freeze([[0,0],[3,0],[0,3],[3,3]].map(Object.freeze));
  const tuning=Object.freeze({maxWater:100,waterPerKill:20,waterPerSecond:25,maxGrowth:100,noticeSeconds:1.3});
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
  const plotIndex=cell=>Math.floor((cell%6)/3)+2*Math.floor(Math.floor(cell/6)/3);
  const centerCell=id=>(Math.floor(id/2)*3+1)*6+(id%2)*3+1;
  function create(options=config){
    const state={
      water:0,
      plots:names.map((name,id)=>({id,name,progress:0,count:0})),
      lastHarvest:null
    };
    const isReady=id=>state.plots[id]?.progress>=tuning.maxGrowth;
    const stage=id=>{
      const progress=state.plots[id]?.progress||0;
      return progress>=67?3:progress>=34?2:1;
    };
    function gainWater(amount=tuning.waterPerKill){
      if(!Number.isFinite(amount)||amount<=0)return 0;
      const before=state.water;
      state.water=clamp(state.water+amount,0,tuning.maxWater);
      return state.water-before;
    }
    function harvest(id){
      if(!isReady(id))return false;
      const plot=state.plots[id];
      plot.count++;
      plot.progress=0;
      state.lastHarvest={id,count:plot.count};
      return true;
    }
    function water(dt,id){
      if(!Number.isInteger(id)||id<0||id>=4||!Number.isFinite(dt)||dt<=0)return 0;
      const plot=state.plots[id];
      if(isReady(id)||state.water<=0)return 0;
      const consumed=Math.min(tuning.waterPerSecond*dt,state.water,tuning.maxGrowth-plot.progress);
      state.water=clamp(state.water-consumed,0,tuning.maxWater);
      plot.progress=clamp(plot.progress+consumed,0,tuning.maxGrowth);
      if(isReady(id)&&options.harvest==='auto')harvest(id);
      return consumed;
    }
    return {state,stage,isReady,gainWater,water,harvest};
  }
  function attach(scene,spec,patrol){
    if(!enabled)return null;
    const model=create(),g=spec.garden,D=window.GardenRunRules.depth,P=window.GardenPalette.n;
    const centers=origins.map(([col,row])=>({
      x:g.x+(col+1.5)*g.pitch+g.line/2,
      y:g.y+(row+1.5)*g.pitch+g.line/2
    }));
    const crop=scene.add.graphics().setDepth(D.soil+.1).setName('harvest-plots');
    for(const [col,row] of origins){
      const x=g.x+col*g.pitch,y=g.y+row*g.pitch;
      crop.fillStyle(P.bark,.16).fillRect(x,y,3*g.pitch,3*g.pitch);
      crop.lineStyle(1,P.growth,.35).strokeRect(x+.5,y+.5,3*g.pitch-1,3*g.pitch-1);
    }
    const gauges=scene.add.graphics().setDepth(D.effects).setName('harvest-plot-gauges');
    const droplet=scene.add.graphics().setDepth(D.effects).setName('harvest-water-droplet');
    const font={fontFamily:'Garden Fusion',fontSize:'10px',color:'#F4F1E9'};
    const waterText=scene.add.text(0,0,'0%',{...font,align:'center'}).setOrigin(.5,.5)
      .setDepth(D.effects+.01).setName('harvest-water-label');
    const readyLabels=centers.map((c,id)=>scene.add.text(c.x,c.y-3,'MAX',{...font,color:'#F6BB48'})
      .setOrigin(.5,.5).setDepth(D.effects+.01).setName('harvest-ready:'+id).setVisible(false));
    const bonus=scene.add.text(0,0,'+1',{...font,fontSize:'16px',color:'#F6BB48'})
      .setOrigin(.5,.5).setDepth(D.effects+.1).setName('harvest-bonus').setVisible(false);
    let bonusTime=0;
    const key=scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    scene.input.keyboard.addCapture(Phaser.Input.Keyboard.KeyCodes.SPACE);
    let pressBlocked=false,keyHeld=false,touchPointer=null;
    const held=()=>keyHeld||touchPointer!==null;
    const nearest=()=>{
      const hero=patrol.actors[0]?.center;
      if(!hero)return -1;
      let winner=0,dist=Infinity;
      centers.forEach((c,id)=>{
        const d=(c.x-hero.x)**2+(c.y-hero.y)**2;
        if(d<dist){dist=d;winner=id;}
      });
      return winner;
    };
    const lastCounts=Array(4).fill(-1);
    function refreshCounts(){
      model.state.plots.forEach((plot,id)=>{
        if(plot.count===lastCounts[id])return;
        lastCounts[id]=plot.count;
        scene.children.getByName('harvest-count:'+plot.name)?.setText(korean[id]+' '+plot.count);
      });
    }
    function showHarvest(id){
      const c=centers[id];
      bonus.setPosition(c.x,c.y-20).setVisible(true);
      bonusTime=tuning.noticeSeconds;
      refreshCounts();
    }
    // Space and a touch on the game canvas are two sources for the same
    // held action. Only the first press can start watering or harvest a crop.
    function beginHold(){
      const id=nearest();
      if(config.harvest==='space'&&model.isReady(id)){
        if(model.harvest(id))showHarvest(id);
        pressBlocked=true;
      }
      patrol.setPaused(true);
    }
    function endHold(){
      pressBlocked=false;
      patrol.setPaused(false);
    }
    function onDown(){
      if(keyHeld)return;
      const alreadyHeld=held();
      keyHeld=true;
      if(!alreadyHeld)beginHold();
    }
    function onUp(){
      if(!keyHeld)return;
      keyHeld=false;
      if(!held())endHold();
    }
    const isTouch=pointer=>pointer?.wasTouch===true||
      pointer?.event?.pointerType==='touch'||
      pointer?.event?.type?.startsWith('touch');
    function onTouchDown(pointer){
      if(!isTouch(pointer)||touchPointer!==null)return;
      const alreadyHeld=held();
      touchPointer=pointer.id;
      if(!alreadyHeld)beginHold();
    }
    function onTouchUp(pointer){
      if(pointer.id!==touchPointer)return;
      touchPointer=null;
      if(!held())endHold();
    }
    function cancelTouch(){
      if(touchPointer===null)return;
      touchPointer=null;
      if(!held())endHold();
    }
    scene.input.keyboard.on('keydown-SPACE',onDown);
    scene.input.keyboard.on('keyup-SPACE',onUp);
    scene.input.on('pointerdown',onTouchDown);
    scene.input.on('pointerup',onTouchUp);
    scene.input.on('pointerupoutside',onTouchUp);
    scene.input.on('gameout',cancelTouch);
    scene.game.canvas.addEventListener('touchcancel',cancelTouch);
    window.addEventListener('blur',cancelTouch);
    const colors=[P.gold,P.red,P.sky,P.lavender];
    function render(){
      gauges.clear();
      model.state.plots.forEach((plot,id)=>{
        const [col,row]=origins[id],x=g.x+col*g.pitch+5,y=g.y+row*g.pitch-7,w=3*g.pitch-10;
        gauges.fillStyle(P.slate,.92).fillRect(x,y,w,5);
        if(plot.progress>0){
          gauges.fillStyle(colors[id],1).fillRect(x+1,y+1,Math.round((w-2)*plot.progress/100),3);
        }
        readyLabels[id].setVisible(model.isReady(id));
      });
      const hero=patrol.actors[0];
      if(!hero)return;
      const v=hero.direction==='left'?[-1,0]:hero.direction==='right'?[1,0]:
        hero.direction==='up'?[0,-1]:[0,1];
      const x=hero.center.x+v[0]*24,y=hero.center.y+v[1]*24-12;
      droplet.clear();
      droplet.fillStyle(P.slate,.95).fillCircle(x,y+3,9);
      droplet.fillTriangle(x,y-11,x-8,y+1,x+8,y+1);
      const h=Math.round(15*model.state.water/tuning.maxWater);
      if(h>0)droplet.fillStyle(P.sky,1).fillRect(x-5,y+9-h,10,h);
      droplet.lineStyle(1,P.paper,1).strokeCircle(x,y+3,9);
      waterText.setPosition(x,y+21).setText(model.state.water>=100?'MAX':Math.floor(model.state.water)+'%');
      bonus.setVisible(bonusTime>0);
    }
    function update(_time,delta){
      const dt=Math.min(.1,Math.max(0,delta/1000));
      scene.run?.tick(dt);
      if(held()&&!pressBlocked){
        const id=nearest();
        const before=model.isReady(id);
        model.water(dt,id);
        if(!before&&model.state.lastHarvest?.id===id){
          const plot=model.state.plots[id];
          if(plot.progress===0&&config.harvest==='auto'){
            showHarvest(id);
            // One harvested plot per key hold; release Space to start a new cycle.
            pressBlocked=true;
          }
          model.state.lastHarvest=null;
        }
      }
      if(bonusTime>0)bonusTime=Math.max(0,bonusTime-dt);
      render();
    }
    const controller={config,model,centers,nearest,gainWater:amount=>model.gainWater(amount),
      stageAt:cell=>model.stage(plotIndex(cell)),setPaused:patrol.setPaused,
      get state(){return model.state;}};
    scene.gardenHarvest=controller;
    scene.events.on('update',update);
    scene.events.once('shutdown',()=>{
      scene.events.off('update',update);
      scene.input.keyboard.off('keydown-SPACE',onDown);
      scene.input.keyboard.off('keyup-SPACE',onUp);
      scene.input.off('pointerdown',onTouchDown);
      scene.input.off('pointerup',onTouchUp);
      scene.input.off('pointerupoutside',onTouchUp);
      scene.input.off('gameout',cancelTouch);
      scene.game.canvas.removeEventListener('touchcancel',cancelTouch);
      window.removeEventListener('blur',cancelTouch);
      scene.input.keyboard.removeCapture(Phaser.Input.Keyboard.KeyCodes.SPACE);
      patrol.setPaused(false);
      delete scene.gardenHarvest;
    });
    refreshCounts();render();
    return controller;
  }
  window.GardenHarvest=Object.freeze({enabled,config,names,korean,origins,tuning,plotIndex,centerCell,create,attach});
}());
