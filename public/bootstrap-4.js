// Fallback timeout: si React ne se monte pas en 20 secondes
      setTimeout(function() {
        var loader = document.getElementById('initial-loader');
        if (loader && document.getElementById('root').contains(loader)) {
          loader.innerHTML = '<div style="text-align:center;padding:20px;">' +
            '<p style="color:#666;margin-bottom:16px;">Chargement lent détecté</p>' +
            '<button id="reload-slow-app" style="padding:8px 16px;background:#201916;color:white;border:none;border-radius:6px;cursor:pointer;">Actualiser</button>' +
            '</div>';
          document.getElementById('reload-slow-app')?.addEventListener('click', function() {
            window.location.reload();
          });
        }
      }, 20000);
