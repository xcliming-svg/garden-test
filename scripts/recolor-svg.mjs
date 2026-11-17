// Generate and verify approved Garden 16 vector copies without changing originals.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {runInNewContext} from 'node:vm';
import assert from 'node:assert/strict';
const read=p=>readFileSync(p,'utf8').replace(/\r\n/g,'\n').trimEnd()+'\n';
const window={location:{search:''}};
runInNewContext(read('src/palette.js'),{window,URLSearchParams});
const palette=window.GardenPalette.hex;
const roles=JSON.parse(read('scripts/svg-palette-roles.json'));
const paint=/\b(fill|stroke|stop-color)="(#[\da-fA-F]{6})"/g;
assert.equal(Object.keys(roles).length,43);
assert.equal(new Set(Object.values(palette)).size,16);
for(const [f,sequence] of Object.entries(roles)){
 const original=read(join('assets',f));let i=0;
 const converted=original.replace(paint,(match,attribute,color)=>{
  const entry=sequence[i++];assert.ok(entry&&entry[0]===color.toUpperCase(),f+' source paint mismatch '+color);
  assert.ok(palette[entry[1]],f+' unknown role '+entry[1]);
  return attribute+'="'+palette[entry[1]]+'"';
 });
 assert.equal(i,sequence.length,f+' paint count');
 const target=join('assets/palette16',f);
 if(process.argv.includes('--write')){mkdirSync(dirname(target),{recursive:true});writeFileSync(target,converted);}
 assert.equal(read(target),converted,f+' must match generated palette copy');
 assert.equal(original.replace(paint,'$1="COLOR"'),converted.replace(paint,'$1="COLOR"'),f+' geometry changed');
 for(const m of converted.matchAll(paint))assert.ok(Object.values(palette).includes(m[2]),f);
}
console.log('PASS 43 original SVGs; only paint colors changed in generated copies');
