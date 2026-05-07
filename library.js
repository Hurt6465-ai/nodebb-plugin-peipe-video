'use strict';

const nconf = require.main.require('nconf');
const winston = require.main.require('winston');
const routeHelpers = require.main.require('./src/routes/helpers');

const plugin = {};

const CONFIG = {
  cid: 6,
  pageSize: 12,
  maxPageSize: 30,
  imageMax: 4,
  publicItemTtl: 72 * 60 * 60 * 1000,
  firstPageTtl: 2 * 60 * 1000,
  oldPageTtl: 72 * 60 * 60 * 1000,
  countsTtl: 45 * 1000,
  viewerTtl: 2 * 60 * 1000,
};

const RE = {
  tiktokGlobal: /https?:\/\/(?:www\.)?tiktok\.com\/@[^\/\s<>'"]+\/video\/(\d+)(?:\?[^\s<>'"]*)?/ig,
  tiktokOne: /https?:\/\/(?:www\.)?tiktok\.com\/@([^\/\s<>'"]+)\/video\/(\d+)/i,
  tiktokToken: /(?:https?[-:\/]+)?(?:www[.-])?tiktok[.-]com[-\/\w@.%=&?]+/ig,
  imageExt: /\.(png|jpe?g|gif|webp|avif)(?:[?#].*)?$/i,
  audioExt: /\.(m4a|mp3|wav|ogg|oga|webm|aac)(?:[?#].*)?$/i,
};

const cache = new Map();
let db;
let Topics;
let Posts;
let User;
let routeReady = false;

function now() { return Date.now(); }
function norm(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }
function getCached(key) {
  const record = cache.get(key);
  if (!record || record.expiresAt <= now()) {
    cache.delete(key);
    return null;
  }
  return record.value;
}
function setCached(key, value, ttl) {
  cache.set(key, { value, expiresAt: now() + ttl });
  return value;
}
function deleteCachePrefix(prefix) {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}
function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
function canonicalTikTokUrl(url) {
  const text = String(url || '').replace(/&amp;/g, '&').trim();
  const match = text.match(RE.tiktokOne);
  return match ? `https://www.tiktok.com/@${match[1]}/video/${match[2]}` : text;
}
function collectTikToks(text) {
  const seen = new Set();
  const out = [];
  String(text || '').replace(RE.tiktokGlobal, (match, videoId) => {
    if (videoId && !seen.has(videoId)) {
      seen.add(videoId);
      out.push({ videoId, url: canonicalTikTokUrl(match) });
    }
    return match;
  });
  return out;
}
function cleanDisplayText(text) {
  const raw = String(text || '')
    .replace(RE.tiktokGlobal, '')
    .replace(RE.tiktokToken, '')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\[\s*(?:语音消息|语音动态|voice\s*message|audio\s*message)[^\]]*\]\([^)]+\)/ig, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
  return raw.split(/[\r\n]+/).map(norm).filter(Boolean).join('\n');
}
function parseMediaFromContent(content) {
  const raw = String(content || '');
  const out = { text: '', images: [], audios: [], tiktoks: collectTikToks(raw) };

  raw.replace(/<img[^>]+src=["']([^"']+)["'][^>]*>/ig, (m, src) => {
    if (src && !out.images.includes(src)) out.images.push(src);
    return m;
  });
  raw.replace(/<(?:audio|source)[^>]+src=["']([^"']+)["'][^>]*>/ig, (m, src) => {
    if (src && RE.audioExt.test(src) && !out.audios.some(item => item.url === src)) out.audios.push({ url: src, label: '语音消息' });
    return m;
  });
  raw.replace(/!\[[^\]]*\]\(([^)]+)\)/g, (m, src) => {
    if (src && !out.images.includes(src)) out.images.push(src);
    return m;
  });
  raw.replace(/\[([^\]]*)\]\(([^)]+)\)/g, (m, label, href) => {
    if (href && RE.imageExt.test(href) && !out.images.includes(href)) out.images.push(href);
    if (href && RE.audioExt.test(href) && !out.audios.some(item => item.url === href)) out.audios.push({ url: href, label: norm(label) || '语音消息' });
    return m;
  });

  out.text = cleanDisplayText(raw);
  out.images = out.images.slice(0, CONFIG.imageMax);
  return out;
}
function topicHref(topic) {
  const tid = topic && topic.tid;
  const slug = topic && topic.slug;
  if (!tid) return '#';
  return slug ? `/topic/${tid}/${slug}` : `/topic/${tid}`;
}
async function getModule(name) {
  try {
    return require.main.require(name);
  } catch (err) {
    return null;
  }
}
async function ensureModules() {
  if (routeReady) return;
  db = db || await getModule('./src/database');
  Topics = Topics || await getModule('./src/topics');
  Posts = Posts || await getModule('./src/posts');
  User = User || await getModule('./src/user');
  routeReady = true;
}
async function getTopicData(tid) {
  if (!Topics) return null;
  if (typeof Topics.getTopicData === 'function') return await Topics.getTopicData(tid);
  if (typeof Topics.getTopicsData === 'function') {
    const arr = await Topics.getTopicsData([tid]);
    return arr && arr[0];
  }
  return null;
}
async function getPostData(pid) {
  if (!Posts || !pid) return null;
  if (typeof Posts.getPostData === 'function') return await Posts.getPostData(pid);
  if (typeof Posts.getPostsData === 'function') {
    const arr = await Posts.getPostsData([pid]);
    return arr && arr[0];
  }
  return null;
}
async function getUserFields(uid) {
  if (!User || !uid) return {};
  const fields = ['uid', 'username', 'userslug', 'picture', 'uploadedpicture', 'displayname', 'status'];
  if (typeof User.getUserFields === 'function') return await User.getUserFields(uid, fields);
  if (typeof User.getUsersFields === 'function') {
    const arr = await User.getUsersFields([uid], fields);
    return arr && arr[0] || {};
  }
  return {};
}
function normalizeAuthor(user, fallback = {}) {
  user = user || {};
  const uid = String(user.uid || user.userId || user.userid || fallback.uid || '');
  const username = norm(user.displayname || user.displayName || user.username || fallback.username || fallback.displayname || fallback.userslug || '用户');
  const userslug = String(user.userslug || fallback.userslug || username || '').replace(/^@/, '');
  const picture = user.picture || user.uploadedpicture || user.avatar || fallback.picture || fallback.uploadedpicture || '';
  return { uid, username, userslug, picture };
}
function findMainPid(topic, firstPost) {
  const candidates = [topic && topic.mainPid, topic && topic.main_pid, topic && topic.pid, firstPost && firstPost.pid];
  const found = candidates.find(value => /^\d+$/.test(String(value || '')));
  return found ? String(found) : '';
}
async function buildPublicItem(tid) {
  const cached = getCached(`item:${tid}`);
  if (cached) return cached;

  const topic = await getTopicData(tid);
  if (!topic || Number(topic.deleted || 0)) return null;
  if (Number(topic.cid || CONFIG.cid) !== Number(CONFIG.cid)) return null;

  let pid = findMainPid(topic, null);
  let post = pid ? await getPostData(pid) : null;
  if (!post && Array.isArray(topic.posts) && topic.posts[0]) {
    post = topic.posts[0];
    pid = findMainPid(topic, post);
  }

  const content = String((post && (post.content || post.raw || post.markdown || post.text)) || topic.title || '');
  const media = parseMediaFromContent(content);
  const authorRaw = await getUserFields((post && post.uid) || topic.uid);
  const author = normalizeAuthor(authorRaw, post || topic);

  const item = {
    source: 'plugin-feed',
    hydrated: true,
    tid: String(topic.tid || tid),
    pid: String(pid || ''),
    cid: Number(topic.cid || CONFIG.cid),
    href: topicHref(topic),
    title: cleanDisplayText(topic.titleRaw || topic.title || ''),
    text: media.text || cleanDisplayText(topic.titleRaw || topic.title || ''),
    raw: content,
    images: media.images.slice(0, CONFIG.imageMax),
    audios: media.audios,
    tiktoks: media.tiktoks,
    createdAt: (post && (post.timestamp || post.timestampISO)) || topic.timestamp || topic.timestampISO || topic.lastposttime || 0,
    author,
    coverUrl: '',
    counts: { likes: 0, comments: 0 },
    viewer: { liked: false, following: false, canComment: true },
  };

  return setCached(`item:${tid}`, item, CONFIG.publicItemTtl);
}
async function getCounts(item) {
  const key = `counts:${item.tid}`;
  const cached = getCached(key);
  if (cached) return cached;
  const topic = await getTopicData(item.tid);
  const post = item.pid ? await getPostData(item.pid) : null;
  const likes = safeNumber(post && (post.votes !== undefined ? post.votes : post.upvotes), safeNumber(topic && topic.votes, 0));
  const postCount = safeNumber(topic && (topic.postcount || topic.posts || topic.postCount), 1);
  const counts = { likes: Math.max(0, likes), comments: Math.max(0, postCount - 1) };
  return setCached(key, counts, CONFIG.countsTtl);
}
async function getViewer(uid, item) {
  if (!uid) return { liked: false, following: false, canComment: false };
  const key = `viewer:${uid}:${item.tid}`;
  const cached = getCached(key);
  if (cached) return cached;

  let liked = false;
  try {
    if (Posts && typeof Posts.hasVoted === 'function' && item.pid) {
      liked = !!await Posts.hasVoted(item.pid, uid);
    } else if (db && item.pid) {
      liked = !!await db.isSetMember(`pid:${item.pid}:upvotes`, uid);
    }
  } catch (err) {}

  let following = false;
  try {
    if (User && typeof User.isFollowing === 'function' && item.author && item.author.uid) {
      following = !!await User.isFollowing(uid, item.author.uid);
    }
  } catch (err) {}

  const viewer = { liked, following, canComment: true };
  return setCached(key, viewer, CONFIG.viewerTtl);
}
async function getTids(cid, start, stop) {
  await ensureModules();
  if (!db || typeof db.getSortedSetRevRange !== 'function') return [];

  // Use the creation-time sorted set so comments/replies do not bump old videos to the top.
  // NodeBB also maintains cid:{cid}:tids for active/bumped sorting on many installs; that is only a fallback here.
  let tids = await db.getSortedSetRevRange(`cid:${cid}:tids:create`, start, stop);
  if (!tids || !tids.length) {
    tids = await db.getSortedSetRevRange(`cid:${cid}:tids`, start, stop);
  }
  return (tids || []).map(String).filter(Boolean);
}
async function getFeed(uid, page, pageSize) {
  const start = Math.max(0, (page - 1) * pageSize);
  const stop = start + pageSize * 2 - 1;
  const pageKey = `feed:${CONFIG.cid}:${page}:${pageSize}`;
  let tids = getCached(pageKey);
  if (!tids) {
    tids = await getTids(CONFIG.cid, start, stop);
    setCached(pageKey, tids, page <= 1 ? CONFIG.firstPageTtl : CONFIG.oldPageTtl);
  }

  const items = [];
  for (const tid of tids) {
    if (items.length >= pageSize) break;
    const item = await buildPublicItem(tid);
    if (!item) continue;
    if (!item.tiktoks.length && !item.images.length) continue;
    const counts = await getCounts(item);
    const viewer = await getViewer(uid, item);
    items.push(Object.assign({}, item, {
      counts,
      viewer,
      images: item.images.slice(0, CONFIG.imageMax),
    }));
  }
  return { items, page, pageSize, hasMore: tids.length > items.length || tids.length >= pageSize };
}
function getReqUid(req) {
  return Number(req.uid || (req.user && req.user.uid) || 0);
}
function invalidateFeedCaches() {
  deleteCachePrefix('feed:');
  deleteCachePrefix('item:');
  deleteCachePrefix('counts:');
}

plugin.init = async function init(params) {
  const { router } = params;
  routeHelpers.setupPageRoute(router, '/video', [], (req, res) => {
    res.render('video', {
      title: '发现',
      cid: CONFIG.cid,
      imageMax: CONFIG.imageMax,
    });
  });
};

plugin.addRoutes = async function addRoutes({ router, middleware, helpers }) {
  await ensureModules();

  routeHelpers.setupApiRoute(router, 'get', '/peipe-video/feed', [], async (req, res) => {
    try {
      const page = Math.max(1, safeNumber(req.query.page, 1));
      const pageSize = Math.min(CONFIG.maxPageSize, Math.max(1, safeNumber(req.query.pageSize, CONFIG.pageSize)));
      const response = await getFeed(getReqUid(req), page, pageSize);
      helpers.formatApiResponse(200, res, response);
    } catch (err) {
      winston.error(`[nodebb-plugin-peipe-video] feed failed: ${err.stack || err.message}`);
      helpers.formatApiResponse(500, res, { error: err.message || 'feed-failed' });
    }
  });

  routeHelpers.setupApiRoute(router, 'post', '/peipe-video/cache/purge', [middleware.admin.checkPrivileges], async (req, res) => {
    invalidateFeedCaches();
    helpers.formatApiResponse(200, res, { ok: true });
  });
};

module.exports = plugin;
