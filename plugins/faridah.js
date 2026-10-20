// ─────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────
const axios = require('axios');
const fetch = require('node-fetch');
const fs = require('fs');
const { exec } = require('child_process');
const { tmpdir } = require('os');
const path = require('path');
const { toAudio, toPTT } = require('../start/lib/converter');
const { cmd } = require('../command');
const { anony } = require('../lib/ridzcoder');

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
function getRandom(ext) {
    return `${Math.floor(Math.random() * 10000)}${ext}`;
}

// Helper to send a generated ephoto360 image
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
        console.error(`${endpoint} ᴇʀʀᴏʀ:`, e);
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
        reply("ꜰᴀɪʟᴇᴅ ᴛᴏ ɢᴇɴᴇʀᴀᴛᴇ ɪᴍᴀɢᴇ.");
    }
}

// Helper for audio effects
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
}

// ─────────────────────────────────────────────
// TOOLS
// ─────────────────────────────────────────────

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
│┃ ♛• ᴄᴏɴᴛɪɴᴇɴᴛ: ${info.continent || 'ɴ/ᴀ'}
│┃ ♛• ᴄᴏᴜɴᴛʀʏ: ${info.country || 'ɴ/ᴀ'} (${info.country_code || 'ɴ/ᴀ'})
│┃ ♛• ʀᴇɢɪᴏɴ: ${info.region || 'ɴ/ᴀ'}
│┃ ♛• ᴄɪᴛʏ: ${info.city || 'ɴ/ᴀ'}
│┃ ♛• ʟᴀᴛ/ʟᴏɴ: ${info.latitude || 'ɴ/ᴀ'} / ${info.longitude || 'ɴ/ᴀ'}
│┃ ♛• ɪsᴘ: ${info.connection?.isp || 'ɴ/ᴀ'}
│┃ ♛• ᴏʀɢ: ${info.connection?.org || 'ɴ/ᴀ'}
│┃ ♛• ᴛɪᴍᴇᴢᴏɴᴇ: ${info.timezone?.id || 'ɴ/ᴀ'}
│┃ ♛• ᴄᴜʀʀᴇɴᴛ ᴛɪᴍᴇ: ${info.timezone?.current_time || 'ɴ/ᴀ'}
╰────────────────≽`;
        };

        if (!res.success) throw new Error(`ɪᴘ ${q} ɴᴏᴛ ꜰᴏᴜɴᴅ!`);

        await conn.sendMessage(from, { location: { degreesLatitude: res.latitude, degreesLongitude: res.longitude } }, { ephemeralExpiration: 604800 });

        await new Promise(r => setTimeout(r, 2000));
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
╭──⧼♛ *ᴘʀɪᴍᴇ ʀɪᴅᴢ ᴄʜ ɪᴅ*
│┃ ♛*ɪᴅ:* ${res.id}
│┃ ♛*ɴᴀᴍᴇ:* ${res.name}
│┃ ♛*ᴛᴏᴛᴀʟ ꜰᴏʟʟᴏᴡᴇʀs:* ${res.subscribers}
│┃ ♛*sᴛᴀᴛᴜs:* ${res.state}
│┃ ♛*ᴠᴇʀɪꜰɪᴇᴅ:* ${res.verification == "VERIFIED" ? "✅ ᴠᴇʀɪꜰɪᴇᴅ" : "❌ ɴᴏᴛ ᴠᴇʀɪꜰɪᴇᴅ"}
╰────────────────≽`;

        return reply(teks);
    } catch (error) {
        console.error('ᴄʜᴀɴɴᴇʟ ɪɴꜰᴏ ᴇʀʀᴏʀ:', error);
        return reply("*ꜰᴀɪʟᴇᴅ ᴛᴏ ꜰᴇᴛᴄʜ ᴄʜᴀɴɴᴇʟ ɪɴꜰᴏʀᴍᴀᴛɪᴏɴ.*");
    }
});

