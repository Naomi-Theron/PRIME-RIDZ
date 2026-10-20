const fetch = require('node-fetch');
const axios = require('axios');
const { cmd } = require('../command');
const { anony } = require('../lib/ridzcoder');

// ─────────────────────────────────────────────
// GLOBAL API BASE
// ─────────────────────────────────────────────
const API = global.api || 'https://api.princetechn.com/api';

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
function getLeaguePath(leagueCode) {
    const leagueMap = {
        'PL': 'epl', 'CL': 'ucl', 'PD': 'laliga', 'BL1': 'bundesliga',
        'SA': 'seriea', 'FL1': 'ligue1', 'EL': 'el', 'ELC': 'efl',
        'WC': 'wc', 'EUROS': 'euros', 'FIFA': 'fifa'
    };
    return leagueMap[leagueCode] || leagueCode.toLowerCase();
}

function categorizeMatches(matches) {
    const categories = { liveMatches: [], finishedMatches: [], otherMatches: [] };
    matches.forEach(match => {
        if (match.status === 'FINISHED') categories.finishedMatches.push(match);
        else if (isLiveMatch(match)) categories.liveMatches.push(match);
        else categories.otherMatches.push(match);
    });
    return categories;
}

function isLiveMatch(match) {
    const liveStatusIndicators = ['LIVE', 'ONGOING', 'IN_PROGRESS', 'PLAYING'];
    return (match.status && liveStatusIndicators.some(i => match.status.toUpperCase().includes(i))) ||
           (match.score && match.status !== 'FINISHED');
}

function buildLiveMatchesSection(liveMatches) {
    if (!liveMatches.length) return null;
    let section = `🔥 *ʟɪᴠᴇ ᴍᴀᴛᴄʜᴇs (${liveMatches.length})*\n\n`;
    liveMatches.forEach((match, index) => {
        section += `${index + 1}. 🟢 ${match.status || 'ʟɪᴠᴇ'}\n   ${match.homeTeam} ᴠs ${match.awayTeam}\n`;
        if (match.score) section += `   📊 sᴄᴏʀᴇ: ${match.score}\n`;
        if (match.time) section += `   ⏱️ ᴍɪɴᴜᴛᴇ: ${match.time}\n`;
        section += '\n';
    });
    return section;
}

function buildFinishedMatchesSection(finishedMatches) {
    if (!finishedMatches.length) return null;
    let section = `✅ *ʀᴇᴄᴇɴᴛ ʀᴇsᴜʟᴛs (${finishedMatches.length})*\n\n`;
    const byMatchday = finishedMatches.reduce((acc, match) => {
        (acc[match.matchday] = acc[match.matchday] || []).push(match);
        return acc;
    }, {});
    Object.keys(byMatchday).sort((a, b) => b - a).forEach(matchday => {
        section += `📅 *ᴍᴀᴛᴄʜᴅᴀʏ ${matchday} (${byMatchday[matchday].length} ᴍᴀᴛᴄʜᴇs):*\n`;
        byMatchday[matchday].forEach((match, i) => {
            const winnerEmoji = match.winner === 'Draw' ? '⚖️' : '🏆';
            section += `${i + 1}. ${match.homeTeam} ${match.score} ${match.awayTeam}\n   ${winnerEmoji} ${match.winner}\n\n`;
        });
    });
    return section;
}

function buildOtherMatchesSection(otherMatches, liveMatches, finishedMatches) {
    if (!otherMatches.length || liveMatches.length || finishedMatches.length) return null;
    let section = `📌 *ᴏᴛʜᴇʀ ᴍᴀᴛᴄʜᴇs (${otherMatches.length})*\n\n`;
    otherMatches.forEach((match, i) => {
        section += `${i + 1}. ${match.homeTeam} ᴠs ${match.awayTeam}\n   sᴛᴀᴛᴜs: ${match.status || 'ᴜɴᴋɴᴏᴡɴ'}\n\n`;
    });
    return section;
}

