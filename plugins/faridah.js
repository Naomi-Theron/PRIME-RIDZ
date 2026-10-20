const axios = require('axios');
const { cmd } = require('../command');
const { anony } = require('../lib/ridzcoder');
const fetch = require('node-fetch');
const fs = require('fs');
const { exec } = require('child_process');
const { tmpdir } = require('os');
const path = require('path');
const { toAudio, toPTT } = require('../lib/converter');

// Helper function to send the generated image
async function handleEphoto360(conn, mek, from, reply, text, prefix, endpoint, title) {
    if (!text) return reply(`📌 *ᴜꜱᴀɢᴇ:* ${prefix}${endpoint} <ᴛᴇxᴛ>`);
    try {
        await conn.sendMessage(from, { react: { text: "🎨", key: mek.key } });
        const apiUrl = `https://api.princetechn.com/api/ephoto360/${endpoint}?apikey=prince&text=${encodeURIComponent(text)}`;
        const { data } = await axios.get(apiUrl);
        if (!data.success || !data.result?.image_url) throw new Error('ɴᴏ ɪᴍᴀɢᴇ');

        await conn.sendMessage(from, {
            image: { url: data.result.image_url },
            caption: `✨ *${title}*\n\n> ${global.wm || 'ᴘʀɪᴍᴇ ʀɪᴅᴢ'}`
        }, { quoted: anony });

        await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });
    } catch (e) {
        console.error(`${endpoint} error:`, e);
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
        reply("ꜰᴀɪʟᴇᴅ ᴛᴏ ɢᴇɴᴇʀᴀᴛᴇ ɪᴍᴀɢᴇ.");
    }
}

function getRandom(ext) {
    return `${Math.floor(Math.random() * 10000)}${ext}`;
}

// Shared helper for audio effects
async function handleAudioEffect(conn, mek, m, { from, reply, prefix, command }, ffmpegFilter) {
    try {
        const quoted = m.quoted ? m.quoted : null;
        const mime = quoted?.mimetype || "";

        if (!quoted || !/audio/.test(mime)) {
            return reply(`ʀᴇᴘʟʏ ᴛᴏ ᴀɴ *ᴀᴜᴅɪᴏ ꜰɪʟᴇ* ᴡɪᴛʜ *${prefix + command}* ᴛᴏ ᴍᴏᴅɪꜰʏ ɪᴛ.`);
        }

        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });

        const mediaPath = await conn.downloadAndSaveMediaMessage(quoted);
        const outputPath = path.join(tmpdir(), getRandom('.mp3'));

        exec(`ffmpeg -i ${mediaPath} ${ffmpegFilter} ${outputPath}`, async (error) => {
            if (fs.existsSync(mediaPath)) fs.unlinkSync(mediaPath);
            if (error) {
                await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
                return reply(error.toString());
            }

            const audioBuffer = fs.readFileSync(outputPath);
            await conn.sendMessage(from, {
                audio: audioBuffer,
                mimetype: 'audio/mpeg'
            }, { quoted: anony });

            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
            await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
        });
    } catch (err) {
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
        reply(err.toString());
    }
} // <-- THIS was the missing closing brace

// --- TRACK IP ---
cmd({
    pattern: "trackip",
    react: "🌐",
    desc: "Track information about an IP address",
    category: "tools",
    use: ".trackip <ip>",
    filename: __filename
}, async (conn, mek, m, { from, reply, q, prefix, command }) => {
    if (!q) return reply(`*ᴇxᴀᴍᴘʟᴇ:* ${prefix + command} 112.90.150.204`);

    try {
        let res = await fetch(`https://ipwho.is/${q}`).then(r => r.json());

        const formatIPInfo = (info) => `
╭──⧼♛ *ɪᴘ ɪɴꜰᴏʀᴍᴀᴛɪᴏɴ*
│┃ ♛• ɪᴘ: ${info.ip || 'ɴ/ᴀ'}
│┃ ♛• sᴜᴄᴄᴇss: ${info.success || 'ɴ/ᴀ'}
│┃ ♛• ᴛʏᴘᴇ: ${info.type || 'ɴ/ᴀ'}
│┃ ♛• ᴄᴏɴᴛɪɴᴇɴᴛ: ${info.continent || 'ɴ/ᴀ'}
│┃ ♛• ᴄᴏɴᴛɪɴᴇɴᴛ ᴄᴏᴅᴇ: ${info.continent_code || 'ɴ/ᴀ'}
│┃ ♛• ᴄᴏᴜɴᴛʀʏ: ${info.country || 'ɴ/ᴀ'}
│┃ ♛• ᴄᴏᴜɴᴛʀʏ ᴄᴏᴅᴇ: ${info.country_code || 'ɴ/ᴀ'}
│┃ ♛• ʀᴇɢɪᴏɴ: ${info.region || 'ɴ/ᴀ'}
│┃ ♛• ʀᴇɢɪᴏɴ ᴄᴏᴅᴇ: ${info.region_code || 'ɴ/ᴀ'}
│┃ ♛• ᴄɪᴛʏ: ${info.city || 'ɴ/ᴀ'}
│┃ ♛• ʟᴀᴛɪᴛᴜᴅᴇ: ${info.latitude || 'ɴ/ᴀ'}
│┃ ♛• ʟᴏɴɢɪᴛᴜᴅᴇ: ${info.longitude || 'ɴ/ᴀ'}
│┃ ♛• ɪs ᴇᴜ: ${info.is_eu ? 'ʏᴇs' : 'ɴᴏ'}
│┃ ♛• ᴘᴏsᴛᴀʟ: ${info.postal || 'ɴ/ᴀ'}
│┃ ♛• ᴄᴀʟʟɪɴɢ ᴄᴏᴅᴇ: ${info.calling_code || 'ɴ/ᴀ'}
│┃ ♛• ᴄᴀᴘɪᴛᴀʟ: ${info.capital || 'ɴ/ᴀ'}
│┃ ♛• ʙᴏʀᴅᴇʀs: ${info.borders || 'ɴ/ᴀ'}
╰────────────────≽
╭──⧼♛ ꜰʟᴀɢ
│┃ ♛ - ɪᴍᴀɢᴇ: ${info.flag?.img || 'ɴ/ᴀ'}
│┃ ♛ - ᴇᴍᴏᴊɪ: ${info.flag?.emoji || 'ɴ/ᴀ'}
│┃ ♛ - ᴇᴍᴏᴊɪ ᴜɴɪᴄᴏᴅᴇ: ${info.flag?.emoji_unicode || 'ɴ/ᴀ'}
╰────────────────≽
╭──⧼♛• ᴄᴏɴɴᴇᴄᴛɪᴏɴ
│┃ ♛ - ᴀsɴ: ${info.connection?.asn || 'ɴ/ᴀ'}
│┃ ♛ - ᴏʀɢᴀɴɪᴢᴀᴛɪᴏɴ: ${info.connection?.org || 'ɴ/ᴀ'}
│┃ ♛ - ɪsᴘ: ${info.connection?.isp || 'ɴ/ᴀ'}
│┃ ♛ - ᴅᴏᴍᴀɪɴ: ${info.connection?.domain || 'ɴ/ᴀ'}
╰────────────────≽
╭──⧼♛• ᴛɪᴍᴇᴢᴏɴᴇ
│┃ ♛ - ɪᴅ: ${info.timezone?.id || 'ɴ/ᴀ'}
│┃ ♛ - ᴀʙʙʀᴇᴠɪᴀᴛɪᴏɴ: ${info.timezone?.abbr || 'ɴ/ᴀ'}
│┃ ♛ - ɪs ᴅsᴛ: ${info.timezone?.is_dst ? 'ʏᴇs' : 'ɴᴏ'}
│┃ ♛ - ᴏꜰꜰsᴇᴛ: ${info.timezone?.offset || 'ɴ/ᴀ'}
│┃ ♛ - ᴜᴛᴄ: ${info.timezone?.utc || 'ɴ/ᴀ'}
│┃ ♛ - ᴄᴜʀʀᴇɴᴛ ᴛɪᴍᴇ: ${info.timezone?.current_time || 'ɴ/ᴀ'}
╰────────────────≽
`;

        if (!res.success) throw new Error(`ɪᴘ ${q} ɴᴏᴛ ꜰᴏᴜɴᴅ!`);

        await conn.sendMessage(from, { location: { degreesLatitude: res.latitude, degreesLongitude: res.longitude } }, { ephemeralExpiration: 604800 });

        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        await delay(2000);
        reply(formatIPInfo(res));
    } catch (e) {
        reply(`ᴇʀʀᴏʀ: ᴜɴᴀʙʟᴇ ᴛᴏ ʀᴇᴛʀɪᴇᴠᴇ ᴅᴀᴛᴀ ꜰᴏʀ ɪᴘ ${q}`);
    }
});

// --- CEK ID CHANNEL ---
cmd({
    pattern: "cekidch",
    alias: ["idch"],
    react: "🆔",
    desc: "Get WhatsApp channel info from a link",
    category: "tools",
    use: ".cekidch <channel link>",
    filename: __filename
}, async (conn, mek, m, { from, reply, q }) => {
    if (!q) return reply("*ᴘʟᴇᴀsᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ᴡʜᴀᴛsᴀᴘᴘ ᴄʜᴀɴɴᴇʟ ʟɪɴᴋ*");
    if (!q.includes("https://whatsapp.com/channel/")) return reply("*ɪɴᴠᴀʟɪᴅ ᴄʜᴀɴɴᴇʟ ʟɪɴᴋ*");

    try {
        let result = q.split('https://whatsapp.com/channel/')[1];
        let res = await conn.newsletterMetadata("invite", result);

        let teks = `
╭──⧼♛ *ɴᴇᴍᴇsɪs ᴍᴅ ᴄʜ ɪᴅ*
│┃ ♛*ɪᴅ:* ${res.id}
│┃ ♛*ɴᴀᴍᴇ:* ${res.name}
│┃ ♛*ᴛᴏᴛᴀʟ ꜰᴏʟʟᴏᴡᴇʀs:* ${res.subscribers}
│┃ ♛*sᴛᴀᴛᴜs:* ${res.state}
│┃ ♛*ᴠᴇʀɪꜰɪᴇᴅ:* ${res.verification == "VERIFIED" ? "✅ ᴠᴇʀɪꜰɪᴇᴅ" : "❌ ɴᴏᴛ ᴠᴇʀɪꜰɪᴇᴅ"}
╰────────────────≽
`;
        return reply(teks);
    } catch (error) {
        console.error('ᴄʜᴀɴɴᴇʟ ɪɴꜰᴏ ᴇʀʀᴏʀ:', error);
        return reply("*ꜰᴀɪʟᴇᴅ ᴛᴏ ꜰᴇᴛᴄʜ ᴄʜᴀɴɴᴇʟ ɪɴꜰᴏʀᴍᴀᴛɪᴏɴ. ᴘʟᴇᴀsᴇ ᴄʜᴇᴄᴋ ᴛʜᴇ ʟɪɴᴋ ᴀɴᴅ ᴛʀʏ ᴀɢᴀɪɴ.*");
    }
});

