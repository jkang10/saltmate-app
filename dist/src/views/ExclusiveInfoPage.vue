<template>
  <div class="exclusive-info-page">
    <h1>🔑 독점 정보 (NFT 보유자 전용)</h1>
    <p>
      공장 지분 연동 NFT 보유자만을 위한 특별하고 독점적인 정보가 제공되는
      페이지입니다.
    </p>
    <div class="placeholder-content">
      <p>
        여기에 미공개 생산 데이터, 시장 분석 리포트, 특별 이벤트 초대 등 독점
        콘텐츠가 표시될 예정입니다.
      </p>
      <p>이 정보는 솔트메이트 NFT 보유자에게만 공개됩니다.</p>
    </div>
  </div>
</template>

<script>
// 'ref'와 'onMounted'는 현재 사용되지 않으므로 제거합니다.
// import { ref, onMounted } from 'vue'; // 이 줄을 제거하거나 주석 처리하세요.

export default {
  name: "ExclusiveInfoPage",
  setup() {
    // 여기에 독점 정보 로딩, 표시 등의 로직을 추가할 수 있습니다.
    // 예: const exclusiveData = ref(null);
    // onMounted(() => { /* 독점 정보 불러오기 */ });

    return {
      // 반환할 데이터나 함수 (현재는 없음)
    };
  },
};
</script>

<style scoped>
/* 기존 스타일 유지 */
.exclusive-info-page {
  padding: 40px 20px;
  background-color: #eaf7ed; /* 부드러운 배경색 */
  min-height: 100vh;
  text-align: center;
  font-family: "Pretendard", sans-serif;
  color: #333;
}

h1 {
  font-size: 2.8em;
  color: #1a5e3f; /* 독점 정보 관련 테마 색상 */
  margin-bottom: 25px;
  text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.1);
}

p {
  font-size: 1.1em;
  color: #555;
  margin-bottom: 20px;
}

.placeholder-content {
  background-color: #ffffff;
  border-radius: 15px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08);
  padding: 30px;
  margin: 30px auto;
  max-width: 800px;
  text-align: left;
  border: 1px solid #d1e8d4;
}

.placeholder-content p {
  font-size: 1em;
  color: #666;
  line-height: 1.6;
}

/* 반응형 디자인 */
@media (max-width: 768px) {
  h1 {
    font-size: 2.2em;
  }
  p {
    font-size: 1em;
  }
  .placeholder-content {
    padding: 20px;
    margin: 20px 10px;
  }
}
</style>
