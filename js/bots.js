// Bots.js - 18 Smart AI bots with realistic gamer nicknames
const BOT_NAMES = [
    'VoidWalker', 'NebulaHunter', 'CosmicStalker', 'DarkMatter', 'EventHorizon',
    'QuantumPhantom', 'Singularity', 'PlasmaReaper', 'NovaStriker', 'GravityWell',
    'PhotonGhost', 'Antimatter', 'WormholeRider', 'StarDevourer', 'EntropyAgent',
    'VoidKnight', 'NebulaWraith', 'CosmicTyrant'
];

const BOT_COLORS = [
    '#ff3366', '#ff6600', '#ffcc00', '#66ff33', '#00ff99',
    '#00ffff', '#3366ff', '#9933ff', '#ff33cc', '#ff0066',
    '#ccff00', '#00ffcc', '#ff9900', '#cc00ff', '#0099ff',
    '#ff0033', '#6600ff', '#ffff33'
];

const BOT_PERSONALITIES = [
    { aggression: 0.9, caution: 0.2, name: 'Berserker' },
    { aggression: 0.7, caution: 0.4, name: 'Hunter' },
    { aggression: 0.5, caution: 0.5, name: 'Balanced' },
    { aggression: 0.3, caution: 0.7, name: 'Scavenger' },
    { aggression: 0.1, caution: 0.9, name: 'Coward' }
];

export class Bot {
    constructor(index, world) {
        this.index = index;
        this.nickname = BOT_NAMES[index % BOT_NAMES.length] + (index >= BOT_NAMES.length ? `#${Math.floor(index / BOT_NAMES.length) + 1}` : '');
        this.color = BOT_COLORS[index % BOT_COLORS.length];
        this.glow = this.hexToRgba(this.color, 0.8);
        this.personality = BOT_PERSONALITIES[Math.floor(Math.random() * BOT_PERSONALITIES.length)];

        // Physics
        this.x = 0;
        this.y = 0;
        this.vx = 0;
        this.vy = 0;
        this.targetVx = 0;
        this.targetVy = 0;

        // Stats
        this.mass = 80 + Math.random() * 120; // 80-200 starting
        this.baseRadius = 10;
        this.radius = Math.sqrt(this.mass / Math.PI) * 1.5;
        this.maxSpeed = 5 + Math.random() * 1.5;
        this.acceleration = 0.12 + Math.random() * 0.06;
        this.friction = 0.9;

        // Dash
        this.dashCooldown = Math.random() * 3000;
        this.dashCooldownMax = 2000 + Math.random() * 2000;
        this.dashDuration = 0;
        this.dashDurationMax = 150 + Math.random() * 100;
        this.dashSpeed = 18 + Math.random() * 4;
        this.dashMassCost = 5;
        this.isDashing = false;
        this.dashDirection = { x: 0, y: 0 };
        this.dashTrail = [];

        // Evolution
        this.tier = 1;
        this.maxTier = 5;
        this.tierThresholds = [0, 500, 2000, 6000, 15000];
        this.tierColors = [
            { core: this.color, ring: this.color, aura: this.glow },
            { core: this.color, ring: this.color, aura: this.glow },
            { core: this.color, ring: this.color, aura: this.glow },
            { core: this.color, ring: this.color, aura: this.glow },
            { core: '#ffffff', ring: this.color, aura: this.glow }
        ];

        // AI
        this.target = null;
        this.targetType = null; // 'orb', 'player', 'bot', 'flee'
        this.decisionTimer = 0;
        this.decisionInterval = 200 + Math.random() * 300;
        this.wanderAngle = Math.random() * Math.PI * 2;
        this.wanderTimer = 0;
        this.lastKnownPlayerPos = { x: 0, y: 0 };
        this.stuckTimer = 0;
        this.lastPos = { x: 0, y: 0 };

        // Visual
        this.rotation = 0;
        this.pulsePhase = Math.random() * Math.PI * 2;
        this.ringPhases = [0, 0, 0];
        this.lastOrbCollect = 0;
        this.lastOrbColor = this.color;
        this.absorptionParticles = [];
        this.massPopups = [];

        // State
        this.alive = true;
        this.isBot = true;
        this.kills = 0;
        this.orbsEaten = 0;
        this.fragments = [];

        // Screen shake (for consistency)
        this.screenShake = 0;
    }

