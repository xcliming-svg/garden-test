// Temporary terrain preview only. No production source or asset palette changes.
(function(){
  'use strict';
  const palettes={
    '1':{name:'Golden Farm',grass:['#83A650','#7A9B49','#8CAE56','#759748','#92B35D','#688A3F','#9CBA65'],
      soil:['#A16A3E','#C18C54','#81512E','#AD7849','#67432C'],
      bg:'#30251B',hud:'#E2B66F',hudEdge:'#87512E',hudLight:'#F5D49A',divider:'#AF793D',
      tab:'#EBC58F',tabBorder:'#A46736',panel:'#F1D3A1',header:'#D9A25D',selected:'#C18A48',border:'#945A31',
      gridLine:'#B07C43',text:'#3B291D',label:'#604024',disabled:'#49311F',disabledFill:'#C49A60',disabledBorder:'#976438',
      track:'#F5DFB7',barFrame:'#B1793B',green:'#55712D',red:'#A1353B',flowerBorder:'#FFE6A0',itemBorder:'#205B75',hover:'#FFF0CA',icon:'#5D3D27',
      flowerFace:'#586B3D',flowerEdge:'#D3AD68',borderlessSoil:true,noTextShadow:true,titleText:'#2E1F16',darkSurfaceText:'#FFF1D3',fieldText:'#20170F',positiveText:'#375321',negativeText:'#80242F'},
    '2':{name:'Spring Storybook',grass:['#91C992','#88BF88','#9DD29E','#80B780','#A5D8AA','#74AB79','#B0DDB1'],
      soil:['#B88664','#D1A380','#976747','#C19171','#805740'],
      bg:'#463641',hud:'#F2DADD',hudEdge:'#A76D76',hudLight:'#FFF2E9',divider:'#CB9DA1',
      tab:'#F2E3D8',tabBorder:'#B6807B',panel:'#F9E9E1',header:'#DEB0B7',selected:'#D1A3AD',border:'#B17B80',
      gridLine:'#C08E8D',text:'#432F3C',label:'#634653',disabled:'#735463',disabledFill:'#D7C3CA',disabledBorder:'#B08C9A',
      track:'#F8EFE7',barFrame:'#C08E99',green:'#4D8154',red:'#B64F6C',flowerBorder:'#F9E6A0',itemBorder:'#216E79',hover:'#FFF7E9',icon:'#60414D',
      flowerFace:'#597E72',flowerEdge:'#D6AAA8'},
    '3':{name:'Rustic Woodland',grass:['#476E45','#41653F','#4D7448','#3D603B','#527C4D','#355831','#5E8856'],
      soil:['#85573E','#A77A56','#6A422F','#946448','#503526'],
      bg:'#211E18',hud:'#3C3228',hudEdge:'#79583D',hudLight:'#B18B5F',divider:'#241D18',
      tab:'#5C5042',tabBorder:'#A58962',panel:'#4C3D30',header:'#68513B',selected:'#765D44',border:'#89694D',
      gridLine:'#846648',text:'#FAEAD0',label:'#DBC6A5',disabled:'#DBC6A5',disabledFill:'#49382A',disabledBorder:'#8E7050',
      track:'#231E19',barFrame:'#70583E',green:'#9DBD64',red:'#EF9A83',flowerBorder:'#F6D98B',itemBorder:'#8CCDD8',hover:'#FFE0A3',icon:'#D9C49D',
      flowerFace:'#4D6047',flowerEdge:'#BEAA79'},
    '4':{name:'Mint Garden',grass:['#64A58A','#5B9B80','#6DAD91','#55947B','#75B599','#47866D','#82BFA2'],
      soil:['#AD7955','#C99A72','#895E44','#BA8561','#6A4A39'],
      bg:'#203836',hud:'#284E4B',hudEdge:'#518B7D',hudLight:'#98CCAC',divider:'#1A3937',
      tab:'#3B625B',tabBorder:'#83B5A0',panel:'#355D57',header:'#4A7A71',selected:'#56867D',border:'#82AA94',
      gridLine:'#719F8A',text:'#FFF5DE',label:'#D6EBDD',disabled:'#D6EBDD',disabledFill:'#35564F',disabledBorder:'#6F9A85',
      track:'#1B3835',barFrame:'#4A7669',green:'#ACD887',red:'#F2A4A1',flowerBorder:'#F9DB89',itemBorder:'#C7B9FF',hover:'#F9EED0',icon:'#D4E6D6',
      flowerFace:'#456E63',flowerEdge:'#9AC8B2'}
  };
  const type=new URLSearchParams(location.search).get('type');
  const t=palettes[type];if(!t)return;
  const P=window.GardenPalette;
  const hex=Object.freeze({...P.reference.hex,background:t.bg,hud:t.hud,panel:t.panel,tab:t.tab,button:t.panel,
    header:t.header,selected:t.selected,disabledFill:t.disabledFill,divider:t.divider,hudEdge:t.hudEdge,hudLight:t.hudLight,
    tabBorder:t.tabBorder,gridLine:t.gridLine,panelBorder:t.border,border:t.border,disabledBorder:t.disabledBorder,
    hover:t.hover,text:t.text,label:t.label,hudLabel:t.label,disabled:t.disabled,green:t.green,red:t.red,warning:t.flowerBorder,
    icon:t.icon,shadow:t.bg,track:t.track,barFrame:t.barFrame,garden:t.soil[0],gardenBorder:t.soil[4],flowerBorder:t.flowerBorder,itemBorder:t.itemBorder});
  const numeric=h=>Object.freeze(Object.fromEntries(Object.entries(h).map(([k,v])=>[k,parseInt(v.slice(1),16)])));
  window.GardenPalette=Object.freeze({...P,reference:Object.freeze({...P.reference,hex,n:numeric(hex)}),background:Object.freeze({hex:t.bg,n:parseInt(t.bg.slice(1),16)})});
  window.TerrainPreviewTheme=Object.freeze({...t,type});
  document.title='Garden Test | '+t.name+' · Type '+type+' (TEST)';
}());
