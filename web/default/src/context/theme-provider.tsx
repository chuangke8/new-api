/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import i18next from 'i18next'
import { toast } from 'sonner'
import { useSystemConfigStore } from '@/stores/system-config-store'
import { useIsAdmin } from '@/hooks/use-admin'
import { getCookie, setCookie, removeCookie } from '@/lib/cookies'
import {
  DEFAULT_THEME_DEFAULTS,
  type ThemeMode,
} from '@/lib/theme-customization'
import { updateSystemOption } from '@/features/system-settings/api'

type Theme = ThemeMode
type ResolvedTheme = Exclude<Theme, 'system'>

const DEFAULT_THEME = DEFAULT_THEME_DEFAULTS.mode
const THEME_COOKIE_NAME = 'vite-ui-theme'
const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year
const THEMES = new Set<Theme>(['dark', 'light', 'system'])

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

type ThemeProviderState = {
  defaultTheme: Theme
  resolvedTheme: ResolvedTheme
  theme: Theme
  setTheme: (theme: Theme) => void
  resetTheme: () => void
}

const initialState: ThemeProviderState = {
  defaultTheme: DEFAULT_THEME,
  resolvedTheme: 'light',
  theme: DEFAULT_THEME,
  setTheme: () => null,
  resetTheme: () => null,
}

const ThemeContext = createContext<ThemeProviderState>(initialState)

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

function resolveTheme(theme: Theme): ResolvedTheme {
  return theme === 'system' ? getSystemTheme() : theme
}

function getStoredTheme(storageKey: string, fallback: Theme): Theme {
  const storedTheme = getCookie(storageKey) as Theme | undefined
  return storedTheme && THEMES.has(storedTheme) ? storedTheme : fallback
}

export function ThemeProvider({
  children,
  defaultTheme,
  storageKey = THEME_COOKIE_NAME,
  ...props
}: ThemeProviderProps) {
  const isAdmin = useIsAdmin()
  const queryClient = useQueryClient()
  const setConfig = useSystemConfigStore((state) => state.setConfig)
  const configuredDefaultTheme = useSystemConfigStore(
    (state) => state.config.themeDefaults.mode
  )
  const resolvedDefaultTheme = defaultTheme ?? configuredDefaultTheme
  const [theme, _setTheme] = useState<Theme>(() =>
    getStoredTheme(storageKey, resolvedDefaultTheme)
  )
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    resolveTheme(getStoredTheme(storageKey, resolvedDefaultTheme))
  )

  useEffect(() => {
    if (getCookie(storageKey)) return
    _setTheme(resolvedDefaultTheme)
  }, [resolvedDefaultTheme, storageKey])

  useEffect(() => {
    const root = window.document.documentElement
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const applyTheme = () => {
      const nextResolvedTheme = theme === 'system' ? getSystemTheme() : theme
      root.classList.remove('light', 'dark')
      root.classList.add(nextResolvedTheme)
      setResolvedTheme(nextResolvedTheme)
    }

    applyTheme()

    mediaQuery.addEventListener('change', applyTheme)

    return () => mediaQuery.removeEventListener('change', applyTheme)
  }, [theme])

  const setTheme = useCallback(
    (theme: Theme) => {
      if (isAdmin) {
        setCookie(storageKey, theme, THEME_COOKIE_MAX_AGE)
        setConfig({
          themeDefaults: {
            ...useSystemConfigStore.getState().config.themeDefaults,
            mode: theme,
          },
        })
        void updateSystemOption({ key: 'theme.mode', value: theme })
          .then((res) => {
            if (!res.success) {
              toast.error(res.message || i18next.t('Failed to update setting'))
            }
            queryClient.invalidateQueries({ queryKey: ['status'] })
            queryClient.invalidateQueries({ queryKey: ['system-options'] })
            window.localStorage.removeItem('status')
          })
          .catch((error: Error) => {
            toast.error(error.message || i18next.t('Failed to update setting'))
          })
      } else if (theme === resolvedDefaultTheme) {
        removeCookie(storageKey)
      } else {
        setCookie(storageKey, theme, THEME_COOKIE_MAX_AGE)
      }
      _setTheme(theme)
    },
    [isAdmin, queryClient, resolvedDefaultTheme, setConfig, storageKey]
  )

  const resetTheme = useCallback(() => {
    removeCookie(storageKey)
    _setTheme(resolvedDefaultTheme)
  }, [resolvedDefaultTheme, storageKey])

  const contextValue = useMemo(
    () => ({
      defaultTheme: resolvedDefaultTheme,
      resolvedTheme,
      resetTheme,
      theme,
      setTheme,
    }),
    [resolvedDefaultTheme, resolvedTheme, resetTheme, theme, setTheme]
  )

  return (
    <ThemeContext value={contextValue} {...props}>
      {children}
    </ThemeContext>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => {
  const context = useContext(ThemeContext)

  if (!context) throw new Error('useTheme must be used within a ThemeProvider')

  return context
}
