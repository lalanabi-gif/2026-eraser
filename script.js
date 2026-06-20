// DOM 요소
const setupArea = document.getElementById('setupArea');
const appContainer = document.getElementById('appContainer');
const imageLoader = document.getElementById('imageLoader');
const uploadStatus = document.getElementById('uploadStatus');
const btnInitStart = document.getElementById('btnInitStart');
const btnResetImages = document.getElementById('btnResetImages');

const gameScreen = document.getElementById('gameScreen');
const imageCanvas = document.getElementById('imageCanvas');
const imageCtx = imageCanvas.getContext('2d');
const eraserCanvas = document.getElementById('eraserCanvas');
const eraserCtx = eraserCanvas.getContext('2d', { willReadFrequently: true });

const btnCheckAnswer = document.getElementById('btnCheckAnswer');
const actionButtons = document.getElementById('actionButtons');
const imageLabel = document.getElementById('imageLabel');
const btnPrev = document.getElementById('btnPrev');
const btnNext = document.getElementById('btnNext');
const currentPageSpan = document.getElementById('currentPage');
const totalPageSpan = document.getElementById('totalPage');

const eraserSizeInput = document.getElementById('eraserSize');
const numberFooter = document.getElementById('numberFooter');
const numberSelectors = document.getElementById('numberSelectors');
const completionPopup = document.getElementById('completionPopup');
const btnRetry = document.getElementById('btnRetry');
const btnMoreGames = document.getElementById('btnMoreGames');

// 오디오 객체
const bgm = document.getElementById('bgm');
const sfxErase = document.getElementById('sfxErase');
const sfxSuccess = document.getElementById('sfxSuccess');
const bgmCheck = document.getElementById('bgmCheck');
const sfxCheck = document.getElementById('sfxCheck');

let images = []; 
let currentIdx = 0;
let isDrawing = false;
let isAnswerRevealed = false;
let lastX = 0; let lastY = 0;
let eraserSize = parseInt(eraserSizeInput.value);

// --- 1. 대용량 캔바 연동 데이터베이스 (IndexedDB) 정의 ---
const DB_NAME = 'EraserKidsDB';
const STORE_NAME = 'imageStore';

function initDB() {
    return new Promise((resolve) => {
        const request = indexedDB.open(DB_NAME, 2);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
    });
}

async function saveImages(imagesArray) {
    const db = await initDB();
    return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(imagesArray, 'current_session');
        tx.oncomplete = () => resolve();
    });
}

async function loadImages() {
    const db = await initDB();
    return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get('current_session');
        req.onsuccess = () => resolve(req.result || []);
    });
}

async function clearImages() {
    const db = await initDB();
    return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete('current_session');
        tx.oncomplete = () => resolve();
    });
}

// --- 2. 자동 진입 및 고해상도 아이폰 사진 압축 로직 ---
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
                
                // 가로/세로 최대 해상도를 800px로 제한하여 아이폰 사진 용량을 1/50로 초압축
                const MAX_SIZE = 800;
                let w = img.width; let h = img.height;
                if (w > h && w > MAX_SIZE) { h *= MAX_SIZE / w; w = MAX_SIZE; }
                else if (h > w && h > MAX_SIZE) { w *= MAX_SIZE / h; h = MAX_SIZE; }

                canvas.width = w; canvas.height = h;
                ctx.drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', 0.6)); // 압축률 설정
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

imageLoader.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    uploadStatus.innerText = "아이폰 고해상도 사진을 압축 저장 중입니다...";
    images = [];

    // 루프를 돌며 업로드 순서 그대로 차례차례 압축 처리
    for (let i = 0; i < files.length; i++) {
        const compressed = await compressImage(files[i]);
        images.push(compressed);
    }

    await saveImages(images);
    uploadStatus.innerText = "준비 완료! 게임 화면으로 넘어갑니다.";
    
    // 업로드가 끝나면 버튼 누를 필요 없이 즉시 자동 시작구동!
    setTimeout(() => {
        skipSetupAndStart();
    }, 800);
});

btnInitStart.addEventListener('click', skipSetupAndStart);

