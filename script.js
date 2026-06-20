// DOM 요소
const screens = {
    upload: document.getElementById('uploadScreen'),
    start: document.getElementById('startScreen'),
    game: document.getElementById('gameScreen')
};

const imageLoader = document.getElementById('imageLoader');
const uploadStatus = document.getElementById('uploadStatus');
const btnGoToStart = document.getElementById('btnGoToStart');
const btnStartGame = document.getElementById('btnStartGame');

const imageCanvas = document.getElementById('imageCanvas');
const imageCtx = imageCanvas.getContext('2d');
const eraserCanvas = document.getElementById('eraserCanvas');
const eraserCtx = eraserCanvas.getContext('2d');

const btnCheckAnswer = document.getElementById('btnCheckAnswer');
const btnPrev = document.getElementById('btnPrev');
const btnNext = document.getElementById('btnNext');
const imageLabel = document.getElementById('imageLabel');
const headerRight = document.getElementById('headerRight');
const currentPageSpan = document.getElementById('currentPage');
const totalPageSpan = document.getElementById('totalPage');

const finalButtons = document.getElementById('finalButtons');
const completionPopup = document.getElementById('completionPopup');
const btnRetry = document.getElementById('btnRetry');
const btnMoreGames = document.getElementById('btnMoreGames');

// 상태 변수
let images = [];
let currentIdx = 0;
let isDrawing = false;
let isAnswerRevealed = false;
let lastX = 0; let lastY = 0;
const eraserSize = 60; // 지우개 굵기 고정

// 1. 이벤트 리스너 등록
imageLoader.addEventListener('change', handleUpload);
btnGoToStart.addEventListener('click', () => changeScreen('start'));
btnStartGame.addEventListener('click', startGame);
btnCheckAnswer.addEventListener('click', revealAnswer);
btnNext.addEventListener('click', () => navigate(1));
btnPrev.addEventListener('click', () => navigate(-1));
btnRetry.addEventListener('click', resetGame);
btnMoreGames.addEventListener('click', () => alert('메인 화면으로 이동합니다!'));

// 지우개 이벤트
eraserCanvas.addEventListener('mousedown', startDrawing);
eraserCanvas.addEventListener('mousemove', draw);
window.addEventListener('mouseup', stopDrawing);
eraserCanvas.addEventListener('touchstart', (e) => startDrawing(e.touches[0]));
eraserCanvas.addEventListener('touchmove', (e) => { e.preventDefault(); draw(e.touches[0]); }, {passive: false});
window.addEventListener('touchend', stopDrawing);

// 2. 함수 구현
function changeScreen(screenName) {
    screens.upload.style.display = 'none';
    screens.start.style.display = 'none';
    screens.game.style.display = 'none';
    screens[screenName].style.display = 'flex';
}

function handleUpload(e) {
    const files = e.target.files;
    if (files.length === 0) return;

    images = [];
    let loaded = 0;

    for (let i = 0; i < files.length; i++) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                images.push(img);
                loaded++;
                if (loaded === files.length) {
                    uploadStatus.innerText = `${files.length}장의 사진이 준비되었습니다!`;
                    btnGoToStart.style.display = 'inline-block';
                    totalPageSpan.innerText = files.length;
                }
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(files[i]);
    }
}

function startGame() {
    changeScreen('game');
    headerRight.style.display = 'flex';
    currentIdx = 0;
    setupStage();
}

function setupStage() {
    isAnswerRevealed = false;
    const img = images[currentIdx];
    currentPageSpan.innerText = currentIdx + 1;
    imageLabel.innerText = `사진${currentIdx + 1}`;
    imageLabel.style.display = 'none';
    
    // UI 초기화
    btnCheckAnswer.style.display = 'inline-block';
    finalButtons.style.display = 'none';
    btnPrev.style.display = (currentIdx > 0 && isAnswerRevealed) ? 'block' : 'none';
    btnNext.style.display = 'none';

    // 캔버스 크기 고정 (CSS에 맞춤)
    const cw = 600; const ch = 400;
    imageCanvas.width = cw; imageCanvas.height = ch;
    eraserCanvas.width = cw; eraserCanvas.height = ch;

    // 원본 사진 그리기 (비율 유지하여 가운데 정렬)
    const scale = Math.min(cw / img.width, ch / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    const dx = (cw - w) / 2;
    const dy = (ch - h) / 2;
    
    imageCtx.clearRect(0, 0, cw, ch);
    imageCtx.drawImage(img, dx, dy, w, h);

    // 덮개(카키색) 덮기
    eraserCtx.globalCompositeOperation = 'source-over';
    eraserCtx.fillStyle = '#4A4535'; 
    eraserCtx.fillRect(0, 0, cw, ch);
}

// 지우개 로직
function getMousePos(e) {
    const rect = eraserCanvas.getBoundingClientRect();
    const scaleX = eraserCanvas.width / rect.width;
    const scaleY = eraserCanvas.height / rect.height;
    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
    };
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

// 정답 확인 버튼 클릭 시
function revealAnswer() {
    isAnswerRevealed = true;
    
    // 덮개 캔버스 완전히 지우기
    eraserCtx.clearRect(0, 0, eraserCanvas.width, eraserCanvas.height);
    
    // 사진 이름 라벨 띄우기
    imageLabel.style.display = 'block';
    
    // 하단 버튼 변경 및 네비게이션 화살표 처리
    btnCheckAnswer.style.display = 'none';

    if (currentIdx < images.length - 1) {
        // 다음 사진이 남은 경우
        btnNext.style.display = 'block';
        if(currentIdx > 0) btnPrev.style.display = 'block';
    } else {
        // 마지막 사진인 경우 완료 팝업 표출
        showCompletion();
    }
}

function navigate(direction) {
    currentIdx += direction;
    setupStage();
}

function showCompletion() {
    completionPopup.style.display = 'flex';
    setTimeout(() => {
        completionPopup.style.display = 'none';
        finalButtons.style.display = 'block';
        btnPrev.style.display = 'block'; // 이전 사진은 볼 수 있게
    }, 2000); // 2초 뒤 팝업 사라지고 종료 버튼 보임
}

function resetGame() {
    currentIdx = 0;
    setupStage();
}