// --- OBFUSCATE (placeholder, needs obfuscateJS defined) ---
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

        await conn.sendMessage(from, { text: "🔒 ᴏʙꜰᴜsᴄᴀᴛɪᴏɴ sᴛᴀʀᴛᴇᴅ..." }, { quoted: anony });

        const obfuscatedFile = await obfuscateJS(tempFile);

        await conn.sendMessage(from, { text: "✅ ᴏʙꜰᴜsᴄᴀᴛɪᴏɴ ᴄᴏᴍᴘʟᴇᴛᴇ!" }, { quoted: anony });

        await conn.sendMessage(from, {
            document: fs.readFileSync(obfuscatedFile),
            mimetype: "text/javascript",
            fileName: "nemesis.js"
        });

        await fs.promises.unlink(tempFile);
        await fs.promises.unlink(obfuscatedFile);
    } catch (error) {
        await conn.sendMessage(from, { text: `❌ *ᴇʀʀᴏʀ:* ${error.message}` }, { quoted: anony });
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
    const normalizePhoneNumber = (phone) => phone?.replace(/\D/g, '') || null;

    if (!quoted || !(mime === "text/vcard" || mime === "text/x-vcard")) {
        return conn.sendMessage(from, {
            text: "❌ *ᴇʀʀᴏʀ:* ʀᴇᴘʟʏ ᴛᴏ ᴀ `.vcf` ꜰɪʟᴇ!"
        }, { quoted: anony });
    }

    try {
        const media = await quoted.download();
        const vcfContent = media.toString('utf8');
        await conn.sendMessage(from, { text: "🔍 ꜰɪʟᴛᴇʀɪɴɢ ᴠᴄꜰ..." }, { quoted: anony });

        const vCards = vcfContent.split('END:VCARD').map(c => c.trim()).filter(c => c.length > 0);
        const validContacts = [];
        const invalidContacts = [];

        for (const card of vCards) {
            const telMatch = card.match(/TEL[^:]*:([^\n]+)/);
            if (!telMatch) continue;
            const phoneNumber = normalizePhoneNumber(telMatch[1].trim());
            if (!phoneNumber) continue;
            const jid = `${phoneNumber}@s.whatsapp.net`;
            const result = await conn.onWhatsApp(jid);
            if (result.length > 0 && result[0].exists) validContacts.push(card);
            else invalidContacts.push(phoneNumber);
        }

        const filteredVcf = validContacts.join('\nEND:VCARD\n') + (validContacts.length > 0 ? '\nEND:VCARD' : '');

        await conn.sendMessage(from, {
            text: `╭──⧼♛ *ᴠᴄꜰ ꜰɪʟᴛᴇʀɪɴɢ ᴄᴏᴍᴘʟᴇᴛᴇ*\n│┃ ♛ ᴛᴏᴛᴀʟ: ${vCards.length}\n│┃ ♛ ᴠᴀʟɪᴅ: ${validContacts.length}\n│┃ ♛ ʀᴇᴍᴏᴠᴇᴅ: ${invalidContacts.length}\n╰────────────────≽`
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
        let res = await fetch(`https://api.qrserver.com/v1/create-qr-code/?data=${q}&size=200x200`);
        await conn.sendMessage(from, { image: { url: res.url }, caption: `ǫʀ ᴄᴏᴅᴇ ꜰᴏʀ: ${q}` }, { quoted: anony });
    } catch (error) {
        console.error('ǫʀ ᴇʀʀᴏʀ:', error);
        reply('ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴡʜɪʟᴇ ɢᴇɴᴇʀᴀᴛɪɴɢ ᴛʜᴇ ǫʀ ᴄᴏᴅᴇ.');
    }
});

// --- SCREENSHOTS ---
['ssphone', 'sspc2', 'sstab2', 'ssweb2'].forEach(endpoint => {
    const meta = {
        'ssphone': { alias: ['ssmobile2', 'ssmobileweb'], react: '📱', title: 'ᴘʜᴏɴᴇ', api: 'ssphone' },
        'sspc2': { alias: ['ssdesktop2', 'sscomputer'], react: '💻', title: 'ᴘᴄ', api: 'sspc' },
        'sstab2': { alias: ['sstablet'], react: '📟', title: 'ᴛᴀʙʟᴇᴛ', api: 'sstab' },
        'ssweb2': { alias: ['ssfull', 'ssfullpage'], react: '🌐', title: 'ꜰᴜʟʟ ᴡᴇʙ', api: 'ssweb' }
    }[endpoint];

    cmd({
        pattern: endpoint,
        alias: meta.alias,
        react: meta.react,
        desc: `Take a ${meta.title} screenshot of a website`,
        category: "tools",
        use: `.${endpoint} <url>`,
        filename: __filename
    }, async (conn, mek, m, { from, reply, q, prefix }) => {
        const url = (q || '').trim();
        if (!url) return reply(`📌 *ᴜsᴀɢᴇ:* ${prefix}${endpoint} https://example.com`);
        if (!url.startsWith('http')) return reply("❌ ᴜʀʟ ᴍᴜsᴛ sᴛᴀʀᴛ ᴡɪᴛʜ http:// ᴏʀ https://");
        try {
            await conn.sendMessage(from, { react: { text: meta.react, key: mek.key } });
            const apiUrl = `https://api.princetechn.com/api/tools/${meta.api}?apikey=prince&url=${encodeURIComponent(url)}`;
            await conn.sendMessage(from, { image: { url: apiUrl }, caption: `${meta.react} *${meta.title} sᴄʀᴇᴇɴsʜᴏᴛ*\n\n🔗 ${url}\n\n> ${global.wm || ''}` }, { quoted: anony });
            await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });
        } catch (error) {
            console.error(`${endpoint} ᴇʀʀᴏʀ:`, error);
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            reply(`❌ ᴇʀʀᴏʀ ɢᴇɴᴇʀᴀᴛɪɴɢ ${meta.title} sᴄʀᴇᴇɴsʜᴏᴛ.`);
        }
    });
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
    if (!q) return reply(`🎵 *ʟʏʀɪᴄs ꜰɪɴᴅᴇʀ*\n\nᴜsᴀɢᴇ: ${prefix}ʟʏʀɪᴄs <sᴏɴɢ ɴᴀᴍᴇ>`);

    try {
        await reply(`🔍 sᴇᴀʀᴄʜɪɴɢ ʟʏʀɪᴄs ꜰᴏʀ: *"${q}"*...`);
        const res = await fetch(`https://api.popcat.xyz/v2/lyrics?song=${encodeURIComponent(q)}`, { timeout: 15000 });
        if (!res.ok) throw new Error(`ᴀᴘɪ sᴛᴀᴛᴜs: ${res.status}`);
        const data = await res.json();

        if (data.error === true) return reply(`ɴᴏ ʟʏʀɪᴄs ꜰᴏᴜɴᴅ ꜰᴏʀ *"${q}"*`);
        if (!data.message?.lyrics) return reply(`ʟʏʀɪᴄs ɴᴏᴛ ᴀᴠᴀɪʟᴀʙʟᴇ ꜰᴏʀ *"${q}"*`);

        const { lyrics, artist, title, image } = data.message;
        const cleanLyrics = lyrics.replace(/^\d+\s+Contributor.*?\n/i, '');

        let message = `🎵 *${title || q}*\n🎤 *ᴀʀᴛɪsᴛ:* ${artist || 'ᴜɴᴋɴᴏᴡɴ'}\n\n📖 *ʟʏʀɪᴄs:*\n\n${cleanLyrics}`;
        if (message.length > 3500) message = message.substring(0, 3500) + '\n\n*ʟʏʀɪᴄs ᴛʀᴜɴᴄᴀᴛᴇᴅ*';

        if (image && image.includes('http') && !image.includes('default_cover_image')) {
            try { await conn.sendMessage(from, { image: { url: image }, caption: `🎵 *${title}*\n🎤 ${artist}` }, { quoted: anony }); } catch {}
        }

        await conn.sendMessage(from, { text: message }, { quoted: anony });
    } catch (error) {
        console.error('ʟʏʀɪᴄs ᴇʀʀᴏʀ:', error);
        reply(`ᴇʀʀᴏʀ: ${error.message}`);
    }
});

