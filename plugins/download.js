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

// Helper to try APIs
async function fetchYtApi(type, videoUrl) {
    const endpoints = [];
    if (type === 'mp3') {
        endpoints.push(`https://yt-dl.officialhectormanuel.workers.dev/?url=${encodeURIComponent(videoUrl)}`);
    } else if (type === 'mp4') {
        endpoints.push(`https://yt-dl.officialhectormanuel.workers.dev/?url=${encodeURIComponent(videoUrl)}`);
        endpoints.push(`https://apis.davidcyril.name.ng/download/ytmp4?url=${encodeURIComponent(videoUrl)}`);
    }

    for (const url of endpoints) {
        try {
            const res = await fetch(url);
            const data = await res.json();
            
            // Check if the API returned valid data
            if (!data) continue;
            
            // Normalize the response structure depending on which API worked
            let downloadUrl = data.url || data.download || data.result?.download || data.link;
            let title = data.title || data.result?.title || 'ᴜɴᴋɴᴏᴡɴ ᴛɪᴛʟᴇ';
            let cover = data.thumbnail || data.thumb || data.result?.cover;

            if (downloadUrl) {
                return { download: downloadUrl, title, cover };
            }
        } catch (e) {
            console.log(`ᴀᴘɪ ꜰᴀɪʟᴇᴅ: ${url} - ${e.message}`);
        }
    }
    return null;
}

// --- YTMP3 Command (Returns as Document) ---
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
        if (!q) return reply("❗ ᴘʟᴇᴀsᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ sᴏɴɢ ɴᴀᴍᴇ ᴏʀ ʏᴏᴜᴛᴜʙᴇ ᴜʀʟ.");

        let ytUrl = q;
        if (!isYoutubeUrl(q)) {
            const searchResults = await yts(q);
            if (!searchResults.videos || !searchResults.videos.length) {
                return reply("❌ ɴᴏ ᴀᴜᴅɪᴏ ꜰᴏᴜɴᴅ ᴡɪᴛʜ ᴛʜᴀᴛ ɴᴀᴍᴇ.");
            }
            ytUrl = searchResults.videos[0].url;
        }

        const result = await fetchYtApi('mp3', ytUrl);
        if (!result) return reply("❌ ꜰᴀɪʟᴇᴅ ᴛᴏ ᴅᴏᴡɴʟᴏᴀᴅ ᴀᴜᴅɪᴏ. ᴀʟʟ ᴀᴘɪs ꜰᴀɪʟᴇᴅ.");

        // Send cover image first (optional)
        if (result.cover) {
            await conn.sendMessage(from, {
                image: { url: result.cover },
                caption: `🎵 *${result.title}*\n📊 ǫᴜᴀʟɪᴛʏ: ᴍᴘ3\nᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴛᴇʀʀɪ`
            }, { quoted: anony });
        }

        // Send as Document
        await conn.sendMessage(from, {
            document: { url: result.download },
            mimetype: "audio/mpeg",
            fileName: sanitizeFilename(result.title, '.mp3')
        }, { quoted: anony });

        await conn.sendMessage(from, { react: { text: '✅', key: m.key } });
    } catch (err) {
        console.error(err);
        await conn.sendMessage(from, { react: { text: '❌', key: m.key } });
        reply("⚠️ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ. ᴛʀʏ ᴀɢᴀɪɴ.");
    }
});

// --- YTMP4 Command (Returns as Video) ---
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
        if (!q) return reply("❗ ᴘʟᴇᴀsᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ᴠɪᴅᴇᴏ ɴᴀᴍᴇ ᴏʀ ʏᴏᴜᴛᴜʙᴇ ᴜʀʟ.");

        let ytUrl = q;
        if (!isYoutubeUrl(q)) {
            const searchResults = await yts(q);
            if (!searchResults.videos || !searchResults.videos.length) {
                return reply("❌ ɴᴏ ᴠɪᴅᴇᴏ ꜰᴏᴜɴᴅ ᴡɪᴛʜ ᴛʜᴀᴛ ɴᴀᴍᴇ.");
            }
            ytUrl = searchResults.videos[0].url;
        }

        const result = await fetchYtApi('mp4', ytUrl);
        if (!result) return reply("❌ ꜰᴀɪʟᴇᴅ ᴛᴏ ᴅᴏᴡɴʟᴏᴀᴅ ᴠɪᴅᴇᴏ. ᴀʟʟ ᴀᴘɪs ꜰᴀɪʟᴇᴅ.");

        await conn.sendMessage(from, {
            video: { url: result.download },
            mimetype: "video/mp4",
            caption: `📽️ *${result.title}*\n📊 ǫᴜᴀʟɪᴛʏ: ᴍᴘ4\n🎨 ʙʏ: ᴛᴇʀʀɪ`
        }, { quoted: anony });

        await conn.sendMessage(from, { react: { text: '✅', key: m.key } });
    } catch (err) {
        console.error(err);
        await conn.sendMessage(from, { react: { text: '❌', key: m.key } });
        reply("⚠️ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ. ᴛʀʏ ᴀɢᴀɪɴ.");
    }
});

