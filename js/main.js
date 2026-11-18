// Main.js - Game loop, camera, input, audio, and main coordination
import { World } from './world.js';
import { Player } from './player.js';
import { BotManager } from './bots.js';
import { UI, ScreenManager } from './ui.js';

// Audio System using Web Audio API
class AudioSystem {
    constructor() {
        this.audioContext = null;
        this.isMuted = false;
        this.masterGain = null;
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.audioContext.createGain();
            this.masterGain.connect(this.audioContext.destination);
            this.masterGain.gain.value = 0.3;
            this.initialized = true;
        } catch (e) {
            console.warn('Web Audio API not supported:', e);
        }
    }

    ensureContext() {
        if (!this.initialized) this.init();
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }

    setMuted(muted) {
        this.isMuted = muted;
        if (this.masterGain) {
            this.masterGain.gain.value = muted ? 0 : 0.3;
        }
    }

    playSound(frequency, duration, type = 'sine', options = {}) {
        if (this.isMuted || !this.audioContext) return;

        this.ensureContext();
        if (!this.audioContext) return;

        const now = this.audioContext.currentTime;
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.type = type;
        osc.frequency.value = frequency;
        osc.connect(gain);
        gain.connect(this.masterGain);

        const attack = options.attack || 0.01;
        const decay = options.decay || duration;
        const sustain = options.sustain || 0;
        const release = options.release || 0.1;
        const peakGain = options.gain || 0.3;

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(peakGain, now + attack);
        gain.gain.linearRampToValueAtTime(sustain * peakGain, now + attack + decay);
        gain.gain.linearRampToValueAtTime(0, now + attack + decay + release);

        osc.start(now);
        osc.stop(now + attack + decay + release + 0.05);

        return { osc, gain };
    }

    playOrbCollect() {
        // High-pitched pop
        this.playSound(800 + Math.random() * 400, 0.08, 'sine', {
            attack: 0.005,
            decay: 0.05,
            gain: 0.15
        });

        // Subtle harmonic
        setTimeout(() => {
            this.playSound(1600 + Math.random() * 800, 0.04, 'sine', {
                attack: 0.002,
                decay: 0.03,
                gain: 0.08
            });
        }, 10);
    }

    playBotAbsorption(massRatio) {
        // Deep bass boom based on mass gained
        const baseFreq = 60 + Math.min(massRatio * 20, 100);
        this.playSound(baseFreq, 0.3, 'sawtooth', {
            attack: 0.02,
            decay: 0.2,
            sustain: 0.3,
            release: 0.15,
            gain: 0.25
        });

        // Sub-bass
        this.playSound(baseFreq * 0.5, 0.4, 'sine', {
            attack: 0.05,
            decay: 0.3,
            gain: 0.2
        });

        // Harmonic series
        for (let i = 2; i <= 4; i++) {
            setTimeout(() => {
                this.playSound(baseFreq * i, 0.15, 'triangle', {
                    attack: 0.01,
                    decay: 0.1,
                    gain: 0.1 / i
                });
            }, i * 20);
        }
    }

    playDash() {
        // Whoosh sound
        this.playSound(200, 0.15, 'sawtooth', {
            attack: 0.01,
            decay: 0.1,
            release: 0.05,
            gain: 0.15
        });

        // High-frequency whoosh
        this.playSound(800, 0.1, 'square', {
            attack: 0.005,
            decay: 0.08,
            gain: 0.08
        });

        // Frequency sweep
        const now = this.audioContext?.currentTime || 0;
        if (this.audioContext) {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.15);
            osc.connect(gain);
            gain.connect(this.masterGain);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
            osc.start(now);
            osc.stop(now + 0.15);
        }
    }

    playEvolution() {
        // Ascending arpeggio
        const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99];
        notes.forEach((freq, i) => {
            setTimeout(() => {
                this.playSound(freq, 0.2, 'sine', {
                    attack: 0.02,
                    decay: 0.15,
                    gain: 0.15
                });
            }, i * 60);
        });

        // Shimmer
        for (let i = 0; i < 8; i++) {
            setTimeout(() => {
                this.playSound(1000 + Math.random() * 2000, 0.1, 'triangle', {
                    attack: 0.01,
                    decay: 0.08,
                    gain: 0.06
                });
            }, i * 40);
        }
    }

    playGameOver() {
        // Descending sad notes
        const notes = [392.00, 349.23, 329.63, 293.66, 261.63];
        notes.forEach((freq, i) => {
            setTimeout(() => {
                this.playSound(freq, 0.3, 'sine', {
                    attack: 0.05,
                    decay: 0.25,
                    gain: 0.12
                });
            }, i * 150);
        });

        // Low rumble
        this.playSound(40, 1.5, 'sawtooth', {
            attack: 0.2,
            decay: 1,
            gain: 0.1
        });
    }

    playBlackHoleHit() {
        // Scary distortion
        this.playSound(80, 0.3, 'square', {
            attack: 0.01,
            decay: 0.2,
            gain: 0.2
        });
        this.playSound(40, 0.5, 'sawtooth', {
            attack: 0.05,
            decay: 0.4,
            gain: 0.15
        });
    }
}