function skipSetupAndStart() {
    setupArea.style.display = 'none';
    appContainer.style.display = 'flex';
    
    createNumberTabs();
    totalPageSpan.innerText = images.length;
    
    // 자동 배경음 구동 시작
    if(bgmCheck.checked) {
        bgm.play().catch(() => console.log("자동재생 방지로 클릭 후 재생됨"));
    }
    setupStage(0);
}

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

// --- 3. 스테이지 및 조작 제어 ---
bgmCheck.addEventListener('change', (e) => { e.target.checked ? bgm.play() : bgm.pause(); });
btnPrev.addEventListener('click', () => { if(currentIdx > 0) setupStage(currentIdx - 1); });
btnNext.addEventListener('click', () => { if(currentIdx < images.length - 1) setupStage(currentIdx + 1); });
btnRetry.addEventListener('click', () => setupStage(currentIdx));
btnMoreGames.addEventListener('click', () => alert('첫 화면으로 돌아갑니다.'));
btnCheckAnswer.addEventListener('click', revealAnswer);
eraserSizeInput.addEventListener('input', (e) => { eraserSize = parseInt(e.target.value); });

function setupStage(index) {
    currentIdx = index;
    isAnswerRevealed = false;
    
    currentPageSpan.innerText = currentIdx + 1;
    imageLabel.innerText = `사진 ${currentIdx + 1}`;
    imageLabel.style.display = 'none';
    
    btnCheckAnswer.style.display = 'inline-block';
    actionButtons.style.display = 'none';
    btnPrev.style.visibility = (currentIdx === 0) ? 'hidden' : 'visible';
    btnNext.style.visibility = (currentIdx === images.length - 1) ? 'hidden' : 'visible';

    document.querySelectorAll('.num-circle').forEach((tab, i) => tab.classList.toggle('active', i === currentIdx));

    const cw = 640; const ch = 420;
    imageCanvas.width = cw; imageCanvas.height = ch;
    eraserCanvas.width = cw; eraserCanvas.height = ch;

    const img = new Image();
    img.onload = () => {
        const scale = Math.min(cw / img.width, ch / img.height);
        const w = img.width * scale; const h = img.height * scale;
        const dx = (cw - w) / 2; const dy = (ch - h) / 2;
        
        imageCtx.clearRect(0, 0, cw, ch);
        imageCtx.drawImage(img, dx, dy, w, h);
        
        // 가림막 (짙은 갈색)
        eraserCtx.globalCompositeOperation = 'source-over';
        eraserCtx.fillStyle = '#463e30'; 
        eraserCtx.fillRect(0, 0, cw, ch);
    };
    img.src = images[currentIdx];
}

// --- 4. 점점이 묻어나오는 지우개 효과 로직 (동영상 스타일) ---
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
    draw(e);
}

function draw(e) {
    if (!isDrawing || isAnswerRevealed) return;
    const pos = getMousePos(e.touches ? e.touches[0] : e);

    // 완벽한 선 대신, 동영상처럼 작은 구멍이 숭숭 뚫리는 점 패턴 방식 브러시 구현
    eraserCtx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 12; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * (eraserSize / 2);
        const dotX = pos.x + Math.cos(angle) * radius;
        const dotY = pos.y + Math.sin(angle) * radius;
        const dotSize = Math.random() * (eraserSize / 5) + 2;

        eraserCtx.beginPath();
        eraserCtx.arc(dotX, dotY, dotSize, 0, Math.PI * 2);
        eraserCtx.fill();
    }

    if(sfxCheck.checked && sfxErase.paused) {
        sfxErase.currentTime = 0;
        sfxErase.play().catch(()=>{});
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

// --- 5. 정답 확인 및 성공 연출 ---
function revealAnswer() {
    isAnswerRevealed = true;
    btnCheckAnswer.style.display = 'none';
    actionButtons.style.display = 'flex';
    imageLabel.style.display = 'block';
    
    eraserCtx.clearRect(0, 0, eraserCanvas.width, eraserCanvas.height);
    
    if(sfxCheck.checked) {
        sfxSuccess.currentTime = 0;
        sfxSuccess.play().catch(()=>{});
    }
    
    if (currentIdx === images.length - 1) {
        setTimeout(() => {
            completionPopup.style.display = 'flex';
            setTimeout(() => completionPopup.style.display = 'none', 2500);
        }, 300);
    }
}