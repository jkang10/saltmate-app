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
          <div class="mine-visual">⛏️</div>
          <p>소금을 채굴하려면 아래 버튼을 클릭하세요!</p>
          <button @click="mineSalt" class="mine-button">채굴하기</button>
        </div>
      </div>

      <aside class="game-sidebar">
        <div class="shop-card card">
          <h3>업그레이드 상점</h3>
          <div class="shop-items">
            <div v-for="item in shopItems" :key="item.id" class="shop-item">
              <div class="item-info">
                <strong>{{ item.name }}</strong>
                <small>{{ item.desc }}</small>
              </div>
              <button @click="buyUpgrade(item.id)" :disabled="salt < item.cost">
                구매 ({{ item.cost.toLocaleString() }} 소금)
              </button>
            </div>
          </div>
        </div>
        <div class="sell-card card">
          <h3>소금 판매소</h3>
          <p>현재 시세: <strong>10 소금 = 1 SaltMate</strong></p>
          <button @click="sellSalt" :disabled="isSelling || salt < 10">
            <span v-if="isSelling">판매 중...</span>
            <span v-else>모두 판매하기</span>
          </button>
        </div>
      </aside>
    </main>
  </div>
</template>

<script>
import { getFunctions, httpsCallable } from "firebase/functions";

export default {
  name: "SaltMineGamePage",
  data() {
    return {
      salt: 0,
      perClick: 1,
      perSecond: 0,
      upgrades: {},
      isSelling: false,
      gameInterval: null,
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
        },
        {
          id: "drill",
          name: "전동 드릴",
          baseCost: 300,
          gps: 5,
          desc: "초당 +5 소금",
        },
        {
          id: "robot",
          name: "채굴 로봇",
          baseCost: 2000,
          gps: 25,
          desc: "초당 +25 소금",
        },
        {
          id: "pick_upgrade",
          name: "곡괭이 강화",
          baseCost: 120,
          type: "click",
          add: 1,
          desc: "클릭당 +1 소금",
        },
      ];
      return SHOP_DEFS.map((item) => ({
        ...item,
        cost: Math.ceil(
          item.baseCost * Math.pow(1.6, this.upgrades[item.id] || 0),
        ),
      }));
    },
  },
  mounted() {
    this.loadGame();
    this.gameInterval = setInterval(this.gameTick, 1000);
  },
  unmounted() {
    clearInterval(this.gameInterval);
    this.saveGame();
  },
  methods: {
    loadGame() {
      const savedData = localStorage.getItem("saltMineGame");
      if (savedData) {
        const state = JSON.parse(savedData);
        this.salt = state.salt || 0;
        this.perClick = state.perClick || 1;
        this.perSecond = state.perSecond || 0;
        this.upgrades = state.upgrades || {};
      }
    },
    saveGame() {
      const state = {
        salt: this.salt,
        perClick: this.perClick,
        perSecond: this.perSecond,
        upgrades: this.upgrades,
      };
      localStorage.setItem("saltMineGame", JSON.stringify(state));
    },
    gameTick() {
      this.salt += this.perSecond;
    },
    mineSalt() {
      this.salt += this.perClick;
    },
    buyUpgrade(itemId) {
      const item = this.shopItems.find((i) => i.id === itemId);
      if (this.salt < item.cost) return;

      this.salt -= item.cost;
      this.upgrades[itemId] = (this.upgrades[itemId] || 0) + 1;

      if (item.gps) {
        this.perSecond += item.gps;
      }
      if (item.type === "click") {
        this.perClick += item.add;
      }
      this.saveGame();
    },
    async sellSalt() {
      if (this.isSelling || this.salt < 10) return;
      this.isSelling = true;

      try {
        const functions = getFunctions();
        const sellSaltForPoints = httpsCallable(functions, "sellSaltForPoints");
        const result = await sellSaltForPoints({
          saltAmount: Math.floor(this.salt),
        });

        const { awardedPoints, soldSalt } = result.data;
        this.salt -= soldSalt; // 서버에서 처리된 만큼만 차감
        this.saveGame();
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
  },
};
</script>

<style scoped>
.page-container {
  max-width: 1100px;
}
.page-header h1 i {
  color: #ffd166;
}
.game-layout {
  display: grid;
  grid-template-columns: 1fr 360px;
  gap: 20px;
}
.game-main {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.top-stats {
  display: flex;
  gap: 15px;
}
.stat {
  background-color: rgba(255, 255, 255, 0.05);
  padding: 15px;
  border-radius: 10px;
  flex-grow: 1;
}
.stat span {
  font-size: 1.5em;
  font-weight: bold;
}
.stat small {
  display: block;
  color: #9aa6b2;
  font-size: 0.9em;
}
.mine-area {
  text-align: center;
  padding: 40px;
}
.mine-visual {
  font-size: 4em;
  margin-bottom: 15px;
}
.mine-button {
  padding: 15px 30px;
  font-size: 1.2em;
  font-weight: bold;
  background-color: #ffd166;
  color: #1e293b;
  border: none;
  border-radius: 10px;
}
.game-sidebar {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.shop-card,
.sell-card {
  padding: 20px;
}
.shop-items {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 300px;
  overflow-y: auto;
}
.shop-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: rgba(0, 0, 0, 0.2);
  padding: 10px;
  border-radius: 8px;
}
.item-info small {
  color: #9aa6b2;
}
.sell-card p {
  font-size: 1.1em;
}
</style>