    hexToRgba(hex, alpha) {
        const h = hex.replace('#', '');
        const r = parseInt(h.substr(0, 2), 16);
        const g = parseInt(h.substr(2, 2), 16);
        const b = parseInt(h.substr(4, 2), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    spawn(x, y) {
        this.x = x;
        this.y = y;
        this.alive = true;
        this.mass = 80 + Math.random() * 120;
        this.radius = Math.sqrt(this.mass / Math.PI) * 1.5;
        this.tier = 1;
        this.kills = 0;
        this.orbsEaten = 0;
        this.vx = 0;
        this.vy = 0;
        this.dashCooldown = Math.random() * 2000;
    }

    update(deltaTime, world, player, bots, audio) {
        if (!this.alive) return;

        // Update dash cooldown
        if (this.dashCooldown > 0) this.dashCooldown -= deltaTime;

        // Update dash
        this.updateDash(deltaTime);

        // AI Decision making
        this.makeDecisions(deltaTime, world, player, bots);

        // Apply physics
        this.updatePhysics(deltaTime);

        // Constrain to world
        world.constrain(this);

        // Collect orbs
        const collected = world.checkOrbCollection(this);
        if (collected > 0) {
            this.orbsEaten += collected;
            this.createOrbParticles(collected);
        }

        // Check bot vs bot absorption
        this.checkBotAbsorption(bots);

        // Check player absorption
        this.checkPlayerAbsorption(player);

        // Update evolution
        this.updateTier();

        // Visual updates
        this.pulsePhase += 0.05 * deltaTime * 60;
        for (let i = 0; i < this.ringPhases.length; i++) {
            this.ringPhases[i] += (0.03 + i * 0.01) * deltaTime * 60;
        }

        // Update particles
        this.updateParticles(deltaTime);
        this.updateMassPopups(deltaTime);

        // Stuck detection
        this.checkStuck(deltaTime);

        // Update fragments
        this.updateFragments(deltaTime, world);
    }

    makeDecisions(deltaTime, world, player, bots) {
        this.decisionTimer += deltaTime;
        if (this.decisionTimer < this.decisionInterval) return;
        this.decisionTimer = 0;

        // Find nearest entities
        const nearbyOrbs = world.getNearbyOrbs(this.x, this.y, 400);
        let nearestOrb = null;
        let nearestOrbDist = Infinity;

        for (const orb of nearbyOrbs) {
            if (orb.collected) continue;
            const dist = Math.hypot(orb.x - this.x, orb.y - this.y);
            if (dist < nearestOrbDist) {
                nearestOrbDist = dist;
                nearestOrb = orb;
            }
        }

        // Check player
        let playerDist = Infinity;
        let canEatPlayer = false;
        let playerThreat = false;

        if (player && player.alive) {
            playerDist = Math.hypot(player.x - this.x, player.y - this.y);
            canEatPlayer = this.radius > player.radius * 1.15;
            playerThreat = player.radius > this.radius * 1.15;
            this.lastKnownPlayerPos = { x: player.x, y: player.y };
        }

        // Check other bots
        let nearestBot = null;
        let nearestBotDist = Infinity;
        let canEatBot = false;
        let botThreat = false;

        for (const bot of bots) {
            if (bot === this || !bot.alive) continue;
            const dist = Math.hypot(bot.x - this.x, bot.y - this.y);
            if (dist < nearestBotDist) {
                nearestBotDist = dist;
                nearestBot = bot;
                canEatBot = this.radius > bot.radius * 1.15;
                botThreat = bot.radius > this.radius * 1.15;
            }
        }

        // Check black holes
        let blackHoleThreat = false;
        for (const bh of world.blackHoles) {
            const dist = Math.hypot(bh.x - this.x, bh.y - this.y);
            if (dist < bh.pullRadius && this.radius > 30) {
                blackHoleThreat = true;
                break;
            }
        }

        // Decision logic based on personality
        const aggression = this.personality.aggression;
        const caution = this.personality.caution;

        // Priority 1: Flee from threats
        if ((playerThreat && playerDist < 500) || (botThreat && nearestBotDist < 400) || blackHoleThreat) {
            this.targetType = 'flee';
            if (playerThreat && playerDist < 500) {
                this.target = { x: player.x, y: player.y };
            } else if (botThreat) {
                this.target = { x: nearestBot.x, y: nearestBot.y };
            } else {
                // Flee from nearest black hole
                let nearestBH = null;
                let nearestBHDist = Infinity;
                for (const bh of world.blackHoles) {
                    const dist = Math.hypot(bh.x - this.x, bh.y - this.y);
                    if (dist < nearestBHDist) {
                        nearestBHDist = dist;
                        nearestBH = bh;
                    }
                }
                this.target = { x: nearestBH.x, y: nearestBH.y };
            }

            // Dash away if available
            if (this.dashCooldown <= 0 && this.mass > this.dashMassCost + 20) {
                this.startDashFromTarget();
            }
            return;
        }

        // Priority 2: Eat player if possible
        if (canEatPlayer && playerDist < 400 && aggression > 0.4) {
            this.targetType = 'player';
            this.target = player;
            if (this.dashCooldown <= 0 && playerDist < 200 && this.mass > this.dashMassCost + 30) {
                this.startDashTowardTarget();
            }
            return;
        }

        // Priority 3: Eat other bots
        if (canEatBot && nearestBotDist < 350 && aggression > 0.3) {
            this.targetType = 'bot';
            this.target = nearestBot;
            if (this.dashCooldown <= 0 && nearestBotDist < 180 && this.mass > this.dashMassCost + 30) {
                this.startDashTowardTarget();
            }
            return;
        }

        // Priority 4: Eat orbs
        if (nearestOrb && nearestOrbDist < 500) {
            this.targetType = 'orb';
            this.target = nearestOrb;
            return;
        }

        // Priority 5: Wander
        this.targetType = 'wander';
        this.target = null;
    }

    startDashTowardTarget() {
        if (!this.target) return;
        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 1) return;

        this.isDashing = true;
        this.dashDuration = this.dashDurationMax;
        this.dashCooldown = this.dashCooldownMax;
        this.mass -= this.dashMassCost;
        this.radius = Math.sqrt(this.mass / Math.PI) * 1.5;

        this.dashDirection.x = dx / dist;
        this.dashDirection.y = dy / dist;

        this.dashTrail = [];
        for (let i = 0; i < 6; i++) {
            this.dashTrail.push({
                x: this.x,
                y: this.y,
                radius: this.radius,
                alpha: 1 - i / 6
            });
        }
    }

    startDashFromTarget() {
        if (!this.target) return;
        const dx = this.x - this.target.x;
        const dy = this.y - this.target.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 1) return;

        this.isDashing = true;
        this.dashDuration = this.dashDurationMax;
        this.dashCooldown = this.dashCooldownMax;
        this.mass -= this.dashMassCost;
        this.radius = Math.sqrt(this.mass / Math.PI) * 1.5;

        this.dashDirection.x = dx / dist;
        this.dashDirection.y = dy / dist;

        this.dashTrail = [];
        for (let i = 0; i < 6; i++) {
            this.dashTrail.push({
                x: this.x,
                y: this.y,
                radius: this.radius,
                alpha: 1 - i / 6
            });
        }
    }

