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
let eraserSize = parseInt(eraserSizeInput.value); 
let lastSfxTime = 0;
let audioUnlocked = false;

// --- 오디오 강제 잠금 해제 (Audio Unlocker) ---
// 브라우저 정책상 화면을 한 번 클릭할 때 모든 오디오를 무음으로 잠깐 재생시켜 권한을 획득합니다.
function unlockAudio() {
    if (audioUnlocked) return;
    [bgm, sfxErase, sfxSuccess].forEach(audio => {
        audio.muted = true;
        audio.play().then(() => {
            audio.pause();
            audio.currentTime = 0;
            audio.muted = false;
        }).catch(e => console.warn("오디오 권한 획득 대기 중", e));
    });
    audioUnlocked = true;
    
    // 게임 화면에 들어와 있다면 바로 브금 재생
    if (bgmCheck.checked && appContainer.style.display === 'flex') {
        bgm.play().catch(()=>{});
    }
}
// PC 클릭 및 모바일 터치 시 권한 획득
document.body.addEventListener('click', unlockAudio, { once: true });
document.body.addEventListener('touchstart', unlockAudio, { once: true });

function playBgmSafely() {
    if(bgmCheck.checked && bgm.paused && audioUnlocked) {
        bgm.play().catch(e => console.log(e));
    }
}

// --- 데이터베이스(IndexedDB) ---
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
    } catch (e) { console.warn("DB 저장 차단됨"); }
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
    } catch (e) { console.warn("DB 삭제 차단됨"); }
}

// 초기 세팅
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

// 이미지 압축
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
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
            img.onerror = () => resolve(null); 
            img.src = e.target.result;
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
    });
}

imageLoader.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    uploadStatus.innerText = "사진을 최적화하고 있습니다. 잠시만 기다려주세요...";
    images = [];

    try {
        for (let i = 0; i < files.length; i++) {
            const compressed = await compressImage(files[i]);
            if (compressed) images.push(compressed);
        }
        if (images.length === 0) {
            uploadStatus.innerText = "처리 실패"; return;
        }
        await saveImages(images);
        uploadStatus.innerText = "준비 완료!";
        setTimeout(() => { skipSetupAndStart(); }, 500);
    } catch (error) {
        if (images.length > 0) setTimeout(() => { skipSetupAndStart(); }, 500);
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

// 오디오 체크박스
bgmCheck.addEventListener('change', (e) => { e.target.checked ? playBgmSafely() : bgm.pause(); });

// 버튼 기능
btnPrev.addEventListener('click', () => { playBgmSafely(); if(currentIdx > 0) setupStage(currentIdx - 1); });
btnNext.addEventListener('click', () => { playBgmSafely(); if(currentIdx < images.length - 1) setupStage(currentIdx + 1); });
btnRetry.addEventListener('click', () => { playBgmSafely(); setupStage(currentIdx); });
btnMoreGames.addEventListener('click', () => alert('첫 화면으로 돌아갑니다.'));
btnCheckAnswer.addEventListener('click', revealAnswer);
eraserSizeInput.addEventListener('input', (e) => { eraserSize = parseInt(e.target.value); });

window.addEventListener('resize', () => {
    if(appContainer.style.display === 'flex' && images.length > 0) {
        setupStage(currentIdx);
    }
});

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
    const cw = wrapper.clientWidth;
    const ch = wrapper.clientHeight;
    
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

// 캔버스 마우스 위치 계산
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
    playBgmSafely(); 
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

    // 귀여운 뾱뾱 지우개 효과음! (0.2초 간격으로 재생하여 겹침 방지)
    const now = Date.now();
    if(sfxCheck.checked && audioUnlocked && (now - lastSfxTime > 200)) {
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
        sfxSuccess.play().catch(e => console.log("정답 효과음 재생 오류:", e));
    }
}