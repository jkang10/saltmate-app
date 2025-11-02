<template>
  <div class="mall-page-container">
    
    <header class="mall-header-banner">
      <div class="banner-content">
        <h1><i class="fas fa-store"></i> 솔트메이트 몰</h1>
        <p class="description">SaltMate 포인트로 특별한 상품을 만나보세요.</p>
        <nav class="sub-nav">
          <router-link to="/mall" class="sub-nav-item">상품 목록</router-link>
          <router-link to="/my-orders" class="sub-nav-item">나의 주문 내역</router-link>
        </nav>
      </div>
    </header>

    <main class="content-wrapper">
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
          
          <div class="product-image-wrapper">
            <img
              :src="product.imageUrl || 'https://via.placeholder.com/400'"
              alt="상품 이미지"
              class="product-image clickable-image"
              @click="openDetailModal(product)"
            />
            <button
              @click="purchaseProduct(product)"
              class="buy-button-icon"
              :disabled="product.stock === 0"
              :title="product.stock > 0 ? '구매하기' : '품절'"
            >
              <i v-if="product.stock > 0" class="fas fa-shopping-cart"></i>
              <i v-else class="fas fa-ban"></i>
            </button>
          </div>

          <div class="product-info">
            <h3 class="product-name" @click="openDetailModal(product)">{{ product.name }}</h3>
            <p class="product-description">{{ product.description }}</p>
            <div class="product-details">
              <span class="product-price">
                <i class="fas fa-coins"></i> {{ (product.price || 0).toLocaleString() }} P
              </span>
              <span class="product-stock"
                >재고: {{ product.stock || 0 }}개</span
              >
            </div>
          </div>
        </div>
      </div>
    </main>

    <div v-if="isDetailModalVisible" class="detail-modal-overlay" @click="closeDetailModal">
      <div class="detail-modal-content" @click.stop>
        <img :src="selectedDetailImageUrl" alt="상품 상세 이미지" />
      </div>
      <button @click="closeDetailModal" class="close-detail-modal">&times;</button>
    </div>

  </div>
</template>

<script>
// (script 내용은 이전과 100% 동일합니다)
import { db } from "@/firebaseConfig";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";

export default {
  name: "MallPage",
  data() {
    return {
      products: [],
      isLoading: true,
      error: null,
      isDetailModalVisible: false,
      selectedDetailImageUrl: null,
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
    openDetailModal(product) {
      this.selectedDetailImageUrl = product.detailImageUrl || product.imageUrl || 'https://via.placeholder.com/800x1200';
      this.isDetailModalVisible = true;
      document.body.style.overflow = 'hidden'; // [★추가★] 뒷배경 스크롤 방지
    },
    closeDetailModal() {
      this.isDetailModalVisible = false;
      this.selectedDetailImageUrl = null;
      document.body.style.overflow = ''; // [★추가★] 스크롤 복원
    },
  },
};
</script>

<style scoped>
/* ▼▼▼ [핵심 수정] 새 디자인 CSS ▼▼▼ */

.mall-page-container {
  width: 100%;
  min-height: 100vh;
  background-color: #f8f9fa; /* 밝은 배경색 */
}

/* 1. 상단 배너 및 탭 */
.mall-header-banner {
  width: 100%;
  padding: 4rem 2rem;
  background: linear-gradient(135deg, #4a0e97 0%, #2c3e50 100%); /* 솔레인 보라색 -> 어두운 파랑 */
  color: white;
  text-align: center;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  margin-bottom: 2rem;
}
.banner-content {
  max-width: 1200px;
  margin: 0 auto;
}
.banner-content h1 {
  font-size: 2.8em;
  font-weight: 700;
  margin: 0 0 10px 0;
  text-shadow: 0 2px 4px rgba(0,0,0,0.3);
}
.banner-content .description {
  font-size: 1.2em;
  color: #bdc3c7;
  margin-bottom: 2rem;
}
.sub-nav {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin: 0;
  padding: 0;
  border-bottom: none;
}
.sub-nav-item {
  text-decoration: none;
  color: #ecf0f1;
  font-weight: bold;
  padding: 10px 20px;
  border-radius: 50px; /* 알약 모양 */
  border: 2px solid transparent;
  transition: all 0.3s ease;
}
.sub-nav-item.router-link-exact-active,
.sub-nav-item:hover {
  background-color: rgba(255, 255, 255, 0.9);
  color: #4a0e97; /* 보라색 텍스트 */
  border-color: transparent;
}
.sub-nav-item:not(.router-link-exact-active):hover {
   background-color: rgba(255, 255, 255, 0.1);
   color: #fff;
}

/* 2. 상품 그리드 */
.content-wrapper {
  max-width: 1400px; /* 더 넓게 */
  margin: 0 auto;
  padding: 0 2rem 3rem 2rem; /* 좌우 패딩 */
}
.product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); /* 최소 300px */
  gap: 2rem;
}