// Camera System
class Camera {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.x = 0;
        this.y = 0;
        this.zoom = 1;
        this.targetZoom = 1;
        this.lerpFactor = 0.08;
        this.zoomLerpFactor = 0.05;
    }

    update(player, deltaTime) {
        if (!player.alive) return;

        // Follow player
        const targetX = player.x - this.width / (2 * this.zoom);
        const targetY = player.y - this.height / (2 * this.zoom);

        this.x += (targetX - this.x) * this.lerpFactor * deltaTime * 60;
        this.y += (targetY - this.y) * this.lerpFactor * deltaTime * 60;

        // Calculate target zoom based on player size
        // Larger player = more zoomed out
        const baseZoom = 1;
        const maxZoomOut = 0.25;
        const massFactor = Math.min(1, player.mass / 20000);
        this.targetZoom = baseZoom - (baseZoom - maxZoomOut) * massFactor;

        // Smooth zoom
        this.zoom += (this.targetZoom - this.zoom) * this.zoomLerpFactor * deltaTime * 60;

        // Clamp to world bounds (will be set by world)
        this.zoom = Math.max(0.2, Math.min(2, this.zoom));
    }

    applyWorldBounds(worldWidth, worldHeight) {
        const viewW = this.width / this.zoom;
        const viewH = this.height / this.zoom;

        this.x = Math.max(0, Math.min(worldWidth - viewW, this.x));
        this.y = Math.max(0, Math.min(worldHeight - viewH, this.y));
    }

    worldToScreen(worldX, worldY) {
        return {
            x: (worldX - this.x) * this.zoom,
            y: (worldY - this.y) * this.zoom
        };
    }

    screenToWorld(screenX, screenY) {
        return {
            x: screenX / this.zoom + this.x,
            y: screenY / this.zoom + this.y
        };
    }

    getShakeOffset(shakeIntensity) {
        if (shakeIntensity <= 0) return { x: 0, y: 0 };
        const magnitude = shakeIntensity * 0.02;
        return {
            x: (Math.random() - 0.5) * magnitude * this.width,
            y: (Math.random() - 0.5) * magnitude * this.height
        };
    }
}

// Input System
class InputSystem {
    constructor(canvas) {
        this.canvas = canvas;
        this.mouseX = 0;
        this.mouseY = 0;
        this.mouseDown = false;
        this.spacePressed = false;
        this.keys = new Set();

        this.setupListeners();
    }

    setupListeners() {
        // Mouse
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = e.clientX - rect.left;
            this.mouseY = e.clientY - rect.top;
        });

        this.canvas.addEventListener('mousedown', (e) => {
            if (e.button === 0) this.mouseDown = true;
        });

        this.canvas.addEventListener('mouseup', (e) => {
            if (e.button === 0) this.mouseDown = false;
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.mouseDown = false;
        });

        // Touch
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = touch.clientX - rect.left;
            this.mouseY = touch.clientY - rect.top;
            this.mouseDown = true;
        }, { passive: false });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = touch.clientX - rect.left;
            this.mouseY = touch.clientY - rect.top;
        }, { passive: false });

        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.mouseDown = false;
        }, { passive: false });

        this.canvas.addEventListener('touchcancel', (e) => {
            this.mouseDown = false;
        });

        // Keyboard
        window.addEventListener('keydown', (e) => {
            this.keys.add(e.code);
            if (e.code === 'Space') {
                e.preventDefault();
                this.spacePressed = true;
            }
            if (e.code === 'KeyM') {
                if (this.onMuteToggle) this.onMuteToggle();
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keys.delete(e.code);
            if (e.code === 'Space') {
                this.spacePressed = false;
            }
        });

        // Prevent context menu
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    getInputState() {
        return {
            mouseX: this.mouseX,
            mouseY: this.mouseY,
            mouseDown: this.mouseDown,
            spacePressed: this.spacePressed,
            keys: this.keys
        };
    }
}

