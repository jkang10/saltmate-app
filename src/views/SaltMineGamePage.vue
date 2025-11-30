<template>
  <div class="page-container" :style="mineAreaStyle">
    <header class="page-header">
      <h1><i class="fas fa-gem"></i> 소금 광산</h1>
      <p class="description">
        소금을 채굴하고 업그레이드하여 SaltMate 포인트를 획득하세요!
      </p>
    </header>

    <main class="game-layout">
      <div class="game-main">
        <div v-if="isBoostActive" class="boost-active-banner card">
          <i class="fas fa-rocket"></i>
          <div class="boost-info">
            <span>채굴 부스트 활성 중! (+{{ activeBoost.percentage }}%)</span>
            <small>남은 시간: {{ boostTimeRemaining }}</small>
          </div>
        </div>

        <div class="top-stats">
          <div class="stat">
            <span>{{ Math.floor(salt).toLocaleString() }}</span
            ><small>보유 소금</small>
          </div>
          <div class="stat">
            <span :class="{ 'boosted-text': isBoostActive }"
              >{{ boostedPerSecond.toLocaleString(undefined, {maximumFractionDigits: 1}) }} / 초</span
            ><small>자동 채굴량</small>
          </div>
          <div class="stat">
            <span :class="{ 'boosted-text': isBoostActive }"
              >{{ boostedPerClick.toLocaleString() }} / 클릭</span
            ><small>클릭 채굴량</small>
          </div>
        </div>

<div class="mine-area card" @click="triggerClickEffect">
  <div class="mine-visual">
    <img v-if="equippedPickaxeSkin" :src="equippedPickaxeSkin.imageUrl" :alt="equippedPickaxeSkin.name" class="pickaxe-skin-image">
    <i v-else :class="currentPickaxeIcon"></i>
    <div class="click-effect" :class="{ 'animate': isClickAnimating }"></div>
  </div>
  <p>소금을 채굴하려면 아래 버튼을 클릭하세요!</p>
	<button 
	  @pointerdown.stop.prevent="mineSalt" 
	  class="mine-button" 
	  :disabled="isPenaltyActive" 
	  :class="{ 'cooldown': isMiningCooldown }" 
	  :style="isPenaltyActive ? 'background-color: #ef4444; color: white;' : ''"
	>
	    {{ isPenaltyActive ? '과열! 잠시 대기하세요' : '채굴하기' }}
	  </button>
