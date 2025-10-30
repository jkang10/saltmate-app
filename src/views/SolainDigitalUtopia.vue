<template>
  <div class="utopia-container">
    <canvas ref="canvasRef" class="main-canvas" tabindex="0"></canvas>

    <div v-if="isLoading" class="loading-overlay">
      <div class="spinner"></div>
      <p>{{ loadingMessage }}</p>
    </div>

    <div id="joystick-zone" class="joystick-zone"></div>

    <div class="chat-ui">
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
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, nextTick } from 'vue';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
// ▼▼▼ [신규] OrbitControls import 추가 ▼▼▼
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
// ▲▲▲ 추가 완료 ▲▲▲
import { auth, db, rtdb } from '@/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import {
  ref as dbRef, onChildAdded, onChildChanged, onChildRemoved,
  set, onDisconnect, push, serverTimestamp, off, query, limitToLast, remove,
  update
} from 'firebase/database';
// eslint-disable-next-line no-unused-vars
import nipplejs from 'nipplejs';

// --- 유틸리티 함수 ---
const isFiniteNumber = (num) => (typeof num === 'number' && isFinite(num));

// --- 상태 변수 ---
const canvasRef = ref(null);
const isLoading = ref(true);
const loadingMessage = ref('유토피아 입장 준비 중...');
const isReady = ref(false);

// --- 아바타 관련 ---
let myAvatar = null;
let otherPlayers = {};
let myAvatarUrl = '';
let myUserName = '';

// --- 채팅 관련 ---
const chatInput = ref('');
const chatMessages = ref([]);
const messageListRef = ref(null);
const chatInputRef = ref(null);
const MAX_CHAT_MESSAGES = 50;

// --- Three.js 관련 ---
let scene, camera, renderer, clock;
// let cameraLookAtTarget = new THREE.Vector3(0, 1.0, 0); // OrbitControls 사용 시 불필요
let controls; // ★ OrbitControls 인스턴스 저장 변수 ★
// ▼▼▼ [신규] 클릭 이동 관련 변수 추가 ▼▼▼
const navigationTarget = ref(null); // 클릭/터치로 이동할 목표 지점
let targetMarker = null; // 목표 지점 표시용 3D 객체
// ▲▲▲
const loader = new GLTFLoader();

// --- Firebase RTDB 경로 ---
const plazaPlayersPath = 'plazaPlayers';
const plazaChatPath = 'plazaChat';
let playerRef = null;
let playersListenerRef = null;
let chatListenerRef = null;

// --- 플레이어 이동 관련 ---
const moveSpeed = 2.0;
const keysPressed = reactive({});
const joystickData = ref({ active: false, angle: 0, distance: 0, force: 0 });
let joystickManager = null;

// --- [신규] 헬퍼 함수: 애니메이션 파일 로드 ---
const loadAnimations = async () => {
  const animationPaths = {
    idle: '/animations/M_Standing_Idle_Variations_008.glb', // ✅ 상대 경로 확인
    walk: '/animations/F_Walk_003.glb',                     // ✅ 상대 경로 확인
    walkBackward: '/animations/M_Walk_Backwards_001.glb', // ✅ 상대 경로 확인
    strafeLeft: '/animations/M_Walk_Strafe_Left_002.glb',  // ✅ 상대 경로 확인
    strafeRight: '/animations/M_Walk_Strafe_Right_002.glb' // ✅ 상대 경로 확인
  };
  const loadedAnimations = { idle: null, walk: null, walkBackward: null, strafeLeft: null, strafeRight: null };
  const keys = Object.keys(animationPaths);

  try {
    const gltfResults = await Promise.all(
      Object.values(animationPaths).map(path => loader.loadAsync(path).catch(e => {
        console.error(`애니메이션 로드 실패: ${path}`, e); // 개별 파일 로드 실패 시 에러 로깅
        return null; // 실패 시 null 반환
      }))
    );

    gltfResults.forEach((gltf, index) => {
      const key = keys[index];
      if (gltf && gltf.animations && gltf.animations.length > 0) {
        loadedAnimations[key] = gltf.animations[0];
        console.log(`${key} 애니메이션 클립 로드 성공:`, loadedAnimations[key].name);
      } else if (gltf) {
        console.error(`${key} 애니메이션 파일에 클립이 없습니다:`, animationPaths[key]);
      }
      // null인 경우는 위 catch에서 이미 로깅됨
    });

    return loadedAnimations;

  } catch (error) { // Promise.all 자체의 에러 (거의 발생 안 함)
    console.error('애니메이션 로딩 중 전체 오류 발생:', error);
    return loadedAnimations;
  }
};

// --- 헬퍼 함수: 아바타 로드 (외부 애니메이션 적용) ---
const loadAvatar = (url, animations) => {
  return new Promise((resolve) => {
    const model = new THREE.Group();
    model.position.set(0, 0, 0);
    model.userData.mixer = null;
    model.userData.actions = {}; // 액션 저장 객체 초기화

    // URL 없거나 GLB 아닐 때 기본 큐브 생성
    if (!url || !url.endsWith('.glb')) {
      console.warn("아바타 URL이 유효하지 않거나 GLB 파일이 아닙니다. 기본 큐브를 사용합니다.", url);
      const visuals = new THREE.Group();
      const geometry = new THREE.BoxGeometry(0.5, 1, 0.5);
      const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
      const cube = new THREE.Mesh(geometry, material);
      cube.position.y = 0.5;
      visuals.add(cube);
      visuals.scale.set(0.7, 0.7, 0.7);
      model.add(visuals);
      resolve(model);
      return;
    }

    loader.load(url,
      (gltf) => {
        const visuals = gltf.scene;
        const box = new THREE.Box3().setFromObject(visuals);
        const center = box.getCenter(new THREE.Vector3());

        visuals.traverse((child) => {
          if (child.isMesh) {
            child.geometry.translate(-center.x, -box.min.y, -center.z);
            // --- 그림자 설정 (렉 진단 후 다시 활성화) ---
            child.castShadow = true;
            // 아바타 메쉬는 그림자를 받지 않음 (성능 및 시각적 자연스러움)
            // child.receiveShadow = true;
          }
          child.matrixAutoUpdate = true;
        });

        visuals.scale.set(0.7, 0.7, 0.7);
        visuals.position.set(0, 0, 0);
        visuals.rotation.set(0, 0, 0);
        visuals.matrixAutoUpdate = true;
        model.add(visuals);

// --- ★ [애니메이션 로직 수정] 추가된 애니메이션 적용 ★ ---
        if (animations && Object.values(animations).some(clip => clip !== null)) { // 로드된 애니메이션이 하나라도 있다면
          const mixer = new THREE.AnimationMixer(visuals);
          model.userData.mixer = mixer;

          // 각 애니메이션 클립에 대해 액션 생성 및 저장
          for (const key in animations) {
            if (animations[key]) { // 클립이 null이 아니면
              const action = mixer.clipAction(animations[key]);
              model.userData.actions[key] = action; // actions 객체에 저장 (예: actions.idle, actions.walkBackward)

              // Idle 액션만 기본 재생
              if (key === 'idle') {
                action.play();
              }
            } else {
              console.warn(`[${url}] '${key}' 애니메이션 클립이 로드되지 않아 적용할 수 없습니다.`);
            }
          }
           console.log(`[${url}] 로드된 외부 애니메이션 적용 완료`, Object.keys(model.userData.actions));
        } else {
          console.warn(`[${url}] 미리 로드된 애니메이션 클립이 하나도 없습니다.`);
        }
        // --- ★ [애니메이션 로직 수정 끝] ★ ---

        resolve(model);
      },
      undefined,
      (error) => {
        console.error('아바타 로딩 실패:', error, 'URL:', url);
        const visuals = new THREE.Group();
        const geometry = new THREE.BoxGeometry(0.5, 1, 0.5);
        const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
        const cube = new THREE.Mesh(geometry, material);
        cube.position.y = 0.5;
        visuals.add(cube);
        visuals.scale.set(0.7, 0.7, 0.7);
        model.add(visuals);
        resolve(model);
      }
    );
  });
};

