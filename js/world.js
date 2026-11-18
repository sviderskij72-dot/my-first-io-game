// World.js - Arena, energy orbs, and black holes
export class World {
    constructor() {
        this.width = 8000;
        this.height = 6000;
        this.gridSize = 200;

        this.orbs = [];
        this.blackHoles = [];

        this.orbCount = 250;
        this.blackHoleCount = 5;

        this.spatialGrid = new Map();
        this.cellSize = 300;

        this.init();
    }

    init() {
        this.spawnOrbs();
        this.spawnBlackHoles();
    }

    spawnOrbs() {
        this.orbs = [];
        for (let i = 0; i < this.orbCount; i++) {
            this.orbs.push(this.createOrb());
        }
        this.buildSpatialGrid();
    }

    createOrb() {
        const colors = [
            { base: '#00ffff', glow: 'rgba(0, 255, 255, 0.8)' },
            { base: '#ff00ff', glow: 'rgba(255, 0, 255, 0.8)' },
            { base: '#ffff00', glow: 'rgba(255, 255, 0, 0.8)' },
            { base: '#00ff88', glow: 'rgba(0, 255, 136, 0.8)' },
            { base: '#ff8800', glow: 'rgba(255, 136, 0, 0.8)' },
            { base: '#8844ff', glow: 'rgba(136, 68, 255, 0.8)' },
        ];
        const color = colors[Math.floor(Math.random() * colors.length)];
        const radius = 4 + Math.random() * 4; // 4-8

        return {
            x: Math.random() * (this.width - 200) + 100,
            y: Math.random() * (this.height - 200) + 100,
            radius,
            mass: radius * 0.8,
            color: color.base,
            glow: color.glow,
            pulsePhase: Math.random() * Math.PI * 2,
            pulseSpeed: 0.02 + Math.random() * 0.03,
            collected: false
        };
    }

    spawnBlackHoles() {
        this.blackHoles = [];
        const margin = 500;
        for (let i = 0; i < this.blackHoleCount; i++) {
            const radius = 80 + Math.random() * 60; // 80-140
            this.blackHoles.push({
                x: Math.random() * (this.width - 2 * margin) + margin,
                y: Math.random() * (this.height - 2 * margin) + margin,
                radius,
                mass: radius * 10,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.005,
                pulsePhase: Math.random() * Math.PI * 2,
                eventHorizonRadius: radius * 1.5,
                pullRadius: radius * 6
            });
        }
    }

    buildSpatialGrid() {
        this.spatialGrid.clear();
        for (const orb of this.orbs) {
            if (orb.collected) continue;
            const cx = Math.floor(orb.x / this.cellSize);
            const cy = Math.floor(orb.y / this.cellSize);
            const key = `${cx},${cy}`;
            if (!this.spatialGrid.has(key)) this.spatialGrid.set(key, []);
            this.spatialGrid.get(key).push(orb);
        }
    }

    getNearbyOrbs(x, y, radius) {
        const minCx = Math.floor((x - radius) / this.cellSize);
        const maxCx = Math.floor((x + radius) / this.cellSize);
        const minCy = Math.floor((y - radius) / this.cellSize);
        const maxCy = Math.floor((y + radius) / this.cellSize);

        const nearby = [];
        for (let cx = minCx; cx <= maxCx; cx++) {
            for (let cy = minCy; cy <= maxCy; cy++) {
                const key = `${cx},${cy}`;
                const orbs = this.spatialGrid.get(key);
                if (orbs) nearby.push(...orbs);
            }
        }
        return nearby;
    }

    update(deltaTime, entities) {
        // Update orbs
        for (const orb of this.orbs) {
            if (!orb.collected) {
                orb.pulsePhase += orb.pulseSpeed * deltaTime * 60;
            }
        }

        // Update black holes
        for (const bh of this.blackHoles) {
            bh.rotation += bh.rotationSpeed * deltaTime * 60;
            bh.pulsePhase += 0.015 * deltaTime * 60;

            // Pull nearby entities
            for (const entity of entities) {
                if (entity.isPlayer || entity.isBot) {
                    const dx = bh.x - entity.x;
                    const dy = bh.y - entity.y;
                    const dist = Math.hypot(dx, dy);

                    if (dist < bh.pullRadius && dist > bh.radius) {
                        const pullForce = (bh.mass * 0.0003) / (dist * 0.1);
                        entity.vx += (dx / dist) * pullForce * deltaTime * 60;
                        entity.vy += (dy / dist) * pullForce * deltaTime * 60;
                    }

                    // Absorption by black hole
                    if (dist < bh.radius && entity.radius > 30) {
                        this.handleBlackHoleAbsorption(entity, bh);
                    }
                }
            }
        }

        // Rebuild spatial grid periodically
        if (Math.random() < 0.01) {
            this.buildSpatialGrid();
        }
    }

