import { Stack } from 'expo-router';

export default function GrowthLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="add" options={{ presentation: 'modal', title: 'Add measurement' }} />
    </Stack>
  );
}
