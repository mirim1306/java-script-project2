// 1. 로컬 데이터 관리 및 상수
const FORMATION_SIZE = 10;
const MAX_GENERAL_LEVEL = 10;
const MAX_CHAR_LEVEL = 10;
const BASE_HP_PER_LEVEL = 1000;
const COIN_GAIN_PER_LEVEL = 0.2; // 레벨 당 20% 증가
const CHAR_LVL_COST_BASE = 50;
const CHAR_LVL_COST_MULT = 1.5; // 레벨 업 비용 승수
const SUMMON_COOLDOWN = 60; // 1초 쿨타임 (60프레임)
const ALLY_SUMMON_OFFSET_X = 80; // 기지에서 떨어진 소환 위치
const API_BASE_URL = 'http://localhost:3000/api';

// 전역 게임 상태
let gameState = {};
let gameCanvas = null;
let ctx = null;
let base = null; // 아군 기지
let enemyBase = null; // 적군 기지 
let allies = [];
let enemies = [];
let unitImages = {};
let isGameActive = false;
let isPaused = false;
let animationFrameId;
let combatTimer = 0;
let currentSummonCooldowns = new Array(FORMATION_SIZE).fill(0);
let inGameCoins = 0;
let backgroundImage = null; // 배경 이미지 객체 추가
let currentStage = '1-1'; // 현재 스테이지 정보 추가

// 유닛 설정 (예시) - 레벨당 스탯 증가율 포함
const UNIT_STATS = {
    // 아군
    ally1: {name: '호냥이', icon: '😼', hp: 100, damage: 20, speed: 0.60, cost: 50, type: 'melee', damageMultiplier: 1.1, hpMultiplier: 1.1, attackAnimationDuration: 2, attackCooldown: 120, attackHitFrame: 1, baseImage: 'images/Tiger.png', attackImage: 'images/Tiger_attack.png'},
    ally2: {name: '탱커 호냥이', icon: '🛡️🐈', hp: 300, damage: 10, speed: 0.30, cost: 100, type: 'melee', damageMultiplier: 1.1, hpMultiplier: 1.1, attackAnimationDuration: 2, attackCooldown: 180, attackHitFrame: 1, baseImage: 'images/Tanker_Tiger.png', attackImage: 'images/Tanker_Tiger_attack.png'},
    ally3: {name: '도끼 호냥이', icon: '🪓🐯', hp: 150, damage: 30, speed: 0.50, cost: 200, type: 'melee', damageMultiplier: 1.1, hpMultiplier: 1.1, attackAnimationDuration: 2, attackCooldown: 240, attackHitFrame: 1, baseImage: 'images/Axe_Tiger.png', attackImage: 'images/Axe_Tiger_attack.png'},
    ally4: {name: '키다리 호냥이', icon: '🦒😼', hp: 200, damage: 60, speed: 0.40, cost: 400, type: 'range', damageMultiplier: 1.1, hpMultiplier: 1.1, attackAnimationDuration: 2, attackCooldown: 300, attackHitFrame: 1, baseImage: 'images/Long_Tiger.png', attackImage: 'images/Long_Tiger_attack.png'},
    // 적군
    enemy1: {name: '토깽이', icon: '🐇', hp: 80, damage: 10, speed: 0.60, cost: 0, type: 'melee', damageMultiplier: 1.1, hpMultiplier: 1.1, attackAnimationDuration: 2, attackHitFrame: 1, attackCooldown: 120, rewardCoin: 100, baseImage: 'images/Rabbit.png', attackImage: 'images/Rabbit_attack.png'},
    enemy2: {name: '당근 토깽이', icon: '🥕🐰', hp: 150, damage: 20, speed: 0.80, cost: 0, type: 'melee', damageMultiplier: 1.1, hpMultiplier: 1.1, attackAnimationDuration: 2, attackHitFrame: 1, attackCooldown: 180, rewardCoin: 150, baseImage: 'images/Carrot_Rabbit.png', attackImage: 'images/Carrot_Rabbit_attack.png'},
    enemy3: {name: '깡깡깡', icon: '⚙️🐰', hp: 120, damage: 30, speed: 0.50, cost: 0, type: 'melee', damageMultiplier: 1.1, hpMultiplier: 1.1, attackAnimationDuration: 2, attackHitFrame: 1, attackCooldown: 240, rewardCoin: 300, baseImage: 'images/Kang.png', attackImage: 'images/Kang_attack.png'},
    enemy4: {name: '거부기', icon: '🐢', hp: 500, damage: 80, speed: 0.20, cost: 0, type: 'melee', damageMultiplier: 1.1, hpMultiplier: 1.1, attackAnimationDuration: 2, attackHitFrame: 1, attackCooldown: 480, rewardCoin: 1000, baseImage: 'images/Turtle.png', attackImage: 'images/Turtle_attack.png'},
};

// 파워업 비용 (레벨 1 -> 2 비용부터 시작)
const POWER_UP_COSTS = {
    baseHp: [50, 100, 200, 300, 500, 750, 1000, 1500, 2000],
    coinGain: [50, 100, 200, 300, 500, 750, 1000, 1500, 2000]
};

// 유저 데이터 구조의 기본값
const initialUserData = {
    coins: 100,
    chapters: {
        chapter1: { unlocked: true, highestLevel: 0 },
        chapter2: { unlocked: false, highestLevel: 0 },
        chapter3: { unlocked: false, highestLevel: 0 }
    },
    powerUps: {
    baseHp: 1, // 레벨 1 (기지 HP)
    coinGain: 1 // 레벨 1 (코인 획득량)
    },
    // 모든 캐릭터는 레벨 1에서 시작
    charLevels: {
        ally1: 1, ally2: 1, ally3: 1, ally4: 1, ally5: 1, ally6: 1, ally7: 1
    },
    unlockedCharacters: ['ally1', 'ally2', 'ally3', 'ally4', 'ally5', 'ally6', 'ally7'],
    formation: Array(FORMATION_SIZE).fill(null)
};

// 기지 클래스
class Base {
    constructor(maxHp, isEnemyBase = false) {
        this.maxHp = maxHp;
        this.hp = maxHp;
        this.width = 100;
        
        this.height = gameCanvas ? gameCanvas.height : 0; 
        this.isEnemy = isEnemyBase; 
        this.type = isEnemyBase ? 'enemyBase' : 'base'; 
        
        if (gameCanvas) {
            this.x = isEnemyBase ? 0 : gameCanvas.width - this.width;
        } else {
            this.x = 0;
        }
        this.y = 0;
        
        // 기지 이미지 로드
        this.image = null;
        if (unitImages[isEnemyBase ? 'enemyBase' : 'friendlyBase']) {
            this.image = unitImages[isEnemyBase ? 'enemyBase' : 'friendlyBase'];
        }
    }
    
    draw() {
        if (!ctx || !gameCanvas) return;

        // 초록색 부분 중앙 계산 (화면 높이의 약 70% 위치에 배치)
        const baseHeight = 200; // 기지 높이
        const baseY = gameCanvas.height * 0.675 - baseHeight / 2;

        if (this.image && this.image.complete) {
            ctx.drawImage(this.image, this.x, baseY, this.width, baseHeight);
        } else {
            ctx.fillStyle = this.isEnemy ? '#dc2626' : '#10b981';
            ctx.fillRect(this.x, baseY, this.width, baseHeight);
        }

        // HP 표시 - 기지 바로 위에 숫자만 표시
        ctx.fillStyle = 'white';
        ctx.font = 'bold 24px Inter';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
            
        const textX = this.x + this.width / 2;
            
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 5;
        ctx.fillText(`${Math.max(0, Math.round(this.hp))}`, textX, baseY - 10);
        ctx.shadowBlur = 0;
    }
}

