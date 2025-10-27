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
import { auth, db, rtdb } from '@/firebaseConfig'; // Firestore getDoc 사용을 위해 db 유지
import { doc, getDoc } from 'firebase/firestore'; // doc, getDoc 유지
import {
  ref as dbRef, onChildAdded, onChildChanged, onChildRemoved,
  set, onDisconnect, push, serverTimestamp, off, query, limitToLast, remove,
  update // [★추가] update 함수를 import합니다.
} from 'firebase/database';

const isFiniteNumber = (num) => (typeof num === 'number' && isFinite(num));

// eslint-disable-next-line no-unused-vars
import nipplejs from 'nipplejs'; // ESLint 'no-unused-vars' 규칙 비활성화

// --- 상태 변수 ---
const canvasRef = ref(null); // 캔버스 DOM 참조
const isLoading = ref(true); // 로딩 상태 플래그
const loadingMessage = ref('유토피아 입장 준비 중...'); // 로딩 메시지
const isReady = ref(false); // 로딩 완료 및 상호작용 가능 여부 플래그

// --- 아바타 관련 ---
let myAvatar = null; // 내 아바타 Three.js Object3D 객체
let otherPlayers = {}; // [★수정] reactive 제거. 일반 JS 객체로 변경
let myAvatarUrl = ''; // 내 아바타 GLB 파일 URL
let myUserName = ''; // 내 사용자 이름 (채팅 표시용)

// --- 채팅 관련 ---
const chatInput = ref(''); // 채팅 입력값
const chatMessages = ref([]); // 채팅 메시지 목록 배열 { id, userName, message }
const messageListRef = ref(null); // 메시지 목록 DOM 요소 참조 (스크롤 제어용)
const chatInputRef = ref(null); // 채팅 입력창 DOM 요소 참조 (포커스 확인용)
const MAX_CHAT_MESSAGES = 50; // 화면에 표시할 최대 메시지 수

// --- Three.js 관련 ---
let scene, camera, renderer, clock; // Three.js 핵심 컴포넌트 변수
let cameraLookAtTarget = new THREE.Vector3(0, 1.0, 0); // [★추가] 카메라가 부드럽게 바라볼 지점
const loader = new GLTFLoader(); // GLB 모델 로더 인스턴스

// --- Firebase RTDB 경로 ---
const plazaPlayersPath = 'plazaPlayers'; // 플레이어 위치/정보 동기화 경로
const plazaChatPath = 'plazaChat';       // 채팅 메시지 경로
let playerRef = null; // 내 RTDB 플레이어 데이터 참조 객체
let playersListenerRef = null; // 다른 플레이어 데이터 리스너 참조 객체
let chatListenerRef = null; // 채팅 메시지 리스너 참조 객체

// --- 플레이어 이동 관련 ---
const moveSpeed = 2.0; // 초당 이동 속도 (Three.js 단위)
const rotateSpeed = Math.PI; // 초당 회전 속도 (라디안, PI = 180도)
const keysPressed = reactive({}); // 현재 눌린 키 상태 (Vue 반응형 객체)
const joystickData = ref({ active: false, angle: 0, distance: 0, force: 0 }); // 조이스틱 상태 (Vue ref)
let joystickManager = null; // nipplejs 인스턴스

// --- [신규] 헬퍼 함수: 애니메이션 파일 로드 ---
const loadAnimations = async () => {
  const animationPaths = {
    idle: '/animations/M_Standing_Idle_Variations_008.glb', // Idle 애니메이션 경로
    walk: '/animations/F_Walk_003.glb'                     // Walk 애니메이션 경로
  };
  const loadedAnimations = { idle: null, walk: null };

  try {
    const [idleGltf, walkGltf] = await Promise.all([
      loader.loadAsync(animationPaths.idle),
      loader.loadAsync(animationPaths.walk)
    ]);

    if (idleGltf.animations && idleGltf.animations.length > 0) {
      loadedAnimations.idle = idleGltf.animations[0]; // 첫 번째 애니메이션 클립 사용
      console.log('Idle 애니메이션 클립 로드 성공:', loadedAnimations.idle.name);
    } else {
      console.error('Idle 애니메이션 파일에 클립이 없습니다:', animationPaths.idle);
    }

    if (walkGltf.animations && walkGltf.animations.length > 0) {
      loadedAnimations.walk = walkGltf.animations[0]; // 첫 번째 애니메이션 클립 사용
      console.log('Walk 애니메이션 클립 로드 성공:', loadedAnimations.walk.name);
    } else {
      console.error('Walk 애니메이션 파일에 클립이 없습니다:', animationPaths.walk);
    }

    return loadedAnimations; // { idle: AnimationClip | null, walk: AnimationClip | null } 반환

  } catch (error) {
    console.error('애니메이션 로딩 중 오류 발생:', error);
    return loadedAnimations; // 실패 시에도 null 값 반환
  }
};

