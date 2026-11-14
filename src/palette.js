(function () {
  'use strict';
  // Garden 16: 기존 참조 화면의 저채도 보라회색 UI와 원본 자연색을 우선한다.
  // 디자인 기준: docs/ui-color-guide.md. 역할별 별칭은 추가 HEX를 만들지 않는다.
  const hex = Object.freeze({
    ink: '#0D0D0D', hud: '#161619', panel: '#3B3B4E', header: '#44445C',
    slate: '#51516B', stone: '#676777', silver: '#B0ACBD', paper: '#FFFFFF',
    bark: '#7C4C24', clay: '#A46444', sand: '#E9D0AB', gold: '#F4B404',
    red: '#F46C7C', growth: '#6ABA2C', teal: '#0C9484', sky: '#67A3EE'
  });
  const numeric = colors => Object.freeze(Object.fromEntries(Object.entries(colors).map(([key,value]) => [key,Number.parseInt(value.slice(1),16)])));
  const n = numeric(hex);
  const uiType = new URLSearchParams(window.location.search).get('uitype') === '1' ? 1 : 0;
  const darkReference = Object.freeze({
    background: hex.ink, hud: hex.hud, panel: hex.panel, tab: hex.panel,
    header: hex.header, selected: hex.slate, button: hex.panel,
    disabledFill: hex.hud, divider: hex.ink, hudEdge: hex.panel, hudLight: hex.slate,
    tabBorder: hex.slate, gridLine: hex.slate, panelBorder: hex.stone, border: hex.stone,
    disabledBorder: hex.slate, hover: hex.silver, text: hex.paper, label: hex.silver,
    hudLabel: hex.silver, disabled: hex.silver, green: hex.growth, red: hex.red,
    warning: hex.gold, icon: hex.silver, shadow: hex.ink, track: hex.hud,
    barFrame: hex.panel, garden: hex.hud, gardenBorder: hex.slate,
    flowerBorder: hex.growth, itemBorder: hex.sky
  });
  // Optional reference-image theme. Keep all sprite roles (Garden 16) unchanged.
  const lightReference = Object.freeze({...darkReference,
    background:'#83A650',hud:'#E2B66F',panel:'#EBC58F',tab:'#EBC58F',
    header:'#D9A25D',selected:'#C49A60',button:'#EBC58F',disabledFill:'#C49A60',
    divider:'#B07C43',hudEdge:'#945A31',hudLight:'#F5D49A',
    tabBorder:'#A46736',gridLine:'#B07C43',panelBorder:'#87512E',border:'#945A31',
    disabledBorder:'#B07C43',hover:'#F5DFB7',text:'#503821',label:'#503821',
    hudLabel:'#503821',disabled:'#67432C',green:'#55712D',red:'#A33F32',
    warning:'#945A31',icon:'#67432C',shadow:'#67432C',track:'#F5DFB7',
    barFrame:'#D9A25D',garden:'#A16A3E',gardenBorder:'#87512E',
    flowerBorder:'#55712D',itemBorder:'#945A31'
  });
  const referenceHex=uiType===1?lightReference:darkReference;
  const reference = Object.freeze({ baseHex: hex, hex: referenceHex, n: numeric(referenceHex) });
  const background = Object.freeze({ hex: referenceHex.background, n: reference.n.background });
  const demo = Object.freeze({ field: reference.n.background, garden: uiType===1?reference.n.garden:n.panel });
  window.GardenPalette = Object.freeze({ hex, n, background, demo, reference, uiType });
}());
