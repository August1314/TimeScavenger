# 视频页跟手 Feed 改造 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 视频 tab 改为 FlatList 垂直分页跟手 feed（相邻视频预载、同屏双播），进度条移至 tab 胶囊上方并支持点按/拖动 seek。

**Architecture:** `VideoCell`（每格独立 `useVideoPlayer`，ph:// 源，active 控制播停）+ `(videos)/index.tsx` Feed 壳（FlatList + 覆盖层 + 吸附定格驱动 markSeen/续组追加）。纯计算（吸附下标、seek 比例）下沉 `lib/videoFeed.ts` 可单测。

**Tech Stack:** expo-video、RN FlatList、react-native-gesture-handler（仅长按 2x）、expo-media-library（守卫）。

**Spec:** [docs/superpowers/specs/2026-11-07-video-feed-design.md](../specs/2026-11-07-video-feed-design.md)

## Global Constraints

- 仅 Expo Go 内置模块：expo-video / expo-media-library / RN 核心；**禁止**新增含原生代码依赖（FlashList 等）。
- 视频源 URI = `row.localIdentifier`（DB 存的即 `ph://…`）；`new Asset(id)`/`getIsInCloud` 用**剥掉 `ph://` 前缀**的原始 id。
- RN 0.88：视口尺寸只允许 `useWindowDimensions()`，禁止模块顶层 `Dimensions.get`；worklet 调 JS 用 `runOnJS`。
- expo-video：PHAsset URI 只能经构造函数或 `player.replaceAsync` 装载（同步 `replace` 抛错）。
- 每任务收尾验证链：`cd app && npx tsc --noEmit && npx jest --silent`（67+ 全绿）+ `curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:8081/node_modules/expo-router/entry.bundle?platform=ios&dev=true"` = 200。
- 装包一律 `npm install <pkg>@<ver> --legacy-peer-deps`（本计划不应装包）。
- expo-router hooks 必须位于任何早期 return 之前。

## Review Focus

- 快速连滑且续组请求在途：定格下标不越界、markSeen 不重复、append 后列表不跳位。
- 组内混有 iCloud 云端视频：该格显示占位文案，不阻塞其它格播放与滚动。
- 进度条拖到 0/1 端点：seek 比例钳制 [0,1)，播放继续不黑屏；拖动中轮询不覆盖拖动位置。
- 慢速滑动 vs 长按 2x：手指移动 >12pt 归列表滚动；按住不动 >350ms 才 2x。
- 离开视频 tab 再回来：feed 重新拉组，不重复标记上一条已读。

---

### Task 1: videoFeed 纯函数库

**Files:**
- Create: `app/src/lib/videoFeed.ts`
- Test: `app/src/lib/__tests__/videoFeed.test.ts`

**Interfaces:**
- Produces:
  - `snapIndex(offsetY: number, viewportHeight: number): number` — 四舍五入到最近页，负值钳 0。
  - `seekRatio(clientX: number, trackLeft: number, trackWidth: number): number` — 钳制到 [0, 0.999]。
  - `rawId(localIdentifier: string): string` — 剥 `ph://` 前缀。

- [ ] **Step 1: 写失败测试**

