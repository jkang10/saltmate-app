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
            class="sell-button"
          >
            <span v-if="isSelling">판매 중...</span>
            <span v-else>모두 판매하기</span>
          </button>
        </div>

        <div class="sell-card card gold-feature">
          <h3>황금 소금 교환소</h3>
          <div class="gold-salt-display">
            <i class="fas fa-medal"></i>
            <span
              >보유 황금 소금:
              <strong>{{ gold.toLocaleString() }}</strong> 개</span
            >
          </div>
          <p class="feature-desc">
            황금 소금 1개를 {{ gameSettings.goldenSaltExchangeRate }} SaltMate로
            교환합니다.
          </p>
          <button
            @click="exchangeGold"
            :disabled="isExchanging || gold < 1"
            class="boost-button"
          >
            <span v-if="isExchanging">교환 중...</span>
            <span v-else>SaltMate로 교환</span>
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
import { httpsCallable } from "firebase/functions";
import { auth, db, functions } from "@/firebaseConfig";
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  updateDoc,
  increment,
  serverTimestamp,
} from "firebase/firestore";
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
      isExchanging: false,
      logs: [],
      currentUser: null,
      gameStateRef: null,
      isLoading: true,
      authUnsubscribe: null,
      gameSettings: {
        saltMineRate: 1000,
        deepSeaRate: 100000,
        goldenSaltExchangeRate: 1,
      },
      gameInterval: null,
      saveInterval: null, // [신규] 15초마다 자동 저장을 관리할 변수
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
        // '곡괭이 강화' 아이템의 아이콘을 'fas fa-hammer'로 변경했습니다.
        {
          id: "pick_upgrade",
          name: "곡괭이 강화",
          baseCost: 120,
          type: "click",
          add: 1,
          desc: "클릭당 +1 소금",
          icon: "fas fa-hammer",
        },
        {
          id: "offline_miner_1",
          name: "기본 자동 채굴기",
          baseCost: 1000000,
          type: "offline",
          duration: 2,
          desc: "최대 2시간 오프라인 채굴",
          icon: "fas fa-power-off",
        },
      ];
      return SHOP_DEFS.map((item) => ({
        ...item,
        cost: Math.ceil(
          item.baseCost *
            Math.pow(
              item.id.startsWith("offline") ? 2.5 : 1.6,
              this.upgrades[item.id] || 0,
            ),
        ),
      }));
    },
    currentPickaxeIcon() {
      if ((this.upgrades["robot"] || 0) > 0) return "fas fa-robot";
      if ((this.upgrades["drill"] || 0) > 0) return "fas fa-tools";
      if ((this.upgrades["miner"] || 0) > 0) return "fas fa-cogs";
      return "fas fa-hammer"; // 메인 곡괭이 아이콘도 망치로 변경
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
      // [수정] resetGameState는 그대로 두고, listenToGameState 대신 loadGame 호출
      this.resetGameState();
      if (user) {
        this.currentUser = user;
        this.gameStateRef = doc(db, `users/${user.uid}/game_state/salt_mine`);
        this.loadGame(); // 1회성 데이터 로드
        this.listenToGameSettings();
      } else {
        this.currentUser = null;
        this.logEvent("게임 데이터를 저장하고 불러오려면 로그인이 필요합니다.");
      }
    });

    this.gameInterval = setInterval(this.gameTick, 1000);
    // [신규] 15초(15000ms)마다 saveGame 함수를 호출하는 인터벌 시작
    this.saveInterval = setInterval(this.saveGame, 15000);
  },
  unmounted() {
    // [수정] 컴포넌트가 사라질 때 모든 인터벌을 정리하고, 마지막으로 게임을 저장
    clearInterval(this.gameInterval);
    clearInterval(this.saveInterval);
    this.saveGame(); // 페이지를 떠나기 전 최종 저장
    if (this.authUnsubscribe) {
      this.authUnsubscribe();
    }
  },

  methods: {
    resetGameState() {
      this.salt = 0;
      this.gold = 0;
      this.perClick = 1;
      this.perSecond = 0;
      this.upgrades = {};
      this.logs = [];
      this.isLoading = true;
      this.isInitialLoad = true;
      this.logEvent("게임에 오신 것을 환영합니다!");
    },

    async loadGame() {
      if (!this.gameStateRef) return;
      this.isLoading = true;
      try {
        const docSnap = await getDoc(this.gameStateRef);
        if (docSnap.exists()) {
          const state = docSnap.data();
          const upgrades = state.upgrades || {};
          const offlineMinerLevel = upgrades.offline_miner_1 || 0;
          let maxOfflineSeconds = 0;
          if (offlineMinerLevel > 0) {
            maxOfflineSeconds = (upgrades.offline_miner_1 || 0) * 2 * 3600;
          }
          const lastUpdate = state.lastUpdated?.toDate() || new Date();
          const now = new Date();
          const secondsDiff = (now.getTime() - lastUpdate.getTime()) / 1000;
          const effectiveSeconds = Math.min(secondsDiff, maxOfflineSeconds);
          const offlineSalt = Math.floor(
            effectiveSeconds * (state.perSecond || 0),
          );

          if (offlineSalt > 0) {
            this.logEvent(
              `오프라인 상태에서 <strong>${offlineSalt.toLocaleString()}</strong>개의 소금을 채굴했습니다!`,
            );
          }

          this.salt = (state.salt || 0) + offlineSalt;
          this.gold = state.gold || 0;
          this.perClick = state.perClick || 1;
          this.perSecond = state.perSecond || 0;
          this.upgrades = state.upgrades || {};
        } else {
          // 신규 유저의 경우 기본값으로 시작
          this.logEvent("데이터가 없습니다. 새로운 게임을 시작합니다!");
        }
      } catch (error) {
        console.error("게임 데이터 로딩 오류:", error);
      } finally {
        this.isLoading = false;
      }
    },

    async saveGame() {
      // 로그인하지 않았거나, 로딩 중이거나, 로컬과 DB 상태가 같다면 저장하지 않음
      if (!this.currentUser || !this.gameStateRef || this.isLoading) {
        return;
      }

      const state = {
        salt: this.salt,
        gold: this.gold,
        perClick: this.perClick,
        perSecond: this.perSecond,
        upgrades: this.upgrades,
        lastUpdated: serverTimestamp(), // 서버 시간으로 현재 시간 기록
      };

      try {
        // setDoc을 사용하여 현재 게임 상태를 통째로 덮어쓰기
        await setDoc(this.gameStateRef, state, { merge: true });
        console.log("게임 진행 상황이 저장되었습니다.");
      } catch (error) {
        console.error("게임 데이터 저장 오류:", error);
      }
    },

    getGameStateObject() {
      return {
        salt: this.salt,
        gold: this.gold,
        perClick: this.perClick,
        perSecond: this.perSecond,
        upgrades: this.upgrades,
      };
    },
    listenToGameSettings() {
      const configRef = doc(db, "configuration", "gameSettings");
      onSnapshot(configRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          this.gameSettings.saltMineRate = data.saltMineRate || 1000;
          this.gameSettings.deepSeaRate = data.deepSeaRate || 100000;
          this.gameSettings.goldenSaltExchangeRate =
            data.goldenSaltExchangeRate || 1;
        }
      });
    },

    gameTick() {
      if (this.isLoading || !this.currentUser || this.perSecond === 0) return;
      const now = new Date();
      if (!this.lastServerUpdateTime) {
        this.lastServerUpdateTime = now;
        return;
      }
      const visualDiff =
        (now.getTime() - this.lastServerUpdateTime.getTime()) / 1000;
      this.salt += this.perSecond * visualDiff;
      this.lastServerUpdateTime = now;
    },
    // mineSalt 와 buyUpgrade 함수를 아래 내용으로 교체해주세요.

    async mineSalt() {
      // [수정] DB 업데이트 로직 제거. 로컬 데이터만 변경
      this.salt += this.perClick;
      if (Math.random() < 0.01) {
        this.gold += 1;
        this.logEvent("✨ <strong>황금 소금</strong>을 발견했습니다!");
        // 황금소금은 희귀하므로 발견 즉시 저장
        this.saveGame();
      }
    },
    async buyUpgrade(itemId) {
      // [수정] DB 업데이트 로직 제거. 로컬 데이터만 변경
      const item = this.shopItems.find((i) => i.id === itemId);
      if (this.salt < item.cost) return;

      this.salt -= item.cost;
      this.upgrades[itemId] = (this.upgrades[itemId] || 0) + 1;

      if (item.gps) this.perSecond += item.gps;
      if (item.type === "click") this.perClick += item.add;

      this.logEvent(`'${item.name}' 업그레이드 구매!`);
      // 중요한 액션이므로 즉시 저장
      this.saveGame();
    },
    async sellSalt() {
      if (!this.currentUser) {
        alert("로그인이 필요합니다.");
        return;
      }
      if (this.isSelling) return;

      const currentDoc = await getDoc(this.gameStateRef);
      if (
        !currentDoc.exists() ||
        (currentDoc.data().salt || 0) < this.gameSettings.saltMineRate
      ) {
        alert(
          `${this.gameSettings.saltMineRate.toLocaleString()}개 이상의 소금만 판매할 수 있습니다.`,
        );
        return;
      }

      this.isSelling = true;

      try {
        const sellSaltForPoints = httpsCallable(functions, "sellSaltForPoints");
        const result = await sellSaltForPoints({});
        const { awardedPoints, soldSalt } = result.data;

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
    async exchangeGold() {
      if (!this.currentUser || this.gold < 1) return;
      if (
        !confirm(
          `황금 소금 1개를 ${this.gameSettings.goldenSaltExchangeRate} SaltMate로 교환하시겠습니까?`,
        )
      )
        return;

      this.isExchanging = true;
      try {
        const exchangeGoldenSalt = httpsCallable(
          functions,
          "exchangeGoldenSalt",
        );
        const result = await exchangeGoldenSalt();
        const { awardedPoints } = result.data;

        this.logEvent(
          `황금 소금 1개를 사용하여 <strong>${awardedPoints.toLocaleString()} SaltMate</strong>를 획득했습니다!`,
        );
        alert(
          `황금 소금 1개를 사용하여 ${awardedPoints.toLocaleString()} SaltMate를 획득했습니다!`,
        );
      } catch (error) {
        console.error("황금 소금 교환 오류:", error);
        alert(`오류: ${error.message}`);
      } finally {
        this.isExchanging = false;
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
.sell-button,
.boost-button {
  width: 100%;
  padding: 12px;
  font-size: 1em;
  font-weight: bold;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}
.sell-button {
  background-color: #22c55e;
  color: white;
}
.sell-button:disabled,
.boost-button:disabled {
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
.gold-feature {
  background-color: #fffbeb;
  border: 1px solid #fde68a;
}
.feature-desc {
  font-size: 0.9em;
  color: #78350f;
  margin-bottom: 15px;
}
.boost-button {
  background-color: #f59e0b;
  color: white;
}
</style>
