import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import { Profile, ProfileFingerprint } from '../../shared/types';
import { DatabaseManager } from '../database/DatabaseManager';
import { FingerprintGenerator } from '../utils/FingerprintGenerator';

export class ProfileManager {
  private profilesDir: string;

  constructor(private db: DatabaseManager) {
    const userDataPath = app.getPath('userData');
    this.profilesDir = path.join(userDataPath, 'profiles');
    
    // Ensure profiles directory exists
    if (!fs.existsSync(this.profilesDir)) {
      fs.mkdirSync(this.profilesDir, { recursive: true });
    }
  }

  async createProfile(profileData: Omit<Profile, 'id' | 'created_at' | 'updated_at'>): Promise<Profile> {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    // Create user data directory for this profile
    const userDataDir = path.join(this.profilesDir, id);
    if (!fs.existsSync(userDataDir)) {
      fs.mkdirSync(userDataDir, { recursive: true });
    }

    // Generate fingerprint if not provided
    let fingerprint = profileData.fingerprint;
    if (!fingerprint || Object.keys(fingerprint).length === 0) {
      fingerprint = FingerprintGenerator.generateFingerprint(id);
    }

    const profile: Profile = {
      id,
      name: profileData.name,
      proxy: profileData.proxy,
      user_data_dir: userDataDir,
      fingerprint,
      status: profileData.status || 'active',
      created_at: now,
      updated_at: now,
      last_used: profileData.last_used,
    };

    // Save to database
    const sql = `
      INSERT INTO profiles (
        id, name, proxy, user_data_dir, fingerprint, 
        status, created_at, updated_at, last_used
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await this.db.runQuery(sql, [
      profile.id,
      profile.name,
      profile.proxy ? JSON.stringify(profile.proxy) : null,
      profile.user_data_dir,
      JSON.stringify(profile.fingerprint),
      profile.status,
      profile.created_at,
      profile.updated_at,
      profile.last_used,
    ]);

    console.log(`Created profile: ${profile.name} (${profile.id})`);
    return profile;
  }

  async updateProfile(id: string, updates: Partial<Profile>): Promise<Profile> {
    const existingProfile = await this.getProfile(id);
    if (!existingProfile) {
      throw new Error(`Profile with id ${id} not found`);
    }

    const updatedProfile: Profile = {
      ...existingProfile,
      ...updates,
      id, // Ensure id cannot be changed
      updated_at: new Date().toISOString(),
    };

    const sql = `
      UPDATE profiles SET 
        name = ?, proxy = ?, fingerprint = ?, 
        status = ?, updated_at = ?, last_used = ?
      WHERE id = ?
    `;

    await this.db.runQuery(sql, [
      updatedProfile.name,
      updatedProfile.proxy ? JSON.stringify(updatedProfile.proxy) : null,
      JSON.stringify(updatedProfile.fingerprint),
      updatedProfile.status,
      updatedProfile.updated_at,
      updatedProfile.last_used,
      id,
    ]);

    console.log(`Updated profile: ${updatedProfile.name} (${id})`);
    return updatedProfile;
  }

  async deleteProfile(id: string): Promise<void> {
    const profile = await this.getProfile(id);
    if (!profile) {
      throw new Error(`Profile with id ${id} not found`);
    }

    // Delete from database
    await this.db.runQuery('DELETE FROM profiles WHERE id = ?', [id]);

    // Delete user data directory
    if (fs.existsSync(profile.user_data_dir)) {
      fs.rmSync(profile.user_data_dir, { recursive: true, force: true });
    }

    console.log(`Deleted profile: ${profile.name} (${id})`);
  }

  async getProfile(id: string): Promise<Profile | null> {
    const row = await this.db.getQuery('SELECT * FROM profiles WHERE id = ?', [id]);
    
    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      proxy: row.proxy ? JSON.parse(row.proxy) : undefined,
      user_data_dir: row.user_data_dir,
      fingerprint: JSON.parse(row.fingerprint),
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      last_used: row.last_used,
    };
  }

  async listProfiles(): Promise<Profile[]> {
    const rows = await this.db.allQuery('SELECT * FROM profiles ORDER BY created_at DESC');
    
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      proxy: row.proxy ? JSON.parse(row.proxy) : undefined,
      user_data_dir: row.user_data_dir,
      fingerprint: JSON.parse(row.fingerprint),
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      last_used: row.last_used,
    }));
  }

  async updateLastUsed(id: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db.runQuery(
      'UPDATE profiles SET last_used = ?, updated_at = ? WHERE id = ?',
      [now, now, id]
    );
  }
}
