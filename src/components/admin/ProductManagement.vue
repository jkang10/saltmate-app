<template>
  <div class="management-container">
    <h3><i class="fas fa-box-open"></i> 상품 관리</h3>
    <p>상품을 등록, 수정, 삭제합니다.</p>

    <div class="product-form card">
      <h4>{{ isEditing ? "상품 수정" : "새 상품 등록" }}</h4>
      <form @submit.prevent="handleSubmit">
        <div class="form-group">
          <label for="name">상품명</label>
          <input type="text" v-model="currentProduct.name" required />
        </div>
        <div class="form-group">
          <label for="description">상품 설명</label>
          <textarea
            v-model="currentProduct.description"
            rows="4"
            required
          ></textarea>
        </div>
        <div class="form-group-inline">
          <div class="form-group">
            <label for="price">가격 (원)</label>
            <input
              type="number"
              v-model.number="currentProduct.price"
              required
            />
          </div>
          <div class="form-group">
            <label for="stock">재고</label>
            <input
              type="number"
              v-model.number="currentProduct.stock"
              required
            />
          </div>
        </div>
        <div class="form-group">
          <label for="image">상품 이미지</label>
          <input type="file" @change="handleImageUpload" accept="image/*" />
          <div v-if="!isEditing && imageFile" class="image-preview">
            <img :src="createObjectURL(imageFile)" alt="미리보기" />
          </div>
          <div
            v-if="isEditing && currentProduct.imageUrl"
            class="image-preview"
          >
            <p>현재 이미지:</p>
            <img :src="currentProduct.imageUrl" alt="상품 이미지" />
          </div>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">
            {{ isEditing ? "수정 완료" : "상품 등록" }}
          </button>
          <button
            v-if="isEditing"
            type="button"
            @click="cancelEdit"
            class="btn btn-secondary"
          >
            취소
          </button>
        </div>
      </form>
    </div>

    <div class="product-list card">
      <h4>상품 목록</h4>
      <div v-if="loading" class="loading-spinner"></div>
      <table v-else-if="products.length > 0" class="product-table">
        <thead>
          <tr>
            <th>이미지</th>
            <th>상품명</th>
            <th>가격</th>
            <th>재고</th>
            <th>관리</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="product in products" :key="product.id">
            <td>
              <img
                :src="product.imageUrl"
                alt="상품 이미지"
                class="table-img"
              />
            </td>
            <td>{{ product.name }}</td>
            <td>{{ formatCurrency(product.price) }}</td>
            <td>{{ product.stock }} 개</td>
            <td>
              <button
                @click="editProduct(product)"
                class="btn btn-sm btn-secondary"
              >
                수정
              </button>
              <button
                @click="deleteProduct(product)"
                class="btn btn-sm btn-danger"
              >
                삭제
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else class="no-data">등록된 상품이 없습니다.</div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from "vue";
import { db, storage } from "@/firebaseConfig";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  orderBy,
  query,
} from "firebase/firestore";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";

// --- State ---
const products = ref([]);
const loading = ref(true);
const isEditing = ref(false);
const imageFile = ref(null);
const defaultProduct = {
  id: null,
  name: "",
  description: "",
  price: 0,
  stock: 0,
  imageUrl: "",
  imagePath: "",
};
const currentProduct = reactive({ ...defaultProduct });

// --- Helper Functions ---
const formatCurrency = (value) =>
  new Intl.NumberFormat("ko-KR").format(value) + "원";
const createObjectURL = (file) => (file ? URL.createObjectURL(file) : "");

// --- Event Handlers ---
const handleImageUpload = (event) => {
  imageFile.value = event.target.files[0];
};

const handleSubmit = async () => {
  if (isEditing.value) {
    await updateExistingProduct();
  } else {
    await createNewProduct();
  }
};

const editProduct = (product) => {
  isEditing.value = true;
  Object.assign(currentProduct, product);
  imageFile.value = null; // 수정 모드 시작 시 파일 선택 초기화
};

const cancelEdit = () => {
  isEditing.value = false;
  Object.assign(currentProduct, defaultProduct);
  imageFile.value = null;
};

// --- Firestore & Storage Functions ---
const fetchProducts = async () => {
  loading.value = true;
  try {
    const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    products.value = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("Error fetching products: ", error);
  } finally {
    loading.value = false;
  }
};

