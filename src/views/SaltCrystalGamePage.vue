<template>
  <div class="page-container">
    <header class="page-header">
      <h1><i class="fas fa-gem"></i> 소금 결정 키우기</h1>
      <p class="description">
        소금 결정을 클릭해서 SaltMate 포인트를 수확하세요!
      </p>
    </header>

    <main class="content-wrapper card">
      <div class="game-info">
        <span v-if="!loadingStatus"
          >오늘 남은 횟수: {{ playsLeft }} / {{ totalPlaysToday }}</span
        >
        <span v-else>플레이 정보 확인 중...</span>
      </div>
      <div class="game-area">
        <div
          class="crystal-container"
          @click="handleClick"
          :class="{ harvestable: isHarvestable }"
        >
          <img
            src="@/assets/crystal.png"
            alt="소금 결정"
            class="crystal-image"
            :style="{ transform: `scale(${crystalScale})` }"
          />
          <div
            v-if="clickEffect.visible"
            class="click-effect"
            :style="{ top: clickEffect.y + 'px', left: clickEffect.x + 'px' }"
          >
            +1
          </div>
        </div>

        <div class="progress-section">
          <p class="click-counter">
            현재 점수: <strong>{{ clicks.toLocaleString() }}</strong> /
            {{ harvestGoal.toLocaleString() }}
          </p>
          <div class="progress-bar">
            <div
              class="progress-bar-fill"
              :style="{ width: progressPercentage + '%' }"
            ></div>
          </div>
        </div>

        <button
          @click="harvest"
          class="harvest-button"
          :disabled="!isHarvestable || isHarvesting || playsLeft === 0"
        >
          <span v-if="isHarvesting">수확 중...</span>
          <span v-else-if="playsLeft === 0">오늘 모두 수확했어요!</span>
          <span v-else
            >수확하기 ({{ awardedPoints.toLocaleString() }}P 획득)</span
          >
        </button>

        <p v-if="successMessage" class="success-message">
          {{ successMessage }}
        </p>
        <p v-if="error" class="error-message">{{ error }}</p>
      </div>
    </main>
  </div>
</template>

<script>
import { auth, db } from "@/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";

export default {
  name: "SaltCrystalGamePage",
  data() {
    return {
      clicks: 0,
      harvestGoal: 1000,
      crystalScale: 1,
      clickEffect: { visible: false, x: 0, y: 0 },
      isHarvesting: false,
      successMessage: "",
      error: "",
      playsLeft: 0,
      totalPlaysToday: 1,
      loadingStatus: true,
    };
  },
  computed: {
    progressPercentage() {
      return Math.min((this.clicks / this.harvestGoal) * 100, 100);
    },
    isHarvestable() {
      return this.clicks >= this.harvestGoal;
    },
    awardedPoints() {
      return Math.floor(this.clicks / 10);
    },
  },
  async mounted() {
    await this.getGameStatus();
    const savedClicks = localStorage.getItem("saltCrystalClicks");
    if (savedClicks) {
      this.clicks = parseInt(savedClicks, 10);
    }
  },
  methods: {
    async getGameStatus() {
      this.loadingStatus = true;
      try {
        const userRef = doc(db, "users", auth.currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          const saltGameData = userData.saltGameData || { date: "", count: 0 };

          const now = new Date();
          const todayStr = now.toISOString().slice(0, 10);
          const dayOfWeek = now.getDay();
          const playLimits = [1, 1, 2, 1, 2, 1, 2];
          this.totalPlaysToday = playLimits[dayOfWeek];

          if (saltGameData.date === todayStr) {
            this.playsLeft = this.totalPlaysToday - saltGameData.count;
          } else {
            this.playsLeft = this.totalPlaysToday;
            this.clicks = 0; // 날짜가 바뀌었으면 클릭 수도 초기화
            localStorage.setItem("saltCrystalClicks", "0");
          }
        }
      } catch (error) {
        console.error("게임 상태 조회 오류:", error);
        this.error = "게임 상태를 불러오지 못했습니다.";
      } finally {
        this.loadingStatus = false;
      }
    },
    handleClick(event) {
      if (this.isHarvestable || this.playsLeft === 0) return;

      this.clicks++;
      localStorage.setItem("saltCrystalClicks", this.clicks);

      this.crystalScale = 1.05;
      setTimeout(() => (this.crystalScale = 1), 100);

      const rect = event.currentTarget.getBoundingClientRect();
      this.clickEffect.x = event.clientX - rect.left;
      this.clickEffect.y = event.clientY - rect.top;
      this.clickEffect.visible = true;
      setTimeout(() => (this.clickEffect.visible = false), 500);
    },
    async harvest() {
      if (!this.isHarvestable || this.isHarvesting || this.playsLeft === 0)
        return;

      this.isHarvesting = true;
      this.error = "";
      this.successMessage = "";

      try {
        const functions = getFunctions();
        const harvestSaltCrystals = httpsCallable(
          functions,
          "harvestSaltCrystals",
        );
        const result = await harvestSaltCrystals({ clicks: this.clicks });

        const awarded = result.data.awardedPoints;
        this.successMessage = `성공! ${awarded.toLocaleString()} SaltMate 포인트를 수확했습니다!`;

        this.clicks = 0; // 점수 초기화
        localStorage.setItem("saltCrystalClicks", "0");
        await this.getGameStatus(); // 수확 후 게임 상태 즉시 갱신

        setTimeout(() => (this.successMessage = ""), 3000); // 3초 후 성공 메시지 숨기기
      } catch (err) {
        console.error("수확 오류:", err);
        this.error = `수확 실패: ${err.message}`;
        if (err.code?.includes("resource-exhausted")) {
          await this.getGameStatus(); // 이미 모두 플레이한 경우 상태 갱신
        }
      } finally {
        this.isHarvesting = false;
      }
    },
  },
};
</script>

