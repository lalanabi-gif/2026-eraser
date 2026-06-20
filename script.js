const imageLoader = document.getElementById('imageLoader');
const imageCanvas = document.getElementById('imageCanvas');
const imageCtx = imageCanvas.getContext('2d');
const eraserCanvas = document.getElementById('eraserCanvas');
const eraserCtx = eraserCanvas.getContext('2d');
const eraserSizeInput = document.getElementById('eraserSize');
const imageSelector = document.getElementById('imageSelector');

let images = []; // 업로드된 이미지 객체 배열
let currentImageIndex = 0; // 현재 표시 중인 이미지 인덱스
let isDrawing = false; // 마우스 클릭/터치 여부
let eraserSize = parseInt(eraserSizeInput.value); // 지우개 크기

// 1. 초기 설정
init();

function init() {
    // 지우개 크기 슬라이더 이벤트 등록
    eraserSizeInput.addEventListener('input', (e) => {
        eraserSize = parseInt(e.target.value);
    });

    // 이미지 업로드 이벤트 등록
    imageLoader.addEventListener('change', handleImageUpload);

    // 지우개 동작 이벤트 등록 (마우스 및 터치)
    setupEraserEvents();
}

// 2. 이미지 업로드 처리
function handleImageUpload(e) {
    const files = e.target.files;
    if (files.length === 0) return;

    images = []; // 이전 이미지 배열 초기화
    imageSelector.innerHTML = ''; // 버튼 영역 초기화
    currentImageIndex = 0;

    let loadedCount = 0;

    for (let i = 0; i < files.length; i++) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                images.push(img);
                loadedCount++;

                // 모든 이미지가 로드되면 첫 번째 사진을 화면에 표시하고 버튼 생성
                if (loadedCount === files.length) {
                    // 파일 이름순으로 정렬 (선택 사항, 필요 없으면 주석 처리)
                    images.sort((a, b) => a.src.localeCompare(b.src)); 
                    setupGame(0);
                    createSelectorButtons();
                }
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(files[i]);
    }
}

// 3. 게임 화면 설정 (특정 인덱스의 이미지 표시 및 지우개 레이어 생성)
function setupGame(index) {
    if (images.length === 0) return;
    currentImageIndex = index;
    const img = images[index];

    // 캔버스 크기를 이미지 크기에 맞게 조정 (비율 유지하면서 화면에 맞추는 로직 추가 가능)
    const maxWidth = main.clientWidth - 100; // 지우개 바 공간 제외
    const maxHeight = main.clientHeight - 40;
    
    let width = img.width;
    let height = img.height;

    // 이미지 비율 유지하며 최대 크기 조정
    if (width > maxWidth) {
        height *= maxWidth / width;
        width = maxWidth;
    }
    if (height > maxHeight) {
        width *= maxHeight / height;
        height = maxHeight;
    }

    imageCanvas.width = width;
    imageCanvas.height = height;
    eraserCanvas.width = width;
    eraserCanvas.height = height;

    // 배경 캔버스(imageCanvas)에 원본 이미지 그리기
    imageCtx.drawImage(img, 0, 0, width, height);

    // 지우개 캔버스(eraserCanvas) 초기화 (회색 레이어로 덮음)
    resetEraserCanvas();
}

// 지우개 캔버스를 회색으로 다시 채우는 함수
function resetEraserCanvas() {
    eraserCtx.globalCompositeOperation = 'source-over'; // 기본 그리기 모드로 변경
    eraserCtx.fillStyle = '#888'; // 불투명한 회색
    eraserCtx.fillRect(0, 0, eraserCanvas.width, eraserCanvas.height);
    // 지우기 모드로 설정 (핵심: 그리는 부분이 투명해짐)
    eraserCtx.globalCompositeOperation = 'destination-out'; 
}

// 4. 사진 선택 버튼 생성
function createSelectorButtons() {
    for (let i = 0; i < images.length; i++) {
        const btn = document.createElement('button');
        btn.classList.add('selector-btn');
        btn.innerText = i + 1; // 1부터 시작하는 숫자 표시
        
        if (i === 0) btn.classList.add('active'); // 첫 번째 버튼 활성화

        btn.addEventListener('click', () => {
            // 이전 활성 버튼 비활성화
            const currentActive = document.querySelector('.selector-btn.active');
            if (currentActive) currentActive.classList.remove('active');
            
            // 클릭한 버튼 활성화 및 게임 화면 전환
            btn.classList.add('active');
            setupGame(i);
        });
        imageSelector.appendChild(btn);
    }
}

// 5. 지우개 동작 구현 (마우스 및 터치 이벤트)
function setupEraserEvents() {
    // 마우스 이벤트
    eraserCanvas.addEventListener('mousedown', startDrawing);
    eraserCanvas.addEventListener('mousemove', draw);
    eraserCanvas.addEventListener('mouseup', stopDrawing);
    eraserCanvas.addEventListener('mouseleave', stopDrawing); // 캔버스 밖으로 나갔을 때

    // 터치 이벤트 (모바일 지원)
    eraserCanvas.addEventListener('touchstart', (e) => {
        e.preventDefault(); // 스크롤 방지
        startDrawing(e.touches[0]);
    });
    eraserCanvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        draw(e.touches[0]);
    });
    eraserCanvas.addEventListener('touchend', stopDrawing);
}

function startDrawing(e) {
    isDrawing = true;
    draw(e); // 클릭/터치한 지점 바로 지우기 시작
}

function draw(e) {
    if (!isDrawing) return;

    const rect = eraserCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left; // 캔버스 내 상대 좌표 계산
    const y = e.clientY - rect.top;

    // 지우개 크기에 맞는 원 그리기 (destination-out 모드이므로 이 부분이 투명해짐)
    eraserCtx.beginPath();
    eraserCtx.arc(x, y, eraserSize / 2, 0, Math.PI * 2);
    eraserCtx.fill();
}

function stopDrawing() {
    isDrawing = false;
}