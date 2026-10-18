const fs = require('fs');
const path = require('path');

class FileTypeDetector {
    constructor() {
        this.signatures = {
            'ffd8ff': { ext: 'jpg', mime: 'image/jpeg' },
            '89504e47': { ext: 'png', mime: 'image/png' },
            '47494638': { ext: 'gif', mime: 'image/gif' },
            '52494646': { ext: 'webp', mime: 'image/webp' },
            '49492a00': { ext: 'tif', mime: 'image/tiff' },
            '4d4d002a': { ext: 'tif', mime: 'image/tiff' },
            '25504446': { ext: 'pdf', mime: 'application/pdf' },
            '504b0304': { ext: 'zip', mime: 'application/zip' },
            '504b0506': { ext: 'zip', mime: 'application/zip' },
            '504b0708': { ext: 'zip', mime: 'application/zip' },
            '377abcaf': { ext: '7z', mime: 'application/x-7z-compressed' },
             '75737461': { ext: 'tar', mime: 'application/x-tar' },
            '1f8b08': { ext: 'gz', mime: 'application/gzip' },
            '494433': { ext: 'mp3', mime: 'audio/mpeg' },
            '664c6143': { ext: 'flac', mime: 'audio/flac' },
            '4f676753': { ext: 'ogg', mime: 'audio/ogg' },
            '52494646': { ext: 'wav', mime: 'audio/wav' },
            '00000018': { ext: 'mp4', mime: 'video/mp4' },
            '66747970': { ext: 'mp4', mime: 'video/mp4' },
            '1a45dfa3': { ext: 'webm', mime: 'video/webm' },
            '464c5601': { ext: 'flv', mime: 'video/x-flv' },
            '3026b275': { ext: 'wmv', mime: 'video/x-ms-wmv' },
            '7b5c7274': { ext: 'rtf', mime: 'application/rtf' },
            '25215053': { ext: 'ps', mime: 'application/postscript' },
            '3c3f786d': { ext: 'xml', mime: 'application/xml' },
            '3c21444f': { ext: 'html', mime: 'text/html' },
            '3c68746d': { ext: 'html', mime: 'text/html' },
            'efbbbf3c': { ext: 'html', mime: 'text/html' },
        };
    }

    async fromBuffer(buffer) {
        if (!Buffer.isBuffer(buffer)) {
            throw new Error('Input must be a Buffer');
        }

        if (buffer.length < 4) {
            return { ext: 'bin', mime: 'application/octet-stream' };
        }

        const hex = buffer.slice(0, 8).toString('hex');
        
        for (const [signature, info] of Object.entries(this.signatures)) {
            if (hex.startsWith(signature)) {
                return info;
            }
        }

        if (hex.startsWith('52494646')) {
            const type = buffer.slice(8, 12).toString();
            if (type === 'WEBP') return { ext: 'webp', mime: 'image/webp' };
            if (type === 'WAVE') return { ext: 'wav', mime: 'audio/wav' };
            if (type === 'AVI ') return { ext: 'avi', mime: 'video/x-msvideo' };
        }

        if (this.isText(buffer)) {
            return { ext: 'txt', mime: 'text/plain' };
        }

        return { ext: 'bin', mime: 'application/octet-stream' };
    }

    async fromFile(filePath) {
        try {
            const buffer = fs.readFileSync(filePath);
            return await this.fromBuffer(buffer);
        } catch (error) {
            throw new Error(`Error reading file: ${error.message}`);
        }
    }

    isText(buffer) {
        let printableCount = 0;
        const sampleSize = Math.min(buffer.length, 1024);
        
        for (let i = 0; i < sampleSize; i++) {
            const byte = buffer[i];

            if ((byte >= 32 && byte <= 126) || byte === 9 || byte === 10 || byte === 13) {
                printableCount++;
            }
        }
        
        return (printableCount / sampleSize) > 0.9;
    }

    getSupportedTypes() {
        return Object.values(this.signatures).reduce((acc, info) => {
            if (!acc.find(item => item.ext === info.ext)) {
                acc.push(info);
            }
            return acc;
        }, []);
    }
}

const fileType = new FileTypeDetector();

module.exports = {
    FileTypeDetector,
    fileTypeFromBuffer: fileType.fromBuffer.bind(fileType),
    fileTypeFromFile: fileType.fromFile.bind(fileType),
    fromBuffer: fileType.fromBuffer.bind(fileType),
    fromFile: fileType.fromFile.bind(fileType)
};