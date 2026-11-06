# 《去留》功能等价复刻 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用 Expo/RN 复刻《去留》照片随机回顾清理 app（无商业化、完全本地），在用户 iPhone（augustone, iOS 27）经 Expo Go 实机跑通全部核心流程。

**Architecture:** expo-router 三 tab（照片/视频/统计）+ modal（回收站/回到那天/信息/设置）；expo-media-library 做读取/删除/收藏；SQLite 镜像原 Core Data 语义做浏览与删除记录；reanimated+gesture-handler 实现卡组手势；照片取样色做渐变背景。

**Tech Stack:** Expo SDK 54+ / React Native 0.81 / TypeScript / expo-media-library / expo-image / expo-video / expo-sqlite / expo-haptics / expo-location / react-native-maps / reanimated / gesture-handler / jest-expo

**Spec:** `docs/superpowers/specs/2026-11-06-quliu-clone-design.md`（v1.1，含 §12 强制质量环节）

## Global Constraints

- 仅 Expo Go 运行形态：禁止需要 dev build/Xcode 的依赖（expo-maps 禁用，用 react-native-maps 1.20+）
- 不复制原 app 任何代码/图片/字体/Lottie 素材；文案原创（可参考功能清单语义）
- iOS 16+ 兼容；设备 augustone (iOS 27)；删除验收只针对"截屏"分类
- TypeScript strict；依赖限 MIT/BSD/Apache 许可
- 每个 Task 收尾：`npx tsc --noEmit` + `npm test` 通过 + git commit；UI Task 另加实机抓屏比对（`pymobiledevice3 developer dvt screenshot`）
- 项目目录：`/Users/lianglihang/Downloads/quliu/app`（app 源码）；证据在 `analysis/`、`screens/`、`功能清单.md`

## Review Focus

1. **相册权限矩阵**：未请求/受限访问(limited)/拒绝/完整 四态下，首启引导与降级行为必须正确（受限态须提示去系统设置开完整访问，对齐原 app 文案语义）。
2. **iCloud 未下载资产**：取图/导出/删除均不得挂死——超时后降级显示"需要 iCloud"提示；删除依赖网络时给出明确错误。
3. **空态与边界**：相册为空、分类无内容、一组看完、全部看完、待删除为空——每态有对应页面且不崩溃。
4. **手势竞态**：动画进行中再次滑动/快速连滑——删除/收藏记录与实际作用资产一致，不丢不错位。
5. **特殊媒体入卡组**：实况/GIF/长图/超宽图在卡片中正确显示与归类，不崩溃、不误判类型。

---

### Task 1: 项目脚手架与工具链

**Files:**
- Create: `/Users/lianglihang/Downloads/quliu/app`（create-expo-app 模板）
- Create: `app/app.json`（修改：bundleId `com.augustone.quliu-clone`、相册权限文案、iOS 支持）
- Create: `app/jest.config.js`、`app/test/setup.ts`
- Modify: 根目录 `git init`（quliu 整仓）

**Interfaces:**
- Produces: 可运行的 Expo 项目；`npm test`（jest-expo）可执行；Metro 可被 iPhone Expo Go 连接

- [ ] Step 1: `git init` + `.gitignore`（node_modules、.expo、dist）
- [ ] Step 2: `npx create-expo-app@latest app --template blank-typescript`；进入 app 目录
- [ ] Step 3: `npx expo install expo-media-library expo-image expo-video expo-sqlite expo-haptics expo-location expo-file-system react-native-maps react-native-reanimated react-native-gesture-handler expo-router react-native-safe-area-context expo-constants expo-splash-screen`；`npx expo install --fix` 校版本
- [ ] Step 4: app.json 配置 scheme/permissions（NSPhotoLibraryUsageDescription 原创文案）；package.json main 指向 `index.ts`，加 `"scheme": "quliu"`；按 expo-router 要求设 `"main": "expo-router/entry"`
- [ ] Step 5: 装 jest-expo + ts-jest 配置，写一个 `test/smoke.test.ts` 断言 1+1=2，`npm test` 通过
- [ ] Step 6: `npx expo start --lan`，用户在 iPhone Expo Go 扫码打开，确认渲染 Hello 页
- [ ] Step 7: commit `chore: expo scaffold with router, media, sqlite, reanimated`

