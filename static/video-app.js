/* Peipe /video mobile discover page v9
 * Independent /video page, NodeBB category feed, TikTok official iframe, custom vertical virtual slider.
 */
(function () {
  'use strict';
  if (window.__peipeVideoDiscoverV9) return;
  window.__peipeVideoDiscoverV9 = true;

  var CONFIG = Object.assign({
    cid: 6,
    pageSize: 12,
    preloadAhead: 14,
    preloadVideoAhead: 5,
    imageMax: 4,
    voiceMaxSeconds: 120,
    coverCacheMs: 7 * 24 * 60 * 60 * 1000,
    translateCacheMs: 3 * 24 * 60 * 60 * 1000,
    doubleTapMs: 280,
    slideThreshold: 34,
    slideFlickMs: 260,
    slideFlickDistance: 20
  }, window.PEIPE_VIDEO_CONFIG || {});

  var TEXT = {
    loading: '视频内容源自 TikTok，版权归原作者及 TikTok 所有。\n如果无法播放请开启 VPN，如有侵权内容，请及时联系本站管理员删除。',
    sourceNotice: '视频内容源自 TikTok，版权归原作者及 TikTok 所有。\n如果无法播放请开启 VPN，如有侵权内容，请及时联系本站管理员删除。',
    empty: '还没有可浏览的内容',
    publish: '发布',
    publishing: '发布中...',
    publishOk: '发布成功',
    publishFail: '发布失败',
    placeholder: '粘贴 TikTok 链接，一键转视频播放。也可以写点文字。',
    chooseImage: '图片',
    send: '发布',
    imageOnly: '请选择图片',
    uploadImage: '上传图片',
    enterSomething: '请输入内容、TikTok 链接或图片',
    comments: '评论',
    commentPlaceholder: '发送消息...',
    replyTo: '回复',
    cancelReply: '取消回复',
    commentFail: '评论失败',
    loginFirst: '请先登录',
    followFail: '关注失败',
    unfollowFail: '取消关注失败',
    followed: '已关注',
    unfollowed: '已取消关注',
    likeFail: '点赞失败',
    unlikeFail: '取消点赞失败',
    translate: '翻译',
    translating: '翻译中...',
    translateFail: '翻译失败',
    translateSettings: '翻译设置',
    sourceLang: '源语言',
    targetLang: '目标语言',
    save: '保存',
    auto: '自动',
    voiceMsg: '语音消息',
    noComments: '暂无评论',
    provider: '翻译方式',
    google: '谷歌翻译',
    ai: 'AI 翻译',
    aiEndpoint: 'AI 接口',
    aiModel: '模型',
    aiApiKey: '密钥',
    aiPrompt: '提示词',
    recordUnsupported: '当前浏览器不支持录音',
    micDenied: '麦克风权限未开启',
    recording: '录音中',
    stopRecord: '结束录音',
    deleteVideo: '删除视频',
    deleteConfirm: '确定删除这条视频动态？',
    deleteOk: '已删除',
    deleteFail: '删除失败'
  };
  Object.assign(TEXT, window.PEIPE_VIDEO_TEXT || {});

  var RE = {
    tiktokGlobal: /https?:\/\/(?:www\.)?tiktok\.com\/@[^/\s<>'"]+\/video\/(\d+)(?:\?[^\s<>'"]*)?/ig,
    tiktokOne: /https?:\/\/(?:www\.)?tiktok\.com\/@([^/\s<>'"]+)\/video\/(\d+)/i,
    tiktokToken: /(?:https?[-:\/]+)?(?:www[.-])?tiktok[.-]com[-\/\w@.%=&?]+/ig,
    tiktokShort: /https?:\/\/(?:vt|vm)\.tiktok\.com\/[^\s<>'"]+/ig,
    audioExt: /\.(m4a|mp3|wav|ogg|oga|webm|aac)(?:[?#].*)?$/i
  };

  var state = {
    root: null,
    list: [],
    feedPage: 1,
    feedLoading: false,
    feedDone: false,
    index: 0,
    players: new Map(),
    imageIndex: new Map(),
    hasInteracted: false,
    soundUnlocked: safeJsonGet('pv-sound-unlocked', false) === true,
    lastTap: { time: 0, x: 0, y: 0, timer: 0 },
    drag: { active: false, startX: 0, startY: 0, dx: 0, dy: 0, startTime: 0, locked: '' },
    compose: { imageFiles: [], imageUrls: [] },
    viewer: { images: [], index: 0, startX: 0, startY: 0, down: false },
    comments: {
      item: null,
      posts: [],
      replyTo: null,
      voiceBlob: null,
      voiceUrl: '',
      voiceDuration: 0,
      mediaRecorder: null,
      stream: null,
      chunks: [],
      startAt: 0,
      timer: 0,
      sendAfterStop: false,
      dragY: 0,
      dragStartY: 0,
      dragging: false,
      dragCandidate: false
    },
    translateLongPressTimer: 0,
    manageItem: null
  };

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function norm(v) { return String(v || '').replace(/\s+/g, ' ').trim(); }
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
  function escapeHtml(input) {
    return String(input || '').replace(/[&<>'"]/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[ch];
    });
  }
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
    var t = Date.parse(s);
    return Number.isNaN(t) ? 0 : t;
  }
  function relativeTime(value) {
    var t = parseTime(value);
    if (!t) return '';
    var diff = Math.max(0, Date.now() - t);
    var m = 60000, h = 60 * m, d = 24 * h, mo = 30 * d, y = 365 * d;
    if (diff >= y) return Math.floor(diff / y) + '年前';
    if (diff >= mo) return Math.floor(diff / mo) + '个月前';
    if (diff >= d) return Math.floor(diff / d) + '天前';
    if (diff >= h) return Math.floor(diff / h) + '小时前';
    if (diff >= m) return Math.max(1, Math.floor(diff / m)) + '分钟前';
    return '刚刚';
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
        return json.response || json;
      });
    });
  }
  function cleanDisplayText(text) {
    var lines = String(text || '')
      .replace(RE.tiktokGlobal, '')
      .replace(RE.tiktokShort, '')
      .replace(RE.tiktokToken, '')
      .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
      .replace(/\[\s*(?:语音消息|语音动态|voice\s*message|audio\s*message)[^\]]*\]\([^)]+\)/ig, '')
      .split(/[\r\n]+/)
      .map(norm)
      .filter(function (line) { return line && !isAutoText(line); });
    return lines.join('\n');
  }
  function isAutoText(text) {
    var clean = norm(String(text || '').replace(/[•・·|｜_／/\\-]+/g, ' '));
    if (!clean) return true;
    if (/^https?:\/\/(?:vt|vm|www\.)?tiktok\./i.test(clean)) return true;
    return /^(?:动态|新动态|图片分享|图片动态|语音消息|语音动态|voice message|audio message|image|photo|picture)(?:\s*:?\s*\d{1,2}:\d{2}(?::\d{2})?)?$/i.test(clean);
  }
  function displayText(item) { return cleanDisplayText(item && (item.text || item.title || '')); }
  function authorHref(author) { return author && author.userslug ? rel('/user/' + encodeURIComponent(author.userslug)) : '#'; }
  function avatarSrc(author) { return author && author.picture ? author.picture : ''; }
  function canonicalTikTokUrl(url) {
    var m = String(url || '').replace(/&amp;/g, '&').match(RE.tiktokOne);
    return m ? 'https://www.tiktok.com/@' + m[1] + '/video/' + m[2] : String(url || '');
  }

  function addPreconnects() {
    ['https://www.tiktok.com', 'https://www.tiktokcdn.com'].forEach(function (href) {
      if (document.querySelector('link[rel="preconnect"][href="' + href + '"]')) return;
      var link = document.createElement('link'); link.rel = 'preconnect'; link.href = href; link.crossOrigin = 'anonymous'; document.head.appendChild(link);
      var dns = document.createElement('link'); dns.rel = 'dns-prefetch'; dns.href = href; document.head.appendChild(dns);
    });
  }

  function loadFeed(refresh) {
    if (state.feedLoading || (state.feedDone && !refresh)) return Promise.resolve();
    state.feedLoading = true;
    if (refresh) {
      state.feedPage = 1; state.feedDone = false; state.list = []; state.index = 0;
      state.players.forEach(function (p) { try { p.iframe.remove(); } catch (e) {} });
      state.players.clear();
      renderWindow();
    }
    var page = state.feedPage;
    return apiFetch('/api/v3/plugins/peipe-video/feed?page=' + page + '&pageSize=' + CONFIG.pageSize)
      .then(function (payload) {
        var items = (payload.items || []).map(function (item) {
          item.images = (item.images || []).slice(0, CONFIG.imageMax);
          item.viewer = item.viewer || { liked: false, following: false, canManage: false };
          item.counts = item.counts || { likes: 0, comments: 0 };
          item.text = displayText(item);
          item.title = cleanDisplayText(item.title || '');
          return item;
        }).filter(function (item) { return (item.tiktoks && item.tiktoks.length) || (item.images && item.images.length); });
        state.list = refresh ? items : state.list.concat(items);
        state.feedDone = payload.hasMore === false || !items.length;
        state.feedPage += 1;
        renderWindow();
        if (!state.list.length) showEmpty(TEXT.empty);
      })
      .catch(function (err) { console.error('[peipe-video] feed failed', err); showEmpty(err.message || TEXT.empty); })
      .finally(function () { state.feedLoading = false; });
  }

  function renderWindow() {
    var wrap = $('.pv-slide-list', state.root);
    if (!wrap) return;
    var start = Math.max(0, state.index - 2);
    var end = Math.min(state.list.length, state.index + 7);
    var html = [];
    for (var i = start; i < end; i += 1) html.push(renderSlideHtml(state.list[i], i));
    wrap.innerHTML = html.join('');
    applySlideTransform(0, false);
    afterRenderWindow();
  }
  function applySlideTransform(offsetPx, animate) {
    var wrap = $('.pv-slide-list', state.root);
    if (!wrap) return;
    wrap.style.transitionDuration = animate ? '260ms' : '0ms';
    wrap.style.transform = 'translate3d(0, calc(' + (-state.index * 100) + 'dvh + ' + Math.round(offsetPx || 0) + 'px), 0)';
  }
  function afterRenderWindow() {
    $$('.pv-slide-item', state.root).forEach(function (slide) {
      var idx = Number(slide.dataset.index || -1);
      slide.classList.toggle('is-active', idx === state.index);
      prepareSlide(idx, false);
    });
    preloadNextVideos(state.index);
    initImageCarousels();
    activateCurrent(false);
  }

  function renderSlideHtml(item, index) {
    item = item || {};
    var author = item.author || {};
    var text = displayText(item);
    var hasText = !!text;
    var hasVideo = !!(item.tiktoks && item.tiktoks[0]);
    var images = (item.images || []).slice(0, CONFIG.imageMax);
    var mediaHtml = hasVideo ? '<div class="pv-video-shell"></div>' : (images.length ? renderImageMain(item, index) : '<div class="pv-empty-media"></div>');
    var avatar = avatarSrc(author);
    var avatarHtml = avatar ? '<img class="pv-avatar" src="' + escapeHtml(avatar) + '" alt="avatar">' : '<div class="pv-avatar"></div>';
    var following = !!(readFollow(author) || item.viewer.following);
    var liked = !!(readVote(item.pid, item.tid) || item.viewer.liked);
    return '' +
      '<section class="pv-slide-item ' + (hasVideo ? 'is-video' : 'is-image') + '" data-index="' + index + '" data-tid="' + escapeHtml(item.tid || '') + '" style="transform:translate3d(0,' + (index * 100) + 'dvh,0)">' +
        '<div class="pv-media">' + mediaHtml + '</div>' +
        (hasVideo ? '<div class="pv-cover"><img alt="cover"></div><div class="pv-gesture-layer" data-index="' + index + '"></div>' : '') +
        '<div class="pv-gradient"></div>' +
        '<div class="pv-toolbar">' +
          '<div class="pv-avatar-wrap"><a href="' + authorHref(author) + '">' + avatarHtml + '</a>' +
            (author.uid && !isOwnAuthor(author) ? '<button type="button" class="pv-follow-plus ' + (following ? 'is-following' : '') + '" data-index="' + index + '">' + (following ? '✓' : '+') + '</button>' : '') + '</div>' +
          '<button type="button" class="pv-action pv-like ' + (liked ? 'is-active' : '') + '" data-index="' + index + '"><span class="pv-action-icon">' + iconHeart(liked) + '</span><span>' + formatCount(item.counts.likes) + '</span></button>' +
          '<button type="button" class="pv-action pv-comment-btn" data-index="' + index + '"><span class="pv-action-icon">' + iconComment() + '</span><span>' + formatCount(item.counts.comments) + '</span></button>' +
          (images.length && hasVideo ? '<button type="button" class="pv-action pv-album-btn" data-index="' + index + '"><span class="pv-action-icon">' + iconPhoto() + '</span><span>' + images.length + '</span></button>' : '') +
          ((item.viewer && item.viewer.canManage) ? '<button type="button" class="pv-action pv-manage-btn" data-index="' + index + '" aria-label="管理"><span class="pv-action-icon">' + iconTrash() + '</span></button>' : '') +
        '</div>' +
        '<div class="pv-desc">' +
          '<span class="pv-username">@' + escapeHtml(author.username || author.userslug || '用户') + '</span>' +
          (hasText ? '<div class="pv-text-row" data-index="' + index + '"><span class="pv-text-main">' + escapeHtml(text) + '</span> <button type="button" class="pv-translate-btn" data-index="' + index + '" aria-label="' + TEXT.translate + '">' + iconTranslate() + '</button></div><div class="pv-translated"></div>' : '') +
          '<div class="pv-time">' + relativeTime(item.createdAt) + '</div>' +
        '</div>' +
      '</section>';
  }
  function isOwnAuthor(author) { var me = currentUser(); return !!(me && author && String(me.uid || '') === String(author.uid || '')); }
  function iconHeart() { return '<svg class="pv-heart-svg" viewBox="0 0 48 48" aria-hidden="true"><path d="M24 41s-2.2-1.3-5.2-3.4C10.2 31.4 5 25.8 5 18.6 5 12.7 9.5 8 15.2 8c3.5 0 6.6 1.8 8.8 4.7C26.2 9.8 29.3 8 32.8 8 38.5 8 43 12.7 43 18.6c0 7.2-5.2 12.8-13.8 19C26.2 39.7 24 41 24 41z"></path></svg>'; }
  function iconComment() { return '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 7.5c-9.8 0-17.5 6.8-17.5 15.2 0 5.4 3.2 10.2 8 12.9l-.8 5.2 6.1-3.4c1.4.3 2.8.4 4.2.4 9.8 0 17.5-6.8 17.5-15.1S33.8 7.5 24 7.5z"></path><circle cx="17.4" cy="23.3" r="2.1"></circle><circle cx="24" cy="23.3" r="2.1"></circle><circle cx="30.6" cy="23.3" r="2.1"></circle></svg>'; }
  function iconTranslate() { return '<i class="fa-solid fa-language" aria-hidden="true"></i>'; }
  function iconMic() { return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3z"></path><path d="M5 11a7 7 0 0 0 14 0M12 18v3m-4 0h8"></path></svg>'; }
  function iconSend() { return '<svg class="pv-send-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h14M13 6l6 6-6 6"></path></svg>'; }
  function iconPhoto() { return '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M10 10h28a4 4 0 0 1 4 4v20a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V14a4 4 0 0 1 4-4zm5 23h18l-6-8-4 5-3-4-5 7zm2-13a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"></path></svg>'; }
  function iconTrash() { return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7l1-3h4l1 3"></path></svg>'; }

  function renderImageMain(item, index) {
    var images = (item.images || []).slice(0, CONFIG.imageMax);
    var slides = images.map(function (src, i) {
      return '<div class="pv-image-page"><img src="' + escapeHtml(src) + '" alt="image ' + (i + 1) + '"></div>';
    }).join('');
    var dots = images.length > 1 ? '<div class="pv-image-dots">' + images.map(function (_, i) { return '<i class="' + (i === 0 ? 'is-active' : '') + '"></i>'; }).join('') + '</div>' : '';
    return '<div class="pv-image-carousel" data-index="' + index + '"><div class="pv-image-track">' + slides + '</div>' + dots + '</div>';
  }
  function initImageCarousels() {
    $$('.pv-image-carousel', state.root).forEach(function (carousel) {
      if (carousel.dataset.ready) return;
      carousel.dataset.ready = '1';
      var track = $('.pv-image-track', carousel);
      var idx = Number(carousel.dataset.index || -1);
      var startX = 0, startY = 0, active = 0, dragging = false;
      carousel.addEventListener('pointerdown', function (e) { startX = e.clientX; startY = e.clientY; dragging = true; });
      carousel.addEventListener('pointerup', function (e) {
        if (!dragging) return;
        dragging = false;
        var dx = e.clientX - startX, dy = e.clientY - startY;
        if (Math.abs(dx) > 36 && Math.abs(dx) > Math.abs(dy)) {
          var pages = $$('.pv-image-page', carousel).length;
          active = Math.max(0, Math.min(pages - 1, active + (dx < 0 ? 1 : -1)));
          track.style.transform = 'translate3d(' + (-active * 100) + '%,0,0)';
          $$('.pv-image-dots i', carousel).forEach(function (dot, i) { dot.classList.toggle('is-active', i === active); });
          if (state.list[idx]) setImageIndex(state.list[idx], active);
        }
      });
    });
  }
  function setImageIndex(item, index) { var key = String(item && (item.tid || item.pid || state.list.indexOf(item)) || ''); state.imageIndex.set(key, index); }

  function buildPlayerUrl(videoId, autoplay) {
    var params = new URLSearchParams({
      autoplay: autoplay ? '1' : '0',
      muted: '0',
      loop: '1',
      rel: '0',
      controls: '1',
      progress_bar: '1',
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
  function findSlide(index) { return $('.pv-slide-item[data-index="' + index + '"]', state.root); }
  function ensureTikTokPlayer(index, autoplay) {
    var item = state.list[index];
    var slide = findSlide(index);
    if (!slide || !item || !(item.tiktoks && item.tiktoks[0])) return null;
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
    iframe.loading = 'eager';
    iframe.fetchPriority = index === state.index ? 'high' : 'low';
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
  function prepareSlide(index, autoplay) {
    if (index < 0 || index >= state.list.length) return;
    var item = state.list[index];
    if (!item || !(item.tiktoks && item.tiktoks[0])) return;
    ensureTikTokPlayer(index, !!autoplay || (state.soundUnlocked && index === state.index));
  }
  function preloadNextVideos(fromIndex) {
    var found = 0;
    var maxScan = Math.min(state.list.length - 1, fromIndex + Math.max(12, CONFIG.preloadAhead + 8));
    for (var i = Math.max(0, fromIndex); i <= maxScan && found < (CONFIG.preloadVideoAhead || 5); i += 1) {
      var it = state.list[i];
      if (it && it.tiktoks && it.tiktoks[0]) {
        prepareSlide(i, i === state.index && (state.hasInteracted || state.soundUnlocked));
        found += 1;
      }
    }
  }
  function activateCurrent(userGesture) {
    $$('.pv-slide-item', state.root).forEach(function (slide) {
      var idx = Number(slide.dataset.index || -1);
      slide.classList.toggle('is-active', idx === state.index);
      if (idx !== state.index) pauseSlide(idx);
    });
    preloadNextVideos(state.index);
    playSlide(state.index, !!userGesture || state.soundUnlocked || state.hasInteracted);
    prunePlayers();
    if (state.index >= state.list.length - 4) loadFeed(false);
  }
  function sendToPlayer(iframe, type, value) {
    if (!iframe || !iframe.contentWindow) return;
    var msg = { 'x-tiktok-player': true, type: type };
    if (arguments.length >= 3) msg.value = value;
    iframe.contentWindow.postMessage(msg, 'https://www.tiktok.com');
  }
  function hardStopPlayer(player) {
    if (!player || !player.iframe) return;
    sendToPlayer(player.iframe, 'pause');
    player.ready = false;
    player.status = 'paused';
    player.wantPlay = false;
  }
  function playSlide(index, userGesture) {
    var item = state.list[index];
    if (!item || !(item.tiktoks && item.tiktoks[0])) { preloadNextVideos(index); return; }
    var player = ensureTikTokPlayer(index, !!userGesture);
    if (!player || !player.iframe) return;
    player.wantPlay = true;
    pauseOtherPlayers(player.key);
    var slide = findSlide(index);
    if (slide) slide.classList.add('is-loading');
    if (userGesture) { state.hasInteracted = true; state.soundUnlocked = true; safeJsonSet('pv-sound-unlocked', true); }
    sendToPlayer(player.iframe, 'unMute');
    sendToPlayer(player.iframe, 'play');
    setTimeout(function () { sendToPlayer(player.iframe, 'play'); sendToPlayer(player.iframe, 'unMute'); }, 80);
    setTimeout(function () { sendToPlayer(player.iframe, 'unMute'); sendToPlayer(player.iframe, 'play'); }, 260);
    setTimeout(function () { sendToPlayer(player.iframe, 'unMute'); sendToPlayer(player.iframe, 'play'); }, 720);
  }
  function pauseSlide(index) {
    state.players.forEach(function (p) { if (p.index !== index) return; p.wantPlay = false; p.status = 'paused'; hardStopPlayer(p); });
    var slide = findSlide(index); if (slide) slide.classList.remove('is-playing', 'is-loading');
  }
  function pauseOtherPlayers(currentKey) {
    state.players.forEach(function (p, key) {
      if (key === currentKey) return;
      p.wantPlay = false; p.status = 'paused';
      if (p.iframe) sendToPlayer(p.iframe, 'pause');
      var slide = findSlide(p.index); if (slide) slide.classList.remove('is-playing', 'is-loading');
    });
  }
  function prunePlayers() {
    var keep = CONFIG.preloadAhead + 2;
    state.players.forEach(function (p, key) {
      if (Math.abs(p.index - state.index) <= keep) return;
      try { if (p.iframe) { sendToPlayer(p.iframe, 'pause'); p.iframe.src = 'about:blank'; p.iframe.remove(); } } catch (e) {}
      state.players.delete(key);
    });
  }
  function markSlidePlaying(index) {
    var slide = findSlide(index); if (!slide) return;
    var cover = $('.pv-cover', slide); if (cover) cover.classList.add('is-hidden');
    slide.classList.add('is-playing'); slide.classList.remove('is-loading');
  }
  window.addEventListener('message', function (event) {
    var data = event.data;
    if (typeof data === 'string') { try { data = JSON.parse(data); } catch (e) { return; } }
    if (!data || !data['x-tiktok-player']) return;
    var host = '';
    try { host = new URL(event.origin).hostname; } catch (e) {}
    if (!host || !/(^|\.)tiktok\.com$|(^|\.)tiktokcdn\.com$/.test(host)) return;
    state.players.forEach(function (player) {
      if (!player.iframe || player.iframe.contentWindow !== event.source) return;
      var type = String(data.type || '');
      if (type === 'onPlayerReady') { player.ready = true; if (player.wantPlay) { sendToPlayer(player.iframe, 'unMute'); sendToPlayer(player.iframe, 'play'); } return; }
      if (type === 'onMute' || type === 'onVolumeChange' || type.toLowerCase().indexOf('mute') !== -1) {
        if (data.value === false || data.value === 0 || String(data.value).toLowerCase() === 'false' || String(data.value).toLowerCase() === 'unmuted') {
          state.soundUnlocked = true; state.hasInteracted = true; safeJsonSet('pv-sound-unlocked', true);
        }
        return;
      }
      if (type === 'onStateChange') {
        var value = Number(data.value);
        var word = String(data.value || '').toLowerCase();
        if (value === 1 || word === 'playing') { player.status = 'playing'; pauseOtherPlayers(player.key); markSlidePlaying(player.index); }
        else if (value === 2 || value === 0 || word === 'paused' || word === 'ended') { player.status = 'paused'; var s = findSlide(player.index); if (s) s.classList.remove('is-playing', 'is-loading'); }
        else if (value === 3 || word === 'buffering') { var s2 = findSlide(player.index); if (s2 && player.wantPlay) s2.classList.add('is-loading'); }
      }
    });
  });
  function coverCacheKey(videoId) { return 'pv-cover:' + videoId; }
  function fetchCover(videoId, url) {
    var cached = safeJsonGet(coverCacheKey(videoId), null);
    if (cached && cached.url && cached.expiresAt > Date.now()) return Promise.resolve(cached.url);
    return fetch('https://www.tiktok.com/oembed?url=' + encodeURIComponent(canonicalTikTokUrl(url)), { cache: 'force-cache' })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (json) { var thumb = json.thumbnail_url || ''; if (thumb) safeJsonSet(coverCacheKey(videoId), { url: thumb, expiresAt: Date.now() + CONFIG.coverCacheMs }); return thumb; })
      .catch(function () { return ''; });
  }

  function handleTap(e, index) {
    var item = state.list[index]; if (!item) return;
    var now = Date.now(); var last = state.lastTap; var dist = Math.hypot(e.clientX - last.x, e.clientY - last.y);
    if (last.time && now - last.time < CONFIG.doubleTapMs && dist < 44) {
      clearTimeout(last.timer); last.time = 0; toggleLike(item, findSlide(index), true, { x: e.clientX, y: e.clientY }); return;
    }
    last.time = now; last.x = e.clientX; last.y = e.clientY; clearTimeout(last.timer);
    last.timer = setTimeout(function () {
      if (!(item.tiktoks && item.tiktoks[0])) return;
      var player = Array.from(state.players.values()).find(function (p) { return p.index === index; });
      if (player && player.status === 'playing') pauseSlide(index);
      else playSlide(index, true);
    }, CONFIG.doubleTapMs + 20);
  }
  function showHeart(x, y) { var heart = document.createElement('div'); heart.className = 'pv-heart-burst'; heart.textContent = '♥'; heart.style.left = x + 'px'; heart.style.top = y + 'px'; state.root.appendChild(heart); setTimeout(function () { heart.remove(); }, 760); }
  function localUserSuffix() { var u = currentUser(); return String(u && u.uid || 'guest'); }
  function voteStoreKey() { return 'pv-vote-state:' + localUserSuffix(); }
  function voteStore() { return safeJsonGet(voteStoreKey(), {}); }
  function readVote(pid, tid) { var s = voteStore(); if (pid && s['pid:' + pid] !== undefined) return !!s['pid:' + pid]; if (tid && s['tid:' + tid] !== undefined) return !!s['tid:' + tid]; return false; }
  function writeVote(pid, tid, voted) { var s = voteStore(); if (pid) s['pid:' + pid] = !!voted; if (tid) s['tid:' + tid] = !!voted; safeJsonSet(voteStoreKey(), s); }
  function toggleLike(item, slide, optimistic, point) {
    if (!isLoggedIn()) return alertError(TEXT.loginFirst);
    if (!item.pid) return alertError(TEXT.likeFail);
    var old = !!item.viewer.liked; var next = !old;
    item.viewer.liked = next; item.counts.likes = Math.max(0, Number(item.counts.likes || 0) + (next ? 1 : -1));
    writeVote(item.pid, item.tid, next); updateLikeUi(slide, item); if (point && next) showHeart(point.x, point.y);
    apiFetch('/api/v3/posts/' + encodeURIComponent(item.pid) + '/vote', {
      method: next ? 'PUT' : 'DELETE',
      headers: { 'content-type': 'application/json; charset=utf-8', 'x-csrf-token': csrfToken() },
      body: next ? JSON.stringify({ delta: 1 }) : undefined
    }).catch(function () {
      item.viewer.liked = old; item.counts.likes = Math.max(0, Number(item.counts.likes || 0) + (next ? -1 : 1));
      writeVote(item.pid, item.tid, old); updateLikeUi(slide, item); alertError(next ? TEXT.likeFail : TEXT.unlikeFail);
    });
  }
  function updateLikeUi(slide, item) { if (!slide) return; var btn = $('.pv-like', slide); if (!btn) return; btn.classList.toggle('is-active', !!item.viewer.liked); var icon = $('.pv-action-icon', btn); if (icon) icon.innerHTML = iconHeart(); var count = $('span:last-child', btn); if (count) count.textContent = formatCount(item.counts.likes); }
  function followStoreKey() { return 'pv-follow-state:' + localUserSuffix(); }
  function followStore() { return safeJsonGet(followStoreKey(), {}); }
  function readFollow(author) { if (!author) return false; var s = followStore(); if (author.uid && s['uid:' + author.uid] !== undefined) return !!s['uid:' + author.uid]; return false; }
  function writeFollow(author, following) { var s = followStore(); if (author.uid) s['uid:' + author.uid] = !!following; safeJsonSet(followStoreKey(), s); }
  function toggleFollow(item, slide) {
    if (!isLoggedIn()) return alertError(TEXT.loginFirst);
    var author = item.author || {}; if (!author.uid) return alertError(TEXT.followFail);
    var old = readFollow(author); var next = !old; writeFollow(author, next); updateFollowUi(slide, next);
    apiFetch('/api/v3/users/' + encodeURIComponent(author.uid) + '/follow', { method: next ? 'PUT' : 'DELETE', headers: { 'x-csrf-token': csrfToken() } })
      .then(function () { alertSuccess(next ? TEXT.followed : TEXT.unfollowed); })
      .catch(function () { writeFollow(author, old); updateFollowUi(slide, old); alertError(next ? TEXT.followFail : TEXT.unfollowFail); });
  }
  function updateFollowUi(slide, following) { var btn = $('.pv-follow-plus', slide); if (!btn) return; btn.classList.toggle('is-following', !!following); btn.textContent = following ? '✓' : '+'; }

  var LANGUAGE_META = {
    auto: { flag: '🌐', label: '自动检测' }, zh: { flag: '🇨🇳', label: '中文' }, en: { flag: '🇺🇸', label: 'English' }, my: { flag: '🇲🇲', label: 'မြန်မာ' }, th: { flag: '🇹🇭', label: 'ไทย' }, vi: { flag: '🇻🇳', label: 'Tiếng Việt' }, ja: { flag: '🇯🇵', label: '日本語' }, ko: { flag: '🇰🇷', label: '한국어' }, ms: { flag: '🇲🇾', label: 'Malay' }, id: { flag: '🇮🇩', label: 'Indonesia' }, fr: { flag: '🇫🇷', label: 'Français' }, de: { flag: '🇩🇪', label: 'Deutsch' }, es: { flag: '🇪🇸', label: 'Español' }, ru: { flag: '🇷🇺', label: 'Русский' }
  };
  var DEFAULT_AI_PROMPT = '你是专业论坛翻译助手。请把用户提供的内容从 {{sourceLang}} 翻译为 {{targetLang}}。保留原有语气、换行、链接、用户名、表情和列表结构。只输出译文，不要解释。';
  function normalizeLang(code, fallback) { code = norm(code).toLowerCase().replace(/_/g, '-'); if (!code) return fallback || 'auto'; var short = code.split('-')[0]; return LANGUAGE_META[code] ? code : (LANGUAGE_META[short] ? short : (fallback || code)); }
  function langOptions(includeAuto) { var arr = includeAuto ? ['auto','zh','en','my','th','vi','ja','ko','ms','id','fr','de','es','ru'] : ['zh','en','my','th','vi','ja','ko','ms','id','fr','de','es','ru']; return arr.map(function (code) { var m = LANGUAGE_META[code] || { label: code, flag: '🏳️' }; return '<option value="' + code + '">' + m.flag + ' ' + m.label + '</option>'; }).join(''); }
  function getTranslateSettings() { var saved = safeJsonGet('pv-translate-settings', {}) || {}; return { provider: saved.provider === 'ai' ? 'ai' : 'google', sourceLang: normalizeLang(saved.sourceLang, 'auto'), targetLang: normalizeLang(saved.targetLang, (navigator.language || 'zh').split('-')[0] || 'zh'), aiEndpoint: saved.aiEndpoint || '', aiModel: saved.aiModel || '', aiApiKey: saved.aiApiKey || '', aiPrompt: saved.aiPrompt || DEFAULT_AI_PROMPT, temperature: Number.isFinite(Number(saved.temperature)) ? Number(saved.temperature) : 0.3 }; }
  function translateCacheKey(text) { var s = getTranslateSettings(); return 'pv-tr:' + s.provider + ':' + (s.aiModel || 'google') + ':' + s.sourceLang + ':' + s.targetLang + ':' + encodeURIComponent(norm(text)).slice(0, 240); }
  function normalizeAiEndpoint(url) { url = norm(url); if (!url) return ''; if (/\/(chat\/completions|responses)$/i.test(url)) return url; return url.replace(/\/+$/, '') + '/chat/completions'; }
  function extractAiText(data) { if (data && Array.isArray(data.choices) && data.choices[0] && data.choices[0].message) { var c = data.choices[0].message.content; if (typeof c === 'string') return norm(c); } if (data && typeof data.output_text === 'string') return norm(data.output_text); return ''; }
  function translateViaAI(text, settings) { if (!settings.aiEndpoint || !settings.aiModel || !settings.aiApiKey) return Promise.reject(new Error('AI translate not configured')); var prompt = String(settings.aiPrompt || DEFAULT_AI_PROMPT).replace(/{{\s*sourceLang\s*}}/gi, settings.sourceLang || 'auto').replace(/{{\s*targetLang\s*}}/gi, settings.targetLang || 'zh'); return fetch(normalizeAiEndpoint(settings.aiEndpoint), { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + settings.aiApiKey }, body: JSON.stringify({ model: settings.aiModel, temperature: settings.temperature, messages: [{ role: 'system', content: prompt }, { role: 'user', content: text }] }) }).then(function (res) { return res.json().catch(function () { return {}; }).then(function (json) { if (!res.ok) throw new Error(json.error && json.error.message || 'AI translate failed'); return json; }); }).then(function (json) { var out = extractAiText(json); if (!out) throw new Error('empty AI translation'); return out; }); }
  function translateViaGoogle(text, settings) { var url = 'https://translate.googleapis.com/translate_a/single?' + new URLSearchParams({ client: 'gtx', sl: settings.sourceLang || 'auto', tl: settings.targetLang || 'zh', dt: 't', q: text }).toString(); return fetch(url, { credentials: 'omit', cache: 'force-cache' }).then(function (res) { if (!res.ok) throw new Error('translate ' + res.status); return res.json(); }).then(function (data) { var parts = Array.isArray(data && data[0]) ? data[0] : []; return norm(parts.map(function (p) { return p && p[0] ? p[0] : ''; }).join('')); }); }
  function translateText(text) { var clean = cleanDisplayText(text).replace(/https?:\/\/\S+/g, '').trim(); if (!clean) return Promise.resolve(''); var key = translateCacheKey(clean); var cached = safeJsonGet(key, null); if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.text || ''); var settings = getTranslateSettings(); var p = settings.provider === 'ai' ? translateViaAI(clean, settings) : translateViaGoogle(clean, settings); return p.then(function (out) { out = norm(out); if (out) safeJsonSet(key, { text: out, expiresAt: Date.now() + CONFIG.translateCacheMs }); return out; }); }
  function translateSlide(item, slide) { var box = $('.pv-translated', slide); if (!box) return; if (box.classList.contains('is-show') && box.dataset.loaded === '1') { box.classList.remove('is-show'); return; } box.classList.add('is-show'); box.textContent = TEXT.translating; translateText(item.text || item.title).then(function (out) { box.textContent = out || ''; box.dataset.loaded = out ? '1' : '0'; if (!out) box.classList.remove('is-show'); }).catch(function () { box.textContent = TEXT.translateFail; }); }
  function translateElementText(text, target) { target.classList.add('is-show'); target.textContent = TEXT.translating; return translateText(text).then(function (out) { target.textContent = out || ''; if (!out) target.classList.remove('is-show'); }).catch(function () { target.textContent = TEXT.translateFail; }); }
  function openTranslateSettings() { var panel = $('.pv-translate-panel', state.root); var backdrop = $('.pv-modal-backdrop', state.root); var s = getTranslateSettings(); $('[name="sourceLang"]', panel).value = s.sourceLang || 'auto'; $('[name="targetLang"]', panel).value = s.targetLang || 'zh'; $('[name="provider"]', panel).value = s.provider || 'google'; $('[name="aiEndpoint"]', panel).value = s.aiEndpoint || ''; $('[name="aiModel"]', panel).value = s.aiModel || ''; $('[name="aiApiKey"]', panel).value = s.aiApiKey || ''; $('[name="aiPrompt"]', panel).value = s.aiPrompt || DEFAULT_AI_PROMPT; panel.classList.toggle('is-ai', s.provider === 'ai'); $$('.pv-provider-tab', panel).forEach(function(t){ t.classList.toggle('is-active', (t.dataset.provider || 'google') === (s.provider || 'google')); }); panel.classList.add('is-open'); backdrop.classList.add('is-open'); }
  function closeTranslateSettings() { $('.pv-translate-panel', state.root).classList.remove('is-open'); if (!$('.pv-manage-panel', state.root).classList.contains('is-open')) $('.pv-modal-backdrop', state.root).classList.remove('is-open'); }

  function openViewer(images, index) { if (!images || !images.length) return; state.viewer.images = images.slice(0, CONFIG.imageMax); state.viewer.index = Math.max(0, Math.min(state.viewer.images.length - 1, Number(index || 0))); var viewer = $('.pv-viewer', state.root); viewer.classList.add('is-open'); updateViewer(); }
  function updateViewer() { var wrapper = $('.pv-viewer-track', state.root); wrapper.innerHTML = state.viewer.images.map(function (src, i) { return '<div class="pv-viewer-page"><img src="' + escapeHtml(src) + '" alt="image ' + (i + 1) + '"></div>'; }).join(''); wrapper.style.transform = 'translate3d(' + (-state.viewer.index * 100) + '%,0,0)'; $('.pv-viewer-dots', state.root).innerHTML = state.viewer.images.map(function (_, i) { return '<i class="' + (i === state.viewer.index ? 'is-active' : '') + '"></i>'; }).join(''); }
  function closeViewer() { $('.pv-viewer', state.root).classList.remove('is-open'); }
  function moveViewer(delta) { state.viewer.index = Math.max(0, Math.min(state.viewer.images.length - 1, state.viewer.index + delta)); updateViewer(); }

  function isAudioHref(href) { return RE.audioExt.test(String(href || '').split('?')[0]) || /[?&](haa8dur|dur|duration)=/i.test(String(href || '')); }
  function parseDurationFromUrl(url) { try { var u = new URL(String(url || ''), location.origin); var raw = u.searchParams.get('haa8dur') || u.searchParams.get('dur') || u.searchParams.get('duration'); return Math.max(0, Number(raw || 0) || 0); } catch (e) { return 0; } }
  function extractAudiosFromContent(content) { var out = []; var raw = String(content || ''); raw.replace(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/ig, function (m, href, label) { if (isAudioHref(href) && !out.some(function (a) { return a.url === href; })) out.push({ url: href, label: norm(label.replace(/<[^>]*>/g, '')) || TEXT.voiceMsg }); return m; }); raw.replace(/\[([^\]]*)\]\(([^)]+)\)/g, function (m, label, href) { if (isAudioHref(href) && !out.some(function (a) { return a.url === href; })) out.push({ url: href, label: norm(label) || TEXT.voiceMsg }); return m; }); return out; }
  function voiceBars() { return [9,14,19,11,22,16,12,20,10,17,13,18].map(function (h) { return '<i style="height:' + h + 'px"></i>'; }).join(''); }
  function renderVoiceCard(audio, cls) { var dur = parseDurationFromUrl(audio.url); return '<button type="button" class="pv-voice-card ' + (cls || '') + '" data-src="' + escapeHtml(audio.url) + '"><span class="pv-voice-play">▶</span><span class="pv-voice-wave">' + voiceBars() + '</span><span class="pv-voice-time">' + formatDuration(dur) + '</span></button>'; }
  function toggleVoiceCard(card) { if (!card) return; var src = card.dataset.src; if (!src) return; var audio = card._pvAudio || new Audio(src); card._pvAudio = audio; audio.preload = 'metadata'; $$('.pv-voice-card.playing', state.root).forEach(function (node) { if (node !== card && node._pvAudio) { node._pvAudio.pause(); node.classList.remove('playing'); $('.pv-voice-play', node).textContent = '▶'; } }); audio.onloadedmetadata = function () { if (audio.duration && isFinite(audio.duration)) $('.pv-voice-time', card).textContent = formatDuration(audio.duration); }; audio.ontimeupdate = function () { if (!audio.paused) $('.pv-voice-time', card).textContent = formatDuration(audio.currentTime); }; audio.onended = function () { card.classList.remove('playing'); $('.pv-voice-play', card).textContent = '▶'; audio.currentTime = 0; }; if (audio.paused) { audio.play().then(function () { card.classList.add('playing'); $('.pv-voice-play', card).textContent = '❚❚'; }).catch(function () {}); } else { audio.pause(); card.classList.remove('playing'); $('.pv-voice-play', card).textContent = '▶'; } }

  function openComments(item) { state.comments.item = item; state.comments.replyTo = null; var panel = $('.pv-comments-panel', state.root); $('.pv-drawer-backdrop', state.root).classList.add('is-open'); panel.classList.add('is-open'); panel.style.transform = ''; $('.pv-comments-title', panel).textContent = TEXT.comments + ' ' + formatCount(item.counts.comments); $('.pv-comments-list', panel).innerHTML = '<div class="pv-comments-loading">加载中...</div>'; $('.pv-comment-input', panel).placeholder = TEXT.commentPlaceholder; updateCommentActionButton(); $('.pv-reply-bar', panel).classList.remove('is-open'); apiFetch('/api/topic/' + encodeURIComponent(item.tid)).then(function (json) { var posts = Array.isArray(json.posts) ? json.posts.slice(1) : []; state.comments.posts = posts; renderComments(posts); }).catch(function () { $('.pv-comments-list', panel).innerHTML = '<div class="pv-comments-empty">加载失败</div>'; }); }
  function closeComments() { stopCommentRecording(false); setCommentVoice(null, 0); $('.pv-comments-panel', state.root).classList.remove('is-open'); $('.pv-drawer-backdrop', state.root).classList.remove('is-open'); }
  function renderComments(posts) { var list = $('.pv-comments-list', state.root); if (!posts.length) { list.innerHTML = '<div class="pv-comments-empty">' + TEXT.noComments + '</div>'; return; } list.innerHTML = posts.map(function (post) { var user = normalizeAuthor(post.user || post, {}); var content = post.content || post.raw || ''; var div = document.createElement('div'); div.innerHTML = content; var text = cleanDisplayText(div.textContent || content); var audios = extractAudiosFromContent(content); var avatar = user.picture ? '<img src="' + escapeHtml(user.picture) + '" alt="avatar">' : '<span></span>'; var pid = String(post.pid || ''); var audioHtml = audios.map(function (a) { return renderVoiceCard(a, ''); }).join(''); return '<div class="pv-comment" data-pid="' + escapeHtml(pid) + '" data-username="' + escapeHtml(user.username || '用户') + '"><div class="pv-comment-avatar">' + avatar + '</div><div class="pv-comment-body"><div class="pv-comment-name">' + escapeHtml(user.username || '用户') + '</div>' + (text ? '<div class="pv-comment-text">' + escapeHtml(text) + '</div>' : '') + audioHtml + '<div class="pv-comment-translated"></div><div class="pv-comment-actions"><button type="button" class="pv-comment-reply">' + TEXT.replyTo + '</button><button type="button" class="pv-comment-translate">' + iconTranslate() + '</button></div></div></div>'; }).join(''); }
  function normalizeAuthor(user, fallback) { user = user || {}; fallback = fallback || {}; var uid = String(user.uid || user.userId || user.userid || fallback.uid || ''); var username = norm(user.displayname || user.displayName || user.username || fallback.username || fallback.displayname || fallback.userslug || '用户'); var userslug = String(user.userslug || fallback.userslug || username || '').replace(/^@/, ''); var picture = user.picture || user.uploadedpicture || user.avatar || fallback.picture || fallback.uploadedpicture || ''; return { uid: uid, username: username, userslug: userslug, picture: picture }; }
  function setReplyTarget(commentEl) { var username = commentEl.dataset.username || '用户'; var pid = commentEl.dataset.pid || ''; state.comments.replyTo = { username: username, pid: pid }; var panel = $('.pv-comments-panel', state.root); $('.pv-reply-bar', panel).classList.add('is-open'); $('.pv-reply-name', panel).textContent = '@' + username; $('.pv-comment-input', panel).placeholder = TEXT.replyTo + ' @' + username; $('.pv-comment-input', panel).focus(); }
  function clearReplyTarget() { state.comments.replyTo = null; var panel = $('.pv-comments-panel', state.root); $('.pv-reply-bar', panel).classList.remove('is-open'); $('.pv-comment-input', panel).placeholder = TEXT.commentPlaceholder; updateCommentActionButton(); }
  function setCommentVoice(blob, duration) { if (state.comments.voiceUrl) { try { URL.revokeObjectURL(state.comments.voiceUrl); } catch (e) {} } state.comments.voiceBlob = blob || null; state.comments.voiceDuration = Math.max(0, Math.round(Number(duration) || 0)); state.comments.voiceUrl = blob ? URL.createObjectURL(blob) : ''; var wrap = $('.pv-comment-voice-preview', state.root); if (!wrap) return; wrap.innerHTML = blob ? renderVoiceCard({ url: state.comments.voiceUrl }, 'is-preview') + '<button type="button" class="pv-comment-voice-remove">×</button>' : ''; wrap.classList.toggle('is-open', !!blob); updateCommentActionButton(); }
  function recorderMime() { if (!window.MediaRecorder) return ''; return ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg'].find(function (t) { return MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t); }) || ''; }
  function toggleCommentRecording() {
    if (state.comments.mediaRecorder && state.comments.mediaRecorder.state === 'recording') { finishCommentRecording(false); return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) return alertError(TEXT.recordUnsupported);
    navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } }).catch(function () { return navigator.mediaDevices.getUserMedia({ audio: true }); }).then(function (stream) {
      state.comments.stream = stream; state.comments.chunks = []; state.comments.startAt = Date.now(); state.comments.sendAfterStop = false;
      var mime = recorderMime(); var rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 16000 } : { audioBitsPerSecond: 16000 }); state.comments.mediaRecorder = rec;
      rec.ondataavailable = function (e) { if (e.data && e.data.size) state.comments.chunks.push(e.data); };
      rec.onstop = function () {
        var dur = Math.max(1, Math.round((Date.now() - state.comments.startAt) / 1000));
        if (state.comments.stream) state.comments.stream.getTracks().forEach(function (t) { t.stop(); });
        clearInterval(state.comments.timer); $('.pv-comment-record-panel', state.root).classList.remove('is-open'); updateCommentActionButton();
        if (state.comments.chunks.length) setCommentVoice(new Blob(state.comments.chunks, { type: state.comments.chunks[0].type || mime || 'audio/webm' }), Math.min(CONFIG.voiceMaxSeconds, dur));
        if (state.comments.sendAfterStop) setTimeout(submitComment, 60);
      };
      rec.start(250); $('.pv-comment-record-panel', state.root).classList.add('is-open'); updateCommentActionButton();
      state.comments.timer = setInterval(function () { var sec = Math.max(0, Math.floor((Date.now() - state.comments.startAt) / 1000)); var el = $('.pv-record-time', state.root); if (el) el.textContent = formatDuration(sec); if (sec >= CONFIG.voiceMaxSeconds) finishCommentRecording(false); }, 250);
    }).catch(function () { alertError(TEXT.micDenied); });
  }
  function finishCommentRecording(sendAfter) { var rec = state.comments.mediaRecorder; state.comments.sendAfterStop = !!sendAfter; if (rec && rec.state === 'recording') { try { rec.stop(); } catch (e) {} } else if (sendAfter) submitComment(); }
  function stopCommentRecording() { state.comments.sendAfterStop = false; var rec = state.comments.mediaRecorder; if (rec && rec.state === 'recording') { try { rec.stop(); } catch (e) {} } if (state.comments.stream) state.comments.stream.getTracks().forEach(function (t) { t.stop(); }); clearInterval(state.comments.timer); var panel = $('.pv-comment-record-panel', state.root); if (panel) panel.classList.remove('is-open'); updateCommentActionButton(); }
  function updateCommentActionButton() { var btn = $('.pv-comment-action-btn', state.root); if (!btn) return; var input = $('.pv-comment-input', state.root); var hasText = !!norm(input && input.value); var recording = state.comments.mediaRecorder && state.comments.mediaRecorder.state === 'recording'; var hasVoice = !!state.comments.voiceBlob; btn.classList.toggle('is-send', hasText || hasVoice); btn.classList.toggle('recording', !!recording); btn.innerHTML = (hasText || hasVoice) ? iconSend() : (recording ? '<span class="pv-stop-dot"></span>' : iconMic()); }
  function handleCommentAction() { var input = $('.pv-comment-input', state.root); if ((input && norm(input.value)) || state.comments.voiceBlob) submitComment(); else toggleCommentRecording(); }
  function submitComment() { var item = state.comments.item; var input = $('.pv-comment-input', state.root); var text = norm(input.value); if (!item || (!text && !state.comments.voiceBlob)) return; if (!isLoggedIn()) return alertError(TEXT.loginFirst); var btn = $('.pv-comment-action-btn', state.root); if (btn) btn.disabled = true; Promise.resolve().then(function () { var content = state.comments.replyTo ? ('@' + state.comments.replyTo.username + ' ' + text) : text; if (!state.comments.voiceBlob) return content; var ext = /ogg/i.test(state.comments.voiceBlob.type) ? 'ogg' : 'webm'; var file = new File([state.comments.voiceBlob], 'comment-voice-' + Date.now() + '.' + ext, { type: state.comments.voiceBlob.type || 'audio/webm' }); return uploadToNodeBB(file).then(function (url) { return (content ? content + '\n' : '') + '[' + TEXT.voiceMsg + ' · ' + formatDuration(state.comments.voiceDuration || 1) + '](' + appendDurationParam(url, state.comments.voiceDuration || 1) + ')'; }); }).then(function (content) { var payload = { content: content }; if (state.comments.replyTo && state.comments.replyTo.pid) payload.toPid = state.comments.replyTo.pid; return apiFetch('/api/v3/topics/' + encodeURIComponent(item.tid), { method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8', 'x-csrf-token': csrfToken() }, body: JSON.stringify(payload) }); }).then(function () { input.value = ''; clearReplyTarget(); setCommentVoice(null, 0); updateCommentActionButton(); item.counts.comments += 1; updateCountUi(item); openComments(item); }).catch(function () { alertError(TEXT.commentFail); }).finally(function () { if (btn) btn.disabled = false; }); }
  function updateCountUi(item) { var slide = findSlide(state.list.indexOf(item)); if (!slide) return; var btn = $('.pv-comment-btn span:last-child', slide); if (btn) btn.textContent = formatCount(item.counts.comments); }
  function translateComment(commentEl) { var text = $('.pv-comment-text', commentEl); var box = $('.pv-comment-translated', commentEl); if (!text || !box) return; translateElementText(text.textContent || '', box); }
  function translateCommentInput() { var input = $('.pv-comment-input', state.root); var text = norm(input.value); if (!text) return; translateText(text).then(function (out) { if (out) { input.value = out; updateCommentActionButton(); } }).catch(function () { alertError(TEXT.translateFail); }); }

  function openManagePanel(item) { if (!item) return; state.manageItem = item; $('.pv-modal-backdrop', state.root).classList.add('is-open'); $('.pv-manage-panel', state.root).classList.add('is-open'); }
  function closeManagePanel() { state.manageItem = null; $('.pv-manage-panel', state.root).classList.remove('is-open'); if (!$('.pv-translate-panel', state.root).classList.contains('is-open')) $('.pv-modal-backdrop', state.root).classList.remove('is-open'); }
  function deleteManagedVideo() { var item = state.manageItem; if (!item || !item.tid) return; if (!window.confirm(TEXT.deleteConfirm)) return; apiFetch('/api/v3/plugins/peipe-video/topics/' + encodeURIComponent(item.tid), { method: 'DELETE', headers: { 'x-csrf-token': csrfToken() } }).then(function(){ closeManagePanel(); alertSuccess(TEXT.deleteOk); state.list = state.list.filter(function(x){ return String(x.tid) !== String(item.tid); }); if (state.index >= state.list.length) state.index = Math.max(0, state.list.length - 1); renderWindow(); }).catch(function(err){ console.warn(err); alertError(TEXT.deleteFail); }); }
  function translateComposeText() { var panel = $('.pv-compose-panel', state.root); var textarea = $('textarea', panel); var text = norm(textarea.value); if (!text) return; var old = textarea.value; textarea.disabled = true; translateText(text).then(function(out){ if (out) textarea.value = out; }).catch(function(){ alertError(TEXT.translateFail); }).finally(function(){ textarea.disabled = false; textarea.focus(); if (!textarea.value) textarea.value = old; }); }

  function showComposeFabInitial() { var fab = $('.pv-compose-fab', state.root); if (fab) fab.classList.remove('is-hidden'); }
  function hideComposerFab() { var fab = $('.pv-compose-fab', state.root); if (fab) fab.classList.add('is-hidden'); }
  function openCompose() { pauseSlide(state.index); $('.pv-drawer-backdrop', state.root).classList.add('is-open'); $('.pv-compose-panel', state.root).classList.add('is-open'); hideComposerFab(); }
  function closeCompose() { $('.pv-compose-panel', state.root).classList.remove('is-open'); $('.pv-drawer-backdrop', state.root).classList.remove('is-open'); }
  function resetCompose() { var p = $('.pv-compose-panel', state.root); $('textarea', p).value = ''; setPendingImages([]); $('.pv-meta', p).textContent = ''; }
  function canCanvasEncode(type) { return new Promise(function (resolve) { try { var c = document.createElement('canvas'); c.width = c.height = 1; c.toBlob(function (b) { resolve(!!b && b.type === type); }, type, 0.8); } catch (e) { resolve(false); } }); }
  function compressImageFile(file) { if (!file || !/^image\//i.test(file.type) || /gif|svg/i.test(file.type) || file.size < 128 * 1024) return Promise.resolve(file); return new Promise(function (resolve) { var img = new Image(); var url = URL.createObjectURL(file); img.onload = function () { URL.revokeObjectURL(url); var maxSide = 1440; var scale = Math.min(1, maxSide / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height)); var canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round((img.naturalWidth || img.width) * scale)); canvas.height = Math.max(1, Math.round((img.naturalHeight || img.height) * scale)); var ctx = canvas.getContext('2d'); if (!ctx || !canvas.toBlob) return resolve(file); ctx.drawImage(img, 0, 0, canvas.width, canvas.height); canCanvasEncode('image/webp').then(function (webp) { var type = webp ? 'image/webp' : 'image/jpeg'; canvas.toBlob(function (blob) { if (!blob || blob.size >= file.size * 0.95) return resolve(file); var name = String(file.name || ('image-' + Date.now())).replace(/\.[^.]+$/, '') + (type === 'image/webp' ? '.webp' : '.jpg'); resolve(new File([blob], name, { type: type, lastModified: Date.now() })); }, type, 0.62); }); }; img.onerror = function () { URL.revokeObjectURL(url); resolve(file); }; img.src = url; }); }
  function compressImageFiles(files) { return Promise.all((files || []).map(compressImageFile)); }
  function setPendingImages(files) { state.compose.imageUrls.forEach(function (url) { URL.revokeObjectURL(url); }); var list = Array.from(files || []).filter(function (f) { return /^image\//i.test(f.type); }).slice(0, CONFIG.imageMax); state.compose.imageFiles = list; state.compose.imageUrls = list.map(function (f) { return URL.createObjectURL(f); }); $('.pv-preview-images', state.root).innerHTML = state.compose.imageUrls.map(function (u) { return '<img src="' + escapeHtml(u) + '" alt="preview">'; }).join(''); }
  function uploadToNodeBB(file) { var form = new FormData(); form.append('files[]', file); form.append('cid', String(CONFIG.cid)); return fetch(rel('/api/post/upload'), { method: 'POST', credentials: 'same-origin', headers: { 'x-csrf-token': csrfToken(), 'x-requested-with': 'XMLHttpRequest' }, body: form }).then(function (res) { return res.json().catch(function () { return {}; }).then(function (json) { if (!res.ok) throw new Error(json.error || json.message || 'upload failed'); return extractUploadUrl(json); }); }); }
  function extractUploadUrl(payload) { var q = [payload], seen = new Set(); while (q.length) { var cur = q.shift(); if (!cur || seen.has(cur)) continue; if (typeof cur === 'string' && (/^(https?:)?\/\//i.test(cur) || /^\/assets\//i.test(cur))) return cur; if (typeof cur !== 'object') continue; seen.add(cur); if (Array.isArray(cur)) q.push.apply(q, cur); else Object.keys(cur).forEach(function (k) { q.push(cur[k]); }); } throw new Error('upload url missing'); }
  function buildTitle(text) { var clean = norm(String(text || '').replace(RE.tiktokGlobal, '').replace(RE.tiktokShort, '').replace(/!\[[^\]]*\]\([^)]+\)/g, '').replace(/\[[^\]]*\]\([^)]+\)/g, '')); return clean ? clean.slice(0, 80) : 'TikTok 动态'; }
  function appendDurationParam(url, seconds) { try { var u = new URL(url, location.origin); u.searchParams.set('haa8dur', String(Math.max(1, seconds || 1))); return u.origin === location.origin ? u.pathname + u.search + u.hash : u.toString(); } catch (e) { return url + (String(url).indexOf('?') === -1 ? '?' : '&') + 'haa8dur=' + encodeURIComponent(seconds || 1); } }
  function sendTopic() { if (!isLoggedIn()) return alertError(TEXT.loginFirst); var panel = $('.pv-compose-panel', state.root); var textarea = $('textarea', panel); var text = norm(textarea.value); if (!text && !state.compose.imageFiles.length) return alertError(TEXT.enterSomething); var btn = $('.pv-compose-submit', panel); var meta = $('.pv-meta', panel); btn.disabled = true; btn.textContent = TEXT.publishing; var lines = []; if (text) lines.push(text); Promise.resolve().then(function () { var p = Promise.resolve(); state.compose.imageFiles.forEach(function (file, i) { p = p.then(function () { meta.textContent = TEXT.uploadImage + ' ' + (i + 1) + '/' + state.compose.imageFiles.length; return uploadToNodeBB(file).then(function (url) { lines.push('![image](' + url + ')'); }); }); }); return p; }).then(function () { return apiFetch('/api/v3/topics', { method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8', 'x-csrf-token': csrfToken() }, body: JSON.stringify({ cid: Number(CONFIG.cid), title: buildTitle(text), content: lines.join('\n\n'), tags: [] }) }); }).then(function () { alertSuccess(TEXT.publishOk); resetCompose(); closeCompose(); loadFeed(true); }).catch(function (err) { console.warn(err); alertError(err.message || TEXT.publishFail); }).finally(function () { btn.disabled = false; btn.textContent = TEXT.send; meta.textContent = ''; }); }

  function buildChrome() {
    state.root.innerHTML = '' +
      '<div class="pv-page"><div class="pv-slide-list"></div><div class="pv-source-notice">' + escapeHtml(TEXT.sourceNotice).replace(/\n/g, '<br>') + '</div></div>' +
      '<button type="button" class="pv-compose-fab">+</button>' +
      '<div class="pv-drawer-backdrop"></div><div class="pv-modal-backdrop"></div>' +
      '<section class="pv-compose-panel" role="dialog"><div class="pv-panel-head"><div class="pv-panel-title">' + TEXT.publish + '</div><button type="button" class="pv-close pv-compose-close">×</button></div><textarea placeholder="' + escapeHtml(TEXT.placeholder) + '"></textarea><div class="pv-preview-images"></div><div class="pv-compose-tools"><input type="file" class="pv-image-input" accept="image/*" multiple hidden><button type="button" class="pv-tool pv-image-btn">' + TEXT.chooseImage + '</button><button type="button" class="pv-tool pv-compose-translate" aria-label="' + TEXT.translate + '">' + iconTranslate() + '</button><button type="button" class="pv-primary pv-compose-submit">' + TEXT.send + '</button></div><div class="pv-meta"></div></section>' +
      '<section class="pv-comments-panel" role="dialog"><div class="pv-panel-grip"></div><div class="pv-panel-head pv-comments-drag"><div class="pv-panel-title pv-comments-title">' + TEXT.comments + '</div><button type="button" class="pv-close pv-comments-close">×</button></div><div class="pv-comments-list"></div><div class="pv-reply-bar"><span>' + TEXT.replyTo + ' </span><b class="pv-reply-name"></b><button type="button" class="pv-reply-cancel">×</button></div><div class="pv-comment-voice-preview"></div><div class="pv-comment-send-row"><div class="pv-comment-record-panel"><button type="button" class="pv-record-cancel">×</button><span class="pv-record-pulse"></span><span class="pv-record-bars"><i></i><i></i><i></i><i></i><i></i></span><span class="pv-record-time">00:00</span><button type="button" class="pv-record-stop">■</button><button type="button" class="pv-record-send">' + iconSend() + '</button></div><div class="pv-comment-input-wrap"><button type="button" class="pv-comment-input-translate" aria-label="' + TEXT.translate + '">' + iconTranslate() + '</button><input class="pv-comment-input" placeholder="' + escapeHtml(TEXT.commentPlaceholder) + '"><button type="button" class="pv-comment-action-btn" aria-label="语音或发送">' + iconMic() + '</button></div></div></section>' +
      '<section class="pv-translate-panel" role="dialog"><div class="pv-panel-head"><div class="pv-panel-title">' + TEXT.translateSettings + '</div><button type="button" class="pv-close pv-translate-close">×</button></div><div class="pv-provider-tabs"><button type="button" class="pv-provider-tab" data-provider="google">' + TEXT.google + '</button><button type="button" class="pv-provider-tab" data-provider="ai">' + TEXT.ai + '</button><input type="hidden" name="provider" value="google"></div><div class="pv-lang-row"><label><span>' + TEXT.sourceLang + '</span><select name="sourceLang">' + langOptions(true) + '</select></label><span class="pv-lang-arrow">⇄</span><label><span>' + TEXT.targetLang + '</span><select name="targetLang">' + langOptions(false) + '</select></label></div><div class="pv-ai-settings"><label>' + TEXT.aiEndpoint + '<input name="aiEndpoint" placeholder="https://api.example.com/v1"></label><label>' + TEXT.aiModel + '<input name="aiModel" placeholder="gpt-4.1-mini / qwen / deepseek"></label><label>' + TEXT.aiApiKey + '<input name="aiApiKey" type="password" placeholder="API Key"></label><label>' + TEXT.aiPrompt + '<textarea name="aiPrompt" rows="4"></textarea></label></div><div class="pv-translate-actions"><button type="button" class="pv-primary pv-translate-save">' + TEXT.save + '</button></div></section>' +
      '<section class="pv-manage-panel" role="dialog"><button type="button" class="pv-manage-delete">' + TEXT.deleteVideo + '</button><button type="button" class="pv-manage-cancel">取消</button></section>' +
      '<div class="pv-viewer"><div class="pv-viewer-track"></div><div class="pv-viewer-dots"></div><button class="pv-viewer-close" aria-label="关闭">×</button></div>';
    bindChrome();
  }
  function bindLongPress(el, cb) { if (!el) return; var timer = 0, sx = 0, sy = 0; el.addEventListener('pointerdown', function (e) { sx = e.clientX; sy = e.clientY; clearTimeout(timer); timer = setTimeout(function () { cb(e); timer = 0; }, 560); }); el.addEventListener('pointermove', function (e) { if (Math.hypot(e.clientX - sx, e.clientY - sy) > 12) { clearTimeout(timer); timer = 0; } }); ['pointerup','pointercancel','pointerleave'].forEach(function (n) { el.addEventListener(n, function () { clearTimeout(timer); timer = 0; }); }); }
  function unlockSoundFromGesture() { state.hasInteracted = true; state.soundUnlocked = true; safeJsonSet('pv-sound-unlocked', true); }
  function bindChrome() {
    state.root.addEventListener('click', onRootClick, true);
    state.root.addEventListener('pointerdown', onRootPointerDown, true);
    state.root.addEventListener('pointermove', onRootPointerMove, true);
    state.root.addEventListener('pointerup', onRootPointerUp, true);
    state.root.addEventListener('pointercancel', onRootPointerCancel, true);
    $('.pv-compose-fab', state.root).addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); openCompose(); });
    $('.pv-compose-close', state.root).addEventListener('click', closeCompose);
    $('.pv-drawer-backdrop', state.root).addEventListener('click', function () { closeCompose(); closeComments(); });
    $('.pv-image-btn', state.root).addEventListener('click', function () { $('.pv-image-input', state.root).click(); });
    $('.pv-image-input', state.root).addEventListener('change', function (e) { var files = Array.from(e.target.files || []).slice(0, CONFIG.imageMax); e.target.value = ''; if (files.find(function (f) { return !/^image\//i.test(f.type); })) return alertError(TEXT.imageOnly); compressImageFiles(files).then(setPendingImages); });
    $('.pv-compose-submit', state.root).addEventListener('click', sendTopic);
    $('.pv-compose-translate', state.root).addEventListener('click', translateComposeText);
    $('.pv-comments-close', state.root).addEventListener('click', closeComments);
    $('.pv-reply-cancel', state.root).addEventListener('click', clearReplyTarget);
    $('.pv-comment-action-btn', state.root).addEventListener('click', handleCommentAction);
    $('.pv-record-cancel', state.root).addEventListener('click', function () { stopCommentRecording(false); setCommentVoice(null, 0); });
    $('.pv-record-stop', state.root).addEventListener('click', function () { finishCommentRecording(false); });
    $('.pv-record-send', state.root).addEventListener('click', function () { finishCommentRecording(true); });
    $('.pv-comment-voice-preview', state.root).addEventListener('click', function (e) { var rm = e.target.closest('.pv-comment-voice-remove'); if (rm) { setCommentVoice(null, 0); return; } var card = e.target.closest('.pv-voice-card'); if (card) toggleVoiceCard(card); });
    $('.pv-comment-input-translate', state.root).addEventListener('click', translateCommentInput);
    bindLongPress($('.pv-comment-input-translate', state.root), openTranslateSettings);
    $('.pv-comment-input', state.root).addEventListener('input', updateCommentActionButton);
    $('.pv-comment-input', state.root).addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); if (norm(e.currentTarget.value) || state.comments.voiceBlob) submitComment(); } });
    $('.pv-translate-close', state.root).addEventListener('click', closeTranslateSettings);
    $('.pv-modal-backdrop', state.root).addEventListener('click', function(){ closeTranslateSettings(); closeManagePanel(); });
    $('.pv-manage-cancel', state.root).addEventListener('click', closeManagePanel);
    $('.pv-manage-delete', state.root).addEventListener('click', deleteManagedVideo);
    $('.pv-translate-save', state.root).addEventListener('click', function () { var p = $('.pv-translate-panel', state.root); safeJsonSet('pv-translate-settings', { provider: $('[name="provider"]', p).value, sourceLang: $('[name="sourceLang"]', p).value, targetLang: $('[name="targetLang"]', p).value, aiEndpoint: $('[name="aiEndpoint"]', p).value, aiModel: $('[name="aiModel"]', p).value, aiApiKey: $('[name="aiApiKey"]', p).value, aiPrompt: $('[name="aiPrompt"]', p).value }); closeTranslateSettings(); });
    $$('.pv-provider-tab', state.root).forEach(function(tab){ tab.addEventListener('click', function(){ var p = $('.pv-translate-panel', state.root); $('[name="provider"]', p).value = tab.dataset.provider || 'google'; $$('.pv-provider-tab', p).forEach(function(t){ t.classList.toggle('is-active', t === tab); }); p.classList.toggle('is-ai', tab.dataset.provider === 'ai'); }); });
    var viewer = $('.pv-viewer', state.root); $('.pv-viewer-close', viewer).addEventListener('click', closeViewer);
    viewer.addEventListener('pointerdown', function (e) { state.viewer.down = true; state.viewer.startX = e.clientX; state.viewer.startY = e.clientY; });
    viewer.addEventListener('pointerup', function (e) { if (!state.viewer.down) return; state.viewer.down = false; var dx = e.clientX - state.viewer.startX; var dy = e.clientY - state.viewer.startY; if (dy > 66 && Math.abs(dy) > Math.abs(dx)) closeViewer(); else if (Math.abs(dx) > 36 && Math.abs(dx) > Math.abs(dy)) moveViewer(dx < 0 ? 1 : -1); });
    document.addEventListener('visibilitychange', function () { if (document.hidden) pauseSlide(state.index); else activateCurrent(false); });
  }
  function onRootClick(e) {
    var btn;
    if ((btn = e.target.closest('.pv-like'))) { e.preventDefault(); e.stopPropagation(); var i = Number(btn.dataset.index); toggleLike(state.list[i], findSlide(i), true); return; }
    if ((btn = e.target.closest('.pv-comment-btn'))) { e.preventDefault(); e.stopPropagation(); openComments(state.list[Number(btn.dataset.index)]); return; }
    if ((btn = e.target.closest('.pv-follow-plus'))) { e.preventDefault(); e.stopPropagation(); var idx = Number(btn.dataset.index); toggleFollow(state.list[idx], findSlide(idx)); return; }
    if ((btn = e.target.closest('.pv-translate-btn'))) { e.preventDefault(); e.stopPropagation(); var ti = Number(btn.dataset.index); translateSlide(state.list[ti], findSlide(ti)); return; }
    if ((btn = e.target.closest('.pv-album-btn'))) { e.preventDefault(); e.stopPropagation(); var pi = Number(btn.dataset.index); openViewer(state.list[pi].images || [], 0); return; }
    if ((btn = e.target.closest('.pv-manage-btn'))) { e.preventDefault(); e.stopPropagation(); openManagePanel(state.list[Number(btn.dataset.index)]); return; }
    if ((btn = e.target.closest('.pv-voice-card'))) { e.preventDefault(); e.stopPropagation(); toggleVoiceCard(btn); return; }
    if ((btn = e.target.closest('.pv-comment-reply'))) { e.preventDefault(); e.stopPropagation(); setReplyTarget(e.target.closest('.pv-comment')); return; }
    if ((btn = e.target.closest('.pv-comment-translate'))) { e.preventDefault(); e.stopPropagation(); translateComment(e.target.closest('.pv-comment')); return; }
    if ((btn = e.target.closest('.pv-text-row'))) { if (!e.target.closest('.pv-translate-btn')) btn.classList.toggle('is-expanded'); }
  }
  function shouldIgnoreVerticalDragTarget(target) { return !!target.closest('input, textarea, select, button, .pv-toolbar, .pv-comments-panel, .pv-compose-panel, .pv-translate-panel, .pv-viewer, .pv-image-carousel'); }
  function onRootPointerDown(e) {
    if (!e.target.closest('input, textarea, select, .pv-comments-panel, .pv-compose-panel, .pv-translate-panel, .pv-viewer')) unlockSoundFromGesture();
    var textRow = e.target.closest('.pv-text-row'); var translateBtn = e.target.closest('.pv-translate-btn, .pv-comment-translate');
    if (textRow || translateBtn) { clearTimeout(state.translateLongPressTimer); state.translateLongPressTimer = setTimeout(function () { openTranslateSettings(); }, 650); }
    var panel = $('.pv-comments-panel', state.root);
    if (panel && panel.classList.contains('is-open') && e.target.closest('.pv-comments-panel') && !e.target.closest('input,button,.pv-voice-card')) { state.comments.dragCandidate = true; state.comments.dragStartY = e.clientY; state.comments.dragY = 0; return; }
    if (shouldIgnoreVerticalDragTarget(e.target)) return;
    state.drag.active = true; state.drag.startX = e.clientX; state.drag.startY = e.clientY; state.drag.dx = 0; state.drag.dy = 0; state.drag.startTime = Date.now(); state.drag.locked = '';
    var wrap = $('.pv-slide-list', state.root); if (wrap) wrap.style.transitionDuration = '0ms';
  }
  function onRootPointerMove(e) {
    var panel = $('.pv-comments-panel', state.root);
    if (state.comments.dragCandidate && !state.comments.dragging) { var dy0 = e.clientY - state.comments.dragStartY; if (dy0 > 8) state.comments.dragging = true; if (Math.abs(dy0) > 18 && dy0 < 0) state.comments.dragCandidate = false; }
    if (state.comments.dragging) { var dy = Math.max(0, e.clientY - state.comments.dragStartY); state.comments.dragY = dy; if (panel) panel.style.transform = 'translateY(' + dy + 'px)'; if (e.cancelable) e.preventDefault(); return; }
    if (!state.drag.active) return;
    state.drag.dx = e.clientX - state.drag.startX; state.drag.dy = e.clientY - state.drag.startY;
    if (!state.drag.locked && (Math.abs(state.drag.dx) > 8 || Math.abs(state.drag.dy) > 8)) state.drag.locked = Math.abs(state.drag.dy) >= Math.abs(state.drag.dx) * 0.72 ? 'y' : 'x';
    if (state.drag.locked !== 'y') return;
    if ((state.index === 0 && state.drag.dy > 0) || (state.index >= state.list.length - 1 && state.drag.dy < 0)) applySlideTransform(state.drag.dy * 0.28, false);
    else applySlideTransform(state.drag.dy, false);
    if (e.cancelable) e.preventDefault();
  }
  function onRootPointerUp(e) {
    clearTimeout(state.translateLongPressTimer);
    if (state.comments.dragging) { var panel = $('.pv-comments-panel', state.root); state.comments.dragging = false; state.comments.dragCandidate = false; var dy = Math.max(0, e.clientY - state.comments.dragStartY); panel.style.transform = ''; if (dy > 86) closeComments(); return; }
    state.comments.dragCandidate = false;
    if (!state.drag.active) return;
    var dx = e.clientX - state.drag.startX; var dy2 = e.clientY - state.drag.startY; var elapsed = Date.now() - state.drag.startTime; var isTap = Math.abs(dx) < 8 && Math.abs(dy2) < 8;
    state.drag.active = false;
    if (state.drag.locked === 'y') {
      var goNext = dy2 < -CONFIG.slideThreshold || (elapsed < CONFIG.slideFlickMs && dy2 < -CONFIG.slideFlickDistance);
      var goPrev = dy2 > CONFIG.slideThreshold || (elapsed < CONFIG.slideFlickMs && dy2 > CONFIG.slideFlickDistance);
      if (goNext && state.index < state.list.length - 1) { pauseSlide(state.index); state.index += 1; renderWindow(); applySlideTransform(0, true); activateCurrent(true); hideComposerFab(); }
      else if (goPrev && state.index > 0) { pauseSlide(state.index); state.index -= 1; renderWindow(); applySlideTransform(0, true); activateCurrent(true); hideComposerFab(); }
      else applySlideTransform(0, true);
      return;
    }
    applySlideTransform(0, true);
    var layer = e.target.closest('.pv-gesture-layer');
    if (isTap && layer) { e.preventDefault(); e.stopPropagation(); handleTap(e, Number(layer.dataset.index)); }
  }
  function onRootPointerCancel() { clearTimeout(state.translateLongPressTimer); state.drag.active = false; applySlideTransform(0, true); state.comments.dragging = false; state.comments.dragCandidate = false; var p = $('.pv-comments-panel', state.root); if (p) p.style.transform = ''; }
  function showEmpty(text) { var old = $('.pv-empty-page', state.root); if (old) old.remove(); var div = document.createElement('div'); div.className = 'pv-empty-page'; div.textContent = text || TEXT.empty; state.root.appendChild(div); }
  function init() { state.root = document.getElementById('peipe-video-app'); if (!state.root) return; document.body.classList.add('pv-video-mode'); addPreconnects(); buildChrome(); showComposeFabInitial(); loadFeed(true); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
