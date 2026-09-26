import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useCredentials } from '@/features/credentials';
import { goBack } from '@/lib/navigation';
import { Button, Screen, colors } from '@/ui';

/** Список профилей: выбор активного, переход к редактированию, добавление. */
export default function ProfilesScreen() {
  const { profiles, active, setActive } = useCredentials();

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Профили</Text>
        <Text style={styles.note}>Отметьте профиль, под которым входить. Вход выполняется только под ним.</Text>

        {profiles.length === 0 && <Text style={styles.empty}>Профилей пока нет.</Text>}

        {profiles.map((p) => {
          const selected = p.id === active?.id;
          return (
            <View key={p.id} style={[styles.row, selected && styles.rowSelected]}>
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => void setActive(p.id)}
                style={styles.rowMain}
              >
                <Text style={[styles.radio, selected && { color: colors.primary }]}>{selected ? '◉' : '○'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{p.name}</Text>
                  <Text style={styles.login} numberOfLines={1}>
                    {p.login}
                  </Text>
                </View>
              </Pressable>
              <Pressable
                onPress={() => router.push({ pathname: '/profile', params: { id: p.id } })}
                hitSlop={10}
                style={styles.edit}
              >
                <Text style={styles.editText}>Изменить</Text>
              </Pressable>
            </View>
          );
        })}

        <Button title="+ Добавить профиль" onPress={() => router.push('/profile')} style={{ marginTop: 12 }} />
        <Button title="Назад" variant="secondary" onPress={() => goBack()} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, gap: 10, backgroundColor: colors.bg },
  title: { fontSize: 22, fontWeight: '700', color: colors.text, marginTop: 12 },
  note: { fontSize: 13, color: colors.muted, marginBottom: 8 },
  empty: { fontSize: 15, color: colors.muted, textAlign: 'center', marginVertical: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 10,
    paddingRight: 12,
  },
  rowSelected: { borderColor: colors.primary, backgroundColor: colors.infoBg },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  radio: { fontSize: 20, color: colors.muted },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  login: { fontSize: 13, color: colors.muted },
  edit: { paddingVertical: 6, paddingHorizontal: 4 },
  editText: { fontSize: 15, fontWeight: '600', color: colors.primary },
});