// ─────────────────────────────────────────────
// STANDINGS
// ─────────────────────────────────────────────
async function formatStandings(leagueCode, leagueName, conn, mek, m, { from, reply }) {
    try {
        const leaguePath = getLeaguePath(leagueCode);
        const apiUrl = `${API}/${leaguePath}/standings`;
        console.log(`ꜰᴇᴛᴄʜɪɴɢ sᴛᴀɴᴅɪɴɢs: ${apiUrl}`);
        const response = await fetch(apiUrl);
        const data = await response.json();
        if (!data.status || !data.result) return reply(`❌ ꜰᴀɪʟᴇᴅ ᴛᴏ ꜰᴇᴛᴄʜ ${leagueName} sᴛᴀɴᴅɪɴɢs.`);
        const standings = data.result.standings || data.result;
        if (!standings || standings.length === 0) return reply(`❌ ɴᴏ sᴛᴀɴᴅɪɴɢs ꜰᴏᴜɴᴅ ꜰᴏʀ ${leagueName}.`);

        let message = `*⚽ ${leagueName} sᴛᴀɴᴅɪɴɢs ⚽*\n\n`;
        standings.forEach((team) => {
            let positionIndicator = '';
            if (leagueCode === 'CL' || leagueCode === 'EL') {
                if (team.position <= (leagueCode === 'CL' ? 4 : 3)) positionIndicator = '🌟 ';
            } else {
                if (team.position <= 4) positionIndicator = '🌟 ';
                else if (team.position === 5 || team.position === 6) positionIndicator = '⭐ ';
                else if (team.position >= standings.length - 2) positionIndicator = '⚠️ ';
            }
            message += `*${positionIndicator}${team.position}.* ${team.team}\n`;
            message += `   📊 ᴘʟᴀʏᴇᴅ: ${team.played} | ᴡ: ${team.won} | ᴅ: ${team.draw} | ʟ: ${team.lost}\n`;
            message += `   ⚽ ɢᴏᴀʟs: ${team.goalsFor}-${team.goalsAgainst} (ɢᴅ: ${team.goalDifference > 0 ? '+' : ''}${team.goalDifference})\n`;
            message += `   🏆 ᴘᴏɪɴᴛs: *${team.points}*\n\n`;
        });
        message += leagueCode === 'CL' || leagueCode === 'EL' ? '\n*🌟 = ǫᴜᴀʟɪꜰɪᴄᴀᴛɪᴏɴ ꜰᴏʀ ɴᴇxᴛ sᴛᴀɢᴇ*' : '\n*🌟 = ᴜᴄʟ | ⭐ = ᴇᴜʀᴏᴘᴀ | ⚠️ = ʀᴇʟᴇɢᴀᴛɪᴏɴ*';
        reply(message);
    } catch (error) {
        console.error(error);
        reply(`❌ ᴇʀʀᴏʀ ꜰᴇᴛᴄʜɪɴɢ ${leagueName} sᴛᴀɴᴅɪɴɢs.`);
    }
}

// ─────────────────────────────────────────────
// MATCHES
// ─────────────────────────────────────────────
async function formatMatches(leagueCode, leagueName, conn, mek, m, { reply }) {
    try {
        const leaguePath = getLeaguePath(leagueCode);
        const response = await fetch(`${API}/${leaguePath}/matches`);
        const data = await response.json();
        if (!data.status || !data.result) return reply(`❌ ꜰᴀɪʟᴇᴅ ᴛᴏ ꜰᴇᴛᴄʜ ${leagueName} ᴍᴀᴛᴄʜᴇs.`);
        const matches = data.result.matches || data.result;
        if (!matches || matches.length === 0) return reply(`❌ ɴᴏ ${leagueName} ᴍᴀᴛᴄʜᴇs ꜰᴏᴜɴᴅ.`);

        const { liveMatches, finishedMatches, otherMatches } = categorizeMatches(matches);
        const sections = [
            buildLiveMatchesSection(liveMatches),
            buildFinishedMatchesSection(finishedMatches),
            buildOtherMatchesSection(otherMatches, liveMatches, finishedMatches)
        ].filter(Boolean);

        const header = `*⚽ ${leagueName} ᴍᴀᴛᴄʜ ʀᴇsᴜʟᴛs & ʟɪᴠᴇ ɢᴀᴍᴇs ⚽*\n\n`;
        reply(sections.length ? header + sections.join('\n') : header + `ɴᴏ ᴄᴜʀʀᴇɴᴛ ᴏʀ ʀᴇᴄᴇɴᴛ ᴍᴀᴛᴄʜᴇs. ᴜsᴇ .${leagueCode.toLowerCase()}ᴜᴘᴄᴏᴍɪɴɢ`);
    } catch (error) {
        console.error(error);
        reply(`❌ ᴇʀʀᴏʀ ꜰᴇᴛᴄʜɪɴɢ ${leagueName} ᴍᴀᴛᴄʜᴇs.`);
    }
}

// ─────────────────────────────────────────────
// TOP SCORERS
// ─────────────────────────────────────────────
async function formatTopScorers(leagueCode, leagueName, conn, mek, m, { reply }) {
    try {
        const leaguePath = getLeaguePath(leagueCode);
        const response = await fetch(`${API}/${leaguePath}/scorers`);
        const data = await response.json();
        if (!data.status || !data.result) return reply(`❌ ꜰᴀɪʟᴇᴅ ᴛᴏ ꜰᴇᴛᴄʜ ${leagueName} ᴛᴏᴘ sᴄᴏʀᴇʀs.`);
        const scorers = data.result.topScorers || data.result;
        if (!scorers || scorers.length === 0) return reply(`❌ ɴᴏ ᴛᴏᴘ sᴄᴏʀᴇʀs ꜰᴏʀ ${leagueName}.`);

        let message = `*⚽ ${leagueName} ᴛᴏᴘ sᴄᴏʀᴇʀs ⚽*\n\n🏆 *ɢᴏʟᴅᴇɴ ʙᴏᴏᴛ ʀᴀᴄᴇ*\n\n`;
        scorers.forEach(player => {
            message += `*${player.rank}.* ${player.player} (${player.team})\n   ⚽ ɢᴏᴀʟs: *${player.goals}* | 🎯 ᴀssɪsᴛs: ${player.assists || 0} | ⏏️ ᴘᴇɴᴀʟᴛɪᴇs: ${player.penalties || 0}\n\n`;
        });
        reply(message);
    } catch (error) {
        console.error(error);
        reply(`❌ ᴇʀʀᴏʀ ꜰᴇᴛᴄʜɪɴɢ ${leagueName} ᴛᴏᴘ sᴄᴏʀᴇʀs.`);
    }
}

