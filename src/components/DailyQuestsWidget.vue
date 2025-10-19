<template>
  <section class="quests-widget card">
    <div class="widget-header">
      <h3><i class="fas fa-star"></i> 오늘의 추천 활동</h3>
    </div>
    <div v-if="isLoading" class="loading-state">
      <div class="spinner-small"></div>
      <span>퀘스트를 불러오는 중...</span>
    </div>
    <div v-else-if="error" class="error-state">
      <p>{{ error }}</p>
    </div>
    <div v-else-if="quests.length === 0" class="no-data">
      <p>🎉 오늘은 추천 활동이 없거나, 모두 완료하셨습니다!</p>
    </div>
    <div v-else class="quest-list">
      <div v-for="quest in quests" :key="quest.id" class="quest-item">
        <router-link :to="quest.link || '/'" class="quest-info">
          <div class="quest-text">
            <strong>{{ quest.title }}</strong>
            <small>{{ quest.description }}</small>
          </div>
          <div class="quest-progress">
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: `${Math.min(((quest.progress || 0) / quest.target) * 100, 100)}%` }"></div>
            </div>
            <span class="progress-label">
              {{ (quest.progress || 0).toLocaleString() }} / {{ (quest.target || 0).toLocaleString() }}
            </span>
          </div>
        </router-link>
        <div class="quest-action">
          <button
            v-if="quest.progress >= quest.target && !quest.claimed"
            @click="claimReward(quest.id)"
            :disabled="isClaiming[quest.id]"
            class="btn-claim">
            <span v-if="isClaiming[quest.id]" class="spinner-small-light"></span>
            <span v-else>보상 받기</span>
          </button>
          <div v-if="quest.claimed" class="claimed-badge">
            <i class="fas fa-check-circle"></i> 완료
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue';
import { functions } from '@/firebaseConfig';
import { httpsCallable } from 'firebase/functions';

const quests = ref([]);
const isLoading = ref(true);
const error = ref(null);
const isClaiming = reactive({});

const fetchQuests = async () => {
  try {
    isLoading.value = true;
    const getDailyQuests = httpsCallable(functions, 'getDailyQuests');
    const result = await getDailyQuests();
    quests.value = Array.isArray(result.data) ? result.data : [];
  } catch (e) {
    console.error("오늘의 퀘스트 로딩 오류:", e);
    error.value = "추천 활동을 불러오는 데 실패했습니다.";
  } finally {
    isLoading.value = false;
  }
};

const claimReward = async (questId) => {
  isClaiming[questId] = true;
  try {
    const claimDailyQuestReward = httpsCallable(functions, 'claimDailyQuestReward');
    const result = await claimDailyQuestReward({ questId });
    if (result.data.success) {
      alert("보상이 지급되었습니다!");
      const quest = quests.value.find(q => q.id === questId);
      if (quest) quest.claimed = true;
    }
  } catch (e) {
    console.error("퀘스트 보상 수령 오류:", e);
    alert(`보상 수령에 실패했습니다: ${e.message}`);
  } finally {
    isClaiming[questId] = false;
  }
};

onMounted(fetchQuests);
</script>

<style scoped>
/* ▼▼▼ [핵심 수정] .no-data 스타일 추가 ▼▼▼ */
.no-data {
  text-align: center;
  padding: 20px;
  color: #555;
  background-color: #f8f9fa;
  border-radius: 10px;
}
.no-data p {
  margin: 0;
  font-weight: 500;
}
/* ▲▲▲ 수정 끝 ▲▲▲ */

.quests-widget {
  padding: 20px 25px;
  margin-bottom: 30px;
}
.widget-header {
  margin-bottom: 15px;
}
.widget-header h3 {
  margin: 0;
  font-size: 1.4em;
  display: flex;
  align-items: center;
  gap: 10px;
}
.loading-state, .error-state {
  text-align: center;
  padding: 20px;
  color: #666;
}
.quest-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}
.quest-item {
  display: flex;
  align-items: center;
  gap: 15px;
  background-color: #f8f9fa;
  padding: 15px;
  border-radius: 10px;
  transition: box-shadow 0.2s;
}
.quest-item:hover {
  box-shadow: 0 4px 10px rgba(0,0,0,0.05);
}
.quest-info {
  flex-grow: 1;
  text-decoration: none;
  color: inherit;
  display: flex;
  align-items: center;
  gap: 15px;
  /* ▼▼▼ [핵심 수정] 모바일 화면에서 세로로 쌓이도록 설정 ▼▼▼ */
  flex-wrap: wrap;
}
.quest-text {
  flex-grow: 1;
  min-width: 150px; /* 텍스트 영역 최소 너비 확보 */
}
.quest-text strong {
  display: block;
  font-size: 1.1em;
  margin-bottom: 3px;
}
.quest-text small {
  color: #555;
}
.quest-progress {
  width: 150px;
  flex-shrink: 0;
}
.progress-bar {
  background-color: #e9ecef;
  border-radius: 10px;
  height: 8px;
  overflow: hidden;
}
.progress-fill {
  background-color: #28a745;
  height: 100%;
  border-radius: 10px;
  transition: width 0.5s ease;
}
.progress-label {
  font-size: 0.8em;
  text-align: right;
  color: #888;
  display: block;
  margin-top: 4px;
}
.quest-action {
  width: 100px;
  text-align: center;
}
.btn-claim {
  background-color: #007bff;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 20px;
  font-weight: bold;
  cursor: pointer;
  transition: background-color 0.2s;
}
.btn-claim:disabled {
  background-color: #6c757d;
  cursor: not-allowed;
}
.claimed-badge {
  color: #28a745;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
}
.spinner-small {
    border: 2px solid rgba(0,0,0,0.1);
    border-top-color: #007bff;
    border-radius: 50%;
    width: 16px;
    height: 16px;
    animation: spin 1s linear infinite;
    display: inline-block;
}
.spinner-small-light {
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: #fff;
    border-radius: 50%;
    width: 14px;
    height: 14px;
    animation: spin 1s linear infinite;
    display: inline-block;
}
@keyframes spin { to { transform: rotate(360deg); } }
/* ▼▼▼ [핵심 추가] 모바일 화면 레이아웃 조정 ▼▼▼ */
@media (max-width: 600px) {
  .quest-info {
    flex-direction: column; /* 세로 방향으로 변경 */
    align-items: stretch; /* 아이템들을 쭉 펴줌 */
    gap: 10px;
  }
  .quest-progress {
    width: 100%; /* 진행도 바 너비를 100%로 설정 */
  }
  .quest-action {
    align-self: flex-end; /* '보상 받기' 버튼을 오른쪽 끝으로 */
  }
}
/* ▲▲▲ */
</style>