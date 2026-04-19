'use client';

import { useEffect } from 'react';

export function PwaRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });

        void registration.update().catch(() => undefined);
      } catch {
        return;
      }
    };

    void registerServiceWorker();
  }, []);

  return null;
}
