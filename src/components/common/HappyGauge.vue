<template>
  <div class="gauge-wrapper">
    <h4 class="gauge-title">✨ 행복한 솔트메이트(SaltMate) 게이지 ✨</h4>
    <div class="gauge-background">
      <div class="gauge-fill"></div>
    </div>
    <div class="points-display">{{ formatNumber(currentPoints) }} SaltMate</div>
  </div>
</template>

<script setup>
import { defineProps } from "vue";

defineProps({
  currentPoints: {
    type: Number,
    required: true,
    default: 0,
  },
});

const formatNumber = (value) =>
  new Intl.NumberFormat("ko-KR").format(value || 0);
</script>

<style scoped>
.gauge-wrapper {
  background: #ffffff;
  padding: 20px;
  border-radius: 15px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
  text-align: center;
}
.gauge-title {
  font-size: 1.5em;
  color: #2c3e50;
  margin-bottom: 20px;
  font-weight: 600;
}
.gauge-background {
  height: 25px;
  background-color: #e9ecef;
  border-radius: 25px;
  overflow: hidden;
}
.gauge-fill {
  height: 100%;
  width: 100%; /* 한도 없이 항상 가득 찬 느낌을 줌 */
  background: linear-gradient(-45deg, #66a6ff, #89f7fe, #66a6ff, #89f7fe);
  background-size: 400% 400%;
  animation: gradient-animation 10s ease infinite;
  border-radius: 25px;
}
@keyframes gradient-animation {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}
.points-display {
  margin-top: 15px;
  font-size: 1.8em;
  font-weight: bold;
  color: #0056b3;
}
</style>