// Particle System for global effects
class ParticleSystem {
    constructor() {
        this.particles = [];
    }

    add(x, y, options = {}) {
        const count = options.count || 1;
        for (let i = 0; i < count; i++) {
            const angle = options.angle || Math.random() * Math.PI * 2;
            const speed = options.speed || 2 + Math.random() * 4;
            this.particles.push({
                x: x + (options.offsetX || 0),
                y: y + (options.offsetY || 0),
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                radius: options.radius || 2 + Math.random() * 3,
                color: options.color || '#00ffff',
                life: options.life || 800,
                maxLife: options.life || 800,
                gravity: options.gravity || 0,
                fade: options.fade !== false
            });
        }
    }

    update(deltaTime) {
        for (const p of this.particles) {
            p.x += p.vx * deltaTime * 60;
            p.y += p.vy * deltaTime * 60;
            p.vy += p.gravity * deltaTime * 60;
            p.vx *= 0.99;
            p.vy *= 0.99;
            p.life -= deltaTime;
            if (p.fade) p.radius *= 0.98;
        }
        this.particles = this.particles.filter(p => p.life > 0 && p.radius > 0.3);
    }

    render(ctx, camera) {
        for (const p of this.particles) {
            const sx = (p.x - camera.x) * camera.zoom;
            const sy = (p.y - camera.y) * camera.zoom;
            const sr = Math.max(0.5, p.radius * camera.zoom);
            const alpha = p.life / p.maxLife;

            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(sx, sy, sr, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    clear() {
        this.particles = [];
    }
}

// Main Game Class
class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        // Core systems
        this.world = new World();
        this.player = null;
        this.botManager = new BotManager(this.world);
        this.camera = new Camera(0, 0);
        this.input = new InputSystem(this.canvas);
        this.audio = new AudioSystem();
        this.particles = new ParticleSystem();
        this.ui = null;
        this.screenManager = new ScreenManager();

        // Game state
        this.running = false;
        this.lastTime = 0;
        this.deltaTime = 0;

        // Screen shake
        this.screenShake = 0;

        this.init();
    }

    init() {
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Initialize audio on first user interaction
        document.addEventListener('click', () => this.audio.init(), { once: true });
        document.addEventListener('keydown', () => this.audio.init(), { once: true });
        document.addEventListener('touchstart', () => this.audio.init(), { once: true, passive: true });

        // Setup UI
        this.ui = new UI(this.player, this.botManager, this.world);
        this.screenManager.onStart = () => this.startGame();
        this.screenManager.onRestart = () => this.restartGame();
        this.screenManager.onMuteToggle = (muted) => this.audio.setMuted(muted);
        this.input.onMuteToggle = () => {
            this.screenManager.toggleMute();
            this.audio.setMuted(this.screenManager.isMuted);
        };

        // Show start screen
        this.screenManager.showStart();
    }

    resize() {
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = window.innerWidth * dpr;
        this.canvas.height = window.innerHeight * dpr;
        this.canvas.style.width = window.innerWidth + 'px';
        this.canvas.style.height = window.innerHeight + 'px';
        this.ctx.scale(dpr, dpr);

        this.camera.width = window.innerWidth;
        this.camera.height = window.innerHeight;
    }

    startGame() {
        const nickname = this.screenManager.getNickname();
        const color = this.screenManager.getSelectedColor();

        // Initialize player
        this.player = new Player(nickname, color);
        const spawnPos = this.world.getRandomPosition(300);
        this.player.spawn(spawnPos.x, spawnPos.y);

        // Initialize bots
        this.botManager.init();

        // Update UI with player reference
        this.ui = new UI(this.player, this.botManager, this.world);

        // Camera initial position
        this.camera.x = this.player.x - this.camera.width / 2;
        this.camera.y = this.player.y - this.camera.height / 2;
        this.camera.zoom = 1;
        this.camera.targetZoom = 1;

        // Reset game state
        this.running = true;
        this.lastTime = performance.now();
        this.screenShake = 0;

        // Switch screens
        this.screenManager.showGame();

        // Start game loop
        requestAnimationFrame((time) => this.gameLoop(time));
    }

    restartGame() {
        // Reset world
        this.world = new World();

        // New player
        const nickname = this.screenManager.getNickname();
        const color = this.screenManager.getSelectedColor();
        this.player = new Player(nickname, color);
        const spawnPos = this.world.getRandomPosition(300);
        this.player.spawn(spawnPos.x, spawnPos.y);

        // New bots
        this.botManager = new BotManager(this.world);
        this.botManager.init();

        // Update UI
        this.ui = new UI(this.player, this.botManager, this.world);

        // Reset camera
        this.camera.x = this.player.x - this.camera.width / 2;
        this.camera.y = this.player.y - this.camera.height / 2;
        this.camera.zoom = 1;
        this.camera.targetZoom = 1;

        // Reset state
        this.running = true;
        this.lastTime = performance.now();
        this.screenShake = 0;
        this.particles.clear();

        // Switch screens
        this.screenManager.showGame();

        // Start game loop
        requestAnimationFrame((time) => this.gameLoop(time));
    }

    gameLoop(currentTime) {
        if (!this.running) return;

        // Calculate delta time
        this.deltaTime = Math.min(50, currentTime - this.lastTime); // Cap at 50ms
        this.lastTime = currentTime;
        const dt = this.deltaTime / 1000; // Convert to seconds

        // Update
        this.update(dt);

        // Render
        this.render();

        // Continue loop
        if (this.running) {
            requestAnimationFrame((time) => this.gameLoop(time));
        }
    }

    update(dt) {
        if (!this.player.alive) {
            this.handleGameOver();
            return;
        }

        // Get input
        const input = this.input.getInputState();

        // Update camera
        this.camera.update(this.player, dt);
        this.camera.applyWorldBounds(this.world.width, this.world.height);

        // Apply screen shake
        const shakeIntensity = Math.max(this.player.screenShake, this.screenShake);
        const shakeOffset = this.camera.getShakeOffset(shakeIntensity);
        this.camera.x += shakeOffset.x;
        this.camera.y += shakeOffset.y;

        // Update world
        const entities = [this.player, ...this.botManager.getAliveBots()];
        this.world.update(dt * 1000, entities);

        // Update player
        this.player.update(dt * 1000, this.world, input, this.audio);

        // Update bots
        this.botManager.update(dt * 1000, this.player, this.audio);

        // Update global particles
        this.particles.update(dt);

        // Update UI
        this.ui.update(dt * 1000, this.camera);

        // Check evolution tier up for sound
        // (handled in player.updateParticles)
    }

    handleGameOver() {
        this.running = false;

        // Calculate final rank
        const allEntities = [
            this.player.getState(),
            ...this.botManager.getLeaderboardData()
        ].sort((a, b) => b.mass - a.mass);

        const rank = allEntities.findIndex(e => e.nickname === this.player.nickname && !e.isBot) + 1;

        // Play game over sound
        this.audio.playGameOver();

        // Show game over screen
        this.ui.showGameOver(rank);
        this.screenManager.showGameOver();
    }

    render() {
        const ctx = this.ctx;
        const w = this.camera.width;
        const h = this.camera.height;

        // Clear
        ctx.fillStyle = '#050510';
        ctx.fillRect(0, 0, w, h);

        // Save context for camera transform
        ctx.save();

        // Apply camera transform
        ctx.translate(-this.camera.x * this.camera.zoom, -this.camera.y * this.camera.zoom);
        ctx.scale(this.camera.zoom, this.camera.zoom);

        // Render world (grid, black holes, orbs)
        this.world.render(ctx, this.camera);

        // Render bots
        this.botManager.render(ctx, this.camera);

        // Render player
        this.player.render(ctx, this.camera);

        // Render global particles
        this.particles.render(ctx, this.camera);

        ctx.restore();

        // Render screen-space UI (handled by HTML/CSS)
    }
}

// Initialize game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.game = new Game();
});

// Export for debugging
export { Game, AudioSystem, Camera, InputSystem, ParticleSystem };