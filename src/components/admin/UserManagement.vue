<template>
  <div class="user-management">
    <h3><i class="fas fa-users-cog"></i> 회원 관리</h3>
    <p>회원 목록을 조회하고 사용자 권한을 관리합니다.</p>

    <div v-if="loading" class="loading-spinner"></div>
    <div v-if="error" class="error-state">
      <p>데이터를 불러오는 중 오류가 발생했습니다.</p>
      <p class="error-details">{{ error }}</p>
    </div>

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
          <td class="actions">
            <button @click="openTokenModal(user)" class="btn btn-sm btn-info">
              토큰 관리
            </button>
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

    <TokenTransferModal
      v-if="isTokenModalVisible"
      :user="selectedUser"
      @close="isTokenModalVisible = false"
      @token-updated="fetchUsers"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { db } from "@/firebaseConfig";
import { collection, getDocs, doc, deleteDoc } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
// [신규] 모달 컴포넌트 임포트
import TokenTransferModal from "./TokenTransferModal.vue";

const users = ref([]);
const loading = ref(true);
const error = ref(null);

// [신규] 모달 상태 관리를 위한 변수 추가
const isTokenModalVisible = ref(false);
const selectedUser = ref(null);

const formatDate = (timestamp) => {
  if (!timestamp || !timestamp.toDate) return "날짜 정보 없음";
  return timestamp.toDate().toLocaleDateString("ko-KR");
};

const fetchUsers = async () => {
  loading.value = true;
  try {
    const querySnapshot = await getDocs(collection(db, "users"));
    users.value = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (err) {
    console.error("사용자 정보를 불러오는 중 오류 발생:", err);
    error.value = "사용자 정보를 불러오는 데 실패했습니다.";
  } finally {
    loading.value = false;
  }
};

const toggleAdmin = async (user) => {
  const newStatus = !user.isAdmin;
  const confirmation = confirm(
    `'${user.name}' 사용자를 '${
      newStatus ? "관리자" : "일반 사용자"
    }' (으)로 지정하시겠습니까?`,
  );
  if (!confirmation) return;
  try {
    const functions = getFunctions();
    const setUserAdminClaim = httpsCallable(functions, "setUserAdminClaim");
    await setUserAdminClaim({ email: user.email, makeAdmin: newStatus });
    user.isAdmin = newStatus;
    alert(
      "사용자 권한이 성공적으로 변경되었습니다. \n해당 사용자는 로그아웃 후 다시 로그인해야 권한이 적용됩니다.",
    );
  } catch (error) {
    console.error("권한 변경 중 오류 발생:", error);
    alert(`권한 변경에 실패했습니다: ${error.message}`);
  }
};

const deleteUser = async (userId) => {
  if (!confirm("정말로 이 사용자를 삭제하시겠습니까?")) return;
  try {
    // 참고: Firestore DB 문서만 삭제합니다. Authentication 계정은 별도 삭제가 필요합니다.
    await deleteDoc(doc(db, "users", userId));
    users.value = users.value.filter((user) => user.id !== userId);
    alert("사용자가 성공적으로 삭제되었습니다.");
  } catch (error) {
    console.error("사용자 삭제 중 오류 발생:", error);
    alert("사용자 삭제에 실패했습니다.");
  }
};

// [신규] 모달을 열기 위한 메소드 추가
const openTokenModal = (user) => {
  selectedUser.value = user;
  isTokenModalVisible.value = true;
};

onMounted(() => {
  fetchUsers();
});
</script>

<style scoped>
/* 기존 스타일과 동일하되, 버튼 색상 및 간격 등 추가 */
.user-management {
  background-color: #fff;
  padding: 30px;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
}
.user-management h3 {
  margin-bottom: 20px;
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
  background-color: #dc3545;
}
.user-badge {
  background-color: #007bff;
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
.btn-info {
  background-color: #17a2b8;
  color: white;
} /* 토큰 관리 버튼 색상 */
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
.no-data,
.error-state {
  text-align: center;
  padding: 50px;
  color: #777;
}
.error-state .error-details {
  color: #dc3545;
  font-size: 0.9em;
}
.actions button {
  margin-right: 5px;
}
.actions button:last-child {
  margin-right: 0;
}
</style>
