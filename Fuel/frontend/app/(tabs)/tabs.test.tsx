import { renderRouter, screen, within } from 'expo-router/testing-library';

import TabsLayout from './_layout';
import History from './history';

describe('tab bar', () => {
  it('shows exactly Today, History, Profile in order with Today selected', async () => {
    await renderRouter({
      '(tabs)/_layout': TabsLayout,
      '(tabs)/index': () => null, // the real screen has its own buttons and needs a query client
      '(tabs)/history': History,
      '(tabs)/profile': () => null,
    });
    const tabs = await screen.findAllByRole('button');
    expect(tabs).toHaveLength(3);
    expect(tabs.map((t) => within(t).getByText(/Today|History|Profile/).props.children)).toEqual([
      'Today',
      'History',
      'Profile',
    ]);
    expect(tabs[0]).toBeSelected();
  });
});