// 유닛 클래스
class Unit {
    constructor(stats, x, type, index = 0, charKey = null) {
        // 기본 속성 초기화
        this.name = stats.name;
        this.icon = stats.icon;
        this.hp = stats.hp;
        this.damage = stats.damage;
        this.speed = stats.speed;
        this.cost = stats.cost;
        this.type = stats.type;
        this.damageMultiplier = stats.damageMultiplier;
        this.hpMultiplier = stats.hpMultiplier;
        this.attackAnimationDuration = stats.attackAnimationDuration;
        this.attackHitFrame = stats.attackHitFrame;
        this.attackCooldown = stats.attackCooldown;
        this.rewardCoin = stats.rewardCoin || 0;

        // 게임 상태 변수
        this.x = x;
        this.isAlly = type === 'ally';
        this.maxHp = this.hp;
        this.isAttacking = false;
        this.attackTimer = 0;
        this.attackFrame = 0;
        this.target = null;
        this.currentAttackTimer = 0;
        this.hasHit = false;
        
        // 수정 1: 이미지 객체 참조를 charKey를 통해 unitImages에서 가져옵니다.
        this.baseImage = null;
        this.attackImage = null;
        
        if (charKey && unitImages && unitImages[`${charKey}_base`]) {
            this.baseImage = unitImages[`${charKey}_base`];
            this.attackImage = unitImages[`${charKey}_attack`];
        }

        // 유닛 크기를 고정합니다.
        this.width = 60;
        this.height = 60;
        
        this.y = gameCanvas ? gameCanvas.height * 0.75 - this.height / 2 : 0; 

        let level = 1;
        if (type === 'ally' && charKey) {
            level = gameState.charLevels[charKey] || 1;
        }

        this.level = level;
        this.charKey = charKey;
            
        // 레벨에 따른 스탯 계산
        const hpMultiplier = stats.hpMultiplier || 1.0;
        const damageMultiplier = stats.damageMultiplier || 1.0;

        // 레벨이 1부터 시작하므로 (level - 1)만큼 승수 적용
        this.baseHp = stats.hp;
        this.baseDamage = stats.damage;

        // Math.round로 정수화하여 HP/데미지 값이 깔끔하게 보이도록 함
        this.maxHp = Math.round(stats.hp * (hpMultiplier ** (level - 1)));
        this.hp = this.maxHp;
        this.damage = Math.round(stats.damage * (damageMultiplier ** (level - 1)));

        this.speed = stats.speed;
        this.x = x;

        this.attackCooldown = 120;
        this.attackSpeed = 120;
    }

    draw() {
        if (!ctx) return;

        let imageToDraw = this.baseImage;
        if (this.isAttacking && this.attackImage) {
            imageToDraw = this.attackImage;
        }

        const hasImage = imageToDraw && imageToDraw instanceof Image && imageToDraw.complete;
        
        if (hasImage) { 
            ctx.save(); 

            let drawX = this.x;
            let drawY = this.y;
            
            // 적군일 경우 좌우 반전
            if (!this.isAlly) {
                ctx.drawImage(imageToDraw, drawX, drawY, this.width, this.height);
            } else {
                // 아군일 경우 기본 방향
                ctx.drawImage(imageToDraw, drawX, drawY, this.width, this.height);
            }
            
            ctx.restore(); 
        } else {
            // 이미지 로드 실패 시 아이콘 표시
            ctx.fillStyle = 'white';
            ctx.font = '24px Inter';
            ctx.textAlign = 'center';
            ctx.fillText(this.icon, this.x + this.width / 2, this.y + this.height / 2 + 8);
            
            if (!imageToDraw) {
                console.warn(`Unit at (${this.x}, ${this.y}) has no image. charKey: ${this.charKey}`);
            } else if (!(imageToDraw instanceof Image)) {
                console.warn(`Unit at (${this.x}, ${this.y}) image is not an Image object.`);
            } else if (!imageToDraw.complete) {
                console.warn(`Unit at (${this.x}, ${this.y}) image not loaded yet.`);
            }
        }
    }

    move() {
        if (this.isAlly) {
            this.x -= this.speed; // 아군은 왼쪽으로
            if (this.x < 0) {
                this.x = 0;
            }
        } else {
            this.x += this.speed; // 적군은 오른쪽으로
            if (this.x + this.width > gameCanvas.width) {
                this.x = gameCanvas.width - this.width;
            }
        }
    }

    attack(target) {
        this.target = null;
        if (this.attackCooldown <= 0) {
            target.hp -= this.damage;
            this.attackCooldown = this.attackSpeed;
    
            if (target.type === 'enemy' && target.hp <= 0) {
                const coinGainLevel = gameState.powerUps.coinGain;
                // 코인 획득량은 레벨에 따라 증가 (레벨 1: 10코인, 레벨 2: 12코인...)
                const coinGain = Math.floor(10 * (1 + COIN_GAIN_PER_LEVEL * (coinGainLevel - 1)));
                inGameCoins += coinGain;
                document.getElementById('coin-in-game').textContent = `코인: ${inGameCoins}`;
            }
        } else {
            this.attackCooldown--;
        }
    }

    // 유닛의 주 행동 로직 (animate 함수에서 호출될 예정)
    update() {
        // 1. 타이머 관리
        if (this.currentAttackTimer > 0) {
            this.currentAttackTimer--;

            // 공격 모션 중이라면, 히트 프레임 체크
            if (this.isAttacking && !this.hasHit) {
                const framesElapsed = this.attackCooldown - this.currentAttackTimer;

                if (framesElapsed >= this.attackHitFrame) {
                    this.dealDamage(); // 데미지 처리
                    this.hasHit = true;
                }
            }

            // 공격 애니메이션 종료 시점 (1초 * 60fps = 60프레임)
            const animationDuration = 60;
            if (this.isAttacking && (this.attackCooldown - this.currentAttackTimer) >= animationDuration) {
                this.isAttacking = false;
            }

            // 공격 쿨다운 중에는 이동하지 않음 (이 부분이 핵심!)
            return; 
        }

        // 2. 목표 찾기
        if (!this.target || this.target.hp <= 0) {
            this.findTarget();
        }

        // 3. 목표가 있을 때만 행동
        if (this.target) {
            const targetX = this.target.x;
            const targetWidth = this.target.width || 0;
            const attackRange = this.type === 'melee' ? 15 : 200;

            let distance;

            if (this.isAlly) {
                // 아군: 목표까지의 거리 (왼쪽 방향)
                distance = this.x - (targetX + targetWidth);
            } else {
                // 적군: 목표까지의 거리 (오른쪽 방향)
                distance = targetX - (this.x + this.width);
            }
        
            // 공격 범위 안에 있으면 공격만 (이동 안함)
            if (distance <= attackRange && distance >= -10) {
                this.startAttack();
                // 여기서 return을 추가하여 이동하지 않도록
                return;
            } else if (distance > attackRange) {
                // 공격 범위 밖이면 이동
                this.move();
            } else {
                // distance < -10 (목표를 지나친 경우) - 목표 재탐색
                this.target = null;
            }
        } else {
            // 목표가 없으면 전진 (기지 공격)
            this.move();
        }
    }

    // 공격 시작 상태로 전환 (쿨다운 설정)
    startAttack() {
        if (this.currentAttackTimer === 0) {
            this.isAttacking = true;
            this.hasHit = false;
            this.currentAttackTimer = this.attackCooldown;
        }
    }

    // 실제 데미지를 처리하는 메서드
    dealDamage() {
        if (this.target && this.target.hp > 0) {
            const oldHp = this.target.hp;
            this.target.hp -= this.damage;

            // 적 유닛 처치 시 코인 획득 (아군이 적을 죽였을 때만)
            if (this.isAlly && this.target.hp <= 0 && this.target.rewardCoin) {
                const coinGainLevel = gameState.powerUps.coinGain;
                const coinGain = Math.floor(this.target.rewardCoin * (1 + COIN_GAIN_PER_LEVEL * (coinGainLevel - 1)));
                inGameCoins += coinGain;
            }

            if (this.target.hp < 0) {
                this.target.hp = 0;
            }
        }
    }
}

// Unit 클래스에 목표 설정/갱신 함수 추가
Unit.prototype.findTarget = function() {
    if (this.isAlly) {
        // 아군: 적군 유닛과 적군 기지를 타겟으로
        const targets = [...enemies, enemyBase].filter(t => t && t.hp > 0);
        if (targets.length > 0) {
            // 가장 가까운 타겟 찾기 (거리 기준)
            targets.sort((a, b) => {
                const distA = Math.abs(a.x - this.x);
                const distB = Math.abs(b.x - this.x);
                return distA - distB;
            });
            this.target = targets[0];
        } else {
            this.target = null;
        }
    } else {
        // 적군: 아군 유닛과 아군 기지를 타겟으로
        const targets = [...allies, base].filter(t => t && t.hp > 0);
        if (targets.length > 0) {
            // 가장 가까운 타겟 찾기 (거리 기준)
            targets.sort((a, b) => {
                const distA = Math.abs(a.x - this.x);
                const distB = Math.abs(b.x - this.x);
                return distA - distB;
            });
            this.target = targets[0];
        } else {
            this.target = null;
        }
    }
};

