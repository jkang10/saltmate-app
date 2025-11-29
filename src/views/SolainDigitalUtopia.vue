<template>
  <div class="utopia-container" @click="handleGlobalClick">
    <canvas ref="canvasRef" class="main-canvas" tabindex="0"></canvas>

    <video
      ref="cinemaVideoRef"
      id="cinema-video"
      style="position: absolute; top: -9999px; left: -9999px; opacity: 0;"
      crossorigin="anonymous"
      playsinline
      webkit-playsinline
      loop
      muted
      autoplay
      preload="auto"
      @error="(e) => console.warn('비디오 에러(무시 가능):', e)"
    >
      <source src="/videos/helia_tea.mp4" type="video/mp4">
    </video>

    <div v-if="isLoading" class="loading-overlay">
      <div class="spinner"></div>
      <p>{{ loadingMessage }}</p>
    </div>

    <div id="joystick-zone" class="joystick-zone"></div>

    <div v-if="dailyQuest" class="quest-widget fade-in">
      <div class="quest-title">📜 {{ dailyQuest.title }}</div>
      <div class="quest-info">
        <template v-if="dailyQuest.rewardsRemaining > 0">
            진행: {{ dailyQuest.currentCount }} / {{ dailyQuest.target }}
            <br>
            <small>(남은 보상: {{ dailyQuest.rewardsRemaining }}회)</small>
            <span v-if="isQuestReadyToClaim" class="quest-complete"> (완료 가능!)</span>
        </template>
        <template v-else>
            🎉 오늘의 의뢰 완료!
            <br><small>내일 다시 와주세요.</small>
        </template>
      </div>
    </div>

    <div v-if="nearNpc && !isNpcModalOpen" class="interaction-prompt fade-in">
      <button class="interact-btn" @click="openNpcDialog">
        <i class="fas fa-comment-dots"></i> 데브라와 대화하기 (F)
      </button>
    </div>

    <div v-if="nearChestId" class="interaction-prompt fade-in">
      <button class="interact-btn chest-btn" @click="collectChest">
        <i class="fas fa-hand-sparkles"></i> 줍기 (F)
      </button>
    </div>

    <div v-if="isNpcModalOpen" class="npc-dialog-overlay">
      <div class="npc-dialog-box">
        <div class="npc-portrait">
          <img :src="heliaImgSrc" alt="Helia">
        </div>
        <div class="npc-content">
          <h3>데브라 (Helia Agent)</h3>
          <template v-if="dailyQuest">
            <div v-if="dailyQuest.rewardsRemaining <= 0">
                <p class="quest-desc">오늘의 의뢰는 모두 끝났어요. 내일 다시 와주세요.</p>
                <div class="dialog-actions">
                    <button class="btn-confirm" @click="closeNpcDialog">네, 알겠습니다.</button>
                </div>
            </div>
            
            <div v-else-if="isQuestReadyToClaim">
                <p class="quest-desc">훌륭해요! 의뢰를 완수하셨군요. 여기 보상입니다.</p>
                <div class="quest-progress-bar">
                  <div class="fill" style="width: 100%"></div>
                  <span>{{ dailyQuest.currentCount }} / {{ dailyQuest.target }}</span>
                </div>
                <div class="dialog-actions">
                  <button class="btn-complete" @click="completeQuest">
                    랜덤 보상 받기 (남은 횟수: {{ dailyQuest.rewardsRemaining }})
                  </button>
                </div>
            </div>

            <div v-else>
                <p class="quest-desc">{{ dailyQuest.desc }}</p>
                <div class="quest-progress-bar">
                  <div class="fill" :style="{ width: Math.min(100, (dailyQuest.currentCount / dailyQuest.target) * 100) + '%' }"></div>
                  <span>{{ dailyQuest.currentCount }} / {{ dailyQuest.target }}</span>
                </div>
                <div class="dialog-actions">
                  <button class="btn-confirm" @click="closeNpcDialog">다녀오겠습니다!</button>
                </div>
            </div>
          </template>
          <template v-else>
            <p>잠시만 기다려주세요...</p>
          </template>
        </div>
        <button class="close-dialog" @click="closeNpcDialog">&times;</button>
      </div>
    </div>

    <div class="chat-ui">
      <div class="action-bar">
        <div v-for="(action, key) in actionList" :key="key" class="action-btn-wrapper">
          <button 
            @click="handleActionClick(key)" 
            :title="action.name + (hasPurchased(key) ? '' : ` (${action.price.toLocaleString()} P)`)">
            {{ action.icon }}
            <span v-if="!hasPurchased(key)" class="lock-icon">🔒</span>
          </button>
        </div>
      </div>

      <div class="message-list" ref="messageListRef">
        <div v-for="msg in chatMessages" :key="msg.id" class="chat-message">
          <strong>{{ msg.userName }}:</strong> {{ msg.message }}
        </div>
      </div>
      <input
        type="text"
        v-model="chatInput"
        @keyup.enter="sendMessage"
        placeholder="메시지 입력..."
        :disabled="!isReady"
        ref="chatInputRef" />
    </div>

    <div class="user-controls">
      <button @click.stop="toggleMute" :class="{ 'active': !isMuted }">
        {{ isMuted ? '🔇 소리 켜기' : '🔊 소리 끄기' }}
      </button>
      <button @click.stop="toggleMic" :class="{ 'active': isMicOn }">
        {{ isMicOn ? '🎤 마이크 끄기' : '🎙️ 마이크 켜기' }}
      </button>
    </div>

    <div v-if="audioBlocked" class="audio-blocked-msg">
      🔊 소리가 안 들리면 화면을 한번 터치해주세요!
    </div>

    <div v-if="isAdmin" class="admin-video-controls">
      <h3>🎥 시네마 제어</h3>
      <div class="admin-buttons">
        <button @click.stop="toggleVideoPlay">{{ isVideoPlaying ? '일시정지' : '재생' }}</button>
        <button @click.stop="syncVideoTime">동기화</button>
      </div>
    </div>

    <div v-if="purchaseModal.visible" class="modal-overlay">
      <div class="modal-content">
        <h3>{{ purchaseModal.actionName }} 구매</h3>
        <p>이 행동을 영구적으로 사용하시겠습니까?</p>
        <p class="price-tag">{{ purchaseModal.price.toLocaleString() }} SaltMate</p>
        <div class="modal-actions">
          <button @click="confirmPurchase" :disabled="isPurchasing">
            {{ isPurchasing ? '처리 중...' : '구매하기' }}
          </button>
          <button @click="closePurchaseModal" class="cancel-btn">취소</button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, nextTick, computed } from 'vue';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { auth, db, rtdb, functions } from '@/firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import {
  ref as dbRef, onChildAdded, onChildChanged, onChildRemoved, onValue,
  set, onDisconnect, push, serverTimestamp, off, query, limitToLast, remove,
  update
} from 'firebase/database';
import nipplejs from 'nipplejs';
import AgoraRTC from "agora-rtc-sdk-ng";

import heliaImgSrc from '@/assets/hellia_img.png';

const isFiniteNumber = (num) => (typeof num === 'number' && isFinite(num));

// --- 상태 변수 ---
const canvasRef = ref(null);
const cinemaVideoRef = ref(null);
const isLoading = ref(true);
const loadingMessage = ref('유토피아 입장 중...');
const isReady = ref(false);
const isAdmin = ref(false);
const isVideoPlaying = ref(false);
const isMuted = ref(true); 
const rewardClaimedLocal = ref(false);
const audioBlocked = ref(false);
let authUnsubscribe = null; 

