const axios = require('axios');
const { cmd } = require('../command');
const { anony } = require('../lib/ridzcoder');

// ─────────────────────────────────────────────
// SHARED HELPER: Fetch reaction image/GIF
// ─────────────────────────────────────────────
async function sendReaction(conn, mek, m, { from, reply }, action, emoji = '💫') {
    try {
        await conn.sendMessage(from, { react: { text: emoji, key: mek.key } });

        // Try multiple endpoints in case one is down
        const endpoints = [
            `https://api.waifu.pics/sfw/${action}`,
            `https://api.otakugifs.xyz/gif?reaction=${action}&format=gif`,
            `https://nekos.best/api/v2/${action}`
        ];

        let imageUrl = null;
        let source = null;
        let caption = null;

        for (const url of endpoints) {
            try {
                const res = await axios.get(url, { timeout: 8000 });
                const data = res.data;
                
                // Parse common response structures
                if (data.url) { imageUrl = data.url; source = 'waifu.pics'; }
                else if (data.data?.url) { imageUrl = data.data.url; source = 'otakugifs'; }
                else if (data.results && data.results[0]?.url) { imageUrl = data.results[0].url; source = 'nekos.best'; }
                else if (data.result?.url) { imageUrl = data.result.url; source = 'nekos.best'; }
                else if (data.gifs && data.gifs[0]?.url) { imageUrl = data.gifs[0].url; source = 'giphy'; }

                if (imageUrl) break;
            } catch (err) {
                console.log(`[ʀᴇᴀᴄᴛɪᴏɴ ᴀᴘɪ ꜰᴀɪʟᴇᴅ] ${url}: ${err.message}`);
            }
        }

        if (!imageUrl) {
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
            return reply(`❌ ᴄᴏᴜʟᴅ ɴᴏᴛ ꜰᴇᴛᴄʜ *${action.toUpperCase()}* ʀᴇᴀᴄᴛɪᴏɴ ɪᴍᴀɢᴇ.`);
        }

        // Build caption with user mentions
        const mentioned = m.mentionedJid?.[0] || (m.quoted?.sender) || null;
        const senderName = `@${mek.sender.split('@')[0]}`;
        const targetName = mentioned ? `@${mentioned.split('@')[0]}` : null;

        const captionMap = {
            kiss: `💋 ${senderName} ${targetName ? 'ᴋɪssᴇs ' + targetName : 'ɪs sᴇɴᴅɪɴɢ ᴀ ᴋɪss'}`,
            cium: `💋 ${senderName} ${targetName ? 'ᴋɪssᴇs ' + targetName : 'ɪs sᴇɴᴅɪɴɢ ᴀ ᴋɪss'}`,
            beso: `💋 ${senderName} ${targetName ? 'ᴋɪssᴇs ' + targetName : 'ɪs sᴇɴᴅɪɴɢ ᴀ ᴋɪss'}`,
            hug: `🤗 ${senderName} ${targetName ? 'ʜᴜɢs ' + targetName : 'ɪs sᴇɴᴅɪɴɢ ᴀ ʜᴜɢ'}`,
            slap: `👋 ${senderName} ${targetName ? 'sʟᴀᴘs ' + targetName : 'ɪs sʟᴀᴘᴘɪɴɢ'}`,
            pat: `🫳 ${senderName} ${targetName ? 'ᴘᴀᴛs ' + targetName : 'ɪs ᴘᴀᴛᴛɪɴɢ'}`,
            kill: `🔪 ${senderName} ${targetName ? 'ᴋɪʟʟs ' + targetName : 'ɪs ᴋɪʟʟɪɴɢ'}`,
            bonk: `🔨 ${senderName} ${targetName ? 'ʙᴏɴᴋs ' + targetName : 'ɪs ʙᴏɴᴋɪɴɢ'}`,
            cuddle: `🫂 ${senderName} ${targetName ? 'ᴄᴜᴅᴅʟᴇs ' + targetName : 'ɪs ᴄᴜᴅᴅʟɪɴɢ'}`,
            lick: `👅 ${senderName} ${targetName ? 'ʟɪᴄᴋs ' + targetName : 'ɪs ʟɪᴄᴋɪɴɢ'}`,
            bite: `🦷 ${senderName} ${targetName ? 'ʙɪᴛᴇs ' + targetName : 'ɪs ʙɪᴛɪɴɢ'}`,
            poke: `👉 ${senderName} ${targetName ? 'ᴘᴏᴋᴇs ' + targetName : 'ɪs ᴘᴏᴋɪɴɢ'}`,
            tickle: `🤣 ${senderName} ${targetName ? 'ᴛɪᴄᴋʟᴇs ' + targetName : 'ɪs ᴛɪᴄᴋʟɪɴɢ'}`,
            wave: `👋 ${senderName} ᴡᴀᴠᴇs ${targetName || ''}`,
            smile: `😊 ${senderName} ɪs sᴍɪʟɪɴɢ`,
            cry: `😢 ${senderName} ɪs ᴄʀʏɪɴɢ`,
            blush: `😳 ${senderName} ɪs ʙʟᴜsʜɪɴɢ`,
            dance: `💃 ${senderName} ɪs ᴅᴀɴᴄɪɴɢ`,
            happy: `😄 ${senderName} ɪs ʜᴀᴘᴘʏ`,
            bully: `😠 ${senderName} ${targetName ? 'ʙᴜʟʟɪᴇs ' + targetName : 'ɪs ʙᴜʟʟʏɪɴɢ'}`,
            kick3: `🦵 ${senderName} ${targetName ? 'ᴋɪᴄᴋs ' + targetName : 'ɪs ᴋɪᴄᴋɪɴɢ'}`,
            highfive: `🙌 ${senderName} ɢɪᴠᴇs ${targetName || 'ᴀ ʜɪɢʜ ꜰɪᴠᴇ ᴛᴏ ʏᴏᴜ'}`,
            glomp: `🫂 ${senderName} ɢʟᴏᴍᴘs ${targetName || 'sᴏᴍᴇᴏɴᴇ'}`,
            yeet: `🚀 ${senderName} ʏᴇᴇᴛs ${targetName || 'sᴏᴍᴇᴛʜɪɴɢ'}`,
            smug: `😏 ${senderName} ɪs sᴍᴜɢ`,
            nom: `🍽️ ${senderName} ɪs ɴᴏᴍᴍɪɴɢ`,
            sleepy: `😴 ${senderName} ɪs sʟᴇᴇᴘʏ`,
            facepalm: `🤦 ${senderName} ꜰᴀᴄᴇᴘᴀʟᴍs`,
            wink: `😉 ${senderName} ɪs ᴡɪɴᴋɪɴɢ`,
            shy: `😊 ${senderName} ɪs sʜʏ`,
            stare: `👀 ${senderName} ɪs sᴛᴀʀɪɴɢ`,
            thinking: `🤔 ${senderName} ɪs ᴛʜɪɴᴋɪɴɢ`,
            shoot: `🔫 ${senderName} ɪs sʜᴏᴏᴛɪɴɢ`,
            run: `🏃 ${senderName} ɪs ʀᴜɴɴɪɴɢ`,
            shrug: `🤷 ${senderName} sʜʀᴜɢs`,
            panic: `😱 ${senderName} ɪs ᴘᴀɴɪᴄᴋɪɴɢ`,
            tease: `😜 ${senderName} ɪs ᴛᴇᴀsɪɴɢ`,
            shiver: `🥶 ${senderName} ɪs sʜɪᴠᴇʀɪɴɢ`,
            bored: `😐 ${senderName} ɪs ʙᴏʀᴇᴅ`,
            scream: `😱 ${senderName} ɪs sᴄʀᴇᴀᴍɪɴɢ`,
            pout: `😤 ${senderName} ɪs ᴘᴏᴜᴛɪɴɢ`,
            handhold: `🤝 ${senderName} ʜᴏʟᴅs ʜᴀɴᴅs ${targetName || ''}`,
            spank: `🍑 ${senderName} sᴘᴀɴᴋs ${targetName || 'sᴏᴍᴇᴏɴᴇ'}`,
            cringe: `😬 ${senderName} ɪs ᴄʀɪɴɢɪɴɢ`,
            party: `🎉 ${senderName} ɪs ᴘᴀʀᴛʏɪɴɢ`,
            celebrate: `🎊 ${senderName} ɪs ᴄᴇʟᴇʙʀᴀᴛɪɴɢ`
        };

        caption = captionMap[action] || `${senderName} sᴇɴᴛ ᴀ ${action} ʀᴇᴀᴄᴛɪᴏɴ!`;

        const mentions = mentioned ? [mek.sender, mentioned] : [mek.sender];

        await conn.sendMessage(from, {
            video: { url: imageUrl },
            gifPlayback: true,
            caption,
            mentions
        }, { quoted: anony });

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });

    } catch (error) {
        console.error('[ʀᴇᴀᴄᴛɪᴏɴ ᴇʀʀᴏʀ]', error);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
        reply(`❌ ᴇʀʀᴏʀ: ${error.message}`);
    }
}

