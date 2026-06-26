// ! =============================================
// ! 쇼핑 도파민 월드 — "30초 만에 백화점 털기"
// ! 레트로 아케이드 드래그 캐치 게임
// ! =============================================

// ! [S] 롯데 앱 iframe 높이 자동조정 (NAS/WebView 대응)
function setHeight2() {
  try {
    var parentIframe = $("#container", parent.document).find("iframe");
    var eventBox = document.querySelector('.eventBox');
    if (!eventBox) return;
    var origEB = eventBox.style.minHeight;
    eventBox.style.minHeight = '0px';
    void eventBox.offsetHeight;
    var h = Math.max(eventBox.scrollHeight, eventBox.offsetHeight);
    eventBox.style.minHeight = origEB || '';
    $(parentIframe).height(h + 17).css("min-height", "auto");
  } catch (e) {}
}
function reportHeightDelayed() { setTimeout(setHeight2, 400); }
// ! [E]

// ! [S] 게임 데이터 — 명품 아이템 / 방해물
var GOOD_ITEMS = [
  { emoji: '👑', name: '골드 왕관',     price: 80000000, w: 1 },
  { emoji: '💎', name: '다이아 반지',   price: 50000000, w: 2 },
  { emoji: '⌚', name: '명품 시계',     price: 30000000, w: 3 },
  { emoji: '👜', name: '명품 핸드백',   price: 15000000, w: 5 },
  { emoji: '🧥', name: '캐시미어 코트', price: 3000000,  w: 7 },
  { emoji: '👗', name: '디자이너 원피스', price: 1200000, w: 8 },
  { emoji: '👠', name: '하이힐',        price: 800000,   w: 9 },
  { emoji: '🕶️', name: '명품 선글라스', price: 450000,   w: 9 },
  { emoji: '🌹', name: '시그니처 향수', price: 250000,   w: 10 },
  { emoji: '💄', name: '립스틱 세트',   price: 150000,   w: 11 },
  { emoji: '🎂', name: '호텔 케이크',   price: 80000,    w: 9 }
];
var BAD_ITEMS = [
  { emoji: '🧾', name: '영수증 폭탄',   type: 'bomb' },
  { emoji: '💸', name: '마일리지 차감', type: 'mileage' }
];
var BAD_CHANCE = 0.30;        // 방해물 등장 확률 (난이도 ↑)
var GAME_TIME = 30;           // 제한시간(초)
var ITEM_SIZE = 64;           // 떨어지는 아이템 크기(px)
// ! [E]

// ! [S] 상태
var state = {
  running: false,
  money: 0,
  combo: 0,
  maxCombo: 0,
  caughtCount: 0,
  items: [],          // 활성 낙하 아이템
  caughtLog: {},       // 영수증용 집계 {name:{emoji,price,count}}
  timeLeft: GAME_TIME,
  basketX: 0,
  moveDir: 0,          // 방향키/버튼 이동 (-1,0,1)
  lastSpawn: 0,
  lastTime: 0,
  rafId: null,
  timerId: null
};

var stageEl, basketEl, bagEl, flashEl;
var stageW = 0, stageH = 0;
var basketW = 84, basketTopOffset = 90; // 바닥에서 캐치 영역(쇼핑백 입구 높이)
var basketSpeed = 600;                  // 방향키 이동 속도(px/sec) — sizeStage에서 갱신

// 영수증 캔버스에 그릴 LOTTE 로고 (미리 로드)
var logoImg = new Image();
logoImg.src = 'img/lotte-logo.png';
// ! [E]

// ! [S] 화면 전환
function showScr(id) {
  document.querySelectorAll('.screen, .flex-mid').forEach(function (s) { s.classList.remove('active'); });
  document.getElementById(id).classList.add('active');
  try { window.scrollTo(0, 0); } catch (e) {}
  reportHeightDelayed();
}
// ! [E]

// ! [S] 무대 사이즈 세팅
function sizeStage() {
  // 모바일 화면 높이에 맞춰 무대 높이 동적 조정
  var vh = window.innerHeight || 640;
  var h = Math.min(Math.max(vh - 210, 360), 540);
  stageEl.style.height = h + 'px';
  var r = stageEl.getBoundingClientRect();
  stageW = r.width;
  stageH = h;
  basketSpeed = stageW * 1.7; // 화면 폭 비례 이동 속도
}
// ! [E]

