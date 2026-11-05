import { renderRouter, screen } from 'expo-router/testing-library';

import * as storage from '@/lib/tokenStorage';

import RootLayout from '../_layout';
import TabsLayout from '../(tabs)/_layout';
import History from '../(tabs)/history';
import Today from '../(tabs)/index';
import Profile from '../(tabs)/profile';
import NotFound from '../+not-found';
import AuthLayout from './_layout';
import SignIn from './sign-in';

jest.mock('@/lib/tokenStorage');
const mocked = jest.mocked(storage);

const routes = {
  _layout: RootLayout,
  '+not-found': NotFound,
  '(auth)/_layout': AuthLayout,
  '(auth)/sign-in': SignIn,
  '(tabs)/_layout': TabsLayout,
  '(tabs)/index': Today,
  '(tabs)/history': History,
  '(tabs)/profile': Profile,
};

describe('root navigator', () => {
  it('shows sign-in and no tab bar when signed out', async () => {
    mocked.getTokens.mockResolvedValue(null);
    await renderRouter(routes, { initialUrl: '/sign-in' });
    expect(await screen.findByText('Sign in')).toBeTruthy();
    expect(screen.queryByText('History')).toBeNull();
  });

  it('lands on sign-in when signed out and opened at /', async () => {
    mocked.getTokens.mockResolvedValue(null);
    await renderRouter(routes, { initialUrl: '/' });
    expect(await screen.findByText('Sign in')).toBeTruthy();
  });

  it('shows the tabs when signed in', async () => {
    mocked.getTokens.mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });
    await renderRouter(routes, { initialUrl: '/' });
    expect(await screen.findByText('History')).toBeTruthy();
    expect(screen.queryByText('Sign in')).toBeNull();
  });
});
