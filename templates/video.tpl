<style id="pv-critical-v14">
html, body { margin:0 !important; padding:0 !important; background:#000 !important; overflow:hidden !important; }
body.pv-video-mode .navbar,
body.pv-video-mode [component="navbar"],
body.pv-video-mode .breadcrumb,
body.pv-video-mode footer,
body.pv-video-mode [component="sidebar"] { display:none !important; }
#content, .container, .container-lg, .container-md, .container-sm, .container-xl, .container-xxl { max-width:none !important; width:100% !important; padding:0 !important; margin:0 !important; }
#peipe-video-app { position:fixed; inset:0; z-index:1500; background:#000; color:#fff; }
.pv-init-loading { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; color:#fff; background:#000; }
</style>
<div id="peipe-video-app" class="pv-root" data-cid="{cid}" data-version="v14-full-debug-safe">
  <div class="pv-init-loading">发现加载中...</div>
</div>
<link rel="stylesheet" href="/plugins/nodebb-plugin-peipe-video/static/video-app.css?v=14">
<script>
window.PEIPE_VIDEO_CONFIG = Object.assign({}, window.PEIPE_VIDEO_CONFIG || {}, {
  cid: {cid},
  pageSize: 12,
  preloadAhead: 6,
  preloadVideoAhead: 2,
  imageMax: {imageMax},
  swiperCdnCss: '/plugins/nodebb-plugin-peipe-video/static/lib/swiper-bundle.min.css',
  swiperCdnJs: '/plugins/nodebb-plugin-peipe-video/static/lib/swiper-bundle.min.js'
});
</script>
<script src="/plugins/nodebb-plugin-peipe-video/static/video-app.js?v=14"></script>
