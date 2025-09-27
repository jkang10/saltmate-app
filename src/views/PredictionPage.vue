<template>
  <div class="page-container prediction-page">
    <header class="page-header">
      <h1><i class="fas fa-chart-bar"></i> 솔트팡 랭킹 예측</h1>
      <p>이번 주({{ weekInfo }}) 랭킹전 TOP 3를 예측하고 베팅하세요!</p>
    </header>

    <div class="card betting-card">
      <div v-if="market.status === 'open'">
        <h3>베팅 마감까지: {{ countdown }}</h3>
        
        <div v-if="loadingPlayers" class="loading-state">
            <div class="spinner-small"></div>
            <p>지난 주 랭커 정보를 불러오는 중입니다...</p>
        </div>
        
        <div v-else-if="rankedPlayers.length > 0" class="betting-form">
          <div v-for="rank in ['1st', '2nd', '3rd']" :key="rank" class="form-group">
            <label><i :class="getRankIcon(rank)"></i> {{ rank }} Place</label>
            <select v-model="predictions[rank]">
              <option :value="null" disabled>선수를 선택하세요</option>
              <option v-for="player in rankedPlayers" :key="player.id" :value="player.id">
                {{ player.name }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label><i class="fas fa-coins"></i> 베팅 금액</label>
            <input type="number" v-model.number="betAmount" placeholder="SaltMate" min="100" step="100">
          </div>
          <button @click="placeBet" :disabled="isBetting || !isBetValid" class="btn-primary">
            <span v-if="isBetting" class="spinner-small"></span>
            <span v-else>베팅하기</span>
          </button>
        </div>

        <div v-else class="no-data">
          <h4>예측 불가</h4>
          <p>지난 주 랭킹 데이터가 없어 예측 후보를 불러올 수 없습니다.<br>다음 주에 다시 시도해주세요.</p>
        </div>

      </div>
      <div v-else class="betting-closed">
        <h3>이번 주 베팅 마감</h3>
        <p>다음 주 월요일에 새로운 예측이 시작됩니다.</p>
      </div>
      <p v-if="error" class="error-message">{{ error }}</p>
    </div>

    <div class="card my-bets-card">
        <h3>나의 베팅 현황</h3>
        <div v-if="myBet">
            <p><strong>{{ myBet.betAmount.toLocaleString() }} SaltMate</strong>를 베팅했습니다.</p>
            <ul>
                <li>1위 예측: {{ getPlayerName(myBet.predictions['1st']) }}</li>
                <li>2위 예측: {{ getPlayerName(myBet.predictions['2nd']) }}</li>
                <li>3위 예측: {{ getPlayerName(myBet.predictions['3rd']) }}</li>
            </ul>
        </div>
        <p v-else>이번 주에 아직 베팅하지 않았습니다.</p>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, computed } from 'vue';
import { db, functions, auth } from '@/firebaseConfig';
import { collection, query, orderBy, limit, getDocs, doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

const market = reactive({ status: 'open' });
const predictions = reactive({ '1st': null, '2nd': null, '3rd': null });
const betAmount = ref(100);
const isBetting = ref(false);
const error = ref('');
const rankedPlayers = ref([]);
const loadingPlayers = ref(true);
const myBet = ref(null);
const countdown = ref('');
let marketUnsubscribe = null;
let betUnsubscribe = null;
let countdownInterval = null;

const getMonday = (d) => {
  d = new Date(d);
  const day = d.getDay(),
        diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
};

const weekId = computed(() => getMonday(new Date()).toISOString().slice(0, 10));

const weekInfo = computed(() => {
    const start = getMonday(new Date());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return `${start.getMonth()+1}.${start.getDate()} ~ ${end.getMonth()+1}.${end.getDate()}`;
});

const isBetValid = computed(() => {
    const selected = Object.values(predictions);
    return selected.every(p => p !== null) && new Set(selected).size === 3 && betAmount.value > 0;
});

const getRankIcon = (rank) => {
    if(rank === '1st') return 'fas fa-crown';
    if(rank === '2nd') return 'fas fa-medal';
    if(rank === '3rd') return 'fas fa-award';
    return '';
}

const getPlayerName = (playerId) => {
    const player = rankedPlayers.value.find(p => p.id === playerId);
    return player ? player.name : '선택되지 않음';
};

const fetchRankedPlayers = async () => {
    loadingPlayers.value = true;
    try {
        const today = new Date();
        const lastMonday = getMonday(new Date(today.setDate(today.getDate() - 7)));
        const lastWeekId = lastMonday.toISOString().slice(0, 10);
        
        const q = query(collection(db, 'saltPangRanked', lastWeekId, 'scores'), orderBy('score', 'desc'), limit(10));
        const snapshot = await getDocs(q);
        rankedPlayers.value = snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().username }));
    } catch(e) {
        console.error("랭킹 후보 조회 오류:", e);
        error.value = "랭킹 후보를 불러오지 못했습니다.";
    } finally {
        loadingPlayers.value = false;
    }
};

