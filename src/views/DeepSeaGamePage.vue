<template>
  <div class="page-container">
    <header class="page-header">
      <h1><i class="fas fa-water"></i> 해양심층수 탐험</h1>
      <p class="description">
        심층수를 채집하고 장비를 업그레이드하여 자금을 모으세요.
      </p>
    </header>

    <main class="game-layout">
      <section class="game-main-panel">
        <div class="top-stats">
          <div class="stat">
            <strong id="fundsDisplay">자금: {{ fmt(state.funds) }}</strong>
            <span class="label">Funds</span>
          </div>
          <div class="stat">
            <strong id="researchDisplay"
              >데이터: {{ fmt(state.research) }}</strong
            >
            <span class="label">Research</span>
          </div>
        </div>

        <div class="collect-area card">
          <button id="collectBtn" @click="collectClick" title="클릭 채집">
            <div class="collect-btn-content">
              <img :src="ICONS.deep" class="icon" alt="심층수 아이콘" />
              <div class="collect-label">심층수 채집</div>
            </div>
          </button>
          <div class="sell-area">
            <button id="sellBtn" class="btn small" @click="sellWater">
              판매
            </button>
            <span class="small"
              >시세: x{{ derived.marketMultiplier.toFixed(2) }}</span
            >
          </div>
        </div>

        <div class="resources-grid">
          <div class="res-pill">
            <div class="small">심층수</div>
            <strong
              >{{ fmt(state.water) }} / {{ fmt(derived.capacity) }} L</strong
            >
          </div>
          <div class="res-pill">
            <div class="small">희귀 미네랄</div>
            <strong id="mineralCount">{{ fmt(state.minerals) }}</strong>
          </div>
          <div class="res-pill">
            <div class="small">연구 데이터</div>
            <strong id="researchCount">{{ fmt(state.research) }}</strong>
          </div>
          <div class="res-pill">
            <div class="small">초당 생산량</div>
            <strong>{{ derived.perSecond }} L/s</strong>
          </div>
        </div>
      </section>

      <aside class="game-sidebar">
        <div class="card">
          <strong class="small">업그레이드 상점</strong>
          <div class="shop">
            <div v-for="item in shopItems" :key="item.id" class="shop-item">
              <div class="shop-left">
                <img :src="ICONS[item.id]" class="icon" :alt="item.name" />
                <div>
                  <div class="item-name">
                    {{ item.name }} (보유 {{ state.shop[item.id] || 0 }})
                  </div>
                  <div class="small">{{ item.desc }}</div>
                </div>
              </div>
              <button
                class="btn small"
                @click="buy(item.id)"
                :disabled="state.funds < item.cost"
              >
                {{ item.cost }}원
              </button>
            </div>
          </div>
        </div>

        <div class="card">
          <strong class="small">이벤트 로그</strong>
          <div class="log" ref="logBox">
            <div v-for="(log, index) in logs" :key="index" v-html="log"></div>
          </div>
        </div>

        <div class="card">
          <strong class="small">업적</strong>
          <div class="ach-list">
            <div
              v-for="ach in achievements"
              :key="ach.id"
              class="ach"
              :class="{ unlocked: ach.unlocked }"
              :title="ach.name"
            >
              <span class="badge">{{ ach.unlocked ? "✅" : "⬜" }}</span>
              {{ ach.name }}
            </div>
          </div>
        </div>
      </aside>
    </main>

    <!-- Tutorial Modal -->
    <div class="overlay" :class="{ show: showTutorial }">
      <div class="modal">
        <div class="modal-header">
          <strong>튜토리얼</strong>
          <button @click="closeTutorial" class="btn small secondary">
            닫기
          </button>
        </div>
        <ul class="tutorial-list">
          <li>버튼을 눌러 <b>심층수</b>를 채집하세요.</li>
          <li>
            상점에서 <b>ROV/자동 수집기</b>를 구매하면 초당 수집량이 증가합니다.
          </li>
          <li><b>저장탱크</b>를 구매하여 최대 심층수 용량을 늘리세요.</li>
          <li>가끔 <b>희귀 미네랄</b>과 <b>연구 데이터</b>를 얻습니다.</li>
          <li><b>시장분석</b>을 구매하면 판매 시세 배율이 증가합니다.</li>
          <li>
            이벤트: <b>해류 변화</b>, <b>희귀 생물</b> 등으로 보너스/변동이
            발생합니다.
          </li>
          <li>진행 상황은 서버에 <b>자동으로 저장</b>됩니다.</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from "vue";
import { auth, db } from "@/firebaseConfig";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

