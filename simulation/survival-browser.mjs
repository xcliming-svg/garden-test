// Opt-in Phaser reference for current survival. Serves original game modules;
// freezes real-time scene UPDATE and advances the original event listeners with seeded dt.
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {createRequire} from 'node:module';
import {root} from './io.mjs';
import {rng} from './models.mjs';
import {PROFILES,selectSurvivalAction,validateOptions,tallySurvivalEvent} from './survival-runtime.mjs';

const require=createRequire(import.meta.url);
const mime={'.js':'application/javascript','.html':'text/html; charset=utf-8','.css':'text/css',
  '.svg':'image/svg+xml','.json':'application/json','.png':'image/png','.woff2':'font/woff2'};
function replaceOnce(src,needle,replacement){
  if(src.split(needle).length!==2)throw Error('Browser survival hook no longer unique: '+needle);
  return src.replace(needle,replacement);
}
export async function withSurvivalBrowser({seed=42,channel='chrome'}={},fn){
  const {chromium}=await import('playwright');
  const phaser=require.resolve('phaser/dist/phaser.min.js');
  const server=createServer((req,res)=>{
    try{
      const url=new URL(req.url,'http://localhost'),path=decodeURIComponent(url.pathname.slice(1))||'index.html';
      const target=resolve(root,path);
      if(path!=='phaser.js'&&(!target.startsWith(resolve(root)+sep)||
        !(path==='index.html'||path.startsWith('assets/')||path.startsWith('src/'))))
        return res.writeHead(404).end();
      let body=readFileSync(path==='phaser.js'?phaser:target);
      if(path==='index.html')body=replaceOnce(body.toString(),
        'https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.min.js','./phaser.js');
      if(path==='src/main.js')body=replaceOnce(body.toString(),
        "  window.addEventListener('resize',",
        "  window.__survivalTestGame=game;\n  window.addEventListener('resize',");
      if(path==='src/scenes.js')body=replaceOnce(body.toString(),
        '      window.GardenGameLayout.draw(this);',
        `      window.GardenGameLayout.draw(this);
        if(window.__survivalHarness){
          const emit=this.events.emit.bind(this.events);
          this.events.emit=(name,...args)=>name==='update'&&!window.__survivalStep?false:emit(name,...args);
          window.__survivalScene=this;
        }`);
      res.writeHead(200,{'content-type':mime[extname(path)]||'application/octet-stream'}).end(body);
    }catch(err){res.writeHead(500).end(String(err.stack||err));}
  });
  await new Promise((done,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',done);});
  let browser;
  const debug=(...args)=>{if(process.env.SURVIVAL_DEBUG==='1')console.error('[survival-browser]',...args);};
  try{
    debug('starting Chromium');
    browser=await chromium.launch({...(channel==='chromium'?{}:{channel}),headless:true,
      args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
    debug('Chromium launched');
    const page=await browser.newPage({viewport:{width:960,height:540},deviceScaleFactor:1});
    const errors=[];
    page.on('pageerror',e=>{errors.push(e.stack||String(e));debug('pageerror',String(e.stack||e).slice(0,800));});
    page.on('requestfailed',r=>{errors.push('request failed '+r.url());debug('requestfailed',r.url());});
    await page.addInitScript(({seed,rngSource,tallySource})=>{
      const makeRng=new Function('return ('+rngSource+')')();
      const tally=new Function('return ('+tallySource+')')();
      window.__survivalHarness=true;window.__survivalStep=false;
      window.GardenSimulationRng=Object.fromEntries(['enemy','drop','flower','weapon','item','agent'].map(id=>[id,makeRng(seed,id)]));
      window.__survivalTelemetry={events:{},weapons:{},enemies:{}};
      window.GardenSimulationEvent=(type,data)=>tally(window.__survivalTelemetry,type,data);
    },{seed,rngSource:rng.toString(),tallySource:tallySurvivalEvent.toString()});
    debug('navigate');
    await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded',timeout:30000});
    debug('DOM loaded');
    await page.waitForFunction(()=>window.__survivalTestGame?.scene.isActive('MainMenu'),null,{timeout:30000});
    debug('MainMenu active');
    await page.evaluate(()=>{window.__survivalTestGame.scene.start('Game');});
    debug('requested Game');
    await page.waitForFunction(()=>window.__survivalScene?.gardenEconomy&&
      window.__survivalScene?.enemyPreview&&window.__survivalScene?.heroWeaponPreview&&
      window.__survivalScene?.relicCollection,null,{timeout:30000});
    debug('Game ready');
    const initial=await page.evaluate(()=>({
      survival:window.GardenRunRules.survival,elapsed:window.__survivalScene.run.state.elapsed}));
    if(!initial.survival||initial.elapsed!==0)throw Error('Browser is not frozen current survival: '+JSON.stringify(initial));
    debug('reference evaluate start');
    const result=await fn(page);
    debug('reference evaluate done');
    if(errors.length)throw Error('Browser reference errors: '+errors.join('\n'));
    return result;
  }finally{await browser?.close();await new Promise(done=>server.close(done));}
}
export async function captureSurvivalGeometry(options={},fingerprint){
  const measured=await withSurvivalBrowser(options,page=>page.evaluate(()=>{
    const s=window.__survivalScene,H=window.GardenHeroWeaponPreview,I=window.GardenItemCards;
    return {enemies:Object.fromEntries(s.enemyPreview.entries.map(e=>[e.id,{width:e.width,height:e.height}])),
      weapons:Object.fromEntries([...H.ids,'water-splash'].map(id=>[id,I.attackSize(s,id,1)])),
      heroHeight:s.fairyPatrol.actors[0].visibleHeight};
  }));
  return {schemaVersion:1,sourceHash:fingerprint.sourceHash,assetHash:fingerprint.assetHash,...measured};
}
export async function runSurvivalReference(options={},sampleTimes=[0,5,10,30,60]){
  const opts=validateOptions(options),profile=PROFILES[opts.policy];
  return withSurvivalBrowser(opts,page=>page.evaluate(({opts,profile,chooseSource,sampleTimes})=>{
    const choose=new Function('return ('+chooseSource+')')(),s=window.__survivalScene;
    const E=window.GardenEconomy,actions=[],timeline=[],telemetry=window.__survivalTelemetry;
    let clock=0,nextDecision=0,index=0;
    const targets=[...new Set([0,...sampleTimes.filter(t=>t>0&&t<=opts.seconds),opts.seconds])].sort((a,b)=>a-b);
    function snapshot(){
      const a=s.enemyPreview.model,r=s.relicCollection.state,
        h=s.heroWeaponPreview.model.state,e=s.gardenEconomy.state;
      return {time:Number(clock.toFixed(6)),heroX:Number(s.fairyPatrol.actors[0].center.x.toFixed(6)),heroY:Number(s.fairyPatrol.actors[0].center.y.toFixed(6)),patrolDistance:Number(s.fairyPatrol.distance.toFixed(6)),patrolLength:Number(s.fairyPatrol.length.toFixed(6)),spawned:a.spawned,killed:a.kills,active:a.actors.length,
        shots:h.fired,hits:h.hits,waterDrops:r.spawnedWater,waterCollected:r.water,hearts:r.hearts,
        expired:r.expired,water:e.water,gardenHp:Number(e.hp.toFixed(6)),side:e.side,
        harvested:e.totalHarvested,plotStock:e.plots.map(p=>p.count),
        equipped:E.weapons.filter(id=>e.owned.has(id)),activeShots:h.shots.length,events:{...telemetry.events},
        weaponsById:structuredClone(telemetry.weapons),enemiesById:structuredClone(telemetry.enemies)};
    }
    timeline.push(snapshot());index++;
    const n=Math.round(opts.seconds/opts.dt);
    if(Math.abs(n*opts.dt-opts.seconds)>1e-8)throw Error('Duration not divisible by dt');
    for(let i=0;i<n&&s.gardenEconomy.state.hp>0;i++){
      if(clock+1e-9>=nextDecision){
        const action=choose(s.gardenEconomy,E,profile,s.gardenEconomy.nearest(),s.fairyPatrol.paused);
        if(action){
          const before=s.gardenEconomy.state,oldSide=before.side,oldWater=before.water;
          let ok=false;
          if(action.kind==='water'){
            s.input.keyboard.emit('keydown-SPACE',{});
            s.input.keyboard.emit('keyup-SPACE',{});
            ok=before.water<oldWater;
          }else if(action.kind==='expand')ok=s.gardenEconomy.expand();
          else if(action.kind==='buy')ok=s.gardenEconomy.buy(action.id);
          else if(action.kind==='upgrade')ok=s.gardenEconomy.upgrade(action.id,action.type);
          actions.push({time:Number(clock.toFixed(6)),...action,ok});
        }
        nextDecision+=profile.interval;
      }
      window.__survivalStep=true;
      try{s.events.emit('update',0,opts.dt*1000);}finally{window.__survivalStep=false;}
      clock+=opts.dt;
      while(index<targets.length&&clock>=targets[index]-1e-7){timeline.push(snapshot());index++;}
    }
    return {schemaVersion:1,mode:'survival-phaser-reference',seed:opts.seed,dt:opts.dt,
      seconds:opts.seconds,policy:profile,actions,timeline,final:snapshot(),
      outcome:s.gardenEconomy.state.hp<=0?'defeat':'time_limit'};
  },{opts,profile,chooseSource:selectSurvivalAction.toString(),sampleTimes}));
}
export function compareSurvival(headless,browser){
  const differences=[];
  const keys=['heroX','heroY','patrolDistance','patrolLength','spawned','killed','active','shots','hits','waterDrops','waterCollected',
    'hearts','expired','water','gardenHp','side','harvested','activeShots'];
  if(headless.timeline.length!==browser.timeline.length)
    differences.push({kind:'timeline-length',headless:headless.timeline.length,browser:browser.timeline.length});
  for(let i=0;i<Math.min(headless.timeline.length,browser.timeline.length);i++){
    const a=headless.timeline[i],b=browser.timeline[i];
    for(const k of keys)if(Math.abs(a[k]-b[k])>1e-5)
      differences.push({time:a.time,key:k,headless:a[k],browser:b[k]});
    for(const k of ['plotStock','equipped','weaponsById','enemiesById'])if(JSON.stringify(a[k])!==JSON.stringify(b[k]))
      differences.push({time:a.time,key:k,headless:a[k],browser:b[k]});
    for(const type of new Set([...Object.keys(a.events),...Object.keys(b.events)])){
      if((a.events[type]||0)!==(b.events[type]||0))
        differences.push({time:a.time,key:'events.'+type,headless:a.events[type]||0,browser:b.events[type]||0});
    }
  }
  if(JSON.stringify(headless.actions)!==JSON.stringify(browser.actions))
    differences.push({kind:'actions',headless:headless.actions.slice(0,12),browser:browser.actions.slice(0,12)});
  return {status:differences.length?'FAIL':'PASS',differences};
}
