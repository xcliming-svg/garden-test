(function(){
  'use strict';
  const active=typeof document!=='undefined'&&document.documentElement.dataset.playable==='true';
  const config=window.GardenSimulationConfig||{},FB=window.GardenFairyFlowerbeds,flowerbeds=!!FB?.enabled;
  const defaultInitial=[[44,'daisy'],[45,'sunflower'],[54,'tulip'],[55,'hydrangea']];
  const freezeCells=rows=>Object.freeze(rows.map(row=>Object.freeze([...row])).sort((a,b)=>a[0]-b[0]));
  const flowerNames=Object.freeze({D:'daisy',S:'sunflower',T:'tulip',H:'hydrangea',R:'rose',L:'lavender'});
  const makePattern=(id,label,rows,x0,y0)=>{
    const blueprint=freezeCells(rows.flatMap((row,y)=>Array.from(row).flatMap((key,x)=>flowerNames[key]?[[10*(y+y0)+x+x0,flowerNames[key]]]:[])));
    const initial=freezeCells(blueprint.filter(([cell])=>[44,45,54,55].includes(cell)));
    return Object.freeze({id,label,blueprint,initial});
  };
  const legacyCatalog=Object.freeze([
    Object.freeze({id:'classic',label:'정사각형 · 입문',blueprint:freezeCells([[33,'rose'],[34,'daisy'],[35,'sunflower'],[36,'lavender'],[43,'tulip'],...defaultInitial,[46,'rose'],[53,'lavender'],[56,'daisy'],[63,'hydrangea'],[64,'rose'],[65,'lavender'],[66,'sunflower']]),initial:freezeCells(defaultInitial)}),
    ...[["cross","십자 · 입문",["..SS..",".SDDS.","SDDDDS",".SDDS.","..SS.."],2,2],["heart","하트 · 초급",[".RR.RR.","RRRRRRR","RRDDDRR",".RTTTR.","..TTT..","...T..."],1,2],["flower","꽃 · 중급",["...SS...","..SSSS..",".SSDDSS.","SSDDDDSS",".SSDDSS.","..SSSS..","...SS..."],1,1],["butterfly","나비 · 중급",["LL...LL","LHL.LHL","LHHSHHL",".HHSHH.","LTTSTTL","LT...TL"],1,2],["large-heart","큰 하트 · 확장 실험",[".RRR..RRR.","RRRRRRRRRR","RRRDDDDRRR","RRRDDDDRRR",".RRTTTTRR.","..RTTTTR..","...TTTT...","....TT...."],0,1]].map(row=>makePattern(...row))
  ]);
  const campaignCatalog=window.GardenCampaignV3?.stages||[];
  const catalog=window.GardenSimulationConfig?legacyCatalog:Object.freeze([...campaignCatalog,...legacyCatalog]);
  let campaign=active&&!window.GardenSimulationConfig&&!flowerbeds?campaignCatalog[0]||null:null;
  let selectedBlueprintId=flowerbeds?'flowerbeds':campaign?.id||'classic';
  let initial=freezeCells(flowerbeds?FB.initial:config.initial||campaign?.initial||legacyCatalog[0].initial);
  let blueprint=freezeCells(flowerbeds?[...FB.rings].map(id=>[id,'daisy']):config.blueprint||campaign?.blueprint||legacyCatalog[0].blueprint);
  const flowerWeights=Object.freeze({...Object.fromEntries(Object.values(flowerNames).map(name=>[name,1])),...config.flowerWeights});
  const baseTuning=Object.freeze({initialSlots:4,maxSlots:10,costs:Object.freeze([40,60,85,115,150,200]),growthSeconds:8,uprootSeconds:3,cardLifetime:45,dropWeights:Object.freeze([.69,.10,.18,.03]),itemInterval:30,starterRock:'rock',enemyDamage:4,enemyDamagePerLevel:2,spawnCap:65,neededFlowerBias:.75,startingGems:0,gemValue:1,...config.run});
  let tuning=baseTuning;
  const damageToFlower=(entry,defense=0)=>Math.max(1,(config.enemyDamage?.[entry.id]??(tuning.enemyDamage+(entry.level-1)*tuning.enemyDamagePerLevel))-defense);
  const canEquip=(equipped,index,item)=>{const next=equipped.slice();next[index]=item;return next.some(i=>i?.stats.dps>0);};
  function chooseFlower(entries,random=Math.random){
    if(flowerbeds){
      const names=window.GardenFlowerGrowth.names;
      const incomplete=FB.beds.map(b=>FB.counts(b,entries,false)).filter(c=>Object.values(c).reduce((a,b)=>a+b,0)>0&&Object.values(c).reduce((a,b)=>a+b,0)<8);
      const preferred=incomplete.flatMap(c=>Object.keys(c).filter(n=>c[n]>0));
      const pool=preferred.length&&random()<.5?preferred:names;
      return pool[Math.min(pool.length-1,Math.floor(random()*pool.length))];
    }
    const missing=blueprint.filter(([cell,name])=>entries.get(cell)?.name!==name);
    const frontier=campaign?plantCandidates(new Set(entries.keys())):null;
    const ready=frontier?missing.filter(([cell])=>frontier.has(cell)):[];
    const needed=(ready.length?ready:missing).map(([,name])=>name);
    const pool=needed.length&&random()<tuning.neededFlowerBias?needed:(campaign?.flowerPool||window.GardenFlowerGrowth.names);
    const total=pool.reduce((sum,name)=>sum+flowerWeights[name],0);
    if(total<=0)return pool[Math.min(pool.length-1,Math.floor(random()*pool.length))];
    let roll=random()*total;
    for(const name of pool){roll-=flowerWeights[name];if(roll<0)return name;}
    return pool.at(-1);
  }
  const cost=count=>tuning.costs[count-tuning.initialSlots]??null;
  function rollDrop(random=Math.random){
    const r=random();let total=0;
    const kinds=['gem','heart','flower','item'];
    for(let i=0;i<kinds.length;i++){total+=tuning.dropWeights[i];if(r<total)return kinds[i];}
    return 'item';
  }
  const stageAt=age=>Math.min(3,1+Math.floor((Math.max(0,age)+1e-7)/tuning.growthSeconds));
  const required=new Map(blueprint);
  function selectBlueprint(id){
    if(flowerbeds||config.blueprint||config.initial)return false; // explicit simulation configuration takes precedence
    const pattern=campaignCatalog.find(p=>p.id===id)||legacyCatalog.find(p=>p.id===id);if(!pattern)return false;
    campaign=campaignCatalog.includes(pattern)?pattern:null;
    selectedBlueprintId=id;initial=pattern.initial;blueprint=pattern.blueprint;
    required.clear();for(const [cell,name] of blueprint)required.set(cell,name);
    applyPaceTrial(id);
    return true;
  }
  function blueprintStatus(entries,id){
    if(flowerbeds){const f=entries.get(id);return FB.rings.has(id)?!f?'empty':f.stage===3?'complete':'growing':null;}
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
    if(flowerbeds)return FB.candidates(occupied);
    const result=new Set();
    for(const i of occupied)for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]){
      const x=i%10+dx,y=Math.floor(i/10)+dy,id=y*10+x;
      if(x>=0&&x<10&&y>=0&&y<10&&required.has(id)&&!occupied.has(id))result.add(id);
    }
    return result;
  }
  function canPlant(occupied,entries,id,name){
    return flowerbeds?FB.canPlant(entries,id,name):required.has(id)&&plantCandidates(occupied).has(id);
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
  const enemyUnlocks=Object.freeze((config.enemyUnlocks||[[0,'3_caterpillar'],[180,'4_beetle'],[300,'2_grasshopper'],[420,'2_gray_bug'],[540,'1_butterfly'],[660,'2_frog'],[780,'1_cat'],[900,'6_sparrow'],[1020,'6_mouse'],[1140,'6_rabbit'],[1260,'5_bulldog'],[1380,'6_pigeon']]).map(Object.freeze));
  function eligibleEnemies(seconds){return (campaign?.patch.enemyUnlocks||enemyUnlocks).filter(([at])=>seconds>=at).map(([,id])=>id);}
  // Each row is [start, interval, live cap, batch, weighted NEW arrivals].
  // Existing living enemies are never removed at a wave boundary.
  const C='3_caterpillar',B='4_beetle',G='2_grasshopper',P='2_gray_bug',F='1_butterfly',J='2_frog',K='1_cat',S='6_sparrow',M='6_mouse',R='6_rabbit',D='5_bulldog',V='6_pigeon';
  const baseWaves=Object.freeze((config.waves||[
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
  ]).map(([start,interval,cap,batch,pool])=>Object.freeze({start,interval,cap,batch,pool:Object.freeze(pool.map(Object.freeze))})));
  // devel human playtest: profiles selected by the repeated pace study. Explicit
  // simulation configs (including {}) always bypass the trial to preserve baselines.
  const paceProfiles=Object.freeze({
    classic:Object.freeze({interval:1.25,cap:8,batch:2,flower:.065,item:.04,cooldown:35}),
    cross:Object.freeze({interval:2.5,cap:11,batch:2,flower:.10,item:.08,cooldown:15}),
    heart:Object.freeze({interval:2,cap:8,batch:2,flower:.09,item:.06,cooldown:30})
  });
  let waves=baseWaves;
  const classicSupply=Object.freeze({cap:3});
  let itemSupply=null;
  function applyPaceTrial(id){
    const p=active&&!window.GardenSimulationConfig?paceProfiles[id]:null;
    tuning=baseTuning;waves=baseWaves;itemSupply=p&&id==='classic'?classicSupply:null;
    if(flowerbeds){tuning=Object.freeze({...baseTuning,dropWeights:Object.freeze([.20,.15,.60,.05])});return;}
    if(campaign){tuning=Object.freeze({...baseTuning,...campaign.patch.run});waves=Object.freeze(campaign.patch.waves.map(([start,interval,cap,batch,pool])=>Object.freeze({start,interval,cap,batch,pool})));itemSupply=Object.freeze({cap:campaign.itemCap});return;}
    if(!p)return;
    const round=x=>Math.round(x*10000)/10000;
    tuning=Object.freeze({...baseTuning,dropWeights:Object.freeze([round(.9-p.flower-p.item),.10,p.flower,p.item]),itemInterval:p.cooldown});
    const caps=[0,2,4,5,6,7],scales=[1,.9,.8,.8,.75,.7];
    waves=Object.freeze(baseWaves.map((w,i)=>i>=6?w:Object.freeze({...w,interval:round(Math.min(w.interval,p.interval*scales[i])),cap:Math.max(w.cap,p.cap+caps[i]),batch:Math.max(w.batch,p.batch)})));
  }
  applyPaceTrial(selectedBlueprintId);
  function waveAt(seconds){return waves.findLast(w=>seconds+1e-7>=w.start)||waves[0];}
  function population(seconds){return waveAt(seconds).cap;}
  function spawnInterval(seconds){return waveAt(seconds).interval;}
  const baseItemUnlocks=Object.freeze((config.itemUnlocks||[[0,['rock','boomerang','shoe','shield']],[90,['water-fairy','balloon']],[180,['wheel','flowerpot']],[300,['paper-plane','bouncy-ball']],[420,['yellow-floor','broom']],[540,['sprinkler']]]).map(([at,ids])=>Object.freeze([at,Object.freeze(ids)])));
  const classicItemUnlocks=Object.freeze([Object.freeze([0,Object.freeze(['rock','boomerang'])])]);
  const currentItemUnlocks=()=>campaign?.patch.itemUnlocks||(itemSupply?classicItemUnlocks:baseItemUnlocks);
  const itemPool=seconds=>currentItemUnlocks().flatMap(([at,ids])=>seconds>=at?ids:[]);
  function pickItem(seconds,random=Math.random){
    const pool=itemPool(seconds);
    return pool[Math.min(pool.length-1,Math.floor(random()*pool.length))];
  }
  function pickItemCard(seconds,random=Math.random){
    if(!campaign)return {id:pickItem(seconds,random),level:1};
    let roll=random()*campaign.gearPool.reduce((a,c)=>a+c.weight,0);
    for(const c of campaign.gearPool){roll-=c.weight;if(roll<0)return {id:c.id,level:c.level};}
    const c=campaign.gearPool.at(-1);return {id:c.id,level:c.level};
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
  function create(onEvent=null){
    const state={slotCount:tuning.initialSlots,gems:tuning.startingGems,displayGems:tuning.startingGems,elapsed:0,kills:0,result:null,lastItemAt:-Infinity};
    // Supply belongs to this run, never to the menu or a previous playthrough.
    const supply=itemSupply;
    let accepted=0;
    let from=0,rollTime=0,rolling=false;
    function credit(n=1){state.gems+=n*tuning.gemValue;if(!rolling)state.displayGems=state.gems;}
    function rewardDrop(random=Math.random){
      const raw=rollDrop(random);
      let kind=raw,reason=null;
      if(raw==='item'){
        const t=state.elapsed;
        if(t-state.lastItemAt+1e-7<tuning.itemInterval){kind='gem';reason='item_cooldown';}
        else{
          state.lastItemAt=t;
          if(supply&&accepted>=supply.cap){kind='gem';reason='stage_item_cap';}
          else accepted++;
        }
      }
      onEvent?.('drop_roll',{raw,kind,reason});
      return kind;
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
    function pickRunItem(random=Math.random){
      return pickItem(state.elapsed,random);
    }
    return {state,credit,buy,tick,rewardDrop,pickItem:pickRunItem,pickItemCard:random=>pickItemCard(state.elapsed,random)};
  }
  window.GardenRunRules=Object.freeze({active,catalog,selectBlueprint,get selectedBlueprintId(){return selectedBlueprintId;},get initial(){return initial;},get blueprint(){return blueprint;},flowerWeights,paceProfiles,get campaign(){return campaign;},get formations(){return campaign?.formations||[];},get startingGear(){return flowerbeds?[]:campaign?.startingGear||[{id:tuning.starterRock,level:1}];},get tuning(){return tuning;},cost,rollDrop,damageToFlower,canEquip,chooseFlower,get itemUnlocks(){return currentItemUnlocks();},get itemSupply(){return itemSupply;},stageAt,completion,blueprintStatus,plantCandidates,canPlant,uprootOutline,population,get enemyUnlocks(){return campaign?.patch.enemyUnlocks||enemyUnlocks;},eligibleEnemies,spawnInterval,get waves(){return waves;},waveAt,itemPool,pickItem,cardPosition,depth,create});
}());