// 서버에서 게임 데이터 로드
async function loadGameStateFromServer(authCode) {
    try {
        const response = await fetch(`${API_BASE_URL}/load/${authCode}`);
        const data = await response.json();
        
        if (data.success && data.gameState) {
            return data.gameState;
        }
        
        return null;
    } catch (error) {
        console.error('서버 로드 실패:', error);
        return null;
    }
}

// 서버에 게임 데이터 저장
async function saveGameStateToServer(authCode, gameState) {
    try {
        const response = await fetch(`${API_BASE_URL}/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ auth_code: authCode, gameState: gameState })
        });
        
        const data = await response.json();
    } catch (error) {
        console.error('서버 저장 오류:', error);
    }
}

// 서버에 새 사용자 생성
async function createUserOnServer(authCode) {
    try {
        const response = await fetch(`${API_BASE_URL}/user/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ auth_code: authCode })
        });
        
        const data = await response.json();
        return data.success;
    } catch (error) {
        console.error('사용자 생성 오류:', error);
        return false;
    }
}

// 서버에서 게임 데이터 로드
async function loadGameState() {
    const authCode = getOrCreateAuthCode();
    
    try {
        // 1. 서버에서 로드 시도
        const serverData = await loadGameStateFromServer(authCode);
        
        if (serverData) {
            gameState = serverData;
                
            // 서버 데이터가 불완전할 경우 기본값으로 채우기
            if (!serverData.unlockedCharacters || serverData.unlockedCharacters.length === 0) {
                gameState.unlockedCharacters = JSON.parse(JSON.stringify(initialUserData.unlockedCharacters));
            }
            if (!serverData.charLevels || Object.keys(serverData.charLevels).length === 0) {
                gameState.charLevels = JSON.parse(JSON.stringify(initialUserData.charLevels));
            }
            if (!serverData.formation || serverData.formation.length === 0) {
                gameState.formation = JSON.parse(JSON.stringify(initialUserData.formation));
            }
        } else {
            // 2. 로컬 스토리지 확인
            const localData = localStorage.getItem('honyaiDefenseState');
            
            if (localData) {
                gameState = JSON.parse(localData);
                await saveGameStateToServer(authCode, gameState);
            } else {
                // 3. 새 계정 생성
                gameState = JSON.parse(JSON.stringify(initialUserData));
                await createUserOnServer(authCode);
                await saveGameStateToServer(authCode, gameState);
            }
        }
        
        // 데이터 마이그레이션 (깊은 복사로 안전하게)
        if (!gameState.charLevels) {
            gameState.charLevels = JSON.parse(JSON.stringify(initialUserData.charLevels));
        }
        if (!gameState.powerUps) {
            gameState.powerUps = JSON.parse(JSON.stringify(initialUserData.powerUps));
        }
        if (!gameState.unlockedCharacters) {
            gameState.unlockedCharacters = JSON.parse(JSON.stringify(initialUserData.unlockedCharacters));
        }
        if (!gameState.formation || gameState.formation.length !== FORMATION_SIZE) {
            gameState.formation = JSON.parse(JSON.stringify(initialUserData.formation));
        }
        if (!gameState.chapters) {
            gameState.chapters = JSON.parse(JSON.stringify(initialUserData.chapters));
        }
        if (gameState.coins === undefined || isNaN(gameState.coins)) {
            gameState.coins = initialUserData.coins;
        }
        
        // 로컬 백업
        localStorage.setItem('honyaiDefenseState', JSON.stringify(gameState));
        
        // UI 즉시 업데이트
        updateAllUI();
        
    } catch (error) {
        console.error('로드 오류, 로컬 사용:', error);
        const localData = localStorage.getItem('honyaiDefenseState');
        gameState = localData ? JSON.parse(localData) : JSON.parse(JSON.stringify(initialUserData));
        
        // 데이터 마이그레이션 재적용
        if (!gameState.charLevels) gameState.charLevels = JSON.parse(JSON.stringify(initialUserData.charLevels));
        if (!gameState.powerUps) gameState.powerUps = JSON.parse(JSON.stringify(initialUserData.powerUps));
        if (!gameState.unlockedCharacters) gameState.unlockedCharacters = JSON.parse(JSON.stringify(initialUserData.unlockedCharacters));
        if (!gameState.formation || gameState.formation.length !== FORMATION_SIZE) {
            gameState.formation = JSON.parse(JSON.stringify(initialUserData.formation));
        }
        if (!gameState.chapters) gameState.chapters = JSON.parse(JSON.stringify(initialUserData.chapters));
        if (gameState.coins === undefined || isNaN(gameState.coins)) gameState.coins = initialUserData.coins;
        
        // 로컬 백업
        localStorage.setItem('honyaiDefenseState', JSON.stringify(gameState));
        
        // UI 즉시 업데이트
        updateAllUI();
    }
}

// UI 전체 업데이트 함수 추가
function updateAllUI() {
    // 코인 표시 업데이트
    const coinDisplay = document.getElementById('current-coins');
    if (coinDisplay) {
        coinDisplay.textContent = Math.floor(gameState.coins);
    }
}

// 배경 이미지 로드 함수
async function loadBackgroundImage() {
    return new Promise(resolve => {
        // 전역 변수 backgroundImage에 이미지 객체 생성 및 로드
        backgroundImage = new Image();
        backgroundImage.src = 'images/game.png'; 
        backgroundImage.onload = () => {
            resolve();
        };
        backgroundImage.onerror = () => {
            console.error("Failed to load background image: images/game.png");
            resolve(); 
        };
    });
}

function drawGame() {
    if (!ctx) return;
    
    // 1. 캔버스 초기화
    ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);

    // 2. 배경 이미지 그리기
    if (backgroundImage && backgroundImage.complete) {
        ctx.drawImage(backgroundImage, 0, 0, gameCanvas.width, gameCanvas.height);
    } else {
        ctx.fillStyle = '#304050'; 
        ctx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);
    }

    // 3. 기지 그리기
    base.draw();
    enemyBase.draw();
    
    // 4. 유닛 그리기
    allies.forEach(unit => unit.draw());
    enemies.forEach(unit => unit.draw());
    
    // 5. 코인 정보를 화면 상단 우측에 표시 (정수로 표시)
    ctx.fillStyle = 'white';
    ctx.font = 'bold 32px Inter';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';

    ctx.shadowColor = 'black';
    ctx.shadowBlur = 8;
    ctx.fillText(`코인 : ${Math.floor(inGameCoins)}`, gameCanvas.width - 30, 20);
    ctx.shadowBlur = 0;
}

// 캐릭터 레벨 업 비용 계산
function getCharLevelCost(currentLevel) {
    if (currentLevel >= MAX_CHAR_LEVEL) return Infinity;
    // 레벨 1 -> 2 비용은 CHAR_LVL_COST_BASE (1.5^(1-1) = 1)
    return Math.floor(CHAR_LVL_COST_BASE * (CHAR_LVL_COST_MULT ** (currentLevel - 1)));
}

