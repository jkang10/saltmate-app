<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content card">
      <header class="modal-header">
        <h3>{{ isNew ? "새 상품 등록" : "상품 정보 수정" }}</h3>
        <button @click="$emit('close')" class="close-button">&times;</button>
      </header>
      <form class="modal-body" @submit.prevent="saveProduct">
        <div class="form-group image-upload-group">
          <label>상품 이미지</label>
          <img
            :src="imagePreviewUrl"
            alt="상품 이미지 미리보기"
            class="image-preview"
            v-if="imagePreviewUrl"
          />
          <input type="file" @change="handleFileSelect" accept="image/*" />
          <small>이미지를 선택하지 않으면 기존 이미지가 유지됩니다.</small>
        </div>
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
import { db, storage } from "@/firebaseConfig"; // storage 임포트
import {
  doc,
  setDoc,
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage"; // storage 관련 함수 임포트

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
        imageUrl: null,
      },
      selectedFile: null, // [신규] 선택된 이미지 파일
      imagePreviewUrl: null, // [신규] 이미지 미리보기 URL
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
      if (this.product.imageUrl) {
        this.imagePreviewUrl = this.product.imageUrl; // 기존 이미지 미리보기 설정
      }
    }
  },
  methods: {
    handleFileSelect(event) {
      const file = event.target.files[0];
      if (file) {
        this.selectedFile = file;
        this.imagePreviewUrl = URL.createObjectURL(file); // 로컬에서 미리보기 생성
      }
    },
    async saveProduct() {
      this.isSaving = true;
      try {
        let imageUrl = this.product.imageUrl; // 기본값은 기존 이미지 URL

        // 1. 새 이미지가 선택된 경우, Firebase Storage에 업로드
        if (this.selectedFile) {
          const productId = this.isNew
            ? doc(collection(db, "products")).id
            : this.product.id;
          const imagePath = `product-images/${productId}/${this.selectedFile.name}`;
          const imageRef = storageRef(storage, imagePath);

          await uploadBytes(imageRef, this.selectedFile);
          imageUrl = await getDownloadURL(imageRef); // 업로드 후 다운로드 URL 받기
        }

        const dataToSave = {
          ...this.product,
          imageUrl: imageUrl, // 최종 이미지 URL로 업데이트
        };

        if (this.isNew) {
          // 2-1. 새 상품 등록 (Firestore)
          dataToSave.createdAt = serverTimestamp();
          await addDoc(collection(db, "products"), dataToSave);
          alert("새 상품이 등록되었습니다.");
        } else {
          // 2-2. 기존 상품 수정 (Firestore)
          const productRef = doc(db, "products", this.product.id);
          delete dataToSave.id; // 데이터에서 id 필드만 제거
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
.image-upload-group {
  margin-bottom: 20px;
}
.image-preview {
  max-width: 100%;
  height: auto;
  max-height: 200px;
  margin-bottom: 10px;
  border-radius: 8px;
  border: 1px solid #ddd;
}
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
