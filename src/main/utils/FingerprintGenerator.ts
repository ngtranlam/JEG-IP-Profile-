import * as crypto from 'crypto';
import { ProfileFingerprint } from '../../shared/types';

export class FingerprintGenerator {
  private static readonly USER_AGENTS = [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  ];

  private static readonly SCREEN_RESOLUTIONS = [
    { width: 1920, height: 1080 },
    { width: 1366, height: 768 },
    { width: 1536, height: 864 },
    { width: 1440, height: 900 },
    { width: 1280, height: 720 },
  ];

  private static readonly WEBGL_VENDORS = [
    'Intel Inc.',
    'NVIDIA Corporation',
    'AMD',
  ];

  private static readonly WEBGL_RENDERERS = [
    'Intel(R) UHD Graphics 630',
    'NVIDIA GeForce GTX 1060',
    'AMD Radeon RX 580',
    'Intel(R) Iris(TM) Plus Graphics',
  ];

  private static readonly COMMON_FONTS = [
    'Arial',
    'Helvetica',
    'Times New Roman',
    'Courier New',
    'Verdana',
    'Georgia',
    'Palatino',
    'Garamond',
    'Bookman',
    'Comic Sans MS',
    'Trebuchet MS',
    'Arial Black',
    'Impact',
  ];

  static generateFingerprint(profileId: string): ProfileFingerprint {
    // Use profile ID as seed for consistent fingerprint generation
    const seed = this.createSeed(profileId);
    
    return {
      canvas_seed: this.generateCanvasSeed(seed),
      webgl_vendor: this.selectFromArray(this.WEBGL_VENDORS, seed + 'vendor'),
      webgl_renderer: this.selectFromArray(this.WEBGL_RENDERERS, seed + 'renderer'),
      user_agent: this.selectFromArray(this.USER_AGENTS, seed + 'ua'),
      screen_resolution: this.selectFromArray(this.SCREEN_RESOLUTIONS, seed + 'screen'),
      timezone: 'America/New_York', // Will be updated based on proxy location
      locale: 'en-US',
      platform: 'MacIntel', // Default platform
      fonts: this.generateFontList(seed),
      audio_seed: this.generateAudioSeed(seed),
    };
  }

  private static createSeed(input: string): string {
    return crypto.createHash('md5').update(input).digest('hex');
  }

  private static selectFromArray<T>(array: T[], seed: string): T {
    const hash = crypto.createHash('md5').update(seed).digest('hex');
    const index = parseInt(hash.substring(0, 8), 16) % array.length;
    return array[index];
  }

  private static generateCanvasSeed(seed: string): string {
    // Generate a small, consistent noise value for canvas fingerprinting
    const hash = crypto.createHash('md5').update(seed + 'canvas').digest('hex');
    return hash.substring(0, 16);
  }

  private static generateAudioSeed(seed: string): string {
    // Generate a consistent seed for audio context fingerprinting
    const hash = crypto.createHash('md5').update(seed + 'audio').digest('hex');
    return hash.substring(0, 16);
  }

  private static generateFontList(seed: string): string[] {
    // Select a subset of fonts based on the seed
    const hash = crypto.createHash('md5').update(seed + 'fonts').digest('hex');
    const numFonts = 8 + (parseInt(hash.substring(0, 2), 16) % 5); // 8-12 fonts
    
    const selectedFonts: string[] = [];
    const availableFonts = [...this.COMMON_FONTS];
    
    for (let i = 0; i < numFonts && availableFonts.length > 0; i++) {
      const fontSeed = seed + 'font' + i;
      const fontIndex = this.selectFromArray(availableFonts, fontSeed);
      const selectedIndex = availableFonts.indexOf(fontIndex);
      selectedFonts.push(availableFonts.splice(selectedIndex, 1)[0]);
    }
    
    return selectedFonts;
  }

  static updateFingerprintForProxy(fingerprint: ProfileFingerprint, proxyCountry?: string, proxyTimezone?: string): ProfileFingerprint {
    const updated = { ...fingerprint };
    
    if (proxyTimezone) {
      updated.timezone = proxyTimezone;
    } else if (proxyCountry) {
      // Map common countries to timezones
      const countryTimezones: { [key: string]: string } = {
        'US': 'America/New_York',
        'CA': 'America/Toronto',
        'GB': 'Europe/London',
        'DE': 'Europe/Berlin',
        'FR': 'Europe/Paris',
        'JP': 'Asia/Tokyo',
        'AU': 'Australia/Sydney',
        'VN': 'Asia/Ho_Chi_Minh',
      };
      
      updated.timezone = countryTimezones[proxyCountry] || 'America/New_York';
    }
    
    return updated;
  }
}
