<!-- IMPORT partials/header.tpl -->

<div id="peipe-video-app" class="pv-root" data-cid="{cid}">
  <div class="pv-init-loading">[[peipe-video:loading]]</div>
</div>
<link rel="stylesheet" href="/plugins/nodebb-plugin-peipe-video/static/video-app.css">
<script>
  window.PEIPE_VIDEO_CONFIG = Object.assign({}, window.PEIPE_VIDEO_CONFIG || {}, {
    cid: {cid},
    pageSize: 12,
    preloadAhead: 3,
    virtualTotal: 5,
    imageMax: {imageMax}
  });
</script>
<script src="/plugins/nodebb-plugin-peipe-video/static/video-app.js"></script>

<!-- IMPORT partials/footer.tpl -->
