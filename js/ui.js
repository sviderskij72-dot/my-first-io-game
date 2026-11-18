// UI.js - Leaderboard, minimap, HUD elements
export class UI {
    constructor(player, botManager, world) {
        this.player = player;
        this.botManager = botManager;
        this.world = world;

        // DOM Elements
        this.leaderboardList = document.getElementById('leaderboardList');
        this.minimapCanvas = document.getElementById('minimap');
        this.minimapCtx = this.minimapCanvas.getContext('2d');

        // Tier display
        this.tierIcon = document.getElementById('tierIcon');
        this.tierName = document.getElementById('tierName');
        this.tierLevel = document.getElementById('tierLevel');
        this.massValue = document.getElementById('massValue');

        // Game over stats
        this.finalMass = document.getElementById('finalMass');
        this.finalTier = document.getElementById('finalTier');
        this.finalKills = document.getElementById('finalKills');
        this.finalTime = document.getElementById('finalTime');
        this.rankDisplay = document.getElementById('rankDisplay');

        // Minimap settings
        this.minimapScale = 0.01875; // 150px / 8000px
        this.lastLeaderboardUpdate = 0;
        this.leaderboardUpdateInterval = 200; // ms
    }

    update(deltaTime, camera) {
        this.updateHUD();
        this.updateMinimap(camera);
        this.updateLeaderboard();
    }

    updateHUD() {
        if (!this.player.alive) return;

        const tierColor = this.player.getTierColor();
        this.tierIcon.style.color = tierColor.core;
        this.tierIcon.textContent = this.getTierIcon(this.player.tier);
        this.tierName.textContent = this.player.getTierName();
        this.tierLevel.textContent = this.player.getTierLevel();
        this.massValue.textContent = Math.floor(this.player.mass).toLocaleString();
    }

    getTierIcon(tier) {
        const icons = ['◆', '◈', '◆', '◇', '✦'];
        return icons[tier - 1] || '◆';
    }

    updateMinimap(camera) {
        const ctx = this.minimapCtx;
        const w = this.minimapCanvas.width;
        const h = this.minimapCanvas.height;

        // Clear
        ctx.fillStyle = 'rgba(10, 10, 18, 0.95)';
        ctx.fillRect(0, 0, w, h);

        // World border
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, w - 2, h - 2);

        // Grid lines (subtle)
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.05)';
        ctx.lineWidth = 0.5;
        const gridStep = 1000 * this.minimapScale;
        for (let x = gridStep; x < w; x += gridStep) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }
        for (let y = gridStep; y < h; y += gridStep) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }

        // Black holes
        for (const bh of this.world.blackHoles) {
            const mx = bh.x * this.minimapScale;
            const my = bh.y * this.minimapScale;
            const mr = Math.max(2, bh.radius * this.minimapScale);

            const gradient = ctx.createRadialGradient(mx, my, 0, mx, my, mr * 2);
            gradient.addColorStop(0, 'rgba(100, 0, 150, 0.6)');
            gradient.addColorStop(1, 'rgba(20, 0, 40, 0)');

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(mx, my, mr * 2, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = 'rgba(255, 0, 255, 0.8)';
            ctx.beginPath();
            ctx.arc(mx, my, mr, 0, Math.PI * 2);
            ctx.fill();
        }

        // Energy orbs (sampled for performance)
        const orbSampleRate = 0.15;
        ctx.fillStyle = 'rgba(0, 255, 255, 0.4)';
        for (const orb of this.world.orbs) {
            if (orb.collected) continue;
            if (Math.random() > orbSampleRate) continue;
            const mx = orb.x * this.minimapScale;
            const my = orb.y * this.minimapScale;
            ctx.beginPath();
            ctx.arc(mx, my, Math.max(0.5, 1 * this.minimapScale), 0, Math.PI * 2);
            ctx.fill();
        }

        // Bots
        for (const bot of this.botManager.getAliveBots()) {
            const mx = bot.x * this.minimapScale;
            const my = bot.y * this.minimapScale;
            const mr = Math.max(1.5, bot.radius * this.minimapScale);

            ctx.fillStyle = bot.color;
            ctx.beginPath();
            ctx.arc(mx, my, mr, 0, Math.PI * 2);
            ctx.fill();
        }

        // Player
        const px = this.player.x * this.minimapScale;
        const py = this.player.y * this.minimapScale;
        const pr = Math.max(2, this.player.radius * this.minimapScale);

        // Player indicator with pulse
        const pulse = 1 + Math.sin(Date.now() * 0.005) * 0.2;

        // Outer ring
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px, py, pr * pulse * 1.5, 0, Math.PI * 2);
        ctx.stroke();

        // Core
        const playerGradient = ctx.createRadialGradient(px, py, 0, px, py, pr);
        playerGradient.addColorStop(0, '#ffffff');
        playerGradient.addColorStop(0.5, '#00ffff');
        playerGradient.addColorStop(1, '#0088ff');

        ctx.fillStyle = playerGradient;
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.fill();

        // Direction indicator
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        const dirLen = pr * 1.8;
        ctx.moveTo(px, py);
        ctx.lineTo(
            px + Math.cos(this.player.rotation) * dirLen,
            py + Math.sin(this.player.rotation) * dirLen
        );
        ctx.stroke();

        // Camera viewport rectangle
        const camX = camera.x * this.minimapScale;
        const camY = camera.y * this.minimapScale;
        const camW = camera.width * camera.zoom * this.minimapScale;
        const camH = camera.height * camera.zoom * this.minimapScale;

        ctx.strokeStyle = 'rgba(0, 255, 255, 0.6)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(camX, camY, camW, camH);
        ctx.setLineDash([]);
    }

    updateLeaderboard() {
        const now = Date.now();
        if (now - this.lastLeaderboardUpdate < this.leaderboardUpdateInterval) return;
        this.lastLeaderboardUpdate = now;

        // Collect all entities
        const entities = [];

        // Player
        if (this.player.alive) {
            entities.push({
                ...this.player.getState(),
                isPlayer: true
            });
        }

        // Bots
        for (const bot of this.botManager.getAliveBots()) {
            entities.push(bot.getState());
        }

        // Sort by mass descending
        entities.sort((a, b) => b.mass - a.mass);

        // Top 10
        const top10 = entities.slice(0, 10);

        // Render
        this.leaderboardList.innerHTML = '';

        for (let i = 0; i < top10.length; i++) {
            const entity = top10[i];
            const li = document.createElement('li');
            if (entity.isPlayer) li.classList.add('player');

            const rank = document.createElement('span');
            rank.className = 'leaderboard-rank';
            rank.textContent = i + 1;

            const colorDot = document.createElement('span');
            colorDot.className = 'leaderboard-color';
            colorDot.style.backgroundColor = entity.color;
            colorDot.style.boxShadow = `0 0 8px ${entity.color}`;

            const name = document.createElement('span');
            name.className = 'leaderboard-name';
            name.textContent = entity.nickname + (entity.isBot ? ' [BOT]' : '');

            const mass = document.createElement('span');
            mass.className = 'leaderboard-mass';
            mass.textContent = this.formatMass(entity.mass);

            li.appendChild(rank);
            li.appendChild(colorDot);
            li.appendChild(name);
            li.appendChild(mass);

            this.leaderboardList.appendChild(li);
        }

        // Update rank display if player is not in top 10
        if (this.player.alive) {
            const playerRank = entities.findIndex(e => e.isPlayer) + 1;
            if (playerRank > 10 || playerRank === 0) {
                this.rankDisplay.textContent = `RANK: #${playerRank || '—'}`;
            } else {
                this.rankDisplay.textContent = '';
            }
        }
    }

    formatMass(mass) {
        if (mass >= 1000000) return (mass / 1000000).toFixed(1) + 'M';
        if (mass >= 1000) return (mass / 1000).toFixed(1) + 'K';
        return Math.floor(mass).toString();
    }

    showGameOver(rank) {
        this.finalMass.textContent = this.formatMass(this.player.mass);
        this.finalTier.textContent = this.player.getTierName();
        this.finalKills.textContent = this.player.kills;
        this.finalTime.textContent = this.formatTime(this.player.survivalTime);
        this.rankDisplay.textContent = `RANK: #${rank}`;
    }

    formatTime(ms) {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    renderMinimapOnly(camera) {
        // For cases where we only need minimap update
        this.updateMinimap(camera);
    }
}

