/* 주요 로직 요약: IndexedDB를 이용한 무제한 고해상도 저장 & 스티플(Stipple) 지우개 브러시 */

// 1. 대용량 저장소(IndexedDB) 설정
const DB_NAME = 'EraserKidsDB';
const STORE_NAME = 'imageStore';

async function initDB() {
    return new Promise((resolve) => {
        const req = indexedDB.open(DB_NAME, 2);
        req.onupgradeneeded = (e) => e.target.result.createObjectStore(STORE_NAME);
        req.onsuccess = () => resolve(req.result);
    });
}

// 2. 자연스러운 '점점' 지우개 효과 (Brush Logic)
function eraseSpeckled(ctx, x, y, size) {
    ctx.globalCompositeOperation = 'destination-out';
    // 한 번의 클릭/드래그에 여러 개의 작은 점을 무작위로 찍어 자연스러운 질감 표현
    for (let i = 0; i < 15; i++) {
        const offsetX = (Math.random() - 0.5) * size;
        const offsetY = (Math.random() - 0.5) * size;
        const radius = Math.random() * (size / 4);
        ctx.beginPath();
        ctx.arc(x + offsetX, y + offsetY, radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

/* (전체 실행 코드는 아래 프레젠테이션과 함께 파일로 관리하시기 바랍니다) */