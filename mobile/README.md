# BUUPP — application mobile

App Expo (SDK 54, expo-router) des espaces prospect et professionnel de
BUUPP. Le backend est celui du site web (`/api/*` sur www.buupp.com),
l'authentification passe par Clerk (instance de production).

## Lancer en local

```bash
cp .env.example .env
npm install
npx expo run:ios        # build natif (Expo Go n'est pas supporté)
```

Si les ports 8081/8082 sont occupés par un autre projet, lancer Metro sur
un autre port (`npx expo start --port 8090`) et pointer l'app dessus.

## Builds

`eas build -p android --profile preview` (APK interne) ou
`--profile production`. Les variables `EXPO_PUBLIC_*` des builds sont dans
`eas.json`.

Spécification fonctionnelle : `../MOBILE_APP_SPEC.md`.
