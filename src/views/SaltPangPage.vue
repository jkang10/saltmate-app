<template>
  <div class="salt-pang-container">
    <div v-if="gameOver" class="game-over-overlay">
      <div class="game-over-modal">
        <h2>게임 종료</h2>
        <p>최종 점수: {{ score.toLocaleString() }}</p>
        <p>획득 SaltMate: {{ earnedPoints.toLocaleString() }}</p>
        <div class="modal-actions">
          <button @click="restartGame" class="btn-restart">다시 시작</button>
          <router-link to="/dashboard" class="btn-home">대시보드로</router-link>
        </div>
      </div>
    </div>

    <header class="game-header">
      <div class="header-item score-display">
        <i class="fas fa-star"></i>
        <span>{{ score.toLocaleString() }}</span>
      </div>
      <div class="header-item moves-display">
        <i class="fas fa-arrows-alt"></i>
        <span>남은 횟수: {{ movesLeft }}</span>
      </div>
      <div class="header-item timer-display">
        <i class="fas fa-clock"></i>
        <span>{{ formattedTime }}</span>
      </div>
    </header>

    <div class="game-board-wrapper">
      <div class="game-board" :style="boardStyle">
        <div 
          v-for="gem in board" 
          :key="gem.id" 
          class="gem" 
          :style="getGemStyle(gem)"
          :class="[gem.type, { 'selected': selectedGem && selectedGem.id === gem.id }]"
          @click="selectGem(gem)"
          @mousedown.prevent="handleInteractionStart(gem, $event)"
          @touchstart.prevent="handleInteractionStart(gem, $event)">
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, onMounted, onUnmounted, computed } from 'vue';
import { functions } from '@/firebaseConfig';
import { httpsCallable } from 'firebase/functions';

