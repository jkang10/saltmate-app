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
          <button
            id="collectBtn"
            @click="collectClick"
            :title="`'${activeZone.name}'에서 채집`"
          >
            <div class="collect-btn-content">
              <i :class="activeZone.icon" class="zone-icon"></i>
              <div class="collect-label">{{ activeZone.name }} 채집</div>
            </div>
          </button>
          <div class="sell-area">
            <button id="sellBtn" class="btn small" @click="sellResources">
              자원 판매
            </button>
            <span class="small"
              >시세: x{{ derived.marketMultiplier.toFixed(2) }}</span
            >
          </div>
        </div>

	<div v-if="isAbyssalTrenchUnlocked" class="card auto-sell-feature">
	  <h3><i class="fas fa-robot"></i> 심해 해구 자동 판매</h3>
	  <p>
	    심해 해구 특전: 자원을 {{ gameSettings.autoSellIntervalMinutes }}분마다 자동으로 판매하여 자금을 획득합니다.
	  </p>
	  <div class="toggle-switch">
            <label class="switch">
              <input
                type="checkbox"
                v-model="state.autoSellEnabled"
                @change="toggleAutoSell"
              />
              <span class="slider round"></span>
            </label>
            <span
              >자동 판매
              {{ state.autoSellEnabled ? "활성화됨" : "비활성화됨" }}</span
            >
          </div>
        </div>

        <div class="card golden-time-box">
          <h3><i class="fas fa-star gold-icon"></i> 골든타임 활성화</h3>
          <p>
            100 SaltMate를 사용하여 10분간 희귀 자원 발견 확률을 5배로 높이세요!
          </p>
          <button
            class="btn golden-time-btn"
            @click="activateGoldenTime"
            :disabled="isActivatingGoldenTime || isGoldenTimeActive"
          >
            <span v-if="isActivatingGoldenTime" class="spinner-small"></span>
            <span v-else-if="isGoldenTimeActive"
              >활성화됨 ({{ goldenTimeRemaining }})</span
            >
            <span v-else>골든타임 시작</span>
          </button>
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
	  :disabled="isSellingFunds"
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
            <div class="small">플랑크톤</div>
            <strong>{{ fmt(state.plankton) }}</strong>
          </div>
          <div class="res-pill">
            <div class="small">희귀 미네랄</div>
            <strong id="mineralCount">{{ fmt(state.minerals) }}</strong>
          </div>
          <div class="res-pill">
            <div class="small">고대 유물</div>
            <strong>{{ fmt(state.relics) }}</strong>
          </div>
          <div class="res-pill">
            <div class="small">초당 생산량</div>
            <strong>{{ derived.perSecond }} L/s</strong>
          </div>
        </div>
      </section>

      <aside class="game-sidebar">
        <div class="sidebar-tabs">
          <button
            @click="activeTab = 'upgrades'"
            :class="{ active: activeTab === 'upgrades' }"
          >
            업그레이드
          </button>
          <button
            @click="activeTab = 'zones'"
            :class="{ active: activeTab === 'zones' }"
          >
            탐사 지역
          </button>
        </div>

        <div v-if="activeTab === 'upgrades'" class="card">
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
                :disabled="!item.canAfford"
              >
                {{ item.cost.toLocaleString() }}원
              </button>
            </div>
          </div>
        </div>

        <div v-if="activeTab === 'zones'" class="card">
          <strong class="small">탐사 지역</strong>
          <div class="zone-list">
            <div
              v-for="zone in zones"
              :key="zone.id"
              class="zone-item"
              :class="{
                unlocked: zone.unlocked,
                active: state.activeZoneId === zone.id,
              }"
            >
              <h4><i :class="zone.icon"></i> {{ zone.name }}</h4>
              <div v-if="zone.unlocked">
                <button
                  v-if="state.activeZoneId !== zone.id"
                  @click="setActiveZone(zone.id)"
                  class="btn small"
                >
                  탐사 시작
                </button>
                <span v-else class="active-text">탐사 중</span>
              </div>
              <div v-else class="lock-info">
                <small
                  v-for="(req, key) in zone.requirements"
                  :key="key"
                  class="requirement"
                >
                  {{ formatResourceName(key) }}: {{ req.toLocaleString() }} 필요
                </small>
                <button
                  @click="unlockZone(zone.id)"
                  :disabled="!zone.canUnlock || isUnlocking"
                  class="btn small btn-unlock"
                >
                  <span v-if="isUnlocking">해금 중...</span>
                  <span v-else>해금</span>
                </button>
              </div>
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
import { auth, db, functions } from "@/firebaseConfig";
import { httpsCallable } from "firebase/functions";
import { onAuthStateChanged } from "firebase/auth";
import { doc, setDoc, onSnapshot, serverTimestamp } from "firebase/firestore";

