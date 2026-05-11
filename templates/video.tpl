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
        '/plugins/nodebb-plugin-peipe-video/static/video-app.css?v=12';
      document.head.appendChild(link);
    }

    window.PEIPE_VIDEO_CONFIG = Object.assign({}, window.PEIPE_VIDEO_CONFIG || {}, {
      cid: {cid},
      pageSize: 12,

      // v12：当前视频静音自动播放；声音由 TikTok 官方音量按钮控制
      preloadAhead: 1,
      preloadVideoAhead: 1,   // 只预载下一个视频 iframe
      virtualTotal: 3,
      coverPreloadAhead: 6,   // 提前预载 6 个封面
      officialBottomReserve: 64, // 底部留 64px 给 TikTok 官方控件
      audioKeepAround: 1,

      imageMax: {imageMax},
      swiperCdnCss: '/plugins/nodebb-plugin-peipe-video/static/lib/swiper-bundle.min.css',
      swiperCdnJs:  '/plugins/nodebb-plugin-peipe-video/static/lib/swiper-bundle.min.js'
    });

    // 防止 video-app.js 被重复执行
    if (!window.__peipeVideoDiscoverV12 && !document.getElementById('pv-video-app-js')) {
      var s = document.createElement('script');
      s.id = 'pv-video-app-js';
      s.src = (window.config && window.config.relative_path || '') +
        '/plugins/nodebb-plugin-peipe-video/static/video-app.js?v=12';
      s.async = false;
      document.head.appendChild(s);
    }
  })();
</script>

<!-- IMPORT partials/footer.tpl -->
