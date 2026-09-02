// Convert render-blocking CSS to async after first paint
      // This runs after DOMContentLoaded to not block initial render
      if (typeof window !== 'undefined') {
        window.addEventListener('DOMContentLoaded', function() {
          // Find all stylesheet links that are render-blocking
          var links = document.querySelectorAll('link[rel="stylesheet"]');
          links.forEach(function(link) {
            var href = link.href || '';
            // Only defer chunk-specific CSS (not core CSS)
            if (href.includes('Contrats') || href.includes('Alertes')) {
              link.media = 'print';
              link.onload = function() { this.media = 'all'; };
            }
          });
        });
      }
