(function(){
  'use strict';
  const active=typeof document!=='undefined'&&document.documentElement.dataset.playable==='true';
  const initial=Object.freeze([[44,'daisy'],[45,'sunflower'],[54,'tulip'],[55,'hydrangea']].map(Object.freeze));
  const blueprint=Object.freeze([[33,'rose'],[34,'daisy'],[35,'sunflower'],[36,'lavender'],[43,'tulip'],...initial,[46,'rose'],[53,'lavender'],[56,'daisy'],[63,'hydrangea'],[64,'rose'],[65,'lavender'],[66,'sunflower']].sort((a,b)=>a[0]-b[0]).map(Object.freeze));
  const tuning=Object.freeze({initialSlots:4,maxSlots:10,costs:Object.freeze([15,25,40,60,85,120]),growthSeconds:8,cardLifetime:45,dropWeights:Object.freeze([.55,.15,.18,.12]),starterRock:'rock',enemyDamage:4,enemyDamagePerLevel:2,spawnCap:65});
  const cost=count=>tuning.costs[count-tuning.initialSlots]??null;
  function rollDrop(random=Math.random){
    const r=random();let total=0;
    const kinds=['gem','heart','flower','item'];
    for(let i=0;i<kinds.length;i++){total+=tuning.dropWeights[i];if(r<total)return kinds[i];}
    return 'item';
  }
  const stageAt=age=>Math.min(3,1+Math.floor((Math.max(0,age)+1e-7)/tuning.growthSeconds));
  function completion(entries){
    const required=new Map(blueprint);let matches=0;
    for(const [id,f] of entries)if(required.get(id)===f.name&&f.stage===3)matches++;
    return Math.floor(100*matches/required.size);
  }
  function population(seconds){return Math.min(tuning.spawnCap,1+Math.floor(Math.max(0,seconds)/12));}
  function create(){
    const state={slotCount:tuning.initialSlots,gems:0,displayGems:0,elapsed:0,kills:0,result:null};
    let from=0,rollTime=0,rolling=false;
    function credit(n=1){state.gems+=n;if(!rolling)state.displayGems=state.gems;}
    function buy(){
      const price=cost(state.slotCount);
      if(state.result||price===null||state.gems<price)return false;
      from=state.displayGems;state.gems-=price;state.slotCount++;rollTime=0;rolling=true;return true;
    }
    function tick(dt){
      if(state.result)return;
      state.elapsed+=dt;
      if(rolling){rollTime+=dt;const t=Math.min(1,rollTime/.65);state.displayGems=Math.max(state.gems,Math.ceil(from+(state.gems-from)*(1-(1-t)**3)));if(t===1){rolling=false;state.displayGems=state.gems;}}
    }
    return {state,credit,buy,tick};
  }
  window.GardenRunRules=Object.freeze({active,initial,blueprint,tuning,cost,rollDrop,stageAt,completion,population,create});
}());
