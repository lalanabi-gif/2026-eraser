const setupArea = document.getElementById('setupArea');
const appContainer = document.getElementById('appContainer');
const startOverlay = document.getElementById('startOverlay');
const imageLoader = document.getElementById('imageLoader');
const uploadStatus = document.getElementById('uploadStatus');
const btnInitStart = document.getElementById('btnInitStart');
const btnResetImages = document.getElementById('btnResetImages');

const imageCanvas = document.getElementById('imageCanvas');
const imageCtx = imageCanvas.getContext('2d', { willReadFrequently: true });
const eraserCanvas = document.getElementById('eraserCanvas');
const eraserCtx = eraserCanvas.getContext('2d', { willReadFrequently: true });

const btnCheckAnswer = document.getElementById('btnCheckAnswer');
const actionButtons = document.getElementById('actionButtons');
const imageLabel = document.getElementById('imageLabel');
const btnPrev = document.getElementById('btnPrev');
const btnNext = document.getElementById('btnNext');
const numberSelectors = document.getElementById('numberSelectors');
const eraserSizeInput = document.getElementById('eraserSize');

const bgmCheck = document.getElementById('bgmCheck');
const sfxCheck = document.getElementById('sfxCheck');

let images = []; 
let currentIdx = 0;
let isDrawing = false;
let isAnswerRevealed = false;
let eraserSize = parseInt(eraserSizeInput.value); 
let lastSfxTime = 0; 

// ==========================================
// 100% 무적 오디오 합성 엔진 (외부 파일 에러 없음)
// ==========================================
let audioCtx = null;
let bgmInterval = null;

function initAudio() {
    if (audioCtx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();
}

// 1. 귀여운 통통 퍼즐 브금 (C장조 멜로디 반복)
function playBGM() {
    if (!audioCtx) initAudio();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    if (bgmInterval) return;

    const melody = [261.63, 329.63, 392.00, 523.25, 392.00, 329.63]; // 도미솔도솔미
    let i = 0;
    bgmInterval = setInterval(() => {
        if (!bgmCheck.checked || audioCtx.state === 'suspended') return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(melody[i % melody.length], audioCtx.currentTime);
        gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(); osc.stop(audioCtx.currentTime + 0.3);
        i++;
    }, 400); // 0.4초 간격 경쾌한 리듬
}

function stopBGM() {
    if (bgmInterval) clearInterval(bgmInterval);
    bgmInterval = null;
}

// 2. 뾱! 뾱! 물방울 터지는 귀여운 지우개 효과음
function playPop() {
    if (!sfxCheck.checked || !audioCtx || audioCtx.state === 'suspended') return;
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.1); // 음이 빠르게 떨어지며 뾱 소리 생성
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(now); osc.stop(now + 0.1);
}

// 3. 뾰로롱~! 마법의 요술봉 정답 효과음 (아르페지오)
function playMagicWand() {
    if (!sfxCheck.checked || !audioCtx || audioCtx.state === 'suspended') return;
    const now = audioCtx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98]; // 위로 올라가는 화음
    
    notes.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        const startTime = now + i * 0.06; // 차르르륵 올라가는 효과
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0.15, startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.4);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(startTime); osc.stop(startTime + 0.4);
    });
}

// ==========================================
// DB 및 앱 초기화 제어
// ==========================================
const DB_NAME = 'EraserKidsDB';
const STORE_NAME = 'imageStore';

function initDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 2);
        req.onupgradeneeded = (e) => {
            if (!e.target.result.objectStoreNames.contains(STORE_NAME)) 
                e.target.result.createObjectStore(STORE_NAME);
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = (e) => reject(e.target.error);
    });
}

async function saveImages(imagesArray) {
    try {
        const db = await initDB();
        return new Promise(resolve => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).put(imagesArray, 'current_session');
            tx.oncomplete = () => resolve();
        });
    } catch(e) {}
}

async function loadImages() {
    try {
        const db = await initDB();
        return new Promise(resolve => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const req = tx.objectStore(STORE_NAME).get('current_session');
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
        });
    } catch(e) { return []; }
}

async function clearImages() {
    try {
        const db = await initDB();
        return new Promise(resolve => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).delete('current_session');
            tx.oncomplete = () => resolve();
        });
    } catch(e) {}
}

window.addEventListener('DOMContentLoaded', async () => {
    images = await loadImages();
    if (images && images.length > 0) {
        setupArea.style.display = 'none';
        startOverlay.style.display = 'flex'; // 자동 로드 시 무조건 터치 유도창 띄움
    }
});

// 터치창을 누르면 오디오 잠금이 완전히 풀리고 게임 화면 시작!
startOverlay.addEventListener('click', () => {
    initAudio();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    startOverlay.style.display = 'none';
    appContainer.style.display = 'flex';
    createNumberTabs();
    playBGM();
    setupStage(0);
});

btnResetImages.addEventListener('click', async () => {
    if(confirm("기존 사진을 지우고 새 사진을 올리시겠습니까?")) {
        await clearImages();
        location.reload();
    }
});

function compressImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                let w = img.width; let h = img.height;
                if (w > h && w > 1200) { h *= 1200 / w; w = 1200; }
                else if (h > w && h > 1200) { w *= 1200 / h; h = 1200; }

                canvas.width = w; canvas.height = h;
                ctx.drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', 0.8));
            };
            img.onerror = () => resolve(null); 
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

