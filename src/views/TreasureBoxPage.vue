<template>
  <div class="page-container">
    <header class="page-header">
      <h1><i class="fas fa-gem"></i> 보물상자 열기</h1>
      <p class="description">
        매일 한 번, 행운의 상자를 열어 SaltMate 포인트를 획득하세요!
      </p>
    </header>

    <main class="content-wrapper card">
      <div v-if="!resultMessage" class="selection-phase">
        <h2>세 개의 상자 중 하나를 선택하세요!</h2>
        <div class="box-grid">
          <div
            v-for="(box, index) in boxes"
            :key="index"
            class="box-container"
            @click="openBox(index)"
            :class="{ 
              'disabled': isOpening || hasPlayed,
              'selected': selectedIndex === index,
              'unselected': selectedIndex !== null && selectedIndex !== index
            }"
          >
            <div class="treasure-box">
              <div class="box-lid"></div>
              <div class="box-body"></div>
              <div class="lock"></div>
            </div>
          </div>
        </div>
        <p v-if="hasPlayed" class="play-limit-message">
          오늘은 이미 참여했습니다. 내일 다시 도전해주세요!
        </p>
      </div>

      <div v-if="resultMessage" class="result-phase">
        <div class="result-box" :class="{ open: showResult }">
          <div class="treasure-box open">
            <div class="box-lid"></div>
            <div class="box-body"></div>
            <div class="lock"></div>
            <div class="sparkle-container">
              <div v-for="i in 15" :key="i" class="sparkle"></div>
            </div>
          </div>
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
      selectedIndex: null,
    };
  },
  methods: {
    async openBox(selectedIndex) {
      if (this.isOpening || this.hasPlayed) return;
      this.isOpening = true;
      this.selectedIndex = selectedIndex;

      try {
        const functions = getFunctions(undefined, "asia-northeast3");
        const openTreasureBox = httpsCallable(functions, "openTreasureBox");
        const result = await openTreasureBox();

        const winningPrize = result.data.prize;

        // 선택 애니메이션 후 1.5초 뒤에 결과 표시
        setTimeout(() => {
          this.showResult = true;
          this.prizeHtml = `${winningPrize.points.toLocaleString()} <small>SaltMate</small>`;
          if (winningPrize.points > 0) {
            this.resultMessage = `🎉 <strong>${winningPrize.name}</strong>을 획득했습니다! 🎉`;
          } else {
            this.resultMessage = `아쉽지만 꽝입니다. 내일 다시 도전해주세요!`;
          }
        }, 1500);

      } catch (error) {
        console.error("보물상자 오류:", error);
        this.resultMessage = `오류: ${error.message}`;
        if (error.code && error.code.includes("already-exists")) {
          this.hasPlayed = true;
        }
        // 오류 발생 시 선택 애니메이션 초기화
        setTimeout(() => {
          this.isOpening = false;
          this.selectedIndex = null;
        }, 1000);
      }
    },
  },
};
</script>

