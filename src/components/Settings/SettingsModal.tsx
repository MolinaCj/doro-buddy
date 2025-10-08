// components/Settings/SettingsModal.tsx
import React, { useState, useEffect } from 'react';
import { 
  X, Save, Clock, Volume2, Palette, Bell, Music, 
  Play, Pause, Download, Upload, RotateCcw 
} from 'lucide-react';
import { UserSettings, UpdateSettingsRequest } from '@/types/api';
import { useSettings } from '@/hooks/useSettings';
import { useAudio } from '@/hooks/useAudio';
import { useSpotify } from '@/hooks/useSpotify';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TabConfig {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const TABS: TabConfig[] = [
  { id: 'timer', label: 'Timer', icon: <Clock className="w-4 h-4" /> },
  { id: 'audio', label: 'Audio', icon: <Volume2 className="w-4 h-4" /> },
  { id: 'theme', label: 'Theme', icon: <Palette className="w-4 h-4" /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
  { id: 'music', label: 'Music', icon: <Music className="w-4 h-4" /> },
];

const THEMES = [
  { id: 'default', name: 'Default', colors: ['#3B82F6', '#EF4444', '#10B981'] },
  { id: 'dark', name: 'Dark', colors: ['#1F2937', '#374151', '#4B5563'] },
  { id: 'nature', name: 'Nature', colors: ['#059669', '#0D9488', '#047857'] },
  { id: 'sunset', name: 'Sunset', colors: ['#F59E0B', '#EF4444', '#DC2626'] },
  { id: 'ocean', name: 'Ocean', colors: ['#0EA5E9', '#0284C7', '#0369A1'] },
  { id: 'lavender', name: 'Lavender', colors: ['#8B5CF6', '#A855F7', '#9333EA'] },
];

const SOUND_OPTIONS = [
  { id: 'bell', name: 'Bell', file: '/audio/sounds/bell.wav' },
  { id: 'chime', name: 'Chime', file: '/audio/sounds/chime.wav' },
  { id: 'ding', name: 'Ding', file: '/audio/sounds/ding.mp3' },
  { id: 'gong', name: 'Gong', file: '/audio/sounds/gong.mp3' },
  { id: 'message', name: 'Message Notification', file: '/audio/sounds/message-notif.mp3' },
  { id: 'none', name: 'Silent', file: null },
];

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { settings, updateSettings, loading, syncSpotifyStatus } = useSettings();
  const { playSound, preloadSound } = useAudio();
  const { isConnected, connect, disconnect } = useSpotify();
  
  const [activeTab, setActiveTab] = useState('timer');
  const [formData, setFormData] = useState<UpdateSettingsRequest>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [previewSound, setPreviewSound] = useState<string | null>(null);

  // Initialize form data when settings load
  useEffect(() => {
    if (settings) {
      setFormData({
        work_duration: settings.work_duration,
        short_break_duration: settings.short_break_duration,
        long_break_duration: settings.long_break_duration,
        sessions_until_long_break: settings.sessions_until_long_break,
        auto_start_breaks: settings.auto_start_breaks,
        auto_start_pomodoros: settings.auto_start_pomodoros,
        theme: settings.theme,
        notification_sound: settings.notification_sound,
        break_sound: settings.break_sound,
        master_volume: settings.master_volume,
        notification_volume: settings.notification_volume,
        music_volume: settings.music_volume,
        ambient_volume: settings.ambient_volume,
        spotify_enabled: settings.spotify_enabled,
      });
    }
  }, [settings]);

  // Sync Spotify connection status with form data
  useEffect(() => {
    if (settings) {
      setFormData(prev => ({
        ...prev,
        spotify_enabled: isConnected
      }));
    }
  }, [isConnected, settings]);

  // Handle input changes
  const handleInputChange = (field: keyof UpdateSettingsRequest, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

// Handle form submission
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  try {
    // Apply safe defaults if values are null/empty
    const safeData = {
      ...formData,
      work_duration: formData.work_duration ?? 1500,          // 25m default
      short_break_duration: formData.short_break_duration ?? 300, // 5m default
      long_break_duration: formData.long_break_duration ?? 900,   // 15m default
    };

    console.log('Updating settings with data:', safeData);
    const updatedSettings = await updateSettings(safeData);
    console.log('Settings updated successfully:', updatedSettings);
    setHasChanges(false);
    onClose();
  } catch (error) {
    console.error("Failed to update settings:", error);
  }
};


  // Handle Spotify connection
  const handleSpotifyConnect = async () => {
    try {
      await connect();
      await syncSpotifyStatus(true);
      setFormData(prev => ({ ...prev, spotify_enabled: true }));
      setHasChanges(true);
    } catch (error) {
      console.error('Failed to connect to Spotify:', error);
      alert(`Failed to connect to Spotify: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Handle Spotify disconnection
  const handleSpotifyDisconnect = async () => {
    try {
      await disconnect();
      await syncSpotifyStatus(false);
      setFormData(prev => ({ ...prev, spotify_enabled: false }));
      setHasChanges(true);
    } catch (error) {
      console.error('Failed to disconnect from Spotify:', error);
    }
  };

  // Handle reset to defaults
  const handleReset = () => {
    if (!confirm('Reset all settings to default values? This cannot be undone.')) return;
    
    const defaults: UpdateSettingsRequest = {
      work_duration: 1500,
      short_break_duration: 300,
      long_break_duration: 1800,
      sessions_until_long_break: 4,
      auto_start_breaks: false,
      auto_start_pomodoros: false,
      theme: 'default',
      notification_sound: 'bell',
      break_sound: 'chime',
      master_volume: 0.7,
      notification_volume: 0.8,
      music_volume: 0.5,
      ambient_volume: 0.3,
      spotify_enabled: false,
    };
    
    setFormData(defaults);
    setHasChanges(true);
  };

  // Handle sound preview
  const handleSoundPreview = (soundId: string) => {
    if (soundId === 'none') return;
    
    const sound = SOUND_OPTIONS.find(s => s.id === soundId);
    if (sound?.file) {
      setPreviewSound(soundId);
      playSound(soundId, formData.notification_volume || 0.8);
      setTimeout(() => setPreviewSound(null), 1000);
    }
  };

  // Export settings
  const handleExportSettings = () => {
    const exportData = {
      ...formData,
      exported_at: new Date().toISOString(),
      version: '1.0',
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dorobuddy-settings-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Import settings
  const handleImportSettings = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target?.result as string);
        
        // Validate and sanitize imported data
        const validFields: (keyof UpdateSettingsRequest)[] = [
          'work_duration', 'short_break_duration', 'long_break_duration',
          'sessions_until_long_break', 'auto_start_breaks', 'auto_start_pomodoros',
          'theme', 'notification_sound', 'break_sound', 'master_volume',
          'notification_volume', 'music_volume', 'ambient_volume', 'spotify_enabled'
        ];
        
        const sanitizedData: UpdateSettingsRequest = {};
        validFields.forEach(field => {
          if (field in importedData) {
            sanitizedData[field] = importedData[field];
          }
        });
        
        setFormData(prev => ({ ...prev, ...sanitizedData }));
        setHasChanges(true);
        
        alert('Settings imported successfully!');
      } catch (error) {
        alert('Failed to import settings. Please check the file format.');
      }
    };
    reader.readAsText(file);
    
    // Reset input
    event.target.value = '';
  };

  // Format duration for display
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Settings
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col sm:flex-row h-[60vh]">
          {/* Sidebar - Mobile: Horizontal tabs, Desktop: Vertical sidebar */}
          <div className="w-full sm:w-48 bg-gray-50 dark:bg-gray-900 border-b sm:border-b-0 sm:border-r border-gray-200 dark:border-gray-700">
            <nav className="p-2 sm:p-4 flex sm:flex-col space-x-1 sm:space-x-0 sm:space-y-1 overflow-x-auto sm:overflow-x-visible">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex-shrink-0 sm:w-full flex items-center space-x-2 sm:space-x-3 px-3 py-2 rounded-lg text-left transition-colors whitespace-nowrap
                    ${activeTab === tab.id
                      ? 'bg-blue-500 text-white'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }
                  `}
                >
                  {tab.icon}
                  <span className="text-sm sm:text-base">{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* Settings Content */}
          <div className="flex-1 overflow-y-auto">
            <form onSubmit={handleSubmit} className="p-4 sm:p-6">
              {/* Timer Settings */}
              {activeTab === 'timer' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    Timer Settings
                  </h3>

                  {/* Duration Settings */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Work Duration
                      </label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          min="1"
                          max="120"
                          value={
                            formData.work_duration !== undefined && formData.work_duration !== null
                              ? Math.floor(formData.work_duration / 60).toString()
                              : ""
                          }
                          onChange={(e) => {
                            const val = e.target.value;
                            handleInputChange(
                              "work_duration",
                              val === "" ? null : parseInt(val) * 60
                            );
                          }}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-500">minutes</span>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        Current: {formatDuration(formData.work_duration || 1500)}
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Short Break
                      </label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          min="1"
                          max="30"
                          value={
                            formData.short_break_duration !== undefined && formData.short_break_duration !== null
                              ? Math.floor(formData.short_break_duration / 60).toString()
                              : ""
                          }
                          onChange={(e) => {
                            const val = e.target.value;
                            handleInputChange(
                              "short_break_duration",
                              val === "" ? null : parseInt(val) * 60
                            );
                          }}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-500">minutes</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Long Break
                      </label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          min="5"
                          max="60"
                          value={
                            formData.long_break_duration !== undefined && formData.long_break_duration !== null
                              ? Math.floor(formData.long_break_duration / 60).toString()
                              : ""
                          }
                          onChange={(e) => {
                            const val = e.target.value;
                            handleInputChange(
                              "long_break_duration",
                              val === "" ? null : parseInt(val) * 60
                            );
                          }}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-500">minutes</span>
                      </div>
                    </div>
                  </div>

                  {/* Sessions Until Long Break */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Sessions Until Long Break
                    </label>
                    <select
                      value={formData.sessions_until_long_break || 4}
                      onChange={(e) => handleInputChange('sessions_until_long_break', parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      {[2, 3, 4, 5, 6, 8].map(num => (
                        <option key={num} value={num}>{num} sessions</option>
                      ))}
                    </select>
                  </div>

                  {/* Auto-start Options */}
                  <div className="space-y-3">
                    <label className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={formData.auto_start_breaks || false}
                        onChange={(e) => handleInputChange('auto_start_breaks', e.target.checked)}
                        className="w-4 h-4 text-blue-500 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Auto-start break timers
                      </span>
                    </label>

                    <label className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={formData.auto_start_pomodoros || false}
                        onChange={(e) => handleInputChange('auto_start_pomodoros', e.target.checked)}
                        className="w-4 h-4 text-blue-500 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Auto-start work timers after breaks
                      </span>
                    </label>
                  </div>
                </div>
              )}

              {/* Audio Settings */}
              {activeTab === 'audio' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    Audio Settings
                  </h3>

                  {/* Volume Controls */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Master Volume: {Math.round((formData.master_volume || 0.7) * 100)}%
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={formData.master_volume || 0.7}
                        onChange={(e) => handleInputChange('master_volume', parseFloat(e.target.value))}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Notification Volume: {Math.round((formData.notification_volume || 0.8) * 100)}%
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={formData.notification_volume || 0.8}
                        onChange={(e) => handleInputChange('notification_volume', parseFloat(e.target.value))}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Music Volume: {Math.round((formData.music_volume || 0.5) * 100)}%
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={formData.music_volume || 0.5}
                        onChange={(e) => handleInputChange('music_volume', parseFloat(e.target.value))}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Ambient Volume: {Math.round((formData.ambient_volume || 0.3) * 100)}%
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={formData.ambient_volume || 0.3}
                        onChange={(e) => handleInputChange('ambient_volume', parseFloat(e.target.value))}
                        className="w-full"
                      />
                    </div>
                  </div>

                  {/* Sound Selection */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Session Complete Sound
                      </label>
                      <div className="space-y-2">
                        {SOUND_OPTIONS.map(sound => (
                          <label key={sound.id} className="flex items-center space-x-3">
                            <input
                              type="radio"
                              name="notification_sound"
                              value={sound.id}
                              checked={formData.notification_sound === sound.id}
                              onChange={(e) => handleInputChange('notification_sound', e.target.value)}
                              className="w-4 h-4 text-blue-500"
                            />
                            <span className="flex-1 text-sm">{sound.name}</span>
                            {sound.file && (
                              <button
                                type="button"
                                onClick={() => handleSoundPreview(sound.id)}
                                className="p-1 text-gray-400 hover:text-blue-500 rounded"
                                disabled={previewSound === sound.id}
                              >
                                {previewSound === sound.id ? (
                                  <Pause className="w-4 h-4" />
                                ) : (
                                  <Play className="w-4 h-4" />
                                )}
                              </button>
                            )}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Break Complete Sound
                      </label>
                      <div className="space-y-2">
                        {SOUND_OPTIONS.map(sound => (
                          <label key={sound.id} className="flex items-center space-x-3">
                            <input
                              type="radio"
                              name="break_sound"
                              value={sound.id}
                              checked={formData.break_sound === sound.id}
                              onChange={(e) => handleInputChange('break_sound', e.target.value)}
                              className="w-4 h-4 text-blue-500"
                            />
                            <span className="flex-1 text-sm">{sound.name}</span>
                            {sound.file && (
                              <button
                                type="button"
                                onClick={() => handleSoundPreview(sound.id)}
                                className="p-1 text-gray-400 hover:text-blue-500 rounded"
                                disabled={previewSound === sound.id}
                              >
                                {previewSound === sound.id ? (
                                  <Pause className="w-4 h-4" />
                                ) : (
                                  <Play className="w-4 h-4" />
                                )}
                              </button>
                            )}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Theme Settings */}
              {activeTab === 'theme' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    Theme Settings
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {THEMES.map(theme => (
                      <div
                        key={theme.id}
                        className={`
                          p-4 border-2 rounded-lg cursor-pointer transition-all
                          ${formData.theme === theme.id
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-200 hover:border-gray-300'
                          }
                        `}
                        onClick={() => handleInputChange('theme', theme.id)}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium">{theme.name}</h4>
                          <input
                            type="radio"
                            name="theme"
                            value={theme.id}
                            checked={formData.theme === theme.id}
                            onChange={() => {}} // Handled by div click
                            className="w-4 h-4 text-blue-500"
                          />
                        </div>
                        <div className="flex space-x-1">
                          {theme.colors.map((color, index) => (
                            <div
                              key={index}
                              className="w-8 h-8 rounded"
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notifications Settings */}
              {activeTab === 'notifications' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    Notification Settings
                  </h3>

                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                    <div className="flex items-start">
                      <Bell className="w-5 h-5 text-yellow-600 mt-0.5 mr-3" />
                      <div>
                        <h4 className="font-medium text-yellow-800 dark:text-yellow-200">
                          Browser Notifications
                        </h4>
                        <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                          Enable browser notifications to receive alerts even when DoroBuddy is not the active tab.
                        </p>
                        <button
                          type="button"
                          onClick={async () => {
                            if (Notification.permission === 'default') {
                              await Notification.requestPermission();
                            }
                          }}
                          className="mt-3 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm"
                        >
                          {Notification.permission === 'granted' ? 'Notifications Enabled' :
                           Notification.permission === 'denied' ? 'Notifications Blocked' :
                           'Enable Notifications'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={true} // Always enabled for now
                        disabled
                        className="w-4 h-4 text-blue-500 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <div>
                        <span className="text-sm text-gray-700 dark:text-gray-300 block">
                          Session completion alerts
                        </span>
                        <span className="text-xs text-gray-500">
                          Play sound when work sessions and breaks complete
                        </span>
                      </div>
                    </label>

                    <label className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={true} // Always enabled for now
                        disabled
                        className="w-4 h-4 text-blue-500 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <div>
                        <span className="text-sm text-gray-700 dark:text-gray-300 block">
                          Visual notifications
                        </span>
                        <span className="text-xs text-gray-500">
                          Show browser notifications for timer events
                        </span>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {/* Music Settings */}
              {activeTab === 'music' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    Music Integration
                  </h3>

                  {/* Spotify Integration */}
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">Spotify</h4>
                        <p className="text-sm text-gray-500">
                          Connect your Spotify account for music playback
                        </p>
                      </div>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.spotify_enabled || false}
                          onChange={(e) => handleInputChange('spotify_enabled', e.target.checked)}
                          className="sr-only"
                        />
                        <div className={`
                          relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                          ${formData.spotify_enabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}
                        `}>
                          <span className={`
                            inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                            ${formData.spotify_enabled ? 'translate-x-6' : 'translate-x-1'}
                          `} />
                        </div>
                      </label>
                    </div>

                    {formData.spotify_enabled && (
                      <div className="space-y-3">
                        {isConnected ? (
                          <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <span className="text-sm text-green-700 dark:text-green-300">Spotify Connected</span>
                            </div>
                            <button
                              type="button"
                              onClick={handleSpotifyDisconnect}
                              className="text-xs text-red-600 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                              Disconnect
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={handleSpotifyConnect}
                            className="w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                          >
                            Connect to Spotify
                          </button>
                        )}
                        
                        <div className="text-xs text-gray-500">
                          <p>• Requires Spotify Premium for full functionality</p>
                          <p>• Free accounts can use playlist previews</p>
                          <p>• Music will pause during focus sessions (optional)</p>
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              )}
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between p-4 sm:p-6 border-t border-gray-200 dark:border-gray-700 space-y-3 sm:space-y-0">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center px-2 sm:px-3 py-2 text-gray-600 hover:text-gray-800 text-xs sm:text-sm"
            >
              <RotateCcw className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
              <span className="hidden sm:inline">Reset to Defaults</span>
              <span className="sm:hidden">Reset</span>
            </button>

            <button
              type="button"
              onClick={handleExportSettings}
              className="flex items-center px-2 sm:px-3 py-2 text-gray-600 hover:text-gray-800 text-xs sm:text-sm"
            >
              <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
              <span className="hidden sm:inline">Export</span>
              <span className="sm:hidden">Export</span>
            </button>

            <label className="flex items-center px-2 sm:px-3 py-2 text-gray-600 hover:text-gray-800 text-xs sm:text-sm cursor-pointer">
              <Upload className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
              <span className="hidden sm:inline">Import</span>
              <span className="sm:hidden">Import</span>
              <input
                type="file"
                accept=".json"
                onChange={handleImportSettings}
                className="sr-only"
              />
            </label>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-3 sm:px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-sm"
            >
              Cancel
            </button>
            
            <button
              onClick={handleSubmit}
              disabled={!hasChanges || loading}
              className="flex-1 sm:flex-none flex items-center justify-center px-3 sm:px-4 py-2 bg-blue-500 text-white hover:bg-blue-600 rounded-lg transition-colors disabled:opacity-50 text-sm"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-1" />
                  <span className="hidden sm:inline">Save Changes</span>
                  <span className="sm:hidden">Save</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Hook for keyboard shortcuts in settings modal
export function useSettingsShortcuts(onSave: () => void, onClose: () => void) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        onSave();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onSave, onClose]);
}