// ─────────────────────────────────────────────
// AUTO-GENERATE ALL REACTION COMMANDS
// ─────────────────────────────────────────────
const reactions = [
    // Kiss variants
    { pattern: 'kiss', aliases: ['cium', 'beso'], emoji: '💋' },
    // Hug
    { pattern: 'hug', aliases: ['hugs'], emoji: '🤗' },
    // Slap
    { pattern: 'slap', aliases: ['slapping'], emoji: '👋' },
    // Pat
    { pattern: 'pat', aliases: ['headpat', 'pet'], emoji: '🫳' },
    // Poke
    { pattern: 'poke', aliases: ['pokes'], emoji: '👉' },
    // Smile
    { pattern: 'smile', aliases: ['smiling'], emoji: '😊' },
    // Wave
    { pattern: 'wave', aliases: ['waving', 'bye'], emoji: '👋' },
    // Cuddle
    { pattern: 'cuddle', aliases: ['snuggle'], emoji: '🫂' },
    // Highfive
    { pattern: 'highfive', aliases: ['high-five', 'hi5'], emoji: '🙌' },
    // Lick
    { pattern: 'lick', aliases: ['licking'], emoji: '👅' },
    // Bite
    { pattern: 'bite', aliases: ['biting'], emoji: '🦷' },
    // Glomp
    { pattern: 'glomp', aliases: ['tacklehug'], emoji: '🫂' },
    // Bonk
    { pattern: 'bonk', aliases: ['hit'], emoji: '🔨' },
    // Yeet
    { pattern: 'yeet', aliases: ['throw'], emoji: '🚀' },
    // Smug
    { pattern: 'smug', aliases: ['smirking'], emoji: '😏' },
    // Nom
    { pattern: 'nom', aliases: ['eat'], emoji: '🍽️' },
    // Sleepy
    { pattern: 'sleepy', aliases: ['sleep'], emoji: '😴' },
    // Facepalm
    { pattern: 'facepalm', aliases: ['palm'], emoji: '🤦' },
    // Wink
    { pattern: 'wink', aliases: ['winking'], emoji: '😉' },
    // Shy
    { pattern: 'shy', aliases: ['shyness'], emoji: '😊' },
    // Stare
    { pattern: 'stare', aliases: ['staring'], emoji: '👀' },
    // Thinking
    { pattern: 'thinking', aliases: ['think'], emoji: '🤔' },
    // Shoot
    { pattern: 'shoot', aliases: ['gun'], emoji: '🔫' },
    // Run
    { pattern: 'run', aliases: ['running'], emoji: '🏃' },
    // Shrug
    { pattern: 'shrug', aliases: ['idk'], emoji: '🤷' },
    // Panic
    { pattern: 'panic', aliases: ['panicking'], emoji: '😱' },
    // Tease
    { pattern: 'tease', aliases: ['teasing'], emoji: '😜' },
    // Shiver
    { pattern: 'shiver', aliases: ['cold'], emoji: '🥶' },
    // Bored
    { pattern: 'bored', aliases: ['boring'], emoji: '😐' },
    // Scream
    { pattern: 'scream', aliases: ['yell'], emoji: '😱' },
    // Pout
    { pattern: 'pout', aliases: ['sulking'], emoji: '😤' },
    // Handhold
    { pattern: 'handhold', aliases: ['holdinghands'], emoji: '🤝' },
    // Spank
    { pattern: 'spank', aliases: ['spanking'], emoji: '🍑' },
    // Tickle
    { pattern: 'tickle', aliases: ['tickling'], emoji: '🤣' },
    // Cringe
    { pattern: 'cringe', aliases: ['cringing'], emoji: '😬' },
    // Party
    { pattern: 'party', aliases: ['partying'], emoji: '🎉' },
    // Celebrate
    { pattern: 'celebrate', aliases: ['celebration'], emoji: '🎊' },
    // Cry
    { pattern: 'cry', aliases: ['crying'], emoji: '😢' },
    // Blush
    { pattern: 'blush', aliases: ['blushing'], emoji: '😳' },
    // Dance
    { pattern: 'dance', aliases: ['dancing'], emoji: '💃' },
    // Kill
    { pattern: 'kill', aliases: ['murder'], emoji: '🔪' },
    // Kick
    { pattern: 'kick3', aliases: ['kickreact'], emoji: '🦵' },
    // Happy
    { pattern: 'happy', aliases: ['joyful'], emoji: '😄' },
    // Bully
    { pattern: 'bully', aliases: ['bullying'], emoji: '😠' }
];

