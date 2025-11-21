<template>
  <div class="utopia-container">
    <canvas ref="canvasRef" class="main-canvas" tabindex="0"></canvas>

    <video
      ref="cinemaVideoRef"
      id="cinema-video"
      style="display: none"
      crossorigin="anonymous"
      playsinline
      webkit-playsinline
      loop
      :muted="isMuted"
      preload="auto"
      @timeupdate="checkVideoProgress"
      @error="(e) => console.error('비디오 로드 에러:', e.target.error, e.target.currentSrc)"
    >
      <source src="/videos/helia_tea.mp4" type="video/mp4">
    </video>

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

    <div class="user-controls">
      <button @click="toggleMute" :class="{ 'active': !isMuted }">
        {{ isMuted ? '🔇 소리 켜기' : '🔊 소리 끄기' }}
      </button>
    </div>

    <div v-if="isAdmin" class="admin-video-controls">
      <h3>🎥 시네마 제어</h3>
      <button @click="toggleVideoPlay">{{ isVideoPlaying ? '일시정지' : '재생 시작' }}</button>
      <button @click="syncVideoTime">시간 동기화</button>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, nextTick } from 'vue';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { auth, db, rtdb, functions } from '@/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import {
  ref as dbRef, onChildAdded, onChildChanged, onChildRemoved, onValue,
  set, onDisconnect, push, serverTimestamp, off, query, limitToLast, remove,
  update
} from 'firebase/database';
import nipplejs from 'nipplejs';

// --- 유틸리티 함수 ---
const isFiniteNumber = (num) => (typeof num === 'number' && isFinite(num));

// --- 상태 변수 ---
const canvasRef = ref(null);
const cinemaVideoRef = ref(null);
const isLoading = ref(true);
const loadingMessage = ref('유토피아 입장 준비 중...');
const isReady = ref(false);
const isAdmin = ref(false);
const isVideoPlaying = ref(false);
const isMuted = ref(true); 
const rewardClaimedLocal = ref(false);

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

// 클릭/터치 이동 관련 변수 (복구)
const navigationTarget = ref(null);
const pointerDownPos = new THREE.Vector2();
const pointerDownTime = ref(0);

const loader = new GLTFLoader();

// --- Firebase RTDB 경로 ---
const plazaPlayersPath = 'plazaPlayers';
const plazaChatPath = 'plazaChat';
const plazaVideoPath = 'plaza/videoState';
let playerRef = null;
let playersListenerRef = null;
let chatListenerRef = null;
let videoListenerRef = null;

// --- 플레이어 이동 관련 ---
const moveSpeed = 2.0;
const keysPressed = reactive({});
const joystickData = ref({ active: false, angle: 0, distance: 0, force: 0 });
let joystickManager = null;

// --- 음소거 토글 함수 ---
const toggleMute = () => {
  isMuted.value = !isMuted.value;
  if (cinemaVideoRef.value) {
    cinemaVideoRef.value.muted = isMuted.value;
    if (!isMuted.value) {
      cinemaVideoRef.value.volume = 1.0;
    }
  }
};

// --- 영상 진행률 체크 및 보상 지급 ---
const checkVideoProgress = async () => {
  const video = cinemaVideoRef.value;
  if (!video || rewardClaimedLocal.value || !auth.currentUser) return;

  if (video.duration > 0 && video.currentTime >= video.duration * 0.95) {
    rewardClaimedLocal.value = true;
    try {
      const claimRewardFunc = httpsCallable(functions, 'claimVideoReward');
      const result = await claimRewardFunc();
      if (result.data.success) {
        showChatBubble(myAvatar, "🎉 영상 시청 완료! 1,000 SaltMate 지급! 🎉", "#FFD700"); 
      }
    } catch (error) {
      console.error("보상 지급 실패:", error);
    }
  }
};

