const axios = require('axios');
const FormData = require('form-data');
const { cmd } = require('../command');
const { anony } = require('../lib/ridzcoder');

// ──────────────────────────────────────────────────────────────
// UPLOADER CONFIGURATION (Fallback System)
// ──────────────────────────────────────────────────────────────
const CATBOX_USERHASH = 'c8f243c132e5d3e01b89bf27a';

async function uploadToCatbox(buffer, filename) {
    const form = new FormData();
    form.append('reqtype', 'fileupload');
    form.append('userhash', CATBOX_USERHASH);
    form.append('fileToUpload', buffer, { filename });

    const res = await axios.post('https://catbox.moe/user/api.php', form, {
        headers: form.getHeaders(),
        timeout: 20000,
        validateStatus: () => true,
        maxBodyLength: Infinity
    });

    const body = typeof res.data === 'string' ? res.data.trim() : '';
    if (res.status !== 200 || !body.startsWith('https://files.catbox.moe/')) {
        throw new Error(`Catbox blocked`);
    }
    return body;
}

async function uploadToFileIo(buffer, filename) {
    const form = new FormData();
    form.append('file', buffer, { filename });
    const res = await axios.post('https://file.io', form, {
        headers: form.getHeaders(),
        timeout: 20000
    });
    if (res.data && res.data.success && res.data.link) return res.data.link;
    throw new Error('File.io failed');
}

async function uploadImage(buffer, filename) {
    try {
        return await uploadToCatbox(buffer, filename);
    } catch (e1) {
        try {
            return await uploadToFileIo(buffer, filename);
        } catch (e2) {
            throw new Error("ꜰᴀɪʟᴇᴅ ᴛᴏ ᴜᴘʟᴏᴀᴅ ɪᴍᴀɢᴇ.");
        }
    }
}

// ──────────────────────────────────────────────────────────────
// 1. FACE SWAP COMMAND
// ──────────────────────────────────────────────────────────────
cmd({
    pattern: "faceswap",
    alias: ["swapface", "swap"],
    react: "👤",
    desc: "Swap face from one image to another",
    category: "ai",
    use: ".faceswap [reply to Target] [tag user for Face]",
    filename: __filename
}, async (conn, mek, m, { from, reply }) => {
    try {
        const quotedTarget = m.quoted ? m.quoted : null;
        if (!quotedTarget || !quotedTarget.mimetype?.startsWith('image/')) {
            return reply("❌ ᴘʟᴇᴀꜱᴇ ʀᴇᴘʟʏ ᴛᴏ ᴛʜᴇ *ᴛᴀʀɢᴇᴛ ɪᴍᴀɢᴇ* (ᴛʜᴇ ʙᴏᴅʏ/ʙᴀᴄᴋɢʀᴏᴜɴᴅ) ᴡɪᴛʜ ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ.");
        }

        const mentions = m.mentionedJid || [];
        if (mentions.length === 0) {
            return reply("❌ ʏᴏᴜ ᴀʟꜱᴏ ɴᴇᴇᴅ ᴛᴏ ᴛᴀɢ ᴛʜᴇ ᴘᴇʀꜱᴏɴ ᴡʜᴏꜱᴇ *ꜰᴀᴄᴇ* ʏᴏᴜ ᴡᴀɴᴛ ᴛᴏ ᴜꜱᴇ.");
        }

        const faceUser = mentions[0];
        
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
        await reply("🔄 ᴜᴘʟᴏᴀᴅɪɴɢ ɪᴍᴀɢᴇꜱ ᴀɴᴅ ꜱᴡᴀᴘᴘɪɴɢ ꜰᴀᴄᴇ... ᴘʟᴇᴀꜱᴇ ᴡᴀɪᴛ.");

        // 1. Download Target Image
        const targetBuffer = await quotedTarget.download();
        const targetUrl = await uploadImage(targetBuffer, 'target.jpg');

        // 2. Get Face Image (Profile picture of the mentioned user)
        let faceUrl;
        try {
            const ppUrl = await conn.profilePictureUrl(faceUser, 'image');
            const ppRes = await axios.get(ppUrl, { responseType: 'arraybuffer' });
            const faceBuffer = Buffer.from(ppRes.data, 'binary');
            faceUrl = await uploadImage(faceBuffer, 'face.jpg');
        } catch (e) {
            return reply("❌ ᴄᴏᴜʟᴅ ɴᴏᴛ ɢᴇᴛ ᴛʜᴇ ᴘʀᴏꜰɪʟᴇ ᴘɪᴄᴛᴜʀᴇ ᴏꜰ ᴛʜᴇ ᴛᴀɢɢᴇᴅ ᴜꜱᴇʀ.");
        }

        // 3. Call API
        const apiUrl = `https://meta.davidxtech.de/api/pixnova/faceswap?target_image_url=${encodeURIComponent(targetUrl)}&face_image_url=${encodeURIComponent(faceUrl)}`;
        
        const res = await axios.get(apiUrl, { timeout: 60000, validateStatus: () => true });

        if (res.status !== 200 || !res.data || !res.data.success) {
            throw new Error(`API rejected the request: ${res.status}`);
        }

        const finalImage = res.data.result || res.data.image_url || res.data.url;
        if (!finalImage) throw new Error("API did not return an image link.");

        // 4. Send Result
        await conn.sendMessage(from, {
            image: { url: finalImage },
            caption: `✅ *ꜰᴀᴄᴇ ꜱᴡᴀᴘ ꜱᴜᴄᴄᴇꜱꜱꜰᴜʟ!*\n\n> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴘʀɪᴍᴇ ʀɪᴅᴢ*`
        }, { quoted: anony });

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });

    } catch (error) {
        console.error('FaceSwap Error:', error.message);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
        reply(`❌ ᴇʀʀᴏʀ: ${error.message}`);
    }
});

