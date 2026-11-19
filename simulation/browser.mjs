// Authoritative reference path: serve the original playable page and advance
// its existing Phaser UPDATE listeners. No rendering/gameplay code is replaced.
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {join,extname,resolve,sep} from 'node:path';
import {createRequire} from 'node:module';
import {root} from './io.mjs';
import {makeAgent} from './agents.mjs';
import {rng} from './models.mjs';

const require=createRequire(import.meta.url);
const mime={'.js':'application/javascript','.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json'};
function replaceOnce(s,a,b){if(s.split(a).length!==2)throw Error('Browser harness hook changed: '+a);return s.replace(a,b);}
async function withScene(p,{channel='chrome',seed=1,trace=false,menuSelection=null,forceDropRoll=null,viewport={width:960,height:540}}={},fn){
  const {chromium}=await import('playwright'),phaser=require.resolve('phaser/dist/phaser.min.js');
  const server=createServer((req,res)=>{
    try{
      const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname.slice(1))||'index.html';
      const target=resolve(root,path);
      if(path!=='phaser.js'&&(!target.startsWith(resolve(root)+sep)||!(path==='index.html'||path.startsWith('assets/')||path.startsWith('src/'))))return res.writeHead(404).end();
      let body=readFileSync(path==='phaser.js'?phaser:target);
      if(path==='index.html')body=replaceOnce(body.toString(),'https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.min.js','./phaser.js');
      if(path==='src/main.js')body=replaceOnce(body.toString(),"  window.addEventListener('resize',","  window.__gardenTestGame=game;\n  window.addEventListener('resize',");
      if(path==='src/scenes.js')body=replaceOnce(body.toString(),'      window.GardenGameLayout.draw(this);',`      window.GardenGameLayout.draw(this);
      if(window.__gardenSimHarness){
        const emit=this.events.emit.bind(this.events);
        this.events.emit=(name,...args)=>name==='update'&&!window.__gardenSimStep?false:emit(name,...args);
        window.__gardenSimScene=this;
      }`);
      res.writeHead(200,{'content-type':mime[extname(path)]||'application/octet-stream'}).end(body);
    }catch(e){res.writeHead(500).end(String(e));}
  });
  await new Promise((r,j)=>{server.once('error',j);server.listen(0,'127.0.0.1',r);});
  let browser;
  try{
    browser=await chromium.launch({...(channel==='chromium'?{}:{channel}),headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
    const page=await browser.newPage({viewport,deviceScaleFactor:1}),errors=[];
    page.on('pageerror',e=>{errors.push(e.stack||String(e));console.error('PAGE ERROR',e.stack||String(e));});
    page.on('requestfailed',r=>errors.push(r.url()));
    await page.addInitScript(({config,seed,trace,rngSource,forceDropRoll})=>{
      const makeRng=new Function('return ('+rngSource+')')();
      window.__gardenSimHarness=true;window.__gardenSimTime=0;window.__gardenSimStep=false;
      if(config)window.GardenSimulationConfig=config;
      window.GardenSimulationRng=Object.fromEntries(['enemy','drop','flower','item','weapon','agent'].map(k=>[k,makeRng(seed,k)]));
      if(forceDropRoll!==null)window.GardenSimulationRng.drop=()=>forceDropRoll;
      const counters={},events=[],weapon={};
      window.__gardenSimTelemetry={counters,events,weapon};
      window.GardenSimulationEvent=(type,data)=>{
        counters[type]=(counters[type]||0)+1;
        if(type.startsWith('weapon_')){
          const w=weapon[data.weapon]||(weapon[data.weapon]={});
          w[type]=(w[type]||0)+1;
          if(type==='weapon_hit'){w.damage=(w.damage||0)+data.effective;if(data.killed)w.kills=(w.kills||0)+1;}
        }
        if(trace)events.push({t:window.__gardenSimTime,type,...data});
      };
    },{config:menuSelection?null:p.config,seed,trace,rngSource:rng.toString(),forceDropRoll});
    await page.goto('http://127.0.0.1:'+server.address().port+'/');
    await page.waitForFunction(()=>window.__gardenTestGame?.scene.isActive('MainMenu'),null,{timeout:60000});
    if(menuSelection){
      await page.locator('#blueprint-select').selectOption(menuSelection);
      const box=await page.locator('canvas').boundingBox();
      await page.mouse.click(box.x+box.width/2,box.y+box.height*252/540);
    }else await page.evaluate(()=>window.__gardenTestGame.scene.start('Game'));
    await page.waitForFunction(()=>window.__gardenSimScene?.runDrops,null,{timeout:60000});
    // A real animation frame may render, but its UPDATE is blocked until the
    // harness explicitly emits it. Verify that no real-time step leaked in.
    const clock=await page.evaluate(()=>window.__gardenSimScene.run.state.elapsed);
    if(clock!==0)throw Error('Browser initial clock was not frozen: '+clock);
    const result=await fn(page);
    if(errors.length)throw Error('Browser errors: '+errors.join('\n'));
    return result;
  }finally{await browser?.close();await new Promise(r=>server.close(r));}
}
export async function captureGeometry(p,opts={}){
  const data=await withScene(p,opts,page=>page.evaluate(()=>{
    const s=window.__gardenSimScene,I=window.GardenItemCards,A=window.GardenHeroWeaponPreview;
    return {waterHeightRatio:s.cache.json.get('fairy:manifest').characters.water.visibleHeight/s.cache.json.get('fairy:manifest').characters.garden.visibleHeight,
      enemies:Object.fromEntries(s.enemyPreview.entries.map(e=>[e.id,{width:e.width,height:e.height}])),
      weapons:Object.fromEntries([...A.ids,'water-splash'].map(id=>[id,I.attackSize(s,id,1)]))};
  }));
  return {schemaVersion:1,...p.fingerprint,...data};
}
export async function runBrowser(p,profile,{seed=1,dt=.05,maxSeconds=1800,trace=false,channel='chrome',replayActions=null}={}){
  return withScene(p,{channel,seed,trace},page=>page.evaluate(({seed,dt,maxSeconds,profile,makeAgentSource,replayActions,trace})=>{
    const s=window.__gardenSimScene,R=window.GardenRunRules,L=window.GardenGameLayout,I=window.GardenItemCards;
    const agent=new Function('return ('+makeAgentSource+')')()(profile,window.GardenSimulationRng.agent);
    const telemetry=window.__gardenSimTelemetry,actions=[],timeline=[];
    const required=new Map(R.blueprint);let drag=null,holdPointer=null,idx=0,lastSample=-1;
    const cardId=c=>Number(c.marker.name.split(':').at(-1));
    const cardList=()=>[...s.runDrops.drops.values()].filter(c=>!c.consumed);
    const center=cell=>{const g=L.spec.garden;return {x:g.x+(cell%g.columns)*g.pitch+g.line+g.cell/2,y:g.y+Math.floor(cell/g.columns)*g.pitch+g.line+g.cell/2};};
    const complete=()=>R.blueprint.filter(([id])=>R.blueprintStatus(s.flowerGrowth.entries,id)==='complete').length;
    const observe=()=>{
      const time=s.run.state.elapsed,candidates=[...R.plantCandidates(s.runGarden.occupied)],gear=s.runEquipment.equipped.slice(0,s.run.state.slotCount);
      return {time,finished:s.run.state.result,blueprint:R.blueprint.map(([cell,name])=>({cell,name,status:R.blueprintStatus(s.flowerGrowth.entries,cell)})),
        flowers:[...s.flowerGrowth.entries].map(([cell,f])=>({cell,name:f.name,stage:f.stage,healthBand:Math.ceil(3*(s.relicCollection.state.flowers.get(cell)?.energy??0)/window.GardenRelicCollection.tuning.maxEnergy)})),
        cards:cardList().map(c=>({id:cardId(c),kind:c.kind,name:c.id,x:c.x,y:c.y,age:c.age,validCells:c.kind==='flower'?candidates:[],matchingCells:c.kind==='flower'?candidates.filter(i=>required.get(i)===c.id):[],item:c.kind==='item'?I.runItemData(c.id):null})),
        gear:gear.map(i=>i?{id:i.id,level:i.level,stats:{...i.stats}}:null),stats:L.sumPreviewStats(gear),slotCount:s.run.state.slotCount,price:R.cost(s.run.state.slotCount),gems:s.run.state.gems,
        drag,hold:s.runGarden.holding,completed:complete(),requiredCount:required.size,patrolLength:s.fairyPatrol.length,enemies:s.enemyPreview.actors.length};
    };
    const ptr=(p,down=true)=>({...p,leftButtonDown:()=>down});
    function dispatch(a){
      let ok=false;
      if(a.type==='DRAG_START'){
        const c=cardList().find(c=>cardId(c)===a.cardId);
        if(c&&!drag&&!s.runGarden.holding){
          c.marker.emit('dragstart',ptr({x:c.x,y:c.y}));
          if(c.kind==='flower'?s.runGarden.isDragging(c):s.runEquipment.isDragging(c)){drag={cardId:a.cardId};ok=true;}
        }
      }else if(a.type==='DRAG_END'){
        const c=drag&&cardList().find(c=>cardId(c)===drag.cardId);drag=null;
        if(c){
          const zone=c.kind==='item'?s.children.getByName('preview-slot:'+a.slot):null;
          const p=c.kind==='flower'&&Number.isInteger(a.cell)?center(a.cell):zone?{x:zone.x,y:zone.y}:{x:-1,y:-1};
          const pointer=ptr(p,false);c.marker.emit('drag',pointer);c.marker.emit('dragend',pointer);ok=!!c.consumed;
        }
      }else if(a.type==='DRAG_CANCEL'){
        const c=drag&&cardList().find(c=>cardId(c)===drag.cardId);drag=null;
        if(c){c.marker.emit('dragend',ptr({x:-1,y:-1},false));ok=true;}
      }else if(a.type==='BUY_SLOT'){
        if(!drag&&!s.runGarden.holding){
          const n=s.run.state.slotCount,z=s.children.getByName('run-slot-purchase');
          if(z?.visible)z.emit('pointerdown',ptr({x:z.x,y:z.y}));
          ok=s.run.state.slotCount>n;
        }
      }else if(a.type==='UPROOT_START'){
        if(!drag&&!s.runGarden.holding&&s.runGarden.occupied.has(a.cell)){
          holdPointer=ptr(center(a.cell));s.input.emit('pointerdown',holdPointer);ok=s.runGarden.holding;
        }
      }else if(a.type==='UPROOT_CANCEL'){
        if(holdPointer&&s.runGarden.holding){s.input.emit('pointerup',holdPointer);holdPointer=null;ok=true;}
      }else if(a.type==='WAIT')ok=true;
      actions.push({t:Number(s.run.state.elapsed.toFixed(6)),...a,ok});
      return ok;
    }
    function snap(){
      const energies=[...s.relicCollection.state.flowers.values()].filter(f=>s.runGarden.occupied.has(f.id)).map(f=>f.energy).sort((a,b)=>a-b);
      const e=s.enemyPreview.model,w=s.heroWeaponPreview.model.state;
      return {time:Number(s.run.state.elapsed.toFixed(6)),completed:complete(),required:required.size,flowers:s.runGarden.occupied.size,
        minEnergy:energies[0]??0,meanEnergy:energies.length?energies.reduce((a,b)=>a+b,0)/energies.length:0,
        enemies:e.actors.length,kills:e.kills,spawned:e.spawned,damage:w.damage,shots:w.fired,hits:w.hits,
        gear:s.runEquipment.equipped.map(i=>i?.id??null),gems:s.run.state.gems,slots:s.run.state.slotCount,
        patrolLength:s.fairyPatrol.length,fairies:s.fairyPatrol.actors.length,speed:s.fairyPatrol.speed,cards:cardList().length};
    }
    window.__gardenSimStep=true;
    while(!s.run.state.result&&s.run.state.elapsed+1e-8<maxSeconds){
      const time=s.run.state.elapsed;
      if(replayActions){
        while(idx<replayActions.length&&replayActions[idx].t<=time+1e-6){
          const {t,ok,reason,...a}=replayActions[idx++];
          if(Math.abs(t-time)>1e-6)throw Error('Browser replay clock mismatch');
          if(dispatch(a)!==ok)throw Error('Browser replay action mismatch at '+t);
        }
      }else if(agent.ready(time)){const a=agent(observe());if(a)dispatch(a);}
      const d=Math.min(dt,maxSeconds-time);
      window.__gardenSimTime=time+d;
      s.events.emit('update',(time+d)*1000,d*1000);
      if(Math.floor(s.run.state.elapsed+1e-7)>lastSample){lastSample=Math.floor(s.run.state.elapsed+1e-7);timeline.push(snap());}
    }
    window.__gardenSimStep=false;
    if(replayActions&&idx!==replayActions.length)throw Error('Browser replay ended before all actions');
    const final=snap(),seconds=final.time,result=s.run.state.result==='Victory'?'victory':s.run.state.result==='Defeat'?'defeat':'timeout';
    return {seed,dt,maxSeconds,geometry:'browser-raster',result,seconds,completed:final.completed,required:final.required,progress:100*final.completed/final.required,
      kills:final.kills,spawned:final.spawned,damage:final.damage,actualDps:seconds?final.damage/seconds:0,shots:final.shots,hits:final.hits,gems:final.gems,gear:final.gear,
      final,counts:telemetry.counters,byWeapon:telemetry.weapon,actions,timeline,events:trace?telemetry.events:undefined};
  },{seed,dt,maxSeconds,profile,makeAgentSource:makeAgent.toString(),replayActions,trace}));
}

export async function verifyBlueprintSelector(p,opts={}){
  return withScene(p,{...opts,menuSelection:'heart'},async page=>{
    const inspect=()=>page.evaluate(()=>{
      const R=window.GardenRunRules,s=window.__gardenSimScene;
      return {id:R.selectedBlueprintId,cells:R.blueprint.length,initial:[...s.flowerGrowth.entries].map(([cell,f])=>[cell,f.name]).sort((a,b)=>a[0]-b[0]),
        icons:R.blueprint.filter(([cell])=>!!s.children.getByName('blueprint-flower:'+cell)).length,
        occupied:s.runGarden.occupied.size,selects:document.querySelectorAll('#blueprint-select').length};
    });
    const heart=await inspect();
    await page.evaluate(()=>{const g=window.__gardenTestGame;g.scene.stop('Game');g.scene.start('MainMenu');});
    await page.waitForFunction(()=>window.__gardenTestGame.scene.isActive('MainMenu')&&document.querySelector('#blueprint-select'));
    const menu=await page.locator('#blueprint-select').evaluate(s=>({value:s.value,options:[...s.options].map(o=>o.value)}));
    await page.locator('#blueprint-select').selectOption('butterfly');
    const box=await page.locator('canvas').boundingBox();
    await page.mouse.move(box.x+box.width/2,box.y+box.height*252/540);
    await page.mouse.click(box.x+box.width/2,box.y+box.height*252/540);
    await page.waitForFunction(()=>window.__gardenSimScene?.runDrops&&window.__gardenTestGame.scene.isActive('Game'),null,{timeout:60000});
    const butterfly=await inspect();
    return {heart,menu,butterfly};
  });
}

export async function verifyPaceTrial(p,opts={}){
  return withScene(p,{...opts,menuSelection:'classic',forceDropRoll:.99999,trace:true},async page=>{
    const inspect=()=>page.evaluate(()=>{
      const R=window.GardenRunRules,s=window.__gardenSimScene;
      window.__gardenSimStep=true;
      for(let i=0;i<200;i++){
        const t=s.run.state.elapsed+.05;window.__gardenSimTime=t;s.events.emit('update',t*1000,50);
      }
      window.__gardenSimStep=false;
      const initial={id:R.selectedBlueprintId,required:R.blueprint.length,drops:R.tuning.dropWeights,cooldown:R.tuning.itemInterval,
        interval:R.spawnInterval(0),cap:R.population(0),batch:R.waveAt(0).batch,spawned:s.enemyPreview.model.spawned,
        elapsed:s.run.state.elapsed,slots:s.run.state.slotCount,gear:s.runEquipment.equipped[0]?.id};
      // Real enemy-death reward controller with only its RNG forced. Do not
      // replace the run: scene restart must reset both cap and ordered prefix.
      const telemetry=window.__gardenSimTelemetry,offset=telemetry.events.length;
      const gemsBefore=s.relicCollection.state.spawnedGems;
      const preItems=[...s.runDrops.drops.values()].filter(c=>c.kind==='item').map(c=>c.id);
      for(let i=0;i<5;i++){
        s.run.tick(R.tuning.itemInterval);
        s.relicCollection.death(230,170);
      }
      const rolls=telemetry.events.slice(offset).filter(e=>e.type==='drop_roll');
      const items=[...s.runDrops.drops.values()].filter(c=>c.kind==='item').map(c=>c.id);
      return {...initial,kinds:rolls.map(e=>e.kind),reasons:rolls.map(e=>e.reason),items,preItems,gemsAdded:s.relicCollection.state.spawnedGems-gemsBefore,pool:R.itemPool(10000),supply:R.itemSupply};
    });
    const result=[await inspect()];
    for(const map of ['cross','heart','butterfly','classic']){
      await page.evaluate(()=>{const g=window.__gardenTestGame;g.scene.stop('Game');g.scene.start('MainMenu');});
      await page.waitForFunction(()=>window.__gardenTestGame.scene.isActive('MainMenu')&&document.querySelector('#blueprint-select'),null,{timeout:60000});
      await page.locator('#blueprint-select').selectOption(map);
      const box=await page.locator('canvas').boundingBox();
      await page.mouse.move(box.x+box.width/2,box.y+box.height*252/540);
      await page.mouse.click(box.x+box.width/2,box.y+box.height*252/540);
      await page.waitForFunction(()=>window.__gardenTestGame.scene.isActive('Game')&&window.__gardenSimScene?.runDrops&&window.__gardenSimScene.run.state.elapsed===0,null,{timeout:60000});
      result.push(await inspect());
    }
    return result;
  });
}
