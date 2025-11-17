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
// [수정] OrbitControls import
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
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
let controls; // OrbitControls 인스턴스

// ▼▼▼ [복구] 클릭/터치 이동 관련 변수 ▼▼▼
const navigationTarget = ref(null); // 클릭/터치로 이동할 목표 지점
const pointerDownPos = new THREE.Vector2(); // 클릭 시작 지점 (X, Y)
const pointerDownTime = ref(0); // 클릭 시작 시간
// ▲▲▲ 복구 완료 ▲▲▲

const loader = new GLTFLoader();

// --- Firebase RTDB 경로 ---
const plazaPlayersPath = 'plazaPlayers';
const plazaChatPath = 'plazaChat';
let playerRef = null;
let playersListenerRef = null;
let chatListenerRef = null;

// --- 플레이어 이동 관련 ---
const moveSpeed = 2.0;
// [삭제] rotateSpeed 변수 삭제
const keysPressed = reactive({});
const joystickData = ref({ active: false, angle: 0, distance: 0, force: 0 });
let joystickManager = null;

// --- [수정] 헬퍼 함수: 애니메이션 파일 로드 (좌우/뒤 추가) ---
const loadAnimations = async () => {
  const animationPaths = {
    idle: '/animations/M_Standing_Idle_Variations_008.glb',
    walk: '/animations/F_Walk_003.glb',
    walkBackward: '/animations/M_Walk_Backwards_001.glb', // 뒤로 걷기
    strafeLeft: '/animations/M_Walk_Strafe_Left_002.glb',  // 왼쪽 게걸음
    strafeRight: '/animations/M_Walk_Strafe_Right_002.glb' // 오른쪽 게걸음
  };
  const loadedAnimations = { idle: null, walk: null, walkBackward: null, strafeLeft: null, strafeRight: null };
  const keys = Object.keys(animationPaths);

  try {
    const gltfResults = await Promise.all(
      Object.values(animationPaths).map(path => loader.loadAsync(path).catch(e => {
        console.error(`애니메이션 로드 실패: ${path}`, e);
        return null;
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
    });

    return loadedAnimations;

  } catch (error) {
    console.error('애니메이션 로딩 중 전체 오류 발생:', error);
    return loadedAnimations;
  }
};

// --- [수정] 헬퍼 함수: 아바타 로드 (닉네임 지연 문제 해결) ---
const loadAvatar = (url, animations) => {
  return new Promise((resolve) => {
    const model = new THREE.Group();
    // ▼▼▼ [수정] 닉네임 지연 문제 해결 (부모 matrixAutoUpdate = true) ▼▼▼
    model.matrixAutoUpdate = true;
    // ▲▲▲
    model.position.set(0, 0, 0);
    model.userData.mixer = null;
    model.userData.actions = {};

    // URL 없거나 GLB 아닐 때 기본 큐브 생성
    if (!url || !url.endsWith('.glb')) {
      console.warn("아바타 URL이 유효하지 않거나 GLB 파일이 아닙니다. 기본 큐브를 사용합니다.", url);
      const visuals = new THREE.Group();
      const geometry = new THREE.BoxGeometry(0.5, 1, 0.5);
      const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 }); // 기본 큐브 색상 (녹색)
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
          if (child.isSkinnedMesh) {
            child.geometry.translate(-center.x, -box.min.y, -center.z);
            child.castShadow = true;
            child.matrixAutoUpdate = false; // 스킨 메쉬는 false 권장
          }
          else if (child.isMesh) {
            child.geometry.translate(-center.x, -box.min.y, -center.z);
            child.castShadow = true;
            child.matrixAutoUpdate = true;
          }
        });

        visuals.scale.set(0.7, 0.7, 0.7);
        visuals.position.set(0, 0, 0);
        visuals.rotation.set(0, 0, 0);
        visuals.matrixAutoUpdate = true;
        model.add(visuals);

        // 닉네임 부착을 위해 visuals 그룹을 userData에 저장
        model.userData.visuals = visuals;

        // --- [수정] 애니메이션 적용 로직 (로드된 모든 애니메이션) ---
        if (animations && Object.values(animations).some(clip => clip !== null)) {
          const mixer = new THREE.AnimationMixer(visuals);
          model.userData.mixer = mixer;

          for (const key in animations) {
            if (animations[key]) {
              const action = mixer.clipAction(animations[key]);
              model.userData.actions[key] = action;
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
        // --- 애니메이션 적용 로직 끝 ---

        resolve(model);
      },
      undefined,
      (error) => {
        console.error('아바타 로딩 실패:', error, 'URL:', url);
        // ★★★ 빨간색 큐브로 변경 ★★★
        const visuals = new THREE.Group();
        const geometry = new THREE.BoxGeometry(0.5, 1, 0.5);
        const material = new THREE.MeshStandardMaterial({ color: 0xff0000 }); // 빨간색
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

// --- [수정] 헬퍼 함수: 닉네임 스프라이트 생성 (닉네임 지연 문제) ---
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
  sprite.position.y = 2.0; // 높이 2.0 유지

  // ▼▼▼ [수정] 닉네임 지연 문제 해결 (matrixAutoUpdate = true 다시 추가) ▼▼▼
  sprite.matrixAutoUpdate = true;
  // ▲▲▲ 수정 완료 ▲▲▲

  return sprite;
};

// --- [복구] 헬퍼 함수: 클릭/터치 시작 ---
const handlePointerDown = (event) => {
  // 채팅창 입력 중일 때는 무시
  if (chatInputRef.value === document.activeElement) return;

  // 클릭 시작 시간과 좌표 저장
  pointerDownTime.value = Date.now();
  pointerDownPos.set(event.clientX, event.clientY);
};

// --- [복구] 헬퍼 함수: 클릭/터치 종료 (클릭 vs 드래그 판별) ---
const handlePointerUp = (event) => {
  // 채팅창 입력 중일 때는 무시
  if (chatInputRef.value === document.activeElement) return;

  const cityMap = scene.getObjectByName("cityMap");
  if (!cityMap) return; // 맵이 아직 로드되지 않았으면 중단

  const DRAG_THRESHOLD_TIME = 200; // 200ms
  const DRAG_THRESHOLD_DISTANCE = 10; // 10px (드래그 민감도)

  const timeElapsed = Date.now() - pointerDownTime.value;
  const distanceMoved = pointerDownPos.distanceTo(new THREE.Vector2(event.clientX, event.clientY));

  // --- '클릭'으로 판정 (짧은 시간, 적은 움직임) ---
  if (timeElapsed < DRAG_THRESHOLD_TIME && distanceMoved < DRAG_THRESHOLD_DISTANCE) {
    // 기존 키보드/조이스틱 입력 초기화
    keysPressed['KeyW'] = false; keysPressed['KeyS'] = false;
    keysPressed['KeyA'] = false; keysPressed['KeyD'] = false;
    joystickData.value = { active: false, angle: 0, distance: 0, force: 0 };
    
    // --- Raycasting 로직 ---
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObject(cityMap, true);

    if (intersects.length > 0) {
      const targetPoint = intersects[0].point;
      navigationTarget.value = targetPoint; // 이동 목표 지점 설정
    }
  }
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

// --- [삭제] 클릭/터치 이동 관련 함수 (handlePointerDown, handlePointerUp) ---
// (해당 함수 정의 전체 삭제)

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

let lastUpdateTime = 0;
const updateInterval = 100;
const throttledUpdate = () => {
  const now = Date.now();
  if (now - lastUpdateTime > updateInterval) {
    updateMyStateInRTDB();
    lastUpdateTime = now;
  }
};

// 다른 플레이어들의 입장/상태변경/퇴장 실시간 감지
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
      targetPosition: new THREE.Vector3(playerData.position?.x ?? 0, playerData.position?.y ?? 0, playerData.position?.z ?? 0),
      targetRotationY: playerData.rotationY ?? 0,
      userName: playerData.userName || '익명',
      isMoving: false
    };
    try {
      const loadedModel = await loadAvatar(playerData.avatarUrl, preloadedAnimations);
      console.log(`${playerData.userName || userId} 아바타 로드 완료 (애니메이션 포함)`);
      if (scene && otherPlayers[userId]) {
          loadedModel.position.copy(otherPlayers[userId].targetPosition);
          loadedModel.rotation.y = otherPlayers[userId].targetRotationY;
          if (otherPlayers[userId].userName !== '익명') {
              const otherNickname = createNicknameSprite(otherPlayers[userId].userName);
              if (loadedModel.userData.visuals) {
                  loadedModel.userData.visuals.add(otherNickname);
              } else {
                  loadedModel.add(otherNickname);
              }
          }
          scene.add(loadedModel);
          otherPlayers[userId].mesh = loadedModel;
          otherPlayers[userId].mixer = loadedModel.userData.mixer;
          otherPlayers[userId].actions = loadedModel.userData.actions;
          console.log(`${playerData.userName || userId} 씬에 추가 완료 (애니메이션 설정 포함)`);
      } else {
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
    }
    player.targetPosition.set(playerData.position.x ?? 0, playerData.position.y ?? 0, playerData.position.z ?? 0);
  });

  // ▼▼▼ [수정] onChildRemoved 블록 수정 ▼▼▼
  onChildRemoved(playersListenerRef, (snapshot) => {
    const userId = snapshot.key;
    if (userId === currentUid || !otherPlayers[userId]) return;
    const playerToRemove = otherPlayers[userId];

    // 말풍선 리소스 정리
    if (playerToRemove.mesh && playerToRemove.mesh.activeBubble) {
      clearTimeout(playerToRemove.mesh.activeBubble.timeoutId);
      if (playerToRemove.mesh.activeBubble.material.map) {
          playerToRemove.mesh.activeBubble.material.map.dispose();
      }
      playerToRemove.mesh.activeBubble.material.dispose();
    }
    
    if (scene && playerToRemove.mesh) { scene.remove(playerToRemove.mesh); }
    
    // ▼▼▼ [수정] 'child' 변수를 사용하는 리소스 정리 코드 추가 ▼▼▼
    if (playerToRemove.mesh) {
        playerToRemove.mesh.traverse(child => { // <--- 'child' 사용
           if (child.isSkinnedMesh) {
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
           else if (child.isMesh) {
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
           else if (child instanceof THREE.Sprite) { // 닉네임, 말풍선
             if (child.material.map) child.material.map.dispose();
             child.material.dispose();
           }
        });
    }
    // ▲▲▲ 수정 완료 ▲▲▲

    delete otherPlayers[userId];
    console.log(`플레이어 ${userId} 퇴장`);
  });
  // ▲▲▲ [수정] onChildRemoved 블록 수정 끝 ▲▲▲
};

const listenToChat = () => {
  chatListenerRef = query(dbRef(rtdb, plazaChatPath), limitToLast(MAX_CHAT_MESSAGES));
  onChildAdded(chatListenerRef, (snapshot) => {
    const msg = { id: snapshot.key, ...snapshot.val() };
    chatMessages.value.push(msg);
    if (chatMessages.value.length > MAX_CHAT_MESSAGES) { chatMessages.value.shift(); }
    nextTick(() => { if (messageListRef.value) { messageListRef.value.scrollTop = messageListRef.value.scrollHeight; } });
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) return;
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

// --- [수정] Three.js 초기화 함수 (시작 위치, OrbitControls, 맵 스케일, 자동차 제거) ---
const initThree = () => {
  try {
      scene = new THREE.Scene();

      // 배경 이미지 로더
      const textureLoader = new THREE.TextureLoader();
      textureLoader.load(
        '/my_background.jpg',
        (texture) => {
          texture.mapping = THREE.EquirectangularReflectionMapping;
          scene.background = texture;
          scene.environment = texture;
          console.log("배경 이미지 로드 완료");
        },
        undefined,
        (err) => {
          console.error('배경 이미지 로드 실패:', err);
          scene.background = new THREE.Color(0xade6ff);
        }
      );

      // 안개 설정 (맵 크기에 맞게 범위 조정)
      scene.fog = new THREE.Fog(0xaaaaaa, 70, 200);

      // --- 시작 좌표 정의 (스크린샷 기준) ---
      const startX = 37.16;
      const startY = 5.49;
      const startZ = 7.85;
      // --- ---

      // 카메라 생성
      camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      
      // ▼▼▼ [수정] P1: 카메라 초기 위치를 더 뒤로, 더 높게 설정 ▼▼▼
      camera.position.set(startX, startY + 8, startZ + 15);
      // ▲▲▲ 수정 완료 ▲▲▲

      if (!canvasRef.value) { /* ... */ return false; }
      renderer = new THREE.WebGLRenderer({ canvas: canvasRef.value, antialias: true });
      renderer.setSize(window.innerWidth, window.innerHeight);

      // 그림자 설정
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      // --- OrbitControls 초기화 (클릭 이동 없으므로 'start' 리스너 제거) ---
      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.1;
      controls.screenSpacePanning = false;
      controls.minDistance = 2;
      // ▼▼▼ [수정] P1: 최대 줌 아웃 거리 증가 ▼▼▼
      controls.maxDistance = 40;
      // ▲▲▲
      controls.maxPolarAngle = Math.PI / 2 - 0.05; // 바닥 아래로 못 보게
      
      // ▼▼▼ [복구] P3: 'start' 이벤트 리스너 추가 (클릭 이동 방해 방지) ▼▼▼
      controls.addEventListener('start', () => {
        // 마우스/터치 드래그(회전)가 시작되면 클릭 이동 목표를 취소
        if (navigationTarget.value) {
          navigationTarget.value = null;
        }
      });
      // ▲▲▲ 복구 완료 ▲▲▲

      controls.target.set(startX, startY + 1.0, startZ); // 초기 타겟 설정
      controls.update();
      // --- OrbitControls 초기화 끝 ---

      // --- 광원 설정 (맵 스케일에 맞게 조정) ---
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
      scene.add(ambientLight);
      const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
      dirLight.position.set(50, 80, 40); // 광원 위치
      dirLight.castShadow = true;
      dirLight.shadow.mapSize.width = 2048;
      dirLight.shadow.mapSize.height = 2048;
      dirLight.shadow.camera.near = 1;
      dirLight.shadow.camera.far = 200;
      dirLight.shadow.camera.left = -80;
      dirLight.shadow.camera.right = 80;
      dirLight.shadow.camera.top = 80;
      dirLight.shadow.camera.bottom = -80;
      dirLight.shadow.bias = -0.001;
      scene.add(dirLight);
      const hemiLight = new THREE.HemisphereLight(0xade6ff, 0x444444, 0.6);
      scene.add(hemiLight);
      // --- 광원 설정 끝 ---

      // --- 도시 맵 로드 (스케일 150) ---
      loader.load(
        '/models/low_poly_city_pack.glb',
        (gltf) => {
          try {
              const city = gltf.scene;
              city.name = "cityMap";
              const box = new THREE.Box3().setFromObject(city);
              const size = box.getSize(new THREE.Vector3());
              const center = box.getCenter(new THREE.Vector3());
              console.log('도시 모델 원본 크기:', size);

              const desiredMaxSize = 150; // 맵 크기
              const scaleFactor = desiredMaxSize / Math.max(size.x, size.z);
              city.scale.set(scaleFactor, scaleFactor, scaleFactor);

              const scaledBox = new THREE.Box3().setFromObject(city);
              const scaledMinY = scaledBox.min.y;
              const groundLevelY = -scaledMinY;
              city.position.set(-center.x * scaleFactor, groundLevelY, -center.z * scaleFactor);

              city.traverse(child => {
                if (child.isMesh) {
                  child.castShadow = true;
                  child.receiveShadow = true;
                }
              });

              scene.add(city);
              console.log(`도시 맵 로드 완료 (스케일: ${scaleFactor.toFixed(2)}, 바닥 높이 Y: ${groundLevelY.toFixed(2)})`);

              // --- 아바타 초기 위치 설정 ---
              if (myAvatar) {
                myAvatar.position.set(startX, startY, startZ);
                console.log(`내 아바타 초기 위치 설정: X=${startX}, Y=${startY.toFixed(2)}, Z=${startZ}`);
              }
              // --- 위치 재설정 끝 ---

          } catch(processError) {
              console.error('!!! 도시 맵 처리 중 심각한 오류 발생:', processError);
          }
        },
        undefined,
        (error) => {
          console.error('!!! 도시 맵 로드 실패 (GLTFLoader 에러):', error);
        }
      );
      // --- 도시 맵 로드 끝 ---

      // [삭제] 자동차 로드 코드 삭제

      clock = new THREE.Clock();
      return true;
  } catch (error) {
      console.error("Three.js 초기화 중 오류 발생:", error);
      return false;
  }
}; // initThree 함수 끝

// --- 플레이어 이동 로직 ---
const handleKeyDown = (event) => {
    if (chatInputRef.value === document.activeElement) return;
    keysPressed[event.code] = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
        event.preventDefault();
    }
};
const handleKeyUp = (event) => { keysPressed[event.code] = false; };
const handleJoystickMove = (evt, data) => { joystickData.value = { active: true, angle: data.angle.radian, distance: data.distance, force: data.force }; };
const handleJoystickEnd = () => { joystickData.value = { active: false, angle: 0, distance: 0, force: 0 }; };

// 매 프레임 호출: 내 아바타 위치/회전 업데이트
const updatePlayerMovement = (deltaTime) => {
  if (!myAvatar || !isReady.value || !scene) return;

  let moved = false;
  let moveDirection = new THREE.Vector3(0, 0, 0); // (x, y, z) - 로컬 방향
  let currentAnimation = 'idle';
  let targetRotationY = myAvatar.rotation.y;
  let applyRotation = false; // 아바타가 회전해야 하는지 여부
  let speedFactor = 1.0;

  // 카메라의 현재 Y축 회전값 (오일러 각도)
  const cameraEuler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');

  // --- 1. 클릭/터치 이동 처리 ---
  if (navigationTarget.value != null) {
    // 키보드/조이스틱 입력이 감지되면 클릭 이동 중지
    if (joystickData.value.active || keysPressed['KeyW'] || keysPressed['KeyS'] || keysPressed['KeyA'] || keysPressed['KeyD'] || keysPressed['ArrowUp'] || keysPressed['ArrowDown'] || keysPressed['ArrowLeft'] || keysPressed['ArrowRight']) {
      navigationTarget.value = null;
    } else {
      const targetPos = navigationTarget.value;
      const currentPos = myAvatar.position;
      const distance = Math.sqrt(Math.pow(targetPos.x - currentPos.x, 2) + Math.pow(targetPos.z - currentPos.z, 2));

      if (distance < 0.2) {
        // 목표 도착
        navigationTarget.value = null;
        moved = false;
        currentAnimation = 'idle';
      } else {
        // 목표를 향해 이동
        const direction = new THREE.Vector3().subVectors(targetPos, currentPos);
        direction.y = 0;
        
        // 아바타가 목표 지점을 바라보도록 회전
        targetRotationY = Math.atan2(direction.x, direction.z);
        applyRotation = true;
        
        // 아바타 기준 '앞으로' 이동 설정
        moveDirection.z = -1; // -Z (Forward)
        moved = true;
        currentAnimation = 'walk';
      }
    }
  }
  
  // --- 2. 조이스틱 이동 (클릭 이동 중이 아닐 때) ---
  if (navigationTarget.value == null && joystickData.value.active && joystickData.value.distance > 10) {
    // 조이스틱은 아바타가 해당 방향을 바라보며 이동 (기존 로직 유지)
    targetRotationY = -joystickData.value.angle + Math.PI / 2;
    applyRotation = true;
    moveDirection.z = -1; // -Z (Forward)
    speedFactor = joystickData.value.force;
    moved = true;
    currentAnimation = 'walk';
  } 
  // --- 3. 키보드 이동 (클릭/조이스틱 이동 중이 아닐 때) ---
  else if (navigationTarget.value == null) { 
    if (keysPressed['KeyA'] || keysPressed['ArrowLeft']) {
      moveDirection.x = -1; // 로컬 Left (A)
      currentAnimation = 'strafeLeft';
    }
    if (keysPressed['KeyD'] || keysPressed['ArrowRight']) {
      moveDirection.x = 1; // 로컬 Right (D)
      currentAnimation = 'strafeRight';
    }
    if (keysPressed['KeyW'] || keysPressed['ArrowUp']) {
      moveDirection.z = -1; // 로컬 Forward (W)
      if (currentAnimation === 'idle') currentAnimation = 'walk';
    }
    if (keysPressed['KeyS'] || keysPressed['ArrowDown']) {
      moveDirection.z = 1; // 로컬 Backward (S)
      if (currentAnimation === 'idle') currentAnimation = 'walkBackward';
    }
    
    // 키보드 입력이 있었는지 확인
    if (moveDirection.x !== 0 || moveDirection.z !== 0) {
      moved = true;
      
      // [핵심 수정] W(앞으로) 키를 눌렀을 때만 아바타가 카메라 방향으로 회전
      if (moveDirection.z < 0) { // -Z (Forward)
        targetRotationY = cameraEuler.y;
        applyRotation = true;
      } 
      // S(뒤로) 또는 A/D(좌우)만 눌렀을 때는 회전하지 않음
      else if (moveDirection.z > 0 || moveDirection.x !== 0) {
         applyRotation = false; 
      }
    }
  }
  // --- 입력 처리 끝 ---

  // --- 4. 회전 적용 (필요한 경우) ---
  if (applyRotation) {
      let currentY = myAvatar.rotation.y; const PI2 = Math.PI * 2;
      let targetY = targetRotationY;
      // 가장 가까운 각도로 회전하도록 보정
      currentY = (currentY % PI2 + PI2) % PI2; targetY = (targetY % PI2 + PI2) % PI2;
      let diff = targetY - currentY; if (Math.abs(diff) > Math.PI) { diff = diff > 0 ? diff - PI2 : diff + PI2; }
      // 부드러운 회전 (Lerp)
      const rotationChange = diff * deltaTime * 8; 
      myAvatar.rotation.y += rotationChange;
  }

  // --- 5. 이동 적용 (움직임이 감지된 경우) ---
  if (moved) {
    // 최종 속도 벡터 생성
    const velocity = new THREE.Vector3(
      moveDirection.x * moveSpeed * 0.7 * deltaTime, // 좌우 이동 속도 (감속)
      0,
      moveDirection.z * moveSpeed * speedFactor * deltaTime // 앞뒤 이동 속도
    );

    // [핵심 수정] 이동 방식 분기
    // 키보드 입력 시: 카메라 기준(Camera-Relative)으로 이동
    if (navigationTarget.value == null && !joystickData.value.active) {
        velocity.applyEuler(new THREE.Euler(0, cameraEuler.y, 0)); 
    } 
    // 클릭 또는 조이스틱 입력 시: 아바타 기준(Avatar-Relative)으로 이동
    else {
        velocity.applyQuaternion(myAvatar.quaternion); 
    }
    
    myAvatar.position.add(velocity);
  }

  // --- 6. 경계 처리 및 바닥 높이 맞추기 (기존과 동일) ---
  const boundary = 74.5;
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

  // --- 7. 서버 상태 업데이트 (기존과 동일) ---
  if (moved) { throttledUpdate(); }

  // --- 8. 애니메이션 전환 로직 (기존과 동일) ---
  const mixer = myAvatar.userData.mixer;
  const actions = myAvatar.userData.actions;
  const availableActions = Object.keys(actions);

  if (mixer && availableActions.length > 0) {
    // currentAnimation 값 (예: 'walk', 'idle')에 맞는 액션을 찾음
    const targetAction = actions[currentAnimation] || actions.idle;
    let currentPlayingAction = null;
    
    // 현재 재생 중인 다른 액션을 찾음
    for (const key of availableActions) {
      if (actions[key].isRunning() && actions[key] !== targetAction) {
        currentPlayingAction = actions[key];
        break;
      }
    }
    
    // 목표 액션이 재생 중이 아니라면, 재생시킴
    if (targetAction && !targetAction.isRunning()) {
      targetAction.reset().play();
      // 다른 액션이 재생 중이었다면, 부드럽게 교차(Fade)시킴
      if (currentPlayingAction) {
        currentPlayingAction.crossFadeTo(targetAction, 0.3);
      }
    } 
    // 목표 액션이 없는데 'idle'이 재생 중이 아니라면 'idle' 재생
    else if (!targetAction && actions.idle && !actions.idle.isRunning()) {
      actions.idle.reset().play();
      if (currentPlayingAction) {
        currentPlayingAction.crossFadeTo(actions.idle, 0.3);
      }
    }
  }
  // --- 애니메이션 전환 로직 끝 ---
}; // updatePlayerMovement 함수 끝

// --- [수정] updateOtherPlayersMovement (닉네임 지연 및 애니메이션 로직) ---
const updateOtherPlayersMovement = (deltaTime) => {
  const lerpFactor = deltaTime * 8;
  const moveThreshold = 0.01;
  for (const userId in otherPlayers) {
    const player = otherPlayers[userId];
    if (!player.mesh) continue;
    const mesh = player.mesh;
    
    // 닉네임 지연 문제 해결 (부모 matrixAutoUpdate = true)
    mesh.matrixAutoUpdate = true;
    
    const distance = mesh.position.distanceTo(player.targetPosition);
    const wasMoving = player.isMoving; // <--- 'wasMoving' 선언 (Line 787)
    player.isMoving = distance > moveThreshold;
    mesh.position.lerp(player.targetPosition, lerpFactor);
    
    // 회전 보간
    let currentY = mesh.rotation.y; let targetY = player.targetRotationY; const PI2 = Math.PI * 2;
    currentY = (currentY % PI2 + PI2) % PI2; targetY = (targetY % PI2 + PI2) % PI2;
    let diff = targetY - currentY; if (Math.abs(diff) > Math.PI) { diff = diff > 0 ? diff - PI2 : diff + PI2; }
    mesh.rotation.y += diff * lerpFactor;
    mesh.rotation.x = 0; mesh.rotation.z = 0;
    
    // ▼▼▼ [수정] 'wasMoving' 변수를 사용하는 애니메이션 로직 추가 ▼▼▼
    const mixer = player.mixer;
    const actions = player.actions;
    const idleAction = actions.idle;
    const walkAction = actions.walk; // 다른 플레이어는 앞/뒤/좌/우 구분 없이 walk만 사용

    if (mixer && idleAction && walkAction) {
      if (player.isMoving && !wasMoving) { // 멈춤 -> 이동 시작 (wasMoving 사용)
        walkAction.reset().play();
        idleAction.crossFadeTo(walkAction, 0.3);
      } else if (!player.isMoving && wasMoving) { // 이동 -> 멈춤 (wasMoving 사용)
        idleAction.reset().play();
        walkAction.crossFadeTo(idleAction, 0.3);
      }
    } else if (mixer && idleAction && !walkAction && !idleAction.isRunning()) {
       // Walk 애니메이션이 없으면 Idle만 계속 재생
       idleAction.reset().play();
    }
    // ▲▲▲ 수정 완료 ▲▲▲
  }
};

// --- [수정] 애니메이션 루프 (닉네임 지연, 마커 제거) ---
const animate = () => {
  if (!renderer || !scene || !camera || !clock) return;
  requestAnimationFrame(animate);
  const deltaTime = clock.getDelta();

  // 믹서 업데이트
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
  }

  // ▼▼▼ [수정] P2: 강제 매트릭스 업데이트 코드 삭제 (닉네임 먼저 감 방지) ▼▼▼
  // if (scene) {
  //     scene.updateMatrixWorld(true);
  // }
  // ▲▲▲ 삭제 완료 ▲▲▲

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

  // ▼▼▼ [복구] 클릭/터치 이동 리스너 추가 ▼▼▼
  if (canvasRef.value) {
    canvasRef.value.addEventListener('pointerdown', handlePointerDown);
    canvasRef.value.addEventListener('pointerup', handlePointerUp);
  }
  // ▲▲▲ 복구 완료 ▲▲▲

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
        
        // ▼▼▼ [수정] 닉네임을 visuals 그룹에 추가 (닉네임 지연 문제) ▼▼▼
        if (myAvatar.userData.visuals) {
            myAvatar.userData.visuals.add(myNickname);
        } else {
            myAvatar.add(myNickname); // 비상시
        }
        // ▲▲▲ 수정 완료 ▲▲▲
    }

    // 최종 아바타 객체를 씬에 추가
    scene.add(myAvatar);
    console.log('[DEBUG] myAvatar added to scene (초기 위치는 맵 로드 후 설정됨)');

  } catch (error) { // 아바타 로드 실패 시 (URL이 유효하지 않거나 로드 중 에러 발생)
    console.error("내 아바타 로드 중 에러 발생 (또는 URL 없음):", error);
    loadingMessage.value = '아바타 로딩 실패. 기본 아바타로 시작합니다.';

    // myAvatar 객체가 아직 생성되지 않았다면 기본 그룹 생성
    if (!myAvatar) { myAvatar = new THREE.Group(); myAvatar.matrixAutoUpdate = true; }

    try { // 기본 아바타(빨간색 큐브) 로드 시도
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

// --- [수정] onUnmounted (클릭 리스너 제거) ---
onUnmounted(() => {
  // 이벤트 리스너 제거
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('keyup', handleKeyUp);

  // ▼▼▼ [삭제] 클릭/터치 이동 리스너 제거 ▼▼▼
  // if (canvasRef.value) {
  //   canvasRef.value.removeEventListener('pointerdown', handlePointerDown);
  //   canvasRef.value.removeEventListener('pointerup', handlePointerUp);
  // }
  // ▲▲▲ 삭제 완료 ▲▲▲

  // RTDB 리스너 제거
  if (playersListenerRef) off(playersListenerRef);
  if (chatListenerRef) off(chatListenerRef);

  // RTDB 내 정보 제거 (세션 종료 시)
  if (playerRef) remove(playerRef);

  // 조이스틱 제거
  if (joystickManager) {
    joystickManager.off('move', handleJoystickMove);
    joystickManager.off('end', handleJoystickEnd);
    joystickManager.destroy();
    joystickManager = null;
  }

  // 내 아바타 말풍선 리소스 정리
  if (myAvatar && myAvatar.activeBubble) {
    clearTimeout(myAvatar.activeBubble.timeoutId);
    if (myAvatar.activeBubble.material.map) {
        myAvatar.activeBubble.material.map.dispose();
    }
    myAvatar.activeBubble.material.dispose();
    myAvatar.activeBubble = null;
  }

  // OrbitControls 리소스 해제
  if (controls) {
    controls.dispose();
    controls = null;
  }

  // [삭제] 타겟 마커 리소스 해제 (주석 처리됨)
  /*
  if (targetMarker) {
      if (targetMarker.geometry) targetMarker.geometry.dispose();
      if (targetMarker.material) targetMarker.material.dispose();
      if (scene) scene.remove(targetMarker);
      targetMarker = null;
  }
  */

  // Three.js 리소스 정리
  if (renderer) {
    renderer.dispose();
    renderer = null;
  }
  if (scene) {
     scene.traverse(object => {
       if (object.isMesh) {
         if (object.geometry) { object.geometry.dispose(); }
         if (Array.isArray(object.material)) {
           object.material.forEach(material => {
             if (material.map) material.map.dispose();
             material.dispose();
           });
         } else if (object.material) {
           if (object.material.map) object.material.map.dispose();
           object.material.dispose();
         }
       } else if (object instanceof THREE.Sprite) {
         if (object.material.map) object.material.map.dispose();
         object.material.dispose();
       }
     });
    scene = null;
  }
  // 다른 전역 참조들도 제거
  camera = null;
  clock = null;
  myAvatar = null;
  otherPlayers = {};
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