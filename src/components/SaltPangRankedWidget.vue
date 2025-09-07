<template>
  <div class="widget-card ranked-widget">
    <div class="widget-header">
      <h4><i class="fas fa-chess-king"></i> 솔트팡 주간 랭킹전</h4>
      <span class="week-info">{{ weekInfo }}</span>
    </div>
    <div class="widget-body">
      <div v-if="isLoading" class="loading-spinner"></div>
      <ul v-else-if="rankings.length > 0" class="ranking-list">
        <li v-for="(player, index) in rankings" :key="player.id" :class="getRankClass(index)">
          <span class="rank">
            <i v-if="index === 0" class="fas fa-crown"></i>
            <span v-else>{{ index + 1 }}</span>
          </span>
          <span class="name">{{ player.username }}</span>
          <span class="score">{{ player.score.toLocaleString() }} 점</span>
        </li>
      </ul>
      <div v-else class="no-data">
        <p>이번 주 랭킹이<br/>집계 중입니다.</p>
      </div>
    </div>
    <div class="widget-footer">
      <p>매주 월요일 0시에 순위가 집계됩니다.</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { db } from '@/firebaseConfig';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';

const isLoading = ref(true);
const rankings = ref([]);

const getMonday = (d) => {
  d = new Date(d);
  const day = d.getDay(),
        diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

const weekId = computed(() => {
  return getMonday(new Date()).toISOString().slice(0, 10);
});

const weekInfo = computed(() => {
    const start = getMonday(new Date());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return `${start.getMonth()+1}.${start.getDate()} ~ ${end.getMonth()+1}.${end.getDate()}`;
});


const getRankClass = (index) => {
  if (index === 0) return 'rank-1';
  if (index === 1) return 'rank-2';
  if (index === 2) return 'rank-3';
  return '';
};

const fetchRankings = async () => {
  isLoading.value = true;
  try {
    const q = query(
      collection(db, 'saltPangRanked', weekId.value, 'scores'),
      orderBy('score', 'desc'),
      limit(3)
    );
    const snapshot = await getDocs(q);
    rankings.value = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("솔트팡 랭킹전 로딩 실패:", error);
  } finally {
    isLoading.value = false;
  }
};

onMounted(fetchRankings);
</script>

<style scoped>
.widget-card { background: linear-gradient(135deg, #4b6cb7 0%, #182848 100%); color: #fff; border-radius: 15px; padding: 20px; display: flex; flex-direction: column; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
.widget-header { text-align: center; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 10px; margin-bottom: 15px; }
.widget-header h4 { margin: 0; font-size: 1.3em; font-weight: 700; }
.week-info { font-size: 0.85em; color: #bdc3c7; }
.ranking-list { list-style: none; padding: 0; margin: 0; }
.ranking-list li { display: grid; grid-template-columns: 40px 1fr auto; gap: 10px; align-items: center; padding: 12px 10px; border-radius: 8px; transition: background-color 0.2s; }
.ranking-list li:hover { background-color: rgba(255,255,255,0.1); }
.rank { font-weight: bold; font-size: 1.2em; text-align: center; }
.rank .fa-crown { color: #f1c40f; }
.name { font-weight: 500; font-size: 1.1em; }
.score { font-family: monospace; font-size: 1.2em; font-weight: bold; }
.rank-1 { background: rgba(241, 196, 15, 0.15); }
.widget-footer { text-align: center; font-size: 0.8em; color: #95a5a6; margin-top: 15px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.2); }
.loading-spinner, .no-data { text-align: center; padding: 30px 0; color: #bdc3c7; }
.no-data p { margin: 0; line-height: 1.4; }
</style>