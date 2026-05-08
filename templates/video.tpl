<!-- IMPORT partials/header.tpl -->

<style id="pv-critical-v12">
html,body{margin:0!important;padding:0!important;background:#000!important;overflow:hidden!important;overscroll-behavior:none!important;}
body .navbar,body [component="navbar"],body .breadcrumb,body footer,body [component="sidebar"],body #panel,body .header,body .account-fab{display:none!important;}
#content,#content>.container,#content>.container-fluid,.container,.container-fluid,main{max-width:none!important;width:100%!important;margin:0!important;padding:0!important;}
#peipe-video-app.pv-root{position:fixed!important;inset:0!important;z-index:2147483000!important;width:100vw!important;height:100dvh!important;background:#000!important;overflow:hidden!important;touch-action:none!important;color:#fff!important;}
.pv-init-loading{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#000;color:rgba(255,255,255,.78);font-weight:800;}
</style>
<div id="peipe-video-app" class="pv-root" data-cid="{cid}" data-version="v12-full-split">
  <div class="pv-init-loading">[[peipe-video:loading]]</div>
</div>
<link rel="stylesheet" href="/plugins/nodebb-plugin-peipe-video/static/video-app-v12.css">
<script>
  window.PEIPE_VIDEO_CONFIG = Object.assign({}, window.PEIPE_VIDEO_CONFIG || {}, {
    cid: {cid},
    pageSize: 12,
    imageMax: {imageMax},
    preloadVideoAhead: 3,
    preloadScanAhead: 14,
    swiperCdnCss: '/plugins/nodebb-plugin-peipe-video/static/lib/swiper-bundle.min.css',
    swiperCdnJs: '/plugins/nodebb-plugin-peipe-video/static/lib/swiper-bundle.min.js'
  });
</script>
<script src="/plugins/nodebb-plugin-peipe-video/static/video-app-v12.js"></script>

<!-- IMPORT partials/footer.tpl -->