/* 3. 상품 카드 */
.product-card {
  background: #ffffff;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
}
.product-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.12);
}
.product-image-wrapper {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1; /* [★신규★] 1:1 정사각형 비율 강제 */
  overflow: hidden;
  background-color: #f4f4f4;
}
.product-image {
  width: 100%;
  height: 100%;
  object-fit: cover; /* [★수정★] 1:1 비율을 채우도록 */
  transition: transform 0.4s ease;
}
.product-card:hover .product-image {
  transform: scale(1.05);
}
.clickable-image {
  cursor: pointer;
}

/* [★신규★] 아이콘 버튼 */
.buy-button-icon {
  position: absolute;
  bottom: 15px;
  right: 15px;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: linear-gradient(135deg, #FFC107, #E0A800); /* 금색 */
  color: #212529;
  border: none;
  font-size: 1.2rem;
  box-shadow: 0 4px 10px rgba(0,0,0,0.2);
  cursor: pointer;
  transition: all 0.3s ease;
  z-index: 10;
}
.buy-button-icon:hover:not(:disabled) {
  transform: scale(1.1);
  box-shadow: 0 6px 15px rgba(255, 193, 7, 0.5);
}
.buy-button-icon:disabled {
  background: #95a5a6;
  color: #ecf0f1;
  cursor: not-allowed;
}

.product-info {
  padding: 20px;
  display: flex;
  flex-direction: column;
  flex-grow: 1; /* 카드의 남은 공간을 채움 */
}
.product-name {
  font-size: 1.3em;
  font-weight: 600;
  margin: 0 0 10px;
  cursor: pointer;
  color: #333;
}
.product-name:hover {
  color: #4a0e97;
}
.product-description {
  font-size: 0.9em;
  color: #666;
  line-height: 1.5;
  min-height: 42px; /* 2줄 높이 */
  flex-grow: 1; /* 설명이 공간을 채우도록 */
}
.product-details {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 15px;
}
.product-price {
  font-size: 1.6em; /* 가격 강조 */
  font-weight: bold;
  color: #E0A800; /* 금색 */
  display: flex;
  align-items: center;
  gap: 5px;
}
.product-stock {
  font-size: 0.9em;
  color: #888;
  background-color: #f8f9fa;
  padding: 4px 8px;
  border-radius: 4px;
}

/* 4. [★수정★] 상세 이미지 라이트박스 모달 */
.detail-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.9); /* 더 어둡게 */
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1002;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
.detail-modal-content {
  position: relative;
  background: #111;
  padding: 0;
  border-radius: 0;
  width: 90vw;
  height: 90dvh; /* [★수정★] 동적 뷰포트 높이 90% */
  overflow-y: auto; /* 세로 스크롤 */
  box-shadow: 0 5px 30px rgba(0,0,0,0.5);
}
/* 스크롤바 디자인 (선택사항) */
.detail-modal-content::-webkit-scrollbar {
  width: 8px;
}
.detail-modal-content::-webkit-scrollbar-thumb {
  background: #FFC107;
  border-radius: 4px;
}
.detail-modal-content::-webkit-scrollbar-track {
  background: #333;
}

.detail-modal-content img {
  width: 100%;
  max-width: 100%;
  display: block;
}
.close-detail-modal {
  position: fixed; /* 화면 기준 고정 */
  top: 20px;
  right: 20px;
  width: 45px;
  height: 45px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  border: 2px solid rgba(255, 255, 255, 0.7);
  font-size: 2em;
  line-height: 40px;
  text-align: center;
  cursor: pointer;
  z-index: 1003;
  transition: all 0.3s ease;
}
.close-detail-modal:hover {
  background: rgba(255, 255, 255, 0.9);
  color: #111;
  transform: rotate(90deg);
}

/* 5. 로딩/에러/빈 상태 */
.loading-state,
.empty-state {
  text-align: center;
  padding: 60px;
  color: #666;
  font-size: 1.2rem;
  background: #fff;
  border-radius: 16px;
}
.spinner {
  display: inline-block;
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-top: 4px solid #4a0e97; /* 보라색 스피너 */
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
</style>