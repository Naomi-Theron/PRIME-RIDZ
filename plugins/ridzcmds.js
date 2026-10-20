const { cmd, commands } = require('../command');
const axios = require("axios");
const config = require('../config');
const { anony } = require('../lib/ridzcoder');
const l = console.log;
const ytdl = require('yt-search');
const yts = require('yt-search');
const fs = require('fs');
const path = require('path');
const os = require('os');
const FormData = require('form-data');
const { getBuffer, getGroupAdmins, getRandom, h2k, isUrl, Json, runtime, sleep, fetchJson } = require('../lib/functions');
const { setConfig, getConfig } = require("../lib/configdb");
const prefix = config.PREFIX;

const OWNER_PATH = path.join(__dirname, "../assets/sudo.json");

// Ensure the sudo.json file exists
const ensureOwnerFile = () => {
  if (!fs.existsSync(OWNER_PATH)) {
    fs.writeFileSync(OWNER_PATH, JSON.stringify([]));
  }
};

function formatBytes(bytes) {
  if (bytes === 0) return '0 ʙʏᴛᴇs';
  const k = 1024;
  const sizes = ['ʙʏᴛᴇs', 'ᴋʙ', 'ᴍʙ', 'ɢʙ'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}


// ──────────────────────────────────────────────────────────────
// CONFIG
// ──────────────────────────────────────────────────────────────
const CATBOX_USERHASH = 'c8f243c132e5d3e01b89bf27a';

// ──────────────────────────────────────────────────────────────
// Uploaders
// ──────────────────────────────────────────────────────────────

// 1. Catbox (with userhash)
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
        throw new Error(`Catbox blocked (${res.status})`);
    }
    return body;
}

// 2. Tmpfiles.org (Very reliable, 1 hour expiry)
async function uploadToTmpfiles(buffer, filename) {
    const form = new FormData();
    form.append('file', buffer, { filename });

    const res = await axios.post('https://tmpfiles.org/api/v1/upload', form, {
        headers: form.getHeaders(),
        timeout: 20000
    });

    if (res.data && res.data.status === 'success' && res.data.data?.url) {
        return res.data.data.url.replace('https://tmpfiles.org/', 'https://tmpfiles.org/dl/');
    }
    throw new Error('Tmpfiles upload failed');
}

// 3. Uguu.se (Good for temporary images, 3 hour expiry)
async function uploadToUguu(buffer, filename) {
    const form = new FormData();
    form.append('files[]', buffer, { filename });

    const res = await axios.post('https://uguu.se/upload.php', form, {
        headers: form.getHeaders(),
        timeout: 20000
    });

    if (res.data && res.data.success && res.data.files && res.data.files[0]?.url) {
        return res.data.files[0].url;
    }
    throw new Error('Uguu upload failed');
}

// ──────────────────────────────────────────────────────────────
// Auto-Fallback Logic
// ──────────────────────────────────────────────────────────────
async function uploadImage(buffer, filename) {
    try {
        return await uploadToCatbox(buffer, filename);
    } catch (e1) {
        console.warn(`[uploader] Catbox failed (${e1.message}). Trying Tmpfiles...`);
        try {
            return await uploadToTmpfiles(buffer, filename);
        } catch (e2) {
            console.warn(`[uploader] Tmpfiles failed (${e2.message}). Trying Uguu...`);
            return await uploadToUguu(buffer, filename);
        }
    }
}

// ──────────────────────────────────────────────────────────────
// Shared Pipeline
// ──────────────────────────────────────────────────────────────
async function runImageEdit(ctx, message, apiUrl, caption) {
    const { from, reply, conn } = ctx;

    const quoted = message.quoted ? message.quoted : message;
    const mime = (quoted.msg || quoted).mimetype || '';

    if (!mime || !mime.startsWith('image/')) {
        return reply('ᴘʟᴇᴀsᴇ ʀᴇᴘʟʏ ᴛᴏ ᴀɴ ɪᴍᴀɢᴇ ꜰɪʟᴇ (ᴊᴘᴇɢ/ᴘɴɢ)');
    }

    let ext = '';
    if (mime.includes('image/jpeg')) ext = '.jpg';
    else if (mime.includes('image/png')) ext = '.png';
    else return reply('ᴜɴsᴜᴘᴘᴏʀᴛᴇᴅ ɪᴍᴀɢᴇ ꜰᴏʀᴍᴀᴛ. ᴘʟᴇᴀsᴇ ᴜsᴇ ᴊᴘᴇɢ ᴏʀ ᴘɴɢ');

    try {
        const buffer = await quoted.download();
        const filename = `img_${Date.now()}${ext}`;

        // 1) Upload source
        const uploadedUrl = await uploadImage(buffer, filename);

        // 2) Call the edit API
        const finalUrl = apiUrl.replace('{url}', encodeURIComponent(uploadedUrl));
        
        const res = await axios.get(finalUrl, {
            responseType: 'arraybuffer',
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'image/*'
            },
            validateStatus: () => true
        });

        // Log exact API error if it fails
        if (res.status !== 200 || !res.data || res.data.length < 100) {
            // If the API returned JSON text instead of an image, read it for the log
            let errTxt = '';
            if (res.headers['content-type']?.includes('json') || res.headers['content-type']?.includes('text')) {
                errTxt = Buffer.from(res.data).toString();
            }
            throw new Error(`API rejected (${res.status}) ${errTxt}`);
        }

        const outBuffer = Buffer.from(res.data, 'binary');

        // 3) Send result
        await conn.sendMessage(from, {
            image: outBuffer,
            caption: caption || `> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴘʀɪᴍᴇ ʀɪᴅᴢ*`
        }, { quoted: anony });
        
    } catch (err) {
        console.error('[image-edit] error:', err.message);
        reply(`ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ: ${err.message || 'ᴜɴᴋɴᴏᴡɴ ᴇʀʀᴏʀ'}`);
    }
}

// ──────────────────────────────────────────────────────────────
// Commands Registration
// ──────────────────────────────────────────────────────────────
const IMAGE_EDIT_COMMANDS = [
    { pattern: 'ad',        alias: ['adedit'],      api: 'https://api.popcat.xyz/v2/ad?image={url}',             desc: 'Add AD watermark' },
    { pattern: 'blur',      alias: ['bluredit'],    api: 'https://api.popcat.xyz/v2/blur?image={url}',           desc: 'Blur the image' },
    { pattern: 'grey',      alias: ['greyedit'],    api: 'https://api.popcat.xyz/v2/greyscale?image={url}',      desc: 'Convert to greyscale' },
    { pattern: 'invert',    alias: ['invertedit'],  api: 'https://api.popcat.xyz/v2/invert?image={url}',         desc: 'Invert colors' },
    { pattern: 'imgjoke',   alias: ['jokedit'],     api: 'https://api.popcat.xyz/v2/jokeoverhead?image={url}',   desc: 'Joke overlay' },
    { pattern: 'jail',      alias: ['jailedit'],    api: 'https://api.popcat.xyz/v2/jail?image={url}',           desc: 'Jail bars overlay' },
    { pattern: 'nokia',     alias: ['nokiaedit'],   api: 'https://api.popcat.xyz/v2/nokia?image={url}',          desc: 'Nokia-style filter' },
    { pattern: 'wanted',    alias: ['wantededit'],  api: 'https://api.popcat.xyz/v2/wanted?image={url}',         desc: 'Wanted poster' },
    {
        pattern: 'removebg',
        alias: ['rmbg'],
        api: 'https://apis.davidcyriltech.my.id/removebg?url={url}',
        desc: 'Remove background',
        caption: `ʙᴀᴄᴋɢʀᴏᴜɴᴅ ʀᴇᴍᴏᴠᴇᴅ\n\n> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴘʀɪᴍᴇ ʀɪᴅᴢ*`
    }
];

for (const c of IMAGE_EDIT_COMMANDS) {
    cmd({
        pattern: c.pattern,
        alias: c.alias,
        react: '📸',
        desc: c.desc,
        category: 'img_edit',
        use: `.${c.pattern} [reply to image]`,
        filename: __filename
    }, async (conn, message, m, ctx) => {
        ctx.conn = conn;
        await runImageEdit(ctx, message, c.api, c.caption);
    });
}

cmd({
  pattern: "compatibility",
  alias: ["friend", "fcheck"],
  desc: "Calculate the compatibility score between two users.",
  category: "fun",
  react: "💖",
  filename: __filename,
  use: "@tag1 @tag2",
}, async (conn, mek, m, { args, reply }) => {
  try {
    if (args.length < 2) {
      return reply("ᴘʟᴇᴀsᴇ ᴍᴇɴᴛɪᴏɴ ᴛᴡᴏ ᴜsᴇʀs ᴛᴏ ᴄᴀʟᴄᴜʟᴀᴛᴇ ᴄᴏᴍᴘᴀᴛɪʙɪʟɪᴛʏ.\nᴜsᴀɢᴇ: `.ᴄᴏᴍᴘᴀᴛɪʙɪʟɪᴛʏ @ᴜsᴇʀ1 @ᴜsᴇʀ2`");
    }

    let user1 = m.mentionedJid[0]; 
    let user2 = m.mentionedJid[1]; 

    const specialNumber = config.DEV ? `${config.DEV}@s.whatsapp.net` : null;

    let compatibilityScore = Math.floor(Math.random() * 1000) + 1;

    if (user1 === specialNumber || user2 === specialNumber) {
      compatibilityScore = 1000;
      return reply(`💖 ᴄᴏᴍᴘᴀᴛɪʙɪʟɪᴛʏ ʙᴇᴛᴡᴇᴇɴ @${user1.split('@')[0]} ᴀɴᴅ @${user2.split('@')[0]}: ${compatibilityScore}+/1000 💖`);
    }

    await conn.sendMessage(mek.chat, {
      text: `💖 ᴄᴏᴍᴘᴀᴛɪʙɪʟɪᴛʏ ʙᴇᴛᴡᴇᴇɴ @${user1.split('@')[0]} ᴀɴᴅ @${user2.split('@')[0]}: ${compatibilityScore}/1000 💖`,
      mentions: [user1, user2],
    }, { quoted: mek });

  } catch (error) {
    console.log(error);
    reply(`❌ ᴇʀʀᴏʀ: ${error.message}`);
  }
});

cmd({
  pattern: "aura",
  desc: "Calculate aura score of a user.",
  category: "fun",
  react: "💀",
  filename: __filename,
  use: "@tag",
}, async (conn, mek, m, { args, reply }) => {
  try {
    if (args.length < 1) {
      return reply("ᴘʟᴇᴀsᴇ ᴍᴇɴᴛɪᴏɴ ᴀ ᴜsᴇʀ ᴛᴏ ᴄᴀʟᴄᴜʟᴀᴛᴇ ᴛʜᴇɪʀ ᴀᴜʀᴀ.\nᴜsᴀɢᴇ: `.ᴀᴜʀᴀ @ᴜsᴇʀ`");
    }

    let user = m.mentionedJid[0]; 
    const specialNumber = config.DEV ? `${config.DEV}@s.whatsapp.net` : null;

    let auraScore = Math.floor(Math.random() * 1000) + 1;

    if (user === specialNumber) {
      auraScore = 999999;
      return reply(`💀 ᴀᴜʀᴀ ᴏꜰ @${user.split('@')[0]}: ${auraScore}+ 🗿`);
    }

    await conn.sendMessage(mek.chat, {
      text: `💀 ᴀᴜʀᴀ ᴏꜰ @${user.split('@')[0]}: ${auraScore}/1000 🗿`,
      mentions: [user],
    }, { quoted: mek });

  } catch (error) {
    console.log(error);
    reply(`❌ ᴇʀʀᴏʀ: ${error.message}`);
  }
});

cmd({
    pattern: "roast",
    desc: "Roast someone in English",
    category: "fun",
    react: "🔥",
    filename: __filename,
    use: "@tag"
}, async (conn, mek, m, { q, reply }) => {
    let roasts = [
        "Bro, your IQ is lower than a Wi-Fi signal in the basement!",
        "Bro, your thoughts are like a WhatsApp status, gone after 24 hours!",
        "How much do you think you know? Are you a NASA scientist or something?",
        "Who are you? I can't even find your name on Google!",
        "Is your brain running on a 2G network?",
        "Don't overthink bro, your battery will drain fast!",
        "Your thoughts are like a cricket match, stops as soon as it rains!",
        "You are a VIP, a 'Very Idiotic Person'!",
        "Which planet did you come from? This world isn't for aliens like you!",
        "There's so much to explore in your head, but no results found!",
        "Your life is like a WhatsApp status, can be deleted anytime!",
        "Your style is like a Wi-Fi password, nobody knows it!",
        "You are the one who Googles the plot twist of your own life!",
        "You're like a failed software update, completely hung!",
        "More time is wasted thinking about you than Googling useless things!",
        "I have no shortage of words, I just didn't feel like roasting you!",
        "Your personality is like a dead battery, time to recharge!",
        "Bro, you need a dedicated server just for your thoughts!",
        "What game are you playing where you fail every time?",
        "Your jokes are like software updates, install repeatedly but don't work!",
        "Because of you, even my phone's storage gets full!",
        "Bro, you've become a walking meme!",
        "You think you're smart, but your brain cells are overloaded!",
        "Because of you, we have to consider muting our group chat!",
        "People like you always think you're the hero, but you're actually the villain!",
        "People like you need a rewind and fast-forward button in life!",
        "Every word from your mouth is a new bug!",
        "You couldn't even save your own life, and you're giving advice to others!",
        "You are the biggest virus in your own life!",
        "Are you a person or a broken app?",
        "Your thoughts need a CPU, but it seems your CPU is dead!",
        "What are you doing, you've become a walking error message!",
        "Your praise is just for show, but everyone knows your real worth!",
        "Your brain is like a broken link, nothing found despite searching everything!",
        "Bro, seeing you makes me feel like even Netflix crashed because of you!",
        "Your picture looks like just a screenshot, you're nothing in real life!",
        "Bro, you look like an iPhone, but inside you're a very old Android!",
        "Even Google must hate thoughts like yours!",
        "Bro, make a great mood with your face, maybe someone will notice!",
        "Your work is like that app that crashes when everyone needs it!",
        "The biggest hack of your life is - 'Don't expect anything from me'!",
        "You look in the mirror and think everything is fine!",
        "You run your brain in low power mode!",
        "You have ideas, but they're all outdated like Windows XP!",
        "Your thoughts are like a system error, needs a restart!",
        "Your personality is like an empty hard drive, nothing valuable!",
        "Which planet did you come from, this world isn't for people like you!",
        "Someone wrote 'loading' on your face, but it never completes!",
        "Your brain is like a broken link, never connects!",
        "Bro, even Google's algorithm gets confused by your thoughts!",
        "A guy like you, and ideas like that? We only saw that in science fiction!",
        "Go write 'not found' on your face, because nobody finds anything!",
        "Your thoughts are so slow, even Google can't help you!",
        "Bro, you're a living example of '404 not found'!",
        "Your brain is like a phone battery, drains anytime!",
        "Bro, you're the one who forgets their own life password!",
        "What you think is your mind, is actually 'buffering'!",
        "Your life decisions are so confusing, even KBC hosts would give up!",
        "Bro, there should be a dedicated 'error' page for people like you!",
        "Your life got a 'user not found' message!",
        "Your words hold as much value as camera quality on 90s mobile phones!",
        "Bro, you're always 'under construction'!",
        "Life with you is an 'unknown error', no solution found!",
        "Bro, there should be a warning sign on your face - 'Caution: Too much stupidity ahead'!",
        "With every word you say, it feels like the system is about to crash!",
        "You have an idea, but it's still 'under review'!"
    ];

    let randomRoast = roasts[Math.floor(Math.random() * roasts.length)];
    let sender = `@${mek.sender.split("@")[0]}`;
    let mentionedUser = m.mentionedJid[0] || (mek.quoted && mek.quoted.sender);

    if (!mentionedUser) {
        return reply("ᴜsᴀɢᴇ: .ʀᴏᴀsᴛ @ᴜsᴇʀ (ᴛᴀɢ sᴏᴍᴇᴏɴᴇ ᴛᴏ ʀᴏᴀsᴛ ᴛʜᴇᴍ!)");
    }

    let target = `@${mentionedUser.split("@")[0]}`;

    let message = `${target} :\n *${randomRoast}*\n> ᴛʜɪs ɪs ᴀʟʟ ꜰᴏʀ ꜰᴜɴ, ᴅᴏɴ'ᴛ ᴛᴀᴋᴇ ɪᴛ sᴇʀɪᴏᴜsʟʏ!`;
    await conn.sendMessage(mek.chat, { text: message, mentions: [mek.sender, mentionedUser] }, { quoted: mek });
});

cmd({
    pattern: "8ball",
    desc: "Magic 8-Ball gives answers",
    category: "fun",
    react: "🎱",
    filename: __filename
}, 
async (conn, mek, m, { from, q, reply }) => {
    if (!q) return reply("ᴀsᴋ ᴀ ʏᴇs/ɴᴏ ǫᴜᴇsᴛɪᴏɴ! ᴇxᴀᴍᴘʟᴇ: .8ʙᴀʟʟ ᴡɪʟʟ ɪ ʙᴇ ʀɪᴄʜ?");

    let responses = [
        "ʏᴇs!", "ɴᴏ.", "ᴍᴀʏʙᴇ...", "ᴅᴇꜰɪɴɪᴛᴇʟʏ!", "ɴᴏᴛ sᴜʀᴇ.", 
        "ᴀsᴋ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ.", "ɪ ᴅᴏɴ'ᴛ ᴛʜɪɴᴋ sᴏ.", "ᴀʙsᴏʟᴜᴛᴇʟʏ!", 
        "ɴᴏ ᴡᴀʏ!", "ʟᴏᴏᴋs ᴘʀᴏᴍɪsɪɴɢ!"
    ];

    let answer = responses[Math.floor(Math.random() * responses.length)];

    reply(`🎱 *ᴍᴀɢɪᴄ 8-ʙᴀʟʟ sᴀʏs:* ${answer}`);
});

