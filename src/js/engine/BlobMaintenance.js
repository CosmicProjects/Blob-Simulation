function clampValue(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function getBlobSpawnOrder(blob) {
    return Number.isFinite(blob?.spawnOrder) ? blob.spawnOrder : Number.MAX_SAFE_INTEGER;
}

export function cleanupDuplicateBlobNames(blobs, allocateBlobName) {
    const seen = new Set();
    const reserved = new Set();
    let renamed = 0;

    for (const blob of blobs) {
        if (!blob || !blob.name) continue;

        const currentName = String(blob.name).trim();
        if (!currentName) continue;

        reserved.add(currentName);

        if (!seen.has(currentName)) {
            seen.add(currentName);
            continue;
        }

        let replacement = allocateBlobName(currentName);
        while (replacement && reserved.has(replacement)) {
            const next = allocateBlobName('');
            if (!next || next === replacement) {
                break;
            }
            replacement = next;
        }

        if (replacement && replacement !== currentName) {
            blob.name = replacement;
            renamed++;
            reserved.add(replacement);
        }

        seen.add(blob.name);
    }

    return { renamed };
}

export function clampBlobsToMap(blobs, mapWidth, mapHeight) {
    let moved = 0;

    for (const blob of blobs) {
        if (!blob) continue;

        const nextX = clampValue(blob.x, 0, mapWidth);
        const nextY = clampValue(blob.y, 0, mapHeight);
        const wasOut = nextX !== blob.x || nextY !== blob.y;

        if (!wasOut) continue;

        blob.x = nextX;
        blob.y = nextY;
        blob.targetX = nextX;
        blob.targetY = nextY;
        blob.visualX = nextX;
        blob.visualY = nextY;
        blob.velocity = { x: 0, y: 0 };
        blob.shouldSplit = false;
        moved++;
    }

    return { moved };
}

export function trimBlobsToLimit(blobs, targetCount) {
    const safeTarget = Math.max(1, Math.floor(Number(targetCount) || 1));
    if (!Array.isArray(blobs) || blobs.length <= safeTarget) {
        return { removed: 0 };
    }

    const sorted = [...blobs].sort((a, b) => getBlobSpawnOrder(a) - getBlobSpawnOrder(b));
    const keep = new Set(sorted.slice(0, safeTarget).map((blob) => blob.id));
    let removed = 0;

    for (const blob of blobs) {
        if (!keep.has(blob.id)) {
            blob.isAlive = false;
            removed++;
        }
    }

    return { removed };
}
