const {
  withAppBuildGradle,
  withGradleProperties,
  withProjectBuildGradle,
} = require('@expo/config-plugins');

const withGoogleNavigationSdk = (config) => {
  config = withGradleProperties(config, (gradleConfig) => {
    const values = new Map(
      gradleConfig.modResults
        .filter((item) => item.type === 'property')
        .map((item) => [item.key, item])
    );

    const required = {
      'android.enableJetifier': 'true',
      'android.kotlinVersion': '2.3.0',
      'android.minSdkVersion': '24',
      newArchEnabled: 'true',
      'org.gradle.jvmargs': '-Xmx4096m -XX:MaxMetaspaceSize=1024m',
    };

    Object.entries(required).forEach(([key, value]) => {
      const existing = values.get(key);
      if (existing) {
        existing.value = value;
      } else {
        gradleConfig.modResults.push({ type: 'property', key, value });
      }
    });

    return gradleConfig;
  });

  config = withAppBuildGradle(config, (gradleConfig) => {
    let source = gradleConfig.modResults.contents;
    if (!source.includes('coreLibraryDesugaringEnabled true')) {
      if (source.includes('compileOptions {')) {
        source = source.replace(
          'compileOptions {',
          'compileOptions {\n        coreLibraryDesugaringEnabled true'
        );
      } else {
        source = source.replace(
          '    defaultConfig {',
          [
            '    compileOptions {',
            '        coreLibraryDesugaringEnabled true',
            '    }',
            '    defaultConfig {',
          ].join('\n')
        );
      }
    }

    if (!source.includes("coreLibraryDesugaring 'com.android.tools:desugar_jdk_libs_nio:2.1.5'")) {
      source = source.replace(
        'dependencies {',
        "dependencies {\n    coreLibraryDesugaring 'com.android.tools:desugar_jdk_libs_nio:2.1.5'"
      );
    }

    gradleConfig.modResults.contents = source;
    return gradleConfig;
  });

  config = withProjectBuildGradle(config, (gradleConfig) => {
    let source = gradleConfig.modResults.contents;
    source = source.replace(
      "classpath('com.android.tools.build:gradle')",
      "classpath('com.android.tools.build:gradle:8.13.2')"
    );
    source = source.replace(
      "classpath('org.jetbrains.kotlin:kotlin-gradle-plugin')",
      "classpath('org.jetbrains.kotlin:kotlin-gradle-plugin:2.3.0')"
    );

    const exclusion = [
      'allprojects {',
      '    configurations.configureEach {',
      "        exclude group: 'com.google.android.gms', module: 'play-services-maps'",
      "        resolutionStrategy.force 'com.google.android.libraries.navigation:navigation:7.6.1'",
      '    }',
      '}',
    ].join('\n');

    if (!source.includes("module: 'play-services-maps'")) {
      source = `${source.trim()}\n\n${exclusion}\n`;
    }

    gradleConfig.modResults.contents = source;

    return gradleConfig;
  });

  return config;
};

module.exports = withGoogleNavigationSdk;
