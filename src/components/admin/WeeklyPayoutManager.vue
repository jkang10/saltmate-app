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

      <button
        v-if="selectedPayouts.length > 0"
        @click="deleteSelectedPayouts"
        class="btn-delete-selected"
        :disabled="isLoading"
      >
        <i class="fas fa-trash-alt"></i> 선택 항목 삭제 ({{
          selectedPayouts.length
        }}건)
      </button>
    </div>

    <div class="table-container card">
      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <p>데이터를 불러오는 중입니다...</p>
      </div>
      <div v-else-if="requests.length === 0" class="empty-state">
        <p>표시할 정산 내역이 없습니다.</p>
      </div>
      <table v-else class="payout-table">
        <thead>
          <tr>
            <th>
              <input
                type="checkbox"
                @change="selectAllPayouts"
                :checked="isAllSelected"
              />
            </th>
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
            <td>
              <input
                type="checkbox"
                v-model="selectedPayouts"
                :value="req.id"
              />
            </td>
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
              <button
                v-if="req.status === 'pending'"
                @click="forceApprovePayout(req.id, req.userName)"
                class="btn-force-approve"
                title="지급 절차 없이 상태만 '승인 완료'로 변경합니다. 중복 생성된 데이터를 정리할 때 사용하세요."
              >
                강제 승인
              </button>
              <button
                @click="deleteSinglePayout(req.id, req.userName)"
                class="btn-delete"
              >
                삭제
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
      selectedPayouts: [],
    };
  },
  computed: {
    isAllSelected() {
      return (
        this.requests.length > 0 &&
        this.selectedPayouts.length === this.requests.length
      );
    },
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
    async fetchRequestsByDate() {
      if (!this.selectedDate) {
        alert("조회할 날짜를 선택해주세요.");
        return;
      }
      this.searchMode = "date";
      this.isLoading = true;
      try {
        const q = query(
          collection(db, "weekly_payout_requests"),
          where("weekId", "==", this.selectedDate),
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
        await this.fetchRequestsByDate();
      } catch (error) {
        console.error("수동 정산 생성 실패:", error);
        alert(`수동 정산 생성 중 오류가 발생했습니다: ${error.message}`);
      } finally {
        this.isLoading = false;
      }
    },
    async approvePayout(payoutId) {
      if (!confirm(`이 정산 요청을 승인하시겠습니까? (실제 지급이 처리됩니다)`))
        return;
      this.isLoading = true;
      try {
        const reqRef = doc(db, "weekly_payout_requests", payoutId);
        await updateDoc(reqRef, {
          status: "approved",
          approvedAt: new Date(),
        });
        alert(`정산(ID: ${payoutId})이 승인되었습니다.`);
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
    // [신규 추가] 강제 승인 처리 메소드
    async forceApprovePayout(payoutId, userName) {
      if (
        !confirm(
          `[주의] '${userName}'님의 이 정산 건을 '강제 승인'하시겠습니까?\n\n이 작업은 실제 지급 절차를 생략하고 상태만 '승인 완료'로 변경합니다. 이미 지급된 중복 데이터를 정리할 때만 사용하세요.`,
        )
      )
        return;

      this.isLoading = true;
      try {
        const forceApproveFunction = httpsCallable(
          functions,
          "manuallyForceApprovePayouts",
        );
        const result = await forceApproveFunction({ payoutIds: [payoutId] });
        alert(result.data.message);
        if (this.searchMode === "pending") {
          await this.fetchPendingRequests();
        } else {
          await this.fetchRequestsByDate();
        }
      } catch (error) {
        console.error("강제 승인 처리 실패:", error);
        alert(`처리 중 오류가 발생했습니다: ${error.message}`);
      } finally {
        this.isLoading = false;
      }
    },
    async deleteSinglePayout(payoutId, userName) {
      if (!confirm(`'${userName}'님의 이 정산 내역을 정말로 삭제하시겠습니까?`))
        return;
      await this.deletePayouts([payoutId]);
    },
    async deleteSelectedPayouts() {
      if (
        !confirm(
          `${this.selectedPayouts.length}개의 정산 내역을 정말로 삭제하시겠습니까?`,
        )
      )
        return;
      await this.deletePayouts(this.selectedPayouts);
    },
    async deletePayouts(payoutIds) {
      this.isLoading = true;
      try {
        const deleteFunction = httpsCallable(functions, "deleteWeeklyPayouts");
        const result = await deleteFunction({ payoutIds: payoutIds });
        alert(result.data.message);
        this.selectedPayouts = [];
        if (this.searchMode === "pending") {
          await this.fetchPendingRequests();
        } else {
          await this.fetchRequestsByDate();
        }
      } catch (error) {
        console.error("정산 내역 삭제 실패:", error);
        alert(`삭제 중 오류가 발생했습니다: ${error.message}`);
      } finally {
        this.isLoading = false;
      }
    },
    selectAllPayouts(event) {
      if (event.target.checked) {
        this.selectedPayouts = this.requests.map((req) => req.id);
      } else {
        this.selectedPayouts = [];
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
    // [수정] getStatusText 메소드에 'approved_manual' 케이스 추가
    getStatusText(req) {
      switch (req.status) {
        case "pending":
          return "승인 대기";
        case "approved":
          return "승인 완료";
        case "approved_manual":
          return "수동 완료";
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
.btn-delete-selected,
.btn-delete {
  background-color: #dc3545;
}
.btn-delete-selected:hover:not(:disabled),
.btn-delete:hover:not(:disabled) {
  background-color: #c82333;
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
  padding: 10px;
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
/* [신규 추가] 강제 승인 버튼 스타일 */
.btn-force-approve {
  background-color: #fd7e14; /* 주황색 */
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
/* [신규 추가] 수동 완료 뱃지 스타일 */
.status-badge.approved_manual {
  background-color: #6c757d; /* 회색 */
}
.status-badge.failed {
  background-color: #dc3545;
}
</style>
