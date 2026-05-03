import { CONFIG } from '../config.js';
import { dist, randomRange, getHexWithOpacity, lerp } from '../utils.js';
import { NumberFormatter } from '../utils/NumberFormatter.js';

export class Blob {
    constructor(id, x, y, mass, color, game) {
        this.id = id;
        this.game = game;
        this.x = x;
        this.y = y;
        this.targetX = x;
        this.targetY = y;
        this.mass = mass;
        this.radius = Math.sqrt(this.mass / Math.PI) * 30;
        this.color = color;
        this.velocity = { x: 0, y: 0 };
        this.visualX = x;
        this.visualY = y;
        this.visualRotation = 0;
        this.visualSquashX = 1;
        this.visualSquashY = 1;
        this.isAlive = true;
        this.state = 'WANDER'; // WANDER, CHASE, FLEE
        this.targetEntity = null;
        this.isPlayerControlled = false;
        this.splitTime = Date.now();
        this.mergeDelay = 15000; // 15 seconds before they can recombine
        this.edgeEscapeTicks = 0;
        this.edgeEscapeVector = null;
        this.edgeAvoidanceActive = false;
        this.stuckTicks = 0;
        this.lastSafeX = x;
        this.lastSafeY = y;
        this.skinIndex = this.game?.blobSkins ? this.game.blobSkins.getSkinIndex(this.id) : 0;
        this.name = this.game?.allocateBlobName?.() || `Blob ${Math.floor(Math.random() * 9999) + 1}`;
        this.applySkinTint();
    }

    applySkinTint() {
        if (this.game?.blobSkins?.count) {
            this.color = this.game.blobSkins.getSkinTintColor(this.skinIndex);
        }
    }

    update(foods, otherBlobs, speedMulti, gameSpeed = 1) {
        if (!this.isAlive) return;

        this.radius = Math.sqrt(this.mass / Math.PI) * 35;
        const speed = (CONFIG.BASE_SPEED + speedMulti) * (1 / (1 + this.radius * 0.01)) * 1.45 * gameSpeed;
        this.edgeEscapeTicks = Math.max(0, this.edgeEscapeTicks - 1);
        this.edgeEscapeVector = null;
        this.edgeAvoidanceActive = false;

        if (!this.isPlayerControlled) {
            this.think(foods, otherBlobs);
        } else {
            this.state = 'PLAYER';
        }
        this.move(speed);
        this.handleBounds();
        this.handleFriction();
        this.updateSpritePhysics();

        // Recombine Logic
        if (Date.now() - this.splitTime > this.mergeDelay) {
            for (const other of otherBlobs) {
                if (other !== this && other.isAlive && other.color === this.color) {
                    if (Date.now() - other.splitTime > other.mergeDelay) {
                        const d = dist(this.x, this.y, other.x, other.y);
                        if (d < (this.radius + other.radius) * 0.85) {
                            // Merge smaller into larger
                            if (this.mass >= other.mass) {
                                this.mass += other.mass;
                                other.isAlive = false;
                                this.splitTime = Date.now(); // Reset timer to prevent instant multi-merges
                            }
                        }
                    }
                }
            }
        }
    }

    handleFriction() {
        // Apply friction to split velocity
        this.velocity.x *= 0.95;
        this.velocity.y *= 0.95;
    }

    updateSpritePhysics() {
        const speed = Math.hypot(this.velocity.x, this.velocity.y);
        const follow = 0.5;
        const drift = Math.min(speed * 0.06, 6);
        const angle = Math.atan2(this.velocity.y, this.velocity.x);

        // The sprite eases toward the blob position instead of snapping to it.
        this.visualX += (this.x - this.visualX) * follow;
        this.visualY += (this.y - this.visualY) * follow;

        // Small motion bias and wobble so the skin feels alive while moving.
        this.visualX -= Math.cos(angle) * drift * 0.05;
        this.visualY -= Math.sin(angle) * drift * 0.05;

        const wobble = Math.sin(Date.now() * 0.01 + this.id) * Math.min(speed * 0.0015, 0.03);
        const stretch = Math.min(speed * 0.012, 0.14);

        this.visualRotation = wobble;
        this.visualSquashX = 1 + stretch;
        this.visualSquashY = 1 - stretch * 0.7;
    }

    clampTarget(x, y) {
        const margin = this.radius + 50;
        return {
            x: Math.max(margin, Math.min(this.game.mapWidth - margin, x)),
            y: Math.max(margin, Math.min(this.game.mapHeight - margin, y)),
        };
    }