</div>

        <div class="log-card card">
          <h3>이벤트 로그</h3>
          <div class="log-box" ref="logBox">
            <div v-for="(log, index) in logs" :key="index" v-html="log"></div>
          </div>
        </div>
      </div>

      <aside class="game-sidebar">
        <div class="sidebar-tabs desktop-tabs">
          <button @click="activeTab = 'upgrades'" :class="{ active: activeTab === 'upgrades' }">업그레이드</button>
          <button @click="activeTab = 'workshop'" :class="{ active: activeTab === 'workshop' }" class="workshop-tab-btn">제작 공방</button>
          <button @click="activeTab = 'skins'" :class="{ active: activeTab === 'skins' }">꾸미기</button>
        </div>

        <div class="sidebar-tabs mobile-dropdown">
          <div class="active-tab-display" @click="toggleDropdown">
            <span>{{ activeTabName }}</span>
            <i class="fas fa-caret-down"></i>
          </div>
          <div class="dropdown-menu" v-if="isDropdownOpen">
            <button @click="selectTab('upgrades')">업그레이드</button>
            <button @click="selectTab('workshop')">제작 공방</button>
            <button @click="selectTab('skins')">꾸미기</button>
          </div>
        </div>

        <div v-if="activeTab === 'upgrades'">
          <div class="shop-card card">
            <h3><i class="fas fa-shopping-cart"></i> 업그레이드 상점</h3>
            <div class="shop-items">
              <div v-for="item in shopItems" :key="item.id" class="shop-item">
                <div class="item-icon"><i :class="item.icon"></i></div>
                <div class="item-info">
                  <strong>{{ item.name }}</strong>
                  <small>{{ item.desc }} (보유: {{ upgrades[item.id] || 0 }})</small>
                </div>
                <button @click="buyUpgrade(item.id)" :disabled="salt < item.cost" class="buy-upgrade-button">{{ item.cost.toLocaleString() }}</button>
              </div>
            </div>
          </div>
          <div class="sell-card card">
            <h3>소금 판매소</h3>
            <p>현재 시세: <strong>{{ gameSettings.saltMineRate.toLocaleString() }} 소금 = 1 SaltMate</strong></p>
            <button @click="sellSalt" :disabled="isProcessing || salt < gameSettings.saltMineRate" class="sell-button">
              <span v-if="isProcessing">판매 중...</span><span v-else>모두 판매하기</span>
            </button>
          </div>
          <div class="sell-card card gold-feature">
            <h3>황금 소금 교환소</h3>
            <div class="gold-salt-display">
              <i class="fas fa-medal"></i>
              <span>보유 황금 소금: <strong>{{ gold.toLocaleString() }}</strong> 개</span>
            </div>
            <p class="feature-desc">황금 소금 1개를 {{ gameSettings.goldenSaltExchangeRate }} SaltMate로 교환합니다.</p>
            <button @click="openExchangeModal" :disabled="isProcessing || gold < 1" class="boost-button">
              <span v-if="isProcessing">교환 중...</span><span v-else>SaltMate로 교환</span>
            </button>
          </div>
          <div v-if="upgrades.robot >= 40 || prestigeLevel > 0" class="card prestige-feature">
            <h3><i class="fas fa-sync-alt"></i> 환생 시스템</h3>
            <div v-if="prestigeLevel > 0" class="prestige-info">
              <span>현재 환생 레벨: <strong>Lv.{{ prestigeLevel }}</strong></span>
              <span>모든 생산량 보너스: <strong>+{{ ((prestigeBonus - 1) * 100).toFixed(0) }}%</strong></span>
            </div>
            <p v-if="upgrades.robot >= 40" class="feature-desc">채굴 로봇 40레벨을 달성하여 환생할 수 있습니다.</p>
            <button v-if="upgrades.robot >= 40" @click="openPrestigeModal" :disabled="isProcessing" class="prestige-button">
              <span v-if="isProcessing">처리 중...</span><span v-else>환생하기</span>
            </button>
          </div>
          <div class="achievement-card card">
            <h3>업적</h3>
            <div class="achievement-list">
              <div v-for="ach in achievements" :key="ach.id" class="achievement-item" :class="{ unlocked: ach.unlocked }" :title="ach.desc">
                <span class="ach-icon">{{ ach.icon }}</span>
                <span class="ach-name">{{ ach.name }}</span>
              </div>
            </div>
          </div>
        </div>

        <div v-if="activeTab === 'workshop'" class="card workshop-feature">
          <h3><i class="fas fa-tools"></i> 제작 공방 (Lv.{{ workshopLevel }})</h3>
          <div class="workshop-upgrade-section">
            <p>공방을 업그레이드하여 더 많은 아이템을 제작하세요!</p>
            <button @click="executeWorkshopUpgrade" :disabled="isProcessing || salt < workshopUpgradeCost" class="upgrade-button">
              <span>Lv.{{ workshopLevel + 1 }} 업그레이드</span>
              <small>{{ workshopUpgradeCost.toLocaleString() }} 소금</small>
            </button>
          </div>
          <div class="recipe-list">
            <div v-for="recipe in workshopItems" :key="recipe.id" class="recipe-item" :class="{ locked: !recipe.isUnlocked }">
              <div class="recipe-header">
                <strong>{{ recipe.itemName }}</strong>
                <span v-if="!recipe.isUnlocked" class="lock-reason">(공방 Lv.{{ recipe.unlockLevel }} 필요)</span>
              </div>
              <ul class="ingredient-list">
                <li v-for="(ing, i) in recipe.ingredients" :key="i" :class="{ sufficient: ing.hasEnough }">
                  <span>{{ ing.name }}: {{ ing.current.toLocaleString() }} / {{ ing.amount.toLocaleString() }}</span>
                  <router-link v-if="!ing.hasEnough && ing.shortcut" :to="ing.shortcut" class="shortcut-btn">이동</router-link>
                </li>
              </ul>
              <button @click="executeCraft(recipe.id)" :disabled="!recipe.canCraft || isProcessing" class="craft-button">제작</button>
            </div>
          </div>
        </div>
        
        <div v-if="activeTab === 'skins'" class="card skins-feature">
          <h3><i class="fas fa-paint-brush"></i> 광산 꾸미기</h3>
          <div class="skins-section">
            <h4><i class="fas fa-hammer"></i> 곡괭이 스킨</h4>
            <div class="skins-grid">
	<div v-for="skin in skinShopItems.pickaxe" :key="skin.id" class="skin-item" :class="{ equipped: skin.status === 'equipped' }">
	  <div class="skin-preview">
	    <img :src="skin.imageUrl" :alt="skin.name" class="skin-image">
	  </div>
	  <div class="skin-name">{{ skin.name }}</div>

	  <div v-if="skin.bonus" class="skin-bonus-info">
	    <small v-if="skin.bonus.perClickPercent">+클릭 채굴량 {{ skin.bonus.perClickPercent }}%</small>
	    <small v-if="skin.bonus.perSecondPercent">+자동 채굴량 {{ skin.bonus.perSecondPercent }}%</small>
	    <small v-if="skin.bonus.goldChancePercent">+황금소금 확률 {{ skin.bonus.goldChancePercent }}%</small>
	  </div>
                <div class="skin-status">
                  <button v-if="skin.status === 'equipped'" class="skin-btn" disabled>
                    <i class="fas fa-check"></i> 장착 중
                  </button>
                  <button v-else-if="skin.status === 'owned'" @click="equipSkin(skin)" class="skin-btn equip">
                    장착하기
                  </button>
                  <button v-else @click="executePurchase(skin.id)" class="skin-btn purchase" :disabled="isProcessing">
                    <span>{{ skin.price.toLocaleString() }}</span>
                    <i :class="skin.currency === 'gold' ? 'fas fa-medal gold-icon' : 'fas fa-gifts blue-icon'"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div class="skins-section">
            <h4><i class="fas fa-image"></i> 광산 배경 스킨</h4>
            <div class="skins-grid">
              <div v-for="skin in skinShopItems.background" :key="skin.id" class="skin-item" :class="{ equipped: skin.status === 'equipped' }">
                <div class="skin-preview background-preview" :style="{ backgroundImage: `url(${skin.imageUrl})` }"></div>
                <div class="skin-name">{{ skin.name }}</div>
                 <div class="skin-status">
                  <button v-if="skin.status === 'equipped'" class="skin-btn" disabled>
                    <i class="fas fa-check"></i> 적용 중
                  </button>
                  <button v-else-if="skin.status === 'owned'" @click="equipSkin(skin)" class="skin-btn equip">
                    적용하기
                  </button>
                  <button v-else @click="executePurchase(skin.id)" class="skin-btn purchase" :disabled="isProcessing">
                    <span>{{ skin.price.toLocaleString() }}</span>
                    <i :class="skin.currency === 'gold' ? 'fas fa-medal gold-icon' : 'fas fa-gifts blue-icon'"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </main>

    <div v-if="isExchangeModalVisible" class="modal-overlay" @click.self="closeExchangeModal">
      <div class="modal-content card">
        <header class="modal-header">
          <h3>황금 소금 교환</h3>
          <button @click="closeExchangeModal" class="close-button">&times;</button>
        </header>
        <div class="modal-body">
          <p>교환할 황금 소금의 수량을 입력하세요.</p>
          <div class="exchange-info">
            <span>보유: {{ gold.toLocaleString() }} 개</span>
            <span>교환 비율: 1개 = {{ gameSettings.goldenSaltExchangeRate }} SaltMate</span>
          </div>
          <input type="number" v-model.number="exchangeQuantity" min="1" :max="gold" class="quantity-input" placeholder="수량 입력">
          <div class="exchange-summary">
            <p>예상 획득량: <strong>{{ (exchangeQuantity * gameSettings.goldenSaltExchangeRate).toLocaleString() }} SaltMate</strong></p>
          </div>
        </div>
        <footer class="modal-footer">
          <button @click="closeExchangeModal" class="btn-secondary">취소</button>
          <button @click="executeExchange" :disabled="isProcessing || !exchangeQuantity || exchangeQuantity <= 0 || exchangeQuantity > gold" class="btn-primary">
            <span v-if="isProcessing" class="spinner-small"></span>
            <span v-else>교환하기</span>
          </button>
        </footer>
      </div>
    </div>

    <div v-if="isPrestigeModalVisible" class="modal-overlay" @click.self="closePrestigeModal">
      <div class="modal-content card">
        <header class="modal-header">
          <h3><i class="fas fa-sync-alt"></i> 환생 확인</h3>
          <button @click="closePrestigeModal" class="close-button">&times;</button>
        </header>
        <div class="modal-body">
          <p><strong>정말로 환생하시겠습니까?</strong></p>
          <p>
            환생을 진행하면 현재 보유한 모든 소금과 업그레이드가 사라지고 처음부터 다시 시작합니다.
          </p>
          <div class="prestige-summary">
            <div>
              <span>현재 환생 레벨</span>
              <strong>Lv.{{ prestigeLevel }} &rarr; Lv.{{ prestigeLevel + 1 }}</strong>
            </div>
            <div>
              <span>총 생산량 보너스</span>
              <strong>+{{ ((prestigeBonus - 1) * 100).toFixed(0) }}% &rarr; +{{ (prestigeBonus * 1.1 - 1) * 100 }}%</strong>
            </div>
          </div>
        </div>
        <footer class="modal-footer">
          <button @click="closePrestigeModal" class="btn-secondary">취소</button>
          <button @click="executePrestige" :disabled="isProcessing" class="btn-primary prestige-confirm">
            <span v-if="isProcessing" class="spinner-small"></span>
            <span v-else>환생 진행</span>
          </button>
        </footer>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, reactive, nextTick } from 'vue';
