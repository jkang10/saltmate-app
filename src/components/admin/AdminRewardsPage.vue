<template>
  <div class="admin-rewards-page">
    <h2><i class="fas fa-gift"></i> 보상 관리</h2>
    
    <div class="reward-section">
      <h3>1회용 보상 코드 생성</h3>
      <p>이벤트나 오프라인 보상으로 지급할 1회용 코드를 생성합니다.</p>
      
      <div class="form-group">
        <label>보상 종류 선택</label>
        <select v-model="codeGen.selectedReward">
          <option value="HELIAS_WARMTH">'헬리아의 온기' 버프 (1시간)</option>
          </select>
      </div>
      
      <button @click="generateCode" class="btn-primary" :disabled="codeGen.isLoading">
        {{ codeGen.isLoading ? '생성 중...' : '코드 생성' }}
      </button>

      <div v-if="codeGen.generatedCode" class="generated-code">
        <strong>생성된 코드:</strong> 
        <input type="text" :value="codeGen.generatedCode" readonly />
        <button @click="copyCode" class="btn-secondary">복사</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive } from 'vue';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/firebaseConfig';

const codeGen = reactive({
  isLoading: false,
  selectedReward: 'HELIAS_WARMTH',
  generatedCode: null,
});

const generateCode = async () => {
  codeGen.isLoading = true;
  codeGen.generatedCode = null;
  try {
    const generate = httpsCallable(functions, 'generateRewardCode');
    const result = await generate({ rewardType: codeGen.selectedReward });
    codeGen.generatedCode = result.data.code;
  } catch (error) {
    alert(`코드 생성 실패: ${error.message}`);
  } finally {
    codeGen.isLoading = false;
  }
};

const copyCode = () => {
  if (!codeGen.generatedCode) return;
  navigator.clipboard.writeText(codeGen.generatedCode).then(() => {
    alert('코드가 클립보드에 복사되었습니다.');
  });
};
</script>

<style scoped>
.admin-rewards-page { padding: 10px; }
.reward-section { margin-top: 30px; }
.form-group { margin-bottom: 20px; }
select { width: 100%; max-width: 400px; padding: 10px; }
.btn-primary.btn-primary {
  background-color: #007bff;
  color: white;
}
.generated-code {
  margin-top: 20px;
  display: flex;
  align-items: center;
  gap: 10px;
  background-color: #f0f0f0;
  padding: 15px;
  border-radius: 8px;
}
.generated-code input {
  flex-grow: 1;
  border: none;
  background: none;
  font-size: 1.2em;
  font-weight: bold;
}
</style>