// ! [S] 가중치 랜덤 아이템
function pickGood() {
  var total = 0, i;
  for (i = 0; i < GOOD_ITEMS.length; i++) total += GOOD_ITEMS[i].w;
  var r = Math.random() * total;
  for (i = 0; i < GOOD_ITEMS.length; i++) {
    r -= GOOD_ITEMS[i].w;
    if (r <= 0) return GOOD_ITEMS[i];
  }
  return GOOD_ITEMS[GOOD_ITEMS.length - 1];
}
// ! [E]

// ! [S] 금액 포맷 (한글)
function koreanMoney(v) {
  v = Math.max(0, Math.round(v));
  if (v === 0) return '0원';
  var eok = Math.floor(v / 100000000);
  var man = Math.floor((v % 100000000) / 10000);
  var rest = v % 10000;
  var s = '';
  if (eok) s += eok.toLocaleString() + '억 ';
  if (man) s += man.toLocaleString() + '만 ';
  if (rest) s += rest.toLocaleString();
  return s.trim() + '원';
}
function commaMoney(v) { return Math.round(v).toLocaleString() + '원'; }
// ! [E]

// ! [S] 콤보 배수
function comboMultiplier() {
  // 5콤보마다 +0.5배, 최대 x3
  var m = 1 + Math.floor(state.combo / 5) * 0.5;
  return Math.min(m, 3);
}
// ! [E]

// ! [S] 아이템 스폰
function spawnItem(now) {
  var frenzy = state.timeLeft <= 10;                 // 마지막 10초 가속 구간
  var badChance = BAD_CHANCE + (frenzy ? 0.12 : 0);  // 방해물 더 자주
  var isBad = Math.random() < badChance;
  var data, el;
  el = document.createElement('div');
  el.className = 'item' + (isBad ? ' bad' : ' good');

  if (isBad) {
    data = BAD_ITEMS[Math.floor(Math.random() * BAD_ITEMS.length)];
    el.innerHTML =
      '<div class="item-orb bad"><span class="item-emoji">' + data.emoji + '</span></div>' +
      '<span class="item-tag minus">⚠ ' + (data.type === 'bomb' ? '폭탄' : '-마일') + '</span>';
  } else {
    data = pickGood();
    el.innerHTML =
      '<div class="item-orb good"><span class="item-emoji">' + data.emoji + '</span></div>' +
      '<span class="item-tag plus">+' + shortPrice(data.price) + '</span>';
  }

  var x = Math.random() * (stageW - ITEM_SIZE);
  // 시간이 지날수록 낙하 속도 증가 (난이도 ↑)
  var prog = 1 - (state.timeLeft / GAME_TIME); // 0 -> 1
  var baseSpeed = 200 + prog * 240;            // px/sec
  var speed = baseSpeed + Math.random() * 120;
  if (frenzy) speed *= 1.35;                   // 막판 스퍼트: 속도 급상승

  var item = {
    el: el, x: x, y: -ITEM_SIZE, speed: speed,
    isBad: isBad, data: data, caught: false
  };
  el.style.transform = 'translate(' + x + 'px,' + item.y + 'px)';
  stageEl.appendChild(el);
  state.items.push(item);
}
function shortPrice(p) {
  if (p >= 100000000) return (p / 100000000) + '억';
  if (p >= 10000) return (p / 10000) + '만';
  return p.toLocaleString();
}
// ! [E]

