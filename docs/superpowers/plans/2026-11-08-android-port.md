# 拾光 Android 移植 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `feat/android` 分支上让拾光（Expo/RN，现仅 iOS）以 debug APK 全功能运行，先以 **AVD 模拟器（Pixel 形态 / API 34 / arm64）** 为开发靶机搭好 jest→adb→Maestro→screencap→agent 看图 的 Ralph 验证循环；一加 15T 真机在计划末期接入做抽查回归。

**Architecture:** 方案 A：同库分支 + `Platform.OS` 收敛差异。核心新增一个纯函数适配层 `lib/mediaUri.ts`（Android 数字 id → `content://` 展示 URI），iOS 路径零改动；iOS 独占原生面（expo-live-photo、react-native-maps、getIsInCloud iCloud 守卫、photos-redirect）全部 Platform 守卫/降级；验收自动化用 Maestro flow（testID 选择器）+ `adb exec-out screencap`。

**Tech Stack:** Expo SDK 58 / RN 0.88（既有依赖，不新增原生库）、Android SDK（`~/Library/Android/sdk` 已装，含 emulator v37 + android-34 google_apis arm64-v8a 镜像）、JDK 17（需装）、Maestro CLI（需装）、adb（靶机 = `emulator-5554`）。

**Spec:** [docs/superpowers/specs/2026-11-08-android-port-design.md](../specs/2026-11-08-android-port-design.md)

## Global Constraints

- **iOS 行为不变**：所有平台差异只经 `Platform.OS` 或显式 `os` 参数收敛；不得改动 iOS 语义路径（VideoCell 装载时序、deletion 队列、session 等）。
- **不新增任何原生依赖**；expo-live-photo / react-native-maps 保留在 iOS 侧，Android 不渲染。
- 个人自用：仅 debug APK + `adb install`，不做 release 签名/keystore/商店合规；minSdk 用 prebuild 默认。
- 分支：`feat/android`，从 `feat/quliu-clone` 切出。
- 每任务纯代码收尾验证链：`cd app && npx tsc --noEmit && npx jest --silent`（83+ 全绿）；Metro 在跑时加 `curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:8081/node_modules/expo-router/entry.bundle?platform=android&dev=true"` = 200。
- 靶机 = `emulator-5554`（adb 命令一律带 `-s emulator-5554`）；Metro 连接模拟器用 `adb reverse tcp:8081 tcp:8081`（真机接入后同法）；装包（如需）一律 `npm install <pkg>@<ver> --legacy-peer-deps`，本计划不应装 JS 包。
- expo-image / expo-video 在 Android 只认 `content://media/…` URI，不认裸数字 id 与 `ph://`；iOS 保持现状（`ph://` 直传）。

## Review Focus

- **Android `AssetMetadata` 形状未知**（id 是否裸数字、`mediaSubtypes` 是否同名枚举串、`new Asset(id)` 是否吃数字 id）：spec 未定，靠 Task 2 spike 钉死；若 subtypes 不同名，live/screenshot 分类降级为 photo——个人自用可接受，但导入不得崩。
- **权限被中途撤销时 `content://` 加载失败**：expo-image 无 onError 时显示空格子——预期降级为空白而非崩溃；不得出现红屏。
- **MediaStore 删除确认弹窗的取消文案跨平台不同**（iOS "canceled" vs Android "User did not grant…"）：取消必须归入 `已取消删除。` 失败项、保留队列，不得当成功删库。
- **系统弹窗对 Maestro 脆弱**（模拟器 AOSP 弹窗文案稳定；一加 ColorOS 文案可能漂移）：权限用 `adb shell pm grant` 预先授予绕过弹窗；删除确认弹窗用 `optional: true` 文本匹配，文案漂移不得让 flow 硬失败。
- **react-native-maps 在无 Google 服务的国产 ROM 上渲染空白**：photo-info 页 Android 不得挂 MapView（Task 4），且 `import MapView` 顶层导入本身不得崩（真机验证）。
- **Metro 未启动时 debug APK 白屏/红屏**：ralph 脚本必须先探测 8081 再重启 App（Task 7）。

---

### Task 0: 环境准备 + AVD 模拟器靶机（无产品代码）

**Files:**
- Modify: `~/.zshrc`（追加 ANDROID_HOME/PATH）

**Interfaces:**
- Produces: 可用的 `adb`（`~/Library/Android/sdk/platform-tools/adb`）、JDK 17、`maestro` CLI、已启动并注入测试媒体的 `emulator-5554`。后续所有真机任务依赖本任务；一加 15T 推迟到 Task 8 由用户接入。

