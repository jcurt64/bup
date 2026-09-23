// Config dynamique au-dessus d'app.json (qui reste la source principale).
//
// google-services.json (Firebase Cloud Messaging, notifications Android)
// n'est jamais versionné (.gitignore) : les builds EAS le reçoivent via la
// variable d'environnement EAS de type fichier GOOGLE_SERVICES_JSON ; en
// local on lit ./google-services.json s'il est présent.
import { existsSync } from "node:fs";

import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  const googleServicesFile =
    process.env.GOOGLE_SERVICES_JSON ??
    (existsSync("./google-services.json") ? "./google-services.json" : undefined);

  return {
    ...(config as ExpoConfig),
    android: {
      ...config.android,
      ...(googleServicesFile ? { googleServicesFile } : {}),
    },
  };
};
