const axios = require('axios');
const { cmd } = require('../command');
const { anony } = require('../lib/ridzcoder');
const fetch = require('node-fetch');
const fs = require('fs');
const { exec } = require('child_process');
const { tmpdir } = require('os');
const path = require('path');
const { toAudio, toPTT } = require('../start/lib/converter');
;
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
        let res = await fetch(`https://ipwho.is/${q}`).then(result => result.json());

        const formatIPInfo = (info) => {
            return `
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
        };

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

// --- OBFUSCATE ---
cmd({
    pattern: "obfuscate",
    react: "🔒",
    desc: "Obfuscate a .js file",
    category: "tools",
    use: ".obfuscate [reply to .js file]",
    filename: __filename
}, async (conn, mek, m, { from, reply }) => {
    const tmpDir = './tmp';
    if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
    }

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

        conn.sendMessage(from, { 
            text: "🔒 ᴏʙꜰᴜsᴄᴀᴛɪᴏɴ sᴛᴀʀᴛᴇᴅ..." 
        }, { quoted: anony });

        const obfuscatedFile = await obfuscateJS(tempFile);

        await conn.sendMessage(from, { 
            text: "✅ ᴏʙꜰᴜsᴄᴀᴛɪᴏɴ ᴄᴏᴍᴘʟᴇᴛᴇ! sᴇɴᴅɪɴɢ ꜰɪʟᴇ..." 
        }, { quoted: anony }); 

        await conn.sendMessage(from, { 
            document: fs.readFileSync(obfuscatedFile), 
            mimetype: "text/javascript", 
            fileName: "nemesis.js" 
        });

        await fs.promises.unlink(tempFile);
        await fs.promises.unlink(obfuscatedFile);

    } catch (error) {
        conn.sendMessage(from, { 
            text: `❌ *ᴇʀʀᴏʀ:* ${error.message}` 
        }, { quoted: anony });
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
    const normalizePhoneNumber = (phone) => {
        if (!phone || typeof phone !== 'string') return null;
        return phone.replace(/\D/g, '');
    };

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

        const vCards = vcfContent.split('END:VCARD')
            .map(card => card.trim())
            .filter(card => card.length > 0);

        const validContacts = [];
        const invalidContacts = [];

        for (const card of vCards) {
            try {
                const telMatch = card.match(/TEL[^:]*:([^\n]+)/);
                if (!telMatch) continue;

                const phoneRaw = telMatch[1].trim();
                const phoneNumber = normalizePhoneNumber(phoneRaw);
                if (!phoneNumber) continue;

                const jid = `${phoneNumber}@s.whatsapp.net`;
                const result = await conn.onWhatsApp(jid);

                if (result.length > 0 && result[0].exists) {
                    validContacts.push(card);
                } else {
                    invalidContacts.push(phoneNumber);
                }
            } catch (error) {
                console.error('ᴄᴏɴᴛᴀᴄᴛ ᴇʀʀᴏʀ:', error);
            }
        }

        const filteredVcf = validContacts.join('\nEND:VCARD\n') + (validContacts.length > 0 ? '\nEND:VCARD' : '');

        const resultMessage = `
                     ╭──⧼♛ *ᴠᴄꜰ ꜰɪʟᴛᴇʀɪɴɢ ᴄᴏᴍᴘʟᴇᴛᴇ*\n\n` +
                    `│┃ ♛ ᴛᴏᴛᴀʟ ᴄᴏɴᴛᴀᴄᴛs: ${vCards.length}\n` +
                    `│┃ ♛ ᴠᴀʟɪᴅ ᴡʜᴀᴛsᴀᴘᴘ ᴄᴏɴᴛᴀᴄᴛs: ${validContacts.length}\n` +
                    `│┃ ♛ ɴᴏɴ-ᴡʜᴀᴛsᴀᴘᴘ ɴᴜᴍʙᴇʀs ʀᴇᴍᴏᴠᴇᴅ: ${invalidContacts.length}\n\n` +
                    `╰────────────────≽` +
                    `sᴇɴᴅɪɴɢ ꜰɪʟᴛᴇʀᴇᴅ ᴠᴄꜰ ꜰɪʟᴇ...`;

        await conn.sendMessage(from, { text: resultMessage }, { quoted: anony });

        await conn.sendMessage(from, { 
            document: Buffer.from(filteredVcf), 
            mimetype: "text/x-vcard", 
            fileName: "filtered_contacts.vcf" 
        });

    } catch (error) {
        await conn.sendMessage(from, { 
            text: `❌ *ᴇʀʀᴏʀ:* ${error.message}` 
        }, { quoted: anony });
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
        let res = await fetch(`https://api.qrserver.com/v1/create-qr-code/?data=${q}&size=200x200`);
        let qrCodeUrl = res.url;

        await conn.sendMessage(from, { 
            image: { url: qrCodeUrl },
            caption: `ǫʀ ᴄᴏᴅᴇ ꜰᴏʀ: ${q}`
        }, { quoted: anony });
    } catch (error) {
        console.error('ǫʀ ᴇʀʀᴏʀ:', error);
        reply('ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ɢᴇɴᴇʀᴀᴛɪɴɢ ᴛʜᴇ ǫʀ ᴄᴏᴅᴇ.');
    }
});

// --- SS PHONE ---
cmd({
    pattern: "ssphone",
    alias: ["ssmobile2", "ssmobileweb"],
    react: "📱",
    desc: "Take a phone-style screenshot of a website",
    category: "tools",
    use: ".ssphone <url>",
    filename: __filename
}, async (conn, mek, m, { from, reply, q, prefix }) => {
    const url = (q || '').trim();
    if (!url) return reply(`📌 *ᴜsᴀɢᴇ:* ${prefix}ssphone https://example.com`);
    if (!url.startsWith('http')) return reply("❌ ᴜʀʟ ᴍᴜsᴛ sᴛᴀʀᴛ ᴡɪᴛʜ http:// ᴏʀ https://");

    try {
        await conn.sendMessage(from, { react: { text: "📱", key: mek.key } });

        const apiUrl = `https://api.princetechn.com/api/tools/ssphone?apikey=prince&url=${encodeURIComponent(url)}`;

        await conn.sendMessage(from, {
            image: { url: apiUrl },
            caption: `📱 *ᴘʜᴏɴᴇ sᴄʀᴇᴇɴsʜᴏᴛ*\n\n🔗 ${url}\n\n> ${global.wm || ''}`
        }, { quoted: anony });

        await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });
    } catch (error) {
        console.error('ssphone error:', error);
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
        reply("❌ ᴇʀʀᴏʀ ɢᴇɴᴇʀᴀᴛɪɴɢ ᴘʜᴏɴᴇ sᴄʀᴇᴇɴsʜᴏᴛ.");
    }
});

// --- SS PC ---
cmd({
    pattern: "sspc2",
    alias: ["ssdesktop2", "sscomputer"],
    react: "💻",
    desc: "Take a PC-style screenshot of a website",
    category: "tools",
    use: ".sspc2 <url>",
    filename: __filename
}, async (conn, mek, m, { from, reply, q, prefix }) => {
    const url = (q || '').trim();
    if (!url) return reply(`📌 *ᴜsᴀɢᴇ:* ${prefix}sspc2 https://example.com`);
    if (!url.startsWith('http')) return reply("❌ ᴜʀʟ ᴍᴜsᴛ sᴛᴀʀᴛ ᴡɪᴛʜ http:// ᴏʀ https://");

    try {
        await conn.sendMessage(from, { react: { text: "💻", key: mek.key } });

        const apiUrl = `https://api.princetechn.com/api/tools/sspc?apikey=prince&url=${encodeURIComponent(url)}`;

        await conn.sendMessage(from, {
            image: { url: apiUrl },
            caption: `💻 *ᴘᴄ sᴄʀᴇᴇɴsʜᴏᴛ*\n\n🔗 ${url}\n\n> ${global.wm || ''}`
        }, { quoted: anony });

        await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });
    } catch (error) {
        console.error('sspc error:', error);
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
        reply("❌ ᴇʀʀᴏʀ ɢᴇɴᴇʀᴀᴛɪɴɢ ᴘᴄ sᴄʀᴇᴇɴsʜᴏᴛ.");
    }
});

// --- SS TABLET ---
cmd({
    pattern: "sstab2",
    alias: ["sstablet"],
    react: "📟",
    desc: "Take a tablet-style screenshot of a website",
    category: "tools",
    use: ".sstab2 <url>",
    filename: __filename
}, async (conn, mek, m, { from, reply, q, prefix }) => {
    const url = (q || '').trim();
    if (!url) return reply(`📌 *ᴜsᴀɢᴇ:* ${prefix}sstab2 https://example.com`);
    if (!url.startsWith('http')) return reply("❌ ᴜʀʟ ᴍᴜsᴛ sᴛᴀʀᴛ ᴡɪᴛʜ http:// ᴏʀ https://");

    try {
        await conn.sendMessage(from, { react: { text: "📟", key: mek.key } });

        const apiUrl = `https://api.princetechn.com/api/tools/sstab?apikey=prince&url=${encodeURIComponent(url)}`;

        await conn.sendMessage(from, {
            image: { url: apiUrl },
            caption: `📟 *ᴛᴀʙʟᴇᴛ sᴄʀᴇᴇɴsʜᴏᴛ*\n\n🔗 ${url}\n\n> ${global.wm || ''}`
        }, { quoted: anony });

        await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });
    } catch (error) {
        console.error('sstab error:', error);
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
        reply("❌ ᴇʀʀᴏʀ ɢᴇɴᴇʀᴀᴛɪɴɢ ᴛᴀʙʟᴇᴛ sᴄʀᴇᴇɴsʜᴏᴛ.");
    }
});

