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
      // [핵심 수정] 당첨 항목을 16개로 늘립니다.
      prizes: [
        { name: "100 SaltMate", points: 100 },  // 1
        { name: "꽝", points: 0 },             // 2
        { name: "30 SaltMate", points: 30 },   // 3
        { name: "50 SaltMate", points: 50 },   // 4
        { name: "300 SaltMate", points: 300 },  // 5
        { name: "꽝", points: 0 },             // 6
        { name: "10 SaltMate", points: 10 },   // 7
        { name: "1000 SaltMate", points: 1000 },// 8 (잭팟)
        { name: "20 SaltMate", points: 20 },   // 9
        { name: "꽝", points: 0 },             // 10
        { name: "80 SaltMate", points: 80 },   // 11
        { name: "50 SaltMate", points: 50 },   // 12
        { name: "500 SaltMate", points: 500 },  // 13
        { name: "꽝", points: 0 },             // 14
        { name: "10 SaltMate", points: 10 },   // 15
        { name: "200 SaltMate", points: 200 }   // 16
      ],
      rotationAngle: 0,
      spinSound: new Audio(spinSoundFile),
    };
  },
  methods: {

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
        // [핵심 수정] 변수 이름을 영문으로 변경
        const ggangIndex = this.prizes.findIndex(p => p.points === 0);
        possibleIndexes.push(ggangIndex > -1 ? ggangIndex : 0);
    }
    
    const prizeIndex = possibleIndexes[Math.floor(Math.random() * possibleIndexes.length)];
    this.animateSpin(prizeIndex, winningPrize);

  } catch (error) {
    console.error("룰렛 오류:", error);
    this.resultMessage = `오류: ${error.message}`;
    if (error.message.includes("already-exists")) {
      this.canPlay = false;
    }
    this.isSpinning = false;
  }
},
    animateSpin(prizeIndex, prizeData) {
      const numPrizes = this.prizes.length;
      const arc = 360 / numPrizes; // 16칸 기준, 한 칸의 각도는 22.5도
      const stopAngle = (prizeIndex * arc);

      // 최소 5바퀴 + 최종 위치까지 회전
      // 포인터가 오른쪽에 있으므로, 해당 칸이 오른쪽으로 오도록 각도를 계산합니다.
      const totalRotation = 360 * 5 + (270 - stopAngle);
      
      this.spinSound.currentTime = 0;
      this.spinSound.play().catch(() => console.log("사운드 재생 실패")); // 'e'를 삭제

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
/* [핵심 수정] 전체적인 디자인 및 배경 추가 */
.game-zone-page {
  background-image: url('https://www.transparenttextures.com/patterns/debut-light.png'),
    linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  background-attachment: fixed;
}
.page-container {
  max-width: 800px;
  margin: 70px auto 20px;
  padding: 20px;
}
.page-header {
  text-align: center;
  margin-bottom: 30px;
  color: white;
}
.page-header h1 {
  font-size: 2.8em;
  text-shadow: 0 2px 4px rgba(0,0,0,0.3);
}
.page-header p {
  font-size: 1.2em;
}

.content-wrapper {
  text-align: center;
  padding: 40px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.roulette-container {
  position: relative;
  width: 500px;
  height: 500px;
  margin: 0 auto 30px;
}

/* [핵심 수정] 룰렛 이미지 스타일 */
.roulette-wheel {
  width: 100%;
  height: 100%;
}
.roulette-wheel img {
  width: 100%;
  height: 100%;
  animation: pulse-slow 4s infinite alternate; /* 천천히 두근거리는 효과 */
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
  z-index: 10;
  filter: drop-shadow(0 0 5px rgba(0,0,0,0.5));
}
.spin-button {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
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
}14,018,000.00
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
  background-color: rgba(0,0,0,0.2);
  color: white;
}
</style>