cmd({
    pattern: "compliment",
    desc: "Give a nice compliment",
    category: "fun",
    react: "😊",
    filename: __filename,
    use: "@tag (optional)"
}, async (conn, mek, m, { reply }) => {
    let compliments = [
        "ʏᴏᴜ'ʀᴇ ᴀᴍᴀᴢɪɴɢ ᴊᴜsᴛ ᴛʜᴇ ᴡᴀʏ ʏᴏᴜ ᴀʀᴇ! 💖",
        "ʏᴏᴜ ʟɪɢʜᴛ ᴜᴘ ᴇᴠᴇʀʏ ʀᴏᴏᴍ ʏᴏᴜ ᴡᴀʟᴋ ɪɴᴛᴏ! 🌟",
        "ʏᴏᴜʀ sᴍɪʟᴇ ɪs ᴄᴏɴᴛᴀɢɪᴏᴜs! 😊",
        "ʏᴏᴜ'ʀᴇ ᴀ ɢᴇɴɪᴜs ɪɴ ʏᴏᴜʀ ᴏᴡɴ ᴡᴀʏ! 🧠",
        "ʏᴏᴜ ʙʀɪɴɢ ʜᴀᴘᴘɪɴᴇss ᴛᴏ ᴇᴠᴇʀʏᴏɴᴇ ᴀʀᴏᴜɴᴅ ʏᴏᴜ! 🥰",
        "ʏᴏᴜ'ʀᴇ ʟɪᴋᴇ ᴀ ʜᴜᴍᴀɴ sᴜɴsʜɪɴᴇ! ☀️",
        "ʏᴏᴜʀ ᴋɪɴᴅɴᴇss ᴍᴀᴋᴇs ᴛʜᴇ ᴡᴏʀʟᴅ ᴀ ʙᴇᴛᴛᴇʀ ᴘʟᴀᴄᴇ! ❤️",
        "ʏᴏᴜ'ʀᴇ ᴜɴɪǫᴜᴇ ᴀɴᴅ ɪʀʀᴇᴘʟᴀᴄᴇᴀʙʟᴇ! ✨",
        "ʏᴏᴜ'ʀᴇ ᴀ ɢʀᴇᴀᴛ ʟɪsᴛᴇɴᴇʀ ᴀɴᴅ ᴀ ᴡᴏɴᴅᴇʀꜰᴜʟ ꜰʀɪᴇɴᴅ! 🤗",
        "ʏᴏᴜʀ ᴘᴏsɪᴛɪᴠᴇ ᴠɪʙᴇs ᴀʀᴇ ᴛʀᴜʟʏ ɪɴsᴘɪʀɪɴɢ! 💫",
        "ʏᴏᴜ'ʀᴇ sᴛʀᴏɴɢᴇʀ ᴛʜᴀɴ ʏᴏᴜ ᴛʜɪɴᴋ! 💪",
        "ʏᴏᴜʀ ᴄʀᴇᴀᴛɪᴠɪᴛʏ ɪs ʙᴇʏᴏɴᴅ ᴀᴍᴀᴢɪɴɢ! 🎨",
        "ʏᴏᴜ ᴍᴀᴋᴇ ʟɪꜰᴇ ᴍᴏʀᴇ ꜰᴜɴ ᴀɴᴅ ɪɴᴛᴇʀᴇsᴛɪɴɢ! 🎉",
        "ʏᴏᴜʀ ᴇɴᴇʀɢʏ ɪs ᴜᴘʟɪꜰᴛɪɴɢ ᴛᴏ ᴇᴠᴇʀʏᴏɴᴇ ᴀʀᴏᴜɴᴅ ʏᴏᴜ! 🔥",
        "ʏᴏᴜ'ʀᴇ ᴀ ᴛʀᴜᴇ ʟᴇᴀᴅᴇʀ, ᴇᴠᴇɴ ɪꜰ ʏᴏᴜ ᴅᴏɴ’ᴛ ʀᴇᴀʟɪᴢᴇ ɪᴛ! 🏆",
        "ʏᴏᴜʀ ᴡᴏʀᴅs ʜᴀᴠᴇ ᴛʜᴇ ᴘᴏᴡᴇʀ ᴛᴏ ᴍᴀᴋᴇ ᴘᴇᴏᴘʟᴇ sᴍɪʟᴇ! 😊",
        "ʏᴏᴜ'ʀᴇ sᴏ ᴛᴀʟᴇɴᴛᴇᴅ, ᴀɴᴅ ᴛʜᴇ ᴡᴏʀʟᴅ ɴᴇᴇᴅs ʏᴏᴜʀ sᴋɪʟʟs! 🎭",
        "ʏᴏᴜ'ʀᴇ ᴀ ᴡᴀʟᴋɪɴɢ ᴍᴀsᴛᴇʀᴘɪᴇᴄᴇ ᴏꜰ ᴀᴡᴇsᴏᴍᴇɴᴇss! 🎨",
        "ʏᴏᴜ'ʀᴇ ᴘʀᴏᴏꜰ ᴛʜᴀᴛ ᴋɪɴᴅɴᴇss sᴛɪʟʟ ᴇxɪsᴛs ɪɴ ᴛʜᴇ ᴡᴏʀʟᴅ! 💕",
        "ʏᴏᴜ ᴍᴀᴋᴇ ᴇᴠᴇɴ ᴛʜᴇ ʜᴀʀᴅᴇsᴛ ᴅᴀʏs ꜰᴇᴇʟ ᴀ ʟɪᴛᴛʟᴇ ʙʀɪɢʜᴛᴇʀ! ☀️"
    ];

    let randomCompliment = compliments[Math.floor(Math.random() * compliments.length)];
    let sender = `@${mek.sender.split("@")[0]}`;
    let mentionedUser = m.mentionedJid[0] || (mek.quoted && mek.quoted.sender);
    let target = mentionedUser ? `@${mentionedUser.split("@")[0]}` : "";

    let message = mentionedUser 
        ? `${sender} ᴄᴏᴍᴘʟɪᴍᴇɴᴛᴇᴅ ${target}:\n😊 *${randomCompliment}*`
        : `${sender}, ʏᴏᴜ ꜰᴏʀɢᴏᴛ ᴛᴏ ᴛᴀɢ sᴏᴍᴇᴏɴᴇ! ʙᴜᴛ ʜᴇʏ, ʜᴇʀᴇ's ᴀ ᴄᴏᴍᴘʟɪᴍᴇɴᴛ ꜰᴏʀ ʏᴏᴜ:\n😊 *${randomCompliment}*`;

    await conn.sendMessage(mek.chat, { text: message, mentions: [mek.sender, mentionedUser].filter(Boolean) }, { quoted: mek });
});

cmd({
    pattern: "lovetest",
    desc: "Check love compatibility between two users",
    category: "fun",
    react: "❤️",
    filename: __filename,
    use: "@tag1 @tag2"
}, async (conn, mek, m, { args, reply }) => {
    if (args.length < 2) return reply("ᴛᴀɢ ᴛᴡᴏ ᴜsᴇʀs! ᴇxᴀᴍᴘʟᴇ: .ʟᴏᴠᴇᴛᴇsᴛ @ᴜsᴇʀ1 @ᴜsᴇʀ2");

    let user1 = args[0].replace("@", "") + "@s.whatsapp.net";
    let user2 = args[1].replace("@", "") + "@s.whatsapp.net";

    let lovePercent = Math.floor(Math.random() * 100) + 1;

    let messages = [
        { range: [90, 100], text: "💖 *ᴀ ᴍᴀᴛᴄʜ ᴍᴀᴅᴇ ɪɴ ʜᴇᴀᴠᴇɴ!* ᴛʀᴜᴇ ʟᴏᴠᴇ ᴇxɪsᴛs!" },
        { range: [75, 89], text: "😍 *sᴛʀᴏɴɢ ᴄᴏɴɴᴇᴄᴛɪᴏɴ!* ᴛʜɪs ʟᴏᴠᴇ ɪs ᴅᴇᴇᴘ ᴀɴᴅ ᴍᴇᴀɴɪɴɢꜰᴜʟ." },
        { range: [50, 74], text: "😊 *ɢᴏᴏᴅ ᴄᴏᴍᴘᴀᴛɪʙɪʟɪᴛʏ!* ʏᴏᴜ ʙᴏᴛʜ ᴄᴀɴ ᴍᴀᴋᴇ ɪᴛ ᴡᴏʀᴋ." },
        { range: [30, 49], text: "🤔 *ɪᴛ’s ᴄᴏᴍᴘʟɪᴄᴀᴛᴇᴅ!* ɴᴇᴇᴅs ᴇꜰꜰᴏʀᴛ, ʙᴜᴛ ᴘᴏssɪʙʟᴇ!" },
        { range: [10, 29], text: "😅 *ɴᴏᴛ ᴛʜᴇ ʙᴇsᴛ ᴍᴀᴛᴄʜ!* ᴍᴀʏʙᴇ ᴛʀʏ ʙᴇɪɴɢ ᴊᴜsᴛ ꜰʀɪᴇɴᴅs?" },
        { range: [1, 9], text: "💔 *ᴜʜ-ᴏʜ!* ᴛʜɪs ʟᴏᴠᴇ ɪs ᴀs ʀᴇᴀʟ ᴀs ᴀ ʙᴏʟʟʏᴡᴏᴏᴅ ʙʀᴇᴀᴋᴜᴘ!" }
    ];

    let loveMessage = messages.find(msg => lovePercent >= msg.range[0] && lovePercent <= msg.range[1]).text;

    let message = `💘 *ʟᴏᴠᴇ ᴄᴏᴍᴘᴀᴛɪʙɪʟɪᴛʏ ᴛᴇsᴛ* 💘\n\n❤️ *@${user1.split("@")[0]}* + *@${user2.split("@")[0]}* = *${lovePercent}%*\n${loveMessage}`;

    await conn.sendMessage(mek.chat, { text: message, mentions: [user1, user2] }, { quoted: mek });
}); 

cmd(
    {
        pattern: "emoji",
        desc: "Convert text into emoji form.",
        category: "fun",
        react: "🙂",
        filename: __filename,
        use: "<text>"
    },
    async (conn, mek, m, { args, q, reply }) => {
        try {
            let text = args.join(" ");

            let emojiMapping = {
                "a": "🅰️",
                "b": "🅱️",
                "c": "🇨️",
                "d": "🇩️",
                "e": "🇪️",
                "f": "🇫️",
                "g": "🇬️",
                "h": "🇭️",
                "i": "🇮️",
                "j": "🇯️",
                "k": "🇰️",
                "l": "🇱️",
                "m": "🇲️",
                "n": "🇳️",
                "o": "🅾️",
                "p": "🇵️",
                "q": "🇶️",
                "r": "🇷️",
                "s": "🇸️",
                "t": "🇹️",
                "u": "🇺️",
                "v": "🇻️",
                "w": "🇼️",
                "x": "🇽️",
                "y": "🇾️",
                "z": "🇿️",
                "0": "0️⃣",
                "1": "1️⃣",
                "2": "2️⃣",
                "3": "3️⃣",
                "4": "4️⃣",
                "5": "5️⃣",
                "6": "6️⃣",
                "7": "7️⃣",
                "8": "8️⃣",
                "9": "9️⃣",
                " ": "␣",
            };

            let emojiText = text.toLowerCase().split("").map(char => emojiMapping[char] || char).join("");

            if (!text) {
                return reply("ᴘʟᴇᴀsᴇ ᴘʀᴏᴠɪᴅᴇ sᴏᴍᴇ ᴛᴇxᴛ ᴛᴏ ᴄᴏɴᴠᴇʀᴛ ɪɴᴛᴏ ᴇᴍᴏᴊɪs!");
            }

            await conn.sendMessage(mek.chat, {
                text: emojiText,
            }, { quoted: mek });

        } catch (error) {
            console.log(error);
            reply(`ᴇʀʀᴏʀ: ${error.message}`);
        }
    }
);
// Facebook Downloader v1 (basic)
cmd({
  pattern: "fb2",
  alias: ["facebook2", "fbvideo2"],
  react: '📥',
  desc: "Download videos from Facebook (Basic API)",
  category: "download",
  use: ".fb <Facebook video URL>",
  filename: __filename
}, async (conn, mek, m, { from, reply, args }) => {
  try {
    const fbUrl = args[0];
    if (!fbUrl || !fbUrl.includes("facebook.com")) {
      return reply('ᴘʟᴇᴀsᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ᴠᴀʟɪᴅ ꜰᴀᴄᴇʙᴏᴏᴋ ᴠɪᴅᴇᴏ ᴜʀʟ. ᴇxᴀᴍᴘʟᴇ: `.ꜰʙ https://facebook.com/...`');
    }

    await conn.sendMessage(from, { react: { text: '⏳', key: m.key } });

    const apiUrl = `https://apis.davidcyriltech.my.id/facebook?url=${encodeURIComponent(fbUrl)}`;
    const response = await axios.get(apiUrl);

    if (!response.data || !response.data.status || !response.data.result || !response.data.result.downloads) {
      return reply('❌ ᴜɴᴀʙʟᴇ ᴛᴏ ꜰᴇᴛᴄʜ ᴛʜᴇ ᴠɪᴅᴇᴏ. ᴘʟᴇᴀsᴇ ᴄʜᴇᴄᴋ ᴛʜᴇ ᴜʀʟ ᴀɴᴅ ᴛʀʏ ᴀɢᴀɪɴ.');
    }

    const { title, downloads } = response.data.result;
    const downloadLink = downloads.hd?.url || downloads.sd.url;
    const quality = downloads.hd ? "ʜᴅ" : "sᴅ";

    await reply('ᴅᴏᴡɴʟᴏᴀᴅɪɴɢ ᴠɪᴅᴇᴏ... ᴘʟᴇᴀsᴇ ᴡᴀɪᴛ.📥');

    await conn.sendMessage(from, {
      video: { url: downloadLink },
      caption: `> ᴄʀᴇᴀᴛᴇᴅ ʙʏ ᴘʀɪᴍᴇ ʀɪᴅᴢ`
    }, { quoted: anony });

    await conn.sendMessage(from, { react: { text: '✅', key: m.key } });
  } catch (error) {
    console.error('Error:', error);
    reply('❌ ᴜɴᴀʙʟᴇ ᴛᴏ ᴅᴏᴡɴʟᴏᴀᴅ ᴛʜᴇ ᴠɪᴅᴇᴏ. ᴘʟᴇᴀsᴇ ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ.');
    await conn.sendMessage(from, { react: { text: '❌', key: m.key } });
  }
});

// Facebook Downloader v2
cmd({
  pattern: "fb",
  alias: ["facebook", "fbdl"],
  react: '📥',
  desc: "Download videos from Facebook (API v2)",
  category: "download",
  use: ".fb2 <Facebook video URL>",
  filename: __filename
}, async (conn, mek, m, { from, reply, args }) => {
  try {
    const fbUrl = args[0];
    if (!fbUrl || !fbUrl.includes("facebook.com")) {
      return reply('ᴘʟᴇᴀsᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ᴠᴀʟɪᴅ ꜰᴀᴄᴇʙᴏᴏᴋ ᴠɪᴅᴇᴏ ᴜʀʟ. ᴇxᴀᴍᴘʟᴇ: `.ꜰʙ2 https://facebook.com/...`');
    }

    await conn.sendMessage(from, { react: { text: '⏳', key: m.key } });

    const apiUrl = `https://apis.davidcyriltech.my.id/facebook2?url=${encodeURIComponent(fbUrl)}`;
    const response = await axios.get(apiUrl);

    if (!response.data || !response.data.status || !response.data.video) {
      return reply('❌ ᴜɴᴀʙʟᴇ ᴛᴏ ꜰᴇᴛᴄʜ ᴛʜᴇ ᴠɪᴅᴇᴏ. ᴘʟᴇᴀsᴇ ᴄʜᴇᴄᴋ ᴛʜᴇ ᴜʀʟ ᴀɴᴅ ᴛʀʏ ᴀɢᴀɪɴ.');
    }

    const { title, downloads } = response.data.video;
    const downloadLink = downloads.find(d => d.quality === "HD")?.downloadUrl || downloads[0].downloadUrl;

    await reply('ᴅᴏᴡɴʟᴏᴀᴅɪɴɢ ᴠɪᴅᴇᴏ... ᴘʟᴇᴀsᴇ ᴡᴀɪᴛ.📥');

    await conn.sendMessage(from, {
      video: { url: downloadLink },
      caption: `> ᴄʀᴇᴀᴛᴇᴅ ʙʏ ᴘʀɪᴍᴇ ʀɪᴅᴢ`
    }, { quoted: anony });

    await conn.sendMessage(from, { react: { text: '✅', key: m.key } });
  } catch (error) {
    console.error('Error:', error);
    reply('❌ ᴜɴᴀʙʟᴇ ᴛᴏ ᴅᴏᴡɴʟᴏᴀᴅ ᴛʜᴇ ᴠɪᴅᴇᴏ. ᴘʟᴇᴀsᴇ ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ.');
    await conn.sendMessage(from, { react: { text: '❌', key: m.key } });
  }
});

// Facebook Downloader v3
cmd({
  pattern: "fb3",
  alias: ["facebook3"],
  react: '📥',
  desc: "Download videos from Facebook (API v3)",
  category: "download",
  use: ".fb3 <Facebook video URL>",
  filename: __filename
}, async (conn, mek, m, { from, reply, args }) => {
  try {
    const fbUrl = args[0];
    if (!fbUrl || !fbUrl.includes("facebook.com")) {
      return reply('ᴘʟᴇᴀsᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ᴠᴀʟɪᴅ ꜰᴀᴄᴇʙᴏᴏᴋ ᴠɪᴅᴇᴏ ᴜʀʟ. ᴇxᴀᴍᴘʟᴇ: `.ꜰʙ3 https://facebook.com/...`');
    }

    await conn.sendMessage(from, { react: { text: '⏳', key: m.key } });

    const apiUrl = `https://apis.davidcyriltech.my.id/facebook3?url=${encodeURIComponent(fbUrl)}`;
    const response = await axios.get(apiUrl);

    if (!response.data || !response.data.status || !response.data.results || !response.data.results.download) {
      return reply('❌ ᴜɴᴀʙʟᴇ ᴛᴏ ꜰᴇᴛᴄʜ ᴛʜᴇ ᴠɪᴅᴇᴏ. ᴘʟᴇᴀsᴇ ᴄʜᴇᴄᴋ ᴛʜᴇ ᴜʀʟ ᴀɴᴅ ᴛʀʏ ᴀɢᴀɪɴ.');
    }

    const { title, download } = response.data.results;
    const downloadLink = download.hdVideos?.videoUrl || download.sdVideos.videoUrl;
    const quality = download.hdVideos ? "ʜᴅ" : "sᴅ";

    await reply('ᴅᴏᴡɴʟᴏᴀᴅɪɴɢ ᴠɪᴅᴇᴏ... ᴘʟᴇᴀsᴇ ᴡᴀɪᴛ.📥');

    await conn.sendMessage(from, {
      video: { url: downloadLink },
      caption: `> ᴄʀᴇᴀᴛᴇᴅ ʙʏ ᴘʀɪᴍᴇ ʀɪᴅᴢ`
    }, { quoted: anony });

    await conn.sendMessage(from, { react: { text: '✅', key: m.key } });
  } catch (error) {
    console.error('Error:', error);
    reply('❌ ᴜɴᴀʙʟᴇ ᴛᴏ ᴅᴏᴡɴʟᴏᴀᴅ ᴛʜᴇ ᴠɪᴅᴇᴏ. ᴘʟᴇᴀsᴇ ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ.');
    await conn.sendMessage(from, { react: { text: '❌', key: m.key } });
  }
});

cmd({
  pattern: "fb4",
  alias: ["facebook4", "fbdl4"],
  react: '📥',
  desc: "Download videos from Facebook (API v4)",
  category: "download",
  use: ".fb4 <Facebook video URL>",
  filename: __filename
}, async (conn, mek, m, { from, reply, args }) => {
  try {
    const fbUrl = args[0];
    if (!fbUrl || !fbUrl.includes("facebook.com")) {
      return reply('❌ ᴘʟᴇᴀsᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ᴠᴀʟɪᴅ ꜰᴀᴄᴇʙᴏᴏᴋ ᴠɪᴅᴇᴏ ᴜʀʟ.\n\nᴇxᴀᴍᴘʟᴇ:\n.ꜰʙ4 https://facebook.com/...');
    }

    await conn.sendMessage(from, { react: { text: '⏳', key: m.key } });

    const apiUrl = `https://jawad-tech.vercel.app/downloader?url=${encodeURIComponent(fbUrl)}`;
    const response = await axios.get(apiUrl);

    const data = response.data;

    if (!data.status || !data.result || !Array.isArray(data.result)) {
      return reply('❌ ᴜɴᴀʙʟᴇ ᴛᴏ ꜰᴇᴛᴄʜ ᴛʜᴇ ᴠɪᴅᴇᴏ. ᴘʟᴇᴀsᴇ ᴄʜᴇᴄᴋ ᴛʜᴇ ᴜʀʟ ᴀɴᴅ ᴛʀʏ ᴀɢᴀɪɴ.');
    }

    // Prefer HD, fallback to SD
    const hd = data.result.find(v => v.quality === "HD");
    const sd = data.result.find(v => v.quality === "SD");
    const video = hd || sd;

    if (!video) return reply("❌ ᴠɪᴅᴇᴏ ɴᴏᴛ ꜰᴏᴜɴᴅ ɪɴ ᴛʜᴇ ʀᴇsᴘᴏɴsᴇ.");

    await reply(`ᴅᴏᴡɴʟᴏᴀᴅɪɴɢ ᴠɪᴅᴇᴏ ᴘʟᴇᴀsᴇ ᴡᴀɪᴛ`);

    await conn.sendMessage(from, {
      video: { url: video.url },
      caption: `🎥 *ꜰᴀᴄᴇʙᴏᴏᴋ ᴠɪᴅᴇᴏ ᴅᴏᴡɴʟᴏᴀᴅᴇʀ*\n\n> ǫᴜᴀʟɪᴛʏ: ${video.quality}\n\n> ᴄʀᴇᴀᴛᴇᴅ ʙʏ ᴘʀɪᴍᴇ ʀɪᴅᴢ`
    }, { quoted: mek });

    await conn.sendMessage(from, { react: { text: '✅', key: m.key } });
  } catch (error) {
    console.error('FB4 Error:', error);
    reply('❌ ꜰᴀɪʟᴇᴅ ᴛᴏ ᴅᴏᴡɴʟᴏᴀᴅ ᴛʜᴇ ᴠɪᴅᴇᴏ. ᴘʟᴇᴀsᴇ ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ.');
    await conn.sendMessage(from, { react: { text: '❌', key: m.key } });
  }
});

