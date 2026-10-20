const { fetchEmix } = require("../lib/emix-utils");
const { fetchGif, gifToVideo } = require("../lib/fetchGif");
const { getAnti, setAnti } = require('../data/antidel');
const { setConfig, getConfig } = require("../lib/configdb");
const { cmd, commands } = require("../command");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const fetch = require("node-fetch");
const os = require("os");
const util = require("util");
const crypto = require("crypto");
const { spawn, exec } = require("child_process");
const { tmpdir } = require("os");
const { writeFileSync } = require("fs");
const FormData = require("form-data");
const googleTTS = require("google-tts-api");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const ffmpeg = require("fluent-ffmpeg");
const webp = require("node-webpmux");
const { Jimp } = require('jimp');
const { sendButtons } = require("gifted-btns");
const { translate } = require("@vitalets/google-translate-api");
const { Sticker, createSticker, StickerTypes } = require("wa-sticker-formatter");

const config = require("../config");
const prefix = config.PREFIX;

const {
  getBuffer, getGroupAdmins, getRandom, h2k, isUrl, Json,
  runtime, sleep, fetchJson,
} = require("../lib/functions");

const { anony } = require("../lib/ridzcoder");
const { fetchImage, gifToSticker } = require("../lib/sticker-utils");
const { videoToWebp } = require("../lib/video-utils");
const converter = require("../data/converter");
const stickerConverter = require("../data/sticker-converter");

const SAFETY = { MAX_JIDS: 20, BASE_DELAY: 2000, EXTRA_DELAY: 4000 };
const stylizedChars = {
    a: '🅐', b: '🅑', c: '🅒', d: '🅓', e: '🅔', f: '🅕', g: '🅖',
    h: '🅗', i: '🅘', j: '🅙', k: '🅚', l: '🅛', m: '🅜', n: '🅝',
    o: '🅞', p: '🅟', q: '🅠', r: '🅡', s: '🅢', t: '🅣', u: '🅤',
    v: '🅥', w: '🅦', x: '🅧', y: '🅨', z: '🅩',
    '0': '⓿', '1': '➊', '2': '➋', '3': '➌', '4': '➍',
    '5': '➎', '6': '➏', '7': '➐', '8': '➑', '9': '➒'
};
const linkPatterns = [
  /https?:\/\/(?:chat\.whatsapp\.com|wa\.me)\/\S+/gi,
  /^https?:\/\/(www\.)?whatsapp\.com\/channel\/([a-zA-Z0-9_-]+)$/,
  /wa\.me\/\S+/gi,
  /https?:\/\/(?:t\.me|telegram\.me)\/\S+/gi,
  /https?:\/\/(?:www\.)?youtube\.com\/\S+/gi,
  /https?:\/\/youtu\.be\/\S+/gi,
  /https?:\/\/(?:www\.)?facebook\.com\/\S+/gi,
  /https?:\/\/fb\.me\/\S+/gi,
  /https?:\/\/(?:www\.)?instagram\.com\/\S+/gi,
  /https?:\/\/(?:www\.)?twitter\.com\/\S+/gi,
  /https?:\/\/(?:www\.)?tiktok\.com\/\S+/gi,
  /https?:\/\/(?:www\.)?linkedin\.com\/\S+/gi,
  /https?:\/\/(?:www\.)?snapchat\.com\/\S+/gi,
  /https?:\/\/(?:www\.)?pinterest\.com\/\S+/gi,
  /https?:\/\/(?:www\.)?reddit\.com\/\S+/gi,
  /https?:\/\/ngl\/\S+/gi,
  /https?:\/\/(?:www\.)?discord\.com\/\S+/gi,
  /https?:\/\/(?:www\.)?twitch\.tv\/\S+/gi,
  /https?:\/\/(?:www\.)?vimeo\.com\/\S+/gi,
  /https?:\/\/(?:www\.)?dailymotion\.com\/\S+/gi,
  /https?:\/\/(?:www\.)?medium\.com\/\S+/gi
];
function isEnabled(value) {
    return value && value.toString().toLowerCase() === "true";
}

// ──────────────────────────────────────────────────────────────
// CONFIG
// ──────────────────────────────────────────────────────────────
const CATBOX_USERHASH = 'c8f243c132e5d3e01b89bf27a';

// ──────────────────────────────────────────────────────────────
// Uploaders (Fallback Logic)
// ──────────────────────────────────────────────────────────────
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

async function uploadToFileIo(buffer, filename) {
    const form = new FormData();
    form.append('file', buffer, { filename });

    const res = await axios.post('https://file.io', form, {
        headers: form.getHeaders(),
        timeout: 20000
    });

    if (res.data && res.data.success && res.data.link) {
        return res.data.link;
    }
    throw new Error('File.io upload failed');
}

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

async function uploadImage(buffer, filename) {
    try {
        return await uploadToCatbox(buffer, filename);
    } catch (e1) {
        try {
            return await uploadToFileIo(buffer, filename);
        } catch (e2) {
            return await uploadToUguu(buffer, filename);
        }
    }
}
// Default AI states
let AI_STATE = {
    IB: "false", // Inbox chats
    GC: "false"  // Group chats
};
cmd({
    pattern: "character",
    alias: ["char"],
    desc: "Check the character of a mentioned user.",
    react: "🔥",
    category: "fun",
    filename: __filename,
}, 
async (conn, mek, m, { from, isGroup, text, reply }) => {
    try {
        // Ensure the command is used in a group
        if (!isGroup) {
            return reply("ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ ᴄᴀɴ ᴏɴʟʏ ʙᴇ ᴜꜱᴇᴅ ɪɴ ɢʀᴏᴜᴘꜱ.");
        }

        // Extract the mentioned user
        const mentionedUser = m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        if (!mentionedUser) {
            return reply("ᴘʟᴇᴀꜱᴇ ᴍᴇɴᴛɪᴏɴ ᴀ ᴜꜱᴇʀ ᴡʜᴏꜱᴇ ᴄʜᴀʀᴀᴄᴛᴇʀ ʏᴏᴜ ᴡᴀɴᴛ ᴛᴏ ᴄʜᴇᴄᴋ.");
        }

        // Define character traits
        const userChar = [
            "Sigma",
            "Generous",
            "Grumpy",
            "Overconfident",
            "Obedient",
            "Good",
            "Simp",
            "Kind",
            "Patient",
            "Pervert",
            "Cool",
            "Helpful",
            "Brilliant",
            "Sexy",
            "Hot",
            "Gorgeous",
            "Cute",
        ];

        // Randomly select a character trait
        const userCharacterSelection =
            userChar[Math.floor(Math.random() * userChar.length)];

        // Message to send
        const message = `ᴄʜᴀʀᴀᴄᴛᴇʀ ᴏꜰ @${mentionedUser.split("@")[0]} is *${userCharacterSelection}* `;

        // Send the message with mentions
        await conn.sendMessage(from, {
            text: message,
            mentions: [mentionedUser],
        }, { quoted: anony });

    } catch (e) {
        console.error("Error in character command:", e);
        reply("ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ᴘʀᴏᴄᴇꜱꜱɪɴɢ ᴛʜᴇ ᴄᴏᴍᴍᴀɴᴅ.ᴘʟᴇᴀꜱᴇ ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ.");
    }
});

cmd({
  pattern: 'version',
  alias: ["changelog", "cupdate", "checkupdate"],
  react: '🚀',
  desc: "Check bot's version, system stats, and update info.",
  category: 'main',
  filename: __filename
}, async (conn, mek, m, {
  from, sender, pushname, reply
}) => {
  try {
    // Read local version data
    const localVersionPath = path.join(__dirname, '../data/version.json');
    let localVersion = 'Unknown';
    let changelog = 'No changelog available.';
    if (fs.existsSync(localVersionPath)) {
      const localData = JSON.parse(fs.readFileSync(localVersionPath));
      localVersion = localData.version;
      changelog = localData.changelog;
    }

    // Fetch latest version data from GitHub
    const rawVersionUrl = 'https://raw.githubusercontent.com/ridzcoder/PRIME-RIDZ/main/data/version.json';
    let latestVersion = 'Unknown';
    let latestChangelog = 'No changelog available.';
    try {
      const { data } = await axios.get(rawVersionUrl);
      latestVersion = data.version;
      latestChangelog = data.changelog;
    } catch (error) {
      console.error('Failed to fetch latest version:', error);
    }

    // Count total plugins
    const pluginPath = path.join(__dirname, '../plugins');
    const pluginCount = fs.readdirSync(pluginPath).filter(file => file.endsWith('.js')).length;

    // Count total registered commands
    const totalCommands = commands.length;

    // System info
    const uptime = runtime(process.uptime());
    const ramUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
    const totalRam = (os.totalmem() / 1024 / 1024).toFixed(2);
    const hostName = os.hostname();
    const lastUpdate = fs.statSync(localVersionPath).mtime.toLocaleString();

    // GitHub stats
    const githubRepo = 'https://github.com/ridzcoder/PRIME-RIDZ';

    // Check update status
    let updateMessage = `ᴘʀɪᴍᴇ ʀɪᴅᴢ ɪꜱ ᴜᴘ ᴛᴏ ᴅᴀᴛᴇ!`;
    if (localVersion !== latestVersion) {
      updateMessage = `🚀 ʏᴏᴜʀ ᴘʀɪᴍᴇ ʀɪᴅᴢ ɪꜱ ᴏᴜᴛᴅᴀᴛᴇᴅ
🔹 *ᴄᴜʀʀᴇɴᴛ ᴠᴇʀꜱɪᴏɴ:* ${localVersion}
🔹 *ʟᴀᴛᴇꜱᴛ ᴠᴇʀꜱɪᴏɴ:* ${latestVersion}

ᴜꜱᴇ *.ᴜᴘᴅᴀᴛᴇ* ᴛᴏ ᴜᴘᴅᴀᴛᴇ.`;
    }

    const statusMessage = `🌟 *Good ${new Date().getHours() < 12 ? 'Morning' : 'Night'}, ${pushname}!* 🌟\n\n` +
      `📌 *ʙᴏᴛ ɴᴀᴍᴇ:* ᴘʀɪᴍᴇ ʀɪᴅᴢ\n🔖 *ᴄᴜʀʀᴇɴᴛ ᴠᴇʀꜱɪᴏɴ:* ${localVersion}\n📢 *ʟᴀᴛᴇꜱᴛ ᴠᴇʀꜱɪᴏɴ:* ${latestVersion}\n📂 *ᴛᴏᴛᴀʟ ᴘʟᴜɢɪɴꜱ:* ${pluginCount}\n🔢 *ᴛᴏᴛᴀʟ ᴄᴏᴍᴍᴀɴᴅꜱ:* ${totalCommands}\n\n` +
      `💾 *ꜱʏꜱᴛᴇᴍ ɪɴꜰᴏ:*\n⏳ *ᴜᴘᴛɪᴍᴇ:* ${uptime}\n📟 *ʀᴀᴍ ᴜꜱᴀɢᴇ:* ${ramUsage}MB / ${totalRam}MB\n⚙️ *ʜᴏꜱᴛ ɴᴀᴍᴇ* ${hostName}\n📅 *ʟᴀꜱᴛ ᴜᴘᴅᴀᴛᴇ:* ${lastUpdate}\n\n` +
      `📝 *ᴄʜᴀɴɢᴇʟᴏɢ:*\n${latestChangelog}\n\n` +
      `⭐ *ɢɪᴛʜᴜʙ ʀᴇᴏ:* ${githubRepo}\n👤 *ᴏᴡɴᴇʀ:* [ridz coder](https://github.com/ridzcoder)\n\n${updateMessage}\n\n🚀 *ʜᴇʏ! ᴅᴏɴ'ᴛ ꜰᴏʀɢᴇᴛ ᴛᴏ ꜱᴛᴀʀ ᴀɴᴅ ꜰᴏʀᴋ ᴛʜᴇ ʀᴇᴘᴏ!*`;

    // Send the status message with an image
    await conn.sendMessage(from, {
      image: { url: 'https://files.catbox.moe/oyadfh.png' },
      caption: statusMessage,
      contextInfo: {
        mentionedJid: [m.sender],
        forwardingScore: 999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
          newsletterJid: '120363404529319592@newsletter',
          newsletterName: 'ʀᴄʟᴀʙꜱ',
          serverMessageId: 143
        }
      }
    }, { quoted: mek });
  } catch (error) {
    console.error('Error fetching version info:', error);
    reply('ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ᴄʜᴇᴄᴋɪɴɢ ᴛʜᴇ ʙᴏᴛ ᴠᴇʀꜱɪᴏɴ.');
  }
});

cmd({
    pattern: "uptime",
    alias: ["runtime", "up"],
    desc: "Show bot uptime with stylish formats",
    category: "main",
    react: "⏱️",
    filename: __filename
},
async (conn, mek, m, { from, reply }) => {
    try {
        const uptime = runtime(process.uptime());
        const startTime = new Date(Date.now() - process.uptime() * 1000);
        
        // Style 1: Classic Box
        const style1 = `
 ╭───『 ᴜᴘᴛɪᴍᴇ  』───⳹
│ ⏱️ ${uptime}
│ 🚀 ꜱᴛᴀʀᴛᴇᴅ: ${startTime.toLocaleString()}
╰────────────⳹
${config.DESCRIPTION}`;

        // Style 2: Minimalist
        const style2 = `
   •——[ ᴜᴘᴛɪᴍᴇ  ]——•
  ├─ ⏳ ${uptime}
  ├─ 🕒 ꜱɪɴᴄᴇ: ${startTime.toLocaleTimeString()}
  │
  •——[ ${config.BOT_NAME} ]——•`;

        // Style 3: Fancy Borders
        const style3 = `
  ▄▀▄▀▄ ʙᴏᴛ ᴜᴘᴛɪᴍᴇ ▄▀▄▀▄

  ♢ ʀᴜɴɴɪɴɢ : ${uptime}
  ♢ ꜱɪɴᴄᴇ: ${startTime.toLocaleDateString()}
  
  ${config.DESCRIPTION}`;

        // Style 4: Code Style
        const style4 = `
├────────────┤
│ • ᴛɪᴍᴇ: ${uptime}
│ • ꜱᴛᴀʀᴛᴇᴅ : ${startTime.toLocaleString()}
│ • ᴠᴇʀꜱɪᴏɴ : 3.0.0
└────────────┘`;

        // Style 5: Modern Blocks
        const style5 = `
  ▰▰▰▰▰ UPTIME ▰▰▰▰▰

  ⏳ ${uptime}
  🕰️ ${startTime.toLocaleString()}
  
  ${config.DESCRIPTION}`;

        // Style 6: Retro Terminal
        const style6 = `
╠════════════════╣
║ > ʀᴜɴᴛɪᴍᴇ: ${uptime}
║ > ꜱɪɴᴄᴇ: ${startTime.toLocaleString()}
╚════════════════╝`;

        // Style 7: Elegant
        const style7 = `
│ ${uptime}
│ ꜱɪɴᴄᴇ ${startTime.toLocaleDateString()}
`;

        // Style 8: Social Media Style
        const style8 = `
🟢 ᴏɴʟɪɴᴇ ꜰᴏʀ : ${uptime}
📅 ꜱɪɴᴄᴇ: ${startTime.toLocaleString()}

${config.DESCRIPTION}`;

        // Style 9: Fancy List
        const style9 = `
•・゜゜・* ✧  *・゜゜・•
 ✧ ${uptime}
 ✧ ꜱɪɴᴄᴇ ${startTime.toLocaleDateString()}
•・゜゜・* ✧  *・゜゜・•`;

        // Style 10: Professional
        const style10 = `
◈ ᴅᴜʀᴀᴛɪᴏɴ : ${uptime}
◈ ꜱᴛᴀʀᴛ ᴛɪᴍᴇ ${startTime.toLocaleString()}
◈ ꜱᴛᴀʙɪʟɪᴛʏ: 100%
◈ ᴠᴇʀꜱɪᴏɴ :  3.0.0

${config.DESCRIPTION}`;

        const styles = [style1, style2, style3, style4, style5, style6, style7, style8, style9, style10];
        const selectedStyle = styles[Math.floor(Math.random() * styles.length)];

        await conn.sendMessage(from, { 
            text: selectedStyle,
            contextInfo: {
                mentionedJid: [m.sender],
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '120363404529319592@newsletter',
                    newsletterName: config.OWNER_NAME || 'ʀᴄʟᴀʙꜱ',
                    serverMessageId: 143
                }
            }
        }, { quoted: anony });

    } catch (e) {
        console.error("Uptime Error:", e);
        reply(`ᴇʀʀᴏʀ: ${e.message}`);
    }
});

cmd({
    pattern: "weather",
    desc: "🌤 Get weather information for a location",
    react: "🌤",
    category: "utility",
    use: '.weather <city>',
    filename: __filename
},
async (conn, mek, m, { from, reply, args }) => {
    try {
        if (!args[0]) return reply("ᴘʟᴇᴀꜱᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ᴄɪᴛʏ ɴᴀᴍᴇ\nᴇxᴀᴍᴘʟᴇ: .ᴡᴇᴀᴛʜᴇʀ ʟᴏɴᴅᴏɴ");
        
        const city = args.join(' ');
        const apiUrl = `https://apis.davidcyriltech.my.id/weather?city=${encodeURIComponent(city)}`;
        
        const { data } = await axios.get(apiUrl);
        
        if (!data.success) return reply("ᴄᴏᴜʟᴅɴ'ᴛ ꜰᴇᴛᴄʜ ᴡᴇᴀᴛʜᴇʀ ᴅᴀᴛᴀ ꜰʀᴏᴍ ᴛʜᴀᴛ ʟᴏᴄᴀᴛɪᴏɴ");
        
        const weatherInfo = `
╭━━━❏ *ᴡᴇᴀᴛʜᴇʀ ꜰᴏʀ ${data.data.location}, ${data.data.country}*
├•▣┃
├•▣┃ ᴛᴇᴍᴘᴇʀᴀᴛᴜʀᴇ : ${data.data.temperature}
├•▣┃ ꜰᴇᴇʟꜱ ʟɪᴋᴇ: ${data.data.feels_like}
├•▣┃ ᴡᴇᴀᴛʜᴇʀ : ${data.data.weather} (${data.data.description})
├•▣┃
├•▣┃ ʜᴜᴍɪᴅɪᴛʏ : ${data.data.humidity}
├•▣┃ ᴡɪɴᴅ ꜱᴘᴇᴇᴅ : ${data.data.wind_speed}
├•▣┃ ᴘʀᴇꜱꜱᴜʀᴇ : ${data.data.pressure}
├•▣┃ ᴄᴏᴏʀᴅɪɴᴀᴛᴇꜱ : ${data.data.coordinates.latitude}, ${data.data.coordinates.longitude}
╰▬▬▬▬▬▬▬▬▬▬▬▬▬▬❏
> https://ridzcoder.xyz
`.trim();

        // CTA Buttons configuration
        const buttons = [
            {
                name: 'cta_url',
                buttonParamsJson: JSON.stringify({
                    display_text: '📍 ᴠɪᴇᴡ ᴏɴ ᴍᴀᴘꜱ',
                    url: `https://www.google.com/maps/search/?api=1&query=${data.data.coordinates.latitude},${data.data.coordinates.longitude}`
                })
            },
            {
                name: 'cta_url',
                buttonParamsJson: JSON.stringify({
                    display_text: '🌐 ᴠɪꜱɪᴛ ᴡᴇʙꜱɪᴛᴇ',
                    url: 'https://ridzcoder.xyz'
                })
            }
        ];

        // Send text + buttons
        await sendButtons(conn, from, {
            title: '🌤 ᴡᴇᴀᴛʜᴇʀ ᴜᴘᴅᴀᴛᴇ',
            text: weatherInfo,
            footer: 'ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʀɪᴅᴢᴄᴏᴅᴇʀ',
            buttons: buttons
        }, { quoted: mek });
        
    } catch (error) {
        console.error('ᴡᴇᴀᴛʜᴇʀ ᴇʀʀᴏʀ:', error);
        reply("ꜰᴀɪʟᴇᴅ ᴛᴏ ꜰᴇᴛᴄʜ ᴡᴇᴀᴛʜᴇʀ ᴅᴀᴛᴀ. ᴘʟᴇᴀꜱᴇ ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ.");
    }
});

cmd({
  'pattern': "couplepp",
  'alias': ["couple", "cpp"],
  'react': '💑',
  'desc': "Get a male and female couple profile picture.",
  'category': "img_edit",
  'use': ".couplepp",
  'filename': __filename
}, async (conn, m, store, {
  from,
  args,
  reply
}) => {
  try {
    reply("*💑 ꜰᴇᴛᴄʜɪɴɢ ᴄᴏᴜᴘʟᴇ ᴘʀᴏꜰɪʟᴇ ᴘɪᴄᴛᴜʀᴇꜱ...*");
    
    const response = await axios.get("https://api.davidcyriltech.my.id/couplepp");

    if (!response.data || !response.data.success) {
      return reply("ꜰᴀɪʟᴇᴅ ᴛᴏ ɢᴇᴛ ᴄᴏᴜᴘʟᴇ ᴘɪᴄᴛᴜʀᴇꜱ. ᴘʟᴇᴀꜱᴇ ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ.");
    }

    const malePp = response.data.male;
    const femalePp = response.data.female;

    if (malePp) {
      await conn.sendMessage(from, {
        'image': { 'url': malePp },
        'caption': "> https://ridzcoder.xyz"
      }, { 'quoted': m });
    }

    if (femalePp) {
      await conn.sendMessage(from, {
        'image': { 'url': femalePp },
        'caption': "> https://ridzcoder.xyz"
      }, { 'quoted': m });
    }

  } catch (error) {
    console.error(error);
    reply("ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ꜰᴇᴛᴄʜɪɴɢ ᴛʜᴇ ᴄᴏᴜᴘʟᴇ ᴘʀᴏꜰɪʟᴇ ᴘɪᴄᴛᴜʀᴇꜱ.");
  }
});

cmd({
    pattern: "apk",
    alias: ["app"],
    react: "📲",
    desc: "📥 Download APK directly",
    category: "download",
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("ᴘʟᴇᴀꜱᴇ ᴘʀᴏᴠɪᴅᴇ ᴀɴ ᴀᴘᴘ ɴᴀᴍᴇ");

        // ⏳ React - processing
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });

        const { data } = await axios.get(`https://apis.davidcyriltech.my.id/download/apk?text=${encodeURIComponent(q)}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json'
            },
            timeout: 30000
        });

        // Fixed to match the exact API response structure
        if (!data || !data.status || !data.apk || !data.apk.downloadLink) {
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
            return reply("ᴀᴘᴘ ɴᴏᴛ ꜰᴏᴜɴᴅ ᴏʀ ᴀᴘɪ ᴇʀʀᴏʀ");
        }

        const appName = data.apk.name || q;
        const downloadLink = data.apk.downloadLink;

        // Send APK file directly
        await conn.sendMessage(from, {
            document: { url: downloadLink },
            mimetype: "application/vnd.android.package-archive",
            fileName: `${appName}.apk`,
            caption: `*ᴀᴘᴋ ꜱᴜᴄᴄᴇꜱꜱꜰᴜʟʟʏ ᴜᴘʟᴏᴀᴅᴇᴅ!*\n\n📦 *ᴀᴘᴘ:* ${appName}\n🔖 *ᴠᴇʀꜱɪᴏɴ:* ${data.apk.lastUpdated || 'N/A'}\n\n> *ᴄʀᴇᴀᴛᴇᴅ ʙʏ ᴘʀɪᴍᴇ ʀɪᴅᴢ*`
        }, { quoted: anony });

        // ✅ React - success
        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });

    } catch (error) {
        console.error('APK Download Error:', error.message);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
        reply("ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ᴘʀᴏᴄᴇꜱꜱɪɴɢ ᴀᴘᴋ.");
    }
});

cmd({
    pattern: "instagram",
    alias: [ "insta", "ig"],
    react: "⬇️",
    desc: "Download Instagram videos/reels",
    category: "download",
    use: ".igdl <Instagram URL>",
    filename: __filename
}, async (conn, mek, m, { from, reply, args, q }) => {
    try {
        const url = q || m.quoted?.text;
        if (!url || !url.includes("instagram.com")) {
            return reply("❌ ᴘʟᴇᴀꜱᴇ ᴘʀᴏᴠɪᴅᴇ/ʀᴇᴘʟʏ to an ɪɴꜱᴛᴀɢʀᴀᴍ ʟɪɴᴋ");
        }

        // Show processing reaction
        await conn.sendMessage(from, { react: { text: '⏳', key: m.key } });

        // Fetch from API
        const apiUrl = `https://api-aswin-sparky.koyeb.app/api/downloader/igdl?url=${encodeURIComponent(url)}`;
        const response = await axios.get(apiUrl);

        if (!response.data?.status || !response.data.data?.length) {
            await conn.sendMessage(from, { react: { text: '❌', key: m.key } });
            return reply("ꜰᴀɪʟᴇᴅ ᴛᴏ ꜰᴇᴛᴄʜ ᴍᴇᴅɪᴀ. ɪɴᴠᴀʟɪᴅ ʟɪɴᴋ ᴏʀ ᴘʀɪᴠᴀᴛᴇ ᴄᴏɴᴛᴇɴᴛ.");
        }

        // Send all media items
        for (const item of response.data.data) {
            await conn.sendMessage(from, {
                [item.type === 'video' ? 'video' : 'image']: { url: item.url },
                caption: ` *ɪɴꜱᴛᴀɢʀᴀᴍ ᴅᴏᴡɴʟᴏᴀᴅᴇʀ*\n\n` +
        ` *Quality*: HD\n\n` +
        `> *© Cʀᴇᴀᴛᴇᴅ ʙʏ ᴘʀɪᴍᴇ ʀɪᴅᴢ*`
            }, { quoted: anony });
        }

        // Success reaction
        await conn.sendMessage(from, { react: { text: '✅', key: m.key } });

    } catch (error) {
        console.error('IGDL Error:', error);
        await conn.sendMessage(from, { react: { text: '❌', key: m.key } });
        reply("ᴅᴏᴡɴʟᴏᴀᴅ ꜰᴀɪʟᴇᴅ. ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ.");
    }
});
                  
cmd({
    pattern: "img",
    alias: ["image", "googleimage", "searchimg"],
    react: "🦋",
    desc: "Search and download Google images",
    category: "fun",
    use: ".img <keywords>",
    filename: __filename
}, async (conn, mek, m, { reply, args, from }) => {
    try {
        const query = args.join(" ");
        if (!query) {
            return reply("🖼️ ᴘʟᴇᴀꜱᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ꜱᴇᴀʀᴄʜ Qᴜᴇʀʏ\nᴇxᴀᴍʟᴇ: .img cute cats");
        }

        await reply(`🔍 ꜱᴇᴀʀᴄʜɪɴɢ ɪᴍᴀɢᴇꜱ ꜰᴏʀ  "${query}"...`);

        const url = `https://apis.davidcyriltech.my.id/googleimage?query=${encodeURIComponent(query)}`;
        const response = await axios.get(url);

        // Validate response
        if (!response.data?.success || !response.data.results?.length) {
            return reply("ɴᴏ ɪᴍᴀɢᴇ ꜰᴏᴜɴᴅ.ᴛʀʏ ᴅɪꜰꜰᴇʀᴇɴᴛ ᴋᴇʏᴡᴏʀᴅꜱ");
        }

        const results = response.data.results;
        // Get 5 random images
        const selectedImages = results
            .sort(() => 0.5 - Math.random())
            .slice(0, 5);

        for (const imageUrl of selectedImages) {
            await conn.sendMessage(
                from,
                { 
                    image: { url: imageUrl },
                    caption: `> ʀᴇꜱᴜʟᴛ ꜰᴏʀ : ${query}\n> © Cʀᴇᴀᴛᴇᴅ ʙʏ ᴘʀɪᴍᴇ ʀɪᴅᴢ `
                },
                { quoted: anony }
            );
            // Add delay between sends to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

    } catch (error) {
        console.error('Image Search Error:', error);
        reply(`ᴇʀʀᴏʀ: ${error.message || "ꜰᴀɪʟᴇᴅ ᴛᴏ ꜰᴇᴛᴄʜ ɪᴍᴀɢᴇꜱ"}`);
    }
});

cmd({
    pattern: "define",
    desc: "📖 Get the Urban Dictionary definition of a word",
    react: "🔍",
    category: "tools",
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("ᴘʟᴇᴀꜱᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ᴡᴏʀᴅ ᴛᴏ ᴅᴇꜰɪɴᴇ.\n\n📌 *ᴜꜱᴀɢᴇ:* .ᴅᴇꜰɪɴᴇ [ᴡᴏʀᴅ]");

        const word = q.trim();
        const url = `https://api.princetechn.com/api/tools/define?apikey=prince&term=${encodeURIComponent(word)}`;

        const response = await axios.get(url);
        const data = response.data;

        if (!data || !data.success || !data.results || data.results.length === 0) {
            return reply("ᴡᴏʀᴅ ɴᴏᴛ ꜰᴏᴜɴᴅ. ᴘʟᴇᴀꜱᴇ ᴄʜᴇᴄᴋ ᴛʜᴇ ꜱᴘᴇʟʟɪɴɢ ᴀɴᴅ ᴛʀʏ ᴀɢᴀɪɴ.");
        }

        // Format the top 3 definitions
        const topResults = data.results.slice(0, 3);
        let definitionsText = "";

        topResults.forEach((res, index) => {
            // Remove bracket characters from Urban Dictionary formatting for cleaner text
            const cleanDefinition = res.definition.replace(/\[|\]/g, '');
            const cleanExample = res.example ? res.example.replace(/\[|\]/g, '') : 'ɴᴏ ᴇxᴀᴍᴘʟᴇ ᴀᴠᴀɪʟᴀʙʟᴇ';

            definitionsText += `
📌 *ᴅᴇꜰɪɴɪᴛɪᴏɴ ${index + 1}* (ʙʏ ${res.author || 'ᴜɴᴋɴᴏᴡɴ'})
*📖 ᴍᴇᴀɴɪɴɢ:* ${cleanDefinition}
*💬 ᴇxᴀᴍᴘʟᴇ:* ${cleanExample}
──────────────────`;
        });

        const wordInfo = `
╭━━━❏ *ᴡᴏʀᴅ*: *${word.toUpperCase()}*  ━━━━━❏
${definitionsText}
*╰▬▬▬▬▬▬▬▬▬▬▬▬▬▬❏  
> ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴘʀɪɴᴄᴇᴛᴇᴄʜ`;

        // Optionally send the audio if available
        const audio = data.results[0]?.play_sound_url;
        if (audio) {
            await conn.sendMessage(from, { audio: { url: audio }, mimetype: 'audio/mpeg' }, { quoted: anony });
        }

        return reply(wordInfo);
    } catch (e) {
        console.error("❌ ᴇʀʀᴏʀ:", e);
        return reply("ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ꜰᴇᴛᴄʜɪɴɢ ᴛʜᴇ ᴅᴇꜰɪɴɪᴛɪᴏɴ. ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ.");
    }
});

cmd({
    pattern: "prossieai",
    alias: ["assistant"],
    desc: "Enable or disable AI chatbot responses",
    category: "settings",
    filename: __filename,
    react: "✅"
}, async (conn, mek, m, { from, args, isOwner, reply, prefix }) => {
    if (!isOwner) return reply("*ᴏɴʟʏ ᴛʜᴇ ᴏᴡɴᴇʀ ᴄᴀɴ ᴀᴄᴛɪᴠᴀᴛᴇ ᴍᴇ🧚‍♀️!*");

    const mode = args[0]?.toLowerCase();
    const target = args[1]?.toLowerCase();

    if (mode === "on") {
        if (!target || target === "all") {
            AI_STATE.IB = "true";
            AI_STATE.GC = "true";
            await setConfig("AI_STATE", JSON.stringify(AI_STATE));
            return reply("ᴘʀɪᴍᴇ ʀɪᴅᴢ ᴄʜᴀᴛʙᴏᴛ ɪꜱ ɴᴏᴡ ᴇɴᴀʙʟᴇᴅ ꜰᴏʀ ʙᴏᴛʜ ɪɴʙᴏx ᴀɴᴅ ɢʀᴏᴜᴘ ᴄʜᴀᴛꜱ");
        } else if (target === "ib") {
            AI_STATE.IB = "true";
            await setConfig("AI_STATE", JSON.stringify(AI_STATE));
            return reply("ᴘʀɪᴍᴇ ʀɪᴅᴢ ᴄʜᴀᴛʙᴏᴛ ɪꜱ ɴᴏᴡ ᴇɴᴀʙʟᴇᴅ ꜰᴏʀ ɪɴʙᴏx ᴄʜᴀᴛꜱ");
        } else if (target === "gc") {
            AI_STATE.GC = "true";
            await setConfig("AI_STATE", JSON.stringify(AI_STATE));
            return reply("ᴘʀɪᴍᴇ ʀɪᴅᴢ ᴄʜᴀᴛʙᴏᴛ ɪꜱ ɴᴏᴡ ᴇɴᴀʙʟᴇᴅ ꜰᴏʀ ɢʀᴏᴜᴘ ᴄʜᴀᴛꜱ");
        }
    } else if (mode === "off") {
        if (!target || target === "all") {
            AI_STATE.IB = "false";
            AI_STATE.GC = "false";
            await setConfig("AI_STATE", JSON.stringify(AI_STATE));
            return reply("ᴘʀɪᴍᴇ ʀɪᴅᴢ ᴄʜᴀᴛʙᴏᴛ ɪꜱ ɴᴏᴡ ᴅɪꜱᴀʙʟᴇᴅ ꜰᴏʀ ʙᴏᴛʜ ɪɴʙᴏx ᴀɴᴅ ɢʀᴏᴜᴘ ᴄʜᴀᴛꜱ");
        } else if (target === "ib") {
            AI_STATE.IB = "false";
            await setConfig("AI_STATE", JSON.stringify(AI_STATE));
            return reply("ᴘʀɪᴍᴇ ʀɪᴅᴢ ᴄʜᴀᴛʙᴏᴛ ɪꜱ ɴᴏᴡ ᴅɪꜱᴀʙʟᴇᴅ ꜰᴏʀ ɪɴʙᴏx ᴄʜᴀᴛꜱ");
        } else if (target === "gc") {
            AI_STATE.GC = "false";
            await setConfig("AI_STATE", JSON.stringify(AI_STATE));
            return reply("ᴘʀɪᴍᴇ ʀɪᴅᴢ ᴄʜᴀᴛʙᴏᴛ ɪꜱ ɴᴏᴡ ᴅɪꜱᴀʙʟᴇᴅ ꜰᴏʀ ɢʀᴏᴜᴘ ᴄʜᴀᴛꜱ");
        }
    } else {
        return reply(`
╭━━━❏*𝙀𝙉𝘼𝘽𝙇𝙀 𝙎𝙀𝙏𝙏𝙄𝙉𝙂𝙎 🧚‍♀️*━━━━━❏
├•▣┃ .ᴄʜᴀᴛʙᴏᴛ ᴏɴ ᴀʟʟ - ᴇɴᴀʙʟᴇ ᴀɪ ɪɴ ᴀʟʟ ᴄʜᴀᴛꜱ
├•▣┃ .ᴄʜᴀᴛʙᴏᴛ ᴏɴ ɪʙ - ᴇɴᴀʙʟᴇ ᴀɪ ɪɴ ɪɴʙᴏx ᴏɴʟʏ
├•▣┃ .ᴄʜᴀᴛʙᴏᴛ ᴏɴ ɢᴄ - ᴇɴᴀʙʟᴇ ᴀɪ ɪɴ ɢʀᴏᴜᴘ ᴏɴʟʏ
╰▬▬▬▬▬▬▬Rɪᴅᴢ Cᴏᴅᴇʀ❦▬▬▬▬▬▬▬❏

╭━━━❏*𝘿𝙄𝙎𝘼𝘽𝙇𝙀 𝙎𝙀𝙏𝙏𝙄𝙉𝙂𝙎 🧚‍♀️*━━━━━❏
├•▣┃ .ᴄʜᴀᴛʙᴏᴛ ᴏꜰꜰ ᴀʟʟ - ᴅɪꜱᴀʙʟᴇ ᴀɪ ɪɴ ᴀʟʟ ᴄʜᴀᴛꜱ
├•▣┃ .ᴄʜᴀᴛʙᴏᴛ ᴏꜰꜰ ɪʙ - ᴅɪꜱᴀʙʟᴇ ᴀɪ ɪɴ ɪɴʙᴏx ᴏɴʟʏ
├•▣┃ .ᴄʜᴀᴛʙᴏᴛ ᴏꜰꜰ ɢᴄ - ᴅɪꜱᴀʙʟᴇ ᴀɪ ɪɴ ɢʀᴏᴜᴘ ᴏɴʟʏ
╰▬▬▬▬▬▬▬Rɪᴅᴢ Cᴏᴅᴇʀ❦▬▬▬▬▬▬▬❏

> ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴘʀɪᴍᴇ ʀɪᴅᴢ `);
    }
});

// Initialize AI state on startup
(async () => {
    const savedState = await getConfig("AI_STATE");
    if (savedState) AI_STATE = JSON.parse(savedState);
})();

// AI Chatbot - using dreaded.site API
cmd({
    on: "body"
}, async (conn, m, store, {
    from,
    body,
    sender,
    isGroup,
    isBotAdmins,
    isAdmins,
    reply,
    quotedMsg
}) => {
    try {
        // Check if message is a reply
        if (!m?.message?.extendedTextMessage?.contextInfo?.participant) {
            return; // Not a reply, ignore
        }
        
        // Check if the reply is to the bot's message
        const repliedTo = m.message.extendedTextMessage.contextInfo.participant;
        const botJid = conn.user.id.split(':')[0] + '@s.whatsapp.net';
        if (repliedTo !== botJid) {
            return; // Not replying to the bot, ignore
        }

        // Check if AI is ᴇɴᴀʙʟᴇᴅ for this chat type
        const isInbox = !isGroup;
        if ((isInbox && AI_STATE.IB !== "true") || (isGroup && AI_STATE.GC !== "true")) {
            return;
        }

        // Optional: Prevent bot responding to its own messages or commands
        if (!body || m.key.fromMe || body.startsWith(config.PREFIX)) return;

        // Handle time/date questions directly
        const lowerBody = body.toLowerCase();
        if (lowerBody.includes('time') || lowerBody.includes('date')) {
            const now = new Date();
            const options = { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                timeZoneName: 'short'
            };
            const currentDateTime = now.toLocaleDateString('en-US', options);
            return reply(`⏰ ᴄᴜʀʀᴇɴᴛ ᴅᴀᴛᴇ & ᴛɪᴍᴇ:\n${currentDateTime}\n\n> Cʀᴇᴀᴛᴇᴅ ʙʏ ᴘʀɪᴍᴇ ʀɪᴅᴢ`);
        }

        // Encode message for the query
        const query = encodeURIComponent(body);

        // Dreaded.site API Request
        const apiUrl = `https://api.dreaded.site/api/chatgpt?text=${query}`;

        const { data } = await axios.get(apiUrl);

        if (data && data.status === 200 && data.success && data.result && data.result.prompt) {
            await conn.sendMessage(from, {
                text: data.result.prompt + "\n\n> Cʀᴇᴀᴛᴇᴅ ʙʏ ᴘʀɪᴍᴇ ʀɪᴅᴢ "
            }, { quoted: m });
        } else {
            reply("ᴀɪ ꜰᴀɪʟᴇᴅ ᴛᴏ ɢᴇɴᴇʀᴀᴛᴇ ᴀ ʀᴇꜱᴘᴏɴꜱᴇ.");
        }

    } catch (err) {
        console.error("AI Chatbot Error:", err.message);
        reply("ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ᴄᴏɴᴛᴀᴄᴛɪɴɢ ᴛʜᴇ ᴀɪ.");
    }
});


