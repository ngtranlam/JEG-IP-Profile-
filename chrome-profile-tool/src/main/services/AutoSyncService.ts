import { ApiService } from './ApiService';
import { AuthService } from './AuthService';

export class AutoSyncService {
  private apiService: ApiService;
  private authService: AuthService;
  private syncInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private syncIntervalMs: number = 5 * 60 * 1000; // 5 minutes

  constructor(apiService: ApiService, authService: AuthService) {
    this.apiService = apiService;
    this.authService = authService;
  }

  /**
   * Start auto-sync service
   */
  start(): void {
    if (this.isRunning) {
      console.log('AutoSyncService is already running');
      return;
    }

    console.log('Starting AutoSyncService - will sync every 5 minutes');
    this.isRunning = true;

    // Run initial sync
    this.performSync();

    // Set up interval for periodic sync
    this.syncInterval = setInterval(() => {
      this.performSync();
    }, this.syncIntervalMs);
  }

  /**
   * Stop auto-sync service
   */
  stop(): void {
    if (!this.isRunning) {
      console.log('AutoSyncService is not running');
      return;
    }

    console.log('Stopping AutoSyncService');
    this.isRunning = false;

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Perform sync operation
   */
  private async performSync(): Promise<void> {
    try {
      const token = this.authService.getCurrentToken();
      
      if (!token) {
        console.log('AutoSync: No authentication token, skipping sync');
        return;
      }

      console.log('AutoSync: Starting sync from GoLogin to database...');
      const startTime = Date.now();

      const result = await this.apiService.syncGoLoginData(token, 'full');
      
      const duration = Date.now() - startTime;
      console.log(`AutoSync: Completed in ${duration}ms`, {
        folders: result.folders_synced,
        profiles: result.profiles_synced,
      });

    } catch (error) {
      console.error('AutoSync: Failed to sync data:', error);
    }
  }

  /**
   * Manually trigger sync
   */
  async triggerManualSync(): Promise<any> {
    console.log('AutoSync: Manual sync triggered');
    const token = this.authService.getCurrentToken();
    
    if (!token) {
      throw new Error('Not authenticated');
    }

    return await this.apiService.syncGoLoginData(token, 'full');
  }

  /**
   * Check if auto-sync is running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Get sync interval in milliseconds
   */
  getSyncInterval(): number {
    return this.syncIntervalMs;
  }

  /**
   * Set sync interval (in minutes)
   */
  setSyncInterval(minutes: number): void {
    if (minutes < 1) {
      throw new Error('Sync interval must be at least 1 minute');
    }

    this.syncIntervalMs = minutes * 60 * 1000;
    console.log(`AutoSync: Interval updated to ${minutes} minutes`);

    // Restart if currently running
    if (this.isRunning) {
      this.stop();
      this.start();
    }
  }
}
