import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {join,extname} from 'node:path';
import {createRequire} from 'node:module';
import {chromium} from 'playwright';

const require=createRequire(import.meta.url),phaser=require.resolve('phaser/dist/phaser.min.js');
const mime={'.js':'application/javascript','.html':'text/html; charset=utf-8',
  '.css':'text/css','.svg':'image/svg+xml','.json':'application/json'};
const server=createServer((req,res)=>{
  try{
    const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname.slice(1))||'index.html';
    if(path.includes('..'))return res.writeHead(404).end();
    let data=readFileSync(path==='phaser.js'?phaser:join(process.cwd(),path));
    if(path==='index.html')data=data.toString().replace(
      'https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.min.js','./phaser.js');
    if(path==='src/main.js')data=data.toString().replace(
      "  window.addEventListener('resize',",
      "  window.__survivalTestGame = game;\n  window.addEventListener('resize',");
    res.writeHead(200,{'content-type':mime[extname(path)]||'application/octet-stream'}).end(data);
  }catch(error){res.writeHead(500).end(String(error));}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
  browser=await chromium.launch({channel:'chrome',headless:true,
    args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle',
      '--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  for(const [width,height] of [[960,540],[1280,720]]){
    const page=await browser.newPage({viewport:{width,height}}),errors=[];
    page.on('pageerror',e=>{errors.push(String(e.stack||e));console.error('PAGE ERROR',String(e.stack||e));});
    page.on('console',msg=>{if(msg.type()==='error')console.error('BROWSER CONSOLE ERROR',msg.text());});
    page.on('requestfailed',r=>{errors.push('request failed '+r.url());console.error('REQUEST FAILED',r.url());});
    await page.goto('http://127.0.0.1:'+server.address().port+'/?farm=legacy');
    await page.waitForFunction(()=>window.__survivalTestGame?.scene.isActive('MainMenu'));
    assert.equal(await page.locator('#blueprint-select').count(),0,'no stage/blueprint selector');
    const canvas=await page.locator('canvas').boundingBox();
    const point=(x,y)=>[canvas.x+x*canvas.width/960,canvas.y+y*canvas.height/540];
    await page.mouse.click(...point(480,252));
    try{
      await page.waitForFunction(()=>{
        const scene=window.__survivalTestGame?.scene.getScene('Game');
        return scene?.runDrops&&scene?.flowerGrowth?.entries.size===36&&scene?.runEquipment?.equipped.length===20;
      },null,{timeout:60000});
    }catch(error){
      const state=await page.evaluate(()=>{
        const game=window.__survivalTestGame,scene=game?.scene.getScene('Game');
        return {gameActive:game?.scene.isActive('Game'),gameLoading:game?.scene.isSleeping('Game'),
          flowers:scene?.flowerGrowth?.entries.size,equipment:scene?.runEquipment?.equipped.length,
          runDrops:!!scene?.runDrops,sceneStatus:scene?.sys?.settings?.status};
      }).catch(e=>({inspectionError:String(e)}));
      throw Error('Survival scene initialization failed: '+JSON.stringify({state,errors,error:String(error)}));
    }
    const state=await page.evaluate(()=>{
      const scene=window.__survivalTestGame.scene.getScene('Game'),L=window.GardenGameLayout,
        R=window.GardenRunRules,C=window.GardenFairyCombinations;
      const g=L.spec.garden,b=L.bottomLayout(),item=window.GardenItemCards.createDrop(
        scene,L.spec,L.assets,'item','boomerang',110,110,'survival-size-test',1);
      const card={width:item.marker.width,height:item.marker.height,
        waterBackground:item.marker.list[2].name,weaponImage:item.marker.list[3].name,
        imageVisible:item.marker.list[3].visible};
      window.GardenItemCards.disposeCard(item.marker);
      const slots=b.slots.map((v,i)=>({index:i,x:v.x,y:v.y,size:v.size,
        centerX:scene.children.getByName('preview-slot:'+i)?.x,
        input:!!scene.children.getByName('preview-slot:'+i)?.input?.enabled}));
      return {survival:R.survival,initial:R.initial.length,
        garden:{columns:g.columns,rows:g.rows,width:g.width,height:g.height,pitchY:g.pitchY},
        flowerCount:scene.flowerGrowth.entries.size,
        gardenOrigin:{x:g.x,y:g.y,cell:g.cell,line:g.line,pitch:g.pitch},
        flowerPlacement:[...scene.flowerGrowth.entries].map(([id,f])=>({id,name:f.name,x:f.image.x,y:f.image.y})),
        flowerStages:[...new Set([...scene.flowerGrowth.entries.values()].map(x=>x.stage))],
        flowerTextures:[...new Set([...scene.flowerGrowth.entries.values()].map(x=>x.image.texture.key.split(':').at(-2)))],
        blueprint:!!scene.children.getByName('blueprint-body'),
        selector:!!document.querySelector('#blueprint-select'),
        progress:!!scene.children.getByName('hud-progress-value'),
        soilVisible:scene.children.getByName('garden-preview-soil').visible,
        flowerGhost:!!scene.children.getByName('garden-preview-ghost'),
        uproot:!!scene.children.getByName('garden-uproot-outline'),
        buyZone:!!scene.children.getByName('run-slot-purchase'),
        equipment:scene.runEquipment.equipped.map(x=>x?.id??null),
        slotCount:scene.run.state.slotCount,slots,layout:{right:b.right,sideWidth:b.sideWidth,column:b.statColumnWidth,totalWidth:b.totalWidth},
        card,combos:C.lookup.size,heroActors:scene.fairyPatrol.actors.length,
        enemySpawnInterval:R.spawnInterval(0),enemyCap:R.population(0)};
    });
    assert.equal(state.survival,true);
    assert.equal(state.initial,36);
    assert.deepEqual(state.garden,{columns:6,rows:6,width:139,height:139,pitchY:23});
    assert.equal(state.garden.width,state.garden.height,'flowerbed must be square');
    assert.equal(state.garden.pitchY,state.gardenOrigin.pitch,'flowers must touch in both axes');
    assert.equal(state.flowerCount,36);
    const expectedFlowers=[
      {name:'sunflower',col:0,row:0},{name:'rose',col:3,row:0},
      {name:'hydrangea',col:0,row:3},{name:'lavender',col:3,row:3}
    ].flatMap(({name,col,row})=>Array.from({length:9},(_,i)=>{
      const x=col+i%3,y=row+Math.floor(i/3),g=state.gardenOrigin;
      return {id:y*6+x,name,x:g.x+x*g.pitch+g.line+g.cell/2,
        y:g.y+y*state.garden.pitchY+g.line+g.cell-1};
    })).sort((a,b)=>a.id-b.id);
    assert.deepEqual(state.flowerPlacement,expectedFlowers,'all 36 flowers must form four adjoining 3×3 groups');
    assert.deepEqual(state.flowerPlacement.map(f=>f.id),Array.from({length:36},(_,i)=>i),
      'the square must contain no empty cells');
    assert.deepEqual(state.flowerStages,[3]);
    assert.deepEqual(state.flowerTextures,['3']);
    for(const name of ['blueprint','selector','progress','soilVisible','flowerGhost','uproot','buyZone'])
      assert.equal(state[name],false,'removed: '+name);
    assert.equal(state.slotCount,20);
    assert.equal(state.equipment.length,20);
    assert.equal(state.equipment[0],'rock');
    assert.equal(state.slots.length,20);
    assert.equal(state.layout.right,720);
    assert.equal(state.layout.sideWidth,240);
    assert.equal(state.layout.column,80);
    assert.equal(state.layout.totalWidth,707);
    for(const v of state.slots){
      assert.equal(v.x,10+Math.floor(v.index/2)*71+(v.index%2)*34);
      assert.equal(v.y,503);assert.equal(v.size,34);
      assert.equal(v.centerX,v.x+17);
      assert.ok(v.input,'every slot must accept item drag: '+v.index);
    }
    assert.deepEqual(state.card,{width:34,height:34,
      waterBackground:'water-fairy-card-backdrop',weaponImage:'water-fairy-card-item',imageVisible:true});
    assert.equal(state.combos,78);
    assert.equal(state.heroActors,2);
    assert.equal(state.enemySpawnInterval,1.05);
    assert.equal(state.enemyCap,8);

    const healed=await page.evaluate(()=>{
      const scene=window.__survivalTestGame.scene.getScene('Game'),r=scene.relicCollection.model;
      const id=scene.fairyPatrol.occupied[0],f=r.state.flowers.get(id),flower=scene.flowerGrowth.entries.get(id);
      r.damageFlower(id,10000);scene.flowerGrowth.render(0);
      const wilt={energy:f.energy,texture:flower.image.texture.key};
      r.state.drops.push({id:99999,kind:'heart',x:f.x,y:f.y,age:.4,speed:0,attracted:true,lifetime:20});
      r.step(.1,{x:f.x,y:f.y},{bounds:scene.fairyPatrol.bounds,
        direction:'right',length:scene.fairyPatrol.length,speed:40});
      scene.flowerGrowth.render(0);
      return {wilt,after:{energy:f.energy,texture:flower.image.texture.key},
        entries:scene.flowerGrowth.entries.size,hearts:r.state.hearts,stillOccupied:scene.fairyPatrol.occupied.length===36,
        spawned:scene.enemyPreview.model.spawned};
    });
    assert.equal(healed.wilt.energy,0);
    assert.ok(healed.wilt.texture.endsWith(':3:33'));
    assert.ok(healed.after.energy>0);
    assert.ok(healed.after.texture.endsWith(':3:100'));
    assert.equal(healed.entries,36);
    assert.equal(healed.stillOccupied,true);
    assert.ok(healed.hearts>0);

    // Test actual pointer dragging onto the secondary (previously decorative) slot.
    async function dragCard(id,index){
      const spawned=await page.evaluate(({id})=>{
        const s=window.__survivalTestGame.scene.getScene('Game');
        const c=s.runDrops.spawn('item',120,130,id,1);
        return {x:c.x,y:c.y};
      },{id});
      await page.mouse.move(...point(spawned.x,spawned.y));
      await page.mouse.down();
      await page.mouse.move(...point(10+Math.floor(index/2)*71+(index%2)*34+17,520),{steps:14});
      await page.mouse.up();
      return page.evaluate(({index})=>{
        const s=window.__survivalTestGame.scene.getScene('Game');
        return {id:s.runEquipment.equipped[index]?.id??null,actors:s.fairyPatrol.actors.length,
          partner:s.fairyPatrol.actors.find(a=>a.index===1)?.partner?.visible??false,
          model:s.heroWeaponPreview.model.state.equipped[index]??null};
      },{index});
    }
    const right=await dragCard('boomerang',1);
    assert.equal(right.id,'boomerang','secondary slot must accept real drag');
    assert.equal(right.partner,true,'paired fairies should walk visibly together');
    assert.equal(right.model,'boomerang');
    const left=await dragCard('boomerang',0);
    assert.equal(left.id,'boomerang');
    assert.equal(left.partner,true);
    const nominal=await page.evaluate(()=>{
      const s=window.__survivalTestGame.scene.getScene('Game');
      return window.GardenGameLayout.sumPreviewStats(s.runEquipment.equipped);
    });
    assert.equal(nominal.dps,21.9,'two boomerang fairies should count three boomerangs in HUD nominal DPS');
    const shots=await page.evaluate(()=>{
      const scene=window.__survivalTestGame.scene.getScene('Game'),H=window.GardenHeroWeaponPreview,
        spec=window.GardenGameLayout.spec,I=window.GardenItemCards,
        guardian=scene.fairyPatrol.actors[0],actor=scene.fairyPatrol.actors[1],
        garden=scene.fairyPatrol.boundary.garden,size=I.attackSize(scene,'boomerang',28);
      const model=H.create(spec,()=>.5,(id,span)=>I.attackSize(scene,id,span),true);
      model.equip(0,'boomerang');model.equip(1,'boomerang');
      const candidates=[];
      for(const length of [90,140,200,260])for(let i=0;i<16;i++){
        const a=i*Math.PI*2/16,p={x:actor.center.x+Math.cos(a)*length,
          y:actor.center.y+Math.sin(a)*length};
        if(H.validAim(spec,'boomerang',p,actor.center,garden,size,actor.visibleHeight,true))
          candidates.push(p);
      }
      const p=candidates[0];
      if(!p)return {error:'No valid nearby target',actor:actor.center,garden};
      const target={id:12345,x:p.x,y:p.y,ground:p.y,lift:0,hp:1000,level:1,
        radius:10,phase:'move',attackType:'approach',attackIn:3};
      model.step(.1,guardian,[target],()=>({killed:false,hp:100}),()=>true,scene.fairyPatrol,
        ()=>true,[actor]);
      return {fired:model.state.fired,count:model.state.shots.length,
        shots:model.state.shots.map(s=>({kind:s.kind,owner:s.owner,slot:s.slot,visual:s.visualKind,span:s.span,
          key:s.fusion?.key}))};
    });
    assert.ok(!shots.error,JSON.stringify(shots));
    assert.equal(shots.fired,3,'two boomerang fairies fire three boomerangs');
    assert.equal(shots.count,3);
    for(const shot of shots.shots){
      assert.equal(shot.owner,1);assert.equal(shot.slot,0);
      assert.equal(shot.kind,'boomerang');assert.equal(shot.visual,'boomerang');
      assert.equal(shot.span,28);assert.equal(shot.key,'boomerang|boomerang');
    }
    const enemies=await page.evaluate(()=>{
      const s=window.__survivalTestGame.scene.getScene('Game'),m=s.enemyPreview.model;
      m.advance(8);
      return {spawned:m.spawned,active:m.actors.length,time:m.elapsed,
        stage:window.GardenRunRules.campaign,formations:window.GardenRunRules.formations.length};
    });
    assert.ok(enemies.spawned>=7,'frequent enemy spawning by 8 seconds: '+JSON.stringify(enemies));
    assert.equal(enemies.stage,null);
    assert.equal(enemies.formations,0);
    await dragCard('shoe',2);
    const shoePartner=await dragCard('shoe',3);
    assert.equal(shoePartner.id,'shoe');
    assert.equal(shoePartner.actors,3);
    const speeds=await page.evaluate(()=>{
      const s=window.__survivalTestGame.scene.getScene('Game'),p=s.fairyPatrol,
        L=window.GardenGameLayout,
        at=a=>L.nearestPatrolDistance(p.bounds,a.center.x,a.center.y);
      const pair1=p.actors.find(a=>a.index===1),pair2=p.actors.find(a=>a.index===2);
      const a0=at(pair1),b0=at(pair2);p.advance(1);
      const a1=at(pair1),b1=at(pair2);
      return {normal:(a1-a0+p.length)%p.length,shoes:(b1-b0+p.length)%p.length,
        dualVisible:pair2.partner.visible};
    });
    assert.ok(Math.abs(speeds.normal-40)<1,'non-shoe pair retains 40px/s: '+JSON.stringify(speeds));
    assert.ok(Math.abs(speeds.shoes-72)<1,'double-shoe pair moves at 72px/s: '+JSON.stringify(speeds));
    assert.equal(speeds.dualVisible,true);
    const shieldSolo=await dragCard('shield',4);
    const shields=await dragCard('shield',5);
    assert.equal(shieldSolo.id,'shield');
    assert.equal(shields.partner,true);
    const protection=await page.evaluate(()=>{
      const s=window.__survivalTestGame.scene.getScene('Game'),p=s.fairyPatrol.actors.find(a=>a.index===3);
      const flowers=[...s.relicCollection.state.flowers.values()].sort((a,b)=>
        Math.hypot(a.x-p.center.x,a.y-p.center.y)-Math.hypot(b.x-p.center.x,b.y-p.center.y));
      const nearest=flowers[0],furthest=flowers.at(-1);
      return {nearDistance:Math.hypot(nearest.x-p.center.x,nearest.y-p.center.y),
        near:s.runEquipment.defenseAt(nearest.id),
        farDistance:Math.hypot(furthest.x-p.center.x,furthest.y-p.center.y),
        far:s.runEquipment.defenseAt(furthest.id),
        shoeOnly:window.GardenFairyCombinations.resolve('shoe','shoe').base};
    });
    assert.ok(protection.nearDistance<=185,JSON.stringify(protection));
    assert.equal(protection.near,12,'dual shield protects nearby flowers');
    assert.equal(protection.far,0,'dual shield does not protect distant flowers');
    assert.equal(protection.shoeOnly,null,'double-shoe pair has no attack');
    assert.deepEqual(errors,[],'browser errors '+width+'x'+height);
    console.log('Survival PASS',width,height,'6×6 square, four touching 3×3 flower quadrants, 20 interactive slots, heart revival, boomerang fusion, frequent enemies');
    await page.close();
  }
}finally{
  if(browser)await browser.close();
  server.close();
}