// --- NPC & Quest State ---
const npcModel = ref(null); 
const nearNpc = ref(false); 
const isNpcModalOpen = ref(false);
const dailyQuest = ref(null); 
const chests = reactive({}); 
const nearChestId = ref(null); 
let questPollingInterval = null;
let npcMutterInterval = null;

// --- Agora 변수 ---
const agoraAppId = "9d76fd325fea49d4870da2bbea41fd29"; 
const agoraChannel = "plaza_voice_chat";
const agoraToken = null; 
const agoraClient = ref(null);
const localAudioTrack = ref(null);
const isMicOn = ref(false);
const remoteAudioTracks = reactive({});

// 아바타 관련
let myAvatar = null;
let otherPlayers = {};
let myAvatarUrl = '';
let myUserName = '';
const currentIdle = ref('idle'); 
const specialAction = ref(null); 

const actionList = {
  dance: { name: '댄스', price: 2000, icon: '💃' },
  backflip: { name: '백덤블링', price: 1000, icon: '🤸' },
  psy: { name: '싸이춤', price: 3000, icon: '🕶️' },
  footwork: { name: '발재간', price: 4000, icon: '🦶' },
  jump: { name: '점프', price: 2000, icon: '⏫' }
};

const purchasedActions = ref([]);
const purchaseModal = reactive({ visible: false, actionKey: null, actionName: '', price: 0 });
const isPurchasing = ref(false);

// 채팅
const chatInput = ref('');
const chatMessages = ref([]);
const messageListRef = ref(null);
const chatInputRef = ref(null);
const MAX_CHAT_MESSAGES = 50;

// Three.js
let scene, camera, renderer, clock, controls;
const loader = new GLTFLoader();

// Firebase
const plazaPlayersPath = 'plazaPlayers';
const plazaChatPath = 'plazaChat';
const plazaVideoPath = 'plaza/videoState';
let playerRef = null;
let playersListenerRef = null;
let chatListenerRef = null;
let videoListenerRef = null;

// 이동
const moveSpeed = 1.0; 
const keysPressed = reactive({});
const joystickData = ref({ active: false, angle: 0, distance: 0, force: 0 });
let joystickManager = null;

// ---------------------------------------------------
// 퀘스트 완료 상태 Computed
// ---------------------------------------------------
const isQuestReadyToClaim = computed(() => {
    if (!dailyQuest.value) return false;
    return Number(dailyQuest.value.currentCount) >= Number(dailyQuest.value.target) && 
           !dailyQuest.value.rewardClaimed;
});

// ---------------------------------------------------
// 지형 높이 구하기 유틸리티
// ---------------------------------------------------
const getTerrainHeight = (x, z) => {
    if (!scene) return 0.5;
    const cityMap = scene.getObjectByName("cityMap");
    if (!cityMap) return 0.5;

    const raycaster = new THREE.Raycaster();
    raycaster.set(new THREE.Vector3(x, 50, z), new THREE.Vector3(0, -1, 0));
    
    const intersects = raycaster.intersectObject(cityMap, true);
    if (intersects.length > 0) {
        return intersects[0].point.y;
    }
    return 0.5; 
};

// [신규] 충돌 감지 함수
const checkCollision = (currentPos, direction) => {
    if (!scene) return false;
    const cityMap = scene.getObjectByName("cityMap");
    if (!cityMap) return false;

    const raycaster = new THREE.Raycaster();
    const origin = currentPos.clone().add(new THREE.Vector3(0, 1.0, 0));
    raycaster.set(origin, direction.normalize());
    const intersects = raycaster.intersectObject(cityMap, true);

    if (intersects.length > 0 && intersects[0].distance < 1.5) {
        return true;
    }
    return false;
};

// ----------------------------------------
// [수정] NPC 초기화 (모델 교체: Korean Female)
// ----------------------------------------
const initNPC = async () => {
  // [수정] 검증된 한국 여성 모델로 교체 (안전성 확보)
  const npc = await loadAvatar('/avatars/korean_style_female.glb', null);
  
  const npcX = 37.16;
  // Z축 0 (플레이어 시작 위치인 7.85에 더 가깝게 앞으로 5만큼 당김)
  const npcZ = 0;
  const npcY = getTerrainHeight(npcX, npcZ); 

  // [수정] 크기를 1.5배 키움 (0.75 -> 1.15)
  npc.scale.set(1.15, 1.15, 1.15);
  npc.position.set(npcX, npcY, npcZ);	
  npc.rotation.y = 0; 

  // [수정] NPC 전용 조명 추가 (회색 방지)
  const npcLight = new THREE.PointLight(0xffffff, 1.5, 5);
  npcLight.position.set(0, 3, 2);
  npc.add(npcLight);

  // [수정] 이름표 생성 (머리 위 2.3 높이)
  const nameTag = createNicknameSprite("데브라 (NPC)");
  nameTag.position.set(0, 1.5, 0);
  npc.add(nameTag);

  // 코드 기반 단순 애니메이션
  npc.userData.animate = (time) => {
      npc.position.y = npcY + Math.sin(time * 2) * 0.02;
  };

  scene.add(npc);
  npcModel.value = npc;

  startNpcMuttering();
};

// 혼잣말 함수
const startNpcMuttering = () => {
    if (npcMutterInterval) clearInterval(npcMutterInterval);
    
    const mutters = [
        "흠... 수상한 흔적이 있군.",
        "잃어버린 물건을 찾아야 해.",
        "헬리아의 비밀을 알고 싶나?",
        "광장 곳곳을 잘 살펴보게.",
        "오늘 날씨는 수사하기 딱 좋군."
    ];

    npcMutterInterval = setInterval(() => {
        if (npcModel.value) {
            const text = mutters[Math.floor(Math.random() * mutters.length)];
            showChatBubble(npcModel.value, text, "#000000", "rgba(255, 255, 255, 0.8)", 2.8); 
        }
    }, 8000); 
};

const checkDailyQuest = async () => {
  try {
    const getQuestFunc = httpsCallable(functions, 'getNpcQuest');
    const result = await getQuestFunc();
    
    const qData = result.data.quest;
    if (qData.rewardsRemaining === undefined) {
        qData.rewardsRemaining = 3; 
    }
    
    if (qData.rewardsRemaining > 0 && qData.completed && qData.rewardClaimed) {
        qData.completed = false;
        qData.rewardClaimed = false;
        qData.currentCount = 0;
    }

    dailyQuest.value = qData;

    if (dailyQuest.value.type === 'FIND_ITEM' && !dailyQuest.value.rewardClaimed) {
        spawnTreasureChests(dailyQuest.value.hiddenItems, dailyQuest.value.foundItems);
    }
  } catch (e) { console.error("퀘스트 로딩 실패:", e); }
};

const spawnTreasureChests = async (allItems, foundItems) => {
    const itemsToSpawn = allItems.filter(id => !foundItems.includes(id));
    const positions = [
        { x: 30, z: 5 }, { x: 45, z: 15 }, { x: 35, z: -5 }, 
        { x: 50, z: 0 }, { x: 25, z: 12 }
    ];
    for (let i = 0; i < itemsToSpawn.length; i++) {
        const id = itemsToSpawn[i];
        if (chests[id]) continue;
        
        const pos = positions[i % positions.length];
        const realY = getTerrainHeight(pos.x, pos.z); 
        loader.load('/animations/box/treasure_chest.glb', (gltf) => {
            const chest = gltf.scene;
            chest.scale.set(2.5, 2.5, 2.5);
            chest.position.set(pos.x + (Math.random()*2), realY + 1.0, pos.z + (Math.random()*2));
            chest.userData.chestId = id;
            const light = new THREE.PointLight(0xffff00, 1.5, 5);
            light.position.set(0, 0.5, 0);
            chest.add(light);
            scene.add(chest);
            chests[id] = chest;
        });
    }
};

