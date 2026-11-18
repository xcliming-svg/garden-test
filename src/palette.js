(function () {
  'use strict';
  // Garden 20 v10: preserve the 16 material colors; add four existing dark UI colors.
  const materialHex=Object.freeze({
    bark:'#4E352E',stone:'#706975',clay:'#AD7850',silver:'#96919B',
    paper:'#F4F1E9',sand:'#F5D3A5',gold:'#F6BB48',red:'#FB575F',
    redDark:'#D23840',pink:'#EB6A83',growth:'#84A83E',growthLight:'#C3D968',
    sky:'#6794D8',skyLight:'#91B8F7',lavender:'#AB75DA',violet:'#824DB6'
  });
  const hex=Object.freeze({...materialHex,
    ink:'#0D0D0E',charcoal:'#16161A',graphite:'#3B3A44',slate:'#535361'
  });
  const numeric=colors=>Object.freeze(Object.fromEntries(Object.entries(colors).map(([key,value])=>[key,Number.parseInt(value.slice(1),16)])));
  const n=numeric(hex),materialN=numeric(materialHex);
  const {ink,charcoal:hud,graphite:panel,slate}=hex;
  const header=slate;
  const uiType=new URLSearchParams(window.location.search).get('uitype')==='1'?1:0;
  const darkReference=Object.freeze({
    background:ink,hud,panel,tab:panel,header,selected:slate,button:panel,
    disabledFill:hud,divider:ink,hudDivider:panel,hudEdge:panel,hudLight:slate,
    tabBorder:slate,gridLine:slate,panelBorder:hex.stone,border:hex.stone,
    disabledBorder:slate,hover:hex.silver,text:hex.paper,label:hex.paper,hudLabel:hex.silver,disabled:hex.silver,
    green:hex.growthLight,red:hex.red,redText:hex.red,warning:hex.gold,icon:hex.silver,shadow:ink,
    track:hud,barFrame:panel,garden:hud,gardenBorder:slate,flowerFrame:hex.graphite,
    flowerBorder:hex.growth,itemBorder:hex.sky
  });
  // Keep all existing material roles and SVG quantization restricted to the original 16.
  const artHex=Object.freeze({...materialHex,ink:hex.bark,slate:hex.stone,teal:hex.sky});
  const art=Object.freeze({hex:artHex,n:numeric(artHex)});
  const roleHex=Object.freeze({...hex,hud,panel,header,teal:hex.sky});
  const roles=Object.freeze({hex:roleHex,n:numeric(roleHex)});
  // Optional warm comparison uses the same approved palette rather than sampled RGBs.
  const lightReference = Object.freeze({...darkReference,
    background:hex.growth,hud:hex.sand,panel:hex.sand,tab:hex.sand,
    header:hex.clay,selected:hex.gold,button:hex.sand,disabledFill:hex.clay,
    divider:hex.clay,hudDivider:hex.clay,hudEdge:hex.bark,hudLight:hex.gold,
    tabBorder:hex.bark,gridLine:hex.bark,panelBorder:hex.bark,border:hex.bark,
    disabledBorder:hex.bark,hover:hex.bark,text:hex.bark,label:hex.bark,
    hudLabel:hex.bark,disabled:hex.bark,green:hex.bark,red:hex.redDark,
    redText:hex.redDark,warning:hex.bark,icon:hex.bark,shadow:hex.bark,track:hex.paper,
    barFrame:hex.clay,garden:hex.clay,gardenBorder:hex.bark,flowerFrame:hex.bark,
    flowerBorder:hex.growth,itemBorder:hex.sky
  });
  const referenceHex=uiType===1?lightReference:darkReference;
  const reference = Object.freeze({ baseHex: hex, hex: referenceHex, n: numeric(referenceHex) });
  const background = Object.freeze({ hex: referenceHex.background, n: reference.n.background });
  const demo = Object.freeze({ field: reference.n.background, garden: uiType===1?reference.n.garden:roles.n.panel });
  window.GardenPalette = Object.freeze({ hex, n, materialHex, materialN, art, roles, background, demo, reference, uiType });
}());
