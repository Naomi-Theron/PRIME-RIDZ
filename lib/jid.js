'use strict'
/**
 * lib/jid.js - JID / LID helpers.
 *
 * Same idea as Base-baileys (conn.getJid / conn.getLid / remoteJidAlt / participantAlt),
 * written for this bot (CommonJS).
 *
 * WhatsApp now gives one person two ids: the phone-number JID (xxx@s.whatsapp.net, "PN")
 * and the privacy id (yyy@lid, "LID"). Messages and group lists can carry either one, which
 * is why owner checks, admin checks, mentions and "@number" text broke.
 * This file keeps a LID <-> PN map and gives the bot one rule:
 * work with the phone-number JID whenever it is known, keep the LID only when it is not.
 */

const MAX_PAIRS = 20000
const MISS_TTL = 10 * 60 * 1000 // do not re-ask WhatsApp about an unknown LID for 10 minutes
const NATIVE_TTL = 60 * 1000

// Shared by every socket, so the map survives reconnects.
const toPn = new Map() // 'yyy@lid' -> 'xxx@s.whatsapp.net'
const toLid = new Map() // 'xxx@s.whatsapp.net' -> 'yyy@lid'
const misses = new Map() // lid -> time of the last failed lookup
const nativeIds = new Map() // group jid -> { at, byKey: Map(any form of an id -> the id the group uses) }

const isLidUser = (jid) => typeof jid === 'string' && jid.endsWith('@lid')
const isPnUser = (jid) => typeof jid === 'string' && jid.endsWith('@s.whatsapp.net')

const jidUser = (jid) => {
  if (typeof jid !== 'string') return ''
  const at = jid.indexOf('@')
  return at < 0 ? '' : jid.slice(0, at).split(':')[0].split('_')[0]
}

/** 'user:device@server' -> 'user@server'. Anything that is not a string is returned untouched. */
function decodeJid(jid) {
  if (!jid || typeof jid !== 'string') return jid
  jid = jid.trim()
  if (/:\d+@/.test(jid)) {
    const user = jidUser(jid)
    const server = jid.slice(jid.indexOf('@') + 1)
    if (user && server) return `${user}@${server}`
  }
  return jid
}

/** Remember that this LID and this phone JID are the same person. */
function remember(lid, pn) {
  lid = decodeJid(lid)
  pn = decodeJid(pn)
  if (!isLidUser(lid) || !isPnUser(pn)) return false
  misses.delete(lid)
  if (toPn.get(lid) === pn) return true
  toPn.set(lid, pn)
  toLid.set(pn, lid)
  if (toPn.size > MAX_PAIRS) {
    const oldest = toPn.keys().next().value
    toLid.delete(toPn.get(oldest))
    toPn.delete(oldest)
  }
  return true
}

