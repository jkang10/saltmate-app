<template>
  <div class="page-container">
    <header class="page-header">
      <h1><i class="fas fa-store"></i> 솔트메이트 몰</h1>
      <p class="description">SaltMate 포인트로 특별한 상품을 만나보세요.</p>
    </header>

    <nav class="sub-nav">
      <router-link to="/mall" class="sub-nav-item active"
        >상품 목록</router-link
      >
      <router-link to="/my-orders" class="sub-nav-item"
        >나의 주문 내역</router-link
      >
    </nav>

    <main class="content-wrapper card">
      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
      </div>
      <div v-else-if="error" class="error-state">
        <p>{{ error }}</p>
      </div>
      <div v-else-if="products.length === 0" class="empty-state">
        <p>판매 중인 상품이 없습니다.</p>
      </div>
      <div v-else class="product-grid">
        <div v-for="product in products" :key="product.id" class="product-card">
          <img
            :src="product.imageUrl || 'https://via.placeholder.com/300'"
            alt="상품 이미지"
            class="product-image clickable-image"
            @click="openDetailModal(product)"
          />
          <div class="product-info">
            <h3 class="product-name">{{ product.name }}</h3>
            <p class="product-description">{{ product.description }}</p>
            <div class="product-details">
              <span class="product-price"
                >{{ (product.price || 0).toLocaleString() }} SaltMate</span
              >
              <span class="product-stock"
                >남은 수량: {{ product.stock || 0 }}개</span
              >
            </div>
            <button
              @click="purchaseProduct(product)"
              class="buy-button"
              :disabled="product.stock === 0"
            >
              {{ product.stock > 0 ? "구매하기" : "품절" }}
            </button>
          </div>
        </div>
      </div>
    </main>

    <div v-if="isDetailModalVisible" class="detail-modal-overlay" @click="closeDetailModal">
      <div class="detail-modal-content" @click.stop>
        <button @click="closeDetailModal" class="close-detail-modal">&times;</button>
        <img :src="selectedDetailImageUrl" alt="상품 상세 이미지" />
      </div>
    </div>
    </div>
</template>

<script>
import { db } from "@/firebaseConfig";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
// [수정] getFunctions, httpsCallable import 추가
import { getFunctions, httpsCallable } from "firebase/functions";

export default {
  name: "MallPage",
  data() {
    return {
      products: [],
      isLoading: true,
      error: null,
      isDetailModalVisible: false, // [신규] 모달 표시 상태
      selectedDetailImageUrl: null, // [신규] 선택된 상세 이미지 URL
    };
  },
  async created() {
    await this.fetchProducts();
  },
  methods: {
    async fetchProducts() {
      this.isLoading = true;
      try {
        const q = query(
          collection(db, "products"),
          where("isActive", "==", true),
          orderBy("createdAt", "desc"),
        );
        const querySnapshot = await getDocs(q);
        this.products = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
      } catch (error) {
        console.error("상품 목록 조회 오류:", error);
        this.error = "상품을 불러오는 데 실패했습니다.";
      } finally {
        this.isLoading = false;
      }
    },
    async purchaseProduct(product) {
      const quantity = prompt(
        `'${product.name}' 상품을 몇 개 구매하시겠습니까?`,
        "1",
      );
      if (!quantity || isNaN(quantity) || Number(quantity) <= 0) {
        return;
      }

      if (
        !confirm(
          `${Number(quantity).toLocaleString()}개를 구매합니다. ${(product.price * Number(quantity)).toLocaleString()}P가 차감됩니다.`,
        )
      )
        return;

      try {
        // [수정] functions 인스턴스 올바르게 참조
        const functionsInstance = getFunctions(undefined, "asia-northeast3");
        const placeOrder = httpsCallable(functionsInstance, "placeOrder");
        const result = await placeOrder({
          productId: product.id,
          quantity: Number(quantity),
        });

        alert(result.data.message);
        this.$router.push("/my-orders");
      } catch (error) {
        console.error("주문 실패:", error);
        alert(`주문에 실패했습니다: ${error.message}`);
      }
    },

    // ▼▼▼ [신규] 모달 관련 함수 ▼▼▼
    openDetailModal(product) {
      // 상세 이미지가 있으면 그것을, 없으면 메인 이미지를 보여줌
      this.selectedDetailImageUrl = product.detailImageUrl || product.imageUrl || 'https://via.placeholder.com/600';
      this.isDetailModalVisible = true;
    },
    closeDetailModal() {
      this.isDetailModalVisible = false;
      this.selectedDetailImageUrl = null;
    },
    // ▲▲▲
  },
};
</script>

