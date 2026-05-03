const COMPONENT_PADDING = 24;
const MIN_FOREGROUND_PIXELS = 800;

export class BlobSkinManager {
    constructor(sheetSources = []) {
        this.sheetSources = sheetSources;
        this.skins = [];
        this.loaded = false;
    }

    async load() {
        if (this.loaded) {
            return this.skins;
        }

        const sheets = await Promise.all(this.sheetSources.map((src) => this.loadImage(src)));

        this.skins = [];
        for (const sheet of sheets) {
            this.skins.push(...this.sliceSheet(sheet));
        }

        this.loaded = true;
        return this.skins;
    }

    loadImage(src) {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error(`Failed to load blob skin sheet: ${src}`));
            image.src = src;
        });
    }

    sliceSheet(image) {
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(image, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const { data, width, height } = imageData;
        const backgroundMask = this.buildBackgroundMask(data, width, height);
        const visited = new Uint8Array(width * height);
        const components = [];

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const startIndex = y * width + x;
                if (visited[startIndex]) continue;
                if (backgroundMask[startIndex]) continue;

                const stack = [startIndex];
                visited[startIndex] = 1;

                let minX = x;
                let maxX = x;
                let minY = y;
                let maxY = y;
                let pixelCount = 0;

                while (stack.length > 0) {
                    const index = stack.pop();
                    const px = index % width;
                    const py = Math.floor(index / width);
                    pixelCount++;

                    if (px < minX) minX = px;
                    if (px > maxX) maxX = px;
                    if (py < minY) minY = py;
                    if (py > maxY) maxY = py;

                    const neighbors = [
                        index - 1,
                        index + 1,
                        index - width,
                        index + width,
                        index - width - 1,
                        index - width + 1,
                        index + width - 1,
                        index + width + 1
                    ];

                    for (const nextIndex of neighbors) {
                        if (nextIndex < 0 || nextIndex >= visited.length) continue;
                        if (visited[nextIndex]) continue;

                        const nx = nextIndex % width;
                        const ny = Math.floor(nextIndex / width);
                        if (Math.abs(nx - px) > 1 || Math.abs(ny - py) > 1) continue;

                        if (backgroundMask[nextIndex]) continue;

                        visited[nextIndex] = 1;
                        stack.push(nextIndex);
                    }
                }

                if (pixelCount < MIN_FOREGROUND_PIXELS) {
                    continue;
                }

                components.push({
                    minX,
                    maxX,
                    minY,
                    maxY
                });
            }
        }

        components.sort((a, b) => (a.minY - b.minY) || (a.minX - b.minX));

        return components.map((component) => {
            const cropWidth = (component.maxX - component.minX + 1) + COMPONENT_PADDING * 2;
            const cropHeight = (component.maxY - component.minY + 1) + COMPONENT_PADDING * 2;
            const output = document.createElement('canvas');
            output.width = cropWidth;
            output.height = cropHeight;

            const outputCtx = output.getContext('2d');
            const cropped = outputCtx.createImageData(cropWidth, cropHeight);

            for (let y = 0; y < cropHeight; y++) {
                const sourceY = component.minY - COMPONENT_PADDING + y;
                if (sourceY < 0 || sourceY >= height) continue;

                for (let x = 0; x < cropWidth; x++) {
                    const sourceX = component.minX - COMPONENT_PADDING + x;
                    if (sourceX < 0 || sourceX >= width) continue;

                    const sourceIndex = sourceY * width + sourceX;
                    const targetIndex = (y * cropWidth + x) * 4;

                    if (backgroundMask[sourceIndex]) {
                        continue;
                    }

                    cropped.data[targetIndex] = data[sourceIndex * 4];
                    cropped.data[targetIndex + 1] = data[sourceIndex * 4 + 1];
                    cropped.data[targetIndex + 2] = data[sourceIndex * 4 + 2];
                    cropped.data[targetIndex + 3] = data[sourceIndex * 4 + 3];
                }
            }

            outputCtx.putImageData(cropped, 0, 0);

            return {
                canvas: output,
                tintColor: this.getAverageColor(output)
            };
        });
    }

    buildBackgroundMask(data, width, height) {
        const backgroundMask = new Uint8Array(width * height);
        const seeds = [];

        const pushSeed = (index) => {
            if (index < 0 || index >= backgroundMask.length) return;
            if (backgroundMask[index]) return;
            if (!this.isBackgroundPixel(data, index)) return;
            backgroundMask[index] = 1;
            seeds.push(index);
        };

        for (let x = 0; x < width; x++) {
            pushSeed(x);
            pushSeed((height - 1) * width + x);
        }

        for (let y = 0; y < height; y++) {
            pushSeed(y * width);
            pushSeed(y * width + (width - 1));
        }

        while (seeds.length > 0) {
            const index = seeds.pop();
            const px = index % width;
            const py = Math.floor(index / width);
            const neighbors = [
                index - 1,
                index + 1,
                index - width,
                index + width
            ];

            for (const nextIndex of neighbors) {
                if (nextIndex < 0 || nextIndex >= backgroundMask.length) continue;
                if (backgroundMask[nextIndex]) continue;

                const nx = nextIndex % width;
                const ny = Math.floor(nextIndex / width);
                if (Math.abs(nx - px) + Math.abs(ny - py) !== 1) continue;

                if (!this.isBackgroundPixel(data, nextIndex)) continue;

                backgroundMask[nextIndex] = 1;
                seeds.push(nextIndex);
            }
        }

        return backgroundMask;
    }

    isBackgroundPixel(data, index) {
        const r = data[index * 4];
        const g = data[index * 4 + 1];
        const b = data[index * 4 + 2];
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);

        if (max - min > 12) {
            return false;
        }

        if (max < 190) {
            return false;
        }
        
        return true;
    }

    getAverageColor(canvas) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);

        let totalR = 0;
        let totalG = 0;
        let totalB = 0;
        let totalWeight = 0;

        for (let i = 0; i < width * height; i++) {
            const alpha = data[i * 4 + 3];
            if (alpha === 0) continue;

            const weight = alpha / 255;
            totalR += data[i * 4] * weight;
            totalG += data[i * 4 + 1] * weight;
            totalB += data[i * 4 + 2] * weight;
            totalWeight += weight;
        }

        if (totalWeight === 0) {
            return '#ffffff';
        }

        const r = Math.round(totalR / totalWeight);
        const g = Math.round(totalG / totalWeight);
        const b = Math.round(totalB / totalWeight);
        return `rgb(${r}, ${g}, ${b})`;
    }

    get count() {
        return this.skins.length;
    }

    getSkin(index) {
        if (!this.skins.length) return null;
        const safeIndex = ((index % this.skins.length) + this.skins.length) % this.skins.length;
        return this.skins[safeIndex];
    }

    getSkinTintColor(index) {
        const skin = this.getSkin(index);
        return skin?.tintColor || '#ffffff';
    }

    getSkinIndex(seed) {
        if (!this.skins.length) return 0;

        const text = String(seed);
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            hash = ((hash << 5) - hash + text.charCodeAt(i)) >>> 0;
        }

        return hash % this.skins.length;
    }
}
