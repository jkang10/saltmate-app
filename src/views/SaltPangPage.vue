<template>
  <div class="salt-pang-container">
    <div v-if="gameMode === 'selection'" class="selection-screen">
      <img src="@/assets/slatpang.png" alt="Salt Pang Logo" class="game-logo">
      <p>플레이할 싱글 플레이 모드를 선택하세요.</p>
      <div class="active-missions">
        <div v-if="dailyMission" class="mission-card daily">
          <strong>오늘의 미션</strong>
          <span>솔트팡에서 {{ dailyMission.targetType }} {{ dailyMission.targetCount }}개 제거</span>
          <small>보상: {{ dailyMission.reward }} SaltMate</small>
        </div>
        <div v-if="weeklyMission" class="mission-card weekly">
          <strong>이번 주 미션</strong>
          <span>솔트팡 {{ weeklyMission.targetCount }}번 플레이</span>
          <small>보상: {{ weeklyMission.reward }} SaltMate</small>
        </div>
      </div>
      <div class="mode-buttons">
        <button @click="startGame('classic')" class="btn-mode-select classic">
          <div class="btn-title"><i class="fas fa-chess-king"></i> 클래식 모드</div>
          <div class="btn-desc">30번의 이동 횟수 안에 최고 점수에 도전하세요!</div>
        </button>
        <button @click="startGame('timeAttack')" class="btn-mode-select time-attack">
          <div class="btn-title"><i class="fas fa-bolt"></i> 타임 어택</div>
          <div class="btn-desc">120초의 시간 안에 최고 점수에 도전하세요!</div>
        </button>
        <button @click="startGame('infinite')" class="btn-mode-select infinite">
          <div class="btn-title"><i class="fas fa-infinity"></i> 무한 모드</div>
          <div class="btn-desc">이동과 시간 제한 없이 자유롭게 플레이하세요!</div>
        </button>
        <button @click="startGame('mission')" class="btn-mode-select mission">
          <div class="btn-title"><i class="fas fa-flag-checkered"></i> 미션 모드</div>
          <div class="btn-desc">주어지는 미션을 클리어하고 보너스를 받으세요!</div>
        </button>
      </div>
    </div>

    <div v-else class="game-screen">
      <div v-if="gameOver" class="game-over-overlay">
        <div class="game-over-modal">
          <h2>{{ mission?.cleared ? '미션 성공!' : '게임 종료' }}</h2>
          <p>최종 점수: {{ score.toLocaleString() }}</p>
          <p v-if="mission?.cleared">미션 클리어 보너스: +{{ mission.reward.toLocaleString() }} SaltMate</p>
          <p>획득 SaltMate: {{ earnedPoints.toLocaleString() }}</p>
          <div class="modal-actions">
            <button @click="restartGame" class="btn-restart">다시 시작</button>
            <button @click="backToSelection" class="btn-home">모드 선택으로</button>
          </div>
        </div>
      </div>

      <header class="game-header">
        <div class="header-item score-display">
          <i class="fas fa-star"></i>
          <span>{{ score.toLocaleString() }}</span>
        </div>
        <div v-if="gameMode === 'classic' || gameMode === 'mission'" class="header-item moves-display">
          <i class="fas fa-arrows-alt"></i>
          <span>남은 횟수: {{ movesLeft }}</span>
        </div>
        <div v-if="gameMode === 'timeAttack'" class="header-item timer-display">
          <i class="fas fa-clock"></i>
          <span>{{ formattedTime }}</span>
        </div>
        <div v-if="gameMode === 'mission' && mission" class="header-item mission-display">
          <img :src="getMissionGemImage()" class="mission-gem-icon"/>
          <span>{{ mission.clearedCount }} / {{ mission.targetCount }}</span>
        </div>
      </header>

      <div class="game-board-wrapper">
        <div class="game-board" :style="boardStyle">
          <div v-if="isJackpotRound" class="jackpot-effect">JACKPOT!</div>

          <div v-for="effect in effects" :key="effect.id" class="effect" :style="getEffectStyle(effect)" :class="effect.type"></div>

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
       <button @click="backToSelection" class="btn-back-selection">모드 선택으로 돌아가기</button>
    </div>
  </div>
</template>