### Task 2: 数据层 SQLite Repository

**Files:**
- Create: `app/src/db/schema.ts`、`app/src/db/repo.ts`
- Test: `app/src/db/__tests__/repo.test.ts`

**Interfaces:**
- Consumes: expo-sqlite `openDatabaseAsync`
- Produces:
  - `initDb(): Promise<void>`（建表 media/deletion/settings，幂等）
  - `upsertMedia(items: MediaRow[]): Promise<void>`；`MediaRow = {localIdentifier, cloudIdentifier?, mediaType: MediaType, width, height, creationDate, favorite}`
  - `markReviewed(ids: string[], at: Date): Promise<void>`（写 lastReviewedDate）
  - `fetchUnreviewedRandom(category: MediaType, n: number): Promise<MediaRow[]>`
  - `addDeletion(rec: {localIdentifier, mediaType, deletedAt, fileSize}): Promise<void>`
  - `getStats(): Promise<StatGroup[]>`（按类型聚合 查看数/删除数/节省字节）
  - `resetReviewed(scope: 'all'|'photos'|'photosNoScreenshots'|'screenshots'|'videos'): Promise<void>`
  - `getSetting(key)/setSetting(key, value)`
  - `MediaType = 'photo'|'video'|'screenshot'|'selfie'|'live'|'gif'|'long'`

- [ ] Step 1: 写失败测试：upsert→fetchUnreviewedRandom 返回未读、markReviewed 后不再返回、reset scope 生效、getStats 聚合正确、settings 读写（内存数据库跑）
- [ ] Step 2: `npm test src/db` 确认 FAIL
- [ ] Step 3: 实现 schema.ts + repo.ts 使测试通过（SQL 参数化，批量 upsert 用事务）
- [ ] Step 4: commit `feat(db): media/deletion/settings repository`

### Task 3: 资产扫描与分类

**Files:**
- Create: `app/src/lib/scan.ts`、`app/src/lib/classify.ts`
- Test: `app/src/lib/__tests__/classify.test.ts`

**Interfaces:**
- Consumes: `expo-media-library`（`requestPermissionsAsync`/`getMediaAssetsAsync`/`getAlbumsAsync({includeSmartAlbums:true})`/`getAssetsInAlbumAsync`）、Task 2 `upsertMedia`
- Produces:
  - `classifyAsset(asset: PHLiteAsset, albumSets: Record<AlbumKind, Set<string>>): MediaType`（纯函数）
  - `ensurePhotoPermission(): Promise<PermState>`，`PermState='granted'|'limited'|'denied'`
  - `startImport(onProgress: (done,total)=>void): Promise<{imported, skipped}>`（分批 200/页，幂等 upsert，已导入则快进）

- [ ] Step 1: 失败测试：classify 优先级（截图相册>自拍相册>实况subtype不可用→相册>video+dur≈0→gif>宽高比>2.5→long>photo/video），含 Review Focus#5 用例
- [ ] Step 2: 实现 classify.ts 通过
- [ ] Step 3: 实机 spike：iPhone 上跑 `ensurePhotoPermission` + `startImport`，验证四权限态与导入进度、受限态提示；抓屏存档 `screens/spike-perm.png`
- [ ] Step 4: commit `feat(scan): permission + incremental import + classifier`

### Task 4: 随机分组与浏览会话

**Files:**
- Create: `app/src/lib/session.ts`
- Test: `app/src/lib/__tests__/session.test.ts`

**Interfaces:**
- Consumes: `fetchUnreviewedRandom`、`getSetting('photosPerGroup'|'videosPerGroup')`（默认 15）
- Produces:
  - `nextGroup(category: MediaType): Promise<Group>`；`Group = {items: MediaRow[], index: number}`
  - `markSeen(item: MediaRow): Promise<void>`（卡片被看到即写 reviewed）
  - `groupSizeLabel(category): string`（首页胶囊"照片 15"）

