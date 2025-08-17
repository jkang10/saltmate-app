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

// ▼▼▼ [수정됨] 업적 정의에서 불필요한 매개변수 제거 및 일관성 유지 ▼▼▼
const ACH_DEFS = [
  { id: "first_click", name: "첫 채집", cond: (s) => s.water >= 1 },
  { id: "minerals_5", name: "미네랄 콜렉터", cond: (s) => s.minerals >= 5 },
  { id: "research_10", name: "연구의 시작", cond: (s) => s.research >= 10 },
  { id: "funds_1000", name: "초기 자본", cond: (s) => s.funds >= 1000 },
  {
    id: "cps_20",
    name: "생산라인 가동",
    cond: () => derived.value.perSecond >= 20, // 매개변수 's' 제거
  },
];
// ▲▲▲ 수정 완료 ▲▲▲

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
.deep-sea-container {
  font-family: "Noto Sans KR", sans-serif;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 30px;
  background: linear-gradient(to bottom, #e0f7fa, #b2ebf2);
  min-height: 100vh;
}

.header {
  color: #00695c;
  margin-bottom: 20px;
  text-align: center;
}

.subtitle {
  color: #00897b;
  margin-bottom: 30px;
}

.game-area {
  display: flex;
  justify-content: center;
  gap: 40px;
  margin-bottom: 40px;
  width: 90%;
  max-width: 1200px;
}

.left-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.water-drop-area {
  background-color: #80deea;
  border-radius: 15px;
  padding: 20px;
  margin-bottom: 20px;
  text-align: center;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
}

.collect-button {
  background-color: #00bcd4;
  color: white;
  border: none;
  padding: 15px 30px;
  font-size: 1.1em;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.collect-button:hover {
  background-color: #00acc1;
}

.sell-info {
  margin-top: 10px;
  color: #263238;
  font-size: 0.9em;
}

.status-area {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 15px;
  margin-bottom: 20px;
}

.status-item {
  background-color: #fff;
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
  text-align: center;
  color: #37474f;
}

.status-label {
  font-size: 0.8em;
  color: #78909c;
  margin-bottom: 5px;
}

.status-value {
  font-size: 1.2em;
  font-weight: bold;
}

.right-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 400px;
}

.shop-item {
  background-color: #fff;
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #37474f;
}

.shop-info {
  flex-grow: 1;
}

.shop-name {
  font-weight: bold;
  margin-bottom: 5px;
}

.shop-desc {
  font-size: 0.9em;
  color: #78909c;
}

.shop-price {
  font-weight: bold;
  color: #1976d2;
  margin-left: 15px;
}

.buy-button {
  background-color: #1976d2;
  color: white;
  border: none;
  padding: 8px 12px;
  border-radius: 5px;
  cursor: pointer;
  transition: background-color 0.3s ease;
  font-size: 0.9em;
}

.buy-button:hover {
  background-color: #1565c0;
}

.event-log-area {
  background-color: #f0f4c3;
  border-radius: 8px;
  padding: 15px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
  max-height: 300px;
  overflow-y: auto;
  color: #2e7d32;
  font-size: 0.9em;
  line-height: 1.4;
}

.event-log-title {
  font-weight: bold;
  margin-bottom: 10px;
  color: #2e7d32;
}

.sell-water-button {
  background-color: #4caf50;
  color: white;
  border: none;
  padding: 15px 30px;
  font-size: 1.1em;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.3s ease;
  margin-top: 20px;
}

.sell-water-button:hover {
  background-color: #43a047;
}

.tutorial-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10;
}

.tutorial-modal {
  background-color: white;
  padding: 30px;
  border-radius: 15px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
  text-align: center;
  color: #37474f;
}

.tutorial-title {
  font-size: 1.8em;
  font-weight: bold;
  margin-bottom: 20px;
  color: #00897b;
}

.tutorial-message {
  line-height: 1.6;
  margin-bottom: 30px;
}

.tutorial-button {
  background-color: #00bcd4;
  color: white;
  border: none;
  padding: 12px 25px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1em;
  transition: background-color 0.3s ease;
}

.tutorial-button:hover {
  background-color: #00acc1;
}
</style>
