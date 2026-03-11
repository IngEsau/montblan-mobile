import { StyleSheet, Text, View } from 'react-native';
import { palette } from '../theme/palette';

type StatusTone = 'primary' | 'warning' | 'danger' | 'success' | 'default';

type StatusBadgeProps = {
  label: string;
  tone?: StatusTone;
};

const toneStyles: Record<StatusTone, { bg: string; text: string }> = {
  primary: { bg: '#d8f3ee', text: palette.primaryDark },
  warning: { bg: '#fff1de', text: '#a15f1a' },
  danger: { bg: '#ffe1e6', text: '#9a3040' },
  success: { bg: '#daf7f7', text: '#107a7b' },
  default: { bg: '#e9eef3', text: '#44515f' },
};

export function StatusBadge({ label, tone = 'default' }: StatusBadgeProps) {
  const currentTone = toneStyles[tone];

  return (
    <View style={[styles.badge, { backgroundColor: currentTone.bg }]}> 
      <Text style={[styles.label, { color: currentTone.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
