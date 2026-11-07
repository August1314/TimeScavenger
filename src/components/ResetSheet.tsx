import { useReducer } from 'react';
import { Text, View, StyleSheet, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { resetReviewed, type ResetScope } from '../db/repo';
import { SCOPE_LABELS, resetConfirmText, nextResetState, type ResetFlowState, type ResetFlowEvent } from '../lib/resetFlow';
import { C } from '../theme/colors';

const SCOPES: ResetScope[] = ['all', 'photos', 'photosNoScreenshots', 'screenshots', 'videos'];

function reducer(s: ResetFlowState, e: ResetFlowEvent): ResetFlowState {
  return nextResetState(s, e);
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function ResetSheet({ visible, onClose }: Props) {
  const [st, dispatch] = useReducer(reducer, { phase: 'idle' });

  const doReset = async (scope: ResetScope) => {
    dispatch({ type: 'confirm' });
    await resetReviewed(scope);
    dispatch({ type: 'done' });
  };

  const close = () => {
    dispatch({ type: 'close' });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={close}>
        <View style={styles.sheet}>
          <Text style={styles.title}>重置浏览记录</Text>
          {SCOPES.map((scope) => {
            const picked = 'scope' in st && st.scope === scope;
            return (
              <TouchableOpacity
                key={scope}
                style={styles.row}
                disabled={st.phase === 'busy'}
                onPress={() => {
                  if (picked && st.phase === 'picked') {
                    void doReset(scope);
                  } else {
                    dispatch({ type: 'pick', scope });
                  }
                }}
              >
                <Text style={[styles.rowText, picked && styles.rowPicked]}>{SCOPE_LABELS[scope]}</Text>
                {picked && st.phase !== 'busy' && <Text style={styles.dot}>●</Text>}
              </TouchableOpacity>
            );
          })}
          {'scope' in st && st.phase !== 'done' && (
            <Text style={styles.confirm}>{resetConfirmText(st.scope)}</Text>
          )}
          {st.phase === 'busy' && <ActivityIndicator color="#fff" style={{ marginVertical: 10 }} />}
          {st.phase === 'done' && <Text style={styles.doneText}>已重置，这些项目会重新出现在浏览过程中。</Text>}
          <TouchableOpacity style={styles.closeBtn} onPress={close}>
            <Text style={styles.closeText}>{st.phase === 'done' ? '完成' : '取消'}</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#23232C', borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40 },
  title: { color: '#fff', fontSize: 19, fontWeight: '800', textAlign: 'center', marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 50, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' },
  rowText: { color: '#fff', fontSize: 16 },
  rowPicked: { color: C.accent, fontWeight: '700' },
  dot: { color: C.accent, fontSize: 12 },
  confirm: { color: 'rgba(255,255,255,0.55)', fontSize: 13, lineHeight: 19, marginTop: 14 },
  doneText: { color: C.ok, fontSize: 14, textAlign: 'center', marginTop: 14 },
  closeBtn: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 26, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  closeText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