// ─────────────────────────────────────────────
// INFO
// ─────────────────────────────────────────────
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
        const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${devInfo.name}\nORG:${devInfo.organization}\nTEL;type=CELL;type=VOICE;waid=${devInfo.number}:+${devInfo.number}\nNOTE:${devInfo.note}\nEND:VCARD`;
        await conn.sendMessage(from, { contacts: { displayName: devInfo.name, contacts: [{ displayName: devInfo.name, vcard }] } }, { quoted: anony });
    } catch (e) {
        console.error('ᴅᴇᴠ ᴇʀʀᴏʀ:', e);
        m.reply('❌ ꜰᴀɪʟᴇᴅ ᴛᴏ ꜱᴇɴᴅ ᴅᴇᴠᴇʟᴏᴘᴇʀ ᴄᴏɴᴛᴀᴄᴛ.');
    }
});

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
        reply(`📊 *ɢɪᴛʜᴜʙ ꜱᴛᴀᴛꜱ*\n\n👤 ${json.login}\n📦 ʀᴇᴘᴏꜱ: ${json.public_repos}\n👥 ꜰᴏʟʟᴏᴡᴇʀꜱ: ${json.followers}\n➡️ ꜰᴏʟʟᴏᴡɪɴɢ: ${json.following}\n⭐ ʙɪᴏ: ${json.bio || "ɴᴏɴᴇ"}\n🔗 ${json.html_url}`);
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
}, async (conn, mek, m, { from }) => {
    try {
        const repoOwner = "ridzcoder";
        const repoName = "PRIME-RIDZ";
        const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}`;
        const { data } = await axios.get(apiUrl, { timeout: 5000, headers: { 'User-Agent': 'PRIME-RIDZ' } });

        const repoInfo = `
╭──⧼♛ *ᴘʀɪᴍᴇ ʀɪᴅᴢ ʀᴇᴘᴏsɪᴛᴏʀʏ* ♛⧽──≽
│┃ ♛ *ʀᴇᴘᴏ*: ${data.name || repoName}
│┃ ♛ *ᴏᴡɴᴇʀ*: ${repoOwner}
│┃ ♛ *ᴅᴇsᴄ*: ${data.description || 'ɴᴏ ᴅᴇsᴄʀɪᴘᴛɪᴏɴ'}
│┃ ♛ *sᴛᴀʀs*: ${data.stargazers_count || 0}
│┃ ♛ *ꜰᴏʀᴋs*: ${data.forks_count || 0}
│┃ ♛ *ɪssᴜᴇs*: ${data.open_issues_count || 0}
│┃ ♛ *ʟᴀɴɢᴜᴀɢᴇ*: ${data.language || 'ɴ/ᴀ'}
│┃ ♛ *ʟɪɴᴋ*: https://github.com/${repoOwner}/${repoName}
╰────────────────≽`;

        await conn.sendMessage(from, {
            text: repoInfo,
            contextInfo: {
                mentionedJid: [m.sender],
                externalAdReply: {
                    title: "🌟 ᴘʀɪᴍᴇ ʀɪᴅᴢ",
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
            text: `╭──⧼♛ *ᴘʀɪᴍᴇ ʀɪᴅᴢ ʀᴇᴘᴏ* ♛⧽──≽\n│┃ ♛ https://github.com/ridzcoder/PRIME-RIDZ\n╰────────────────≽\n\n✨ @${m.sender.split("@")[0]} *ᴠɪsɪᴛ ᴛʜᴇ ʀᴇᴘᴏ ᴛᴏ ⭐ sᴛᴀʀ!*`,
            contextInfo: { mentionedJid: [m.sender] }
        }, { quoted: anony });
    }
});

