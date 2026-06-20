import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const ROWS = [
  ['7', '8', '9'],
  ['4', '5', '6'],
  ['1', '2', '3'],
  ['.', '0', '⌫'],
] as const;

type Props = { onKey: (key: string) => void };

export default function Keypad({ onKey }: Props) {
  return (
    <View style={styles.grid}>
      {ROWS.map((row, ri) => (
        <View key={ri} style={styles.row}>
          {row.map(key => (
            <TouchableOpacity
              key={key}
              style={styles.key}
              activeOpacity={0.5}
              onPress={() => onKey(key)}
            >
              <Text style={styles.label}>{key}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid:  { flex: 1, padding: 4, direction: 'ltr' },
  row:   { flex: 1, flexDirection: 'row' },
  key:   {
    flex: 1,
    margin: 3,
    borderRadius: 12,
    backgroundColor: '#f2f2f7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: { fontSize: 26, fontWeight: '500', color: '#1c1c1e' },
});
