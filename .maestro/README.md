# Maestro flows — CRM Hospitalier (Capacitor iOS/Android)

Tests d'interaction natifs pour OpenPulse Gestion (CRM Hospitalier).
Wrapper Capacitor confirmé : `capacitor.config.ts` présent + `android/` + `ios/`.

## Flows disponibles

| Flow | Couvre | Durée estimée |
|---|---|---|
| `auth-login.yaml` | Login admin → dashboard + login csm (RBAC) | ~60s |
| `contact-create.yaml` | CRUD contact complet (create + search + edit + delete) | ~80s |
| `calendar-event.yaml` | Création event + détection conflit | ~70s |
| `pulse-message.yaml` | Messagerie interne Pulse (DM + attachment + emoji) | ~80s |

**Total** : ~5 min pour les 4 flows.

## Setup

```bash
brew install --formula maestro
# Boot iOS Simulator OU Android Emulator
# Install app via : npx cap run ios --target="iPhone 15 Pro"
```

## Run

```bash
# Tous les flows
maestro test .maestro/

# Un seul
MARQUE_TEST_PASSWORD="<password>" maestro test .maestro/auth-login.yaml

# Sur device physique
maestro test --device "<UDID>" .maestro/contact-create.yaml
```

## App ID

`com.marque.gestion` (confirmé dans `capacitor.config.ts`).

## CI

À wirer via `.github/workflows/maestro.yml` (cf. pattern Mobile `.github/workflows/maestro.yml`).