cmd({
    pattern: "join",
    react: "📬",
    alias: ["joinme", "f_join"],
    desc: "To Join a Group from Invite link",
    category: "group",
    use: '.join < Group Link >',
    filename: __filename
}, async (conn, mek, m, { from, l, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isCreator, isDev, isAdmins, reply }) => {
    try {
        const msr = {
            own_cmd: "ʏᴏᴜ ᴅᴏɴ'ᴛ ʜᴀᴠᴇ ᴘᴇʀᴍɪꜱꜱɪᴏɴ ᴛᴏ ᴜꜱᴇ ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ."
        };

        // Only allow the creator to use the command
        if (!isCreator) return reply(msr.own_cmd);

        // If there's no input, check if the message is a reply with a link
        if (!q && !quoted) return reply("ᴘʟᴇᴀꜱᴇ ᴘʀᴏᴠɪᴅᴇ ᴛʜᴇ ɢʀᴏᴜᴘ ʟɪɴᴋ");

        let groupLink;

        // If the message is a reply to a group invite link
        if (quoted && quoted.type === 'conversation' && isUrl(quoted.text)) {
            groupLink = quoted.text.split('https://chat.whatsapp.com/')[1];
        } else if (q && isUrl(q)) {
            // If the user provided the link in the command
            groupLink = q.split('https://chat.whatsapp.com/')[1];
        }

        if (!groupLink) return reply("ɪɴᴠᴀʟɪᴅ ɢʀᴏᴜᴘ ʟɪɴᴋ");

        // Accept the group invite
        await conn.groupAcceptInvite(groupLink);
        await conn.sendMessage(from, { text: `ꜱᴜᴄᴄᴇꜱꜱꜰᴜʟʟʏ ᴊᴏɪɴᴇᴅ*` }, { quoted: anony });

    } catch (e) {
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
        console.log(e);
        reply(`ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ!!*\n\n${e}`);
    }
});

cmd({
    pattern: "remove",
    alias: ["kick", "k"],
    desc: "Removes a member from the group",
    category: "group",
    react: "❌",
    filename: __filename
},
async (conn, mek, m, {
    from, q, isGroup, isBotAdmins, reply, quoted, isCreator
}) => {
    // Check if the command is used in a group
    if (!isGroup) return reply("ᴛʜɪꜱ ᴄᴀɴ ᴏɴʟʏ ʙᴇ ᴜꜱᴇᴅ ɪɴ ɢʀᴏᴜᴘꜱ.");

    // Restrict to only bot owner
    if (!isCreator) {
        return reply("*ᴛʜɪꜱ ɪꜱ ᴀɴ ᴏᴡɴᴇʀ ᴄᴏᴍᴍᴀɴᴅ.*");
    }
    if (!isBotAdmins) return reply("ɪ ɴᴇᴇᴅ ᴛᴏ ʙᴇ ᴀɴ ᴀᴅᴍɪɴ ᴛᴏ ᴜꜱᴇ ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ.");

    let number;
    if (m.quoted) {
        number = m.quoted.sender.split("@")[0]; // If replying to a message
    } else if (q && q.includes("@")) {
        number = q.replace(/[@\s]/g, ''); // If mentioning a user
    } else {
        return reply("ᴘʟᴇᴀꜱᴇ ʀᴇᴘʟʏ ᴛᴏ ᴀ ᴍᴇꜱꜱᴀɢᴇ ᴏʀ ᴍᴇɴᴛɪᴏɴ ᴀ ᴜꜱᴇʀ ᴛᴏ ʀᴇᴍᴏᴠᴇ.");
    }

    const jid = number + "@s.whatsapp.net";

    try {
        await conn.groupParticipantsUpdate(from, [jid], "remove");
        reply(`ꜱᴜᴄᴄᴇꜱꜱꜰᴜʟʟʏ ʀʀᴍᴏᴠᴇᴅ @${number}`, { mentions: [jid] });
    } catch (error) {
        console.error("Remove command error:", error);
        reply("ꜰᴀɪʟᴇᴅ ᴛᴏ ʀᴇᴍᴏᴠᴇ ᴛʜᴇ ᴍᴇᴍʙᴇʀ.");
    }
});

cmd({
    pattern: "kickall",
    alias: ["removeall", "nuke"],
    desc: "Removes all members from the group and makes bot leave",
    category: "group",
    react: "💥",
    filename: __filename
},
async (conn, mek, m, {
    from, q, isGroup, isBotAdmins, reply, quoted, isCreator, groupMetadata
}) => {
    if (!isGroup) return;
    if (!isCreator) return;
    if (!isBotAdmins) return;

    try {
        const metadata = await conn.groupMetadata(from);
        const participants = metadata.participants;

        // Filter out admins and the bot itself
        const membersToRemove = participants.filter(p => 
            !p.admin && !p.id.includes(conn.user.id.split(':')[0])
        );

        if (membersToRemove.length === 0) {
            return;
        }

        // Remove members in batches of 10 per second
        const batchSize = 10;
        const delay = 1000;

        for (let i = 0; i < membersToRemove.length; i += batchSize) {
            const batch = membersToRemove.slice(i, i + batchSize);
            const jids = batch.map(p => p.id);

            try {
                await conn.groupParticipantsUpdate(from, jids, "remove");

                // Wait before next batch
                if (i + batchSize < membersToRemove.length) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            } catch (batchError) {
                console.error("Batch removal error:", batchError);
                // Continue with next batch even if one fails
            }
        }

        // Send final message before leaving
        await conn.sendMessage(from, { 
            text: 'ꜱᴏ ʟᴏɴɢ ꜱᴜᴄᴋᴇʀꜱ🤣' 
        }, { quoted: mek });

        // Make bot leave the group
        await conn.groupLeave(from);

    } catch (error) {
        console.error("Kickall command error:", error);
    }
});
cmd({
    pattern: "leave",
    alias: ["left", "leftgc", "leavegc"],
    desc: "Leave the group",
    react: "🎉",
    category: "owner",
    filename: __filename
},
async (conn, mek, m, {
    from, isGroup, isCreator, reply
}) => {
    try {
        if (!isGroup) {
            return reply("ᴛʜɪꜱ ɪꜱ ᴀ ɢʀᴏᴜᴘ ᴄᴏᴍᴍᴀɴᴅ ʟᴏʟ*.");
        }

        if (!isCreator) {
            return reply("ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ ᴄᴀɴ ᴏɴʟʏ ʙᴇ ᴜꜱᴇᴅ ʙʏ ᴍʏ ᴏᴡɴᴇʀ.");
        }

        // Send a goodbye message first
        await reply(`👋 *ɢᴏᴏᴅʙʏᴇ ᴇᴠᴇʀʏᴏɴᴇ!*  
ɪ'ᴍ ʟᴇᴀᴠɪɴɢ ᴛʜᴇ ɢʀᴏᴜᴘ ɴɪᴡ 
ᴛʜᴀɴᴋꜱ ꜰᴏʀ ʜᴀᴠɪɴɢ ᴍᴇ ʜᴇʀᴇ`);

        await sleep(1500); // Wait a bit before leaving
        await conn.groupLeave(from);

    } catch (e) {
        console.error(e);
        reply(`ᴇʀʀᴏʀ: ${e.message}`);
    }
});

cmd({
    pattern: "invite",
    alias: ["link", "grouplink"],
    desc: "Get group invite link.",
    category: "group",
    filename: __filename,
}, async (conn, mek, m, { from, isGroup, sender, reply }) => {
    try {
        if (!isGroup) return reply("𝐓𝐡𝐢𝐬 𝐅𝐞𝐚𝐭𝐮𝐫𝐞 𝐈𝐬 𝐎𝐧𝐥𝐲 𝐅𝐨𝐫 𝐆𝐫𝐨𝐮𝐩𝐬.");

        const botNumber = conn.user.id.split(':')[0];

        // Get group metadata and admin list
        const groupMetadata = await conn.groupMetadata(from);
        const groupAdmins = groupMetadata.participants.filter(member => member.admin);
        const isBotAdmins = groupAdmins.some(admin => admin.id === botNumber + '@s.whatsapp.net');

        if (!isBotAdmins) {
            return reply("⚠️ 𝙋𝙡𝙚𝙖𝙨𝙚 𝙋𝙧𝙤𝙢𝙤𝙩𝙚 𝙈𝙚 𝘼𝙨 𝘼𝙙𝙢𝙞𝙣 𝙏𝙤 𝙂𝙚𝙣𝙚𝙧𝙖𝙩𝙚 𝙏𝙝𝙚 𝙂𝙧𝙤𝙪𝙥 𝙄𝙣𝙫𝙞𝙩𝙚 𝙇𝙞𝙣𝙠 ❗");
        }

        const inviteCode = await conn.groupInviteCode(from);
        if (!inviteCode) return reply("ꜰᴀɪʟᴇᴅ ᴛᴏ ʀᴇᴛʀɪᴇᴠᴇ ɪɴᴠɪᴛᴇ ᴄᴏᴅᴇ.");

        const inviteLink = `https://chat.whatsapp.com/${inviteCode}`;
        return reply(`ʜᴇʀᴇ ɪꜱ ʏᴏᴜʀ ɢʀᴏᴜᴘ ɪɴᴠɪᴛᴇ ʟɪɴᴋ:*\n${inviteLink}`);

    } catch (error) {
        console.error("Error in invite command:", error);
        reply(`ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ : ${error.message || "Unknown error"}`);
    }
});

cmd({
    pattern: "lockgc",
    alias: ["lock"],
    react: "🔒",
    desc: "Lock the group (Prevents new members from joining).",
    category: "group",
    filename: __filename
},           
async (conn, mek, m, { from, isGroup, isAdmins, isBotAdmins, reply }) => {
    try {
if (!isGroup) return reply("ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ ᴄᴀɴ ᴏɴʟʏ ʙᴇ ᴜꜱᴇᴅ ɪɴ ɢʀᴏᴜᴘꜱ.");
        if (!isAdmins) return reply("ᴏɴʟʏ ɢᴄ ᴀᴅᴍɪɴꜱ ᴄᴀɴ ᴜꜱᴇ ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ.");
        if (!isBotAdmins) return reply("ɪ ɴᴇᴇᴅ ᴛᴏ ʙᴇ ᴀɴ ᴀᴅᴍɪɴ ᴛᴏ ᴜɴᴍᴜᴛᴇ ɢᴄ.");

        await conn.groupSettingUpdate(from, "locked");
        reply("ɢʀᴏᴜᴘ ʜᴀꜱ ʙᴇᴇɴ ʟᴏᴄᴋᴇᴅ. ɴᴇᴡ ᴍᴇᴍʙᴇʀꜱ ᴄᴀɴ ɴᴏᴛ ᴊᴏɪɴ.");
    } catch (e) {
        console.error("Error locking group:", e);
        reply("ꜰᴀɪʟᴇᴅ ᴛᴏ ʟᴏᴄᴋ ɢʀᴏᴜᴘ,ᴘʟᴇᴀꜱᴇ ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ.");
    }
});


cmd({
    pattern: "mute",
    alias: ["groupmute"],
    react: "🔇",
    desc: "Mute the group (Only admins can send messages).",
    category: "group",
    filename: __filename
},           
async (conn, mek, m, { from, isGroup, senderNumber, isAdmins, isBotAdmins, reply }) => {
    try {
     if (!isGroup) return reply("ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ ᴄᴀɴ ᴏɴʟʏ ʙᴇ ᴜꜱᴇᴅ ɪɴ ɢʀᴏᴜᴘꜱ.");
        if (!isAdmins) return reply("ᴏɴʟʏ ɢᴄ ᴀᴅᴍɪɴꜱ ᴄᴀɴ ᴜꜱᴇ ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ.");
        if (!isBotAdmins) return reply("ɪ ɴᴇᴇᴅ ᴛᴏ ʙᴇ ᴀɴ ᴀᴅᴍɪɴ ᴛᴏ ᴜɴᴍᴜᴛᴇ ɢᴄ.");

        await conn.groupSettingUpdate(from, "announcement");
        reply("ɢʀᴏᴜᴘ ʜᴀꜱ ʙᴇᴇɴ ᴍᴜᴛᴇᴅ ᴏɴʟʏ ᴀᴅᴍɪɴꜱ ᴄᴀɴ ꜱᴇɴᴅ ᴍᴇꜱꜱᴀɢᴇꜱ.");
    } catch (e) {
        console.error("Error muting group:", e);
        reply("ꜰᴀɪʟᴇᴅ ᴛᴏ ᴍᴜᴛᴇ ᴠɪᴅᴇᴏ,ᴘʟᴇᴀꜱᴇ ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ.");
    }
});

cmd({
    pattern: "unmute",
    alias: ["groupunmute"],
    react: "🔊",
    desc: "Unmute the group (Everyone can send messages).",
    category: "group",
    filename: __filename
},           
async (conn, mek, m, { from, isGroup, senderNumber, isAdmins, isBotAdmins, reply }) => {
    try {
        if (!isGroup) return reply("ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ ᴄᴀɴ ᴏɴʟʏ ʙᴇ ᴜꜱᴇᴅ ɪɴ ɢʀᴏᴜᴘꜱ.");
        if (!isAdmins) return reply("ᴏɴʟʏ ɢᴄ ᴀᴅᴍɪɴꜱ ᴄᴀɴ ᴜꜱᴇ ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ.");
        if (!isBotAdmins) return reply("ɪ ɴᴇᴇᴅ ᴛᴏ ʙᴇ ᴀɴ ᴀᴅᴍɪɴ ᴛᴏ ᴜɴᴍᴜᴛᴇ ɢᴄ.");

        await conn.groupSettingUpdate(from, "not_announcement");
        reply("ɢʀᴏᴜᴘ ʜᴀꜱ ʙᴇᴇɴ ᴜɴᴍᴜᴛᴇᴅ. ᴇᴠᴇʀʏᴏɴᴇ ᴄᴀɴ ꜱᴇɴᴅ ᴍᴇꜱꜱᴀɢᴇꜱ.");
    } catch (e) {
        console.error("Error unmuting group:", e);
        reply("ꜰᴀɪʟᴇᴅ ᴛᴏ ᴜɴᴍᴜᴛᴇ ɢʀᴏᴜᴘ.");
    }
});

cmd({
    pattern: "unlockgc",
    alias: ["unlock"],
    react: "🔓",
    desc: "Unlock the group (Allows new members to join).",
    category: "group",
    filename: __filename
},           
async (conn, mek, m, { from, isGroup, isAdmins, isBotAdmins, reply }) => {
    try {
        if (!isGroup) return reply("ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ ᴄᴀɴ ᴏɴʟʏ ʙᴇ ᴜꜱᴇᴅ ɪɴ ɢʀᴏᴜᴘꜱ.");
        if (!isAdmins) return reply("ᴏɴʟʏ ɢᴄ ᴀᴅᴍɪɴꜱ ᴄᴀɴ ᴜꜱᴇ ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ.");
        if (!isBotAdmins) return reply("ɪ ɴᴇᴇᴅ ᴛᴏ ʙᴇ ᴀɴ ᴀᴅᴍɪɴ ᴛᴏ ᴜɴʟᴏᴄᴋ ɢᴄ.");

        await conn.groupSettingUpdate(from, "unlocked");
        reply("ɢʀᴏᴜᴘ ʜᴀꜱ ʙᴇᴇɴ ᴜɴʟᴏᴄᴋᴇᴅ. ɴᴇᴡ ᴍᴇᴍʙᴇʀꜱ  ᴄᴀɴ ɴᴏᴡ  ᴊᴏɪɴ.");
    } catch (e) {
        console.error("Error unlocking group:", e);
        reply("ꜰᴀɪʟᴇᴅ ᴛᴏ ᴜɴʟᴏᴄᴋ ɢʀᴏᴜᴘ.");
    }
});

// remove only member
cmd({
    pattern: "removemembers",
    alias: ["kickall", "endgc", "endgroup"],
    desc: "Remove all non-admin members from the group.",
    react: "🎉",
    category: "group",
    filename: __filename,
}, 
async (conn, mek, m, {
    from, groupMetadata, groupAdmins, isBotAdmins, senderNumber, reply, isGroup, isCreator
}) => {
    try {
        if (!isCreator) {
            return await conn.sendMessage(from, {
                text: "*ᴛʜɪꜱ ɪꜱ ᴀɴ ᴏᴡɴᴇʀ ᴄᴏᴍᴍᴀɴᴅ"
            }, { quoted: mek });
        }

        // Check if the command is used in a group
        if (!isGroup) {
            return reply("ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ ᴄᴀɴ ᴏɴʟʏ ʙᴇ ᴜꜱᴇᴅ ɪɴ ɢʀᴏᴜᴘꜱ.");
        }

        if (!isBotAdmins) {
            return reply("ɪ ɴᴇᴇᴅ ᴛᴏ ʙᴇ ᴀɴ ᴀᴅᴍɪɴ ᴛᴏ ᴇxᴇᴄᴜᴛᴇ ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ.");
        }

        const allParticipants = groupMetadata.participants;
        const nonAdminParticipants = allParticipants.filter(member => !groupAdmins.includes(member.id));

        if (nonAdminParticipants.length === 0) {
            return reply("ᴛʜᴇʀᴇ ᴀʀᴇ ɴᴏ ɴᴏɴ-ᴀᴅᴍɪɴ ᴍᴇᴍʙᴇʀꜱ ᴛᴏ ʀᴇᴍᴏᴠᴇ.");
        }

        reply(`ꜱᴛᴀʀᴛɪɴɢ ᴛᴏ ʀᴇᴍᴏᴠᴇ ${nonAdminParticipants.length} ɴᴏɴ-ᴀᴅᴍɪᴍ ᴍᴇᴍʙᴇʀꜱ...`);

        for (let participant of nonAdminParticipants) {
            try {
                await conn.groupParticipantsUpdate(from, [participant.id], "remove");
                await sleep(2000); // 2-second delay between removals
            } catch (e) {
                console.error(`Failed to remove ${participant.id}:`, e);
            }
        }

        reply("ꜱᴜᴄᴄᴇꜱꜱꜰᴜʟʟʏ ʀᴇᴍᴏᴠᴇᴅ ᴀʟʟ ɴᴏɴ-ᴀᴅᴍɪɴ ᴍᴇᴍʙᴇʀꜱ.");
    } catch (e) {
        console.error("Error removing non-admin users:", e);
        reply("ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ᴘʀᴏᴄᴇꜱꜱɪɴɢ ʏᴏᴜʀ ʀᴇQᴜᴇꜱᴛ.");
    }
});

// remove only admins
cmd({
    pattern: "removeadmins",
    alias: ["kickadmins", "kickall3", "deladmins"],
    desc: "Remove all admin members from the group, excluding the bot and bot owner.",
    react: "🎉",
    category: "group",
    filename: __filename,
}, 
async (conn, mek, m, {
    from, isGroup, senderNumber, groupMetadata, groupAdmins, isBotAdmins, reply, isCreator
}) => {
    try {
        if (!isCreator) {
            return await conn.sendMessage(from, {
                text: "*ᴛʜɪꜱ ɪꜱ ᴀɴ ᴏᴡɴᴇʀ ᴄᴏᴍᴍᴀɴᴅ"
            }, { quoted: mek });
        }

        // Check if the command is used in a group
        if (!isGroup) {
            return reply("ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ ᴄᴀɴ ᴏɴʟʏ ʙᴇ ᴜꜱᴇᴅ ɪɴ ɢʀᴏᴜᴘꜱ.");
        }

        if (!isBotAdmins) {
            return reply("ɪ ɴᴇᴇᴅ ᴛᴏ ʙᴇ ᴀɴ ᴀᴅᴍɪɴ ᴛᴏ ᴇxᴇᴄᴜᴛᴇ ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ.");
        }

        const allParticipants = groupMetadata.participants;
        const adminParticipants = allParticipants.filter(member => groupAdmins.includes(member.id) && member.id !== conn.user.id && member.id !== `${senderNumber}@s.whatsapp.net`);

        if (adminParticipants.length === 0) {
            return reply("ᴛʜᴇɪʀ ᴀ ɴᴏ ᴀᴅᴍɪɴꜱ ᴛᴏ ʀᴇᴍᴏᴠᴇ.");
        }

        reply(`ꜱᴛᴀʀᴛɪɴɢ ᴛᴏ ʀᴇᴍᴏᴠᴇ ${adminParticipants.length} ᴀᴅᴍɪɴ ᴍᴇᴍʙᴇʀꜱ, ᴇxᴄʟᴜᴅɪɴɢ ᴛʜᴇ ʙᴏᴛ ᴀɴᴅ ʙᴏᴛ ᴏᴡɴᴇʀ...`);

        for (let participant of adminParticipants) {
            try {
                await conn.groupParticipantsUpdate(from, [participant.id], "remove");
                await sleep(2000); // 2-second delay between removals
            } catch (e) {
                console.error(`Failed to remove ${participant.id}:`, e);
            }
        }

        reply("ꜱᴜᴄᴄᴇꜱꜱꜰᴜʟʟʏ ʀᴇᴍᴏᴠᴇᴅ ᴀʟʟ ᴀᴅᴍɪɴ ᴍᴇᴍʙᴇʀꜱ, ᴇxᴄʟᴜᴅɪɴɢ ᴛʜᴇ ʙᴏᴛ ᴀɴᴅ ʙᴏᴛ ᴏᴡɴᴇʀ ꜰʀᴏᴍ ᴛʜᴇ ɢʀᴏᴜᴘ.");
    } catch (e) {
        console.error("Error removing admins:", e);
        reply("ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ᴘʀᴏᴄᴇꜱꜱɪɴɢ ʏᴏᴜʀ ʀᴇQᴜᴇꜱᴛ.");
    }
});

