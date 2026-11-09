const { withAndroidManifest } = require('@expo/config-plugins');

// Android 视频流多 ExoPlayer 解码器峰值超默认堆（512MB）→ OOM。
// expo 原生 app.json 无 largeHeapEnabled 字段，用本地插件持久注入
// android:largeHeap="true"，prebuild 重生成不丢失。
module.exports = function withLargeHeap(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    if (app) {
      app.$['android:largeHeap'] = 'true';
    }
    return cfg;
  });
};
