(function () {
  'use strict';

  // 공유되는 것은 화면 스타일과 입력용 UI 컴포넌트뿐이다.
  const W = 960;
  const H = 540;
  // 8px은 기본 간격 참고값일 뿐. 용도·정보 밀도에 따라 2/4/6/10/12px도 사용한다.
  const unit = 8, tile = unit * 3;
  const spacing = Object.freeze({ micro: 2, small: 4, compact: 6, base: unit, inset: 10, medium: 12, section: unit * 2, large: tile });
  const P = window.GardenPalette;
  const R = P.reference;
  const C = Object.freeze({
    bg: R.n.background, panel: R.n.panel, panelAlt: R.n.selected,
    border: R.n.panelBorder, subtle: R.n.border, header: R.n.header, button: R.n.button,
    text: R.hex.text, muted: R.hex.label, disabled: R.hex.disabled,
    green: R.n.green, greenText: R.hex.green,
    red: R.n.red, redText: R.hex.red, white: R.n.hover
  });
  // HUD 언어 미리보기 전용. 게임 전체 번역/언어 설정 기능과 분리한다.
  const hudLabels = Object.freeze(Object.fromEntries(Object.entries({
    ko: { time: '시간', kills: '처치 수', progress: '정원 완성도' },
    en: { time: 'Time', kills: 'Kills', progress: 'Garden Completion' },
    ja: { time: '時間', kills: '撃破数', progress: '庭園完成度' },
    es: { time: 'Tiempo', kills: 'Bajas', progress: 'Progreso del jardín' },
    zh: { time: '时间', kills: '击杀数', progress: '花园完成度' }
  }).map(([lang, labels]) => [lang, Object.freeze(labels)])));
  const hudLanguage = () => {
    const lang = (new URLSearchParams(window.location.search).get('lang') || 'ko').toLowerCase().split('-')[0];
    return Object.hasOwn(hudLabels, lang) ? lang : 'ko';
  };
  // One unmodified Regular face for HUD labels and numerals.
  const fontFamily = '"Garden Fusion"';
  // Fusion Pixel 원본을 유지하고 가독성 비교 결과에 따라 역할별 크기를 지정한다.
  const fontSize = Object.freeze({ base: 12, compact: 12, heading: 20, title: 40, timer: 12, menuBase: 12, menuAction: 14, menuHeading: 18, menuTitle: 40 });
  // 메뉴와 전장 모두 동일한 960×540 좌표, 기능적 선 1px.
  const menuGap = 3;
  const menuStyle = Object.freeze({ strokeWidth: 1, buttonHeight: 24, gap: menuGap, navHeight: 24, navGap: menuGap, panelPadding: 10, headerHeight: 32, sectionGap: 20 });
  async function loadFonts() {
    if (!document.fonts || !document.fonts.load) throw new Error('Font Loading API unavailable');
    const loaded = await document.fonts.load('400 20px ' + fontFamily,
      '보석 수량 도안 새 게임 설정 일시정지 GARDEN TEST 0123456789 83% ' +
      Object.values(hudLabels).flatMap(labels => Object.values(labels)).join(' '));
    if (!loaded.length || loaded.some(face => face.status !== 'loaded')) {
      throw new Error('Fusion Pixel font failed to load');
    }
  }
  // Final-output UI: the logical layout is independent of the renderer's physical pixel grid.
  function textResolution(scene) { return scene.cameras.main.zoom; }

  function renderAtPixelOrigin(item) {
    for (const name of ['renderWebGL', 'renderCanvas']) {
      const render = item[name];
      item[name] = function (renderer, src, camera, parentMatrix, ...rest) {
        const m = Phaser.GameObjects.GetCalcMatrix(src, camera, parentMatrix).calc;
        if (m.b !== 0 || m.c !== 0 || m.a <= 0 || m.d <= 0) return render.call(this, renderer, src, camera, parentMatrix, ...rest);
        const left = m.e - src.displayOriginX * m.a;
        const top = m.f - src.displayOriginY * m.d;
        const x = src.x, y = src.y;
        // Render only: do not alter the layout coordinates, wrapping, or hit areas.
        src.x += (Math.round(left) - left) / m.a;
        src.y += (Math.round(top) - top) / m.d;
        try { return render.call(this, renderer, src, camera, parentMatrix, ...rest); }
        finally { src.x = x; src.y = y; }
      };
    }
  }

  // Use the actual integer canvas dimensions, not the fractional requested frame.
  // Phaser 3.90 computes width*resolution before the canvas coerces it to an integer.
  // Matching the texture frame to its backing store eliminates accidental resampling.
  function applyFontFilter(item) {
    const syncFrame = () => {
      const { canvas, frame } = item;
      frame.source.width = canvas.width;
      frame.source.height = canvas.height;
      frame.source.resolution = item.style.resolution;
      frame.setSize(canvas.width, canvas.height);
      item.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    };
    const update = item.updateText;
    item.updateText = function () {
      const result = update.apply(this, arguments);
      syncFrame();
      return result;
    };
    syncFrame();
    renderAtPixelOrigin(item);
  }

  // Filled rectangles are submitted on exact output-pixel boundaries, including
  // nested/moving cards. Logical coordinates and the Graphics hit geometry stay unchanged.
  function pixelGraphics(scene) {
    const g = scene.add.graphics(), rects = [];
    const fillRect = g.fillRect, clear = g.clear;
    g.fillRect = function (x, y, w, h) {
      const index = this.commandBuffer.length;
      fillRect.call(this, x, y, w, h);
      rects.push(index + 1);
      return this;
    };
    g.clear = function () { rects.length = 0; return clear.call(this); };
    for (const name of ['renderWebGL', 'renderCanvas']) {
      const render = g[name];
      g[name] = function (renderer, src, camera, parentMatrix, ...rest) {
        const m = Phaser.GameObjects.GetCalcMatrix(src, camera, parentMatrix).calc;
        if (!rects.length || m.b !== 0 || m.c !== 0 || m.a <= 0 || m.d <= 0) return render.call(this, renderer, src, camera, parentMatrix, ...rest);
        const { a, d, e, f } = m, original = src.commandBuffer, snapped = original.slice();
        for (const i of rects) {
          const x = original[i], y = original[i+1], w = original[i+2], h = original[i+3];
          const left = Math.round(a*x+e), right = Math.round(a*(x+w)+e);
          const top = Math.round(d*y+f), bottom = Math.round(d*(y+h)+f);
          snapped[i] = (left-e)/a; snapped[i+1] = (top-f)/d;
          snapped[i+2] = (right-left)/a; snapped[i+3] = (bottom-top)/d;
        }
        src.commandBuffer = snapped;
        try { return render.call(this, renderer, src, camera, parentMatrix, ...rest); }
        finally { src.commandBuffer = original; }
      };
    }
    return g;
  }

  // One logical pixel removed at each outer corner; no diagonal/AA wedge.
  function cutFill(g, x, y, w, h, color, alpha = 1, top = true, bottom = true) {
    g.fillStyle(color, alpha);
    if (top) g.fillRect(x+1, y, w-2, 1);
    else g.fillRect(x, y, w, 1);
    g.fillRect(x, y+1, w, h-2);
    if (bottom) g.fillRect(x+1, y+h-1, w-2, 1);
    else g.fillRect(x, y+h-1, w, 1);
    return g;
  }
  function pixelFrame(g, x, y, w, h, fill, border, top = true, bottom = true) {
    cutFill(g,x,y,w,h,border,1,top,bottom);
    g.fillStyle(fill,1).fillRect(x+1,y+1,w-2,h-2);
    return g;
  }
  function pixelBox(scene, x, y, w, h, fill, options = {}) {
    const g = pixelGraphics(scene).setPosition(x,y);
    g.width = w; g.height = h; g.pixelBox = true;
    g.fillColor = fill; g.fillAlpha = options.alpha ?? 1;
    g.strokeColor = options.border ?? fill; g.strokeWidth = options.strokeWidth ?? 0;
    g.strokeAlpha = options.strokeAlpha ?? 1;
    const cut = options.cut !== false;
    const redraw = () => {
      g.clear();
      if (g.strokeWidth && g.strokeAlpha) {
        if (cut) cutFill(g,-w/2,-h/2,w,h,g.strokeColor,g.strokeAlpha);
        else g.fillStyle(g.strokeColor,g.strokeAlpha).fillRect(-w/2,-h/2,w,h);
        const t = g.strokeWidth;
        g.fillStyle(g.fillColor,g.fillAlpha).fillRect(-w/2+t,-h/2+t,w-2*t,h-2*t);
      } else if (cut) cutFill(g,-w/2,-h/2,w,h,g.fillColor,g.fillAlpha);
      else g.fillStyle(g.fillColor,g.fillAlpha).fillRect(-w/2,-h/2,w,h);
    };
    g.setFillStyle = (color, alpha = 1) => { g.fillColor=color; g.fillAlpha=alpha; redraw(); return g; };
    g.setStrokeStyle = (width, color, alpha = 1) => { g.strokeWidth=width; g.strokeColor=color; g.strokeAlpha=alpha; redraw(); return g; };
    redraw();
    return g;
  }

  // 글자 그림자는 제외하고 실제 전경 픽셀의 가로·세로 범위를 측정한다.
  // 네이티브 텍스처 해상도가 바뀌면 다시 측정하며 원본 글리프는 수정하지 않는다.
  const inkCache = new WeakMap();
  function inkBounds(item, background) {
    const key = [item.text, item.style.color, item.style.resolution, item.canvas.width, item.canvas.height, background].join('|');
    const cached = inkCache.get(item);
    if (cached?.key === key) return cached.ink;
    const { width, height } = item.canvas;
    const data = item.context.getImageData(0, 0, width, height).data;
    const bg = Math.max((background >> 16) & 255, (background >> 8) & 255, background & 255);
    const fg = parseInt(item.style.color.slice(1), 16);
    const foreground = Math.max((fg >> 16) & 255, (fg >> 8) & 255, fg & 255);
    // Measure foreground at 25% contrast relative to its own color and surface.
    // A fixed brightness cutoff would miss antialiased gray 999 pixels when scaled down.
    const threshold = Math.ceil(bg + (foreground - bg) * 0.25);
    let top = height, bottom = 0, left = width, right = 0, fallbackTop = height, fallbackBottom = 0, fallbackLeft = width, fallbackRight = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4, alpha = data[i + 3] / 255;
      const color = Math.max(data[i], data[i + 1], data[i + 2]);
      if (!alpha || !color) continue;
      fallbackTop = Math.min(fallbackTop, y);
      fallbackBottom = Math.max(fallbackBottom, y + 1);
      fallbackLeft = Math.min(fallbackLeft, x);
      fallbackRight = Math.max(fallbackRight, x + 1);
      if (Math.round(color * alpha + bg * (1 - alpha)) < threshold) continue;
      top = Math.min(top, y);
      bottom = Math.max(bottom, y + 1);
      left = Math.min(left, x);
      right = Math.max(right, x + 1);
    }
    const ink = bottom > top ? { top, bottom, left, right } : { top: fallbackTop, bottom: fallbackBottom, left: fallbackLeft, right: fallbackRight }; 
    inkCache.set(item, { key, ink });
    return ink;
  }

  // Opt-in visible alignment for menu text; never changes the glyph or game UI positions.
  function alignVisible(item, x, y, align, background) {
    const z = item.style.resolution, ink = inkBounds(item, background);
    const width = ink.right - ink.left, height = ink.bottom - ink.top;
    const left = Math.round(x * z - (align === 'center' ? width / 2 : align === 'right' ? width : 0));
    const top = Math.round(y * z - height / 2);
    item.setPosition((left - ink.left) / z + item.displayOriginX, (top - ink.top) / z + item.displayOriginY);
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
      shadow: { offsetX: 1, offsetY: 1, color: R.hex.shadow, blur: 0, stroke: false, fill: true },
      wordWrap: opts.wrap ? { width: opts.wrap } : undefined
    });
    applyFontFilter(item);
    item.setOrigin(opts.originX === undefined ? 0 : opts.originX,
      opts.originY === undefined ? 0 : opts.originY);
    if (opts.inkAlign) {
      item.alignVisible = () => alignVisible(item, x, y, opts.inkAlign, opts.inkBackground ?? C.panel);
      item.alignVisible();
    }
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
    return pixelBox(scene,x,y,width,height,opts.fill ?? C.panel,{alpha:opts.alpha ?? 1,border:opts.stroke ?? C.border,strokeWidth:opts.strokeWidth ?? menuStyle.strokeWidth,strokeAlpha:opts.strokeAlpha ?? 1});
  }

  function panelHeader(scene, x, top, width) {
    const height = menuStyle.headerHeight;
    return pixelBox(scene,x,top+1+height/2,width-2,height,C.header,{cut:false}).setName('menu-panel-header');
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
        if (item.alignVisible) item.alignVisible();
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
    scene.cameras.main.setBackgroundColor(P.background.hex);
    scene.add.rectangle(W / 2, H / 2, W, H, P.background.n);
    scene.add.rectangle(W / 2, 15.5, W, 31, R.n.hud);
    scene.add.rectangle(W / 2, H - 15.5, W, 31, R.n.hud);
    rule(scene, 0, 29, W, 29, R.n.hudEdge, 1);
    rule(scene, 0, 30, W, 30, R.n.hudLight, 1);
    rule(scene, 0, H - 31, W, H - 31, R.n.hudLight, 1);
    text(scene, 10, 14, 'GARDEN TEST', fontSize.menuBase, C.text, { originY: 0.5 });
    text(scene, W - 10, 14, label || 'SCENE PROTOTYPE', fontSize.menuBase, C.muted, { originX: 1, originY: 0.5 });
    text(scene, 10, H - 15, 'PHASER 3.90.0 / UI SCENES ONLY', fontSize.compact, C.muted, { originY: 0.5 });
    text(scene, W - 10, H - 15, 'NO GAMEPLAY LOGIC', fontSize.compact, C.muted, { originX: 1, originY: 0.5 });
  }

  function button(scene, x, y, width, label, action, options) {
    const opts = options || {};
    const height = opts.height || menuStyle.buttonHeight;
    const disabled = !!opts.disabled;
    const emphasized = !!(opts.primary || opts.selected);
    const border = emphasized ? C.white : C.subtle;
    const fill = emphasized && !opts.danger ? C.panelAlt : C.button;
    const hoverBorder = C.white;
    const base = pixelBox(scene,0,0,width,height,disabled ? R.n.disabledFill : fill,{border:disabled ? R.n.disabledBorder : border,strokeWidth:menuStyle.strokeWidth});
    const caption = text(scene, 0, 0, label, opts.fontSize || (opts.primary ? fontSize.menuAction : fontSize.menuBase),
      disabled ? C.disabled : opts.danger ? C.redText : C.text, { originX: 0.5, originY: 0.5, inkAlign: 'center', inkBackground: disabled ? R.n.disabledFill : fill });
    const group = scene.add.container(x, y, [base, caption]);
    if (!disabled && typeof action === 'function') {
      base.setInteractive(new Phaser.Geom.Rectangle(-width/2,-height/2,width,height),Phaser.Geom.Rectangle.Contains);
      base.input.cursor = 'pointer';
      base.on('pointerover', function () {
        base.setFillStyle(opts.danger ? C.button : C.panelAlt);
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
    return scene.add.rectangle(W / 2, H / 2, W, H, R.n.shadow, 0.74)
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
    W: W, H: H, C: C, unit, tile, spacing, inkBounds, pixelGraphics, cutFill, pixelFrame, pixelBox, fontFamily, fontSize, menuStyle, hudLabels, hudLanguage, loadFonts, text: text, panel: panel, panelHeader, rule: rule,
    background: background, button: button, overlay: overlay, fitCamera: fitCamera,
    bindEscape: bindEscape, openSubscene: openSubscene,
    closeSubscene: closeSubscene
  });
}());
