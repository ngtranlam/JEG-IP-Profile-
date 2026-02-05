import * as sqlite3 from 'sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import { Profile, Proxy } from '../../shared/types';

export class DatabaseManager {
  private db: sqlite3.Database | null = null;
  private dbPath: string;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.dbPath = path.join(userDataPath, 'chrome-profile-tool.db');
  }

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Ensure the directory exists
      const dbDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Error opening database:', err);
          reject(err);
          return;
        }
        
        console.log('Connected to SQLite database at:', this.dbPath);
        this.createTables().then(resolve).catch(reject);
      });
    });
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Migration: Recreate profiles table without platform column
    try {
      // Check if old table exists and has platform column
      const tableInfo = await this.runQuery("PRAGMA table_info(profiles)");
      const hasPlatformColumn = tableInfo.some((col: any) => col.name === 'platform');
      
      if (hasPlatformColumn) {
        console.log('Migrating profiles table to remove platform column...');
        
        // Create new table with correct schema
        await this.runQuery(`
          CREATE TABLE profiles_new (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            proxy TEXT,
            user_data_dir TEXT NOT NULL,
            fingerprint TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'archived')),
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            last_used TEXT
          )
        `);
        
        // Copy data from old table (excluding platform column)
        await this.runQuery(`
          INSERT INTO profiles_new (id, name, proxy, user_data_dir, fingerprint, status, created_at, updated_at, last_used)
          SELECT id, name, NULL as proxy, user_data_dir, fingerprint, status, created_at, updated_at, last_used
          FROM profiles
        `);
        
        // Drop old table and rename new one
        await this.runQuery('DROP TABLE profiles');
        await this.runQuery('ALTER TABLE profiles_new RENAME TO profiles');
        
        console.log('Successfully migrated profiles table');
      }
    } catch (error: any) {
      console.log('Migration skipped or failed:', error.message);
    }

    const createProfilesTable = `
      CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        proxy TEXT,
        user_data_dir TEXT NOT NULL,
        fingerprint TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'archived')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_used TEXT
      )
    `;

    const createProxiesTable = `
      CREATE TABLE IF NOT EXISTS proxies (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('http', 'https', 'socks4', 'socks5')),
        host TEXT NOT NULL,
        port INTEGER NOT NULL,
        username TEXT,
        password TEXT,
        change_ip_url TEXT,
        current_ip TEXT,
        country TEXT,
        city TEXT,
        timezone TEXT,
        isp TEXT,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_checked TEXT
      )
    `;

    return new Promise((resolve, reject) => {
      this.db!.serialize(() => {
        this.db!.run(createProxiesTable, (err) => {
          if (err) {
            console.error('Error creating proxies table:', err);
            reject(err);
            return;
          }
        });

        this.db!.run(createProfilesTable, async (err) => {
          if (err) {
            console.error('Error creating profiles table:', err);
            reject(err);
            return;
          }
          

          console.log('Database tables created successfully');
          resolve();
        });
      });
    });
  }

  async runQuery(sql: string, params: any[] = []): Promise<any> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db!.run(sql, params, function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  async getQuery(sql: string, params: any[] = []): Promise<any> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db!.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(row);
      });
    });
  }

  async allQuery(sql: string, params: any[] = []): Promise<any[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      this.db!.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows);
      });
    });
  }

  async close(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      this.db!.close((err) => {
        if (err) {
          reject(err);
          return;
        }
        console.log('Database connection closed');
        resolve();
      });
    });
  }
}
