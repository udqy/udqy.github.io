function enableThemeToggle() {
  const toggles = document.querySelectorAll('#theme-toggle, .theme-toggle-btn');
  if (!toggles.length) return;
  const hlLink = document.querySelector('link#hl');
  function toggleTheme(theme) {
    if (theme == "dark") document.body.classList.add('dark'); else document.body.classList.remove('dark');
    if (hlLink) hlLink.href = `/giallo-${theme}.css`;
    sessionStorage.setItem("theme", theme);
    toggleGiscusTheme(theme);
  }
  function toggleGiscusTheme(theme) {
    const iframe = document.querySelector('iframe.giscus-frame');
    if (iframe) iframe.contentWindow.postMessage({ giscus: { setConfig: { theme: `${location.origin}/giscus_${theme}.css` } } }, 'https://giscus.app');
  }
  function initGiscusTheme(evt) {
    if (evt.origin !== 'https://giscus.app') return;
    if (!(typeof evt.data === 'object' && evt.data.giscus)) return;
    toggleGiscusTheme(sessionStorage.getItem("theme") || "light");
    window.removeEventListener('message', initGiscusTheme);
  }
  window.addEventListener('message', initGiscusTheme);
  toggles.forEach(t => t.addEventListener('click', () => toggleTheme(sessionStorage.getItem("theme") == "dark" ? "light" : "dark")));
  if (sessionStorage.getItem("theme") == "dark") toggleTheme("dark");
}

function enablePrerender() {
  const prerender = (a) => {
    if (!a.classList.contains('instant')) return;
    const script = document.createElement('script');
    script.type = 'speculationrules';
    script.textContent = JSON.stringify({ prerender: [{ source: 'list', urls: [a.href] }] });
    document.body.append(script);
    a.classList.remove('instant');
  }
  const prefetch = (a) => {
    if (!a.classList.contains('instant')) return;
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = a.href;
    document.head.append(link);
    a.classList.remove('instant');
  }
  const support = HTMLScriptElement.supports && HTMLScriptElement.supports('speculationrules');
  const handle = support ? prerender : prefetch;
  document.querySelectorAll('a.instant').forEach(a => {
    if (a.href.endsWith(window.location.pathname)) return;
    let timer;
    a.addEventListener('mouseenter', () => {
      timer = setTimeout(() => handle(a), 50);
    });
    a.addEventListener('mouseleave', () => clearTimeout(timer));
    a.addEventListener('touchstart', () => handle(a), { passive: true });
  });
}

function enableRssMask() {
  const rssBtn = document.querySelector('#rss-btn');
  const mask = document.querySelector('#rss-mask');
  const copyBtn = document.querySelector('#rss-mask button');
  if (!rssBtn || !mask) return;
  rssBtn.addEventListener('click', (e) => {
    e.preventDefault();
    mask.showModal();
  });
  const close = (e) => {
    if (e.target == mask) mask.close();
  };
  mask.addEventListener('click', close);
  const copy = () => {
    navigator.clipboard.writeText(copyBtn.dataset.link).then(() => {
      copyBtn.innerHTML = copyBtn.dataset.checkIcon;
      copyBtn.classList.add('copied');
      copyBtn.removeEventListener('click', copy);
      setTimeout(() => {
        mask.close();
        copyBtn.innerHTML = copyBtn.dataset.copyIcon;
        copyBtn.classList.remove('copied');
        copyBtn.addEventListener('click', copy);
      }, 400);
    });
  }
  copyBtn.addEventListener('click', copy);
}

function enableOutdateAlert() {
  const alert = document.querySelector('#outdate_alert');
  if (!alert) return;
  const publish = document.querySelector('#publish');
  const updated = document.querySelector('#updated');
  const updateDate = new Date(updated ? updated.textContent : publish.textContent);
  const intervalDays = Math.floor((Date.now() - updateDate.getTime()) / (24 * 60 * 60 * 1000));
  const alertDays = parseInt(alert.dataset.days);
  if (intervalDays >= alertDays) {
    const msg = alert.dataset.alertTextBefore + intervalDays + alert.dataset.alertTextAfter;
    alert.querySelector('.content').textContent = msg;
    alert.classList.remove('hidden');
  }
}

