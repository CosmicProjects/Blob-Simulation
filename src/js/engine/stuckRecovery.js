import { randomRange, dist } from '../utils.js';

const STUCK_RESPAWN_TICKS = 240;

function findRespawnPoint(blob, game) {
    const margin = Math.max(120, blob.radius + 30);

    for (let attempt = 0; attempt < 16; attempt++) {
        const x = randomRange(margin, Math.max(margin + 1, game.mapWidth - margin));
        const y = randomRange(margin, Math.max(margin + 1, game.mapHeight - margin));

        const collides = game.blobs.some((other) => {
            if (!other || other === blob || !other.isAlive) {
                return false;
            }

            return dist(x, y, other.x, other.y) < (blob.radius + other.radius) * 0.85;
        });

        if (!collides) {
            return { x, y };
        }
    }

    return {
        x: randomRange(margin, Math.max(margin + 1, game.mapWidth - margin)),
        y: randomRange(margin, Math.max(margin + 1, game.mapHeight - margin))
    };
}

export function resetBlobStuckState(blob) {
    if (!blob) {
        return;
    }

    blob.stuckTicks = 0;
    blob.lastSafeX = blob.x;
    blob.lastSafeY = blob.y;
}

export function trackBlobStuckState(blob) {
    if (!blob || !blob.isAlive || blob.isPlayerControlled) {
        resetBlobStuckState(blob);
        return false;
    }

    const movedDistance = dist(blob.x, blob.y, blob.lastSafeX ?? blob.x, blob.lastSafeY ?? blob.y);
    if (movedDistance < 1) {
        blob.stuckTicks = (blob.stuckTicks || 0) + 1;
    } else {
        blob.stuckTicks = 0;
        blob.lastSafeX = blob.x;
        blob.lastSafeY = blob.y;
    }

    return blob.stuckTicks >= STUCK_RESPAWN_TICKS;
}

export function respawnStuckBlob(blob, game) {
    if (!blob || !game) {
        return false;
    }

    const position = findRespawnPoint(blob, game);
    blob.x = position.x;
    blob.y = position.y;
    blob.targetX = position.x;
    blob.targetY = position.y;
    blob.visualX = position.x;
    blob.visualY = position.y;
    blob.velocity = { x: 0, y: 0 };
    blob.shouldSplit = false;
    blob.edgeEscapeTicks = 0;
    blob.edgeEscapeVector = null;
    blob.edgeAvoidanceActive = false;
    blob.splitTime = Date.now();
    blob.stuckTicks = 0;
    blob.lastSafeX = blob.x;
    blob.lastSafeY = blob.y;
    blob.applySkinTint?.();
    return true;
}

export function respawnStuckBlobs(blobs, game) {
    let respawned = 0;

    for (const blob of blobs) {
        if (trackBlobStuckState(blob) && respawnStuckBlob(blob, game)) {
            respawned++;
        }
    }

    return { respawned };
}
