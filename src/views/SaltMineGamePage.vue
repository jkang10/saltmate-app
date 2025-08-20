// 파일 경로: src/views/SaltMineGamePage.vue

<template>
  <div class="page-container">
    <header class="page-header">
      <h1><i class="fas fa-gem"></i> 소금 광산</h1>
      <p class="description">
        소금을 채굴하고 업그레이드하여 SaltMate 포인트를 획득하세요!
      </p>
    </header>

    <main class="game-layout">
      <div class="game-main">
        <div class="top-stats">
          <div class="stat">
            <span>{{ Math.floor(salt).toLocaleString() }}</span
            ><small>보유 소금</small>
          </div>
          <div class="stat">
            <span>{{ perSecond.toLocaleString() }} / 초</span
            ><small>자동 채굴량</small>
          </div>
          <div class="stat">
            <span>{{ perClick.toLocaleString() }} / 클릭</span
            ><small>클릭 채굴량</small>
          </div>
        </div>

        <div class="mine-area card">
          <div class="mine-visual">
            <i :class="currentPickaxeIcon"></i>
          </div>
          <p>소금을 채굴하려면 아래 버튼을 클릭하세요!</p>
          <button @click="mineSalt" class="mine-button">채굴하기</button>
        </div>

        <div class="log-card card">
          <h3>이벤트 로그</h3>
          <div class="log-box" id="logBox">
            <div v-for="(log, index) in logs" :key="index" v-html="log"></div>
          </div>
        </div>
      </div>

      <aside class="game-sidebar">
        <div class="shop-card card">
          <h3>업그레이드 상점</h3>
          <div class="shop-items">
            <div v-for="item in shopItems" :key="item.id" class="shop-item">
              <div class="item-icon">
                <i :class="item.icon"></i>
              </div>
              <div class="item-info">
                <strong>{{ item.name }}</strong>
                <small
                  >{{ item.desc }} (보유: {{ upgrades[item.id] || 0 }})</small
                >
              </div>
              <button
                @click="buyUpgrade(item.id)"
                :disabled="salt < item.cost"
                class="buy-upgrade-button"
              >
                {{ item.cost.toLocaleString() }}
              </button>
            </div>
          </div>
        </div>

        <div class="sell-card card">
          <h3>소금 판매소</h3>
          <div class="gold-salt-display">
            <i class="fas fa-medal"></i>
            <span
              >보유 황금 소금:
              <strong>{{ gold.toLocaleString() }}</strong> 개</span
            >
          </div>
          <p>
            현재 시세:
            <strong
              >{{ gameSettings.saltMineRate.toLocaleString() }} 소금 = 1
              SaltMate</strong
            >
          </p>
          <button
            @click="sellSalt"
            :disabled="isSelling || salt < gameSettings.saltMineRate"
          >
            <span v-if="isSelling">판매 중...</span>
            <span v-else>모두 판매하기</span>
          </button>
        </div>

        <div class="achievement-card card">
          <h3>업적</h3>
          <div class="achievement-list">
            <div
              v-for="ach in achievements"
              :key="ach.id"
              class="achievement-item"
              :class="{ unlocked: ach.unlocked }"
              :title="ach.desc"
            >
              <span class="ach-icon">{{ ach.icon }}</span>
              <span class="ach-name">{{ ach.name }}</span>
            </div>
          </div>
        </div>
      </aside>
    </main>
  </div>
</template>

<script>
import { getFunctions, httpsCallable } from "firebase/functions";
import { auth, db } from "@/firebaseConfig";
// ▼▼▼ [신규 추가] onSnapshot import ▼▼▼
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
// ▲▲▲ 신규 추가 완료 ▲▲▲
import { onAuthStateChanged } from "firebase/auth";

