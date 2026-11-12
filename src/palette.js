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
  // 사용자 제공 1920×1080 스크린샷 및 상세 캡처에서 실측한 UI 역할 색.
  // 기존 Garden 32 및 원본 스프라이트 색은 별도로 보존한다.
  const referenceHex = Object.freeze({
    background: '#0D0D0D', hud: '#161619', hudEdge: '#3B404D', hudLight: '#51586A',
    divider: '#202020', panel: '#302E3A', header: '#44445C', button: '#343446',
    tab: '#3B3B4E', tabBorder: '#51516B', selected: '#4F4F69', hover: '#A4B2CF',
    border: '#878796', panelBorder: '#676777', tooltip: '#313142', tooltipHeader: '#43435B',
    rule: '#4B4B50', disabled: '#AAAAAA', text: '#FFFFFF', label: '#C8C8C8',
    description: '#F0E7AD', gold: '#DAA520', green: '#6ABA2C', red: '#FF4040',
    orange: '#FF9664', track: '#545454', barFrame: '#343446', progress: '#968143',
    skillProgress: '#657F95', shadow: '#000000', icon: '#B3DADB', job: '#324056',
    garden: '#343446', gardenBorder: '#6ABA2C'
  });
  const reference = Object.freeze({ hex: referenceHex, n: Object.freeze(Object.fromEntries(
    Object.entries(referenceHex).map(([key, value]) => [key, Number.parseInt(value.slice(1), 16)]))) });
  const background = Object.freeze({ hex: reference.hex.background, n: reference.n.background });
  const demo = Object.freeze({ field: background.n, garden: reference.n.garden });
  window.GardenPalette = Object.freeze({ hex, n, background, demo, reference });
}());
