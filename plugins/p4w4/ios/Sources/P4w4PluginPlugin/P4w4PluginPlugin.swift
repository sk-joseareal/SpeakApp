import Foundation
import Capacitor
import UIKit
import Speech
import AudioToolbox

/**
 * Please read the Capacitor iOS Plugin Development Guide
 * here: https://capacitorjs.com/docs/plugins/ios
 */
@objc(P4w4PluginPlugin)
public class P4w4PluginPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "P4w4PluginPlugin"
    public let jsName = "P4w4Plugin"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "echo", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "reverse", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "resizeWebView", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "offsetTopWebView", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getStatusBarHeight", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setStartupHtml", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "reloadWebView", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restartApp", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "transcribeAudio", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "resetBadgeCount", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "playNotificationBell", returnType: CAPPluginReturnPromise)
    ]
    private let implementation = P4w4Plugin()

    @objc func echo(_ call: CAPPluginCall) {
        let value = call.getString("value") ?? ""
        call.resolve([
            "value": implementation.echo(value)
        ])
    }
    

    @objc func reverse(_ call: CAPPluginCall) {
        guard let value = call.getString("value") else {
            print(">#P4w4Plugin#> reverse: Falta el offset.")
            call.reject("Falta el valor.")
            return
        }

        let reversed = String(value.reversed())
        call.resolve([
            "value": reversed
        ])
    }

    @objc func resizeWebView(_ call: CAPPluginCall) {
        guard let offset = call.getInt("offset") else {
            print(">#resizeWebView#> reverse: Falta el offset.")
            call.reject("Falta el offset.")
            return
        }
        print(">#P4w4Plugin#> resizeWebView: Reduciendo altura del WebView en \(offset) px.")
        DispatchQueue.main.async {
            if let webView = self.bridge?.webView {
                var frame = webView.frame
                frame.size.height -= CGFloat(offset)
                webView.frame = frame
                print(">#P4w4Plugin#> resizeWebView: Hecho.")
            }
            else
            {
                print(">#P4w4Plugin#> resizeWebView:  No se pudo acceder al WebView.")
            }
            call.resolve()
        }
    }

    @objc func offsetTopWebView(_ call: CAPPluginCall) {
        guard let offset = call.getInt("offset") else {
            print(">#P4w4Plugin#> offsetTopWebView: Falta el offset.")
            call.reject("Offset not provided")
            return
        }
        print(">#P4w4Plugin#> offsetTopWebView: Desplazando el WebView en \(offset) px.")
        DispatchQueue.main.async {
            if let webView = self.bridge?.webView {


                if offset >= 0 {
                    let screenHeight = UIScreen.main.bounds.height
                    let newFrame = CGRect(x: 0, y: CGFloat(offset), width: webView.frame.width, height: screenHeight - CGFloat(offset))
                    webView.frame = newFrame
                    print(">#P4w4Plugin#> resizeWebView: WebView desplazado y recortado desde arriba \(offset) px")
                } else {
                    // Restaurar altura y posición
                    let screenHeight = UIScreen.main.bounds.height
                    webView.frame = CGRect(x: 0, y: 0, width: webView.frame.width, height: screenHeight)
                    print(">#P4w4Plugin#> resizeWebView: WebView restaurado a posición y altura original")
                }   

            }
            else 
            {
                print(">#P4w4Plugin#> resizeWebView: No se pudo acceder al WebView.")
            }
            call.resolve()
        }
    }

    @objc func getStatusBarHeight(_ call: CAPPluginCall) {
        let height = UIApplication.shared.windows.first?.safeAreaInsets.top ?? 0

        print(">#P4w4Plugin#> getStatusBarHeight: StatusBar height: \(height) pt")

        call.resolve([
            "height": height
        ])
    }


    @objc func setStartupHtml(_ call: CAPPluginCall) {
        guard let file = call.getString("file"), !file.isEmpty else {

            print(">#P4w4Plugin#> setStartupHtml: Falta el parámetro 'file'.")
            call.reject("Falta el parámetro 'file'.")
            return
        }

        UserDefaults.standard.set(file, forKey: "startup_file")
        print(">#P4w4Plugin#> setStartupHtml: UserDefaults.startup_file: \(file)")

        call.resolve()
    }

    @objc func reloadWebView(_ call: CAPPluginCall) {
        let html = """
        <html>
          <head><meta name='viewport' content='width=device-width, initial-scale=1.0'></head>
          <body style='background:#FF00FF;color:white;font-size:20px'>
            <h1>Nuevo contenido cargado con éxito</h1>
          </body>
        </html>
        """

        DispatchQueue.main.async {

            print(">#P4w4Plugin#> reloadWebView: WebView instance: \(String(describing: self.bridge?.webView))")
            print(">#P4w4Plugin#> reloadWebView: WebView URL BEFORE: \(String(describing: self.bridge?.webView?.url))")

            self.bridge?.webView?.loadHTMLString(html, baseURL: nil)

            print(">#P4w4Plugin#> reloadWebView: WebView URL AFTER: \(String(describing: self.bridge?.webView?.url))")

            print(">#P4w4Plugin#> reloadWebView: Contenido cargado con loadHTMLString")
            call.resolve()
        }
    }

    @objc func reloadWebView___(_ call: CAPPluginCall) {
        let file = UserDefaults.standard.string(forKey: "startup_file") ?? "index.html"

        if let fileURL = Bundle.main.url(forResource: file, withExtension: nil) {
            let directoryURL = fileURL.deletingLastPathComponent()
            DispatchQueue.main.async {
                self.bridge?.webView?.loadFileURL(fileURL, allowingReadAccessTo: directoryURL)
                print(">#P4w4Plugin#> reloadWebView: Cargado con loadFileURL: \(file)")
                call.resolve()
            }
        } else {
            print(">#P4w4Plugin#> reloadWebView: No se encontró \(file).")
            call.reject("No se encontró \(file).")
        }
    }

    @objc func restartApp(_ call: CAPPluginCall) {
        // Cierra la app; iOS no permite reiniciar directamente

        print(">#P4w4Plugin#> restartApp: Cerrando la App.")

        exit(0)
    }

    private func resolveAudioUrl(_ path: String) -> URL {
        if let url = URL(string: path), url.scheme != nil {
            return url
        }
        return URL(fileURLWithPath: path)
    }

    private func resolveSpeechLocale(_ language: String) -> Locale {
        if language.isEmpty {
            return Locale(identifier: "en-US")
        }
        return Locale(identifier: language)
    }

    @objc func transcribeAudio(_ call: CAPPluginCall) {
        guard let path = call.getString("path"), !path.isEmpty else {
            call.reject("Falta el path del audio.")
            return
        }
        let language = call.getString("language") ?? "en-US"
        let fileUrl = resolveAudioUrl(path)
        if !FileManager.default.fileExists(atPath: fileUrl.path) {
            call.reject("No se encontro el archivo de audio.")
            return
        }

        let locale = resolveSpeechLocale(language)
        guard let recognizer = SFSpeechRecognizer(locale: locale) else {
            call.reject("Reconocedor de voz no disponible para ese idioma.")
            return
        }

        let startTask: () -> Void = {
            let request = SFSpeechURLRecognitionRequest(url: fileUrl)
            request.shouldReportPartialResults = false
            var resolved = false
            recognizer.recognitionTask(with: request) { result, error in
                if let error = error {
                    if !resolved {
                        resolved = true
                        call.reject("Error de transcripcion: \(error.localizedDescription)")
                    }
                    return
                }
                guard let result = result else { return }
                if result.isFinal && !resolved {
                    resolved = true
                    let text = result.bestTranscription.formattedString
                    call.resolve([
                        "text": text
                    ])
                }
            }
        }

        let status = SFSpeechRecognizer.authorizationStatus()
        if status == .authorized {
            startTask()
            return
        }

        SFSpeechRecognizer.requestAuthorization { authStatus in
            DispatchQueue.main.async {
                if authStatus == .authorized {
                    startTask()
                } else {
                    call.reject("Permiso de reconocimiento no concedido.")
                }
            }
        }
    }

    @objc func resetBadgeCount(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            UIApplication.shared.applicationIconBadgeNumber = 0
            print(">#P4w4Plugin#> resetBadgeCount: Badge de icono puesto a 0");
            call.resolve()
        }
    }

    @objc func playNotificationBell(_ call: CAPPluginCall) {
        let soundIdInt = call.getInt("soundId") ?? 1007
        let soundId = SystemSoundID(soundIdInt)
        DispatchQueue.main.async {
            AudioServicesPlaySystemSound(soundId)
            call.resolve()
        }
    }

}
