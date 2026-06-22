const setupArea = document.getElementById('setupArea');
const appContainer = document.getElementById('appContainer');
const imageLoader = document.getElementById('imageLoader');
const uploadStatus = document.getElementById('uploadStatus');
const btnInitStart = document.getElementById('btnInitStart');
const btnResetImages = document.getElementById('btnResetImages');

const gameScreen = document.getElementById('gameScreen');
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
const btnRetry = document.getElementById('btnRetry');
const btnMoreGames = document.getElementById('btnMoreGames');

const bgm = document.getElementById('bgm');
const sfxErase = document.getElementById('sfxErase');
const sfxSuccess = document.getElementById('sfxSuccess');
const bgmCheck = document.getElementById('bgmCheck');
const sfxCheck = document.getElementById('sfxCheck');

let images = []; 
let currentIdx = 0;
let isDrawing = false;
let isAnswerRevealed = false;
let eraserSize = 150; // 지우개 기본 크기 최대치 고정
let lastSfxTime = 0;
let audioUnlocked = false;

// --- 브라우저 오디오 권한 강제 해제 장치 ---
function unlockAudio() {
    if (audioUnlocked) return;
    [bgm, sfxErase, sfxSuccess].forEach(audio => {
        audio.muted = true;
        audio.play().then(() => {
            audio.pause();
            audio.currentTime = 0;
            audio.muted = false;
        }).catch(e => console.warn("오디오 대기 중"));
    });
    audioUnlocked = true;
    
    if (bgmCheck.checked && appContainer.style.display === 'flex') {
        bgm.play().catch(()=>{});
    }
}
// 선생님이나 아이들이 화면을 최초로 터치/클릭하는 순간 오디오 잠금 해제!
document.body.addEventListener('pointerdown', unlockAudio, { once: true });

function playBgmSafely() {
    if(bgmCheck.checked && bgm.paused && audioUnlocked) {
        bgm.play().catch(()=>{});
    }
}

// --- 데이터베이스 ---
const DB_NAME = 'EraserKidsDB';
const STORE_NAME = 'imageStore';

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 2);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

async function saveImages(imagesArray) {
    try {
        const db = await initDB();
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).put(imagesArray, 'current_session');
            tx.oncomplete = () => resolve();
        });
    } catch (e) {}
}

async function loadImages() {
    try {
        const db = await initDB();
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const req = tx.objectStore(STORE_NAME).get('current_session');
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
        });
    } catch (e) { return []; }
}

async function clearImages() {
    try {
        const db = await initDB();
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).delete('current_session');
            tx.oncomplete = () => resolve();
        });
    } catch (e) {}
}

window.addEventListener('DOMContentLoaded', async () => {
    images = await loadImages();
    if (images && images.length > 0) {
        skipSetupAndStart();
    }
});

btnResetImages.addEventListener('click', async () => {
    if(confirm("기존 사진을 지우고 새 사진을 업로드하시겠습니까?")) {
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
                const MAX_SIZE = 1024; 
                let w = img.width; let h = img.height;
                if (w > h && w > MAX_SIZE) { h *= MAX_SIZE / w; w = MAX_SIZE; }
                else if (h > w && h > MAX_SIZE) { w *= MAX_SIZE / h; h = MAX_SIZE; }

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

// 업로드 이벤트
imageLoader.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    uploadStatus.innerText = "사진을 설정하고 있습니다...";
    images = [];

    for (let i = 0; i < files.length; i++) {
        const compressed = await compressImage(files[i]);
        if (compressed) images.push(compressed);
    }

    if (images.length > 0) {
        saveImages(images); 
        uploadStatus.innerText = "준비 완료!";
        // 사진이 압축되자마자 0.2초 뒤 무조건 게임 화면으로 전환되도록 강제
        setTimeout(() => { skipSetupAndStart(); }, 200);
    } else {
        uploadStatus.innerText = "처리 실패. 다른 사진을 올려주세요.";
    }
});

btnInitStart.addEventListener('click', skipSetupAndStart);

function skipSetupAndStart() {
    setupArea.style.display = 'none';
    appContainer.style.display = 'flex';
    createNumberTabs();
    playBgmSafely(); 
    setupStage(0);
}

function createNumberTabs() {
    numberSelectors.innerHTML = '';
    for (let i = 0; i < images.length; i++) {
        const btn = document.createElement('div');
        btn.className = 'num-circle';
        btn.innerText = i + 1;
        btn.onclick = () => { playBgmSafely(); setupStage(i); };
        numberSelectors.appendChild(btn);
    }
}

bgmCheck.addEventListener('change', (e) => { e.target.checked ? playBgmSafely() : bgm.pause(); });
btnPrev.addEventListener('click', () => { playBgmSafely(); if(currentIdx > 0) setupStage(currentIdx - 1); });
btnNext.addEventListener('click', () => { playBgmSafely(); if(currentIdx < images.length - 1) setupStage(currentIdx + 1); });
btnRetry.addEventListener('click', () => { playBgmSafely(); setupStage(currentIdx); });
btnMoreGames.addEventListener('click', () => alert('첫 화면으로 돌아갑니다.'));
btnCheckAnswer.addEventListener('click', revealAnswer);
eraserSizeInput.addEventListener('input', (e) => { eraserSize = parseInt(e.target.value); });

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

    // 화면 비율 붕괴 및 사진 안보임 완벽 해결 코드 (고정 해상도 사용)
    const cw = 800;
    const ch = 500;
    
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
    return {
        x: (e.clientX - rect.left) * (eraserCanvas.width / rect.width),
        y: (e.clientY - rect.top) * (eraserCanvas.height / rect.height)
    };
}

function startDrawing(e) {
    if(isAnswerRevealed) return;
    isDrawing = true;
    unlockAudio(); // 지우개 터치 시 오디오 강제 해제
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

    // 샤사라랑~ 마법 가루 효과음 재생! (0.3초 쿨타임으로 소리가 예쁘게 이어짐)
    const now = Date.now();
    if(sfxCheck.checked && audioUnlocked && (now - lastSfxTime > 300)) {
        sfxErase.currentTime = 0;
        sfxErase.play().catch(()=>{});
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
    
    // 정답 확인 시 요술봉 뾰로롱 효과음!
    if(sfxCheck.checked && audioUnlocked) {
        sfxSuccess.currentTime = 0;
        sfxSuccess.play().catch(()=>{});
    }
}