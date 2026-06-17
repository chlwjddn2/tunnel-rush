import * as THREE from 'three';

// ---------- 설정 ----------
const RADIUS = 6;
const LANES = 12;
const LANE_ANGLE = (Math.PI * 2) / LANES;
const SEGMENT_LENGTH = 4;
const TILE_LENGTH = 3.5;
const TILE_THICKNESS = 0.6;
const TILE_WIDTH = 2 * RADIUS * Math.sin(LANE_ANGLE / 2) * 0.9;
const VIEW_AHEAD = 34;
const BEHIND_COUNT = 6;
const START_SAFE_SEGMENT = 10;
const GRAVITY = 34;
const JUMP_VELOCITY = 12;
const PLAYER_HALF_HEIGHT = 0.95;
const MOVE_COOLDOWN = 140;
const STAR_COUNT = 1400;

// ---------- 페이즈 ----------
const PHASES = [
  {
    minDist: 0,    bgColor: 0x05060f, fogColor: 0x05060f,
    tileColors: [0x29407a, 0x375aa8, 0x4878c8, 0x2e4d96], tileEmissive: 0x0a1430,
    ambientColor: 0x8090ff, rimColor: 0x66aaff,
    safeWidth: 4, forceHoles: false, waveDrift: false,
  },
  {
    minDist: 300,  bgColor: 0x07031a, fogColor: 0x07031a,
    tileColors: [0x4a2070, 0x6232a2, 0x7848c2, 0x381860], tileEmissive: 0x180a30,
    ambientColor: 0xaa80ff, rimColor: 0xaa66ff,
    safeWidth: 3, forceHoles: false, waveDrift: true,
  },
  {
    minDist: 700,  bgColor: 0x130408, fogColor: 0x130408,
    tileColors: [0x7a2020, 0xa03030, 0xc04040, 0x601010], tileEmissive: 0x300808,
    ambientColor: 0xff8880, rimColor: 0xff5555,
    safeWidth: 2, forceHoles: true,  waveDrift: false,
  },
  {
    minDist: 1300, bgColor: 0x0d000d, fogColor: 0x0d000d,
    tileColors: [0x5a005a, 0x780078, 0x940094, 0x3a003a], tileEmissive: 0x200020,
    ambientColor: 0xff80ff, rimColor: 0xff44ff,
    safeWidth: 1, forceHoles: true,  waveDrift: true,
  },
];

// ---------- 변수 설정 ----------
const $canvas = document.querySelector('#game');
const scoreElement = document.querySelector('#score');
const coinsElement = document.querySelector('#coins');
const bestElement = document.querySelector('#best');

const $touchBox = document.querySelector('#touch');
const $touchLeftButton = document.querySelector('#tleft');
const $touchRightButton = document.querySelector('#tright');
const $touchUpButton = document.querySelector('#tjump');

const $muteButton = document.querySelector('#muteBtn');

const $startBox = document.querySelector('#start');
const $overBox = document.querySelector('#over');

const $startButton = document.querySelector('#startBtn');
const $retryButton = document.querySelector('#retryBtn');

const $finalScore = document.querySelector('#finalScore');
const $finalCoin = document.querySelector('#finalCoins')
const $finalBest = document.querySelector('#finalBest')


// ---------- 렌더러/씬 ----------
const renderer = new THREE.WebGLRenderer({ canvas: $canvas, antialias: true });
const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 220);
const scene = new THREE.Scene();

scene.background = new THREE.Color(0x05060f);
scene.fog = new THREE.Fog(0x05060f, 28, 92);

renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

camera.position.set(0, -RADIUS + 5.6, 6.5);
camera.lookAt(0, -RADIUS + 1.4, -14);

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}

resize();

addEventListener('resize', resize);

// ---------- 조명 ----------
const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
const rimLight = new THREE.PointLight(0x66aaff, 0.6, 40);

const ambientLight = new THREE.AmbientLight(0x8090ff, 0.7);
scene.add(ambientLight);
dirLight.position.set(4, 9, 7); scene.add(dirLight);
rimLight.position.set(0, -RADIUS + 2, 6); scene.add(rimLight);

// ---------- 별 배경 ----------

const positions = new Float32Array(STAR_COUNT * 3);

for (let i = 0; i < STAR_COUNT; i++) {
  positions[i * 3] = (Math.random() - 0.5) * 240;
  positions[i * 3 + 1] = (Math.random() - 0.5) * 240;
  positions[i * 3 + 2] = Math.random() * -220 + 20;
}
const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
scene.add(new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0x9fb8ff, size: 0.7, sizeAttenuation: true })));


