/* A bounded product demonstration. No network requests, idle loop, or scroll animation. */
(() => {
  'use strict';
  const stage = document.getElementById('orb-stage');
  if (!stage) return;
  const orb = document.getElementById('orb-launcher');
  const shell = document.getElementById('orb-web');
  const reading = document.getElementById('orb-reading');
  const draft = document.getElementById('orb-document');
  const editor = document.getElementById('orb-draft');
  const composer = document.getElementById('orb-chat-input');
  const sendButton = document.getElementById('orb-send');
  const copyButton = document.getElementById('orb-copy');
  const conversation = document.getElementById('orb-conversation');
  const sceneButtons = [...document.querySelectorAll('[data-orb-scene]')].filter(element => element.tagName === 'BUTTON');
  const modeButtons = [...document.querySelectorAll('[data-orb-mode]')];
  const sideButton = document.getElementById('orb-side');
  const toggleButton = document.getElementById('orb-toggle');
  const status = document.getElementById('orb-demo-status');
  const invitation = stage.querySelector('.orb-invitation');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = matchMedia('(max-width: 760px)');
  const contents = [...shell.children];
  const timings = { open: 520, collapse: 450, dissolve: 180, snap: 180 };
  const animations = new Set();
  const easing = 'cubic-bezier(.22,.68,0,1)';
  let desiredOpen = false;
  let scene = 'desktop';
  let pinned = false;
  let copyState = 'idle';
  let copyPermissionError = '';
  let lastCopiedText = '';
  const checklistText = '上线清单\n1. 页面内容：时间、地点与报名说明。\n2. 报名表单：手机号必填与格式校验。\n3. 成功通知：确认文案与发送方式。\n4. 上线验收：检查手机端报名全流程。\n\n上线前再确认\n- 各项任务由谁负责？\n- 报名数据保存在哪里？\n- 具体上线时间和验收人是谁？';
  let side = 'right';
  let savedScrollTop = 0;
  let restoreOrbFocus = false;
  let visible = true;
  let pageScrolling = document.documentElement.classList.contains('page-scrolling');
  let generation = 0;
  let drag = null;
  let suppressClick = false;
  let dragClickTimer = 0;
  let normalizedY = null;
  let geometry = { width: 0, height: 0, size: 0, margin: 0, x: 0, y: 0, panelX: 0, panelY: 0, panelW: 0, panelH: 0 };

  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const transformAt = (x, y) => `translate3d(${x}px,${y}px,0)`;
  const canAnimate = () => visible && !document.hidden && !pageScrolling && !reduce.matches;
  const setState = state => { stage.dataset.orbState = state; };

  function positionOrb(x = geometry.x, y = geometry.y) {
    orb.style.transform = transformAt(x, y);
    invitation.style.top = `${y + (geometry.size - 24) / 2}px`;
  }

  // Read the scene once per user action or resize; pointermove uses cached geometry.
  function layout() {
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    const size = parseFloat(getComputedStyle(stage).getPropertyValue('--orb-size')) || 56;
    const margin = mobile.matches ? 16 : 24;
    const x = side === 'left' ? margin : width - margin - size;
    const defaultY = mobile.matches ? 40 : (height - size) / 2;
    const y = normalizedY === null ? defaultY : margin + normalizedY * (height - size - margin * 2);
    const panelW = Math.min(mobile.matches ? 390 : 420, width - margin * 2);
    const panelH = Math.min(mobile.matches ? 350 : 470, height - margin * 2);
    const panelX = side === 'left' ? margin : width - margin - panelW;
    const panelTop = scene === 'desktop' ? (mobile.matches ? 37 : 40) : margin;
    const panelY = clamp(y + size / 2 - panelH / 2, panelTop, height - margin - panelH);
    geometry = { width, height, size, margin, x, y, panelX, panelY, panelW, panelH };
    shell.style.left = `${panelX}px`;
    shell.style.top = `${panelY}px`;
    shell.style.width = `${panelW}px`;
    shell.style.height = `${panelH}px`;
    positionOrb();
  }

  function collapsedTransform(press = 1) {
    const g = geometry;
    const size = g.size * press;
    const x = g.x - g.panelX + (g.size - size) / 2;
    const y = g.y - g.panelY + (g.size - size) / 2;
    return `translate3d(${x}px,${y}px,0) scale(${size / g.panelW},${size / g.panelH})`;
  }

  function cancelAnimations() {
    generation += 1;
    for (const animation of animations) animation.cancel();
    animations.clear();
  }

  function animate(element, frames, duration, curve = easing) {
    const animation = element.animate(frames, { duration, easing: curve, fill: 'both' });
    animations.add(animation);
    return animation.finished.catch(() => {}).then(() => {
      animations.delete(animation);
      animation.cancel();
    });
  }

  function updateControls() {
    orb.setAttribute('aria-expanded', String(desiredOpen));
    sideButton.textContent = side === 'right' ? '移到左侧' : '移到右侧';
    toggleButton.textContent = desiredOpen ? '收起 AI' : '展开 AI';
    toggleButton.setAttribute('aria-expanded', String(desiredOpen));
    stage.dataset.orbSide = side;
    stage.dataset.orbScene = scene;
    stage.dataset.orbPinned = String(pinned);
    sceneButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.orbScene === scene)));
    modeButtons.forEach(button => button.setAttribute('aria-pressed', String((button.dataset.orbMode === 'pinned') === pinned)));
  }

  function settle() {
    cancelAnimations();
    shell.style.clipPath = '';
    shell.style.transform = '';
    shell.style.transformOrigin = '';
    shell.style.borderRadius = '';
    shell.style.opacity = '';
    contents.forEach(element => { element.style.opacity = ''; });
    orb.style.opacity = '';
    shell.hidden = !desiredOpen;
    shell.inert = !desiredOpen;
    shell.setAttribute('aria-hidden', String(!desiredOpen));
    setState(desiredOpen ? 'open' : 'closed');
    updateControls();
    positionOrb();
    if (desiredOpen) reading.scrollTop = savedScrollTop;
    else if (restoreOrbFocus) {
      restoreOrbFocus = false;
      orb.focus({ preventScroll: true });
    }
  }

  async function open({ focus = false } = {}) {
    if (drag) endDrag(false);
    if (desiredOpen) {
      if (focus) reading.focus({ preventScroll: true });
      return;
    }
    cancelAnimations();
    desiredOpen = true;
    restoreOrbFocus = false;
    layout();
    shell.style.clipPath = '';
    shell.style.opacity = '';
    shell.style.transformOrigin = '0 0';
    contents.forEach(element => { element.style.opacity = ''; });
    shell.hidden = false;
    shell.inert = false;
    shell.setAttribute('aria-hidden', 'false');
    reading.scrollTop = savedScrollTop;
    updateControls();
    status.textContent = pinned ? '已钉住。对照 AI 的清单，继续编辑工作文稿。' : 'AI 已展开。点回工作文稿，窗口就会收起。';
    if (focus) reading.focus({ preventScroll: true });
    if (!canAnimate()) { settle(); return; }
    const token = generation;
    setState('opening');
    // A short gathering motion, continuous geometry, then a soft landing.
    // Content fades in after the small sphere has begun to open, avoiding a
    // hard circular mask cutting through full-size text.
    await Promise.all([
      animate(shell, [
        { transform: collapsedTransform(), borderRadius: '50%', opacity: 0, offset: 0, easing: 'ease-in-out' },
        { transform: collapsedTransform(.94), borderRadius: '50%', opacity: 1, offset: .14, easing: 'cubic-bezier(.18,.72,.24,1)' },
        { transform: 'translate3d(-1px,-1px,0) scale(1.006,1.004)', borderRadius: '25px', opacity: 1, offset: .83, easing: 'ease-out' },
        { transform: 'translate3d(0,0,0) scale(1,1)', borderRadius: '24px', opacity: 1, offset: 1 }
      ], timings.open, 'linear'),
      animate(orb, [{ opacity: 1, offset: 0 }, { opacity: 1, offset: .12 }, { opacity: 0, offset: .34 }, { opacity: 0, offset: 1 }], timings.open, 'linear'),
      ...contents.map(element => animate(element, [{ opacity: 0, offset: 0 }, { opacity: 0, offset: .2 }, { opacity: 1, offset: .72 }, { opacity: 1, offset: 1 }], timings.open, 'linear'))
    ]);
    if (token === generation) settle();
  }

  async function close({ returnFocus = false } = {}) {
    if (!desiredOpen) return;
    savedScrollTop = reading.scrollTop;
    cancelAnimations();
    desiredOpen = false;
    restoreOrbFocus = returnFocus;
    layout();
    // The closing page is visual only; it must not retain hidden keyboard targets.
    shell.inert = true;
    shell.setAttribute('aria-hidden', 'true');
    updateControls();
    status.textContent = 'AI 已收好。再次展开，对话与阅读位置还在。';
    if (!canAnimate()) { settle(); return; }
    const token = generation;
    setState('closing');
    const collapsed = collapsedTransform();
    shell.style.transformOrigin = '0 0';
    await Promise.all([
      animate(shell, [{ transform: 'translate3d(0,0,0) scale(1,1)', borderRadius: '24px' }, { transform: collapsed, borderRadius: '50%' }], timings.collapse, 'cubic-bezier(.48,0,.35,1)'),
      ...contents.map(element => animate(element, [{ opacity: 1 }, { opacity: 0, offset: .65 }, { opacity: 0 }], timings.collapse, 'linear'))
    ]);
    if (token !== generation) return;
    shell.style.transform = collapsed;
    shell.style.borderRadius = '50%';
    contents.forEach(element => { element.style.opacity = '0'; });
    setState('dissolving');
    await Promise.all([
      animate(shell, [{ opacity: 1 }, { opacity: 0 }], timings.dissolve),
      animate(orb, [{ opacity: 0 }, { opacity: 1 }], timings.dissolve)
    ]);
    if (token === generation) settle();
  }

  async function switchSide() {
    if (drag) endDrag(false);
    if (desiredOpen) savedScrollTop = reading.scrollTop;
    settle();
    const previous = { x: geometry.x, y: geometry.y };
    side = side === 'right' ? 'left' : 'right';
    layout();
    updateControls();
    status.textContent = `已放到${side === 'left' ? '左' : '右'}侧。${desiredOpen ? '阅读位置仍在。' : '点开就能继续看。'}`;
    if (desiredOpen || !canAnimate()) return;
    const token = generation;
    await animate(orb, [{ transform: transformAt(previous.x, previous.y) }, { transform: transformAt(geometry.x, geometry.y) }], timings.snap);
    if (token === generation) positionOrb();
  }

  function endDrag(shouldSnap) {
    if (!drag) return;
    const pointer = drag;
    drag = null;
    if (orb.hasPointerCapture(pointer.id)) orb.releasePointerCapture(pointer.id);
    if (!pointer.moved || !shouldSnap) {
      positionOrb();
      setState('closed');
      return;
    }
    suppressClick = true;
    clearTimeout(dragClickTimer);
    dragClickTimer = setTimeout(() => { suppressClick = false; }, 400);
    const previous = { x: pointer.x, y: pointer.y };
    side = pointer.x + geometry.size / 2 < geometry.width / 2 ? 'left' : 'right';
    normalizedY = clamp((pointer.y - geometry.margin) / (geometry.height - geometry.size - geometry.margin * 2), 0, 1);
    layout();
    updateControls();
    setState('closed');
    status.textContent = `已贴到${side === 'left' ? '左' : '右'}侧。再点开，继续刚才的对话。`;
    if (canAnimate()) animate(orb, [{ transform: transformAt(previous.x, previous.y) }, { transform: transformAt(geometry.x, geometry.y) }], timings.snap);
  }

  orb.addEventListener('pointerdown', event => {
    // Touch keeps native vertical page scrolling. The adjacent switch-side button
    // provides the same placement outcome without hijacking a phone gesture.
    if (event.pointerType !== 'mouse' || event.button !== 0 || desiredOpen || pageScrolling) return;
    settle();
    layout();
    drag = { id: event.pointerId, startX: event.clientX, startY: event.clientY, originX: geometry.x, originY: geometry.y, x: geometry.x, y: geometry.y, moved: false };
    orb.setPointerCapture(event.pointerId);
  });
  orb.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < 5) return;
    drag.moved = true;
    setState('dragging');
    drag.x = clamp(drag.originX + dx, 8, geometry.width - geometry.size - 8);
    drag.y = clamp(drag.originY + dy, geometry.margin, geometry.height - geometry.size - geometry.margin);
    positionOrb(drag.x, drag.y);
  });
  orb.addEventListener('pointerup', event => { if (drag && event.pointerId === drag.id) endDrag(true); });
  orb.addEventListener('pointercancel', () => endDrag(false));
  orb.addEventListener('lostpointercapture', () => { if (drag) endDrag(false); });
  orb.addEventListener('click', () => {
    if (suppressClick) { suppressClick = false; return; }
    open({ focus: true });
  });
  document.querySelectorAll('[data-orb-open]').forEach(button => button.addEventListener('click', () => open({ focus: true })));
  toggleButton.setAttribute('aria-controls', 'orb-web');
  toggleButton.addEventListener('click', () => desiredOpen ? close() : open({ focus: true }));
  sideButton.addEventListener('click', switchSide);
  // Only the simulated work environment is outside the floating window.
  // The explicit controls below the scene are demonstration controls, not app UI.
  stage.addEventListener('pointerdown', event => {
    if (!pinned && !shell.contains(event.target) && !orb.contains(event.target)) close();
  });
  stage.addEventListener('click', event => {
    if (!pinned && !shell.contains(event.target) && !orb.contains(event.target)) close();
  });
  function setScene(next) {
    if (!['desktop', 'fullscreen'].includes(next) || scene === next) return;
    stopForEnvironment();
    scene = next;
    updateControls();
    layout();
    status.textContent = next === 'fullscreen' ? '切到全屏工作页。悬浮 AI 仍在手边。' : '回到桌面。文稿和对话都保留着。';
  }
  function setPinned(next) {
    pinned = Boolean(next);
    updateControls();
    status.textContent = pinned ? '已钉住。现在点回文稿，AI 也不会收起。' : '已恢复自动收回。点回工作页，AI 就会让出位置。';
  }
  sceneButtons.forEach(button => button.addEventListener('click', () => setScene(button.dataset.orbScene)));
  modeButtons.forEach(button => button.addEventListener('click', () => setPinned(button.dataset.orbMode === 'pinned')));
  composer.addEventListener('input', () => { sendButton.disabled = !composer.value.trim(); });
  document.getElementById('orb-chat-form').addEventListener('submit', event => {
    event.preventDefault();
    const value = composer.value.trim();
    if (!value) return;
    const message = document.createElement('div');
    message.className = 'orb-message orb-message-user';
    const paragraph = document.createElement('p');
    paragraph.textContent = value;
    message.append(paragraph);
    conversation.append(message);
    const reply = document.createElement('div');
    reply.className = 'orb-message orb-message-assistant';
    const text = document.createElement('p');
    text.textContent = '这条补充已留在本地演示对话中。把上方清单复制到文稿，再填入负责人和验收时间，就可以开始安排了。';
    reply.append(text);
    conversation.append(reply);
    composer.value = '';
    sendButton.disabled = true;
    reading.scrollTop = reading.scrollHeight;
    savedScrollTop = reading.scrollTop;
    status.textContent = '补充已加入演示对话；内容没有发送给 AI 服务。';
  });
  copyButton.addEventListener('click', async () => {
    copyState = 'copying';
    copyPermissionError = '';
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
      // Clipboard writes happen only in this explicit user click handler.
      await navigator.clipboard.writeText(checklistText);
      copyState = 'copied';
      lastCopiedText = checklistText;
      copyButton.querySelector('span').textContent = '已复制';
      status.textContent = pinned ? '清单已复制。点进文稿，用系统粘贴继续编辑，AI 会保持展开。' : '清单已复制。点回文稿，用系统粘贴继续编辑。';
    } catch (error) {
      copyState = 'denied';
      copyPermissionError = error.name || String(error);
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(document.getElementById('orb-copy-source'));
      selection.removeAllRanges();
      selection.addRange(range);
      copyButton.querySelector('span').textContent = '请用系统复制';
      status.textContent = '浏览器未允许复制。已选中清单，请使用系统复制，再粘贴到文稿。';
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && desiredOpen && visible && stage.dataset.orbState === 'open') {
      event.preventDefault();
      close({ returnFocus: true });
    }
  });
  reading.addEventListener('scroll', () => { if (desiredOpen) savedScrollTop = reading.scrollTop; }, { passive: true });

  function stopForEnvironment() {
    if (drag) endDrag(false);
    if (desiredOpen) savedScrollTop = reading.scrollTop;
    settle();
  }
  window.addEventListener('page-scroll-start', () => { pageScrolling = true; stopForEnvironment(); });
  window.addEventListener('page-scroll-end', () => { pageScrolling = false; });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopForEnvironment(); });
  reduce.addEventListener('change', stopForEnvironment);
  new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    stage.dataset.orbVisible = String(visible);
    if (!visible) stopForEnvironment();
  }, { threshold: 0 }).observe(stage);
  new ResizeObserver(() => {
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    if (width === geometry.width && height === geometry.height) return;
    stopForEnvironment();
    layout();
  }).observe(stage);

  layout();
  updateControls();
  window.openMenubarOrbDemo = Object.freeze({
    open, close, switchSide, setScene, setPinned,
    getState: () => ({
      state: stage.dataset.orbState, side, isOpen: desiredOpen, scene, pinned,
      editorValue: editor.value, composerValue: composer.value, conversationMessages: conversation.querySelectorAll('.orb-message').length,
      copyState, copyPermissionError, lastCopiedText,
      articleScrollTop: reading.scrollTop, savedScrollTop, visible, pageScrolling,
      reducedMotion: reduce.matches, activeAnimations: animations.size,
      orbSize: geometry.size, timings: { ...timings },
      dragging: Boolean(drag), position: { x: geometry.x, y: geometry.y },
      stage: { width: geometry.width, height: geometry.height }, infiniteRAF: false
    })
  });
})();
