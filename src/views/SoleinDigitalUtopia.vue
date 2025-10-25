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

// eslint-disable-next-line no-unused-vars
import nipplejs from 'nipplejs'; // ESLint 'no-unused-vars' 규칙 비활성화

// --- 상태 변수 ---
const canvasRef = ref(null); // 캔버스 DOM 참조
const isLoading = ref(true); // 로딩 상태 플래그
const loadingMessage = ref('유토피아 입장 준비 중...'); // 로딩 메시지
const isReady = ref(false); // 로딩 완료 및 상호작용 가능 여부 플래그

// --- 아바타 관련 ---
let myAvatar = null; // 내 아바타 Three.js Object3D 객체
const otherPlayers = reactive({}); // 다른 플레이어 정보 { userId: { mesh, targetPosition, targetRotationY } }
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

// --- 헬퍼 함수: 아바타 로드 ---
const loadAvatar = (url) => {
  return new Promise((resolve) => { // 사용되지 않는 'reject' 제거
    if (!url || !url.endsWith('.glb')) { // URL 유효성 및 .glb 확장자 확인
      console.warn("아바타 URL이 유효하지 않거나 GLB 파일이 아닙니다. 기본 큐브를 사용합니다.", url);
      // 기본 아바타 (녹색 큐브) 생성
      const geometry = new THREE.BoxGeometry(0.5, 1, 0.5);
      const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
      const cube = new THREE.Mesh(geometry, material);
      cube.position.y = 0.5; // 바닥 위에 위치하도록 Y 좌표 조정
      resolve(cube); // 생성된 큐브 객체로 Promise 완료
      return;
    }
    // GLTFLoader를 사용하여 모델 로드
    loader.load(url,
      (gltf) => { // 로드 성공 시 콜백
        const model = gltf.scene.clone(); // 참조 문제를 피하기 위해 로드된 씬 복제
        model.scale.set(0.7, 0.7, 0.7); // 모델 크기 조절
        model.position.y = 0; // 모델을 바닥에 맞춤 (Y=0)
        // 모델 내부의 모든 메시에 그림자 설정 적용
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true; // 그림자를 생성하도록 설정
            child.receiveShadow = false; // 그림자를 받지는 않도록 설정 (바닥만 받음)
          }
        });
        resolve(model); // 복제된 모델 객체로 Promise 완료
      },
      undefined, // 진행 상태 콜백 (현재 사용 안 함)
      (error) => { // 로드 실패 시 콜백
        console.error('아바타 로딩 실패:', error, 'URL:', url);
        // 로딩 실패 시 빨간색 큐브 생성
        const geometry = new THREE.BoxGeometry(0.5, 1, 0.5);
        const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
        const cube = new THREE.Mesh(geometry, material);
        cube.position.y = 0.5;
        resolve(cube); // 실패 시에도 기본 큐브로 Promise 완료 (앱 중단 방지)
      }
    );
  });
};

// --- 헬퍼 함수: 닉네임 스프라이트 생성 ---
const createNicknameSprite = (text) => {
  const canvas = document.createElement('canvas'); // 캔버스 요소 생성
  const context = canvas.getContext('2d'); // 2D 컨텍스트 가져오기
  const fontSize = 24; // 폰트 크기
  const fontWeight = 'bold'; // 폰트 굵기
  const fontFamily = 'Arial'; // 폰트 종류
  context.font = `${fontWeight} ${fontSize}px ${fontFamily}`; // 폰트 설정
  const textMetrics = context.measureText(text); // 텍스트 너비 측정
  const textWidth = textMetrics.width;

  const padding = 10; // 좌우 여백
  const verticalPadding = 5; // 상하 여백
  canvas.width = textWidth + padding * 2; // 캔버스 너비 설정
  canvas.height = fontSize + verticalPadding * 2; // 캔버스 높이 설정

  // 배경 그리기 (반투명 검정 라운드 사각형)
  context.fillStyle = 'rgba(0, 0, 0, 0.7)'; // 배경색 설정
  const radius = 8; // 모서리 둥글기 반지름
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
  const scale = 0.003; // 예시 스케일 값 (이 값을 조절하여 이름표 크기 변경)
  sprite.scale.set(canvas.width * scale, canvas.height * scale, 1.0);

  // 아바타 머리 위 위치 설정 (Y축 오프셋, 아바타 모델 크기에 따라 조절 필요)
  sprite.position.y = 2.3; // 예: 아바타 Y 크기가 약 1.7 정도일 때 적절한 높이

  return sprite; // 생성된 스프라이트 반환
};