```ts
import { snapIndex, seekRatio, rawId } from '../videoFeed';
describe('videoFeed', () => {
  it('snapIndex rounds to nearest page and clamps negatives', () => {
    expect(snapIndex(812, 812)).toBe(1);
    expect(snapIndex(300, 812)).toBe(0);
    expect(snapIndex(-50, 812)).toBe(0);
  });
  it('seekRatio clamps to [0, 0.999]', () => {
    expect(seekRatio(50, 0, 200)).toBeCloseTo(0.25);
    expect(seekRatio(-10, 0, 200)).toBe(0);
    expect(seekRatio(999, 0, 200)).toBe(0.999);
  });
  it('rawId strips ph:// prefix only', () => {
    expect(rawId('ph://ABC/001')).toBe('ABC/001');
    expect(rawId('ABC/001')).toBe('ABC/001');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**（`npx jest videoFeed` → Cannot find module）
- [ ] **Step 3: 实现三个函数**（单文件 <30 行，Math.round/Math.min/Math.max）
- [ ] **Step 4: 跑测试通过** → 全量 `npx jest --silent` 67+ 绿
- [ ] **Step 5: Commit** `feat(videos): videoFeed pure helpers (snapIndex/seekRatio/rawId)`

### Task 2: VideoCell 组件

**Files:**
- Create: `app/src/components/VideoCell.tsx`
- 无独立单测（组件级由 tsc+bundle+真机覆盖）；`rawId` 复用 Task 1。

**Interfaces:**
- Consumes: `MediaRow`（db/repo）、`rawId`。
- Produces: `<VideoCell row={MediaRow} active={boolean} onError={(msg: string) => void} onTick={(t: number, d: number) => void} ref={cellRef} />` — 全出血 `VideoView`，`useVideoPlayer(row.localIdentifier, p => { p.loop = true; })`；`active` 变 true→`play()`，false→`pause()`+`playbackRate=1`；`statusChange` error 上报 `onError`；`onTick` 内部 400ms 轮询上报 `currentTime/duration`；`new Asset(rawId(row.localIdentifier)).getIsInCloud()` 为 true 时渲染占位「该视频存储在 iCloud 云端，无法本地播放」且不装载。
- Ref 句柄（`forwardRef`+`useImperativeHandle`）：`{ seekTo(ratio: number): void; setRate(n: number): void }` — `seekTo` 内部 `player.currentTime = ratio * player.duration`；`setRate` 供长按 2x。

- [ ] **Step 1: 实现 VideoCell**（要点：ph:// 直接作构造源；`shouldPlay` 不用，播停全由 active 驱动，避免回收误播）
- [ ] **Step 2: tsc + bundle 200**
- [ ] **Step 3: Commit** `feat(videos): VideoCell with per-item player, active-driven play/pause, iCloud guard`

### Task 3: Feed 壳重写（列表 + 覆盖层 + 进度条 seek + 续组）

**Files:**
- Modify: `app/src/app/(tabs)/(videos)/index.tsx`（整页重写，保留 ♡↑↩、时间地点、toast、2x 徽章语义）

**Interfaces:**
- Consumes: `VideoCell`（Task 2）、`snapIndex/seekRatio/rawId`（Task 1）、`nextGroup/markSeen`（session）、`pendingQueue`、`setFavoriteSafe`、`placeParts/getAssetLocation`、`formatTime`、haptics。
- Produces: 默认导出 `VideosHome`。

结构决定（实现按此，不留选择题）：
- `FlatList`：`pagingEnabled` + `snapToInterval={vh}` + `decelerationRate="fast"` + `showsVerticalScrollIndicator={false}` + `windowSize={3}`；`renderItem` → `VideoCell active={index===current}`；`keyExtractor=localIdentifier`；每格 `style={{width: vw, height: vh}}`。
- 数据：`rows` 初始 `nextGroup('video')`；`onMomentumScrollEnd` → `cur = snapIndex(y, vh)`；`cur` 变化时对离开的行 `markSeen`；`cur >= rows.length - 1` 时**追加**下一组：`nextGroup` 结果 `setRows(r => [...r, ...g.items])`（空结果不追加；追加期间用 `loadingMoreRef` 防并发，Review Focus #1）。
- 覆盖层（列表外 absolute）：右侧 ♡↑🗑↩ 竖排（逻辑沿用旧版，目标行 = `rows[current]`）；左下时间+位置（沿用旧版异步解析，`current` 变化时刷新）；toast 位置不变。
- 进度条：轨道 `bottom: 82`（胶囊顶 12+62 之上留 8），左右 18，高 3；填充宽 = `VideoCell.onTick` 上报的 `t/d`（Feed 存 state；拖动中本地预览位置覆盖 tick）。点按+拖动 seek：`PanResponder` 在轨道上，`onGrant/onMove` 用 `seekRatio` 更新预览位置，`onRelease` 调 `cellRef.current?.seekTo(ratio)`。
- 长按 2x：Feed 容器 `Gesture.LongPress().minDuration(350).maxDistance(12)`，触发时经 `cellRef.current?.setRate(2)`，`onFinalize` 恢复 1；徽章文案「2x 速率播放中」保留。若真机与列表滚动冲突（Review Focus #4）→ 降级：右侧竖排加 2x 切换小钮，删长按手势。
- 重进语义（Review Focus #5）：Feed 每次挂载重新 `nextGroup('video')`，`current` 初始 0 且**不触发** markSeen——markSeen 只在 `onMomentumScrollEnd` 引起的下标变化时对离开行执行一次。
- 空态：`rows.length === 0` → 「视频已全部回顾\n可在设置中重置再来一轮」。
- 删除：`pendingQueue.push` + `markSeen` + toast + 定格前进（列表不删行，保持下标稳定）。

- [ ] **Step 1: 重写 index.tsx**（hooks 全在早期 return 前；旧版手势切换/replaceAsync 单播放器路径整体移除）
- [ ] **Step 2: tsc + jest + bundle 200**
- [ ] **Step 3: Commit** `feat(videos): FlatList paged feed with prefetched cells, seekable progress bar above tab capsule, group append`

### Task 4: 真机验收 + 台账

- [ ] **Step 1:** 隧道 Metro 下用户设备 Reload，按 Spec「验收」段逐项走查（连滑 3+ 无黑屏等待、双画面同播、进度条点/拖、2x、收藏/删除/撤回、组尾续流、iCloud 占位）
- [ ] **Step 2:** 发现问题回 Task 3 修复迭代；全过后 progress.md 台账记录裁决与提交链
- [ ] **Step 3: Commit**（台账为本地 gitignore，仅代码修复需提交）
