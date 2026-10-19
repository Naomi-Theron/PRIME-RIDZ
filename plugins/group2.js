const fs = require('fs');
const crypto = require('crypto');
const { PassThrough } = require('stream');
const ffmpeg = require('fluent-ffmpeg');
const jimp = require('jimp');
const { cmd } = require('../command');
const { anony } = require('../lib/ridzcoder');
const { getBuffer } = require('../lib/functions');
const {
    downloadContentFromMessage,
    generateWAMessageContent,
    generateWAMessageFromContent
} = require('@whiskeysockets/baileys');

// ─────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────
async function downloadToBuffer(message, type) {
    const stream = await downloadContentFromMessage(message, type);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
    return buffer;
}

async function convertStickerToImageSimple(stickerBuffer) {
    if (stickerBuffer.slice(0, 12).toString('hex').includes('52494646')) {
        return stickerBuffer;
    }
    return stickerBuffer;
}

async function convertStickerToImage(stickerBuffer) {
    try {
        return await convertStickerToImageSimple(stickerBuffer);
    } catch (error) {
        throw new Error(`sᴛɪᴄᴋᴇʀ ᴄᴏɴᴠᴇʀsɪᴏɴ ꜰᴀɪʟᴇᴅ: ${error.message}`);
    }
}

async function toVN(inputBuffer) {
    return new Promise((resolve, reject) => {
        const inStream = new PassThrough();
        inStream.end(inputBuffer);
        const outStream = new PassThrough();
        const chunks = [];
        ffmpeg(inStream)
            .noVideo()
            .audioCodec("libopus")
            .format("ogg")
            .audioBitrate("48k")
            .audioChannels(1)
            .audioFrequency(48000)
            .on("error", reject)
            .on("end", () => resolve(Buffer.concat(chunks)))
            .pipe(outStream, { end: true });
        outStream.on("data", chunk => chunks.push(chunk));
    });
}

async function buildPayloadFromQuoted(quotedMessage) {
    if (quotedMessage.videoMessage) {
        const buffer = await downloadToBuffer(quotedMessage.videoMessage, 'video');
        return {
            video: buffer,
            caption: quotedMessage.videoMessage.caption || '',
            gifPlayback: quotedMessage.videoMessage.gifPlayback || false,
            mimetype: quotedMessage.videoMessage.mimetype || 'video/mp4'
        };
    } else if (quotedMessage.imageMessage) {
        const buffer = await downloadToBuffer(quotedMessage.imageMessage, 'image');
        return {
            image: buffer,
            caption: quotedMessage.imageMessage.caption || '',
            mimetype: quotedMessage.imageMessage.mimetype || 'image/jpeg'
        };
    } else if (quotedMessage.audioMessage) {
        const buffer = await downloadToBuffer(quotedMessage.audioMessage, 'audio');
        if (quotedMessage.audioMessage.ptt) {
            const audioVn = await toVN(buffer);
            return { audio: audioVn, mimetype: "audio/ogg; codecs=opus", ptt: true };
        } else {
            return { audio: buffer, mimetype: quotedMessage.audioMessage.mimetype || 'audio/mpeg', ptt: false };
        }
    } else if (quotedMessage.stickerMessage) {
        try {
            const buffer = await downloadToBuffer(quotedMessage.stickerMessage, 'sticker');
            const imageBuffer = await convertStickerToImage(buffer);
            return {
                image: imageBuffer,
                caption: quotedMessage.stickerMessage.caption || '',
                mimetype: 'image/png',
                convertedSticker: true,
                originalMimetype: quotedMessage.stickerMessage.mimetype
            };
        } catch (conversionError) {
            console.error('sᴛɪᴄᴋᴇʀ ᴄᴏɴᴠᴇʀsɪᴏɴ ꜰᴀɪʟᴇᴅ:', conversionError);
            return { text: `⚠️ sᴛɪᴄᴋᴇʀ ᴄᴏɴᴠᴇʀsɪᴏɴ ꜰᴀɪʟᴇᴅ` };
        }
    } else if (quotedMessage.conversation || quotedMessage.extendedTextMessage?.text) {
        const textContent = quotedMessage.conversation || quotedMessage.extendedTextMessage?.text || '';
        return { text: textContent };
    }
    return null;
}

async function sendGroupStatus(conn, jid, content) {
    const inside = await generateWAMessageContent(content, { upload: conn.waUploadToServer });
    const messageSecret = crypto.randomBytes(32);
    const m = generateWAMessageFromContent(jid, {
        messageContextInfo: { messageSecret },
        groupStatusMessageV2: { message: { ...inside, messageContextInfo: { messageSecret } } }
    }, {});
    await conn.relayMessage(jid, m.message, { messageId: m.key.id });
    return m;
}

function detectMediaType(quotedMessage, payload = null) {
    if (!quotedMessage) return 'ᴛᴇxᴛ';
    if (quotedMessage.videoMessage) return 'ᴠɪᴅᴇᴏ';
    if (quotedMessage.imageMessage) return 'ɪᴍᴀɢᴇ';
    if (quotedMessage.audioMessage) return 'ᴀᴜᴅɪᴏ';
    if (quotedMessage.stickerMessage) {
        if (payload && payload.convertedSticker) return 'sᴛɪᴄᴋᴇʀ → ɪᴍᴀɢᴇ';
        return 'sᴛɪᴄᴋᴇʀ';
    }
    return 'ᴛᴇxᴛ';
}

function getHelpText() {
    return `
╭──⧼♛  *ɢʀᴏᴜᴘ sᴛᴀᴛᴜs*
│┃ ♛┃ ♛
│┃ ♛┃ ♛ ᴄᴏᴍᴍᴀɴᴅs:
│┃ ♛┃ ♛ .ᴛᴏɢsᴛᴀᴛᴜs / .sᴡɢᴄ / .ɢʀᴏᴜᴘsᴛᴀᴛᴜs / .ᴛᴏsɢʀᴏᴜᴘ
│┃ ♛┃ ♛
│┃ ♛┃ ♛ ᴜsᴀɢᴇ:
│┃ ♛┃ ♛ .ᴛᴏsɢʀᴏᴜᴘ <ᴛᴇxᴛ>
│┃ ♛┃ ♛ ʀᴇᴘʟʏ ᴛᴏ ᴍᴇᴅɪᴀ/sᴛɪᴄᴋᴇʀ ᴡɪᴛʜ .ᴛᴏsɢʀᴏᴜᴘ
│┃ ♛┃ ♛ ᴀᴅᴅ ᴄᴀᴘᴛɪᴏɴ ᴀꜰᴛᴇʀ ᴄᴏᴍᴍᴀɴᴅ
╰─────────────────≽`;
}

// ─────────────────────────────────────────────
// LIST ACTIVE USERS
// ─────────────────────────────────────────────
cmd({
    pattern: "listactive",
    alias: ["activeusers"],
    react: "📊",
    desc: "Show top active users in the group",
    category: "group",
    use: ".listactive",
    filename: __filename
}, async (conn, mek, m, { from, reply, isGroup, GroupDB, groupName }) => {
    if (!isGroup) return reply(global.mess?.notgroup || 'ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ ɪs ꜰᴏʀ ɢʀᴏᴜᴘs ᴏɴʟʏ.');

    const activeUsers = await GroupDB.getActiveUsers(from, 15);
    if (!activeUsers.length) return reply('*📊 ɴᴏ ᴀᴄᴛɪᴠᴇ ᴜsᴇʀs ꜰᴏᴜɴᴅ ɪɴ ᴛʜɪs ɢʀᴏᴜᴘ.*\n\nsᴇɴᴅ sᴏᴍᴇ ᴍᴇssᴀɢᴇs ꜰɪʀsᴛ ᴛᴏ ᴛʀᴀᴄᴋ ᴀᴄᴛɪᴠɪᴛʏ!');

    let message = `📊 *ᴀᴄᴛɪᴠᴇ ᴜsᴇʀs - ${groupName || 'ᴛʜɪs ɢʀᴏᴜᴘ'}*\n\n`;
    activeUsers.forEach((user, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🔹';
        message += `${medal} ${index + 1}. @${user.jid.split('@')[0]} - *${user.count} ᴍᴇssᴀɢᴇs*\n`;
    });
    message += `\n📈 *ᴛᴏᴛᴀʟ ᴛʀᴀᴄᴋᴇᴅ ᴜsᴇʀs:* ${activeUsers.length}`;

    await conn.sendMessage(from, { text: message, mentions: activeUsers.map(u => u.jid) }, { quoted: anony });
});