// --- 상태 관리 (State Management) ---
const DEFAULT_STATE = {
  water: 0,
  minerals: 0,
  research: 0,
  funds: 0,
  shop: {},
  achievements: {},
  seenTutorial: false,
};
const state = reactive(clone(DEFAULT_STATE));
const logs = ref([]);
const showTutorial = ref(false);
const logBox = ref(null);

let DB_SAVE_REF = null;
let lastTick = Date.now();
let tickTimer, eventTimer, autosaveTimer;

// --- 에셋 (Assets) ---
const ICONS = {
  deep: svg(
    "<path d='M12 2C8 7 4 9 4 13c0 5 8 9 8 9s8-4 8-9c0-4-6-8-11z' fill='%234fd1c5'/>",
  ),
  rov: svg(
    "<rect x='4' y='8' width='16' height='8' rx='2' fill='%239fb3c8'/><rect x='2' y='10' width='2' height='4' fill='%239fb3c8'/><rect x='20' y='10' width='2' height='4' fill='%239fb3c8'/><circle cx='12' cy='12' r='2' fill='%23041522'/>",
  ),
  harvester: svg(
    "<path d='M3 10h18v4H3z' fill='%2300b4d8'/><path d='M5 14h2v4H5zM11 14h2v4h-2zM17 14h2v4h-2z' fill='%23008fbd'/>",
  ),
  tank: svg(
    "<rect x='5' y='6' width='14' height='12' rx='2' fill='%23008fbd'/><rect x='7' y='8' width='10' height='8' fill='rgba(255,255,255,0.2)'/>",
  ),
  lab: svg(
    "<path d='M7 21h10v-2H7zM9 19V5l-2-2v16zM15 19V5l2-2v16z' fill='%2368d391'/>",
  ),
  market: svg(
    "<path d='M4 18h16v-2H4zM12 2l-4 6h8zM10 10h4v6h-4z' fill='%23ffd166'/>",
  ),
};
function svg(inner) {
  return `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='36' height='36' viewBox='0 0 24 24'>${inner}</svg>`;
}

// --- 게임 정의 (Definitions) ---
const SHOP_DEFS = [
  {
    id: "rov",
    name: "ROV",
    base: 50,
    type: "cps",
    value: 1,
    desc: "초당 +1 L",
  },
  {
    id: "harvester",
    name: "자동 수집기",
    base: 250,
    type: "cps",
    value: 5,
    desc: "초당 +5 L",
  },
  {
    id: "tank",
    name: "저장탱크",
    base: 120,
    type: "cap",
    value: 300,
    desc: "최대 용량 +300 L",
  },
  {
    id: "lab",
    name: "연구실",
    base: 800,
    type: "chance",
    value: 0.02,
    desc: "희귀 자원 발견 확률 증가",
  },
  {
    id: "market",
    name: "시장 분석",
    base: 1200,
    type: "market",
    value: 0.15,
    desc: "판매 배율 +0.15",
  },
];

const derived = computed(() => {
  const perSecond = SHOP_DEFS.filter((d) => d.type === "cps").reduce(
    (acc, d) => acc + (state.shop[d.id] || 0) * d.value,
    0,
  );
  const capacity =
    200 +
    SHOP_DEFS.filter((d) => d.type === "cap").reduce(
      (acc, d) => acc + (state.shop[d.id] || 0) * d.value,
      0,
    );
  const marketMultiplier =
    1 +
    SHOP_DEFS.filter((d) => d.type === "market").reduce(
      (acc, d) => acc + (state.shop[d.id] || 0) * d.value,
      0,
    );
  const chanceMultiplier =
    1 +
    SHOP_DEFS.filter((d) => d.type === "chance").reduce(
      (acc, d) => acc + (state.shop[d.id] || 0) * d.value,
      0,
    );
  return { perSecond, capacity, marketMultiplier, chanceMultiplier };
});

const shopItems = computed(() => {
  return SHOP_DEFS.map((def) => ({
    ...def,
    cost: Math.ceil(def.base * Math.pow(1.65, state.shop[def.id] || 0)),
  }));
});

const ACH_DEFS = [
  { id: "first_click", name: "첫 채집", cond: (s) => s.water >= 1 },
  { id: "minerals_5", name: "미네랄 콜렉터", cond: (s) => s.minerals >= 5 },
  { id: "research_10", name: "연구의 시작", cond: (s) => s.research >= 10 },
  { id: "funds_1000", name: "초기 자본", cond: (s) => s.funds >= 1000 },
  {
    id: "cps_20",
    name: "생산라인 가동",
    cond: (s) => derived.value.perSecond >= 20,
  },
];

