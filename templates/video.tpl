<!-- IMPORT partials/header.tpl -->

<div id="peipe-video-app" class="pv-root" data-cid="{cid}">
  <div class="pv-init-loading">[[peipe-video:sourceNotice]]</div>
</div>
<link rel="stylesheet" href="{relative_path}/plugins/nodebb-plugin-peipe-video/static/video-app.css?v=8.1">
<script>
  window.PEIPE_VIDEO_CONFIG = Object.assign({}, window.PEIPE_VIDEO_CONFIG || {}, {
    cid: {cid},
    pageSize: 12,
    preloadAhead: 16,
    preloadVideoAhead: 5,
    virtualTotal: 5,
    imageMax: {imageMax},
    swiperCdnCss: '{relative_path}/plugins/nodebb-plugin-peipe-video/static/lib/swiper-bundle.min.css',
    swiperCdnJs: '{relative_path}/plugins/nodebb-plugin-peipe-video/static/lib/swiper-bundle.min.js'
  });

  window.PEIPE_VIDEO_TEXT = Object.assign({}, window.PEIPE_VIDEO_TEXT || {}, {
    loading: '[[peipe-video:sourceNotice]]',
    sourceNotice: '[[peipe-video:sourceNotice]]',
    publish: '[[peipe-video:publish]]',
    send: '[[peipe-video:send]]',
    chooseImage: '[[peipe-video:chooseImage]]',
    placeholder: '[[peipe-video:placeholder]]',
    comments: '[[peipe-video:comments]]',
    commentPlaceholder: '[[peipe-video:commentPlaceholder]]',
    replyTo: '[[peipe-video:replyTo]]',
    translate: '[[peipe-video:translate]]',
    translateSettings: '[[peipe-video:translateSettings]]',
    sourceLang: '[[peipe-video:sourceLang]]',
    targetLang: '[[peipe-video:targetLang]]',
    google: '[[peipe-video:google]]',
    ai: '[[peipe-video:ai]]',
    save: '[[peipe-video:save]]',
    openOriginal: '[[peipe-video:openOriginal]]',
    deleteVideo: '[[peipe-video:deleteVideo]]',
    deleteConfirm: '[[peipe-video:deleteConfirm]]'
  });
</script>
<script src="{relative_path}/plugins/nodebb-plugin-peipe-video/static/video-app.js?v=8.1"></script>

<!-- IMPORT partials/footer.tpl -->