cmd({
    pattern: "chr",
    alias: ["chreact"],
    react: "🔤",
    desc: "React to channel messages with stylized text",
    category: "owner",
    use: '.chr <channel-link> <text>',
    filename: __filename
},
async (conn, mek, m, { from, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isCreator, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply }) => {
    try {
        if (!isCreator) return reply("ᴏᴡɴᴇʀ ᴏɴʟʏ ᴄᴏᴍᴍᴀɴᴅ");
        if (!q) return reply(`Usage:\n${command} https://whatsapp.com/channel/1234567890 hello`);

        const [link, ...textParts] = q.split(' ');
        if (!link.includes("whatsapp.com/channel/")) return reply("ɪɴᴠᴀʟɪᴅ ᴄʜᴀɴɴᴇʟ ʟɪɴᴋ ꜰᴏʀᴍᴀᴛ");
        
        const inputText = textParts.join(' ').toLowerCase();
        if (!inputText) return reply("ᴘʟᴇᴀꜱᴇ ᴘʀᴏᴠɪᴅᴇ ᴛᴇxᴛ ᴛᴏ ᴄᴏɴᴠᴇʀᴛ");

        const emoji = inputText
            .split('')
            .map(char => {
                if (char === ' ') return '―';
                return stylizedChars[char] || char;
            })
            .join('');

        const channelId = link.split('/')[4];
        const messageId = link.split('/')[5];
        if (!channelId || !messageId) return reply("ɪɴᴠᴀʟɪᴅ ʟɪɴᴋ  - ᴍɪꜱꜱɪɴɢ  ɪᴅꜱ");

        const channelMeta = await conn.newsletterMetadata("invite", channelId);
        await conn.newsletterReactMessage(channelMeta.id, messageId, emoji);

        return reply(`
╭━━━❏ *ᴘʀɪᴍᴇ ʀɪᴅᴢ* ━━━━━❏
├•▣┃ *ꜱᴜᴄᴄᴇꜱ!* ʀᴇᴀᴄᴛɪᴏɴ ꜱᴇɴᴛ 
├•▣┃ *ᴄʜᴀɴɴᴇʟ:* ${channelMeta.name}
├•▣┃ *ʀᴇᴀᴄᴛɪᴏɴ:* ${emoji}
├•▣┃ *ʟɪɴᴋ:* https://ridzcoder.xyz
╰▬▬▬▬▬▬▬▬▬▬▬▬▬▬❏
> *© Cʀᴇᴀᴛᴇᴅ ʙʏ Rɪᴅᴢ Cᴏᴅᴇʀ ♡*`);
    } catch (e) {
        console.error(e);
        reply(`ᴇʀʀᴏʀ: ${e.message || "ꜰᴀɪʟᴇᴅ ᴛᴏ ꜱᴇɴᴅ ʀᴇᴀᴄᴛɪᴏɴ"}`);
    }
});

cmd({
    pattern: "block",
    desc: "Blocks a person",
    category: "owner",
    react: "🚫",
    filename: __filename
},
async (conn, m, { reply, q, react }) => {
    // Get the bot owner's number dynamically
    const botOwner = conn.user.id.split(":")[0] + "@s.whatsapp.net";
    
    if (m.sender !== botOwner) {
        await react("❌");
        return reply("ᴏɴʟʏ ᴛʜᴇ ʙᴏᴛ ᴏᴡɴᴇʀ ᴄᴀɴ ᴜꜱᴇ ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ.");
    }

    let jid;
    if (m.quoted) {
        jid = m.quoted.sender; // If replying to a message, get sender JID
    } else if (m.mentionedJid.length > 0) {
        jid = m.mentionedJid[0]; // If mentioning a user, get their JID
    } else if (q && q.includes("@")) {
        jid = q.replace(/[@\s]/g, '') + "@s.whatsapp.net"; // If manually typing a JID
    } else {
        await react("❌");
        return reply("ᴘʟᴇᴀꜱᴇ ᴍᴇɴᴛɪᴏɴ ᴀ ᴜꜱᴇʀ ᴏʀ ʀᴇᴘʟʏ ᴛᴏ ᴛʜᴇɪʀ ᴍᴇꜱꜱᴀɢᴇꜱ.");
    }

    try {
        await conn.updateBlockStatus(jid, "block");
        await react("✅");
        reply(`ꜱᴜᴄᴄᴇꜱꜱꜰᴜʟʏ ʙʟᴏᴄᴋᴇᴅ @${jid.split("@")[0]}`, { mentions: [jid] });
    } catch (error) {
        console.error("Block command error:", error);
        await react("❌");
        reply("ꜰᴀɪʟᴇᴅ ᴛᴏ ʙʟᴏᴄᴋ ᴜꜱᴇʀ.");
    }
});

cmd({
    pattern: "unblock",
    desc: "Unblocks a person",
    category: "owner",
    react: "🔓",
    filename: __filename
},
async (conn, m, { reply, q, react }) => {
    // Get the bot owner's number dynamically
    const botOwner = conn.user.id.split(":")[0] + "@s.whatsapp.net";

    if (m.sender !== botOwner) {
        await react("❌");
        return reply("ᴏɴʟʏ ᴛʜᴇ ʙᴏᴛ ᴏᴡɴᴇʀ ᴄᴀɴ ᴜꜱᴇ ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ.");
    }

    let jid;
    if (m.quoted) {
        jid = m.quoted.sender;
    } else if (m.mentionedJid.length > 0) {
        jid = m.mentionedJid[0];
    } else if (q && q.includes("@")) {
        jid = q.replace(/[@\s]/g, '') + "@s.whatsapp.net";
    } else {
        await react("❌");
        return reply("ᴘʟᴇᴀꜱᴇ ᴍᴇɴᴛɪᴏɴ ᴀ ᴜꜱᴇʀ ᴏʀ ʀᴇᴘʟʏ ᴛᴏ ᴛʜᴇɪʀ ᴍᴇꜱꜱᴀɢᴇꜱ.");
    }

    try {
        await conn.updateBlockStatus(jid, "unblock");
        await react("✅");
        reply(`ꜱᴜᴄᴇꜱꜱꜰᴜʟʟʏ ᴜɴʙʟᴏᴄᴋᴇᴅ @${jid.split("@")[0]}`, { mentions: [jid] });
    } catch (error) {
        console.error("Unblock command error:", error);
        await react("❌");
        reply("ꜰᴀɪʟᴇᴅ ᴛᴏ ᴜɴʙʟᴏᴄᴋ ᴜꜱᴇʀ.");
    }
});           
//ᴛʀʏᴘɪɴɢ ᴄᴏᴍᴍᴀɴᴅ
cmd({
    on: "body"
},    
async (conn, mek, m, { from, body, isOwner }) => {
    if (config.AUTO_TYPING === 'true') {
        await conn.sendPresenceUpdate('composing', from); // send typing 
    }
});

// ᴀᴜᴛᴏ ꜱᴛɪᴄᴋᴇʀ
cmd({
  on: "body"
},
async (conn, mek, m, { from, body }) => {
    const filePath = path.join(__dirname, '../assets/autosticker.json');
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    for (const text in data) {
        if (body.toLowerCase() === text.toLowerCase()) {
            if (config.AUTO_STICKER === 'true') {
                const stickerPath = path.join(__dirname, '../assets/autosticker', data[text]);

                if (fs.existsSync(stickerPath)) {
                    const stickerBuffer = fs.readFileSync(stickerPath);

                    await conn.sendMessage(from, {
                        sticker: stickerBuffer,
                        packname: 'ᴘʀɪᴍᴇ ʀɪᴅᴢ',
                        author: 'ʀɪᴅᴢ ᴄᴏᴅᴇʀ'
                    }, { quoted: mek });
                } else {
                    console.warn(`ꜱᴛɪᴄᴋᴇʀ ɴᴏᴛ ꜰᴏᴜɴᴅ: ${stickerPath}`);
                }
            }
        }
    }
});

// ᴀᴜᴛᴏ ʀᴇᴘʟʏ 
cmd({
  on: "body"
},    
async (conn, mek, m, { from, body, isOwner }) => {
    const filePath = path.join(__dirname, '../assets/autoreply.json');
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    for (const text in data) {
        if (body.toLowerCase() === text.toLowerCase()) {
            
            if (config.AUTO_REPLY === 'true') {
                //if (isOwner) return;        
                await m.reply(data[text])
            
            }
        }
    }                
});

//ᴀᴜᴛᴏ ʀᴇᴄᴏʀᴅɪɴɢ

cmd({
  on: "body"
},    
async (conn, mek, m, { from, body, isOwner }) => {       
 if (config.AUTO_RECORDING === 'true') {
                await conn.sendPresenceUpdate('recording', from);
            }
         } 
   );
   
// ᴠɪᴇᴡ ᴏɴᴄᴇ 

cmd({
  pattern: "vv",
  alias: ["viewonce", 'retrive'],
  react: '🐳',
  desc: "Owner Only - retrieve quoted message back to user",
  category: "owner",
  filename: __filename
}, async (client, message, match, { from, isCreator }) => {
  try {
    if (!isCreator) {
      return await client.sendMessage(from, {
        text: "*📛 This is an owner command.*"
      }, { quoted: anony });
    }

    if (!match.quoted) {
      return await client.sendMessage(from, {
        text: "*ᴘʟᴇᴀꜱᴇ ʀᴇᴘʟʏ ᴛᴏ ᴀ ᴠɪᴇᴡ ᴏɴᴄᴇ ᴍᴇꜱꜱᴀɢᴇ!*"
      }, { quoted: anony });
    }

    const buffer = await match.quoted.download();
    const mtype = match.quoted.mtype;
    const options = { quoted: message };

    let messageContent = {};
    switch (mtype) {
      case "imageMessage":
        messageContent = {
          image: buffer,
          caption: match.quoted.text || '',
          mimetype: match.quoted.mimetype || "image/jpeg"
        };
        break;
      case "videoMessage":
        messageContent = {
          video: buffer,
          caption: match.quoted.text || '',
          mimetype: match.quoted.mimetype || "video/mp4"
        };
        break;
      case "audioMessage":
        messageContent = {
          audio: buffer,
          mimetype: "audio/mp4",
          ptt: match.quoted.ptt || false
        };
        break;
      default:
        return await client.sendMessage(from, {
          text: "ᴏɴʟʏ ɪᴍᴀɢᴇ, ᴠɪᴅᴇᴏ, ᴀɴᴅ ᴀᴜᴅɪᴏ ᴍᴇꜱꜱᴀɢᴇꜱ ᴀʀᴇ ꜱᴜᴘᴘᴏʀᴛᴇᴅ"
        }, { quoted: anony });
    }

    await client.sendMessage(from, messageContent, options);
  } catch (error) {
    console.error("vv Error:", error);
    await client.sendMessage(from, {
      text: "ᴇʀʀᴏʀ ꜰᴇᴛᴄʜɪɴɢ ᴠᴠ ᴍᴇꜱꜱᴀɢᴇ:\n" + error.message
    }, { quoted: anony });
  }
});

cmd({
  pattern: "vv2",
  alias: ["wah", "ohh", "oho", "🙂", "😂", "❤️", "💋", "🥵", "🌚", "😒", "nice", "ok"],
  desc: "Owner Only - retrieve quoted message back to user",
  category: "owner",
  filename: __filename
}, async (client, message, match, { from, isCreator }) => {
  try {
    if (!isCreator) {
      return;
    }

    if (!match.quoted) {
      return await client.sendMessage(from, {
        text: "*ᴘʟᴇᴀꜱᴇ ʀᴇᴘʟʏ ᴛᴏ ᴀ ᴠɪᴇᴡ ᴏɴᴄᴇ ᴍᴇꜱꜱᴀɢᴇ!*"
      }, { quoted: anony });
    }

    const buffer = await match.quoted.download();
    const mtype = match.quoted.mtype;
    const options = { quoted: anony };

    let messageContent = {};
    switch (mtype) {
      case "imageMessage":
        messageContent = {
          image: buffer,
          caption: match.quoted.text || '',
          mimetype: match.quoted.mimetype || "image/jpeg"
        };
        break;
      case "videoMessage":
        messageContent = {
          video: buffer,
          caption: match.quoted.text || '',
          mimetype: match.quoted.mimetype || "video/mp4"
        };
        break;
      case "audioMessage":
        messageContent = {
          audio: buffer,
          mimetype: "audio/mp4",
          ptt: match.quoted.ptt || false
        };
        break;
      default:
        return await client.sendMessage(from, {
          text: "ᴏɴʟʏ ɪᴍᴀɢᴇ, ᴠɪᴅᴇᴏ, ᴀɴᴅ ᴀᴜᴅɪᴏ ᴍᴇꜱꜱᴀɢᴇꜱ ᴀʀᴇ ꜱᴜᴘᴘᴏʀᴛᴇᴅ"
        }, { quoted: anony });
    }


    await client.sendMessage(message.sender, messageContent, options);
  } catch (error) {
    console.error("vv Error:", error);
    await client.sendMessage(from, {
      text: "ᴇʀʀᴏʀ ꜰᴇᴛᴄʜɪɴɢ ᴠᴠ ᴍᴇꜱꜱᴀɢᴇ:\n" + error.message
    }, { quoted: anony });
  }
});

// Anti-Bad Words System
cmd({
  'on': "body"
}, async (conn, m, store, {
  from,
  body,
  isGroup,
  isAdmins,
  isBotAdmins,
  reply,
  sender
}) => {
  try {
    const badWords = [
  "ass", "asshole", "asses", "assholes", "bitch", "bitches", "bullshit", "crap", "cunt", "cunts", "damn", "dick", "dicks", "dumbass", "fuck", "fucker", "fucking", "fucked", "motherfucker", "motherfucking", "shit", "shitting", "piss", "pissing", "prick", "pricks", "pussy", "slut", "sluts", "whore", "whores", "retard", "retarded","sex", "xxx", "porn", "nude", "nudes", "dickpic", "dickpic", "cock", "cocks", "tits", "boobs", "blowjob", "handjob", "jerkoff", "orgy", "orgasm", "penis", "vagina", "bdsm", "fetish","fart", "farts", "farting", "poop", "pooping", "crap", "crapping", "butt", "butthole", "anal","nigger", "nigga", "niggers", "chink", "gook", "kike", "spic", "wetback", "gypsy", "paki", "raghead", "towelhead", "cracker", "redneck", "fag", "faggot", "fags", "dyke", "dykes", "tranny", "shemale", "homo", "queer", "poof", "lesbo", "retard", "retarded", "cripple", "midget", "spaz","huththa", "hutto", "pakaya", "ponnaya", "balla", "ballo", "gonna", "goni", "gona", "hariya", "oli", "oliya", "kella", "kellawa", "kellage", "kellageda", "pako", "pari", "karaya", "karaw", "bithara", "bithare", "thopi", "thoppi", "miniha", "minihawa", "gahaniya", "gahaniye", "bokke", "bokka", "bokka", "hukanna", "hukane", "otha", "othe", "musna", "musne", "vesi", "vesiya", "vesige", "vesigeda", "lanja", "lanje", "lansi", "lansee", "monada", "mokada", "moka", "pissu", "pissuwa", "pissune", "unama", "umba", "umbata", "umbaagen", "umbaagena","sootha", "sootha", "soothang", "punda", "pundai", "pundam", "poolu", "pool", "poola", "lingam", "linga", "kunja", "kunne", "kundi", "kundiman", "theriyadu", "theriyama", "mairu", "mayiru", "nayee", "naai", "pathti", "pathti", "keesu", "kees", "otha", "othe", "vesi", "vesiya", "molacha", "molachu"
];

    if (!isGroup || isAdmins || !isBotAdmins) {
      return;
    }

    const messageText = body.toLowerCase();
    const containsBadWord = badWords.some(word => messageText.includes(word));

    if (containsBadWord && config.ANTI_BAD_WORD === 'true') {
      await conn.sendMessage(from, { 'delete': m.key }, { 'quoted': m });
      await conn.sendMessage(from, { 'text': "ʙᴀᴅ ᴡᴏʀᴅꜱ ɴᴏᴛ ᴀʟʟᴏᴡᴇᴅ ⚠️ 🚫" }, { 'quoted': anony });
    }
  } catch (error) {
    console.error(error);
    reply("ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ᴘʀᴏᴄᴇꜱꜱɪɴɢ ᴛʜᴇ ᴍᴇꜱꜱᴀɢᴇ.");
  }
});

cmd({
  'on': "body"
}, async (conn, m, store, {
  from,
  body,
  sender,
  isGroup,
  isAdmins,
  isBotAdmins,
  reply
}) => {
  try {
    if (!isGroup || isAdmins || !isBotAdmins) {
      return;
    }

    const containsLink = linkPatterns.some(pattern => pattern.test(body));

    if (containsLink && config.ANTI_LINK === 'true') {
      await conn.sendMessage(from, { 'delete': m.key }, { 'quoted': m });
      await conn.sendMessage(from, {
        'text': `ʟɪɴᴋꜱ ᴀʀᴇ ɴᴏᴛ ᴀʟʟᴏᴡᴇᴅ ɪɴ ᴛʜɪꜱ ɢʀᴏᴜᴘ.\n@${sender.split('@')[0]} ʜᴀꜱ ʙᴇᴇɴ ʀᴇᴍᴏᴠᴇᴅ. 🚫`,
        'mentions': [sender]
      }, { 'quoted': anony });

      await conn.groupParticipantsUpdate(from, [sender], "remove");
    }
  } catch (error) {
    console.error(error);
    reply("ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ᴘʀᴏᴄᴇꜱꜱɪɴɢ ᴛʜᴇ ᴍᴇꜱꜱᴀɢᴇ.");
  }
});

cmd({
    pattern: "antidelete",
    alias: ['antidel', 'del'],
    desc: "Toggle anti-delete feature",
    category: "owner",
    filename: __filename
},
async (conn, mek, m, { from, reply, text, isCreator }) => {
    if (!isCreator) return reply('ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ ᴄᴀɴ ᴏɴʟʏ ʙᴇ ᴜꜱᴇᴅ ʙʏ ʙᴏᴛ ᴏᴡɴᴇʀꜱ');
    
    try {
        const currentStatus = await getAnti();
        
        if (!text || text.toLowerCase() === 'status') {
            return reply(`*ᴀɴᴛɪᴅᴇʟᴇᴛᴇ ꜱᴛᴀᴛᴜꜱ:* ${currentStatus ? '✅ ON' : '❌ OFF'}\n\nUsage:\n• .antidelete on - Enable\n• .antidelete off - Disable`);
        }
        
        const action = text.toLowerCase().trim();
        
        if (action === 'on') {
            await setAnti(true);
            return reply('✅ ᴀɴᴛɪ-ᴅᴇʟᴇᴛᴇ ʜᴀꜱ ʙᴇᴇɴ ᴇɴᴀʙʟᴇᴅ');
        } 
        else if (action === 'off') {
            await setAnti(false);
            return reply('❌ ᴀɴᴛɪ-ᴅᴇʟᴇᴛᴇ ʜᴀꜱ ʙᴇᴇɴ ᴅɪꜱᴀʙʟᴇᴅ');
        } 
        else {
            return reply('ɪɴᴠᴀʟɪᴅ ᴄᴏᴍᴍᴀɴᴅ. ᴜꜱᴀɢᴇ:\n• .antidelete on\n• .antidelete off\n• .antidelete status');
        }
    } catch (e) {
        console.error("Error in antidelete command:", e);
        return reply("ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ᴘʀᴏᴄᴇꜱꜱɪɴɢ ʏᴏᴜʀ ʀᴇQᴜᴇꜱᴛ.");
    }
});

cmd({
    pattern: "config",
    alias: ["varlist", "envlist"],
    desc: "Show all bot configuration variables (Owner Only)",
    category: "owner",
    react: "⚙️",
    filename: __filename
}, 
async (conn, mek, m, { from, quoted, reply, isCreator }) => {
    try {
        if (!isCreator) {
            return reply("ᴏᴡɴᴇʀ ᴏɴʟʏ ᴄᴏᴍᴍᴀɴᴅ!* ʏᴏᴜ'ʀᴇ ɴᴏᴛ ᴀᴜᴛʜᴏʀɪᴢᴇᴅ ᴛᴏ ᴠɪᴇᴡ ʙᴏᴛ ᴄᴏɴꜰɪɢᴜʀᴀᴛɪᴏɴꜱ.");
        }

        let envSettings = `
╭───『 *${config.BOT_NAME} 𝘾𝙊𝙉𝙁𝙄𝙂* 』───❏
│
├─❏ * 𝘽𝙊𝙏 𝙄𝙉𝙁𝙊 *
│  ├─∘ *ɴᴀᴍᴇ:* ${config.BOT_NAME}
│  ├─∘ *ᴘʀᴇꜰɪx:* ${config.PREFIX}
│  ├─∘ *ᴏᴡɴᴇʀ:* ${config.OWNER_NAME}
│  ├─∘ *ɴᴜᴍʙᴇʀ:* ${config.OWNER_NUMBER}
│  └─∘ *ᴍᴏᴅᴇ:* ${config.MODE.toUpperCase()}
│
├─❏ * 𝘾𝙊𝙍𝙀 𝙎𝙀𝙏𝙏𝙄𝙉𝙂𝙎*
│  ├─∘ *ᴘᴜʙʟɪᴄ ᴍᴏᴅᴇ:* ${isEnabled(config.PUBLIC_MODE) ? "✅" : "❌"}
│  ├─∘ *ᴀʟᴡᴀʏꜱ ᴏɴʟɪɴᴇ:* ${isEnabled(config.ALWAYS_ONLINE) ? "✅" : "❌"}
│  ├─∘ *ʀᴇᴀᴅ ᴍꜱɢꜱ:* ${isEnabled(config.READ_MESSAGE) ? "✅" : "❌"}
│  └─∘ *ʀᴇᴀᴅ ᴄᴍᴅꜱ:* ${isEnabled(config.READ_CMD) ? "✅" : "❌"}
│
├─❏ * 𝘼𝙐𝙏𝙊𝙈𝘼𝙏𝙄𝙊𝙉*
│  ├─∘ *ᴀᴜᴛᴏ ʀᴇᴘʟʏ:* ${isEnabled(config.AUTO_REPLY) ? "✅" : "❌"}
│  ├─∘ *ᴀᴜᴛᴏ ʀᴇᴀᴄᴛ:* ${isEnabled(config.AUTO_REACT) ? "✅" : "❌"}
│  ├─∘ *ᴄᴜꜱᴛᴏᴍ ʀᴇᴀᴄᴛ:* ${isEnabled(config.CUSTOM_REACT) ? "✅" : "❌"}
│  ├─∘ *ʀᴇᴀᴄᴛ ᴇᴍᴏᴊɪꜱ:* ${config.CUSTOM_REACT_EMOJIS}
│  ├─∘ *ᴀᴜᴛᴏ ꜱᴛɪᴄᴋᴇʀ:* ${isEnabled(config.AUTO_STICKER) ? "✅" : "❌"}
│
├─❏ * 𝙎𝙏𝘼𝙏𝙐𝙎 𝙎𝙀𝙏𝙏𝙄𝙉𝙂𝙎*
│  ├─∘ *ꜱᴛᴀᴛᴜꜱ ꜱᴇᴇɴ:* ${isEnabled(config.AUTO_STATUS_SEEN) ? "✅" : "❌"}
│  ├─∘ *ꜱᴛᴀᴛᴜꜱ ʀᴇᴘʟʏ:* ${isEnabled(config.AUTO_STATUS_REPLY) ? "✅" : "❌"}
│  ├─∘ *ꜱᴛᴀᴛᴜꜱ ʀᴇᴀᴄᴛ:* ${isEnabled(config.AUTO_STATUS_REACT) ? "✅" : "❌"}
│  └─∘ *ꜱᴛᴀᴛᴜꜱ ᴍꜱɢ:* ${config.AUTO_STATUS_MSG}
│
├─❏ * 𝙎𝙀𝘾𝙐𝙍𝙄𝙏𝙔*
│  ├─∘ *ᴀɴᴛɪ-ʟɪɴᴋ:* ${isEnabled(config.ANTI_LINK) ? "✅" : "❌"}
│  ├─∘ *ᴀɴᴛɪ-ʙᴀᴅ:* ${isEnabled(config.ANTI_BAD) ? "✅" : "❌"}
│  ├─∘ *ᴀɴᴛɪ-ᴠᴠ:* ${isEnabled(config.ANTI_VV) ? "✅" : "❌"}
│  └─∘ *ᴅᴇʟ ʟɪɴᴋꜱ:* ${isEnabled(config.DELETE_LINKS) ? "✅" : "❌"}
│
├─❏ * 𝙈𝙀𝘿𝙄𝘼*
│  ├─∘ *ᴀʟɪᴠᴇ ɪᴍɢ:* ${config.ALIVE_IMG}
│  ├─∘ *ᴍᴇɴᴜ ɪᴍɢ:* ${config.MENU_IMAGE_URL}
│  ├─∘ *ᴀʟɪᴠᴇ ᴍꜱɢ:* ${config.LIVE_MSG}
│  └─∘ *ꜱᴛɪᴄᴋᴇʀ ᴘᴀᴄᴋ:* ${config.STICKER_NAME}
│
├─❏ * 𝙈𝙄𝙎𝘾*
│  ├─∘ *ᴀᴜᴛᴏ ᴛʏᴘɪɴɢ:* ${isEnabled(config.AUTO_TYPING) ? "✅" : "❌"}
│  ├─∘ *ᴀᴜᴛᴏ ʀᴇᴄᴏʀᴅ:* ${isEnabled(config.AUTO_RECORDING) ? "✅" : "❌"}
│  ├─∘ *ᴀɴᴛɪ-ᴅᴇʟ ᴘᴀᴛʜ:* ${config.ANTI_DEL_PATH}
│  └─∘ *ᴅᴇᴠ ɴᴜᴍʙᴇʀ:* ${config.DEV}
│
╰───『 *${config.DESCRIPTION}* 』───❏
`;

        await conn.sendMessage(
            from,
            {
                image: { url: config.MENU_IMAGE_URL },
                caption: envSettings,
                contextInfo: {
                    mentionedJid: [m.sender],
                    forwardingScore: 999,
                    isForwarded: true
                }
            },
            { quoted: mek }
        );

    } catch (error) {
        console.error('Env command error:', error);
        reply(`ᴇʀʀᴏʀ ᴅɪꜱᴘʟᴀʏɪɴɢ ᴄᴏɴꜰɪɢ: ${error.message}`);
    }
});



cmd({
  pattern: "ship",
  alias: ["match", "love"],
  desc: "Randomly pairs the command user with another group member.",
  react: "❤️",
  category: "fun",
  filename: __filename
}, async (conn, m, store, { from, isGroup, groupMetadata, reply, sender }) => {
  try {
    if (!isGroup) return reply("ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ ᴄᴀɴ ᴏɴʟʏ ʙᴇ ᴜꜱᴇᴅ ɪɴ ɢʀᴏᴜᴘꜱ.");

    const specialNumber = config.DEV ? `${config.DEV}@s.whatsapp.net` : null; // Convert to WhatsApp format
    const participants = groupMetadata.participants.map(user => user.id);
    
    let randomPair;

    if (specialNumber && participants.includes(specialNumber) && sender !== specialNumber) {
      randomPair = specialNumber; // Always pair with this number if available
    } else {
      // Pair randomly but ensure user is not paired with themselves
      do {
        randomPair = participants[Math.floor(Math.random() * participants.length)];
      } while (randomPair === sender);
    }

    const message = `ᴍᴀᴛᴄʜ ꜰᴏᴜɴᴅ\n❤️ @${sender.split("@")[0]} + @${randomPair.split("@")[0]}\n💖 ᴄᴏɴɢꜱ! 🎉`;

    await conn.sendMessage(from, {
      text: message,
      contextInfo: {
        mentionedJid: [sender, randomPair],
        forwardingScore: 999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
          newsletterJid: "120363404529319592@newsletter",
          newsletterName: "ʀᴄʟᴀʙꜱ",
          serverMessageId: 143
        }
      }
    });

  } catch (error) {
    console.error("❌ Error in ship command:", error);
    reply("ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ᴘʀᴏᴄᴇꜱꜱɪɴɢ ᴛʜᴇ ᴄᴏᴍᴍᴀɴᴅ.ᴘʟᴇᴀꜱᴇ ᴛʀʏ ᴀɢᴀɪɴ.");
  }
});

cmd({
  pattern: "boy",
  alias: ["larka"],
  desc: "Randomly selects a boy from the group",
  react: "👦",
  category: "fun",
  filename: __filename
}, async (conn, mek, store, { isGroup, groupMetadata, reply }) => {
  try {
    if (!isGroup) return reply("ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ ᴄᴀɴ ᴏɴʟʏ ʙᴇ ᴜꜱᴇᴅ ɪɴ ɢʀᴏᴜᴘꜱ!");
    if (!groupMetadata?.participants) return reply("ᴄᴏᴜʟᴅ'ɴᴛ ꜰᴇᴛᴄʜ ɢʀᴏᴜᴘ ᴍᴇᴍʙᴇʀꜱ.");

    const botNumber = conn.user.id;
    const participants = groupMetadata.participants.filter(p => p.id !== botNumber);

    if (participants.length < 1) return reply("ɴᴏ ᴇʟɪɢɪʙʟᴇ ᴘᴀʀᴛɪᴄɪᴘᴀɴᴛꜱ ꜰᴏᴜɴᴅ!");

    const randomUser = participants[Math.floor(Math.random() * participants.length)];

    await conn.sendMessage(
      mek.chat,
      {
        text: `👦 *ᴏʜʜ ʏᴇᴀʜ!*\n\n@${randomUser.id.split('@')[0]} ɪꜱ ʏᴏᴜʀ ʜᴀɴᴅꜱᴏᴍᴇ ʙᴏʏ`,
        mentions: [randomUser.id]
      },
      { quoted: mek }
    );
  } catch (error) {
    console.error("Error in .bacha command:", error);
    reply("ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ꜱᴇʟᴇᴄᴛɪɴɢ ʙᴏʏ.");
  }
});

cmd({
  pattern: "girl",
  alias: ["kuri", "larki"],
  desc: "Randomly selects a girl from the group",
  react: "👧",
  category: "fun",
  filename: __filename
}, async (conn, mek, store, { isGroup, groupMetadata, reply }) => {
  try {
    if (!isGroup) return reply("ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ ᴄᴀɴ ᴏɴʟʏ ʙᴇ ᴜꜱᴇᴅ ɪɴ ɢʀᴏᴜᴘꜱ");
    if (!groupMetadata?.participants) return reply("ᴄᴏᴜʟᴅ'ɴᴛ ꜰᴇᴛᴄʜ ɢʀᴏᴜᴘ ᴍᴇᴍʙᴇʀꜱ.");

    const botNumber = conn.user.id;
    const participants = groupMetadata.participants.filter(p => p.id !== botNumber);

    if (participants.length < 1) return reply("ɴᴏ ᴇʟɪɢɪʙʟᴇ ᴘᴀʀᴛɪᴄɪᴘᴀɴᴛꜱ ꜰᴏᴜɴᴅ!");

    const randomUser = participants[Math.floor(Math.random() * participants.length)];

    await conn.sendMessage(
      mek.chat,
      {
        text: `👧 *ᴏʜʜ ʏᴇᴀʜ *\n\n@${randomUser.id.split('@')[0]} ɪꜱ ʏᴏᴜʀ ɢɪʀʟ`,
        mentions: [randomUser.id]
      },
      { quoted: mek }
    );
  } catch (error) {
    console.error("Error in .bachi command:", error);
    reply("ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ꜱᴇʟᴇᴄᴛɪɴɢ ɢɪʀʟ.");
  }
});

cmd({
    pattern: "pickup",
    alias: ["pickupline", "flirtline"],
    desc: "Get a random pickup line",
    react: "💘",
    category: "fun",
    use: '.pickup',
    filename: __filename
},
async (conn, mek, m, { from, reply }) => {
    try {
        const { data } = await axios.get('https://apis.davidcyriltech.my.id/pickupline');
        
        if (!data.success) return reply("ꜰᴀɪʟᴇꜰ ᴛᴏ ᴘɪᴄᴋᴜᴘ ʟɪɴᴇ. ᴛʀʏ ᴀɢᴀɪɴ!");
        
        await reply(`ᴘɪᴄᴋᴜᴘ ʟɪɴᴇ\n\n"${data.pickupline}"\n\nᴜꜱᴇ ᴡɪꜱᴇʟʏ`);
        
    } catch (error) {
        console.error('Pickup Error:', error);
        reply("ᴍʏ ᴄʜᴀʀᴍ ɪꜱɴ'ᴛ ᴡᴏʀᴋɪɴɢ ʀɪɢʜᴛ ɴᴏᴡ.ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ!");
    }
});

cmd({
  pattern: "joke",
  desc: "😂 Get a random joke",
  react: "🤣",
  category: "fun",
  filename: __filename
}, async (conn, m, store, { reply }) => {
  try {
    const response = await axios.get("https://official-joke-api.appspot.com/random_joke");
    const joke = response.data;

    if (!joke || !joke.setup || !joke.punchline) {
      return reply("ꜰᴀɪʟᴇᴅ ᴛᴏ ꜰᴇᴛᴄʜ ᴊᴏᴋᴇ.ᴘʟᴇᴀꜱᴇ ᴛʀʏ ᴀɢᴀɪɴ.");
    }

    const jokeMessage = `ʜᴇʀᴇ ɪꜱ ᴀ ʀᴀɴᴅᴏᴍ ᴊᴏᴋᴇ ꜰᴏʀ ʏᴏᴜ \n\n*${joke.setup}*\n\n${joke.punchline} 😆\n\n> *©ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴘʀɪᴍᴇ ʀɪᴅᴢ*`;

    return reply(jokeMessage);
  } catch (error) {
    console.error("❌ Error in joke command:", error);
    return reply("ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ꜰᴇᴛᴄʜɪɴɢ ᴊᴏᴋᴇ.ᴘʟᴇᴀꜱᴇ ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ.");
  }
});

cmd({
    pattern: "flirt",
    alias: ["line"],
    desc: "Get a random flirty message",
    react: "😘",
    category: "fun",
    use: '.flirt',
    filename: __filename
},
async (conn, mek, m, { from, reply }) => {
    try {
        const apiUrl = 'https://shizoapi.onrender.com/api/texts/flirt?apikey=shizo';
        
        const { data } = await axios.get(apiUrl);
        
        if (!data.result) {
            return reply("ᴄᴏᴜʟᴅɴ'ᴛ ꜰᴇᴛᴄʜ ᴀ ꜰʟɪʀᴛʏ ᴍᴇꜱꜱᴀɢᴇ.ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ");
        }
        
        const flirtMessage = `${data.result}
`.trim();

        await reply(flirtMessage);
        
    } catch (error) {
        console.error('Flirt Error:', error);
        reply("ꜰᴀɪʟᴇᴅ ᴛᴏ ꜰᴇᴛᴄʜ ᴀ ꜰʟɪʀᴛʏ ᴍᴇꜱꜱᴀɢᴇ. ᴍᴀʏʙᴇ ᴛʀʏ ʙᴇɪɴɢ ʀᴏᴍᴀɴᴛɪᴄ ʏᴏᴜʀꜱᴇʟꜰ?");
    }
});

cmd({
  pattern: "quote",
  desc: "Get a random inspiring quote.",
  category: "fun",
  react: "💬",
  filename: __filename
}, async (conn, m, store, { from, reply }) => {
  try {
    const response = await axios.get("https://api.quotable.io/random");
    const { content, author } = response.data;

    const message = `💬 *"${content}"*\n- ${author}\n\n> *Qᴜᴏᴛᴇꜱ ʙʏ ᴘʀɪᴍᴇ ʀɪᴅᴢ*`;
    reply(message);
  } catch (error) {
    console.error("Error fetching quote:", error);
    reply("ᴀᴘɪ ɪꜱꜱᴜᴇꜱ ᴏʀ ʙᴀᴄᴋᴇɴᴅ ᴇʀʀᴏʀ, ᴘʟᴇᴀꜱᴇ ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ!");
  }
});

cmd({
  pattern: "marige",
  alias: ["shadi", "marriage", "wedding"],
  desc: "Randomly pairs two users for marriage with a wedding GIF",
  react: "💍",
  category: "fun",
  filename: __filename
}, async (conn, mek, store, { isGroup, groupMetadata, reply, sender }) => {
  try {
    if (!isGroup) return reply("ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ ᴄᴀɴ ᴏɴʟʏ ʙᴇ ᴜꜱᴇᴅ ɪɴ ɢʀᴏᴜᴘꜱ!");

    const participants = groupMetadata.participants.map(user => user.id);
    
    // Filter out the sender and bot number if needed
    const eligibleParticipants = participants.filter(id => id !== sender && !id.includes(conn.user.id.split('@')[0]));
    
    if (eligibleParticipants.length < 1) {
      return reply("ɴᴏᴛ ᴇɴᴏᴜɢʜ ᴘᴀʀᴛɪᴄɪᴘᴀɴᴛꜱ ᴛᴏ ᴘᴇʀꜰᴏʀᴍ ᴀ ᴍᴀʀʀɪᴀɢᴇ!");
    }

    // Select random pair
    const randomIndex = Math.floor(Math.random() * eligibleParticipants.length);
    const randomPair = eligibleParticipants[randomIndex];

    // Fetch wedding GIF
    const apiUrl = "https://api.waifu.pics/sfw/hug"; // Using kiss as wedding GIF
    let res = await axios.get(apiUrl);
    let gifUrl = res.data.url;

    let gifBuffer = await fetchGif(gifUrl);
    let videoBuffer = await gifToVideo(gifBuffer);

    const message = `💍 *ꜱʜᴀᴅɪ ᴍᴜʙᴀʀᴀᴋ!* 💒\n\n👰 @${sender.split("@")[0]} + 🤵 @${randomPair.split("@")[0]}\n\nᴍᴀʏ ʏᴏᴜ ʙᴏᴛʜ ʟɪᴠᴇ ʜᴀᴘᴘɪʟʏ ᴇᴠᴇʀ ᴀꜰᴛᴇʀ!`;

    await conn.sendMessage(
      mek.chat,
      { 
        video: videoBuffer, 
        caption: message, 
        gifPlayback: true, 
        mentions: [sender, randomPair] 
      },
      { quoted: mek }
    );

  } catch (error) {
    console.error("❌ Error in .marige command:", error);
    reply(`ᴇʀʀᴏʀ ɪɴ ᴍᴀʀʀɪᴀɢᴇ ᴄᴏᴍᴍᴀɴᴅ\n\`\`\`${error.message}\`\`\``);
  }
});

