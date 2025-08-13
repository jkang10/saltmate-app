<template>
  <div class="user-management">
    <h3><i class="fas fa-users-cog"></i> 회원 관리</h3>
    <p>회원 목록을 조회하고 사용자 잔액, 토큰 및 권한을 관리합니다.</p>

    <div class="filter-controls">
      <input
        type="text"
        v-model="searchTerm"
        placeholder="이름 또는 이메일로 검색..."
        class="search-input"
      />
    </div>

    <div v-if="loading" class="loading-spinner"></div>
    <div v-if="error" class="error-state">
      <p>{{ error }}</p>
    </div>

    <div v-if="!loading && paginatedUsers.length > 0" class="table-container">
      <table class="user-table">
        <thead>
          <tr>
            <th>이름</th>
            <th>이메일</th>
            <th>가입일</th>
            <th>현금성 수익</th>
            <th>솔트메이트</th>
            <th>관리자</th>
            <th>관리</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in paginatedUsers" :key="user.id">
            <td>{{ user.name }}</td>
            <td>{{ user.email }}</td>
            <td>{{ formatDate(user.createdAt) }}</td>
            <td>{{ (user.cashBalance || 0).toLocaleString() }} 원</td>
            <td>{{ (user.saltmatePoints || 0).toLocaleString() }} P</td>
            <td>
              <span :class="user.isAdmin ? 'admin-badge' : 'user-badge'">
                {{ user.isAdmin ? "Admin" : "User" }}
              </span>
            </td>
            <td class="actions">
              <button
                @click="openBalanceModal(user)"
                class="btn btn-sm btn-success"
              >
                잔액 조정
              </button>
              <button @click="openTokenModal(user)" class="btn btn-sm btn-info">
                토큰 관리
              </button>
              <button
                @click="toggleAdmin(user)"
                class="btn btn-sm btn-secondary"
              >
                권한 변경
              </button>
              <button
                @click="deleteUser(user.id)"
                class="btn btn-sm btn-danger"
              >
                삭제
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="!loading && filteredUsers.length === 0" class="no-data">
      표시할 사용자가 없습니다.
    </div>

    <div v-if="totalPages > 1" class="pagination">
      <button @click="currentPage--" :disabled="currentPage === 1">이전</button>
      <span>{{ currentPage }} / {{ totalPages }}</span>
      <button @click="currentPage++" :disabled="currentPage === totalPages">
        다음
      </button>
    </div>

    <TokenTransferModal
      v-if="isTokenModalVisible"
      :user="selectedUser"
      @close="isTokenModalVisible = false"
      @token-updated="fetchUsers"
    />
    <BalanceAdjustmentModal
      v-if="isBalanceModalVisible"
      :user="selectedUser"
      @close="isBalanceModalVisible = false"
      @balance-updated="fetchUsers"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from "vue";
import { db } from "@/firebaseConfig";
import {
  collection,
  getDocs,
  doc,
  deleteDoc,
  query,
  orderBy,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import TokenTransferModal from "./TokenTransferModal.vue";
import BalanceAdjustmentModal from "./BalanceAdjustmentModal.vue";

const users = ref([]);
const loading = ref(true);
const error = ref(null);
const searchTerm = ref("");
const currentPage = ref(1);
const itemsPerPage = ref(10); // 한 페이지에 표시할 회원 수
const isTokenModalVisible = ref(false);
const isBalanceModalVisible = ref(false);
const selectedUser = ref(null);

const filteredUsers = computed(() => {
  if (!searchTerm.value) {
    return users.value;
  }
  return users.value.filter(
    (user) =>
      user.name.toLowerCase().includes(searchTerm.value.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.value.toLowerCase()),
  );
});

const totalPages = computed(() => {
  return Math.ceil(filteredUsers.value.length / itemsPerPage.value);
});

const paginatedUsers = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value;
  const end = start + itemsPerPage.value;
  return filteredUsers.value.slice(start, end);
});

const formatDate = (timestamp) => {
  if (!timestamp || !timestamp.toDate) return "날짜 정보 없음";
  return timestamp.toDate().toLocaleDateString("ko-KR");
};

const fetchUsers = async () => {
  loading.value = true;
  try {
    const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
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
    // 백엔드 함수에 makeAdmin 파라미터를 전달해야 할 수 있습니다. (index.js 확인 필요)
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

const openTokenModal = (user) => {
  selectedUser.value = user;
  isTokenModalVisible.value = true;
};

const openBalanceModal = (user) => {
  selectedUser.value = user;
  isBalanceModalVisible.value = true;
};

onMounted(fetchUsers);
</script>

<style scoped>
.user-management {
  background-color: #fff;
  padding: 30px;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
}
.user-management h3 {
  margin-top: 0;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.filter-controls {
  margin-bottom: 20px;
}
.search-input {
  padding: 10px 15px;
  border-radius: 8px;
  border: 1px solid #ccc;
  width: 100%;
  max-width: 400px;
  font-size: 1em;
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
  padding: 4px 10px;
  border-radius: 15px;
  font-size: 0.8em;
  font-weight: bold;
  color: #fff;
  display: inline-block;
}
.admin-badge {
  background-color: #dc3545;
}
.user-badge {
  background-color: #007bff;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
.btn {
  border: none;
  border-radius: 5px;
  padding: 6px 12px;
  cursor: pointer;
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
}
.btn-success {
  background-color: #28a745;
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
.no-data,
.error-state {
  text-align: center;
  padding: 50px;
  color: #777;
}
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  margin-top: 20px;
}
.pagination button {
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid #ddd;
  background-color: #fff;
  cursor: pointer;
}
.pagination button:disabled {
  background-color: #f8f9fa;
  cursor: not-allowed;
  opacity: 0.5;
}
.pagination span {
  font-weight: bold;
}
</style>