// --- 헬퍼 함수: 닉네임 스프라이트 생성 ---
const createNicknameSprite = (text) => {
  const resolutionScale = 2;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const fontSize = 24 * resolutionScale;
  const fontWeight = 'bold';
  const fontFamily = 'Arial';
  context.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  const textMetrics = context.measureText(text);
  const textWidth = textMetrics.width;
  const padding = 10 * resolutionScale;
  const verticalPadding = 5 * resolutionScale;
  canvas.width = textWidth + padding * 2;
  canvas.height = fontSize + verticalPadding * 2;
  context.fillStyle = 'rgba(0, 0, 0, 0.7)';
  const radius = 8 * resolutionScale;
  context.beginPath();
  context.moveTo(radius, 0);
  context.lineTo(canvas.width - radius, 0);
  context.quadraticCurveTo(canvas.width, 0, canvas.width, radius);
  context.lineTo(canvas.width, canvas.height - radius);
  context.quadraticCurveTo(canvas.width, canvas.height, canvas.width - radius, canvas.height);
  context.lineTo(radius, canvas.height);
  context.quadraticCurveTo(0, canvas.height, 0, canvas.height - radius);
  context.lineTo(0, radius);
  context.quadraticCurveTo(0, 0, radius, 0);
  context.closePath();
  context.fill();
  context.fillStyle = 'white';
  context.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  const scale = 0.0025;
  sprite.scale.set(canvas.width * scale, canvas.height * scale, 1.0);
  sprite.position.y = 1.5;

  // ▼▼▼ [수정] matrixAutoUpdate 추가 ▼▼▼
  sprite.matrixAutoUpdate = true;
  // ▲▲▲ 수정 완료 ▲▲▲

  return sprite; // 생성된 스프라이트 반환
};

// --- 헬퍼 함수: 채팅 말풍선 스프라이트 생성 ---
const createChatBubbleSprite = (text) => {
  const resolutionScale = 2;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const fontSize = 20 * resolutionScale;
  const fontWeight = 'normal';
  const fontFamily = 'Arial';
  context.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  const maxWidth = 300 * resolutionScale;
  const textMetrics = context.measureText(text);
  const textWidth = Math.min(textMetrics.width, maxWidth);
  const padding = 10 * resolutionScale;
  const verticalPadding = 5 * resolutionScale;
  canvas.width = textWidth + padding * 2;
  canvas.height = fontSize + verticalPadding * 2;
  context.fillStyle = 'rgba(255, 255, 255, 0.9)';
  context.strokeStyle = 'rgba(0, 0, 0, 0.5)';
  context.lineWidth = 2 * resolutionScale;
  const radius = 8 * resolutionScale;
  context.beginPath();
  context.moveTo(radius, 0);
  context.lineTo(canvas.width - radius, 0);
  context.quadraticCurveTo(canvas.width, 0, canvas.width, radius);
  context.lineTo(canvas.width, canvas.height - radius);
  context.quadraticCurveTo(canvas.width, canvas.height, canvas.width - radius, canvas.height);
  context.lineTo(radius, canvas.height);
  context.quadraticCurveTo(0, canvas.height, 0, canvas.height - radius);
  context.lineTo(0, radius);
  context.quadraticCurveTo(0, 0, radius, 0);
  context.closePath();
  context.fill();
  context.stroke();
  context.fillStyle = 'black';
  context.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  const scale = 0.0025;
  sprite.scale.set(canvas.width * scale, canvas.height * scale, 1.0);
  sprite.position.y = 1.9;
  return sprite;
};

// --- 헬퍼 함수: 아바타에 말풍선 표시 (5초 후 자동 제거) ---
const showChatBubble = (avatar, message) => {
  if (!avatar) return;
  if (avatar.activeBubble) {
    avatar.remove(avatar.activeBubble);
    avatar.activeBubble.material.map.dispose();
    avatar.activeBubble.material.dispose();
    clearTimeout(avatar.activeBubble.timeoutId);
    avatar.activeBubble = null;
  }
  const newBubble = createChatBubbleSprite(message);
  const timeoutId = setTimeout(() => {
    if (avatar.activeBubble === newBubble) {
      avatar.remove(newBubble);
      newBubble.material.map.dispose();
      newBubble.material.dispose();
      avatar.activeBubble = null;
    }
  }, 5000);
  newBubble.timeoutId = timeoutId;
  avatar.activeBubble = newBubble;
  avatar.add(newBubble);
};

// --- Firebase RTDB 관련 함수 ---
const joinPlaza = async () => {
  if (!auth.currentUser || !myAvatar) {
      console.error("Plaza에 참여할 수 없습니다: 로그인되지 않았거나 아바타가 로드되지 않았습니다.");
      return;
  }
  const currentUid = auth.currentUser.uid;
  playerRef = dbRef(rtdb, `${plazaPlayersPath}/${currentUid}`);
  const playerData = {
    avatarUrl: myAvatarUrl,
    userName: myUserName,
    position: { x: myAvatar.position.x, y: myAvatar.position.y, z: myAvatar.position.z },
    rotationY: myAvatar.rotation.y,
    timestamp: serverTimestamp(),
  };
  try {
    await set(playerRef, playerData);
    await onDisconnect(playerRef).remove();
    console.log('Plaza 입장에 성공했습니다.');
    isReady.value = true;
  } catch (error) {
    console.error("Plaza 입장 실패:", error);
    isLoading.value = true;
    loadingMessage.value = "입장에 실패했습니다.";
  }
};

