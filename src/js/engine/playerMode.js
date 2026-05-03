import { Blob } from '../entities/Blob.js';

export function pickBlobForPlayerReplacement(blobs) {
    if (!Array.isArray(blobs) || blobs.length === 0) {
        return null;
    }

    const liveBlobs = blobs.filter((blob) => blob.isAlive);
    if (liveBlobs.length === 0) {
        return null;
    }

    return liveBlobs[Math.floor(Math.random() * liveBlobs.length)];
}

export function replaceBlobWithPlayer(sourceBlob, game) {
    const index = game.blobs.indexOf(sourceBlob);
    if (index < 0) {
        return null;
    }

    const playerBlob = new Blob(Date.now() + Math.random(), sourceBlob.x, sourceBlob.y, sourceBlob.mass, sourceBlob.color, game);
    playerBlob.spawnOrder = sourceBlob.spawnOrder;
    playerBlob.skinIndex = game.blobSkins.getSkinIndex(playerBlob.id);
    playerBlob.applySkinTint();
    playerBlob.velocity = { x: 0, y: 0 };
    playerBlob.visualX = sourceBlob.visualX ?? sourceBlob.x;
    playerBlob.visualY = sourceBlob.visualY ?? sourceBlob.y;
    playerBlob.targetX = playerBlob.x;
    playerBlob.targetY = playerBlob.y;
    playerBlob.splitTime = Date.now();
    playerBlob.isPlayerControlled = true;
    playerBlob.state = 'PLAYER';

    game.blobs.splice(index, 1, playerBlob);
    game.rebuildBlobNameRegistry();
    return playerBlob;
}

export function removeBlobToMakeRoomForPlayerSplit(blobs, playerBlob) {
    const candidate = [...blobs]
        .filter((blob) => blob.isAlive && blob !== playerBlob && !blob.isPlayerControlled)
        .sort((a, b) => a.mass - b.mass || (b.spawnOrder || 0) - (a.spawnOrder || 0))[0];

    if (!candidate) {
        return false;
    }

    candidate.isAlive = false;
    return true;
}