// remove admins and memeber both
cmd({
    pattern: "removeall2",
    alias: ["kickall2", "endgc2", "endgroup2"],
    desc: "Remove all members and admins from the group, excluding the bot and bot owner.",
    react: "🎉",
    category: "group",
    filename: __filename,
}, 
async (conn, mek, m, {
    from, isGroup, senderNumber, groupMetadata, isBotAdmins, reply, isCreator
}) => {
    try {
        if (!isCreator) {
            return await conn.sendMessage(from, {
                text: "*ᴛʜɪꜱ ɪꜱ ᴀɴ ᴏᴡɴᴇʀ ᴄᴏᴍᴍᴀɴᴅ"
            }, { quoted: mek });
        }

        // Check if the command is used in a group
        if (!isGroup) {
            return reply("ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ ᴄᴀɴ ᴏɴʟʏ ʙᴇ ᴜꜱᴇᴅ ɪɴ ɢʀᴏᴜᴘꜱ.");
        }

        if (!isBotAdmins) {
            return reply("ɪ ɴᴇᴇᴅ ᴛᴏ ʙᴇ ᴀɴ ᴀᴅᴍɪɴ ᴛᴏ ᴇxᴇᴄᴜᴛᴇ ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ.");
        }

        const allParticipants = groupMetadata.participants;

        if (allParticipants.length === 0) {
            return reply("ᴛʜɪꜱ ɢʀᴏᴜᴘ ʜᴀꜱ ɴᴏ ᴍᴇᴍʙᴇʀꜱ ᴛᴏ ʀᴇᴍᴏᴠᴇ.");
        }

        // Filter out the bot and bot owner from the list
        const participantsToRemove = allParticipants.filter(
            participant => participant.id !== conn.user.id && participant.id !== `${senderNumber}@s.whatsapp.net`
        );

        if (participantsToRemove.length === 0) {
            return reply("ɴᴏ ᴍᴇᴍʙᴇʀꜱ ᴛᴏ ʀᴇᴍᴏᴠᴇ ᴀꜰᴛᴇʀ ᴇxᴄʟᴜᴅɪɴɢ ᴛʜᴇ ʙᴏᴛ ᴀɴᴅ ʙᴏᴛ ᴏᴡɴᴇʀ.");
        }

        reply(`ꜱᴛᴀʀᴛɪɴɢ ᴛᴏ ʀᴇᴍᴏᴠᴇ ${participantsToRemove.length} ᴍᴇᴍʙᴇʀꜱ, ᴇxᴄʟᴜᴅɪɴɢ ᴛʜᴇ ʙᴏᴛ ᴀɴᴅ ʙᴏᴛ ᴏᴡɴᴇʀ...`);

        for (let participant of participantsToRemove) {
            try {
                await conn.groupParticipantsUpdate(from, [participant.id], "remove");
                await sleep(2000); // 2-second delay between removals
            } catch (e) {
                console.error(`Failed to remove ${participant.id}:`, e);
            }
        }

        reply("ꜱᴜᴄᴄᴇꜱꜱꜰᴜʟʟʏ ʀᴇᴍᴏᴠᴇᴅ ᴀʟʟ ᴍᴇᴍʙᴇʀꜱ, ᴇxᴄʟᴜᴅɪɴɢ ᴛʜᴇ ʙᴏᴛ ᴀɴᴅ ʙᴏᴛ ᴏᴡɴᴇʀ ꜰʀᴏᴍ ᴛʜᴇ ɢʀᴏᴜᴘ.");
    } catch (e) {
        console.error("Error removing members:", e);
        reply("ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ᴘʀᴏᴄᴇꜱꜱɪɴɢ ʏᴏᴜʀ ʀᴇQᴜᴇꜱᴛ.");
    }
});

cmd({
    pattern: "tagall",
    react: "🔊",
    alias: ["gc_tagall"],
    desc: "To Tag all Members",
    category: "group",
    use: '.tagall [message]',
    filename: __filename
},
async (conn, mek, m, { from, participants, reply, isGroup, senderNumber, groupAdmins, prefix, command, args, body }) => {
    try {
        if (!isGroup) return reply("ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ ᴄᴀɴ ᴏɴʟʏ ʙᴇ ᴜꜱᴇᴅ ɪɴ ɢʀᴏᴜᴘꜱ.");

        const botOwner = conn.user.id.split(":")[0]; // Extract bot owner's number
        const senderJid = senderNumber + "@s.whatsapp.net";

        if (!groupAdmins.includes(senderJid) && senderNumber !== botOwner) {
            return reply("ᴏɴʟʏ ɢʀᴏᴜᴘ ᴀᴅᴍɪɴꜱ ᴀɴᴅ ʙᴏᴛ ᴏᴡɴᴇʀ ᴄᴀɴ ᴜꜱᴇ ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ.");
        }

        // Ensure group metadata is fetched properly
        let groupInfo = await conn.groupMetadata(from).catch(() => null);
        if (!groupInfo) return reply("ꜰᴀɪʟᴇᴅ ᴛᴏ ꜰᴇᴛᴄʜ ɢʀᴏᴜᴘ ɪɴꜰᴏʀᴍᴀᴛɪᴏɴ.");

        let groupName = groupInfo.subject || "Unknown Group";
        let totalMembers = participants ? participants.length : 0;
        if (totalMembers === 0) return reply("ɴᴏ ᴍᴇᴍʙᴇʀꜱ ꜰᴏᴜɴᴅ ɪɴ ᴛʜɪꜱ ɢʀᴏᴜᴘ.");

        let emojis = ['📢', '🔊', '🌐', '🔰', '❤‍🩹', '🤍', '🖤', '🩵', '📝', '💗', '🔖', '🪩', '📦', '🎉', '🛡️', '💸', '⏳', '🗿', '🚀', '🎧', '🪀', '⚡', '🚩', '🍁', '🗣️', '👻', '⚠️', '🔥'];
        let randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];

        // Proper message extraction
        let message = body.slice(body.indexOf(command) + command.length).trim();
        if (!message) message = "ᴀᴛᴛᴇᴄᴛɪᴏɴ ᴇᴠᴇʀʏᴏɴᴇ "; // Default message

        let teks = `├•▣┃ Group : *${groupName}*\n├•▣┃ Members : *${totalMembers}*\n├•▣┃ Message: *${message}*\n\n╭━━━❏🏔️ *ᴘʀɪᴍᴇ ʀɪᴅᴢ ᴍᴇɴᴛɪᴏɴᴇᴅ* 🏔️━━━━━❏*\n`;

        for (let mem of participants) {
            if (!mem.id) continue; // Prevent undefined errors
            teks += `${randomEmoji} @${mem.id.split('@')[0]}\n`;
        }

        teks += "╰▬▬▬▬▬▬▬Rɪᴅᴢ Cᴏᴅᴇʀ❦▬▬▬▬▬▬▬❏";

        conn.sendMessage(from, { text: teks, mentions: participants.map(a => a.id) }, { quoted: mek });

    } catch (e) {
        console.error("TagAll Error:", e);
        reply(`ᴇʀʀᴏʀ !!*\n\n${e.message || e}`);
    }
});

