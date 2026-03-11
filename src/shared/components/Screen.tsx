import { ReactNode } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, View } from 'react-native';
import { palette } from '../theme/palette';

type ScreenProps = {
  children: ReactNode;
};

export function Screen({ children }: ScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <View style={styles.content}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.navy,
  },
  content: {
    flex: 1,
    backgroundColor: palette.background,
  },
});
