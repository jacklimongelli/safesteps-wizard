/**
 * Safe Steps Flipbook
 * Usage: <div class="flipbook"
 *             data-folder="demo plan slides/demo house fire plan"
 *             data-count="38"
 *             data-label="House Fire Plan">  ← optional
 *        </div>
 *
 * Requires: flipbook.css and spiral.png in the same directory as index.html
 * Slides must be named: slide-01.jpg, slide-02.jpg, etc.
 */
(function () {
  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function buildFlipbook(container) {
    var folder = container.getAttribute('data-folder');
    var count  = parseInt(container.getAttribute('data-count'), 10);
    var label  = container.getAttribute('data-label') || '';

    if (!folder || !count) return;

    // Encode each path segment separately to handle spaces
    var encodedFolder = folder.split('/').map(encodeURIComponent).join('/');

    function src(n) {
      return encodedFolder + '/slide-' + pad(n) + '.jpg';
    }

    // Build HTML
    var dots = '';
    for (var i = 0; i < count; i++) {
      dots += '<div class="flipbook-dot" data-index="' + i + '"></div>';
    }

    container.innerHTML =
      '<div class="flipbook-wrap">' +
        '<div class="flipbook-top">' +
          '<span class="flipbook-brand">' + label + '</span>' +
          '<div class="flipbook-spiral"><img src="spiral.png" alt=""></div>' +
        '</div>' +
        '<div class="flipbook-scene">' +
          '<div class="flipbook-page" id="fb-page-' + container.id + '">' +
            '<img id="fb-img-' + container.id + '" src="" alt="Slide">' +
          '</div>' +
        '</div>' +
        '<div class="flipbook-nav">' +
          '<button class="flipbook-btn" id="fb-prev-' + container.id + '">&#8592;</button>' +
          '<div class="flipbook-center">' +
            '<div class="flipbook-dots" id="fb-dots-' + container.id + '">' + dots + '</div>' +
            '<div class="flipbook-label" id="fb-label-' + container.id + '">1 / ' + count + '</div>' +
          '</div>' +
          '<button class="flipbook-btn" id="fb-next-' + container.id + '">&#8594;</button>' +
        '</div>' +
      '</div>';

    var pageEl  = document.getElementById('fb-page-'  + container.id);
    var imgEl   = document.getElementById('fb-img-'   + container.id);
    var prevBtn = document.getElementById('fb-prev-'  + container.id);
    var nextBtn = document.getElementById('fb-next-'  + container.id);
    var dotsEl  = document.getElementById('fb-dots-'  + container.id);
    var labelEl = document.getElementById('fb-label-' + container.id);
    var dotEls  = dotsEl.querySelectorAll('.flipbook-dot');

    var current = 0;
    var animating = false;

    function updateUI() {
      prevBtn.disabled = current === 0;
      nextBtn.disabled = current === count - 1;
      dotEls.forEach(function(d, i) {
        d.classList.toggle('active', i === current);
      });
      labelEl.textContent = (current + 1) + ' / ' + count;
    }

    function goTo(next) {
      if (animating || next === current || next < 0 || next >= count) return;
      animating = true;

      var out = document.createElement('div');
      out.className = 'flipbook-page';
      out.innerHTML = '<img src="' + src(current + 1) + '" style="width:100%;height:100%;object-fit:contain;">';
      out.style.zIndex = 2;
      pageEl.parentElement.appendChild(out);

      imgEl.src = src(next + 1);
      pageEl.style.zIndex = 1;

      requestAnimationFrame(function() {
        out.classList.add('flipbook-flipping-out');
        setTimeout(function() {
          pageEl.classList.add('flipbook-flipping-in');
        }, 160);
      });

      out.addEventListener('animationend', function() { out.remove(); });
      pageEl.addEventListener('animationend', function() {
        pageEl.classList.remove('flipbook-flipping-in');
        animating = false;
        current = next;
        updateUI();
        // Preload next
        if (current < count - 1) { new Image().src = src(current + 2); }
      }, { once: true });
    }

    prevBtn.addEventListener('click', function() { goTo(current - 1); });
    nextBtn.addEventListener('click', function() { goTo(current + 1); });

    dotEls.forEach(function(d) {
      d.addEventListener('click', function() {
        goTo(parseInt(d.getAttribute('data-index'), 10));
      });
    });

    // Keyboard nav (only when focused inside this flipbook)
    container.setAttribute('tabindex', '0');
    container.addEventListener('keydown', function(e) {
      if (e.key === 'ArrowRight') goTo(current + 1);
      if (e.key === 'ArrowLeft')  goTo(current - 1);
    });

    // Load first slide
    imgEl.src = src(1);
    updateUI();
  }

  // Auto-init all .flipbook elements
  // Assign IDs if missing
  function init() {
    var containers = document.querySelectorAll('.flipbook');
    containers.forEach(function(c, i) {
      if (!c.id) c.id = 'flipbook-' + i;
      buildFlipbook(c);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
