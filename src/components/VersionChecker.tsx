import React, { useEffect, useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

const CURRENT_VERSION = '1.0.0';
const VERSION_CHECK_INTERVAL = 2 * 60 * 1000; // Check every 2 minutes

export const VersionChecker: React.FC = () => {
  const [newVersionAvailable, setNewVersionAvailable] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const checkVersion = async () => {
    try {
      console.log('[Version] Checking for updates...');

      // Force bypass all caches
      const response = await fetch(`/version.json?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const serverVersion = data.version;

        console.log(`[Version] Server: ${serverVersion}, Current: ${CURRENT_VERSION}`);

        if (serverVersion && serverVersion !== CURRENT_VERSION) {
          console.log(`[Version] New version available: ${serverVersion}`);
          setNewVersionAvailable(true);
        }
      }
    } catch (error) {
      console.error('[Version] Check failed:', error);
    }
  };

  useEffect(() => {
    // Initial check
    checkVersion();

    // Check periodically
    const interval = setInterval(checkVersion, VERSION_CHECK_INTERVAL);

    // Listen for service worker updates
    const handleSWUpdate = () => {
      console.log('[Version] Service worker update detected');
      setNewVersionAvailable(true);
    };

    window.addEventListener('sw-update-available', handleSWUpdate);

    // Check for updates when tab becomes visible
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('[Version] Tab visible, checking for updates');
        checkVersion();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('sw-update-available', handleSWUpdate);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    console.log('[Version] Starting update process...');

    try {
      // Step 1: Unregister all service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        console.log(`[Version] Found ${registrations.length} service worker(s) to unregister`);

        for (const registration of registrations) {
          await registration.unregister();
          console.log('[Version] Service worker unregistered');
        }
      }

      // Step 2: Clear all caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        console.log(`[Version] Clearing ${cacheNames.length} cache(s)`);
        await Promise.all(cacheNames.map(name => caches.delete(name)));
        console.log('[Version] All caches cleared');
      }

      // Step 3: Hard reload the page
      console.log('[Version] Performing hard reload...');
      window.location.reload();
    } catch (error) {
      console.error('[Version] Update failed:', error);
      setIsRefreshing(false);
      alert('Update failed. Please try refreshing manually (Cmd/Ctrl + Shift + R)');
    }
  };

  if (!newVersionAvailable) {
    return null;
  }

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] animate-in slide-in-from-top duration-300">
      <div className="bg-gradient-to-r from-blue-600 to-emerald-600 text-white rounded-lg shadow-2xl p-4 flex items-center gap-4 max-w-md">
        <AlertCircle className="w-6 h-6 flex-shrink-0" />
        <div className="flex-1">
          <p className="font-semibold text-sm">New Version Available!</p>
          <p className="text-xs opacity-90">A newer version of AI Rocket is ready.</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 bg-white text-blue-600 px-4 py-2 rounded-lg font-medium text-sm hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Updating...' : 'Update Now'}
        </button>
      </div>
    </div>
  );
};