// 인증 코드 생성 또는 가져오기
function getOrCreateAuthCode() {
    let authCode = localStorage.getItem('honyaiAuthCode');
    
    if (!authCode) {
        // 새로운 인증 코드 생성: HN-XXXX-XXXX-XXXX 형식
        const generateRandomSegment = () => {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let segment = '';
            for (let i = 0; i < 4; i++) {
                segment += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return segment;
        };
        
        authCode = `HN-${generateRandomSegment()}-${generateRandomSegment()}-${generateRandomSegment()}`;
        localStorage.setItem('honyaiAuthCode', authCode);
    }
    
    return authCode;
}

// 모든 유닛 이미지 사전 로딩 함수
async function loadUnitImages() {
    const promises = [];
    
    // 기지 이미지 로드 추가
    const baseImages = {
        'friendlyBase': 'images/friendly_base.png',
        'enemyBase': 'images/enemy_base.png'
    };
    
    for (const [key, src] of Object.entries(baseImages)) {
        const img = new Image();
        img.src = src;
        promises.push(new Promise(resolve => {
            img.onload = () => {
                unitImages[key] = img;
                resolve();
            };
            img.onerror = () => {
                console.warn(`Failed to load base image: ${src}`);
                resolve();
            };
        }));
    }

    for (const unitKey in UNIT_STATS) {
        const stats = UNIT_STATS[unitKey];
        
        // 1. 기본 이미지 로드
        if (stats.baseImage) {
            const img = new Image();
            img.src = stats.baseImage;
            promises.push(new Promise(resolve => {
                img.onload = () => {
                    unitImages[`${unitKey}_base`] = img; // ally1_base 키로 저장
                    resolve();
                };
                img.onerror = () => {
                    console.warn(`Failed to load base image for ${unitKey}: ${stats.baseImage}`);
                    resolve();
                };
            }));
        }
        
        // 2. 공격 이미지 로드
        if (stats.attackImage) {
            const img = new Image();
            img.src = stats.attackImage;
            promises.push(new Promise(resolve => {
                img.onload = () => {
                    unitImages[`${unitKey}_attack`] = img; // ally1_attack 키로 저장
                    resolve();
                };
                img.onerror = () => {
                    console.warn(`Failed to load attack image for ${unitKey}: ${stats.attackImage}`);
                    resolve();
                };
            }));
        }
    }
    await Promise.all(promises);
}

async function saveGameState() {
    const authCode = getOrCreateAuthCode();
    
    try {
        // 로컬 저장
        localStorage.setItem('honyaiDefenseState', JSON.stringify(gameState));
        
        // 서버 저장
        await saveGameStateToServer(authCode, gameState);
        
    } catch (error) {
        console.error('저장 오류:', error);
    }
}

// 2. 화면 전환 및 UI 로직
const screens = document.querySelectorAll('.screen');
let history = []; // 뒤로가기를 위한 화면 기록

function showScreen(id) {
    // 현재 화면 ID 찾기
    const currentScreenId = Array.from(screens).find(screen => !screen.classList.contains('hidden'))?.id;

    // 현재 화면이 있고, 새 화면과 다르고, 게임 화면이 아닌 경우에만 history에 저장
    if (currentScreenId && currentScreenId !== id && currentScreenId !== 'game-screen') {
        // 중복 방지 (뒤로가기 후 다시 앞으로 가는 경우)
        if (history.length === 0 || history[history.length - 1] !== currentScreenId) {
            history.push(currentScreenId);
        }
    }

    // 먼저 targetScreen을 찾습니다
    const targetScreen = document.getElementById(id);
    if (!targetScreen) {
        console.error(`Screen ID ${id} not found.`);
        return;
    }

    // 모든 화면 숨기기 (targetScreen 찾은 후)
    screens.forEach(screen => {
        screen.classList.add('hidden');
        screen.style.display = 'none';
    });

    // 타겟 화면만 표시
    targetScreen.classList.remove('hidden');
    targetScreen.style.display = 'flex';

    // 화면 표시 후 필요한 렌더링 호출
    if (id === 'power-up-screen') renderPowerUpScreen();
    if (id === 'character-selection-screen') {
        // 이미지 로드 확인 후 렌더링
        if (Object.keys(unitImages).length === 0) {
            loadUnitImages().then(() => renderCharacterSelection());
        } else {
            renderCharacterSelection();
        }
    }
}

// history를 사용하여 직전 화면으로 돌아갑니다.
function goBack() {
    if (history.length > 0) {
        const prevScreenId = history.pop();
    
        // 먼저 이전 화면을 찾습니다
        const prevScreen = document.getElementById(prevScreenId);
        if (!prevScreen) {
            // 이전 화면이 없으면 시작 화면으로 (안전 장치)
            showScreen('start-screen');
            history = [];
            return;
        }

        // 모든 화면 명시적으로 숨기기
        screens.forEach(screen => {
            screen.classList.add('hidden');
            screen.style.display = 'none';
        });
    
        // 이전 화면만 표시
        prevScreen.classList.remove('hidden');
        prevScreen.style.display = 'flex';
        
        // 뒤로 간 후에도 렌더링 필요
        if (prevScreenId === 'power-up-screen') renderPowerUpScreen();
        if (prevScreenId === 'character-selection-screen') renderCharacterSelection();
    } else {
        // 더 이상 뒤로갈 곳이 없으면 시작 화면으로
        showScreen('start-screen');
    }
}

function showMessage(text) {
    document.getElementById('messageText').textContent = text;
    document.getElementById('messageBox').classList.remove('hidden');
}

// 요소가 유효한 경우에만 클래스를 추가/제거합니다.
function safeClassList(element, action, className) {
    if (element && element.classList) {
        if (action === 'add') {
            element.classList.add(className);
        } else if (action === 'remove') {
            element.classList.remove(className);
        }
    }
}

document.getElementById('messageCloseButton')?.addEventListener('click', () => {
    document.getElementById('messageBox').classList.add('hidden');
});

// 3. 게임 데이터 및 로직 (예시)
let BASE_POSITION = { x: 50, y: 0 }; 
const COMBAT_DURATION = 60 * 60; // 60초 (60프레임 * 60초)

// 게임 시작 및 종료
async function startGame(stageId = '1-1') {
    showScreen('game-screen');

    currentStage = stageId; // 현재 스테이지 저장
    
    gameCanvas = document.getElementById('gameCanvas');
    
    if (!gameCanvas) {
        return;
    }
    
    ctx = gameCanvas.getContext('2d');
    gameCanvas.width = window.innerWidth;
    gameCanvas.height = window.innerHeight;

    // 이미지가 이미 로드되어 있지 않은 경우에만 로드
    if (Object.keys(unitImages).length === 0) {
        await loadUnitImages();
    }
    if (!backgroundImage) {
        await loadBackgroundImage();
    }
    
    const baseMaxHp = BASE_HP_PER_LEVEL * gameState.powerUps.baseHp;
    
    // 기지는 Base 클래스로 생성 (Unit이 아님)
    base = new Base(baseMaxHp, false); // 아군 기지
    enemyBase = new Base(baseMaxHp, true); // 적군 기지
    
    const BASE_POSITION = {x: 40, y: gameCanvas.height / 2};

    // 게임 상태 초기화
    combatTimer = 0;
    allies = [];
    enemies = [];
    inGameCoins = 0;
    isPaused = false;
    isGameActive = true; 
    currentSummonCooldowns = Array(FORMATION_SIZE).fill(0); 

    // 적 자동 생성 타이머 추가 (5초마다 적 1마리 추가)
    setInterval(() => {
        if (isGameActive && !isPaused && enemies.length < 5) {
            // 스테이지에 따라 등장하는 적 종류 결정
            let enemyTypes = [];
            if (currentStage === '1-1') {
                enemyTypes = ['enemy1']; // 토끼만
            } else if (currentStage === '1-2') {
                enemyTypes = ['enemy1', 'enemy2']; // 토끼, 당근토끼
            } else if (currentStage === '1-3') {
                enemyTypes = ['enemy1', 'enemy2', 'enemy3']; // 토끼, 당근토끼, 깡깡깡
            } else if (currentStage === '1-4') {
                enemyTypes = ['enemy1', 'enemy2', 'enemy3', 'enemy4']; // 모든 적
            } else {
                enemyTypes = ['enemy1']; // 기본값
            }
            
            const randomEnemy = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
            enemies.push(new Unit(UNIT_STATS[randomEnemy], 150, 'enemy', enemies.length, randomEnemy));
        }
    }, 5000); // 5초마다
    
    // UI 초기화 및 소환 버튼 렌더링
    document.getElementById('coin-in-game').textContent = `코인: ${inGameCoins}`;
    document.getElementById('pauseButton').textContent = "일시정지";
    
    // 소환 버튼 렌더링 및 이벤트 추가 (startGame 내에서 호출)
    renderSummonControls();
    
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    animate();
}

function endGame(result) {
    cancelAnimationFrame(animationFrameId);
    isPaused = true;
    isGameActive = false;

    let message = '';
    let totalReward = 0;
    
    if (result === 'win') {
        // 승리 시: (남은 재화 * 2) + 남은 기지 체력
        const coinReward = Math.floor(inGameCoins * 2);
        const baseHpReward = Math.floor(base.hp);
        totalReward = coinReward + baseHpReward;
        
        message = `승리!\n보상: ${totalReward} 코인`;
        gameState.coins += totalReward;
        saveGameState(); 
    } else if (result === 'lose') {
        // 패배 시: 남은 재화만 획득 (패널티 없음)
        totalReward = Math.floor(inGameCoins);
        message = `패배...\n기지가 파괴되었습니다.\n보상: ${totalReward} 코인`;
        if (totalReward > 0) {
            gameState.coins += totalReward;
            saveGameState();
        }
    }

    showMessage(message);
    
    // 메시지 박스 닫을 때 이전 화면으로 돌아가도록 (전투 맵에서 이전 화면으로)
    document.getElementById('messageCloseButton').onclick = () => {
        document.getElementById('messageBox').classList.add('hidden');
        goBack(); 

        document.getElementById('messageCloseButton').onclick = () => {
             document.getElementById('messageBox').classList.add('hidden');
        };
    };
}

// 게임 루프
function animate() {
    if (isPaused || !ctx || !gameCanvas || !isGameActive) return;

    if (!base || !enemyBase) { 
        animationFrameId = requestAnimationFrame(animate); 
        return; 
    }
    
    animationFrameId = requestAnimationFrame(animate);
    combatTimer++;
    inGameCoins += 10 / 60; // 매 프레임마다 자동 코인 획득

    // 쿨타임 감소
    for (let i = 0; i < currentSummonCooldowns.length; i++) {
        if (currentSummonCooldowns[i] > 0) {
            currentSummonCooldowns[i]--;
        }
    }
    
    // 화면 그리기
    drawGame();

    // 유닛 업데이트
    allies.forEach(ally => {
        ally.update();
    });

    enemies.forEach(enemy => {
        enemy.update();
    });

    // 유닛 제거 및 필터링 (HP가 0 이하인 유닛 제거)
    enemies = enemies.filter(enemy => enemy.hp > 0);
    allies = allies.filter(ally => ally.hp > 0);
    
    // 승패 판정
    if (base.hp <= 0) {
        endGame('lose');
        return;
    } else if (enemyBase.hp <= 0) { 
        endGame('win');
        return;
    }
    
    updateSummonControls(); 
}

function summonUnit(charKey, isAlly) {
    const stats = UNIT_STATS[charKey];
    if (stats) {
        // 아군은 오른쪽 기지 근처에서, 적군은 왼쪽 기지 근처에서 소환
        const spawnX = isAlly ? gameCanvas.width - ALLY_SUMMON_OFFSET_X - 50 : ALLY_SUMMON_OFFSET_X;
        
        const newUnit = new Unit(
            stats, 
            spawnX, 
            isAlly ? 'ally' : 'enemy',
            isAlly ? allies.length : enemies.length,
            charKey
        );
        
        if (isAlly) {
            allies.push(newUnit);
        } else {
            enemies.push(newUnit);
        }
    }
}

// 8. 전투 중 소환 로직 (추가)
// 소환 버튼을 렌더링하고 이벤트 리스너를 연결합니다.
function renderSummonControls() {
    const container = document.getElementById('summon-controls');
    container.innerHTML = '';
    
    gameState.formation.forEach((charKey, index) => {
        const slot = document.createElement('div');
        slot.className = 'summon-slot';
        slot.dataset.index = index;

        if (charKey) {
            const char = UNIT_STATS[charKey];
            const level = gameState.charLevels[charKey] || 1;
            const cost = char.cost || 10;
            
            slot.classList.add('unlocked');
            
            // 이미지 가져오기
            const img = unitImages[`${charKey}_base`];
            let imageHTML = '';
            
            if (img && img.complete) {
                // 이미지가 로드되었으면 이미지 사용
                imageHTML = `<img src="${img.src}" alt="${char.name}" style="width: 50px; height: 50px; object-fit: contain; margin-bottom: 2px;">`;
            } else {
                // 이미지가 없거나 로딩 중이면 아이콘 사용
                imageHTML = `<span class="char-icon">${char.icon}</span>`;
            }
            
            slot.innerHTML = `
                <div class="summon-slot-content">
                    ${imageHTML}
                    <span class="cooldown-text text-red-400 text-xs mt-1 hidden"></span>
                </div>
            `;
            
            slot.addEventListener('click', () => trySummonUnit(charKey, cost, index));
        } else {
            slot.classList.add('locked');
            slot.innerHTML = `<div class="summon-slot-content text-gray-400">빈 슬롯</div>`;
        }
        
        container.appendChild(slot);
    });
}

// 파워업을 시도하는 로직
function tryLevelUpPowerUp(type) {
    const currentLevel = gameState.powerUps[type];
    
    if (currentLevel >= MAX_GENERAL_LEVEL) {
        showMessage('이미 최대 레벨입니다!');
        return;
    }

    const costArray = POWER_UP_COSTS[type];
    // 배열 인덱스는 레벨 1 -> 2 (index 0)부터 시작합니다.
    const cost = costArray[currentLevel - 1]; 

    if (gameState.coins >= cost) {
        gameState.coins -= cost;
        gameState.powerUps[type] += 1;
        saveGameState();
        
        // UI를 다시 렌더링하여 변경 사항을 즉시 반영
        renderPowerUpScreen();
        
        showMessage(`${type === 'baseHp' ? '기지 HP' : '코인 획득량'} 레벨 업! (Lv. ${gameState.powerUps[type]})`);
    } else {
        showMessage('코인이 부족합니다!');
    }
}

// 파워업 화면을 렌더링합니다.
function renderPowerUpScreen() {
    document.getElementById('current-coins').textContent = `${Math.floor(gameState.coins)}`;
    
    // 1. 기지/코인 업그레이드 렌더링
    renderGeneralUpgrades();
    
    // 2. 캐릭터 레벨 업 렌더링
    renderCharacterUpgrades();
}

// 개별 파워업 항목을 DOM에 렌더링합니다. (renderPowerUpScreen 내부에서 사용)
function renderPowerUpItem(container, type, title, currentLevelText, description) {
    const currentLevel = gameState.powerUps[type];
    const isMaxLevel = currentLevel >= MAX_GENERAL_LEVEL;

    let cost = isMaxLevel ? 'MAX' : POWER_UP_COSTS[type][currentLevel - 1];
    let costText = isMaxLevel ? 'MAX' : `${cost}🪙`;
    let buttonText = isMaxLevel ? '최대 레벨' : '레벨 업';
    let buttonDisabled = isMaxLevel || gameState.coins < cost;
    
    // HTML 구조 생성
    const itemDiv = document.createElement('div');
    itemDiv.className = 'power-up-item p-4 bg-gray-700 rounded-lg shadow-md flex justify-between items-center';
    itemDiv.innerHTML = `
        <div class="info">
            <h4 class="text-lg font-semibold text-yellow-300">${title}</h4>
            <p class="text-sm text-gray-400">${description}</p>
            <p class="text-md mt-1">${currentLevelText}</p>
        </div>
        <div class="control text-right">
            <p class="text-xl font-bold ${isMaxLevel ? 'text-green-400' : 'text-yellow-400'}">${costText}</p>
            <button id="lvlUpBtn-${type}" class="btn text-sm mt-2" ${buttonDisabled ? 'disabled' : ''}>${buttonText}</button>
        </div>
    `;
    container.appendChild(itemDiv);

    // 이벤트 리스너 추가
    if (!isMaxLevel) {
        document.getElementById(`lvlUpBtn-${type}`).addEventListener('click', () => {
            tryLevelUpPowerUp(type);
        });
    }
}

// 매 프레임마다 소환 버튼의 쿨타임을 업데이트합니다.
function updateSummonControls() {
    gameState.formation.forEach((charKey, index) => {
        const slot = document.querySelector(`#summon-controls [data-index="${index}"]`);
        
        if (!slot) return; 
        if (!charKey || !UNIT_STATS[charKey]) return; 

        const cooldownText = slot.querySelector('.cooldown-text');
        
        if (!cooldownText) return; 
        
        const charCost = UNIT_STATS[charKey].cost || 10;
        const canAfford = Math.floor(inGameCoins) >= charCost;
        
        if (currentSummonCooldowns[index] > 0) {
            const remainingTime = Math.ceil(currentSummonCooldowns[index] / 60);
            cooldownText.textContent = `${remainingTime}s`;
            safeClassList(cooldownText, 'remove', 'hidden');
            safeClassList(slot, 'add', 'locked'); 
            
        } else {
            safeClassList(cooldownText, 'add', 'hidden');
            safeClassList(slot, 'remove', 'locked'); 

            // 코인 부족 시에도 잠금 처리
            if (!canAfford) {
                safeClassList(slot, 'add', 'locked');
            }
        }
    });
}

// 유닛 소환을 시도합니다.
function trySummonUnit(charKey, cost, index) {
    if (isPaused) return;

    // 안전 장치 추가
    if (!charKey || !UNIT_STATS[charKey]) {
        console.error("유효하지 않은 캐릭터 키:", charKey);
        return;
    }

    if (currentSummonCooldowns[index] > 0) {
        showMessage("아직 재사용 대기 시간입니다!");
        return;
    }

    if (inGameCoins < cost) {
        return;
    }
    
    // 1. 코인 차감
    inGameCoins -= cost;
    document.getElementById('coin-in-game').textContent = `코인: ${inGameCoins}`;

    // 2. 유닛 소환 (Ally)
    const stats = UNIT_STATS[charKey];
    const newAlly = new Unit(stats, gameCanvas.width - ALLY_SUMMON_OFFSET_X - 50, 'ally', allies.length, charKey);
    allies.push(newAlly);

    // 3. 쿨타임 적용
    currentSummonCooldowns[index] = SUMMON_COOLDOWN; 
}

// 9. 초기화 (게임 활성화 플래그 반영)
window.onload = async () => {
    await loadGameState();  // await 추가!
    
    const authCode = getOrCreateAuthCode();
    const authCodeDisplay = document.getElementById('authCodeDisplay');
    if (authCodeDisplay) {
        authCodeDisplay.textContent = authCode;
    }
    
    showScreen('start-screen');
}

// 이벤트 핸들러 분리
function handleGeneralUpgradeClick(e) {
    const key = e.target.dataset.key;
    upgradeGeneralPowerUp(key);
}

function handleCharacterUpgradeClick(e) {
    const charKey = e.target.dataset.key;
    upgradeCharacterLevel(charKey);
}


function renderGeneralUpgrades() {
    const listContainer = document.getElementById('general-power-up-list');
    if (!listContainer) return;
    
    // 기존 내용 완전히 제거
    listContainer.innerHTML = '';

    // gameState 검증
    if (!gameState || !gameState.powerUps) {
        console.error('gameState.powerUps가 정의되지 않음:', gameState);
        listContainer.innerHTML = '<p class="text-red-400">데이터 로드 오류</p>';
        return;
    }

    const keys = ['baseHp', 'coinGain'];
    keys.forEach(key => {
        const currentLevel = gameState.powerUps[key] || 1;
        const nextLevel = currentLevel + 1;
        const maxLevel = MAX_GENERAL_LEVEL;
        
        const costs = POWER_UP_COSTS[key] || [];
        const cost = costs[currentLevel - 1] || Infinity;

        const isMaxLevel = currentLevel >= maxLevel;
        const canAfford = gameState.coins >= cost;

        let name, effect;
        if (key === 'baseHp') {
            name = "기지 HP 증가";
            effect = `현재: ${BASE_HP_PER_LEVEL * currentLevel} / 다음: ${isMaxLevel ? 'MAX' : BASE_HP_PER_LEVEL * nextLevel}`;
        } else if (key === 'coinGain') {
            name = "코인 획득량 증가";
            const currentBonus = Math.round((currentLevel - 1) * COIN_GAIN_PER_LEVEL * 100);
            const nextBonus = Math.round(currentLevel * COIN_GAIN_PER_LEVEL * 100);
            effect = `현재: +${currentBonus}% / 다음: ${isMaxLevel ? 'MAX' : '+' + nextBonus + '%'}`;
        }

        const item = document.createElement('div');
        item.className = 'power-up-item';
        item.innerHTML = `
            <div class="text-left">
                <h3 class="text-xl font-bold text-yellow-300">${name} (Lv. ${currentLevel})</h3>
                <p class="text-gray-300 text-sm">${effect}</p>
            </div>
            <div class="text-right flex items-center gap-3">
                <span class="power-up-level-text">${isMaxLevel ? 'MAX' : cost + ' 🪙'}</span>
                <button data-key="${key}" class="buy-btn general-upgrade-btn" ${isMaxLevel || !canAfford ? 'disabled' : ''}>
                    ${isMaxLevel ? '최대 레벨' : '구입'}
                </button>
            </div>
        `;
        listContainer.appendChild(item);
    });
    
    // 이벤트 리스너 추가 (중복 방지)
    document.querySelectorAll('.general-upgrade-btn').forEach(btn => {
        // 기존 리스너 제거를 위해 새로 추가
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        
        newBtn.addEventListener('click', (e) => {
            const key = e.target.dataset.key;
            upgradeGeneralPowerUp(key);
        });
    });
}

function renderCharacterUpgrades() {
    const listContainer = document.getElementById('character-power-up-list');
    if (!listContainer) return;
    
    // 기존 내용 완전히 제거
    listContainer.innerHTML = '';
    
    // gameState 검증
    if (!gameState || !gameState.unlockedCharacters || !gameState.charLevels) {
        console.error('gameState 데이터 누락:', gameState);
        listContainer.innerHTML = '<p class="text-red-400">캐릭터 데이터 로드 오류</p>';
        return;
    }
    
    gameState.unlockedCharacters.forEach(key => {
        const char = UNIT_STATS[key];
        if (!char) {
            console.warn(`캐릭터 ${key}를 UNIT_STATS에서 찾을 수 없음`);
            return;
        }
        
        const currentLevel = gameState.charLevels[key] || 1;
        const nextLevel = currentLevel + 1;
        
        const cost = getCharLevelCost(currentLevel);
        const isMaxLevel = currentLevel >= MAX_CHAR_LEVEL;
        const canAfford = gameState.coins >= cost;

        // 현재 스탯
        const currentDamage = Math.round(char.damage * (char.damageMultiplier ** (currentLevel - 1)));
        const currentHp = Math.round(char.hp * (char.hpMultiplier ** (currentLevel - 1)));
        
        // 다음 레벨 스탯
        const nextDamage = Math.round(char.damage * (char.damageMultiplier ** currentLevel));
        const nextHp = Math.round(char.hp * (char.hpMultiplier ** currentLevel));

        const item = document.createElement('div');
        item.className = 'power-up-item';
        
        // 이미지 추가
        const img = unitImages[`${key}_base`];
        let imageHTML = '';
        if (img && img.complete) {
            imageHTML = `<img src="${img.src}" alt="${char.name}" style="width: 60px; height: 60px; object-fit: contain;">`;
        } else {
            imageHTML = `<span class="char-icon text-3xl">${char.icon}</span>`;
        }
        
        item.innerHTML = `
            <div class="text-left flex items-center gap-3">
                ${imageHTML}
                <div>
                    <h3 class="text-xl font-bold text-cyan-300">${char.name} (Lv. ${currentLevel})</h3>
                    <p class="text-gray-300 text-sm">
                        데미지: ${currentDamage} → ${isMaxLevel ? 'MAX' : nextDamage}
                    </p>
                    <p class="text-gray-300 text-sm">
                        HP: ${currentHp} → ${isMaxLevel ? 'MAX' : nextHp}
                    </p>
                </div>
            </div>
            <div class="text-right flex items-center gap-3">
                <span class="power-up-level-text">${isMaxLevel ? 'MAX' : cost + ' 🪙'}</span>
                <button data-key="${key}" class="buy-btn char-upgrade-btn" ${isMaxLevel || !canAfford ? 'disabled' : ''}>
                    ${isMaxLevel ? '최대 레벨' : '레벨 업'}
                </button>
            </div>
        `;
        listContainer.appendChild(item);
    });
    
    // 이벤트 리스너 추가 (중복 방지)
    document.querySelectorAll('.char-upgrade-btn').forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        
        newBtn.addEventListener('click', (e) => {
            const key = e.target.dataset.key;
            upgradeCharacterLevel(key);
        });
    });
}