// ! [S] 메인 루프
function loop(now) {
  if (!state.running) return;
  if (!state.lastTime) state.lastTime = now;
  var dt = (now - state.lastTime) / 1000;
  if (dt > 0.05) dt = 0.05; // 탭 비활성 등 큰 점프 방지
  state.lastTime = now;

  // 스폰 간격 (시간 지날수록 빨라짐, 난이도 ↑)
  var prog = 1 - (state.timeLeft / GAME_TIME);
  var frenzy = state.timeLeft <= 10;
  var spawnGap = 600 - prog * 360; // ms (600 -> 240)
  if (frenzy) spawnGap -= 90;       // 막판 스퍼트: 더 촘촘하게
  if (now - state.lastSpawn > spawnGap) {
    spawnItem(now);
    // 후반부엔 동시에 2개씩 떨어지기도 (막판엔 확률 ↑)
    var doubleChance = frenzy ? 0.6 : (prog > 0.45 ? 0.35 : 0);
    if (Math.random() < doubleChance) spawnItem(now);
    state.lastSpawn = now;
  }

  // 방향키/방향버튼 이동 처리
  if (state.moveDir !== 0) {
    state.basketX += state.moveDir * basketSpeed * dt;
    state.basketX = Math.max(0, Math.min(state.basketX, stageW - basketW));
    basketEl.style.transform = 'translateX(' + state.basketX + 'px)';
  }

  var basketCenter = state.basketX + basketW / 2;
  var catchTop = stageH - basketTopOffset;

  for (var i = state.items.length - 1; i >= 0; i--) {
    var it = state.items[i];
    if (it.caught) continue;
    it.y += it.speed * dt;
    it.el.style.transform = 'translate(' + it.x + 'px,' + it.y + 'px)';

    var itemCenter = it.x + ITEM_SIZE / 2;
    var itemBottom = it.y + ITEM_SIZE;

    // 캐치 판정
    if (itemBottom >= catchTop && it.y < stageH - 12) {
      if (Math.abs(itemCenter - basketCenter) < basketW / 2 + 8) {
        catchItem(it);
        continue;
      }
    }
    // 화면 밖
    if (it.y > stageH + 10) {
      removeItem(i);
    }
  }

  state.rafId = requestAnimationFrame(loop);
}
// ! [E]

// ! [S] 캐치 처리
function catchItem(it) {
  it.caught = true;
  var idx = state.items.indexOf(it);
  if (idx > -1) state.items.splice(idx, 1);

  if (it.isBad) {
    // 방해물: 쇼핑백에 안 담기고 튕겨 나감
    bounceAway(it);
    handleBad(it);
  } else {
    // 명품: 쇼핑백 안으로 빨려 들어감
    collectInto(it);
    var mult = comboMultiplier();
    var gain = Math.round(it.data.price * mult);
    state.money += gain;
    state.combo++;
    if (state.combo > state.maxCombo) state.maxCombo = state.combo;
    state.caughtCount++;

    var key = it.data.name;
    if (!state.caughtLog[key]) state.caughtLog[key] = { emoji: it.data.emoji, price: it.data.price, count: 0 };
    state.caughtLog[key].count++;

    spawnFloater('+' + koreanMoney(gain) + (mult > 1 ? ' x' + mult : ''), it.x, it.y, true);
    pulseBag('good');
    updateCombo();
    updateMoney();
  }
}

// 명품 → 쇼핑백 안으로 흡수되는 애니메이션
function collectInto(it) {
  var targetX = state.basketX + basketW / 2 - ITEM_SIZE / 2;
  var targetY = stageH - 46;
  it.el.style.zIndex = '5';
  it.el.style.transition = 'transform 0.26s cubic-bezier(0.5,0,0.7,1), opacity 0.26s ease-in';
  // 다음 프레임에 트랜지션 적용
  requestAnimationFrame(function () {
    it.el.style.transform = 'translate(' + targetX + 'px,' + targetY + 'px) scale(0.25)';
    it.el.style.opacity = '0';
  });
  setTimeout(function () { if (it.el.parentNode) it.el.parentNode.removeChild(it.el); }, 290);
}

// 방해물 → 위로 튕겨 나가는 애니메이션
function bounceAway(it) {
  var dir = (it.x + ITEM_SIZE / 2 < state.basketX + basketW / 2) ? -1 : 1;
  var bx = it.x + dir * 130;
  var by = it.y - 90;
  it.el.style.zIndex = '7';
  it.el.style.transition = 'transform 0.45s cubic-bezier(0.2,0.8,0.4,1), opacity 0.45s ease-out';
  requestAnimationFrame(function () {
    it.el.style.transform = 'translate(' + bx + 'px,' + by + 'px) rotate(' + (dir * 160) + 'deg) scale(0.7)';
    it.el.style.opacity = '0';
  });
  setTimeout(function () { if (it.el.parentNode) it.el.parentNode.removeChild(it.el); }, 470);
}