const collectChest = async () => {
    if (!nearChestId.value) return;
    const chestId = nearChestId.value;
    const chestMesh = chests[chestId];
    if (chestMesh) { scene.remove(chestMesh); delete chests[chestId]; nearChestId.value = null; }
    try {
        const collectFunc = httpsCallable(functions, 'collectPlazaItem');
        const result = await collectFunc({ itemId: chestId });
        if (dailyQuest.value) { dailyQuest.value.currentCount = result.data.newCount; }
        showChatBubble(myAvatar, "보물상자 발견! 🎁", "#000000", "rgba(255,255,255,0.9)", 2.8);
    } catch (e) { alert("상자를 줍는데 실패했습니다."); }
};

const openNpcDialog = async () => { 
    await checkDailyQuest();
    isNpcModalOpen.value = true; 
};
const closeNpcDialog = () => { isNpcModalOpen.value = false; };

const completeQuest = async () => {
    try {
        if (dailyQuest.value.rewardsRemaining <= 0) {
            alert("오늘의 보상을 모두 수령했습니다.");
            return;
        }

        const completeFunc = httpsCallable(functions, 'completeNpcQuest');
        const result = await completeFunc(); 
        const reward = result.data.reward; 
        
        alert(`퀘스트 완료! ${reward} SaltMate를 획득했습니다.`);
        
        const remaining = dailyQuest.value.rewardsRemaining - 1;
        dailyQuest.value.rewardsRemaining = remaining;
        
        if (remaining > 0) {
            dailyQuest.value.currentCount = 0; 
            dailyQuest.value.rewardClaimed = false; 
            dailyQuest.value.completed = false;

            if (dailyQuest.value.type === 'FIND_ITEM') {
                 for(const id in chests) {
                     scene.remove(chests[id]);
                     delete chests[id];
                 }
                 dailyQuest.value.foundItems = [];
                 spawnTreasureChests(dailyQuest.value.hiddenItems, []);
            }
        } else {
            dailyQuest.value.rewardClaimed = true;
        }
        
        closeNpcDialog();
    } catch (e) { alert(e.message); }
};

const hasPurchased = (actionKey) => purchasedActions.value.includes(actionKey);
const handleActionClick = (actionKey) => hasPurchased(actionKey) ? triggerAction(actionKey) : openPurchaseModal(actionKey);
const openPurchaseModal = (actionKey) => { purchaseModal.actionKey = actionKey; purchaseModal.actionName = actionList[actionKey].name; purchaseModal.price = actionList[actionKey].price; purchaseModal.visible = true; };
const closePurchaseModal = () => { purchaseModal.visible = false; isPurchasing.value = false; };
const confirmPurchase = async () => {
  if (isPurchasing.value) return;
  isPurchasing.value = true;
  try {
    const purchaseFunc = httpsCallable(functions, 'purchaseAction');
    const result = await purchaseFunc({ actionKey: purchaseModal.actionKey });
    if (result.data.success) { purchasedActions.value.push(purchaseModal.actionKey); alert(`${purchaseModal.actionName} 구매 완료!`); closePurchaseModal(); }
  } catch (e) { alert(e.message); isPurchasing.value = false; }
};

const joinPlaza = async (uid) => {
  playerRef = dbRef(rtdb, `${plazaPlayersPath}/${uid}`);
  const safeX = 37.16; const safeY = 5.0; const safeZ = 7.85; 
  const playerData = { avatarUrl: myAvatarUrl, userName: myUserName, position: { x: safeX, y: safeY, z: safeZ }, rotationY: 0, timestamp: serverTimestamp() };
  try { await set(playerRef, playerData); await onDisconnect(playerRef).remove(); isReady.value = true; } catch (e) { console.error("입장 실패:", e); }
};

const updateMyStateInRTDB = (actionName = null) => {
  if (!playerRef || !myAvatar || !isReady.value) return;
  const payload = { position: { x: myAvatar.position.x, y: myAvatar.position.y, z: myAvatar.position.z }, rotationY: myAvatar.rotation.y, timestamp: serverTimestamp() };
  if (actionName) { payload.action = actionName; }
  update(playerRef, payload).catch(() => {});
};

let lastUpdateTime = 0;
// [수정] 동기화 간격 100ms로 조정 (고무줄 현상 완화)
const throttledUpdate = () => { const now = Date.now(); if (now - lastUpdateTime > 100) { updateMyStateInRTDB(); lastUpdateTime = now; } };

const triggerAction = (actionName) => {
  if (!myAvatar) return;
  const mixer = myAvatar.userData.mixer;
  const actions = myAvatar.userData.actions;
  const action = actions[actionName];
  if (action) {
    mixer.stopAllAction(); action.reset(); action.setLoop(THREE.LoopOnce); action.clampWhenFinished = true; action.play();
    specialAction.value = actionName;
    updateMyStateInRTDB(actionName); 
    const onFinished = (e) => {
        if (e.action === action) {
            mixer.removeEventListener('finished', onFinished);
            specialAction.value = null; 
            const idleAction = actions[currentIdle.value];
            if (idleAction) { idleAction.reset().play(); action.crossFadeTo(idleAction, 0.3); }
            updateMyStateInRTDB(null); 
        }
    };
    mixer.addEventListener('finished', onFinished);
  }
};

const handleGlobalClick = () => {
    resumeAudioContext();
    
    if (cinemaVideoRef.value) {
        cinemaVideoRef.value.play().catch(() => {});
    }

    Object.values(remoteAudioTracks).forEach(track => {
        try { track.play(); } catch { /* 에러 무시 */ }
    });
};

const resumeAudioContext = () => { 
    audioBlocked.value = false; 
    if (THREE.AudioContext.getContext().state === 'suspended') { 
        THREE.AudioContext.getContext().resume(); 
    } 
};

const initAgora = async (uid) => { 
  if (!uid) return;
  const stringUid = String(uid); 
  try {
    agoraClient.value = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
    
    AgoraRTC.onAutoplayFailed = () => { audioBlocked.value = true; };

    agoraClient.value.enableAudioVolumeIndicator();
    agoraClient.value.on("volume-indicator", (volumes) => {
      volumes.forEach((volumeInfo) => {
        const { uid: speakerUid, level } = volumeInfo;
        const isTalking = level > 40; 
        if (speakerUid === stringUid) { updateSpeakingIndicator(stringUid, isTalking); } 
        else { updateSpeakingIndicator(speakerUid, isTalking); }
      });
    });

    agoraClient.value.on("user-published", async (user, mediaType) => {
      await agoraClient.value.subscribe(user, mediaType);
      if (mediaType === "audio") {
        remoteAudioTracks[user.uid] = user.audioTrack; 
        try { 
            user.audioTrack.play(); 
            user.audioTrack.setVolume(100); 
        } catch (e) { 
            audioBlocked.value = true; 
        }
      }
    });

    agoraClient.value.on("user-unpublished", (user, mediaType) => { 
        if (mediaType === "audio") { delete remoteAudioTracks[user.uid]; } 
    });

    await agoraClient.value.join(agoraAppId, agoraChannel, agoraToken, stringUid);

  } catch (error) { console.error("[Agora] Init Error:", error); }
};

