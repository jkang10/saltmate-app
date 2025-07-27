<template>
  <div class="shop-page">
    <h1>솔트메이트 스토어</h1>
    <p>여기에 상품 목록과 쇼핑 관련 내용이 표시됩니다.</p>
  </div>
</template>

<script>
// 이 컴포넌트에서는 현재 특별한 로직이 없으므로 비어있는 setup을 사용합니다.
// 만약 나중에 데이터 fetch, 반응형 변수 등이 필요하면 여기에 추가하면 됩니다.
export default {
  name: "ShopPage", // 컴포넌트 이름 명시
  setup() {
    // 예시: const products = ref([]);
    // onMounted(() => { /* 상품 데이터 불러오기 */ });

    return {
      // products // 템플릿에서 사용할 변수나 함수를 여기에 나열
    };
  },
};
</script>

<style scoped>
.shop-page {
  padding: 20px;
  text-align: center;
  background-color: #f8f8f8;
  min-height: calc(100vh - 60px); /* 헤더/푸터 높이를 고려하여 조정 */
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}
h1 {
  color: #2c3e50;
  margin-bottom: 20px;
  font-size: 2.5em;
}
p {
  color: #666;
  font-size: 1.1em;
  line-height: 1.6;
}

/* 필요에 따라 추가적인 스타일을 여기에 작성하세요 */
</style>