// ─────────────────────────────────────────────
// RELIGION
// ─────────────────────────────────────────────
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
        const verses = ["John 3:16", "Psalm 23:1", "Philippians 4:13", "Romans 8:28", "Jeremiah 29:11", "Proverbs 3:5-6", "Isaiah 40:31"];
        const random = verses[Math.floor(Math.random() * verses.length)];
        const res = await fetch(`https://bible-api.com/${encodeURIComponent(random)}`);
        const data = await res.json();
        reply(`📖 *ᴠᴇʀsᴇ ᴏꜰ ᴛʜᴇ ᴅᴀʏ*\n\n*${data.reference}*\n\n${data.text}\n\n— ${data.translation_name}`);
    } catch (e) { reply("ᴇʀʀᴏʀ ꜰᴇᴛᴄʜɪɴɢ ᴠᴇʀsᴇ."); }
});

cmd({
    pattern: "hadith",
    alias: ["dailyhadith"],
    react: "🕌",
    desc: "Get a random Hadith",
    category: "religion",
    use: ".hadith",
    filename: __filename
}, async (conn, mek, m, { from }) => {
    const hadiths = [
        "ᴛʜᴇ ʙᴇsᴛ ᴀᴍᴏɴɢ ʏᴏᴜ ᴀʀᴇ ᴛʜᴏsᴇ ᴡʜᴏ ʜᴀᴠᴇ ᴛʜᴇ ʙᴇsᴛ ᴍᴀɴɴᴇʀs ᴀɴᴅ ᴄʜᴀʀᴀᴄᴛᴇʀ. — sᴀʜɪʜ ʙᴜᴋʜᴀʀɪ",
        "ɴᴏɴᴇ ᴏꜰ ʏᴏᴜ ᴛʀᴜʟʏ ʙᴇʟɪᴇᴠᴇs ᴜɴᴛɪʟ ʜᴇ ʟᴏᴠᴇs ꜰᴏʀ ʜɪs ʙʀᴏᴛʜᴇʀ ᴡʜᴀᴛ ʜᴇ ʟᴏᴠᴇs ꜰᴏʀ ʜɪᴍsᴇʟꜰ. — sᴀʜɪʜ ʙᴜᴋʜᴀʀɪ",
        "ᴛʜᴇ sᴛʀᴏɴɢ ɪs ɴᴏᴛ ᴛʜᴇ ᴏɴᴇ ᴡʜᴏ ᴏᴠᴇʀᴄᴏᴍᴇs ᴛʜᴇ ᴘᴇᴏᴘʟᴇ ʙʏ ʜɪs sᴛʀᴇɴɢᴛʜ, ʙᴜᴛ ᴛʜᴇ sᴛʀᴏɴɢ ɪs ᴛʜᴇ ᴏɴᴇ ᴡʜᴏ ᴄᴏɴᴛʀᴏʟs ʜɪᴍsᴇʟꜰ ᴡʜɪʟᴇ ɪɴ ᴀɴɢᴇʀ. — sᴀʜɪʜ ʙᴜᴋʜᴀʀɪ"
    ];
    const random = hadiths[Math.floor(Math.random() * hadiths.length)];
    conn.sendMessage(from, { text: `🕌 *ʜᴀᴅɪᴛʜ ᴏꜰ ᴛʜᴇ ᴅᴀʏ*\n\n${random}` }, { quoted: anony });
});

