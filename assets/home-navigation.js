// Match native handoff semantics; CSS Y is the inverse of AppKit's unflipped Y.
(() => {
  const root = document.getElementById('hero-demo');
  const home = root.querySelector('.home-view');
  const page = root.querySelector('.preview-page');
  const dock = root.querySelector('.demo-topbar');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let mode = 'home', animations = [], raf = 0, generation = 0;
  const height = () => root.clientHeight;
  const dockHeight = () => dock.offsetHeight;
  const y = el => new DOMMatrixReadOnly(getComputedStyle(el).transform).m42;
  const smooth = p => p*p*(3-2*p);
  // Keep the dock mask on the animation timeline. Reading the moving homepage
  // and writing clip-path on every frame forces the browser back to JS.
  function easingAt(progress) {
    let low=0, high=1;
    for(let i=0;i<12;i++) {
      const t=(low+high)/2, x=3*.33*t*(1-t)*(1-t)+3*.67*t*t*(1-t)+t*t*t;
      if(x<progress)low=t;else high=t;
    }
    const t=(low+high)/2;
    return t*t*(3-2*t);
  }
  function dockMask(homeY,d) {
    return `inset(0 0 ${Math.max(0,d-Math.min(d,Math.max(0,homeY)))}px 0)`;
  }
  function label(next) { mode = next; root.dataset.homeState = next; }
  function stop() { ++generation; cancelAnimationFrame(raf); raf=0; animations.forEach(a=>a.cancel()); animations=[]; }
  function settleHome() {
    stop(); label('home'); root.classList.remove('browsing','returning');
    home.style.transform='translateY(0px)'; page.style.transform='translateY(0px)';
    dock.style.transform='translateY(0px)'; dock.style.clipPath=''; page.style.top='0px';
    home.inert=false; page.inert=true; dock.inert=true; page.setAttribute('aria-hidden','true');
  }
  function settlePage() {
    stop(); label('browsing'); root.classList.add('browsing'); root.classList.remove('returning');
    home.style.transform='translateY('+height()+'px)'; page.style.transform='translateY(0px)';
    dock.style.transform='translateY(0px)'; dock.style.clipPath=''; page.style.top=dockHeight()+'px';
    home.inert=true; page.inert=false; dock.inert=false; page.removeAttribute('aria-hidden');
  }
  function animateReturn(reverse=false) {
    const h=height(),d=dockHeight(),fromHome=reverse?y(home):h,fromPage=reverse?y(page):0;
    stop(); const token=generation;
    root.classList.add('browsing','returning'); label(reverse?'reversing':'returning');
    home.inert=false; page.inert=true; dock.inert=false;
    if(reverse)page.style.top=d+'px'; dock.style.transform='translateY(0px)';
    dock.style.clipPath=dockMask(fromHome,d);
    const options={duration:320,easing:'cubic-bezier(.33,0,.67,1)',fill:'both'};
    animations=[home.animate([{transform:`translateY(${fromHome}px)`},{transform:`translateY(${reverse?h:0}px)`}],options),page.animate([{transform:`translateY(${fromPage}px)`},{transform:`translateY(${reverse?0:-h}px)`}],options)];
    const maskFrames=Array.from({length:65},(_,i)=>{
      const offset=i/64,homeY=fromHome+((reverse?h:0)-fromHome)*easingAt(offset);
      return {offset,clipPath:dockMask(homeY,d)};
    });
    animations.push(dock.animate(maskFrames,{duration:320,easing:'linear',fill:'both'}));
    Promise.all(animations.map(a=>a.finished)).then(()=>{if(token===generation)(reverse?settlePage:settleHome)();}).catch(()=>{});
  }
  function open() {
    if(mode==='browsing')return;
    if(motion.matches){settlePage();return;}
    if(mode==='returning'||mode==='reversing'){animateReturn(true);return;}
    if(mode==='opening')return;
    stop(); const token=generation,started=performance.now(),d=dockHeight();
    label('opening');root.classList.add('browsing');root.classList.remove('returning');
    home.inert=true;page.inert=false;dock.inert=false;page.removeAttribute('aria-hidden');
    home.style.transform='translateY('+height()+'px)';page.style.transform='translateY(0px)';
    function tick(now){if(token!==generation)return;const p=Math.min(1,(now-started)/320),inset=d*smooth(p);dock.style.transform=`translateY(${inset-d}px)`;page.style.top=inset+'px';if(p<1)raf=requestAnimationFrame(tick);else settlePage();}
    tick(started);
  }
  function returnHome() {
    if(mode==='home'||mode==='returning')return;
    if(motion.matches){settleHome();return;}
    animateReturn(false);
  }
  function resize(){root.style.setProperty('--home-search-top',height()*.18+'px');if(mode==='returning')settleHome();else if(mode!=='home')settlePage();}
  new ResizeObserver(resize).observe(root);
  motion.addEventListener('change',()=>mode==='returning'?settleHome():mode==='home'?settleHome():settlePage());
  document.addEventListener('visibilitychange',()=>{if(document.hidden){if(mode==='returning')settleHome();else if(mode==='returning')settleHome();else if(mode!=='home')settlePage();}});
  window.heroNavigation={open,returnHome};resize();settleHome();
})();
