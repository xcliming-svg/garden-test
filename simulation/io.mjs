import {readFileSync,readdirSync,statSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {SOURCE_ORDER,loadModels,resolveConfig} from './models.mjs';
export const root=fileURLToPath(new URL('../',import.meta.url));
export const readJson=p=>JSON.parse(readFileSync(p,'utf8'));
export const hash=v=>createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
export function sourceSet(){
  const sources=Object.fromEntries(SOURCE_ORDER.map(id=>[id,readFileSync(join(root,'src',id+'.js'),'utf8')]));
  const html=readFileSync(join(root,'index.html'),'utf8');
  const order=[...html.matchAll(/src="\.\/src\/([^"]+)\.js"/g)].map(m=>m[1]).filter(id=>id!=='main'&&id!=='scenes');
  if(JSON.stringify(order)!==JSON.stringify(SOURCE_ORDER))throw Error('Source load order changed; update simulation/models.mjs');
  return sources;
}
export function fingerprints(sources){
  const sha=createHash('sha256'),asset=createHash('sha256');
  for(const [id,code] of Object.entries(sources))sha.update(id).update(code);
  for(const file of ['index.html','src/scenes.js','src/main.js','simulation/models.mjs','simulation/engine.mjs','simulation/agents.mjs','simulation/browser.mjs']){
    sha.update(file).update(readFileSync(join(root,file)));
  }
  function walk(folder){
    for(const name of readdirSync(folder).sort()){
      const p=join(folder,name);if(statSync(p).isDirectory())walk(p);
      else if(/\.(svg|json)$/i.test(name))asset.update(p.slice(root.length)).update(readFileSync(p));
    }
  }
  walk(join(root,'assets'));
  return {sourceHash:sha.digest('hex'),assetHash:asset.digest('hex')};
}
export function prepare(patch={},geometry=null){
  const sources=sourceSet(),config=resolveConfig(loadModels(sources),patch),fingerprint=fingerprints(sources);
  if(geometry){
    if(geometry.sourceHash!==fingerprint.sourceHash||geometry.assetHash!==fingerprint.assetHash)
      throw Error('Measured geometry fingerprint mismatch; recapture geometry for this revision');
    for(const id of Object.keys(config.enemyHp)){
      const g=geometry.enemies?.[id];if(!g||![g.width,g.height].every(v=>Number.isFinite(v)&&v>0))throw Error('Invalid measured enemy '+id);
    }
    for(const id of [...Object.keys(config.projectiles),'water-splash']){
      const g=geometry.weapons?.[id];if(!g||![g.width,g.height].every(v=>Number.isFinite(v)&&v>0))throw Error('Invalid measured weapon '+id);
      if(id==='sprinkler'&&(!g.pivot||!Array.isArray(g.nozzles)||g.nozzles.length!==3||![g.pivot,...g.nozzles].every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))))throw Error('Invalid measured sprinkler');
    }
    if(!Number.isFinite(geometry.waterHeightRatio)||geometry.waterHeightRatio<=0)throw Error('Invalid fairy geometry');
  }
  return {sources,config,fingerprint,geometry};
}
export function saveJson(path,value){
  const target=resolve(path);mkdirSync(dirname(target),{recursive:true});
  writeFileSync(target,JSON.stringify(value,null,2)+'\n',{flag:'wx'});return target;
}