const createNewProduct = async () => {
  if (!imageFile.value) {
    alert("상품 이미지를 선택해주세요.");
    return;
  }
  try {
    // 1. 이미지 업로드
    const imagePath = `products/${Date.now()}_${imageFile.value.name}`;
    const sRef = storageRef(storage, imagePath);
    await uploadBytes(sRef, imageFile.value);
    const imageUrl = await getDownloadURL(sRef);

    // 2. Firestore에 데이터 저장
    await addDoc(collection(db, "products"), {
      name: currentProduct.name,
      description: currentProduct.description,
      price: currentProduct.price,
      stock: currentProduct.stock,
      imageUrl,
      imagePath, // 이미지 경로도 저장 (나중에 삭제 시 필요)
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    alert("상품이 성공적으로 등록되었습니다.");
    cancelEdit();
    await fetchProducts();
  } catch (error) {
    console.error("Error creating product: ", error);
  }
};

const updateExistingProduct = async () => {
  let imageUrl = currentProduct.imageUrl;
  let imagePath = currentProduct.imagePath;

  try {
    // 새 이미지가 선택된 경우에만 업로드
    if (imageFile.value) {
      // 기존 이미지 삭제
      if (currentProduct.imagePath) {
        await deleteObject(storageRef(storage, currentProduct.imagePath));
      }
      // 새 이미지 업로드
      imagePath = `products/${Date.now()}_${imageFile.value.name}`;
      const sRef = storageRef(storage, imagePath);
      await uploadBytes(sRef, imageFile.value);
      imageUrl = await getDownloadURL(sRef);
    }

    // Firestore 데이터 업데이트
    const productRef = doc(db, "products", currentProduct.id);
    await updateDoc(productRef, {
      name: currentProduct.name,
      description: currentProduct.description,
      price: currentProduct.price,
      stock: currentProduct.stock,
      imageUrl,
      imagePath,
      updatedAt: serverTimestamp(),
    });

    alert("상품이 성공적으로 수정되었습니다.");
    cancelEdit();
    await fetchProducts();
  } catch (error) {
    console.error("Error updating product: ", error);
  }
};

const deleteProduct = async (product) => {
  if (!confirm(`'${product.name}' 상품을 정말로 삭제하시겠습니까?`)) return;
  try {
    // 1. Storage에서 이미지 삭제
    if (product.imagePath) {
      await deleteObject(storageRef(storage, product.imagePath));
    }
    // 2. Firestore에서 문서 삭제
    await deleteDoc(doc(db, "products", product.id));

    alert("상품이 성공적으로 삭제되었습니다.");
    await fetchProducts();
  } catch (error) {
    console.error("Error deleting product: ", error);
  }
};

onMounted(fetchProducts);
</script>

<style scoped>
/* 이전 컴포넌트들과 유사한 스타일 */
.management-container {
  display: flex;
  flex-direction: column;
  gap: 30px;
}
.card {
  background-color: #fff;
  padding: 30px;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
}
h3,
h4 {
  margin-top: 0;
}

.product-form .form-group {
  margin-bottom: 20px;
}
.product-form .form-group-inline {
  display: flex;
  gap: 20px;
}
.product-form .form-group-inline .form-group {
  flex: 1;
}
.product-form label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
}
.product-form input,
.product-form textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 5px;
  box-sizing: border-box;
}
.image-preview {
  margin-top: 10px;
}
.image-preview img {
  max-width: 200px;
  max-height: 200px;
  border: 1px solid #ddd;
  border-radius: 5px;
}
.form-actions {
  display: flex;
  gap: 10px;
}

.product-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 20px;
}
.product-table th,
.product-table td {
  border-bottom: 1px solid #eee;
  padding: 12px;
  text-align: left;
  vertical-align: middle;
}
.product-table .table-img {
  width: 60px;
  height: 60px;
  object-fit: cover;
  border-radius: 5px;
}

.btn {
  border: none;
  border-radius: 5px;
  padding: 10px 20px;
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
.btn-danger {
  background-color: #dc3545;
  color: white;
}
.btn-sm {
  padding: 5px 10px;
  font-size: 0.85em;
  margin-right: 5px;
}

.loading-spinner,
.no-data {
  text-align: center;
  padding: 50px;
  color: #777;
}
/* ... (로딩 스피너 @keyframes) ... */
</style>