// --- 헬퍼 함수: 아바타 로드 ---
const loadAvatar = (url, animations) => { // ★ animations 인자 추가 ★
  return new Promise((resolve) => {
    const model = new THREE.Group();
    model.position.set(0, 0, 0);
    model.userData.mixer = null;
    model.userData.actions = {};

    // URL 없거나 GLB 아닐 때 기본 큐브 생성 (변경 없음)
    if (!url || !url.endsWith('.glb')) {
      console.warn("아바타 URL이 유효하지 않거나 GLB 파일이 아닙니다. 기본 큐브를 사용합니다.", url);
      const visuals = new THREE.Group(); // 이 경우에도 visuals 그룹으로 감싸줍니다.
      const geometry = new THREE.BoxGeometry(0.5, 1, 0.5);
      const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
      const cube = new THREE.Mesh(geometry, material);
      cube.position.y = 0.5;
      
      visuals.add(cube);
      visuals.scale.set(0.7, 0.7, 0.7);
      model.add(visuals); // model에 visuals를 추가
      
resolve(model); return;
    }

    loader.load(url,
      (gltf) => {
        const visuals = gltf.scene;
        // ... (모델 위치, 스케일, 그림자 등 설정 코드 - 변경 없음) ...
        visuals.traverse((child) => {
          if (child.isMesh) {
            child.geometry.translate(-center.x, -box.min.y, -center.z);
            // child.castShadow = true; // 그림자 관련 코드는 필요시 주석 해제
            // child.receiveShadow = false;
          }
          child.matrixAutoUpdate = true;
        });
        visuals.scale.set(0.7, 0.7, 0.7);
        visuals.position.set(0, 0, 0);
        visuals.rotation.set(0, 0, 0);
        visuals.matrixAutoUpdate = true;
        model.add(visuals);

        // --- ★ [애니메이션 로직 수정] ★ ---
        // 기존: gltf.animations 에서 찾기 -> 삭제!

        // 수정: 미리 로드된 animations 객체를 사용
        if (animations && animations.idle && animations.walk) {
          const mixer = new THREE.AnimationMixer(visuals);
          model.userData.mixer = mixer;

          const idleAction = mixer.clipAction(animations.idle); // 미리 로드한 idle 클립 사용
          idleAction.play(); // 기본 재생
          model.userData.actions.idle = idleAction;

          const walkAction = mixer.clipAction(animations.walk); // 미리 로드한 walk 클립 사용
          model.userData.actions.walk = walkAction; // 저장만 하고 재생은 X

          console.log(`[${url}] 외부 Idle, Walk 애니메이션 적용 완료`);
        } else {
          console.warn(`[${url}] 미리 로드된 Idle 또는 Walk 애니메이션 클립이 없습니다.`);
          // (선택) Idle이라도 있으면 Idle만 적용
          if (animations && animations.idle) {
             const mixer = new THREE.AnimationMixer(visuals);
             model.userData.mixer = mixer;
             const idleAction = mixer.clipAction(animations.idle);
             idleAction.play();
             model.userData.actions.idle = idleAction;
             console.log(`[${url}] 외부 Idle 애니메이션만 적용`);
          }
        }
        // --- ★ [애니메이션 로직 수정 끝] ★ ---

        resolve(model);
      },
      undefined,
      (error) => {
        // 9. 로드 실패 시 에러 큐브 생성
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
  const resolutionScale = 2; // ★★★ 해상도 배율 (2배) ★★★

  const canvas = document.createElement('canvas'); // 캔버스 요소 생성
  const context = canvas.getContext('2d'); // 2D 컨텍스트 가져오기
  
  // ★★★ [수정] 모든 수치를 resolutionScale 기준으로 조절 ★★★
  const fontSize = 24 * resolutionScale; // 48px
  const fontWeight = 'bold'; // 폰트 굵기
  const fontFamily = 'Arial'; // 폰트 종류
  context.font = `${fontWeight} ${fontSize}px ${fontFamily}`; // 폰트 설정
  const textMetrics = context.measureText(text); // 텍스트 너비 측정
  const textWidth = textMetrics.width;

  const padding = 10 * resolutionScale; // 20px
  const verticalPadding = 5 * resolutionScale; // 10px
  canvas.width = textWidth + padding * 2; // 캔버스 너비 설정
  canvas.height = fontSize + verticalPadding * 2; // 캔버스 높이 설정


  // 배경 그리기 (반투명 검정 라운드 사각형)
  context.fillStyle = 'rgba(0, 0, 0, 0.7)'; // 배경색 설정
  const radius = 8 * resolutionScale; // 16px
  // ★★★ [수정 끝] ★★★

  // 라운드 사각형 경로 정의
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
  context.fill(); // 경로 채우기

  // 텍스트 그리기 (흰색)
  context.fillStyle = 'white'; // 텍스트 색상
  context.font = `${fontWeight} ${fontSize}px ${fontFamily}`; // 폰트 재설정 (fillRect 후 필요할 수 있음)
  context.textAlign = 'center'; // 가로 중앙 정렬
  context.textBaseline = 'middle'; // 세로 중앙 정렬
  context.fillText(text, canvas.width / 2, canvas.height / 2); // 캔버스 중앙에 텍스트 그리기

  const texture = new THREE.CanvasTexture(canvas); // 캔버스로 텍스처 생성
  texture.needsUpdate = true; // 텍스처 업데이트 필요

  // 스프라이트 재질 생성 (텍스처 매핑, 투명도 사용)
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false }); // depthTest/Write false로 다른 객체 위에 그려지도록
  const sprite = new THREE.Sprite(material); // 스프라이트 객체 생성

  // 스프라이트 크기 조절 (월드 좌표 기준 크기, 아바타 크기와 시야각에 따라 조절 필요)
  // ★★★ [수정] 캔버스 해상도가 2배가 되었으므로, scale 값을 조절하여 최종 크기를 맞춥니다.
  const scale = 0.0025; // 기존 0.003에서 0.0025로 변경 (결과적으로 약 1.66배 커짐)
  sprite.scale.set(canvas.width * scale, canvas.height * scale, 1.0);

  // 아바타 머리 위 위치 설정 (Y축 오프셋)
  sprite.position.y = 1.5; // 높이는 그대로 유지

  return sprite; // 생성된 스프라이트 반환
};

// --- 헬퍼 함수: 채팅 말풍선 스프라이트 생성 ---
const createChatBubbleSprite = (text) => {
  const resolutionScale = 2; // ★★★ 해상도 배율 (2배) ★★★

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  
  // ★★★ [수정] 모든 수치를 resolutionScale 기준으로 조절 ★★★
  const fontSize = 20 * resolutionScale; // 40px
  const fontWeight = 'normal';
  const fontFamily = 'Arial';
  context.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  
  // 텍스트 너비 측정 (최대 너비 제한)
  const maxWidth = 300 * resolutionScale; // 600px
  const textMetrics = context.measureText(text);
  const textWidth = Math.min(textMetrics.width, maxWidth); // 최대 너비 적용

  const padding = 10 * resolutionScale; // 20px
  const verticalPadding = 5 * resolutionScale; // 10px
  canvas.width = textWidth + padding * 2;
  canvas.height = fontSize + verticalPadding * 2; // (참고: 여러 줄 텍스트는 높이 계산이 더 복잡해짐)

  // 배경 그리기 (흰색, 둥근 사각형, 검은 테두리)
  context.fillStyle = 'rgba(255, 255, 255, 0.9)'; // 반투명 흰색 배경
  context.strokeStyle = 'rgba(0, 0, 0, 0.5)'; // 테두리 색
  context.lineWidth = 2 * resolutionScale; // 4px
  const radius = 8 * resolutionScale; // 16px
  // ★★★ [수정 끝] ★★★
  
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
  context.stroke(); // 테두리 그리기

  // 텍스트 그리기 (검은색)
  context.fillStyle = 'black'; // 텍스트 색상
  context.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  // (참고: 여러 줄 텍스트는 여기서 wrapText 로직 필요)
  context.fillText(text, canvas.width / 2, canvas.height / 2); 

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;

  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false });
  const sprite = new THREE.Sprite(material);

  // ★★★ [수정] 닉네임과 동일한 스케일 적용
  const scale = 0.0025; 
  sprite.scale.set(canvas.width * scale, canvas.height * scale, 1.0);

  // 위치: 닉네임(1.5)보다 약간 위
  // (닉네임 스프라이트 자체의 높이도 커졌으므로, y=1.9 위치가 적절할 것입니다)
  sprite.position.y = 1.9; 

  return sprite;
};

