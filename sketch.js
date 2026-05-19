// ── 取得 HTML 元素 ────────────────────────────────────────
const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('output_canvas');

// 加上 { willReadFrequently: true } 屬性，消除瀏覽器效能警告並優化像素讀取速度
const canvasCtx = canvasElement.getContext('2d', { willReadFrequently: true });
const statusText = document.getElementById('status-text');

// ── 遊戲核心變數與可愛計分系統 ──────────────────────────────
let gameState = "PLAYING"; 
let playerScore = 0;
let aiScore = 0;

let playerChoice = "none"; 
let aiChoice = "none";
let roundResult = "";      
let aiFace = "( 🤖 *•̀ᴗ•́* )"; 

// ── ⏱️ 遊戲手勢計時變數（選單與出拳） ────────────────────────
let gestureStartTime = null;
let currentDetectedGesture = "none"; 
const TRIGGER_DURATION = 1500;       

// ── 🎨 濾鏡變數（全圖風格濾鏡，不需去背） ───────────────────
const FILTERS = ["原始視訊", "日系清新", "復古電影", "懷舊黑白"];
let currentFilterIndex = 0; 

let filterGestureStartTime = null;     
let currentFilterGesture = "none";     
const FILTER_TRIGGER_DURATION = 800;   

// ── 手指骨架連線對照表 ──────────────────────────────────────
const HAND_CONNECTIONS = [
    [0,1], [1,2], [2,3], [3,4],       
    [0,5], [5,6], [6,7], [7,8],       
    [9,10], [10,11], [11,12],         
    [13,14], [14,15], [15,16],        
    [0,17], [17,18], [18,19], [19,20],
    [5,9], [9,13], [13,17]            
];