// --- PLAY Command (Returns as Document) ---
cmd({
    pattern: "play",
    alias: ["yta"],
    react: "🎵",
    desc: "Download YouTube audio (document MP3 only)",
    category: "downloader",
    use: ".play <song name or url>",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("🎵 ᴘʟᴇᴀsᴇ ᴘʀᴏᴠɪᴅᴇ ᴠɪᴅᴇᴏ ɴᴀᴍᴇ");

        let ytUrl = q;
        if (!isYoutubeUrl(q)) {
            const searchResults = await yts(q);
            if (!searchResults.videos || !searchResults.videos.length) {
                return reply("ɴᴏ ʀᴇsᴜʟᴛs ꜰᴏᴜɴᴅ");
            }
            ytUrl = searchResults.videos[0].url;
        }

        const result = await fetchYtApi('mp3', ytUrl);
        if (!result) return reply("ᴀᴜᴅɪᴏ ᴅᴏᴡɴʟᴏᴀᴅ ꜰᴀɪʟᴇᴅ");

        const filename = sanitizeFilename(result.title, '.mp3');

        await conn.sendMessage(from, {
            document: { url: result.download },
            mimetype: 'audio/mpeg',
            fileName: filename
        }, { quoted: anony });

        await conn.sendMessage(from, { react: { text: '✅', key: m.key } });

    } catch (e) {
        console.error(e);
        await conn.sendMessage(from, { react: { text: '❌', key: m.key } });
        reply("ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ᴅᴏᴡɴʟᴏᴀᴅɪɴɢ ᴀᴜᴅɪᴏ");
    }
});

// --- PLAY2 Command (Returns as Document) ---
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
        if (!q) return reply("ᴘʟᴇᴀsᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ sᴏɴɢ ɴᴀᴍᴇ\nᴇxᴀᴍᴘʟᴇ: .ᴘʟᴀʏ2 ᴛᴜᴍ ʜɪ ʜᴏ");

        let ytUrl = q;
        if (!isYoutubeUrl(q)) {
            const searchResults = await yts(q);
            if (!searchResults.videos || !searchResults.videos.length) {
                return reply("❌ ɴᴏ ʀᴇsᴜʟᴛs ꜰᴏᴜɴᴅ. ᴛʀʏ ᴀ ᴅɪꜰꜰᴇʀᴇɴᴛ sᴇᴀʀᴄʜ ᴛᴇʀᴍ.");
            }
            ytUrl = searchResults.videos[0].url;
        }

        const result = await fetchYtApi('mp3', ytUrl);
        if (!result) return reply("❌ ꜰᴀɪʟᴇᴅ ᴛᴏ ꜰᴇᴛᴄʜ ᴀᴜᴅɪᴏ. ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ.");

        if (result.cover) {
            await conn.sendMessage(from, {
                image: { url: result.cover },
                caption: `*ʏᴛ ᴀᴜᴅɪᴏ ᴅᴏᴡɴʟᴏᴀᴅᴇʀ*\n╭━━❐━⪼\n┇๏ *ᴛɪᴛʟᴇ*    –  ${result.title}\n┇๏ *ǫᴜᴀʟɪᴛʏ*   –  ${result.quality || 'ᴜɴᴋɴᴏᴡɴ'}\n╰━━❑━⪼\n> *ᴅᴏᴡɴʟᴏᴀᴅɪɴɢ ᴀᴜᴅɪᴏ ꜰɪʟᴇ ♡*`
            }, { quoted: anony });
        }

        // Fetch the audio buffer to send as a document
        const audioRes = await fetch(result.download);
        const arrayBuffer = await audioRes.arrayBuffer();
        const audioBuffer = Buffer.from(arrayBuffer);

        await conn.sendMessage(from, {
            document: audioBuffer, // Changed to document
            mimetype: 'audio/mpeg',
            fileName: sanitizeFilename(result.title, '.mp3')
        }, { quoted: anony });

        await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });

    } catch (error) {
        console.error('Play2 command error:', error);
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
        reply("⚠️ ᴀɴ ᴜɴᴇxᴘᴇᴄᴛᴇᴅ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ. ᴘʟᴇᴀsᴇ ᴛʀʏ ᴀɢᴀɪɴ.");
    }
});