const updateMyStateInRTDB = () => {
  if (!playerRef || !myAvatar || !isReady.value) return;
  const { x, y, z } = myAvatar.position;
  const currentRotationY = myAvatar.rotation.y;
  const newState = {
    position: {
      x: isFiniteNumber(x) ? x : 0,
      y: isFiniteNumber(y) ? y : 0,
      z: isFiniteNumber(z) ? z : 0,
    },
    rotationY: isFiniteNumber(currentRotationY) ? currentRotationY : 0,
    timestamp: serverTimestamp(),
  };
  update(playerRef, newState)
    .catch((error) => {
      if (isReady.value) {
        console.error("!!! RTDB UPDATE FAILED (DB 규칙 확인 필요) !!!", error.message);
        isReady.value = false;
        isLoading.value = true;
        loadingMessage.value = `실시간 연결 끊김: ${error.message}`;
      }
    });
};

// --- [신규] 헬퍼 함수: 클릭/터치로 이동 ---
const handlePointerDown = (event) => {
  // 채팅창 입력 중일 때는 이동 로직 무시
  if (chatInputRef.value === document.activeElement) return;

  const cityMap = scene.getObjectByName("cityMap");
  if (!cityMap) return; // 맵이 아직 로드되지 않았으면 중단

  // --- 기존 키보드/조이스틱 입력 초기화 ---
  keysPressed['KeyW'] = false; keysPressed['KeyS'] = false;
  keysPressed['KeyA'] = false; keysPressed['KeyD'] = false;
  joystickData.value = { active: false, angle: 0, distance: 0, force: 0 };
  
  // --- Raycasting 로직 ---
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  // 클릭/터치 좌표를 -1 ~ +1 사이의 정규화된 장치 좌표(NDC)로 변환
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(pointer, camera); // 카메라에서 화면 좌표로 Ray 발사
  const intersects = raycaster.intersectObject(cityMap, true); // 도시 맵과의 교차점 확인

  if (intersects.length > 0) {
    const targetPoint = intersects[0].point;
    navigationTarget.value = targetPoint; // 이동 목표 지점 설정

    // --- 목표 지점 시각적 마커 (녹색 원통) ---
    if (!targetMarker) {
      const markerGeometry = new THREE.CylinderGeometry(0.2, 0.2, 0.1, 16); // 얇은 원반
      const markerMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.7 });
      targetMarker = new THREE.Mesh(markerGeometry, markerMaterial);
      scene.add(targetMarker);
    }
    targetMarker.position.copy(targetPoint); // 마커를 클릭 지점으로 이동
    targetMarker.position.y += 0.05; // 바닥보다 살짝 위에 표시
    targetMarker.visible = true; // 마커 표시
  }
};

let lastUpdateTime = 0;
const updateInterval = 100;
const throttledUpdate = () => {
  const now = Date.now();
  if (now - lastUpdateTime > updateInterval) {
    updateMyStateInRTDB();
    lastUpdateTime = now;
  }
};

const listenToOtherPlayers = (preloadedAnimations) => {
  playersListenerRef = dbRef(rtdb, plazaPlayersPath);
  const currentUid = auth.currentUser.uid;

  onChildAdded(playersListenerRef, async (snapshot) => {
    const userId = snapshot.key;
    if (userId === currentUid || otherPlayers[userId]) return;
    const playerData = snapshot.val();
    console.log(`플레이어 입장 감지: ${playerData.userName || userId}`);
    otherPlayers[userId] = {
      mesh: null, mixer: null, actions: {},
      targetPosition: new THREE.Vector3(playerData.position?.x ?? 0, playerData.position?.y ?? 0, playerData.position?.z ?? 0), // Nullish coalescing
      targetRotationY: playerData.rotationY ?? 0, // Nullish coalescing
      userName: playerData.userName || '익명',
      isMoving: false
    };
    try {
      const loadedModel = await loadAvatar(playerData.avatarUrl, preloadedAnimations);
      console.log(`${playerData.userName || userId} 아바타 로드 완료 (애니메이션 포함)`);
      if (scene && otherPlayers[userId]) {
          loadedModel.position.copy(otherPlayers[userId].targetPosition); // 초기 위치 설정
          loadedModel.rotation.y = otherPlayers[userId].targetRotationY; // 초기 회전 설정
          if (otherPlayers[userId].userName !== '익명') {
              const otherNickname = createNicknameSprite(otherPlayers[userId].userName);
              loadedModel.add(otherNickname);
              console.log(`${playerData.userName || userId} 닉네임 추가 완료`);
          }
          scene.add(loadedModel);
          otherPlayers[userId].mesh = loadedModel;
          otherPlayers[userId].mixer = loadedModel.userData.mixer;
          otherPlayers[userId].actions = loadedModel.userData.actions;
          console.log(`${playerData.userName || userId} 씬에 추가 완료 (애니메이션 설정 포함)`);
      } else {
          console.warn(`${userId} 씬에 추가 실패 (씬이 없거나 이미 퇴장함)`);
          if (otherPlayers[userId]) { delete otherPlayers[userId]; }
      }
    } catch (error) {
      console.error(`${userId} 플레이어 처리 중 오류 발생:`, error);
      if (otherPlayers[userId]) { delete otherPlayers[userId]; }
    }
  });

  onChildChanged(playersListenerRef, (snapshot) => {
    const userId = snapshot.key;
    if (userId === currentUid || !otherPlayers[userId]) return;
    const playerData = snapshot.val();
    const player = otherPlayers[userId];
    if (!playerData || !playerData.position) {
        console.warn(`[onChildChanged] ${userId}의 playerData 또는 position이 null입니다.`, playerData);
        return;
    }
    const newRotationY = playerData.rotationY;
    if (isFiniteNumber(newRotationY)) {
        player.targetRotationY = newRotationY;
    } else {
        console.warn(`[onChildChanged] ${userId}의 rotationY가 유효하지 않습니다.`, playerData);
    }
    // Nullish coalescing 추가하여 안전하게 접근
    player.targetPosition.set(playerData.position.x ?? 0, playerData.position.y ?? 0, playerData.position.z ?? 0);
  });

  onChildRemoved(playersListenerRef, (snapshot) => {
    const userId = snapshot.key;
    if (userId === currentUid || !otherPlayers[userId]) return;
    const playerToRemove = otherPlayers[userId];
    if (playerToRemove.mesh && playerToRemove.mesh.activeBubble) {
      clearTimeout(playerToRemove.mesh.activeBubble.timeoutId);
      playerToRemove.mesh.activeBubble.material.map.dispose();
      playerToRemove.mesh.activeBubble.material.dispose();
      console.log(`${userId}의 말풍선 리소스 제거`);
    }
    if (scene && playerToRemove.mesh) { scene.remove(playerToRemove.mesh); }
    if (playerToRemove.mesh) {
        playerToRemove.mesh.traverse(child => {
           if (child.isMesh) {
             if (child.geometry) child.geometry.dispose();
             if (Array.isArray(child.material)) {
               child.material.forEach(material => {
                 if (material.map) material.map.dispose();
                 material.dispose();
               });
             } else if (child.material) {
               if (child.material.map) child.material.map.dispose();
               child.material.dispose();
             }
           }
           else if (child instanceof THREE.Sprite) {
               if (child.material.map) child.material.map.dispose();
               child.material.dispose();
           }
        });
    }
    delete otherPlayers[userId];
    console.log(`플레이어 ${userId} 퇴장`);
  });
};

