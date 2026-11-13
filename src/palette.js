(function () {
  'use strict';
  // Garden 32: B안 UI 기반 12색 + 참고 에셋의 불투명 픽셀 색상 계열 20색.
  // 참고 그림의 색을 정리한 규격이며 실제 SVG/PNG를 변환하지 않는다.
  const hex = Object.freeze({
    "ink": "#191B19",
    "shadow": "#101210",
    "soil": "#222820",
    "grid": "#343D30",
    "edge": "#45483D",
    "slot": "#777D6D",
    "disabled": "#A2A69A",
    "label": "#C0C1B7",
    "paper": "#F1F0E8",
    "growth": "#B3D96A",
    "slate": "#3C4454",
    "steel": "#5C6C7C",
    "teal": "#0C9484",
    "mint": "#6CCC84",
    "leaf": "#549C34",
    "grass": "#6CBC34",
    "sage": "#84C474",
    "gold": "#F4B404",
    "orange": "#E47C2C",
    "pink": "#F46C7C",
    "red": "#FF514A",
    "brick": "#CC4C4C",
    "lavender": "#B49CD4",
    "sky": "#74ACF4",
    "cyan": "#34ACDC",
    "denim": "#5C84AC",
    "navy": "#1C4C74",
    "clay": "#CC6C4C",
    "brown": "#A46444",
    "bark": "#7C4C24",
    "sand": "#E4C4A4",
    "stone": "#A4A4A4"
  });
  const n = Object.freeze(Object.fromEntries(Object.entries(hex).map(([key, value]) =>
    [key, Number.parseInt(value.slice(1), 16)])));
  // UI 전용 16색. 원본 Garden 32 및 스프라이트는 별도 보존한다.
  // 실제 색상은 이 표에서만 정하고 의미별 역할은 동일 색상을 참조한다.
  const uiHex = Object.freeze({
    background: '#0D0D0D', hud: '#161619', panel: '#302E3A', tab: '#3B3B4E', header: '#44445C',
    divider: '#202020', tabBorder: '#51516B', panelBorder: '#676777', hover: '#A4B2CF',
    text: '#FFFFFF', hudLabel: '#B0B0B0', disabled: '#AAAAAA',
    green: '#6ABA2C', red: '#FF4040', icon: '#B3DADB', shadow: '#000000'
  });
  const referenceHex = Object.freeze({
    ...uiHex,
    hudEdge: uiHex.tab,
    hudLight: uiHex.tabBorder,
    button: uiHex.tab,
    selected: uiHex.tabBorder,
    border: uiHex.panelBorder,
    label: uiHex.hudLabel,
    track: uiHex.panel,
    barFrame: uiHex.tab,
    garden: uiHex.tab,
    gardenBorder: uiHex.green
  });
  const reference = Object.freeze({ baseHex: uiHex, hex: referenceHex, n: Object.freeze(Object.fromEntries(
    Object.entries(referenceHex).map(([key, value]) => [key, Number.parseInt(value.slice(1), 16)]))) });
  const background = Object.freeze({ hex: reference.hex.background, n: reference.n.background });
  const demo = Object.freeze({ field: background.n, garden: reference.n.garden });
  window.GardenPalette = Object.freeze({ hex, n, background, demo, reference });
}());