function handleBad(it) {
  var lost;
  if (it.data.type === 'bomb') {
    lost = Math.round(state.money * 0.3);
    state.money -= lost;
    spawnFloater('💥 -' + koreanMoney(lost), it.x, it.y, false);
    flashScreen();
  } else { // mileage
    lost = 5000000;
    state.money = Math.max(0, state.money - lost);
    spawnFloater('💸 -' + koreanMoney(lost), it.x, it.y, false);
  }
  state.combo = 0;
  pulseBag('bad'); // 위치 이동 없이 번쩍임만
  updateCombo();
  updateMoney(true);
}

// 쇼핑백 반응 (위치 이동 X — bag 내부 요소만 연출)
function pulseBag(type) {
  if (!bagEl) return;
  var cls = type === 'bad' ? 'hit-bad' : 'hit-good';
  bagEl.classList.remove('hit-bad', 'hit-good');
  void bagEl.offsetWidth;
  bagEl.classList.add(cls);
}

function removeItem(i) {
  var it = state.items[i];
  if (it.el.parentNode) it.el.parentNode.removeChild(it.el);
  state.items.splice(i, 1);
  // 좋은 아이템 놓치면 콤보 끊김
  if (!it.isBad) { state.combo = 0; updateCombo(); }
}
// ! [E]

// ! [S] 떠오르는 점수 / 화면 플래시
function spawnFloater(txt, x, y, isPlus) {
  var f = document.createElement('div');
  f.className = 'floater ' + (isPlus ? 'plus' : 'minus');
  f.textContent = txt;
  f.style.left = Math.min(Math.max(x - 10, 4), stageW - 120) + 'px';
  f.style.top = Math.max(y, 10) + 'px';
  stageEl.appendChild(f);
  setTimeout(function () { if (f.parentNode) f.parentNode.removeChild(f); }, 950);
}
function flashScreen() {
  flashEl.classList.remove('go'); void flashEl.offsetWidth; flashEl.classList.add('go');
}
// ! [E]

// ! [S] HUD 갱신
function updateMoney(danger) {
  var el = document.getElementById('moneyVal');
  el.textContent = koreanMoney(state.money);
  if (danger) { el.classList.remove('danger'); void el.offsetWidth; el.classList.add('danger'); }
}
function updateCombo() {
  var tag = document.getElementById('comboTag');
  if (state.combo >= 3) {
    var mult = comboMultiplier();
    tag.textContent = '🔥 ' + state.combo + ' COMBO' + (mult > 1 ? '  x' + mult + '배!' : '');
    tag.classList.add('show');
  } else {
    tag.classList.remove('show');
  }
}
function updateTimer() {
  document.getElementById('timeVal').textContent = state.timeLeft;
  var bar = document.getElementById('timeBar');
  var pct = (state.timeLeft / GAME_TIME) * 100;
  bar.style.width = pct + '%';
  if (state.timeLeft <= 5) bar.classList.add('low'); else bar.classList.remove('low');
}
// ! [E]

// ! [S] 바스켓 조작 (드래그)
function moveBasketTo(clientX) {
  var r = stageEl.getBoundingClientRect();
  var x = clientX - r.left - basketW / 2;
  x = Math.max(0, Math.min(x, stageW - basketW));
  state.basketX = x;
  basketEl.style.transform = 'translateX(' + x + 'px)';
}
function bindControls() {
  stageEl.addEventListener('touchstart', onTouch, { passive: false });
  stageEl.addEventListener('touchmove', onTouch, { passive: false });
  stageEl.addEventListener('mousedown', onMouseDown);
}
function onTouch(e) {
  if (!state.running) return;
  if (e.cancelable) e.preventDefault();
  var t = e.touches[0];
  if (t) moveBasketTo(t.clientX);
}
var mouseDown = false;
function onMouseDown(e) { mouseDown = true; moveBasketTo(e.clientX); }
function onMouseMove(e) { if (mouseDown && state.running) moveBasketTo(e.clientX); }
function onMouseUp() { mouseDown = false; }

