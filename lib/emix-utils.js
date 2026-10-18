const axios = require("axios");
async function fetchEmix(emoji1, emoji2) {
    try {
        if (!emoji1 || !emoji2) {
            throw new Error("ɪɴᴠᴀʟɪᴅ ᴇᴍᴏɢɪ ɪɴᴘᴜᴛ ᴘʟᴇᴀꜱᴇ ᴘʀᴏᴠɪᴅᴇ 2 ᴇᴍᴏᴊɪꜱ.");
        }

        const apiUrl = `https://levanter.onrender.com/emix?q=${encodeURIComponent(emoji1)},${encodeURIComponent(emoji2)}`;
        const response = await axios.get(apiUrl);

        if (response.data && response.data.result) {
            return response.data.result; // Return the image URL
        } else {
            throw new Error("ɴᴏ ᴠᴀʟɪᴅ ɪᴍᴀɢᴇ ꜰᴏᴜɴᴅ.");
        }
    } catch (error) {
        console.error("Error fetching emoji mix:", error.message);
        throw new Error("Failed to fetch emoji mix.");
    }
}

module.exports = { fetchEmix };