function enableTocTooltip() {
  const anchors = document.querySelectorAll('aside nav a');
  if (anchors.length == 0) return;
  const toggleTooltip = () => {
    anchors.forEach(anchor => {
      if (anchor.offsetWidth < anchor.scrollWidth) {
        anchor.setAttribute('title', anchor.textContent);
      } else {
        anchor.removeAttribute('title');
      }
    });
  };
  window.addEventListener('resize', toggleTooltip);
  toggleTooltip();
}

function addCopyBtns() {
  const cfg = document.querySelector('#copy-cfg');
  if (!cfg) return;
  const copyIcon = cfg.dataset.copyIcon;
  const checkIcon = cfg.dataset.checkIcon;
  document.querySelectorAll('pre').forEach(block => {
    if (block.classList.contains('mermaid')) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'codeblock';
    const btn = document.createElement('button');
    btn.className = 'copy';
    btn.ariaLabel = 'copy';
    btn.innerHTML = copyIcon;
    const copy = () => {
      navigator.clipboard.writeText(block.textContent).then(() => {
        btn.innerHTML = checkIcon;
        btn.classList.add('copied');
        btn.removeEventListener('click', copy);
        setTimeout(() => {
          btn.innerHTML = copyIcon;
          btn.classList.remove('copied');
          btn.addEventListener('click', copy);
        }, 1500);
      });
    };
    btn.addEventListener('click', copy);
    wrapper.appendChild(block.cloneNode(true));
    wrapper.appendChild(btn);
    block.replaceWith(wrapper);
  });
}

function addBackToTopBtn() {
  const backBtn = document.querySelector('#back-to-top');
  if (!backBtn) return;
  const toTop = () => window.scrollTo({ top: 0 });
  const toggle = () => {
    const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
    if (scrollTop > 200 && !backBtn.classList.contains('shown')) {
      backBtn.classList.add('shown');
      backBtn.setAttribute('tabindex', 0);
      backBtn.addEventListener('click', toTop);
    } else if (scrollTop <= 200 && backBtn.classList.contains('shown')) {
      backBtn.classList.remove('shown');
      backBtn.setAttribute('tabindex', -1);
      backBtn.removeEventListener('click', toTop);
    }
  };
  window.addEventListener('scroll', toggle);
  toggle();
}

function addFootnoteBacklink() {
  const footnotes = document.querySelectorAll('.footnote-definition');
  footnotes.forEach(footnote => {
    const backlink = document.createElement('button');
    backlink.className = 'backlink';
    backlink.ariaLabel = 'backlink';
    backlink.innerHTML = '↩︎';
    backlink.addEventListener('click', () => window.scrollTo({
      top: document.querySelector(`.footnote-reference a[href="#${footnote.id}"]`).getBoundingClientRect().top + window.scrollY,
    }));
    const lastEl = footnote.lastElementChild || footnote;
    lastEl.appendChild(backlink);
  });
}

function enableImgLightense() {
  window.addEventListener("load", () => Lightense(".prose img:not(.no-lightense)", { background: 'rgba(43, 43, 43, 0.19)' }));
}

function enableReaction() {
  const container = document.querySelector('.reaction');
  if (!container) return;
  const endpoint = container.dataset.endpoint;
  const slug = location.pathname.split('/').filter(Boolean).pop();
  const icons = {
    'like': '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>'
  };
  let state = { error: false, reaction: {} };
  const render = () => {
    const btns = Object.entries(state.reaction).map(([emoji, [count, reacted]])=> {
      const span = document.createElement('span');
      span.textContent = count;
      const btn = document.createElement('button');
      if (reacted) btn.classList.add('reacted');
      btn.insertAdjacentHTML('afterbegin', icons[emoji] || emoji);
      btn.append(span);
      btn.onclick = () => toggle(emoji);
      return btn;
    });
    if (state.error) {
      container.classList.add('error');
    } else {
      container.classList.remove('error');
    }
    container.replaceChildren(...btns);
  };
  const toggle = async (target) => {
    const [count, reacted] = state.reaction[target];
    state.reaction[target] = reacted ? [count - 1, false] : [count + 1, true];
    render();
    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ slug, target, reacted: !reacted }),
      });
      if (resp.status === 200) {
        error = false;
      } else {
        throw new Error();
      }
    } catch (err) {
      state.error = true;
      state.reaction[target] = [count, reacted];
      render();
    }
  };
  const init = async () => {
    const resp = await fetch(`${endpoint}?slug=${slug}`);
    if (resp.status === 200) {
      state.reaction = await resp.json();
      render();
    }
  };
  init();
}

