(function () {
  'use strict';

  // 화면 및 아이템 UI 검토 전용. 임시 장착 상태는 씬 안에서만 사용한다.
  // 실제 전투, 획득, 재화 소비, 슬롯 확장 및 저장 로직은 없다.
  // Carbon의 2/4/8/12/16 간격 체계 참고. 논리 좌표 기준.
  const P = window.GardenPalette;
  const spacing = Object.freeze({ micro: 2, small: 4, base: 8, section: 12, large: 16 });
  const blueprintGrid = 10 * 8;
  const blueprintPadding = spacing.small;
  const blueprintHeader = spacing.large;
  const topHudHeight = 24;
  const bottomHudHeight = 36;
  const fieldHeight = 360 - topHudHeight - bottomHudHeight;
  const blueprintY = topHudHeight + spacing.base;
  const spec = Object.freeze({
    width: 640, height: 360,
    top: topHudHeight, fieldHeight, bottom: bottomHudHeight,
    garden: Object.freeze({ x: 240, y: topHudHeight + (fieldHeight - 160) / 2, columns: 10, rows: 10, cell: 16 }),
    blueprint: Object.freeze({
      x: 8, y: blueprintY, padding: blueprintPadding, header: blueprintHeader, cell: 8,
      width: blueprintGrid + 2 * blueprintPadding,
      height: blueprintHeader + blueprintGrid + 2 * blueprintPadding,
      gridX: 8 + blueprintPadding, gridY: blueprintY + blueprintHeader + blueprintPadding
    }),
    slots: Object.freeze({ size: 24, gap: 4, initial: 4, preview: 9, max: 10, y: 330, exampleCost: 999 })
  });

  const hud = Object.freeze({
    padding: spacing.base, gap: spacing.small, labelSize: window.GardenUI.fontSize.base, valueSize: window.GardenUI.fontSize.base,
    centerY: spec.top / 2, iconSize: 12, barHeight: 12,
    columnUnit: spacing.base, minMetricWidth: 144, hourDigits: 4, counterDigits: 12, minBarWidth: 64,
    // 표시 폭 예약 기준이며 게임 데이터의 최대값이 아니다.
    previewProgress: 30,
  });
  // Preserve the approved 24px horizontal three-digit cost layout; cost and compact HUD are native-size exceptions.
  const slotCost = Object.freeze({ padding: spacing.micro, gap: spacing.micro, iconSize: 6, fontSize: 7, minFontSize: 6, maxDigits: 3 });

  // size = 원본 PNG 및 1배 표시 크기. 파일을 생성하거나 로드하지 않는다.
  // assetKey와 suggestedFile은 이후 에셋 작업 시 참조할 식별자이다.
  const assets = Object.freeze({
    gardenTile: Object.freeze({ size: 16, assetKey: 'garden-tile', suggestedFile: 'assets/garden-tile.png' }),
    guardian: Object.freeze({ size: 16, color: P.n.teal, assetKey: 'guardian', suggestedFile: 'assets/guardian.png' }),
    enemy: Object.freeze({ size: 12, color: P.n.red, assetKey: 'enemy', suggestedFile: 'assets/enemy.png' }),
    gem: Object.freeze({ size: 8, color: P.n.sky, assetKey: 'gem', suggestedFile: 'assets/gem.png' }),
    heal: Object.freeze({ size: 10, color: P.n.pink, assetKey: 'heal', suggestedFile: 'assets/heal.png' }),
    item: Object.freeze({ size: 16, color: P.n.gold, assetKey: 'item', suggestedFile: 'assets/item.png' })
  });

  const colors = Object.freeze({
    field: P.n.ink, hud: P.n.ink, hudBorder: P.n.grid, hudDivider: P.n.edge,
    label: P.hex.label, value: P.hex.paper,
    gridFill: P.n.soil, gridLine: P.n.grid, gridBorder: P.n.edge,
    normalFill: P.n.ink, normalBorder: P.n.slot,
    progressTrack: P.n.shadow, progressBorder: P.n.slot, progressFill: P.n.growth,
    disabledFill: P.n.ink, disabledBorder: P.n.edge, disabledText: P.hex.disabled,
    enabledFill: P.n.ink, enabledBorder: P.n.growth, enabledText: P.hex.growth,
    blueprintLine: P.n.grid, reservedIcon: P.n.steel
  });

  // 고정된 미리보기 좌표일 뿐 실제 스폰 위치나 수량 정책이 아니다.
  const samples = Object.freeze({
    guardian: Object.freeze([[320, 82]]),
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
    heal: Object.freeze([[177,252],[492,91],[399,269]]),
    item: Object.freeze([[137,101],[225,141],[303,291],[465,245],[572,89]])
  });

  function frame(g, x, y, w, h, fill, border) {
    g.fillStyle(border, 1).fillRect(x, y, w, h);
    g.fillStyle(fill, 1).fillRect(x + 1, y + 1, w - 2, h - 2);
  }

  // 1px 경계선만 사용하는 HUD와 슬롯의 1px 모서리 표시.
  function hudBoundary(g, y) {
    g.fillStyle(colors.hudBorder, 1).fillRect(spacing.base, y, spec.width - 2 * spacing.base, 1);
  }

  function slotCorners(g, x, y, size, color) {
    const length = spacing.base;
    g.fillStyle(color, 1);
    for (const cx of [x, x + size - length]) {
      for (const cy of [y, y + size - 1]) g.fillRect(cx, cy, length, 1);
    }
    for (const cx of [x, x + size - 1]) {
      for (const cy of [y, y + size - length]) g.fillRect(cx, cy, 1, length);
    }
  }

  function grid(g, x, y, cell, fill, line) {
    const size = cell * spec.garden.columns;
    frame(g, x, y, size, size, fill, colors.gridBorder);
    g.fillStyle(line, 1);
    for (let i = 1; i < spec.garden.columns; i++) {
      g.fillRect(x + i * cell, y + 1, 1, size - 2);
      g.fillRect(x + 1, y + i * cell, size - 2, 1);
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

  function hudColumns(measure, timeValue, killsValue, gemsValue) {
    // 숫자마다 폭이 다를 수 있으므로 0~9 중 가장 넓은 글자를 예약한다.
    const digit = Math.max(...Array.from({ length: 10 }, (_, i) => measure(String(i))));
    const colon = measure(':');
    const comma = measure(',');
    const timeReserve = Math.max((hud.hourDigits + 4) * digit + 2 * colon, measure(timeValue));
    const counterReserve = Math.max(hud.counterDigits * digit + Math.floor((hud.counterDigits - 1) / 3) * comma,
      measure(killsValue), measure(gemsValue));
    const quantize = width => Math.ceil(width / hud.columnUnit) * hud.columnUnit;
    const paddedWidth = (label, value) => quantize(2 * hud.padding + label + hud.gap + value);
    // 세 열 모두 가장 넓은 항목의 예약 폭을 공유한다.
    // 144px은 합의된 최소 폭이며 실측 결과가 더 넓으면 8px 단위로 늘린다.
    const metricWidth = Math.max(hud.minMetricWidth, paddedWidth(measure('시간'), timeReserve),
      paddedWidth(measure('처치 수'), counterReserve), paddedWidth(hud.iconSize, counterReserve));
    const progressWidth = spec.width - 3 * metricWidth;
    const barWidth = progressWidth - 2 * hud.padding - measure('정원 완성도') - hud.gap;
    if (barWidth < hud.minBarWidth) {
      throw new RangeError('HUD values exceed the available display width');
    }
    return {
      time: { x: 0, width: metricWidth },
      kills: { x: metricWidth, width: metricWidth },
      gems: { x: 2 * metricWidth, width: metricWidth },
      progress: { x: 3 * metricWidth, width: progressWidth, barWidth }
    };
  }

  function drawHud(scene) {
    const g = scene.add.graphics().setName('top-hud');
    hudBoundary(g, spec.top - 1);

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
    const columns = hudColumns(measure, time, count, count);
    const labelWidth = measure('정원 완성도');
    probe.destroy();

    // 24px HUD 안에서 상하 4px 여백을 두는 1×16px 구분선.
    g.fillStyle(colors.hudDivider, 1);
    [columns.kills.x, columns.gems.x, columns.progress.x].forEach(x => g.fillRect(x, spacing.small, 1, spec.top - 2 * spacing.small));

    // 레이블과 수치는 같은 그룹의 왼쪽에서 4px 간격으로 이어서 표시한다.
    function metric(column, label, value) {
      const caption = text(scene, column.x + hud.padding, hud.centerY, label, hud.labelSize, colors.label, 'left');
      text(scene, caption.x + Math.ceil(caption.width) + hud.gap, hud.centerY, value, hud.valueSize, colors.value, 'left');
    }
    metric(columns.time, '시간', time);
    metric(columns.kills, '처치 수', count);

    const gem = columns.gems;
    reserveIcon(g, gem.x + hud.padding, hud.centerY - hud.iconSize / 2, hud.iconSize, colors.reservedIcon);
    text(scene, gem.x + hud.padding + hud.iconSize + hud.gap, hud.centerY, count, hud.valueSize, colors.value, 'left');

    const c = columns.progress;
    text(scene, c.x + hud.padding, hud.centerY, '정원 완성도', hud.labelSize, colors.label, 'left');
    const barX = c.x + hud.padding + labelWidth + hud.gap;
    const barY = hud.centerY - hud.barHeight / 2;
    frame(g, barX, barY, c.barWidth, hud.barHeight, colors.progressTrack, colors.progressBorder);
    const progress = Math.max(0, Math.min(100, hud.previewProgress));
    const fillWidth = Math.round((c.barWidth - 2) * progress / 100);
    if (fillWidth > 0) {
      g.fillStyle(colors.progressFill, 1).fillRect(barX + 1, barY + 1, fillWidth, hud.barHeight - 2);
    }
    const percent = text(scene, barX + c.barWidth / 2, hud.centerY, progress + '%', hud.valueSize, colors.value, 'center');
    // 밝은 채움 위에도 퍼센트가 읽히도록 한다. 채움이 글자 일부에 걸치면
    // 팔레트의 어두운 트랙 색을 글자 배경으로 사용한다.
    const fillEnd = barX + 1 + fillWidth;
    const textLeft = percent.x - percent.width / 2;
    const textRight = percent.x + percent.width / 2;
    if (fillEnd >= textRight) percent.setColor(P.hex.shadow);
    else if (fillEnd > textLeft) percent.setBackgroundColor(P.hex.shadow);

  }

  function drawSlotCost(scene, g, x, y, size, value) {
    const c = slotCost;
    const centerY = y + size / 2;
    const maxTextWidth = size - 2 * c.padding - c.iconSize - c.gap;
    // 최대 자릿수의 가장 넓은 숫자를 기준으로 공통 폰트 크기를 정한다.
    // 현재 값이 1~3자리 중 무엇이든 같은 크기를 사용한다.
    const cost = text(scene, 0, centerY, '', c.fontSize, colors.disabledText);
    let fontSize = c.fontSize;
    while (true) {
      let widest = 0;
      for (let digit = 0; digit <= 9; digit++) {
        cost.setText(String(digit).repeat(c.maxDigits));
        widest = Math.max(widest, Math.ceil(cost.width));
      }
      if (widest <= maxTextWidth || fontSize <= c.minFontSize) break;
      cost.setFontSize(--fontSize);
    }
    cost.setText(String(value));
    const textWidth = Math.ceil(cost.width);
    const groupWidth = c.iconSize + c.gap + textWidth;
    const groupX = Math.round(x + (size - groupWidth) / 2);
    reserveIcon(g, groupX, centerY - c.iconSize / 2, c.iconSize, P.n.disabled);
    cost.setX(groupX + c.iconSize + c.gap);
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

  const bottomStats = Object.freeze({ fontSize: 7, columnWidth: 42, columns: 3, lineGap: 3, deltaGap: spacing.micro });

  function bottomLayout() {
    const s = spec.slots;
    const totalWidth = s.max * s.size + (s.max - 1) * s.gap;
    const slotLeft = (spec.width - totalWidth) / 2;
    const sideWidth = bottomStats.columnWidth * bottomStats.columns;
    const top = spec.top + spec.fieldHeight;
    return {
      top, centerY: top + spec.bottom / 2, slotLeft, totalWidth, sideWidth,
      left: spacing.base, right: spec.width - spacing.base - sideWidth,
      slots: Array.from({ length: s.max }, (_, index) => ({
        x: slotLeft + index * (s.size + s.gap), y: s.y, size: s.size
      }))
    };
  }

  function drawSlots(scene) {
    const s = spec.slots;
    const g = scene.add.graphics().setName('item-slots');
    hudBoundary(g, spec.top + spec.fieldHeight);
    const layout = bottomLayout();
    layout.slots.forEach((slot, i) => {
      slotCorners(g, slot.x, slot.y, slot.size, i === s.preview ? colors.disabledBorder : colors.normalBorder);
      if (i === s.preview) drawSlotCost(scene, g, slot.x, slot.y, slot.size, s.exampleCost);
    });
    // 기존 확장 슬롯은 표시만 하며 드롭/클릭 대상으로 등록하지 않는다.
    return layout;
  }

  function drawMarkers(scene) {
    const cards = [];
    Object.entries(samples).forEach(([type, positions]) => {
      const asset = assets[type];
      positions.forEach(([x, y], i) => {
        // 도형의 바운딩 박스가 정확히 PNG 목표 크기와 같다.
        // 추후 동일한 x, y, origin(0.5)에서 해당 크기의 이미지로 교체한다.
        const marker = scene.add.rectangle(x, y, asset.size, asset.size, asset.color)
          .setName('placeholder:' + asset.assetKey + ':' + i);
        if (type === 'item') cards.push({ item: previewItems[i], marker, x, y });
      });
    });
    return cards;
  }

  function drawBlueprint(scene) {
    const b = spec.blueprint;
    // 패널 접기는 화면 UI 상태만 변경한다.
    const body = scene.add.graphics().setDepth(10).setName('blueprint-body');
    grid(body, b.gridX, b.gridY, b.cell, colors.gridFill, colors.blueprintLine);

    const header = scene.add.graphics().setDepth(11).setName('blueprint-header');
    header.fillStyle(colors.field, 1).fillRect(b.x, b.y, b.width, b.header);
    text(scene, b.x + b.padding, b.y + b.header / 2, '도안', window.GardenUI.fontSize.base, colors.label, 'left').setDepth(12);
    const arrow = scene.add.graphics().setDepth(12).setName('blueprint-chevron');
    let expanded = true;
    function drawArrow() {
      arrow.clear().lineStyle(1, P.n.label, 1);
      const x = b.x + b.width - b.padding - 4;
      const y = b.y + b.header / 2;
      arrow.beginPath();
      arrow.moveTo(x - 4, y + (expanded ? 2 : -2));
      arrow.lineTo(x, y + (expanded ? -2 : 2));
      arrow.lineTo(x + 4, y + (expanded ? 2 : -2));
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
    const margin = spacing.base;
    const gap = spacing.base;
    const half = anchor.size / 2;
    // 슬롯/하단 카드에서는 위쪽, 전장에서는 좌우를 우선한다.
    const right = anchor.x + half + gap;
    const left = anchor.x - half - gap - width;
    const above = anchor.y - half - gap - height;
    const below = anchor.y + half + gap;
    const centeredX = anchor.x - width / 2;
    const candidates = anchor.y >= fieldBottom - 8
      ? [[centeredX, above], [right, above], [left, above]]
      : [[right, anchor.y - half], [left, anchor.y - half], [centeredX, above], [centeredX, below]];
    const top = spec.top + margin;
    const bottom = fieldBottom - spacing.small;
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, Math.max(lo, hi)));
    const xFits = x => x >= margin && x + width <= spec.width - margin;
    const yFits = y => y >= top && y + height <= bottom;
    const best = candidates.find(([x, y]) => xFits(x) && yFits(y)) ||
      candidates.find(([x]) => xFits(x)) || candidates[0];
    return { x: Math.round(clamp(best[0], margin, spec.width - margin - width)),
      y: Math.round(clamp(best[1], top, bottom - height)) };
  }

  // 기존 카드 선택의 밝은 테두리를 정보창에도 적용한다.
  const itemTooltip = Object.freeze({
    width: 120, padding: spacing.base, fontSize: bottomStats.fontSize,
    rowGap: spacing.small, lineSpacing: 2, strokeWidth: 1, accent: P.n.paper,
    background: P.n.soil, divider: P.n.edge,
    title: colors.value, description: colors.label, hint: colors.disabledText
  });

  function drawItemPreview(scene, layout, cards) {
    const U = window.GardenUI;
    const s = spec.slots;
    const equipped = Array(s.preview).fill(null);
    let hovered = null, pinned = null, dragging = null, target = -1;
    const clickable = new Set();
    const accents = scene.add.graphics().setDepth(22).setName('preview-slot-highlight');
    const slotItems = [];
    const slots = layout.slots.slice(0, s.preview);

    // 양쪽 바깥 8px부터 동일한 42px 열 3개. 각 텍스트 묶음의 실제 크기로 중앙 정렬.
    const stats = statKeys.map((key, index) => {
      const left = index < bottomStats.columns ? layout.left : layout.right;
      const x = left + bottomStats.columnWidth * ((index % bottomStats.columns) + 0.5);
      const size = bottomStats.fontSize;
      return {
        key, x,
        label: text(scene, x, layout.centerY, statLabels[key], size, colors.label, 'center').setName('stat-label:' + key),
        value: text(scene, x, layout.centerY, '', size, colors.value, 'center').setName('stat-value:' + key),
        delta: text(scene, x, layout.centerY, '', size, colors.value, 'center').setName('stat-delta:' + key)
      };
    });
    const tooltip = scene.add.container(0, 0).setDepth(40).setName('item-preview-tooltip').setVisible(false);
    let tooltipKey = null, tooltipSize = { width: itemTooltip.width, height: 0 };

    function signed(n) { return (n > 0 ? '+' : '') + String(n); }
    function renderStats() {
      const current = sumPreviewStats(equipped);
      const next = dragging && target >= 0 ? getPreviewStats(equipped, target, dragging.item) : current;
      stats.forEach(row => {
        const d = next[row.key] - current[row.key];
        row.value.setText(String(next[row.key]));
        row.delta.setText(d ? signed(d) : '').setColor(d > 0 ? P.hex.growth : d < 0 ? P.hex.red : colors.value)
          .setVisible(d !== 0);
        // 라벨과 값 행의 실제 바운딩 크기를 기준으로 3px 행 간격,
        // 증감이 있을 때는 값과 증감 사이 2px를 두고 전체 행을 중앙 정렬한다.
        const valueWidth = row.value.width;
        const deltaWidth = d ? row.delta.width : 0;
        const gap = d ? bottomStats.deltaGap : 0;
        const rowWidth = valueWidth + gap + deltaWidth;
        const rowHeight = Math.max(row.value.height, d ? row.delta.height : 0);
        const groupHeight = row.label.height + bottomStats.lineGap + rowHeight;
        const top = layout.centerY - groupHeight / 2;
        const valueY = top + row.label.height + bottomStats.lineGap + rowHeight / 2;
        const left = row.x - rowWidth / 2;
        row.label.setPosition(row.x, top + row.label.height / 2);
        row.value.setPosition(left + valueWidth / 2, valueY);
        row.delta.setPosition(left + valueWidth + gap + deltaWidth / 2, valueY);
      });
    }
    function slotAnchor(index) {
      const slot = slots[index];
      return { x: slot.x + slot.size / 2, y: slot.y + slot.size / 2, size: slot.size };
    }
    function effectRows(item, removed) {
      return statKeys.filter(key => item.stats[key]).map(key => ({
        value: statLabels[key] + ' ' + signed((removed ? -1 : 1) * item.stats[key]),
        color: removed ? P.hex.red : P.hex.growth
      }));
    }
    function rebuildTooltip(key, rows) {
      if (tooltipKey === key) return;
      tooltipKey = key;
      tooltip.removeAll(true);
      const t = itemTooltip;
      const w = t.width, pad = t.padding;
      const labels = [];
      let y = pad, dividerY = 0;
      rows.forEach((row, index) => {
        if (index === 1) {
          dividerY = y;
          y += t.rowGap;
        }
        const label = U.text(scene, pad, y, row.value, t.fontSize, row.color, {
          wrap: w - 2 * pad, lineSpacing: t.lineSpacing
        });
        labels.push(label);
        y += Math.max(t.fontSize, Math.ceil(label.height)) + t.rowGap;
      });
      tooltipSize = { width: w, height: y + pad - t.rowGap };
      // 카드와 동일한 Rectangle + setStrokeStyle을 사용한다.
      // 기존 채운 사각형 테두리와 달리 선이 경계 중심에 그려진다.
      const background = scene.add.rectangle(w / 2, tooltipSize.height / 2,
        w, tooltipSize.height, t.background)
        .setName('item-tooltip-background')
        .setStrokeStyle(t.strokeWidth, t.accent, 1);
      tooltip.add(background);
      if (dividerY) {
        const divider = scene.add.graphics().setName('item-tooltip-divider');
        divider.fillStyle(t.divider, 1).fillRect(pad, dividerY, w - 2 * pad, 1);
        tooltip.add(divider);
      }
      labels.forEach(label => tooltip.add(label));
    }
    function refreshTooltip() {
      let focus = hovered || pinned;
      if (dragging) focus = { card: dragging };
      if (!focus) { tooltip.setVisible(false); return; }
      const card = focus.card;
      const index = dragging && target >= 0 ? target : focus.slot;
      const item = card ? card.item : equipped[index];
      if (!item || (card && card.consumed)) { tooltip.setVisible(false); return; }
      const previous = dragging && target >= 0 ? equipped[target] : null;
      const anchor = Number.isInteger(index) && index >= 0 ? slotAnchor(index) :
        { x: card.marker.x, y: card.marker.y, size: assets.item.size };
      let rows;
      if (previous) {
        rows = [{ value: previous.name + ' → ' + item.name, color: itemTooltip.title },
          { value: item.desc, color: itemTooltip.description }, ...effectRows(item, false),
          ...effectRows(previous, true), { value: '놓으면 기존 아이템 교체', color: itemTooltip.hint }];
      } else {
        rows = [{ value: item.name, color: itemTooltip.title },
          { value: item.desc, color: itemTooltip.description }, ...effectRows(item, false)];
        if (dragging && target >= 0) rows.push({ value: '놓으면 장착', color: itemTooltip.hint });
        else if (!card) rows.push({ value: '장착 중', color: itemTooltip.hint });
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
        card.marker.setStrokeStyle(active ? itemTooltip.strokeWidth : 0, itemTooltip.accent, active ? 1 : 0);
      });
      slots.forEach((slot, index) => {
        const active = dragging ? target === index : focus && focus.slot === index && equipped[index];
        if (active) slotCorners(accents, slot.x, slot.y, slot.size, dragging ? P.n.growth : P.n.gold);
        slotItems[index].setVisible(!!equipped[index]).setAlpha(dragging && target === index ? 0.45 : 1);
      });
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
      dragging.marker.setPosition(Math.max(8, Math.min(spec.width - 8, p.x)),
        Math.max(spec.top + 8, Math.min(spec.height - 8, p.y)));
      refresh();
    }
    function finishDrag(pointer, accept) {
      if (!dragging) return;
      const card = dragging;
      const index = accept && pointer ? hitSlot(point(pointer)) : -1;
      dragging = null; target = -1; hovered = null; pinned = null;
      card.marker.setDepth(0).setPosition(card.x, card.y);
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
      slotItems.push(scene.add.rectangle(center.x, center.y, assets.item.size, assets.item.size, P.n.gold)
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

  function draw(scene) {
    window.GardenUI.fitCamera(scene, spec.width, spec.height);
    scene.cameras.main.setBackgroundColor(P.hex.ink);
    const g = scene.add.graphics().setName('battlefield');
    g.fillStyle(colors.field, 1).fillRect(0, spec.top, spec.width, spec.fieldHeight);
    grid(g, spec.garden.x, spec.garden.y, spec.garden.cell, colors.gridFill, colors.gridLine);
    const cards = drawMarkers(scene);
    drawHud(scene);
    const layout = drawSlots(scene);
    drawBlueprint(scene);
    drawItemPreview(scene, layout, cards);
  }

  window.GardenGameLayout = Object.freeze({ spec, assets, colors, spacing, hud, slotCost, formatHudTime, formatHudCount, hudColumns, bottomStats, itemTooltip, bottomLayout, sumPreviewStats, getPreviewStats, tooltipPosition, draw });
}());
