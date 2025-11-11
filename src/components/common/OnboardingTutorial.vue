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

// ▼▼▼ [★핵심 수정★] 튜토리얼 단계를 새 레이아웃에 맞게 변경 ▼▼▼
const steps = ref([
  {
    title: "환영합니다!",
    content: "솔트메이트에 오신 것을 환영합니다! 간단한 안내를 통해 주요 기능을 소개해 드릴게요.",
    target: "body"
  },
  {
    title: "내 정보 확인",
    content: "이곳에서 현재 보유한 SaltMate 포인트와 등급을 확인할 수 있습니다. 모든 게임과 활동은 SaltMate 포인트를 사용해요.",
    target: ".user-info-widget" // 1. (동일) 나의 등급 및 수익 현황
  },
  {
    title: "아바타 쇼케이스",
    content: "최근 다른 회원들이 꾸민 아바타입니다. '내 아바타 꾸미기'에서 나만의 아바타를 만들 수 있습니다.",
    target: ".avatar-showcase" // 2. (변경) 아바타 쇼케이스
  },
  {
    title: "핵심 게임: 솔트 알케미",
    content: "가장 인기있는 게임입니다! 재료를 합쳐 '연금술 가루'를 획득하고 다른 아이템을 제작해 보세요.",
    target: "a[href='/salt-alchemy']" // 3. (변경) 솔트 알케미 카드
  },
  {
    title: "튜토리얼 완료",
    content: "이제 솔트메이트를 자유롭게 탐험해보세요! 궁금한 점은 '도움말' 메뉴에서 언제든지 확인할 수 있습니다.",
    target: "body"
  }
]);
// ▲▲▲ (수정 완료) ▲▲▲

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
    textboxStyle.value = { 
      top: '50%', 
      left: '50%', 
      transform: 'translate(-50%, -50%)',
      // [★수정★] 중앙 정렬 시 텍스트 위치도 중앙으로
      bottom: 'auto', 
      right: 'auto' 
    };
    return;
  }
  
  // [★수정★] 대상이 화면에서 너무 높거나 낮을 때 텍스트박스 위치 자동 보정
  const rect = targetEl.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  
  highlightStyle.value = {
    display: 'block',
    width: `${rect.width + 20}px`,
    height: `${rect.height + 20}px`,
    top: `${rect.top - 10}px`,
    left: `${rect.left - 10}px`,
  };

  // 텍스트박스 기본 위치 (대상 아래)
  let textTop = rect.bottom + 20;
  let textLeft = rect.left;
  let textTransform = 'translateX(0)';
  
  // 대상이 화면 하단 1/3보다 아래에 있으면, 텍스트박스를 대상 위로 보냄
  if (rect.top > (viewportHeight * 0.66)) {
    textTop = rect.top - 20; // 대상 위 20px
    textTransform = 'translateY(-100%)'; // 자신의 높이만큼 위로
  }
  
  // 텍스트박스가 화면 오른쪽을 벗어나면 위치 보정
  if (textLeft + 300 > window.innerWidth) { // 300px는 텍스트박스 너비
    textLeft = window.innerWidth - 320; // 오른쪽 여백 20px
  }
  // 텍스트박스가 화면 왼쪽을 벗어나면 위치 보정
  if (textLeft < 0) {
    textLeft = 10;
  }

  textboxStyle.value = {
    top: `${textTop}px`,
    left: `${textLeft}px`,
    transform: textTransform,
    bottom: 'auto', // [★추가★]
    right: 'auto'  // [★추가★]
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
  window.addEventListener('scroll', updatePositions, true);
});
onUnmounted(() => {
  window.removeEventListener('resize', updatePositions);
  window.removeEventListener('scroll', updatePositions, true);
});

</script>

<style scoped>
.tutorial-overlay { position: fixed; inset: 0; z-index: 2000; }
.tutorial-highlight {
  position: absolute;
  /* [★수정★] 하이라이트 디자인 변경 (그림자 -> 테두리) */
  background: transparent; /* 배경 투명 */
  border: 3px solid #007bff; /* 파란색 테두리 */
  border-radius: 12px; /* 둥근 모서리 */
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.6), 0 0 15px #007bff; /* 바깥 영역 어둡게 + 빛 효과 */
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
  z-index: 2001; /* [★추가★] 하이라이트보다 위에 있도록 */
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