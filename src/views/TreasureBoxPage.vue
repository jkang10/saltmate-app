<template>
  <div class="page-container">
    <header class="page-header">
      <h1><i class="fas fa-treasure-chest"></i> 보물상자 열기</h1>
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
            @click="openBox"
            :class="{ disabled: hasPlayed }"
          >
            <i class="fas fa-box-full box-icon"></i>
          </div>
        </div>
        <p v-if="hasPlayed" class="play-limit-message">
          오늘은 이미 참여했습니다. 내일 다시 도전해주세요!
        </p>
      </div>

      <div v-if="resultMessage" class="result-phase">
        <div class="result-box" :class="{ open: showResult }">
          <i class="fas fa-box-open box-icon-open"></i>
          <div class="prize-display" v-html="prizeHtml"></div>
        </div>
        <p class="result-message" v-html="resultMessage"></p>
        <router-link to="/dashboard" class="back-button">
          <i class="fas fa-arrow-left"></i> 대시보드로 돌아가기
        </router-link>
      </div>
    </main>
  </div>
</template>

<script>
import { getFunctions, httpsCallable } from "firebase/functions";

export default {
  name: "TreasureBoxPage",
  data() {
    return {
      boxes: [{}, {}, {}],
      isOpening: false,
      hasPlayed: false,
      resultMessage: "",
      prizeHtml: "",
      showResult: false,
    };
  },
  methods: {
    // ▼▼▼ [수정됨] 사용하지 않는 'index' 매개변수 제거 ▼▼▼
    async openBox() {
      if (this.isOpening || this.hasPlayed) return;
      this.isOpening = true;

      try {
        const functions = getFunctions();
        const openTreasureBox = httpsCallable(functions, "openTreasureBox");
        const result = await openTreasureBox();

        const winningPrize = result.data.prize;

        setTimeout(() => {
          this.showResult = true;
          this.prizeHtml = `${winningPrize.points.toLocaleString()} <small>P</small>`;
          if (winningPrize.points > 0) {
            this.resultMessage = `🎉 <strong>${winningPrize.name}</strong>을 획득했습니다! 🎉`;
          } else {
            this.resultMessage = `아쉽지만 꽝입니다. 내일 다시 도전해주세요!`;
          }
        }, 1000);
      } catch (error) {
        console.error("보물상자 오류:", error);
        this.resultMessage = `오류: ${error.message}`;
        if (error.code && error.code.includes("already-exists")) {
          this.hasPlayed = true;
        }
      } finally {
        this.isOpening = false;
        this.hasPlayed = true;
      }
    },
    // ▲▲▲ 수정 완료 ▲▲▲
  },
};
</script>

<style scoped>
.page-container {
  max-width: 800px;
  margin: 70px auto 20px;
  padding: 20px;
}
.page-header {
  text-align: center;
  margin-bottom: 30px;
}
.page-header h1 {
  font-size: 2.8em;
}
.page-header h1 i {
  color: #e67e22;
}
.page-header p {
  font-size: 1.1em;
  color: #666;
}
.content-wrapper {
  text-align: center;
  padding: 30px;
  border-radius: 15px;
}
.card {
  background: #fff;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.08);
}
.selection-phase h2 {
  font-size: 1.8em;
  margin-bottom: 30px;
}
.box-grid {
  display: flex;
  justify-content: center;
  gap: 30px;
}
.box-container {
  cursor: pointer;
  transition: transform 0.3s ease;
}
.box-container:hover {
  transform: translateY(-10px) scale(1.1);
}
.box-container.disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
.box-container.disabled:hover {
  transform: none;
}
.box-icon {
  font-size: 100px;
  color: #d35400;
}
.play-limit-message {
  margin-top: 30px;
  font-weight: bold;
  color: #c0392b;
}
.result-phase {
  animation: fadeIn 0.5s ease;
}
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
.result-box {
  position: relative;
}
.box-icon-open {
  font-size: 150px;
  color: #f39c12;
}
.prize-display {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) scale(0);
  font-size: 2.5em;
  font-weight: bold;
  color: #fff;
  text-shadow: 0 2px 5px rgba(0, 0, 0, 0.5);
  opacity: 0;
  transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
.result-box.open .prize-display {
  transform: translate(-50%, -50%) scale(1);
  opacity: 1;
}
.result-message {
  margin-top: 20px;
  font-size: 1.2em;
  font-weight: bold;
}
.back-button {
  background: #007bff;
  color: white;
  padding: 12px 25px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1em;
  font-weight: bold;
  text-decoration: none;
  transition: all 0.3s ease;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin-top: 40px;
  box-shadow: 0 4px 15px rgba(0, 123, 255, 0.2);
}
.back-button:hover {
  background-color: #0056b3;
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 123, 255, 0.3);
}
</style>
