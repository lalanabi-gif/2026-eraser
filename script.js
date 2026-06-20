// DOM 요소
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

// --- 1. 대용량 데이터베이스 (IndexedDB) 설정 ---
const DB_NAME = 'EraserKidsDB';
const STORE_NAME = 'imageStore';

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 2);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

async function saveImages(imagesArray) {
    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).put(imagesArray, 'current_session');
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch (e) {
        console.warn("DB 저장 차단됨 (시크릿 모드 등). 현재 창에서는 정상 작동합니다.");
    }
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
    } catch (e) {
        return [];
    }
}

async function clearImages() {
    try {
        const db = await initDB();
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).delete('current_session');
            tx.oncomplete = () => resolve();
        });
    } catch (e) {
        console.warn("DB 삭제 차단됨.");
    }
}

// --- 2. 자동 진입 및 에러 방지 처리된 이미지 압축 로직 ---
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
                
                // 가로/세로 최대 해상도를 800px로 제한하여 용량 초압축
                const MAX_SIZE = 800;
                let w = img.width; let h = img.height;
                if (w > h && w > MAX_SIZE) { h *= MAX_SIZE / w; w = MAX_SIZE; }
                else if (h > w && h > MAX_SIZE) { w *= MAX_SIZE / h; h = MAX_SIZE; }

                canvas.width = w; canvas.height = h;
                ctx.drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', 0.6));
            };
            img.onerror = () => {
                // 이미지가 깨졌거나 읽을 수 없는 포맷일 경우 오류를 무시하고 진행
                console.error("이미지 로드 실패:", file.name);
                resolve(null); 
            };
            img.src = e.target.result;
        };
        reader.onerror = () => {
            console.error("파일 읽기 실패");
            resolve(null);
        };
        reader.readAsDataURL(file);
    });
}

imageLoader.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    uploadStatus.innerText = "아이폰 사진을 처리하고 있습니다. 잠시만 기다려주세요...";
    images = [];

    // 안전장치: 오류가 발생하더라도 멈추지 않고 다음 단계로 무조건 넘어가도록 try-catch 적용
    try {
        for (let i = 0; i < files.length; i++) {
            const compressed = await compressImage(files[i]);
            if (compressed) {
                images.push(compressed);
            }
        }

        if (images.length === 0) {
            uploadStatus.innerText = "사진을 처리하지 못했습니다. 다른 사진으로 시도해주세요.";
            return;
        }

        await saveImages(images);
        uploadStatus.innerText = "준비 완료! 게임 화면으로 넘어갑니다.";
        
        // 0.5초 뒤 무조건 화면 전환
        setTimeout(() => {
            skipSetupAndStart();
        }, 500);

    } catch (error) {
        console.error("업로드 중 에러 발생:", error);
        uploadStatus.innerText = "처리 중 에러가 발생했지만 강제로 진행합니다.";
        // 에러가 나도 이미지가 메모리에 1장이라도 있다면 강제 실행
        if (images.length > 0) {
            setTimeout(() => { skipSetupAndStart(); }, 500);
        }
    }
});

// 백업용 버튼
btnInitStart.addEventListener('click', skipSetupAndStart);

function skipSetupAndStart() {
    setupArea.style.display = 'none';
    appContainer.style.display = 'flex';
    
    createNumberTabs();
    totalPageSpan.innerText = images.length;
    
    if(bgmCheck.checked) {
        bgm.play().catch(() => console.log("사운드 권한 대기 중 (화면을 한 번 클릭하면 소리가 납니다)"));
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
        
        eraserCtx.globalCompositeOperation = 'source-over';
        eraserCtx.fillStyle = '#463e30'; 
        eraserCtx.fillRect(0, 0, cw, ch);
    };
    img.src = images[currentIdx];
}

// --- 4. 점점이 묻어나오는 지우개 효과 로직 ---
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
    
    // 사운드 권한 획득 처리 (최초 클릭 시)
    if(bgmCheck.checked && bgm.paused) {
        bgm.play().catch(()=>{});
    }
    draw(e);
}

function draw(e) {
    if (!isDrawing || isAnswerRevealed) return;
    const pos = getMousePos(e.touches ? e.touches[0] : e);

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

    if(sfxCheck.checked) {
        // 소리가 너무 자주 끊기지 않도록 가볍게 재생
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