// --- 헬퍼 함수: 아바타에 말풍선 표시 (5초 후 자동 제거) ---
const showChatBubble = (avatar, message) => {
  if (!avatar) return; // 아바타가 없으면 중단

  // 1. 기존에 표시 중인 말풍선이 있다면 즉시 제거
  if (avatar.activeBubble) {
    avatar.remove(avatar.activeBubble); // 씬에서 제거
    avatar.activeBubble.material.map.dispose(); // 텍스처 해제
    avatar.activeBubble.material.dispose(); // 재질 해제
    clearTimeout(avatar.activeBubble.timeoutId); // 이전 타이머 취소
    avatar.activeBubble = null;
  }

  // 2. 새로운 말풍선 생성
  const newBubble = createChatBubbleSprite(message);
  
  // 3. 5초 후 제거하는 타이머 설정
  const timeoutId = setTimeout(() => {
    // 5초가 지났을 때, 이 말풍선이 여전히 '활성' 상태인지 확인
    // (그 사이에 새 메시지가 와서 교체되지 않았다면)
    if (avatar.activeBubble === newBubble) {
      avatar.remove(newBubble);
      newBubble.material.map.dispose();
      newBubble.material.dispose();
      avatar.activeBubble = null;
    }
  }, 5000); // 5000ms = 5초

  // 4. 말풍선과 타이머 ID를 아바타 객체에 저장하고 씬에 추가
  newBubble.timeoutId = timeoutId;
  avatar.activeBubble = newBubble;
  avatar.add(newBubble); // 아바타의 자식으로 추가
};

// 새 채팅 메시지 수신
const listenToChat = () => {
  chatListenerRef = query(dbRef(rtdb, plazaChatPath), limitToLast(MAX_CHAT_MESSAGES));
  onChildAdded(chatListenerRef, (snapshot) => {
    const msg = { id: snapshot.key, ...snapshot.val() }; // 메시지 객체

    chatMessages.value.push(msg);
    if (chatMessages.value.length > MAX_CHAT_MESSAGES) { chatMessages.value.shift(); }
    nextTick(() => { if (messageListRef.value) { messageListRef.value.scrollTop = messageListRef.value.scrollHeight; } });

    // ★★★ [말풍선 기능 추가] ★★★
    const currentUid = auth.currentUser.uid;
    
    if (msg.userId === currentUid) {
      // 내 메시지인 경우
      showChatBubble(myAvatar, msg.message);
    } else if (otherPlayers[msg.userId] && otherPlayers[msg.userId].mesh) {
      // 다른 플레이어의 메시지인 경우
      showChatBubble(otherPlayers[msg.userId].mesh, msg.message);
    }
    // ★★★ [말풍선 기능 끝] ★★★
  });
};

// Plaza 입장: RTDB에 내 정보 등록 및 연결 해제 시 자동 삭제 설정
const joinPlaza = async () => {
  if (!auth.currentUser || !myAvatar) { // 사용자 로그인 및 아바타 로드 확인
      console.error("Plaza에 참여할 수 없습니다: 로그인되지 않았거나 아바타가 로드되지 않았습니다.");
      return;
  }
  const currentUid = auth.currentUser.uid; // 현재 사용자 UID
  playerRef = dbRef(rtdb, `${plazaPlayersPath}/${currentUid}`); // 내 플레이어 데이터 경로 참조

  // RTDB에 저장할 플레이어 데이터 객체 생성
  const playerData = {
    avatarUrl: myAvatarUrl,
    userName: myUserName,
    position: { x: myAvatar.position.x, y: myAvatar.position.y, z: myAvatar.position.z },
    rotationY: myAvatar.rotation.y,
    timestamp: serverTimestamp(), // 서버 시간 기록
  };

  try {
    await set(playerRef, playerData); // 데이터 쓰기
    await onDisconnect(playerRef).remove(); // 연결 해제 시 데이터 자동 삭제 설정
    console.log('Plaza 입장에 성공했습니다.');
    isReady.value = true; // 이동 및 채팅 활성화 상태로 변경
  } catch (error) {
    console.error("Plaza 입장 실패:", error);
    isLoading.value = true; // 실패 시 로딩 상태 유지
    loadingMessage.value = "입장에 실패했습니다.";
  }
};

// 내 상태 (위치, 회전) RTDB에 업데이트
// 내 상태 (위치, 회전) RTDB에 업데이트
const updateMyStateInRTDB = () => {
  if (!playerRef || !myAvatar || !isReady.value) return; // 유효성 검사

  // ▼▼▼ [핵심 수정] ▼▼▼
  // NaN, Infinity 등이 Firebase로 전송되는 것을 막기 위해
  // 모든 값을 전송 전에 확인합니다.
  const { x, y, z } = myAvatar.position;
  const currentRotationY = myAvatar.rotation.y;

  const newState = {
    position: {
      x: isFiniteNumber(x) ? x : 0,
      y: isFiniteNumber(y) ? y : 0,
      z: isFiniteNumber(z) ? z : 0,
    },
    // rotationY는 이미 방어 코드가 있었지만, 헬퍼 함수로 통일합니다.
    rotationY: isFiniteNumber(currentRotationY) ? currentRotationY : 0,
    timestamp: serverTimestamp(),
  };
  // ▲▲▲ [핵심 수정] ▲▲▲

  // [기존 코드] set 대신 update를 사용하여 newState 객체만 전송합니다.
  update(playerRef, newState) // <--- 이 update가 더 이상 실패하지 않습니다.
    .catch((error) => {
      // (이하 동일)
      if (isReady.value) {
        console.error("!!! RTDB UPDATE FAILED (DB 규칙 확인 필요) !!!", error.message);
        isReady.value = false; // 에러 반복 방지를 위해 이동 및 업데이트 중지
        
        isLoading.value = true;
        loadingMessage.value = `실시간 연결 끊김: ${error.message}`;
      }
    });
};