export default {
  name: 'SaltPangPage',
  setup() {
    const BOARD_SIZE = 8;
    const GEM_SIZE = 50;
    const GEM_TYPES = ['gem-1', 'gem-2', 'gem-3', 'gem-4', 'gem-5', 'gem-6'];

    const board = ref([]);
    const selectedGem = ref(null);
    const score = ref(0);
    const movesLeft = ref(30);
    const timeLeft = ref(120);
    const gameOver = ref(false);
    const earnedPoints = ref(0);
    const isProcessing = ref(false);
    let timer = null;

    const interaction = reactive({
      startGem: null,
      startX: 0,
      startY: 0,
      didMove: false, 
    });

    const boardStyle = computed(() => ({
      width: `${BOARD_SIZE * GEM_SIZE}px`,
      height: `${BOARD_SIZE * GEM_SIZE}px`,
    }));

    const formattedTime = computed(() => {
      const minutes = Math.floor(timeLeft.value / 60);
      const seconds = timeLeft.value % 60;
      return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    });

    const getGemStyle = (gem) => ({
      '--gem-x': gem.x,
      '--gem-y': gem.y,
      backgroundImage: `url(${require(`@/assets/gems/${gem.type}.png`)})`,
    });

    const createGem = (x, y, type = null) => ({
      id: Date.now() + Math.random(),
      x,
      y,
      type: type || GEM_TYPES[Math.floor(Math.random() * GEM_TYPES.length)],
    });

    const initializeBoard = () => {
      let tempBoard = [];
      for (let y = 0; y < BOARD_SIZE; y++) {
        for (let x = 0; x < BOARD_SIZE; x++) {
          tempBoard.push(createGem(x, y));
        }
      }
      board.value = tempBoard;
    };
    
    const findMatches = () => {
      const matches = new Set();
      if (!board.value) return [];
      for (let y = 0; y < BOARD_SIZE; y++) {
        for (let x = 0; x < BOARD_SIZE; x++) {
          const gem = board.value.find(g => g.x === x && g.y === y);
          if (!gem) continue;
          if (x > 1) {
            const gemLeft1 = board.value.find(g => g.x === x - 1 && g.y === y);
            const gemLeft2 = board.value.find(g => g.x === x - 2 && g.y === y);
            if (gemLeft1 && gemLeft2 && gem.type === gemLeft1.type && gem.type === gemLeft2.type) {
              matches.add(gem);
              matches.add(gemLeft1);
              matches.add(gemLeft2);
            }
          }
          if (y > 1) {
            const gemUp1 = board.value.find(g => g.x === x && g.y === y - 1);
            const gemUp2 = board.value.find(g => g.x === x && g.y === y - 2);
            if (gemUp1 && gemUp2 && gem.type === gemUp1.type && gem.type === gemUp2.type) {
              matches.add(gem);
              matches.add(gemUp1);
              matches.add(gemUp2);
            }
          }
        }
      }
      return Array.from(matches);
    };

    // ==================== [핵심 수정 1] 통합된 매치 처리 함수 ====================
    const handleMatches = async (initialMatches) => {
        let matches = initialMatches;
        while (matches.length > 0) {
            score.value += matches.length * 10;
            
            // 1. 매칭된 보석 제거
            board.value = board.value.filter(gem => !matches.some(m => m.id === gem.id));
            await new Promise(resolve => setTimeout(resolve, 150));

            // 2. 남은 보석 내리기와 새 보석 채우기 동시 진행
            for (let x = 0; x < BOARD_SIZE; x++) {
                const columnGems = board.value.filter(g => g.x === x);
                const missingCount = BOARD_SIZE - columnGems.length;

                // 2-1. 남은 보석들 위치 재조정 (아래로 내리기)
                columnGems.sort((a, b) => a.y - b.y).forEach((gem, index) => {
                    gem.y = BOARD_SIZE - columnGems.length + index;
                });
                
                // 2-2. 빈 공간에 새 보석 생성 (화면 위쪽)
                for (let i = 0; i < missingCount; i++) {
                    board.value.push(createGem(x, i - missingCount));
                }
            }
            
            // 3. 애니메이션 시간 대기
            await new Promise(resolve => setTimeout(resolve, 350));
            
            // 4. 연쇄 반응을 위한 새로운 매치 확인
            matches = findMatches();
        }
    };

    const swapGems = async (gem1, gem2) => {
      if (isProcessing.value) return;
      isProcessing.value = true;
      
      const gem1Index = board.value.findIndex(g => g.id === gem1.id);
      const gem2Index = board.value.findIndex(g => g.id === gem2.id);

      [board.value[gem1Index].x, board.value[gem2Index].x] = [gem2.x, gem1.x];
      [board.value[gem1Index].y, board.value[gem2Index].y] = [gem2.y, gem1.y];
      
      await new Promise(resolve => setTimeout(resolve, 300));

      const matchesAfterSwap = findMatches();
      if (matchesAfterSwap.length > 0) {
        movesLeft.value--;
        await handleMatches(matchesAfterSwap); // 수정된 함수 호출
      } else {
        await new Promise(resolve => setTimeout(resolve, 300));
        [board.value[gem1Index].x, board.value[gem2Index].x] = [gem1.x, gem2.x];
        [board.value[gem1Index].y, board.value[gem2Index].y] = [gem1.y, gem2.y];
      }
      
      selectedGem.value = null;
      isProcessing.value = false;

      if (movesLeft.value <= 0 && !gameOver.value) {
        endGame();
      }
    };

    const endGame = async () => {
      if(gameOver.value) return;
      gameOver.value = true;
      clearInterval(timer);
      const saveScore = httpsCallable(functions, 'saveSaltPangScore');
      try {
        const result = await saveScore({ score: score.value });
        earnedPoints.value = result.data.earnedPoints;
      } catch (error) {
        console.error("점수 저장 실패:", error);
        earnedPoints.value = 0;
      }
    };

    // ==================== [핵심 수정 2] 안정화된 게임 시작 함수 ====================
    const restartGame = async () => {
      score.value = 0;
      movesLeft.value = 30;
      timeLeft.value = 120;
      gameOver.value = false;
      earnedPoints.value = 0;
      isProcessing.value = false;
      selectedGem.value = null;
      
      // 보드를 생성하고, 시작 시점에 있는 매칭을 비동기적으로 처리
      do {
        initializeBoard();
      } while (findMatches().length > 0);
      
      isProcessing.value = true;
      const initialMatches = findMatches();
      if (initialMatches.length > 0) {
          await handleMatches(initialMatches);
      }
      isProcessing.value = false;
      
      if(timer) clearInterval(timer);
      timer = setInterval(() => {
        if(timeLeft.value > 0){
          timeLeft.value--;
        }
        if (timeLeft.value <= 0 && !gameOver.value) {
          endGame();
        }
      }, 1000);
    };

    const selectGem = (gem) => {
      if (isProcessing.value) return;

      if (selectedGem.value) {
        if (selectedGem.value.id === gem.id) {
          selectedGem.value = null;
        } else {
          const dx = Math.abs(selectedGem.value.x - gem.x);
          const dy = Math.abs(selectedGem.value.y - gem.y);
          if (dx + dy === 1) {
            swapGems(selectedGem.value, gem);
          } else {
            selectedGem.value = gem;
          }
        }
      } else {
        selectedGem.value = gem;
      }
    };

    const getCoords = (e) => {
      return e.touches ? e.touches[0] : e;
    };

    const cleanupInteraction = () => {
      interaction.startGem = null;
      window.removeEventListener('mousemove', handleInteractionMove);
      window.removeEventListener('touchmove', handleInteractionMove);
      window.removeEventListener('mouseup', handleInteractionEnd);
      window.removeEventListener('touchend', handleInteractionEnd);
    };

    const handleInteractionStart = (gem, e) => {
      if (isProcessing.value) return;
      interaction.startGem = gem;
      const coords = getCoords(e);
      interaction.startX = coords.clientX;
      interaction.startY = coords.clientY;
      interaction.didMove = false;

      window.addEventListener('mousemove', handleInteractionMove);
      window.addEventListener('touchmove', handleInteractionMove);
      window.addEventListener('mouseup', handleInteractionEnd);
      window.addEventListener('touchend', handleInteractionEnd);
    };

    const handleInteractionMove = (e) => {
      if (!interaction.startGem) return;
      e.preventDefault();
      const coords = getCoords(e);
      const deltaX = coords.clientX - interaction.startX;
      const deltaY = coords.clientY - interaction.startY;
      const dragThreshold = 10;

      if (Math.abs(deltaX) > dragThreshold || Math.abs(deltaY) > dragThreshold) {
        interaction.didMove = true;
        let direction = '';
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          direction = deltaX > 0 ? 'right' : 'left';
        } else {
          direction = deltaY > 0 ? 'down' : 'up';
        }

        const start = interaction.startGem;
        let targetX = start.x;
        let targetY = start.y;

        if (direction === 'right') targetX++;
        else if (direction === 'left') targetX--;
        else if (direction === 'up') targetY--;
        else if (direction === 'down') targetY++;

        const targetGem = board.value.find(g => g.x === targetX && g.y === targetY);
        if (targetGem) {
          swapGems(start, targetGem);
        }
        cleanupInteraction();
      }
    };

    const handleInteractionEnd = () => {
      if (!interaction.didMove && interaction.startGem) {
        selectGem(interaction.startGem);
      }
      cleanupInteraction();
    };

    onMounted(() => {
      restartGame();
    });

    onUnmounted(() => {
      clearInterval(timer);
      cleanupInteraction();
    });

    return {
      board,
      selectedGem,
      score,
      movesLeft,
      gameOver,
      earnedPoints,
      boardStyle,
      formattedTime,
      getGemStyle,
      selectGem,
      restartGame,
      handleInteractionStart,
    };
  }
};
</script>


