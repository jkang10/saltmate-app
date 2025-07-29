<template>
  <div class="nft-info-page">
    <h1>💎 나의 NFT 정보</h1>
    <p>
      공장 지분 연동 NFT에 대한 상세 정보와 특별 혜택이 표시될 페이지입니다.
    </p>
    <div class="placeholder-content">
      <p>
        여기에 NFT 이미지, 속성, 연동된 지분 정보, 배당 내역 등의 콘텐츠가
        들어갈 예정입니다.
      </p>
      <p>이 페이지는 NFT 보유자만 접근할 수 있습니다.</p>
    </div>
  </div>
</template>

<script>
// 'ref'와 'onMounted'는 현재 사용되지 않으므로 제거합니다.
// import { ref, onMounted } from 'vue'; // 이 줄을 제거하거나 주석 처리하세요.

export default {
  name: "NftInfoPage",
  setup() {
    // 여기에 NFT 정보 로딩, 표시 등의 로직을 추가할 수 있습니다.
    // 예: const nftDetails = ref(null);
    // onMounted(() => { /* NFT 정보 불러오기 */ });

    return {
      // 반환할 데이터나 함수 (현재는 없음)
    };
  },
};
</script>

<style scoped>
/* 기존 스타일 유지 */
.nft-info-page {
  padding: 40px 20px;
  background-color: #f7f9fc;
  min-height: 100vh;
  text-align: center;
  font-family: "Pretendard", sans-serif;
  color: #333;
}

h1 {
  font-size: 2.8em;
  color: #6a0572; /* NFT 관련 테마 색상 */
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
  border: 1px solid #eee;
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
