import ExpoModulesCore
import WebKit

public class CookieCleanerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("CookieCleaner")

    // Стирает куки (включая HttpOnly) и все данные сайтов из общего хранилища WKWebView
    // и NSHTTPCookieStorage. WebView в режиме incognito держит данные в отдельном
    // хранилище в памяти — оно исчезает вместе с самим WebView.
    AsyncFunction("clearAllAsync") { (promise: Promise) in
      let epoch = Date(timeIntervalSince1970: 0)
      HTTPCookieStorage.shared.removeCookies(since: epoch)
      WKWebsiteDataStore.default().removeData(
        ofTypes: WKWebsiteDataStore.allWebsiteDataTypes(),
        modifiedSince: epoch
      ) {
        promise.resolve(true)
      }
    }.runOnQueue(.main)
  }
}
