const config = require('../config')
const { cmd, commands } = require('../command');
const { runtime } = require('../lib/functions');

const NEWSLETTER_JID = '120363404529319592@newsletter';
const FALLBACK_IMAGE = 'https://files.catbox.moe/7zfdcq.jpg';
const WEBSITE = 'https://ridzcoder.xyz';

const menuImage = () => ({ url: config.MENU_IMAGE_URL || FALLBACK_IMAGE });

const forwardedContext = (m) => ({
    mentionedJid: [m.sender],
    forwardingScore: 999,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
        newsletterJid: NEWSLETTER_JID,
        newsletterName: config.BOT_NAME,
        serverMessageId: 143
    }
});

// Group the loaded commands by category, commands sorted A-Z (same rule the old menu used)
const getCategories = () => {
    const categories = {};
    Object.values(commands).forEach((cmdObj) => {
        const category = cmdObj.category ? cmdObj.category.toLowerCase() : 'misc';
        if (!categories[category]) categories[category] = [];
        if (cmdObj.pattern && !categories[category].includes(cmdObj.pattern)) {
            categories[category].push(cmdObj.pattern);
        }
    });
    Object.values(categories).forEach((list) => list.sort());
    return categories;
};

const buildHeader = () => {
    const totalCommands = Object.keys(commands).length;
    return `*╭────⬡ ${config.BOT_NAME} ⬡────⭓* 
*├▢ 🤖 ᴏᴡɴᴇʀ:* ${config.OWNER_NAME}
*├▢ 📜 ᴄᴏᴍᴍᴀɴᴅs:* ${totalCommands}
*├▢ ⏱️ ʀᴜɴᴛɪᴍᴇ:* ${runtime(process.uptime())}
*├▢ 📡 ʙᴀɪʟᴇʏs:* ᴍᴜʟᴛɪ ᴅᴇᴠɪᴄᴇ
*├▢ ☁️ ᴘʟᴀᴛꜰᴏʀᴍ:* ʀɪᴅᴢʜᴏꜱᴛ
*├▢ 📦 ᴘʀᴇꜰɪx:* ${config.PREFIX}
*├▢ ⚙️ ᴍᴏᴅᴇ:* ${config.MODE}
*├▢ 🏷️ ᴠᴇʀsɪᴏɴ:* 3.0.0 ʙᴇᴛᴀ
*╰─────────────────⭓*\n\n`;
};

const buildCategoryBlock = (category, cmds) => {
    let block = `*╭────❍ ${category.toUpperCase()} MENU 🧚⧽───❍*\n`;
    cmds.forEach((cmdName) => {
        block += `*│┃➪ ${cmdName}*\n`;
    });
    block += `*╰────────────────❍*\n\n`;
    return block;
};

// Image + caption, no buttons (the classic menu)
const sendTextMenu = (conn, from, mek, m, caption) =>
    conn.sendMessage(from, {
        image: menuImage(),
        caption,
        contextInfo: forwardedContext(m)
    }, { quoted: mek });

// Image + caption + buttons (native flow, supported by the t3rri-1 Baileys fork).
// Every button id is a command, so a tap runs it (index.js turns button replies into commands).
const sendButtonMenu = (conn, from, mek, m, categories) => {
    const p = config.PREFIX;
    const names = Object.keys(categories).sort();

    // WhatsApp lists hold about 10 rows per section
    const sections = [];
    for (let i = 0; i < names.length; i += 10) {
        sections.push({
            title: i === 0 ? '📂 Command categories' : `📂 More categories (${i / 10 + 1})`,
            rows: names.slice(i, i + 10).map((name) => ({
                header: '',
                title: name.toUpperCase(),
                description: `${categories[name].length} commands`,
                id: `${p}menu ${name}`
            }))
        });
    }

    return conn.sendMessage(from, {
        image: menuImage(),
        caption: `${buildHeader()}👇 Tap *Categories* to browse, or use a quick button below.`,
        footer: config.BOT_NAME,
        nativeFlow: [
            { text: '📂 Categories', sections },
            { text: '📜 All commands', id: `${p}allmenu` },
            { text: '🏓 Ping', id: `${p}ping` },
            { text: '👑 Owner', id: `${p}owner` },
            { text: '🌐 Website', url: WEBSITE }
        ],
        contextInfo: forwardedContext(m)
    }, { quoted: mek });
};

const buildFullMenu = (categories) => {
    let dec = buildHeader();
    for (const [category, cmds] of Object.entries(categories)) {
        dec += buildCategoryBlock(category, cmds);
    }
    return dec + `${config.DESCRIPTION}`;
};

// .menu            -> button menu
// .menu <category> -> the commands of that category
cmd({
    pattern: "menu",
    alias: ["buttons"],
    use: '.menu [category]',
    desc: "Show the bot menu with buttons",
    category: "main",
    react: "📜",
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
    try {
        const categories = getCategories();
        const wanted = (q || '').trim().toLowerCase();

        if (wanted) {
            const names = Object.keys(categories);
            const category = names.find((c) => c === wanted) || names.find((c) => c.startsWith(wanted));
            if (!category) {
                return reply(`❌ No category called "${wanted}". Send ${config.PREFIX}menu and pick one from the list.`);
            }
            const caption = buildHeader() + buildCategoryBlock(category, categories[category]) +
                `↩️ ${config.PREFIX}menu - back to the buttons\n\n${config.DESCRIPTION}`;
            return await sendTextMenu(conn, from, mek, m, caption);
        }

        try {
            await sendButtonMenu(conn, from, mek, m, categories);
        } catch (err) {
            // never leave the chat without a menu: fall back to the classic one
            console.log('Button menu failed, sending the classic menu:', err);
            await sendTextMenu(conn, from, mek, m, buildFullMenu(categories));
        }
    } catch (e) {
        console.log(e);
        reply(`ᴇʀʀᴏʀ: ${e.message}`);
    }
});

// .allmenu -> every command in one message (the old .menu)
cmd({
    pattern: "allmenu",
    alias: ["fullmenu"],
    use: '.allmenu',
    desc: "Show all bot commands in one list",
    category: "main",
    react: "📜",
    filename: __filename
},
async (conn, mek, m, { from, reply }) => {
    try {
        await sendTextMenu(conn, from, mek, m, buildFullMenu(getCategories()));
    } catch (e) {
        console.log(e);
        reply(`ᴇʀʀᴏʀ: ${e.message}`);
    }
});
