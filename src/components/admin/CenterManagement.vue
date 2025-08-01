<template>
  <div class="management-container">
    <h3><i class="fas fa-map-marker-alt"></i> 지역(센터) 관리</h3>
    <p>회원가입 시 선택할 수 있는 지역(센터) 목록을 관리합니다.</p>

    <div class="form-card card">
      <h4>새 센터 추가</h4>
      <form @submit.prevent="addCenter" class="center-form">
        <input
          v-model="newCenterName"
          placeholder="센터 이름 (예: 서울센터)"
          required
        />
        <button type="submit" class="btn btn-primary">추가</button>
      </form>
    </div>

    <div class="list-card card">
      <h4>센터 목록</h4>
      <ul v-if="centers.length > 0" class="center-list">
        <li v-for="center in centers" :key="center.id">
          <span>{{ center.name }}</span>
          <button
            @click="deleteCenter(center.id)"
            class="btn btn-sm btn-danger"
          >
            삭제
          </button>
        </li>
      </ul>
      <p v-else>등록된 센터가 없습니다.</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { db } from "@/firebaseConfig";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";

const centers = ref([]);
const newCenterName = ref("");

const fetchCenters = async () => {
  const querySnapshot = await getDocs(collection(db, "centers"));
  centers.value = querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
};

const addCenter = async () => {
  if (!newCenterName.value.trim()) return;
  await addDoc(collection(db, "centers"), {
    name: newCenterName.value,
    createdAt: serverTimestamp(),
  });
  newCenterName.value = "";
  await fetchCenters();
};

const deleteCenter = async (id) => {
  if (!confirm("정말로 이 센터를 삭제하시겠습니까?")) return;
  await deleteDoc(doc(db, "centers", id));
  await fetchCenters();
};

onMounted(fetchCenters);
</script>

<style scoped>
.center-form {
  display: flex;
  gap: 10px;
}
.center-form input {
  flex-grow: 1;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 5px;
}
.center-list {
  list-style: none;
  padding: 0;
}
.center-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  border-bottom: 1px solid #eee;
}
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

.order-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 20px;
}
.order-table th,
.order-table td {
  border-bottom: 1px solid #eee;
  padding: 12px 15px;
  text-align: left;
  vertical-align: middle;
}
.order-table th {
  background-color: #f8f9fa;
}

/* 상태 변경 드롭다운 */
.status-select {
  padding: 6px 10px;
  border-radius: 5px;
  border: 1px solid #ccc;
  background-color: #fff;
  cursor: pointer;
}
.status-select:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

/* 로딩 및 데이터 없음 스타일 */
.loading-spinner,
.no-data {
  text-align: center;
  padding: 50px;
  color: #777;
}
.loading-spinner {
  border: 4px solid rgba(0, 0, 0, 0.1);
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border-left-color: #007bff;
  animation: spin 1s ease infinite;
  margin: 50px auto;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
