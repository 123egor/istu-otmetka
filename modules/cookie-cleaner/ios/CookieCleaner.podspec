Pod::Spec.new do |s|
  s.name           = 'CookieCleaner'
  s.version        = '1.0.0'
  s.summary        = 'Очистка кук и данных WebView'
  s.description    = 'Локальный Expo-модуль: стирает куки и данные сайтов WKWebView.'
  s.license        = 'MIT'
  s.author         = 'istu-otmechalka'
  s.homepage       = 'https://expo.dev'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.{h,m,swift}'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
