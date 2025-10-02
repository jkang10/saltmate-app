<template>
  <div class="page-container game-zone-page">
    <header class="page-header">
      <h1><i class="fas fa-gamepad"></i> 럭키 룰렛</h1>
      <p class="description">
        매일매일 행운의 룰렛을 돌려 SaltMate 포인트를 획득하세요!
      </p>
    </header>

    <main class="content-wrapper card">
      <div class="roulette-container">
        <div class="roulette-wheel" :style="{ transform: `rotate(${rotationAngle}deg)` }">
          <img src="@/assets/game_assets/roulette_wheel_16.png" alt="Roulette Wheel" />
        </div>
        <div class="roulette-pointer"></div>
        <button
          @click="spin"
          class="spin-button"
          :disabled="isSpinning || !canPlay"
        >
          <span v-if="isSpinning">SPIN!</span>
          <span v-else-if="!canPlay">내일 다시!</span>
          <span v-else>룰렛 돌리기!</span>
        </button>
      </div>
      <div
        v-if="resultMessage"
        class="result-message"
        v-html="resultMessage"
      ></div>
    </main>
  </div>
</template>

<script>
import { getFunctions, httpsCallable } from "firebase/functions";
import spinSoundFile from '@/assets/sounds/rulnet_so.mp3';

export default {
  name: "GameZonePage",
  data() {
    return {
      isSpinning: false,
      canPlay: true,
      resultMessage: "",
      prizes: [
        { name: "100 SaltMate", points: 100 },
        { name: "꽝", points: 0 },
        { name: "30 SaltMate", points: 30 },
        { name: "50 SaltMate", points: 50 },
        { name: "300 SaltMate", points: 300 },
        { name: "꽝", points: 0 },
        { name: "10 SaltMate", points: 10 },
        { name: "1000 SaltMate", points: 1000 },
        { name: "20 SaltMate", points: 20 },
        { name: "꽝", points: 0 },
        { name: "80 SaltMate", points: 80 },
        { name: "50 SaltMate", points: 50 },
        { name: "500 SaltMate", points: 500 },
        { name: "꽝", points: 0 },
        { name: "10 SaltMate", points: 10 },
        { name: "200 SaltMate", points: 200 }
      ],
      rotationAngle: 0,
      spinSound: new Audio(spinSoundFile),
    };
  },
  methods: {
    // [핵심 수정] spin 함수를 methods 객체 안으로 올바르게 이동시켰습니다.
    async spin() {
      if (this.isSpinning) return;
      this.isSpinning = true;
      this.resultMessage = "";

      try {
        const functions = getFunctions(undefined, "asia-northeast3");
        const spinRoulette = httpsCallable(functions, "spinRoulette");
        const result = await spinRoulette();

        const winningPrize = result.data?.prize;
        if (!winningPrize) {
            throw new Error("서버로부터 결과를 받지 못했습니다.");
        }
        
        const possibleIndexes = [];
        this.prizes.forEach((p, index) => {
          if (p.points === (winningPrize.points || 0)) {
            possibleIndexes.push(index);
          }
        });
        
        if (possibleIndexes.length === 0) {
            const ggangIndex = this.prizes.findIndex(p => p.points === 0);
            possibleIndexes.push(ggangIndex > -1 ? ggangIndex : 0);
        }
        
        const prizeIndex = possibleIndexes[Math.floor(Math.random() * possibleIndexes.length)];
        this.animateSpin(prizeIndex, winningPrize);

      } catch (error) {
        console.error("룰렛 오류:", error);
        this.resultMessage = `오류: ${error.message}`;
        if (error.message && error.message.includes("already-exists")) {
          this.canPlay = false;
        }
        this.isSpinning = false;
      }
    },
    animateSpin(prizeIndex, prizeData) {
      const numPrizes = this.prizes.length;
      const arc = 360 / numPrizes;
      const stopAngle = (prizeIndex * arc);

      const totalRotation = 360 * 5 + (270 - stopAngle);
      
      this.spinSound.currentTime = 0;
      this.spinSound.play().catch(() => console.log("사운드 재생 실패"));

      const rouletteWheel = this.$el.querySelector('.roulette-wheel');
      rouletteWheel.style.transition = 'transform 4s cubic-bezier(0.25, 0.1, 0.25, 1)';
      this.rotationAngle += totalRotation;

      setTimeout(() => {
        this.isSpinning = false;
        if (prizeData.points > 0) {
          this.resultMessage = `🎉 축하합니다! <strong>${prizeData.name}</strong>에 당첨되셨습니다! 🎉`;
        } else {
          this.resultMessage = `아쉽지만 꽝입니다. 내일 다시 도전해주세요!`;
        }
        this.canPlay = false;
        this.spinSound.pause();

        const finalAngle = this.rotationAngle % 360;
        rouletteWheel.style.transition = 'none';
        this.rotationAngle = finalAngle;
        
      }, 4000);
    },
  },
};
</script>

