<template>
  <div class="management-page">
    <h3><i class="fas fa-cogs"></i> 마케팅 플랜 관리</h3>
    <p>수익 구조와 관련된 주요 변수를 설정합니다.</p>

    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
    </div>
    <div v-else class="plan-editor">
      <section class="card settings-section">
        <h4>수익 사이클 설정</h4>
        <div class="form-group">
          <label for="cycle-multiplier">수익 사이클 배수 (%)</label>
          <input
            type="number"
            id="cycle-multiplier"
            v-model.number="plan.cycleCapMultiplierPercent"
            step="10"
          />
          <small
            >구독 원금 대비 수익 한도를 설정합니다. (예: 300 입력 시
            300%)</small
          >
        </div>
      </section>

      <section class="card settings-section">
        <h4>수익 분배 비율 설정</h4>
        <div class="form-group">
          <label>현금성 수익 (%)</label>
          <input
            type="number"
            v-model.number="plan.distribution.cashPercent"
            min="0"
            max="100"
          />
        </div>
        <div class="form-group">
          <label>솔트메이트 (%)</label>
          <input
            type="number"
            v-model.number="plan.distribution.saltmatePercent"
            min="0"
            max="100"
          />
        </div>
      </section>

      <section class="card settings-section">
        <h4>출금 정책 설정</h4>
        <div class="form-group">
          <label>출금 가능 요일</label>
          <select v-model.number="plan.withdrawal.day">
            <option value="1">월요일</option>
            <option value="2">화요일</option>
            <option value="3">수요일</option>
            <option value="4">목요일</option>
            <option value="5">금요일</option>
            <option value="6">토요일</option>
            <option value="0">일요일</option>
          </select>
        </div>
        <div class="form-group">
          <label>시작 시간 (0~23시)</label>
          <input
            type="number"
            v-model.number="plan.withdrawal.startHour"
            min="0"
            max="23"
          />
        </div>
        <div class="form-group">
          <label>종료 시간 (0~23시)</label>
          <input
            type="number"
            v-model.number="plan.withdrawal.endHour"
            min="0"
            max="23"
          />
        </div>
      </section>

      <button @click="savePlan" class="btn-primary" :disabled="isSaving">
        <span v-if="isSaving">저장 중...</span>
        <span v-else><i class="fas fa-save"></i> 설정 저장</span>
      </button>
    </div>
  </div>
</template>

<script>
import { db } from "@/firebaseConfig";
import { doc, getDoc, setDoc } from "firebase/firestore";

export default {
  name: "MarketingPlanManagement",
  data() {
    return {
      isLoading: true,
      isSaving: false,
      plan: {
        cycleCapMultiplierPercent: 300,
        distribution: {
          cashPercent: 30,
          saltmatePercent: 70,
        },
        withdrawal: {
          day: 2, // 화요일
          startHour: 9,
          endHour: 17,
        },
      },
    };
  },
  async created() {
    await this.loadPlan();
  },
  methods: {
    async loadPlan() {
      this.isLoading = true;
      try {
        const planRef = doc(db, "configuration", "marketingPlan");
        const docSnap = await getDoc(planRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          this.plan.cycleCapMultiplierPercent =
            (data.cycleCapMultiplier || 3) * 100;
          this.plan.distribution.cashPercent =
            (data.distribution?.cash || 0.3) * 100;
          this.plan.distribution.saltmatePercent =
            (data.distribution?.saltmate || 0.7) * 100;
          this.plan.withdrawal = data.withdrawal || this.plan.withdrawal;
        }
      } catch (error) {
        console.error("마케팅 플랜 로딩 실패:", error);
        alert("설정을 불러오는 데 실패했습니다.");
      } finally {
        this.isLoading = false;
      }
    },
    async savePlan() {
      if (
        this.plan.distribution.cashPercent +
          this.plan.distribution.saltmatePercent !==
        100
      ) {
        alert("현금성 수익과 솔트메이트의 비율 합은 반드시 100%여야 합니다.");
        return;
      }

      this.isSaving = true;
      try {
        const dataToSave = {
          cycleCapMultiplier: this.plan.cycleCapMultiplierPercent / 100,
          distribution: {
            cash: this.plan.distribution.cashPercent / 100,
            saltmate: this.plan.distribution.saltmatePercent / 100,
          },
          withdrawal: this.plan.withdrawal,
        };
        const planRef = doc(db, "configuration", "marketingPlan");
        await setDoc(planRef, dataToSave, { merge: true });
        alert("마케팅 플랜이 성공적으로 저장되었습니다.");
      } catch (error) {
        console.error("저장 실패:", error);
        alert("저장에 실패했습니다.");
      } finally {
        this.isSaving = false;
      }
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
.plan-editor {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.card {
  background: #fff;
  border-radius: 12px;
  padding: 25px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
}
h3,
h4 {
  margin-top: 0;
}
.settings-section h4 {
  margin-bottom: 20px;
  border-bottom: 1px solid #eee;
  padding-bottom: 10px;
}
.form-group {
  margin-bottom: 15px;
}
.form-group label {
  display: block;
  font-weight: bold;
  margin-bottom: 8px;
}
.form-group input,
.form-group select {
  width: 100%;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 6px;
  box-sizing: border-box;
}
.form-group small {
  display: block;
  margin-top: 5px;
  color: #666;
  font-size: 0.9em;
}
.btn-primary {
  background-color: #007bff;
  color: white;
  border: none;
  padding: 12px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: bold;
  align-self: flex-end;
}
.btn-primary:disabled {
  background-color: #a0c9ff;
  cursor: not-allowed;
}
.loading-state {
  text-align: center;
  padding: 40px;
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
</style>
S