function upgradeGeneralPowerUp(key) {
    const currentLevel = gameState.powerUps[key];
    const costs = POWER_UP_COSTS[key];
    const cost = costs[currentLevel - 1];

    if (currentLevel >= MAX_GENERAL_LEVEL) {
        showMessage("이미 최대 레벨입니다!");
        return;
    }

    if (Math.floor(gameState.coins) >= cost) {
        gameState.coins = Math.floor(gameState.coins) - cost;
        gameState.powerUps[key] += 1;

        saveGameState(); 
        showMessage(`${key === 'baseHp' ? '기지 HP' : '코인 획득량'} 레벨이 ${currentLevel + 1}로 증가했습니다!`);
        renderPowerUpScreen(); 
    } else {
        showMessage("코인이 부족합니다!");
    }
}

function upgradeCharacterLevel(charKey) {
    const currentLevel = gameState.charLevels[charKey] || 1;
    const cost = getCharLevelCost(currentLevel);

    if (currentLevel >= MAX_CHAR_LEVEL) {
        showMessage(`${UNIT_STATS[charKey].name}은(는) 이미 최대 레벨입니다!`);
        return;
    }

    if (Math.floor(gameState.coins) >= cost) {
        gameState.coins = Math.floor(gameState.coins) - cost;
        gameState.charLevels[charKey] = currentLevel + 1;

    saveGameState();
    showMessage(`${UNIT_STATS[charKey].name}의 레벨이 ${currentLevel + 1}로 증가했습니다!`);
    renderPowerUpScreen();
    } else {
        showMessage("코인이 부족합니다!");
    }
}

