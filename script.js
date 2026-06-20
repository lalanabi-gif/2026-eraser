const screens = {
    upload: document.getElementById('uploadScreen'),
    start: document.getElementById('startScreen'),
    game: document.getElementById('gameScreen')
};

const imageLoader = document.getElementById('imageLoader');
const uploadStatus = document.getElementById('uploadStatus');
const btnGoToStart = document.getElementById('btnGoToStart');
const btnStartGame = document.getElementById('btnStartGame');

const canvasWrapper = document.getElementById('canvasWrapper');
const imageCanvas = document.getElementById('imageCanvas');
const imageCtx = imageCanvas.getContext('2d', { willReadFrequently: true });
const eraserCanvas = document.getElementById('eraserCanvas');
const eraserCtx = eraserCanvas.getContext('2d', { willReadFrequently: true });

const btnCheckAnswer = document.getElementById('btnCheckAnswer');
const imageLabel = document.getElementById('imageLabel');
const headerRight = document.getElementById('headerRight');
const currentPageSpan = document.getElementById('currentPage');
const totalPageSpan = document.getElementById('totalPage');

const numberSelectors = document.getElementById('numberSelectors');
const btnRetry = document.getElementById('btnRetry');
const btnMoreGames = document.getElementById('btnMoreGames');
const completionPopup = document.getElementById('completionPopup');

let images = [];
let currentIdx = 0;
let isDrawing = false;
let isAnswerRevealed = false;
let lastX = 0; let lastY = 0;
const eraserSize = 70; // 큼직한 지우개 크기

// 1. 이벤트 등록
imageLoader.addEventListener('change', handleUpload);
btnGoToStart.addEventListener('click', () => changeScreen('start'));
btnStartGame.addEventListener('click', startGame);
btnCheckAnswer.addEventListener('click', revealAnswer);
btnRetry.addEventListener('click', () => setupStage(currentIdx)); // 현재 스테이지 다시하기
btnMoreGames.addEventListener('click', () => alert('다른 게임도 준비 중이에요!'));

// 지우개 터치 및 마우스 이벤트
eraserCanvas.addEventListener('mousedown', startDrawing);
eraserCanvas.addEventListener('mousemove', draw);
window.addEventListener('mouseup', stopDrawing);
eraserCanvas.addEventListener('touchstart', (e) => startDrawing(e.touches[0]));
eraserCanvas.addEventListener('touchmove', (e) => { e.preventDefault(); draw(e.touches[0]); }, {passive: false});
window.addEventListener('touchend', stopDrawing);

// 화면 크기가 변할 때 캔버스 크기 재조정
window.addEventListener('resize', () => {
    if(screens.game.style.display === 'flex' && images.length > 0) {
        setupStage(currentIdx);
    }
});

// 2. 함수
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
    numberSelectors.innerHTML = ''; // 기존 숫자 버튼 초기화

    for (let i = 0; i < files.length; i++) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                images.push(img);
                loaded++;
                
                // 숫자 버튼 생성
                const btn = document.createElement('button');
                btn.className = 'num-btn';
                btn.innerText = i + 1;
                btn.onclick = () => setupStage(i);
                numberSelectors.appendChild(btn);

                if (loaded === files.length) {
                    uploadStatus.innerText = `우와! ${files.length}장의 사진이 준비됐어요!`;
                    btnGoToStart.style.display = 'block';
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
    setupStage(0);
}

function setupStage(index) {
    currentIdx = index;
    isAnswerRevealed = false;
    const img = images[currentIdx];
    
    // UI 업데이트
    currentPageSpan.innerText = currentIdx + 1;
    imageLabel.innerText = `사진 ${currentIdx + 1}`;
    imageLabel.style.display = 'none';
    btnCheckAnswer.style.display = 'inline-block';
    
    // 하단 숫자 버튼 활성화 상태 업데이트
    const numBtns = document.querySelectorAll('.num-btn');
    numBtns.forEach((btn, i) => {
        btn.classList.toggle('active', i === currentIdx);
    });

    // 캔버스 크기를 래퍼(화면)에 꽉 차게 동적 계산
    const wrapperW = canvasWrapper.clientWidth;
    const wrapperH = canvasWrapper.clientHeight;
    
    imageCanvas.width = wrapperW; imageCanvas.height = wrapperH;
    eraserCanvas.width = wrapperW; eraserCanvas.height = wrapperH;

    // 사진을 캔버스 비율에 맞게 최대한 크게 그리기 (비율 유지)
    const scale = Math.min(wrapperW / img.width, wrapperH / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    const dx = (wrapperW - w) / 2;
    const dy = (wrapperH - h) / 2;
    
    imageCtx.clearRect(0, 0, wrapperW, wrapperH);
    imageCtx.drawImage(img, dx, dy, w, h);

    // 가림막(카키/다크브라운 톤) 덮기
    eraserCtx.globalCompositeOperation = 'source-over';
    eraserCtx.fillStyle = '#6D4C41'; 
    eraserCtx.fillRect(0, 0, wrapperW, wrapperH);
}

// 마우스/터치 좌표를 캔버스 내부 좌표로 변환
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

function revealAnswer() {
    isAnswerRevealed = true;
    btnCheckAnswer.style.display = 'none';
    imageLabel.style.display = 'block'; // 사진 이름 짠! 나타나기
    
    // 가림막 지우기 (애니메이션 효과)
    let opacity = 1;
    const fadeOut = setInterval(() => {
        opacity -= 0.1;
        if(opacity <= 0) {
            clearInterval(fadeOut);
            eraserCtx.clearRect(0, 0, eraserCanvas.width, eraserCanvas.height);
            
            // 마지막 문제일 경우 팝업 띄우기
            if (currentIdx === images.length - 1) {
                setTimeout(() => {
                    completionPopup.style.display = 'flex';
                    setTimeout(() => completionPopup.style.display = 'none', 3000); // 3초 뒤 팝업 닫힘
                }, 500);
            }
        } else {
            eraserCtx.globalCompositeOperation = 'destination-out';
            eraserCtx.fillStyle = `rgba(255,255,255,0.1)`;
            eraserCtx.fillRect(0,0,eraserCanvas.width, eraserCanvas.height);
        }
    }, 30);
}