export default {
  name: "SaltMineGamePage",
  data() {
    return {
      salt: 0,
      gold: 0,
      perClick: 1,
      perSecond: 0,
      upgrades: {},
      isSelling: false,
      gameInterval: null,
      logs: [],
      currentUser: null,
      gameStateRef: null,
      isLoading: true,
      authUnsubscribe: null,
      // ▼▼▼ [신규 추가] 게임 설정값을 저장할 객체 ▼▼▼
      gameSettings: {
        saltMineRate: 1000, // 기본값
        deepSeaRate: 100000, // 기본값
      },
      // ▲▲▲ 신규 추가 완료 ▲▲▲
    };
  },
  computed: {
    shopItems() {
      const SHOP_DEFS = [
        {
          id: "miner",
          name: "자동 채굴기",
          baseCost: 50,
          gps: 1,
          desc: "초당 +1 소금",
          icon: "fas fa-cogs",
        },
        {
          id: "drill",
          name: "전동 드릴",
          baseCost: 300,
          gps: 5,
          desc: "초당 +5 소금",
          icon: "fas fa-tools",
        },
        {
          id: "robot",
          name: "채굴 로봇",
          baseCost: 2000,
          gps: 25,
          desc: "초당 +25 소금",
          icon: "fas fa-robot",
        },
        {
          id: "pick_upgrade",
          name: "곡괭이 강화",
          baseCost: 120,
          type: "click",
          add: 1,
          desc: "클릭당 +1 소금",
          icon: "fas fa-pickaxe",
        },
      ];
      return SHOP_DEFS.map((item) => ({
        ...item,
        cost: Math.ceil(
          item.baseCost * Math.pow(1.6, this.upgrades[item.id] || 0),
        ),
      }));
    },
    currentPickaxeIcon() {
      if ((this.upgrades["robot"] || 0) > 0) return "fas fa-robot";
      if ((this.upgrades["drill"] || 0) > 0) return "fas fa-tools";
      if ((this.upgrades["miner"] || 0) > 0) return "fas fa-cogs";
      return "fas fa-pickaxe";
    },
    achievements() {
      const ACH_DEFS = [
        {
          id: "salt_1000",
          name: "초보 광부",
          desc: "소금 1,000개 모으기",
          icon: "⛏️",
          unlocked: this.salt >= 1000,
        },
        {
          id: "salt_10000",
          name: "숙련된 광부",
          desc: "소금 10,000개 모으기",
          icon: "⚒️",
          unlocked: this.salt >= 10000,
        },
        {
          id: "gold_1",
          name: "첫 발견",
          desc: "황금 소금 1개 발견하기",
          icon: "✨",
          unlocked: this.gold >= 1,
        },
        {
          id: "automation_expert",
          name: "자동화 전문가",
          desc: "채굴 로봇 구매하기",
          icon: "🤖",
          unlocked: (this.upgrades["robot"] || 0) > 0,
        },
      ];
      return ACH_DEFS;
    },
  },
  mounted() {
    this.authUnsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        this.currentUser = user;
        this.gameStateRef = doc(db, `users/${user.uid}/game_state/salt_mine`);
        this.loadGame();
        // ▼▼▼ [신규 추가] 게임 설정 실시간 감지 리스너 ▼▼▼
        this.listenToGameSettings();
        // ▲▲▲ 신규 추가 완료 ▲▲▲
      } else {
        this.currentUser = null;
        alert("게임 데이터를 저장하고 불러오려면 로그인이 필요합니다.");
      }
    });
    this.gameInterval = setInterval(this.gameTick, 1000);
    this.logEvent("게임에 오신 것을 환영합니다!");
  },
  unmounted() {
    clearInterval(this.gameInterval);
    this.saveGame();
    if (this.authUnsubscribe) {
      this.authUnsubscribe();
    }
  },
  methods: {
    // ▼▼▼ [신규 추가] 게임 설정 실시간으로 불러오는 함수 ▼▼▼
    listenToGameSettings() {
      const configRef = doc(db, "configuration", "gameSettings");
      onSnapshot(configRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          this.gameSettings.saltMineRate = data.saltMineRate || 1000;
          this.gameSettings.deepSeaRate = data.deepSeaRate || 100000;
        } else {
          // 문서가 없을 경우 기본값 유지
          this.gameSettings.saltMineRate = 20000; // 요청하신 20000으로 기본값 변경
          this.gameSettings.deepSeaRate = 100000;
        }
      });
    },
    // ▲▲▲ 신규 추가 완료 ▲▲▲
    async loadGame() {
      if (!this.gameStateRef) return;
      this.isLoading = true;
      try {
        const docSnap = await getDoc(this.gameStateRef);
        if (docSnap.exists()) {
          const state = docSnap.data();
          this.salt = state.salt || 0;
          this.gold = state.gold || 0;
          this.perClick = state.perClick || 1;
          this.perSecond = state.perSecond || 0;
          this.upgrades = state.upgrades || {};
        }
      } catch (error) {
        console.error("게임 데이터 불러오기 오류:", error);
      } finally {
        this.isLoading = false;
      }
    },
    async saveGame() {
      if (!this.gameStateRef) return;
      const state = {
        salt: this.salt,
        gold: this.gold,
        perClick: this.perClick,
        perSecond: this.perSecond,
        upgrades: this.upgrades,
        lastSaved: new Date(),
      };
      try {
        await setDoc(this.gameStateRef, state);
      } catch (error) {
        console.error("게임 데이터 저장 오류:", error);
      }
    },
    gameTick() {
      this.salt += this.perSecond;
    },
    mineSalt() {
      this.salt += this.perClick;
      if (Math.random() < 0.01) {
        this.gold++;
        this.logEvent("✨ <strong>황금 소금</strong>을 발견했습니다!");
        this.saveGame();
      }
    },
    buyUpgrade(itemId) {
      const item = this.shopItems.find((i) => i.id === itemId);
      if (this.salt < item.cost) return;

      this.salt -= item.cost;
      this.upgrades[itemId] = (this.upgrades[itemId] || 0) + 1;

      if (item.gps) this.perSecond += item.gps;
      if (item.type === "click") this.perClick += item.add;

      this.logEvent(`'${item.name}' 업그레이드 구매!`);
      this.saveGame();
    },
    async sellSalt() {
      if (!this.currentUser) {
        alert("로그인이 필요합니다.");
        return;
      }
      // ▼▼▼ [수정됨] 최소 판매 조건을 동적 시세로 변경 ▼▼▼
      if (this.isSelling || this.salt < this.gameSettings.saltMineRate) {
        alert(
          `${this.gameSettings.saltMineRate.toLocaleString()}개 이상의 소금만 판매할 수 있습니다.`,
        );
        return;
      }
      // ▲▲▲ 수정 완료 ▲▲▲
      this.isSelling = true;

      try {
        const functions = getFunctions(undefined, "asia-northeast3");
        const sellSaltForPoints = httpsCallable(functions, "sellSaltForPoints");
        const result = await sellSaltForPoints();

        const { awardedPoints, soldSalt } = result.data;
        // this.salt = 0; // 서버에서 처리하므로 클라이언트에서 직접 0으로 만들지 않습니다.
        // this.saveGame(); // 함수 호출 성공 시 자동으로 데이터가 갱신되므로 수동 저장 불필요
        this.logEvent(
          `소금 ${soldSalt.toLocaleString()}개를 판매하여 <strong>${awardedPoints.toLocaleString()} SaltMate 포인트</strong>를 획득했습니다!`,
        );
        alert(
          `소금 ${soldSalt.toLocaleString()}개를 판매하여 ${awardedPoints.toLocaleString()} SaltMate 포인트를 획득했습니다!`,
        );
      } catch (error) {
        console.error("소금 판매 오류:", error);
        alert(`오류: ${error.message}`);
      } finally {
        this.isSelling = false;
      }
    },
    logEvent(message) {
      const time = new Date().toLocaleTimeString();
      this.logs.unshift(`[${time}] ${message}`);
      if (this.logs.length > 50) {
        this.logs.pop();
      }
      this.$nextTick(() => {
        const logBox = this.$el.querySelector("#logBox");
        if (logBox) logBox.scrollTop = 0;
      });
    },
  },
};
</script>