<style scoped>
.product-image {
  width: 100%;
  height: 250px;
  object-fit: cover;
}

/* ▼▼▼ [신규] 상세 이미지 모달 스타일 ▼▼▼ */
.clickable-image {
  cursor: pointer;
}
.detail-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85); /* 배경을 더 어둡게 */
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1002;
  backdrop-filter: blur(5px);
}
.detail-modal-content {
  position: relative;
  background: white;
  padding: 0; /* 패딩 제거 */
  border-radius: 10px;
  width: 90vw; /* 가로폭을 화면의 90%로 설정 */
  max-width: 860px; /* PC에서는 최대 860px (이미지 원본 가로 크기) */
  max-height: 80vh; /* 세로 높이를 화면의 80%로 제한 */
  overflow-y: auto; /* 세로 스크롤 자동 생성 */
  box-shadow: 0 5px 20px rgba(0,0,0,0.4);
}
.detail-modal-content img {
  width: 100%; /* 이미지가 모달창 가로폭에 꽉 차도록 설정 */
  max-width: 100%; /* max-width 제거 (이미지가 100%로 늘어나도록) */
  display: block; /* 이미지 하단 여백 제거 */
}
.close-detail-modal {
  position: fixed; /* [수정] 이미지를 스크롤해도 닫기 버튼은 고정 */
  top: 15px;
  right: 15px;
  width: 35px;
  height: 35px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  border: 2px solid white;
  font-size: 1.5em;
  line-height: 1;
  cursor: pointer;
  z-index: 1003; /* 모달 컨텐츠보다 위에 오도록 */
}
.page-container {
  max-width: 1200px;
  margin: 70px auto 20px;
  padding: 20px;
}
.page-header {
  text-align: center;
  margin-bottom: 30px;
}
.page-header h1 {
  font-size: 2.8em;
}
.page-header p {
  font-size: 1.1em;
  color: #666;
}
.sub-nav {
  display: flex;
  justify-content: center;
  gap: 15px;
  margin-bottom: 30px;
  border-bottom: 1px solid #dee2e6;
  padding-bottom: 15px;
}
.sub-nav-item {
  text-decoration: none;
  color: #555;
  font-weight: bold;
  padding: 10px 20px;
  border-radius: 8px;
  transition: all 0.2s ease;
}
.sub-nav-item.router-link-exact-active,
.sub-nav-item:hover {
  background-color: #007bff;
  color: white;
}
.content-wrapper {
  padding: 30px;
  border-radius: 15px;
}
.card {
  background: #fff;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.08);
}
.loading-state,
.empty-state {
  text-align: center;
  padding: 40px;
  color: #666;
}
.spinner {
  display: inline-block;
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-top: 4px solid #007bff;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 25px;
}
.product-card {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}
.product-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
}
.product-image {
  width: 100%;
  height: 250px;
  object-fit: cover;
}
.product-info {
  padding: 20px;
}
.product-name {
  font-size: 1.3em;
  margin: 0 0 10px;
}
.product-description {
  font-size: 0.9em;
  color: #666;
  min-height: 40px;
}
.product-details {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 15px 0;
}
.product-price {
  font-size: 1.5em;
  font-weight: bold;
  color: #007bff;
}
.product-stock {
  font-size: 0.9em;
  color: #888;
}
.buy-button {
  width: 100%;
  background-color: #28a745;
  color: white;
  border: none;
  padding: 12px;
  border-radius: 8px;
  font-weight: bold;
  cursor: pointer;
}
.buy-button:disabled {
  background-color: #6c757d;
  cursor: not-allowed;
}
</style>