- [ ] Step 1: 失败测试：组大小取 settings、不足时返回全部、空库返回空组、markSeen 幂等
- [ ] Step 2: 实现通过；commit `feat(session): random groups`

### Task 5: 删除队列与真实删除

**Files:**
- Create: `app/src/lib/deletion.ts`
- Test: `app/src/lib/__tests__/deletion.test.ts`

**Interfaces:**
- Consumes: `expo-media-library.deleteAssetsAsync(ids)`、`getAssetInfoAsync(asset,{preserveJpegMetadata:true})`→`expo-file-system.statAsync` 取 fileSize
- Produces:
  - `PendingQueue`（内存单例）：`push(item)`/`remove(id)`/`discardAll()`/`list()`
  - `measureSize(localIdentifier): Promise<number|null>`（12s 超时→null，iCloud 未下载即 null）
  - `commitPending(): Promise<CommitResult>`（勾选→deleteAssetsAsync→成功项写 addDeletion+清 media 行；失败项保留并返回错误文案）
- [ ] Step 1: 失败测试：push/discard/去重；measureSize 超时返回 null（mock）；commit 部分失败只清成功项
- [ ] Step 2: 实现通过
- [ ] Step 3: 实机验证（删除保护）：切"截屏"分类，上滑 2 张截屏→回收站→确认删除→系统弹窗→相册真实消失；抓屏 `screens/spike-delete.png`
- [ ] Step 4: commit `feat(deletion): pending queue + real delete with size probe`

### Task 6: App 壳与主题（渐变背景/取色）

**Files:**
- Create: `app/app/_layout.tsx`（tabs 路由）、`app/app/(photos)/index.tsx`、`app/app/(videos)/index.tsx`、`app/app/(stats)/index.tsx`
- Create: `app/src/theme/colors.ts`、`app/src/theme/GradientBackground.tsx`、`app/src/lib/palette.ts`
- Test: `app/src/lib/__tests__/palette.test.ts`

**Interfaces:**
- Produces:
  - `samplePalette(uri: string): Promise<[Color,Color]>`（expo-image ImageManipulator 1×1 两次取样；失败回退 `['#2b2b35','#151520']`）
  - `GradientBackground({colors})`：对角深色渐变
  - Tab 栏样式常量（胶囊、选中蓝 #4C8DFF）
- [ ] Step 1: 失败测试：解码 1×1 PNG base64 得 RGB；非法输入回退默认色
- [ ] Step 2: 实现 palette.ts 通过
- [ ] Step 3: 壳 UI：三 tab + 占位页 + GradientBackground；实机抓屏比对 IMG_1490 底栏形态
- [ ] Step 4: commit `feat(shell): tabs + gradient theme`

### Task 7: 卡组浏览页（核心手势）

**Files:**
- Create: `app/app/(photos)/review.tsx`、`app/src/components/CardStack.tsx`、`app/src/components/ReviewCard.tsx`、`app/src/lib/haptics.ts`
- Test: `app/src/components/__tests__/CardStack.gesture.test.tsx`（jest 只测状态机，手势实机测）

**Interfaces:**
- Consumes: `nextGroup`/`markSeen`/`PendingQueue.push`/`favoriteAssetsAsync`/`samplePalette`
- Produces:
  - `CardStack` props：`{items, onSwipeUp(item), onSwipeDown(item), onTapSide(dir), onPinch(item), onDoubleTap(item)}`；状态机：`advance()` 消费一张即 markSeen
  - 双击行为读 settings `doubleTapAction: 'favorite'|'zoom'`
  - 顶部组内进度条 + 底部 ♡/时间胶囊/ⓘ/↩（时间格式 settings `timeFormat: 'relative'|'date'`，`formatTime(creationDate)` 纯函数进 `app/src/lib/time.ts`）
