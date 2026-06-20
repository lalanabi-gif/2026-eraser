const setupArea = document.getElementById('setupArea');
const appContainer = document.getElementById('appContainer');
const imageLoader = document.getElementById('imageLoader');
const btnInitStart = document.getElementById('btnInitStart');

const screens = {
    start: document.getElementById('startScreen'),
    game: document.getElementById('gameScreen')
};

const btnStartGame = document.getElementById('btnStartGame');
const canvasWrapper = document.querySelector('.canvas-wrapper');
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

let images = [];
let currentIdx = 0;
let isDrawing = false;
let isAnswerRevealed = false;
let lastX = 0; let lastY = 0;
let eraserSize = parseInt(eraserSizeInput.value);

// 1. 초기 사진 업로드 이벤트
imageLoader.addEventListener('change', (e) => {
    const files = e.target.files;
    if (files.length === 0) return;

    images = [];
    numberSelectors.innerHTML = ''; 
    let loaded = 0;

    for (let i = 0; i < files.length; i++) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                images.push(img);
                loaded++;
                
                // 하단 사진 선택 탭 생성
                const btn = document.createElement('button');
                btn.className = 'num-tab';
                btn.innerText = `${i + 1} 사진`;
                btn.onclick = () => setupStage(i);
                numberSelectors.appendChild(btn);

                if (loaded === files.length) {
                    btnInitStart.style.display = 'inline-block';
                    totalPageSpan.innerText = files.length;
                }
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(files[i]);
    }
});

btnInitStart.addEventListener('click', () => {
    setupArea.style.display = 'none';
    appContainer.style.display = 'flex';
});

// 2. 게임 제어 이벤트
btnStartGame.addEventListener('click', () => {
    screens.start.style.display = 'none';
    screens.game.style.display = 'flex';
    numberFooter.style.display = 'flex';
    setupStage(0);
});

btnPrev.addEventListener('click', () => { if(currentIdx > 0) setupStage(currentIdx - 1); });
btnNext.addEventListener('click', () => { if(currentIdx < images.length - 1) setupStage(currentIdx + 1); });
btnRetry.addEventListener('click', () => setupStage(currentIdx));
btnMoreGames.addEventListener('click', () => alert('메인 화면으로 돌아갑니다!'));
btnCheckAnswer.addEventListener('click', revealAnswer);

eraserSizeInput.addEventListener('input', (e) => {
    eraserSize = parseInt(e.target.value);
});

// 지우개 그리기 이벤트
eraserCanvas.addEventListener('mousedown', startDrawing);
eraserCanvas.addEventListener('mousemove', draw);
window.addEventListener('mouseup', stopDrawing);
eraserCanvas.addEventListener('touchstart', (e) => startDrawing(e.touches[0]));
eraserCanvas.addEventListener('touchmove', (e) => { e.preventDefault(); draw(e.touches[0]); }, {passive: false});
window.addEventListener('touchend', stopDrawing);

// 3. 주요 로직 함수
function setupStage(index) {
    currentIdx = index;
    isAnswerRevealed = false;
    const img = images[currentIdx];
    
    // UI 텍스트 및 버튼 표시 상태 변경
    currentPageSpan.innerText = currentIdx + 1;
    imageLabel.innerText = `사진${currentIdx + 1}`;
    imageLabel.style.display = 'none';
    document.querySelector('.plus-btn').style.display = 'none';
    
    btnCheckAnswer.style.display = 'inline-block';
    actionButtons.style.display = 'none';
    
    // 좌우 화살표 가시성
    btnPrev.style.visibility = (currentIdx === 0) ? 'hidden' : 'visible';
    btnNext.style.visibility = (currentIdx === images.length - 1) ? 'hidden' : 'visible';

    // 하단 탭 활성화 상태 변경
    const tabs = document.querySelectorAll('.num-tab');
    tabs.forEach((tab, i) => tab.classList.toggle('active', i === currentIdx));

    // 캔버스 크기를 고정 컨테이너(600x400)에 맞춤
    const cw = 600; const ch = 400;
    imageCanvas.width = cw; imageCanvas.height = ch;
    eraserCanvas.width = cw; eraserCanvas.height = ch;

    // 사진 비율 맞춰서 그리기
    const scale = Math.min(cw / img.width, ch / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    const dx = (cw - w) / 2;
    const dy = (ch - h) / 2;
    
    imageCtx.clearRect(0, 0, cw, ch);
    imageCtx.drawImage(img, dx, dy, w, h);

    // 짙은 갈색 가림막 덮기 (영상과 동일한 색상)
    eraserCtx.globalCompositeOperation = 'source-over';
    eraserCtx.fillStyle = '#463e30'; 
    eraserCtx.fillRect(0, 0, cw, ch);
}

function getMousePos(e) {
    const rect = eraserCanvas.getBoundingClientRect();
    const scaleX = eraserCanvas.width / rect.width;
    const scaleY = eraserCanvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
}

function startDrawing(e) {
    if(isAnswerRevealed) return;
    isDrawing = true;
    const pos = getMousePos(e);
    lastX = pos.x; lastY = pos.y;
    eraseLine(lastX, lastY, lastX, lastY);
}

function draw(e) {
    if (!isDrawing || isAnswerRevealed) return;
    const pos = getMousePos(e);
    eraseLine(lastX, lastY, pos.x, pos.y);
    lastX = pos.x; lastY = pos.y;
}

function stopDrawing() { isDrawing = false; }

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

function revealAnswer() {
    isAnswerRevealed = true;
    
    // 버튼 전환 및 라벨 표시
    btnCheckAnswer.style.display = 'none';
    actionButtons.style.display = 'flex';
    imageLabel.style.display = 'block';
    document.querySelector('.plus-btn').style.display = 'block';
    
    // 가림막 지우기
    eraserCtx.clearRect(0, 0, eraserCanvas.width, eraserCanvas.height);
    
    // 마지막 사진인 경우 팝업 띄우기
    if (currentIdx === images.length - 1) {
        setTimeout(() => {
            completionPopup.style.display = 'flex';
            setTimeout(() => completionPopup.style.display = 'none', 2500);
        }, 300);
    }
}