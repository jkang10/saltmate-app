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

        <div class="card salt-sale-box">
          <h3>해양심층수 판매소</h3>
          <div class="salt-info">
            <i class="fas fa-coins gold-icon"></i>
            보유 자금:
            <strong>{{ fmt(state.funds).toLocaleString() }}</strong>
          </div>
          <p class="exchange-rate">
            현재 시세: {{ gameSettings.deepSeaRate.toLocaleString() }} 자금 = 1
            SaltMate
          </p>
          <button
            class="btn sell-all-btn"
            @click="sellFundsForPoints"
            :disabled="isSellingFunds || state.funds < gameSettings.deepSeaRate"
          >
            <span v-if="isSellingFunds" class="spinner-small"></span>
            <span v-else>모두 판매하기</span>
          </button>
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
                {{ item.cost.toLocaleString() }}원
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
import { getFunctions, httpsCallable } from "firebase/functions";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";

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
const isSellingFunds = ref(false);
const gameSettings = reactive({ deepSeaRate: 100000 });
let DB_SAVE_REF = null;
let lastTick = Date.now();
let tickTimer, eventTimer, autosaveTimer;
const authUser = ref(null);

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
    cond: () => derived.value.perSecond >= 20,
  },
];

const achievements = computed(() => {
  return ACH_DEFS.map((a) => ({
    ...a,
    unlocked: state.achievements[a.id] || false,
  }));
});

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

const sellFundsForPoints = async () => {
  if (state.funds < gameSettings.deepSeaRate) {
    alert(
      `SaltMate로 교환하려면 최소 ${gameSettings.deepSeaRate.toLocaleString()} 자금이 필요합니다.`,
    );
    return;
  }
  if (
    !confirm(
      `${fmt(state.funds).toLocaleString()} 자금을 모두 판매하여 SaltMate로 교환하시겠습니까?`,
    )
  )
    return;

  isSellingFunds.value = true;
  try {
    const functions = getFunctions(undefined, "asia-northeast3");
    const sellFunds = httpsCallable(functions, "sellDeepSeaFunds");

    // ▼▼▼ [수정] 서버로 빈 객체 {}를 전달합니다. ▼▼▼
    const result = await sellFunds({});
    // ▲▲▲ 수정 완료 ▲▲▲

    const { awardedPoints, soldFunds } = result.data;
    alert(
      `성공! ${soldFunds.toLocaleString()} 자금을 판매하여 ${awardedPoints.toLocaleString()} SaltMate를 획득했습니다.`,
    );
    addLog(`자금 판매: +${awardedPoints.toLocaleString()} SaltMate`);
  } catch (error) {
    console.error("자금 판매 오류:", error);
    alert(`오류: ${error.message}`);
  } finally {
    isSellingFunds.value = false;
  }
};

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
  addLog(`${fmt(state.water)}L 심층수 판매: +${revenue.toLocaleString()} 자금`);
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
        await saveGame();
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

onMounted(() => {
  onAuthStateChanged(auth, (user) => {
    authUser.value = user;
    if (user) {
      loadGame(user);
      const configRef = doc(db, "configuration", "gameSettings");
      onSnapshot(configRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          gameSettings.deepSeaRate = data.deepSeaRate || 100000;
        }
      });

      const userGameStateRef = doc(
        db,
        `users/${user.uid}/game_state/deep_sea_exploration`,
      );
      onSnapshot(userGameStateRef, (docSnap) => {
        if (docSnap.exists()) {
          Object.assign(state, docSnap.data());
        }
      });
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
  saveGame();
});
</script>

<style scoped>
:root {
  --text-dark: #212529;
  --text-light: #495057;
  --primary: #007bff;
  --accent: #17a2b8;
  --card-bg: #ffffff;
  --bg-light: #f8f9fa;
  --border-color: #dee2e6;
}

.page-container {
  padding: 20px;
  max-width: 1200px;
  margin: 70px auto 20px;
  color: var(--text-dark);
}

.page-header {
  text-align: center;
  margin-bottom: 30px;
}

.page-header h1 {
  font-size: 2.2em;
  font-weight: 700;
  color: var(--text-dark);
  margin-bottom: 10px;
}
.page-header h1 i {
  color: var(--primary);
}

.page-header .description {
  font-size: 1.1em;
  color: var(--text-light);
}

.game-layout {
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: 20px;
  align-items: start;
}

.card {
  background: var(--card-bg);
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  border: 1px solid var(--border-color);
}

.top-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
  margin-bottom: 20px;
}

