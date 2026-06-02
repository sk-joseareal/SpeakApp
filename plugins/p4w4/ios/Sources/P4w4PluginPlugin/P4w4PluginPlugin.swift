import Foundation
import Capacitor
import UIKit
import UserNotifications
import Speech
import AudioToolbox
import AVFoundation
import NaturalLanguage
#if canImport(Translation)
import Translation
#endif
import SwiftUI

/**
 * Please read the Capacitor iOS Plugin Development Guide
 * here: https://capacitorjs.com/docs/plugins/ios
 */
@objc(P4w4PluginPlugin)
public class P4w4PluginPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "P4w4PluginPlugin"
    public let jsName = "P4w4Plugin"
    private let transparentChromeBackdropColor = UIColor(red: 167.0 / 255.0, green: 198.0 / 255.0, blue: 247.0 / 255.0, alpha: 1.0)
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "echo", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "reverse", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "resizeWebView", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "offsetTopWebView", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getStatusBarHeight", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getSystemInsets", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setNativeChrome", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "detectLanguage", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getTranslationStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "prepareTranslationModel", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "translateText", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setStartupHtml", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "reloadWebView", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restartApp", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "transcribeAudio", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "resetBadgeCount", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "playNotificationBell", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "playUiSfx", returnType: CAPPluginReturnPromise)
    ]
    private let implementation = P4w4Plugin()
    private static var uiSfxPlayers: [String: AVAudioPlayer] = [:]
    private var uiSfxObserversRegistered = false
    #if canImport(Translation)
    private var translationBridgeHost: UIViewController?
    private var translationBridgeModel: AnyObject?
    #endif

    @objc func echo(_ call: CAPPluginCall) {
        let value = call.getString("value") ?? ""
        call.resolve([
            "value": implementation.echo(value)
        ])
    }

    public override func load() {
        super.load()
        registerUiSfxLifecycleObserversIfNeeded()
        #if canImport(Translation)
        if #available(iOS 18.0, *) {
            installTranslationBridgeIfNeeded()
        }
        #endif
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
        let osVersion = UIDevice.current.systemVersion

        print(">#P4w4Plugin#> getStatusBarHeight: StatusBar height: \(height) pt osVersion=\(osVersion)")

        call.resolve([
            "height": height,
            "platform": "ios",
            "osVersion": osVersion
        ])
    }

    @objc func getSystemInsets(_ call: CAPPluginCall) {
        var candidates: [UIEdgeInsets] = []
        if let bridgeView = self.bridge?.viewController?.view {
            candidates.append(bridgeView.safeAreaInsets)
            if let window = bridgeView.window {
                candidates.append(window.safeAreaInsets)
            }
        }
        if let appWindow = UIApplication.shared.windows.first(where: { $0.isKeyWindow }) ?? UIApplication.shared.windows.first {
            candidates.append(appWindow.safeAreaInsets)
        }
        if #available(iOS 13.0, *) {
            UIApplication.shared.connectedScenes
                .compactMap { $0 as? UIWindowScene }
                .flatMap { $0.windows }
                .forEach { candidates.append($0.safeAreaInsets) }
        }

        let insets = UIEdgeInsets(
            top: candidates.map { $0.top }.max() ?? 0,
            left: candidates.map { $0.left }.max() ?? 0,
            bottom: candidates.map { $0.bottom }.max() ?? 0,
            right: candidates.map { $0.right }.max() ?? 0
        )
        let osVersion = UIDevice.current.systemVersion

        print(">#P4w4Plugin#> getSystemInsets: top=\(insets.top) right=\(insets.right) bottom=\(insets.bottom) left=\(insets.left) candidates=\(candidates.count) osVersion=\(osVersion)")

        call.resolve([
            "top": insets.top,
            "right": insets.right,
            "bottom": insets.bottom,
            "left": insets.left,
            "platform": "ios",
            "osVersion": osVersion
        ])
    }

    private func colorFromHex(_ rawValue: String) -> UIColor? {
        let trimmed = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        let sanitized = trimmed.hasPrefix("#") ? String(trimmed.dropFirst()) : trimmed
        guard sanitized.count == 6 || sanitized.count == 8 else { return nil }

        var value: UInt64 = 0
        guard Scanner(string: sanitized).scanHexInt64(&value) else { return nil }

        if sanitized.count == 6 {
            return UIColor(
                red: CGFloat((value & 0xFF0000) >> 16) / 255.0,
                green: CGFloat((value & 0x00FF00) >> 8) / 255.0,
                blue: CGFloat(value & 0x0000FF) / 255.0,
                alpha: 1.0
            )
        }

        return UIColor(
            red: CGFloat((value & 0xFF000000) >> 24) / 255.0,
            green: CGFloat((value & 0x00FF0000) >> 16) / 255.0,
            blue: CGFloat((value & 0x0000FF00) >> 8) / 255.0,
            alpha: CGFloat(value & 0x000000FF) / 255.0
        )
    }

    private func applyWebViewStatusBarLayout(edgeToEdge: Bool) {
        guard let bridgeVC = self.bridge?.viewController,
              let webView = self.bridge?.webView else {
            return
        }

        let container = webView.superview ?? bridgeVC.view
        let containerBounds = container?.bounds ?? bridgeVC.view.bounds
        let safeTop = bridgeVC.view.window?.safeAreaInsets.top ?? UIApplication.shared.windows.first?.safeAreaInsets.top ?? 0
        let topOffset = edgeToEdge ? 0 : safeTop
        webView.frame = CGRect(
            x: 0,
            y: topOffset,
            width: containerBounds.width,
            height: max(0, containerBounds.height - topOffset)
        )
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        print(">#P4w4Plugin#> applyWebViewStatusBarLayout: edgeToEdge=\(edgeToEdge) topOffset=\(topOffset)")
    }

    @objc func setNativeChrome(_ call: CAPPluginCall) {
        guard let rawColor = call.getString("backgroundColor"),
              let color = colorFromHex(rawColor) else {
            call.reject("Color de fondo invalido.")
            return
        }

        let lightIcons = call.getBool("lightIcons") ?? false
        let transparentChrome = color.cgColor.alpha <= 0.01
        let nativeBackdropColor = transparentChrome ? transparentChromeBackdropColor : color

        DispatchQueue.main.async {
            if let window = self.bridge?.viewController?.view.window ?? UIApplication.shared.windows.first {
                window.backgroundColor = nativeBackdropColor
            }

            self.bridge?.viewController?.view.backgroundColor = nativeBackdropColor
            self.bridge?.webView?.superview?.backgroundColor = nativeBackdropColor
            self.bridge?.webView?.backgroundColor = .clear
            self.bridge?.webView?.isOpaque = false
            self.applyWebViewStatusBarLayout(edgeToEdge: transparentChrome)

            print(">#P4w4Plugin#> setNativeChrome: bg=\(rawColor) transparentChrome=\(transparentChrome) lightIcons=\(lightIcons)")
            call.resolve()
        }
    }

    private func resolveAssetUrl(_ assetPath: String) -> URL? {
        let normalized = assetPath.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty else { return nil }
        let bundlePath = normalized.hasPrefix("public/") ? normalized : "public/\(normalized)"
        let candidate = Bundle.main.bundleURL.appendingPathComponent(bundlePath)
        if FileManager.default.fileExists(atPath: candidate.path) {
            return candidate
        }
        return nil
    }

    @objc public static func stopAllUiSfxPlayback() {
        uiSfxPlayers.values.forEach { player in
            player.stop()
            player.currentTime = 0
        }
        uiSfxPlayers.removeAll()
    }

    private func registerUiSfxLifecycleObserversIfNeeded() {
        if uiSfxObserversRegistered { return }
        uiSfxObserversRegistered = true
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleUiSfxBackgrounding),
            name: UIApplication.willResignActiveNotification,
            object: nil
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleUiSfxBackgrounding),
            name: UIApplication.didEnterBackgroundNotification,
            object: nil
        )
    }

    @objc private func handleUiSfxBackgrounding() {
        Self.stopAllUiSfxPlayback()
    }

    @objc func playUiSfx(_ call: CAPPluginCall) {
        guard let assetPath = call.getString("assetPath"),
              let assetUrl = resolveAssetUrl(assetPath) else {
            call.resolve([
                "started": false,
                "mode": "ios-native"
            ])
            return
        }

        let volume = max(0, min(1, Float(call.getDouble("volume") ?? 1)))

        DispatchQueue.main.async {
            do {
                Self.stopAllUiSfxPlayback()
                let player = try AVAudioPlayer(contentsOf: assetUrl)
                player.volume = volume
                player.prepareToPlay()
                let started = player.play()
                if started {
                    Self.uiSfxPlayers[assetPath] = player
                }
                call.resolve([
                    "started": started,
                    "mode": "ios-native"
                ])
            } catch {
                print(">#P4w4Plugin#> playUiSfx error: \(error)")
                call.resolve([
                    "started": false,
                    "mode": "ios-native"
                ])
            }
        }
    }

    @objc func detectLanguage(_ call: CAPPluginCall) {
        let text = (call.getString("text") ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let alphaChars = text.unicodeScalars.reduce(0) { count, scalar in
            count + (CharacterSet.letters.contains(scalar) ? 1 : 0)
        }

        if text.isEmpty {
            call.resolve([
                "available": true,
                "dominantLanguage": "",
                "confidence": 0,
                "alternatives": [],
                "textLength": 0,
                "alphaChars": alphaChars
            ])
            return
        }

        let recognizer = NLLanguageRecognizer()
        recognizer.processString(text)
        let dominantLanguage = recognizer.dominantLanguage?.rawValue ?? ""
        let hypotheses = recognizer
            .languageHypotheses(withMaximum: 3)
            .sorted { $0.value > $1.value }

        let alternatives = hypotheses.map { hypothesis in
            [
                "language": hypothesis.key.rawValue,
                "confidence": hypothesis.value
            ]
        }

        let confidence = hypotheses.first { $0.key.rawValue == dominantLanguage }?.value
            ?? hypotheses.first?.value
            ?? 0

        call.resolve([
            "available": true,
            "dominantLanguage": dominantLanguage,
            "confidence": confidence,
            "alternatives": alternatives,
            "textLength": text.count,
            "alphaChars": alphaChars
        ])
    }

    @objc func translateText(_ call: CAPPluginCall) {
        let text = (call.getString("text") ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let sourceLanguage = (call.getString("sourceLanguage") ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let targetLanguage = (call.getString("targetLanguage") ?? "en").trimmingCharacters(in: .whitespacesAndNewlines)

        #if canImport(Translation)
        if #available(iOS 18.0, *) {
            installTranslationBridgeIfNeeded()
            guard let bridgeModel = translationBridgeModel as? P4w4TranslationBridgeModel else {
                call.resolve([
                    "available": false,
                    "sourceLanguage": sourceLanguage,
                    "targetLanguage": targetLanguage.isEmpty ? "en" : targetLanguage,
                    "sourceText": text,
                    "translatedText": "",
                    "engine": "ios-translation",
                    "reason": "bridge_unavailable"
                ])
                return
            }

            if text.isEmpty {
                call.resolve([
                    "available": false,
                    "sourceLanguage": sourceLanguage,
                    "targetLanguage": targetLanguage.isEmpty ? "en" : targetLanguage,
                    "sourceText": text,
                    "translatedText": "",
                    "engine": "ios-translation",
                    "reason": "empty"
                ])
                return
            }

            let normalizedSource = normalizeTranslationLanguageCode(sourceLanguage)
            let normalizedTarget = normalizeTranslationLanguageCode(targetLanguage.isEmpty ? "en" : targetLanguage)
            if normalizedSource == "en" && normalizedTarget == "en" {
                call.resolve([
                    "available": true,
                    "sourceLanguage": "en",
                    "targetLanguage": "en",
                    "sourceText": text,
                    "translatedText": text,
                    "engine": "ios-translation",
                    "modelDownloaded": true
                ])
                return
            }

            if normalizedSource != "es" || normalizedTarget != "en" {
                call.resolve([
                    "available": false,
                    "sourceLanguage": normalizedSource,
                    "targetLanguage": normalizedTarget.isEmpty ? "en" : normalizedTarget,
                    "sourceText": text,
                    "translatedText": "",
                    "engine": "ios-translation",
                    "reason": "unsupported_language_pair"
                ])
                return
            }

            if #available(iOS 26.0, *) {
                translateTextDirect(call: call, text: text, sourceLanguage: normalizedSource, targetLanguage: normalizedTarget)
                return
            }

            DispatchQueue.main.async {
                bridgeModel.submitTranslation(call: call, text: text, sourceLanguage: normalizedSource, targetLanguage: normalizedTarget)
            }
            return
        }
        #endif

        call.resolve([
            "available": false,
            "sourceLanguage": sourceLanguage,
            "targetLanguage": targetLanguage.isEmpty ? "en" : targetLanguage,
            "sourceText": text,
            "translatedText": "",
            "engine": "ios-unsupported",
            "reason": "unsupported_ios_target"
        ])
    }

    @objc func prepareTranslationModel(_ call: CAPPluginCall) {
        let sourceLanguage = normalizeTranslationStatusLanguageCode(call.getString("sourceLanguage") ?? "es")
        let targetLanguage = normalizeTranslationStatusLanguageCode(call.getString("targetLanguage") ?? "en")
        let pairSupported = sourceLanguage == "es" && targetLanguage == "en"

        #if canImport(Translation)
        if #available(iOS 18.0, *) {
            guard pairSupported else {
                call.resolve([
                    "available": false,
                    "engine": "ios-translation",
                    "platform": "ios",
                    "sourceLanguage": sourceLanguage,
                    "targetLanguage": targetLanguage,
                    "modelDownloaded": false,
                    "reason": "unsupported_language_pair"
                ])
                return
            }

            if #available(iOS 26.0, *) {
                let source = Locale.Language(identifier: sourceLanguage)
                let target = Locale.Language(identifier: targetLanguage)
                Task {
                    let status = await LanguageAvailability().status(from: source, to: target)
                    if status == .installed {
                        DispatchQueue.main.async {
                            call.resolve([
                                "available": true,
                                "supportedPair": true,
                                "engine": "ios-translation-direct",
                                "platform": "ios",
                                "sourceLanguage": sourceLanguage,
                                "targetLanguage": targetLanguage,
                                "modelDownloaded": true,
                                "languageStatus": "installed",
                                "reason": ""
                            ])
                        }
                        return
                    }
                    if status == .unsupported {
                        DispatchQueue.main.async {
                            call.resolve([
                                "available": false,
                                "supportedPair": false,
                                "engine": "ios-translation-direct",
                                "platform": "ios",
                                "sourceLanguage": sourceLanguage,
                                "targetLanguage": targetLanguage,
                                "modelDownloaded": false,
                                "languageStatus": String(describing: status),
                                "reason": "unsupported_language_pair"
                            ])
                        }
                        return
                    }
                    DispatchQueue.main.async {
                        self.installTranslationBridgeIfNeeded()
                        guard let bridgeModel = self.translationBridgeModel as? P4w4TranslationBridgeModel else {
                            call.resolve([
                                "available": false,
                                "supportedPair": true,
                                "engine": "ios-translation",
                                "platform": "ios",
                                "sourceLanguage": sourceLanguage,
                                "targetLanguage": targetLanguage,
                                "modelDownloaded": false,
                                "reason": "bridge_unavailable"
                            ])
                            return
                        }
                        bridgeModel.submitPrepare(call: call, sourceLanguage: sourceLanguage, targetLanguage: targetLanguage)
                    }
                }
                return
            }

            installTranslationBridgeIfNeeded()
            guard let bridgeModel = translationBridgeModel as? P4w4TranslationBridgeModel else {
                call.resolve([
                    "available": false,
                    "supportedPair": true,
                    "engine": "ios-translation",
                    "platform": "ios",
                    "sourceLanguage": sourceLanguage,
                    "targetLanguage": targetLanguage,
                    "modelDownloaded": false,
                    "reason": "bridge_unavailable"
                ])
                return
            }
            DispatchQueue.main.async {
                bridgeModel.submitPrepare(call: call, sourceLanguage: sourceLanguage, targetLanguage: targetLanguage)
            }
            return
        }

        call.resolve([
            "available": false,
            "engine": "ios-translation",
            "platform": "ios",
            "sourceLanguage": sourceLanguage,
            "targetLanguage": targetLanguage,
            "modelDownloaded": false,
            "reason": "requires_ios_18"
        ])
        #else
        call.resolve([
            "available": false,
            "engine": "ios-translation",
            "platform": "ios",
            "sourceLanguage": sourceLanguage,
            "targetLanguage": targetLanguage,
            "modelDownloaded": false,
            "reason": "translation_framework_unavailable"
        ])
        #endif
    }

