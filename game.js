// Game configuration
const CONFIG = {
    gridSize: 20,
    cellSize: 20,
    initialSpeed: 150,
    speedIncrement: 5,
    foodPoints: 10
};

// Game state
let canvas, ctx;
let snake = [];
let food = {};
let direction = 'RIGHT';
let nextDirection = 'RIGHT';
let score = 0;
let highScore = 0;
let gameLoop = null;
let gameSpeed = CONFIG.initialSpeed;
let gameState = 'START'; // START, PLAYING, PAUSED, GAMEOVER
let particles = [];

// Smooth rendering
let lastRenderTime = 0;
let smoothTransition = 0;

// Audio system
let audioContext;
let audioEnabled = true;
let touchStartX = 0;
let touchStartY = 0;

// AK47 Power-up System (Auto-Navigation)
let ak47State = 'LOCKED'; // LOCKED, UNLOCKED, COOLDOWN
let ak47TimerInterval = null;
let ak47CooldownRemaining = 0;
let ak47AmmoRemaining = 0;
let autoNavActive = false;
let lastTapTime = 0;
const AK47_SHOTS_LIMIT = 5; // Auto-shoot at 5 apples
const AK47_COOLDOWN = 300; // 5 minutes cooldown
const AK47_UNLOCK_SCORE = 50; // 5 apples

// Initialize game
document.addEventListener('DOMContentLoaded', () => {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');

    // Load high score
    highScore = localStorage.getItem('snakeHighScore') || 0;
    updateScoreDisplay();

    // Show start overlay
    document.getElementById('startOverlay').classList.add('active');

    // Event listeners
    document.getElementById('startBtn').addEventListener('click', startGame);
    document.getElementById('restartBtn').addEventListener('click', restartGame);
    document.addEventListener('keydown', handleKeyPress);

    // Audio toggle
    const audioToggle = document.getElementById('audioToggle');
    audioToggle.addEventListener('click', toggleAudio);

    // Mobile touch controls
    const controlButtons = document.querySelectorAll('.control-btn');
    controlButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const direction = e.currentTarget.getAttribute('data-direction');
            handleDirectionInput(direction);
            playSound('click', 0.1);
        });
    });

    // Swipe gesture detection
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });

    // Initialize audio context on first user interaction
    document.body.addEventListener('click', initAudio, { once: true });
    document.body.addEventListener('touchstart', initAudio, { once: true });

    // AK47 activation listeners
    document.addEventListener('keydown', handleAK47Activation);
    canvas.addEventListener('dblclick', activateAK47);

    // Theme toggle
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = themeToggle.querySelector('.theme-icon');

    // Load saved theme
    const savedTheme = localStorage.getItem('snakeGameTheme') || 'dark';
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
        themeIcon.textContent = '☀️';
    }

    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('light-theme');
        const isLight = document.body.classList.contains('light-theme');
        themeIcon.textContent = isLight ? '☀️' : '🌙';
        localStorage.setItem('snakeGameTheme', isLight ? 'light' : 'dark');
        playSound('click', 0.1);
    });

    // Initialize snake
    resetSnake();
    generateFood();

    // Draw initial state
    draw();
});

// Reset snake to initial position
function resetSnake() {
    snake = [
        { x: 10, y: 10 },
        { x: 9, y: 10 },
        { x: 8, y: 10 }
    ];
}

// Start game
function startGame() {
    document.getElementById('startOverlay').classList.remove('active');
    gameState = 'PLAYING';
    direction = 'RIGHT';
    nextDirection = 'RIGHT';
    score = 0;
    gameSpeed = CONFIG.initialSpeed;
    updateScoreDisplay();
    resetSnake();
    generateFood();
    playSound('start');
    updateAK47Display();
    startGameLoop();
}

// Restart game after game over
function restartGame() {
    document.getElementById('gameOverlay').classList.remove('active');
    startGame();
}

// Start game loop
function startGameLoop() {
    if (gameLoop) clearInterval(gameLoop);
    gameLoop = setInterval(update, gameSpeed);
}

