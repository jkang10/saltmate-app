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
            class="product-image"
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
  </div>
</template>

<script>
// ▼▼▼ [수정됨] 사용하지 않는 auth 제거 ▼▼▼
import { db } from "@/firebaseConfig";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
// ▲▲▲ 수정 완료 ▲▲▲

export default {
  name: "MallPage",
  data() {
    return {
      products: [],
      isLoading: true,
      error: null,
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
        const functions = getFunctions();
        const placeOrder = httpsCallable(functions, "placeOrder");
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
  },
};
</script>

<style scoped>
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
