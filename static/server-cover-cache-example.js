'use strict';

/*
  Optional NodeBB backend patch for TikTok cover caching.

  Why this is needed:
  - The frontend can cache covers in each user's localStorage only.
  - To let all users reuse the same cover, the backend feed must store and return coverUrl.

  How to use:
  1. Add installCoverCacheRoute(params) inside your plugin's static:app.load hook.
  2. When building /api/v3/plugins/peipe-video/feed items, call attachCoverUrls(items).
  3. Restart/build NodeBB.

  This is intentionally small and safe: it only stores videoId -> coverUrl in NodeBB db.
*/

const db = require.main.require('./src/database');
const winston = require.main.require('winston');

const COVER_CACHE_KEY = 'peipe-video:tiktok-cover-cache';
const COVER_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

function cleanUrl(url) {
  url = String(url || '').trim();
  if (!/^https?:\/\//i.test(url)) return '';
  return url.slice(0, 2000);
}

function cleanVideoId(videoId) {
  videoId = String(videoId || '').trim();
  return /^\d{5,32}$/.test(videoId) ? videoId : '';
}

async function saveCover(videoId, coverUrl, sourceUrl) {
  videoId = cleanVideoId(videoId);
  coverUrl = cleanUrl(coverUrl);
  sourceUrl = cleanUrl(sourceUrl);
  if (!videoId || !coverUrl) return false;

  const payload = {
    videoId,
    coverUrl,
    sourceUrl,
    updatedAt: Date.now(),
    expiresAt: Date.now() + COVER_CACHE_TTL,
  };

  await db.setObjectField(COVER_CACHE_KEY, videoId, JSON.stringify(payload));
  return true;
}

async function getCover(videoId) {
  videoId = cleanVideoId(videoId);
  if (!videoId) return null;

  const raw = await db.getObjectField(COVER_CACHE_KEY, videoId);
  if (!raw) return null;

  try {
    const cached = JSON.parse(raw);
    if (!cached || !cached.coverUrl) return null;
    if (cached.expiresAt && cached.expiresAt < Date.now()) return null;
    return cached;
  } catch (err) {
    return null;
  }
}

async function attachCoverUrls(items) {
  if (!Array.isArray(items) || !items.length) return items;

  await Promise.all(items.map(async (item) => {
    const tk = item && item.tiktoks && item.tiktoks[0];
    if (!tk || !tk.videoId) return;
    if (item.coverUrl || tk.coverUrl || tk.thumbnailUrl) return;

    const cached = await getCover(tk.videoId);
    if (cached && cached.coverUrl) {
      item.coverUrl = cached.coverUrl;
      tk.coverUrl = cached.coverUrl;
    }
  }));

  return items;
}

function installCoverCacheRoute(params) {
  const router = params.router;
  const middleware = params.middleware;
  if (!router) return;

  router.post('/api/v3/plugins/peipe-video/cover-cache', middleware.applyCSRF, async (req, res) => {
    try {
      const videoId = cleanVideoId(req.body && req.body.videoId);
      const coverUrl = cleanUrl(req.body && req.body.coverUrl);
      const sourceUrl = cleanUrl(req.body && req.body.url);

      if (!videoId || !coverUrl) {
        return res.status(400).json({ error: 'invalid cover payload' });
      }

      await saveCover(videoId, coverUrl, sourceUrl);
      return res.json({ ok: true });
    } catch (err) {
      winston.warn('[peipe-video] cover cache failed: ' + (err && err.stack || err));
      return res.status(500).json({ error: 'cover cache failed' });
    }
  });
}

module.exports = {
  installCoverCacheRoute,
  attachCoverUrls,
  saveCover,
  getCover,
};
