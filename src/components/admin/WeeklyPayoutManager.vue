<template>
  <div class="payout-manager">
    <h2><i class="fas fa-calendar-check"></i> 주간 정산 관리</h2>
    <p>
      생성된 주간 정산 내역을 확인하고 승인합니다. 누락된 정산은 수동으로 생성할
      수 있습니다.
    </p>

    <div class="search-controls card">
      <div class="date-picker-wrapper">
        <label for="payout-date">정산 주차 선택(일요일):</label>
        <input type="date" id="payout-date" v-model="selectedDate" />
      </div>
      <button
        @click="fetchRequestsByDate"
        class="btn-search"
        :disabled="isLoading"
      >
        <i class="fas fa-search"></i>
        {{ isLoading ? "조회 중..." : "조회하기" }}
      </button>
      <button
        @click="fetchPendingRequests"
        class="btn-pending"
        :disabled="isLoading"
      >
        <i class="fas fa-hourglass-half"></i> 현재 승인 대기 목록
      </button>
      <button
        @click="generateManualPayouts"
        class="btn-manual-generate"
        :disabled="isLoading"
      >
        <i class="fas fa-calculator"></i> 선택 주차 정산 생성
      </button>
    </div>

    <div class="table-container card">
      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <p>데이터를 불러오는 중입니다...</p>
      </div>
      <div v-else-if="requests.length === 0" class="empty-state">
        <p>
          <span v-if="searchMode === 'pending'"
            >현재 승인 대기 중인 정산 내역이 없습니다.</span
          >
          <span v-else>해당 날짜에 대한 정산 내역이 없습니다.</span>
        </p>
      </div>
      <table v-else class="payout-table">
        <thead>
          <tr>
            <th>주차 (ID)</th>
            <th>이름</th>
            <th>투자금 수익</th>
            <th>매칭 보너스</th>
            <th>총 보너스</th>
            <th>최종 지급액</th>
            <th>상태</th>
            <th>관리</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="req in requests" :key="req.id">
            <td>{{ req.weekId }}</td>
            <td>{{ req.userName }}</td>
            <td>{{ Math.floor(req.roiBonus).toLocaleString() }}</td>
            <td>{{ Math.floor(req.matchingBonus).toLocaleString() }}</td>
            <td>{{ Math.floor(req.totalBonus).toLocaleString() }}</td>
            <td>
              <div class="final-amount cash" title="현금(Cash)으로 지급될 금액">
                C:
                {{
                  Math.floor(calculateFinalPayout(req).cash).toLocaleString()
                }}
              </div>
              <div class="final-amount saltmate" title="SaltMate로 지급될 금액">
                S:
                {{
                  Math.floor(
                    calculateFinalPayout(req).saltmate,
                  ).toLocaleString()
                }}
              </div>
            </td>
            <td>
              <span :class="['status-badge', req.status]">{{
                getStatusText(req)
              }}</span>
            </td>
            <td class="actions">
              <button
                v-if="req.status === 'pending'"
                @click="approvePayout(req.id)"
                class="btn-approve"
              >
                승인
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
import { db, functions } from "@/firebaseConfig";
import { httpsCallable } from "firebase/functions";
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  orderBy,
} from "firebase/firestore";

