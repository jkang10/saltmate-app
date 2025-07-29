<template>
  <div class="product-detail-page">
    <button @click="goBack" class="back-button">&lt; 뒤로 가기</button>
    <div v-if="product" class="product-detail-container card">
      <img
        :src="product.imageUrl"
        :alt="product.name"
        class="product-detail-image"
      />
      <div class="product-info">
        <h1>{{ product.name }}</h1>
        <p class="product-detail-price">
          {{ product.price.toLocaleString() }}원
        </p>
        <p class="product-detail-description">{{ product.longDescription }}</p>
        <button class="add-to-cart-button">장바구니 담기</button>
      </div>
    </div>
    <div v-else>
      <p>상품 정보를 찾을 수 없습니다.</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();
const product = ref(null);

// 더미 상품 데이터 (Shop.vue와 동일하게 유지)
const productsData = [
  {
    id: "product1",
    name: "솔트메이트 유기농 천일염 1kg",
    price: 15000,
    shortDescription: "깨끗한 바다에서 온 프리미엄 천일염",
    longDescription:
      "전라남도 신안에서 채취한 100% 유기농 천일염입니다. 미네랄이 풍부하고 맛이 깊어 요리의 풍미를 더해줍니다. 우리 몸에 필수적인 미네랄을 자연 그대로 섭취할 수 있는 최고의 선택입니다.",
    imageUrl: "https://via.placeholder.com/400x400?text=Salt_1kg_Detail",
  },
  {
    id: "product2",
    name: "솔트메이트 해양 심층수 500ml",
    price: 5000,
    shortDescription: "미네랄이 풍부한 청정 해양 심층수",
    longDescription:
      "수심 600m 이하의 해양 심층수를 여과하여 만든 프리미엄 워터입니다. 몸에 좋은 미네랄이 가득합니다. 갈증 해소뿐만 아니라 건강 증진에도 도움을 줍니다.",
    imageUrl: "https://via.placeholder.com/400x400?text=Water_500ml_Detail",
  },
  {
    id: "product3",
    name: "솔트메이트 스페셜 에디션 NFT",
    price: 500000,
    shortDescription: "공장 지분 연동 프리미엄 NFT",
    longDescription:
      "솔트메이트 공장 지분에 연동되는 특별한 NFT입니다. 보유 시 독점적인 혜택과 정보를 제공하며, 솔트메이트 커뮤니티에서 특별한 지위를 가집니다. 미래 가치 상승을 기대할 수 있습니다.",
    imageUrl: "https://via.placeholder.com/400x400?text=NFT_Detail",
  },
];

const fetchProduct = (id) => {
  product.value = productsData.find((p) => p.id === id);
};

// 컴포넌트가 마운트될 때 상품 정보 로드
onMounted(() => {
  fetchProduct(route.params.id);
});

// 라우트 파라미터가 변경될 때마다 상품 정보 다시 로드 (예: /shop/product1 -> /shop/product2)
watch(
  () => route.params.id,
  (newId) => {
    if (newId) {
      fetchProduct(newId);
    }
  },
);

const goBack = () => {
  router.back(); // 이전 페이지로 이동
};
</script>

<style scoped>
.product-detail-page {
  padding: 20px;
  max-width: 900px;
  margin: 20px auto;
  text-align: center; /* 전체 페이지 중앙 정렬 */
}

.back-button {
  background: none;
  border: none;
  color: #3498db;
  font-size: 1em;
  cursor: pointer;
  margin-bottom: 20px;
  align-self: flex-start; /* 왼쪽 정렬 */
  font-weight: bold;
}

.back-button:hover {
  text-decoration: underline;
}

.product-detail-container {
  display: flex;
  flex-direction: column; /* 모바일 우선: 세로 정렬 */
  align-items: center;
  padding: 30px;
  background-color: #fff;
  border-radius: 12px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.1);
  gap: 30px;
}

@media (min-width: 768px) {
  .product-detail-container {
    flex-direction: row; /* 데스크톱: 가로 정렬 */
    text-align: left;
  }
}

.product-detail-image {
  width: 100%; /* 모바일에서 이미지 전체 너비 */
  max-width: 350px; /* 데스크톱에서 최대 너비 */
  height: auto;
  border-radius: 10px;
  object-fit: contain;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.08);
}

.product-info {
  flex: 1;
}

.product-info h1 {
  font-size: 2.2em;
  color: #34495e;
  margin-bottom: 15px;
}

.product-detail-price {
  font-size: 1.6em;
  color: #2ecc71;
  font-weight: bold;
  margin-bottom: 20px;
}

.product-detail-description {
  font-size: 1.1em;
  color: #555;
  line-height: 1.7;
  margin-bottom: 30px;
}

.add-to-cart-button {
  background-color: #3498db;
  color: white;
  padding: 15px 30px;
  border: none;
  border-radius: 8px;
  font-size: 1.1em;
  cursor: pointer;
  transition:
    background-color 0.3s ease,
    transform 0.2s ease;
  font-weight: bold;
  box-shadow: 0 4px 10px rgba(52, 152, 219, 0.2);
}

.add-to-cart-button:hover {
  background-color: #2980b9;
  transform: translateY(-2px);
}
</style>
