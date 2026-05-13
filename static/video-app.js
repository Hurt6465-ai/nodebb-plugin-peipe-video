/* Peipe /video mobile discover page v7 optimized final
   - Supports backend cached TikTok coverUrl from feed: item.coverUrl or item.tiktoks[0].coverUrl
   - Keeps frontend TikTok oEmbed + gradient fallback, so black screen is avoided when cover is missing
   - Current + next TikTok iframes are warmed; previous iframes are hard-stopped to prevent audio leak
   - Comment drawer auto-fits content height; single-layer input; light translate panel; glass compose panel
*/
(function () {
  'use strict';

  if (window.__peipeVideoDiscoverV7) return;
  window.__peipeVideoDiscoverV7 = true;

  var CONFIG = Object.assign({
    cid: 6,
    pageSize: 12,
    preloadAhead: 4,
    preloadVideoAhead: 1,
    keepWarmVideoAhead: 1,
    keepWarmVideoBehind: 0,
    enableSegmentPrewarm: false,
    segmentPrewarmMs: 220,
    coverCacheEndpoint: '/api/v3/plugins/peipe-video/cover',
    imageMax: 4,
    coverCacheMs: 7 * 24 * 60 * 60 * 1000,
    translateCacheMs: 3 * 24 * 60 * 60 * 1000,
    doubleTapMs: 280,
    swiperCdnJs: '/plugins/nodebb-plugin-peipe-video/static/lib/swiper-bundle.min.js',
    swiperCdnCss: '/plugins/nodebb-plugin-peipe-video/static/lib/swiper-bundle.min.css'
  }, window.PEIPE_VIDEO_CONFIG || {});

  // Accept both names. video.tpl uses coverCacheApi; older JS used coverCacheEndpoint.
  if (CONFIG.coverCacheApi) CONFIG.coverCacheEndpoint = CONFIG.coverCacheApi;
  CONFIG.keepWarmVideoAhead = Math.max(1, Number(CONFIG.keepWarmVideoAhead === undefined ? (CONFIG.preloadVideoAhead || 1) : CONFIG.keepWarmVideoAhead));
  CONFIG.keepWarmVideoBehind = Math.max(0, Number(CONFIG.keepWarmVideoBehind === undefined ? 0 : CONFIG.keepWarmVideoBehind));
  CONFIG.enableSegmentPrewarm = CONFIG.enableSegmentPrewarm === true || CONFIG.enableSegmentPrewarm === 'true';
  CONFIG.segmentPrewarmMs = Math.max(120, Math.min(500, Number(CONFIG.segmentPrewarmMs || 220)));

  var TEXT = {
    loading: '发现加载中...',
    empty: '还没有可浏览的内容',
    publish: '发布',
    publishing: '发布中...',
    publishOk: '发布成功',
    publishFail: '发布失败',
    placeholder: '写点什么，或粘贴 TikTok 链接',
    chooseImage: '图片',
    translateInput: '翻译输入',
    send: '发布',
    imageOnly: '请选择图片',
    uploadImage: '上传图片',
    enterSomething: '请输入内容、TikTok 链接或图片',
    comments: '评论',
    commentPlaceholder: '说点什么...',
    replyTo: '回复',
    commentFail: '评论失败，可打开原帖评论',
    openTopic: '打开原帖',
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
    google: '谷歌翻译',
    ai: 'AI翻译',
    aiEndpoint: 'AI 接口',
    aiModel: '模型',
    aiApiKey: '密钥',
    aiPrompt: '提示词'
  };

  var RE = {
    tiktokGlobal: /https?:\/\/(?:www\.)?tiktok\.com\/@[^\/\s<>'"]+\/video\/(\d+)(?:\?[^\s<>'"]*)?/ig,
    tiktokOne: /https?:\/\/(?:www\.)?tiktok\.com\/@([^\/\s<>'"]+)\/video\/(\d+)/i,
    tiktokToken: /(?:https?[-:\/]+)?(?:www[.-])?tiktok[.-]com[-\/\w@.%=&?]+/ig,
    tiktokShort: /https?:\/\/(?:vt|vm)\.tiktok\.com\/[^\s<>'"]+/ig,
    audioExt: /\.(m4a|mp3|wav|ogg|oga|webm|aac)(?:[?#].*)?$/i
  };

  var state = {
    root: null,
    swiper: null,
    list: [],
    feedPage: 1,
    feedLoading: false,
    feedDone: false,
    index: 0,
    players: new Map(),
    imageIndex: new Map(),
    imageSwipers: new Map(),
    hasInteracted: false,
    soundUnlocked: !!safeJsonGet('pv-sound-unlocked', false),
    soundMuted: !!safeJsonGet('pv-sound-muted', !safeJsonGet('pv-sound-unlocked', false)),
    lastTap: { time: 0, x: 0, y: 0, timer: 0 },
    pointer: { down: false, x: 0, y: 0, moved: false, tapIndex: -1 },
    manualPausedKey: '',
    compose: { imageFiles: [], imageUrls: [] },
    viewer: { images: [], index: 0, swiper: null, startX: 0, startY: 0, down: false },
    comments: {
      item: null,
      posts: [],
      replyTo: null,
      dragY: 0,
      dragStartY: 0,
      dragging: false,
      dragCandidate: false,
      dragStartTopZone: false,
      voiceBlob: null,
      voiceUrl: '',
      voiceDuration: 0,
      mediaRecorder: null,
      stream: null,
      chunks: [],
      startAt: 0,
      timer: 0
    },
    translateLongPressTimer: 0
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
  function escapeHtml(s) {
    return String(s || '').replace(/[&<>'"]/g, function (ch) {
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

  function isAutoText(text) {
    var clean = norm(String(text || '').replace(/[•・·|｜_／/\\-]+/g, ' '));
    return !clean || /^(?:动态|新动态|图片分享|图片动态|语音消息|语音动态|voice message|audio message|image|photo|picture)(?:\s*:??\s*\d{1,2}:\d{2}(?::\d{2})?)?$/i.test(clean);
  }
  function cleanDisplayText(text) {
    var raw = String(text || '')
      .replace(RE.tiktokShort, '')
      .replace(RE.tiktokGlobal, '')
      .replace(RE.tiktokToken, '')
      .replace(/https?:\/\/(?:vt|vm)\.tiktok\.com\/?[^\s<>'"]*/ig, '')
      .replace(/https?:\/\/vt\.?/ig, '')
      .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
      .replace(/\[\s*(?:语音消息|语音动态|voice\s*message|audio\s*message)[^\]]*\]\([^)]+\)/ig, '');
    var lines = raw.split(/[\r\n]+/)
      .map(function (line) { return norm(line); })
      .filter(function (line) { return line && !isAutoText(line); });
    return lines.join('\n');
  }
  function displayText(item) { return cleanDisplayText(item && (item.text || item.title || '')); }
  function isOwnAuthor(author) {
    var me = currentUser();
    if (!me || !author) return false;
    return String(me.uid || '') === String(author.uid || '') || String(me.userslug || '').toLowerCase() === String(author.userslug || '').toLowerCase();
  }
  function authorHref(author) { return author && author.userslug ? rel('/user/' + encodeURIComponent(author.userslug)) : '#'; }
  function avatarSrc(author) { return author && author.picture ? author.picture : ''; }
  function canonicalTikTokUrl(url) {
    var m = String(url || '').replace(/&amp;/g, '&').match(RE.tiktokOne);
    return m ? 'https://www.tiktok.com/@' + m[1] + '/video/' + m[2] : String(url || '');
  }

  function addPreconnects() {
    ['https://www.tiktok.com', 'https://www.tiktokcdn.com', 'https://p16-sign-va.tiktokcdn.com', 'https://p19-sign.tiktokcdn-us.com'].forEach(function (href) {
      if (document.querySelector('link[rel="preconnect"][href="' + href + '"]')) return;
      var link = document.createElement('link');
      link.rel = 'preconnect'; link.href = href; link.crossOrigin = 'anonymous'; document.head.appendChild(link);
      var dns = document.createElement('link'); dns.rel = 'dns-prefetch'; dns.href = href; document.head.appendChild(dns);
    });
  }
  function loadAsset(tag, url) {
    return new Promise(function (resolve, reject) {
      if (tag === 'script' && window.Swiper) return resolve();
      var existing = document.querySelector(tag + '[data-pv-swiper]');
      if (existing) {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        if (tag === 'link' || (tag === 'script' && window.Swiper)) return resolve();
        return;
      }
      var el = document.createElement(tag);
      el.dataset.pvSwiper = '1';
      url = rel(url);
      if (tag === 'link') { el.rel = 'stylesheet'; el.href = url; }
      else { el.src = url; el.async = true; }
      el.onload = resolve; el.onerror = reject;
      document.head.appendChild(el);
      if (tag === 'link') resolve();
    });
  }
  function ensureSwiper() {
    if (window.Swiper) return Promise.resolve(true);
    return loadAsset('link', CONFIG.swiperCdnCss)
      .then(function () { return loadAsset('script', CONFIG.swiperCdnJs); })
      .then(function () { return !!window.Swiper; })
      .catch(function (err) { console.warn('[peipe-video] Swiper load failed', err); return false; });
  }

  function loadFeed(refresh) {
    if (state.feedLoading || (state.feedDone && !refresh)) return Promise.resolve();
    state.feedLoading = true;
    if (refresh) {
      state.feedPage = 1; state.feedDone = false; state.list = []; state.index = 0;
      state.players.forEach(function (p) { try { if (p.iframe) p.iframe.remove(); } catch (e) {} });
      state.players.clear(); state.imageSwipers.clear(); state.manualPausedKey = '';
      updateSwiperSlides(true);
    }
    return apiFetch('/api/v3/plugins/peipe-video/feed?page=' + state.feedPage + '&pageSize=' + CONFIG.pageSize)
      .then(function (json) {
        var payload = json.response || json;
        var items = (payload.items || []).map(function (item) {
          item.images = (item.images || []).slice(0, CONFIG.imageMax);
          item.viewer = item.viewer || { liked: false, following: false };
          item.counts = item.counts || { likes: 0, comments: 0 };
          item.text = displayText(item);
          item.title = cleanDisplayText(item.title || '');
          item.coverUrl = getCachedCoverUrl(item) || '';
          return item;
        }).filter(function (item) { return (item.tiktoks && item.tiktoks.length) || (item.images && item.images.length); });
        state.list = refresh ? items : state.list.concat(items);
        state.feedDone = payload.hasMore === false || !items.length;
        state.feedPage += 1;
        updateSwiperSlides(refresh);
        if (!state.list.length) showEmpty(TEXT.empty);
      })
      .catch(function (err) { console.error('[peipe-video] feed failed', err); showEmpty(err.message || TEXT.empty); })
      .finally(function () { state.feedLoading = false; });
  }

  function initSwiper() {
    var el = $('.pv-swiper', state.root);
    if (!el || !window.Swiper) return false;
    if (state.swiper) return true;
    state.swiper = new window.Swiper(el, {
      direction: 'vertical',
      slidesPerView: 1,
      speed: 240,
      threshold: 2,
      touchStartPreventDefault: false,
      touchMoveStopPropagation: false,
      touchReleaseOnEdges: false,
      resistanceRatio: 0.34,
      longSwipesRatio: 0.12,
      followFinger: true,
      watchSlidesProgress: true,
      preventClicks: false,
      preventClicksPropagation: false,
      passiveListeners: false,
      virtual: {
        enabled: true,
        addSlidesBefore: 2,
        addSlidesAfter: Math.max(5, CONFIG.preloadAhead + 2),
        slides: state.list.map(renderSlideHtml)
      },
      on: {
        init: function (swiper) {
          state.index = swiper.activeIndex || 0;
          afterVirtualUpdate();
          activateCurrent(false);
          showComposeFabInitial();
        },
        slideChangeTransitionStart: function (swiper) {
          state.hasInteracted = true;
          state.soundUnlocked = true;
          state.soundMuted = false;
          safeJsonSet('pv-sound-unlocked', true);
          safeJsonSet('pv-sound-muted', false);
          updateSoundUi();
          hideComposerFab();
          var targetIndex = typeof swiper.activeIndex === 'number' ? swiper.activeIndex : state.index;
          var previousIndex = typeof swiper.previousIndex === 'number' ? swiper.previousIndex : state.index;
          state.index = targetIndex;
          primeSlideForPlayback(targetIndex);
          warmVideoWindow(targetIndex);
          if (previousIndex !== targetIndex) pauseSlide(previousIndex, false);
        },
        slideChange: function (swiper) {
          state.index = swiper.activeIndex || 0;
          if (state.index >= state.list.length - 4) loadFeed(false);
          afterVirtualUpdate();
          activateCurrent(false);
        },
        virtualUpdate: function () { afterVirtualUpdate(); },
        reachEnd: function () { loadFeed(false); }
      }
    });
    return true;
  }
  function updateSwiperSlides(reset) {
    if (!state.swiper) { initSwiper(); return; }
    state.swiper.virtual.slides = state.list.map(renderSlideHtml);
    state.swiper.virtual.update(true);
    if (reset) state.swiper.slideTo(0, 0);
    afterVirtualUpdate();
  }
  function afterVirtualUpdate() {
    if (!state.root) return;
    $$('.pv-slide-item', state.root).forEach(function (slide) {
      var index = Number(slide.dataset.index || -1);
      slide.classList.toggle('is-active', index === state.index);
    });
    initImageSwipers();
    warmVideoWindow(state.index);
  }

  function getCachedCoverUrl(item) {
    item = item || {};
    var tk = item.tiktoks && item.tiktoks[0] || {};
    return item.coverUrl || item.coverURL || item.cover || item.thumbnailUrl || item.thumbnail_url || item.thumbnail ||
      tk.coverUrl || tk.coverURL || tk.cover || tk.thumbnailUrl || tk.thumbnail_url || tk.thumbnail || tk.cover_url || '';
  }
  function applyCoverToSlide(slide, url) {
    var cover = $('.pv-cover', slide);
    var img = $('.pv-cover img', slide);
    if (!cover || !img || !url) return false;
    img.onload = function () { cover.classList.remove('is-hidden'); cover.classList.add('has-cover'); };
    img.onerror = function () { cover.classList.remove('has-cover'); try { img.removeAttribute('src'); } catch (e) {} };
    if (img.getAttribute('src') !== url) img.src = url;
    return true;
  }
  function renderVideoCoverFallback(item, images) {
    var fallback = getCachedCoverUrl(item);
    if (!fallback && images && images.length) fallback = images[0];
    var hasFallback = !!fallback;
    return '<div class="pv-cover pv-cover-fallback-wrap' + (hasFallback ? ' has-cover' : '') + '">' +
      '<img ' + (hasFallback ? 'src="' + escapeHtml(fallback) + '" ' : '') + 'alt="" loading="eager" decoding="async">' +
      '<div class="pv-cover-fallback"><div class="pv-cover-glow"></div><div class="pv-cover-play">▶</div><div class="pv-cover-text">正在加载</div></div>' +
    '</div>';
  }
  function renderSlideHtml(item, index) {
    item = item || {};
    var text = displayText(item);
    var hasVideo = !!(item.tiktoks && item.tiktoks[0]);
    var images = (item.images || []).slice(0, CONFIG.imageMax);
    var mediaHtml = hasVideo ? '<div class="pv-video-shell" data-video-id="' + escapeHtml(item.tiktoks[0].videoId) + '"></div>' :
      (images.length ? renderImageMain(item) : '<div class="pv-error">这条动态没有 TikTok 或图片</div>');
    var author = item.author || {};
    var avatar = avatarSrc(author);
    var avatarHtml = avatar ? '<img class="pv-avatar" src="' + escapeHtml(avatar) + '" alt="avatar">' : '<div class="pv-avatar"></div>';
    var following = readFollow(author) || item.viewer.following;
    var liked = !!item.viewer.liked;
    return '' +
      '<section class="pv-slide-item ' + (hasVideo ? 'is-video' : 'is-image') + '" data-index="' + index + '" data-tid="' + escapeHtml(item.tid || '') + '">' +
        '<div class="pv-media">' + mediaHtml + '</div>' +
        (hasVideo ? renderVideoCoverFallback(item, images) : '') +
        '<div class="pv-gradient"></div>' +
        (hasVideo ? '<div class="pv-tap-zone" data-index="' + index + '"></div>' : '') +
        '<div class="pv-toolbar">' +
          '<div class="pv-avatar-wrap"><span class="pv-avatar-link">' + avatarHtml + '</span>' +
          (author.uid && !isOwnAuthor(author) ? '<button type="button" class="pv-follow-plus ' + (following ? 'is-following' : '') + '" data-index="' + index + '">' + (following ? '✓' : '+') + '</button>' : '') + '</div>' +
          '<button type="button" class="pv-action pv-like ' + (liked ? 'is-active' : '') + '" data-index="' + index + '"><span class="pv-action-icon">' + iconHeart(liked) + '</span><span>' + formatCount(item.counts.likes) + '</span></button>' +
          '<button type="button" class="pv-action pv-comment-btn" data-index="' + index + '"><span class="pv-action-icon">' + iconComment() + '</span><span>' + formatCount(item.counts.comments) + '</span></button>' +
          (hasVideo ? '<button type="button" class="pv-action pv-sound-btn ' + (!state.soundMuted && state.soundUnlocked ? 'is-active' : '') + '" data-index="' + index + '" aria-label="声音"><span class="pv-action-icon">' + iconSound(!state.soundMuted && state.soundUnlocked) + '</span><span class="pv-sound-label">声音</span></button>' : '') +
          (images.length && hasVideo ? '<button type="button" class="pv-action pv-album-btn" data-index="' + index + '"><span class="pv-action-icon">' + iconPhoto() + '</span><span>' + images.length + '</span></button>' : '') +
        '</div>' +
        '<div class="pv-desc">' +
          '<span class="pv-username">@' + escapeHtml(author.username || author.userslug || '用户') + '</span>' +
          (text ? '<div class="pv-text-row" data-index="' + index + '"><span class="pv-text-main">' + escapeHtml(text) + '</span> <button type="button" class="pv-translate-btn" data-index="' + index + '" aria-label="' + TEXT.translate + '" title="' + TEXT.translate + '">' + iconTranslate() + '</button></div><div class="pv-translated"></div>' : '') +
          '<div class="pv-time">' + relativeTime(item.createdAt) + '</div>' +
        '</div>' +
      '</section>';
  }
  function iconHeart() { return '<svg class="pv-heart-svg" viewBox="0 0 48 48" aria-hidden="true"><path d="M24 41s-2.2-1.3-5.2-3.4C10.2 31.4 5 25.8 5 18.6 5 12.7 9.5 8 15.2 8c3.5 0 6.6 1.8 8.8 4.7C26.2 9.8 29.3 8 32.8 8 38.5 8 43 12.7 43 18.6c0 7.2-5.2 12.8-13.8 19C26.2 39.7 24 41 24 41z"></path></svg>'; }
  function iconComment() { return '<svg class="pv-comment-svg" viewBox="0 0 48 48" aria-hidden="true"><path d="M24 7.5c-9.8 0-17.5 6.8-17.5 15.2 0 5.4 3.2 10.2 8 12.9l-.8 5.2 6.1-3.4c1.4.3 2.8.4 4.2.4 9.8 0 17.5-6.8 17.5-15.1S33.8 7.5 24 7.5z"></path><circle cx="17.4" cy="23.3" r="2.1"></circle><circle cx="24" cy="23.3" r="2.1"></circle><circle cx="30.6" cy="23.3" r="2.1"></circle></svg>'; }
  function iconTranslate() { return '<i class="fa-solid fa-language" aria-hidden="true"></i>'; }
  function iconMic() { return '<svg class="pv-mic-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3z"></path><path d="M5 11a7 7 0 0 0 14 0M12 18v3m-4 0h8"></path></svg>'; }
  function iconSend() { return '<svg class="pv-send-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h14M13 6l6 6-6 6"></path></svg>'; }
  function iconPhoto() { return '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M10 10h28a4 4 0 0 1 4 4v20a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V14a4 4 0 0 1 4-4zm5 23h18l-6-8-4 5-3-4-5 7zm2-13a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"></path></svg>'; }
  function iconSound(on) { return on ? '<svg class="pv-sound-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"></path><path d="M16 8.5a4 4 0 0 1 0 7M18.5 6a7.5 7.5 0 0 1 0 12"></path></svg>' : '<svg class="pv-sound-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"></path><path d="M17 9l4 4m0-4l-4 4"></path></svg>'; }

  function getImageIndex(item) {
    var key = String(item && (item.tid || item.pid || state.list.indexOf(item)) || '');
    return Math.max(0, Number(state.imageIndex.get(key) || 0));
  }
  function setImageIndex(item, index) {
    var key = String(item && (item.tid || item.pid || state.list.indexOf(item)) || '');
    var max = Math.max(0, (item.images || []).length - 1);
    state.imageIndex.set(key, Math.max(0, Math.min(max, index)));
  }
  function renderImageMain(item) {
    var images = (item.images || []).slice(0, CONFIG.imageMax);
    var slideIndex = state.list.indexOf(item);
    var slides = images.map(function (src, i) {
      return '<div class="swiper-slide pv-image-swiper-slide"><img src="' + escapeHtml(src) + '" alt="image ' + (i + 1) + '"></div>';
    }).join('');
    return '<div class="pv-image-main" data-index="' + slideIndex + '">' +
      '<div class="pv-image-swiper swiper" data-index="' + slideIndex + '"><div class="swiper-wrapper">' + slides + '</div>' +
      (images.length > 1 ? '<div class="pv-image-pagination"></div>' : '') + '</div></div>';
  }
  function initImageSwipers() {
    if (!window.Swiper) return;
    var live = new Set();
    $$('.pv-image-swiper', state.root).forEach(function (el) {
      var idx = Number(el.dataset.index || -1);
      live.add(idx);
      var old = state.imageSwipers.get(idx);
      if (old && old.el === el) return;
      if (old) { try { old.destroy(true, true); } catch (e) {} state.imageSwipers.delete(idx); }
      var item = state.list[idx];
      if (!item || !(item.images && item.images.length)) return;
      var swiper = new window.Swiper(el, {
        direction: 'horizontal',
        slidesPerView: 1,
        speed: 220,
        nested: true,
        resistanceRatio: 0.55,
        threshold: 3,
        pagination: { el: $('.pv-image-pagination', el), clickable: false },
        on: { slideChange: function (sw) { setImageIndex(item, sw.activeIndex || 0); } }
      });
      if (getImageIndex(item) > 0) swiper.slideTo(getImageIndex(item), 0);
      state.imageSwipers.set(idx, swiper);
    });
    state.imageSwipers.forEach(function (sw, idx) {
      if (live.has(idx)) return;
      try { sw.destroy(true, true); } catch (e) {}
      state.imageSwipers.delete(idx);
    });
  }
  function findSlide(index) { return $('.pv-slide-item[data-index="' + index + '"]', state.root); }

  function buildPlayerUrl(videoId, opts) {
    opts = opts || {};
    if (typeof opts === 'boolean') opts = { autoplay: opts };
    var params = new URLSearchParams({
      autoplay: opts.autoplay === false ? '0' : '1',
      muted: opts.muted ? '1' : '0',
      loop: '1',
      rel: '0',
      controls: opts.controls ? '1' : '0',
      progress_bar: opts.controls ? '1' : '0',
      play_button: '0',
      volume_control: '0',
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
  function playerKey(index, videoId) {
    var item = state.list[index] || {};
    return 'pv:' + String(item.tid || item.pid || index) + ':' + String(videoId || '');
  }
  function isWarmIndex(index) {
    var ahead = Math.max(1, Number(CONFIG.keepWarmVideoAhead || CONFIG.preloadVideoAhead || 2));
    var behind = Math.max(0, Number(CONFIG.keepWarmVideoBehind || 1));
    return index >= state.index - behind && index <= state.index + ahead;
  }
  function isCurrentPlayer(player) {
    return !!player && player.index === state.index;
  }
  function ensureTikTokPlayer(index, autoplay) {
    var item = state.list[index];
    var slide = findSlide(index);
    if (!slide || !item || !(item.tiktoks && item.tiktoks[0])) return null;
    var tk = item.tiktoks[0];
    var key = playerKey(index, tk.videoId);
    var player = state.players.get(key);
    if (player && player.iframe && player.iframe.parentNode && player.iframe.src !== 'about:blank') {
      player.index = index;
      player.item = item;
      if (index === state.index) {
        try { player.iframe.loading = 'eager'; player.iframe.fetchPriority = 'high'; } catch (e) {}
      }
      return player;
    }
    var shell = $('.pv-video-shell', slide);
    if (!shell) return null;
    shell.innerHTML = '';
    var iframe = document.createElement('iframe');
    var isCurrent = index === state.index;
    iframe.className = 'pv-tiktok-frame';
    // Always create as autoplay=1. Warm slides are muted, which lets mobile browsers preload more reliably.
    // Do not later change iframe.src just to switch autoplay; that discards the preload.
    iframe.src = buildPlayerUrl(tk.videoId, {
      autoplay: true,
      muted: !isCurrent || !state.soundUnlocked || state.soundMuted
    });
    iframe.allow = 'autoplay; fullscreen; encrypted-media; picture-in-picture';
    iframe.loading = 'eager';
    iframe.fetchPriority = isCurrent ? 'high' : 'low';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.title = 'TikTok Player';
    shell.appendChild(iframe);
    player = {
      key: key,
      index: index,
      item: item,
      videoId: tk.videoId,
      iframe: iframe,
      ready: false,
      wantPlay: false,
      status: 'loading',
      playSeq: 0,
      prewarmStarted: false,
      pauseRetryTimer: 0
    };
    state.players.set(key, player);
    var cachedCover = getCachedCoverUrl(item);
    if (cachedCover) {
      applyCoverToSlide(slide, cachedCover);
    } else {
      fetchCover(tk.videoId, tk.url).then(function (url) {
        if (url) applyCoverToSlide(slide, url);
      });
    }
    return player;
  }
  function prepareSlide(index, autoplay) {
    if (index < 0 || index >= state.list.length) return null;
    var item = state.list[index];
    if (!item || !(item.tiktoks && item.tiktoks[0])) return null;
    return ensureTikTokPlayer(index, !!autoplay);
  }
  function tryPlayPlayer(player, unmute) {
    if (!player || !player.iframe || player.iframe.src === 'about:blank') return;
    if (unmute && state.soundUnlocked && !state.soundMuted) sendToPlayer(player.iframe, 'unMute');
    else sendToPlayer(player.iframe, 'mute');
    sendToPlayer(player.iframe, 'play');
  }
  function currentPlayer() {
    var item = state.list[state.index];
    return item && item.tiktoks && item.tiktoks[0] ? state.players.get(playerKey(state.index, item.tiktoks[0].videoId)) : null;
  }
  function soundIsOn() { return !!(state.soundUnlocked && !state.soundMuted); }
  function updateSoundUi() {
    if (!state.root) return;
    var on = soundIsOn();
    $$('.pv-sound-btn', state.root).forEach(function (btn) {
      btn.classList.toggle('is-active', on);
      var icon = $('.pv-action-icon', btn);
      if (icon) icon.innerHTML = iconSound(on);
    });
  }
  function setSoundMuted(muted) {
    state.hasInteracted = true;
    state.soundUnlocked = true;
    state.soundMuted = !!muted;
    safeJsonSet('pv-sound-unlocked', true);
    safeJsonSet('pv-sound-muted', state.soundMuted);
    var player = currentPlayer();
    if (player && player.iframe) {
      if (state.soundMuted) {
        sendToPlayer(player.iframe, 'mute');
      } else {
        player.wantPlay = true;
        tryPlayPlayer(player, true);
      }
    }
    updateSoundUi();
  }
  function toggleSound(index) {
    if (typeof index === 'number' && index !== state.index && state.swiper) {
      try { state.swiper.slideTo(index, 180); } catch (e) {}
    }
    setSoundMuted(!state.soundMuted);
  }
  function schedulePrewarm(player) {
    if (!player || !player.iframe || isCurrentPlayer(player)) return;

    // TikTok iframes are heavy. Keep only the immediate next iframe warm by default.
    // Segment prewarm is optional because muted hidden playback can make low-end phones stutter.
    sendToPlayer(player.iframe, 'mute');

    if (!CONFIG.enableSegmentPrewarm || player.index !== state.index + 1) {
      if (player.ready && !player.wantPlay) {
        setTimeout(function () {
          if (!player || !player.iframe || isCurrentPlayer(player) || player.wantPlay) return;
          sendToPlayer(player.iframe, 'mute');
          sendToPlayer(player.iframe, 'pause');
          player.status = 'paused';
        }, 120);
      }
      return;
    }

    if (!player.ready || player.prewarmStarted) return;
    player.prewarmStarted = true;
    tryPlayPlayer(player, false);
    setTimeout(function () {
      if (!player || !player.iframe || isCurrentPlayer(player) || player.wantPlay) return;
      sendToPlayer(player.iframe, 'mute');
      sendToPlayer(player.iframe, 'pause');
      player.status = 'paused';
    }, CONFIG.segmentPrewarmMs);
  }
  function forcePlayerAutoplay(player) {
    // Kept for backward calls, but intentionally does not change iframe.src.
    // Reassigning src was the main reason preloaded TikTok iframes showed loading again.
    if (!player || !player.iframe) return null;
    player.wantPlay = true;
    try { player.iframe.loading = 'eager'; player.iframe.fetchPriority = 'high'; } catch (e) {}
    tryPlayPlayer(player, !!state.soundUnlocked);
    return player;
  }
  function primeSlideForPlayback(index) {
    var player = ensureTikTokPlayer(index, true);
    if (!player) return null;
    player.wantPlay = true;
    tryPlayPlayer(player, !!state.soundUnlocked);
    return player;
  }

  function warmVideoWindow(fromIndex) {
    if (fromIndex < 0 || fromIndex >= state.list.length) return;
    ensureTikTokPlayer(fromIndex, fromIndex === state.index);

    var behind = Math.max(0, Number(CONFIG.keepWarmVideoBehind || 1));
    for (var b = fromIndex - 1; b >= Math.max(0, fromIndex - behind); b -= 1) {
      var prev = state.list[b];
      if (prev && prev.tiktoks && prev.tiktoks[0]) {
        var prevPlayer = ensureTikTokPlayer(b, false);
        if (prevPlayer) {
          sendToPlayer(prevPlayer.iframe, 'mute');
          sendToPlayer(prevPlayer.iframe, 'pause');
        }
      }
    }

    var warmed = 0;
    var maxAhead = Math.max(1, Number(CONFIG.keepWarmVideoAhead || CONFIG.preloadVideoAhead || 2));
    var maxScan = Math.min(state.list.length - 1, fromIndex + Math.max(8, CONFIG.preloadAhead + 4));
    for (var i = fromIndex + 1; i <= maxScan && warmed < maxAhead; i += 1) {
      var item = state.list[i];
      if (item && item.tiktoks && item.tiktoks[0]) {
        var p = ensureTikTokPlayer(i, false);
        schedulePrewarm(p);
        warmed += 1;
      }
    }
  }
  function sendToPlayer(iframe, type, value) {
    if (!iframe || !iframe.contentWindow || iframe.src === 'about:blank') return;
    var msg = { 'x-tiktok-player': true, type: type };
    if (arguments.length >= 3) msg.value = value;
    iframe.contentWindow.postMessage(msg, 'https://www.tiktok.com');
  }
  function hardStopPlayer(player, force) {
    if (!player || !player.iframe) return;
    sendToPlayer(player.iframe, 'pause');
    setTimeout(function () { sendToPlayer(player.iframe, 'pause'); }, 40);
    var stop = function () {
      if (!player || !player.iframe) return;
      if (!force && (player.index === state.index || isWarmIndex(player.index))) return;
      try {
        player.iframe.src = 'about:blank';
        if (player.iframe.parentNode) player.iframe.remove();
      } catch (e) {}
      player.ready = false;
      player.status = 'paused';
      player.wantPlay = false;
      state.players.delete(player.key);
    };
    if (force) stop();
    else setTimeout(stop, 650);
  }
  function playSlide(index, userGesture) {
    var item = state.list[index];
    if (!item || !(item.tiktoks && item.tiktoks[0])) { warmVideoWindow(index); return; }
    var videoId = item.tiktoks[0].videoId;
    var key = playerKey(index, videoId);
    if (state.manualPausedKey === key && !userGesture) return;
    if (userGesture) {
      state.hasInteracted = true;
      state.soundUnlocked = true;
      safeJsonSet('pv-sound-unlocked', true);
    }
    var player = ensureTikTokPlayer(index, true);
    if (!player || !player.iframe) return;
    state.manualPausedKey = '';
    player.wantPlay = true;
    player.playSeq = (player.playSeq || 0) + 1;
    var seq = player.playSeq;
    pauseOtherPlayers(player.key);
    var slide = findSlide(index);
    if (slide) slide.classList.add('is-loading');

    function stillWantsPlay() {
      return player.wantPlay && player.playSeq === seq && state.manualPausedKey !== player.key && player.index === state.index;
    }
    function requestPlay() {
      if (!stillWantsPlay() || player.status === 'playing') return;
      tryPlayPlayer(player, !!state.soundUnlocked);
    }
    requestPlay();
    setTimeout(requestPlay, 420);
    setTimeout(requestPlay, 1200);
    setTimeout(function () { if (stillWantsPlay() && player.status !== 'playing') markSlidePlaying(index); }, 1900);
    warmVideoWindow(index);
  }
  function pauseSlide(index, force, manual) {
    state.players.forEach(function (p) {
      if (p.index !== index) return;
      p.wantPlay = false;
      p.status = 'paused';
      p.playSeq = (p.playSeq || 0) + 1;
      if (manual) state.manualPausedKey = p.key;
      if (p.pauseRetryTimer) { clearTimeout(p.pauseRetryTimer); p.pauseRetryTimer = 0; }
      if (p.iframe) {
        sendToPlayer(p.iframe, 'mute');
        sendToPlayer(p.iframe, 'pause');
        setTimeout(function () { sendToPlayer(p.iframe, 'pause'); }, 80);
      }
      if (force || (!manual && !isWarmIndex(p.index))) hardStopPlayer(p, !!force);
    });
    var slide = findSlide(index);
    if (slide) slide.classList.remove('is-playing', 'is-loading');
  }
  function pauseOtherPlayers(currentKey) {
    state.players.forEach(function (p, key) {
      if (key === currentKey) return;
      p.wantPlay = false;
      p.playSeq = (p.playSeq || 0) + 1;
      if (p.pauseRetryTimer) { clearTimeout(p.pauseRetryTimer); p.pauseRetryTimer = 0; }
      var warm = isWarmIndex(p.index);
      if (p.iframe) {
        sendToPlayer(p.iframe, 'mute');
        if (warm && p.index > state.index) {
          schedulePrewarm(p);
        } else {
          sendToPlayer(p.iframe, 'pause');
        }
      }
      if (!warm || Math.abs(p.index - state.index) > CONFIG.preloadAhead) hardStopPlayer(p, true);
      var slide = findSlide(p.index);
      if (slide) slide.classList.remove('is-playing', 'is-loading');
    });
  }
  function prunePlayers() {
    var ahead = Math.max(1, Number(CONFIG.keepWarmVideoAhead || CONFIG.preloadVideoAhead || 2));
    var behind = Math.max(0, Number(CONFIG.keepWarmVideoBehind || 1));
    state.players.forEach(function (p) {
      if (p.index >= state.index - behind && p.index <= state.index + ahead) return;
      hardStopPlayer(p, true);
    });
  }
  function activateCurrent() {
    state.index = state.swiper ? state.swiper.activeIndex : state.index;
    $$('.pv-slide-item', state.root).forEach(function (slide) {
      var idx = Number(slide.dataset.index || -1);
      slide.classList.toggle('is-active', idx === state.index);
      if (idx !== state.index) slide.classList.remove('is-playing', 'is-loading');
    });
    var item = state.list[state.index];
    var currentKey = item && item.tiktoks && item.tiktoks[0] ? playerKey(state.index, item.tiktoks[0].videoId) : '';
    if (currentKey !== state.manualPausedKey) playSlide(state.index, !!(state.hasInteracted || state.soundUnlocked));
    else warmVideoWindow(state.index);
    prunePlayers();
  }
  function markSlidePlaying(index) {
    var slide = findSlide(index);
    if (!slide) return;
    var cover = $('.pv-cover', slide);
    if (cover) cover.classList.add('is-hidden');
    slide.classList.add('is-playing');
    slide.classList.remove('is-loading');
    updateSoundUi();
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
      if (data.type === 'onPlayerReady') {
        player.ready = true;
        if (player.index === state.index && player.wantPlay && state.manualPausedKey !== player.key) {
          tryPlayPlayer(player, !!state.soundUnlocked);
        } else if (isWarmIndex(player.index)) {
          schedulePrewarm(player);
        }
        return;
      }
      if (data.type === 'onStateChange') {
        var value = Number(data.value); var word = String(data.value || '').toLowerCase();
        if (value === 1 || word === 'playing') {
          player.status = 'playing';
          if (player.index === state.index) {
            if (state.hasInteracted || state.soundUnlocked) safeJsonSet('pv-sound-unlocked', true);
            markSlidePlaying(player.index);
          } else {
            // Warm iframe may briefly play muted to pull the first segment. Never let it affect current slide.
            if (!isWarmIndex(player.index)) sendToPlayer(player.iframe, 'pause');
          }
        } else if (value === 2 || value === 0 || word === 'paused' || word === 'ended') {
          player.status = 'paused';
          var s = findSlide(player.index);
          if (s) s.classList.remove('is-loading');
          if (player.index === state.index && player.wantPlay && state.manualPausedKey !== player.key) {
            if (player.pauseRetryTimer) clearTimeout(player.pauseRetryTimer);
            player.pauseRetryTimer = setTimeout(function () {
              if (player.index === state.index && player.wantPlay && state.manualPausedKey !== player.key && player.status !== 'playing') {
                tryPlayPlayer(player, !!state.soundUnlocked);
              }
            }, 520);
          }
        } else if (value === 3 || word === 'buffering') {
          var s2 = findSlide(player.index); if (s2 && player.index === state.index && player.wantPlay) s2.classList.add('is-loading');
        }
      }
    });
  });
  function coverCacheKey(videoId) { return 'pv-cover:' + videoId; }
  function fetchCover(videoId, url) {
    var cached = safeJsonGet(coverCacheKey(videoId), null);
    if (cached && cached.url && cached.expiresAt > Date.now()) return Promise.resolve(cached.url);
    var canonical = canonicalTikTokUrl(url);
    if (!/^https?:\/\//i.test(canonical)) return Promise.resolve('');
    return fetch('https://www.tiktok.com/oembed?url=' + encodeURIComponent(canonical), { cache: 'force-cache' })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (json) {
        var thumb = json.thumbnail_url || '';
        if (thumb) {
          safeJsonSet(coverCacheKey(videoId), { url: thumb, expiresAt: Date.now() + CONFIG.coverCacheMs });
          saveCoverToServer(videoId, canonical, thumb);
        }
        return thumb;
      })
      .catch(function () { return ''; });
  }
  function saveCoverToServer(videoId, url, coverUrl) {
    if (!videoId || !coverUrl || !CONFIG.coverCacheEndpoint) return;
    var key = 'pv-cover-server-sent:' + videoId;
    var sent = safeJsonGet(key, null);
    if (sent && sent.coverUrl === coverUrl && sent.expiresAt > Date.now()) return;
    apiFetch(CONFIG.coverCacheEndpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8', 'x-csrf-token': csrfToken() },
      body: JSON.stringify({ videoId: String(videoId), url: url || '', coverUrl: coverUrl })
    }).then(function () {
      safeJsonSet(key, { coverUrl: coverUrl, expiresAt: Date.now() + CONFIG.coverCacheMs });
    }).catch(function () {});
  }

  function localUserSuffix() { var u = currentUser(); return String(u && u.uid || 'guest'); }
  function voteStoreKey() { return 'pv-vote-state:' + localUserSuffix(); }
  function voteStore() { return safeJsonGet(voteStoreKey(), {}); }
  function readVote(pid, tid) { var s = voteStore(); if (pid && s['pid:' + pid] !== undefined) return !!s['pid:' + pid]; if (tid && s['tid:' + tid] !== undefined) return !!s['tid:' + tid]; return false; }
  function writeVote(pid, tid, voted) { var s = voteStore(); if (pid) s['pid:' + pid] = !!voted; if (tid) s['tid:' + tid] = !!voted; safeJsonSet(voteStoreKey(), s); }
  function updateLikeUi(slide, item) {
    if (!slide) return; var btn = $('.pv-like', slide); if (!btn) return;
    btn.classList.toggle('is-active', !!item.viewer.liked);
    var icon = $('.pv-action-icon', btn); if (icon) icon.innerHTML = iconHeart();
    var count = $('span:last-child', btn); if (count) count.textContent = formatCount(item.counts.likes);
  }
  function toggleLike(item, slide, optimistic, point) {
    if (!isLoggedIn()) return alertError(TEXT.loginFirst);
    if (!item || !item.pid) return alertError(TEXT.likeFail);
    if (item._votePending) return;
    var old = !!(item.viewer && item.viewer.liked);
    var oldCount = Math.max(0, Number(item.counts && item.counts.likes || 0));
    var next = !old;
    item._votePending = true;
    item.viewer = item.viewer || {};
    item.counts = item.counts || {};
    item.viewer.liked = next;
    item.counts.likes = Math.max(0, oldCount + (next ? 1 : -1));
    updateLikeUi(slide, item);
    if (point && next) showHeart(point.x, point.y);
    apiFetch('/api/v3/posts/' + encodeURIComponent(item.pid) + '/vote', {
      method: next ? 'PUT' : 'DELETE',
      headers: { 'content-type': 'application/json; charset=utf-8', 'x-csrf-token': csrfToken() },
      body: JSON.stringify({ delta: 1 })
    }).then(function (json) {
      var payload = json && (json.response || json) || {};
      var votes = payload.votes || payload.upvotes || payload.voteCount;
      item.viewer.liked = next;
      if (votes !== undefined && votes !== null && !Number.isNaN(Number(votes))) item.counts.likes = Math.max(0, Number(votes));
      writeVote(item.pid, item.tid, next);
      updateLikeUi(slide, item);
    }).catch(function (err) {
      item.viewer.liked = old;
      item.counts.likes = oldCount;
      writeVote(item.pid, item.tid, old);
      updateLikeUi(slide, item);
      alertError((err && err.message) || (next ? TEXT.likeFail : TEXT.unlikeFail));
    }).finally(function () {
      item._votePending = false;
    });
  }
  function showHeart(x, y) {
    var heart = document.createElement('div');
    heart.className = 'pv-heart-burst'; heart.textContent = '♥'; heart.style.left = x + 'px'; heart.style.top = y + 'px';
    state.root.appendChild(heart); setTimeout(function () { heart.remove(); }, 760);
  }
  function followStoreKey() { return 'pv-follow-state:' + localUserSuffix(); }
  function followStore() { return safeJsonGet(followStoreKey(), {}); }
  function readFollow(author) { if (!author) return false; var s = followStore(); if (author.uid && s['uid:' + author.uid] !== undefined) return !!s['uid:' + author.uid]; if (author.userslug && s['slug:' + String(author.userslug).toLowerCase()] !== undefined) return !!s['slug:' + String(author.userslug).toLowerCase()]; return false; }
  function writeFollow(author, following) { var s = followStore(); if (author.uid) s['uid:' + author.uid] = !!following; if (author.userslug) s['slug:' + String(author.userslug).toLowerCase()] = !!following; safeJsonSet(followStoreKey(), s); }
  function updateFollowUi(slide, following) { var btn = $('.pv-follow-plus', slide); if (!btn) return; btn.classList.toggle('is-following', !!following); btn.textContent = following ? '✓' : '+'; }
  function toggleFollow(item, slide) {
    if (!isLoggedIn()) return alertError(TEXT.loginFirst);
    var author = item.author || {}; if (!author.uid) return alertError(TEXT.followFail);
    var old = readFollow(author); var next = !old; writeFollow(author, next); updateFollowUi(slide, next);
    apiFetch('/api/v3/users/' + encodeURIComponent(author.uid) + '/follow', { method: next ? 'PUT' : 'DELETE', headers: { 'x-csrf-token': csrfToken() } })
      .then(function () { alertSuccess(next ? TEXT.followed : TEXT.unfollowed); })
      .catch(function () { writeFollow(author, old); updateFollowUi(slide, old); alertError(next ? TEXT.followFail : TEXT.unfollowFail); });
  }

  var LANGUAGE_META = {
    auto: { flag: '🌐', label: '自动检测' }, zh: { flag: '🇨🇳', label: '中文' }, en: { flag: '🇺🇸', label: 'English' },
    my: { flag: '🇲🇲', label: 'မြန်မာ' }, mm: { flag: '🇲🇲', label: 'မြန်မာ' }, th: { flag: '🇹🇭', label: 'ไทย' },
    vi: { flag: '🇻🇳', label: 'Tiếng Việt' }, km: { flag: '🇰🇭', label: 'ភាសាខ្មែរ' }, lo: { flag: '🇱🇦', label: 'ລາວ' },
    ja: { flag: '🇯🇵', label: '日本語' }, ko: { flag: '🇰🇷', label: '한국어' }, ms: { flag: '🇲🇾', label: 'Malay' },
    tl: { flag: '🇵🇭', label: 'Tagalog' }, id: { flag: '🇮🇩', label: 'Indonesia' }, fr: { flag: '🇫🇷', label: 'Français' },
    de: { flag: '🇩🇪', label: 'Deutsch' }, es: { flag: '🇪🇸', label: 'Español' }, ru: { flag: '🇷🇺', label: 'Русский' }
  };
  var DEFAULT_AI_PROMPT = '你是专业论坛翻译助手。请把用户提供的内容从 {{sourceLang}} 翻译为 {{targetLang}}。保留原有语气、换行、链接、用户名、表情和列表结构。只输出译文，不要解释。';
  function normalizeLang(code, fallback) { code = norm(code).toLowerCase().replace(/_/g, '-'); if (!code) return fallback || 'auto'; var short = code.split('-')[0]; return LANGUAGE_META[code] ? code : (LANGUAGE_META[short] ? short : (fallback || code)); }
  function langOptions(includeAuto) {
    var arr = includeAuto ? ['auto','zh','en','my','th','vi','km','lo','ja','ko','ms','tl','id','fr','de','es','ru'] : ['zh','en','my','th','vi','km','lo','ja','ko','ms','tl','id','fr','de','es','ru'];
    return arr.map(function (code) { var m = LANGUAGE_META[code] || { label: code, flag: '🏳️' }; return '<option value="' + code + '">' + m.flag + ' ' + m.label + '</option>'; }).join('');
  }
  function getTranslateSettings() {
    var saved = safeJsonGet('pv-translate-settings', {}) || {};
    return {
      provider: saved.provider === 'ai' ? 'ai' : 'google',
      sourceLang: normalizeLang(saved.sourceLang, 'auto'),
      targetLang: normalizeLang(saved.targetLang, (navigator.language || 'zh').split('-')[0] || 'zh'),
      aiEndpoint: saved.aiEndpoint || '', aiModel: saved.aiModel || '', aiApiKey: saved.aiApiKey || '',
      aiPrompt: saved.aiPrompt || DEFAULT_AI_PROMPT,
      temperature: Number.isFinite(Number(saved.temperature)) ? Number(saved.temperature) : 0.3
    };
  }
  function translateCacheKey(text) { var s = getTranslateSettings(); return 'pv-tr:' + s.provider + ':' + (s.aiModel || 'google') + ':' + s.sourceLang + ':' + s.targetLang + ':' + encodeURIComponent(norm(text)).slice(0, 240); }
  function normalizeAiEndpoint(url) { url = norm(url); if (!url) return ''; if (/\/(chat\/completions|responses)$/i.test(url)) return url; return url.replace(/\/+$/, '') + '/chat/completions'; }
  function extractAiText(data) {
    if (data && Array.isArray(data.choices) && data.choices[0] && data.choices[0].message) {
      var c = data.choices[0].message.content;
      if (typeof c === 'string') return norm(c);
      if (Array.isArray(c)) return norm(c.map(function (p) { return p && (p.text || p.output_text || '') || ''; }).join(''));
    }
    if (data && typeof data.output_text === 'string') return norm(data.output_text);
    return '';
  }
  function translateViaAI(text, settings) {
    if (!settings.aiEndpoint || !settings.aiModel || !settings.aiApiKey) return Promise.reject(new Error('AI translate not configured'));
    var prompt = String(settings.aiPrompt || DEFAULT_AI_PROMPT).replace(/{{\s*sourceLang\s*}}/gi, settings.sourceLang || 'auto').replace(/{{\s*targetLang\s*}}/gi, settings.targetLang || 'zh');
    return fetch(normalizeAiEndpoint(settings.aiEndpoint), {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + settings.aiApiKey },
      body: JSON.stringify({ model: settings.aiModel, temperature: settings.temperature, messages: [{ role: 'system', content: prompt }, { role: 'user', content: text }] })
    }).then(function (res) { return res.json().catch(function () { return {}; }).then(function (json) { if (!res.ok) throw new Error(json.error && json.error.message || 'AI translate failed'); return json; }); })
      .then(function (json) { var out = extractAiText(json); if (!out) throw new Error('empty AI translation'); return out; });
  }
  function translateViaGoogle(text, settings) {
    var url = 'https://translate.googleapis.com/translate_a/single?' + new URLSearchParams({ client: 'gtx', sl: settings.sourceLang || 'auto', tl: settings.targetLang || 'zh', dt: 't', q: text }).toString();
    return fetch(url, { credentials: 'omit', cache: 'force-cache' }).then(function (res) { if (!res.ok) throw new Error('translate ' + res.status); return res.json(); }).then(function (data) {
      var parts = Array.isArray(data && data[0]) ? data[0] : [];
      return norm(parts.map(function (p) { return p && p[0] ? p[0] : ''; }).join(''));
    });
  }
  function translateText(text) {
    var clean = cleanDisplayText(text).replace(/https?:\/\/\S+/g, '').trim();
    if (!clean) return Promise.resolve('');
    var key = translateCacheKey(clean); var cached = safeJsonGet(key, null);
    if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.text || '');
    var settings = getTranslateSettings();
    var p = settings.provider === 'ai' ? translateViaAI(clean, settings) : translateViaGoogle(clean, settings);
    return p.then(function (out) { out = norm(out); if (out) safeJsonSet(key, { text: out, expiresAt: Date.now() + CONFIG.translateCacheMs }); return out; });
  }
  function translateSlide(item, slide) {
    var box = $('.pv-translated', slide); if (!box) return;
    if (box.classList.contains('is-show') && box.dataset.loaded === '1') { box.classList.remove('is-show'); return; }
    box.classList.add('is-show'); box.textContent = TEXT.translating;
    translateText(item.text || item.title).then(function (out) { box.textContent = out || ''; box.dataset.loaded = out ? '1' : '0'; if (!out) box.classList.remove('is-show'); }).catch(function () { box.textContent = TEXT.translateFail; });
  }
  function translateElementText(text, target) {
    target.classList.add('is-show'); target.textContent = TEXT.translating;
    return translateText(text).then(function (out) { target.textContent = out || ''; if (!out) target.classList.remove('is-show'); }).catch(function () { target.textContent = TEXT.translateFail; });
  }
  function openTranslateSettings() {
    var panel = $('.pv-translate-panel', state.root); var backdrop = $('.pv-modal-backdrop', state.root); var s = getTranslateSettings();
    $('[name="sourceLang"]', panel).value = s.sourceLang || 'auto'; $('[name="targetLang"]', panel).value = s.targetLang || 'zh'; $('[name="provider"]', panel).value = s.provider || 'google';
    $('[name="aiEndpoint"]', panel).value = s.aiEndpoint || ''; $('[name="aiModel"]', panel).value = s.aiModel || ''; $('[name="aiApiKey"]', panel).value = s.aiApiKey || ''; $('[name="aiPrompt"]', panel).value = s.aiPrompt || DEFAULT_AI_PROMPT;
    panel.classList.toggle('is-ai', s.provider === 'ai');
    $$('.pv-provider-tab', panel).forEach(function (t) { t.classList.toggle('is-active', (t.dataset.provider || 'google') === (s.provider || 'google')); });
    panel.classList.add('is-open'); backdrop.classList.add('is-open');
  }
  function closeTranslateSettings() { $('.pv-translate-panel', state.root).classList.remove('is-open'); $('.pv-modal-backdrop', state.root).classList.remove('is-open'); }

  function isAudioHref(href) { return RE.audioExt.test(String(href || '').split('?')[0]) || /[?&](?:haa8dur|dur|duration)=/i.test(String(href || '')); }
  function parseDurationFromUrl(url) { try { var u = new URL(String(url || ''), location.origin); var raw = u.searchParams.get('haa8dur') || u.searchParams.get('dur') || u.searchParams.get('duration'); return Math.max(0, Number(raw || 0) || 0); } catch (e) { var m = String(url || '').match(/[?&](?:haa8dur|dur|duration)=(\d+(?:\.\d+)?)/i); return m ? Number(m[1]) || 0 : 0; } }
  function extractAudiosFromContent(content) {
    var out = []; var raw = String(content || '');
    raw.replace(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/ig, function (m, href, label) { if (isAudioHref(href) && !out.some(function (a) { return a.url === href; })) out.push({ url: href, label: norm(label.replace(/<[^>]*>/g, '')) || TEXT.voiceMsg }); return m; });
    raw.replace(/\[([^\]]*)\]\(([^)]+)\)/g, function (m, label, href) { if (isAudioHref(href) && !out.some(function (a) { return a.url === href; })) out.push({ url: href, label: norm(label) || TEXT.voiceMsg }); return m; });
    return out;
  }
  function voiceBars() { return [9,14,19,11,22,16,12,20,10,17,13,18].map(function (h) { return '<i style="height:' + h + 'px"></i>'; }).join(''); }
  function renderVoiceCard(audio, cls) { var dur = parseDurationFromUrl(audio.url); return '<button type="button" class="pv-voice-card ' + (cls || '') + '" data-src="' + escapeHtml(audio.url) + '" data-duration="' + dur + '"><span class="pv-voice-play">▶</span><span class="pv-voice-wave">' + voiceBars() + '</span><span class="pv-voice-time">' + formatDuration(dur) + '</span></button>'; }
  function toggleVoiceCard(card) {
    if (!card) return; var src = card.dataset.src; if (!src) return;
    var audio = card._pvAudio || new Audio(src); card._pvAudio = audio; audio.preload = 'metadata';
    $$('.pv-voice-card.playing', state.root).forEach(function (node) { if (node !== card && node._pvAudio) { node._pvAudio.pause(); node.classList.remove('playing'); $('.pv-voice-play', node).textContent = '▶'; } });
    audio.onloadedmetadata = function () { if (audio.duration && isFinite(audio.duration)) $('.pv-voice-time', card).textContent = formatDuration(audio.duration); };
    audio.ontimeupdate = function () { if (!audio.paused) $('.pv-voice-time', card).textContent = formatDuration(audio.currentTime); };
    audio.onended = function () { card.classList.remove('playing'); $('.pv-voice-play', card).textContent = '▶'; audio.currentTime = 0; };
    if (audio.paused) { audio.play().then(function () { card.classList.add('playing'); $('.pv-voice-play', card).textContent = '❚❚'; }).catch(function () {}); }
    else { audio.pause(); card.classList.remove('playing'); $('.pv-voice-play', card).textContent = '▶'; }
  }

  function normalizeAuthor(user, fallback) {
    user = user || {}; fallback = fallback || {};
    var uid = String(user.uid || user.userId || user.userid || fallback.uid || '');
    var username = norm(user.displayname || user.displayName || user.username || fallback.username || fallback.displayname || fallback.userslug || '用户');
    var userslug = String(user.userslug || fallback.userslug || username || '').replace(/^@/, '');
    var picture = user.picture || user.uploadedpicture || user.avatar || fallback.picture || fallback.uploadedpicture || '';
    return { uid: uid, username: username, userslug: userslug, picture: picture };
  }
  function fitCommentsPanelHeight() {
    var panel = $('.pv-comments-panel', state.root);
    if (!panel || !panel.classList.contains('is-open')) return;
    window.requestAnimationFrame(function () {
      var head = $('.pv-panel-head', panel);
      var grip = $('.pv-panel-grip', panel);
      var list = $('.pv-comments-list', panel);
      var reply = $('.pv-reply-bar', panel);
      var voice = $('.pv-comment-voice-preview', panel);
      var rec = $('.pv-comment-record-panel', panel);
      var send = $('.pv-comment-send-row', panel);
      var extra = 30;
      var content = extra +
        (grip ? grip.offsetHeight : 0) +
        (head ? head.offsetHeight : 0) +
        (reply && reply.classList.contains('is-open') ? reply.offsetHeight : 0) +
        (voice && voice.classList.contains('is-open') ? voice.offsetHeight : 0) +
        (rec && rec.classList.contains('is-open') ? rec.offsetHeight : 0) +
        (send ? send.offsetHeight : 0) +
        Math.min(list ? list.scrollHeight : 0, Math.round(window.innerHeight * 0.56));
      var minH = Math.min(Math.round(window.innerHeight * 0.30), 260);
      var maxH = Math.min(Math.round(window.innerHeight * 0.88), 760);
      var h = Math.max(minH, Math.min(maxH, content));
      panel.style.setProperty('height', h + 'px', 'important');
      panel.style.setProperty('max-height', maxH + 'px', 'important');
      if (list) list.style.setProperty('max-height', Math.max(96, h - ((grip ? grip.offsetHeight : 0) + (head ? head.offsetHeight : 0) + (reply && reply.classList.contains('is-open') ? reply.offsetHeight : 0) + (voice && voice.classList.contains('is-open') ? voice.offsetHeight : 0) + (rec && rec.classList.contains('is-open') ? rec.offsetHeight : 0) + (send ? send.offsetHeight : 0) + 42)) + 'px', 'important');
    });
  }
  function openComments(item) {
    state.comments.item = item; state.comments.replyTo = null;
    var panel = $('.pv-comments-panel', state.root);
    $('.pv-drawer-backdrop', state.root).classList.add('is-open'); panel.classList.add('is-open'); panel.style.transform = '';
    $('.pv-comments-title', panel).textContent = TEXT.comments + ' ' + formatCount(item.counts.comments);
    $('.pv-comments-list', panel).innerHTML = '<div class="pv-meta">加载中...</div>';
    $('.pv-comment-input', panel).placeholder = TEXT.commentPlaceholder; updateCommentActionButton(); fitCommentsPanelHeight();
    $('.pv-reply-bar', panel).classList.remove('is-open');
    apiFetch('/api/topic/' + encodeURIComponent(item.tid)).then(function (json) {
      state.comments.posts = Array.isArray(json.posts) ? json.posts.slice(1) : [];
      renderComments(state.comments.posts);
    }).catch(function () { $('.pv-comments-list', panel).innerHTML = '<div class="pv-meta">加载失败，<a href="' + item.href + '">' + TEXT.openTopic + '</a></div>'; fitCommentsPanelHeight(); });
  }
  function closeComments() { stopCommentRecording(true); setCommentVoice(null, 0); var p = $('.pv-comments-panel', state.root); if (p) { p.classList.remove('is-open'); p.style.height = ''; } $('.pv-drawer-backdrop', state.root).classList.remove('is-open'); }
  function renderComments(posts) {
    var list = $('.pv-comments-list', state.root);
    if (!posts.length) { list.innerHTML = '<div class="pv-meta pv-empty-comments">' + TEXT.noComments + '</div>'; fitCommentsPanelHeight(); return; }
    list.innerHTML = posts.map(function (post) {
      var user = normalizeAuthor(post.user || post, {}); var content = post.content || post.raw || '';
      var div = document.createElement('div'); div.innerHTML = content;
      var text = cleanDisplayText(div.textContent || content); var audios = extractAudiosFromContent(content);
      var avatar = user.picture ? '<img src="' + escapeHtml(user.picture) + '" alt="avatar">' : '<img alt="avatar">';
      return '<div class="pv-comment" data-pid="' + escapeHtml(post.pid || '') + '" data-username="' + escapeHtml(user.username || '用户') + '">' + avatar + '<div class="pv-comment-body"><div class="pv-comment-name">' + escapeHtml(user.username || '用户') + '</div>' +
        (text ? '<div class="pv-comment-text">' + escapeHtml(text) + '</div>' : '') + audios.map(function (a) { return renderVoiceCard(a, ''); }).join('') + '<div class="pv-comment-translated"></div><div class="pv-comment-actions"><button type="button" class="pv-comment-reply">' + TEXT.replyTo + '</button><button type="button" class="pv-comment-translate" aria-label="' + TEXT.translate + '" title="' + TEXT.translate + '">' + iconTranslate() + '</button></div></div></div>';
    }).join('');
    fitCommentsPanelHeight();
  }
  function setReplyTarget(commentEl) {
    var username = commentEl.dataset.username || '用户'; var pid = commentEl.dataset.pid || '';
    state.comments.replyTo = { username: username, pid: pid };
    var panel = $('.pv-comments-panel', state.root);
    $('.pv-reply-bar', panel).classList.add('is-open'); $('.pv-reply-name', panel).textContent = '@' + username;
    $('.pv-comment-input', panel).placeholder = TEXT.replyTo + ' @' + username;
    $('.pv-comment-input', panel).focus();
    fitCommentsPanelHeight();
  }
  function clearReplyTarget() { state.comments.replyTo = null; var panel = $('.pv-comments-panel', state.root); $('.pv-reply-bar', panel).classList.remove('is-open'); $('.pv-comment-input', panel).placeholder = TEXT.commentPlaceholder; updateCommentActionButton(); fitCommentsPanelHeight(); }
  function setCommentVoice(blob, duration) {
    if (state.comments.voiceUrl) { try { URL.revokeObjectURL(state.comments.voiceUrl); } catch (e) {} }
    state.comments.voiceBlob = blob || null;
    state.comments.voiceDuration = Math.max(0, Math.round(Number(duration) || 0));
    state.comments.voiceUrl = blob ? URL.createObjectURL(blob) : '';
    var wrap = $('.pv-comment-voice-preview', state.root);
    if (!wrap) return;
    wrap.innerHTML = blob ? renderVoiceCard({ url: state.comments.voiceUrl }, 'is-preview') + '<button type="button" class="pv-comment-voice-remove">×</button>' : '';
    wrap.classList.toggle('is-open', !!blob); updateCommentActionButton(); fitCommentsPanelHeight();
  }
  function recorderMime() { if (!window.MediaRecorder) return ''; return ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg'].find(function (t) { return MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t); }) || ''; }
  function toggleCommentRecording() {
    var btn = $('.pv-comment-action-btn', state.root);
    if (state.comments.mediaRecorder && state.comments.mediaRecorder.state === 'recording') { stopCommentRecording(false); return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) return alertError('当前浏览器不支持录音');
    navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } }).catch(function () { return navigator.mediaDevices.getUserMedia({ audio: true }); }).then(function (stream) {
      state.comments.stream = stream; state.comments.chunks = []; state.comments.startAt = Date.now();
      var mime = recorderMime(); var rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 16000 } : { audioBitsPerSecond: 16000 }); state.comments.mediaRecorder = rec;
      rec.ondataavailable = function (e) { if (e.data && e.data.size) state.comments.chunks.push(e.data); };
      rec.onstop = function () { var dur = Math.max(1, Math.round((Date.now() - state.comments.startAt) / 1000)); if (state.comments.stream) state.comments.stream.getTracks().forEach(function (t) { t.stop(); }); clearInterval(state.comments.timer); btn.classList.remove('recording'); $('.pv-comment-record-panel', state.root).classList.remove('is-open'); updateCommentActionButton(); if (state.comments.chunks.length) setCommentVoice(new Blob(state.comments.chunks, { type: state.comments.chunks[0].type || mime || 'audio/webm' }), dur); };
      rec.start(250); btn.classList.add('recording'); $('.pv-comment-record-panel', state.root).classList.add('is-open'); state.comments.timer = setInterval(function () { var sec = Math.max(0, Math.floor((Date.now() - state.comments.startAt) / 1000)); var el = $('.pv-record-time', state.root); if (el) el.textContent = formatDuration(sec); }, 250);
    }).catch(function () { alertError('麦克风权限未开启'); });
  }
  function stopCommentRecording() { var rec = state.comments.mediaRecorder; if (rec && rec.state === 'recording') { try { rec.stop(); } catch (e) {} } if (state.comments.stream) state.comments.stream.getTracks().forEach(function (t) { t.stop(); }); clearInterval(state.comments.timer); var panel = $('.pv-comment-record-panel', state.root); if (panel) panel.classList.remove('is-open'); updateCommentActionButton(); }
  function updateCommentActionButton() { var btn = $('.pv-comment-action-btn', state.root); if (!btn) return; var input = $('.pv-comment-input', state.root); var hasText = !!norm(input && input.value); var recording = state.comments.mediaRecorder && state.comments.mediaRecorder.state === 'recording'; var hasVoice = !!state.comments.voiceBlob; btn.classList.toggle('is-send', hasText || hasVoice); btn.classList.toggle('recording', !!recording); btn.innerHTML = (hasText || hasVoice) ? iconSend() : (recording ? '<span class="pv-stop-dot"></span>' : iconMic()); }
  function handleCommentAction() { var input = $('.pv-comment-input', state.root); if ((input && norm(input.value)) || state.comments.voiceBlob) submitComment(); else toggleCommentRecording(); }
  function appendDurationParam(url, seconds) { try { var u = new URL(url, location.origin); u.searchParams.set('haa8dur', String(Math.max(1, seconds || 1))); return u.origin === location.origin ? u.pathname + u.search + u.hash : u.toString(); } catch (e) { return url + (String(url).indexOf('?') === -1 ? '?' : '&') + 'haa8dur=' + encodeURIComponent(seconds || 1); } }
  function submitComment() {
    var item = state.comments.item; var input = $('.pv-comment-input', state.root); var text = norm(input.value);
    if (!item || (!text && !state.comments.voiceBlob)) return; if (!isLoggedIn()) return alertError(TEXT.loginFirst);
    var btn = $('.pv-comment-action-btn', state.root); if (btn) btn.disabled = true;
    Promise.resolve().then(function () {
      var content = state.comments.replyTo ? ('@' + state.comments.replyTo.username + ' ' + text) : text;
      if (!state.comments.voiceBlob) return content;
      var ext = /ogg/i.test(state.comments.voiceBlob.type) ? 'ogg' : 'webm';
      var file = new File([state.comments.voiceBlob], 'comment-voice-' + Date.now() + '.' + ext, { type: state.comments.voiceBlob.type || 'audio/webm' });
      return uploadToNodeBB(file).then(function (url) { return (content ? content + '\n' : '') + '[' + TEXT.voiceMsg + ' · ' + formatDuration(state.comments.voiceDuration || 1) + '](' + appendDurationParam(url, state.comments.voiceDuration || 1) + ')'; });
    }).then(function (content) {
      var payload = { content: content };
      if (state.comments.replyTo && state.comments.replyTo.pid) payload.toPid = state.comments.replyTo.pid;
      return apiFetch('/api/v3/topics/' + encodeURIComponent(item.tid), { method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8', 'x-csrf-token': csrfToken() }, body: JSON.stringify(payload) });
    }).then(function () { input.value = ''; clearReplyTarget(); setCommentVoice(null, 0); updateCommentActionButton(); item.counts.comments += 1; updateCountUi(item); openComments(item); })
      .catch(function () { alertError(TEXT.commentFail); window.open(item.href, '_blank'); })
      .finally(function () { if (btn) btn.disabled = false; });
  }
  function updateCountUi(item) { var slide = findSlide(state.list.indexOf(item)); if (!slide) return; var btn = $('.pv-comment-btn span:last-child', slide); if (btn) btn.textContent = formatCount(item.counts.comments); }
  function translateComment(commentEl) { var text = $('.pv-comment-text', commentEl); var box = $('.pv-comment-translated', commentEl); if (!text || !box) return; translateElementText(text.textContent || '', box); }
  function translateCommentInput() { var input = $('.pv-comment-input', state.root); var text = norm(input.value); if (!text) return; translateText(text).then(function (out) { if (out) { input.value = out; updateCommentActionButton(); } }).catch(function () { alertError(TEXT.translateFail); }); }
  function translateComposeInput() { var panel = $('.pv-compose-panel', state.root); var input = panel && $('textarea', panel); var text = norm(input && input.value); if (!text || !input) return; var btn = $('.pv-compose-translate', panel); if (btn) btn.disabled = true; translateText(text).then(function (out) { if (out) input.value = out; }).catch(function () { alertError(TEXT.translateFail); }).finally(function () { if (btn) btn.disabled = false; }); }

  function openViewer(images, index) {
    if (!images || !images.length) return;
    state.viewer.images = images.slice(0, CONFIG.imageMax);
    state.viewer.index = Math.max(0, Math.min(state.viewer.images.length - 1, Number(index || 0)));
    var viewer = $('.pv-viewer', state.root);
    viewer.classList.add('is-open'); updateViewer();
  }
  function updateViewer() {
    var viewer = $('.pv-viewer', state.root);
    var wrapper = $('.pv-viewer .swiper-wrapper', state.root);
    wrapper.innerHTML = state.viewer.images.map(function (src, i) { return '<div class="swiper-slide"><img src="' + escapeHtml(src) + '" alt="image ' + (i + 1) + '"></div>'; }).join('');
    if (state.viewer.swiper) { try { state.viewer.swiper.destroy(true, true); } catch (e) {} state.viewer.swiper = null; }
    if (window.Swiper) {
      state.viewer.swiper = new window.Swiper($('.pv-viewer-swiper', viewer), {
        direction: 'horizontal', slidesPerView: 1, speed: 220, initialSlide: state.viewer.index,
        pagination: { el: $('.pv-viewer-pagination', viewer), clickable: false },
        on: { slideChange: function (sw) { state.viewer.index = sw.activeIndex || 0; } }
      });
    }
  }
  function closeViewer() { $('.pv-viewer', state.root).classList.remove('is-open'); }

  function showComposeFabInitial() { var fab = $('.pv-compose-fab', state.root); if (fab) fab.classList.remove('is-hidden'); }
  function hideComposerFab() { var fab = $('.pv-compose-fab', state.root); if (fab) fab.classList.add('is-hidden'); }
  function openCompose() { pauseSlide(state.index); $('.pv-drawer-backdrop', state.root).classList.add('is-open'); $('.pv-compose-panel', state.root).classList.add('is-open'); hideComposerFab(); }
  function closeCompose() { $('.pv-compose-panel', state.root).classList.remove('is-open'); $('.pv-drawer-backdrop', state.root).classList.remove('is-open'); }
  function resetCompose() { var p = $('.pv-compose-panel', state.root); $('textarea', p).value = ''; setPendingImages([]); $('.pv-meta', p).textContent = ''; }
  function canCanvasEncode(type) { return new Promise(function (resolve) { try { var c = document.createElement('canvas'); c.width = c.height = 1; c.toBlob(function (b) { resolve(!!b && b.type === type); }, type, 0.8); } catch (e) { resolve(false); } }); }
  function compressImageFile(file) {
    if (!file || !/^image\//i.test(file.type) || /gif|svg/i.test(file.type) || file.size < 128 * 1024) return Promise.resolve(file);
    return new Promise(function (resolve) {
      var img = new Image(); var url = URL.createObjectURL(file);
      img.onload = function () {
        URL.revokeObjectURL(url);
        var maxSide = 1440; var scale = Math.min(1, maxSide / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
        var canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round((img.naturalWidth || img.width) * scale)); canvas.height = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
        var ctx = canvas.getContext('2d'); if (!ctx || !canvas.toBlob) return resolve(file);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canCanvasEncode('image/webp').then(function (webp) {
          var type = webp ? 'image/webp' : 'image/jpeg';
          canvas.toBlob(function (blob) {
            if (!blob || blob.size >= file.size * 0.95) return resolve(file);
            var name = String(file.name || ('image-' + Date.now())).replace(/\.[^.]+$/, '') + (type === 'image/webp' ? '.webp' : '.jpg');
            resolve(new File([blob], name, { type: type, lastModified: Date.now() }));
          }, type, 0.62);
        });
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }
  function compressImageFiles(files) { return Promise.all((files || []).map(compressImageFile)); }
  function setPendingImages(files) {
    state.compose.imageUrls.forEach(function (url) { URL.revokeObjectURL(url); });
    var list = Array.from(files || []).filter(function (f) { return /^image\//i.test(f.type); }).slice(0, CONFIG.imageMax);
    state.compose.imageFiles = list; state.compose.imageUrls = list.map(function (f) { return URL.createObjectURL(f); });
    $('.pv-preview-images', state.root).innerHTML = state.compose.imageUrls.map(function (u) { return '<img src="' + u + '" alt="preview">'; }).join('');
  }
  function uploadToNodeBB(file) {
    var form = new FormData(); form.append('files[]', file); form.append('cid', String(CONFIG.cid));
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
      if (Array.isArray(cur)) q.push.apply(q, cur); else Object.keys(cur).forEach(function (k) { q.push(cur[k]); });
    }
    throw new Error('upload url missing');
  }
  function buildTitle(text) { var clean = norm(String(text || '').replace(RE.tiktokShort, '').replace(RE.tiktokGlobal, '').replace(RE.tiktokToken, '').replace(/https?:\/\/vt\.?/ig, '').replace(/!\[[^\]]*\]\([^)]+\)/g, '').replace(/\[[^\]]*\]\([^)]+\)/g, '')); return clean ? clean.slice(0, 80) : '动态'; }
  function sendTopic() {
    if (!isLoggedIn()) return alertError(TEXT.loginFirst);
    var panel = $('.pv-compose-panel', state.root); var textarea = $('textarea', panel); var text = norm(textarea.value);
    if (!text && !state.compose.imageFiles.length) return alertError(TEXT.enterSomething);
    var btn = $('.pv-compose-submit', panel); var meta = $('.pv-meta', panel); btn.disabled = true; btn.textContent = TEXT.publishing;
    var lines = []; if (text) lines.push(text);
    Promise.resolve().then(function () {
      var p = Promise.resolve();
      state.compose.imageFiles.forEach(function (file, i) {
        p = p.then(function () { meta.textContent = TEXT.uploadImage + ' ' + (i + 1) + '/' + state.compose.imageFiles.length; return uploadToNodeBB(file).then(function (url) { lines.push('![image](' + url + ')'); }); });
      });
      return p;
    }).then(function () {
      return apiFetch('/api/v3/topics', { method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8', 'x-csrf-token': csrfToken() }, body: JSON.stringify({ cid: Number(CONFIG.cid), title: buildTitle(text), content: lines.join('\n\n'), tags: [] }) });
    }).then(function () { alertSuccess(TEXT.publishOk); resetCompose(); closeCompose(); loadFeed(true); })
      .catch(function (err) { console.warn(err); alertError(err.message || TEXT.publishFail); })
      .finally(function () { btn.disabled = false; btn.textContent = TEXT.send; meta.textContent = ''; });
  }

  function handleTap(e, index) {
    var item = state.list[index];
    if (!item || !(item.tiktoks && item.tiktoks[0])) return;
    clearTimeout(state.lastTap.timer);
    var player = Array.from(state.players.values()).find(function (p) { return p.index === index; });
    if (state.justUnlockedSoundAt && Date.now() - state.justUnlockedSoundAt < 450) {
      state.manualPausedKey = '';
      state.soundMuted = false;
      safeJsonSet('pv-sound-muted', false);
      updateSoundUi();
      if (player) {
        player.wantPlay = true;
        tryPlayPlayer(player, true);
      } else {
        playSlide(index, true);
      }
      return;
    }
    if (player && (player.status === 'playing' || player.wantPlay) && state.manualPausedKey !== player.key) {
      pauseSlide(index, false, true);
    } else {
      state.hasInteracted = true;
      state.soundUnlocked = true;
      state.soundMuted = false;
      state.manualPausedKey = '';
      safeJsonSet('pv-sound-unlocked', true);
      safeJsonSet('pv-sound-muted', false);
      updateSoundUi();
      playSlide(index, true);
    }
  }
  function unlockSoundFromGesture() {
    var wasUnlocked = !!state.soundUnlocked;
    state.hasInteracted = true;
    state.soundUnlocked = true;
    state.soundMuted = false;
    safeJsonSet('pv-sound-unlocked', true);
    safeJsonSet('pv-sound-muted', false);
    updateSoundUi();
    if (!wasUnlocked) {
      state.justUnlockedSoundAt = Date.now();
      var player = currentPlayer();
      if (player) {
        state.manualPausedKey = '';
        player.wantPlay = true;
        tryPlayPlayer(player, true);
      }
    }
  }

  function buildChrome() {
    state.root.innerHTML = '' +
      '<div class="pv-page pv-page-active">' +
        '<div class="pv-swiper swiper"><div class="swiper-wrapper"></div></div>' +
        '<button type="button" class="pv-compose-fab">+</button>' +
        '<div class="pv-drawer-backdrop"></div><div class="pv-modal-backdrop"></div>' +
        '<section class="pv-compose-panel" role="dialog"><div class="pv-panel-head"><div class="pv-panel-title">' + TEXT.publish + '</div><button type="button" class="pv-close pv-compose-close">×</button></div><textarea class="pv-compose-textarea" placeholder="' + TEXT.placeholder + '"></textarea><div class="pv-preview-images"></div><div class="pv-compose-tools"><input type="file" class="pv-image-input" accept="image/*" multiple hidden><button type="button" class="pv-tool pv-image-btn">' + TEXT.chooseImage + '</button><button type="button" class="pv-tool pv-compose-translate">' + iconTranslate() + ' ' + TEXT.translate + '</button><button type="button" class="pv-primary pv-compose-submit">' + TEXT.send + '</button></div><div class="pv-meta"></div></section>' +
        '<section class="pv-comments-panel" role="dialog"><div class="pv-panel-grip"></div><div class="pv-panel-head pv-comments-drag"><div class="pv-panel-title pv-comments-title">' + TEXT.comments + '</div><button type="button" class="pv-close pv-comments-close">×</button></div><div class="pv-comments-list"></div><div class="pv-reply-bar"><span>' + TEXT.replyTo + ' </span><b class="pv-reply-name"></b><button type="button" class="pv-reply-cancel">×</button></div><div class="pv-comment-voice-preview"></div><div class="pv-comment-record-panel"><div class="pv-record-pulse"></div><div class="pv-record-bars"><i></i><i></i><i></i><i></i><i></i></div><span class="pv-record-time">00:00</span><span class="pv-record-tip">正在录音，点右侧按钮停止</span></div><div class="pv-comment-send-row"><div class="pv-comment-input-wrap"><button type="button" class="pv-comment-input-translate" aria-label="' + TEXT.translate + '" title="' + TEXT.translate + '">' + iconTranslate() + '</button><input class="pv-comment-input" placeholder="' + TEXT.commentPlaceholder + '"><button type="button" class="pv-comment-action-btn" aria-label="语音或发送">' + iconMic() + '</button></div></div></section>' +
        '<section class="pv-translate-panel" role="dialog"><div class="pv-panel-head"><div class="pv-panel-title">' + TEXT.translateSettings + '</div><button type="button" class="pv-close pv-translate-close">×</button></div><div class="pv-provider-tabs"><button type="button" class="pv-provider-tab" data-provider="google">' + TEXT.google + '</button><button type="button" class="pv-provider-tab" data-provider="ai">' + TEXT.ai + '</button><input type="hidden" name="provider" value="google"></div><div class="pv-lang-row"><label><span>' + TEXT.sourceLang + '</span><select name="sourceLang">' + langOptions(true) + '</select></label><span class="pv-lang-arrow">⇄</span><label><span>' + TEXT.targetLang + '</span><select name="targetLang">' + langOptions(false) + '</select></label></div><div class="pv-ai-settings"><label>' + TEXT.aiEndpoint + '<input name="aiEndpoint" placeholder="https://api.example.com/v1"></label><label>' + TEXT.aiModel + '<input name="aiModel" placeholder="gpt-4.1-mini / qwen / deepseek"></label><label>' + TEXT.aiApiKey + '<input name="aiApiKey" type="password" placeholder="API Key"></label><label>' + TEXT.aiPrompt + '<textarea name="aiPrompt" rows="4"></textarea></label></div><div class="pv-translate-actions"><button type="button" class="pv-primary pv-translate-save">' + TEXT.save + '</button></div></section>' +
        '<div class="pv-viewer"><div class="pv-viewer-swiper swiper"><div class="swiper-wrapper"></div><div class="pv-viewer-pagination"></div></div><button class="pv-viewer-close" aria-label="关闭">×</button></div>' +
      '</div>';
    bindChrome();
  }
  function bindLongPress(el, cb) {
    if (!el) return;
    var timer = 0, sx = 0, sy = 0;
    el.addEventListener('pointerdown', function (e) { sx = e.clientX; sy = e.clientY; clearTimeout(timer); timer = setTimeout(function () { cb(e); timer = 0; }, 560); });
    el.addEventListener('pointermove', function (e) { if (Math.hypot(e.clientX - sx, e.clientY - sy) > 12) { clearTimeout(timer); timer = 0; } });
    ['pointerup','pointercancel','pointerleave'].forEach(function (n) { el.addEventListener(n, function () { clearTimeout(timer); timer = 0; }); });
  }
  function bindChrome() {
    state.root.addEventListener('click', onRootClick, true);
    state.root.addEventListener('pointerdown', onRootPointerDown, true);
    state.root.addEventListener('pointermove', onRootPointerMove, true);
    state.root.addEventListener('pointerup', onRootPointerUp, true);
    state.root.addEventListener('pointercancel', onRootPointerCancel, true);
    $('.pv-compose-fab', state.root).addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); openCompose(); });
    $('.pv-compose-close', state.root).addEventListener('click', closeCompose);
    $('.pv-drawer-backdrop', state.root).addEventListener('click', function () { closeCompose(); closeComments(); closeTranslateSettings(); });
    $('.pv-image-btn', state.root).addEventListener('click', function () { $('.pv-image-input', state.root).click(); });
    $('.pv-image-input', state.root).addEventListener('change', function (e) { var files = Array.from(e.target.files || []).slice(0, CONFIG.imageMax); e.target.value = ''; if (files.find(function (f) { return !/^image\//i.test(f.type); })) return alertError(TEXT.imageOnly); compressImageFiles(files).then(setPendingImages); });
    $('.pv-compose-submit', state.root).addEventListener('click', sendTopic);
    $('.pv-compose-translate', state.root).addEventListener('click', translateComposeInput);
    $('.pv-comments-close', state.root).addEventListener('click', closeComments);
    $('.pv-reply-cancel', state.root).addEventListener('click', clearReplyTarget);
    $('.pv-comment-action-btn', state.root).addEventListener('click', handleCommentAction);
    $('.pv-comment-voice-preview', state.root).addEventListener('click', function (e) { var rm = e.target.closest('.pv-comment-voice-remove'); if (rm) { setCommentVoice(null, 0); return; } var card = e.target.closest('.pv-voice-card'); if (card) toggleVoiceCard(card); });
    $('.pv-comment-input-translate', state.root).addEventListener('click', translateCommentInput);
    bindLongPress($('.pv-comment-input-translate', state.root), openTranslateSettings);
    $('.pv-comment-input', state.root).addEventListener('input', updateCommentActionButton);
    $('.pv-comment-input', state.root).addEventListener('keydown', function (e) { if (e.key === 'Enter') submitComment(); });
    $('.pv-translate-close', state.root).addEventListener('click', closeTranslateSettings);
    $('.pv-modal-backdrop', state.root).addEventListener('click', closeTranslateSettings);
    $('.pv-translate-save', state.root).addEventListener('click', function () {
      var p = $('.pv-translate-panel', state.root);
      safeJsonSet('pv-translate-settings', {
        provider: $('[name="provider"]', p).value,
        sourceLang: $('[name="sourceLang"]', p).value,
        targetLang: $('[name="targetLang"]', p).value,
        aiEndpoint: $('[name="aiEndpoint"]', p).value,
        aiModel: $('[name="aiModel"]', p).value,
        aiApiKey: $('[name="aiApiKey"]', p).value,
        aiPrompt: $('[name="aiPrompt"]', p).value
      });
      closeTranslateSettings();
    });
    $$('.pv-provider-tab', state.root).forEach(function (tab) {
      tab.addEventListener('click', function () {
        var p = $('.pv-translate-panel', state.root);
        $('[name="provider"]', p).value = tab.dataset.provider || 'google';
        $$('.pv-provider-tab', p).forEach(function (t) { t.classList.toggle('is-active', t === tab); });
        p.classList.toggle('is-ai', tab.dataset.provider === 'ai');
      });
    });
    var viewer = $('.pv-viewer', state.root);
    $('.pv-viewer-close', viewer).addEventListener('click', closeViewer);
    viewer.addEventListener('pointerdown', function (e) { state.viewer.down = true; state.viewer.startX = e.clientX; state.viewer.startY = e.clientY; });
    viewer.addEventListener('pointerup', function (e) { if (!state.viewer.down) return; state.viewer.down = false; var dx = e.clientX - state.viewer.startX; var dy = e.clientY - state.viewer.startY; if (dy > 66 && Math.abs(dy) > Math.abs(dx)) closeViewer(); });
    document.addEventListener('visibilitychange', function () { if (document.hidden) pauseSlide(state.index); else activateCurrent(false); });
  }
  function onRootClick(e) {
    var btn;
    if ((btn = e.target.closest('.pv-sound-btn'))) { e.preventDefault(); e.stopPropagation(); toggleSound(Number(btn.dataset.index)); return; }
    if ((btn = e.target.closest('.pv-like'))) { e.preventDefault(); e.stopPropagation(); var i = Number(btn.dataset.index); toggleLike(state.list[i], findSlide(i), true); return; }
    if ((btn = e.target.closest('.pv-comment-btn'))) { e.preventDefault(); e.stopPropagation(); openComments(state.list[Number(btn.dataset.index)]); return; }
    if ((btn = e.target.closest('.pv-follow-plus'))) { e.preventDefault(); e.stopPropagation(); var idx = Number(btn.dataset.index); toggleFollow(state.list[idx], findSlide(idx)); return; }
    if ((btn = e.target.closest('.pv-translate-btn'))) { e.preventDefault(); e.stopPropagation(); var ti = Number(btn.dataset.index); translateSlide(state.list[ti], findSlide(ti)); return; }
    if ((btn = e.target.closest('.pv-album-btn'))) { e.preventDefault(); e.stopPropagation(); var pi = Number(btn.dataset.index); openViewer(state.list[pi].images || [], 0); return; }
    if ((btn = e.target.closest('.pv-voice-card'))) { e.preventDefault(); e.stopPropagation(); toggleVoiceCard(btn); return; }
    if ((btn = e.target.closest('.pv-comment-reply'))) { e.preventDefault(); e.stopPropagation(); setReplyTarget(e.target.closest('.pv-comment')); return; }
    if ((btn = e.target.closest('.pv-comment-translate'))) { e.preventDefault(); e.stopPropagation(); translateComment(e.target.closest('.pv-comment')); return; }
    if (e.target.closest('.pv-avatar-link, .pv-avatar-wrap a, .pv-username')) { e.preventDefault(); e.stopPropagation(); return; }
    if ((btn = e.target.closest('.pv-text-row'))) { if (!e.target.closest('.pv-translate-btn')) btn.classList.toggle('is-expanded'); }
  }
  function onRootPointerDown(e) {
    var tap = e.target.closest('.pv-tap-zone');
    state.pointer.down = !!tap;
    state.pointer.x = e.clientX;
    state.pointer.y = e.clientY;
    state.pointer.moved = false;
    state.pointer.tapIndex = tap ? Number(tap.dataset.index) : -1;
    if (!e.target.closest('input, textarea, select, .pv-sound-btn, .pv-comments-panel, .pv-compose-panel, .pv-translate-panel, .pv-viewer')) unlockSoundFromGesture();
    var textRow = e.target.closest('.pv-text-row');
    var translateBtn = e.target.closest('.pv-translate-btn, .pv-comment-translate');
    if (textRow || translateBtn) { clearTimeout(state.translateLongPressTimer); state.translateLongPressTimer = setTimeout(function () { openTranslateSettings(); }, 650); }
    if (tap) state.hasInteracted = true;
    var panel = $('.pv-comments-panel', state.root);
    if (panel && panel.classList.contains('is-open') && e.target.closest('.pv-comments-panel') && !e.target.closest('input,button,.pv-voice-card')) {
      var canDrag = e.target.closest('.pv-panel-grip, .pv-comments-drag');
      if (!canDrag) return;
      state.comments.dragCandidate = true; state.comments.dragStartTopZone = true; state.comments.dragStartY = e.clientY; state.comments.dragY = 0;
    }
  }
  function onRootPointerMove(e) {
    if (state.pointer.down && Math.hypot(e.clientX - state.pointer.x, e.clientY - state.pointer.y) > 14) state.pointer.moved = true;
    var panel = $('.pv-comments-panel', state.root);
    if (state.comments.dragCandidate && !state.comments.dragging) {
      var dy0 = e.clientY - state.comments.dragStartY;
      if (dy0 > 8 && state.comments.dragStartTopZone) state.comments.dragging = true;
      if (Math.abs(dy0) > 18 && dy0 < 0) state.comments.dragCandidate = false;
    }
    if (state.comments.dragging) {
      var dy = Math.max(0, e.clientY - state.comments.dragStartY);
      state.comments.dragY = dy;
      if (panel) panel.style.transform = 'translateY(' + dy + 'px)';
      if (e.cancelable) e.preventDefault();
    }
  }
  function onRootPointerUp(e) {
    clearTimeout(state.translateLongPressTimer);
    if (state.comments.dragging) {
      var panel = $('.pv-comments-panel', state.root); state.comments.dragging = false; state.comments.dragCandidate = false;
      var dy = Math.max(0, e.clientY - state.comments.dragStartY); panel.style.transform = '';
      if (dy > 86) closeComments(); state.comments.dragCandidate = false; return;
    }
    state.comments.dragCandidate = false;
    var tap = e.target.closest('.pv-tap-zone');
    if (tap && state.pointer.down && !state.pointer.moved) { e.preventDefault(); e.stopPropagation(); handleTap(e, Number(tap.dataset.index)); }
    state.pointer.down = false; state.pointer.tapIndex = -1; state.pointer.moved = false;
  }
  function onRootPointerCancel() { clearTimeout(state.translateLongPressTimer); state.comments.dragging = false; state.comments.dragCandidate = false; state.pointer.down = false; state.pointer.moved = false; var p = $('.pv-comments-panel', state.root); if (p) p.style.transform = ''; }

  function showEmpty(text) { var old = $('.pv-empty-page', state.root); if (old) old.remove(); var div = document.createElement('div'); div.className = 'pv-empty-page'; div.textContent = text || TEXT.empty; state.root.appendChild(div); }
  function injectRuntimeFixStyles() {
    if (document.getElementById('pv-video-runtime-fix-style')) return;
    var style = document.createElement('style');
    style.id = 'pv-video-runtime-fix-style';
    style.textContent = '' +
      '#peipe-video-app .pv-slide-item.is-video .pv-video-shell,#peipe-video-app .pv-slide-item.is-video .pv-tiktok-frame{position:absolute!important;inset:0!important;z-index:0!important;}' +
      '#peipe-video-app .pv-slide-item.is-video .pv-cover{position:absolute!important;inset:0!important;z-index:1!important;display:flex!important;align-items:center!important;justify-content:center!important;overflow:hidden!important;background:radial-gradient(circle at 28% 18%,rgba(255,45,85,.48),transparent 34%),radial-gradient(circle at 72% 72%,rgba(0,180,255,.34),transparent 38%),linear-gradient(135deg,#191725,#06070b)!important;pointer-events:none!important;transition:opacity .18s ease!important;}' +
      '#peipe-video-app .pv-slide-item.is-video .pv-cover.is-hidden{opacity:0!important;visibility:hidden!important;}' +
      '#peipe-video-app .pv-slide-item.is-video .pv-cover img{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;object-fit:cover!important;display:none!important;}' +
      '#peipe-video-app .pv-slide-item.is-video .pv-cover.has-cover img{display:block!important;}' +
      '#peipe-video-app .pv-slide-item.is-video .pv-cover.has-cover .pv-cover-fallback{background:linear-gradient(180deg,rgba(0,0,0,.08),rgba(0,0,0,.26))!important;}' +
      '#peipe-video-app .pv-slide-item.is-video .pv-cover:not(.has-cover) img{display:none!important;}' +
      '#peipe-video-app .pv-cover-fallback{position:absolute!important;inset:0!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;color:#fff!important;text-shadow:0 2px 10px rgba(0,0,0,.45)!important;}' +
      '#peipe-video-app .pv-cover-glow{position:absolute!important;width:46vw!important;height:46vw!important;max-width:220px!important;max-height:220px!important;border-radius:999px!important;background:rgba(255,255,255,.12)!important;filter:blur(20px)!important;}' +
      '#peipe-video-app .pv-cover-play{position:relative!important;width:64px!important;height:64px!important;border-radius:999px!important;background:rgba(255,255,255,.18)!important;backdrop-filter:blur(8px)!important;display:flex!important;align-items:center!important;justify-content:center!important;font-size:28px!important;line-height:1!important;padding-left:4px!important;box-shadow:0 10px 34px rgba(0,0,0,.28)!important;}' +
      '#peipe-video-app .pv-cover-text{position:relative!important;margin-top:12px!important;font-size:13px!important;opacity:.86!important;letter-spacing:.08em!important;}' +
      '#peipe-video-app .pv-slide-item.is-video .pv-gradient{z-index:2!important;}' +
      '#peipe-video-app .pv-slide-item.is-video .pv-tap-zone,#peipe-video-app .pv-slide-item.is-video .pv-toolbar,#peipe-video-app .pv-slide-item.is-video .pv-desc{z-index:3!important;}' +
      '#peipe-video-app .pv-cover-play{display:none!important;}' +
      '#peipe-video-app .pv-slide-item.is-video .pv-tap-zone{right:0!important;bottom:0!important;touch-action:pan-y!important;}' +
      '#peipe-video-app .pv-tiktok-frame{pointer-events:none!important;}' +
      '#peipe-video-app .pv-mic-svg,#peipe-video-app .pv-send-svg,#peipe-video-app .pv-sound-svg{width:20px!important;height:20px!important;fill:none!important;stroke:currentColor!important;stroke-width:2.2px!important;stroke-linecap:round!important;stroke-linejoin:round!important;}' +
      '#peipe-video-app .pv-mic-svg path,#peipe-video-app .pv-send-svg path,#peipe-video-app .pv-sound-svg path{fill:none!important;stroke:currentColor!important;}' +
      '#peipe-video-app .pv-follow-plus{top:-8px!important;bottom:auto!important;z-index:4!important;}';
    document.head.appendChild(style);
  }

  function init() {
    state.root = document.getElementById('peipe-video-app'); if (!state.root) return;
    document.body.classList.add('pv-video-mode'); injectRuntimeFixStyles(); addPreconnects(); buildChrome(); showComposeFabInitial();
    ensureSwiper().then(function () { return loadFeed(true); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
