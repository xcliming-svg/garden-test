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
  const referenceHex = Object.freeze({
    background: hex.ink, hud: hex.hud, panel: hex.panel, tab: hex.panel,
    header: hex.header, selected: hex.slate, button: hex.panel,
    disabledFill: hex.hud, divider: hex.ink, hudEdge: hex.panel, hudLight: hex.slate,
    tabBorder: hex.slate, gridLine: hex.slate, panelBorder: hex.stone, border: hex.stone,
    disabledBorder: hex.slate, hover: hex.silver, text: hex.paper, label: hex.silver,
    hudLabel: hex.silver, disabled: hex.silver, green: hex.growth, red: hex.red,
    warning: hex.gold, icon: hex.silver, shadow: hex.ink, track: hex.hud,
    barFrame: hex.panel, garden: hex.panel, gardenBorder: hex.growth
  });
  const reference = Object.freeze({ baseHex: hex, hex: referenceHex, n: numeric(referenceHex) });
  const background = Object.freeze({ hex: hex.ink, n: n.ink });
  const demo = Object.freeze({ field: n.ink, garden: n.panel });
  window.GardenPalette = Object.freeze({ hex, n, background, demo, reference });
}());
