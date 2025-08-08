<template>
  <div class="marketing-plan-management">
    <h3><i class="fas fa-cogs"></i> 마케팅 플랜 관리</h3>
    <p>수익 구조와 관련된 주요 변수를 설정합니다.</p>
    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
    </div>
    <div v-else class="card plan-form">
      <div class="form-group">
        <label for="cycle-multiplier">수익 사이클 배수 (%)</label>
        <input
          type="number"
          id="cycle-multiplier"
          v-model.number="plan.cycleCapMultiplierPercent"
          step="10"
        />
        <small
          >구독 원금 대비 수익 한도를 설정합니다. (예: 300 입력 시 300%
          한도)</small
        >
      </div>
      <button @click="savePlan" :disabled="isSaving" class="btn-primary">
        <span v-if="isSaving">저장 중...</span>
        <span v-else>설정 저장</span>
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
