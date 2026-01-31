// Simple Web2 Authentication Service for LI.FI Agents Orchestrator

export interface User {
  id: string;
  username: string;
  isGuest: boolean;
  createdAt: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}

class AuthService {
  private readonly STORAGE_KEY = 'lifi_agents_user';
  private readonly USERS_KEY = 'lifi_agents_users';

  // Get current authenticated user
  getCurrentUser(): User | null {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading user:', error);
    }
    return null;
  }

  // Login with username and password
  async login(username: string, password: string): Promise<{ success: boolean; error?: string; user?: User }> {
    try {
      const users = this.getStoredUsers();
      const user = users.find(u => u.username === username && u.password === password);

      if (user) {
        const authUser: User = {
          id: user.id,
          username: user.username,
          isGuest: false,
          createdAt: user.createdAt
        };
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(authUser));
        return { success: true, user: authUser };
      }

      return { success: false, error: 'Invalid username or password' };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Login failed' };
    }
  }

  // Register new user
  async register(username: string, password: string): Promise<{ success: boolean; error?: string; user?: User }> {
    try {
      // Validate username
      if (username.length < 3) {
        return { success: false, error: 'Username must be at least 3 characters' };
      }
      if (password.length < 6) {
        return { success: false, error: 'Password must be at least 6 characters' };
      }

      const users = this.getStoredUsers();
      
      // Check if username already exists
      if (users.some(u => u.username === username)) {
        return { success: false, error: 'Username already exists' };
      }

      // Create new user
      const newUser = {
        id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        username,
        password, // In production, this should be hashed
        createdAt: new Date().toISOString()
      };

      users.push(newUser);
      localStorage.setItem(this.USERS_KEY, JSON.stringify(users));

      const authUser: User = {
        id: newUser.id,
        username: newUser.username,
        isGuest: false,
        createdAt: newUser.createdAt
      };

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(authUser));
      return { success: true, user: authUser };
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: 'Registration failed' };
    }
  }

  // Login as guest
  async loginAsGuest(): Promise<{ success: boolean; user: User }> {
    const guestUser: User = {
      id: `guest_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      username: `Guest_${Math.random().toString(36).substring(2, 7)}`,
      isGuest: true,
      createdAt: new Date().toISOString()
    };

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(guestUser));
    return { success: true, user: guestUser };
  }

  // Logout
  logout(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  // Get stored users (private helper)
  private getStoredUsers(): Array<{ id: string; username: string; password: string; createdAt: string }> {
    try {
      const stored = localStorage.getItem(this.USERS_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
    return [];
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return this.getCurrentUser() !== null;
  }
}

export const authService = new AuthService();
