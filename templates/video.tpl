<!-- IMPORT partials/header.tpl -->

<div id="peipe-video-app" class="pv-root" data-cid="{cid}">
  <div class="pv-init-loading">[[peipe-video:loading]]</div>
</div>

<link rel="stylesheet" href="{relative_path}/plugins/nodebb-plugin-peipe-video/static/video-app.css?v=12">

<script>
  window.PEIPE_VIDEO_CONFIG = Object.assign({}, window.PEIPE_VIDEO_CONFIG || {}, {
    cid: {cid},
    pageSize: 12,

    // 预载设置：视频自动静音播放，预载下2个视频，预热6个封面
    preloadAhead: 2,
    preloadVideoAhead: 2, 
    virtualTotal: 4,
    officialControlsMs: 500,
    coverPreloadAhead: 6,

    imageMax: {imageMax},
    swiperCdnCss: '/plugins/nodebb-plugin-peipe-video/static/lib/swiper-bundle.min.css',
    swiperCdnJs: '/plugins/nodebb-plugin-peipe-video/static/lib/swiper-bundle.min.js'
  });
</script>

<script src="{relative_path}/plugins/nodebb-plugin-peipe-video/static/video-app.js?v=12"></script>

<!-- IMPORT partials/footer.tpl -->