// ─────────────────────────────────────────────
// FUN
// ─────────────────────────────────────────────
cmd({
    pattern: "lovetest",
    alias: ["love"],
    react: "🍹",
    desc: "Calculate love percentage between two users",
    category: "fun",
    use: ".lovetest @user1 @user2",
    filename: __filename
}, async (conn, mek, m, { from, reply, args }) => {
    if (args.length < 2) return reply("ᴛᴀɢ ᴛᴡᴏ ᴜꜱᴇʀꜱ!");
    let user1 = args[0].replace("@", "") + "@s.whatsapp.net";
    let user2 = args[1].replace("@", "") + "@s.whatsapp.net";
    let lovePercent = Math.floor(Math.random() * 100) + 1;
    let messages = [
        { range: [90, 100], text: "💖 *ᴍᴀᴛᴄʜ ᴍᴀᴅᴇ ɪɴ ʜᴇᴀᴠᴇɴ!*" },
        { range: [75, 89], text: "😍 *ꜱᴛʀᴏɴɢ ᴄᴏɴɴᴇᴄᴛɪᴏɴ!*" },
        { range: [50, 74], text: "😊 *ɢᴏᴏᴅ ᴄᴏᴍᴘᴀᴛɪʙɪʟɪᴛʏ!*" },
        { range: [30, 49], text: "🤔 *ɪᴛ'ꜱ ᴄᴏᴍᴘʟɪᴄᴀᴛᴇᴅ!*" },
        { range: [10, 29], text: "😅 *ɴᴏᴛ ᴛʜᴇ ʙᴇꜱᴛ ᴍᴀᴛᴄʜ!*" },
        { range: [1, 9], text: "💔 *ᴜʜ-ᴏʜʜ*" }
    ];
    let loveMessage = messages.find(msg => lovePercent >= msg.range[0] && lovePercent <= msg.range[1]).text;
    let message = `💘 *ʟᴏᴠᴇ ᴛᴇꜱᴛ* 💘\n\n❤️ *@${user1.split("@")[0]}* + *@${user2.split("@")[0]}* = *${lovePercent}%*\n${loveMessage}`;
    await conn.sendMessage(from, { text: message, mentions: [user1, user2] }, { quoted: anony });
});

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
        await conn.sendMessage(from, { text: `${json.setup}\n\n${json.punchline}` }, { quoted: anony });
    } catch (error) {
        console.error(error);
        reply('ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ.');
    }
});

