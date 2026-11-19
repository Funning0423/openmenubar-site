(() => {
  'use strict';
  const video = document.getElementById('lite-video');
  const button = document.getElementById('lite-load');
  const status = document.getElementById('lite-status');
  const mediaPath = 'assets/openmenubar-wallpaper-480p-930f742497.bin';
  let objectURL;
  button.hidden = false;

  button.addEventListener('click', async () => {
    if (!objectURL) {
      button.disabled = true;
      status.textContent = '正在下载短片…';
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 45000);
      try {
        // Fetch the complete file with an ordinary GET before giving it to the media player.
        const response = await fetch(mediaPath, {signal: controller.signal});
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        objectURL = URL.createObjectURL(new Blob([await response.arrayBuffer()], {type: 'video/mp4'}));
        video.src = objectURL;
      } catch {
        status.textContent = '暂时无法下载，可点击重试。';
        button.textContent = '重试';
        return;
      } finally {
        clearTimeout(timer);
        button.disabled = false;
      }
    }
    status.textContent = '';
    try {
      await video.play();
      button.hidden = true;
    } catch {
      button.textContent = '播放短片';
      status.textContent = '已下载，点击播放。';
    }
  });
  window.addEventListener('pagehide', event => {
    if (!event.persisted && objectURL) URL.revokeObjectURL(objectURL);
  });
})();