.stat {
  background: var(--bg-light);
  padding: 15px;
  border-radius: 8px;
  text-align: center;
  border: 1px solid var(--border-color);
}

.stat strong {
  font-size: 1.4em;
  color: var(--text-dark);
}

.stat .label {
  font-size: 0.9em;
  color: var(--muted);
  display: block;
  margin-top: 5px;
}

.collect-area {
  text-align: center;
  padding: 20px;
}

#collectBtn {
  width: 160px;
  height: 160px;
  border-radius: 50%;
  border: none;
  background: linear-gradient(145deg, #2196f3, #0d47a1);
  color: white;
  cursor: pointer;
  box-shadow: 0 5px 15px rgba(0, 123, 255, 0.3);
  transition: all 0.2s ease-in-out;
  display: flex;
  align-items: center;
  justify-content: center;
}

#collectBtn:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 25px rgba(0, 123, 255, 0.4);
}

.collect-btn-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.collect-label {
  font-size: 1.1em;
  font-weight: bold;
}

.sell-area {
  margin-top: 15px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 15px;
}

.btn {
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: bold;
  transition: all 0.2s ease;
}

.btn.small {
  padding: 8px 16px;
  font-size: 0.9em;
  background-color: #28a745;
  color: white;
}
.btn.small:hover {
  background-color: #218838;
}

.btn:disabled {
  background-color: #ced4da;
  cursor: not-allowed;
  color: #6c757d;
}

.resources-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 15px;
  margin-top: 20px;
}

.res-pill {
  background: var(--bg-light);
  padding: 15px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.res-pill .small {
  color: var(--muted);
  font-size: 0.9em;
}

.res-pill strong {
  font-size: 1.2em;
}

.game-sidebar {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.shop {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 10px;
}

.shop-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
  padding: 10px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
}

.shop-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.item-name {
  font-weight: bold;
  font-size: 1em;
}

.log {
  height: 200px;
  overflow-y: auto;
  background: #212529;
  color: #e9ecef;
  padding: 15px;
  border-radius: 8px;
  font-family: "Courier New", Courier, monospace;
  font-size: 0.9em;
}

.ach-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 10px;
}

.ach {
  padding: 10px;
  border-radius: 8px;
  background: #e9ecef;
  opacity: 0.6;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.9em;
}

.ach.unlocked {
  background: #d4edda;
  color: #155724;
  opacity: 1;
}

.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: none;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.overlay.show {
  display: flex;
}

.modal {
  background: white;
  padding: 30px;
  border-radius: 15px;
  max-width: 500px;
  width: 90%;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 1.5em;
  font-weight: bold;
  margin-bottom: 20px;
  color: var(--text-dark);
}

.tutorial-list {
  list-style-position: inside;
  text-align: left;
  line-height: 1.8;
  color: var(--text-light);
}

.icon {
  width: 36px;
  height: 36px;
  image-rendering: pixelated;
}

.btn.secondary {
  background-color: #6c757d;
  color: white;
}
.salt-sale-box {
  margin-top: 20px;
  padding: 20px;
  text-align: center;
}
.salt-sale-box h3 {
  margin-top: 0;
  margin-bottom: 15px;
  font-size: 1.2em;
}
.salt-info {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  font-size: 1.3em;
  margin-bottom: 10px;
}
.gold-icon {
  color: #ffc107;
}
.exchange-rate {
  color: #6c757d;
  margin-bottom: 20px;
}
.sell-all-btn {
  width: 100%;
  padding: 12px;
  background-color: #6c757d;
  color: white;
  font-size: 1.1em;
}
.sell-all-btn:hover:not(:disabled) {
  background-color: #5a6268;
}
.spinner-small {
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid #fff;
  border-radius: 50%;
  width: 16px;
  height: 16px;
  animation: spin 1s linear infinite;
  display: inline-block;
}

@media (max-width: 900px) {
  .game-layout {
    grid-template-columns: 1fr;
  }
}
</style>