// --- 관리자 영상 제어 함수 ---
const toggleVideoPlay = () => {
  if (!cinemaVideoRef.value) return;
  const newStatus = !isVideoPlaying.value;
  if (newStatus) {
      cinemaVideoRef.value.play().catch(e => console.log(e));
  } else {
      cinemaVideoRef.value.pause();
  }
  update(dbRef(rtdb, plazaVideoPath), {
    isPlaying: newStatus,
    timestamp: Date.now(),
    videoTime: cinemaVideoRef.value.currentTime
  });
};

const syncVideoTime = () => {
  if (!cinemaVideoRef.value) return;
  update(dbRef(rtdb, plazaVideoPath), {
    timestamp: Date.now(),
    videoTime: cinemaVideoRef.value.currentTime,
    forceSync: true
  });
};

// --- 영상 상태 리스너 ---
const listenToVideoState = () => {
  videoListenerRef = dbRef(rtdb, plazaVideoPath);
  onValue(videoListenerRef, (snapshot) => {
    const data = snapshot.val();
    if (!data || !cinemaVideoRef.value) return;

    isVideoPlaying.value = data.isPlaying;
    const videoEl = cinemaVideoRef.value;

    if (videoEl.readyState === 0) return;

    if (data.isPlaying) {
      const latency = (Date.now() - data.timestamp) / 1000;
      const targetTime = data.videoTime + latency;
      if (Math.abs(videoEl.currentTime - targetTime) > 1) {
        videoEl.currentTime = targetTime;
      }
      videoEl.play().catch((error) => {
          console.log("자동 재생 차단됨:", error);
      });
    } else {
      videoEl.pause();
      if (Math.abs(videoEl.currentTime - data.videoTime) > 0.5) {
        videoEl.currentTime = data.videoTime;
      }
    }
  });
};

// --- 사용자 인터랙션 감지 ---
const handleUserInteraction = () => {
  const video = cinemaVideoRef.value;
  if (video) {
    if (video.muted) {
      video.muted = false;
      video.volume = 1.0;
    }
    if (isVideoPlaying.value && video.paused) {
      video.play().catch(() => {});
    }
  }
};

// --- 애니메이션 로드 함수 ---
const loadAnimations = async () => {
  const animationPaths = {
    idle: '/animations/M_Standing_Idle_Variations_008.glb',
    walk: '/animations/F_Walk_003.glb',
    walkBackward: '/animations/M_Walk_Backwards_001.glb',
    strafeLeft: '/animations/M_Walk_Strafe_Left_002.glb',
    strafeRight: '/animations/M_Walk_Strafe_Right_002.glb'
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
      }
    });
    return loadedAnimations;
  } catch (error) {
    console.error('애니메이션 로딩 중 전체 오류 발생:', error);
    return loadedAnimations;
  }
};

