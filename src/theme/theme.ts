import { Preferences } from '@capacitor/preferences'

const THEME_KEY = 'themePref'

export type ThemePref = 'auto' | 'light' | 'dark'

export async function getStoredThemePref(): Promise<ThemePref> {
  const { value } = await Preferences.get({ key: THEME_KEY })
  return value === 'light' || value === 'dark' ? value : 'auto'
}

export async function setStoredThemePref(pref: ThemePref): Promise<void> {
  await Preferences.set({ key: THEME_KEY, value: pref })
}