<style scoped>
.game-zone-page {
  /* [수정] 보라색 배경 제거 */
  background-color: #f8f9fa; /* 다른 페이지와 동일한 밝은 회색 배경 */
}
.page-container {
  max-width: 800px;
  margin: 90px auto 20px;
  padding: 20px;
}
.page-header {
  text-align: center;
  margin-bottom: 30px;
  color: #333;
  /* [핵심 추가] 헤더가 다른 요소 위에 오도록 z-index 설정 */
  position: relative;
  z-index: 5;
}
.page-header h1 {
  font-size: 2.8em;
  text-shadow: none; /* 그림자 제거 */
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 15px;
}
/* [수정] 아이콘 색상을 붉은색으로 변경 */
.page-header h1 i {
    color: #e74c3c;
}
.page-header p {
  font-size: 1.2em;
  color: #666; /* 글씨 색상 변경 */
}

.content-wrapper {
  text-align: center;
  padding: 40px;
  /* [수정] 흰색 배경 카드 스타일 적용 */
  background: #fff;
  border-radius: 15px;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.08);
}

.roulette-container {
  position: relative;
  width: 100%;
  max-width: 500px; /* 최대 너비 설정 */
  aspect-ratio: 1 / 1; /* 항상 정사각형 비율 유지 */
  margin: 0 auto 30px;
}
.roulette-wheel {
  width: 100%;
  height: 100%;
  /* [핵심 추가] 이미지가 다른 요소들 뒤에 있도록 z-index 설정 */
  position: relative;
  z-index: 1;
}
.roulette-wheel img {
  width: 100%;
  height: 100%;
  animation: pulse-slow 4s infinite alternate;
}
@keyframes pulse-slow {
  from { transform: scale(1); }
  to { transform: scale(1.02); }
}
.roulette-pointer {
  position: absolute;
  top: 50%;
  right: -20px;
  transform: translateY(-50%);
  width: 0;
  height: 0;
  border-top: 30px solid transparent;
  border-bottom: 30px solid transparent;
  border-left: 45px solid #e74c3c;
  /* [수정] z-index 값을 높여 이미지보다 위에 오도록 보장 */
  z-index: 3;
  filter: drop-shadow(0 0 5px rgba(0,0,0,0.5));
}
.spin-button {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  /* [핵심 추가] z-index를 추가하여 버튼이 이미지 위에 오도록 설정 */
  z-index: 2;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: linear-gradient(145deg, #f1c40f, #e67e22);
  color: white;
  font-weight: bold;
  font-size: 1.5em;
  border: 5px solid white;
  cursor: pointer;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
  transition: all 0.2s ease;
}
.spin-button:hover:not(:disabled) {
  transform: translate(-50%, -50%) scale(1.05);
}
.spin-button:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
}
.result-message {
  margin-top: 20px;
  font-size: 1.5em;
  font-weight: bold;
  padding: 15px;
  border-radius: 10px;
  background-color: #f8f9fa;
  color: #333;
  /* [핵심 추가] 결과 메시지가 다른 요소 위에 오도록 z-index 설정 */
  position: relative;
  z-index: 5;
}
/* 모바일 화면 대응 */
@media (max-width: 600px) {
  .roulette-container {
    width: 90vw;
    height: 90vw;
  }
  .spin-button {
    width: 90px;
    height: 90px;
    font-size: 1.2em;
  }
  .roulette-pointer {
    right: -15px;
    border-top-width: 20px;
    border-bottom-width: 20px;
    border-left-width: 30px;
  }
}
</style>