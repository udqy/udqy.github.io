// Minesweeper — a small, self-contained Windows 98 easter egg for retro mode.
// Exposes window.Minesweeper.{open, close}; main.js wires the launch buttons.
// Beginner board: 9x9 with 10 mines. First click is always safe.
(function () {
  const ROWS = 9, COLS = 9, MINES = 10;

  const win = document.getElementById('minesweeper-window');
  const grid = document.getElementById('ms-grid');
  const faceBtn = document.getElementById('ms-face');
  const mineLed = document.getElementById('ms-mines');
  const timeLed = document.getElementById('ms-timer');
  const closeBtn = document.getElementById('ms-close');
  if (!win || !grid || !faceBtn) return; // markup absent (shouldn't happen)

  let cells = [];        // flat array of {mine, revealed, flagged, adj, el}
  let started = false;   // mines placed yet?
  let over = false;
  let revealedCount = 0;
  let flags = 0;
  let timer = 0, timerId = null;

  const pad = (n) => String(Math.max(0, Math.min(999, n))).padStart(3, '0');
  const idx = (r, c) => r * COLS + c;
  const inBounds = (r, c) => r >= 0 && r < ROWS && c >= 0 && c < COLS;

  function neighbors(r, c) {
    const out = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        if (inBounds(r + dr, c + dc)) out.push([r + dr, c + dc]);
      }
    }
    return out;
  }

  function build() {
    grid.replaceChildren();
    cells = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'ms-cell';
        el.dataset.r = r;
        el.dataset.c = c;
        el.addEventListener('click', () => reveal(r, c));
        el.addEventListener('contextmenu', (e) => { e.preventDefault(); toggleFlag(r, c); });
        // Face reacts while pressing, like the original.
        el.addEventListener('pointerdown', () => { if (!over) faceBtn.textContent = '😮'; });
        grid.appendChild(el);
        cells.push({ mine: false, revealed: false, flagged: false, adj: 0, el });
      }
    }
  }

  function placeMines(safeR, safeC) {
    const forbidden = new Set([idx(safeR, safeC)]);
    neighbors(safeR, safeC).forEach(([r, c]) => forbidden.add(idx(r, c)));
    let placed = 0;
    while (placed < MINES) {
      const i = Math.floor(Math.random() * ROWS * COLS);
      if (forbidden.has(i) || cells[i].mine) continue;
      cells[i].mine = true;
      placed++;
    }
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (cells[idx(r, c)].mine) continue;
        cells[idx(r, c)].adj = neighbors(r, c).filter(([nr, nc]) => cells[idx(nr, nc)].mine).length;
      }
    }
  }

  function startTimer() {
    stopTimer();
    timerId = setInterval(() => { timer++; timeLed.textContent = pad(timer); }, 1000);
  }
  function stopTimer() { if (timerId) { clearInterval(timerId); timerId = null; } }

  function reveal(r, c) {
    if (over) return;
    const cell = cells[idx(r, c)];
    if (cell.revealed || cell.flagged) return;

    if (!started) { placeMines(r, c); started = true; startTimer(); }
    faceBtn.textContent = '🙂';

    if (cell.mine) { lose(r, c); return; }

    // Flood-fill reveal for zero-adjacency regions (iterative).
    const stack = [[r, c]];
    while (stack.length) {
      const [cr, cc] = stack.pop();
      const cur = cells[idx(cr, cc)];
      if (cur.revealed || cur.flagged || cur.mine) continue;
      cur.revealed = true;
      revealedCount++;
      cur.el.classList.add('revealed');
      if (cur.adj > 0) {
        cur.el.textContent = cur.adj;
        cur.el.dataset.n = cur.adj;
      } else {
        neighbors(cr, cc).forEach(([nr, nc]) => stack.push([nr, nc]));
      }
    }

    if (revealedCount === ROWS * COLS - MINES) winGame();
  }

  function toggleFlag(r, c) {
    if (over) return;
    const cell = cells[idx(r, c)];
    if (cell.revealed) return;
    cell.flagged = !cell.flagged;
    flags += cell.flagged ? 1 : -1;
    cell.el.textContent = cell.flagged ? '🚩' : '';
    mineLed.textContent = pad(MINES - flags);
  }

  function lose(r, c) {
    over = true;
    stopTimer();
    faceBtn.textContent = '😵';
    cells.forEach((cell) => {
      if (cell.mine) {
        cell.el.classList.add('revealed', 'mine');
        cell.el.textContent = '💣';
      } else if (cell.flagged) {
        cell.el.textContent = '❌'; // wrong flag
      }
    });
    cells[idx(r, c)].el.classList.add('exploded');
  }

  function winGame() {
    over = true;
    stopTimer();
    faceBtn.textContent = '😎';
    cells.forEach((cell) => {
      if (cell.mine && !cell.flagged) { cell.el.textContent = '🚩'; }
    });
    mineLed.textContent = pad(0);
  }

  function reset() {
    stopTimer();
    started = false; over = false; revealedCount = 0; flags = 0; timer = 0;
    faceBtn.textContent = '🙂';
    mineLed.textContent = pad(MINES);
    timeLed.textContent = pad(0);
    build();
  }

  faceBtn.addEventListener('click', reset);
  if (closeBtn) closeBtn.addEventListener('click', () => close());

  // --- Dragging the window by its title bar --------------------------------
  const bar = win.querySelector('.ms-titlebar');
  let dx = 0, dy = 0;
  if (bar) {
    let sx, sy, bx, by, dragging = false;
    bar.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.win98-controls')) return;
      dragging = true; sx = e.clientX; sy = e.clientY; bx = dx; by = dy;
      try { bar.setPointerCapture(e.pointerId); } catch (_) {}
      e.preventDefault();
    });
    bar.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      dx = bx + (e.clientX - sx); dy = by + (e.clientY - sy);
      win.style.transform = `translate(${dx}px, ${dy}px)`;
    });
    const end = (e) => { if (dragging) { dragging = false; try { bar.releasePointerCapture(e.pointerId); } catch (_) {} } };
    bar.addEventListener('pointerup', end);
    bar.addEventListener('pointercancel', end);
  }

  function open() {
    if (!win.classList.contains('open')) reset();
    win.classList.add('open');
    win.setAttribute('aria-hidden', 'false');
  }
  function close() {
    win.classList.remove('open');
    win.setAttribute('aria-hidden', 'true');
    stopTimer();
  }

  window.Minesweeper = { open, close };
})();