// --- OBFUSCATE (with real implementation) ---
let JavaScriptObfuscator;
try {
    JavaScriptObfuscator = require('javascript-obfuscator');
} catch (_) {
    JavaScriptObfuscator = null;
}

async function obfuscateJS(inputPath) {
    if (!JavaScriptObfuscator) {
        throw new Error('Missing dependency: run `npm i javascript-obfuscator`');
    }
    const code = await fs.promises.readFile(inputPath, 'utf8');
    const result = JavaScriptObfuscator.obfuscate(code, {
        compact: true,
        controlFlowFlattening: true,
        controlFlowFlatteningThreshold: 0.75,
        deadCodeInjection: true,
        deadCodeInjectionThreshold: 0.4,
        disableConsoleOutput: false,
        identifierNamesGenerator: 'hexadecimal',
        renameGlobals: false,
        selfDefending: true,
        stringArray: true,
        stringArrayEncoding: ['base64'],
        stringArrayThreshold: 0.75,
        unicodeEscapeSequence: false
    });
    const outPath = `./tmp/obfuscated-${Date.now()}.js`;
    await fs.promises.writeFile(outPath, result.getObfuscatedCode(), 'utf8');
    return outPath;
}

cmd({
    pattern: "obfuscate",
    react: "🔒",
    desc: "Obfuscate a .js file",
    category: "tools",
    use: ".obfuscate [reply to .js file]",
    filename: __filename
}, async (conn, mek, m, { from, reply }) => {
    const tmpDir = './tmp';
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    const quoted = m.quoted ? m.quoted : null;
    const mime = quoted?.mimetype || "";

    if (!quoted || mime !== "application/javascript") {
        return conn.sendMessage(from, {
            text: "❌ *ᴇʀʀᴏʀ:* ʀᴇᴘʟʏ ᴛᴏ ᴀ `.js` ꜰɪʟᴇ ᴡɪᴛʜ `.ᴏʙꜰᴜsᴄᴀᴛᴇ`!"
        }, { quoted: anony });
    }

    try {
        const media = await quoted.download();
        const tempFile = `./tmp/original-${Date.now()}.js`;
        await fs.promises.writeFile(tempFile, media);

        conn.sendMessage(from, { text: "🔒 ᴏʙꜰᴜsᴄᴀᴛɪᴏɴ sᴛᴀʀᴛᴇᴅ..." }, { quoted: anony });

        const obfuscatedFile = await obfuscateJS(tempFile);

        await conn.sendMessage(from, { text: "✅ ᴏʙꜰᴜsᴄᴀᴛɪᴏɴ ᴄᴏᴍᴘʟᴇᴛᴇ! sᴇɴᴅɪɴɢ ꜰɪʟᴇ..." }, { quoted: anony });

        await conn.sendMessage(from, {
            document: fs.readFileSync(obfuscatedFile),
            mimetype: "text/javascript",
            fileName: "nemesis.js"
        });

        await fs.promises.unlink(tempFile).catch(() => {});
        await fs.promises.unlink(obfuscatedFile).catch(() => {});
    } catch (error) {
        conn.sendMessage(from, { text: `❌ *ᴇʀʀᴏʀ:* ${error.message}` }, { quoted: anony });
    }
});

// --- FILTER VCF ---
cmd({
    pattern: "filtervcf",
    alias: ["cleanvcf"],
    react: "📇",
    desc: "Filter a VCF file to only keep WhatsApp numbers",
    category: "tools",
    use: ".filtervcf [reply to .vcf file]",
    filename: __filename
}, async (conn, mek, m, { from, reply }) => {
    const quoted = m.quoted ? m.quoted : null;
    const mime = quoted?.mimetype || "";
    const normalizePhoneNumber = (phone) => (!phone || typeof phone !== 'string') ? null : phone.replace(/\D/g, '');

    if (!quoted || !(mime === "text/vcard" || mime === "text/x-vcard")) {
        return conn.sendMessage(from, {
            text: "❌ *ᴇʀʀᴏʀ:* ʀᴇᴘʟʏ ᴛᴏ ᴀ `.vcf` ꜰɪʟᴇ ᴡɪᴛʜ `.ꜰɪʟᴛᴇʀᴠᴄꜰ` ᴏʀ `.ᴄʟᴇᴀɴᴠᴄꜰ`!"
        }, { quoted: anony });
    }

    try {
        const media = await quoted.download();
        const vcfContent = media.toString('utf8');

        await conn.sendMessage(from, {
            text: "🔍 ꜰɪʟᴛᴇʀɪɴɢ ᴠᴄꜰ - ᴄʜᴇᴄᴋɪɴɢ ᴡʜᴀᴛsᴀᴘᴘ ɴᴜᴍʙᴇʀs, ᴛʜɪs ᴍᴀʏ ᴛᴀᴋᴇ ᴀ ᴡʜɪʟᴇ..."
        }, { quoted: anony });

        const vCards = vcfContent.split('END:VCARD').map(c => c.trim()).filter(c => c.length > 0);
        const validContacts = [];
        const invalidContacts = [];

        for (const card of vCards) {
            try {
                const telMatch = card.match(/TEL[^:]*:([^\n]+)/);
                if (!telMatch) continue;
                const phoneNumber = normalizePhoneNumber(telMatch[1].trim());
                if (!phoneNumber) continue;
                const result = await conn.onWhatsApp(`${phoneNumber}@s.whatsapp.net`);
                if (result.length > 0 && result[0].exists) validContacts.push(card);
                else invalidContacts.push(phoneNumber);
            } catch (error) {
                console.error('ᴄᴏɴᴛᴀᴄᴛ ᴇʀʀᴏʀ:', error);
            }
        }

        const filteredVcf = validContacts.join('\nEND:VCARD\n') + (validContacts.length > 0 ? '\nEND:VCARD' : '');

        await conn.sendMessage(from, {
            text:
                `╭──⧼♛ *ᴠᴄꜰ ꜰɪʟᴛᴇʀɪɴɢ ᴄᴏᴍᴘʟᴇᴛᴇ*\n\n` +
                `│┃ ♛ ᴛᴏᴛᴀʟ ᴄᴏɴᴛᴀᴄᴛs: ${vCards.length}\n` +
                `│┃ ♛ ᴠᴀʟɪᴅ ᴡʜᴀᴛsᴀᴘᴘ ᴄᴏɴᴛᴀᴄᴛs: ${validContacts.length}\n` +
                `│┃ ♛ ɴᴏɴ-ᴡʜᴀᴛsᴀᴘᴘ ɴᴜᴍʙᴇʀs ʀᴇᴍᴏᴠᴇᴅ: ${invalidContacts.length}\n\n` +
                `╰────────────────≽\nsᴇɴᴅɪɴɢ ꜰɪʟᴛᴇʀᴇᴅ ᴠᴄꜰ ꜰɪʟᴇ...`
        }, { quoted: anony });

        await conn.sendMessage(from, {
            document: Buffer.from(filteredVcf),
            mimetype: "text/x-vcard",
            fileName: "filtered_contacts.vcf"
        });
    } catch (error) {
        await conn.sendMessage(from, { text: `❌ *ᴇʀʀᴏʀ:* ${error.message}` }, { quoted: anony });
    }
});

// --- QR CODE ---
cmd({
    pattern: "qrcode",
    alias: ["qr"],
    react: "🔗",
    desc: "Generate a QR code for a text or URL",
    category: "tools",
    use: ".qrcode <text or url>",
    filename: __filename
}, async (conn, mek, m, { from, reply, q }) => {
    if (!q) return reply("ᴇɴᴛᴇʀ ᴛᴇxᴛ ᴏʀ ᴜʀʟ");
    try {
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(q)}&size=200x200`;
        await conn.sendMessage(from, {
            image: { url: qrUrl },
            caption: `ǫʀ ᴄᴏᴅᴇ ꜰᴏʀ: ${q}`
        }, { quoted: anony });
    } catch (error) {
        console.error('ǫʀ ᴇʀʀᴏʀ:', error);
        reply('ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ɢᴇɴᴇʀᴀᴛɪɴɢ ᴛʜᴇ ǫʀ ᴄᴏᴅᴇ.');
    }
});

// --- SS PHONE / PC / TABLET / WEB ---
const screenshots = [
    { pattern: "ssphone", alias: ["ssmobile2", "ssmobileweb"], endpoint: "ssphone", react: "📱", label: "ᴘʜᴏɴᴇ sᴄʀᴇᴇɴsʜᴏᴛ", icon: "📱" },
    { pattern: "sspc2", alias: ["ssdesktop2", "sscomputer"], endpoint: "sspc", react: "💻", label: "ᴘᴄ sᴄʀᴇᴇɴsʜᴏᴛ", icon: "💻" },
    { pattern: "sstab2", alias: ["sstablet"], endpoint: "sstab", react: "📟", label: "ᴛᴀʙʟᴇᴛ sᴄʀᴇᴇɴsʜᴏᴛ", icon: "📟" },
    { pattern: "ssweb2", alias: ["ssfull", "ssfullpage"], endpoint: "ssweb", react: "🌐", label: "ꜰᴜʟʟ ᴡᴇʙ sᴄʀᴇᴇɴsʜᴏᴛ", icon: "🌐" }
];

for (const s of screenshots) {
    cmd({
        pattern: s.pattern,
        alias: s.alias,
        react: s.react,
        desc: `Take a ${s.label} of a website`,
        category: "tools",
        use: `.${s.pattern} <url>`,
        filename: __filename
    }, async (conn, mek, m, { from, reply, q, prefix }) => {
        const url = (q || '').trim();
        if (!url) return reply(`📌 *ᴜsᴀɢᴇ:* ${prefix}${s.pattern} https://example.com`);
        if (!url.startsWith('http')) return reply("❌ ᴜʀʟ ᴍᴜsᴛ sᴛᴀʀᴛ ᴡɪᴛʜ http:// ᴏʀ https://");
        try {
            await conn.sendMessage(from, { react: { text: s.react, key: mek.key } });
            const apiUrl = `https://api.princetechn.com/api/tools/${s.endpoint}?apikey=prince&url=${encodeURIComponent(url)}`;
            await conn.sendMessage(from, {
                image: { url: apiUrl },
                caption: `${s.icon} *${s.label}*\n\n🔗 ${url}\n\n> ${global.wm || ''}`
            }, { quoted: anony });
            await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });
        } catch (error) {
            console.error(`${s.pattern} error:`, error);
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            reply(`❌ ᴇʀʀᴏʀ ɢᴇɴᴇʀᴀᴛɪɴɢ ${s.label}.`);
        }
    });
}

