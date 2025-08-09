<template>
  <div class="page-container">
    <header class="page-header">
      <h1><i class="fas fa-store"></i> 솔트메이트 몰</h1>
      <p class="description">SaltMate 포인트로 특별한 상품을 만나보세요.</p>
    </header>

    <main class="content-wrapper card">
      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
      </div>
      <div v-else-if="error" class="error-state">
        <p>{{ error }}</p>
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
                >{{ (product.price || 0).toLocaleString() }} P</span
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
import { db } from "@/firebaseConfig";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";

export default {
  name: "ShopPage",
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
        this.$router.push("/my-orders"); // 주문 완료 후 내 주문 내역으로 이동
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
