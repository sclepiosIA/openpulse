// Dynamic manifest injection based on current path
      // This runs BEFORE the browser preloads any manifest
      (function() {
        var path = window.location.pathname;
        var manifestMap = {
          '/m/mail': { manifest: '/manifest-mail.json', icon: '/icons/app-mail-192.png', color: '#3280DD' },
          '/m/pulse': { manifest: '/manifest-pulse.json', icon: '/icons/app-pulse-192.png', color: '#9065D0' },
          '/m/calendrier': { manifest: '/manifest-calendar.json', icon: '/icons/app-calendar-192.png', color: '#C3518E' },
          '/m/todos': { manifest: '/manifest-todos.json', icon: '/icons/app-todos-192.png', color: '#31983D' },
          '/m/jarvis': { manifest: '/manifest-jarvis.json', icon: '/icons/app-jarvis-192.png', color: '#0099AD' }
        };
        
        // Find matching app (including /install suffix)
        var config = null;
        for (var key in manifestMap) {
          if (path.indexOf(key) === 0) {
            config = manifestMap[key];
            break;
          }
        }
        
        // Set manifest
        var manifestHref = config ? config.manifest : '/manifest.webmanifest';
        document.write('<link rel="manifest" href="' + manifestHref + '">');
        
        // Update theme-color
        if (config && config.color) {
          var themeTag = document.querySelector('meta[name="theme-color"]');
          if (themeTag) themeTag.content = config.color;
        }
        
        // Update apple-touch-icon
        if (config && config.icon) {
          var appleIcon = document.querySelector('link[rel="apple-touch-icon"]');
          if (appleIcon) appleIcon.href = config.icon;
        }
      })();