import { httpsCallable } from "firebase/functions";
import { auth, db, functions } from "@/firebaseConfig";
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp, collection, query, orderBy, getDocs } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

// --- 상태 변수 ---
const salt = ref(0), gold = ref(0), totalClicks = ref(0), perClick = ref(1), perSecond = ref(0);
const upgrades = reactive({});
const isProcessing = ref(false), isExchangeModalVisible = ref(false), exchangeQuantity = ref(1);
const logs = ref([]), currentUser = ref(null), userProfile = ref(null), isLoading = ref(true);
const gameSettings = reactive({ saltMineRate: 1000, goldenSaltExchangeRate: 1 });
const activeBoost = ref(null), boostTimeRemaining = ref("00:00"), logBox = ref(null);
const prestigeLevel = ref(0), isPrestigeModalVisible = ref(false);
const activeTab = ref('upgrades'), workshopLevel = ref(1), recipes = ref([]);
const deepSeaState = reactive({ funds: 0, water: 0, research: 0, minerals: 0, plankton: 0, relics: 0 });
const availableSkins = ref([]), ownedSkins = ref([]), equippedSkins = reactive({ pickaxe: null, background: null });
const isDropdownOpen = ref(false);
// ▼▼▼ [신규] 채굴 버튼 쿨다운 상태 변수 추가 ▼▼▼
const isMiningCooldown = ref(false);

// ▼▼▼ [신규] 클릭 이펙트 상태 변수 추가 ▼▼▼
const isClickAnimating = ref(false);

const clickHistory = ref([]); // 최근 클릭 시간 기록
const isPenaltyActive = ref(false); // 패널티 활성화 여부
const penaltyCount = ref(0); // [신규] 오토 감지 누적 횟수

let gameStateRef = null, authUnsubscribe = null, gameInterval = null, saveInterval = null;

// --- 헬퍼 함수 ---
const logEvent = (message) => {
  logs.value.unshift(message);
  if (logs.value.length > 50) logs.value.pop();
  nextTick(() => { if (logBox.value) logBox.value.scrollTop = 0; });
};

// --- 계산된 속성 ---
const activeTabName = computed(() => {
  if (activeTab.value === 'upgrades') return '업그레이드';
  if (activeTab.value === 'workshop') return '제작 공방';
  if (activeTab.value === 'skins') return '꾸미기';
  return '';
});

// [신규] 장착된 스킨의 보너스 효과를 계산하는 computed 속성
const skinBonus = computed(() => {
  const bonus = { perClickPercent: 0, perSecondPercent: 0, goldChancePercent: 0 };
  const equippedPickaxe = availableSkins.value.find(s => s.id === equippedSkins.pickaxe);
  if (equippedPickaxe && equippedPickaxe.bonus) {
    Object.assign(bonus, equippedPickaxe.bonus);
  }
  return bonus;
});

const prestigeBonus = computed(() => 1 + (prestigeLevel.value * 0.1));
const isBoostActive = computed(() => activeBoost.value && activeBoost.value.expiresAt.toDate() > new Date());
// [수정] boostedPerClick과 boostedPerSecond 계산식에 스킨 보너스 추가
const boostedPerClick = computed(() => {
  const base = perClick.value * (1 + skinBonus.value.perClickPercent / 100);
  const boostMultiplier = isBoostActive.value ? (1 + activeBoost.value.percentage / 100) : 1;
  return base * boostMultiplier * prestigeBonus.value;
});

const boostedPerSecond = computed(() => {
  const base = perSecond.value * (1 + skinBonus.value.perSecondPercent / 100);
  const boostMultiplier = isBoostActive.value ? (1 + activeBoost.value.percentage / 100) : 1;
  return base * boostMultiplier * prestigeBonus.value;
});

const SHOP_DEFS = [
  { id: "miner", name: "자동 채굴기", baseCost: 50, gps: 1, desc: "초당 +1 소금", icon: "fas fa-cogs" },
  { id: "drill", name: "전동 드릴", baseCost: 300, gps: 5, desc: "초당 +5 소금", icon: "fas fa-tools" },
  { id: "robot", name: "채굴 로봇", baseCost: 2000, gps: 25, desc: "초당 +25 소금", icon: "fas fa-robot" },
  { id: "pick_upgrade", name: "곡괭이 강화", baseCost: 120, type: "click", add: 1, desc: "클릭당 +1 소금", icon: "fas fa-hammer" },
  { id: "offline_miner_1", name: "기본 자동 채굴", baseCost: 1000000, desc: "오프라인 채굴 효율 +10% (최대 100%)", icon: "fas fa-power-off" },
];

const shopItems = computed(() => SHOP_DEFS.map((item) => ({...item, cost: Math.ceil(item.baseCost * Math.pow(item.id.startsWith("offline") ? 2.5 : 1.6, upgrades[item.id] || 0))})));

const achievements = computed(() => [
  { id: "salt_1000", name: "초보 광부", desc: "소금 1,000개 모으기", icon: "⛏️", unlocked: salt.value >= 1000 },
  { id: "salt_10000", name: "숙련된 광부", desc: "소금 10,000개 모으기", icon: "⚒️", unlocked: salt.value >= 10000 },
  { id: "gold_1", name: "첫 발견", desc: "황금 소금 1개 발견하기", icon: "✨", unlocked: gold.value >= 1 },
  { id: "automation_expert", name: "자동화 전문가", desc: "채굴 로봇 구매하기", icon: "🤖", unlocked: (upgrades["robot"] || 0) > 0 },
]);