imageLoader.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    uploadStatus.innerText = "사진을 저장하고 있습니다. 잠시만 기다려주세요...";
    images = [];

    for (let i = 0; i < files.length; i++) {
        const compressed = await compressImage(files[i]);
        if (compressed) images.push(compressed);
    }
    if (images.length === 0) {
        uploadStatus.innerText = "처리 실패"; return;
    }
    await saveImages(images);
    uploadStatus.innerText = "준비 완료!";
    setTimeout(() => { 
        setupArea.style.display = 'none';
        startOverlay.style.display = 'flex'; // 업로드 직후에도 터치 유도
    }, 500);
});

bgmCheck.addEventListener('change', (e) => {
    if(e.target.checked) playBGM();
    else stopBGM();
});

btnPrev.addEventListener('click', () => { if(currentIdx > 0) setupStage(currentIdx - 1); });
btnNext.addEventListener('click', () => { if(currentIdx < images.length - 1) setupStage(currentIdx + 1); });
document.getElementById('btnRetry').addEventListener('click', () => { setupStage(currentIdx); });
document.getElementById('btnMoreGames').addEventListener('click', () => alert('메인으로 돌아갑니다.'));
btnCheckAnswer.addEventListener('click', revealAnswer);
eraserSizeInput.addEventListener('input', (e) => { eraserSize = parseInt(e.target.value); });

window.addEventListener('resize', () => {
    if(appContainer.style.display === 'flex' && images.length > 0) {
        setupStage(currentIdx);
    }
});

function createNumberTabs() {
    numberSelectors.innerHTML = '';
    for (let i = 0; i < images.length; i++) {
        const btn = document.createElement('div');
        btn.className = 'num-circle';
        btn.innerText = i + 1;
        btn.onclick = () => setupStage(i);
        numberSelectors.appendChild(btn);
    }
}

function setupStage(index) {
    currentIdx = index;
    isAnswerRevealed = false;
    
    imageLabel.innerText = `사진 ${currentIdx + 1}`;
    imageLabel.style.display = 'none';
    
    btnCheckAnswer.style.display = 'inline-block';
    actionButtons.style.display = 'none';
    btnPrev.style.visibility = (currentIdx === 0) ? 'hidden' : 'visible';
    btnNext.style.visibility = (currentIdx === images.length - 1) ? 'hidden' : 'visible';

    document.querySelectorAll('.num-circle').forEach((tab, i) => tab.classList.toggle('active', i === currentIdx));

    const wrapper = document.querySelector('.canvas-wrapper');
    const cw = wrapper.clientWidth; const ch = wrapper.clientHeight;
    imageCanvas.width = cw; imageCanvas.height = ch;
    eraserCanvas.width = cw; eraserCanvas.height = ch;

    const img = new Image();
    img.onload = () => {
        const scale = Math.min(cw / img.width, ch / img.height);
        const w = img.width * scale; const h = img.height * scale;
        const dx = (cw - w) / 2; const dy = (ch - h) / 2;
        
        imageCtx.clearRect(0, 0, cw, ch);
        imageCtx.drawImage(img, dx, dy, w, h);
        
        eraserCtx.globalCompositeOperation = 'source-over';
        eraserCtx.clearRect(0, 0, cw, ch);
        eraserCtx.fillStyle = '#463e30'; 
        eraserCtx.fillRect(dx, dy, w, h);
    };
    img.src = images[currentIdx];
}

function getMousePos(e) {
    const rect = eraserCanvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * (eraserCanvas.width / rect.width), y: (e.clientY - rect.top) * (eraserCanvas.height / rect.height) };
}

function startDrawing(e) {
    if(isAnswerRevealed) return;
    isDrawing = true;
    draw(e);
}

function draw(e) {
    if (!isDrawing || isAnswerRevealed) return;
    const pos = getMousePos(e.touches ? e.touches[0] : e);

    eraserCtx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 15; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * (eraserSize / 2);
        const dotX = pos.x + Math.cos(angle) * radius;
        const dotY = pos.y + Math.sin(angle) * radius;
        const dotSize = Math.random() * (eraserSize / 4) + 2;
        eraserCtx.beginPath();
        eraserCtx.arc(dotX, dotY, dotSize, 0, Math.PI * 2);
        eraserCtx.fill();
    }

    // 0.2초마다 귀여운 뾱 소리 재생
    const now = Date.now();
    if(now - lastSfxTime > 200) {
        playPop();
        lastSfxTime = now;
    }
}

function stopDrawing() { isDrawing = false; }

eraserCanvas.addEventListener('mousedown', startDrawing);
eraserCanvas.addEventListener('mousemove', draw);
window.addEventListener('mouseup', stopDrawing);
eraserCanvas.addEventListener('mouseleave', stopDrawing);
eraserCanvas.addEventListener('touchstart', startDrawing, {passive: false});
eraserCanvas.addEventListener('touchmove', (e) => { e.preventDefault(); draw(e); }, {passive: false});
window.addEventListener('touchend', stopDrawing);

function revealAnswer() {
    isAnswerRevealed = true;
    btnCheckAnswer.style.display = 'none';
    actionButtons.style.display = 'flex';
    imageLabel.style.display = 'block';
    eraserCtx.clearRect(0, 0, eraserCanvas.width, eraserCanvas.height);
    
    // 정답 확인 시 마법의 요술봉 소리 재생
    playMagicWand();
}