// ─────────────────────────────────────────────
// LIST INACTIVE USERS
// ─────────────────────────────────────────────
cmd({
    pattern: "listinactive",
    alias: ["inactiveusers"],
    react: "⚠️",
    desc: "Show inactive users in the group",
    category: "group",
    use: ".listinactive",
    filename: __filename
}, async (conn, mek, m, { from, reply, isGroup, GroupDB, groupName }) => {
    if (!isGroup) return reply(global.mess?.notgroup || 'ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ ɪs ꜰᴏʀ ɢʀᴏᴜᴘs ᴏɴʟʏ.');

    try {
        const metadata = await conn.groupMetadata(from);
        const allParticipants = metadata.participants.map(p => p.id);
        const inactiveUsers = await GroupDB.getInactiveUsers(from, allParticipants);

        if (!inactiveUsers.length) return reply('*✅ ɴᴏ ɪɴᴀᴄᴛɪᴠᴇ ᴜsᴇʀs ꜰᴏᴜɴᴅ ɪɴ ᴛʜɪs ɢʀᴏᴜᴘ!*');

        let message = `⚠️ *ɪɴᴀᴄᴛɪᴠᴇ ᴜsᴇʀs - ${groupName || 'ᴛʜɪs ɢʀᴏᴜᴘ'}*\n\n`;
        message += `_ᴜsᴇʀs ᴡʜᴏ ʜᴀᴠᴇɴ'ᴛ sᴇɴᴛ ᴀɴʏ ᴍᴇssᴀɢᴇs:_\n\n`;
        message += inactiveUsers.map((user, i) => `🔹 ${i + 1}. @${user.split('@')[0]}`).join('\n');
        message += `\n\n📊 *ᴛᴏᴛᴀʟ ɪɴᴀᴄᴛɪᴠᴇ:* ${inactiveUsers.length}`;

        await conn.sendMessage(from, { text: message, mentions: inactiveUsers }, { quoted: anony });
    } catch (error) {
        console.error('ʟɪsᴛɪɴᴀᴄᴛɪᴠᴇ ᴇʀʀᴏʀ:', error);
        reply('*ᴇʀʀᴏʀ ꜰᴇᴛᴄʜɪɴɢ ɢʀᴏᴜᴘ ᴅᴀᴛᴀ!*');
    }
});

// ─────────────────────────────────────────────
// GROUP ACTIVITY
// ─────────────────────────────────────────────
cmd({
    pattern: "groupactivity",
    alias: ["activity"],
    react: "📊",
    desc: "Show overall group activity",
    category: "group",
    use: ".groupactivity",
    filename: __filename
}, async (conn, mek, m, { from, reply, isGroup, GroupDB, groupName }) => {
    if (!isGroup) return reply(global.mess?.notgroup || 'ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ ɪs ꜰᴏʀ ɢʀᴏᴜᴘs ᴏɴʟʏ.');

    try {
        const metadata = await conn.groupMetadata(from);
        const allParticipants = metadata.participants.map(p => p.id);
        const activeUsers = await GroupDB.getActiveUsers(from, 1000);
        const inactiveUsers = await GroupDB.getInactiveUsers(from, allParticipants);

        let message = `📊 *ɢʀᴏᴜᴘ ᴀᴄᴛɪᴠɪᴛʏ - ${groupName || 'ᴛʜɪs ɢʀᴏᴜᴘ'}*\n\n`;
        message += `*ᴛᴏᴛᴀʟ ᴍᴇᴍʙᴇʀs:* ${allParticipants.length}\n`;
        message += `✅ *ᴀᴄᴛɪᴠᴇ ᴜsᴇʀs:* ${activeUsers.length}\n`;
        message += `⚠️ *ɪɴᴀᴄᴛɪᴠᴇ ᴜsᴇʀs:* ${inactiveUsers.length}\n\n`;

        if (activeUsers.length > 0) {
            message += `🏆 *ᴛᴏᴘ 3 ᴀᴄᴛɪᴠᴇ ᴜsᴇʀs:*\n`;
            activeUsers.slice(0, 3).forEach((user, index) => {
                const medals = ['🥇', '🥈', '🥉'];
                message += `${medals[index]} @${user.jid.split('@')[0]} - *${user.count} ᴍᴇssᴀɢᴇs*\n`;
            });
            message += `\n`;
        }
        if (inactiveUsers.length > 0) {
            message += `💤 *ɪɴᴀᴄᴛɪᴠᴇ ᴜsᴇʀs (${inactiveUsers.length}):*\n`;
            inactiveUsers.slice(0, 5).forEach((user, index) => {
                message += `${index + 1}. @${user.split('@')[0]}\n`;
            });
            if (inactiveUsers.length > 5) message += `... ᴀɴᴅ ${inactiveUsers.length - 5} ᴍᴏʀᴇ`;
        }

        const mentions = [
            ...activeUsers.slice(0, 3).map(u => u.jid),
            ...inactiveUsers.slice(0, 5)
        ];
        await conn.sendMessage(from, { text: message, mentions }, { quoted: anony });
    } catch (error) {
        console.error('ɢʀᴏᴜᴘᴀᴄᴛɪᴠɪᴛʏ ᴇʀʀᴏʀ:', error);
        reply('*ᴇʀʀᴏʀ ꜰᴇᴛᴄʜɪɴɢ ɢʀᴏᴜᴘ ᴀᴄᴛɪᴠɪᴛʏ!*');
    }
});

// ─────────────────────────────────────────────
// KICK INACTIVE
// ─────────────────────────────────────────────
cmd({
    pattern: "kickinactive",
    alias: ["removeinactive"],
    react: "🚨",
    desc: "Kick inactive users from the group",
    category: "group",
    use: ".kickinactive",
    filename: __filename
}, async (conn, mek, m, { from, reply, isGroup, GroupDB, prefix, isAdmins, isBotAdmins }) => {
    if (!isGroup) return reply(global.mess?.notgroup || 'ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ ɪs ꜰᴏʀ ɢʀᴏᴜᴘs ᴏɴʟʏ.');
    if (!isAdmins) return reply(global.mess?.notadmin || 'ʏᴏᴜ ᴍᴜsᴛ ʙᴇ ᴀɴ ᴀᴅᴍɪɴ.');
    if (!isBotAdmins) return reply(global.mess?.botadmin || 'ʙᴏᴛ ᴍᴜsᴛ ʙᴇ ᴀɴ ᴀᴅᴍɪɴ.');

    try {
        const metadata = await conn.groupMetadata(from);
        const allParticipants = metadata.participants.map(p => p.id);
        const groupAdmins = metadata.participants.filter(p => p.admin).map(p => p.id);
        const inactiveUsers = (await GroupDB.getInactiveUsers(from, allParticipants))
            .filter(user => !groupAdmins.includes(user));

        if (!inactiveUsers.length) return reply('*✅ ɴᴏ ɪɴᴀᴄᴛɪᴠᴇ ᴜsᴇʀs ꜰᴏᴜɴᴅ ᴛᴏ ᴋɪᴄᴋ!*');

        let message = `🚨 *ᴋɪᴄᴋɪɴɢ ɪɴᴀᴄᴛɪᴠᴇ ᴜsᴇʀs - ${metadata.subject || 'ᴛʜɪs ɢʀᴏᴜᴘ'}*\n\n`;
        message += `_ᴛʜᴇ ꜰᴏʟʟᴏᴡɪɴɢ ᴜsᴇʀs ᴡɪʟʟ ʙᴇ ᴋɪᴄᴋᴇᴅ ɪɴ 25 sᴇᴄᴏɴᴅs:_\n\n`;
        message += inactiveUsers.map((user, i) => `🔹 ${i + 1}. @${user.split('@')[0]}`).join('\n');
        message += `\n\n📊 *ᴛᴏᴛᴀʟ ᴛᴏ ᴋɪᴄᴋ:* ${inactiveUsers.length}`;
        message += `\n⏰ *ᴛɪᴍᴇ:* 25 sᴇᴄᴏɴᴅs`;
        message += `\n❌ *ᴄᴀɴᴄᴇʟ:* ᴜsᴇ *${prefix}cancelkick* ᴛᴏ sᴛᴏᴘ`;

        await conn.sendMessage(from, { text: message, mentions: inactiveUsers }, { quoted: anony });

        if (!global.kickQueue) global.kickQueue = new Map();
        global.kickQueue.set(from, { type: 'inactive', users: inactiveUsers, timestamp: Date.now() });

        setTimeout(async () => {
            if (!global.kickQueue.has(from)) return;
            const queueData = global.kickQueue.get(from);
            if (queueData.type === 'inactive') {
                for (let user of inactiveUsers) {
                    try {
                        await conn.groupParticipantsUpdate(from, [user], "remove");
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    } catch (userError) {
                        console.error(`ꜰᴀɪʟᴇᴅ ᴛᴏ ᴋɪᴄᴋ ${user}:`, userError);
                    }
                }
                reply('✅ *ɪɴᴀᴄᴛɪᴠᴇ ᴜsᴇʀs ʜᴀᴠᴇ ʙᴇᴇɴ ᴋɪᴄᴋᴇᴅ sᴜᴄᴄᴇssꜰᴜʟʟʏ!*');
                global.kickQueue.delete(from);
            }
        }, 25000);
    } catch (error) {
        console.error('ᴋɪᴄᴋɪɴᴀᴄᴛɪᴠᴇ ᴇʀʀᴏʀ:', error);
        reply('*ᴇʀʀᴏʀ ᴘʀᴏᴄᴇssɪɴɢ ᴋɪᴄᴋ ᴄᴏᴍᴍᴀɴᴅ!*');
    }
});

