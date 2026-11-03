(() => {
  'use strict';
  const video = document.getElementById('product-film');
  const shell = video?.closest('.film-shell');
  const overlay = shell?.querySelector('.film-start');
  const button = document.getElementById('film-play');
  const status = document.getElementById('film-load-status');
  const source = video?.querySelector('source');
  if (!video || !shell || !overlay || !button || !status || !source) return;
  const desktopAsset = new URL(source.dataset.desktopSrc || source.src, location.href);
  const mobileAsset = new URL(source.dataset.mobileSrc || source.src, location.href);
  if (desktopAsset.origin !== location.origin || mobileAsset.origin !== location.origin) return;
  const quality = document.getElementById('film-quality');
  const picker = document.getElementById('film-resolution');
  const mirrorBases = {
    'funning0423.github.io': 'https://openmenubar-blc5zxcc.edgeone.dev/',
    'openmenubar-blc5zxcc.edgeone.dev': 'https://funning0423.github.io/openmenubar-site/'
  };
  const mirror = mirrorBases[location.hostname];
  let state = 'idle', requestID = 0, watchdog = null, queue = [], candidateIndex = 0;
  let visible = false, wantsPlay = false, resumeTime = 0, switching = false;
  const setState = value => { state = value; shell.dataset.filmState = value; };
  const message = text => { status.textContent = text; status.hidden = !text; };
  const inViewport = () => { const r = video.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; };
  const cancelWatchdog = () => { clearTimeout(watchdog); watchdog = null; };
  const candidates = resolution => {
    const result = [];
    for (const tier of resolution === '4k' ? ['4k', 'hd'] : ['hd']) {
      const asset = tier === '4k' ? desktopAsset : mobileAsset;
      result.push({url:asset.href, tier});
      if (mirror) result.push({url:new URL('assets/' + asset.pathname.split('/').pop() + asset.search, mirror).href, tier});
    }
    return result;
  };
  const selectAsset = candidate => {
    video.dataset.playbackRoute = 'native-progressive';
    video.dataset.quality = candidate.tier === '4k' ? '4k90' : '1080p60';
    video.dataset.selectedSource = candidate.url;
    source.src = candidate.url;
    if (quality) quality.textContent = candidate.tier === '4k' ? '4K · 90fps' : '1080p · 60fps';
    if (picker) picker.value = candidate.tier;
  };
  selectAsset(candidates('hd')[0]);
  // Native CC still owns selection; the DOM layer supplies a real glass radius.
  // Keep the source track accessible and insert cue text without interpreting HTML.
  const captions = document.createElement('div');
  captions.className = 'film-captions'; captions.hidden = true;
  captions.setAttribute('aria-hidden', 'true');
  const captionText = document.createElement('span');
  captionText.className = 'film-caption-text'; captions.append(captionText);
  shell.append(captions);
  const captionTracks = new Set();
  const nativePresentation = () => document.fullscreenElement === video ||
    document.webkitFullscreenElement === video || video.webkitDisplayingFullscreen ||
    document.pictureInPictureElement === video ||
    (video.webkitPresentationMode && video.webkitPresentationMode !== 'inline');
  const syncCaptions = () => {
    try {
      const selected = Array.from(video.textTracks || []).filter(track =>
        (track.kind === 'subtitles' || track.kind === 'captions') && track.mode === 'showing');
      const enhanced = state === 'ready' && !nativePresentation() && selected.length > 0;
      const text = enhanced ? selected.flatMap(track => Array.from(track.activeCues || [], cue => cue.text || '')).filter(Boolean).join('\n') : '';
      captionText.textContent = text;
      const opening = Number(video.dataset.openingDuration || 0);
      captions.dataset.scene = video.currentTime < opening ? 'opening' : video.currentTime < Number(video.dataset.aiEnd || opening + 24) ? 'ai' : 'main';
      captions.hidden = !text || captions.dataset.scene === 'opening';
      video.classList.toggle('film-captions-enhanced', enhanced);
    } catch {
      video.classList.remove('film-captions-enhanced'); captions.hidden = true;
    }
  };
  const bindCaptionTracks = () => {
    for (const track of Array.from(video.textTracks || [])) {
      if (!captionTracks.has(track)) { track.addEventListener('cuechange', syncCaptions); captionTracks.add(track); }
    }
    syncCaptions();
  };
  video.textTracks?.addEventListener('change', syncCaptions);
  video.textTracks?.addEventListener('addtrack', bindCaptionTracks);
  video.textTracks?.addEventListener('removetrack', syncCaptions);
  video.querySelectorAll('track').forEach(track => track.addEventListener('load', bindCaptionTracks));
  ['timeupdate', 'seeking', 'seeked', 'loadedmetadata', 'loadeddata', 'play', 'pause', 'emptied', 'ended',
    'enterpictureinpicture', 'leavepictureinpicture', 'webkitbeginfullscreen', 'webkitendfullscreen',
    'webkitpresentationmodechanged'].forEach(name => video.addEventListener(name, syncCaptions));
  document.addEventListener('fullscreenchange', syncCaptions);
  document.addEventListener('webkitfullscreenchange', syncCaptions);
  bindCaptionTracks();
  const reset = () => {
    requestID++; wantsPlay = false; switching = false; cancelWatchdog();
    video.pause(); video.removeAttribute('src');
    selectAsset(candidates('hd')[0]);
    video.controls = false; video.preload = 'none'; video.load();
    overlay.hidden = false; button.disabled = false;
    button.innerHTML = '<span aria-hidden="true">▷</span> 播放 ' + (video.dataset.durationLabel || '约 69 秒') + '短片';
    setState('idle'); message(''); syncCaptions();
  };
  const failed = () => {
    cancelWatchdog(); wantsPlay = false; switching = false; setState('error');
    video.pause(); video.controls = false;
    overlay.hidden = false; button.disabled = false; button.textContent = '重新加载短片';
    message('短片暂时未能加载。可重试，或使用下方备用站点播放。'); syncCaptions();
  };
  const armWatchdog = () => {
    cancelWatchdog();
    if (!wantsPlay || document.hidden || !inViewport()) return;
    watchdog = setTimeout(() => {
      watchdog = null;
      if (wantsPlay && !document.hidden && inViewport()) advanceSource();
    }, 10000);
  };
  const playNative = id => {
    // The first play() runs directly in the trusted click/change event, including iOS.
    const playing = video.play();
    playing?.catch(error => {
      if (id !== requestID || error.name === 'AbortError') return;
      if (error.name === 'NotAllowedError') {
        wantsPlay = false; cancelWatchdog(); setState('ready');
        message('请点击播放器中的播放按钮继续。');
      } else advanceSource();
    });
  };
  const loadCandidate = () => {
    const id = ++requestID;
    cancelWatchdog(); switching = true; selectAsset(queue[candidateIndex]);
    setState('loading'); video.controls = true; video.preload = 'metadata';
    overlay.hidden = true; button.disabled = false;
    video.src = queue[candidateIndex].url; video.load();
    if (wantsPlay) { playNative(id); armWatchdog(); }
  };
  const advanceSource = () => {
    if (state === 'idle' || state === 'error') return;
    // A late network/decode event must not restart work after pause or hiding.
    if (!wantsPlay || document.hidden || !inViewport()) { failed(); return; }
    if (video.error) {
      video.dataset.lastMediaError = String(video.error.code);
      video.dataset.lastMediaErrorMessage = video.error.message || '';
    }
    if (!switching && Number.isFinite(video.currentTime)) resumeTime = video.currentTime;
    if (++candidateIndex >= queue.length) { failed(); return; }
    message('正在切换播放线路…'); loadCandidate();
  };
  const start = resolution => {
    delete video.dataset.lastMediaError; delete video.dataset.lastMediaErrorMessage;
    visible = inViewport(); wantsPlay = visible && !document.hidden;
    resumeTime = !video.ended && state === 'ready' ? video.currentTime : 0;
    queue = candidates(resolution); candidateIndex = 0;
    message('正在载入短片…'); loadCandidate();
  };
  // All devices start with a native, progressive 1080p60 source. No full-file Blob gate.
  video.controls = false; overlay.hidden = false; setState('idle');
  button.addEventListener('click', event => {
    if (event.isTrusted) start(picker?.value || 'hd');
  });
  picker?.addEventListener('change', event => {
    if (event.isTrusted) start(picker.value);
  });
  video.addEventListener('loadedmetadata', () => {
    if (state !== 'loading' && !(state === 'ready' && switching)) return;
    if (resumeTime > 0 && Number.isFinite(video.duration)) video.currentTime = Math.min(resumeTime, Math.max(0, video.duration - 0.1));
    switching = false;
  });
  video.addEventListener('error', () => {
    if (video.error && (state === 'ready' || state === 'loading')) advanceSource();
  });
  video.addEventListener('playing', () => {
    if (state === 'loading' || state === 'ready') {
      switching = false; cancelWatchdog(); setState('ready'); message(''); syncCaptions();
    }
  });
  video.addEventListener('waiting', () => {
    if (state === 'ready' || state === 'loading') {
      if (!video.seeking) message('正在缓冲短片…');
      armWatchdog();
    }
  });
  video.addEventListener('seeking', () => { if (wantsPlay) armWatchdog(); });
  video.addEventListener('seeked', () => { if (!video.paused && video.readyState >= 3) cancelWatchdog(); });
  video.addEventListener('timeupdate', () => {
    if (state === 'ready' && !video.paused && video.readyState >= 3) {
      cancelWatchdog(); message('');
    }
  });
  video.addEventListener('play', () => {
    wantsPlay = true;
    if (state === 'ready') message('');
    armWatchdog();
  });
  video.addEventListener('pause', () => {
    // load() can queue an old pause event after the new play() request.
    // Current paused state distinguishes it from the user actually pausing.
    if (video.paused) { wantsPlay = false; switching = false; cancelWatchdog(); }
  });
  video.addEventListener('ended', () => { wantsPlay = false; cancelWatchdog(); message(''); });
  if ('IntersectionObserver' in window) new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (!visible) { wantsPlay = false; cancelWatchdog(); video.pause(); }
  }, {threshold:0}).observe(video);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { wantsPlay = false; cancelWatchdog(); video.pause(); }
  });
  window.addEventListener('pagehide', reset);
  window.addEventListener('pageshow', event => { if (event.persisted) reset(); });
})();
