import { View, Text, StyleSheet } from 'react-native';

export default function AddExpenseScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Add Expense</Text>
      <Text style={styles.sub}>Phase 1 — coming next</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title:     { fontSize: 24, fontWeight: '600' },
  sub:       { marginTop: 8, color: '#888' },
});
