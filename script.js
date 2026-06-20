// DOM 요소
const setupArea = document.getElementById('setupArea');
const appContainer = document.getElementById('appContainer');
const imageLoader = document.getElementById('imageLoader');
const uploadStatus = document.getElementById('uploadStatus');
const btnInitStart = document.getElementById('btnInitStart');
const btnResetImages = document.getElementById('btnResetImages');

const screens = { start: document.getElementById('startScreen'), game: document.getElementById('gameScreen') };
const btnStartGame = document.getElementById('btnStartGame');
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

// 오디오 요소
const bgm = document.getElementById('bgm');
const sfxErase = document.getElementById('sfxErase');
const sfxSuccess = document.getElementById('sfxSuccess');
const bgmCheck = document.getElementById('bgmCheck');
const sfxCheck = document.getElementById('sfxCheck');

let images = []; // Base64 문자열 저장 배열
let currentIdx = 0;
let isDrawing = false;
let isAnswerRevealed = false;
let lastX = 0; let lastY = 0;
let eraserSize = parseInt(eraserSizeInput.value);

// --- 1. 저장소(LocalStorage) 및 초기화 로직 ---
window.onload = () => {
    const savedImages = localStorage.getItem('eraserGameImages');
    if (savedImages) {
        images = JSON.parse(savedImages);
        skipSetupAndStart();
    }
};

btnResetImages.addEventListener('click', () => {
    if(confirm("저장된 사진을 지우고 새로 올리시겠습니까?")) {
        localStorage.removeItem('eraserGameImages');
        location.reload(); // 페이지 새로고침하여 업로드 화면으로 돌아감
    }
});

// 고해상도 사진의 용량을 획기적으로 줄여주는 압축 함수 (추가된 핵심 로직)
async function compressAndResizeImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // 최대 해상도 제한 (게임 화면이 640px 이므로 1280px이면 아주 충분합니다)
                const MAX_WIDTH = 1280;
                const MAX_HEIGHT = 1280;
                let width = img.width;
                let height = img.height;

                // 비율을 유지하면서 크기 줄이기
                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                
                // 용량을 크게 줄이기 위해 JPEG 포맷, 화질 80%로 압축하여 반환
                const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
                resolve(compressedDataUrl);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

imageLoader.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    uploadStatus.innerText = "고해상도 사진을 압축하고 있습니다... 잠시만 기다려주세요!";
    images = []; 

    // 모든 파일을 하나씩 압축하여 배열에 담기
    for (let i = 0; i < files.length; i++) {
        const compressedImage = await compressAndResizeImage(files[i]);
        images.push(compressedImage);
    }

    try {
        localStorage.setItem('eraserGameImages', JSON.stringify(images));
        uploadStatus.innerText = "압축 및 저장이 완료되었습니다!";
        btnInitStart.style.display = 'inline-block';
    } catch (err) {
        alert("알 수 없는 오류로 저장에 실패했습니다. 사진을 조금 줄여서 다시 시도해주세요.");
        console.error(err);
        localStorage.removeItem('eraserGameImages');
    }
});

btnInitStart.addEventListener('click', skipSetupAndStart);

function skipSetupAndStart() {
    setupArea.style.display = 'none';
    appContainer.style.display = 'flex';
    createNumberTabs();
    totalPageSpan.innerText = images.length;
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

// --- 2. 게임 로직 및 오디오 제어 ---
btnStartGame.addEventListener('click', () => {
    screens.start.style.display = 'none';
    screens.game.style.display = 'flex';
    numberFooter.style.display = 'flex';
    if(bgmCheck.checked) bgm.play().catch(e=>console.log("오디오 자동재생 방지됨"));
    setupStage(0);
});

bgmCheck.addEventListener('change', (e) => { e.target.checked ? bgm.play() : bgm.pause(); });
btnPrev.addEventListener('click', () => { if(currentIdx > 0) setupStage(currentIdx - 1); });
btnNext.addEventListener('click', () => { if(currentIdx < images.length - 1) setupStage(currentIdx + 1); });
btnRetry.addEventListener('click', () => setupStage(currentIdx));
btnMoreGames.addEventListener('click', () => alert('메인 화면으로 돌아갑니다!'));
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
        const w = img.width * scale;
        const h = img.height * scale;
        const dx = (cw - w) / 2;
        const dy = (ch - h) / 2;
        
        imageCtx.clearRect(0, 0, cw, ch);
        imageCtx.drawImage(img, dx, dy, w, h);
        
        eraserCtx.globalCompositeOperation = 'source-over';
        eraserCtx.fillStyle = '#463e30'; 
        eraserCtx.fillRect(0, 0, cw, ch);
    };
    img.src = images[currentIdx];
}

// --- 3. 부드러운 지우개 그리기 ---
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
    const pos = getMousePos(e.touches ? e.touches[0] : e);
    lastX = pos.x; lastY = pos.y;
    eraseLine(lastX, lastY, pos.x, pos.y);
}

function draw(e) {
    if (!isDrawing || isAnswerRevealed) return;
    const pos = getMousePos(e.touches ? e.touches[0] : e);
    eraseLine(lastX, lastY, pos.x, pos.y);
    lastX = pos.x; lastY = pos.y;
    
    if(sfxCheck.checked && sfxErase.paused) {
        sfxErase.currentTime = 0;
        sfxErase.play().catch(()=>{});
    }
}

function stopDrawing() { 
    isDrawing = false; 
}

function eraseLine(x1, y1, x2, y2) {
    eraserCtx.globalCompositeOperation = 'destination-out';
    eraserCtx.lineWidth = eraserSize;
    eraserCtx.lineCap = 'round';
    eraserCtx.lineJoin = 'round';
    eraserCtx.beginPath();
    eraserCtx.moveTo(x1, y1);
    eraserCtx.lineTo(x2, y2);
    eraserCtx.stroke();
}

eraserCanvas.addEventListener('mousedown', startDrawing);
eraserCanvas.addEventListener('mousemove', draw);
window.addEventListener('mouseup', stopDrawing);
eraserCanvas.addEventListener('mouseleave', stopDrawing);
eraserCanvas.addEventListener('touchstart', startDrawing, {passive: false});
eraserCanvas.addEventListener('touchmove', (e) => { e.preventDefault(); draw(e); }, {passive: false});
window.addEventListener('touchend', stopDrawing);

// --- 4. 정답 확인 및 팝업 ---
function revealAnswer() {
    isAnswerRevealed = true;
    btnCheckAnswer.style.display = 'none';
    actionButtons.style.display = 'flex';
    imageLabel.style.display = 'block';
    
    eraserCtx.clearRect(0, 0, eraserCanvas.width, eraserCanvas.height);
    
    if(sfxCheck.checked) {
        sfxSuccess.currentTime = 0;
        sfxSuccess.play();
    }
    
    if (currentIdx === images.length - 1) {
        setTimeout(() => {
            completionPopup.style.display = 'flex';
            setTimeout(() => completionPopup.style.display = 'none', 3000);
        }, 300);
    }
}