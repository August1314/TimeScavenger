# 拾光 TimeScavenger

像刷短视频一样刷自己的照片库 —— 一款 iOS 端的照片随机回顾与清理工具。

手机相册越积越大，但绝大多数照片从被拍下那天起就再没被看过。拾光把照片库变成一条可以"刷"的信息流：随机回顾旧照片与视频，顺手收藏喜欢的、淘汰不想要的，让整理相册像刷视频一样轻松。

## 功能

- **随机回顾卡组**：按分类（照片 / 截屏 / 自拍 / 实况 / 动图 / 视频）随机抽取一组旧照片，上滑待删除、下滑收藏、左右切换、捏合回到那天；已读三年内不再重复出现
- **待删除队列（回收站）**：所有删除先进入队列，最终确认后才真正删除系统相册，支持撤回
- **实况照片**：卡内长按即播（基于系统配对视频提取），收藏状态与系统相册双向同步
- **视频回顾**：沉浸式全屏循环播放，上下滑切换、长按 2x 倍速
- **回到那天**：从任意照片进入当天的双列瀑布流回忆墙，支持过滤、刻度条跳转、锚点回位
- **照片信息页**：EXIF 拍摄参数、地图拍摄地点（Apple Maps）、文件名与存储占用
- **统计页**：各类媒体数量与占用空间、回顾进度、"腾出空间"估算
- **设置**：每组数量、双击手势（收藏 / 放大预览）、时间显示、震动反馈、按范围重置浏览记录
- **首启引导**：权限申请 → 增量导入 → 完成庆祝动效

## 隐私

所有照片数据**仅在本机访问与处理**，不上传任何内容。删除操作始终需要你在回收站中最终确认。

## 技术栈

- [Expo SDK 58](https://expo.dev) / React Native 0.88 / TypeScript
- expo-router（文件路由）· expo-media-library（PHAsset 访问）· expo-image / expo-video / expo-live-photo · expo-sqlite（本地浏览记录）
- react-native-gesture-handler + reanimated（卡组手势与动效）· react-native-maps（Apple Maps）
- 66+ 单元测试（jest）

## 开始使用

```bash
npm install
npx expo start
```

用 iPhone 上的 [Expo Go](https://apps.apple.com/app/expo-go/id982107779) 扫码即可运行（需要真实照片库数据，模拟器体验有限）。

## 目录结构

```
src/app/            expo-router 路由页（tabs / review / back-to-day / day-preview / photo-info / pending / settings / onboarding）
src/components/     卡堆、分类菜单等组件
src/lib/            扫描导入、卡组状态机、会话、删除队列、EXIF、定位等业务逻辑
src/db/             SQLite schema 与仓储层
src/theme/          色彩令牌与渐变背景
```

## License

[GPL-3.0](LICENSE)
