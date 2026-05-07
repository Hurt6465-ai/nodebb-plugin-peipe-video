/* Peipe /video Douyin-style page for NodeBB 4.10.x
   - cid 6 feed
   - TikTok official embed, official volume control kept
   - virtual vertical slide list inspired by SlideVerticalInfinite (virtualTotal=5)
   - current + next 3 hydration/player preload
*/
(function () {
  'use strict';

  if (window.__peipeVideoDiscoverV2) return;
  window.__peipeVideoDiscoverV2 = true;

  var CONFIG = Object.assign({
    cid: 6,
    pageSize: 12,
    preloadAhead: 3,
    virtualTotal: 5,
    imageMax: 4,
    topicCacheMs: 3 * 60 * 1000,
    coverCacheMs: 7 * 24 * 60 * 60 * 1000,
    translateCacheMs: 3 * 24 * 60 * 60 * 1000,
    slideDurationMs: 300,
    judgeValue: 20,
    doubleTapMs: 280
  }, window.PEIPE_VIDEO_CONFIG || {});

  var TEXT = {
    loading: '发现加载中...',
    empty: '还没有可浏览的内容',
    publish: '发布',
    publishing: '发布中...',
    publishOk: '发布成功',
    publishFail: '发布失败',
    placeholder: '写点什么，或粘贴 TikTok 链接',
    chooseImage: '图片',
    record: '语音',
    stop: '停止',
    send: '发布',
    imageOnly: '请选择图片',
    maxImages: '最多 4 张图片',
    uploadImage: '上传图片',
    uploadVoice: '上传语音',
    processingImage: '处理图片',
    enterSomething: '请输入内容、TikTok 链接、图片或语音',
    comments: '评论',
    commentPlaceholder: '写评论...',
    commentFail: '评论失败，可打开原帖评论',
    openTopic: '打开原帖',
    loginFirst: '请先登录',
    followFail: '关注失败',
    unfollowFail: '取消关注失败',
    followed: '已关注',
    unfollowed: '已取消关注',
    likeFail: '点赞失败',
    unlikeFail: '取消点赞失败',
    shareOk: '链接已复制',
    shareFail: '复制失败',
    translate: '翻译',
    translating: '翻译中...',
    translateFail: '翻译失败',
    translateSettings: '翻译设置',
    sourceLang: '源语言',
    targetLang: '目标语言',
    save: '保存',
    auto: '自动',
    officialSoundTip: '声音用官方按钮开启',
    voiceMsg: '语音消息'
  };

  var RE = {
    tiktokGlobal: /https?:\/\/(?:www\.)?tiktok\.com\/@[^\/\s<>'"]+\/video\/(\d+)(?:\?[^\s<>'"]*)?/ig,
    tiktokOne: /https?:\/\/(?:www\.)?tiktok\.com\/@([^\/\s<>'"]+)\/video\/(\d+)/i,
    tiktokToken: /(?:https?[-:\/]+)?(?:www[.-])?tiktok[.-]com[-\/\w@.%=&?]+/ig,
    audioExt: /\.(m4a|mp3|wav|ogg|oga|webm|aac)(?:[?#].*)?$/i,
    imageExt: /\.(png|jpe?g|gif|webp|avif)(?:[?#].*)?$/i
  };

  var state = {
    root: null,
    stage: null,
    listEl: null,
    list: [],
    topicMap: new Map(),
    topicInflight: new Map(),
    feedPage: 1,
    feedLoading: false,
    feedDone: false,
    index: 0,
    slides: new Map(),
    players: new Map(),
    currentPlayerKey: '',
    gesture: {
      isDown: false,
      startX: 0,
      startY: 0,
      startTime: 0,
      moveX: 0,
      moveY: 0,
      needCheck: true,
      canVertical: false,
      moved: false
    },
    lastTap: { time: 0, x: 0, y: 0, timer: 0 },
    compose: {
      imageFiles: [],
      imageUrls: [],
      voiceBlob: null,
      voiceUrl: '',
      voiceDuration: 0,
      mediaRecorder: null,
      stream: null,
      chunks: [],
      startAt: 0,
      timer: 0
    },
    viewer: { images: [], index: 0, startX: 0, startY: 0, down: false },
    comments: { item: null, posts: [], loading: false },
    translateLongPressTimer: 0,
    resizeTimer: 0,
    idleFabTimer: 0
  };

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function norm(v) { return String(v || '').replace(/\s+/g, ' ').trim(); }
  function html(strings) {
    var out = strings[0];
    for (var i = 1; i < arguments.length; i += 1) out += arguments[i] + strings[i];
    return out;
  }
  function rel(path) {
    var base = (window.config && window.config.relative_path) || '';
    if (!path) return base || '';
    if (/^https?:\/\//i.test(path)) return path;
    if (base && path.indexOf(base + '/') === 0) return path;
    return base + path;
  }
  function csrfToken() {
    return (window.config && (window.config.csrf_token || window.config.csrfToken)) ||
      ($('meta[name="csrf-token"]') && $('meta[name="csrf-token"]').getAttribute('content')) || '';
  }
  function currentUser() { return (window.app && window.app.user) || null; }
  function isLoggedIn() { var u = currentUser(); return !!(u && Number(u.uid || 0) > 0); }
  function alertError(msg) { if (window.app && app.alertError) app.alertError(msg); else window.alert(msg); }
  function alertSuccess(msg) { if (window.app && app.alertSuccess) app.alertSuccess(msg); }
  function safeJsonGet(key, fallback) { try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (e) { return fallback; } }
  function safeJsonSet(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {} }
  function formatCount(n) {
    n = Number(n || 0);
    if (n >= 100000000) return (n / 100000000).toFixed(n >= 1000000000 ? 1 : 2).replace(/\.0+$/, '') + '亿';
    if (n >= 10000) return (n / 10000).toFixed(n >= 100000 ? 1 : 2).replace(/\.0+$/, '') + '万';
    return String(Math.max(0, Math.floor(n)));
  }
  function pad(n) { return String(n).padStart(2, '0'); }
  function formatDuration(sec) { sec = Math.max(0, Math.floor(Number(sec) || 0)); return pad(Math.floor(sec / 60)) + ':' + pad(sec % 60); }
  function parseTime(value) {
    if (value == null || value === '') return 0;
    if (typeof value === 'number') return value > 9999999999 ? value : value * 1000;
    var s = String(value);
    if (/^\d+$/.test(s)) { var n = Number(s); return n > 9999999999 ? n : n * 1000; }
    var t = Date.parse(s); return Number.isNaN(t) ? 0 : t;
  }
  function relativeTime(value) {
    var t = parseTime(value); if (!t) return '';
    var diff = Math.max(0, Date.now() - t);
    var m = 60000, h = 60 * m, d = 24 * h, mo = 30 * d, y = 365 * d;
    if (diff >= y) return Math.floor(diff / y) + '年前';
    if (diff >= mo) return Math.floor(diff / mo) + '个月前';
    if (diff >= d) return Math.floor(diff / d) + '天前';
    if (diff >= h) return Math.floor(diff / h) + '小时前';
    if (diff >= m) return Math.max(1, Math.floor(diff / m)) + '分钟前';
    return '刚刚';
  }
  function escapeHtml(s) {
    return String(s || '').replace(/[&<>'"]/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[ch];
    });
  }

  function iconHeart(active) { return active ? '♥' : '♡'; }
  function iconComment() { return '💬'; }
  function iconShare() { return '↗'; }

  function canonicalTikTokUrl(url) {
    var m = String(url || '').replace(/&amp;/g, '&').match(RE.tiktokOne);
    return m ? 'https://www.tiktok.com/@' + m[1] + '/video/' + m[2] : String(url || '');
  }
  function collectTikToks(text) {
    var seen = new Set();
    var out = [];
    String(text || '').replace(RE.tiktokGlobal, function (match, videoId) {
      if (videoId && !seen.has(videoId)) {
        seen.add(videoId);
        out.push({ videoId: videoId, url: match.replace(/&amp;/g, '&') });
      }
      return match;
    });
    return out;
  }
  function stripTikTokUrls(text) {
    return String(text || '').replace(RE.tiktokGlobal, '').replace(RE.tiktokToken, '').replace(/\s+/g, ' ').trim();
  }
  function isAutoText(t) {
    var clean = norm(String(t || '').replace(/[•・·|｜_／/\\-]+/g, ' '));
    return !clean || /^(?:新动态|图片分享|图片动态|语音消息|语音动态|voice message|audio message|image|photo|picture)$/i.test(clean);
  }
  function cleanDisplayText(text) {
    var lines = String(text || '')
      .replace(RE.tiktokGlobal, '')
      .replace(RE.tiktokToken, '')
      .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
      .replace(/\[\s*(?:语音消息|语音动态|voice\s*message|audio\s*message)[^\]]*\]\([^)]+\)/ig, '')
      .split(/[\r\n]+/)
      .map(norm)
      .filter(function (line) { return line && !isAutoText(line); });
    var joined = lines.join('\n');
    return isAutoText(joined) ? '' : joined;
  }

  function addPreconnects() {
    ['https://www.tiktok.com', 'https://www.tiktokcdn.com', 'https://p16-sign-va.tiktokcdn.com', 'https://p19-sign.tiktokcdn-us.com'].forEach(function (href) {
      if (document.querySelector('link[rel="preconnect"][href="' + href + '"]')) return;
      var link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = href;
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
      var dns = document.createElement('link');
      dns.rel = 'dns-prefetch';
      dns.href = href;
      document.head.appendChild(dns);
    });
  }

  function apiFetch(url, options) {
    options = options || {};
    options.credentials = options.credentials || 'same-origin';
    options.headers = Object.assign({ accept: 'application/json', 'x-requested-with': 'XMLHttpRequest' }, options.headers || {});
    return fetch(rel(url), options).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (json) {
        if (!res.ok) {
          var msg = json.error || json.message || (json.status && json.status.message) || ('HTTP ' + res.status);
          throw new Error(msg);
        }
        return json;
      });
    });
  }

  function extractTopicsFromCategory(json) {
    var topics = [];
    if (Array.isArray(json.topics)) topics = json.topics;
    else if (json.category && Array.isArray(json.category.topics)) topics = json.category.topics;
    else if (json.response && Array.isArray(json.response.topics)) topics = json.response.topics;
    return topics;
  }

  function topicFromCategoryTopic(t) {
    var user = t.user || t.author || t.teaser && t.teaser.user || {};
    var tid = String(t.tid || t.topic_id || '');
    var pid = String(t.mainPid || t.mainPid || t.pid || t.postId || t.teaser && t.teaser.pid || '');
    var title = cleanDisplayText(t.titleRaw || t.title || t.slug || '');
    return {
      tid: tid,
      pid: /^\d+$/.test(pid) ? pid : '',
      cid: Number(t.cid || CONFIG.cid),
      href: t.slug ? rel('/topic/' + tid + '/' + t.slug) : rel('/topic/' + tid),
      title: title,
      text: title,
      raw: '',
      images: [],
      audios: [],
      tiktoks: collectTikToks(title),
      coverUrl: '',
      createdAt: t.timestamp || t.timestampISO || t.lastposttime || t.lastposttimeISO || t.updatetime || 0,
      counts: {
        likes: Number(t.votes || t.votecount || t.voteCount || t.upvotes || 0),
        comments: Math.max(0, Number(t.postcount || t.posts || t.postCount || 1) - 1)
      },
      viewer: {
        liked: readVote('', tid),
        following: false
      },
      author: normalizeAuthor(user, t),
      hydrated: false,
      loading: false
    };
  }

  function normalizeAuthor(user, fallback) {
    user = user || {};
    fallback = fallback || {};
    var uid = String(user.uid || user.userId || user.userid || fallback.uid || fallback.userId || '');
    var username = norm(user.displayname || user.displayName || user.username || fallback.username || fallback.displayname || fallback.userslug || '用户');
    var userslug = String(user.userslug || fallback.userslug || username || '').replace(/^@/, '');
    var picture = user.picture || user.uploadedpicture || user.avatar || fallback.picture || fallback.uploadedpicture || '';
    return { uid: uid, username: username, userslug: userslug, picture: picture };
  }

  function findPostId(payload) {
    if (!payload || typeof payload !== 'object') return '';
    var keys = ['mainPid', 'main_pid', 'pid', 'postId', 'post_id'];
    for (var i = 0; i < keys.length; i += 1) if (payload[keys[i]] && /^\d+$/.test(String(payload[keys[i]]))) return String(payload[keys[i]]);
    if (Array.isArray(payload.posts)) {
      for (var j = 0; j < payload.posts.length; j += 1) if (payload.posts[j] && payload.posts[j].pid) return String(payload.posts[j].pid);
    }
    for (var k = 0; k < ['topic', 'data', 'response'].length; k += 1) {
      var found = findPostId(payload[['topic', 'data', 'response'][k]]);
      if (found) return found;
    }
    return '';
  }

  function extractFirstPost(payload) {
    if (!payload || typeof payload !== 'object') return {};
    var candidates = [];
    if (Array.isArray(payload.posts) && payload.posts[0]) candidates.push(payload.posts[0]);
    ['mainPost', 'postData', 'topic'].forEach(function (k) { if (payload[k]) candidates.push(payload[k]); });
    ['response', 'data'].forEach(function (rootKey) {
      var root = payload[rootKey];
      if (!root || typeof root !== 'object') return;
      if (Array.isArray(root.posts) && root.posts[0]) candidates.push(root.posts[0]);
      ['mainPost', 'postData', 'topic'].forEach(function (k) { if (root[k]) candidates.push(root[k]); });
    });
    return candidates[0] || payload;
  }

  function parseMediaFromContent(content) {
    var raw = String(content || '');
    var holder = document.createElement('div');
    holder.innerHTML = raw;
    var out = { text: '', images: [], audios: [], tiktoks: collectTikToks(raw) };

    $$('img[src]', holder).forEach(function (img) {
      var src = img.getAttribute('src') || '';
      if (src && out.images.indexOf(src) === -1) out.images.push(src);
    });
    $$('audio[src], source[src]', holder).forEach(function (a) {
      var src = a.getAttribute('src') || '';
      if (src && RE.audioExt.test(src) && !out.audios.some(function (x) { return x.url === src; })) out.audios.push({ url: src, label: TEXT.voiceMsg });
    });
    $$('a[href]', holder).forEach(function (a) {
      var href = a.getAttribute('href') || '';
      if (RE.imageExt.test(href) && out.images.indexOf(href) === -1) out.images.push(href);
      if (RE.audioExt.test(href) && !out.audios.some(function (x) { return x.url === href; })) out.audios.push({ url: href, label: norm(a.textContent) || TEXT.voiceMsg });
    });

    (raw.match(/!\[[^\]]*\]\(([^)]+)\)/g) || []).forEach(function (item) {
      var m = item.match(/!\[[^\]]*\]\(([^)]+)\)/);
      if (m && m[1] && out.images.indexOf(m[1]) === -1) out.images.push(m[1]);
    });

    out.text = cleanDisplayText(holder.textContent || raw);
    out.images = out.images.slice(0, CONFIG.imageMax);
    return out;
  }

  function topicCacheKey(tid) { return 'pv-topic:' + tid; }
  function readTopicCache(tid) {
    var c = safeJsonGet(topicCacheKey(tid), null);
    return c && c.expiresAt > Date.now() ? c.value : null;
  }
  function writeTopicCache(tid, value) { safeJsonSet(topicCacheKey(tid), { expiresAt: Date.now() + CONFIG.topicCacheMs, value: value }); }

  function hydrateTopic(index) {
    var item = state.list[index];
    if (!item || !item.tid || item.hydrated || item.source === 'plugin-feed') return Promise.resolve(item);
    var cached = readTopicCache(item.tid);
    if (cached) {
      mergeHydratedItem(item, cached);
      updateSlide(index);
      return Promise.resolve(item);
    }
    if (state.topicInflight.has(item.tid)) return state.topicInflight.get(item.tid);
    item.loading = true;
    var p = apiFetch('/api/topic/' + encodeURIComponent(item.tid))
      .catch(function () { return apiFetch('/api/v3/topics/' + encodeURIComponent(item.tid)); })
      .then(function (json) {
        var post = extractFirstPost(json);
        var content = post.content || post.raw || post.markdown || post.text || '';
        var media = parseMediaFromContent(content);
        var merged = {
          pid: findPostId(json) || item.pid,
          text: media.text || item.text || item.title,
          raw: content,
          images: media.images,
          audios: media.audios,
          tiktoks: media.tiktoks.length ? media.tiktoks : item.tiktoks,
          createdAt: post.timestamp || post.timestampISO || item.createdAt,
          author: normalizeAuthor(post.user || post, item.author),
          counts: {
            likes: Number(post.votes || post.upvotes || post.voteCount || item.counts.likes || 0),
            comments: Math.max(0, Number((json.postcount || json.posts && json.posts.length || item.counts.comments + 1) || 1) - 1)
          }
        };
        writeTopicCache(item.tid, merged);
        mergeHydratedItem(item, merged);
        updateSlide(index);
        return item;
      })
      .catch(function (err) {
        console.warn('[peipe-video] hydrate failed', item.tid, err);
        item.loading = false;
        updateSlide(index);
        return item;
      })
      .finally(function () { state.topicInflight.delete(item.tid); });
    state.topicInflight.set(item.tid, p);
    return p;
  }

  function mergeHydratedItem(item, data) {
    item.pid = data.pid || item.pid;
    item.text = data.text || item.text;
    item.raw = data.raw || item.raw;
    item.images = Array.isArray(data.images) ? data.images.slice(0, CONFIG.imageMax) : item.images;
    item.audios = Array.isArray(data.audios) ? data.audios : item.audios;
    item.tiktoks = Array.isArray(data.tiktoks) && data.tiktoks.length ? data.tiktoks : item.tiktoks;
    item.createdAt = data.createdAt || item.createdAt;
    item.author = normalizeAuthor(data.author, item.author);
    item.counts = Object.assign({}, item.counts, data.counts || {});
    item.viewer.liked = readVote(item.pid, item.tid) || false;
    item.viewer.following = readFollow(item.author);
    item.hydrated = true;
    item.loading = false;
  }

  function fetchCategorySlug() {
    return apiFetch('/api/categories').then(function (json) {
      var cats = [];
      function walk(list) {
        (list || []).forEach(function (c) { cats.push(c); if (c.children) walk(c.children); });
      }
      walk(json.categories || json.response && json.response.categories || []);
      var found = cats.find(function (c) { return Number(c.cid) === Number(CONFIG.cid); });
      return found && (found.slug || found.name) ? String(found.slug || found.name).replace(/^\d+\//, '') : '';
    }).catch(function () { return ''; });
  }

  function loadFeed(refresh) {
    if (state.feedLoading || state.feedDone && !refresh) return Promise.resolve();
    state.feedLoading = true;
    if (refresh) {
      state.feedPage = 1;
      state.feedDone = false;
      state.list = [];
      state.index = 0;
      state.topicMap.clear();
      renderWindow(true);
    }
    var page = state.feedPage;
    return apiFetch('/api/v3/plugins/peipe-video/feed?page=' + page + '&pageSize=' + CONFIG.pageSize)
      .then(function (json) {
        var payload = json.response || json;
        var topics = (payload.items || []).map(function (item) {
          item.images = (item.images || []).slice(0, CONFIG.imageMax);
          item.hydrated = true;
          item.source = 'plugin-feed';
          item.viewer = item.viewer || { liked: false, following: false };
          item.counts = item.counts || { likes: 0, comments: 0 };
          return item;
        }).filter(function (item) {
          if (!item.tid || state.topicMap.has(item.tid)) return false;
          state.topicMap.set(item.tid, item);
          return true;
        });
        if (!topics.length || payload.hasMore === false) state.feedDone = true;
        state.list = state.list.concat(topics);
        state.feedPage += 1;
        if (state.list.length && state.index >= state.list.length) state.index = state.list.length - 1;
        renderWindow(true);
        hydrateAround(state.index);
      })
      .catch(function (err) {
        console.warn('[peipe-video] feed failed', err);
        showEmpty('加载失败，刷新试试');
      })
      .finally(function () { state.feedLoading = false; });
  }

  function hydrateAround(index) {
    var end = Math.min(state.list.length - 1, index + CONFIG.preloadAhead);
    for (var i = Math.max(0, index - 1); i <= end; i += 1) hydrateTopic(i);
    if (state.list.length - index <= CONFIG.preloadAhead + 2) loadFeed(false);
  }

  function slideHeight() { return Math.max(1, window.innerHeight || document.documentElement.clientHeight || 1); }
  function slideOffset(index) { return -index * slideHeight(); }
  function setTrackTransform(offset, animate) {
    if (!state.listEl) return;
    state.listEl.style.transitionDuration = animate ? CONFIG.slideDurationMs + 'ms' : '0ms';
    state.listEl.style.transform = 'translate3d(0px,' + offset + 'px,0px)';
  }

  function visibleRange() {
    var total = CONFIG.virtualTotal;
    var half = Math.floor(total / 2);
    var start = Math.max(0, state.index - 1);
    var end = Math.min(state.list.length, start + total);
    if (end - start < total) start = Math.max(0, end - total);
    // Bias forward: previous 1, current, next 3 when possible.
    if (state.index > 0) {
      start = Math.max(0, Math.min(state.index - 1, Math.max(0, state.list.length - total)));
      end = Math.min(state.list.length, start + total);
    }
    return { start: start, end: end };
  }

  function renderWindow(force) {
    if (!state.listEl) return;
    if (!state.list.length) {
      showEmpty(TEXT.empty);
      return;
    }
    var empty = $('.pv-empty-page', state.root);
    if (empty) empty.remove();
    var r = visibleRange();
    var keep = new Set();
    for (var i = r.start; i < r.end; i += 1) {
      keep.add(String(i));
      if (!state.slides.has(i) || force) {
        if (state.slides.has(i)) removeSlide(i);
        var el = createSlide(i, state.list[i]);
        state.slides.set(i, el);
        state.listEl.appendChild(el);
      }
    }
    Array.from(state.slides.keys()).forEach(function (idx) {
      if (!keep.has(String(idx))) removeSlide(idx);
    });
    state.slides.forEach(function (el, idx) {
      el.style.top = (idx * slideHeight()) + 'px';
      el.classList.toggle('is-active', idx === state.index);
    });
    setTrackTransform(slideOffset(state.index), false);
    activateCurrent();
  }

  function removeSlide(index) {
    var el = state.slides.get(index);
    if (!el) return;
    pauseSlide(index);
    cleanupSlidePlayers(index);
    el.remove();
    state.slides.delete(index);
  }

  function cleanupSlidePlayers(index) {
    Array.from(state.players.keys()).forEach(function (key) {
      if (key.indexOf(index + ':') === 0) state.players.delete(key);
    });
  }

  function updateSlide(index) {
    var el = state.slides.get(index);
    if (!el) return;
    var next = createSlide(index, state.list[index]);
    el.replaceWith(next);
    state.slides.set(index, next);
    next.style.top = (index * slideHeight()) + 'px';
    next.classList.toggle('is-active', index === state.index);
    if (index === state.index) activateCurrent();
    else prepareSlide(index);
  }

  function authorHref(author) { return author && author.userslug ? rel('/user/' + encodeURIComponent(author.userslug)) : '#'; }
  function avatarSrc(author) { return author && author.picture ? author.picture : ''; }

  function createSlide(index, item) {
    var slide = document.createElement('section');
    slide.className = 'pv-slide-item';
    slide.dataset.index = String(index);
    slide.dataset.tid = item.tid;

    var mediaHtml = '';
    if (item.tiktoks && item.tiktoks.length) {
      mediaHtml = '<div class="pv-video-shell" data-video-id="' + escapeHtml(item.tiktoks[0].videoId) + '"></div>';
    } else if (item.images && item.images.length) {
      mediaHtml = '<div class="pv-image-main"><img src="' + escapeHtml(item.images[0]) + '" alt="image"></div>';
    } else {
      mediaHtml = '<div class="pv-error">这条动态没有 TikTok 或图片</div>';
    }

    var images = (item.images || []).slice(0, CONFIG.imageMax);
    var thumbs = images.length ? '<div class="pv-thumbs">' + images.map(function (src, i) {
      return '<button type="button" class="pv-thumb" data-index="' + i + '"><img src="' + escapeHtml(src) + '" alt="image ' + (i + 1) + '"></button>';
    }).join('') + '</div>' : '';

    var author = item.author || {};
    var avatar = avatarSrc(author);
    var avatarHtml = avatar ? '<img class="pv-avatar" src="' + escapeHtml(avatar) + '" alt="avatar">' : '<div class="pv-avatar"></div>';
    var following = readFollow(author) || item.viewer.following;
    var liked = !!(readVote(item.pid, item.tid) || item.viewer.liked);

    slide.innerHTML = html`
      <div class="pv-media">${mediaHtml}</div>
      <div class="pv-cover"><img alt="cover"></div>
      <div class="pv-gradient"></div>
      <div class="pv-official-sound-tip">${TEXT.officialSoundTip}</div>
      <div class="pv-gesture-main"></div>
      <div class="pv-center-play"></div>
      <div class="pv-toolbar">
        <div class="pv-avatar-wrap">
          <a href="${authorHref(author)}">${avatarHtml}</a>
          ${author.uid && !isOwnAuthor(author) ? '<button type="button" class="pv-follow-plus ' + (following ? 'is-following' : '') + '" title="关注">' + (following ? '✓' : '+') + '</button>' : ''}
        </div>
        <button type="button" class="pv-action pv-like ${liked ? 'is-active' : ''}"><span class="pv-action-icon">${iconHeart(liked)}</span><span>${formatCount(item.counts.likes)}</span></button>
        <button type="button" class="pv-action pv-comment-btn"><span class="pv-action-icon">${iconComment()}</span><span>${formatCount(item.counts.comments)}</span></button>
        <button type="button" class="pv-action pv-share-btn"><span class="pv-action-icon">${iconShare()}</span><span>分享</span></button>
      </div>
      <div class="pv-desc">
        <a class="pv-username" href="${authorHref(author)}">@${escapeHtml(author.username || author.userslug || '用户')}</a>
        <div class="pv-text-row"><span class="pv-text-main">${escapeHtml(item.text || item.title || '')}</span>${item.text || item.title ? '<button type="button" class="pv-translate-btn">' + TEXT.translate + '</button>' : ''}</div>
        <div class="pv-translated"></div>
        <div class="pv-time">${relativeTime(item.createdAt)}</div>
        ${thumbs}
      </div>`;

    bindSlide(slide, index, item);
    prepareSlide(index);
    return slide;
  }

  function isOwnAuthor(author) {
    var me = currentUser();
    if (!me || !author) return false;
    return String(me.uid || '') === String(author.uid || '') || String(me.userslug || '').toLowerCase() === String(author.userslug || '').toLowerCase();
  }

  function bindSlide(slide, index, item) {
    var gesture = $('.pv-gesture-main', slide);
    if (gesture) {
      gesture.addEventListener('pointerdown', onPointerDown, true);
      gesture.addEventListener('pointermove', onPointerMove, true);
      gesture.addEventListener('pointerup', onPointerUp, true);
      gesture.addEventListener('pointercancel', onPointerCancel, true);
      gesture.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); }, true);
    }

    var like = $('.pv-like', slide);
    if (like) like.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); toggleLike(item, slide, true); });

    var comment = $('.pv-comment-btn', slide);
    if (comment) comment.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); openComments(item); });

    var share = $('.pv-share-btn', slide);
    if (share) share.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); shareItem(item); });

    var follow = $('.pv-follow-plus', slide);
    if (follow) follow.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); toggleFollow(item, slide); });

    $$('.pv-thumb', slide).forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        openViewer(item.images || [], Number(btn.dataset.index || 0));
      });
    });

    var translate = $('.pv-translate-btn', slide);
    if (translate) translate.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); translateSlide(item, slide); });

    var textRow = $('.pv-text-row', slide);
    if (textRow) {
      textRow.addEventListener('pointerdown', function () {
        clearTimeout(state.translateLongPressTimer);
        state.translateLongPressTimer = setTimeout(function () { openTranslateSettings(); }, 650);
      });
      ['pointerup', 'pointercancel', 'pointermove'].forEach(function (eventName) {
        textRow.addEventListener(eventName, function () { clearTimeout(state.translateLongPressTimer); });
      });
    }
  }

  function prepareSlide(index) {
    var el = state.slides.get(index);
    var item = state.list[index];
    if (!el || !item) return;
    var shell = $('.pv-video-shell', el);
    if (shell && item.tiktoks && item.tiktoks[0]) {
      ensureTikTokPlayer(index, item, false);
    } else if (item.images && item.images.length) {
      var cover = $('.pv-cover', el);
      if (cover) cover.classList.add('is-hidden');
    }
  }

  function activateCurrent() {
    state.slides.forEach(function (el, idx) {
      el.classList.toggle('is-active', idx === state.index);
      if (idx !== state.index) pauseSlide(idx);
    });
    var item = state.list[state.index];
    if (!item) return;
    hydrateAround(state.index);
    prepareSlide(state.index);
    playSlide(state.index, false);
  }

  function buildPlayerUrl(videoId, autoplay) {
    var params = new URLSearchParams({
      autoplay: autoplay ? '1' : '0',
      muted: '0',
      loop: '1',
      rel: '0',
      controls: '1',
      progress_bar: '0',
      play_button: '1',
      volume_control: '1',
      fullscreen_button: '0',
      timestamp: '0',
      music_info: '0',
      description: '0',
      native_context_menu: '0',
      closed_caption: '0',
      playsinline: '1'
    });
    return 'https://www.tiktok.com/player/v1/' + encodeURIComponent(videoId) + '?' + params.toString();
  }

  function playerKey(index, videoId) { return index + ':' + videoId; }
  function ensureTikTokPlayer(index, item, autoplay) {
    var slide = state.slides.get(index);
    if (!slide || !item || !item.tiktoks || !item.tiktoks[0]) return null;
    var tk = item.tiktoks[0];
    var key = playerKey(index, tk.videoId);
    var player = state.players.get(key);
    if (player && player.iframe && player.iframe.parentNode) return player;

    var shell = $('.pv-video-shell', slide);
    if (!shell) return null;
    shell.innerHTML = '';
    var iframe = document.createElement('iframe');
    iframe.className = 'pv-tiktok-frame';
    iframe.src = buildPlayerUrl(tk.videoId, !!autoplay);
    iframe.allow = 'autoplay; fullscreen; encrypted-media; picture-in-picture';
    iframe.loading = index === state.index ? 'eager' : 'lazy';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.title = 'TikTok Player';
    shell.appendChild(iframe);

    player = { key: key, index: index, item: item, videoId: tk.videoId, iframe: iframe, ready: false, wantPlay: false, status: 'paused' };
    state.players.set(key, player);
    fetchCover(tk.videoId, tk.url).then(function (url) {
      if (!url) return;
      var img = $('.pv-cover img', slide);
      if (img && !img.src) img.src = url;
    });
    return player;
  }

  function sendToPlayer(iframe, type, value) {
    if (!iframe || !iframe.contentWindow) return;
    var msg = { 'x-tiktok-player': true, type: type };
    if (arguments.length >= 3) msg.value = value;
    iframe.contentWindow.postMessage(msg, '*');
  }

  function playSlide(index, userGesture) {
    var item = state.list[index];
    var slide = state.slides.get(index);
    if (!item || !slide) return;
    if (!(item.tiktoks && item.tiktoks[0])) return;
    var player = ensureTikTokPlayer(index, item, !!userGesture);
    if (!player || !player.iframe) return;
    state.currentPlayerKey = player.key;
    player.wantPlay = true;
    pauseOtherPlayers(player.key);
    slide.classList.add('is-loading');
    slide.classList.remove('is-playing');
    if (userGesture && player.iframe.src.indexOf('autoplay=1') === -1) {
      player.iframe.src = buildPlayerUrl(player.videoId, true);
    }
    sendToPlayer(player.iframe, 'unMute');
    sendToPlayer(player.iframe, 'play');
    setTimeout(function () { sendToPlayer(player.iframe, 'unMute'); sendToPlayer(player.iframe, 'play'); }, 260);
    setTimeout(function () {
      if (player.wantPlay && player.status !== 'playing') {
        markSlidePlaying(index);
      }
    }, 1600);
  }

  function pauseSlide(index) {
    Array.from(state.players.values()).forEach(function (p) {
      if (p.index !== index) return;
      p.wantPlay = false;
      if (p.iframe) sendToPlayer(p.iframe, 'pause');
      p.status = 'paused';
    });
    var slide = state.slides.get(index);
    if (slide) slide.classList.remove('is-playing', 'is-loading');
  }

  function pauseOtherPlayers(currentKey) {
    state.players.forEach(function (p, key) {
      if (key === currentKey) return;
      p.wantPlay = false;
      if (p.iframe) sendToPlayer(p.iframe, 'pause');
      p.status = 'paused';
      var slide = state.slides.get(p.index);
      if (slide) slide.classList.remove('is-playing', 'is-loading');
    });
  }

  function markSlidePlaying(index) {
    var slide = state.slides.get(index);
    if (!slide) return;
    var cover = $('.pv-cover', slide);
    if (cover) cover.classList.add('is-hidden');
    slide.classList.add('is-playing');
    slide.classList.remove('is-loading');
  }

  window.addEventListener('message', function (event) {
    var data = event.data;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch (e) { return; }
    }
    if (!data || !data['x-tiktok-player']) return;
    var host = '';
    try { host = new URL(event.origin).hostname; } catch (e) {}
    if (host && !/(^|\.)tiktok\.com$|(^|\.)tiktokcdn\.com$/.test(host)) return;

    state.players.forEach(function (player) {
      if (!player.iframe || player.iframe.contentWindow !== event.source) return;
      if (data.type === 'onPlayerReady') {
        player.ready = true;
        if (player.wantPlay) {
          sendToPlayer(player.iframe, 'unMute');
          sendToPlayer(player.iframe, 'play');
        }
        return;
      }
      if (data.type === 'onStateChange') {
        var value = Number(data.value);
        var word = String(data.value || '').toLowerCase();
        if (value === 1 || word === 'playing') {
          player.status = 'playing';
          pauseOtherPlayers(player.key);
          markSlidePlaying(player.index);
        } else if (value === 2 || value === 0 || word === 'paused' || word === 'ended') {
          player.status = 'paused';
          var slide = state.slides.get(player.index);
          if (slide) slide.classList.remove('is-playing', 'is-loading');
        } else if (value === 3 || word === 'buffering') {
          var slide2 = state.slides.get(player.index);
          if (slide2 && player.wantPlay) slide2.classList.add('is-loading');
        }
      }
    });
  });

  function coverCacheKey(videoId) { return 'pv-cover:' + videoId; }
  function fetchCover(videoId, url) {
    var cached = safeJsonGet(coverCacheKey(videoId), null);
    if (cached && cached.url && cached.expiresAt > Date.now()) return Promise.resolve(cached.url);
    return fetch('https://www.tiktok.com/oembed?url=' + encodeURIComponent(canonicalTikTokUrl(url)), { cache: 'force-cache' })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (json) {
        var thumb = json.thumbnail_url || '';
        if (thumb) safeJsonSet(coverCacheKey(videoId), { url: thumb, expiresAt: Date.now() + CONFIG.coverCacheMs });
        return thumb;
      }).catch(function () { return ''; });
  }

  function onPointerDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    state.gesture.isDown = true;
    state.gesture.startX = e.clientX;
    state.gesture.startY = e.clientY;
    state.gesture.startTime = Date.now();
    state.gesture.moveX = 0;
    state.gesture.moveY = 0;
    state.gesture.needCheck = true;
    state.gesture.canVertical = false;
    state.gesture.moved = false;
    if (state.listEl) state.listEl.style.transitionDuration = '0ms';
  }

  function onPointerMove(e) {
    var g = state.gesture;
    if (!g.isDown) return;
    g.moveX = e.clientX - g.startX;
    g.moveY = e.clientY - g.startY;
    var ax = Math.abs(g.moveX), ay = Math.abs(g.moveY);
    if (ax > 6 || ay > 6) g.moved = true;
    if (g.needCheck) {
      if (ax > CONFIG.judgeValue || ay > CONFIG.judgeValue) {
        var angle = ax / Math.max(1, ay);
        g.canVertical = angle <= 1;
        g.needCheck = false;
      } else return;
    }
    if (g.canVertical) {
      e.preventDefault();
      hideComposerFab();
      var dy = g.moveY;
      var isNext = dy < 0;
      if (!canGo(isNext)) dy = dy * .28;
      setTrackTransform(slideOffset(state.index) + dy, false);
    } else {
      // Video feed does not use horizontal navigation. Capture it so browser back gesture is less likely.
      if (e.cancelable) e.preventDefault();
    }
  }

  function onPointerUp(e) {
    var g = state.gesture;
    if (!g.isDown) return;
    g.isDown = false;
    var ax = Math.abs(g.moveX), ay = Math.abs(g.moveY);
    var elapsed = Date.now() - g.startTime;
    if (g.canVertical && ay >= ax) {
      var isNext = g.moveY < 0;
      var passed = ay > slideHeight() / 3 || (elapsed < 150 && ay > 20);
      if (passed && canGo(isNext)) {
        goIndex(state.index + (isNext ? 1 : -1));
      } else {
        setTrackTransform(slideOffset(state.index), true);
      }
      resetGesture();
      return;
    }
    setTrackTransform(slideOffset(state.index), true);
    if (!g.moved && ax < 8 && ay < 8) handleTap(e);
    resetGesture();
  }
  function onPointerCancel() { state.gesture.isDown = false; setTrackTransform(slideOffset(state.index), true); resetGesture(); }
  function resetGesture() {
    var g = state.gesture;
    g.moveX = 0; g.moveY = 0; g.needCheck = true; g.canVertical = false; g.moved = false;
  }
  function canGo(isNext) { return !(state.index === 0 && !isNext) && !(state.index >= state.list.length - 1 && isNext); }
  function goIndex(next) {
    next = Math.max(0, Math.min(state.list.length - 1, next));
    if (next === state.index) { setTrackTransform(slideOffset(state.index), true); return; }
    var old = state.index;
    pauseSlide(old);
    state.index = next;
    renderWindow(false);
    setTrackTransform(slideOffset(state.index), true);
    hydrateAround(state.index);
    setTimeout(function () { activateCurrent(); }, 40);
  }

  function handleTap(e) {
    var now = Date.now();
    var last = state.lastTap;
    var dist = Math.hypot(e.clientX - last.x, e.clientY - last.y);
    if (last.time && now - last.time < CONFIG.doubleTapMs && dist < 44) {
      clearTimeout(last.timer);
      last.time = 0;
      var item = state.list[state.index];
      var slide = state.slides.get(state.index);
      if (item && slide) {
        toggleLike(item, slide, true, { x: e.clientX, y: e.clientY });
      }
      return;
    }
    last.time = now;
    last.x = e.clientX;
    last.y = e.clientY;
    clearTimeout(last.timer);
    last.timer = setTimeout(function () {
      var item = state.list[state.index];
      if (!item) return;
      var player = Array.from(state.players.values()).find(function (p) { return p.index === state.index; });
      if (player && player.status === 'playing') pauseSlide(state.index);
      else playSlide(state.index, true);
    }, CONFIG.doubleTapMs + 20);
  }

  function showHeart(x, y) {
    var heart = document.createElement('div');
    heart.className = 'pv-heart-burst';
    heart.textContent = '♥';
    heart.style.left = x + 'px';
    heart.style.top = y + 'px';
    state.root.appendChild(heart);
    setTimeout(function () { heart.remove(); }, 760);
  }

  function voteStore() { return safeJsonGet('pv-vote-state', {}); }
  function readVote(pid, tid) {
    var s = voteStore();
    if (pid && s['pid:' + pid] !== undefined) return !!s['pid:' + pid];
    if (tid && s['tid:' + tid] !== undefined) return !!s['tid:' + tid];
    return false;
  }
  function writeVote(pid, tid, voted) {
    var s = voteStore();
    if (pid) s['pid:' + pid] = !!voted;
    if (tid) s['tid:' + tid] = !!voted;
    safeJsonSet('pv-vote-state', s);
  }

  function toggleLike(item, slide, optimistic, point) {
    if (!isLoggedIn()) return alertError(TEXT.loginFirst);
    hydrateTopic(state.list.indexOf(item)).then(function () {
      if (!item.pid) return alertError(TEXT.likeFail);
      var old = !!item.viewer.liked;
      var next = !old;
      item.viewer.liked = next;
      item.counts.likes = Math.max(0, Number(item.counts.likes || 0) + (next ? 1 : -1));
      writeVote(item.pid, item.tid, next);
      updateLikeUi(slide, item);
      if (point && next) showHeart(point.x, point.y);
      apiFetch('/api/v3/posts/' + encodeURIComponent(item.pid) + '/vote', {
        method: next ? 'PUT' : 'DELETE',
        headers: { 'content-type': 'application/json; charset=utf-8', 'x-csrf-token': csrfToken() },
        body: JSON.stringify({ delta: 1 })
      }).catch(function () {
        item.viewer.liked = old;
        item.counts.likes = Math.max(0, Number(item.counts.likes || 0) + (next ? -1 : 1));
        writeVote(item.pid, item.tid, old);
        updateLikeUi(slide, item);
        alertError(next ? TEXT.likeFail : TEXT.unlikeFail);
      });
    });
  }

  function updateLikeUi(slide, item) {
    if (!slide) return;
    var btn = $('.pv-like', slide);
    if (!btn) return;
    btn.classList.toggle('is-active', !!item.viewer.liked);
    $('.pv-action-icon', btn).textContent = iconHeart(!!item.viewer.liked);
    $('span:last-child', btn).textContent = formatCount(item.counts.likes);
  }

  function followStore() { return safeJsonGet('pv-follow-state', {}); }
  function readFollow(author) {
    if (!author) return false;
    var s = followStore();
    if (author.uid && s['uid:' + author.uid] !== undefined) return !!s['uid:' + author.uid];
    if (author.userslug && s['slug:' + String(author.userslug).toLowerCase()] !== undefined) return !!s['slug:' + String(author.userslug).toLowerCase()];
    return false;
  }
  function writeFollow(author, following) {
    var s = followStore();
    if (author.uid) s['uid:' + author.uid] = !!following;
    if (author.userslug) s['slug:' + String(author.userslug).toLowerCase()] = !!following;
    safeJsonSet('pv-follow-state', s);
  }
  function toggleFollow(item, slide) {
    if (!isLoggedIn()) return alertError(TEXT.loginFirst);
    var author = item.author || {};
    if (!author.uid) return alertError(TEXT.followFail);
    var old = readFollow(author);
    var next = !old;
    writeFollow(author, next);
    updateFollowUi(slide, next);
    apiFetch('/api/v3/users/' + encodeURIComponent(author.uid) + '/follow', {
      method: next ? 'PUT' : 'DELETE',
      headers: { 'x-csrf-token': csrfToken() }
    }).then(function () { alertSuccess(next ? TEXT.followed : TEXT.unfollowed); })
      .catch(function () { writeFollow(author, old); updateFollowUi(slide, old); alertError(next ? TEXT.followFail : TEXT.unfollowFail); });
  }
  function updateFollowUi(slide, following) {
    var btn = $('.pv-follow-plus', slide);
    if (!btn) return;
    btn.classList.toggle('is-following', !!following);
    btn.textContent = following ? '✓' : '+';
  }

  function shareItem(item) {
    var url = location.origin + item.href;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () { alertSuccess(TEXT.shareOk); }).catch(function () { alertError(TEXT.shareFail); });
    } else {
      window.prompt('复制链接', url);
    }
  }

  function openViewer(images, index) {
    if (!images || !images.length) return;
    state.viewer.images = images.slice(0, CONFIG.imageMax);
    state.viewer.index = Math.max(0, Math.min(state.viewer.images.length - 1, Number(index || 0)));
    var viewer = $('.pv-viewer', state.root);
    viewer.classList.add('is-open');
    updateViewer();
  }
  function updateViewer() {
    var viewer = $('.pv-viewer', state.root);
    var img = $('.pv-viewer-img', viewer);
    var count = $('.pv-viewer-count', viewer);
    img.src = state.viewer.images[state.viewer.index] || '';
    count.textContent = (state.viewer.index + 1) + '/' + state.viewer.images.length;
  }
  function closeViewer() { $('.pv-viewer', state.root).classList.remove('is-open'); }
  function moveViewer(delta) {
    if (!state.viewer.images.length) return;
    state.viewer.index = Math.max(0, Math.min(state.viewer.images.length - 1, state.viewer.index + delta));
    updateViewer();
  }

  function getTranslateSettings() {
    return Object.assign({ sourceLang: 'auto', targetLang: (navigator.language || 'zh-CN').split('-')[0] || 'zh' }, safeJsonGet('pv-translate-settings', {}));
  }
  function translateCacheKey(text) {
    var s = getTranslateSettings();
    return 'pv-tr:' + s.sourceLang + ':' + s.targetLang + ':' + encodeURIComponent(norm(text)).slice(0, 240);
  }
  function translateText(text) {
    var clean = cleanDisplayText(text).replace(/https?:\/\/\S+/g, '').trim();
    if (!clean) return Promise.resolve('');
    var key = translateCacheKey(clean);
    var cached = safeJsonGet(key, null);
    if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.text || '');
    var settings = getTranslateSettings();
    var url = 'https://translate.googleapis.com/translate_a/single?' + new URLSearchParams({ client: 'gtx', sl: settings.sourceLang || 'auto', tl: settings.targetLang || 'zh', dt: 't', q: clean }).toString();
    return fetch(url, { credentials: 'omit', cache: 'force-cache' }).then(function (res) {
      if (!res.ok) throw new Error('translate ' + res.status);
      return res.json();
    }).then(function (data) {
      var parts = Array.isArray(data && data[0]) ? data[0] : [];
      var out = parts.map(function (p) { return p && p[0] ? p[0] : ''; }).join('');
      out = norm(out);
      if (out) safeJsonSet(key, { text: out, expiresAt: Date.now() + CONFIG.translateCacheMs });
      return out;
    });
  }
  function translateSlide(item, slide) {
    var box = $('.pv-translated', slide);
    var btn = $('.pv-translate-btn', slide);
    if (!box || !btn) return;
    if (box.classList.contains('is-show') && box.dataset.loaded === '1') { box.classList.remove('is-show'); return; }
    box.classList.add('is-show');
    box.textContent = TEXT.translating;
    translateText(item.text || item.title).then(function (out) {
      box.textContent = out || '';
      box.dataset.loaded = out ? '1' : '0';
      if (!out) box.classList.remove('is-show');
    }).catch(function () { box.textContent = TEXT.translateFail; });
  }
  function openTranslateSettings() {
    var panel = $('.pv-translate-panel', state.root);
    var backdrop = $('.pv-modal-backdrop', state.root);
    var s = getTranslateSettings();
    $('[name="sourceLang"]', panel).value = s.sourceLang || 'auto';
    $('[name="targetLang"]', panel).value = s.targetLang || 'zh';
    panel.classList.add('is-open');
    backdrop.classList.add('is-open');
  }
  function closeTranslateSettings() {
    $('.pv-translate-panel', state.root).classList.remove('is-open');
    $('.pv-modal-backdrop', state.root).classList.remove('is-open');
  }

  function openComments(item) {
    state.comments.item = item;
    var panel = $('.pv-comments-panel', state.root);
    $('.pv-drawer-backdrop', state.root).classList.add('is-open');
    panel.classList.add('is-open');
    $('.pv-comments-title', panel).textContent = TEXT.comments + ' ' + formatCount(item.counts.comments);
    $('.pv-comments-list', panel).innerHTML = '<div class="pv-meta">加载中...</div>';
    apiFetch('/api/topic/' + encodeURIComponent(item.tid)).then(function (json) {
      var posts = Array.isArray(json.posts) ? json.posts.slice(1) : [];
      renderComments(posts);
    }).catch(function () { $('.pv-comments-list', panel).innerHTML = '<div class="pv-meta">加载失败，<a href="' + item.href + '">' + TEXT.openTopic + '</a></div>'; });
  }
  function closeComments() {
    $('.pv-comments-panel', state.root).classList.remove('is-open');
    $('.pv-drawer-backdrop', state.root).classList.remove('is-open');
  }
  function renderComments(posts) {
    var list = $('.pv-comments-list', state.root);
    if (!posts.length) { list.innerHTML = '<div class="pv-meta">暂无评论</div>'; return; }
    list.innerHTML = posts.map(function (post) {
      var user = normalizeAuthor(post.user || post, {});
      var content = post.content || post.raw || '';
      var div = document.createElement('div'); div.innerHTML = content;
      var text = div.textContent || content;
      var avatar = user.picture ? '<img src="' + escapeHtml(user.picture) + '" alt="avatar">' : '<img alt="avatar">';
      return '<div class="pv-comment">' + avatar + '<div><div class="pv-comment-name">' + escapeHtml(user.username || '用户') + '</div><div class="pv-comment-text">' + escapeHtml(text) + '</div></div></div>';
    }).join('');
  }
  function submitComment() {
    var item = state.comments.item;
    var input = $('.pv-comment-input', state.root);
    var text = norm(input.value);
    if (!item || !text) return;
    if (!isLoggedIn()) return alertError(TEXT.loginFirst);
    var btn = $('.pv-comment-submit', state.root);
    btn.disabled = true;
    apiFetch('/api/v3/topics/' + encodeURIComponent(item.tid), {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8', 'x-csrf-token': csrfToken() },
      body: JSON.stringify({ content: text })
    }).then(function () {
      input.value = '';
      item.counts.comments += 1;
      updateSlide(state.list.indexOf(item));
      openComments(item);
    }).catch(function () {
      alertError(TEXT.commentFail);
      window.open(item.href, '_blank');
    }).finally(function () { btn.disabled = false; });
  }

  function showComposeFabInitial() {
    var fab = $('.pv-compose-fab', state.root);
    if (!fab) return;
    fab.classList.remove('is-hidden', 'is-collapsed');
    clearTimeout(state.idleFabTimer);
  }
  function hideComposerFab() {
    var fab = $('.pv-compose-fab', state.root);
    if (!fab) return;
    fab.classList.add('is-hidden');
    fab.classList.remove('is-collapsed');
    clearTimeout(state.idleFabTimer);
  }
  function openCompose() {
    pauseSlide(state.index);
    $('.pv-drawer-backdrop', state.root).classList.add('is-open');
    $('.pv-compose-panel', state.root).classList.add('is-open');
    hideComposerFab();
  }
  function closeCompose() {
    $('.pv-compose-panel', state.root).classList.remove('is-open');
    $('.pv-drawer-backdrop', state.root).classList.remove('is-open');
    showComposeFabInitial();
  }
  function resetCompose() {
    var p = $('.pv-compose-panel', state.root);
    $('textarea', p).value = '';
    setPendingImages([]);
    setPendingVoice(null, 0);
    $('.pv-meta', p).textContent = '';
  }
  function setPendingImages(files) {
    state.compose.imageUrls.forEach(function (url) { URL.revokeObjectURL(url); });
    var list = Array.from(files || []).filter(function (f) { return /^image\//i.test(f.type); }).slice(0, CONFIG.imageMax);
    state.compose.imageFiles = list;
    state.compose.imageUrls = list.map(function (f) { return URL.createObjectURL(f); });
    var box = $('.pv-preview-images', state.root);
    box.innerHTML = state.compose.imageUrls.map(function (u) { return '<img src="' + u + '" alt="preview">'; }).join('');
  }
  function setPendingVoice(blob, duration) {
    if (state.compose.voiceUrl) URL.revokeObjectURL(state.compose.voiceUrl);
    state.compose.voiceBlob = blob || null;
    state.compose.voiceDuration = Math.max(0, Math.round(Number(duration) || 0));
    state.compose.voiceUrl = blob ? URL.createObjectURL(blob) : '';
    var meta = $('.pv-compose-panel .pv-meta', state.root);
    if (blob) meta.textContent = TEXT.voiceMsg + ' ' + formatDuration(state.compose.voiceDuration);
  }
  function uploadToNodeBB(file) {
    var form = new FormData();
    form.append('files[]', file);
    form.append('cid', String(CONFIG.cid));
    return fetch(rel('/api/post/upload'), { method: 'POST', credentials: 'same-origin', headers: { 'x-csrf-token': csrfToken(), 'x-requested-with': 'XMLHttpRequest' }, body: form })
      .then(function (res) { return res.json().catch(function () { return {}; }).then(function (json) { if (!res.ok) throw new Error(json.error || json.message || 'upload failed'); return extractUploadUrl(json); }); });
  }
  function extractUploadUrl(payload) {
    var q = [payload], seen = new Set();
    while (q.length) {
      var cur = q.shift();
      if (!cur || seen.has(cur)) continue;
      if (typeof cur === 'string' && (/^(https?:)?\//i.test(cur) || /^\/assets\//i.test(cur))) return cur;
      if (typeof cur !== 'object') continue;
      seen.add(cur);
      if (Array.isArray(cur)) q.push.apply(q, cur);
      else Object.keys(cur).forEach(function (k) { q.push(cur[k]); });
    }
    throw new Error('upload url missing');
  }
  function buildTitle(text) {
    var clean = norm(stripTikTokUrls(text).replace(/!\[[^\]]*\]\([^)]+\)/g, '').replace(/\[[^\]]*\]\([^)]+\)/g, ''));
    return clean ? clean.slice(0, 80) : '新动态';
  }
  function appendDurationParam(url, seconds) {
    try { var u = new URL(url, location.origin); u.searchParams.set('haa8dur', String(Math.max(1, seconds || 1))); return u.origin === location.origin ? u.pathname + u.search + u.hash : u.toString(); }
    catch (e) { return url + (String(url).indexOf('?') === -1 ? '?' : '&') + 'haa8dur=' + encodeURIComponent(seconds || 1); }
  }
  function sendTopic() {
    if (!isLoggedIn()) return alertError(TEXT.loginFirst);
    var panel = $('.pv-compose-panel', state.root);
    var textarea = $('textarea', panel);
    var text = norm(textarea.value);
    if (!text && !state.compose.imageFiles.length && !state.compose.voiceBlob) return alertError(TEXT.enterSomething);
    var btn = $('.pv-compose-submit', panel);
    var meta = $('.pv-meta', panel);
    btn.disabled = true; btn.textContent = TEXT.publishing;
    var lines = [];
    if (text) lines.push(text);
    Promise.resolve().then(function () {
      if (!state.compose.voiceBlob) return;
      meta.textContent = TEXT.uploadVoice;
      var ext = /ogg/i.test(state.compose.voiceBlob.type) ? 'ogg' : 'webm';
      var file = new File([state.compose.voiceBlob], 'voice-' + Date.now() + '.' + ext, { type: state.compose.voiceBlob.type || 'audio/webm' });
      return uploadToNodeBB(file).then(function (url) { lines.push('[' + TEXT.voiceMsg + ' · ' + formatDuration(state.compose.voiceDuration || 1) + '](' + appendDurationParam(url, state.compose.voiceDuration || 1) + ')'); });
    }).then(function () {
      var p = Promise.resolve();
      state.compose.imageFiles.forEach(function (file, i) {
        p = p.then(function () { meta.textContent = TEXT.uploadImage + ' ' + (i + 1) + '/' + state.compose.imageFiles.length; return uploadToNodeBB(file).then(function (url) { lines.push('![image](' + url + ')'); }); });
      });
      return p;
    }).then(function () {
      return apiFetch('/api/v3/topics', {
        method: 'POST',
        headers: { 'content-type': 'application/json; charset=utf-8', 'x-csrf-token': csrfToken() },
        body: JSON.stringify({ cid: Number(CONFIG.cid), title: buildTitle(text), content: lines.join('\n\n'), tags: [] })
      });
    }).then(function () {
      alertSuccess(TEXT.publishOk);
      resetCompose(); closeCompose();
      loadFeed(true);
    }).catch(function (err) { console.warn(err); alertError(err.message || TEXT.publishFail); })
      .finally(function () { btn.disabled = false; btn.textContent = TEXT.send; meta.textContent = ''; });
  }
  function recorderMime() {
    if (!window.MediaRecorder) return '';
    return ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg'].find(function (t) { return MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t); }) || '';
  }
  function toggleRecording() {
    var btn = $('.pv-record-btn', state.root);
    if (state.compose.mediaRecorder && state.compose.mediaRecorder.state === 'recording') { stopRecording(false); return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) return alertError('当前浏览器不支持录音');
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      state.compose.stream = stream;
      state.compose.chunks = [];
      state.compose.startAt = Date.now();
      var mime = recorderMime();
      var rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      state.compose.mediaRecorder = rec;
      rec.ondataavailable = function (e) { if (e.data && e.data.size) state.compose.chunks.push(e.data); };
      rec.onstop = function () {
        var dur = Math.max(1, Math.round((Date.now() - state.compose.startAt) / 1000));
        if (state.compose.stream) state.compose.stream.getTracks().forEach(function (t) { t.stop(); });
        clearInterval(state.compose.timer);
        btn.textContent = TEXT.record;
        if (state.compose.chunks.length) setPendingVoice(new Blob(state.compose.chunks, { type: state.compose.chunks[0].type || mime || 'audio/webm' }), dur);
      };
      rec.start(250);
      btn.textContent = TEXT.stop;
      state.compose.timer = setInterval(function () { $('.pv-compose-panel .pv-meta', state.root).textContent = TEXT.voiceMsg + ' ' + formatDuration(Math.floor((Date.now() - state.compose.startAt) / 1000)); }, 250);
    }).catch(function () { alertError('麦克风权限未开启'); });
  }
  function stopRecording(silent) {
    var rec = state.compose.mediaRecorder;
    if (rec && rec.state === 'recording') { try { rec.stop(); } catch (e) {} }
    if (state.compose.stream) state.compose.stream.getTracks().forEach(function (t) { t.stop(); });
    clearInterval(state.compose.timer);
    if (!silent) $('.pv-record-btn', state.root).textContent = TEXT.record;
  }

  function buildChrome() {
    state.root.innerHTML = html`
      <div class="pv-page pv-page-active">
        <div class="pv-stage"><div class="pv-slide-list"></div></div>
        <button type="button" class="pv-compose-fab">${TEXT.publish}</button>
        <div class="pv-drawer-backdrop"></div>
        <div class="pv-modal-backdrop"></div>
        <section class="pv-compose-panel" role="dialog">
          <div class="pv-panel-head"><div class="pv-panel-title">${TEXT.publish}</div><button type="button" class="pv-close pv-compose-close">×</button></div>
          <textarea placeholder="${TEXT.placeholder}"></textarea>
          <div class="pv-preview-images"></div>
          <div class="pv-compose-tools">
            <input type="file" class="pv-image-input" accept="image/*" multiple hidden>
            <button type="button" class="pv-tool pv-image-btn">${TEXT.chooseImage}</button>
            <button type="button" class="pv-tool pv-record-btn">${TEXT.record}</button>
            <button type="button" class="pv-primary pv-compose-submit">${TEXT.send}</button>
          </div>
          <div class="pv-meta"></div>
        </section>
        <section class="pv-comments-panel" role="dialog">
          <div class="pv-panel-head"><div class="pv-panel-title pv-comments-title">${TEXT.comments}</div><button type="button" class="pv-close pv-comments-close">×</button></div>
          <div class="pv-comments-list"></div>
          <div class="pv-comment-send-row"><input class="pv-comment-input" placeholder="${TEXT.commentPlaceholder}"><button type="button" class="pv-primary pv-comment-submit">发送</button></div>
        </section>
        <section class="pv-translate-panel" role="dialog">
          <div class="pv-panel-head"><div class="pv-panel-title">${TEXT.translateSettings}</div><button type="button" class="pv-close pv-translate-close">×</button></div>
          <label>${TEXT.sourceLang}<select name="sourceLang"><option value="auto">${TEXT.auto}</option><option value="zh">中文</option><option value="en">English</option><option value="my">မြန်မာ / 缅语</option><option value="th">ไทย</option><option value="vi">Tiếng Việt</option><option value="km">ភាសាខ្មែរ</option><option value="lo">ລາວ</option><option value="ja">日本語</option><option value="ko">한국어</option><option value="ms">Malay</option><option value="tl">Tagalog</option></select></label>
          <label>${TEXT.targetLang}<select name="targetLang"><option value="zh">中文</option><option value="en">English</option><option value="my">မြန်မာ / 缅语</option><option value="th">ไทย</option><option value="vi">Tiếng Việt</option><option value="km">ភាសាខ្មែរ</option><option value="lo">ລາວ</option><option value="ja">日本語</option><option value="ko">한국어</option><option value="ms">Malay</option><option value="tl">Tagalog</option></select></label>
          <div class="pv-translate-actions"><button type="button" class="pv-primary pv-translate-save">${TEXT.save}</button></div>
        </section>
        <div class="pv-viewer"><img class="pv-viewer-img" alt="image"><div class="pv-viewer-count">1/1</div><button class="pv-viewer-zone pv-viewer-prev"></button><button class="pv-viewer-zone pv-viewer-next"></button><button class="pv-viewer-close">点击退出</button></div>
      </div>`;
    state.stage = $('.pv-stage', state.root);
    state.listEl = $('.pv-slide-list', state.root);
    bindChrome();
  }

  function bindChrome() {
    $('.pv-compose-fab', state.root).addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); openCompose(); });
    $('.pv-compose-close', state.root).addEventListener('click', closeCompose);
    $('.pv-drawer-backdrop', state.root).addEventListener('click', function () { closeCompose(); closeComments(); });
    $('.pv-image-btn', state.root).addEventListener('click', function () { $('.pv-image-input', state.root).click(); });
    $('.pv-image-input', state.root).addEventListener('change', function (e) {
      var files = Array.from(e.target.files || []).slice(0, CONFIG.imageMax);
      e.target.value = '';
      if (files.find(function (f) { return !/^image\//i.test(f.type); })) return alertError(TEXT.imageOnly);
      setPendingImages(files);
    });
    $('.pv-record-btn', state.root).addEventListener('click', toggleRecording);
    $('.pv-compose-submit', state.root).addEventListener('click', sendTopic);
    $('.pv-comments-close', state.root).addEventListener('click', closeComments);
    $('.pv-comment-submit', state.root).addEventListener('click', submitComment);
    $('.pv-comment-input', state.root).addEventListener('keydown', function (e) { if (e.key === 'Enter') submitComment(); });
    $('.pv-translate-close', state.root).addEventListener('click', closeTranslateSettings);
    $('.pv-modal-backdrop', state.root).addEventListener('click', closeTranslateSettings);
    $('.pv-translate-save', state.root).addEventListener('click', function () {
      var p = $('.pv-translate-panel', state.root);
      safeJsonSet('pv-translate-settings', { sourceLang: $('[name="sourceLang"]', p).value, targetLang: $('[name="targetLang"]', p).value });
      closeTranslateSettings();
    });
    var viewer = $('.pv-viewer', state.root);
    $('.pv-viewer-prev', viewer).addEventListener('click', function (e) { e.stopPropagation(); moveViewer(-1); });
    $('.pv-viewer-next', viewer).addEventListener('click', function (e) { e.stopPropagation(); moveViewer(1); });
    $('.pv-viewer-close', viewer).addEventListener('click', closeViewer);
    viewer.addEventListener('pointerdown', function (e) { state.viewer.down = true; state.viewer.startX = e.clientX; state.viewer.startY = e.clientY; });
    viewer.addEventListener('pointerup', function (e) {
      if (!state.viewer.down) return; state.viewer.down = false;
      var dx = e.clientX - state.viewer.startX; var dy = e.clientY - state.viewer.startY;
      if (Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy) * 1.1) moveViewer(dx < 0 ? 1 : -1);
      else if (dy > 66 && Math.abs(dy) > Math.abs(dx)) closeViewer();
    });
    window.addEventListener('resize', function () {
      clearTimeout(state.resizeTimer);
      state.resizeTimer = setTimeout(function () { renderWindow(true); setTrackTransform(slideOffset(state.index), false); }, 120);
    });
    document.addEventListener('visibilitychange', function () { if (document.hidden) pauseSlide(state.index); else activateCurrent(); });
  }

  function showEmpty(text) {
    if (!state.root) return;
    var old = $('.pv-empty-page', state.root); if (old) old.remove();
    var div = document.createElement('div'); div.className = 'pv-empty-page'; div.textContent = text || TEXT.empty;
    state.root.appendChild(div);
  }

  function init() {
    state.root = document.getElementById('peipe-video-app');
    if (!state.root) return;
    document.body.classList.add('pv-video-mode');
    addPreconnects();
    buildChrome();
    showComposeFabInitial();
    loadFeed(true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
