(function () {
  'use strict';

  // UI/정적 크기 비교 시안 전용. 물리, 이동, 스폰, 공격, 획득, 장착 및
  // 슬롯 확장 로직은 없다. 모든 좌표는 640×360 논리 픽셀이다.
  // Carbon의 2/4/8/12/16 간격 체계 참고. 논리 좌표 기준.
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
    slots: Object.freeze({ size: 24, gap: 4, initial: 4, max: 10, y: 330, exampleCost: 999 })
  });

  const hud = Object.freeze({
    padding: spacing.base, gap: spacing.small, labelSize: window.GardenUI.fontSize.base, valueSize: window.GardenUI.fontSize.base,
    centerY: spec.top / 2, iconSize: 12, barHeight: 12,
    columnUnit: spacing.base, hourDigits: 4, counterDigits: 12, minBarWidth: 64,
    // 표시 폭 예약 기준이며 게임 데이터의 최대값이 아니다.
    previewProgress: 30,
  });
  // Preserve the approved 24px horizontal three-digit cost layout; micro text is the only native-size exception.
  const slotCost = Object.freeze({ padding: spacing.micro, gap: spacing.micro, iconSize: 6, fontSize: 7, minFontSize: 6, maxDigits: 3 });

  // size = 원본 PNG 및 1배 표시 크기. 파일을 생성하거나 로드하지 않는다.
  // assetKey와 suggestedFile은 이후 에셋 작업 시 참조할 식별자이다.
  const assets = Object.freeze({
    gardenTile: Object.freeze({ size: 16, assetKey: 'garden-tile', suggestedFile: 'assets/garden-tile.png' }),
    guardian: Object.freeze({ size: 16, color: 0x79d3c2, assetKey: 'guardian', suggestedFile: 'assets/guardian.png' }),
    enemy: Object.freeze({ size: 12, color: 0xc27b72, assetKey: 'enemy', suggestedFile: 'assets/enemy.png' }),
    gem: Object.freeze({ size: 8, color: 0x78b4e0, assetKey: 'gem', suggestedFile: 'assets/gem.png' }),
    heal: Object.freeze({ size: 10, color: 0xe999a6, assetKey: 'heal', suggestedFile: 'assets/heal.png' }),
    item: Object.freeze({ size: 16, color: 0xdfc47f, assetKey: 'item', suggestedFile: 'assets/item.png' })
  });

  const colors = Object.freeze({
    field: 0x17251e, hud: 0x212a32, hudBorder: 0x48535e,
    label: '#b7c2cc', value: '#edf2f5',
    gridFill: 0x203329, gridLine: 0x506a58,
    normalFill: 0x101719, normalBorder: 0x687b6d,
    progressFill: 0x84d0aa,
    disabledFill: 0x191f22, disabledBorder: 0x39453f, disabledText: '#87958d',
    enabledFill: 0x26382d, enabledBorder: 0x9ab59e, enabledText: '#b7d0ba',
    blueprintLine: 0x465d4e, reservedIcon: 0x697480
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

  function grid(g, x, y, cell, fill, line) {
    const size = cell * spec.garden.columns;
    frame(g, x, y, size, size, fill, colors.normalBorder);
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
    const timeWidth = paddedWidth(measure('시간'), timeReserve);
    // 처치와 보석은 동일 수치 규격 및 동일한 바깥 폭을 사용한다.
    const counterWidth = paddedWidth(Math.max(measure('처치 수'), hud.iconSize), counterReserve);
    const progressWidth = spec.width - timeWidth - 2 * counterWidth;
    const barWidth = progressWidth - 2 * hud.padding - measure('정원 완성도') - hud.gap;
    if (barWidth < hud.minBarWidth) {
      throw new RangeError('HUD values exceed the available display width');
    }
    return {
      time: { x: 0, width: timeWidth },
      progress: { x: timeWidth, width: progressWidth, barWidth },
      kills: { x: timeWidth + progressWidth, width: counterWidth },
      gems: { x: spec.width - counterWidth, width: counterWidth }
    };
  }

  function drawHud(scene) {
    const g = scene.add.graphics().setName('top-hud');
    frame(g, 0, 0, spec.width, spec.top, colors.hud, colors.hudBorder);

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

    g.fillStyle(0x46515b, 1);
    [columns.progress.x, columns.kills.x, columns.gems.x].forEach(x => g.fillRect(x, 4, 1, spec.top - 8));

    // 동일한 좌우 패딩, 동일한 세로 중심. 레이블은 왼쪽, 수치는 오른쪽 기준선.
    function metric(column, label, value) {
      text(scene, column.x + hud.padding, hud.centerY, label, hud.labelSize, colors.label, 'left');
      text(scene, column.x + column.width - hud.padding, hud.centerY, value, hud.valueSize, colors.value, 'right');
    }
    metric(columns.time, '시간', time);
    metric(columns.kills, '처치 수', count);

    const c = columns.progress;
    text(scene, c.x + hud.padding, hud.centerY, '정원 완성도', hud.labelSize, colors.label, 'left');
    const barX = c.x + hud.padding + labelWidth + hud.gap;
    const barY = hud.centerY - hud.barHeight / 2;
    frame(g, barX, barY, c.barWidth, hud.barHeight, colors.normalFill, colors.normalBorder);
    const progress = Math.max(0, Math.min(100, hud.previewProgress));
    const fillWidth = Math.round((c.barWidth - 2) * progress / 100);
    if (fillWidth > 0) {
      g.fillStyle(colors.progressFill, 1).fillRect(barX + 1, barY + 1, fillWidth, hud.barHeight - 2);
    }
    text(scene, barX + c.barWidth / 2, hud.centerY, progress + '%', hud.valueSize, colors.value, 'center');

    const gem = columns.gems;
    reserveIcon(g, gem.x + hud.padding, hud.centerY - hud.iconSize / 2, hud.iconSize, colors.reservedIcon);
    text(scene, gem.x + gem.width - hud.padding, hud.centerY, count, hud.valueSize, colors.value, 'right');
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
    reserveIcon(g, groupX, centerY - c.iconSize / 2, c.iconSize, 0x87958d);
    cost.setX(groupX + c.iconSize + c.gap);
  }

  function drawSlots(scene) {
    const s = spec.slots;
    const g = scene.add.graphics().setName('item-slots');
    frame(g, 0, spec.top + spec.fieldHeight, spec.width, spec.bottom, colors.hud, colors.hudBorder);
    const shown = s.initial + 1;
    const totalWidth = shown * s.size + (shown - 1) * s.gap;
    const left = (spec.width - totalWidth) / 2;
    for (let i = 0; i < s.initial; i++) {
      frame(g, left + i * (s.size + s.gap), s.y, s.size, s.size, colors.normalFill, colors.normalBorder);
    }
    const x = left + s.initial * (s.size + s.gap);
    frame(g, x, s.y, s.size, s.size, colors.disabledFill, colors.disabledBorder);
    drawSlotCost(scene, g, x, s.y, s.size, s.exampleCost);
    // 확장 칸은 의도적으로 클릭 불가: 재화 획득/소비/확장 로직이 없다.
  }

  function drawMarkers(scene) {
    Object.entries(samples).forEach(([type, positions]) => {
      const asset = assets[type];
      positions.forEach(([x, y], i) => {
        // 도형의 바운딩 박스가 정확히 PNG 목표 크기와 같다.
        // 추후 동일한 x, y, origin(0.5)에서 해당 크기의 이미지로 교체한다.
        scene.add.rectangle(x, y, asset.size, asset.size, asset.color)
          .setName('placeholder:' + asset.assetKey + ':' + i);
      });
    });
  }

  function drawBlueprint(scene) {
    const b = spec.blueprint;
    // 패널 접기는 화면 UI 상태만 변경한다.
    const body = scene.add.graphics().setDepth(10).setName('blueprint-body');
    frame(body, b.x, b.y + b.header, b.width, b.height - b.header, colors.hud, colors.hudBorder);
    grid(body, b.gridX, b.gridY, b.cell, colors.normalFill, colors.blueprintLine);

    const header = scene.add.graphics().setDepth(11).setName('blueprint-header');
    frame(header, b.x, b.y, b.width, b.header, colors.hud, colors.hudBorder);
    text(scene, b.x + b.padding, b.y + b.header / 2, '도안', window.GardenUI.fontSize.base, '#c7d1d9', 'left').setDepth(12);
    const arrow = scene.add.graphics().setDepth(12).setName('blueprint-chevron');
    let expanded = true;
    function drawArrow() {
      arrow.clear().lineStyle(1, 0xa8b5bf, 1);
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

  function draw(scene) {
    window.GardenUI.fitCamera(scene, spec.width, spec.height);
    scene.cameras.main.setBackgroundColor('#17251e');
    const g = scene.add.graphics().setName('battlefield');
    g.fillStyle(colors.field, 1).fillRect(0, spec.top, spec.width, spec.fieldHeight);
    grid(g, spec.garden.x, spec.garden.y, spec.garden.cell, colors.gridFill, colors.gridLine);
    drawMarkers(scene);
    drawHud(scene);
    drawSlots(scene);
    drawBlueprint(scene);
  }

  window.GardenGameLayout = Object.freeze({ spec, assets, colors, spacing, hud, slotCost, formatHudTime, formatHudCount, hudColumns, draw });
}());
