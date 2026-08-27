# Release Notes v3.1.0

## 🔒 Security Improvements
- **Fixed Firebase Key Exposure**: Removed exposed Firebase service account key from Git history
- **GitHub Secrets Integration**: Firebase credentials now securely managed via GitHub Secrets
- **Enhanced .gitignore**: Added comprehensive patterns to prevent future credential leaks

## 🎉 Features & Improvements (from v2.1.1)
- ✨ **Feature Lock Screen**: Professional "Feature Temporarily Locked" UI for Proxy and Design Tools
- 🔍 **User Search**: Real-time search in Admin User Management (name, username, email, phone)
- 🐔 **Custom Loading Animation**: Branded chicken GIF loading indicator
- 🌍 **Country Flags**: Fixed flag display on Windows using country-flag-icons package

## ⚡ Performance Optimizations
- **Debounced Profile Loading**: 300ms debounce prevents excessive API calls
- **Reduced API Calls**: Optimized from 12+ redundant calls to only necessary requests
- **Smoother Input**: Fixed lag in search fields and forms
- **Smart Reload Strategy**: Immediate reload for actions, debounced for search/filter

## 🐛 Bug Fixes
- Fixed input lag issue in Team Management and forms
- Fixed country flag rendering on Windows
- Improved profile list re-render performance
- Resolved Firebase authentication issues with new service account key

## 🔧 Technical Changes
- Updated Firebase service account key (old key revoked)
- Build process now uses GitHub Secrets for sensitive credentials
- DevTools disabled in production builds
- Improved cleanup of timeouts and intervals

## 📦 Build & Deployment
- ✅ Automated builds via GitHub Actions (Windows & macOS)
- ✅ Secure credential management
- ✅ Production-ready configuration

## 🚀 Upgrade Notes
- This version uses a new Firebase service account key
- Old Firebase key has been revoked for security
- No action required for end users - seamless upgrade

---

**Full Changelog**: https://github.com/ngtranlam/JEG-IP-Profile-/compare/v2.1.0...v3.1.0
