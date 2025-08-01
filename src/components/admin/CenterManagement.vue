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
      <div v-if="loading" class="loading-spinner"></div>
      <ul v-else-if="centers.length > 0" class="center-list">
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
      <p v-else class="no-data">등록된 센터가 없습니다.</p>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from "vue";
import { db } from "@/firebaseConfig";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  orderBy,
  query,
} from "firebase/firestore";

export default {
  name: "CenterManagement",
  setup() {
    const centers = ref([]);
    const newCenterName = ref("");
    const loading = ref(true);

    const fetchCenters = async () => {
      loading.value = true;
      try {
        const centersRef = collection(db, "centers");
        const q = query(centersRef, orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        centers.value = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
      } catch (error) {
        console.error("센터 목록 로딩 오류:", error);
      } finally {
        loading.value = false;
      }
    };

    const addCenter = async () => {
      if (!newCenterName.value.trim()) return;
      try {
        await addDoc(collection(db, "centers"), {
          name: newCenterName.value,
          createdAt: serverTimestamp(),
        });
        newCenterName.value = "";
        await fetchCenters();
      } catch (error) {
        console.error("센터 추가 오류:", error);
      }
    };

    const deleteCenter = async (id) => {
      if (!confirm("정말로 이 센터를 삭제하시겠습니까?")) return;
      try {
        await deleteDoc(doc(db, "centers", id));
        await fetchCenters();
      } catch (error) {
        console.error("센터 삭제 오류:", error);
      }
    };

    onMounted(fetchCenters);

    return {
      centers,
      newCenterName,
      loading,
      addCenter,
      deleteCenter,
    };
  },
};
</script>

<style scoped>
.management-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.card {
  background: #fff;
  padding: 25px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}
.center-form {
  display: flex;
  gap: 10px;
}
.center-form input {
  flex-grow: 1;
  padding: 10px 15px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 1em;
}
.center-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.center-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 5px;
  border-bottom: 1px solid #f0f0f0;
}
.center-list li:last-child {
  border-bottom: none;
}
.no-data,
.loading-spinner {
  text-align: center;
  padding: 40px;
  color: #888;
}
/* 버튼 스타일 (기존 관리자 페이지와 통일) */
.btn {
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: bold;
}
.btn-primary {
  background-color: #007bff;
  color: white;
}
.btn-danger {
  background-color: #dc3545;
  color: white;
}
.btn-sm {
  padding: 5px 10px;
  font-size: 0.85em;
}
</style>
