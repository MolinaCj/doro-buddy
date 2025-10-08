'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { UserSettings, UpdateSettingsRequest } from '@/types/api'
import { useAuth } from '@/hooks/useAuth'

interface SettingsContextType {
  settings: Partial<UserSettings> | null
  loading: boolean
  error: Error | null
  updateSettings: (updates: UpdateSettingsRequest) => Promise<UserSettings>
  refetch: () => Promise<void>
  syncSpotifyStatus: (isConnected: boolean) => Promise<void>
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [settings, setSettings] = useState<Partial<UserSettings> | null>(null)
  const [loading, setLoading] = useState(false) // Start as false - don't block UI
  const [error, setError] = useState<Error | null>(null)

  const supabase = createBrowserClient()

  // Default settings to use when API is unavailable
  const getDefaultSettings = (): Partial<UserSettings> => ({
    work_duration: 1500,
    short_break_duration: 300,
    long_break_duration: 900,
    sessions_until_long_break: 4,
    auto_start_breaks: false,
    auto_start_pomodoros: false,
    theme: 'system',
    notification_sound: 'ding',
    break_sound: 'gong',
    master_volume: 0.5,
    notification_volume: 0.5,
    music_volume: 0.5,
    ambient_volume: 0.3,
    spotify_enabled: false,
  })

  // Fetch user settings (completely non-blocking)
  const fetchSettings = async () => {
    if (!user) {
      setLoading(false)
      setSettings(null)
      return
    }

    // Check if we already have settings cached
    if (settings) {
      return
    }

    // Start with default settings immediately to prevent loading state
    const defaultSettings = getDefaultSettings()
    setSettings(defaultSettings)
    setLoading(false)

    // Then try to fetch real settings in the background with NO timeout
    setTimeout(async () => {
      try {
        // Check if user is properly authenticated by getting current session
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) {
          console.log('No valid session found, using default settings')
          return
        }

        // No timeout - let it take as long as it needs
        const response = await fetch('/api/settings')
        
        if (!response.ok) {
          if (response.status === 401) {
            console.log('User not authenticated, using default settings')
            return
          }
          console.log('Settings API error, using default settings')
          return
        }

        const data = await response.json()
        console.log('Settings fetched successfully:', data)
        setSettings(data)
        
      } catch (err) {
        console.log('Settings fetch failed, using default settings:', err instanceof Error ? err.message : 'Unknown error')
        // Don't set error - we already have default settings
      }
    }, 1000) // Small delay to ensure UI renders first
  }

  // Update settings
  const updateSettings = async (updates: UpdateSettingsRequest): Promise<UserSettings> => {
    if (!user) {
      throw new Error('User not authenticated')
    }

    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        throw new Error('Failed to update settings')
      }

      const updatedSettings = await response.json()
      console.log('Settings updated in SettingsProvider:', updatedSettings)
      
      // Force a new object reference to ensure React detects the change
      setSettings({ ...updatedSettings })
      return updatedSettings
    } catch (err) {
      console.error('Error updating settings:', err)
      throw err
    }
  }

  // Fetch settings when user changes
  useEffect(() => {
    // Don't fetch settings on confirmation page to avoid errors
    if (typeof window !== 'undefined' && window.location.pathname === '/auth/confirmed') {
      return
    }
    fetchSettings()
  }, [user])

  // Apply theme to document when settings.theme changes
  useEffect(() => {
    if (!settings) return
    const root = document.documentElement
    const themeId = settings.theme || 'default'
    
    // Remove all existing theme classes
    root.classList.remove('dark', 'theme-nature', 'theme-sunset', 'theme-ocean', 'theme-lavender')
    
    // Apply theme-specific classes
    if (themeId === 'dark') {
      root.classList.add('dark')
    } else if (themeId !== 'default') {
      root.classList.add(`theme-${themeId}`)
    }
    
    // Set data-theme attribute for CSS variable theming
    root.setAttribute('data-theme', themeId)
    
    // Apply theme colors as CSS custom properties
    const themeColors = {
      default: ['#3B82F6', '#EF4444', '#10B981'],
      dark: ['#1F2937', '#374151', '#4B5563'],
      nature: ['#059669', '#0D9488', '#047857'],
      sunset: ['#F59E0B', '#EF4444', '#DC2626'],
      ocean: ['#0EA5E9', '#0284C7', '#0369A1'],
      lavender: ['#8B5CF6', '#A855F7', '#9333EA']
    }
    
    const colors = themeColors[themeId as keyof typeof themeColors] || themeColors.default
    root.style.setProperty('--theme-primary', colors[0])
    root.style.setProperty('--theme-secondary', colors[1])
    root.style.setProperty('--theme-accent', colors[2])
    
    // Apply comprehensive theme variables with subtle theme colors
    const themeVariables = {
      default: {
        background: '#ffffff',
        foreground: '#171717',
        cardBg: '#f9fafb',
        cardBorder: '#e5e7eb',
        inputBg: '#ffffff',
        accentBg: '#f3f4f6'
      },
      dark: {
        background: '#0f0f0f',
        foreground: '#e5e5e5',
        cardBg: '#1a1a1a',
        cardBorder: '#404040',
        inputBg: '#262626',
        accentBg: '#1a1a1a'
      },
      nature: {
        background: '#f0f9f0',
        foreground: '#1f2937',
        cardBg: '#e8f5e8',
        cardBorder: '#c3e6c3',
        inputBg: '#ffffff',
        accentBg: '#f0f9f0'
      },
      sunset: {
        background: '#fff7ed',
        foreground: '#1f2937',
        cardBg: '#fed7aa',
        cardBorder: '#fdba74',
        inputBg: '#ffffff',
        accentBg: '#fff1e6'
      },
      ocean: {
        background: '#f0f9ff',
        foreground: '#1f2937',
        cardBg: '#dbeafe',
        cardBorder: '#93c5fd',
        inputBg: '#ffffff',
        accentBg: '#f0f9ff'
      },
      lavender: {
        background: '#faf5ff',
        foreground: '#1f2937',
        cardBg: '#f3e8ff',
        cardBorder: '#d8b4fe',
        inputBg: '#ffffff',
        accentBg: '#faf5ff'
      }
    }
    
    const themeVars = themeVariables[themeId as keyof typeof themeVariables] || themeVariables.default
    root.style.setProperty('--background', themeVars.background)
    root.style.setProperty('--foreground', themeVars.foreground)
    root.style.setProperty('--card-bg', themeVars.cardBg)
    root.style.setProperty('--card-border', themeVars.cardBorder)
    root.style.setProperty('--input-bg', themeVars.inputBg)
    root.style.setProperty('--accent-bg', themeVars.accentBg)
    
    console.log('Theme applied:', themeId, 'Colors:', colors)
  }, [settings?.theme])

  // Sync Spotify connection status with settings
  const syncSpotifyStatus = async (isConnected: boolean) => {
    if (settings && settings.spotify_enabled !== isConnected) {
      try {
        await updateSettings({ spotify_enabled: isConnected })
        console.log('Spotify status synced with settings:', isConnected)
      } catch (error) {
        console.error('Failed to sync Spotify status:', error)
      }
    }
  }

  const value: SettingsContextType = {
    settings,
    loading,
    error,
    updateSettings,
    refetch: fetchSettings,
    syncSpotifyStatus,
  }

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
}