// Handle keyboard input
function handleKeyPress(e) {
    if (gameState !== 'PLAYING' && gameState !== 'PAUSED') return;

    // Pause/Resume
    if (e.code === 'Space') {
        e.preventDefault();
        togglePause();
        return;
    }

    if (gameState === 'PAUSED') return;

    // Direction controls (Arrow keys and WASD)
    switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
            if (direction !== 'DOWN') nextDirection = 'UP';
            e.preventDefault();
            break;
        case 'ArrowDown':
        case 's':
        case 'S':
            if (direction !== 'UP') nextDirection = 'DOWN';
            e.preventDefault();
            break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
            if (direction !== 'RIGHT') nextDirection = 'LEFT';
            e.preventDefault();
            break;
        case 'ArrowRight':
        case 'd':
        case 'D':
            if (direction !== 'LEFT') nextDirection = 'RIGHT';
            e.preventDefault();
            break;
    }
}

// Handle AK47 activation with F key
function handleAK47Activation(e) {
    if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        activateAK47();
    }
}

// Toggle pause
function togglePause() {
    if (gameState === 'PLAYING') {
        gameState = 'PAUSED';
        clearInterval(gameLoop);
    } else if (gameState === 'PAUSED') {
        gameState = 'PLAYING';
        startGameLoop();
    }
}

// Update game state
function update() {
    if (gameState !== 'PLAYING') return;

    // Update direction
    direction = nextDirection;

    // Calculate new head position
    const head = { ...snake[0] };
    switch (direction) {
        case 'UP':
            head.y--;
            break;
        case 'DOWN':
            head.y++;
            break;
        case 'LEFT':
            head.x--;
            break;
        case 'RIGHT':
            head.x++;
            break;
    }

    // Check wall collision
    if (head.x < 0 || head.x >= CONFIG.gridSize || head.y < 0 || head.y >= CONFIG.gridSize) {
        gameOver();
        return;
    }

    // Check self collision
    if (snake.some(segment => segment.x === head.x && segment.y === head.y)) {
        gameOver();
        return;
    }

    // Add new head
    snake.unshift(head);

    // Check food collision
    if (head.x === food.x && head.y === food.y) {
        score += CONFIG.foodPoints;
        updateScoreDisplay();
        generateFood();
        createParticles(food.x, food.y);
        playSound('eat');

        // Check if AK47 should be unlocked
        if (score >= AK47_UNLOCK_SCORE && ak47State === 'LOCKED') {
            ak47State = 'UNLOCKED';
            ak47AmmoRemaining = AK47_SHOTS_LIMIT;
            updateAK47Display();
            playSound('unlock');
        }

        // If auto-nav is active and we reached the apple, decrement ammo
        if (autoNavActive && ak47AmmoRemaining > 0) {
            ak47AmmoRemaining--;
            autoNavActive = false;
            updateAK47Display();

            if (ak47AmmoRemaining === 0) {
                deactivateAK47();
            }
        }

        // Increase speed every 50 points
        if (score % 50 === 0 && gameSpeed > 50) {
            gameSpeed -= CONFIG.speedIncrement;
            startGameLoop();
        }
    } else {
        // Remove tail if no food eaten
        snake.pop();
    }

    // Auto-navigation if active
    if (autoNavActive && gameState === 'PLAYING') {
        autoNavigateToApple();
    }

    // Update particles
    updateParticles();

    // Draw everything
    draw();
}

// Generate food at random position
function generateFood() {
    let newFood;
    let validPosition = false;

    while (!validPosition) {
        newFood = {
            x: Math.floor(Math.random() * CONFIG.gridSize),
            y: Math.floor(Math.random() * CONFIG.gridSize)
        };

        // Check if food is not on snake
        validPosition = !snake.some(segment => segment.x === newFood.x && segment.y === newFood.y);
    }

    food = newFood;
}

