(() => {
  'use strict';
  if (new URLSearchParams(location.search).get('video-audit') !== '1') return;
  const video = document.getElementById('product-film');
  const shell = video?.closest('.film-shell');
  if (!video || !shell || document.getElementById('film-audit')) return;

  const panel = document.createElement('section');
  panel.id = 'film-audit';
  panel.setAttribute('aria-label', '视频播放检测');
  panel.style.cssText = 'margin:12px 0;padding:12px;border:1px solid #b5bdc7;border-radius:8px;background:#f5f7fa;color:#1d1d1f;font:13px/1.5 system-ui;text-align:left';
  const controls = document.createElement('div');
  controls.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;align-items:center';
  const summary = document.createElement('output');
  summary.id = 'film-audit-summary';
  summary.style.cssText = 'display:block;margin:10px 0;white-space:pre-wrap';
  const data = document.createElement('textarea');
  data.id = 'film-audit-data'; data.readOnly = true;
  data.setAttribute('aria-label', '视频播放检测数据');
  data.style.cssText = 'box-sizing:border-box;width:100%;height:130px;font:11px/1.35 monospace;border:1px solid #b5bdc7;background:white;color:#1d1d1f;resize:vertical';
  panel.append(controls, summary, data); shell.after(panel);

  const MAX_RECORDS = 200;
  const startedAt = new Date().toISOString();
  let timer = null, callbackID = null, suspended = false, sequence = 0;
  let run = null, firstCompleteRun = null, lastRun = null;
  let wait = null, seek = null, lastCallback = null, notice = '';
  const events = [], samples = [], seeks = [], waits = [];
  const now = () => performance.now();
  const round = n => Number.isFinite(n) ? Math.round(n * 1000) / 1000 : null;
  const bounded = (list, item) => { list.push(item); if (list.length > MAX_RECORDS) list.shift(); };
  const quality = () => {
    try {
      if (typeof video.getVideoPlaybackQuality === 'function') {
        const q = video.getVideoPlaybackQuality();
        return {api:'getVideoPlaybackQuality', total:round(q.totalVideoFrames), dropped:round(q.droppedVideoFrames), corrupted:round(q.corruptedVideoFrames)};
      }
      return {api:'legacy-or-unavailable', total:round(video.webkitDecodedFrameCount), dropped:round(video.webkitDroppedFrameCount), corrupted:null};
    } catch (error) { return {api:'unavailable', total:null, dropped:null, corrupted:null, error:String(error.message || error)}; }
  };
  const delta = (end, start) => Object.fromEntries(['total','dropped','corrupted'].map(key => [key,
    Number.isFinite(end[key]) && Number.isFinite(start[key]) ? Math.max(0,end[key]-start[key]) : null]));
  const current = () => ({
    time:round(video.currentTime), duration:round(video.duration), width:video.videoWidth, height:video.videoHeight,
    paused:video.paused, ended:video.ended, seeking:video.seeking, readyState:video.readyState,
    networkState:video.networkState, playbackRate:video.playbackRate, visibility:document.visibilityState,
    quality:quality(), error:video.error ? {code:video.error.code, message:video.error.message} : null,
    loadingState:shell.dataset.filmState || null,
    sourceAttribute:video.getAttribute('src'), currentSource:video.currentSrc,
    declaredSources:Array.from(video.querySelectorAll('source'), source => ({src:source.src,type:source.type})),
    buffered:Array.from({length:video.buffered.length},(_,i)=>[round(video.buffered.start(i)),round(video.buffered.end(i))])
  });
  const runSnapshot = () => {
    if (!run) return null;
    const q = quality();
    return {...run, wallSeconds:round((now()-run.startWall)/1000), endTime:round(video.currentTime), finalQuality:q,
      qualityDelta:delta(q,run.baseQuality), frameCallback:{...run.frameCallback,
        callbackHz:run.frameCallback.firstWall !== null && run.frameCallback.lastWall > run.frameCallback.firstWall
          ? round((run.frameCallback.callbacks-1)*1000/(run.frameCallback.lastWall-run.frameCallback.firstWall)) : null}};
  };
  const render = () => {
    const state = current(), activeRun = runSnapshot();
    summary.textContent = `${state.width || '—'} × ${state.height || '—'} · ${state.time ?? 0} / ${state.duration ?? '—'} 秒 · ${state.paused ? '已暂停' : '播放中'}\n` +
      `浏览器累计帧 ${state.quality.total ?? '不可用'}，丢帧 ${state.quality.dropped ?? '不可用'}，损坏帧 ${state.quality.corrupted ?? '不可用'}；完整连续播放 ${firstCompleteRun ? '已完成' : '尚未完成'}。` +
      (notice ? `\n${notice}` : '');
    data.value = JSON.stringify({version:1,startedAt,observedAt:new Date().toISOString(),current:state,activeRun,firstCompleteRun,lastRun,
      events,samples,seeks,waits,notes:['quality counters belong to the browser media pipeline, not a physical display refresh-rate measurement',
      'video-frame callback cadence can be capped by display refresh rate; seek/pause intervals are excluded from callback-gap measurement',
      'firstCompleteRun requires a start at or before 0.25s, normal speed, no seek/pause/hidden interruption, and an ended event']});
  };
  const event = (type, extra = {}) => bounded(events,{type,wall:round(now()),time:round(video.currentTime),...extra});
  const interrupt = reason => { if (run && !run.interruptions.includes(reason)) run.interruptions.push(reason); };
  const finishWait = cause => {
    if (!wait) return;
    bounded(waits,{...wait,endWall:round(now()),seconds:round((now()-wait.startWall)/1000),endTime:round(video.currentTime),cause});
    wait = null;
  };
  const cancelFrame = () => {
    if (callbackID !== null && typeof video.cancelVideoFrameCallback === 'function') video.cancelVideoFrameCallback(callbackID);
    callbackID = null; lastCallback = null;
  };
  const stop = () => { if (timer !== null) clearInterval(timer); timer = null; cancelFrame(); };
  const frame = (wall, metadata) => {
    callbackID = null;
    if (run && !video.seeking && !video.paused && !suspended) {
      const c = run.frameCallback;
      if (c.firstWall === null) {c.firstWall=wall;c.firstMediaTime=metadata.mediaTime;c.firstPresentedFrame=metadata.presentedFrames;}
      c.callbacks++;c.lastWall=wall;c.lastMediaTime=metadata.mediaTime;c.lastPresentedFrame=metadata.presentedFrames;
      if (lastCallback) {
        const gap=wall-lastCallback.wall, mediaGap=metadata.mediaTime-lastCallback.mediaTime;
        c.maxCallbackGapMs=Math.max(c.maxCallbackGapMs,gap);c.maxMediaGapSeconds=Math.max(c.maxMediaGapSeconds,mediaGap);
        if (gap>50) c.gapsOver50ms++;
        if (gap>100) c.gapsOver100ms++;
      }
      lastCallback={wall,mediaTime:metadata.mediaTime};
    }
    if (!video.paused && !video.ended && !suspended && typeof video.requestVideoFrameCallback === 'function') callbackID=video.requestVideoFrameCallback(frame);
  };
  const startMonitoring = () => {
    if (suspended || video.paused || video.ended) return;
    if (timer === null) timer=setInterval(()=>{bounded(samples,{wall:round(now()),...current()});render();},1000);
    if (callbackID === null && typeof video.requestVideoFrameCallback === 'function') callbackID=video.requestVideoFrameCallback(frame);
  };
  const beginRun = () => {
    run={id:++sequence,startedAt:new Date().toISOString(),startWall:now(),startTime:round(video.currentTime),baseQuality:quality(),interruptions:[],
      frameCallback:{supported:typeof video.requestVideoFrameCallback==='function',callbacks:0,firstWall:null,lastWall:null,firstMediaTime:null,lastMediaTime:null,
        firstPresentedFrame:null,lastPresentedFrame:null,maxCallbackGapMs:0,maxMediaGapSeconds:0,gapsOver50ms:0,gapsOver100ms:0}};
    if (video.currentTime>0.25) interrupt('start-after-beginning');
    if (video.playbackRate!==1) interrupt('nonstandard-rate');
  };
  const handlers = {
    play:()=>{event('play');if (!run) beginRun();startMonitoring();render();},
    playing:()=>{event('playing');finishWait('playing');if (!run) beginRun();startMonitoring();render();},
    pause:()=>{event('pause');if (!video.ended && video.currentTime<video.duration-0.05) interrupt('pause');finishWait('pause');stop();render();},
    seeking:()=>{event('seeking');interrupt('seek');finishWait('seek');cancelFrame();seek={startWall:now(),target:round(video.currentTime),quality:quality()};render();},
    seeked:()=>{event('seeked');if(seek){bounded(seeks,{...seek,settledTime:round(video.currentTime),seconds:round((now()-seek.startWall)/1000),readyState:video.readyState,quality:quality()});seek=null;}lastCallback=null;startMonitoring();render();},
    waiting:()=>{event('waiting',{duringSeek:video.seeking,paused:video.paused});if(run&&!video.paused&&!video.seeking&&!video.ended&&!wait)wait={type:'waiting',startWall:now(),startTime:round(video.currentTime)};render();},
    stalled:()=>{event('stalled',{duringSeek:video.seeking,paused:video.paused});if(run&&!video.paused&&!video.seeking&&!video.ended&&!wait)wait={type:'stalled',startWall:now(),startTime:round(video.currentTime)};render();},
    ended:()=>{event('ended');finishWait('ended');stop();const finished=runSnapshot();if(finished){finished.complete=finished.startTime<=0.25&&finished.interruptions.length===0&&video.ended;lastRun=finished;if(finished.complete&&!firstCompleteRun)firstCompleteRun=finished;}run=null;render();},
    error:()=>{event('error',{error:current().error});interrupt('error');finishWait('error');stop();render();},
    ratechange:()=>{event('ratechange',{rate:video.playbackRate});if(video.playbackRate!==1)interrupt('nonstandard-rate');render();},
    emptied:()=>{event('emptied');interrupt('source-reset');finishWait('emptied');stop();render();},
    loadedmetadata:()=>{event('loadedmetadata');render();},loadeddata:()=>{event('loadeddata');render();},loadstart:()=>{event('loadstart');render();}
  };
  for (const [name,handler] of Object.entries(handlers)) video.addEventListener(name,handler);
  video.querySelectorAll('source').forEach(source=>source.addEventListener('error',()=>{event('source-error',{src:source.src});render();}));
  document.addEventListener('visibilitychange',()=>{event('visibilitychange',{visibility:document.visibilityState});if(document.hidden){interrupt('hidden');stop();}else startMonitoring();render();});
  window.addEventListener('pagehide',()=>{suspended=true;interrupt('pagehide');finishWait('pagehide');stop();render();});
  window.addEventListener('pageshow',()=>{suspended=false;startMonitoring();render();});

  const addButton = (label,action) => {const button=document.createElement('button');button.type='button';button.textContent=label;
    button.style.cssText='padding:5px 9px;border:1px solid #929ca9;border-radius:5px;background:white;color:#1d1d1f;font:inherit;cursor:pointer';
    button.addEventListener('click',async()=>{try{notice='';await action();}catch(error){notice=String(error.message||error);event('control-error',{message:notice});}render();});controls.append(button);};
  const requireLoaded = () => {if(video.readyState<1||!Number.isFinite(video.duration))throw new Error('请先点击播放器的“播放短片”，载入视频。');};
  addButton('从头连续播放',async()=>{
    requireLoaded();video.pause();stop();finishWait('restart');run=null;video.currentTime=0;
    if(video.seeking)await new Promise(resolve=>video.addEventListener('seeked',resolve,{once:true}));
    await video.play();
  });
  [5,40,60].forEach(time=>addButton(`跳到 ${time} 秒`,()=>{requireLoaded();video.currentTime=Math.min(time,video.duration-0.01);}));
  addButton('暂停 / 继续',async()=>{requireLoaded();if(video.paused)await video.play();else video.pause();});
  addButton('清空统计',()=>{stop();run=null;firstCompleteRun=null;lastRun=null;wait=null;seek=null;events.length=0;samples.length=0;seeks.length=0;waits.length=0;if(!video.paused){beginRun();startMonitoring();}event('reset');});
  const download = (blob, name) => {
    const url=URL.createObjectURL(blob), link=document.createElement('a');
    link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  addButton('导出检测报告',()=>{render();download(new Blob([data.value],{type:'application/json'}),'OpenMenuBar-playback-audit.json');});
  addButton('保存当前视频帧',async()=>{
    requireLoaded();const canvas=document.createElement('canvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight;
    canvas.getContext('2d').drawImage(video,0,0);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    if(!blob)throw new Error('当前帧未能保存');
    download(blob,`OpenMenuBar-frame-${video.currentTime.toFixed(3)}.png`);
  });
  event('audit-ready');render();
  if (!video.paused) {beginRun();startMonitoring();}
})();
