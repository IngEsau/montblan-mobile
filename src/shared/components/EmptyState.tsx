import { StyleSheet, Text, View } from 'react-native';
import { palette } from '../theme/palette';

type EmptyStateProps = {
  title: string;
  subtitle?: string;
};

export function EmptyState({ title, subtitle }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 32,
    padding: 20,
    borderRadius: 14,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
  },
  title: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 6,
    color: palette.mutedText,
    fontSize: 14,
    lineHeight: 20,
  },
});
