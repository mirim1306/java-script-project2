const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

// JSON 파싱을 위한 미들웨어
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// MySQL 데이터베이스 연결 설정
const db = mysql.createConnection(process.env.MYSQL_PUBLIC_URL);

// MySQL 연결
db.connect((err) => {
    if (err) {
        console.error('MySQL 연결 실패:', err);
        return;
    }
    console.log('MySQL 데이터베이스에 연결되었습니다.');
});

// 기본 라우트
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'honyai_great_war.html'));
});

// API: 새 사용자 생성
app.post('/api/user/create', async (req, res) => {
    const { auth_code } = req.body;
    
    try {
        // 1. 사용자 생성
        await new Promise((resolve, reject) => {
            db.query('INSERT INTO users (auth_code, coins) VALUES (?, 100)', [auth_code], 
                (err) => err ? reject(err) : resolve()
            );
        });
        
        // 2. 기본 챕터 생성
        await new Promise((resolve, reject) => {
            db.query(
                'INSERT INTO chapters (auth_code, chapter_name, unlocked, highest_level) VALUES (?, ?, ?, ?)',
                [auth_code, 'chapter1', true, 0],
                (err) => err ? reject(err) : resolve()
            );
        });
        
        // 3. 기본 파워업 생성
        await new Promise((resolve, reject) => {
            db.query(
                'INSERT INTO power_ups (auth_code, powerup_type, level) VALUES (?, ?, ?), (?, ?, ?)',
                [auth_code, 'baseHp', 1, auth_code, 'coinGain', 1],
                (err) => err ? reject(err) : resolve()
            );
        });
        
        // 4. 기본 캐릭터 생성
        const defaultChars = ['ally1', 'ally2', 'ally3', 'ally4'];
        for (const charKey of defaultChars) {
            await new Promise((resolve, reject) => {
                db.query(
                    'INSERT INTO characters (auth_code, character_key, level, unlocked) VALUES (?, ?, ?, ?)',
                    [auth_code, charKey, 1, true],
                    (err) => err ? reject(err) : resolve()
                );
            });
        }
        
        // 5. 빈 편성 생성
        for (let i = 0; i < 10; i++) {
            await new Promise((resolve, reject) => {
                db.query(
                    'INSERT INTO formations (auth_code, slot_index, character_key) VALUES (?, ?, ?)',
                    [auth_code, i, null],
                    (err) => err ? reject(err) : resolve()
                );
            });
        }
        
        console.log(`✅ 새 사용자 생성: ${auth_code}`);
        res.json({ success: true, message: '사용자 생성 완료' });
        
    } catch (error) {
        console.error('사용자 생성 오류:', error);
        res.status(500).json({ success: false, message: '사용자 생성 실패' });
    }
});

// API: 사용자 정보 조회
app.get('/api/user/:auth_code', (req, res) => {
    const { auth_code } = req.params;
    
    const sql = 'SELECT * FROM users WHERE auth_code = ?';
    
    db.query(sql, [auth_code], (err, results) => {
        if (err) {
            console.error('사용자 조회 오류:', err);
            return res.status(500).json({ success: false, message: '조회 실패' });
        }
        
        if (results.length === 0) {
            return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다' });
        }
        
        res.json({ success: true, user: results[0] });
    });
});

// API: 게임 데이터 전체 저장
app.post('/api/save', async (req, res) => {
    const { auth_code, gameState } = req.body;
    
    try {
        // 1. 코인 업데이트
        await new Promise((resolve, reject) => {
            db.query('UPDATE users SET coins = ?, last_login = NOW() WHERE auth_code = ?', 
                [gameState.coins, auth_code], 
                (err) => err ? reject(err) : resolve()
            );
        });
        
        // 2. 챕터 저장
        if (gameState.chapters) {
            for (const [chapterName, data] of Object.entries(gameState.chapters)) {
                await new Promise((resolve, reject) => {
                    db.query(
                        'INSERT INTO chapters (auth_code, chapter_name, unlocked, highest_level) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE unlocked = ?, highest_level = ?',
                        [auth_code, chapterName, data.unlocked, data.highestLevel, data.unlocked, data.highestLevel],
                        (err) => err ? reject(err) : resolve()
                    );
                });
            }
        }
        
        // 3. 파워업 저장
        if (gameState.powerUps) {
            for (const [type, level] of Object.entries(gameState.powerUps)) {
                await new Promise((resolve, reject) => {
                    db.query(
                        'INSERT INTO power_ups (auth_code, powerup_type, level) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE level = ?',
                        [auth_code, type, level, level],
                        (err) => err ? reject(err) : resolve()
                    );
                });
            }
        }
        
        // 4. 캐릭터 저장
        if (gameState.charLevels) {
            for (const [charKey, level] of Object.entries(gameState.charLevels)) {
                const unlocked = gameState.unlockedCharacters?.includes(charKey) || false;
                await new Promise((resolve, reject) => {
                    db.query(
                        'INSERT INTO characters (auth_code, character_key, level, unlocked) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE level = ?, unlocked = ?',
                        [auth_code, charKey, level, unlocked, level, unlocked],
                        (err) => err ? reject(err) : resolve()
                    );
                });
            }
        }
        
        // 5. 편성 저장 (기존 편성 삭제 후 재생성)
        await new Promise((resolve, reject) => {
            db.query('DELETE FROM formations WHERE auth_code = ?', [auth_code], 
                (err) => err ? reject(err) : resolve()
            );
        });
        
        if (gameState.formation) {
            for (let i = 0; i < gameState.formation.length; i++) {
                await new Promise((resolve, reject) => {
                    db.query(
                        'INSERT INTO formations (auth_code, slot_index, character_key) VALUES (?, ?, ?)',
                        [auth_code, i, gameState.formation[i]],
                        (err) => err ? reject(err) : resolve()
                    );
                });
            }
        }
        
        console.log(`✅ 서버 저장 완료: ${auth_code}`);
        res.json({ success: true, message: '저장 완료' });
        
    } catch (error) {
        console.error('저장 오류:', error);
        res.status(500).json({ success: false, message: '저장 실패' });
    }
});