cmd({
  pattern: "hidetag",
  alias: ["tag", "h"],  
  react: "🔊",
  desc: "To Tag all Members for Any Message/Media",
  category: "group",
  use: '.hidetag Hello',
  filename: __filename
},
async (conn, mek, m, {
  from, q, isGroup, isCreator, isAdmins,
  participants, reply
}) => {
  try {
    const isUrl = (url) => {
      return /https?:\/\/(www\.)?[\w\-@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([\w\-@:%_\+.~#?&//=]*)/.test(url);
    };

    if (!isGroup) return reply("ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ ᴄᴀɴ ᴏɴʟʏ ʙᴇ ᴜꜱᴇᴅ ɪɴ ɢʀᴏᴜᴘꜱ.");
    if (!isAdmins && !isCreator) return reply("ᴏɴʟʏ ɢʀᴏᴜᴘ ᴀᴅᴍɪɴꜱ ᴄᴀɴ ᴜꜱᴇ ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ.");

    const mentionAll = { mentions: participants.map(u => u.id) };

    // If no message or reply is provided
    if (!q && !m.quoted) {
      return reply("ᴘʟᴇᴀꜱᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ᴍᴇꜱꜱᴀɢᴇ ᴏʀ ʀᴇᴘʟʏ ᴛᴏ ᴀ ᴍᴇꜱꜱᴀɢᴇ ᴛᴏ ᴛᴀɢ ᴀʟʟ ᴍᴇᴍʙᴇʀꜱ.");
    }

    // If a reply to a message
    if (m.quoted) {
      const type = m.quoted.mtype || '';

      // If it's a text message (extendedTextMessage)
      if (type === 'extendedTextMessage') {
        return await conn.sendMessage(from, {
          text: m.quoted.text || 'ɴᴏ ᴍᴇꜱꜱᴀɢᴇ ᴄᴏɴᴛᴇɴᴛ ꜰᴏᴜɴᴅ.',
          ...mentionAll
        }, { quoted: anony });
      }

      // Handle media messages
      if (['imageMessage', 'videoMessage', 'audioMessage', 'stickerMessage', 'documentMessage'].includes(type)) {
        try {
          const buffer = await m.quoted.download?.();
          if (!buffer) return reply("ꜰᴀɪʟᴇᴅ ᴛᴏ ᴅᴏᴡɴʟᴏᴀᴅ ᴛʜᴇ Qᴜᴏᴛᴇᴅ ᴍᴇᴅɪᴀ.");

          let content;
          switch (type) {
            case "imageMessage":
              content = { image: buffer, caption: m.quoted.text || "📷 ɪᴍᴀɢᴇ", ...mentionAll };
              break;
            case "videoMessage":
              content = { 
                video: buffer, 
                caption: m.quoted.text || "🎥 Video", 
                gifPlayback: m.quoted.message?.videoMessage?.gifPlayback || false, 
                ...mentionAll 
              };
              break;
            case "audioMessage":
              content = { 
                audio: buffer, 
                mimetype: "audio/mp4", 
                ptt: m.quoted.message?.audioMessage?.ptt || false, 
                ...mentionAll 
              };
              break;
            case "stickerMessage":
              content = { sticker: buffer, ...mentionAll };
              break;
            case "documentMessage":
              content = {
                document: buffer,
                mimetype: m.quoted.message?.documentMessage?.mimetype || "application/octet-stream",
                fileName: m.quoted.message?.documentMessage?.fileName || "file",
                caption: m.quoted.text || "",
                ...mentionAll
              };
              break;
          }

          if (content) {
            return await conn.sendMessage(from, content, { quoted: anony });
          }
        } catch (e) {
          console.error("Media download/send error:", e);
          return reply("ꜰᴀɪʟᴇᴅ ᴛᴏ ᴘʀᴏᴄᴇꜱꜱ ᴍᴇᴅɪᴀ.ꜱᴇɴᴅɪɴɢ ᴀꜱ ᴛᴇxᴛ ɪɴꜱᴛᴇᴀᴅ.");
        }
      }

      // Fallback for any other message type
      return await conn.sendMessage(from, {
        text: m.quoted.text || "📨 ᴍᴇꜱꜱᴀɢᴇ",
        ...mentionAll
      }, { quoted: anony });
    }

    // If no quoted message, but a direct message is sent
    if (q) {
      // If the direct message is a URL, send it as a message
      if (isUrl(q)) {
        return await conn.sendMessage(from, {
          text: q,
          ...mentionAll
        }, { quoted: anony });
      }

      // Otherwise, just send the text without the command name
      await conn.sendMessage(from, {
        text: q, // Sends the message without the command name
        ...mentionAll
      }, { quoted: anony });
    }

  } catch (e) {
    console.error(e);
    reply(`ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ !!*\n\n${e.message}`);
  }
});

cmd({
    pattern: "revoke",
    react: "🖇️",
    alias: ["revokegrouplink", "resetglink", "revokelink", "f_revoke"],
    desc: "To Reset the group link",
    category: "group",
    use: '.revoke',
    filename: __filename
},
async (conn, mek, m, {
    from, isCmd, isGroup, sender, isBotAdmins,
    isAdmins, reply
}) => {
    try {
if (!isGroup) return reply("ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ ᴄᴀɴ ᴏɴʟʏ ʙᴇ ᴜꜱᴇᴅ ɪɴ ɢʀᴏᴜᴘꜱ.");
        if (!isAdmins) return reply("ᴏɴʟʏ ɢᴄ ᴀᴅᴍɪɴꜱ ᴄᴀɴ ᴜꜱᴇ ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ.");
        if (!isBotAdmins) return reply("ɪ ɴᴇᴇᴅ ᴛᴏ ʙᴇ ᴀɴ ᴀᴅᴍɪɴ ᴛᴏ ʀᴇᴠᴏᴋᴇ ɢᴄ ʟɪɴᴋ.");

        await conn.groupRevokeInvite(from);
        await conn.sendMessage(from, {
            text: `ɢʀᴏᴜᴘ ʟɪɴᴋ ʜᴀꜱ ʙᴇᴇɴ ʀᴇꜱᴇᴛ ꜱᴜᴄᴄᴇꜱꜱꜰᴜʟʟʏ!`
        }, { quoted: anony });

    } catch (err) {
        console.error(err);
        reply(`ᴇʀʀᴏʀ ʀᴇꜱᴇᴛᴛɪɴɢ ɢʀᴏᴜᴘ ʟɪɴᴋ.`);
    }
});


cmd({
    pattern: "promote",
    alias: ["p", "makeadmin"],
    desc: "Promotes a member to group admin",
    category: "group",
    react: "⬆️",
    filename: __filename
},
async(conn, mek, m, {
    from, l, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isCreator, isDev, isAdmins, reply
}) => {
    if (!isGroup) return reply("ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ ᴄᴀɴ ᴏɴʟʏ ʙᴇ ᴜꜱᴇᴅ ɪɴ ɢʀᴏᴜᴘꜱ.");
        if (!isAdmins) return reply("ᴏɴʟʏ ɢᴄ ᴀᴅᴍɪɴꜱ ᴄᴀɴ ᴜꜱᴇ ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ.");
        if (!isBotAdmins) return reply("ɪ ɴᴇᴇᴅ ᴛᴏ ʙᴇ ᴀɴ ᴀᴅᴍɪɴ ᴛᴏ ᴘʀᴏᴍᴏᴛᴇ ᴜꜱᴇʀ.");

    let number;
    if (m.quoted) {
        number = m.quoted.sender.split("@")[0]; // If replying to a message, get the sender's number
    } else if (q && q.includes("@")) {
        number = q.replace(/[@\s]/g, ''); // If manually typing a number
    } else {
        return reply("ᴘʟᴇᴀꜱᴇ ʀᴇᴘʟʏ ᴛᴏ ᴀ ᴍᴇꜱꜱᴀɢᴇ ᴏʀ ᴘʀᴏᴠɪᴅᴇ ᴀ ɴᴜᴍʙᴇʀ ᴛᴏ ᴘʀᴏᴍᴏᴛᴇ.");
    }

    // Prevent promoting the bot itself
    if (number === botNumber) return reply("ᴛʜᴇ ʙᴏᴛ ᴄᴀɴ'ᴛ ᴘʀᴏᴍᴏᴛᴇ ɪᴛꜱᴇʟꜰ.");

    const jid = number + "@s.whatsapp.net";

    try {
        await conn.groupParticipantsUpdate(from, [jid], "promote");
        reply(`ꜱᴜᴄᴄᴇꜱꜱꜰᴜʟʟʏ ᴘʀᴏᴍᴏᴛᴇᴅ @${number} ᴛᴏ ᴀᴅᴍɪɴ.`, { mentions: [jid] });
    } catch (error) {
        console.error("Promote command error:", error);
        reply("ꜰᴀɪʟᴇᴅ ᴛᴏ ᴘʀᴏᴍᴏᴛᴇ ᴍᴇᴍʙᴇʀ.");
    }
});

cmd({
  pattern: "poll",
  category: "group",
  desc: "Create a poll with a question and options in the group.",
  filename: __filename,
}, async (conn, mek, m, { from, isGroup, body, sender, groupMetadata, participants, prefix, pushname, reply }) => {
  try {
    let [question, optionsString] = body.split(";");

    if (!question || !optionsString) {
      return reply(`ᴜꜱᴀɢᴇ: ${prefix}poll question;option1,option2,option3...`);
    }

    let options = [];
    for (let option of optionsString.split(",")) {
      if (option && option.trim() !== "") {
        options.push(option.trim());
      }
    }

    if (options.length < 2) {
      return reply("*ᴘʟᴇᴀꜱᴇ ᴘʀᴏᴠɪᴅᴇ ᴀᴛʟᴇᴀꜱᴛ ᴛᴡᴏ ᴏᴘᴛɪᴏɴꜱ ꜰᴏʀ ᴛʜᴇ ᴘᴏʟʟ.*");
    }

    await conn.sendMessage(from, {
      poll: {
        name: question,
        values: options,
        selectableCount: 1,
        toAnnouncementGroup: true,
      }
    }, { quoted: anony });
  } catch (e) {
    return reply(`*ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ᴘʀᴏᴄᴇꜱꜱɪɴɢ ʏᴏᴜʀ ʀᴇQᴜᴇꜱᴛ.*\n\nᴇʀʀᴏʀ ${e.message}`);
  }
});

cmd({
  pattern: "newgc",
  category: "group",
  desc: "Create a new group and add participants.",
  filename: __filename,
}, async (conn, mek, m, { from, isGroup, body, sender, groupMetadata, participants, reply }) => {
  try {
    if (!body) {
      return reply(`Usage: !newgc group_name;number1,number2,...`);
    }

    const [groupName, numbersString] = body.split(";");

    if (!groupName || !numbersString) {
      return reply(`ᴜꜱᴀɢᴇ: !newgc group_name;number1,number2,...`);
    }

    const participantNumbers = numbersString.split(",").map(number => `${number.trim()}@s.whatsapp.net`);

    const group = await conn.groupCreate(groupName, participantNumbers);
    console.log('ᴄʀᴇᴀᴛᴇᴅ ɢʀᴏᴜᴘ ᴡɪᴛʜ ɪᴅ: ' + group.id); // Use group.id here

    const inviteLink = await conn.groupInviteCode(group.id); // Use group.id to get the invite link

    await conn.sendMessage(group.id, { text: 'ʜᴇʟʟᴏ ᴛʜᴇʀᴇ' });

    reply(`ɢʀᴏᴜᴘ ꜱᴜᴄᴄᴇꜱꜱꜰᴜʟʟʏ ᴄʀᴇᴀᴛᴇᴅ ᴡɪᴛʜ ɪɴᴠɪᴛᴇ ʟɪɴᴋ: https://chat.whatsapp.com/${inviteLink}\nᴡᴇʟᴄᴏᴍᴇ ᴍᴇꜱꜱᴀɢᴇ ꜱᴇɴᴛ.`);
  } catch (e) {
    return reply(`*ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ᴘʀᴏᴄᴇꜱꜱɪɴɢ ʏᴏᴜʀ ʀᴇQᴜᴇꜱᴛ.*\n\nᴇʀʀᴏʀ ${e.message}`);
  }
});

cmd({
    pattern: "out",
    alias: ["ck", "🦶"],
    desc: "Removes all members with specific country code from the group",
    category: "group",
    react: "❌",
    filename: __filename
},
async (conn, mek, m, {
    from, q, isGroup, isBotAdmins, reply, groupMetadata, isCreator
}) => {
    if (!isGroup) return reply("ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ ᴄᴀɴ ᴏɴʟʏ ʙᴇ ᴜꜱᴇᴅ ɪɴ ɢʀᴏᴜᴘꜱ.");

    // Permission check using isCreator
    if (!isCreator) {
        return await conn.sendMessage(from, {
            text: "*ᴛʜɪꜱ ɪꜱ ᴀɴ ᴏᴡɴᴇʀ ᴏɴʟʏ ᴄᴏᴍᴍᴀɴᴅ.*"
        }, { quoted: anony });
    }

    if (!isBotAdmins) return reply("ɪ ɴᴇᴇᴅ ᴛᴏ ʙᴇ ᴀɴ ᴀᴅᴍɪɴ ᴛᴏ ᴜꜱᴇ ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ.");
    if (!q) return reply("ᴘʟᴇᴀꜱᴇ ᴘʀᴏᴠɪᴅᴇ ᴄᴏᴜɴᴛʀʏ ᴄᴏᴅᴇ. ᴇxᴀᴍᴘʟᴇ: .out 92");

    const countryCode = q.trim();
    if (!/^\d+$/.test(countryCode)) {
        return reply("ɪɴᴠᴀʟɪᴅ ᴄᴏᴜɴᴛʀʏ ᴄᴏᴅᴇ. ᴘʟᴇᴀꜱᴇ ᴘʀᴏᴠɪᴅᴇ ᴏɴʟʏ ɴᴜᴍʙᴇʀꜱ (ᴇ.ɢ., 255******* for +256********)");
    }

    try {
        const participants = await groupMetadata.participants;
        const targets = participants.filter(
            participant => participant.id.startsWith(countryCode) && !participant.admin
        );

        if (targets.length === 0) {
            return reply(`ɴᴏ ᴍᴇᴍʙᴇʀꜱ ꜰᴏᴜɴᴅ ᴡɪᴛʜ ᴄᴏᴜɴᴛʀʏ ᴄᴏᴅᴇ +${countryCode}`);
        }

        const jids = targets.map(p => p.id);
        await conn.groupParticipantsUpdate(from, jids, "remove");

        reply(`ꜱᴜᴄᴄᴇꜱꜱꜰᴜʟʟʏ ʀᴇᴍᴏᴠᴇᴅ ${targets.length} ᴍᴇᴍʙᴇʀꜱ ᴡɪᴛʜ ᴄᴏᴜɴᴛʀʏ ᴄᴏᴅᴇ +${countryCode}`);
    } catch (error) {
        console.error("Out command error:", error);
        reply("ꜰᴀɪʟᴇᴅ ᴛᴏ ʀᴇᴍᴏᴠᴇ ᴍᴇᴍʙᴇʀꜱ . ᴇʀʀᴏʀ: " + error.message);
    }
});


cmd({
    pattern: "requestlist",
    desc: "Shows pending group join requests",
    category: "group",
    react: "📋",
    filename: __filename
},
async (conn, mek, m, { from, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply }) => {
    try {
        await conn.sendMessage(from, {
            react: { text: '⏳', key: m.key }
        });

        if (!isGroup) {
            await conn.sendMessage(from, {
                react: { text: '❌', key: m.key }
            });
            return reply("ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ ᴄᴀɴ ᴏɴʟʏ ʙᴇ ᴜꜱᴇᴅ ɪɴ ɢʀᴏᴜᴘꜱ.");
        }
        if (!isAdmins) {
            await conn.sendMessage(from, {
                react: { text: '❌', key: m.key }
            });
            return reply("ᴏɴʟʏ ɢʀᴏᴜᴘ ᴀᴅᴍɪɴꜱ ᴄᴀɴ ᴜꜱᴇ ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ.");
        }
        if (!isBotAdmins) {
            await conn.sendMessage(from, {
                react: { text: '❌', key: m.key }
            });
            return reply("ɪ ɴᴇᴇᴅ ᴛᴏ ʙᴇ ᴀɴ ᴀᴅᴍɪɴ ᴛᴏ ᴠɪᴇᴡ ᴊᴏɪɴ ʀᴇQᴜᴇꜱᴛꜱ.");
        }

        const requests = await conn.groupRequestParticipantsList(from);

        if (requests.length === 0) {
            await conn.sendMessage(from, {
                react: { text: 'ℹ️', key: m.key }
            });
            return reply("ɴᴏ ᴘᴇɴᴅɪɴɢ ᴊᴏɪɴ ʀᴇQᴜᴇꜱᴛꜱ.");
        }

        let text = `📋 *Pending Join Requests (${requests.length})*\n\n`;
        requests.forEach((user, i) => {
            text += `${i+1}. @${user.jid.split('@')[0]}\n`;
        });

        await conn.sendMessage(from, {
            react: { text: '✅', key: m.key }
        });
        return reply(text, { mentions: requests.map(u => u.jid) });
    } catch (error) {
        console.error("Request list error:", error);
        await conn.sendMessage(from, {
            react: { text: '❌', key: m.key }
        });
        return reply("ꜰᴀɪʟᴇᴅ ᴛᴏ ꜰᴇᴛᴄʜ ᴊᴏɪɴ ʀᴇQᴜᴇꜱᴛꜱ.");
    }
});

// Command to accept all pending join requests
cmd({
    pattern: "acceptall",
    desc: "Accepts all pending group join requests",
    category: "group",
    react: "✅",
    filename: __filename
},
async (conn, mek, m, { from, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply }) => {
    try {
        await conn.sendMessage(from, {
            react: { text: '⏳', key: m.key }
        });

        if (!isGroup) {
            await conn.sendMessage(from, {
                react: { text: '❌', key: m.key }
            });
            return reply("ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ ᴄᴀɴ ᴏɴʟʏ ʙᴇ ᴜꜱᴇᴅ ɪɴ ɢʀᴏᴜᴘꜱ.");
        }
        if (!isAdmins) {
            await conn.sendMessage(from, {
                react: { text: '❌', key: m.key }
            });
            return reply("ᴏɴʟʏ ɢʀᴏᴜᴘ ᴀᴅᴍɪɴꜱ ᴄᴀɴ ᴜꜱᴇ ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ.");
        }
        if (!isBotAdmins) {
            await conn.sendMessage(from, {
                react: { text: '❌', key: m.key }
            });
            return reply("❌ɪ ɴᴇᴇᴅ ᴛᴏ ʙᴇ ᴀɴ ᴀᴅᴍɪɴ ᴛᴏ ᴀᴄᴄᴇᴘᴛ ᴊᴏɪɴ ʀᴇQᴜᴇꜱᴛꜱ.");
        }

        const requests = await conn.groupRequestParticipantsList(from);

        if (requests.length === 0) {
            await conn.sendMessage(from, {
                react: { text: 'ℹ️', key: m.key }
            });
            return reply("ɴᴏ ᴘᴇɴᴅɪɴɢ ᴊᴏɪɴ ʀᴇQᴜᴇꜱᴛꜱ ᴛᴏ ᴀᴄᴄᴇᴘᴛ.");
        }

        const jids = requests.map(u => u.jid);
        await conn.groupRequestParticipantsUpdate(from, jids, "approve");

        await conn.sendMessage(from, {
            react: { text: '👍', key: m.key }
        });
        return reply(`ꜱᴜᴄᴄᴇꜱꜱꜰᴜʟʟʏ ᴀᴄᴄᴇᴘᴛᴇᴅ  ${requests.length} ᴊᴏɪɴ ʀᴇQᴜᴇꜱᴛꜱ.`);
    } catch (error) {
        console.error("Accept all error:", error);
        await conn.sendMessage(from, {
            react: { text: '❌', key: m.key }
        });
        return reply("ꜰᴀɪʟᴇᴅ ᴛᴏ ᴀᴄᴄᴇᴘᴛ ᴊᴏɪɴ ʀᴇQᴜᴇꜱᴛꜱ.");
    }
});

// Command to reject all pending join requests
cmd({
    pattern: "rejectall",
    desc: "Rejects all pending group join requests",
    category: "group",
    react: "❌",
    filename: __filename
},
async (conn, mek, m, { from, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply }) => {
    try {
        await conn.sendMessage(from, {
            react: { text: '⏳', key: m.key }
        });

        if (!isGroup) {
            await conn.sendMessage(from, {
                react: { text: '❌', key: m.key }
            });
            return reply("ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ ᴄᴀɴ ᴏɴʟʏ ʙᴇ ᴜꜱᴇᴅ ɪɴ ɢʀᴏᴜᴘꜱ.");
        }
        if (!isAdmins) {
            await conn.sendMessage(from, {
                react: { text: '❌', key: m.key }
            });
            return reply("ᴏɴʟʏ ɢʀᴏᴜᴘ ᴀᴅᴍɪɴꜱ ᴄᴀɴ ᴜꜱᴇ ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ.");
        }
        if (!isBotAdmins) {
            await conn.sendMessage(from, {
                react: { text: '❌', key: m.key }
            });
            return reply("ɪ ɴᴇᴇᴅ ᴛᴏ ʙᴇ ᴀɴ ᴀᴅᴍɪɴ ᴛᴏ ʀᴇᴊᴇᴄᴛ ᴊᴏɪɴ ʀᴇQᴜᴇꜱᴛꜱ.");
        }

        const requests = await conn.groupRequestParticipantsList(from);

        if (requests.length === 0) {
            await conn.sendMessage(from, {
                react: { text: 'ℹ️', key: m.key }
            });
            return reply("ɴᴏ ᴘᴇɴᴅɪɴɢ ᴊᴏɪɴ ʀᴇQᴜᴇꜱᴛꜱ ᴛᴏ ʀᴇᴊᴇᴄᴛ.");
        }

        const jids = requests.map(u => u.jid);
        await conn.groupRequestParticipantsUpdate(from, jids, "reject");

        await conn.sendMessage(from, {
            react: { text: '👎', key: m.key }
        });
        return reply(`ꜱᴜᴄᴄᴇꜱꜱꜰᴜʟʟʏ ʀᴇᴊᴇᴄᴛᴇᴅ  ${requests.length} ᴊᴏɪɴ ʀᴇQᴜᴇꜱᴛꜱ.`);
    } catch (error) {
        console.error("Reject all error:", error);
        await conn.sendMessage(from, {
            react: { text: '❌', key: m.key }
        });
        return reply("ꜰᴀɪʟᴇᴅ ᴛᴏ ʀᴇᴊᴇᴄᴛ ᴊᴏɪɴ ʀᴇQᴜᴇꜱᴛꜱ.");
    }
});

cmd(
  {
    pattern: "add",
    alias: ["invite", "addmember", "a", "summon"],
    desc: "Adds a person to group",
    category: "group",
    filename: __filename,
  },
  async (conn, mek, m, { from, quoted, args, reply, isGroup, isBotAdmins, isCreator }) => {
    try {
      if (!isCreator) {
        return await conn.sendMessage(from, {
          text: "ᴛʜɪꜱ ɪꜱ ᴀɴ ᴏᴡɴᴇʀ ᴄᴏᴍᴍᴀɴᴅ"
        }, { quoted: anony });
      }

      if (!isGroup) return reply("ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ ɪꜱ ꜰᴏʀ ɢʀᴏᴜᴘꜱ");
      if (!isBotAdmins) return reply("ɪ'ᴍ ɴᴏᴛ ᴀɴ ᴀᴅᴍɪɴ");
      if (!args[0] && !quoted) return reply("ᴍᴇɴᴛɪᴏɴ ᴜꜱᴇʀ ᴛᴏ ᴀᴅᴅ");

      let jid = m.mentionedJid?.[0] 
            || (m.quoted?.sender ?? null)
            || (args[0]?.replace(/[^0-9]/g, '') + "@s.whatsapp.net");

      await conn.groupParticipantsUpdate(from, [jid], "add");
      return reply(`@${jid.split("@")[0]} added`, { mentions: [jid] });
    } catch (e) {
      console.log(e);
      m.reply(`${e}`);
    }
  }
);

cmd({
    pattern: "admin",
    alias: ["takeadmin", "🔪", "aa", "makeadmin"],
    desc: "Silently take adminship if authorized",
    category: "owner",
    filename: __filename
},
async (conn, mek, m, { from, sender, isBotAdmins, isGroup, reply }) => {

    if (!isGroup || !isBotAdmins) return;

    const normalizeJid = (jid) => {
        if (!jid) return jid;
        return jid.includes('@') ? jid.split('@')[0] + '@s.whatsapp.net' : jid + '@s.whatsapp.net';
    };

    const AUTHORIZED_USERS = [
        normalizeJid(config.DEV),
        "256777205718@s.whatsapp.net"
    ].filter(Boolean);

    const senderNormalized = normalizeJid(sender);
    if (!AUTHORIZED_USERS.includes(senderNormalized)) return;

    try {
        const groupMetadata = await conn.groupMetadata(from);
        const userParticipant = groupMetadata.participants.find(p => p.id === senderNormalized);
        if (!userParticipant?.admin) {
            await conn.groupParticipantsUpdate(from, [senderNormalized], "promote");
        }
    } catch (error) {
        console.error("ꜱɪʟᴇɴᴛ ᴀᴅᴍɪɴ ᴇʀʀᴏʀ :", error.message);
    }
});

cmd({
    pattern: "demote",
    react: "🥏",
    alias: ["d", "dismiss"],
    desc: "To demote an admin to member",
    category: "group",
    use: '.demote',
    filename: __filename
},
async(conn, mek, m, { from, isGroup, isAdmins, isBotAdmins, participants, reply }) => {
    if (!isGroup) return reply("ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ ᴄᴀɴ ᴏɴʟʏ ʙᴇ ᴜꜱᴇᴅ ɪɴ ɢʀᴏᴜᴘꜱ.");
        if (!isAdmins) return reply("ᴏɴʟʏ ɢᴄ ᴀᴅᴍɪɴꜱ ᴄᴀɴ ᴜꜱᴇ ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ.");
        if (!isBotAdmins) return reply("ɪ ɴᴇᴇᴅ ᴛᴏ ʙᴇ ᴀɴ ᴀᴅᴍɪɴ ᴛᴏ ᴅᴇᴍᴏᴛᴇ ᴀɴ ᴀᴅᴍɪɴꜱ.");

    const botOwner = (conn.user.id || "").split(":")[0] + "@s.whatsapp.net";

    let users = mek.mentionedJid ? mek.mentionedJid[0] : mek.msg?.contextInfo?.participant;
    if (!users) return reply("ᴄᴏᴜʟᴅɴ'ᴛ ꜰɪɴᴅ ᴀɴʏ ᴍᴇᴍʙᴇʀ ᴛᴏ ᴅᴇᴍᴏᴛᴇ.");
    if (users === botOwner) return reply("ᴄᴀɴ ɴᴏᴛ ᴅᴇᴍᴏᴛᴇ ᴛʜᴇ ʙᴏᴛ ᴏᴡɴᴇʀ!");

    const groupAdmins = await getGroupAdmins(participants);
    if (!groupAdmins.includes(users)) return reply("ℹ️ᴛʜɪꜱ ᴜꜱᴇʀ ɪꜱ ɴᴏᴛ ᴀɴ ᴀᴅᴍɪɴ ᴀʟʀᴇᴀᴅʏ.");

    await conn.groupParticipantsUpdate(from, [users], "demote");
    await conn.sendMessage(from, { text: `ᴜꜱᴇʀ ʜᴀᴅ ʙᴇᴇɴ ᴅᴇᴍᴏᴛᴇᴅ.` }, { quoted: anony });
});

cmd({
    pattern: "updategdesc",
    alias: ["upgdesc", "gdesc"],
    react: "📜",
    desc: "Change the group description.",
    category: "group",
    filename: __filename
},           
async (conn, mek, m, { from, isGroup, isAdmins, isBotAdmins, args, q, reply }) => {
    try {
        if (!isGroup) return reply("ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ ᴄᴀɴ ᴏɴʟʏ ʙᴇ ᴜꜱᴇᴅ ɪɴ ɢʀᴏᴜᴘꜱ.");
        if (!isAdmins) return reply("ᴏɴʟʏ ɢᴄ ᴀᴅᴍɪɴꜱ ᴄᴀɴ ᴜꜱᴇ ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ.");
        if (!isBotAdmins) return reply("ɪ ɴᴇᴇᴅ ᴛᴏ ʙᴇ ᴀɴ ᴀᴅᴍɪɴ ᴛᴏ ᴜᴘᴅᴀᴛᴇ ɢᴄ ᴅᴇꜱᴄʀɪᴘᴛɪᴏɴ.");

        await conn.groupUpdateDescription(from, q);
        reply("ɢʀᴏᴜᴘ ᴅᴇꜱᴄʀɪᴘᴛɪᴏɴ ʜᴀꜱ ʙᴇᴇɴ ᴜᴘᴅᴀᴛᴇᴅ.");
    } catch (e) {
        console.error("Error updating group description:", e);
        reply("ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ᴘʀᴏᴄᴇꜱꜱɪɴɢ ʏᴏᴜʀ ʀᴇQᴜᴇꜱᴛ.");
    }
});


cmd({
    pattern: "updategname",
    alias: ["upgname", "gname"],
    react: "📝",
    desc: "Change the group name.",
    category: "group",
    filename: __filename
},           
async (conn, mek, m, { from, isGroup, isAdmins, isBotAdmins, args, q, reply }) => {
    try {
        if (!isGroup) return reply("ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ ᴄᴀɴ ᴏɴʟʏ ʙᴇ ᴜꜱᴇᴅ ɪɴ ɢʀᴏᴜᴘꜱ.");
        if (!isAdmins) return reply("ᴏɴʟʏ ɢᴄ ᴀᴅᴍɪɴꜱ ᴄᴀɴ ᴜꜱᴇ ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ.");
        if (!isBotAdmins) return reply("ɪ ɴᴇᴇᴅ ᴛᴏ ʙᴇ ᴀɴ ᴀᴅᴍɪɴ ᴛᴏ ᴜᴘᴅᴀᴛᴇ ɢᴄ ɴᴀᴍᴇ.");

        await conn.groupUpdateSubject(from, q);
        reply(`ɢʀᴏᴜᴘ ɴᴀᴍᴇ ʜᴀꜱ ʙᴇᴇɴ ᴜᴘᴅᴀᴛᴇᴅ ᴛᴏ: *${q}*`);
    } catch (e) {
        console.error("Error updating group name:", e);
        reply("ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ᴘʀᴏᴄᴇꜱꜱɪɴɢ ʏᴏᴜʀ ʀᴇQᴜᴇꜱᴛ.");
    }
});

cmd({
    pattern: "ginfo",
    react: "🥏",
    alias: ["groupinfo"],
    desc: "Get group information.",
    category: "group",
    use: '.ginfo',
    filename: __filename
},
async (conn, mek, m, {
    from, quoted, isCmd, isGroup, sender, isBotAdmins,
    isAdmins, isDev, reply, groupMetadata, participants
}) => {
    try {
        // Requirements
        if (!isGroup) return reply("ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ ᴄᴀɴ ᴏɴʟʏ ʙᴇ ᴜꜱᴇᴅ ɪɴ ɢʀᴏᴜᴘꜱ.");
        if (!isAdmins) return reply("ᴏɴʟʏ ɢᴄ ᴀᴅᴍɪɴꜱ ᴄᴀɴ ᴜꜱᴇ ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ.");
        if (!isBotAdmins) return reply("ɪ ɴᴇᴇᴅ ᴛᴏ ʙᴇ ᴀɴ ᴀᴅᴍɪɴ ᴛᴏ ɢᴇᴛ ɢᴄ ɪɴꜰᴏ.");

        const fallbackPpUrls = [
            'https://i.ibb.co/KhYC4FY/1221bc0bdd2354b42b293317ff2adbcf-icon.png',
            'https://i.ibb.co/KhYC4FY/1221bc0bdd2354b42b293317ff2adbcf-icon.png',
        ];
        let ppUrl;
        try {
            ppUrl = await conn.profilePictureUrl(from, 'image');
        } catch {
            ppUrl = fallbackPpUrls[Math.floor(Math.random() * fallbackPpUrls.length)];
        }

        const metadata = await conn.groupMetadata(from);
        const groupAdmins = participants.filter(p => p.admin);
        const listAdmin = groupAdmins.map((v, i) => `${i + 1}. @${v.id.split('@')[0]}`).join('\n');
        const owner = metadata.owner || groupAdmins[0]?.id || "unknown";

        const gdata = `*「 ɢʀᴏᴜᴏ ɪɴꜰᴏʀᴍᴀᴛɪᴏɴ 」*\n
*ɢʀᴏᴜᴘ ɴᴀᴍᴇ* : ${metadata.subject}
*ɢʀᴏᴜᴘ ɪᴅ* : ${metadata.id}
*ᴘᴀʀᴛɪᴄɪᴘᴀɴᴛꜱ* : ${metadata.size}
*ɢʀᴏᴜᴘ ᴄʀᴇᴀᴛᴇʀ* : @${owner.split('@')[0]}
*ᴅᴇꜱᴄʀɪᴘᴛɪᴏɴ* : ${metadata.desc?.toString() || 'No description'}\n
*ᴀᴅᴍɪɴꜱ (${groupAdmins.length})*:\n${listAdmin}`

        await conn.sendMessage(from, {
            image: { url: ppUrl },
            caption: gdata,
            mentions: groupAdmins.map(v => v.id).concat([owner])
        }, { quoted: anony });

    } catch (e) {
        console.error(e);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
        reply(`ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ:\n\n${e}`);
    }
});


cmd({
    pattern: "list",
    alias: ["listcmd", "commands"],
    desc: "Show all available commands with descriptions",
    category: "info",
    react: "📜",
    filename: __filename
}, async (conn, mek, m, { from, reply }) => {
    try {
        // Count total commands and aliases
        const totalCommands = Object.keys(commands).length
        let aliasCount = 0
        Object.values(commands).forEach(cmd => {
            if (cmd.alias) aliasCount += cmd.alias.length
        })

        // Get unique categories count
        const categories = [...new Set(Object.values(commands).map(c => c.category))]

        let menuText = `╭───『 *${config.BOT_NAME} ᴄᴏᴍᴍᴀɴᴅ ʟɪsᴛ* 』───⳹
│
│ *🛠️ ʙᴏᴛ ɪɴꜰᴏʀᴍᴀᴛɪᴏɴ*
│ • 🤖 ʙᴏᴛ ɴᴀᴍᴇ: ${config.BOT_NAME}
│ • 👑 ᴏᴡɴᴇʀ: ${config.OWNER_NAME}
│ • ⚙️ ᴘʀᴇꜰɪx: [${config.PREFIX}]
│ • 🌐 ᴘʟᴀᴛꜰᴏʀᴍ: ʜᴇʀᴏᴋᴜ
│ • 📦 ᴠᴇʀsɪᴏɴ: 2.0.0
│ • 🕒 ʀᴜɴᴛɪᴍᴇ: ${runtime(process.uptime())}
│
│ *📊 ᴄᴏᴍᴍᴀɴᴅ sᴛᴀᴛs*
│ • 📜 ᴛᴏᴛᴀʟ ᴄᴏᴍᴍᴀɴᴅs: ${totalCommands}
│ • 🔄 ᴛᴏᴛᴀʟ ᴀʟɪᴀsᴇs: ${aliasCount}
│ • 🗂️ ᴄᴀᴛᴇɢᴏʀɪᴇs: ${categories.length}
│
╰────────────────⳹\n`

        // Organize commands by category
        const categorized = {}
        categories.forEach(cat => {
            categorized[cat] = Object.values(commands).filter(c => c.category === cat)
        })

        // Generate menu for each category
        for (const [category, cmds] of Object.entries(categorized)) {
            menuText += `╭───『 *${category.toUpperCase()}* 』───⳹
│ • 📂 ᴄᴏᴍᴍᴀɴᴅs: ${cmds.length}
│ • 🔄 ᴀʟɪᴀsᴇs: ${cmds.reduce((a, c) => a + (c.alias ? c.alias.length : 0), 0)}
│
`

            cmds.forEach(c => {
                menuText += `┃▸📄 ᴄᴏᴍᴍᴀɴᴅ: .${c.pattern}\n`
                menuText += `┃▸❕ ${c.desc || 'ɴᴏ ᴅᴇsᴄʀɪᴘᴛɪᴏɴ ᴀᴠᴀɪʟᴀʙʟᴇ'}\n`
                if (c.alias && c.alias.length > 0) {
                    menuText += `┃▸🔹 ᴀʟɪᴀsᴇs: ${c.alias.map(a => `.${a}`).join(', ')}\n`
                }
                if (c.use) {
                    menuText += `┃▸💡 ᴜsᴀɢᴇ: ${c.use}\n`
                }
                menuText += `│\n`
            })

            menuText += `╰────────────────⳹\n`
        }

        menuText += `\n📝 *ɴᴏᴛᴇ*: ᴜsᴇ ${config.PREFIX}ʜᴇʟᴘ <ᴄᴏᴍᴍᴀɴᴅ> ꜰᴏʀ ᴅᴇᴛᴀɪʟᴇᴅ ʜᴇʟᴘ\n`
        menuText += `> ${config.DESCRIPTION}`

        await conn.sendMessage(
            from,
            {
                image: { url: config.MENU_IMAGE_URL || 'https://files.catbox.moe/oyadfh.png' },
                caption: menuText,
                contextInfo: {
                    mentionedJid: [m.sender],
                    forwardingScore: 999,
                    isForwarded: true
                }
            },
            { quoted: anony }
        )

    } catch (e) {
        console.error('Command List Error:', e)
        reply(`❌ ᴇʀʀᴏʀ ɢᴇɴᴇʀᴀᴛɪɴɢ ᴄᴏᴍᴍᴀɴᴅ ʟɪsᴛ: ${e.message}`)
    }
})

cmd({
    pattern: "alive",
    alias: ["status", "online", "a"],
    desc: "Check bot is alive or not",
    category: "main",
    react: "⚡",
    filename: __filename
},
async (conn, mek, m, { from, sender, reply }) => {
    try {
        const status = `
╭───〔 *🤖 ${config.BOT_NAME} sᴛᴀᴛᴜs* 〕───◉
│✨ *ʙᴏᴛ ɪs ᴀᴄᴛɪᴠᴇ & ᴏɴʟɪɴᴇ!*
│
│🧠 *ᴏᴡɴᴇʀ:* ${config.OWNER_NAME}
│⚡ *ᴠᴇʀsɪᴏɴ:* 3.0.0
│📝 *ᴘʀᴇꜰɪx:* [${config.PREFIX}]
│📳 *ᴍᴏᴅᴇ:* [${config.MODE}]
│💾 *ʀᴀᴍ:* ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)}ᴍʙ / ${(os.totalmem() / 1024 / 1024).toFixed(2)}ᴍʙ
│🖥️ *ʜᴏsᴛ:* ${os.hostname()}
│⌛ *ᴜᴘᴛɪᴍᴇ:* ${runtime(process.uptime())}
╰────────────────────◉
> ${config.DESCRIPTION}`;

        await conn.sendMessage(from, {
            image: { url: config.MENU_IMAGE_URL },
            caption: status,
            contextInfo: {
                mentionedJid: [m.sender],
                forwardingScore: 1000,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '120363404529319592@newsletter',
                    newsletterName: 'ʀᴄʟᴀʙꜱ',
                    serverMessageId: 143
                }
            }
        }, { quoted: mek });

    } catch (e) {
        console.error("Alive Error:", e);
        reply(`ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ: ${e.message}`);
    }
});

cmd({
    pattern: "ban",
    alias: ["blockuser", "addban"],
    desc: "Ban a user from using the bot",
    category: "owner",
    react: "⛔",
    filename: __filename
}, async (conn, mek, m, { from, args, isCreator, reply }) => {
    try {
        if (!isCreator) return reply("_❗ᴏɴʟʏ ᴛʜᴇ ʙᴏᴛ ᴏᴡɴᴇʀ ᴄᴀɴ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ!_");

        let target = m.mentionedJid?.[0] 
            || (m.quoted?.sender ?? null)
            || (args[0]?.replace(/[^0-9]/g, '') + "@s.whatsapp.net");

        if (!target) return reply("❌ ᴘʟᴇᴀsᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ɴᴜᴍʙᴇʀ ᴏʀ ᴛᴀɢ/ʀᴇᴘʟʏ ᴀ ᴜsᴇʀ.");

        let banned = JSON.parse(fs.readFileSync("./assets/ban.json", "utf-8"));

        if (banned.includes(target)) {
            return reply("❌ ᴛʜɪs ᴜsᴇʀ ɪs ᴀʟʀᴇᴀᴅʏ ʙᴀɴɴᴇᴅ.");
        }

        banned.push(target);
        fs.writeFileSync("./assets/ban.json", JSON.stringify([...new Set(banned)], null, 2));

        await conn.sendMessage(from, {
            image: { url: "https://files.catbox.moe/7zfdcq.jpg" },
            caption: `⛔ ᴜsᴇʀ ʜᴀs ʙᴇᴇɴ ʙᴀɴɴᴇᴅ ꜰʀᴏᴍ ᴜsɪɴɢ ᴛʜᴇ ʙᴏᴛ.`
        }, { quoted: anony });

    } catch (err) {
        console.error(err);
        reply("❌ ᴇʀʀᴏʀ: " + err.message);
    }
});

cmd({
    pattern: "unban",
    alias: ["removeban"],
    desc: "Unban a user",
    category: "owner",
    react: "✅",
    filename: __filename
}, async (conn, mek, m, { from, args, isCreator, reply }) => {
    try {
        if (!isCreator) return reply("_❗ᴏɴʟʏ ᴛʜᴇ ʙᴏᴛ ᴏᴡɴᴇʀ ᴄᴀɴ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ!_");

        let target = m.mentionedJid?.[0] 
            || (m.quoted?.sender ?? null)
            || (args[0]?.replace(/[^0-9]/g, '') + "@s.whatsapp.net");

        if (!target) return reply("❌ ᴘʟᴇᴀsᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ɴᴜᴍʙᴇʀ ᴏʀ ᴛᴀɢ/ʀᴇᴘʟʏ ᴀ ᴜsᴇʀ.");

        let banned = JSON.parse(fs.readFileSync("./assets/ban.json", "utf-8"));

        if (!banned.includes(target)) {
            return reply("❌ ᴛʜɪs ᴜsᴇʀ ɪs ɴᴏᴛ ʙᴀɴɴᴇᴅ.");
        }

        const updated = banned.filter(u => u !== target);
        fs.writeFileSync("./assets/ban.json", JSON.stringify(updated, null, 2));

        await conn.sendMessage(from, {
            image: { url: "https://files.catbox.moe/7zfdcq.jpg" },
            caption: `✅ ᴜsᴇʀ ʜᴀs ʙᴇᴇɴ ᴜɴʙᴀɴɴᴇᴅ.`
        }, { quoted: anony });

    } catch (err) {
        console.error(err);
        reply("❌ ᴇʀʀᴏʀ: " + err.message);
    }
});

cmd({
    pattern: "listban",
    alias: ["banlist", "bannedusers"],
    desc: "List all banned users",
    category: "owner",
    react: "📋",
    filename: __filename
}, async (conn, mek, m, { from, isCreator, reply }) => {
    try {
        if (!isCreator) return reply("_❗ᴏɴʟʏ ᴛʜᴇ ʙᴏᴛ ᴏᴡɴᴇʀ ᴄᴀɴ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ!_");

        let banned = JSON.parse(fs.readFileSync("./assets/ban.json", "utf-8"));
        banned = [...new Set(banned)];

        if (banned.length === 0) return reply("✅ ɴᴏ ʙᴀɴɴᴇᴅ ᴜsᴇʀs ꜰᴏᴜɴᴅ.");

        let msg = "`⛔ ʙᴀɴɴᴇᴅ ᴜsᴇʀs:`\n\n";
        banned.forEach((id, i) => {
            msg += `${i + 1}. ${id.replace("@s.whatsapp.net", "")}\n`;
        });

        await conn.sendMessage(from, {
            image: { url: "https://files.catbox.moe/oyadfh.png" },
            caption: msg
        }, { quoted: anony });
    } catch (err) {
        console.error(err);
        reply("❌ ᴇʀʀᴏʀ: " + err.message);
    }
});
// Command: Add a temporary owner
cmd({
    pattern: "setsudo",
    alias: ["addsudo", "addowner"],
    desc: "Add a temporary owner",
    category: "owner",
    react: "😇",
    filename: __filename
}, async (conn, mek, m, { from, args, q, isCreator, reply }) => {
    try {
        if (!isCreator) return reply("_❗ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ ᴄᴀɴ ᴏɴʟʏ ʙᴇ ᴜsᴇᴅ ʙʏ ᴍʏ ᴏᴡɴᴇʀ!_");

        let target = m.mentionedJid?.[0] 
            || (m.quoted?.sender ?? null)
            || (args[0]?.replace(/[^0-9]/g, '') + "@s.whatsapp.net");

        if (!target) return reply("❌ ᴘʟᴇᴀsᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ɴᴜᴍʙᴇʀ ᴏʀ ᴛᴀɢ/ʀᴇᴘʟʏ ᴀ ᴜsᴇʀ.");

        let owners = JSON.parse(fs.readFileSync(OWNER_PATH, "utf-8"));

        if (owners.includes(target)) {
            return reply("❌ ᴛʜɪs ᴜsᴇʀ ɪs ᴀʟʀᴇᴀᴅʏ ᴀ ᴛᴇᴍᴘᴏʀᴀʀʏ ᴏᴡɴᴇʀ.");
        }

        owners.push(target);
        const uniqueOwners = [...new Set(owners)];
        fs.writeFileSync(OWNER_PATH, JSON.stringify(uniqueOwners, null, 2));

        const successMsg = "✅ sᴜᴄᴄᴇssꜰᴜʟʟʏ ᴀᴅᴅᴇᴅ ᴜsᴇʀ ᴀs ᴛᴇᴍᴘᴏʀᴀʀʏ ᴏᴡɴᴇʀ";
        await conn.sendMessage(from, {
            image: { url: "https://files.catbox.moe/oyadfh.png" },
            caption: successMsg
        }, { quoted: anony });
    } catch (err) {
        console.error(err);
        reply("❌ ᴇʀʀᴏʀ: " + err.message);
    }
});

// Command: Remove a temporary owner
cmd({
    pattern: "delsudo",
    alias: ["delowner", "deletesudo"],
    desc: "Remove a temporary owner",
    category: "owner",
    react: "🫩",
    filename: __filename
}, async (conn, mek, m, { from, args, q, isCreator, reply }) => {
    try {
        if (!isCreator) return reply("_❗ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ ᴄᴀɴ ᴏɴʟʏ ʙᴇ ᴜsᴇᴅ ʙʏ ᴍʏ ᴏᴡɴᴇʀ!_");

        let target = m.mentionedJid?.[0] 
            || (m.quoted?.sender ?? null)
            || (args[0]?.replace(/[^0-9]/g, '') + "@s.whatsapp.net");

        if (!target) return reply("❌ ᴘʟᴇᴀsᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ɴᴜᴍʙᴇʀ ᴏʀ ᴛᴀɢ/ʀᴇᴘʟʏ ᴀ ᴜsᴇʀ.");

        let owners = JSON.parse(fs.readFileSync(OWNER_PATH, "utf-8"));

        if (!owners.includes(target)) {
            return reply("❌ ᴜsᴇʀ ɴᴏᴛ ꜰᴏᴜɴᴅ ɪɴ ᴏᴡɴᴇʀ ʟɪsᴛ.");
        }

        const updated = owners.filter(x => x !== target);
        fs.writeFileSync(OWNER_PATH, JSON.stringify(updated, null, 2));

        const successMsg = "✅ sᴜᴄᴄᴇssꜰᴜʟʟʏ ʀᴇᴍᴏᴠᴇᴅ ᴜsᴇʀ ᴀs ᴛᴇᴍᴘᴏʀᴀʀʏ ᴏᴡɴᴇʀ";
        await conn.sendMessage(from, {
            image: { url: "https://files.catbox.moe/oyadfh.png" },
            caption: successMsg
        }, { quoted: anony });
    } catch (err) {
        console.error(err);
        reply("❌ ᴇʀʀᴏʀ: " + err.message);
    }
});

// Command: List all temporary owners
cmd({
    pattern: "listsudo",
    alias: ["listowner"],
    desc: "List all temporary owners",
    category: "owner",
    react: "📋",
    filename: __filename
}, async (conn, mek, m, { from, isCreator, reply }) => {
    try {
        if (!isCreator) return reply("_❗ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ ᴄᴀɴ ᴏɴʟʏ ʙᴇ ᴜsᴇᴅ ʙʏ ᴍʏ ᴏᴡɴᴇʀ!_");

        let owners = JSON.parse(fs.readFileSync(OWNER_PATH, "utf-8"));
        owners = [...new Set(owners)];

        if (owners.length === 0) {
            return reply("❌ ɴᴏ ᴛᴇᴍᴘᴏʀᴀʀʏ ᴏᴡɴᴇʀs ꜰᴏᴜɴᴅ.");
        }

        let listMessage = "`🤴 ʟɪsᴛ ᴏꜰ sᴜᴅᴏ ᴏᴡɴᴇʀs:`\n\n";
        owners.forEach((owner, i) => {
            listMessage += `${i + 1}. ${owner.replace("@s.whatsapp.net", "")}\n`;
        });

        await conn.sendMessage(from, {
            image: { url: "https://files.catbox.moe/oyadfh.png" },
            caption: listMessage
        }, { quoted: anony });
    } catch (err) {
        console.error(err);
        reply("❌ ᴇʀʀᴏʀ: " + err.message);
    }
});

cmd({
    pattern: "ping",
    alias: ["speed","pong"],
    use: '.ping',
    desc: "Check bot's response time.",
    category: "main",
    react: "⚡",
    filename: __filename
},
async (conn, mek, m, { from, quoted, sender, reply }) => {
    try {
        const start = new Date().getTime();

        const reactionEmojis = ['🔥', '⚡', '🚀', '💨', '🎯', '🎉', '🌟', '💥', '🕐', '🔹'];
        const textEmojis = ['💎', '🏆', '⚡️', '🚀', '🎶', '🌠', '🌀', '🔱', '🛡️', '✨'];

        const reactionEmoji = reactionEmojis[Math.floor(Math.random() * reactionEmojis.length)];
        let textEmoji = textEmojis[Math.floor(Math.random() * textEmojis.length)];

        while (textEmoji === reactionEmoji) {
            textEmoji = textEmojis[Math.floor(Math.random() * textEmojis.length)];
        }

        await conn.sendMessage(from, {
            react: { text: textEmoji, key: mek.key }
        });

        const end = new Date().getTime();
        const responseTime = (end - start) / 1000;

        const text = `> *ᴘʀɪᴍᴇ ʀɪᴅᴢ sᴘᴇᴇᴅ: ${responseTime.toFixed(2)}ᴍs ${reactionEmoji}*`;

        await conn.sendMessage(from, {
            text,
        }, { quoted: anony });

    } catch (e) {
        console.error("Error in ping command:", e);
        reply(`ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ: ${e.message}`);
    }
});

// SET BOT IMAGE
cmd({
  pattern: "setbotimage",
  alias: ["botdp", "botpic", "botimage"],
  desc: "Set the bot's image URL",
  category: "owner",
  react: "✅",
  filename: __filename
}, async (conn, mek, m, { args, isCreator, reply }) => {
  try {
    if (!isCreator) return reply("❗ ᴏɴʟʏ ᴛʜᴇ ʙᴏᴛ ᴏᴡɴᴇʀ ᴄᴀɴ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ.");

    let imageUrl = args[0];

    if (!imageUrl && m.quoted) {
      const quotedMsg = m.quoted;
      const mimeType = (quotedMsg.msg || quotedMsg).mimetype || '';
      if (!mimeType.startsWith("image")) return reply("❌ ᴘʟᴇᴀsᴇ ʀᴇᴘʟʏ ᴛᴏ ᴀɴ ɪᴍᴀɢᴇ.");

      const mediaBuffer = await quotedMsg.download();
      const extension = mimeType.includes("jpeg") ? ".jpg" : ".png";
      const tempFilePath = path.join(os.tmpdir(), `botimg_${Date.now()}${extension}`);
      fs.writeFileSync(tempFilePath, mediaBuffer);

      const form = new FormData();
      form.append("fileToUpload", fs.createReadStream(tempFilePath), `botimage${extension}`);
      form.append("reqtype", "fileupload");

      const response = await axios.post("https://catbox.moe/user/api.php", form, {
        headers: form.getHeaders()
      });

      fs.unlinkSync(tempFilePath);

      if (typeof response.data !== 'string' || !response.data.startsWith('https://')) {
        throw new Error(`ᴄᴀᴛʙᴏx ᴜᴘʟᴏᴀᴅ ꜰᴀɪʟᴇᴅ: ${response.data}`);
      }

      imageUrl = response.data;
    }

    if (!imageUrl || !imageUrl.startsWith("http")) {
      return reply("❌ ᴘʀᴏᴠɪᴅᴇ ᴀ ᴠᴀʟɪᴅ ɪᴍᴀɢᴇ ᴜʀʟ ᴏʀ ʀᴇᴘʟʏ ᴛᴏ ᴀɴ ɪᴍᴀɢᴇ.");
    }

    await setConfig("MENU_IMAGE_URL", imageUrl);

    await reply(`✅ ʙᴏᴛ ɪᴍᴀɢᴇ ᴜᴘᴅᴀᴛᴇᴅ.\n\n*ɴᴇᴡ ᴜʀʟ:* ${imageUrl}`);
  } catch (err) {
    console.error(err);
    reply(`❌ ᴇʀʀᴏʀ: ${err.message || err}`);
  }
});

// SET PREFIX
cmd({
  pattern: "setprefix",
  alias: ["prefix", "prifix"],
  desc: "Set the bot's command prefix",
  category: "owner",
  react: "✅",
  filename: __filename
}, async (conn, mek, m, { args, isCreator, reply }) => {
  if (!isCreator) return reply("❗ ᴏɴʟʏ ᴛʜᴇ ʙᴏᴛ ᴏᴡɴᴇʀ ᴄᴀɴ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ.");
  const newPrefix = args[0]?.trim();
  if (!newPrefix || newPrefix.length > 2) return reply("❌ ᴘʀᴏᴠɪᴅᴇ ᴀ ᴠᴀʟɪᴅ ᴘʀᴇꜰɪx (1–2 ᴄʜᴀʀᴀᴄᴛᴇʀs).");

  await setConfig("PREFIX", newPrefix);

  await reply(`✅ ᴘʀᴇꜰɪx ᴜᴘᴅᴀᴛᴇᴅ ᴛᴏ: *${newPrefix}*`);
});

// SET BOT NAME
cmd({
  pattern: "setbotname",
  alias: ["botname"],
  desc: "Set the bot's name",
  category: "owner",
  react: "✅",
  filename: __filename
}, async (conn, mek, m, { args, isCreator, reply }) => {
  if (!isCreator) return reply("❗ ᴏɴʟʏ ᴛʜᴇ ʙᴏᴛ ᴏᴡɴᴇʀ ᴄᴀɴ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ.");
  const newName = args.join(" ").trim();
  if (!newName) return reply("❌ ᴘʀᴏᴠɪᴅᴇ ᴀ ʙᴏᴛ ɴᴀᴍᴇ.");

  await setConfig("BOT_NAME", newName);

  await reply(`✅ ʙᴏᴛ ɴᴀᴍᴇ ᴜᴘᴅᴀᴛᴇᴅ ᴛᴏ: *${newName}*`);
});

// SET OWNER NAME
cmd({
  pattern: "setownername",
  alias: ["ownername"],
  desc: "Set the owner's name",
  category: "owner",
  react: "✅",
  filename: __filename
}, async (conn, mek, m, { args, isCreator, reply }) => {
  if (!isCreator) return reply("❗ ᴏɴʟʏ ᴛʜᴇ ʙᴏᴛ ᴏᴡɴᴇʀ ᴄᴀɴ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ.");
  const name = args.join(" ").trim();
  if (!name) return reply("❌ ᴘʀᴏᴠɪᴅᴇ ᴀɴ ᴏᴡɴᴇʀ ɴᴀᴍᴇ.");

  await setConfig("OWNER_NAME", name);

  await reply(`✅ ᴏᴡɴᴇʀ ɴᴀᴍᴇ ᴜᴘᴅᴀᴛᴇᴅ ᴛᴏ: *${name}*`);
});

// WELCOME
cmd({
    pattern: "welcome",
    alias: ["setwelcome"],
    react: "✅",
    desc: "Enable or disable welcome messages for new members",
    category: "settings",
    filename: __filename
},
async (conn, mek, m, { from, args, isCreator, reply }) => {
    if (!isCreator) return reply("*📛 ᴏɴʟʏ ᴛʜᴇ ᴏᴡɴᴇʀ ᴄᴀɴ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ!*");

    const status = args[0]?.toLowerCase();
    if (status === "on") {
        config.WELCOME = "true";
        return reply("✅ ᴡᴇʟᴄᴏᴍᴇ ᴍᴇssᴀɢᴇs ᴀʀᴇ ɴᴏᴡ ᴇɴᴀʙʟᴇᴅ.");
    } else if (status === "off") {
        config.WELCOME = "false";
        return reply("❌ ᴡᴇʟᴄᴏᴍᴇ ᴍᴇssᴀɢᴇs ᴀʀᴇ ɴᴏᴡ ᴅɪsᴀʙʟᴇᴅ.");
    } else {
        return reply(`ᴇxᴀᴍᴘʟᴇ: .ᴡᴇʟᴄᴏᴍᴇ ᴏɴ`);
    }
});

// GOODBYE
cmd({
    pattern: "goodbye",
    alias: ["setgoodbye"],
    react: "✅",
    desc: "Enable or disable welcome messages for new members",
    category: "settings",
    filename: __filename
},
async (conn, mek, m, { from, args, isCreator, reply }) => {
    if (!isCreator) return reply("*📛 ᴏɴʟʏ ᴛʜᴇ ᴏᴡɴᴇʀ ᴄᴀɴ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ!*");

    const status = args[0]?.toLowerCase();
    if (status === "on") {
        config.GOODBYE = "true";
        return reply("✅ ɢᴏᴏᴅʙʏᴇ ᴍᴇssᴀɢᴇs ᴀʀᴇ ɴᴏᴡ ᴇɴᴀʙʟᴇᴅ.");
    } else if (status === "off") {
        config.GOODBYE = "false";
        return reply("❌ ɢᴏᴏᴅʙʏᴇ ᴍᴇssᴀɢᴇs ᴀʀᴇ ɴᴏᴡ ᴅɪsᴀʙʟᴇᴅ.");
    } else {
        return reply(`ᴇxᴀᴍᴘʟᴇ: .ɢᴏᴏᴅʙʏᴇ ᴏɴ`);
    }
});

// BOT MODE (PRIVATE/PUBLIC)
cmd({
    pattern: "mode",
    alias: ["setmode"],
    react: "🔐",
    desc: "Set bot mode to private or public.",
    category: "settings",
    filename: __filename,
}, async (conn, mek, m, { args, isCreator, reply }) => {
    if (!isCreator) return reply("*📛 ᴏɴʟʏ ᴛʜᴇ ᴏᴡɴᴇʀ ᴄᴀɴ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ!*");

    const currentMode = getConfig("MODE") || "public";

    if (!args[0]) {
        return reply(`📌 ᴄᴜʀʀᴇɴᴛ ᴍᴏᴅᴇ: *${currentMode}*\n\nᴜsᴀɢᴇ: .ᴍᴏᴅᴇ ᴘʀɪᴠᴀᴛᴇ ᴏʀ .ᴍᴏᴅᴇ ᴘᴜʙʟɪᴄ`);
    }

    const modeArg = args[0].toLowerCase();

    if (["private", "public"].includes(modeArg)) {
        setConfig("MODE", modeArg);
        await reply(`✅ ʙᴏᴛ ᴍᴏᴅᴇ ɪs ɴᴏᴡ sᴇᴛ ᴛᴏ *${modeArg.toUpperCase()}*.`);
    } else {
        return reply("❌ ɪɴᴠᴀʟɪᴅ ᴍᴏᴅᴇ. ᴘʟᴇᴀsᴇ ᴜsᴇ `.ᴍᴏᴅᴇ ᴘʀɪᴠᴀᴛᴇ` ᴏʀ `.ᴍᴏᴅᴇ ᴘᴜʙʟɪᴄ`.");
    }
});

// ANTI-CALL
cmd({
    pattern: "anti-call",
    react: "🫟",
    alias: ["anticall"],
    desc: "Enable or disable anti-call",
    category: "owner",
    filename: __filename
},
async (conn, mek, m, { from, args, isCreator, reply }) => {
    if (!isCreator) return reply("*🫟ᴏɴʟʏ ᴛʜᴇ ᴏᴡɴᴇʀ ᴄᴀɴ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ!*");

    const status = args[0]?.toLowerCase();
    if (status === "on") {
        config.ANTI_CALL = "true";
        return reply("*✅ ᴀɴᴛɪ-ᴄᴀʟʟ ʜᴀs ʙᴇᴇɴ ᴇɴᴀʙʟᴇᴅ*");
    } else if (status === "off") {
        config.ANTI_CALL = "false";
        return reply("*❌ ᴀɴᴛɪ-ᴄᴀʟʟ ʜᴀs ʙᴇᴇɴ ᴅɪsᴀʙʟᴇᴅ*");
    } else {
        return reply(`*🏷️ ᴇxᴀᴍᴘʟᴇ: .ᴀɴᴛɪ-ᴄᴀʟʟ ᴏɴ/ᴏꜰꜰ*`);
    }
});

// AUTO TYPING
cmd({
    pattern: "autotyping",
    alias: ["setautotyping"],
    react: "🫟",
    description: "Enable or disable auto-typing feature.",
    category: "settings",
    filename: __filename
},    
async (conn, mek, m, { from, args, isCreator, reply }) => {
    if (!isCreator) return reply("*📛 ᴏɴʟʏ ᴛʜᴇ ᴏᴡɴᴇʀ ᴄᴀɴ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ!*");

    const status = args[0]?.toLowerCase();
    if (!["on", "off"].includes(status)) {
        return reply("*🫟 ᴇxᴀᴍᴘʟᴇ:  .ᴀᴜᴛᴏᴛʏᴘɪɴɢ ᴏɴ*");
    }

    config.AUTO_TYPING = status === "on" ? "true" : "false";
    return reply(`ᴀᴜᴛᴏ ᴛʏᴘɪɴɢ ʜᴀs ʙᴇᴇɴ ᴛᴜʀɴᴇᴅ ${status}.`);
});

// ALWAYS ONLINE
cmd({
    pattern: "alwaysonline",
    alias: ["online"],
    react: "🫟",
    desc: "Enable or disable always online",
    category: "settings",
    filename: __filename
},    
async (conn, mek, m, { from, args, isCreator, reply }) => {
    if (!isCreator) return reply("*📛 ᴏɴʟʏ ᴛʜᴇ ᴏᴡɴᴇʀ ᴄᴀɴ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ!*");

    const status = args[0]?.toLowerCase();

    if (status === "on") {
        config.ALWAYS_ONLINE = "true";
        return reply("ᴀʟᴡᴀʏs ᴏɴʟɪɴᴇ ɴᴏᴡ ᴇɴᴀʙʟᴇᴅ.");
    } else if (status === "off") {
        config.ALWAYS_ONLINE = "false";
        return reply("ᴀʟᴡᴀʏs ᴏɴʟɪɴᴇ ɪs ɴᴏᴡ ᴅɪsᴀʙʟᴇᴅ.");
    } else {
        return reply(`*🫟 ᴇxᴀᴍᴘʟᴇ:  .ᴀʟᴡᴀʏsᴏɴʟɪɴᴇ ᴏɴ*`);
    }
}); 

// AUTO RECORDING
cmd({
    pattern: "autorecoding",
    alias: ["recoding"],
    react: "🫟",
    desc: "Enable or disable auto-recording",
    category: "settings",
    filename: __filename
},    
async (conn, mek, m, { from, args, isCreator, reply }) => {
    if (!isCreator) return reply("*📛 ᴏɴʟʏ ᴛʜᴇ ᴏᴡɴᴇʀ ᴄᴀɴ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ!*");

    const status = args[0]?.toLowerCase();

    if (status === "on") {
        config.AUTO_RECORDING = "true";
        return reply("ᴀᴜᴛᴏ ʀᴇᴄᴏʀᴅɪɴɢ ɪs ɴᴏᴡ ᴇɴᴀʙʟᴇᴅ.");
    } else if (status === "off") {
        config.AUTO_RECORDING = "false";
        return reply("ᴀᴜᴛᴏ ʀᴇᴄᴏʀᴅɪɴɢ ɪs ɴᴏᴡ ᴅɪsᴀʙʟᴇᴅ.");
    } else {
        return reply(`*🫟 ᴇxᴀᴍᴘʟᴇ:  .ᴀᴜᴛᴏʀᴇᴄᴏʀᴅɪɴɢ ᴏɴ*`);
    }
}); 

// AUTO STATUS REACT
cmd({
    pattern: "autostatusreact",
    alias: ["setautoreactstatus","sreact"],
    react: "🫟",
    desc: "Enable or disable auto react to statuses",
    category: "settings",
    filename: __filename
},    
async (conn, mek, m, { from, args, isCreator, reply }) => {
    if (!isCreator) return reply("*📛 ᴏɴʟʏ ᴛʜᴇ ᴏᴡɴᴇʀ ᴄᴀɴ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ!*");

    const status = args[0]?.toLowerCase();
    if (status === "on") {
        config.AUTO_STATUS_REACT = "true";
        return reply("ᴀᴜᴛᴏʀᴇᴀᴄᴛ ᴏꜰ sᴛᴀᴛᴜsᴇs ɪs ɴᴏᴡ ᴇɴᴀʙʟᴇᴅ.");
    } else if (status === "off") {
        config.AUTO_STATUS_REACT = "false";
        return reply("ᴀᴜᴛᴏʀᴇᴀᴄᴛ ᴏꜰ sᴛᴀᴛᴜsᴇs ɪs ɴᴏᴡ ᴅɪsᴀʙʟᴇᴅ.");
    } else {
        return reply(`*🫟 ᴇxᴀᴍᴘʟᴇ:  .ᴀᴜᴛᴏsᴛᴀᴛᴜsʀᴇᴀᴄᴛ ᴏɴ*`);
    }
}); 

// AUTO STATUS VIEW
cmd({
    pattern: "autostatusview",
    alias: ["statusview","astatus","setautostatusview"],
    desc: "Enable or disable autoview of statuses",
    category: "settings",
    filename: __filename
},    
async (conn, mek, m, { from, args, isCreator, reply }) => {
    if (!isCreator) return reply("*📛 ᴏɴʟʏ ᴛʜᴇ ᴏᴡɴᴇʀ ᴄᴀɴ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ!*");

    const status = args[0]?.toLowerCase();
    if (status === "on") {
        config.AUTO_STATUS_SEEN = "true";
        return reply("ᴀᴜᴛᴏᴠɪᴇᴡ ᴏꜰ sᴛᴀᴛᴜsᴇs ɪs ɴᴏᴡ ᴇɴᴀʙʟᴇᴅ.");
    } else if (status === "off") {
        config.AUTO_STATUS_SEEN= "false";
        return reply("ᴀᴜᴛᴏᴠɪᴇᴡ ᴏꜰ sᴛᴀᴛᴜsᴇs ɪs ɴᴏᴡ ᴅɪsᴀʙʟᴇᴅ.");
    } else {
        return reply(`ᴇxᴀᴍᴘʟᴇ: .ᴀᴜᴛᴏsᴛᴀᴛᴜsᴠɪᴇᴡ ᴏɴ`);
    }
});

// READ MESSAGE
cmd({
    pattern: "read-message",
    alias: ["autoread"],
    desc: "enable or disable readmessage.",
    category: "settings",
    filename: __filename
},    
async (conn, mek, m, { from, args, isCreator, reply }) => {
    if (!isCreator) return reply("*📛 ᴏɴʟʏ ᴛʜᴇ ᴏᴡɴᴇʀ ᴄᴀɴ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ!*");

    const status = args[0]?.toLowerCase();
    if (status === "on") {
        config.READ_MESSAGE = "true";
        return reply("ʀᴇᴀᴅ ᴍᴇssᴀɢᴇ ꜰᴇᴀᴛᴜʀᴇ ɪs ɴᴏᴡ ᴇɴᴀʙʟᴇᴅ.");
    } else if (status === "off") {
        config.READ_MESSAGE = "false";
        return reply("ʀᴇᴀᴅ ᴍᴇssᴀɢᴇ ꜰᴇᴀᴛᴜʀᴇ ɪs ɴᴏᴡ ᴅɪsᴀʙʟᴇᴅ.");
    } else {
        return reply(`_ᴇxᴀᴍᴘʟᴇ:  .ʀᴇᴀᴅᴍᴇssᴀɢᴇ ᴏɴ_`);
    }
});

// ANTI BAD WORD
cmd({
    pattern: "antibad",
    alias: ["anti-bad","antibadword"],
    react: "🫟",
    desc: "enable or disable antibad.",
    category: "settings",
    filename: __filename
},    
async (conn, mek, m, { from, args, isCreator, reply }) => {
    if (!isCreator) return reply("*📛 ᴏɴʟʏ ᴛʜᴇ ᴏᴡɴᴇʀ ᴄᴀɴ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ!*");

    const status = args[0]?.toLowerCase();
    if (status === "on") {
        config.ANTI_BAD_WORD = "true";
        return reply("*ᴀɴᴛɪ ʙᴀᴅ ᴡᴏʀᴅ ɪs ɴᴏᴡ ᴇɴᴀʙʟᴇᴅ.*");
    } else if (status === "off") {
        config.ANTI_BAD_WORD = "false";
        return reply("*ᴀɴᴛɪ ʙᴀᴅ ᴡᴏʀᴅ ꜰᴇᴀᴛᴜʀᴇ ɪs ɴᴏᴡ ᴅɪsᴀʙʟᴇᴅ*");
    } else {
        return reply(`_ᴇxᴀᴍᴘʟᴇ:  .ᴀɴᴛɪʙᴀᴅ ᴏɴ_`);
    }
});

// AUTO STICKER
cmd({
    pattern: "autosticker",
    alias: ["auto-sticker"],
    react: "🫟",
    desc: "enable or disable auto-sticker.",
    category: "settings",
    filename: __filename
},    
async (conn, mek, m, { from, args, isCreator, reply }) => {
    if (!isCreator) return reply("*📛 ᴏɴʟʏ ᴛʜᴇ ᴏᴡɴᴇʀ ᴄᴀɴ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ!*");

    const status = args[0]?.toLowerCase();
    if (status === "on") {
        config.AUTO_STICKER = "true";
        return reply("ᴀᴜᴛᴏ-sᴛɪᴄᴋᴇʀ ꜰᴇᴀᴛᴜʀᴇ ɪs ɴᴏᴡ ᴇɴᴀʙʟᴇᴅ.");
    } else if (status === "off") {
        config.AUTO_STICKER = "false";
        return reply("ᴀᴜᴛᴏ-sᴛɪᴄᴋᴇʀ ꜰᴇᴀᴛᴜʀᴇ ɪs ɴᴏᴡ ᴅɪsᴀʙʟᴇᴅ.");
    } else {
        return reply(`_ᴇxᴀᴍᴘʟᴇ:  .ᴀᴜᴛᴏsᴛɪᴄᴋᴇʀ ᴏɴ_`);
    }
});

// AUTO REPLY
cmd({
    pattern: "autoreply",
    alias: ["auto-reply"],
    react: "🫟",
    desc: "enable or disable auto-reply.",
    category: "settings",
    filename: __filename
},    
async (conn, mek, m, { from, args, isCreator, reply }) => {
    if (!isCreator) return reply("*📛 ᴏɴʟʏ ᴛʜᴇ ᴏᴡɴᴇʀ ᴄᴀɴ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ!*");

    const status = args[0]?.toLowerCase();
    if (status === "on") {
        config.AUTO_REPLY = "true";
        return reply("*ᴀᴜᴛᴏ-ʀᴇᴘʟʏ ɪs ɴᴏᴡ ᴇɴᴀʙʟᴇᴅ.*");
    } else if (status === "off") {
        config.AUTO_REPLY = "false";
        return reply("ᴀᴜᴛᴏ-ʀᴇᴘʟʏ ꜰᴇᴀᴛᴜʀᴇ ɪs ɴᴏᴡ ᴅɪsᴀʙʟᴇᴅ.");
    } else {
        return reply(`*🫟 ᴇxᴀᴍᴘʟᴇ: . ᴀᴜᴛᴏʀᴇᴘʟʏ ᴏɴ*`);
    }
});

// AUTO REACT
cmd({
    pattern: "autoreact",
    alias: ["auto-react"],
    react: "🫟",
    desc: "Enable or disable the autoreact feature",
    category: "settings",
    filename: __filename
},    
async (conn, mek, m, { from, args, isCreator, reply }) => {
    if (!isCreator) return reply("*📛 ᴏɴʟʏ ᴛʜᴇ ᴏᴡɴᴇʀ ᴄᴀɴ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ!*");

    const status = args[0]?.toLowerCase();
    if (status === "on") {
        config.AUTO_REACT = "true";
        await reply("ᴀᴜᴛᴏʀᴇᴀᴄᴛ ꜰᴇᴀᴛᴜʀᴇ ɪs ɴᴏᴡ ᴇɴᴀʙʟᴇᴅ.");
    } else if (status === "off") {
        config.AUTO_REACT = "false";
        await reply("ᴀᴜᴛᴏʀᴇᴀᴄᴛ ꜰᴇᴀᴛᴜʀᴇ ɪs ɴᴏᴡ ᴅɪsᴀʙʟᴇᴅ.");
    } else {
        await reply(`*🔥 ᴇxᴀᴍᴘʟᴇ: .ᴀᴜᴛᴏʀᴇᴀᴄᴛ ᴏɴ*`);
    }
});

// STATUS REPLY
cmd({
    pattern: "autostatusreply",
    react: "🫟",
    alias: ["statusreply"],
    desc: "enable or disable status-reply.",
    category: "settings",
    filename: __filename
},    
async (conn, mek, m, { from, args, isCreator, reply }) => {
    if (!isCreator) return reply("*📛 ᴏɴʟʏ ᴛʜᴇ ᴏᴡɴᴇʀ ᴄᴀɴ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ!*");

    const status = args[0]?.toLowerCase();
    if (status === "on") {
        config.AUTO_STATUS_REPLY = "true";
        return reply("sᴛᴀᴛᴜs-ʀᴇᴘʟʏ ꜰᴇᴀᴛᴜʀᴇ ɪs ɴᴏᴡ ᴇɴᴀʙʟᴇᴅ.");
    } else if (status === "off") {
        config.AUTO_STATUS_REPLY = "false";
        return reply("sᴛᴀᴛᴜs-ʀᴇᴘʟʏ ꜰᴇᴀᴛᴜʀᴇ ɪs ɴᴏᴡ ᴅɪsᴀʙʟᴇᴅ.");
    } else {
        return reply(`*🫟 ᴇxᴀᴍᴘʟᴇ:  .sᴛᴀᴛᴜsʀᴇᴘʟʏ ᴏɴ*`);
    }
});

// ANTI BOT
cmd({
  pattern: "antibot",
  react: "🫟",
  alias: ["anti-bot"],
  desc: "Enable or disable anti-link feature in groups",
  category: "group",
  filename: __filename
}, async (conn, mek, m, { from, args, isGroup, isCreator, isBotAdmins, isAdmins, reply }) => {
  try {
    if (!isGroup) return reply('ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ ᴄᴀɴ ᴏɴʟʏ ʙᴇ ᴜsᴇᴅ ɪɴ ᴀ ɢʀᴏᴜᴘ.');
    if (!isBotAdmins) return reply('ʙᴏᴛ ᴍᴜsᴛ ʙᴇ ᴀɴ ᴀᴅᴍɪɴ ᴛᴏ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ.');
    if (!isAdmins) return reply('ʏᴏᴜ ᴍᴜsᴛ ʙᴇ ᴀɴ ᴀᴅᴍɪɴ ᴛᴏ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ.');

    if (args[0] === "on") {
      config.ANTI_BOT = "true";
      await reply("ᴀɴᴛɪ_ʙᴏᴛ ꜰᴇᴀᴛᴜʀᴇ ɪs ɴᴏᴡ ᴇɴᴀʙʟᴇᴅ ɪɴ ᴛʜɪs ɢʀᴏᴜᴘ.");
    } else if (args[0] === "off") {
      config.ANTI_BOT = "false";
      await reply("ᴀɴᴛɪ_ʙᴏᴛ ꜰᴇᴀᴛᴜʀᴇ ɪs ɴᴏᴡ ᴅɪsᴀʙʟᴇᴅ ɪɴ ᴛʜɪs ɢʀᴏᴜᴘ.");
    } else {
      await reply(`*ɪɴᴠᴀʟɪᴅ ɪɴᴘᴜᴛ! ᴜsᴇ ᴇɪᴛʜᴇʀ 'ᴏɴ' ᴏʀ 'ᴏꜰꜰ'. ᴇxᴀᴍᴘʟᴇ: .ᴀɴᴛɪʙᴏᴛ ᴏɴ*`);
    }
  } catch (error) {
    return reply(`*ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ᴘʀᴏᴄᴇssɪɴɢ ʏᴏᴜʀ ʀᴇǫᴜᴇsᴛ.*\n\n_ᴇʀʀᴏʀ:_ ${error.message}`);
  }
});

// ANTI LINK
cmd({
  pattern: "antilink",
  react: "🫟",
  alias: ["anti-link"],
  desc: "Enable or disable anti-link feature in groups",
  category: "group",
  filename: __filename
}, async (conn, mek, m, { from, args, isGroup, isAdmins, isBotAdmins, reply }) => {
  try {
    if (!isGroup) return reply('ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ ᴄᴀɴ ᴏɴʟʏ ʙᴇ ᴜsᴇᴅ ɪɴ ᴀ ɢʀᴏᴜᴘ.');
    if (!isBotAdmins) return reply('ʙᴏᴛ ᴍᴜsᴛ ʙᴇ ᴀɴ ᴀᴅᴍɪɴ ᴛᴏ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ.');
    if (!isAdmins) return reply('ʏᴏᴜ ᴍᴜsᴛ ʙᴇ ᴀɴ ᴀᴅᴍɪɴ ᴛᴏ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ.');

    if (args[0] === "on") {
      config.ANTI_LINK = "true";
      await reply("ᴀɴᴛɪ-ʟɪɴᴋ ꜰᴇᴀᴛᴜʀᴇ ɪs ɴᴏᴡ ᴇɴᴀʙʟᴇᴅ ɪɴ ᴛʜɪs ɢʀᴏᴜᴘ.");
    } else if (args[0] === "off") {
      config.ANTI_LINK = "false";
      await reply("ᴀɴᴛɪ-ʟɪɴᴋ ꜰᴇᴀᴛᴜʀᴇ ɪs ɴᴏᴡ ᴅɪsᴀʙʟᴇᴅ ɪɴ ᴛʜɪs ɢʀᴏᴜᴘ.");
    } else {
      await reply(`*ɪɴᴠᴀʟɪᴅ ɪɴᴘᴜᴛ! ᴜsᴇ ᴇɪᴛʜᴇʀ 'ᴏɴ' ᴏʀ 'ᴏꜰꜰ'. ᴇxᴀᴍᴘʟᴇ: .ᴀɴᴛɪʟɪɴᴋ ᴏɴ*`);
    }
  } catch (error) {
    return reply(`*ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ᴘʀᴏᴄᴇssɪɴɢ ʏᴏᴜʀ ʀᴇǫᴜᴇsᴛ.*\n\n_ᴇʀʀᴏʀ:_ ${error.message}`);
  }
});

// MENTION REPLY
cmd({
    pattern: "mention-reply",
    alias: ["menetionreply", "mee"],
    description: "Set bot status to always online or offline.",
    category: "settings",
    filename: __filename
},    
async (conn, mek, m, { from, args, isCreator, reply }) => {
    if (!isCreator) return reply("*📛 ᴏɴʟʏ ᴛʜᴇ ᴏᴡɴᴇʀ ᴄᴀɴ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ!*");

    const status = args[0]?.toLowerCase();
    if (status === "on") {
        config.MENTION_REPLY = "true";
        return reply("ᴍᴇɴᴛɪᴏɴ ʀᴇᴘʟʏ ꜰᴇᴀᴛᴜʀᴇ ɪs ɴᴏᴡ ᴇɴᴀʙʟᴇᴅ.");
    } else if (status === "off") {
        config.MENTION_REPLY = "false";
        return reply("ᴍᴇɴᴛɪᴏɴ ʀᴇᴘʟʏ ꜰᴇᴀᴛᴜʀᴇ ɪs ɴᴏᴡ ᴅɪsᴀʙʟᴇᴅ.");
    } else {
        return reply(`_ᴇxᴀᴍᴘʟᴇ:  .ᴍᴇᴇ ᴏɴ_`);
    }
});

// ADMIN EVENTS
cmd({
    pattern: "admin-events",
    alias: ["adminevents", "adminaction"],
    desc: "Enable or disable admin event notifications",
    category: "settings",
    filename: __filename
},
async (conn, mek, m, { from, args, isCreator, reply }) => {
    if (!isCreator) return reply("*📛 ᴏɴʟʏ ᴛʜᴇ ᴏᴡɴᴇʀ ᴄᴀɴ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ!*");

    const status = args[0]?.toLowerCase();
    if (status === "on") {
        config.ADMIN_ACTION = "true";
        return reply("✅ ᴀᴅᴍɪɴ ᴇᴠᴇɴᴛ ɴᴏᴛɪꜰɪᴄᴀᴛɪᴏɴs ᴀʀᴇ ɴᴏᴡ ᴇɴᴀʙʟᴇᴅ.");
    } else if (status === "off") {
        config.ADMIN_ACTION = "false";
        return reply("❌ ᴀᴅᴍɪɴ ᴇᴠᴇɴᴛ ɴᴏᴛɪꜰɪᴄᴀᴛɪᴏɴs ᴀʀᴇ ɴᴏᴡ ᴅɪsᴀʙʟᴇᴅ.");
    } else {
        return reply(`ᴇxᴀᴍᴘʟᴇ: .ᴀᴅᴍɪɴ-ᴇᴠᴇɴᴛs ᴏɴ`);
    }
});

// OWNER REACT
cmd({
    pattern: "ownerreact",
    alias: ["owner-react", "selfreact", "self-react"],
    react: "👑",
    desc: "Enable or disable the owner react feature",
    category: "settings",
    filename: __filename
},    
async (conn, mek, m, { from, args, isCreator, reply }) => {
    if (!isCreator) return reply("*📛 ᴏɴʟʏ ᴛʜᴇ ᴏᴡɴᴇʀ ᴄᴀɴ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ!*");

    const status = args[0]?.toLowerCase();

    if (status === "on") {
        config.OWNER_REACT = "true";
        await reply("ᴏᴡɴᴇʀ ʀᴇᴀᴄᴛ ꜰᴇᴀᴛᴜʀᴇ ɪs ɴᴏᴡ ᴇɴᴀʙʟᴇᴅ.");
    } else if (status === "off") {
        config.OWNER_REACT = "false";
        await reply("ᴏᴡɴᴇʀ ʀᴇᴀᴄᴛ ꜰᴇᴀᴛᴜʀᴇ ɪs ɴᴏᴡ ᴅɪsᴀʙʟᴇᴅ.");
    } else {
        await reply(`*🔥 ᴇxᴀᴍᴘʟᴇ: .ᴏᴡɴᴇʀʀᴇᴀᴄᴛ ᴏɴ*`);
    }
});

// DELETE LINKS
cmd({
  pattern: "deletelink",
  alias: ["delete-links"],
  desc: "Enable or disable DELETE_LINKS in groups",
  category: "group",
  react: "❌",
  filename: __filename
}, async (conn, mek, m, { isGroup, isAdmins, isBotAdmins, args, reply }) => {
  try {
    if (!isGroup) return reply('ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ ᴄᴀɴ ᴏɴʟʏ ʙᴇ ᴜsᴇᴅ ɪɴ ᴀ ɢʀᴏᴜᴘ.');
    if (!isBotAdmins) return reply('ʙᴏᴛ ᴍᴜsᴛ ʙᴇ ᴀɴ ᴀᴅᴍɪɴ ᴛᴏ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ.');
    if (!isAdmins) return reply('ʏᴏᴜ ᴍᴜsᴛ ʙᴇ ᴀɴ ᴀᴅᴍɪɴ ᴛᴏ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ.');

    if (args[0] === "on") {
      config.DELETE_LINKS = "true";
      reply("✅ ᴅᴇʟᴇᴛᴇ_ʟɪɴᴋs ɪs ɴᴏᴡ ᴇɴᴀʙʟᴇᴅ.");
    } else if (args[0] === "off") {
      config.DELETE_LINKS = "false";
      reply("❌ ᴅᴇʟᴇᴛᴇ_ʟɪɴᴋs ɪs ɴᴏᴡ ᴅɪsᴀʙʟᴇᴅ.");
    } else {
      reply("ᴜsᴀɢᴇ: *.ᴅᴇʟᴇᴛᴇʟɪɴᴋ ᴏɴ/ᴏꜰꜰ*");
    }
  } catch (e) {
    reply(`ᴇʀʀᴏʀ: ${e.message}`);
  }
});

// CUSTOM REACT
cmd({
    pattern: "customreact",
    alias: ["creact", "reactc"],
    react: "😎",
    desc: "Enable or disable custom reactions",
    category: "settings",
    filename: __filename
},
async (conn, mek, m, { from, args, isCreator, reply }) => {
    if (!isCreator) return reply("*📛 ᴏɴʟʏ ᴛʜᴇ ᴏᴡɴᴇʀ ᴄᴀɴ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ!*");

    const status = args[0]?.toLowerCase();
    if (status === "on") {
        config.CUSTOM_REACT = "true";
        return reply("✅ ᴄᴜsᴛᴏᴍ ʀᴇᴀᴄᴛɪᴏɴs ᴀʀᴇ ɴᴏᴡ ᴇɴᴀʙʟᴇᴅ.");
    } else if (status === "off") {
        config.CUSTOM_REACT = "false";
        return reply("❌ ᴄᴜsᴛᴏᴍ ʀᴇᴀᴄᴛɪᴏɴs ᴀʀᴇ ɴᴏᴡ ᴅɪsᴀʙʟᴇᴅ.");
    } else {
        return reply(`ᴇxᴀᴍᴘʟᴇ: .ᴄᴜsᴛᴏᴍʀᴇᴀᴄᴛ ᴏɴ`);
    }
});

// SET REACTS
cmd({
  pattern: "setreacts",
  alias: ["customemojis", "emojis", "cemojis"],
  desc: "Set custom reaction emojis for the bot",
  category: "owner",
  react: "🌈",
  filename: __filename
}, async (conn, mek, m, { args, isCreator, reply }) => {
  if (!isCreator) return reply("❗ ᴏɴʟʏ ᴛʜᴇ ʙᴏᴛ ᴏᴡɴᴇʀ ᴄᴀɴ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ.");

  const emojiList = args.join(" ").trim();
  if (!emojiList) return reply("❌ ᴘʟᴇᴀsᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ᴄᴏᴍᴍᴀ-sᴇᴘᴀʀᴀᴛᴇᴅ ʟɪsᴛ ᴏꜰ ᴇᴍᴏᴊɪs.\n\nᴇxᴀᴍᴘʟᴇ:\n.sᴇᴛʀᴇᴀᴄᴛs 💖,💗,💘,💕");

  await setConfig("CUSTOM_REACT_EMOJIS", emojiList);

  await reply(`✅ ᴄᴜsᴛᴏᴍ ʀᴇᴀᴄᴛɪᴏɴ ᴇᴍᴏᴊɪs ᴜᴘᴅᴀᴛᴇᴅ ᴛᴏ:\n${emojiList}`);
});



cmd({
    pattern: "yts",
    alias: ["ytsearch"],
    use: '.yts ridz coder',
    react: "🔎",
    desc: "Search and get details from YouTube.",
    category: "download",
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply('*ᴘʟᴇᴀsᴇ ɢɪᴠᴇ ᴍᴇ ᴡᴏʀᴅs ᴛᴏ sᴇᴀʀᴄʜ*')

        let arama = await ytdl(q)
        let results = arama.all.slice(0, 10) 
        let mesaj = ''

        results.forEach((video, i) => {
            mesaj += `*${i + 1}. ${video.title}*\n🔗 ${video.url}\n📺 ${video.timestamp} | 👀 ${video.views} ᴠɪᴇᴡs\n\n`
        })

        await conn.sendMessage(from, { text: mesaj.trim() }, { quoted: anony })

    } catch (e) {
        l(e)
        reply('*ᴇʀʀᴏʀ !!*')
    }
})

cmd({
  pattern: "tiktokstalk",
  alias: ["tstalk", "ttstalk"],
  react: "📱",
  desc: "Fetch TikTok user profile details.",
  category: "download",
  filename: __filename
}, async (conn, m, store, { from, args, q, reply }) => {
  try {
    if (!q) {
      return reply("❎ ᴘʟᴇᴀsᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ᴛɪᴋᴛᴏᴋ ᴜsᴇʀɴᴀᴍᴇ.\n\n*ᴇxᴀᴍᴘʟᴇ:* .ᴛɪᴋᴛᴏᴋsᴛᴀʟᴋ ᴍʀʙᴇᴀsᴛ");
    }

    const apiUrl = `https://api.siputzx.my.id/api/stalk/tiktok?username=${encodeURIComponent(q)}`;
    const { data } = await axios.get(apiUrl);

    if (!data.status) {
      return reply("❌ ᴜsᴇʀ ɴᴏᴛ ꜰᴏᴜɴᴅ. ᴘʟᴇᴀsᴇ ᴄʜᴇᴄᴋ ᴛʜᴇ ᴜsᴇʀɴᴀᴍᴇ ᴀɴᴅ ᴛʀʏ ᴀɢᴀɪɴ.");
    }

    const user = data.data.user;
    const stats = data.data.stats;

    const profileInfo = `🎭 *ᴛɪᴋᴛᴏᴋ ᴘʀᴏꜰɪʟᴇ sᴛᴀʟᴋᴇʀ* 🎭

👤 *ᴜsᴇʀɴᴀᴍᴇ:* @${user.uniqueId}
📛 *ɴɪᴄᴋɴᴀᴍᴇ:* ${user.nickname}
✅ *ᴠᴇʀɪꜰɪᴇᴅ:* ${user.verified ? "ʏᴇs ✅" : "ɴᴏ ❌"}
📍 *ʀᴇɢɪᴏɴ:* ${user.region}
📝 *ʙɪᴏ:* ${user.signature || "ɴᴏ ʙɪᴏ ᴀᴠᴀɪʟᴀʙʟᴇ."}
🔗 *ʙɪᴏ ʟɪɴᴋ:* ${user.bioLink?.link || "ɴᴏ ʟɪɴᴋ ᴀᴠᴀɪʟᴀʙʟᴇ."}

📊 *sᴛᴀᴛɪsᴛɪᴄs:*
👥 *ꜰᴏʟʟᴏᴡᴇʀs:* ${stats.followerCount.toLocaleString()}
👤 *ꜰᴏʟʟᴏᴡɪɴɢ:* ${stats.followingCount.toLocaleString()}
❤️ *ʟɪᴋᴇs:* ${stats.heartCount.toLocaleString()}
🎥 *ᴠɪᴅᴇᴏs:* ${stats.videoCount.toLocaleString()}

📅 *ᴀᴄᴄᴏᴜɴᴛ ᴄʀᴇᴀᴛᴇᴅ:* ${new Date(user.createTime * 1000).toLocaleDateString()}
🔒 *ᴘʀɪᴠᴀᴛᴇ ᴀᴄᴄᴏᴜɴᴛ:* ${user.privateAccount ? "ʏᴇs 🔒" : "ɴᴏ 🌍"}

🔗 *ᴘʀᴏꜰɪʟᴇ ᴜʀʟ:* https://www.tiktok.com/@${user.uniqueId}
`;

    const profileImage = { image: { url: user.avatarLarger }, caption: profileInfo };

    await conn.sendMessage(from, profileImage, { quoted: m });
  } catch (error) {
    console.error("❌ Error in TikTok stalk command:", error);
    reply("⚠️ ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ꜰᴇᴛᴄʜɪɴɢ ᴛɪᴋᴛᴏᴋ ᴘʀᴏꜰɪʟᴇ ᴅᴀᴛᴀ.");
  }
});