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
    page.on('pageerror',e=>errors.push(String(e)));page.on('requestfailed',r=>errors.push(r.url()));
    await page.goto('http://127.0.0.1:'+server.address().port+'/');
    await page.waitForFunction(()=>window.__previewGame?.scene.isActive('MainMenu'));
    const box=await page.locator('canvas').boundingBox();
    await page.mouse.click(box.x+480*box.width/960,box.y+252*box.height/540);
    const select=page.locator('#hero-weapon-select');await select.waitFor();
    assert.equal(await select.inputValue(),'');
    const ids=await select.locator('option').evaluateAll(nodes=>nodes.map(n=>n.value));
    assert.deepEqual(ids,['','balloon','boomerang','wheel','flowerpot','paper-plane','bouncy-ball','yellow-floor','sprinkler','rock','broom']);
    const initial=await page.evaluate(()=>{
      const s=window.__previewGame.scene.getScene('Game');
      return {fairies:s.fairyPatrol.actors.length,enemies:!!s.enemyPreview,shots:s.heroWeaponPreview.model.state.shots.length};
    });
    assert.deepEqual(initial,{fairies:11,enemies:false,shots:0});
    const expectedSizes={boomerang:28,rock:12,sprinkler:24};
    for(const id of ids.slice(1)){
      await select.selectOption(id);
      if(id in expectedSizes)assert.equal(await page.evaluate(id=>window.GardenHeroWeaponPreview.tuning[id].span,id),expectedSizes[id]);
      await page.waitForFunction(id=>{
        const s=window.__previewGame.scene.getScene('Game'),m=s.heroWeaponPreview.model;
        return m.state.shots.some(q=>q.kind===id)&&s.children.list.some(q=>q.name?.startsWith('hero-weapon:'+id+':'));
      },id);
      // Cropped source art retains its ratio, with exact logical vertical height.
      await page.waitForFunction(id=>{
        const s=window.__previewGame.scene.getScene('Game'),A=window.GardenHeroWeaponPreview;
        return s.heroWeaponPreview.model.state.shots.some(q=>{
          const p=s.children.getByName('hero-weapon:'+id+':'+q.id);
          return q.kind===id&&p&&Math.abs((id==='boomerang'?Math.max(p.displayWidth,p.displayHeight):p.displayHeight)-A.tuning[id].span)<.001;
        });
      },id);
      const actual=await page.evaluate(()=>{
        const s=window.__previewGame.scene.getScene('Game'),m=s.heroWeaponPreview.model;
        return {selected:m.state.selected,owners:m.state.shots.map(q=>q.owner),enemy:!!s.enemyPreview};
      });
      assert.equal(actual.selected,id);assert.ok(actual.owners.length&&actual.owners.every(x=>x===0));assert.equal(actual.enemy,false);
      if(['wheel','yellow-floor','sprinkler','broom'].includes(id)){
        const safe=await page.evaluate(id=>{
          const s=window.__previewGame.scene.getScene('Game'),A=window.GardenHeroWeaponPreview;
          const g=s.fairyPatrol.boundary.garden,q=s.heroWeaponPreview.model.state.shots.find(q=>q.kind===id);
          if(!q)return false;
          const spec=window.GardenGameLayout.spec;
          if(id==='wheel')return !!A.wheelPath(spec,q.origin,{x:q.tx,y:q.ty},g,q.size,s.fairyPatrol.actors[0].visibleHeight);
          return A.installationSafe(spec,id,{x:q.tx,y:q.ty},g,q.size);
        },id);
        assert.equal(safe,true,'garden-safe '+id);
      }
    }
    // The asymmetric sprinkler head rotates around its original SVG hub,
    // not the bounding-box center; particles begin at each actual nozzle.
    await select.selectOption('sprinkler');
    await page.waitForFunction(()=>{
      const s=window.__previewGame.scene.getScene('Game'),A=window.GardenHeroWeaponPreview;
      return s.heroWeaponPreview.model.state.shots.some(q=>{
        if(q.kind!=='sprinkler'||q.age<.35)return false;
        const p=s.children.getByName('hero-weapon:sprinkler:'+q.id);
        return p&&Math.abs(p.originX-q.size.pivot.x)<.001&&Math.abs(p.originY-q.size.pivot.y)<.001&&
          p.originY<.45&&Math.hypot(p.x-q.tx,p.y-q.ty)<.001&&A.sprinklerDrops(q).length>=9;
      });
    });
    // Independent broom orbit is centered at the deployed point, not the moving fairy.
    await select.selectOption('broom');
    await page.waitForFunction(()=>{
      const s=window.__previewGame.scene.getScene('Game'),A=window.GardenHeroWeaponPreview;
      return s.heroWeaponPreview.model.state.shots.some(q=>{
        const p=s.children.getByName('hero-weapon:broom:'+q.id);
        return q.kind==='broom'&&q.age>.5&&p&&Math.abs(p.displayHeight-44)<.001&&
          Math.abs(Math.hypot(p.x-q.tx,p.y-q.ty)-A.tuning.broom.orbit)<.001&&
          Math.hypot(q.tx-s.fairyPatrol.actors[0].center.x,q.ty-s.fairyPatrol.actors[0].center.y)>40;
      });
    });
    // Real loaded water-splash SVG replaces the intact balloon at landing.
    await select.selectOption('balloon');
    await page.waitForFunction(()=>{
      const s=window.__previewGame.scene.getScene('Game'),A=window.GardenHeroWeaponPreview;
      return s.heroWeaponPreview.model.state.shots.some(q=>{
        const o=s.children.getByName('hero-weapon:balloon:'+q.id);
        return q.kind==='balloon'&&q.age<q.flight&&o?.texture.key.startsWith('item-svg:trim:balloon:display:');
      });
    });
    await page.waitForFunction(()=>{
      const s=window.__previewGame.scene.getScene('Game');
      return s.heroWeaponPreview.model.state.shots.some(q=>{
        const p=s.children.getByName('hero-weapon:balloon:splash:'+q.id);
        return q.kind==='balloon'&&q.age>=q.flight+.14&&p?.texture.key.startsWith('item-svg:trim:water-splash:display:')&&
          Math.abs(p.displayHeight-44)<.001&&p.displayWidth>100&&Math.abs(p.x-q.tx)<.001&&Math.abs(p.y-q.ty)<.001&&
          !s.children.getByName('hero-weapon:balloon:'+q.id)&&p.depth<2;
      });
    });
    assert.equal(await page.evaluate(()=>{
      const s=window.__previewGame.scene.getScene('Game');
      return s.textures.exists('item-svg:source:water-splash')&&s.itemCardPreview.cards.length===13;
    }),true);
    await select.selectOption('rock');await page.waitForTimeout(100);
    assert.equal(await page.evaluate(()=>window.__previewGame.scene.getScene('Game').children.list.some(o=>o.name?.startsWith('hero-weapon:balloon:'))),false);
    await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__previewGame.scene.isActive('Pause'));
    assert.equal(await select.isVisible(),false);
    const read=()=>page.evaluate(()=>window.__previewGame.scene.getScene('Game').heroWeaponPreview.model.state.elapsed);
    const paused=await read();await page.waitForTimeout(150);assert.equal(await read(),paused);
    await page.keyboard.press('Escape');await select.waitFor();assert.equal(await select.inputValue(),'rock');
    await select.selectOption('');
    assert.equal(await page.evaluate(()=>window.__previewGame.scene.getScene('Game').heroWeaponPreview.model.state.shots.length),0);
    // Actual pointer drags: equipped weapons start automatically without a selector.
    async function dragItem(id,index){
      const points=await page.evaluate(({id,index})=>{
        const s=window.__previewGame.scene.getScene('Game');
        const c=s.itemCardPreview.cards.find(c=>c.item.id===id).marker;
        const slot=s.children.getByName('preview-slot:'+index);
        return {from:{x:c.x,y:c.y},to:{x:slot.x,y:slot.y}};
      },{id,index});
      const canvas=await page.locator('canvas').boundingBox();
      const coords=p=>[canvas.x+p.x*canvas.width/960,canvas.y+p.y*canvas.height/540];
      await page.mouse.move(...coords(points.from));await page.mouse.down();
      await page.mouse.move(...coords(points.to),{steps:12});await page.mouse.up();
    }
    await dragItem('rock',0);
    await page.waitForFunction(()=>window.__previewGame.scene.getScene('Game').heroWeaponPreview.model.state.shots.some(s=>s.kind==='rock'&&s.slot===0&&!s.preview));
    assert.equal(await select.isDisabled(),true);
    await dragItem('wheel',1);
    await page.waitForFunction(()=>window.__previewGame.scene.getScene('Game').heroWeaponPreview.model.state.shots.some(s=>s.kind==='wheel'&&s.slot===1));
    await dragItem('shield',0);
    assert.deepEqual(await page.evaluate(()=>{const m=window.__previewGame.scene.getScene('Game').heroWeaponPreview.model;return {gear:m.state.equipped,old:m.state.shots.some(s=>s.slot===0)};}),{gear:['','wheel'],old:false});
    await dragItem('water-fairy',1);assert.equal(await select.isDisabled(),false);
    const fairyCard=await page.evaluate(()=>{
      const s=window.__previewGame.scene.getScene('Game'),c=s.itemCardPreview.cards.find(c=>c.item.id==='water-fairy'),slot=s.children.getByName('preview-equipped:1');
      const t=s.textures.get(c.item.texture).getSourceImage();
      return {count:s.itemCardPreview.cards.length,name:c.item.name,level:c.item.level,hidden:!c.marker.visible,slot:slot.visible,label:slot.levelLabel.text,height:slot.list[2].displayHeight,ratio:t.width/t.height,shots:s.heroWeaponPreview.model.state.shots.length};
    });
    assert.equal(fairyCard.count,13);assert.equal(fairyCard.name,'물방울 요정');assert.equal(fairyCard.level,1);assert.equal(fairyCard.hidden,true);assert.equal(fairyCard.slot,true);assert.equal(fairyCard.label,'Lv.1');assert.ok(Math.abs(fairyCard.height-24)<.01&&fairyCard.ratio>.6&&fairyCard.ratio<.75);assert.equal(fairyCard.shots,0);
    assert.equal(await page.evaluate(()=>window.__previewGame.scene.getScene('Game').heroWeaponPreview.model.state.shots.length),0);
    await page.evaluate(()=>window.__previewGame.scene.getScene('Game').scene.stop());
    await select.waitFor({state:'detached'});
    assert.deepEqual(errors,[]);
    console.log('PASS hero weapon preview',width,height,ids.length-1);
    // Dedicated live enemy mode has no old radial attack and accepts weapon cards.
    await page.goto('http://127.0.0.1:'+server.address().port+'/?enemies=1&weapons=1');
    await page.waitForFunction(()=>window.__previewGame?.scene.isActive('MainMenu'));
    const liveBox=await page.locator('canvas').boundingBox();
    await page.mouse.click(liveBox.x+480*liveBox.width/960,liveBox.y+252*liveBox.height/540);
    await select.waitFor();
    await page.waitForFunction(()=>window.__previewGame.scene.getScene('Game').enemyPreview?.actors.length>0);
    assert.equal(await page.evaluate(()=>window.__previewGame.scene.getScene('Game').enemyPreview.attack),null);
    await dragItem('rock',0);
    await dragItem('rock',9);
    await dragItem('water-fairy',8);
    assert.equal(await page.evaluate(()=>{const s=window.__previewGame.scene.getScene('Game');return s.children.getByName('preview-equipped:8').visible&&s.itemCardPreview.cards.find(c=>c.item.id==='water-fairy').marker.visible&&!s.heroWeaponPreview.model.state.equipped[8];}),true);
    assert.equal(await page.evaluate(()=>{const s=window.__previewGame.scene.getScene('Game');return s.heroWeaponPreview.model.state.equipped[9]==='rock'&&s.itemCardPreview.cards.find(c=>c.item.id==='rock').marker.visible;}),true);
    await page.waitForFunction(()=>window.__previewGame.scene.getScene('Game').heroWeaponPreview.model.state.hits>0,{},{timeout:60000});
    assert.equal(await page.evaluate(()=>window.__previewGame.scene.getScene('Game').heroWeaponPreview.model.state.shots.every(s=>s.owner===0)),true);
    assert.deepEqual(errors,[]);
    // Finite comparison starts with a level 3 preset, including repeated cards.
    await page.goto('http://127.0.0.1:'+server.address().port+'/?enemies=1&weapons=1&weaponSlots=4&weaponLevel=3&balanceWave=2&weaponLoadout=rock,rock,paper-plane,flowerpot');
    await page.waitForFunction(()=>window.__previewGame?.scene.isActive('MainMenu'));
    const presetBox=await page.locator('canvas').boundingBox();
    await page.mouse.click(presetBox.x+480*presetBox.width/960,presetBox.y+252*presetBox.height/540);
    await select.waitFor();
    await page.waitForFunction(()=>{
      const s=window.__previewGame.scene.getScene('Game'),m=s.heroWeaponPreview.model;
      return s.enemyPreview.model.spawned===2&&m.state.equipped.join(',')==='rock,rock,paper-plane,flowerpot'&&m.state.levels.every(l=>l===3)&&!s.children.getByName('preview-slot:4');
    });
    assert.equal(await page.evaluate(()=>window.__previewGame.scene.getScene('Game').enemyPreview.actors.every(a=>a.hp<=window.GardenWeaponBalance.hp(a.entry))),true);
    assert.deepEqual(errors,[]);
    // Parameterized size reaches the actual rendered sprite at both resolutions.
    await page.goto('http://127.0.0.1:'+server.address().port+'/?rockSize=9');
    await page.waitForFunction(()=>window.__previewGame?.scene.isActive('MainMenu'));
    const sizeBox=await page.locator('canvas').boundingBox();
    await page.mouse.click(sizeBox.x+480*sizeBox.width/960,sizeBox.y+252*sizeBox.height/540);
    await select.waitFor();
    await select.selectOption('rock');
    await page.waitForFunction(()=>{
      const s=window.__previewGame.scene.getScene('Game');
      return s.heroWeaponPreview.model.state.shots.some(q=>{
        const image=s.children.getByName('hero-weapon:rock:'+q.id);
        return q.kind==='rock'&&q.size.height===9&&image&&Math.abs(image.displayHeight-9)<.001;
      });
    });
    assert.deepEqual(errors,[]);
    await page.close();
  }
}finally{await browser?.close();await new Promise(r=>server.close(r));}