// ──────────────────────────────────────────────────────────────
// 2. VIDEO FACE SWAP COMMAND
// ──────────────────────────────────────────────────────────────
cmd({
    pattern: "vfaceswap",
    alias: ["videofaceswap", "vswap"],
    react: "🎬",
    desc: "Swap a face onto a video",
    category: "ai",
    use: ".vfaceswap [reply to Video] [tag user for Face]",
    filename: __filename
}, async (conn, mek, m, { from, reply }) => {
    try {
        const quotedVideo = m.quoted ? m.quoted : null;
        if (!quotedVideo || !quotedVideo.mimetype?.startsWith('video/')) {
            return reply("❌ ᴘʟᴇᴀꜱᴇ ʀᴇᴘʟʏ ᴛᴏ ᴀ *ᴠɪᴅᴇᴏ* ᴡɪᴛʜ ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ.");
        }

        const mentions = m.mentionedJid || [];
        if (mentions.length === 0) {
            return reply("❌ ʏᴏᴜ ᴀʟꜱᴏ ɴᴇᴇᴅ ᴛᴏ ᴛᴀɢ ᴛʜᴇ ᴜꜱᴇʀ ᴡʜᴏꜱᴇ *ꜰᴀᴄᴇ* ʏᴏᴜ ᴡᴀɴᴛ ᴛᴏ ᴜꜱᴇ.");
        }

        const faceUser = mentions[0];
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
        await reply("🔄 ᴜᴘʟᴏᴀᴅɪɴɢ ᴠɪᴅᴇᴏ ᴀɴᴅ ꜰᴀᴄᴇ... ᴛʜɪꜱ ᴍᴀʏ ᴛᴀᴋᴇ ᴀ ᴡʜɪʟᴇ.");

        // 1. Upload Video
        const videoBuffer = await quotedVideo.download();
        const videoUrl = await uploadImage(videoBuffer, 'video.mp4');

        // 2. Get Face
        let faceUrl;
        try {
            const ppUrl = await conn.profilePictureUrl(faceUser, 'image');
            const ppRes = await axios.get(ppUrl, { responseType: 'arraybuffer' });
            faceUrl = await uploadImage(Buffer.from(ppRes.data, 'binary'), 'face.jpg');
        } catch (e) {
            return reply("❌ ᴄᴏᴜʟᴅ ɴᴏᴛ ɢᴇᴛ ᴛʜᴇ ᴛᴀɢɢᴇᴅ ᴜꜱᴇʀ'ꜱ ᴘʀᴏꜰɪʟᴇ ᴘɪᴄᴛᴜʀᴇ.");
        }

        // 3. Call API
        const apiUrl = `https://meta.davidxtech.de/api/pixnova/video-faceswap?video_url=${encodeURIComponent(videoUrl)}&face_image_url=${encodeURIComponent(faceUrl)}`;
        
        const res = await axios.get(apiUrl, { timeout: 120000, validateStatus: () => true });

        if (res.status !== 200 || !res.data || !res.data.success) {
            throw new Error(`API rejected the request: ${res.status}`);
        }

        const finalVideo = res.data.result || res.data.video_url || res.data.url;
        if (!finalVideo) throw new Error("API did not return a video link.");

        // 4. Send Result
        await conn.sendMessage(from, {
            video: { url: finalVideo },
            caption: `✅ *ᴠɪᴅᴇᴏ ꜰᴀᴄᴇ ꜱᴡᴀᴘ ꜱᴜᴄᴄᴇꜱꜱꜰᴜʟ!*\n\n> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴘʀɪᴍᴇ ʀɪᴅᴢ*`
        }, { quoted: anony });

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });

    } catch (error) {
        console.error('Video FaceSwap Error:', error.message);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
        reply(`❌ ᴇʀʀᴏʀ: ${error.message}`);
    }
});

