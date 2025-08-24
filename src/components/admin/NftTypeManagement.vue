<template>
  <div class="management-container">
    <h3><i class="fas fa-cubes"></i> NFT 종류 관리</h3>
    <p>
      마켓플레이스에서 사용될 NFT의 종류(템플릿)를 관리합니다. 여기에 등록된
      정보를 바탕으로 NFT가 발행됩니다.
    </p>

    <div class="type-form card">
      <h4>{{ editingType ? "NFT 종류 수정" : "새로운 NFT 종류 추가" }}</h4>
      <form @submit.prevent="saveNftType">
        <div class="form-grid">
          <div class="form-group">
            <label for="typeName">이름 (Type Name)</label>
            <input
              id="typeName"
              v-model="form.name"
              placeholder="예: 해양심층수 워터"
              required
            />
          </div>
          <div class="form-group">
            <label for="typeTier">등급 (Tier)</label>
            <select id="typeTier" v-model="form.tier" required>
              <option>GOLD</option>
              <option>DIAMOND</option>
              <option>PLATINUM</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label for="typeDesc">설명</label>
          <textarea
            id="typeDesc"
            v-model="form.description"
            placeholder="NFT 뒷면에 표시될 설명"
            rows="3"
          ></textarea>
        </div>
        <div class="form-group">
          <label for="typeImg">이미지 URL</label>
          <input
            id="typeImg"
            v-model="form.imageUrl"
            placeholder="https://example.com/image.png"
            type="url"
            required
          />
        </div>
        <div class="form-actions">
          <button
            type="submit"
            class="btn btn-primary"
            :disabled="isProcessing"
          >
            {{ editingType ? "수정사항 저장" : "새 종류 추가" }}
          </button>
          <button
            type="button"
            class="btn btn-secondary"
            @click="cancelEdit"
            v-if="editingType"
          >
            취소
          </button>
        </div>
      </form>
    </div>

    <div class="type-list card">
      <h4>등록된 NFT 종류 목록</h4>
      <div v-if="loading" class="loading-spinner"></div>
      <table v-else-if="nftTypes.length > 0" class="type-table">
        <thead>
          <tr>
            <th>이름</th>
            <th>등급</th>
            <th>설명</th>
            <th>이미지</th>
            <th>관리</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="type in nftTypes" :key="type.id">
            <td>{{ type.name }}</td>
            <td>
              <span :class="['nft-tier-badge', type.tier]">{{
                type.tier
              }}</span>
            </td>
            <td>{{ type.description }}</td>
            <td>
              <img
                :src="type.imageUrl"
                :alt="type.name"
                class="thumbnail"
                v-if="type.imageUrl"
              />
            </td>
            <td>
              <button @click="editType(type)" class="btn btn-sm btn-secondary">
                수정
              </button>
              <button
                @click="deleteType(type.id, type.name)"
                class="btn btn-sm btn-danger"
              >
                삭제
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else class="no-data">등록된 NFT 종류가 없습니다.</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive } from "vue";
import { db } from "@/firebaseConfig";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  addDoc,
  deleteDoc,
} from "firebase/firestore";

const nftTypes = ref([]);
const loading = ref(true);
const isProcessing = ref(false);
const editingType = ref(null);

const defaultForm = { name: "", tier: "GOLD", description: "", imageUrl: "" };
const form = reactive({ ...defaultForm });

const fetchNftTypes = async () => {
  loading.value = true;
  try {
    const querySnapshot = await getDocs(collection(db, "nftTypes"));
    nftTypes.value = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("NFT 종류 목록을 불러오는 중 오류 발생:", error);
  } finally {
    loading.value = false;
  }
};

const saveNftType = async () => {
  isProcessing.value = true;
  try {
    if (editingType.value) {
      // 수정 모드
      const typeRef = doc(db, "nftTypes", editingType.value.id);
      await setDoc(typeRef, form);
      alert("NFT 종류가 성공적으로 수정되었습니다.");
    } else {
      // 생성 모드
      await addDoc(collection(db, "nftTypes"), form);
      alert("새로운 NFT 종류가 성공적으로 추가되었습니다.");
    }
    cancelEdit();
    await fetchNftTypes();
  } catch (error) {
    console.error("NFT 종류 저장 중 오류 발생:", error);
    alert("처리 중 오류가 발생했습니다.");
  } finally {
    isProcessing.value = false;
  }
};

const deleteType = async (id, name) => {
  if (!confirm(`'${name}' NFT 종류를 정말로 삭제하시겠습니까?`)) return;
  try {
    await deleteDoc(doc(db, "nftTypes", id));
    alert("NFT 종류가 삭제되었습니다.");
    await fetchNftTypes();
  } catch (error) {
    console.error("NFT 종류 삭제 중 오류 발생:", error);
    alert("삭제 중 오류가 발생했습니다.");
  }
};

const editType = (type) => {
  editingType.value = type;
  Object.assign(form, type);
};

const cancelEdit = () => {
  editingType.value = null;
  Object.assign(form, defaultForm);
};

onMounted(fetchNftTypes);
</script>

<style scoped>
/* (기존 NFTManagement.vue와 유사한 스타일) */
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
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}
.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 20px;
}
.form-group label {
  font-weight: 600;
}
.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 5px;
  box-sizing: border-box;
}
.form-actions {
  display: flex;
  gap: 10px;
}
.type-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 20px;
}
.type-table th,
.type-table td {
  border-bottom: 1px solid #eee;
  padding: 12px 15px;
  text-align: left;
  vertical-align: middle;
}
.type-table th {
  background-color: #f8f9fa;
}
.thumbnail {
  width: 40px;
  height: 40px;
  object-fit: cover;
  border-radius: 4px;
}
.btn,
.btn-primary,
.btn-danger,
.btn-sm,
.btn-secondary {
  padding: 8px 12px;
  border-radius: 5px;
  border: none;
  cursor: pointer;
  font-weight: 500;
}
.btn-primary {
  background-color: #007bff;
  color: white;
}
.btn-danger {
  background-color: #dc3545;
  color: white;
}
.btn-secondary {
  background-color: #6c757d;
  color: white;
}
.btn-sm {
  padding: 5px 10px;
  font-size: 0.9em;
  margin-right: 5px;
}
.nft-tier-badge {
  display: inline-block;
  padding: 5px 12px;
  border-radius: 15px;
  font-size: 0.8em;
  font-weight: bold;
}
.nft-tier-badge.GOLD {
  background-color: #ffd700;
  color: #333;
}
.nft-tier-badge.DIAMOND {
  background-color: #b9f2ff;
  color: #333;
}
.nft-tier-badge.PLATINUM {
  background-color: #e5e4e2;
  color: #333;
}
</style>
