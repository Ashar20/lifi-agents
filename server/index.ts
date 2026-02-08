// LI.FI Agents Background Monitoring Server
// Runs independently - monitors yields and arbitrage even when browser is closed

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { BackgroundMonitor } from './monitor';
import { NotificationService } from './notifications';

const app = express();
const httpServer = createServer(app);
const io = new SocketServer(httpServer, {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:5173', 'https://lifi-agents.vercel.app/'],
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(express.json());

// Store for registered users
interface RegisteredUser {
  walletAddress: string;
  email?: string;
  pushSubscription?: PushSubscription;
  settings: {
    yieldAlerts: boolean;
    arbitrageAlerts: boolean;
    minApyImprovement: number;
    minArbProfit: number;
    autoExecute: boolean;
  };
  lastNotified: number;
}

const registeredUsers: Map<string, RegisteredUser> = new Map();

// Initialize services
const notificationService = new NotificationService();
const backgroundMonitor = new BackgroundMonitor(
  registeredUsers,
  notificationService,
  io
);

// API Routes

// Register for notifications
app.post('/api/register', (req, res) => {
  const { walletAddress, email, pushSubscription, settings } = req.body;
  
  if (!walletAddress) {
    return res.status(400).json({ error: 'Wallet address required' });
  }
  
  registeredUsers.set(walletAddress.toLowerCase(), {
    walletAddress: walletAddress.toLowerCase(),
    email,
    pushSubscription,
    settings: {
      yieldAlerts: settings?.yieldAlerts ?? true,
      arbitrageAlerts: settings?.arbitrageAlerts ?? true,
      minApyImprovement: settings?.minApyImprovement ?? 2,
      minArbProfit: settings?.minArbProfit ?? 5,
      autoExecute: settings?.autoExecute ?? false,
    },
    lastNotified: 0,
  });
  
  console.log(`[Server] Registered user: ${walletAddress}`);
  res.json({ success: true, message: 'Registered for notifications' });
});

// Unregister
app.post('/api/unregister', (req, res) => {
  const { walletAddress } = req.body;
  
  if (walletAddress) {
    registeredUsers.delete(walletAddress.toLowerCase());
    console.log(`[Server] Unregistered user: ${walletAddress}`);
  }
  
  res.json({ success: true });
});

// Update settings
app.post('/api/settings', (req, res) => {
  const { walletAddress, settings } = req.body;
  
  const user = registeredUsers.get(walletAddress?.toLowerCase());
  if (user) {
    user.settings = { ...user.settings, ...settings };
    res.json({ success: true, settings: user.settings });
  } else {
    res.status(404).json({ error: 'User not registered' });
  }
});

// Get current opportunities
app.get('/api/opportunities', async (req, res) => {
  try {
    const opportunities = await backgroundMonitor.getCurrentOpportunities();
    res.json(opportunities);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get server status
app.get('/api/status', (req, res) => {
  res.json({
    status: 'running',
    registeredUsers: registeredUsers.size,
    monitorStats: backgroundMonitor.getStats(),
    uptime: process.uptime(),
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// WebSocket for real-time updates
io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);
  
  socket.on('subscribe', (walletAddress: string) => {
    socket.join(walletAddress.toLowerCase());
    console.log(`[Socket] ${socket.id} subscribed to ${walletAddress}`);
  });
  
  socket.on('unsubscribe', (walletAddress: string) => {
    socket.leave(walletAddress.toLowerCase());
  });
  
  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

// Start server
const PORT = process.env.PORT || 3001;

httpServer.listen(PORT,"0.0.0.0", () => {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║     🤖 LI.FI AGENTS BACKGROUND MONITOR                 ║');
  console.log('╠════════════════════════════════════════════════════════╣');
  console.log(`║  Server running on http://localhost:${PORT}              ║`);
  console.log('║  Monitoring yields and arbitrage 24/7                  ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log('');
  
  // Start background monitoring
  backgroundMonitor.start();
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Server] Shutting down...');
  backgroundMonitor.stop();
  httpServer.close(() => {
    console.log('[Server] Goodbye!');
    process.exit(0);
  });
});
