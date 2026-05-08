<style id="pv-critical-v19">
html, body { margin:0 !important; padding:0 !important; background:#000 !important; overflow:hidden !important; }
body.page-video .navbar,
body.page-video [component="navbar"],
body.page-video header,
body.page-video .breadcrumb,
body.page-video footer,
body.page-video [component="sidebar"],
body.template-video .navbar,
body.template-video [component="navbar"],
body.template-video header,
body.template-video .breadcrumb,
body.template-video footer,
body.template-video [component="sidebar"] { display:none !important; visibility:hidden !important; height:0 !important; overflow:hidden !important; }
body.page-video #content,
body.template-video #content,
body.page-video .container,
body.template-video .container,
body.page-video .container-lg,
body.template-video .container-lg,
body.page-video .container-md,
body.template-video .container-md,
body.page-video .container-sm,
body.template-video .container-sm,
body.page-video .container-xl,
body.template-video .container-xl,
body.page-video .container-xxl,
body.template-video .container-xxl { max-width:none !important; width:100vw !important; height:100dvh !important; padding:0 !important; margin:0 !important; }
#peipe-video-app { position:fixed !important; inset:0 !important; z-index:2147483000 !important; width:100vw !important; height:100dvh !important; background:#000 !important; color:#fff !important; overflow:hidden !important; }
.pv-init-loading { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; color:#fff; background:#000; }
</style>
<div id="peipe-video-app" class="pv-root" data-cid="{cid}" data-version="v20-custom-sound-one-tap">
  <div class="pv-init-loading">发现加载中...</div>
</div>
<link rel="stylesheet" href="/plugins/nodebb-plugin-peipe-video/static/video-app.css?v=20">
<script>
window.PEIPE_VIDEO_CONFIG = Object.assign({}, window.PEIPE_VIDEO_CONFIG || {}, {
  cid: {cid},
  pageSize: 12,
  preloadAhead: 28,
  preloadVideoAhead: 5,
  imageMax: {imageMax},
  swiperCdnCss: '/plugins/nodebb-plugin-peipe-video/static/lib/swiper-bundle.min.css',
  swiperCdnJs: '/plugins/nodebb-plugin-peipe-video/static/lib/swiper-bundle.min.js'
});
</script>
<script src="/plugins/nodebb-plugin-peipe-video/static/video-app.js?v=20"></script>