const listenToChat = () => {
  chatListenerRef = query(dbRef(rtdb, plazaChatPath), limitToLast(MAX_CHAT_MESSAGES));
  onChildAdded(chatListenerRef, (snapshot) => {
    const msg = { id: snapshot.key, ...snapshot.val() };
    chatMessages.value.push(msg);
    if (chatMessages.value.length > MAX_CHAT_MESSAGES) { chatMessages.value.shift(); }
    nextTick(() => { if (messageListRef.value) { messageListRef.value.scrollTop = messageListRef.value.scrollHeight; } });
    const currentUid = auth.currentUser?.uid; // Optional chaining
    if (!currentUid) return; // 로그인 안 되어 있으면 종료
    if (msg.userId === currentUid && myAvatar) {
      showChatBubble(myAvatar, msg.message);
    } else if (otherPlayers[msg.userId] && otherPlayers[msg.userId].mesh) {
      showChatBubble(otherPlayers[msg.userId].mesh, msg.message);
    }
  });
};

const sendMessage = () => {
  if (!chatInput.value.trim() || !isReady.value || !auth.currentUser) return;
  const chatMessage = { userId: auth.currentUser.uid, userName: myUserName || '익명', message: chatInput.value.trim(), timestamp: serverTimestamp() };
  push(dbRef(rtdb, plazaChatPath), chatMessage);
  chatInput.value = '';
  if (chatInputRef.value) { chatInputRef.value.blur(); }
};

// --- Three.js 초기화 함수 ---
const initThree = () => {
  try {
      // 씬 생성
      scene = new THREE.Scene();

      // 배경 이미지 로더
      const textureLoader = new THREE.TextureLoader();
      textureLoader.load(
        '/my_background.jpg', // public 폴더에 있는 배경 이미지 경로
        (texture) => { // 로드 성공 시 콜백
          texture.mapping = THREE.EquirectangularReflectionMapping; // 360도 매핑 설정
          scene.background = texture; // 씬 배경으로 설정
          scene.environment = texture; // 환경맵으로 설정 (반사 등에 사용)
          console.log("배경 이미지 로드 완료");
        },
        undefined, // 진행 콜백 (사용 안 함)
        (err) => { // 로드 실패 시 콜백
          console.error('배경 이미지 로드 실패:', err);
          scene.background = new THREE.Color(0xade6ff); // 실패 시 기본 파란색 배경
        }
      ); // textureLoader.load() 끝

      // 안개 설정 (맵 크기에 맞게 범위 조정)
      scene.fog = new THREE.Fog(0xaaaaaa, 70, 200);

      // --- 시작 좌표 정의 ---
      const startX = 37.16;
      const startY = 5.49; // 콘솔에서 확인한 Y값
      const startZ = 7.85;
      // --- ---

      // 카메라 생성
      camera = new THREE.PerspectiveCamera(
        75, // 시야각 (Field of View)
        window.innerWidth / window.innerHeight, // 종횡비 (Aspect Ratio)
        0.1, // Near 클리핑 평면
        1000 // Far 클리핑 평면
      );
      
      // ▼▼▼ [수정] 카메라 초기 위치를 더 뒤로, 더 높게 설정 ▼▼▼
      camera.position.set(startX, startY + 5, startZ + 10);
      // ▲▲▲ 수정 완료 ▲▲▲
      
      // 렌더러 생성 및 설정
      if (!canvasRef.value) { // 캔버스 요소가 없으면 에러 처리
        console.error("캔버스 요소를 찾을 수 없습니다!");
        return false; // 초기화 실패 반환
      }
      renderer = new THREE.WebGLRenderer({
        canvas: canvasRef.value, // 렌더링할 캔버스 요소 지정
        antialias: true // 계단 현상 완화(Anti-aliasing) 활성화
      });
      renderer.setSize(window.innerWidth, window.innerHeight); // 렌더러 크기를 창 크기에 맞춤

      // 그림자 설정
      renderer.shadowMap.enabled = true; // 그림자 맵 활성화
      renderer.shadowMap.type = THREE.PCFSoftShadowMap; // 부드러운 그림자 타입 설정

// --- OrbitControls 초기화 ---
      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.1;
      controls.screenSpacePanning = false;
      controls.minDistance = 2;
      controls.maxDistance = 20; // ★ 최대 줌 거리를 늘려서 맵을 더 넓게 볼 수 있도록 함
      controls.maxPolarAngle = Math.PI / 2 - 0.05; // 바닥 아래로 못 보게
      controls.target.set(startX, startY + 1.0, startZ);
      controls.update();
      // --- OrbitControls 초기화 끝 ---

      // --- 광원 설정 ---
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.7); // 주변광
      scene.add(ambientLight);

      const dirLight = new THREE.DirectionalLight(0xffffff, 1.2); // 방향광
      dirLight.position.set(50, 80, 40); // 광원 위치
      dirLight.castShadow = true; // 그림자 생성 활성화

      // 방향광 그림자 설정
      dirLight.shadow.mapSize.width = 2048; // 그림자 맵 해상도
      dirLight.shadow.mapSize.height = 2048;
      dirLight.shadow.camera.near = 1;
      dirLight.shadow.camera.far = 200; // 그림자 렌더링 끝 거리
      // 그림자 카메라 범위 (맵 크기에 맞게 확장)
      dirLight.shadow.camera.left = -80;
      dirLight.shadow.camera.right = 80;
      dirLight.shadow.camera.top = 80;
      dirLight.shadow.camera.bottom = -80;
      dirLight.shadow.bias = -0.001; // 그림자 자체 아티팩트 줄이기
      scene.add(dirLight); // 씬에 방향광 추가

      const hemiLight = new THREE.HemisphereLight(0xade6ff, 0x444444, 0.6); // 반구광
      scene.add(hemiLight);
      // --- 광원 설정 끝 ---

      // --- 도시 맵 로드 ---
	loader.load(
	    '/models/low_poly_city_pack.glb', // ✅ 상대 경로 확인
        // --- 로드 성공 콜백 ---
        (gltf) => {
          try { // 콜백 내부 에러 처리
              const city = gltf.scene; // 로드된 3D 객체
              city.name = "cityMap"; // Raycasting 등에서 쉽게 찾기 위해 이름 부여

              // 모델의 원본 경계 상자 계산
              const box = new THREE.Box3().setFromObject(city);
              const size = box.getSize(new THREE.Vector3());
              const center = box.getCenter(new THREE.Vector3());
              console.log('도시 모델 원본 크기:', size);

              // 원하는 맵 크기에 맞춰 스케일 비율 계산
              const desiredMaxSize = 150; // 맵의 목표 크기
              const scaleFactor = desiredMaxSize / Math.max(size.x, size.z);
              city.scale.set(scaleFactor, scaleFactor, scaleFactor); // 스케일 적용

              // 스케일 적용 후 경계 상자를 다시 계산하여 가장 낮은 Y 좌표 찾기
              const scaledBox = new THREE.Box3().setFromObject(city);
              const scaledMinY = scaledBox.min.y;
              // 맵의 가장 낮은 지점이 월드 Y=0에 오도록 전체 맵의 Y 위치 오프셋 계산
              const groundLevelY = -scaledMinY;
              // 맵의 중심이 월드 (0, 0, 0)에 오도록 X, Z 위치 설정 + 계산된 Y 오프셋 적용
              city.position.set(-center.x * scaleFactor, groundLevelY, -center.z * scaleFactor);

              // 맵 내부의 모든 메쉬 객체 순회하며 그림자 설정
              city.traverse(child => {
                if (child.isMesh) {
                  child.castShadow = true;    // 그림자 생성
                  child.receiveShadow = true; // 그림자 받음
                }
              });

              // 최종 설정된 맵 객체를 씬에 추가
              scene.add(city);
              console.log(`도시 맵 로드 완료 (스케일: ${scaleFactor.toFixed(2)}, 바닥 높이 Y: ${groundLevelY.toFixed(2)})`);

              // --- 아바타 초기 위치 설정 (새 시작 좌표 사용) ---
              if (myAvatar) { // 내 아바타 객체가 로드된 상태인지 확인
                // Y 좌표는 시작점 Y 값(startY) 사용
                myAvatar.position.set(startX, startY, startZ);
                console.log(`내 아바타 초기 위치 설정: X=${startX}, Y=${startY.toFixed(2)}, Z=${startZ}`);
              }
              // --- 위치 재설정 끝 ---

          } catch(processError) { // 맵 처리 중 에러 발생 시
              console.error('!!! 도시 맵 처리 중 심각한 오류 발생:', processError);
          }
        },
        // --- 진행 콜백 (사용 안 함) ---
        undefined,
        // --- 로드 실패 콜백 (상세 로깅) ---
        (error) => {
          console.error('!!! 도시 맵 로드 실패 (GLTFLoader 에러):', error);
          if (error.message) console.error("에러 메시지:", error.message);
          if (error.error) console.error("세부 에러:", error.error);
          if (error.target && error.target.src) console.error("요청 URL:", error.target.src);
        }
      ); // loader.load(도시 맵) 끝
      // --- 도시 맵 로드 끝 ---

      // 시계 생성 (애니메이션 및 시간 기반 로직에 사용)
      clock = new THREE.Clock();
      return true; // 초기화 성공 반환

  } catch (error) { // try 블록 전체 에러 처리
      console.error("Three.js 초기화 중 오류 발생:", error);
      return false; // 초기화 실패 반환
  }
}; // initThree 함수 끝

