(function () {
  'use strict';

  // 공유되는 것은 화면 스타일과 입력용 UI 컴포넌트뿐이다.
  const W = 1280;
  const H = 720;
  const C = {
    bg: 0x0b1018,
    panel: 0x18212d,
    panelAlt: 0x202d3b,
    border: 0x3b4b5c,
    subtle: 0x7e91a3,
    text: '#eaf0f5',
    muted: '#9cabb9',
    gold: 0xe1b875,
    green: 0x84d0aa,
    red: 0xe18f91,
    white: 0xffffff
  };
  const font = 'Arial, "Malgun Gothic", sans-serif';

  function text(scene, x, y, content, size, color, options) {
    const opts = options || {};
    const item = scene.add.text(x, y, content, {
      fontFamily: font,
      fontSize: String(size) + 'px',
      color: color || C.text,
      fontStyle: opts.bold ? 'bold' : 'normal',
      align: opts.align || 'left',
      lineSpacing: opts.lineSpacing || 9,
      wordWrap: opts.wrap ? { width: opts.wrap } : undefined
    });
    item.setOrigin(opts.originX === undefined ? 0 : opts.originX,
      opts.originY === undefined ? 0 : opts.originY);
    if (opts.alpha !== undefined) item.setAlpha(opts.alpha);
    return item;
  }

  function panel(scene, x, y, width, height, options) {
    const opts = options || {};
    const rect = scene.add.rectangle(x, y, width, height,
      opts.fill === undefined ? C.panel : opts.fill,
      opts.alpha === undefined ? 1 : opts.alpha);
    rect.setStrokeStyle(opts.strokeWidth === undefined ? 1 : opts.strokeWidth,
      opts.stroke === undefined ? C.border : opts.stroke,
      opts.strokeAlpha === undefined ? 1 : opts.strokeAlpha);
    return rect;
  }

  function rule(scene, x1, y1, x2, y2, color, alpha) {
    const graphics = scene.add.graphics();
    graphics.lineStyle(1, color || C.border, alpha === undefined ? 1 : alpha);
    graphics.lineBetween(x1, y1, x2, y2);
    return graphics;
  }

  // 기존 메뉴/결과/오버레이의 1280×720 배치를 유지하면서
  // 640×360 논리 캔버스에 맞춘다. Game 씬은 이 카메라를 사용하지 않는다.
  function legacyCamera(scene) {
    scene.cameras.main.setZoom(0.5).centerOn(W / 2, H / 2);
  }

  function background(scene, label) {
    legacyCamera(scene);
    scene.cameras.main.setBackgroundColor('#0b1018');
    scene.add.rectangle(W / 2, H / 2, W, H, C.bg);
    const decor = scene.add.graphics();
    decor.lineStyle(1, C.border, 0.14);
    for (let x = 40; x < W; x += 64) decor.lineBetween(x, 0, x, H);
    for (let y = 36; y < H; y += 64) decor.lineBetween(0, y, W, y);
    decor.lineStyle(2, C.gold, 0.22);
    decor.strokeCircle(1054, 314, 242);
    decor.strokeCircle(1054, 314, 181);
    rule(scene, 40, 76, 1240, 76, C.border, 0.8);
    rule(scene, 40, 664, 1240, 664, C.border, 0.8);
    text(scene, 43, 30, 'GARDEN TEST', 19, '#e1b875', { bold: true });
    text(scene, 1238, 33, label || 'SCENE PROTOTYPE', 12, C.muted, { originX: 1 });
    text(scene, 43, 680, 'PHASER 3.90.0 / UI SCENES ONLY', 11, C.muted);
    text(scene, 1238, 680, 'NO GAMEPLAY LOGIC', 11, C.muted, { originX: 1 });
  }

  function button(scene, x, y, width, label, action, options) {
    const opts = options || {};
    const height = opts.height || 52;
    const disabled = !!opts.disabled;
    const border = opts.danger ? C.red : opts.primary ? C.gold : C.border;
    const fill = opts.primary ? 0x38362f : C.panel;
    const base = scene.add.rectangle(0, 0, width, height,
      disabled ? 0x151d27 : fill, 1);
    base.setStrokeStyle(1, disabled ? 0x2b3641 : border, 1);
    const caption = text(scene, 0, 0, label, opts.fontSize || 19,
      disabled ? '#738191' : C.text, { originX: 0.5, originY: 0.5, bold: !!opts.primary });
    const group = scene.add.container(x, y, [base, caption]);
    if (!disabled && typeof action === 'function') {
      base.setInteractive({ useHandCursor: true });
      base.on('pointerover', function () {
        base.setFillStyle(opts.danger ? 0x4d3036 : 0x2c3948);
        base.setStrokeStyle(2, border);
      });
      base.on('pointerout', function () {
        base.setFillStyle(fill);
        base.setStrokeStyle(1, border);
      });
      base.on('pointerdown', action);
    }
    return group;
  }

  function overlay(scene) {
    legacyCamera(scene);
    return scene.add.rectangle(W / 2, H / 2, W, H, 0x05090f, 0.74)
      .setInteractive();
  }

  function bindEscape(scene, handler) {
    function onEsc(event) {
      if (scene.scene.isActive(scene.sys.settings.key)) {
        if (event && event.preventDefault) event.preventDefault();
        handler();
      }
    }
    scene.input.keyboard.on('keydown-ESC', onEsc);
    scene.events.once('shutdown', function () {
      scene.input.keyboard.off('keydown-ESC', onEsc);
    });
  }

  function openSubscene(scene, target) {
    const returnTo = scene.sys.settings.key;
    scene.scene.pause(returnTo);
    scene.scene.launch(target, { returnTo: returnTo });
  }

  function closeSubscene(scene, returnTo) {
    scene.scene.stop(scene.sys.settings.key);
    scene.scene.resume(returnTo);
  }

  window.GardenUI = Object.freeze({
    W: W, H: H, C: C, text: text, panel: panel, rule: rule,
    background: background, button: button, overlay: overlay,
    bindEscape: bindEscape, openSubscene: openSubscene,
    closeSubscene: closeSubscene
  });
}());