<style scoped>
/* 전체적인 스타일은 유지하고, 상자 디자인과 애니메이션을 대폭 강화합니다. */
.page-container { max-width: 800px; margin: 70px auto 20px; padding: 20px; }
.page-header { text-align: center; margin-bottom: 30px; }
.page-header h1 { font-size: 2.8em; }
.page-header h1 i { color: #f1c40f; }
.page-header p { font-size: 1.1em; color: #666; }
.content-wrapper { text-align: center; padding: 40px; border-radius: 15px; background: #fff; box-shadow: 0 8px 25px rgba(0, 0, 0, 0.08); }
.selection-phase h2 { font-size: 1.8em; margin-bottom: 40px; }
.box-grid { display: flex; justify-content: center; gap: 40px; perspective: 1000px; }
.play-limit-message { margin-top: 30px; font-weight: bold; color: #c0392b; }

/* 신규 보물상자 디자인 */
.treasure-box {
  position: relative;
  width: 150px;
  height: 120px;
  cursor: pointer;
  transform-style: preserve-3d;
  transition: transform 0.5s ease;
}
.box-container:hover .treasure-box {
  transform: translateY(-10px) rotateY(10deg);
}
.box-body, .box-lid {
  position: absolute;
  width: 100%;
  background-color: #8B4513; /* 나무 색상 */
  border: 4px solid #D4AF37; /* 금속 테두리 */
  box-sizing: border-box;
}
.box-body {
  height: 80px;
  bottom: 0;
}
.box-lid {
  height: 40px;
  top: 0;
  border-radius: 5px 5px 0 0;
  transform-origin: bottom;
  transition: transform 0.5s ease-in-out;
}
.lock {
  position: absolute;
  top: 30px;
  left: 50%;
  transform: translateX(-50%);
  width: 20px;
  height: 15px;
  background-color: #FFD700;
  border-radius: 3px;
}
.box-container.disabled .treasure-box {
  cursor: not-allowed;
  filter: grayscale(80%);
}
.box-container.disabled:hover .treasure-box {
  transform: none;
}

/* 선택 애니메이션 */
.box-container.selected .treasure-box {
  animation: selectedBox 1.5s forwards ease-in-out;
}
.box-container.unselected .treasure-box {
  animation: unselectedBox 1.5s forwards ease-in-out;
}
@keyframes selectedBox {
  50% { transform: translateY(-20px) scale(1.2); }
  100% { transform: scale(1.1); }
}
@keyframes unselectedBox {
  100% { opacity: 0; transform: scale(0.8); }
}

/* 결과 화면 스타일 */
.result-phase { animation: fadeIn 0.5s ease; }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
.result-box { position: relative; display: inline-block; }
.result-box .treasure-box.open .box-lid {
  transform: rotateX(-120deg);
}
.result-message { margin-top: 20px; font-size: 1.2em; font-weight: bold; }
.back-button { /* ... 이전과 동일 ... */ }

/* 상자 열릴 때 빛 효과 */
.sparkle-container {
  position: absolute;
  top: 0;
  left: 50%;
  width: 200px;
  height: 200px;
  transform: translateX(-50%);
  opacity: 0;
  transition: opacity 0.5s 0.3s;
}
.result-box.open .sparkle-container {
  opacity: 1;
}
.sparkle {
  position: absolute;
  width: 4px;
  height: 4px;
  background: #fff;
  border-radius: 50%;
  box-shadow: 0 0 10px #fff, 0 0 20px #f1c40f, 0 0 30px #e67e22;
  animation: sparkle-fly 1.5s forwards;
  opacity: 0;
}
@keyframes sparkle-fly {
  0% { transform: translate(0, 0) scale(0); opacity: 1; }
  100% { transform: translate(var(--x), var(--y)) scale(1); opacity: 0; }
}
.sparkle:nth-child(1) { --x: -80px; --y: -150px; animation-delay: 0.3s; }
.sparkle:nth-child(2) { --x: 100px; --y: -120px; animation-delay: 0.4s; }
.sparkle:nth-child(3) { --x: -120px; --y: -80px; animation-delay: 0.5s; }
/* (나머지 sparkle 들도 유사하게 지연 시간과 위치를 다르게 설정) */
.sparkle:nth-child(4) { --x: 150px; --y: -50px; animation-delay: 0.35s; }
.sparkle:nth-child(5) { --x: -90px; --y: -90px; animation-delay: 0.55s; }
.sparkle:nth-child(6) { --x: 90px; --y: -180px; animation-delay: 0.6s; }
.sparkle:nth-child(7) { --x: 130px; --y: -130px; animation-delay: 0.65s; }
.sparkle:nth-child(8) { --x: -110px; --y: -160px; animation-delay: 0.7s; }

/* 보상 표시 스타일 */
.prize-display {
  position: absolute;
  top: 30%;
  left: 50%;
  transform: translate(-50%, -50%) scale(0);
  font-size: 2.5em;
  font-weight: bold;
  color: #fff;
  text-shadow: 0 0 10px #f1c40f, 0 0 20px #f1c40f;
  opacity: 0;
  animation: prize-appear 1s forwards 0.8s;
}
@keyframes prize-appear {
  0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
  100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
}
</style>