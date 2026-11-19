(() => {
  const features=document.querySelector('#features'), stage=features.querySelector('.moon-stage');
  const viewport=features.querySelector('#native-screen'), trigger=features.querySelector('#menu-trigger');
  const home=stage.querySelector('.moon-home'), page=stage.querySelector('.moon-page');
  const bar=stage.querySelector('.moon-bar'), body=stage.querySelector('.moon-body'), spacer=body.firstElementChild;
  const buttons=features.querySelector('.moon-actions'), original=buttons.querySelector('a'), status=features.querySelector('#moon-status');
  const q=stage.querySelector('#q'), form=q.form, reduced=matchMedia('(prefers-reduced-motion:reduce)');
  const canvas=document.createElement('canvas');canvas.className='moon-art';canvas.width=1600;canvas.height=896;
  canvas.setAttribute('aria-hidden','true');page.insertBefore(canvas,body);
  const ink=canvas.getContext('2d'), loaded=new Map();
  const urls={nasa:'https://science.nasa.gov/moon/',saturn:window.moonPhoto.url,
    macbook:'https://www.apple.com/macbook-air/specs/',wiki:'https://en.wikipedia.org/wiki/Moon'};
  const titles={nasa:'NASA 月面图',saturn:window.moonPhoto.label,macbook:'MacBook Air',wiki:'维基百科 Moon'};
  const routes={nasa:[[0,'nasa'],[198,'nasa-scroll']],saturn:[[0,'saturn-original'],[window.moonPhoto.scrollSpan,'saturn-original']],macbook:[[0,'macbook'],[42,'macbook-middle'],[90,'macbook-scroll']],
    wiki:[[0,'wiki']],reader:[[0,'reader'],[270,'reader-scroll'],[390,'reader-next']]};
  const positions={nasa:198,saturn:0,macbook:0,wiki:0,reader:0};let site='home',reading=false,state=null,version=0,motions=[];
  function source(key){return 'assets/moon/'+key+(key==='saturn-original'?'.jpg':'.webp');}
  function bitmap(key){
    if(!loaded.has(key)){
      const im=new Image(),ready=new Promise((resolve,reject)=>{im.onload=()=>resolve(im);im.onerror=()=>{loaded.delete(key);reject(new Error(key));};});
      im.src=source(key);loaded.set(key,ready);
    }
    return loaded.get(key);
  }
  function hit(parent,label,x,y,w,h,action){
    const b=document.createElement('button');b.className='moon-hit';b.type='button';b.setAttribute('aria-label',label);b.title=label;
    Object.assign(b.style,{left:x+'px',top:y+'px',width:w+'px',height:h+'px'});b.addEventListener('click',action);parent.append(b);
  }
  const feedback=document.createElement('div');
  feedback.className='moon-wallpaper-feedback';
  feedback.setAttribute('aria-hidden','true');
  const feedbackLabel=document.createElement('span');
  feedback.append(feedbackLabel);
  stage.append(feedback);
  home.dataset.wallpaper='original';
  let refreshing=false,hideFeedback=0,lastTap=null,touchStart=null,suppressDoubleClick=0;
  const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  function announceWallpaper(text,phase){
    clearTimeout(hideFeedback);
    feedbackLabel.textContent=text;
    feedback.dataset.phase=phase;
    feedback.dataset.visible='true';
    status.textContent=text;
    hideFeedback=setTimeout(()=>delete feedback.dataset.visible,1800);
  }
  async function refreshWallpaper(){
    if(refreshing||site!=='home'||home.inert||trigger.getAttribute('aria-expanded')!=='true')return;
    refreshing=true;
    const next=home.dataset.wallpaper==='original'?'refreshed':'original';
    announceWallpaper('正在刷新壁纸…','progress');
    try{
      await Promise.all([bitmap(next==='refreshed'?'home-refreshed':'home'),pause(205)]);
      q.value='';
      home.classList.remove('typing');
      home.dataset.wallpaper=next;
      announceWallpaper('在线壁纸已刷新','done');
    } catch {
      announceWallpaper('在线壁纸刷新失败，保留当前壁纸','error');
    } finally {
      refreshing=false;
    }
  }
  function blankHome(event){
    return event.target instanceof Element&&!event.target.closest('form, button, a, input, textarea, [contenteditable="true"]');
  }
  home.addEventListener('dblclick',event=>{
    if(event.button!==0||!blankHome(event)||performance.now()<suppressDoubleClick)return;
    event.preventDefault();refreshWallpaper();
  });
  home.addEventListener('keydown',event=>{
    if(event.target===home&&['Enter',' '].includes(event.key)){
      event.preventDefault();if(!event.repeat)refreshWallpaper();
    }
  });
  home.addEventListener('pointerdown',event=>{
    touchStart=null;
    if(event.pointerType==='mouse'||!event.isPrimary||!blankHome(event)){lastTap=null;return;}
    touchStart={id:event.pointerId,x:event.clientX,y:event.clientY,at:performance.now()};
  });
  home.addEventListener('pointercancel',()=>{lastTap=null;touchStart=null;});
  home.addEventListener('pointerup',event=>{
    const start=touchStart;touchStart=null;
    if(!start||event.pointerId!==start.id||!blankHome(event))return;
    const x=event.clientX,y=event.clientY,now=performance.now();
    if(now-start.at>350||Math.hypot(x-start.x,y-start.y)>12){lastTap=null;return;}
    if(lastTap&&now-lastTap.at<=400&&Math.hypot(x-lastTap.x,y-lastTap.y)<=18){
      lastTap=null;suppressDoubleClick=now+550;refreshWallpaper();
    } else {lastTap={at:now,x,y};}
  });
  const bookmarks=home.querySelector('nav');
  Object.entries(window.moonBookmarkSites).filter(([key])=>key!=='home').forEach(([key,st],i)=>{
    const x=i<6?110.015625+i*99.328125:358.328125, y=i<6?176.390625:296.390625;
    if (!st.url) {
      hit(bookmarks,key==='macbook'?'打开 MacBook Air':'打开维基百科 Moon',x,y,83.33,76,()=>show(key));
      return;
    }
    const link=document.createElement('a');
    link.className='moon-hit';link.href=st.url;link.target='_blank';link.rel='noopener noreferrer';
    link.setAttribute('aria-label','打开 '+st.name+'（在新标签页打开）');
    Object.assign(link.style,{left:x+'px',top:y+'px',width:'83.33px',height:'76px'});
    bookmarks.append(link);
  });
  const rail = window.mountMoonRail(bar, {
    navigate:show,
    submitAddress:openAddress,
    onClose(key,next) {
      positions[key]=0;
      if(key==='wiki'){positions.reader=0;reading=false;}
      if(site===key)show(next,{forget:key});
    }
  });
  function route(){return site==='wiki'&&reading?'reader':site;}
  function maxScroll(){return state?state.at(-1)[0]:0;}
  function draw(){
    if(site==='home'||!state)return;
    const y=Math.max(0,Math.min(maxScroll(),body.scrollTop));positions[route()]=y;
    const nativePhotoPixels=Math.floor(800*window.moonPhoto.sourcePixelsPerPoint);
    const width=site==='saturn'
      ?Math.min(nativePhotoPixels,Math.max(1600,Math.ceil(viewport.clientWidth*devicePixelRatio)))
      :1600;
    if(canvas.width!==width){
      canvas.width=width;
      canvas.height=Math.round(width*448/800);
    }
    if(site==='saturn'){
      const photo=state[0][1], geometry=window.moonPhoto;
      const documentY=geometry.startY+(geometry.endY-geometry.startY)*y/geometry.scrollSpan;
      ink.fillStyle='#fff';
      ink.fillRect(0,0,canvas.width,canvas.height);
      // Draw the viewport directly from the original JPEG. At high DPR this selects a
      // correspondingly larger set of real image pixels at the measured native zoom.
      ink.imageSmoothingQuality='high';
      const px=photo.naturalWidth/geometry.width, py=photo.naturalHeight/geometry.height;
      ink.drawImage(photo,-geometry.left*px,(documentY-geometry.top)*py,geometry.viewportCSS[0]*px,geometry.viewportCSS[1]*py,0,0,canvas.width,canvas.height);
      rail.update(site,'saturn');
      rail.scrollPhoto(documentY);
      buttons.querySelector('[data-moon="next"]').disabled=y>=maxScroll()-1;
      return;
    }
    let i=state.findLastIndex(s=>s[0]<=y);i=Math.max(0,i);
    const [start,img]=state[i], next=state[i+1];
    const rect=(im,sy,h,dy)=>{if(h<=.0001)return;const z=im.naturalWidth/800, top=im.naturalHeight/z-448;ink.drawImage(im,0,(top+sy)*z,800*z,h*z,0,dy*2,1600,h*2);};
    if(!next){rect(img,0,448,0);}else{
      const delta=y-start,span=next[0]-start;rect(img,delta,448-delta,0);rect(next[1],448-span,delta,448-delta);
    }
    const plate = i||!next||y<((start+next[0])/2) ? img : next[1];
    const key = plate.src.split('/').pop().replace('.webp','');
    rail.update(site,key);
    buttons.querySelector('[data-moon="next"]').disabled=y>=maxScroll()-1;
  }
  function animate(node,from,to,duration){
    const a=node.animate([{transform:from},{transform:to}],{duration,easing:'cubic-bezier(.42,0,.58,1)'});motions.push(a);return a;
  }
  function controls(){
    for(const key of ['nasa','wiki'])buttons.querySelector(`[data-moon="${key}"]`).setAttribute('aria-pressed',String(key===site));
    const reader=buttons.querySelector('[data-moon="reader"]');reader.disabled=site!=='wiki';reader.setAttribute('aria-pressed',String(site==='wiki'&&reading));reader.textContent=site==='wiki'&&reading?'退出阅读模式':'阅读模式';
    buttons.querySelector('[data-moon="next"]').disabled=!state||body.scrollTop>=maxScroll()-1;
    original.hidden=site==='home';if(!original.hidden)original.href=urls[site];
  }
  async function show(nextSite,{toggle=false,forget=null}={}){
    if(trigger.getAttribute('aria-expanded')!=='true')trigger.click();
    const token=++version, prior=site, prevRoute=route();
    if(nextSite===prior&&!toggle)return;
    if(prior!=='home'&&prior!==forget&&state)positions[prevRoute]=body.scrollTop;
    const nextReading=toggle?!reading:reading,nextRoute=nextSite==='wiki'&&nextReading?'reader':nextSite;
    let nextState=null;
    if(nextSite!=='home'){
      try{nextState=await Promise.all(routes[nextRoute].map(async([y,k])=>[y,await bitmap(k)]));}
      catch{if(token===version)status.textContent='未能载入本地网页预览。';return;}
    }
    if(token!==version)return;
    const swap=prior!=='home'&&nextSite!=='home'&&prior!==nextSite&&!reduced.matches;
    const oldSheet=page.querySelector('.moon-leaving');
    const reversing=swap&&oldSheet?.dataset.site===nextSite;
    function slideX(node) {
      const value=getComputedStyle(node).transform;
      return value==='none'?0:new DOMMatrixReadOnly(value).m41;
    }
    // A second selection can reverse an in-flight switch. Pick up the two
    // presented page positions before cancelling their former animations.
    const previousX=reversing?slideX(canvas):0, returningX=reversing?slideX(oldSheet):null;
    motions.forEach(a=>a.cancel());motions=[];
    oldSheet?.remove();
    let leaving;
    if(swap){
      leaving=canvas.cloneNode(false);leaving.classList.add('moon-leaving');
      leaving.dataset.site=prior;
      leaving.getContext('2d').drawImage(canvas,0,0);page.append(leaving);
    }
    site=nextSite;reading=nextReading;state=nextState;
    if(site==='home'){q.value='';home.classList.remove('typing');rail.update('home');}stage.parentElement.dataset.homeState=site;
    home.hidden=site!=='home';page.hidden=site==='home';home.inert=site!=='home';page.inert=site==='home';
    spacer.style.height=(body.clientHeight+maxScroll())+'px';body.scrollTop=positions[nextRoute]||0;draw();controls();
    if(!reduced.matches&&prior!==site){
      if(prior==='home'||site==='home'){
        const back=site==='home',out=back?page:home,inc=back?home:page;
        out.hidden=false;inc.hidden=false;
        animate(out,'translateY(0)',`translateY(${back?-480:480}px)`,350);
        const a=animate(inc,`translateY(${back?480:-480}px)`,'translateY(0)',350);
        a.finished.then(()=>{if(site===nextSite)out.hidden=true;}).catch(()=>{});
      }else if(swap){
        const order=rail.order(),direction=order.indexOf(nextSite)>order.indexOf(prior)?1:-1;
        const from=returningX??800*direction;
        const duration=300*Math.abs(from)/800;
        animate(leaving,`translateX(${previousX}px)`,`translateX(${-800*direction}px)`,duration);
        animate(canvas,`translateX(${from}px)`,'translateX(0)',duration).finished.then(()=>leaving.remove()).catch(()=>leaving.remove());
      }
    }
    status.textContent=site==='home'?'主页':site==='wiki'&&reading?'阅读模式已开启':titles[site];
  }
  function advance(){if(trigger.getAttribute('aria-expanded')!=='true')trigger.click();const target=site==='saturn'?Math.min(maxScroll(),body.scrollTop+window.moonPhoto.scrollSpan):state?.find(([y])=>y>body.scrollTop+1)?.[0];if(target!==undefined)body.scrollTo({top:target,behavior:reduced.matches?'instant':'smooth'});}
  buttons.addEventListener('click',e=>{const b=e.target.closest('[data-moon]');if(!b)return;const k=b.dataset.moon;if(k==='next'){advance();return;}if(k==='reader'){show('wiki',{toggle:true});return;}show(k);});
  body.addEventListener('scroll',draw,{passive:true});
  stage.addEventListener('keydown',e=>{if(e.key==='Escape'&&trigger.getAttribute('aria-expanded')==='true'){trigger.click();trigger.focus();}if(e.altKey&&e.metaKey&&e.code==='KeyR'&&site==='wiki'){e.preventDefault();show('wiki',{toggle:true});}});
  const panel=features.querySelector('.product-window'), opener=features.querySelector('[data-menu-demo]');
  let used=false;
  document.addEventListener('pointerdown',e=>{
    if(panel.contains(e.target)||buttons.contains(e.target)||opener.contains(e.target)){used=true;return;}
    if(used&&trigger.getAttribute('aria-expanded')==='true'){trigger.click();used=false;}
  });
  q.addEventListener('input',()=>home.classList.toggle('typing',q.value.length>0));
  function openAddress(term){
    term=term.trim();
    if(!term)return;
    const shortcuts={apple:'macbook',nasa:'nasa',wiki:'wiki',wikipedia:'wiki',moon:'wiki','月球':'wiki'};
    if(Object.hasOwn(shortcuts,term.toLowerCase())){show(shortcuts[term.toLowerCase()]);return;}
    let target;
    try{
      const u=new URL(term.includes('://')?term:'https://'+term);
      if(/^https?:$/.test(u.protocol)&&u.hostname.includes('.')){
        for(const [key,local] of Object.entries(urls)){
          const source=new URL(local);
          if(u.hostname===source.hostname&&u.pathname.replace(/\/$/,'')===source.pathname.replace(/\/$/,'')&&!u.search&&(!u.hash||u.hash===source.hash)){show(key);return;}
        }
        target=u.href;
      }
    }catch{}
    window.open(target||'https://www.google.com/search?q='+encodeURIComponent(term),'_blank','noopener,noreferrer');
  }
  form.addEventListener('submit',e=>{e.preventDefault();openAddress(q.value);});
  new ResizeObserver(()=>{
    const scale=viewport.clientWidth/800;
    if(!scale)return;
    const compact=viewport.clientWidth<540, railScale=compact?1/scale:1;
    stage.classList.toggle('rail-compact',compact);
    stage.style.transform=`scale(${scale})`;
    stage.style.setProperty('--rail-scale',railScale);
    stage.style.setProperty('--rail-width',800/railScale+'px');
    stage.style.setProperty('--rail-body-top',(compact?42:32)*railScale+'px');
    if(state)spacer.style.height=(body.clientHeight+maxScroll())+'px';
    if(site==='saturn')draw();
  }).observe(viewport);
  window.moonPreview={open:show};controls();
})();
