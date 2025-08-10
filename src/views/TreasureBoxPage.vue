<template>
  <div class="page-container">
    <header class="page-header">
      <!-- 원래: fas fa-treasure-chest → 무료 대체: fas fa-gem -->
      <h1><i class="fas fa-gem"></i> 보물상자 열기</h1>
      <p class="description">
        매일 한 번, 행운의 상자를 열어 SaltMate 포인트를 획득하세요!
      </p>
    </header>

    <main class="content-wrapper card">
      <div v-if="!resultMessage" class="selection-phase">
        <h2>상자를 선택해주세요!</h2>
        <div class="box-grid">
          <div
            v-for="(box, index) in boxes"
            :key="index"
            class="box-container"
            @click="openBox(index)"
            :class="{ disabled: isOpening || hasPlayed }"
          >
            <!-- 원래: fas fa-box-full → 무료 대체: fas fa-box -->
            <i class="fas fa-box box-icon"></i>
          </div>
        </div>
        <p v-if="hasPlayed" class="play-limit-message">
          오늘은 이미 참여했습니다. 내일 다시 도전해주세요!
        </p>
      </div>

      <div v-if="resultMessage" class="result-phase">
        <div class="result-box" :class="{ open: showResult }">
          <!-- fa-box-open은 무료 버전에서도 지원 -->
          <i class="fas fa-box-open box-icon-open"></i>
          <p class="result-message">{{ resultMessage }}</p>
        </div>
      </div>
    </main>
  </div>
</template>

<script>
export default {
  name: "TreasureBoxPage",
  data() {
    return {
      boxes: Array(6).fill(null),
      isOpening: false,
      hasPlayed: false,
      resultMessage: "",
      showResult: false,
    };
  },
  methods: {
    openBox(index) {
      if (this.isOpening || this.hasPlayed) return;

      this.isOpening = true;
      setTimeout(() => {
        const prize =
          Math.random() > 0.5
            ? "축하합니다! 100P 획득!"
            : "아쉽습니다! 빈 상자입니다.";
        this.resultMessage = prize;
        this.showResult = true;
        this.hasPlayed = true;
        this.isOpening = false;
      }, 1000);
    },
  },
};
</script>

<style scoped>
.page-container {
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
}
.page-header {
  text-align: center;
  margin-bottom: 30px;
}
.page-header h1 {
  font-size: 2em;
}
.description {
  color: #666;
}
.selection-phase {
  text-align: center;
}
.box-grid {
  display: grid;
  grid-template-columns: repeat(3, 100px);
  gap: 20px;
  justify-content: center;
  margin-top: 20px;
}
.box-container {
  width: 100px;
  height: 100px;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
}
.box-container.disabled {
  opacity: 0.5;
  pointer-events: none;
}
.box-icon,
.box-icon-open {
  font-size: 60px;
  color: #f4a261;
}
.result-phase {
  text-align: center;
}
.result-message {
  margin-top: 10px;
  font-weight: bold;
}
</style>