- [ ] **Step 1: 装 JDK 17**（当前仅 Corretto 11，RN 0.88 要求 17）：`brew install --cask temurin@17`（需管理员密码时请用户输入）。验证 `JAVA_HOME=$(/usr/libexec/java_home -v 17)` 有值。
- [ ] **Step 2: 写环境变量到 `~/.zshrc`**：`export ANDROID_HOME=$HOME/Library/Android/sdk` 与 `PATH` 追加 `$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/emulator`。验证 `adb version` = 1.0.41。
- [ ] **Step 3: 装 Maestro**：`curl -fsSL https://get.maestro.mobile.dev | bash`，验证 `maestro --version`。
- [ ] **Step 4: 建 AVD 并启动**（镜像已在本机：`system-images;android-34;google_apis;arm64-v8a`）：`avdmanager create avd -name shiguang34 -k "system-images;android-34;google_apis;arm64-v8a" -d pixel_8 --force`；后台启动 `emulator -avd shiguang34 -no-audio -gpu host`；`adb -s emulator-5554 wait-for-device shell getprop sys.boot_completed` = 1。注意：磁盘仅剩 ~15G，gradle 构建 + userdata 镜像吃空间，先清出余量再进 Task 1。
- [ ] **Step 5: 注入测试媒体**：`adb push` 2-3 张 jpg（含 EXIF GPS 为佳）+ 1-2 个 mp4 到 `/sdcard/DCIM/Camera/`，触发媒体扫描（`am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file://…`，失效则 `adb emu` 重启扫描或重启 AVD——开机自动扫）；`adb shell content query --uri content://media/external/images/media --projection _id` 能查到数字 id 行。这批媒体就是后续 spike/删除/Feed 的固定测试集。
- [ ] **Step 6: 记录环境台账**（SDK 已有 platforms;android-34/build-tools;34.0.0；RN 0.88 需 compileSdk 36，留给 Task 1 构建时由 AGP 自动下载，失败则 `sdkmanager "platforms;android-36" "build-tools;36.0.0"`）。

### Task 1: feat/android 分支 + app.json Android 配置 + 首次模拟器启动

**Files:**
- Modify: `app/app.json`（`expo` 下新增 `android` 块；`plugins` 不动）
- Create: `app/android/**`（`npx expo prebuild` 生成，生成物不手改）
- Modify: `.gitignore`（追加 `/app/android`，CNG 生成物不入库）

**Interfaces:**
- Produces: applicationId `com.augustone.timescavenger`（后续所有 adb/Maestro 命令用它）；设备上可启动的 debug APK。

- [ ] **Step 1: 切分支并提交设计文档**：`git checkout -b feat/android`；`git add docs/superpowers/specs/2026-11-08-android-port-design.md docs/superpowers/plans/2026-11-08-android-port.md && git commit -m "docs(android): approved design + implementation plan"`。
- [ ] **Step 2: app.json 加 android 块**（值即此，不留选择）：

```json
"android": {
  "package": "com.augustone.timescavenger",
  "versionCode": 1,
  "adaptiveIcon": { "foregroundImage": "./assets/icon.png", "backgroundColor": "#0a0a0f" },
  "permissions": ["android.permission.READ_MEDIA_IMAGES", "android.permission.READ_MEDIA_VIDEO"]
}
```

- [ ] **Step 3: `npx expo prebuild --platform android --no-install`**，然后 `grep -c READ_MEDIA app/android/app/src/main/AndroidManifest.xml` ≥ 2（expo-media-library 自带 manifest 合并 + 上面显式声明）。
- [ ] **Step 4: `npx expo run:android`**（Metro 起 + gradle 构建 + adb install 到 emulator-5554 + 启动）。若 AGP 报缺 compileSdk 36 → Task 0 Step 6 的 sdkmanager 兜底后重跑。
- [ ] **Step 5: 模拟器验收**：出现「拾光」图标，点开进入 onboarding 屏无红屏（JS 报错零容忍；权限弹窗出现属正常）。
- [ ] **Step 6: Commit** `feat(android): branch scaffold — app.json android block, prebuild, first device launch`

### Task 2: mediaUri 纯函数 + Android 元数据形状 spike

**Files:**
- Create: `app/src/lib/mediaUri.ts`
- Test: `app/src/lib/__tests__/mediaUri.test.ts`