cmd({
    pattern: "trivia",
    react: "🍹",
    desc: "Get a random trivia question",
    category: "fun",
    use: ".trivia",
    filename: __filename
}, async (conn, mek, m, { from }) => {
    try {
        let res = await fetch("https://opentdb.com/api.php?amount=1");
        let json = await res.json();
        await conn.sendMessage(from, { text: `ǫᴜᴇꜱᴛɪᴏɴ: ${json.results[0].question}` }, { quoted: anony });
        setTimeout(async () => {
            await conn.sendMessage(from, { text: `ᴀɴꜱᴡᴇʀ: ${json.results[0].correct_answer}` });
        }, 20000);
    } catch (error) { console.error(error); }
});

// ─────────────────────────────────────────────
// AUDIO EFFECTS (all using the helper)
// ─────────────────────────────────────────────
const audioEffects = {
    bass: '-af equalizer=f=54:width_type=o:width=2:g=20',
    blown: '-af atempo=4/4,asetrate=44500*2/3',
    earrape: '-af volume=12',
    volaudio: '-filter:a "volume=2.0"',
    treble: '-af equalizer=f=10000:width_type=o:width=2:g=15',
    fast: '-filter:a "atempo=1.5"',
    slow: '-filter:a "atempo=0.8"',
    reverse: '-filter_complex "areverse"',
    echo: '-filter:a "aecho=0.8:0.9:1000:0.3"',
    robot: `-filter_complex "afftfilt=real='hypot(re,im)*sin(0)':imag='hypot(re,im)*cos(0)':win_size=512:overlap=0.75"`,
    deep: '-filter:a "asetrate=44100*0.7,aresample=44100"',
    chipmunk: '-filter:a "asetrate=44100*1.5,aresample=44100"',
    nightcore: '-filter:a "atempo=1.06,asetrate=44100*1.25"',
    instrumental: '-af "pan=stereo|c0=c0|c1=c1,aresample=async=1:first_pts=0"',
    vocalremove: '-af "pan=stereo|c0=c0|c1=-1*c1"',
    karaoke: '-af "stereotools=mode=ms>lr"'
};

Object.entries(audioEffects).forEach(([name, filter]) => {
    cmd({
        pattern: name,
        alias: name === 'volaudio' ? ['volume'] : [],
        react: "🎵",
        desc: `Apply ${name} effect to audio`,
        category: "audio",
        use: `.${name} [reply to audio]`,
        filename: __filename
    }, async (conn, mek, m, ctx) => {
        await handleAudioEffect(conn, mek, m, ctx, filter);
    });
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
    if (!quoted) return reply('*ʀᴇᴘʟʏ ᴛᴏ ᴀɴ ᴀᴜᴅɪᴏ ꜰɪʟᴇ!*');
    if (!/audio/.test(mime)) return reply('*ᴏɴʟʏ ᴀᴜᴅɪᴏ ꜰɪʟᴇꜱ ᴄᴀɴ ʙᴇ ᴄᴏɴᴠᴇʀᴛᴇᴅ!*');
    try {
        let buffer = await quoted.download();
        let converted = await toPTT(buffer, 'mp3');
        await conn.sendMessage(from, { audio: converted.data, mimetype: 'audio/ogg; codecs=opus', ptt: true }, { quoted: m });
        await converted.delete();
    } catch (e) {
        console.error(e);
        reply('ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ.');
    }
});