// --- 플레이어 이동 로직 ---
const handleKeyDown = (event) => {
    if (chatInputRef.value === document.activeElement) return;
    keysPressed[event.code] = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) { // Space 추가
        event.preventDefault();
    }
};
const handleKeyUp = (event) => { keysPressed[event.code] = false; };
const handleJoystickMove = (evt, data) => { joystickData.value = { active: true, angle: data.angle.radian, distance: data.distance, force: data.force }; };
const handleJoystickEnd = () => { joystickData.value = { active: false, angle: 0, distance: 0, force: 0 }; };

// 매 프레임 호출: 내 아바타 위치/회전 업데이트
const updatePlayerMovement = (deltaTime) => {
  if (!myAvatar || !isReady.value || !scene) return;

  // --- 상태 변수 초기화 ---
  let moved = false;
  // let applyRotation = false; // ★★★ applyRotation 변수 선언 삭제 ★★★
  let targetRotationY = myAvatar.rotation.y;
  let moveDirection = { x: 0, z: 0 };
  let currentAnimation = 'idle';

  // --- 입력 처리 (조이스틱) ---
  if (joystickData.value.active && joystickData.value.distance > 10) {
    targetRotationY = -joystickData.value.angle + Math.PI / 2;
    // applyRotation = true; // ★★★ 삭제 ★★★ (아래 if문에서 직접 joystickData.value.active 확인)
    moveDirection.z = -1;
    moved = true;
    currentAnimation = 'walk';
  }
  // --- 입력 처리 (키보드) ---
  else if (!joystickData.value.active) {
    // 좌우 이동 (A/D) 로직
    if (keysPressed['KeyA'] || keysPressed['ArrowLeft']) {
      moveDirection.x = 1; moved = true; currentAnimation = 'strafeLeft';
      // ★★★ targetRotationY, applyRotation 설정 코드 삭제 ★★★
    }
    if (keysPressed['KeyD'] || keysPressed['ArrowRight']) {
      moveDirection.x = -1; moved = true; currentAnimation = 'strafeRight';
      // ★★★ targetRotationY, applyRotation 설정 코드 삭제 ★★★
    }
    // 앞뒤 이동 (W/S) 로직
    if (keysPressed['KeyW'] || keysPressed['ArrowUp']) {
      moveDirection.z = -1; moved = true;
      if (currentAnimation === 'idle') currentAnimation = 'walk';
    }
    if (keysPressed['KeyS'] || keysPressed['ArrowDown']) {
      moveDirection.z = 1; moved = true;
      if (currentAnimation === 'idle') currentAnimation = 'walkBackward';
    }
  }

  // --- 회전 적용 (조이스틱 사용 시 부드럽게) ---
  // ▼▼▼ [수정] applyRotation 대신 joystickData.value.active 직접 확인 ▼▼▼
  if (joystickData.value.active && moved) { // 조이스틱 활성 && 이동 중일 때만 회전
      let currentY = myAvatar.rotation.y; const PI2 = Math.PI * 2;
      currentY = (currentY % PI2 + PI2) % PI2; targetRotationY = (targetRotationY % PI2 + PI2) % PI2;
      let diff = targetRotationY - currentY; if (Math.abs(diff) > Math.PI) { diff = diff > 0 ? diff - PI2 : diff + PI2; }
      const rotationSpeedFactor = 8;
      const rotationChange = diff * deltaTime * rotationSpeedFactor;
      myAvatar.rotation.y += rotationChange;
      // moved = true; // 이미 moved=true 임
  }
  // ▲▲▲ [수정 끝] ▲▲▲

  // --- 이동 적용 ---
  if (moved) {
    let currentSpeedFactor = 1.0;
    if (joystickData.value.active) { currentSpeedFactor = joystickData.value.force; }

    // 이동 벡터 생성 (X와 Z 방향 모두 고려)
    const velocity = new THREE.Vector3(
      moveDirection.x * moveSpeed * 0.7 * deltaTime, // 좌우 이동은 약간 느리게 (0.7배)
      0,
      moveDirection.z * moveSpeed * currentSpeedFactor * deltaTime
    );

    // 아바타의 현재 방향 기준으로 월드 이동 벡터 계산
    velocity.applyQuaternion(myAvatar.quaternion);
    myAvatar.position.add(velocity); // 위치 업데이트
  }

  // --- 경계 처리 및 Y 위치 고정 ---
  const boundary = 74.5; // ★ 경계 확장 (맵 크기 150 기준) ★
  myAvatar.position.x = Math.max(-boundary, Math.min(boundary, myAvatar.position.x));
  myAvatar.position.z = Math.max(-boundary, Math.min(boundary, myAvatar.position.z));
  const cityMap = scene.getObjectByName("cityMap");
  let groundY = myAvatar.position.y;
  if (cityMap) {
      const raycaster = new THREE.Raycaster();
      const down = new THREE.Vector3(0, -1, 0);
      raycaster.set(myAvatar.position.clone().add(new THREE.Vector3(0, 1, 0)), down);
      const intersects = raycaster.intersectObject(cityMap, true);
      groundY = intersects.length > 0 ? intersects[0].point.y : cityMap.position.y;
  }
  myAvatar.position.y = groundY;
  // --- Y 위치 고정 끝 ---

  // ▼▼▼ [임시 로그 추가] 아바타의 현재 좌표를 콘솔에 출력 ▼▼▼
  console.log(`Avatar Position - X: ${myAvatar.position.x.toFixed(2)}, Y: ${myAvatar.position.y.toFixed(2)}, Z: ${myAvatar.position.z.toFixed(2)}`);
  // ▲▲▲ [임시 로그 추가 끝] ▲▲▲

  // 이동/회전했으면 서버 업데이트
  if (moved) { throttledUpdate(); }

  // --- ★★★ 애니메이션 전환 로직 개선 ★★★ ---
  const mixer = myAvatar.userData.mixer;
  const actions = myAvatar.userData.actions;

  // 모든 사용 가능한 액션 이름 배열 (로드된 것만)
  const availableActions = Object.keys(actions);

  if (mixer && availableActions.length > 0) {
    // 현재 재생해야 할 애니메이션 액션 가져오기 (없으면 idle)
    const targetAction = actions[currentAnimation] || actions.idle;
    // 현재 재생 중인 다른 액션 찾기
    let currentPlayingAction = null;
    for (const key of availableActions) {
      if (actions[key].isRunning() && actions[key] !== targetAction) {
        currentPlayingAction = actions[key];
        break;
      }
    }

    if (targetAction && !targetAction.isRunning()) {
      targetAction.reset().play(); // 목표 액션 재생
      if (currentPlayingAction) {
        // 기존 액션에서 목표 액션으로 부드럽게 전환
        currentPlayingAction.crossFadeTo(targetAction, 0.3);
      }
      // console.log(`Animation Changed: ${currentAnimation}`); // 디버깅 로그
    } else if (!targetAction && actions.idle && !actions.idle.isRunning()) {
      // 목표 액션도 없고 Idle도 실행 중 아니면 Idle 재생 (방어 코드)
      actions.idle.reset().play();
      if (currentPlayingAction) {
        currentPlayingAction.crossFadeTo(actions.idle, 0.3);
      }
    }
  }
  // --- ★★★ 애니메이션 전환 로직 끝 ★★★ ---
}; // updatePlayerMovement 함수 끝