// Create particle effect with smooth animation (optimized)
function createParticles(x, y) {
    const particleCount = 8; // Reduced for better performance
    for (let i = 0; i < particleCount; i++) {
        const angle = (Math.PI * 2 * i) / particleCount;
        const speed = 2 + Math.random() * 2;
        particles.push({
            x: x * CONFIG.cellSize + CONFIG.cellSize / 2,
            y: y * CONFIG.cellSize + CONFIG.cellSize / 2,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1,
            size: 2 + Math.random() * 1.5
        });
    }
}

// Update particles with smooth physics (optimized)
function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];

        // Apply velocity
        p.x += p.vx;
        p.y += p.vy;

        // Simplified physics
        p.vy += 0.12; // Gravity
        p.vx *= 0.99; // Air friction
        p.vy *= 0.99;

        // Faster fade out
        p.life -= 0.03;

        // Remove dead particles
        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }
}

// Draw everything
function draw() {
    // Clear canvas
    ctx.fillStyle = '#131318';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid (subtle)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= CONFIG.gridSize; i++) {
        ctx.beginPath();
        ctx.moveTo(i * CONFIG.cellSize, 0);
        ctx.lineTo(i * CONFIG.cellSize, canvas.height);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, i * CONFIG.cellSize);
        ctx.lineTo(canvas.width, i * CONFIG.cellSize);
        ctx.stroke();
    }

    // Draw food with glow
    const foodX = food.x * CONFIG.cellSize;
    const foodY = food.y * CONFIG.cellSize;

    // Glow effect
    const gradient = ctx.createRadialGradient(
        foodX + CONFIG.cellSize / 2,
        foodY + CONFIG.cellSize / 2,
        0,
        foodX + CONFIG.cellSize / 2,
        foodY + CONFIG.cellSize / 2,
        CONFIG.cellSize
    );
    gradient.addColorStop(0, 'rgba(255, 0, 110, 0.4)');
    gradient.addColorStop(1, 'rgba(255, 0, 110, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(foodX - 5, foodY - 5, CONFIG.cellSize + 10, CONFIG.cellSize + 10);

    // Food
    ctx.fillStyle = '#ff006e';
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#ff006e';
    ctx.beginPath();
    ctx.arc(foodX + CONFIG.cellSize / 2, foodY + CONFIG.cellSize / 2, CONFIG.cellSize / 2 - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Draw snake
    snake.forEach((segment, index) => {
        const x = segment.x * CONFIG.cellSize;
        const y = segment.y * CONFIG.cellSize;

        // Snake gradient from head to tail
        const alpha = 1 - (index / snake.length) * 0.5;

        if (index === 0) {
            // Head with special glow
            ctx.fillStyle = '#00f5ff';
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#00f5ff';
        } else {
            ctx.fillStyle = `rgba(0, 245, 255, ${alpha})`;
            ctx.shadowBlur = 10;
            ctx.shadowColor = 'rgba(0, 245, 255, 0.5)';
        }

        ctx.fillRect(x + 1, y + 1, CONFIG.cellSize - 2, CONFIG.cellSize - 2);
        ctx.shadowBlur = 0;

        // Inner shine
        if (index === 0) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.fillRect(x + 3, y + 3, CONFIG.cellSize - 6, CONFIG.cellSize - 6);
        }
    });

    // Draw particles with size variation
    particles.forEach(p => {
        ctx.fillStyle = `rgba(255, 0, 110, ${p.life})`;
        ctx.shadowBlur = 5;
        ctx.shadowColor = 'rgba(255, 0, 110, 0.5)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    });

    // Draw bullets if AK47 is active
    if (ak47State === 'ACTIVE') {
        drawBullets();
    }
}

// Update score display
function updateScoreDisplay() {
    const scoreElement = document.getElementById('score');
    const highScoreElement = document.getElementById('highScore');

    scoreElement.textContent = score;
    highScoreElement.textContent = highScore;

    // Add animation
    scoreElement.classList.remove('updated');
    void scoreElement.offsetWidth; // Trigger reflow
    scoreElement.classList.add('updated');
}

// Game over
function gameOver() {
    gameState = 'GAMEOVER';
    clearInterval(gameLoop);
    playSound('gameOver');

    // Update high score
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('snakeHighScore', highScore);
        updateScoreDisplay();
    }

    // Show game over overlay
    document.getElementById('finalScore').textContent = score;
    document.getElementById('gameOverlay').classList.add('active');
}

// Audio System using Web Audio API
function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playSound(type, volume = 0.3) {
    if (!audioEnabled || !audioContext) return;

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    const now = audioContext.currentTime;

    switch (type) {
        case 'eat':
            oscillator.frequency.setValueAtTime(800, now);
            oscillator.frequency.exponentialRampToValueAtTime(400, now + 0.1);
            gainNode.gain.setValueAtTime(volume, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            oscillator.start(now);
            oscillator.stop(now + 0.1);
            break;
        case 'gameOver':
            oscillator.frequency.setValueAtTime(400, now);
            oscillator.frequency.exponentialRampToValueAtTime(100, now + 0.5);
            gainNode.gain.setValueAtTime(volume, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
            oscillator.start(now);
            oscillator.stop(now + 0.5);
            break;
        case 'start':
            oscillator.frequency.setValueAtTime(200, now);
            oscillator.frequency.exponentialRampToValueAtTime(400, now + 0.2);
            gainNode.gain.setValueAtTime(volume, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
            oscillator.start(now);
            oscillator.stop(now + 0.2);
            break;
        case 'click':
            oscillator.frequency.setValueAtTime(600, now);
            gainNode.gain.setValueAtTime(volume * 0.5, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
            oscillator.start(now);
            oscillator.stop(now + 0.05);
            break;
        case 'unlock':
            oscillator.frequency.setValueAtTime(400, now);
            oscillator.frequency.exponentialRampToValueAtTime(800, now + 0.3);
            gainNode.gain.setValueAtTime(volume, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            oscillator.start(now);
            oscillator.stop(now + 0.3);
            break;
        case 'activate':
            oscillator.frequency.setValueAtTime(600, now);
            oscillator.frequency.exponentialRampToValueAtTime(1200, now + 0.4);
            gainNode.gain.setValueAtTime(volume, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
            oscillator.start(now);
            oscillator.stop(now + 0.4);
            break;
        case 'shoot':
            oscillator.type = 'square';
            oscillator.frequency.setValueAtTime(200, now);
            gainNode.gain.setValueAtTime(volume, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
            oscillator.start(now);
            oscillator.stop(now + 0.05);
            break;
    }
}

function toggleAudio() {
    audioEnabled = !audioEnabled;
    const audioToggle = document.getElementById('audioToggle');

    if (audioEnabled) {
        audioToggle.classList.remove('muted');
        audioToggle.querySelector('.audio-icon').textContent = '🔊';
    } else {
        audioToggle.classList.add('muted');
        audioToggle.querySelector('.audio-icon').textContent = '🔇';
    }

    playSound('click', 0.1);
}

// Touch and swipe controls
function handleTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
}

function handleTouchEnd(e) {
    e.preventDefault();
    if (!e.changedTouches || e.changedTouches.length === 0) return;

    const touch = e.changedTouches[0];
    const touchEndX = touch.clientX;
    const touchEndY = touch.clientY;

    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;
    const minSwipeDistance = 30;

    // Determine swipe direction
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // Horizontal swipe
        if (Math.abs(deltaX) > minSwipeDistance) {
            if (deltaX > 0) {
                handleDirectionInput('RIGHT');
            } else {
                handleDirectionInput('LEFT');
            }
        }
    } else {
        // Vertical swipe
        if (Math.abs(deltaY) > minSwipeDistance) {
            if (deltaY > 0) {
                handleDirectionInput('DOWN');
            } else {
                handleDirectionInput('UP');
            }
        }
    }
}

function handleDirectionInput(dir) {
    if (gameState !== 'PLAYING' || autoNavActive) return; // Don't allow manual input during auto-nav

    switch (dir) {
        case 'UP':
            if (direction !== 'DOWN') nextDirection = 'UP';
            break;
        case 'DOWN':
            if (direction !== 'UP') nextDirection = 'DOWN';
            break;
        case 'LEFT':
            if (direction !== 'RIGHT') nextDirection = 'LEFT';
            break;
        case 'RIGHT':
            if (direction !== 'LEFT') nextDirection = 'RIGHT';
            break;
    }
}

// ==== AK47 AUTO-NAVIGATION SYSTEM ====

// Auto-navigate snake toward apple
function autoNavigateToApple() {
    if (!autoNavActive || gameState !== 'PLAYING') return;

    const head = snake[0];
    const dx = food.x - head.x;
    const dy = food.y - head.y;

    // Simple pathfinding: prioritize larger distance
    if (Math.abs(dx) > Math.abs(dy)) {
        // Move horizontally
        if (dx > 0 && direction !== 'LEFT') {
            nextDirection = 'RIGHT';
        } else if (dx < 0 && direction !== 'RIGHT') {
            nextDirection = 'LEFT';
        } else if (dy > 0 && direction !== 'UP') {
            nextDirection = 'DOWN';
        } else if (dy < 0 && direction !== 'DOWN') {
            nextDirection = 'UP';
        }
    } else {
        // Move vertically
        if (dy > 0 && direction !== 'UP') {
            nextDirection = 'DOWN';
        } else if (dy < 0 && direction !== 'DOWN') {
            nextDirection = 'UP';
        } else if (dx > 0 && direction !== 'LEFT') {
            nextDirection = 'RIGHT';
        } else if (dx < 0 && direction !== 'RIGHT') {
            nextDirection = 'LEFT';
        }
    }
}

// Activate AK47 auto-navigation
function activateAK47() {
    if (ak47State !== 'UNLOCKED' || gameState !== 'PLAYING' || ak47AmmoRemaining <= 0 || autoNavActive) return;

    autoNavActive = true;
    playSound('activate');
}

// Deactivate AK47 and start cooldown
function deactivateAK47() {
    ak47State = 'COOLDOWN';
    ak47CooldownRemaining = AK47_COOLDOWN;
    autoNavActive = false;

    // Start cooldown timer
    if (ak47TimerInterval) clearInterval(ak47TimerInterval);
    ak47TimerInterval = setInterval(() => {
        ak47CooldownRemaining--;
        updateAK47Display();

        if (ak47CooldownRemaining <= 0) {
            clearInterval(ak47TimerInterval);
            ak47State = 'LOCKED';
            ak47AmmoRemaining = 0;
            updateAK47Display();
            playSound('unlock'); // Play sound when cooldown finishes
        }
    }, 1000);

    updateAK47Display();
}

// Update AK47 display
function updateAK47Display() {
    const ak47Status = document.getElementById('ak47Status');
    const ak47Label = document.getElementById('ak47Label');
    const ak47Timer = document.getElementById('ak47Timer');
    const ak47Prompt = document.getElementById('ak47Prompt');

    // Remove all state classes
    ak47Status.classList.remove('unlocked', 'active', 'cooldown');

    if (ak47State === 'LOCKED') {
        ak47Label.textContent = 'Locked';
        ak47Timer.textContent = '';
        ak47Prompt.classList.remove('show');
    } else if (ak47State === 'UNLOCKED') {
        ak47Status.classList.add('unlocked');
        ak47Label.textContent = 'Auto-Nav';
        ak47Timer.textContent = `${ak47AmmoRemaining} Ammo`;
        ak47Prompt.classList.add('show');
    } else if (ak47State === 'COOLDOWN') {
        ak47Status.classList.add('cooldown');
        ak47Label.textContent = 'Cooldown';
        ak47Prompt.classList.remove('show');

        const minutes = Math.floor(ak47CooldownRemaining / 60);
        const seconds = ak47CooldownRemaining % 60;
        ak47Timer.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        ak47Timer.classList.add('warning');
    }
}
