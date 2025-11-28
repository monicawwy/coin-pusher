const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: window.innerWidth > 600 ? 600 : window.innerWidth,
    height: window.innerHeight * 0.65, // 佔據中間區域
    backgroundColor: '#006400', // 賭場綠
    physics: {
        default: 'matter',
        matter: {
            gravity: { y: 1 }, // 重力
            debug: false // 開發時設為 true 可看到物理線條
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

const game = new Phaser.Game(config);

let pusher;
let coins = [];
let isSpinning = false;
const COIN_SIZE = 18; // 銀仔大小
const SLOT_WIN_RATE = 0.3; // 30%

// 素材載入 (這裡我們用程式畫圖，不需要外部圖片，方便你部署)
function preload() {
    // 這裡可以載入音效
    // this.load.audio('coin_drop', 'assets/coin.mp3');
    // this.load.audio('win', 'assets/win.mp3');
}

function create() {
    const width = this.game.config.width;
    const height = this.game.config.height;

    // 1. 建立邊界 (World Bounds)
    this.matter.world.setBounds(0, 0, width, height + 200); // 底部開放讓幣掉落消失

    // 2. 繪製背景材質 (綠色絨布感)
    const bgGraphics = this.add.graphics();
    bgGraphics.fillStyle(0x005500, 1);
    bgGraphics.fillRect(0, 0, width, height);

    // 3. 建立 "上層" (窄板) 的靜態阻擋 (Side Guards)
    // 上層寬度設定為螢幕的 60%，置中
    const upperWidth = width * 0.6;
    const guardWidth = (width - upperWidth) / 2;
    
    // 左擋板
    this.matter.add.rectangle(guardWidth / 2, height * 0.3, guardWidth, height * 0.6, { isStatic: true, render: { fillColor: 0x333333 } });
    // 右擋板
    this.matter.add.rectangle(width - (guardWidth / 2), height * 0.3, guardWidth, height * 0.6, { isStatic: true, render: { fillColor: 0x333333 } });

    // 4. 建立 "紫色推板" (The Purple Pusher)
    // 它是個 Kinematic Body (會動但不受碰撞影響位置)
    pusher = this.matter.add.rectangle(width / 2, height * 0.1, upperWidth - 10, 60, {
        isStatic: false, // 設為 false 才能移動
        isSensor: false,
        friction: 0,
        frictionAir: 0,
        render: { fillColor: 0x800080 } // 紫色
    });
    pusher.isStatic = true; // 強制設為 static 以便手動控制位置，但在 MatterJS 中要推動物體通常用 velocity 或直接設位置

    // 為了讓推板能推動物體，我們在 Update 中直接操作它的位置

    // 5. 初始鋪滿銀仔
    // 上層
    for (let i = 0; i < 30; i++) {
        spawnCoin(this, Phaser.Math.Between(guardWidth + 20, width - guardWidth - 20), Phaser.Math.Between(height * 0.15, height * 0.4));
    }
    // 下層 (較寬)
    for (let i = 0; i < 40; i++) {
        spawnCoin(this, Phaser.Math.Between(20, width - 20), Phaser.Math.Between(height * 0.5, height * 0.9));
    }

    // 6. 綁定 HTML 按鈕事件
    document.getElementById('push-btn').addEventListener('click', () => {
        handleCoinInsert(this);
    });
    
    // 處理視窗大小改變
    window.addEventListener('resize', () => {
        this.scale.resize(window.innerWidth > 600 ? 600 : window.innerWidth, window.innerHeight * 0.65);
    });
}

let time = 0;

function update() {
    const width = this.game.config.width;
    const height = this.game.config.height;

    // 推板移動邏輯 (Sine Wave)
    // 上下移動，範圍在 height * 0.05 到 height * 0.2 之間
    time += 0.02;
    const pusherY = (height * 0.12) + Math.sin(time) * (height * 0.08);
    
    // 強制設定推板位置 (模擬 Kinematic movement)
    this.matter.body.setPosition(pusher, { x: width / 2, y: pusherY });

    // 清除掉出螢幕下方的銀仔 (省效能)
    coins.forEach((coin, index) => {
        if (coin.y > height + 50) {
            coin.destroy();
            coins.splice(index, 1);
        }
    });
}

// 生成銀仔函式
function spawnCoin(scene, x, y) {
    // 繪製金幣圖形
    const coinColor = 0xFFD700; // 金色
    
    const coin = scene.matter.add.circle(x, y, COIN_SIZE / 2, {
        restitution: 0.3, // 彈性
        friction: 0.005,  // 摩擦力 (越低越滑)
        density: 0.05,     // 密度 (重量)
    });

    // 給剛體添加視覺呈現
    const graphics = scene.add.graphics({ x: 0, y: 0 });
    graphics.fillStyle(coinColor, 1);
    graphics.lineStyle(2, 0xffa500, 1); // 橙色邊框
    graphics.fillCircle(0, 0, COIN_SIZE / 2);
    graphics.strokeCircle(0, 0, COIN_SIZE / 2);
    
    // 加上 "M" 或 "$" 標誌
    const text = scene.add.text(-5, -7, '$', { fontSize: '12px', color: '#b8860b', fontStyle: 'bold' });
    
    // 將圖形和剛體綁定
    const container = scene.add.container(x, y, [graphics, text]);
    container.setSize(COIN_SIZE, COIN_SIZE);
    
    // 將 Container 連結到 Matter Body
    // Phaser 3 Matter 綁定較複雜，這裡用簡單方式：每一幀更新 Container 位置到 Body 位置
    scene.events.on('update', () => {
        if(coin && container.active) {
            container.x = coin.position.x;
            container.y = coin.position.y;
            container.rotation = coin.angle;
        } else {
            container.destroy();
        }
    });

    coins.push(container); // 追蹤用
    return coin;
}

// 處理投幣與老虎機邏輯
function handleCoinInsert(scene) {
    if (isSpinning) return; // 防止連按

    const width = scene.game.config.width;
    const height = scene.game.config.height;
    const upperWidth = width * 0.6;
    const guardWidth = (width - upperWidth) / 2;

    // 1. 投下一枚硬幣
    // 隨機左右發出 (Random Left/Right from inner top)
    // 定義 "最裡面" 為 pusher 的最上方附近
    // 隨機選左邊稍微偏右，或右邊稍微偏左的位置
    const spawnX = Math.random() > 0.5 
        ? (guardWidth + 20 + Math.random() * 40) // 左側內部
        : (width - guardWidth - 20 - Math.random() * 40); // 右側內部
    
    spawnCoin(scene, spawnX, height * 0.05);

    // 2. 啟動老虎機
    runSlotMachine(scene);
}

function runSlotMachine(scene) {
    isSpinning = true;
    const reels = [document.getElementById('reel1'), document.getElementById('reel2'), document.getElementById('reel3')];
    const winAmountDisplay = document.getElementById('win-amount');
    
    // 視覺動畫
    reels.forEach(r => r.classList.add('spinning'));
    reels.forEach(r => r.innerText = '🌀');

    setTimeout(() => {
        reels.forEach(r => r.classList.remove('spinning'));
        
        // 決定是否中獎 (30%)
        const isWin = Math.random() < SLOT_WIN_RATE;
        
        if (isWin) {
            // 決定獎勵大小
            const rand = Math.random();
            let reward = 0;
            let symbols = '';

            if (rand > 0.95) { reward = 1000; symbols = '💎'; } // 5% 機率大獎
            else if (rand > 0.7) { reward = 100; symbols = '7️⃣'; } // 25% 中獎
            else { reward = 20; symbols = '🍒'; } // 70% 小獎

            reels.forEach(r => r.innerText = symbols);
            winAmountDisplay.innerText = reward;
            
            // 掉落獎勵銀仔
            dropRewardCoins(scene, reward);

        } else {
            // 沒中獎
            const looseSymbols = ['🍋', '🍇', '🔔'];
            reels[0].innerText = looseSymbols[0];
            reels[1].innerText = looseSymbols[1];
            reels[2].innerText = looseSymbols[2];
            winAmountDisplay.innerText = '0';
        }
        
        isSpinning = false;
    }, 1500); // 轉動時間
}

// 掉落獎勵邏輯
function dropRewardCoins(scene, amount) {
    const width = scene.game.config.width;
    const upperWidth = width * 0.6;
    const guardWidth = (width - upperWidth) / 2;
    
    let count = 0;
    // 限制最大物理實體數量以防手機卡頓，若中 1000，實際上掉 50 個，剩下的加分或視覺特效
    const maxPhysicalDrop = amount > 50 ? 50 : amount; 

    const dropInterval = setInterval(() => {
        if (count >= maxPhysicalDrop) {
            clearInterval(dropInterval);
            return;
        }
        
        const spawnX = Math.random() > 0.5 
            ? (guardWidth + 40) 
            : (width - guardWidth - 40);
            
        spawnCoin(scene, spawnX, 50);
        count++;
    }, 100); // 每 100ms 掉一個
}