const updateSpeakingIndicator = (targetId, isSpeaking) => {
  let targetMesh = null; const currentUid = auth.currentUser?.uid;
  if (targetId === currentUid) { targetMesh = myAvatar; } 
  else if (otherPlayers[targetId]) { targetMesh = otherPlayers[targetId].mesh; }
  
  if (!targetMesh) return;
  
  const existingIcon = targetMesh.getObjectByName("speakingIcon");
  if (isSpeaking) {
    if (!existingIcon) {
      const canvas = document.createElement('canvas'); const context = canvas.getContext('2d');
      canvas.width = 64; canvas.height = 64; context.fillStyle = '#00FF00'; context.beginPath(); context.arc(32, 32, 30, 0, Math.PI * 2); context.fill();
      context.font = '40px Arial'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText('🔊', 32, 32); 
      const texture = new THREE.CanvasTexture(canvas); const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
      sprite.name = "speakingIcon"; sprite.scale.set(0.8, 0.8, 1); sprite.position.set(0, 2.5, 0); targetMesh.add(sprite);
    }
  } else { if (existingIcon) { targetMesh.remove(existingIcon); existingIcon.material.map.dispose(); existingIcon.material.dispose(); } }
};

const toggleMic = async () => { 
    if (!agoraClient.value) return; 
    try { 
        if (!localAudioTrack.value) { 
            localAudioTrack.value = await AgoraRTC.createMicrophoneAudioTrack({ encoderConfig: "high_quality_stereo", AEC: true, ANS: true, AGC: true }); 
            await agoraClient.value.publish([localAudioTrack.value]); 
            isMicOn.value = true; 
        } else { 
            if (isMicOn.value) { await localAudioTrack.value.setEnabled(false); isMicOn.value = false; } 
            else { await localAudioTrack.value.setEnabled(true); isMicOn.value = true; } 
        } 
    } catch (error) { console.error("[Agora] Mic Error:", error); } 
};

const leaveAgora = async () => { 
    if (localAudioTrack.value) { localAudioTrack.value.close(); localAudioTrack.value = null; } 
    if (agoraClient.value) { await agoraClient.value.leave(); agoraClient.value = null; } 
};

const toggleMute = () => { const video = cinemaVideoRef.value; if (video) { isMuted.value = !isMuted.value; video.muted = isMuted.value; if (!isMuted.value) { video.volume = 1.0; if (isVideoPlaying.value && video.paused) { video.play().catch(e => console.log("Video Play Error:", e)); } } } };

// eslint-disable-next-line no-unused-vars
const checkVideoProgress = async () => { const video = cinemaVideoRef.value; if (!video || rewardClaimedLocal.value || !auth.currentUser) return; if (video.duration > 0 && video.currentTime >= video.duration * 0.95) { rewardClaimedLocal.value = true; try { const claimRewardFunc = httpsCallable(functions, 'claimVideoReward'); const result = await claimRewardFunc(); if (result.data.success) { showChatBubble(myAvatar, "🎉 영상 시청 완료! 1,000 SaltMate 지급!", "#FFD700", "rgba(0,0,0,0.7)", 2.5); } } catch (error) { console.error(error); } } };

const toggleVideoPlay = () => { if (!cinemaVideoRef.value) return; const newStatus = !isVideoPlaying.value; if (newStatus) cinemaVideoRef.value.play().catch(e => console.log(e)); else cinemaVideoRef.value.pause(); update(dbRef(rtdb, plazaVideoPath), { isPlaying: newStatus, timestamp: Date.now(), videoTime: cinemaVideoRef.value.currentTime }); };
const syncVideoTime = () => { if (!cinemaVideoRef.value) return; update(dbRef(rtdb, plazaVideoPath), { timestamp: Date.now(), videoTime: cinemaVideoRef.value.currentTime, forceSync: true }); };
const listenToVideoState = () => { videoListenerRef = dbRef(rtdb, plazaVideoPath); onValue(videoListenerRef, (snapshot) => { const data = snapshot.val(); if (!data || !cinemaVideoRef.value) return; isVideoPlaying.value = data.isPlaying; const videoEl = cinemaVideoRef.value; if (videoEl.readyState === 0) { videoEl.addEventListener('loadedmetadata', () => applyVideoState(videoEl, data), { once: true }); return; } applyVideoState(videoEl, data); }); };
const applyVideoState = (videoEl, data) => { if (data.isPlaying) { const latency = (Date.now() - data.timestamp) / 1000; const targetTime = data.videoTime + latency; if (Math.abs(videoEl.currentTime - targetTime) > 1) videoEl.currentTime = targetTime; videoEl.play().catch(() => {}); } else { videoEl.pause(); if (Math.abs(videoEl.currentTime - data.videoTime) > 0.5) videoEl.currentTime = data.videoTime; } };

const sendMessage = () => { if (!chatInput.value.trim()) return; push(dbRef(rtdb, plazaChatPath), { userId: auth.currentUser.uid, userName: myUserName || '익명', message: chatInput.value.trim(), timestamp: serverTimestamp() }); chatInput.value = ''; };
const listenToChat = () => { chatListenerRef = query(dbRef(rtdb, plazaChatPath), limitToLast(MAX_CHAT_MESSAGES)); onChildAdded(chatListenerRef, (snapshot) => { const msg = { id: snapshot.key, ...snapshot.val() }; chatMessages.value.push(msg); if (chatMessages.value.length > MAX_CHAT_MESSAGES) { chatMessages.value.shift(); } nextTick(() => { if (messageListRef.value) { messageListRef.value.scrollTop = messageListRef.value.scrollHeight; } }); const currentUid = auth.currentUser?.uid; if (msg.userId === currentUid && myAvatar) { showChatBubble(myAvatar, msg.message, "black", "rgba(255,255,255,0.9)", 2.5); } else if (otherPlayers[msg.userId] && otherPlayers[msg.userId].mesh) { showChatBubble(otherPlayers[msg.userId].mesh, msg.message, "black", "rgba(255,255,255,0.9)", 2.5); } }); };

const listenToOtherPlayers = (currentUid, preloadedAnimations) => {
  playersListenerRef = dbRef(rtdb, plazaPlayersPath);
  onChildAdded(playersListenerRef, async (snapshot) => {
    if (snapshot.key === currentUid || otherPlayers[snapshot.key]) return;
    const val = snapshot.val();
    let posX = isFiniteNumber(val.position?.x) ? val.position.x : 37.16;
    let posZ = isFiniteNumber(val.position?.z) ? val.position.z : 7.85;
    let posY = isFiniteNumber(val.position?.y) ? val.position.y : getTerrainHeight(posX, posZ);
    const rotY = isFiniteNumber(val.rotationY) ? val.rotationY : 0;
    otherPlayers[snapshot.key] = { mesh: null, mixer: null, actions: {}, targetPosition: new THREE.Vector3(posX, posY, posZ), targetRotationY: rotY, userName: val.userName, isMoving: false };
    const model = await loadAvatar(val.avatarUrl, preloadedAnimations);
    if (scene && otherPlayers[snapshot.key]) {
      if (val.userName !== '익명') { 
          const nick = createNicknameSprite(val.userName); 
          
          // [핵심] 이름표를 머리 위에 부착 (고무줄 현상 방지)
          attachToBone(model, nick, 1.2); 
      }
      model.position.set(posX, posY, posZ); model.rotation.y = rotY; model.visible = true;
      scene.add(model); model.updateMatrixWorld(true); 
      otherPlayers[snapshot.key].mesh = model; otherPlayers[snapshot.key].mixer = model.userData.mixer; otherPlayers[snapshot.key].actions = model.userData.actions;
      if (model.userData.mixer) model.userData.mixer.update(0.01);
      if (model.userData.actions && model.userData.actions.idle) model.userData.actions.idle.play();
    }
  });
  onChildChanged(playersListenerRef, (snap) => {
    if (snap.key === currentUid || !otherPlayers[snap.key]) return;
    const val = snap.val();
    const player = otherPlayers[snap.key];
    if (val.position) {
        const safeY = getTerrainHeight(val.position.x, val.position.z);
        player.targetPosition.set(val.position.x, safeY, val.position.z);
        player.targetRotationY = val.rotationY || 0;
    }
    if (val.action) {
        const actionName = val.action; const mixer = player.mixer; const actions = player.actions; const action = actions[actionName];
        if (mixer && action) {
            mixer.stopAllAction(); action.reset(); action.setLoop(THREE.LoopOnce); action.clampWhenFinished = true; action.play();
            const onFinished = (e) => { if (e.action === action) { mixer.removeEventListener('finished', onFinished); const idleAction = actions['idle']; if (idleAction) { idleAction.reset().play(); action.crossFadeTo(idleAction, 0.3); } } };
            mixer.addEventListener('finished', onFinished);
        }
    }
  });
  onChildRemoved(playersListenerRef, (snap) => {
    if (!otherPlayers[snap.key]) return;
    if (scene && otherPlayers[snap.key].mesh) scene.remove(otherPlayers[snap.key].mesh);
    delete otherPlayers[snap.key];
  });
};