// ─────────────────────────────────────────────
// UPCOMING MATCHES
// ─────────────────────────────────────────────
async function formatUpcomingMatches(leagueCode, leagueName, conn, mek, m, { reply }) {
    try {
        const leaguePath = getLeaguePath(leagueCode);
        const response = await fetch(`${API}/${leaguePath}/upcomingmatches`);
        const data = await response.json();
        if (!data.status || !data.result) return reply(`❌ ꜰᴀɪʟᴇᴅ ᴛᴏ ꜰᴇᴛᴄʜ ᴜᴘᴄᴏᴍɪɴɢ ${leagueName} ᴍᴀᴛᴄʜᴇs.`);
        const matches = data.result.upcomingMatches || data.result;
        if (!matches || matches.length === 0) return reply(`❌ ɴᴏ ᴜᴘᴄᴏᴍɪɴɢ ${leagueName} ᴍᴀᴛᴄʜᴇs.`);

        let message = `*📅 ᴜᴘᴄᴏᴍɪɴɢ ${leagueName} ᴍᴀᴛᴄʜᴇs ⚽*\n\n`;
        const byMatchday = {};
        matches.forEach(match => {
            const matchday = match.matchday || 1;
            if (!byMatchday[matchday]) byMatchday[matchday] = [];
            byMatchday[matchday].push(match);
        });

        Object.keys(byMatchday).sort((a, b) => a - b).forEach(matchday => {
            message += `*🗓️ ᴍᴀᴛᴄʜᴅᴀʏ ${matchday}:*\n`;
            byMatchday[matchday].forEach(match => {
                const matchDate = new Date(match.date);
                const formattedDate = matchDate.toLocaleString('en-US', {
                    weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                });
                message += `\n⏰ ${formattedDate}\n   🏠 ${match.homeTeam} ᴠs ${match.awayTeam} 🚌\n\n`;
            });
            message += '\n';
        });
        reply(message);
    } catch (error) {
        console.error(error);
        reply(`❌ ᴇʀʀᴏʀ ꜰᴇᴛᴄʜɪɴɢ ᴜᴘᴄᴏᴍɪɴɢ ᴍᴀᴛᴄʜᴇs.`);
    }
}

