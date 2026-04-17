import UIKit
import Capacitor
import AVFoundation
import MediaPlayer

import Firebase
import UserNotifications
import FirebaseMessaging

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?
    private let launchBlue = UIColor(red: 0.1764705882, green: 0.4274509804, blue: 0.9411764706, alpha: 1.0)

    private func applyLaunchChrome() {
        self.window?.backgroundColor = launchBlue
        if let bridgeVC = self.window?.rootViewController as? CAPBridgeViewController {
            bridgeVC.view.backgroundColor = launchBlue
            bridgeVC.webView?.superview?.backgroundColor = launchBlue
            bridgeVC.webView?.backgroundColor = .clear
            bridgeVC.webView?.isOpaque = false
        }
    }

    private func configureAmbientAudioSession(active: Bool) {
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.ambient, mode: .default, options: [.mixWithOthers])
            try session.setActive(active)
            print(">#N00#> Audio session ambient active=\(active)")
        } catch {
            print(">#N04#> Error configurando audio session ambient active=\(active): \(error)")
        }
    }

    private func currentApnsEnvironment() -> String {
        let value = Bundle.main.object(forInfoDictionaryKey: "SpeakAPNSEnvironment") as? String
        return (value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func clearNowPlayingState() {
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
        UIApplication.shared.endReceivingRemoteControlEvents()
    }

    private func stopWebViewMediaPlayback(reason: String) {
        let js = """
        (() => {
          try {
            document.querySelectorAll('audio,video').forEach((el) => {
              try { el.pause(); } catch (_) {}
              try { el.currentTime = 0; } catch (_) {}
              try { el.srcObject = null; } catch (_) {}
              try { el.removeAttribute('src'); } catch (_) {}
              try { el.load(); } catch (_) {}
            });
            if (navigator.mediaSession) {
              try { navigator.mediaSession.metadata = null; } catch (_) {}
              try { navigator.mediaSession.playbackState = 'none'; } catch (_) {}
              try { navigator.mediaSession.setActionHandler('play', null); } catch (_) {}
              try { navigator.mediaSession.setActionHandler('pause', null); } catch (_) {}
              try { navigator.mediaSession.setActionHandler('seekbackward', null); } catch (_) {}
              try { navigator.mediaSession.setActionHandler('seekforward', null); } catch (_) {}
              try { navigator.mediaSession.setActionHandler('previoustrack', null); } catch (_) {}
              try { navigator.mediaSession.setActionHandler('nexttrack', null); } catch (_) {}
              try { navigator.mediaSession.setActionHandler('stop', null); } catch (_) {}
            }
            return true;
          } catch (err) {
            return String(err && err.message ? err.message : err);
          }
        })();
        """
        guard let webView = (self.window?.rootViewController as? CAPBridgeViewController)?.webView else {
            print(">#N02#> No se pudo acceder al webView para detener media (\(reason)).")
            return
        }
        webView.evaluateJavaScript(js) { result, error in
            if let error = error {
                print(">#N04#> Error deteniendo media web (\(reason)): \(error)")
                return
            }
            print(">#N00#> Media web detenida (\(reason)): \(String(describing: result))")
        }
    }

    private func suspendWebAudioSideEffects(reason: String) {
        stopWebViewMediaPlayback(reason: reason)
        clearNowPlayingState()
    }

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        
        // Mantiene el azul del splash también en la ventana nativa hasta poco después de ocultarlo.
        applyLaunchChrome()
        configureAmbientAudioSession(active: true)

        print(">#N00#> AppDelegate: Adaptando el webView a la Status Bar.")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.01) {
          if let bridgeVC = self.window?.rootViewController as? CAPBridgeViewController,
             let webView = bridgeVC.webView {
            
            let offset = UIApplication.shared.windows.first?.safeAreaInsets.top ?? 0
            print(">#N00#> AppDelegate: ⚙️ Ajustando WebView desde AppDelegate con offset \(offset)")

            let screenHeight = UIScreen.main.bounds.height
            let newFrame = CGRect(x: 0, y: offset, width: webView.frame.width, height: screenHeight - offset)
            webView.frame = newFrame

          } else {
            print(">#N00#> AppDelegate: ❌ No se pudo acceder al WebView desde AppDelegate.")
          }
        }

        FirebaseApp.configure()
               
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        applyLaunchChrome()
        configureAmbientAudioSession(active: false)
        suspendWebAudioSideEffects(reason: "willResignActive")
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        applyLaunchChrome()
        configureAmbientAudioSession(active: false)
        suspendWebAudioSideEffects(reason: "didEnterBackground")
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Se deja el azul sólo para la snapshot/background.
        // El color real al reactivar lo decide JS según la ruta actual.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
        configureAmbientAudioSession(active: true)
        clearNowPlayingState()
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }
    

    // Push Notifications (Firebase)
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data ) {

        print(">#N00#> Intentando obtener APNs token.")
        let tokenParts = deviceToken.map { data in String(format: "%02.2hhx", data) }
        let token = tokenParts.joined()
        let apnsEnvironment = currentApnsEnvironment()
        print(">#N00#> APNs Token obtenido: \(token)")
        print(">#N00#> APNs environment detectado: \(apnsEnvironment)")
        
        // Inyectar el evento window.fcmToken en JS.
        print(">#N00#> Inyectando el evento JS apnsToken.")
        let js = """
        window.dispatchEvent(new CustomEvent('apnsToken', { detail: { token: '\(token)', environment: '\(apnsEnvironment)' } }));
        """
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            if let webView = (self.window?.rootViewController as? CAPBridgeViewController)?.webView {
                webView.evaluateJavaScript(js, completionHandler: { result, error in
                    if let error = error {
                        print(">#N00#> ❌ Error inyectando el evento JS apnsToken: \(error)")
                    } else {
                        print(">#N00#> ✅ Evento JS apnsToken inyectado correctamente.")
                    }
                })
            } else {
                print(">#N00#> ⚠️ No se pudo acceder al webView para inyectar evento apnsToken.")
            }
        }
        
        print(">#N00#> Intentando obtener FCM token a partir de APNs token")
        //Messaging.messaging().apnsToken = deviceToken; // Esto asegura que tenga el token de apns, por que puede no tenerlo aún.
        Messaging.messaging().token { token, error in
            if let error = error {
                print(">#N00#> ❌ Error al obtener FCM token: \(error)")
            } else if let token = token {
                print(">#N00#> ✅ Token FCM obtenido manualmente: \(token)")
                
                // Inyectar el evento window.fcmToken en JS
                print(">#N00#> Inyectando el evento JS fcmToken.")
                let js = """
                window.dispatchEvent(new CustomEvent('fcmToken', { detail: { token: '\(token)', apnsEnvironment: '\(apnsEnvironment)' } }));
                """
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                    if let webView = (self.window?.rootViewController as? CAPBridgeViewController)?.webView {
                        webView.evaluateJavaScript(js, completionHandler: { result, error in
                            if let error = error {
                                print(">>#N00#> ❌ Error inyectando el evento JS fcmToken: \(error)")
                            } else {
                                print(">#N00#> ✅ Evento JS fcmToken inyectado correctamente.")
                            }
                        })
                    }
                }
            }
        }

    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        print(">#N04#> Error en APNs registration: \(error)")
    }
    //    
    

}
