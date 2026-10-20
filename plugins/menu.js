const config = require('../config')
const { cmd, commands } = require('../command');
const path = require('path');
const os = require("os");
const fs = require('fs');
const { runtime } = require('../lib/functions');

cmd({
    pattern: "menu",
    alias: ["allmenu", "fullmenu"],
    use: '.menu2',
    desc: "Show all bot commands dynamically",
    category: "main",
    react: "📜",
    filename: __filename
},
async (conn, mek, m, { from, reply }) => {
    try {
        // 1. Count total commands
        let totalCommands = Object.keys(commands).length;

        // 2. Build the header
        let dec = `*╭────⬡ ${config.BOT_NAME} ⬡────⭓* 
*├▢ 🤖 ᴏᴡɴᴇʀ:* ${config.OWNER_NAME}
*├▢ 📜 ᴄᴏᴍᴍᴀɴᴅs:* ${totalCommands}
*├▢ ⏱️ ʀᴜɴᴛɪᴍᴇ:* ${runtime(process.uptime())}
*├▢ 📡 ʙᴀɪʟᴇʏs:* ᴍᴜʟᴛɪ ᴅᴇᴠɪᴄᴇ
*├▢ ☁️ ᴘʟᴀᴛꜰᴏʀᴍ:* ʀɪᴅᴢʜᴏꜱᴛ
*├▢ 📦 ᴘʀᴇꜰɪx:* ${config.PREFIX}
*├▢ ⚙️ ᴍᴏᴅᴇ:* ${config.MODE}
*├▢ 🏷️ ᴠᴇʀsɪᴏɴ:* 3.0.0 ʙᴇᴛᴀ
*╰─────────────────⭓*\n\n`;

        // 3. Group commands by category dynamically
        let categories = {};

        // Safely iterate through the loaded commands
        Object.values(commands).forEach((cmdObj) => {
            // Fallback to 'misc' if no category is defined
            let category = cmdObj.category ? cmdObj.category.toLowerCase() : 'misc';
            
            if (!categories[category]) {
                categories[category] = [];
            }
            
            // Add the command pattern to the category (avoid duplicates if any)
            if (cmdObj.pattern && !categories[category].includes(cmdObj.pattern)) {
                categories[category].push(cmdObj.pattern);
            }
        });

        // 4. Loop through the categories and build the menu strings
        for (const [category, cmds] of Object.entries(categories)) {
            // Sort commands alphabetically for a cleaner look
            cmds.sort(); 
            
            dec += `*╭────❍ ${category.toUpperCase()} MENU 🧚⧽───❍*\n`;
            cmds.forEach(cmdName => {
                dec += `*│┃➪ ${cmdName}*\n`;
            });
            dec += `*╰────────────────❍*\n\n`;
        }

        // 5. Footer
        dec += `${config.DESCRIPTION}`;

        // 6. Send the message
        await conn.sendMessage(from, { 
            image: { url: config.MENU_IMAGE_URL || 'https://files.catbox.moe/7zfdcq.jpg' }, 
            caption: dec, 
            contextInfo: { 
                mentionedJid: [m.sender], 
                forwardingScore: 999, 
                isForwarded: true, 
                forwardedNewsletterMessageInfo: { 
                    newsletterJid: '120363404529319592@newsletter', 
                    newsletterName: config.BOT_NAME, 
                    serverMessageId: 143 
                } 
            } 
        }, { quoted: mek });

    } catch (e) { 
        console.log(e); 
        reply(`ᴇʀʀᴏʀ: ${e.message}`); 
    } 
});