    think(foods, otherBlobs) {
        let closestFood = null;
        let minDistFood = Infinity;

        // Find closest food
        for (const food of foods) {
            if (!food.isAlive) continue;
            const d = dist(this.x, this.y, food.x, food.y);
            if (d < minDistFood) {
                minDistFood = d;
                closestFood = food;
            }
        }

        let closestThreat = null;
        let minDistThreat = Infinity;
        let closestPrey = null;
        let minDistPrey = Infinity;
        let closestFriend = null;
        let minDistFriend = Infinity;

        // Analyze other blobs
        for (const blob of otherBlobs) {
            if (blob === this || !blob.isAlive) continue;
            const d = dist(this.x, this.y, blob.x, blob.y);

            // Teaming Logic (Same Color)
            if (blob.color === this.color) {
                if (d < minDistFriend) {
                    minDistFriend = d;
                    closestFriend = blob;
                }
                continue; // Don't eat or flee from friends
            }

            // Threat (bigger than us)
            if (blob.mass > this.mass * 1.15) {
                if (d < minDistThreat) {
                    minDistThreat = d;
                    closestThreat = blob;
                }
            } 
            // Prey (smaller than us)
            else if (this.mass > blob.mass * 1.15) {
                if (d < minDistPrey) {
                    minDistPrey = d;
                    closestPrey = blob;
                }
            }
        }

        // Perception distances scale with blob size so large blobs can still see
        const sightBase = Math.max(this.radius * 3, 500);
        const fleeRange  = sightBase * 1.2;
        const chaseRange = sightBase * 1.5;
        const foodNear   = sightBase;
        const teamRange  = sightBase * 2;
        const fleeRunDist = Math.max(this.radius * 4, 600);

        // 1. Critical Survival (Flee)
        if (closestThreat && minDistThreat < fleeRange) {
            this.state = 'FLEE';
            const angle = Math.atan2(this.y - closestThreat.y, this.x - closestThreat.x);
            const raw = this.clampTarget(this.x + Math.cos(angle) * fleeRunDist, this.y + Math.sin(angle) * fleeRunDist);
            this.targetX = raw.x;
            this.targetY = raw.y;

            // If friend is nearby and bigger than the threat, move towards them for protection
            if (closestFriend && closestFriend.mass > closestThreat.mass * 0.8 && minDistFriend < teamRange) {
                this.targetX = lerp(this.targetX, closestFriend.x, 0.5);
                this.targetY = lerp(this.targetY, closestFriend.y, 0.5);
            }
        }
        // 2. Offensive (Chase) - prioritized over food so blobs actively hunt
        else if (closestPrey && minDistPrey < chaseRange) {
            this.state = 'CHASE';
            this.targetX = closestPrey.x;
            this.targetY = closestPrey.y;

            // Strategic Split: trigger while still far enough for the piece to reach prey
            if (this.mass > 150 && minDistPrey < chaseRange * 0.7 && minDistPrey > this.radius * 2) {
                this.shouldSplit = true;
            }
        }
        // 3. Immediate Resource (Nearby Food)
        else if (closestFood && minDistFood < foodNear) {
            this.state = 'WANDER';
            this.targetX = closestFood.x;
            this.targetY = closestFood.y;
        }
        // 4. Teaming / Following
        else if (closestFriend && closestFriend.mass > this.mass * 1.5 && minDistFriend < teamRange) {
            this.state = 'TEAM';
            this.targetX = closestFriend.x;
            this.targetY = closestFriend.y;
        }
        // 5. General Resource Gathering
        else if (closestFood) {
            this.state = 'WANDER';
            this.targetX = closestFood.x;
            this.targetY = closestFood.y;
        }
        // 6. Idle — pick a new in-bounds target when close to current one
        else {
            if (dist(this.x, this.y, this.targetX, this.targetY) < this.radius) {
                const margin = this.radius + 100;
                this.targetX = randomRange(margin, this.game.mapWidth - margin);
                this.targetY = randomRange(margin, this.game.mapHeight - margin);
            }
        }

        const edge = this.getEdgeEscapeVector();
        if (edge) {
            this.edgeEscapeVector = edge;
            this.edgeEscapeTicks = 12;
            this.edgeAvoidanceActive = this.state === 'WANDER' || this.state === 'TEAM';
        }

        if (edge && this.state === 'WANDER') {
            this.state = 'EDGE';
        }
    }

    getEdgeEscapeVector() {
        const edgeMargin = Math.max(180, this.radius * 2.2);
        let x = 0;
        let y = 0;

        if (this.x < edgeMargin) {
            x += (edgeMargin - this.x) / edgeMargin;
        }
        if (this.game.mapWidth - this.x < edgeMargin) {
            x -= (edgeMargin - (this.game.mapWidth - this.x)) / edgeMargin;
        }
        if (this.y < edgeMargin) {
            y += (edgeMargin - this.y) / edgeMargin;
        }
        if (this.game.mapHeight - this.y < edgeMargin) {
            y -= (edgeMargin - (this.game.mapHeight - this.y)) / edgeMargin;
        }

        const length = Math.hypot(x, y);
        if (length <= 0) {
            return null;
        }

        return {
            x: x / length,
            y: y / length,
            push: Math.max(500, this.radius * 4)
        };
    }