// ─────────────────────────────────────────────
// SEARCH TEAM
// ─────────────────────────────────────────────
async function searchTeam(query, conn, mek, m, { reply }) {
    try {
        if (!query) return reply("❌ ᴘʟᴇᴀsᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ᴛᴇᴀᴍ ɴᴀᴍᴇ.");
        const response = await fetch(`${API}/sport/teamsearch?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        if (!data.status || !data.result || data.result.length === 0) return reply(`❌ ɴᴏ ᴛᴇᴀᴍ ꜰᴏᴜɴᴅ ꜰᴏʀ "${query}"`);

        const team = data.result[0];
        let message = `*⚽ ᴛᴇᴀᴍ ɪɴꜰᴏ: ${team.name} ⚽*\n\n`;
        message += `*🏷️ ꜰᴜʟʟ ɴᴀᴍᴇ:* ${team.alternateName || team.name}\n`;
        message += `*📅 ꜰᴏʀᴍᴇᴅ:* ${team.formedYear || 'ɴ/ᴀ'}\n`;
        message += `*🏟️ sᴛᴀᴅɪᴜᴍ:* ${team.stadium || 'ɴ/ᴀ'} (ᴄᴀᴘ: ${team.stadiumCapacity?.toLocaleString() || 'ɴ/ᴀ'})\n`;
        message += `*📍 ʟᴏᴄᴀᴛɪᴏɴ:* ${team.location || team.country || 'ɴ/ᴀ'}\n`;
        message += `*🏆 ʟᴇᴀɢᴜᴇ:* ${team.league || 'ɴ/ᴀ'}\n\n`;
        if (team.description) message += `*📝 ᴅᴇsᴄ:* ${team.description.substring(0, 300)}...\n\n`;
        reply(message);
    } catch (error) {
        console.error(error);
        reply("❌ ᴇʀʀᴏʀ sᴇᴀʀᴄʜɪɴɢ ᴛᴇᴀᴍ.");
    }
}

// ─────────────────────────────────────────────
// SEARCH PLAYER
// ─────────────────────────────────────────────
async function searchPlayer(query, conn, mek, m, { from, reply }) {
    try {
        if (!query) return reply("*ᴘʟᴇᴀsᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ᴘʟᴀʏᴇʀ ɴᴀᴍᴇ.*");
        const response = await fetch(`${API}/sport/playersearch?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        if (!data.status || !data.result || data.result.length === 0) return reply(`❌ ɴᴏ ᴘʟᴀʏᴇʀ ꜰᴏᴜɴᴅ ꜰᴏʀ "${query}"`);

        const player = data.result[0];
        let message = `*⚽ ᴘʟᴀʏᴇʀ ɪɴꜰᴏ ⚽*\n\n`;
        message += `*👤 ɴᴀᴍᴇ:* ${player.name}\n*🏠 ᴛᴇᴀᴍ:* ${player.team || 'ɴ/ᴀ'}\n`;
        message += `*🌍 ɴᴀᴛɪᴏɴᴀʟɪᴛʏ:* ${player.nationality || 'ɴ/ᴀ'}\n*🎂 ʙᴏʀɴ:* ${player.birthDate || 'ɴ/ᴀ'}\n`;
        message += `*⚽ ᴘᴏsɪᴛɪᴏɴ:* ${player.position || 'ɴ/ᴀ'}\n*📊 sᴛᴀᴛᴜs:* ${player.status || 'ɴ/ᴀ'}\n\n`;
        await reply(message);
        if (player.thumbnail) await conn.sendMessage(from, { image: { url: player.thumbnail }, caption: `🖼️ ${player.name}` }, { quoted: anony });
    } catch (error) {
        console.error(error);
        reply("❌ ᴇʀʀᴏʀ sᴇᴀʀᴄʜɪɴɢ ᴘʟᴀʏᴇʀ.");
    }
}

// ─────────────────────────────────────────────
// SEARCH VENUE
// ─────────────────────────────────────────────
async function searchVenue(query, conn, mek, m, { from, reply }) {
    try {
        if (!query) return reply("❌ ᴘʟᴇᴀsᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ᴠᴇɴᴜᴇ ɴᴀᴍᴇ.");
        const response = await fetch(`${API}/sport/venuesearch?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        if (!data.status || !data.result || data.result.length === 0) return reply(`❌ ɴᴏ ᴠᴇɴᴜᴇ ꜰᴏᴜɴᴅ ꜰᴏʀ "${query}"`);

        const venue = data.result[0];
        let message = `*🏟️ ᴠᴇɴᴜᴇ ɪɴꜰᴏ: ${venue.name} 🏟️*\n\n`;
        message += `*📍 ʟᴏᴄᴀᴛɪᴏɴ:* ${venue.location || venue.country || 'ɴ/ᴀ'}\n`;
        message += `*👥 ᴄᴀᴘᴀᴄɪᴛʏ:* ${venue.capacity?.toLocaleString() || 'ɴ/ᴀ'}\n`;
        message += `*🏅 sᴘᴏʀᴛ:* ${venue.sport || 'ɴ/ᴀ'}\n*📅 ʙᴜɪʟᴛ:* ${venue.yearBuilt || 'ɴ/ᴀ'}\n\n`;
        if (venue.description) message += `*📝 ᴅᴇsᴄ:* ${venue.description.substring(0, 300)}...\n\n`;
        await reply(message);
        if (venue.media?.thumb) await conn.sendMessage(from, { image: { url: venue.media.thumb }, caption: `🏟️ ${venue.name}` }, { quoted: anony });
    } catch (error) {
        console.error(error);
        reply("❌ ᴇʀʀᴏʀ sᴇᴀʀᴄʜɪɴɢ ᴠᴇɴᴜᴇ.");
    }
}

// ─────────────────────────────────────────────
// HEAD TO HEAD
// ─────────────────────────────────────────────
async function getHeadToHead(team1, team2, conn, mek, m, { reply }) {
    try {
        const query = `${team1} vs ${team2}`;
        const response = await fetch(`${API}/sport/gameevents?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        if (!data.status || !data.result || data.result.length === 0) return reply(`❌ ɴᴏ ʜᴇᴀᴅ-ᴛᴏ-ʜᴇᴀᴅ ꜰᴏᴜɴᴅ ʙᴇᴛᴡᴇᴇɴ ${team1} & ${team2}`);

        const matches = data.result;
        let message = `*⚽ ʜᴇᴀᴅ-ᴛᴏ-ʜᴇᴀᴅ: ${team1} ᴠs ${team2} ⚽*\n\n`;
        message += `*📊 ᴛᴏᴛᴀʟ ᴍᴇᴇᴛɪɴɢs:* ${matches.length}\n\n`;

        let team1Wins = 0, team2Wins = 0, draws = 0, team1Goals = 0, team2Goals = 0;
        matches.forEach(match => {
            const homeScore = match.teams?.home?.score || 0;
            const awayScore = match.teams?.away?.score || 0;
            const homeTeam = match.teams?.home?.name?.toLowerCase() || '';
            const awayTeam = match.teams?.away?.name?.toLowerCase() || '';
            if (homeTeam.includes(team1.toLowerCase()) || awayTeam.includes(team2.toLowerCase())) {
                if (homeScore > awayScore) team1Wins++; else if (awayScore > homeScore) team2Wins++; else draws++;
                team1Goals += homeScore; team2Goals += awayScore;
            } else {
                if (awayScore > homeScore) team1Wins++; else if (homeScore > awayScore) team2Wins++; else draws++;
                team1Goals += awayScore; team2Goals += homeScore;
            }
        });

        message += `*📈 sᴛᴀᴛs:*\n   🏠 ${team1}: ${team1Wins} ᴡɪɴs\n   🚌 ${team2}: ${team2Wins} ᴡɪɴs\n   ⚖️ ᴅʀᴀᴡs: ${draws}\n   ⚽ ɢᴏᴀʟs: ${team1} ${team1Goals} - ${team2Goals} ${team2}\n\n─────────────────\n\n*📅 ʀᴇᴄᴇɴᴛ ᴇɴᴄᴏᴜɴᴛᴇʀs:*\n\n`;
        matches.slice(0, 5).forEach((match, i) => {
            message += `${i + 1}. ${match.match}\n   📊 ${match.teams?.home?.score || 0} - ${match.teams?.away?.score || 0}\n   🏆 ${match.league?.name || 'ᴜɴᴋɴᴏᴡɴ'}\n   📅 ${match.dateTime?.date || 'ᴛʙᴅ'}\n\n`;
        });
        reply(message);
    } catch (error) {
        console.error(error);
        reply("❌ ᴇʀʀᴏʀ ꜰᴇᴛᴄʜɪɴɢ ʜᴇᴀᴅ-ᴛᴏ-ʜᴇᴀᴅ.");
    }
}

// ─────────────────────────────────────────────
// GAME EVENTS SEARCH
// ─────────────────────────────────────────────
async function searchGameEvents(query, conn, mek, m, { reply }) {
    try {
        if (!query || !query.trim()) return reply("❌ ᴘʟᴇᴀsᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ sᴇᴀʀᴄʜ ǫᴜᴇʀʏ.");
        const response = await fetch(`${API}/sport/gameevents?q=${encodeURIComponent(query.trim())}`);
        const data = await response.json();
        if (!data.status || !data.result || data.result.length === 0) return reply(`❌ ɴᴏ ᴇᴠᴇɴᴛs ꜰᴏʀ "${query}"`);

        const events = data.result;
        let message = `*⚽ ɢᴀᴍᴇ ᴇᴠᴇɴᴛs ʀᴇsᴜʟᴛs ⚽*\n\n🔍 ǫᴜᴇʀʏ: "${query}"\n📊 ᴛᴏᴛᴀʟ: ${events.length}\n\n─────────────────\n\n`;
        events.forEach((match, i) => {
            message += `*${i + 1}. ${match.match}*\n`;
            message += `   🏠 ${match.teams?.home?.name || '?'} ᴠs 🚌 ${match.teams?.away?.name || '?'}\n`;
            message += `   📊 sᴄᴏʀᴇ: ${match.teams?.home?.score ?? '?'} - ${match.teams?.away?.score ?? '?'}\n`;
            message += `   🏆 ${match.league?.name || 'ᴜɴᴋɴᴏᴡɴ'}\n`;
            if (match.dateTime?.date) {
                const date = new Date(match.dateTime.date);
                message += `   📅 ${date.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}\n`;
            }
            const statusEmoji = match.status === 'Match Finished' ? '✅' : match.status?.toLowerCase().includes('live') ? '🔴' : '⏳';
            message += `   ${statusEmoji} ${match.status || 'sᴄʜᴇᴅᴜʟᴇᴅ'}\n\n─────────────────\n\n`;
        });
        reply(message);
    } catch (error) {
        console.error(error);
        reply("❌ ᴇʀʀᴏʀ ꜰᴇᴛᴄʜɪɴɢ ɢᴀᴍᴇ ᴇᴠᴇɴᴛs.");
    }
}

// ─────────────────────────────────────────────
// MATCH DETAILS
// ─────────────────────────────────────────────
async function getMatchDetails(matchId, conn, mek, m, { reply }) {
    try {
        if (!matchId) return reply("❌ ᴘʟᴇᴀsᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ᴍᴀᴛᴄʜ ɪᴅ.");
        const response = await fetch(`${API}/sport/gameevents?q=${encodeURIComponent('vs')}`);
        const data = await response.json();
        if (!data.status || !data.result) return reply("❌ ꜰᴀɪʟᴇᴅ ᴛᴏ ꜰᴇᴛᴄʜ ᴍᴀᴛᴄʜ ᴅᴇᴛᴀɪʟs.");
        const match = data.result.find(m => m.id === matchId);
        if (!match) return reply(`❌ ᴍᴀᴛᴄʜ ${matchId} ɴᴏᴛ ꜰᴏᴜɴᴅ.`);

        let message = `*⚽ ᴅᴇᴛᴀɪʟᴇᴅ ᴍᴀᴛᴄʜ ɪɴꜰᴏ ⚽*\n\n`;
        message += `┌────────────────\n`;
        message += `│ 🏠 *ʜᴏᴍᴇ:* ${match.teams?.home?.name || 'ᴜɴᴋɴᴏᴡɴ'}\n`;
        message += `│ 🚌 *ᴀᴡᴀʏ:* ${match.teams?.away?.name || 'ᴜɴᴋɴᴏᴡɴ'}\n`;
        message += `│ 📊 *sᴄᴏʀᴇ:* ${match.teams?.home?.score ?? 0} - ${match.teams?.away?.score ?? 0}\n`;
        message += `└────────────────\n│ 🏆 *ᴄᴏᴍᴘᴇᴛɪᴛɪᴏɴ:* ${match.league?.name || 'ɴ/ᴀ'}\n`;
        message += `│ 📅 *sᴇᴀsᴏɴ:* ${match.season || 'ɴ/ᴀ'}\n│ 🔄 *ʀᴏᴜɴᴅ:* ${match.round || 'ɴ/ᴀ'}\n`;
        if (match.venue?.name) message += `│ 🏟️ *ᴠᴇɴᴜᴇ:* ${match.venue.name}\n`;
        message += `│ ℹ️ *sᴛᴀᴛᴜs:* ${match.status || 'sᴄʜᴇᴅᴜʟᴇᴅ'}\n─────────────────\n`;
        reply(message);
    } catch (error) {
        console.error(error);
        reply("❌ ᴇʀʀᴏʀ ꜰᴇᴛᴄʜɪɴɢ ᴍᴀᴛᴄʜ ᴅᴇᴛᴀɪʟs.");
    }
}

// ─────────────────────────────────────────────
// TODAY'S MATCHES
// ─────────────────────────────────────────────
async function getTodaysMatches(conn, mek, m, { reply }) {
    try {
        const today = new Date().toISOString().split('T')[0];
        const response = await fetch(`${API}/sport/gameevents?q=${today}`);
        const data = await response.json();
        if (!data.status || !data.result || data.result.length === 0) return reply("❌ ɴᴏ ᴍᴀᴛᴄʜᴇs ꜰᴏʀ ᴛᴏᴅᴀʏ.");

        const todaysMatches = data.result.filter(match => match.dateTime?.date === today || new Date(match.dateTime?.timestamp || match.dateTime?.date).toISOString().split('T')[0] === today);
        if (todaysMatches.length === 0) return reply("❌ ɴᴏ ᴍᴀᴛᴄʜᴇs sᴄʜᴇᴅᴜʟᴇᴅ ꜰᴏʀ ᴛᴏᴅᴀʏ.");

        let message = `*📅 ᴛᴏᴅᴀʏ's ᴍᴀᴛᴄʜᴇs (${today}) ⚽*\n\n`;
        const byComp = {};
        todaysMatches.forEach(match => {
            const comp = match.league?.name || 'ᴏᴛʜᴇʀ';
            if (!byComp[comp]) byComp[comp] = [];
            byComp[comp].push(match);
        });
        Object.entries(byComp).forEach(([competition, matches]) => {
            message += `*🏆 ${competition}*\n`;
            matches.forEach(match => {
                message += `   • ${match.match}`;
                if (match.status !== 'Scheduled') message += ` (${match.teams?.home?.score || 0}-${match.teams?.away?.score || 0})`;
                message += `\n`;
                if (match.dateTime?.time) message += `     ⏰ ${match.dateTime.time.substring(0, 5)}\n`;
            });
            message += `\n`;
        });
        reply(message);
    } catch (error) {
        console.error(error);
        reply("❌ ᴇʀʀᴏʀ ꜰᴇᴛᴄʜɪɴɢ ᴛᴏᴅᴀʏ's ᴍᴀᴛᴄʜᴇs.");
    }
}

// ─────────────────────────────────────────────
// LIVE SCORES
// ─────────────────────────────────────────────
async function getLiveScores(conn, mek, m, { reply }) {
    try {
        const response = await fetch(`${API}/livescore2`);
        const data = await response.json();
        if (!data.status || !data.result?.data?.list) return reply("❌ ɴᴏ ʟɪᴠᴇ sᴄᴏʀᴇs ᴀᴠᴀɪʟᴀʙʟᴇ.");
        const matches = data.result.data.list;
        if (matches.length === 0) return reply("📊 ɴᴏ ʟɪᴠᴇ ᴍᴀᴛᴄʜᴇs ᴀᴛ ᴛʜᴇ ᴍᴏᴍᴇɴᴛ.");

        let message = `*🔴 ʟɪᴠᴇ sᴄᴏʀᴇs ⚽*\n\n📊 ᴄᴜʀʀᴇɴᴛʟʏ ʟɪᴠᴇ: ${matches.length}\n\n`;
        matches.forEach((match, i) => {
            message += `*${i + 1}. ${match.team1?.name} ᴠs ${match.team2?.name}*\n`;
            message += `   📊 ${match.team1?.score || 0} - ${match.team2?.score || 0}\n`;
            message += `   🏆 ${match.league || 'ɴ/ᴀ'}\n`;
            message += `   ${match.statusLive === 3 ? '✅' : '🔴'} ${match.timeDesc || match.status || 'ʟɪᴠᴇ'}\n\n`;
        });
        reply(message);
    } catch (error) {
        console.error(error);
        reply("❌ ᴇʀʀᴏʀ ꜰᴇᴛᴄʜɪɴɢ ʟɪᴠᴇ sᴄᴏʀᴇs.");
    }
}

// ─────────────────────────────────────────────
// FOOTBALL NEWS
// ─────────────────────────────────────────────
async function getFootballNews(conn, mek, m, { reply }) {
    try {
        const response = await fetch(`${API}/football/news`);
        const data = await response.json();
        if (!data.status || !data.result) return reply("❌ ɴᴏ ꜰᴏᴏᴛʙᴀʟʟ ɴᴇᴡs ᴀᴠᴀɪʟᴀʙʟᴇ.");
        const news = data.result.news || data.result;
        if (!news || news.length === 0) return reply("📰 ɴᴏ ɴᴇᴡs ᴀʀᴛɪᴄʟᴇs ꜰᴏᴜɴᴅ.");

        let message = `*📰 ʟᴀᴛᴇsᴛ ꜰᴏᴏᴛʙᴀʟʟ ɴᴇᴡs ⚽*\n\n`;
        news.slice(0, 5).forEach((item, i) => {
            message += `*${i + 1}. ${item.title}*\n`;
            if (item.description) message += `📝 ${item.description.substring(0, 100)}...\n`;
            if (item.source) message += `📰 ${item.source}\n`;
            if (item.url) message += `🔗 ${item.url}\n`;
            message += `\n`;
        });
        reply(message);
    } catch (error) {
        console.error(error);
        reply("❌ ᴇʀʀᴏʀ ꜰᴇᴛᴄʜɪɴɢ ꜰᴏᴏᴛʙᴀʟʟ ɴᴇᴡs.");
    }
}

// ─────────────────────────────────────────────
// WRESTLING EVENTS
// ─────────────────────────────────────────────
async function getWrestlingEvents(conn, mek, m, { reply }) {
    try {
        const { data } = await axios.get(global.wwe2);
        if (!data.event || data.event.length === 0) return reply("❌ ɴᴏ ᴜᴘᴄᴏᴍɪɴɢ ᴡʀᴇsᴛʟɪɴɢ ᴇᴠᴇɴᴛs.");

        const eventsList = data.event.map(event =>
            `*🏟️ ${event.strEvent}*\n📅 ${event.dateEvent || 'ɴ/ᴀ'}\n🏆 ${event.strLeague}\n📍 ${event.strVenue || event.strCity || 'ɴ/ᴀ'}\n────────────────────`
        ).join('\n\n');
        reply(`*🗓️ ᴜᴘᴄᴏᴍɪɴɢ ᴡʀᴇsᴛʟɪɴɢ ᴇᴠᴇɴᴛs*\n\n${eventsList}\n\n_ᴅᴀᴛᴀ ʙʏ ᴛʜᴇsᴘᴏʀᴛsᴅʙ_`);
    } catch (error) {
        console.error(error);
        reply("❌ ꜰᴀɪʟᴇᴅ ᴛᴏ ꜰᴇᴛᴄʜ ᴡʀᴇsᴛʟɪɴɢ ᴇᴠᴇɴᴛs.");
    }
}

// ─────────────────────────────────────────────
// WWE NEWS
// ─────────────────────────────────────────────
async function getWWENews(conn, mek, m, { reply }) {
    try {
        const { data } = await axios.get(global.wwe);
        if (!data.data || data.data.length === 0) return reply("❌ ɴᴏ ᴡᴡᴇ ɴᴇᴡs ꜰᴏᴜɴᴅ.");

        const newsList = data.data.map(item =>
            `*${item.title}*\n📅 ${item.created} (${item.time_ago})\n📺 ${item.parent_title}\n🔗 https://www.wwe.com${item.url}\n────────────────────`
        ).join('\n\n');
        reply(`*📰 ʟᴀᴛᴇsᴛ ᴡᴡᴇ ɴᴇᴡs*\n\n${newsList}\n\n_ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴡᴡᴇ ᴏꜰꜰɪᴄɪᴀʟ ᴀᴘɪ_`);
    } catch (error) {
        console.error(error);
        reply("❌ ꜰᴀɪʟᴇᴅ ᴛᴏ ꜰᴇᴛᴄʜ ᴡᴡᴇ ɴᴇᴡs.");
    }
}

// ─────────────────────────────────────────────
// WWE SCHEDULE
// ─────────────────────────────────────────────
async function getWWESchedule(conn, mek, m, { reply }) {
    try {
        const { data } = await axios.get(global.wwe1);
        if (!data.event || data.event.length === 0) return reply("❌ ɴᴏ ᴜᴘᴄᴏᴍɪɴɢ ᴡᴡᴇ ᴇᴠᴇɴᴛs.");

        const eventsList = data.event.map(event => {
            const type = event.strEvent.includes('RAW') ? '🎤 ʀᴀᴡ' :
                         event.strEvent.includes('NXT') ? '🌟 ɴxᴛ' :
                         event.strEvent.includes('SmackDown') ? '🔵 sᴍᴀᴄᴋᴅᴏᴡɴ' : '🏆 ᴘᴘᴠ';
            return `${type} *${event.strEvent}*\n📅 ${event.dateEvent || 'ɴ/ᴀ'}\n📍 ${event.strVenue || event.strCity || 'ɴ/ᴀ'}\n────────────────────`;
        }).join('\n\n');
        reply(`*📅 ᴜᴘᴄᴏᴍɪɴɢ ᴡᴡᴇ ᴇᴠᴇɴᴛs*\n\n${eventsList}\n\n_ᴅᴀᴛᴀ ʙʏ ᴛʜᴇsᴘᴏʀᴛsᴅʙ_`);
    } catch (error) {
        console.error(error);
        reply("❌ ꜰᴀɪʟᴇᴅ ᴛᴏ ꜰᴇᴛᴄʜ ᴡᴡᴇ ᴇᴠᴇɴᴛs.");
    }
}

// ═════════════════════════════════════════════
// COMMANDS (Each wraps a helper)
// ═════════════════════════════════════════════

// Standings for each league
const standingsLeagues = {
    'epl': ['PL', 'ᴇᴘʟ'], 'ucl': ['CL', 'ᴜᴄʟ'], 'laliga': ['PD', 'ʟᴀʟɪɢᴀ'],
    'bundesliga': ['BL1', 'ʙᴜɴᴅᴇsʟɪɢᴀ'], 'seriea': ['SA', 'sᴇʀɪᴇᴀ'],
    'ligue1': ['FL1', 'ʟɪɢᴜᴇ1'], 'wc': ['WC', 'ᴡᴏʀʟᴅ ᴄᴜᴘ']
};
Object.entries(standingsLeagues).forEach(([path, [code, name]]) => {
    cmd({
        pattern: `${path}standings`,
        alias: [`${path}t`, `${code.toLowerCase()}table`],
        react: "⚽",
        desc: `Get ${name} standings`,
        category: "sports",
        use: `.${path}standings`,
        filename: __filename
    }, async (conn, mek, m, ctx) => {
        await formatStandings(code, name, conn, mek, m, ctx);
    });
});

// Matches per league
Object.entries(standingsLeagues).forEach(([path, [code, name]]) => {
    cmd({
        pattern: `${path}matches`,
        alias: [`${path}res`, `${code.toLowerCase()}matches`],
        react: "⚽",
        desc: `Get ${name} matches`,
        category: "sports",
        use: `.${path}matches`,
        filename: __filename
    }, async (conn, mek, m, ctx) => {
        await formatMatches(code, name, conn, mek, m, ctx);
    });
});

// Top scorers per league
Object.entries(standingsLeagues).forEach(([path, [code, name]]) => {
    cmd({
        pattern: `${path}scorers`,
        alias: [`${path}scorer`, `${code.toLowerCase()}top`],
        react: "🏆",
        desc: `Get ${name} top scorers`,
        category: "sports",
        use: `.${path}scorers`,
        filename: __filename
    }, async (conn, mek, m, ctx) => {
        await formatTopScorers(code, name, conn, mek, m, ctx);
    });
});

// Upcoming per league
Object.entries(standingsLeagues).forEach(([path, [code, name]]) => {
    cmd({
        pattern: `${path}upcoming`,
        alias: [`${path}next`, `${code.toLowerCase()}upcoming`],
        react: "📅",
        desc: `Get upcoming ${name} matches`,
        category: "sports",
        use: `.${path}upcoming`,
        filename: __filename
    }, async (conn, mek, m, ctx) => {
        await formatUpcomingMatches(code, name, conn, mek, m, ctx);
    });
});

// Team search
cmd({
    pattern: "teamsearch", alias: ["findteam", "team"],
    react: "⚽", desc: "Search for a football team",
    category: "sports", use: ".teamsearch <name>", filename: __filename
}, async (conn, mek, m, ctx) => {
    await searchTeam(ctx.q, conn, mek, m, ctx);
});

// Player search
cmd({
    pattern: "playersearch", alias: ["findplayer", "player"],
    react: "⚽", desc: "Search for a football player",
    category: "sports", use: ".playersearch <name>", filename: __filename
}, async (conn, mek, m, ctx) => {
    await searchPlayer(ctx.q, conn, mek, m, ctx);
});

// Venue search
cmd({
    pattern: "venuesearch", alias: ["findvenue", "venue"],
    react: "🏟️", desc: "Search for a sports venue",
    category: "sports", use: ".venuesearch <name>", filename: __filename
}, async (conn, mek, m, ctx) => {
    await searchVenue(ctx.q, conn, mek, m, ctx);
});

// H2H
cmd({
    pattern: "h2h", alias: ["headtohead"],
    react: "⚽", desc: "Head-to-head between two teams",
    category: "sports", use: ".h2h <team1> vs <team2>", filename: __filename
}, async (conn, mek, m, ctx) => {
    if (!ctx.q || !ctx.q.includes('vs')) return ctx.reply("❌ ᴜsᴀɢᴇ: .ʜ2ʜ <ᴛᴇᴀᴍ1> ᴠs <ᴛᴇᴀᴍ2>");
    const [t1, t2] = ctx.q.split('vs').map(t => t.trim());
    await getHeadToHead(t1, t2, conn, mek, m, ctx);
});

// Game events search
cmd({
    pattern: "gameevents", alias: ["matchevents", "events"],
    react: "🔍", desc: "Search for game events",
    category: "sports", use: ".gameevents <query>", filename: __filename
}, async (conn, mek, m, ctx) => {
    await searchGameEvents(ctx.q, conn, mek, m, ctx);
});

// Match details
cmd({
    pattern: "matchdetails", alias: ["matchinfo"],
    react: "⚽", desc: "Get detailed match info by ID",
    category: "sports", use: ".matchdetails <match_id>", filename: __filename
}, async (conn, mek, m, ctx) => {
    await getMatchDetails(ctx.q, conn, mek, m, ctx);
});

// Today's matches
cmd({
    pattern: "todaymatches", alias: ["matches", "today"],
    react: "📅", desc: "Get today's football matches",
    category: "sports", use: ".todaymatches", filename: __filename
}, async (conn, mek, m, ctx) => {
    await getTodaysMatches(conn, mek, m, ctx);
});

// Live scores
cmd({
    pattern: "livescores", alias: ["livescore", "score"],
    react: "🔴", desc: "Get live football scores",
    category: "sports", use: ".livescores", filename: __filename
}, async (conn, mek, m, ctx) => {
    await getLiveScores(conn, mek, m, ctx);
});

// Football news
cmd({
    pattern: "footballnews", alias: ["fnews", "fbnews"],
    react: "📰", desc: "Get latest football news",
    category: "sports", use: ".footballnews", filename: __filename
}, async (conn, mek, m, ctx) => {
    await getFootballNews(conn, mek, m, ctx);
});

// Wrestling events
cmd({
    pattern: "wrestlingevents", alias: ["wwe-events", "wevents"],
    react: "🤼", desc: "Get upcoming wrestling events",
    category: "sports", use: ".wrestlingevents", filename: __filename
}, async (conn, mek, m, ctx) => {
    await getWrestlingEvents(conn, mek, m, ctx);
});

// WWE news
cmd({
    pattern: "wwenews", alias: ["wwe-news"],
    react: "📰", desc: "Get latest WWE news",
    category: "sports", use: ".wwenews", filename: __filename
}, async (conn, mek, m, ctx) => {
    await getWWENews(conn, mek, m, ctx);
});

// WWE schedule
cmd({
    pattern: "wweschedule", alias: ["wwe-schedule", "wschedule"],
    react: "📅", desc: "Get upcoming WWE events",
    category: "sports", use: ".wweschedule", filename: __filename
}, async (conn, mek, m, ctx) => {
    await getWWESchedule(conn, mek, m, ctx);
});