const workshopUpgradeCost = computed(() => 500000 * Math.pow(2, workshopLevel.value - 1));
const resourceNames = { salt: '소금', gold: '황금 소금', funds: '해양 자금', water: '심층수', research: '연구 데이터', minerals: '희귀 미네랄', plankton: '플랑크톤', relics: '고대 유물', saltmatePoints: 'SaltMate' };

const skinShopItems = computed(() => {
  const allItems = { pickaxe: [], background: [] };
  availableSkins.value.forEach(skin => {
    let status = 'forsale';
    if (ownedSkins.value.includes(skin.id)) status = 'owned';
    if (equippedSkins[skin.type] === skin.id) status = 'equipped';
    if (allItems[skin.type]) allItems[skin.type].push({ ...skin, status });
  });
  return allItems;
});

const equippedPickaxeSkin = computed(() => {
  if (!equippedSkins.pickaxe) return null;
  return availableSkins.value.find(s => s.id === equippedSkins.pickaxe);
});

const currentPickaxeIcon = computed(() => {
  if ((upgrades["robot"] || 0) > 0) return "fas fa-robot";
  if ((upgrades["drill"] || 0) > 0) return "fas fa-tools";
  if ((upgrades["miner"] || 0) > 0) return "fas fa-cogs";
  return "fas fa-hammer";
});

const mineAreaStyle = computed(() => {
  const equippedSkin = availableSkins.value.find(s => s.id === equippedSkins.background);
  if (equippedSkin && equippedSkin.imageUrl) return { backgroundImage: `url(${equippedSkin.imageUrl})` };
  return {};
});

const workshopItems = computed(() => {
  return recipes.value.map(recipe => {
    const isUnlocked = workshopLevel.value >= recipe.unlockLevel;
    let canCraft = isUnlocked;
    const ingredients = recipe.ingredients.map(ing => {
      let current = 0;
      if (ing.type === 'salt_mine') current = ing.resource === 'salt' ? salt.value : gold.value;
      else if (ing.type === 'deep_sea') current = deepSeaState[ing.resource] || 0;
      else if (ing.type === 'global') current = userProfile.value ? (userProfile.value[ing.resource] || 0) : 0;
      const hasEnough = current >= ing.amount;
      if (!hasEnough) canCraft = false;
      return { ...ing, name: resourceNames[ing.resource] || ing.resource, current: Math.floor(current), hasEnough };
    });
    return { ...recipe, ingredients, isUnlocked, canCraft };
  }).sort((a, b) => a.unlockLevel - b.unlockLevel);
});

// --- 메서드 ---
const toggleDropdown = () => { isDropdownOpen.value = !isDropdownOpen.value; };
const selectTab = (tabName) => { activeTab.value = tabName; isDropdownOpen.value = false; };

const resetGameState = () => {
  salt.value = 0; gold.value = 0; totalClicks.value = 0;
  perClick.value = 1; perSecond.value = 0;
  Object.keys(upgrades).forEach(key => delete upgrades[key]);
  logs.value = []; isLoading.value = true; activeBoost.value = null;
  workshopLevel.value = 1; ownedSkins.value = [];
  Object.assign(equippedSkins, { pickaxe: null, background: null });
  logEvent("게임에 오신 것을 환영합니다!");
};

const fetchSkins = async () => {
  try {
    const q = query(collection(db, "cosmetics"));
    const snapshot = await getDocs(q);
    availableSkins.value = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) { console.error("스킨 목록 로딩 실패:", error); }
};

const fetchRecipesAndResources = async () => {
  if (!currentUser.value) return;
  try {
    const recipeQuery = query(collection(db, "craftingRecipes"), orderBy("unlockLevel"));
    const recipeSnap = await getDocs(recipeQuery);
    recipes.value = recipeSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const deepSeaRef = doc(db, `users/${currentUser.value.uid}/game_state/deep_sea_exploration`);
    const deepSeaSnap = await getDoc(deepSeaRef);
    if (deepSeaSnap.exists()) Object.assign(deepSeaState, deepSeaSnap.data());
  } catch (error) { console.error("레시피 또는 재료 로딩 실패:", error); }
};

const loadGame = async () => {
  if (!currentUser.value) return;
  isLoading.value = true;
  try {
    const userRef = doc(db, "users", currentUser.value.uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      userProfile.value = userSnap.data();
      prestigeLevel.value = userProfile.value.saltMinePrestigeLevel || 0;
    }
    gameStateRef = doc(db, `users/${currentUser.value.uid}/game_state/salt_mine`);
    const docSnap = await getDoc(gameStateRef);
    if (docSnap.exists()) {
      const state = docSnap.data();
      const loadedUpgrades = state.upgrades || {};
      const offlineMinerLevel = loadedUpgrades.offline_miner_1 || 0;
      const offlineRate = Math.min(offlineMinerLevel * 0.1, 1.0);
      const lastUpdate = state.lastUpdated?.toDate() || new Date();
      const secondsDiff = (new Date().getTime() - lastUpdate.getTime()) / 1000;
      const effectiveSeconds = Math.min(secondsDiff, 24 * 3600);
      const baseOfflineSalt = Math.floor(effectiveSeconds * (state.perSecond || 0) * offlineRate);
      const offlineSalt = Math.floor(baseOfflineSalt * prestigeBonus.value);
      if (offlineSalt > 0) logEvent(`오프라인에서 <strong>${offlineSalt.toLocaleString()}</strong> 소금 채굴!`);
      salt.value = (state.salt || 0) + offlineSalt;
      gold.value = state.gold || 0;
      totalClicks.value = state.totalClicks || 0;
      perClick.value = state.perClick || 1;
      perSecond.value = state.perSecond || 0;
      Object.assign(upgrades, loadedUpgrades);
      activeBoost.value = state.activeBoost || null;
      workshopLevel.value = state.workshopLevel || 1;
      ownedSkins.value = state.ownedSkins || [];
      Object.assign(equippedSkins, state.equippedSkins || {});
    } else {
      logEvent("새로운 게임을 시작합니다!");
    }
  } catch (error) { console.error("게임 데이터 로딩 오류:", error); } 
  finally { isLoading.value = false; }
};

