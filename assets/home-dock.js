// Homepage wave adapted from the current client HomeDockScript. Resting centers keep the pointer stable.
function enableHomeBookmarkMagnification(grid) {
  const tiles = [...grid.querySelectorAll('.home-bookmark')];
  const icons = tiles.map(t => t.querySelector('.icon-tile'));
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const amplitude = .65;
  const radiusInPitches = 100 / 29;
  const response = .24;
  let iconSize = 52;
  let rows = [], centers = [], scales = tiles.map(() => 1);
  let pointer = null, frame = 0, previous = 0, dirty = true;
  const home = grid.closest('.home-view');
  let bounds;
  const transitions = new Set();
  function measure() {
    dirty = false;
    const rect = grid.getBoundingClientRect();
    bounds = home.getBoundingClientRect();
    iconSize = icons[0].offsetWidth;
    rows = [];
    centers = tiles.map((tile, i) => {
      const c = {x: rect.left + tile.offsetLeft + tile.offsetWidth / 2,
                 y: rect.top + tile.offsetTop};
      let row = rows.find(r => Math.abs(r.y - c.y) < 2);
      if (!row) rows.push(row = {y: c.y, height: tile.offsetHeight, indices: []});
      row.indices.push(i); return c;
    });
  }
  function request() {
    if(document.documentElement.classList.contains('page-scrolling'))return;
    if (!frame) frame = requestAnimationFrame(tick);
  }
  function tick(now) {
    frame = 0;
    if (dirty || transitions.size) measure();
    const dt = previous ? Math.min((now-previous)/16.6667, 3) : 1;
    previous = now;
    const blend = 1-Math.pow(1-response, dt);
    const active = pointer ? rows.find((r,j) => pointer.y >= r.y-iconSize*amplitude-4 &&
      pointer.y < Math.min(rows[j+1] ? rows[j+1].y-iconSize*amplitude-4 : Infinity,
        r.y+r.height+8)) : null;
    let moving = false;
    rows.forEach(row => {
      const ids = row.indices;
      const pitch = ids.length > 1 ? centers[ids[1]].x-centers[ids[0]].x : 100;
      // Resting coordinates prevent the moving icons from feeding back into the wave.
      const weights = ids.map(i => {
        const u = pointer && active === row && !motion.matches
          ? Math.abs(centers[i].x-pointer.x)/(pitch*radiusInPitches) : 1;
        return Math.pow(Math.max(0,1-u),2);
      });
      const room = Math.max(0, 2*Math.min(centers[ids[0]].x-bounds.left-iconSize/2-12,
          bounds.right-12-iconSize/2-centers[ids[ids.length-1]].x));
      const requestedGrowth = iconSize*amplitude*weights.reduce((a,b)=>a+b,0);
      const fit = requestedGrowth > 0 ? Math.min(1,room/requestedGrowth) : 1;
      ids.forEach((i,j) => {
        const target = 1+amplitude*weights[j]*fit;
        scales[i] = motion.matches ? 1 : scales[i]+(target-scales[i])*blend;
        if(Math.abs(scales[i]-target)<.0001) scales[i]=target; else moving=true;
      });
      // A resize can reduce the available width while the old wave is still settling.
      const total = ids.reduce((sum,i)=>sum+iconSize*(scales[i]-1),0);
      if(total>room) ids.forEach(i=>{scales[i]=1+(scales[i]-1)*room/total;});
      const growth=ids.map(i=>iconSize*(scales[i]-1));
      let prefix=-growth.reduce((a,b)=>a+b,0)/2;
      ids.forEach((i,j)=>{
        const shift=prefix+growth[j]/2;
        tiles[i].style.transform=Math.abs(shift)<.0001?'':'translate3d('+shift+'px,0,0)';
        icons[i].style.transform=Math.abs(scales[i]-1)<.0001?'':'scale('+scales[i]+')';
        tiles[i].dataset.scale = scales[i].toFixed(4);
        prefix+=growth[j];
      });
    });
    if(moving) request(); else previous=0;
  }
  function locate(e) {
    // WebKit may re-hit-test a stationary pointer while the page scrolls.
    if(document.documentElement.classList.contains('page-scrolling'))return;
    pointer={x:e.clientX,y:e.clientY}; request();
  }
  function reset() {
    cancelAnimationFrame(frame); frame=0; previous=0; pointer=null; scales.fill(1);
    tiles.forEach((t,i)=>{t.style.transform=''; icons[i].style.transform='';t.dataset.scale='1';});
  }
  tiles.forEach((tile,i)=>{
    tile.addEventListener('focus',()=>{measure();pointer={x:centers[i].x,y:centers[i].y+iconSize/2};request();});
    tile.addEventListener('blur',()=>{pointer=null;request();});
  });
  grid.addEventListener('pointerenter',e=>{dirty=true;locate(e);});
  grid.addEventListener('pointermove',locate);
  grid.addEventListener('pointerleave',()=>{if(!pointer&&scales.every(scale=>scale===1))return;pointer=null;request();});
  grid.addEventListener('pointercancel',reset);
  window.addEventListener('blur',reset);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)reset();});
  motion.addEventListener('change',reset);
  // Scrolling moves the dock beneath a stationary pointer. End the hover wave
  // immediately instead of measuring and redrawing it on every scroll frame.
  const invalidate=()=>{
    dirty=true;
    if(pointer || scales.some(scale=>Math.abs(scale-1)>.0001)) request();
  };
  // Entrance/collapse transitions move the cached coordinate space without a resize.
  for(let ancestor=grid.parentElement;ancestor;ancestor=ancestor.parentElement){
    ancestor.addEventListener('transitionrun',e=>{
      if(e.target===ancestor && e.propertyName==='transform'){transitions.add(ancestor);invalidate();}
    });
    const end=e=>{if(e.target===ancestor && e.propertyName==='transform'){transitions.delete(ancestor);invalidate();}};
    ancestor.addEventListener('transitionend',end);
    ancestor.addEventListener('transitioncancel',end);
  }
  window.addEventListener('resize',invalidate);
  window.addEventListener('page-scroll-start',()=>{dirty=true;if(frame || pointer || scales.some(scale=>scale!==1))reset();});
  window.addEventListener('scroll',()=>{dirty=true;if(pointer || scales.some(scale=>Math.abs(scale-1)>.0001)) reset();},{capture:true,passive:true});
  new ResizeObserver(invalidate).observe(grid);
  document.fonts.ready.then(invalidate);
  measure();
}
document.querySelectorAll('.home-bookmarks').forEach(enableHomeBookmarkMagnification);