// 방향 버튼 / 키보드 (꾹 누르면 연속 이동)
function holdDir(d, e) { if (e && e.cancelable) e.preventDefault(); state.moveDir = d; }
function releaseDir(d) { if (state.moveDir === d) state.moveDir = 0; }
function bindDirButtons() {
  var L = document.getElementById('leftBtn');
  var R = document.getElementById('rightBtn');
  if (L) {
    L.addEventListener('touchstart', function (e) { holdDir(-1, e); }, { passive: false });
    L.addEventListener('touchend', function () { releaseDir(-1); });
    L.addEventListener('touchcancel', function () { releaseDir(-1); });
    L.addEventListener('mousedown', function (e) { holdDir(-1, e); });
    L.addEventListener('mouseup', function () { releaseDir(-1); });
    L.addEventListener('mouseleave', function () { releaseDir(-1); });
  }
  if (R) {
    R.addEventListener('touchstart', function (e) { holdDir(1, e); }, { passive: false });
    R.addEventListener('touchend', function () { releaseDir(1); });
    R.addEventListener('touchcancel', function () { releaseDir(1); });
    R.addEventListener('mousedown', function (e) { holdDir(1, e); });
    R.addEventListener('mouseup', function () { releaseDir(1); });
    R.addEventListener('mouseleave', function () { releaseDir(1); });
  }
  document.addEventListener('keydown', function (e) {
    if (!state.running) return;
    if (e.key === 'ArrowLeft') { state.moveDir = -1; e.preventDefault(); }
    else if (e.key === 'ArrowRight') { state.moveDir = 1; e.preventDefault(); }
  });
  document.addEventListener('keyup', function (e) {
    if (e.key === 'ArrowLeft') releaseDir(-1);
    else if (e.key === 'ArrowRight') releaseDir(1);
  });
}
// ! [E]

// ! [S] 게임 시작 / 카운트다운
function startCountdown() {
  showScr('countScreen');
  sizeStage();
  var nums = ['3', '2', '1'];
  var i = 0;
  var numEl = document.getElementById('countNum');
  numEl.textContent = nums[0];
  numEl.className = 'count-num';
  var tick = setInterval(function () {
    i++;
    if (i < nums.length) {
      numEl.textContent = nums[i];
      numEl.className = 'count-num';
      void numEl.offsetWidth; numEl.className = 'count-num';
      numEl.style.animation = 'none'; void numEl.offsetWidth; numEl.style.animation = '';
    } else {
      clearInterval(tick);
      numEl.textContent = 'GO!';
      numEl.className = 'count-go';
      setTimeout(beginGame, 650);
    }
  }, 750);
}

function beginGame() {
  // 상태 초기화
  state.running = true;
  state.money = 0;
  state.combo = 0;
  state.maxCombo = 0;
  state.caughtCount = 0;
  state.items = [];
  state.caughtLog = {};
  state.timeLeft = GAME_TIME;
  state.lastSpawn = 0;
  state.lastTime = 0;
  state.moveDir = 0;

  showScr('gameScreen');
  sizeStage();

  // 기존 아이템 정리
  stageEl.querySelectorAll('.item, .floater').forEach(function (n) { n.parentNode.removeChild(n); });

  state.basketX = (stageW - basketW) / 2;
  basketEl.style.transform = 'translateX(' + state.basketX + 'px)';

  updateMoney();
  updateCombo();
  updateTimer();

  state.lastTime = 0;
  state.rafId = requestAnimationFrame(loop);

  // 1초 타이머
  state.timerId = setInterval(function () {
    state.timeLeft--;
    if (state.timeLeft === 10) showBanner('⚡ 막판 스퍼트! ⚡<br>난이도 UP!');
    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      updateTimer();
      endGame();
    } else {
      updateTimer();
    }
  }, 1000);
}

// 마지막 10초 알림 배너
function showBanner(html) {
  var b = document.createElement('div');
  b.className = 'stage-banner';
  b.innerHTML = html;
  stageEl.appendChild(b);
  setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 1450);
}
// ! [E]

// ! [S] 게임 종료
function endGame() {
  state.running = false;
  state.moveDir = 0;
  if (state.rafId) cancelAnimationFrame(state.rafId);
  if (state.timerId) clearInterval(state.timerId);
  // 남은 아이템 제거
  stageEl.querySelectorAll('.item, .floater').forEach(function (n) { n.parentNode.removeChild(n); });
  state.items = [];
  buildResult();
  showScr('resultScreen');
}
// ! [E]

