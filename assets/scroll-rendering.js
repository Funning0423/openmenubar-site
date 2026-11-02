// Keep the live glass appearance at rest. During document scrolling its small
// blur cannot be inspected, so avoid resampling the page behind it each frame.
(() => {
  const root = document.documentElement;
  const hero = document.querySelector('.hero-stage');
  let scrolling = false, scrollEndTimer = 0;
  function finishScroll() {
    clearTimeout(scrollEndTimer);
    if (scrolling) {
      scrolling = false;
      root.classList.remove('page-scrolling');
      window.dispatchEvent(new Event('page-scroll-end'));
    }
  }
  function beginScroll() {
    if (!scrolling) {
      scrolling = true;
      root.classList.add('page-scrolling');
      window.dispatchEvent(new Event('page-scroll-start'));
    }
    clearTimeout(scrollEndTimer);
    scrollEndTimer = setTimeout(finishScroll, 140);
  }
  // Lock hover before the browser scrolls and re-hit-tests a stationary pointer.
  window.addEventListener('wheel', e => { if(e.deltaX || e.deltaY)beginScroll(); }, {passive:true});
  window.addEventListener('touchmove', beginScroll, {passive:true});
  window.addEventListener('scroll', beginScroll, {passive:true});
  if (hero) new IntersectionObserver(entries => {
    root.classList.toggle('hero-offscreen', !entries[0].isIntersecting);
  }).observe(hero);
  window.addEventListener('pagehide', finishScroll);
  document.addEventListener('visibilitychange', () => { if (document.hidden) finishScroll(); });
})();
