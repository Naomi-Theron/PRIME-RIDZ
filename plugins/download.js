const fetch = require('node-fetch');
const yts = require('yt-search');
const { cmd } = require('../command');
const { anony } = require('../lib/ridzcoder');

function isYoutubeUrl(str) {
    return /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//.test(str);
}

function sanitizeFilename(title, ext = '') {
    return (title || 'audio')
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
        .substring(0, 64) + ext;
}

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Referer': 'https://www.youtube.com/'
};

// Fetch from Hector API and parse audio/video correctly
async function fetchYtApi(videoUrl, type = 'audio') {
    const url = `https://yt-dl.officialhectormanuel.workers.dev/?url=${encodeURIComponent(videoUrl)}`;
    console.log(`[ᴘʟᴀʏ] ꜰᴇᴛᴄʜɪɴɢ ᴀᴘɪ: ${url}`);

    const res = await fetch(url, { headers: HEADERS, redirect: 'follow' });
    const data = await res.json();
    console.log(`[ᴘʟᴀʏ] ᴀᴘɪ ʀᴇꜱᴘᴏɴꜱᴇ:`, JSON.stringify(data).substring(0, 300));

    if (!data || !data.status) return null;

    let downloadUrl;
    if (type === 'audio') {
        downloadUrl = data.audio;
    } else {
        // Pick highest available video quality (e.g. 360, 720, 1080)
        if (data.videos) {
            const qualities = Object.keys(data.videos).sort((a, b) => Number(b) - Number(a));
            downloadUrl = data.videos[qualities[0]];
        }
    }

    if (!downloadUrl) return null;

    return {
        download: downloadUrl,
        title: data.title || 'ᴜɴᴋɴᴏᴡɴ ᴛɪᴛʟᴇ',
        cover: data.thumbnail || null
    };
}

// Download to buffer
async function downloadBuffer(url) {
    console.log(`[ᴘʟᴀʏ] ᴅᴏᴡɴʟᴏᴀᴅɪɴɢ ʙᴜꜰꜰᴇʀ: ${url.substring(0, 80)}...`);
    const res = await fetch(url, { headers: HEADERS, redirect: 'follow' });
    if (!res.ok) throw new Error(`ᴅᴏᴡɴʟᴏᴀᴅ ꜰᴀɪʟᴇᴅ ᴡɪᴛʜ ꜱᴛᴀᴛᴜꜱ ${res.status}`);
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log(`[ᴘʟᴀʏ] ʙᴜꜰꜰᴇʀ ꜱɪᴢᴇ: ${(buffer.length / 1024 / 1024).toFixed(2)} ᴍʙ`);
    if (buffer.length < 1024) throw new Error(`ꜰɪʟᴇ ᴛᴏᴏ ꜱᴍᴀʟʟ (${buffer.length} ʙʏᴛᴇꜱ)`);
    return buffer;
}

// --- YTMP3 ---
cmd({
    pattern: "ytmp3",
    alias: ["song", "audio"],
    desc: "Download YouTube audio (MP3 Document)",
    category: "main",
    use: ".ytmp3 <song name or url>",
    react: "🔰",
    filename: __filename
}, async (conn, mek, m, { from, reply, q }) => {
    try {
        if (!q) return reply("❗ ᴘʟᴇᴀꜱᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ꜱᴏɴɢ ɴᴀᴍᴇ ᴏʀ ʏᴏᴜᴛᴜʙᴇ ᴜʀʟ.");

        let ytUrl = q;
        if (!isYoutubeUrl(q)) {
            const searchResults = await yts(q);
            if (!searchResults.videos || !searchResults.videos.length) {
                return reply("❌ ɴᴏ ᴀᴜᴅɪᴏ ꜰᴏᴜɴᴅ.");
            }
            ytUrl = searchResults.videos[0].url;
        }

        const result = await fetchYtApi(ytUrl, 'audio');
        if (!result) return reply("❌ ꜰᴀɪʟᴇᴅ ᴛᴏ ɢᴇᴛ ᴀᴜᴅɪᴏ ʟɪɴᴋ.");

        const buffer = await downloadBuffer(result.download);

        await conn.sendMessage(from, {
            document: buffer,
            mimetype: "audio/mpeg",
            fileName: sanitizeFilename(result.title, '.mp3')
        }, { quoted: anony });

        await conn.sendMessage(from, { react: { text: '✅', key: m.key } });
    } catch (err) {
        console.error('[ʏᴛᴍᴘ3 ᴇʀʀᴏʀ]', err);
        await conn.sendMessage(from, { react: { text: '❌', key: m.key } });
        reply(`⚠️ ᴇʀʀᴏʀ: ${err.message}`);
    }
});