// RTDB 업데이트 Throttling (과도한 쓰기 방지)
let lastUpdateTime = 0; // 마지막 업데이트 시간 기록
const updateInterval = 100; // 업데이트 간격 (밀리초)

const throttledUpdate = () => {
  const now = Date.now();
  if (now - lastUpdateTime > updateInterval) { // 설정된 간격보다 오래되었을 때만 실행
    updateMyStateInRTDB();
    lastUpdateTime = now; // 마지막 업데이트 시간 갱신
  }
};

// 다른 플레이어들의 입장/상태변경/퇴장 실시간 감지
const listenToOtherPlayers = () => {
  playersListenerRef = dbRef(rtdb, plazaPlayersPath);
  const currentUid = auth.currentUser.uid;

  onChildAdded(playersListenerRef, async (snapshot) => {
    const userId = snapshot.key;
    if (userId === currentUid || otherPlayers[userId]) return;

    const playerData = snapshot.val();
    console.log(`플레이어 입장 감지: ${playerData.userName || userId}`);

    // 플레이어 객체 즉시 생성 (mesh, mixer, actions는 null)
    otherPlayers[userId] = {
      mesh: null,
      mixer: null, // [애니메이션 추가] 믹서 추가
      actions: {}, // [애니메이션 추가] 액션 객체 추가
      targetPosition: new THREE.Vector3(playerData.position.x, playerData.position.y, playerData.position.z),
      targetRotationY: playerData.rotationY,
      userName: playerData.userName || '익명',
      isMoving: false // [애니메이션 추가] 이동 상태 플래그
    };

    try {
      // 아바타 로드 (애니메이션 정보 포함된 model 반환)
      const loadedModel = await loadAvatar(playerData.avatarUrl);
      console.log(`${playerData.userName || userId} 아바타 로드 완료 (애니메이션 포함)`);

      if (scene && otherPlayers[userId]) {
          loadedModel.position.set(playerData.position.x, playerData.position.y, playerData.position.z);
          loadedModel.rotation.y = playerData.rotationY;

          if (otherPlayers[userId].userName !== '익명') {
              const otherNickname = createNicknameSprite(otherPlayers[userId].userName);
              loadedModel.add(otherNickname);
              console.log(`${playerData.userName || userId} 닉네임 추가 완료`);
          }
          scene.add(loadedModel);

          // [애니메이션 추가] 로드된 메쉬, 믹서, 액션 할당
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

  // 플레이어 상태 변경 감지 (onChildChanged)
onChildChanged(playersListenerRef, (snapshot) => {
    const userId = snapshot.key;
    if (userId === currentUid || !otherPlayers[userId]) return; // 본인 또는 없는 플레이어 무시

    const playerData = snapshot.val();
    const player = otherPlayers[userId];

    // [★수정] 1. 데이터에 position 객체가 없으면(null) 에러 방지를 위해 즉시 종료
    if (!playerData || !playerData.position) {
        console.warn(`[onChildChanged] ${userId}의 playerData 또는 position이 null입니다.`, playerData);
        return;
    }

    // [★수정] 2. rotationY 값이 유효한 숫자인지 확인합니다 (NaN, undefined 방지)
    const newRotationY = playerData.rotationY;
    if (typeof newRotationY === 'number' && isFinite(newRotationY)) {
        player.targetRotationY = newRotationY; // 유효한 경우에만 갱신
    } else {
        console.warn(`[onChildChanged] ${userId}의 rotationY가 유효하지 않습니다.`, playerData);
        // rotationY가 유효하지 않아도 position은 업데이트해야 하므로 return하지 않습니다.
        // 대신 targetRotationY를 갱신하지 않습니다.
    }

    // [★수정] 3. position은 항상 업데이트합니다 (위에서 null 체크 완료)
    player.targetPosition.set(playerData.position.x, playerData.position.y, playerData.position.z);
    
  });

  // 플레이어 퇴장 감지 (onChildRemoved)
  onChildRemoved(playersListenerRef, (snapshot) => {
    const userId = snapshot.key;
    if (userId === currentUid || !otherPlayers[userId]) return; // 본인 또는 없는 플레이어 무시

    const playerToRemove = otherPlayers[userId];

    // ★★★ [말풍선 리소스 정리 추가] ★★★
    // 퇴장하는 플레이어에게 활성 말풍선이 있다면 타이머를 취소하고 리소스를 해제합니다.
    if (playerToRemove.mesh && playerToRemove.mesh.activeBubble) {
      clearTimeout(playerToRemove.mesh.activeBubble.timeoutId);
      // 씬에서 아바타(부모)가 제거될 것이므로 말풍선을 remove할 필요는 없지만,
      // dispose는 메모리 누수 방지를 위해 필수입니다.
      playerToRemove.mesh.activeBubble.material.map.dispose();
      playerToRemove.mesh.activeBubble.material.dispose();
      console.log(`${userId}의 말풍선 리소스 제거`);
    }
    // ★★★ [말풍선 정리 끝] ★★★

if (scene) { scene.remove(playerToRemove.mesh); } // 씬에서 아바타 제거

    // Three.js 리소스 정리
    playerToRemove.mesh.traverse(child => {
       // ★★★ [권장 수정] 여기도 리소스 정리 코드를 채워주세요 ★★★
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
       // [닉네임] 스프라이트인 경우 리소스 해제
       else if (child instanceof THREE.Sprite) {
           if (child.material.map) child.material.map.dispose(); // 텍스처(캔버스) 해제
           child.material.dispose(); // 재질 해제
           // (참고: 이 로직이 닉네임과 말풍선 모두를 처리합니다)
       }
    });

    delete otherPlayers[userId]; // otherPlayers 목록에서 제거
    console.log(`플레이어 ${userId} 퇴장`);
  });

};
// --- 채팅 함수 ---
// 메시지 전송
const sendMessage = () => {
  if (!chatInput.value.trim() || !isReady.value || !auth.currentUser) return;
  const chatMessage = { userId: auth.currentUser.uid, userName: myUserName || '익명', message: chatInput.value.trim(), timestamp: serverTimestamp() };
  push(dbRef(rtdb, plazaChatPath), chatMessage);
  chatInput.value = '';
  
  // [★추가] 메시지 전송 후 채팅창 포커스 해제
  if (chatInputRef.value) {
    chatInputRef.value.blur();
  }
};

// --- Three.js 초기화 함수 ---
const initThree = () => {
  try {
      scene = new THREE.Scene(); // 씬 생성

      // ▼▼▼ [복구] 배경 이미지 로더 추가 ▼▼▼
      const textureLoader = new THREE.TextureLoader();
      textureLoader.load(
        '/my_background.jpg', // public 폴더에 넣은 이미지 경로 확인
        (texture) => {
          texture.mapping = THREE.EquirectangularReflectionMapping;
          scene.background = texture; // 씬의 배경으로 설정
          scene.environment = texture; // 씬의 환경맵으로 설정
          console.log("배경 이미지 로드 완료");
        },
        undefined,
        (err) => {
          console.error('배경 이미지 로드 실패:', err);
          scene.background = new THREE.Color(0xade6ff); // 실패 시 파란색 배경
        }
      );
      // ▲▲▲ [복구] 배경 이미지 로더 추가 끝 ▲▲▲

      scene.fog = new THREE.Fog(0xaaaaaa, 10, 30); // 안개 (색상 확인)

      // 카메라 생성 (이전과 동일)
      camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      camera.position.set(0, 1.6, 4);

      // 렌더러 생성
      if (!canvasRef.value) { console.error("캔버스 요소를 찾을 수 없습니다!"); return false; }
      renderer = new THREE.WebGLRenderer({ canvas: canvasRef.value, antialias: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      
      // ▼▼▼ [렉 진단] 임시로 그림자 비활성화 ▼▼▼
      // renderer.shadowMap.enabled = true; // 그림자 활성화
      // renderer.shadowMap.type = THREE.PCFSoftShadowMap; // 부드러운 그림자
      renderer.shadowMap.enabled = false; // <<< 테스트를 위해 비활성화
      // ▲▲▲ [렉 진단] ▲▲▲

      // 조명 설정
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); scene.add(ambientLight);
      const dirLight = new THREE.DirectionalLight(0xffffff, 1.0); dirLight.position.set(5, 15, 10);
      
      // ▼▼▼ [렉 진단] 임시로 그림자 비활성화 ▼▼▼
      // dirLight.castShadow = true;
      // dirLight.shadow.mapSize.width = 1024; dirLight.shadow.mapSize.height = 1024;
      // dirLight.shadow.camera.near = 0.5; dirLight.shadow.camera.far = 50;
      // dirLight.shadow.camera.left = -15; dirLight.shadow.camera.right = 15;
      // dirLight.shadow.camera.top = 15; dirLight.shadow.camera.bottom = -15;
      dirLight.castShadow = false; // <<< 테스트를 위해 비활성화
      // ▲▲▲ [렉 진단] ▲▲▲

      scene.add(dirLight);
      const hemiLight = new THREE.HemisphereLight(0xade6ff, 0x99cc99, 0.5); scene.add(hemiLight);

      // 바닥 생성
      const groundGeometry = new THREE.PlaneGeometry(30, 30); const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x88bb88, side: THREE.DoubleSide }); const ground = new THREE.Mesh(groundGeometry, groundMaterial); ground.rotation.x = -Math.PI / 2;
      
      // ▼▼▼ [렉 진단] 임시로 그림자 비활성화 ▼▼▼
      // ground.receiveShadow = true; // 바닥이 그림자를 받음
      ground.receiveShadow = false; // <<< 테스트를 위해 비활성화
      // ▲▲▲ [렉 진단] ▲▲▲

      scene.add(ground);
      const gridHelper = new THREE.GridHelper(30, 30, 0xcccccc, 0xcccccc); scene.add(gridHelper);

      // ▼▼▼ 자동차 모델 로드 (스케일 80으로 수정) ▼▼▼
      loader.load(
        '/models/2006_subaru_impreza_wrx_sti.glb',
        (gltf) => {
          const car = gltf.scene;
          car.position.set(2, 0, -3);
          // ★★★ 스케일을 80배로 크게 변경 ★★★
          car.scale.set(80, 80, 80);
          car.rotation.y = -Math.PI / 4;

          car.traverse((child) => {
            if (child.isMesh) {
              // ▼▼▼ [렉 진단] 그림자가 비활성화되었으므로 이 코드도 임시 주석 처리 ▼▼▼
              // child.castShadow = true;
              // child.receiveShadow = true;
              // ▲▲▲ [렉 진단] ▲▲▲
            }
          });
          scene.add(car);
          console.log('자동차 모델 로드 완료 (스케일 80 적용)');
        },
        undefined, (error) => { console.error('자동차 모델 로드 실패:', error); }
      );
      // ▲▲▲ 자동차 모델 로드 끝 ▲▲▲

      clock = new THREE.Clock();
      return true;
  } catch (error) {
      console.error("Three.js 초기화 중 오류 발생:", error);
      return false;
  }
};

// --- 플레이어 이동 로직 ---
// 키보드 이벤트 핸들러
const handleKeyDown = (event) => {
    if (chatInputRef.value === document.activeElement) return; // 채팅 중이면 무시
    
    const code = event.code;
    keysPressed[code] = true;
    // ▲▲▲ [핵심 수정] ▲▲▲

    // 화살표 키 입력 시 기본 스크롤 동작 방지
    // [수정] 'Key'가 포함된 코드로 변경
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) {
        event.preventDefault();
    }
};

const handleKeyUp = (event) => {
    // ▼▼▼ [핵심 수정] event.key.toLowerCase() -> event.code ▼▼▼
    keysPressed[event.code] = false;
    // ▲▲▲ [핵심 수정] ▲▲▲
};

// 조이스틱 이벤트 핸들러
const handleJoystickMove = (evt, data) => { 
    joystickData.value = { active: true, angle: data.angle.radian, distance: data.distance, force: data.force }; 
};
const handleJoystickEnd = () => { joystickData.value = { active: false, angle: 0, distance: 0, force: 0 }; };

// 매 프레임 호출: 내 아바타 위치/회전 업데이트 (로컬 Z축 이동으로 복귀)
const updatePlayerMovement = (deltaTime) => {
  if (!myAvatar || !isReady.value) return;

  let moved = false;
  let rotationAmount = 0;
  let applyRotation = false;
  let applyMovement = false;
  let moveDirectionZ_Keyboard = 0; // [★수정] 키보드용 Z이동 변수
  let targetRotationY = myAvatar.rotation.y;

  // --- 조이스틱 입력 처리 ---
  if (joystickData.value.active) {
    // 조이스틱은 회전과 이동을 동시에 적용
    targetRotationY = -joystickData.value.angle + Math.PI / 2; // 아바타가 바라볼 방향
    applyRotation = true;
    applyMovement = joystickData.value.distance > 10;
    
    // [★제거] moveDirectionZ = -1; 
    // [★제거] currentSpeedFactor (이동 로직에서 직접 계산)
  }
  // --- 키보드 입력 처리 ---
  else {
    // 키보드는 회전과 이동을 별개로 적용 (탱크 컨트롤)
    if (keysPressed['KeyA'] || keysPressed['ArrowLeft']) { rotationAmount = rotateSpeed * deltaTime; applyRotation = true; }
    if (keysPressed['KeyD'] || keysPressed['ArrowRight']) { rotationAmount = -rotateSpeed * deltaTime; applyRotation = true; }
    
    if (keysPressed['KeyW'] || keysPressed['ArrowUp']) { moveDirectionZ_Keyboard = -1; applyMovement = true; } // 로컬 '앞'
    if (keysPressed['KeyS'] || keysPressed['ArrowDown']) { moveDirectionZ_Keyboard = 1; applyMovement = true; } // 로컬 '뒤'
  }

  // --- 회전 적용 ---
  if (applyRotation) {
    if (joystickData.value.active) {
        // 조이스틱: 목표 방향으로 부드럽게 회전 (Lerp)
        let currentY = myAvatar.rotation.y; const PI2 = Math.PI * 2;
        currentY = (currentY % PI2 + PI2) % PI2; targetRotationY = (targetRotationY % PI2 + PI2) % PI2;
        let diff = targetRotationY - currentY; if (Math.abs(diff) > Math.PI) { diff = diff > 0 ? diff - PI2 : diff + PI2; }
        const rotationChange = diff * deltaTime * 8; // 부드러운 회전
        myAvatar.rotation.y += rotationChange;
        if (Math.abs(rotationChange) > 0.001) moved = true;
    } else {
        // 키보드: 즉시 회전
        myAvatar.rotation.y += rotationAmount;
        if (Math.abs(rotationAmount) > 0.001) moved = true;
    }
  }

  // --- 이동 적용 (★ 키보드/조이스틱 로직 분리) ---
  if (applyMovement) {
    
if (joystickData.value.active) {
        // [★새 로직] 조이스틱: 월드 좌표계 기준으로 즉시 이동
        // 조이스틱의 각도와 힘(force)을 사용
        
        // [기존 코드] (679 라인)
        // const moveAngle = joystickData.value.angle.radian;
        
        // [수정 코드] (679 라인)
        const moveAngle = joystickData.value.angle; // .radian 제거

        const currentSpeedFactor = joystickData.value.force;
        const moveAmount = moveSpeed * currentSpeedFactor * deltaTime;

        // 월드 벡터 계산 (X: cos, Z: -sin)
        // nipplejs의 0도는 '오른쪽'(+X), 90도는 '위'(-Z)
        const velocity = new THREE.Vector3(
            Math.cos(moveAngle) * moveAmount,
            0,
            -Math.sin(moveAngle) * moveAmount
        );
        
        // 쿼터니언(아바타 방향)을 적용하지 *않고* 월드 좌표에 바로 더함
        myAvatar.position.add(velocity); 
        
        if (Math.abs(moveAmount) > 0.001) moved = true;

    } else {
        // [★기존 로직] 키보드: 로컬 좌표계(탱크 컨트롤)로 이동
        // (키보드는 W/S만 있으므로 currentSpeedFactor가 1.0으로 고정됨)
        const moveAmount = moveDirectionZ_Keyboard * moveSpeed * deltaTime;
        
        const velocity = new THREE.Vector3(0, 0, moveAmount);
        velocity.applyQuaternion(myAvatar.quaternion); // 쿼터니언 적용 (O)
        myAvatar.position.add(velocity);
        
        if (Math.abs(moveAmount) > 0.001) moved = true;
    }
  }

  // --- 경계 처리 --- (이하 동일)
const boundary = 14.5;
  myAvatar.position.x = Math.max(-boundary, Math.min(boundary, myAvatar.position.x));
  myAvatar.position.z = Math.max(-boundary, Math.min(boundary, myAvatar.position.z));
  myAvatar.position.y = 0;

  if (moved) { throttledUpdate(); }

  // --- [애니메이션 추가] 이동 상태에 따라 애니메이션 전환 ---
  const mixer = myAvatar.userData.mixer;
  const actions = myAvatar.userData.actions;
  const idleAction = actions.idle;
  const walkAction = actions.walk;

  if (mixer && idleAction && walkAction) {
    if (moved) {
      // 걷는 중: Walk 재생, Idle 페이드 아웃
      if (!walkAction.isRunning()) {
        walkAction.reset().play();
        idleAction.crossFadeTo(walkAction, 0.3); // 0.3초 동안 부드럽게 전환
        console.log("Start Walking Animation"); // 디버깅 로그
      }
    } else {
      // 멈춤: Idle 재생, Walk 페이드 아웃
      if (!idleAction.isRunning()) {
        idleAction.reset().play();
        walkAction.crossFadeTo(idleAction, 0.3);
        console.log("Start Idle Animation"); // 디버깅 로그
      }
    }
  } else if (mixer && idleAction && !walkAction) {
    // Walk 애니메이션이 없을 경우 Idle만 계속 재생
    if (!idleAction.isRunning()) idleAction.reset().play();
  }
  // --- [애니메이션 추가 끝] ---
};

// --- 다른 플레이어 부드러운 이동 처리 ---
const updateOtherPlayersMovement = (deltaTime) => {
  const lerpFactor = deltaTime * 8;
  const moveThreshold = 0.01; // 이동으로 간주할 최소 거리

  for (const userId in otherPlayers) {
    const player = otherPlayers[userId];
    if (!player.mesh) continue;

    const mesh = player.mesh;

    // 현재 위치와 목표 위치 사이 거리 계산
    const distance = mesh.position.distanceTo(player.targetPosition);
    const wasMoving = player.isMoving; // 이전 프레임 이동 상태
    player.isMoving = distance > moveThreshold; // 현재 이동 상태 업데이트

    // 위치 보간
    mesh.position.lerp(player.targetPosition, lerpFactor);

    // 회전 보간 (이전과 동일)
    let currentY = mesh.rotation.y; let targetY = player.targetRotationY; const PI2 = Math.PI * 2;
    currentY = (currentY % PI2 + PI2) % PI2; targetY = (targetY % PI2 + PI2) % PI2;
    let diff = targetY - currentY; if (Math.abs(diff) > Math.PI) { diff = diff > 0 ? diff - PI2 : diff + PI2; }
    mesh.rotation.y += diff * lerpFactor;
    mesh.rotation.x = 0; mesh.rotation.z = 0;

    // --- [애니메이션 추가] 다른 플레이어 애니메이션 제어 ---
    const mixer = player.mixer;
    const actions = player.actions;
    const idleAction = actions.idle;
    const walkAction = actions.walk;

    if (mixer && idleAction && walkAction) {
      if (player.isMoving && !wasMoving) { // 멈춤 -> 이동 시작
        walkAction.reset().play();
        idleAction.crossFadeTo(walkAction, 0.3);
      } else if (!player.isMoving && wasMoving) { // 이동 -> 멈춤
        idleAction.reset().play();
        walkAction.crossFadeTo(idleAction, 0.3);
      }
    } else if (mixer && idleAction && !walkAction) {
       if (!idleAction.isRunning()) idleAction.reset().play();
    }
    // --- [애니메이션 추가 끝] ---
  }
};

// --- 애니메이션 루프 ---
const animate = () => {
  if (!renderer || !scene || !camera || !clock) return;
  requestAnimationFrame(animate);

  const deltaTime = clock.getDelta();

  // --- [애니메이션 추가] 믹서 업데이트 ---
  // 내 아바타 믹서 업데이트
  if (myAvatar && myAvatar.userData.mixer) {
    myAvatar.userData.mixer.update(deltaTime);
  }
  // 다른 플레이어 믹서 업데이트
  for (const userId in otherPlayers) {
    const player = otherPlayers[userId];
    if (player.mixer) {
      player.mixer.update(deltaTime);
    }
  }
  // --- [애니메이션 추가 끝] ---

  updatePlayerMovement(deltaTime);
  updateOtherPlayersMovement(deltaTime);

  // 카메라 추적 로직 수정 (울렁거림 개선)
  if (myAvatar) {
      const desiredOffset = new THREE.Vector3(0, 3.0, 5.0); // 오프셋 (높이 3.0, 뒤로 5.0)
      const lerpFactor = deltaTime * 5.0; // 카메라 이동 부드러움 정도

      // ▼▼▼ [핵심 수정] 아바타 Y 위치를 0으로 간주하고 카메라 목표 위치 계산 ▼▼▼
      const avatarPositionOnGround = myAvatar.position.clone();
      avatarPositionOnGround.y = 0; // 아바타가 항상 지면에 있다고 가정

      const cameraOffset = desiredOffset.clone().applyQuaternion(myAvatar.quaternion);
      // 목표 위치 계산 시 avatarPositionOnGround 사용
      const targetPosition = avatarPositionOnGround.clone().add(cameraOffset);
      // ▲▲▲ [핵심 수정] ▲▲▲

      camera.position.lerp(targetPosition, lerpFactor); // 카메라 위치 보간

      // ▼▼▼ [핵심 수정] 아바타 Y 위치를 0으로 간주하고 카메라가 바라볼 지점 계산 ▼▼▼
      // 목표 지점 계산 시 avatarPositionOnGround 사용
      const targetLookAt = avatarPositionOnGround.clone().add(new THREE.Vector3(0, 1.0, 0));
      // ▲▲▲ [핵심 수정] ▲▲▲
      
      cameraLookAtTarget.lerp(targetLookAt, lerpFactor); // 바라볼 지점 보간
      camera.lookAt(cameraLookAtTarget);
  }

  renderer.render(scene, camera);
};

// --- 창 크기 조절 처리 ---
const handleResize = () => {
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight; // 종횡비 업데이트
    camera.updateProjectionMatrix(); // 투영 행렬 업데이트
    renderer.setSize(window.innerWidth, window.innerHeight); // 렌더러 크기 업데이트
};

// --- 컴포넌트 라이프사이클 훅 ---
onMounted(async () => {
  console.log('--- DEPLOY TEST VERSION 14 --- THIS IS THE NEWEST CODE ---');

  // 로그인 확인
  if (!auth.currentUser) {
    console.error("로그인되지 않음.");
    loadingMessage.value = "로그인이 필요합니다.";
    isLoading.value = false; // 로딩 상태 해제
    return;
  }
  const currentUid = auth.currentUser.uid;

  // 1. Three.js 초기화
  const initSuccess = initThree(); // 초기화 함수 호출 및 성공 여부 확인
  if (!initSuccess) { // initThree 내부에서 캔버스 못 찾으면 false 반환
      loadingMessage.value = "3D 환경 초기화 실패.";
      isLoading.value = false; // 로딩 상태 해제
      return;
  }

  // ★★★ [신규] 애니메이션 파일 미리 로드 ★★★
  loadingMessage.value = '애니메이션 로딩 중...';
  const preloadedAnimations = await loadAnimations(); // 비동기 로드 기다림
  if (!preloadedAnimations.idle || !preloadedAnimations.walk) {
    loadingMessage.value = '기본 애니메이션 로드 실패. 애니메이션 없이 진행합니다.';
    // 애니메이션 로드 실패 시 경고만 하고 계속 진행할 수 있음 (선택)
    // isLoading.value = false; // 또는 여기서 로딩 중단
    // return;
  }
  // ★★★ [신규] ★★★

  // 2. 이벤트 리스너 등록 및 애니메이션 시작
  window.addEventListener('resize', handleResize);
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  animate(); // 애니메이션 루프 시작

  // 3. Firestore에서 사용자 정보 가져오기
  loadingMessage.value = '내 정보 로딩 중...';
  try {
      const userDoc = await getDoc(doc(db, 'users', currentUid));
      if (userDoc.exists()) {
          myAvatarUrl = userDoc.data().avatarUrl || ''; // 아바타 URL 가져오기
          myUserName = userDoc.data().name || '익명'; // 사용자 이름 가져오기
      } else {
          console.error("Firestore 사용자 문서 없음!");
          myUserName = '익명'; // 문서 없으면 기본 이름 사용
      }
  } catch (error) {
      console.error("Firestore 정보 가져오기 실패:", error);
      loadingMessage.value = '내 정보 로딩 실패.';
      isLoading.value = false; // 로딩 상태 해제
      return;
  }

  // 4. 내 아바타 로드 및 닉네임 추가
  loadingMessage.value = '내 아바타 로딩 중...';
  try {
    // ★★★ loadAvatar 호출 시 preloadedAnimations 전달 ★★★
    const loadedModel = await loadAvatar(myAvatarUrl, preloadedAnimations);

    myAvatar = loadedModel; // 로드된 모델 할당
    myAvatar.position.set(0, 0, 0); // 초기 위치 설정
    myAvatar.rotation.set(0, 0, 0); // 초기 회전 설정

    // 사용자 이름이 있으면 닉네임 스프라이트 추가
    if (myUserName && myUserName !== '익명') {
        const myNickname = createNicknameSprite(myUserName);
        myNickname.matrixAutoUpdate = true; // 닉네임도 자동 업데이트 활성화
        myAvatar.add(myNickname); // 아바타 객체에 닉네임 추가
    }

    scene.add(myAvatar); // 씬에 내 아바타 추가

    console.log('[DEBUG] myAvatar added to scene, position:', myAvatar.position);
    console.log('[DEBUG] myAvatar.children.length:', myAvatar.children.length);

  } catch (error) { // 아바타 로드 실패 시 처리
    console.error("내 아바타 로드 중 에러 발생:", error);
    loadingMessage.value = '아바타 로딩 실패. 기본 아바타로 시작합니다.';

    if (!myAvatar) { // myAvatar 객체가 아직 없으면 기본 그룹 생성
        myAvatar = new THREE.Group();
        myAvatar.matrixAutoUpdate = true;
    }

    try { // 기본 아바타 로드 시도
      // ★★★ 기본 아바타 로드 시에도 preloadedAnimations 전달 ★★★
      const fallbackModel = await loadAvatar(null, preloadedAnimations); // null URL로 기본 큐브 로드
      myAvatar = fallbackModel; // 기본 아바타 모델 할당
      scene.add(myAvatar); // 씬에 기본 아바타 추가
    } catch (e) { // 기본 아바타 로드조차 실패한 경우
        console.error("기본 아바타 로드조차 실패.", e);
        isLoading.value = false; // 로딩 상태 해제
        return; // 진행 중단
    }
  }

  // 5. 조이스틱 초기화 (nextTick 사용)
  await nextTick(); // DOM 요소가 렌더링될 때까지 기다림
  const joystickZone = document.getElementById('joystick-zone');
  if (joystickZone) { // 조이스틱 영역 요소가 있는지 확인
    try {
        joystickManager = nipplejs.create({ // nipplejs 인스턴스 생성 및 설정
          zone: joystickZone,
          mode: 'static', // 조이스틱 모드 (static, dynamic, semi)
          position: { right: '80px', bottom: '80px' }, // 화면 오른쪽 아래 위치
          color: 'rgba(255, 255, 255, 0.5)', // 반투명 흰색
          size: 100 // 조이스틱 크기
        });
        // 조이스틱 이벤트 리스너 등록
        joystickManager.on('move', handleJoystickMove); // 움직일 때
        joystickManager.on('end', handleJoystickEnd);   // 놓았을 때
        console.log("조이스틱 생성 완료"); // 생성 확인 로그
    } catch (e) {
        console.error("조이스틱 생성 실패:", e); // 생성 실패 시 에러 로그
    }
  } else {
    console.warn("조이스틱 영역('#joystick-zone')을 찾을 수 없습니다."); // 요소 없으면 경고 로그
  }

  // 6. RTDB 연결 및 리스너 시작
  loadingMessage.value = '다른 플레이어 접속 중...';
  await joinPlaza(); // Plaza 입장 시도 (RTDB에 내 정보 등록)
  if(isReady.value){ // joinPlaza 성공 시 isReady가 true가 됨
    // ★★★ listenToOtherPlayers 호출 시 preloadedAnimations 전달 ★★★
    listenToOtherPlayers(preloadedAnimations); // 다른 플레이어 리스너 시작 (애니메이션 객체 전달)
    listenToChat(); // 채팅 리스너 시작
  }
  else { // joinPlaza 실패 시
    loadingMessage.value = 'Plaza 연결 실패.'; // 실패 메시지 표시
    return; // 진행 중단
  }
  isLoading.value = false; // 모든 로딩 및 초기화 완료
});

onUnmounted(() => {
  // 이벤트 리스너 제거
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('keyup', handleKeyUp);

  // RTDB 리스너 제거
  if (playersListenerRef) off(playersListenerRef);
  if (chatListenerRef) off(chatListenerRef);

  // RTDB 내 정보 제거
  if (playerRef) remove(playerRef);

  // 조이스틱 제거
  if (joystickManager) {
    joystickManager.off('move', handleJoystickMove);
    joystickManager.off('end', handleJoystickEnd);
    joystickManager.destroy();
    joystickManager = null;
  }

  // ★★★ [말풍선 리소스 정리 추가] ★★★
  // 내 아바타의 활성 말풍선 리소스 정리
  if (myAvatar && myAvatar.activeBubble) {
    clearTimeout(myAvatar.activeBubble.timeoutId);
    myAvatar.activeBubble.material.map.dispose();
    myAvatar.activeBubble.material.dispose();
  }
  // ★★★ [말풍선 정리 끝] ★★★

  // Three.js 리소스 정리
if (renderer) { renderer.dispose(); renderer = null; }
  if (scene) {
     scene.traverse(object => {
       // ★★★ [수정] 리소스 정리 코드를 추가하여 'object' 변수를 사용합니다 ★★★
       if (object.isMesh) {
         // 지오메트리(Geometry) 해제
         if (object.geometry) {
           object.geometry.dispose();
         }
         // 재질(Material)이 배열일 경우 (예: MultiMaterial)
         if (Array.isArray(object.material)) {
           object.material.forEach(material => {
             if (material.map) material.map.dispose(); // 텍스처
             material.dispose(); // 재질
           });
         } 
         // 재질이 단일 객체일 경우
         else if (object.material) {
           if (object.material.map) object.material.map.dispose(); // 텍스처
           object.material.dispose(); // 재질
         }
       }
       // 스프라이트 (닉네임, 말풍선) 정리
       else if (object instanceof THREE.Sprite) {
         if (object.material.map) object.material.map.dispose();
         object.material.dispose();
       }
     });
    scene = null; // 씬 참조 제거
  }
  // 다른 참조들도 제거
  camera = null; clock = null; myAvatar = null;
  otherPlayers = {}; 
});

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
  max-height: 20%; /* ★★★ 수정: 40% -> 20% ★★★ */
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