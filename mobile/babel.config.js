// Babel — Expo SDK 54 + NativeWind v4.
// `jsxImportSource: "nativewind"` permet le `className` sur les
// composants RN ; le preset `nativewind/babel` transforme les classes.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
  };
};