// --- LYRICS ---
cmd({
    pattern: "lyrics",
    alias: ["lyric"],
    react: "🎵",
    desc: "Get lyrics for a song",
    category: "tools",
    use: ".lyrics <song name>",
    filename: __filename
}, async (conn, mek, m, { from, reply, q, prefix }) => {
    if (!q) {
        return reply(`🎵 *ʟʏʀɪᴄs ꜰɪɴᴅᴇʀ*\n\nᴜsᴀɢᴇ: ${prefix}ʟʏʀɪᴄs <sᴏɴɢ ɴᴀᴍᴇ>\n\nᴇxᴀᴍᴘʟᴇs:\n• ${prefix}ʟʏʀɪᴄs sʜᴀᴘᴇ ᴏꜰ ʏᴏᴜ\n• ${prefix}ʟʏʀɪᴄs sᴇᴋᴋʟᴇ ᴅᴏᴡɴ ʙʏ ʙᴜɴɴɪᴇ ɢᴜɴᴛᴇʀ`);
    }

    try {
        await reply(`🔍 sᴇᴀʀᴄʜɪɴɢ ʟʏʀɪᴄs ꜰᴏʀ: *"${q}"*...`);
        const res = await fetch(`https://api.popcat.xyz/v2/lyrics?song=${encodeURIComponent(q)}`, { timeout: 15000 });
        if (!res.ok) throw new Error(`ᴀᴘɪ sᴛᴀᴛᴜs: ${res.status}`);
        const data = await res.json();

        if (data.error === true) return reply(`ɴᴏ ʟʏʀɪᴄs ꜰᴏᴜɴᴅ ꜰᴏʀ *"${q}"*`);
        if (!data.message || !data.message.lyrics) return reply(`ʟʏʀɪᴄs ɴᴏᴛ ᴀᴠᴀɪʟᴀʙʟᴇ ꜰᴏʀ *"${q}"*`);

        const { lyrics, artist = 'ᴜɴᴋɴᴏᴡɴ', title = q, image } = data.message;
        const cleanLyrics = lyrics.replace(/^\d+\s+Contributor.*?\n/i, '');
        let message = `🎵 *${title}*\n🎤 *ᴀʀᴛɪsᴛ:* ${artist}\n\n📖 *ʟʏʀɪᴄs:*\n\n${cleanLyrics}`;
        if (message.length > 3500) message = message.substring(0, 3500) + '\n\n*ʟʏʀɪᴄs ᴛʀᴜɴᴄᴀᴛᴇᴅ - sᴏɴɢ ᴛᴏᴏ ʟᴏɴɢ*';
        message += `\n\n${global.wm || ''}`;

        if (image && typeof image === 'string' && image.includes('http') && !image.includes('default_cover_image')) {
            try {
                await conn.sendMessage(from, { image: { url: image }, caption: `🎵 *${title}*\n🎤 *ᴀʀᴛɪsᴛ:* ${artist}` }, { quoted: anony });
                await new Promise(r => setTimeout(r, 300));
            } catch (e) { console.log('ɪᴍᴀɢᴇ ꜰᴀɪʟᴇᴅ:', e.message); }
        }

        await conn.sendMessage(from, { text: message }, { quoted: anony });
    } catch (error) {
        console.error('ʟʏʀɪᴄs ᴇʀʀᴏʀ:', error);
        let errMsg = `ᴇʀʀᴏʀ: ${error.message}`;
        if (error.message.includes('timeout')) errMsg = 'ʀᴇǫᴜᴇsᴛ ᴛɪᴍᴇᴅ ᴏᴜᴛ';
        if (error.message.includes('network')) errMsg = 'ɴᴇᴛᴡᴏʀᴋ ᴇʀʀᴏʀ';
        if (error.message.includes('status: 5')) errMsg = 'sᴇʀᴠɪᴄᴇ ᴜɴᴀᴠᴀɪʟᴀʙʟᴇ';
        reply(`${errMsg}\n\nᴛʀʏ ᴀɢᴀɪɴ ɪɴ ᴀ ꜰᴇᴡ ᴍᴏᴍᴇɴᴛs!`);
    }
});

// --- DEV ---
cmd({
    pattern: "dev",
    alias: ["developer"],
    react: "👨‍💻",
    desc: "Get the developer's contact",
    category: "info",
    use: ".dev",
    filename: __filename
}, async (conn, mek, m, { from }) => {
    try {
        const devInfo = { name: "ʀɪᴅᴢ ᴄᴏᴅᴇʀ", number: "256777205718", organization: "ᴘʀɪᴍᴇ ʀɪᴅᴢ", note: "ʙᴏᴛ ᴅᴇᴠᴇʟᴏᴘᴇʀ" };
        const vcard =
            `BEGIN:VCARD\nVERSION:3.0\nFN:${devInfo.name}\nORG:${devInfo.organization}\n` +
            `TEL;type=CELL;type=VOICE;waid=${devInfo.number}:+${devInfo.number}\nNOTE:${devInfo.note}\nEND:VCARD`;
        await conn.sendMessage(from, {
            contacts: { displayName: devInfo.name, contacts: [{ displayName: devInfo.name, vcard }] }
        }, { quoted: anony });
    } catch (e) {
        console.error('ᴅᴇᴠ ᴇʀʀᴏʀ:', e);
        m.reply('❌ ꜰᴀɪʟᴇᴅ ᴛᴏ ꜱᴇɴᴅ ᴅᴇᴠᴇʟᴏᴘᴇʀ ᴄᴏɴᴛᴀᴄᴛ.');
    }
});

// --- GITINFO ---
cmd({
    pattern: "gitinfo",
    react: "📊",
    desc: "Fetch GitHub user information",
    category: "info",
    use: ".gitinfo <username>",
    filename: __filename
}, async (conn, mek, m, { from, reply, q }) => {
    try {
        if (!q) return reply("ᴇxᴀᴍᴘʟᴇ: .ɢɪᴛɪɴꜰᴏ ᴜꜱᴇʀɴᴀᴍᴇ");
        const res = await fetch(`https://api.github.com/users/${q}`);
        const json = await res.json();
        reply(`📊 *ɢɪᴛʜᴜʙ ꜱᴛᴀᴛꜱ*\n\n👤 ᴜꜱᴇʀɴᴀᴍᴇ: ${json.login}\n📦 ᴘᴜʙʟɪᴄ ʀᴇᴘᴏꜱ: ${json.public_repos}\n👥 ꜰᴏʟʟᴏᴡᴇʀꜱ: ${json.followers}\n➡️ ꜰᴏʟʟᴏᴡɪɴɢ: ${json.following}\n⭐ ʙɪᴏ: ${json.bio || "ɴᴏɴᴇ"}\n🔗 ${json.html_url}`);
    } catch (e) {
        console.error('ɢɪᴛɪɴꜰᴏ ᴇʀʀᴏʀ:', e);
        reply("ᴇʀʀᴏʀ ꜰᴇᴛᴄʜɪɴɢ ɢɪᴛʜᴜʙ ꜱᴛᴀᴛꜱ.");
    }
});

// --- REPO ---
cmd({
    pattern: "repo",
    alias: ["source", "sourcecode", "repository"],
    react: "📦",
    desc: "Get info about the bot's GitHub repository",
    category: "info",
    use: ".repo",
    filename: __filename
}, async (conn, mek, m, { from, reply }) => {
    try {
        const repoOwner = "ridzcoder", repoName = "PRIME-RIDZ";
        const { data } = await axios.get(`https://api.github.com/repos/${repoOwner}/${repoName}`, {
            timeout: 5000, headers: { 'User-Agent': 'PRIME-RIDZ' }
        });
        const repoInfo = `
╭──⧼♛ *ᴘʀɪᴍᴇ ʀɪᴅᴢ ʀᴇᴘᴏsɪᴛᴏʀʏ* ♛⧽──≽
│┃ ♛ *ʀᴇᴘᴏsɪᴛᴏʀʏ*  : ${data.name || repoName}
│┃ ♛ *ᴏᴡɴᴇʀ*       : ${repoOwner}
│┃ ♛ *ᴅᴇsᴄʀɪᴘᴛɪᴏɴ* : ${data.description || 'ɴᴏ ᴅᴇsᴄʀɪᴘᴛɪᴏɴ'}
│
│┃ ♛ *sᴛᴀʀs*       : ${data.stargazers_count || 0}
│┃ ♛ *ꜰᴏʀᴋs*       : ${data.forks_count || 0}
│┃ ♛ *ɪssᴜᴇs*      : ${data.open_issues_count || 0}
│┃ ♛ *ᴡᴀᴛᴄʜᴇʀs*    : 👀 ${data.watchers_count || 0}
│┃ ♛ *ʟᴀɴɢᴜᴀɢᴇ*    : ${data.language || 'ɴ/ᴀ'}
│┃ ♛ *ʟɪᴄᴇɴsᴇ*     : ${data.license?.name || 'ɴᴏɴᴇ'}
│┃ ♛ *ᴄʀᴇᴀᴛᴇᴅ*     : ${new Date(data.created_at).toLocaleDateString()}
│┃ ♛ *ᴜᴘᴅᴀᴛᴇᴅ*     : ${new Date(data.updated_at).toLocaleDateString()}
│┃ ♛ *ɢɪᴛʜᴜʙ ʟɪɴᴋ* :
│┃ ♛ https://github.com/${repoOwner}/${repoName}
╰────────────────≽

> @${m.sender.split("@")[0]}`;

        await conn.sendMessage(from, {
            text: repoInfo,
            contextInfo: {
                mentionedJid: [m.sender],
                externalAdReply: {
                    title: "🌟 ᴘʀɪᴍᴇ ʀɪᴅᴢ ʀᴇᴘᴏsɪᴛᴏʀʏ",
                    body: `⭐ ${data.stargazers_count || 0} sᴛᴀʀs | 🍴 ${data.forks_count || 0} ꜰᴏʀᴋs`,
                    thumbnailUrl: 'https://files.catbox.moe/oyadfh.png',
                    sourceUrl: `https://github.com/${repoOwner}/${repoName}`,
                    mediaType: 1,
                    renderLargerThumbnail: true
                }
            }
        }, { quoted: anony });
    } catch (error) {
        console.error('ʀᴇᴘᴏ ᴇʀʀᴏʀ:', error);
        await conn.sendMessage(from, {
            text: `╭──⧼♛ *ᴘʀɪᴍᴇ ʀɪᴅᴢ ʀᴇᴘᴏ* ♛⧽──≽\n│┃ ♛ *ɢɪᴛʜᴜʙ* : https://github.com/ridzcoder/PRIME-RIDZ\n╰────────────────≽`,
            contextInfo: { mentionedJid: [m.sender] }
        }, { quoted: anony });
    }
});

