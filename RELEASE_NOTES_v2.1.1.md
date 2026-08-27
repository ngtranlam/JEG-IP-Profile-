# Release Notes v2.1.1

## 🎉 New Features & Improvements

### UI/UX Enhancements
- ✨ **Feature Lock Screen**: Added "Feature Temporarily Locked" screen for Proxy and Design Tools with orange gradient UI
- 🔍 **User Search**: Real-time search bar in Admin User Management (search by name, username, email, phone)
- 🐔 **Custom Loading Animation**: Replaced loading spinners with custom chicken GIF animation
- 🌍 **Country Flags**: Fixed flag display on Windows using `country-flag-icons` package (replaced emoji with images)

### Performance Optimizations
- ⚡ **Debounced Profile Loading**: Added 300ms debounce to prevent excessive API calls
- 🚀 **Reduced API Calls**: Optimized from 12+ redundant calls to only necessary requests
- 💾 **Smoother Search/Filter**: Input fields no longer lag during typing
- 🎯 **Smart Reload**: Immediate reload for actions (create/delete), debounced for search/filter

### Technical Improvements
- 🔧 **TypeScript Config**: Fixed `baseUrl` deprecation warning
- 🛠️ **Code Quality**: Better state management and cleanup on unmount
- 📝 **Documentation**: Added performance optimization guide

## 🐛 Bug Fixes
- Fixed input lag issue in Team Management and other forms
- Fixed country flag rendering on Windows
- Improved profile list re-render performance

## 🔒 Security & Stability
- DevTools only opens in development mode (disabled in production)
- Proper cleanup of timeouts and intervals
- Better error handling in profile operations

## 📦 Build Configuration
- ✅ GitHub Actions ready for automated builds (Windows & macOS)
- ✅ Production build excludes development tools
- ✅ All features tested and verified

## 🚀 Deployment
Ready to build via GitHub Actions:
- Push to `main` branch triggers build
- Create tag `v2.1.1` for release
- Artifacts: Windows EXE, macOS DMG

---

**Full Changelog**: https://github.com/ngtranlam/JEG-IP-Profile-/compare/v2.1.0...v2.1.1
