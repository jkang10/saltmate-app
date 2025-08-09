<template>
  <div class="page-container">
    <header class="page-header">
      <h1><i class="fas fa-gamepad"></i> 게임 존</h1>
      <p class="description">
        매일매일 행운의 룰렛을 돌려 SaltMate 포인트를 획득하세요!
      </p>
    </header>

    <main class="content-wrapper card">
      <div class="roulette-container">
        <canvas ref="rouletteCanvas" width="500" height="500"></canvas>
        <button
          @click="spin"
          class="spin-button"
          :disabled="isSpinning || !canPlay"
        >
          <span v-if="isSpinning">돌아가는 중...</span>
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

export default {
  name: "GameZonePage",
  data() {
    return {
      isSpinning: false,
      canPlay: true,
      resultMessage: "",
      prizes: [
        // 백엔드의 상품 목록과 순서/내용이 일치해야 합니다.
        { name: "10 SaltMate", points: 10, color: "#FFDDC1" },
        { name: "50 SaltMate", points: 50, color: "#FFABAB" },
        { name: "100 SaltMate", points: 100, color: "#FFC3A0" },
        { name: "500 SaltMate", points: 500, color: "#FF677D" },
        { name: "1,000 SaltMate", points: 1000, color: "#D4A5A5" },
        { name: "꽝", points: 0, color: "#DDDDDD" },
      ],
      ctx: null,
    };
  },
  mounted() {
    this.ctx = this.$refs.rouletteCanvas.getContext("2d");
    this.drawRoulette();
  },
  methods: {
    drawRoulette(rotationAngle = 0) {
      const canvas = this.$refs.rouletteCanvas;
      if (!canvas) return;
      const numPrizes = this.prizes.length;
      const arc = (Math.PI * 2) / numPrizes;

      this.ctx.clearRect(0, 0, canvas.width, canvas.height);
      this.ctx.save();
      this.ctx.translate(canvas.width / 2, canvas.height / 2);
      this.ctx.rotate(rotationAngle);

      for (let i = 0; i < numPrizes; i++) {
        this.ctx.beginPath();
        this.ctx.fillStyle = this.prizes[i].color;
        this.ctx.moveTo(0, 0);
        this.ctx.arc(0, 0, canvas.width / 2 - 10, -arc / 2, arc / 2);
        this.ctx.fill();

        this.ctx.save();
        this.ctx.fillStyle = "#333";
        this.ctx.font = "bold 16px Noto Sans KR";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.rotate(0);
        this.ctx.fillText(this.prizes[i].name, canvas.width / 4, 0);
        this.ctx.restore();

        this.ctx.rotate(arc);
      }
      this.ctx.restore();

      // 룰렛 포인터 (화살표)
      this.ctx.fillStyle = "#C0392B";
      this.ctx.beginPath();
      this.ctx.moveTo(canvas.width - 20, canvas.height / 2 - 15);
      this.ctx.lineTo(canvas.width, canvas.height / 2);
      this.ctx.lineTo(canvas.width - 20, canvas.height / 2 + 15);
      this.ctx.fill();
    },
    async spin() {
      if (this.isSpinning) return;
      this.isSpinning = true;
      this.resultMessage = "";

      try {
        const functions = getFunctions();
        const spinRoulette = httpsCallable(functions, "spinRoulette");
        const result = await spinRoulette();

        const winningPrize = result.data.prize;
        const prizeIndex = this.prizes.findIndex(
          (p) => p.points === winningPrize.points,
        );

        this.animateSpin(prizeIndex, winningPrize);
      } catch (error) {
        console.error("룰렛 오류:", error);
        this.resultMessage = `오류: ${error.message}`;
        if (error.code.includes("already-exists")) {
          this.canPlay = false;
        }
        this.isSpinning = false;
      }
    },
    animateSpin(prizeIndex, prizeData) {
      const numPrizes = this.prizes.length;
      const arc = 360 / numPrizes;
      const stopAngle = prizeIndex * arc + arc / 2;
      const totalRotation = 360 * 5 + (360 - stopAngle); // 5바퀴 + 최종 위치

      let currentRotation = 0;
      const animation = () => {
        const easeOut = 1 - Math.pow(1 - currentRotation / totalRotation, 4);
        const rotationAngle = (easeOut * totalRotation * Math.PI) / 180;
        this.drawRoulette(rotationAngle);

        if (currentRotation < totalRotation) {
          currentRotation += 20; // 스피드 조절
          requestAnimationFrame(animation);
        } else {
          this.isSpinning = false;
          if (prizeData.points > 0) {
            this.resultMessage = `🎉 축하합니다! <strong>${prizeData.name}</strong>에 당첨되셨습니다! 🎉`;
          } else {
            this.resultMessage = `아쉽지만 꽝입니다. 내일 다시 도전해주세요!`;
          }
          this.canPlay = false;
        }
      };
      requestAnimationFrame(animation);
    },
  },
};
</script>

<style scoped>
.page-container {
  max-width: 800px;
}
.content-wrapper {
  text-align: center;
}
.roulette-container {
  position: relative;
  width: 500px;
  height: 500px;
  margin: 0 auto;
}
.spin-button {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100px;
  height: 100px;
  border-radius: 50%;
  background-color: #e74c3c;
  color: white;
  font-weight: bold;
  font-size: 1.2em;
  border: 5px solid white;
  cursor: pointer;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
}
.result-message {
  margin-top: 20px;
  font-size: 1.2em;
  font-weight: bold;
}
</style>