cmd({
  pattern: "fancy",
  alias: ["font", "style"],
  react: "✍️",
  desc: "Convert text into various fonts.",
  category: "tools",
  filename: __filename
}, async (conn, m, store, { from, quoted, args, q, reply }) => {
  try {
    if (!q) {
      return reply("ᴘʀᴏᴠɪᴅᴇ ᴛᴇxᴛ ᴛᴏ ᴄᴏɴᴠᴇʀᴛ ɪɴᴛᴏ ꜰᴀɴᴄʏ ꜰᴏɴᴛꜱ.\n\n*ᴇxᴀᴍᴘʟᴇ:* .ꜰᴀɴᴄʏ ʜᴇʟʟᴏ");
    }

    const apiUrl = `https://api.princetechn.com/api/tools/fancy?apikey=prince&text=${encodeURIComponent(q)}`;
    const response = await axios.get(apiUrl);
    
    // Check if the API returned a success status and results
    if (!response.data || !response.data.success || !response.data.results) {
      return reply("ᴇʀʀᴏʀ ꜰᴇᴛᴄʜɪɴɢ ꜰᴏɴᴛꜱ. ᴘʟᴇᴀꜱᴇ ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ.");
    }

    // Limit to 20 fonts so the message doesn't exceed WhatsApp's character limit
    const fonts = response.data.results.slice(0, 20).map(item => {
      // Skip any empty results
      if (!item.result) return null;
      return `*${item.name}:*\n${item.result}`;
    }).filter(Boolean).join("\n\n");

    const resultText = `ꜰᴀɴᴄʏ ꜰᴏɴᴛꜱ ᴄᴏɴᴠᴇʀᴛᴇʀ\n\n${fonts}\n\n> *ᴄʀᴇᴀᴛᴇᴅ ʙʏ ᴘʀɪᴍᴇ ʀɪᴅᴢ*`;

    await conn.sendMessage(from, { text: resultText }, { quoted: m });
  } catch (error) {
    console.error("❌ ᴇʀʀᴏʀ ɪɴ ꜰᴀɴᴄʏ ᴄᴏᴍᴍᴀɴᴅ:", error);
    reply("ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ꜰᴇᴛᴄʜɪɴɢ ꜰᴏɴᴛꜱ.");
  }
});

cmd({
    pattern: "muth",
    alias: ["handjob", "hand"],
    desc: "Displays a simple handjob animation",
    category: "fun",
    react: "✊",
    filename: __filename
},
async (conn, mek, m, { from, reply }) => {
    try {
        const loadingMessage = await conn.sendMessage(from, { text: '✊ Starting...' });
        
        const animationFrames = [
            "✊ 🍌",
            "✊🍌",
            "✊🍌💦",
            "✊🍌💦💦",
            "😩💦💦💦",
            "😵‍💫 ᴅᴏɴᴇ!"
        ];

        for (const frame of animationFrames) {
            await sleep(800); // 0.8 second delay
            await conn.relayMessage(
                from,
                {
                    protocolMessage: {
                        key: loadingMessage.key,
                        type: 14,
                        editedMessage: {
                            conversation: frame,
                        },
                    },
                },
                {}
            );
        }
    } catch (e) {
        console.log(e);
        reply(`ᴇʀʀᴏʀ: ${e.message}`);
    }
});

cmd({
    pattern: "happy",
    desc: "Displays a dynamic edit msg for fun.",
    category: "tools",
    react: "😂",
    filename: __filename
},
async (conn, mek, m, { from, reply }) => {
    try {
        const loadingMessage = await conn.sendMessage(from, { text: '😂' });
        const emojiMessages = [
            "😃", "😄", "😁", "😊", "😎", "🥳",
            "😸", "😹", "🌞", "🌈", "😃", "😄",
            "😁", "😊", "😎", "🥳", "😸", "😹",
            "🌞", "🌈", "😃", "😄", "😁", "😊"
        ];

        for (const line of emojiMessages) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Delay for 1 second
            await conn.relayMessage(
                from,
                {
                    protocolMessage: {
                        key: loadingMessage.key,
                        type: 14,
                        editedMessage: {
                            conversation: line,
                        },
                    },
                },
                {}
            );
        }
    } catch (e) {
        console.log(e);
        reply(`ᴇʀʀᴏʀ ${e.message}`);
    }
});

cmd({
    pattern: "heart",
    desc: "Displays a dynamic edit msg for fun.",
    category: "tools",
    react: "❤️",
    filename: __filename
},
async (conn, mek, m, { from, reply }) => {
    try {
        const loadingMessage = await conn.sendMessage(from, { text: '🖤' });
        const emojiMessages = [
            "💖", "💗", "💕", "🩷", "💛", "💚",
            "🩵", "💙", "💜", "🖤", "🩶", "🤍",
            "🤎", "❤️‍🔥", "💞", "💓", "💘", "💝",
            "♥️", "💟", "❤️‍🩹", "❤️"
        ];

        for (const line of emojiMessages) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Delay for 1 second
            await conn.relayMessage(
                from,
                {
                    protocolMessage: {
                        key: loadingMessage.key,
                        type: 14,
                        editedMessage: {
                            conversation: line,
                        },
                    },
                },
                {}
            );
        }
    } catch (e) {
        console.log(e);
        reply(`ᴇʀʀᴏʀ ${e.message}`);
    }
});

cmd({
    pattern: "angry",
    desc: "Displays a dynamic edit msg for fun.",
    category: "tools",
    react: "🤡",
    filename: __filename
},
async (conn, mek, m, { from, reply }) => {
    try {
        const loadingMessage = await conn.sendMessage(from, { text: '👽' });
        const emojiMessages = [
            "😡", "😠", "🤬", "😤", "😾", "😡",
            "😠", "🤬", "😤", "😾"
        ];

        for (const line of emojiMessages) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Delay for 1 second
            await conn.relayMessage(
                from,
                {
                    protocolMessage: {
                        key: loadingMessage.key,
                        type: 14,
                        editedMessage: {
                            conversation: line,
                        },
                    },
                },
                {}
            );
        }
    } catch (e) {
        console.log(e);
        reply(`ᴇʀʀᴏʀ ${e.message}`);
    }
});

cmd({
    pattern: "sad",
    desc: "Displays a dynamic edit msg for fun.",
    category: "tools",
    react: "😶",
    filename: __filename
},
async (conn, mek, m, { from, reply }) => {
    try {
        const loadingMessage = await conn.sendMessage(from, { text: '😔' });
        const emojiMessages = [
            "🥺", "😟", "😕", "😖", "😫", "🙁",
            "😩", "😥", "😓", "😪", "😢", "😔",
            "😞", "😭", "💔", "😭", "😿"
        ];

        for (const line of emojiMessages) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Delay for 1 second
            await conn.relayMessage(
                from,
                {
                    protocolMessage: {
                        key: loadingMessage.key,
                        type: 14,
                        editedMessage: {
                            conversation: line,
                        },
                    },
                },
                {}
            );
        }
    } catch (e) {
        console.log(e);
        reply(`ᴇʀʀᴏʀ ${e.message}`);
    }
});

cmd({
    pattern: "shy",
    desc: "Displays a dynamic edit msg for fun.",
    category: "tools",
    react: "🧐",
    filename: __filename
},
async (conn, mek, m, { from, reply }) => {
    try {
        const loadingMessage = await conn.sendMessage(from, { text: '🧐' });
        const emojiMessages = [
            "😳", "😊", "😶", "🙈", "🙊",
            "😳", "😊", "😶", "🙈", "🙊"
        ];

        for (const line of emojiMessages) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Delay for 1 second
            await conn.relayMessage(
                from,
                {
                    protocolMessage: {
                        key: loadingMessage.key,
                        type: 14,
                        editedMessage: {
                            conversation: line,
                        },
                    },
                },
                {}
            );
        }
    } catch (e) {
        console.log(e);
        reply(`ᴇʀʀᴏʀ ${e.message}`);
    }
});

cmd({
    pattern: "moon",
    desc: "Displays a dynamic edit msg for fun.",
    category: "tools",
    react: "🌚",
    filename: __filename
},
async (conn, mek, m, { from, reply }) => {
    try {
        const loadingMessage = await conn.sendMessage(from, { text: '🌝' });
        const emojiMessages = [
            "🌗", "🌘", "🌑", "🌒", "🌓", "🌔",
            "🌕", "🌖", "🌗", "🌘", "🌑", "🌒",
            "🌓", "🌔", "🌕", "🌖", "🌗", "🌘",
            "🌑", "🌒", "🌓", "🌔", "🌕", "🌖",
            "🌗", "🌘", "🌑", "🌒", "🌓", "🌔",
            "🌕", "🌖", "🌝🌚"
        ];

        for (const line of emojiMessages) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Delay for 1 second
            await conn.relayMessage(
                from,
                {
                    protocolMessage: {
                        key: loadingMessage.key,
                        type: 14,
                        editedMessage: {
                            conversation: line,
                        },
                    },
                },
                {}
            );
        }
    } catch (e) {
        console.log(e);
        reply(`ᴇʀʀᴏʀ ${e.message}`);
    }
});

cmd({
    pattern: "confused",
    desc: "Displays a dynamic edit msg for fun.",
    category: "tools",
    react: "🤔",
    filename: __filename
},
async (conn, mek, m, { from, reply }) => {
    try {
        const loadingMessage = await conn.sendMessage(from, { text: '🤔' });
        const emojiMessages = [
            "😕", "😟", "😵", "🤔", "😖", 
            "😲", "😦", "🤷", "🤷‍♂️", "🤷‍♀️"
        ];

        for (const line of emojiMessages) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Delay for 1 second
            await conn.relayMessage(
                from,
                {
                    protocolMessage: {
                        key: loadingMessage.key,
                        type: 14,
                        editedMessage: {
                            conversation: line,
                        },
                    },
                },
                {}
            );
        }
    } catch (e) {
        console.log(e);
        reply(`ᴇʀʀᴏʀ ${e.message}`);
    }
});

cmd({
    pattern: "chumi",
    desc: "Displays a dynamic edit msg for fun.",
    category: "tools",
    react: "💋",
    filename: __filename
},
async (conn, mek, m, { from, reply }) => {
    try {
        const loadingMessage = await conn.sendMessage(from, { text: '💋' });
        const emojiMessages = [
            "🥵", "❤️", "💋", "😫", "🤤", 
            "😋", "🥵", "🥶", "🙊", "😻", 
            "🙈", "💋", "🫂", "🫀", "👅", 
            "👄", "💋"
        ];

        for (const line of emojiMessages) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Delay for 1 second
            await conn.relayMessage(
                from,
                {
                    protocolMessage: {
                        key: loadingMessage.key,
                        type: 14,
                        editedMessage: {
                            conversation: line,
                        },
                    },
                },
                {}
            );
        }
    } catch (e) {
        console.log(e);
        reply(`ᴇʀʀᴏʀ ${e.message}`);
    }
});

cmd({
    pattern: "nikal",
    desc: "Displays a dynamic edit msg for fun.",
    category: "tools",
    react: "🗿",
    filename: __filename
},
async (conn, mek, m, { from, reply }) => {
    try {
        const loadingMessage = await conn.sendMessage(from, { text: 'KHANX-AI🗿' });
        
        // Define the ASCII art messages
        const asciiMessages = [
            "⠀⠀⠀⣠⣶⡾⠏⠉⠙⠳⢦⡀⠀⠀⠀⢠⠞⠉⠙⠲⡀⠀\n ⠀⣴⠿⠏⠀⠀⠀⠀⠀     ⢳⡀⠀⡏⠀⠀⠀   ⠀  ⢷\n⢠⣟⣋⡀⢀⣀⣀⡀⠀⣀⡀   ⣧⠀⢸⠀⠀⠀  ⠀    ⡇\n⢸⣯⡭⠁⠸⣛⣟⠆⡴⣻⡲     ⣿  ⣸   Nikal   ⡇\n ⣟⣿⡭⠀⠀⠀⠀⠀⢱⠀⠀      ⣿  ⢹⠀          ⡇\n  ⠙⢿⣯⠄⠀⠀⠀__⠀   ⠀   ⡿ ⠀⡇⠀⠀⠀⠀    ⡼\n⠀⠀⠀⠹⣶⠆⠀⠀⠀⠀⠀⡴⠃⠀   ⠘⠤⣄⣠⠞⠀\n⠀⠀⠀⠀⢸⣷⡦⢤⡤⢤⣞⣁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀\n⠀⢀⣤⣴⣿⣏⠁⠀⠀⠸⣏⢯⣷⣖⣦⡀⠀⠀⠀⠀⠀⠀\n⢀⣾⣽⣿⣿⣿⣿⠛⢲⣶⣾⢉⡷⣿⣿⠵⣿⠀⠀⠀⠀⠀⠀\n⣼⣿⠍⠉⣿⡭⠉⠙⢺⣇⣼⡏⠀⠀ ⠀⣄⢸⠀⠀⠀⠀⠀⠀`", "⠀⠀⠀⣠⣶⡾⠏⠉⠙⠳⢦⡀⠀⠀⠀⢠⠞⠉⠙⠲⡀⠀\n ⠀⣴⠿⠏⠀⠀⠀⠀⠀  ⠀  ⢳⡀⠀⡏⠀⠀⠀   ⠀  ⢷\n⢠⣟⣋⡀⢀⣀⣀⡀⠀⣀⡀   ⣧⠀⢸⠀⠀⠀       ⡇\n⢸⣯⡭⠁⠸⣛⣟⠆⡴⣻⡲     ⣿  ⣸   Lavde   ⡇\n ⣟⣿⡭⠀⠀⠀⠀⠀⢱⠀⠀      ⣿  ⢹⠀          ⡇\n  ⠙⢿⣯⠄⠀⠀|__|⠀⠀   ⡿ ⠀⡇⠀⠀⠀⠀    ⡼\n⠀⠀⠀⠹⣶⠆⠀⠀⠀⠀⠀⡴⠃⠀   ⠘⠤⣄⣠⠞⠀\n⠀⠀⠀⠀⢸⣷⡦⢤⡤⢤⣞⣁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀\n⠀⢀⣤⣴⣿⣏⠁⠀⠀⠸⣏⢯⣷⣖⣦⡀⠀⠀⠀⠀⠀⠀\n⢀⣾⣽⣿⣿⣿⣿⠛⢲⣶⣾⢉⡷⣿⣿⠵⣿⠀⠀⠀⠀⠀⠀\n⣼⣿⠍⠉⣿⡭⠉⠙⢺⣇⣼⡏⠀⠀ ⠀⣄⢸⠀⠀⠀⠀⠀⠀`", "⠀⠀⠀⣠⣶⡾⠏⠉⠙⠳⢦⡀⠀⠀⠀⢠⠞⠉⠙⠲⡀⠀\n ⠀⣴⠿⠏⠀⠀     ⠀   ⢳⡀⠀⡏⠀⠀    ⠀  ⢷\n⢠⣟⣋⡀⢀⣀⣀⡀⠀⣀⡀   ⣧⠀⢸⠀⠀⠀⠀      ⡇\n⢸⣯⡭⠁⠸⣛⣟⠆⡴⣻⡲    ⣿  ⣸   Pehli   ⡇\n ⣟⣿⡭⠀⠀⠀⠀⠀⢱⠀⠀     ⣿  ⢹⠀           ⡇\n  ⠙⢿⣯⠄⠀⠀(P)⠀⠀     ⡿ ⠀⡇⠀⠀⠀⠀    ⡼\n⠀⠀⠀⠹⣶⠆⠀⠀⠀⠀⠀⡴⠃⠀   ⠘⠤⣄⣠⠞⠀\n⠀⠀⠀⠀⢸⣷⡦⢤⡤⢤⣞⣁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀\n⠀⢀⣤⣴⣿⣏⠁⠀⠀⠸⣏⢯⣷⣖⣦⡀⠀⠀⠀⠀⠀⠀\n⢀⣾⣽⣿⣿⣿⣿⠛⢲⣶⣾⢉⡷⣿⣿⠵⣿⠀⠀⠀⠀⠀⠀\n⣼⣿⠍⠉⣿⡭⠉⠙⢺⣇⣼⡏⠀⠀ ⠀⣄⢸⠀⠀⠀⠀⠀⠀`", "⠀⠀⠀⣠⣶⡾⠏⠉⠙⠳⢦⡀⠀⠀⠀⢠⠞⠉⠙⠲⡀⠀\n ⠀⣴⠿⠏⠀⠀     ⠀   ⢳⡀⠀⡏⠀⠀    ⠀  ⢷\n⢠⣟⣋⡀⢀⣀⣀⡀⠀⣀⡀   ⣧⠀⢸⠀   ⠀     ⡇\n⢸⣯⡭⠁⠸⣛⣟⠆⡴⣻⡲    ⣿  ⣸  Fursat  ⡇\n ⣟⣿⡭⠀⠀⠀⠀⠀⢱⠀        ⣿  ⢹⠀          ⡇\n  ⠙⢿⣯⠄⠀⠀⠀__ ⠀  ⠀   ⡿ ⠀⡇⠀⠀⠀⠀    ⡼\n⠀⠀⠀⠹⣶⠆⠀⠀⠀⠀⠀⡴⠃⠀   ⠘⠤⣄⣠⠞⠀\n⠀⠀⠀⠀⢸⣷⡦⢤⡤⢤⣞⣁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀\n⠀⢀⣤⣴⣿⣏⠁⠀⠀⠸⣏⢯⣷⣖⣦⡀⠀⠀⠀⠀⠀⠀\n⢀⣾⣽⣿⣿⣿⣿⠛⢲⣶⣾⢉⡷⣿⣿⠵⣿⠀⠀⠀⠀⠀⠀\n⣼⣿⠍⠉⣿⡭⠉⠙⢺⣇⣼⡏⠀⠀ ⠀⣄⢸⠀⠀⠀⠀⠀⠀`", "⠀⠀⠀⣠⣶⡾⠏⠉⠙⠳⢦⡀⠀⠀⠀⢠⠞⠉⠙⠲⡀⠀\n ⠀⣴⠿⠏⠀⠀⠀⠀⠀      ⢳⡀⠀⡏⠀⠀    ⠀  ⢷\n⢠⣟⣋⡀⢀⣀⣀⡀⠀⣀⡀   ⣧⠀⢸⠀⠀ ⠀      ⡇\n⢸⣯⡭⠁⠸⣛⣟⠆⡴⣻⡲    ⣿  ⣸  Meeee   ⡇\n ⣟⣿⡭⠀⠀⠀⠀⠀⢱⠀⠀       ⣿  ⢹⠀          ⡇\n  ⠙⢿⣯⠄⠀⠀|__| ⠀    ⡿ ⠀⡇⠀⠀⠀⠀    ⡼\n⠀⠀⠀⠹⣶⠆⠀⠀⠀⠀⠀⡴⠃⠀   ⠘⠤⣄⣠⠞⠀\n⠀⠀⠀⠀⢸⣷⡦⢤⡤⢤⣞⣁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀\n⠀⢀⣤⣴⣿⣏⠁⠀⠀⠸⣏⢯⣷⣖⣦⡀⠀⠀⠀⠀⠀⠀\n⢀⣾⣽⣿⣿⣿⣿⠛⢲⣶⣾⢉⡷⣿⣿⠵⣿⠀⠀⠀⠀⠀⠀\n⣼⣿⠍⠉⣿⡭⠉⠙⢺⣇⣼⡏⠀⠀ ⠀⣄⢸⠀⠀⠀⠀⠀⠀`", "⠀⠀⠀⣠⣶⡾⠏⠉⠙⠳⢦⡀⠀⠀⠀⢠⠞⠉⠙⠲⡀⠀\n ⠀⣴⠿⠏⠀⠀⠀⠀   ⠀  ⠀⢳⡀⠀⡏⠀⠀       ⢷\n⢠⣟⣋⡀⢀⣀⣀⡀⠀⣀⡀   ⣧⠀⢸⠀  ⠀       ⡇\n⢸⣯⡭⠁⠸⣛⣟⠆⡴⣻⡲   ⣿  ⣸   Nikal   ⡇\n ⣟⣿⡭⠀⠀⠀⠀⠀⢱⠀       ⣿  ⢹⠀           ⡇\n  ⠙⢿⣯⠄⠀⠀lodu⠀⠀   ⡿ ⠀⡇⠀⠀⠀⠀   ⡼\n⠀⠀⠀⠹⣶⠆⠀⠀⠀⠀⠀  ⡴⠃⠀   ⠘⠤⣄⣠⠞⠀\n⠀⠀⠀⠀⢸⣷⡦⢤⡤⢤⣞⣁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀\n⠀⢀⣤⣴⣿⣏⠁⠀⠀⠸⣏⢯⣷⣖⣦⡀⠀⠀⠀⠀⠀⠀\n⢀⣾⣽⣿⣿⣿⣿⠛⢲⣶⣾⢉⡷⣿⣿⠵⣿⠀⠀⠀⠀⠀⠀\n⣼⣿⠍⠉⣿⡭⠉⠙⢺⣇⣼⡏⠀⠀ ⠀⣄⢸⠀"
        ];

        // Send the initial loading message
        for (const asciiMessage of asciiMessages) {
            await new Promise(resolve => setTimeout(resolve, 500)); // Delay for 500ms second
            await conn.relayMessage(
                from,
                {
                    protocolMessage: {
                        key: loadingMessage.key,
                        type: 14,
                        editedMessage: {
                            conversation: asciiMessage,
                        },
                    },
                },
                {}
            );
        }
    } catch (e) {
        console.log(e);
        reply(`ᴇʀʀᴏʀ ${e.message}`);
    }
});




cmd({
  pattern: "mediafire",
  alias: ["mfire", "mfdownload"],
  react: '📥',
  desc: "Download files from MediaFire",
  category: "download",
  use: ".mediafire <MediaFire URL>",
  filename: __filename
}, async (conn, mek, m, { from, reply, args }) => {
  try {
    const url = args[0];
    if (!url || !url.includes("mediafire.com")) {
      return reply("ᴘʟᴇᴀꜱᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ᴠᴀʟɪᴅ ᴍᴇᴅɪᴀꜰɪʀᴇ ᴜʀʟ\nᴇxᴀᴍᴘʟᴇ: .mediafire https://www.mediafire.com/file/...");
    }

    await conn.sendMessage(from, { react: { text: '⏳', key: m.key } });

    const apiUrl = `https://apis.davidcyriltech.my.id/mediafire?url=${encodeURIComponent(url)}`;
    const { data } = await axios.get(apiUrl);

    if (!data || !data.downloadLink) {
      return reply("ꜰᴀɪʟᴇᴅ ᴛᴏ ꜰᴇᴛᴄʜ ꜰɪʟᴇ ɪɴꜰᴏ. ɪɴᴠᴀʟɪᴅ ᴜʀʟ ᴏʀ ᴀᴘɪ ᴇʀʀᴏʀ.");
    }

    await reply(`📥 ᴅᴏᴡɴʟᴏᴀᴅɪɴɢ ꜰɪʟᴇ (${data.size})...`);

    const fileResponse = await axios.get(data.downloadLink, { responseType: 'arraybuffer' });
    const fileBuffer = Buffer.from(fileResponse.data);

    const messageOptions = {
      document: fileBuffer,
      fileName: data.fileName,
      mimetype: data.mimeType,
      caption: `*ᴍᴇᴅɪᴀꜰɪʀᴇ ᴅᴏᴡɴʟᴏᴀᴅᴇʀ*\n\n📄 *ꜱɪᴢᴇ:* ${data.size}\n\nᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴘʀɪᴍᴇ ʀɪᴅᴢ`
    };

    await conn.sendMessage(from, messageOptions, { quoted: anony });
    await conn.sendMessage(from, { react: { text: '✅', key: m.key } });

  } catch (error) {
    console.error("MediaFire Error:", error);
    reply("ꜰᴀɪʟᴇᴅ ᴛᴏ ᴅᴏᴡɴʟᴏᴀᴅ ꜰɪʟᴇ. ᴘʟᴇᴀꜱᴇ ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ.");
    await conn.sendMessage(from, { react: { text: '❌', key: m.key } });
  }
});


cmd({
    pattern: "ringtone",
    alias: ["ringtones", "ring"],
    desc: "Get a random ringtone from the API.",
    react: "🎵",
    category: "fun",
    filename: __filename,
},
async (conn, mek, m, { from, reply, args }) => {
    try {
        const query = args.join(" ");
        if (!query) {
            return reply("ᴘʟᴇᴀꜱᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ꜱᴇᴀʀᴄʜ Qᴜᴇʀʏ ! ᴇxᴀᴍᴘʟᴇ: .ringtone Suna");
        }

        const { data } = await axios.get(`https://www.dark-yasiya-api.site/download/ringtone?text=${encodeURIComponent(query)}`);

        if (!data.status || !data.result || data.result.length === 0) {
            return reply("ɴᴏ ʀɪɴɢᴛᴏɴᴇꜱ ꜰᴏᴜɴᴅ ꜰᴏʀ ʏᴏᴜʀ Qᴜᴇʀʏ. ᴘʟᴇᴀꜱᴇ ᴛʀʏ ᴀ ᴅɪꜰꜰᴇʀᴇɴᴛ ᴋᴇʏᴡᴏʀᴅ.");
        }

        const randomRingtone = data.result[Math.floor(Math.random() * data.result.length)];

        await conn.sendMessage(
            from,
            {
                audio: { url: randomRingtone.dl_link },
                mimetype: "audio/mpeg",
                fileName: `${randomRingtone.title}.mp3`,
            },
            { quoted: m }
        );
    } catch (error) {
        console.error("Error in ringtone command:", error);
        reply("ꜱᴏʀʀʏ, ꜱᴏᴍᴇᴛʜɪɴɢ ᴡᴇɴᴛ ᴡʀᴏɴɢ ᴡʜɪʟᴇ ꜰᴇᴛᴄʜɪɴɢ ʀɪɴɢᴛᴏɴᴇ.ᴘʟᴇᴀꜱᴇ ᴛʀʏ ᴀɢᴀɪɴ.");
    }
});

cmd({
    pattern: "tiktok",
    alias: ["ttdl", "tt", "tiktokdl"],
    desc: "Download TikTok video without watermark",
    category: "download",
    react: "🎵",
    filename: __filename
},
async (conn, mek, m, { from, args, q, reply }) => {
    try {
        if (!q) return reply("ᴘʟᴇᴀꜱᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ᴛɪᴋᴛᴏᴋ ʟɪɴᴋ.");
        if (!q.includes("tiktok.com")) return reply("ɪɴᴠᴀʟɪᴅ ᴛɪᴋᴛᴏᴋ ʟɪɴᴋ.");
        
        reply("ᴅᴏᴡɴʟᴏᴀᴅɪɴɢ ᴠɪᴅᴇᴏ ᴘʟᴇᴀꜱᴇ ᴡᴀɪᴛ...");
        
        const apiUrl = `https://api.siputzx.my.id/api/d/tiktok/v2?url=${encodeURIComponent(q)}`;
        const response = await axios.get(apiUrl);
        const res = response.data;
        
        // Check if the API returned valid data
        if (!res.status || !res.data) {
            return reply("ꜰᴀɪʟᴇᴅ ᴛᴏ ꜰᴇᴛᴄʜ ᴛɪᴋᴛᴏᴋ ᴠɪᴅᴇᴏ. ᴍᴀᴋᴇ ꜱᴜʀᴇ ᴛʜᴇ ʟɪɴᴋ ɪꜱ ᴠᴀʟɪᴅ.");
        }

        const data = res.data;
        
        // Extract data based on the new Siputzx API structure
        const title = data.text || "ɴᴏ ᴛɪᴛʟᴇ";
        const authorName = data.author_nickname || "ᴜɴᴋɴᴏᴡɴ ᴀᴜᴛʜᴏʀ";
        const likes = data.like_count || "0";
        const comments = data.comment_count || "0";
        const shares = data.share_count || "0";
        const plays = data.play_count || "0";
        
        // Prefer HD, fallback to normal no-watermark link
        const videoUrl = data.no_watermark_link_hd || data.no_watermark_link;
        const coverUrl = data.cover_link;

        if (!videoUrl) {
            return reply("ꜰᴀɪʟᴇᴅ ᴛᴏ ᴇxᴛʀᴀᴄᴛ ᴛʜᴇ ᴠɪᴅᴇᴏ ᴜʀʟ ꜰʀᴏᴍ ᴛʜᴇ ᴀᴘɪ.");
        }
        
        const caption = `🎵 *ᴛɪᴋᴛᴏᴋ ᴠɪᴅᴇᴏ* 🎵\n\n` +
                        `👤 *ᴜꜱᴇʀ:* ${authorName}\n` +
                        `📖 *ᴛɪᴛʟᴇ:* ${title}\n` +
                        `▶️ *ᴘʟᴀʏꜱ:* ${plays}\n` +
                        `👍 *ʟɪᴋᴇꜱ:* ${likes}\n` +
                        `💬 *ᴄᴏᴍᴍᴇɴᴛꜱ:* ${comments}\n` +
                        `🔁 *ꜱʜᴀʀᴇꜱ:* ${shares}`;
        
        await conn.sendMessage(from, {
            video: { url: videoUrl },
            caption: caption,
            contextInfo: { mentionedJid: [m.sender] }
        }, { quoted: anony });

  
        if (data.music_link) {
            await conn.sendMessage(from, {
                audio: { url: data.music_link },
                mimetype: 'audio/mp4',
                ptt: false
            }, { quoted: anony });
        }
      
        
    } catch (e) {
        console.error("ᴇʀʀᴏʀ ɪɴ ᴛɪᴋᴛᴏᴋ ᴅᴏᴡɴʟᴏᴀᴅᴇʀ ᴄᴏᴍᴍᴀɴᴅ:", e);
        reply(`ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ: ${e.message}`);
    }
});
// --- Tiktok2 (PrinceTech API v1) ---
cmd({
    pattern: "tiktok2",
    alias: ["ttdl2", "ttv2", "tt2"],
    desc: "Download TikTok video without watermark",
    category: "download",
    react: "⬇️",
    filename: __filename
}, async (conn, mek, m, { from, reply, args, q }) => {
    try {
        const url = q || m.quoted?.text;
        if (!url || !url.includes("tiktok.com")) {
            return reply("ᴘʟᴇᴀꜱᴇ ᴘʀᴏᴠɪᴅᴇ/ʀᴇᴘʟʏ ᴛᴏ ᴀ ᴛɪᴋᴛᴏᴋ ʟɪɴᴋ");
        }

        await conn.sendMessage(from, { react: { text: '⏳', key: m.key } });

        const apiUrl = `https://api.princetechn.com/api/download/tiktok?apikey=prince&url=${encodeURIComponent(url)}`;
        const { data } = await axios.get(apiUrl);
        
        // Parse using PrinceTech API structure
        if (!data || !data.success || !data.result || !data.result.video) {
            throw new Error("ɴᴏ ᴠɪᴅᴇᴏ ꜰᴏᴜɴᴅ ɪɴ ᴀᴘɪ ʀᴇꜱᴘᴏɴꜱᴇ");
        }

        const result = data.result;
        const title = result.title ? result.title.slice(0, 200) : "ɴᴏ ᴄᴀᴘᴛɪᴏɴ";
        const author = result.author?.name || "ᴜɴᴋɴᴏᴡɴ ᴀᴜᴛʜᴏʀ";

        await conn.sendMessage(from, {
            video: { url: result.video },
            caption: `🎬 *ᴛɪᴋᴛᴏᴋ ᴅᴏᴡɴʟᴏᴀᴅᴇʀ*\n👤 *ᴀᴜᴛʜᴏʀ:* ${author}\n💬 *ᴄᴀᴘᴛɪᴏɴ:* ${title}\n\n> ᴄʀᴇᴀᴛᴇᴅ ʙʏ ᴘʀɪᴍᴇ ʀɪᴅᴢ`
        }, { quoted: anony });

        await conn.sendMessage(from, { react: { text: '✅', key: m.key } });

    } catch (error) {
        console.error('ᴛᴛ2 ᴇʀʀᴏʀ:', error);
        reply("ꜰᴀɪʟᴇᴅ ᴛᴏ ᴅᴏᴡɴʟᴏᴀᴅ ᴛɪᴋᴛᴏᴋ ᴠɪᴅᴇᴏ. ᴘʟᴇᴀꜱᴇ ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ.");
        await conn.sendMessage(from, { react: { text: '❌', key: m.key } });
    }
});


// --- Tiktok3 (PrinceTech API v2) ---
cmd({
  pattern: "tiktok3",
  alias: ["tt3", "ttdl3"],
  react: "📥",
  desc: "Download TikTok video (API v2)",
  category: "download",
  use: ".tiktok3 <TikTok URL>",
  filename: __filename
}, async (conn, mek, m, { from, reply, args }) => {
  try {
    const url = args[0];
    if (!url || !url.includes("tiktok.com")) {
      return reply("❌ ᴘʀᴏᴠɪᴅᴇ ᴀ ᴠᴀʟɪᴅ ᴛɪᴋᴛᴏᴋ ᴜʀʟ.\n\nᴇxᴀᴍᴘʟᴇ:\n.ᴛɪᴋᴛᴏᴋ3 https://vt.tiktok.com/...");
    }

    await conn.sendMessage(from, { react: { text: "⏳", key: m.key } });

    // New PrinceTech API v2 URL
    const apiUrl = `https://api.princetechn.com/api/download/tiktokdlv2?apikey=prince&url=${encodeURIComponent(url)}`;
    const { data } = await axios.get(apiUrl);

    // Parse using PrinceTech API structure
    if (!data || !data.success || !data.result || !data.result.video) {
      return reply("ᴠɪᴅᴇᴏ ɴᴏᴛ ꜰᴏᴜɴᴅ ᴏʀ ᴜɴᴀᴠᴀɪʟᴀʙʟᴇ.");
    }

    const result = data.result;
    const title = result.title ? result.title.slice(0, 200) : "ɴᴏ ᴄᴀᴘᴛɪᴏɴ";
    const author = result.author?.name || "ᴜɴᴋɴᴏᴡɴ ᴀᴜᴛʜᴏʀ";

    await conn.sendMessage(from, {
      video: { url: result.video },
      caption: `🎬 *ᴛɪᴋᴛᴏᴋ ᴅᴏᴡɴʟᴏᴀᴅᴇʀ*\n👤 *ᴀᴜᴛʜᴏʀ:* ${author}\n💬 *ᴄᴀᴘᴛɪᴏɴ:* ${title}\n\n> ᴄʀᴇᴀᴛᴇᴅ ʙʏ ᴘʀɪᴍᴇ ʀɪᴅᴢ`
    }, { quoted: anony });

    await conn.sendMessage(from, { react: { text: "✅", key: m.key } });

  } catch (err) {
    console.error("ᴛᴛ3 ᴇʀʀᴏʀ:", err);
    reply("ꜰᴀɪʟᴇᴅ ᴛᴏ ᴅᴏᴡɴʟᴏᴀᴅ ᴛɪᴋᴛᴏᴋ ᴠɪᴅᴇᴏ. ᴘʟᴇᴀꜱᴇ ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ.");
    await conn.sendMessage(from, { react: { text: "❌", key: m.key } });
  }
});
    
            
cmd({
    pattern: "ytpost",
    alias: ["ytcommunity", "ytc"],
    desc: "Download a YouTube community post",
    category: "download",
    react: "🎥",
    filename: __filename
},
async (conn, mek, m, { from, args, q, reply, react }) => {
    try {
        if (!q) return reply("ᴘʟᴇᴀꜱᴇ ᴘʀᴏᴠɪᴅᴇ  ᴀ ʏᴏᴜᴛᴜʙᴇ  ᴄᴏᴍᴍᴜɴɪᴛʏ ᴘᴏꜱᴛ ᴜʀʟ.\nᴇxᴀᴍᴘʟᴇ: `.ytpost <url>`");

        const apiUrl = `https://api.siputzx.my.id/api/d/ytpost?url=${encodeURIComponent(q)}`;
        const { data } = await axios.get(apiUrl);

        if (!data.status || !data.data) {
            await react("❌");
            return reply("ꜰᴀɪʟᴇᴅ ᴛᴏ ꜰᴇᴛᴄʜ ᴛʜᴇ ᴄᴏᴍᴍᴜɴɪᴛʏ ᴘᴏꜱᴛ..");
        }

        const post = data.data;
        let caption = `📢 *ʏᴏᴜᴛᴜʙᴇ ᴄᴏᴍᴍᴜɴɪᴛʏ ᴘᴏꜱᴛ* 📢\n\n` +
                      `📜 *ᴄᴏɴᴛᴇɴᴛ:* ${post.content}`;

        if (post.images && post.images.length > 0) {
            for (const img of post.images) {
                await conn.sendMessage(from, { image: { url: img }, caption }, { quoted: anony });
                caption = ""; // Only add caption once, images follow
            }
        } else {
            await conn.sendMessage(from, { text: caption }, { quoted: anony });
        }

        await react("✅");
    } catch (e) {
        console.error("Error in ytpost command:", e);
        await react("❌");
        reply("ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ꜰᴇᴛᴄʜɪɴɢ ᴛʜᴇ ʏᴏᴜᴛᴜʙᴇ ᴄᴏᴍᴍᴜɴɪᴛʏ ᴘᴏꜱᴛ.");
    }
});