// --- Firebase RTDB 함수 ---
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
const updateMyStateInRTDB = () => {
  if (!playerRef || !myAvatar || !isReady.value) return; // 유효성 검사

  // [★수정] 업데이트할 newState (3개 항목만)
  const newState = {
    position: { x: myAvatar.position.x, y: myAvatar.position.y, z: myAvatar.position.z },
    rotationY: myAvatar.rotation.y,
    timestamp: serverTimestamp(),
  };

  // [★수정] set 대신 update를 사용하여 newState 객체만 전송합니다.
  update(playerRef, newState) // <--- set을 update로 변경
    .catch((error) => {
      // 이 에러가 콘솔을 도배하는 것을 막기 위해 isReady를 false로 변경합니다.
      if (isReady.value) {
        console.error("!!! RTDB 상태 업데이트 실패 (Firebase 규칙 오류 가능) !!!", error.message);
        isReady.value = false; // 에러 반복 방지를 위해 이동 및 업데이트 중지
        alert("서버와의 실시간 연결이 끊겼습니다. (DB 쓰기 오류)");
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
  playersListenerRef = dbRef(rtdb, plazaPlayersPath); // 전체 플레이어 경로 참조
  const currentUid = auth.currentUser.uid; // 내 UID

  // 새 플레이어 입장 감지 (onChildAdded)
  onChildAdded(playersListenerRef, async (snapshot) => {
    const userId = snapshot.key; // 입장한 플레이어의 UID
    if (userId === currentUid || otherPlayers[userId]) return; // 본인이거나 이미 목록에 있으면 무시

    const playerData = snapshot.val(); // 입장한 플레이어 데이터
    console.log(`플레이어 입장 감지: ${playerData.userName || userId}`); // 입장 감지 로그 추가

    try {
      const avatarMesh = await loadAvatar(playerData.avatarUrl); // 아바타 모델 로드
      console.log(`${playerData.userName || userId} 아바타 로드 완료`); // 로드 완료 로그 추가

      if (scene) { // 씬이 존재하는지 확인 (컴포넌트 unmount 대비)
          scene.add(avatarMesh); // 씬에 아바타 추가
          // 초기 위치 및 회전 설정
          avatarMesh.position.set(playerData.position.x, playerData.position.y, playerData.position.z);
          avatarMesh.rotation.y = playerData.rotationY;

	  // [★디버깅 로그 1] 입장 시 위치 값을 확인합니다.
          console.log(`[onChildAdded: ${playerData.userName}] DB좌표:`, playerData.position, `적용된 좌표:`, avatarMesh.position);

          // [닉네임] 닉네임 스프라이트 생성 및 추가
          if (playerData.userName) {
              const otherNickname = createNicknameSprite(playerData.userName);
              avatarMesh.add(otherNickname); // 아바타의 자식으로 추가
              console.log(`${playerData.userName || userId} 닉네임 추가 완료`); // 닉네임 추가 로그
          }

          // otherPlayers 객체에 플레이어 정보 저장
          otherPlayers[userId] = {
            mesh: avatarMesh, // Three.js 메쉬 객체
            targetPosition: new THREE.Vector3().copy(avatarMesh.position), // 목표 위치 (보간용)
            targetRotationY: avatarMesh.rotation.y, // 목표 회전 (보간용)
          };
          console.log(`${playerData.userName || userId} 씬에 추가 완료`);
      } else {
          console.warn(`씬이 존재하지 않아 ${userId}를 추가할 수 없습니다.`);
      }
    } catch (error) {
      console.error(`${userId} 플레이어 처리 중 오류 발생:`, error);
    }
  });

  // 플레이어 상태 변경 감지 (onChildChanged)
  onChildChanged(playersListenerRef, (snapshot) => {
    const userId = snapshot.key;
    if (userId === currentUid || !otherPlayers[userId]) return; // 본인 또는 없는 플레이어 무시

    const playerData = snapshot.val();
    const player = otherPlayers[userId];

    // 목표 상태 업데이트 (애니메이션 루프에서 보간 처리)
    player.targetPosition.set(playerData.position.x, playerData.position.y, playerData.position.z);
    player.targetRotationY = playerData.rotationY;

// [★디버깅 로그 2] 이동 시 수신된 좌표를 확인합니다.
    console.log(`[onChildChanged: ${playerData.userName}] 새 DB좌표:`, playerData.position, `타겟 좌표:`, player.targetPosition);
  });

  // 플레이어 퇴장 감지 (onChildRemoved)
  onChildRemoved(playersListenerRef, (snapshot) => {
    const userId = snapshot.key;
    if (userId === currentUid || !otherPlayers[userId]) return; // 본인 또는 없는 플레이어 무시

    const playerToRemove = otherPlayers[userId];
    if (scene) { scene.remove(playerToRemove.mesh); } // 씬에서 아바타 제거

    // Three.js 리소스 정리
    playerToRemove.mesh.traverse(child => {
       if (child.isMesh) { // 메쉬인 경우
           if (child.geometry) child.geometry.dispose(); // 지오메트리 해제
           if (child.material) { // 재질 해제 (배열 또는 단일 객체)
               if (Array.isArray(child.material)) {
                   child.material.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
               } else {
                   if (child.material.map) child.material.map.dispose();
                   child.material.dispose();
               }
           }
       }
       // [닉네임] 스프라이트인 경우 리소스 해제
       else if (child instanceof THREE.Sprite) {
           if (child.material.map) child.material.map.dispose(); // 텍스처(캔버스) 해제
           child.material.dispose(); // 재질 해제
           console.log(`${userId}의 닉네임 스프라이트 제거`);
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

// 새 채팅 메시지 수신
const listenToChat = () => {
  chatListenerRef = query(dbRef(rtdb, plazaChatPath), limitToLast(MAX_CHAT_MESSAGES));
  onChildAdded(chatListenerRef, (snapshot) => {
    chatMessages.value.push({ id: snapshot.key, ...snapshot.val() });
    if (chatMessages.value.length > MAX_CHAT_MESSAGES) { chatMessages.value.shift(); }
    nextTick(() => { if (messageListRef.value) { messageListRef.value.scrollTop = messageListRef.value.scrollHeight; } });
  });
};

// --- Three.js 초기화 함수 ---
const initThree = () => {
  try {
      scene = new THREE.Scene(); // 씬 생성
      scene.background = new THREE.Color(0xade6ff); // 배경색
      scene.fog = new THREE.Fog(0xade6ff, 10, 30); // 안개

      // 카메라 생성
      camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      camera.position.set(0, 1.6, 4); // 초기 위치

      // 렌더러 생성
      if (!canvasRef.value) {
          console.error("캔버스 요소를 찾을 수 없습니다!"); return false;
      }
      renderer = new THREE.WebGLRenderer({ canvas: canvasRef.value, antialias: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.shadowMap.enabled = true; // 그림자 활성화
      renderer.shadowMap.type = THREE.PCFSoftShadowMap; // 부드러운 그림자

      // 조명 설정
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); scene.add(ambientLight); // 주변광
      const dirLight = new THREE.DirectionalLight(0xffffff, 1.0); dirLight.position.set(5, 15, 10); dirLight.castShadow = true;
      dirLight.shadow.mapSize.width = 1024; dirLight.shadow.mapSize.height = 1024; // 그림자 해상도
      dirLight.shadow.camera.near = 0.5; dirLight.shadow.camera.far = 50; // 그림자 범위
      dirLight.shadow.camera.left = -15; dirLight.shadow.camera.right = 15;
      dirLight.shadow.camera.top = 15; dirLight.shadow.camera.bottom = -15;
      scene.add(dirLight); // 직사광
      const hemiLight = new THREE.HemisphereLight(0xade6ff, 0x99cc99, 0.5); scene.add(hemiLight); // 반구광

      // 바닥 생성
      const groundGeometry = new THREE.PlaneGeometry(30, 30); const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x88bb88, side: THREE.DoubleSide }); const ground = new THREE.Mesh(groundGeometry, groundMaterial); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground); // 바닥 평면
      const gridHelper = new THREE.GridHelper(30, 30, 0xcccccc, 0xcccccc); scene.add(gridHelper); // 그리드

      clock = new THREE.Clock(); // 시계 생성
      return true; // 초기화 성공 시 true 반환
  } catch (error) {
      console.error("Three.js 초기화 중 오류 발생:", error);
      return false; // 초기화 실패 시 false 반환
  }
};

// --- 플레이어 이동 로직 ---
// 키보드 이벤트 핸들러
const handleKeyDown = (event) => {
    if (chatInputRef.value === document.activeElement) return; // 채팅 중이면 무시
    const key = event.key.toLowerCase();
    keysPressed[key] = true;
    // 화살표 키 입력 시 기본 스크롤 동작 방지
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        event.preventDefault();
    }
};
const handleKeyUp = (event) => { keysPressed[event.key.toLowerCase()] = false; };
// 조이스틱 이벤트 핸들러
const handleJoystickMove = (evt, data) => { joystickData.value = { active: true, angle: data.angle.radian, distance: data.distance, force: data.force }; };
const handleJoystickEnd = () => { joystickData.value = { active: false, angle: 0, distance: 0, force: 0 }; };

// 매 프레임 호출: 내 아바타 위치/회전 업데이트 (로컬 Z축 이동으로 복귀)
const updatePlayerMovement = (deltaTime) => {
  if (!myAvatar || !isReady.value) return; // 유효성 검사

  let moved = false;                     // 이동/회전 발생 여부 플래그
  let rotationAmount = 0;                // 이번 프레임 회전량 (키보드)
  let applyRotation = false;             // 회전 적용 여부
  let applyMovement = false;             // 이동 적용 여부
  let moveDirectionZ = 0;                // 로컬 Z축 이동 방향 (-1: 전진, 1: 후진)
  let currentSpeedFactor = 1.0;          // 속도 계수 (조이스틱 힘)
  let targetRotationY = myAvatar.rotation.y; // 목표 Y 회전 (조이스틱 Lerp용)

  // --- 조이스틱 입력 처리 ---
  if (joystickData.value.active) {
    targetRotationY = -joystickData.value.angle + Math.PI / 2; // 목표 회전값
    moveDirectionZ = -1; // 조이스틱은 항상 전방 이동
    currentSpeedFactor = joystickData.value.force; // 속도 조절
    applyRotation = true;
    applyMovement = joystickData.value.distance > 10;
  }
  // --- 키보드 입력 처리 ---
  else {
    // 회전 (A/D 또는 좌/우 화살표)
    if (keysPressed['a'] || keysPressed['arrowleft']) { rotationAmount = rotateSpeed * deltaTime; applyRotation = true; }
    if (keysPressed['d'] || keysPressed['arrowright']) { rotationAmount = -rotateSpeed * deltaTime; applyRotation = true; }
    // 이동 (W/S 또는 위/아래 화살표)
    if (keysPressed['w'] || keysPressed['arrowup']) { moveDirectionZ = -1; applyMovement = true; } // 전방(-Z) 로컬
    if (keysPressed['s'] || keysPressed['arrowdown']) { moveDirectionZ = 1; applyMovement = true; }  // 후방(+Z) 로컬
  }

  // --- 회전 적용 ---
  if (applyRotation) {
    if (joystickData.value.active) { // 조이스틱: 부드러운 Lerp 회전
        let currentY = myAvatar.rotation.y; const PI2 = Math.PI * 2;
        currentY = (currentY % PI2 + PI2) % PI2; targetRotationY = (targetRotationY % PI2 + PI2) % PI2;
        let diff = targetRotationY - currentY; if (Math.abs(diff) > Math.PI) { diff = diff > 0 ? diff - PI2 : diff + PI2; }
        const rotationChange = diff * deltaTime * 8;
        myAvatar.rotation.y += rotationChange;
        if (Math.abs(rotationChange) > 0.001) moved = true;
    } else { // 키보드: 즉시 회전 적용
        myAvatar.rotation.y += rotationAmount;
        if (Math.abs(rotationAmount) > 0.001) moved = true;
    }
  }

  // --- 이동 적용 (로컬 Z축 기준) ---
  if (applyMovement) {
    const moveAmount = moveDirectionZ * moveSpeed * currentSpeedFactor * deltaTime;
    myAvatar.translateZ(moveAmount); // 로컬 Z축으로 이동
    if (Math.abs(moveAmount) > 0.001) moved = true;
  }

  // --- 경계 처리 ---
  const boundary = 14.5; // 바닥 경계
  myAvatar.position.x = Math.max(-boundary, Math.min(boundary, myAvatar.position.x));
  myAvatar.position.z = Math.max(-boundary, Math.min(boundary, myAvatar.position.z));
  myAvatar.position.y = 0; // Y축 고정

  // --- 상태 변경 시 RTDB 업데이트 (Throttled) ---
  if (moved) { throttledUpdate(); } // 이동 또는 회전 시 업데이트 요청
};

// --- 다른 플레이어 부드러운 이동 처리 ---
const updateOtherPlayersMovement = (deltaTime) => {
  const lerpFactor = deltaTime * 8; // 보간 속도
  for (const userId in otherPlayers) {
    const player = otherPlayers[userId];
    const mesh = player.mesh;

    // 위치 보간
    mesh.position.lerp(player.targetPosition, lerpFactor);

    // 회전 보간 (Y축, 최단 각도)
    let currentY = mesh.rotation.y; let targetY = player.targetRotationY; const PI2 = Math.PI * 2;
    currentY = (currentY % PI2 + PI2) % PI2; targetY = (targetY % PI2 + PI2) % PI2;
    let diff = targetY - currentY; if (Math.abs(diff) > Math.PI) { diff = diff > 0 ? diff - PI2 : diff + PI2; }
    mesh.rotation.y += diff * lerpFactor;
    // 기울어짐 방지
    mesh.rotation.x = 0; mesh.rotation.z = 0;
  }
};

// --- 애니메이션 루프 ---
const animate = () => {
  if (!renderer || !scene || !camera || !clock) return; // 컴포넌트 unmount 대비
  requestAnimationFrame(animate);

  const deltaTime = clock.getDelta(); // 시간 간격

  updatePlayerMovement(deltaTime);     // 내 아바타 업데이트
  updateOtherPlayersMovement(deltaTime); // 다른 아바타 업데이트

// [수정] 카메라 추적 로직: 아바타를 '부드럽게(Lerp)' 따라가는 3인칭 카메라로 변경
  if (myAvatar) {
      const desiredOffset = new THREE.Vector3(0, 3.0, 5.0); // 오프셋 (높이 3.0, 뒤로 5.0)
      
      // 이 값이 클수록 카메라가 더 빠릿하게(딱딱하게) 따라오고, 작을수록 굼뜨게(부드럽게) 따라옵니다. (4.0 ~ 8.0 추천)
      const lerpFactor = deltaTime * 5.0; 

      // 1. 아바타의 회전을 적용하여 '이상적인' 카메라 위치(targetPosition) 계산
      const cameraOffset = desiredOffset.clone().applyQuaternion(myAvatar.quaternion);
      const targetPosition = myAvatar.position.clone().add(cameraOffset);

      // 2. 카메라의 현재 위치에서 '이상적인' 위치로 부드럽게 이동 (Lerp)
      //    camera.position.copy(targetPosition); // <--- '즉시' 복사 대신 lerp 사용
      camera.position.lerp(targetPosition, lerpFactor);

      // 3. 카메라가 바라볼 '이상적인' 지점 계산 (아바타 상반신)
      const targetLookAt = myAvatar.position.clone().add(new THREE.Vector3(0, 1.0, 0));
      
      // 4. (1단계에서 추가한) 전역 변수 'cameraLookAtTarget'을 '이상적인' 지점으로 부드럽게 이동 (Lerp)
      cameraLookAtTarget.lerp(targetLookAt, lerpFactor);

      // 5. 부드럽게 이동된 지점을 카메라가 바라보도록 설정
      camera.lookAt(cameraLookAtTarget);
  }

  renderer.render(scene, camera); // 렌더링
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
  // 로그인 확인
  if (!auth.currentUser) { console.error("로그인되지 않음."); loadingMessage.value = "로그인이 필요합니다."; isLoading.value = false; return; }
  const currentUid = auth.currentUser.uid;

  // 1. Three.js 초기화
  const initSuccess = initThree(); // 초기화 함수 호출 및 성공 여부 확인
  if (!initSuccess) { // initThree 내부에서 캔버스 못 찾으면 false 반환
      loadingMessage.value = "3D 환경 초기화 실패."; isLoading.value = false; return;
  }

  // 2. 이벤트 리스너 등록
  window.addEventListener('resize', handleResize);
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  animate(); // 애니메이션 시작

  // 3. Firestore에서 사용자 정보 가져오기
  loadingMessage.value = '내 정보 로딩 중...';
  try {
      const userDoc = await getDoc(doc(db, 'users', currentUid)); // db, doc, getDoc 사용 확인
      if (userDoc.exists()) { myAvatarUrl = userDoc.data().avatarUrl || ''; myUserName = userDoc.data().name || '익명'; }
      else { console.error("Firestore 사용자 문서 없음!"); myUserName = '익명'; }
  } catch (error) { console.error("Firestore 정보 가져오기 실패:", error); loadingMessage.value = '내 정보 로딩 실패.'; isLoading.value = false; return; }

  // 4. 내 아바타 로드 및 닉네임 추가
  loadingMessage.value = '내 아바타 로딩 중...';
  try {
      myAvatar = await loadAvatar(myAvatarUrl);
      scene.add(myAvatar); // 씬에 아바타 추가
      if (myUserName) { // 이름이 있으면 닉네임 추가
          const myNickname = createNicknameSprite(myUserName);
          myAvatar.add(myNickname); // 아바타 자식으로 추가
      }
      // 초기 카메라는 animate 루프에서 위치 잡음
  } catch (error) { /* 에러 처리 (기본 큐브 추가) */
        console.error("내 아바타 로드 중 에러 발생:", error);
        loadingMessage.value = '아바타 로딩 실패. 기본 아바타로 시작합니다.';
        if (myAvatar) { // 기본 큐브라도 로드되었다면 씬에 추가
            scene.add(myAvatar);
        } else { // 만약 기본 큐브 로드조차 실패했다면
            console.error("기본 아바타 로드 실패.");
            isLoading.value = false;
            return;
        }
   }

   // 5. 조이스틱 초기화 (nextTick 사용)
  await nextTick(); // DOM 요소가 렌더링될 때까지 기다림
  const joystickZone = document.getElementById('joystick-zone');
  if (joystickZone) {
    try {
        joystickManager = nipplejs.create({
          zone: joystickZone, mode: 'static', position: { right: '80px', bottom: '80px' }, color: 'rgba(255, 255, 255, 0.5)', size: 100
        });
        joystickManager.on('move', handleJoystickMove); joystickManager.on('end', handleJoystickEnd);
        console.log("조이스틱 생성 완료"); // 생성 확인 로그
    } catch (e) { console.error("조이스틱 생성 실패:", e); }
  } else { console.warn("조이스틱 영역 없음."); }

  // 6. RTDB 연결 및 리스너 시작
  loadingMessage.value = '다른 플레이어 접속 중...';
  await joinPlaza();
  if(isReady.value){ listenToOtherPlayers(); listenToChat(); }
  else { loadingMessage.value = 'Plaza 연결 실패.'; return; } // joinPlaza 실패 시 로딩 메시지 유지
  isLoading.value = false; // 최종 로딩 완료
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

  // Three.js 리소스 정리
  if (renderer) { renderer.dispose(); renderer = null; }
  if (scene) {
     scene.traverse(object => {
       // 메쉬 객체이고 지오메트리와 재질이 있으면 해제
       if(object.isMesh && object.geometry && object.material) {
           object.geometry.dispose(); // 지오메트리 해제
           // 재질 해제 (배열 또는 단일 객체 처리)
           if (Array.isArray(object.material)) {
               object.material.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
           } else {
               if(object.material.map) object.material.map.dispose();
               object.material.dispose();
           }
       }
       // [닉네임] 스프라이트 리소스 해제
       else if (object instanceof THREE.Sprite) {
           if (object.material.map) object.material.map.dispose();
           object.material.dispose();
       }
     });
    scene = null; // 씬 참조 제거
  }
  // 다른 참조들도 제거
  camera = null; clock = null; myAvatar = null;
  // 다른 플레이어 객체 정리
  Object.keys(otherPlayers).forEach(key => delete otherPlayers[key]);
});

</script>

<style scoped>
/* 이전 스타일과 동일 */
.utopia-container { width: 100vw; height: 100vh; margin: 0; padding: 0; overflow: hidden; position: relative; background-color: #ade6ff; }
.main-canvas { display: block; width: 100%; height: 100%; }
.loading-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.8); color: white; display: flex; flex-direction: column; justify-content: center; align-items: center; z-index: 10; font-size: 1.1em; }
.spinner { border: 4px solid rgba(255, 255, 255, 0.3); width: 40px; height: 40px; border-radius: 50%; border-left-color: #fff; animation: spin 1s linear infinite; margin-bottom: 20px; }
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
.chat-ui { position: absolute; bottom: 20px; left: 20px; width: 300px; max-width: 80%; max-height: 40%; background-color: rgba(0, 0, 0, 0.7); border-radius: 8px; padding: 10px; display: flex; flex-direction: column; z-index: 5; box-shadow: 0 2px 10px rgba(0,0,0,0.5); }
.message-list { flex-grow: 1; overflow-y: auto; margin-bottom: 10px; color: white; font-size: 0.9em; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.3) rgba(0,0,0,0.5); }
.message-list::-webkit-scrollbar { width: 5px; } .message-list::-webkit-scrollbar-track { background: rgba(0,0,0,0.5); border-radius: 3px;} .message-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.3); border-radius: 3px;} .message-list::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.5); }
.chat-message { margin-bottom: 6px; word-break: break-all; line-height: 1.4; } .chat-message strong { color: #f1c40f; margin-right: 5px; }
.chat-ui input { width: 100%; padding: 10px; border: none; border-radius: 4px; background-color: rgba(255, 255, 255, 0.15); color: white; outline: none; font-size: 0.9em; box-sizing: border-box; } .chat-ui input::placeholder { color: rgba(255, 255, 255, 0.6); } .chat-ui input:disabled { background-color: rgba(255, 255, 255, 0.1); cursor: not-allowed; }
.joystick-zone { position: absolute; bottom: 30px; right: 30px; width: 150px; height: 150px; z-index: 6; opacity: 0.7; }
</style>