    updateDash(deltaTime) {
        if (this.dashCooldown > 0) {
            this.dashCooldown -= deltaTime;
        }

        if (this.isDashing) {
            this.dashDuration -= deltaTime;

            this.dashTrail.unshift({
                x: this.x,
                y: this.y,
                radius: this.radius,
                alpha: 1
            });
            if (this.dashTrail.length > 10) this.dashTrail.pop();

            this.vx = this.dashDirection.x * this.dashSpeed;
            this.vy = this.dashDirection.y * this.dashSpeed;

            if (this.dashDuration <= 0) {
                this.isDashing = false;
            }
        }

        for (const point of this.dashTrail) {
            point.alpha *= 0.85;
        }
        this.dashTrail = this.dashTrail.filter(p => p.alpha > 0.05);
    }

    updatePhysics(deltaTime) {
        if (this.isDashing) return;

        // Move toward target
        if (this.target && this.targetType !== 'flee' && this.targetType !== 'wander') {
            const dx = this.target.x - this.x;
            const dy = this.target.y - this.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 5) {
                const targetSpeed = this.getMaxSpeed();
                this.targetVx = (dx / dist) * targetSpeed;
                this.targetVy = (dy / dist) * targetSpeed;
            }
        } else if (this.targetType === 'flee' && this.target) {
            const dx = this.x - this.target.x;
            const dy = this.y - this.target.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 1) {
                const targetSpeed = this.getMaxSpeed() * 1.2; // Flee faster
                this.targetVx = (dx / dist) * targetSpeed;
                this.targetVy = (dy / dist) * targetSpeed;
            }
        } else {
            // Wander
            this.wanderTimer += deltaTime;
            if (this.wanderTimer > 2000 + Math.random() * 3000) {
                this.wanderAngle += (Math.random() - 0.5) * Math.PI * 0.5;
                this.wanderTimer = 0;
            }
            const wanderSpeed = this.getMaxSpeed() * 0.4;
            this.targetVx = Math.cos(this.wanderAngle) * wanderSpeed;
            this.targetVy = Math.sin(this.wanderAngle) * wanderSpeed;
        }

        // Smooth acceleration
        const accel = this.acceleration * deltaTime * 60;
        this.vx += (this.targetVx - this.vx) * accel;
        this.vy += (this.targetVy - this.vy) * accel;

        // Friction
        this.vx *= this.friction;
        this.vy *= this.friction;

        // Update position
        this.x += this.vx * deltaTime * 60;
        this.y += this.vy * deltaTime * 60;

        // Rotation
        if (Math.abs(this.vx) > 0.1 || Math.abs(this.vy) > 0.1) {
            this.rotation = Math.atan2(this.vy, this.vx);
        }
    }

    getMaxSpeed() {
        const massFactor = Math.min(1, 100 / Math.max(100, this.mass));
        return this.maxSpeed * (0.6 + 0.4 * massFactor);
    }

    checkStuck(deltaTime) {
        const dist = Math.hypot(this.x - this.lastPos.x, this.y - this.lastPos.y);
        if (dist < 0.5) {
            this.stuckTimer += deltaTime;
            if (this.stuckTimer > 2000) {
                this.wanderAngle += Math.PI + (Math.random() - 0.5) * Math.PI * 0.5;
                this.stuckTimer = 0;
            }
        } else {
            this.stuckTimer = 0;
        }
        this.lastPos.x = this.x;
        this.lastPos.y = this.y;
    }

    checkBotAbsorption(bots) {
        for (const bot of bots) {
            if (bot === this || !bot.alive) continue;
            const dx = bot.x - this.x;
            const dy = bot.y - this.y;
            const dist = Math.hypot(dx, dy);

            if (dist < this.radius + bot.radius) {
                if (this.radius > bot.radius * 1.15) {
                    // We eat them
                    const massGained = bot.mass * 0.8;
                    this.mass += massGained;
                    this.radius = Math.sqrt(this.mass / Math.PI) * 1.5;
                    this.kills++;
                    this.createAbsorptionParticles(bot, massGained);
                    bot.die();
                } else if (bot.radius > this.radius * 1.15) {
                    // They eat us
                    this.die();
                }
            }
        }
    }

    checkPlayerAbsorption(player) {
        if (!player || !player.alive || player.invulnerable) return;

        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist < this.radius + player.radius) {
            if (this.radius > player.radius * 1.15) {
                // Bot eats player
                player.die();
                const massGained = player.mass * 0.8;
                this.mass += massGained;
                this.radius = Math.sqrt(this.mass / Math.PI) * 1.5;
                this.kills++;
                this.createAbsorptionParticles(player, massGained);
            } else if (player.radius > this.radius * 1.15) {
                // Player eats bot
                const massGained = this.mass * 0.8;
                player.mass += massGained;
                player.radius = Math.sqrt(player.mass / Math.PI) * 1.5;
                player.kills++;
                player.createAbsorptionParticles(this, massGained);
                this.die();
            }
        }
    }

    updateTier() {
        for (let i = this.maxTier - 1; i >= 0; i--) {
            if (this.mass >= this.tierThresholds[i]) {
                this.tier = i + 1;
                break;
            }
        }
    }

    createOrbParticles(count) {
        for (let i = 0; i < count * 3; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 4;
            this.absorptionParticles.push({
                x: this.x,
                y: this.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                radius: 1.5 + Math.random() * 2,
                color: this.color,
                life: 600,
                maxLife: 600,
                type: 'orb'
            });
        }
    }

    createAbsorptionParticles(victim, massGained) {
        for (let i = 0; i < 15; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 3 + Math.random() * 6;
            this.absorptionParticles.push({
                x: victim.x || this.x,
                y: victim.y || this.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                radius: 2 + Math.random() * 3,
                color: victim.color || this.color,
                life: 800,
                maxLife: 800,
                type: 'absorption'
            });
        }

        this.massPopups.push({
            x: victim.x || this.x,
            y: victim.y || this.y - this.radius - 10,
            text: `+${Math.floor(massGained)}`,
            color: '#ffff00',
            life: 1200,
            maxLife: 1200,
            vy: -0.6
        });
    }

    updateParticles(deltaTime) {
        for (const p of this.absorptionParticles) {
            p.x += p.vx * deltaTime * 60;
            p.y += p.vy * deltaTime * 60;
            p.vx *= 0.98;
            p.vy *= 0.98;
            p.life -= deltaTime;
            p.radius *= 0.99;
        }
        this.absorptionParticles = this.absorptionParticles.filter(p => p.life > 0 && p.radius > 0.3);
    }

    updateMassPopups(deltaTime) {
        for (const p of this.massPopups) {
            p.y += p.vy * deltaTime * 60;
            p.vy *= 0.98;
            p.life -= deltaTime;
        }
        this.massPopups = this.massPopups.filter(p => p.life > 0);
    }

    updateFragments(deltaTime, world) {
        if (!this.fragments) return;
        for (const frag of this.fragments) {
            frag.x += frag.vx * deltaTime * 60;
            frag.y += frag.vy * deltaTime * 60;
            frag.vx *= 0.95;
            frag.vy *= 0.95;
            frag.life -= deltaTime;
            world.constrain(frag);
        }
        this.fragments = this.fragments.filter(f => f.life > 0);
    }

    die() {
        this.alive = false;
    }

    getTierColor() {
        return this.tierColors[this.tier - 1] || this.tierColors[0];
    }

    render(ctx, camera) {
        if (!this.alive) return;

        const sx = (this.x - camera.x) * camera.zoom;
        const sy = (this.y - camera.y) * camera.zoom;
        const sr = this.radius * camera.zoom;

        if (sr < 0.5) return;

        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(this.rotation);

        const tierColor = this.getTierColor();

        // Dash trail
        if (this.dashTrail.length > 0) {
            for (const point of this.dashTrail) {
                const tx = (point.x - this.x) * camera.zoom;
                const ty = (point.y - this.y) * camera.zoom;
                const tr = point.radius * camera.zoom * point.alpha;

                const trailGradient = ctx.createRadialGradient(tx, ty, 0, tx, ty, tr);
                trailGradient.addColorStop(0, this.hexToRgba(this.color, 0.3 * point.alpha));
                trailGradient.addColorStop(1, 'rgba(0,0,0,0)');

                ctx.fillStyle = trailGradient;
                ctx.beginPath();
                ctx.arc(tx, ty, tr, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Evolution aura (tier 3+)
        if (this.tier >= 3) {
            const auraAlpha = 0.1 + Math.sin(this.pulsePhase) * 0.05;
            const auraGradient = ctx.createRadialGradient(0, 0, sr, 0, 0, sr * (1.5 + this.tier * 0.3));
            auraGradient.addColorStop(0, this.hexToRgba(this.color, auraAlpha));
            auraGradient.addColorStop(1, 'rgba(0,0,0,0)');

            ctx.fillStyle = auraGradient;
            ctx.beginPath();
            ctx.arc(0, 0, sr * (1.5 + this.tier * 0.3), 0, Math.PI * 2);
            ctx.fill();
        }

        // Rotating rings (tier 2+)
        if (this.tier >= 2) {
            for (let i = 0; i < Math.min(this.tier, 2); i++) {
                const ringR = sr * (1.2 + i * 0.35);
                const ringPhase = this.ringPhases[i] + (i % 2 === 0 ? 0 : Math.PI);
                const ringAlpha = 0.25 + Math.sin(ringPhase) * 0.1;

                ctx.strokeStyle = this.hexToRgba(this.color, ringAlpha);
                ctx.lineWidth = Math.max(1, 1.5 * camera.zoom);
                ctx.beginPath();
                ctx.arc(0, 0, ringR, 0, Math.PI * 2);
                ctx.stroke();
            }
        }

        // Core body
        const coreGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, sr);
        const pulse = 1 + Math.sin(this.pulsePhase) * 0.06;
        coreGradient.addColorStop(0, this.lightenColor(this.color, 0.2));
        coreGradient.addColorStop(0.5, this.color);
        coreGradient.addColorStop(1, this.darkenColor(this.color, 0.3));

        ctx.fillStyle = coreGradient;
        ctx.beginPath();
        ctx.arc(0, 0, sr * pulse, 0, Math.PI * 2);
        ctx.fill();

        // Inner highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.beginPath();
        ctx.arc(-sr * 0.3, -sr * 0.3, sr * 0.3 * pulse, 0, Math.PI * 2);
        ctx.fill();

        // Bot indicator
        if (sr > 12) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.font = `bold ${Math.max(6, 8 * camera.zoom)}px monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('●', 0, 0);
        }

        ctx.restore();

        // Nickname
        if (sr > 10) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.font = `${Math.max(8, 10 * camera.zoom)}px 'Segoe UI', sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            const nameY = sy - sr - 4 * camera.zoom;
            ctx.fillText(this.nickname, sx + 1, nameY + 1);
            ctx.fillStyle = '#cccccc';
            ctx.fillText(this.nickname, sx, nameY);
        }

        // Render particles
        this.renderParticles(ctx, camera);
        this.renderMassPopups(ctx, camera);
        this.renderFragments(ctx, camera);
    }

    renderParticles(ctx, camera) {
        for (const p of this.absorptionParticles) {
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

    renderMassPopups(ctx, camera) {
        for (const p of this.massPopups) {
            const sx = (p.x - camera.x) * camera.zoom;
            const sy = (p.y - camera.y) * camera.zoom;
            const alpha = p.life / p.maxLife;

            ctx.globalAlpha = alpha;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.font = `bold 11px 'JetBrains Mono', monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(p.text, sx + 1, sy + 1);
            ctx.fillStyle = p.color;
            ctx.fillText(p.text, sx, sy);
        }
        ctx.globalAlpha = 1;
    }

    renderFragments(ctx, camera) {
        if (!this.fragments) return;
        for (const frag of this.fragments) {
            const sx = (frag.x - camera.x) * camera.zoom;
            const sy = (frag.y - camera.y) * camera.zoom;
            const sr = Math.max(0.5, frag.radius * camera.zoom);
            const alpha = frag.life / 10000;

            ctx.globalAlpha = alpha;
            const tierColor = this.tierColors[frag.tier - 1] || this.tierColors[0];
            const gradient = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
            gradient.addColorStop(0, tierColor.core);
            gradient.addColorStop(1, this.darkenColor(tierColor.core, 0.4));

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(sx, sy, sr, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    lightenColor(color, factor) {
        const hex = color.replace('#', '');
        const r = Math.min(255, parseInt(hex.substr(0, 2), 16) + 255 * factor);
        const g = Math.min(255, parseInt(hex.substr(2, 2), 16) + 255 * factor);
        const b = Math.min(255, parseInt(hex.substr(4, 2), 16) + 255 * factor);
        return `rgb(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)})`;
    }

    darkenColor(color, factor) {
        const hex = color.replace('#', '');
        const r = Math.max(0, parseInt(hex.substr(0, 2), 16) * (1 - factor));
        const g = Math.max(0, parseInt(hex.substr(2, 2), 16) * (1 - factor));
        const b = Math.max(0, parseInt(hex.substr(4, 2), 16) * (1 - factor));
        return `rgb(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)})`;
    }

    getState() {
        return {
            x: this.x,
            y: this.y,
            mass: this.mass,
            radius: this.radius,
            tier: this.tier,
            nickname: this.nickname,
            color: this.color,
            kills: this.kills,
            alive: this.alive,
            isBot: true
        };
    }
}

export class BotManager {
    constructor(world) {
        this.world = world;
        this.bots = [];
        this.botCount = 18;
    }

    init() {
        this.bots = [];
        for (let i = 0; i < this.botCount; i++) {
            const bot = new Bot(i, this.world);
            const pos = this.world.getRandomPosition(200);
            bot.spawn(pos.x, pos.y);
            this.bots.push(bot);
        }
    }

    update(deltaTime, player, audio) {
        // Update alive bots
        for (const bot of this.bots) {
            if (bot.alive) {
                bot.update(deltaTime, this.world, player, this.bots, audio);
            }
        }

        // Respawn dead bots
        const aliveCount = this.bots.filter(b => b.alive).length;
        if (aliveCount < this.botCount) {
            for (const bot of this.bots) {
                if (!bot.alive && Math.random() < 0.005 * deltaTime * 60) {
                    const pos = this.world.getRandomPosition(300);
                    bot.spawn(pos.x, pos.y);
                    bot.mass = 80 + Math.random() * 120;
                    bot.radius = Math.sqrt(bot.mass / Math.PI) * 1.5;
                    break;
                }
            }
        }
    }

    render(ctx, camera) {
        for (const bot of this.bots) {
            if (bot.alive) {
                bot.render(ctx, camera);
            }
        }
    }

    getAliveBots() {
        return this.bots.filter(b => b.alive);
    }

    getAllBots() {
        return this.bots;
    }

    getLeaderboardData() {
        return this.bots
            .filter(b => b.alive)
            .map(b => b.getState())
            .sort((a, b) => b.mass - a.mass);
    }
}