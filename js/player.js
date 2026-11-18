// Player.js - Player entity with movement, growth, dash, and evolution tiers
export class Player {
    constructor(nickname, color) {
        this.nickname = nickname;
        this.color = color;
        this.glow = this.color.replace(')', ', 0.8)').replace('rgb', 'rgba').replace('#', '');

        // Convert hex to rgba for glow
        this.glow = this.hexToRgba(this.color, 0.8);

        // Physics
        this.x = 0;
        this.y = 0;
        this.vx = 0;
        this.vy = 0;
        this.targetVx = 0;
        this.targetVy = 0;

        // Stats
        this.mass = 100;
        this.baseRadius = 12;
        this.radius = this.baseRadius;
        this.maxSpeed = 6;
        this.acceleration = 0.15;
        this.friction = 0.92;

        // Dash
        this.dashCooldown = 0;
        this.dashCooldownMax = 1500; // ms
        this.dashDuration = 0;
        this.dashDurationMax = 200; // ms
        this.dashSpeed = 22;
        this.dashMassCost = 5;
        this.isDashing = false;
        this.dashDirection = { x: 0, y: 0 };
        this.dashTrail = [];

        // Evolution
        this.tier = 1;
        this.maxTier = 5;
        this.tierNames = ['SPARK', 'PLASMA CORE', 'NOVA SPHERE', 'SINGULARITY', 'COSMIC LEVIATHAN'];
        this.tierThresholds = [0, 500, 2000, 6000, 15000];
        this.tierColors = [
            { core: '#00ffff', ring: '#00ffff', aura: 'rgba(0, 255, 255, 0.3)' },
            { core: '#ff00ff', ring: '#ff00ff', aura: 'rgba(255, 0, 255, 0.3)' },
            { core: '#ffff00', ring: '#ffff00', aura: 'rgba(255, 255, 0, 0.3)' },
            { core: '#ff4444', ring: '#ff8800', aura: 'rgba(255, 68, 68, 0.4)' },
            { core: '#ffffff', ring: '#ff00ff', aura: 'rgba(255, 255, 255, 0.5)' }
        ];

        // Visual
        this.rotation = 0;
        this.pulsePhase = 0;
        this.ringPhases = [0, 0, 0];
        this.lastOrbCollect = 0;
        this.lastOrbColor = '#00ffff';
        this.lastAbsorption = 0;
        this.absorptionParticles = [];
        this.massPopups = [];

        // Input
        this.mouseX = 0;
        this.mouseY = 0;
        this.isMouseDown = false;

        // Score
        this.kills = 0;
        this.orbsEaten = 0;
        this.startTime = Date.now();
        this.survivalTime = 0;

        // State
        this.alive = true;
        this.invulnerable = false;
        this.invulnerableTime = 0;
        this.fragments = [];

        // Screen shake
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
        this.mass = 100;
        this.radius = this.baseRadius;
        this.tier = 1;
        this.kills = 0;
        this.orbsEaten = 0;
        this.startTime = Date.now();
        this.vx = 0;
        this.vy = 0;
        this.invulnerable = true;
        this.invulnerableTime = 3000;
        this.screenShake = 0;
    }

    update(deltaTime, world, input, audio) {
        if (!this.alive) return;

        this.survivalTime = Date.now() - this.startTime;

        // Update invulnerability
        if (this.invulnerable) {
            this.invulnerableTime -= deltaTime;
            if (this.invulnerableTime <= 0) this.invulnerable = false;
        }

        // Handle input
        this.handleInput(input, deltaTime);

        // Update dash
        this.updateDash(deltaTime, audio);

        // Apply physics
        this.updatePhysics(deltaTime);

        // Constrain to world bounds
        world.constrain(this);

        // Collect orbs
        const collected = world.checkOrbCollection(this);
        if (collected > 0) {
            this.orbsEaten += collected;
            audio.playOrbCollect();
            this.createOrbParticles(collected);
        }

        // Update evolution tier
        this.updateTier();

        // Update visual effects
        this.pulsePhase += 0.05 * deltaTime * 60;
        for (let i = 0; i < this.ringPhases.length; i++) {
            this.ringPhases[i] += (0.03 + i * 0.01) * deltaTime * 60;
        }

        // Update particles
        this.updateParticles(deltaTime);

        // Update mass popups
        this.updateMassPopups(deltaTime);

        // Update screen shake
        if (this.screenShake > 0) {
            this.screenShake = Math.max(0, this.screenShake - deltaTime);
        }

        // Update fragments
        this.updateFragments(deltaTime, world);
    }

