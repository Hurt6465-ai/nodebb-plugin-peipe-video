<!-- IMPORT partials/header.tpl -->

<div id="peipe-video-app" class="pv-root" data-cid="{cid}">
  <div class="pv-init-loading">[[peipe-video:loading]]</div>
</div>

<script>
  (function () {
    // 防止 video-app.css 被重复插入加载
    if (!document.getElementById('pv-video-app-css')) {
      var link = document.createElement('link');
      link.id = 'pv-video-app-css';
      link.rel = 'stylesheet';
      link.href = (window.config && window.config.relative_path || '') +
        '/plugins/nodebb-plugin-peipe-video/static/video-app.css?v=14';
      document.head.appendChild(link);
    }

    window.PEIPE_VIDEO_CONFIG = Object.assign({}, window.PEIPE_VIDEO_CONFIG || {}, {
      cid: {cid},
      pageSize: 12,

      // v14：播放按钮始终透传，声音按钮用安全代理开启，避免跳下载页
      preloadAhead: 1,
      preloadVideoAhead: 1,   // 只预载下一个视频 iframe
      virtualTotal: 3,
      coverPreloadAhead: 6,   // 提前预载 6 个封面
      officialBottomReserve: 64, // 底部 TikTok 官方控件高度
      officialPlayPassWidth: 64, // 左下角官方播放按钮透传宽度
      officialSoundLeft: 64, // 官方声音按钮/代理起点
      officialSoundWidth: 88, // 官方声音按钮/代理宽度
      officialControlsExposeMs: 1000, // 播放后提示声音按钮 1 秒，不影响按钮持续可点
      audioKeepAround: 1,

      imageMax: {imageMax},
      swiperCdnCss: '/plugins/nodebb-plugin-peipe-video/static/lib/swiper-bundle.min.css',
      swiperCdnJs:  '/plugins/nodebb-plugin-peipe-video/static/lib/swiper-bundle.min.js'
    });

    // 防止 video-app.js 被重复执行
    if (!window.__peipeVideoDiscoverV14 && !document.getElementById('pv-video-app-js')) {
      var s = document.createElement('script');
      s.id = 'pv-video-app-js';
      s.src = (window.config && window.config.relative_path || '') +
        '/plugins/nodebb-plugin-peipe-video/static/video-app.js?v=14';
      s.async = false;
      document.head.appendChild(s);
    }
  })();
</script>

<!-- IMPORT partials/footer.tpl -->