    handleBlackHoleAbsorption(entity, blackHole) {
        if (entity.radius > 50) {
            // Split large entities
            const splitMass = entity.mass * 0.4;
            entity.mass *= 0.6;
            entity.radius = Math.sqrt(entity.mass / Math.PI) * 1.5;

            // Create fragment
            const angle = Math.random() * Math.PI * 2;
            const fragment = {
                x: entity.x + Math.cos(angle) * entity.radius * 2,
                y: entity.y + Math.sin(angle) * entity.radius * 2,
                vx: entity.vx + Math.cos(angle) * 5,
                vy: entity.vy + Math.sin(angle) * 5,
                mass: splitMass,
                radius: Math.sqrt(splitMass / Math.PI) * 1.5,
                color: entity.color,
                glow: entity.glow,
                isFragment: true,
                life: 10000,
                tier: entity.tier
            };
            // Fragment will be handled by main game loop
            if (entity.fragments) entity.fragments.push(fragment);
            else entity.fragments = [fragment];
        } else {
            // Shrink smaller entities
            entity.mass *= 0.85;
            entity.radius = Math.sqrt(entity.mass / Math.PI) * 1.5;
        }

        // Visual feedback
        entity.blackHoleHit = Date.now();
    }

    checkOrbCollection(entity) {
        const nearby = this.getNearbyOrbs(entity.x, entity.y, entity.radius + 10);
        let collected = 0;

        for (const orb of nearby) {
            if (orb.collected) continue;
            const dx = orb.x - entity.x;
            const dy = orb.y - entity.y;
            const dist = Math.hypot(dx, dy);

            if (dist < entity.radius + orb.radius) {
                orb.collected = true;
                entity.mass += orb.mass * 0.8;
                entity.radius = Math.sqrt(entity.mass / Math.PI) * 1.5;
                collected++;
                entity.lastOrbCollect = Date.now();
                entity.lastOrbColor = orb.color;
            }
        }

        if (collected > 0) {
            // Respawn collected orbs
            for (let i = 0; i < collected; i++) {
                const newOrb = this.createOrb();
                this.orbs.push(newOrb);
                const cx = Math.floor(newOrb.x / this.cellSize);
                const cy = Math.floor(newOrb.y / this.cellSize);
                const key = `${cx},${cy}`;
                if (!this.spatialGrid.has(key)) this.spatialGrid.set(key, []);
                this.spatialGrid.get(key).push(newOrb);
            }
        }

        return collected;
    }

    render(ctx, camera) {
        // Draw subtle sci-fi grid
        this.drawGrid(ctx, camera);

        // Draw black holes
        for (const bh of this.blackHoles) {
            this.drawBlackHole(ctx, bh, camera);
        }

        // Draw energy orbs
        for (const orb of this.orbs) {
            if (!orb.collected) {
                this.drawOrb(ctx, orb, camera);
            }
        }
    }