// ---------- 공유 지오메트리/머티리얼 ----------
const tileGeometry = new THREE.BoxGeometry(TILE_WIDTH, TILE_THICKNESS, TILE_LENGTH);
const palette = [0x29407a, 0x375aa8, 0x4878c8, 0x2e4d96].map((color) =>
  new THREE.MeshStandardMaterial({
    color, emissive: 0x0a1430, emissiveIntensity: 0.6,
    roughness: 0.55, metalness: 0.2
  })
);
const gemGeometry = new THREE.OctahedronGeometry(0.42);
const gemMaterial = new THREE.MeshStandardMaterial({
  color: 0xffd23d, emissive: 0xc88a00,
  emissiveIntensity: 0.8, roughness: 0.3, metalness: 0.4
});

const world = new THREE.Group();
scene.add(world);

// ---------- 플레이어 ----------
const player = new THREE.Group();
const bodyMaterial = new THREE.MeshStandardMaterial({
  color: 0xff4d6d, emissive: 0x661025,
  emissiveIntensity: 0.7, roughness: 0.4
});
const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.7, 6, 14), bodyMaterial);
player.add(body);
const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 16),
  new THREE.MeshStandardMaterial({ color: 0xffe0d0, emissive: 0x332018, roughness: 0.5 })
);
head.position.y = 0.78;
player.add(head);
const visor = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.12),
  new THREE.MeshStandardMaterial({ color: 0x18324d, emissive: 0x2266aa, emissiveIntensity: 0.8 })
);
visor.position.set(0, 0.8, 0.26); player.add(visor);
scene.add(player);

// ---------- 상태 ----------
let gameState = 'menu';       // menu | play | fall | over
let distance = 0;
let speed = 14;
let playerLane = 0;           // 정수(무한), 실제 레인 = mod LANES
let currentAngle = 0;
let jumpHeight = 0;
let jumpVelocity = 0;
let onGround = true;
let jumpsRemaining = 2;
let safeLane = 0;
let coins = 0;
let bestDistance = +(localStorage.getItem('tunnelrush_best') || 0);
let lastMoveTime = 0;
let audioContext = null;
let muted = false;
let activePhaseIndex = -1;

const segments = new Map();   // segmentIndex -> {group, holes:Set, gems:[]}

// ---------- HUD ----------

bestElement.textContent = 'BEST ' + bestDistance;

// ---------- 페이즈 헬퍼 ----------
function getPhaseIndex(dist) {
  let idx = 0;
  for (let i = 0; i < PHASES.length; i++) {
    if (dist >= PHASES[i].minDist) idx = i;
  }
  return idx;
}

function applyPhase(phaseIndex) {
  const phase = PHASES[phaseIndex];
  scene.background.setHex(phase.bgColor);
  scene.fog.color.setHex(phase.fogColor);
  ambientLight.color.setHex(phase.ambientColor);
  rimLight.color.setHex(phase.rimColor);
  palette.forEach((mat, i) => {
    mat.color.setHex(phase.tileColors[i]);
    mat.emissive.setHex(phase.tileEmissive);
  });
  if (phaseIndex > 0) beep(180, 0.4, 'sawtooth');
  activePhaseIndex = phaseIndex;
}

// ---------- 세그먼트 생성/재활용 ----------
function getHoleProbability(segmentIndex) {
  return Math.min(0.10 + segmentIndex * 0.0009, 0.42);
}

function getLaneMaterial(laneIndex) {
  return palette[laneIndex % palette.length];
}