// ── 1. 兩點距離數學公式（用於 OK 手勢） ──────────────────────
function getDistance(p1, p2) {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

// ── 2. 猜拳勝負判定 ────────────────────────────────────────
function judgeGame(player, ai) {
    if (player === ai) {
        aiFace = "( 🤖 😮 ？！ )";
        return "✨ 平手！再一局！ ✨";
    }
    if (
        (player === "石頭" && ai === "剪刀") ||
        (player === "剪刀" && ai === "布") ||
        (player === "布" && ai === "石頭")
    ) {
        playerScore += 10;
        aiFace = "( 🤖 ＞﹏＜ ) 嗚哇";
        return "⭐ 你贏了！好厲害！ ⭐";
    } else {
        playerScore = Math.max(0, playerScore - 5);
        aiScore += 10;
        aiFace = "( 🤖  ~▽~  ) 耶嘿";
        return "💦 嗚哇...你輸掉了... 💦";
    }
}

function runAiChoice() {
    const choices = ["石頭", "剪刀", "布"];
    return choices[Math.floor(Math.random() * choices.length)];
}

// ── 3. 基礎手勢辨識（回傳字串） ──────────────────────────────
function detectRPS(landmarks) {
    const isIndexOpen  = landmarks[8].y  < landmarks[6].y;
    const isMiddleOpen = landmarks[12].y < landmarks[10].y;
    const isRingOpen   = landmarks[16].y < landmarks[14].y;
    const isPinkyOpen  = landmarks[20].y < landmarks[18].y;

    const openCount = [isIndexOpen, isMiddleOpen, isRingOpen, isPinkyOpen].filter(Boolean).length;

    if (openCount === 4) return "布";
    if (openCount === 2 && isIndexOpen && isMiddleOpen) return "剪刀";
    if (openCount === 0) return "石頭";
    return "none";
}

// ── 4. 遊戲流程手勢：1.5 秒蓄力與集氣條系統 ──────────────────
function handleGestureTiming(landmarks) {
    let detected = "none";

    const rps = detectRPS(landmarks);
    const isIndexOpen  = landmarks[8].y  < landmarks[6].y;
    const isMiddleOpen = landmarks[12].y < landmarks[10].y;
    const isRingOpen   = landmarks[16].y < landmarks[14].y;
    const isPinkyOpen  = landmarks[20].y < landmarks[18].y;
    const thumbIndexDist = getDistance(landmarks[4], landmarks[8]);

    if (gameState === "PLAYING") {
        if (rps !== "none") detected = rps;
    } else if (gameState === "MENU") {
        if (isIndexOpen && !isMiddleOpen && !isRingOpen && isPinkyOpen) {
            detected = "continue";
        } else if (thumbIndexDist < 0.05 && isMiddleOpen && isRingOpen && isPinkyOpen) {
            detected = "end";
        }
    }

    if (detected !== "none") {
        if (currentDetectedGesture !== detected) {
            currentDetectedGesture = detected;
            gestureStartTime = performance.now();
        } else {
            const elapsedTime = performance.now() - gestureStartTime;
            const progress = Math.min(elapsedTime / TRIGGER_DURATION, 1);

            canvasCtx.fillStyle = "rgba(255, 255, 255, 0.95)";
            canvasCtx.lineWidth = 4;
            canvasCtx.strokeStyle = "#4A5568";
            drawRoundRect(canvasCtx, 140, 160, 360, 120, 15, true, true);
            
            canvasCtx.fillStyle = "#E2E8F0";
            drawRoundRect(canvasCtx, 160, 230, 320, 20, 10, true, false);
            
            if (detected === "continue") canvasCtx.fillStyle = "#FF6B6B"; 
            else if (detected === "end") canvasCtx.fillStyle = "#4DABF7";  
            else canvasCtx.fillStyle = "#FF922B";                           
            
            drawRoundRect(canvasCtx, 160, 230, 320 * progress, 20, 10, true, false);

            canvasCtx.fillStyle = "#2D3748";
            canvasCtx.font = "bold 20px 微軟正黑體";
            canvasCtx.textAlign = "center";
            
            let tipText = "";
            if (detected === "continue") tipText = `🤟 繼續遊戲中... ${Math.round(progress * 100)}%`;
            else if (detected === "end") tipText = `👌 結束遊戲中... ${Math.round(progress * 100)}%`;
            else {
                const emoji = detected === "石頭" ? "✊" : detected === "剪刀" ? "✌️" : "🖐️";
                tipText = `🔥 準備出【${emoji} ${detected}】... ${Math.round(progress * 100)}%`;
            }
            canvasCtx.fillText(tipText, 320, 205);

            if (elapsedTime >= TRIGGER_DURATION) {
                gestureStartTime = null; 
                currentDetectedGesture = "none";
                
                if (gameState === "PLAYING") {
                    playerChoice = detected;
                    aiChoice = runAiChoice();
                    roundResult = judgeGame(playerChoice, aiChoice);
                    gameState = "SHOW_RESULT";
                    
                    statusText.innerText = `對決結果：${roundResult}`;
                    setTimeout(() => {
                        gameState = "MENU";
                        statusText.innerText = "請比出 🤟 或 👌 控制選單（或 👈 👉 切換風格）";
                    }, 3000);
                } else if (gameState === "MENU") {
                    if (detected === "continue") {
                        gameState = "PLAYING";
                        aiFace = "( 🤖 *•̀ᴗ•́* )";
                        statusText.innerText = "新一局！請定格出拳 1.5 秒！";
                    } else if (detected === "end") {
                        gameState = "ENDED";
                        statusText.innerText = "遊戲結束囉，下次見！";
                    }
                }
            }
        }
    } else {
        gestureStartTime = null;
        currentDetectedGesture = "none";
    }
}

// ── 5. 👈 與 👉 風格定格切換邏輯（已修正文字與進度條鏡面問題） ────────────────────
function handleFilterSwitchTiming(landmarks) {
    const isIndexOpen  = landmarks[8].y  < landmarks[6].y;
    const isMiddleOpen = landmarks[12].y < landmarks[10].y;
    const isRingOpen   = landmarks[16].y < landmarks[14].y;
    const isPinkyOpen  = landmarks[20].y < landmarks[18].y;

    const isPointing = isIndexOpen && !isMiddleOpen && !isRingOpen && !isPinkyOpen;
    let detectedFrameGesture = "none";

    if (isPointing) {
        if (landmarks[8].x < landmarks[6].x) {
            detectedFrameGesture = "RIGHT"; 
        } else {
            detectedFrameGesture = "LEFT";  
        }
    }

    if (detectedFrameGesture !== "none") {
        if (currentFilterGesture !== detectedFrameGesture) {
            currentFilterGesture = detectedFrameGesture;
            filterGestureStartTime = performance.now();
        } else {
            const elapsedTime = performance.now() - filterGestureStartTime;
            const progress = Math.min(elapsedTime / FILTER_TRIGGER_DURATION, 1);

            // 💡 關鍵修正：暫時把畫布翻轉回來，讓文字與進度條方向正常（不呈現反向鏡面）
            canvasCtx.save();
            canvasCtx.translate(canvasElement.width, 0);
            canvasCtx.scale(-1, 1);

            // 繪製半透明提示框底色
            canvasCtx.fillStyle = "rgba(45, 55, 72, 0.9)";
            canvasCtx.strokeStyle = "#FFFFFF";
            canvasCtx.lineWidth = 2;
            drawRoundRect(canvasCtx, 200, 380, 240, 45, 10, true, true);

            // 繪製進度條外框與動態條
            canvasCtx.fillStyle = "rgba(255, 255, 255, 0.3)";
            drawRoundRect(canvasCtx, 220, 408, 200, 8, 4, true, false);
            canvasCtx.fillStyle = "#4DA5F7"; 
            drawRoundRect(canvasCtx, 220, 408, 200 * progress, 8, 4, true, false);

            // 繪製正常方向的文字說明
            canvasCtx.fillStyle = "#FFFFFF";
            canvasCtx.font = "bold 13px 微軟正黑體";
            canvasCtx.textAlign = "center";
            
            // 符合視覺直覺的方向指引文字
            const dirText = detectedFrameGesture === "RIGHT" ? "👈 指向你的左邊：上一個風格" : "👉 指向你的右邊：下一個風格";
            canvasCtx.fillText(`${dirText} (${Math.round(progress * 100)}%)`, 320, 398);

            // 恢復原本的鏡像狀態，避免影響後續手部關節線條的繪製
            canvasCtx.restore();

            if (elapsedTime >= FILTER_TRIGGER_DURATION) {
                if (detectedFrameGesture === "RIGHT") {
                    currentFilterIndex = (currentFilterIndex + 1) % FILTERS.length;
                } else if (detectedFrameGesture === "LEFT") {
                    currentFilterIndex = (currentFilterIndex - 1 + FILTERS.length) % FILTERS.length;
                }
                statusText.innerText = `🎨 畫面風格已變更 ➔【${FILTERS[currentFilterIndex]}】`;
                
                filterGestureStartTime = null;
                currentFilterGesture = "none";
            }
        }
    } else {
        filterGestureStartTime = null;
        currentFilterGesture = "none";
    }
}

// ── 6. 🎨 全畫面色調濾鏡（徹底移除去背邏輯，效能大提升） ─────────────
function applyFilterEffect() {
    if (FILTERS[currentFilterIndex] === "原始視訊") return; 

    const width = canvasElement.width;
    const height = canvasElement.height;
    
    let imgData = canvasCtx.getImageData(0, 0, width, height);
    let data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
        let r = data[i];
        let g = data[i + 1];
        let b = data[i + 2];

        if (FILTERS[currentFilterIndex] === "日系清新") {
            data[i]     = Math.min(255, r * 1.1 + 15); 
            data[i + 1] = Math.min(255, g * 1.1 + 25); 
            data[i + 2] = Math.min(255, b * 1.2 + 30); 
        } else if (FILTERS[currentFilterIndex] === "復古電影") {
            data[i]     = Math.min(255, r * 1.2 + 10); 
            data[i + 1] = Math.min(255, g * 1.0 + 5);
            data[i + 2] = b * 0.8;                     
        } else if (FILTERS[currentFilterIndex] === "懷舊黑白") {
            let gray = 0.299 * r + 0.587 * g + 0.114 * b;
            data[i]     = gray;
            data[i + 1] = gray;
            data[i + 2] = gray;
        }
    }
    canvasCtx.putImageData(imgData, 0, 0);
}