    drawGrid(ctx, camera) {
        const gridSize = this.gridSize;
        const startX = Math.floor(camera.x / gridSize) * gridSize;
        const startY = Math.floor(camera.y / gridSize) * gridSize;
        const endX = startX + camera.width + gridSize;
        const endY = startY + camera.height + gridSize;

        ctx.strokeStyle = 'rgba(0, 255, 255, 0.03)';
        ctx.lineWidth = 1;

        ctx.beginPath();
        for (let x = startX; x <= endX; x += gridSize) {
            const sx = (x - camera.x) * camera.zoom;
            ctx.moveTo(sx, 0);
            ctx.lineTo(sx, camera.height * camera.zoom);
        }
        for (let y = startY; y <= endY; y += gridSize) {
            const sy = (y - camera.y) * camera.zoom;
            ctx.moveTo(0, sy);
            ctx.lineTo(camera.width * camera.zoom, sy);
        }
        ctx.stroke();

        // Major grid lines
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.06)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let x = startX; x <= endX; x += gridSize * 5) {
            const sx = (x - camera.x) * camera.zoom;
            ctx.moveTo(sx, 0);
            ctx.lineTo(sx, camera.height * camera.zoom);
        }
        for (let y = startY; y <= endY; y += gridSize * 5) {
            const sy = (y - camera.y) * camera.zoom;
            ctx.moveTo(0, sy);
            ctx.lineTo(camera.width * camera.zoom, sy);
        }
        ctx.stroke();

        // Center crosshair
        const centerX = (this.width / 2 - camera.x) * camera.zoom;
        const centerY = (this.height / 2 - camera.y) * camera.zoom;
        if (centerX > 0 && centerX < camera.width * camera.zoom &&
            centerY > 0 && centerY < camera.height * camera.zoom) {
            ctx.strokeStyle = 'rgba(0, 255, 255, 0.15)';
            ctx.lineWidth = 1;
            ctx.setLineDash([10, 10]);
            ctx.beginPath();
            ctx.moveTo(centerX, 0);
            ctx.lineTo(centerX, camera.height * camera.zoom);
            ctx.moveTo(0, centerY);
            ctx.lineTo(camera.width * camera.zoom, centerY);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }

    drawBlackHole(ctx, bh, camera) {
        const sx = (bh.x - camera.x) * camera.zoom;
        const sy = (bh.y - camera.y) * camera.zoom;
        const sr = bh.radius * camera.zoom;
        const eventR = bh.eventHorizonRadius * camera.zoom;

        if (sr < 0.5) return;

        // Event horizon glow
        const pulse = Math.sin(bh.pulsePhase) * 0.2 + 1;
        const gradient = ctx.createRadialGradient(sx, sy, 0, sx, sy, eventR * pulse);
        gradient.addColorStop(0, 'rgba(20, 0, 40, 0.8)');
        gradient.addColorStop(0.5, 'rgba(60, 0, 100, 0.4)');
        gradient.addColorStop(1, 'rgba(20, 0, 40, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(sx, sy, eventR * pulse, 0, Math.PI * 2);
        ctx.fill();

        // Accretion disk
        const diskRadius = sr * 1.3;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(bh.rotation);

        for (let i = 0; i < 3; i++) {
            const ringR = diskRadius * (0.7 + i * 0.15);
            ctx.strokeStyle = `hsla(${280 + i * 30}, 100%, 60%, ${0.15 - i * 0.04})`;
            ctx.lineWidth = Math.max(1, 2 * camera.zoom);
            ctx.beginPath();
            ctx.ellipse(0, 0, ringR, ringR * 0.3, 0, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();

        // Core
        const coreGradient = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
        coreGradient.addColorStop(0, '#0a0014');
        coreGradient.addColorStop(0.5, '#1a0030');
        coreGradient.addColorStop(1, '#05000a');

        ctx.fillStyle = coreGradient;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();

        // Event horizon border
        ctx.strokeStyle = 'rgba(255, 0, 255, 0.6)';
        ctx.lineWidth = Math.max(1, 2 * camera.zoom);
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.stroke();

        // Warning label if close to screen
        if (sr > 30) {
            ctx.fillStyle = 'rgba(255, 51, 102, 0.8)';
            ctx.font = `bold ${Math.max(10, 12 * camera.zoom)}px monospace`;
            ctx.textAlign = 'center';
            ctx.fillText('⚠ SINGULARITY', sx, sy - sr - 10 * camera.zoom);
        }
    }

    drawOrb(ctx, orb, camera) {
        const sx = (orb.x - camera.x) * camera.zoom;
        const sy = (orb.y - camera.y) * camera.zoom;
        const sr = Math.max(0.5, orb.radius * camera.zoom);

        if (sr < 0.5) return;

        const pulse = Math.sin(orb.pulsePhase) * 0.15 + 1;

        // Outer glow
        const glowGradient = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 3 * pulse);
        glowGradient.addColorStop(0, orb.glow);
        glowGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = glowGradient;
        ctx.beginPath();
        ctx.arc(sx, sy, sr * 3 * pulse, 0, Math.PI * 2);
        ctx.fill();

        // Core
        const coreGradient = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * pulse);
        coreGradient.addColorStop(0, orb.color);
        coreGradient.addColorStop(1, this.darkenColor(orb.color, 0.4));

        ctx.fillStyle = coreGradient;
        ctx.beginPath();
        ctx.arc(sx, sy, sr * pulse, 0, Math.PI * 2);
        ctx.fill();

        // Inner highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.arc(sx - sr * 0.3, sy - sr * 0.3, sr * 0.3 * pulse, 0, Math.PI * 2);
        ctx.fill();
    }

    darkenColor(color, factor) {
        const hex = color.replace('#', '');
        const r = Math.max(0, parseInt(hex.substr(0, 2), 16) * (1 - factor));
        const g = Math.max(0, parseInt(hex.substr(2, 2), 16) * (1 - factor));
        const b = Math.max(0, parseInt(hex.substr(4, 2), 16) * (1 - factor));
        return `rgb(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)})`;
    }

    // Boundary check
    constrain(entity) {
        const margin = entity.radius;
        if (entity.x < margin) entity.x = margin;
        if (entity.x > this.width - margin) entity.x = this.width - margin;
        if (entity.y < margin) entity.y = margin;
        if (entity.y > this.height - margin) entity.y = this.height - margin;
    }

    getRandomPosition(minRadius = 100) {
        return {
            x: Math.random() * (this.width - 2 * minRadius) + minRadius,
            y: Math.random() * (this.height - 2 * minRadius) + minRadius
        };
    }
}