// Screen management
export class ScreenManager {
    constructor() {
        this.screens = {
            start: document.getElementById('startScreen'),
            game: document.getElementById('gameUI'),
            gameOver: document.getElementById('gameOverScreen')
        };
        this.currentScreen = 'start';

        this.nicknameInput = document.getElementById('nickname');
        this.colorSelector = document.getElementById('colorSelector');
        this.startBtn = document.getElementById('startBtn');
        this.restartBtn = document.getElementById('restartBtn');
        this.muteBtn = document.getElementById('muteBtn');
        this.muteIcon = document.getElementById('muteIcon');
        this.unmuteIcon = document.getElementById('unmuteIcon');

        this.selectedColor = '#00ffff';
        this.isMuted = false;

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Color selection
        this.colorSelector.querySelectorAll('.color-option').forEach(option => {
            option.addEventListener('click', () => {
                this.selectColor(option.dataset.color);
            });
        });

        // Nickname input
        this.nicknameInput.addEventListener('input', () => {
            this.startBtn.disabled = this.nicknameInput.value.trim().length === 0;
        });

        // Start button
        this.startBtn.addEventListener('click', () => {
            if (this.onStart) this.onStart();
        });

        // Restart button
        this.restartBtn.addEventListener('click', () => {
            if (this.onRestart) this.onRestart();
        });

        // Mute button
        this.muteBtn.addEventListener('click', () => {
            this.toggleMute();
            if (this.onMuteToggle) this.onMuteToggle(this.isMuted);
        });

        // Enter key on nickname input
        this.nicknameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !this.startBtn.disabled) {
                if (this.onStart) this.onStart();
            }
        });
    }

    selectColor(color) {
        this.selectedColor = color;
        this.colorSelector.querySelectorAll('.color-option').forEach(opt => {
            opt.classList.toggle('selected', opt.dataset.color === color);
        });
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        this.muteIcon.style.display = this.isMuted ? 'none' : 'block';
        this.unmuteIcon.style.display = this.isMuted ? 'block' : 'none';
    }

    showStart() {
        this.hideAll();
        this.screens.start.classList.add('active');
        this.currentScreen = 'start';
        this.nicknameInput.focus();
    }

    showGame() {
        this.hideAll();
        this.screens.game.classList.add('active');
        this.currentScreen = 'game';
    }

    showGameOver() {
        this.hideAll();
        this.screens.gameOver.classList.add('active');
        this.currentScreen = 'gameOver';
    }

    hideAll() {
        Object.values(this.screens).forEach(screen => screen.classList.remove('active'));
    }

    getNickname() {
        return this.nicknameInput.value.trim().substring(0, 16) || 'VOID_PILOT';
    }

    getSelectedColor() {
        return this.selectedColor;
    }

    setMuted(muted) {
        this.isMuted = muted;
        this.muteIcon.style.display = muted ? 'none' : 'block';
        this.unmuteIcon.style.display = muted ? 'block' : 'none';
    }

    // Callbacks
    onStart() {}
    onRestart() {}
    onMuteToggle() {}
}