// ── 7. 可愛圓角畫布 UI 繪製 ────────────────────────────
function drawRoundRect(ctx, x, y, width, height, radius, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
}

function drawUI() {
    canvasCtx.fillStyle = "#FFF4E6";
    canvasCtx.strokeStyle = "#4A5568";
    canvasCtx.lineWidth = 4;
    drawRoundRect(canvasCtx, 15, 15, 610, 55, 15, true, true);
    
    canvasCtx.font = "bold 19px 微軟正黑體";
    canvasCtx.fillStyle = "#FF6B6B";
    canvasCtx.textAlign = "left";
    canvasCtx.fillText(`🌸 你的得分: ${playerScore}`, 35, 48);
    
    canvasCtx.fillStyle = "#4DABF7";
    canvasCtx.textAlign = "right";
    canvasCtx.fillText(`🤖 AI得分: ${aiScore} ${aiFace}`, 605, 48);

    canvasCtx.fillStyle = "rgba(74, 85, 104, 0.85)";
    canvasCtx.strokeStyle = "#FFFFFF";
    canvasCtx.lineWidth = 2;
    drawRoundRect(canvasCtx, 20, 430, 180, 35, 10, true, true);
    canvasCtx.fillStyle = "#FFFFFF";
    canvasCtx.font = "bold 15px 微軟正黑體";
    canvasCtx.textAlign = "center";
    canvasCtx.fillText(`🎨 濾鏡風格: ${FILTERS[currentFilterIndex]}`, 110, 452);

    canvasCtx.textAlign = "center";
    if (gameState === "PLAYING") {
        canvasCtx.fillStyle = "rgba(255, 107, 107, 0.02)";
        canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);
        canvasCtx.fillStyle = "#4A5568";
        canvasCtx.font = "bold 24px 微軟正黑體";
        canvasCtx.fillText("📢 請定格手勢 1.5 秒進行出拳！", 320, 110);
        
    } else if (gameState === "SHOW_RESULT") {
        canvasCtx.fillStyle = "rgba(255, 255, 255, 0.85)";
        canvasCtx.strokeStyle = "#4A5568";
        canvasCtx.lineWidth = 4;
        drawRoundRect(canvasCtx, 100, 110, 440, 180, 20, true, true);

        canvasCtx.fillStyle = "#FF922B";
        canvasCtx.font = "bold 32px 微軟正黑體";
        canvasCtx.fillText(roundResult, 320, 165);

        canvasCtx.fillStyle = "#4A5568";
        canvasCtx.font = "bold 22px 微軟正黑體";
        const pEmoji = playerChoice === "石頭" ? "✊" : playerChoice === "剪刀" ? "✌️" : "🖐️";
        const aEmoji = aiChoice === "石頭" ? "✊" : aiChoice === "剪刀" ? "✌️" : "🖐️";
        canvasCtx.fillText(`你出 ${pEmoji} ${playerChoice}  vs  AI出 ${aEmoji} ${aiChoice}`, 320, 220);
        canvasCtx.font = "16px 微軟正黑體";
        canvasCtx.fillText("( 3 秒後自動彈出選單... )", 320, 265);

    } else if (gameState === "MENU") {
        canvasCtx.fillStyle = "rgba(255, 212, 59, 0.05)";
        canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);
        canvasCtx.fillStyle = "#FF922B";
        canvasCtx.font = "bold 24px 微軟正黑體";
        canvasCtx.fillText("✨ 準備下一局了嗎？ ✨", 320, 110);
        canvasCtx.fillStyle = "#4A5568";
        canvasCtx.font = "bold 18px 微軟正黑體";
        canvasCtx.fillText("🤟 比出 🤟手勢 1.5 秒 ➜ 【繼續玩！】", 320, 145);
        canvasCtx.fillText("👌 比出 OK 手勢 1.5 秒 ➜ 【不玩了】", 320, 175);
        
    } else if (gameState === "ENDED") {
        canvasCtx.fillStyle = "rgba(255, 245, 245, 0.95)";
        canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);
        canvasCtx.fillStyle = "#FF6B6B";
        canvasCtx.font = "bold 45px 微軟正黑體";
        canvasCtx.fillText("🎈 GAME OVER 🎈", 320, 200);
        canvasCtx.fillStyle = "#4A5568";
        canvasCtx.font = "bold 24px 微軟正黑體";
        canvasCtx.fillText(`🎉 恭喜你最後獲得了: ${playerScore} 分！`, 320, 260);
    }
}

