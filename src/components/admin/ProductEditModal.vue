<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content card">
      <header class="modal-header">
        <h3>{{ isNew ? "새 상품 등록" : "상품 정보 수정" }}</h3>
        <button @click="$emit('close')" class="close-button">&times;</button>
      </header>
      <form class="modal-body" @submit.prevent="saveProduct">
        <div class="form-group">
          <label>상품명</label>
          <input type="text" v-model="product.name" required />
        </div>
        <div class="form-group">
          <label>가격 (SaltMate 포인트)</label>
          <input
            type="number"
            v-model.number="product.price"
            min="0"
            required
          />
        </div>
        <div class="form-group">
          <label>재고 수량</label>
          <input
            type="number"
            v-model.number="product.stock"
            min="0"
            required
          />
        </div>
        <div class="form-group">
          <label>상품 설명</label>
          <textarea v-model="product.description" rows="5"></textarea>
        </div>
        <div class="form-group-inline">
          <label for="is-active">판매 상태</label>
          <input type="checkbox" id="is-active" v-model="product.isActive" />
          <span>판매중</span>
        </div>
        <footer class="modal-footer">
          <button type="button" class="btn-secondary" @click="$emit('close')">
            취소
          </button>
          <button type="submit" class="btn-primary" :disabled="isSaving">
            <span v-if="isSaving">저장 중...</span>
            <span v-else>저장</span>
          </button>
        </footer>
      </form>
    </div>
  </div>
</template>

<script>
import { db } from "@/firebaseConfig";
import {
  doc,
  setDoc,
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";

export default {
  name: "ProductEditModal",
  props: ["productData"],
  emits: ["close", "product-saved"],
  data() {
    return {
      product: {
        name: "",
        price: 0,
        stock: 0,
        description: "",
        isActive: true,
      },
      isSaving: false,
    };
  },
  computed: {
    isNew() {
      return !this.productData;
    },
  },
  created() {
    if (!this.isNew) {
      this.product = { ...this.productData };
    }
  },
  methods: {
    async saveProduct() {
      this.isSaving = true;
      try {
        if (this.isNew) {
          // 새 상품 등록
          await addDoc(collection(db, "products"), {
            ...this.product,
            createdAt: serverTimestamp(),
          });
          alert("새 상품이 등록되었습니다.");
        } else {
          // 기존 상품 수정
          const productRef = doc(db, "products", this.product.id);

          // ▼▼▼ [수정됨] 불필요한 id 변수 생성을 막는 방식으로 변경 ▼▼▼
          const dataToSave = { ...this.product };
          delete dataToSave.id; // 저장할 데이터에서 id 필드만 제거
          // ▲▲▲ 수정 완료 ▲▲▲

          await setDoc(productRef, dataToSave, { merge: true });
          alert("상품 정보가 수정되었습니다.");
        }
        this.$emit("product-saved");
        this.$emit("close");
      } catch (error) {
        console.error("상품 저장 오류:", error);
        alert("상품 저장에 실패했습니다.");
      } finally {
        this.isSaving = false;
      }
    },
  },
};
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1001;
}
.modal-content {
  width: 90%;
  max-width: 500px;
  background-color: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  border-bottom: 1px solid #eee;
}
.modal-header h3 {
  margin: 0;
  font-size: 1.2em;
}
.close-button {
  background: none;
  border: none;
  font-size: 1.5em;
  cursor: pointer;
}
.modal-body {
  padding: 20px;
}
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 15px 20px;
  border-top: 1px solid #eee;
}
.form-group {
  margin-bottom: 15px;
}
.form-group label {
  display: block;
  font-weight: bold;
  margin-bottom: 5px;
}
.form-group input,
.form-group textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 6px;
  box-sizing: border-box;
}
.form-group-inline {
  display: flex;
  align-items: center;
  gap: 10px;
}
.btn-primary,
.btn-secondary {
  border: none;
  border-radius: 5px;
  padding: 8px 16px;
  cursor: pointer;
  font-weight: bold;
}
.btn-primary {
  background-color: #007bff;
  color: white;
}
.btn-secondary {
  background-color: #6c757d;
  color: white;
}
.btn-primary:disabled {
  background-color: #a0c9ff;
}
</style>