// 5. 캐릭터 편성 화면 로직
function renderCharacterSelection() {
    const poolContainer = document.getElementById('character-pool-container');
    const formationGrid = document.getElementById('formation-grid');
    
    if (!poolContainer || !formationGrid) return;

    poolContainer.innerHTML = '';
    formationGrid.innerHTML = '';
    
    // gameState 검증
    if (!gameState || !gameState.unlockedCharacters || !gameState.charLevels || !gameState.formation) {
        console.error('gameState 데이터 누락:', gameState);
        poolContainer.innerHTML = '<p class="text-red-400">캐릭터 데이터 로드 오류</p>';
        return;
    }
    
    // 1. 보유 캐릭터 풀 렌더링
    gameState.unlockedCharacters.forEach(key => {
        const char = UNIT_STATS[key];
        if (!char) {
            console.warn(`캐릭터 ${key}를 UNIT_STATS에서 찾을 수 없음`);
            return;
        }
        
        const level = gameState.charLevels[key] || 1;
        
        const slot = document.createElement('div');
        slot.className = `char-slot transition duration-150 hover:bg-gray-500 hover:scale-105`;
        slot.dataset.key = key;
        
        // 이미지 표시
        const img = unitImages[`${key}_base`];
        if (img && img.complete) {
            slot.innerHTML = `
                <img src="${img.src}" alt="${char.name}" style="width: 60px; height: 60px; object-fit: contain;">
                <span class="char-name">${char.name} Lv.${level}</span>
            `;
        } else {
            slot.innerHTML = `<span class="char-icon">${char.icon}</span><span class="char-name">${char.name} Lv.${level}</span>`;
        }
        
        const isFormed = gameState.formation.includes(key);
        if (isFormed) {
            slot.classList.add('selected');
            slot.classList.remove('hover:bg-gray-500', 'hover:scale-105');
        } else {
            slot.addEventListener('click', () => {
                addToFormation(key);
            });
        }

        poolContainer.appendChild(slot);
    });
    
    // 2. 편성 슬롯 렌더링
    for (let i = 0; i < FORMATION_SIZE; i++) {
        const slotKey = gameState.formation[i];
        const char = slotKey ? UNIT_STATS[slotKey] : null;
        
        const slot = document.createElement('div');
        slot.className = 'formation-slot transition duration-150';
        slot.dataset.index = i;

        if (char) {
            const img = unitImages[`${slotKey}_base`];
            if (img && img.complete) {
                slot.innerHTML = `<img src="${img.src}" alt="${char.name}" style="width: 60px; height: 60px; object-fit: contain;">`;
            } else {
                slot.innerHTML = `<span class="char-icon text-2xl">${char.icon}</span>`;
            }
            
            slot.classList.add('active', 'hover:bg-red-700');
            slot.addEventListener('click', () => {
                removeFromFormation(i);
            });
        } else {
            slot.innerHTML = '빈 슬롯';
            slot.classList.add('hover:bg-gray-700');
        }
        
        formationGrid.appendChild(slot);
    }
}