// --- SS FULL PAGE ---
cmd({
    pattern: "ssweb2",
    alias: ["ssfull", "ssfullpage"],
    react: "🌐",
    desc: "Take a full-page screenshot of a website",
    category: "tools",
    use: ".ssweb2 <url>",
    filename: __filename
}, async (conn, mek, m, { from, reply, q, prefix }) => {
    const url = (q || '').trim();
    if (!url) return reply(`📌 *ᴜsᴀɢᴇ:* ${prefix}ssweb2 https://example.com`);
    if (!url.startsWith('http')) return reply("❌ ᴜʀʟ ᴍᴜsᴛ sᴛᴀʀᴛ ᴡɪᴛʜ http:// ᴏʀ https://");

    try {
        await conn.sendMessage(from, { react: { text: "🌐", key: mek.key } });

        const apiUrl = `https://api.princetechn.com/api/tools/ssweb?apikey=prince&url=${encodeURIComponent(url)}`;

        await conn.sendMessage(from, {
            image: { url: apiUrl },
            caption: `🌐 *ꜰᴜʟʟ ᴡᴇʙ sᴄʀᴇᴇɴsʜᴏᴛ*\n\n🔗 ${url}\n\n> ${global.wm || ''}`
        }, { quoted: anony });

        await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });
    } catch (error) {
        console.error('ssweb error:', error);
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
        reply("❌ ᴇʀʀᴏʀ ɢᴇɴᴇʀᴀᴛɪɴɢ ᴡᴇʙ sᴄʀᴇᴇɴsʜᴏᴛ.");
    }
});

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
        return reply(`🎵 *ʟʏʀɪᴄs ꜰɪɴᴅᴇʀ*\n\nᴜsᴀɢᴇ: ${prefix}ʟʏʀɪᴄs <sᴏɴɢ ɴᴀᴍᴇ>\n\nᴇxᴀᴍᴘʟᴇs:\n• ${prefix}ʟʏʀɪᴄs sʜᴀᴘᴇ ᴏꜰ ʏᴏᴜ\n• ${prefix}ʟʏʀɪᴄs sᴇᴋᴋʟᴇ ᴅᴏᴡɴ ʙʏ ʙᴜɴɴɪᴇ ɢᴜɴᴛᴇʀ\n• ${prefix}ʟʏʀɪᴄs ʙʟɪɴᴅɪɴɢ ʟɪɢʜᴛs ᴛʜᴇ ᴡᴇᴇᴋɴᴅ`);
    }

    try {
        await reply(`🔍 sᴇᴀʀᴄʜɪɴɢ ʟʏʀɪᴄs ꜰᴏʀ: *"${q}"*...`);

        const apiUrl = `https://api.popcat.xyz/v2/lyrics?song=${encodeURIComponent(q)}`;
        const res = await fetch(apiUrl, { timeout: 15000 });

        if (!res.ok) throw new Error(`ᴀᴘɪ sᴛᴀᴛᴜs: ${res.status}`);

        const data = await res.json();

        if (data.error === true) {
            return reply(`ɴᴏ ʟʏʀɪᴄs ꜰᴏᴜɴᴅ ꜰᴏʀ *"${q}"*\n\nᴛʀʏ:\n• ᴀᴅᴅ ᴀʀᴛɪsᴛ ɴᴀᴍᴇ\n• ᴄʜᴇᴄᴋ sᴘᴇʟʟɪɴɢ\n• ᴜsᴇ ᴇxᴀᴄᴛ ᴛɪᴛʟᴇ`);
        }

        if (!data.message || typeof data.message !== 'object' || !data.message.lyrics) {
            return reply(`ʟʏʀɪᴄs ɴᴏᴛ ᴀᴠᴀɪʟᴀʙʟᴇ ꜰᴏʀ *"${q}"*`);
        }

        const lyricsData = data.message;
        const lyrics = lyricsData.lyrics;
        const artist = lyricsData.artist || 'ᴜɴᴋɴᴏᴡɴ';
        const title = lyricsData.title || q;
        const image = lyricsData.image;

        const cleanLyrics = lyrics.replace(/^\d+\s+Contributor.*?\n/i, '');

        let message = `🎵 *${title}*\n🎤 *ᴀʀᴛɪsᴛ:* ${artist}\n\n📖 *ʟʏʀɪᴄs:*\n\n${cleanLyrics}`;

        if (message.length > 3500) {
            message = message.substring(0, 3500) + '\n\n*ʟʏʀɪᴄs ᴛʀᴜɴᴄᴀᴛᴇᴅ - sᴏɴɢ ᴛᴏᴏ ʟᴏɴɢ*';
        }

        message += `\n\n${global.wm || ''}`;

        if (image && typeof image === 'string' && image.includes('http') && !image.includes('default_cover_image')) {
            try {
                await conn.sendMessage(from, {
                    image: { url: image },
                    caption: `🎵 *${title}*\n🎤 *ᴀʀᴛɪsᴛ:* ${artist}`
                }, { quoted: anony });

                await new Promise(resolve => setTimeout(resolve, 300));
            } catch (e) {
                console.log('ɪᴍᴀɢᴇ ꜰᴀɪʟᴇᴅ:', e.message);
            }
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
        const devInfo = {
            name: "ʀɪᴅᴢ ᴄᴏᴅᴇʀ",
            number: "256777205718",
            organization: "ᴘʀɪᴍᴇ ʀɪᴅᴢ",
            note: "ʙᴏᴛ ᴅᴇᴠᴇʟᴏᴘᴇʀ"
        };

        const vcard =
            `BEGIN:VCARD\n` +
            `VERSION:3.0\n` +
            `FN:${devInfo.name}\n` +
            `ORG:${devInfo.organization}\n` +
            `TEL;type=CELL;type=VOICE;waid=${devInfo.number}:+${devInfo.number}\n` +
            `NOTE:${devInfo.note}\n` +
            `END:VCARD`;

        await conn.sendMessage(from, {
            contacts: {
                displayName: devInfo.name,
                contacts: [{ displayName: devInfo.name, vcard }]
            }
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

        let res = await fetch(`https://api.github.com/users/${q}`);
        let json = await res.json();

        reply(`📊 *ɢɪᴛʜᴜʙ ꜱᴛᴀᴛꜱ*\n\n👤 ᴜꜱᴇʀɴᴀᴍᴇ: ${json.login}\n📦 ᴘᴜʙʟɪᴄ ʀᴇᴘᴏꜱ: ${json.public_repos}\n👥 ꜰᴏʟʟᴏᴡᴇʀꜱ: ${json.followers}\n➡️ ꜰᴏʟʟᴏᴡɪɴɢ: ${json.following}\n⭐ ʙɪᴏ: ${json.bio || "ɴᴏɴᴇ"}\n🔗 ${json.html_url}`);
    } catch (e) {
        console.error('ɢɪᴛɪɴꜰᴏ ᴇʀʀᴏʀ:', e);
        reply("ᴇʀʀᴏʀ ꜰᴇᴛᴄʜɪɴɢ ɢɪᴛʜᴜʙ ꜱᴛᴀᴛꜱ.");
    }
});

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
        const repoOwner = "ridzcoder";
        const repoName = "PRIME-RIDZ";
        const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}`;

        const { data } = await axios.get(apiUrl, {
            timeout: 5000,
            headers: { 'User-Agent': 'PRIME-RIDZ' }
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

> @${m.sender.split("@")[0]} 
ᴛɪᴍᴇ ᴛᴇᴀᴄʜᴇs ʏᴏᴜ ᴛʜɪɴɢs ʏᴏᴜ ᴄᴀɴ ɴᴏᴛ ʟᴇᴀʀɴ ꜰʀᴏᴍ ᴛʜᴇ ʙᴏᴏᴋs`;

        const thumbnailUrl = 'https://files.catbox.moe/oyadfh.png';

        await conn.sendMessage(from, {
            text: repoInfo,
            contextInfo: {
                mentionedJid: [m.sender],
                externalAdReply: {
                    title: "🌟 ᴘʀɪᴍᴇ ʀɪᴅᴢ ʀᴇᴘᴏsɪᴛᴏʀʏ",
                    body: `⭐ ${data.stargazers_count || 0} sᴛᴀʀs | 🍴 ${data.forks_count || 0} ꜰᴏʀᴋs`,
                    thumbnailUrl: thumbnailUrl,
                    sourceUrl: `https://github.com/${repoOwner}/${repoName}`,
                    mediaType: 1,
                    renderLargerThumbnail: true
                }
            }
        }, { quoted: anony });

    } catch (error) {
        console.error('ʀᴇᴘᴏ ᴇʀʀᴏʀ:', error);
        const fallbackInfo = `
╭──⧼♛ *ᴘʀɪᴍᴇ ʀɪᴅᴢ ʀᴇᴘᴏ* ♛⧽──≽
│
│┃ ♛ *ʀᴇᴘᴏsɪᴛᴏʀʏ* : ᴘʀɪᴍᴇ ʀɪᴅᴢ
│┃ ♛ *ᴏᴡɴᴇʀ*      : ʀɪᴅᴢᴄᴏᴅᴇʀ
│┃ ♛ *ɢɪᴛʜᴜʙ*     : https://github.com/ridzcoder/PRIME-RIDZ
╰────────────────≽

✨ @${m.sender.split("@")[0]} *ᴠɪsɪᴛ ᴛʜᴇ ʀᴇᴘᴏ ᴛᴏ ⭐ sᴛᴀʀ!* ✨`;

        await conn.sendMessage(from, { 
            text: fallbackInfo,
            contextInfo: { 
                mentionedJid: [m.sender],
                externalAdReply: {
                    title: "ᴘʀɪᴍᴇ ʀɪᴅᴢ",
                    body: "ɢɪᴛʜᴜʙ ʀᴇᴘᴏsɪᴛᴏʀʏ",
                    thumbnailUrl: 'https://files.catbox.moe/oyadfh.png',
                    sourceUrl: "https://github.com/ridzcoder/PRIME-RIDZ"
                }
            }
        }, { quoted: anony });
    }
});
// --- BIBLE VERSE ---
cmd({
    pattern: "verse",
    alias: ["dailyverse", "bibleverse"],
    react: "📖",
    desc: "Get a random Bible verse",
    category: "religion",
    use: ".verse",
    filename: __filename
}, async (conn, mek, m, { from, reply }) => {
    try {
        const verses = [
            "John 3:16", "Psalm 23:1", "Philippians 4:13", "Romans 8:28",
            "Jeremiah 29:11", "Proverbs 3:5-6", "Isaiah 40:31", "Matthew 11:28",
            "Joshua 1:9", "Psalm 46:10", "1 Corinthians 13:4-7", "Romans 12:2"
        ];
        const random = verses[Math.floor(Math.random() * verses.length)];
        const res = await fetch(`https://bible-api.com/${encodeURIComponent(random)}`);
        const data = await res.json();
        reply(`📖 *ᴠᴇʀsᴇ ᴏꜰ ᴛʜᴇ ᴅᴀʏ*\n\n*${data.reference}*\n\n${data.text}\n\n— ${data.translation_name}`);
    } catch (e) {
        reply("ᴇʀʀᴏʀ ꜰᴇᴛᴄʜɪɴɢ ᴠᴇʀsᴇ.");
    }
});

// --- HADITH ---
cmd({
    pattern: "hadith",
    alias: ["dailyhadith"],
    react: "🕌",
    desc: "Get a random Hadith",
    category: "religion",
    use: ".hadith",
    filename: __filename
}, async (conn, mek, m, { from }) => {
    try {
        const hadiths = [
            "ᴛʜᴇ ʙᴇsᴛ ᴀᴍᴏɴɢ ʏᴏᴜ ᴀʀᴇ ᴛʜᴏsᴇ ᴡʜᴏ ʜᴀᴠᴇ ᴛʜᴇ ʙᴇsᴛ ᴍᴀɴɴᴇʀs ᴀɴᴅ ᴄʜᴀʀᴀᴄᴛᴇʀ. — sᴀʜɪʜ ʙᴜᴋʜᴀʀɪ",
            "ɴᴏɴᴇ ᴏꜰ ʏᴏᴜ ᴛʀᴜʟʏ ʙᴇʟɪᴇᴠᴇs ᴜɴᴛɪʟ ʜᴇ ʟᴏᴠᴇs ꜰᴏʀ ʜɪs ʙʀᴏᴛʜᴇʀ ᴡʜᴀᴛ ʜᴇ ʟᴏᴠᴇs ꜰᴏʀ ʜɪᴍsᴇʟꜰ. — sᴀʜɪʜ ʙᴜᴋʜᴀʀɪ",
            "ᴛʜᴇ sᴛʀᴏɴɢ ɪs ɴᴏᴛ ᴛʜᴇ ᴏɴᴇ ᴡʜᴏ ᴏᴠᴇʀᴄᴏᴍᴇs ᴛʜᴇ ᴘᴇᴏᴘʟᴇ ʙʏ ʜɪs sᴛʀᴇɴɢᴛʜ, ʙᴜᴛ ᴛʜᴇ sᴛʀᴏɴɢ ɪs ᴛʜᴇ ᴏɴᴇ ᴡʜᴏ ᴄᴏɴᴛʀᴏʟs ʜɪᴍsᴇʟꜰ ᴡʜɪʟᴇ ɪɴ ᴀɴɢᴇʀ. — sᴀʜɪʜ ʙᴜᴋʜᴀʀɪ",
            "ᴅᴏ ɴᴏᴛ ᴡɪsʜ ᴛᴏ ʙᴇ ʟɪᴋᴇ ᴀɴʏᴏɴᴇ ᴇxᴄᴇᴘᴛ ɪɴ ᴛᴡᴏ ᴄᴀsᴇs: ᴀ ᴘᴇʀsᴏɴ ᴡʜᴏᴍ ᴀʟʟᴀʜ ʜᴀs ɢɪᴠᴇɴ ᴡᴇᴀʟᴛʜ ᴀɴᴅ ʜᴇ sᴘᴇɴᴅs ɪᴛ ʀɪɢʜᴛᴇᴏᴜsʟʏ, ᴀɴᴅ ᴀ ᴘᴇʀsᴏɴ ᴡʜᴏᴍ ᴀʟʟᴀʜ ʜᴀs ɢɪᴠᴇɴ ᴡɪsᴅᴏᴍ ᴀɴᴅ ʜᴇ ᴀᴄᴛs ᴀᴄᴄᴏʀᴅɪɴɢ ᴛᴏ ɪᴛ. — sᴀʜɪʜ ʙᴜᴋʜᴀʀɪ",
            "ʜᴇ ᴡʜᴏ ᴅᴏᴇs ɴᴏᴛ ᴛʜᴀɴᴋ ᴘᴇᴏᴘʟᴇ, ᴅᴏᴇs ɴᴏᴛ ᴛʜᴀɴᴋ ᴀʟʟᴀʜ. — sᴜɴᴀɴ ᴀʙɪ ᴅᴀᴡᴜᴅ",
            "ᴀʟʟᴀʜ ɪs ɴᴏᴛ ᴋɪɴᴅ ᴛᴏ ʜɪᴍ ᴡʜᴏ ɪs ɴᴏᴛ ᴋɪɴᴅ ᴛᴏ ᴘᴇᴏᴘʟᴇ. — sᴀʜɪʜ ᴍᴜsʟɪᴍ",
            "ᴛʜᴇ ᴍᴏsᴛ ʙᴇʟᴏᴠᴇᴅ ᴅᴇᴇᴅs ᴛᴏ ᴀʟʟᴀʜ ᴀʀᴇ ᴛʜᴏsᴇ ᴅᴏɴᴇ ᴄᴏɴsɪsᴛᴇɴᴛʟʏ, ᴇᴠᴇɴ ɪꜰ ᴛʜᴇʏ ᴀʀᴇ sᴍᴀʟʟ. — sᴀʜɪʜ ʙᴜᴋʜᴀʀɪ"
        ];
        const random = hadiths[Math.floor(Math.random() * hadiths.length)];
        conn.sendMessage(from, { text: `🕌 *ʜᴀᴅɪᴛʜ ᴏꜰ ᴛʜᴇ ᴅᴀʏ*\n\n${random}` }, { quoted: anony });
    } catch (e) {
        console.error('ʜᴀᴅɪᴛʜ ᴇʀʀᴏʀ:', e);
    }
});

// --- TORAH ---
cmd({
    pattern: "torah",
    alias: ["tanakh"],
    react: "✡️",
    desc: "Read a Torah portion",
    category: "religion",
    use: ".torah <number 1-10>",
    filename: __filename
}, async (conn, mek, m, { from, reply, q }) => {
    try {
        const parshiot = [
            { name: "ʙᴇʀᴇsʜɪᴛ", book: "ɢᴇɴᴇsɪs 1:1-6:8", summary: "ᴄʀᴇᴀᴛɪᴏɴ ᴏꜰ ᴛʜᴇ ᴡᴏʀʟᴅ, ᴀᴅᴀᴍ ᴀɴᴅ ᴇᴠᴇ, ᴄᴀɪɴ ᴀɴᴅ ᴀʙᴇʟ." },
            { name: "ɴᴏᴀᴄʜ", book: "ɢᴇɴᴇsɪs 6:9-11:32", summary: "ɴᴏᴀʜ's ᴀʀᴋ, ᴛʜᴇ ꜰʟᴏᴏᴅ, ᴛʜᴇ ᴄᴏᴠᴇɴᴀɴᴛ ᴏꜰ ᴛʜᴇ ʀᴀɪɴʙᴏᴡ, ᴀɴᴅ ᴛʜᴇ ᴛᴏᴡᴇʀ ᴏꜰ ʙᴀʙᴇʟ." },
            { name: "ʟᴇᴄʜ-ʟᴇᴄʜᴀ", book: "ɢᴇɴᴇsɪs 12:1-17:27", summary: "ɢᴏᴅ ᴄᴀʟʟs ᴀʙʀᴀʜᴀᴍ ᴛᴏ ʟᴇᴀᴠᴇ ʜɪs ʜᴏᴍᴇʟᴀɴᴅ ᴀɴᴅ ɢᴏ ᴛᴏ ᴄᴀɴᴀᴀɴ." },
            { name: "ᴠᴀʏᴇɪʀᴀ", book: "ɢᴇɴᴇsɪs 18:1-22:24", summary: "ᴀʙʀᴀʜᴀᴍ's ʜᴏsᴘɪᴛᴀʟɪᴛʏ, sᴏᴅᴏᴍ ᴀɴᴅ ɢᴏᴍᴏʀʀᴀʜ, ᴀɴᴅ ᴛʜᴇ ʙɪɴᴅɪɴɢ ᴏꜰ ɪsᴀᴀᴄ." },
            { name: "ᴄʜᴀʏᴇɪ sᴀʀᴀʜ", book: "ɢᴇɴᴇsɪs 23:1-25:18", summary: "ᴛʜᴇ ᴅᴇᴀᴛʜ ᴏꜰ sᴀʀᴀʜ ᴀɴᴅ ꜰɪɴᴅɪɴɢ ᴀ ᴡɪꜰᴇ ꜰᴏʀ ɪsᴀᴀᴄ." },
            { name: "ᴛᴏʟᴅᴏᴛ", book: "ɢᴇɴᴇsɪs 25:19-28:9", summary: "ᴛʜᴇ ʙɪʀᴛʜ ᴏꜰ ᴊᴀᴄᴏʙ ᴀɴᴅ ᴇsᴀᴜ ᴀɴᴅ ᴊᴀᴄᴏʙ's ʙʟᴇssɪɴɢ." },
            { name: "ᴠᴀʏᴇᴛᴢᴇɪ", book: "ɢᴇɴᴇsɪs 28:10-32:3", summary: "ᴊᴀᴄᴏʙ's ʟᴀᴅᴅᴇʀ ᴀɴᴅ ʜɪs ᴊᴏᴜʀɴᴇʏ ᴛᴏ ʜᴀʀᴀɴ." },
            { name: "ᴠᴀʏɪsʜʟᴀᴄʜ", book: "ɢᴇɴᴇsɪs 32:4-36:43", summary: "ᴊᴀᴄᴏʙ ᴡʀᴇsᴛʟᴇs ᴡɪᴛʜ ᴛʜᴇ ᴀɴɢᴇʟ ᴀɴᴅ ʀᴇᴜɴɪᴛᴇs ᴡɪᴛʜ ᴇsᴀᴜ." },
            { name: "ᴠᴀʏᴇsʜᴇᴠ", book: "ɢᴇɴᴇsɪs 37:1-40:23", summary: "ᴊᴏsᴇᴘʜ's ᴅʀᴇᴀᴍs ᴀɴᴅ ʜɪs sᴀʟᴇ ɪɴᴛᴏ sʟᴀᴠᴇʀʏ." },
            { name: "ᴍɪᴋᴇᴛᴢ", book: "ɢᴇɴᴇsɪs 41:1-44:17", summary: "ᴊᴏsᴇᴘʜ ɪɴᴛᴇʀᴘʀᴇᴛs ᴘʜᴀʀᴀᴏʜ's ᴅʀᴇᴀᴍs ᴀɴᴅ ʙᴇᴄᴏᴍᴇs ᴠɪᴄᴇʀᴏʏ ᴏꜰ ᴇɢʏᴘᴛ." }
        ];

        if (!q) {
            let list = `✡️ *ᴛᴏʀᴀʜ - ᴡᴇᴇᴋʟʏ ᴘᴏʀᴛɪᴏɴs*\n\n`;
            parshiot.forEach((p, i) => {
                list += `${i + 1}. *${p.name}* — ${p.book}\n`;
            });
            list += `\n📌 ᴜsᴇ: .ᴛᴏʀᴀʜ <ɴᴜᴍʙᴇʀ> ꜰᴏʀ ᴅᴇᴛᴀɪʟs`;
            return reply(list);
        }

        const idx = parseInt(q.trim()) - 1;
        if (isNaN(idx) || idx < 0 || idx >= parshiot.length) {
            return reply("❌ ɪɴᴠᴀʟɪᴅ ɴᴜᴍʙᴇʀ. ᴜsᴇ .ᴛᴏʀᴀʜ ᴛᴏ sᴇᴇ ᴛʜᴇ ʟɪsᴛ (1-10).");
        }

        const p = parshiot[idx];
        await conn.sendMessage(from, {
            text: `✡️ *ᴛᴏʀᴀʜ ᴘᴏʀᴛɪᴏɴ*\n\n📜 *${p.name}*\n📖 *ʀᴇᴀᴅɪɴɢ:* ${p.book}\n\n📝 *sᴜᴍᴍᴀʀʏ:*\n${p.summary}`
        }, { quoted: anony });
    } catch (e) {
        console.error('ᴛᴏʀᴀʜ ᴇʀʀᴏʀ:', e);
        reply("ᴇʀʀᴏʀ ꜰᴇᴛᴄʜɪɴɢ ᴛᴏʀᴀʜ ᴘᴏʀᴛɪᴏɴ.");
    }
});