const updateOtherPlayersMovement = (deltaTime) => {
  const lerpFactor = deltaTime * 8;
  const moveThreshold = 0.01;
  for (const userId in otherPlayers) {
    const player = otherPlayers[userId];
    if (!player.mesh) continue;
    const mesh = player.mesh;
    const distance = mesh.position.distanceTo(player.targetPosition);
    const wasMoving = player.isMoving;
    player.isMoving = distance > moveThreshold;
    mesh.position.lerp(player.targetPosition, lerpFactor);
    let currentY = mesh.rotation.y; let targetY = player.targetRotationY; const PI2 = Math.PI * 2;
    currentY = (currentY % PI2 + PI2) % PI2; targetY = (targetY % PI2 + PI2) % PI2;
    let diff = targetY - currentY; if (Math.abs(diff) > Math.PI) { diff = diff > 0 ? diff - PI2 : diff + PI2; }
    mesh.rotation.y += diff * lerpFactor;
    mesh.rotation.x = 0; mesh.rotation.z = 0;
    const mixer = player.mixer;
    const actions = player.actions;
    const idleAction = actions.idle;
    const walkAction = actions.walk;
    if (mixer && idleAction && walkAction) {
      if (player.isMoving && !wasMoving) {
        walkAction.reset().play();
        idleAction.crossFadeTo(walkAction, 0.3);
      } else if (!player.isMoving && wasMoving) {
        idleAction.reset().play();
        walkAction.crossFadeTo(idleAction, 0.3);
      }
    } else if (mixer && idleAction && !walkAction && !idleAction.isRunning()) {
       idleAction.reset().play();
    }
  }
};

// --- 애니메이션 루프 ---
const animate = () => {
  if (!renderer || !scene || !camera || !clock) return; // 필수 요소 없으면 중단
  requestAnimationFrame(animate); // 다음 프레임 요청
  const deltaTime = clock.getDelta(); // 프레임 간 시간 간격

  // 믹서 업데이트 (아바타 애니메이션)
  if (myAvatar && myAvatar.userData.mixer) { myAvatar.userData.mixer.update(deltaTime); }
  for (const userId in otherPlayers) { if (otherPlayers[userId].mixer) { otherPlayers[userId].mixer.update(deltaTime); } }

  // 이동 로직 호출
  updatePlayerMovement(deltaTime);
  updateOtherPlayersMovement(deltaTime);

  // OrbitControls 업데이트
  if (controls) {
    if (myAvatar) {
      const targetLookAt = myAvatar.position.clone().add(new THREE.Vector3(0, 1.0, 0));
      controls.target.lerp(targetLookAt, deltaTime * 5.0);
    }
    controls.update(); // 컨트롤 상태 업데이트

    // ▼▼▼ [신규] 클릭 이동 목표 지점이 없으면 마커 숨김 ▼▼▼
    if (targetMarker) {
      targetMarker.visible = !!navigationTarget.value; // navigationTarget.value가 있으면 true, 없으면 false
    }
    // ▲▲▲ 추가 완료 ▲▲▲
  }

  // 씬 렌더링
  renderer.render(scene, camera);
};