// --- RELIGION (verse, hadith, torah, jewishquote, gita, gitaverse, dhammapada, zen, gurbani, tao, verse365) ---
cmd({ pattern: "verse", alias: ["dailyverse", "bibleverse"], react: "📖", desc: "Get a random Bible verse", category: "religion", use: ".verse", filename: __filename },
async (conn, mek, m, { reply }) => {
    try {
        const verses = ["John 3:16","Psalm 23:1","Philippians 4:13","Romans 8:28","Jeremiah 29:11","Proverbs 3:5-6","Isaiah 40:31","Matthew 11:28","Joshua 1:9","Psalm 46:10","1 Corinthians 13:4-7","Romans 12:2"];
        const random = verses[Math.floor(Math.random() * verses.length)];
        const data = await (await fetch(`https://bible-api.com/${encodeURIComponent(random)}`)).json();
        reply(`📖 *ᴠᴇʀsᴇ ᴏꜰ ᴛʜᴇ ᴅᴀʏ*\n\n*${data.reference}*\n\n${data.text}\n\n— ${data.translation_name}`);
    } catch { reply("ᴇʀʀᴏʀ ꜰᴇᴛᴄʜɪɴɢ ᴠᴇʀsᴇ."); }
});

cmd({ pattern: "hadith", alias: ["dailyhadith"], react: "🕌", desc: "Get a random Hadith", category: "religion", use: ".hadith", filename: __filename },
async (conn, mek, m, { from }) => {
    const hadiths = [
        "ᴛʜᴇ ʙᴇsᴛ ᴀᴍᴏɴɢ ʏᴏᴜ ᴀʀᴇ ᴛʜᴏsᴇ ᴡʜᴏ ʜᴀᴠᴇ ᴛʜᴇ ʙᴇsᴛ ᴍᴀɴɴᴇʀs. — sᴀʜɪʜ ʙᴜᴋʜᴀʀɪ",
        "ɴᴏɴᴇ ᴏꜰ ʏᴏᴜ ᴛʀᴜʟʏ ʙᴇʟɪᴇᴠᴇs ᴜɴᴛɪʟ ʜᴇ ʟᴏᴠᴇs ꜰᴏʀ ʜɪs ʙʀᴏᴛʜᴇʀ ᴡʜᴀᴛ ʜᴇ ʟᴏᴠᴇs ꜰᴏʀ ʜɪᴍsᴇʟꜰ. — sᴀʜɪʜ ʙᴜᴋʜᴀʀɪ",
        "ᴛʜᴇ sᴛʀᴏɴɢ ɪs ᴛʜᴇ ᴏɴᴇ ᴡʜᴏ ᴄᴏɴᴛʀᴏʟs ʜɪᴍsᴇʟꜰ ᴡʜɪʟᴇ ɪɴ ᴀɴɢᴇʀ. — sᴀʜɪʜ ʙᴜᴋʜᴀʀɪ",
        "ʜᴇ ᴡʜᴏ ᴅᴏᴇs ɴᴏᴛ ᴛʜᴀɴᴋ ᴘᴇᴏᴘʟᴇ, ᴅᴏᴇs ɴᴏᴛ ᴛʜᴀɴᴋ ᴀʟʟᴀʜ. — sᴜɴᴀɴ ᴀʙɪ ᴅᴀᴡᴜᴅ",
        "ᴀʟʟᴀʜ ɪs ɴᴏᴛ ᴋɪɴᴅ ᴛᴏ ʜɪᴍ ᴡʜᴏ ɪs ɴᴏᴛ ᴋɪɴᴅ ᴛᴏ ᴘᴇᴏᴘʟᴇ. — sᴀʜɪʜ ᴍᴜsʟɪᴍ"
    ];
    const random = hadiths[Math.floor(Math.random() * hadiths.length)];
    conn.sendMessage(from, { text: `🕌 *ʜᴀᴅɪᴛʜ ᴏꜰ ᴛʜᴇ ᴅᴀʏ*\n\n${random}` }, { quoted: anony });
});

cmd({ pattern: "torah", alias: ["tanakh"], react: "✡️", desc: "Read a Torah portion", category: "religion", use: ".torah <number 1-10>", filename: __filename },
async (conn, mek, m, { from, reply, q }) => {
    const parshiot = [
        { name: "ʙᴇʀᴇsʜɪᴛ", book: "ɢᴇɴᴇsɪs 1:1-6:8", summary: "ᴄʀᴇᴀᴛɪᴏɴ ᴏꜰ ᴛʜᴇ ᴡᴏʀʟᴅ, ᴀᴅᴀᴍ ᴀɴᴅ ᴇᴠᴇ." },
        { name: "ɴᴏᴀᴄʜ", book: "ɢᴇɴᴇsɪs 6:9-11:32", summary: "ɴᴏᴀʜ's ᴀʀᴋ, ᴛʜᴇ ꜰʟᴏᴏᴅ, ᴛʜᴇ ᴄᴏᴠᴇɴᴀɴᴛ." },
        { name: "ʟᴇᴄʜ-ʟᴇᴄʜᴀ", book: "ɢᴇɴᴇsɪs 12:1-17:27", summary: "ɢᴏᴅ ᴄᴀʟʟs ᴀʙʀᴀʜᴀᴍ." },
        { name: "ᴠᴀʏᴇɪʀᴀ", book: "ɢᴇɴᴇsɪs 18:1-22:24", summary: "sᴏᴅᴏᴍ ᴀɴᴅ ɢᴏᴍᴏʀʀᴀʜ." },
        { name: "ᴄʜᴀʏᴇɪ sᴀʀᴀʜ", book: "ɢᴇɴᴇsɪs 23:1-25:18", summary: "ᴛʜᴇ ᴅᴇᴀᴛʜ ᴏꜰ sᴀʀᴀʜ." },
        { name: "ᴛᴏʟᴅᴏᴛ", book: "ɢᴇɴᴇsɪs 25:19-28:9", summary: "ᴛʜᴇ ʙɪʀᴛʜ ᴏꜰ ᴊᴀᴄᴏʙ ᴀɴᴅ ᴇsᴀᴜ." },
        { name: "ᴠᴀʏᴇᴛᴢᴇɪ", book: "ɢᴇɴᴇsɪs 28:10-32:3", summary: "ᴊᴀᴄᴏʙ's ʟᴀᴅᴅᴇʀ." },
        { name: "ᴠᴀʏɪsʜʟᴀᴄʜ", book: "ɢᴇɴᴇsɪs 32:4-36:43", summary: "ᴊᴀᴄᴏʙ ᴡʀᴇsᴛʟᴇs ᴡɪᴛʜ ᴛʜᴇ ᴀɴɢᴇʟ." },
        { name: "ᴠᴀʏᴇsʜᴇᴠ", book: "ɢᴇɴᴇsɪs 37:1-40:23", summary: "ᴊᴏsᴇᴘʜ's ᴅʀᴇᴀᴍs." },
        { name: "ᴍɪᴋᴇᴛᴢ", book: "ɢᴇɴᴇsɪs 41:1-44:17", summary: "ᴊᴏsᴇᴘʜ ɪɴᴛᴇʀᴘʀᴇᴛs ᴘʜᴀʀᴀᴏʜ's ᴅʀᴇᴀᴍs." }
    ];
    if (!q) {
        return reply(`✡️ *ᴛᴏʀᴀʜ - ᴡᴇᴇᴋʟʏ ᴘᴏʀᴛɪᴏɴs*\n\n` + parshiot.map((p, i) => `${i + 1}. *${p.name}* — ${p.book}`).join('\n') + `\n\n📌 ᴜsᴇ: .ᴛᴏʀᴀʜ <ɴᴜᴍʙᴇʀ>`);
    }
    const idx = parseInt(q.trim()) - 1;
    if (isNaN(idx) || idx < 0 || idx >= parshiot.length) return reply("❌ ɪɴᴠᴀʟɪᴅ ɴᴜᴍʙᴇʀ (1-10).");
    const p = parshiot[idx];
    await conn.sendMessage(from, { text: `✡️ *ᴛᴏʀᴀʜ ᴘᴏʀᴛɪᴏɴ*\n\n📜 *${p.name}*\n📖 *ʀᴇᴀᴅɪɴɢ:* ${p.book}\n\n📝 *sᴜᴍᴍᴀʀʏ:*\n${p.summary}` }, { quoted: anony });
});

cmd({ pattern: "jewishquote", alias: ["torahquote"], react: "✡️", desc: "Random Jewish wisdom quote", category: "religion", use: ".jewishquote", filename: __filename },
async (conn, mek, m, { from }) => {
    const quotes = [
        "ᴡʜᴏ ɪs ᴡɪsᴇ? ʜᴇ ᴡʜᴏ ʟᴇᴀʀɴs ꜰʀᴏᴍ ᴇᴠᴇʀʏ ᴘᴇʀsᴏɴ. — ᴘɪʀᴋᴇɪ ᴀᴠᴏᴛ 4:1",
        "ɪᴛ ɪs ɴᴏᴛ ʏᴏᴜʀ ᴅᴜᴛʏ ᴛᴏ ꜰɪɴɪsʜ ᴛʜᴇ ᴡᴏʀᴋ. — ᴘɪʀᴋᴇɪ ᴀᴠᴏᴛ 2:16",
        "ᴛʜᴇ ᴡᴏʀʟᴅ sᴛᴀɴᴅs ᴏɴ ᴛʜʀᴇᴇ ᴛʜɪɴɢs: ᴛᴏʀᴀʜ, ᴡᴏʀsʜɪᴘ, ᴀɴᴅ ᴀᴄᴛs ᴏꜰ ʟᴏᴠɪɴɢ ᴋɪɴᴅɴᴇss. — ᴘɪʀᴋᴇɪ ᴀᴠᴏᴛ 1:2",
        "ʟᴏᴠᴇ ᴘᴇᴀᴄᴇ ᴀɴᴅ ᴘᴜʀsᴜᴇ ᴘᴇᴀᴄᴇ. — ᴘɪʀᴋᴇɪ ᴀᴠᴏᴛ 1:12"
    ];
    conn.sendMessage(from, { text: `✡️ *ᴊᴇᴡɪsʜ ᴡɪsᴅᴏᴍ*\n\n${quotes[Math.floor(Math.random() * quotes.length)]}` }, { quoted: anony });
});

