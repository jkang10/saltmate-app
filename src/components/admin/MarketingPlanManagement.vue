<template>
  <div class="management-container">
    <h2><i class="fas fa-cogs"></i> 마케팅 플랜 관리</h2>
    <p class="description">
      이곳에서 설정된 값은 전체 서비스의 보너스 및 등급 시스템에 실시간으로
      적용됩니다.
    </p>

    <div v-if="isLoading" class="loading">설정 정보를 불러오는 중...</div>
    <div v-else-if="error" class="error">{{ error }}</div>

    <div v-else class="config-form">
      <section class="config-section card">
        <h3><i class="fas fa-percentage"></i> 보너스 및 수수료 비율</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>직접 추천 보너스 (%)</label>
            <input
              type="number"
              v-model.number="config.bonuses.directReferralRate"
            />
          </div>
          <div class="form-group">
            <label>1대 매칭 보너스 (%)</label>
            <input
              type="number"
              v-model.number="config.bonuses.level1MatchingRate"
            />
          </div>
          <div class="form-group">
            <label>회사 수수료 (%)</label>
            <input type="number" v-model.number="config.companyFeeRate" />
          </div>
        </div>
      </section>

      <section class="config-section card">
        <h3><i class="fas fa-balance-scale"></i> 수익 분배 비율</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>현금성 수익 (%)</label>
            <input
              type="number"
              v-model.number="config.payoutSplit.cashRatio"
            />
          </div>
          <div class="form-group">
            <label>솔트메이트 (%)</label>
            <input
              type="number"
              v-model.number="config.payoutSplit.saltmateRatio"
            />
          </div>
        </div>
      </section>

      <section class="config-section card">
        <h3><i class="fas fa-sliders-h"></i> 기타 설정</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>수익 사이클 배수 (예: 3 = 300%)</label>
            <input type="number" v-model.number="config.cycleCapMultiplier" />
          </div>
        </div>
      </section>

      <section class="config-section card">
        <h3><i class="fas fa-gem"></i> 등급 설정</h3>
        <div
          v-for="(tier, amount) in config.tiers"
          :key="amount"
          class="tier-setting"
        >
          <span class="tier-amount"
            >{{ Number(amount).toLocaleString() }}원</span
          >
          <input type="text" v-model="tier.name" placeholder="등급명" />
          <label class="subscription-toggle">
            <input type="checkbox" v-model="tier.isSubscription" />
            매월 구독
          </label>
        </div>
      </section>

      <div class="actions">
        <button
          @click="saveConfiguration"
          class="save-button"
          :disabled="isSaving"
        >
          <span v-if="isSaving" class="spinner-small"></span>
          <span v-else>변경사항 저장</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { db } from "@/firebaseConfig";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { ref, onMounted } from "vue";

export default {
  name: "MarketingPlanManagement",
  setup() {
    const config = ref(null);
    const isLoading = ref(true);
    const isSaving = ref(false);
    const error = ref(null);

    const configRef = doc(db, "configuration", "marketingPlan");

    onMounted(async () => {
      try {
        const docSnap = await getDoc(configRef);
        if (docSnap.exists()) {
          // Firestore에서 불러온 비율(0.03)을 퍼센트(3)로 변환하여 UI에 표시
          const data = docSnap.data();
          data.bonuses.directReferralRate *= 100;
          data.bonuses.level1MatchingRate *= 100;
          data.companyFeeRate *= 100;
          data.payoutSplit.cashRatio *= 100;
          data.payoutSplit.saltmateRatio *= 100;
          config.value = data;
        } else {
          throw new Error("마케팅 플랜 설정 문서를 찾을 수 없습니다.");
        }
      } catch (err) {
        error.value = "설정 로딩 실패: " + err.message;
      } finally {
        isLoading.value = false;
      }
    });

    // ▼▼▼ [수정] 불필요한 formatRate 함수 제거 ▼▼▼
    // const formatRate = (key, subkey = null) => {};
    // ▲▲▲ [수정] 완료 ▲▲▲

    const saveConfiguration = async () => {
      if (!config.value) return;
      if (
        !confirm("정말 설정을 변경하시겠습니까? 즉시 서비스 전체에 반영됩니다.")
      )
        return;

      isSaving.value = true;
      try {
        // UI에 표시된 퍼센트(3)를 다시 Firestore 비율(0.03)로 변환하여 저장
        const dataToSave = JSON.parse(JSON.stringify(config.value)); // deep copy
        dataToSave.bonuses.directReferralRate /= 100;
        dataToSave.bonuses.level1MatchingRate /= 100;
        dataToSave.companyFeeRate /= 100;
        dataToSave.payoutSplit.cashRatio /= 100;
        dataToSave.payoutSplit.saltmateRatio /= 100;

        await updateDoc(configRef, dataToSave);
        alert("설정이 성공적으로 저장되었습니다.");
      } catch (err) {
        alert("저장 중 오류 발생: " + err.message);
      } finally {
        isSaving.value = false;
      }
    };

    return {
      config,
      isLoading,
      isSaving,
      error,
      saveConfiguration,
      // ▼▼▼ [수정] return문에서 formatRate 제거 ▼▼▼
      // formatRate
      // ▲▲▲ [수정] 완료 ▲▲▲
    };
  },
};
</script>

<style scoped>
.management-container {
  padding: 20px;
}
.description {
  color: #555;
  margin-bottom: 30px;
}
.config-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.config-section {
  padding: 20px;
  border-radius: 8px;
}
.config-section.card {
  background: white;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08);
}
.config-section h3 {
  margin-top: 0;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 1.4em;
  color: #333;
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
}
.form-group {
  display: flex;
  flex-direction: column;
}
.form-group label {
  font-weight: bold;
  margin-bottom: 8px;
  color: #555;
}
.form-group input {
  padding: 10px;
  border-radius: 5px;
  border: 1px solid #ccc;
  font-size: 1em;
}
.tier-setting {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 15px;
  padding-bottom: 15px;
  border-bottom: 1px solid #f0f0f0;
}
.tier-setting:last-child {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}
.tier-amount {
  font-weight: bold;
  min-width: 100px;
}
.subscription-toggle {
  display: flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
}
.actions {
  margin-top: 20px;
  text-align: right;
}
.save-button {
  padding: 12px 25px;
  font-size: 1.1em;
  font-weight: bold;
  color: white;
  background-color: #007bff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.3s ease;
}
.save-button:disabled {
  background-color: #a0c9ff;
}
.spinner-small {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.5);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  display: inline-block;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