- [ ] Step 1: 失败测试：状态机 advance/index 一致性（Review Focus#4：动画中再次事件不重复消费）；formatTime 相对时间边界（刚刚/分钟前/天前/年前 + 具体日期）
- [ ] Step 2: 实现 time.ts + 状态机通过
- [ ] Step 3: CardStack UI：3 卡堆叠（中±0°、侧 ±10°）、上滑飞顶+红光近似、下滑心形反馈、haptics；实机跑通一组 15 张，抓屏比对 IMG_1490/1492
- [ ] Step 4: commit `feat(review): card deck with gestures + haptics`

### Task 8: 分类菜单与每组数量

**Files:**
- Create: `app/app/(photos)/_layout.tsx` 首页头部、`app/src/components/CategoryMenu.tsx`、`app/src/components/GroupSizeSheet.tsx`

**Interfaces:**
- Consumes: `MediaType` 列表、`getSetting/setSetting`
- Produces: 毛玻璃下拉（照片/截屏/自拍/实况/动图/长图 + 调整每组数量），当前分类✓标记；胶囊按钮"分类 N"
- [ ] Step 1: 实现菜单+滑杆（5-100），写 settings 后首页数字更新
- [ ] Step 2: 实机抓屏比对 IMG_1491
- [ ] Step 3: commit `feat(photos): category menu + group size`

### Task 9: 回收站页

**Files:**
- Create: `app/app/pending.tsx`（modal sheet）、`app/src/components/PendingGrid.tsx`

**Interfaces:**
- Consumes: `PendingQueue.list()`/`commitPending()`/`discardAll()`
- Produces: 网格缩略图+绿✓选择；"放弃，返回首页"/"确认删除"（红）；删除中/失败态文案
- [ ] Step 1: 失败测试：选择集计算（全选/取消）纯函数
- [ ] Step 2: 实现 UI；实机走通"只删截屏"全流程，抓屏比对 IMG_1498
- [ ] Step 3: commit `feat(pending): recycle bin sheet`

### Task 10: 回到那天页

**Files:**
- Create: `app/app/back-to-day.tsx`、`app/src/lib/sameDay.ts`
- Test: `app/src/lib/__tests__/sameDay.test.ts`

**Interfaces:**
- Consumes: media 表按 `date(creationDate)` 查询；`PendingQueue`
- Produces: `sameDayItems(anchor: MediaRow): Promise<MediaRow[]>`（当天全部，含视频截屏）；横滑照片墙、✓批量入队、重播、点状进度
- [ ] Step 1: 失败测试：同日边界（跨时区按本地日）、空当天返回空
- [ ] Step 2: 实现；实机捏合进入，抓屏比对 IMG_1493
- [ ] Step 3: commit `feat(back-to-day): day wall`

### Task 11: 视频浏览页

**Files:**
- Create: `app/app/(videos)/review.tsx`、`app/src/components/VideoCard.tsx`

**Interfaces:**
- Consumes: `nextGroup('video')`、`expo-video`（`useVideoPlayer`，`videoController.setPlaybackRate(2)`）
- Produces: 全屏沉浸、右侧 ♡/分享/🗑/↩、左下时间+位置、长按 2×、底部进度、上下滑切换
- [ ] Step 1: 实现；实机验证播放/倍速/删除入队；抓屏比对 IMG_1494
- [ ] Step 2: commit `feat(videos): immersive review`

### Task 12: 照片信息页（EXIF/地图/地址）

**Files:**
- Create: `app/app/photo-info.tsx`、`app/src/lib/exif.ts`
- Test: `app/src/lib/__tests__/exif.test.ts`