// ─────────────────────────────────────────────
// VCF
// ─────────────────────────────────────────────
cmd({
    pattern: "vcf",
    react: "📇",
    desc: "Save all group contacts as a VCF file",
    category: "group",
    use: ".vcf",
    filename: __filename
}, async (conn, mek, m, { from, reply, isGroup, isCreator, groupMetadata, sleep }) => {
    try {
        if (!isGroup) return reply(global.mess?.notgroup || 'ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ ɪs ꜰᴏʀ ɢʀᴏᴜᴘs ᴏɴʟʏ.');
        if (!isCreator) return reply("*_ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ ɪs ꜰᴏʀ ᴛʜᴇ ᴏᴡɴᴇʀ ᴏɴʟʏ_*");

        const cmiggc = groupMetadata;
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
            fileName: 'nemesis.vcf',
            caption: `\nᴅᴏɴᴇ sᴀᴠɪɴɢ.\nɢʀᴏᴜᴘ ɴᴀᴍᴇ: *${cmiggc.subject}*\nᴄᴏɴᴛᴀᴄᴛs: *${cmiggc.participants.length}*\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ ${global.botname || 'ɴᴇᴍᴇsɪs ᴍᴅ'}`
        }, { quoted: anony });

        fs.unlinkSync(nmfilect);
    } catch (err) {
        reply(err.toString());
    }
});

// ─────────────────────────────────────────────
// APPROVE
// ─────────────────────────────────────────────
cmd({
    pattern: "approve",
    react: "✅",
    desc: "Approve all pending group join requests",
    category: "group",
    use: ".approve",
    filename: __filename
}, async (conn, mek, m, { from, reply, isGroup, isAdmins, isBotAdmins, getSetting, botNumber }) => {
    if (!isGroup) return reply(global.mess?.notgroup || 'ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ ɪs ꜰᴏʀ ɢʀᴏᴜᴘs ᴏɴʟʏ.');
    if (!isAdmins) return reply(global.mess?.notadmin || 'ʏᴏᴜ ᴍᴜsᴛ ʙᴇ ᴀɴ ᴀᴅᴍɪɴ.');
    if (!isBotAdmins) return reply(global.mess?.botadmin || 'ʙᴏᴛ ᴍᴜsᴛ ʙᴇ ᴀɴ ᴀᴅᴍɪɴ.');

    const responseList = await conn.groupRequestParticipantsList(from);
    if (responseList.length === 0) return reply("*ɴᴏ ᴘᴇɴᴅɪɴɢ ʀᴇǫᴜᴇsᴛs ᴅᴇᴛᴇᴄᴛᴇᴅ ᴀᴛ ᴛʜᴇ ᴍᴏᴍᴇɴᴛ!*");

    for (const participant of responseList) {
        await conn.groupRequestParticipantsUpdate(from, [participant.jid], "approve");
    }
    reply(`*${getSetting ? getSetting(botNumber, 'botname', 'ɴᴇᴍᴇsɪs ᴍᴅ') : 'ɴᴇᴍᴇsɪs ᴍᴅ'} ʜᴀs ᴀᴘᴘʀᴏᴠᴇᴅ ᴀʟʟ ᴘᴇɴᴅɪɴɢ ʀᴇǫᴜᴇsᴛs✅*`);
});

// ─────────────────────────────────────────────
// APPROVE ALL
// ─────────────────────────────────────────────
cmd({
    pattern: "approveall",
    react: "✅",
    desc: "Approve all pending join requests",
    category: "group",
    use: ".approveall",
    filename: __filename
}, async (conn, mek, m, { from, reply, isGroup, isAdmins, isBotAdmins }) => {
    if (!isGroup) return reply(global.mess?.notgroup || 'ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ ɪs ꜰᴏʀ ɢʀᴏᴜᴘs ᴏɴʟʏ.');
    if (!isAdmins) return reply(global.mess?.notadmin || 'ʏᴏᴜ ᴍᴜsᴛ ʙᴇ ᴀɴ ᴀᴅᴍɪɴ.');
    if (!isBotAdmins) return reply(global.mess?.botadmin || 'ʙᴏᴛ ᴍᴜsᴛ ʙᴇ ᴀɴ ᴀᴅᴍɪɴ.');

    const responseList = await conn.groupRequestParticipantsList(from);
    if (responseList.length === 0) return reply("*ɴᴏ ᴘᴇɴᴅɪɴɢ ʀᴇǫᴜᴇsᴛs ꜰᴏᴜɴᴅ!*");

    const jids = responseList.map(p => p.jid);
    try {
        await conn.groupRequestParticipantsUpdate(from, jids, "approve");
        reply(`*✅ sᴜᴄᴄᴇssꜰᴜʟʟʏ ᴀᴘᴘʀᴏᴠᴇᴅ ${responseList.length} ʀᴇǫᴜᴇsᴛs!*`);
    } catch (error) {
        console.error(error);
        reply("*❌ ꜰᴀɪʟᴇᴅ ᴛᴏ ᴀᴘᴘʀᴏᴠᴇ ᴀʟʟ ʀᴇǫᴜᴇsᴛs!*");
    }
});

// ─────────────────────────────────────────────
// DISAPPROVE ALL
// ─────────────────────────────────────────────
cmd({
    pattern: "disapproveall",
    react: "❌",
    desc: "Reject all pending join requests",
    category: "group",
    use: ".disapproveall",
    filename: __filename
}, async (conn, mek, m, { from, reply, isGroup, isAdmins, isBotAdmins }) => {
    if (!isGroup) return reply(global.mess?.notgroup || 'ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ ɪs ꜰᴏʀ ɢʀᴏᴜᴘs ᴏɴʟʏ.');
    if (!isAdmins) return reply(global.mess?.notadmin || 'ʏᴏᴜ ᴍᴜsᴛ ʙᴇ ᴀɴ ᴀᴅᴍɪɴ.');
    if (!isBotAdmins) return reply(global.mess?.botadmin || 'ʙᴏᴛ ᴍᴜsᴛ ʙᴇ ᴀɴ ᴀᴅᴍɪɴ.');

    const responseList = await conn.groupRequestParticipantsList(from);
    if (responseList.length === 0) return reply("*ɴᴏ ᴘᴇɴᴅɪɴɢ ʀᴇǫᴜᴇsᴛs ꜰᴏᴜɴᴅ!*");

    const jids = responseList.map(p => p.jid);
    try {
        await conn.groupRequestParticipantsUpdate(from, jids, "reject");
        reply(`*❌ sᴜᴄᴄᴇssꜰᴜʟʟʏ ʀᴇᴊᴇᴄᴛᴇᴅ ${responseList.length} ʀᴇǫᴜᴇsᴛs!*`);
    } catch (error) {
        console.error(error);
        reply("*❌ ꜰᴀɪʟᴇᴅ ᴛᴏ ʀᴇᴊᴇᴄᴛ ᴀʟʟ ʀᴇǫᴜᴇsᴛs!*");
    }
});

// ─────────────────────────────────────────────
// SET GROUP PP
// ─────────────────────────────────────────────
cmd({
    pattern: "setgrouppp",
    alias: ["setgrouppic"],
    react: "🖼️",
    desc: "Set the group profile picture",
    category: "group",
    use: ".setgrouppp [reply to image] [full]",
    filename: __filename
}, async (conn, mek, m, { from, reply, isGroup, isAdmins, isBotAdmins, prefix, quoted, mime, args }) => {
    if (!isGroup) return reply(global.mess?.notgroup || 'ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ ɪs ꜰᴏʀ ɢʀᴏᴜᴘs ᴏɴʟʏ.');
    if (!isAdmins) return reply(global.mess?.notadmin || 'ʏᴏᴜ ᴍᴜsᴛ ʙᴇ ᴀɴ ᴀᴅᴍɪɴ.');
    if (!isBotAdmins) return reply(global.mess?.botadmin || 'ʙᴏᴛ ᴍᴜsᴛ ʙᴇ ᴀɴ ᴀᴅᴍɪɴ.');
    if (!quoted) return reply(`ʀᴇᴘʟʏ ᴛᴏ ᴀɴ ɪᴍᴀɢᴇ!\nᴇxᴀᴍᴘʟᴇ: ${prefix}setgrouppp`);
    if (!/image/.test(mime)) return reply(`ʀᴇᴘʟʏ ᴛᴏ ᴀɴ ɪᴍᴀɢᴇ, ɴᴏᴛ ᴀ sᴛɪᴄᴋᴇʀ!`);

    try {
        await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });
        const mediaPath = await conn.downloadAndSaveMediaMessage(quoted, "pp");

        if (args[0] && args[0].toLowerCase() === "full") {
            const img = await jimp.read(mediaPath);
            const min = Math.min(img.getWidth(), img.getHeight());
            const cropped = await img.crop(0, 0, min, min).scaleToFit(720, 720).getBufferAsync(jimp.MIME_JPEG);

            await conn.query({
                tag: "iq",
                attrs: { to: from, type: "set", xmlns: "w:profile:picture" },
                content: [{ tag: "picture", attrs: { type: "image" }, content: cropped }]
            });
        } else {
            await conn.updateProfilePicture(from, { url: mediaPath });
        }

        fs.unlinkSync(mediaPath);
        await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });
        reply(`✅ ɢʀᴏᴜᴘ ɪᴄᴏɴ ᴜᴘᴅᴀᴛᴇᴅ!`);
    } catch (error) {
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
        reply(`❌ ᴇʀʀᴏʀ: ${error.message}`);
    }
});

