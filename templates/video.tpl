<!-- IMPORT partials/header.tpl -->

<div id="peipe-video-app" class="pv-root" data-cid="{cid}">
  <div class="pv-init-loading">[[peipe-video:loading]]</div>
</div>

<link rel="stylesheet" href="{relative_path}/plugins/nodebb-plugin-peipe-video/static/video-app.css?v=11">

<script>
  window.PEIPE_VIDEO_CONFIG = Object.assign({}, window.PEIPE_VIDEO_CONFIG || {}, {
    cid: {cid},
    pageSize: 12,

    /*
      TikTok iframe 很重，建议先用 5 / 2。
      如果手机性能和网络都好，再改成 6 / 3。
    */
    preloadAhead: 5,
    preloadVideoAhead: 2,

    virtualTotal: 5,
    imageMax: {imageMax},

    /*
      封面缓存接口：
      前端拿到 TikTok oEmbed 封面后，会尝试 POST 到这个接口。
      后端接好后，其他用户浏览 feed 时就能直接从缓存 coverUrl 读取封面。
    */
    coverCacheApi: '/api/v3/plugins/peipe-video/cover',

    /*
      滑动/播放体验开关
    */
    disableDoubleTapLike: true,
    manualPauseLock: true,

    swiperCdnCss: '/plugins/nodebb-plugin-peipe-video/static/lib/swiper-bundle.min.css',
    swiperCdnJs: '/plugins/nodebb-plugin-peipe-video/static/lib/swiper-bundle.min.js'
  });
</script>

<script src="{relative_path}/plugins/nodebb-plugin-peipe-video/static/video-app.js?v=11"></script>

<!-- IMPORT partials/footer.tpl -->