// --- JEWISH QUOTE ---
cmd({
    pattern: "jewishquote",
    alias: ["torahquote"],
    react: "✡️",
    desc: "Get a random Jewish wisdom quote",
    category: "religion",
    use: ".jewishquote",
    filename: __filename
}, async (conn, mek, m, { from }) => {
    try {
        const quotes = [
            "ᴡʜᴏ ɪs ᴡɪsᴇ? ʜᴇ ᴡʜᴏ ʟᴇᴀʀɴs ꜰʀᴏᴍ ᴇᴠᴇʀʏ ᴘᴇʀsᴏɴ. — ᴘɪʀᴋᴇɪ ᴀᴠᴏᴛ 4:1",
            "ɪᴛ ɪs ɴᴏᴛ ʏᴏᴜʀ ᴅᴜᴛʏ ᴛᴏ ꜰɪɴɪsʜ ᴛʜᴇ ᴡᴏʀᴋ, ʙᴜᴛ ɴᴇɪᴛʜᴇʀ ᴀʀᴇ ʏᴏᴜ ᴀᴛ ʟɪʙᴇʀᴛʏ ᴛᴏ ɴᴇɢʟᴇᴄᴛ ɪᴛ. — ᴘɪʀᴋᴇɪ ᴀᴠᴏᴛ 2:16",
            "ᴛʜᴇ ᴡᴏʀʟᴅ sᴛᴀɴᴅs ᴏɴ ᴛʜʀᴇᴇ ᴛʜɪɴɢs: ᴛᴏʀᴀʜ, ᴡᴏʀsʜɪᴘ, ᴀɴᴅ ᴀᴄᴛs ᴏꜰ ʟᴏᴠɪɴɢ ᴋɪɴᴅɴᴇss. — ᴘɪʀᴋᴇɪ ᴀᴠᴏᴛ 1:2",
            "ʟᴏᴠᴇ ᴘᴇᴀᴄᴇ ᴀɴᴅ ᴘᴜʀsᴜᴇ ᴘᴇᴀᴄᴇ. — ᴘɪʀᴋᴇɪ ᴀᴠᴏᴛ 1:12",
            "ᴅᴏ ɴᴏᴛ sᴇᴘᴀʀᴀᴛᴇ ʏᴏᴜʀsᴇʟꜰ ꜰʀᴏᴍ ᴛʜᴇ ᴄᴏᴍᴍᴜɴɪᴛʏ. — ᴘɪʀᴋᴇɪ ᴀᴠᴏᴛ 2:4",
            "ɪɴ ᴀ ᴘʟᴀᴄᴇ ᴡʜᴇʀᴇ ᴛʜᴇʀᴇ ᴀʀᴇ ɴᴏ ᴍᴇɴ, sᴛʀɪᴠᴇ ᴛᴏ ʙᴇ ᴀ ᴍᴀɴ. — ᴘɪʀᴋᴇɪ ᴀᴠᴏᴛ 2:5",
            "ʀᴇᴘᴇɴᴛᴀɴᴄᴇ, ᴘʀᴀʏᴇʀ, ᴀɴᴅ ᴄʜᴀʀɪᴛʏ ᴀᴠᴇʀᴛ ᴛʜᴇ sᴇᴠᴇʀᴇ ᴅᴇᴄʀᴇᴇ. — ʜɪɢʜ ʜᴏʟɪᴅᴀʏ ʟɪᴛᴜʀɢʏ"
        ];
        const random = quotes[Math.floor(Math.random() * quotes.length)];
        conn.sendMessage(from, { text: `✡️ *ᴊᴇᴡɪsʜ ᴡɪsᴅᴏᴍ*\n\n${random}` }, { quoted: anony });
    } catch (e) {
        console.error('ᴊᴇᴡɪsʜǫᴜᴏᴛᴇ ᴇʀʀᴏʀ:', e);
    }
});

// --- BHAGAVAD GITA ---
cmd({
    pattern: "gita",
    alias: ["bhagavadgita"],
    react: "🕉️",
    desc: "Read a chapter of the Bhagavad Gita",
    category: "religion",
    use: ".gita <number 1-18>",
    filename: __filename
}, async (conn, mek, m, { from, reply, q }) => {
    try {
        const chapters = [
            { num: 1, name: "ᴀʀᴊᴜɴᴀ ᴠɪsᴀᴅᴀ ʏᴏɢᴀ", meaning: "ᴛʜᴇ ʏᴏɢᴀ ᴏꜰ ᴀʀᴊᴜɴᴀ's ᴅᴇᴊᴇᴄᴛɪᴏɴ", verses: 47 },
            { num: 2, name: "sᴀɴᴋʜʏᴀ ʏᴏɢᴀ", meaning: "ᴛʜᴇ ʏᴏɢᴀ ᴏꜰ ᴋɴᴏᴡʟᴇᴅɢᴇ", verses: 72 },
            { num: 3, name: "ᴋᴀʀᴍᴀ ʏᴏɢᴀ", meaning: "ᴛʜᴇ ʏᴏɢᴀ ᴏꜰ ᴀᴄᴛɪᴏɴ", verses: 43 },
            { num: 4, name: "ᴊɴᴀɴᴀ ᴋᴀʀᴍᴀ sᴀɴʏᴀsᴀ ʏᴏɢᴀ", meaning: "ᴛʜᴇ ʏᴏɢᴀ ᴏꜰ ᴋɴᴏᴡʟᴇᴅɢᴇ ᴀɴᴅ ᴀᴄᴛɪᴏɴ", verses: 42 },
            { num: 5, name: "ᴋᴀʀᴍᴀ sᴀɴʏᴀsᴀ ʏᴏɢᴀ", meaning: "ᴛʜᴇ ʏᴏɢᴀ ᴏꜰ ʀᴇɴᴜɴᴄɪᴀᴛɪᴏɴ", verses: 29 },
            { num: 6, name: "ᴅʜʏᴀɴᴀ ʏᴏɢᴀ", meaning: "ᴛʜᴇ ʏᴏɢᴀ ᴏꜰ ᴍᴇᴅɪᴛᴀᴛɪᴏɴ", verses: 47 },
            { num: 7, name: "ᴊɴᴀɴᴀ ᴠɪᴊɴᴀɴᴀ ʏᴏɢᴀ", meaning: "ᴛʜᴇ ʏᴏɢᴀ ᴏꜰ ᴋɴᴏᴡʟᴇᴅɢᴇ ᴀɴᴅ ᴡɪsᴅᴏᴍ", verses: 30 },
            { num: 8, name: "ᴀᴋsᴀʀᴀ ʙʀᴀʜᴍᴀ ʏᴏɢᴀ", meaning: "ᴛʜᴇ ʏᴏɢᴀ ᴏꜰ ᴛʜᴇ ɪᴍᴘᴇʀɪsʜᴀʙʟᴇ ʙʀᴀʜᴍᴀɴ", verses: 28 },
            { num: 9, name: "ʀᴀᴊᴀ ᴠɪᴅʏᴀ ʀᴀᴊᴀ ɢᴜʜʏᴀ ʏᴏɢᴀ", meaning: "ᴛʜᴇ ʏᴏɢᴀ ᴏꜰ ʀᴏʏᴀʟ ᴋɴᴏᴡʟᴇᴅɢᴇ", verses: 34 },
            { num: 10, name: "ᴠɪʙʜᴜᴛɪ ʏᴏɢᴀ", meaning: "ᴛʜᴇ ʏᴏɢᴀ ᴏꜰ ᴅɪᴠɪɴᴇ ɢʟᴏʀɪᴇs", verses: 42 },
            { num: 11, name: "ᴠɪsᴠᴀʀᴜᴘᴀ ᴅᴀʀsᴀɴᴀ ʏᴏɢᴀ", meaning: "ᴛʜᴇ ʏᴏɢᴀ ᴏꜰ ᴛʜᴇ ᴜɴɪᴠᴇʀsᴀʟ ꜰᴏʀᴍ", verses: 55 },
            { num: 12, name: "ʙʜᴀᴋᴛɪ ʏᴏɢᴀ", meaning: "ᴛʜᴇ ʏᴏɢᴀ ᴏꜰ ᴅᴇᴠᴏᴛɪᴏɴ", verses: 20 },
            { num: 13, name: "ᴋsᴇᴛʀᴀ ᴋsᴇᴛʀᴀᴊɴᴀ ᴠɪʙʜᴀɢᴀ ʏᴏɢᴀ", meaning: "ᴛʜᴇ ʏᴏɢᴀ ᴏꜰ ᴛʜᴇ ꜰɪᴇʟᴅ ᴀɴᴅ ᴋɴᴏᴡᴇʀ", verses: 35 },
            { num: 14, name: "ɢᴜɴᴀᴛʀᴀʏᴀ ᴠɪʙʜᴀɢᴀ ʏᴏɢᴀ", meaning: "ᴛʜᴇ ʏᴏɢᴀ ᴏꜰ ᴛʜᴇ ᴛʜʀᴇᴇ ɢᴜɴᴀs", verses: 27 },
            { num: 15, name: "ᴘᴜʀᴜsᴏᴛᴛᴀᴍᴀ ʏᴏɢᴀ", meaning: "ᴛʜᴇ ʏᴏɢᴀ ᴏꜰ ᴛʜᴇ sᴜᴘʀᴇᴍᴇ ᴘᴇʀsᴏɴ", verses: 20 },
            { num: 16, name: "ᴅᴀɪᴠᴀsᴜʀᴀ sᴀᴍᴘᴀᴅ ᴠɪʙʜᴀɢᴀ ʏᴏɢᴀ", meaning: "ᴛʜᴇ ʏᴏɢᴀ ᴏꜰ ᴅɪᴠɪɴᴇ ᴀɴᴅ ᴅᴇᴍᴏɴɪᴄ ɴᴀᴛᴜʀᴇs", verses: 24 },
            { num: 17, name: "sʀᴀᴅᴅʜᴀᴛʀᴀʏᴀ ᴠɪʙʜᴀɢᴀ ʏᴏɢᴀ", meaning: "ᴛʜᴇ ʏᴏɢᴀ ᴏꜰ ᴛʜᴇ ᴛʜʀᴇᴇꜰᴏʟᴅ ꜰᴀɪᴛʜ", verses: 28 },
            { num: 18, name: "ᴍᴏᴋsᴀ sᴀɴʏᴀsᴀ ʏᴏɢᴀ", meaning: "ᴛʜᴇ ʏᴏɢᴀ ᴏꜰ ʟɪʙᴇʀᴀᴛɪᴏɴ", verses: 78 }
        ];

        if (!q) {
            let list = `🕉️ *ʙʜᴀɢᴀᴠᴀᴅ ɢɪᴛᴀ - 18 ᴄʜᴀᴘᴛᴇʀs*\n\n`;
            chapters.forEach(c => {
                list += `*${c.num}. ${c.name}*\n   ${c.meaning} (${c.verses} ᴠᴇʀsᴇs)\n\n`;
            });
            list += `📌 ᴜsᴇ: .ɢɪᴛᴀ <ɴᴜᴍʙᴇʀ>`;
            return reply(list);
        }

        const num = parseInt(q.trim());
        if (isNaN(num) || num < 1 || num > 18) {
            return reply("❌ ɪɴᴠᴀʟɪᴅ ᴄʜᴀᴘᴛᴇʀ. ᴄʜᴏᴏsᴇ 1-18.");
        }

        const ch = chapters[num - 1];
        await conn.sendMessage(from, {
            text: `🕉️ *ʙʜᴀɢᴀᴠᴀᴅ ɢɪᴛᴀ - ᴄʜᴀᴘᴛᴇʀ ${ch.num}*\n\n📖 *${ch.name}*\n💡 *ᴍᴇᴀɴɪɴɢ:* ${ch.meaning}\n📊 *ᴠᴇʀsᴇs:* ${ch.verses}\n\n_"ʏᴏᴜ ʜᴀᴠᴇ ᴛʜᴇ ʀɪɢʜᴛ ᴛᴏ ᴡᴏʀᴋ, ʙᴜᴛ ɴᴇᴠᴇʀ ᴛᴏ ᴛʜᴇ ꜰʀᴜɪᴛ ᴏꜰ ᴡᴏʀᴋ."_ — ʙɢ 2.47`
        }, { quoted: anony });
    } catch (e) {
        console.error('ɢɪᴛᴀ ᴇʀʀᴏʀ:', e);
        reply("ᴇʀʀᴏʀ ꜰᴇᴛᴄʜɪɴɢ ɢɪᴛᴀ ᴄʜᴀᴘᴛᴇʀ.");
    }
});

