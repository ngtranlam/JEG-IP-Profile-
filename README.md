# Chrome Profile Tool

A desktop application for managing Chrome browser profiles with anti-detection features, specifically designed for Etsy and TikTok Shop operations.

## Features

- **Profile Management**: Create and manage isolated Chrome profiles
- **Proxy Integration**: Support for HTTP/SOCKS proxies with rotation
- **Anti-Detection**: Fingerprint spoofing (Canvas, WebGL, User-Agent, etc.)
- **Real Chrome**: Uses actual Chrome browser via Playwright
- **Secure Storage**: Encrypted proxy credentials with SQLite database
- **Modern UI**: Clean dashboard built with React and TailwindCSS

## Tech Stack

- **Frontend**: React + TypeScript + TailwindCSS
- **Backend**: Electron + Node.js
- **Browser Automation**: Playwright
- **Database**: SQLite3
- **Encryption**: AES-256 for sensitive data

## Installation

### Prerequisites

- Node.js v18+ (tested with v24.2.0)
- npm or yarn
- Chrome browser (optional, will use Playwright's Chromium if not found)

### Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd chrome-profile-tool
```

2. Install dependencies:
```bash
npm install
```

3. Install Playwright browsers:
```bash
npx playwright install chromium
```

## Development

### Start Development Server

```bash
# Start both main and renderer processes
npm run dev

# Or start them separately:
npm run dev:main    # Electron main process
npm run dev:renderer # React development server
```

### Build for Production

```bash
# Build all components
npm run build

# Package the application
npm run package

# Create distributable packages
npm run package:dir
```

## Usage

### Creating Profiles

1. Navigate to the "Profiles" section
2. Click "New Profile"
3. Fill in profile details:
   - **Name**: Descriptive name for the profile
   - **Platform**: Choose Etsy or TikTok Shop
   - **Proxy**: Optional proxy assignment

### Managing Proxies

1. Go to "Proxies" section
2. Click "New Proxy"
3. Configure proxy settings:
   - **Type**: HTTP, HTTPS, SOCKS4, or SOCKS5
   - **Host/Port**: Proxy server details
   - **Authentication**: Username/password (optional)
   - **IP Rotation URL**: For mobile proxies (optional)

### Launching Profiles

1. In the Profiles list, click the "Play" button
2. Chrome will launch with the profile's configuration
3. The browser will have anti-detection features enabled

## Anti-Detection Features

### Fingerprint Spoofing

- **Canvas Fingerprinting**: Consistent noise injection
- **WebGL**: Vendor/Renderer spoofing
- **User-Agent**: Realistic browser signatures
- **Screen Resolution**: Configurable display settings
- **Timezone**: Auto-sync with proxy location
- **Fonts**: Controlled font enumeration

### Network Protection

- **WebRTC Blocking**: Prevents IP leaks
- **Proxy Integration**: Routes all traffic through configured proxy
- **DNS Over HTTPS**: Enhanced privacy

## Database Schema

### Profiles Table
```sql
CREATE TABLE profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  platform TEXT CHECK (platform IN ('ETSY', 'TIKTOK')),
  proxy_id TEXT,
  user_data_dir TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_used TEXT
);
```

### Proxies Table
```sql
CREATE TABLE proxies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('http', 'https', 'socks4', 'socks5')),
  host TEXT NOT NULL,
  port INTEGER NOT NULL,
  username TEXT,
  password TEXT, -- Encrypted with AES-256
  change_ip_url TEXT,
  current_ip TEXT,
  country TEXT,
  city TEXT,
  timezone TEXT,
  isp TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_checked TEXT
);
```

## Security

- **Encrypted Storage**: Proxy passwords are encrypted using AES-256
- **Local Data**: All data stored locally, no cloud sync
- **Isolated Profiles**: Each profile has separate user data directory
- **Secure IPC**: Context isolation between main and renderer processes

## Testing

### Fingerprint Validation

Test your profiles against detection services:

1. **Pixelscan.net**: Check for automation detection
2. **BrowserLeaks.com**: Verify WebRTC and fingerprint consistency
3. **AmIUnique.org**: Test browser uniqueness

### Proxy Validation

Use the built-in proxy validation:
1. Select a proxy in the Proxies list
2. Click the "Validate" button
3. Check IP location and connectivity

## Troubleshooting

### Common Issues

**Profile won't launch:**
- Check if Chrome is installed
- Verify proxy connectivity
- Check user data directory permissions

**Proxy validation fails:**
- Verify proxy credentials
- Check firewall settings
- Test proxy with external tools

**Database errors:**
- Check SQLite file permissions
- Verify user data directory access
- Restart the application

### Logs

Application logs are stored in:
- **macOS**: `~/Library/Logs/chrome-profile-tool/`
- **Windows**: `%APPDATA%/chrome-profile-tool/logs/`
- **Linux**: `~/.config/chrome-profile-tool/logs/`

## Roadmap

### Phase 1: MVP ✅
- Basic profile management
- Proxy integration
- Simple fingerprint spoofing
- React UI

### Phase 2: Enhanced Anti-Detection
- Advanced canvas fingerprinting
- Audio context spoofing
- Font fingerprint management
- Mobile proxy rotation

### Phase 3: Production Features
- Profile backup/restore
- Bulk operations
- Advanced logging
- Performance monitoring

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is for internal use only. Not for commercial distribution.

## Support

For issues and questions, please contact the development team.

---

**Version**: 1.0.0  
**Last Updated**: January 2026
