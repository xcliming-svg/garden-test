(function () {
  'use strict';

  // 화면 및 아이템 UI 검토 전용. 임시 장착 상태는 씬 안에서만 사용한다.
  // 실제 전투, 획득, 재화 소비, 슬롯 확장 및 저장 로직은 없다.
  // 픽셀 로그라이크의 정보 밀도/여백을 참고. 8px 배수는 강제하지 않는다.
  const P = window.GardenPalette;
  const R = P.reference;
  const testSprites = window.GardenTestSprites;
  // 24px 타일 기반 UI: 메뉴와 같은 간격 토큰 및 논리 좌표를 사용한다.
  const U = window.GardenUI;
  const { unit, tile, spacing } = U;
  const blueprintCell = 8, blueprintLine = 1, blueprintPitch = blueprintCell + blueprintLine;
  const blueprintGrid = 10 * blueprintPitch + blueprintLine;
  const hudGap = 5;
  // 제목의 가시 여백은 5px. 분리된 제목 박스와 그리드 사이는 3px.
  const blueprintPadding = hudGap, blueprintFontSize = 10, blueprintGap = 3;
  const hudCenterY = 15, blueprintInkHeight = 9;
  // 30px 콘텐츠 영역, 15px 실제 텍스트 객체 높이: 상하/좌우 여백 7.5px.
  const hudTextHeight = 15, hudPadding = hudCenterY - hudTextHeight / 2;
  const blueprintHeader = blueprintInkHeight + 2 * blueprintPadding;
  const width = U.W, height = U.H;
  const topHudHeight = 32;
  const bottomGap = 3, bottomBoundary = 2;
  // 32px 기본 슬롯 + 상하 3px 여백 + HUD 경계선 2px. 비교 URL은 유지한다.
  const slotMode = new URLSearchParams(window.location.search).get('slots');
  const slotSize = slotMode === '24' ? 24 : slotMode === '36' ? 36 : 32;
  const bottomHudHeight = bottomBoundary + slotSize + 2 * bottomGap;
  const fieldHeight = height - topHudHeight - bottomHudHeight;
  const blueprintTopGap = hudPadding;
  const blueprintY = topHudHeight + blueprintTopGap;
  // 참조 트리 외형 24px = 내부 22px + 1px 프레임. 기존 대형 비교는 내부 32px 유지.
  // 이전 ?garden=36 링크는 대형 비교의 호환 별칭으로 유지한다.
  const gardenMode = new URLSearchParams(window.location.search).get('garden');
  const gardenCell = gardenMode === '32' || gardenMode === '36' ? unit * 4 : 22;
  const cellLine = 1, gardenPitch = gardenCell + 2 * cellLine;
  const iconSize = unit * 2, flowerDropSize = 24, itemDropSize = 32;
  // 비교 링크의 실제 실행 규격을 브라우저 탭 제목에서 식별할 수 있게 한다.
  if (['24', '32', '36'].includes(slotMode)) document.title = 'Garden Test | 슬롯 ' + slotSize + 'px';
  const gardenSize = 10 * gardenPitch;
  const spec = Object.freeze({
    width, height,
    top: topHudHeight, fieldHeight, bottom: bottomHudHeight,
    garden: Object.freeze({ x: (width - gardenSize) / 2, y: Math.floor(topHudHeight + (fieldHeight - gardenSize) / 2), columns: 10, rows: 10, cell: gardenCell, line: cellLine, gap: 0, pitch: gardenPitch }),
    blueprint: Object.freeze({
      x: hudPadding, y: blueprintY, padding: blueprintPadding, gap: blueprintGap, topGap: blueprintTopGap, header: blueprintHeader, fontSize: blueprintFontSize,
      columns: 10, rows: 10, cell: blueprintCell, line: blueprintLine, pitch: blueprintPitch,
      width: blueprintGrid,
      height: blueprintHeader + blueprintGap + blueprintGrid,
      gridX: hudPadding, gridY: blueprintY + blueprintHeader + blueprintGap
    }),
    slots: Object.freeze({ size: slotSize, cell: slotSize - 2 * cellLine, line: cellLine, gap: bottomGap, initial: 4, preview: 9, max: 10, y: height - bottomHudHeight + bottomBoundary + bottomGap, exampleCost: 999 })
  });

  const hud = Object.freeze({
    padding: hudPadding, gap: hudGap, labelSize: 12, valueSize: 12, timeSize: 12,
    centerY: hudCenterY, iconSize: 14, barHeight: 12, barWidth: 158, // 외형 12, 내부 8, 이중 프레임 2px
    columnUnit: 1, minMetricWidth: 0, hourDigits: 4, counterDigits: 12, minBarWidth: tile * 4,
    // 표시 폭 예약 기준이며 게임 데이터의 최대값이 아니다.
    previewProgress: 30,
  });
  // 능력치와 동일한 두 행의 높이 및 간격을 사용한다.
  const slotCost = Object.freeze({ padding: 1, gap: bottomGap, iconSize: unit, fontSize: 8, maxDigits: 3 });

  // size = 비교 브랜치의 논리 표시 크기. 기존 저해상도 테스트 원본은 그대로 사용한다.
  // assetKey와 suggestedFile은 이후 에셋 작업 시 참조할 식별자이다.
  const assets = Object.freeze({
    gardenTile: Object.freeze({ size: spec.garden.cell, assetKey: 'garden-tile', suggestedFile: 'assets/garden-tile.png' }),
    guardian: Object.freeze({ size: 24, color: P.n.teal, assetKey: 'guardian', suggestedFile: 'assets/guardian.png' }),
    enemy: Object.freeze({ size: unit * 2, color: P.n.red, assetKey: 'enemy', suggestedFile: 'assets/enemy.png' }),
    gem: Object.freeze({ size: unit, color: P.n.sky, assetKey: 'gem', suggestedFile: 'assets/gem.png' }),
    flower: Object.freeze({ size: iconSize, cardSize: spec.slots.size, dropSize: flowerDropSize, color: P.n.pink, assetKey: 'flower', suggestedFile: 'assets/flower.png' }),
    item: Object.freeze({ size: iconSize, cardSize: spec.slots.size, dropSize: itemDropSize, color: P.n.gold, assetKey: 'item', suggestedFile: 'assets/item.png' })
  });

  const colors = Object.freeze({
    field: R.n.background, hud: R.n.hud, hudBorder: R.n.hudEdge, hudDivider: R.n.divider,
    label: R.hex.label, hudLabel: R.hex.hudLabel, value: R.hex.text,
    gridFill: R.n.panel, gridLine: R.n.tabBorder, gridBorder: R.n.tabBorder,
    normalFill: R.n.tab, normalBorder: R.n.tabBorder,
    progressTrack: R.n.track, progressBorder: R.n.border, progressFill: R.n.green,
    disabledFill: R.n.panel, disabledBorder: R.n.tabBorder, disabledText: R.hex.disabled,
    enabledFill: R.n.background, enabledBorder: R.n.green, enabledText: R.hex.green,
    focusBorder: R.n.hover, invalidBorder: R.n.red,
    gardenSoil: R.n.garden, gardenSoilAlpha: 1, gardenBorder: R.n.gardenBorder,
    blueprintLine: R.n.tabBorder, reservedIcon: R.n.icon
  });

  // 고정된 미리보기 좌표일 뿐 실제 스폰 위치나 수량 정책이 아니다.
  const samples = Object.freeze({
    enemy: Object.freeze([
      [136,46],[156,54],[178,45],[198,61],[223,48],[250,55],[278,45],
      [372,46],[392,59],[416,43],[438,55],[461,47],[484,67],[510,48],[539,58],[566,43],
      [46,156],[69,169],[90,152],[114,183],[138,159],[163,181],[184,165],[207,193],
      [47,199],[73,215],[100,236],[127,215],[153,239],[184,221],[214,246],
      [426,132],[449,151],[473,119],[497,138],[522,152],[551,129],[579,149],[610,128],
      [431,191],[456,210],[479,181],[503,201],[529,185],[554,216],[585,196],[612,221],
      [97,279],[124,296],[154,276],[183,303],[214,284],[246,306],[273,287],
      [366,287],[395,306],[426,284],[453,300],[482,279],[514,303],[553,286],[588,304]
    ]),
    gem: Object.freeze([[215,77],[155,203],[209,263],[287,271],[354,62],[447,170],[532,235],[597,267]]),
    flower: Object.freeze([[177,252],[492,91],[399,269]]),
    item: Object.freeze([[137,101],[225,141],[303,291],[465,245],[572,89]])
  });

  function frame(g, x, y, w, h, fill, border) {
    g.fillStyle(border, 1).fillRect(x, y, w, h);
    g.fillStyle(fill, 1).fillRect(x + 1, y + 1, w - 2, h - 2);
  }

  // 1px 경계선만 사용하는 HUD와 슬롯의 1px 연속 사각형 표시.
  function hudBoundary(g, y) {
    g.fillStyle(colors.hudBorder, 1).fillRect(0, y, spec.width, 1);
    g.fillStyle(R.n.hudLight, 1).fillRect(0, y + 1, spec.width, 1);
  }

  // 내부 면을 침범하지 않는 1px 외부 프레임.
  function slotVisual(g, x, y, size, disabled) {
    U.pixelFrame(g, x, y, size, size, disabled ? colors.disabledFill : colors.normalFill,
      disabled ? colors.disabledBorder : colors.normalBorder);
  }

  // 드래그 중 후보에는 1px 두께의 9px 십자, 진입한 대상에는 같은 황록 1px 사각형.
  // 정수 픽셀 중앙에 맞추고 교차점과 모서리를 중복해서 그리지 않는다.
  function dropPlus(g, x, y, size) {
    const cx = x + Math.floor(size / 2), cy = y + Math.floor(size / 2);
    g.fillStyle(colors.enabledBorder, 1);
    g.fillRect(cx - 4, cy, 9, 1);
    g.fillRect(cx, cy - 4, 1, 4);
    g.fillRect(cx, cy + 1, 1, 4);
  }
  function dropSquare(g, x, y, size) {
    g.fillStyle(colors.enabledBorder, 1);
    g.fillRect(x + 1, y, size - 2, 1);
    g.fillRect(x + 1, y + size - 1, size - 2, 1);
    g.fillRect(x, y + 1, 1, size - 2);
    g.fillRect(x + size - 1, y + 1, 1, size - 2);
  }

  function grid(g, x, y, b, fill, line, outerBorder = colors.gridBorder) {
    const width = b.columns * b.pitch + b.line;
    const height = b.rows * b.pitch + b.line;
    // 외곽 및 내부 공유선은 1px, 각 칸의 순수 내부는 8×8.
    U.pixelFrame(g, x, y, width, height, fill, outerBorder);
    g.fillStyle(line, 1);
    for (let i = 1; i < b.columns; i++) {
      g.fillRect(x + i * b.pitch, y + b.line, b.line, height - 2 * b.line);
    }
    // 가로선은 각 내부 면 구간만 그려 세로선과 중복하지 않는다.
    for (let row = 1; row < b.rows; row++) {
      for (let col = 0; col < b.columns; col++) {
        g.fillRect(x + b.line + col * b.pitch, y + row * b.pitch, b.cell, b.line);
      }
    }
  }

  function text(scene, x, y, value, size, color, align) {
    return window.GardenUI.text(scene, x, y, value, size, color, {
      originX: align === 'center' ? 0.5 : align === 'right' ? 1 : 0,
      originY: 0.5
    });
  }

  function reserveIcon(g, x, y, size, color) {
    // 실제 보석 이미지를 넣지 않은 점선 자리.
    g.fillStyle(color, 1);
    for (let i = 0; i < size; i++) {
      // 양쪽 끝에서 같은 패턴을 시작하여 짝수 크기에서도 대칭을 유지한다.
      if (Math.min(i, size - 1 - i) % 2 !== 0) continue;
      g.fillRect(x + i, y, 1, 1);
      g.fillRect(x + i, y + size - 1, 1, 1);
      g.fillRect(x, y + i, 1, 1);
      g.fillRect(x + size - 1, y + i, 1, 1);
    }
  }

  // 표시 전용 포맷. 시간의 시 자리는 잘라내지 않고 최소 2자리만 채운다.
  // 정수는 문자열로 유지해 큰 수의 정밀도를 잃지 않는다.
  function formatHudTime(hours, minutes, seconds) {
    return String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
  }
  function formatHudCount(value) {
    return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function hudColumns(measure, timeValue, killsValue, gemsValue, measureLabel = measure, measureTime = measure) {
    // 숫자마다 폭이 다를 수 있으므로 0~9 중 가장 넓은 글자를 예약한다.
    const digit = Math.max(...Array.from({ length: 10 }, (_, i) => measure(String(i))));
    const timeDigit = Math.max(...Array.from({ length: 10 }, (_, i) => measureTime(String(i))));
    const colon = measureTime(':');
    const comma = measure(',');
    const timeReserve = Math.max((hud.hourDigits + 4) * timeDigit + 2 * colon, measureTime(timeValue));
    const counterReserve = Math.max(hud.counterDigits * digit + Math.floor((hud.counterDigits - 1) / 3) * comma,
      measure(killsValue), measure(gemsValue));
    const quantize = width => Math.ceil(width / hud.columnUnit) * hud.columnUnit;
    const paddedWidth = (label, value) => quantize(2 * hud.padding + label + hud.gap + value);
    // 시간·처치 수·보석 수 세 영역은 가장 넓은 예약 폭을 공유한다.
    // 최대 자릿수 예약을 유지하여 스트레스 모드에서도 위치가 흔들리지 않는다.
    // 언어를 바꿔도 열/게이지 경계가 이동하지 않도록 다섯 언어의 최대 레이블 폭을 예약한다.
    const labelSets = Object.values(U.hudLabels);
    const maxLabel = key => Math.max(...labelSets.map(labels => measureLabel(labels[key])));
    const metricWidth = Math.max(paddedWidth(maxLabel('time'), timeReserve),
      paddedWidth(maxLabel('kills'), counterReserve), paddedWidth(hud.iconSize, counterReserve));
    const progressWidth = 2 * hud.padding + maxLabel('progress') + hud.gap + hud.barWidth;
    const progressX = spec.width - progressWidth;
    if (3 * metricWidth > progressX) {
      throw new RangeError('HUD values exceed the available display width');
    }
    return {
      time: { x: 0, width: metricWidth },
      kills: { x: metricWidth, width: metricWidth },
      gems: { x: 2 * metricWidth, width: metricWidth },
      progress: { x: progressX, width: progressWidth, barWidth: hud.barWidth }
    };
  }

  function drawHud(scene) {
    const g = U.pixelGraphics(scene).setName('top-hud');
    g.fillStyle(colors.hud, 1).fillRect(0, 0, spec.width, spec.top);
    hudBoundary(g, spec.top - 2);

    // 개발용 표시 확인 값만 변경한다. 타이머/집계/저장은 구현하지 않는다.
    const stress = new URLSearchParams(window.location.search).get('hud') === 'stress';
    const time = stress ? formatHudTime(9999, 59, 59) : formatHudTime(0, 0, 0);
    const count = stress ? formatHudCount('9'.repeat(hud.counterDigits)) : '0';

    // 실제 로드된 글꼴의 논리 폭을 측정한다. 표시 값 대신 예약 폭으로 열을 만든다.
    const probe = text(scene, 0, hud.centerY, '', hud.valueSize, colors.value, 'left');
    function measure(value) {
      probe.setText(value);
      return Math.ceil(probe.width);
    }
    const labelProbe = text(scene, 0, hud.centerY, '', hud.labelSize, colors.hudLabel, 'left');
    function measureLabel(value) {
      labelProbe.setText(value);
      return Math.ceil(labelProbe.width);
    }
    const timeProbe = text(scene, 0, hud.centerY, '', hud.timeSize, colors.value, 'left');
    function measureTime(value) {
      timeProbe.setText(value);
      return Math.ceil(timeProbe.width);
    }
    const columns = hudColumns(measure, time, count, count, measureLabel, measureTime);
    const labels = U.hudLabels[U.hudLanguage()];
    const labelWidth = measureLabel(labels.progress);
    probe.destroy();
    labelProbe.destroy();
    timeProbe.destroy();

    // 좌측 수치 세 그룹 사이에만 구분선. 우측 완성도는 독립 우정렬.
    g.fillStyle(colors.hudDivider, 1);
    [columns.kills.x, columns.gems.x].forEach(x => g.fillRect(x, 5, 2, 20));

    // 참조처럼 시간·수치·레이블을 같은 12px 크기로 표시.
    function metric(column, label, value, valueSize = hud.valueSize) {
      const caption = text(scene, column.x + hud.padding, hud.centerY, label, hud.labelSize, colors.hudLabel, 'left');
      text(scene, caption.x + Math.ceil(caption.width) + hud.gap, hud.centerY, value, valueSize, colors.value, 'left');
    }
    metric(columns.time, labels.time, time, hud.timeSize);
    metric(columns.kills, labels.kills, count);

    const gem = columns.gems;
    reserveIcon(g, gem.x + hud.padding, hud.centerY - hud.iconSize / 2, hud.iconSize, colors.reservedIcon);
    text(scene, gem.x + hud.padding + hud.iconSize + hud.gap, hud.centerY, count, hud.valueSize, colors.value, 'left');

    const c = columns.progress;
    // 게이지 오른쪽 끝은 고정. 짧은 번역도 실제 레이블 끝에서 5px 뒤에 게이지를 표시한다.
    const barX = spec.width - hud.padding - c.barWidth;
    text(scene, barX - hud.gap - labelWidth, hud.centerY, labels.progress, hud.labelSize, colors.hudLabel, 'left');
    const barY = hud.centerY - hud.barHeight / 2;
    U.pixelFrame(g, barX, barY, c.barWidth, hud.barHeight, R.n.barFrame, colors.progressBorder);
    g.fillStyle(colors.progressTrack, 1).fillRect(barX + 2, barY + 2, c.barWidth - 4, hud.barHeight - 4);
    const progress = Math.max(0, Math.min(100, hud.previewProgress));
    const fillWidth = Math.round((c.barWidth - 4) * progress / 100);
    if (fillWidth > 0) {
      g.fillStyle(colors.progressFill, 1).fillRect(barX + 2, barY + 2, fillWidth, hud.barHeight - 4);
    }
    text(scene, barX + c.barWidth / 2, hud.centerY, progress + '%', U.fontSize.compact, colors.value, 'center');
    // 참조처럼 흰 숫자와 검은 1px 그림자를 그대로 유지.
  }

  // 글자 그림자는 제외하고 실제 전경 픽셀의 세로 범위를 측정한다.
  // 네이티브 텍스처 해상도가 바뀌면 다시 측정하며 원본 글리프는 수정하지 않는다.
  const bottomInkCache = new WeakMap();
  function bottomInk(item, background) {
    const key = [item.text, item.style.color, item.style.resolution, item.canvas.width, item.canvas.height, background].join('|');
    const cached = bottomInkCache.get(item);
    if (cached?.key === key) return cached.ink;
    const { width, height } = item.canvas;
    const data = item.context.getImageData(0, 0, width, height).data;
    const bg = Math.max((background >> 16) & 255, (background >> 8) & 255, background & 255);
    const fg = parseInt(item.style.color.slice(1), 16);
    const foreground = Math.max((fg >> 16) & 255, (fg >> 8) & 255, fg & 255);
    // Measure foreground at 25% contrast relative to its own color and surface.
    // A fixed brightness cutoff would miss antialiased gray 999 pixels when scaled down.
    const threshold = Math.ceil(bg + (foreground - bg) * 0.25);
    let top = height, bottom = 0, fallbackTop = height, fallbackBottom = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4, alpha = data[i + 3] / 255;
      const color = Math.max(data[i], data[i + 1], data[i + 2]);
      if (!alpha || !color) continue;
      fallbackTop = Math.min(fallbackTop, y);
      fallbackBottom = Math.max(fallbackBottom, y + 1);
      if (Math.round(color * alpha + bg * (1 - alpha)) < threshold) continue;
      top = Math.min(top, y);
      bottom = Math.max(bottom, y + 1);
    }
    const ink = bottom > top ? { top, bottom } : { top: fallbackTop, bottom: fallbackBottom };
    bottomInkCache.set(item, { key, ink });
    return ink;
  }

  function drawSlotCost(scene, x, y, size, value) {
    const c = slotCost, centerY = y + size / 2;
    const cost = text(scene, x + size / 2, 0, String(value), c.fontSize, colors.disabledText, 'center').setName('slot-cost-value');
    const icon = U.pixelGraphics(scene).setName('slot-cost-icon');
    // The dotted icon uses the same logical 8px dimensions. Rasterize the edge dots
    // on the actual output grid so a sub-1x scale cannot erase its outermost row.
    // 숫자 및 보석의 실제 픽셀 외접 범위가 HUD 중심에 오도록 배치한다.
    function alignCost() {
      const zoom = scene.cameras.main.zoom;
      const ink = bottomInk(cost, colors.disabledFill);
      const iconHeight = Math.max(1, Math.round(c.iconSize * zoom)), gap = Math.round(c.gap * zoom);
      const numberHeight = ink.bottom - ink.top;
      const iconTop = Math.round(centerY * zoom - (iconHeight + gap + numberHeight) / 2);
      const upperBottom = iconTop + iconHeight, numberTop = upperBottom + gap;
      const iconLeft = Math.round((x + (size - c.iconSize) / 2) * zoom);
      icon.setPosition(iconLeft / zoom, iconTop / zoom).clear();
      icon.fillStyle(R.n.disabled, 1);
      const pixelRange = i => {
        const start = Math.min(iconHeight - 1, Math.round(i * zoom));
        const end = Math.min(iconHeight, Math.max(start + 1, Math.round((i + 1) * zoom)));
        return [start / zoom, (end - start) / zoom];
      };
      const dot = (ix, iy) => {
        const [dx, dw] = pixelRange(ix), [dy, dh] = pixelRange(iy);
        icon.fillRect(dx, dy, dw, dh);
      };
      for (let i = 0; i < c.iconSize; i++) {
        if (Math.min(i, c.iconSize - 1 - i) % 2 !== 0) continue;
        dot(i, 0); dot(i, c.iconSize - 1); dot(0, i); dot(c.iconSize - 1, i);
      }
      cost.setY((numberTop - ink.top) / zoom + cost.displayOriginY);
      return { zoom, upperBottom, numberTop, numberBottom: numberTop + numberHeight };
    }
    alignCost();
    // 24px 비교 슬롯에서도 그림자가 외곽선을 침범하지 않도록 기존 마스크 유지.
    if (size === 22) {
      const clip = scene.make.graphics({ x: 0, y: 0, add: false });
      clip.fillStyle(0xffffff, 1).fillRect(x, y, size, size);
      const mask = clip.createGeometryMask();
      cost.setMask(mask);
      cost.once('destroy', () => { mask.destroy(); clip.destroy(); });
    }
    return alignCost;
  }

  // 9개 일반 + 마지막 확장 슬롯을 최대 폭에서 검토한다. 실제 초기 슬롯 정책은 4개로 유지.
  const statKeys = Object.freeze(['defense', 'hp', 'luck', 'moveSpeed', 'pickupRange', 'dps']);
  const statLabels = Object.freeze({
    defense: '방어력', hp: '최대 체력', luck: '행운',
    moveSpeed: '이동 속도', pickupRange: '획득 범위', dps: '초당 피해량'
  });
  // 모든 수치는 UI 비교용 임시 값. 실제 게임 계산식/단위/확률과 무관하다.
  const baseStats = Object.freeze({ defense: 12, hp: 100, luck: 0, moveSpeed: 100, pickupRange: 48, dps: 20 });
  const previewItems = Object.freeze([
    { name: '신발', desc: '이동 속도가 증가합니다.', stats: { moveSpeed: 10 } },
    { name: '스프링클러', desc: '회전형 공격을 추가합니다.', stats: { dps: 18 } },
    { name: '네잎클로버', desc: '도안에 필요한 꽃의 등장 확률이 증가합니다.', stats: { luck: 8 } },
    { name: '보호 비료', desc: '꽃의 생존 능력이 증가합니다.', stats: { defense: 6, hp: 24 } },
    { name: '자석', desc: '획득 범위가 증가합니다.', stats: { pickupRange: 12 } }
  ].map(item => Object.freeze({ ...item, stats: Object.freeze(item.stats) })));

  function sumPreviewStats(equipped) {
    const result = { ...baseStats };
    equipped.forEach(item => {
      if (item) Object.entries(item.stats).forEach(([key, value]) => { result[key] += value; });
    });
    return result;
  }

  function getPreviewStats(equipped, index, incoming) {
    const next = equipped.slice();
    if (Number.isInteger(index) && index >= 0 && index < spec.slots.preview) next[index] = incoming;
    return sumPreviewStats(next);
  }

  const bottomStats = Object.freeze({ fontSize: 8, valueSize: 8, columnWidth: 70, columns: 3, lineGap: bottomGap, deltaGap: spacing.micro });

  function bottomLayout() {
    const s = spec.slots;
    const totalWidth = s.max * s.size + (s.max - 1) * s.gap;
    const slotLeft = Math.floor((spec.width - totalWidth) / 2);
    const sideWidth = bottomStats.columnWidth * bottomStats.columns;
    const top = spec.top + spec.fieldHeight;
    return {
      top, centerY: spec.slots.y + s.size / 2, slotLeft, totalWidth, sideWidth,
      left: 10, right: spec.width - 10 - sideWidth,
      slots: Array.from({ length: s.max }, (_, index) => ({
        x: slotLeft + index * (s.size + s.gap), y: s.y, size: s.size
      }))
    };
  }

  function drawSlots(scene) {
    const s = spec.slots;
    const g = U.pixelGraphics(scene).setName('item-slots');
    g.fillStyle(colors.hud, 1).fillRect(0, spec.top + spec.fieldHeight, spec.width, spec.bottom);
    hudBoundary(g, spec.top + spec.fieldHeight);
    const layout = bottomLayout();
    layout.slots.forEach((slot, i) => {
      slotVisual(g, slot.x, slot.y, slot.size, i === s.preview);
      if (i === s.preview) layout.alignCost = drawSlotCost(scene, slot.x + s.line, slot.y + s.line, s.cell, s.exampleCost);
    });
    // 기존 확장 슬롯은 표시만 하며 드롭/클릭 대상으로 등록하지 않는다.
    return layout;
  }

  // 필드 드롭도 참조 노드의 색/테두리를 적용하고 16px 원본과 함께 부유시킨다.
  // 꽃 24px, 아이템 32px 히트 영역은 고정하고 장착 슬롯/스냅 고스트는 기존 카드 표현 유지.
  function floatingDrop(scene, marker, index) {
    const [border, face, image] = marker.list;
    border.setVisible(true);
    face.setVisible(true);
    const shadow = scene.add.ellipse(0, marker.height / 2 + 3, 12, 3, R.n.shadow, 0.25);
    marker.add(shadow);
    const period = 1800, phase = index * 317;
    function update(time) {
      const floating = marker.visible && marker.depth < 30;
      shadow.setVisible(floating);
      if (!floating) {
        border.setY(0);
        face.setY(0);
        image.setY(0);
        return;
      }
      const lift = (1 - Math.cos((time + phase) * Math.PI * 2 / period)) * 2;
      border.setY(-Math.round(lift));
      face.setY(-Math.round(lift));
      image.setY(-Math.round(lift));
      shadow.setScale(1 - lift * 0.0625, 1);
      shadow.setAlpha(1 - lift * 0.125);
    }
    update(0);
    return update;
  }

  function drawMarkers(scene) {
    const cards = [], flowers = [], animations = [];
    Object.entries(samples).forEach(([type, positions]) => {
      const asset = assets[type];
      positions.forEach(([baseX, baseY], i) => {
        const x = Math.round(baseX * 1.5), y = Math.round(baseY * 1.5);
        // 도형의 바운딩 박스는 논리 표시 크기와 같다.
        // 추후 동일한 x, y, origin(0.5)에서 해당 크기의 이미지로 교체한다.
        const spriteName = type === 'enemy' ? 'snail' : type === 'item' ? 'wheelbarrow' : type === 'flower' ? testSprites.flowers[i % testSprites.flowers.length] : null;
        const marker = (type === 'item' ? testSprites.itemCard(scene, x, y, spriteName, asset.dropSize, asset.size) :
          type === 'flower' ? testSprites.flowerCard(scene, x, y, spriteName, asset.dropSize, asset.size) :
          spriteName ? testSprites.marker(scene, x, y, spriteName, asset.size) : scene.add.rectangle(x, y, asset.size, asset.size, asset.color))
          .setName('placeholder:' + asset.assetKey + ':' + i);
        if (type === 'item' || type === 'flower') animations.push(floatingDrop(scene, marker, animations.length));
        if (type === 'item') cards.push({ item: previewItems[i], marker, x, y });
        if (type === 'flower') flowers.push({ marker, x, y, spriteName });
      });
    });
    // Scene update는 일시정지 중 멈추고 shutdown에서 정리된다.
    const updateDrops = time => animations.forEach(update => update(time));
    scene.events.on('update', updateDrops);
    scene.events.once('shutdown', () => scene.events.off('update', updateDrops));
    return { cards, flowers };
  }

  function drawBlueprint(scene) {
    const b = spec.blueprint;
    // 패널 접기는 화면 UI 상태만 변경한다.
    const body = U.pixelGraphics(scene).setDepth(10).setName('blueprint-body');
    // 제목 박스와 그리드를 독립 외곽선으로 그리고 사이에 3px 공백을 둔다.
    grid(body, b.gridX, b.gridY, b, colors.gridFill, colors.blueprintLine, R.n.panelBorder);

    const header = U.pixelGraphics(scene).setDepth(11).setName('blueprint-header');
    text(scene, b.x + b.padding, b.y + b.header / 2 - 0.75, '도안', b.fontSize, colors.hudLabel, 'left').setDepth(12).setName('blueprint-title');
    const arrow = scene.add.graphics().setDepth(12).setName('blueprint-chevron');
    let expanded = true;
    function drawArrow() {
      header.clear();
      U.pixelFrame(header,b.x,b.y,b.width,b.header,R.n.header,R.n.panelBorder);
      arrow.clear().lineStyle(1, R.n.label, 1);
      const x = b.x + b.width - b.padding - spacing.small;
      const y = b.y + b.header / 2;
      arrow.beginPath();
      arrow.moveTo(x - spacing.small, y + (expanded ? spacing.micro : -spacing.micro));
      arrow.lineTo(x, y + (expanded ? -spacing.micro : spacing.micro));
      arrow.lineTo(x + spacing.small, y + (expanded ? spacing.micro : -spacing.micro));
      arrow.strokePath();
    }
    drawArrow();
    scene.add.zone(b.x + b.width / 2, b.y + b.header / 2, b.width, b.header)
      .setDepth(13).setName('blueprint-toggle').setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        expanded = !expanded;
        body.setVisible(expanded);
        drawArrow();
      });
  }


  function tooltipPosition(anchor, width, height, fieldBottom) {
    const margin = 10;
    const gap = itemTooltip.gap;
    const half = anchor.size / 2;
    // 슬롯/하단 카드에서는 위쪽, 전장에서는 좌우를 우선한다.
    const right = anchor.x + half + gap;
    const left = anchor.x - half - gap - width;
    const above = anchor.y - half - gap - height;
    const below = anchor.y + half + gap;
    const centeredX = anchor.x - width / 2;
    const candidates = anchor.y >= fieldBottom - spacing.base
      ? [[centeredX, above], [right, above], [left, above]]
      : [[right, anchor.y - half], [left, anchor.y - half], [centeredX, above], [centeredX, below]];
    const top = spec.top + 10;
    const bottom = fieldBottom - spacing.base;
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, Math.max(lo, hi)));
    const xFits = x => x >= margin && x + width <= spec.width - margin;
    const yFits = y => y >= top && y + height <= bottom;
    const best = candidates.find(([x, y]) => xFits(x) && yFits(y)) ||
      candidates.find(([x]) => xFits(x)) || candidates[0];
    return { x: Math.round(clamp(best[0], margin, spec.width - margin - width)),
      y: Math.round(clamp(best[1], top, bottom - height)) };
  }

  // 정보창의 중성 회색 테두리, 보라색 제목 바와 HUD 공통 회색 본문.
  const itemTooltip = Object.freeze({
    width: hud.barWidth, padding: 6, gap: 8, bottomPadding: 14, fontSize: 10, titleSize: 10,
    rowGap: 5, lineSpacing: 4, strokeWidth: 1, accent: R.n.panelBorder,
    background: R.n.tooltip, header: R.n.tooltipHeader,
    title: colors.value, description: colors.hudLabel, hint: colors.disabledText
  });

  // 교체 제목은 한 줄 우선, 넘치면 화살표 앞에서 분리한다.
  // 개별 이름까지 길 경우 공백 우선으로, 필요 시 문자 단위로 줄바꿈한다.
  function replacementTitle(previous, incoming, measure, maxWidth) {
    const combined = previous + ' → ' + incoming;
    if (measure(combined) <= maxWidth) return combined;

    function wrapName(value) {
      const lines = [];
      let line = '';
      for (const char of Array.from(value)) {
        const next = line + char;
        if (line && measure(next) > maxWidth) {
          const space = line.lastIndexOf(' ');
          if (space > 0) {
            lines.push(line.slice(0, space));
            line = (line.slice(space + 1) + char).trimStart();
          } else {
            lines.push(line.trimEnd());
            line = char.trimStart();
          }
          // 공백 뒤 남은 문자열과 새 문자가 함께 넘치는 경우도 처리한다.
          if (line && measure(line) > maxWidth && Array.from(line).length > 1) {
            const chars = Array.from(line);
            const last = chars.pop();
            lines.push(chars.join('').trimEnd());
            line = last.trimStart();
          }
        } else {
          line = next;
        }
      }
      if (line.trim()) lines.push(line.trimEnd());
      return lines.join('\n');
    }

    return wrapName(previous) + '\n' + wrapName('→ ' + incoming);
  }

  function drawItemPreview(scene, layout, cards) {
    const U = window.GardenUI;
    const s = spec.slots;
    const equipped = Array(s.preview).fill(null);
    let hovered = null, pinned = null, dragging = null, target = -1;
    const clickable = new Set();
    const accents = U.pixelGraphics(scene).setDepth(31).setName('preview-slot-highlight');
    const slotItems = [];
    const slots = layout.slots.slice(0, s.preview);
    // 꽃과 같은 드래그 카드/스냅 미리보기 분리. 장착 결과와 동일한 카드 외형.
    const ghost = testSprites.itemCard(scene, 0, 0, 'wheelbarrow', assets.item.cardSize, assets.item.size)
      .setDepth(22).setAlpha(0.45).setVisible(false).setName('item-preview-ghost');

    // 양쪽 바깥 여백에서 동일 폭 열 3개. 각 텍스트 묶음의 실제 크기로 중앙 정렬.
    const stats = statKeys.map((key, index) => {
      const left = index < bottomStats.columns ? layout.left : layout.right;
      const x = left + bottomStats.columnWidth * ((index % bottomStats.columns) + 0.5);
      const size = bottomStats.fontSize;
      return {
        key, x,
        label: text(scene, x, layout.centerY, statLabels[key], size, colors.label, 'center').setName('stat-label:' + key),
        value: text(scene, x, layout.centerY, '', bottomStats.valueSize, colors.value, 'center').setName('stat-value:' + key),
        delta: text(scene, x, layout.centerY, '', bottomStats.valueSize, colors.value, 'center').setName('stat-delta:' + key)
      };
    });
    const tooltip = scene.add.container(0, 0).setDepth(40).setName('item-preview-tooltip').setVisible(false);
    let tooltipKey = null, tooltipSize = { width: itemTooltip.width, height: 0 };

    function signed(n) { return (n > 0 ? '+' : '') + String(n); }
    function renderStats() {
      const current = sumPreviewStats(equipped);
      const next = dragging && target >= 0 ? getPreviewStats(equipped, target, dragging.item) : current;
      const rows = layout.alignCost();
      stats.forEach(row => {
        const d = next[row.key] - current[row.key];
        row.value.setText(String(next[row.key]));
        row.delta.setText(d ? signed(d) : '').setColor(d > 0 ? R.hex.green : d < 0 ? R.hex.red : colors.value)
          .setVisible(d !== 0);
        // 레이블 하단과 보석 하단, 모든 숫자의 가시 상단을 동일한 픽셀 행에 정렬한다.
        // 증감이 있을 때는 값과 증감 사이 2px를 두고 전체 행을 중앙 정렬한다.
        const valueWidth = row.value.width;
        const deltaWidth = d ? row.delta.width : 0;
        const gap = d ? bottomStats.deltaGap : 0;
        const rowWidth = valueWidth + gap + deltaWidth;
        const labelInk = bottomInk(row.label, colors.hud), valueInk = bottomInk(row.value, colors.hud);
        const labelY = (rows.upperBottom - labelInk.bottom) / rows.zoom + row.label.displayOriginY;
        const valueY = (rows.numberTop - valueInk.top) / rows.zoom + row.value.displayOriginY;
        const left = row.x - rowWidth / 2;
        row.label.setPosition(row.x, labelY);
        row.value.setPosition(left + valueWidth / 2, valueY);
        const deltaY = d ? (rows.numberBottom - bottomInk(row.delta, colors.hud).bottom) / rows.zoom + row.delta.displayOriginY : valueY;
        row.delta.setPosition(left + valueWidth + gap + deltaWidth / 2, deltaY);
      });
    }
    function slotAnchor(index) {
      const slot = slots[index];
      return { x: slot.x + slot.size / 2, y: slot.y + slot.size / 2, size: slot.size };
    }
    function effectRows(item, removed) {
      return statKeys.filter(key => item.stats[key]).map(key => ({
        value: statLabels[key] + ' ' + signed((removed ? -1 : 1) * item.stats[key]),
        color: removed ? R.hex.red : R.hex.green
      }));
    }
    function rebuildTooltip(key, rows) {
      if (tooltipKey === key) return;
      tooltipKey = key;
      tooltip.removeAll(true);
      const t = itemTooltip;
      const w = t.width, pad = t.padding;
      const labels = [];
      let y = pad, headerHeight = 0;
      rows.forEach((row, index) => {
        if (index === 1) {
          headerHeight = y;
          y += t.rowGap;
        }
        let value = row.value;
        const fontSize = index === 0 ? t.titleSize : t.fontSize;
        if (row.replacement) {
          const probe = U.text(scene, 0, 0, '', fontSize, row.color);
          try {
            value = replacementTitle(row.replacement[0], row.replacement[1], candidate => {
              probe.setText(candidate);
              return probe.width;
            }, w - 2 * pad);
          } finally {
            probe.destroy();
          }
        }
        const label = U.text(scene, pad, y, value, fontSize, row.color, {
          wrap: row.replacement ? undefined : w - 2 * pad, lineSpacing: t.lineSpacing
        });
        labels.push(label);
        y += Math.max(fontSize, Math.ceil(label.height)) + t.rowGap;
      });
      tooltipSize = { width: w, height: y + t.bottomPadding - t.rowGap };
      const background = U.pixelBox(scene,w/2,tooltipSize.height/2,w,tooltipSize.height,t.background,{strokeWidth:t.strokeWidth,border:t.accent}).setName('item-tooltip-background');
      tooltip.add(background);
      if (headerHeight) {
        const header = U.pixelBox(scene,w/2,(headerHeight+1)/2,w-2,headerHeight-1,t.header,{cut:false})
          .setName('item-tooltip-header');
        tooltip.add(header);
      }
      labels.forEach(label => tooltip.add(label));
    }
    function refreshTooltip() {
      let focus = hovered || pinned;
      // 드래그 중에는 장착된 슬롯과 교체할 때만 정보창을 표시한다.
      if (dragging && (target < 0 || !equipped[target])) { tooltip.setVisible(false); return; }
      if (dragging) focus = { card: dragging };
      if (!focus) { tooltip.setVisible(false); return; }
      const card = focus.card;
      const index = dragging && target >= 0 ? target : focus.slot;
      const item = card ? card.item : equipped[index];
      if (!item || (card && card.consumed)) { tooltip.setVisible(false); return; }
      const previous = dragging && target >= 0 ? equipped[target] : null;
      const anchor = Number.isInteger(index) && index >= 0 ? slotAnchor(index) :
        { x: card.marker.x, y: card.marker.y, size: assets.item.dropSize };
      let rows;
      if (previous) {
        rows = [{ value: previous.name + ' → ' + item.name, replacement: [previous.name, item.name], color: itemTooltip.title },
          { value: item.desc, color: itemTooltip.description }, ...effectRows(item, false),
          ...effectRows(previous, true), { value: '놓으면 기존 아이템 교체', color: itemTooltip.hint }];
      } else {
        rows = [{ value: item.name, color: itemTooltip.title },
          { value: item.desc, color: itemTooltip.description }, ...effectRows(item, false)];
        if (!card) rows.push({ value: '장착 중', color: itemTooltip.hint });
      }
      const key = JSON.stringify(rows);
      rebuildTooltip(key, rows);
      // 중앙 스트로크의 바깥쪽 0.5px까지 경계 안에 두고 정수 좌표를 유지한다.
      const pos = tooltipPosition(anchor, tooltipSize.width + 2, tooltipSize.height + 2, layout.top);
      tooltip.setPosition(pos.x + 1, pos.y + 1).setVisible(true);
    }
    function sameFocus(a, b) { return !!a && !!b && (a.card ? a.card === b.card : a.slot === b.slot); }
    function refresh() {
      const focus = hovered || pinned;
      accents.clear();
      cards.forEach(card => {
        const active = dragging ? dragging === card : focus && focus.card === card;
        card.marker.setStrokeStyle(active ? 1 : 0, colors.focusBorder, active ? 1 : 0);
      });
      slots.forEach((slot, index) => {
        const focused = dragging ? target === index : focus && focus.slot === index && equipped[index];
        // 슬롯 면과 외부 프레임을 유지하고 이동 중에는 +, 진입한 칸만 황록 사각형.
        if (dragging) {
          if (focused) dropSquare(accents, slot.x, slot.y, slot.size);
          else dropPlus(accents, slot.x, slot.y, slot.size);
        }
        // 평상시 장착 카드 호버는 카드 내부 면만 강조하며 꺾쇠는 그리지 않는다.
        slotItems[index].setStrokeStyle(0, colors.focusBorder, !dragging && focused ? 1 : 0);
        // 교체 대상의 기존 카드는 미리보기와 중첩하지 않도록 잠시 숨긴다.
        slotItems[index].setVisible(!!equipped[index] && !(dragging && target === index)).setAlpha(1);
      });
      ghost.setVisible(false);
      if (dragging && target >= 0) {
        const anchor = slotAnchor(target);
        ghost.setPosition(anchor.x, anchor.y).setVisible(true);
      }
      renderStats();
      refreshTooltip();
    }
    function point(pointer) { return scene.cameras.main.getWorldPoint(pointer.x, pointer.y); }
    function hitSlot(p) {
      return slots.findIndex(slot => p.x >= slot.x && p.x < slot.x + slot.size &&
        p.y >= slot.y && p.y < slot.y + slot.size);
    }
    function dragTo(pointer) {
      if (!dragging) return;
      const p = point(pointer);
      target = hitSlot(p);
      const half = assets.item.dropSize / 2;
      // 꽃과 동일: 원래 카드는 커서를 계속 따라가고, 미리보기만 슬롯 중심에 붙는다.
      const anchor = {
        x: Math.max(half, Math.min(spec.width - half, p.x)),
        y: Math.max(spec.top + half, Math.min(spec.height - half, p.y))
      };
      refresh();
      dragging.marker.setPosition(anchor.x, anchor.y).setAlpha(target >= 0 ? 0.25 : 1);
    }
    function finishDrag(pointer, accept) {
      if (!dragging) return;
      const card = dragging;
      const index = accept && pointer ? hitSlot(point(pointer)) : -1;
      dragging = null; target = -1; hovered = null; pinned = null;
      card.marker.setDepth(0).setPosition(card.x, card.y).setAlpha(1);
      if (index >= 0) {
        equipped[index] = card.item; // UI 테스트용 대체. 기존 임시 아이템은 제거.
        card.consumed = true;
        card.marker.disableInteractive().setVisible(false);
      }
      refresh();
    }
    function bindFocus(obj, focus) {
      clickable.add(obj);
      obj.on('pointerover', () => { if (!dragging) { hovered = focus; refresh(); } });
      obj.on('pointerout', () => {
        if (!dragging && sameFocus(hovered, focus)) { hovered = null; refresh(); }
      });
      obj.on('pointerdown', () => {
        if (!dragging) {
          pinned = sameFocus(pinned, focus) ? null : focus;
          refresh();
        }
      });
    }
    slots.forEach((slot, index) => {
      const center = slotAnchor(index);
      slotItems.push(testSprites.itemCard(scene, center.x, center.y, 'wheelbarrow', assets.item.cardSize, assets.item.size)
        .setDepth(20).setName('preview-equipped:' + index).setVisible(false));
      const zone = scene.add.zone(center.x, center.y, slot.size, slot.size).setDepth(21)
        .setName('preview-slot:' + index).setInteractive({ useHandCursor: true });
      bindFocus(zone, { slot: index });
    });
    cards.forEach(card => {
      const marker = card.marker;
      marker.setInteractive({ useHandCursor: true, draggable: true });
      scene.input.setDraggable(marker);
      bindFocus(marker, { card });
      marker.on('dragstart', pointer => {
        if (card.consumed || dragging) return;
        dragging = card; pinned = null; hovered = null;
        marker.setDepth(30);
        dragTo(pointer);
      });
      marker.on('drag', pointer => { if (dragging === card) dragTo(pointer); });
      marker.on('dragend', pointer => { if (dragging === card) finishDrag(pointer, true); });
    });
    const dismiss = (pointer, over) => {
      if (!dragging && !(over || []).some(obj => clickable.has(obj))) {
        pinned = null; hovered = null; refresh();
      }
    };
    const cancel = () => { if (dragging) finishDrag(null, false); else { pinned = null; hovered = null; refresh(); } };
    scene.input.on('pointerdown', dismiss);
    scene.input.on('gameout', cancel);
    scene.events.on('pause', cancel);
    // fitCamera가 텍스트 해상도를 동기화한 다음 바운딩 크기로 다시 정렬한다.
    const resizePreview = () => {
      renderStats();
      tooltipKey = null;
      refreshTooltip();
    };
    scene.scale.on('resize', resizePreview);
    scene.events.once('shutdown', () => {
      scene.input.off('pointerdown', dismiss);
      scene.input.off('gameout', cancel);
      scene.events.off('pause', cancel);
      scene.scale.off('resize', resizePreview);
    });
    refresh();
  }

  // 정원 UI 검토 전용: 중앙 2×2에서 시작하고 테스트 꽃 이미지만 배치한다.
  // 실제 꽃 종류/도안/획득/완성도/전투 로직은 연결하지 않는다. 순찰은 화면 테스트 애니메이션만 제공한다.
  function gardenCandidates(occupied) {
    const { columns, rows } = spec.garden;
    const result = new Set();
    for (const key of occupied) {
      const x = key % columns, y = Math.floor(key / columns);
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nx = x + dx, ny = y + dy, next = ny * columns + nx;
        if (nx >= 0 && nx < columns && ny >= 0 && ny < rows && !occupied.has(next)) result.add(next);
      }
    }
    return result;
  }

  // 점유 영역을 감싸는 사각형에서 양쪽으로 2칸(후보 1칸 + 수호자 1칸)을 띄운 중심 경로.
  // 10×10의 끝에서도 가상 여유 칸을 유지하며, 실제 배치 가능 여부와는 별개다.
  function patrolBounds(occupied) {
    const g = spec.garden;
    const keys = [...occupied];
    const xs = keys.map(k => k % g.columns), ys = keys.map(k => Math.floor(k / g.columns));
    return {
      left: g.x + (Math.min(...xs) - 2) * g.pitch + g.line + g.cell / 2,
      right: g.x + (Math.max(...xs) + 2) * g.pitch + g.line + g.cell / 2,
      top: g.y + (Math.min(...ys) - 2) * g.pitch + g.line + g.cell / 2,
      bottom: g.y + (Math.max(...ys) + 2) * g.pitch + g.line + g.cell / 2
    };
  }
  function patrolPosition(b, distance) {
    const w = b.right - b.left, h = b.bottom - b.top;
    const perimeter = 2 * (w + h);
    let d = ((distance % perimeter) + perimeter) % perimeter;
    if (d <= w) return { x: b.left + d, y: b.top };
    d -= w;
    if (d <= h) return { x: b.right, y: b.top + d };
    d -= h;
    if (d <= w) return { x: b.right - d, y: b.bottom };
    return { x: b.left, y: b.bottom - (d - w) };
  }
  function nearestPatrolDistance(b, x, y) {
    const w = b.right - b.left, h = b.bottom - b.top;
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    const cx = clamp(x, b.left, b.right), cy = clamp(y, b.top, b.bottom);
    const distances = [cx - b.left, w + cy - b.top,
      w + h + b.right - cx, 2 * w + h + b.bottom - cy];
    return distances.reduce((best, d) => {
      const p = patrolPosition(b, d), q = patrolPosition(b, best);
      return Math.hypot(p.x - x, p.y - y) < Math.hypot(q.x - x, q.y - y) ? d : best;
    });
  }

  function drawGardenPreview(scene, flowers) {
    const garden = spec.garden;
    const occupied = new Set([44, 45, 54, 55]);
    let bounds = patrolBounds(occupied);
    let distance = (bounds.right - bounds.left) / 2, joining = false;
    const start = patrolPosition(bounds, distance);
    const guardian = scene.add.rectangle(start.x, start.y, assets.guardian.size, assets.guardian.size, assets.guardian.color)
      .setDepth(2).setName('placeholder:guardian:0');
    // 화면 검토용 속도(논리 72px/s, 기존 화면상 속도 유지). 전투/능력치와 연동하지 않는다.
    function updatePatrol(_time, delta) {
      let step = Math.max(0, Math.min(delta, 100)) * 0.072;
      if (joining) {
        const p = patrolPosition(bounds, distance);
        const dx = p.x - guardian.x, dy = p.y - guardian.y, gap = Math.hypot(dx, dy);
        if (gap > step) {
          guardian.setPosition(guardian.x + dx * step / gap, guardian.y + dy * step / gap);
          return;
        }
        step -= gap;
        joining = false;
      }
      distance += step;
      const p = patrolPosition(bounds, distance);
      guardian.setPosition(p.x, p.y);
    }
    function updatePatrolBounds() {
      const next = patrolBounds(occupied);
      if (Object.keys(next).every(k => next[k] === bounds[k])) return;
      bounds = next;
      distance = nearestPatrolDistance(bounds, guardian.x, guardian.y);
      joining = true;
    }
    scene.events.on('update', updatePatrol);
    // 10×10 노드 면과 외부 1px 테두리를 단일 텍스처로 합성한다.
    // 점유 및 후보만 표시하고 나머지 격자는 투명하게 유지한다.
    const soilKey = 'ui-test:garden-soil:' + garden.cell;
    const soilWidth = garden.columns * garden.pitch, soilHeight = garden.rows * garden.pitch;
    const soilTexture = scene.textures.exists(soilKey) ? scene.textures.get(soilKey) :
      scene.textures.createCanvas(soilKey, soilWidth, soilHeight);
    soilTexture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    const soil = scene.add.image(garden.x + soilWidth / 2, garden.y + soilHeight / 2, soilKey)
      .setDepth(-1).setName('garden-preview-soil');
    function refreshSoil() {
      const ctx = soilTexture.getContext();
      ctx.clearRect(0, 0, soilWidth, soilHeight);
      // 참조 트리 노드: 1px 초록 외곽선과 22px 어두운 면.
      for (const key of new Set([...occupied, ...gardenCandidates(occupied)])) {
        const x = (key % garden.columns) * garden.pitch, y = Math.floor(key / garden.columns) * garden.pitch;
        const l = garden.line, s = garden.pitch;
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#' + colors.gardenBorder.toString(16).padStart(6, '0');
        ctx.fillRect(x, y, s, l);
        ctx.fillRect(x, y + s - l, s, l);
        ctx.fillRect(x, y + l, l, garden.cell);
        ctx.fillRect(x + s - l, y + l, l, garden.cell);
        ctx.globalAlpha = colors.gardenSoilAlpha;
        ctx.fillStyle = '#' + colors.gardenSoil.toString(16).padStart(6, '0');
        ctx.fillRect(x + l, y + l, garden.cell, garden.cell);
      }
      ctx.globalAlpha = 1;
      soilTexture.refresh();
      soilTexture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    // 패딩 확대 전 방식: 커서를 따라가는 드래그 카드(30)와 칸 중심 미리보기(15)를 분리한다.
    const accents = scene.add.graphics().setDepth(31).setName('garden-preview-highlight');
    const ghost = testSprites.sprite(scene, 0, 0, testSprites.flowers[0], assets.flower.size)
      .setDepth(15).setAlpha(0.45).setVisible(false).setName('garden-preview-ghost');
    let dragging = null, target = -1;
    function origin(key) {
      return { x: garden.x + (key % garden.columns) * garden.pitch,
        y: garden.y + Math.floor(key / garden.columns) * garden.pitch };
    }
    function plant(key, spriteName) {
      const p = origin(key);
      testSprites.sprite(scene, p.x + garden.line + garden.cell / 2, p.y + garden.line + garden.cell / 2, spriteName, assets.flower.size)
        .setDepth(1).setName('garden-preview-flower:' + key);
    }
    [...occupied].forEach((key, i) => plant(key, testSprites.flowers[i]));
    function refresh() {
      accents.clear();
      const candidates = gardenCandidates(occupied);
      if (dragging) for (const key of candidates) {
        const p = origin(key);
        // 선택 사각형은 기존 외부 1px 프레임 위에 일치한다.
        if (key === target) dropSquare(accents, p.x, p.y, garden.pitch);
        else dropPlus(accents, p.x + garden.line, p.y + garden.line, garden.cell);
      }
      ghost.setVisible(false);
      if (dragging && candidates.has(target)) {
        const p = origin(target);
        ghost.setTexture(testSprites.textureKey(dragging.spriteName, assets.flower.size)).setDisplaySize(assets.flower.size, assets.flower.size)
          .setPosition(p.x + garden.line + garden.cell / 2, p.y + garden.line + garden.cell / 2).setVisible(true);
      }
    }
    function hit(pointer) {
      const p = scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const x = Math.floor((p.x - garden.x) / garden.pitch), y = Math.floor((p.y - garden.y) / garden.pitch);
      return x >= 0 && x < garden.columns && y >= 0 && y < garden.rows ? y * garden.columns + x : -1;
    }
    function move(pointer) {
      if (!dragging) return;
      target = hit(pointer);
      const p = scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const valid = gardenCandidates(occupied).has(target);
      // 카드 위치는 유효 여부와 무관하게 커서를 추적한다.
      // 유효 칸에서는 카드 알파 0.25, 중심에 별도 알파 0.45 미리보기만 스냅.
      refresh();
      dragging.marker.setPosition(p.x, p.y).setAlpha(valid ? 0.25 : 1);
    }
    function finish(pointer, accept) {
      if (!dragging) return;
      const flower = dragging, key = accept && pointer ? hit(pointer) : -1;
      dragging = null; target = -1;
      flower.marker.setDepth(0).setPosition(flower.x, flower.y).setAlpha(1).setStrokeStyle(0, colors.focusBorder, 0);
      if (gardenCandidates(occupied).has(key)) {
        occupied.add(key); plant(key, flower.spriteName);
        refreshSoil();
        updatePatrolBounds();
        flower.consumed = true;
        flower.marker.disableInteractive().setVisible(false);
      }
      refresh();
    }
    flowers.forEach(flower => {
      const marker = flower.marker;
      marker.setInteractive({ useHandCursor: true, draggable: true });
      scene.input.setDraggable(marker);
      marker.on('pointerover', () => { if (!dragging) marker.setStrokeStyle(1, colors.focusBorder, 1); });
      marker.on('pointerout', () => { if (!dragging) marker.setStrokeStyle(0, colors.focusBorder, 0); });
      marker.on('dragstart', pointer => {
        if (flower.consumed || dragging) return;
        dragging = flower; marker.setDepth(30).setStrokeStyle(1, colors.focusBorder, 1); move(pointer);
      });
      marker.on('drag', pointer => { if (dragging === flower) move(pointer); });
      marker.on('dragend', pointer => { if (dragging === flower) finish(pointer, true); });
    });
    const cancel = () => finish(null, false);
    scene.input.on('gameout', cancel);
    scene.events.on('pause', cancel);
    scene.events.once('shutdown', () => {
      scene.input.off('gameout', cancel);
      scene.events.off('pause', cancel);
      scene.events.off('update', updatePatrol);
    });
    refreshSoil();
    refresh();
  }

  function draw(scene) {
    testSprites.install(scene);
    window.GardenUI.fitCamera(scene, spec.width, spec.height);
    scene.cameras.main.setBackgroundColor(P.background.hex);
    const g = scene.add.graphics().setDepth(-2).setName('battlefield');
    g.fillStyle(colors.field, 1).fillRect(0, spec.top, spec.width, spec.fieldHeight);
    const { cards, flowers } = drawMarkers(scene);
    drawHud(scene);
    const layout = drawSlots(scene);
    drawBlueprint(scene);
    drawItemPreview(scene, layout, cards);
    drawGardenPreview(scene, flowers);
    text(scene, spec.width - 10, spec.top + spacing.base, '테스트 이미지', bottomStats.fontSize, colors.label, 'right').setDepth(16);
  }

  window.GardenGameLayout = Object.freeze({ spec, assets, colors, spacing, hud, slotCost, formatHudTime, formatHudCount, hudColumns, bottomStats, itemTooltip, replacementTitle, bottomLayout, sumPreviewStats, getPreviewStats, tooltipPosition, gardenCandidates, patrolBounds, patrolPosition, nearestPatrolDistance, draw });
}());
