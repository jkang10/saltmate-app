<template>
  <div class="tutorial-overlay" v-if="isActive && currentStep">
    <div v-if="currentStep.target !== 'body'" class="tutorial-highlight" :style="highlightStyle"></div>
    <div class="tutorial-textbox" :style="textboxStyle">
      <h4>{{ currentStep.title }} ({{ stepIndex + 1 }}/{{ steps.length }})</h4>
      <p>{{ currentStep.content }}</p>
      <div class="tutorial-actions">
        <button @click="endTutorial">건너뛰기</button>
        <button @click="nextStep" class="primary">{{ isLastStep ? '완료' : '다음' }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';

const props = defineProps({
  run: { type: Boolean, default: false }
});
const emit = defineEmits(['complete']);

const isActive = ref(false);
const stepIndex = ref(0);

// 튜토리얼 단계별 내용 정의
const steps = ref([
  {
    title: "환영합니다!",
    content: "솔트메이트에 오신 것을 환영합니다! 간단한 안내를 통해 주요 기능을 소개해 드릴게요.",
    target: "body"
  },
  {
    title: "내 정보 확인",
    content: "이곳에서 현재 보유한 SaltMate 포인트와 등급을 확인할 수 있습니다. 모든 게임과 활동은 SaltMate 포인트를 사용해요.",
    target: ".user-info-widget" // 대시보드의 사용자 정보 위젯 클래스
  },
  {
    title: "실시간 당첨 피드",
    content: "다른 회원들이 게임에서 당첨되는 현황을 실시간으로 볼 수 있습니다.",
    target: ".live-feed-widget" // 대시보드의 당첨 피드 위젯 클래스
  },
  {
    title: "게임 존",
    content: "다양한 미니게임을 즐기고 싶다면, '게임 존' 메뉴로 이동하여 원하는 게임에 참여해보세요!",
    target: "a[href='/game-zone']" // 게임 존으로 가는 링크
  },
  {
    title: "튜토리얼 완료",
    content: "이제 솔트메이트를 자유롭게 탐험해보세요! 궁금한 점은 '도움말' 메뉴에서 언제든지 확인할 수 있습니다.",
    target: "body"
  }
]);

const isLastStep = computed(() => stepIndex.value === steps.value.length - 1);
const currentStep = computed(() => steps.value[stepIndex.value]);

const highlightStyle = ref({});
const textboxStyle = ref({});

const updatePositions = () => {
  const targetId = currentStep.value?.target;
  if (!targetId) return;

  const targetEl = document.querySelector(targetId);
  if (!targetEl || targetId === 'body') {
    // 특정 대상이 없으면 화면 중앙에 표시
    highlightStyle.value = { display: 'none' };
    textboxStyle.value = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    return;
  }

  const rect = targetEl.getBoundingClientRect();
  highlightStyle.value = {
    display: 'block',
    width: `${rect.width + 20}px`,
    height: `${rect.height + 20}px`,
    top: `${rect.top - 10}px`,
    left: `${rect.left - 10}px`,
  };
  textboxStyle.value = {
    top: `${rect.bottom + 20}px`,
    left: `${rect.left}px`,
    transform: 'translateX(0)',
  };
};

const nextStep = () => {
  if (isLastStep.value) {
    endTutorial();
  } else {
    stepIndex.value++;
  }
};

const endTutorial = () => {
  isActive.value = false;
  emit('complete');
};

watch(() => props.run, (newVal) => {
  if (newVal) {
    isActive.value = true;
    stepIndex.value = 0;
    nextTick(updatePositions);
  }
});

watch(stepIndex, () => {
  nextTick(updatePositions);
});

onMounted(() => {
  window.addEventListener('resize', updatePositions);
  // [수정] 스크롤 이벤트가 발생할 때마다 위치를 업데이트하도록 리스너를 추가합니다.
  // (true 옵션은 이벤트 감지 우선순위를 높여 더 부드럽게 반응하도록 합니다.)
  window.addEventListener('scroll', updatePositions, true);
});
onUnmounted(() => {
  window.removeEventListener('resize', updatePositions);
  // [수정] 추가했던 스크롤 이벤트 리스너를 반드시 제거해줍니다.
  window.removeEventListener('scroll', updatePositions, true);
});

</script>

<style scoped>
.tutorial-overlay { position: fixed; inset: 0; z-index: 2000; }
.tutorial-highlight {
  position: absolute;
  background: rgba(0, 0, 0, 0.5);
  border: 2px dashed white;
  border-radius: 8px;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);
  transition: all 0.3s ease-in-out;
}
.tutorial-textbox {
  position: absolute;
  background: white;
  padding: 20px;
  border-radius: 8px;
  width: 300px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.2);
  transition: all 0.3s ease-in-out;
}
.tutorial-actions {
  margin-top: 15px;
  display: flex;
  justify-content: space-between;
}
.tutorial-actions button {
  padding: 5px 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: #f0f0f0;
  cursor: pointer;
}
.tutorial-actions button.primary {
  background: #007bff;
  color: white;
  border-color: #007bff;
}
</style>