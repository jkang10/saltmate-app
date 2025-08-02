<template>
  <div class="management-container">
    <h2><i class="fas fa-check-double"></i> 구독 신청 관리</h2>
    <div v-if="isLoading" class="loading">불러오는 중...</div>
    <div v-else>
      <table class="request-table">
        <thead>
          <tr>
            <th>신청일시</th>
            <th>신청자명</th>
            <th>신청 등급</th>
            <th>금액</th>
            <th>상태</th>
            <th>관리</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="req in requests" :key="req.id">
            <td>{{ formatDate(req.createdAt) }}</td>
            <td>{{ req.userName }}</td>
            <td>{{ req.requestedTier }}</td>
            <td>{{ req.requestedAmount.toLocaleString() }} 원</td>
            <td>
              <span class="status pending">{{ req.status }}</span>
            </td>
            <td>
              <button @click="approveRequest(req.id)" class="btn approve">
                승인
              </button>
              <button @click="rejectRequest(req.id)" class="btn reject">
                거절
              </button>
            </td>
          </tr>
          <tr v-if="requests.length === 0">
            <td colspan="6">대기 중인 신청이 없습니다.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
import { db } from "@/firebaseConfig";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
} from "firebase/firestore";
import { ref, onUnmounted } from "vue";

export default {
  name: "SubscriptionManagement",
  setup() {
    const requests = ref([]);
    const isLoading = ref(true);
    let unsubscribe = null;

    const q = query(
      collection(db, "subscription_requests"),
      where("status", "==", "pending"),
    );
    unsubscribe = onSnapshot(q, (querySnapshot) => {
      requests.value = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      isLoading.value = false;
    });

    onUnmounted(() => {
      if (unsubscribe) unsubscribe();
    });

    const approveRequest = async (id) => {
      if (confirm("이 구독 신청을 승인하시겠습니까?")) {
        const reqDoc = doc(db, "subscription_requests", id);
        await updateDoc(reqDoc, { status: "approved" });
        alert("승인 처리되었습니다.");
      }
    };

    const rejectRequest = async (id) => {
      if (confirm("이 구독 신청을 거절하시겠습니까?")) {
        const reqDoc = doc(db, "subscription_requests", id);
        await updateDoc(reqDoc, { status: "rejected" });
        alert("거절 처리되었습니다.");
      }
    };

    const formatDate = (timestamp) => {
      if (!timestamp) return "";
      return new Date(timestamp.seconds * 1000).toLocaleString("ko-KR");
    };

    return { requests, isLoading, approveRequest, rejectRequest, formatDate };
  },
};
</script>

<style scoped>
/* 관리자 페이지에 어울리는 스타일 */
.management-container {
  padding: 20px;
}
.request-table {
  width: 100%;
  border-collapse: collapse;
}
.request-table th,
.request-table td {
  border: 1px solid #ddd;
  padding: 12px;
  text-align: center;
}
.request-table th {
  background-color: #f2f2f2;
}
.status.pending {
  color: #ff9800;
  font-weight: bold;
}
.btn {
  padding: 8px 12px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  color: white;
  margin: 0 5px;
}
.btn.approve {
  background-color: #4caf50;
}
.btn.reject {
  background-color: #f44336;
}
</style>
