const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: window.innerWidth > 600 ? 600 : window.innerWidth,
    height: window.innerHeight * 0.75, // 增加高度佔比
    backgroundColor: '#004d00', // 深綠色背景
    physics: {
        default: 'matter',
        matter: {
            gravity: { y: 0.8 }, // 模擬斜坡重力，讓幣慢慢往下滑
            debug: false // 如果想看物理線條，改成 true
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

const game = new Phaser.Game(config);

// 遊戲變數
let upperPusher;
let lowerPusher;
let coins = [];
let isSpinning = false;

// 參數設定
const COIN_SIZE = 22; // 銀仔稍大一點更清楚
const UPPER_WIDTH_PERCENT = 0.55; // 上層寬度佔比
const PUSHER_RANGE = 50; // 推板移動距離
const PUSHER_SPEED = 0.03; // 推板速度

function preload() {
    // 不需要外部圖片，使用 Graphics 繪製
}

function create() {
    const width = this.game.config.width;
    const height = this.game.config.height;
    const centerX = width / 2;

    // ==========================================
    // 1. 定義區域尺寸
    // ==========================================
    // 上層區域定義
    const upperWidth = width * UPPER_WIDTH_PERCENT;
    const upperLeft = (width - upperWidth) / 2;
    const upperRight = upperLeft + upperWidth;
    
    // 下層推板位置 (在畫面上方一點)
    const lowerPusherYBase = height * 0.45;
    // 上層推板位置 (在畫面更上方)
    const upperPusherYBase = height * 0.15;

    // ==========================================
    // 2. 建立物理邊界 (World Bounds)
    // ==========================================
    this.matter.world.setBounds(0, -200, width, height + 200);

    // ==========================================
    // 3. 繪製視覺背景 (靜態)
    // ==========================================
    
    // [視覺] 下層地板 (深綠色)
    const bgGraphics = this.add.graphics();
    bgGraphics.fillStyle(0x006400, 1);
    bgGraphics.fillRect(0, 0, width, height);
    
    // [視覺] 上層地板 (稍亮的綠色，帶陰影，營造高度感)
    const platformGraphics = this.add.graphics();
    // 陰影
    platformGraphics.fillStyle(0x000000, 0.5);
    platformGraphics.fillRect(upperLeft + 10, upperPusherYBase, upperWidth, height * 0.4);
    // 本體
    platformGraphics.fillStyle(0x008000, 1);
    platformGraphics.fillRect(upperLeft, upperPusherYBase, upperWidth, height * 0.4);
    // 邊框
    platformGraphics.lineStyle(4, 0xffd700); // 金邊
    platformGraphics.strokeRect(upperLeft, upperPusherYBase, upperWidth, height * 0.4);

    // ==========================================
    // 4. 建立物理推板 (Moving Pushers)
    // ==========================================
    
    // --- 下層推板 (Lower Pusher) ---
    // 這是一個寬的紫色板子，位於上層板子的下方區域
    lowerPusher = this.matter.add.rectangle(centerX, lowerPusherYBase, width, 80, {
        isStatic: true, // 我們手動控制位置
        render: { fillColor: 0x6a0dad } // 鮮豔紫色
    });

    // --- 上層推板 (Upper Pusher) ---
    // 較窄，位於最上方
    upperPusher = this.matter.add.rectangle(centerX, upperPusherYBase, upperWidth - 10, 60, {
        isStatic: true,
        render: { fillColor: 0x9932cc } // 亮紫色
    });

    // ==========================================
    // 5. 建立兩側阻擋 (Side Guards) - 防止上層銀仔掉到兩旁
    // ==========================================
    const wallThickness = 20;
    const wallHeight = height * 0.5;
    
    // 左擋板 (隱形或深色，擋住上層兩側)
    this.matter.add.rectangle(upperLeft - wallThickness/2, upperPusherYBase + 150, wallThickness, wallHeight, {
        isStatic: true,
        render: { fillColor: 0x222222 }
    });
    // 右擋板
    this.matter.add.rectangle(upperRight + wallThickness/2, upperPusherYBase + 150, wallThickness, wallHeight, {
        isStatic: true,
        render: { fillColor: 0x222222 }
    });

    // ==========================================
    // 6. 初始鋪滿銀仔
    // ==========================================
    
    // 上層鋪滿
    for (let i = 0; i < 35; i++) {
        const rx = Phaser.Math.Between(upperLeft + 15, upperRight - 15);
        const ry = Phaser.Math.Between(upperPusherYBase + 30, upperPusherYBase + 200);
        spawnCoin(this, rx, ry);
    }

    // 下層鋪滿 (分佈在下層推板前方)
    for (let i = 0; i < 50; i++) {
        const rx = Phaser.Math.Between(20, width - 20);
        const ry = Phaser.Math.Between(lowerPusherYBase + 50, height - 50);
        spawnCoin(this, rx, ry);
    }

    // ==========================================
    // 7. 事件綁定
    // ==========================================
    document.getElementById('push-btn').addEventListener('click', () => {
        handleCoinInsert(this, upperLeft, upperRight, upperPusherYBase);
    });

    // 調整視窗大小
    window.addEventListener('resize', () => {
        this.scale.resize(window.innerWidth > 600 ? 600 : window.innerWidth, window.innerHeight * 0.75);
    });
}

let time = 0;

function update() {
    const height = this.game.config.height;
    const centerX = this.game.config.width / 2;

    time += PUSHER_SPEED;

    // 計算推板的新 Y 位置 (正弦波移動)
    
    // 1. 上層推板移動
    // 基礎位置 + 移動範圍 (往復運動)
    const upperBaseY = height * 0.15;
    const upperNewY = upperBaseY + Math.sin(time) * 40; 
    this.matter.body.setPosition(upperPusher, { x: centerX, y: upperNewY });

    // 2. 下層推板移動
    // 稍微錯開相位 (time + 1)，讓視覺更有層次
    const lowerBaseY = height * 0.5; // 下層推板的基礎位置
    const lowerNewY = lowerBaseY + Math.sin(time + 1) * 50;
    this.matter.body.setPosition(lowerPusher, { x: centerX, y: lowerNewY });

    // 3. 清除掉出邊界的銀仔
    coins.forEach((coinContainer, index) => {
        // 檢查是否掉出螢幕下方
        if (coinContainer.y > height + 60) {
            // 這裡以後可以加分
            coinContainer.destroy();
            coins.splice(index, 1);
        }
    });
}

// ==========================================
// 輔助函式
// ==========================================

function spawnCoin(scene, x, y) {
    // 物理剛體 (圓形)
    const coinBody = scene.matter.add.circle(x, y, COIN_SIZE / 2, {
        restitution: 0.2, // 彈性低一點，比較像金屬
        friction: 0.001,  // 摩擦力低，容易滑動
        frictionAir: 0.02, // 空氣阻力，防止飛太快
        density: 0.002    // 密度
    });

    // 視覺圖形 (Graphics)
    const graphics = scene.add.graphics();
    
    // 金幣底色
    graphics.fillStyle(0xFFD700, 1);
    graphics.fillCircle(0, 0, COIN_SIZE / 2);
    // 金幣內圈
    graphics.lineStyle(2, 0xDAA520, 1);
    graphics.strokeCircle(0, 0, COIN_SIZE / 2 - 2);
    // 閃光點綴
    graphics.fillStyle(0xFFFFFF, 0.8);
    graphics.fillCircle(-4, -4, 2);

    // 將圖形放入 Container 並與物理 Body 綁定
    const container = scene.add.container(x, y, [graphics]);
    
    // 每一幀更新 Container 位置跟隨 Body
    scene.events.on('update', () => {
        if (container.active && coinBody) {
            container.x = coinBody.position.x;
            container.y = coinBody.position.y;
            container.rotation = coinBody.angle;
        }
    });

    // 綁定 body 到 container (用於銷毀時識別)
    container.body = coinBody;
    
    coins.push(container);
    return coinBody;
}

function handleCoinInsert(scene, leftBound, rightBound, topY) {
    if (isSpinning) return;

    // 1. 發射銀仔：從上層推板「最裡面」的位置發出
    // 隨機稍微偏左或偏右，模擬真實掉落
    const spawnX = Phaser.Math.Between(leftBound + 20, rightBound - 20);
    // 發射點在推板上方，讓它掉下來被推
    const spawnY = topY - 50; 

    spawnCoin(scene, spawnX, spawnY);

    // 2. 啟動 Slot
    runSlotMachine(scene, leftBound, rightBound);
}

function runSlotMachine(scene, leftBound, rightBound) {
    isSpinning = true;
    const reels = [document.getElementById('reel1'), document.getElementById('reel2'), document.getElementById('reel3')];
    const winAmountDisplay = document.getElementById('win-amount');
    
    reels.forEach(r => {
        r.innerText = '🌀';
        r.classList.add('spinning');
    });

    setTimeout(() => {
        reels.forEach(r => r.classList.remove('spinning'));
        
        // 30% 中獎率
        const isWin = Math.random() < 0.3; 
        
        if (isWin) {
            const rand = Math.random();
            let reward = 0;
            let icon = '';

            if (rand > 0.9) { reward = 500; icon = '💎'; }
            else if (rand > 0.6) { reward = 100; icon = '7️⃣'; }
            else { reward = 20; icon = '🍒'; }

            reels.forEach(r => r.innerText = icon);
            winAmountDisplay.innerText = reward;
            
            // 掉落獎勵
            dropRewardCoins(scene, reward, leftBound, rightBound);

        } else {
            reels[0].innerText = '🍋';
            reels[1].innerText = '🍇';
            reels[2].innerText = '🔔';
            winAmountDisplay.innerText = '0';
        }
        
        isSpinning = false;
    }, 1000);
}

function dropRewardCoins(scene, amount, leftBound, rightBound) {
    let count = 0;
    // 手機效能優化：若中大獎，顯示數字增加，但實際掉落物理銀仔上限設為 50
    const physicalLimit = 50; 
    const dropCount = amount > physicalLimit ? physicalLimit : amount;

    const interval = setInterval(() => {
        if (count >= dropCount) {
            clearInterval(interval);
            return;
        }
        
        // 獎勵銀仔也從上層內部掉落
        const spawnX = Phaser.Math.Between(leftBound + 30, rightBound - 30);
        spawnCoin(scene, spawnX, 50); // 從頂部掉下
        
        count++;
    }, 80); // 掉落速度
}
