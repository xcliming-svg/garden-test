// Generate and verify approved Garden 16 vector copies without changing originals.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {runInNewContext} from 'node:vm';
import assert from 'node:assert/strict';
const read=p=>readFileSync(p,'utf8').replace(/\r\n/g,'\n').trimEnd()+'\n';
const window={location:{search:''}};
runInNewContext(read('src/palette.js'),{window,URLSearchParams});
const palette=window.GardenPalette.materialHex;
const roles=JSON.parse(read('scripts/svg-palette-roles.json'));
const paint=/\b(fill|stroke|stop-color)="(#[\da-fA-F]{6})"/g;
const normalizedPaint=/\b(fill|stroke|stop-color)="(#[\da-fA-F]{6}|none)"/g;
const potSeam='<path d="M673,413c0-7.04-13.03-1.25-17.65,.43c-8.3,3.02-18.65,3.03-27.35,4.57c-32.52,5.76-64.4,2.1-97-1c-11.88-1.13-23.52-7-35-7" fill="none" stroke="'+palette.bark+'" stroke-width="5" stroke-linecap="round"/>\n';
assert.equal(Object.keys(roles).length,60);
assert.equal(new Set(Object.values(palette)).size,16);
for(const [f,sequence] of Object.entries(roles)){
 const original=read(join('assets',f));let i=0;
 let converted=original.replace(paint,(match,attribute,color)=>{
  const entry=sequence[i++];assert.ok(entry&&entry[0]===color.toUpperCase(),f+' source paint mismatch '+color);
  assert.ok(palette[entry[1]]||(f==='items/05_wheel.svg'&&entry[1]==='transparent'&&attribute==='fill'),f+' unknown role '+entry[1]);
  return attribute+'="'+(entry[1]==='transparent'?'none':palette[entry[1]])+'"';
 });
 assert.equal(i,sequence.length,f+' paint count');
 const transparentWheel=f==='items/05_wheel.svg';
 const isPot=f==='items/06_flowerpot.svg';
 if(isPot){assert.ok(original.includes(potSeam.split('"')[1]),'pot seam follows original upper contour');converted=converted.replace('</g></svg>',potSeam+'</g></svg>');}
 const target=join('assets/palette16',f);
 if(process.argv.includes('--write')){mkdirSync(dirname(target),{recursive:true});writeFileSync(target,converted);}
 assert.equal(read(target),converted,f+' must match generated palette copy');
 assert.equal(original.replace(normalizedPaint,'$1="COLOR"'),(isPot?converted.replace(potSeam,''):converted).replace(normalizedPaint,'$1="COLOR"'),f+' geometry changed');
 if(transparentWheel)assert.equal((converted.match(/fill="none"/g)||[]).length,5,'wheel gaps must be transparent');
 for(const m of converted.matchAll(paint))assert.ok(Object.values(palette).includes(m[2]),f);
}
console.log('PASS 60 original SVGs; paint roles, wheel transparency and pot seam verified');