// ! [S] 랭크 산정
function getRank(money) {
  if (money >= 1000000000) return { ttl: '👑 백화점 정복자', sub: '오늘 밤 주인공은 나야 나!!' };
  if (money >= 500000000)  return { ttl: '💎 탕진잼 레전드',  sub: '플렉스의 신이 강림하셨다' };
  if (money >= 200000000)  return { ttl: '🔥 VVIP 플렉서',    sub: '카드값은 나중에 생각하자' };
  if (money >= 100000000)  return { ttl: '🛍️ 쇼핑 고수',      sub: '억 소리 나는 손맛!' };
  if (money >= 30000000)   return { ttl: '✨ 알뜰 플렉서',     sub: '제법인데? 다음엔 억대 도전!' };
  if (money >= 5000000)    return { ttl: '🌱 쇼핑 새싹',       sub: '몸풀기는 끝났어, 다시 ㄱㄱ' };
  return { ttl: '🐣 다음 기회에...', sub: '영수증 폭탄 조심하세요!' };
}
// ! [E]

// ! [S] 결과 화면 구성
function buildResult() {
  var rank = getRank(state.money);

  // 영수증 품목 (금액 큰 순 정렬)
  var rows = Object.keys(state.caughtLog).map(function (k) {
    return { name: k, emoji: state.caughtLog[k].emoji, price: state.caughtLog[k].price, count: state.caughtLog[k].count };
  });
  rows.sort(function (a, b) { return (b.price * b.count) - (a.price * a.count); });

  var html = '';
  if (rows.length === 0) {
    html = '<div class="rc-item"><span class="rc-name">담은 상품 없음 😢</span><span class="rc-amt">0원</span></div>';
  } else {
    rows.forEach(function (r) {
      html += '<div class="rc-item"><span class="rc-name">' + r.emoji + ' ' + r.name +
        ' x' + r.count + '</span><span class="rc-amt">' + commaMoney(r.price * r.count) + '</span></div>';
    });
  }
  document.getElementById('rcItems').innerHTML = html;
  document.getElementById('rcTotal').textContent = koreanMoney(state.money);
  document.getElementById('rcRank').innerHTML = rank.ttl + '<span class="rc-rank-sub">' + rank.sub + '</span>';

  document.getElementById('statCount').textContent = state.caughtCount + '개';
  document.getElementById('statCombo').textContent = state.maxCombo + '콤보';

  // 영수증 번호
  var no = String(Math.floor(Math.random() * 900000) + 100000);
  document.getElementById('rcFoot').textContent = 'NO.' + no + ' · 2026 LOTTE · THANK YOU';

  state._rank = rank;
}
// ! [E]

