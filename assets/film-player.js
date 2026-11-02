(() => {
  'use strict';
  const video = document.getElementById('product-film');
  const shell = video?.closest('.film-shell');
  const overlay = shell?.querySelector('.film-start');
  const button = document.getElementById('film-play');
  const status = document.getElementById('film-load-status');
  const source = video?.querySelector('source');
  if (!video || !shell || !overlay || !button || !status || !source || !window.fetch || !window.AbortController || !URL.createObjectURL) return;
  const asset = new URL(source.src, location.href);
  if (asset.origin !== location.origin) return;
  let state = 'idle', controller = null, objectURL = null, requestID = 0;
  let visible = false, playRequested = false;
  const setState = value => { state = value; shell.dataset.filmState = value; };
  const message = text => { status.textContent = text; status.hidden = !text; };
  const inViewport = () => { const r = video.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; };
  const revoke = () => { if (objectURL) { URL.revokeObjectURL(objectURL); objectURL = null; } };
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
    requestID++; playRequested = false;
    controller?.abort(); controller = null;
    video.pause(); video.removeAttribute('src'); revoke();
    video.controls = false; video.preload = 'none'; video.load();
    overlay.hidden = false; button.disabled = false;
    button.innerHTML = '<span aria-hidden="true">▷</span> 播放 ' + (video.dataset.durationLabel || '64 秒') + '短片';
    setState('idle'); message(''); syncCaptions();
  };
  const failed = () => {
    playRequested = false; setState('error');
    video.pause(); video.removeAttribute('src'); revoke(); video.controls = false;
    overlay.hidden = false; button.disabled = false; button.textContent = '重新加载短片';
    message('短片暂时未能加载。请重试，或使用下方链接下载观看。'); syncCaptions();
  };
  // Keep the HTML's native controls as the no-JavaScript fallback.
  video.controls = false; overlay.hidden = false; setState('idle');
  button.addEventListener('click', async event => {
    if (!event.isTrusted || state === 'loading') return;
    const id = ++requestID;
    visible = inViewport(); playRequested = visible && !document.hidden;
    controller = new AbortController(); setState('loading'); button.disabled = true;
    button.textContent = '正在加载短片…'; message('正在载入高清短片，完成后即可自由拖动进度。');
    try {
      const response = await fetch(asset.href, {signal:controller.signal, credentials:'omit'});
      if (!response.ok) throw new Error('Film unavailable');
      const blob = await response.blob();
      if (id !== requestID) return;
      if (!blob.size) throw new Error('Empty film');
      revoke(); objectURL = URL.createObjectURL(blob);
      video.src = objectURL; video.controls = true; video.load();
      overlay.hidden = true; button.disabled = false; setState('ready'); syncCaptions();
      const shouldPlay = playRequested && visible && inViewport() && !document.hidden;
      playRequested = false;
      if (shouldPlay) {
        try { await video.play(); if (id === requestID && state === 'ready') message(''); }
        catch { if (id === requestID && state === 'ready') message('短片已就绪，请点击播放器中的播放按钮。'); }
      } else message('短片已就绪，请点击播放器中的播放按钮。');
    } catch (error) {
      if (id !== requestID || error.name === 'AbortError') return;
      failed();
    } finally { if (id === requestID) controller = null; }
  });
  video.addEventListener('error', () => { if (state === 'ready') failed(); });
  video.addEventListener('play', () => { if (state === 'ready') message(''); });
  if ('IntersectionObserver' in window) new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (!visible) { playRequested = false; video.pause(); }
  }, {threshold:0}).observe(video);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { playRequested = false; video.pause(); }
  });
  window.addEventListener('pagehide', reset);
  window.addEventListener('pageshow', event => { if (event.persisted) reset(); });
})();