// --- 창 크기 조절 처리 ---
const handleResize = () => {
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
};

// --- 컴포넌트 라이프사이클 훅 ---
onMounted(async () => {
  // 배포 버전 확인용 로그
  console.log('--- DEPLOY TEST VERSION 14 --- THIS IS THE NEWEST CODE ---');

  // 로그인 상태 확인
  if (!auth.currentUser) {
    console.error("로그인되지 않음.");
    loadingMessage.value = "로그인이 필요합니다.";
    isLoading.value = false; // 로딩 상태 해제
    return; // 함수 종료
  }
  const currentUid = auth.currentUser.uid; // 현재 사용자 UID 저장

  // 1. Three.js 환경 초기화
  const initSuccess = initThree(); // initThree 함수 호출
  if (!initSuccess) { // 초기화 실패 시 (예: 캔버스 요소 못 찾음)
      loadingMessage.value = "3D 환경 초기화 실패.";
      isLoading.value = false; // 로딩 상태 해제
      return; // 함수 종료
  }

  // 2. 애니메이션 파일 미리 로드
  loadingMessage.value = '애니메이션 로딩 중...';
  const preloadedAnimations = await loadAnimations(); // 비동기 로드 완료까지 기다림
  // Idle 또는 Walk 애니메이션 로드 실패 시 경고 메시지 표시
  if (!preloadedAnimations.idle || !preloadedAnimations.walk) {
    loadingMessage.value = '기본 애니메이션 로드 실패. 애니메이션 없이 진행합니다.';
    // 애니메이션 로드 실패 시에도 진행은 계속함 (선택 사항)
  }

  // 3. 브라우저 이벤트 리스너 등록 및 애니메이션 루프 시작
  window.addEventListener('resize', handleResize); // 창 크기 변경 감지
  window.addEventListener('keydown', handleKeyDown); // 키보드 누름 감지
  window.addEventListener('keyup', handleKeyUp);     // 키보드 뗌 감지

  // ▼▼▼ [수정] 클릭/터치 이동 리스너 추가 ▼▼▼
  if (canvasRef.value) {
    canvasRef.value.addEventListener('pointerdown', handlePointerDown);
  }
  // ▲▲▲ 수정 완료 ▲▲▲

  animate(); // 렌더링 및 업데이트 루프 시작

  // 4. Firestore에서 사용자 정보 가져오기
  loadingMessage.value = '내 정보 로딩 중...';
  try {
      // users 컬렉션에서 현재 사용자 UID에 해당하는 문서 가져오기
      const userDoc = await getDoc(doc(db, 'users', currentUid));
      if (userDoc.exists()) { // 문서가 존재하면
          myAvatarUrl = userDoc.data().avatarUrl || ''; // avatarUrl 필드 값 가져오기 (없으면 빈 문자열)
          myUserName = userDoc.data().name || '익명'; // name 필드 값 가져오기 (없으면 '익명')

          // 아바타 URL 로깅 강화
          if (!myAvatarUrl) {
              console.warn("Firestore에서 아바타 URL을 찾을 수 없습니다. 기본 아바타가 로드됩니다.");
          } else {
              console.log("Firestore에서 가져온 아바타 URL:", myAvatarUrl);
          }
      } else { // 사용자 문서가 Firestore에 없으면
          console.error("Firestore 사용자 문서 없음! 기본 아바타로 진행합니다.");
          myUserName = '익명';
          myAvatarUrl = ''; // URL 명시적으로 비움
      }
  } catch (error) { // Firestore 데이터 로드 중 에러 발생 시
      console.error("Firestore 정보 가져오기 실패:", error);
      loadingMessage.value = '내 정보 로딩 실패.';
      isLoading.value = false; // 로딩 상태 해제
      return; // 함수 종료
  }

  // 5. 내 아바타 로드 및 닉네임 추가
  loadingMessage.value = '내 아바타 로딩 중...';
  try {
    // loadAvatar 함수 호출 직전 URL 확인 로그
    console.log(`[중요] loadAvatar 함수에 전달될 URL: '${myAvatarUrl}' (타입: ${typeof myAvatarUrl})`);
    // loadAvatar 함수 호출 (아바타 URL과 미리 로드된 애니메이션 전달)
    const loadedModel = await loadAvatar(myAvatarUrl, preloadedAnimations);

    myAvatar = loadedModel; // 로드된 모델을 myAvatar 변수에 할당

    // 초기 위치/회전 설정은 initThree 함수 내부의 도시 맵 로드 콜백에서 진행됨

    // 사용자 이름이 있으면 닉네임 스프라이트 생성 및 추가
    if (myUserName && myUserName !== '익명') {
        const myNickname = createNicknameSprite(myUserName);
        myNickname.matrixAutoUpdate = true; // 닉네임 위치 자동 업데이트 활성화
        myAvatar.add(myNickname); // 아바타 객체에 닉네임 추가
    }

    // 최종 아바타 객체를 씬에 추가
    scene.add(myAvatar);
    console.log('[DEBUG] myAvatar added to scene (초기 위치는 맵 로드 후 설정됨)');

  } catch (error) { // 아바타 로드 실패 시 (URL이 유효하지 않거나 로드 중 에러 발생)
    console.error("내 아바타 로드 중 에러 발생 (또는 URL 없음):", error);
    loadingMessage.value = '아바타 로딩 실패. 기본 아바타로 시작합니다.';

    // myAvatar 객체가 아직 생성되지 않았다면 기본 그룹 생성
    if (!myAvatar) { myAvatar = new THREE.Group(); myAvatar.matrixAutoUpdate = true; }

    try { // 기본 아바타(녹색 큐브) 로드 시도
      const fallbackModel = await loadAvatar(null, preloadedAnimations); // null URL 전달
      myAvatar = fallbackModel; // 기본 아바타 모델 할당
      scene.add(myAvatar); // 씬에 기본 아바타 추가
    } catch (e) { // 기본 아바타 로드조차 실패한 경우
        console.error("기본 아바타 로드조차 실패.", e);
        isLoading.value = false; // 로딩 상태 해제
        return; // 함수 종료
    }
  }

  // 6. 조이스틱 초기화
  await nextTick(); // DOM 업데이트 기다림
  const joystickZone = document.getElementById('joystick-zone'); // 조이스틱 영역 DOM 요소 찾기
  if (joystickZone) { // 요소가 존재하면
    try {
        // nipplejs 인스턴스 생성 및 설정
        joystickManager = nipplejs.create({
          zone: joystickZone, // 조이스틱 영역 지정
          mode: 'static', // 조이스틱 모드
          position: { right: '80px', bottom: '80px' }, // 위치
          color: 'rgba(255, 255, 255, 0.5)', // 색상
          size: 100 // 크기
        });
        // 조이스틱 이벤트 리스너 등록
        joystickManager.on('move', handleJoystickMove); // 움직일 때
        joystickManager.on('end', handleJoystickEnd);   // 놓았을 때
        console.log("조이스틱 생성 완료");
    } catch (e) { // 조이스틱 생성 실패 시
        console.error("조이스틱 생성 실패:", e);
    }
  } else { // 조이스틱 영역 요소를 찾지 못했을 때
    console.warn("조이스틱 영역('#joystick-zone')을 찾을 수 없습니다.");
  }

  // 7. RTDB 연결 및 리스너 시작
  loadingMessage.value = '다른 플레이어 접속 중...';
  await joinPlaza(); // Plaza 입장 시도 (RTDB에 내 정보 등록)
  if(isReady.value){ // joinPlaza 성공 시
    listenToOtherPlayers(preloadedAnimations); // 다른 플레이어 리스너 시작 (애니메이션 객체 전달)
    listenToChat(); // 채팅 리스너 시작
  }
  else { // joinPlaza 실패 시
    loadingMessage.value = 'Plaza 연결 실패.'; // 실패 메시지 표시
    return; // 함수 종료
  }

  // 모든 로딩 및 초기화 완료
  isLoading.value = false;
}); // onMounted 함수 끝