// ──────────────────────────────────────────────────────────────
// 3. BABY GENERATOR COMMAND
// ──────────────────────────────────────────────────────────────
cmd({
    pattern: "baby",
    alias: ["babygen", "babygenerator"],
    react: "👶",
    desc: "Generate a baby from two people",
    category: "ai",
    use: ".baby @user1 @user2",
    filename: __filename
}, async (conn, mek, m, { from, reply }) => {
    try {
        const mentions = m.mentionedJid || [];
        if (mentions.length < 2) {
            return reply("❌ ᴘʟᴇᴀꜱᴇ ᴛᴀɢ ᴛᴡᴏ ᴜꜱᴇʀꜱ! ᴇx: `.ʙᴀʙʏ @ᴜꜱᴇʀ1 @ᴜꜱᴇʀ2`");
        }

        const user1 = mentions[0];
        const user2 = mentions[1];

        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
        await reply("🔄 ɢᴇɴᴇʀᴀᴛɪɴɢ ʙᴀʙʏ... ᴘʟᴇᴀꜱᴇ ᴡᴀɪᴛ.");

        // 1. Get Face 1
        let face1Url, face2Url;
        try {
            const pp1 = await conn.profilePictureUrl(user1, 'image');
            const pp1Res = await axios.get(pp1, { responseType: 'arraybuffer' });
            face1Url = await uploadImage(Buffer.from(pp1Res.data, 'binary'), 'face1.jpg');
        } catch (e) {
            return reply("❌ ᴄᴏᴜʟᴅ ɴᴏᴛ ɢᴇᴛ ᴛʜᴇ ᴘʀᴏꜰɪʟᴇ ᴘɪᴄᴛᴜʀᴇ ᴏꜰ ᴛʜᴇ ꜰɪʀꜱᴛ ᴜꜱᴇʀ.");
        }

        // 2. Get Face 2
        try {
            const pp2 = await conn.profilePictureUrl(user2, 'image');
            const pp2Res = await axios.get(pp2, { responseType: 'arraybuffer' });
            face2Url = await uploadImage(Buffer.from(pp2Res.data, 'binary'), 'face2.jpg');
        } catch (e) {
            return reply("❌ ᴄᴏᴜʟᴅ ɴᴏᴛ ɢᴇᴛ ᴛʜᴇ ᴘʀᴏꜰɪʟᴇ ᴘɪᴄᴛᴜʀᴇ ᴏꜰ ᴛʜᴇ ꜱᴇᴄᴏɴᴅ ᴜꜱᴇʀ.");
        }

        // 3. Call API
        const apiUrl = `https://meta.davidxtech.de/api/pixnova/baby?father_image_url=${encodeURIComponent(face1Url)}&mother_image_url=${encodeURIComponent(face2Url)}`;
        
        const res = await axios.get(apiUrl, { timeout: 60000, validateStatus: () => true });

        if (res.status !== 200 || !res.data || !res.data.success) {
            throw new Error(`API rejected the request: ${res.status}`);
        }

        const finalImage = res.data.result || res.data.image_url || res.data.url;
        if (!finalImage) throw new Error("API did not return an image link.");

        // 4. Send Result
        await conn.sendMessage(from, {
            image: { url: finalImage },
            caption: `✅ *ʙᴀʙʏ ɢᴇɴᴇʀᴀᴛᴇᴅ ꜱᴜᴄᴄᴇꜱꜱꜰᴜʟʟʏ!*\n\n> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴘʀɪᴍᴇ ʀɪᴅᴢ*`
        }, { quoted: anony });

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });

    } catch (error) {
        console.error('Baby Generator Error:', error.message);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
        reply(`❌ ᴇʀʀᴏʀ: ${error.message}`);
    }
});

