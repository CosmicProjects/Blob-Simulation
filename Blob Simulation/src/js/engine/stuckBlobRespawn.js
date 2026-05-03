import { dist, randomRange } from '../utils.js';

function getSafeSpawnMargin(blob) {
    return Math.max(140, Math.round(blob.radius * 1.8));
}

function isNearMapEdge(blob, game) {
    const margin = getSafeSpawnMargin(blob);
    return (
        blob.x <= margin ||
        blob.y <= margin ||
        blob.x >= game.mapWidth - margin ||
        blob.y >= game.mapHeight - margin
    );
}

function getRespawnPosition(blob, game) {
    const margin = getSafeSpawnMargin(blob);
    const maxX = Math.max(margin, game.mapWidth - margin);
    const maxY = Math.max(margin, game.mapHeight - margin);
    const x = randomRange(margin, maxX);
    const y = randomRange(margin, maxY);
    return { x, y };
}

export function respawnStuckBlob(blob, game, reason = 'stuck') {
    if (!blob || !game || !blob.isAlive) {
        return false;
    }

    const nextPosition = getRespawnPosition(blob, game);

    blob.x = nextPosition.x;
    blob.y = nextPosition.y;
    blob.targetX = nextPosition.x;
    blob.targetY = nextPosition.y;
    blob.visualX = nextPosition.x;
    blob.visualY = nextPosition.y;
    blob.velocity = { x: 0, y: 0 };
    blob.edgeEscapeTicks = 0;
    blob.edgeEscapeVector = null;
    blob.edgeAvoidanceActive = false;
    blob.stuckTicks = 0;
    blob.lastSafeX = nextPosition.x;
    blob.lastSafeY = nextPosition.y;
    blob.splitTime = Date.now();

    if (game.ui?.addLog && reason) {
        game.ui.addLog(`${blob.name} was respawned after getting stuck.`, '#ffffff');
    }

    return true;
}

export function handleStuckBlobRespawn(blob, game) {
    if (!blob || !game || !blob.isAlive || blob.isPlayerControlled) {
        return false;
    }

    const movedSinceSafe = dist(blob.x, blob.y, blob.lastSafeX, blob.lastSafeY);
    const movingEnough = movedSinceSafe >= Math.max(10, blob.radius * 0.08);

    if (movingEnough && !isNearMapEdge(blob, game)) {
        blob.stuckTicks = 0;
        blob.lastSafeX = blob.x;
        blob.lastSafeY = blob.y;
        return false;
    }

    if (isNearMapEdge(blob, game)) {
        blob.stuckTicks += 1;
    } else {
        blob.stuckTicks = Math.max(0, blob.stuckTicks - 1);
    }

    if (blob.stuckTicks < 180) {
        return false;
    }

    return respawnStuckBlob(blob, game, 'stuck');
}
