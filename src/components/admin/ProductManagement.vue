<template>
  <div class="management-page">
    <h3><i class="fas fa-box"></i> 상품 관리</h3>
    <p>솔트메이트 몰에서 판매할 상품을 등록하고 관리합니다.</p>

    <div class="actions">
      <button @click="openProductModal(null)" class="btn-primary">
        <i class="fas fa-plus"></i> 새 상품 등록
      </button>
    </div>

    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
    </div>
    <div v-else class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>이미지</th>
            <th>상품명</th>
            <th>가격 (SaltMate)</th>
            <th>재고</th>
            <th>상태</th>
            <th>관리</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="product in products" :key="product.id">
            <td class="image-cell">
              <img
                :src="product.imageUrl || 'https://via.placeholder.com/60'"
                alt="상품 이미지"
                class="product-thumbnail"
              />
            </td>
            <td>{{ product.name }}</td>
            <td>{{ (product.price || 0).toLocaleString() }} P</td>
            <td>{{ (product.stock || 0).toLocaleString() }} 개</td>
            <td>
              <span
                :class="[
                  'status-badge',
                  product.isActive ? 'active' : 'inactive',
                ]"
              >
                {{ product.isActive ? "판매중" : "판매중지" }}
              </span>
            </td>
            <td class="actions-cell">
              <button
                @click="openProductModal(product)"
                class="btn-secondary btn-sm"
              >
                수정
              </button>
              <button
                @click="deleteProduct(product.id, product.name)"
                class="btn-danger btn-sm"
              >
                삭제
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <ProductEditModal
      v-if="isModalVisible"
      :product-data="selectedProduct"
      @close="closeProductModal"
      @product-saved="fetchProducts"
    />
  </div>
</template>

<script>
import { db } from "@/firebaseConfig";
import {
  collection,
  getDocs,
  doc,
  deleteDoc,
  orderBy,
  query,
} from "firebase/firestore";
import ProductEditModal from "./ProductEditModal.vue";

export default {
  name: "ProductManagement",
  components: { ProductEditModal },
  data() {
    return {
      products: [],
      isLoading: true,
      isModalVisible: false,
      selectedProduct: null,
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
          orderBy("createdAt", "desc"),
        );
        const querySnapshot = await getDocs(q);
        this.products = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
      } catch (error) {
        console.error("상품 목록 조회 오류:", error);
        alert("상품 목록을 불러오는 데 실패했습니다.");
      } finally {
        this.isLoading = false;
      }
    },
    openProductModal(product) {
      this.selectedProduct = product ? { ...product } : null;
      this.isModalVisible = true;
    },
    closeProductModal() {
      this.isModalVisible = false;
      this.selectedProduct = null;
    },
    async deleteProduct(productId, productName) {
      if (
        !confirm(
          `'${productName}' 상품을 정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`,
        )
      )
        return;
      try {
        await deleteDoc(doc(db, "products", productId));
        alert("상품이 삭제되었습니다.");
        await this.fetchProducts();
      } catch (error) {
        console.error("상품 삭제 오류:", error);
        alert("상품 삭제에 실패했습니다.");
      }
    },
  },
};
</script>

<style scoped>
.management-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.actions {
  display: flex;
  justify-content: flex-end;
}
.btn-primary {
  background-color: #007bff;
  color: white;
  border: none;
  padding: 10px 18px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: bold;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition: background-color 0.2s;
}
.btn-primary:hover {
  background-color: #0056b3;
}
.table-container {
  overflow-x: auto;
}
.data-table {
  width: 100%;
  border-collapse: collapse;
  text-align: center;
}
.data-table th,
.data-table td {
  padding: 12px 15px;
  border-bottom: 1px solid #eee;
  vertical-align: middle;
}
.data-table thead th {
  background-color: #f8f9fa;
  font-weight: bold;
}
.image-cell {
  width: 80px;
}
.product-thumbnail {
  width: 60px;
  height: 60px;
  object-fit: cover;
  border-radius: 6px;
}
.status-badge {
  padding: 5px 10px;
  border-radius: 15px;
  font-size: 0.85em;
  font-weight: bold;
  color: #fff;
}
.status-badge.active {
  background-color: #28a745;
}
.status-badge.inactive {
  background-color: #6c757d;
}
.actions-cell button {
  margin: 0 4px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  transition: opacity 0.2s;
}
.actions-cell button:hover {
  opacity: 0.8;
}
.btn-sm {
  padding: 5px 10px;
  font-size: 0.9em;
}
.btn-secondary {
  background-color: #6c757d;
  color: white;
}
.btn-danger {
  background-color: #dc3545;
  color: white;
}
.loading-state {
  text-align: center;
  padding: 40px;
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
</style>