cmd({ pattern: "gita", alias: ["bhagavadgita"], react: "🕉️", desc: "Read a chapter of the Bhagavad Gita", category: "religion", use: ".gita <number 1-18>", filename: __filename },
async (conn, mek, m, { from, reply, q }) => {
    const chapters = [
        { num: 1, name: "ᴀʀᴊᴜɴᴀ ᴠɪsᴀᴅᴀ ʏᴏɢᴀ", meaning: "ᴛʜᴇ ʏᴏɢᴀ ᴏꜰ ᴀʀᴊᴜɴᴀ's ᴅᴇᴊᴇᴄᴛɪᴏɴ", verses: 47 },
        { num: 2, name: "sᴀɴᴋʜʏᴀ ʏᴏɢᴀ", meaning: "ᴛʜᴇ ʏᴏɢᴀ ᴏꜰ ᴋɴᴏᴡʟᴇᴅɢᴇ", verses: 72 },
        { num: 3, name: "ᴋᴀʀᴍᴀ ʏᴏɢᴀ", meaning: "ᴛʜᴇ ʏᴏɢᴀ ᴏꜰ ᴀᴄᴛɪᴏɴ", verses: 43 },
        { num: 4, name: "ᴊɴᴀɴᴀ ᴋᴀʀᴍᴀ sᴀɴʏᴀsᴀ ʏᴏɢᴀ", meaning: "ᴋɴᴏᴡʟᴇᴅɢᴇ ᴀɴᴅ ᴀᴄᴛɪᴏɴ", verses: 42 },
        { num: 5, name: "ᴋᴀʀᴍᴀ sᴀɴʏᴀsᴀ ʏᴏɢᴀ", meaning: "ᴛʜᴇ ʏᴏɢᴀ ᴏꜰ ʀᴇɴᴜɴᴄɪᴀᴛɪᴏɴ", verses: 29 },
        { num: 6, name: "ᴅʜʏᴀɴᴀ ʏᴏɢᴀ", meaning: "ᴛʜᴇ ʏᴏɢᴀ ᴏꜰ ᴍᴇᴅɪᴛᴀᴛɪᴏɴ", verses: 47 },
        { num: 7, name: "ᴊɴᴀɴᴀ ᴠɪᴊɴᴀɴᴀ ʏᴏɢᴀ", meaning: "ᴋɴᴏᴡʟᴇᴅɢᴇ ᴀɴᴅ ᴡɪsᴅᴏᴍ", verses: 30 },
        { num: 8, name: "ᴀᴋsᴀʀᴀ ʙʀᴀʜᴍᴀ ʏᴏɢᴀ", meaning: "ɪᴍᴘᴇʀɪsʜᴀʙʟᴇ ʙʀᴀʜᴍᴀɴ", verses: 28 },
        { num: 9, name: "ʀᴀᴊᴀ ᴠɪᴅʏᴀ ʀᴀᴊᴀ ɢᴜʜʏᴀ ʏᴏɢᴀ", meaning: "ʀᴏʏᴀʟ ᴋɴᴏᴡʟᴇᴅɢᴇ", verses: 34 },
        { num: 10, name: "ᴠɪʙʜᴜᴛɪ ʏᴏɢᴀ", meaning: "ᴅɪᴠɪɴᴇ ɢʟᴏʀɪᴇs", verses: 42 },
        { num: 11, name: "ᴠɪsᴠᴀʀᴜᴘᴀ ᴅᴀʀsᴀɴᴀ ʏᴏɢᴀ", meaning: "ᴛʜᴇ ᴜɴɪᴠᴇʀsᴀʟ ꜰᴏʀᴍ", verses: 55 },
        { num: 12, name: "ʙʜᴀᴋᴛɪ ʏᴏɢᴀ", meaning: "ᴛʜᴇ ʏᴏɢᴀ ᴏꜰ ᴅᴇᴠᴏᴛɪᴏɴ", verses: 20 },
        { num: 13, name: "ᴋsᴇᴛʀᴀ ᴋsᴇᴛʀᴀᴊɴᴀ ᴠɪʙʜᴀɢᴀ ʏᴏɢᴀ", meaning: "ᴛʜᴇ ꜰɪᴇʟᴅ ᴀɴᴅ ᴋɴᴏᴡᴇʀ", verses: 35 },
        { num: 14, name: "ɢᴜɴᴀᴛʀᴀʏᴀ ᴠɪʙʜᴀɢᴀ ʏᴏɢᴀ", meaning: "ᴛʜʀᴇᴇ ɢᴜɴᴀs", verses: 27 },
        { num: 15, name: "ᴘᴜʀᴜsᴏᴛᴛᴀᴍᴀ ʏᴏɢᴀ", meaning: "sᴜᴘʀᴇᴍᴇ ᴘᴇʀsᴏɴ", verses: 20 },
        { num: 16, name: "ᴅᴀɪᴠᴀsᴜʀᴀ sᴀᴍᴘᴀᴅ ᴠɪʙʜᴀɢᴀ ʏᴏɢᴀ", meaning: "ᴅɪᴠɪɴᴇ ᴀɴᴅ ᴅᴇᴍᴏɴɪᴄ ɴᴀᴛᴜʀᴇs", verses: 24 },
        { num: 17, name: "sʀᴀᴅᴅʜᴀᴛʀᴀʏᴀ ᴠɪʙʜᴀɢᴀ ʏᴏɢᴀ", meaning: "ᴛʜʀᴇᴇꜰᴏʟᴅ ꜰᴀɪᴛʜ", verses: 28 },
        { num: 18, name: "ᴍᴏᴋsᴀ sᴀɴʏᴀsᴀ ʏᴏɢᴀ", meaning: "ʟɪʙᴇʀᴀᴛɪᴏɴ", verses: 78 }
    ];
    if (!q) return reply(`🕉️ *ʙʜᴀɢᴀᴠᴀᴅ ɢɪᴛᴀ*\n\n` + chapters.map(c => `*${c.num}. ${c.name}* (${c.verses} ᴠᴇʀsᴇs)`).join('\n') + `\n\n📌 ᴜsᴇ: .ɢɪᴛᴀ <ɴᴜᴍʙᴇʀ>`);
    const num = parseInt(q.trim());
    if (isNaN(num) || num < 1 || num > 18) return reply("❌ ɪɴᴠᴀʟɪᴅ ᴄʜᴀᴘᴛᴇʀ (1-18).");
    const ch = chapters[num - 1];
    await conn.sendMessage(from, { text: `🕉️ *ʙʜᴀɢᴀᴠᴀᴅ ɢɪᴛᴀ - ᴄʜᴀᴘᴛᴇʀ ${ch.num}*\n\n📖 *${ch.name}*\n💡 *ᴍᴇᴀɴɪɴɢ:* ${ch.meaning}\n📊 *ᴠᴇʀsᴇs:* ${ch.verses}` }, { quoted: anony });
});

cmd({ pattern: "gitaverse", alias: ["krishnaquote"], react: "🕉️", desc: "Random Bhagavad Gita verse", category: "religion", use: ".gitaverse", filename: __filename },
async (conn, mek, m, { from }) => {
    const verses = [
        { ref: "2.47", text: "ʏᴏᴜ ʜᴀᴠᴇ ᴀ ʀɪɢʜᴛ ᴛᴏ ᴘᴇʀꜰᴏʀᴍ ʏᴏᴜʀ ᴅᴜᴛɪᴇs, ʙᴜᴛ ɴᴏᴛ ᴛᴏ ᴛʜᴇ ꜰʀᴜɪᴛs." },
        { ref: "2.20", text: "ᴛʜᴇ sᴏᴜʟ ɪs ɴᴇɪᴛʜᴇʀ ʙᴏʀɴ ɴᴏʀ ᴅɪᴇs." },
        { ref: "4.7-8", text: "ᴡʜᴇɴᴇᴠᴇʀ ʀɪɢʜᴛᴇᴏᴜsɴᴇss ᴅᴇᴄʟɪɴᴇs, ɪ ᴍᴀɴɪꜰᴇsᴛ ᴍʏsᴇʟꜰ." },
        { ref: "6.5", text: "ᴇʟᴇᴠᴀᴛᴇ ʏᴏᴜʀsᴇʟꜰ ᴛʜʀᴏᴜɢʜ ᴛʜᴇ ᴘᴏᴡᴇʀ ᴏꜰ ʏᴏᴜʀ ᴍɪɴᴅ." },
        { ref: "18.66", text: "sᴜʀʀᴇɴᴅᴇʀ ᴜɴᴛᴏ ᴍᴇ ᴀʟᴏɴᴇ; ɪ sʜᴀʟʟ ʟɪʙᴇʀᴀᴛᴇ ʏᴏᴜ." }
    ];
    const v = verses[Math.floor(Math.random() * verses.length)];
    conn.sendMessage(from, { text: `🕉️ *ʙʜᴀɢᴀᴠᴀᴅ ɢɪᴛᴀ ${v.ref}*\n\n${v.text}` }, { quoted: anony });
});

cmd({ pattern: "dhammapada", alias: ["buddhaquote"], react: "☸️", desc: "Random Dhammapada verse", category: "religion", use: ".dhammapada", filename: __filename },
async (conn, mek, m, { from }) => {
    const verses = [
        { ref: "1:1", text: "ᴀʟʟ ᴍᴇɴᴛᴀʟ ᴘʜᴇɴᴏᴍᴇɴᴀ ʜᴀᴠᴇ ᴍɪɴᴅ ᴀs ꜰᴏʀᴇʀᴜɴɴᴇʀ." },
        { ref: "1:5", text: "ʜᴀᴛʀᴇᴅ ɪs ɴᴇᴠᴇʀ ᴀᴘᴘᴇᴀsᴇᴅ ʙʏ ʜᴀᴛʀᴇᴅ." },
        { ref: "2:1", text: "ᴡᴀᴋᴇꜰᴜʟɴᴇss ɪs ᴛʜᴇ ᴡᴀʏ ᴛᴏ ʟɪꜰᴇ." },
        { ref: "5:1", text: "ʙᴇᴛᴛᴇʀ ᴛʜᴀɴ ᴀ ᴛʜᴏᴜsᴀɴᴅ ʜᴏʟʟᴏᴡ ᴡᴏʀᴅs ɪs ᴏɴᴇ ᴡᴏʀᴅ ᴛʜᴀᴛ ʙʀɪɴɢs ᴘᴇᴀᴄᴇ." }
    ];
    const v = verses[Math.floor(Math.random() * verses.length)];
    conn.sendMessage(from, { text: `☸️ *ᴅʜᴀᴍᴍᴀᴘᴀᴅᴀ ${v.ref}*\n\n${v.text}\n\n_— ᴛʜᴇ ʙᴜᴅᴅʜᴀ_` }, { quoted: anony });
});

cmd({ pattern: "zen", alias: ["zenquote"], react: "☸️", desc: "Random Zen quote", category: "religion", use: ".zen", filename: __filename },
async (conn, mek, m, { from }) => {
    try {
        const data = await (await fetch('https://zenquotes.io/api/random')).json();
        conn.sendMessage(from, { text: `☸️ *ᴢᴇɴ ᴡɪsᴅᴏᴍ*\n\n"${data[0].q}"\n\n— ${data[0].a}` }, { quoted: anony });
    } catch {
        const fallbacks = [
            "sɪᴛᴛɪɴɢ ǫᴜɪᴇᴛʟʏ, ᴅᴏɪɴɢ ɴᴏᴛʜɪɴɢ, sᴘʀɪɴɢ ᴄᴏᴍᴇs. — ʙᴀsʜᴏ",
            "ᴛʜᴇ ᴏʙsᴛᴀᴄʟᴇ ɪs ᴛʜᴇ ᴘᴀᴛʜ. — ᴢᴇɴ ᴘʀᴏᴠᴇʀʙ"
        ];
        conn.sendMessage(from, { text: `☸️ *ᴢᴇɴ ᴡɪsᴅᴏᴍ*\n\n${fallbacks[Math.floor(Math.random() * fallbacks.length)]}` }, { quoted: anony });
    }
});

