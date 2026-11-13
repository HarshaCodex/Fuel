import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { sizing, type, useTheme } from '@/theme';

type IconName = keyof typeof Ionicons.glyphMap;

const TABS: { name: string; title: string; filled: IconName; outline: IconName }[] = [
  { name: 'index', title: 'Today', filled: 'ellipse', outline: 'ellipse-outline' },
  { name: 'history', title: 'History', filled: 'bar-chart', outline: 'bar-chart-outline' },
  { name: 'profile', title: 'Profile', filled: 'person', outline: 'person-outline' },
];

export default function TabsLayout() {
  const { colors } = useTheme();
  const { bottom } = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accentText,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabel: ({ children, color }) => (
          <Text maxFontSizeMultiplier={1.3} numberOfLines={1} style={[type.caption, { color }]}>
            {children}
          </Text>
        ),
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.divider,
          borderTopWidth: 1,
          height: sizing.tabBar + bottom,
        },
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarIcon: ({ color, focused, size }) => (
              <Ionicons name={focused ? t.filled : t.outline} color={String(color)} size={size} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
