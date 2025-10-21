<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content card">
      <header class="modal-header">
        <h3>{{ isNew ? "새 상품 등록" : "상품 정보 수정" }}</h3>
        <button @click="$emit('close')" class="close-button">&times;</button>
      </header>
      <form class="modal-body" @submit.prevent="saveProduct">
        
        <div class="form-group image-upload-group">
          <label>상품 이미지 (목록용)</label>
          <img
            :src="imagePreviewUrl"
            alt="상품 이미지 미리보기"
            class="image-preview"
            v-if="imagePreviewUrl"
          />
          <input
            type="file"
            @change="handleFileSelect"
            accept="image/*"
            :required="isNew"
          />
          <small v-if="!isNew">이미지를 새로 선택하지 않으면 기존 이미지가 유지됩니다.</small>
        </div>

        <div class="form-group image-upload-group">
          <label>상품 상세 이미지 (클릭 시)</label>
          <img
            :src="detailImagePreviewUrl"
            alt="상세 이미지 미리보기"
            class="image-preview"
            v-if="detailImagePreviewUrl"
          />
          <input
            type="file"
            @change="handleDetailFileSelect"
            accept="image/*"
          />
          <small v-if="!isNew">상세 이미지를 새로 선택하지 않으면 기존 이미지가 유지됩니다.</small>
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
// [수정] functions, httpsCallable import 추가
import { db, functions } from "@/firebaseConfig";
import {
  doc,
  setDoc,
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

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
        detailImageUrl: null, // [신규] 상세 이미지 URL 필드
      },
      selectedFile: null,
      imagePreviewUrl: null,
      selectedDetailFile: null, // [신규] 상세 이미지 파일
      detailImagePreviewUrl: null, // [신규] 상세 이미지 미리보기
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
        this.imagePreviewUrl = this.product.imageUrl;
      }
      // [신규] 기존 상세 이미지 미리보기 로드
      if (this.product.detailImageUrl) {
        this.detailImagePreviewUrl = this.product.detailImageUrl;
      }
    }
  },
  methods: {
    handleFileSelect(event) {
      const file = event.target.files[0];
      if (file) {
        this.selectedFile = file;
        this.imagePreviewUrl = URL.createObjectURL(file);
      }
    },
    // [신규] 상세 이미지 파일 선택 핸들러
    handleDetailFileSelect(event) {
      const file = event.target.files[0];
      if (file) {
        this.selectedDetailFile = file;
        this.detailImagePreviewUrl = URL.createObjectURL(file);
      }
    },

    // [신규] 파일 업로드 로직을 별도 함수로 분리
    async uploadImage(file, productId, uploadFunctionName) {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      
      return new Promise((resolve, reject) => {
        reader.onload = async () => {
          try {
            const base64Data = reader.result.split(",")[1];
            // [수정] functions 인스턴스를 올바르게 참조
            const uploadFunction = httpsCallable(functions, uploadFunctionName);
            
            const result = await uploadFunction({
              productId: productId,
              fileData: base64Data,
              fileName: file.name,
            });
            
            resolve(result.data); // { success: true, imageUrl: '...' } 또는 { success: true, detailImageUrl: '...' }
          } catch (error) {
            reject(error);
          }
        };
        reader.onerror = (error) => reject(error);
      });
    },

    async saveProduct() {
      this.isSaving = true;
      try {
        const productId = this.isNew
          ? doc(collection(db, "products")).id
          : this.product.id;
          
        let imageUrl = this.product.imageUrl;
        let detailImageUrl = this.product.detailImageUrl;

        // 1. 메인 이미지 업로드
        if (this.selectedFile) {
          if (this.isNew && !this.selectedFile) {
            alert("새 상품 등록 시에는 이미지가 필수입니다.");
            this.isSaving = false;
            return;
          }
          // [수정] uploadProductImage 함수를 호출 (백엔드에 이 함수가 존재해야 함)
          const result = await this.uploadImage(this.selectedFile, productId, "uploadProductImage");
          imageUrl = result.imageUrl;
        }

        // 2. 상세 이미지 업로드
        if (this.selectedDetailFile) {
          // [수정] 새로 만든 uploadProductDetailImage 함수를 호출
          const result = await this.uploadImage(this.selectedDetailFile, productId, "uploadProductDetailImage");
          detailImageUrl = result.detailImageUrl;
        }

        // 3. 데이터 저장
        const dataToSave = { 
          ...this.product, 
          imageUrl: imageUrl,
          detailImageUrl: detailImageUrl // 상세 이미지 URL 저장
        };

        if (this.isNew) {
          dataToSave.createdAt = serverTimestamp();
          await setDoc(doc(db, "products", productId), dataToSave); // ID를 지정하여 생성
          alert("새 상품이 등록되었습니다.");
        } else {
          const productRef = doc(db, "products", this.product.id);
          delete dataToSave.id;
          await setDoc(productRef, dataToSave, { merge: true });
          alert("상품 정보가 수정되었습니다.");
        }

        this.$emit("product-saved");
        this.$emit("close");
      } catch (error) {
        console.error("상품 저장 오류:", error);
        alert(`상품 저장에 실패했습니다: ${error.message}`);
      } finally {
        this.isSaving = false;
      }
    },
  },
};
</script>

<style scoped>
/* 기존 스타일과 동일 */
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
  max-height: 70vh;
  overflow-y: auto;
}
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 15px 20px;
  border-top: 1px solid #eee;
}
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
.form-group {
  margin-bottom: 15px;
}
.form-group label {
  display: block;
  font-weight: bold;
  margin-bottom: 5px;
}
.form-group input,
.form-group textarea,
.form-group select {
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