**Interfaces:**
- Produces:
  - `toDisplayUri(id: string, mediaType: string, os?: 'ios' | 'android'): string`（`os` 默认 `Platform.OS`，测试显式传入）— iOS 原样返回；Android 把裸数字 id 拼 `content://media/external/{images|video}/media/{id}`（`mediaType === 'video'` → video，其余 → images），已是 `content://` 的原样返回。
- Consumes: `MediaRow.mediaType`（db/repo）。

- [ ] **Step 1: 写失败测试**

```ts
import { toDisplayUri } from '../mediaUri';
describe('mediaUri', () => {
  it('passes iOS ids through unchanged', () => {
    expect(toDisplayUri('ph://ABC', 'photo', 'ios')).toBe('ph://ABC');
  });
  it('builds content uri for android video', () => {
    expect(toDisplayUri('123', 'video', 'android')).toBe('content://media/external/video/media/123');
  });
  it('maps every non-video mediaType to images', () => {
    expect(toDisplayUri('9', 'screenshot', 'android')).toBe('content://media/external/images/media/9');
    expect(toDisplayUri('9', 'live', 'android')).toBe('content://media/external/images/media/9');
  });
  it('passes existing content uris through on android', () => {
    expect(toDisplayUri('content://media/x', 'photo', 'android')).toBe('content://media/x');
  });
});
```

- [ ] **Step 2: `npx jest mediaUri` 确认失败**（Cannot find module）
- [ ] **Step 3: 实现**（单文件 <20 行；`content://` 前缀判断内联，不另设导出）
- [ ] **Step 4: `npx jest --silent` 全绿（87+）**
- [ ] **Step 5: 模拟器 spike**：`spike.tsx` 临时加一个按钮，对 Task 0 注入的测试图/视频打印 `id`、`new Asset(id).getUri()`、`mediaSubtypes` 到界面文本；`adb install` 后模拟器上看（或 `adb logcat` 读 console.log），把结论记入台账（决定 Task 3 的 `new Asset(id)` 能否直接用数字 id、classify 是否降级）。若 Android 上 `new Asset(数字id)` 抛错，记录实际接受的参数形态（如 `content://` URI），回本任务调整接口再进 Task 3。
- [ ] **Step 6: 移除 spike 临时代码，Commit** `feat(android): mediaUri display-URI adapter with android metadata spike logged`

### Task 3: URI 消费点接线 + iOS 独占原生路径守卫

**Files:**
- Modify: `app/src/app/(tabs)/(photos)/index.tsx:102-117`（3 处 `Image uri`）
- Modify: `app/src/app/pending.tsx:88`、`app/src/app/back-to-day.tsx:135`、`app/src/app/photo-info.tsx:68`
- Modify: `app/src/app/review.tsx:64,159`（deck `uri` 字段）
- Modify: `app/src/components/VideoCell.tsx:51-56`（iCloud 守卫 + `replaceAsync` 源）
- Modify: `app/src/app/(tabs)/(videos)/index.tsx:280-282`（分享）
- Modify: `app/src/app/day-preview.tsx:62-70,104`（分享 + 静态图 uri）
- Modify: `app/src/components/CardStack.tsx:12,138-149`、`app/src/app/day-preview.tsx:7,91-101`（LivePhotoView 惰性导入）

**Interfaces:**
- Consumes: `toDisplayUri`（Task 2）。
- Produces: 无新导出；行为面 = Android 全部图片/视频渲染走 `content://`，iOS 路径逐字不变。

- [ ] **Step 1: 所有 `source={{ uri: <id> }}` 改为 `source={{ uri: toDisplayUri(<id>, <mediaType>) }}`**（`<mediaType>` 取该行 `MediaRow.mediaType`；review.tsx 的 `createDeck` 映射里 `uri:` 同样包）。
- [ ] **Step 2: VideoCell 守卫**：`const isInCloud = Platform.OS === 'ios' ? await new Asset(row.localIdentifier).getIsInCloud() : false;`；装载改 `player.replaceAsync(toDisplayUri(row.localIdentifier, row.mediaType, Platform.OS))`。iCloud 占位文案分支仅 iOS 可达（`cloud` 恒 false 于 Android）。
- [ ] **Step 3: LivePhotoView 惰性化**（两文件同法）：删顶层 `import { LivePhotoView }`，改 `import type { LivePhotoViewType } from 'expo-live-photo'` + `const LivePhotoView = Platform.OS === 'ios' ? require('expo-live-photo').LivePhotoView : null;`，渲染条件 `!!liveSource` 改 `!!liveSource && !!LivePhotoView`。Android 实况照片显示为静态图（`getLiveSource` 原生抛错已被 try/catch 归 null）。
- [ ] **Step 4: 分享**：`(videos)/index.tsx` 与 `day-preview.tsx` 的 doShare 改为 `const uri = toDisplayUri(id, mediaType, Platform.OS)`，两平台统一 `Share.share({ url: uri })`（Android 分享 content URI；day-preview 保留 `getUri()` 取真实文件 URI 优先）。
- [ ] **Step 5: 验证链**：tsc + jest 全绿；Metro 起时 Android bundle 200；模拟器走查照片 tab、review 卡片、视频 feed、pending 缩略图全部出图（测试集 = Task 0 注入媒体）。
- [ ] **Step 6: Commit** `feat(android): wire content:// display URIs, guard iCloud/LivePhoto, share via content uri`

