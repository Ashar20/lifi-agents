// Background Service Client - Connects to the monitoring server
// Handles push notification registration and real-time updates

import { io, Socket } from 'socket.io-client';

const SERVER_URL = 'http://localhost:3001';

export interface NotificationSettings {
  yieldAlerts: boolean;
  arbitrageAlerts: boolean;
  minApyImprovement: number;
  minArbProfit: number;
  autoExecute: boolean;
  email?: string;
}

export interface ServerStatus {
  status: string;
  registeredUsers: number;
  monitorStats: {
    isRunning: boolean;
    lastYieldScan: number | null;
    lastArbScan: number | null;
    yieldScans: number;
    arbScans: number;
    notificationsSent: number;
  };
  uptime: number;
}

class BackgroundService {
  private socket: Socket | null = null;
  private walletAddress: string | null = null;
  private pushSubscription: PushSubscription | null = null;
  private onNotification: ((notification: any) => void) | null = null;
  private onYieldUpdate: ((yields: any[]) => void) | null = null;
  private onArbUpdate: ((arbs: any[]) => void) | null = null;

  // Initialize connection to background server
  async connect(walletAddress: string): Promise<boolean> {
    if (this.socket?.connected && this.walletAddress === walletAddress) {
      return true;
    }

    this.walletAddress = walletAddress;

    try {
      // Connect to WebSocket
      this.socket = io(SERVER_URL, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
      });

      return new Promise((resolve) => {
        this.socket!.on('connect', () => {
          console.log('[BackgroundService] Connected to server');
          this.socket!.emit('subscribe', walletAddress);
          resolve(true);
        });

        this.socket!.on('connect_error', (error) => {
          console.error('[BackgroundService] Connection error:', error);
          resolve(false);
        });

        // Listen for real-time updates
        this.socket!.on('notification', (data) => {
          console.log('[BackgroundService] Notification:', data);
          this.onNotification?.(data);
        });

        this.socket!.on('yields:update', (data) => {
          console.log('[BackgroundService] Yields update:', data.length);
          this.onYieldUpdate?.(data);
        });

        this.socket!.on('arbitrage:update', (data) => {
          console.log('[BackgroundService] Arbitrage update:', data.length);
          this.onArbUpdate?.(data);
        });

        // Timeout after 5 seconds
        setTimeout(() => resolve(false), 5000);
      });
    } catch (error) {
      console.error('[BackgroundService] Connect error:', error);
      return false;
    }
  }

  // Disconnect from server
  disconnect(): void {
    if (this.socket) {
      if (this.walletAddress) {
        this.socket.emit('unsubscribe', this.walletAddress);
      }
      this.socket.disconnect();
      this.socket = null;
    }
    this.walletAddress = null;
  }

  // Register for notifications
  async register(
    walletAddress: string,
    settings: NotificationSettings
  ): Promise<boolean> {
    try {
      // Get push subscription if supported
      let pushSub = null;
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        pushSub = await this.subscribeToPush();
      }

      const response = await fetch(`${SERVER_URL}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          email: settings.email,
          pushSubscription: pushSub,
          settings,
        }),
      });

      if (!response.ok) {
        throw new Error('Registration failed');
      }

      // Connect to WebSocket for real-time updates
      await this.connect(walletAddress);

      console.log('[BackgroundService] Registered for notifications');
      return true;
    } catch (error) {
      console.error('[BackgroundService] Registration error:', error);
      return false;
    }
  }

  // Unregister from notifications
  async unregister(walletAddress: string): Promise<void> {
    try {
      await fetch(`${SERVER_URL}/api/unregister`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress }),
      });

      // Unsubscribe from push
      if (this.pushSubscription) {
        await this.pushSubscription.unsubscribe();
        this.pushSubscription = null;
      }

      this.disconnect();
    } catch (error) {
      console.error('[BackgroundService] Unregister error:', error);
    }
  }

  // Update notification settings
  async updateSettings(
    walletAddress: string,
    settings: Partial<NotificationSettings>
  ): Promise<boolean> {
    try {
      const response = await fetch(`${SERVER_URL}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, settings }),
      });

      return response.ok;
    } catch (error) {
      console.error('[BackgroundService] Update settings error:', error);
      return false;
    }
  }

  // Get server status
  async getStatus(): Promise<ServerStatus | null> {
    try {
      const response = await fetch(`${SERVER_URL}/api/status`);
      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      console.error('[BackgroundService] Status error:', error);
      return null;
    }
  }

  // Get current opportunities from server
  async getOpportunities(): Promise<{ yields: any[]; arbitrage: any[] } | null> {
    try {
      const response = await fetch(`${SERVER_URL}/api/opportunities`);
      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      console.error('[BackgroundService] Opportunities error:', error);
      return null;
    }
  }

  // Subscribe to Web Push notifications
  private async subscribeToPush(): Promise<PushSubscription | null> {
    try {
      // Register service worker
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('[BackgroundService] Service worker registered');

      // Wait for service worker to be ready
      await navigator.serviceWorker.ready;

      // Check permission
      let permission = Notification.permission;
      if (permission === 'default') {
        permission = await Notification.requestPermission();
      }

      if (permission !== 'granted') {
        console.log('[BackgroundService] Notification permission denied');
        return null;
      }

      // Get VAPID public key from server
      // For now, use the hardcoded one
      const vapidPublicKey = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(vapidPublicKey),
      });

      this.pushSubscription = subscription;
      console.log('[BackgroundService] Push subscription created');

      return subscription;
    } catch (error) {
      console.error('[BackgroundService] Push subscription error:', error);
      return null;
    }
  }

  // Convert VAPID key to Uint8Array
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // Set callback handlers
  setOnNotification(callback: (notification: any) => void): void {
    this.onNotification = callback;
  }

  setOnYieldUpdate(callback: (yields: any[]) => void): void {
    this.onYieldUpdate = callback;
  }

  setOnArbUpdate(callback: (arbs: any[]) => void): void {
    this.onArbUpdate = callback;
  }

  // Check if connected
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  // Check if server is running
  async isServerRunning(): Promise<boolean> {
    try {
      const response = await fetch(`${SERVER_URL}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Singleton instance
export const backgroundService = new BackgroundService();

// Export for debugging
if (typeof window !== 'undefined') {
  (window as any).backgroundService = backgroundService;
  console.log('%c📡 BACKGROUND SERVICE', 'color: #ff6600; font-weight: bold; font-size: 14px;');
  console.log('  backgroundService.register(address, settings) - Register for notifications');
  console.log('  backgroundService.getStatus() - Get server status');
  console.log('  backgroundService.isServerRunning() - Check if server is up');
}