const sellFundsForPoints = async () => {
  if (state.funds <= 0) return alert("판매할 자금이 없습니다.");
  isSellingFunds.value = true;
  try {
    const sellFunds = httpsCallable(functions, "sellDeepSeaFunds");
    const result = await sellFunds({ amountToSell: state.funds });
    alert(`${result.data.soldFunds.toLocaleString()} 자금을 판매하여 ${result.data.awardedPoints.toLocaleString()} SaltMate를 획득했습니다.`);
  } catch (error) {
    console.error("자금 판매 오류:", error);
    alert(`오류: ${error.message}`);
  } finally {
    isSellingFunds.value = false;
  }
};

const DEFAULT_STATE = {
  water: 0, minerals: 0, research: 0, funds: 0, plankton: 0, relics: 0,
  shop: {}, achievements: {}, seenTutorial: false, goldenTimeUntil: null,
  unlockedZones: { default: true }, activeZoneId: "default", autoSellEnabled: false, lastUpdated: null,
};

const state = reactive(clone(DEFAULT_STATE));
const logs = ref([]);
const showTutorial = ref(false);
const logBox = ref(null);
const isSellingFunds = ref(false);
const gameSettings = reactive({ 
  deepSeaRate: 100000,
  autoSellIntervalMinutes: 10,
});

let DB_SAVE_REF = null;
let lastTick = Date.now();
let tickTimer, eventTimer, autosaveTimer, goldenTimeInterval;
const authUser = ref(null);
const isActivatingGoldenTime = ref(false);
const goldenTimeRemaining = ref("00:00");
const activeTab = ref("upgrades");
const isUnlocking = ref(false);
let authUnsubscribe = null;
let settingsUnsubscribe = null;
let gameStateUnsubscribe = null; // [신규] 게임 상태 리스너 구독 해제 함수

const isGoldenTimeActive = computed(() => state.goldenTimeUntil && state.goldenTimeUntil.toDate() > new Date());

const ICONS = {
  rov: `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='36' height='36' viewBox='0 0 24 24'><rect x='4' y='8' width='16' height='8' rx='2' fill='%239fb3c8'/><rect x='2' y='10' width='2' height='4' fill='%239fb3c8'/><rect x='20' y='10' width='2' height='4' fill='%239fb3c8'/><circle cx='12' cy='12' r='2' fill='%23041522'/></svg>`,
  harvester: `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='36' height='36' viewBox='0 0 24 24'><path d='M3 10h18v4H3z' fill='%2300b4d8'/><path d='M5 14h2v4H5zM11 14h2v4h-2zM17 14h2v4h-2z' fill='%23008fbd'/></svg>`,
  tank: `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='36' height='36' viewBox='0 0 24 24'><rect x='5' y='6' width='14' height='12' rx='2' fill='%23008fbd'/><rect x='7' y='8' width='10' height='8' fill='rgba(255,255,255,0.2)'/></svg>`,
  lab: `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='36' height='36' viewBox='0 0 24 24'><path d='M7 21h10v-2H7zM9 19V5l-2-2v16zM15 19V5l2-2v16z' fill='%2368d391'/></svg>`,
  market: `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='36' height='36' viewBox='0 0 24 24'><path d='M4 18h16v-2H4zM12 2l-4 6h8zM10 10h4v6h-4z' fill='%23ffd166'/></svg>`,
};

