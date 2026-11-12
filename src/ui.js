(function () {
  'use strict';

  // 공유되는 것은 화면 스타일과 입력용 UI 컴포넌트뿐이다.
  const W = 960;
  const H = 540;
  // 8px은 기본 간격 참고값일 뿐. 용도·정보 밀도에 따라 2/4/6/10/12px도 사용한다.
  const unit = 8, tile = unit * 3;
  const spacing = Object.freeze({ micro: 2, small: 4, compact: 6, base: unit, inset: 10, medium: 12, section: unit * 2, large: tile });
  const P = window.GardenPalette;
  const C = Object.freeze({
    bg: P.n.ink, panel: P.n.soil, panelAlt: P.n.grid,
    border: P.n.edge, subtle: P.n.slot,
    text: P.hex.paper, muted: P.hex.label, disabled: P.hex.disabled,
    gold: P.n.gold, goldText: P.hex.gold, green: P.n.growth, greenText: P.hex.growth,
    red: P.n.red, redText: P.hex.red, white: P.n.paper
  });
  // One unmodified Regular face for Korean, English and numerals.
  const fontFamily = '"Garden Fusion"';
  // Fusion Pixel 원본을 유지하고 가독성 비교 결과에 따라 역할별 크기를 지정한다.
  const fontSize = Object.freeze({ base: 12, compact: 12, heading: 20, title: 40, timer: 22, menuBase: 12, menuAction: 20, menuHeading: 20, menuTitle: 40 });
  // 메뉴와 전장 모두 동일한 960×540 좌표, 기능적 선 1px.
  const menuStyle = Object.freeze({ strokeWidth: 1, buttonHeight: 32, gap: spacing.base, navHeight: 38, navGap: 6 });
  async function loadFonts() {
    if (!document.fonts || !document.fonts.load) throw new Error('Font Loading API unavailable');
    const loaded = await document.fonts.load('400 20px ' + fontFamily,
      '정원 완성도 시간 처치 수 보석 수량 도안 새 게임 설정 일시정지 GARDEN TEST 0123456789 83%');
    if (!loaded.length || loaded.some(face => face.status !== 'loaded')) {
      throw new Error('Fusion Pixel font failed to load');
    }
  }
  // Rasterize at the actual zoom (at least 1), not a rounded-up zoom that
  // would require shrinking the texture at common fractional menu scales.
  function textResolution(scene) { return Math.max(1, scene.cameras.main.zoom); }

  // 사용자 비교 결과로 확정한 고해상도 NEAREST.
  // 글리프의 반투명 픽셀을 보존하고 텍스처 필터만 복원한다.
  function applyFontFilter(item) {
    const update = item.updateText;
    item.updateText = function () {
      const result = update.apply(this, arguments);
      this.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      return result;
    };
    item.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  function text(scene, x, y, content, size, color, options) {
    const opts = options || {};
    const item = scene.add.text(x, y, content, {
      // 텍스트의 논리 크기는 유지하고 현재 렌더 배율에 맞는 텍스처를 만든다.
      resolution: textResolution(scene),
      fontFamily: fontFamily,
      fontSize: String(size) + 'px',
      color: color || C.text,
      // Regular only; no synthetic bold, width compression or letter spacing.
      fontStyle: 'normal',
      align: opts.align || 'left',
      lineSpacing: opts.lineSpacing === undefined ? spacing.small : opts.lineSpacing,
      wordWrap: opts.wrap ? { width: opts.wrap } : undefined
    });
    applyFontFilter(item);
    item.setOrigin(opts.originX === undefined ? 0 : opts.originX,
      opts.originY === undefined ? 0 : opts.originY);
    if (opts.alpha !== undefined) item.setAlpha(opts.alpha);
    if (scene.layoutTextObjects) {
      const tracked = scene.layoutTextObjects;
      tracked.add(item);
      item.once('destroy', () => tracked.delete(item));
    }
    return item;
  }

  function panel(scene, x, y, width, height, options) {
    const opts = options || {};
    const rect = scene.add.rectangle(x, y, width, height,
      opts.fill === undefined ? C.panel : opts.fill,
      opts.alpha === undefined ? 1 : opts.alpha);
    rect.setStrokeStyle(opts.strokeWidth === undefined ? menuStyle.strokeWidth : opts.strokeWidth,
      opts.stroke === undefined ? C.border : opts.stroke,
      opts.strokeAlpha === undefined ? 1 : opts.strokeAlpha);
    return rect;
  }

  function rule(scene, x1, y1, x2, y2, color, alpha) {
    const graphics = scene.add.graphics();
    graphics.lineStyle(menuStyle.strokeWidth, color || C.border, alpha === undefined ? 1 : alpha);
    graphics.lineBetween(x1, y1, x2, y2);
    return graphics;
  }

  // 각 씬의 디자인 좌표를 실제 16:9 렌더링 버퍼에 매핑한다.
  // Game, 메뉴 및 오버레이 모두 960×540.
  // 일시정지 중인 씬도 resize 이벤트에 맞춰 카메라와 텍스트를 갱신한다.
  function fitCamera(scene, designWidth, designHeight) {
    const tracked = new Set();
    scene.layoutTextObjects = tracked;

    function resize(gameSize) {
      const width = gameSize.width;
      const height = gameSize.height;
      const zoom = Math.min(width / designWidth, height / designHeight);
      scene.cameras.main.setSize(width, height).setZoom(zoom)
        .centerOn(designWidth / 2, designHeight / 2);
      const resolution = textResolution(scene);
      tracked.forEach(item => {
        if (item.style.resolution !== resolution) {
          item.setResolution(resolution);
          // CanvasRenderer는 frame.source.resolution을 사용한다.
          // Phaser 3.90 setResolution은 style만 바꾸므로 함께 갱신한다.
          item.frame.source.resolution = resolution;
        }
      });
    }

    resize(scene.scale.gameSize);
    scene.scale.on('resize', resize);
    scene.events.once('shutdown', () => {
      scene.scale.off('resize', resize);
      tracked.clear();
      scene.layoutTextObjects = null;
    });
  }

  function menuCamera(scene) {
    fitCamera(scene, W, H);
  }

  function background(scene, label) {
    menuCamera(scene);
    scene.cameras.main.setBackgroundColor(P.hex.ink);
    scene.add.rectangle(W / 2, H / 2, W, H, C.bg);
    rule(scene, 24, 48, 936, 48, C.border, 0.8);
    rule(scene, 24, 492, 936, 492, C.border, 0.8);
    text(scene, 24, 20, 'GARDEN TEST', fontSize.menuBase, C.text);
    text(scene, 936, 20, label || 'SCENE PROTOTYPE', fontSize.menuBase, C.muted, { originX: 1 });
    text(scene, 24, 508, 'PHASER 3.90.0 / UI SCENES ONLY', fontSize.compact, C.muted);
    text(scene, 936, 508, 'NO GAMEPLAY LOGIC', fontSize.compact, C.muted, { originX: 1 });
  }

  function button(scene, x, y, width, label, action, options) {
    const opts = options || {};
    const height = opts.height || menuStyle.buttonHeight;
    const disabled = !!opts.disabled;
    const emphasized = !!(opts.primary || opts.selected);
    const border = opts.danger ? C.red : emphasized ? C.white : C.subtle;
    const fill = emphasized ? C.panelAlt : C.panel;
    const hoverBorder = opts.danger ? C.red : C.white;
    const base = scene.add.rectangle(0, 0, width, height,
      disabled ? P.n.ink : fill, 1);
    base.setStrokeStyle(menuStyle.strokeWidth, disabled ? C.border : border, 1);
    const caption = text(scene, 0, 0, label, opts.fontSize || fontSize.menuBase,
      disabled ? C.disabled : C.text, { originX: 0.5, originY: 0.5 });
    const group = scene.add.container(x, y, [base, caption]);
    if (!disabled && typeof action === 'function') {
      base.setInteractive({ useHandCursor: true });
      base.on('pointerover', function () {
        base.setFillStyle(C.panelAlt);
        base.setStrokeStyle(menuStyle.strokeWidth, hoverBorder, 1);
      });
      base.on('pointerout', function () {
        base.setFillStyle(fill);
        base.setStrokeStyle(menuStyle.strokeWidth, border, 1);
      });
      base.on('pointerdown', action);
    }
    return group;
  }

  function overlay(scene) {
    menuCamera(scene);
    return scene.add.rectangle(W / 2, H / 2, W, H, P.n.shadow, 0.74)
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
    W: W, H: H, C: C, unit, tile, spacing, fontFamily, fontSize, menuStyle, loadFonts, text: text, panel: panel, rule: rule,
    background: background, button: button, overlay: overlay, fitCamera: fitCamera,
    bindEscape: bindEscape, openSubscene: openSubscene,
    closeSubscene: closeSubscene
  });
}());
