(function () {
  'use strict';

  // UI/정적 크기 비교 시안 전용. 물리, 이동, 스폰, 공격, 획득, 장착 및
  // 슬롯 확장 로직은 없다. 모든 좌표는 640×360 논리 픽셀이다.
  const spec = Object.freeze({
    width: 640, height: 360,
    top: 24, fieldHeight: 300, bottom: 36,
    garden: Object.freeze({ x: 240, y: 94, columns: 10, rows: 10, cell: 16 }),
    blueprint: Object.freeze({ x: 8, y: 32, width: 96, height: 104, header: 16, gridX: 16, gridY: 52, cell: 8 }),
    slots: Object.freeze({ size: 24, gap: 4, initial: 4, max: 10, y: 330, exampleCost: 10 })
  });

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
    disabledFill: 0x191f22, disabledBorder: 0x39453f, disabledText: '#58655e',
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

  function text(scene, x, y, value, size, color, align, bold) {
    return window.GardenUI.text(scene, x, y, value, size, color, {
      originX: align === 'center' ? 0.5 : align === 'right' ? 1 : 0,
      originY: 0.5, bold: !!bold
    });
  }

  function reserveIcon(g, x, y, size, color) {
    // 실제 보석 이미지를 넣지 않은 점선 자리.
    g.fillStyle(color, 1);
    for (let i = 0; i < size; i += 2) {
      g.fillRect(x + i, y, 1, 1);
      g.fillRect(x + i, y + size - 1, 1, 1);
      g.fillRect(x, y + i, 1, 1);
      g.fillRect(x + size - 1, y + i, 1, 1);
    }
  }

  function drawHud(scene) {
    const g = scene.add.graphics().setName('top-hud');
    frame(g, 0, 0, spec.width, spec.top, colors.hud, colors.hudBorder);
    g.fillStyle(0x46515b, 1);
    [100, 210, 560].forEach(x => g.fillRect(x, 5, 1, 14));

    text(scene, 13, 12, '시간', 9, colors.label);
    text(scene, 44, 12, '00:00', 11, colors.value, 'left', true);
    text(scene, 117, 12, '처치 수', 9, colors.label);
    text(scene, 173, 12, '0', 11, colors.value, 'left', true);
    text(scene, 226, 12, '정원 완성도', 9, colors.label);

    frame(g, 294, 6, 248, 12, colors.normalFill, colors.normalBorder);
    text(scene, 418, 12, '0%', 8, '#cad7ce', 'center', true);

    reserveIcon(g, 579, 6, 12, colors.reservedIcon);
    text(scene, 612, 12, '0', 11, colors.value, 'center', true);
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
    reserveIcon(g, x + 3, s.y + 8, 7, 0x58655e);
    text(scene, x + 17, s.y + 12, String(s.exampleCost), 7, colors.disabledText, 'center');
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
    text(scene, b.x + 8, b.y + 8, '도안', 9, '#c7d1d9', 'left', true).setDepth(12);
    const arrow = scene.add.graphics().setDepth(12).setName('blueprint-chevron');
    let expanded = true;
    function drawArrow() {
      arrow.clear().lineStyle(1, 0xa8b5bf, 1);
      const x = b.x + b.width - 12;
      const y = b.y + 8;
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
    scene.cameras.main.setZoom(1).setScroll(0, 0);
    scene.cameras.main.setBackgroundColor('#17251e');
    const g = scene.add.graphics().setName('battlefield');
    g.fillStyle(colors.field, 1).fillRect(0, spec.top, spec.width, spec.fieldHeight);
    grid(g, spec.garden.x, spec.garden.y, spec.garden.cell, colors.gridFill, colors.gridLine);
    drawMarkers(scene);
    drawHud(scene);
    drawSlots(scene);
    drawBlueprint(scene);
  }

  window.GardenGameLayout = Object.freeze({ spec, assets, colors, draw });
}());