// --- YTMP4 ---
cmd({
    pattern: "ytmp4",
    alias: ["video"],
    desc: "Download YouTube video (MP4)",
    category: "main",
    use: ".ytmp4 <video name or url>",
    react: "🔰",
    filename: __filename
}, async (conn, mek, m, { from, reply, q }) => {
    try {
        if (!q) return reply("❗ ᴘʟᴇᴀꜱᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ᴠɪᴅᴇᴏ ɴᴀᴍᴇ ᴏʀ ʏᴏᴜᴛᴜʙᴇ ᴜʀʟ.");

        let ytUrl = q;
        if (!isYoutubeUrl(q)) {
            const searchResults = await yts(q);
            if (!searchResults.videos || !searchResults.videos.length) {
                return reply("❌ ɴᴏ ᴠɪᴅᴇᴏ ꜰᴏᴜɴᴅ.");
            }
            ytUrl = searchResults.videos[0].url;
        }

        const result = await fetchYtApi(ytUrl, 'video');
        if (!result) return reply("❌ ꜰᴀɪʟᴇᴅ ᴛᴏ ɢᴇᴛ ᴠɪᴅᴇᴏ ʟɪɴᴋ.");

        const buffer = await downloadBuffer(result.download);

        await conn.sendMessage(from, {
            video: buffer,
            mimetype: "video/mp4",
            caption: `📽️ *${result.title}*\n🎨 ʙʏ: ᴛᴇʀʀɪ`
        }, { quoted: anony });

        await conn.sendMessage(from, { react: { text: '✅', key: m.key } });
    } catch (err) {
        console.error('[ʏᴛᴍᴘ4 ᴇʀʀᴏʀ]', err);
        await conn.sendMessage(from, { react: { text: '❌', key: m.key } });
        reply(`⚠️ ᴇʀʀᴏʀ: ${err.message}`);
    }
});

// --- PLAY ---
cmd({
    pattern: "play",
    alias: ["yta"],
    react: "🎵",
    desc: "Download YouTube audio (document MP3)",
    category: "downloader",
    use: ".play <song name or url>",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("🎵 ᴘʟᴇᴀꜱᴇ ᴘʀᴏᴠɪᴅᴇ ᴠɪᴅᴇᴏ ɴᴀᴍᴇ");

        let ytUrl = q;
        if (!isYoutubeUrl(q)) {
            const searchResults = await yts(q);
            if (!searchResults.videos || !searchResults.videos.length) {
                return reply("ɴᴏ ʀᴇꜱᴜʟᴛꜱ ꜰᴏᴜɴᴅ");
            }
            ytUrl = searchResults.videos[0].url;
        }

        const result = await fetchYtApi(ytUrl, 'audio');
        if (!result) return reply("ᴀᴜᴅɪᴏ ᴅᴏᴡɴʟᴏᴀᴅ ꜰᴀɪʟᴇᴅ");

        const buffer = await downloadBuffer(result.download);

        await conn.sendMessage(from, {
            document: buffer,
            mimetype: 'audio/mpeg',
            fileName: sanitizeFilename(result.title, '.mp3')
        }, { quoted: anony });

        await conn.sendMessage(from, { react: { text: '✅', key: m.key } });
    } catch (e) {
        console.error('[ᴘʟᴀʏ ᴇʀʀᴏʀ]', e);
        await conn.sendMessage(from, { react: { text: '❌', key: m.key } });
        reply(`ᴇʀʀᴏʀ: ${e.message}`);
    }
});

// --- PLAY2 ---
cmd({
    pattern: "play2",
    alias: ["yta2", "song2"],
    react: "🎵",
    desc: "Download high quality YouTube audio",
    category: "media",
    use: ".play2 <song name or url>",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("ᴘʟᴇᴀꜱᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ꜱᴏɴɢ ɴᴀᴍᴇ");

        let ytUrl = q;
        if (!isYoutubeUrl(q)) {
            const searchResults = await yts(q);
            if (!searchResults.videos || !searchResults.videos.length) {
                return reply("❌ ɴᴏ ʀᴇꜱᴜʟᴛꜱ ꜰᴏᴜɴᴅ.");
            }
            ytUrl = searchResults.videos[0].url;
        }

        const result = await fetchYtApi(ytUrl, 'audio');
        if (!result) return reply("❌ ꜰᴀɪʟᴇᴅ ᴛᴏ ꜰᴇᴛᴄʜ ᴀᴜᴅɪᴏ.");

        if (result.cover) {
            await conn.sendMessage(from, {
                image: { url: result.cover },
                caption: `*ʏᴛ ᴀᴜᴅɪᴏ ᴅᴏᴡɴʟᴏᴀᴅᴇʀ*\n╭━━❐━⪼\n┇๏ *ᴛɪᴛʟᴇ* – ${result.title}\n╰━━❑━⪼`
            }, { quoted: anony });
        }

        const buffer = await downloadBuffer(result.download);

        await conn.sendMessage(from, {
            document: buffer,
            mimetype: 'audio/mpeg',
            fileName: sanitizeFilename(result.title, '.mp3')
        }, { quoted: anony });

        await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });
    } catch (error) {
        console.error('[ᴘʟᴀʏ2 ᴇʀʀᴏʀ]', error);
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
        reply(`⚠️ ᴇʀʀᴏʀ: ${error.message}`);
    }
});