const forceInitialMove = () => {
    if (!myAvatar) return;
    const terrainY = getTerrainHeight(myAvatar.position.x, myAvatar.position.z);
    myAvatar.position.y = terrainY; myAvatar.updateMatrixWorld(true); 
    updateMyStateInRTDB(); 
    setTimeout(() => updateMyStateInRTDB(), 500);
    setTimeout(() => updateMyStateInRTDB(), 1000);
};

const loadAnimations = async () => { const animationPaths = { walk: '/animations/F_Walk_003.glb', walkBackward: '/animations/M_Walk_Backwards_001.glb', strafeLeft: '/animations/M_Walk_Strafe_Left_002.glb', strafeRight: '/animations/M_Walk_Strafe_Right_002.glb', idle: '/animations/M_Standing_Idle_Variations_008.glb', idle2: '/animations/M_Standing_Idle_Variations_007.glb', idle3: '/animations/M_Standing_Idle_Variations_005.glb', idle4: '/animations/M_Standing_Idle_Variations_006.glb', dance: '/animations/F_Dances_006.glb', backflip: '/animations/F_Dances_007.glb', psy: '/animations/M_Dances_001.glb', footwork: '/animations/M_Dances_009.glb', jump: '/animations/M_Walk_Jump_003.glb' }; const loadedAnimations = { idle: null, idle2: null, idle3: null, idle4: null, walk: null, walkBackward: null, strafeLeft: null, strafeRight: null, dance: null, backflip: null, psy: null, footwork: null, jump: null }; const keys = Object.keys(animationPaths); try { const gltfResults = await Promise.all(Object.values(animationPaths).map(path => loader.loadAsync(path).catch(() => null))); gltfResults.forEach((gltf, index) => { if (gltf && gltf.animations.length > 0) loadedAnimations[keys[index]] = gltf.animations[0]; }); return loadedAnimations; } catch (error) { return loadedAnimations; } };
const loadAvatar = (url, animations) => { return new Promise((resolve) => { const model = new THREE.Group(); model.matrixAutoUpdate = true; model.position.set(0, 0, 0); model.userData.mixer = null; model.userData.actions = {}; if (!url || !url.endsWith('.glb')) { const visuals = new THREE.Group(); const geometry = new THREE.BoxGeometry(0.5, 1, 0.5); const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 }); const cube = new THREE.Mesh(geometry, material); cube.position.y = 0.5; visuals.add(cube); model.add(visuals); resolve(model); return; } loader.load(url, (gltf) => { const visuals = gltf.scene; visuals.traverse((child) => { if (child.isMesh || child.isSkinnedMesh) { child.castShadow = true; child.receiveShadow = true; child.frustumCulled = false; child.matrixAutoUpdate = true; } }); visuals.scale.set(0.7, 0.7, 0.7); const box = new THREE.Box3().setFromObject(visuals); visuals.position.y = -box.min.y; model.add(visuals); model.userData.visuals = visuals; if (animations) { const mixer = new THREE.AnimationMixer(visuals); model.userData.mixer = mixer; for (const key in animations) { if (animations[key]) { const action = mixer.clipAction(animations[key]); model.userData.actions[key] = action; if (key === 'idle') action.play(); } } mixer.update(0.01); } resolve(model); }, undefined, (error) => { console.error('아바타 로딩 실패:', error); resolve(model); }); }); };
const createNicknameSprite = (text) => { const canvas = document.createElement('canvas'); const context = canvas.getContext('2d'); canvas.width = 300; canvas.height = 100; context.fillStyle = 'rgba(0, 0, 0, 0.5)'; context.beginPath(); context.roundRect(10, 20, 280, 60, 10); context.fill(); context.fillStyle = 'white'; context.font = 'bold 24px Arial'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(text, 150, 50); const texture = new THREE.CanvasTexture(canvas); texture.needsUpdate = true; const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false })); sprite.scale.set(1.0, 0.33, 1); sprite.position.set(0, 0, 0); return sprite; };

// [신규] 이름표를 뼈대에 부착하는 함수 (고무줄 현상 해결)
const attachToBone = (model, object, offsetY = 1.2) => {
    let bone = null;
    model.traverse((child) => {
        if (child.isBone && !bone) {
            // 일반적으로 머리나 목 뼈를 찾음
            if (child.name.match(/Head|Neck|Spine|Hips/i)) {
                bone = child;
            }
        }
    });
    
    if (bone) {
        bone.add(object);
        object.position.set(0, offsetY, 0); 
    } else {
        model.add(object); 
        object.position.set(0, 2.3, 0);
    }
};

// [수정] 말풍선 배경색 인자 추가
const createChatBubbleSprite = (text, textColor = "black", bgColor = "rgba(255,255,255,0.9)") => { 
    const canvas = document.createElement('canvas'); const context = canvas.getContext('2d'); 
    context.font = 'bold 30px Arial'; const w = context.measureText(text).width + 40; 
    canvas.width = w; canvas.height = 60; 
    context.fillStyle = bgColor; // 배경색 적용
    context.roundRect(0, 0, w, 60, 10); context.fill(); context.stroke(); 
    context.fillStyle = textColor; context.textAlign = 'center'; context.textBaseline = 'middle'; 
    context.fillText(text, w / 2, 30); 
    const texture = new THREE.CanvasTexture(canvas); 
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false })); 
    sprite.scale.set(w * 0.005, 60 * 0.005, 1); sprite.position.y = 2.2; 
    return sprite; 
};
// [수정] showChatBubble 함수 인자 확장
const showChatBubble = (avatar, message, color = "black", bgColor = "rgba(255,255,255,0.9)", heightY = 2.2) => { 
    if (!avatar) return; 
    if (avatar.activeBubble) { avatar.remove(avatar.activeBubble); avatar.activeBubble.material.dispose(); clearTimeout(avatar.activeBubble.timeoutId); } 
    const newBubble = createChatBubbleSprite(message, color, bgColor); 
    newBubble.position.y = heightY; // 높이 적용
    const timeoutId = setTimeout(() => { if (avatar.activeBubble === newBubble) { avatar.remove(newBubble); newBubble.material.dispose(); avatar.activeBubble = null; } }, 5000); 
    newBubble.timeoutId = timeoutId; avatar.activeBubble = newBubble; avatar.add(newBubble); 
};