// --- GITA VERSE ---
cmd({
    pattern: "gitaverse",
    alias: ["krishnaquote"],
    react: "🕉️",
    desc: "Get a random Bhagavad Gita verse",
    category: "religion",
    use: ".gitaverse",
    filename: __filename
}, async (conn, mek, m, { from }) => {
    try {
        const verses = [
            { ref: "2.47", text: "ʏᴏᴜ ʜᴀᴠᴇ ᴀ ʀɪɢʜᴛ ᴛᴏ ᴘᴇʀꜰᴏʀᴍ ʏᴏᴜʀ ᴘʀᴇsᴄʀɪʙᴇᴅ ᴅᴜᴛɪᴇs, ʙᴜᴛ ʏᴏᴜ ᴀʀᴇ ɴᴏᴛ ᴇɴᴛɪᴛʟᴇᴅ ᴛᴏ ᴛʜᴇ ꜰʀᴜɪᴛs ᴏꜰ ʏᴏᴜʀ ᴀᴄᴛɪᴏɴs." },
            { ref: "2.20", text: "ᴛʜᴇ sᴏᴜʟ ɪs ɴᴇɪᴛʜᴇʀ ʙᴏʀɴ, ᴀɴᴅ ɴᴏʀ ᴅᴏᴇs ɪᴛ ᴅɪᴇ ᴀᴛ ᴀɴʏ ᴛɪᴍᴇ. ɪᴛ ɪs ᴇᴛᴇʀɴᴀʟ, ᴜɴʙᴏʀɴ, ᴀɴᴅ ᴇᴠᴇʀ-ᴇxɪsᴛɪɴɢ." },
            { ref: "4.7-8", text: "ᴡʜᴇɴᴇᴠᴇʀ ᴛʜᴇʀᴇ ɪs ᴀ ᴅᴇᴄʟɪɴᴇ ɪɴ ʀɪɢʜᴛᴇᴏᴜsɴᴇss, ɪ ᴍᴀɴɪꜰᴇsᴛ ᴍʏsᴇʟꜰ. ꜰᴏʀ ᴛʜᴇ ᴘʀᴏᴛᴇᴄᴛɪᴏɴ ᴏꜰ ᴛʜᴇ ɢᴏᴏᴅ ᴀɴᴅ ᴅᴇsᴛʀᴜᴄᴛɪᴏɴ ᴏꜰ ᴛʜᴇ ᴡɪᴄᴋᴇᴅ." },
            { ref: "6.5", text: "ᴇʟᴇᴠᴀᴛᴇ ʏᴏᴜʀsᴇʟꜰ ᴛʜʀᴏᴜɢʜ ᴛʜᴇ ᴘᴏᴡᴇʀ ᴏꜰ ʏᴏᴜʀ ᴍɪɴᴅ, ᴀɴᴅ ɴᴏᴛ ᴅᴇɢʀᴀᴅᴇ ʏᴏᴜʀsᴇʟꜰ." },
            { ref: "9.22", text: "ᴛᴏ ᴛʜᴏsᴇ ᴡʜᴏ ᴀʀᴇ ᴄᴏɴsᴛᴀɴᴛʟʏ ᴅᴇᴠᴏᴛᴇᴅ ᴀɴᴅ ᴡᴏʀsʜɪᴘ ᴍᴇ ᴡɪᴛʜ ʟᴏᴠᴇ, ɪ ɢɪᴠᴇ ᴛʜᴇ ᴜɴᴅᴇʀsᴛᴀɴᴅɪɴɢ ʙʏ ᴡʜɪᴄʜ ᴛʜᴇʏ ᴄᴀɴ ᴄᴏᴍᴇ ᴛᴏ ᴍᴇ." },
            { ref: "18.66", text: "ᴀʙᴀɴᴅᴏɴ ᴀʟʟ ᴠᴀʀɪᴇᴛɪᴇs ᴏꜰ ᴅʜᴀʀᴍᴀ ᴀɴᴅ sɪᴍᴘʟʏ sᴜʀʀᴇɴᴅᴇʀ ᴜɴᴛᴏ ᴍᴇ ᴀʟᴏɴᴇ. ɪ sʜᴀʟʟ ʟɪʙᴇʀᴀᴛᴇ ʏᴏᴜ ꜰʀᴏᴍ ᴀʟʟ sɪɴꜰᴜʟ ʀᴇᴀᴄᴛɪᴏɴs; ᴅᴏ ɴᴏᴛ ꜰᴇᴀʀ." },
            { ref: "2.14", text: "ʜᴀᴘᴘɪɴᴇss ᴀɴᴅ ᴅɪsᴛʀᴇss ᴀʀᴇ ᴛᴇᴍᴘᴏʀᴀʀʏ. ᴏɴᴇ ᴍᴜsᴛ ʟᴇᴀʀɴ ᴛᴏ ᴛᴏʟᴇʀᴀᴛᴇ ᴛʜᴇᴍ ᴡɪᴛʜᴏᴜᴛ ʙᴇɪɴɢ ᴅɪsᴛᴜʀʙᴇᴅ." }
        ];
        const v = verses[Math.floor(Math.random() * verses.length)];
        conn.sendMessage(from, { text: `🕉️ *ʙʜᴀɢᴀᴠᴀᴅ ɢɪᴛᴀ ${v.ref}*\n\n${v.text}` }, { quoted: anony });
    } catch (e) {
        console.error('ɢɪᴛᴀᴠᴇʀsᴇ ᴇʀʀᴏʀ:', e);
    }
});

// --- DHAMMAPADA ---
cmd({
    pattern: "dhammapada",
    alias: ["buddhaquote"],
    react: "☸️",
    desc: "Get a random Dhammapada verse",
    category: "religion",
    use: ".dhammapada",
    filename: __filename
}, async (conn, mek, m, { from }) => {
    try {
        const verses = [
            { ref: "1:1", text: "ᴀʟʟ ᴍᴇɴᴛᴀʟ ᴘʜᴇɴᴏᴍᴇɴᴀ ʜᴀᴠᴇ ᴍɪɴᴅ ᴀs ᴛʜᴇɪʀ ꜰᴏʀᴇʀᴜɴɴᴇʀ. ɪꜰ ᴏɴᴇ sᴘᴇᴀᴋs ᴏʀ ᴀᴄᴛs ᴡɪᴛʜ ᴀɴ ᴇᴠɪʟ ᴍɪɴᴅ, sᴜꜰꜰᴇʀɪɴɢ ꜰᴏʟʟᴏᴡs ʜɪᴍ." },
            { ref: "1:2", text: "ɪꜰ ᴏɴᴇ sᴘᴇᴀᴋs ᴏʀ ᴀᴄᴛs ᴡɪᴛʜ ᴀ ᴘᴜʀᴇ ᴍɪɴᴅ, ʜᴀᴘᴘɪɴᴇss ꜰᴏʟʟᴏᴡs ʜɪᴍ, ʟɪᴋᴇ ᴀ sʜᴀᴅᴏᴡ ᴛʜᴀᴛ ɴᴇᴠᴇʀ ʟᴇᴀᴠᴇs ʜɪᴍ." },
            { ref: "1:5", text: "ʜᴀᴛʀᴇᴅ ɪs ɴᴇᴠᴇʀ ᴀᴘᴘᴇᴀsᴇᴅ ʙʏ ʜᴀᴛʀᴇᴅ ɪɴ ᴛʜɪs ᴡᴏʀʟᴅ. ʙʏ ɴᴏɴ-ʜᴀᴛʀᴇᴅ ᴀʟᴏɴᴇ ɪs ʜᴀᴛʀᴇᴅ ᴀᴘᴘᴇᴀsᴇᴅ." },
            { ref: "2:1", text: "ᴡᴀᴋᴇꜰᴜʟɴᴇss ɪs ᴛʜᴇ ᴡᴀʏ ᴛᴏ ʟɪꜰᴇ. ᴛʜᴇ ꜰᴏᴏʟ sʟᴇᴇᴘs ᴀs ɪꜰ ʜᴇ ᴡᴇʀᴇ ᴀʟʀᴇᴀᴅʏ ᴅᴇᴀᴅ, ʙᴜᴛ ᴛʜᴇ ᴍᴀsᴛᴇʀ ɪs ᴀᴡᴀᴋᴇ." },
            { ref: "5:1", text: "ʙᴇᴛᴛᴇʀ ᴛʜᴀɴ ᴀ ᴛʜᴏᴜsᴀɴᴅ ʜᴏʟʟᴏᴡ ᴡᴏʀᴅs ɪs ᴏɴᴇ ᴡᴏʀᴅ ᴛʜᴀᴛ ʙʀɪɴɢs ᴘᴇᴀᴄᴇ." },
            { ref: "10:1", text: "ʙᴇᴛᴛᴇʀ ᴛʜᴀɴ ᴀ ᴛʜᴏᴜsᴀɴᴅ ᴜsᴇʟᴇss ᴠᴇʀsᴇs ɪs ᴏɴᴇ ᴜsᴇꜰᴜʟ ᴠᴇʀsᴇ." },
            { ref: "20:1", text: "ɪꜰ ʏᴏᴜ ꜰɪɴᴅ ɴᴏ ᴏɴᴇ ᴛᴏ sᴜᴘᴘᴏʀᴛ ʏᴏᴜ ᴏɴ ᴛʜᴇ sᴘɪʀɪᴛᴜᴀʟ ᴘᴀᴛʜ, ᴡᴀʟᴋ ᴀʟᴏɴᴇ." }
        ];
        const v = verses[Math.floor(Math.random() * verses.length)];
        conn.sendMessage(from, { text: `☸️ *ᴅʜᴀᴍᴍᴀᴘᴀᴅᴀ ${v.ref}*\n\n${v.text}\n\n_— ᴛʜᴇ ʙᴜᴅᴅʜᴀ_` }, { quoted: anony });
    } catch (e) {
        console.error('ᴅʜᴀᴍᴍᴀᴘᴀᴅᴀ ᴇʀʀᴏʀ:', e);
    }
});

// --- ZEN QUOTE ---
cmd({
    pattern: "zen",
    alias: ["zenquote"],
    react: "☸️",
    desc: "Get a random Zen quote",
    category: "religion",
    use: ".zen",
    filename: __filename
}, async (conn, mek, m, { from }) => {
    try {
        const res = await fetch('https://zenquotes.io/api/random');
        const data = await res.json();
        conn.sendMessage(from, { text: `☸️ *ᴢᴇɴ ᴡɪsᴅᴏᴍ*\n\n"${data[0].q}"\n\n— ${data[0].a}` }, { quoted: anony });
    } catch (e) {
        const fallbacks = [
            "sɪᴛᴛɪɴɢ ǫᴜɪᴇᴛʟʏ, ᴅᴏɪɴɢ ɴᴏᴛʜɪɴɢ, sᴘʀɪɴɢ ᴄᴏᴍᴇs, ᴀɴᴅ ᴛʜᴇ ɢʀᴀss ɢʀᴏᴡs ʙʏ ɪᴛsᴇʟꜰ. — ʙᴀsʜᴏ",
            "ᴛʜᴇ ᴏʙsᴛᴀᴄʟᴇ ɪs ᴛʜᴇ ᴘᴀᴛʜ. — ᴢᴇɴ ᴘʀᴏᴠᴇʀʙ",
            "ᴡʜᴇɴ ʏᴏᴜ ʀᴇᴀʟɪᴢᴇ ɴᴏᴛʜɪɴɢ ɪs ʟᴀᴄᴋɪɴɢ, ᴛʜᴇ ᴡʜᴏʟᴇ ᴡᴏʀʟᴅ ʙᴇʟᴏɴɢs ᴛᴏ ʏᴏᴜ. — ʟᴀᴏ ᴛᴢᴜ",
            "ʟᴇᴛ ɢᴏ ᴏꜰ ʏᴏᴜʀ ᴍɪɴᴅ ᴀɴᴅ ᴛʜᴇɴ ʙᴇ ᴍɪɴᴅꜰᴜʟ. — ʀᴜᴍɪ"
        ];
        const q = fallbacks[Math.floor(Math.random() * fallbacks.length)];
        conn.sendMessage(from, { text: `☸️ *ᴢᴇɴ ᴡɪsᴅᴏᴍ*\n\n${q}` }, { quoted: anony });
    }
});

// --- GURBANI ---
cmd({
    pattern: "gurbani",
    alias: ["sikhquote"],
    react: "🪯",
    desc: "Get a random Sikh wisdom quote",
    category: "religion",
    use: ".gurbani",
    filename: __filename
}, async (conn, mek, m, { from }) => {
    try {
        const quotes = [
            "ᴏɴᴇ ᴡʜᴏ ᴘʀᴀᴄᴛɪᴄᴇs ᴛʀᴜᴛʜ, ᴄᴏɴᴛᴇɴᴛᴍᴇɴᴛ, ᴄᴏᴍᴘᴀssɪᴏɴ, ᴀɴᴅ ᴅʜᴀʀᴍᴀ — ʀᴇᴀʟɪᴢᴇ ᴛʜᴇ ᴇssᴇɴᴄᴇ ᴏꜰ ᴛʜᴇ ᴏɴᴇ. — ɢᴜʀᴜ ɢʀᴀɴᴛʜ sᴀʜɪʙ",
            "ᴅᴏ ɴᴏᴛ ʙᴇ ᴘʀᴏᴜᴅ ᴏꜰ ʏᴏᴜʀ ʏᴏᴜᴛʜ, ᴡᴇᴀʟᴛʜ, ᴏʀ ᴘᴏᴡᴇʀ; ᴛʜᴇsᴇ ᴛʜɪɴɢs ᴀʀᴇ ʟɪᴋᴇ ᴀ ᴘᴀssɪɴɢ ᴄʟᴏᴜᴅ. — ɢᴜʀᴜ ɢʀᴀɴᴛʜ sᴀʜɪʙ",
            "ɴᴀɴᴀᴋ sᴀʏs: ᴛʜᴏsᴇ ᴡʜᴏ ᴍᴇᴅɪᴛᴀᴛᴇ ᴏɴ ᴛʜᴇ ɴᴀᴍᴇ ᴏꜰ ᴛʜᴇ ʟᴏʀᴅ sʜᴀʟʟ ʙᴇ sᴀᴠᴇᴅ. — ɢᴜʀᴜ ɢʀᴀɴᴛʜ sᴀʜɪʙ",
            "ᴛʀᴜᴛʜ ɪs ʜɪɢʜᴇʀ ᴛʜᴀɴ ᴇᴠᴇʀʏᴛʜɪɴɢ; ʙᴜᴛ ʜɪɢʜᴇʀ sᴛɪʟʟ ɪs ᴛʀᴜᴛʜꜰᴜʟ ʟɪᴠɪɴɢ. — ɢᴜʀᴜ ɴᴀɴᴀᴋ",
            "ᴛʜᴇʀᴇ ɪs ɴᴏ ʜɪɴᴅᴜ, ᴛʜᴇʀᴇ ɪs ɴᴏ ᴍᴜsʟɪᴍ — ᴏɴʟʏ ᴏɴᴇ ʜᴜᴍᴀɴɪᴛʏ. — ɢᴜʀᴜ ɴᴀɴᴀᴋ",
            "ʜᴇ ᴡʜᴏ sᴇʀᴠᴇs ᴏᴛʜᴇʀs ᴡɪᴛʜ ʟᴏᴠᴇ ɪs ᴛʜᴇ ᴛʀᴜᴇ sɪᴋʜ ᴏꜰ ᴛʜᴇ ɢᴜʀᴜ. — ɢᴜʀᴜ ɢʀᴀɴᴛʜ sᴀʜɪʙ"
        ];
        const q = quotes[Math.floor(Math.random() * quotes.length)];
        conn.sendMessage(from, { text: `🪯 *ɢᴜʀʙᴀɴɪ / sɪᴋʜ ᴡɪsᴅᴏᴍ*\n\n${q}` }, { quoted: anony });
    } catch (e) {
        console.error('ɢᴜʀʙᴀɴɪ ᴇʀʀᴏʀ:', e);
    }
});