const startCountdown = (endTime) => {
    if(countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(() => {
        const now = new Date();
        const diff = endTime.getTime() - now.getTime();
        if (diff <= 0) {
            countdown.value = '베팅 마감';
            clearInterval(countdownInterval);
            market.status = 'closed';
            return;
        }
        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        countdown.value = `${d}일 ${String(h).padStart(2, '0')}시간 ${String(m).padStart(2, '0')}분 후 마감`;
    }, 1000);
}

onMounted(() => {
  fetchRankedPlayers();
  
  const marketRef = doc(db, "predictionMarkets", weekId.value);
  marketUnsubscribe = onSnapshot(marketRef, (docSnap) => {
    if(docSnap.exists()) {
        const data = docSnap.data();
        market.status = data.status;
        if(data.endTime) {
            startCountdown(data.endTime.toDate());
        }
    }
  });

  if(auth.currentUser) {
    const betRef = doc(db, `predictionMarkets/${weekId.value}/bets/${auth.currentUser.uid}`);
    betUnsubscribe = onSnapshot(betRef, (docSnap) => {
        myBet.value = docSnap.exists() ? docSnap.data() : null;
    });
  }
});

onUnmounted(() => {
    if(marketUnsubscribe) marketUnsubscribe();
    if(betUnsubscribe) betUnsubscribe();
    if(countdownInterval) clearInterval(countdownInterval);
});

const placeBet = async () => {
  if (!isBetValid.value) {
      error.value = "1, 2, 3위를 모두 다른 선수로 선택해주세요.";
      return;
  }
  isBetting.value = true;
  error.value = '';
  try {
    const placePredictionBet = httpsCallable(functions, 'placePredictionBet');
    await placePredictionBet({
      weekId: weekId.value,
      betAmount: betAmount.value,
      predictions: predictions
    });
    alert('베팅 성공!');
  } catch(e) {
    error.value = e.message;
  } finally {
    isBetting.value = false;
  }
};
</script>

<style scoped>
.page-container { max-width: 800px; margin: 90px auto 20px; padding: 20px; display: flex; flex-direction: column; gap: 30px; }
.page-header { text-align: center; }
.card { background: white; border-radius: 16px; padding: 30px; box-shadow: 0 8px 30px rgba(0,0,0,0.1); }
.betting-card h3 { text-align: center; margin-top: 0; margin-bottom: 20px; }
.betting-form { display: flex; flex-direction: column; gap: 20px; }
.form-group { text-align: left; }
.form-group label { font-weight: bold; margin-bottom: 8px; display: flex; align-items: center; gap: 8px; }
.form-group label .fa-crown { color: #ffd700; }
.form-group label .fa-medal { color: #c0c0c0; }
.form-group label .fa-award { color: #cd7f32; }
.form-group select, .form-group input { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 1em; }
.betting-closed { padding: 40px 20px; color: #555; text-align: center; }
.btn-primary { padding: 12px; font-size: 1.1em; }
.my-bets-card h3 { margin-top: 0; }
.my-bets-card ul { list-style: none; padding-left: 0; }
.my-bets-card li { padding: 5px 0; }
.error-message { color: #dc3545; text-align: center; margin-top: 15px; }
.loading-state { padding: 40px; text-align: center; color: #555; }
</style>