const initThree = async () => {
  return new Promise((resolve, reject) => {
      try {
          scene = new THREE.Scene();
          const textureLoader = new THREE.TextureLoader();
          textureLoader.load('/my_background.jpg', (texture) => {
              texture.mapping = THREE.EquirectangularReflectionMapping; scene.background = texture; scene.environment = texture;
          }, undefined, () => { scene.background = new THREE.Color(0xade6ff); });
          scene.fog = new THREE.Fog(0xaaaaaa, 70, 200);
          const startX = 37.16; const startY = 5.49; const startZ = 7.85;
          camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
          camera.position.set(startX, startY + 5, startZ + 10);
          if (!canvasRef.value) { reject(false); return; }
          renderer = new THREE.WebGLRenderer({ canvas: canvasRef.value, antialias: true });
          renderer.setSize(window.innerWidth, window.innerHeight);
          renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
          controls = new OrbitControls(camera, renderer.domElement);
          controls.enableDamping = true; controls.dampingFactor = 0.1; controls.minDistance = 2; controls.maxDistance = 40; controls.maxPolarAngle = Math.PI / 2 - 0.05;
          controls.target.set(startX, startY + 1.0, startZ); controls.update();
          const ambientLight = new THREE.AmbientLight(0xffffff, 0.7); scene.add(ambientLight);
          const dirLight = new THREE.DirectionalLight(0xffffff, 1.2); dirLight.position.set(50, 80, 40); dirLight.castShadow = true; dirLight.shadow.mapSize.width = 2048; dirLight.shadow.mapSize.height = 2048; scene.add(dirLight);
          const hemiLight = new THREE.HemisphereLight(0xade6ff, 0x444444, 0.6); scene.add(hemiLight);
          
          // [수정] 비디오 스크린 축소 및 BasicMaterial 사용
          const video = cinemaVideoRef.value;
          if (video) {
            const videoTexture = new THREE.VideoTexture(video); 
            videoTexture.minFilter = THREE.LinearFilter; 
            videoTexture.magFilter = THREE.LinearFilter; 
            videoTexture.colorSpace = THREE.SRGBColorSpace; 
            
            // 크기 16, 9 (기존 32, 18에서 절반 축소)
            const screenGeo = new THREE.PlaneGeometry(16, 9); 
            const screenMat = new THREE.MeshBasicMaterial({ map: videoTexture, side: THREE.DoubleSide });
            const screen = new THREE.Mesh(screenGeo, screenMat); 
	    // [수정] 높이 15.0으로 올려서 공중에 띄움
	    screen.position.set(startX, 15.0, startZ - 10);
            screen.name = "cinemaScreen"; 
            scene.add(screen);
          }

          loader.load('/models/low_poly_city_pack.glb', (gltf) => {
              const city = gltf.scene; city.name = "cityMap";
              const box = new THREE.Box3().setFromObject(city);
              const size = box.getSize(new THREE.Vector3()); const center = box.getCenter(new THREE.Vector3());
              const scaleFactor = 150 / Math.max(size.x, size.z);
              city.scale.set(scaleFactor, scaleFactor, scaleFactor);
              const scaledBox = new THREE.Box3().setFromObject(city);
              const groundLevelY = -scaledBox.min.y;
              city.position.set(-center.x * scaleFactor, groundLevelY, -center.z * scaleFactor);
              city.traverse(child => { if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; } });
              scene.add(city);
              resolve(true); 
          }, undefined, (e) => { console.error('맵 로드 실패', e); reject(false); });
          clock = new THREE.Clock();
      } catch (e) { console.error(e); reject(false); }
  });
};

const handleKeyDown = (event) => { if (event.code === 'KeyF') { if (nearNpc.value) openNpcDialog(); if (nearChestId.value) collectChest(); } if (chatInputRef.value !== document.activeElement) keysPressed[event.code] = true; };
const handleKeyUp = (event) => { keysPressed[event.code] = false; };
const handleJoystickMove = (evt, data) => { joystickData.value = { active: true, angle: data.angle.radian, distance: data.distance, force: data.force }; };
const handleJoystickEnd = () => { joystickData.value = { active: false, angle: 0, distance: 0, force: 0 }; };
const handleResize = () => { if (!camera || !renderer) return; camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); };

const updatePlayerMovement = (deltaTime) => {
  if (!myAvatar || !isReady.value || !scene) return;
  let moved = false;
  let moveDirection = { x: 0, z: 0 };
  let currentAnimation = specialAction.value || currentIdle.value;
  let currentSpeedFactor = 1.0;
  
  if (joystickData.value.active && joystickData.value.distance > 10) {
      const targetRotationY = -joystickData.value.angle + Math.PI / 2 + Math.PI;
      let currentY = myAvatar.rotation.y; const PI2 = Math.PI * 2; let targetY = targetRotationY;
      currentY = (currentY % PI2 + PI2) % PI2; targetY = (targetY % PI2 + PI2) % PI2;
      let diff = targetY - currentY; if (Math.abs(diff) > Math.PI) { diff = diff > 0 ? diff - PI2 : diff + PI2; }
      myAvatar.rotation.y += diff * deltaTime * 8; 
      moveDirection.z = 1; 
      moved = true; currentAnimation = 'walk'; currentSpeedFactor = joystickData.value.force;
  } else if (!joystickData.value.active) { 
      const cameraEuler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
      const isKeyboardMoving = keysPressed['KeyW'] || keysPressed['ArrowUp'] || keysPressed['KeyS'] || keysPressed['ArrowDown'] || keysPressed['KeyA'] || keysPressed['ArrowLeft'] || keysPressed['KeyD'] || keysPressed['ArrowRight'];
      if (isKeyboardMoving) { myAvatar.rotation.y = cameraEuler.y + Math.PI; moved = true; }
      if (keysPressed['KeyW'] || keysPressed['ArrowUp']) { moveDirection.z = 1; if(!specialAction.value) currentAnimation = 'walk'; }
      if (keysPressed['KeyS'] || keysPressed['ArrowDown']) { moveDirection.z = -1; if(!specialAction.value) currentAnimation = 'walkBackward'; }
      if (keysPressed['KeyA'] || keysPressed['ArrowLeft']) { moveDirection.x = 1; currentAnimation = 'strafeLeft'; }
      if (keysPressed['KeyD'] || keysPressed['ArrowRight']) { moveDirection.x = -1; currentAnimation = 'strafeRight'; }
  }
  
  if (moved) {
    specialAction.value = null;
    const velocity = new THREE.Vector3(moveDirection.x * moveSpeed * currentSpeedFactor * deltaTime, 0, moveDirection.z * moveSpeed * currentSpeedFactor * deltaTime);
    velocity.applyQuaternion(myAvatar.quaternion); 
    
    // [핵심] 충돌 체크
    const direction = velocity.clone();
    if (!checkCollision(myAvatar.position, direction)) {
        myAvatar.position.add(velocity);
        camera.position.add(velocity); 
        controls.target.copy(myAvatar.position).add(new THREE.Vector3(0, 1.5, 0)); 
        throttledUpdate();
    }
  }
  const boundary = 74.5;
  myAvatar.position.x = Math.max(-boundary, Math.min(boundary, myAvatar.position.x));
  myAvatar.position.z = Math.max(-boundary, Math.min(boundary, myAvatar.position.z));
  myAvatar.position.y = getTerrainHeight(myAvatar.position.x, myAvatar.position.z);
  const mixer = myAvatar.userData.mixer; const actions = myAvatar.userData.actions;
  if (mixer) {
    const targetAction = actions[currentAnimation] || actions['idle'];
    const activeAction = mixer._actions.find(a => a.isRunning() && a !== targetAction);
    if (targetAction && !targetAction.isRunning()) { targetAction.reset().play(); if (activeAction) activeAction.crossFadeTo(targetAction, 0.3); }
  }
};

