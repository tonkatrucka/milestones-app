import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Keeps a JS render/import error on screen instead of killing the process
 * back to the splash logo.
 */
export class LaunchErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[LaunchErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>Milestones hit a launch error</Text>
        <Text style={styles.body}>
          The app stayed open so this can be reported. Restart after updating, or reinstall a
          new store build if this persists.
        </Text>
        <ScrollView style={styles.scroll}>
          <Text style={styles.stack}>{this.state.error.message}</Text>
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#F0EBE3',
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2c2825',
    marginBottom: 12,
  },
  body: {
    fontSize: 16,
    lineHeight: 22,
    color: '#5c554d',
    marginBottom: 16,
  },
  scroll: { maxHeight: 220 },
  stack: { fontSize: 13, color: '#7a5348', fontFamily: 'monospace' },
});