<style scoped>
.page-container {
  max-width: 800px;
}
.page-header h1 i {
  color: #3498db;
}
.content-wrapper {
  padding: 30px;
  position: relative;
}
.game-info {
  position: absolute;
  top: 15px;
  right: 20px;
  background-color: #e9ecef;
  padding: 8px 12px;
  border-radius: 20px;
  font-weight: bold;
  font-size: 0.9em;
  color: #495057;
}
.game-area {
  text-align: center;
}
.crystal-container {
  position: relative;
  width: 200px;
  height: 200px;
  margin: 20px auto;
  cursor: pointer;
  user-select: none;
}
.crystal-container.harvestable {
  animation: glowing 1.5s infinite;
}
.crystal-image {
  width: 100%;
  transition: transform 0.1s ease;
}
.click-effect {
  position: absolute;
  font-size: 1.5em;
  font-weight: bold;
  color: #f39c12;
  animation: floatUp 0.5s ease-out forwards;
  pointer-events: none;
}
@keyframes floatUp {
  from {
    transform: translateY(0);
    opacity: 1;
  }
  to {
    transform: translateY(-50px);
    opacity: 0;
  }
}
.progress-section {
  margin: 30px 0;
}
.click-counter {
  font-size: 1.2em;
}
.progress-bar {
  width: 100%;
  background-color: #e9ecef;
  border-radius: 10px;
  height: 20px;
}
.progress-bar-fill {
  height: 100%;
  background-color: #3498db;
  border-radius: 10px;
  transition: width 0.2s;
}
.harvest-button {
  padding: 15px 30px;
  font-size: 1.2em;
  font-weight: bold;
  color: white;
  background-color: #27ae60;
  border: none;
  border-radius: 10px;
  cursor: pointer;
}
.harvest-button:disabled {
  background-color: #bdc3c7;
  cursor: not-allowed;
}
.success-message,
.error-message {
  margin-top: 15px;
  font-weight: bold;
}
.success-message {
  color: #27ae60;
}
.error-message {
  color: #c0392b;
}
@keyframes glowing {
  0% {
    filter: drop-shadow(0 0 5px #3498db);
  }
  50% {
    filter: drop-shadow(0 0 20px #3498db);
  }
  100% {
    filter: drop-shadow(0 0 5px #3498db);
  }
}
</style>