// --- 아바타 로드 함수 ---
const loadAvatar = (url, animations) => {
  return new Promise((resolve) => {
    const model = new THREE.Group();
    model.matrixAutoUpdate = true;
    model.position.set(0, 0, 0);
    model.userData.mixer = null;
    model.userData.actions = {};

    if (!url || !url.endsWith('.glb')) {
      console.warn("아바타 URL 오류. 기본 큐브 사용.");
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
          if (child.isMesh || child.isSkinnedMesh) {
            child.geometry.translate(-center.x, -box.min.y, -center.z);
            child.castShadow = true;
            // [수정] 렌더링 누락 방지
            child.frustumCulled = false;
          }
          child.matrixAutoUpdate = true;
        });

        visuals.scale.set(0.7, 0.7, 0.7);
        model.add(visuals);
        model.userData.visuals = visuals;

        if (animations) {
          const mixer = new THREE.AnimationMixer(visuals);
          model.userData.mixer = mixer;
          for (const key in animations) {
            if (animations[key]) {
              const action = mixer.clipAction(animations[key]);
              model.userData.actions[key] = action;
              // [중요] 로드 직후 Idle 재생
              if (key === 'idle') action.play();
            }
          }
        }
        resolve(model);
      },
      undefined,
      (error) => {
        console.error('아바타 로딩 실패:', error);
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

// --- 닉네임 스프라이트 생성 함수 ---
const createNicknameSprite = (text) => {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const fontSize = 48;
  const fontWeight = 'bold';
  const fontFamily = 'Arial';
  context.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  const textMetrics = context.measureText(text);
  const textWidth = textMetrics.width;
  canvas.width = textWidth + 20;
  canvas.height = fontSize + 20;
  context.fillStyle = 'rgba(0, 0, 0, 0.7)';
  
  const r = 16;
  const w = canvas.width;
  const h = canvas.height;
  context.beginPath();
  context.moveTo(r, 0);
  context.lineTo(w - r, 0);
  context.quadraticCurveTo(w, 0, w, r);
  context.lineTo(w, h - r);
  context.quadraticCurveTo(w, h, w - r, h);
  context.lineTo(r, h);
  context.quadraticCurveTo(0, h, 0, h - r);
  context.lineTo(0, r);
  context.quadraticCurveTo(0, 0, r, 0);
  context.closePath();
  context.fill();

  context.fillStyle = 'white';
  context.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, w / 2, h / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  const scale = 0.0025;
  sprite.scale.set(canvas.width * scale, canvas.height * scale, 1.0);
  
  sprite.position.y = 2.0;
  
  // [수정] 닉네임 먼저 가는 문제 해결을 위해 다시 true로 복구 (부모와 동기화)
  sprite.matrixAutoUpdate = true;

  return sprite;
};

// --- 말풍선 생성 함수 ---
const createChatBubbleSprite = (text, textColor = "black") => {
  const resolutionScale = 2;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const fontSize = 20 * resolutionScale;
  const fontWeight = 'bold';
  const fontFamily = 'Arial';
  context.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  const maxWidth = 300 * resolutionScale;
  const textMetrics = context.measureText(text);
  const textWidth = Math.min(textMetrics.width, maxWidth);
  const padding = 10 * resolutionScale;
  const verticalPadding = 5 * resolutionScale;
  canvas.width = textWidth + padding * 2;
  canvas.height = fontSize + verticalPadding * 2;
  
  context.fillStyle = 'rgba(255, 255, 255, 0.95)';
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
  
  context.fillStyle = textColor;
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

const showChatBubble = (avatar, message, color = "black") => {
  if (!avatar) return;
  if (avatar.activeBubble) {
    avatar.remove(avatar.activeBubble);
    avatar.activeBubble.material.map.dispose();
    avatar.activeBubble.material.dispose();
    clearTimeout(avatar.activeBubble.timeoutId);
    avatar.activeBubble = null;
  }
  const newBubble = createChatBubbleSprite(message, color);
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

// --- 클릭/터치 핸들러 (복구) ---
const handlePointerDown = (event) => {
  if (chatInputRef.value === document.activeElement) return;
  pointerDownTime.value = Date.now();
  pointerDownPos.set(event.clientX, event.clientY);
};

const handlePointerUp = (event) => {
  if (chatInputRef.value === document.activeElement) return;
  const cityMap = scene.getObjectByName("cityMap");
  if (!cityMap) return;

  const DRAG_THRESHOLD_TIME = 200;
  const DRAG_THRESHOLD_DISTANCE = 10;
  const timeElapsed = Date.now() - pointerDownTime.value;
  const distanceMoved = pointerDownPos.distanceTo(new THREE.Vector2(event.clientX, event.clientY));

  if (timeElapsed < DRAG_THRESHOLD_TIME && distanceMoved < DRAG_THRESHOLD_DISTANCE) {
    // 클릭 시 키보드 이동 상태 초기화
    keysPressed['KeyW'] = false; keysPressed['KeyS'] = false;
    keysPressed['KeyA'] = false; keysPressed['KeyD'] = false;
    joystickData.value = { active: false, angle: 0, distance: 0, force: 0 };
    
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObject(cityMap, true);

    if (intersects.length > 0) {
      navigationTarget.value = intersects[0].point;
    }
  }
};

// --- Firebase RTDB 함수 ---
const joinPlaza = async () => {
  if (!auth.currentUser || !myAvatar) return;
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
    isReady.value = true;
  } catch (error) { console.error("Plaza 입장 실패:", error); }
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
  update(playerRef, newState).catch(() => {});
};

let lastUpdateTime = 0;
const throttledUpdate = () => {
  const now = Date.now();
  if (now - lastUpdateTime > 100) {
    updateMyStateInRTDB();
    lastUpdateTime = now;
  }
};

const sendMessage = () => {
  if (!chatInput.value.trim() || !isReady.value || !auth.currentUser) return;
  const chatMessage = { userId: auth.currentUser.uid, userName: myUserName || '익명', message: chatInput.value.trim(), timestamp: serverTimestamp() };
  push(dbRef(rtdb, plazaChatPath), chatMessage);
  chatInput.value = '';
  if (chatInputRef.value) { chatInputRef.value.blur(); }
};

const listenToChat = () => {
  chatListenerRef = query(dbRef(rtdb, plazaChatPath), limitToLast(MAX_CHAT_MESSAGES));
  onChildAdded(chatListenerRef, (snapshot) => {
    const msg = { id: snapshot.key, ...snapshot.val() };
    chatMessages.value.push(msg);
    if (chatMessages.value.length > MAX_CHAT_MESSAGES) { chatMessages.value.shift(); }
    nextTick(() => { if (messageListRef.value) { messageListRef.value.scrollTop = messageListRef.value.scrollHeight; } });
    const currentUid = auth.currentUser?.uid;
    if (msg.userId === currentUid && myAvatar) {
      showChatBubble(myAvatar, msg.message);
    } else if (otherPlayers[msg.userId] && otherPlayers[msg.userId].mesh) {
      showChatBubble(otherPlayers[msg.userId].mesh, msg.message);
    }
  });
};

// --- [수정] 다른 플레이어 리스너 (안전한 좌표 처리) ---
const listenToOtherPlayers = (preloadedAnimations) => {
  playersListenerRef = dbRef(rtdb, plazaPlayersPath);
  const currentUid = auth.currentUser.uid;
  onChildAdded(playersListenerRef, async (snapshot) => {
    if (snapshot.key === currentUid || otherPlayers[snapshot.key]) return;
    const val = snapshot.val();
    
    // [수정] 좌표값 null 체크 및 기본값 설정
    const posX = val.position?.x ?? 0;
    const posY = val.position?.y ?? 0;
    const posZ = val.position?.z ?? 0;
    const rotY = val.rotationY ?? 0;

    otherPlayers[snapshot.key] = {
      mesh: null, mixer: null, actions: {},
      targetPosition: new THREE.Vector3(posX, posY, posZ),
      targetRotationY: rotY,
      userName: val.userName, isMoving: false
    };
    
    const model = await loadAvatar(val.avatarUrl, preloadedAnimations);
    if (scene && otherPlayers[snapshot.key]) {
      model.position.copy(otherPlayers[snapshot.key].targetPosition);
      
      if (val.userName !== '익명') {
        const nick = createNicknameSprite(val.userName);
        if (model.userData.visuals) model.userData.visuals.add(nick);
        else model.add(nick);
      }
      
      scene.add(model);
      otherPlayers[snapshot.key].mesh = model;
      otherPlayers[snapshot.key].mixer = model.userData.mixer;
      otherPlayers[snapshot.key].actions = model.userData.actions;
      
      // [수정] 추가 직후 강제 업데이트 및 Idle 애니메이션 재생 보장
      model.updateMatrixWorld(true);
      if (model.userData.actions && model.userData.actions.idle) {
        model.userData.actions.idle.reset().play();
      }
    }
  });

  onChildChanged(playersListenerRef, (snap) => {
    if (snap.key === currentUid || !otherPlayers[snap.key]) return;
    const val = snap.val();
    if (!val.position) return;
    otherPlayers[snap.key].targetPosition.set(val.position.x ?? 0, val.position.y ?? 0, val.position.z ?? 0);
    otherPlayers[snap.key].targetRotationY = val.rotationY ?? 0;
  });

  onChildRemoved(playersListenerRef, (snap) => {
    if (!otherPlayers[snap.key]) return;
    if (scene && otherPlayers[snap.key].mesh) scene.remove(otherPlayers[snap.key].mesh);
    delete otherPlayers[snap.key];
  });
};

// --- Three.js 초기화 ---
const initThree = () => {
  try {
      scene = new THREE.Scene();
      const textureLoader = new THREE.TextureLoader();
      textureLoader.load('/my_background.jpg', (texture) => {
          texture.mapping = THREE.EquirectangularReflectionMapping;
          scene.background = texture;
          scene.environment = texture;
          console.log("배경 이미지 로드 완료");
      }, undefined, (err) => {
          console.error('배경 이미지 로드 실패:', err);
          scene.background = new THREE.Color(0xade6ff);
      });

      scene.fog = new THREE.Fog(0xaaaaaa, 70, 200);

      const startX = 37.16; const startY = 5.49; const startZ = 7.85;
      camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      camera.position.set(startX, startY + 5, startZ + 10);

      if (!canvasRef.value) return false;
      renderer = new THREE.WebGLRenderer({ canvas: canvasRef.value, antialias: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.1;
      controls.minDistance = 2;
      controls.maxDistance = 40;
      controls.maxPolarAngle = Math.PI / 2 - 0.05;
      controls.addEventListener('start', () => {
        if (navigationTarget.value) navigationTarget.value = null;
      });
      controls.target.set(startX, startY + 1.0, startZ);
      controls.update();

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
      scene.add(ambientLight);
      const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
      dirLight.position.set(50, 80, 40);
      dirLight.castShadow = true;
      dirLight.shadow.mapSize.width = 2048;
      dirLight.shadow.mapSize.height = 2048;
      dirLight.shadow.camera.near = 1;
      dirLight.shadow.camera.far = 200;
      dirLight.shadow.camera.left = -80; dirLight.shadow.camera.right = 80;
      dirLight.shadow.camera.top = 80; dirLight.shadow.camera.bottom = -80;
      dirLight.shadow.bias = -0.001;
      scene.add(dirLight);

      loader.load('/models/low_poly_city_pack.glb', (gltf) => {
          const city = gltf.scene;
          city.name = "cityMap";
          const box = new THREE.Box3().setFromObject(city);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          const desiredMaxSize = 150;
          const scaleFactor = desiredMaxSize / Math.max(size.x, size.z);
          city.scale.set(scaleFactor, scaleFactor, scaleFactor);
          const scaledBox = new THREE.Box3().setFromObject(city);
          const groundLevelY = -scaledBox.min.y;
          city.position.set(-center.x * scaleFactor, groundLevelY, -center.z * scaleFactor);
          city.traverse(child => { if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; } });
          scene.add(city);

          if (myAvatar) { myAvatar.position.set(startX, groundLevelY, startZ); }
          
          const video = cinemaVideoRef.value;
          if (video) {
            const videoTexture = new THREE.VideoTexture(video);
            videoTexture.minFilter = THREE.LinearFilter;
            videoTexture.magFilter = THREE.LinearFilter;
            const screenGeo = new THREE.PlaneGeometry(16, 9);
            const screenMat = new THREE.MeshBasicMaterial({ map: videoTexture, side: THREE.DoubleSide });
            const screen = new THREE.Mesh(screenGeo, screenMat);
            screen.position.set(startX, groundLevelY + 7, startZ - 15); 
            scene.add(screen);
          }
      }, undefined, (error) => {
          console.error('!!! 도시 맵 로드 실패 (GLTFLoader 에러):', error);
      });

      clock = new THREE.Clock();
      return true;
  } catch (error) { 
      console.error("Three.js 초기화 중 오류 발생:", error);
      return false; 
  }
};

// --- 입력 및 이동 로직 ---
const handleKeyDown = (event) => {
    if (chatInputRef.value === document.activeElement) return;
    keysPressed[event.code] = true;
};
const handleKeyUp = (event) => { keysPressed[event.code] = false; };
const handleJoystickMove = (evt, data) => { joystickData.value = { active: true, angle: data.angle.radian, distance: data.distance, force: data.force }; };
const handleJoystickEnd = () => { joystickData.value = { active: false, angle: 0, distance: 0, force: 0 }; };

const updatePlayerMovement = (deltaTime) => {
  if (!myAvatar || !isReady.value || !scene) return;

  let moved = false;
  let moveDirection = { x: 0, z: 0 };
  let currentAnimation = 'idle';
  let currentSpeedFactor = 1.0;
  let targetRotationY = myAvatar.rotation.y;
  let applyRotation = false;

  // 1. 클릭/터치 이동 처리
  if (navigationTarget.value != null) {
    if (joystickData.value.active || keysPressed['KeyW'] || keysPressed['KeyS'] || keysPressed['KeyA'] || keysPressed['KeyD'] || keysPressed['ArrowUp'] || keysPressed['ArrowDown'] || keysPressed['ArrowLeft'] || keysPressed['ArrowRight']) {
      navigationTarget.value = null;
    } else {
      const targetPos = navigationTarget.value;
      const currentPos = myAvatar.position;
      const distance = Math.sqrt(Math.pow(targetPos.x - currentPos.x, 2) + Math.pow(targetPos.z - currentPos.z, 2));

      if (distance < 0.2) {
        navigationTarget.value = null;
        moved = false;
        currentAnimation = 'idle';
      } else {
        const direction = new THREE.Vector3().subVectors(targetPos, currentPos);
        direction.y = 0;
        targetRotationY = Math.atan2(direction.x, direction.z);
        applyRotation = true;
        moveDirection.z = -1;
        moved = true;
        currentAnimation = 'walk';
      }
    }
  }
  
  // 2. 키보드/조이스틱 이동
  if (navigationTarget.value == null) { 
    if (joystickData.value.active && joystickData.value.distance > 10) {
      targetRotationY = -joystickData.value.angle + Math.PI / 2;
      applyRotation = true;
      moveDirection.z = -1;
      moved = true;
      currentAnimation = 'walk';
      currentSpeedFactor = joystickData.value.force;

    } else if (!joystickData.value.active) {
      const cameraEuler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
      const isKeyboardMoving = keysPressed['KeyW'] || keysPressed['ArrowUp'] || keysPressed['KeyS'] || keysPressed['ArrowDown'] || keysPressed['KeyA'] || keysPressed['ArrowLeft'] || keysPressed['KeyD'] || keysPressed['ArrowRight'];
      
      if (isKeyboardMoving) {
        myAvatar.rotation.y = cameraEuler.y;
        moved = true;
      }

      if (keysPressed['KeyA'] || keysPressed['ArrowLeft']) { moveDirection.x = -1; currentAnimation = 'strafeLeft'; }
      if (keysPressed['KeyD'] || keysPressed['ArrowRight']) { moveDirection.x = 1; currentAnimation = 'strafeRight'; }
      if (keysPressed['KeyW'] || keysPressed['ArrowUp']) { moveDirection.z = -1; if (currentAnimation === 'idle') currentAnimation = 'walk'; }
      if (keysPressed['KeyS'] || keysPressed['ArrowDown']) { moveDirection.z = 1; if (currentAnimation === 'idle') currentAnimation = 'walkBackward'; }
    }
  }

  if (applyRotation) {
      let currentY = myAvatar.rotation.y; const PI2 = Math.PI * 2;
      currentY = (currentY % PI2 + PI2) % PI2; let targetY = (targetRotationY % PI2 + PI2) % PI2;
      let diff = targetY - currentY; if (Math.abs(diff) > Math.PI) { diff = diff > 0 ? diff - PI2 : diff + PI2; }
      myAvatar.rotation.y += diff * deltaTime * 8;
  }

  if (moved) {
    const velocity = new THREE.Vector3(moveDirection.x * moveSpeed * 0.7 * deltaTime, 0, moveDirection.z * moveSpeed * currentSpeedFactor * deltaTime);
    if (joystickData.value.active) {
        velocity.applyQuaternion(myAvatar.quaternion);
    } else {
        velocity.applyQuaternion(myAvatar.quaternion);
    }
    myAvatar.position.add(velocity);
  }

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

  if (moved) throttledUpdate();

  const mixer = myAvatar.userData.mixer;
  const actions = myAvatar.userData.actions;
  if (mixer) {
    const targetAction = actions[currentAnimation] || actions.idle;
    const activeAction = mixer._actions.find(a => a.isRunning() && a !== targetAction);
    if (targetAction && !targetAction.isRunning()) {
      targetAction.reset().play();
      if (activeAction) activeAction.crossFadeTo(targetAction, 0.3);
    }
  }
};

// --- [수정] 다른 플레이어 애니메이션 업데이트 (상태 기반) ---
const updateOtherPlayersMovement = (deltaTime) => {
  const lerpFactor = deltaTime * 8;
  for (const userId in otherPlayers) {
    const player = otherPlayers[userId];
    if (!player.mesh) continue;
    player.mesh.matrixAutoUpdate = true;
    
    const distance = player.mesh.position.distanceTo(player.targetPosition);
    player.isMoving = distance > 0.01;
    player.mesh.position.lerp(player.targetPosition, lerpFactor);
    
    let currentY = player.mesh.rotation.y; let targetY = player.targetRotationY; const PI2 = Math.PI * 2;
    currentY = (currentY % PI2 + PI2) % PI2; targetY = (targetY % PI2 + PI2) % PI2;
    let diff = targetY - currentY; if (Math.abs(diff) > Math.PI) { diff = diff > 0 ? diff - PI2 : diff + PI2; }
    player.mesh.rotation.y += diff * lerpFactor;

    // 상태 기반 애니메이션 재생 (멈춰있어도 Idle이 나오도록 보장)
    const mixer = player.mixer;
    const actions = player.actions;
    if (mixer && actions.walk && actions.idle) {
      const isWalkRunning = actions.walk.isRunning();
      const isIdleRunning = actions.idle.isRunning();

      if (player.isMoving) {
        if (!isWalkRunning) {
          actions.idle.stop();
          actions.walk.reset().play();
          actions.walk.crossFadeFrom(actions.idle, 0.3, true);
        }
      } else {
        if (!isIdleRunning) {
          actions.walk.stop();
          actions.idle.reset().play();
          actions.idle.crossFadeFrom(actions.walk, 0.3, true);
        }
      }
    }
  }
};

const animate = () => {
  if (!renderer || !scene || !camera || !clock) return;
  requestAnimationFrame(animate);
  const deltaTime = clock.getDelta();

  if (myAvatar && myAvatar.userData.mixer) { myAvatar.userData.mixer.update(deltaTime); }
  for (const userId in otherPlayers) { if (otherPlayers[userId].mixer) { otherPlayers[userId].mixer.update(deltaTime); } }

  updatePlayerMovement(deltaTime);
  updateOtherPlayersMovement(deltaTime);
  if (controls) controls.update();
  renderer.render(scene, camera);
};

onMounted(async () => {
  if (!auth.currentUser) return;
  const currentUid = auth.currentUser.uid;
  
  try {
    const token = await auth.currentUser.getIdTokenResult();
    if (token.claims.role === 'superAdmin') {
      isAdmin.value = true;
    }
  } catch(e) { console.log("권한 확인 실패"); }

  if (!initThree()) return;

  const preloadedAnimations = await loadAnimations();
  
  window.addEventListener('resize', handleResize);
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  window.addEventListener('touchstart', handleUserInteraction); 
  window.addEventListener('click', handleUserInteraction);
  if (canvasRef.value) {
    canvasRef.value.addEventListener('pointerdown', handlePointerDown);
    canvasRef.value.addEventListener('pointerup', handlePointerUp);
  }

  animate();

  try {
    const userDoc = await getDoc(doc(db, 'users', currentUid));
    if (userDoc.exists()) {
        myAvatarUrl = userDoc.data().avatarUrl;
        myUserName = userDoc.data().name;
    }
  } catch (error) {
    console.error("Firestore 정보 가져오기 실패:", error);
  }

  myAvatar = await loadAvatar(myAvatarUrl, preloadedAnimations);
  if (myUserName) {
    const nick = createNicknameSprite(myUserName);
    if (myAvatar.userData.visuals) myAvatar.userData.visuals.add(nick);
    else myAvatar.add(nick);
  }
  scene.add(myAvatar);

  await nextTick();
  const joystickZone = document.getElementById('joystick-zone');
  if (joystickZone) {
      joystickManager = nipplejs.create({ zone: joystickZone, mode: 'static', position: { right: '80px', bottom: '80px' }, color: 'rgba(255, 255, 255, 0.5)', size: 100 });
      joystickManager.on('move', handleJoystickMove);
      joystickManager.on('end', handleJoystickEnd);
  }

  await joinPlaza();
  if (isReady.value) {
    listenToOtherPlayers(preloadedAnimations);
    listenToVideoState();
    listenToChat();
  }
  isLoading.value = false;
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('keyup', handleKeyUp);
  window.removeEventListener('touchstart', handleUserInteraction);
  window.removeEventListener('click', handleUserInteraction);
  if (canvasRef.value) {
    canvasRef.value.removeEventListener('pointerdown', handlePointerDown);
    canvasRef.value.removeEventListener('pointerup', handlePointerUp);
  }
  
  if (playersListenerRef) off(playersListenerRef);
  if (videoListenerRef) off(videoListenerRef);
  if (playerRef) remove(playerRef);
  if (joystickManager) joystickManager.destroy();
  if (controls) controls.dispose();
  if (renderer) renderer.dispose();
});

const handleResize = () => {
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
};
</script>

<style scoped>
.utopia-container { width: 100vw; height: 100vh; margin: 0; padding: 0; overflow: hidden; position: relative; background-color: #ade6ff; }
.main-canvas { display: block; width: 100%; height: 100%; }
.loading-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.8); color: white; display: flex; flex-direction: column; justify-content: center; align-items: center; z-index: 10; }
.spinner { border: 4px solid rgba(255, 255, 255, 0.3); width: 40px; height: 40px; border-radius: 50%; border-left-color: #fff; animation: spin 1s linear infinite; margin-bottom: 20px; }
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
.chat-ui { position: absolute; bottom: 20px; left: 20px; width: 300px; max-width: 80%; max-height: 20%; background-color: rgba(0, 0, 0, 0.7); border-radius: 8px; padding: 10px; display: flex; flex-direction: column; z-index: 5; }
.message-list { flex-grow: 1; overflow-y: auto; margin-bottom: 10px; color: white; font-size: 0.9em; }
.chat-message { margin-bottom: 6px; word-break: break-all; line-height: 1.4; }
.chat-ui input { width: 100%; padding: 10px; border: none; border-radius: 4px; background-color: rgba(255, 255, 255, 0.15); color: white; outline: none; }
.joystick-zone { position: absolute; bottom: 30px; right: 30px; width: 150px; height: 150px; z-index: 6; opacity: 0.7; }
.admin-video-controls { position: absolute; top: 20px; left: 20px; background: rgba(0, 0, 0, 0.8); padding: 15px; border-radius: 8px; color: white; z-index: 100; }
.admin-video-controls button { display: block; margin-top: 10px; padding: 8px 12px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; width: 100%; }
.admin-video-controls button:hover { background: #0056b3; }

/* [신규] 사용자 컨트롤 (음소거 버튼 등) */
.user-controls {
  position: absolute;
  top: 20px;
  right: 20px;
  z-index: 100;
}
.user-controls button {
  padding: 10px 15px;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.5);
  border-radius: 20px;
  cursor: pointer;
  font-weight: bold;
  transition: background 0.3s;
}
.user-controls button:hover {
  background: rgba(0, 0, 0, 0.8);
}
.user-controls button.active {
  border-color: #28a745;
  color: #28a745;
}
</style>