const updateOtherPlayersMovement = (deltaTime) => {
  // [핵심] Lerp 속도 낮춰서 고무줄 현상 완화 (15 -> 5)
  const lerpFactor = deltaTime * 5; 
  
  for (const userId in otherPlayers) {
    const player = otherPlayers[userId];
    if (!player.mesh) continue;
    player.mesh.position.lerp(player.targetPosition, lerpFactor);
    player.mesh.position.y = getTerrainHeight(player.mesh.position.x, player.mesh.position.z);
    const distance = player.mesh.position.distanceTo(player.targetPosition);
    const wasMoving = player.isMoving;
    player.isMoving = distance > 0.01;
    let currentY = player.mesh.rotation.y; let targetY = player.targetRotationY; 
    const PI2 = Math.PI * 2; currentY = (currentY % PI2 + PI2) % PI2; targetY = (targetY % PI2 + PI2) % PI2;
    let diff = targetY - currentY; if (Math.abs(diff) > Math.PI) { diff = diff > 0 ? diff - PI2 : diff + PI2; }
    player.mesh.rotation.y += diff * lerpFactor; 
    
    player.mesh.updateMatrixWorld(true);
    
    const mixer = player.mixer; const actions = player.actions;
    if (mixer && actions.walk && actions.idle) {
      if (player.isMoving && !wasMoving) { actions.walk.reset().play(); actions.idle.crossFadeTo(actions.walk, 0.2); }
      else if (!player.isMoving && wasMoving) { actions.idle.reset().play(); actions.walk.crossFadeTo(actions.idle, 0.2); }
    }
  }
};

const updateDistances = () => {
    if (!myAvatar) return;
    if (npcModel.value) {
        const dist = myAvatar.position.distanceTo(npcModel.value.position);
        nearNpc.value = dist < 3.0; 
        if (npcModel.value.userData.floatingIcon) {
            npcModel.value.userData.floatOffset += 0.02;
            npcModel.value.userData.floatingIcon.position.y = 2.8 + Math.sin(npcModel.value.userData.floatOffset) * 0.2;
        }
    }
    let closestChest = null;
    let minDist = 2.0; 
    for (const [id, mesh] of Object.entries(chests)) {
        const dist = myAvatar.position.distanceTo(mesh.position);
        if (dist < minDist) { closestChest = id; minDist = dist; }
        mesh.rotation.y += 0.01;
    }
    nearChestId.value = closestChest;
};

const animate = () => {
  if (!renderer || !scene || !camera || !clock) return;
  requestAnimationFrame(animate);
  const deltaTime = clock.getDelta();
  if (myAvatar && myAvatar.userData.mixer) myAvatar.userData.mixer.update(deltaTime);
  if (npcModel.value && npcModel.value.userData.animate) {
      npcModel.value.userData.animate(clock.getElapsedTime());
  }
  for (const userId in otherPlayers) { if (otherPlayers[userId].mixer) { otherPlayers[userId].mixer.update(deltaTime); } }
  updatePlayerMovement(deltaTime);
  updateOtherPlayersMovement(deltaTime);
  updateDistances(); 
  if (controls) controls.update();
  renderer.render(scene, camera);
};

onMounted(() => {
  authUnsubscribe = onAuthStateChanged(auth, async (user) => {
    if (user) {
      const currentUid = user.uid;
      try {
        const token = await user.getIdTokenResult();
        if (token.claims.role === 'superAdmin') isAdmin.value = true;
      } catch(e) { console.log("권한 확인 실패"); }

      await initAgora(currentUid);
      const mapLoaded = await initThree();
      if (!mapLoaded) return;

      const preloadedAnimations = await loadAnimations();
      const idleKeys = ['idle', 'idle2', 'idle3', 'idle4'];
      currentIdle.value = idleKeys[Math.floor(Math.random() * idleKeys.length)];

      window.addEventListener('resize', handleResize);
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      
      animate();

      try {
        const userDoc = await getDoc(doc(db, 'users', currentUid));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            myAvatarUrl = userData.avatarUrl;
            myUserName = userData.name;
            if (userData.hasReceivedVideoReward) rewardClaimedLocal.value = true;
            if (userData.purchasedActions) purchasedActions.value = userData.purchasedActions;
        }
      } catch (error) { console.error("Firestore 정보 가져오기 실패:", error); }

      myAvatar = await loadAvatar(myAvatarUrl, preloadedAnimations);
      const startX = 37.16; const startZ = 7.85;
      const startY = getTerrainHeight(startX, startZ);
      myAvatar.position.set(startX, startY, startZ); 
      if (myUserName) {
        const nick = createNicknameSprite(myUserName);
        // 이름표를 머리 뼈대에 부착
        attachToBone(myAvatar, nick, 1.2); 
      }
      scene.add(myAvatar);
      myAvatar.visible = true; 
      myAvatar.updateMatrixWorld(true);
      if (myAvatar.userData.mixer) myAvatar.userData.mixer.update(0.01);

      await initNPC();
      await checkDailyQuest();
      
      questPollingInterval = setInterval(checkDailyQuest, 5000);

      await nextTick();
      const joystickZone = document.getElementById('joystick-zone');
      if (joystickZone) {
          joystickManager = nipplejs.create({ zone: joystickZone, mode: 'static', position: { right: '80px', bottom: '80px' }, color: 'rgba(255, 255, 255, 0.5)', size: 100 });
          joystickManager.on('move', handleJoystickMove);
          joystickManager.on('end', handleJoystickEnd);
      }

      await joinPlaza(currentUid);
      if (isReady.value) {
        updateMyStateInRTDB(); 
        forceInitialMove(); 
        listenToOtherPlayers(currentUid, preloadedAnimations); 
        listenToVideoState(); 
        listenToChat(); 
      }
      isLoading.value = false;
    }
  });
});

onUnmounted(() => {
  document.body.style.overflow = 'auto';
  document.documentElement.style.overflow = 'auto';
  if (authUnsubscribe) authUnsubscribe();
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('keyup', handleKeyUp);
  if (questPollingInterval) clearInterval(questPollingInterval);
  if (npcMutterInterval) clearInterval(npcMutterInterval);
  leaveAgora(); 
  if (playersListenerRef) off(playersListenerRef);
  if (chatListenerRef) off(chatListenerRef);
  if (videoListenerRef) off(videoListenerRef);
  if (playerRef) remove(playerRef);
  if (joystickManager) joystickManager.destroy();
  if (controls) controls.dispose();
  if (renderer) renderer.dispose();
});
</script>

<style scoped>
:global(body), :global(html) {
  margin: 0;
  padding: 0;
  overflow: hidden; 
  height: 100%;
}
.utopia-container { 
  width: 100%; 
  height: 100dvh; 
  margin: 0; 
  padding: 0; 
  overflow: hidden; 
  position: relative; 
  background-color: #ade6ff; 
}

.quest-widget {
  position: absolute;
  top: 20px;
  left: 20px;
  background: rgba(0, 0, 0, 0.6);
  padding: 15px;
  border-radius: 10px;
  color: white;
  border: 1px solid #FFD700;
  z-index: 50;
}
.quest-title {
  font-weight: bold;
  font-size: 1.1rem;
  margin-bottom: 5px;
  color: #FFD700;
}
.quest-info {
  font-size: 1rem;
}
.quest-complete {
  color: #2ecc71;
  font-weight: bold;
}