const saveGame = async () => {
  if (!currentUser.value || !gameStateRef || isLoading.value) return;
  const state = {
    salt: salt.value, gold: gold.value, totalClicks: totalClicks.value,
    perClick: perClick.value, perSecond: perSecond.value, upgrades: upgrades,
    activeBoost: activeBoost.value, workshopLevel: workshopLevel.value,
    ownedSkins: ownedSkins.value, equippedSkins: equippedSkins,
    lastUpdated: serverTimestamp(),
  };
  try { await setDoc(gameStateRef, state, { merge: true }); }
  catch (error) { console.error("게임 데이터 저장 오류:", error); }
};

const listenToGameSettings = () => {
  const configRef = doc(db, "configuration", "gameSettings");
  onSnapshot(configRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      gameSettings.saltMineRate = data.saltMineRate || 1000;
      gameSettings.deepSeaRate = data.deepSeaRate || 100000;
      gameSettings.goldenSaltExchangeRate = data.goldenSaltExchangeRate || 1;
    }
  });
};

const gameTick = () => {
  salt.value += boostedPerSecond.value;
  if (isBoostActive.value) {
    const remaining = activeBoost.value.expiresAt.toDate().getTime() - new Date().getTime();
    if (remaining <= 0) {
      activeBoost.value = null;
      logEvent("채굴 부스트 효과가 종료되었습니다.");
    } else {
      const minutes = Math.floor((remaining / 1000 / 60) % 60);
      const seconds = Math.floor((remaining / 1000) % 60);
      boostTimeRemaining.value = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
  }
};

// ▼▼▼ [신규] 클릭 이펙트 트리거 함수 추가 ▼▼▼
const triggerClickEffect = () => {
  if (isMiningCooldown.value) return;
  
  // 채굴 로직 실행
  mineSalt();
  
  // 애니메이션 트리거
  isClickAnimating.value = true;
  setTimeout(() => {
    isClickAnimating.value = false;
  }, 300); // 애니메이션 시간과 일치
};

// [수정] 오토 방지 상태 저장 기능 추가
const mineSalt = () => {
  const now = Date.now();
  clickHistory.value = clickHistory.value.filter(time => now - time < 1000);
  clickHistory.value.push(now);

  // 1. 오토 감지 (초당 7회 초과)
  if (clickHistory.value.length > 7) {
      if (!isPenaltyActive.value) {
          penaltyCount.value++; 
          
          const baseDuration = 20000; 
          const addDuration = 60000;  
          const duration = baseDuration + (penaltyCount.value - 1) * addDuration;
          const durationSec = duration / 1000;
          
          // [신규] 종료 시간 계산 및 로컬 스토리지 저장
          const penaltyEndTime = now + duration;
          localStorage.setItem('saltMine_macro_penalty', JSON.stringify({
              count: penaltyCount.value,
              endTime: penaltyEndTime
          }));

          isPenaltyActive.value = true;
          
          logEvent(`⚠️ <strong>채굴기 과열!</strong> 매크로 감지(${penaltyCount.value}회 누적). ${durationSec}초간 채굴이 중지됩니다.`);
          
          setTimeout(() => {
              isPenaltyActive.value = false;
              clickHistory.value = [];
              
              // [신규] 페널티 종료 후 상태 업데이트 (누적 횟수는 유지)
              localStorage.setItem('saltMine_macro_penalty', JSON.stringify({
                  count: penaltyCount.value,
                  endTime: null
              }));
          }, duration);
      }
      return; 
  }

  if (isMiningCooldown.value || isPenaltyActive.value) return;

  isMiningCooldown.value = true;
  salt.value += boostedPerClick.value;
  totalClicks.value++;
  
  const baseGoldChance = 0.0005;
  const goldFindChance = baseGoldChance + (skinBonus.value.goldChancePercent / 100);
  
  if (Math.random() < goldFindChance) {
    gold.value += 1;
    logEvent("✨ <strong>황금 소금</strong>을 발견했습니다!");
  }

  setTimeout(() => { isMiningCooldown.value = false; }, 100); 
};

const buyUpgrade = (itemId) => {
  const item = shopItems.value.find((i) => i.id === itemId);
  if (salt.value < item.cost) return;
  salt.value -= item.cost;
  upgrades[itemId] = (upgrades[itemId] || 0) + 1;
  if (item.gps) perSecond.value += item.gps;
  if (item.type === "click") perClick.value += item.add;
  logEvent(`'${item.name}' 업그레이드 구매!`);
};

const sellSalt = async () => {
  const saltToSell = Math.floor(salt.value);
  if (saltToSell < gameSettings.saltMineRate) return alert(`${gameSettings.saltMineRate.toLocaleString()}개 이상 판매 가능`);
  isProcessing.value = true;
  try {
    await saveGame(); 
    const sellSaltForPoints = httpsCallable(functions, "sellSaltForPoints");
    const result = await sellSaltForPoints({ amountToSell: saltToSell });
    salt.value -= result.data.soldSalt;
    alert(`소금 판매 완료: +${result.data.awardedPoints.toLocaleString()} SaltMate`);
  } catch (error) { alert(`오류: ${error.message}`); } 
  finally { isProcessing.value = false; }
};

const executeWorkshopUpgrade = async () => {
  if (salt.value < workshopUpgradeCost.value) return alert("소금이 부족합니다.");
  if (!confirm(`공방을 Lv.${workshopLevel.value + 1}(으)로 업그레이드 하시겠습니까?`)) return;
  isProcessing.value = true;
  try {
    const upgradeWorkshop = httpsCallable(functions, "upgradeWorkshop");
    await upgradeWorkshop();
    alert("업그레이드 성공!");
    await loadGame();
  } catch (error) { alert(`오류: ${error.message}`); }
  finally { isProcessing.value = false; }
};

const executeCraft = async (recipeId) => {
  const recipe = workshopItems.value.find(r => r.id === recipeId);
  if (!recipe || !recipe.canCraft) return;
  if (!confirm(`'${recipe.itemName}' 아이템을 제작하시겠습니까?`)) return;
  isProcessing.value = true;
  try {
    const craftItem = httpsCallable(functions, "craftItem");
    await craftItem({ recipeId });
    alert("제작 성공!");
    await Promise.all([loadGame(), fetchRecipesAndResources()]);
  } catch (error) { alert(`오류: ${error.message}`); }
  finally { isProcessing.value = false; }
};
const executePurchase = async (skinId) => {
  isProcessing.value = true;
  try {
    const purchaseCosmetic = httpsCallable(functions, "purchaseCosmetic");
    await purchaseCosmetic({ cosmeticId: skinId });
    ownedSkins.value.push(skinId);
    alert("스킨을 구매했습니다!");
  } catch (error) { alert(`구매 실패: ${error.message}`); } 
  finally { isProcessing.value = false; }
};
const equipSkin = async (skin) => {
  equippedSkins[skin.type] = skin.id;
  await saveGame();
  alert(`${skin.name} 스킨을 장착했습니다.`);
};
const openExchangeModal = () => { isExchangeModalVisible.value = true; };
const closeExchangeModal = () => { isExchangeModalVisible.value = false; };
const executeExchange = async () => {
  if (!currentUser.value || gold.value < exchangeQuantity.value || isProcessing.value || !exchangeQuantity.value || exchangeQuantity.value <= 0) {
    alert("교환할 수량이 올바르지 않습니다.");
    return;
  }
  if (!confirm(`황금 소금 ${exchangeQuantity.value}개를 교환하시겠습니까?`)) return;

  isProcessing.value = true;
  try {
    const exchangeGoldenSaltFunc = httpsCallable(functions, "exchangeGoldenSalt");
    const result = await exchangeGoldenSaltFunc({ quantity: exchangeQuantity.value });
    const { awardedPoints } = result.data;

    gold.value -= exchangeQuantity.value; 

    logEvent(`황금 소금 ${exchangeQuantity.value}개를 사용하여 <strong>${awardedPoints.toLocaleString()} SaltMate</strong>를 획득했습니다!`);
    alert(`성공적으로 교환했습니다: +${awardedPoints.toLocaleString()} SaltMate`);
    closeExchangeModal();

  } catch (error) {
    console.error("황금 소금 교환 오류:", error);
    alert(`오류: ${error.message}`);
  } finally {
    isProcessing.value = false;
  }
};
const openPrestigeModal = () => { isPrestigeModalVisible.value = true; };
const closePrestigeModal = () => { isPrestigeModalVisible.value = false; };
const executePrestige = async () => {
  isProcessing.value = true;
  try {
    const prestigeSaltMine = httpsCallable(functions, "prestigeSaltMine");
    await prestigeSaltMine();
    alert("환생 완료!");
    window.location.reload();
  } catch (error) { alert(`오류: ${error.message}`); }
  finally { isProcessing.value = false; }
};

// [수정] 페이지 로드 시 오토 방지 상태 복구
onMounted(() => {
  // 1. 오토 방지 상태 복구
  const savedPenalty = localStorage.getItem('saltMine_macro_penalty');
  if (savedPenalty) {
      try {
          const { count, endTime } = JSON.parse(savedPenalty);
          penaltyCount.value = count || 0;

          if (endTime && endTime > Date.now()) {
              const remainingTime = endTime - Date.now();
              isPenaltyActive.value = true;
              
              logEvent(`⚠️ <strong>채굴기 과열 유지!</strong> 이전 페널티가 ${Math.ceil(remainingTime / 1000)}초 남았습니다.`);
              
              setTimeout(() => {
                  isPenaltyActive.value = false;
                  clickHistory.value = [];
                  // 페널티 종료 후 상태 업데이트
                  localStorage.setItem('saltMine_macro_penalty', JSON.stringify({
                      count: penaltyCount.value,
                      endTime: null
                  }));
              }, remainingTime);
          }
      } catch (e) {
          console.error("페널티 정보 복구 실패:", e);
      }
  }

  // 2. 기존 로직 유지
  authUnsubscribe = onAuthStateChanged(auth, (user) => {
    resetGameState();
    if (user) {
      currentUser.value = user;
      loadGame();
      listenToGameSettings();
      fetchRecipesAndResources();
      fetchSkins();
    } else {
      currentUser.value = null;
      logEvent("로그인이 필요합니다.");
    }
  });
  gameInterval = setInterval(gameTick, 1000);
  saveInterval = setInterval(saveGame, 15000);
});

onUnmounted(() => {
  clearInterval(gameInterval);
  clearInterval(saveInterval);
  saveGame();
  if (authUnsubscribe) authUnsubscribe();
});

</script>

<style scoped>
/* (기존 스타일) */
.boost-active-banner { display: flex; align-items: center; gap: 15px; padding: 15px; background-color: #d1fae5; color: #065f46; border: 1px solid #6ee7b7; }
.boost-active-banner i { font-size: 1.8em; }
.boost-info { display: flex; flex-direction: column; text-align: left; }
.boost-info span { font-weight: bold; }
.boosted-text { color: #28a745; font-weight: bold; }
.page-container { max-width: 1100px; margin: 70px auto 20px; padding: 20px; background-color: #f0f2f5; border-radius: 15px; background-size: cover; background-position: center; }
.page-header { text-align: center; margin-bottom: 30px; }
.page-header h1 { 
  color: #ffd166;
  text-shadow: 0 2px 4px rgba(0,0,0,0.5);
}
.page-header p { 
  color: #ffd166;
  text-shadow: 0 1px 3px rgba(0,0,0,0.5);
}
.page-header h1 i { color: #ffd166; }
.game-layout { display: grid; grid-template-columns: 1fr 360px; gap: 20px; align-items: start; }
.game-main { display: flex; flex-direction: column; gap: 20px; }
.top-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
.stat { background-color: #ffffff; padding: 15px; border-radius: 10px; text-align: center; }
.stat span { font-size: 1.5em; font-weight: bold; color: #1e293b; }
.stat small { display: block; color: #64748b; font-size: 0.9em; margin-top: 5px; }

.mine-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px;
}
.mine-visual {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 150px; /* 높이 증가 */
  font-size: 5em;
  color: #34495e;
  margin-bottom: 20px;
  border-radius: 10px;
  position: relative; /* 클릭 이펙트 기준점 */
  cursor: pointer; /* 클릭 가능함을 표시 */
  animation: swing 2.5s ease-in-out infinite; /* 기본 애니메이션 변경 */
}
@keyframes swing {
  0% { transform: rotate(0deg); }
  25% { transform: rotate(8deg); }
  75% { transform: rotate(-8deg); }
  100% { transform: rotate(0deg); }
}
.mine-button { padding: 15px 30px; font-size: 1.2em; font-weight: bold; background-color: #ffd166; color: #1e293b; border: none; border-radius: 10px; cursor: pointer; transition: transform 0.2s; touch-action: manipulation; user-select: none; -webkit-user-select: none;}
.mine-button:hover { transform: scale(1.05); }
.log-card { padding: 20px; }
.log-card h3 { margin-top: 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; color: #1e293b; }
.log-box { height: 150px; overflow-y: auto; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: left; font-size: 0.9em; color: #334155; }
.game-sidebar { display: flex; flex-direction: column; gap: 20px; }
.shop-card, .sell-card, .achievement-card { padding: 20px; }
.shop-card h3, .sell-card h3, .achievement-card h3, .log-card h3 { margin-top: 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; color: #1e293b; }
.shop-items { display: flex; flex-direction: column; gap: 10px; max-height: 250px; overflow-y: auto; padding-right: 10px; }
.shop-item { display: flex; align-items: center; gap: 15px; background-color: #f8fafc; padding: 10px; border-radius: 8px; }
.item-icon { font-size: 1.8em; color: #ffd166; width: 40px; text-align: center; }
.item-info { flex-grow: 1; }
.item-info strong { color: #1e293b; }
.item-info small { color: #64748b; }
.buy-upgrade-button { background-color: #475569; color: #e2e8f0; border: 1px solid #64748b; padding: 8px 12px; border-radius: 6px; cursor: pointer; white-space: nowrap; }
.buy-upgrade-button:disabled { background-color: #e2e8f0; color: #94a3b8; cursor: not-allowed; }
.sell-card { text-align: center; }
.gold-salt-display { display: flex; justify-content: center; align-items: center; gap: 10px; font-size: 1.1em; margin-bottom: 10px; }
.gold-salt-display i { color: #f1c40f; }
.sell-card p { font-size: 1.1em; color: #334155; }
.sell-button, .boost-button { width: 100%; padding: 12px; font-size: 1em; font-weight: bold; border: none; border-radius: 8px; cursor: pointer; }
.sell-button { background-color: #22c55e; color: white; }
.sell-button:disabled, .boost-button:disabled { background-color: #94a3b8; cursor: not-allowed; }
.achievement-list { display: flex; flex-wrap: wrap; gap: 10px; }
.achievement-item { background-color: #e2e8f0; padding: 8px 12px; border-radius: 20px; display: flex; align-items: center; gap: 8px; opacity: 0.5; transition: all 0.3s; }
.achievement-item.unlocked { background-color: #d1fae5; color: #065f46; opacity: 1; }
.ach-icon { font-size: 1.2em; }
.card {
  background-color: rgba(255, 255, 255, 0.85);
  border-radius: 15px;
  padding: 25px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  margin-bottom: 20px;
  backdrop-filter: blur(5px);
}
.gold-feature { background-color: #fffbeb; border: 1px solid #fde68a; }
.feature-desc { font-size: 0.9em; color: #78350f; margin-bottom: 15px; }
.boost-button { background-color: #f59e0b; color: white; }
.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(0, 0, 0, 0.6); display: flex; justify-content: center; align-items: center; z-index: 1000; }
.modal-content { width: 90%; max-width: 400px; padding: 0; }
.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 15px 20px; border-bottom: 1px solid #e2e8f0; }
.modal-header h3 { margin: 0; font-size: 1.2em; }
.close-button { background: none; border: none; font-size: 1.5em; cursor: pointer; }
.modal-body { padding: 20px; }
.exchange-info { display: flex; justify-content: space-between; font-size: 0.9em; color: #64748b; margin-bottom: 15px; }
.quantity-input { width: 100%; padding: 10px; font-size: 1.2em; text-align: center; border: 1px solid #ccc; border-radius: 8px; box-sizing: border-box; }
.exchange-summary { margin-top: 15px; text-align: center; font-size: 1.1em; }
.modal-footer { display: flex; justify-content: flex-end; gap: 10px; padding: 15px 20px; border-top: 1px solid #e2e8f0; }
.btn-primary, .btn-secondary { padding: 8px 16px; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; }
.btn-primary { background-color: #007bff; color: white; }
.btn-primary:disabled { background-color: #a0c9ff; }
.btn-secondary { background-color: #6c757d; color: white; }
.spinner-small { border: 2px solid rgba(255, 255, 255, 0.3); border-top: 2px solid #fff; border-radius: 50%; width: 16px; height: 16px; animation: spin 1s linear infinite; display: inline-block; }
@keyframes spin { to { transform: rotate(360deg); } }
.prestige-feature { background-color: #f0e6ff; border: 1px solid #d8b4fe; text-align: center; }
.prestige-feature h3 { display: flex; align-items: center; justify-content: center; gap: 10px; }
.prestige-feature h3 i { color: #9333ea; }
.prestige-info { display: flex; flex-direction: column; gap: 5px; background-color: #faf5ff; padding: 10px; border-radius: 8px; margin-bottom: 15px; font-size: 1.1em; }
.prestige-info strong { color: #9333ea; }
.prestige-button { width: 100%; padding: 12px; font-size: 1em; font-weight: bold; border: none; border-radius: 8px; cursor: pointer; background-color: #9333ea; color: white; }
.prestige-button:disabled { background-color: #c084fc; }
.prestige-summary { margin-top: 20px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; display: flex; flex-direction: column; gap: 10px; }
.prestige-summary div { display: flex; justify-content: space-between; align-items: center; }
.prestige-summary strong { font-size: 1.2em; color: #9333ea; }
.btn-primary.prestige-confirm { background-color: #9333ea; }
.pickaxe-skin-image {
  max-width: 120px; /* 이미지 크기 증가 */
  max-height: 120px;
  object-fit: contain;
  /* animation 속성은 부모(.mine-visual)가 담당하므로 삭제 */
}
@keyframes glow-effect { 0%, 100% { box-shadow: 0 0 3px #a78bfa, 0 0 6px #a78bfa, inset 0 0 2px #a78bfa; } 50% { box-shadow: 0 0 8px #c4b5fd, 0 0 15px #c4b5fd, inset 0 0 2px #c4b5fd; } }
.workshop-tab-btn.active { animation: glow-effect 2.5s infinite; }
.shop-card h3, .workshop-feature h3, .skins-feature h3 { display: flex; align-items: center; justify-content: center; gap: 10px; }
.skins-feature h3 i { color: #8e44ad; }
.skins-section { margin-top: 25px; }
.skins-section h4 { font-size: 1.2em; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; gap: 8px; color: #334155; justify-content: center; }
.skins-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 20px; }
.skin-item { display: flex; flex-direction: column; background-color: #ffffff; border-radius: 10px; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.05); overflow: hidden; transition: all 0.3s ease; }
.skin-item:hover { transform: translateY(-5px); box-shadow: 0 8px 20px rgba(0,0,0,0.1); }
.skin-item.equipped { border-color: #9333ea; box-shadow: 0 0 15px rgba(147, 51, 234, 0.4); }
.skin-preview { display: flex; align-items: center; justify-content: center; height: 140px; font-size: 3em; color: #475569; background-color: #f1f5f9; border-bottom: 1px solid #e2e8f0; padding: 10px; box-sizing: border-box; }
.skin-image { max-width: 100%; max-height: 100%; object-fit: contain; }
.background-preview { background-size: cover; background-position: center; }
.skin-name { font-size: 1em; font-weight: 600; text-align: center; padding: 12px 8px; flex-grow: 1; color: #1e293b; }
.skin-status { padding: 10px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; width: 100%; box-sizing: border-box; }
.skin-btn { width: 100%; padding: 8px; font-size: 0.9em; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; transition: background-color 0.2s; display: flex; align-items: center; justify-content: center; gap: 6px; }
.skin-btn.purchase { background-color: #007bff; color: white; }
.skin-btn.equip { background-color: #28a745; color: white; }
.skin-btn:disabled { background-color: #6c757d; color: white; cursor: not-allowed; opacity: 0.8; }
.gold-icon { color: #ffd166; }
.blue-icon { color: #8ecdfb; }

.workshop-feature { background-color: #f8fafc; border: 1px solid #e2e8f0; }
.workshop-feature h3 i { color: #475569; }
.workshop-upgrade-section { text-align: center; padding: 20px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
.upgrade-button { width: 100%; padding: 12px; background-color: #334155; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 1.1em; transition: all 0.3s ease; }
.upgrade-button:hover:not(:disabled) { background-color: #1e293b; transform: translateY(-2px); }
.upgrade-button small { display: block; font-size: 0.8em; opacity: 0.8; font-weight: normal; }
.recipe-list { display: flex; flex-direction: column; gap: 15px; max-height: 500px; overflow-y: auto; padding-right: 5px; }
.recipe-item { padding: 15px; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; transition: all 0.3s ease; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
.recipe-item:hover { transform: translateY(-4px); box-shadow: 0 8px 20px rgba(0,0,0,0.08); }
.recipe-item.locked { opacity: 0.7; background: #f1f5f9; }
.recipe-item.locked:hover { transform: none; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
.recipe-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid #f1f5f9; }
.recipe-header strong { font-size: 1.15em; color: #1e293b; }
.lock-reason { font-size: 0.8em; font-weight: bold; color: #ef4444; background-color: #fee2e2; padding: 3px 8px; border-radius: 10px; }
.ingredient-list { list-style: none; padding: 0; margin: 0 0 15px 0; font-size: 0.9em; display: flex; flex-direction: column; gap: 8px; }
.ingredient-list li { display: flex; justify-content: space-between; align-items: center; background-color: #f8fafc; padding: 8px 10px; border-radius: 6px; color: #ef4444; }
.ingredient-list li::before { content: '❌'; margin-right: 8px; }
.ingredient-list li.sufficient { color: #16a34a; }
.ingredient-list li.sufficient::before { content: '✅'; }
.craft-button { width: 100%; padding: 12px; background-color: #0d6efd; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 1.05em; transition: all 0.2s ease; }
.craft-button:hover:not(:disabled) { background-color: #0b5ed7; transform: scale(1.02); }
.craft-button:disabled { background-color: #a0c9ff; cursor: not-allowed; }
.shortcut-btn { padding: 4px 10px; font-size: 0.85em; font-weight: bold; background-color: #6c757d; color: white; text-decoration: none; border-radius: 5px; transition: background-color 0.2s; }
.shortcut-btn:hover { background-color: #5a6268; }

.sidebar-tabs.desktop-tabs { display: flex; margin-bottom: 15px; background-color: #e2e8f0; border-radius: 8px; padding: 5px; }
.sidebar-tabs.desktop-tabs button { flex: 1; padding: 10px; border: none; background-color: transparent; cursor: pointer; font-weight: bold; border-radius: 6px; transition: all 0.3s ease; color: #475569; }
.sidebar-tabs.desktop-tabs button.active { background-color: #fff; color: #1e293b; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
.sidebar-tabs.mobile-dropdown { display: none; position: relative; margin-bottom: 15px; }
.active-tab-display { background-color: #fff; border: 1px solid #e2e8f0; padding: 12px 15px; border-radius: 8px; font-weight: bold; cursor: pointer; display: flex; justify-content: space-between; align-items: center; }
.dropdown-menu { position: absolute; top: 100%; left: 0; right: 0; background-color: #fff; border: 1px solid #e2e8f0; border-radius: 8px; margin-top: 5px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); z-index: 10; }
.dropdown-menu button { display: block; width: 100%; text-align: left; padding: 12px 15px; background: none; border: none; font-weight: 500; cursor: pointer; }
.dropdown-menu button:hover { background-color: #f8fafc; }

@media (max-width: 900px) {
  .game-layout { grid-template-columns: 1fr; }
  .page-container { padding: 15px; }
  .top-stats { grid-template-columns: 1fr; gap: 10px; }
  .stat { padding: 12px 15px; display: flex; justify-content: space-between; align-items: baseline; font-size: 1.1em; }
  .stat span { font-size: 1.2em; }
  .stat small { margin-top: 0; }
  .mine-area { padding: 25px; }
  .mine-visual { height: 100px; font-size: 4em; }
  .mine-button { font-size: 1.1em; }
  .shop-card, .sell-card, .achievement-card, .prestige-feature, .workshop-feature, .skins-feature { padding: 15px; }
  .sidebar-tabs.desktop-tabs { display: none; }
  .sidebar-tabs.mobile-dropdown { display: block; }
}

@media (min-width: 901px) {
  .sidebar-tabs.mobile-dropdown { display: none; }
}
.skin-bonus-info {
  font-size: 0.8em;
  color: #007bff;
  font-weight: bold;
  text-align: center;
  padding: 5px 0;
  min-height: 30px; /* 공간 확보 */
  display: flex;
  flex-direction: column;
  justify-content: center;
}
/* ▼▼▼ [신규] 클릭 이펙트 스타일 추가 ▼▼▼ */
.click-effect {
  position: absolute;
  width: 150px;
  height: 150px;
  background-image: radial-gradient(circle, rgba(255, 215, 0, 0.7) 0%, transparent 70%);
  border-radius: 50%;
  transform: scale(0);
  opacity: 0;
}
.click-effect.animate {
  animation: click-burst 0.3s ease-out;
}
@keyframes click-burst {
  0% { transform: scale(0); opacity: 1; }
  100% { transform: scale(1.5); opacity: 0; }
}
/* ▲▲▲ */
/* 쿨타임 중일 때 살짝 투명하게 표시 (클릭은 가능) */
.mine-button.cooldown {
  opacity: 0.8;
  transform: scale(0.98);
}
</style>