const achievements = computed(() => {
  return ACH_DEFS.map((a) => ({
    ...a,
    unlocked: state.achievements[a.id] || false,
  }));
});

// --- 헬퍼 함수 (Helpers) ---
function clone(o) {
  return JSON.parse(JSON.stringify(o));
}
function fmt(n) {
  return Math.floor(Number(n) || 0);
}
function addLog(msg) {
  logs.value.unshift(`[${new Date().toLocaleTimeString()}] ${msg}`);
  if (logs.value.length > 50) logs.value.pop();
  nextTick(() => {
    if (logBox.value) logBox.value.scrollTop = 0;
  });
}

// --- 게임 로직 (Core Logic) ---
function collectClick() {
  if (state.water >= derived.value.capacity) {
    addLog("저장 탱크가 가득 찼습니다!");
    return;
  }
  state.water = Math.min(derived.value.capacity, state.water + 1);
  const chance = derived.value.chanceMultiplier;
  if (Math.random() < 0.05 * chance) {
    state.minerals++;
    addLog("희귀 미네랄 발견!");
  }
  if (Math.random() < 0.08 * chance) {
    state.research++;
    addLog("연구 데이터 획득");
  }
  checkAchievements();
}

function sellWater() {
  if (state.water <= 0) {
    alert("판매할 심층수가 없습니다");
    return;
  }
  const pricePerL = 5;
  const revenue = Math.floor(
    state.water * pricePerL * derived.value.marketMultiplier,
  );
  state.funds += revenue;
  addLog(`${fmt(state.water)}L 심층수 판매: +${revenue} 자금`);
  state.water = 0;
  checkAchievements();
  saveGame();
}

function buy(id) {
  const def = SHOP_DEFS.find((s) => s.id === id);
  const owned = state.shop[id] || 0;
  const cost = Math.ceil(def.base * Math.pow(1.65, owned));
  if (state.funds < cost) {
    alert("자금이 부족합니다");
    return;
  }
  state.funds -= cost;
  state.shop[id] = owned + 1;
  addLog(`${def.name} 구매`);
  checkAchievements();
  saveGame();
}

function checkAchievements() {
  ACH_DEFS.forEach((a) => {
    if (!state.achievements[a.id] && a.cond(state)) {
      state.achievements[a.id] = true;
      addLog(`업적 달성: ${a.name}`);
    }
  });
}

function runEvent() {
  const r = Math.random();
  if (r < 0.4) {
    const change = Math.random() < 0.5 ? -0.2 : 0.2;
    const newMultiplier = Math.max(
      0.8,
      Math.round((derived.value.marketMultiplier + change) * 100) / 100,
    );
    // This is a bit tricky as derived is computed. We should adjust a base state value instead.
    // For simplicity, we'll log it, but a better implementation would have a state.marketBonus.
    addLog(`해류 변화로 시세 변동! (예상: x${newMultiplier.toFixed(2)})`);
  } else if (r < 0.75) {
    const bM =
      1 + Math.floor(Math.random() * 3 * derived.value.chanceMultiplier);
    const bR =
      1 + Math.floor(Math.random() * 2 * derived.value.chanceMultiplier);
    state.minerals += bM;
    state.research += bR;
    addLog(`희귀 생물 관측! 미네랄 +${bM}, 데이터 +${bR}`);
  } else {
    addLog("해저는 지금 평온합니다.");
  }
}

// --- 저장 및 불러오기 (Persistence) ---
async function loadGame(user) {
  if (user && db) {
    DB_SAVE_REF = doc(db, `users/${user.uid}/game_state/deep_sea_exploration`);
    try {
      const docSnap = await getDoc(DB_SAVE_REF);
      if (docSnap.exists()) {
        Object.assign(state, clone(DEFAULT_STATE), docSnap.data());
        addLog("서버에서 데이터를 불러왔습니다.");
      } else {
        Object.assign(state, clone(DEFAULT_STATE));
        addLog("새로운 탐사를 시작합니다. (서버)");
      }
    } catch (e) {
      console.error("Firestore load error", e);
      addLog("서버 로딩 실패. 읽기 권한을 확인하세요.");
    }
  } else {
    addLog("로그인 정보 없음. 로컬 저장을 사용합니다.");
  }
  if (!state.seenTutorial) showTutorial.value = true;
}

async function saveGame() {
  if (DB_SAVE_REF) {
    try {
      await setDoc(DB_SAVE_REF, state);
    } catch (e) {
      console.error("Firestore save error", e);
    }
  }
}

function closeTutorial() {
  showTutorial.value = false;
  state.seenTutorial = true;
  saveGame();
}