// ──────────────────────────────────────────────────────────────
// 4. FILTER MAPPING
// ──────────────────────────────────────────────────────────────
const AI_FILTERS = {
    'toanime': 'toanime', 'tobabi': 'tobabi', 'tobersama': 'tobersama',
    'tobotak': 'tobotak', 'tochibi': 'tochibi', 'todubai': 'todubai',
    'toghbili': 'toghbili', 'tohijab': 'tohijab', 'tojapanese': 'tojapanese',
    'tokacamata': 'tokacamata', 'toleg': 'toleg', 'tomaid': 'tomaid',
    'tomaya': 'tomaya', 'tomirror': 'tomirror', 'tomonkey': 'tomonkey',
    'tocarv2': 'tocarv2', 'toofficial': 'toofficial', 'topolaroid': 'topolaroid',
    'towhite': 'towhite', 'toblack': 'toblack', 'tojapan': 'tojapan',
    'tokamboja': 'tokamboja', 'toliquor': 'toliquor', 'tomangu': 'tomangu',
    'tomecca': 'tomecca', 'tomoai': 'tomoai', 'topacat': 'topacat',
    'topeci': 'topeci', 'topyramid': 'topyramid', 'topunk': 'topunk',
    'toreal': 'toreal', 'toroblox': 'toroblox', 'toroh': 'toroh',
    'tosad': 'tosad', 'tosatan': 'tosatan', 'tosdmtinggi': 'tosdmtinggi',
    'tosexy': 'tosexy', 'tosingapura': 'tosingapura', 'tostreetwear': 'tostreetwear',
    'totato': 'totato', 'totrain': 'totrain', 'totua': 'totua',
    'toturky': 'toturky', 'tounderground': 'tounderground', 'toviking': 'toviking',
    'tovintage': 'tovintage', 'tozombie': 'tozombie'
};

// ──────────────────────────────────────────────────────────────
// MASTER FILTER HANDLER
// ──────────────────────────────────────────────────────────────
async function handleFilter(conn, mek, m, { from, reply, command }) {
    try {
        const quoted = m.quoted ? m.quoted : m;
        const mime = (quoted.msg || quoted).mimetype || '';

        if (!mime || !mime.startsWith('image/')) {
            return reply("📸 ᴘʟᴇᴀꜱᴇ ʀᴇᴘʟʏ ᴛᴏ ᴀɴ *ɪᴍᴀɢᴇ* ᴡɪᴛʜ ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ.");
        }

        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });

        // 1. Download and upload image
        const buffer = await quoted.download();
        const uploadedUrl = await uploadImage(buffer, `img_${Date.now()}.jpg`);

        // 2. Call the API
        const endpoint = AI_FILTERS[command];
        const apiUrl = `https://api-faa.my.id/faa/${endpoint}?url=${encodeURIComponent(uploadedUrl)}`;

        const res = await axios.get(apiUrl, {
            responseType: 'arraybuffer',
            timeout: 60000,
            validateStatus: () => true
        });

        if (res.status !== 200 || !res.data || res.data.length < 100) {
            let errMsg = '';
            if (res.headers['content-type']?.includes('json') || res.headers['content-type']?.includes('text')) {
                errMsg = Buffer.from(res.data).toString();
            }
            throw new Error(`API rejected (${res.status}) ${errMsg.slice(0, 50)}`);
        }

        const outBuffer = Buffer.from(res.data, 'binary');

        // 3. Send Result
        await conn.sendMessage(from, {
            image: outBuffer,
            caption: `✨ *ꜰɪʟᴛᴇʀ ᴀᴘᴘʟɪᴇᴅ:* ${command.toUpperCase()}\n\n> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴘʀɪᴍᴇ ʀɪᴅᴢ*`
        }, { quoted: anony });

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });

    } catch (error) {
        console.error(`[Filter ${command} Error]:`, error.message);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
        reply(`❌ ᴇʀʀᴏʀ: ${error.message}`);
    }
}

