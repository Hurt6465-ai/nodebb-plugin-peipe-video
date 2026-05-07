<!-- IMPORT partials/header.tpl -->
<div id="peipe-video-app" class="pv-root" data-cid="{cid}">
  <div class="pv-init-loading">[[peipe-video:sourceNotice]]</div>
</div>
<link rel="stylesheet" href="{relative_path}/plugins/nodebb-plugin-peipe-video/static/video-app.css?v=10.0.0">
<script>
  window.PEIPE_VIDEO_CONFIG = Object.assign({}, window.PEIPE_VIDEO_CONFIG || {}, {
    cid: {cid},
    pageSize: 12,
    preloadAhead: 14,
    preloadVideoAhead: 5,
    imageMax: {imageMax},
    swiperCdnCss: '{relative_path}/plugins/nodebb-plugin-peipe-video/static/lib/swiper-bundle.min.css',
    swiperCdnJs: '{relative_path}/plugins/nodebb-plugin-peipe-video/static/lib/swiper-bundle.min.js'
  });
  window.PEIPE_VIDEO_TEXT = Object.assign({}, window.PEIPE_VIDEO_TEXT || {}, {
    sourceNotice: '[[peipe-video:sourceNotice]]',
    loading: '[[peipe-video:sourceNotice]]',
    empty: '[[peipe-video:empty]]',
    publish: '[[peipe-video:publish]]',
    publishing: '[[peipe-video:publishing]]',
    publishOk: '[[peipe-video:publishOk]]',
    publishFail: '[[peipe-video:publishFail]]',
    placeholder: '[[peipe-video:placeholder]]',
    chooseImage: '[[peipe-video:chooseImage]]',
    send: '[[peipe-video:send]]',
    comments: '[[peipe-video:comments]]',
    commentPlaceholder: '[[peipe-video:commentPlaceholder]]',
    noComments: '[[peipe-video:noComments]]',
    replyTo: '[[peipe-video:replyTo]]',
    translate: '[[peipe-video:translate]]',
    translating: '[[peipe-video:translating]]',
    translateSettings: '[[peipe-video:translateSettings]]',
    sourceLang: '[[peipe-video:sourceLang]]',
    targetLang: '[[peipe-video:targetLang]]',
    google: '[[peipe-video:google]]',
    ai: '[[peipe-video:ai]]',
    save: '[[peipe-video:save]]',
    deleteVideo: '[[peipe-video:deleteVideo]]',
    deleteConfirm: '[[peipe-video:deleteConfirm]]',
    deleteOk: '[[peipe-video:deleteOk]]',
    deleteFail: '[[peipe-video:deleteFail]]',
    loginFirst: '[[peipe-video:loginFirst]]',
    voiceMsg: '[[peipe-video:voiceMsg]]',
    recordUnsupported: '[[peipe-video:recordUnsupported]]',
    micDenied: '[[peipe-video:micDenied]]'
  });
</script>
<script src="{relative_path}/plugins/nodebb-plugin-peipe-video/static/video-app.js?v=10.0.0"></script>
<!-- IMPORT partials/footer.tpl -->
