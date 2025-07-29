<template>
  <div class="gauge-container">
    <h4>
      <i class="fas fa-smile-beam"></i> 행복한 솔트메이트(SaltMate) 게이지
    </h4>
    <div class="gauge-bar-background">
      <div class="gauge-bar-fill" :style="{ width: gaugePercentage + '%' }">
        <span
          class="saltmate-icon"
          :style="{ left: `calc(${gaugePercentage}% - 15px)` }"
          >💧</span
        >
      </div>
    </div>
    <div class="gauge-text">
      {{ formatNumber(currentPoints) }} / {{ formatNumber(maxPoints) }} SaltMate
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  currentPoints: {
    type: Number,
    required: true,
    default: 0,
  },
  maxPoints: {
    type: Number,
    default: 10000,
  },
});

const gaugePercentage = computed(() => {
  if (props.maxPoints === 0) return 0;
  const percentage = (props.currentPoints / props.maxPoints) * 100;
  return Math.min(percentage, 100);
});

const formatNumber = (value) =>
  new Intl.NumberFormat("ko-KR").format(value || 0);
</script>

<style scoped>
.gauge-container {
  background: linear-gradient(135deg, #f5f7fa, #c3cfe2);
  padding: 25px;
  border-radius: 15px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  text-align: center;
}
h4 {
  margin-bottom: 20px;
  color: #333;
  font-size: 1.5em;
}
.gauge-bar-background {
  width: 100%;
  height: 30px;
  background-color: #e9ecef;
  border-radius: 15px;
  overflow: hidden;
}
.gauge-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #89f7fe 0%, #66a6ff 100%);
  border-radius: 15px;
  transition: width 1s ease-in-out;
  position: relative;
}
.saltmate-icon {
  font-size: 24px;
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  transition: left 1s ease-in-out;
}
.gauge-text {
  margin-top: 15px;
  font-size: 1.2em;
  font-weight: bold;
  color: #0056b3;
}
</style>