// ──────────────────────────────────────────────────────────────
// AUTO-REGISTER FILTERS
// ──────────────────────────────────────────────────────────────
for (const cmdName of Object.keys(AI_FILTERS)) {
    cmd({
        pattern: cmdName,
        desc: `AI Image Filter: ${cmdName}`,
        category: 'img_edit',
        use: `.${cmdName} [reply to image]`,
        filename: __filename
    }, async (conn, mek, m, ctx) => {
        await handleFilter(conn, mek, m, ctx);
    });
}

const aiModels = {
    'prince': 'princeai',
    'ai': 'chatai',
    'gpt': 'chatgpt',
    'gpt4': 'chatgpt4',
    'gpt4o': 'chatgpt4o',
    'gpt4omini': 'chatgpt4omini',
    'openai': 'openai',
    'mistral': 'mistralai',
    'blackbox': 'blackbox',
    'gemini': 'geminiai',
    'geminipro': 'geminipro',
    'letmegpt': 'letmegpt',
    'wwdgpt': 'wwdgpt',
    'deepseekv3': 'deepseekv3',
    'deepseekr1': 'deepseekr1',
    'deepseekllm': 'deepseekllm'
};

Object.entries(aiModels).forEach(([alias, endpoint]) => {
    cmd({
        pattern: alias,
        react: "🤖",
        desc: `Chat with ${alias.toUpperCase()} AI`,
        category: "ai",
        use: `.${alias} <prompt>`,
        filename: __filename
    }, async (conn, mek, m, { from, reply, q }) => {
        if (!q) return reply(`ᴘʟᴇᴀꜱᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ᴘʀᴏᴍᴘᴛ.\nᴇxᴀᴍᴘʟᴇ: .${alias} ʜᴏᴡ ᴛᴏ ᴄᴏᴏᴋ ʀɪᴄᴇ?`);
        
        try {
            await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
            
            const apiUrl = `https://api.princetechn.com/api/ai/${endpoint}?apikey=prince&q=${encodeURIComponent(q)}`;
            const res = await axios.get(apiUrl);
            const data = res.data;

            if (!data || !data.success || !data.result) {
                throw new Error('ꜰᴀɪʟᴇᴅ ᴛᴏ ɢᴇᴛ ʀᴇsᴘᴏɴsᴇ ꜰʀᴏᴍ ᴀɪ.');
            }

            // Handle different response structures (result might be string or object)
            const responseText = typeof data.result === 'string' ? data.result : (data.result.response || data.result.text || JSON.stringify(data.result));

            await conn.sendMessage(from, { text: responseText }, { quoted: anony });
            await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });

        } catch (error) {
            console.error(`[${alias} ᴇʀʀᴏʀ]`, error);
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
            reply(`❌ ᴇʀʀᴏʀ: ${error.message}`);
        }
    });
});