// --- TAO TE CHING ---
cmd({
    pattern: "tao",
    alias: ["taoteching", "laotzu"],
    react: "☯️",
    desc: "Get a random Tao Te Ching verse",
    category: "religion",
    use: ".tao",
    filename: __filename
}, async (conn, mek, m, { from }) => {
    try {
        const verses = [
            "ᴛʜᴇ ᴛᴀᴏ ᴛʜᴀᴛ ᴄᴀɴ ʙᴇ ᴛᴏʟᴅ ɪs ɴᴏᴛ ᴛʜᴇ ᴇᴛᴇʀɴᴀʟ ᴛᴀᴏ. — ᴛᴀᴏ ᴛᴇ ᴄʜɪɴɢ ᴄʜ. 1",
            "ᴛʜᴇ ʜɪɢʜᴇsᴛ ɢᴏᴏᴅ ɪs ʟɪᴋᴇ ᴡᴀᴛᴇʀ. ᴡᴀᴛᴇʀ ɢɪᴠᴇs ʟɪꜰᴇ ᴛᴏ ᴛʜᴇ ᴛᴇɴ ᴛʜᴏᴜsᴀɴᴅ ᴛʜɪɴɢs ᴀɴᴅ ᴅᴏᴇs ɴᴏᴛ sᴛʀɪᴠᴇ. — ᴛᴀᴏ ᴛᴇ ᴄʜɪɴɢ ᴄʜ. 8",
            "ᴀ ᴊᴏᴜʀɴᴇʏ ᴏꜰ ᴀ ᴛʜᴏᴜsᴀɴᴅ ᴍɪʟᴇs ʙᴇɢɪɴs ᴡɪᴛʜ ᴀ sɪɴɢʟᴇ sᴛᴇᴘ. — ᴛᴀᴏ ᴛᴇ ᴄʜɪɴɢ ᴄʜ. 64",
            "ᴋɴᴏᴡɪɴɢ ᴏᴛʜᴇʀs ɪs ɪɴᴛᴇʟʟɪɢᴇɴᴄᴇ; ᴋɴᴏᴡɪɴɢ ʏᴏᴜʀsᴇʟꜰ ɪs ᴛʀᴜᴇ ᴡɪsᴅᴏᴍ. — ᴛᴀᴏ ᴛᴇ ᴄʜɪɴɢ ᴄʜ. 33",
            "ɴᴀᴛᴜʀᴇ ᴅᴏᴇs ɴᴏᴛ ʜᴜʀʀʏ, ʏᴇᴛ ᴇᴠᴇʀʏᴛʜɪɴɢ ɪs ᴀᴄᴄᴏᴍᴘʟɪsʜᴇᴅ. — ʟᴀᴏ ᴛᴢᴜ",
            "ᴄᴀʀᴇ ᴀʙᴏᴜᴛ ᴡʜᴀᴛ ᴏᴛʜᴇʀ ᴘᴇᴏᴘʟᴇ ᴛʜɪɴᴋ ᴀɴᴅ ʏᴏᴜ ᴡɪʟʟ ᴀʟᴡᴀʏs ʙᴇ ᴛʜᴇɪʀ ᴘʀɪsᴏɴᴇʀ. — ʟᴀᴏ ᴛᴢᴜ"
        ];
        const q = verses[Math.floor(Math.random() * verses.length)];
        conn.sendMessage(from, { text: `☯️ *ᴛᴀᴏɪsᴛ ᴡɪsᴅᴏᴍ*\n\n${q}` }, { quoted: anony });
    } catch (e) {
        console.error('ᴛᴀᴏ ᴇʀʀᴏʀ:', e);
    }
});

// --- VERSE365 ---
cmd({
    pattern: "verse365",
    alias: ["inspiration"],
    react: "🌍",
    desc: "Get daily spiritual wisdom from various traditions",
    category: "religion",
    use: ".verse365",
    filename: __filename
}, async (conn, mek, m, { from }) => {
    try {
        const sources = [
            { name: "🕉️ ʙʜᴀɢᴀᴠᴀᴅ ɢɪᴛᴀ", text: "sᴇᴛ ᴛʜʏ ʜᴇᴀʀᴛ ᴜᴘᴏɴ ᴛʜʏ ᴡᴏʀᴋ, ʙᴜᴛ ɴᴇᴠᴇʀ ᴏɴ ɪᴛs ʀᴇᴡᴀʀᴅ." },
            { name: "✡️ ᴘɪʀᴋᴇɪ ᴀᴠᴏᴛ", text: "ᴡʜᴏ ɪs ᴡɪsᴇ? ʜᴇ ᴡʜᴏ ʟᴇᴀʀɴs ꜰʀᴏᴍ ᴇᴠᴇʀʏ ᴘᴇʀsᴏɴ." },
            { name: "✝️ ʙɪʙʟᴇ", text: "ɪ ᴄᴀɴ ᴅᴏ ᴀʟʟ ᴛʜɪɴɢs ᴛʜʀᴏᴜɢʜ ᴄʜʀɪsᴛ ᴡʜᴏ sᴛʀᴇɴɢᴛʜᴇɴs ᴍᴇ. — ᴘʜɪʟɪᴘᴘɪᴀɴs 4:13" },
            { name: "☪️ ǫᴜʀᴀɴ", text: "ᴠᴇʀɪʟʏ, ᴡɪᴛʜ ʜᴀʀᴅsʜɪᴘ ᴄᴏᴍᴇs ᴇᴀsᴇ. — sᴜʀᴀʜ ᴀsʜ-sʜᴀʀʜ 94:6" },
            { name: "☸️ ᴅʜᴀᴍᴍᴀᴘᴀᴅᴀ", text: "ʙᴇᴛᴛᴇʀ ᴛʜᴀɴ ᴀ ᴛʜᴏᴜsᴀɴᴅ ʜᴏʟʟᴏᴡ ᴡᴏʀᴅs ɪs ᴏɴᴇ ᴡᴏʀᴅ ᴛʜᴀᴛ ʙʀɪɴɢs ᴘᴇᴀᴄᴇ." },
            { name: "🪯 ɢᴜʀʙᴀɴɪ", text: "ᴛʀᴜᴛʜ ɪs ʜɪɢʜᴇʀ ᴛʜᴀɴ ᴇᴠᴇʀʏᴛʜɪɴɢ; ʙᴜᴛ ʜɪɢʜᴇʀ sᴛɪʟʟ ɪs ᴛʀᴜᴛʜꜰᴜʟ ʟɪᴠɪɴɢ." },
            { name: "☯️ ᴛᴀᴏ ᴛᴇ ᴄʜɪɴɢ", text: "ᴀ ᴊᴏᴜʀɴᴇʏ ᴏꜰ ᴀ ᴛʜᴏᴜsᴀɴᴅ ᴍɪʟᴇs ʙᴇɢɪɴs ᴡɪᴛʜ ᴀ sɪɴɢʟᴇ sᴛᴇᴘ." }
        ];
        const s = sources[Math.floor(Math.random() * sources.length)];
        conn.sendMessage(from, {
            text: `🌍 *ᴅᴀɪʟʏ sᴘɪʀɪᴛᴜᴀʟ ᴡɪsᴅᴏᴍ*\n\n*${s.name}*\n\n"${s.text}"`
        }, { quoted: anony });
    } catch (e) {
        console.error('ᴠᴇʀsᴇ365 ᴇʀʀᴏʀ:', e);
    }
});
// --- WORDOFDAY ---
cmd({
    pattern: "wordofday",
    react: "📖",
    desc: "Get a random word of the day",
    category: "fun",
    use: ".wordofday",
    filename: __filename
}, async (conn, mek, m, { from, reply }) => {
    try {
        let res = await fetch("https://random-word-api.herokuapp.com/word");
        let json = await res.json();
        reply(`📖 *ᴡᴏʀᴅ ᴏꜰ ᴛʜᴇ ᴅᴀʏ*\n${json[0]}`);
    } catch (e) {
        console.error('ᴡᴏʀᴅᴏꜰᴅᴀʏ ᴇʀʀᴏʀ:', e);
        reply("ᴇʀʀᴏʀ ꜰᴇᴛᴄʜɪɴɢ ᴡᴏʀᴅ.");
    }
});

// --- HISTORYFACT ---
cmd({
    pattern: "historyfact",
    react: "📜",
    desc: "Get a random history fact",
    category: "fun",
    use: ".historyfact",
    filename: __filename
}, async (conn, mek, m, { from, reply }) => {
    try {
        let res = await fetch("https://history.muffinlabs.com/date");
        let json = await res.json();

        let fact = json.data.Events[Math.floor(Math.random() * json.data.Events.length)];
        reply(`📜 *ʜɪꜱᴛᴏʀʏ ꜰᴀᴄᴛ*\n${fact.year} - ${fact.text}`);
    } catch (e) {
        console.error('ʜɪꜱᴛᴏʀʏꜰᴀᴄᴛ ᴇʀʀᴏʀ:', e);
        reply("ᴇʀʀᴏʀ ꜰᴇᴛᴄʜɪɴɢ ʜɪꜱᴛᴏʀʏ.");
    }
});

// --- APK ---
cmd({
    pattern: "apk",
    react: "📥",
    desc: "Download APK from APKCombo",
    category: "downloader",
    use: ".apk <app name>",
    filename: __filename
}, async (conn, mek, m, { from, reply, q }) => {
    try {
        if (!q) return reply("ᴇxᴀᴍᴘʟᴇ: .ᴀᴘᴋ ᴛᴇʟᴇɢʀᴀᴍ");

        const apiUrl = `https://api.stiantech.me/api/tools/apkcombo?name=${encodeURIComponent(q)}`;
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer st_51dd79f78cc78fe21d6cdafed5a3a2f1'
            }
        });
        const json = await response.json();

        if (!json.success || !json.result) {
            return reply("ᴀᴘᴘ ɴᴏᴛ ꜰᴏᴜɴᴅ ᴏʀ ᴀᴘɪ ᴇʀʀᴏʀ.");
        }

        const app = json.result;

        let caption = `📥 *ᴀᴘᴋ ᴅᴏᴡɴʟᴏᴀᴅ*\n\n📛 ɴᴀᴍᴇ: ${app.name || 'ɴ/ᴀ'}\n📦 ᴘᴀᴄᴋᴀɢᴇ: ${app.package || 'ɴ/ᴀ'}\n⭐ ʀᴀᴛɪɴɢ: ${app.rating || 'ɴ/ᴀ'}\n📥 ᴅᴏᴡɴʟᴏᴀᴅꜱ: ${app.downloads || 'ɴ/ᴀ'}\n📅 ᴜᴘᴅᴀᴛᴇᴅ: ${app.updated || 'ɴ/ᴀ'}\n📦 ꜱɪᴢᴇ: ${app.size || 'ɴ/ᴀ'}\n\n🔗 ᴅᴏᴡɴʟᴏᴀᴅ: ${app.downloadUrl || app.link || 'ɴ/ᴀ'}\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʀɪᴅᴢ ᴄᴏᴅᴇʀ`;

        if (app.icon) {
            await conn.sendMessage(from, { image: { url: app.icon }, caption }, { quoted: anony });
        } else {
            await conn.sendMessage(from, { text: caption }, { quoted: anony });
        }

        const downloadLink = app.downloadUrl || app.link;
        if (downloadLink) {
            await conn.sendMessage(from, {
                document: { url: downloadLink },
                fileName: `${app.name || 'app'}.apk`,
                mimetype: "application/vnd.android.package-archive"
            }, { quoted: anony });
        }
    } catch (e) {
        console.error('ᴀᴘᴋ ᴇʀʀᴏʀ:', e);
        reply("ᴇʀʀᴏʀ ꜰᴇᴛᴄʜɪɴɢ ᴀᴘᴘ.");
    }
});