### Task 4: photo-info 地图降级（Android 不渲染 MapView）

**Files:**
- Modify: `app/src/app/photo-info.tsx:142-151`（MapView 块）、`:175`（跳相册按钮）

**Interfaces:**
- Consumes: `getAssetLocation`（assets.ts，Android 返回 null 已安全）。
- Produces: Android 显示经纬度文本 + 「在地图中打开」按钮（`Linking.openURL('geo:<lat>,<lon>')` 调起系统地图）；iOS 原 MapView 不变。

- [ ] **Step 1: 把 `<MapView>…</MapView>` 块包进 `Platform.OS === 'ios' ? (...) : (<View>…降级 UI…</View>)`**；降级 UI = 坐标 `Text`（`lat.toFixed(4), lon.toFixed(4)`）+ TouchableOpacity 调 `Linking.openURL(\`geo:${lat},${lon}\`)`。顶层 `import MapView` 保留（react-native-maps 有 Android 原生实现，导入不崩；模拟器确认，若崩则同样惰性化）。
- [ ] **Step 2: `photos-redirect://` 按钮**（:175）Android 分支改 `Linking.openURL('content://media/')` 失败则 toast「Android 暂不支持跳转相册」——一行三元，不做更多。
- [ ] **Step 3: 验证链 + 模拟器走查 photo-info**（有 EXIF 位置的照片显示降级 UI，geo: intent 不崩即可——模拟器无高德，调起 Google 地图或无响应均属预期）。
- [ ] **Step 4: Commit** `feat(android): photo-info map degrades to coords + geo intent`

### Task 5: 删除链路 Android 化（MediaStore 确认弹窗 + 取消归类）

**Files:**
- Modify: `app/src/lib/deletion.ts`（新增纯函数 `classifyDeleteError`；`nativeDeps.deleteAssets` 改用它）
- Test: `app/src/lib/__tests__/deletion.test.ts`（追加用例）

**Interfaces:**
- Produces: `classifyDeleteError(msg: string): 'cancelled' | 'failed'`。
- Consumes: 既有 `commitPending`/`PendingQueue` 语义不变。

- [ ] **Step 1: 追加失败测试**

```ts
import { classifyDeleteError } from '../deletion';
describe('classifyDeleteError', () => {
  it('classifies iOS cancel', () => { expect(classifyDeleteError('PHAsset deletion was canceled')).toBe('cancelled'); });
  it('classifies Android MediaStore denial', () => { expect(classifyDeleteError('User did not grant permission for the delete request')).toBe('cancelled'); });
  it('keeps unknown errors as failed', () => { expect(classifyDeleteError('EACCES')).toBe('failed'); });
});
```

- [ ] **Step 2: 跑测试确认失败** → **Step 3: 实现**（`/cancel|did not grant|denied/i` 归 cancelled）并替换 `nativeDeps` 里内联正则 → **Step 4: jest 全绿（91+）**
- [ ] **Step 5: 模拟器验证**：pending 页勾选删除 → 系统「删除文件」确认弹窗出现（MediaStore createDeleteRequest 行为，与回收站设计契合；AOSP 弹窗文案记入台账供真机 flow 校准）→ 分别走「确认删除」（media 行消失、deletions 记录写入、`measureSize` 对 content:// 返回 >0）与「取消」（toast 已取消删除、队列保留）。发现问题回改。
- [ ] **Step 6: Commit** `feat(android): delete-error classifier covers MediaStore denial dialog`

### Task 6: testID 铺设（Maestro 选择器基础）