// ─────────────────────────────────────────────
// ANTI GROUP MENTION
// ─────────────────────────────────────────────
cmd({
    pattern: "antigroupmention",
    alias: ["antigpmention", "agm"],
    react: "🛡️",
    desc: "Toggle anti group mention",
    category: "group",
    use: ".antigroupmention on/off",
    filename: __filename
}, async (conn, mek, m, { from, reply, args, prefix, isCreator, db, botNumber }) => {
    if (!isCreator) return reply(global.mess?.owner || 'ᴏᴡɴᴇʀ ᴏɴʟʏ.');

    const mode = args[0]?.toLowerCase();
    if (!mode || !['on', 'off'].includes(mode)) {
        const current = await db.get(botNumber, 'antigroupmention', false);
        return reply(`❌ *ᴀɴᴛɪ ɢʀᴏᴜᴘ ᴍᴇɴᴛɪᴏɴ*\n\nᴄᴜʀʀᴇɴᴛ: ${current ? 'ᴏɴ ✅' : 'ᴏꜰꜰ ❌'}\n\n📌 *ᴜsᴀɢᴇ:*\n${prefix}ᴀɴᴛɪɢʀᴏᴜᴘᴍᴇɴᴛɪᴏɴ ᴏɴ\n${prefix}ᴀɴᴛɪɢʀᴏᴜᴘᴍᴇɴᴛɪᴏɴ ᴏꜰꜰ`);
    }
    const boolValue = mode === 'on';
    await db.set(botNumber, 'antigroupmention', boolValue);
    reply(`✅ ᴀɴᴛɪ ɢʀᴏᴜᴘ ᴍᴇɴᴛɪᴏɴ ${boolValue ? 'ᴇɴᴀʙʟᴇᴅ' : 'ᴅɪsᴀʙʟᴇᴅ'}`);
});

// ─────────────────────────────────────────────
// LIST REQUESTS
// ─────────────────────────────────────────────
cmd({
    pattern: "listrequest",
    react: "📋",
    desc: "List all pending join requests",
    category: "group",
    use: ".listrequest",
    filename: __filename
}, async (conn, mek, m, { from, reply, isGroup, isAdmins, isBotAdmins }) => {
    if (!isGroup) return reply(global.mess?.notgroup || 'ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ ɪs ꜰᴏʀ ɢʀᴏᴜᴘs ᴏɴʟʏ.');
    if (!isAdmins) return reply(global.mess?.notadmin || 'ʏᴏᴜ ᴍᴜsᴛ ʙᴇ ᴀɴ ᴀᴅᴍɪɴ.');
    if (!isBotAdmins) return reply(global.mess?.botadmin || 'ʙᴏᴛ ᴍᴜsᴛ ʙᴇ ᴀɴ ᴀᴅᴍɪɴ.');

    try {
        const responseList = await conn.groupRequestParticipantsList(from);
        if (responseList.length === 0) return reply("*📭 ɴᴏ ᴘᴇɴᴅɪɴɢ ɢʀᴏᴜᴘ ʀᴇǫᴜᴇsᴛs ꜰᴏᴜɴᴅ!*");

        let listMessage = `📋 *ᴘᴇɴᴅɪɴɢ ɢʀᴏᴜᴘ ʀᴇǫᴜᴇsᴛs*\n\n📊 *ᴛᴏᴛᴀʟ ʀᴇǫᴜᴇsᴛs:* ${responseList.length}\n\n`;
        responseList.forEach((participant, index) => {
            listMessage += `${index + 1}. @${participant.jid.split('@')[0]}\n`;
        });
        listMessage += `\n📌 *ᴜsᴇ:*\n• .ᴀᴘᴘʀᴏᴠᴇᴀʟʟ - ᴀᴘᴘʀᴏᴠᴇ ᴀʟʟ\n• .ᴅɪsᴀᴘᴘʀᴏᴠᴇᴀʟʟ - ʀᴇᴊᴇᴄᴛ ᴀʟʟ`;

        const mentions = responseList.map(p => p.jid);
        await conn.sendMessage(from, { text: listMessage, mentions }, { quoted: anony });
    } catch (error) {
        console.error(error);
        reply("*❌ ꜰᴀɪʟᴇᴅ ᴛᴏ ꜰᴇᴛᴄʜ ɢʀᴏᴜᴘ ʀᴇǫᴜᴇsᴛs!*");
    }
});

// ─────────────────────────────────────────────
// MEDIA TAG
// ─────────────────────────────────────────────
cmd({
    pattern: "mediatag",
    react: "📢",
    desc: "Tag all members with media",
    category: "group",
    use: ".mediatag [reply to media]",
    filename: __filename
}, async (conn, mek, m, { from, reply, prefix, isGroup, isAdmins, isBotAdmins, quoted, participants }) => {
    if (!isGroup) return reply(global.mess?.notgroup || 'ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ ɪs ꜰᴏʀ ɢʀᴏᴜᴘs ᴏɴʟʏ.');
    if (!isAdmins) return reply(global.mess?.notadmin || 'ʏᴏᴜ ᴍᴜsᴛ ʙᴇ ᴀɴ ᴀᴅᴍɪɴ.');
    if (!isBotAdmins) return reply(global.mess?.botadmin || 'ʙᴏᴛ ᴍᴜsᴛ ʙᴇ ᴀɴ ᴀᴅᴍɪɴ.');
    if (!quoted) return reply(`ʀᴇᴘʟʏ ᴛᴏ ᴀɴʏ ᴍᴇᴅɪᴀ ᴡɪᴛʜ ᴄᴀᴘᴛɪᴏɴ ${prefix}ᴍᴇᴅɪᴀᴛᴀɢ`);

    conn.sendMessage(from, {
        forward: quoted.fakeObj,
        mentions: participants.map((a) => a.id),
    });
});

// ─────────────────────────────────────────────
// TAG ADMINS
// ─────────────────────────────────────────────
cmd({
    pattern: "tagadmins",
    alias: ["listadmins", "adminlist"],
    react: "👑",
    desc: "List and tag all group admins",
    category: "group",
    use: ".tagadmins",
    filename: __filename
}, async (conn, mek, m, { from, reply, isGroup }) => {
    if (!isGroup) return reply(global.mess?.notgroup || 'ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ ɪs ꜰᴏʀ ɢʀᴏᴜᴘs ᴏɴʟʏ.');

    try {
        await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });
        const groupData = await conn.groupMetadata(from);
        const admins = groupData.participants.filter(p => p.admin);
        const superAdmin = groupData.participants.find(p => p.admin === 'superadmin');
        const regularAdmins = groupData.participants.filter(p => p.admin && p.admin !== 'superadmin');

        if (admins.length === 0) {
            await conn.sendMessage(from, { react: { text: "ℹ️", key: mek.key } });
            return reply('ℹ️ *ɴᴏ ᴀᴅᴍɪɴs ꜰᴏᴜɴᴅ ɪɴ ᴛʜɪs ɢʀᴏᴜᴘ!*');
        }

        let adminList = `👑 *ɢʀᴏᴜᴘ ᴀᴅᴍɪɴs ʟɪsᴛ*\n\n*ɢʀᴏᴜᴘ:* ${groupData.subject}\n*ᴛᴏᴛᴀʟ ᴀᴅᴍɪɴs:* ${admins.length}\n\n`;
        if (superAdmin) adminList += `🤴 *ɢʀᴏᴜᴘ ᴏᴡɴᴇʀ*\n• @${superAdmin.id.split('@')[0]}\n\n`;
        if (regularAdmins.length > 0) {
            adminList += `*ᴀᴅᴍɪɴs* (${regularAdmins.length})\n`;
            regularAdmins.forEach((admin, index) => {
                adminList += `${index + 1}. @${admin.id.split('@')[0]}\n`;
            });
        }

        await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });
        const mentionJids = admins.map(admin => admin.id);
        await conn.sendMessage(from, { text: adminList, mentions: mentionJids }, { quoted: anony });
    } catch (error) {
        console.error('ᴛᴀɢᴀᴅᴍɪɴs ᴇʀʀᴏʀ:', error);
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
        reply('*ꜰᴀɪʟᴇᴅ ᴛᴏ ɢᴇᴛ ᴀᴅᴍɪɴ ʟɪsᴛ.* ᴘʟᴇᴀsᴇ ᴛʀʏ ᴀɢᴀɪɴ.');
    }
});

