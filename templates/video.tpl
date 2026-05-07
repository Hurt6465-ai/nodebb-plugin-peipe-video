<!-- IMPORT partials/header.tpl -->

<div id="peipe-video-app" class="pv-root" data-cid="{cid}">
  <div class="pv-init-loading">[[peipe-video:loading]]</div>
</div>
<link rel="stylesheet" href="{relative_path}/plugins/nodebb-plugin-peipe-video/static/video-app.css?v=8">
<script>
  window.PEIPE_VIDEO_CONFIG = Object.assign({}, window.PEIPE_VIDEO_CONFIG || {}, {
    cid: {cid},
    pageSize: 12,
    preloadAhead: 9.1,
    preloadVideoAhead: 3,
    imageMax: {imageMax},
    swiperCdnCss: '/plugins/nodebb-plugin-peipe-video/static/lib/swiper-bundle.min.css',
    swiperCdnJs: '/plugins/nodebb-plugin-peipe-video/static/lib/swiper-bundle.min.js'
  });
</script>
<script src="{relative_path}/plugins/nodebb-plugin-peipe-video/static/video-app.js?v=8"></script>

<!-- IMPORT partials/footer.tpl -->