**Files:**
- Modify: `app/src/app/(tabs)/_layout.tsx`（tab 胶囊）、`(photos)/index.tsx`、`(videos)/index.tsx`（♡/🗑/↩/进度条轨道）、`review.tsx`（卡片手势区/按钮）、`pending.tsx`（提交删除钮）、`onboarding.tsx`（授权/开始导入钮）、`settings.tsx`（重置入口）

**Interfaces:**
- Produces: 固定 testID 命名表（flow 与代码的唯一契约）：`tab_photos`、`tab_videos`、`tab_stats`、`video_like`、`video_delete`、`video_undo`、`feed_scroll`、`review_card`、`review_like`、`review_delete`、`pending_submit`、`onboard_grant`、`onboard_import`、`settings_reset`。
- Consumes: 无。

- [ ] **Step 1: 按命名表逐屏加 `testID` prop**（纯属性添加，零行为变化）。
- [ ] **Step 2: 验证链**（tsc+jest 全绿即可，无需真机）。
- [ ] **Step 3: Commit** `test(android-ready): stable testIDs for maestro selectors`

### Task 7: Maestro flow + Ralph 循环脚本

**Files:**
- Create: `app/maestro/01_smoke.yaml`、`app/maestro/02_video_feed.yaml`、`app/maestro/03_delete_flow.yaml`
- Create: `app/scripts/ralph-android.sh`

**Interfaces:**
- Consumes: Task 6 testID 表；`com.augustone.timescavenger`。
- Produces: `./scripts/ralph-android.sh [flow.yaml]` = 一条命令跑完「静态验证→重启加载→跑 flow→截图」。

- [ ] **Step 1: 写 `01_smoke.yaml`**：launchApp → `assertVisible: onboarding_grant 或 feed_scroll`（用 `optional` 双分支兼容首启/已导入态）。
- [ ] **Step 2: 写 `02_video_feed.yaml`**：`tapOn: tab_videos` → swipe up（`feed_scroll`）×2 → `tapOn: video_like` → `tapOn: video_delete` → 弹窗 `tapOn: text: ".*删除.*"` `optional: true` → `tapOn: video_undo` → screenshot。
- [ ] **Step 3: 写 `03_delete_flow.yaml`**：进 pending → `pending_submit` → 确认弹窗 → 断言空态文案出现。
- [ ] **Step 4: 写 `ralph-android.sh`**（要点即此，脚本 <30 行；所有 adb 命令统一 `-s ${ADB_SERIAL:-emulator-5554}`，真机接入后改环境变量即可切换）：`set -e`；`cd app && npx tsc --noEmit && npx jest --silent`；`curl` 探测 8081=200 否则报错退出（Review Focus #6）；`adb reverse tcp:8081 tcp:8081`；`adb shell pm grant com.augustone.timescavenger android.permission.READ_MEDIA_IMAGES`（+VIDEO）；`adb shell am force-stop` + `am start -n com.augustone.timescavenger/.MainActivity`；`sleep 10`；`maestro test $FLOW`；`adb exec-out screencap -p > ../screens/android-$(date +%H%M%S).png`。
- [ ] **Step 5: 跑一轮完整循环**：`./scripts/ralph-android.sh maestro/02_video_feed.yaml` 通过，截图 agent 可读。
- [ ] **Step 6: Commit** `feat(android): maestro flows + ralph loop script`

### Task 8: 模拟器全屏回归 + 真机抽查 + 台账收尾

- [ ] **Step 1:** 模拟器逐屏 screencap 验收：onboarding（授权+导入进度）、照片 tab、review 卡片（含长按实况→静态图降级确认）、视频 feed（滑动定格起播、nativeControls 系统播放器观感记录）、stats、settings、pending、day-preview、back-to-day、photo-info（降级地图）。
- [ ] **Step 2:** 问题回对应 Task 修复迭代；全过后写台账 `.superpowers/sdd/2026-11-08-android-port/progress.md`：Android metadata spike 结论、classify 降级裁决、nativeControls 观感、AOSP 删除弹窗文案、提交链。
- [ ] **Step 3: 真机抽查（需用户 USB 接入一加 15T，可延后）**：`ADB_SERIAL=<序列号> ./scripts/ralph-android.sh` 跑 02/03 flow，重点核对 ColorOS 删除弹窗文案与 `classifyDeleteError` 匹配、expo-video 系统播放器观感、真实相册导入性能；结论补录台账。
- [ ] **Step 4: Commit**（仅代码修复需提交；台账 gitignore）
