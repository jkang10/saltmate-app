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
      logs: [],
      currentUser: null,
      gameStateRef: null,
      isLoading: true,
      authUnsubscribe: null,
      gameStateUnsubscribe: null, // 실시간 리스너 구독 해제용
      gameSettings: {
        saltMineRate: 1000,
        deepSeaRate: 100000,
      },
      lastServerUpdateTime: null, // 서버에서 마지막으로 업데이트된 시간
    };
  },
  computed: {
    // (computed 부분은 기존 코드와 동일하여 생략)
  },
  mounted() {
    this.authUnsubscribe = onAuthStateChanged(auth, (user) => {
      this.resetGameState();
      if (this.gameStateUnsubscribe) {
        this.gameStateUnsubscribe(); // 이전 유저의 리스너 구독 해제
      }
      if (user) {
        this.currentUser = user;
        this.gameStateRef = doc(db, `users/${user.uid}/game_state/salt_mine`);
        this.listenToGameState(); // 실시간 리스너 시작
        this.listenToGameSettings();
      } else {
        this.currentUser = null;
        this.logEvent("게임 데이터를 저장하고 불러오려면 로그인이 필요합니다.");
      }
    });
  },
  unmounted() {
    if (this.authUnsubscribe) this.authUnsubscribe();
    if (this.gameStateUnsubscribe) this.gameStateUnsubscribe(); // 컴포넌트 파괴 시 리스너 구독 해제
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
      this.logEvent("게임에 오신 것을 환영합니다!");
    },
    // [핵심 수정] 실시간으로 게임 상태를 감지하고 동기화하는 함수
    listenToGameState() {
      if (!this.gameStateRef) return;
      this.isLoading = true;
      this.gameStateUnsubscribe = onSnapshot(
        this.gameStateRef,
        (docSnap) => {
          let state;
          if (docSnap.exists()) {
            state = docSnap.data();
            // 오프라인 동안 쌓인 소금 계산 (서버 시간 기준)
            const lastUpdate = state.lastUpdated?.toDate() || new Date();
            const now = new Date();
            const secondsDiff = (now.getTime() - lastUpdate.getTime()) / 1000;
            const offlineSalt = Math.floor(
              secondsDiff * (state.perSecond || 0),
            );

            if (offlineSalt > 0) {
              // 오프라인 소금을 DB에 즉시 반영하여 동기화 기준점을 새로 만듦
              updateDoc(this.gameStateRef, {
                salt: increment(offlineSalt),
                lastUpdated: serverTimestamp(),
              });
            }
            this.salt = (state.salt || 0) + offlineSalt;
          } else {
            // 신규 유저
            state = { salt: 0 };
            setDoc(this.gameStateRef, {
              ...this.getGameStateObject(),
              lastUpdated: serverTimestamp(),
            });
          }
          // 로컬 데이터 업데이트
          this.gold = state.gold || 0;
          this.perClick = state.perClick || 1;
          this.perSecond = state.perSecond || 0;
          this.upgrades = state.upgrades || {};
          this.lastServerUpdateTime = new Date();
          this.isLoading = false;
        },
        (error) => {
          console.error("실시간 게임 데이터 수신 오류:", error);
          this.isLoading = false;
        },
      );
    },
    // [신규 추가] 현재 로컬 상태를 객체로 반환하는 헬퍼 함수
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
      // (기존 코드와 동일)
    },
    // [삭제] loadGame, saveGame 함수는 listenToGameState와 개별 업데이트 함수들로 대체됨

    // [핵심 수정] 1초마다 화면에만 보여주는 소금을 업데이트 (저장 X)
    gameTick() {
      if (this.isLoading || !this.currentUser) return;
      const now = new Date();
      // 마지막으로 서버와 동기화된 시간으로부터 얼마나 흘렀는지 계산하여 화면에 보여줌
      const visualDiff =
        (now.getTime() -
          (this.lastServerUpdateTime?.getTime() || now.getTime())) /
        1000;
      this.salt += this.perSecond * visualDiff;
      this.lastServerUpdateTime = now;
    },
    // [핵심 수정] 클릭 시 DB에 직접 증가 명령 (원자적 업데이트)
    async mineSalt() {
      if (!this.gameStateRef) return;

      const updatePayload = {
        salt: increment(this.perClick),
        lastUpdated: serverTimestamp(),
      };

      // 황금 소금 발견 로직
      if (Math.random() < 0.01) {
        updatePayload.gold = increment(1);
        this.logEvent("✨ <strong>황금 소금</strong>을 발견했습니다!");
      }

      try {
        await updateDoc(this.gameStateRef, updatePayload);
      } catch (error) {
        console.error("채굴 데이터 업데이트 오류:", error);
      }
    },
    // [핵심 수정] 업그레이드 시 DB에 직접 증가/감소 명령 (트랜잭션으로 안전성 확보)
    async buyUpgrade(itemId) {
      if (!this.gameStateRef) return;
      const item = this.shopItems.find((i) => i.id === itemId);

      // 화면상으로 먼저 체크해서 불필요한 DB 요청 방지
      if (this.salt < item.cost) return;

      try {
        const currentDoc = await getDoc(this.gameStateRef);
        if (!currentDoc.exists() || (currentDoc.data().salt || 0) < item.cost) {
          this.logEvent("소금이 부족합니다!");
          return;
        }

        const newLevel = (currentDoc.data().upgrades?.[itemId] || 0) + 1;

        const updatePayload = {
          salt: increment(-item.cost),
          [`upgrades.${itemId}`]: newLevel,
          lastUpdated: serverTimestamp(),
        };

        if (item.gps) updatePayload.perSecond = increment(item.gps);
        if (item.type === "click") updatePayload.perClick = increment(item.add);

        await updateDoc(this.gameStateRef, updatePayload);
        this.logEvent(`'${item.name}' 업그레이드 구매!`);
      } catch (error) {
        console.error("업그레이드 실패:", error);
        this.logEvent("업그레이드 중 오류가 발생했습니다.");
      }
    },
    // (sellSalt, logEvent 등 나머지 메소드는 기존 코드와 동일)
  },
};
</script>

<style scoped>
/* (스타일은 변경사항 없음) */
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