    move(speed) {
        const angle = Math.atan2(this.targetY - this.y, this.targetX - this.x);
        let moveX = Math.cos(angle) * speed + this.velocity.x;
        let moveY = Math.sin(angle) * speed + this.velocity.y;

        const edge = this.edgeEscapeVector || this.getEdgeEscapeVector();
        if (edge) {
            const edgeForce = this.edgeAvoidanceActive
                ? Math.max(1.8, speed * 1.2)
                : Math.max(0.35, speed * 0.25);
            moveX += edge.x * edgeForce;
            moveY += edge.y * edgeForce;
        } else if (this.edgeEscapeTicks > 0) {
            const normalize = Math.hypot(moveX, moveY) || 1;
            moveX = (moveX / normalize) * speed;
            moveY = (moveY / normalize) * speed;
        }

        this.x += moveX;
        this.y += moveY;
    }

    split() {
        this.mass /= 2;
        this.shouldSplit = false;
        this.splitTime = Date.now(); // Parent cooldown
        
        const angle = Math.atan2(this.targetY - this.y, this.targetX - this.x);
        const splitBlob = new Blob(Date.now() + Math.random(), this.x, this.y, this.mass, this.color, this.game);
        splitBlob.splitTime = Date.now(); // Child cooldown
        splitBlob.skinIndex = this.skinIndex;
        if (this.game?.allocateBlobName) {
            splitBlob.name = this.game.allocateBlobName(splitBlob.name);
            this.game.usedBlobNames.add(splitBlob.name);
        }
        splitBlob.applySkinTint();
        splitBlob.visualX = this.visualX;
        splitBlob.visualY = this.visualY;
        
        // Launch the split piece
        splitBlob.velocity.x = Math.cos(angle) * 35;
        splitBlob.velocity.y = Math.sin(angle) * 35;
        
        return splitBlob;
    }

    handleBounds() {
        if (this.x < 0) this.x = 0;
        if (this.x > this.game.mapWidth) this.x = this.game.mapWidth;
        if (this.y < 0) this.y = 0;
        if (this.y > this.game.mapHeight) this.y = this.game.mapHeight;
    }

    draw(ctx) {
        if (!this.isAlive) return;

        const screenX = this.x;
        const screenY = this.y;
        const visualX = this.visualX;
        const visualY = this.visualY;
        const skin = this.game?.blobSkins?.getSkin(this.skinIndex)?.canvas;
        const skinSize = this.radius * 2.2;
        const bodyRadiusX = this.radius * this.visualSquashX;
        const bodyRadiusY = this.radius * this.visualSquashY;
        const settings = this.game?.settings || {};
        const skinOpacity = typeof settings.skinOpacity === 'number' ? settings.skinOpacity : 0.96;
        const glowScale = typeof settings.blobGlow === 'number' ? settings.blobGlow : 1;
        const outlineScale = typeof settings.outlineStrength === 'number' ? settings.outlineStrength : 1;
        const showNames = settings.showNames !== false;
        const showMass = settings.showMass !== false;

        ctx.save();
        ctx.translate(visualX, visualY);
        ctx.rotate(this.visualRotation);

        // Base blob body.
        ctx.shadowBlur = 22 * glowScale;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, bodyRadiusX, bodyRadiusY, 0, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();

        // Keep the girl skin inside the blob shape instead of replacing it.
        if (skin) {
            ctx.save();
            ctx.clip();
            ctx.globalAlpha = skinOpacity;
            ctx.drawImage(skin, -skinSize / 2, -skinSize / 2, skinSize, skinSize);
            ctx.restore();
        }

        // Soft highlight to keep the blob readable.
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.ellipse(-bodyRadiusX * 0.18, -bodyRadiusY * 0.18, bodyRadiusX * 0.58, bodyRadiusY * 0.58, 0, 0, Math.PI * 2);
        ctx.fillStyle = getHexWithOpacity('#ffffff', 0.08 * glowScale);
        ctx.fill();

        ctx.strokeStyle = getHexWithOpacity('#ffffff', 0.18 + (0.08 * outlineScale));
        ctx.lineWidth = 1.5 + outlineScale * 0.7;
        ctx.stroke();
        ctx.restore();

        if (showNames || showMass) {
            // Center labels inside the blob so they read as part of the skin.
            ctx.save();
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowBlur = 10;
            ctx.shadowColor = 'rgba(0, 0, 0, 0.58)';

            const nameSize = Math.max(12, this.radius * 0.18);
            const massSize = Math.max(10, this.radius * 0.16);
            const labelOffset = Math.max(8, this.radius * 0.12);

            if (showNames) {
                ctx.font = `bold ${nameSize}px Plus Jakarta Sans`;
                ctx.fillText(this.name, visualX, visualY - (showMass ? labelOffset * 0.45 : 0));
            }

            if (showMass) {
                ctx.font = `700 ${massSize}px Plus Jakarta Sans`;
                ctx.fillText(NumberFormatter.format(this.mass), visualX, visualY + (showNames ? labelOffset * 0.7 : 0));
            }
            ctx.restore();
        }
    }
}
