import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

interface AppManifestConfig {
  manifest: string
  appleIcon: string
  themeColor: string
}

const APP_MANIFESTS: Record<string, AppManifestConfig> = {
  '/m/mail': {
    manifest: '/manifest-mail.json',
    appleIcon: '/icons/app-mail-192.png',
    themeColor: '#3280DD',
  },
  '/m/pulse': {
    manifest: '/manifest-pulse.json',
    appleIcon: '/icons/app-pulse-192.png',
    themeColor: '#9065D0',
  },
  '/m/calendrier': {
    manifest: '/manifest-calendar.json',
    appleIcon: '/icons/app-calendar-192.png',
    themeColor: '#C3518E',
  },
  '/m/todos': {
    manifest: '/manifest-todos.json',
    appleIcon: '/icons/app-todos-192.png',
    themeColor: '#31983D',
  },
  '/m/jarvis': {
    manifest: '/manifest-jarvis.json',
    appleIcon: '/icons/app-jarvis-192.png',
    themeColor: '#0099AD',
  },
}

// Map install routes to their app paths
const INSTALL_ROUTE_MAP: Record<string, string> = {
  '/m/mail/install': '/m/mail',
  '/m/pulse/install': '/m/pulse',
  '/m/calendrier/install': '/m/calendrier',
  '/m/todos/install': '/m/todos',
  '/m/jarvis/install': '/m/jarvis',
}

/**
 * Hook to dynamically update the PWA manifest, apple-touch-icon, and theme-color
 * based on the current route. This allows each mobile app (/m/*) to be installed
 * as a separate PWA with its own icon and name.
 */
export function useDynamicManifest() {
  const location = useLocation()

  useEffect(() => {
    // Check for install route first, then app route
    const installAppPath = INSTALL_ROUTE_MAP[location.pathname]
    const appPath =
      installAppPath ||
      Object.keys(APP_MANIFESTS).find((path) => location.pathname.startsWith(path))

    const config = appPath ? APP_MANIFESTS[appPath] : null

    // Update the manifest link
    let manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement
    if (!manifestLink) {
      manifestLink = document.createElement('link')
      manifestLink.rel = 'manifest'
      document.head.appendChild(manifestLink)
    }
    manifestLink.href = config?.manifest || '/manifest.webmanifest'

    // Update the apple-touch-icon
    let appleIcon = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement
    if (!appleIcon) {
      appleIcon = document.createElement('link')
      appleIcon.rel = 'apple-touch-icon'
      document.head.appendChild(appleIcon)
    }
    appleIcon.href = config?.appleIcon || '/icons/icon-192x192.png'

    // Update the theme-color meta tag
    let themeColor = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement
    if (!themeColor) {
      themeColor = document.createElement('meta')
      themeColor.name = 'theme-color'
      document.head.appendChild(themeColor)
    }
    themeColor.content = config?.themeColor || '#CB5A1A'
  }, [location.pathname])
}