#if canImport(Translation)
    private func normalizeTranslationLanguageCode(_ value: String) -> String {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if trimmed.isEmpty { return "" }
        return trimmed.components(separatedBy: CharacterSet(charactersIn: "-_")).first ?? trimmed
    }

    @available(iOS 18.0, *)
    private func installTranslationBridgeIfNeeded() {
        if translationBridgeHost != nil, translationBridgeModel != nil { return }
        guard let viewController = bridge?.viewController else { return }

        let model = P4w4TranslationBridgeModel()
        model.onResolve = { call, payload in
            DispatchQueue.main.async {
                call.resolve(payload)
            }
        }
        let host = UIHostingController(rootView: P4w4TranslationBridgeView(model: model))
        host.view.backgroundColor = .clear
        host.view.isOpaque = false
        host.view.alpha = 0.01
        host.view.frame = CGRect(x: 0, y: 0, width: 1, height: 1)
        viewController.addChild(host)
        viewController.view.addSubview(host.view)
        host.didMove(toParent: viewController)

        translationBridgeModel = model
        translationBridgeHost = host
    }

    @available(iOS 18.0, *)
    private final class P4w4TranslationBridgeModel: ObservableObject {
        enum RequestKind {
            case translate
            case prepare
        }

        struct PendingRequest {
            var calls: [CAPPluginCall]
            let text: String
            let sourceLanguage: String
            let targetLanguage: String
            let kind: RequestKind
            let requestId: Int
        }

        @Published var configuration: TranslationSession.Configuration?
        var pendingRequest: PendingRequest?
        var onResolve: ((CAPPluginCall, [String: Any]) -> Void)?
        private var requestCounter: Int = 0
        private var timeoutWorkItem: DispatchWorkItem?
        private let translationRequestTimeoutSeconds: TimeInterval = 2.5
        private let prepareRequestTimeoutSeconds: TimeInterval = 25.0

        func submitTranslation(call: CAPPluginCall, text: String, sourceLanguage: String, targetLanguage: String) {
            if var request = pendingRequest,
               request.kind == .translate,
               request.text == text,
               request.sourceLanguage == sourceLanguage,
               request.targetLanguage == targetLanguage {
                request.calls.append(call)
                pendingRequest = request
                return
            }
            resolvePendingRequest(reason: "superseded")
            requestCounter += 1
            let requestId = requestCounter
            pendingRequest = PendingRequest(
                calls: [call],
                text: text,
                sourceLanguage: sourceLanguage,
                targetLanguage: targetLanguage,
                kind: .translate,
                requestId: requestId
            )
            configuration = nil
            let timeout = DispatchWorkItem { [weak self] in
                guard let self = self else { return }
                guard let request = self.pendingRequest, request.requestId == requestId else { return }
                self.resolvePendingRequest(reason: "translation_timeout")
            }
            timeoutWorkItem = timeout
            DispatchQueue.main.asyncAfter(deadline: .now() + translationRequestTimeoutSeconds, execute: timeout)
            DispatchQueue.main.async { [weak self] in
                guard let self = self else { return }
                guard let request = self.pendingRequest, request.requestId == requestId else { return }
                self.configuration = TranslationSession.Configuration(
                    source: Locale.Language(identifier: request.sourceLanguage),
                    target: Locale.Language(identifier: request.targetLanguage)
                )
            }
        }

        func submitPrepare(call: CAPPluginCall, sourceLanguage: String, targetLanguage: String) {
            if var request = pendingRequest,
               request.kind == .prepare,
               request.sourceLanguage == sourceLanguage,
               request.targetLanguage == targetLanguage {
                request.calls.append(call)
                pendingRequest = request
                return
            }
            resolvePendingRequest(reason: "superseded")
            requestCounter += 1
            let requestId = requestCounter
            pendingRequest = PendingRequest(
                calls: [call],
                text: "",
                sourceLanguage: sourceLanguage,
                targetLanguage: targetLanguage,
                kind: .prepare,
                requestId: requestId
            )
            configuration = nil
            let timeout = DispatchWorkItem { [weak self] in
                guard let self = self else { return }
                guard let request = self.pendingRequest, request.requestId == requestId else { return }
                self.resolvePendingRequest(reason: "prepare_timeout")
            }
            timeoutWorkItem = timeout
            DispatchQueue.main.asyncAfter(deadline: .now() + prepareRequestTimeoutSeconds, execute: timeout)
            DispatchQueue.main.async { [weak self] in
                guard let self = self else { return }
                guard let request = self.pendingRequest, request.requestId == requestId else { return }
                self.configuration = TranslationSession.Configuration(
                    source: Locale.Language(identifier: request.sourceLanguage),
                    target: Locale.Language(identifier: request.targetLanguage)
                )
            }
        }

        func handleSession(_ session: TranslationSession) async {
            guard let request = pendingRequest else { return }
            do {
                try await session.prepareTranslation()
                if request.kind == .prepare {
                    guard pendingRequest?.requestId == request.requestId else { return }
                    let payload: [String: Any] = [
                        "available": true,
                        "sourceLanguage": request.sourceLanguage,
                        "targetLanguage": request.targetLanguage,
                        "sourceText": "",
                        "translatedText": "",
                        "engine": "ios-translation",
                        "modelDownloaded": true,
                        "languageStatus": "installed",
                        "reason": ""
                    ]
                    resolvePendingRequest(request: request, payload: payload)
                    return
                }
                let response = try await session.translate(request.text)
                guard pendingRequest?.requestId == request.requestId else { return }
                let payload: [String: Any] = [
                    "available": true,
                    "sourceLanguage": request.sourceLanguage,
                    "targetLanguage": request.targetLanguage,
                    "sourceText": request.text,
                    "translatedText": response.targetText,
                    "engine": "ios-translation",
                    "modelDownloaded": true
                ]
                resolvePendingRequest(request: request, payload: payload)
            } catch {
                guard pendingRequest?.requestId == request.requestId else { return }
                let payload: [String: Any] = [
                    "available": false,
                    "sourceLanguage": request.sourceLanguage,
                    "targetLanguage": request.targetLanguage,
                    "sourceText": request.kind == .prepare ? "" : request.text,
                    "translatedText": "",
                    "engine": "ios-translation",
                    "reason": String(describing: error)
                ]
                resolvePendingRequest(request: request, payload: payload)
            }
        }

        private func resolvePendingRequest(reason: String) {
            guard let request = pendingRequest else { return }
            let payload: [String: Any] = [
                "available": false,
                "sourceLanguage": request.sourceLanguage,
                "targetLanguage": request.targetLanguage,
                "sourceText": request.text,
                "translatedText": "",
                "engine": "ios-translation",
                "reason": reason
            ]
            resolvePendingRequest(request: request, payload: payload)
        }

        private func resolvePendingRequest(request: PendingRequest, payload: [String: Any]) {
            if !Thread.isMainThread {
                DispatchQueue.main.async { [weak self] in
                    self?.resolvePendingRequest(request: request, payload: payload)
                }
                return
            }
            guard pendingRequest?.requestId == request.requestId else { return }
            timeoutWorkItem?.cancel()
            timeoutWorkItem = nil
            request.calls.forEach { call in
                onResolve?(call, payload)
            }
            pendingRequest = nil
            configuration = nil
        }
    }

    @available(iOS 18.0, *)
    private struct P4w4TranslationBridgeView: View {
        @ObservedObject var model: P4w4TranslationBridgeModel

        var body: some View {
            Color.clear
                .frame(width: 1, height: 1)
                .translationTask(model.configuration) { session in
                    await model.handleSession(session)
                }
        }
    }

    @available(iOS 26.0, *)
    private func translateTextDirect(call: CAPPluginCall, text: String, sourceLanguage: String, targetLanguage: String) {
        Task {
            do {
                let source = Locale.Language(identifier: sourceLanguage)
                let target = Locale.Language(identifier: targetLanguage)
                let availability = LanguageAvailability()
                let status = await availability.status(from: source, to: target)
                guard status == .installed else {
                    DispatchQueue.main.async {
                        call.resolve([
                            "available": false,
                            "sourceLanguage": sourceLanguage,
                            "targetLanguage": targetLanguage,
                            "sourceText": text,
                            "translatedText": "",
                            "engine": "ios-translation-direct",
                            "languageStatus": String(describing: status),
                            "modelDownloaded": false,
                            "reason": "language_status_\(String(describing: status))"
                        ])
                    }
                    return
                }
                let session = TranslationSession(installedSource: source, target: target)
                let response = try await session.translate(text)
                DispatchQueue.main.async {
                    call.resolve([
                        "available": true,
                        "sourceLanguage": sourceLanguage,
                        "targetLanguage": targetLanguage,
                        "sourceText": text,
                        "translatedText": response.targetText,
                        "engine": "ios-translation-direct",
                        "languageStatus": "installed",
                        "modelDownloaded": true
                    ])
                }
            } catch {
                DispatchQueue.main.async {
                    call.resolve([
                        "available": false,
                        "sourceLanguage": sourceLanguage,
                        "targetLanguage": targetLanguage,
                        "sourceText": text,
                        "translatedText": "",
                        "engine": "ios-translation-direct",
                        "languageStatus": "error",
                        "modelDownloaded": false,
                        "reason": String(describing: error)
                    ])
                }
            }
        }
    }
