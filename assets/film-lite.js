(() => {
  'use strict';
  const video = document.getElementById('lite-video');
  const button = document.getElementById('lite-load');
  const quality = document.getElementById('lite-quality');
  const status = document.getElementById('lite-status');
  const mediaType = 'video/mp4';
  const codec = `${mediaType}; codecs="avc1.64002a,mp4a.40.2"`;
  const directory = 'assets/wallpaper-hd-45bdae6ae4/';
  const hd = ['init.bin', ...Array.from({length: 26}, (_, i) => `${String(i + 1).padStart(2, '0')}.bin`)]
    .map(file => directory + file);
  const light = 'assets/openmenubar-wallpaper-480p-930f742497.bin';
  let active;
  button.parentElement.hidden = false;

  async function fetchFile(path, signal, retry = false) {
    const request = new AbortController();
    const abort = () => request.abort();
    if (signal.aborted) abort();
    signal.addEventListener('abort', abort, {once: true});
    let timer;
    const watchProgress = () => {
      clearTimeout(timer);
      timer = setTimeout(abort, 22000);
    };
    watchProgress();
    try {
      const response = await fetch(retry ? `${path}?retry=1` : path, {signal: request.signal});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      watchProgress();
      if (!response.body?.getReader) return await response.arrayBuffer();
      const reader = response.body.getReader();
      const pieces = [];
      try {
        for (;;) {
          const {value, done} = await reader.read();
          if (done) break;
          watchProgress();
          pieces.push(value);
        }
      } finally {
        reader.releaseLock();
      }
      return await new Blob(pieces).arrayBuffer();
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
    }
  }

  function nextEvent(target, event, signal, action, timeout = 9000) {
    return new Promise((resolve, reject) => {
      const finish = (error) => {
        clearTimeout(timer);
        target.removeEventListener(event, success);
        target.removeEventListener('error', failure);
        signal.removeEventListener('abort', failure);
        if (error) reject(error);
        else resolve();
      };
      const success = () => finish();
      const failure = () => finish(new Error(`Waiting for ${event} failed`));
      const timer = setTimeout(failure, timeout);
      if (signal.aborted) { failure(); return; }
      target.addEventListener(event, success, {once: true});
      target.addEventListener('error', failure, {once: true});
      signal.addEventListener('abort', failure, {once: true});
      try { action(); } catch (error) { finish(error); }
    });
  }

  function attach(run, media) {
    if (run.url) URL.revokeObjectURL(run.url);
    run.url = URL.createObjectURL(media);
    video.src = run.url;
  }

  function play(run) {
    if (run !== active) return;
    run.ready = true;
    button.disabled = false;
    video.play().then(() => {
      if (run === active) { button.hidden = true; status.textContent = ''; }
    }).catch(() => {
      if (run === active) { button.textContent = '播放短片'; status.textContent = '已载入，点击播放。'; }
    });
  }

  async function* orderedParts(get) {
    const pending = new Map();
    const fill = index => {
      for (let i = index; i < Math.min(index + 3, hd.length); i++) {
        if (pending.has(i)) continue;
        const request = get(hd[i]);
        request.catch(() => {});
        pending.set(i, request);
      }
    };
    for (let i = 0; i < hd.length; i++) {
      fill(i);
      const bytes = await pending.get(i);
      pending.delete(i);
      fill(i + 1);
      yield bytes;
    }
  }

  async function stream(run, Media, get) {
    const media = new Media();
    const {signal} = run.controller;
    video.disableRemotePlayback = true;
    await nextEvent(media, 'sourceopen', signal, () => attach(run, media));
    const buffer = media.addSourceBuffer(codec);
    let appended = 0;
    for await (const bytes of orderedParts(get)) {
      await nextEvent(buffer, 'updateend', signal, () => buffer.appendBuffer(bytes));
      if (++appended === 2) play(run);
    }
    if (media.readyState === 'open') media.endOfStream();
  }

  function reset() {
    if (active) {
      active.controller.abort();
      video.pause();
      video.removeAttribute('src');
      video.load();
      if (active.url) URL.revokeObjectURL(active.url);
      active = undefined;
    }
    button.hidden = false;
    button.disabled = false;
    button.textContent = '播放短片';
    status.textContent = '';
  }

  button.addEventListener('click', async () => {
    if (active?.ready) { play(active); return; }
    const run = {controller: new AbortController()};
    active = run;
    button.disabled = true;
    status.textContent = '正在载入短片…';
    const {signal} = run.controller;
    try {
      if (quality.value === 'light') {
        attach(run, new Blob([await fetchFile(light, signal)], {type: mediaType}));
        play(run);
        return;
      }
      const cached = new Map();
      const get = path => {
        if (!cached.has(path)) {
          const request = fetchFile(path, signal).catch(error => {
            if (signal.aborted) throw error;
            return fetchFile(path, signal, true);
          });
          cached.set(path, request.catch(error => { cached.delete(path); throw error; }));
        }
        return cached.get(path);
      };
      const Media = [window.MediaSource, window.ManagedMediaSource].find(Type => Type?.isTypeSupported(codec));
      let resumeAt = 0;
      if (Media) {
        try { await stream(run, Media, get); return; }
        catch (error) {
          if (signal.aborted) throw error;
          resumeAt = video.currentTime;
          video.pause();
          run.ready = false;
          button.hidden = false;
          button.disabled = true;
        }
      }
      status.textContent = '正在下载 1080p 短片…';
      const index = get(directory + 'index.bin');
      index.catch(() => {});
      const pieces = [];
      for await (const bytes of orderedParts(get)) pieces.push(bytes);
      pieces.push(await index);
      await nextEvent(video, 'loadedmetadata', signal, () => {
        video.preload = 'metadata';
        attach(run, new Blob(pieces, {type: mediaType}));
      }, 20000);
      if (resumeAt > 0) video.currentTime = resumeAt;
      play(run);
    } catch {
      if (signal.aborted) return;
      reset();
      button.textContent = '重试';
      status.textContent = '短片载入中断。可重试或选择省流版。';
    }
  });
  quality.addEventListener('change', reset);
  window.addEventListener('pagehide', event => { if (!event.persisted) reset(); });
})();