enableThemeToggle();

function enableRetroToggle() {
  const body = document.body;
  const wrapper = document.querySelector('#wrapper');
  const floatBtn = document.querySelector('#retro-toggle');
  const startBtn = document.querySelector('#win98-start');
  const startMenu = document.querySelector('#win98-startmenu');
  let dragX = 0, dragY = 0; // window drag offset, reset each time retro opens

  // Build the window title bar once. It's hidden by CSS until retro is active,
  // so it never leaks into the normal-mode layout.
  if (wrapper && !wrapper.querySelector('.win98-titlebar')) {
    const bar = document.createElement('div');
    bar.className = 'win98-titlebar';

    const titleWrap = document.createElement('span');
    titleWrap.className = 'win98-title';
    const icon = document.createElement('span');
    icon.className = 'win98-icon';
    icon.textContent = '💻';
    const label = document.createElement('span');
    label.textContent = (document.title || 'Uday Jadhav').trim();
    titleWrap.append(icon, label);

    const controls = document.createElement('span');
    controls.className = 'win98-controls';
    for (const [glyph, aria, cls] of [['_', 'Minimize', ''], ['□', 'Maximize', ''], ['✕', 'Close', 'win98-close']]) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = glyph;
      b.setAttribute('aria-label', aria);
      if (cls) b.className = cls; else b.tabIndex = -1;
      controls.append(b);
    }
    bar.append(titleWrap, controls);
    wrapper.prepend(bar);
    bar.querySelector('.win98-close').addEventListener('click', () => setRetro(false));
  }

  // Drag the window by its title bar (retro only). Applied as a transform so it
  // never disturbs the normal-mode layout; the open-animation is cancelled on
  // grab so its forwards-fill can't clobber the drag transform.
  const titlebar = wrapper && wrapper.querySelector('.win98-titlebar');
  if (titlebar) {
    let startX, startY, baseX, baseY, dragging = false;
    titlebar.addEventListener('pointerdown', (e) => {
      if (!body.classList.contains('theme-98')) return;
      if (e.target.closest('.win98-controls')) return; // buttons aren't drag handles
      dragging = true;
      startX = e.clientX; startY = e.clientY;
      baseX = dragX; baseY = dragY;
      wrapper.style.animation = 'none';
      try { titlebar.setPointerCapture(e.pointerId); } catch (_) {}
      e.preventDefault();
    });
    titlebar.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      dragX = baseX + (e.clientX - startX);
      dragY = baseY + (e.clientY - startY);
      wrapper.style.transform = `translate(${dragX}px, ${dragY}px)`;
    });
    const endDrag = (e) => {
      if (!dragging) return;
      dragging = false;
      try { titlebar.releasePointerCapture(e.pointerId); } catch (_) {}
    };
    titlebar.addEventListener('pointerup', endDrag);
    titlebar.addEventListener('pointercancel', endDrag);
  }

  // A short, copyright-safe arpeggio in the spirit of the Win98 chime.
  function playBootChime() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      const now = ctx.currentTime;
      const master = ctx.createGain();
      master.gain.value = 0.18;
      master.connect(ctx.destination);
      [[523.25, 0], [659.25, 0.11], [783.99, 0.22], [1046.5, 0.33]].forEach(([f, t]) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'triangle';
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, now + t);
        g.gain.exponentialRampToValueAtTime(0.25, now + t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.9);
        o.connect(g); g.connect(master);
        o.start(now + t); o.stop(now + t + 0.95);
      });
      setTimeout(() => ctx.close().catch(() => {}), 1700);
    } catch (e) { /* audio blocked; not important */ }
  }

  // Re-run the window-open animation when toggling on without a reload.
  function replayWindowOpen() {
    if (!wrapper) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    wrapper.style.animation = 'none';
    void wrapper.offsetWidth;
    wrapper.style.animation = '';
  }

  function closeStartMenu() {
    if (!startMenu) return;
    startMenu.classList.remove('open');
    startMenu.setAttribute('aria-hidden', 'true');
    if (startBtn) { startBtn.classList.remove('open'); startBtn.setAttribute('aria-expanded', 'false'); }
  }
  function toggleStartMenu() {
    if (!startMenu || !startBtn) return;
    const open = !startMenu.classList.contains('open');
    startMenu.classList.toggle('open', open);
    startMenu.setAttribute('aria-hidden', String(!open));
    startBtn.classList.toggle('open', open);
    startBtn.setAttribute('aria-expanded', String(open));
  }

  function setRetro(on) {
    body.classList.toggle('theme-98', on);
    localStorage.setItem('theme-98', on ? 'on' : 'off');
    if (floatBtn) floatBtn.setAttribute('aria-pressed', String(on));
    // Mutually exclusive with Arch mode — turning retro on evicts the rice skin.
    if (on) {
      body.classList.remove('theme-arch');
      localStorage.setItem('theme-arch', 'off');
      const archBtn = document.querySelector('#arch-toggle');
      if (archBtn) archBtn.setAttribute('aria-pressed', 'false');
    }
    // Always drop any drag offset so the window recentres and the inline
    // transform never leaks into the normal (non-retro) layout.
    dragX = 0; dragY = 0;
    if (wrapper) { wrapper.style.transform = ''; wrapper.style.animation = ''; }
    if (on) {
      replayWindowOpen();
      playBootChime();
    } else {
      closeStartMenu();
    }
  }

  if (floatBtn) {
    floatBtn.setAttribute('aria-pressed', String(body.classList.contains('theme-98')));
    floatBtn.addEventListener('click', () => setRetro(!body.classList.contains('theme-98')));
  }
  const trayToggle = document.querySelector('#win98-tray-toggle');
  if (trayToggle) trayToggle.addEventListener('click', () => setRetro(false));
  const shutdown = document.querySelector('#win98-shutdown');
  if (shutdown) shutdown.addEventListener('click', () => setRetro(false));

  // Minesweeper launchers (Start menu item + desktop icon).
  const launchMines = () => { if (window.Minesweeper) window.Minesweeper.open(); };
  const minesMenuItem = document.querySelector('#win98-launch-mines');
  if (minesMenuItem) minesMenuItem.addEventListener('click', () => { closeStartMenu(); launchMines(); });
  const minesDeskIcon = document.querySelector('#desk-mines');
  if (minesDeskIcon) minesDeskIcon.addEventListener('click', launchMines);
  if (startBtn) startBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleStartMenu(); });
  document.addEventListener('click', (e) => {
    if (startMenu && startMenu.classList.contains('open') && !startMenu.contains(e.target) && e.target !== startBtn) {
      closeStartMenu();
    }
  });

  // Taskbar clock.
  const clock = document.querySelector('#win98-clock');
  if (clock) {
    const tick = () => {
      const d = new Date();
      let h = d.getHours();
      const m = String(d.getMinutes()).padStart(2, '0');
      const ap = h < 12 ? 'AM' : 'PM';
      h = h % 12 || 12;
      clock.textContent = `${h}:${m} ${ap}`;
    };
    tick();
    setInterval(tick, 15000);
  }
}

