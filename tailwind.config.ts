import type { Config } from 'tailwindcss'

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  prefix: '',
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: '1rem',
        sm: '1.5rem',
        lg: '2rem',
      },
      screens: {
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1400px',
      },
    },
    screens: {
      xs: '475px',
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
    extend: {
      // Charte §6 — « IBM Plex Sans 300/400/500/600 · IBM Plex Mono 400/500.
      // Licence SIL Open Font, installable hors ligne, aucun appel externe. »
      //
      // Le produit tournait sur system-ui : la charte typographique n'etait
      // appliquee nulle part, et la chasse fixe qui porte toutes les donnees
      // dans les treize maquettes n'existait pas.
      //
      // ATTENTION — il reste une etape que je n'ai pas pu faire ici :
      //   npm i @fontsource/ibm-plex-sans @fontsource/ibm-plex-mono
      // puis decommenter les imports en tete de src/index.css. Le dossier
      // node_modules est partage avec une autre session de travail au moment
      // de ce commit ; y installer un paquet aurait touche son arbre. Tant
      // que le paquet manque, le repli system-ui s'applique et le rendu ne
      // regresse pas.
      fontFamily: {
        sans: ['IBM Plex Sans', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        // Alias herites — 522 classes les emploient encore. Ils pointent
        // desormais vers la famille de la charte plutot que vers system-ui.
        sofia: ['IBM Plex Sans', 'system-ui', 'sans-serif'],
        titillium: ['IBM Plex Sans', 'system-ui', 'sans-serif'],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          light: 'hsl(var(--primary-light))',
          dark: 'hsl(var(--primary-dark))',
        },
        // OpenPulse brand colors based on visual identity (charte graphique exacte)
        // Palette OpenPulse. Les six premiers noms sont ceux de la charte ;
        // les suivants sont les noms hérités, conservés en alias parce que
        // 522 classes du code les emploient — les renommer d'un coup aurait
        // laissé autant d'éléments sans style, pour un gain purement
        // cosmétique. Les alias pointent vers les nouvelles couleurs : la
        // charte s'applique partout, sans rien casser.
        // ═══════════════════════════════════════════════════════════════
        // Charte §05 — « L'accent ne porte jamais de texte de labeur » ;
        // charte §14 — « Un statut est toujours un fond pale + un texte
        // fonce de la meme famille, jamais une couleur pleine. »
        //
        // 6 603 classes de l'interface employaient la palette d'origine du
        // framework — text-green-600, bg-amber-500, bg-blue-500 — dans 665
        // fichiers sur 3 178. La charte ne connait que six couleurs plus
        // les cinq teintes de sous-application : redefinir les familles ici
        // ramene tout le produit dans ce vocabulaire sans toucher un
        // composant.
        //
        // Chaque famille suit la meme construction : 50-200 le fond pale du
        // statut, 300-400 la transition, 500-600 la teinte pleine, 700-900
        // le texte fonce qui passe AA sur papier.
        // ═══════════════════════════════════════════════════════════════
        // Vert — « en production, regle » (§14)
        green: {
          50: '#F1F7F2',
          100: '#E3F0E5',
          200: '#C6E0CA',
          300: '#9CC9A4',
          400: '#63AC70',
          500: '#31983D',
          600: '#2A7F34',
          700: '#1F5B28',
          800: '#1A4A21',
          900: '#15391A',
          950: '#0D2411',
        },
        emerald: {
          50: '#F1F7F2',
          100: '#E3F0E5',
          200: '#C6E0CA',
          300: '#9CC9A4',
          400: '#63AC70',
          500: '#31983D',
          600: '#2A7F34',
          700: '#1F5B28',
          800: '#1A4A21',
          900: '#15391A',
          950: '#0D2411',
        },
        lime: {
          50: '#F1F7F2',
          100: '#E3F0E5',
          200: '#C6E0CA',
          300: '#9CC9A4',
          400: '#63AC70',
          500: '#31983D',
          600: '#2A7F34',
          700: '#1F5B28',
          800: '#1A4A21',
          900: '#15391A',
          950: '#0D2411',
        },
        // Ambre et orange — « negociation, en cours » : l'accent clair de la
        // charte en fond, l'accent plein en signal.
        amber: {
          50: '#FBEFE7',
          100: '#F4CFBB',
          200: '#EBB596',
          300: '#E09A73',
          400: '#D67A47',
          500: '#CB5A1A',
          600: '#A94A16',
          700: '#8A5637',
          800: '#6B4029',
          900: '#4F2F1E',
          950: '#331E13',
        },
        yellow: {
          50: '#FBEFE7',
          100: '#F4CFBB',
          200: '#EBB596',
          300: '#E09A73',
          400: '#D67A47',
          500: '#CB5A1A',
          600: '#A94A16',
          700: '#8A5637',
          800: '#6B4029',
          900: '#4F2F1E',
          950: '#331E13',
        },
        orange: {
          50: '#FBEFE7',
          100: '#F4CFBB',
          200: '#EBB596',
          300: '#E09A73',
          400: '#D67A47',
          500: '#CB5A1A',
          600: '#A94A16',
          700: '#8A5637',
          800: '#6B4029',
          900: '#4F2F1E',
          950: '#331E13',
        },
        // Rouge — « a risque, en retard ». Le retard critique est la seule
        // exception de la charte : accent plein, texte papier.
        red: {
          50: '#FBEFE7',
          100: '#F6DCCE',
          200: '#EDBCA3',
          300: '#E09A73',
          400: '#D2743E',
          500: '#B8481A',
          600: '#9E3E17',
          700: '#8A5637',
          800: '#6B3D24',
          900: '#4F2C1A',
          950: '#331C11',
        },
        rose: {
          50: '#FBEFE7',
          100: '#F6DCCE',
          200: '#EDBCA3',
          300: '#E09A73',
          400: '#D2743E',
          500: '#B8481A',
          600: '#9E3E17',
          700: '#8A5637',
          800: '#6B3D24',
          900: '#4F2C1A',
          950: '#331C11',
        },
        // Les cinq teintes de sous-application (§10) — meme clarte, meme
        // chroma que l'accent, seule la teinte tourne.
        blue: {
          50: '#EDF3FC',
          100: '#D8E5F8',
          200: '#B0C9F0',
          300: '#84A9E6',
          400: '#5494E1',
          500: '#3280DD',
          600: '#2A6BBA',
          700: '#245A9C',
          800: '#1D4880',
          900: '#173963',
          950: '#0F2441',
        },
        sky: {
          50: '#EDF3FC',
          100: '#D8E5F8',
          200: '#B0C9F0',
          300: '#84A9E6',
          400: '#5494E1',
          500: '#3280DD',
          600: '#2A6BBA',
          700: '#245A9C',
          800: '#1D4880',
          900: '#173963',
          950: '#0F2441',
        },
        indigo: {
          50: '#F2EDFA',
          100: '#E5D9F4',
          200: '#CDB6EA',
          300: '#B392DE',
          400: '#9F79D6',
          500: '#9065D0',
          600: '#7A52B4',
          700: '#664496',
          800: '#523679',
          900: '#3F2A5D',
          950: '#2A1C3E',
        },
        violet: {
          50: '#F2EDFA',
          100: '#E5D9F4',
          200: '#CDB6EA',
          300: '#B392DE',
          400: '#9F79D6',
          500: '#9065D0',
          600: '#7A52B4',
          700: '#664496',
          800: '#523679',
          900: '#3F2A5D',
          950: '#2A1C3E',
        },
        purple: {
          50: '#F2EDFA',
          100: '#E5D9F4',
          200: '#CDB6EA',
          300: '#B392DE',
          400: '#9F79D6',
          500: '#9065D0',
          600: '#7A52B4',
          700: '#664496',
          800: '#523679',
          900: '#3F2A5D',
          950: '#2A1C3E',
        },
        fuchsia: {
          50: '#FAEDF3',
          100: '#F5DAE7',
          200: '#E9B5CD',
          300: '#DB8DB0',
          400: '#CF6C9C',
          500: '#C3518E',
          600: '#A64478',
          700: '#8A3963',
          800: '#6E2E4F',
          900: '#55233D',
          950: '#391828',
        },
        pink: {
          50: '#FAEDF3',
          100: '#F5DAE7',
          200: '#E9B5CD',
          300: '#DB8DB0',
          400: '#CF6C9C',
          500: '#C3518E',
          600: '#A64478',
          700: '#8A3963',
          800: '#6E2E4F',
          900: '#55233D',
          950: '#391828',
        },
        cyan: {
          50: '#E6F6F8',
          100: '#C7EBF0',
          200: '#92D7E1',
          300: '#57BECD',
          400: '#22A8BC',
          500: '#0099AD',
          600: '#008194',
          700: '#006D7D',
          800: '#005764',
          900: '#00434D',
          950: '#002C33',
        },
        teal: {
          50: '#E6F6F8',
          100: '#C7EBF0',
          200: '#92D7E1',
          300: '#57BECD',
          400: '#22A8BC',
          500: '#0099AD',
          600: '#008194',
          700: '#006D7D',
          800: '#005764',
          900: '#00434D',
          950: '#002C33',
        },
        // Neutres — « deploiement, neutre » (§14) et l'echelle papier/encre
        // de la charte §05. Les gris du framework sont froids, la charte est
        // chaude : 312 classes basculent ici.
        slate: {
          50: '#FAF6F3',
          100: '#F6F1ED',
          200: '#EFE7E1',
          300: '#E3DAD4',
          400: '#B8ABA5',
          500: '#82746F',
          600: '#6B5E59',
          700: '#5A4F49',
          800: '#3D3531',
          900: '#201916',
          950: '#140E0B',
        },
        gray: {
          50: '#FAF6F3',
          100: '#F6F1ED',
          200: '#EFE7E1',
          300: '#E3DAD4',
          400: '#B8ABA5',
          500: '#82746F',
          600: '#6B5E59',
          700: '#5A4F49',
          800: '#3D3531',
          900: '#201916',
          950: '#140E0B',
        },
        zinc: {
          50: '#FAF6F3',
          100: '#F6F1ED',
          200: '#EFE7E1',
          300: '#E3DAD4',
          400: '#B8ABA5',
          500: '#82746F',
          600: '#6B5E59',
          700: '#5A4F49',
          800: '#3D3531',
          900: '#201916',
          950: '#140E0B',
        },
        neutral: {
          50: '#FAF6F3',
          100: '#F6F1ED',
          200: '#EFE7E1',
          300: '#E3DAD4',
          400: '#B8ABA5',
          500: '#82746F',
          600: '#6B5E59',
          700: '#5A4F49',
          800: '#3D3531',
          900: '#201916',
          950: '#140E0B',
        },
        stone: {
          50: '#FAF6F3',
          100: '#F6F1ED',
          200: '#EFE7E1',
          300: '#E3DAD4',
          400: '#B8ABA5',
          500: '#82746F',
          600: '#6B5E59',
          700: '#5A4F49',
          800: '#3D3531',
          900: '#201916',
          950: '#140E0B',
        },
        // Surfaces de la charte §12, nommees comme elle les nomme.
        surface: {
          canevas: '#F6F1ED',
          carte: '#FFFFFF',
          'carte-bord': '#E9E1DB',
          chrome: '#FAF6F3',
          'chrome-bord': '#E3DAD4',
          alterne: '#FBF7F4',
          alerte: '#FBEFE7',
          'alerte-bord': '#E8A97F',
          controle: '#DCD3CD',
        },
        // Statuts §14 — fond pale + texte fonce, jamais une couleur pleine.
        statut: {
          'regle-bg': '#E3F0E5',
          'regle-fg': '#1F5B28',
          'cours-bg': '#F4CFBB',
          'cours-fg': '#5E3D24',
          'neutre-bg': '#EFE7E1',
          'neutre-fg': '#5A4F49',
          'risque-bg': '#FBEFE7',
          'risque-fg': '#8A5637',
        },
        plaque: 'hsl(var(--plaque))',
        marque: {
          grille: 'hsl(20 18% 11%)', // #201916 encre, les 8 satellites
          point: 'hsl(22 78% 45%)', // #CB5A1A accent, le point central
          papier: 'hsl(26 39% 97%)', // #FAF6F3
          sombre: 'hsl(20 29% 6%)', // #140E0B
          douce: 'hsl(22 71% 85%)', // #F4CFBB
          neutre: 'hsl(17 8% 47%)', // #82746F

          blue: 'hsl(20 18% 11%)', // alias -> grille
          orange: 'hsl(22 78% 45%)', // alias -> point
          white: 'hsl(26 39% 97%)', // alias -> papier
          cyan: 'hsl(22 71% 85%)', // alias -> douce
          pastelOrange: 'hsl(22 71% 85%)', // alias -> douce
          pastelCyan: 'hsl(26 20% 93%)', // alias -> fond atténué
          pastelViolet: 'hsl(26 14% 88%)', // alias -> bordure
          pastelBlue: 'hsl(17 8% 47%)', // alias -> neutre
        },
        // Sous-applications : même clarté et même chroma que l'accent,
        // seule la teinte change.
        apps: {
          mail: '#3280DD',
          calendar: '#C3518E',
          pulse: '#9065D0',
          todos: '#31983D',
          jarvis: '#0099AD',
        },
        brand: {
          blue: 'hsl(var(--primary))',
          orange: 'hsl(var(--accent))',
          cyan: 'hsl(var(--success))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
          light: 'hsl(var(--success-light))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
          light: 'hsl(var(--warning-light))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
      },
      // Charte §12 — « Rayons : 6 px sur les controles, 9-10 px sur les
      // cartes, 100 px sur les pastilles. » Trois valeurs, pas huit.
      borderRadius: {
        none: '0px',
        sm: '6px',
        DEFAULT: '6px',
        md: '6px',
        lg: '10px',
        xl: '10px',
        '2xl': '10px',
        '3xl': '10px',
        full: '100px',
      },
      // Charte §12 — aucune ombre a l'interieur d'un ecran.
      // Les utilitaires historiques restent acceptes par Tailwind, mais ils
      // sont tous neutralises afin de garantir des surfaces planes.
      boxShadow: {
        none: 'none',
        sm: 'none',
        DEFAULT: 'none',
        md: 'none',
        lg: 'none',
        xl: 'none',
        '2xl': 'none',
        inner: 'none',
        card: 'none',
        'card-hover': 'none',
        'card-accent': 'none',
        soft: 'none',
        elevated: 'none',
        'glow-blue': 'none',
        'glow-orange': 'none',
        'glow-cyan': 'none',
        // Charte §12 — « Une seule ombre, tres basse : 0 2px 6px
        // rgba(32,25,22,.10). Aucune ombre a l'interieur d'un ecran. »
        //
        // Mettre toutes les ombres a `none` respecte la seconde phrase mais
        // rend la premiere inutile : la valeur que la charte donne n'etait
        // employee nulle part, et les surfaces qui flottent reellement au-dessus
        // du contenu — modale, menu deroulant, popover — se posaient a plat sur
        // la page, sans rien pour les detacher.
        //
        // Ce jeton porte cette ombre-la, et uniquement pour ces surfaces. Le
        // reste de l'interface garde `none`.
        overlay: '0 2px 6px rgba(32,25,22,.10)',
      },
      dropShadow: {
        none: 'none',
        sm: 'none',
        DEFAULT: 'none',
        md: 'none',
        lg: 'none',
        xl: 'none',
        '2xl': 'none',
      },
      // Charte §13 — hauteurs de controle. Declarees pour que les composants
      // puissent les employer par leur nom au lieu de l'echelle du framework.
      height: {
        controle: '34px',
        champ: '46px',
        pastille: '32px',
        barre: '56px',
      },
      minHeight: {
        tactile: '44px', // « Cible tactile minimale sur mobile : 44 px »
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(200%)' },
        },
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-in-left': {
          '0%': { opacity: '0', transform: 'translateX(-20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(1)', opacity: '1' },
          '100%': { transform: 'scale(1.5)', opacity: '0' },
        },
        'cursor-click': {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(0.85)' },
          '100%': { transform: 'scale(1)' },
        },
        'chart-draw': {
          '0%': { strokeDashoffset: '1000' },
          '100%': { strokeDashoffset: '0' },
        },
        'bar-grow': {
          '0%': { height: '0' },
          '100%': { height: 'var(--bar-height)' },
        },
        'count-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        typing: {
          '0%': { width: '0' },
          '100%': { width: '100%' },
        },
        'bounce-gentle': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '50%': { transform: 'translateY(-20px) rotate(3deg)' },
        },
        'float-slow': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'gradient-shift': {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: 'none' },
          '50%': { boxShadow: 'none' },
        },
        'card-enter': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'icon-bounce': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.1)' },
        },
        'border-glow': {
          '0%, 100%': { boxShadow: 'none' },
          '50%': { boxShadow: 'none' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        shimmer: 'shimmer 2s infinite',
        'fade-in': 'fade-in 0.5s ease-out forwards',
        'fade-in-up': 'fade-in-up 0.6s ease-out forwards',
        'scale-in': 'scale-in 0.4s ease-out forwards',
        'slide-in-right': 'slide-in-right 0.4s ease-out forwards',
        'slide-in-left': 'slide-in-left 0.4s ease-out forwards',
        'pulse-ring': 'pulse-ring 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'cursor-click': 'cursor-click 0.15s ease-in-out',
        'chart-draw': 'chart-draw 1.5s ease-out forwards',
        'bar-grow': 'bar-grow 1s ease-out forwards',
        'count-up': 'count-up 0.5s ease-out forwards',
        typing: 'typing 2s steps(40, end)',
        'bounce-gentle': 'bounce-gentle 2s ease-in-out infinite',
        float: 'float 6s ease-in-out infinite',
        'float-slow': 'float-slow 8s ease-in-out infinite',
        'gradient-shift': 'gradient-shift 15s ease infinite',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'card-enter': 'card-enter 0.5s ease-out forwards',
        'icon-bounce': 'icon-bounce 0.3s ease-in-out',
        'border-glow': 'border-glow 2s ease-in-out infinite',
        'slide-up': 'slide-up 0.4s ease-out forwards',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config
