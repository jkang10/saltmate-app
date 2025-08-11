<template>
  <div class="page-container">
    <header class="page-header">
      <h1><i class="fas fa-gem"></i> 소금 결정 키우기</h1>
      <p class="description">
        소금 결정을 클릭해서 SaltMate 포인트를 수확하세요!
      </p>
    </header>

    <main class="content-wrapper card">
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
          :disabled="!isHarvestable || isHarvesting"
        >
          <span v-if="isHarvesting">수확 중...</span>
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
import { getFunctions, httpsCallable } from "firebase/functions";

export default {
  name: "SaltCrystalGamePage",
  data() {
    return {
      clicks: 0,
      harvestGoal: 1000, // 수확 목표 점수
      crystalScale: 1,
      clickEffect: { visible: false, x: 0, y: 0 },
      isHarvesting: false,
      successMessage: "",
      error: "",
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
  mounted() {
    const savedClicks = localStorage.getItem("saltCrystalClicks");
    if (savedClicks) {
      this.clicks = parseInt(savedClicks, 10);
    }
  },
  methods: {
    handleClick(event) {
      if (this.isHarvestable) return;

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
      if (!this.isHarvestable || this.isHarvesting) return;

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
        this.successMessage = `성공적으로 ${awarded.toLocaleString()} SaltMate 포인트를 수확했습니다!`;

        this.clicks = 0; // 점수 초기화
        localStorage.setItem("saltCrystalClicks", this.clicks);
      } catch (err) {
        console.error("수확 오류:", err);
        this.error = `수확에 실패했습니다: ${err.message}`;
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