const SHOP_DEFS = [
  { id: "rov", name: "소형 ROV", base: 50, type: "cps", value: 1, desc: "초당 +1L 심층수" },
  { id: "harvester", name: "자동 수집기", base: 250, type: "cps", value: 5, desc: "초당 +5L 심층수" },
  { id: "tank", name: "저장탱크 확장", base: 120, type: "cap", value: 300, desc: "최대 용량 +300L" },
  { id: "lab", name: "연구소 업그레이드", base: 800, type: "chance", value: 0.02, desc: "희귀 자원 발견 확률 증가" },
  { id: "market", name: "시장 분석", base: 1200, type: "market", value: 0.15, desc: "판매 배율 +0.15" },
];

const ZONE_DEFS = {
  default: { name: "기본 해역", icon: "fas fa-water" },
  coral_reef: { name: "산호초 군락", icon: "fas fa-fish", requirements: { research: 5000 } },
  hydrothermal_vent: { name: "열수 분출구", icon: "fas fa-fire", requirements: { research: 50000, minerals: 30000 } },
  abyssal_trench: { name: "심해 해구", icon: "fas fa-skull-crossbones", requirements: { research: 200000, allUpgradesLevel: 25 } },
};

const derived = computed(() => {
  const shop = state.shop;
  const capacity = 200 + (shop.tank || 0) * 300;
  const perSecond = (shop.rov || 0) * 1 + (shop.harvester || 0) * 5;
  const marketMultiplier = 1 + (shop.market || 0) * 0.1;
  return { capacity, perSecond, marketMultiplier };
});

const shopItems = computed(() => {
  return SHOP_DEFS.map((item) => {
    const level = state.shop[item.id] || 0;
    const baseCost = item.base || 0;
    const cost = Math.ceil(baseCost * Math.pow(1.65, level));
    const canAfford = state.funds >= cost;
    return { ...item, cost, canAfford };
  });
});

const isAbyssalTrenchUnlocked = computed(() => !!state.unlockedZones.abyssal_trench);

const zones = computed(() => {
  return Object.keys(ZONE_DEFS).map((id) => {
    const zone = ZONE_DEFS[id];
    const unlocked = state.unlockedZones[id];
    let canUnlock = false;
    if (!unlocked && zone.requirements) {
      canUnlock = Object.entries(zone.requirements).every(([key, value]) => {
        if (key === "allUpgradesLevel") {
          return SHOP_DEFS.every((item) => (state.shop[item.id] || 0) >= value);
        }
        return (state[key] || 0) >= value;
      });
    }
    return { id, ...zone, unlocked, canUnlock };
  });
});

const activeZone = computed(() => ZONE_DEFS[state.activeZoneId] || ZONE_DEFS.default);

const ACH_DEFS = [
  { id: "water_1k", name: "물 한 방울", condition: () => state.water >= 1000 },
  { id: "funds_10k", name: "첫 수익", condition: () => state.funds >= 10000 },
  { id: "research_100", name: "연구 시작", condition: () => state.research >= 100 },
];

const achievements = computed(() => {
  return ACH_DEFS.map((ach) => ({ ...ach, unlocked: state.achievements[ach.id] }));
});

function clone(o) { return JSON.parse(JSON.stringify(o)); }
function fmt(n) { return Math.floor(Number(n) || 0); }

function addLog(msg) {
  logs.value.unshift(`[${new Date().toLocaleTimeString()}] ${msg}`);
  if (logs.value.length > 100) logs.value.pop();
  nextTick(() => { if (logBox.value) logBox.value.scrollTop = 0; });
}

async function callFunction(name, data) {
  const func = httpsCallable(functions, name);
  return await func(data);
}