// ─────────────────────────────────────────────
// VISION AI (Image to Text)
// ─────────────────────────────────────────────
cmd({
    pattern: "vision",
    alias: ["analyzeimage", "describeimage"],
    react: "👁️",
    desc: "Get an image described by Vision AI",
    category: "ai",
    use: ".vision <image_url> [prompt]",
    filename: __filename
}, async (conn, mek, m, { from, reply, q }) => {
    if (!q) return reply("ᴜꜱᴀɢᴇ: .ᴠɪꜱɪᴏɴ <ɪᴍᴀɢᴇ_ᴜʀʟ> [ᴘʀᴏᴍᴘᴛ]\nᴇxᴀᴍᴘʟᴇ: .ᴠɪꜱɪᴏɴ https://example.com/cat.jpg ᴡʜᴀᴛ ɪꜱ ᴛʜɪꜱ?");

    const args = q.split(" ");
    const imageUrl = args[0];
    const prompt = args.slice(1).join(" ") || "ᴅᴇꜱᴄʀɪʙᴇ ᴛʜɪꜱ ɪᴍᴀɢᴇ ɪɴ ᴅᴇᴛᴀɪʟ.";

    if (!imageUrl.startsWith('http')) return reply("❌ ᴘʟᴇᴀꜱᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ᴠᴀʟɪᴅ ɪᴍᴀɢᴇ ᴜʀʟ.");

    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
        const apiUrl = `https://api.princetechn.com/api/ai/vision?apikey=prince&url=${encodeURIComponent(imageUrl)}&prompt=${encodeURIComponent(prompt)}`;
        const res = await axios.get(apiUrl);
        
        if (!res.data.success || !res.data.result) throw new Error('ꜰᴀɪʟᴇᴅ ᴛᴏ ᴀɴᴀʟʏᴢᴇ ɪᴍᴀɢᴇ.');
        
        const responseText = typeof res.data.result === 'string' ? res.data.result : JSON.stringify(res.data.result);
        await conn.sendMessage(from, { text: responseText }, { quoted: anony });
        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
    } catch (error) {
        console.error('ᴠɪꜱɪᴏɴ ᴇʀʀᴏʀ:', error);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
        reply(`❌ ᴇʀʀᴏʀ: ${error.message}`);
    }
});

// ─────────────────────────────────────────────
// IMAGE GENERATION
// ─────────────────────────────────────────────
const imageGenModels = {
    'text2image': 'text2image',
    'flux': 'fluximage',
    'sd': 'stablediffusion'
};

Object.entries(imageGenModels).forEach(([alias, endpoint]) => {
    cmd({
        pattern: alias,
        alias: [alias + 'ai'],
        react: "🎨",
        desc: `Generate an image using ${alias.toUpperCase()}`,
        category: "ai",
        use: `.${alias} <prompt>`,
        filename: __filename
    }, async (conn, mek, m, { from, reply, q }) => {
        if (!q) return reply(`ᴘʟᴇᴀꜱᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ᴘʀᴏᴍᴘᴛ.\nᴇxᴀᴍᴘʟᴇ: .${alias} ᴀɴ ᴀsᴛʀᴏɴᴀᴜᴛ ʀɪᴅɪɴɢ ᴀ ʜᴏʀsᴇ`);
        
        try {
            await conn.sendMessage(from, { react: { text: '🎨', key: mek.key } });
            
            const apiUrl = `https://api.princetechn.com/api/ai/${endpoint}?apikey=prince&q=${encodeURIComponent(q)}`;
            const res = await axios.get(apiUrl);
            const data = res.data;

            // Handle different API response structures for image links
            let imageUrl = null;
            if (data.result) {
                imageUrl = data.result.image_url || data.result.url || data.result;
            }

            if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.startsWith('http')) {
                throw new Error('ɴᴏ ᴠᴀʟɪᴅ ɪᴍᴀɢᴇ ᴜʀʟ ʀᴇᴛᴜʀɴᴇᴅ ꜰʀᴏᴍ ᴀᴘɪ.');
            }

            await conn.sendMessage(from, {
                image: { url: imageUrl },
                caption: `🎨 *ᴀɪ ɢᴇɴᴇʀᴀᴛᴇᴅ ɪᴍᴀɢᴇ*\n\n📝 ᴘʀᴏᴍᴘᴛ: ${q}`
            }, { quoted: anony });

            await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });

        } catch (error) {
            console.error(`[${alias} ᴇʀʀᴏʀ]`, error);
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
            reply(`❌ ᴇʀʀᴏʀ: ${error.message}`);
        }
    });
});
;