.main-canvas { display: block; width: 100%; height: 100%; }
.loading-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.8); color: white; display: flex; flex-direction: column; justify-content: center; align-items: center; z-index: 10; }
.spinner { border: 4px solid rgba(255, 255, 255, 0.3); width: 40px; height: 40px; border-radius: 50%; border-left-color: #fff; animation: spin 1s linear infinite; margin-bottom: 20px; }
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

.chat-ui { 
  position: absolute; 
  bottom: 120px; 
  left: 20px; 
  width: 300px; 
  max-width: 80%; 
  max-height: 20vh; 
  display: flex; 
  flex-direction: column; 
  z-index: 5; 
}

.action-bar {
  display: flex;
  gap: 5px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}
.action-btn-wrapper {
  position: relative;
}
.action-btn-wrapper button {
  background: rgba(0,0,0,0.6);
  border: 1px solid rgba(255,255,255,0.3);
  color: white;
  font-size: 1.2rem;
  padding: 5px 8px;
  border-radius: 5px;
  cursor: pointer;
  transition: transform 0.1s;
  position: relative;
}
.action-btn-wrapper button:active {
  transform: scale(0.9);
}
.lock-icon {
  position: absolute;
  top: -5px;
  right: -5px;
  font-size: 0.8rem;
  background: rgba(0,0,0,0.8);
  border-radius: 50%;
  padding: 2px;
}

.message-list { 
  flex-grow: 1; 
  overflow-y: auto; 
  margin-bottom: 5px; 
  color: white; 
  font-size: 0.9em; 
  background-color: rgba(0, 0, 0, 0.7); 
  border-radius: 8px; 
  padding: 10px;
  scrollbar-width: none; 
}
.message-list::-webkit-scrollbar { display: none; }

.chat-message { margin-bottom: 6px; word-break: break-all; line-height: 1.4; }
.chat-ui input { width: 100%; padding: 10px; border: none; border-radius: 4px; background-color: rgba(255, 255, 255, 0.15); color: white; outline: none; }

.joystick-zone { position: absolute; bottom: 30px; right: 30px; width: 150px; height: 150px; z-index: 6; opacity: 0.7; }

.user-controls { position: absolute; top: 20px; right: 20px; z-index: 100; display: flex; gap: 8px; }
.user-controls button { padding: 10px 15px; background: rgba(0, 0, 0, 0.6); color: white; border: 1px solid rgba(255, 255, 255, 0.5); border-radius: 20px; cursor: pointer; font-weight: bold; transition: background 0.3s; white-space: nowrap; }
.user-controls button:hover { background: rgba(0, 0, 0, 0.8); }
.user-controls button.active { border-color: #28a745; color: #28a745; }

.audio-blocked-msg {
  position: absolute; top: 80px; right: 20px; background: rgba(255,0,0,0.8);
  color: white; padding: 10px; border-radius: 8px; z-index: 99; font-size: 0.8rem;
  animation: pulse 2s infinite;
}

.admin-video-controls { position: absolute; top: 80px; right: 20px; background: rgba(0, 0, 0, 0.8); padding: 10px; border-radius: 8px; color: white; z-index: 100; width: 150px; }
.admin-video-controls h3 { margin: 0 0 8px 0; font-size: 0.9rem; text-align: center; }
.admin-buttons { display: flex; gap: 5px; }
.admin-buttons button { flex: 1; padding: 6px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8rem; }
.admin-buttons button:hover { background: #0056b3; }

/* 구매 모달 스타일 */
.modal-overlay {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0,0,0,0.6); display: flex; justify-content: center; align-items: center; z-index: 2000;
}
.modal-content {
  background: white; width: 90%; max-width: 320px; padding: 20px; border-radius: 12px; text-align: center;
}
.price-tag {
  font-size: 1.2rem; font-weight: bold; color: #007bff; margin: 15px 0;
}
.modal-actions {
  display: flex; gap: 10px; justify-content: center;
}
.modal-actions button {
  padding: 10px 20px; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;
  background-color: #007bff; color: white;
}
.modal-actions button.cancel-btn {
  background-color: #6c757d;
}
.modal-actions button:disabled {
  background-color: #ccc;
}

/* 상호작용 버튼 스타일 */
.interaction-prompt {
  position: absolute;
  bottom: 180px; /* 채팅창 위 */
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
}
.interact-btn {
  background: linear-gradient(135deg, #FFD700, #FFA500);
  border: 2px solid #fff;
  color: #333;
  padding: 10px 20px;
  border-radius: 30px;
  font-weight: bold;
  font-size: 1.1rem;
  box-shadow: 0 4px 15px rgba(255, 215, 0, 0.5);
  cursor: pointer;
  animation: bounce 1s infinite alternate;
  display: flex;
  align-items: center;
  gap: 8px;
}
.chest-btn {
    background: linear-gradient(135deg, #00C6FF, #0072FF);
    box-shadow: 0 4px 15px rgba(0, 114, 255, 0.5);
    color: white;
}
@keyframes bounce { from { transform: translateY(0); } to { transform: translateY(-5px); } }

/* NPC 대화창 스타일 */
.npc-dialog-overlay {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0,0,0,0.5); z-index: 3000;
  display: flex; align-items: flex-end; justify-content: center;
  padding-bottom: 50px;
}
.npc-dialog-box {
  background: rgba(20, 20, 30, 0.95);
  border: 2px solid #FFD700;
  border-radius: 15px;
  width: 90%; max-width: 600px;
  padding: 20px;
  display: flex; gap: 20px;
  color: white;
  position: relative;
  box-shadow: 0 10px 30px rgba(0,0,0,0.8);
}
.npc-portrait img {
  width: 100px; height: 100px; border-radius: 50%;
  border: 3px solid #FFD700;
  object-fit: cover;
  background: white;
}
.npc-content { flex: 1; display: flex; flex-direction: column; gap: 10px; }
.npc-content h3 { margin: 0; color: #FFD700; }
.quest-desc { font-size: 1.1rem; line-height: 1.4; }
.quest-progress-bar {
  background: #333; height: 20px; border-radius: 10px; position: relative; overflow: hidden;
}
.quest-progress-bar .fill {
  background: linear-gradient(90deg, #FFD700, #FFA500); height: 100%; width: 0%; transition: width 0.5s;
}
.quest-progress-bar span {
  position: absolute; width: 100%; text-align: center; top: 0; line-height: 20px;
  font-size: 0.8rem; text-shadow: 0 0 3px black;
}
.dialog-actions { display: flex; gap: 10px; margin-top: 10px; }
.dialog-actions button {
  padding: 8px 16px; border-radius: 5px; border: none; cursor: pointer; font-weight: bold;
}
.btn-complete { background: #28a745; color: white; }
.btn-disabled { background: #555; color: #ccc; cursor: default; }
.btn-confirm { background: #007bff; color: white; }
.close-dialog {
  position: absolute; top: 10px; right: 15px; background: none; border: none; color: #aaa; font-size: 1.5rem; cursor: pointer;
}

@media (max-width: 768px) {
  .chat-ui { bottom: 140px; width: 60%; font-size: 0.8rem; }
  .user-controls { top: 15px; right: 15px; }
  .user-controls button { padding: 6px 10px; font-size: 0.75rem; }
  .joystick-zone { bottom: 20px; right: 20px; width: 120px; height: 120px; }
}
</style>