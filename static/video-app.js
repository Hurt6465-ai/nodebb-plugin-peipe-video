/* Peipe /video mobile discover page v12
   - Fully optimized autoplay and manual audio
   - Transparent comment inputs, auto-height panel
   - Cleaned text output (no vt.tiktok or '动态')
   - Username not clickable, only avatar is clickable
   - Corrected hollow heart design and PUT/DELETE API endpoints
*/
(function () {
  'use strict';

  if (window.__peipeVideoDiscoverV12) return;
  window.__peipeVideoDiscoverV12 = true;

  var CONFIG = Object.assign({
    cid: 6,
    pageSize: 12,
    preloadAhead: 2,
    preloadVideoAhead: 2,
    virtualTotal: 4,
    audioKeepAround: 2,
    officialControlsMs: 500,
    coverPreloadAhead: 6,
    playRetryDelays:[0, 80, 220, 520, 1000, 1600],
    imageMax: 4,
    coverCacheMs: 7 * 24 * 60 * 60 * 1000,
    translateCacheMs: 3 * 24 * 60 * 60 * 1000,
    doubleTapMs: 280,
    swiperCdnJs: '/plugins/nodebb-plugin-peipe-video/static/lib/swiper-bundle.min.js',
    swiperCdnCss: '/plugins/nodebb-plugin-peipe-video/static/lib/swiper-bundle.min.css'
  }, window.PEIPE_VIDEO_CONFIG || {});

  var TEXT = {
    loading: '发现加载中...', empty: '还没有可浏览的内容', publish: '发布', publishing: '发布中...', publishOk: '发布成功', publishFail: '发布失败', placeholder: '写点什么，或粘贴 TikTok 链接', chooseImage: '图片', record: '语音', stop: '停止', send: '发布', imageOnly: '请选择图片', uploadImage: '上传图片', uploadVoice: '上传语音', enterSomething: '请输入内容、TikTok 链接或图片', comments: '评论', commentPlaceholder: '说点什么...', replyTo: '回复', cancelReply: '取消回复', commentFail: '评论失败，可打开原帖评论', openTopic: '打开原帖', loginFirst: '请先登录', followFail: '关注失败', unfollowFail: '取消关注失败', followed: '已关注', unfollowed: '已取消关注', likeFail: '点赞失败', unlikeFail: '取消点赞失败', translate: '翻译', translating: '翻译中...', translateFail: '翻译失败', translateSettings: '翻译设置', sourceLang: '源语言', targetLang: '目标语言', save: '保存', auto: '自动', voiceMsg: '语音消息', noComments: '暂无评论', provider: '翻译方式', google: '谷歌翻译', ai: 'AI翻译', aiEndpoint: 'AI 接口', aiModel: '模型', aiApiKey: '密钥', aiPrompt: '提示词', voicePreview: '语音评论', recording: '录音中'
  };

  var RE = {
    tiktokGlobal: /https?:\/\/(?:www\.)?tiktok\.com\/@[^\/\s<>'"]+\/video\/(\d+)(?:\?[^\s<>'"]*)?/ig,
    tiktokOne: /https?:\/\/(?:www\.)?tiktok\.com\/@([^\/\s<>'"]+)\/video\/(\d+)/i,
    tiktokToken: /(?:https?[-:\/]+)?(?:www[.-])?tiktok[.-]com[-\/\w@.%=&?]+/ig,
    tiktokShort: /https?:\/\/(?:vt|vm)\.tiktok\.com\/[^\s<>\'"]+/ig,
    audioExt: /\.(m4a|mp3|wav|ogg|oga|webm|aac)(?:[?#].*)?$/i
  };

  var state = { root: null, swiper: null, list:[], feedPage: 1, feedLoading: false, feedDone: false, index: 0, players: new Map(), imageIndex: new Map(), hasInteracted: false, lastTap: { time: 0, x: 0, y: 0, timer: 0 }, compose: { imageFiles: [], imageUrls:[], mediaRecorder: null, stream: null, chunks:[], startAt: 0, timer: 0 }, viewer: { images:[], index: 0, swiper: null, startX: 0, startY: 0, down: false }, imageSwipers: new Map(), coverPreloadSet: new Set(), officialControlsTimer: 0, comments: { item: null, posts:[], loading: false, replyTo: null, dragY: 0, dragStartY: 0, dragging: false, dragCandidate: false, dragStartTopZone: false, voiceBlob: null, voiceUrl: '', voiceDuration: 0, mediaRecorder: null, stream: null, chunks:[], startAt: 0, timer: 0 }, translateLongPressTimer: 0 };

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function norm(v) { return String(v || '').replace(/\s+/g, ' ').trim(); }
  function rel(path) { var base = (window.config && window.config.relative_path) || ''; if (!path) return base || ''; if (/^https?:\/\//i.test(path)) return path; if (base && path.indexOf(base + '/') === 0) return path; return base + path; }
  function csrfToken() { return (window.config && (window.config.csrf_token || window.config.csrfToken)) || ($('meta[name="csrf-token"]') && $('meta[name="csrf-token"]').getAttribute('content')) || ''; }
  function currentUser() { return (window.app && window.app.user) || null; }
  function isLoggedIn() { var u = currentUser(); return !!(u && Number(u.uid || 0) > 0); }
  function alertError(msg) { if (window.app && app.alertError) app.alertError(msg); else window.alert(msg); }
  function alertSuccess(msg) { if (window.app && app.alertSuccess) app.alertSuccess(msg); }
  function safeJsonGet(key, fallback) { try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (e) { return fallback; } }
  function safeJsonSet(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {} }
  function escapeHtml(s) { return String(s || '').replace(/[&<>'"]/g, function (ch) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[ch]; }); }
  function formatCount(n) { n = Number(n || 0); if (n >= 100000000) return (n / 100000000).toFixed(n >= 1000000000 ? 1 : 2).replace(/\.0+$/, '') + '亿'; if (n >= 10000) return (n / 10000).toFixed(n >= 100000 ? 1 : 2).replace(/\.0+$/, '') + '万'; return String(Math.max(0, Math.floor(n))); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function formatDuration(sec) { sec = Math.max(0, Math.floor(Number(sec) || 0)); return pad(Math.floor(sec / 60)) + ':' + pad(sec % 60); }
  function parseTime(value) { if (value == null || value === '') return 0; if (typeof value === 'number') return value > 9999999999 ? value : value * 1000; var s = String(value); if (/^\d+$/.test(s)) { var n = Number(s); return n > 9999999999 ? n : n * 1000; } var t = Date.parse(s); return Number.isNaN(t) ? 0 : t; }
  function relativeTime(value) { var t = parseTime(value); if (!t) return ''; var diff = Math.max(0, Date.now() - t); var m = 60000, h = 60 * m, d = 24 * h, mo = 30 * d, y = 365 * d; if (diff >= y) return Math.floor(diff / y) + '年前'; if (diff >= mo) return Math.floor(diff / mo) + '个月前'; if (diff >= d) return Math.floor(diff / d) + '天前'; if (diff >= h) return Math.floor(diff / h) + '小时前'; if (diff >= m) return Math.max(1, Math.floor(diff / m)) + '分钟前'; return '刚刚'; }

  function apiFetch(url, options) {
    options = options || {}; options.credentials = options.credentials || 'same-origin'; options.headers = Object.assign({ accept: 'application/json', 'x-requested-with': 'XMLHttpRequest' }, options.headers || {});
    return fetch(rel(url), options).then(function (res) { return res.json().catch(function () { return {}; }).then(function (json) { if (!res.ok) { throw new Error(json.error || json.message || ('HTTP ' + res.status)); } return json; }); });
  }

  function cleanDisplayText(text) {
    var lines = String(text || '')
      .replace(RE.tiktokGlobal, '')
      .replace(RE.tiktokToken, '')
      .replace(RE.tiktokShort, '')
      .replace(/动态/g, '') // 隐藏自动生成的“动态”文字
      .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
      .replace(/\[\s*(?:语音消息|语音动态|voice\s*message|audio\s*message)[^\]]*\]\([^)]+\)/ig, '')
      .split(/[\r\n]+/)
      .map(function (line) { return norm(line); })
      .filter(function (line) { return line && !isAutoText(line); });
    return lines.join('\n');
  }
  function isAutoText(text) { var clean = norm(String(text || '').replace(/[•・·|｜_／/\\-]+/g, ' ')); return !clean || /^(?:新图片分享|图片分享|图片动态|语音消息|语音动态|voice message|audio message|image|photo|picture)(?:\s*:??\s*\d{1,2}:\d{2}(?::\d{2})?)?$/i.test(clean); }
  function displayText(item) { return cleanDisplayText(item && (item.text || item.title || '')); }
  function isOwnAuthor(author) { var me = currentUser(); if (!me || !author) return false; return String(me.uid || '') === String(author.uid || '') || String(me.userslug || '').toLowerCase() === String(author.userslug || '').toLowerCase(); }
  function authorHref(author) { return author && author.userslug ? rel('/user/' + encodeURIComponent(author.userslug)) : '#'; }
  function avatarSrc(author) { return author && author.picture ? author.picture : ''; }
  function canonicalTikTokUrl(url) { var m = String(url || '').replace(/&amp;/g, '&').match(RE.tiktokOne); return m ? 'https://www.tiktok.com/@' + m[1] + '/video/' + m[2] : String(url || ''); }

  function loadAsset(tag, url) {
    return new Promise(function (resolve, reject) {
      if (tag === 'script' && window.Swiper) return resolve();
      var existing = document.querySelector(tag + '[data-pv-swiper]');
      if (existing) { existing.addEventListener('load', resolve, { once: true }); existing.addEventListener('error', reject, { once: true }); if (tag === 'link') return resolve(); return; }
      var el = document.createElement(tag); el.dataset.pvSwiper = '1'; url = rel(url);
      if (tag === 'link') { el.rel = 'stylesheet'; el.href = url; } else { el.src = url; el.async = true; }
      el.onload = resolve; el.onerror = reject; document.head.appendChild(el); if (tag === 'link') resolve();
    });
  }
  function ensureSwiper() {
    if (window.Swiper) return Promise.resolve(true);
    return loadAsset('link', CONFIG.swiperCdnCss).then(function () { return loadAsset('script', CONFIG.swiperCdnJs); }).then(function () { return !!window.Swiper; }).catch(function () { return false; });
  }

  function loadFeed(refresh) {
    if (state.feedLoading || (state.feedDone && !refresh)) return Promise.resolve();
    state.feedLoading = true;
    if (refresh) { state.feedPage = 1; state.feedDone = false; state.list =[]; state.index = 0; state.players.clear(); updateSwiperSlides(true); }
    var page = state.feedPage;
    return apiFetch('/api/v3/plugins/peipe-video/feed?page=' + page + '&pageSize=' + CONFIG.pageSize)
      .then(function (json) {
        var payload = json.response || json;
        var items = (payload.items || []).map(function (item) {
          item.images = (item.images ||[]).slice(0, CONFIG.imageMax); item.viewer = item.viewer || { liked: false, following: false }; item.counts = item.counts || { likes: 0, comments: 0 }; item.text = displayText(item); item.title = cleanDisplayText(item.title || ''); return item;
        }).filter(function (item) { return (item.tiktoks && item.tiktoks.length) || (item.images && item.images.length); });
        state.list = refresh ? items : state.list.concat(items);
        state.feedDone = payload.hasMore === false || !items.length; state.feedPage += 1;
        updateSwiperSlides(refresh); if (!state.list.length) showEmpty(TEXT.empty);
      }).catch(function (err) { showEmpty(err.message || TEXT.empty); }).finally(function () { state.feedLoading = false; });
  }

  function initSwiper() {
    var el = $('.pv-swiper', state.root); if (!el || !window.Swiper) return false; if (state.swiper) return true;
    state.swiper = new window.Swiper(el, {
      direction: 'vertical', slidesPerView: 1, speed: 260, threshold: 2, resistanceRatio: 0.38, longSwipesRatio: 0.12, followFinger: true,
      virtual: { enabled: true, addSlidesBefore: 1, addSlidesAfter: Math.max(1, Number(CONFIG.virtualTotal || 1)), slides: state.list.map(renderSlideHtml) },
      on: {
        init: function (swiper) { state.index = swiper.activeIndex || 0; afterVirtualUpdate(); activateCurrent(false); },
        slideChangeTransitionStart: function (swiper) { state.hasInteracted = true; pauseSlide(swiper.previousIndex); },
        slideChange: function (swiper) { state.index = swiper.activeIndex || 0; if (state.index >= state.list.length - 4) loadFeed(false); afterVirtualUpdate(); pauseOtherPlayers(playerKey(state.index, (state.list[state.index] && state.list[state.index].tiktoks && state.list[state.index].tiktoks[0] && state.list[state.index].tiktoks[0].videoId) || '')); activateCurrent(false); revealOfficialControls(state.index); },
        virtualUpdate: function () { afterVirtualUpdate(); }, reachEnd: function () { loadFeed(false); }
      }
    });
    return true;
  }
  function updateSwiperSlides(reset) { if (!state.swiper) { initSwiper(); return; } state.swiper.virtual.slides = state.list.map(renderSlideHtml); state.swiper.virtual.update(true); if (reset) state.swiper.slideTo(0, 0); afterVirtualUpdate(); }
  function afterVirtualUpdate() {
    if (!state.root) return;
    $$('.pv-slide-item', state.root).forEach(function (slide) { slide.classList.toggle('is-active', Number(slide.dataset.index || -1) === state.index); });
    initImageSwipers(); prepareSlide(state.index, true); preloadNextVideos(state.index); preloadCovers(state.index);
  }

  function renderSlideHtml(item, index) {
    item = item || {}; var text = displayText(item); var hasVideo = !!(item.tiktoks && item.tiktoks[0]); var images = (item.images ||[]).slice(0, CONFIG.imageMax);
    var mediaHtml = hasVideo ? '<div class="pv-video-shell" data-video-id="' + escapeHtml(item.tiktoks[0].videoId) + '"></div>' : (images.length ? renderImageMain(item, getImageIndex(item)) : '<div class="pv-error">内容异常</div>');
    var author = item.author || {}; var avatar = avatarSrc(author); var avatarHtml = avatar ? '<img class="pv-avatar" src="' + escapeHtml(avatar) + '" alt="avatar">' : '<div class="pv-avatar"></div>';
    var following = readFollow(author) || item.viewer.following; var liked = !!(readVote(item.pid, item.tid) || item.viewer.liked);

    // 修改: 用户名仅展示 span 不做跳转，只有点击头像跳转
    return '' +
      '<section class="pv-slide-item ' + (hasVideo ? 'is-video' : 'is-image') + '" data-index="' + index + '" data-tid="' + escapeHtml(item.tid || '') + '">' +
        '<div class="pv-media">' + mediaHtml + '</div>' +
        (hasVideo ? '<div class="pv-cover"><img alt="cover"></div>' : '') +
        '<div class="pv-gradient"></div>' +
        (hasVideo ? '<div class="pv-tap-zone" data-index="' + index + '"></div>' : '') +
        '<div class="pv-toolbar">' +
          '<div class="pv-avatar-wrap"><a href="' + authorHref(author) + '">' + avatarHtml + '</a>' + (author.uid && !isOwnAuthor(author) ? '<button type="button" class="pv-follow-plus ' + (following ? 'is-following' : '') + '" data-index="' + index + '">' + (following ? '✓' : '+') + '</button>' : '') + '</div>' +
          '<button type="button" class="pv-action pv-like ' + (liked ? 'is-active' : '') + '" data-index="' + index + '"><span class="pv-action-icon">' + iconHeart() + '</span><span>' + formatCount(item.counts.likes) + '</span></button>' +
          '<button type="button" class="pv-action pv-comment-btn" data-index="' + index + '"><span class="pv-action-icon">' + iconComment() + '</span><span>' + formatCount(item.counts.comments) + '</span></button>' +
        '</div>' +
        '<div class="pv-desc">' +
          '<span class="pv-username">@' + escapeHtml(author.username || author.userslug || '用户') + '</span>' +
          (text ? '<div class="pv-text-row" data-index="' + index + '"><span class="pv-text-main">' + escapeHtml(text) + '</span></div>' : '') +
        '</div>' +
      '</section>';
  }
  function iconHeart() { return '<svg class="pv-heart-svg" viewBox="0 0 48 48"><path d="M24 41s-2.2-1.3-5.2-3.4C10.2 31.4 5 25.8 5 18.6 5 12.7 9.5 8 15.2 8c3.5 0 6.6 1.8 8.8 4.7C26.2 9.8 29.3 8 32.8 8 38.5 8 43 12.7 43 18.6c0 7.2-5.2 12.8-13.8 19C26.2 39.7 24 41 24 41z"></path></svg>'; }
  function iconComment() { return '<svg class="pv-comment-svg" viewBox="0 0 48 48"><path d="M24 7.5c-9.8 0-17.5 6.8-17.5 15.2 0 5.4 3.2 10.2 8 12.9l-.8 5.2 6.1-3.4c1.4.3 2.8.4 4.2.4 9.8 0 17.5-6.8 17.5-15.1S33.8 7.5 24 7.5z"></path><circle cx="17.4" cy="23.3" r="2.1"></circle><circle cx="24" cy="23.3" r="2.1"></circle><circle cx="30.6" cy="23.3" r="2.1"></circle></svg>'; }
  function iconSend() { return '<svg viewBox="0 0 24 24"><path d="M4 12h14M13 6l6 6-6 6"></path></svg>'; }
  
  function getImageIndex(item) { var key = String(item && (item.tid || item.pid || state.list.indexOf(item)) || ''); return Math.max(0, Number(state.imageIndex.get(key) || 0)); }
  function setImageIndex(item, index) { var key = String(item && (item.tid || item.pid || state.list.indexOf(item)) || ''); var max = Math.max(0, (item.images ||[]).length - 1); state.imageIndex.set(key, Math.max(0, Math.min(max, index))); }
  function renderImageMain(item, idx) {
    var images = (item.images ||[]).slice(0, CONFIG.imageMax); var slideIndex = state.list.indexOf(item);
    var slides = images.map(function (src, i) { return '<div class="swiper-slide pv-image-swiper-slide"><img src="' + escapeHtml(src) + '" alt="image ' + (i + 1) + '"></div>'; }).join('');
    var dots = images.length > 1 ? '<div class="pv-image-pagination"></div>' : '';
    return '<div class="pv-image-main" data-index="' + slideIndex + '"><div class="pv-image-swiper swiper" data-index="' + slideIndex + '"><div class="swiper-wrapper">' + slides + '</div>' + dots + '</div></div>';
  }
  function initImageSwipers() {
    if (!window.Swiper) return;
    $$('.pv-image-swiper', state.root).forEach(function (el) {
      var idx = Number(el.dataset.index || -1); if (state.imageSwipers.has(idx) && state.imageSwipers.get(idx).el === el) return;
      var item = state.list[idx]; if (!item || !(item.images && item.images.length)) return;
      var swiper = new window.Swiper(el, { direction: 'horizontal', slidesPerView: 1, nested: true, pagination: { el: $('.pv-image-pagination', el), clickable: false }, on: { slideChange: function (sw) { setImageIndex(item, sw.activeIndex || 0); } } });
      if (getImageIndex(item) > 0) swiper.slideTo(getImageIndex(item), 0); state.imageSwipers.set(idx, swiper);
    });
  }
  function findSlide(index) { return $('.pv-slide-item[data-index="' + index + '"]', state.root); }

  function buildPlayerUrl(videoId, autoplay) {
    var params = new URLSearchParams({ autoplay: autoplay ? '1' : '0', muted: '1', loop: '1', rel: '0', controls: '1', playsinline: '1' });
    return 'https://www.tiktok.com/player/v1/' + encodeURIComponent(videoId) + '?' + params.toString();
  }
  function playerKey(index, videoId) { return index + ':' + videoId; }
  function ensureTikTokPlayer(index, autoplay) {
    var item = state.list[index]; var slide = findSlide(index); if (!slide || !item || !(item.tiktoks && item.tiktoks[0])) return null;
    var tk = item.tiktoks[0]; var key = playerKey(index, tk.videoId); var player = state.players.get(key);
    if (player && player.iframe && player.iframe.parentNode) {
      if (autoplay && !/[?&]autoplay=1(?:&|$)/.test(player.iframe.src)) { player.iframe.src = buildPlayerUrl(player.videoId, true); player.ready = false; }
      return player;
    }
    var shell = $('.pv-video-shell', slide); if (!shell) return null; shell.innerHTML = '';
    var iframe = document.createElement('iframe'); iframe.className = 'pv-tiktok-frame'; iframe.src = buildPlayerUrl(tk.videoId, !!autoplay); iframe.allow = 'autoplay; fullscreen; encrypted-media; picture-in-picture'; shell.appendChild(iframe);
    player = { key: key, index: index, item: item, videoId: tk.videoId, iframe: iframe, ready: false, wantPlay: false, status: 'paused' };
    state.players.set(key, player);
    fetchCover(tk.videoId, tk.url).then(function (url) { if (url) { var img = $('.pv-cover img', slide); if (img) img.src = url; } });
    return player;
  }
  function prepareSlide(index, autoplay) {
    var item = state.list[index]; if (!item || !(item.tiktoks && item.tiktoks[0])) return;
    var player = ensureTikTokPlayer(index, !!autoplay); if (player && autoplay) player.wantPlay = index === state.index;
  }
  function preloadNextVideos(fromIndex) {
    var limit = Math.max(0, Number(CONFIG.preloadVideoAhead || 2)), found = 0;
    var maxScan = Math.min(state.list.length - 1, fromIndex + Math.max(2, limit + 1));
    for (var i = Math.max(0, fromIndex + 1); i <= maxScan && found < limit; i += 1) {
      var it = state.list[i]; if (it && it.tiktoks && it.tiktoks[0]) { prepareSlide(i, false); found += 1; }
    }
  }
  function activateCurrent(first) {
    state.index = state.swiper ? state.swiper.activeIndex : state.index;
    $$('.pv-slide-item', state.root).forEach(function (slide) { var idx = Number(slide.dataset.index || -1); slide.classList.toggle('is-active', idx === state.index); if (idx !== state.index) { slide.classList.remove('pv-show-official-controls'); pauseSlide(idx); } });
    prepareSlide(state.index, true); preloadNextVideos(state.index); preloadCovers(state.index); playSlide(state.index, false); revealOfficialControls(state.index); prunePlayers();
  }
  function sendToPlayer(iframe, type, value) { if (!iframe || !iframe.contentWindow) return; var msg = { 'x-tiktok-player': true, type: type }; if (arguments.length >= 3) msg.value = value; iframe.contentWindow.postMessage(msg, 'https://www.tiktok.com'); }

  function revealOfficialControls(index) {
    var slide = findSlide(index); $$('.pv-slide-item.pv-show-official-controls', state.root).forEach(function (node) { if (node !== slide) node.classList.remove('pv-show-official-controls'); });
    if (!slide || !slide.classList.contains('is-video')) return; slide.classList.add('pv-show-official-controls');
    clearTimeout(state.officialControlsTimer);
    state.officialControlsTimer = setTimeout(function () { var current = findSlide(index); if (current) current.classList.remove('pv-show-official-controls'); }, 800);
  }

  function destroyPlayer(player, key) { if (!player) return; try { if (player.iframe) { sendToPlayer(player.iframe, 'pause'); player.iframe.src = 'about:blank'; player.iframe.remove(); } } catch (e) {} if (key) state.players.delete(key); }
  function playSlide(index, userGesture) {
    var item = state.list[index]; if (!item || !(item.tiktoks && item.tiktoks[0])) return;
    var player = ensureTikTokPlayer(index, true); if (!player || !player.iframe) return;
    player.wantPlay = true; pauseOtherPlayers(player.key); var slide = findSlide(index); if (slide) slide.classList.add('is-loading');
    var delays =[0, 80, 220, 520, 1000];
    delays.forEach(function (delay) { setTimeout(function () { if (!player.wantPlay || player.index !== state.index) return; sendToPlayer(player.iframe, 'play'); }, delay); });
    setTimeout(function () { if (player.wantPlay && player.status !== 'playing') markSlidePlaying(index); }, 1800);
  }
  function pauseSlide(index) { state.players.forEach(function (p) { if (p.index === index) { p.wantPlay = false; p.status = 'paused'; if (p.iframe) { sendToPlayer(p.iframe, 'pause'); setTimeout(function(){sendToPlayer(p.iframe, 'pause');}, 80); } } }); var slide = findSlide(index); if (slide) slide.classList.remove('is-playing', 'is-loading'); }
  function pauseOtherPlayers(currentKey) { state.players.forEach(function (p, key) { if (key === currentKey) return; var far = Math.abs(p.index - state.index) > 2; p.wantPlay = false; p.status = 'paused'; if (p.iframe) { sendToPlayer(p.iframe, 'pause'); if (far) destroyPlayer(p, key); } var slide = findSlide(p.index); if (slide) slide.classList.remove('is-playing', 'is-loading'); }); }
  function prunePlayers() { state.players.forEach(function (p, key) { if (Math.abs(p.index - state.index) > 2) destroyPlayer(p, key); }); }
  function markSlidePlaying(index) { var slide = findSlide(index); if (!slide) return; var cover = $('.pv-cover', slide); if (cover) cover.classList.add('is-hidden'); slide.classList.add('is-playing'); slide.classList.remove('is-loading'); }
  window.addEventListener('message', function (event) {
    var data = event.data; if (typeof data === 'string') { try { data = JSON.parse(data); } catch (e) { return; } } if (!data || !data['x-tiktok-player']) return;
    state.players.forEach(function (player) {
      if (!player.iframe || player.iframe.contentWindow !== event.source) return;
      if (data.type === 'onStateChange') {
        var val = Number(data.value); var word = String(data.value || '').toLowerCase();
        if (val === 1 || word === 'playing') { player.status = 'playing'; pauseOtherPlayers(player.key); markSlidePlaying(player.index); }
        else if (val === 2 || val === 0 || word === 'paused' || word === 'ended') { player.status = 'paused'; }
      }
    });
  });

  function coverCacheKey(videoId) { return 'pv-cover:' + videoId; }
  function fetchCover(videoId, url) {
    var cached = safeJsonGet(coverCacheKey(videoId), null); if (cached && cached.url && cached.expiresAt > Date.now()) return Promise.resolve(cached.url);
    return fetch('https://www.tiktok.com/oembed?url=' + encodeURIComponent(canonicalTikTokUrl(url)), { cache: 'force-cache' }).then(function (r) { return r.ok ? r.json() : {}; }).then(function (json) { var thumb = json.thumbnail_url || ''; if (thumb) safeJsonSet(coverCacheKey(videoId), { url: thumb, expiresAt: Date.now() + CONFIG.coverCacheMs }); return thumb; }).catch(function () { return ''; });
  }
  function preloadCovers(fromIndex) {
    var ahead = Math.max(0, Number(CONFIG.coverPreloadAhead || 6)); if (!ahead || !state.list.length) return;
    var max = Math.min(state.list.length - 1, Math.max(0, fromIndex) + ahead);
    for (var i = Math.max(0, fromIndex); i <= max; i += 1) {
      var it = state.list[i]; if (!it) continue;
      if (it.tiktoks && it.tiktoks[0]) { var tk = it.tiktoks[0]; var key = 'tk:' + tk.videoId; if (!state.coverPreloadSet.has(key)) { state.coverPreloadSet.add(key); fetchCover(tk.videoId, tk.url).then(function(u){if(u){var img=new Image();img.src=u;}}); } }
    }
  }

  function handleTap(e, index) {
    var item = state.list[index]; if (!item) return; var now = Date.now(); var last = state.lastTap; var dist = Math.hypot(e.clientX - last.x, e.clientY - last.y);
    if (last.time && now - last.time < CONFIG.doubleTapMs && dist < 44) { clearTimeout(last.timer); last.time = 0; toggleLike(item, findSlide(index), true, { x: e.clientX, y: e.clientY }); return; }
    last.time = now; last.x = e.clientX; last.y = e.clientY; clearTimeout(last.timer);
    last.timer = setTimeout(function () {
      if (!(item.tiktoks && item.tiktoks[0])) return;
      var player = Array.from(state.players.values()).find(function (p) { return p.index === index; }); revealOfficialControls(index);
      if (player && player.status === 'playing') pauseSlide(index); else playSlide(index, true);
    }, CONFIG.doubleTapMs + 20);
  }

  function localUserSuffix() { var u = currentUser(); return String(u && u.uid || 'guest'); }
  function voteStoreKey() { return 'pv-vote-state:' + localUserSuffix(); }
  function voteStore() { return safeJsonGet(voteStoreKey(), {}); }
  function readVote(pid, tid) { var s = voteStore(); if (pid && s['pid:' + pid] !== undefined) return !!s['pid:' + pid]; if (tid && s['tid:' + tid] !== undefined) return !!s['tid:' + tid]; return false; }
  function writeVote(pid, tid, voted) { var s = voteStore(); if (pid) s['pid:' + pid] = !!voted; if (tid) s['tid:' + tid] = !!voted; safeJsonSet(voteStoreKey(), s); }

  // 严格根据截图使用 PUT / DELETE 接口实现点赞
  function toggleLike(item, slide, optimistic, point) {
    if (!isLoggedIn()) return alertError(TEXT.loginFirst);
    if (!item.pid) return alertError(TEXT.likeFail);
    var old = !!item.viewer.liked; var next = !old;
    item.viewer.liked = next; item.counts.likes = Math.max(0, Number(item.counts.likes || 0) + (next ? 1 : -1));
    writeVote(item.pid, item.tid, next); updateLikeUi(slide, item);
    
    apiFetch('/api/v3/posts/' + encodeURIComponent(item.pid) + '/vote', {
      method: next ? 'PUT' : 'DELETE',
      headers: { 'content-type': 'application/json; charset=utf-8', 'x-csrf-token': csrfToken() },
      body: next ? JSON.stringify({ delta: 1 }) : undefined  // 删除时不需要 body
    }).catch(function () {
      item.viewer.liked = old; item.counts.likes = Math.max(0, Number(item.counts.likes || 0) + (next ? -1 : 1));
      writeVote(item.pid, item.tid, old); updateLikeUi(slide, item); alertError(next ? TEXT.likeFail : TEXT.unlikeFail);
    });
  }
  function updateLikeUi(slide, item) {
    if (!slide) return; var btn = $('.pv-like', slide); if (!btn) return;
    btn.classList.toggle('is-active', !!item.viewer.liked); var count = $('span:last-child', btn); if (count) count.textContent = formatCount(item.counts.likes);
  }

  // 以下为评论抽屉逻辑
  function openComments(item) {
    state.comments.item = item; var panel = $('.pv-comments-panel', state.root);
    $('.pv-drawer-backdrop', state.root).classList.add('is-open'); panel.classList.add('is-open');
    $('.pv-comments-list', panel).innerHTML = '<div class="pv-meta">加载中...</div>';
    apiFetch('/api/topic/' + encodeURIComponent(item.tid)).then(function (json) {
      var posts = Array.isArray(json.posts) ? json.posts.slice(1) :[]; state.comments.posts = posts;
      renderComments(posts);
    }).catch(function () { $('.pv-comments-list', panel).innerHTML = '<div class="pv-meta">加载失败</div>'; });
  }
  function closeComments() { $('.pv-comments-panel', state.root).classList.remove('is-open'); $('.pv-drawer-backdrop', state.root).classList.remove('is-open'); }
  function renderComments(posts) {
    var list = $('.pv-comments-list', state.root); if (!posts.length) { list.innerHTML = '<div class="pv-meta">' + TEXT.noComments + '</div>'; return; }
    list.innerHTML = posts.map(function (post) {
      var content = post.content || post.raw || ''; var div = document.createElement('div'); div.innerHTML = content; var text = cleanDisplayText(div.textContent || content);
      var user = post.user || {}; var avatar = user.picture ? '<img src="' + escapeHtml(user.picture) + '">' : '<img alt="avatar">';
      return '<div class="pv-comment">' + avatar + '<div><div class="pv-comment-name">' + escapeHtml(user.username || '用户') + '</div><div class="pv-comment-text">' + escapeHtml(text) + '</div></div></div>';
    }).join('');
  }

  function submitComment() {
    var item = state.comments.item; var input = $('.pv-comment-input', state.root); var text = norm(input.value);
    if (!item || !text) return; if (!isLoggedIn()) return alertError(TEXT.loginFirst);
    apiFetch('/api/v3/topics/' + encodeURIComponent(item.tid), { method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken() }, body: JSON.stringify({ content: text }) })
      .then(function () { input.value = ''; item.counts.comments += 1; openComments(item); var slide = findSlide(state.list.indexOf(item)); if(slide) $('.pv-comment-btn span:last-child', slide).textContent = formatCount(item.counts.comments); })
      .catch(function () { alertError(TEXT.commentFail); });
  }

  function buildChrome() {
    state.root.innerHTML = '' +
      '<div class="pv-page pv-page-active">' +
        '<div class="pv-swiper swiper"><div class="swiper-wrapper"></div></div>' +
        '<button type="button" class="pv-compose-fab">+</button>' +
        '<div class="pv-drawer-backdrop"></div><div class="pv-modal-backdrop"></div>' +
        '<section class="pv-comments-panel" role="dialog"><div class="pv-panel-grip"></div><div class="pv-panel-head"><div class="pv-panel-title">' + TEXT.comments + '</div><button type="button" class="pv-close pv-comments-close">×</button></div><div class="pv-comments-list"></div><div class="pv-comment-send-row"><div class="pv-comment-input-wrap"><input class="pv-comment-input" placeholder="' + TEXT.commentPlaceholder + '"><button type="button" class="pv-comment-action-btn is-send">' + iconSend() + '</button></div></div></section>' +
      '</div>';
    bindChrome();
  }

  function bindChrome() {
    state.root.addEventListener('click', onRootClick, true);
    state.root.addEventListener('pointerup', function(e) { var tap = e.target.closest('.pv-tap-zone'); if (tap) { e.preventDefault(); handleTap(e, Number(tap.dataset.index)); } }, true);
    $('.pv-comments-close', state.root).addEventListener('click', closeComments);
    $('.pv-drawer-backdrop', state.root).addEventListener('click', closeComments);
    $('.pv-comment-action-btn', state.root).addEventListener('click', submitComment);
    $('.pv-comment-input', state.root).addEventListener('keydown', function (e) { if (e.key === 'Enter') submitComment(); });
    document.addEventListener('visibilitychange', function () { if (document.hidden) pauseSlide(state.index); else activateCurrent(false); });
  }

  function onRootClick(e) {
    var btn;
    if ((btn = e.target.closest('.pv-like'))) { e.preventDefault(); e.stopPropagation(); toggleLike(state.list[Number(btn.dataset.index)], findSlide(Number(btn.dataset.index)), true); return; }
    if ((btn = e.target.closest('.pv-comment-btn'))) { e.preventDefault(); e.stopPropagation(); openComments(state.list[Number(btn.dataset.index)]); return; }
    if ((btn = e.target.closest('.pv-text-row'))) { btn.classList.toggle('is-expanded'); }
  }

  function init() { state.root = document.getElementById('peipe-video-app'); if (!state.root) return; document.body.classList.add('pv-video-mode'); buildChrome(); ensureSwiper().then(function () { return loadFeed(true); }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