// ─────────────────────────────────────────────
// GET GROUP PP
// ─────────────────────────────────────────────
cmd({
    pattern: "getgrouppp",
    react: "🖼️",
    desc: "Get the group profile picture",
    category: "group",
    use: ".getgrouppp",
    filename: __filename
}, async (conn, mek, m, { from, reply, isGroup }) => {
    if (!isGroup) return reply(global.mess?.notgroup || 'ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ ɪs ꜰᴏʀ ɢʀᴏᴜᴘs ᴏɴʟʏ.');

    try {
        const ppUrl = await conn.profilePictureUrl(from, 'image');
        await conn.sendMessage(from, { image: { url: ppUrl }, caption: `🔹 *ᴛʜɪs ɢʀᴏᴜᴘ's ᴘʀᴏꜰɪʟᴇ ᴘɪᴄᴛᴜʀᴇ*` }, { quoted: anony });
    } catch {
        await conn.sendMessage(from, { image: { url: 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png?q=60' }, caption: '⚠️ ɴᴏ ᴘʀᴏꜰɪʟᴇ ᴘɪᴄᴛᴜʀᴇ ꜰᴏᴜɴᴅ ꜰᴏʀ ᴛʜɪs ɢʀᴏᴜᴘ.' }, { quoted: anony });
    }
});

// ─────────────────────────────────────────────
// LIST ONLINE
// ─────────────────────────────────────────────
cmd({
    pattern: "listonline",
    react: "🟢",
    desc: "List online members in the group",
    category: "group",
    use: ".listonline",
    filename: __filename
}, async (conn, mek, m, { from, reply, isGroup, args, store, botNumber }) => {
    if (!isGroup) return reply(global.mess?.notgroup || 'ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ ɪs ꜰᴏʀ ɢʀᴏᴜᴘs ᴏɴʟʏ.');

    let id = args && /\d+\-\d+@g.us/.test(args[0]) ? args[0] : from;
    let presences = store.presences[id];
    if (!presences) return reply('*ɴᴏ ᴏɴʟɪɴᴇ ᴍᴇᴍʙᴇʀs ᴅᴇᴛᴇᴄᴛᴇᴅ ɪɴ ᴛʜɪs ɢʀᴏᴜᴘ.*');

    let online = [...Object.keys(presences), botNumber];
    let liston = 1;
    conn.sendMessage(from, {
        text: '*ᴏɴʟɪɴᴇ ᴍᴇᴍʙᴇʀs ɪɴ ᴛʜɪs ɢʀᴏᴜᴘ*\n\n' + online.map(v => `${liston++} . @` + v.replace(/@.+/, '')).join('\n'),
        mentions: online
    }, { quoted: anony });
});

// ─────────────────────────────────────────────
// CLOSE TIME
// ─────────────────────────────────────────────
cmd({
    pattern: "closetime",
    react: "🔒",
    desc: "Close the group after a set time",
    category: "group",
    use: ".closetime <duration> <unit>",
    filename: __filename
}, async (conn, mek, m, { from, reply, isGroup, isAdmins, isBotAdmins, args }) => {
    if (!isGroup) return reply(global.mess?.notgroup || 'ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ ɪs ꜰᴏʀ ɢʀᴏᴜᴘs ᴏɴʟʏ.');
    if (!isAdmins) return reply(global.mess?.notadmin || 'ʏᴏᴜ ᴍᴜsᴛ ʙᴇ ᴀɴ ᴀᴅᴍɪɴ.');
    if (!isBotAdmins) return reply(global.mess?.botadmin || 'ʙᴏᴛ ᴍᴜsᴛ ʙᴇ ᴀɴ ᴀᴅᴍɪɴ.');

    if (!args[0] || !args[1]) return reply("*ᴜsᴀɢᴇ:*\n.ᴄʟᴏsᴇᴛɪᴍᴇ [ᴅᴜʀᴀᴛɪᴏɴ] [ᴜɴɪᴛ]\n\n*sᴇʟᴇᴄᴛ ᴜɴɪᴛ:*\nsᴇᴄᴏɴᴅs\nᴍɪɴᴜᴛᴇs\nʜᴏᴜʀs\nᴅᴀʏs\n\n*ᴇxᴀᴍᴘʟᴇ:*\n10 sᴇᴄᴏɴᴅs");

    const duration = args[0];
    const unit = args[1].toLowerCase();
    let timer;
    switch (unit) {
        case "seconds": timer = duration * 1000; break;
        case "minutes": timer = duration * 60000; break;
        case "hours": timer = duration * 3600000; break;
        case "days": timer = duration * 86400000; break;
        default: return reply("*sᴇʟᴇᴄᴛ ᴜɴɪᴛ:*\nsᴇᴄᴏɴᴅs\nᴍɪɴᴜᴛᴇs\nʜᴏᴜʀs\nᴅᴀʏs");
    }
    reply(`*ᴄʟᴏsɪɴɢ ɢʀᴏᴜᴘ ᴀꜰᴛᴇʀ ${duration} ${unit}*`);
    setTimeout(() => {
        conn.groupSettingUpdate(from, "announcement");
        reply("*ɢʀᴏᴜᴘ ᴄʟᴏsᴇᴅ ʙʏ ᴀᴅᴍɪɴ. ᴏɴʟʏ ᴀᴅᴍɪɴs ᴄᴀɴ sᴇɴᴅ ᴍᴇssᴀɢᴇs.*");
    }, timer);
});

// ─────────────────────────────────────────────
// OPEN TIME
// ─────────────────────────────────────────────
cmd({
    pattern: "opentime",
    react: "🔓",
    desc: "Open the group after a set time",
    category: "group",
    use: ".opentime <duration> <unit>",
    filename: __filename
}, async (conn, mek, m, { from, reply, isGroup, isAdmins, isBotAdmins, args }) => {
    if (!isGroup) return reply(global.mess?.notgroup || 'ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ ɪs ꜰᴏʀ ɢʀᴏᴜᴘs ᴏɴʟʏ.');
    if (!isAdmins) return reply(global.mess?.notadmin || 'ʏᴏᴜ ᴍᴜsᴛ ʙᴇ ᴀɴ ᴀᴅᴍɪɴ.');
    if (!isBotAdmins) return reply(global.mess?.botadmin || 'ʙᴏᴛ ᴍᴜsᴛ ʙᴇ ᴀɴ ᴀᴅᴍɪɴ.');

    const duration = args[0];
    if (!args[1]) return reply("*sᴇʟᴇᴄᴛ ᴜɴɪᴛ:*\nsᴇᴄᴏɴᴅs\nᴍɪɴᴜᴛᴇs\nʜᴏᴜʀs\nᴅᴀʏs");
    const unit = args[1].toLowerCase();
    let timer;
    switch (unit) {
        case "seconds": timer = duration * 1000; break;
        case "minutes": timer = duration * 60000; break;
        case "hours": timer = duration * 3600000; break;
        case "days": timer = duration * 86400000; break;
        default: return reply("*sᴇʟᴇᴄᴛ ᴜɴɪᴛ:*\nsᴇᴄᴏɴᴅs\nᴍɪɴᴜᴛᴇs\nʜᴏᴜʀs\nᴅᴀʏs");
    }
    reply(`*ᴏᴘᴇɴɪɴɢ ɢʀᴏᴜᴘ ᴀꜰᴛᴇʀ ${duration} ${unit}*`);
    setTimeout(() => {
        conn.groupSettingUpdate(from, "not_announcement");
        reply("*ɢʀᴏᴜᴘ ᴏᴘᴇɴᴇᴅ ʙʏ ᴀᴅᴍɪɴ. ᴍᴇᴍʙᴇʀs ᴄᴀɴ ɴᴏᴡ sᴇɴᴅ ᴍᴇssᴀɢᴇs.*");
    }, timer);
});

// ─────────────────────────────────────────────
// POLL
// ─────────────────────────────────────────────
cmd({
    pattern: "poll",
    react: "📊",
    desc: "Create a poll in the group",
    category: "group",
    use: ".poll <question>|<option1>,<option2>,...",
    filename: __filename
}, async (conn, mek, m, { from, reply, isCreator, isGroup, prefix, q }) => {
    if (!isCreator) return reply('*ʏᴏᴜ ᴀʀᴇ ɴᴏᴛ ᴍʏ ᴏᴡɴᴇʀ* 😜!');
    if (!isGroup) return reply(global.mess?.notgroup || 'ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ ɪs ꜰᴏʀ ɢʀᴏᴜᴘs ᴏɴʟʏ.');

    let [poll, opt] = q.split("|");
    if (!opt) return reply(`ᴇɴᴛᴇʀ ᴀ ǫᴜᴇsᴛɪᴏɴ ᴀɴᴅ ᴀᴛ ʟᴇᴀsᴛ 2 ᴏᴘᴛɪᴏɴs\nᴇxᴀᴍᴘʟᴇ: ${prefix}ᴘᴏʟʟ ᴡʜᴏ ɪs ʙᴇsᴛ ᴘʟᴀʏᴇʀ?|ᴍᴇssɪ,ʀᴏɴᴀʟᴅᴏ,ɴᴏɴᴇ`);

    const options = opt.split(",");
    await conn.sendMessage(from, { poll: { name: poll, values: options } });
});

// ─────────────────────────────────────────────
// ANTI STICKER
// ─────────────────────────────────────────────
cmd({
    pattern: "antisticker",
    alias: ["nosticker", "stickerfilter"],
    react: "🛡️",
    desc: "Configure anti-sticker protection",
    category: "group",
    use: ".antisticker delete/warn/kick on/off",
    filename: __filename
}, async (conn, mek, m, { from, reply, args, isGroup, db, botNumber, isAdmins, isBotAdmins, prefix }) => {
    if (!isGroup) return reply(global.mess?.notgroup || 'ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ ɪs ꜰᴏʀ ɢʀᴏᴜᴘs ᴏɴʟʏ.');
    if (!isAdmins) return reply(global.mess?.notadmin || 'ʏᴏᴜ ᴍᴜsᴛ ʙᴇ ᴀɴ ᴀᴅᴍɪɴ.');
    if (!isBotAdmins) return reply(global.mess?.botadmin || 'ʙᴏᴛ ᴍᴜsᴛ ʙᴇ ᴀɴ ᴀᴅᴍɪɴ.');

    const mode = args[0]?.toLowerCase();
    const action = args[1]?.toLowerCase();

    if (!mode) {
        const status = await db.getGroupSetting(botNumber, from, 'antisticker', false);
        const currentAction = await db.getGroupSetting(botNumber, from, 'antistickeraction', 'delete');
        return reply(`╭──⧼♛ *ɴᴇᴍᴇsɪs ᴍᴅ ᴀɴᴛɪsᴛɪᴄᴋᴇʀ*\n│┃ ♛\n│┃ ♛  *sᴛᴀᴛᴜs* : ${status ? '✅ ᴏɴ' : '❌ ᴏꜰꜰ'}\n│┃ ♛  *ᴀᴄᴛɪᴏɴ* : ${currentAction}\n│┃ ♛\n│┃ ♛  *ᴄᴏᴍᴍᴀɴᴅs:*\n│┃ ♛ ${prefix}ᴀɴᴛɪsᴛɪᴄᴋᴇʀ ᴅᴇʟᴇᴛᴇ ᴏɴ/ᴏꜰꜰ\n│┃ ♛ ${prefix}ᴀɴᴛɪsᴛɪᴄᴋᴇʀ ᴡᴀʀɴ ᴏɴ/ᴏꜰꜰ\n│┃ ♛ ${prefix}ᴀɴᴛɪsᴛɪᴄᴋᴇʀ ᴋɪᴄᴋ ᴏɴ/ᴏꜰꜰ\n╰────────────────≽`);
    }

    if (['delete', 'warn', 'kick'].includes(mode)) {
        if (!action || !['on', 'off'].includes(action)) return reply(`ᴘʟᴇᴀsᴇ sᴘᴇᴄɪꜰʏ ᴏɴ ᴏʀ ᴏꜰꜰ.\nᴇxᴀᴍᴘʟᴇ: .ᴀɴᴛɪsᴛɪᴄᴋᴇʀ ${mode} ᴏɴ`);
        const enabled = action === 'on';
        await db.setGroupSetting(botNumber, from, 'antistickeraction', mode);
        await db.setGroupSetting(botNumber, from, 'antisticker', enabled);
        return reply(`✅ ᴀɴᴛɪsᴛɪᴄᴋᴇʀ *${mode}* ʜᴀs ʙᴇᴇɴ *${action}* ꜰᴏʀ ᴛʜɪs ɢʀᴏᴜᴘ.`);
    }
    reply('ɪɴᴠᴀʟɪᴅ ᴄᴏᴍᴍᴀɴᴅ! ᴜsᴇ `.ᴀɴᴛɪsᴛɪᴄᴋᴇʀ` ᴛᴏ sᴇᴇ ᴀᴠᴀɪʟᴀʙʟᴇ ᴄᴏᴍᴍᴀɴᴅs.');
});

// ─────────────────────────────────────────────
// ANTI TAG
// ─────────────────────────────────────────────
cmd({
    pattern: "antitag",
    react: "🛡️",
    desc: "Configure anti-tag protection",
    category: "group",
    use: ".antitag delete/warn/kick on/off",
    filename: __filename
}, async (conn, mek, m, { from, reply, args, isGroup, db, botNumber, isAdmins, isBotAdmins }) => {
    if (!isGroup) return reply(global.mess?.notgroup || 'ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ ɪs ꜰᴏʀ ɢʀᴏᴜᴘs ᴏɴʟʏ.');
    if (!isAdmins) return reply(global.mess?.notadmin || 'ʏᴏᴜ ᴍᴜsᴛ ʙᴇ ᴀɴ ᴀᴅᴍɪɴ.');
    if (!isBotAdmins) return reply(global.mess?.botadmin || 'ʙᴏᴛ ᴍᴜsᴛ ʙᴇ ᴀɴ ᴀᴅᴍɪɴ.');

    const mode = args[0]?.toLowerCase();
    const action = args[1]?.toLowerCase();

    if (mode === 'delete' && action === 'on') { await db.setGroupSetting(botNumber, from, 'antitagmode', 'delete'); await db.setGroupSetting(botNumber, from, 'antitag', true); return reply('✅ *sᴜᴄᴄᴇssꜰᴜʟʟʏ ᴇɴᴀʙʟᴇᴅ ᴀɴᴛɪᴛᴀɢ ᴅᴇʟᴇᴛᴇ ᴍᴏᴅᴇ*'); }
    if (mode === 'delete' && action === 'off') { await db.setGroupSetting(botNumber, from, 'antitag', false); return reply('*sᴜᴄᴄᴇssꜰᴜʟʟʏ ᴅɪsᴀʙʟᴇᴅ ᴀɴᴛɪᴛᴀɢ ᴅᴇʟᴇᴛᴇ ᴍᴏᴅᴇ*'); }
    if (mode === 'warn' && action === 'on') { await db.setGroupSetting(botNumber, from, 'antitagmode', 'warn'); await db.setGroupSetting(botNumber, from, 'antitag', true); return reply('✅ *sᴜᴄᴄᴇssꜰᴜʟʟʏ ᴇɴᴀʙʟᴇᴅ ᴀɴᴛɪᴛᴀɢ ᴡᴀʀɴ ᴍᴏᴅᴇ*'); }
    if (mode === 'warn' && action === 'off') { await db.setGroupSetting(botNumber, from, 'antitag', false); return reply('*sᴜᴄᴄᴇssꜰᴜʟʟʏ ᴅɪsᴀʙʟᴇᴅ ᴀɴᴛɪᴛᴀɢ ᴡᴀʀɴ ᴍᴏᴅᴇ*'); }
    if (mode === 'kick' && action === 'on') { await db.setGroupSetting(botNumber, from, 'antitagmode', 'kick'); await db.setGroupSetting(botNumber, from, 'antitag', true); return reply('✅ *sᴜᴄᴄᴇssꜰᴜʟʟʏ ᴇɴᴀʙʟᴇᴅ ᴀɴᴛɪᴛᴀɢ ᴋɪᴄᴋ ᴍᴏᴅᴇ*'); }
    if (mode === 'kick' && action === 'off') { await db.setGroupSetting(botNumber, from, 'antitag', false); return reply('*sᴜᴄᴄᴇssꜰᴜʟʟʏ ᴅɪsᴀʙʟᴇᴅ ᴀɴᴛɪᴛᴀɢ ᴋɪᴄᴋ ᴍᴏᴅᴇ*'); }
    reply('ᴜsᴇ: ᴅᴇʟᴇᴛᴇ ᴏɴ/ᴏꜰꜰ, ᴡᴀʀɴ ᴏɴ/ᴏꜰꜰ, ᴋɪᴄᴋ ᴏɴ/ᴏꜰꜰ');
});

// ─────────────────────────────────────────────
// ANTI TAG ADMIN
// ─────────────────────────────────────────────
cmd({
    pattern: "antitagadmin",
    react: "🛡️",
    desc: "Configure anti-tag-admin protection",
    category: "group",
    use: ".antitagadmin on/off/delete/warn/kick",
    filename: __filename
}, async (conn, mek, m, { from, reply, prefix, args, isCreator, db, botNumber, isGroup, isAdmins, isBotAdmins }) => {
    if (!isGroup) return reply(global.mess?.notgroup || 'ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ ɪs ꜰᴏʀ ɢʀᴏᴜᴘs ᴏɴʟʏ.');
    if (!isCreator) return reply(global.mess?.owner || 'ᴏᴡɴᴇʀ ᴏɴʟʏ.');
    if (!isAdmins) return reply(global.mess?.notadmin || 'ʏᴏᴜ ᴍᴜsᴛ ʙᴇ ᴀɴ ᴀᴅᴍɪɴ.');
    if (!isBotAdmins) return reply(global.mess?.botadmin || 'ʙᴏᴛ ᴍᴜsᴛ ʙᴇ ᴀɴ ᴀᴅᴍɪɴ.');

    const mode = args[0]?.toLowerCase();
    if (!mode) {
        const status = await db.getGroupSetting(botNumber, from, 'antitagadmin', false);
        const currentAction = await db.getGroupSetting(botNumber, from, 'antitagadminaction', 'warn');
        return reply(`*👑 ᴀɴᴛɪᴛᴀɢ ᴀᴅᴍɪɴ sᴇᴛᴛɪɴɢs*\n\nsᴛᴀᴛᴜs: ${status ? '✅ ᴏɴ' : '❌ ᴏꜰꜰ'}\nᴀᴄᴛɪᴏɴ: ${currentAction}\n\nᴏᴘᴛɪᴏɴs:\n• ${prefix}ᴀɴᴛɪᴛᴀɢᴀᴅᴍɪɴ ᴏɴ\n• ${prefix}ᴀɴᴛɪᴛᴀɢᴀᴅᴍɪɴ ᴏꜰꜰ\n• ${prefix}ᴀɴᴛɪᴛᴀɢᴀᴅᴍɪɴ ᴅᴇʟᴇᴛᴇ\n• ${prefix}ᴀɴᴛɪᴛᴀɢᴀᴅᴍɪɴ ᴡᴀʀɴ\n• ${prefix}ᴀɴᴛɪᴛᴀɢᴀᴅᴍɪɴ ᴋɪᴄᴋ`);
    }
    if (mode === 'on') { await db.setGroupSetting(botNumber, from, 'antitagadmin', true); return reply('✅ ᴀɴᴛɪ-ᴛᴀɢ ᴀᴅᴍɪɴ ʜᴀs ʙᴇᴇɴ ᴇɴᴀʙʟᴇᴅ'); }
    if (mode === 'off') { await db.setGroupSetting(botNumber, from, 'antitagadmin', false); return reply('✅ ᴀɴᴛɪ-ᴛᴀɢ ᴀᴅᴍɪɴ ʜᴀs ʙᴇᴇɴ ᴅɪsᴀʙʟᴇᴅ'); }
    if (mode === 'delete') { await db.setGroupSetting(botNumber, from, 'antitagadminaction', 'delete'); await db.setGroupSetting(botNumber, from, 'antitagadmin', true); return reply('✅ *sᴜᴄᴄᴇssꜰᴜʟʟʏ ᴇɴᴀʙʟᴇᴅ ᴀɴᴛɪᴛᴀɢᴀᴅᴍɪɴ ᴅᴇʟᴇᴛᴇ ᴍᴏᴅᴇ*'); }
    if (mode === 'warn') { await db.setGroupSetting(botNumber, from, 'antitagadminaction', 'warn'); await db.setGroupSetting(botNumber, from, 'antitagadmin', true); return reply('✅ *sᴜᴄᴄᴇssꜰᴜʟʟʏ ᴇɴᴀʙʟᴇᴅ ᴀɴᴛɪᴛᴀɢᴀᴅᴍɪɴ ᴡᴀʀɴ ᴍᴏᴅᴇ*'); }
    if (mode === 'kick') { await db.setGroupSetting(botNumber, from, 'antitagadminaction', 'kick'); await db.setGroupSetting(botNumber, from, 'antitagadmin', true); return reply('✅ *sᴜᴄᴄᴇssꜰᴜʟʟʏ ᴇɴᴀʙʟᴇᴅ ᴀɴᴛɪᴛᴀɢᴀᴅᴍɪɴ ᴋɪᴄᴋ ᴍᴏᴅᴇ*'); }
    reply(`ɪɴᴠᴀʟɪᴅ ᴏᴘᴛɪᴏɴ! ᴜsᴇ: ᴏɴ, ᴏꜰꜰ, ᴅᴇʟᴇᴛᴇ, ᴡᴀʀɴ, ᴋɪᴄᴋ`);
});

// ─────────────────────────────────────────────
// ALLOW LINK
// ─────────────────────────────────────────────
cmd({
    pattern: "allowlink",
    react: "🔗",
    desc: "Allow specific users to post links",
    category: "group",
    use: ".allowlink add/remove/list/clear",
    filename: __filename
}, async (conn, mek, m, { from, args, reply, isCreator, isGroup, prefix, db, botNumber, isAdmins, isBotAdmins }) => {
    if (!isGroup) return reply(global.mess?.notgroup || 'ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ ɪs ꜰᴏʀ ɢʀᴏᴜᴘs ᴏɴʟʏ.');
    if (!isAdmins && !isCreator) return reply(global.mess?.notadmin || 'ʏᴏᴜ ᴍᴜsᴛ ʙᴇ ᴀɴ ᴀᴅᴍɪɴ.');
    if (!isBotAdmins) return reply(global.mess?.botadmin || 'ʙᴏᴛ ᴍᴜsᴛ ʙᴇ ᴀɴ ᴀᴅᴍɪɴ.');

    const action = args[0]?.toLowerCase();
    let target = m.mentionedJid[0] || (m.quoted ? m.quoted.sender : args[1]);

    if (!action) {
        const allowed = await db.getGroupSetting(botNumber, from, 'allowlink', []);
        return reply(`*📋 ᴀʟʟᴏᴡʟɪɴᴋ ᴄᴏᴍᴍᴀɴᴅs*\n\n• ${prefix}ᴀʟʟᴏᴡʟɪɴᴋ ᴀᴅᴅ @ᴜsᴇʀ\n• ${prefix}ᴀʟʟᴏᴡʟɪɴᴋ ʀᴇᴍᴏᴠᴇ @ᴜsᴇʀ\n• ${prefix}ᴀʟʟᴏᴡʟɪɴᴋ ʟɪsᴛ\n• ${prefix}ᴀʟʟᴏᴡʟɪɴᴋ ᴄʟᴇᴀʀ\n\nᴛᴏᴛᴀʟ ᴀʟʟᴏᴡᴇᴅ: ${allowed.length}`);
    }

    if (action === 'add') {
        if (!target) return reply('ᴘʟᴇᴀsᴇ ᴍᴇɴᴛɪᴏɴ ᴛʜᴇ ᴜsᴇʀ ᴏʀ ʀᴇᴘʟʏ ᴛᴏ ᴛʜᴇɪʀ ᴍᴇssᴀɢᴇ.');
        const jid = target.includes('@s.whatsapp.net') ? target : target + '@s.whatsapp.net';
        let allowed = await db.getGroupSetting(botNumber, from, 'allowlink', []);
        if (allowed.includes(jid)) return reply(`@${jid.split('@')[0]} ɪs ᴀʟʀᴇᴀᴅʏ ɪɴ ᴀʟʟᴏᴡʟɪsᴛ`, { mentions: [jid] });
        allowed.push(jid);
        await db.setGroupSetting(botNumber, from, 'allowlink', allowed);
        const name = await conn.getName(jid) || jid.split('@')[0];
        return reply(`✅ @${name} ᴄᴀɴ ɴᴏᴡ ᴘᴏsᴛ ʟɪɴᴋs`, { mentions: [jid] });
    }

    if (action === 'remove') {
        if (!target) return reply('ᴘʟᴇᴀsᴇ ᴍᴇɴᴛɪᴏɴ ᴛʜᴇ ᴜsᴇʀ ᴏʀ ʀᴇᴘʟʏ ᴛᴏ ᴛʜᴇɪʀ ᴍᴇssᴀɢᴇ.');
        const jid = target.includes('@s.whatsapp.net') ? target : target + '@s.whatsapp.net';
        let allowed = await db.getGroupSetting(botNumber, from, 'allowlink', []);
        const index = allowed.indexOf(jid);
        if (index === -1) return reply(`❌ @${jid.split('@')[0]} ɪs ɴᴏᴛ ɪɴ ᴀʟʟᴏᴡʟɪsᴛ`, { mentions: [jid] });
        allowed.splice(index, 1);
        await db.setGroupSetting(botNumber, from, 'allowlink', allowed);
        const name = await conn.getName(jid) || jid.split('@')[0];
        return reply(`✅ @${name} ʀᴇᴍᴏᴠᴇᴅ ꜰʀᴏᴍ ᴀʟʟᴏᴡʟɪsᴛ`, { mentions: [jid] });
    }

    if (action === 'list') {
        let allowed = await db.getGroupSetting(botNumber, from, 'allowlink', []);
        if (allowed.length === 0) return reply('📋 ɴᴏ ᴜsᴇʀs ᴀʀᴇ ᴀʟʟᴏᴡᴇᴅ ᴛᴏ ᴘᴏsᴛ ʟɪɴᴋs');
        let msg = `*📋 ᴀʟʟᴏᴡᴇᴅ ᴜsᴇʀs (${allowed.length})*\n\n`;
        allowed.forEach((jid, i) => { msg += `${i + 1}. @${jid.split('@')[0]}\n`; });
        return conn.sendMessage(from, { text: msg, mentions: allowed }, { quoted: anony });
    }

    if (action === 'clear') {
        await db.setGroupSetting(botNumber, from, 'allowlink', []);
        return reply('✅ ᴀʟʟ ᴜsᴇʀs ʀᴇᴍᴏᴠᴇᴅ ꜰʀᴏᴍ ᴀʟʟᴏᴡʟɪsᴛ');
    }

    reply(`❌ ɪɴᴠᴀʟɪᴅ ᴀᴄᴛɪᴏɴ! ᴜsᴇ: ᴀᴅᴅ, ʀᴇᴍᴏᴠᴇ, ʟɪsᴛ, ᴄʟᴇᴀʀ`);
});

// ─────────────────────────────────────────────
// USER JID
// ─────────────────────────────────────────────
cmd({
    pattern: "userjid",
    alias: ["userid"],
    react: "🆔",
    desc: "List all users' JIDs in the group",
    category: "group",
    use: ".userjid",
    filename: __filename
}, async (conn, mek, m, { from, reply, isGroup }) => {
    if (!isGroup) return reply(global.mess?.notgroup || 'ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ ɪs ꜰᴏʀ ɢʀᴏᴜᴘs ᴏɴʟʏ.');

    const groupMetadata = await conn.groupMetadata(from).catch(() => null);
    if (!groupMetadata) return reply('*ꜰᴀɪʟᴇᴅ ᴛᴏ ꜰᴇᴛᴄʜ ɢʀᴏᴜᴘ ᴍᴇᴛᴀᴅᴀᴛᴀ.*');

    const participants = groupMetadata.participants;
    let textt = `ʜᴇʀᴇ ɪs ᴊɪᴅ ᴀᴅᴅʀᴇss ᴏꜰ ᴀʟʟ ᴜsᴇʀs ᴏꜰ\n *${groupMetadata.subject}*\n\n`;
    for (let mem of participants) textt += `□ ${mem.id}\n`;
    reply(textt);
});

// ─────────────────────────────────────────────
// DISAPPEARING 90 DAYS
// ─────────────────────────────────────────────
cmd({
    pattern: "disp90days",
    react: "⏳",
    desc: "Enable disappearing messages for 90 days",
    category: "group",
    use: ".disp90days",
    filename: __filename
}, async (conn, mek, m, { from, reply, isGroup, isAdmins, isBotAdmins }) => {
    if (!isGroup) return reply(global.mess?.notgroup || 'ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ ɪs ꜰᴏʀ ɢʀᴏᴜᴘs ᴏɴʟʏ.');
    if (!isAdmins) return reply(global.mess?.notadmin || 'ʏᴏᴜ ᴍᴜsᴛ ʙᴇ ᴀɴ ᴀᴅᴍɪɴ.');
    if (!isBotAdmins) return reply(global.mess?.botadmin || 'ʙᴏᴛ ᴍᴜsᴛ ʙᴇ ᴀɴ ᴀᴅᴍɪɴ.');
    await conn.groupToggleEphemeral(from, 90 * 24 * 3600);
    reply('ᴅɪsᴀᴘᴘᴇᴀʀɪɴɢ ᴍᴇssᴀɢᴇs sᴜᴄᴄᴇssꜰᴜʟʟʏ ᴛᴜʀɴᴇᴅ ᴏɴ ꜰᴏʀ 90 ᴅᴀʏs!');
});

// ─────────────────────────────────────────────
// DISAPPEARING OFF
// ─────────────────────────────────────────────
cmd({
    pattern: "dispoff",
    react: "⏳",
    desc: "Disable disappearing messages",
    category: "group",
    use: ".dispoff",
    filename: __filename
}, async (conn, mek, m, { from, reply, isGroup, isAdmins, isBotAdmins }) => {
    if (!isGroup) return reply(global.mess?.notgroup || 'ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ ɪs ꜰᴏʀ ɢʀᴏᴜᴘs ᴏɴʟʏ.');
    if (!isAdmins) return reply(global.mess?.notadmin || 'ʏᴏᴜ ᴍᴜsᴛ ʙᴇ ᴀɴ ᴀᴅᴍɪɴ.');
    if (!isBotAdmins) return reply(global.mess?.botadmin || 'ʙᴏᴛ ᴍᴜsᴛ ʙᴇ ᴀɴ ᴀᴅᴍɪɴ.');
    await conn.groupToggleEphemeral(from, 0);
    reply('ᴅɪsᴀᴘᴘᴇᴀʀɪɴɢ ᴍᴇssᴀɢᴇs sᴜᴄᴄᴇssꜰᴜʟʟʏ ᴛᴜʀɴᴇᴅ ᴏꜰꜰ!');
});

// ─────────────────────────────────────────────
// DISAPPEARING 24 HOURS
// ─────────────────────────────────────────────
cmd({
    pattern: "disp24hours",
    react: "⏳",
    desc: "Enable disappearing messages for 24 hours",
    category: "group",
    use: ".disp24hours",
    filename: __filename
}, async (conn, mek, m, { from, reply, isGroup, isAdmins, isBotAdmins }) => {
    if (!isGroup) return reply(global.mess?.notgroup || 'ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ ɪs ꜰᴏʀ ɢʀᴏᴜᴘs ᴏɴʟʏ.');
    if (!isAdmins) return reply(global.mess?.notadmin || 'ʏᴏᴜ ᴍᴜsᴛ ʙᴇ ᴀɴ ᴀᴅᴍɪɴ.');
    if (!isBotAdmins) return reply(global.mess?.botadmin || 'ʙᴏᴛ ᴍᴜsᴛ ʙᴇ ᴀɴ ᴀᴅᴍɪɴ.');
    await conn.groupToggleEphemeral(from, 1 * 24 * 3600);
    reply('ᴅɪsᴀᴘᴘᴇᴀʀɪɴɢ ᴍᴇssᴀɢᴇs sᴜᴄᴄᴇssꜰᴜʟʟʏ ᴛᴜʀɴᴇᴅ ᴏɴ ꜰᴏʀ 24ʜʀs!');
});

// ─────────────────────────────────────────────
// SEND TO GROUP STATUS
// ─────────────────────────────────────────────
cmd({
    pattern: "togstatus",
    alias: ["swgc", "groupstatus", "tosgroup"],
    react: "📤",
    desc: "Send text/media to group status",
    category: "group",
    use: ".togstatus <text or reply to media>",
    filename: __filename
}, async (conn, mek, m, { from, reply, isGroup, isAdmins, isBotAdmins, participants, quoted }) => {
    if (!isGroup) return reply(global.mess?.notgroup || 'ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ ɪs ꜰᴏʀ ɢʀᴏᴜᴘs ᴏɴʟʏ.');
    if (!isAdmins) return reply(global.mess?.notadmin || 'ʏᴏᴜ ᴍᴜsᴛ ʙᴇ ᴀɴ ᴀᴅᴍɪɴ.');
    if (!isBotAdmins) return reply(global.mess?.botadmin || 'ʙᴏᴛ ᴍᴜsᴛ ʙᴇ ᴀɴ ᴀᴅᴍɪɴ.');

    try {
        const messageText = m.message?.conversation || m.message?.extendedTextMessage?.text || '';
        const quotedMessage = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const commandRegex = /^[.!#/]?(togstatus|swgc|groupstatus|tosgroup)\s*/i;

        if (!quotedMessage && (!messageText.trim() || messageText.trim().match(commandRegex))) {
            return reply(getHelpText());
        }

        let payload = null;
        let textAfterCommand = '';

        if (messageText.trim()) {
            const match = messageText.match(commandRegex);
            if (match) textAfterCommand = messageText.slice(match[0].length).trim();
        }

        if (quotedMessage) {
            payload = await buildPayloadFromQuoted(quotedMessage);
            if (textAfterCommand && payload) {
                if (payload.video || payload.image || (payload.convertedSticker && payload.image)) {
                    payload.caption = textAfterCommand;
                }
            }
        } else if (messageText.trim()) {
            if (textAfterCommand) payload = { text: textAfterCommand };
            else return reply(getHelpText());
        }

        if (!payload) return reply(getHelpText());

        await sendGroupStatus(conn, from, payload);

        const mediaType = detectMediaType(quotedMessage, payload);
        let successMsg = `✅ ${mediaType} sᴇɴᴛ!`;
        if (payload.caption) successMsg += `\n📝 "${payload.caption}"`;
        if (payload.convertedSticker) successMsg += `\n(sᴛɪᴄᴋᴇʀ → ɪᴍᴀɢᴇ)`;

        await reply(successMsg);
    } catch (error) {
        console.error('ɢʀᴏᴜᴘ sᴛᴀᴛᴜs ᴇʀʀᴏʀ:', error);
        await reply(`❌ ᴇʀʀᴏʀ: ${error.message}`);
    }
});