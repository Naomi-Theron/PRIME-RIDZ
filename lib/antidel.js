const { isJidGroup } = require('@whiskeysockets/baileys');
const { loadMessage, getAnti } = require('../data');
const config = require('../config');

// Newsletter configuration
const vero = {
    jid: '120363404529319592@newsletter',
    name: 'ᴘʀɪᴍᴇ ʀɪᴅᴢ ᴀɴᴛɪ ᴅᴇʟᴇᴛᴇ 🌟',
    serverMessageId: 143,
    imageUrl: 'https://files.catbox.moe/oyadfh.png',
    watermark: '> ʙʀᴏᴜɢʜᴛ ᴛᴏ ʏᴏᴜ ʙʏ ʀɪᴅᴢ ᴄᴏᴅᴇʀ'
};

const timeOptions = {
    timeZone: 'Uganda/Kampala',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
};

const getNewsletterContext = () => ({
    forwardingScore: 999,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
        newsletterJid: vero.jid,
        newsletterName: vero.name,
        serverMessageId: vero.serverMessageId
    }
});

const getMessageContent = (mek) => {
    if (mek.message?.conversation) return mek.message.conversation;
    if (mek.message?.extendedTextMessage?.text) return mek.message.extendedTextMessage.text;
    if (mek.message?.imageMessage?.caption) return mek.message.imageMessage.caption;
    if (mek.message?.videoMessage?.caption) return mek.message.videoMessage.caption;
    if (mek.message?.documentMessage?.caption) return mek.message.documentMessage.caption;
    return '🚫 Content unavailable (may be media without caption)';
};

function getMessageType(message) {
    if (!message) return 'Unknown';
    
    const type = Object.keys(message)[0];
    const typeMap = {
        conversation: 'Text',
        imageMessage: 'Image',
        videoMessage: 'Video',
        audioMessage: 'Audio',
        documentMessage: 'Document',
        stickerMessage: 'Sticker',
        extendedTextMessage: 'Text with Link',
        contactMessage: 'Contact',
        locationMessage: 'Location'
    };
    
    return typeMap[type] || type.replace('Message', '') || 'Unknown';
}

const DeletedText = async (conn, mek, jid, deleteInfo, isGroup, update) => {
    try {
        // Extract message content with comprehensive fallbacks
        const messageContent = getMessageContent(mek);
        
        // Enhanced delete info with newsletter branding
        const fullMessage = `
${deleteInfo}

📝 *ᴍᴇꜱꜱᴀɢᴇ ᴄᴏɴᴛᴇɴᴛ:*
${messageContent}

${vero.watermark}`;

        const mentionedJids = isGroup 
            ? [update.key.participant, mek.key.participant].filter(Boolean) 
            : [update.key.remoteJid].filter(Boolean);

        await conn.sendMessage(
            jid,
            {
                image: { url: vero.imageUrl },
                caption: fullMessage,
                contextInfo: {
                    ...getNewsletterContext(),
                    mentionedJid: mentionedJids,
                },
            },
            { quoted: mek }
        );
    } catch (error) {
        console.error('Error in DeletedText:', error);
    }
};

const DeletedMedia = async (conn, mek, jid, deleteInfo) => {
    try {
        const antideletedmek = structuredClone(mek.message);
        const messageType = Object.keys(antideletedmek)[0];
        
        const mediaTypes = {
            imageMessage: { type: 'image', key: 'imageMessage' },
            videoMessage: { type: 'video', key: 'videoMessage' },
            audioMessage: { type: 'audio', key: 'audioMessage' },
            documentMessage: { type: 'document', key: 'documentMessage' },
            stickerMessage: { type: 'sticker', key: 'stickerMessage' }
        };

        const currentType = mediaTypes[messageType];
        
        if (currentType) {
            const caption = `
${deleteInfo}

${vero.watermark}`;

            if (['image', 'video'].includes(currentType.type)) {
                const mediaUrl = antideletedmek[currentType.key]?.url 
                    || vero.imageUrl;
                
                await conn.sendMessage(jid, { 
                    [currentType.type]: { url: mediaUrl },
                    caption: caption,
                    contextInfo: {
                        ...getNewsletterContext(),
                        mentionedJid: [mek.key.participant || mek.key.remoteJid],
                    }
                }, { quoted: mek });
            } 
            else {
                // For non-visual media, send with header image first
                await conn.sendMessage(jid, { 
                    image: { url: vero.imageUrl },
                    caption: `*⚠️ Deleted ${currentType.type.toUpperCase()} Alert 🚨*`,
                    contextInfo: getNewsletterContext()
                });
                
                await conn.sendMessage(jid, { 
                    text: caption,
                    contextInfo: getNewsletterContext()
                }, { quoted: mek });
                
                if (antideletedmek[currentType.key]?.url) {
                    await conn.sendMessage(jid, {
                        [currentType.type]: { url: antideletedmek[currentType.key].url },
                        contextInfo: getNewsletterContext()
                    }, { quoted: mek });
                }
            }
        } else {
            antideletedmek[messageType].contextInfo = {
                ...getNewsletterContext(),
                stanzaId: mek.key.id,
                participant: mek.key.participant || mek.key.remoteJid,
                quotedMessage: mek.message,
            };
            await conn.relayMessage(jid, antideletedmek, {});
        }
    } catch (error) {
        console.error('Error in DeletedMedia:', error);
    }
};