cmd({ pattern: "gurbani", alias: ["sikhquote"], react: "🪯", desc: "Random Sikh wisdom quote", category: "religion", use: ".gurbani", filename: __filename },
async (conn, mek, m, { from }) => {
    const quotes = [
        "ᴏɴᴇ ᴡʜᴏ ᴘʀᴀᴄᴛɪᴄᴇs ᴛʀᴜᴛʜ, ᴄᴏɴᴛᴇɴᴛᴍᴇɴᴛ, ᴄᴏᴍᴘᴀssɪᴏɴ — ʀᴇᴀʟɪᴢᴇ ᴛʜᴇ ᴏɴᴇ. — ɢᴜʀᴜ ɢʀᴀɴᴛʜ sᴀʜɪʙ",
        "ᴛʀᴜᴛʜ ɪs ʜɪɢʜᴇʀ ᴛʜᴀɴ ᴇᴠᴇʀʏᴛʜɪɴɢ; ʙᴜᴛ ʜɪɢʜᴇʀ sᴛɪʟʟ ɪs ᴛʀᴜᴛʜꜰᴜʟ ʟɪᴠɪɴɢ. — ɢᴜʀᴜ ɴᴀɴᴀᴋ",
        "ʜᴇ ᴡʜᴏ sᴇʀᴠᴇs ᴏᴛʜᴇʀs ᴡɪᴛʜ ʟᴏᴠᴇ ɪs ᴛʜᴇ ᴛʀᴜᴇ sɪᴋʜ. — ɢᴜʀᴜ ɢʀᴀɴᴛʜ sᴀʜɪʙ"
    ];
    conn.sendMessage(from, { text: `🪯 *ɢᴜʀʙᴀɴɪ / sɪᴋʜ ᴡɪsᴅᴏᴍ*\n\n${quotes[Math.floor(Math.random() * quotes.length)]}` }, { quoted: anony });
});

cmd({ pattern: "tao", alias: ["taoteching", "laotzu"], react: "☯️", desc: "Random Tao Te Ching verse", category: "religion", use: ".tao", filename: __filename },
async (conn, mek, m, { from }) => {
    const verses = [
        "ᴛʜᴇ ᴛᴀᴏ ᴛʜᴀᴛ ᴄᴀɴ ʙᴇ ᴛᴏʟᴅ ɪs ɴᴏᴛ ᴛʜᴇ ᴇᴛᴇʀɴᴀʟ ᴛᴀᴏ. — ᴄʜ. 1",
        "ᴛʜᴇ ʜɪɢʜᴇsᴛ ɢᴏᴏᴅ ɪs ʟɪᴋᴇ ᴡᴀᴛᴇʀ. — ᴄʜ. 8",
        "ᴀ ᴊᴏᴜʀɴᴇʏ ᴏꜰ ᴀ ᴛʜᴏᴜsᴀɴᴅ ᴍɪʟᴇs ʙᴇɢɪɴs ᴡɪᴛʜ ᴀ sɪɴɢʟᴇ sᴛᴇᴘ. — ᴄʜ. 64",
        "ᴋɴᴏᴡɪɴɢ ᴏᴛʜᴇʀs ɪs ɪɴᴛᴇʟʟɪɢᴇɴᴄᴇ; ᴋɴᴏᴡɪɴɢ ʏᴏᴜʀsᴇʟꜰ ɪs ᴛʀᴜᴇ ᴡɪsᴅᴏᴍ. — ᴄʜ. 33"
    ];
    conn.sendMessage(from, { text: `☯️ *ᴛᴀᴏɪsᴛ ᴡɪsᴅᴏᴍ*\n\n${verses[Math.floor(Math.random() * verses.length)]}` }, { quoted: anony });
});

cmd({ pattern: "verse365", alias: ["inspiration"], react: "🌍", desc: "Daily spiritual wisdom from various traditions", category: "religion", use: ".verse365", filename: __filename },
async (conn, mek, m, { from }) => {
    const sources = [
        { name: "🕉️ ʙʜᴀɢᴀᴠᴀᴅ ɢɪᴛᴀ", text: "sᴇᴛ ᴛʜʏ ʜᴇᴀʀᴛ ᴜᴘᴏɴ ᴛʜʏ ᴡᴏʀᴋ, ʙᴜᴛ ɴᴇᴠᴇʀ ᴏɴ ɪᴛs ʀᴇᴡᴀʀᴅ." },
        { name: "✡️ ᴘɪʀᴋᴇɪ ᴀᴠᴏᴛ", text: "ᴡʜᴏ ɪs ᴡɪsᴇ? ʜᴇ ᴡʜᴏ ʟᴇᴀʀɴs ꜰʀᴏᴍ ᴇᴠᴇʀʏ ᴘᴇʀsᴏɴ." },
        { name: "✝️ ʙɪʙʟᴇ", text: "ɪ ᴄᴀɴ ᴅᴏ ᴀʟʟ ᴛʜɪɴɢs ᴛʜʀᴏᴜɢʜ ᴄʜʀɪsᴛ ᴡʜᴏ sᴛʀᴇɴɢᴛʜᴇɴs ᴍᴇ. — ᴘʜɪʟ. 4:13" },
        { name: "☪️ ǫᴜʀᴀɴ", text: "ᴠᴇʀɪʟʏ, ᴡɪᴛʜ ʜᴀʀᴅsʜɪᴘ ᴄᴏᴍᴇs ᴇᴀsᴇ. — 94:6" },
        { name: "☸️ ᴅʜᴀᴍᴍᴀᴘᴀᴅᴀ", text: "ʙᴇᴛᴛᴇʀ ᴛʜᴀɴ ᴀ ᴛʜᴏᴜsᴀɴᴅ ʜᴏʟʟᴏᴡ ᴡᴏʀᴅs ɪs ᴏɴᴇ ᴡᴏʀᴅ ᴛʜᴀᴛ ʙʀɪɴɢs ᴘᴇᴀᴄᴇ." },
        { name: "☯️ ᴛᴀᴏ ᴛᴇ ᴄʜɪɴɢ", text: "ᴀ ᴊᴏᴜʀɴᴇʏ ᴏꜰ ᴀ ᴛʜᴏᴜsᴀɴᴅ ᴍɪʟᴇs ʙᴇɢɪɴs ᴡɪᴛʜ ᴀ sɪɴɢʟᴇ sᴛᴇᴘ." }
    ];
    const s = sources[Math.floor(Math.random() * sources.length)];
    conn.sendMessage(from, { text: `🌍 *ᴅᴀɪʟʏ sᴘɪʀɪᴛᴜᴀʟ ᴡɪsᴅᴏᴍ*\n\n*${s.name}*\n\n"${s.text}"` }, { quoted: anony });
});

// --- WORDOFDAY / HISTORYFACT ---
cmd({ pattern: "wordofday", react: "📖", desc: "Random word of the day", category: "fun", use: ".wordofday", filename: __filename },
async (conn, mek, m, { reply }) => {
    try {
        const json = await (await fetch("https://random-word-api.herokuapp.com/word")).json();
        reply(`📖 *ᴡᴏʀᴅ ᴏꜰ ᴛʜᴇ ᴅᴀʏ*\n${json[0]}`);
    } catch { reply("ᴇʀʀᴏʀ ꜰᴇᴛᴄʜɪɴɢ ᴡᴏʀᴅ."); }
});

cmd({ pattern: "historyfact", react: "📜", desc: "Random history fact", category: "fun", use: ".historyfact", filename: __filename },
async (conn, mek, m, { reply }) => {
    try {
        const json = await (await fetch("https://history.muffinlabs.com/date")).json();
        const fact = json.data.Events[Math.floor(Math.random() * json.data.Events.length)];
        reply(`📜 *ʜɪꜱᴛᴏʀʏ ꜰᴀᴄᴛ*\n${fact.year} - ${fact.text}`);
    } catch { reply("ᴇʀʀᴏʀ ꜰᴇᴛᴄʜɪɴɢ ʜɪꜱᴛᴏʀʏ."); }
});


// --- SUPPORT / FAMILY / RIDZCODER ---
cmd({ pattern: "support", react: "🌋", desc: "Get support info", category: "info", use: ".support", filename: __filename },
async (conn, mek, m, { from }) => {
    const dec = `
⟣──────────────────⟢
▧ *ᴄʀᴇᴀᴛᴏʀ* : *ʀɪᴅᴢ ᴄᴏᴅᴇʀ x ᴋᴇᴠɪɴ ᴛᴇᴄʜ*
▧ *ᴍᴏᴅᴇ* : *ᴘᴜʙʟɪᴄ*
▧ *ᴘʀᴇꜰɪx* : .
▧ *ᴠᴇʀꜱɪᴏɴ* : *2.1.0*

⟣──────────────────⟢

> ɴᴇᴍᴇꜱɪꜱ ᴍᴅ
https://github.com/Ridzcoder/PRIME-RIDZ

⟣──────────────────⟢
> ᴄʜᴀɴɴᴇʟ
https://whatsapp.com/channel/0029Vb73EYZFXUujAoHFor1i

> ɢʀᴏᴜᴘ
https://chat.whatsapp.com/KQzM54TU1LmGwIGc2TcOGi?mode=gi_t
`;
    await conn.sendMessage(from, {
        image: { url: "https://files.catbox.moe/oyadfh.png" },
        caption: dec,
        contextInfo: {
            mentionedJid: [m.sender],
            forwardingScore: 999, isForwarded: true,
            forwardedNewsletterMessageInfo: {
                newsletterJid: "120363404529319592@newsletter",
                newsletterName: "ᴀɪʀʙʏᴛᴇ ꜱʏɴᴇʀɢᴇᴛɪᴄ ʟᴀʙꜱ🌋",
                serverMessageId: 143
            }
        }
    }, { quoted: anony });
});

cmd({ pattern: "family", react: "🌋", desc: "Show the bot family", category: "info", use: ".family", filename: __filename },
async (conn, mek, m, { from }) => {
    const caption = `
      *╭┈──[ • ʀɪᴅᴢ ᴛᴇᴄʜ ꜰᴀᴍɪʟʏ • ]───•*
      *│  ◦* *▢➠ ᴋᴇʟᴠɪɴ ᴛᴇᴄʜ*
      *│  ◦* *▢➠ ᴊᴇꜱꜱɪᴇ*
      *│  ◦* *▢➠ ʟɪᴠɪᴇ*
      *│  ◦* *▢➠ ᴘʀᴏꜱꜱɪᴇ*
      *│  ◦* *▢➠ ᴀɴᴅ ʏᴏᴜ*
      *╰┈───────────────•*
      ꜰᴀᴍɪʟʏ ɪꜱ ɴᴏᴛ ᴀʙᴏᴜᴛ ʙʟᴏᴏᴅ, ɪᴛ'ꜱ ᴀʙᴏᴜᴛ ᴛʜᴇ ᴘᴇᴏᴘʟᴇ ᴡʜᴏ ᴄʜᴏᴏꜱᴇ ᴛᴏ ʙᴇ ᴛʜᴇʀᴇ ꜰᴏʀ ʏᴏᴜ 🤗
`;
    await conn.sendMessage(from, {
        image: { url: "https://files.catbox.moe/oyadfh.png" },
        caption,
        contextInfo: {
            mentionedJid: [m.sender],
            forwardingScore: 999, isForwarded: true,
            forwardedNewsletterMessageInfo: {
                newsletterJid: "120363404529319592@newsletter",
                newsletterName: "ᴘʀɪᴍᴇ ʀɪᴅᴢ🪀",
                serverMessageId: 143
            }
        }
    }, { quoted: anony });
});