<style scoped>
/* 스타일은 변경사항이 없으므로 그대로 유지됩니다. */
.page-container {
  max-width: 1100px;
  margin: 70px auto 20px;
  padding: 20px;
  background-color: #f0f2f5;
  border-radius: 15px;
}
.page-header {
  text-align: center;
  margin-bottom: 30px;
}
.page-header h1 {
  color: #1e293b;
}
.page-header p {
  color: #475569;
}
.page-header h1 i {
  color: #ffd166;
}
.game-layout {
  display: grid;
  grid-template-columns: 1fr 360px;
  gap: 20px;
  align-items: start;
}
@media (max-width: 900px) {
  .game-layout {
    grid-template-columns: 1fr;
  }
}
.game-main {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.top-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 15px;
}
.stat {
  background-color: #ffffff;
  padding: 15px;
  border-radius: 10px;
  text-align: center;
}
.stat span {
  font-size: 1.5em;
  font-weight: bold;
  color: #1e293b;
}
.stat small {
  display: block;
  color: #64748b;
  font-size: 0.9em;
  margin-top: 5px;
}
.mine-area {
  text-align: center;
  padding: 40px;
}
.mine-visual {
  font-size: 4em;
  margin-bottom: 15px;
  animation: bounce 2s infinite;
  color: #1e293b;
}
@keyframes bounce {
  0%,
  20%,
  50%,
  80%,
  100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-20px);
  }
  60% {
    transform: translateY(-10px);
  }
}
.mine-button {
  padding: 15px 30px;
  font-size: 1.2em;
  font-weight: bold;
  background-color: #ffd166;
  color: #1e293b;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: transform 0.2s;
}
.mine-button:hover {
  transform: scale(1.05);
}
.log-card {
  padding: 20px;
}
.log-card h3 {
  margin-top: 0;
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 10px;
  color: #1e293b;
}
.log-box {
  height: 150px;
  overflow-y: auto;
  background-color: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px;
  text-align: left;
  font-size: 0.9em;
  color: #334155;
}
.game-sidebar {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.shop-card,
.sell-card,
.achievement-card {
  padding: 20px;
}
.shop-card h3,
.sell-card h3,
.achievement-card h3 {
  margin-top: 0;
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 10px;
  color: #1e293b;
}
.shop-items {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 250px;
  overflow-y: auto;
  padding-right: 10px;
}
.shop-item {
  display: flex;
  align-items: center;
  gap: 15px;
  background-color: #f8fafc;
  padding: 10px;
  border-radius: 8px;
}
.item-icon {
  font-size: 1.8em;
  color: #ffd166;
  width: 40px;
  text-align: center;
}
.item-info {
  flex-grow: 1;
}
.item-info strong {
  color: #1e293b;
}
.item-info small {
  color: #64748b;
}
.buy-upgrade-button {
  background-color: #475569;
  color: #e2e8f0;
  border: 1px solid #64748b;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  white-space: nowrap;
}
.buy-upgrade-button:disabled {
  background-color: #e2e8f0;
  color: #94a3b8;
  cursor: not-allowed;
}
.sell-card {
  text-align: center;
}
.gold-salt-display {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  font-size: 1.1em;
  margin-bottom: 10px;
}
.gold-salt-display i {
  color: #f1c40f;
}
.sell-card p {
  font-size: 1.1em;
  color: #334155;
}
.sell-card button {
  width: 100%;
  padding: 12px;
  font-size: 1em;
  font-weight: bold;
  background-color: #22c55e;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}
.sell-card button:disabled {
  background-color: #94a3b8;
  cursor: not-allowed;
}
.achievement-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.achievement-item {
  background-color: #e2e8f0;
  padding: 8px 12px;
  border-radius: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  opacity: 0.5;
  transition: all 0.3s;
}
.achievement-item.unlocked {
  background-color: #d1fae5;
  color: #065f46;
  opacity: 1;
}
.ach-icon {
  font-size: 1.2em;
}
.card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
}
</style>
