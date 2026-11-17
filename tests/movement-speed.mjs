import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {join,extname,resolve} from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const root=process.cwd(),out=resolve('benchmark-results');
mkdirSync(out,{recursive:true});
const require=createRequire(import.meta.url),phaser=require.resolve('phaser/dist/phaser.min.js');
const mime={'.js':'application/javascript','.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json'};
const server=createServer((req,res)=>{
 try{
  const path=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';
  if(path.includes('..'))return res.writeHead(404).end();
  let body=readFileSync(path==='phaser.js'?phaser:join(root,path));
  if(path==='index.html')body=body.toString().replace('https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.min.js','./phaser.js');
  if(path==='src/main.js')body=body.toString().replace("  window.addEventListener('resize',","  window.__previewGame = game;\n  window.addEventListener('resize',");
  res.writeHead(200,{'content-type':mime[extname(path)]||'application/octet-stream'}).end(body);
 }catch(e){res.writeHead(500).end(String(e));}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const report=[];
const baseById={'1_butterfly':40,'2_grasshopper':36,'6_mouse':36,'2_gray_bug':24,'1_cat':30,'3_caterpillar':20,'6_sparrow':46,'6_pigeon':48,'4_beetle':26,'2_frog':38,'6_rabbit':44,'5_bulldog':36};
try{
 for(const [name,w,h,query] of [['default',960,540,''],['fhd',1920,1080,''],['small',640,360,''],['full',960,540,'?full=1'],['hidden',960,540,'?enemies=0'],['combat',960,540,'?combat=1']]){
  const page=await browser.newPage({viewport:{width:w,height:h}});
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  try{
   await page.goto(url+'/index.html'+query+(query?'&':'?')+'attack=0');
   await page.waitForFunction(()=>window.__previewGame?.scene.isActive('MainMenu'));
   const canvas=await page.locator('canvas').boundingBox();
   await page.mouse.click(canvas.x+480*canvas.width/960,canvas.y+252*canvas.height/540);
   await page.waitForFunction(()=>{const s=window.__previewGame.scene.getScene('Game');return !!(s.fairyPatrol||s.combatPreview)});
   assert.equal(await page.locator('select').count(),0);
   if(name==='combat'){report.push({name,pass:true});continue;}
   const checked=await page.evaluate(()=>{
    const s=window.__previewGame.scene.getScene('Game'),F=s.fairyPatrol,c=s.enemyPreview,M=window.GardenEnemyMotion,E=window.GardenEnemyPreview;
    const check=(ok,msg)=>{if(!ok)throw Error(msg)};
    check(F.speed===40&&F.speedRank===0,'default fairy speed');
    check(F.occupied.length===s.flowerGrowth.entries.size,'garden count');
    const begin=F.distance;F.advance(1);check(Math.abs((F.distance-begin+F.length)%F.length-40)<1e-6,'fairy travel');
    // Future upgrade and expression hooks remain callable without DOM controls.
    F.setSpeedRank(5);const d=F.distance;F.advance(1);check(F.speed===80&&Math.abs((F.distance-d+F.length)%F.length-80)<1e-6,'maximum speed hook');F.setSpeedRank(0);
    F.setState('hit');check(F.actors.every(a=>a.expression==='dizzy'),'hit eyes');
    for(const state of ['win','lose']){
     F.setState(state);const elapsed=F.elapsed,dist=F.distance,et=c?.elapsed,centers=F.actors.map(a=>({...a.center}));
     F.advance(.13);c?.advance(.13);
     check(F.elapsed===elapsed&&F.distance===dist&&c?.elapsed===et&&JSON.stringify(centers)===JSON.stringify(F.actors.map(a=>a.center)),'result freeze');
     check(F.actors.every(a=>a.expression===(state==='win'?'happy':'closed')&&a.tears.every(t=>t.sprite.visible===(state==='lose'))),'result expressions');
    }
    F.setState('normal');check(F.actors.every(a=>a.tears.every(t=>!t.sprite.visible)),'resume tears');
    if(c){const a=c.actors[0];check(c.setExpression(a.id,'hit')&&a.expression==='dizzy','enemy hit hook');check(c.setExpression(a.id,'attack')&&a.expression==='angry','enemy attack hook');c.setExpression(a.id,'auto');check(E.spawning.rank===0,'base enemy rank');}
    const speeds=Object.fromEntries(E.roster.map(a=>[a.id,[M.speed(a,0),M.speed(a,5)]]));
    return {count:F.occupied.length,speeds,lap:F.length/F.speed,enemies:!!c};
   });
   assert.equal(checked.count,name==='full'?100:4);assert.equal(checked.enemies,name!=='hidden');
   for(const [id,[base,max]] of Object.entries(checked.speeds)){assert.equal(base,baseById[id]);assert.equal(max,base*1.5);}
   if(name==='default'||name==='fhd')await page.screenshot({path:join(out,'movement-speed-'+name+'.png'),scale:'device'});
   assert.deepEqual(errors,[]);report.push({name,...checked,pass:true});
  }finally{await page.close();}
 }
}finally{await browser.close();server.close();writeFileSync(join(out,'movement-speed-report.json'),JSON.stringify(report,null,2));}
console.log('PASS '+report.length+' movement speed configurations');