#endif

    @objc func getTranslationStatus(_ call: CAPPluginCall) {
        let sourceLanguage = normalizeTranslationStatusLanguageCode(call.getString("sourceLanguage") ?? "es")
        let targetLanguage = normalizeTranslationStatusLanguageCode(call.getString("targetLanguage") ?? "en")

        #if canImport(Translation)
        if #available(iOS 18.0, *) {
            if #available(iOS 26.0, *) {
                let source = Locale.Language(identifier: sourceLanguage)
                let target = Locale.Language(identifier: targetLanguage)
                Task {
                    let status = await LanguageAvailability().status(from: source, to: target)
                    let pairSupported = sourceLanguage == "es" && targetLanguage == "en"
                    let installed = status == .installed
                    let supportedBySystem = status != .unsupported
                    let available = pairSupported && installed
                    let reason: String
                    if !pairSupported {
                        reason = "unsupported_language_pair"
                    } else if !supportedBySystem {
                        reason = "unsupported_language_pair"
                    } else if !installed {
                        reason = "language_status_\(String(describing: status))"
                    } else {
                        reason = ""
                    }
                    DispatchQueue.main.async {
                        call.resolve([
                            "available": available,
                            "supportedPair": pairSupported && supportedBySystem,
                            "engine": "ios-translation-direct",
                            "platform": "ios",
                            "sourceLanguage": sourceLanguage,
                            "targetLanguage": targetLanguage,
                            "modelDownloaded": installed,
                            "languageStatus": String(describing: status),
                            "osVersion": UIDevice.current.systemVersion,
                            "reason": reason
                        ])
                    }
                }
                return
            }
            let pairSupported = sourceLanguage == "es" && targetLanguage == "en"
            call.resolve([
                // iOS 18-25 legacy Translation path does not expose installed/supported model status.
                // Report support separately and keep availability conservative to avoid false positives.
                "available": false,
                "supportedPair": pairSupported,
                "engine": "ios-translation",
                "platform": "ios",
                "sourceLanguage": sourceLanguage,
                "targetLanguage": targetLanguage,
                "modelDownloaded": false,
                "languageStatus": "unknown",
                "osVersion": UIDevice.current.systemVersion,
                "reason": pairSupported ? "language_status_unknown_pre26" : "unsupported_language_pair"
            ])
            return
        }
        call.resolve([
            "available": false,
            "engine": "ios-translation",
            "platform": "ios",
            "sourceLanguage": sourceLanguage,
            "targetLanguage": targetLanguage,
            "modelDownloaded": false,
            "osVersion": UIDevice.current.systemVersion,
            "reason": "requires_ios_18"
        ])
        #else
        call.resolve([
            "available": false,
            "engine": "ios-translation",
            "platform": "ios",
            "sourceLanguage": sourceLanguage,
            "targetLanguage": targetLanguage,
            "modelDownloaded": false,
            "osVersion": UIDevice.current.systemVersion,
            "reason": "translation_framework_unavailable"
        ])
        #endif
    }

    private func normalizeTranslationStatusLanguageCode(_ value: String) -> String {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if trimmed.isEmpty { return "" }
        return trimmed.components(separatedBy: CharacterSet(charactersIn: "-_")).first ?? trimmed
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
            UNUserNotificationCenter.current().removeAllDeliveredNotifications()
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