**Interfaces:**
- Consumes: `measureSize` 同源导出路径（`exportForExif(localIdentifier): Promise<{uri,size}|null>` 放 `deletion.ts` 复用）、纯 JS exif 解析（选 MIT 库 `exif-parser`，若无 TS 则薄封装）、`expo-location.reverseGeocodeAsync`、react-native-maps `MapView`（providerless/Apple）
- Produces: `parseExif(arrayBuffer): ExifInfo`（光圈/快门/ISO/焦距/设备/文件名，缺项为 null）；信息页布局对齐 IMG_1499；"去相册"按钮（Linking `photos-redirect://`）
- [ ] Step 1: 失败测试：给定固定 JPEG 样本解析出四参数；无 EXIF 返回全 null 不抛错
- [ ] Step 2: 实现 exif.ts；实机 spike：本地截屏（无 EXIF→降级态）+ 一张原片（有 EXIF）都正确；抓屏比对 IMG_1499
- [ ] Step 3: commit `feat(info): exif + map + address`

### Task 13: 统计页

**Files:**
- Create: `app/app/(stats)/index.tsx`（替换占位）

**Interfaces:**
- Consumes: `getStats()`
- Produces: 分组卡（照片/截屏/视频 × 查看/删除/清理）+ 腾出空间大数字 + 进度条 + 右上齿轮→设置；文案对齐功能清单 §3 语义（原创措辞）
- [ ] Step 1: 失败测试：StatGroup→展示模型（字节格式化 B/KB/MB/GB）纯函数
- [ ] Step 2: 实现；实机抓屏比对 IMG_1495
- [ ] Step 3: commit `feat(stats): grouped stats`

### Task 14: 设置页与重置

**Files:**
- Create: `app/app/settings.tsx`、`app/src/components/ResetSheet.tsx`

**Interfaces:**
- Consumes: `getSetting/setSetting`、`resetReviewed(scope)`
- Produces: 分组卡：每组数量、震动反馈、双击手势、时间格式、照片HDR/视频HDR（存设置，渲染侧消费）、重置浏览记录（五范围选择+确认文案）、关于（版本+隐私声明）
- [ ] Step 1: 失败测试：scope 文案映射与重置确认流状态机
- [ ] Step 2: 实现；实机抓屏比对 IMG_1496（裁剪版：无会员/iCloud/小组件/演示项）
- [ ] Step 3: commit `feat(settings): options + reset`

### Task 15: 完成态/空态/首启流 + confetti

**Files:**
- Create: `app/src/components/Confetti.tsx`、`app/app/onboarding.tsx`
- Modify: review.tsx（完成/空态分支）

**Interfaces:**
- Consumes: Task 3 `ensurePhotoPermission`、Task 4 空组、Task 6 palette
- Produces: 权限四态引导页（受限态说明+去设置）；导入进度页；一组看完→"再来一组"（吸入旧卡）；分类看完→引导切分类；全部看完→完成页+confetti+重置入口；实况徽章"◉ 实况 "胶囊
- [ ] Step 1: 失败测试：首启状态机（未决权限→请求→受限/拒绝/授权→导入→就绪）转移
- [ ] Step 2: 实现；实机走全新权限流（重置 app 权限），抓屏存档
- [ ] Step 3: commit `feat(flows): onboarding + completion states + confetti`

### Task 16: 全链路实机验收 + 子代理评估 + 交付文档

**Files:**
- Create: `app/README.md`（构建、Expo Go 运行、升级独立 app 路径）、`验收报告.md`（根目录）

- [ ] Step 1: 按功能清单 §9"做"清单逐条实机走查，每条留抓屏证据 `screens/accept-*.png`
- [ ] Step 2: 派独立评估 subagent：对照功能清单+设计文档打分（通过/不通过/降级），输出差距清单
- [ ] Step 3: 修复不通过项并复评
- [ ] Step 4: REA 对照终检：数据模型字段、文案语义、页面清单与 analysis/ 证据再核对一遍
- [ ] Step 5: commit + tag `v1.0-acceptance`；交付 README + 验收报告给用户

---

## 里程碑映射

M0=T1 · M1=T2-T7+T9（核心循环）· M2=T8/T10/T13/T14 · M3=T11/T12/T15 · M4=T16。每个里程碑结束执行设计文档 §12 质量环节后再进下一个。