<script>
import { ref, reactive, onMounted, onUnmounted, computed } from 'vue';
import { auth, db, functions } from '@/firebaseConfig';
import { doc, getDoc, collection, query, getDocs } from "firebase/firestore";
import { httpsCallable } from 'firebase/functions';

export default {
  name: 'SaltPangPage',
  setup() {
    const gameMode = ref('selection');
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
    const mission = ref(null);
    let timer = null;

    // [기존 기능 유지] 잭팟, 미션, 아이템 관련 상태
    const jackpotContribution = ref(0);
    const jackpotChance = ref(0.01);
    const isJackpotRound = ref(false);
    const activeItems = ref([]);
    const dailyMission = ref(null);
    const weeklyMission = ref(null);

    // [핵심 추가] 드래그 & 특수효과 상태
    const effects = ref([]);
    const interaction = reactive({
      startGem: null, startX: 0, startY: 0, didMove: false, 
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
    
    // [핵심 수정] 애니메이션 충돌 방지를 위한 CSS 변수 사용
    const getGemStyle = (gem) => ({
      '--gem-x': gem.x, '--gem-y': gem.y,
      backgroundImage: `url(${require(`@/assets/gems/${gem.type}.png`)})`,
    });
    
    // [핵심 추가] 특수 효과 스타일 계산
    const getEffectStyle = (effect) => ({
      left: `${effect.x * GEM_SIZE + GEM_SIZE/2}px`,
      top: `${effect.y * GEM_SIZE + GEM_SIZE/2}px`,
    });

    const getMissionGemImage = () => {
        if (!mission.value) return '';
        try {
            return require(`@/assets/gems/${mission.value.targetType}.png`);
        } catch { return ''; }
    };

    const createGem = (x, y, type = null) => ({
      id: Date.now() + Math.random(), x, y,
      type: type || GEM_TYPES[Math.floor(Math.random() * GEM_TYPES.length)],
    });

    const initializeBoard = () => {
      let tempBoard = [];
      for (let y = 0; y < BOARD_SIZE; y++) { for (let x = 0; x < BOARD_SIZE; x++) { tempBoard.push(createGem(x, y)); } }
      board.value = tempBoard;
    };
    
    const findMatches = () => {
      // ... 기존 findMatches 로직과 동일 ...
      const matches = new Set();
      if (!board.value || board.value.length === 0) return [];
      for (let y = 0; y < BOARD_SIZE; y++) {
        for (let x = 0; x < BOARD_SIZE; x++) {
          const gem = board.value.find(g => g.x === x && g.y === y);
          if (!gem) continue;
          if (x > 1) {
            const g1 = board.value.find(g => g.x === x - 1 && g.y === y); const g2 = board.value.find(g => g.x === x - 2 && g.y === y);
            if (g1 && g2 && gem.type === g1.type && gem.type === g2.type) { [gem, g1, g2].forEach(g => matches.add(g)); }
          }
          if (y > 1) {
            const g1 = board.value.find(g => g.x === x && g.y === y - 1); const g2 = board.value.find(g => g.x === x && g.y === y - 2);
            if (g1 && g2 && gem.type === g1.type && gem.type === g2.type) { [gem, g1, g2].forEach(g => matches.add(g)); }
          }
        }
      }
      return Array.from(matches);
    };

    const handleMatches = async (initialMatches) => {
        let currentMatches = initialMatches;
        while (currentMatches.length > 0) {
            const matchScore = currentMatches.length * 10;
            score.value += matchScore;

            // [기존 기능 유지] 잭팟 기여금 적립
            const contribution = Math.floor(matchScore * 0.05);
            jackpotContribution.value += contribution;

            // [핵심 추가] 특수 효과 생성
            if (currentMatches.length >= 4) {
                const centerX = currentMatches.reduce((sum, gem) => sum + gem.x, 0) / currentMatches.length;
                const centerY = currentMatches.reduce((sum, gem) => sum + gem.y, 0) / currentMatches.length;
                const effect = { id: Date.now(), x: centerX, y: centerY, type: currentMatches.length >= 5 ? 'effect-bomb-clear' : 'effect-line-clear' };
                effects.value.push(effect);
                setTimeout(() => { effects.value = effects.value.filter(e => e.id !== effect.id); }, 500);
            }

            // [기존 기능 유지] 미션 카운트
            if (dailyMission.value && !dailyMission.value.cleared) {
                const clearedDailyGems = currentMatches.filter(gem => gem.type.includes(dailyMission.value.targetType)).length;
                if(clearedDailyGems > 0) {
                    const updateMission = httpsCallable(functions, 'updateMissionProgress');
                    updateMission({ missionId: dailyMission.value.id, type: 'daily', progress: clearedDailyGems });
                }
            }
            if (gameMode.value === 'mission' && mission.value && !mission.value.cleared) {
                const clearedMissionGems = currentMatches.filter(gem => gem.type === mission.value.targetType).length;
                mission.value.clearedCount += clearedMissionGems;
                if(mission.value.clearedCount >= mission.value.targetCount) {
                    mission.value.cleared = true;
                    setTimeout(endGame, 500);
                }
            }
            
            const gemsToRemove = new Set(currentMatches.map(m => m.id));
            board.value = board.value.filter(gem => !gemsToRemove.has(gem.id));
            await new Promise(resolve => setTimeout(resolve, 150));

            let nextBoard = [];
            for (let x = 0; x < BOARD_SIZE; x++) {
                const columnGems = board.value.filter(g => g.x === x);
                const missingCount = BOARD_SIZE - columnGems.length;
                columnGems.sort((a, b) => a.y - b.y).forEach((gem, index) => { nextBoard.push({ ...gem, y: BOARD_SIZE - columnGems.length + index }); });
                for (let i = 0; i < missingCount; i++) { nextBoard.push(createGem(x, i)); }
            }
            board.value = nextBoard;
            await new Promise(resolve => setTimeout(resolve, 350));
            currentMatches = findMatches();
        }
    };

    const swapGems = async (gem1, gem2) => {
      // ... 기존 swapGems 로직과 동일 (handleMatches 호출) ...
      if (isProcessing.value) return;
      isProcessing.value = true;
      const gem1Index = board.value.findIndex(g => g.id === gem1.id);
      const gem2Index = board.value.findIndex(g => g.id === gem2.id);
      [board.value[gem1Index].x, board.value[gem2Index].x] = [gem2.x, gem1.x];
      [board.value[gem1Index].y, board.value[gem2Index].y] = [gem2.y, gem1.y];
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // [기존 기능 유지] 잭팟 라운드 처리
      if(isJackpotRound.value) {
        handleJackpotWin();
        isJackpotRound.value = false;
        isProcessing.value = false;
        return;
      }

      const matchesAfterSwap = findMatches();
      if (matchesAfterSwap.length > 0) {
        if(gameMode.value === 'classic' || gameMode.value === 'mission') { if (movesLeft.value > 0) movesLeft.value--; }
        await handleMatches(matchesAfterSwap);
      } else {
        await new Promise(resolve => setTimeout(resolve, 300));
        [board.value[gem1Index].x, board.value[gem2Index].x] = [gem1.x, gem2.x];
        [board.value[gem1Index].y, board.value[gem2Index].y] = [gem1.y, gem2.y];
      }
      
      // [기존 기능 유지] 잭팟 발동 확률 체크
      if (Math.random() < jackpotChance.value) {
        isJackpotRound.value = true;
        // 잭팟 라운드 알림 등의 UI 효과를 여기에 추가할 수 있습니다.
      }
      
      selectedGem.value = null;
      isProcessing.value = false;
      if ((gameMode.value === 'classic' || gameMode.value === 'mission') && movesLeft.value <= 0 && !gameOver.value) { endGame(); }
    };
    
    // [기존 기능 유지] 잭팟 당첨 처리
    const handleJackpotWin = async () => {
        try {
            const triggerJackpot = httpsCallable(functions, 'triggerSaltPangJackpot');
            const result = await triggerJackpot({ contribution: jackpotContribution.value });
            alert(`잭팟 당첨! ${result.data.amount} SaltMate를 획득했습니다!`);
            jackpotContribution.value = 0;
        } catch (error) {
            console.error("잭팟 처리 오류:", error);
            alert("잭팟 처리 중 오류가 발생했습니다.");
        }
    };

    const endGame = async () => {
      // ... 기존 endGame 로직과 동일 ...
      if(gameOver.value) return;
      gameOver.value = true;
      clearInterval(timer);
      const saveScore = httpsCallable(functions, 'saveSaltPangScore');
      try {
        const result = await saveScore({ score: score.value, mode: gameMode.value, cleared: mission.value?.cleared || false });
        earnedPoints.value = result.data.earnedPoints;
      } catch (error) { console.error("점수 저장 실패:", error); earnedPoints.value = 0; }
    };

    const restartGame = () => {
        // ... 기존 restartGame 로직과 동일 ...
        isProcessing.value = true;
        Object.assign(interaction, { startGem: null, startX: 0, startY: 0, didMove: false });
        effects.value = []; score.value = 0; gameOver.value = false; earnedPoints.value = 0; selectedGem.value = null;
        if (gameMode.value === 'classic') { movesLeft.value = 30; }
        if (gameMode.value === 'timeAttack') { timeLeft.value = 120; }
        if (gameMode.value === 'infinite') { movesLeft.value = 999; }
        if (gameMode.value === 'mission') {
            movesLeft.value = 30;
            mission.value = {
                targetType: GEM_TYPES[Math.floor(Math.random() * GEM_TYPES.length)],
                targetCount: 15 + Math.floor(Math.random() * 10),
                clearedCount: 0, cleared: false, reward: 2000,
            };
        }
        applyItemEffects();
        do { initializeBoard(); } while (findMatches().length > 0);
        if(timer) clearInterval(timer);
        if(gameMode.value === 'timeAttack') {
            timer = setInterval(() => {
                if(timeLeft.value > 0) { timeLeft.value--; }
                if (timeLeft.value <= 0 && !gameOver.value) { endGame(); }
            }, 1000);
        }
        isProcessing.value = false;
    };

    const startGame = (mode) => {
      gameMode.value = mode;
      restartGame();
    };

    const backToSelection = () => {
      gameMode.value = 'selection';
      if (timer) clearInterval(timer);
    };

    const selectGem = (gem) => {
      // ... 기존 selectGem 로직과 동일 ...
      if (isProcessing.value) return;
      if (selectedGem.value) {
        if (selectedGem.value.id === gem.id) { selectedGem.value = null; }
        else {
          const dx = Math.abs(selectedGem.value.x - gem.x); const dy = Math.abs(selectedGem.value.y - gem.y);
          if (dx + dy === 1) { swapGems(selectedGem.value, gem); } else { selectedGem.value = gem; }
        }
      } else { selectedGem.value = gem; }
    };
    
    // [핵심 추가] 드래그 핸들러 로직 (안정성 검증된 버전)
    const getCoords = (e) => e.touches ? e.touches[0] : e;
    const cleanupInteraction = () => {
      interaction.startGem = null;
      window.removeEventListener('mousemove', handleInteractionMove); window.removeEventListener('touchmove', handleInteractionMove);
      window.removeEventListener('mouseup', handleInteractionEnd); window.removeEventListener('touchend', handleInteractionEnd);
    };
    const handleInteractionStart = (gem, e) => {
      if (isProcessing.value) return;
      interaction.startGem = gem;
      const coords = getCoords(e);
      interaction.startX = coords.clientX; interaction.startY = coords.clientY;
      interaction.didMove = false;
      window.addEventListener('mousemove', handleInteractionMove); window.addEventListener('touchmove', handleInteractionMove);
      window.addEventListener('mouseup', handleInteractionEnd); window.addEventListener('touchend', handleInteractionEnd);
    };
    const handleInteractionMove = (e) => {
      if (!interaction.startGem) return;
      e.preventDefault();
      const coords = getCoords(e);
      const deltaX = coords.clientX - interaction.startX; const deltaY = coords.clientY - interaction.startY;
      const dragThreshold = 10;
      if (Math.abs(deltaX) > dragThreshold || Math.abs(deltaY) > dragThreshold) {
        interaction.didMove = true;
        let direction = Math.abs(deltaX) > Math.abs(deltaY) ? (deltaX > 0 ? 'right' : 'left') : (deltaY > 0 ? 'down' : 'up');
        const start = interaction.startGem;
        let targetX = start.x; let targetY = start.y;
        if (direction === 'right') targetX++; else if (direction === 'left') targetX--; else if (direction === 'up') targetY--; else if (direction === 'down') targetY++;
        const targetGem = board.value.find(g => g.x === targetX && g.y === targetY);
        if (targetGem) { swapGems(start, targetGem); }
        cleanupInteraction();
      }
    };
    const handleInteractionEnd = () => {
      if (!interaction.didMove && interaction.startGem) { selectGem(interaction.startGem); }
      cleanupInteraction();
    };

    // [기존 기능 유지] 아이템 및 미션 데이터 로딩
    const fetchActiveItems = async () => {
        const q = query(collection(db, `users/${auth.currentUser.uid}/active_items`));
        const querySnapshot = await getDocs(q);
        activeItems.value = querySnapshot.docs.map(doc => doc.data());
    };
    const applyItemEffects = () => {
        activeItems.value.forEach(item => {
            if(item.id === 'move_plus_5' && gameMode.value === 'classic') movesLeft.value += 5;
            if(item.id === 'time_plus_30' && gameMode.value === 'timeAttack') timeLeft.value += 30;
        });
    };
    const fetchMissions = async () => {
        const uid = auth.currentUser.uid;
        const today = new Date();
        today.setHours(today.getHours() + 9);
        const todayStr = today.toISOString().slice(0, 10);
        const dayOfWeek = today.getUTCDay();
        const monday = new Date(today);
        monday.setDate(today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
        const weekId = monday.toISOString().slice(0, 10);

        const dailyMissionRef = doc(db, `users/${uid}/daily_missions`, todayStr);
        const weeklyMissionRef = doc(db, `users/${uid}/weekly_missions`, weekId);

        const [dailySnap, weeklySnap] = await Promise.all([getDoc(dailyMissionRef), getDoc(weeklyMissionRef)]);
        if (dailySnap.exists() && dailySnap.data().game === 'saltPang' && !dailySnap.data().cleared) {
            dailyMission.value = { id: dailySnap.id, ...dailySnap.data() };
        }
        if (weeklySnap.exists() && weeklySnap.data().game === 'saltPang' && !weeklySnap.data().cleared) {
            weeklyMission.value = { id: weeklySnap.id, ...weeklySnap.data() };
        }
    };

    onMounted(() => {
      if (auth.currentUser) {
        fetchActiveItems();
        fetchMissions();
      }
    });

    onUnmounted(() => {
      clearInterval(timer);
      cleanupInteraction();
    });

    return {
      gameMode, board, selectedGem, score, movesLeft, timeLeft, gameOver, earnedPoints,
      boardStyle, formattedTime, getGemStyle, selectGem, restartGame, mission,
      handleInteractionStart, startGame, backToSelection, effects, getEffectStyle, getMissionGemImage,
      dailyMission, weeklyMission
    };
  }
};
</script>


<style scoped>
/* 이전과 거의 동일한 스타일에 일부 추가 및 수정 */
.salt-pang-container{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;background:linear-gradient(to bottom, #2c3e50, #1a2a3a);color:#fff;padding:20px;box-sizing:border-box}
.selection-screen{text-align:center;background:rgba(0,0,0,0.2);padding:40px;border-radius:20px;box-shadow:0 10px 30px rgba(0,0,0,.4);backdrop-filter:blur(5px)}
.game-logo{width:250px;margin-bottom:20px}
.selection-screen p{font-size:1.2em;color:#ecf0f1;margin-bottom:20px}
.active-missions{display:flex;flex-direction:column;gap:10px;margin-bottom:30px;width:100%;max-width:500px}
.mission-card{background:rgba(0,0,0,0.3);padding:15px;border-radius:10px;text-align:left;border-left:5px solid}
.mission-card.daily{border-color:#3498db}
.mission-card.weekly{border-color:#9b59b6}
.mission-card strong{display:block;font-size:1.1em;margin-bottom:5px}
.mission-card span{font-size:0.95em}
.mission-card small{display:block;margin-top:5px;opacity:0.8;font-size:0.9em}
.mode-buttons{display:grid;gap:20px;grid-template-columns:1fr 1fr}
.btn-mode-select{padding:20px;font-weight:700;border:1px solid rgba(255,255,255,0.2);border-radius:15px;cursor:pointer;transition:all .3s ease;background:rgba(255,255,255,0.1);color:#fff;text-align:left}
.btn-mode-select:hover:not(:disabled){background:rgba(255,255,255,0.2);transform:translateY(-5px);box-shadow:0 8px 20px rgba(0,0,0,0.3)}
.btn-mode-select.classic{--color:#3498db}.btn-mode-select.time-attack{--color:#f1c40f}.btn-mode-select.infinite{--color:#9b59b6}.btn-mode-select.mission{--color:#e74c3c}
.btn-title{font-size:1.4em;margin-bottom:8px;color:var(--color)}
.btn-desc{font-size:0.9em;color:#bdc3c7;line-height:1.4}
.btn-mode-select .fas{margin-right:10px;width:20px}
.game-screen{display:flex;flex-direction:column;align-items:center;width:100%}
.game-header{display:flex;justify-content:space-around;align-items:center;width:100%;max-width:420px;margin-bottom:20px;background:#34495e;padding:10px 15px;border-radius:10px}
.header-item{display:flex;align-items:center;font-size:1.4em;font-weight:700}
.header-item i{margin-right:8px}
.mission-display{background:rgba(0,0,0,0.3);padding:5px 10px;border-radius:8px;font-size:1.2em}
.mission-gem-icon{width:24px;height:24px;margin-right:5px;vertical-align:middle}
.game-board-wrapper{background:#34495e;padding:10px;border-radius:10px;box-shadow:0 5px 15px rgba(0,0,0,.3)}
.game-board{position:relative}
.jackpot-effect{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:5em;font-weight:900;color:#ffd700;text-shadow:0 0 20px #ff0,0 0 30px #f90;z-index:10;animation:jackpot-anim 1s ease-out}
@keyframes jackpot-anim{0%{opacity:0;transform:translate(-50%,-50%) scale(0.5)}50%{opacity:1;transform:translate(-50%,-50%) scale(1.2)}100%{opacity:0;transform:translate(-50%,-50%) scale(1.5)}}
.gem{width:50px;height:50px;position:absolute;background-size:cover;cursor:pointer;-webkit-user-drag:none;user-select:none;touch-action:none;transform:translate(calc(var(--gem-x) * 50px),calc(var(--gem-y) * 50px));transition:transform .3s ease}
.gem.selected{animation:pulse .6s infinite alternate}
@keyframes pulse{to{transform:translate(calc(var(--gem-x) * 50px),calc(var(--gem-y) * 50px)) scale(1.1);box-shadow:0 0 15px #f1c40f;border-radius:5px}}
.game-over-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.7);display:flex;justify-content:center;align-items:center;z-index:100;backdrop-filter:blur(5px)}
.game-over-modal{background:#34495e;padding:40px;border-radius:15px;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.5)}
.game-over-modal h2{margin-top:0;font-size:2.5em;color:#f1c40f}
.modal-actions{margin-top:30px;display:flex;gap:20px;flex-wrap:wrap;justify-content:center}
.btn-restart,.btn-home{padding:12px 25px;border:none;border-radius:8px;font-size:1.1em;font-weight:700;cursor:pointer;text-decoration:none;color:#fff;transition:background-color .2s}
.btn-restart{background-color:#2980b9}.btn-restart:hover{background-color:#3498db}.btn-home{background-color:#27ae60}.btn-home:hover{background-color:#2ecc71}
.btn-back-selection{margin-top:25px;padding:10px 20px;background:#7f8c8d;color:#fff;border:none;border-radius:8px;font-size:1em;cursor:pointer}
.effect{position:absolute;border-radius:50%;transform:translate(-50%,-50%);pointer-events:none}
.effect.effect-line-clear{width:50px;height:50px;border:3px solid #fff;animation:line-clear .5s ease-out forwards}
.effect.effect-bomb-clear{width:50px;height:50px;background:rgba(255,255,255,0.8);animation:bomb-clear .5s ease-out forwards}
@keyframes line-clear{0%{transform:translate(-50%,-50%) scale(1);opacity:1}100%{transform:translate(-50%,-50%) scale(3);opacity:0}}
@keyframes bomb-clear{0%{transform:translate(-50%,-50%) scale(1);opacity:1;box-shadow:0 0 30px #fff}100%{transform:translate(-50%,-50%) scale(4);opacity:0;box-shadow:0 0 50px #fff}}
@media (max-width:520px){.mode-buttons{grid-template-columns:1fr}.game-board-wrapper{padding:5px}.gem{width:calc((100vw - 30px)/ 8);height:calc((100vw - 30px)/ 8);--gem-size:calc((100vw - 30px)/ 8);transform:translate(calc(var(--gem-x) * var(--gem-size)),calc(var(--gem-y) * var(--gem-size)))}.game-board{width:calc(100vw - 30px);height:calc(100vw - 30px)}.game-header{flex-direction:column;gap:10px;align-items:flex-start}}
</style>