// ─────────────────────────────────────────────
// LOGO MAKER (auto-generated)
// ─────────────────────────────────────────────
const logoCommands = [
    { p: 'glossysilver', a: ['glossy'], t: 'ɢʟᴏꜱꜱʏ ꜱɪʟᴠᴇʀ' },
    { p: 'writetext', a: ['wtext'], t: 'ᴡʀɪᴛᴇ ᴛᴇxᴛ' },
    { p: 'blackpinklogo', a: ['bplogo'], t: 'ʙʟᴀᴄᴋ ᴘɪɴᴋ ʟᴏɢᴏ' },
    { p: 'glitchtext', a: ['glitch'], t: 'ɢʟɪᴛᴄʜ ᴛᴇxᴛ' },
    { p: 'advancedglow', a: ['aglow'], t: 'ᴀᴅᴠᴀɴᴄᴇᴅ ɢʟᴏᴡ' },
    { p: 'typographytext', a: ['typo'], t: 'ᴛʏᴘᴏɢʀᴀᴘʜʏ ᴛᴇxᴛ' },
    { p: 'pixelglitch', a: ['pglitch'], t: 'ᴘɪxᴇʟ ɢʟɪᴛᴄʜ' },
    { p: 'neonglitch', a: ['nglitch'], t: 'ɴᴇᴏɴ ɢʟɪᴛᴄʜ' },
    { p: 'nigerianflag', a: ['nigflag'], t: 'ɴɪɢᴇʀɪᴀɴ ꜰʟᴀɢ' },
    { p: 'americanflag', a: ['usaflag'], t: 'ᴀᴍᴇʀɪᴄᴀɴ ꜰʟᴀɢ' },
    { p: 'deletingtext', a: ['dtext'], t: 'ᴅᴇʟᴇᴛɪɴɢ ᴛᴇxᴛ' },
    { p: 'blackpinkstyle', a: ['bpstyle'], t: 'ʙʟᴀᴄᴋ ᴘɪɴᴋ sᴛʏʟᴇ' },
    { p: 'glowingtext', a: ['gtext'], t: 'ɢʟᴏᴡɪɴɢ ᴛᴇxᴛ' },
    { p: 'underwater', a: ['uwtext'], t: 'ᴜɴᴅᴇʀ ᴡᴀᴛᴇʀ' },
    { p: 'logomaker', a: ['lmaker'], t: 'ʟᴏɢᴏ ᴍᴀᴋᴇʀ' },
    { p: 'cartoonstyle', a: ['cartoon'], t: 'ᴄᴀʀᴛᴏᴏɴ sᴛʏʟᴇ' },
    { p: 'papercut', a: ['pcut'], t: 'ᴘᴀᴘᴇʀ ᴄᴜᴛ' },
    { p: 'multicolored', a: ['mcolor'], t: 'ᴍᴜʟᴛɪ ᴄᴏʟᴏʀᴇᴅ' },
    { p: 'effectclouds', a: ['clouds'], t: 'ᴇꜰꜰᴇᴄᴛ ᴄʟᴏᴜᴅs' },
    { p: 'gradienttext', a: ['grdtext'], t: 'ɢʀᴀᴅɪᴇɴᴛ ᴛᴇxᴛ' },
    { p: 'summerbeach', a: ['sbeach'], t: 'sᴜᴍᴍᴇʀ ʙᴇᴀᴄʜ' },
    { p: 'sandsummer', a: ['ssummer'], t: 'sᴀɴᴅ sᴜᴍᴍᴇʀ' },
    { p: 'luxurygold', a: ['lgold'], t: 'ʟᴜxᴜʀʏ ɢᴏʟᴅ' },
    { p: 'galaxy', a: ['galaxytext'], t: 'ɢᴀʟᴀxʏ' },
    { p: '1917', a: ['text1917'], t: '1917' },
    { p: 'makingneon', a: ['mneon'], t: 'ᴍᴀᴋɪɴɢ ɴᴇᴏɴ' },
    { p: 'texteffect', a: ['teffect'], t: 'ᴛᴇxᴛ ᴇꜰꜰᴇᴄᴛ' },
    { p: 'galaxystyle', a: ['gstyle'], t: 'ɢᴀʟᴀxʏ sᴛʏʟᴇ' },
    { p: 'lighteffect', a: ['leffect'], t: 'ʟɪɢʜᴛ ᴇꜰꜰᴇᴄᴛ' }
];

logoCommands.forEach(({ p, a, t }) => {
    cmd({
        pattern: p,
        alias: a,
        react: "🍹",
        desc: `Generate ${t} image`,
        category: "logo",
        use: `.${p} <text>`,
        filename: __filename
    }, async (conn, mek, m, { from, reply, q, prefix }) => {
        await handleEphoto360(conn, mek, from, reply, q, prefix, p, t);
    });
});