const toggleAutoSell = async () => {
  if (!authUser.value) {
    addLog("자동 판매 상태를 변경하려면 로그인이 필요합니다.");
    return;
  }

  const intendedState = !state.autoSellEnabled;

  try {
    const userRef = doc(db, "users", authUser.value.uid);
    const gameStateRef = doc(db, `users/${authUser.value.uid}/game_state/deep_sea_exploration`);
    
    // [핵심 수정] Promise.all을 사용하여 모든 DB 업데이트를 병렬로 처리합니다.
    await Promise.all([
      // 1. users 문서에 deepSeaAutoSellEnabled 필드 업데이트
      setDoc(userRef, { deepSeaAutoSellEnabled: intendedState }, { merge: true }),
      
      // 2. game_state 문서에 autoSellEnabled 필드와 lastAutoSellTime(활성화 시) 업데이트
      setDoc(gameStateRef, { 
        autoSellEnabled: intendedState,
        // 활성화하는 경우에만 lastAutoSellTime을 현재 시간으로 설정
        ...(intendedState && { lastAutoSellTime: serverTimestamp() })
      }, { merge: true })
    ]);

    // [핵심 수정] saveGame() 호출을 제거했으므로, state를 수동으로 업데이트합니다.
    state.autoSellEnabled = intendedState;

    addLog(
      `자동 판매 기능이 ${intendedState ? "활성화" : "비활성화"}되었습니다.`
    );

  } catch (error) {
    console.error("자동 판매 상태 변경 실패:", error);
    addLog("자동 판매 상태 변경에 실패했습니다. 다시 시도해주세요.");
    // 오류가 발생하면 UI 상태를 원래대로 되돌리지 않음 (사용자가 재시도하도록 유도)
  }
};

const activateGoldenTime = async () => {
  if (!confirm("100 SaltMate를 사용하여 10분간 골든타임을 시작하시겠습니까?")) return;
  isActivatingGoldenTime.value = true;
  try {
    const result = await callFunction("startGoldenTime");
    alert(result.data.message);
    addLog(result.data.message);
  } catch (error) {
    console.error("골든타임 활성화 오류:", error);
    alert(`오류: ${error.message}`);
  } finally {
    isActivatingGoldenTime.value = false;
  }
};

const collectClick = () => {
  if (state.water >= derived.value.capacity && state.activeZoneId !== "hydrothermal_vent") {
    return addLog("저장 공간이 가득 찼습니다!");
  }
  const chanceMultiplier = 1 + (state.shop.lab || 0) * 0.02;
  const isGoldenTime = state.goldenTimeUntil && state.goldenTimeUntil.toDate() > new Date();
  const chance = isGoldenTime ? chanceMultiplier * 5 : chanceMultiplier;

  switch (state.activeZoneId) {
    case "default":
      state.water += 1; if (Math.random() < 0.05 * chance) state.minerals += 1; if (Math.random() < 0.08 * chance) state.research += 1;
      break;
    case "coral_reef":
      state.water += 1; if (Math.random() < 0.01) state.plankton += 1; if (Math.random() < 0.03 * chance) state.minerals += 1;
      break;
    case "hydrothermal_vent":
      if (Math.random() < 0.05 * chance) state.minerals += 1; if (Math.random() < 0.001 * chance) state.relics += 1;
      break;
    case "abyssal_trench":
      state.water += 2; if (Math.random() < 0.1 * chance) state.minerals += 2; if (Math.random() < 0.15 * chance) state.research += 2; if (Math.random() < 0.005 * chance) state.funds += 100000;
      break;
  }
};

const sellResources = async () => {
  if (state.water <= 0 && state.plankton <= 0) return alert("판매할 자원이 없습니다.");
  try {
    const revenue = Math.floor(state.water * 5 * derived.value.marketMultiplier) + Math.floor(state.plankton * 15 * derived.value.marketMultiplier);
    state.funds += revenue;
    state.water = 0;
    state.plankton = 0;
    addLog(`자원 판매: +${revenue.toLocaleString()} 자금`);
    await saveGame();
  } catch (error) {
    console.error("자원 판매 오류:", error);
    alert(`자원 판매 실패: ${error.message}`);
  }
};

const setActiveZone = async (zoneId) => {
  state.activeZoneId = zoneId;
  addLog(`'${ZONE_DEFS[zoneId].name}' 지역 탐사를 시작합니다.`);
  await saveGame();
};

