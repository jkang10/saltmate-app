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
      muted
      preload="auto"
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
import { auth, db, rtdb } from '@/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
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

// --- 관리자 영상 제어 함수 ---
const toggleVideoPlay = () => {
  if (!cinemaVideoRef.value) return;
  const newStatus = !isVideoPlaying.value;
  
  // 로컬에서 먼저 반영 (반응성 향상)
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

// --- [회원] 영상 상태 리스너 ---
const listenToVideoState = () => {
  videoListenerRef = dbRef(rtdb, plazaVideoPath);
  onValue(videoListenerRef, (snapshot) => {
    const data = snapshot.val();
    if (!data || !cinemaVideoRef.value) return;

    isVideoPlaying.value = data.isPlaying;
    const videoEl = cinemaVideoRef.value;

    if (data.isPlaying) {
      // 네트워크 지연 보정
      const latency = (Date.now() - data.timestamp) / 1000;
      const targetTime = data.videoTime + latency;
      
      // 1초 이상 차이나면 시간 동기화
      if (Math.abs(videoEl.currentTime - targetTime) > 1) {
        videoEl.currentTime = targetTime;
      }
      
      const playPromise = videoEl.play();
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          console.log("자동 재생 차단됨 (사용자 인터랙션 대기 중):", error);
        });
      }
    } else {
      videoEl.pause();
      if (Math.abs(videoEl.currentTime - data.videoTime) > 0.5) {
        videoEl.currentTime = data.videoTime;
      }
    }
  });
};

// --- [핵심] 사용자 인터랙션 감지 (영상 재생 및 소리 켜기) ---
const handleUserInteraction = () => {
  const video = cinemaVideoRef.value;
  if (video) {
    // 1. 소리 켜기 (브라우저 정책 대응)
    if (video.muted) {
      video.muted = false;
      video.volume = 1.0;
      console.log("사용자 활동 감지: 음소거 해제 🔊");
    }
    // 2. 재생 중이어야 하는데 멈춰있다면 강제 재생
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
          if (child.isMesh || child.isSkinnedMesh) {
            child.geometry.translate(-center.x, -box.min.y, -center.z);
            child.castShadow = true;
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
              if (key === 'idle') action.play();
            }
          }
        }
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
  sprite.position.y = 2.0; // 닉네임 높이
  
  return sprite;
};

// --- 말풍선 생성 함수 ---
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

const listenToOtherPlayers = (preloadedAnimations) => {
  playersListenerRef = dbRef(rtdb, plazaPlayersPath);
  const currentUid = auth.currentUser.uid;
  onChildAdded(playersListenerRef, async (snapshot) => {
    if (snapshot.key === currentUid || otherPlayers[snapshot.key]) return;
    const val = snapshot.val();
    otherPlayers[snapshot.key] = {
      mesh: null, mixer: null, actions: {},
      targetPosition: new THREE.Vector3(val.position?.x, val.position?.y, val.position?.z),
      targetRotationY: val.rotationY || 0,
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
    }
  });
  onChildChanged(playersListenerRef, (snap) => {
    if (snap.key === currentUid || !otherPlayers[snap.key]) return;
    const val = snap.val();
    otherPlayers[snap.key].targetPosition.set(val.position.x, val.position.y, val.position.z);
    otherPlayers[snap.key].targetRotationY = val.rotationY;
  });
  onChildRemoved(playersListenerRef, (snap) => {
    if (!otherPlayers[snap.key]) return;
    if (scene) scene.remove(otherPlayers[snap.key].mesh);
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

// [완전 수정] 마우스/터치 클릭 이동 로직 제거 -> 오직 카메라 회전 및 영상 상호작용만 남김
const updatePlayerMovement = (deltaTime) => {
  if (!myAvatar || !isReady.value || !scene) return;

  let moved = false;
  let moveDirection = { x: 0, z: 0 };
  let currentAnimation = 'idle';
  let currentSpeedFactor = 1.0;
  let targetRotationY = myAvatar.rotation.y;
  let applyRotation = false;

  // 1. 조이스틱 이동
  if (joystickData.value.active && joystickData.value.distance > 10) {
      targetRotationY = -joystickData.value.angle + Math.PI / 2;
      applyRotation = true;
      moveDirection.z = -1;
      moved = true;
      currentAnimation = 'walk';
      currentSpeedFactor = joystickData.value.force;

  } else if (!joystickData.value.active) { 
    // 2. 키보드 이동 (카메라 방향 기준)
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

  // 회전 적용
  if (joystickData.value.active && applyRotation) {
      let currentY = myAvatar.rotation.y; const PI2 = Math.PI * 2;
      currentY = (currentY % PI2 + PI2) % PI2; let targetY = (targetRotationY % PI2 + PI2) % PI2;
      let diff = targetY - currentY; if (Math.abs(diff) > Math.PI) { diff = diff > 0 ? diff - PI2 : diff + PI2; }
      myAvatar.rotation.y += diff * deltaTime * 8;
  }

  if (moved) {
    const velocity = new THREE.Vector3(moveDirection.x * moveSpeed * 0.7 * deltaTime, 0, moveDirection.z * moveSpeed * currentSpeedFactor * deltaTime);
    // 조이스틱일 때는 이미 아바타가 회전했으므로 로컬 Z축으로 전진
    if (joystickData.value.active) {
        velocity.applyQuaternion(myAvatar.quaternion);
    } else {
        // 키보드일 때는 카메라 방향(이미 아바타에 적용됨) 기준으로 이동
        velocity.applyQuaternion(myAvatar.quaternion);
    }
    myAvatar.position.add(velocity);
  }

  // 경계 처리
  const boundary = 74.5;
  myAvatar.position.x = Math.max(-boundary, Math.min(boundary, myAvatar.position.x));
  myAvatar.position.z = Math.max(-boundary, Math.min(boundary, myAvatar.position.z));
  
  // Y 위치 고정 (Raycasting)
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

  // 애니메이션
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

const updateOtherPlayersMovement = (deltaTime) => {
  const lerpFactor = deltaTime * 8;
  for (const userId in otherPlayers) {
    const player = otherPlayers[userId];
    if (!player.mesh) continue;
    player.mesh.matrixAutoUpdate = true;
    
    const distance = player.mesh.position.distanceTo(player.targetPosition);
    const wasMoving = player.isMoving;
    player.isMoving = distance > 0.01;
    player.mesh.position.lerp(player.targetPosition, lerpFactor);
    
    let currentY = player.mesh.rotation.y; let targetY = player.targetRotationY; const PI2 = Math.PI * 2;
    currentY = (currentY % PI2 + PI2) % PI2; targetY = (targetY % PI2 + PI2) % PI2;
    let diff = targetY - currentY; if (Math.abs(diff) > Math.PI) { diff = diff > 0 ? diff - PI2 : diff + PI2; }
    player.mesh.rotation.y += diff * lerpFactor;

    const mixer = player.mixer;
    const actions = player.actions;
    if (mixer && actions.walk && actions.idle) {
      if (player.isMoving && !wasMoving) { actions.walk.reset().play(); actions.idle.crossFadeTo(actions.walk, 0.3); }
      else if (!player.isMoving && wasMoving) { actions.idle.reset().play(); actions.walk.crossFadeTo(actions.idle, 0.3); }
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
  // 영상 재생을 위한 사용자 인터랙션 감지 (전역 클릭/터치)
  window.addEventListener('touchstart', handleUserInteraction); 
  window.addEventListener('click', handleUserInteraction);

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
</style>