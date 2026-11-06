// TEMP SPIKE (Task 1/3/5 设备验证用，Task 15 前删除)
import { useState } from 'react';
import { Text, View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { ensurePhotoPermission, startImport } from '../lib/scan';
import { initDb, fetchUnreviewedRandom, getStats } from '../db/repo';
import { pendingQueue, commitPending, nativeDeps } from '../lib/deletion';

export default function SpikeScreen() {
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const say = (s: string) => setLog((l) => [...l, s]);

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (e: any) {
      say(`❌ ${String(e?.message ?? e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>去留复刻 · 设备验证</Text>
      <ScrollView style={{ flex: 1 }}>
        {log.map((l, i) => (
          <Text key={i} style={styles.line}>{l}</Text>
        ))}
      </ScrollView>
      <Btn label="1. 权限 + 建库 + 导入" onPress={() => run(async () => {
        const perm = await ensurePhotoPermission();
        say(`权限: ${perm}`);
        if (perm === 'denied') return;
        await initDb();
        say('SQLite 就绪');
        const t0 = Date.now();
        const res = await startImport((done, total) => {
          if (done === total || done % 2000 === 0) say(`导入 ${done}/${total}`);
        });
        say(`导入完成 ${res.imported} 条(跳过${res.skipped}) 用时 ${(Date.now() - t0) / 1000}s`);
        const left = await fetchUnreviewedRandom('photo', 3);
        say(`未读抽样: ${left.map((r) => r.mediaType).join(',')}`);
      })} busy={busy} />
      <Btn label="2. 删除 2 张截屏(回收站→系统确认)" onPress={() => run(async () => {
        const shots = await fetchUnreviewedRandom('screenshot', 2);
        if (shots.length === 0) { say('没有截屏可删'); return; }
        for (const s of shots) await pendingQueue.push(s);
        say(`待删: ${shots.map((s) => s.localIdentifier).join(' | ')}`);
        const res = await commitPending(shots.map((s) => s.localIdentifier), nativeDeps());
        say(`结果 deleted=${res.deleted.length} failed=${res.failed.length} ${res.failed[0]?.error ?? ''}`);
        const stats = await getStats();
        const shot = stats.find((s) => s.group === 'screenshots')!;
        say(`统计: 截屏删除 ${shot.deleted} 个 / 清理 ${shot.freedBytes} 字节`);
      })} busy={busy} />
      <Btn label="3. 测单张文件大小(ph://)" onPress={() => run(async () => {
        const one = (await fetchUnreviewedRandom('photo', 1))[0];
        if (!one) { say('无图'); return; }
        const t = Date.now();
        const size = await nativeDeps().measureSize(one.localIdentifier);
        say(`size=${size} 用时 ${((Date.now() - t) / 1000).toFixed(1)}s`);
      })} busy={busy} />
      <Btn label="4. EXIF 原始键值探查(校准信息页)" onPress={() => run(async () => {
        const { Asset } = require('expo-media-library');
        const one = (await fetchUnreviewedRandom('photo', 1))[0];
        if (!one) { say('无图'); return; }
        const exif = await new Asset(one.localIdentifier).getExif();
        say(`keys: ${Object.keys(exif ?? {}).join(', ')}`);
        say(JSON.stringify(exif).slice(0, 1200));
      })} busy={busy} />
      <Btn label="5. 实况配对视频探查" onPress={() => run(async () => {
        const { Asset, AssetField, MediaType, Query } = require('expo-media-library');
        const { File } = require('expo-file-system');
        const one = (await fetchUnreviewedRandom('live', 1))[0];
        if (!one) { say('库中没有实况照片'); return; }
        const a = new Asset(one.localIdentifier);
        const [uri, name] = await Promise.all([a.getUri(), a.getFilename()]);
        say(`实况: ${name} uri=${uri}`);
        try {
          const f = new File(uri);
          const dir = f.parent;
          if (dir) {
            const kids: string[] = [];
            for (const it of dir.list()) { kids.push((it as { name?: string }).name ?? '?'); if (kids.length >= 12) break; }
            say(`同目录: ${kids.join(', ')}`);
          } else { say('无 parent 目录'); }
        } catch (e) { say(`fs: ${String(e)}`); }
        const vids = await new Query().eq(AssetField.MEDIA_TYPE, MediaType.VIDEO).exeForMetadata();
        const s = String(name ?? '').split('.')[0];
        const hits = vids
          .filter((v: { filename?: string }) => String(v.filename ?? '').split('.')[0] === s)
          .map((v: { id: string; filename?: string; mediaSubtypes?: string[] }) => `${v.id} ${v.filename} [${(v.mediaSubtypes ?? []).join('|')}]`);
        say(`视频总数=${vids.length} 同stem匹配=${hits.length ? hits.join(' ; ') : '无'}`);
      })} busy={busy} />
      <Btn label="6. 配对MOV候选路径探测" onPress={() => run(async () => {
        const { Asset } = require('expo-media-library');
        const { File } = require('expo-file-system');
        const one = (await fetchUnreviewedRandom('live', 1))[0];
        if (!one) { say('库中没有实况照片'); return; }
        const a = new Asset(one.localIdentifier);
        const [uri, name] = await Promise.all([a.getUri(), a.getFilename()]);
        say(`uri=${uri} name=${name}`);
        const stem = String(name ?? '').split('.')[0];
        const album = (uri.match(/DCIM\/([^/]+)\//) ?? [])[1] ?? '';
        const base = uri.replace(/\/Adjustments\/[^/]+$/, '').replace(/\/[^/]*$/, '');
        const cands = [
          uri.replace(/\.jpg$/i, '.mov'),
          uri.replace(/\.jpg$/i, '.MOV'),
          `${base}/Adjustments/FullSizeRender.mov`,
          `${base}/${stem}.MOV`,
          `${base}/${stem}.mov`,
          `file:///var/mobile/Media/DCIM/${album}/${stem}.MOV`,
          `file:///var/mobile/Media/DCIM/${album}/${stem}.mov`,
          `file:///var/mobile/Media/PhotoData/Mutations/DCIM/${album}/${stem}/Adjustments/FullSizeRender.mov`,
        ];
        for (const c of cands) {
          try {
            const f = new File(c);
            const ex = f.exists();
            say(`${ex ? '✅' : '✗'} ${ex ? f.size + 'B' : '-'} ${c}`);
          } catch (e) { say(`❌ ${c} ${String(e).slice(0, 60)}`); }
        }
      })} busy={busy} />
    </View>
  );
}

function Btn({ label, onPress, busy }: { label: string; onPress: () => void; busy: boolean }) {
  return (
    <TouchableOpacity style={[styles.btn, busy && styles.btnOff]} onPress={onPress}>
      <Text style={styles.btnText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#151520', padding: 16 },
  title: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 8 },
  line: { color: '#9fd', fontSize: 13, marginVertical: 2 },
  btn: { backgroundColor: '#4C8DFF', borderRadius: 12, padding: 14, marginTop: 8 },
  btnOff: { opacity: 0.4 },
  btnText: { color: '#fff', textAlign: 'center', fontWeight: '600' },
});
