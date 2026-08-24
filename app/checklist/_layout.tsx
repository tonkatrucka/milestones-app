import { Stack } from 'expo-router';

export default function ChecklistLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
