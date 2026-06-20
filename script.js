const imageLoader = document.getElementById('imageLoader');
const canvasWrapper = document.getElementById('canvasWrapper');
const imageCanvas = document.getElementById('imageCanvas');
const imageCtx = imageCanvas.getContext('2d', { willReadFrequently: true });
const eraserCanvas = document.getElementById('eraserCanvas');
const eraserCtx = eraserCanvas.getContext('2d', { willReadFrequently: true });
const eraserSizeInput = document.getElementById('eraserSize');
const imageSelector = document.getElementById('imageSelector');
const btnRetry = document.getElementById('btnRetry');
const btnMoreGames = document.getElementById('btnMoreGames');

let images = []; 
let currentImageIndex = 0; 
let isDrawing = false; 
let eraserSize = parseInt(eraserSizeInput.value);

// 좌표 기록용 (선을 부드럽게 긋기 위함)
let lastX = 0;
let lastY = 0;

// 초기 설정
init();

function init() {
    eraserSizeInput.addEventListener('input', (e) => {
        eraserSize = parseInt(e.target.value);
    });

    imageLoader.addEventListener('change', handleImageUpload);
    
    // 다시 하기 버튼 클릭 시 현재 지우개 덮개를 초기화
    btnRetry.addEventListener('click', () => {
        if(images.length > 0) resetEraserCanvas();
    });

    // 게임 더 보기 (예시 기능: 새로고침 또는 다른 페이지 이동)
    btnMoreGames.addEventListener('click', () => {
        alert("다른 게임 페이지로 이동하거나 메뉴를 띄울 수 있습니다.");
    });

    setupEraserEvents();
    
    // 창 크기 변경 시 캔버스 다시 맞추기
    window.addEventListener('resize', () => {
        if(images.length > 0) setupGame(currentImageIndex);
    });
}

function handleImageUpload(e) {
    const files = e.target.files;
    if (files.length === 0) return;

    images = []; 
    imageSelector.innerHTML = ''; // 안내 문구 삭제
    
    let loadedCount = 0;

    for (let i = 0; i < files.length; i++) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                images.push(img);
                loadedCount++;

                if (loadedCount === files.length) {
                    createSelectorButtons();
                    setupGame(0); // 첫 번째 사진 바로 띄우기
                }
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(files[i]);
    }
}

function setupGame(index) {
    if (images.length === 0) return;
    currentImageIndex = index;
    const img = images[index];

    // 래퍼 박스의 실제 크기를 가져옴
    const wrapperWidth = canvasWrapper.clientWidth;
    const wrapperHeight = canvasWrapper.clientHeight;

    // 이미지 비율 유지하면서 래퍼 박스 안에 꽉 차도록 계산
    const scale = Math.min(wrapperWidth / img.width, wrapperHeight / img.height);
    const drawWidth = img.width * scale;
    const drawHeight = img.height * scale;

    // 두 캔버스의 실제 해상도(크기)를 이미지 크기에 맞춤
    imageCanvas.width = drawWidth;
    imageCanvas.height = drawHeight;
    eraserCanvas.width = drawWidth;
    eraserCanvas.height = drawHeight;

    // 1. 원본 이미지 캔버스에 그리기
    imageCtx.clearRect(0, 0, drawWidth, drawHeight);
    imageCtx.drawImage(img, 0, 0, drawWidth, drawHeight);

    // 2. 지우개 덮개 캔버스 초기화
    resetEraserCanvas();
}

function resetEraserCanvas() {
    eraserCtx.globalCompositeOperation = 'source-over'; // 일반 그리기 모드
    eraserCtx.fillStyle = '#616161'; // 숨겨질 회색 레이어 색상
    eraserCtx.fillRect(0, 0, eraserCanvas.width, eraserCanvas.height);
}

function createSelectorButtons() {
    for (let i = 0; i < images.length; i++) {
        const btn = document.createElement('button');
        btn.classList.add('selector-btn');
        btn.innerText = i + 1; 
        
        if (i === 0) btn.classList.add('active');

        btn.addEventListener('click', () => {
            document.querySelector('.selector-btn.active')?.classList.remove('active');
            btn.classList.add('active');
            setupGame(i);
        });
        imageSelector.appendChild(btn);
    }
}

// 지우개 동작 구현
function setupEraserEvents() {
    const start = (e) => {
        isDrawing = true;
        const pos = getMousePos(e);
        lastX = pos.x;
        lastY = pos.y;
        eraseLine(lastX, lastY, lastX, lastY); // 클릭만 해도 점이 지워지도록
    };

    const move = (e) => {
        if (!isDrawing) return;
        e.preventDefault(); // 모바일 스크롤 방지
        const pos = getMousePos(e);
        eraseLine(lastX, lastY, pos.x, pos.y);
        lastX = pos.x;
        lastY = pos.y;
    };

    const end = () => { isDrawing = false; };

    eraserCanvas.addEventListener('mousedown', start);
    eraserCanvas.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);

    eraserCanvas.addEventListener('touchstart', (e) => start(e.touches[0]), {passive: false});
    eraserCanvas.addEventListener('touchmove', (e) => move(e.touches[0]), {passive: false});
    window.addEventListener('touchend', end);
}

// 캔버스 내에서의 정확한 마우스 좌표 계산
function getMousePos(evt) {
    const rect = eraserCanvas.getBoundingClientRect();
    return {
        x: evt.clientX - rect.left,
        y: evt.clientY - rect.top
    };
}

// 부드럽게 이어지는 선으로 지우는 로직 (핵심)
function eraseLine(x1, y1, x2, y2) {
    // 이미지가 있는 캔버스를 투명하게 뚫는 모드
    eraserCtx.globalCompositeOperation = 'destination-out';
    eraserCtx.lineWidth = eraserSize;
    eraserCtx.lineCap = 'round'; // 끝을 둥글게
    eraserCtx.lineJoin = 'round'; // 꺾이는 부분도 둥글게

    eraserCtx.beginPath();
    eraserCtx.moveTo(x1, y1);
    eraserCtx.lineTo(x2, y2);
    eraserCtx.stroke();
}