function enableArchToggle() {
  const body = document.body;
  const bar = document.querySelector('#arch-bar');
  const toggleBtn = document.querySelector('#arch-toggle');
  const powerBtn = document.querySelector('#arch-power');
  if (!bar && !toggleBtn) return;

  function setArch(on) {
    body.classList.toggle('theme-arch', on);
    localStorage.setItem('theme-arch', on ? 'on' : 'off');
    if (toggleBtn) toggleBtn.setAttribute('aria-pressed', String(on));
    // Mutually exclusive with Win98 — turning the rice on evicts retro mode.
    if (on) {
      body.classList.remove('theme-98');
      localStorage.setItem('theme-98', 'off');
      const retroBtn = document.querySelector('#retro-toggle');
      if (retroBtn) retroBtn.setAttribute('aria-pressed', 'false');
      // Play the "window open" animation only on this deliberate toggle, not on
      // page navigations (the pre-paint guard never adds this class on reload).
      const wrapper = document.querySelector('#wrapper');
      if (wrapper) {
        wrapper.classList.add('hypr-anim');
        wrapper.addEventListener('animationend', () => wrapper.classList.remove('hypr-anim'), { once: true });
      }
    }
  }

  if (toggleBtn) {
    toggleBtn.setAttribute('aria-pressed', String(body.classList.contains('theme-arch')));
    toggleBtn.addEventListener('click', () => setArch(!body.classList.contains('theme-arch')));
  }
  if (powerBtn) powerBtn.addEventListener('click', () => setArch(false));

  // Focused-window title in the bar centre = the page title.
  const titleEl = document.querySelector('#arch-window-title');
  if (titleEl) titleEl.textContent = (document.title || 'uday@arch').trim();

  // Highlight the workspace for the current page (posts live under /blog).
  const path = location.pathname;
  document.querySelectorAll('#arch-ws .ws').forEach(ws => {
    const href = ws.getAttribute('href');
    const match = href === '/' ? (path === '/' || path === '') : path.startsWith(href);
    ws.classList.toggle('active', match);
  });

  // Neofetch dynamic fields (homepage only). Real values where the browser
  // exposes them; CPU load isn't available anywhere, so the bar fakes that.
  const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  const cores = navigator.hardwareConcurrency || 8;
  const memGB = navigator.deviceMemory || 8;
  setText('arch-res', `${screen.width}x${screen.height}`);
  setText('arch-cores', String(cores));
  setText('arch-mem-total', `${memGB} GiB`);

  // Live "uptime" — honest session time since the page loaded.
  const fmtUptime = (s) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
    if (h) return `${h}h ${m}m`;
    if (m) return `${m}m ${sec}s`;
    return `${sec}s`;
  };
  const t0 = performance.now();
  const tickUptime = () => setText('arch-uptime', fmtUptime((performance.now() - t0) / 1000));
  tickUptime();
  setInterval(tickUptime, 1000);

  // Bar clock.
  const clock = document.getElementById('arch-clock');
  if (clock) {
    const tick = () => {
      const d = new Date();
      clock.textContent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    };
    tick();
    setInterval(tick, 10000);
  }

  // Fake-but-plausible CPU load (unreadable in a browser) — a gentle random walk.
  const cpuEl = document.getElementById('arch-cpu');
  if (cpuEl) {
    let cpu = 12;
    setInterval(() => {
      cpu = Math.max(2, Math.min(78, cpu + (Math.random() * 18 - 9)));
      cpuEl.textContent = `${Math.round(cpu)}%`;
    }, 1800);
    cpuEl.textContent = `${cpu}%`;
  }

  // Memory module: real total, plausible fluctuating "used".
  const memEl = document.getElementById('arch-mem');
  if (memEl) {
    const upd = () => {
      const used = (memGB * (0.35 + Math.random() * 0.3)).toFixed(1);
      memEl.textContent = `${used}/${memGB}G`;
    };
    upd();
    setInterval(upd, 3200);
  }

}

function enableVisitorCount() {
  const el = document.querySelector('#visitor-count');
  if (!el) return;

  fetch(el.dataset.endpoint)
    .then(resp => resp.ok ? resp.json() : Promise.reject(resp.status))
    .then(({ visitors }) => {
      if (typeof visitors !== 'number') return;
      // toLocaleString gives the reader their own thousands separator.
      el.textContent = `${visitors.toLocaleString()} ${el.dataset.text}`;
      el.hidden = false;
    })
    .catch(() => { /* leave it hidden rather than show a broken or zero count */ });
}

enableRetroToggle();
enableArchToggle();
enableVisitorCount();
enablePrerender();
enableRssMask();
if (document.body.classList.contains('post')) {
  enableOutdateAlert();
  addBackToTopBtn();
  enableTocTooltip();
}
if (document.querySelector('.prose')) {
  addCopyBtns();
  addFootnoteBacklink();
  enableImgLightense();
  enableReaction();
}