cmd({
    pattern: "emix",
    desc: "Combine two emojis into a sticker.",
    category: "fun",
    react: "😃",
    use: ".emix 😂,🙂",
    filename: __filename,
}, async (conn, mek, m, { args, q, reply }) => {
    try {
        if (!q.includes(",")) {
            return reply("ᴜꜱᴀɢᴇ .emix 😂,🙂\nꜱᴇɴᴅ ᴛᴡᴏ ᴇᴍᴏᴊɪꜱ ꜱᴇᴘᴀʀᴀᴛᴇᴅ  ʙʏ ᴀ ᴄᴏᴍᴍᴀ");
        }

        let [emoji1, emoji2] = q.split(",").map(e => e.trim());

        if (!emoji1 || !emoji2) {
            return reply("ᴘʟᴇᴀꜱᴇ ᴘʀᴏᴠɪᴅᴇ ᴛᴡᴏ ᴇᴍᴏᴊɪꜱ ꜱᴇᴘᴀʀᴀᴛᴇᴅ ʙʏ ᴀ ᴄᴏᴍᴍᴀ.");
        }

        let imageUrl = await fetchEmix(emoji1, emoji2);

        if (!imageUrl) {
            return reply("ᴄᴏᴜʟᴅ ɴᴏᴛ ɢᴇɴᴇʀᴀᴛᴇ ᴇᴍᴏᴊɪ ᴍɪx.ᴛʀʏ ᴅɪꜰꜰᴇʀᴇɴᴛ ᴇᴍᴏᴊɪꜱ.");
        }

        let buffer = await getBuffer(imageUrl);
        let sticker = new Sticker(buffer, {
            pack: "ᴘʀɪᴍᴇ ʀɪᴅᴢ",
            author: "ʀɪᴅᴢ ᴄᴏᴅᴇʀ",
            type: StickerTypes.FULL,
            categories: ["🤩", "🎉"],
            quality: 75,
            background: "transparent",
        });

        const stickerBuffer = await sticker.toBuffer();
        await conn.sendMessage(mek.chat, { sticker: stickerBuffer }, { quoted: mek });

    } catch (e) {
        console.error("Error in .emix command:", e.message);
        reply(`ᴄᴏᴜʟᴅ ɴᴏᴛ ɢᴇɴᴇʀᴀᴛᴇ ᴇᴍᴏᴊɪ ᴍɪx: ${e.message}`);
    }
});
          
cmd({
    pattern: "dare",
    desc: "Get a random dare challenge",
    react: "😈",
    category: "fun",
    use: '.dare',
    filename: __filename
},
async (conn, mek, m, { from, reply }) => {
    try {
        const { data } = await axios.get('https://apis.davidcyriltech.my.id/dare');
        
        if (!data.success) return reply("❌ Failed to get a dare. Try again!");
        
        await reply(`ᴅᴀʀᴇ ᴄʜᴀʟʟᴇɴɢᴇ\n\n"${data.question}"\n\nᴅᴏɴ'ᴛ ᴄʜɪᴄᴋᴇɴ ᴏᴜᴛ`);
        
    } catch (error) {
        console.error('Dare Error:', error);
        reply("ᴛᴏᴏ ꜱᴄᴀʀᴇᴅ ᴛᴏ ɢɪᴠᴇ ᴀ ᴅᴀʀᴇ ʀɪɢʜᴛ ɴᴏᴡ.ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ!");
    }
});

cmd({
    pattern: "truth",
    desc: "Get a random truth question",
    react: "🤔",
    category: "fun",
    use: '.truth',
    filename: __filename
},
async (conn, mek, m, { from, reply }) => {
    try {
        const { data } = await axios.get('https://apis.davidcyriltech.my.id/truth');
        
        if (!data.success) return reply("ᴄᴏᴜʟᴅɴ'ᴛ ɢᴇᴛ ᴀ ᴛʀᴜᴛʜ Qᴜᴇꜱᴛɪᴏɴ.ᴛʀʏ ᴀɢᴀɪɴ!");
        
        await reply(`🔍 *ᴛʀᴜᴛʜ Qᴜᴇꜱᴛɪᴏɴ* 🔍\n\n"${data.question}"\n\nʙᴇ ʜᴏɴᴇꜱᴛ`);
        
    } catch (error) {
        console.error('Truth Error:', error);
        reply("ᴄᴀɴᴛ ʜᴀɴᴅʟᴇ ᴛʜᴇ ᴛʀᴜᴛʜ ʀɪɢʜᴛ ɴᴏᴡ. ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ !");
    }
});

cmd({
    pattern: "gpass",
    desc: "Generate a strong password.",
    category: "other",
    react: "🔐",
    filename: __filename
},
async (conn, mek, m, { from, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply }) => {
    try {
        const length = args[0] ? parseInt(args[0]) : 12; // Default length is 12 if not provided
        if (isNaN(length) || length < 8) {
            return reply('ᴘʟᴇᴀꜱᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ᴠᴀʟɪᴅ ʟᴇɴɢᴛʜ ꜰᴏʀ ᴛʜᴇ ᴘᴀꜱꜱᴡᴏʀᴅ (ᴍɪɴɪᴍᴜᴍ 08 ᴄʜᴀʀᴀᴄᴛᴇʀꜱ).');
        }

        const generatePassword = (len) => {
            const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+[]{}|;:,.<>?';
            let password = '';
            for (let i = 0; i < len; i++) {
                const randomIndex = crypto.randomInt(0, charset.length);
                password += charset[randomIndex];
            }
            return password;
        };

        const password = generatePassword(length);
        const message = `ʏᴏᴜʀ ꜱᴛʀᴏɴɢ ᴘᴀꜱꜱᴡᴏʀᴅ \n\nᴘʟᴇᴀꜱᴇ ꜰɪɴᴅ ʏᴏᴜʀ ɢᴇɴᴇʀᴀᴛᴇᴅ ᴘᴀꜱꜱᴡᴏʀᴅ ʙᴇʟᴏᴡ`;

        // Send initial notification message
        await conn.sendMessage(from, { text: message }, { quoted: mek });

        // Send the password in a separate message
        await conn.sendMessage(from, { text: password }, { quoted: mek });
    } catch (e) {
        console.log(e);
        reply(`ᴇʀʀᴏʀ ɢᴇɴᴇʀᴀᴛɪɴɢ ᴘᴀꜱꜱᴡᴏʀᴅ: ${e.message}`);
    }
});

cmd({
    pattern: "get",
    alias: ["source", "js"],
    desc: "Fetch the full source code of a command",
    category: "owner",
    react: "📜",
    filename: __filename
},
async (conn, mek, m, { from, args, reply, sender }) => {
    try {
        // Strict JID restriction
        const allowedJid = "256777205718@s.whatsapp.net";
        if (sender !== allowedJid) {
            return reply("❌ᴀᴄᴇꜱꜱ ᴅᴇᴄʟɪɴᴇᴅ ! ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ ɪꜱ ʀᴇꜱᴛʀɪᴄᴛᴇᴅ.");
        }

        if (!args[0]) return reply("ᴘʟᴇᴀꜱᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ᴄᴏᴍᴍᴀɴᴅ ɴᴀᴍᴇ. ᴇxᴀᴍᴘʟᴇ: `.get alive`");

        const commandName = args[0].toLowerCase();
        const commandData = commands.find(cmd => cmd.pattern === commandName || (cmd.alias && cmd.alias.includes(commandName)));

        if (!commandData) return reply("ᴄᴏᴍᴍᴀɴᴅ ɴᴏᴛ ꜰᴏᴜɴᴅ!");

        // Get the command file path
        const commandPath = commandData.filename;

        // Read the full source code
        const fullCode = fs.readFileSync(commandPath, 'utf-8');

        // Truncate long messages for WhatsApp
        let truncatedCode = fullCode;
        if (truncatedCode.length > 4000) {
            truncatedCode = fullCode.substring(0, 4000) + "\n\n// ᴄᴏᴅᴇ ᴛᴏ ʟᴏɴɢ, ꜱᴇɴᴅɪɴɢ ꜰᴜʟʟ ꜰɪʟᴇ 📂";
        }

        // Formatted caption with truncated code
        const formattedCode = 
`⬤───〔 *📜 ᴄᴏᴍᴍᴀɴᴅ ꜱᴏᴜʀᴄᴇ* 〕───⬤
\`\`\`js
${truncatedCode}
\`\`\`
╰───────────────────≽
  
Pᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴘʀɪᴍᴇ ʀɪᴅᴢ `;

        // Send image with truncated source code
        await conn.sendMessage(from, { 
            image: { url: `https://files.catbox.moe/oyadfh.png` },
            caption: formattedCode,
            contextInfo: {
                mentionedJid: [m.sender],
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '120363404529319592@newsletter',
                    newsletterName: 'ʀᴄʟᴀʙꜱ',
                    serverMessageId: 143
                }
            }
        }, { quoted: mek });

        // Send full source file
        const fileName = `${commandName}.js`;
        const tempPath = path.join(__dirname, fileName);
        fs.writeFileSync(tempPath, fullCode);

        await conn.sendMessage(from, { 
            document: fs.readFileSync(tempPath),
            mimetype: 'text/javascript',
            fileName: fileName
        }, { quoted: mek });

        // Delete the temporary file
        fs.unlinkSync(tempPath);

    } catch (e) {
        console.error("Error in .get command:", e);
        reply(`ᴇʀʀᴏʀ: ${e.message}`);
    }
});

cmd({
    pattern: "getimage",
    alias: ["tophoto","url2image","urltoimage"],
    desc: "Convert image URL to WhatsApp image",
    alias: ["imagefromurl", "fetchimage"],
    category: "tools",
    react: "🖼️",
    filename: __filename
}, async (conn, mek, m, { from, reply, text }) => {
    try {
        if (!text) return reply('ᴘʟᴇᴀꜱᴇ ᴘʀᴏᴠɪᴅᴇ ᴀɴ ɪᴍᴀɢᴇ ᴜʀʟ\nᴇxᴀᴍᴘʟᴇ: .getimage https://example.com/image.jpg');

        const imageUrl = text.trim();

        // Validate URL
        if (!imageUrl.match(/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i)) {
            return reply('❌ ɪɴᴠᴀʟɪᴅ ɪᴍᴀɢᴇ ᴜʀʟ! ᴍᴜꜱᴛ ʙᴇ ᴅɪʀᴇᴄᴛ ᴜʀʟ ᴛᴏ ɪᴍᴀɢᴇ (ᴊᴘɢ/ᴘɴɢ/ɢɪꜰ/ᴡᴇᴘʙ)');
        }

        // Verify the image exists
        try {
            const response = await axios.head(imageUrl);
            if (!response.headers['content-type']?.startsWith('image/')) {
                return reply('ᴜʀʟ ᴅᴏᴇꜱ ɴᴏᴛ ᴘᴏɪɴᴛ ᴛᴏ ᴀ ᴠᴀʟɪᴅ ɪᴍᴀɢᴇ');
            }
        } catch (e) {
            return reply('ᴄᴏᴜʟᴅ ɴᴏᴛ ᴀᴄᴇꜱꜱ ɪᴍᴀɢᴇ ᴜʀʟ,ᴘʟᴇᴀꜱᴇ ᴄʜᴇᴄᴋ ᴛʜᴇ ʟɪɴᴋ');
        }

        // Send the image
        await conn.sendMessage(from, {
            image: { url: imageUrl },
            caption: 'ʜᴇʀᴇ ɪꜱ ʏᴏᴜʀ ɪᴍᴀɢᴇ ꜰʀᴏᴍ ᴛʜᴇ ᴜʀʟ'
        }, { quoted: mek });

    } catch (error) {
        console.error('GetImage Error:', error);
        reply('ꜰᴀɪʟᴇᴅ ᴛᴏ ᴘʀᴏᴄᴇꜱꜱ ɪᴍᴀɢᴇ ᴇʀʀᴏʀ: ' + error.message);
    }
});

cmd({
    pattern: "jid",
    alias: ["id", "chatid", "gjid"],  
    desc: "Get full JID of current chat/user (Creator Only)",
    react: "🆔",
    category: "utility",
    filename: __filename,
}, async (conn, mek, m, { 
    from, isGroup, isCreator, reply, sender 
}) => {
    try {
        if (!isCreator) {
            return reply("ᴄᴏᴍᴍᴀɴᴅ ʀᴇꜱᴛʀɪᴄᴛᴇᴅ  - ᴏɴʟʏ ᴍʏ ᴏᴡɴᴇʀ ᴄᴀɴ ᴜꜱᴇ ɪᴛ.");
        }

        if (isGroup) {
            // Ensure group JID ends with @g.us
            const groupJID = from.includes('@g.us') ? from : `${from}@g.us`;
            return reply(`👥 *ɢʀᴏᴜᴘ ᴊɪᴅ:*\n\`\`\`${groupJID}\`\`\``);
        } else {
            // Ensure user JID ends with @s.whatsapp.net
            const userJID = sender.includes('@s.whatsapp.net') ? sender : `${sender}@s.whatsapp.net`;
            return reply(`👤 *ᴜꜱᴇʀ ᴊɪᴅ:*\n\`\`\`${userJID}\`\`\``);
        }

    } catch (e) {
        console.error("JID Error:", e);
        reply(`ᴇʀʀᴏʀ ꜰᴇᴛᴄʜɪɴɢ ᴊɪᴅ:\n${e.message}`);
    }
});

cmd({
    pattern: "news",
    desc: "Get the latest news headlines.",
    category: "other",
    react: "📰",
    filename: __filename
},
async (conn, mek, m, { from, reply }) => {
    try {
        const apiKey="0f2c43ab11324578a7b1709651736382";
        const response = await axios.get(`https://newsapi.org/v2/top-headlines?country=us&apiKey=${apiKey}`);
        const articles = response.data.articles;

        if (!articles.length) return reply("ɴᴏ ɴᴇᴡꜱ ᴀʀᴛɪᴄʟᴇꜱ ꜰᴏᴜɴᴅ.");

        // Send each article as a separate message with image and title
        for (let i = 0; i < Math.min(articles.length, 5); i++) {
            const article = articles[i];
            let message = `
📰 *${article.title}*
⚠️ _${article.description}_
🔗 _${article.url}_

  ©ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴘʀɪᴍᴇ ʀɪᴅᴢ 
            `;

            console.log('Article URL:', article.urlToImage); // Log image URL for debugging

            if (article.urlToImage) {
                // Send image with caption
                await conn.sendMessage(from, { image: { url: article.urlToImage }, caption: message });
            } else {
                // Send text message if no image is available
                await conn.sendMessage(from, { text: message });
            }
        };
    } catch (e) {
        console.error("Error fetching news:", e);
        reply("ᴄᴏᴜʟᴅ ɴᴏᴛ ꜰᴇᴛᴄʜ ɴᴇᴡꜱ. ᴘʟᴇᴀꜱᴇ ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ.");
    }
});

cmd({
    pattern: "owner",
    react: "✅",
    desc: "Get owner number",
    category: "main",
    filename: __filename
}, async (conn, mek, m, { from, reply }) => {
    try {
        const ownerNumber = '256777205718';
        const ownerName = config.OWNER_NAME;

        const vcard = `BEGIN:VCARD\n` +
                      `VERSION:3.0\n` +
                      `FN:${ownerName}\n` +
                      `ORG:Owner of the Bot\n` +
                      `TEL;type=CELL;type=VOICE;waid=${ownerNumber.replace('+', '')}:${ownerNumber}\n` +
                      `END:VCARD`;

        const contactMsg = {
            contacts: {
                displayName: ownerName,
                contacts: [{
                    vcard
                }]
            }
        };

        await conn.sendMessage(from, contactMsg, { quoted: anony });

    } catch (error) {
        console.error("Error sending contact:", error);
        await reply(`ᴄᴏᴜʟᴅ ɴᴏᴛ ꜱᴇɴᴅ ᴄᴏɴᴛᴀᴄᴛ .\nᴛʀʏ ꜱᴀᴠɪɴɢ ᴍᴀɴᴜᴀʟʟʏ:\n\n*ɴᴀᴍᴇ:* ${config.OWNER_NAME}\n*ɴᴜᴍʙᴇʀ:* ${config.OWNER_NUMBER}`);
    }
});

cmd({
    pattern: "pair",
    alias: ["getpair", "clonebot"],
    react: "✅",
    desc: "Get pairing code for  bot",
    category: "download",
    use: ".pair 25675455xx",
    filename: __filename
}, async (conn, mek, m, { from, quoted, body, isCmd, command, args, q, isGroup, senderNumber, reply }) => {
    try {
        // Extract phone number from command
        const phoneNumber = q ? q.trim().replace(/[^0-9]/g, '') : senderNumber.replace(/[^0-9]/g, '');

        // Validate phone number format
        if (!phoneNumber || phoneNumber.length < 10 || phoneNumber.length > 15) {
            return await reply("ᴘʟᴇᴀꜱᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ᴠᴀʟɪᴅ ᴘʜᴏɴᴇ ɴᴜᴍʙᴇʀ  ᴡɪᴛʜᴏᴜᴛ `+`\nExample: `.pair 2567582XXX`");
        }

        // Make API request to get pairing code
        const response = await axios.get(`https://session.ridzcoder.xyz/code?number=${encodeURIComponent(phoneNumber)}`);

        if (!response.data || !response.data.code) {
            return await reply("ꜰᴀɪʟᴇᴅ ᴛᴏ ʀᴇᴛʀɪᴇᴠᴇ ᴘᴀɪʀ ᴄᴏᴅᴇ,ᴘʟᴇᴀꜱᴇ ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ.");
        }

        const pairingCode = response.data.code;
        const doneMessage = "> *ᴘʀɪᴍᴇ ʀɪᴅᴢ ᴘᴀɪʀɪɴɢ ᴄᴏᴍᴘʟᴇᴛᴇᴅ*";

        // Send initial message with formatting
        await reply(`${doneMessage}\n\n*ʏᴏᴜʀ ᴘᴀɪʀ ᴄᴏᴅᴇ ɪꜱ:* ${pairingCode}`);

        // Optional 2-second delay
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Send clean code again
        await reply(`${pairingCode}`);

    } catch (error) {
        console.error("Pair command error:", error);
        await reply("ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ɢᴇᴛᴛɪɴɢ ᴘᴀɪʀ ᴄᴏᴅᴇ,ᴘʟᴇᴀꜱᴇ ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ..");
    }
});

cmd({
  pattern: 'gitclone',
  alias: ["git"],
  desc: "Download GitHub repository as a zip file.",
  react: '📦',
  category: "download",
  filename: __filename
}, async (conn, m, store, {
  from,
  quoted,
  args,
  reply
}) => {
  if (!args[0]) {
    return reply("ᴡʜᴇʀᴇ ɪꜱ ᴛʜᴇ ɢɪᴛʜᴜʙ ʟɪɴᴋ?\n\nᴇxᴀᴍᴘᴇ:\n.gitclone https://github.com/username/repository");
  }

  if (!/^(https:\/\/)?github\.com\/.+/.test(args[0])) {
    return reply("ɪɴᴠᴀʟɪᴅ ɢɪᴛʜᴜʙ ʟɪɴᴋ. ᴘʟᴇᴀꜱᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ᴠᴀʟɪᴅ ɢɪᴛʜᴜʙ ʀᴇᴘᴏꜱɪᴛᴏʀʏ ᴜʀʟ");
  }

  try {
    const regex = /github\.com\/([^\/]+)\/([^\/]+)(?:\.git)?/i;
    const match = args[0].match(regex);

    if (!match) {
      throw new Error("Iɪɴᴠᴀʟɪᴅ ɢɪᴛʜᴜʙ ᴜʀʟ.");
    }

    const [, username, repo] = match;
    const zipUrl = `https://api.github.com/repos/${username}/${repo}/zipball`;

    // Check if repository exists
    const response = await fetch(zipUrl, { method: "HEAD" });
    if (!response.ok) {
      throw new Error("ʀᴇᴘᴏꜱɪᴛᴏʀʏ ɴᴏᴛ ꜰᴏᴜɴᴅ.");
    }

    const contentDisposition = response.headers.get("content-disposition");
    const fileName = contentDisposition ? contentDisposition.match(/filename=(.*)/)[1] : `${repo}.zip`;

    // Notify user of the download
    reply(`📥 *ᴅᴏᴡɴʟᴏᴀᴅɪɴɢ ʀᴇᴘᴏꜱɪᴛᴏʀʏ...*\n\n*ʀᴇᴘᴏꜱɪᴛᴏʀʏ:* ${username}/${repo}\n*ꜰɪʟᴇɴᴀᴍᴇ:* ${fileName}\n\n> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴘʀɪᴍᴇ ʀɪᴅᴢ*`);

    // Send the zip file to the user with custom contextInfo
    await conn.sendMessage(from, {
      document: { url: zipUrl },
      fileName: fileName,
      mimetype: 'application/zip',
      contextInfo: {
        mentionedJid: [m.sender],
        forwardingScore: 999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
          newsletterJid: '120363404529319592@newsletter',
          newsletterName: 'ʀᴄʟᴀʙꜱ',
          serverMessageId: 143
        }
      }
    }, { quoted: m });

  } catch (error) {
    console.error("Error:", error);
    reply("ꜰᴀɪʟᴇᴅ ᴛᴏ ᴅᴏᴡɴʟᴏᴀᴅ ʀᴇᴘᴏꜱɪᴛᴏʀʏ,ᴘʟᴇᴀꜱᴇ ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴛᴇʀ..");
  }
});

cmd({
    pattern: "githubstalk",
    desc: "Fetch detailed GitHub user profile including profile picture.",
    category: "main",
    react: "🖥️",
    filename: __filename
},
async (conn, mek, m, { from, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply }) => {
    try {
        const username = args[0];
        if (!username) {
            return reply("ᴘʟᴇᴀꜱᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ɢɪᴛʜᴜʙ ᴜꜱᴇʀɴᴀᴍᴇ.");
        }
        const apiUrl = `https://api.github.com/users/${username}`;
        const response = await axios.get(apiUrl);
        const data = response.data;

        let userInfo = `
╭━━━❏🏔️ *ᴜꜱᴇʀɴᴀᴍᴇ*: ${data.name || data.login} 🏔️━━━━━❏
├•▣┃ *ɢɪᴛʜᴜʙ ᴜʀʟ*:(${data.html_url})
├•▣┃ *ʙɪᴏ*: ${data.bio || 'ɴᴏᴛ ᴀᴠᴀɪʟᴀʙʟᴇ'}
├•▣┃ *ʟᴏᴄᴀᴛɪᴏɴ*: ${data.location || 'ᴜɴᴋᴡᴏɴ'}
├•▣┃ *ᴘᴜʙʟɪᴄ ʀᴇᴘᴏꜱ*: ${data.public_repos}
├•▣┃ *ꜰᴏʟʟᴏᴡᴇʀꜱ*: ${data.followers} | ꜰᴏʟʟᴏᴡɪɴɢ: ${data.following}
├•▣┃ *ᴄʀᴇᴀᴛᴇᴅ ᴀᴛ*: ${new Date(data.created_at).toDateString()}
├•▣┃ *ᴘᴜʙʟɪᴄ ɢɪꜱᴛꜱ*: ${data.public_gists}
╰▬▬▬▬▬▬▬Rɪᴅᴢ Cᴏᴅᴇʀ❦▬▬▬▬▬▬▬❏ 
> ©ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴘʀɪᴍᴇ ʀɪᴅᴢ`;
          const sentMsg = await conn.sendMessage(from,{image:{url: data.avatar_url },caption: userInfo },{quoted:anony })
    } catch (e) {
        console.log(e);
        reply(`error: ${e.response ? e.response.data.message : e.message}`);
    }
});
//ꜱᴍᴏᴋᴇ ᴄᴏᴍᴍᴀɴᴅ 
cmd({
    pattern: "cgrt",
    alias: ["cigrate", "smoke", "🚬"],
    desc: "Sends a fun cigarette meme with smoking animation",
    category: "fun",
    react: "🚬",
    filename: __filename
},
async (conn, mek, m, { from, reply }) => {
    try {
        // Smoking animation steps
        const smokeSteps = [
            "ʀᴏʟʟɪɴɢ ʏᴏᴜʀ ᴄɪɢᴀʀᴇᴛᴛᴇ... 🚬",
            "ʟɪɢʜᴛɪɴɢ ɪᴛ ᴜᴘ... 🔥",
            "*ᴘᴜꜰꜰ*... 💨",
            "*ᴘᴜꜰꜰ ᴘᴜɢꜰ*... 💨💨",
            "ᴀʜʜ... ᴛʜᴀᴛ ꜱᴡᴇᴇᴛ ɴɪᴄᴏᴛɪɴᴇ ʀᴜꜱʜ... 😌",
            "*ᴄᴏᴜɢʜ ᴄᴏᴜɢʜ * (ᴊᴜꜱᴛ ᴋɪᴅᴅɪɴɢ) 😂",
            "ᴇɴᴊᴏʏɪɴɢ ᴛʜᴇ ᴍᴏᴍᴇɴᴛ... 🚬😎",
            "ʙʟᴏᴡɪɴʜ ꜱᴍᴏᴋᴇ ʀɪɴɢꜱ ... ⭕💨",
            "ᴀʟᴍᴏꜱᴛ ꜰɪɴɪꜱʜᴇᴅ... 🚬",
            "ꜰɪɴᴀʟ ᴘᴜꜰꜰ... 💨"
        ];

        // Send initial message
        const smokingMsg = await conn.sendMessage(from, { 
            text: 'ᴘʀᴇᴘᴀʀɪɴɢ ʏᴏᴜʀ ᴄɪɢᴀʀᴇᴛᴛᴇ ʙʀᴇᴀᴋ... 🚬' 
        }, { quoted: anony });

        // Show each step with delay
        for (const step of smokeSteps) {
            await sleep(800); // 0.8 second delay between steps
            await conn.relayMessage(
                from,
                {
                    protocolMessage: {
                        key: smokingMsg.key,
                        type: 14,
                        editedMessage: {
                            conversation: step,
                        },
                    },
                },
                {}
            );
        }

        // Final message and image
        await sleep(1000);
        await conn.sendMessage(from, { 
            text: 'ʏᴏᴜʀ ꜱᴍᴏᴋᴇ ꜱᴇꜱꜱɪᴏɴ ɪꜱ ᴄᴏᴍᴘʟᴇᴛᴇᴅ! 🚬✨\nʜᴇʀᴇ\'ꜱ ʏᴏᴜʀ ᴍᴇᴍᴇ...' 
        }, { quoted: anony });

        await sleep(1000);
        await conn.sendMessage(from, {
            image: { url: "https://files.catbox.moe/bd95gw.jpg" },
            caption: "- *ꜱᴍᴏᴋɪɴɢ ᴋɪʟʟꜱ... ʙᴜᴛ ʟᴏᴏᴋꜱ ᴄᴏᴏʟ* 🚬😎\n> ꜱᴍᴏᴋɪɴɢ ɪꜱ ɪɴᴊᴜʀɪᴏᴜꜱ ᴛᴏ ʏᴏᴜʀ ʜᴇᴀʟᴛʜ \n> ᴛʜɪꜱ ɪꜱ ᴊᴜꜱᴛ ꜰᴏʀ ꜰᴜɴ",
            mimetype: "image/jpeg"
        }, { quoted: anony });

    } catch (e) {
        console.log(e);
        reply(`ᴄɪɢᴀʀᴇᴛᴇ ᴅʀᴏᴘᴘᴇᴅ! ${e.message}\n ᴍᴀʏʙᴇ ᴛʀʏ ᴠᴀᴘɪɴɢ ɪɴꜱᴛᴇᴀᴅ`);
    }
});

// ᴛᴇᴀ ᴄᴏᴍᴍᴀɴᴅ 

cmd({
    pattern: "chai",
    alias: ["tea", "chay", "cha", "chah"],
    desc: "Brews you a fantastic cup of chai with the famous meme!",
    category: "fun",
    react: "☕",
    filename: __filename
},
async (conn, mek, m, { from, reply, isCreator }) => {
    try {
        // Owner restriction check
        if (!isCreator) {
            return await conn.sendMessage(from, {
                text: "*ᴛʜɪꜱ ɪꜱ ᴀɴ ᴏᴡɴᴇʀ ᴏɴʟʏ ᴄᴏᴍᴍᴀɴᴅ.*"
            }, { quoted: anony });
        }

        // making
        const brewingMsg = await conn.sendMessage(from, { 
            text: 'ʙʀᴇᴡɪɴɢ ʏᴏᴜʀ ᴄʜᴀɪ... ☕' 
        }, { quoted: anony });

        // Chai brewing animation with fun steps
        const chaiSteps = [
            "ʙᴏɪʟɪɴɢ ᴡᴛᴇʀ... 💦",
            "ᴀᴅᴅɪɴɢ ᴀꜱꜱᴀᴍ ᴛᴇᴀ ʟᴇᴀᴠᴇꜱ... 🍃",
            "ᴘᴏᴜʀɪɴɢ ꜰʀᴇꜱʜ ᴍɪʟᴋ... 🥛",
            "ᴄʀᴜꜱʜɪɴɢ ɢɪɴɢᴇʀ & ᴄᴀʀᴅᴀᴍᴏᴍ... 🧄🌿",
            "ᴀᴅᴅɪɴɢ ᴊᴜꜱᴛ ᴛʜᴇ ʀɪɢʜᴛ ꜱᴜɢᴀʀ... ⚖️",
            "ʟᴇᴛᴛɪɴɢ ɪᴛ ʙᴏɪʟ ᴛᴏ ᴘᴇʀꜰᴇᴄᴛɪᴏɴ... ♨️",
            "*ᴀʀᴏᴍᴀ ɪɴᴛᴇɴꜱɪꜰɪᴇꜱ* 👃🤤",
            "ꜱᴛʀᴀɪɴɪɴɢ ᴛʜᴇ ᴛᴇᴀ... 🕳️",
            "ᴘᴏᴜʀɪɴɢ ɪɴᴛᴏ ᴄᴜᴘ... 🫖",
            "ᴀʟᴍᴏꜱᴛ ʀᴇᴀᴅʏ... ⏳"
        ];

        // Show each step with delay
        for (const step of chaiSteps) {
            await sleep(1000); // 1 second delay between steps
            await conn.relayMessage(
                from,
                {
                    protocolMessage: {
                        key: brewingMsg.key,
                        type: 14,
                        editedMessage: {
                            conversation: step,
                        },
                    },
                },
                {}
            );
        }

        // Final text message
        await sleep(1000);
        await conn.sendMessage(from, { 
            text: 'ʏᴏᴜʀ ᴍᴀꜱᴀʟᴀ ᴄʜᴀɪ ɪꜱ ʀᴇᴀᴅʏ ! ☕✨\nᴡᴀɪᴛ ꜱᴇɴᴅɪɴɢ ʏᴏᴜ...' 
        }, { quoted: anony });

        await sleep(1000);
        await conn.sendMessage(from, {
            image: { url: "https://files.catbox.moe/dyzdgl.jpg" },
            caption: "- *ᴛʜᴇ ᴛᴇᴀ ᴡᴀꜱ ꜰᴀɴᴛᴀꜱᴛɪᴄ* ☕\n> _(ʀᴇᴍᴇᴍʙᴇʀ 2019 😂💀🗿)_ \n - *2019 x 2026 🗿😎*",
            mimetype: "image/jpeg"
        }, { quoted: anony });

    } catch (e) {
        console.log(e);
        reply(`*ᴄʜᴀɪ ꜱᴘɪʟʟᴇᴅ!* ${e.message}\nʙᴇᴛᴛᴇʀ ʟᴜᴄᴋ ɴᴇxᴛ ᴛɪᴍᴇ!`);
    }
});

//ꜱᴛɪᴄᴋᴇʀ ᴛᴏ ɪᴍᴀɢᴇ

cmd({
    pattern: 'convert',
    alias: ['sticker2img', 'stoimg', 'stickertoimage', 's2i'],
    desc: 'Convert stickers to images',
    category: 'download',
    react: '🖼️',
    filename: __filename
}, async (client, match, message, { from }) => {
    
    if (!message.quoted) {
        return await client.sendMessage(from, {
            text: "ꜱᴛɪᴄᴋᴇʀ ᴄᴏɴᴠᴇʀᴛᴇʀ\n\nᴘʟᴇᴀꜱᴇ ʀᴇᴘʟʏ ᴛᴏ ᴀ ꜱᴛɪᴄᴋᴇʀ ᴍᴇꜱꜱᴀɢᴇ\n\nᴇxᴀᴍᴘʟᴇ: `.convert` (reply to sticker)"
        }, { quoted: message });
    }

    if (message.quoted.mtype !== 'stickerMessage') {
        return await client.sendMessage(from, {
            text: "ᴏɴʟʏ ꜱᴛɪᴄᴋᴇʀ ᴍᴇꜱꜱᴀɢᴇꜱ ᴄᴀɴ ʙᴇ ᴄᴏɴᴠᴇʀᴛᴇᴅ"
        }, { quoted: message });
    }

    // Send processing message
    await client.sendMessage(from, {
        text: "🔄 ᴄᴏɴᴠᴇʀᴛɪɴɢ ꜱᴛɪᴄᴋᴇʀ ᴛᴏ ɪᴍᴀɢᴇ..."
    }, { quoted: message });

    try {
        const stickerBuffer = await message.quoted.download();
        const imageBuffer = await stickerConverter.convertStickerToImage(stickerBuffer);

        // Send result
        await client.sendMessage(from, {
            image: imageBuffer,
            caption: "> ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴘʀɪᴍᴇ ʀɪᴅᴢ ᪥",
            mimetype: 'image/png'
        }, { quoted: message });

    } catch (error) {
        console.error('Conversion error:', error);
        await client.sendMessage(from, {
            text: "ᴘʟᴇᴀꜱᴇ ᴛʀʏ ᴡɪᴛʜ ᴀ ᴅɪꜰꜰᴇʀᴇɴᴛ ꜱᴛɪᴄᴋᴇʀ."
        }, { quoted: message });
    }
});

// ᴛᴏ ᴍᴘ3 ᴄᴏᴍᴍᴀɴᴅ 

cmd({
    pattern: 'tomp3',
    alias: ['mp3', 'audio'],
    desc: 'Convert media to audio',
    category: 'download',
    react: '🎵',
    filename: __filename
}, async (client, match, message, { from }) => {
    try {
        // Input validation
        if (!match.quoted) {
            return await client.sendMessage(from, {
                text: "*🔊 ᴘʟᴇᴀꜱᴇ ʀᴇᴘʟʏ ᴛᴏ ᴀ ᴠɪᴅᴇᴏ/ ᴀᴜᴅɪᴏ ᴍᴇꜱꜱᴀɢᴇ*"
            }, { quoted: message });
        }

        if (!['videoMessage', 'audioMessage'].includes(match.quoted.mtype)) {
            return await client.sendMessage(from, {
                text: "ᴏɴʟʏ ᴠɪᴅᴇᴏ/ᴀᴜᴅɪᴏ ᴍᴇꜱꜱᴀɢᴇꜱ ᴄᴀɴ ʙᴇ ᴄᴏɴᴠᴇʀᴛᴇᴅ"
            }, { quoted: message });
        }

        if (match.quoted.seconds > 300) {
            return await client.sendMessage(from, {
                text: "⏱️ ᴍᴇᴅɪᴀ ᴛᴏᴏ ʟᴏɴɢ (ᴍᴀx 5 ᴍɪɴᴜᴛᴇꜱ)"
            }, { quoted: message });
        }

        // Show processing status with reaction
        await client.sendMessage(from, { react: { text: '⏳', key: message.key } });

        const buffer = await match.quoted.download();
        const ext = match.quoted.mtype === 'videoMessage' ? 'mp4' : 'm4a';
        const audio = await converter.toAudio(buffer, ext);

        // Send result and show success reaction
        await client.sendMessage(from, {
            audio: audio,
            mimetype: 'audio/mpeg'
        }, { quoted: message });
        
        await client.sendMessage(from, { react: { text: '✅', key: message.key } });

    } catch (e) {
        console.error('Conversion error:', e.message);
        await client.sendMessage(from, {
            text: "ꜰᴀɪʟᴇᴅ ᴛᴏ ᴘʀᴏᴄᴇꜱꜱ ᴀᴜᴅɪᴏ"
        }, { quoted: message });
        await client.sendMessage(from, { react: { text: '❌', key: message.key } });
    }
});

//ᴛᴏ ᴠᴏɪᴄᴇ ɴᴏᴛᴇ

cmd({
    pattern: 'toptt',
    alias: ['voice', 'tovoice'],
    desc: 'Convert media to voice message',
    category: 'download',
    react: '🎙️',
    filename: __filename
}, async (client, match, message, { from }) => {
    // Input validation
    if (!match.quoted) {
        return await client.sendMessage(from, {
            text: "*🗣️ ᴘʟᴇᴀꜱᴇ ʀᴇᴘʟʏ ᴛᴏ ᴀ ᴠɪᴅᴇᴏ/ᴀᴜᴅɪᴏ ᴍᴇꜱꜱᴀɢᴇ*"
        }, { quoted: message });
    }

    if (!['videoMessage', 'audioMessage'].includes(match.quoted.mtype)) {
        return await client.sendMessage(from, {
            text: "❌ Only video/audio messages can be converted"
        }, { quoted: message });
    }

    if (match.quoted.seconds > 60) {
        return await client.sendMessage(from, {
            text: "⏱️ ᴍᴇᴅɪᴀ ᴛᴏᴏ ʟᴏɴɢ ꜰᴏʀ ᴀᴜᴅɪᴏ  (ᴍᴀx 1 ᴍɪɴᴜᴛᴇ)"
        }, { quoted: message });
    }

    // Send processing message
    await client.sendMessage(from, {
        text: "🔄 ᴄᴏɴᴠᴇʀᴛɪɴɢ ᴛᴏ ᴠᴏɪᴄᴇ ᴍᴇꜱꜱᴀɢᴇ..."
    }, { quoted: message });

    try {
        const buffer = await match.quoted.download();
        const ext = match.quoted.mtype === 'videoMessage' ? 'mp4' : 'm4a';
        const ptt = await converter.toPTT(buffer, ext);

        // Send result
        await client.sendMessage(from, {
            audio: ptt,
            mimetype: 'audio/ogg; codecs=opus',
            ptt: true
        }, { quoted: message });

    } catch (e) {
        console.error('PTT conversion error:', e.message);
        await client.sendMessage(from, {
            text: "ꜰᴀɪʟᴇᴅ ᴛᴏ ᴄʀᴇᴀᴛᴇ ᴠᴏɪᴄᴇ ᴍᴇꜱꜱᴀɢᴇ"
        }, { quoted: message });
    }
});

// ᴄᴏᴜɴᴛʀʏ ɪɴꜰᴏʀᴍᴀᴛɪᴏɴ 

