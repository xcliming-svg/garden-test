(function(){
  'use strict';
  const active=typeof document!=='undefined'&&document.documentElement.dataset.playable==='true';
  const initial=Object.freeze([[44,'daisy'],[45,'sunflower'],[54,'tulip'],[55,'hydrangea']].map(Object.freeze));
  const blueprint=Object.freeze([[33,'rose'],[34,'daisy'],[35,'sunflower'],[36,'lavender'],[43,'tulip'],...initial,[46,'rose'],[53,'lavender'],[56,'daisy'],[63,'hydrangea'],[64,'rose'],[65,'lavender'],[66,'sunflower']].sort((a,b)=>a[0]-b[0]).map(Object.freeze));
  const tuning=Object.freeze({initialSlots:4,maxSlots:10,costs:Object.freeze([40,60,85,115,150,200]),growthSeconds:8,uprootSeconds:3,cardLifetime:45,dropWeights:Object.freeze([.69,.10,.18,.03]),itemInterval:30,starterRock:'rock',enemyDamage:4,enemyDamagePerLevel:2,spawnCap:65});
  const cost=count=>tuning.costs[count-tuning.initialSlots]??null;
  function rollDrop(random=Math.random){
    const r=random();let total=0;
    const kinds=['gem','heart','flower','item'];
    for(let i=0;i<kinds.length;i++){total+=tuning.dropWeights[i];if(r<total)return kinds[i];}
    return 'item';
  }
  const stageAt=age=>Math.min(3,1+Math.floor((Math.max(0,age)+1e-7)/tuning.growthSeconds));
  const required=new Map(blueprint);
  function blueprintStatus(entries,id){
    if(!required.has(id))return null;
    const f=entries.get(id);
    return !f?'empty':f.stage!==3?'growing':f.name!==required.get(id)?'wrong':'complete';
  }
  function completion(entries){
    let matches=0;
    for(const id of required.keys())if(blueprintStatus(entries,id)==='complete')matches++;
    return Math.floor(100*matches/required.size);
  }
  function plantCandidates(occupied){
    const result=new Set();
    for(const i of occupied)for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]){
      const x=i%10+dx,y=Math.floor(i/10)+dy,id=y*10+x;
      if(x>=0&&x<10&&y>=0&&y<10&&required.has(id)&&!occupied.has(id))result.add(id);
    }
    return result;
  }
  function canPlant(occupied,entries,id,name){
    return required.has(id)&&plantCandidates(occupied).has(id);
  }
  // Clockwise full outline shrinks backwards to its start as the hold advances.
  function uprootOutline(x,y,size,remaining){
    let length=4*size*Math.max(0,Math.min(1,remaining));
    const points=[[x,y],[x+size,y],[x+size,y+size],[x,y+size],[x,y]],segments=[];
    for(let i=0;i<4&&length>0;i++){
      const [ax,ay]=points[i],[bx,by]=points[i+1],t=Math.min(1,length/size);
      segments.push({x1:ax,y1:ay,x2:ax+(bx-ax)*t,y2:ay+(by-ay)*t});length-=size;
    }
    return segments;
  }
  // Introduce one species at a time; never force the entire roster at the start.
  const enemyUnlocks=Object.freeze([[0,'3_caterpillar'],[180,'4_beetle'],[300,'2_grasshopper'],[420,'2_gray_bug'],[540,'1_butterfly'],[660,'2_frog'],[780,'1_cat'],[900,'6_sparrow'],[1020,'6_mouse'],[1140,'6_rabbit'],[1260,'5_bulldog'],[1380,'6_pigeon']].map(Object.freeze));
  function eligibleEnemies(seconds){return enemyUnlocks.filter(([at])=>seconds>=at).map(([,id])=>id);}
  // Each row is [start, interval, live cap, batch, weighted NEW arrivals].
  // Existing living enemies are never removed at a wave boundary.
  const C='3_caterpillar',B='4_beetle',G='2_grasshopper',P='2_gray_bug',F='1_butterfly',J='2_frog',K='1_cat',S='6_sparrow',M='6_mouse',R='6_rabbit',D='5_bulldog',V='6_pigeon';
  const waves=Object.freeze([
    [0,3,3,1,[[C,1]]],[30,2.5,4,1,[[C,1]]],[90,2,7,1,[[C,1]]],
    [180,3,6,1,[[B,7],[C,3]]],[240,2,9,1,[[C,7],[B,3]]],
    [270,1.2,12,1,[[B,7],[C,3]]],[300,1.1,18,2,[[G,7],[C,3]]],[360,1,24,2,[[G,4],[B,3],[C,3]]],
    [420,1,28,2,[[P,7],[B,3]]],[480,.9,32,2,[[C,4],[P,3],[G,3]]],
    [540,.9,36,2,[[F,7],[C,3]]],[600,.8,40,2,[[F,4],[G,3],[B,3]]],
    [660,2.5,13,1,[[J,7],[P,3]]],[720,1.8,22,2,[[J,4],[F,3],[C,3]]],
    [780,2.6,15,1,[[K,7],[B,3]]],[840,1.7,25,2,[[K,3],[P,4],[G,3]]],
    [900,2.5,16,1,[[S,7],[F,3]]],[960,1.6,29,2,[[S,3],[J,4],[C,3]]],
    [1020,2.5,19,1,[[M,7],[B,3]]],[1080,1.6,33,2,[[M,3],[K,3],[G,4]]],
    [1140,2.4,22,1,[[R,7],[J,3]]],[1200,1.5,37,2,[[R,3],[S,3],[P,4]]],
    [1260,2.4,25,1,[[D,7],[K,3]]],[1320,1.4,42,2,[[D,3],[M,3],[F,4]]],
    [1380,2.2,28,1,[[V,7],[S,3]]],[1440,1.3,48,2,[[V,3],[R,3],[D,4]]],
    [1560,1.2,65,2,[[M,3],[D,3],[V,4]]]
  ].map(([start,interval,cap,batch,pool])=>Object.freeze({start,interval,cap,batch,pool:Object.freeze(pool.map(Object.freeze))})));
  function waveAt(seconds){return waves.findLast(w=>seconds+1e-7>=w.start)||waves[0];}
  function population(seconds){return waveAt(seconds).cap;}
  function spawnInterval(seconds){return waveAt(seconds).interval;}
  const itemUnlocks=Object.freeze([[0,['rock','boomerang','shoe','shield']],[90,['water-fairy','balloon']],[180,['wheel','flowerpot']],[300,['paper-plane','bouncy-ball']],[420,['yellow-floor','broom']],[540,['sprinkler']]].map(([at,ids])=>Object.freeze([at,Object.freeze(ids)])));
  const itemPool=seconds=>itemUnlocks.flatMap(([at,ids])=>seconds>=at?ids:[]);
  function pickItem(seconds,random=Math.random){
    const pool=itemPool(seconds);
    return pool[Math.min(pool.length-1,Math.floor(random()*pool.length))];
  }
  // Reserve the full 10x10 garden and its possible fairy sweep even on a small blueprint.
  function resultPanel(spec,swept){
    const margin=14,g=spec.garden,protectedRight=Math.max(g.x+g.size+65,swept?.right??0);
    const w=Math.min(280,Math.floor(spec.width-margin-protectedRight-12));
    if(w<240)throw Error('Insufficient result panel space beside garden');
    const h=280,top=Math.floor(spec.top+(spec.height-spec.top-spec.bottom-h)/2);
    return {x:spec.width-margin-w/2,w,top,bottom:top+h};
  }
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
    const state={slotCount:tuning.initialSlots,gems:0,displayGems:0,elapsed:0,kills:0,result:null,lastItemAt:-Infinity};
    let from=0,rollTime=0,rolling=false;
    function credit(n=1){state.gems+=n;if(!rolling)state.displayGems=state.gems;}
    function rewardDrop(random=Math.random){
      const raw=rollDrop(random);
      if(raw!=='item')return raw;
      const t=state.elapsed;
      if(t-state.lastItemAt+1e-7<tuning.itemInterval)return 'gem';
      state.lastItemAt=t;return 'item';
    }
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
    return {state,credit,buy,tick,rewardDrop};
  }
  window.GardenRunRules=Object.freeze({active,initial,blueprint,tuning,cost,rollDrop,stageAt,completion,blueprintStatus,plantCandidates,canPlant,uprootOutline,population,enemyUnlocks,eligibleEnemies,spawnInterval,waves,waveAt,itemPool,pickItem,resultPanel,cardPosition,depth,create});
}());
