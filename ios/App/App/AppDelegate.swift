import UIKit
import Capacitor

import Firebase
import UserNotifications
import FirebaseMessaging

import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        
        // Color de fondo del 'window', que es lo que está detrás del webView
        self.window?.backgroundColor = UIColor(red: 0.96, green: 0.97, blue: 0.98, alpha: 1.0) // UIColor(red: 0.02, green: 0.24, blue: 0.36, alpha: 1.0)

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
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
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
        print(">#N00#> APNs Token obtenido: \(token)")
        
        // Inyectar el evento window.fcmToken en JS.
        print(">#N00#> Inyectando el evento JS apnsToken.")
        let js = """
        window.dispatchEvent(new CustomEvent('apnsToken', { detail: { token: '\(token)' } }));
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
                window.dispatchEvent(new CustomEvent('fcmToken', { detail: { token: '\(token)' } }));
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
