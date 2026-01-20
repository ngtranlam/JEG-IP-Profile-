import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import axios from 'axios';
import { Proxy, ProxyValidationResult } from '../../shared/types';
import { DatabaseManager } from '../database/DatabaseManager';

export class ProxyManager {
  constructor(private db: DatabaseManager) {}

  async createProxy(proxyData: Omit<Proxy, 'id' | 'created_at' | 'updated_at'>): Promise<Proxy> {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    // Encrypt password if provided
    let encryptedPassword = proxyData.password;
    if (encryptedPassword) {
      encryptedPassword = this.encryptPassword(encryptedPassword);
    }

    const proxy: Proxy = {
      id,
      name: proxyData.name,
      type: proxyData.type,
      host: proxyData.host,
      port: proxyData.port,
      username: proxyData.username,
      password: encryptedPassword,
      change_ip_url: proxyData.change_ip_url,
      current_ip: proxyData.current_ip,
      country: proxyData.country,
      city: proxyData.city,
      timezone: proxyData.timezone,
      isp: proxyData.isp,
      status: proxyData.status || 'active',
      created_at: now,
      updated_at: now,
      last_checked: proxyData.last_checked,
    };

    // Save to database
    const sql = `
      INSERT INTO proxies (
        id, name, type, host, port, username, password, change_ip_url,
        current_ip, country, city, timezone, isp, status, created_at, updated_at, last_checked
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await this.db.runQuery(sql, [
      proxy.id, proxy.name, proxy.type, proxy.host, proxy.port,
      proxy.username, proxy.password, proxy.change_ip_url,
      proxy.current_ip, proxy.country, proxy.city, proxy.timezone,
      proxy.isp, proxy.status, proxy.created_at, proxy.updated_at, proxy.last_checked,
    ]);

    console.log(`Created proxy: ${proxy.name} (${proxy.id})`);
    return this.decryptProxyPassword(proxy);
  }

  async updateProxy(id: string, updates: Partial<Proxy>): Promise<Proxy> {
    const existingProxy = await this.getProxy(id);
    if (!existingProxy) {
      throw new Error(`Proxy with id ${id} not found`);
    }

    // Encrypt password if being updated
    let encryptedPassword = updates.password;
    if (encryptedPassword && encryptedPassword !== existingProxy.password) {
      encryptedPassword = this.encryptPassword(encryptedPassword);
    }

    const updatedProxy: Proxy = {
      ...existingProxy,
      ...updates,
      id, // Ensure id cannot be changed
      password: encryptedPassword || existingProxy.password,
      updated_at: new Date().toISOString(),
    };

    const sql = `
      UPDATE proxies SET 
        name = ?, type = ?, host = ?, port = ?, username = ?, password = ?,
        change_ip_url = ?, current_ip = ?, country = ?, city = ?, timezone = ?,
        isp = ?, status = ?, updated_at = ?, last_checked = ?
      WHERE id = ?
    `;

    await this.db.runQuery(sql, [
      updatedProxy.name, updatedProxy.type, updatedProxy.host, updatedProxy.port,
      updatedProxy.username, updatedProxy.password, updatedProxy.change_ip_url,
      updatedProxy.current_ip, updatedProxy.country, updatedProxy.city,
      updatedProxy.timezone, updatedProxy.isp, updatedProxy.status,
      updatedProxy.updated_at, updatedProxy.last_checked, id,
    ]);

    console.log(`Updated proxy: ${updatedProxy.name} (${id})`);
    return this.decryptProxyPassword(updatedProxy);
  }

  async deleteProxy(id: string): Promise<void> {
    const proxy = await this.getProxy(id);
    if (!proxy) {
      throw new Error(`Proxy with id ${id} not found`);
    }

    // Check if any profiles are using this proxy
    const profilesUsingProxy = await this.db.allQuery(
      'SELECT id, name FROM profiles WHERE proxy_id = ?',
      [id]
    );

    if (profilesUsingProxy.length > 0) {
      const profileNames = profilesUsingProxy.map(p => p.name).join(', ');
      throw new Error(`Cannot delete proxy. It is being used by profiles: ${profileNames}`);
    }

    await this.db.runQuery('DELETE FROM proxies WHERE id = ?', [id]);
    console.log(`Deleted proxy: ${proxy.name} (${id})`);
  }

  async getProxy(id: string): Promise<Proxy | null> {
    const row = await this.db.getQuery('SELECT * FROM proxies WHERE id = ?', [id]);
    
    if (!row) return null;

    const proxy: Proxy = {
      id: row.id,
      name: row.name,
      type: row.type,
      host: row.host,
      port: row.port,
      username: row.username,
      password: row.password,
      change_ip_url: row.change_ip_url,
      current_ip: row.current_ip,
      country: row.country,
      city: row.city,
      timezone: row.timezone,
      isp: row.isp,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      last_checked: row.last_checked,
    };

    return this.decryptProxyPassword(proxy);
  }

  async listProxies(): Promise<Proxy[]> {
    const rows = await this.db.allQuery('SELECT * FROM proxies ORDER BY created_at DESC');
    
    return rows.map(row => {
      const proxy: Proxy = {
        id: row.id,
        name: row.name,
        type: row.type,
        host: row.host,
        port: row.port,
        username: row.username,
        password: row.password,
        change_ip_url: row.change_ip_url,
        current_ip: row.current_ip,
        country: row.country,
        city: row.city,
        timezone: row.timezone,
        isp: row.isp,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
        last_checked: row.last_checked,
      };
      
      return this.decryptProxyPassword(proxy);
    });
  }

  async validateProxy(id: string): Promise<ProxyValidationResult> {
    const proxy = await this.getProxy(id);
    if (!proxy) {
      return { success: false, error: 'Proxy not found' };
    }

    try {
      // Create proxy configuration for axios
      const proxyConfig = {
        protocol: proxy.type,
        host: proxy.host,
        port: proxy.port,
        auth: proxy.username && proxy.password ? {
          username: proxy.username,
          password: proxy.password,
        } : undefined,
      };

      // Test proxy by making a request to a IP checking service
      const response = await axios.get('https://httpbin.org/ip', {
        proxy: proxyConfig,
        timeout: 10000,
      });

      const currentIp = response.data.origin;
      
      // Get location info for the IP
      const locationResponse = await axios.get(`http://ip-api.com/json/${currentIp}`);
      const locationData = locationResponse.data;

      const result: ProxyValidationResult = {
        success: true,
        ip: currentIp,
        country: locationData.countryCode,
        city: locationData.city,
        timezone: locationData.timezone,
        isp: locationData.isp,
      };

      // Update proxy with current information
      await this.updateProxy(id, {
        current_ip: currentIp,
        country: locationData.countryCode,
        city: locationData.city,
        timezone: locationData.timezone,
        isp: locationData.isp,
        status: 'active',
        last_checked: new Date().toISOString(),
      });

      console.log(`Proxy validation successful: ${proxy.name} - IP: ${currentIp}`);
      return result;

    } catch (error) {
      console.error(`Proxy validation failed for ${proxy.name}:`, error);
      
      // Update proxy status to error
      await this.updateProxy(id, {
        status: 'error',
        last_checked: new Date().toISOString(),
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async testProxyConfig(config: { host: string; port: number; username?: string; password?: string }): Promise<{
    http?: { success: boolean; ip?: string; country?: string; city?: string; ping?: number; error?: string };
    socks5?: { success: boolean; ip?: string; country?: string; city?: string; ping?: number; error?: string };
    socks4?: { success: boolean; ip?: string; country?: string; city?: string; ping?: number; error?: string };
  }> {
    const results: any = {};
    const types = ['http', 'socks5', 'socks4'];

    for (const type of types) {
      try {
        const startTime = Date.now();
        
        const proxyConfig = {
          protocol: type,
          host: config.host,
          port: config.port,
          auth: config.username && config.password ? {
            username: config.username,
            password: config.password,
          } : undefined,
        };

        // Test proxy by making a request to IP checking service
        const response = await axios.get('https://httpbin.org/ip', {
          proxy: proxyConfig,
          timeout: 10000,
        });

        const currentIp = response.data.origin;
        const ping = Date.now() - startTime;
        
        // Get location info for the IP
        const locationResponse = await axios.get(`http://ip-api.com/json/${currentIp}`, { timeout: 5000 });
        const locationData = locationResponse.data;

        results[type] = {
          success: true,
          ip: currentIp,
          country: locationData.countryCode,
          city: locationData.city,
          ping: ping,
        };

        console.log(`Proxy test successful for ${type.toUpperCase()}: ${currentIp} (${ping}ms)`);

      } catch (error) {
        console.error(`Proxy test failed for ${type.toUpperCase()}:`, error);
        results[type] = {
          success: false,
          error: error instanceof Error ? error.message : 'Connection failed',
        };
      }
    }

    return results;
  }

  async rotateIP(id: string): Promise<ProxyValidationResult> {
    const proxy = await this.getProxy(id);
    if (!proxy) {
      return { success: false, error: 'Proxy not found' };
    }

    if (!proxy.change_ip_url) {
      return { success: false, error: 'No IP rotation URL configured for this proxy' };
    }

    try {
      // Call the IP rotation endpoint
      await axios.get(proxy.change_ip_url, { timeout: 30000 });
      
      // Wait a moment for the IP to change
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Validate the new IP
      return await this.validateProxy(id);

    } catch (error) {
      console.error(`IP rotation failed for ${proxy.name}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'IP rotation failed',
      };
    }
  }

  private encryptPassword(password: string): string {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync('chrome-profile-tool-secret', 'salt', 32);
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipher(algorithm, key);
    let encrypted = cipher.update(password, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  }

  private decryptPassword(encryptedPassword: string): string {
    try {
      const algorithm = 'aes-256-cbc';
      const key = crypto.scryptSync('chrome-profile-tool-secret', 'salt', 32);
      
      const parts = encryptedPassword.split(':');
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      
      const decipher = crypto.createDecipher(algorithm, key);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Failed to decrypt password:', error);
      return encryptedPassword; // Return as-is if decryption fails
    }
  }

  private decryptProxyPassword(proxy: Proxy): Proxy {
    if (proxy.password) {
      return {
        ...proxy,
        password: this.decryptPassword(proxy.password),
      };
    }
    return proxy;
  }
}
