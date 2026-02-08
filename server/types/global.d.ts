// Global types for server-side environment (avoid depending on DOM lib)
declare global {
  interface PushSubscription {
    endpoint: string;
    expirationTime?: number | null;
    keys: {
      p256dh: string;
      auth: string;
    };
  }
}

export {};