function generateSegment(segmentIndex) {
  const holes = new Set();
  const gems = [];
  if (segmentIndex >= START_SAFE_SEGMENT) {
    const approxDist = segmentIndex * SEGMENT_LENGTH;
    const phase = PHASES[getPhaseIndex(approxDist)];

    // 안전 레인 이동: 파도 페이즈는 한 방향으로, 나머지는 랜덤
    if (phase.waveDrift) {
      if (segmentIndex % 2 === 0) safeLane = (safeLane + 1) % LANES;
    } else {
      safeLane = ((safeLane + (Math.floor(Math.random() * 3) - 1)) % LANES + LANES) % LANES;
    }

    const holeProbability = getHoleProbability(segmentIndex);
    for (let lane = 0; lane < LANES; lane++) {
      const distFromSafe = Math.min(Math.abs(lane - safeLane), LANES - Math.abs(lane - safeLane));
      if (distFromSafe < phase.safeWidth) continue;
      if (phase.forceHoles || Math.random() < holeProbability) holes.add(lane);
    }
  }
  const group = new THREE.Group();
  group.position.z = -segmentIndex * SEGMENT_LENGTH;
  for (let lane = 0; lane < LANES; lane++) {
    if (holes.has(lane)) continue;
    const angle = lane * LANE_ANGLE;
    const tileRadius = RADIUS + TILE_THICKNESS / 2;
    const tileMesh = new THREE.Mesh(tileGeometry, getLaneMaterial(lane));
    tileMesh.position.set(tileRadius * Math.sin(angle), -tileRadius * Math.cos(angle), 0);
    tileMesh.rotation.z = angle;
    group.add(tileMesh);
  }
  // 젬: 안전 레인 위주로 가끔 배치
  if (segmentIndex >= START_SAFE_SEGMENT && Math.random() < 0.3 && !holes.has(safeLane)) {
    const angle = safeLane * LANE_ANGLE;
    const gemRadius = RADIUS - 0.9;
    const gemMesh = new THREE.Mesh(gemGeometry, gemMaterial);
    gemMesh.position.set(gemRadius * Math.sin(angle), -gemRadius * Math.cos(angle), 0);
    group.add(gemMesh);
    gems.push({ lane: safeLane, mesh: gemMesh, taken: false });
  }
  world.add(group);
  segments.set(segmentIndex, { group, holes, gems });
}

function updateSegments() {
  const currentSegmentIndex = Math.round(distance / SEGMENT_LENGTH);
  for (let i = Math.max(0, currentSegmentIndex - BEHIND_COUNT); i <= currentSegmentIndex + VIEW_AHEAD; i++) {
    if (!segments.has(i)) generateSegment(i);
  }
  for (const [idx, seg] of segments) {
    if (idx < currentSegmentIndex - BEHIND_COUNT) { world.remove(seg.group); segments.delete(idx); }
  }
}

function clearWorld() {
  while (world.children.length) world.remove(world.children[0]);
  segments.clear();
}

// ---------- 조작 ----------
function moveLeft() {
  if (gameState !== 'play') return;
  const now = performance.now();
  if (now - lastMoveTime < MOVE_COOLDOWN) return;
  lastMoveTime = now; playerLane -= 1;
}

function moveRight() {
  if (gameState !== 'play') return;
  const now = performance.now();
  if (now - lastMoveTime < MOVE_COOLDOWN) return;
  lastMoveTime = now; playerLane += 1;
}

function jump() {
  if (gameState === 'play' && jumpsRemaining > 0) {
    jumpVelocity = JUMP_VELOCITY;
    onGround = false;
    jumpsRemaining--;
    beep(jumpsRemaining === 0 ? 880 : 660, 0.12, 'square');
  }
}

addEventListener('keydown', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') moveLeft();
  else if (e.code === 'ArrowRight' || e.code === 'KeyD') moveRight();
  else if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); jump(); }
  else if (e.code === 'Enter') { if (gameState === 'menu') start(); else if (gameState === 'over') start(); }
});

function bindHold(el, fn) {
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    fn();
  });
}

bindHold($touchLeftButton, moveLeft);
bindHold($touchRightButton, moveRight);
bindHold($touchUpButton, jump);

if (matchMedia('(hover:none)').matches || 'ontouchstart' in window) {
  $touchBox.classList.remove('hidden');
}