// ── 8. MediaPipe 手勢結果回呼（純手勢渲染主迴圈） ───────────────────
function onHandsResults(results) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    // 繪製鏡像的視訊畫面
    canvasCtx.translate(canvasElement.width, 0);
    canvasCtx.scale(-1, 1);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
    
    // 執行全圖風格濾鏡
    applyFilterEffect();
    
    // 檢查是否有抓到手
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];

        // 處理濾鏡切換邏輯（內含防止進度條文字鏡面的局部翻轉處理）
        handleFilterSwitchTiming(landmarks);

        // 繪製手部骨架連線
        canvasCtx.strokeStyle = "#FF8787";
        canvasCtx.lineWidth = 4;
        for (const connection of HAND_CONNECTIONS) {
            const start = landmarks[connection[0]];
            const end = landmarks[connection[1]];
            canvasCtx.beginPath();
            canvasCtx.moveTo(start.x * canvasElement.width, start.y * canvasElement.height);
            canvasCtx.lineTo(end.x * canvasElement.width, end.y * canvasElement.height);
            canvasCtx.stroke();
        }

        // 繪製手部關節點
        canvasCtx.fillStyle = "#CCFF00";
        for (let i = 0; i < landmarks.length; i++) {
            const x = landmarks[i].x * canvasElement.width;
            const y = landmarks[i].y * canvasElement.height;
            canvasCtx.beginPath();
            canvasCtx.arc(x, y, 6, 0, 2 * Math.PI);
            canvasCtx.fill();
        }

        canvasCtx.restore();

        // 執行出拳與選單計時邏輯
        if (gameState === "PLAYING" || gameState === "MENU") {
            handleGestureTiming(landmarks);
        }
    } else {
        canvasCtx.restore();
        gestureStartTime = null;
        currentDetectedGesture = "none";
        filterGestureStartTime = null;
        currentFilterGesture = "none";
    }

    // 覆蓋 UI 文字和計分板
    drawUI();
}

// ── 9. 初始化手勢模型與相機 ─────────────────────────────────────
const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});
hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7
});
hands.onResults(onHandsResults);

// 初始化相機控制（僅傳送資料給 hands 模型）
const camera = new Camera(videoElement, {
    onFrame: async () => {
        await hands.send({ image: videoElement });
    },
    width: 640,
    height: 480
});

camera.start().then(() => {
    statusText.innerText = "✨ 系統初始化成功！定格手勢 1.5 秒即可出拳猜拳！";
}).catch(err => {
    statusText.innerText = "攝影機啟動失敗: " + err;
});