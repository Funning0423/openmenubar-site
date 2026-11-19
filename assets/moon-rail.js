window.moonPhoto={"url":"https://images-assets.nasa.gov/image/PIA06193/PIA06193~orig.jpg","title":"PIA06193~orig.jpg 8,888×4,544 pixels","backY":1400,"label":"土星与光环","startY":1350,"scrollSpan":99,"endY":1800,"viewportCSS":[3636.3636363636365,2036.3636363636363],"left":-3850,"top":0,"width":8887.9970703125,"height":4543.962890625,"stops":[1350,1386,1400,1423,1459,1495,1532,1568,1605,1641,1677,1714,1750,1777,1800],"originalSize":[8888,4544],"sourcePixelsPerPoint":4.545456043740522,"sha256":"1095bbfe968cbac1a5b905fac02a244ed4686ff04fb3d55ebc1a71a67b387b77","nativeViewportMeanRGBError":0.276,"controls":["dark","dark","dark","dark","dark","dark","dark","dark","dark","dark","dark","dark","dark","dark","dark"]};
window.moonBookmarkSites = {
    home: { name: '主页', label: '回到主页' },
    macbook: {name:'MacBook Air', icon:'apple.png', label:'MacBook Air 书签', title:'MacBook Air - Tech Specs - Apple', tabLabel:'MacBook Air 标签', width:168},
    claude: {name:'Claude', icon:'claude.png', url:'https://claude.ai/'},
    github: {name:'GitHub', icon:'github.png', url:'https://github.com/'},
    youtube: {name:'YouTube', icon:'youtube.png', url:'https://www.youtube.com/'},
    chatgpt: {name:'ChatGPT', icon:'chatgpt.png', url:'https://chatgpt.com/'},
    douyin: {name:'抖音', icon:'douyin.png', url:'https://www.douyin.com/'},
    wiki: { name: 'Wikipedia', icon:'wiki.png', label: '维基百科书签', title: 'Moon - Wikipedia', tabLabel: '维基百科标签', width: 146 }
  };