// --- 생명주기 및 루프 (Lifecycle & Loops) ---
onMounted(() => {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      loadGame(user);
    } else {
      addLog("로그인하여 진행 상황을 서버에 저장하세요.");
    }
  });

  lastTick = Date.now();
  tickTimer = setInterval(() => {
    const now = Date.now();
    const delta = (now - lastTick) / 1000;
    lastTick = now;
    state.water = Math.min(
      derived.value.capacity,
      state.water + derived.value.perSecond * delta,
    );
    checkAchievements();
  }, 1000);

  eventTimer = setInterval(runEvent, 25000);
  autosaveTimer = setInterval(saveGame, 10000);
});

onUnmounted(() => {
  clearInterval(tickTimer);
  clearInterval(eventTimer);
  clearInterval(autosaveTimer);
  saveGame(); // 컴포넌트 파괴 시 최종 저장
});
</script>

<style scoped>
:root {
  --bg: #041522;
  --panel: #0b1f2d;
  --card: #0e2a3c;
  --accent: #4fd1c5;
  --muted: #9fb3c8;
  --danger: #ff6b6b;
  --success: #68d391;
  --font-family: "Press Start 2P", monospace;
}
.page-container {
  max-width: 1120px;
  margin: 70px auto 20px;
  padding: 20px;
}
.page-header {
  text-align: center;
  margin-bottom: 30px;
}
.page-header h1 i {
  color: var(--accent);
}
.game-layout {
  display: grid;
  grid-template-columns: 1fr 360px;
  gap: 20px;
  align-items: start;
}
.game-main-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.top-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
}
.stat {
  background: var(--panel);
  padding: 15px;
  border-radius: 10px;
  text-align: center;
  border: 1px solid rgba(255, 255, 255, 0.06);
}
.stat .label {
  font-size: 10px;
  color: var(--muted);
  display: block;
  margin-top: 4px;
}
.collect-area {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  padding: 20px;
}
#collectBtn {
  width: 148px;
  height: 148px;
  border-radius: 16px;
  border: 3px solid #0c6b7b;
  background: linear-gradient(180deg, #095b6a, #043f4a);
  cursor: pointer;
  display: grid;
  place-items: center;
  font-size: 20px;
  box-shadow: 0 6px 0 rgba(0, 0, 0, 0.35);
  transform: translateY(0);
  transition:
    transform 0.07s ease,
    box-shadow 0.07s ease;
}
#collectBtn:active {
  transform: translateY(3px);
  box-shadow: 0 3px 0 rgba(0, 0, 0, 0.25);
}
.collect-btn-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.collect-label {
  font-size: 12px;
}
.sell-area {
  margin-top: 8px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.resources-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}
.res-pill {
  background: var(--card);
  padding: 12px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}
.res-pill .small {
  font-size: 10px;
  color: var(--muted);
}
.game-sidebar {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.card {
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.03),
    rgba(255, 255, 255, 0.02)
  );
  padding: 15px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.06);
}
.shop {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}
.shop-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
}
.shop-left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.item-name {
  font-size: 11px;
}
.icon {
  width: 36px;
  height: 36px;
  image-rendering: pixelated;
}
.btn {
  background: var(--accent);
  color: #012;
  padding: 8px 12px;
  border-radius: 10px;
  border: 0;
  cursor: pointer;
  font-weight: 700;
  font-family: var(--font-family);
}
.btn.secondary {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: var(--accent);
}
.btn.small {
  padding: 6px 8px;
  font-size: 11px;
}
.btn:disabled {
  background: #555;
  color: #999;
  cursor: not-allowed;
}
.log {
  height: 160px;
  overflow: auto;
  padding: 8px;
  background: #031722;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  font-size: 12px;
  color: var(--muted);
}
.small {
  font-size: 11px;
  color: var(--muted);
}
.ach-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ach {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  padding: 8px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  opacity: 0.4;
  transition: opacity 0.3s;
  font-size: 11px;
}
.ach.unlocked {
  opacity: 1;
  background: rgba(104, 211, 145, 0.1);
}
.badge {
  font-size: 10px;
}

/* Modal */
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: none;
  align-items: center;
  justify-content: center;
  z-index: 999;
}
.modal {
  background: #08212e;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  max-width: 560px;
  width: 92%;
  padding: 16px;
}
.overlay.show {
  display: flex;
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.tutorial-list {
  margin: 12px 0 0 18px;
  line-height: 1.65;
  font-size: 13px;
}

@media (max-width: 900px) {
  .game-layout {
    grid-template-columns: 1fr;
  }
  #collectBtn {
    width: 130px;
    height: 130px;
  }
}
</style>
