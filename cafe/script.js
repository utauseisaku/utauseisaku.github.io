document.documentElement.classList.add('js');

// ---- 次の焙煎日（火曜と金曜） ----

const dateEl = document.getElementById('next-roast-date');

if (dateEl) {
  const WEEK = ['日', '月', '火', '水', '木', '金', '土'];
  const today = new Date();
  const next = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  for (let i = 0; i < 7; i += 1) {
    const day = next.getDay();
    if (day === 2 || day === 5) {
      break;
    }
    next.setDate(next.getDate() + 1);
  }

  const text = `${next.getMonth() + 1}月${next.getDate()}日（${WEEK[next.getDay()]}）`;
  dateEl.textContent = text;
  dateEl.setAttribute('datetime', `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`);
}

// ---- 小さなバネ ----
// 状態 {x, v, t, k, c}。a = -k(x - t) - c v を 1フレーム4分割で積分する。
// 動いているバネがあるときだけ requestAnimationFrame を回す。

const springs = new Map();
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let frame = 0;
let prevTime = 0;

// :root の "--spring-pop: 520 16;" を k と c に分けて読む
function springParams(name) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const parts = raw.split(/\s+/).map(Number);
  const k = Number.isFinite(parts[0]) && parts[0] > 0 ? parts[0] : 400;
  // 動きを減らす設定では行き過ぎないよう臨界減衰（c = 2√k）にする
  const c = reduceMotion.matches
    ? 2 * Math.sqrt(k)
    : (Number.isFinite(parts[1]) ? parts[1] : 2 * Math.sqrt(k) * 0.6);
  return { k, c };
}

function runSprings(now) {
  const dt = Math.min((now - prevTime) / 1000, 1 / 30);
  prevTime = now;
  const h = dt / 4;

  springs.forEach((s, id) => {
    for (let i = 0; i < 4; i += 1) {
      const a = -s.k * (s.x - s.t) - s.c * s.v;
      s.v += a * h;
      s.x += s.v * h;
    }
    if (Math.abs(s.x - s.t) < 0.001 && Math.abs(s.v) < 0.001) {
      s.x = s.t;
      s.v = 0;
      springs.delete(id);
    }
    s.render(s.x);
  });

  frame = springs.size > 0 ? requestAnimationFrame(runSprings) : 0;
}

function startSpring(id, from, to, params, render) {
  springs.set(id, { x: from, v: 0, t: to, k: params.k, c: params.c, render });
  render(from);
  if (!frame) {
    prevTime = performance.now();
    frame = requestAnimationFrame(runSprings);
  }
}

function stopSpring(id) {
  springs.delete(id);
}

// ---- 焙煎度の帯：名札を押すと味と値段が開く ----

const beans = Array.from(document.querySelectorAll('.bean'));

function panelOf(bean) {
  const id = bean.getAttribute('aria-controls');
  return id ? document.getElementById(id) : null;
}

// a. 名札を押したとき、ゴム印のように一度沈んで戻る
function pressBean(bean) {
  const params = springParams('--spring-pop');
  bean.style.setProperty('--press', '0.92');
  startSpring(bean, 0.92, 1, params, (x) => {
    bean.style.setProperty('--press', String(x));
  });
}

// b. 開いた味メモは、透明度と小さなずらしをバネで戻す
function showNote(panel) {
  const params = springParams('--spring-fade');
  panel.style.opacity = '0';
  panel.style.transform = 'translateY(8px)';
  panel.classList.add('is-open');
  startSpring(panel, 0, 1, params, (x) => {
    panel.style.opacity = String(Math.min(1, Math.max(0, x)));
    panel.style.transform = `translateY(${((1 - x) * 8).toFixed(3)}px)`;
  });
}

function closeAll() {
  beans.forEach((bean) => {
    bean.setAttribute('aria-expanded', 'false');
    const panel = panelOf(bean);
    if (panel) {
      stopSpring(panel);
      panel.classList.remove('is-open');
      panel.style.removeProperty('opacity');
      panel.style.removeProperty('transform');
    }
  });
}

beans.forEach((bean) => {
  bean.addEventListener('pointerdown', (event) => {
    if (event.button === 0) {
      pressBean(bean);
    }
  });

  bean.addEventListener('click', (event) => {
    // キーボードで押したときは pointerdown が来ないので、ここで沈ませる
    if (event.detail === 0) {
      pressBean(bean);
    }
    const wasOpen = bean.getAttribute('aria-expanded') === 'true';
    closeAll();
    if (wasOpen) {
      return;
    }
    const panel = panelOf(bean);
    if (!panel) {
      return;
    }
    bean.setAttribute('aria-expanded', 'true');
    showNote(panel);
  });
});

// 最初は先頭の豆（エチオピア）を開いておく。初期表示は動かさない。
if (beans.length > 0) {
  const first = beans[0];
  const panel = panelOf(first);
  if (panel) {
    first.setAttribute('aria-expanded', 'true');
    panel.classList.add('is-open');
  }
}

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') {
    return;
  }
  const openBean = document.querySelector('.bean[aria-expanded="true"]');
  if (!openBean) {
    return;
  }
  closeAll();
  openBean.focus();
});