const unlockZone = async (zoneId) => {
  const zone = zones.value.find((z) => z.id === zoneId);
  if (!zone || !zone.canUnlock) return;
  isUnlocking.value = true;
  try {
    await saveGame();
    const result = await callFunction("unlockExplorationZone", { zoneId });
    if (zone.requirements.research) state.research -= zone.requirements.research;
    if (zone.requirements.minerals) state.minerals -= zone.requirements.minerals;
    alert(result.data.message);
    addLog(result.data.message);
  } catch (error) {
    console.error("지역 해금 오류:", error);
    alert(`오류: ${error.message}`);
  } finally {
    isUnlocking.value = false;
  }
};

function formatResourceName(res) {
  const names = { research: "연구 데이터", minerals: "희귀 미네랄", allUpgradesLevel: "모든 장비 레벨" };
  return names[res] || res;
}

function buy(id) {
  const item = shopItems.value.find((i) => i.id === id);
  if (!item.canAfford) return alert("자금이 부족합니다.");
  state.funds -= item.cost;
  state.shop[id] = (state.shop[id] || 0) + 1;
  addLog(`${item.name} 구매`);
  checkAchievements();
  saveGame();
}

function checkAchievements() {
  ACH_DEFS.forEach((ach) => {
    if (!state.achievements[ach.id] && ach.condition()) {
      state.achievements[ach.id] = true;
      addLog(`업적 달성: ${ach.name}`);
    }
  });
}

function runEvent() {
  if (Math.random() < 0.2) {
    const eventType = Math.random();
    if (eventType < 0.5) {
      addLog("이벤트: 강한 해류 발견! 10초간 수집량 2배!");
      state.water += derived.value.perSecond * 10 * 2;
    } else {
      addLog("이벤트: 희귀 생물 발견! 연구 데이터 +100!");
      state.research += 100;
    }
  }
}

// [핵심 수정] loadGame을 listenToGame으로 변경하여 실시간 감지
const listenToGame = (user) => {
  if (!user || !db) return;
  DB_SAVE_REF = doc(db, `users/${user.uid}/game_state/deep_sea_exploration`);

  if (gameStateUnsubscribe) gameStateUnsubscribe(); // 기존 리스너 정리

  gameStateUnsubscribe = onSnapshot(DB_SAVE_REF, (docSnap) => {
    if (docSnap.exists()) {
      const dbState = docSnap.data();
      // 오프라인 생산량 계산은 첫 로딩 시에만 한번 수행
      if (!state.lastUpdated) {
        const lastUpdate = dbState.lastUpdated?.toDate() || new Date();
        const now = new Date();
        const secondsDiff = (now.getTime() - lastUpdate.getTime()) / 1000;
        const offlineProduction = Math.floor(secondsDiff * ((dbState.shop?.rov || 0) * 1 + (dbState.shop?.harvester || 0) * 5));
        
        if (offlineProduction > 0) {
          addLog(`오프라인 동안 ${offlineProduction.toLocaleString()} L의 심층수를 채집했습니다.`);
          dbState.water = (dbState.water || 0) + offlineProduction;
        }
      }
      Object.assign(state, dbState);
      addLog("서버와 데이터 동기화 완료.");
    } else {
      Object.assign(state, clone(DEFAULT_STATE));
      addLog("새로운 탐사를 시작합니다. (서버)");
      saveGame(); // 최초 데이터 생성
    }
    if (!state.seenTutorial) showTutorial.value = true;
  }, (e) => {
    console.error("Firestore listen error", e);
    addLog("서버 데이터 동기화 실패.");
  });
};


async function saveGame() {
  if (DB_SAVE_REF) {
    try {
      const saveData = { ...state, lastUpdated: serverTimestamp() };
      await setDoc(DB_SAVE_REF, saveData, { merge: true });
      console.log("게임 진행 상황이 저장되었습니다.");
    } catch (e) {
      console.error("Firestore save error", e);
    }
  }
}

function closeTutorial() {
  state.seenTutorial = true;
  showTutorial.value = false;
  saveGame();
}

