/**
 * pdf-viewer.js — Safe Steps PDF Slideshow
 * Lazy-initializes when the parent .page becomes active (display:block).
 * Usage: <div class="pdf-slideshow" data-pdf="https://..." data-label="Plan Name"></div>
 */

(function () {
  'use strict';

  // ── Load PDF.js from CDN ──────────────────────────────────────────────────
  var pdfJsReady = false;
  var pdfJsCallbacks = [];

  function loadPdfJs(callback) {
    if (pdfJsReady) { callback(); return; }
    pdfJsCallbacks.push(callback);
    if (pdfJsCallbacks.length > 1) return; // already loading
    var s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload = function () {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      pdfJsReady = true;
      pdfJsCallbacks.forEach(function (cb) { cb(); });
      pdfJsCallbacks = [];
    };
    document.head.appendChild(s);
  }

  // ── Inject CSS ────────────────────────────────────────────────────────────
  var style = document.createElement('style');
  style.textContent = [
    '.pdf-slideshow{position:relative;background:rgba(28,18,8,.06);border:1px solid rgba(28,18,8,.18);overflow:hidden;user-select:none}',
    '.pdf-ss-stage{position:relative;width:100%;overflow:hidden;background:#1C1208;min-height:240px;display:flex;align-items:center;justify-content:center}',
    '.pdf-ss-canvas{display:block;max-width:100%;height:auto;position:absolute;top:0;left:0;transition:transform .3s cubic-bezier(.4,0,.2,1),opacity .3s ease}',
    '.pdf-ss-canvas.enter-right{transform:translateX(100%);opacity:0}',
    '.pdf-ss-canvas.enter-left{transform:translateX(-100%);opacity:0}',
    '.pdf-ss-canvas.visible{transform:translateX(0);opacity:1;position:relative}',
    '.pdf-ss-canvas.exit-left{transform:translateX(-100%);opacity:0}',
    '.pdf-ss-canvas.exit-right{transform:translateX(100%);opacity:0}',
    '.pdf-ss-loading{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#1C1208;z-index:10}',
    '.pdf-ss-loading-inner{text-align:center}',
    '.pdf-ss-spinner{width:28px;height:28px;border:2px solid rgba(195,169,125,.15);border-top-color:#C3A97D;border-radius:50%;animation:pdf-spin .7s linear infinite;margin:0 auto 10px}',
    '@keyframes pdf-spin{to{transform:rotate(360deg)}}',
    '.pdf-ss-loading-txt{font-family:Arial,sans-serif;font-size:.58rem;letter-spacing:.1em;color:rgba(195,169,125,.5)}',
    '.pdf-ss-bar{display:flex;align-items:center;justify-content:space-between;gap:10px;background:#1C1208;padding:9px 14px;border-top:1px solid rgba(195,169,125,.1)}',
    '.pdf-ss-btn{font-family:Arial,sans-serif;font-size:.65rem;letter-spacing:.08em;color:#C3A97D;background:rgba(195,169,125,.1);border:1px solid rgba(195,169,125,.22);padding:7px 16px;cursor:pointer;transition:background .15s;flex-shrink:0;-webkit-tap-highlight-color:transparent}',
    '.pdf-ss-btn:hover:not(:disabled){background:rgba(195,169,125,.2)}',
    '.pdf-ss-btn:disabled{opacity:.28;cursor:default}',
    '.pdf-ss-counter{font-family:Arial,sans-serif;font-size:.58rem;letter-spacing:.09em;color:rgba(195,169,125,.55);flex:1;text-align:center}',
    '.pdf-ss-label{font-family:Arial,sans-serif;font-size:.46rem;letter-spacing:.09em;color:rgba(195,169,125,.3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.pdf-ss-dots{display:flex;gap:5px;align-items:center;justify-content:center;padding:8px 0 2px;background:#1C1208}',
    '.pdf-ss-dot{width:4px;height:4px;border-radius:50%;background:rgba(195,169,125,.18);transition:background .2s,transform .2s;cursor:pointer;flex-shrink:0}',
    '.pdf-ss-dot.active{background:#C3A97D;transform:scale(1.35)}',
    '.pdf-ss-error{padding:28px 20px;text-align:center;background:#1C1208;font-family:Arial,sans-serif;font-size:.7rem;color:rgba(195,169,125,.4);letter-spacing:.05em}',
    '.pdf-ss-hint{font-family:Arial,sans-serif;font-size:.5rem;letter-spacing:.07em;color:rgba(195,169,125,.25);text-align:center;padding:5px 0 7px;background:#1C1208}'
  ].join('');
  document.head.appendChild(style);

  // ── Scaffold placeholder UI immediately ───────────────────────────────────
  function scaffoldViewer(container) {
    container.innerHTML = [
      '<div class="pdf-ss-stage">',
        '<div class="pdf-ss-loading">',
          '<div class="pdf-ss-loading-inner">',
            '<div class="pdf-ss-spinner"></div>',
            '<div class="pdf-ss-loading-txt">LOADING PLAN</div>',
          '</div>',
        '</div>',
      '</div>',
      '<div class="pdf-ss-dots" style="display:none"></div>',
      '<div class="pdf-ss-bar">',
        '<button class="pdf-ss-btn" disabled>← PREV</button>',
        '<div class="pdf-ss-counter" style="flex:1;text-align:center">— / —</div>',
        '<button class="pdf-ss-btn" disabled>NEXT →</button>',
      '</div>'
    ].join('');
  }

  // ── Activate viewer once parent page is visible ───────────────────────────
  function activateViewer(container) {
    if (container._pdfReady) return;
    container._pdfReady = true;

    var pdfUrl = container.getAttribute('data-pdf');
    if (!pdfUrl) {
      container.innerHTML = '<div class="pdf-ss-error">NO PDF SPECIFIED</div>';
      return;
    }

    var stage   = container.querySelector('.pdf-ss-stage');
    var loading = container.querySelector('.pdf-ss-loading');
    var dotsEl  = container.querySelector('.pdf-ss-dots');
    var btns    = container.querySelectorAll('.pdf-ss-btn');
    var prevBtn = btns[0];
    var nextBtn = btns[1];
    var counter = container.querySelector('.pdf-ss-counter');

    var pdfDoc      = null;
    var pageNum     = 1;
    var totalPages  = 0;
    var rendering   = false;
    var pendingPage = null;

    var canvasA = document.createElement('canvas');
    var canvasB = document.createElement('canvas');
    canvasA.className = 'pdf-ss-canvas';
    canvasB.className = 'pdf-ss-canvas';
    var activeCanvas   = canvasA;
    var inactiveCanvas = canvasB;

    function renderPageToCanvas(num, canvas, callback) {
      pdfDoc.getPage(num).then(function (page) {
        var dpr = window.devicePixelRatio || 1;
        var w   = stage.clientWidth || container.clientWidth || 360;
        var vp  = page.getViewport({ scale: 1 });
        var scale  = (w / vp.width) * dpr;
        var scaled = page.getViewport({ scale: scale });
        canvas.width  = scaled.width;
        canvas.height = scaled.height;
        canvas.style.width  = (scaled.width  / dpr) + 'px';
        canvas.style.height = (scaled.height / dpr) + 'px';
        page.render({ canvasContext: canvas.getContext('2d'), viewport: scaled })
          .promise.then(callback);
      });
    }

    function updateUI() {
      counter.textContent = 'SLIDE ' + pageNum + ' / ' + totalPages;
      prevBtn.disabled = pageNum === 1;
      nextBtn.disabled = pageNum === totalPages;
      dotsEl.querySelectorAll('.pdf-ss-dot').forEach(function (d, i) {
        d.classList.toggle('active', i + 1 === pageNum);
      });
    }

    function goTo(newPage, direction) {
      if (rendering || newPage < 1 || newPage > totalPages || newPage === pageNum) return;
      rendering = true;
      var enterClass = direction > 0 ? 'enter-right' : 'enter-left';
      var exitClass  = direction > 0 ? 'exit-left'   : 'exit-right';
      inactiveCanvas.className = 'pdf-ss-canvas ' + enterClass;
      if (!inactiveCanvas.parentNode) stage.appendChild(inactiveCanvas);
      renderPageToCanvas(newPage, inactiveCanvas, function () {
        inactiveCanvas.getBoundingClientRect();
        inactiveCanvas.classList.remove(enterClass);
        inactiveCanvas.classList.add('visible');
        activeCanvas.classList.remove('visible');
        activeCanvas.classList.add(exitClass);
        pageNum = newPage;
        updateUI();
        setTimeout(function () {
          if (activeCanvas.parentNode) activeCanvas.parentNode.removeChild(activeCanvas);
          activeCanvas.className = 'pdf-ss-canvas';
          var tmp = activeCanvas; activeCanvas = inactiveCanvas; inactiveCanvas = tmp;
          rendering = false;
          if (pendingPage !== null) {
            var p = pendingPage; pendingPage = null;
            goTo(p, p > pageNum ? 1 : -1);
          }
        }, 320);
      });
    }

    function showFirst() {
      renderPageToCanvas(1, activeCanvas, function () {
        activeCanvas.className = 'pdf-ss-canvas visible';
        stage.appendChild(activeCanvas);
        stage.style.minHeight = '';
        loading.style.display = 'none';
        rendering = false;
        updateUI();
      });
    }

    function buildDots() {
      if (totalPages > 20) return;
      dotsEl.style.display = 'flex';
      dotsEl.innerHTML = '';
      for (var i = 1; i <= totalPages; i++) {
        (function (n) {
          var dot = document.createElement('div');
          dot.className = 'pdf-ss-dot' + (n === 1 ? ' active' : '');
          dot.addEventListener('click', function () {
            if (rendering) { pendingPage = n; return; }
            goTo(n, n > pageNum ? 1 : -1);
          });
          dotsEl.appendChild(dot);
        })(i);
      }
    }

    prevBtn.addEventListener('click', function () {
      if (rendering) { pendingPage = pageNum - 1; return; }
      goTo(pageNum - 1, -1);
    });
    nextBtn.addEventListener('click', function () {
      if (rendering) { pendingPage = pageNum + 1; return; }
      goTo(pageNum + 1, 1);
    });

    document.addEventListener('keydown', function (e) {
      var parentPage = container.closest ? container.closest('.page') : null;
      if (parentPage && !parentPage.classList.contains('active')) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goTo(pageNum + 1, 1);
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   goTo(pageNum - 1, -1);
    });

    var touchStartX = 0;
    stage.addEventListener('touchstart', function (e) {
      touchStartX = e.touches[0].clientX;
    }, { passive: true });
    stage.addEventListener('touchend', function (e) {
      var dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 40) goTo(dx < 0 ? pageNum + 1 : pageNum - 1, dx < 0 ? 1 : -1);
    }, { passive: true });

    window.pdfjsLib.getDocument(pdfUrl).promise.then(function (pdf) {
      pdfDoc = pdf;
      totalPages = pdf.numPages;
      buildDots();
      showFirst();
    }).catch(function (err) {
      console.error('PDF load error:', err);
      container.innerHTML = '<div class="pdf-ss-error">COULD NOT LOAD PDF — CHECK FILE PATH OR GITHUB URL</div>';
    });
  }

  // ── Watch .page elements for the active class being added ─────────────────
  function watchPages() {
    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        if (m.type === 'attributes' && m.attributeName === 'class') {
          var page = m.target;
          if (page.classList.contains('active')) {
            page.querySelectorAll('.pdf-slideshow').forEach(function (c) {
              loadPdfJs(function () { activateViewer(c); });
            });
          }
        }
      });
    });

    document.querySelectorAll('.page').forEach(function (page) {
      observer.observe(page, { attributes: true });
      // handle any page that's already active on load
      if (page.classList.contains('active')) {
        page.querySelectorAll('.pdf-slideshow').forEach(function (c) {
          loadPdfJs(function () { activateViewer(c); });
        });
      }
    });
  }

  function init() {
    document.querySelectorAll('.pdf-slideshow').forEach(scaffoldViewer);
    watchPages();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