<style scoped>
.salt-pang-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: #2c3e50;
  color: white;
  padding: 20px;
  box-sizing: border-box;
}
.game-header {
  display: flex;
  justify-content: space-around;
  width: 100%;
  max-width: 420px;
  margin-bottom: 20px;
  background: #34495e;
  padding: 15px;
  border-radius: 10px;
}
.header-item {
  display: flex;
  align-items: center;
  font-size: 1.5em;
  font-weight: bold;
}
.header-item i {
  margin-right: 10px;
}
.game-board-wrapper {
  background: #34495e;
  padding: 10px;
  border-radius: 10px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
}
.game-board {
  position: relative;
}
.gem {
  width: 50px;
  height: 50px;
  position: absolute;
  background-size: cover;
  cursor: pointer;
  -webkit-user-drag: none;
  user-select: none;
  touch-action: none;
  transform: translate(calc(var(--gem-x) * 50px), calc(var(--gem-y) * 50px));
  transition: transform 0.3s ease;
}
.gem.selected {
  animation: pulse 0.6s infinite alternate;
}
@keyframes pulse {
  to {
    transform: translate(calc(var(--gem-x) * 50px), calc(var(--gem-y) * 50px)) scale(1.1);
    box-shadow: 0 0 15px #f1c40f;
    border-radius: 5px;
  }
}
.game-over-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 100;
}
.game-over-modal {
  background: #34495e;
  padding: 40px;
  border-radius: 15px;
  text-align: center;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
}
.game-over-modal h2 {
  margin-top: 0;
  font-size: 2.5em;
  color: #f1c40f;
}
.modal-actions {
  margin-top: 30px;
  display: flex;
  gap: 20px;
}
.btn-restart, .btn-home {
  padding: 12px 25px;
  border: none;
  border-radius: 8px;
  font-size: 1.1em;
  font-weight: bold;
  cursor: pointer;
  text-decoration: none;
  color: white;
  transition: background-color 0.2s;
}
.btn-restart { background-color: #2980b9; }
.btn-restart:hover { background-color: #3498db; }
.btn-home { background-color: #27ae60; }
.btn-home:hover { background-color: #2ecc71; }
@media (max-width: 480px) {
  .game-board-wrapper {
    padding: 5px;
  }
  .gem {
    width: calc((100vw - 30px) / 8);
    height: calc((100vw - 30px) / 8);
    --gem-size: calc((100vw - 30px) / 8); 
    transform: translate(calc(var(--gem-x) * var(--gem-size)), calc(var(--gem-y) * var(--gem-size)));
  }
  .game-board {
    width: calc(100vw - 30px);
    height: calc(100vw - 30px);
  }
  .game-header {
    flex-direction: column;
    gap: 10px;
    align-items: flex-start;
  }
}
</style>