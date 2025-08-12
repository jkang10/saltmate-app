<template>
  <div class="management-page">
    <h3><i class="fas fa-hand-holding-usd"></i> 출금 신청 관리</h3>
    <p>회원들의 현금성 수익 출금 신청 내역을 관리합니다.</p>

    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
    </div>
    <div v-else-if="requests.length === 0" class="empty-state">
      <p>대기 중인 출금 신청이 없습니다.</p>
    </div>
    <div v-else class="table-container">
      <table>
        <thead>
          <tr>
            <th>신청일시</th>
            <th>신청자</th>
            <th>신청 금액</th>
            <th>관리</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="req in requests" :key="req.id">
            <td>{{ formatDate(req.requestedAt) }}</td>
            <td>{{ req.userName }}</td>
            <td>{{ (req.amount || 0).toLocaleString() }} 원</td>
            <td class="actions-cell">
              <button
                @click="processRequest(req, 'completed')"
                class="btn-success btn-sm"
              >
                입금 완료
              </button>
              <button
                @click="processRequest(req, 'rejected')"
                class="btn-danger btn-sm"
              >
                신청 거절
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
import { db } from "@/firebaseConfig";
// ▼▼▼ [수정됨] 사용하지 않는 getFunctions, httpsCallable 제거 ▼▼▼
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  orderBy,
  runTransaction,
  increment,
} from "firebase/firestore";

export default {
  name: "WithdrawalManagement",
  data() {
    return {
      requests: [],
      isLoading: true,
    };
  },
  async created() {
    await this.fetchRequests();
  },
  methods: {
    async fetchRequests() {
      this.isLoading = true;
      try {
        const q = query(
          collection(db, "withdrawalRequests"),
          where("status", "==", "pending"),
          orderBy("requestedAt", "asc"),
        );
        const querySnapshot = await getDocs(q);
        this.requests = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
      } catch (error) {
        console.error("출금 신청 목록 조회 오류:", error);
        alert("목록을 불러오는 데 실패했습니다.");
      } finally {
        this.isLoading = false;
      }
    },
    async processRequest(request, status) {
      const actionText = status === "completed" ? "입금 완료" : "신청 거절";
      if (
        !confirm(
          `'${request.userName}'님의 ${request.amount.toLocaleString()}원 신청을 '${actionText}' 처리하시겠습니까?`,
        )
      )
        return;

      try {
        const requestRef = doc(db, "withdrawalRequests", request.id);

        if (status === "rejected") {
          const userRef = doc(db, "users", request.userId);

          await runTransaction(db, async (transaction) => {
            transaction.update(requestRef, {
              status: "rejected",
              processedAt: new Date(),
            });
            transaction.update(userRef, {
              cashBalance: increment(request.amount),
            }); // 금액 복구
          });

          alert("신청이 거절 처리되었으며, 사용자에게 금액이 복구되었습니다.");
        } else {
          // 'completed'
          await updateDoc(requestRef, {
            status: "completed",
            processedAt: new Date(),
          });
          alert("입금 완료 처리되었습니다.");
        }

        await this.fetchRequests(); // 목록 새로고침
      } catch (error) {
        console.error("출금 처리 오류:", error);
        alert("처리 중 오류가 발생했습니다.");
      }
    },
    formatDate(timestamp) {
      return timestamp?.toDate().toLocaleString("ko-KR") || "";
    },
  },
};
</script>

<style scoped>
.management-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.table-container {
  overflow-x: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  text-align: center;
}
th,
td {
  padding: 12px 15px;
  border-bottom: 1px solid #eee;
  vertical-align: middle;
}
thead th {
  background-color: #f8f9fa;
  font-weight: bold;
}
.actions-cell button {
  margin: 0 4px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
}
.btn-sm {
  padding: 5px 10px;
  font-size: 0.9em;
}
.btn-success {
  background-color: #28a745;
  color: white;
}
.btn-danger {
  background-color: #dc3545;
  color: white;
}
.loading-state,
.empty-state {
  text-align: center;
  padding: 40px;
  color: #666;
}
.spinner {
  display: inline-block;
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-top: 4px solid #007bff;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
