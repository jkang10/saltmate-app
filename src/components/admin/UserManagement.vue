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
            <th>센터</th>
            <th>추천인</th>
            <th>가입일</th>
            <th>다음 결제일</th>
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
            <td>{{ user.centerName || "N/A" }}</td>
            <td>{{ user.referrerName || "없음" }}</td>
            <td>{{ formatDate(user.createdAt) }}</td>
            <td>{{ formatDate(user.nextPaymentDueDate) }}</td>
            <td>{{ (user.cashBalance || 0).toLocaleString() }} 원</td>
            <td>{{ (user.saltmatePoints || 0).toLocaleString() }} P</td>
            <td>
              <span :class="user.isAdmin ? 'admin-badge' : 'user-badge'">
                {{ user.isAdmin ? "Admin" : "User" }}
              </span>
            </td>
            <td class="actions">
              <button
                @click="openEditModal(user)"
                class="btn btn-sm btn-primary"
              >
                수정
              </button>
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
      <p>표시할 사용자가 없습니다.</p>
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
    <UserEditModal
      v-if="isEditModalVisible"
      :user="selectedUser"
      :allUsers="users.filter((u) => u.id !== selectedUser.id)"
      @close="isEditModalVisible = false"
      @user-updated="fetchUsers"
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
import UserEditModal from "./UserEditModal.vue";

const users = ref([]);
const loading = ref(true);
const error = ref(null);
const searchTerm = ref("");
const currentPage = ref(1);
const itemsPerPage = ref(10);
const isTokenModalVisible = ref(false);
const isBalanceModalVisible = ref(false);
const isEditModalVisible = ref(false);
const selectedUser = ref(null);

const filteredUsers = computed(() => {
  if (!searchTerm.value) {
    return users.value;
  }
  const lowerCaseSearch = searchTerm.value.toLowerCase();
  return users.value.filter(
    (user) =>
      (user.name && user.name.toLowerCase().includes(lowerCaseSearch)) ||
      (user.email && user.email.toLowerCase().includes(lowerCaseSearch)),
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
  if (!timestamp || !timestamp.toDate) return "정보 없음"; // '날짜 정보 없음'에서 변경
  return timestamp.toDate().toLocaleDateString("ko-KR");
};

const fetchUsers = async () => {
  loading.value = true;
  try {
    const usersQuery = query(
      collection(db, "users"),
      orderBy("createdAt", "desc"),
    );
    const centersQuery = query(collection(db, "centers"));

    const [userSnapshot, centerSnapshot] = await Promise.all([
      getDocs(usersQuery),
      getDocs(centersQuery),
    ]);

    const centerMap = new Map();
    centerSnapshot.forEach((doc) => {
      centerMap.set(doc.id, doc.data().name);
    });

    const userMap = new Map();
    userSnapshot.forEach((doc) => {
      userMap.set(doc.id, doc.data().name);
    });

    users.value = userSnapshot.docs.map((doc) => {
      const userData = doc.data();
      return {
        id: doc.id,
        ...userData,
        centerName: centerMap.get(userData.centerId) || "N/A",
        referrerName: userMap.get(userData.uplineReferrer) || "없음",
      };
    });
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
    `'${user.name}' 사용자를 '${newStatus ? "관리자" : "일반 사용자"}' (으)로 지정하시겠습니까?`,
  );
  if (!confirmation) return;
  try {
    const functions = getFunctions();
    const setUserAdminClaim = httpsCallable(functions, "setUserAdminClaim");
    await setUserAdminClaim({ email: user.email, makeAdmin: newStatus });

    const userInList = users.value.find((u) => u.id === user.id);
    if (userInList) userInList.isAdmin = newStatus;
    alert(
      "사용자 권한이 성공적으로 변경되었습니다. \n해당 사용자는 로그아웃 후 다시 로그인해야 권한이 적용됩니다.",
    );
  } catch (error) {
    console.error("권한 변경 중 오류 발생:", error);
    alert(`권한 변경에 실패했습니다: ${error.message}`);
  }
};

const deleteUser = async (userId) => {
  if (!confirm("정말로 이 사용자를 삭제하시겠습니까? (복구 불가)")) return;
  try {
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

const openEditModal = (user) => {
  selectedUser.value = user;
  isEditModalVisible.value = true;
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
.table-container {
  overflow-x: auto;
}
.user-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 20px;
  font-size: 0.9em;
}
.user-table th,
.user-table td {
  border-bottom: 1px solid #eee;
  padding: 8px 10px;
  text-align: center;
  vertical-align: middle;
  white-space: nowrap;
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
  justify-content: center;
}
.btn {
  border: none;
  border-radius: 5px;
  padding: 5px 10px;
  cursor: pointer;
  transition: opacity 0.2s;
  font-weight: 500;
  min-width: 60px;
}
.btn:hover {
  opacity: 0.8;
}
.btn-sm {
  font-size: 0.85em;
}
.btn-primary {
  background-color: #0d6efd;
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
.btn-info {
  background-color: #0dcaf0;
  color: white;
}
.btn-success {
  background-color: #198754;
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
