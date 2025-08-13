<template>
  <div class="marketing-plan-management">
    <h3><i class="fas fa-cogs"></i> 마케팅 플랜 관리</h3>
    <p>회원 등급, 보너스 비율, 출금 정책 등 서비스의 핵심 규칙을 관리합니다.</p>

    <div v-if="isLoading" class="loading-state">...</div>
    <div v-else class="plan-editor">
      <section class="card settings-section">
        <h4>수익 분배 비율 설정</h4>
        <div class="form-group">
          <label>현금성 수익 (%)</label>
          <input
            type="number"
            v-model.number="plan.distribution.cash"
            min="0"
            max="100"
          />
        </div>
        <div class="form-group">
          <label>솔트메이트 (%)</label>
          <input
            type="number"
            v-model.number="plan.distribution.saltmate"
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
      <button @click="savePlan" class="btn-primary">
        <i class="fas fa-save"></i> 마케팅 플랜 저장
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { db } from "@/firebaseConfig";
import { doc, getDoc, setDoc } from "firebase/firestore";

const isLoading = ref(true);
const isSaving = ref(false);
const plan = ref({
  cycleCapMultiplierPercent: 300, // 기본값
});

const planRef = doc(db, "configuration", "marketingPlan");

onMounted(async () => {
  try {
    const docSnap = await getDoc(planRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      // DB에는 배수(3)로, 화면에는 퍼센트(300)로 표시
      plan.value.cycleCapMultiplierPercent =
        (data.cycleCapMultiplier || 3) * 100;
    }
  } catch (error) {
    console.error("마케팅 플랜 로딩 실패:", error);
  } finally {
    isLoading.value = false;
  }
});

const savePlan = async () => {
  isSaving.value = true;
  try {
    const dataToSave = {
      // DB에는 퍼센트를 배수로 변환하여 저장
      cycleCapMultiplier: plan.value.cycleCapMultiplierPercent / 100,
    };
    await setDoc(planRef, dataToSave, { merge: true });
    alert("마케팅 플랜이 성공적으로 저장되었습니다.");
  } catch (error) {
    console.error("저장 실패:", error);
    alert("저장에 실패했습니다.");
  } finally {
    isSaving.value = false;
  }
};
</script>

<style scoped>
.plan-form {
  padding: 25px;
}
.form-group {
  margin-bottom: 20px;
}
.form-group label {
  display: block;
  font-weight: bold;
  margin-bottom: 8px;
}
.form-group input {
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
</style>