const AntiDelete = async (conn, updates) => {
    try {
        for (const update of updates) {
            if (update.update.message === null) {
                const store = await loadMessage(update.key.id);

                if (store && store.message) {
                    const mek = store.message;
                    const isGroup = isJidGroup(store.jid);
                    const antiDeleteStatus = await getAnti();
                    if (!antiDeleteStatus) continue;

                    const deleteTime = new Date().toLocaleTimeString('en-GB', timeOptions);
                    const deleteDate = new Date().toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric'
                    });

                    let deleteInfo, jid;
                    if (isGroup) {
                        try {
                            const groupMetadata = await conn.groupMetadata(store.jid);
                            const groupName = groupMetadata.subject || 'Unknown Group';
                            const sender = mek.key.participant?.split('@')[0] || 'Unknown';
                            const deleter = update.key.participant?.split('@')[0] || 'Unknown';

                            deleteInfo = `
 ╭━━━❏*ᴘʀɪᴍᴇ ʀɪᴅᴢ🧚* ━━━━━❏
*├•▣┃ᴅᴀᴛᴇ:* ${deleteDate}
*├•▣┃ᴛɪᴍᴇ:* ${deleteTime}
*├•▣┃ꜱᴇɴᴅᴇʀ:* @${sender}
*├•▣┃ɢʀᴏᴜᴘ:* ${groupName}
*├•▣┃ᴅᴇʟᴇᴛᴇᴅ ʙʏ:* @${deleter}
*├•▣┃ᴍᴇꜱꜱᴀɢᴇ ᴛʏᴘᴇ:* ${getMessageType(mek.message)}
*╰▬▬▬▬▬▬▬▬▬▬▬▬▬▬❏  
> https://ridzcoder.xyz`;
                            jid = config.ANTI_DEL_PATH === "inbox" ? conn.user.id : store.jid;
                        } catch (e) {
                            console.error('Error getting group metadata:', e);
                            continue;
                        }
                    } else {
                        const senderNumber = mek.key.participant?.split('@')[0] || mek.key.remoteJid?.split('@')[0] || 'Unknown';
                        const deleterNumber = update.key.participant?.split('@')[0] || update.key.remoteJid?.split('@')[0] || 'Unknown';
                        
                        deleteInfo = `
*╭━━━❏ ᴘʀɪᴍᴇ ʀɪᴅᴢ🧚* ━━━━━❏
*├•▣┃ ᴅᴀᴛᴇ:* ${deleteDate}
*├•▣┃ ᴛɪᴍᴇ:* ${deleteTime}
*├•▣┃ ꜱᴇɴᴅᴇʀ:* @${senderNumber}
*├•▣┃ ᴅᴇʟᴇᴛᴇᴅ ʙʏ:* @${deleterNumber}
*├•▣┃ ᴍᴇꜱꜱᴀɢᴇ ᴛʏᴘᴇ:* ${getMessageType(mek.message)}
*╰▬▬▬▬▬▬▬▬▬▬▬▬▬▬❏  
> https://ridzcoder.xyz`;
                        jid = config.ANTI_DEL_PATH === "inbox" ? conn.user.id : update.key.remoteJid || store.jid;
                    }

                    // Add newsletter footer
                    deleteInfo += `\n\n${vero.watermark}`;

                    const messageType = mek.message ? Object.keys(mek.message)[0] : null;
                    
                    if (messageType === 'conversation' || messageType === 'extendedTextMessage' || 
                        (messageType && ['imageMessage', 'videoMessage', 'documentMessage'].includes(messageType) && 
                        mek.message[messageType]?.caption)) {
                        await DeletedText(conn, mek, jid, deleteInfo, isGroup, update);
                    } else if (messageType && [
                        'imageMessage', 
                        'videoMessage', 
                        'stickerMessage', 
                        'documentMessage', 
                        'audioMessage',
                        'voiceMessage'
                    ].includes(messageType)) {
                        await DeletedMedia(conn, mek, jid, deleteInfo);
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error in AntiDelete:', error);
    }
};

module.exports = {
    DeletedText,
    DeletedMedia,
    AntiDelete,
};