// ---------- 사운드 ----------
function beep(frequency, duration, type) {
  if (muted) return;
  try {
    audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.type = type || 'square'; oscillator.frequency.value = frequency;
    oscillator.connect(gainNode); gainNode.connect(audioContext.destination);
    gainNode.gain.setValueAtTime(0.07, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
    oscillator.start(); oscillator.stop(audioContext.currentTime + duration);
  } catch (e) { }
}

function deathSound() {
  if (muted) return;
  [440, 330, 247, 165].forEach((freq, i) => setTimeout(() => beep(freq, 0.18, 'sawtooth'), i * 90));
}

$muteButton.addEventListener('click', (e) => {
  muted = !muted;
  e.target.textContent = muted ? '🔇' : '🔊';
});

// ---------- 게임 시작/종료 ----------
function start() {
  clearWorld();
  distance = 0;
  speed = 14;
  playerLane = 0;
  currentAngle = 0;
  safeLane = 0;
  jumpHeight = 0;
  jumpVelocity = 0;
  onGround = true;
  jumpsRemaining = 2;
  coins = 0;
  activePhaseIndex = -1;
  applyPhase(0);
  scoreElement.textContent = '0';
  coinsElement.textContent = '0';
  $startBox.classList.add('hidden');
  $overBox.classList.add('hidden');
  gameState = 'play';
  beep(880, 0.001);
}

function gameOver() {
  gameState = 'over';
  bestDistance = Math.max(bestDistance, Math.floor(distance));
  localStorage.setItem('tunnelrush_best', bestDistance);
  $finalScore.textContent = Math.floor(distance);
  $finalCoin.textContent = coins;
  $finalBest.textContent = bestDistance;
  bestElement.textContent = 'BEST ' + bestDistance;
  $overBox.classList.remove('hidden');
}

function startFall() {
  if (gameState !== 'play') return;
  gameState = 'fall';
  onGround = false;
  jumpVelocity = Math.min(jumpVelocity, -3);
  deathSound();
  setTimeout(gameOver, 700);
}

$startButton.addEventListener('click', start);
$retryButton.addEventListener('click', start);

// ---------- 메인 루프 ----------
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const deltaTime = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;

  // 젬 회전
  for (const seg of segments.values())
    for (const gem of seg.gems) if (!gem.taken) gem.mesh.rotation.y += deltaTime * 3;

  if (gameState === 'menu') {
    distance += 7 * deltaTime;
    world.position.z = distance;
    currentAngle += (Math.sin(elapsed * 0.4) * LANE_ANGLE - currentAngle) * Math.min(1, deltaTime * 2);
    world.rotation.z = -currentAngle;
    updateSegments();
    player.position.set(0, -RADIUS + PLAYER_HALF_HEIGHT + Math.sin(elapsed * 4) * 0.05, 0);
    player.rotation.set(-0.12, 0, 0);
  }
  else if (gameState === 'play') {
    speed = 14 + Math.min(distance * 0.03, 26);
    distance += speed * deltaTime;
    world.position.z = distance;

    // 페이즈 전환 체크
    const newPhaseIndex = getPhaseIndex(distance);
    if (newPhaseIndex !== activePhaseIndex) applyPhase(newPhaseIndex);

    // 레인 부드럽게 회전
    const targetAngle = playerLane * LANE_ANGLE;
    currentAngle += (targetAngle - currentAngle) * Math.min(1, deltaTime * 12);
    world.rotation.z = -currentAngle;

    // 점프 물리
    if (!onGround) { jumpVelocity -= GRAVITY * deltaTime; jumpHeight += jumpVelocity * deltaTime; }

    // 발밑 판정
    const currentSegmentIndex = Math.round(distance / SEGMENT_LENGTH);
    const currentSeg = segments.get(currentSegmentIndex);
    const currentLane = ((Math.round(currentAngle / LANE_ANGLE)) % LANES + LANES) % LANES;
    const isOverHole = currentSeg ? currentSeg.holes.has(currentLane) : false;

    if (onGround) {
      if (isOverHole) startFall();
    } else if (jumpHeight <= 0 && jumpVelocity <= 0) {
      if (isOverHole) { startFall(); }
      else { jumpHeight = 0; jumpVelocity = 0; onGround = true; jumpsRemaining = 2; }
    }

    // 젬 수집
    if (currentSeg) {
      for (const gem of currentSeg.gems) {
        if (!gem.taken && gem.lane === currentLane) {
          gem.taken = true; gem.mesh.visible = false;
          coins++; coinsElement.textContent = coins;
          beep(1046, 0.07, 'sine'); setTimeout(() => beep(1318, 0.07, 'sine'), 60);
        }
      }
    }

    updateSegments();
    player.position.set(0, -RADIUS + PLAYER_HALF_HEIGHT + jumpHeight + (onGround ? Math.sin(elapsed * 16) * 0.05 : 0), 0);
    player.rotation.set(-0.15, 0, 0);
    scoreElement.textContent = Math.floor(distance);
  }
  else if (gameState === 'fall') {
    jumpVelocity -= GRAVITY * deltaTime; jumpHeight += jumpVelocity * deltaTime;
    world.position.z = distance;
    player.position.set(0, -RADIUS + PLAYER_HALF_HEIGHT + jumpHeight, 0);
    player.rotation.x += deltaTime * 7;
  }

  renderer.render(scene, camera);
}

animate();
