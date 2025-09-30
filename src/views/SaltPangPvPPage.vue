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
            :class="{ selected: selectedCell === index, 'not-my-turn': !isMyTurn }"
            @mousedown.prevent="handleInputStart(index, $event)"
            @touchstart.prevent="handleInputStart(index, $event)"
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

<script>
import { ref, onMounted, computed } from 'vue';
import { functions, auth, rtdb, db } from '@/firebaseConfig';
import { httpsCallable } from 'firebase/functions';
import { ref as rtdbRef, onValue, update, remove } from "firebase/database";
import { doc, onSnapshot, deleteDoc } from "firebase/firestore";
import { onBeforeRouteLeave, useRouter } from 'vue-router';
import matchSoundFile from '@/assets/sounds/match.mp3';

export default {
  name: 'SaltPangPvPPage',
  setup() {
    // --- 상태 변수 ---
    const BOARD_SIZE = 8;
    const NUM_GEM_TYPES = 5;
    const board = ref([]);
    const selectedCell = ref(null);
    const isProcessing = ref(false);
    const explodingGems = ref(new Set());
    const matchState = ref('searching');
    const gameRoomId = ref(null);
    const gameState = ref(null);
    const timer = ref(60);
    const gameResult = ref('');
    const finalScore = ref({ me: 0, opponent: 0 });
    const router = useRouter();
    const isCancelling = ref(false);
    const matchAudio = new Audio(matchSoundFile);
    const inputState = ref({ startIndex: null, isDragging: false });
    let roomRef = null;
    let roomListener = null;
    let timerInterval = null;
    let matchInfoUnsubscribe = null;

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

    const getGemImage = (gemType) => {
      if (gemType === null) return '';
      try { return require(`@/assets/gems/gem_${gemType}.png`); } 
      catch (e) { return ''; }
    };
    const playMatchSound = () => {
      matchAudio.currentTime = 0;
      matchAudio.play().catch(e => console.log("사운드 재생 오류:", e));
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
        if (matches.size > 0) { playMatchSound(); const scoreGained = matches.size * 10 * (matches.size > 3 ? 2 : 1); matches.forEach(index => explodingGems.value.add(index)); await new Promise(r => setTimeout(r, 300)); matches.forEach(index => { board.value[index] = null; explodingGems.value.delete(index); }); return { hasMatches: true, scoreGained }; }
        return { hasMatches: false, scoreGained: 0 };
    };
    const processBoard = async () => {
        await new Promise(r => setTimeout(r, 200)); dropDownGems(); await new Promise(r => setTimeout(r, 200)); fillEmptyCells(); await new Promise(r => setTimeout(r, 200)); return await checkAndClearMatches();
    };
    const swapAndCheck = async (index1, index2) => {
      if (isProcessing.value) return;
      isProcessing.value = true;
      try {
        [board.value[index1], board.value[index2]] = [board.value[index2], board.value[index1]];
        await new Promise(r => setTimeout(r, 150));
        let totalScoreGained = 0;
        const firstCheck = await checkAndClearMatches();
        if (!firstCheck.hasMatches) {
          await new Promise(r => setTimeout(r, 150));
          [board.value[index1], board.value[index2]] = [board.value[index2], board.value[index1]];
          if (roomRef) { await update(roomRef, { turn: opponentId.value }); }
        } else {
          totalScoreGained += firstCheck.scoreGained;
          let subsequentCheck;
          while ((subsequentCheck = await processBoard()).hasMatches) { totalScoreGained += subsequentCheck.scoreGained; }
          if (roomRef && auth.currentUser) {
              const newScore = (me.value.score || 0) + totalScoreGained;
              await update(roomRef, { board: board.value, [`/players/${auth.currentUser.uid}/score`]: newScore, turn: opponentId.value });
          }
        }
      } catch (error) { console.error("게임 진행 중 오류 발생:", error); } 
      finally { isProcessing.value = false; }
    };
    const listenToGameRoom = () => {
        roomRef = rtdbRef(rtdb, `pvpGameRooms/${gameRoomId.value}`);
        roomListener = onValue(roomRef, (snapshot) => {
            const data = snapshot.val();
            if(data) {
                gameState.value = data;
                if((!board.value || board.value.length === 0) && data.board) { board.value = data.board; }
                if (matchState.value !== 'playing' && data.status === 'playing') { matchState.value = 'playing'; startTimer(); }
            }
        });
    };
    const startMatchmaking = async () => {
        matchState.value = 'searching';
        if(auth.currentUser && !matchInfoUnsubscribe) {
            const matchInfoRef = doc(db, 'matches', auth.currentUser.uid);
            matchInfoUnsubscribe = onSnapshot(matchInfoRef, (docSnap) => {
                if (docSnap.exists() && matchState.value === 'searching') {
                    const { gameRoomId: newGameRoomId } = docSnap.data();
                    if (matchInfoUnsubscribe) { matchInfoUnsubscribe(); matchInfoUnsubscribe = null; }
                    deleteDoc(matchInfoRef);
                    waitForRtdbReady(newGameRoomId);
                }
            });
        }
        try {
            const findMatchFunc = httpsCallable(functions, 'findSaltPangMatch');
            await findMatchFunc();
        } catch(e) { console.error("매칭 요청 오류:", e); if (matchInfoUnsubscribe) matchInfoUnsubscribe(); router.push('/dashboard'); }
    };
    const waitForRtdbReady = (newGameRoomId) => {
        gameRoomId.value = newGameRoomId;
        const gameResultRef = doc(db, 'pvpGameResults', newGameRoomId);
        const unsubscribe = onSnapshot(gameResultRef, (docSnap) => {
            if (docSnap.exists() && docSnap.data().rtdbReady === true) { unsubscribe(); listenToGameRoom(); }
        });
    };

    const startTimer = () => {
    if(timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(async () => {
        timer.value--;
        if (timer.value <= 0) {
            clearInterval(timerInterval);
            try {
                const finalizeGame = httpsCallable(functions, 'finalizePvpGame');
                const result = await finalizeGame({ gameRoomId: gameRoomId.value });
                gameResult.value = result.data.result;
            } catch (error) {
                console.error("게임 종료 처리 중 에러 발생:", error);
                // 에러가 발생해도, 점수 비교로 승/패/무승부 결과는 보여줍니다.
                const myFinalScore = me.value?.score || 0;
                const opponentFinalScore = opponent.value?.score || 0;
                if (myFinalScore > opponentFinalScore) gameResult.value = 'win';
                else if (myFinalScore < opponentFinalScore) gameResult.value = 'lose';
                else gameResult.value = 'draw';
            } finally {
                // 성공하든 실패하든, 최종 점수를 기록하고 결과 창을 띄웁니다.
                finalScore.value = { me: me.value?.score || 0, opponent: opponent.value?.score || 0 };
                matchState.value = 'finished';
            }
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
        } catch (error) { console.error("매칭 취소 오류:", error); alert('매칭 취소 중 오류가 발생했습니다.'); } finally { isCancelling.value = false; }
    };
    const getIndexFromEvent = (event) => {
      const targetElement = event.target.closest('.cell');
      if (!targetElement) return -1;
      const boardElement = targetElement.parentElement;
      return Array.from(boardElement.children).indexOf(targetElement);
    };

    const handleInputStart = (index) => {
      if (!isMyTurn.value || isProcessing.value) return;
      inputState.value = { startIndex: index, isDragging: true };
    };

    const handleInputMove = (event) => {
      if (!inputState.value.isDragging) return;
      const eventForCoord = event.touches ? event.touches[0] : event;
      const elementUnderFinger = document.elementFromPoint(eventForCoord.clientX, eventForCoord.clientY);
      
      if (!elementUnderFinger) return;

      const currentIndex = getIndexFromEvent({ target: elementUnderFinger });
      const { startIndex } = inputState.value;

      if (currentIndex !== -1 && startIndex !== currentIndex) {
        const r1=Math.floor(startIndex/BOARD_SIZE), c1=startIndex%BOARD_SIZE;
        const r2=Math.floor(currentIndex/BOARD_SIZE), c2=currentIndex%BOARD_SIZE;
        if (Math.abs(r1-r2)+Math.abs(c1-c2)===1) {
            swapAndCheck(startIndex, currentIndex);
            inputState.value.isDragging = false; // 드래그 성공 시 즉시 드래그 상태 해제
        }
      }
    };
    
    const handleInputEnd = () => {
      // 드래그가 성공하지 않았을 때 (isDragging이 여전히 true일 때) 클릭으로 간주
      if (inputState.value.isDragging) {
        selectCell(inputState.value.startIndex);
      }
      inputState.value = { startIndex: null, isDragging: false };
    };

    const selectCell = (index) => {
        if (!isMyTurn.value || isProcessing.value) return;
        if (selectedCell.value === null) { 
            selectedCell.value = index; 
        } else { 
            const r1=Math.floor(selectedCell.value/BOARD_SIZE), c1=selectedCell.value%BOARD_SIZE;
            const r2=Math.floor(index/BOARD_SIZE), c2=index%BOARD_SIZE;
            if (Math.abs(r1-r2)+Math.abs(c1-c2)===1) {
                swapAndCheck(selectedCell.value, index);
            }
            selectedCell.value = null; 
        }
    };
    
    // --- 생명주기 훅 ---
    onMounted(() => {
      startMatchmaking();
      window.addEventListener('mousemove', handleInputMove);
      window.addEventListener('mouseup', handleInputEnd);
      window.addEventListener('touchmove', handleInputMove);
      window.addEventListener('touchend', handleInputEnd);
    });

    onBeforeRouteLeave(async () => {
      if(roomListener) roomListener(); if(timerInterval) clearInterval(timerInterval); if(matchInfoUnsubscribe) matchInfoUnsubscribe(); if(matchState.value === 'searching' && auth.currentUser && !isCancelling.value) { const cancelFunc = httpsCallable(functions, 'cancelMatchmaking'); await cancelFunc(); }
      if(roomRef) remove(roomRef);
      window.removeEventListener('mousemove', handleInputMove);
      window.removeEventListener('mouseup', handleInputEnd);
      window.removeEventListener('touchmove', handleInputMove);
      window.removeEventListener('touchend', handleInputEnd);
    });
    
    return {
      BOARD_SIZE, board, selectedCell, explodingGems, matchState, isCancelling,
      gameResult, finalScore, timer, me, opponent, isMyTurn, isOpponentTurn, resultText,
      getGemImage, cancelMatchmaking, handleInputStart,
    };
  }
}
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
.game-area { width: 100%; max-width: 500px; display: flex; flex-direction: column; gap: 10px; position: relative; }
.player-info { padding: 10px 20px; font-size: 1.2em; font-weight: bold; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; box-shadow: inset 0 2px 4px rgba(0,0,0,0.1); transition: all 0.3s ease; border: 2px solid transparent; }
.player-info.active-turn { border-color: #ffd700; box-shadow: 0 0 15px #ffd700, inset 0 2px 4px rgba(0,0,0,0.1); }
.turn-indicator { font-size: 0.8em; font-weight: bold; background: #ffd700; color: #333; padding: 3px 8px; border-radius: 5px; }
.player-info .info-text { display: flex; flex-direction: column; align-items: flex-start; }
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