function addToFormation(key) {
    const firstEmptyIndex = gameState.formation.findIndex(slot => slot === null);
    if (firstEmptyIndex !== -1) {
        gameState.formation[firstEmptyIndex] = key;
        saveGameState();
        renderCharacterSelection(); 
    } else {
        showMessage(`편성 슬롯 (${FORMATION_SIZE}개)이 가득 찼습니다. 기존 캐릭터를 제외하세요.`);
    }
}

function removeFromFormation(index) {
    if (gameState.formation[index] !== null) {
        gameState.formation[index] = null;
        saveGameState();
        renderCharacterSelection(); 
    }
}

// 6. 이벤트 리스너 (새로운 내비게이션 흐름 적용)
const navigationMap = [
    // 1. 시작 -> 종족 선택
    { id: 'startButton', target: 'race-selection-screen' },
    // 1-1. 시작 -> 옵션(계정 찾기)
    { id: 'optionButton', target: 'account-find-screen' },
    // 2. 종족 선택 -> 장 선택
    { id: 'tokkaengiRace', target: 'chapter-selection-screen' },
    // 3. 장 선택 -> 홈
    { id: 'chapter1', target: 'home-screen' }, 

    // --- 홈 화면 메뉴 ---
    // 4a. 홈 -> 전투 맵
    { id: 'battleStartButton', target: 'battle-map-screen' }, 
    // 4b. 홈 -> 파워 업
    { id: 'powerUpButton', target: 'power-up-screen', preAction: renderPowerUpScreen }, 
    // 4c. 홈 -> 캐릭터 편성
    { id: 'characterButton', target: 'character-selection-screen', preAction: renderCharacterSelection }, 

    // --- 뒤로가기 버튼 (모두 goBack() 함수 사용) ---
    { id: 'backButton', action: goBack }, // 종족 선택 -> 뒤로가기 (시작 화면)
    { id: 'backToRaceButton', action: goBack }, // 장 선택 -> 뒤로가기 (종족 선택)
    { id: 'backToChapterButton', action: goBack }, // 홈 -> 뒤로가기 (장 선택)
    { id: 'backToHomeFromMapButton', action: goBack }, // 전투 맵 -> 뒤로가기 (홈 화면)
    { id: 'backToHomeFromPowerUpButton', action: goBack }, // 파워업 -> 뒤로가기 (홈 화면)
    { id: 'backToHomeFromCharacterButton', action: goBack }, // 캐릭터 편성 -> 뒤로가기 (홈 화면)
    { id: 'backToStartButton', action: goBack }, // 계정 찾기 -> 뒤로가기 (시작 화면)

    // --- 기타 버튼 ---
    { id: 'exitButton', action: () => {
        window.close();
        // window.close()가 실패할 경우를 대비
        setTimeout(() => {
            if (!window.closed) {
                showMessage('브라우저 정책으로 인해 창을 닫을 수 없습니다. 수동으로 닫아주세요.');
            }
        }, 100);
    } },
    // 게임 포기 버튼
    { id: 'exitGameButton', action: () => {
        if (isGameActive) {
            endGame('surrender');
        }
    } },
    
    // 일시정지 버튼 로직도 추가해야 합니다.
    { id: 'pauseButton', action: () => {
        if (isGameActive) {
            isPaused = !isPaused;
            document.getElementById('pauseButton').textContent = isPaused ? "계속하기" : "일시정지";
            if (!isPaused) animate(); // 정지 해제 시 애니메이션 재개
        }
    }},
];

// 잠금 컨텐츠 메시지
['otherRace1', 'otherRace2', 'chapter2', 'chapter3'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => {
        showMessage('이 컨텐츠는 아직 잠겨있습니다.');
    });
});

// 맵 마커 클릭 시 게임 시작 (편성 체크 추가)
document.querySelectorAll('.map-marker').forEach(marker => {
    marker.addEventListener('click', () => {
        // 편성된 캐릭터가 있는지 확인
        const hasFormation = gameState.formation.some(slot => slot !== null);
        if (hasFormation) {
            // 스테이지 ID 가져오기
            const stageId = marker.dataset.level;
            // startGame() 내부에서 showScreen('game-screen') 호출
            startGame(stageId);
        } else {
            showMessage("전투를 시작하려면 캐릭터를 1개 이상 편성해야 합니다.");
        }
    });
});