// --- SUPPORT ---
cmd({
    pattern: "support",
    react: "🌋",
    desc: "Get support info",
    category: "info",
    use: ".support",
    filename: __filename
}, async (conn, mek, m, { from }) => {
    try {
        let dec = `    
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
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: "120363404529319592@newsletter",
                    newsletterName: "ᴀɪʀʙʏᴛᴇ ꜱʏɴᴇʀɢᴇᴛɪᴄ ʟᴀʙꜱ🌋",
                    serverMessageId: 143
                }
            }
        }, { quoted: anony });
    } catch (e) {
        console.error('ꜱᴜᴘᴘᴏʀᴛ ᴇʀʀᴏʀ:', e);
        m.reply("ᴇʀʀᴏʀ");
    }
});

// --- FAMILY ---
cmd({
    pattern: "family",
    react: "🌋",
    desc: "Show the bot family",
    category: "info",
    use: ".family",
    filename: __filename
}, async (conn, mek, m, { from }) => {
    try {
        let caption = `
      *╭┈──[ • ʀɪᴅᴢ ᴛᴇᴄʜ ꜰᴀᴍɪʟʏ • ]───•*
      *│  ◦* *▢➠*
      *│  ◦* *▢➠ ᴋᴇʟᴠɪɴ ᴛᴇᴄʜ*
      *│  ◦* *▢➠ ᴊᴇꜱꜱɪᴇ*
      *│  ◦* *▢➠ ʟɪᴠɪᴇ*
      *│  ◦* *▢➠ ᴘʀᴏꜱꜱɪᴇ*
      *│  ◦* *▢➠ ᴀɴᴅ ʏᴏᴜ*
      *╰┈───────────────•*
        *•────────────•⟢*
      ꜰᴀᴍɪʟʏ ɪꜱ ɴᴏᴛ ᴀʙᴏᴜᴛ ʙʟᴏᴏᴅ, ɪᴛ'ꜱ ᴀʙᴏᴜᴛ ᴛʜᴇ ᴘᴇᴏᴘʟᴇ ᴡʜᴏ ᴄʜᴏᴏꜱᴇ ᴛᴏ ʙᴇ ᴛʜᴇʀᴇ ꜰᴏʀ ʏᴏᴜ, ꜱᴜᴘᴘᴏʀᴛ ʏᴏᴜ, ᴀɴᴅ ʟᴏᴠᴇ ʏᴏᴜ ᴜɴᴄᴏɴᴅɪᴛɪᴏɴᴀʟʟʏ, ɴᴏ ᴍᴀᴛᴛᴇʀ ᴡʜᴀᴛ. ᴛʜᴇʏ'ʀᴇ ᴛʜᴇ ᴏɴᴇꜱ ᴡʜᴏ ꜱʜᴏᴡ ᴜᴘ, ᴡʜᴏ ʟɪꜱᴛᴇɴ, ᴀɴᴅ ᴡʜᴏ ᴄᴀʀᴇ 🤗
`;

        await conn.sendMessage(from, {
            image: { url: "https://files.catbox.moe/oyadfh.png" },
            caption: caption,
            contextInfo: {
                mentionedJid: [m.sender],
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: "120363404529319592@newsletter",
                    newsletterName: "ᴘʀɪᴍᴇ ʀɪᴅᴢ🪀",
                    serverMessageId: 143
                }
            }
        }, { quoted: anony });
    } catch (e) {
        console.error('ꜰᴀᴍɪʟʏ ᴇʀʀᴏʀ:', e);
        m.reply("ᴇʀʀᴏʀ");
    }
});

// --- RIDZCODER / KAYIZA ---
cmd({
    pattern: "ridzcoder",
    alias: ["kayiza"],
    react: "🌋",
    desc: "Get info about the developer",
    category: "info",
    use: ".ridzcoder",
    filename: __filename
}, async (conn, mek, m, { from }) => {
    try {
        let caption = `
╭━━〔 ʀɪᴅᴢ ᴄᴏᴅᴇʀ ɪɴꜰᴏ〕━━┈⊷
┃★
┃★ •ʜᴇʟʟᴏ ᴛʜᴇʀᴇ 👋, ɪ ᴀᴍ ʀɪᴅᴢ ᴄᴏᴅᴇʀ.
┃★ •ɪ ʟᴀᴜɢʜ ᴀᴛ ᴇᴠᴇʀʏᴏɴᴇ ᴡʜᴏ ʟᴀᴜɢʜꜱ ᴀᴛ ᴍᴇ.
┃★ •ɪ ᴀᴍ ᴛʜᴇ ʟᴀꜱᴛ ᴛʜɪᴇꜰ, ʙᴜᴛ ᴅᴏɴ'ᴛ ᴄʜᴀꜱᴇ ᴀꜰᴛᴇʀ ᴍᴇ
┃★ •ʙᴇᴄᴀᴜꜱᴇ ɪ ᴡɪʟʟ ᴄʜᴀɴɢᴇ ᴍʏꜱᴇʟꜰ
┃★ •ᴀꜱᴋ ᴛʜᴇᴍ ᴀʟʟ ᴀɴᴅ ᴛʜᴇʏ ᴡɪʟʟ ᴛᴇʟʟ ʏᴏᴜ:
┃★ •ɪꜰ ʏᴏᴜ ꜱᴛᴀɴᴅ ʙᴇʜɪɴᴅ ᴍᴇ, ɪ ᴘʀᴏᴛᴇᴄᴛ ʏᴏᴜ.
┃★ •ɪꜰ ʏᴏᴜ ꜱᴛᴀɴᴅ ʙᴇꜱɪᴅᴇ ᴍᴇ, ɪ ʀᴇꜱᴘᴇᴄᴛ ʏᴏᴜ.
┃★ •ʙᴜᴛ ɪꜰ ʏᴏᴜ ꜱᴛᴀɴᴅ ᴀɢᴀɪɴꜱᴛ ᴍᴇ, ɪ ꜱʜᴏᴡ ɴᴏ ᴍᴇʀᴄʏ.
┃★
╰━━━━━━━━━━━━━━━┈⊷

> *ᴀ ꜱɪᴍᴘʟᴇ ᴡʜᴀᴛꜱᴀᴘᴘ ᴅᴇᴠᴇʟᴏᴘᴇʀ*

*╭━━━〔 • ᴍʏ ᴛᴏᴘ ꜰʀɪᴇɴᴅꜱ• 〕━━━┈⊷*
*┃★╭──────────────*
*┃★│* *▢ᴋᴇᴠɪɴ ᴛᴇᴄʜ*
*┃★│* *▢ᴊᴇꜱꜱɪᴇ*
*┃★│* *▢ᴘʀᴏꜱꜱɪᴇ*
*┃★│* *▢ʟɪᴠɪᴇ*
*┃★╰──────────────*
*╰━━━━━━━━━━━━━━━┈⊷*

*•────────────•⟢*
> © ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʀɪᴅᴢ ᴄᴏᴅᴇʀ
*•────────────•⟢*
`;

        await conn.sendMessage(from, {
            image: { url: "https://files.catbox.moe/oyadfh.png" },
            caption: caption,
            contextInfo: {
                mentionedJid: [m.sender],
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: "120363404529319592@newsletter",
                    newsletterName: "ᴘʀɪᴍᴇ ʀɪᴅᴢ🪀",
                    serverMessageId: 999
                }
            }
        }, { quoted: anony });
    } catch (e) {
        console.error('ʀɪᴅᴢᴄᴏᴅᴇʀ ᴇʀʀᴏʀ:', e);
        m.reply("ᴇʀʀᴏʀ");
    }
});
// Love Test
cmd({
    pattern: "lovetest",
    alias: ["love"],
    react: "🍹",
    desc: "Calculate love percentage between two users",
    category: "fun",
    use: ".lovetest @user1 @user2",
    filename: __filename
}, async (conn, mek, m, { from, reply, args }) => {
    if (args.length < 2) return reply("ᴛᴀɢ ᴛᴡᴏ ᴜꜱᴇʀꜱ! ᴇxᴀᴍᴘʟᴇ: .ʟᴏᴠᴇᴛᴇꜱᴛ @ᴜꜱᴇʀ1 @ᴜꜱᴇʀ2");

    let user1 = args[0].replace("@", "") + "@s.whatsapp.net";
    let user2 = args[1].replace("@", "") + "@s.whatsapp.net";
    let lovePercent = Math.floor(Math.random() * 100) + 1;

    let messages = [
        { range: [90, 100], text: "💖 *ᴍᴀᴛᴄʜ ᴍᴀᴅᴇ ɪɴ ʜᴇᴀᴠᴇɴ!* ᴛʀᴜᴇ ʟᴏᴠᴇ ᴇxɪꜱᴛꜱ!" },
        { range: [75, 89], text: "😍 *ꜱᴛʀᴏɴɢ ᴄᴏɴɴᴇᴄᴛɪᴏɴ!* ᴛʜɪꜱ ʟᴏᴠᴇ ɪꜱ ᴅᴇᴇᴘ ᴀɴᴅ ᴍᴇᴀɴɪɴɢꜰᴜʟ." },
        { range: [50, 74], text: "😊 *ɢᴏᴏᴅ ᴄᴏᴍᴘᴀᴛɪʙɪʟɪᴛʏ!* ʏᴏᴜ ʙᴏᴛʜ ᴄᴀɴ ᴍᴀᴋᴇ ɪᴛ ᴡᴏʀᴋ." },
        { range: [30, 49], text: "🤔 *ɪᴛ'ꜱ ᴄᴏᴍᴘʟɪᴄᴀᴛᴇᴅ!* ɴᴇᴇᴅ ᴇꜰꜰᴏʀᴛ, ʙᴜᴛ ᴘᴏꜱꜱɪʙʟᴇ!" },
        { range: [10, 29], text: "😅 *ɴᴏᴛ ᴛʜᴇ ʙᴇꜱᴛ ᴍᴀᴛᴄʜ!* ᴍᴀʏʙᴇ ᴛʀʏ ʙᴇɪɴɢ ꜰʀɪᴇɴᴅꜱ?" },
        { range: [1, 9], text: "💔 *ᴜʜ-ᴏʜʜ* ᴛʜɪꜱ ʟᴏᴠᴇ ɪꜱ ᴀꜱ ʀᴇᴀʟ ᴀꜱ ᴀ ʙᴏʟʟʏᴡᴏᴏᴅ ʙʀᴇᴀᴋᴜᴘ!" }
    ];

    let loveMessage = messages.find(msg => lovePercent >= msg.range[0] && lovePercent <= msg.range[1]).text;
    let message = `💘 *ʟᴏᴠᴇ ᴄᴏᴍᴘᴀᴛɪʙɪʟɪᴛʏ ᴛᴇꜱᴛ* 💘\n\n❤️ *@${user1.split("@")[0]}* + *@${user2.split("@")[0]}* = *${lovePercent}%*\n${loveMessage}`;

    await conn.sendMessage(from, { text: message, mentions: [user1, user2] }, { quoted: anony });
});

// Joke
cmd({
    pattern: "joke",
    alias: ["jokes", "funny"],
    react: "🍹",
    desc: "Get a random joke",
    category: "fun",
    use: ".joke",
    filename: __filename
}, async (conn, mek, m, { from, reply }) => {
    try {
        let res = await fetch("https://official-joke-api.appspot.com/random_joke");
        let json = await res.json();
        const joke = `${json.setup}\n\n${json.punchline}`;
        await conn.sendMessage(from, { text: joke }, { quoted: anony });
    } catch (error) {
        console.error(error);
        reply('ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴀᴛ ᴏᴜʀ ᴇɴᴅ.');
    }
});

// Valentine
cmd({
    pattern: "valentine",
    alias: ["valentines", "vday"],
    react: "🍹",
    desc: "Get a valentine message",
    category: "fun",
    use: ".valentine",
    filename: __filename
}, async (conn, mek, m, { from, reply }) => {
    try {
        const response = await axios.get('https://api.princetechn.com/api/fun/valentines?apikey=prince');
        if (response.data?.success && response.data?.result) {
            reply(response.data.result);
        } else {
            reply('ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴀᴛ ᴏᴜʀ ᴇɴᴅ.');
        }
    } catch (error) {
        console.error(error);
        reply('ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴀᴛ ᴏᴜʀ ᴇɴᴅ.');
    }
});

// Advice
cmd({
    pattern: "advice",
    alias: ["advicegenerator", "lifetips"],
    react: "🍹",
    desc: "Get a random advice",
    category: "fun",
    use: ".advice",
    filename: __filename
}, async (conn, mek, m, { from, reply }) => {
    try {
        const response = await axios.get('https://api.princetechn.com/api/fun/advice?apikey=prince');
        if (response.data?.success && response.data?.result) {
            reply(response.data.result);
        } else {
            reply('ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴀᴛ ᴏᴜʀ ᴇɴᴅ.');
        }
    } catch (error) {
        console.error(error);
        reply('ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴀᴛ ᴏᴜʀ ᴇɴᴅ.');
    }
});

// Motivation
cmd({
    pattern: "motivation",
    alias: ["motivate", "inspire"],
    react: "🍹",
    desc: "Get a random motivational quote",
    category: "fun",
    use: ".motivation",
    filename: __filename
}, async (conn, mek, m, { from, reply }) => {
    try {
        const response = await axios.get('https://api.princetechn.com/api/fun/motivation?apikey=prince');
        if (response.data?.success && response.data?.result) {
            reply(response.data.result);
        } else {
            reply('ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴀᴛ ᴏᴜʀ ᴇɴᴅ.');
        }
    } catch (error) {
        console.error(error);
        reply('ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴀᴛ ᴏᴜʀ ᴇɴᴅ.');
    }
});

// Character
cmd({
    pattern: "character",
    alias: ["char", "personality"],
    react: "🍹",
    desc: "Check a random character trait of a user",
    category: "fun",
    use: ".character @user",
    filename: __filename
}, async (conn, mek, m, { from, reply, isGroup }) => {
    try {
        if (!isGroup) {
            return reply("ᴛʜɪꜱ ᴄᴏᴍᴍᴀɴᴅ ᴄᴀɴ ᴏɴʟʏ ʙᴇ ᴜꜱᴇᴅ ɪɴ ɢʀᴏᴜᴘꜱ.");
        }

        const mentionedUser = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        if (!mentionedUser) {
            return reply("ᴘʟᴇᴀꜱᴇ ᴍᴇɴᴛɪᴏɴ ᴀ ᴜꜱᴇʀ.");
        }

        const userChar = [
            "ꜱɪɢᴍᴀ", "ɢᴇɴᴇʀᴏᴜꜱ", "ɢʀᴜᴍᴘʏ", "ᴏᴠᴇʀᴄᴏɴꜰɪᴅᴇɴᴛ", "ᴏʙᴇᴅɪᴇɴᴛ",
            "ɢᴏᴏᴅ", "ꜱɪᴍᴘ", "ᴋɪɴᴅ", "ᴘᴀᴛɪᴇɴᴛ", "ᴘᴇʀᴠᴇʀᴛ", "ᴄᴏᴏʟ",
            "ʜᴇʟᴘꜰᴜʟ", "ʙʀɪʟʟɪᴀɴᴛ", "ꜱᴇxʏ", "ꜱɪɴɢʟᴇ", "ʜᴏᴛ", "ɢᴏʀɢᴇᴏᴜꜱ", "ᴄᴜᴛᴇ"
        ];

        const userCharacterSelection = userChar[Math.floor(Math.random() * userChar.length)];
        const message = `ᴄʜᴀʀᴀᴄᴛᴇʀ ᴏꜰ @${mentionedUser.split("@")[0]} ɪꜱ *${userCharacterSelection}* 🔥⚡`;

        await conn.sendMessage(from, { text: message, mentions: [mentionedUser] }, { quoted: anony });
    } catch (e) {
        console.error(e);
        reply("ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴀᴛ ᴏᴜʀ ᴇɴᴅ.");
    }
});

// Trivia
cmd({
    pattern: "trivia",
    react: "🍹",
    desc: "Get a random trivia question",
    category: "fun",
    use: ".trivia",
    filename: __filename
}, async (conn, mek, m, { from, reply }) => {
    try {
        let res = await fetch("https://opentdb.com/api.php?amount=1");
        let json = await res.json();

        let question = json.results[0].question;
        let answer = json.results[0].correct_answer;

        await conn.sendMessage(from, { 
            text: `ǫᴜᴇꜱᴛɪᴏɴ: ${question}\n\nᴛʜɪɴᴋ ʏᴏᴜ ᴋɴᴏᴡ ᴛʜᴇ ᴀɴꜱᴡᴇʀ? ꜱᴇɴᴅ ᴛʜᴇ ᴄᴏʀʀᴇᴄᴛ ᴀɴꜱᴡᴇʀ ᴀꜰᴛᴇʀ 20 ꜱᴇᴄᴏɴᴅꜱ` 
        }, { quoted: anony });

        setTimeout(async () => {
            await conn.sendMessage(from, { text: `ᴀɴꜱᴡᴇʀ: ${answer}` });
        }, 20000);
    } catch (error) {
        console.error(error);
        reply('ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴀᴛ ᴏᴜʀ ᴇɴᴅ.');
    }
});

// Truth Detector
cmd({
    pattern: "truthdetector",
    alias: ["liedetector"],
    react: "🍹",
    desc: "Detect if a quoted message is a lie",
    category: "fun",
    use: ".truthdetector [reply to message]",
    filename: __filename
}, async (conn, mek, m, { from, reply }) => {
    if (!m.quoted) return reply(`ᴘʟᴇᴀꜱᴇ ʀᴇᴘʟʏ ᴛᴏ ᴛʜᴇ ᴍᴇꜱꜱᴀɢᴇ ʏᴏᴜ ᴡᴀɴᴛ ᴛᴏ ᴅᴇᴛᴇᴄᴛ!`);

    let responses = [
        "ᴛʜᴀᴛ'ꜱ ᴀ ʙʟᴀᴛᴀɴᴛ ʟɪᴇ!", "ᴛʀᴜᴛʜ ʀᴇᴠᴇᴀʟᴇᴅ!", "ʟɪᴇ ᴀʟᴇʀᴛ!",
        "ʜᴀʀᴅ ᴛᴏ ʙᴇʟɪᴇᴠᴇ, ʙᴜᴛ ᴛʀᴜᴇ!", "ᴘʀᴏꜰᴇꜱꜱɪᴏɴᴀʟ ʟɪᴀʀ ᴅᴇᴛᴇᴄᴛᴇᴅ!",
        "ꜰᴀᴄᴛ-ᴄʜᴇᴄᴋ: ᴛʀᴜᴇ", "ʙᴜꜱᴛᴇᴅ! ᴛʜᴀᴛ'ꜱ ᴀ ʟɪᴇ!", "ᴜɴʙᴇʟɪᴇᴠᴀʙʟᴇ, ʙᴜᴛ ꜰᴀʟꜱᴇ!",
        "ᴅᴇᴛᴇᴄᴛɪɴɢ... ᴛʀᴜᴛʜ!", "ʟɪᴇ ᴅᴇᴛᴇᴄᴛᴏʀ ᴀᴄᴛɪᴠᴀᴛᴇᴅ: ꜰᴀʟꜱᴇ!",
        "ꜱᴜʀᴘʀɪꜱɪɴɢʟʏ, ᴛʀᴜᴇ!", "ᴍʏ ɪɴꜱᴛɪɴᴄᴛꜱ ꜱᴀʏ... ʟɪᴇ!",
        "ᴛʜᴀᴛ'ꜱ ᴘᴀʀᴛɪᴀʟʟʏ ᴛʀᴜᴇ!", "ᴄᴀɴ'ᴛ ᴠᴇʀɪꜰʏ, ᴛʀʏ ᴀɢᴀɪɴ!",
        "ᴍᴏꜱᴛ ʟɪᴋᴇʟʏ, ᴛʀᴜᴇ!", "ᴅᴏɴ'ᴛ ʙᴇʟɪᴇᴠᴇ ʏᴏᴜ!", "ꜱᴜʀᴘʀɪꜱɪɴɢʟʏ, ꜰᴀʟꜱᴇ!",
        "ᴛʀᴜᴛʜ!", "ʜᴏɴᴇꜱᴛ ᴀꜱ ᴀ ꜱᴀɪɴᴛ!", "ᴅᴇᴄᴇᴘᴛɪᴠᴇ ᴍᴜᴄʜ?",
        "ᴀʙꜱᴏʟᴜᴛᴇʟʏ ᴛʀᴜᴇ!", "ᴄᴏᴍᴘʟᴇᴛᴇʟʏ ꜰᴀʟꜱᴇ!", "ꜱᴇᴇᴍꜱ ᴛʀᴜᴛʜꜰᴜʟ.",
        "ɴᴏᴛ ʙᴜʏɪɴɢ ɪᴛ!", "ʏᴏᴜ'ʀᴇ ʟʏɪɴɢ ᴛʜʀᴏᴜɢʜ ʏᴏᴜʀ ᴛᴇᴇᴛʜ!",
        "ʜᴀʀᴅ ᴛᴏ ʙᴇʟɪᴇᴠᴇ, ʙᴜᴛ ɪᴛ'ꜱ ᴛʀᴜᴇ!", "ɪ ꜱᴇɴꜱᴇ ʜᴏɴᴇꜱᴛʏ.",
        "ꜰᴀʟꜱᴇʜᴏᴏᴅ ᴅᴇᴛᴇᴄᴛᴇᴅ!", "ᴛᴏᴛᴀʟʟʏ ʟᴇɢɪᴛ!", "ʟɪᴇꜱ, ʟɪᴇꜱ, ʟɪᴇꜱ!",
        "ʏᴏᴜ ᴄᴀɴ'ᴛ ꜰᴏᴏʟ ᴍᴇ!", "ꜱᴄʀᴇᴀᴍꜱ ᴛʀᴜᴛʜ!", "ꜰᴀʙʀɪᴄᴀᴛɪᴏɴ ᴀʟᴇʀᴛ!",
        "ꜱᴘᴏᴛ ᴏɴ!", "ꜰɪꜱʜʏ ꜱᴛᴏʀʏ, ɪꜱɴ'ᴛ ɪᴛ?", "ᴜɴǫᴜᴇꜱᴛɪᴏɴᴀʙʟʏ ᴛʀᴜᴇ!", "ᴘᴜʀᴇ ꜰɪᴄᴛɪᴏɴ!"
    ];

    let result = responses[Math.floor(Math.random() * responses.length)];
    reply(`*ʀᴇꜱᴜʟᴛ*: ${result}`);
});

// Guess Cartoon
cmd({
    pattern: "guesscartoon",
    alias: ["cartoonquiz", "guesscharacter"],
    react: "🍹",
    desc: "Guess the cartoon character game",
    category: "fun",
    use: ".guesscartoon",
    filename: __filename
}, async (conn, mek, m, { from, reply }) => {
    try {
        await reply("🎮 ꜰᴇᴛᴄʜɪɴɢ ᴀ ᴄᴀʀᴛᴏᴏɴ ᴄʜᴀʀᴀᴄᴛᴇʀ...");

        const response = await fetch(`https://api.siputzx.my.id/api/games/tebakkartun`);
        const data = await response.json();

        if (!data.status || !data.data) {
            return reply("*ꜰᴀɪʟᴇᴅ ᴛᴏ ꜰᴇᴛᴄʜ ᴄᴀʀᴛᴏᴏɴ ᴄʜᴀʀᴀᴄᴛᴇʀ.*");
        }

        await conn.sendMessage(from, {
            image: { url: data.data.img },
            caption: `🎪 *ɢᴜᴇꜱꜱ ᴛʜᴇ ᴄᴀʀᴛᴏᴏɴ ᴄʜᴀʀᴀᴄᴛᴇʀ!*\n\n` +
                     `ᴄᴀɴ ʏᴏᴜ ɴᴀᴍᴇ ᴛʜɪꜱ ᴄʜᴀʀᴀᴄᴛᴇʀ?\n\n` +
                     `ʀᴇᴘʟʏ ᴡɪᴛʜ ʏᴏᴜʀ ᴀɴꜱᴡᴇʀ!`
        }, { quoted: anony });
    } catch (error) {
        console.error(error);
        reply("ᴇʀʀᴏʀ ꜰᴇᴛᴄʜɪɴɢ ᴄᴀʀᴛᴏᴏɴ ɢᴀᴍᴇ.");
    }
});
// --- Bass Boost ---
cmd({
    pattern: "bass",
    react: "🎵",
    desc: "Boost the bass of an audio file",
    category: "audio",
    use: ".bass [reply to audio]",
    filename: __filename
}, async (conn, mek, m, ctx) => {
    await handleAudioEffect(conn, mek, m, ctx, '-af equalizer=f=54:width_type=o:width=2:g=20');
});

