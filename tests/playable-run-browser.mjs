import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {join,extname} from 'node:path';
import {createRequire} from 'node:module';
import {chromium} from 'playwright';
const require=createRequire(import.meta.url),phaser=require.resolve('phaser/dist/phaser.min.js');
const mime={'.js':'application/javascript','.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json'};
const server=createServer((req,res)=>{
  try{
    const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname.slice(1))||'index.html';
    if(path.includes('..'))return res.writeHead(404).end();
    let body=readFileSync(path==='phaser.js'?phaser:join(process.cwd(),path));
    if(path==='index.html')body=body.toString().replace('https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.min.js','./phaser.js');
    if(path==='src/main.js')body=body.toString().replace("  window.addEventListener('resize',","  window.__previewGame = game;\n  window.addEventListener('resize',");
    res.writeHead(200,{'content-type':mime[extname(path)]||'application/octet-stream'}).end(body);
  }catch(e){res.writeHead(500).end(String(e));}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
try{
  browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  for(const [width,height] of [[960,540],[1280,720]]){
    const page=await browser.newPage({viewport:{width,height}}),errors=[];
    page.on('pageerror',e=>{errors.push(String(e));console.error('PAGE ERROR',e.stack||String(e));});page.on('requestfailed',r=>errors.push(r.url()));
    await page.goto('http://127.0.0.1:'+server.address().port+'/?enemies=0&weapons=0');
    await page.waitForFunction(()=>window.__previewGame?.scene.isActive('MainMenu'));
    const box=await page.locator('canvas').boundingBox();
    const xy=p=>[box.x+p.x*box.width/960,box.y+p.y*box.height/540];
    await page.mouse.click(...xy({x:480,y:252}));
    await page.waitForFunction(()=>window.__previewGame.scene.getScene('Game').runDrops);
    const read=fn=>page.evaluate(fn);
    const initial=await read(()=>{
      const s=window.__previewGame.scene.getScene('Game');
      return {slots:s.run.state.slotCount,gear:s.runEquipment.equipped.map(x=>x?.id??null),fairies:s.fairyPatrol.actors.length,flowers:[...s.flowerGrowth.entries.values()].map(x=>x.stage),progress:s.children.getByName('hud-progress-value').text,drop:s.runDrops.drops.size,visible:s.children.getByName('preview-equipped:0').visible,attack:s.heroWeaponPreview.model.state.equipped[0]};
    });
    assert.deepEqual(initial,{slots:4,gear:['rock',...Array(9).fill(null)],fairies:1,flowers:[3,3,3,3],progress:'25%',drop:0,visible:true,attack:'rock'});
    assert.equal(await page.locator('#hero-weapon-select').count(),0);
    const layers=await read(()=>{
      const s=window.__previewGame.scene.getScene('Game'),D=window.GardenRunRules.depth;
      const n=id=>s.children.getByName(id),assert=(v,m)=>{if(!v)throw Error(m);};
      const enemy=[...s.enemyPreview.sprites.values()][0],hero=s.fairyPatrol.actors[0],flower=[...s.flowerGrowth.entries.values()][0];
      assert(s.fairyPatrol.speed===40&&s.fairyPatrol.speedRank===0,'minimum fairy speed');
      assert(s.enemyPreview.actors.every(a=>a.entry.id==='3_caterpillar'),'opening caterpillar only');
      assert(n('battlefield').depth===D.field&&n('dark-field-pattern').depth===D.pattern&&n('garden-preview-soil').depth===D.soil,'ground');
      assert(enemy.shadow.depth===D.shadow&&flower.image.depth<enemy.image.depth&&enemy.image.depth<hero.outline.depth&&hero.outline.depth<hero.image.depth,'actors');
      assert(n('hero-weapon:effects').depth===D.effects&&n('hero-weapon:ground-effects').depth===D.groundEffect,'effects');
      assert(n('top-hud').depth===D.hud&&n('item-slots').depth===D.hud&&n('hud-time-value').depth===D.hudContent&&n('stat-value:moveSpeed').depth===D.hudContent,'HUD');
      assert(n('slot-frame:0').depth===D.slotFrame&&n('slot-cost-icon').depth===D.equipped&&n('preview-equipped:0').depth===D.equipped,'slot layers');
      assert(n('blueprint-body').depth===D.blueprint&&n('blueprint-flower:44').depth===D.blueprintIcon&&n('blueprint-title').depth===D.blueprintText,'blueprint');
      assert(n('item-preview-tooltip').depth===D.tooltip,'tooltip');
      const g=window.GardenGameLayout.spec.garden;
      for(const kind of ['item','flower']){
        const d=s.runDrops.spawn(kind,g.x+g.size/2,g.y+g.size/2,kind==='item'?'shield':'rose');
        const half=d.marker.width/2;
        assert(d.marker.depth===D.card&&d.x-half>=g.x+g.size+5||d.marker.depth===D.card&&(d.x+half<=g.x-5||d.y+half<=g.y-5||d.y-half-4>=g.y+g.size+5),'card outside garden');
        s.runDrops.consume(d);
      }
      return true;
    });
    assert.equal(layers,true);
    const rulesCheck=await read(()=>{
      const s=window.__previewGame.scene.getScene('Game'),R=window.GardenRunRules;
      const run=R.create();
      return !s.children.getByName('run-growth-hud')&&!('xp' in s.run.state)&&!('level' in s.run.state)&&run.rewardDrop(()=>.99)==='item'&&run.rewardDrop(()=>.99)==='gem';
    });
    assert.equal(rulesCheck,true);
    // Exercise actual scene's relic collection/render path with deterministic drops.
    const heartCheck=await read(()=>{
      const s=window.__previewGame.scene.getScene('Game'),r=s.relicCollection,m=r.model,T=window.GardenRelicCollection.tuning;
      const h=s.fairyPatrol.actors[0].center,b=s.fairyPatrol.bounds;
      const before=r.state.hearts;
      const id=s.fairyPatrol.occupied[0];
      for(const f of r.state.flowers.values())f.energy=T.maxEnergy;
      const d={id:999999,kind:'heart',x:h.x,y:h.y,age:T.settleSeconds,speed:0,attracted:false};
      r.state.drops.push(d);r.step(.05);r.render();
      const held=r.state.drops.includes(d)&&!d.attracted&&r.state.hearts===before&&!!s.children.getByName('ground-relic:heart:'+d.id);
      m.damageFlower(id,10);
      for(let i=0;i<100&&r.state.drops.includes(d);i++)r.step(.05);
      r.render();
      return held&&r.state.hearts===before+1&&r.state.flowers.get(id).energy===100&&!s.children.getByName('ground-relic:heart:'+d.id);
    });
    assert.equal(heartCheck,true);
    // Advance the scene controller by simulated seconds; headless render speed
    // varies across resolutions. Actual automatic fire/kill below remains live.
    const openingCheck=await read(()=>{
      const s=window.__previewGame.scene.getScene('Game'),e=s.enemyPreview;
      e.advance(Math.max(0,6.1-e.model.elapsed));
      return {spawned:e.model.spawned,elapsed:e.model.elapsed,caterpillars:e.actors.every(a=>a.entry.id==='3_caterpillar'),sprites:e.sprites.size,actors:e.actors.length};
    });
    assert.ok(openingCheck.spawned>=3&&openingCheck.elapsed<15&&openingCheck.caterpillars&&openingCheck.sprites===openingCheck.actors,JSON.stringify(openingCheck));
    await page.waitForFunction(()=>window.__previewGame.scene.getScene('Game').heroWeaponPreview.model.state.fired>0);
    await page.waitForFunction(()=>window.__previewGame.scene.getScene('Game').enemyPreview.model.kills>0,null,{timeout:60000});
    await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__previewGame.scene.isActive('Pause'));
    const clock=()=>read(()=>window.__previewGame.scene.getScene('Game').run.state.elapsed);
    const paused=await clock();await page.waitForTimeout(200);assert.equal(await clock(),paused);
    await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__previewGame.scene.isActive('Game'));
    async function drag(kind,id,index){
      const points=await page.evaluate(({kind,id,index})=>{
        const s=window.__previewGame.scene.getScene('Game'),d=s.runDrops.spawn(kind,220,180,id);
        const g=window.GardenGameLayout.spec.garden;
        const dest=kind==='item'?s.children.getByName('preview-slot:'+index):{x:g.x+(index%10)*g.pitch+g.line+g.cell/2,y:g.y+Math.floor(index/10)*g.pitch+g.line+g.cell/2};
        return {from:{x:d.x,y:d.y},to:{x:dest.x,y:dest.y}};
      },{kind,id,index});
      await page.mouse.move(...xy(points.from));await page.mouse.down();await page.mouse.move(...xy(points.to),{steps:12});await page.mouse.up();
    }
    await drag('item','rock',0);
    assert.equal(await read(()=>window.__previewGame.scene.getScene('Game').runEquipment.equipped[0].level),1);
    await drag('item','water-fairy',1);
    assert.equal(await read(()=>window.__previewGame.scene.getScene('Game').fairyPatrol.actors.length),2);
    assert.equal(await read(()=>window.__previewGame.scene.getScene('Game').children.getByName('blueprint-flower:44').getData('blueprintStatus')),'complete');
    await drag('flower','rose',33);
    assert.equal(await read(()=>window.__previewGame.scene.getScene('Game').flowerGrowth.entries.has(33)),false);
    await drag('flower','daisy',34);
    assert.equal(await read(()=>window.__previewGame.scene.getScene('Game').flowerGrowth.entries.get(34)?.name),'daisy');
    assert.equal(await read(()=>window.__previewGame.scene.getScene('Game').flowerGrowth.entries.get(34)?.stage),1);
    await page.waitForFunction(()=>window.__previewGame.scene.getScene('Game').children.getByName('blueprint-flower:34').getData('blueprintStatus')==='growing');
    await read(()=>{const s=window.__previewGame.scene.getScene('Game');s.run.tick(16);s.fairyPatrol.refreshHud();});
    assert.equal(await read(()=>window.__previewGame.scene.getScene('Game').flowerGrowth.entries.get(34)?.stage),3);
    await page.waitForFunction(()=>window.__previewGame.scene.getScene('Game').children.getByName('blueprint-flower:34').getData('blueprintStatus')==='complete');
    await drag('flower','rose',24);
    assert.equal(await read(()=>window.__previewGame.scene.getScene('Game').flowerGrowth.entries.has(24)),false);
    await read(()=>window.__previewGame.scene.getScene('Game').relicCollection.model.damageFlower(34,1000));
    await page.waitForFunction(()=>!window.__previewGame.scene.getScene('Game').flowerGrowth.entries.has(34));
    await page.waitForFunction(()=>window.__previewGame.scene.getScene('Game').children.getByName('blueprint-flower:34').getData('blueprintStatus')==='empty');
    await drag('flower','rose',34);
    await page.waitForFunction(()=>window.__previewGame.scene.getScene('Game').children.getByName('blueprint-flower:34').getData('blueprintStatus')==='wrong');
    await read(()=>window.__previewGame.scene.getScene('Game').run.credit(1000));
    for(let n=4;n<10;n++){
      const p=await read(()=>{const z=window.__previewGame.scene.getScene('Game').children.getByName('run-slot-purchase');return {x:z.x,y:z.y};});
      await page.mouse.click(...xy(p));
      assert.equal(await read(()=>window.__previewGame.scene.getScene('Game').run.state.slotCount),n+1);
    }
    await page.waitForFunction(()=>{const r=window.__previewGame.scene.getScene('Game').run.state;return r.gems===r.displayGems;});
    assert.equal(await read(()=>window.__previewGame.scene.getScene('Game').children.getByName('run-slot-purchase').visible),false);
    await drag('item','wheel',9);
    assert.equal(await read(()=>window.__previewGame.scene.getScene('Game').heroWeaponPreview.model.state.equipped[9]),'wheel');
    await read(()=>{const s=window.__previewGame.scene.getScene('Game');for(const id of s.runGarden.occupied)s.relicCollection.model.damageFlower(id,1000);});
    await page.waitForFunction(()=>window.__previewGame.scene.isActive('Defeat'));
    async function assertResult(key){
      await page.waitForFunction(k=>window.__previewGame.scene.isActive(k),key);
      const snapshot=()=>read(()=>{
        const game=window.__previewGame,s=game.scene.getScene('Game'),r=game.scene.getScene(s.run.state.result);
        return {paused:game.scene.isPaused('Game'),elapsed:s.run.state.elapsed,enemyElapsed:s.enemyPreview.elapsed,hero:s.fairyPatrol.actors.map(a=>[a.center.x,a.center.y,a.expression]),enemy:s.enemyPreview.actors.map(a=>[a.id,a.pose.x,a.pose.ground]),cards:[...s.runDrops.drops.values()].map(c=>[c.x,c.y,c.age]),children:s.children.list.length,text:r.children.list.filter(o=>o.type==='Text').map(o=>o.text),visible:s.sys.settings.visible};
      });
      const before=await snapshot();assert.equal(before.paused,true);assert.equal(before.visible,true);
      assert.ok(before.text.includes(key==='Defeat'?'실패':'성공'));assert.ok(!before.text.some(t=>/GARDEN TEST|RESULT|런 결과|저장/.test(t)));
      const clip={x:Math.floor(box.x+10*box.width/960),y:Math.floor(box.y+40*box.height/540),width:Math.floor(180*box.width/960),height:Math.floor(450*box.height/540)};
      assert.ok(before.hero.every(a=>a[2]===(key==='Victory'?'happy':'closed')));
      const emotion=await read(()=>window.__previewGame.scene.getScene('Game').fairyPatrol.emotionTime);
      await page.waitForFunction(t=>window.__previewGame.scene.getScene('Game').fairyPatrol.emotionTime>t+.2,emotion);
      const first=await page.screenshot({clip});await page.waitForTimeout(250);
      assert.deepEqual(await snapshot(),before,'game remains frozen behind result');assert.deepEqual(await page.screenshot({clip}),first,'outside popup stays unchanged');
      await page.keyboard.press('Escape');assert.equal(await read(()=>window.__previewGame.scene.isPaused('Game')),true);
    }
    await assertResult('Defeat');
    await page.mouse.click(...xy(await page.evaluate(()=>{const s=window.__previewGame.scene.getScene('Game'),p=window.GardenRunRules.resultPanel(window.GardenGameLayout.spec,s.fairyPatrol.boundary.swept);return {x:p.x,y:p.top+205};})));
    await page.waitForFunction(()=>{const g=window.__previewGame;return g.scene.isActive('Game')&&g.scene.getScene('Game').run?.state.result===null;});
    assert.equal(await read(()=>window.__previewGame.scene.getScene('Game').run.state.slotCount),4);
    await read(()=>{
      const s=window.__previewGame.scene.getScene('Game'),g=window.GardenGameLayout.spec.garden;
      // Synthetic full-size garden: verify the result layout at maximum 10x10 footprint without adding a new stage.
      const needed=new Map(window.GardenRunRules.blueprint);
      for(let id=0;id<100;id++){if(s.flowerGrowth.entries.has(id))continue;s.runGarden.occupied.add(id);s.flowerGrowth.plant(id,needed.get(id)||'daisy',{x:g.x+(id%10)*g.pitch+g.line+g.cell/2,y:g.y+Math.floor(id/10)*g.pitch+g.line+g.cell/2},0,true);}
      s.fairyPatrol.refreshHud();
    });
    await assertResult('Victory');
    assert.ok(await read(()=>{const s=window.__previewGame.scene.getScene('Game'),p=window.GardenRunRules.resultPanel(window.GardenGameLayout.spec,s.fairyPatrol.boundary.swept);return s.runGarden.occupied.size===100&&p.x-p.w/2>s.fairyPatrol.boundary.swept.right+12;}));
    await page.mouse.click(...xy(await page.evaluate(()=>{const s=window.__previewGame.scene.getScene('Game'),p=window.GardenRunRules.resultPanel(window.GardenGameLayout.spec,s.fairyPatrol.boundary.swept);return {x:p.x,y:p.top+250};})));await page.waitForFunction(()=>window.__previewGame.scene.isActive('MainMenu'));
    assert.equal(await read(()=>window.__previewGame.scene.isPaused('Game')),false);
    assert.deepEqual(errors,[]);
    console.log('PASS playable browser',width,height);
    await page.close();
  }
}finally{await browser?.close();await new Promise(r=>server.close(r));}