onMounted(() => {
  authUnsubscribe = onAuthStateChanged(auth, (user) => {
    authUser.value = user;
    if (user) {
      listenToGame(user); // [핵심 수정] getDoc -> onSnapshot으로 변경
      
      const configRef = doc(db, "configuration", "gameSettings");
      settingsUnsubscribe = onSnapshot(configRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          gameSettings.deepSeaRate = data.deepSeaRate || 100000;
          gameSettings.autoSellIntervalMinutes = data.autoSellIntervalMinutes || 10;
        }
      });
    } else {
      if (settingsUnsubscribe) settingsUnsubscribe();
      if (gameStateUnsubscribe) gameStateUnsubscribe(); // [신규] 로그아웃 시 리스너 정리
      addLog("로그인이 필요합니다.");
    }
  });

  if (goldenTimeInterval) clearInterval(goldenTimeInterval);
  goldenTimeInterval = setInterval(() => {
    if (isGoldenTimeActive.value) {
      const remaining = state.goldenTimeUntil.toDate().getTime() - new Date().getTime();
      const minutes = Math.floor((remaining / 1000 / 60) % 60);
      const seconds = Math.floor((remaining / 1000) % 60);
      goldenTimeRemaining.value = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }
  }, 1000);

  lastTick = Date.now();
  tickTimer = setInterval(() => {
    const delta = (Date.now() - lastTick) / 1000;
    lastTick = Date.now();
    state.water = Math.min(derived.value.capacity, state.water + derived.value.perSecond * delta);
    checkAchievements();
  }, 1000);
  eventTimer = setInterval(runEvent, 25000);
  autosaveTimer = setInterval(saveGame, 10000);
});

onUnmounted(() => {
  clearInterval(tickTimer);
  clearInterval(eventTimer);
  clearInterval(autosaveTimer);
  if (goldenTimeInterval) clearInterval(goldenTimeInterval);
  if (authUnsubscribe) authUnsubscribe();
  if (settingsUnsubscribe) settingsUnsubscribe();
  if (gameStateUnsubscribe) gameStateUnsubscribe(); // [신규] 컴포넌트 파괴 시 리스너 정리
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
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
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
}
.btn.secondary {
  background-color: #6c757d;
  color: white;
}
.golden-time-box {
  margin-top: 20px;
  text-align: center;
  border: 2px solid #ffd700;
}
.golden-time-box h3 {
  color: #e67e22;
}
.golden-time-btn {
  width: 100%;
  padding: 12px;
  background-color: #f39c12;
  color: white;
  font-size: 1.1em;
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
.zone-icon {
  font-size: 1.5em;
}
.sidebar-tabs {
  display: flex;
  margin-bottom: 10px;
}
.sidebar-tabs button {
  flex: 1;
  padding: 10px;
  background: #e9ecef;
  border: none;
  cursor: pointer;
  font-weight: bold;
}
.sidebar-tabs button.active {
  background: #007bff;
  color: white;
}
.zone-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 10px;
}
.zone-item {
  padding: 15px;
  border-radius: 8px;
  border: 1px solid #ddd;
}
.zone-item.unlocked {
  border-color: #28a745;
}
.zone-item.active {
  background-color: #d4edda;
}
.zone-item h4 {
  margin: 0 0 10px 0;
}
.lock-info {
  font-size: 0.9em;
}
.requirement {
  display: block;
  color: #666;
}
.btn-unlock {
  margin-top: 10px;
  background-color: #ffc107;
  color: #333;
}
.active-text {
  font-weight: bold;
  color: #28a745;
}
.auto-sell-feature {
  border: 2px solid var(--primary);
  background-color: #e7f3ff;
}
.auto-sell-feature h3 {
  color: var(--primary);
}
.toggle-switch {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-top: 15px;
}
.switch {
  position: relative;
  display: inline-block;
  width: 60px;
  height: 34px;
}
.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}
.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: 0.4s;
}
.slider:before {
  position: absolute;
  content: "";
  height: 26px;
  width: 26px;
  left: 4px;
  bottom: 4px;
  background-color: white;
  transition: 0.4s;
}
input:checked + .slider {
  background-color: #2196f3;
}
input:focus + .slider {
  box-shadow: 0 0 1px #2196f3;
}
input:checked + .slider:before {
  transform: translateX(26px);
}
.slider.round {
  border-radius: 34px;
}
.slider.round:before {
  border-radius: 50%;
}
@media (max-width: 900px) {
  .game-layout {
    grid-template-columns: 1fr;
  }
}
</style>
