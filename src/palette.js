(function () {
  'use strict';
  // Garden 16: 단일 게임 공통 팔레트. 역할과 소재를 같은 색 원본에 연결한다.
  // 색 선정/사용 규칙: docs/ui-color-guide.md. 원본 에셋 픽셀 데이터는 별도 보존.
  const hex = Object.freeze({
    ink: '#151A1F', panel: '#2C343D', slate: '#485662',
    stone: '#929DA6', silver: '#C8D0D4', paper: '#F5F3EB',
    bark: '#754A35', clay: '#BB704D', sand: '#D8B48C', gold: '#F3C449',
    red: '#F0787C', leaf: '#4B8842', growth: '#94CC6D',
    teal: '#328F8B', sky: '#70B3E0', lavender: '#B59CD4'
  });
  const numeric = colors => Object.freeze(Object.fromEntries(Object.entries(colors).map(([key,value]) => [key,Number.parseInt(value.slice(1),16)])));
  const n = numeric(hex);
  // 같은 색을 사용하더라도 의미별 역할 이름을 유지한다. 신규 HEX를 선언하지 않는다.
  const referenceHex = Object.freeze({
    background: hex.ink, hud: hex.panel, panel: hex.panel, tab: hex.panel,
    header: hex.slate, selected: hex.slate, button: hex.panel,
    disabledFill: hex.ink, divider: hex.ink, hudEdge: hex.panel, hudLight: hex.slate,
    tabBorder: hex.stone, gridLine: hex.slate, panelBorder: hex.stone, border: hex.stone,
    disabledBorder: hex.slate, hover: hex.sky, text: hex.paper, label: hex.silver,
    hudLabel: hex.silver, disabled: hex.stone, green: hex.growth, red: hex.red,
    warning: hex.gold, icon: hex.sky, shadow: hex.ink, track: hex.ink,
    barFrame: hex.panel, garden: hex.panel, gardenBorder: hex.growth
  });
  const reference = Object.freeze({ baseHex: hex, hex: referenceHex, n: numeric(referenceHex) });
  const background = Object.freeze({ hex: hex.ink, n: n.ink });
  const demo = Object.freeze({ field: n.ink, garden: n.panel });
  window.GardenPalette = Object.freeze({ hex, n, background, demo, reference });
}());
