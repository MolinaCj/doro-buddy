// components/Music/MusicPlayer.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, 
  Shuffle, Repeat, Heart, ExternalLink, Music, X 
} from 'lucide-react';
import { useSpotify } from '@/hooks/useSpotify';
import { useSettings } from '@/hooks/useSettings';
import { Track, Playlist } from '@/types/api';

interface MusicPlayerProps {
  compact?: boolean;
  showControls?: boolean;
  sessionActive?: boolean;
  onPlayStateChange?: (isPlaying: boolean) => void;
}

interface PlaybackState {
  isPlaying: boolean;
  track: Track | null;
  position: number;
  duration: number;
  volume: number;
  shuffle: boolean;
  repeat: 'off' | 'track' | 'context';
}

export default function MusicPlayer({ 
  compact = false, 
  showControls = true,
  sessionActive = false,
  onPlayStateChange 
}: MusicPlayerProps) {
  const { settings, syncSpotifyStatus } = useSettings();
  const { 
    isConnected, 
    connect, 
    disconnect, 
    playback, 
    play, 
    pause, 
    next, 
    previous, 
    setVolume,
    search,
    loading 
  } = useSpotify();

  const [localPlayback, setLocalPlayback] = useState<PlaybackState>({
    isPlaying: false,
    track: null,
    position: 0,
    duration: 0,
    volume: settings?.music_volume || 0.5,
    shuffle: false,
    repeat: 'off',
  });

  const [showSpotifyConnect, setShowSpotifyConnect] = useState(false);
  const [fallbackTracks] = useState<Track[]>([
    {
      id: 'focus1',
      name: 'Deep Focus',
      artist: 'Focus Sounds',
      duration: 180,
      url: '/audio/ambient/deep-focus.mp3',
    },
    {
      id: 'nature1',
      name: 'Forest Ambience',
      artist: 'Nature Sounds',
      duration: 240,
      url: '/audio/ambient/forest.mp3',
    },
    {
      id: 'ocean1',
      name: 'Ocean Waves',
      artist: 'Nature Sounds',
      duration: 300,
      url: '/audio/ambient/ocean-waves.mp3',
    },
    {
      id: 'rain1',
      name: 'Rainfall',
      artist: 'Nature Sounds',
      duration: 200,
      url: '/audio/ambient/rain.wav',
    },
    {
      id: 'cafe1',
      name: 'Cafe',
      artist: 'Cafe Ambience',
      duration: 200,
      url: '/audio/ambient/cafe.mp3',
    },
    {
      id: 'whitenoise1',
      name: 'White Noise',
      artist: 'White Noise',
      duration: 200,
      url: '/audio/ambient/white-noise.mp3',
    },
    {
      id: 'fireplace1',
      name: 'Fire Place',
      artist: 'Fire Place',
      duration: 200,
      url: '/audio/ambient/fireplace.mp3',
    },
    // Add more fallback tracks
  ]);

  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentFallbackIndex, setCurrentFallbackIndex] = useState(0);
  const [isFallbackMode, setIsFallbackMode] = useState(true);

  // Update playback state when Spotify state changes
  useEffect(() => {
  if (isConnected && playback && playback.track) {
    const trackData = {
      id: playback.track.id,
      name: playback.track.name,
      artist: playback.track.artists?.join(', ') || '', // make sure it's not undefined
      duration: Math.floor(playback.track.duration_ms / 1000), // ms → seconds
      spotify_id: playback.track.id,
    };

    setLocalPlayback({
      isPlaying: playback.is_playing,
      track: trackData,
      position: Math.floor(playback.track.progress_ms / 1000),
      duration: trackData.duration,
      volume: settings?.music_volume || 0.5,
      shuffle: false,
      repeat: 'off',
    });

    setIsFallbackMode(false);
  } else if (isConnected) {
    // No track playing
    setLocalPlayback(prev => ({
      ...prev,
      track: null,
      position: 0,
      duration: 0,
    }));
  }
}, [isConnected, playback, settings?.music_volume]);



  // Notify parent of play state changes
  useEffect(() => {
    onPlayStateChange?.(localPlayback.isPlaying);
  }, [localPlayback.isPlaying, onPlayStateChange]);

  // Handle Spotify connection
  const handleSpotifyConnect = async () => {
    try {
      setShowSpotifyConnect(true);
      await connect();
      setShowSpotifyConnect(false);
      // Sync with settings
      await syncSpotifyStatus(true);
    } catch (error) {
      console.error('Failed to connect to Spotify:', error);
      setShowSpotifyConnect(false);
      // Show error to user
      alert(`Failed to connect to Spotify: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Handle Spotify disconnection
  const handleSpotifyDisconnect = async () => {
    try {
      await disconnect();
      // Sync with settings
      await syncSpotifyStatus(false);
    } catch (error) {
      console.error('Failed to disconnect from Spotify:', error);
    }
  };

  // Handle play/pause
  const handlePlayPause = useCallback(async () => {
    if (isFallbackMode) {
      // Handle fallback audio player
      if (audioRef.current) {
        if (localPlayback.isPlaying) {
          audioRef.current.pause();
        } else {
          await audioRef.current.play();
        }
      }
    } else {
      // Handle Spotify
      try {
        if (localPlayback.isPlaying) {
          await pause();
        } else {
          await play();
        }
      } catch (error) {
        console.error('Failed to control playback:', error);
      }
    }
  }, [isFallbackMode, localPlayback.isPlaying, play, pause]);

// Handle next track
const handleNext = useCallback(() => {
  if (isFallbackMode) {
    let nextIndex;
    if (localPlayback.shuffle) {
      // pick random different index
      do {
        nextIndex = Math.floor(Math.random() * fallbackTracks.length);
      } while (nextIndex === currentFallbackIndex && fallbackTracks.length > 1);
    } else {
      // wrap around to 0
      nextIndex = (currentFallbackIndex + 1) % fallbackTracks.length;
    }

    setCurrentFallbackIndex(nextIndex);
    setLocalPlayback((prev) => ({
      ...prev,
      track: fallbackTracks[nextIndex],
      position: 0,
      isPlaying: true, // 👈 keep playing
    }));
  } else {
    try {
      next(); // spotify sdk
    } catch (error) {
      console.error("Failed to skip track:", error);
    }
  }
}, [isFallbackMode, currentFallbackIndex, fallbackTracks, next, localPlayback.shuffle]);

// Handle previous track
const handlePrevious = useCallback(async () => {
  if (isFallbackMode) {
    const prevIndex = currentFallbackIndex === 0 
      ? fallbackTracks.length - 1 
      : currentFallbackIndex - 1;

    setCurrentFallbackIndex(prevIndex);
    setLocalPlayback(prev => ({ 
      ...prev, 
      track: fallbackTracks[prevIndex],
      position: 0,
      isPlaying: prev.isPlaying,   // 👈 preserve play/pause state
    }));
  } else {
    try {
      await previous();
    } catch (error) {
      console.error('Failed to go to previous track:', error);
    }
  }
}, [isFallbackMode, currentFallbackIndex, fallbackTracks, previous]);

  // Handle volume change
  const handleVolumeChange = useCallback(async (newVolume: number) => {
    setLocalPlayback(prev => ({ ...prev, volume: newVolume }));
    
    if (isFallbackMode && audioRef.current) {
      audioRef.current.volume = newVolume;
    } else if (isConnected) {
      try {
        await setVolume(Math.round(newVolume * 100));
      } catch (error) {
        console.error('Failed to set volume:', error);
      }
    }
  }, [isFallbackMode, isConnected, setVolume]);

  // Initialize fallback player
  useEffect(() => {
    if (isFallbackMode && fallbackTracks.length > 0) {
      setLocalPlayback(prev => ({ 
        ...prev, 
        track: fallbackTracks[currentFallbackIndex] 
      }));
    }
  }, [isFallbackMode, fallbackTracks, currentFallbackIndex]);

  // Auto-pause during focus sessions (optional)
  useEffect(() => {
    if (sessionActive && settings?.spotify_enabled && localPlayback.isPlaying) {
      // Optional: pause music during focus sessions
      // handlePlayPause();
    }
  }, [sessionActive, settings?.spotify_enabled]);

  const currentTrack = localPlayback.track || fallbackTracks[currentFallbackIndex];
  const progressPercentage = localPlayback.duration > 0 
    ? (localPlayback.position / localPlayback.duration) * 100 
    : 0;

  // Sync audio element volume with local playback volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = localPlayback.volume;
    }
  }, [localPlayback.volume]);

  if (compact) {
    return (
      <div className="flex items-center space-x-2 bg-white dark:bg-gray-800 rounded-lg p-2 border border-gray-200 dark:border-gray-700">
        <button
          onClick={handlePlayPause}
          className="p-2 text-gray-600 hover:text-blue-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          disabled={loading}
        >
          {localPlayback.isPlaying ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4" />
          )}
        </button>
        
        {currentTrack && (
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {currentTrack.name}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {currentTrack.artist}
            </p>
          </div>
        )}
        
        <div className="flex items-center space-x-1">
          <VolumeX className="w-3 h-3 text-gray-400" />
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={localPlayback.volume}
            onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
            className="w-16"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-gray-900 dark:text-white flex items-center">
            <Music className="w-5 h-5 mr-2" />
            Music Player
          </h3>
          
          {/* Spotify Connection */}
          <div className="flex items-center space-x-2">
            {isConnected ? (
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm text-green-600">Spotify Connected</span>
                <button
                  onClick={handleSpotifyDisconnect}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={handleSpotifyConnect}
                disabled={loading || showSpotifyConnect}
                className="px-3 py-1 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 disabled:opacity-50"
              >
                {showSpotifyConnect ? 'Connecting...' : 'Connect Spotify'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Current Track Display */}
      {currentTrack && (
        <div className="p-4">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
              <Music className="w-8 h-8 text-gray-400" />
            </div>
            
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-gray-900 dark:text-white truncate">
                {currentTrack.name}
              </h4>
              <p className="text-sm text-gray-500 truncate">
                {currentTrack.artist}
              </p>
              
              {/* Progress Bar */}
              <div className="mt-2">
                <input
                  type="range"
                  min={0}
                  max={localPlayback.duration}
                  value={localPlayback.position}
                  step={1000} // step 1 second (1000 ms)
                  onChange={(e) => {
                    // Update position while dragging/clicking
                    setLocalPlayback((prev) => ({
                      ...prev,
                      position: Number(e.target.value),
                    }));
                  }}
                  onMouseUp={(e) => {
                    // Seek audio when mouse released
                    if (audioRef.current) {
                      audioRef.current.currentTime = Number(e.currentTarget.value) / 1000;
                    }
                  }}
                  onTouchEnd={(e) => {
                    // Seek audio when touch released
                    if (audioRef.current) {
                      audioRef.current.currentTime = Number(e.currentTarget.value) / 1000;
                    }
                  }}
                  className="w-full h-1 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>{formatTime(Math.floor(localPlayback.position / 1000))}</span>
                  <span>{formatTime(Math.floor(localPlayback.duration / 1000))}</span>
                </div>
              </div>
            </div>

            {/* External Link */}
            {currentTrack.spotify_id && (
              <button
                onClick={() => window.open(`https://open.spotify.com/track/${currentTrack.spotify_id}`, '_blank')}
                className="p-2 text-gray-400 hover:text-green-500 rounded-lg"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Controls */}
      {showControls && (
        <div className="p-4 bg-gray-50 dark:bg-gray-900/50">
          <div className="flex items-center justify-center space-x-4">
            {/* Shuffle */}
            <button
              onClick={() => setLocalPlayback(prev => ({ ...prev, shuffle: !prev.shuffle }))}
              className={`p-2 rounded-lg transition-colors ${
                localPlayback.shuffle 
                  ? 'text-blue-500 bg-blue-100 dark:bg-blue-900/50' 
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <Shuffle className="w-4 h-4" />
            </button>

            {/* Previous */}
            <button
              onClick={handlePrevious}
              disabled={loading}
              className="p-2 text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
            >
              <SkipBack className="w-5 h-5" />
            </button>

            {/* Play/Pause */}
            <button
              onClick={handlePlayPause}
              disabled={loading}
              className="p-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              {localPlayback.isPlaying ? (
                <Pause className="w-6 h-6" />
              ) : (
                <Play className="w-6 h-6 ml-0.5" />
              )}
            </button>

            {/* Next */}
            <button
              onClick={handleNext}
              disabled={loading}
              className="p-2 text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
            >
              <SkipForward className="w-5 h-5" />
            </button>

            {/* Repeat */}
            <button
              onClick={() => {
                const nextRepeat = localPlayback.repeat === 'off' ? 'context' : 
                                 localPlayback.repeat === 'context' ? 'track' : 'off';
                setLocalPlayback(prev => ({ ...prev, repeat: nextRepeat }));
              }}
              className={`p-2 rounded-lg transition-colors ${
                localPlayback.repeat !== 'off'
                  ? 'text-blue-500 bg-blue-100 dark:bg-blue-900/50' 
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <Repeat className="w-4 h-4" />
              {localPlayback.repeat === 'track' && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full"></span>
              )}
            </button>
          </div>

          {/* Volume Control */}
          <div className="flex items-center space-x-3 mt-4">
            <VolumeX className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={localPlayback.volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              className="flex-1 accent-blue-500"
            />
            <Volume2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span className="text-sm text-gray-500 min-w-[3rem] text-right">
              {Math.round(localPlayback.volume * 100)}%
            </span>
          </div>
        </div>
      )}

      {/* Fallback Audio Element */}
{isFallbackMode && currentTrack?.url && (
<audio
  key={`${currentTrack.url}-${localPlayback.repeat}`} 
  ref={audioRef}
  src={currentTrack.url}
  preload="auto"
  autoPlay={localPlayback.isPlaying} // only play if state says "playing"
  onTimeUpdate={(e) => {
    const audio = e.currentTarget;
    setLocalPlayback((prev) => ({
      ...prev,
      position: audio.currentTime * 1000,
      duration: audio.duration * 1000,
    }));
  }}
  onEnded={() => {
    if (localPlayback.repeat === "track") {
      // browser handles looping, but ensure play state stays true
      audioRef.current?.play();
    } else if (localPlayback.repeat === "context") {
      // go to next track, wrapping around if needed
      handleNext();
    } else {
      // repeat === "off"
      setLocalPlayback((prev) => ({ ...prev, isPlaying: false }));
    }
  }}
  onPlay={() => setLocalPlayback((prev) => ({ ...prev, isPlaying: true }))}
  onPause={() => setLocalPlayback((prev) => ({ ...prev, isPlaying: false }))}
  loop={localPlayback.repeat === "track"} // native repeat
/>
)}


      {/* No Connection State */}
      {!isConnected && !isFallbackMode && (
        <div className="p-6 text-center">
          <Music className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-4">
            Connect to Spotify or use built-in sounds
          </p>
          <button
            onClick={handleSpotifyConnect}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
          >
            Connect Spotify
          </button>
        </div>
      )}
    </div>
  );
}

// Spotify Connect Dialog Component
export function SpotifyConnectDialog({ 
  isOpen, 
  onClose, 
  onConnect 
}: {
  isOpen: boolean;
  onClose: () => void;
  onConnect: () => void;
}) {
  const [step, setStep] = useState<'info' | 'loading' | 'success' | 'error'>('info');

  const handleConnect = async () => {
    setStep('loading');
    try {
      await onConnect();
      setStep('success');
      setTimeout(() => {
        onClose();
        setStep('info');
      }, 1500);
    } catch {
      setStep('error');
      setTimeout(() => setStep('info'), 3000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
        <div className="text-center">
          {step === 'info' && (
            <>
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Music className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Connect to Spotify</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Access your Spotify playlists and control playback directly from DoroBuddy.
              </p>
              <div className="space-y-2 text-sm text-gray-500 mb-6">
                <p>• Spotify Premium recommended for full control</p>
                <p>• Free accounts can preview tracks</p>
                <p>• Your data stays private and secure</p>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConnect}
                  className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                >
                  Connect
                </button>
              </div>
            </>
          )}

          {step === 'loading' && (
            <>
              <div className="w-16 h-16 border-4 border-green-200 border-t-green-500 rounded-full animate-spin mx-auto mb-4"></div>
              <h3 className="text-lg font-semibold mb-2">Connecting...</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Please authorize DoroBuddy in the popup window.
              </p>
            </>
          )}

          {step === 'success' && (
            <>
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Music className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-green-600 mb-2">Connected!</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Your Spotify account is now connected.
              </p>
            </>
          )}

          {step === 'error' && (
            <>
              <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <X className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-red-600 mb-2">Connection Failed</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Unable to connect to Spotify. Please try again.
              </p>
              <button
                onClick={() => setStep('info')}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                Try Again
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Format time utility
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Custom hook for Spotify Web Playback SDK
export function useSpotifyPlayer() {
  const [player, setPlayer] = useState<any>(null);
  const [deviceId, setDeviceId] = useState<string>('');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!window.Spotify) return;

    const spotifyPlayer = new window.Spotify.Player({
      name: 'DoroBuddy Web Player',
      getOAuthToken: (callback: (token: string) => void) => {
        // Get token from your auth system
        const token = localStorage.getItem('spotify_access_token');
        callback(token || '');
      },
      volume: 0.5
    });

    // Ready
    spotifyPlayer.addListener('ready', (data: unknown) => {
      const { device_id } = data as { device_id: string };
      console.log('Ready with Device ID', device_id);
      setDeviceId(device_id);
      setIsReady(true);
    });

    // Not Ready
    spotifyPlayer.addListener('not_ready', (data: unknown) => {
      const { device_id } = data as { device_id: string };
      console.log('Device ID has gone offline', device_id);
      setIsReady(false);
    });

    // Player state changes
    spotifyPlayer.addListener('player_state_changed', (state: unknown) => {
      if (!state) return;
      
      // Update playback state
      console.log('Player state changed', state);
    });

    // Connect to the player
    spotifyPlayer.connect();
    setPlayer(spotifyPlayer);

    return () => {
      spotifyPlayer.disconnect();
    };
  }, []);

  return {
    player,
    deviceId,
    isReady,
  };
}