cmd({
    pattern: "countryinfo",
    alias: ["cinfo", "country","cinfo2"],
    desc: "Get information about a country",
    category: "main",
    react: "🌍",
    filename: __filename
},
async (conn, mek, m, { from, args, q, reply, react }) => {
    try {
        if (!q) return reply("ᴘʟᴇᴀꜱᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ᴄᴏᴜɴᴛʀʏ ɴᴀᴍᴇ.\nᴇxᴀᴍᴘᴇ: `.countryinfo uganda`");

        const apiUrl = `https://api.siputzx.my.id/api/tools/countryInfo?name=${encodeURIComponent(q)}`;
        const { data } = await axios.get(apiUrl);

        if (!data.status || !data.data) {
            await react("❌");
            return reply(`ɴᴏ ɪɴꜰᴏʀᴍᴀᴛɪᴏɴ ꜰᴏᴜɴᴅ ꜰᴏʀ *${q}*. ᴘʟᴇᴀꜱᴇ ᴄʜᴇᴄᴋ ᴛʜᴇ ᴄᴏᴜɴᴛʀʏ ɴᴀᴍᴇ.`);
        }

        const info = data.data;
        let neighborsText = info.neighbors.length > 0
            ? info.neighbors.map(n => `🌍 *${n.name}*`).join(", ")
            : "ɴᴏ ɴᴇɪɢʜʙᴏʀɪɴɢ ᴄᴏᴜɴᴛʀɪᴇꜱ ꜰᴏᴜɴᴅ.";

        const text =` ╭━━━❏🏔️ *ᴘʀɪᴍᴇ ʀɪᴅᴢ ᴄᴏᴜɴᴛʀʏ ɪɴꜰᴏ*\n\n` +
                     `├•▣┃ *ᴄᴀᴘɪᴛᴀʟ:* ${info.capital}\n` +
                     `├•▣┃ *ᴄᴏɴᴛɪɴᴇɴᴛ:* ${info.continent.name} ${info.continent.emoji}\n` +
                     `├•▣┃ *ᴘʜᴏɴᴇ ᴄᴏᴅᴇ:* ${info.phoneCode}\n` +
                     `├•▣┃ *ᴀʀᴇᴀ:* ${info.area.squareKilometers} km² (${info.area.squareMiles} mi²)\n` +
                     `├•▣┃ *ᴅʀɪᴠɪɴɢ ꜱɪᴅᴇ:* ${info.drivingSide}\n` +
                     `├•▣┃ *ᴄᴜʀʀᴇɴᴄʏ:* ${info.currency}\n` +
                     `├•▣┃ *ʟᴀɴɢᴜᴀɢᴇꜱ:* ${info.languages.native.join(", ")}\n` +
                     `├•▣┃ *ꜰᴀᴍᴏᴜꜱ ꜰᴏʀ:* ${info.famousFor}\n` +
                     `├•▣┃ *ɪꜱᴏ ᴄᴏᴅᴇ:* ${info.isoCode.alpha2.toUpperCase()}, ${info.isoCode.alpha3.toUpperCase()}\n` +
                     `├•▣┃ *ɪɴᴛᴇʀɴᴇᴛ ᴛʟᴅ:* ${info.internetTLD}\n\n` +
                     `├•▣┃ *ɴᴇɪɢʜʙᴏʀꜱ:* ${neighborsText}\n`+
                     `╰▬▬▬▬▬▬▬▬▬▬▬▬▬▬❏ `;

        await conn.sendMessage(from, {
            image: { url: info.flag },
            caption: text,
            contextInfo: { mentionedJid: [m.sender] }
        }, { quoted: anony });

        await react("✅"); // React after successful response
    } catch (e) {
        console.error("Error in countryinfo command:", e);
        await react("❌");
        reply("ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ꜰᴇᴛᴄʜɪɴɢ ᴄᴏᴜɴᴛʀʏ ɪɴꜰᴏʀᴍᴀᴛɪᴏɴ.");
    }
});

//ꜰᴇᴛᴄʜ ᴄᴏᴍᴍᴀɴᴅ 

cmd({
    pattern: "fetch",
    alias: ["get", "api"],
    desc: "Fetch data from a provided URL or API",
    category: "main",
    react: "🌐",
    filename: __filename
},
async (conn, mek, m, { from, quoted, body, args, reply }) => {
    try {
        const q = args.join(' ').trim(); // Extract the URL or API query
        if (!q) return reply('ᴘʟᴇᴀꜱᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ᴠᴀʟɪᴅ ᴜʀʟ ᴏʀ Qᴜᴇʀʏ.');

        if (!/^https?:\/\//.test(q)) return reply('ᴜʀʟ ᴍᴜꜱᴛ ꜱᴛᴀʀᴛ ᴡɪᴛʜ  http:// ᴏʀ https://.');

        const data = await fetchJson(q); // Use your fetchJson utility function to get data
        const content = JSON.stringify(data, null, 2);

        await conn.sendMessage(from, {
            text: `🔍 *ꜰᴇᴛᴄʜᴇᴅ ᴅᴀᴛᴀ*:\n\`\`\`${content.slice(0, 2048)}\`\`\``,
            contextInfo: {
                mentionedJid: [m.sender],
                forwardingScore: 999,
                isForwarded: true,
                forwardingSourceMessage: 'ʏᴏᴜʀ ᴅᴀᴛᴀ ʀᴇQᴜᴇꜱᴛ',
            }
        }, { quoted: anony });
    } catch (e) {
        console.error("Error in fetch command:", e);
        reply(`ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ :\n${e.message}`);
    }
});

// ꜰᴏʀᴡᴀʀᴅ ᴄᴏᴍᴍᴀɴᴅ 

cmd({
  pattern: "forward",
  alias: ["fwd"],
  desc: "Bulk forward media to groups",
  category: "owner",
  filename: __filename
}, async (client, message, match, { isOwner }) => {
  try {
    // Owner check
    if (!isOwner) return await message.reply("*ᴏᴡɴᴇʀ ᴏɴʟʏ ᴄᴏᴍᴍᴀɴᴅ*");
    
    if (!message.quoted) return await message.reply("*ᴘʟᴇᴀꜱᴇ ʀᴇᴘʟʏ ᴛᴏ ᴀ ᴍᴇꜱꜱᴀɢᴇ*");

    let jidInput = "";

    if (typeof match === "string") {
      jidInput = match.trim();
    } else if (Array.isArray(match)) {
      jidInput = match.join(" ").trim();
    } else if (match && typeof match === "object") {
      jidInput = match.text || "";
    }

    const rawJids = jidInput.split(/[\s,]+/).filter(jid => jid.trim().length > 0);
 
    const validJids = rawJids
      .map(jid => {
        // Remove existing @g.us if present
        const cleanJid = jid.replace(/@g\.us$/i, "");
        // Only keep if it's all numbers
        return /^\d+$/.test(cleanJid) ? `${cleanJid}@g.us` : null;
      })
      .filter(jid => jid !== null)
      .slice(0, SAFETY.MAX_JIDS);

    if (validJids.length === 0) {
      return await message.reply(
        "ɴᴏ ᴠᴀʟɪᴅ ɢʀᴏᴜᴘ ᴊɪᴅꜱ ꜰᴏᴜɴᴅ\n" +
        "Examples:\n" +
        ".fwd 120363411055156472@g.us,120363333939099948@g.us\n" +
        ".fwd 120363411055156472 120363333939099948"
      );
    }

    let messageContent = {};
    const mtype = message.quoted.mtype;
    
    // For media messages (image, video, audio, sticker, document)
    if (["imageMessage", "videoMessage", "audioMessage", "stickerMessage", "documentMessage"].includes(mtype)) {
      const buffer = await message.quoted.download();
      
      switch (mtype) {
        case "imageMessage":
          messageContent = {
            image: buffer,
            caption: message.quoted.text || '',
            mimetype: message.quoted.mimetype || "image/jpeg"
          };
          break;
        case "videoMessage":
          messageContent = {
            video: buffer,
            caption: message.quoted.text || '',
            mimetype: message.quoted.mimetype || "video/mp4"
          };
          break;
        case "audioMessage":
          messageContent = {
            audio: buffer,
            mimetype: message.quoted.mimetype || "audio/mp4",
            ptt: message.quoted.ptt || false
          };
          break;
        case "stickerMessage":
          messageContent = {
            sticker: buffer,
            mimetype: message.quoted.mimetype || "image/webp"
          };
          break;
        case "documentMessage":
          messageContent = {
            document: buffer,
            mimetype: message.quoted.mimetype || "application/octet-stream",
            fileName: message.quoted.fileName || "document"
          };
          break;
      }
    } 
    // For text messages
    else if (mtype === "extendedTextMessage" || mtype === "conversation") {
      messageContent = {
        text: message.quoted.text
      };
    } 
    // For other message types (forwarding as-is)
    else {
      try {
        // Try to forward the message directly
        messageContent = message.quoted;
      } catch (e) {
        return await message.reply("ᴜɴꜱᴜᴘᴘᴏʀᴛᴇᴅ ᴍᴇꜱꜱᴀɢᴇ ᴛʏᴘᴇ");
      }
    }
    let successCount = 0;
    const failedJids = [];
    
    for (const [index, jid] of validJids.entries()) {
      try {
        await client.sendMessage(jid, messageContent);
        successCount++;
        
        if ((index + 1) % 10 === 0) {
          await message.reply(`🔄 ꜱᴇɴᴛ ᴛᴏ ${index + 1}/${validJids.length} ɢʀᴏᴜᴘꜱ...`);
        }
        
        // Apply reduced delay
        const delayTime = (index + 1) % 10 === 0 ? SAFETY.EXTRA_DELAY : SAFETY.BASE_DELAY;
        await new Promise(resolve => setTimeout(resolve, delayTime));
        
      } catch (error) {
        failedJids.push(jid.replace('@g.us', ''));
        await new Promise(resolve => setTimeout(resolve, SAFETY.BASE_DELAY));
      }
    }

    // ===== [COMPREHENSIVE REPORT] ===== //
    let report = `✅ *ꜰᴏʀᴡᴀʀᴅ ᴄᴏᴍᴘʟᴇᴛᴇᴅ *\n\n` +
                 `📤 ꜱᴜᴄᴄᴇꜱꜱ: ${successCount}/${validJids.length}\n` +
                 `📦 ᴄᴏɴᴛᴇɴᴛ ᴛʏᴘᴇ: ${mtype.replace('Message', '') || 'text'}\n`;
    
    if (failedJids.length > 0) {
      report += `\nꜰᴀɪʟᴇᴅ (${failedJids.length}): ${failedJids.slice(0, 5).join(', ')}`;
      if (failedJids.length > 5) report += ` +${failedJids.length - 5} ᴍᴏʀᴇ`;
    }
    
    if (rawJids.length > SAFETY.MAX_JIDS) {
      report += `\n⚠️ ɴᴏᴛᴇ: ʟɪᴍɪᴛᴇᴅ ᴛᴏ ꜰɪʀꜱᴛ ${SAFETY.MAX_JIDS} ᴊɪᴅꜱ`;
    }

    await message.reply(report);

  } catch (error) {
    console.error("Forward Error:", error);
    await message.reply(
      `ᴇʀʀᴏʀ: ${error.message.substring(0, 100)}\n\n` +
      `ᴘʟᴇᴀꜱᴇ ᴛʀʏ ᴀɢᴀɪɴ ᴏʀ ᴄʜᴇᴄᴋ :\n` +
      `1. ᴊɪᴅ ꜰᴏʀᴍᴀᴛɪɴɢ\n` +
      `2. ᴍᴇᴅɪᴀ  ᴛʏᴘᴇ ꜱᴜᴘᴘᴏʀᴛ\n` +
      `3. ʙᴏᴛ ᴘᴇʀᴍɪꜱꜱɪᴏɴ `
    );
  }
});
//random color
cmd({
    pattern: "rcolor",
    desc: "Generate a random color with name and code.",
    category: "utility",
    filename: __filename,
}, 
async (conn, mek, m, { reply }) => {
    try {
        const colorNames = [
            "Red", "Green", "Blue", "Yellow", "Orange", "Purple", "Pink", "Brown", "Black", "White", 
            "Gray", "Cyan", "Magenta", "Violet", "Indigo", "Teal", "Lavender", "Turquoise"
        ];
        
        const randomColorHex = "#" + Math.floor(Math.random()*16777215).toString(16);
        const randomColorName = colorNames[Math.floor(Math.random() * colorNames.length)];

        reply(`ʀᴀɴᴅᴏᴍ ᴄᴏʟᴏʀ \nɴᴀᴍᴇ: ${randomColorName}\nᴄᴏᴅᴇ: ${randomColorHex}`);
    } catch (e) {
        console.error("Error in .randomcolor command:", e);
        reply("ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ɢᴇɴᴇʀᴀᴛɪɴɢ ᴛʜᴇ ʀᴀɴᴅᴏᴍ ᴄᴏʟᴏʀ.");
    }
});

cmd({
    pattern: "binary",
    desc: "Convert text into binary format.",
    category: "utility",
    filename: __filename,
}, 
async (conn, mek, m, { args, reply }) => {
    try {
        if (!args.length) return reply("ᴘᴘʟᴇᴀꜱᴇ ᴘʀᴏᴠɪᴅᴇ ᴛᴇxᴛ ᴛᴏ ᴄᴏɴᴠᴇʀᴛ ᴛᴏ ʙɪɴᴀʀʏ.");

        const textToConvert = args.join(" ");
        const binaryText = textToConvert.split('').map(char => {
            return `00000000${char.charCodeAt(0).toString(2)}`.slice(-8);
        }).join(' ');

        reply(`🔑 *ʙɪɴᴀʀʏ ʀᴇᴘʀᴇꜱᴇɴᴛᴀᴛɪᴏɴ:* \n${binaryText}`);
    } catch (e) {
        console.error("Error in .binary command:", e);
        reply("ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ᴄᴏɴᴠᴇʀᴛɪɴɢ ᴛᴏ ʙɪɴᴀʀʏ.");
    }
});

cmd({
    pattern: "dbinary",
    desc: "Decode binary string into text.",
    category: "utility",
    filename: __filename,
}, 
async (conn, mek, m, { args, reply }) => {
    try {
        if (!args.length) return reply("ᴘʟᴇᴀꜱᴇ ᴘʀᴏᴠɪᴅᴇ ᴛʜᴇ ʙɪɴᴀʀʏ ꜱᴛʀɪɴɢ ᴛᴏ ᴅᴇᴄᴏᴅᴇ.");

        const binaryString = args.join(" ");
        const textDecoded = binaryString.split(' ').map(bin => {
            return String.fromCharCode(parseInt(bin, 2));
        }).join('');

        reply(`🔓 *ᴅᴇᴄᴏᴅᴇᴅ ᴛᴇxᴛ:* \n${textDecoded}`);
    } catch (e) {
        console.error("Error in .binarydecode command:", e);
        reply("ᴀɴ ᴇʀʀᴏʀ ᴡʜɪʟᴇ ᴅᴇᴄᴏᴅɪɴɢ ʙɪɴᴀʀʏ ꜱᴛʀɪɴɢ .");
    }
});


cmd({
    pattern: "base64",
    desc: "Encode text into Base64 format.",
    category: "utility",
    filename: __filename,
}, 
async (conn, mek, m, { args, reply }) => {
    try {
        // Ensure the user provided some text
        if (!args.length) return reply("ᴘʟᴇᴀꜱᴇ ᴘʀᴏᴠɪᴅᴇ ᴛʜᴇ ᴛᴇxᴛ ʏᴏᴜ ᴡᴀɴᴛ ᴛᴏ ᴇɴᴄᴏᴅᴇ ᴛᴏ ʙᴀꜱᴇ64.");

        const textToEncode = args.join(" ");
        
        // Encode the text into Base64
        const encodedText = Buffer.from(textToEncode).toString('base64');
        
        // Send the encoded Base64 text
        reply(`🔑 *ᴇɴᴄᴏᴅᴇᴅ ʙᴀꜱᴇ64 ᴛᴇxᴛ:* \n${encodedText}`);
    } catch (e) {
        console.error("Error in .base64 command:", e);
        reply("❌ An ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ᴇɴᴄᴏᴅɪɴɢ ᴛᴇxᴛ ɪɴᴛᴏ ʙᴀꜱᴇ64.");
    }
});

cmd({
    pattern: "unbase64",
    desc: "Decode Base64 encoded text.",
    category: "utility",
    filename: __filename,
}, 
async (conn, mek, m, { args, reply }) => {
    try {
        // Ensure the user provided Base64 text
        if (!args.length) return reply("ᴘʟᴇᴀꜱᴇ ᴘʀᴏᴠɪᴅᴇ ᴛʜᴇ ʙᴀꜱᴇ64 ᴇɴᴄᴏᴅᴇᴅ ᴛᴇxᴛ ᴛᴏ ᴅᴇᴄᴏᴅᴇ.");

        const base64Text = args.join(" ");
        
        // Decode the Base64 text
        const decodedText = Buffer.from(base64Text, 'base64').toString('utf-8');
        
        // Send the decoded text
        reply(`🔓 *ᴅᴇᴄᴏᴅᴇᴅ ᴛᴇxᴛ:* \n${decodedText}`);
    } catch (e) {
        console.error("Error in .unbase64 command:", e);
        reply("ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ᴅᴇᴄᴏᴅɪɴɢ ʙᴀꜱᴇ64 ᴛᴇxᴛ.");
    }
});

cmd({
    pattern: "urlencode",
    desc: "Encode text into URL encoding.",
    category: "utility",
    filename: __filename,
}, 
async (conn, mek, m, { args, reply }) => {
    try {
        if (!args.length) return reply("ᴘʟᴇᴀꜱᴇ ᴘʀᴏᴠɪᴅᴇ ᴛʜᴇ ᴛᴇxᴛ ᴛᴏ ʙᴇ ᴜʀʟ ᴇɴᴄᴏᴅᴇᴅ.");

        const textToEncode = args.join(" ");
        const encodedText = encodeURIComponent(textToEncode);

        reply(`🔑 *ᴇɴᴄᴏᴅᴇᴅ ᴜʀʟ ᴛᴇxᴛ:* \n${encodedText}`);
    } catch (e) {
        console.error("Error in .urlencode command:", e);
        reply("ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ᴘʀᴏᴄᴇꜱꜱɪɴɢ ʏᴏᴜʀ ʀᴇQᴜᴇꜱᴛ.");
    }
});

cmd({
    pattern: "urldecode",
    desc: "Decode URL encoded text.",
    category: "utility",
    filename: __filename,
}, 
async (conn, mek, m, { args, reply }) => {
    try {
        if (!args.length) return reply("ᴘʟᴇᴀꜱᴇ ᴘʀᴏᴠɪᴅᴇ ᴛʜᴇ ᴜʀʟ ᴇɴᴄᴏᴅᴇᴅ ᴛᴇxᴛ ᴛᴏ ᴅᴇᴄᴏᴅᴇ.");

        const encodedText = args.join(" ");
        const decodedText = decodeURIComponent(encodedText);

        reply(`🔓 *ᴅᴇᴄᴏᴅᴇᴅ ᴛᴇxᴛ:* \n${decodedText}`);
    } catch (e) {
        console.error("Error in .urldecode command:", e);
        reply("ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ᴘʀᴏᴄᴇꜱꜱɪɴɢ ʏᴏᴜʀ ʀᴇQᴜᴇꜱᴛ.");
    }
});

cmd({
    pattern: "roll",
    desc: "Roll a dice (1-6).",
    category: "fun",
    filename: __filename,
}, 
async (conn, mek, m, { reply }) => {
    try {
        // Roll a dice (generate a random number between 1 and 6)
        const result = Math.floor(Math.random() * 6) + 1;
        
        // Send the result
        reply(`🎲 ʏᴏᴜ ʀᴏʟʟᴇᴅ: *${result}*`);
    } catch (e) {
        console.error("Error in .roll command:", e);
        reply("ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ᴘʀᴏᴄᴇꜱꜱɪɴɢ ʏᴏᴜʀ ʀᴇQᴜᴇꜱᴛ.");
    }
}); 


cmd({
    pattern: "coinflip",
    desc: "Flip a coin and get Heads or Tails.",
    category: "fun",
    filename: __filename,
}, 
async (conn, mek, m, { reply }) => {
    try {
        // Simulate coin flip (randomly choose Heads or Tails)
        const result = Math.random() < 0.5 ? "ʜᴇᴀᴅꜱ" : "ᴛᴀɪʟꜱ";
        
        // Send the result
        reply(`🪙 ᴄᴏɪɴ ꜰʟɪᴘ ʀᴇꜱᴜʟᴛ: *${result}*`);
    } catch (e) {
        console.error("Error in .coinflip command:", e);
        reply("ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ᴘʀᴏᴄᴇꜱꜱɪɴɢ ʏᴏᴜʀ ʀᴇQᴜᴇꜱᴛ.");
    }
});

cmd({
    pattern: "flip",
    desc: "Flip the text you provide.",
    category: "fun",
    filename: __filename,
}, 
async (conn, mek, m, { args, reply }) => {
    try {
        // Ensure text is provided
        if (!args.length) return reply("ᴘʟᴇᴀꜱᴇ ᴘʀᴏᴠɪᴅᴇ ᴛᴇxᴛ ᴛᴏ ꜰʟɪᴘ.");

        // Flip the text
        const flippedText = args.join(" ").split('').reverse().join('');
        
        // Send the flipped text
        reply(`ꜰʟɪᴘᴘᴇᴅ ᴛᴇxᴛ: *${flippedText}*`);
    } catch (e) {
        console.error("Error in .flip command:", e);
        reply("ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ᴘʀᴏᴄᴇꜱꜱɪɴɢ ʏᴏᴜʀ ʀᴇQᴜᴇꜱᴛ.");
    }
});

cmd({
    pattern: "pick",
    desc: "Pick between two choices.",
    category: "fun",
    filename: __filename,
}, 
async (conn, mek, m, { args, reply }) => {
    try {
        // Ensure two options are provided
        if (args.length < 2) return reply("ᴘʟᴇᴀꜱᴇ ᴘʀᴏᴠɪᴅᴇ ᴛᴡᴏ ᴄʜᴏɪᴄᴇꜱ ᴛᴏ ᴘɪᴄᴋ ꜰʀᴏᴍ. ᴇxᴀᴍᴘʟᴇ: `.pick Ice Cream, Pizza`");

        // Pick a random option
        const option = args.join(" ").split(',')[Math.floor(Math.random() * 2)].trim();
        
        // Send the result
        reply(`🎉 ᴘʀɪᴍᴇ ʀɪᴅᴢ ᴘɪᴄᴋꜱ: *${option}*`);
    } catch (e) {
        console.error("Error in .pick command:", e);
        reply("ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ᴘʀᴏᴄᴇꜱꜱɪɴɢ ʏᴏᴜʀ ʀᴇQᴜᴇꜱᴛ.");
    }
});

cmd({
    pattern: "timenow",
    desc: "Check the current local time.",
    category: "utility",
    filename: __filename,
}, 
async (conn, mek, m, { reply }) => {
    try {
        // Get current date and time
        const now = new Date();
        
        const localTime = now.toLocaleTimeString("en-US", { 
            hour: "2-digit", 
            minute: "2-digit", 
            second: "2-digit", 
            hour12: true,
            timeZone: "Africa/kampala" 
        });
        
        // Send the local time as reply
        reply(`🕒 ᴄᴜʀʀᴇɴᴛ ʟᴏᴄᴀʟ ᴛɪᴍᴇ ɪɴ ᴜɢᴀɴᴅᴀ: ${localTime}`);
    } catch (e) {
        console.error("Error in .timenow command:", e);
        reply("ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ᴘʀᴏᴄᴇꜱꜱɪɴɢ ʏᴏᴜʀ ʀᴇQᴜᴇꜱᴛ .");
    }
});

cmd({
    pattern: "date",
    desc: "Check the current date.",
    category: "utility",
    filename: __filename,
}, 
async (conn, mek, m, { reply }) => {
    try {
        // Get current date
        const now = new Date();
        
        // Get the formatted date (e.g., "Monday, January 15, 2025")
        const currentDate = now.toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric"
        });
        
        // Send the current date as reply
        reply(`📅 ᴄᴜʀʀᴇɴᴛ ᴅᴀᴛᴇ: ${currentDate}`);
    } catch (e) {
        console.error("Error in .date command:", e);
        reply("ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ᴘʀᴏᴄᴇꜱꜱɪɴɢ ʏᴏᴜʀ ʀᴇQᴜᴇꜱᴛ.");
    }
});

cmd({
    pattern: "shapar",
    desc: "Send shapar ASCII art with mentions.",
    category: "fun",
    filename: __filename,
}, 
async (conn, mek, m, { from, isGroup, reply }) => {
    try {
        // Ensure the command is used in a group
        if (!isGroup) {
            return reply("ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ ᴄᴀɴ ᴏɴʟʏ ʙᴇ ᴜꜱᴇᴅ ɪɴ ɢʀᴏᴜᴘꜱ.");
        }

        // Extract the mentioned user
        const mentionedUser = m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        if (!mentionedUser) {
            return reply("ᴘʟᴇᴀꜱᴇ ᴍᴇɴᴛɪᴏɴ ᴀ ᴜꜱᴇʀ ᴛᴏ ꜱᴇɴᴅ ᴛʜᴇ ᴀꜱᴄɪɪ ᴀʀᴛ ᴛᴏ.");
        }

        // Shapar ASCII Art
        const asciiArt = `
          _______
       .-'       '-.
      /           /|
     /           / |
    /___________/  |
    |   _______ |  |
    |  |  \\ \\  ||  |
    |  |   \\ \\ ||  |
    |  |____\\ \\||  |
    |  '._  _.'||  |
    |    .' '.  ||  |
    |   '.___.' ||  |
    |___________||  |
    '------------'  |
     \\_____________\\|
`;

        // Message to send
        const message = `😂 @${mentionedUser.split("@")[0]}!\n😂 ᴛʜᴀᴛ ꜰᴏʀ ʏᴏᴜ:\n\n${asciiArt}`;

        // Send the message with mentions
        await conn.sendMessage(from, {
            text: message,
            mentions: [mentionedUser],
        }, { quoted: m });

    } catch (e) {
        console.error("Error in .shapar command:", e);
        reply("ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ᴘʀᴏᴄᴇꜱꜱɪɴɢ ʏᴏᴜʀ ʀᴇQᴜᴇꜱᴛ.");
    }
});

cmd({
    pattern: "rate",
    desc: "Rate someone out of 10.",
    category: "fun",
    filename: __filename,
}, 
async (conn, mek, m, { from, isGroup, reply }) => {
    try {
        if (!isGroup) return reply("ᴏɴʟʏ ɢʀᴏᴜᴘ ᴍᴇᴍʙᴇʀꜱ ᴄᴀɴ ᴜꜱᴇ ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ.");

        const mentionedUser = m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        if (!mentionedUser) return reply("ᴘʟᴇᴀꜱᴇ ᴍᴇɴᴛɪᴏɴ ꜱᴏᴍᴇᴏɴᴇ ᴛᴏ ʀᴀᴛᴇ.");

        const randomRating = Math.floor(Math.random() * 10) + 1;
        const message = `@${mentionedUser.split("@")[0]} ɪꜱ ʀᴀᴛᴇᴅ ${randomRating}/10.`;

        await conn.sendMessage(from, { text: message, mentions: [mentionedUser] }, { quoted: m });
    } catch (e) {
        console.error("Error in .rate command:", e);
        reply("ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ᴘʀᴏᴄᴇꜱꜱɪɴɢ ʏᴏᴜʀ ʀᴇQᴜᴇꜱᴛ.");
    }
});

cmd({
    pattern: "countx",
    desc: "Start a reverse countdown from the specified number to 1.",
    category: "owner",
    filename: __filename
},
async (conn, mek, m, { args, reply, senderNumber }) => {
    try {
        // Get the bot owner's number dynamically from conn.user.id
        const botOwner = conn.user.id.split(":")[0]; // Extract the bot owner's number
        if (senderNumber !== botOwner) {
            return reply("ᴏɴʟʏ ᴛʜᴇ ʙᴏᴛ ᴏᴡɴᴇʀ ᴄᴀɴ ᴜꜱᴇ ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ.");
        }

        // Ensure arguments are provided
        if (!args[0]) {
            return reply("✳️  ᴜꜱᴇ ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ ʟɪᴋᴇ:\n *ᴇxᴀᴍᴘʟᴇ:* .countx 10");
        }

        const count = parseInt(args[0].trim());

        // Validate the input
        if (isNaN(count) || count <= 0 || count > 50) {
            return reply("ᴘʟᴇᴀꜱᴇ ꜱᴘᴇᴄɪꜰʏ ᴀ ᴠᴀʟɪᴅ ɴᴜᴍʙᴇʀ ʙᴇᴛᴡᴇᴇ 1 ᴀɴᴅ 50.");
        }

        reply(`ꜱᴛᴀʀᴛɪɴɢ ʀᴇᴠᴇʀꜱᴇ ᴄᴏᴜɴᴛᴅᴏᴡɴ ꜰʀᴏᴍ ${count}...`);

        for (let i = count; i >= 1; i--) {
            await conn.sendMessage(m.chat, { text: `${i}` }, { quoted: mek });
            await sleep(1000); // 1-second delay between messages
        }

        reply(`ᴄᴏᴜɴᴛᴅᴏᴡɴ ᴄᴏᴍᴘʟᴇᴛᴇᴅ.`);
    } catch (e) {
        console.error(e);
        reply("ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ᴘʀᴏᴄᴇꜱꜱɪɴɢ ʏᴏᴜʀ ʀᴇQᴜᴇꜱᴛ.");
    }
});

cmd({
    pattern: "count",
    desc: "Start a countdown from 1 to the specified number.",
    category: "owner",
    filename: __filename
},
async (conn, mek, m, { args, reply, senderNumber }) => {
    try {
        // Get the bot owner's number dynamically from conn.user.id
        const botOwner = conn.user.id.split(":")[0]; // Extract the bot owner's number
        if (senderNumber !== botOwner) {
            return reply("ᴏɴʟʏ ᴛʜᴇ ʙᴏᴛ ᴏᴡɴᴇʀ ᴄᴀɴ ᴜꜱᴇ ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ.");
        }

        // Ensure arguments are provided
        if (!args[0]) {
            return reply("✳️ ᴜꜱᴇ ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ ʟɪᴋᴇ:\n *ᴇxᴀᴍᴘʟᴇ:* .count 10");
        }

        const count = parseInt(args[0].trim());

        // Validate the input
        if (isNaN(count) || count <= 0 || count > 50) {
            return reply("ᴘʟᴇᴀꜱᴇ ꜱᴘᴇᴄɪꜰʏ ᴀ ᴠᴀʟɪᴅ ɴᴜᴍʙᴇʀ ʙᴇᴛᴡᴇᴇ 1 ᴀɴᴅ 50.");
        }

        reply(`ꜱᴛᴀʀᴛɪɴɢ ᴄᴏᴜɴᴛᴅᴏᴡɴ ${count}...`);

        for (let i = 1; i <= count; i++) {
            await conn.sendMessage(m.chat, { text: `${i}` }, { quoted: mek });
            await sleep(1000); // 1-second delay between messages
        }

        reply(`ᴄᴏᴜɴᴛᴅᴏᴡɴ ᴄᴏᴍᴘʟᴇᴛᴇᴅ.`);
    } catch (e) {
        console.error(e);
        reply("ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ᴘʀᴏᴄᴇꜱꜱɪɴɢ ʏᴏᴜʀ ʀᴇQᴜᴇꜱᴛ.");
    }
});

cmd({
    pattern: "calculate",
    alias: ["calc"],
    desc: "Evaluate a mathematical expression.",
    category: "tools",
    filename: __filename
},
async (conn, mek, m, { args, reply }) => {
    try {
        if (!args[0]) {
            return reply("✳️ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ ʟɪᴋᴇ:\n *ᴇxᴀᴍᴘʟᴇ:* .ᴄᴀʟᴄᴜʟᴀᴛᴇ 5+3*2");
        }

        const expression = args.join(" ").trim();

        if (!/^[0-9+\-*/().\s]+$/.test(expression)) {
            return reply("❎ ɪɴᴠᴀʟɪᴅ ᴇxᴘʀᴇssɪᴏɴ. ᴏɴʟʏ ɴᴜᴍʙᴇʀs ᴀɴᴅ +, -, *, /, ( ) ᴀʀᴇ ᴀʟʟᴏᴡᴇᴅ.");
        }

        let result;
        try {
            result = eval(expression);
        } catch (e) {
            return reply("❎ ᴇʀʀᴏʀ ɪɴ ᴄᴀʟᴄᴜʟᴀᴛɪᴏɴ. ᴘʟᴇᴀsᴇ ᴄʜᴇᴄᴋ ʏᴏᴜʀ ᴇxᴘʀᴇssɪᴏɴ.");
        }

        reply(`✅ ʀᴇsᴜʟᴛ ᴏꜰ "${expression}" ɪs: ${result}`);
    } catch (e) {
        console.error(e);
        reply("ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ᴘʀᴏᴄᴇssɪɴɢ ʏᴏᴜʀ ʀᴇǫᴜᴇsᴛ.");
    }
});



cmd({
    pattern: "person",
    react: "👤",
    alias: ["userinfo", "profile"],
    desc: "Get complete user profile information",
    category: "utility",
    use: '.person [@tag or reply]',
    filename: __filename
},
async (conn, mek, m, { from, sender, isGroup, reply, quoted, participants }) => {
    try {
        let userJid = quoted?.sender || 
                     mek.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || 
                     sender;

        const [user] = await conn.onWhatsApp(userJid).catch(() => []);
        if (!user?.exists) return reply("❌ ᴜsᴇʀ ɴᴏᴛ ꜰᴏᴜɴᴅ ᴏɴ ᴡʜᴀᴛsᴀᴘᴘ");

        let ppUrl;
        try {
            ppUrl = await conn.profilePictureUrl(userJid, 'image');
        } catch {
            ppUrl = 'https://i.ibb.co/KhYC4FY/1221bc0bdd2354b42b293317ff2adbcf-icon.png';
        }

        let userName = userJid.split('@')[0];
        try {
            if (isGroup) {
                const member = participants.find(p => p.id === userJid);
                if (member?.notify) userName = member.notify;
            }
            
            if (userName === userJid.split('@')[0] && conn.contactDB) {
                const contact = await conn.contactDB.get(userJid).catch(() => null);
                if (contact?.name) userName = contact.name;
            }
            
            if (userName === userJid.split('@')[0]) {
                const presence = await conn.presenceSubscribe(userJid).catch(() => null);
                if (presence?.pushname) userName = presence.pushname;
            }
        } catch (e) {
            console.log("Name fetch error:", e);
        }

        let bio = {};
        try {
            const statusData = await conn.fetchStatus(userJid).catch(() => null);
            if (statusData?.status) {
                bio = {
                    text: statusData.status,
                    type: "ᴘᴇʀsᴏɴᴀʟ",
                    updated: statusData.setAt ? new Date(statusData.setAt * 1000) : null
                };
            } else {
                const businessProfile = await conn.getBusinessProfile(userJid).catch(() => null);
                if (businessProfile?.description) {
                    bio = {
                        text: businessProfile.description,
                        type: "ʙᴜsɪɴᴇss",
                        updated: null
                    };
                }
            }
        } catch (e) {
            console.log("Bio fetch error:", e);
        }

        let groupRole = "";
        if (isGroup) {
            const participant = participants.find(p => p.id === userJid);
            groupRole = participant?.admin ? "👑 ᴀᴅᴍɪɴ" : "👥 ᴍᴇᴍʙᴇʀ";
        }

        const formattedBio = bio.text ? 
            `${bio.text}\n└─ 📌 ${bio.type} ʙɪᴏ${bio.updated ? ` | 🕒 ${bio.updated.toLocaleString()}` : ''}` : 
            "ɴᴏ ʙɪᴏ ᴀᴠᴀɪʟᴀʙʟᴇ";

        const userInfo = `
*ɢᴄ ᴍᴇᴍʙᴇʀ ɪɴꜰᴏʀᴍᴀᴛɪᴏɴ 🧊*

📛 *ɴᴀᴍᴇ:* ${userName}
🔢 *ɴᴜᴍʙᴇʀ:* ${userJid.replace(/@.+/, '')}
📌 *ᴀᴄᴄᴏᴜɴᴛ ᴛʏᴘᴇ:* ${user.isBusiness ? "💼 ʙᴜsɪɴᴇss" : user.isEnterprise ? "🏢 ᴇɴᴛᴇʀᴘʀɪsᴇ" : "👤 ᴘᴇʀsᴏɴᴀʟ"}

*📝 ᴀʙᴏᴜᴛ:*
${formattedBio}

*⚙️ ᴀᴄᴄᴏᴜɴᴛ ɪɴꜰᴏ:*
✅ ʀᴇɢɪsᴛᴇʀᴇᴅ: ${user.isUser ? "ʏᴇs" : "ɴᴏ"}
🛡️ ᴠᴇʀɪꜰɪᴇᴅ: ${user.verifiedName ? "✅ ᴠᴇʀɪꜰɪᴇᴅ" : "❌ ɴᴏᴛ ᴠᴇʀɪꜰɪᴇᴅ"}
${isGroup ? `👥 *ɢʀᴏᴜᴘ ʀᴏʟᴇ:* ${groupRole}` : ''}
`.trim();

        await conn.sendMessage(from, {
            image: { url: ppUrl },
            caption: userInfo,
            mentions: [userJid]
        }, { quoted: anony });

    } catch (e) {
        console.error("Person command error:", e);
        reply(`❌ ᴇʀʀᴏʀ: ${e.message || "ꜰᴀɪʟᴇᴅ ᴛᴏ ꜰᴇᴛᴄʜ ᴘʀᴏꜰɪʟᴇ"}`);
    }
});

cmd({
  pattern: "readmore",
  alias: ["rm", "rmore", "readm"],
  desc: "Generate a Read More message with hidden text",
  category: "utility",
  use: ".readmore <your text>",
  react: "📝",
  filename: __filename
}, async (conn, mek, m, { from, reply, args }) => {
  try {
    if (!args[0]) return reply("❌ ᴘʟᴇᴀsᴇ ᴘʀᴏᴠɪᴅᴇ ᴛᴇxᴛ!\nᴇxᴀᴍᴘʟᴇ: .ʀᴇᴀᴅᴍᴏʀᴇ ʜᴇʟʟᴏ ᴡᴏʀʟᴅ");

    const inputText = args.join(" ");
    const readMoreGap = String.fromCharCode(8206).repeat(4001);
    const message = `${inputText}${readMoreGap}`;

    await conn.sendMessage(from, { text: message }, { quoted: anony });
    
  } catch (error) {
    console.error("Readmore Error:", error);
    reply("❌ ꜰᴀɪʟᴇᴅ ᴛᴏ ᴄʀᴇᴀᴛᴇ ʀᴇᴀᴅᴍᴏʀᴇ ᴍᴇssᴀɢᴇ. ᴘʟᴇᴀsᴇ ᴛʀʏ ᴀɢᴀɪɴ.");
  }
});