/* Interactive counterpart of IconTabDockView's bookmark row and tab selection. */
window.mountMoonRail = function mountMoonRail(bar, { navigate, onClose, submitAddress }) {
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const stations = {...window.moonBookmarkSites,
    saturn:{name:window.moonPhoto.label,title:window.moonPhoto.title,tabLabel:window.moonPhoto.label+'标签',icon:'saturn-tab.png',width:168},
    nasa:{name:'NASA',title:"Earth's Moon",tabLabel:'NASA 标签',icon:'earth-tab.png',width:121}
  };
  const tabs = new Map();
  const marks = [];
  let active = '', overTab = null, markTarget = null, frame = 0, lastTick = 0, touchLeave;
  let tipTimer, tipOwner = null, skin = '';

  function element(tag, cls, parent) {
    const el = document.createElement(tag);
    el.className = cls;
    parent.append(el);
    return el;
  }
  function button(cls, label, parent) {
    const b = element('button', cls, parent);
    b.type = 'button';
    b.setAttribute('aria-label', label);
    return b;
  }
  function favicon(key, parent) {
    if (key === 'home') {
      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icon.setAttribute('viewBox', '0 0 20 20');
      icon.setAttribute('aria-hidden', 'true');
      const path = document.createElementNS(icon.namespaceURI, 'path');
      path.setAttribute('d', 'M1.5 9.5 10 2.2l8.5 7.3m-2.1-1.6v9.3H12v-5H8v5H3.7V8.1');
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', '1.85');
      path.setAttribute('stroke-linejoin', 'round');
      path.setAttribute('stroke-linecap', 'round');
      icon.append(path);
      parent.append(icon);
      return;
    }
    const im = element('img', 'rail-icon', parent);
    im.alt = '';
    im.draggable = false;
    im.src = 'assets/moon-rail/' + stations[key].icon;
  }

  // The live native glass is sampled separately from the foreground controls.
  // Leave the unmodeled far-right system actions in the underlying original plate.
  const wash = element('div', 'rail-wash', bar);
  wash.setAttribute('aria-hidden','true');
  const photoGlass = element('canvas','rail-photo-glass',bar);
  photoGlass.width=1600;
  photoGlass.height=64;
  photoGlass.setAttribute('aria-hidden','true');
  const optical=photoGlass.getContext('2d');
  const glassStops=window.moonPhoto.stops;
  let glassSamples,documentY=window.moonPhoto.startY;
  function scrollPhoto(y) {
    y=Math.min(glassStops.at(-1),Math.max(glassStops[0],y));
    documentY=y;
    if(!glassSamples) {
      glassSamples=new Image();
      glassSamples.onload=()=>scrollPhoto(documentY);
      glassSamples.src='assets/moon-rail/saturn-glass.webp';
    }
    if(!glassSamples.naturalWidth)return;
    const hi=glassStops.findIndex(stop=>stop>=y);
    const lo=Math.max(0,hi-1);
    const mix=hi<=lo?0:(y-glassStops[lo])/(glassStops[hi]-glassStops[lo]);
    const palette=window.moonPhoto.controls[mix>.5?hi:lo];
    if(bar.dataset.photoControls!==palette){
      bar.dataset.photoControls=palette;
      const actions=new URL(`assets/moon-rail/saturn-actions-${palette}.png`,document.baseURI);
      bar.style.setProperty('--photo-actions',`url("${actions.href}")`);
    }
    // Both samples come from the real unoccluded AppKit material at this image offset.
    // Keep the buttons in place while the browser's actual scroll position advances the texture.
    optical.globalAlpha=1;
    optical.drawImage(glassSamples,0,lo*64,1600,64,0,0,1600,64);
    if(mix>0){
      optical.globalAlpha=mix;
      optical.drawImage(glassSamples,0,hi*64,1600,64,0,0,1600,64);
      optical.globalAlpha=1;
    }
    photoGlass.dataset.documentY=String(y);
  }
  const rail = element('div', 'rail-layout', bar);
  const markViewport = element('div', 'rail-mark-viewport', rail);
  const bookmarks = element('div', 'rail-marks', markViewport);
  bookmarks.setAttribute('role','group');
  bookmarks.setAttribute('aria-label','快捷书签');
  element('i', 'rail-rule', rail).setAttribute('aria-hidden','true');
  const strip = element('div', 'rail-strip', rail);
  strip.setAttribute('role','group');
  strip.setAttribute('aria-label','打开的标签页');
  const track = element('div', 'rail-track', strip);
  const capsule = element('div', 'rail-selection', track);
  capsule.setAttribute('aria-hidden','true');
  const address = element('form', 'rail-address', rail);
  address.setAttribute('role','search');
  address.setAttribute('aria-label','新标签的网址');
  const plus = button('rail-plus', '新建标签页，输入网址', address);
  plus.setAttribute('aria-expanded','false');
  const glyph = element('span','rail-plus-glyph',plus);
  glyph.setAttribute('aria-hidden','true');
  const input = element('input','rail-address-input',address);
  input.id = 'moon-tab-address';
  input.type = 'text';
  input.inputMode = 'url';
  input.enterKeyHint = 'go';
  input.autocomplete = 'off';
  input.autocapitalize = 'none';
  input.spellcheck = false;
  input.placeholder = '搜索或输入网址';
  input.setAttribute('aria-label','搜索或输入网址');
  input.hidden = input.disabled = true;
  plus.setAttribute('aria-controls',input.id);
  let editing = false, addressAnimation = 0, addressProgress = 0;
  function sizeAddress(p) {
    addressProgress=p;
    const w = Math.min(218,bar.clientWidth*.4);
    const width=(24+(w-24)*p)+'px';
    address.style.width=width;
    rail.style.setProperty('--action-slot',width);
    address.style.setProperty('--field-ink',Math.max(0,Math.min(1,(p-.3)/.5)));
    address.style.setProperty('--field-fill',Math.round(100*p)+'%');
  }
  function setEditing(open, returnFocus=false) {
    if (editing===open) return;
    cancelAnimationFrame(addressAnimation);
    editing=open;
    const from=addressProgress, target=open?1:0;
    if(open){
      hoverTab(null);
      const available = rail.clientWidth - markViewport.offsetWidth - 13 - Math.min(218,bar.clientWidth*.4) - 12;
      address.classList.toggle('trailing-cancel',track.offsetWidth>available+.5);
      input.value='';
      input.hidden=input.disabled=false;
    } else {
      input.disabled=true;
    }
    address.classList.toggle('is-editing',open);
    plus.setAttribute('aria-expanded',String(open));
    plus.setAttribute('aria-label',open?'取消网址输入':'新建标签页，输入网址');
    if(open) input.focus({preventScroll:true});
    else if(returnFocus) plus.focus({preventScroll:true});
    function finish(){
      addressAnimation=0;
      sizeAddress(target);
      if(!open) {
        input.hidden=true;
        address.classList.remove('trailing-cancel');
      }
      layoutTabs(true);
    }
    if(media.matches){finish();return;}
    const start=performance.now(), delay=open&&from===0?120:0;
    function step(time){
      const t=Math.max(0,Math.min(1,(time-start-delay)/440));
      sizeAddress(from+(target-from)*t*t*(3-2*t));
      if(t<1)addressAnimation=requestAnimationFrame(step);
      else finish();
    }
    addressAnimation=requestAnimationFrame(step);
  }
  let pressingAction=false;
  plus.addEventListener('pointerdown',()=>{pressingAction=true;});
  plus.addEventListener('pointercancel',()=>{pressingAction=false;});
  plus.addEventListener('pointerup',()=>setTimeout(()=>{pressingAction=false;},0));
  plus.addEventListener('click',()=>{pressingAction=false;setEditing(!editing,editing);});
  address.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&editing&&!e.isComposing){
      e.preventDefault();e.stopPropagation();setEditing(false,true);
    }
  });
  address.addEventListener('focusout',e=>{
    if(editing&&!pressingAction&&!input.value.trim()&&!address.contains(e.relatedTarget))setEditing(false);
  });
  address.addEventListener('submit',e=>{
    e.preventDefault();
    const value=input.value.trim();
    if(!editing||!value)return;
    setEditing(false,true);
    submitAddress(value);
  });
  const tip = element('span', 'rail-tip', bar);
  tip.hidden = true;
  tip.setAttribute('aria-hidden','true');

  function hideTip() {
    clearTimeout(tipTimer);
    tipOwner = null;
    tip.hidden = true;
  }
  function scheduleTip(mark) {
    if (tipOwner === mark) return;
    hideTip();
    tipOwner = mark;
    tipTimer = setTimeout(() => {
      if (tipOwner !== mark || !bar.isConnected || bar.closest('[hidden],[inert]')) return;
      const b = bar.getBoundingClientRect(), m = mark.button.getBoundingClientRect();
      const x = ((m.left+m.right)/2-b.left)*bar.offsetWidth/b.width;
      tip.textContent = stations[mark.key].name;
      tip.style.left = Math.max(29, x) + 'px';
      tip.hidden = false;
    }, 1000);
  }
  function tick(time) {
    frame = 0;
    const dt = lastTick ? Math.min(45, time-lastTick) : 1000/60;
    lastTick = time;
    const follow = media.matches ? 1 : 1 - Math.pow(1-.24,dt/(1000/60));
    let moving = false, left = 0;
    for (const [i,mark] of marks.entries()) {
      const distance = markTarget === null ? 100 : Math.abs(markTarget-(12+i*29));
      const target = 1+.65*Math.max(0,1-distance/100)**2;
      mark.scale += (target-mark.scale)*follow;
      if (Math.abs(mark.scale-target)<.002) mark.scale = target;
      else moving = true;
      const pitch = 24*mark.scale, shell = 24*Math.min(mark.scale,1.30);
      mark.button.style.width = pitch+'px';
      mark.button.style.setProperty('--shell',shell+'px');
      mark.button.style.setProperty('--glyph',((mark.key==='home'?17:16)*mark.scale)+'px');
      left += pitch+(i===marks.length-1?0:5);
    }
    bookmarks.style.width = left+'px';
    const restingCount = Math.min(6, marks.length);
    const restingWidth = restingCount*29-5;
    const growth = Math.max(0, left-(marks.length*29-5));
    markViewport.style.width = (restingWidth+growth)+'px';
    if (moving) frame = requestAnimationFrame(tick);
    else lastTick = 0;
  }
  function magnet(x) {
    markTarget = x;
    if (!frame) frame = requestAnimationFrame(tick);
  }
  function nativeX(e) {
    const r = bookmarks.getBoundingClientRect();
    return (e.clientX-r.left)*bookmarks.offsetWidth/r.width;
  }
  for (const [i,key] of Object.keys(window.moonBookmarkSites).entries()) {
    const station = stations[key];
    const b = station.url ? element('a','rail-mark',bookmarks) : button('rail-mark',station.label,bookmarks);
    if (station.url) {
      b.href = station.url;
      b.target = '_blank';
      b.rel = 'noopener noreferrer';
      b.setAttribute('aria-label',station.name+' 书签（在新标签页打开）');
    }
    const shell = element('span','rail-mark-shell',b);
    favicon(key,shell);
    const flash = element('span','rail-flash',shell);
    const mark = { button:b, scale:1, key };
    marks.push(mark);
    b.addEventListener('pointerenter', e => { if(e.pointerType==='mouse') scheduleTip(mark); });
    b.addEventListener('focus', () => { if(b.matches(':focus-visible')) { magnet(12+i*29);scheduleTip(mark); } });
    b.addEventListener('blur', () => { magnet(null);hideTip(); });
    b.addEventListener('pointerdown', e => {
      clearTimeout(touchLeave);
      hideTip();
      magnet(e.pointerType==='touch'?12+i*29:nativeX(e));
      if (!media.matches) flash.animate([{opacity:0},{opacity:.3,offset:.18},{opacity:0}],{duration:200,easing:'ease-in-out'});
    });
    b.addEventListener('click', () => { hideTip();if (!station.url) navigate(key); });
    b.addEventListener('keydown',e=>{
      const direction=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0;
      if(!direction)return;
      e.preventDefault();
      marks[(i+direction+marks.length)%marks.length].button.focus();
    });
  }
  let pointerX=null;
  bookmarks.addEventListener('pointermove', e => {
    if(e.pointerType==='touch')return;
    pointerX=e.clientX;
    magnet(nativeX(e));
  });
  markViewport.addEventListener('scroll',()=>{
    if(pointerX!==null)magnet(nativeX({clientX:pointerX}));
  },{passive:true});
  markViewport.addEventListener('wheel',e=>{
    if(e.deltaX||e.ctrlKey||!e.deltaY)return;
    const unit=e.deltaMode===1?16:e.deltaMode===2?markViewport.clientWidth:1;
    const left=markViewport.scrollLeft+e.deltaY*unit;
    if(left<0&&markViewport.scrollLeft<=0 || left>markViewport.scrollWidth-markViewport.clientWidth&&markViewport.scrollLeft>=markViewport.scrollWidth-markViewport.clientWidth-1)return;
    markViewport.scrollLeft=left;
    e.preventDefault();
  },{passive:false});
  bookmarks.addEventListener('pointerleave', e => { if(e.pointerType!=='touch'){pointerX=null;magnet(null);hideTip();} });
  bookmarks.addEventListener('pointerup', e => { if(e.pointerType==='touch')touchLeave=setTimeout(()=>magnet(null),170); });
  bookmarks.addEventListener('pointercancel', () => { clearTimeout(touchLeave);magnet(null);hideTip(); });

  function layoutTabs(scroll = false) {
    let x = 2, selectedX = 2, selectedW = 0;
    for (const [key,tab] of tabs) {
      const totalWidth = stations[key].width+(key===overTab?22:0);
      const compact = bar.closest('.rail-compact');
      // Keep the close target and the leading favicon together on phones.
      const width = compact ? Math.min(totalWidth,Math.max(72,rail.clientWidth-markViewport.clientWidth-48)) : totalWidth;
      tab.row.style.width = width+'px';
      tab.row.classList.toggle('is-over',key===overTab);
      tab.close.disabled = key!==overTab;
      tab.main.setAttribute('aria-pressed',String(key===active));
      if (key===active) { selectedX=x; selectedW=width; }
      x += width+1;
    }
    track.style.width = (x+1)+'px';
    capsule.style.left = selectedX+'px';
    capsule.style.width = selectedW+'px';
    capsule.style.opacity = selectedW ? 1:0;
    if (scroll && strip.clientWidth) {
      const viewLeft=strip.scrollLeft, viewRight=viewLeft+strip.clientWidth;
      const goal = selectedX<viewLeft ? selectedX-2 : selectedX+selectedW>viewRight ? selectedX+selectedW-strip.clientWidth+2 : viewLeft;
      if(Math.abs(goal-viewLeft)>1) strip.scrollTo({left:goal,behavior:media.matches?'instant':'smooth'});
    }
  }
  function hoverTab(key) {
    if (overTab===key) return;
    overTab=key;
    layoutTabs();
  }
  function closeTab(key) {
    if (!tabs.has(key)) return;
    const order=[...tabs.keys()], index=order.indexOf(key), item=tabs.get(key);
    const focusWasInside=item.row.contains(document.activeElement);
    item.row.remove();
    tabs.delete(key);
    if(overTab===key)overTab=null;
    const next=order[index+1]||order[index-1]||'home';
    if(key===active)active=next;
    layoutTabs();
    onClose(key,active||'home');
    if(focusWasInside) (tabs.get(active)?.main || plus).focus();
  }
  function makeTab(key, inserted) {
    const st=stations[key], row=element('div','rail-tab',track);
    const main=button('rail-tab-main',st.tabLabel,row);
    favicon(key,main);
    const label=element('span','rail-tab-title',main);
    label.textContent=st.title;
    const close=button('rail-close','关闭'+st.name+'标签',row);
    close.textContent='×';
    close.tabIndex=-1;
    close.disabled=true;
    tabs.set(key,{row,main,close});
    main.addEventListener('click',()=>navigate(key));
    close.addEventListener('click',()=>closeTab(key));
    row.addEventListener('pointerenter',e=>{if(e.pointerType!=='touch')hoverTab(key);});
    row.addEventListener('pointerleave',e=>{if(e.pointerType!=='touch')hoverTab(null);});
    row.addEventListener('pointerdown',e=>{if(e.pointerType==='touch')hoverTab(key);});
    row.addEventListener('focusin',()=>{if(main.matches(':focus-visible'))hoverTab(key);});
    row.addEventListener('focusout',e=>{if(!row.contains(e.relatedTarget))hoverTab(null);});
    main.addEventListener('keydown',e=>{
      if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();closeTab(key);return;}
      if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;
      e.preventDefault();
      const order=[...tabs.keys()], delta=e.key==='ArrowRight'?1:-1;
      const next=order[(order.indexOf(key)+delta+order.length)%order.length];
      tabs.get(next).main.focus();navigate(next);
    });
    if(inserted&&!media.matches)row.animate([{opacity:0,transform:'translateX(-9px)'},{opacity:1,transform:'none'}],{duration:220,easing:'ease-out'});
  }
  new ResizeObserver(()=>{
    if (bar.closest('.rail-compact')) {
      const available = Math.max(82,Math.min(rail.clientWidth - 171,rail.clientWidth*.52));
      const wholeIcons = Math.max(1,Math.floor((available+5)/29));
      markViewport.style.setProperty('--mark-viewport-limit',(wholeIcons*29-5)+'px');
    } else {
      markViewport.style.removeProperty('--mark-viewport-limit');
    }
    if(editing)sizeAddress(addressProgress);
    layoutTabs(true);
  }).observe(rail);
  markViewport.style.width=(Math.min(6,marks.length)*29-5)+'px';
  for(const key of ['macbook','nasa','saturn'])makeTab(key,false);
  layoutTabs();
  function update(next,key) {
    if(next!=='home'&&!tabs.has(next))makeTab(next,true);
    const changing=active!==next;
    active=next;
    bar.dataset.tone=next==='nasa'?'dark':next==='saturn'?'saturn':'light';
    if(key&&key!==skin){
      bar.querySelectorAll('.rail-old-wash').forEach(node=>node.remove());
      if(changing && skin && !media.matches) {
        const old=wash.cloneNode(false);
        old.classList.add('rail-old-wash');
        wash.after(old);
        old.animate([{opacity:1},{opacity:0}],{duration:300,easing:'ease-in-out'})
          .finished.then(()=>old.remove()).catch(()=>old.remove());
      }
      skin=key;
      wash.style.backgroundImage='url("assets/moon-rail/bare-'+key+'.webp")';
      bar.style.backgroundImage='url("assets/moon-rail/rest-'+key+'.webp")';
    }
    if(changing){setEditing(false);layoutTabs(true);}
    if(next==='home'){hideTip();magnet(null);hoverTab(null);}
  }
  return {update,scrollPhoto,order:()=>[...tabs.keys()]};
};