// Register each reaction as a standalone command
reactions.forEach(({ pattern, aliases, emoji }) => {
    cmd({
        pattern,
        alias: aliases,
        react: emoji,
        desc: `Send a ${pattern} reaction gif`,
        category: "reactions",
        use: `.${pattern} [@user]`,
        filename: __filename
    }, async (conn, mek, m, ctx) => {
        await sendReaction(conn, mek, m, ctx, pattern, emoji);
    });
});

// ─────────────────────────────────────────────
// AI IMAGE GENERATOR
// ─────────────────────────────────────────────
cmd({
    pattern: "generate",
    alias: ["imagine", "aiimage"],
    react: "🎨",
    desc: "Generate an AI image from a prompt",
    category: "ai",
    use: ".generate <prompt>",
    filename: __filename
}, async (conn, mek, m, { from, reply, q }) => {
    if (!q) return reply("❌ ᴘʟᴇᴀsᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ᴘʀᴏᴍᴘᴛ.\nᴇxᴀᴍᴘʟᴇ: .ɢᴇɴᴇʀᴀᴛᴇ ᴀ ᴄᴀᴛ ʀɪᴅɪɴɢ ᴀ ʙɪᴄʏᴄʟᴇ");

    try {
        await conn.sendMessage(from, { react: { text: '🎨', key: mek.key } });
        const apiUrl = `https://api.gurusensei.workers.dev/dream?prompt=${encodeURIComponent(q)}`;
        await conn.sendMessage(from, {
            image: { url: apiUrl },
            caption: `🎨 *ᴀɪ ɢᴇɴᴇʀᴀᴛᴇᴅ ɪᴍᴀɢᴇ*\n\n📝 ᴘʀᴏᴍᴘᴛ: ${q}`
        }, { quoted: anony });
        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
    } catch (error) {
        console.error('[ɢᴇɴᴇʀᴀᴛᴇ ᴇʀʀᴏʀ]', error);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
        reply('❌ ꜰᴀɪʟᴇᴅ ᴛᴏ ɢᴇɴᴇʀᴀᴛᴇ ɪᴍᴀɢᴇ.');
    }
});