cmd({ pattern: "ridzcoder", alias: ["kayiza"], react: "🌋", desc: "Get info about the developer", category: "info", use: ".ridzcoder", filename: __filename },
async (conn, mek, m, { from }) => {
    const caption = `
╭━━〔 ʀɪᴅᴢ ᴄᴏᴅᴇʀ ɪɴꜰᴏ〕━━┈⊷
┃★ •ʜᴇʟʟᴏ ᴛʜᴇʀᴇ 👋, ɪ ᴀᴍ ʀɪᴅᴢ ᴄᴏᴅᴇʀ.
┃★ •ɪ ʟᴀᴜɢʜ ᴀᴛ ᴇᴠᴇʀʏᴏɴᴇ ᴡʜᴏ ʟᴀᴜɢʜꜱ ᴀᴛ ᴍᴇ.
┃★ •ɪꜰ ʏᴏᴜ ꜱᴛᴀɴᴅ ʙᴇʜɪɴᴅ ᴍᴇ, ɪ ᴘʀᴏᴛᴇᴄᴛ ʏᴏᴜ.
┃★ •ɪꜰ ʏᴏᴜ ꜱᴛᴀɴᴅ ʙᴇꜱɪᴅᴇ ᴍᴇ, ɪ ʀᴇꜱᴘᴇᴄᴛ ʏᴏᴜ.
┃★ •ɪꜰ ʏᴏᴜ ꜱᴛᴀɴᴅ ᴀɢᴀɪɴꜱᴛ ᴍᴇ, ɪ ꜱʜᴏᴡ ɴᴏ ᴍᴇʀᴄʏ.
╰━━━━━━━━━━━━━━━┈⊷

> *ᴀ ꜱɪᴍᴘʟᴇ ᴡʜᴀᴛꜱᴀᴘᴘ ᴅᴇᴠᴇʟᴏᴘᴇʀ*
`;
    await conn.sendMessage(from, {
        image: { url: "https://files.catbox.moe/oyadfh.png" },
        caption,
        contextInfo: {
            mentionedJid: [m.sender],
            forwardingScore: 999, isForwarded: true,
            forwardedNewsletterMessageInfo: {
                newsletterJid: "120363404529319592@newsletter",
                newsletterName: "ᴘʀɪᴍᴇ ʀɪᴅᴢ🪀",
                serverMessageId: 999
            }
        }
    }, { quoted: anony });
});

// --- LOVE TEST ---
cmd({ pattern: "lovetest", alias: ["love"], react: "🍹", desc: "Calculate love percentage between two users", category: "fun", use: ".lovetest @user1 @user2", filename: __filename },
async (conn, mek, m, { from, reply, args }) => {
    if (args.length < 2) return reply("ᴛᴀɢ ᴛᴡᴏ ᴜꜱᴇʀꜱ! ᴇxᴀᴍᴘʟᴇ: .ʟᴏᴠᴇᴛᴇꜱᴛ @ᴜꜱᴇʀ1 @ᴜꜱᴇʀ2");
    const user1 = args[0].replace("@", "") + "@s.whatsapp.net";
    const user2 = args[1].replace("@", "") + "@s.whatsapp.net";
    const lovePercent = Math.floor(Math.random() * 100) + 1;
    const messages = [
        { range: [90, 100], text: "💖 *ᴍᴀᴛᴄʜ ᴍᴀᴅᴇ ɪɴ ʜᴇᴀᴠᴇɴ!*" },
        { range: [75, 89], text: "😍 *ꜱᴛʀᴏɴɢ ᴄᴏɴɴᴇᴄᴛɪᴏɴ!*" },
        { range: [50, 74], text: "😊 *ɢᴏᴏᴅ ᴄᴏᴍᴘᴀᴛɪʙɪʟɪᴛʏ!*" },
        { range: [30, 49], text: "🤔 *ɪᴛ'ꜱ ᴄᴏᴍᴘʟɪᴄᴀᴛᴇᴅ!*" },
        { range: [10, 29], text: "😅 *ɴᴏᴛ ᴛʜᴇ ʙᴇꜱᴛ ᴍᴀᴛᴄʜ!*" },
        { range: [1, 9], text: "💔 *ᴜʜ-ᴏʜʜ*" }
    ];
    const msg = messages.find(x => lovePercent >= x.range[0] && lovePercent <= x.range[1]).text;
    const message = `💘 *ʟᴏᴠᴇ ᴄᴏᴍᴘᴀᴛɪʙɪʟɪᴛʏ ᴛᴇꜱᴛ* 💘\n\n❤️ *@${user1.split("@")[0]}* + *@${user2.split("@")[0]}* = *${lovePercent}%*\n${msg}`;
    await conn.sendMessage(from, { text: message, mentions: [user1, user2] }, { quoted: anony });
});

// --- JOKE ---
cmd({ pattern: "joke", alias: ["jokes", "funny"], react: "🍹", desc: "Get a random joke", category: "fun", use: ".joke", filename: __filename },
async (conn, mek, m, { from, reply }) => {
    try {
        const json = await (await fetch("https://official-joke-api.appspot.com/random_joke")).json();
        await conn.sendMessage(from, { text: `${json.setup}\n\n${json.punchline}` }, { quoted: anony });
    } catch { reply('ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ.'); }
});

// --- FUN API WRAPPER ---
const funApis = [
    { pattern: "valentine", alias: ["valentines","vday"], endpoint: "valentines" },
    { pattern: "advice", alias: ["advicegenerator","lifetips"], endpoint: "advice" },
    { pattern: "motivation", alias: ["motivate","inspire"], endpoint: "motivation" }
];
for (const f of funApis) {
    cmd({
        pattern: f.pattern, alias: f.alias, react: "🍹",
        desc: `Get a random ${f.pattern}`, category: "fun", use: `.${f.pattern}`, filename: __filename
    }, async (conn, mek, m, { reply }) => {
        try {
            const r = await axios.get(`https://api.princetechn.com/api/fun/${f.endpoint}?apikey=prince`);
            if (r.data?.success && r.data?.result) reply(r.data.result);
            else reply('ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ.');
        } catch { reply('ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ.'); }
    });
}

// --- CHARACTER ---
cmd({ pattern: "character", alias: ["char","personality"], react: "🍹", desc: "Check a random character trait of a user", category: "fun", use: ".character @user", filename: __filename },
async (conn, mek, m, { from, reply, isGroup }) => {
    if (!isGroup) return reply("ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ ᴄᴀɴ ᴏɴʟʏ ʙᴇ ᴜꜱᴇᴅ ɪɴ ɢʀᴏᴜᴘꜱ.");
    const mentioned = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (!mentioned) return reply("ᴘʟᴇᴀꜱᴇ ᴍᴇɴᴛɪᴏɴ ᴀ ᴜꜱᴇʀ.");
    const traits = ["ꜱɪɢᴍᴀ","ɢᴇɴᴇʀᴏᴜꜱ","ɢʀᴜᴍᴘʏ","ᴏᴠᴇʀᴄᴏɴꜰɪᴅᴇɴᴛ","ᴏʙᴇᴅɪᴇɴᴛ","ɢᴏᴏᴅ","ꜱɪᴍᴘ","ᴋɪɴᴅ","ᴘᴀᴛɪᴇɴᴛ","ᴄᴏᴏʟ","ʜᴇʟᴘꜰᴜʟ","ʙʀɪʟʟɪᴀɴᴛ","ꜱɪɴɢʟᴇ","ʜᴏᴛ","ᴄᴜᴛᴇ"];
    const trait = traits[Math.floor(Math.random() * traits.length)];
    await conn.sendMessage(from, { text: `ᴄʜᴀʀᴀᴄᴛᴇʀ ᴏꜰ @${mentioned.split("@")[0]} ɪꜱ *${trait}* 🔥⚡`, mentions: [mentioned] }, { quoted: anony });
});

// --- TRIVIA ---
cmd({ pattern: "trivia", react: "🍹", desc: "Get a random trivia question", category: "fun", use: ".trivia", filename: __filename },
async (conn, mek, m, { from, reply }) => {
    try {
        const json = await (await fetch("https://opentdb.com/api.php?amount=1")).json();
        const { question, correct_answer } = json.results[0];
        await conn.sendMessage(from, { text: `ǫᴜᴇꜱᴛɪᴏɴ: ${question}\n\nꜱᴇɴᴅ ᴛʜᴇ ᴀɴꜱᴡᴇʀ ᴀꜰᴛᴇʀ 20 ꜱᴇᴄᴏɴᴅꜱ` }, { quoted: anony });
        setTimeout(async () => { await conn.sendMessage(from, { text: `ᴀɴꜱᴡᴇʀ: ${correct_answer}` }); }, 20000);
    } catch { reply('ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ.'); }
});

// --- TRUTH DETECTOR ---
cmd({ pattern: "truthdetector", alias: ["liedetector"], react: "🍹", desc: "Detect if a quoted message is a lie", category: "fun", use: ".truthdetector [reply]", filename: __filename },
async (conn, mek, m, { reply }) => {
    if (!m.quoted) return reply(`ᴘʟᴇᴀꜱᴇ ʀᴇᴘʟʏ ᴛᴏ ᴛʜᴇ ᴍᴇꜱꜱᴀɢᴇ ʏᴏᴜ ᴡᴀɴᴛ ᴛᴏ ᴅᴇᴛᴇᴄᴛ!`);
    const responses = ["ᴛʀᴜᴛʜ!","ʟɪᴇ ᴀʟᴇʀᴛ!","ʜᴀʀᴅ ᴛᴏ ʙᴇʟɪᴇᴠᴇ, ʙᴜᴛ ᴛʀᴜᴇ!","ᴄᴏᴍᴘʟᴇᴛᴇʟʏ ꜰᴀʟꜱᴇ!","ᴘʀᴏꜰᴇꜱꜱɪᴏɴᴀʟ ʟɪᴀʀ ᴅᴇᴛᴇᴄᴛᴇᴅ!"];
    reply(`*ʀᴇꜱᴜʟᴛ*: ${responses[Math.floor(Math.random() * responses.length)]}`);
});