// ─────────────────────────────────────────────
// VEO3 TEXT TO VIDEO
// ─────────────────────────────────────────────
cmd({
    pattern: "veo3",
    alias: ["text2video", "t2v"],
    react: "🎬",
    desc: "Generate a short video from text using Veo3",
    category: "ai",
    use: ".veo3 <prompt>",
    filename: __filename
}, async (conn, mek, m, { from, reply, q }) => {
    if (!q) return reply("ᴘʟᴇᴀꜱᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ᴘʀᴏᴍᴘᴛ ꜰᴏʀ ᴛʜᴇ ᴠɪᴅᴇᴏ.\nᴇxᴀᴍᴘʟᴇ: .ᴠᴇᴏ3 ᴀ ᴄᴀᴛ ᴅᴀɴᴄɪɴɢ ɪɴ ᴛʜᴇ ʀᴀɪɴ");

    try {
        await conn.sendMessage(from, { react: { text: '🎬', key: mek.key } });
        await reply("🎬 ɢᴇɴᴇʀᴀᴛɪɴɢ ᴠɪᴅᴇᴏ... ᴛʜɪꜱ ᴍᴀʏ ᴛᴀᴋᴇ ᴀ ᴡʜɪʟᴇ.");
        
        // Note: Endpoint expects POST based on screenshot
        const apiUrl = `https://api.princetechn.com/api/ai/veo3`;
        const res = await axios.post(apiUrl, {
            apikey: "prince",
            prompt: q
        }, {
            headers: { 'Content-Type': 'application/json' }
        });

        const data = res.data;
        let videoUrl = null;

        if (data.result) {
            videoUrl = data.result.video_url || data.result.url || data.result;
        }

        if (!videoUrl || typeof videoUrl !== 'string') {
            throw new Error('ɴᴏ ᴠɪᴅᴇᴏ ᴜʀʟ ʀᴇᴛᴜʀɴᴇᴅ.');
        }

        await conn.sendMessage(from, {
            video: { url: videoUrl },
            caption: `🎬 *ᴠᴇᴏ3 ᴠɪᴅᴇᴏ ɢᴇɴᴇʀᴀᴛᴇᴅ*\n\n📝 ᴘʀᴏᴍᴘᴛ: ${q}`
        }, { quoted: anony });

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });

    } catch (error) {
        console.error('ᴠᴇᴏ3 ᴇʀʀᴏʀ:', error);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
        reply(`❌ ᴇʀʀᴏʀ: ${error.message}`);
    }
});

// ─────────────────────────────────────────────
// AUDIO TRANSCRIPTION
// ─────────────────────────────────────────────
cmd({
    pattern: "transcribe",
    alias: ["stt", "whisper"],
    react: "🎙️",
    desc: "Transcribe audio to text using Whisper AI",
    category: "ai",
    use: ".transcribe <audio_url>",
    filename: __filename
}, async (conn, mek, m, { from, reply, q }) => {
    if (!q) return reply("ᴘʟᴇᴀꜱᴇ ᴘʀᴏᴠɪᴅᴇ ᴀɴ ᴀᴜᴅɪᴏ ᴜʀʟ.\nᴇxᴀᴍᴘʟᴇ: .ᴛʀᴀɴsᴄʀɪʙᴇ https://example.com/audio.mp3");
    if (!q.startsWith('http')) return reply("❌ ᴘʟᴇᴀꜱᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ᴠᴀʟɪᴅ ᴀᴜᴅɪᴏ ᴜʀʟ (sᴛᴀʀᴛɪɴɢ ᴡɪᴛʜ http).");

    try {
        await conn.sendMessage(from, { react: { text: '🎙️', key: mek.key } });
        
        const apiUrl = `https://api.princetechn.com/api/ai/audiotranscription?apikey=prince&url=${encodeURIComponent(q)}`;
        const res = await axios.get(apiUrl);
        const data = res.data;

        if (!data.success || !data.result) throw new Error('ꜰᴀɪʟᴇᴅ ᴛᴏ ᴛʀᴀɴsᴄʀɪʙᴇ ᴀᴜᴅɪᴏ.');

        const text = typeof data.result === 'string' ? data.result : JSON.stringify(data.result);
        
        await conn.sendMessage(from, { 
            text: `🎙️ *ᴛʀᴀɴsᴄʀɪᴘᴛɪᴏɴ ʀᴇsᴜʟᴛ*\n\n${text}` 
        }, { quoted: anony });
        
        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });

    } catch (error) {
        console.error('ᴛʀᴀɴsᴄʀɪʙᴇ ᴇʀʀᴏʀ:', error);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
        reply(`❌ ᴇʀʀᴏʀ: ${error.message}`);
    }
});