    handleInput(input, deltaTime) {
        // Mouse/touch movement
        if (input.mouseX !== undefined && input.mouseY !== undefined) {
            this.mouseX = input.mouseX;
            this.mouseY = input.mouseY;
        }

        // Calculate direction to cursor
        const dx = this.mouseX - this.x;
        const dy = this.mouseY - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 5) {
            const targetSpeed = this.getMaxSpeed();
            this.targetVx = (dx / dist) * targetSpeed;
            this.targetVy = (dy / dist) * targetSpeed;
        } else {
            this.targetVx = 0;
            this.targetVy = 0;
        }

        // Dash input
        if ((input.spacePressed || input.mouseDown) && this.canDash()) {
            this.startDash(dx, dy, dist);
        }
    }

    getMaxSpeed() {
        // Larger mass = slightly slower base speed
        const massFactor = Math.min(1, 100 / Math.max(100, this.mass));
        return this.maxSpeed * (0.6 + 0.4 * massFactor);
    }

    canDash() {
        return this.dashCooldown <= 0 && this.mass > this.dashMassCost + 20;
    }

    startDash(dx, dy, dist) {
        if (dist < 1) return;

        this.isDashing = true;
        this.dashDuration = this.dashDurationMax;
        this.dashCooldown = this.dashCooldownMax;
        this.mass -= this.dashMassCost;
        this.radius = Math.sqrt(this.mass / Math.PI) * 1.5;

        this.dashDirection.x = dx / dist;
        this.dashDirection.y = dy / dist;

        this.dashTrail = [];
        for (let i = 0; i < 8; i++) {
            this.dashTrail.push({
                x: this.x,
                y: this.y,
                radius: this.radius,
                alpha: 1 - i / 8
            });
        }
    }

    updateDash(deltaTime, audio) {
        if (this.dashCooldown > 0) {
            this.dashCooldown -= deltaTime;
        }

        if (this.isDashing) {
            this.dashDuration -= deltaTime;

            // Add trail point
            this.dashTrail.unshift({
                x: this.x,
                y: this.y,
                radius: this.radius,
                alpha: 1
            });
            if (this.dashTrail.length > 12) this.dashTrail.pop();

            // Dash velocity
            this.vx = this.dashDirection.x * this.dashSpeed;
            this.vy = this.dashDirection.y * this.dashSpeed;

            if (this.dashDuration <= 0) {
                this.isDashing = false;
                audio.playDash();
            }
        }

        // Fade trail
        for (const point of this.dashTrail) {
            point.alpha *= 0.85;
        }
        this.dashTrail = this.dashTrail.filter(p => p.alpha > 0.05);
    }

    updatePhysics(deltaTime) {
        if (this.isDashing) return;

        // Smooth acceleration toward target
        const accel = this.acceleration * deltaTime * 60;
        this.vx += (this.targetVx - this.vx) * accel;
        this.vy += (this.targetVy - this.vy) * accel;

        // Apply friction
        this.vx *= this.friction;
        this.vy *= this.friction;

        // Update position
        this.x += this.vx * deltaTime * 60;
        this.y += this.vy * deltaTime * 60;

        // Update rotation based on velocity
        if (Math.abs(this.vx) > 0.1 || Math.abs(this.vy) > 0.1) {
            this.rotation = Math.atan2(this.vy, this.vx);
        }
    }

    updateTier() {
        for (let i = this.maxTier - 1; i >= 0; i--) {
            if (this.mass >= this.tierThresholds[i]) {
                if (this.tier !== i + 1) {
                    const oldTier = this.tier;
                    this.tier = i + 1;
                    if (this.tier > oldTier) {
                        this.onTierUp();
                    }
                }
                break;
            }
        }
    }

    onTierUp() {
        // Screen shake on evolution
        this.screenShake = 300;
        // Create evolution particles
        for (let i = 0; i < 30; i++) {
            const angle = (i / 30) * Math.PI * 2;
            this.absorptionParticles.push({
                x: this.x,
                y: this.y,
                vx: Math.cos(angle) * (5 + Math.random() * 5),
                vy: Math.sin(angle) * (5 + Math.random() * 5),
                radius: 3 + Math.random() * 4,
                color: this.tierColors[this.tier - 1].core,
                life: 1500,
                maxLife: 1500,
                type: 'evolution'
            });
        }
    }

    createOrbParticles(count) {
        for (let i = 0; i < count * 5; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 4;
            this.absorptionParticles.push({
                x: this.x,
                y: this.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                radius: 1.5 + Math.random() * 2,
                color: this.lastOrbColor,
                life: 600,
                maxLife: 600,
                type: 'orb'
            });
        }

        // Mass popup
        this.massPopups.push({
            x: this.x,
            y: this.y - this.radius - 10,
            text: `+${count * 5}`,
            color: this.lastOrbColor,
            life: 1000,
            maxLife: 1000,
            vy: -0.5
        });
    }

    createAbsorptionParticles(victim, massGained) {
        const color = victim.color || this.tierColors[this.tier - 1].core;

        for (let i = 0; i < 25; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 3 + Math.random() * 8;
            this.absorptionParticles.push({
                x: victim.x || this.x,
                y: victim.y || this.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                radius: 2 + Math.random() * 3,
                color: color,
                life: 1000,
                maxLife: 1000,
                type: 'absorption'
            });
        }

        // Big mass popup
        this.massPopups.push({
            x: victim.x || this.x,
            y: victim.y || this.y - this.radius - 15,
            text: `+${Math.floor(massGained)}`,
            color: '#ffff00',
            life: 1500,
            maxLife: 1500,
            vy: -0.8,
            big: true
        });

        // Screen shake for big absorption
        this.screenShake = Math.min(500, 100 + massGained * 0.1);
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

    absorb(entity) {
        const massGained = entity.mass * 0.8;
        this.mass += massGained;
        this.radius = Math.sqrt(this.mass / Math.PI) * 1.5;
        this.kills++;
        this.lastAbsorption = Date.now();
        this.createAbsorptionParticles(entity, massGained);
        return massGained;
    }

    getTierName() {
        return this.tierNames[this.tier - 1];
    }

    getTierLevel() {
        return `TIER ${this.tier}`;
    }

    getTierColor() {
        return this.tierColors[this.tier - 1];
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
                trailGradient.addColorStop(0, tierColor.core.replace(')', `, ${0.3 * point.alpha})`).replace('rgb', 'rgba'));
                trailGradient.addColorStop(1, 'rgba(0,0,0,0)');

                ctx.fillStyle = trailGradient;
                ctx.beginPath();
                ctx.arc(tx, ty, tr, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Invulnerability shield
        if (this.invulnerable) {
            const shieldAlpha = 0.3 + Math.sin(this.pulsePhase * 3) * 0.2;
            const shieldGradient = ctx.createRadialGradient(0, 0, sr * 0.8, 0, 0, sr * 1.5);
            shieldGradient.addColorStop(0, 'rgba(0, 255, 255, 0)');
            shieldGradient.addColorStop(0.7, `rgba(0, 255, 255, ${0.15 * shieldAlpha})`);
            shieldGradient.addColorStop(1, 'rgba(0, 255, 255, 0)');

            ctx.fillStyle = shieldGradient;
            ctx.beginPath();
            ctx.arc(0, 0, sr * 1.5, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = `rgba(0, 255, 255, ${0.5 * shieldAlpha})`;
            ctx.lineWidth = Math.max(1, 2 * camera.zoom);
            ctx.setLineDash([10 * camera.zoom, 5 * camera.zoom]);
            ctx.beginPath();
            ctx.arc(0, 0, sr * 1.2, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Evolution aura (tier 3+)
        if (this.tier >= 3) {
            const auraAlpha = 0.15 + Math.sin(this.pulsePhase) * 0.05;
            const auraGradient = ctx.createRadialGradient(0, 0, sr, 0, 0, sr * (2 + this.tier * 0.5));
            auraGradient.addColorStop(0, tierColor.aura.replace('0.3', auraAlpha.toFixed(2)));
            auraGradient.addColorStop(1, 'rgba(0,0,0,0)');

            ctx.fillStyle = auraGradient;
            ctx.beginPath();
            ctx.arc(0, 0, sr * (2 + this.tier * 0.5), 0, Math.PI * 2);
            ctx.fill();
        }

        // Rotating rings (tier 2+)
        if (this.tier >= 2) {
            for (let i = 0; i < Math.min(this.tier, 3); i++) {
                const ringR = sr * (1.3 + i * 0.4);
                const ringPhase = this.ringPhases[i] + (i % 2 === 0 ? 0 : Math.PI);
                const ringAlpha = 0.3 + Math.sin(ringPhase) * 0.15;

                ctx.strokeStyle = tierColor.ring.replace(')', `, ${ringAlpha})`).replace('rgb', 'rgba').replace('#', '');
                // Convert hex to rgba for ring
                const ringRgba = this.hexToRgba(tierColor.ring, ringAlpha);
                ctx.strokeStyle = ringRgba;
                ctx.lineWidth = Math.max(1, 1.5 * camera.zoom);
                ctx.beginPath();
                ctx.arc(0, 0, ringR, 0, Math.PI * 2);
                ctx.stroke();
            }
        }

        // Core body
        const coreGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, sr);
        const pulse = 1 + Math.sin(this.pulsePhase) * 0.08;
        coreGradient.addColorStop(0, this.lightenColor(tierColor.core, 0.3));
        coreGradient.addColorStop(0.5, tierColor.core);
        coreGradient.addColorStop(1, this.darkenColor(tierColor.core, 0.3));

        ctx.fillStyle = coreGradient;
        ctx.beginPath();
        ctx.arc(0, 0, sr * pulse, 0, Math.PI * 2);
        ctx.fill();

        // Inner highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.beginPath();
        ctx.arc(-sr * 0.3, -sr * 0.3, sr * 0.35 * pulse, 0, Math.PI * 2);
        ctx.fill();

        // Tier indicator mark (tier 4+)
        if (this.tier >= 4) {
            ctx.fillStyle = tierColor.ring;
            ctx.font = `bold ${Math.max(8, sr * 0.5)}px monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const marks = ['◆', '◇', '◆'];
            ctx.fillText(marks[(this.tier - 4) % marks.length], 0, sr * 0.1);
        }

        // Cosmic particles (tier 5)
        if (this.tier === 5) {
            for (let i = 0; i < 6; i++) {
                const angle = this.pulsePhase * 0.5 + i * Math.PI / 3;
                const px = Math.cos(angle) * sr * 1.4;
                const py = Math.sin(angle) * sr * 1.4;
                const pr = Math.max(1, 2 * camera.zoom * (0.5 + Math.sin(this.pulsePhase + i) * 0.3));

                ctx.fillStyle = `hsla(${this.pulsePhase * 50 + i * 60}, 100%, 70%, 0.8)`;
                ctx.beginPath();
                ctx.arc(px, py, pr, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.restore();

        // Nickname
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.font = `bold ${Math.max(10, 12 * camera.zoom)}px 'Segoe UI', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        const nameY = sy - sr - 6 * camera.zoom;
        ctx.fillText(this.nickname, sx + 1, nameY + 1);
        ctx.fillStyle = this.invulnerable ? '#00ffff' : '#ffffff';
        ctx.fillText(this.nickname, sx, nameY);

        // Mass indicator
        if (sr > 15) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.font = `${Math.max(8, 10 * camera.zoom)}px 'JetBrains Mono', monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            const massY = sy + sr + 4 * camera.zoom;
            ctx.fillText(`${Math.floor(this.mass)}`, sx + 1, massY + 1);
            ctx.fillStyle = tierColor.core;
            ctx.fillText(`${Math.floor(this.mass)}`, sx, massY);
        }

        // Render particles
        this.renderParticles(ctx, camera);

        // Render mass popups
        this.renderMassPopups(ctx, camera);

        // Render fragments
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
            ctx.font = `bold ${p.big ? 16 : 12}px 'JetBrains Mono', monospace`;
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

    die() {
        this.alive = false;
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
            alive: this.alive
        };
    }
}