// --- GUESS CARTOON ---
cmd({ pattern: "guesscartoon", alias: ["cartoonquiz","guesscharacter"], react: "🍹", desc: "Guess the cartoon character game", category: "fun", use: ".guesscartoon", filename: __filename },
async (conn, mek, m, { from, reply }) => {
    try {
        await reply("🎮 ꜰᴇᴛᴄʜɪɴɢ ᴀ ᴄᴀʀᴛᴏᴏɴ ᴄʜᴀʀᴀᴄᴛᴇʀ...");
        const data = await (await fetch(`${global.siputzx}/api/games/tebakkartun`)).json();
        if (!data.status || !data.data) return reply("*ꜰᴀɪʟᴇᴅ ᴛᴏ ꜰᴇᴛᴄʜ.*");
        await conn.sendMessage(from, { image: { url: data.data.img }, caption: `🎪 *ɢᴜᴇꜱꜱ ᴛʜᴇ ᴄᴀʀᴛᴏᴏɴ ᴄʜᴀʀᴀᴄᴛᴇʀ!*\n\nʀᴇᴘʟʏ ᴡɪᴛʜ ʏᴏᴜʀ ᴀɴꜱᴡᴇʀ!` }, { quoted: anony });
    } catch { reply("ᴇʀʀᴏʀ ꜰᴇᴛᴄʜɪɴɢ ᴄᴀʀᴛᴏᴏɴ ɢᴀᴍᴇ."); }
});

// --- AUDIO EFFECTS ---
const audioEffects = [
    { pattern: "bass", filter: '-af equalizer=f=54:width_type=o:width=2:g=20', desc: "Boost the bass" },
    { pattern: "blown", filter: '-af atempo=4/4,asetrate=44500*2/3', desc: "Apply blown effect" },
    { pattern: "earrape", filter: '-af volume=12', desc: "Apply earrape effect" },
    { pattern: "volaudio", alias: ["volume"], filter: '-filter:a "volume=2.0"', desc: "Adjust volume" },
    { pattern: "treble", filter: '-af equalizer=f=10000:width_type=o:width=2:g=15', desc: "Boost the treble" },
    { pattern: "fast", filter: '-filter:a "atempo=1.5"', desc: "Speed up audio" },
    { pattern: "slow", filter: '-filter:a "atempo=0.8"', desc: "Slow down audio" },
    { pattern: "reverse", filter: '-filter_complex "areverse"', desc: "Reverse audio" },
    { pattern: "echo", filter: '-filter:a "aecho=0.8:0.9:1000:0.3"', desc: "Add echo effect" },
    { pattern: "robot", filter: `-filter_complex "afftfilt=real='hypot(re,im)*sin(0)':imag='hypot(re,im)*cos(0)':win_size=512:overlap=0.75"`, desc: "Apply robot effect" },
    { pattern: "deep", filter: '-filter:a "asetrate=44100*0.7,aresample=44100"', desc: "Apply deep voice" },
    { pattern: "chipmunk", filter: '-filter:a "asetrate=44100*1.5,aresample=44100"', desc: "Apply chipmunk" },
    { pattern: "nightcore", filter: '-filter:a "atempo=1.06,asetrate=44100*1.25"', desc: "Apply nightcore" },
    { pattern: "instrumental", filter: '-af "pan=stereo|c0=c0|c1=c1,aresample=async=1:first_pts=0"', desc: "Extract instrumental" },
    { pattern: "vocalremove", filter: '-af "pan=stereo|c0=c0|c1=-1*c1"', desc: "Remove vocals" },
    { pattern: "karaoke", filter: '-af "stereotools=mode=ms>lr"', desc: "Apply karaoke effect" }
];
for (const a of audioEffects) {
    cmd({
        pattern: a.pattern, alias: a.alias || [], react: "🎵",
        desc: a.desc, category: "audio", use: `.${a.pattern} [reply to audio]`, filename: __filename
    }, async (conn, mek, m, ctx) => {
        await handleAudioEffect(conn, mek, m, ctx, a.filter);
    });
}

// --- TO VOICE NOTE ---
cmd({ pattern: "toptt", alias: ["tovn"], react: "🗣️", desc: "Convert audio to voice note", category: "audio", use: ".toptt [reply to audio]", filename: __filename },
async (conn, mek, m, { from, reply }) => {
    const quoted = m.quoted;
    const mime = quoted?.mimetype || "";
    if (!quoted) return reply('*ʀᴇᴘʟʏ ᴛᴏ ᴀɴ ᴀᴜᴅɪᴏ ꜰɪʟᴇ ᴛᴏ ᴄᴏɴᴠᴇʀᴛ ɪᴛ ᴛᴏ ᴠᴏɪᴄᴇ ɴᴏᴛᴇ!*');
    if (!/audio/.test(mime)) return reply('*ᴏɴʟʏ ᴀᴜᴅɪᴏ ꜰɪʟᴇꜱ ᴄᴀɴ ʙᴇ ᴄᴏɴᴠᴇʀᴛᴇᴅ!*');
    try {
        const buffer = await quoted.download();
        const converted = await toPTT(buffer, 'mp3');
        await conn.sendMessage(from, { audio: converted.data, mimetype: 'audio/ogg; codecs=opus', ptt: true }, { quoted: m });
        await converted.delete();
    } catch (e) {
        console.error(e);
        reply(global.mess?.error || 'ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ᴄᴏɴᴠᴇʀᴛɪɴɢ ᴛʜᴇ ᴀᴜᴅɪᴏ.');
    }
});

// --- EPHOTO 360 LOGOS ---
const ephotoLogos = [
    { pattern: "glossysilver", alias: ["glossy"], endpoint: "glossysilver", title: "ɢʟᴏꜱꜱʏ ꜱɪʟᴠᴇʀ" },
    { pattern: "writetext", alias: ["wtext"], endpoint: "writetext", title: "ᴡʀɪᴛᴇ ᴛᴇxᴛ" },
    { pattern: "blackpinklogo", alias: ["bplogo"], endpoint: "blackpinklogo", title: "ʙʟᴀᴄᴋ ᴘɪɴᴋ ʟᴏɢᴏ" },
    { pattern: "glitchtext", alias: ["glitch"], endpoint: "glitchtext", title: "ɢʟɪᴛᴄʜ ᴛᴇxᴛ" },
    { pattern: "advancedglow", alias: ["aglow"], endpoint: "advancedglow", title: "ᴀᴅᴠᴀɴᴄᴇᴅ ɢʟᴏᴡ" },
    { pattern: "typographytext", alias: ["typo"], endpoint: "typographytext", title: "ᴛʏᴘᴏɢʀᴀᴘʜʏ ᴛᴇxᴛ" },
    { pattern: "pixelglitch", alias: ["pglitch"], endpoint: "pixelglitch", title: "ᴘɪxᴇʟ ɢʟɪᴛᴄʜ" },
    { pattern: "neonglitch", alias: ["nglitch"], endpoint: "neonglitch", title: "ɴᴇᴏɴ ɢʟɪᴛᴄʜ" },
    { pattern: "nigerianflag", alias: ["nigflag"], endpoint: "nigerianflag", title: "ɴɪɢᴇʀɪᴀɴ ꜰʟᴀɢ" },
    { pattern: "americanflag", alias: ["usaflag"], endpoint: "americanflag", title: "ᴀᴍᴇʀɪᴄᴀɴ ꜰʟᴀɢ" },
    { pattern: "deletingtext", alias: ["dtext"], endpoint: "deletingtext", title: "ᴅᴇʟᴇᴛɪɴɢ ᴛᴇxᴛ" },
    { pattern: "blackpinkstyle", alias: ["bpstyle"], endpoint: "blackpinkstyle", title: "ʙʟᴀᴄᴋ ᴘɪɴᴋ sᴛʏʟᴇ" },
    { pattern: "glowingtext", alias: ["gtext"], endpoint: "glowingtext", title: "ɢʟᴏᴡɪɴɢ ᴛᴇxᴛ" },
    { pattern: "underwater", alias: ["uwtext"], endpoint: "underwater", title: "ᴜɴᴅᴇʀ ᴡᴀᴛᴇʀ" },
    { pattern: "logomaker", alias: ["lmaker"], endpoint: "logomaker", title: "ʟᴏɢᴏ ᴍᴀᴋᴇʀ" },
    { pattern: "cartoonstyle", alias: ["cartoon"], endpoint: "cartoonstyle", title: "ᴄᴀʀᴛᴏᴏɴ sᴛʏʟᴇ" },
    { pattern: "papercut", alias: ["pcut"], endpoint: "papercut", title: "ᴘᴀᴘᴇʀ ᴄᴜᴛ" },
    { pattern: "multicolored", alias: ["mcolor"], endpoint: "multicolored", title: "ᴍᴜʟᴛɪ ᴄᴏʟᴏʀᴇᴅ" },
    { pattern: "effectclouds", alias: ["clouds"], endpoint: "effectclouds", title: "ᴇꜰꜰᴇᴄᴛ ᴄʟᴏᴜᴅꜱ" },
    { pattern: "gradienttext", alias: ["grdtext"], endpoint: "gradienttext", title: "ɢʀᴀᴅɪᴇɴᴛ ᴛᴇxᴛ" },
    { pattern: "summerbeach", alias: ["sbeach"], endpoint: "summerbeach", title: "sᴜᴍᴍᴇʀ ʙᴇᴀᴄʜ" },
    { pattern: "sandsummer", alias: ["ssummer"], endpoint: "sandsummer", title: "sᴀɴᴅ sᴜᴍᴍᴇʀ" },
    { pattern: "luxurygold", alias: ["lgold"], endpoint: "luxurygold", title: "ʟᴜxᴜʀʏ ɢᴏʟᴅ" },
    { pattern: "galaxy", alias: ["galaxytext"], endpoint: "galaxy", title: "ɢᴀʟᴀxʏ" },
    { pattern: "1917", alias: ["text1917"], endpoint: "1917", title: "1917" },
    { pattern: "makingneon", alias: ["mneon"], endpoint: "makingneon", title: "ᴍᴀᴋɪɴɢ ɴᴇᴏɴ" },
    { pattern: "texteffect", alias: ["teffect"], endpoint: "texteffect", title: "ᴛᴇxᴛ ᴇꜰꜰᴇᴄᴛ" },
    { pattern: "galaxystyle", alias: ["gstyle"], endpoint: "galaxystyle", title: "ɢᴀʟᴀxʏ sᴛʏʟᴇ" },
    { pattern: "lighteffect", alias: ["leffect"], endpoint: "lighteffect", title: "ʟɪɢʜᴛ ᴇꜰꜰᴇᴄᴛ" }
];
for (const e of ephotoLogos) {
    cmd({
        pattern: e.pattern, alias: e.alias, react: "🍹",
        desc: `Generate ${e.title} image`, category: "logo", use: `.${e.pattern} <text>`, filename: __filename
    }, async (conn, mek, m, { from, reply, q, prefix }) => {
        await handleEphoto360(conn, mek, from, reply, q, prefix, e.endpoint, e.title);
    });
}