onUnmounted(() => {
  // 이벤트 리스너 제거
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('keyup', handleKeyUp);

  // ▼▼▼ [수정] 클릭/터치 이동 리스너 제거 ▼▼▼
  if (canvasRef.value) {
    canvasRef.value.removeEventListener('pointerdown', handlePointerDown);
  }
  // ▲▲▲ 수정 완료 ▲▲▲

  // RTDB 리스너 제거
  if (playersListenerRef) off(playersListenerRef);
  if (chatListenerRef) off(chatListenerRef);

  // RTDB 내 정보 제거 (세션 종료 시)
  if (playerRef) remove(playerRef);

  // 조이스틱 제거
  if (joystickManager) {
    joystickManager.off('move', handleJoystickMove);
    joystickManager.off('end', handleJoystickEnd);
    joystickManager.destroy(); // 조이스틱 인스턴스 파괴
    joystickManager = null; // 참조 제거
  }

  // 내 아바타의 활성 말풍선 리소스 정리
  if (myAvatar && myAvatar.activeBubble) {
    clearTimeout(myAvatar.activeBubble.timeoutId); // 타이머 취소
    if (myAvatar.activeBubble.material.map) {
        myAvatar.activeBubble.material.map.dispose(); // 텍스처 해제
    }
    myAvatar.activeBubble.material.dispose(); // 재질 해제
    myAvatar.activeBubble = null; // 참조 제거
  }

  // OrbitControls 리소스 해제
  if (controls) {
    controls.dispose(); // 이벤트 리스너 등 제거
    controls = null; // 참조 제거
  }

  // 타겟 마커 리소스 해제
  if (targetMarker) {
      if (targetMarker.geometry) targetMarker.geometry.dispose();
      if (targetMarker.material) targetMarker.material.dispose();
      if (scene) scene.remove(targetMarker); // 씬에서도 제거
      targetMarker = null;
  }

  // Three.js 리소스 정리
  if (renderer) {
    renderer.dispose(); // WebGL 컨텍스트 관련 리소스 해제
    renderer = null; // 참조 제거
  }
  if (scene) {
     // 씬 내부의 모든 객체를 순회하며 지오메트리, 재질, 텍스처 해제
     scene.traverse(object => {
       if (object.isMesh) { // 메쉬 객체인 경우
         if (object.geometry) {
           object.geometry.dispose(); // 지오메트리 해제
         }
         // 재질(Material)이 배열일 경우 (예: MultiMaterial)
         if (Array.isArray(object.material)) {
           object.material.forEach(material => {
             if (material.map) material.map.dispose(); // 텍스처 해제
             material.dispose(); // 재질 해제
           });
         }
         // 재질이 단일 객체일 경우
         else if (object.material) {
           if (object.material.map) object.material.map.dispose(); // 텍스처 해제
           object.material.dispose(); // 재질 해제
         }
       } else if (object instanceof THREE.Sprite) { // 스프라이트 객체인 경우 (닉네임, 말풍선)
         if (object.material.map) object.material.map.dispose(); // 텍스처(캔버스) 해제
         object.material.dispose(); // 재질 해제
       }
     });
    scene = null; // 씬 참조 제거
  }
  // 다른 전역 참조들도 제거
  camera = null;
  clock = null;
  myAvatar = null;
  otherPlayers = {}; // 다른 플레이어 목록 초기화
}); // onUnmounted 함수 끝

</script>

<style scoped>
/* 이전 스타일과 동일 */
.utopia-container { width: 100vw; height: 100vh; margin: 0; padding: 0; overflow: hidden; position: relative; background-color: #ade6ff; }
.main-canvas { display: block; width: 100%; height: 100%; }
.loading-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.8); color: white; display: flex; flex-direction: column; justify-content: center; align-items: center; z-index: 10; font-size: 1.1em; }
.spinner { border: 4px solid rgba(255, 255, 255, 0.3); width: 40px; height: 40px; border-radius: 50%; border-left-color: #fff; animation: spin 1s linear infinite; margin-bottom: 20px; }
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
.chat-ui {
  position: absolute;
  bottom: 20px;
  left: 20px;
  width: 300px;
  max-width: 80%;
  max-height: 20%; /* 모바일 높이 조절 */
  background-color: rgba(0, 0, 0, 0.7);
  border-radius: 8px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  z-index: 5;
  box-shadow: 0 2px 10px rgba(0,0,0,0.5);
}
.message-list { flex-grow: 1; overflow-y: auto; margin-bottom: 10px; color: white; font-size: 0.9em; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.3) rgba(0,0,0,0.5); }
.message-list::-webkit-scrollbar { width: 5px; } .message-list::-webkit-scrollbar-track { background: rgba(0,0,0,0.5); border-radius: 3px;} .message-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.3); border-radius: 3px;} .message-list::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.5); }
.chat-message { margin-bottom: 6px; word-break: break-all; line-height: 1.4; } .chat-message strong { color: #f1c40f; margin-right: 5px; }
.chat-ui input { width: 100%; padding: 10px; border: none; border-radius: 4px; background-color: rgba(255, 255, 255, 0.15); color: white; outline: none; font-size: 0.9em; box-sizing: border-box; } .chat-ui input::placeholder { color: rgba(255, 255, 255, 0.6); } .chat-ui input:disabled { background-color: rgba(255, 255, 255, 0.1); cursor: not-allowed; }
.joystick-zone { position: absolute; bottom: 30px; right: 30px; width: 150px; height: 150px; z-index: 6; opacity: 0.7; }
</style>