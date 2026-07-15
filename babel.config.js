module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./src'],
          extensions: ['.ios.js', '.android.js', '.js', '.ts', '.tsx', '.json'],
          alias: {
            '@': './src',
            '@components': './src/components',
            '@screens': './src/screens',
            '@services': './src/services',
            '@models': './src/models',
            '@utils': './src/utils',
            '@hooks': './src/hooks',
          },
        },
      ],
      'react-native-reanimated/plugin',
    ],
    env: {
      // jest(NODE_ENV=test) 전용: 소셜 로그인 서비스의 OTA-안전 dynamic
      // `import()`를 지연 require로 변환해 jest.mock이 인터셉트할 수 있게 한다.
      // babel-preset-expo(SDK 49)는 import()를 네이티브로 남겨 jest CJS VM이
      // 던지므로 이 변환 없이는 post-import 분기가 테스트 불가. Metro
      // (development/production env) 번들에는 적용되지 않는다.
      test: {
        plugins: ['babel-plugin-dynamic-import-node'],
      },
    },
  };
};