// --- Blown Effect ---
cmd({
    pattern: "blown",
    react: "🎵",
    desc: "Apply blown effect to audio",
    category: "audio",
    use: ".blown [reply to audio]",
    filename: __filename
}, async (conn, mek, m, ctx) => {
    await handleAudioEffect(conn, mek, m, ctx, '-af atempo=4/4,asetrate=44500*2/3');
});

// --- Earrape Effect ---
cmd({
    pattern: "earrape",
    react: "🎵",
    desc: "Apply earrape effect to audio",
    category: "audio",
    use: ".earrape [reply to audio]",
    filename: __filename
}, async (conn, mek, m, ctx) => {
    await handleAudioEffect(conn, mek, m, ctx, '-af volume=12');
});

// --- Volume Adjustment ---
cmd({
    pattern: "volaudio",
    alias: ["volume"],
    react: "🎵",
    desc: "Adjust audio volume",
    category: "audio",
    use: ".volume [reply to audio]",
    filename: __filename
}, async (conn, mek, m, ctx) => {
    await handleAudioEffect(conn, mek, m, ctx, '-filter:a "volume=2.0"');
});

// --- Treble Boost ---
cmd({
    pattern: "treble",
    react: "🎵",
    desc: "Boost the treble of an audio file",
    category: "audio",
    use: ".treble [reply to audio]",
    filename: __filename
}, async (conn, mek, m, ctx) => {
    await handleAudioEffect(conn, mek, m, ctx, '-af equalizer=f=10000:width_type=o:width=2:g=15');
});

// --- Fast Audio ---
cmd({
    pattern: "fast",
    react: "🎵",
    desc: "Speed up audio",
    category: "audio",
    use: ".fast [reply to audio]",
    filename: __filename
}, async (conn, mek, m, ctx) => {
    await handleAudioEffect(conn, mek, m, ctx, '-filter:a "atempo=1.5"');
});

// --- Slow Audio ---
cmd({
    pattern: "slow",
    react: "🎵",
    desc: "Slow down audio",
    category: "audio",
    use: ".slow [reply to audio]",
    filename: __filename
}, async (conn, mek, m, ctx) => {
    await handleAudioEffect(conn, mek, m, ctx, '-filter:a "atempo=0.8"');
});

// --- Reverse Audio ---
cmd({
    pattern: "reverse",
    react: "🎵",
    desc: "Reverse audio playback",
    category: "audio",
    use: ".reverse [reply to audio]",
    filename: __filename
}, async (conn, mek, m, ctx) => {
    await handleAudioEffect(conn, mek, m, ctx, '-filter_complex "areverse"');
});

// --- Echo Effect ---
cmd({
    pattern: "echo",
    react: "🎵",
    desc: "Add echo effect to audio",
    category: "audio",
    use: ".echo [reply to audio]",
    filename: __filename
}, async (conn, mek, m, ctx) => {
    await handleAudioEffect(conn, mek, m, ctx, '-filter:a "aecho=0.8:0.9:1000:0.3"');
});

// --- Robot Effect ---
cmd({
    pattern: "robot",
    react: "🎵",
    desc: "Apply robot effect to audio",
    category: "audio",
    use: ".robot [reply to audio]",
    filename: __filename
}, async (conn, mek, m, ctx) => {
    await handleAudioEffect(conn, mek, m, ctx, `-filter_complex "afftfilt=real='hypot(re,im)*sin(0)':imag='hypot(re,im)*cos(0)':win_size=512:overlap=0.75"`);
});

// --- Deep Voice ---
cmd({
    pattern: "deep",
    react: "🎵",
    desc: "Apply deep voice effect to audio",
    category: "audio",
    use: ".deep [reply to audio]",
    filename: __filename
}, async (conn, mek, m, ctx) => {
    await handleAudioEffect(conn, mek, m, ctx, '-filter:a "asetrate=44100*0.7,aresample=44100"');
});

// --- Chipmunk Effect ---
cmd({
    pattern: "chipmunk",
    react: "🎵",
    desc: "Apply chipmunk effect to audio",
    category: "audio",
    use: ".chipmunk [reply to audio]",
    filename: __filename
}, async (conn, mek, m, ctx) => {
    await handleAudioEffect(conn, mek, m, ctx, '-filter:a "asetrate=44100*1.5,aresample=44100"');
});

// --- Nightcore Effect ---
cmd({
    pattern: "nightcore",
    react: "🎵",
    desc: "Apply nightcore effect to audio",
    category: "audio",
    use: ".nightcore [reply to audio]",
    filename: __filename
}, async (conn, mek, m, ctx) => {
    await handleAudioEffect(conn, mek, m, ctx, '-filter:a "atempo=1.06,asetrate=44100*1.25"');
});

// --- Instrumental Extraction ---
cmd({
    pattern: "instrumental",
    react: "🎵",
    desc: "Extract instrumental from audio",
    category: "audio",
    use: ".instrumental [reply to audio]",
    filename: __filename
}, async (conn, mek, m, ctx) => {
    await handleAudioEffect(conn, mek, m, ctx, '-af "pan=stereo|c0=c0|c1=c1,aresample=async=1:first_pts=0"');
});

// --- Vocal Removal ---
cmd({
    pattern: "vocalremove",
    react: "🎵",
    desc: "Remove vocals from audio",
    category: "audio",
    use: ".vocalremove [reply to audio]",
    filename: __filename
}, async (conn, mek, m, ctx) => {
    await handleAudioEffect(conn, mek, m, ctx, '-af "pan=stereo|c0=c0|c1=-1*c1"');
});

// --- Karaoke Effect ---
cmd({
    pattern: "karaoke",
    react: "🎵",
    desc: "Apply karaoke effect to audio",
    category: "audio",
    use: ".karaoke [reply to audio]",
    filename: __filename
}, async (conn, mek, m, ctx) => {
    await handleAudioEffect(conn, mek, m, ctx, '-af "stereotools=mode=ms>lr"');
});

