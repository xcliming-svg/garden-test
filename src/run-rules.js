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
  // Introduce one species at a time; never force the entire roster at the start.
  const enemyUnlocks=Object.freeze([[0,'3_caterpillar'],[180,'4_beetle'],[300,'2_grasshopper'],[420,'2_gray_bug'],[540,'1_butterfly'],[660,'2_frog'],[780,'1_cat'],[900,'6_sparrow'],[1020,'6_mouse'],[1140,'6_rabbit'],[1260,'5_bulldog'],[1380,'6_pigeon']].map(Object.freeze));
  function eligibleEnemies(seconds){return enemyUnlocks.filter(([at])=>seconds>=at).map(([,id])=>id);}
  function population(seconds){return Math.min(tuning.spawnCap,3+Math.floor(Math.max(0,seconds)/30));}
  function spawnInterval(seconds){return seconds<180?3:seconds<300?2.5:seconds<540?2:seconds<900?1.5:seconds<1380?1.2:1;}
  // Full card footprint (including 4px idle lift) stays outside the entire
  // 10x10 garden, not just currently planted cells. Preserve nearest death point.
  function cardPosition(spec,x,y,size,otherCards=[]){
    const h=size/2,lift=4,gap=5,g=spec.garden,b=spec.blueprint;
    const limits={left:h+2,right:spec.width-h-2,top:spec.top+h+lift+2,bottom:spec.height-spec.bottom-h-2};
    const zones=[{left:g.x-gap,right:g.x+g.size+gap,top:g.y-gap,bottom:g.y+g.size+gap},{left:b.x-gap,right:b.x+b.width+gap,top:b.y-gap,bottom:b.y+b.height+gap}];
    const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
    const legal=(p,rects)=>rects.every(r=>p.x+h<=r.left||p.x-h>=r.right||p.y+h<=r.top||p.y-h-lift>=r.bottom);
    const nearest=rects=>{
      const xs=[clamp(x,limits.left,limits.right),limits.left,limits.right],ys=[clamp(y,limits.top,limits.bottom),limits.top,limits.bottom];
      for(const r of rects){xs.push(r.left-h,r.right+h);ys.push(r.top-h,r.bottom+h+lift);}
      let best=null,d=Infinity;
      for(const px of xs)for(const py of ys){
        if(px<limits.left||px>limits.right||py<limits.top||py>limits.bottom)continue;
        const p={x:px,y:py};if(!legal(p,rects))continue;
        const dist=(px-x)**2+(py-y)**2;if(dist<d){best=p;d=dist;}
      }
      return best;
    };
    const cardZones=otherCards.map(c=>({left:c.x-c.size/2-2,right:c.x+c.size/2+2,top:c.y-c.size/2-lift-2,bottom:c.y+c.size/2+2}));
    return nearest([...zones,...cardZones])||nearest(zones);
  }
  const depth=Object.freeze({field:-2,pattern:-1.8,soil:-1,shadow:.75,groundEffect:.8,flower:1,installation:1.8,enemy:3,fairy:4,projectile:6,effects:6.1,relic:7,card:8,blueprint:10,blueprintIcon:11,blueprintText:12,blueprintInput:13,plantGhost:15,hud:16,hudContent:17,slotFrame:18,equipped:20,slotInput:21,slotGhost:22,purchase:23,drag:30,tooltip:40});
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
  window.GardenRunRules=Object.freeze({active,initial,blueprint,tuning,cost,rollDrop,stageAt,completion,population,enemyUnlocks,eligibleEnemies,spawnInterval,cardPosition,depth,create});
}());
