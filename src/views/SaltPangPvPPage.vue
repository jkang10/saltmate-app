<template>
  <div class="pvp-page">
    <div v-if="matchState !== 'playing'" class="match-overlay">
      <div v-if="matchState === 'searching'" class="status-box">
        <h2>상대를 찾고 있습니다...</h2>
        <div class="spinner-large"></div>
        <button @click="cancelMatchmaking" class="btn-secondary" :disabled="isCancelling">
          {{ isCancelling ? '취소 중...' : '매칭 취소' }}
        </button>
      </div>
      <div v-if="matchState === 'finished'" class="status-box result-box">
        <h2 class="result-text" :class="gameResult">{{ resultText }}</h2>
        <p class="final-score">나: {{ finalScore.me }} vs 상대: {{ finalScore.opponent }}</p>
        <router-link to="/dashboard" class="btn-primary">대시보드로 돌아가기</router-link>
      </div>
    </div>

    <div v-if="matchState === 'playing'" class="game-area">
      <div class="player-info opponent" :class="{ 'active-turn': isOpponentTurn }">
        <div class="info-text">
            <span>{{ opponent?.name }}</span>
            <strong>{{ (opponent?.score || 0).toLocaleString() }}</strong>
        </div>
        <div v-if="isOpponentTurn" class="turn-indicator">상대 턴</div>
      </div>
      
      <div class="game-board-container">
        <div class="game-board" :style="{ gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)` }">
          <div
            v-for="(cell, index) in board" :key="index" class="cell"
            @click="selectCell(index)"
            :class="{ selected: selectedCell === index, 'not-my-turn': !isMyTurn }"
            @touchstart.prevent="handleTouchStart(index, $event)"
            @touchmove.prevent="handleTouchMove($event)"
            @touchend.prevent="handleTouchEnd()"
          >
            <transition name="gem-fall">
              <img
                v-if="cell !== null"
                :src="getGemImage(cell)"
                class="gem-image"
                :class="{ 'clearing': explodingGems.has(index) }"
                alt="Gem"
              />
            </transition>
          </div>
        </div>
      </div>
      
      <div class="player-info me" :class="{ 'active-turn': isMyTurn }">
        <div class="info-text">
            <span>{{ me?.name }}</span>
            <strong>{{ (me?.score || 0).toLocaleString() }}</strong>
        </div>
        <div v-if="isMyTurn" class="turn-indicator">내 턴</div>
      </div>

      <div class="game-timer">{{ timer }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { functions, auth, rtdb, db } from '@/firebaseConfig';
import { httpsCallable } from 'firebase/functions';
import { ref as rtdbRef, onValue, update, remove } from "firebase/database";
import { doc, onSnapshot, deleteDoc } from "firebase/firestore";
import { onBeforeRouteLeave, useRouter } from 'vue-router';

// --- 게임 기본 설정 ---
const BOARD_SIZE = 8;
const NUM_GEM_TYPES = 5;

// --- 게임 상태 변수 ---
const board = ref([]);
const selectedCell = ref(null);
const isProcessing = ref(false);
const explodingGems = ref(new Set());
const touchStart = { index: null, x: 0, y: 0 };
let hasSwiped = false;

// --- 대전 모드 상태 변수 ---
const matchState = ref('searching');
const gameRoomId = ref(null);
const gameState = ref(null);
const timer = ref(60);
const gameResult = ref('');
const finalScore = ref({ me: 0, opponent: 0 });
const router = useRouter();
let roomRef = null;
let roomListener = null;
let timerInterval = null;
let userProfileUnsubscribe = null;
const isCancelling = ref(false);

// --- 계산된 속성 ---
const me = computed(() => gameState.value?.players[auth.currentUser.uid]);
const opponentId = computed(() => Object.keys(gameState.value?.players || {}).find(id => id !== auth.currentUser.uid));
const opponent = computed(() => opponentId.value ? gameState.value.players[opponentId.value] : null);
const isMyTurn = computed(() => gameState.value?.turn === auth.currentUser.uid && !isProcessing.value);
const isOpponentTurn = computed(() => gameState.value?.turn === opponentId.value);
const resultText = computed(() => {
    if(gameResult.value === 'win') return '승리!';
    if(gameResult.value === 'lose') return '패배...';
    if(gameResult.value === 'draw') return '무승부';
    return '';
});

// --- 게임 로직 함수들 ---
const getGemImage = (gemType) => {
  if (gemType === null) return '';
  try { return require(`@/assets/gems/gem_${gemType}.png`); } 
  catch (e) { return ''; }
};

const dropDownGems = () => {
  for(let c=0;c<BOARD_SIZE;c++){ let er=-1; for(let r=BOARD_SIZE-1;r>=0;r--){ const i=r*BOARD_SIZE+c; if(board.value[i]===null&&er===-1)er=r; else if(board.value[i]!==null&&er!==-1){ board.value[er*BOARD_SIZE+c]=board.value[i]; board.value[i]=null; er--; } } }
};

const fillEmptyCells = () => {
  for(let i=0;i<board.value.length;i++){ if(board.value[i]===null){ board.value[i]=Math.floor(Math.random()*NUM_GEM_TYPES)+1; } }
};

const checkAndClearMatches = async () => {
    const matches = new Set();
    for (let r=0; r<BOARD_SIZE; r++) for (let c=0; c<BOARD_SIZE-2; c++) { let i=r*BOARD_SIZE+c; if (board.value[i]&&board.value[i]===board.value[i+1]&&board.value[i]===board.value[i+2]) for(let k=c;k<BOARD_SIZE;k++){ i=r*BOARD_SIZE+k; if(board.value[i]===board.value[r*BOARD_SIZE+c]) matches.add(i); else break;} }
    for (let c=0; c<BOARD_SIZE; c++) for (let r=0; r<BOARD_SIZE-2; r++) { let i=r*BOARD_SIZE+c; if (board.value[i]&&board.value[i]===board.value[i+BOARD_SIZE]&&board.value[i]===board.value[i+2*BOARD_SIZE]) for(let k=r;k<BOARD_SIZE;k++){ i=k*BOARD_SIZE+c; if(board.value[i]===board.value[r*BOARD_SIZE+c]) matches.add(i); else break;} }
    
    if (matches.size > 0) {
        const scoreGained = matches.size * 10 * (matches.size > 3 ? 2 : 1);
        matches.forEach(index => explodingGems.value.add(index));
        await new Promise(r => setTimeout(r, 300));
        matches.forEach(index => {
            board.value[index] = null;
            explodingGems.value.delete(index);
        });
        return { hasMatches: true, scoreGained };
    }
    return { hasMatches: false, scoreGained: 0 };
};

const processBoard = async () => {
    await new Promise(r => setTimeout(r, 200));
    dropDownGems();
    await new Promise(r => setTimeout(r, 200));
    fillEmptyCells();
    await new Promise(r => setTimeout(r, 200));
    return await checkAndClearMatches();
};

const swapAndCheck = async (index1, index2) => {
  isProcessing.value = true;
  [board.value[index1], board.value[index2]] = [board.value[index2], board.value[index1]];
  await new Promise(r => setTimeout(r, 150));
  
  let totalScoreGained = 0;
  let firstCheck = await checkAndClearMatches();
  
  if (!firstCheck.hasMatches) {
    await new Promise(r => setTimeout(r, 150));
    [board.value[index1], board.value[index2]] = [board.value[index2], board.value[index1]];
    if (roomRef) { update(roomRef, { turn: opponentId.value }); }
  } else {
    totalScoreGained += firstCheck.scoreGained;
    let subsequentCheck;
    while ((subsequentCheck = await processBoard()).hasMatches) {
        totalScoreGained += subsequentCheck.scoreGained;
    }
    if (roomRef && auth.currentUser) {
        const newScore = (me.value.score || 0) + totalScoreGained;
        update(roomRef, {
            board: board.value,
            [`/players/${auth.currentUser.uid}/score`]: newScore,
            turn: opponentId.value
        });
    }
  }
  isProcessing.value = false;
};

let matchInfoUnsubscribe = null; // [신규] 매치 정보 리스너 해제용

const listenToGameRoom = () => {
    roomRef = rtdbRef(rtdb, `pvpGameRooms/${gameRoomId.value}`);
    roomListener = onValue(roomRef, (snapshot) => {
        const data = snapshot.val();
        if(data) {
            gameState.value = data;
            // 최초 입장 시에만 보드를 설정하고 타이머를 시작합니다.
            if(!board.value.length && data.board) {
                board.value = data.board;
                if (matchState.value !== 'playing') {
                    matchState.value = 'playing';
                    startTimer();
                }
            }
        }
    });
};

// --- 대전 모드 전용 함수들 ---
const startMatchmaking = async () => {
    matchState.value = 'searching';
    
    // [최종 핵심 수정] users 문서 대신, 'matches' 컬렉션의 내 문서를 감시합니다.
    if(auth.currentUser && !matchInfoUnsubscribe) {
        const matchInfoRef = doc(db, 'matches', auth.currentUser.uid);
        matchInfoUnsubscribe = onSnapshot(matchInfoRef, (docSnap) => {
            if (docSnap.exists() && matchState.value !== 'playing') {
                const { gameRoomId } = docSnap.data();
                if(matchInfoUnsubscribe) {
                    matchInfoUnsubscribe();
                    matchInfoUnsubscribe = null;
                }
                // 매칭 신호를 받으면 해당 문서는 바로 삭제
                deleteDoc(matchInfoRef);

                // 게임 룸으로 진입
                this.gameRoomId = gameRoomId;
                listenToGameRoom();
            }
        });
    }

    try {
        const findMatchFunc = httpsCallable(functions, 'findSaltPangMatch');
        await findMatchFunc();
    } catch(e) {
        console.error("매칭 요청 오류:", e);
        if (matchInfoUnsubscribe) matchInfoUnsubscribe();
        router.push('/dashboard');
    }
}

const startTimer = () => {
    timerInterval = setInterval(async () => {
        timer.value--;
        if (timer.value <= 0) {
            clearInterval(timerInterval);
            const finalizeGame = httpsCallable(functions, 'finalizePvpGame');
            const result = await finalizeGame({ gameRoomId: gameRoomId.value });
            gameResult.value = result.data.result;
            finalScore.value = { me: me.value?.score || 0, opponent: opponent.value?.score || 0 };
            matchState.value = 'finished';
        }
    }, 1000);
};

const cancelMatchmaking = async () => {
    if (!auth.currentUser || isCancelling.value) return;
    isCancelling.value = true;
    try {
        const cancelFunc = httpsCallable(functions, 'cancelMatchmaking');
        await cancelFunc();
        alert('매칭이 취소되었습니다.');
        router.push('/dashboard');
    } catch (error) {
        console.error("매칭 취소 오류:", error);
        alert('매칭 취소 중 오류가 발생했습니다.');
    } finally {
        isCancelling.value = false;
    }
};

const selectCell = (index) => {
    if (!isMyTurn.value || isProcessing.value) return;
    if (selectedCell.value === null) {
        selectedCell.value = index;
    } else {
        const r1=Math.floor(selectedCell.value/BOARD_SIZE), c1=selectedCell.value%BOARD_SIZE;
        const r2=Math.floor(index/BOARD_SIZE), c2=index%BOARD_SIZE;
        if (Math.abs(r1-r2)+Math.abs(c1-c2)===1) swapAndCheck(selectedCell.value, index);
        selectedCell.value = null;
    }
};

const handleTouchStart = (index, event) => {
    if (!isMyTurn.value || isProcessing.value) return;
    touchStart.index = index;
    touchStart.x = event.touches[0].clientX;
    touchStart.y = event.touches[0].clientY;
    hasSwiped.value = false;
};

const handleTouchMove = (event) => {
  if (touchStart.index === null || hasSwiped.value) return;
  const dx = event.touches[0].clientX - touchStart.x;
  const dy = event.touches[0].clientY - touchStart.y;
  const SWIPE_THRESHOLD = 20;

  if (Math.abs(dx) > SWIPE_THRESHOLD || Math.abs(dy) > SWIPE_THRESHOLD) {
    hasSwiped.value = true;
    let targetIndex = -1;
    const { index } = touchStart;
    const col = index % BOARD_SIZE;
    
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0 && col < BOARD_SIZE - 1) targetIndex = index + 1;
      else if (dx < 0 && col > 0) targetIndex = index - 1;
    } else {
      if (dy > 0) targetIndex = index + BOARD_SIZE;
      else if (dy < 0) targetIndex = index - BOARD_SIZE;
    }
    if (targetIndex >= 0 && targetIndex < BOARD_SIZE * BOARD_SIZE) {
        swapAndCheck(touchStart.index, targetIndex);
    }
  }
};