function attachJid(conn) {
  if (!conn || conn.__jidAttached) return conn
  conn.__jidAttached = true

  const botPn = () => (conn.user && conn.user.id ? decodeJid(conn.user.id) : undefined)
  const botLid = () => {
    const raw = (conn.user && conn.user.lid) || (conn.authState && conn.authState.creds && conn.authState.creds.me && conn.authState.creds.me.lid)
    return raw ? decodeJid(raw) : undefined
  }

  /** Any id -> phone JID when we know it (own LID included). Unknown LIDs come back unchanged. */
  function getJid(jid) {
    jid = decodeJid(jid)
    if (!isLidUser(jid)) return jid
    const mine = botLid()
    if (mine && jidUser(mine) === jidUser(jid)) return botPn() || jid
    return toPn.get(jid) || jid
  }

  /** Any id -> LID when we know it. Unknown ids come back unchanged. */
  function getLid(jid) {
    jid = decodeJid(jid)
    if (isLidUser(jid)) return jid
    if (isPnUser(jid)) {
      if (jid === botPn() && botLid()) return botLid()
      return toLid.get(jid) || jid
    }
    return jid
  }

  /**
   * Pick the best id out of several forms of the same person, e.g. (key.participantAlt, key.participant).
   * Phone JID first; LIDs are mapped through the cache. Learns the pair when it sees both.
   */
  function pickJid(...candidates) {
    const list = candidates.map(decodeJid).filter((j) => typeof j === 'string' && j)
    if (!list.length) return undefined
    const lid = list.find(isLidUser)
    const pn = list.find(isPnUser)
    if (lid && pn) remember(lid, pn)
    if (pn) return pn
    const other = list.find((j) => !isLidUser(j)) // group, broadcast, newsletter, bot...
    if (other) return other
    return getJid(list[0])
  }

  async function lookupPn(lid) {
    const hit = toPn.get(lid)
    if (hit) return hit
    const missedAt = misses.get(lid)
    if (missedAt && Date.now() - missedAt < MISS_TTL) return undefined
    let pn
    try {
      pn = decodeJid(await (conn.signalRepository && conn.signalRepository.lidMapping && conn.signalRepository.lidMapping.getPNForLID
        ? conn.signalRepository.lidMapping.getPNForLID(lid)
        : undefined))
    } catch (e) {}
    if (!isPnUser(pn)) {
      try {
        const ids = typeof conn.findUserId === 'function' ? await conn.findUserId(lid) : undefined
        pn = decodeJid(ids && ids.phoneNumber)
      } catch (e) {}
    }
    if (isPnUser(pn)) {
      remember(lid, pn)
      return pn
    }
    if (misses.size > 5000) misses.clear()
    misses.set(lid, Date.now())
    return undefined
  }

  async function lookupLid(pn) {
    const hit = toLid.get(pn)
    if (hit) return hit
    let lid
    try {
      lid = decodeJid(await (conn.signalRepository && conn.signalRepository.lidMapping && conn.signalRepository.lidMapping.getLIDForPN
        ? conn.signalRepository.lidMapping.getLIDForPN(pn)
        : undefined))
    } catch (e) {}
    if (!isLidUser(lid)) {
      try {
        const ids = typeof conn.findUserId === 'function' ? await conn.findUserId(pn) : undefined
        lid = decodeJid(ids && ids.lid)
      } catch (e) {}
    }
    if (isLidUser(lid)) {
      remember(lid, pn)
      return lid
    }
    return undefined
  }

  /** Like getJid, but asks WhatsApp when the cache does not know the LID yet. */
  async function resolveJid(jid) {
    const quick = getJid(jid)
    if (!isLidUser(quick)) return quick
    return (await lookupPn(quick)) || quick
  }

  /** true when `list` (admins, owners...) holds this person in any form (PN or LID). */
  function inJidList(list, jid) {
    if (!jid || !list || typeof list.some !== 'function') return false
    const target = getJid(jid)
    return list.some((x) => getJid(x) === target)
  }

  // ---------- group metadata ----------
  function normalizeParticipant(p) {
    if (!p || typeof p !== 'object') return p
    const rawId = decodeJid(p.id)
    const lidField = decodeJid(p.lid)
    const pnField = decodeJid(p.phoneNumber)
    const lid = isLidUser(lidField) ? lidField : isLidUser(rawId) ? rawId : undefined
    const pn = isPnUser(pnField) ? pnField : isPnUser(rawId) ? rawId : undefined
    if (lid && pn) remember(lid, pn)
    const id = pn || (lid ? getJid(lid) : rawId)
    const next = { ...p, id }
    if (lid) next.lid = lid
    if (isPnUser(id)) next.phoneNumber = id
    return next
  }

  function normalizeMetadata(md) {
    if (!md || typeof md !== 'object') return md
    const out = { ...md }
    if (Array.isArray(md.participants)) out.participants = md.participants.map(normalizeParticipant)
    for (const key of ['owner', 'subjectOwner', 'descOwner']) {
      if (!md[key] && !md[key + 'Pn']) continue
      const raw = decodeJid(md[key])
      const pnField = decodeJid(md[key + 'Pn'])
      if (isLidUser(raw) && isPnUser(pnField)) remember(raw, pnField)
      out[key] = isPnUser(pnField) ? pnField : getJid(raw)
    }
    return out
  }

  function indexNative(groupJid, participants) {
    const byKey = new Map()
    for (const p of participants || []) {
      if (!p || !p.id) continue
      for (const k of [decodeJid(p.id), decodeJid(p.lid), decodeJid(p.phoneNumber)]) {
        if (k) byKey.set(k, p.id)
      }
    }
    nativeIds.delete(groupJid)
    nativeIds.set(groupJid, { at: Date.now(), byKey })
    // keep it small: drop stale entries and never hold more than 500 groups
    if (nativeIds.size > 100) {
      const now = Date.now()
      for (const [key, entry] of nativeIds) if (now - entry.at > NATIVE_TTL) nativeIds.delete(key)
      while (nativeIds.size > 500) nativeIds.delete(nativeIds.keys().next().value)
    }
  }

  // ---------- public API on the socket ----------
  conn.decodeJid = decodeJid
  conn.getJid = getJid
  conn.getLid = getLid
  conn.pickJid = pickJid
  conn.resolveJid = resolveJid
  conn.inJidList = inJidList
  conn.rememberJid = remember
  conn.isLidUser = isLidUser
  conn.isPnUser = isPnUser

  /** '@2567...' in a text -> mention JIDs (phone JIDs; a known LID is mapped back to the phone JID). */
  conn.parseMention = async (text = '') => {
    const out = new Set()
    for (const match of String(text).matchAll(/@([0-9]{5,16}|0)/g)) {
      const digits = match[1]
      out.add(toPn.get(`${digits}@lid`) || `${digits}@s.whatsapp.net`)
    }
    return [...out]
  }

  // Group metadata: participants come back with a phone JID as `id` (plus `lid` and `phoneNumber`),
  // so groupAdmins / participants / mentions keep working in groups that use LIDs.
  if (typeof conn.groupMetadata === 'function') {
    const rawGroupMetadata = conn.groupMetadata.bind(conn)
    conn.groupMetadata = async (jid) => {
      const md = await rawGroupMetadata(jid)
      if (md && Array.isArray(md.participants)) indexNative(jid, md.participants)
      return normalizeMetadata(md)
    }
  }

  // kick / promote / demote must use the id the group itself uses (a LID in LID groups).
  if (typeof conn.groupParticipantsUpdate === 'function') {
    const rawUpdate = conn.groupParticipantsUpdate.bind(conn)
    conn.groupParticipantsUpdate = async (jid, participants, action) => {
      let list = participants
      if (action !== 'add' && Array.isArray(participants) && typeof jid === 'string' && jid.endsWith('@g.us')) {
        try {
          let entry = nativeIds.get(jid)
          if (!entry || Date.now() - entry.at > NATIVE_TTL) {
            await conn.groupMetadata(jid)
            entry = nativeIds.get(jid)
          }
          if (entry) {
            list = participants.map((target) => {
              const d = decodeJid(target)
              return entry.byKey.get(d) || entry.byKey.get(getLid(d)) || entry.byKey.get(getJid(d)) || target
            })
          }
        } catch (e) {
          list = participants
        }
      }
      return rawUpdate(jid, list, action)
    }
  }

  // Block / unblock needs both ids (same fix Base-baileys made). Falls back to the library's own method.
  if (typeof conn.updateBlockStatus === 'function' || typeof conn.query === 'function') {
    const rawBlock = typeof conn.updateBlockStatus === 'function' ? conn.updateBlockStatus.bind(conn) : null
    conn.updateBlockStatus = async (jid, action) => {
      const id = decodeJid(jid)
      let lid = isLidUser(id) ? id : getLid(id)
      let pn = isPnUser(id) ? id : getJid(id)
      if (!isLidUser(lid) && isPnUser(pn)) lid = (await lookupLid(pn)) || lid
      if (!isPnUser(pn) && isLidUser(lid)) pn = (await lookupPn(lid)) || pn
      if (isLidUser(lid) && isPnUser(pn) && typeof conn.query === 'function') {
        return conn.query({
          tag: 'iq',
          attrs: { xmlns: 'blocklist', to: 's.whatsapp.net', type: 'set' },
          content: [{ tag: 'item', attrs: { action, jid: lid, pn_jid: pn } }]
        })
      }
      if (rawBlock) return rawBlock(jid, action)
      throw new Error(`Could not find the LID for ${jid}`)
    }
  }

  // ---------- keep the map fresh ----------
  if (conn.ev && typeof conn.ev.on === 'function') {
    const safe = (fn) => (data) => {
      try {
        fn(data)
      } catch (e) {}
    }
    conn.ev.on('lid-mapping.update', safe((data) => {
      for (const x of [].concat(data || [])) remember(x && x.lid, (x && (x.pn || x.phoneNumber)))
    }))
    const learnContacts = safe((contacts) => {
      for (const c of [].concat(contacts || [])) {
        if (!c) continue
        const id = decodeJid(c.id)
        remember(c.lid || (isLidUser(id) ? id : undefined), c.phoneNumber || (isPnUser(id) ? id : undefined))
      }
    })
    conn.ev.on('contacts.upsert', learnContacts)
    conn.ev.on('contacts.update', learnContacts)
    conn.ev.on('groups.upsert', safe((groups) => {
      for (const g of [].concat(groups || [])) normalizeMetadata(g)
    }))
    conn.ev.on('group-participants.update', safe((update) => {
      for (const p of (update && update.participants) || []) {
        if (p && typeof p === 'object') normalizeParticipant(p)
      }
    }))
  }

  return conn
}

module.exports = { attachJid, decodeJid, isLidUser, isPnUser, jidUser }
