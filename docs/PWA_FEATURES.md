# PWA Features

## Overview
This Progressive Web App (PWA) provides offline capabilities and mobile-first experience for the OpenPulse hospital project management platform.

## PWA Features

### 🚀 Service Worker
- **Precaching**: Static assets cached automatically
- **Runtime caching**: API responses and images cached intelligently
- **Update notifications**: Users notified when new version is available
- **Offline support**: Core functionality works without internet

### 📱 Web App Manifest
- **Installation**: Can be installed on mobile devices and desktop
- **Native-like experience**: Standalone display mode
- **Custom icons**: Branded app icons for all devices
- **Theme colors**: Consistent branding across platforms

### 🔄 Caching Strategies

#### Network First
- **Supabase API**: Fresh data when online, cached fallback when offline
- **Cache duration**: 24 hours
- **Max entries**: 100 requests

#### Cache First
- **Images**: Cached for 30 days, max 50 entries
- **Fonts**: Cached for 1 year, max 10 entries

#### Stale While Revalidate
- **CSS/JS**: Always show cached version, update in background

### 📊 Performance Metrics

#### Lighthouse Scores (Target)
- **Performance**: ≥ 80%
- **Accessibility**: ≥ 90%
- **Best Practices**: ≥ 90%
- **SEO**: ≥ 80%
- **PWA**: ≥ 80%

### 🛠️ Development

#### Local Testing
```bash
# Build the app
npm run build

# Serve with PWA features
npm run preview

# Test PWA features in Chrome DevTools
# Application > Service Workers
# Application > Storage (Cache Storage)
```

#### Production Deploy
PWA features are automatically enabled in production builds.

## Browser Support

### PWA Installation
- ✅ Chrome/Edge: Full support
- ✅ Firefox: Partial support
- ✅ Safari: iOS 16.4+ support
- ✅ Samsung Internet: Full support

### Service Worker Support
- ✅ All modern browsers
- ✅ iOS Safari 11.1+
- ✅ Chrome 45+
- ✅ Firefox 44+

## Usage Patterns

### Online Experience
1. Fast loading with precached assets
2. Real-time data from Supabase
3. Immediate updates and sync

### Offline Experience
1. Core UI remains functional
2. Cached data available for browsing
3. Updates queued for when online
4. User notified of offline status

### Update Process
1. Service Worker detects new version
2. User receives notification
3. User can update immediately or continue
4. Seamless update with no data loss

## Monitoring

### Performance Tracking
- Lighthouse CI in GitHub Actions
- Build-time bundle analysis
- Runtime performance metrics

### User Experience
- Update notifications via toast
- Offline/online status indicators
- Cache status visibility in DevTools