// ──────────────────────────────────────────────────────────────
// Command
// ──────────────────────────────────────────────────────────────
cmd({
    pattern: "remini",
    alias: ["enhance", "hq", "qualityup"],
    react: '✨',
    desc: "Enhance photo quality using Remini AI",
    category: "utility",
    use: ".remini [reply to image]",
    filename: __filename
}, async (conn, mek, m, { from, reply, quoted }) => {
    try {
        const quotedMsg = quoted || m;
        const mimeType = (quotedMsg.msg || quotedMsg).mimetype || '';
        
        if (!mimeType || !mimeType.startsWith('image/')) {
            return reply("ᴘʟᴇᴀsᴇ ʀᴇᴘʟʏ ᴛᴏ ᴀɴ ɪᴍᴀɢᴇ ꜰɪʟᴇ (ᴊᴘᴇɢ/ᴘɴɢ)");
        }

        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
        await reply("🔄 ᴇɴʜᴀɴᴄɪɴɢ ɪᴍᴀɢᴇ ǫᴜᴀʟɪᴛʏ, ᴘʟᴇᴀsᴇ ᴡᴀɪᴛ...");

        const mediaBuffer = await quotedMsg.download();
        
        let extension = '';
        if (mimeType.includes('image/jpeg')) extension = '.jpg';
        else if (mimeType.includes('image/png')) extension = '.png';
        else {
            return reply("ᴜɴsᴜᴘᴘᴏʀᴛᴇᴅ ɪᴍᴀɢᴇ ꜰᴏʀᴍᴀᴛ. ᴘʟᴇᴀsᴇ ᴜsᴇ ᴊᴘᴇɢ ᴏʀ ᴘɴɢ");
        }

        // 1) Upload source using the fallback logic
        const filename = `remini_${Date.now()}${extension}`;
        const imageUrl = await uploadImage(mediaBuffer, filename);

        // 2) Call the Remini API
        const apiUrl = `https://apis.davidcyriltech.my.id/remini?url=${encodeURIComponent(imageUrl)}`;
        const response = await axios.get(apiUrl, { 
            responseType: 'arraybuffer',
            timeout: 60000,
            validateStatus: () => true
        });

        if (response.status !== 200 || !response.data || response.data.length < 100) {
            throw new Error(`ᴀᴘɪ ꜰᴀɪʟᴇᴅ (${response.status})`);
        }

        const outputBuffer = Buffer.from(response.data, 'binary');

        // 3) Send result
        await conn.sendMessage(from, {
            image: outputBuffer,
            caption: "✅ ɪᴍᴀɢᴇ ᴇɴʜᴀɴᴄᴇᴅ sᴜᴄᴄᴇssꜰᴜʟʟʏ!\n\n> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴘʀɪᴍᴇ ʀɪᴅᴢ*",
        }, { quoted: anony });

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });

    } catch (error) {
        console.error('Remini Error:', error.message);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
        await reply(`❌ ᴇʀʀᴏʀ: ${error.message || "ꜰᴀɪʟᴇᴅ ᴛᴏ ᴇɴʜᴀɴᴄᴇ ɪᴍᴀɢᴇ."}`);
    }
});


cmd({
    pattern: "restart",
    alias: ["rebot", "reboot"],
    react: "🕸️",
    desc: "Restart the bot",
    category: "owner",
    filename: __filename
},
async (conn, mek, m, {
    from, quoted, body, isCmd, command, args, q,
    isGroup, sender, senderNumber, botNumber2, botNumber,
    pushname, isMe, isOwner, isCreator, groupMetadata,
    groupName, participants, groupAdmins, isBotAdmins,
    isAdmins, reply
}) => {
    try {
        if (!isCreator) {
            return reply("🚫 *ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ ɪs ᴏɴʟʏ ꜰᴏʀ ᴛʜᴇ ʙᴏᴛ ᴏᴡɴᴇʀ (ᴄʀᴇᴀᴛᴏʀ).*");
        }

        reply("♻️ ʀᴇsᴛᴀʀᴛɪɴɢ ᴛʜᴇ ʙᴏᴛ...");
        await sleep(1500);
        
        restartBot();
        
    } catch (e) {
        console.log(e);
        reply(`${e}`);
    }
});

function restartBot() {
    try {
        if (process.emit('SIGUSR2')) {
            console.log('Restarting via nodemon...');
            return;
        }
    } catch (e) {}
    
    try {
        console.log('Restarting via process spawn...');
        const child = spawn(process.argv[0], process.argv.slice(1), {
            stdio: 'inherit',
            detached: true
        });
        child.unref();
        process.exit(0);
    } catch (e) {
        console.log('Restarting via process exit...');
        process.exit(0);
    }
}

cmd({
    pattern: "restart2",
    alias: ["reboot2"],
    react: "⚡",
    desc: "Restart bot with options",
    category: "owner",
    filename: __filename
},
async (conn, mek, m, { args, reply, isCreator }) => {
    if (!isCreator) {
        return reply("🚫 *ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ ɪs ᴏɴʟʏ ꜰᴏʀ ᴛʜᴇ ʙᴏᴛ ᴏᴡɴᴇʀ (ᴄʀᴇᴀᴛᴏʀ).*");
    }

    const method = args.toLowerCase();
    
    switch(method) {
        case 'nodemon':
            reply("🔄 ʀᴇsᴛᴀʀᴛɪɴɢ ᴠɪᴀ ɴᴏᴅᴇᴍᴏɴ...");
            await sleep(1000);
            process.emit('SIGUSR2');
            break;
            
        case 'spawn':
            reply("🔄 ʀᴇsᴛᴀʀᴛɪɴɢ ᴠɪᴀ ᴘʀᴏᴄᴇss sᴘᴀᴡɴ...");
            await sleep(1000);
            const child = spawn(process.argv[0], process.argv.slice(1), {
                stdio: 'inherit',
                detached: true
            });
            child.unref();
            process.exit(0);
            break;
            
        case 'exit':
        default:
            reply("🔄 ʀᴇsᴛᴀʀᴛɪɴɢ ʙᴏᴛ...");
            await sleep(1000);
            process.exit(0);
            break;
    }
});

cmd(
  {
    pattern: 'vsticker',
    alias: ['gsticker', 'g2s', 'gs', 'v2s', 'vs',],
    desc: 'Convert GIF/Video to a sticker.',
    category: 'tools',
    use: '<reply media or URL>',
    filename: __filename,
  },
  async (conn, mek, m, { quoted, args, reply }) => {
    try {
      if (!mek.quoted) return reply('*ʀᴇᴘʟʏ ᴛᴏ ᴀ ᴠɪᴅᴇᴏ ᴏʀ ɢɪꜰ ᴛᴏ ᴄᴏɴᴠᴇʀᴛ ɪᴛ ᴛᴏ ᴀ sᴛɪᴄᴋᴇʀ!*');

      const mime = mek.quoted.mtype;
      if (!['videoMessage', 'imageMessage'].includes(mime)) {
        return reply('*ᴘʟᴇᴀsᴇ ʀᴇᴘʟʏ ᴛᴏ ᴀ ᴠᴀʟɪᴅ ᴠɪᴅᴇᴏ ᴏʀ ɢɪꜰ.*');
      }

      const media = await mek.quoted.download();
      const webpBuffer = await videoToWebp(media);

      const sticker = new Sticker(webpBuffer, {
        pack: config.STICKER_NAME || ' ᴘʀɪᴍᴇ ʀɪᴅᴢ',
        author: 'ʀɪᴅᴢᴄᴏᴅᴇʀ', 
        type: StickerTypes.FULL,
        categories: ['🤩', '🎉'],
        id: '12345',
        quality: 75,
        background: 'transparent',
      });

      const stickerBuffer = await sticker.toBuffer();
      return conn.sendMessage(mek.chat, { sticker: stickerBuffer }, { quoted: mek });
    } catch (error) {
      console.error(error);
      reply(`❌ ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ: ${error.message}`);
    }
  }
);    

cmd({
    pattern: "attp",
    desc: "Convert text to a GIF sticker.",
    react: "✨",
    category: "tools",
    use: ".attp HI",
    filename: __filename,
}, async (conn, mek, m, { args, reply }) => {
    try {
        if (!args[0]) return reply("*ᴘʟᴇᴀsᴇ ᴘʀᴏᴠɪᴅᴇ ᴛᴇxᴛ!*");

        const gifBuffer = await fetchGif(`https://api-fix.onrender.com/api/maker/attp?text=${encodeURIComponent(args[0])}`);
        const stickerBuffer = await gifToSticker(gifBuffer);

        await conn.sendMessage(m.chat, { sticker: stickerBuffer }, { quoted: mek });
    } catch (error) {
        reply(`❌ ${error.message}`);
    }
});

cmd({
    pattern: "tempmail",
    alias: ["genmail"],
    desc: "Generate a new temporary email address",
    category: "utility",
    react: "📧",
    filename: __filename
},
async (conn, mek, m, { from, reply, prefix }) => {
    try {
        const response = await axios.get('https://apis.davidcyriltech.my.id/temp-mail');
        const { email, session_id, expires_at } = response.data;

        const expiresDate = new Date(expires_at);
        const timeString = expiresDate.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
        const dateString = expiresDate.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });

        const message = `
📧 *ᴛᴇᴍᴘᴏʀᴀʀʏ ᴇᴍᴀɪʟ ɢᴇɴᴇʀᴀᴛᴇᴅ*

✉️ *ᴇᴍᴀɪʟ ᴀᴅᴅʀᴇss:*
${email}

⏳ *ᴇxᴘɪʀᴇs:*
${timeString} • ${dateString}

🔑 *sᴇssɪᴏɴ ɪᴅ:*
\`\`\`${session_id}\`\`\`

📥 *ᴄʜᴇᴄᴋ ɪɴʙᴏx:*
.ɪɴʙᴏx ${session_id}

_ᴇᴍᴀɪʟ ᴡɪʟʟ ᴇxᴘɪʀᴇ ᴀꜰᴛᴇʀ 24 ʜᴏᴜʀs_
`;

        await conn.sendMessage(
            from,
            { 
                text: message,
                contextInfo: {
                    forwardingScore: 999,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '120363404529319592@newsletter',
                        newsletterName: 'ᴘʀɪᴍᴇ ʀɪᴅᴢ  ᴛᴇᴍᴘᴍᴀɪʟ',
                        serverMessageId: 101
                    }
                }
            },
            { quoted: anony }
        );

    } catch (e) {
        console.error('TempMail error:', e);
        reply(`❌ ᴇʀʀᴏʀ: ${e.message}`);
    }
});

cmd({
    pattern: "checkmail",
    alias: ["inbox", "tmail", "mailinbox"],
    desc: "Check your temporary email inbox",
    category: "utility",
    react: "📬",
    filename: __filename
},
async (conn, mek, m, { from, reply, args }) => {
    try {
        const sessionId = args[0];
        if (!sessionId) return reply('🔑 ᴘʟᴇᴀsᴇ ᴘʀᴏᴠɪᴅᴇ ʏᴏᴜʀ sᴇssɪᴏɴ ɪᴅ\nᴇxᴀᴍᴘʟᴇ: .ᴄʜᴇᴄᴋᴍᴀɪʟ ʏᴏᴜʀ_sᴇssɪᴏɴ_ɪᴅ');

        const inboxUrl = `https://apis.davidcyriltech.my.id/temp-mail/inbox?id=${encodeURIComponent(sessionId)}`;
        const response = await axios.get(inboxUrl);

        if (!response.data.success) {
            return reply('❌ ɪɴᴠᴀʟɪᴅ sᴇssɪᴏɴ ɪᴅ ᴏʀ ᴇxᴘɪʀᴇᴅ ᴇᴍᴀɪʟ');
        }

        const { inbox_count, messages } = response.data;

        if (inbox_count === 0) {
            return reply('📭 ʏᴏᴜʀ ɪɴʙᴏx ɪs ᴇᴍᴘᴛʏ');
        }

        let messageList = `📬 *ʏᴏᴜ ʜᴀᴠᴇ ${inbox_count} ᴍᴇssᴀɢᴇ(s)*\n\n`;
        messages.forEach((msg, index) => {
            messageList += `━━━━━━━━━━━━━━━━━━\n` +
                          `📌 *ᴍᴇssᴀɢᴇ ${index + 1}*\n` +
                          `👤 *ꜰʀᴏᴍ:* ${msg.from}\n` +
                          `📝 *sᴜʙᴊᴇᴄᴛ:* ${msg.subject}\n` +
                          `⏰ *ᴅᴀᴛᴇ:* ${new Date(msg.date).toLocaleString()}\n\n` +
                          `📄 *ᴄᴏɴᴛᴇɴᴛ:*\n${msg.body}\n\n`;
        });

        await reply(messageList);

    } catch (e) {
        console.error('CheckMail error:', e);
        reply(`❌ ᴇʀʀᴏʀ ᴄʜᴇᴄᴋɪɴɢ ɪɴʙᴏx: ${e.response?.data?.message || e.message}`);
    }
});

cmd({
    pattern: "trt",
    alias: ["translate"],
    desc: "🌍 Translate text between languages",
    react: "⚡",
    category: "tools",
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
    try {
        const args = q.split(' ');
        if (args.length < 2) return reply("❗ ᴘʟᴇᴀsᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ʟᴀɴɢᴜᴀɢᴇ ᴄᴏᴅᴇ ᴀɴᴅ ᴛᴇxᴛ. ᴜsᴀɢᴇ: .ᴛʀᴀɴsʟᴀᴛᴇ [ʟᴀɴɢᴜᴀɢᴇ ᴄᴏᴅᴇ] [ᴛᴇxᴛ]");

        const targetLang = args[0];
        const textToTranslate = args.slice(1).join(' ');

        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(textToTranslate)}&langpair=en|${targetLang}`;

        const response = await axios.get(url);
        const translation = response.data.responseData.translatedText;

        const translationMessage = `> *ᴘʀɪᴍᴇ ʀɪᴅᴢ -ᴛʀᴀɴsʟᴀᴛɪᴏɴ*

> 🔤 *ᴏʀɪɢɪɴᴀʟ*: ${textToTranslate}

> 🔠 *ᴛʀᴀɴsʟᴀᴛᴇᴅ*: ${translation}

> 🌐 *ʟᴀɴɢᴜᴀɢᴇ*: ${targetLang.toUpperCase()}`;

        return reply(translationMessage);
    } catch (e) {
        console.log(e);
        return reply("⚠️ ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ᴛʀᴀɴsʟᴀᴛɪɴɢ ʏᴏᴜʀ ᴛᴇxᴛ. ᴘʟᴇᴀsᴇ ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ🤕");
    }
});

cmd({
    pattern: "tts",
    desc: "download songs",
    category: "download",
    react: "👧",
    filename: __filename
},
async(conn, mek, m,{from, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply}) => {
try{
if(!q) return reply("ɴᴇᴇᴅ sᴏᴍᴇ ᴛᴇxᴛ.")
    const url = googleTTS.getAudioUrl(q, {
  lang: 'hi-IN',
  slow: false,
  host: 'https://translate.google.com',
})
await conn.sendMessage(from, { audio: { url: url }, mimetype: 'audio/mpeg', ptt: true }, { quoted: anony })
    }catch(a){
reply(`${a}`)
}
})

cmd({
  'pattern': "tourl",
  'alias': ["imgtourl", "imgurl", "url", "geturl", "upload"],
  'react': '🖇',
  'desc': "Convert media to Catbox URL",
  'category': "utility",
  'use': ".tourl [reply to media]",
  'filename': __filename
}, async (client, message, args, { reply }) => {
  try {
    const quotedMsg = message.quoted ? message.quoted : message;
    const mimeType = (quotedMsg.msg || quotedMsg).mimetype || '';
    
    if (!mimeType) {
      throw "ᴘʟᴇᴀsᴇ ʀᴇᴘʟʏ ᴛᴏ ᴀɴ ɪᴍᴀɢᴇ, ᴠɪᴅᴇᴏ, ᴏʀ ᴀᴜᴅɪᴏ ꜰɪʟᴇ";
    }

    const mediaBuffer = await quotedMsg.download();
    const tempFilePath = path.join(os.tmpdir(), `catbox_upload_${Date.now()}`);
    fs.writeFileSync(tempFilePath, mediaBuffer);

    let extension = '';
    if (mimeType.includes('image/jpeg')) extension = '.jpg';
    else if (mimeType.includes('image/png')) extension = '.png';
    else if (mimeType.includes('video')) extension = '.mp4';
    else if (mimeType.includes('audio')) extension = '.mp3';
    
    const fileName = `file${extension}`;

    const form = new FormData();
    form.append('fileToUpload', fs.createReadStream(tempFilePath), fileName);
    form.append('reqtype', 'fileupload');

    const response = await axios.post("https://catbox.moe/user/api.php", form, {
      headers: form.getHeaders()
    });

    if (!response.data) {
      throw "ᴇʀʀᴏʀ ᴜᴘʟᴏᴀᴅɪɴɢ ᴛᴏ ᴄᴀᴛʙᴏx";
    }

    const mediaUrl = response.data;
    fs.unlinkSync(tempFilePath);

    let mediaType = 'ꜰɪʟᴇ';
    if (mimeType.includes('image')) mediaType = 'ɪᴍᴀɢᴇ';
    else if (mimeType.includes('video')) mediaType = 'ᴠɪᴅᴇᴏ';
    else if (mimeType.includes('audio')) mediaType = 'ᴀᴜᴅɪᴏ';

    await reply(
      `*${mediaType} ᴜᴘʟᴏᴀᴅᴇᴅ sᴜᴄᴄᴇssꜰᴜʟʟʏ*\n\n` +
      `*sɪᴢᴇ:* ${formatBytes(mediaBuffer.length)}\n` +
      `*ᴜʀʟ:* ${mediaUrl}\n\n` +
      `> © ᴜᴘʟᴏᴀᴅᴇᴅ ʙʏ ᴘʀɪᴍᴇ ʀɪᴅᴢ`
    );

  } catch (error) {
    console.error(error);
    await reply(`ᴇʀʀᴏʀ: ${error.message || error}`);
  }
});

function formatBytes(bytes) {
  if (bytes === 0) return '0 ʙʏᴛᴇs';
  const k = 1024;
  const sizes = ['ʙʏᴛᴇs', 'ᴋʙ', 'ᴍʙ', 'ɢʙ'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

cmd({
    pattern: 'savecontact',
    alias: ["vcf","scontact","savecontacts"],
    desc: 'gc vcard',
    category: 'tools',
    filename: __filename
}, async (conn, mek, m, { from, quoted, body, isCmd, command, args, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply }) => {
    try {
        if (!isGroup) return reply("ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ ɪs ꜰᴏʀ ɢʀᴏᴜᴘs ᴏɴʟʏ.");
        if (!isOwner) return reply("*_ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ ɪs ꜰᴏʀ ᴛʜᴇ ᴏᴡɴᴇʀ ᴏɴʟʏ_*");

        let card = quoted || m; 
        let cmiggc = groupMetadata;
        const { participants } = groupMetadata;
        
        let orgiggc = participants.map(a => a.id);
        let vcard = '';
        let noPort = 0;
        
        for (let a of cmiggc.participants) {
            vcard += `BEGIN:VCARD\nVERSION:3.0\nFN:[${noPort++}] +${a.id.split("@")[0]}\nTEL;type=CELL;type=VOICE;waid=${a.id.split("@")[0]}:+${a.id.split("@")[0]}\nEND:VCARD\n`;
        }

        let nmfilect = './contacts.vcf';
        reply('sᴀᴠɪɴɢ ' + cmiggc.participants.length + ' ᴘᴀʀᴛɪᴄɪᴘᴀɴᴛs ᴄᴏɴᴛᴀᴄᴛ');

        fs.writeFileSync(nmfilect, vcard.trim());
        await sleep(2000);

        await conn.sendMessage(from, {
            document: fs.readFileSync(nmfilect), 
            mimetype: 'text/vcard', 
            fileName: 'prossie.vcf', 
            caption: `\nᴅᴏɴᴇ sᴀᴠɪɴɢ.\nɢʀᴏᴜᴘ ɴᴀᴍᴇ: *${cmiggc.subject}*\nᴄᴏɴᴛᴀᴄᴛs: *${cmiggc.participants.length}*\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ  ᴘʀɪᴍᴇ ʀɪᴅᴢ`}, { quoted: anony });

        fs.unlinkSync(nmfilect);
    } catch (err) {
        reply(err.toString());
    }
});

cmd({
  pattern: "wikipedia",
  alias: ["wiki", "pinterest", "pin"],
  react: "📖",
  desc: "Search for Pinterest images based on a query.",
  category: "tools",
  filename: __filename
}, async (conn, mek, m, { from, quoted, body, isCmd, command, args, q, isGroup, sender, reply }) => {
  try {
    if (!q) {
      return reply("ᴘʟᴇᴀsᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ sᴇᴀʀᴄʜ ǫᴜᴇʀʏ.\nᴇxᴀᴍᴘʟᴇ: .ᴘɪɴᴛᴇʀᴇsᴛ ᴄᴀᴛ");
    }

    await reply("🔍 sᴇᴀʀᴄʜɪɴɢ ᴘɪɴᴛᴇʀᴇsᴛ...");

    const apiUrl = `https://api.siputzx.my.id/api/s/pinterest?query=${encodeURIComponent(q)}&type=image`;
    const response = await axios.get(apiUrl);

    // Check if we got results
    if (!response.data || !response.data.status || !response.data.data || response.data.data.length === 0) {
      return reply("❌ ɴᴏ ɪᴍᴀɢᴇs ꜰᴏᴜɴᴅ ꜰᴏʀ ʏᴏᴜʀ ǫᴜᴇʀʏ.");
    }

    const results = response.data.data;
    
    // Limit to first 5 images to avoid spamming
    const imagesToSend = results.slice(0, 5);

    for (let i = 0; i < imagesToSend.length; i++) {
        const img = imagesToSend[i];
        
        // Extract the image URL (API usually returns image_url, url, or image)
        const imageUrl = img.image_url || img.url || img.image;

        if (imageUrl) {
            await conn.sendMessage(m.chat, {
                image: { url: imageUrl },
                caption: `📌 *ᴘɪɴᴛᴇʀᴇsᴛ ʀᴇsᴜʟᴛ ${i + 1}*\n📝 *ǫᴜᴇʀʏ:* ${q}`
            }, { quoted: mek });
        }
    }

  } catch (error) {
    console.error("ᴘɪɴᴛᴇʀᴇsᴛ ᴇʀʀᴏʀ:", error);
    reply("⚠️ ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ꜰᴇᴛᴄʜɪɴɢ ɪᴍᴀɢᴇs: " + error.message);
  }
});
cmd({
  pattern: "broadcast",
  category: "group",
  desc: "Bot makes a broadcast in all groups",
  filename: __filename,
  use: "<text for broadcast.>"
}, async (conn, mek, m, { q, isGroup, isAdmins, reply }) => {
  try {
    if (!isGroup) return reply("❌ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ ᴄᴀɴ ᴏɴʟʏ ʙᴇ ᴜsᴇᴅ ɪɴ ɢʀᴏᴜᴘs!");
    if (!isAdmins) return reply("❌ ʏᴏᴜ ɴᴇᴇᴅ ᴛᴏ ʙᴇ ᴀɴ ᴀᴅᴍɪɴ ᴛᴏ ʙʀᴏᴀᴅᴄᴀsᴛ ɪɴ ᴛʜɪs ɢʀᴏᴜᴘ!");

    if (!q) return reply("❌ ᴘʀᴏᴠɪᴅᴇ ᴛᴇxᴛ ᴛᴏ ʙʀᴏᴀᴅᴄᴀsᴛ ɪɴ ᴀʟʟ ɢʀᴏᴜᴘs!");

    let allGroups = await conn.groupFetchAllParticipating();
    let groupIds = Object.keys(allGroups);

    reply(`📢 sᴇɴᴅɪɴɢ ʙʀᴏᴀᴅᴄᴀsᴛ ᴛᴏ ${groupIds.length} ɢʀᴏᴜᴘs...\n⏳ ᴇsᴛɪᴍᴀᴛᴇᴅ ᴛɪᴍᴇ: ${groupIds.length * 1.5} sᴇᴄᴏɴᴅs`);

    for (let groupId of groupIds) {
      try {
        await sleep(1500);
        await conn.sendMessage(groupId, { text: q });
      } catch (err) {
        console.log(`❌ ꜰᴀɪʟᴇᴅ ᴛᴏ sᴇɴᴅ ʙʀᴏᴀᴅᴄᴀsᴛ ᴛᴏ ${groupId}:`, err);
      }
    }

    return reply(`✅ sᴜᴄᴄᴇssꜰᴜʟʟʏ sᴇɴᴛ ʙʀᴏᴀᴅᴄᴀsᴛ ᴛᴏ ${groupIds.length} ɢʀᴏᴜᴘs!`);
    
  } catch (err) {
    await m.error(`❌ ᴇʀʀᴏʀ: ${err}\n\nᴄᴏᴍᴍᴀɴᴅ: ʙʀᴏᴀᴅᴄᴀsᴛ`, err);
  }
});

cmd({
    pattern: "wstalk",
    alias: ["channelstalk", "chinfo"],
    desc: "Get WhatsApp channel information",
    category: "utility",
    react: "🔍",
    filename: __filename
},
async (conn, mek, m, { from, reply, args }) => {
    try {
        // Check if URL is provided
        if (!args[0]) return reply("❌ ᴘʟᴇᴀꜱᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ᴡʜᴀᴛꜱᴀᴘᴘ ᴄʜᴀɴɴᴇʟ ᴜʀʟ\nᴇxᴀᴍᴘʟᴇ: .ᴡꜱᴛᴀʟᴋ https://whatsapp.com/channel/0029VatOy2EAzNc2WcShQw1j");

        const url = args.join(" ");

        // Extract channel ID from URL
        const channelId = url.match(/channel\/([0-9A-Za-z]+)/i)?.[1];
        if (!channelId) return reply("❌ ɪɴᴠᴀʟɪᴅ ᴡʜᴀᴛꜱᴀᴘᴘ ᴄʜᴀɴɴᴇʟ ᴜʀʟ");

        // PrinceTech API endpoint
        const apiUrl = `https://api.princetechn.com/api/stalk/wachannel?apikey=prince&url=https://whatsapp.com/channel/${channelId}`;

        // Fetch channel info
        const response = await axios.get(apiUrl);
        const res = response.data;

        if (!res || !res.success || !res.result) {
            return reply("❌ ꜰᴀɪʟᴇᴅ ᴛᴏ ꜰᴇᴛᴄʜ ᴄʜᴀɴɴᴇʟ ɪɴꜰᴏ.");
        }

        const data = res.result;

        // Format the information
        const channelInfo = `
 ╭━━〔 *ᴄʜᴀɴɴᴇʟ ɪɴꜰᴏ* 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃• *📢 ᴛɪᴛʟᴇ:* ᴡʜᴀᴛꜱᴀᴘᴘ ᴄʜᴀɴɴᴇʟ
┃◈┃• *👥 ꜰᴏʟʟᴏᴡᴇʀꜱ:* ${data.followers || 'ɴ/ᴀ'}
┃◈┃• *📝 ᴅᴇꜱᴄʀɪᴘᴛɪᴏɴ:* ${(data.description || 'ɴᴏ ᴅᴇꜱᴄʀɪᴘᴛɪᴏɴ').replace(/\n/g, '\n┃◈┃• ')}
┃◈└───────────┈⊷
╰──────────────┈⊷
> © ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴘʀɪᴍᴇ ʀɪᴅᴢ`;

        // Send message with channel image
        await conn.sendMessage(from, {
            image: { url: data.img },
            caption: channelInfo,
            contextInfo: {
                forwardingScore: 999,
                isForwarded: true
            }
        }, { quoted: anony });

    } catch (e) {
        console.error("ᴇʀʀᴏʀ ɪɴ ᴡꜱᴛᴀʟᴋ ᴄᴏᴍᴍᴀɴᴅ:", e);
        reply(`ᴇʀʀᴏʀ: ${e.response?.data?.message || e.message}`);
    }
});

cmd({
  pattern: "msg",
  desc: "Send a message multiple times (Owner Only)",
  category: "utility",
  react: "🔁",
  filename: __filename
},
async (conn, mek, m, { from, reply, isCreator, q }) => {
  if (!isCreator) return reply('ᴏᴡɴᴇʀ ᴏɴʟʏ ᴄᴏᴍᴍᴀɴᴅ!*');

  try {
    if (!q.includes(',')) return reply("ꜰᴏʀᴍᴀᴛ: .ᴍꜱɢ ᴛᴇxᴛ,ᴄᴏᴜɴᴛ\n*Example:* .msg Hello,5");

    const [rawMessage, countStr] = q.split(',');
    const message = rawMessage.trim();
    const count = parseInt(countStr.trim());

    if (isNaN(count) || count < 1 || count > 100) {
      return reply("ᴍᴀx 100 ᴍᴇꜱꜱᴀɢᴇꜱ ᴀᴛ ᴏɴᴄᴇ!*");
    }

    const zws = '\u200B'; // Zero-width space

    for (let i = 0; i < count; i++) {
      const hiddenMsg = message + zws.repeat(i); // visually same, technically unique
      await conn.sendMessage(from, { text: hiddenMsg }, { quoted: null });
      if (i < count - 1) await new Promise(res => setTimeout(res, 1000)); // 1 sec delay
    }

  } catch (e) {
    console.error("Error in msg command:", e);
    reply(`ᴇʀʀᴏʀ:* ${e.message}`);
  }
});

cmd({
    pattern: "vv3",
    alias: ['retrive', '🔥'],
    desc: "Fetch and resend a ViewOnce message content (image/video).",
    category: "main",
    use: '<query>',
    filename: __filename
},
async (conn, mek, m, { from, reply }) => {
    try {
        const quotedMessage = m.msg.contextInfo.quotedMessage; 

        if (quotedMessage && quotedMessage.viewOnceMessageV2) {
            const quot = quotedMessage.viewOnceMessageV2;
            if (quot.message.imageMessage) {
                let cap = quot.message.imageMessage.caption;
                let anu = await conn.downloadAndSaveMediaMessage(quot.message.imageMessage);
                return conn.sendMessage(from, { image: { url: anu }, caption: cap }, { quoted: anony });
            }
            if (quot.message.videoMessage) {
                let cap = quot.message.videoMessage.caption;
                let anu = await conn.downloadAndSaveMediaMessage(quot.message.videoMessage);
                return conn.sendMessage(from, { video: { url: anu }, caption: cap }, { quoted: anony });
            }
            if (quot.message.audioMessage) {
                let anu = await conn.downloadAndSaveMediaMessage(quot.message.audioMessage);
                return conn.sendMessage(from, { audio: { url: anu } }, { quoted: anony });
            }
        }

        if (!m.quoted) return reply("ᴘʟᴇᴀsᴇ ʀᴇᴘʟʏ ᴛᴏ ᴀ ᴠɪᴇᴡᴏɴᴄᴇ ᴍᴇssᴀɢᴇ.");
        if (m.quoted.mtype === "viewOnceMessage") {
            if (m.quoted.message.imageMessage) {
                let cap = m.quoted.message.imageMessage.caption;
                let anu = await conn.downloadAndSaveMediaMessage(m.quoted.message.imageMessage);
                return conn.sendMessage(from, { image: { url: anu }, caption: cap }, { quoted: anony });
            }
            else if (m.quoted.message.videoMessage) {
                let cap = m.quoted.message.videoMessage.caption;
                let anu = await conn.downloadAndSaveMediaMessage(m.quoted.message.videoMessage);
                return conn.sendMessage(from, { video: { url: anu }, caption: cap }, { quoted: anony });
            }
        } else if (m.quoted.message.audioMessage) {
            let anu = await conn.downloadAndSaveMediaMessage(m.quoted.message.audioMessage);
            return conn.sendMessage(from, { audio: { url: anu } }, { quoted: anony });
        } else {
            return reply("ᴛʜɪs ɪs ɴᴏᴛ ᴀ ᴠɪᴇᴡᴏɴᴄᴇ ᴍᴇssᴀɢᴇ.");
        }
    } catch (e) {
        console.log("Error:", e);
        reply("ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ꜰᴇᴛᴄʜɪɴɢ ᴛʜᴇ ᴠɪᴇᴡᴏɴᴄᴇ ᴍᴇssᴀɢᴇ.");
    }
});

