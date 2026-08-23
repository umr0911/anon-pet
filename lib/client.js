window.__ModuleLoader__.load({
  id: "anon-pet",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    var React = require("react");

    var SIZE_MIN = 80;
    var SIZE_MAX = 520;
    var DEFAULT_SIZE = 220;
    var MARGIN = 10;

    function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
    function clampSize(n) { return Math.max(SIZE_MIN, Math.min(SIZE_MAX, Math.round(n))); }
    function clampSpeed(n) { return Math.max(0.25, Math.min(3, n)); }

    function AnonPet() {
      var containerRef = React.useRef(null);
      var canvasRef = React.useRef(null);
      var framesRef = React.useRef(null);
      var frameIdxRef = React.useRef(0);
      var animRef = React.useRef(null);
      var dragRef = React.useRef(null);
      var yLoadedRef = React.useRef(false);
      var fileInputRef = React.useRef(null);

      var sizeState = React.useState(function () {
        var v = parseInt(lsGet('anon-pet:size'), 10);
        return clampSize(isNaN(v) ? DEFAULT_SIZE : v);
      });
      var size = sizeState[0];
      var setSize = sizeState[1];

      var speedState = React.useState(function () {
        var v = parseFloat(lsGet('anon-pet:speed'));
        return clampSpeed(isNaN(v) || v <= 0 ? 1 : v);
      });
      var speed = speedState[0];
      var setSpeed = speedState[1];
      var speedRef = React.useRef(speed);
      speedRef.current = speed;

      var loopState = React.useState(function () { return lsGet('anon-pet:loop') === '1'; });
      var loopMode = loopState[0];
      var setLoopMode = loopState[1];

      var sideState = React.useState(function () { return lsGet('anon-pet:side') === 'left' ? 'left' : 'right'; });
      var side = sideState[0];
      var setSide = sideState[1];

      var yState = React.useState(null);
      var y = yState[0];
      var setY = yState[1];

      var readyState = React.useState(false);
      var ready = readyState[0];
      var setReady = readyState[1];
      var dragPosState = React.useState(null);
      var dragPos = dragPosState[0];
      var setDragPos = dragPosState[1];
      var hoveredState = React.useState(false);
      var hovered = hoveredState[0];
      var setHovered = hoveredState[1];
      var balanceState = React.useState(null);
      var balance = balanceState[0];
      var setBalance = balanceState[1];
      var loadErrorState = React.useState(null);
      var loadError = loadErrorState[0];
      var setLoadError = loadErrorState[1];
      var loadTickState = React.useState(0);
      var loadTick = loadTickState[0];
      var setLoadTick = loadTickState[1];
      var menuState = React.useState(false);
      var menuOpen = menuState[0];
      var setMenuOpen = menuState[1];
      var menuPosState = React.useState({ x: 0, y: 0 });
      var menuPos = menuPosState[0];
      var setMenuPos = menuPosState[1];

      function drawFrame(i) {
        var canvas = canvasRef.current;
        var frames = framesRef.current;
        if (!canvas || !frames || !frames[i]) return;
        var bmp = frames[i].bitmap;
        if (canvas.width !== bmp.width || canvas.height !== bmp.height) {
          canvas.width = bmp.width;
          canvas.height = bmp.height;
        }
        var c = canvas.getContext('2d');
        c.clearRect(0, 0, canvas.width, canvas.height);
        c.drawImage(bmp, 0, 0);
        frameIdxRef.current = i;
      }

      function play(dir, loop) {
        var frames = framesRef.current;
        if (!frames || frames.length === 0) return;
        var target = dir > 0 ? frames.length - 1 : 0;
        if (animRef.current) { cancelAnimationFrame(animRef.current.raf); animRef.current = null; }
        var idx = frameIdxRef.current;
        if (idx === target && !loop) { drawFrame(idx); return; }
        drawFrame(idx);
        var rec = { raf: 0, dir: dir, target: target, idx: idx, lastTs: null, accum: 0, loop: !!loop };
        function tick(ts) {
          if (rec.lastTs == null) rec.lastTs = ts;
          rec.accum += ts - rec.lastTs;
          rec.lastTs = ts;
          while (true) {
            var dur = (frames[rec.idx].durationMs || 60) / speedRef.current;
            if (rec.accum < dur) break;
            rec.accum -= dur;
            rec.idx += rec.dir;
            if (rec.dir > 0 && rec.idx > rec.target) {
              if (rec.loop) rec.idx = 0;
              else { rec.idx = rec.target; drawFrame(rec.idx); animRef.current = null; return; }
            } else if (rec.dir < 0 && rec.idx < rec.target) {
              if (rec.loop) rec.idx = frames.length - 1;
              else { rec.idx = rec.target; drawFrame(rec.idx); animRef.current = null; return; }
            }
            drawFrame(rec.idx);
          }
          rec.raf = requestAnimationFrame(tick);
        }
        rec.raf = requestAnimationFrame(tick);
        animRef.current = rec;
      }

      React.useEffect(function () {
        if (yLoadedRef.current) return;
        yLoadedRef.current = true;
        var v = parseInt(lsGet('anon-pet:y'), 10);
        if (!isNaN(v) && v >= 0) setY(v);
      }, []);

      React.useEffect(function () {
        var cancelled = false;
        async function load() {
          setLoadError(null);
          setReady(false);
          var old = framesRef.current;
          if (old) { for (var j = 0; j < old.length; j++) { try { old[j].bitmap.close(); } catch (e) {} } framesRef.current = null; }
          var resp = await fetch('/anon-pet/animation.gif');
          if (resp.status === 404 || resp.status === 503) throw new Error('未找到动图，右键上传一张 GIF');
          if (!resp.ok) throw new Error('动图加载失败 (' + resp.status + ')');
          var buf = await resp.arrayBuffer();
          var decoder = new ImageDecoder({ data: buf, type: 'image/gif' });
          await decoder.tracks.ready;
          var track = decoder.tracks.selectedTrack;
          if (!track && decoder.tracks.length > 0) track = decoder.tracks[0];
          var n = track ? track.frameCount : 0;
          var frames = [];
          for (var i = 0; i < n; i++) {
            var out = await decoder.decode({ frameIndex: i });
            var bmp = await createImageBitmap(out.image);
            var durMs = out.image.duration ? out.image.duration / 1000 : 60;
            out.image.close();
            frames.push({ bitmap: bmp, durationMs: durMs });
          }
          decoder.close();
          if (cancelled) return;
          framesRef.current = frames;
          setReady(true);
        }
        load().catch(function (e) { if (!cancelled) setLoadError(e && e.message ? e.message : String(e)); });
        return function () { cancelled = true; };
      }, [loadTick]);

      React.useEffect(function () { if (ready) drawFrame(0); }, [ready]);

      React.useEffect(function () {
        var disposed = false;
        async function refresh() {
          try {
            var resp = await fetch('/anon-pet/balance');
            var data = await resp.json();
            if (!disposed) setBalance(data && data.is_available ? { data: data, at: Date.now() } : { error: data && data.error ? data.error : '未知错误' });
          } catch (e) {
            if (!disposed) setBalance({ error: e && e.message ? e.message : String(e) });
          }
        }
        refresh();
        var iv = setInterval(refresh, 5 * 60 * 1000);
        return function () { disposed = true; clearInterval(iv); };
      }, []);

      React.useEffect(function () {
        return function () {
          if (animRef.current) cancelAnimationFrame(animRef.current.raf);
          var frames = framesRef.current;
          if (frames) { for (var i = 0; i < frames.length; i++) { try { frames[i].bitmap.close(); } catch (e) {} } }
        };
      }, []);

      React.useEffect(function () {
        var el = containerRef.current;
        if (!el) return;
        var handler = function (e) {
          e.preventDefault();
          setSize(function (prev) { return clampSize(prev + (e.deltaY < 0 ? 14 : -14)); });
        };
        el.addEventListener('wheel', handler, { passive: false });
        return function () { el.removeEventListener('wheel', handler); };
      }, []);

      React.useEffect(function () { lsSet('anon-pet:size', String(size)); }, [size]);
      React.useEffect(function () { lsSet('anon-pet:speed', String(speed)); }, [speed]);
      React.useEffect(function () { lsSet('anon-pet:loop', loopMode ? '1' : '0'); }, [loopMode]);
      React.useEffect(function () { lsSet('anon-pet:side', side === 'left' ? 'left' : 'right'); }, [side]);
      React.useEffect(function () { if (y != null) lsSet('anon-pet:y', String(Math.round(y))); }, [y]);

      var settledX = side === 'left' ? MARGIN : window.innerWidth - size - MARGIN;
      var settledTop = y == null ? window.innerHeight - size - MARGIN : y;

      function onPointerDown(e) {
        if (e.button !== 0) return;
        if (!ready) return;
        e.preventDefault();
        if (containerRef.current && containerRef.current.setPointerCapture) {
          try { containerRef.current.setPointerCapture(e.pointerId); } catch (err) {}
        }
        var startX = dragRef.current ? dragRef.current.x : settledX;
        var startY = dragRef.current ? dragRef.current.y : settledTop;
        dragRef.current = { pointerId: e.pointerId, offsetX: e.clientX - startX, offsetY: e.clientY - startY, x: startX, y: startY };
        setDragPos({ x: startX, y: startY });
      }
      function onPointerMove(e) {
        var d = dragRef.current;
        if (!d || e.pointerId !== d.pointerId) return;
        d.x = e.clientX - d.offsetX;
        d.y = e.clientY - d.offsetY;
        setDragPos({ x: d.x, y: d.y });
      }
      function onPointerUp(e) {
        var d = dragRef.current;
        if (!d || e.pointerId !== d.pointerId) return;
        dragRef.current = null;
        var cx = d.x + size / 2;
        var maxY = window.innerHeight - size - MARGIN;
        setSide(cx < window.innerWidth / 2 ? 'left' : 'right');
        setY(Math.max(MARGIN, Math.min(d.y, maxY)));
        setDragPos(null);
      }

      function onEnter() { setHovered(true); play(1, loopMode); }
      function onLeave() { setHovered(false); play(-1, false); }

      function onContextMenu(e) {
        e.preventDefault();
        var mx = e.clientX, my = e.clientY;
        if (mx + 210 > window.innerWidth - 4) mx = window.innerWidth - 214;
        if (my + 200 > window.innerHeight - 4) my = window.innerHeight - 204;
        mx = Math.max(4, mx);
        my = Math.max(4, my);
        setMenuPos({ x: mx, y: my });
        setMenuOpen(true);
      }
      function onSpeedChange(e) { setSpeed(clampSpeed(parseFloat(e.target.value))); }
      function onLoopChange(e) { setLoopMode(e.target.checked); }
      function onResetPos() { setSide('right'); setY(null); setMenuOpen(false); }
      function onUploadClick() { if (fileInputRef.current) fileInputRef.current.click(); }
      function onFileChange(e) {
        var file = e.target.files && e.target.files[0];
        e.target.value = '';
        if (!file) return;
        setMenuOpen(false);
        fetch('/anon-pet/upload', { method: 'POST', body: file })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (data && data.ok) { setLoadTick(function (t) { return t + 1; }); }
            else { setLoadError('上传失败：' + (data && data.error ? data.error : '未知')); }
          })
          .catch(function (err) { setLoadError('上传失败：' + (err && err.message ? err.message : String(err))); });
      }

      var isLeft = dragPos ? (dragPos.x + size / 2 < window.innerWidth / 2) : (side === 'left');
      var leftPx = dragPos ? dragPos.x : (side === 'left' ? MARGIN : window.innerWidth - size - MARGIN);
      var topPx = dragPos ? dragPos.y : settledTop;

      var panel = null;
      if (hovered) {
        var inner = null;
        var b = balance && balance.data && balance.data.is_available && balance.data.balance_infos && balance.data.balance_infos[0];
        if (b) {
          var cur = b.currency === 'CNY' ? '¥' : (b.currency === 'USD' ? '$' : (b.currency + ' '));
          var time = balance.at ? new Date(balance.at).toLocaleTimeString() : '';
          inner = React.createElement('div', null,
            React.createElement('div', { style: { fontWeight: 600, marginBottom: 4 } }, 'DeepSeek 余额'),
            React.createElement('div', { style: { fontSize: 16, fontWeight: 700 } }, cur + b.total_balance),
            React.createElement('div', { style: { opacity: 0.72, fontSize: 12, marginTop: 3 } }, '充值 ' + b.topped_up_balance + ' · 赠送 ' + b.granted_balance),
            React.createElement('div', { style: { opacity: 0.5, fontSize: 11, marginTop: 2 } }, time ? ('更新 ' + time) : '')
          );
        } else if (balance && balance.error) {
          inner = React.createElement('div', { style: { opacity: 0.85 } }, '余额获取失败：' + balance.error);
        } else {
          inner = React.createElement('div', { style: { opacity: 0.7 } }, '加载余额中…');
        }
        panel = React.createElement('div', {
          style: {
            position: 'absolute', bottom: size + 12, left: isLeft ? 0 : 'auto', right: isLeft ? 'auto' : 0,
            background: 'rgba(24,26,34,0.96)', color: '#fff', padding: '10px 13px', borderRadius: 10, fontSize: 13, lineHeight: 1.45,
            boxShadow: '0 8px 28px rgba(0,0,0,0.4)', maxWidth: 240, pointerEvents: 'none', zIndex: 5,
          },
        }, inner);
      }

      var menu = null;
      if (menuOpen) {
        var menuBtnStyle = {
          display: 'block', width: '100%', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff',
          padding: '7px 10px', borderRadius: 6, fontSize: 13, cursor: 'pointer', marginTop: 6, textAlign: 'left',
        };
        menu = React.createElement('div', {
          style: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 3000, background: 'transparent' },
          onClick: function () { setMenuOpen(false); },
          onContextMenu: function (e) { e.preventDefault(); setMenuOpen(false); },
        },
          React.createElement('div', {
            style: {
              position: 'fixed', top: menuPos.y, left: menuPos.x,
              background: 'rgba(24,26,34,0.97)', color: '#fff', padding: 10, borderRadius: 10,
              fontSize: 13, minWidth: 190, boxShadow: '0 8px 28px rgba(0,0,0,0.4)', zIndex: 3001,
            },
            onClick: function (e) { e.stopPropagation(); },
          },
            React.createElement('div', { style: { marginBottom: 2, opacity: 0.9 } }, '播放速度 ' + speed.toFixed(2) + 'x'),
            React.createElement('input', { type: 'range', min: 0.25, max: 3, step: 0.25, value: speed, onChange: onSpeedChange, style: { width: '100%', margin: '4px 0 6px' } }),
            React.createElement('label', { style: { display: 'flex', alignItems: 'center', gap: 6, margin: '2px 0 6px', cursor: 'pointer' } },
              React.createElement('input', { type: 'checkbox', checked: loopMode, onChange: onLoopChange }),
              '循环播放'
            ),
            React.createElement('button', { onClick: onUploadClick, style: menuBtnStyle }, '上传图片…'),
            React.createElement('button', { onClick: onResetPos, style: menuBtnStyle }, '重置位置')
          )
        );
      }

      return React.createElement(React.Fragment, null,
        React.createElement('div', {
          ref: containerRef,
          style: {
            position: 'fixed', top: Math.round(topPx) + 'px', left: Math.round(leftPx) + 'px',
            width: size + 'px', height: size + 'px', pointerEvents: 'auto', cursor: 'grab', zIndex: 2000, touchAction: 'none',
          },
          onPointerDown: onPointerDown, onPointerMove: onPointerMove, onPointerUp: onPointerUp, onPointerCancel: onPointerUp,
          onMouseEnter: onEnter, onMouseLeave: onLeave, onContextMenu: onContextMenu,
        },
          React.createElement('canvas', {
            ref: canvasRef,
            style: { width: size + 'px', height: size + 'px', display: 'block', borderRadius: 6, transform: isLeft ? 'scaleX(-1)' : 'none' },
          }),
          panel,
          loadError ? React.createElement('div', { style: { position: 'absolute', bottom: size + 10, left: '50%', transform: 'translateX(-50%)', background: 'rgba(40,20,20,0.95)', color: '#ff9a9a', padding: '8px 12px', borderRadius: 8, fontSize: 12, lineHeight: 1.5, maxWidth: 240, textAlign: 'center', boxShadow: '0 6px 20px rgba(0,0,0,0.35)', zIndex: 6 } }, '加载失败：' + loadError) : null
        ),
        menu,
        React.createElement('input', { ref: fileInputRef, type: 'file', accept: 'image/gif', style: { display: 'none' }, onChange: onFileChange })
      );
    }

    function apply(ctx) {
      var slots = ctx.get('slots');
      if (slots === undefined) return;
      slots.inject('shell.overlay', function () {
        return slots.register(
          { name: 'shell.overlay', id: 'anon-pet', order: 100 },
          function () { return React.createElement(AnonPet, null); },
        );
      });
    }

    exports.apply = apply;
    exports.inject = [];
    return module.exports;
  }
});