// ! [S] 영수증 캔버스 (이미지 저장용) — 깔끔한 배경, 금액 강조
function buildReceiptCanvas() {
  var W = 420, H = 780;
  var cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  var ctx = cv.getContext('2d');

  // 배경 (깨끗한 영수증 종이)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  // 얇은 테두리
  ctx.strokeStyle = '#e2e2e2'; ctx.lineWidth = 2;
  ctx.strokeRect(8, 8, W - 16, H - 16);

  var cx = W / 2;
  ctx.textAlign = 'center';

  // 상단 LOTTE 로고 (이미지) — 로드 완료 시 이미지, 아니면 텍스트
  var topY;
  if (logoImg && logoImg.complete && logoImg.naturalWidth > 0) {
    var lw = 92, lh = 92;
    ctx.drawImage(logoImg, cx - lw / 2, 20, lw, lh);
    topY = 20 + lh + 26; // ≈ 138
  } else {
    ctx.fillStyle = '#1a1a1a';
    ctx.font = 'bold 28px monospace';
    ctx.fillText('LOTTE DEPARTMENT', cx, 56);
    topY = 90;
  }
  ctx.fillStyle = '#777';
  ctx.font = '15px monospace';
  ctx.fillText('쇼핑 도파민 월드 · 30SEC RECEIPT', cx, topY);

  ctx.fillStyle = '#222';
  ctx.font = 'bold 19px monospace';
  ctx.fillText('- 30초간 털어버린 품목 -', cx, topY + 30);

  // 품목 리스트
  var rows = Object.keys(state.caughtLog).map(function (k) {
    return { name: k, price: state.caughtLog[k].price, count: state.caughtLog[k].count };
  });
  rows.sort(function (a, b) { return (b.price * b.count) - (a.price * a.count); });

  var y = topY + 62;
  ctx.font = '17px monospace';
  if (rows.length === 0) {
    ctx.fillStyle = '#999';
    ctx.fillText('담은 상품 없음', cx, y); y += 30;
  } else {
    var shown = rows.slice(0, 9);
    shown.forEach(function (r) {
      ctx.textAlign = 'left'; ctx.fillStyle = '#222';
      var label = r.name + ' x' + r.count;
      if (label.length > 15) label = label.slice(0, 14) + '…';
      ctx.fillText(label, 34, y);
      ctx.textAlign = 'right'; ctx.fillStyle = '#000';
      ctx.fillText((r.price * r.count).toLocaleString(), W - 34, y);
      y += 29;
    });
    if (rows.length > 9) {
      ctx.textAlign = 'center'; ctx.fillStyle = '#999';
      ctx.fillText('··· 외 ' + (rows.length - 9) + '종 ···', cx, y); y += 29;
    }
  }

  y += 14;
  // ── 합계 강조 박스 ──
  var boxH = 106;
  ctx.fillStyle = '#fff2f7';
  ctx.fillRect(24, y, W - 48, boxH);
  ctx.strokeStyle = '#c4006a'; ctx.lineWidth = 3;
  ctx.strokeRect(24, y, W - 48, boxH);

  ctx.textAlign = 'left'; ctx.fillStyle = '#333'; ctx.font = 'bold 17px monospace';
  ctx.fillText('합계 TOTAL', 38, y + 32);
  ctx.textAlign = 'right'; ctx.fillStyle = '#c4006a'; ctx.font = 'bold 30px monospace';
  ctx.fillText(state.money.toLocaleString() + '원', W - 38, y + 40);
  ctx.textAlign = 'center'; ctx.fillStyle = '#c4006a'; ctx.font = 'bold 20px monospace';
  ctx.fillText(koreanMoney(state.money), cx, y + 82);
  y += boxH + 42;

  // 랭크
  var rank = state._rank || getRank(state.money);
  ctx.fillStyle = '#1a1a1a'; ctx.font = 'bold 22px monospace';
  ctx.fillText(stripEmoji(rank.ttl), cx, y); y += 30;
  ctx.fillStyle = '#555'; ctx.font = '16px monospace';
  ctx.fillText(rank.sub, cx, y); y += 34;

  // 스탯
  ctx.fillStyle = '#444'; ctx.font = '15px monospace';
  ctx.fillText('담은 개수 ' + state.caughtCount + '개  |  최고 ' + state.maxCombo + '콤보', cx, y); y += 32;

  // 영수증 번호 / 안내
  ctx.fillStyle = '#888'; ctx.font = '13px monospace';
  var no = (document.getElementById('rcFoot').textContent || '');
  ctx.fillText(no, cx, y);

  return cv;
}
function stripEmoji(s) { return s.replace(/[\u{1F000}-\u{1FFFF}\u2600-\u27BF\uFE0F]/gu, '').trim(); }
// ! [E]

// ! [S] 영수증 저장
function isAndroidWebView() {
  var ua = navigator.userAgent || '';
  return /Android/i.test(ua) && /wv|Version\/[\d.]+/i.test(ua);
}
function saveImage() {
  try {
    var cv = buildReceiptCanvas();
    var fileName = '쇼핑도파민월드_영수증_' + Math.round(state.money) + '원.png';
    var dataUrl = cv.toDataURL('image/png');
    var a = document.createElement('a');
    a.href = dataUrl; a.download = fileName; a.style.display = 'none';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    if (!isAndroidWebView()) {
      alert('📸 영수증이 저장됐어요!\n갤러리(사진첩)를 확인해주세요.');
    }
  } catch (e) {
    alert('이미지 저장에 실패했어요.');
    console.error(e);
  }
}
// ! [E]

// ! [S] 초기화 / 이벤트 바인딩
function initGame() {
  stageEl = document.getElementById('stage');
  basketEl = document.getElementById('basket');
  bagEl = basketEl.querySelector('.bag');
  flashEl = document.getElementById('stageFlash');

  document.getElementById('startBtn').addEventListener('click', startCountdown);
  document.getElementById('retryBtn').addEventListener('click', startCountdown);
  document.getElementById('saveBtn').addEventListener('click', saveImage);

  bindControls();
  bindDirButtons();
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);

  window.addEventListener('resize', function () { if (stageEl) { sizeStage(); } });

  setHeight2();
}

document.addEventListener('DOMContentLoaded', function () {
  initGame();
  setTimeout(setHeight2, 500);
});
// ! [E]