const getTodayString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = (today.getMonth() + 1).toString().padStart(2, "0");
  const day = today.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default {
  name: "WeeklyPayoutManager",
  data() {
    return {
      requests: [],
      isLoading: true,
      selectedDate: getTodayString(),
      searchMode: "pending",
    };
  },
  async created() {
    await this.fetchPendingRequests();
  },
  methods: {
    async fetchPendingRequests() {
      this.searchMode = "pending";
      this.isLoading = true;
      try {
        const q = query(
          collection(db, "weekly_payout_requests"),
          where("status", "==", "pending"),
          orderBy("createdAt", "desc"),
        );
        const querySnapshot = await getDocs(q);
        this.requests = querySnapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
      } catch (error) {
        console.error("승인 대기 목록 조회 오류:", error);
        alert("데이터를 불러오는 데 실패했습니다.");
      } finally {
        this.isLoading = false;
      }
    },
    // [최종 수정] 데이터를 생성 시간(createdAt)이 아닌, 주차 ID(weekId)로 정확하게 조회합니다.
    async fetchRequestsByDate() {
      if (!this.selectedDate) {
        alert("조회할 날짜를 선택해주세요.");
        return;
      }
      this.searchMode = "date";
      this.isLoading = true;
      try {
        // [핵심] weekId로 필터링하고 createdAt으로 정렬하는 쿼리
        const q = query(
          collection(db, "weekly_payout_requests"),
          where("weekId", "==", this.selectedDate),
          orderBy("createdAt", "desc"), // <--- 이 정렬 기능 때문에 색인이 필요합니다.
        );
        const querySnapshot = await getDocs(q);
        this.requests = querySnapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
      } catch (error) {
        console.error("날짜별 정산 목록 조회 오류:", error);
        alert("데이터를 불러오는 데 실패했습니다.");
      } finally {
        this.isLoading = false;
      }
    },
    async generateManualPayouts() {
      if (!this.selectedDate) {
        alert("정산을 생성할 기준 주차(종료일)를 선택해주세요.");
        return;
      }
      if (
        !confirm(
          `'${this.selectedDate}'을 종료일로 하는 주간 정산을 생성하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`,
        )
      )
        return;

      this.isLoading = true;
      try {
        const generateFunction = httpsCallable(
          functions,
          "manuallyGenerateWeeklyPayouts",
        );
        const result = await generateFunction({
          dateString: this.selectedDate,
        });
        alert(result.data.message);
        // 생성이 완료되면, 방금 생성한 날짜의 데이터를 바로 조회합니다.
        await this.fetchRequestsByDate();
      } catch (error) {
        console.error("수동 정산 생성 실패:", error);
        alert(`수동 정산 생성 중 오류가 발생했습니다: ${error.message}`);
      } finally {
        this.isLoading = false;
      }
    },
    async approvePayout(payoutId) {
      if (!confirm(`이 정산 요청을 승인하시겠습니까?`)) return;
      this.isLoading = true;
      try {
        const reqRef = doc(db, "weekly_payout_requests", payoutId);
        await updateDoc(reqRef, {
          status: "approved",
          approvedAt: new Date(),
        });
        alert(`정산(ID: ${payoutId})이 승인되었습니다.`);
        // 승인 후 현재 보고 있는 목록을 새로고침
        if (this.searchMode === "pending") {
          await this.fetchPendingRequests();
        } else {
          await this.fetchRequestsByDate();
        }
      } catch (error) {
        console.error("정산 승인 오류:", error);
        alert(`처리 중 오류가 발생했습니다: ${error.message}`);
      } finally {
        this.isLoading = false;
      }
    },
    calculateFinalPayout(req) {
      const companyFeeRate = 0.05;
      let finalCash = 0;
      let finalSaltmate = 0;
      if (req.roiBonus > 0) {
        const netRoi = req.roiBonus * (1 - companyFeeRate);
        finalCash += netRoi * 0.3;
        finalSaltmate += netRoi * 0.7;
      }
      if (req.matchingBonus > 0) {
        const netMatching = req.matchingBonus * (1 - companyFeeRate);
        finalSaltmate += netMatching;
      }
      return { cash: finalCash, saltmate: finalSaltmate };
    },
    getStatusText(req) {
      switch (req.status) {
        case "pending":
          return "승인 대기";
        case "approved":
          return "승인 완료";
        case "failed":
          return "실패";
        default:
          return req.status;
      }
    },
  },
};
</script>

<style scoped>
/* (기존 스타일은 변경되지 않았으므로 생략) */
.payout-manager {
  padding: 20px;
}
.card {
  background: #fff;
  border-radius: 15px;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.08);
  padding: 20px;
}
.search-controls {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 20px;
  background-color: #f8f9fa;
  flex-wrap: wrap;
}
.date-picker-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}
.search-controls label {
  font-weight: bold;
}
.search-controls input[type="date"] {
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
}
.search-controls button {
  padding: 8px 15px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-weight: bold;
  color: white;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: background-color 0.2s;
}
.search-controls button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.btn-search {
  background-color: #007bff;
}
.btn-search:hover:not(:disabled) {
  background-color: #0056b3;
}
.btn-pending {
  background-color: #ffc107;
  color: #333;
}
.btn-pending:hover:not(:disabled) {
  background-color: #e0a800;
}
.btn-manual-generate {
  background-color: #6f42c1;
}
.btn-manual-generate:hover:not(:disabled) {
  background-color: #5a32a3;
}
.payout-manager h2 {
  font-size: 1.8em;
  margin-bottom: 20px;
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
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
.table-container {
  overflow-x: auto;
}
.payout-table {
  width: 100%;
  border-collapse: collapse;
  text-align: center;
  font-size: 0.95em;
}
.payout-table th,
.payout-table td {
  padding: 12px 15px;
  border-bottom: 1px solid #eee;
}
.payout-table thead th {
  background-color: #f8f9fa;
  font-weight: bold;
  color: #333;
}
.actions button {
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  margin: 0 4px;
  color: white;
  font-weight: bold;
}
.btn-approve {
  background-color: #28a745;
}
.final-amount {
  font-weight: bold;
}
.final-amount.cash {
  color: #007bff;
}
.final-amount.saltmate {
  color: #6f42c1;
}
.status-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.8em;
  font-weight: bold;
  color: white;
}
.status-badge.pending {
  background-color: #ffc107;
  color: #333;
}
.status-badge.approved {
  background-color: #28a745;
}
.status-badge.failed {
  background-color: #dc3545;
}
</style>
