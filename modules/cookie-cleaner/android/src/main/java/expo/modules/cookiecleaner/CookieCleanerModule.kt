package expo.modules.cookiecleaner

import android.webkit.CookieManager
import android.webkit.WebStorage
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class CookieCleanerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("CookieCleaner")

    // Стирает все куки WebView (включая HttpOnly) и Web Storage.
    // CookieManager требует поток с Looper, поэтому выполняем на главном.
    AsyncFunction("clearAllAsync") { promise: Promise ->
      WebStorage.getInstance().deleteAllData()
      val cookies = CookieManager.getInstance()
      cookies.removeAllCookies { removed ->
        cookies.flush()
        promise.resolve(removed)
      }
    }.runOnQueue(Queues.MAIN)
  }
}
