// Generate/check Garden 16 vector copies; never rewrite originals.
import {readFileSync,writeFileSync,readdirSync,mkdirSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {runInNewContext} from 'node:vm';
import assert from 'node:assert/strict';
const read=p=>readFileSync(p,'utf8').replace(/\r\n/g,'\n');
const window={location:{search:''}};
runInNewContext(read('src/palette.js'),{window,URLSearchParams});
const palette=window.GardenPalette.hex;
const roles=JSON.parse(read('scripts/svg-palette-roles.json'));
const files=[
 ...readdirSync('assets/flowers').filter(n=>n.endsWith('.svg')).map(n=>'flowers/'+n),
 ...readdirSync('assets/fairies').filter(n=>n.endsWith('.svg')).map(n=>'fairies/'+n),
 'caterpillar-preview.svg'
];
assert.equal(files.length,29);
const paint=/\b(fill|stroke)="(#[\da-fA-F]{6})"/g;
const used=new Set();
for(const f of files){
 const original=read(join('assets',f));
 const converted=original.replace(paint,(match,attribute,color)=>{
  const role=roles[color.toUpperCase()];
  assert.ok(role&&palette[role],f+' unknown color '+color);
  used.add(color.toUpperCase());
  return attribute+'="'+palette[role]+'"';
 });
 const target=join('assets/palette16',f);
 if(process.argv.includes('--write')){mkdirSync(dirname(target),{recursive:true});writeFileSync(target,converted);}
 assert.equal(read(target),converted,f+' must match the generated palette copy');
 assert.equal(original.replace(paint,'$1="COLOR"'),converted.replace(paint,'$1="COLOR"'),f+' geometry changed');
 for(const m of converted.matchAll(paint))assert.ok(Object.values(palette).includes(m[2]),f);
}
assert.deepEqual([...used].sort(),Object.keys(roles).sort());
console.log('PASS 29 original SVGs; only fill/stroke colors changed in copies');