// API: 게임 데이터 전체 불러오기
app.get('/api/load/:auth_code', async (req, res) => {
    const { auth_code } = req.params;
    
    try {
        // 1. 사용자 기본 정보
        const userResults = await new Promise((resolve, reject) => {
            db.query('SELECT * FROM users WHERE auth_code = ?', [auth_code], 
                (err, results) => err ? reject(err) : resolve(results)
            );
        });
        
        if (userResults.length === 0) {
            return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다' });
        }
        
        const gameData = {
            coins: userResults[0].coins,
            chapters: {},
            powerUps: {},
            charLevels: {},
            unlockedCharacters: [],
            formation: []
        };
        
        // 2. 챕터 로드
        const chapterResults = await new Promise((resolve, reject) => {
            db.query('SELECT * FROM chapters WHERE auth_code = ?', [auth_code], 
                (err, results) => err ? reject(err) : resolve(results)
            );
        });

        console.log('챕터 결과:', chapterResults); // 이 줄 추가

        chapterResults.forEach(row => {
            gameData.chapters[row.chapter_name] = {
                unlocked: row.unlocked,
                highestLevel: row.highest_level
            };
        });
        
        // 3. 파워업 로드
        const powerUpResults = await new Promise((resolve, reject) => {
            db.query('SELECT * FROM power_ups WHERE auth_code = ?', [auth_code], 
                (err, results) => err ? reject(err) : resolve(results)
            );
        });

        console.log('파워업 결과:', powerUpResults);
        
        powerUpResults.forEach(row => {
            gameData.powerUps[row.powerup_type] = row.level;
        });
        
        // 4. 캐릭터 로드
        const charResults = await new Promise((resolve, reject) => {
            db.query('SELECT * FROM characters WHERE auth_code = ?', [auth_code], 
                (err, results) => err ? reject(err) : resolve(results)
            );
        });

        console.log('캐릭터 결과:', charResults);
        
        charResults.forEach(row => {
            gameData.charLevels[row.character_key] = row.level;
            if (row.unlocked) {
                gameData.unlockedCharacters.push(row.character_key);
            }
        });
        
        // 5. 편성 로드
        const formationResults = await new Promise((resolve, reject) => {
            db.query('SELECT * FROM formations WHERE auth_code = ? ORDER BY slot_index', [auth_code], 
                (err, results) => err ? reject(err) : resolve(results)
            );
        });

        console.log('편성 결과:', formationResults);
        
        // 10개 슬롯 초기화
        gameData.formation = Array(10).fill(null);
        formationResults.forEach(row => {
            gameData.formation[row.slot_index] = row.character_key;
        });
        
        // 데이터가 비어있으면 기본값 설정
        if (Object.keys(gameData.chapters).length === 0) {
            gameData.chapters = {
                chapter1: { unlocked: true, highestLevel: 0 },
                chapter2: { unlocked: false, highestLevel: 0 },
                chapter3: { unlocked: false, highestLevel: 0 }
            };
        }

        if (Object.keys(gameData.powerUps).length === 0) {
            gameData.powerUps = {
                baseHp: 1,
                coinGain: 1
            };
        }

        if (Object.keys(gameData.charLevels).length === 0) {
            gameData.charLevels = {
                ally1: 1, ally2: 1, ally3: 1, ally4: 1
            };
        }

        if (gameData.unlockedCharacters.length === 0) {
            gameData.unlockedCharacters = ['ally1', 'ally2', 'ally3', 'ally4'];
        }

        console.log(`✅ 서버에서 게임 데이터 로드: ${auth_code}`);
        console.log('최종 gameData:', gameData); // 이 줄 추가
        res.json({ success: true, gameState: gameData });
        
    } catch (error) {
        console.error('로드 오류:', error);
        res.status(500).json({ success: false, message: '로드 실패' });
    }
});

// 서버 시작
app.listen(PORT, () => {
    console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});