<template>
  <div class="user-management">
    <h3><i class="fas fa-users-cog"></i> 회원 관리</h3>
    <p>회원 목록을 조회하고 사용자 권한을 관리합니다.</p>

    <div v-if="loading" class="loading-spinner"></div>

    <table v-if="!loading && users.length > 0" class="user-table">
      <thead>
        <tr>
          <th>이름</th>
          <th>이메일</th>
          <th>가입일</th>
          <th>관리자 여부</th>
          <th>관리</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="user in users" :key="user.id">
          <td>{{ user.name }}</td>
          <td>{{ user.email }}</td>
          <td>{{ formatDate(user.createdAt) }}</td>
          <td>
            <span :class="user.isAdmin ? 'admin-badge' : 'user-badge'">
              {{ user.isAdmin ? "Admin" : "User" }}
            </span>
          </td>
          <td>
            <button @click="toggleAdmin(user)" class="btn btn-sm btn-secondary">
              권한 변경
            </button>
            <button @click="deleteUser(user.id)" class="btn btn-sm btn-danger">
              삭제
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <div v-if="!loading && users.length === 0" class="no-data">
      표시할 사용자가 없습니다.
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { db } from "@/firebaseConfig";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";

const users = ref([]);
const loading = ref(true);

// Firestore의 Timestamp 객체를 날짜 문자열로 변환하는 함수
const formatDate = (timestamp) => {
  if (!timestamp || !timestamp.toDate) return "날짜 정보 없음";
  return timestamp.toDate().toLocaleDateString("ko-KR");
};

// Firestore에서 모든 사용자 정보를 가져오는 함수
const fetchUsers = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, "users"));
    users.value = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("사용자 정보를 불러오는 중 오류 발생:", error);
    alert("사용자 정보를 불러오는 데 실패했습니다.");
  } finally {
    loading.value = false;
  }
};

// 사용자의 관리자 권한을 토글(변경)하는 함수
const toggleAdmin = async (user) => {
  const confirmation = confirm(
    `'${user.name}' 사용자의 권한을 '${
      user.isAdmin ? "일반 사용자" : "관리자"
    }' (으)로 변경하시겠습니까?`
  );
  if (!confirmation) return;

  try {
    const userRef = doc(db, "users", user.id);
    await updateDoc(userRef, {
      isAdmin: !user.isAdmin,
    });
    // 화면에 즉시 반영
    user.isAdmin = !user.isAdmin;
    alert("사용자 권한이 성공적으로 변경되었습니다.");
  } catch (error) {
    console.error("권한 변경 중 오류 발생:", error);
    alert("권한 변경에 실패했습니다.");
  }
};

// Firestore에서 사용자를 삭제하는 함수
const deleteUser = async (userId) => {
  const confirmation = confirm(
    "정말로 이 사용자를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
  );
  if (!confirmation) return;

  try {
    await deleteDoc(doc(db, "users", userId));
    // 화면에서 즉시 제거
    users.value = users.value.filter((user) => user.id !== userId);
    alert("사용자가 성공적으로 삭제되었습니다.");
  } catch (error) {
    console.error("사용자 삭제 중 오류 발생:", error);
    alert("사용자 삭제에 실패했습니다.");
  }
};

// 컴포넌트가 마운트될 때 사용자 정보를 가져옴
onMounted(() => {
  fetchUsers();
});
</script>

<style scoped>
.user-management {
  background-color: #fff;
  padding: 30px;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
}
.user-management h3 {
  margin-bottom: 20px;
  <div class="admin-section">
    <h3><i class="fas fa-users"></i> 회원 관리</h3>
    <p>여기에 회원 목록을 표시하고, 검색, 수정, 삭제 기능을 구현합니다.</p>
  </div>
</template>

<script>
export default {
  name: "UserManagement",
};
</script>

<style scoped>
.admin-section {
  padding: 20px;
  border: 1px solid #eee;
  border-radius: 8px;
  background-color: #f9f9f9;
}
.admin-section h3 {
  color: #333;
  margin-bottom: 15px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.user-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 20px;
}
.user-table th,
.user-table td {
  border-bottom: 1px solid #eee;
  padding: 12px 15px;
  text-align: left;
  vertical-align: middle;
}
.user-table th {
  background-color: #f8f9fa;
  font-weight: 600;
  color: #555;
}
.admin-badge,
.user-badge {
  padding: 4px 8px;
  border-radius: 5px;
  font-size: 0.8em;
  font-weight: bold;
  color: #fff;
}
.admin-badge {
  background-color: #dc3545; /* 빨간색 */
}
.user-badge {
  background-color: #007bff; /* 파란색 */
}
.btn {
  border: none;
  border-radius: 5px;
  padding: 6px 12px;
  cursor: pointer;
  margin-right: 5px;
  transition: opacity 0.2s;
}
.btn:hover {
  opacity: 0.8;
}
.btn-sm {
  font-size: 0.85em;
}
.btn-secondary {
  background-color: #6c757d;
  color: white;
}
.btn-danger {
  background-color: #dc3545;
  color: white;
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
.no-data {
  text-align: center;
  padding: 50px;
  color: #777;
.admin-section p {
  color: #666;
}
</style>