// --- To Voice Note ---
cmd({
    pattern: "toptt",
    alias: ["tovn"],
    react: "🗣️",
    desc: "Convert audio to voice note",
    category: "audio",
    use: ".toptt [reply to audio]",
    filename: __filename
}, async (conn, mek, m, { from, reply }) => {
    const quoted = m.quoted ? m.quoted : null;
    const mime = quoted?.mimetype || "";
    
    if (!quoted) return reply('*ʀᴇᴘʟʏ ᴛᴏ ᴀɴ ᴀᴜᴅɪᴏ ꜰɪʟᴇ ᴛᴏ ᴄᴏɴᴠᴇʀᴛ ɪᴛ ᴛᴏ ᴠᴏɪᴄᴇ ɴᴏᴛᴇ!*');
    if (!/audio/.test(mime)) return reply('*ᴏɴʟʏ ᴀᴜᴅɪᴏ ꜰɪʟᴇꜱ ᴄᴀɴ ʙᴇ ᴄᴏɴᴠᴇʀᴛᴇᴅ ᴛᴏ ᴠᴏɪᴄᴇ ɴᴏᴛᴇꜱ!*');

    try {
        let buffer = await quoted.download();
        let converted = await toPTT(buffer, 'mp3');

        await conn.sendMessage(from, { 
            audio: converted.data, 
            mimetype: 'audio/ogg; codecs=opus', 
            ptt: true 
        }, { quoted: m });
        
        await converted.delete();
    } catch (e) {
        console.error(e);
        reply(global.mess?.error || 'ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ᴄᴏɴᴠᴇʀᴛɪɴɢ ᴛʜᴇ ᴀᴜᴅɪᴏ.');
    }
});
// --- Glossy Silver ---
cmd({
    pattern: "glossysilver",
    alias: ["glossy"],
    react: "🍹",
    desc: "Generate glossy silver text image",
    category: "logo",
    use: ".glossysilver <text>",
    filename: __filename
}, async (conn, mek, m, { from, reply, q, text, prefix }) => {
    await handleEphoto360(conn, mek, from, reply, q, prefix, "glossysilver", "ɢʟᴏꜱꜱʏ ꜱɪʟᴠᴇʀ");
});

// --- Write Text ---
cmd({
    pattern: "writetext",
    alias: ["wtext"],
    react: "🍹",
    desc: "Generate write text image",
    category: "logo",
    use: ".writetext <text>",
    filename: __filename
}, async (conn, mek, m, { from, reply, q, prefix }) => {
    await handleEphoto360(conn, mek, from, reply, q, prefix, "writetext", "ᴡʀɪᴛᴇ ᴛᴇxᴛ");
});

// --- Blackpink Logo ---
cmd({
    pattern: "blackpinklogo",
    alias: ["bplogo"],
    react: "🍹",
    desc: "Generate blackpink logo image",
    category: "logo",
    use: ".blackpinklogo <text>",
    filename: __filename
}, async (conn, mek, m, { from, reply, q, prefix }) => {
    await handleEphoto360(conn, mek, from, reply, q, prefix, "blackpinklogo", "ʙʟᴀᴄᴋ ᴘɪɴᴋ ʟᴏɢᴏ");
});

// --- Glitch Text ---
cmd({
    pattern: "glitchtext",
    alias: ["glitch"],
    react: "🍹",
    desc: "Generate glitch text image",
    category: "logo",
    use: ".glitchtext <text>",
    filename: __filename
}, async (conn, mek, m, { from, reply, q, prefix }) => {
    await handleEphoto360(conn, mek, from, reply, q, prefix, "glitchtext", "ɢʟɪᴛᴄʜ ᴛᴇxᴛ");
});

// --- Advanced Glow ---
cmd({
    pattern: "advancedglow",
    alias: ["aglow"],
    react: "🍹",
    desc: "Generate advanced glow image",
    category: "logo",
    use: ".advancedglow <text>",
    filename: __filename
}, async (conn, mek, m, { from, reply, q, prefix }) => {
    await handleEphoto360(conn, mek, from, reply, q, prefix, "advancedglow", "ᴀᴅᴠᴀɴᴄᴇᴅ ɢʟᴏᴡ");
});

// --- Typography Text ---
cmd({
    pattern: "typographytext",
    alias: ["typo"],
    react: "🍹",
    desc: "Generate typography text image",
    category: "logo",
    use: ".typographytext <text>",
    filename: __filename
}, async (conn, mek, m, { from, reply, q, prefix }) => {
    await handleEphoto360(conn, mek, from, reply, q, prefix, "typographytext", "ᴛʏᴘᴏɢʀᴀᴘʜʏ ᴛᴇxᴛ");
});

// --- Pixel Glitch ---
cmd({
    pattern: "pixelglitch",
    alias: ["pglitch"],
    react: "🍹",
    desc: "Generate pixel glitch image",
    category: "logo",
    use: ".pixelglitch <text>",
    filename: __filename
}, async (conn, mek, m, { from, reply, q, prefix }) => {
    await handleEphoto360(conn, mek, from, reply, q, prefix, "pixelglitch", "ᴘɪxᴇʟ ɢʟɪᴛᴄʜ");
});

// --- Neon Glitch ---
cmd({
    pattern: "neonglitch",
    alias: ["nglitch"],
    react: "🍹",
    desc: "Generate neon glitch image",
    category: "logo",
    use: ".neonglitch <text>",
    filename: __filename
}, async (conn, mek, m, { from, reply, q, prefix }) => {
    await handleEphoto360(conn, mek, from, reply, q, prefix, "neonglitch", "ɴᴇᴏɴ ɢʟɪᴛᴄʜ");
});

// --- Nigerian Flag ---
cmd({
    pattern: "nigerianflag",
    alias: ["nigflag"],
    react: "🍹",
    desc: "Generate Nigerian flag text image",
    category: "logo",
    use: ".nigerianflag <text>",
    filename: __filename
}, async (conn, mek, m, { from, reply, q, prefix }) => {
    await handleEphoto360(conn, mek, from, reply, q, prefix, "nigerianflag", "ɴɪɢᴇʀɪᴀɴ ꜰʟᴀɢ");
});

// --- American Flag ---
cmd({
    pattern: "americanflag",
    alias: ["usaflag"],
    react: "🍹",
    desc: "Generate American flag text image",
    category: "logo",
    use: ".americanflag <text>",
    filename: __filename
}, async (conn, mek, m, { from, reply, q, prefix }) => {
    await handleEphoto360(conn, mek, from, reply, q, prefix, "americanflag", "ᴀᴍᴇʀɪᴄᴀɴ ꜰʟᴀɢ");
});

// --- Deleting Text ---
cmd({
    pattern: "deletingtext",
    alias: ["dtext"],
    react: "🍹",
    desc: "Generate deleting text image",
    category: "logo",
    use: ".deletingtext <text>",
    filename: __filename
}, async (conn, mek, m, { from, reply, q, prefix }) => {
    await handleEphoto360(conn, mek, from, reply, q, prefix, "deletingtext", "ᴅᴇʟᴇᴛɪɴɢ ᴛᴇxᴛ");
});

// --- Blackpink Style ---
cmd({
    pattern: "blackpinkstyle",
    alias: ["bpstyle"],
    react: "🍹",
    desc: "Generate blackpink style image",
    category: "logo",
    use: ".blackpinkstyle <text>",
    filename: __filename
}, async (conn, mek, m, { from, reply, q, prefix }) => {
    await handleEphoto360(conn, mek, from, reply, q, prefix, "blackpinkstyle", "ʙʟᴀᴄᴋ ᴘɪɴᴋ sᴛʏʟᴇ");
});

// --- Glowing Text ---
cmd({
    pattern: "glowingtext",
    alias: ["gtext"],
    react: "🍹",
    desc: "Generate glowing text image",
    category: "logo",
    use: ".glowingtext <text>",
    filename: __filename
}, async (conn, mek, m, { from, reply, q, prefix }) => {
    await handleEphoto360(conn, mek, from, reply, q, prefix, "glowingtext", "ɢʟᴏᴡɪɴɢ ᴛᴇxᴛ");
});

// --- Underwater ---
cmd({
    pattern: "underwater",
    alias: ["uwtext"],
    react: "🍹",
    desc: "Generate underwater text image",
    category: "logo",
    use: ".underwater <text>",
    filename: __filename
}, async (conn, mek, m, { from, reply, q, prefix }) => {
    await handleEphoto360(conn, mek, from, reply, q, prefix, "underwater", "ᴜɴᴅᴇʀ ᴡᴀᴛᴇʀ");
});

// --- Logo Maker ---
cmd({
    pattern: "logomaker",
    alias: ["lmaker"],
    react: "🍹",
    desc: "Generate logo image",
    category: "logo",
    use: ".logomaker <text>",
    filename: __filename
}, async (conn, mek, m, { from, reply, q, prefix }) => {
    await handleEphoto360(conn, mek, from, reply, q, prefix, "logomaker", "ʟᴏɢᴏ ᴍᴀᴋᴇʀ");
});

// --- Cartoon Style ---
cmd({
    pattern: "cartoonstyle",
    alias: ["cartoon"],
    react: "🍹",
    desc: "Generate cartoon style image",
    category: "logo",
    use: ".cartoonstyle <text>",
    filename: __filename
}, async (conn, mek, m, { from, reply, q, prefix }) => {
    await handleEphoto360(conn, mek, from, reply, q, prefix, "cartoonstyle", "ᴄᴀʀᴛᴏᴏɴ sᴛʏʟᴇ");
});

// --- Papercut ---
cmd({
    pattern: "papercut",
    alias: ["pcut"],
    react: "🍹",
    desc: "Generate papercut image",
    category: "logo",
    use: ".papercut <text>",
    filename: __filename
}, async (conn, mek, m, { from, reply, q, prefix }) => {
    await handleEphoto360(conn, mek, from, reply, q, prefix, "papercut", "ᴘᴀᴘᴇʀ ᴄᴜᴛ");
});

// --- Multicolored ---
cmd({
    pattern: "multicolored",
    alias: ["mcolor"],
    react: "🍹",
    desc: "Generate multicolored image",
    category: "logo",
    use: ".multicolored <text>",
    filename: __filename
}, async (conn, mek, m, { from, reply, q, prefix }) => {
    await handleEphoto360(conn, mek, from, reply, q, prefix, "multicolored", "ᴍᴜʟᴛɪ ᴄᴏʟᴏʀᴇᴅ");
});

// --- Effect Clouds ---
cmd({
    pattern: "effectclouds",
    alias: ["clouds"],
    react: "🍹",
    desc: "Generate effect clouds image",
    category: "logo",
    use: ".effectclouds <text>",
    filename: __filename
}, async (conn, mek, m, { from, reply, q, prefix }) => {
    await handleEphoto360(conn, mek, from, reply, q, prefix, "effectclouds", "ᴇꜰꜰᴇᴄᴛ ᴄʟᴏᴜᴅs");
});

// --- Gradient Text ---
cmd({
    pattern: "gradienttext",
    alias: ["grdtext"],
    react: "🍹",
    desc: "Generate gradient text image",
    category: "logo",
    use: ".gradienttext <text>",
    filename: __filename
}, async (conn, mek, m, { from, reply, q, prefix }) => {
    await handleEphoto360(conn, mek, from, reply, q, prefix, "gradienttext", "ɢʀᴀᴅɪᴇɴᴛ ᴛᴇxᴛ");
});

// --- Summer Beach ---
cmd({
    pattern: "summerbeach",
    alias: ["sbeach"],
    react: "🍹",
    desc: "Generate summer beach image",
    category: "logo",
    use: ".summerbeach <text>",
    filename: __filename
}, async (conn, mek, m, { from, reply, q, prefix }) => {
    await handleEphoto360(conn, mek, from, reply, q, prefix, "summerbeach", "sᴜᴍᴍᴇʀ ʙᴇᴀᴄʜ");
});

// --- Sand Summer ---
cmd({
    pattern: "sandsummer",
    alias: ["ssummer"],
    react: "🍹",
    desc: "Generate sand summer image",
    category: "logo",
    use: ".sandsummer <text>",
    filename: __filename
}, async (conn, mek, m, { from, reply, q, prefix }) => {
    await handleEphoto360(conn, mek, from, reply, q, prefix, "sandsummer", "sᴀɴᴅ sᴜᴍᴍᴇʀ");
});

// --- Luxury Gold ---
cmd({
    pattern: "luxurygold",
    alias: ["lgold"],
    react: "🍹",
    desc: "Generate luxury gold image",
    category: "logo",
    use: ".luxurygold <text>",
    filename: __filename
}, async (conn, mek, m, { from, reply, q, prefix }) => {
    await handleEphoto360(conn, mek, from, reply, q, prefix, "luxurygold", "ʟᴜxᴜʀʏ ɢᴏʟᴅ");
});

// --- Galaxy ---
cmd({
    pattern: "galaxy",
    alias: ["galaxytext"],
    react: "🍹",
    desc: "Generate galaxy image",
    category: "logo",
    use: ".galaxy <text>",
    filename: __filename
}, async (conn, mek, m, { from, reply, q, prefix }) => {
    await handleEphoto360(conn, mek, from, reply, q, prefix, "galaxy", "ɢᴀʟᴀxʏ");
});

// --- 1917 ---
cmd({
    pattern: "1917",
    alias: ["text1917"],
    react: "🍹",
    desc: "Generate 1917 image",
    category: "logo",
    use: ".1917 <text>",
    filename: __filename
}, async (conn, mek, m, { from, reply, q, prefix }) => {
    await handleEphoto360(conn, mek, from, reply, q, prefix, "1917", "1917");
});

// --- Making Neon ---
cmd({
    pattern: "makingneon",
    alias: ["mneon"],
    react: "🍹",
    desc: "Generate making neon image",
    category: "logo",
    use: ".makingneon <text>",
    filename: __filename
}, async (conn, mek, m, { from, reply, q, prefix }) => {
    await handleEphoto360(conn, mek, from, reply, q, prefix, "makingneon", "ᴍᴀᴋɪɴɢ ɴᴇᴏɴ");
});

// --- Text Effect ---
cmd({
    pattern: "texteffect",
    alias: ["teffect"],
    react: "🍹",
    desc: "Generate text effect image",
    category: "logo",
    use: ".texteffect <text>",
    filename: __filename
}, async (conn, mek, m, { from, reply, q, prefix }) => {
    await handleEphoto360(conn, mek, from, reply, q, prefix, "texteffect", "ᴛᴇxᴛ ᴇꜰꜰᴇᴄᴛ");
});

// --- Galaxy Style ---
cmd({
    pattern: "galaxystyle",
    alias: ["gstyle"],
    react: "🍹",
    desc: "Generate galaxy style image",
    category: "logo",
    use: ".galaxystyle <text>",
    filename: __filename
}, async (conn, mek, m, { from, reply, q, prefix }) => {
    await handleEphoto360(conn, mek, from, reply, q, prefix, "galaxystyle", "ɢᴀʟᴀxʏ sᴛʏʟᴇ");
});

// --- Light Effect ---
cmd({
    pattern: "lighteffect",
    alias: ["leffect"],
    react: "🍹",
    desc: "Generate light effect image",
    category: "logo",
    use: ".lighteffect <text>",
    filename: __filename
}, async (conn, mek, m, { from, reply, q, prefix }) => {
    await handleEphoto360(conn, mek, from, reply, q, prefix, "lighteffect", "ʟɪɢʜᴛ ᴇꜰꜰᴇᴄᴛ");
});