cmd({
    pattern: "movie",
    desc: "Fetch detailed information about a movie.",
    category: "utility",
    react: "🎬",
    filename: __filename
},
async (conn, mek, m, { from, reply, sender, args }) => {
    try {
        const movieName = args.length > 0 ? args.join(' ') : m.text.replace(/^[\.\#\$\!]?movie\s?/i, '').trim();
        
        if (!movieName) {
            return reply("📽️ ᴘʟᴇᴀsᴇ ᴘʀᴏᴠɪᴅᴇ ᴛʜᴇ ɴᴀᴍᴇ ᴏꜰ ᴛʜᴇ ᴍᴏᴠɪᴇ.\nᴇxᴀᴍᴘʟᴇ: .ᴍᴏᴠɪᴇ ɪʀᴏɴ ᴍᴀɴ");
        }

        const apiUrl = `https://apis.davidcyriltech.my.id/imdb?query=${encodeURIComponent(movieName)}`;
        const response = await axios.get(apiUrl);

        if (!response.data.status || !response.data.movie) {
            return reply("🚫 ᴍᴏᴠɪᴇ ɴᴏᴛ ꜰᴏᴜɴᴅ. ᴘʟᴇᴀsᴇ ᴄʜᴇᴄᴋ ᴛʜᴇ ɴᴀᴍᴇ ᴀɴᴅ ᴛʀʏ ᴀɢᴀɪɴ.");
        }

        const movie = response.data.movie;
        
        const dec = `
🎬 *${movie.title}* (${movie.year}) ${movie.rated || ''}

⭐ *ɪᴍᴅʙ:* ${movie.imdbRating || 'ɴ/ᴀ'} | 🍅 *ʀᴏᴛᴛᴇɴ ᴛᴏᴍᴀᴛᴏᴇs:* ${movie.ratings.find(r => r.source === 'Rotten Tomatoes')?.value || 'ɴ/ᴀ'} | 💰 *ʙᴏx ᴏꜰꜰɪᴄᴇ:* ${movie.boxoffice || 'ɴ/ᴀ'}

📅 *ʀᴇʟᴇᴀsᴇᴅ:* ${new Date(movie.released).toLocaleDateString()}
⏳ *ʀᴜɴᴛɪᴍᴇ:* ${movie.runtime}
🎭 *ɢᴇɴʀᴇ:* ${movie.genres}

📝 *ᴘʟᴏᴛ:* ${movie.plot}

🎥 *ᴅɪʀᴇᴄᴛᴏʀ:* ${movie.director}
✍️ *ᴡʀɪᴛᴇʀ:* ${movie.writer}
🌟 *ᴀᴄᴛᴏʀs:* ${movie.actors}

🌍 *ᴄᴏᴜɴᴛʀʏ:* ${movie.country}
🗣️ *ʟᴀɴɢᴜᴀɢᴇ:* ${movie.languages}
🏆 *ᴀᴡᴀʀᴅs:* ${movie.awards || 'ɴᴏɴᴇ'}

[ᴠɪᴇᴡ ᴏɴ ɪᴍᴅʙ](${movie.imdbUrl})
`;

        await conn.sendMessage(
            from,
            {
                image: { 
                    url: movie.poster && movie.poster !== 'N/A' ? movie.poster : 'https://files.catbox.moe/oyadfh.png'
                },
                caption: dec,
                contextInfo: {
                    mentionedJid: [sender],
                    forwardingScore: 999,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '120363404529319592@newsletter',
                        newsletterName: 'ʀᴄʟᴀʙꜱ ꜱᴜᴘᴘᴏʀᴛ',
                        serverMessageId: 143
                    }
                }
            },
            { quoted: anony }
        );

    } catch (e) {
        console.error('Movie command error:', e);
        reply(`❌ ᴇʀʀᴏʀ: ${e.message}`);
    }
});

cmd({
  pattern: "npm",
  desc: "Search for a package on npm.",
  react: '📦',
  category: "other",
  filename: __filename,
  use: ".npm <package-name>"
}, async (conn, mek, msg, { from, args, reply }) => {
  try {
    if (!args.length) {
      return reply("ᴘʟᴇᴀsᴇ ᴘʀᴏᴠɪᴅᴇ ᴛʜᴇ ɴᴀᴍᴇ ᴏꜰ ᴛʜᴇ ɴᴘᴍ ᴘᴀᴄᴋᴀɢᴇ ʏᴏᴜ ᴡᴀɴᴛ ᴛᴏ sᴇᴀʀᴄʜ ꜰᴏʀ. ᴇxᴀᴍᴘʟᴇ: .ɴᴘᴍ ᴇxᴘʀᴇss");
    }

    const packageName = args.join(" ");
    const apiUrl = `https://registry.npmjs.org/${encodeURIComponent(packageName)}`;

    const response = await axios.get(apiUrl);
    if (response.status !== 200) {
      throw new Error("ᴘᴀᴄᴋᴀɢᴇ ɴᴏᴛ ꜰᴏᴜɴᴅ ᴏʀ ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ.");
    }

    const packageData = response.data;
    const latestVersion = packageData["dist-tags"].latest;
    const description = packageData.description || "ɴᴏ ᴅᴇsᴄʀɪᴘᴛɪᴏɴ ᴀᴠᴀɪʟᴀʙʟᴇ.";
    const npmUrl = `https://www.npmjs.com/package/${packageName}`;
    const license = packageData.license || "ᴜɴᴋɴᴏᴡɴ";
    const repository = packageData.repository ? packageData.repository.url : "ɴᴏᴛ ᴀᴠᴀɪʟᴀʙʟᴇ";

    const message = `
*ᴘʀɪᴍᴇ ʀɪᴅᴢ  ɴᴘᴍ sᴇᴀʀᴄʜ*

*🔰 ɴᴘᴍ ᴘᴀᴄᴋᴀɢᴇ:* ${packageName}
*📄 ᴅᴇsᴄʀɪᴘᴛɪᴏɴ:* ${description}
*⏸️ ʟᴀsᴛ ᴠᴇʀsɪᴏɴ:* ${latestVersion}
*🪪 ʟɪᴄᴇɴsᴇ:* ${license}
*🪩 ʀᴇᴘᴏsɪᴛᴏʀʏ:* ${repository}
*🔗 ɴᴘᴍ ᴜʀʟ:* ${npmUrl}
`;

    await conn.sendMessage(from, { text: message }, { quoted: anony });

  } catch (error) {
    console.error("Error:", error);

    const errorMessage = `
*❌ ɴᴘᴍ ᴄᴏᴍᴍᴀɴᴅ ᴇʀʀᴏʀ ʟᴏɢs*

*ᴇʀʀᴏʀ ᴍᴇssᴀɢᴇ:* ${error.message}
*sᴛᴀᴄᴋ ᴛʀᴀᴄᴇ:* ${error.stack || "ɴᴏᴛ ᴀᴠᴀɪʟᴀʙʟᴇ"}
*ᴛɪᴍᴇsᴛᴀᴍᴘ:* ${new Date().toISOString()}
`;

    await conn.sendMessage(from, { text: errorMessage }, { quoted: anony });
    reply("ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ꜰᴇᴛᴄʜɪɴɢ ᴛʜᴇ ɴᴘᴍ ᴘᴀᴄᴋᴀɢᴇ ᴅᴇᴛᴀɪʟs.");
  }
});

// 1. Shutdown Bot
cmd({
    pattern: "shutdown",
    desc: "Shutdown the bot.",
    category: "owner",
    react: "🛑",
    filename: __filename
},
async (conn, mek, m, { from, isOwner, reply }) => {
    if (!isOwner) return reply("❌ ʏᴏᴜ ᴀʀᴇ ɴᴏᴛ ᴛʜᴇ ᴏᴡɴᴇʀ!");
    reply("🛑 sʜᴜᴛᴛɪɴɢ ᴅᴏᴡɴ...").then(() => process.exit());
});

// 2. Broadcast Message to All Groups
cmd({
    pattern: "broadcast",
    desc: "Broadcast a message to all groups.",
    category: "owner",
    react: "📢",
    filename: __filename
},
async (conn, mek, m, { from, isOwner, args, reply }) => {
    if (!isOwner) return reply("❌ ʏᴏᴜ ᴀʀᴇ ɴᴏᴛ ᴛʜᴇ ᴏᴡɴᴇʀ!");
    if (args.length === 0) return reply("📢 ᴘʟᴇᴀsᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ᴍᴇssᴀɢᴇ ᴛᴏ ʙʀᴏᴀᴅᴄᴀsᴛ.");
    const message = args.join(' ');
    const groups = Object.keys(await conn.groupFetchAllParticipating());
    for (const groupId of groups) {
        await conn.sendMessage(groupId, { text: message }, { quoted: anony });
    }
    reply("📢 ᴍᴇssᴀɢᴇ ʙʀᴏᴀᴅᴄᴀsᴛᴇᴅ ᴛᴏ ᴀʟʟ ɢʀᴏᴜᴘs.");
});

// 3. Set Profile Picture
cmd({
    pattern: "setpp",
    desc: "Set bot profile picture.",
    category: "owner",
    react: "🖼️",
    filename: __filename
},
async (conn, mek, m, { from, isOwner, quoted, reply }) => {
    if (!isOwner) return reply("❌ ʏᴏᴜ ᴀʀᴇ ɴᴏᴛ ᴛʜᴇ ᴏᴡɴᴇʀ!");
    if (!quoted || !quoted.message.imageMessage) return reply("❌ ᴘʟᴇᴀsᴇ ʀᴇᴘʟʏ ᴛᴏ ᴀɴ ɪᴍᴀɢᴇ.");
    try {
        const media = await conn.downloadMediaMessage(quoted);
        await conn.updateProfilePicture(conn.user.jid, { url: media });
        reply("🖼️ ᴘʀᴏꜰɪʟᴇ ᴘɪᴄᴛᴜʀᴇ ᴜᴘᴅᴀᴛᴇᴅ sᴜᴄᴄᴇssꜰᴜʟʟʏ!");
    } catch (error) {
        reply(`❌ ᴇʀʀᴏʀ ᴜᴘᴅᴀᴛɪɴɢ ᴘʀᴏꜰɪʟᴇ ᴘɪᴄᴛᴜʀᴇ: ${error.message}`);
    }
});

// 6. Clear All Chats
cmd({
    pattern: "clearchats",
    desc: "Clear all chats from the bot.",
    category: "owner",
    react: "🧹",
    filename: __filename
},
async (conn, mek, m, { from, isOwner, reply }) => {
    if (!isOwner) return reply("❌ ʏᴏᴜ ᴀʀᴇ ɴᴏᴛ ᴛʜᴇ ᴏᴡɴᴇʀ!");
    try {
        const chats = conn.chats.all();
        for (const chat of chats) {
            await conn.modifyChat(chat.jid, 'delete');
        }
        reply("🧹 ᴀʟʟ ᴄʜᴀᴛs ᴄʟᴇᴀʀᴇᴅ sᴜᴄᴄᴇssꜰᴜʟʟʏ!");
    } catch (error) {
        reply(`❌ ᴇʀʀᴏʀ ᴄʟᴇᴀʀɪɴɢ ᴄʜᴀᴛs: ${error.message}`);
    }
});

// 8. Group JIDs List
cmd({
    pattern: "gjid",
    desc: "Get the list of JIDs for all groups the bot is part of.",
    category: "owner",
    react: "📝",
    filename: __filename
},
async (conn, mek, m, { from, isOwner, reply }) => {
    if (!isOwner) return reply("❌ ʏᴏᴜ ᴀʀᴇ ɴᴏᴛ ᴛʜᴇ ᴏᴡɴᴇʀ!");
    const groups = await conn.groupFetchAllParticipating();
    const groupJids = Object.keys(groups).join('\n');
    reply(`📝 *ɢʀᴏᴜᴘ ᴊɪᴅs:*\n\n${groupJids}`);
});

// delete 
cmd({
    pattern: "delete",
    react: "❌",
    alias: ["del"],
    desc: "delete message",
    category: "group",
    use: '.del',
    filename: __filename
},
async(conn, mek, m, { from, l, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, isItzcp, groupAdmins, isBotAdmins, isAdmins, reply }) => {
    if (!isOwner || !isAdmins) return;
    try {
        if (!m.quoted) return reply("❌ ᴘʟᴇᴀsᴇ ʀᴇᴘʟʏ ᴛᴏ ᴀ ᴍᴇssᴀɢᴇ ᴛᴏ ᴅᴇʟᴇᴛᴇ ɪᴛ."); // Fixed mg.notextfordel
        const key = {
            remoteJid: m.chat,
            fromMe: false,
            id: m.quoted.id,
            participant: m.quoted.sender
        }
        await conn.sendMessage(m.chat, { delete: key })
    } catch(e) {
        console.log(e);
        reply('sᴜᴄᴄᴇssꜰᴜʟ..👨‍💻✅')
    } 
})

 
cmd({
    pattern: "praytime", 
    alias: ["prayertimes", "prayertime", "ptime" ], 
    react: "✅", 
    desc: "Get the prayer times, weather, and location for the city.", 
    category: "main", 
    filename: __filename,
},
async(conn, mek, m, {from, l, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, isItzcp, groupAdmins, isBotAdmins, isAdmins, reply}) => {
    try {
        const city = args.length > 0 ? args.join(" ") : "bhakkar"; 
        const apiUrl = `https://api.nexoracle.com/islamic/prayer-times?city=${city}`;

        const response = await fetch(apiUrl);

        if (!response.ok) {
            return reply('ᴇʀʀᴏʀ ꜰᴇᴛᴄʜɪɴɢ ᴘʀᴀʏᴇʀ ᴛɪᴍᴇs!');
        }

        const data = await response.json();

        if (data.status !== 200) {
            return reply('ꜰᴀɪʟᴇᴅ ᴛᴏ ɢᴇᴛ ᴘʀᴀʏᴇʀ ᴛɪᴍᴇs. ᴘʟᴇᴀsᴇ ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ.');
        }

        const prayerTimes = data.result.items[0];
        const weather = data.result.today_weather;
        const location = data.result.city;

        // Building the message content
        let dec = `*ᴘʀᴀʏᴇʀ ᴛɪᴍᴇs ꜰᴏʀ ${location}, ${data.result.state}*\n\n`;
        dec += `📍 *ʟᴏᴄᴀᴛɪᴏɴ*: ${location}, ${data.result.state}, ${data.result.country}\n`;
        dec += `🕌 *ᴍᴇᴛʜᴏᴅ*: ${data.result.prayer_method_name}\n\n`;

        dec += `🌅 *ꜰᴀᴊʀ*: ${prayerTimes.fajr}\n`;
        dec += `🌄 *sʜᴜʀᴏᴏǫ*: ${prayerTimes.shurooq}\n`;
        dec += `☀️ *ᴅʜᴜʜʀ*: ${prayerTimes.dhuhr}\n`;
        dec += `🌇 *ᴀsʀ*: ${prayerTimes.asr}\n`;
        dec += `🌆 *ᴍᴀɢʜʀɪʙ*: ${prayerTimes.maghrib}\n`;
        dec += `🌃 *ɪsʜᴀ*: ${prayerTimes.isha}\n\n`;

        dec += `🧭 *ǫɪʙʟᴀ ᴅɪʀᴇᴄᴛɪᴏɴ*: ${data.result.qibla_direction}°\n`;

        const temperature = weather.temperature !== null ? `${weather.temperature}°ᴄ` : 'ᴅᴀᴛᴀ ɴᴏᴛ ᴀᴠᴀɪʟᴀʙʟᴇ';
        dec += `🌡️ *ᴛᴇᴍᴘᴇʀᴀᴛᴜʀᴇ*: ${temperature}\n`;

        // Send image with caption and context info only (no audio)
        await conn.sendMessage(
            from,
            {
                image: { url: `https://files.catbox.moe/8fy6up.jpg` },
                caption: dec,
                contextInfo: {
                    mentionedJid: [m.sender],
                    forwardingScore: 999,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '120363404529319592@newsletter',
                        newsletterName: 'ʀᴄʟᴀʙꜱ ꜱᴜᴘᴘᴏʀᴛ',
                        serverMessageId: 143
                    }
                }
            },
            { quoted: anony }
        );

    } catch (e) {
        console.log(e);
        reply('*ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ꜰᴇᴛᴄʜɪɴɢ ᴘʀᴀʏᴇʀ ᴛɪᴍᴇs ᴀɴᴅ ᴡᴇᴀᴛʜᴇʀ.*');
    }
});
// Presence Control (Online/Offline)

cmd({
  on: "body"
}, async (conn, mek, m, { from }) => {
  try {
    
    if (config.ALWAYS_ONLINE === "true") {
      await conn.sendPresenceUpdate("available", from);
    }

  } catch (e) {
    console.error("[Presence Error]", e);
  }
});

cmd({
    pattern: "privacy",
    alias: ["privacymenu"],
    desc: "Privacy settings menu",
    category: "privacy",
    react: "🔐",
    filename: __filename
}, 
async (conn, mek, m, { from, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply }) => {
    try {
        let privacyMenu = `╭━━〔 *ᴘʀɪᴠᴀᴄʏ sᴇᴛᴛɪɴɢs* 〕━━┈⊷
┃◈╭─────────────·๏
┃◈┃• ʙʟᴏᴄᴋʟɪsᴛ - ᴠɪᴇᴡ ʙʟᴏᴄᴋᴇᴅ ᴜsᴇʀs
┃◈┃• ɢᴇᴛʙɪᴏ - ɢᴇᴛ ᴜsᴇʀ's ʙɪᴏ
┃◈┃• sᴇᴛᴘᴘᴀʟʟ - sᴇᴛ ᴘʀᴏꜰɪʟᴇ ᴘɪᴄ ᴘʀɪᴠᴀᴄʏ
┃◈┃• sᴇᴛᴏɴʟɪɴᴇ - sᴇᴛ ᴏɴʟɪɴᴇ ᴘʀɪᴠᴀᴄʏ
┃◈┃• sᴇᴛᴘᴘ - ᴄʜᴀɴɢᴇ ʙᴏᴛ's ᴘʀᴏꜰɪʟᴇ ᴘɪᴄ
┃◈┃• sᴇᴛᴍʏɴᴀᴍᴇ - ᴄʜᴀɴɢᴇ ʙᴏᴛ's ɴᴀᴍᴇ
┃◈┃• ᴜᴘᴅᴀᴛᴇʙɪᴏ - ᴄʜᴀɴɢᴇ ʙᴏᴛ's ʙɪᴏ
┃◈┃• ɢʀᴏᴜᴘsᴘʀɪᴠᴀᴄʏ - sᴇᴛ ɢʀᴏᴜᴘ ᴀᴅᴅ ᴘʀɪᴠᴀᴄʏ
┃◈┃• ɢᴇᴛᴘʀɪᴠᴀᴄʏ - ᴠɪᴇᴡ ᴄᴜʀʀᴇɴᴛ ᴘʀɪᴠᴀᴄʏ sᴇᴛᴛɪɴɢs
┃◈┃• ɢᴇᴛᴘᴘ - ɢᴇᴛ ᴜsᴇʀ's ᴘʀᴏꜰɪʟᴇ ᴘɪᴄᴛᴜʀᴇ
┃◈┃
┃◈┃*ᴏᴘᴛɪᴏɴs ꜰᴏʀ ᴘʀɪᴠᴀᴄʏ ᴄᴏᴍᴍᴀɴᴅs:*
┃◈┃• ᴀʟʟ - ᴇᴠᴇʀʏᴏɴᴇ
┃◈┃• ᴄᴏɴᴛᴀᴄᴛs - ᴍʏ ᴄᴏɴᴛᴀᴄᴛs ᴏɴʟʏ
┃◈┃• ᴄᴏɴᴛᴀᴄᴛ_ʙʟᴀᴄᴋʟɪsᴛ - ᴄᴏɴᴛᴀᴄᴛs ᴇxᴄᴇᴘᴛ ʙʟᴏᴄᴋᴇᴅ
┃◈┃• ɴᴏɴᴇ - ɴᴏʙᴏᴅʏ
┃◈┃• ᴍᴀᴛᴄʜ_ʟᴀsᴛ_sᴇᴇɴ - ᴍᴀᴛᴄʜ ʟᴀsᴛ sᴇᴇɴ
┃◈└───────────┈⊷
╰──────────────┈⊷
*ɴᴏᴛᴇ:* ᴍᴏsᴛ ᴄᴏᴍᴍᴀɴᴅs ᴀʀᴇ ᴏᴡɴᴇʀ-ᴏɴʟʏ`;

        await conn.sendMessage(
            from,
            {
                image: { url: `https://files.catbox.moe/oyadfh.png` },
                caption: privacyMenu,
                contextInfo: {
                    mentionedJid: [m.sender],
                    forwardingScore: 999,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '120363404529319592@newsletter',
                        newsletterName: "ᴘʀɪᴠᴀᴄʏ sᴇᴛᴛɪɴɢs",
                        serverMessageId: 143
                    }
                }
            },
            { quoted: anony }
        );

    } catch (e) {
        console.log(e);
        reply(`ᴇʀʀᴏʀ: ${e.message}`);
    }
});

cmd({
    pattern: "blocklist",
    desc: "View the list of blocked users.",
    category: "privacy",
    react: "📋",
    filename: __filename
},
async (conn, mek, m, { from, isOwner, reply }) => {
    if (!isOwner) return reply("*📛 ʏᴏᴜ ᴀʀᴇ ɴᴏᴛ ᴛʜᴇ ᴏᴡɴᴇʀ!*");

    try {
        const blockedUsers = await conn.fetchBlocklist();

        if (blockedUsers.length === 0) {
            return reply("📋 ʏᴏᴜʀ ʙʟᴏᴄᴋ ʟɪsᴛ ɪs ᴇᴍᴘᴛʏ.");
        }

        const list = blockedUsers
            .map((user, i) => `🚧 ʙʟᴏᴄᴋᴇᴅ ${user.split('@')[0]}`)
            .join('\n');

        const count = blockedUsers.length;
        reply(`📋 ʙʟᴏᴄᴋᴇᴅ ᴜsᴇʀs (${count}):\n\n${list}`);
    } catch (err) {
        console.error(err);
        reply(`❌ ꜰᴀɪʟᴇᴅ ᴛᴏ ꜰᴇᴛᴄʜ ʙʟᴏᴄᴋ ʟɪsᴛ: ${err.message}`);
    }
});

cmd({
    pattern: "getbio",
    desc: "Displays the user's bio.",
    category: "privacy",
    filename: __filename,
}, async (conn, mek, m, { args, reply }) => {
    try {
        const jid = args[0] || mek.key.remoteJid;
        const about = await conn.fetchStatus?.(jid);
        if (!about) return reply("ɴᴏ ʙɪᴏ ꜰᴏᴜɴᴅ.");
        return reply(`ᴜsᴇʀ ʙɪᴏ:\n\n${about.status}`);
    } catch (error) {
        console.error("Error in bio command:", error);
        reply("ɴᴏ ʙɪᴏ ꜰᴏᴜɴᴅ.");
    }
});

cmd({
    pattern: "setppall",
    desc: "Update Profile Picture Privacy",
    category: "privacy",
    react: "🔐",
    filename: __filename
}, 
async (conn, mek, m, { from, l, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply }) => {
    if (!isOwner) return reply("❌ ʏᴏᴜ ᴀʀᴇ ɴᴏᴛ ᴛʜᴇ ᴏᴡɴᴇʀ!");
    
    try {
        const value = args[0] || 'all'; 
        const validValues = ['all', 'contacts', 'contact_blacklist', 'none'];  
        
        if (!validValues.includes(value)) {
            return reply("❌ ɪɴᴠᴀʟɪᴅ ᴏᴘᴛɪᴏɴ. ᴠᴀʟɪᴅ ᴏᴘᴛɪᴏɴs ᴀʀᴇ: 'ᴀʟʟ', 'ᴄᴏɴᴛᴀᴄᴛs', 'ᴄᴏɴᴛᴀᴄᴛ_ʙʟᴀᴄᴋʟɪsᴛ', 'ɴᴏɴᴇ'.");
        }
        
        await conn.updateProfilePicturePrivacy(value);
        reply(`✅ ᴘʀᴏꜰɪʟᴇ ᴘɪᴄᴛᴜʀᴇ ᴘʀɪᴠᴀᴄʏ ᴜᴘᴅᴀᴛᴇᴅ ᴛᴏ: ${value}`);
    } catch (e) {
        return reply(`*ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ᴘʀᴏᴄᴇssɪɴɢ ʏᴏᴜʀ ʀᴇǫᴜᴇsᴛ.*\n\n_ᴇʀʀᴏʀ:_ ${e.message}`);
    }
});

cmd({
    pattern: "setonline",
    desc: "Update Online Privacy",
    category: "privacy",
    react: "🔐",
    filename: __filename
}, 
async (conn, mek, m, { from, l, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply }) => {
    if (!isOwner) return reply("❌ ʏᴏᴜ ᴀʀᴇ ɴᴏᴛ ᴛʜᴇ ᴏᴡɴᴇʀ!");

    try {
        const value = args[0] || 'all'; 
        const validValues = ['all', 'match_last_seen'];
        
        if (!validValues.includes(value)) {
            return reply("❌ ɪɴᴠᴀʟɪᴅ ᴏᴘᴛɪᴏɴ. ᴠᴀʟɪᴅ ᴏᴘᴛɪᴏɴs ᴀʀᴇ: 'ᴀʟʟ', 'ᴍᴀᴛᴄʜ_ʟᴀsᴛ_sᴇᴇɴ'.");
        }

        await conn.updateOnlinePrivacy(value);
        reply(`✅ ᴏɴʟɪɴᴇ ᴘʀɪᴠᴀᴄʏ ᴜᴘᴅᴀᴛᴇᴅ ᴛᴏ: ${value}`);
    } catch (e) {
        return reply(`*ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ᴘʀᴏᴄᴇssɪɴɢ ʏᴏᴜʀ ʀᴇǫᴜᴇsᴛ.*\n\n_ᴇʀʀᴏʀ:_ ${e.message}`);
    }
});

cmd({
    pattern: "setmyname",
    desc: "Set your WhatsApp display name.",
    category: "privacy",
    react: "⚙️",
    filename: __filename
},
async (conn, mek, m, { from, isOwner, reply, args }) => {
    if (!isOwner) return reply("❌ ʏᴏᴜ ᴀʀᴇ ɴᴏᴛ ᴛʜᴇ ᴏᴡɴᴇʀ!");

    const displayName = args.join(" ");
    if (!displayName) return reply("❌ ᴘʟᴇᴀsᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ᴅɪsᴘʟᴀʏ ɴᴀᴍᴇ.");

    try {
        // Fixed: Removed the broken socket creation code. 
        // Just use the existing 'conn' passed into the command.
        await conn.updateProfileName(displayName);
        reply(`✅ ʏᴏᴜʀ ᴅɪsᴘʟᴀʏ ɴᴀᴍᴇ ʜᴀs ʙᴇᴇɴ sᴇᴛ ᴛᴏ: ${displayName}`);
    } catch (err) {
        console.error(err);
        reply("❌ ꜰᴀɪʟᴇᴅ ᴛᴏ sᴇᴛ ʏᴏᴜʀ ᴅɪsᴘʟᴀʏ ɴᴀᴍᴇ.");
    }
});

cmd({
    pattern: "updatebio",
    react: "🥏",
    desc: "Change the Bot number Bio.",
    category: "privacy",
    use: '.updatebio',
    filename: __filename
},
async (conn, mek, m, { from, l, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply }) => {
    try {
        if (!isOwner) return reply('🚫 *ʏᴏᴜ ᴍᴜsᴛ ʙᴇ ᴀɴ ᴏᴡɴᴇʀ ᴛᴏ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ*');
        if (!q) return reply('❓ *ᴇɴᴛᴇʀ ᴛʜᴇ ɴᴇᴡ ʙɪᴏ*');
        if (q.length > 139) return reply('❗ *sᴏʀʀʏ! ᴄʜᴀʀᴀᴄᴛᴇʀ ʟɪᴍɪᴛ ᴇxᴄᴇᴇᴅᴇᴅ*');
        await conn.updateProfileStatus(q);
        await conn.sendMessage(from, { text: "✔️ *ɴᴇᴡ ʙɪᴏ ᴀᴅᴅᴇᴅ sᴜᴄᴄᴇssꜰᴜʟʟʏ*" }, { quoted: anony });
    } catch (e) {
        reply('🚫 *ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ!*\n\n' + e);
        l(e);
    }
});

cmd({
    pattern: "groupsprivacy",
    desc: "Update Group Add Privacy",
    category: "privacy",
    react: "🔐",
    filename: __filename
}, 
async (conn, mek, m, { from, l, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply }) => {
    if (!isOwner) return reply("❌ ʏᴏᴜ ᴀʀᴇ ɴᴏᴛ ᴛʜᴇ ᴏᴡɴᴇʀ!");

    try {
        const value = args[0] || 'all'; 
        const validValues = ['all', 'contacts', 'contact_blacklist', 'none'];
        
        if (!validValues.includes(value)) {
            return reply("❌ ɪɴᴠᴀʟɪᴅ ᴏᴘᴛɪᴏɴ. ᴠᴀʟɪᴅ ᴏᴘᴛɪᴏɴs ᴀʀᴇ: 'ᴀʟʟ', 'ᴄᴏɴᴛᴀᴄᴛs', 'ᴄᴏɴᴛᴀᴄᴛ_ʙʟᴀᴄᴋʟɪsᴛ', 'ɴᴏɴᴇ'.");
        }

        await conn.updateGroupsAddPrivacy(value);
        reply(`✅ ɢʀᴏᴜᴘ ᴀᴅᴅ ᴘʀɪᴠᴀᴄʏ ᴜᴘᴅᴀᴛᴇᴅ ᴛᴏ: ${value}`);
    } catch (e) {
        return reply(`*ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ᴘʀᴏᴄᴇssɪɴɢ ʏᴏᴜʀ ʀᴇǫᴜᴇsᴛ.*\n\n_ᴇʀʀᴏʀ:_ ${e.message}`);
    }
});

cmd({
    pattern: "getprivacy",
    desc: "Get the bot Number Privacy Setting Updates.",
    category: "privacy",
    use: '.getprivacy',
    filename: __filename
},
async (conn, mek, m, { from, l, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply }) => {
    try {
        if (!isOwner) return reply('🚫 *ʏᴏᴜ ᴍᴜsᴛ ʙᴇ ᴀɴ ᴏᴡɴᴇʀ ᴛᴏ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ*');
        const duka = await conn.fetchPrivacySettings?.(true);
        if (!duka) return reply('🚫 *ꜰᴀɪʟᴇᴅ ᴛᴏ ꜰᴇᴛᴄʜ ᴘʀɪᴠᴀᴄʏ sᴇᴛᴛɪɴɢs*');
        
        let puka = `
╭───「 ᴘʀɪᴠᴀᴄʏ 」───◆  
│ ∘ ʀᴇᴀᴅ ʀᴇᴄᴇɪᴘᴛ: ${duka.readreceipts}  
│ ∘ ᴘʀᴏꜰɪʟᴇ ᴘɪᴄᴛᴜʀᴇ: ${duka.profile}  
│ ∘ sᴛᴀᴛᴜs: ${duka.status}  
│ ∘ ᴏɴʟɪɴᴇ: ${duka.online}  
│ ∘ ʟᴀsᴛ sᴇᴇɴ: ${duka.last}  
│ ∘ ɢʀᴏᴜᴘ ᴘʀɪᴠᴀᴄʏ: ${duka.groupadd}  
│ ∘ ᴄᴀʟʟ ᴘʀɪᴠᴀᴄʏ: ${duka.calladd}  
╰────────────────────`;
        await conn.sendMessage(from, { text: puka }, { quoted: anony });
    } catch (e) {
        reply('🚫 *ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ!*\n\n' + e);
        l(e);
    }
});

cmd({
    pattern: "getpp",
    alias: ["stealpp"],
    react: "⤵️",
    desc: "Sends the profile picture of a user by phone number (owner only)",
    category: "owner",
    use: ".getpp <phone number>",
    filename: __filename
},
async (conn, mek, m, { from, prefix, l, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isCreator, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply }) => {
    try {
        if (!isCreator) return reply("ᴏɴʟʏ ᴛʜᴇ ᴏᴡɴᴇʀ ᴄᴀɴ ᴜsᴇ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ.");

        if (!args[0]) return reply("ᴘʟᴇᴀsᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ᴘʜᴏɴᴇ ɴᴜᴍʙᴇʀ.");

        let targetJid = args[0].replace(/[^0-9]/g, "") + "@s.whatsapp.net";

        let ppUrl;
        try {
            ppUrl = await conn.profilePictureUrl(targetJid, "image");
        } catch (e) {
            return reply("ᴛʜɪs ᴜsᴇʀ ʜᴀs ɴᴏ ᴘʀᴏꜰɪʟᴇ ᴘɪᴄᴛᴜʀᴇ ᴏʀ ɪᴛ ᴄᴀɴɴᴏᴛ ʙᴇ ᴀᴄᴄᴇssᴇᴅ.");
        }

        let userName = targetJid.split("@")[0];
        try {
            const contact = await conn.getContact(targetJid);
            userName = contact.notify || contact.vname || userName;
        } catch {
            // keep default number as fallback
        }

        await conn.sendMessage(from, { 
            image: { url: ppUrl }, 
            caption: `> ᴘʀᴏꜰɪʟᴇ ᴘɪᴄᴛᴜʀᴇ ꜰᴇᴛᴄʜᴇᴅ sᴜᴄᴄᴇssꜰᴜʟʟʏ.\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴘʀɪᴍᴇ ʀɪᴅᴢ `
        });

        await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });

    } catch (e) {
        reply("ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ꜰᴇᴛᴄʜɪɴɢ ᴛʜᴇ ᴘʀᴏꜰɪʟᴇ ᴘɪᴄᴛᴜʀᴇ. ᴘʟᴇᴀsᴇ ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ.");
        l(e);
    }
});

cmd({
  pattern: "quran",
  alias: ["surah"],
  react: "🤍",
  desc: "Get Quran Surah details and explanation.",
  category: "main",
  filename: __filename
}, async (conn, mek, m, { from, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply }) => {
  try {
    let surahInput = args[0];

    if (!surahInput) {
      return reply('ᴛʏᴘᴇ sᴜʀᴀʜ ɴᴜᴍʙᴇʀ ᴏʀ ᴛʏᴘᴇ *.sᴜʀᴀʜᴍᴇɴᴜ* ꜰᴏʀ ɢᴇᴛᴛɪɴɢ sᴜʀᴀʜ ɴᴜᴍʙᴇʀs');
    }

    let surahListRes = await fetchJson('https://quran-endpoint.vercel.app/quran');
    let surahList = surahListRes.data;

    let surahData = surahList.find(surah => 
        surah.number === Number(surahInput) || 
        surah.asma.ar.short.toLowerCase() === surahInput.toLowerCase() || 
        surah.asma.en.short.toLowerCase() === surahInput.toLowerCase()
    );

    if (!surahData) {
      return reply(`ᴄᴏᴜʟᴅɴ'ᴛ ꜰɪɴᴅ sᴜʀᴀʜ ᴡɪᴛʜ ɴᴜᴍʙᴇʀ ᴏʀ ɴᴀᴍᴇ "${surahInput}"`);
    }

    let res = await axios.get(`https://quran-endpoint.vercel.app/quran/${surahData.number}`);
    
    if (res.status !== 200) {
      return reply(`ᴀᴘɪ ʀᴇQᴜᴇsᴛ ꜰᴀɪʟᴇᴅ ᴡɪᴛʜ sᴛᴀᴛᴜs ${res.status} ᴀɴᴅ ᴍᴇssᴀɢᴇ ${res.statusText}`);
    }

    let json = res.data;

    let translatedTafsirUrdu = await translate(json.data.tafsir.id, { to: 'ur', autoCorrect: true });
    let translatedTafsirEnglish = await translate(json.data.tafsir.id, { to: 'en', autoCorrect: true });

    let quranSurah = `
🕋 *Qᴜʀᴀɴ: ᴛʜᴇ ʜᴏʟʏ ʙᴏᴏᴋ ♥️🌹قرآن مجید🌹♥️*\n
📖 *sᴜʀᴀʜ ${json.data.number}: ${json.data.asma.ar.long} (${json.data.asma.en.long})*\n
💫ᴛʏᴘᴇ: ${json.data.type.en}\n
✅ɴᴜᴍʙᴇʀ ᴏꜰ ᴠᴇʀsᴇs: ${json.data.ayahCount}\n
⚡🔮 *ᴇxᴘʟᴀɴᴀᴛɪᴏɴ (ᴜʀᴅᴜ):*\n
${translatedTafsirUrdu.text}\n
⚡🔮 *ᴇxᴘʟᴀɴᴀᴛɪᴏɴ (ᴇɴɢʟɪsʜ):*\n
${translatedTafsirEnglish.text}`;

    // Buttons configuration
    const buttons = [
        {
            name: 'cta_url',
            buttonParamsJson: JSON.stringify({
                display_text: '📖 Open Quran',
                url: 'https://quran.com'
            })
        },
        {
            name: 'cta_url',
            buttonParamsJson: JSON.stringify({
                display_text: '🌐 ᴏᴡɴᴇʀ',
                url: 'https://ridzcoder.xyz'
            })
        }
    ];

    await sendButtons(conn, from, {
        title: '🕋 ǫᴜʀᴀɴ ᴋᴀʀᴇᴇᴍ',
        text: quranSurah,
        footer: 'ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴘʀɪᴍᴇ ʀɪᴅᴢ',
        image: { url: `https://files.catbox.moe/8fy6up.jpg` },
        buttons: buttons
    }, { quoted: anony });

    if (json.data.recitation.full) {
      await conn.sendMessage(from, {
        audio: { url: json.data.recitation.full },
        mimetype: 'audio/mpeg',  
        ptt: true
      }, { quoted: anony });
    }

  } catch (error) {
    console.error(error);
    reply(`ᴇʀʀᴏʀ: ${error.message}`);
  }
});

