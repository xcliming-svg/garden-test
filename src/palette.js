(function () {
  'use strict';
  // Approved Garden 16 v9: solid vector/material colors. UI shades are derived.
  const hex=Object.freeze({
    bark:'#4E352E',stone:'#706975',clay:'#AD7850',silver:'#96919B',
    paper:'#F4F1E9',sand:'#F5D3A5',gold:'#F6BB48',red:'#FB575F',
    redDark:'#D23840',pink:'#EB6A83',growth:'#84A83E',growthLight:'#C3D968',
    sky:'#6794D8',skyLight:'#91B8F7',lavender:'#AB75DA',violet:'#824DB6'
  });
  const numeric=colors=>Object.freeze(Object.fromEntries(Object.entries(colors).map(([key,value])=>[key,Number.parseInt(value.slice(1),16)])));
  const n=numeric(hex);
  const channel=(s,i)=>parseInt(s.slice(i,i+2),16);
  const rgb=values=>'#'+values.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('').toUpperCase();
  const mix=(a,b,t)=>rgb([1,3,5].map(i=>channel(a,i)*(1-t)+channel(b,i)*t));
  const shade=(a,t)=>rgb([1,3,5].map(i=>channel(a,i)*t));
  const coolGray=mix(hex.stone,hex.sky,.12);
  const ink=shade(hex.stone,.12),hud=shade(coolGray,.20),panel=shade(coolGray,.53),
    header=shade(coolGray,.62),slate=shade(coolGray,.75),label=mix(hex.silver,hex.paper,.36),
    redText=mix(hex.red,hex.paper,.40);
  const uiType=new URLSearchParams(window.location.search).get('uitype')==='1'?1:0;
  const darkReference=Object.freeze({
    background:ink,hud,panel,tab:panel,header,selected:slate,button:panel,
    disabledFill:hud,divider:ink,hudEdge:panel,hudLight:slate,
    tabBorder:slate,gridLine:slate,panelBorder:hex.stone,border:hex.stone,
    disabledBorder:slate,hover:label,text:hex.paper,label,hudLabel:label,disabled:label,
    green:hex.growthLight,red:hex.red,redText,warning:hex.gold,icon:label,shadow:ink,
    track:hud,barFrame:panel,garden:hud,gardenBorder:slate,
    flowerBorder:hex.growthLight,itemBorder:hex.skyLight
  });
  // Legacy preview roles are explicit; only solid art roles use the 16 base colors.
  const artHex=Object.freeze({...hex,ink:hex.bark,slate:hex.stone,teal:hex.sky});
  const art=Object.freeze({hex:artHex,n:numeric(artHex)});
  const roleHex=Object.freeze({...hex,ink,hud,panel,header,slate,teal:hex.sky});
  const roles=Object.freeze({hex:roleHex,n:numeric(roleHex)});
  // Optional reference-image theme. Keep all sprite roles (Garden 16) unchanged.
  const lightReference = Object.freeze({...darkReference,
    background:'#83A650',hud:'#E2B66F',panel:'#EBC58F',tab:'#EBC58F',
    header:'#D9A25D',selected:'#C49A60',button:'#EBC58F',disabledFill:'#C49A60',
    divider:'#B07C43',hudEdge:'#945A31',hudLight:'#F5D49A',
    tabBorder:'#A46736',gridLine:'#B07C43',panelBorder:'#87512E',border:'#945A31',
    disabledBorder:'#B07C43',hover:'#F5DFB7',text:'#503821',label:'#503821',
    hudLabel:'#503821',disabled:'#67432C',green:'#55712D',red:'#A33F32',
    redText:'#A33F32',warning:'#945A31',icon:'#67432C',shadow:'#67432C',track:'#F5DFB7',
    barFrame:'#D9A25D',garden:'#A16A3E',gardenBorder:'#87512E',
    flowerBorder:'#55712D',itemBorder:'#945A31'
  });
  const referenceHex=uiType===1?lightReference:darkReference;
  const reference = Object.freeze({ baseHex: hex, hex: referenceHex, n: numeric(referenceHex) });
  const background = Object.freeze({ hex: referenceHex.background, n: reference.n.background });
  const demo = Object.freeze({ field: reference.n.background, garden: uiType===1?reference.n.garden:roles.n.panel });
  window.GardenPalette = Object.freeze({ hex, n, art, roles, background, demo, reference, uiType });
}());