const handleTouchEnd = () => { touchStart.index = null; };

onMounted(startMatchmaking);

onBeforeRouteLeave(async () => {
    // 모든 리스너와 타이머를 정리합니다.
    if(roomListener) roomListener();
    if(timerInterval) clearInterval(timerInterval);
    if(userProfileUnsubscribe) userProfileUnsubscribe();
    
    // 페이지를 떠날 때, 내가 매칭 대기 상태였다면 확실하게 취소 함수를 호출합니다.
    if(matchState.value === 'searching' && auth.currentUser && !isCancelling.value) {
        console.log("페이지를 이탈하여 매칭을 자동 취소합니다.");
        const cancelFunc = httpsCallable(functions, 'cancelMatchmaking');
        await cancelFunc();
    }
    // RTDB 룸 데이터 정리
    if(roomRef) remove(roomRef);
});

</script>

<style scoped>
.pvp-page { display: flex; justify-content: center; align-items: center; height: 100vh; background: linear-gradient(rgba(15, 32, 39, 0.8), rgba(32, 58, 67, 0.8), rgba(44, 83, 100, 0.8)), url('https://www.transparenttextures.com/patterns/clean-gray-paper.png'); padding: 20px; overflow: hidden; }
.match-overlay { position: fixed; inset: 0; display: flex; justify-content: center; align-items: center; background-color: rgba(0, 0, 0, 0.8); backdrop-filter: blur(5px); z-index: 100; }
.status-box { background: white; padding: 40px 50px; border-radius: 16px; text-align: center; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2); animation: fadeIn 0.5s ease-out; }
.status-box h2 { margin: 0 0 20px; }
.result-box .result-text { font-size: 2.5em; font-weight: bold; margin: 10px 0; }
.result-text.win { color: #28a745; }
.result-text.lose { color: #dc3545; }
.result-text.draw { color: #6c757d; }
.final-score { font-size: 1.2em; color: #555; }
.btn-primary, .btn-secondary { margin-top: 20px; padding: 10px 20px; border: none; font-weight: bold; border-radius: 8px; cursor: pointer; text-decoration: none; }
.btn-primary { background-color: #007bff; color: white; }
.btn-secondary { background-color: #6c757d; color: white; }
.game-area { width: 100%; max-width: 500px; display: flex; flex-direction: column; gap: 10px; }
.player-info { padding: 10px 20px; font-size: 1.2em; font-weight: bold; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; box-shadow: inset 0 2px 4px rgba(0,0,0,0.1); transition: all 0.3s ease; border: 2px solid transparent; }
.player-info.active-turn { border-color: #ffd700; box-shadow: 0 0 15px #ffd700, inset 0 2px 4px rgba(0,0,0,0.1); }
.turn-indicator { font-size: 0.8em; font-weight: bold; background: #ffd700; color: #333; padding: 3px 8px; border-radius: 5px; }
.player-info.opponent { background: #ffe8e8; color: #721c24; }
.player-info.me { background: #eafaf1; color: #155724; }
.game-board-container { padding: 5px; background-color: #495057; border-radius: 8px; }
.game-board { display: grid; gap: 4px; touch-action: none; }
.cell { width: 100%; aspect-ratio: 1 / 1; display: flex; justify-content: center; align-items: center; background-color: rgba(255,255,255,0.1); border-radius: 4px; cursor: pointer; position: relative; overflow: hidden; }
.cell.selected { background-color: rgba(255,255,255,0.3); transform: scale(0.95); }
.cell.not-my-turn { cursor: not-allowed; filter: brightness(0.7); }
.gem-image { width: 90%; height: 90%; object-fit: contain; user-select: none; position: absolute; transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
.gem-image.clearing { animation: gem-clear 0.3s ease-out forwards; }
@keyframes gem-clear { 0% { transform: scale(1); opacity: 1; } 100% { transform: scale(1.5); opacity: 0; } }
.gem-fall-enter-active { animation: gem-fall 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
@keyframes gem-fall { 0% { transform: translateY(-50px) scale(0.5); opacity: 0; } 100% { transform: translateY(0) scale(1); opacity: 1; } }
.game-timer { text-align: center; font-size: 2em; font-weight: bold; padding: 10px; background-color: white; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
.spinner-large { border: 5px solid rgba(0, 0, 0, 0.1); border-top-color: #007bff; border-radius: 50%; width: 60px; height: 60px; animation: spin 1s linear infinite; margin: 20px auto; }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
</style>