// 계정 찾기 기능
document.getElementById('findAccountButton')?.addEventListener('click', () => {
    const inputCode = document.getElementById('authCodeInput').value.trim().toUpperCase();
    const resultMessage = document.getElementById('findResultMessage');
    
    if (!inputCode) {
        resultMessage.textContent = '인증 코드를 입력해주세요.';
        resultMessage.className = 'text-center mt-4 text-sm text-red-400';
        resultMessage.classList.remove('hidden');
        return;
    }
    
    // 인증 코드 형식 검증
    const codePattern = /^HN-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
    if (!codePattern.test(inputCode)) {
        resultMessage.textContent = '올바른 형식이 아닙니다. (예: HN-XXXX-XXXX-XXXX)';
        resultMessage.className = 'text-center mt-4 text-sm text-red-400';
        resultMessage.classList.remove('hidden');
        return;
    }
    
    // 저장된 게임 데이터 불러오기 시도
    try {
        // 인증 코드로 저장된 데이터 키 생성
        const dataKey = `honyaiDefenseState_${inputCode}`;
        const storedData = localStorage.getItem(dataKey);
        
        if (storedData) {
            // 데이터가 있으면 현재 계정으로 덮어쓰기
            const confirmLoad = confirm(`해당 계정을 찾았습니다!\n현재 데이터를 덮어쓰시겠습니까?\n\n(현재 데이터는 사라집니다)`);
            
            if (confirmLoad) {
                // 기존 인증 코드 업데이트
                localStorage.setItem('honyaiAuthCode', inputCode);
                // 게임 데이터 복사
                localStorage.setItem('honyaiDefenseState', storedData);
                
                resultMessage.textContent = '계정을 불러왔습니다! 게임을 재시작합니다.';
                resultMessage.className = 'text-center mt-4 text-sm text-green-400';
                resultMessage.classList.remove('hidden');
                
                // 2초 후 페이지 새로고침
                setTimeout(() => {
                    location.reload();
                }, 2000);
            }
        } else {
            resultMessage.textContent = '해당 인증 코드로 저장된 계정을 찾을 수 없습니다.';
            resultMessage.className = 'text-center mt-4 text-sm text-red-400';
            resultMessage.classList.remove('hidden');
        }
    } catch (e) {
        resultMessage.textContent = '오류가 발생했습니다. 다시 시도해주세요.';
        resultMessage.className = 'text-center mt-4 text-sm text-red-400';
        resultMessage.classList.remove('hidden');
    }
});

// 계정 초기화 기능
document.getElementById('resetAccountButton')?.addEventListener('click', () => {
    const confirmReset = confirm('정말로 현재 계정을 초기화하시겠습니까?\n\n모든 데이터가 삭제되며 복구할 수 없습니다!');
    
    if (confirmReset) {
        // 현재 인증 코드 삭제
        localStorage.removeItem('honyaiAuthCode');
        // 게임 데이터 삭제
        localStorage.removeItem('honyaiDefenseState');
        
        alert('계정이 초기화되었습니다. 게임을 재시작합니다.');
        location.reload();
    }
});

// 7. 초기화
window.onload = async () => {
    await loadGameState();

    // 이미지 미리 로드
    await loadUnitImages();
    
    // 인증 코드 생성 및 표시
    const authCode = getOrCreateAuthCode();
    const authCodeDisplay = document.getElementById('authCodeDisplay');
    if (authCodeDisplay) {
        authCodeDisplay.textContent = authCode;
    }
    
    // 초기 화면을 시작 화면으로 설정
    showScreen('start-screen');
    
    // navigationMap 이벤트 등록을 여기로 이동
    navigationMap.forEach(el => {
        const button = document.getElementById(el.id);
        if (button) {
            button.addEventListener('click', () => {
                if (el.preAction) {
                    el.preAction();
                }
                if (el.action) {
                    el.action();
                }
                if (el.target) {
                    showScreen(el.target);
                }
            });
        }
    });
    
    // 잠금 컨텐츠 메시지
    ['otherRace1', 'otherRace2', 'chapter2', 'chapter3'].forEach(id => {
        document.getElementById(id)?.addEventListener('click', () => {
            showMessage('이 컨텐츠는 아직 잠겨있습니다.');
        });
    });
    
    // 맵 마커 클릭 시 게임 시작
    document.querySelectorAll('.map-marker').forEach(marker => {
        marker.addEventListener('click', () => {
            const hasFormation = gameState.formation.some(slot => slot !== null);
            if (hasFormation) {
                const stageId = marker.dataset.level;
                startGame(stageId);
            } else {
                showMessage("전투를 시작하려면 캐릭터를 1개 이상 편성해야 합니다.");
            }
        });
    });
    
    // 계정 찾기 기능
    const findAccountButton = document.getElementById('findAccountButton');
    if (findAccountButton) {
        findAccountButton.addEventListener('click', async () => {
            const inputCode = document.getElementById('authCodeInput').value.trim().toUpperCase();
            const resultMessage = document.getElementById('findResultMessage');
            
            if (!inputCode) {
                resultMessage.textContent = '인증 코드를 입력해주세요.';
                resultMessage.className = 'text-center mt-4 text-sm text-red-400';
                resultMessage.classList.remove('hidden');
                return;
            }
            
            const codePattern = /^HN-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
            if (!codePattern.test(inputCode)) {
                resultMessage.textContent = '올바른 형식이 아닙니다. (예: HN-XXXX-XXXX-XXXX)';
                resultMessage.className = 'text-center mt-4 text-sm text-red-400';
                resultMessage.classList.remove('hidden');
                return;
            }
            
            try {
                // 서버에서 계정 조회
                const response = await fetch(`${API_BASE_URL}/load/${inputCode}`);
                const data = await response.json();
                
                if (data.success && data.gameState) {
                    const confirmLoad = confirm(`해당 계정을 찾았습니다!\n코인: ${data.gameState.coins}\n\n현재 데이터를 덮어쓰시겠습니까?\n\n(현재 데이터는 사라집니다)`);
                    
                    if (confirmLoad) {
                        // 1. 기존 인증 코드 변경
                        localStorage.setItem('honyaiAuthCode', inputCode);
                        
                        // 2. 게임 데이터를 로컬스토리지에 저장
                        localStorage.setItem('honyaiDefenseState', JSON.stringify(data.gameState));
                        
                        // 3. 인증 코드별 백업도 저장
                        localStorage.setItem(`honyaiDefenseState_${inputCode}`, JSON.stringify(data.gameState));
                        
                        resultMessage.textContent = '계정을 불러왔습니다! 게임을 재시작합니다.';
                        resultMessage.className = 'text-center mt-4 text-sm text-green-400';
                        resultMessage.classList.remove('hidden');
                        
                        // 2초 후 페이지 새로고침
                        setTimeout(() => {
                            location.reload();
                        }, 2000);
                    }
                } else {
                    resultMessage.textContent = '해당 인증 코드로 저장된 계정을 찾을 수 없습니다.';
                    resultMessage.className = 'text-center mt-4 text-sm text-red-400';
                    resultMessage.classList.remove('hidden');
                }
            } catch (error) {
                console.error('계정 찾기 오류:', error);
                resultMessage.textContent = '서버 연결 오류가 발생했습니다. 다시 시도해주세요.';
                resultMessage.className = 'text-center mt-4 text-sm text-red-400';
                resultMessage.classList.remove('hidden');
            }
        });
    }
    
    // 계정 초기화 기능
    const resetAccountButton = document.getElementById('resetAccountButton');
    if (resetAccountButton) {
        resetAccountButton.addEventListener('click', () => {
            const confirmReset = confirm('정말로 현재 계정을 초기화하시겠습니까?\n\n모든 데이터가 삭제되며 복구할 수 없습니다!');
            
            if (confirmReset) {
                localStorage.removeItem('honyaiAuthCode');
                localStorage.removeItem('honyaiDefenseState');
                
                // 인증 코드별 백업도 삭제
                const currentAuthCode = getOrCreateAuthCode();
                localStorage.removeItem(`honyaiDefenseState_${currentAuthCode}`);
                
                alert('계정이 초기화되었습니다. 게임을 재시작합니다.');
                location.reload();
            }
        });
    }
}