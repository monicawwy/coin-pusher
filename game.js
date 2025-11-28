const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: window.innerWidth > 600 ? 600 : window.innerWidth,
    height: window.innerHeight * 0.75,
    backgroundColor: '#003300', // 深綠底色
    physics: {
        default: 'matter',
        matter: {
            gravity: { y: 1 }, // 正向重力
            debug: false // 開發除錯用，發布時設為 false
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

const game = new Phaser.Game(config);

// 遊戲物件變數
let upperPusher;
let lowerPusher;
let coins = [];
let isSpinning = false;

// 參數設定
const COIN_SIZE = 24; 
const PUSHER_SPEED = 0.002; // 推板移動速度頻率
const PUSHER_AMP = 60; // 推板移動幅度

function preload() {
    // 使用程式繪圖，無需外部圖片
}

function create() {
    const width = this.game.config.width;
    const height = this.game.config.height;
    const centerX = width / 2;

    // 設定世界邊界 (左右有牆，底部開放)
    this.matter.world.setBounds(0, -1000, width, height + 1000);

    // ============================================================
    // 1. 建立 "靜態地板" (Static Floors) - 銀仔是放在這上面的
    // ============================================================
    
    // --- 上層地板 (窄) ---
    // 位於畫面上方，負責接住 Slot 掉下來的錢
    const upperFloorWidth = width * 0.5; 
    const upperFloorY = height * 0.3;
    // 建立物理實體 (Static)
    const upperFloor = this.matter.add.rectangle(centerX, upperFloorY, upperFloorWidth, 400, {
        isStatic: true,
        friction: 1, // 高摩擦力，讓錢停住
        render: { visible: false } // 物理本體隱藏，用 Graphics 畫圖
    });

    // --- 下層地板 (寬) ---
    // 位於畫面下方，負責接住上層掉下來的錢
    const lowerFloorY = height * 0.75;
    // 建立物理實體 (Static)
    const lowerFloor = this.matter.add.rectangle(centerX, lowerFloorY, width, 500, {
        isStatic: true,
        friction: 1,
        render: { visible: false }
    });

    // ============================================================
    // 2. 繪製視覺背景 (Visuals) - 為了像截圖
    // ============================================================
    
    // 下層綠色絨布
    const lowerGraphics = this.add.graphics();
    lowerGraphics.fillStyle(0x006400, 1); // 賭場綠
    lowerGraphics.fillRect(0, lowerFloorY - 250, width, 500);
    
    // 上層綠色絨布 (帶陰影邊框)
    const upperGraphics = this.add.graphics();
    upperGraphics.fillStyle(0x000000, 0.5); // 陰影
    upperGraphics.fillRect(centerX - upperFloorWidth/2 + 5, upperFloorY - 200 + 5, upperFloorWidth, 400);
    
    upperGraphics.fillStyle(0x008000, 1); // 較亮的綠
    upperGraphics.fillRect(centerX - upperFloorWidth/2, upperFloorY - 200, upperFloorWidth, 400);
    // 金色邊框
    upperGraphics.lineStyle(4, 0xffd700);
    upperGraphics.strokeRect(centerX - upperFloorWidth/2, upperFloorY - 200, upperFloorWidth, 400);

    // ============================================================
    // 3. 建立 "紫色推板" (Moving Pushers)
    // ============================================================

    // --- 上層推板 ---
    // 這是截圖中那個帶箭頭的紫色板子
    upperPusher = this.matter.add.rectangle(centerX, upperFloorY - 150, upperFloorWidth - 10, 60, {
        isStatic: true, // 設定為 Static 讓我們手動控制位置 (Kinematic效果)
        render: { fillColor: 0x9932cc } // 亮紫色
    });

    // --- 下層推板 ---
    // 在下層最後方推動
    lowerPusher = this.matter.add.rectangle(centerX, lowerFloorY - 200, width, 80, {
        isStatic: true,
        render: { fillColor: 0x6a0dad } // 深紫色
    });

    // ============================================================
    // 4. 建立兩側牆壁 (Side Walls) - 防止上層錢掉到虛空
    // ============================================================
    const wallThick = 50;
    // 左牆
    this.matter.add.rectangle(centerX - upperFloorWidth/2 - wallThick/2, upperFloorY, wallThick, 400, { 
        isStatic: true, render: { fillColor: 0x111111 } 
    });
    // 右牆
    this.matter.add.rectangle(centerX + upperFloorWidth/2 + wallThick/2, upperFloorY, wallThick, 400, { 
        isStatic: true, render: { fillColor: 0x111111 } 
    });


    // ============================================================
    // 5. 初始鋪幣 (Spawning)
    // ============================================================
    // 確保銀仔生成在 "地板上方" 一點點的位置

    // 上層初始幣
    for(let i=0; i<30; i++) {
        const x = Phaser.Math.Between(centerX - upperFloorWidth/2 + 20, centerX + upperFloorWidth/2 - 20);
        const y = Phaser.Math.Between(upperFloorY - 100, upperFloorY + 50);
        spawnCoin(this, x, y);
    }

    // 下層初始幣
    for(let i=0; i<50; i++) {
        const x = Phaser.Math.Between(20, width - 20);
        const y = Phaser.Math.Between(lowerFloorY - 150, lowerFloorY + 100);
        spawnCoin(this, x, y);
    }

    // ============================================================
    // 6. 事件綁定
    // ============================================================
    document.getElementById('push-btn').addEventListener('click', () => {
        handleCoinInsert(this, upperFloorWidth, upperFloorY);
    });
    
    window.addEventListener('resize', () => {
        this.scale.resize(window.innerWidth > 600 ? 600 : window.innerWidth, window.innerHeight * 0.75);
    });
}

let time = 0;

function update() {
    time += 1; // 時間計數
    
    // ============================================================
    // 推板移動邏輯 (Sine Wave Motion)
    // ============================================================
    
    // 上層推板位置計算
    // CenterY = height * 0.3 - 150 (Base)
    // 我們讓它在 Base 前後移動
    const height = this.game.config.height;
    const upperBaseY = (height * 0.3) - 120; 
    // 使用 Sin 波形移動，週期長，移動平滑
    const upperOffset = Math.sin(time * 0.05) * 40; 
    this.matter.body.setPosition(upperPusher, { 
        x: this.game.config.width / 2, 
        y: upperBaseY + upperOffset 
    });

    // 下層推板位置計算
    // 稍微錯開時間 (time + 20)，製造層次感
    const lowerBaseY = (height * 0.75) - 180;
    const lowerOffset = Math.sin((time * 0.05) + 1.5) * 50;
    this.matter.body.setPosition(lowerPusher, { 
        x: this.game.config.width / 2, 
        y: lowerBaseY + lowerOffset 
    });

    // ============================================================
    // 清除掉落的幣
    // ============================================================
    coins.forEach((container, index) => {
        // 如果掉出螢幕最下方
        if (container.y > height + 50) {
            container.destroy(); // 移除物件
            coins.splice(index, 1); // 移除陣列紀錄
        }
    });
}

// 生成銀仔
function spawnCoin(scene, x, y) {
    // 物理特性
    const coinBody = scene.matter.add.circle(x, y, COIN_SIZE / 2, {
        restitution: 0.1, // 彈性很低，像金屬
        friction: 0.3,    // 摩擦力適中
        density: 0.01,    // 重量
    });

    // 視覺特性
    const graphics = scene.add.graphics();
    graphics.fillStyle(0xFFD700, 1); // 金色
    graphics.fillCircle(0, 0, COIN_SIZE / 2);
    graphics.lineStyle(2, 0xB8860B); // 深金邊框
    graphics.strokeCircle(0, 0, COIN_SIZE / 2);
    
    // 錢幣上的 "$" 符號
    const text = scene.add.text(-6, -9, '$', { 
        fontSize: '14px', 
        color: '#8B4513',
        fontFamily: 'Arial',
        fontStyle: 'bold'
    });

    // 組合視覺物件
    const container = scene.add.container(x, y, [graphics, text]);
    
    // 讓 Container 跟隨 Physics Body
    scene.events.on('update', () => {
        if (container.active && coinBody) {
            container.x = coinBody.position.x;
            container.y = coinBody.position.y;
            container.rotation = coinBody.angle;
        }
    });
    
    // 標記物件以便刪除
    container.body = coinBody;
    coins.push(container);
}

// 按鈕事件處理
function handleCoinInsert(scene, upperWidth, upperFloorBaseY) {
    if (isSpinning) return;

    const centerX = scene.game.config.width / 2;
    
    // 投幣位置：在上層推板的 "後方/上方"，讓推板把它推下來
    // 範圍：上層地板寬度內
    const spawnX = Phaser.Math.Between(centerX - upperWidth/2 + 30, centerX + upperWidth/2 - 30);
    
    // 高度：從上面掉下來，落在推板前方
    const spawnY = upperFloorBaseY - 200;

    spawnCoin(scene, spawnX, spawnY);
    runSlotMachine(scene, upperWidth, upperFloorBaseY);
}

// 老虎機邏輯 (保持不變，稍微調整掉落位置)
function runSlotMachine(scene, upperWidth, upperFloorBaseY) {
    isSpinning = true;
    const reels = [document.getElementById('reel1'), document.getElementById('reel2'), document.getElementById('reel3')];
    const winDisplay = document.getElementById('win-amount');
    
    reels.forEach(r => { r.innerText = '🌀'; r.classList.add('spinning'); });

    setTimeout(() => {
        reels.forEach(r => r.classList.remove('spinning'));
        const isWin = Math.random() < 0.3; 
        
        if (isWin) {
            const rand = Math.random();
            let reward = 0; let icon = '';
            if (rand > 0.9) { reward = 300; icon = '💎'; }
            else if (rand > 0.6) { reward = 100; icon = '7️⃣'; }
            else { reward = 20; icon = '🍒'; }

            reels.forEach(r => r.innerText = icon);
            winDisplay.innerText = reward;
            dropReward(scene, reward, upperWidth, upperFloorBaseY);
        } else {
            reels[0].innerText = '🍋'; reels[1].innerText = '🍇'; reels[2].innerText = '🔔';
            winDisplay.innerText = '0';
        }
        isSpinning = false;
    }, 1000);
}

function dropReward(scene, amount, upperWidth, upperFloorBaseY) {
    let count = 0;
    const maxDrop = amount > 40 ? 40 : amount; // 限制數量防止卡頓
    const centerX = scene.game.config.width / 2;

    const interval = setInterval(() => {
        if (count >= maxDrop) { clearInterval(interval); return; }
        
        const x = Phaser.Math.Between(centerX - upperWidth/2 + 40, centerX + upperWidth/2 - 40);
        spawnCoin(scene, x, upperFloorBaseY - 200);
        count++;
    }, 100);
}
        
        count++;
    }, 80); // 掉落速度
}