cmd({
    pattern: "quranmenu",
    alias: ["surahmenu", "surahlist"],
    desc: "menu the bot",
    category: "main",
    react: "❤️",
    filename: __filename
}, 
async (conn, mek, m, { from, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply }) => {
    try {
        let dec = `❤️  ⊷┈ *ǫᴜʀᴀɴ ᴋᴀʀᴇᴇᴍ* ┈⊷  🤍

 💫 ᴀʟʟ sᴜʀᴀʜ ᴀɴᴅ ᴛʜᴇɪʀ ɴᴜᴍʙᴇʀs ʟɪsᴛ
ꜰᴏʀ ɢᴇᴛᴛɪɴɢ sᴜʀᴀʜ ᴛʏᴘᴇ .sᴜʀᴀʜ 36 💫🌸 

1. 🕌 ᴀʟ-ꜰᴀᴛɪʜᴀ (ᴛʜᴇ ᴏᴘᴇɴɪɴɢ) - الفاتحہ (پہلا سورہ)
2. 🐄 ᴀʟ-ʙᴀǫᴀʀᴀʜ (ᴛʜᴇ ᴄᴏᴡ) - البقرہ (گائے)
3. 🏠 ᴀᴀʟɪ ɪᴍʀᴀɴ (ᴛʜᴇ ꜰᴀᴍɪʟʏ ᴏꜰ ɪᴍʀᴀɴ) - آل عمران (عمران کا خاندان)
4. 👩 ᴀɴ-ɴɪsᴀ' (ᴛʜᴇ ᴡᴏᴍᴇɴ) - النساء (عورتیں)
5. 🍽️ ᴀʟ-ᴍᴀ'ɪᴅᴀʜ (ᴛʜᴇ ᴛᴀʙʟᴇ sᴘʀᴇᴀᴅ) - المائدہ (پھیلی ہوئی میز)
6. 🐪 ᴀʟ-ᴀɴ'ᴀᴍ (ᴛʜᴇ ᴄᴀᴛᴛʟᴇ) - الانعام (مویشی)
7. ⛰️ ᴀʟ-ᴀ'ʀᴀꜰ (ᴛʜᴇ ʜᴇɪɢʜᴛs) - الأعراف (بلندیاں)
8. ⚔️ ᴀʟ-ᴀɴꜰᴀʟ (ᴛʜᴇ sᴘᴏɪʟs ᴏꜰ ᴡᴀʀ) - الانفال (غنائم)
9. 🙏 ᴀᴛ-ᴛᴀᴡʙᴀʜ (ᴛʜᴇ ʀᴇᴘᴇɴᴛᴀɴᴄᴇ) - التوبہ (توبہ)
10. 🐟 ʏᴜɴᴜs (ᴊᴏɴᴀʜ) - یونس (یونس)
11. 🌩️ ʜᴜᴅ (ʜᴜᴅ) - ہود (ہود)
12. 👶 ʏᴜsᴜꜰ (ᴊᴏsᴇᴘʜ) - یوسف (یوسف)
13. ⚡ ᴀʀ-ʀᴀᴅ (ᴛʜᴇ ᴛʜᴜɴᴅᴇʀ) - الرعد (گرج)
14. 🕊️ ɪʙʀᴀʜɪᴍ (ᴀʙʀᴀʜᴀᴍ) - ابراہیم (ابراہیم)
15. 🪨 ᴀʟ-ʜɪᴊʀ (ᴛʜᴇ ʀᴏᴄᴋʏ ᴛʀᴀᴄᴛ) - الحجر (پتھرائی زمین)
16. 🐝 ᴀɴ-ɴᴀʜʟ (ᴛʜᴇ ʙᴇᴇ) - النحل (مکھی)
17. 🌙 ᴀʟ-ɪsʀᴀ' (ᴛʜᴇ ɴɪɢʜᴛ ᴊᴏᴜʀɴᴇʏ) - الإسراء (رات کا سفر)
18. 🕳️ ᴀʟ-ᴋᴀʜꜰ (ᴛʜᴇ ᴄᴀᴠᴇ) - الکہف (غار)
19. 🧕🏻 ᴍᴀʀʏᴀᴍ (ᴍᴀʀʏ) - مریم (مریم)
20. 📜 ᴛᴀ-ʜᴀ (ᴛᴀ-ʜᴀ) - طٰہٰ (طٰہٰ)
21. 📖 ᴀʟ-ᴀɴʙɪʏᴀ' (ᴛʜᴇ ᴘʀᴏᴘʜᴇᴛs) - الانبیاء (پیغمبروں)
22. 🕋 ᴀʟ-ʜᴀᴊᴊ (ᴛʜᴇ ᴘɪʟɢʀɪᴍᴀɢᴇ) - الحج (حج)
23. 🙌 ᴀʟ-ᴍᴜ'ᴍɪɴᴜɴ (ᴛʜᴇ ʙᴇʟɪᴇᴠᴇʀs) - المؤمنون (ایمان والے)
24. 💡 ᴀɴ-ɴᴜʀ (ᴛʜᴇ ʟɪɢʜᴛ) - النور (روشنی)
25. ⚖️ ᴀʟ-ꜰᴜʀǫᴀɴ (ᴛʜᴇ ᴄʀɪᴛᴇʀɪᴏɴ) - الفرقان (فرق کرنے والا)
26. 🎤 ᴀsʜ-sʜᴜ'ᴀʀᴀ' (ᴛʜᴇ ᴘᴏᴇᴛs) - الشعراء (شاعر)
27. 🐜 ᴀɴ-ɴᴀᴍʟ (ᴛʜᴇ ᴀɴᴛ) - النمل (چڑیا)
28. 📚 ᴀʟ-ǫᴀsᴀs (ᴛʜᴇ sᴛᴏʀɪᴇs) - القصص (کہانیاں)
29. 🕷️ ᴀʟ-ᴀɴᴋᴀʙᴜᴛ (ᴛʜᴇ sᴘɪᴅᴇʀ) - العنكبوت (مکڑی)
30. 🏛️ ᴀʀ-ʀᴜᴍ (ᴛʜᴇ ʀᴏᴍᴀɴs) - الروم (رومی)
31. 📖 ʟᴜǫᴍᴀɴ (ʟᴜǫᴍᴀɴ) - لقمان (لقمان)
32. 🙇 ᴀs-sᴀᴊᴅᴀ (ᴛʜᴇ ᴘʀᴏsᴛʀᴀᴛɪᴏɴ) - السجدہ (سجدہ)
33. ⚔️ ᴀʟ-ᴀʜᴢᴀʙ (ᴛʜᴇ ᴄᴏᴍʙɪɴᴇᴅ ꜰᴏʀᴄᴇs) - الاحزاب (مخلوط قوتیں)
34. 🌸 sᴀʙᴀ' (sʜᴇʙᴀ) - سبا (سبا)
35. 🛠️ ꜰᴀᴛɪʀ (ᴛʜᴇ ᴏʀɪɢɪɴᴀᴛᴏʀ) - فاطر (خالق)
36. 📖 ʏᴀ-sɪɴ (ʏᴀ-sɪɴ) - یس (یس)
37. 🛡️ ᴀs-sᴀꜰꜰᴀᴛ (ᴛʜᴏsᴇ ᴡʜᴏ sᴇᴛ ᴛʜᴇ ʀᴀɴᴋs) - الصافات (صفیں مرتب کرنے والے)
38. 🅱️ sᴀᴅ (ᴛʜᴇ ʟᴇᴛᴛᴇʀ sᴀᴅ) - صاد (حرف صاد)
39. 🪖 ᴀᴢ-ᴢᴜᴍᴀʀ (ᴛʜᴇ ᴛʀᴏᴏᴘs) - الزمر (جنگی دستے)
40. 🤲 ɢʜᴀꜰɪʀ (ᴛʜᴇ ꜰᴏʀɢɪᴠᴇʀ) - غافر (بخشنے والا)
41. 📜 ꜰᴜssɪʟᴀᴛ (ᴇxᴘʟᴀɪɴᴇᴅ ɪɴ ᴅᴇᴛᴀɪʟ) - فصلت (تفصیل سے بیان)
42. 🗣️ ᴀsʜ-sʜᴜʀᴀ (ᴄᴏɴsᴜʟᴛᴀᴛɪᴏɴ) - الشوری (مشاورت)
43. 💰 ᴀᴢ-ᴢᴜᴋʜʀᴜꜰ (ᴛʜᴇ ɢᴏʟᴅ ᴀᴅᴏʀɴᴍᴇɴᴛs) - الزخرف (سونے کے زیور)
44. 💨 ᴀᴅ-ᴅᴜᴋʜᴀɴ (ᴛʜᴇ sᴍᴏᴋᴇ) - الدخان (دھواں)
45. 🐊 ᴀʟ-ᴊᴀᴛʜɪʏᴀʜ (ᴛʜᴇ ᴄʀᴏᴜᴄʜɪɴɢ) - الجاثیہ (جھکنا)
46. 🌪️ ᴀʟ-ᴀʜǫᴀꜰ (ᴛʜᴇ ᴡɪɴᴅ-ᴄᴜʀᴠᴇᴅ sᴀɴᴅʜɪʟʟs) - الأحقاف (ہوائی چکروں والی ریت کی پہاڑیاں)
47. 🕋 ᴍᴜʜᴀᴍᴍᴀᴅ (ᴍᴜʜᴀᴍᴍᴀᴅ) - محمد (محمد)
48. 🏆 ᴀʟ-ꜰᴀᴛʜ (ᴛʜᴇ ᴠɪᴄᴛᴏʀʏ) - الفتح (فتح)
49. 🏠 ᴀʟ-ʜᴜᴊᴜʀᴀᴛ (ᴛʜᴇ ʀᴏᴏᴍs) - الحجرات (کمرے)
50. 🔤 ǫᴀꜰ (ᴛʜᴇ ʟᴇᴛᴛᴇʀ ǫᴀꜰ) - قاف (حرف قاف)
51. 🌬️ ᴀᴅʜ-ᴅʜᴀʀɪʏᴀᴛ (ᴛʜᴇ ᴡɪɴɴᴏᴡɪɴɢ ᴡɪɴᴅs) - الذاریات (پھٹنے والی ہوائیں)
52. ⛰️ ᴀᴛ-ᴛᴜʀ (ᴛʜᴇ ᴍᴏᴜɴᴛ) - الطور (پہاڑ)
53. 🌟 ᴀɴ-ɴᴀᴊᴍ (ᴛʜᴇ sᴛᴀʀ) - النجم (ستارہ)
54. 🌙 ᴀʟ-ǫᴀᴍᴀʀ (ᴛʜᴇ ᴍᴏᴏɴ) - القمر (چاند)
55. 💖 ᴀʀ-ʀᴀʜᴍᴀɴ (ᴛʜᴇ ʙᴇɴᴇꜰɪᴄᴇɴᴛ) - الرحمن (بہت مہربان)
56. 🌌 ᴀʟ-ᴡᴀǫɪ'ᴀ (ᴛʜᴇ ɪɴᴇᴠɪᴛᴀʙʟᴇ) - الواقعہ (ہونے والا)
57. 🔩 ᴀʟ-ʜᴀᴅɪᴅ (ᴛʜᴇ ɪʀᴏɴ) - الحدید (لوہا)
58. 👩‍⚖️ ᴀʟ-ᴍᴜᴊᴀᴅɪʟᴀ (ᴛʜᴇ ᴘʟᴇᴀᴅɪɴɢ ᴡᴏᴍᴀɴ) - المجادلہ (مدعی عورت)
59. 🏴 ᴀʟ-ʜᴀsʜʀ (ᴛʜᴇ ᴇxɪʟᴇ) - الحشر (اخراج)
60. 🔍 ᴀʟ-ᴍᴜᴍᴛᴀʜᴀɴᴀʜ (sʜᴇ ᴛʜᴀᴛ ɪs ᴛᴏ ʙᴇ ᴇxᴀᴍɪɴᴇᴅ) - الممتحنہ (جانچنے والی)
61. 📊 ᴀs-sᴀꜰꜰ (ᴛʜᴇ ʀᴀɴᴋs) - الصف (صفیں)
62. 🕌 ᴀʟ-ᴊᴜᴍᴜ'ᴀʜ (ꜰʀɪᴅᴀʏ) - الجمعة (جمعہ)
63. 🤥 ᴀʟ-ᴍᴜɴᴀꜰɪǫᴜɴ (ᴛʜᴇ ʜʏᴘᴏᴄʀɪᴛᴇs) - المنافقون (منافق)
64. 🌪️ ᴀᴛ-ᴛᴀɢʜᴀʙᴜɴ (ᴍᴜᴛᴜᴀʟ ᴅɪsɪʟʟᴜsɪᴏɴ) - التغابن (آپس کی بے وقوفی)
65. 💔 ᴀᴛ-ᴛᴀʟᴀǫ (ᴛʜᴇ ᴅɪᴠᴏʀᴄᴇ) - الطلاق (طلاق)
66. 🚫 ᴀᴛ-ᴛᴀʜʀɪᴍ (ᴛʜᴇ ᴘʀᴏʜɪʙɪᴛɪᴏɴ) - التحریم (پابندی)
67. 👑 ᴀʟ-ᴍᴜʟᴋ (ᴛʜᴇ sᴏᴠᴇʀᴇɪɢɴᴛʏ) - المُلك (حکومت)
68. 🖋️ ᴀʟ-ǫᴀʟᴀᴍ (ᴛʜᴇ ᴘᴇɴ) - القلم (قلم)
69. 🔍 ᴀʟ-ʜᴀǫǫᴀʜ (ᴛʜᴇ ʀᴇᴀʟɪᴛʏ) - الحقہ (حقیقت)
70. ⬆️ ᴀʟ-ᴍᴀ'ᴀʀɪᴊ (ᴛʜᴇ ᴀsᴄᴇɴᴅɪɴɢ sᴛᴀɪʀᴡᴀʏs) - المعارج (چڑھنے کی سیڑھیاں)
71. 🌊 ɴᴜʜ (ɴᴏᴀʜ) - نوح (نوح)
72. 👻 ᴀʟ-ᴊɪɴɴ (ᴛʜᴇ ᴊɪɴɴ) - الجن (جنات)
73. 🕵️‍♂️ ᴀʟ-ᴍᴜᴢᴢᴀᴍᴍɪʟ (ᴛʜᴇ ᴇɴsʜʀᴏᴜᴅᴇᴅ ᴏɴᴇ) - المزمل (چادر اوڑھے ہوئے)
74. 🧕 ᴀʟ-ᴍᴜᴅᴅᴀᴛʜɪʀ (ᴛʜᴇ ᴄʟᴏᴀᴋᴇᴅ ᴏɴᴇ) - المُدثر (پوشیدہ)
75. 🌅 ᴀʟ-ǫᴀʀɪ'ᴀʜ (ᴛʜᴇ ᴄᴀʟᴀᴍɪᴛʏ) - القارعة (آفت)
76. 🧑‍🤝‍🧑 ᴀʟ-ɪɴsᴀɴ (ᴍᴀɴ) - الانسان (انسان)
77. ✉️ ᴀʟ-ᴍᴜʀsᴀʟᴀᴛ (ᴛʜᴇ ᴇᴍɪssᴀʀɪᴇs) - المُرسلات (پہنچانے والے)
78. 📣 ᴀɴ-ɴᴀʙᴀ' (ᴛʜᴇ ᴛɪᴅɪɴɢs) - النبأ (خبریں)
79. 🪤 ᴀɴ-ɴᴀᴢɪ'ᴀᴛ (ᴛʜᴏsᴇ ᴡʜᴏ ᴅʀᴀɢ ꜰᴏʀᴛʜ) - النازعات (کھینچنے والے)
80. 😠 ᴀʙᴀsᴀ (ʜᴇ ꜰʀᴏᴡɴᴇᴅ) - عبس (اس نے چہرہ بدلا)
81. 💥 ᴀᴛ-ᴛᴀᴋᴡɪʀ (ᴛʜᴇ ᴏᴠᴇʀᴛʜʀᴏᴡɪɴɢ) - التکوير (پھٹنا)
82. 💔 ᴀʟ-ɪɴꜰɪᴛᴀʀ (ᴛʜᴇ ᴄʟᴇᴀᴠɪɴɢ) - الانفطار (پھٹنا)
83. ⚖️ ᴀʟ-ᴍᴜᴛᴀꜰꜰɪꜰɪɴ (ᴅᴇꜰʀᴀᴜᴅɪɴɢ) - المطففين (کم تولنے والے)
84. 🌀 ᴀʟ-ɪɴsʜɪǫᴀǫ (ᴛʜᴇ sᴘʟɪᴛᴛɪɴɢ ᴏᴘᴇɴ) - الانشقاق (پھٹنا)
85. 🌌 ᴀʟ-ʙᴜʀᴜᴊ (ᴛʜᴇ ᴍᴀɴsɪᴏɴs ᴏꜰ ᴛʜᴇ sᴛᴀʀs) - البروج (ستاروں کے گھر)
86. 🌠 ᴀᴛ-ᴛᴀʀɪǫ (ᴛʜᴇ ᴍᴏʀɴɪɴɢ sᴛᴀʀ) - الطارق (صبح کا ستارہ)
87. 🌍 ᴀʟ-ᴀʟᴀ (ᴛʜᴇ ᴍᴏsᴛ ʜɪɢʜ) - الأعلى (سب سے بلند)
88. 🌊 ᴀʟ-ɢʜᴀsʜɪʏᴀʜ (ᴛʜᴇ ᴏᴠᴇʀᴡʜᴇʟᴍɪɴɢ) - الغاشیہ (پرامن)
89. 🌅 ᴀʟ-ꜰᴀᴊʀ (ᴛʜᴇ ᴅᴀᴡɴ) - الفجر (صبح)
90. 🏙️ ᴀʟ-ʙᴀʟᴀᴅ (ᴛʜᴇ ᴄɪᴛʏ) - البلد (شہر)
91. ☀️ ᴀsʜ-sʜᴀᴍs (ᴛʜᴇ sᴜɴ) - الشمس (سورج)
92. 🌜 ᴀʟ-ʟᴀɪʟ (ᴛʜᴇ ɴɪɢʜᴛ) - اللیل (رات)
93. 🌅 ᴀᴅ-ᴅᴜʜᴀ (ᴛʜᴇ ᴍᴏʀɴɪɴɢ ʜᴏᴜʀs) - الضحی (صبح کے گھنٹے)
94. 📖 ᴀs-sʜᴀʀʜ (ᴛʜᴇ ʀᴇʟɪᴇꜰ) - الشرح (آرام)
95. 🍈 ᴀᴛ-ᴛɪɴ (ᴛʜᴇ ꜰɪɢ) - التین (انجیر)
96. 💧 ᴀʟ-ᴀʟᴀǫ (ᴛʜᴇ ᴄʟᴏᴛ) - العلق (خون کا لوتھڑا)
97. ⚡ ᴀʟ-ǫᴀᴅʀ (ᴛʜᴇ ᴘᴏᴡᴇʀ) - القدر (قدرت)
98. 📜 ᴀʟ-ʙᴀʏʏɪɴᴀʜ (ᴛʜᴇ ᴄʟᴇᴀʀ ᴘʀᴏᴏꜰ) - البینة (واضح دلیل)
99. 🌍 ᴀᴢ-ᴢᴀʟᴢᴀʟᴀʜ (ᴛʜᴇ ᴇᴀʀᴛʜǫᴜᴀᴋᴇ) - الزلزلة (زلزلہ)
100. 🐎 ᴀʟ-ᴀᴅɪʏᴀᴛ (ᴛʜᴇ ᴄʜᴀʀɢᴇʀs) - العادیات (چارج کرنے والے)
101. ⚡ ᴀʟ-ǫᴀʀɪ'ᴀʜ (ᴛʜᴇ ᴄᴀʟᴀᴍɪᴛʏ) - القارعة (آفت)
102. 💰 ᴀᴛ-ᴛᴀᴋᴀᴛʜᴜʀ (ᴛʜᴇ ᴀʙᴜɴᴅᴀɴᴄᴇ ᴏꜰ ᴡᴇᴀʟᴛʜ) - التکاثر (مال کی کثرت)
103. ⏳ ᴀʟ-ᴀsʀ (ᴛʜᴇ ᴛɪᴍᴇ) - العصر (وقت)
104. 😠 ᴀʟ-ʜᴜᴍᴀᴢᴀʜ (ᴛʜᴇ sᴄᴀɴᴅᴀʟ-ᴍᴏɴɢᴇʀ) - الہمزہ (چغلی کرنے والا)
105. 🐘 ᴀʟ-ꜰɪʟ (ᴛʜᴇ ᴇʟᴇᴘʜᴀɴᴛ) - الفیل (ہاتھی)
106. 🕌 ǫᴜʀᴀʏsʜ (ǫᴜʀᴀʏsʜ) - قریش (قریش)
107. 🤲 ᴀʟ-ᴍᴀ'ᴜɴ (ᴀᴄᴛs ᴏꜰ ᴋɪɴᴅɴᴇss) - الماعون (نیکی کے کام)
108. 🍇 ᴀʟ-ᴋᴀᴡᴛʜᴀʀ (ᴛʜᴇ ᴀʙᴜɴᴅᴀɴᴄᴇ) - الکوثر (کثرت)
109. ❌ ᴀʟ-ᴋᴀꜰɪʀᴜɴ (ᴛʜᴇ ᴅɪsʙᴇʟɪᴇᴠᴇʀs) - الکافرون (کافر)
110. 🛡️ ᴀɴ-ɴᴀsʀ (ᴛʜᴇ ʜᴇʟᴘ) - النصر (مدد)
111. 🔥 ᴀʟ-ʟᴀʜᴀʙ (ᴛʜᴇ ꜰʟᴀᴍᴇ) - اللہب (شعلہ)
112. ❤️ ᴀʟ-ɪᴋʜʟᴀs (ᴛʜᴇ sɪɴᴄᴇʀɪᴛʏ) - الإخلاص (اخلاص)
113. 🌅 ᴀʟ-ꜰᴀʟᴀǫ (ᴛʜᴇ ᴅᴀʏʙʀᴇᴀᴋ) - الفلق (طلوع صبح)
114. 🌐 ᴀɴ-ɴᴀs (ᴍᴀɴᴋɪɴᴅ) - الناس (انسانیت)`;

        // Buttons configuration
        const buttons = [
            {
                name: 'cta_url',
                buttonParamsJson: JSON.stringify({
                    display_text: '📖 Read Quran Online',
                    url: 'https://quran.com'
                })
            }
        ];

        await sendButtons(conn, from, {
            title: '❤️ ǫᴜʀᴀɴ ᴋᴀʀᴇᴇᴍ ᴍᴇɴᴜ',
            text: dec,
            footer: 'ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴘʀɪᴍᴇ ʀɪᴅᴢ',
            image: { url: `https://files.catbox.moe/8fy6up.jpg` },
            buttons: buttons
        }, { quoted: anony });

    } catch (e) {
        console.log(e);
        reply(`ᴇʀʀᴏʀ: ${e}`);
    }
});
cmd({
    pattern: "script",
    alias: ["repo", "sc", "info"],
    desc: "Fetch information about a GitHub repository.",
    react: "🎗️",
    category: "other",
    filename: __filename,
},
async (conn, mek, m, { from, reply, pushname }) => {
    const githubRepoURL = 'https://github.com/ridzcoder/PRIME-RIDZ';

    try {
        const [, username, repoName] = githubRepoURL.match(/github\.com\/([^/]+)\/([^/]+)/) || [];

        if (!username || !repoName) {
            throw new Error("ɪɴᴠᴀʟɪᴅ ɢɪᴛʜᴜʙ ᴜʀʟ ꜰᴏʀᴍᴀᴛ");
        }

        const response = await fetch(`https://api.github.com/repos/${username}/${repoName}`);
        
        if (!response.ok) {
            throw new Error(`ɢɪᴛʜᴜʙ ᴀᴘɪ ʀᴇǫᴜᴇsᴛ ꜰᴀɪʟᴇᴅ ᴡɪᴛʜ sᴛᴀᴛᴜs ${response.status}`);
        }

        const repoData = await response.json();
        
        const readMore = "──────────────────"; 
        const imageUrl = `https://files.catbox.moe/oyadfh.png`;
        const ownerName = repoData.owner.login; // Defined ownerName

        const formattedInfo = `
ᴛʜᴀɴᴋ ʏᴏᴜ ꜰᴏʀ ʟᴏᴠɪɴɢ ᴘʀɪᴍᴇ ʀɪᴅᴢ 
📁 *${repoData.name}*

⭐ *sᴛᴀʀs:* ${repoData.stargazers_count}
🍴 *ꜰᴏʀᴋs:* ${repoData.forks_count}
👁️ *ᴡᴀᴛᴄʜᴇʀs:* ${repoData.watchers_count}
📦 *sɪᴢᴇ:* ${(repoData.size / 1024).toFixed(2)} ᴍʙ
📅 *ᴜᴘᴅᴀᴛᴇᴅ:* ${moment(repoData.updated_at).format('ᴅᴅ/ᴍᴍ/ʏʏʏʏ ʜʜ:ᴍᴍ:ss')}
📝 *ᴅᴇsᴄ:* ${repoData.description || 'ɴᴏ ᴅᴇsᴄʀɪᴘᴛɪᴏɴ'}

👑 *ᴏᴡɴᴇʀ:* ${ownerName}

> *ᴅᴏɴ'ᴛ ꜰᴏʀɢᴇᴛ ᴛᴏ sᴛᴀʀ & ꜰᴏʀᴋ ᴛʜᴇ ʀᴇᴘᴏ🌟🍴*!`;
  
        const verifiedContact = {
            key: {
                fromMe: false,
                participant: `0@s.whatsapp.net`,
                remoteJid: "status@broadcast"
            },
            message: {
                contactMessage: {
                    displayName: "ᴘʀɪᴍᴇ ʀɪᴅᴢ ʀᴇᴘᴏ",
                    vcard: "BEGIN:VCARD\nVERSION:3.0\nFN:ᴘʀɪᴍᴇ ʀɪᴅᴢ\nORG:ᴘʀɪᴍᴇ ʀɪᴅᴢ;\nTEL;type=CELL;type=VOICE;waid=256777205718:+256777205718\nEND:VCARD"
                }
            }
        };

        // --- BUTTONS CONFIGURATION ---
        const buttons = [
            {
                name: 'cta_url',
                buttonParamsJson: JSON.stringify({
                    display_text: '🔗 ᴏᴘᴇɴ ʀᴇᴘᴏsɪᴛᴏʀʏ',
                    url: repoData.html_url
                })
            },
            {
                name: 'cta_url',
                buttonParamsJson: JSON.stringify({
                    display_text: '📦 ᴅᴏᴡɴʟᴏᴀᴅ ᴢɪᴘ',
                    url: `${repoData.html_url}/archive/refs/heads/main.zip`
                })
            }
        ];

        await sendButtons(conn, from, {
            title: '📁 ᴘʀɪᴍᴇ ʀɪᴅᴢ ʀᴇᴘᴏsɪᴛᴏʀʏ ',
            text: formattedInfo,
            footer: 'ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʀɪᴅᴢ ᴄᴏᴅᴇʀ࿇',
            image: { url: imageUrl },
            buttons: buttons
        }, { quoted: verifiedContact });

        const contextInfo = {
            mentionedJid: [m.sender],
            forwardingScore: 999,
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
                newsletterJid: '120363404529319592@newsletter',
                newsletterName: '☇ ᴘʀɪᴍᴇ ʀɪᴅᴢ sᴜᴘᴘᴏʀᴛ ⃪͎᪳𝆺𝅥',
                serverMessageId: 143
            }
        };

        // Send the audio file with context info
        await conn.sendMessage(from, {
            audio: { url: 'https://files.catbox.moe/h3ge60.m4a' },
            mimetype: 'audio/mp4',
            ptt: true,
            contextInfo: contextInfo
        }, { quoted: verifiedContact });

    } catch (error) {
        console.error("ᴇʀʀᴏʀ ɪɴ ʀᴇᴘᴏ ᴄᴏᴍᴍᴀɴᴅ:", error);
        try {
            if (typeof reply === 'function') {
                reply("ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ᴘʀᴏᴄᴇssɪɴɢ ʏᴏᴜʀ ʀᴇǫᴜᴇsᴛ.");
            } else {
                await conn.sendMessage(from, { 
                    text: "ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ᴘʀᴏᴄᴇssɪɴɢ ʏᴏᴜʀ ʀᴇǫᴜᴇsᴛ." 
                }, { quoted: mek });
            }
        } catch (sendError) {
            console.error("ꜰᴀɪʟᴇᴅ ᴛᴏ sᴇɴᴅ ᴇʀʀᴏʀ ᴍᴇssᴀɢᴇ:", sendError);
        }
    }
});

cmd({
  pattern: "rw",
  alias: ["randomwall", "wallpaper"],
  react: "🌌",
  desc: "Download random wallpapers based on keywords.",
  category: "other",
  use: ".rw <keyword>",
  filename: __filename
}, async (conn, m, store, { from, args, reply }) => {
  try {
    const query = args.join(" ") || "random";
    const apiUrl = `https://pikabotzapi.vercel.app/random/randomwall/?apikey=anya-md&query=${encodeURIComponent(query)}`;

    const { data } = await axios.get(apiUrl);
    
    if (data.status && data.imgUrl) {
      const caption = `🌌 *ʀᴀɴᴅᴏᴍ ᴡᴀʟʟᴘᴀᴘᴇʀ: ${query}*\n\n> *©ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʀɪᴅᴢ ᴄᴏᴅᴇʀ*`;
      await conn.sendMessage(from, { image: { url: data.imgUrl }, caption }, { quoted: m });
    } else {
      reply(`ɴᴏ ᴡᴀʟʟᴘᴀᴘᴇʀ ꜰᴏᴜɴᴅ ꜰᴏʀ*"${query}"*.`);
    }
  } catch (error) {
    console.error("Wallpaper Error:", error);
    reply("ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴅᴜʀɪɴɢ ᴘʀᴏᴄᴇꜱꜱ.");
  }
});

cmd({
  pattern: "npm",
  desc: "Search for a package on npm.",
  react: '📦',
  category: "other",
  filename: __filename,
  use: ".npm <package-name>"
}, async (conn, mek, msg, { from, args, reply }) => {
  try {
    // Check if a package name is provided
    if (!args.length) {
      return reply("ᴘʟᴇᴀꜱᴇ ᴘʀᴏᴠɪᴅᴇ ᴛʜᴇ ɴᴀᴍᴇ ᴏꜰ ᴛʜᴇ ɴᴘᴍ ᴘᴀᴄᴋᴀɢᴇ. Example: .npm express");
    }

    const packageName = args.join(" ");
    const apiUrl = `https://registry.npmjs.org/${encodeURIComponent(packageName)}`;

    // Fetch package details from npm registry
    const response = await axios.get(apiUrl);
    if (response.status !== 200) {
      throw new Error("ᴘᴀᴄᴋᴀɢᴇ ɴᴏᴛ ꜰᴏᴜɴᴅ ᴏʀ ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ.");
    }

    const packageData = response.data;
    const latestVersion = packageData["dist-tags"].latest;
    const description = packageData.description || "No description available.";
    const npmUrl = `https://www.npmjs.com/package/${packageName}`;
    const license = packageData.license || "Unknown";
    const repository = packageData.repository ? packageData.repository.url : "Not available";

    // Create the response message
    const message = `
*ᴘᴀᴄᴋᴀɢᴇ ɴᴀᴍᴇ:* ${packageName}
* ᴅᴇꜱᴄʀɪᴘᴛɪᴏɴ:* ${description}
* ʟᴀꜱᴛ ᴠᴇʀꜱɪᴏɴ:* ${latestVersion}
* ʟɪᴄᴇɴꜱᴇ:* ${license}
* ʀᴇᴘᴏꜱɪᴛᴏʀʏ:* ${repository}
* ɴᴘᴍ ᴜʀʟ:* ${npmUrl}
`;

    // Send the message
    await conn.sendMessage(from, { text: message }, { quoted: anony });

  } catch (error) {
    console.error("Error:", error);
    reply("ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ: " + error.message);
  }
});


cmd({
  pattern: "fullpp",
  alias: ["setpp", "setdp", "pp"],
  react: "🖼️",
  desc: "Set full image as bot's profile picture",
  category: "tools",
  filename: __filename
}, async (client, message, match, { from, isCreator }) => {
  try {
    // Get bot's JID
    const botJid = client.user?.id || (client.user.id.split(":")[0] + "@s.whatsapp.net");
    
    // Allow both bot owner and bot itself to use the command
    if (message.sender !== botJid && !isCreator) {
      return await client.sendMessage(from, {
        text: "*ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ ᴄᴀɴ ᴏɴʟʏ ʙᴇ ᴜsᴇᴅ ʙʏ ᴛʜᴇ ʙᴏᴛ ᴏᴡɴᴇʀ ᴏʀ ᴛʜᴇ ʙᴏᴛ.*"
      }, { quoted: message });
    }

    if (!message.quoted || !message.quoted.mtype || !message.quoted.mtype.includes("image")) {
      return await client.sendMessage(from, {
        text: "*ᴘʟᴇᴀsᴇ ʀᴇᴘʟʏ ᴛᴏ ᴀɴ ɪᴍᴀɢᴇ ᴛᴏ sᴇᴛ ᴀs ᴅᴘ*"
      }, { quoted: message });
    }

    await client.sendMessage(from, {
      text: "*ᴘʀᴏᴄᴇssɪɴɢ ɪᴍᴀɢᴇ ᴘʟᴇᴀsᴇ ᴡᴀɪᴛ...*"
    }, { quoted: message });

    const imageBuffer = await message.quoted.download();
    
    // Read image using the new Jimp v1 syntax
    const image = await Jimp.read(imageBuffer);

    // Image processing pipeline (updated for Jimp v1)
    const blurredBg = image.clone().cover({ w: 640, h: 640 }).blur(10);
    const centeredImage = image.clone().contain({ w: 640, h: 640 });
    blurredBg.composite(centeredImage, 0, 0);
    
    // Get buffer using the new syntax (passing mime type directly)
    const finalImage = await blurredBg.getBuffer("image/jpeg");

    // Update profile picture
    await client.updateProfilePicture(botJid, finalImage);

    await client.sendMessage(from, {
      text: "*ᴘʀɪᴍᴇ ʀɪᴅᴢ ᴅᴘ ᴜᴘᴅᴀᴛᴇᴅ sᴜᴄᴄᴇssғᴜʟʟʏ!*"
    }, { quoted: message });

  } catch (error) {
    console.error("fullpp Error:", error);
    await client.sendMessage(from, {
      text: `*ᴇʀʀᴏʀ ᴜᴘᴅᴀᴛɪɴɢ ᴘʀᴏғɪʟᴇ ᴘɪᴄᴛᴜʀᴇ:*\n${error.message}`
    }, { quoted: message });
  }
});

cmd({
  pattern: "send",
  alias: ["sendme", 'save'],
  react: '📤',
  desc: "Forwards quoted message back to user",
  category: "utility",
  filename: __filename
}, async (client, message, match, { from }) => {
  try {
    if (!match.quoted) {
      return await client.sendMessage(from, {
        text: "*ᴘʟᴇᴀꜱᴇ ʀᴇᴘʟʏ ᴛᴏ ᴀ ᴍᴇꜱꜱᴀɢᴇ!*"
      }, { quoted: message });
    }

    const buffer = await match.quoted.download();
    const mtype = match.quoted.mtype;
    const options = { quoted: message };

    let messageContent = {};
    switch (mtype) {
      case "imageMessage":
        messageContent = {
          image: buffer,
          caption: match.quoted.text || '',
          mimetype: match.quoted.mimetype || "image/jpeg"
        };
        break;
      case "videoMessage":
        messageContent = {
          video: buffer,
          caption: match.quoted.text || '',
          mimetype: match.quoted.mimetype || "video/mp4"
        };
        break;
      case "audioMessage":
        messageContent = {
          audio: buffer,
          mimetype: "audio/mp4",
          ptt: match.quoted.ptt || false
        };
        break;
      default:
        return await client.sendMessage(from, {
          text: "ᴏɴʟʏ ɪᴍᴀɢᴇ, ᴠɪᴅᴇᴏ, ᴀɴᴅ ᴀᴜᴅɪᴏ ᴍᴇꜱꜱᴀɢᴇ ᴀʀᴇ ꜱᴜᴘᴘᴏʀᴛᴇᴅ."
        }, { quoted: message });
    }

    await client.sendMessage(from, messageContent, options);
  } catch (error) {
    console.error("Forward Error:", error);
    await client.sendMessage(from, {
      text: "ᴇʀʀᴏʀ ꜰᴏʀᴡᴀʀᴅɪɴɢ ᴍᴇꜱꜱᴀɢᴇ:\n" + error.message
    }, { quoted: message });
  }
});

cmd(
    {
        pattern: 'take',
        alias: ['rename', 'stake'],
        desc: 'Create a sticker with a custom pack name.',
        category: 'other',
        use: '<reply media or URL>',
        filename: __filename,
    },
    async (conn, mek, m, { quoted, args, q, reply, from }) => {
        if (!mek.quoted) return reply(`*ʀᴇᴘʟʏ ᴛᴏ ᴀɴʏ ꜱᴛɪᴄᴋᴇʀ.*`);
        if (!q) return reply(`*ᴘʟᴇᴀꜱᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ᴘᴀᴄᴋ ɴᴀᴍᴇ ᴜꜱɪɴɢ .take <packname>*`);

        let mime = mek.quoted.mtype;
        let pack = q;

        if (mime === "imageMessage" || mime === "stickerMessage") {
            let media = await mek.quoted.download();
            let sticker = new Sticker(media, {
                pack: pack, 
                type: StickerTypes.FULL,
                categories: ["🤩", "🎉"],
                id: "12345",
                quality: 75,
                background: 'transparent',
            });
            const buffer = await sticker.toBuffer();
            return conn.sendMessage(mek.chat, { sticker: buffer }, { quoted: mek });
        } else {
            return reply("*ᴜʜʜ, ᴘʟᴇᴀꜱᴇ ʀᴇᴘʟʏ ᴛᴏ  ᴀɴ ɪᴍᴀɢᴇ.*");
        }
    }
);

//Sticker create 

cmd(
    {
        pattern: 'sticker',
        alias: ['s', 'stickergif'],
        desc: 'Create a sticker from an image, video, or URL.',
        category: 'other',
        use: '<reply media or URL>',
        filename: __filename,
    },
    async (conn, mek, m, { quoted, args, q, reply, from }) => {
        if (!mek.quoted) return reply(`*ʀᴇᴘʟʏ ᴛᴏ ᴀɴʏ ɪᴍᴀɢᴇ ᴏʀ ᴠɪᴅᴇᴏ ꜱɪʀ.*`);
        let mime = mek.quoted.mtype;
        let pack = Config.STICKER_NAME || "ᴘʀɪᴍᴇ ʀɪᴅᴢ";
        
        if (mime === "imageMessage" || mime === "stickerMessage") {
            let media = await mek.quoted.download();
            let sticker = new Sticker(media, {
                pack: pack, 
                type: StickerTypes.FULL,
                categories: ["🤩", "🎉"], 
                id: "12345",
                quality: 75, 
                background: 'transparent',
            });
            const buffer = await sticker.toBuffer();
            return conn.sendMessage(mek.chat, { sticker: buffer }, { quoted: mek });
        } else {
            return reply("*ᴜʜʜ, ᴘʟᴇᴀꜱᴇ ʀᴇᴘʟʏ ᴛᴏ  ᴀɴ ɪᴍᴀɢᴇ.*");
        }
    }
);


cmd({
  pattern: "tiktokstalk",
  alias: ["tiktoks", "tiks", "ttstalk"],
  desc: "Fetch TikTok user profile details.",
  react: '✅',
  category: 'tools',
  filename: __filename
}, async (conn, m, store, { from, args, reply }) => {
  if (!args[0]) {
    return reply("🌸 ᴡʜᴀᴛ ᴜsᴇʀɴᴀᴍᴇ ᴅᴏ ʏᴏᴜ ᴡᴀɴᴛ ᴛᴏ sᴛᴀʟᴋ ᴏɴ ᴛɪᴋᴛᴏᴋ?\n\n*ᴜsᴀɢᴇ ᴇxᴀᴍᴘʟᴇ:*\n.ᴛɪᴋᴛᴏᴋsᴛᴀʟᴋ ᴘʀɪɴᴄᴇᴛᴇᴄʜ");
  }

  const username = args.join(" ").replace("@", "");
  await store.react('⌛');

  try {
    reply(`🔎 ꜰᴇᴛᴄʜɪɴɢ ᴛɪᴋᴛᴏᴋ ᴘʀᴏꜰɪʟᴇ ꜰᴏʀ: *${username}*`);
    
    const apiUrl = `https://api.princetechn.com/api/stalk/tiktokstalk?apikey=prince&username=${encodeURIComponent(username)}`;
    const response = await axios.get(apiUrl);
    const data = response.data;

    if (!data || !data.success || !data.result) {
      await store.react('❌');
      return reply("ɴᴏ ʀᴇsᴜʟᴛ ꜰᴏᴜɴᴅ ꜰᴏʀ ᴛʜᴀᴛ ᴜsᴇʀ. ᴘʟᴇᴀsᴇ ᴛʀʏ ᴀ ᴅɪꜰꜰᴇʀᴇɴᴛ ᴜsᴇʀɴᴀᴍᴇ.");
    }

    const user = data.result;
    
    // Format the message with profile details
    const message = `
🎭 *ᴛɪᴋᴛᴏᴋ ᴘʀᴏꜰɪʟᴇ sᴛᴀʟᴋᴇʀ* 🎭

👤 *ᴜsᴇʀɴᴀᴍᴇ:* @${user.username || username}
📛 *ɴɪᴄᴋɴᴀᴍᴇ:* ${user.nickname || 'ɴ/ᴀ'}
✅ *ᴠᴇʀɪꜰɪᴇᴅ:* ${user.verified ? "ʏᴇs ✅" : "ɴᴏ ❌"}
📝 *ʙɪᴏ:* ${user.signature || 'ɴᴏ ʙɪᴏ ᴀᴠᴀɪʟᴀʙʟᴇ.'}

📊 *sᴛᴀᴛɪsᴛɪᴄs:*
👥 *ꜰᴏʟʟᴏᴡᴇʀs:* ${user.followers ? user.followers.toLocaleString() : '0'}
👤 *ꜰᴏʟʟᴏᴡɪɴɢ:* ${user.following ? user.following.toLocaleString() : '0'}
❤️ *ʟɪᴋᴇs:* ${user.likes ? user.likes.toLocaleString() : '0'}
🎥 *ᴠɪᴅᴇᴏs:* ${user.videos ? user.videos.toLocaleString() : '0'}

🔗 *ᴘʀᴏꜰɪʟᴇ ᴜʀʟ:* https://www.tiktok.com/@${user.username || username}
`.trim();

    // Send the profile picture with the caption
    if (user.avatar) {
      await conn.sendMessage(from, {
        image: { url: user.avatar },
        caption: message
      }, { quoted: m });
    } else {
      await reply(message);
    }

    await store.react('✅');
  } catch (error) {
    console.error("ᴇʀʀᴏʀ ɪɴ ᴛɪᴋᴛᴏᴋsᴛᴀʟᴋ ᴄᴏᴍᴍᴀɴᴅ:", error);
    await store.react('❌');
    reply("ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ᴘʀᴏᴄᴇssɪɴɢ ʏᴏᴜʀ ʀᴇǫᴜᴇsᴛ.");
  }
});

cmd({
    pattern: "tiny",
    alias: ['short', 'shorturl'],
    react: "🫧",
    desc: "Makes URL tiny.",
    category: "other",
    use: "<url>",
    filename: __filename,
},
async (conn, mek, m, { from, quoted, isOwner, isAdmins, reply, args }) => {
    console.log("Command tiny triggered"); // Ajoutez ceci pour vérifier si la commande est déclenchée

    if (!args[0]) {
        console.log("No URL provided"); // Ajoutez ceci pour vérifier si l'URL est fournie
        return reply("*🏷️ ᴘʟᴇᴀsᴇ ᴘʀᴏᴠɪᴅᴇ ᴍᴇ ᴀ ʟɪɴᴋ.*");
    }

    try {
        const link = args[0];
        console.log("URL to shorten:", link); // Ajoutez ceci pour vérifier l'URL fournie
        const response = await axios.get(`https://tinyurl.com/api-create.php?url=${link}`);
        const shortenedUrl = response.data;

        console.log("Shortened URL:", shortenedUrl); // Ajoutez ceci pour vérifier l'URL raccourcie
        return reply(`*ʏᴏᴜʀ ꜱʜᴏʀᴛᴇɴᴇᴅ ᴜʀʟ*\n\n${shortenedUrl}`);
    } catch (e) {
        console.error("Error shortening URL:", e);
        return reply("ᴀɴ ᴇʀʀᴏʀꜱ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ᴘʀᴏᴄᴇꜱꜱɪɴɢ ʏᴏᴜʀ ʀᴇQᴜᴇꜱᴛ.");
    }
});
