import UIKit

enum AppLocale: String, Codable {
    case en
    case es
}

struct AppSessionUser: Codable {
    let id: String
    let token: String
    let email: String
    let displayName: String
    let firstName: String?
    let lastName: String?
    let imageURL: String?

    var resolvedDisplayName: String {
        firstNonEmptyString([displayName, firstName, email]) ?? email
    }

    var initials: String {
        let parts = resolvedDisplayName
            .split(separator: " ")
            .map(String.init)
            .filter { !$0.isEmpty }
        let letters = parts.prefix(2).compactMap { $0.first }
        if letters.isEmpty, let first = email.first {
            return String(first).uppercased()
        }
        return String(letters).uppercased()
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case token
        case email
        case displayName
        case firstName
        case lastName
        case imageURL
    }

    init(
        id: String,
        token: String,
        email: String,
        displayName: String,
        firstName: String? = nil,
        lastName: String? = nil,
        imageURL: String?
    ) {
        self.id = id
        self.token = token
        self.email = email
        self.displayName = displayName
        self.firstName = firstName
        self.lastName = lastName
        self.imageURL = imageURL
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        token = try container.decodeIfPresent(String.self, forKey: .token) ?? ""
        email = try container.decodeIfPresent(String.self, forKey: .email) ?? ""
        displayName = try container.decodeIfPresent(String.self, forKey: .displayName) ?? email
        firstName = try container.decodeIfPresent(String.self, forKey: .firstName)
        lastName = try container.decodeIfPresent(String.self, forKey: .lastName)
        imageURL = try container.decodeIfPresent(String.self, forKey: .imageURL)
    }

    static let mock = AppSessionUser(
        id: "native-poc-user",
        token: "native-poc-token",
        email: "user@domain.com",
        displayName: "John Doe",
        firstName: "John",
        lastName: "Doe",
        imageURL: nil
    )
}

struct AppRewardTotal: Codable, Hashable {
    let icon: String
    let label: String
    let quantity: Int
}

struct AppSession: Codable {
    let locale: AppLocale
    let user: AppSessionUser?
    let planName: String
    let preferredLanguageCode: String
    let rewards: [AppRewardTotal]

    private enum CodingKeys: String, CodingKey {
        case locale
        case user
        case planName
        case preferredLanguageCode
        case rewards
    }

    init(
        locale: AppLocale,
        user: AppSessionUser?,
        planName: String,
        preferredLanguageCode: String,
        rewards: [AppRewardTotal] = []
    ) {
        self.locale = locale
        self.user = user
        self.planName = planName
        self.preferredLanguageCode = preferredLanguageCode
        self.rewards = rewards
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        locale = try container.decode(AppLocale.self, forKey: .locale)
        user = try container.decodeIfPresent(AppSessionUser.self, forKey: .user)
        planName = try container.decodeIfPresent(String.self, forKey: .planName) ?? "Native PoC"
        preferredLanguageCode = try container.decodeIfPresent(String.self, forKey: .preferredLanguageCode) ?? "en-US"
        rewards = try container.decodeIfPresent([AppRewardTotal].self, forKey: .rewards) ?? []
    }

    var isAuthenticated: Bool {
        user != nil
    }

    var userEmail: String? {
        user?.email
    }

    static let loggedOut = AppSession(
        locale: .en,
        user: nil,
        planName: "Native PoC",
        preferredLanguageCode: "en-US",
        rewards: []
    )

    static let mock = AppSession(
        locale: .en,
        user: .mock,
        planName: "Native PoC",
        preferredLanguageCode: "en-US",
        rewards: [
            AppRewardTotal(icon: "diamond", label: "diamonds", quantity: 7),
            AppRewardTotal(icon: "trophy", label: "trophies", quantity: 1)
        ]
    )
}

enum AppLoginError: LocalizedError {
    case api(String)
    case missingUserData
    case invalidResponse

    var errorDescription: String? {
        switch self {
        case let .api(message):
            return message
        case .missingUserData:
            return "Login ok, but without user data"
        case .invalidResponse:
            return "Login error"
        }
    }
}

@MainActor
final class AppSessionStore {
    static let didChangeNotification = Notification.Name("AppSessionStore.didChangeNotification")

    private enum StorageKey {
        static let session = "SpeakAppNative.session"
        static let deviceUUID = "SpeakAppNative.deviceUUID"
    }

    private let defaults: UserDefaults
    private let authClient: LoginAPIClient
    private let rewardsClient: SpeakStateClient

    private(set) var session: AppSession {
        didSet {
            persistSession()
            NotificationCenter.default.post(name: Self.didChangeNotification, object: self)
        }
    }

    init(
        defaults: UserDefaults = .standard,
        authClient: LoginAPIClient = LoginAPIClient(),
        rewardsClient: SpeakStateClient = SpeakStateClient()
    ) {
        self.defaults = defaults
        self.authClient = authClient
        self.rewardsClient = rewardsClient
        self.session = Self.loadSession(from: defaults)
    }

    var isAuthenticated: Bool {
        session.isAuthenticated
    }

    func login(email: String, password: String) async throws -> AppSession {
        let user = try await authClient.login(
            email: email,
            password: password,
            locale: session.locale,
            uuid: deviceUUID()
        )

        let nextSession = AppSession(
            locale: session.locale,
            user: user,
            planName: session.planName,
            preferredLanguageCode: session.preferredLanguageCode,
            rewards: []
        )
        session = nextSession
        Task { @MainActor [weak self] in
            await self?.refreshUserRewards()
        }
        return nextSession
    }

    func logout() {
        session = AppSession(
            locale: session.locale,
            user: nil,
            planName: session.planName,
            preferredLanguageCode: session.preferredLanguageCode,
            rewards: []
        )
    }

    func warmSession() {
        guard session.isAuthenticated else { return }
        Task { @MainActor [weak self] in
            await self?.refreshUserRewards()
        }
    }

    func refreshUserRewards() async {
        guard let user = session.user else { return }

        do {
            let rewards = try await rewardsClient.fetchRewardTotals(userID: user.id)
            guard rewards != session.rewards else { return }

            session = AppSession(
                locale: session.locale,
                user: user,
                planName: session.planName,
                preferredLanguageCode: session.preferredLanguageCode,
                rewards: rewards
            )
        } catch {
            #if DEBUG
            print("[SpeakState] rewards refresh failed: \(error)")
            #endif
        }
    }

    private func persistSession() {
        guard let data = try? JSONEncoder().encode(session) else { return }
        defaults.set(data, forKey: StorageKey.session)
    }

    private func deviceUUID() -> String {
        if let stored = defaults.string(forKey: StorageKey.deviceUUID), !stored.isEmpty {
            return stored
        }

        let uuid = UIDevice.current.identifierForVendor?.uuidString ?? UUID().uuidString
        defaults.set(uuid, forKey: StorageKey.deviceUUID)
        return uuid
    }

    private static func loadSession(from defaults: UserDefaults) -> AppSession {
        guard let data = defaults.data(forKey: StorageKey.session) else {
            return .loggedOut
        }
        return (try? JSONDecoder().decode(AppSession.self, from: data)) ?? .loggedOut
    }
}

struct LoginAPIClient {
    private let baseURL = URL(string: "https://api.curso-ingles.com")!
    private let authorizationHeader = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

    func login(email: String, password: String, locale: AppLocale, uuid: String) async throws -> AppSessionUser {
        var request = URLRequest(url: baseURL.appendingPathComponent("v3/usr/login"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(authorizationHeader, forHTTPHeaderField: "Authorization")
        request.setValue(platformIdentifier(), forHTTPHeaderField: "X-Platform")

        let payload: [String: Any] = [
            "email": email,
            "pass": password,
            "locale": locale.rawValue,
            "uuid": uuid,
            "timestamp": Int(Date().timeIntervalSince1970)
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw AppLoginError.invalidResponse
        }

        let json = try parseJSON(from: data)
        if let message = errorMessage(from: json) {
            throw AppLoginError.api(message)
        }
        guard (200 ... 299).contains(httpResponse.statusCode) else {
            throw AppLoginError.api("Login error")
        }

        guard
            let root = json as? [String: Any],
            let userPayload = root["user"] as? [String: Any]
        else {
            throw AppLoginError.missingUserData
        }

        let normalizedEmail = stringValue(userPayload["email"]) ?? email
        let firstName = stringValue(userPayload["first_name"])
        let lastName = stringValue(userPayload["last_name"])
        let displayName = firstNonEmptyString([
            stringValue(userPayload["name"]),
            firstName,
            stringValue(userPayload["username"]),
            stringValue(userPayload["user"]),
            stringValue(userPayload["social_id"]),
            normalizedEmail
        ]) ?? normalizedEmail
        let imageURL = firstNonEmptyString([
            stringValue(userPayload["image_local"]),
            stringValue(userPayload["image"])
        ])

        return AppSessionUser(
            id: stringValue(userPayload["id"]) ?? UUID().uuidString,
            token: stringValue(userPayload["token"]) ?? "",
            email: normalizedEmail,
            displayName: displayName,
            firstName: firstName,
            lastName: lastName,
            imageURL: imageURL
        )
    }

    private func parseJSON(from data: Data) throws -> Any? {
        guard !data.isEmpty else { return nil }
        return try JSONSerialization.jsonObject(with: data)
    }

    private func errorMessage(from json: Any?) -> String? {
        if let text = json as? String, !text.isEmpty {
            return text
        }

        guard let dict = json as? [String: Any] else { return nil }
        if let message = stringValue(dict["error"]), !message.isEmpty {
            return message
        }
        if
            let payload = dict["data"] as? [String: Any],
            let message = stringValue(payload["error"]),
            !message.isEmpty
        {
            return message
        }
        if
            let errors = dict["errors"] as? [String: Any],
            let firstKey = errors.keys.sorted().first,
            let message = stringValue(errors[firstKey]),
            !message.isEmpty
        {
            return message
        }

        return nil
    }

    private func stringValue(_ value: Any?) -> String? {
        switch value {
        case let string as String:
            return string
        case let number as NSNumber:
            return number.stringValue
        default:
            return nil
        }
    }

    private func platformIdentifier() -> String {
        let model = UIDevice.current.model
        let systemVersion = UIDevice.current.systemVersion
        return "iOS-native-poc/\(model)/\(systemVersion)"
    }
}

struct SpeakStateClient {
    private let snapshotURL = URL(string: "https://realtime.curso-ingles.com/realtime/state")!
    private let stateToken = RealtimeEnvironment.stateToken

    func fetchRewardTotals(userID: String) async throws -> [AppRewardTotal] {
        var components = URLComponents(url: snapshotURL, resolvingAgainstBaseURL: false)
        components?.queryItems = [URLQueryItem(name: "owner", value: "user:\(userID)")]

        guard let url = components?.url else {
            return []
        }

        var request = URLRequest(url: url)
        if !stateToken.isEmpty {
            request.setValue(stateToken, forHTTPHeaderField: "x-rt-token")
        }

        let (data, response) = try await URLSession.shared.data(for: request)
        guard
            let httpResponse = response as? HTTPURLResponse,
            (200 ... 299).contains(httpResponse.statusCode)
        else {
            return []
        }

        guard
            let root = try parseJSON(from: data) as? [String: Any]
        else {
            return []
        }

        let snapshot = (root["snapshot"] as? [String: Any]) ?? root
        let rewardsPayload = snapshot["session_rewards"] as? [String: Any] ?? [:]

        var totals: [String: (label: String, quantity: Int)] = [:]
        for value in rewardsPayload.values {
            guard let payload = value as? [String: Any] else { continue }

            let quantity = intValue(payload["rewardQty"]) ?? intValue(payload["reward_qty"]) ?? 0
            guard quantity > 0 else { continue }

            let icon = firstNonEmptyString([
                stringValue(payload["rewardIcon"]),
                stringValue(payload["reward_icon"]),
                "diamond"
            ]) ?? "diamond"
            let label = firstNonEmptyString([
                stringValue(payload["rewardLabel"]),
                stringValue(payload["reward_label"]),
                icon
            ]) ?? icon

            let current = totals[icon] ?? (label, 0)
            totals[icon] = (current.label, current.quantity + quantity)
        }

        return totals
            .map { AppRewardTotal(icon: $0.key, label: $0.value.label, quantity: $0.value.quantity) }
            .sorted { $0.icon < $1.icon }
    }

    private func parseJSON(from data: Data) throws -> Any? {
        guard !data.isEmpty else { return nil }
        return try JSONSerialization.jsonObject(with: data)
    }

    private func stringValue(_ value: Any?) -> String? {
        switch value {
        case let string as String:
            return string
        case let number as NSNumber:
            return number.stringValue
        default:
            return nil
        }
    }

    private func intValue(_ value: Any?) -> Int? {
        switch value {
        case let number as NSNumber:
            return number.intValue
        case let string as String:
            return Int(string)
        default:
            return nil
        }
    }
}

enum RealtimeEnvironment {
    static let stateToken = "ca6c8ad7c431233c1d891f2bd9eebc1dbb0de269c690de994e2313b8c7e7a50"
}

private func firstNonEmptyString(_ values: [String?]) -> String? {
    values
        .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
        .first { !$0.isEmpty }
}

struct AppCopy: Decodable {
    let tabs: TabCopy
    let notifications: NotificationsCopy
    let login: LoginCopy
    let home: HomeCopy
    let freeRide: FreeRideCopy
    let reference: ReferenceCopy
    let chat: ChatCopy
    let profile: ProfileCopy
    let native: NativeCopy

    static func fallback(locale: AppLocale) -> AppCopy {
        switch locale {
        case .es:
            return AppCopy(
                tabs: TabCopy(training: "Training", lab: "Lab", reference: "Referencia", you: "You", chat: "Chat"),
                notifications: NotificationsCopy(
                    title: "Notificaciones",
                    recentActivity: "Actividad reciente",
                    empty: "No hay notificaciones todavía.",
                    statusNew: "Nueva",
                    statusRead: "Leída",
                    deleteAction: "Eliminar",
                    openAction: "Abrir",
                    elapsedNow: "Hace un momento",
                    elapsedMinutes: "Hace {n} min",
                    elapsedHours: "Hace {n} h",
                    elapsedDays: "Hace {n} d",
                    pushDefaultTitle: "Nueva notificación",
                    defaultTitle: "Notificación",
                    demo: NotificationDemoCopy(
                        weakWordsTitle: "Tienes {n} palabras flojas",
                        weakWordsText: "Ve a Review y mejora tu pronunciación.",
                        weakWordsAction: "Revisar",
                        badgeTitle: "Nuevo badge desbloqueado",
                        badgeText: "Racha de 3 días completada.",
                        badgeAction: "Ver perfil",
                        practiceTitle: "Mini práctica lista",
                        practiceText: "Solo 2 minutos para hoy.",
                        practiceAction: "Practicar",
                        coachTitle: "Coach listo para ti",
                        coachText: "Pregunta algo al coach.",
                        coachAction: "Abrir coach",
                        reminderTitle: "Recordatorio",
                        reminderText: "Practica 5 minutos hoy.",
                        reminderAction: "Ir a Home",
                        infoTitle: "Novedad",
                        infoText: "Hay nuevos ejercicios disponibles."
                    )
                ),
                login: LoginCopy(
                    title: "Login",
                    close: "Cerrar",
                    socialGoogle: "Login con Google",
                    socialFacebook: "Login con Facebook",
                    socialApple: "Login con Apple",
                    createWithEmail: "Crear cuenta con email",
                    userLabel: "Usuario",
                    userPlaceholder: "tu usuario",
                    passLabel: "Contraseña",
                    passPlaceholder: "********",
                    enter: "Entrar",
                    forgotPassword: "Recuperar contraseña",
                    registerTitle: "Crear cuenta",
                    registerSubtitle: "Completa tus datos para registrarte.",
                    registerUserLabel: "Nombre de usuario",
                    registerUserPlaceholder: "tu nombre",
                    registerEmailLabel: "Email",
                    registerEmailPlaceholder: "tu email",
                    registerPassLabel: "Contraseña",
                    registerPassPlaceholder: "********",
                    registerPassConfirmLabel: "Confirmar contraseña",
                    registerPassConfirmPlaceholder: "********",
                    registerTerms: "Acepto los términos de uso",
                    registerSubmit: "Crear cuenta",
                    registerBack: "Volver al login",
                    recoverTitle: "Recuperar contraseña",
                    recoverSubtitle: "Te enviaremos un email para restablecerla.",
                    recoverEmailLabel: "Email",
                    recoverEmailPlaceholder: "tu email",
                    recoverSubmit: "Enviar instrucciones",
                    recoverBack: "Volver al login",
                    alertHeader: "Aviso",
                    alertOk: "Ok",
                    errors: LoginErrorsCopy(
                        loginGeneric: "Error de login",
                        loginInvalidUser: "El usuario no es válido",
                        loginInvalidPassword: "La contraseña no es válida",
                        loginNoUserData: "Login correcto, pero sin datos de usuario",
                        socialAppleUnavailable: "Login con Apple no disponible.",
                        socialAppleOnlyApp: "Login con Apple solo disponible en la app.",
                        socialAppleOpenFailed: "No se pudo abrir Apple.",
                        socialGoogleUnavailable: "Login con Google no disponible.",
                        socialGoogleOnlyApp: "Login con Google solo disponible en la app.",
                        socialGoogleOpenFailed: "No se pudo abrir Google.",
                        socialFacebookUnavailable: "Login con Facebook no disponible.",
                        socialFacebookOnlyApp: "Login con Facebook solo disponible en la app.",
                        socialFacebookOpenFailed: "No se pudo abrir Facebook.",
                        registerMissingFields: "Por favor completa todos los campos.",
                        registerPasswordMismatch: "La confirmación no coincide con la contraseña.",
                        registerTermsRequired: "Debes aceptar los términos de uso.",
                        registerFailed: "Error creando cuenta",
                        recoverEmailRequired: "Debes introducir tu email.",
                        recoverFailed: "No se pudo enviar el email"
                    ),
                    info: LoginInfoCopy(
                        registerSuccess: "Gracias. Revisa tu email para activar la cuenta.",
                        recoverSuccess: "Te enviamos un email con las instrucciones."
                    )
                ),
                home: HomeCopy(
                    planTitle: "Tu plan",
                    planMessage: "Este es tu plan para sonar como nativo.<br>Toca esta tarjeta para escucharlo otra vez."
                ),
                freeRide: FreeRideCopy(
                    title: "Lab",
                    subtitle: "Escribe tu frase o texto y practica pronunciación libre.",
                    inputLabel: "Tu frase",
                    inputPlaceholder: "Ejemplo: I would like to order a coffee, please.",
                    emptyPhrase: "Escribe una frase para practicar.",
                    playPhrase: "Escuchar frase",
                    sayLabel: "Habla",
                    endLabel: "Fin",
                    yourVoiceLabel: "Tu voz",
                    feedbackHint: "Practica la frase",
                    feedbackNative: "Suena como un nativo",
                    feedbackGood: "Bien. Sigue practicando",
                    feedbackAlmost: "Casi correcto",
                    feedbackKeep: "Sigue practicando",
                    transcribing: "Transcribiendo...",
                    savePhrase: "Guardar frase",
                    myPhrases: "Mis frases",
                    savedPhrasesTitle: "Frases guardadas",
                    savedPhrasesSubtitle: "Recupera una frase para practicarla de nuevo.",
                    noSavedPhrasesYet: "No tienes frases guardadas todavía.",
                    savedPhrasesHint: "Guarda una frase desde Lab y aparecerá aquí.",
                    usePhrase: "Usar frase",
                    deletePhrase: "Borrar",
                    savedPhraseSavedToast: "Frase guardada.",
                    savedPhraseUpdatedToast: "Frase actualizada.",
                    savedPhraseLoadedToast: "Frase cargada.",
                    savedPhraseDeletedToast: "Frase borrada.",
                    advanced: "Avanzado",
                    evaluatingPronunciation: "Evaluando pronunciación...",
                    transcript: "Transcrito",
                    transcriptAdvanced: "Transcrito (avanzado)",
                    overall: "Global",
                    accuracy: "Precisión",
                    fluency: "Fluidez",
                    completeness: "Completitud"
                ),
                reference: ReferenceCopy(title: "Referencia", subtitle: "Explora cursos, unidades y lecciones para consultar contenido."),
                chat: ChatCopy(
                    coachChatbotTitle: "Coach de IA",
                    coachChatbotSubtitle: "Interactúa libremente con el tutor de Inglés.",
                    loginRequired: "Debes iniciar sesión para usar el coach de chat.",
                    loginCta: "Iniciar sesión",
                    loadingUser: "Cargando estado de usuario...",
                    inputPlaceholder: "Escribe tu mensaje...",
                    send: "Enviar",
                    listenAgain: "Escuchar de nuevo",
                    playingNow: "Reproduciendo",
                    retrySend: "Reintentar",
                    realtimeDisconnected: "Conexión en tiempo real no disponible. Reintentando...",
                    serverUnavailable: "El servidor no está disponible ahora mismo. Inténtalo más tarde.",
                    typingAria: "Escribiendo...",
                    introChatbot: "Hi!, i am your English teacher, how can i help you?"
                ),
                profile: ProfileCopy(
                    accessPill: "Acceso",
                    loginTitle: "Inicia sesión",
                    loginSubtitle: "Debes iniciar sesión para ver tu perfil.",
                    loginCta: "Iniciar sesión",
                    rewardsTitle: "Premios",
                    rewardsEmpty: "Todavía no tienes premios.",
                    tabPrefs: "Perfil"
                ),
                native: NativeCopy(
                    appTitle: "SpeakApp Native",
                    titleBarSubtitle: "Doble tap para ver diagnostics.",
                    notificationsButton: "Notificaciones",
                    logoutButton: "Salir",
                    sessionUserLabel: "Sesión",
                    sessionLocaleLabel: "Idioma",
                    sessionPlanLabel: "Plan",
                    diagnostics: NativeDiagnosticsCopy(
                        title: "Diagnostics",
                        subtitle: "Estado local del PoC nativo en iOS.",
                        versionTitle: "Versión",
                        bundleTitle: "Bundle",
                        localeTitle: "Idioma",
                        userTitle: "Usuario",
                        tabsTitle: "Tabs",
                        platformTitle: "Plataforma",
                        assetsTitle: "Assets"
                    ),
                    screens: NativeScreensCopy(
                        training: NativeScreenCopy(
                            eyebrow: "Shell nativa",
                            title: "Training",
                            message: "Placeholder para el loop diario de entrenamiento, racha y CTA principal.",
                            callout: "Alineado con `home.planTitle` y la narrativa del plan actual.",
                            asset: "BrandMark",
                            highlights: ["Resumen del día", "Continuar sesión", "Métricas rápidas"]
                        ),
                        lab: NativeScreenCopy(
                            eyebrow: "Entrada libre",
                            title: "Lab",
                            message: "Placeholder para práctica abierta de pronunciación con texto libre.",
                            callout: "Alineado con `freeRide.title` y `freeRide.subtitle`.",
                            asset: "BrandMark",
                            highlights: ["Texto libre", "Acceso a micrófono", "Feedback futuro"]
                        ),
                        reference: NativeScreenCopy(
                            eyebrow: "Consulta",
                            title: "Reference",
                            message: "Placeholder para navegador nativo de cursos, unidades y lecciones.",
                            callout: "Alineado con `reference.title` y `reference.subtitle`.",
                            asset: "FlagEN",
                            highlights: ["Cursos", "Unidades", "Lecciones"]
                        ),
                        you: NativeScreenCopy(
                            eyebrow: "Cuenta",
                            title: "You",
                            message: "Placeholder para perfil, progreso y review del usuario.",
                            callout: "Alineado con `profile.tabPrefs` y el estado de sesión mock.",
                            asset: "Mascot",
                            highlights: ["Perfil", "Review", "Badges"]
                        ),
                        chat: NativeScreenCopy(
                            eyebrow: "Tutor",
                            title: "Chat",
                            message: "Placeholder para el coach de IA nativo y la futura capa realtime/audio.",
                            callout: "Alineado con `chat.coachChatbotTitle` y `chat.coachChatbotSubtitle`.",
                            asset: "Chatbot",
                            highlights: ["Coach IA", "Estado de conexión", "Input conversacional"]
                        )
                    )
                )
            )
        case .en:
            return AppCopy(
                tabs: TabCopy(training: "Training", lab: "Lab", reference: "Reference", you: "You", chat: "Chat"),
                notifications: NotificationsCopy(
                    title: "Notifications",
                    recentActivity: "Recent activity",
                    empty: "No notifications yet.",
                    statusNew: "New",
                    statusRead: "Read",
                    deleteAction: "Delete",
                    openAction: "Open",
                    elapsedNow: "Just now",
                    elapsedMinutes: "{n} min ago",
                    elapsedHours: "{n} h ago",
                    elapsedDays: "{n} d ago",
                    pushDefaultTitle: "New notification",
                    defaultTitle: "Notification",
                    demo: NotificationDemoCopy(
                        weakWordsTitle: "You have {n} weak words",
                        weakWordsText: "Go to Review and improve pronunciation.",
                        weakWordsAction: "Review",
                        badgeTitle: "New badge unlocked",
                        badgeText: "3-day streak completed.",
                        badgeAction: "View profile",
                        practiceTitle: "Mini practice ready",
                        practiceText: "Just 2 minutes for today.",
                        practiceAction: "Practice",
                        coachTitle: "Coach is ready",
                        coachText: "Ask the coach something.",
                        coachAction: "Open coach",
                        reminderTitle: "Reminder",
                        reminderText: "Practice 5 minutes today.",
                        reminderAction: "Go to Home",
                        infoTitle: "Update",
                        infoText: "New exercises are available."
                    )
                ),
                login: LoginCopy(
                    title: "Login",
                    close: "Close",
                    socialGoogle: "Login with Google",
                    socialFacebook: "Login with Facebook",
                    socialApple: "Login with Apple",
                    createWithEmail: "Create account with email",
                    userLabel: "User",
                    userPlaceholder: "your user",
                    passLabel: "Password",
                    passPlaceholder: "********",
                    enter: "Enter",
                    forgotPassword: "Recover password",
                    registerTitle: "Create account",
                    registerSubtitle: "Complete your details to register.",
                    registerUserLabel: "Username",
                    registerUserPlaceholder: "your name",
                    registerEmailLabel: "Email",
                    registerEmailPlaceholder: "your email",
                    registerPassLabel: "Password",
                    registerPassPlaceholder: "********",
                    registerPassConfirmLabel: "Confirm password",
                    registerPassConfirmPlaceholder: "********",
                    registerTerms: "I accept the terms of use",
                    registerSubmit: "Create account",
                    registerBack: "Back to login",
                    recoverTitle: "Recover password",
                    recoverSubtitle: "We will send you an email to reset it.",
                    recoverEmailLabel: "Email",
                    recoverEmailPlaceholder: "your email",
                    recoverSubmit: "Send instructions",
                    recoverBack: "Back to login",
                    alertHeader: "Notice",
                    alertOk: "Ok",
                    errors: LoginErrorsCopy(
                        loginGeneric: "Login error",
                        loginInvalidUser: "User is not valid",
                        loginInvalidPassword: "Password is not valid",
                        loginNoUserData: "Login ok, but without user data",
                        socialAppleUnavailable: "Apple login is not available.",
                        socialAppleOnlyApp: "Apple login is only available in the app.",
                        socialAppleOpenFailed: "Could not open Apple.",
                        socialGoogleUnavailable: "Google login is not available.",
                        socialGoogleOnlyApp: "Google login is only available in the app.",
                        socialGoogleOpenFailed: "Could not open Google.",
                        socialFacebookUnavailable: "Facebook login is not available.",
                        socialFacebookOnlyApp: "Facebook login is only available in the app.",
                        socialFacebookOpenFailed: "Could not open Facebook.",
                        registerMissingFields: "Please complete all fields.",
                        registerPasswordMismatch: "Confirmation does not match password.",
                        registerTermsRequired: "You must accept the terms of use.",
                        registerFailed: "Error creating account",
                        recoverEmailRequired: "You must enter your email.",
                        recoverFailed: "Could not send email"
                    ),
                    info: LoginInfoCopy(
                        registerSuccess: "Thanks. Check your email to activate your account.",
                        recoverSuccess: "We sent you an email with reset instructions."
                    )
                ),
                home: HomeCopy(
                    planTitle: "Your plan",
                    planMessage: "This is your plan to sound like a native.<br>Tap this card to hear it again."
                ),
                freeRide: FreeRideCopy(
                    title: "Lab",
                    subtitle: "Write your own phrase or longer text and practice freely.",
                    inputLabel: "Your phrase",
                    inputPlaceholder: "Example: I would like to order a coffee, please.",
                    emptyPhrase: "Write a phrase to practice.",
                    playPhrase: "Play phrase",
                    sayLabel: "Say",
                    endLabel: "End",
                    yourVoiceLabel: "Your voice",
                    feedbackHint: "Practice the phrase",
                    feedbackNative: "You sound like a native",
                    feedbackGood: "Good! Continue practicing",
                    feedbackAlmost: "Almost correct",
                    feedbackKeep: "Keep practicing",
                    transcribing: "Transcribing...",
                    savePhrase: "Save phrase",
                    myPhrases: "My phrases",
                    savedPhrasesTitle: "Saved phrases",
                    savedPhrasesSubtitle: "Load a phrase to practice again.",
                    noSavedPhrasesYet: "You do not have saved phrases yet.",
                    savedPhrasesHint: "Save a phrase from Lab and it will appear here.",
                    usePhrase: "Use phrase",
                    deletePhrase: "Delete",
                    savedPhraseSavedToast: "Phrase saved.",
                    savedPhraseUpdatedToast: "Phrase updated.",
                    savedPhraseLoadedToast: "Phrase loaded.",
                    savedPhraseDeletedToast: "Phrase deleted.",
                    advanced: "Advanced",
                    evaluatingPronunciation: "Evaluating pronunciation...",
                    transcript: "Transcript",
                    transcriptAdvanced: "Transcript (Advanced)",
                    overall: "Overall",
                    accuracy: "Accuracy",
                    fluency: "Fluency",
                    completeness: "Completeness"
                ),
                reference: ReferenceCopy(title: "Reference", subtitle: "Browse courses, units, and lessons to review content."),
                chat: ChatCopy(
                    coachChatbotTitle: "AI coach",
                    coachChatbotSubtitle: "Chat freely with your English tutor.",
                    loginRequired: "You need to sign in to use the chat coach.",
                    loginCta: "Sign in",
                    loadingUser: "Loading user state...",
                    inputPlaceholder: "Type your message...",
                    send: "Send",
                    listenAgain: "Listen again",
                    playingNow: "Playing",
                    retrySend: "Retry",
                    realtimeDisconnected: "Realtime connection unavailable. Reconnecting...",
                    serverUnavailable: "The server is not available right now. Please try again later.",
                    typingAria: "Typing...",
                    introChatbot: "Hi!, i am your English teacher, how can i help you?"
                ),
                profile: ProfileCopy(
                    accessPill: "Access",
                    loginTitle: "Sign in",
                    loginSubtitle: "You need to sign in to view your profile.",
                    loginCta: "Sign in",
                    rewardsTitle: "Rewards",
                    rewardsEmpty: "You do not have rewards yet.",
                    tabPrefs: "Profile"
                ),
                native: NativeCopy(
                    appTitle: "SpeakApp Native",
                    titleBarSubtitle: "Double tap to open diagnostics.",
                    notificationsButton: "Notifications",
                    logoutButton: "Logout",
                    sessionUserLabel: "Session",
                    sessionLocaleLabel: "Locale",
                    sessionPlanLabel: "Plan",
                    diagnostics: NativeDiagnosticsCopy(
                        title: "Diagnostics",
                        subtitle: "Local status for the native iOS proof of concept.",
                        versionTitle: "Version",
                        bundleTitle: "Bundle",
                        localeTitle: "Locale",
                        userTitle: "User",
                        tabsTitle: "Tabs",
                        platformTitle: "Platform",
                        assetsTitle: "Assets"
                    ),
                    screens: NativeScreensCopy(
                        training: NativeScreenCopy(
                            eyebrow: "Native shell",
                            title: "Training",
                            message: "Placeholder for the daily training loop, streak, and primary CTA.",
                            callout: "Aligned with `home.planTitle` and the current plan narrative.",
                            asset: "BrandMark",
                            highlights: ["Daily summary", "Continue session", "Quick metrics"]
                        ),
                        lab: NativeScreenCopy(
                            eyebrow: "Free practice",
                            title: "Lab",
                            message: "Placeholder for open pronunciation practice with free text input.",
                            callout: "Aligned with `freeRide.title` and `freeRide.subtitle`.",
                            asset: "BrandMark",
                            highlights: ["Free text", "Microphone entry", "Future feedback loop"]
                        ),
                        reference: NativeScreenCopy(
                            eyebrow: "Browse",
                            title: "Reference",
                            message: "Placeholder for a native browser of courses, units, and lessons.",
                            callout: "Aligned with `reference.title` and `reference.subtitle`.",
                            asset: "FlagEN",
                            highlights: ["Courses", "Units", "Lessons"]
                        ),
                        you: NativeScreenCopy(
                            eyebrow: "Account",
                            title: "You",
                            message: "Placeholder for profile, progress, and review areas.",
                            callout: "Aligned with `profile.tabPrefs` and the mocked signed-in state.",
                            asset: "Mascot",
                            highlights: ["Profile", "Review", "Badges"]
                        ),
                        chat: NativeScreenCopy(
                            eyebrow: "Coach",
                            title: "Chat",
                            message: "Placeholder for the native AI coach and future realtime/audio layer.",
                            callout: "Aligned with `chat.coachChatbotTitle` and `chat.coachChatbotSubtitle`.",
                            asset: "Chatbot",
                            highlights: ["AI coach", "Connection state", "Conversation input"]
                        )
                    )
                )
            )
        }
    }

    func tabTitle(for screen: RootScreen) -> String {
        switch screen {
        case .training: return tabs.training
        case .lab: return tabs.lab
        case .reference: return tabs.reference
        case .you: return tabs.you
        case .chat: return tabs.chat
        }
    }

    func placeholderSubtitle(for screen: RootScreen) -> String {
        switch screen {
        case .training:
            return Self.flattenHTML(home.planMessage)
        case .lab:
            return freeRide.subtitle
        case .reference:
            return reference.subtitle
        case .you:
            return profile.loginSubtitle
        case .chat:
            return chat.coachChatbotSubtitle
        }
    }

    func screenCopy(for screen: RootScreen) -> NativeScreenCopy {
        switch screen {
        case .training: return native.screens.training
        case .lab: return native.screens.lab
        case .reference: return native.screens.reference
        case .you: return native.screens.you
        case .chat: return native.screens.chat
        }
    }

    func notificationItems() -> [NotificationItem] {
        let demo = notifications.demo
        return [
            NotificationItem(
                title: demo.weakWordsTitle.applying(["n": "12"]),
                body: demo.weakWordsText,
                action: demo.weakWordsAction,
                elapsed: notifications.elapsedMinutes.applying(["n": "2"]),
                status: notifications.statusNew,
                isNew: true
            ),
            NotificationItem(
                title: demo.badgeTitle,
                body: demo.badgeText,
                action: demo.badgeAction,
                elapsed: notifications.elapsedHours.applying(["n": "1"]),
                status: notifications.statusNew,
                isNew: true
            ),
            NotificationItem(
                title: demo.practiceTitle,
                body: demo.practiceText,
                action: demo.practiceAction,
                elapsed: notifications.elapsedHours.applying(["n": "5"]),
                status: notifications.statusRead,
                isNew: false
            ),
            NotificationItem(
                title: demo.coachTitle,
                body: demo.coachText,
                action: demo.coachAction,
                elapsed: notifications.elapsedDays.applying(["n": "1"]),
                status: notifications.statusRead,
                isNew: false
            ),
            NotificationItem(
                title: demo.reminderTitle,
                body: demo.reminderText,
                action: demo.reminderAction,
                elapsed: notifications.elapsedDays.applying(["n": "2"]),
                status: notifications.statusRead,
                isNew: false
            ),
            NotificationItem(
                title: demo.infoTitle,
                body: demo.infoText,
                action: notifications.openAction,
                elapsed: notifications.elapsedDays.applying(["n": "3"]),
                status: notifications.statusRead,
                isNew: false
            )
        ]
    }

    private static func flattenHTML(_ text: String) -> String {
        text
            .replacingOccurrences(of: "<br>", with: " ")
            .replacingOccurrences(of: "<strong>", with: "")
            .replacingOccurrences(of: "</strong>", with: "")
    }
}

struct TabCopy: Decodable {
    let training: String
    let lab: String
    let reference: String
    let you: String
    let chat: String
}

struct NotificationsCopy: Decodable {
    let title: String
    let recentActivity: String
    let empty: String
    let statusNew: String
    let statusRead: String
    let deleteAction: String
    let openAction: String
    let elapsedNow: String
    let elapsedMinutes: String
    let elapsedHours: String
    let elapsedDays: String
    let pushDefaultTitle: String
    let defaultTitle: String
    let demo: NotificationDemoCopy
}

struct NotificationDemoCopy: Decodable {
    let weakWordsTitle: String
    let weakWordsText: String
    let weakWordsAction: String
    let badgeTitle: String
    let badgeText: String
    let badgeAction: String
    let practiceTitle: String
    let practiceText: String
    let practiceAction: String
    let coachTitle: String
    let coachText: String
    let coachAction: String
    let reminderTitle: String
    let reminderText: String
    let reminderAction: String
    let infoTitle: String
    let infoText: String
}

struct LoginCopy: Decodable {
    let title: String
    let close: String
    let socialGoogle: String
    let socialFacebook: String
    let socialApple: String
    let createWithEmail: String
    let userLabel: String
    let userPlaceholder: String
    let passLabel: String
    let passPlaceholder: String
    let enter: String
    let forgotPassword: String
    let registerTitle: String
    let registerSubtitle: String
    let registerUserLabel: String
    let registerUserPlaceholder: String
    let registerEmailLabel: String
    let registerEmailPlaceholder: String
    let registerPassLabel: String
    let registerPassPlaceholder: String
    let registerPassConfirmLabel: String
    let registerPassConfirmPlaceholder: String
    let registerTerms: String
    let registerSubmit: String
    let registerBack: String
    let recoverTitle: String
    let recoverSubtitle: String
    let recoverEmailLabel: String
    let recoverEmailPlaceholder: String
    let recoverSubmit: String
    let recoverBack: String
    let alertHeader: String
    let alertOk: String
    let errors: LoginErrorsCopy
    let info: LoginInfoCopy
}

struct LoginErrorsCopy: Decodable {
    let loginGeneric: String
    let loginInvalidUser: String
    let loginInvalidPassword: String
    let loginNoUserData: String
    let socialAppleUnavailable: String
    let socialAppleOnlyApp: String
    let socialAppleOpenFailed: String
    let socialGoogleUnavailable: String
    let socialGoogleOnlyApp: String
    let socialGoogleOpenFailed: String
    let socialFacebookUnavailable: String
    let socialFacebookOnlyApp: String
    let socialFacebookOpenFailed: String
    let registerMissingFields: String
    let registerPasswordMismatch: String
    let registerTermsRequired: String
    let registerFailed: String
    let recoverEmailRequired: String
    let recoverFailed: String
}

struct LoginInfoCopy: Decodable {
    let registerSuccess: String
    let recoverSuccess: String
}

struct HomeCopy: Decodable {
    let planTitle: String
    let planMessage: String
}

struct FreeRideCopy: Decodable {
    let title: String
    let subtitle: String
    let inputLabel: String
    let inputPlaceholder: String
    let emptyPhrase: String
    let playPhrase: String
    let sayLabel: String
    let endLabel: String
    let yourVoiceLabel: String
    let feedbackHint: String
    let feedbackNative: String
    let feedbackGood: String
    let feedbackAlmost: String
    let feedbackKeep: String
    let transcribing: String
    let savePhrase: String
    let myPhrases: String
    let savedPhrasesTitle: String
    let savedPhrasesSubtitle: String
    let noSavedPhrasesYet: String
    let savedPhrasesHint: String
    let usePhrase: String
    let deletePhrase: String
    let savedPhraseSavedToast: String
    let savedPhraseUpdatedToast: String
    let savedPhraseLoadedToast: String
    let savedPhraseDeletedToast: String
    let advanced: String
    let evaluatingPronunciation: String
    let transcript: String
    let transcriptAdvanced: String
    let overall: String
    let accuracy: String
    let fluency: String
    let completeness: String

    private enum CodingKeys: String, CodingKey {
        case title
        case subtitle
        case inputLabel
        case inputPlaceholder
        case emptyPhrase
        case playPhrase
        case sayLabel
        case endLabel
        case yourVoiceLabel
        case feedbackHint
        case feedbackNative
        case feedbackGood
        case feedbackAlmost
        case feedbackKeep
        case transcribing
        case savePhrase
        case myPhrases
        case savedPhrasesTitle
        case savedPhrasesSubtitle
        case noSavedPhrasesYet
        case savedPhrasesHint
        case usePhrase
        case deletePhrase
        case savedPhraseSavedToast
        case savedPhraseUpdatedToast
        case savedPhraseLoadedToast
        case savedPhraseDeletedToast
        case advanced
        case evaluatingPronunciation
        case transcript
        case transcriptAdvanced
        case overall
        case accuracy
        case fluency
        case completeness
    }

    init(
        title: String,
        subtitle: String,
        inputLabel: String,
        inputPlaceholder: String,
        emptyPhrase: String,
        playPhrase: String,
        sayLabel: String,
        endLabel: String,
        yourVoiceLabel: String,
        feedbackHint: String,
        feedbackNative: String,
        feedbackGood: String,
        feedbackAlmost: String,
        feedbackKeep: String,
        transcribing: String,
        savePhrase: String,
        myPhrases: String,
        savedPhrasesTitle: String,
        savedPhrasesSubtitle: String,
        noSavedPhrasesYet: String,
        savedPhrasesHint: String,
        usePhrase: String,
        deletePhrase: String,
        savedPhraseSavedToast: String,
        savedPhraseUpdatedToast: String,
        savedPhraseLoadedToast: String,
        savedPhraseDeletedToast: String,
        advanced: String,
        evaluatingPronunciation: String,
        transcript: String,
        transcriptAdvanced: String,
        overall: String,
        accuracy: String,
        fluency: String,
        completeness: String
    ) {
        self.title = title
        self.subtitle = subtitle
        self.inputLabel = inputLabel
        self.inputPlaceholder = inputPlaceholder
        self.emptyPhrase = emptyPhrase
        self.playPhrase = playPhrase
        self.sayLabel = sayLabel
        self.endLabel = endLabel
        self.yourVoiceLabel = yourVoiceLabel
        self.feedbackHint = feedbackHint
        self.feedbackNative = feedbackNative
        self.feedbackGood = feedbackGood
        self.feedbackAlmost = feedbackAlmost
        self.feedbackKeep = feedbackKeep
        self.transcribing = transcribing
        self.savePhrase = savePhrase
        self.myPhrases = myPhrases
        self.savedPhrasesTitle = savedPhrasesTitle
        self.savedPhrasesSubtitle = savedPhrasesSubtitle
        self.noSavedPhrasesYet = noSavedPhrasesYet
        self.savedPhrasesHint = savedPhrasesHint
        self.usePhrase = usePhrase
        self.deletePhrase = deletePhrase
        self.savedPhraseSavedToast = savedPhraseSavedToast
        self.savedPhraseUpdatedToast = savedPhraseUpdatedToast
        self.savedPhraseLoadedToast = savedPhraseLoadedToast
        self.savedPhraseDeletedToast = savedPhraseDeletedToast
        self.advanced = advanced
        self.evaluatingPronunciation = evaluatingPronunciation
        self.transcript = transcript
        self.transcriptAdvanced = transcriptAdvanced
        self.overall = overall
        self.accuracy = accuracy
        self.fluency = fluency
        self.completeness = completeness
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        title = try container.decode(String.self, forKey: .title)
        subtitle = try container.decode(String.self, forKey: .subtitle)
        inputLabel = try container.decodeIfPresent(String.self, forKey: .inputLabel) ?? "Your phrase"
        inputPlaceholder = try container.decodeIfPresent(String.self, forKey: .inputPlaceholder) ?? "Example: I would like to order a coffee, please."
        emptyPhrase = try container.decodeIfPresent(String.self, forKey: .emptyPhrase) ?? "Write a phrase to practice."
        playPhrase = try container.decodeIfPresent(String.self, forKey: .playPhrase) ?? "Play phrase"
        sayLabel = try container.decodeIfPresent(String.self, forKey: .sayLabel) ?? "Say"
        endLabel = try container.decodeIfPresent(String.self, forKey: .endLabel) ?? "End"
        yourVoiceLabel = try container.decodeIfPresent(String.self, forKey: .yourVoiceLabel) ?? "Your voice"
        feedbackHint = try container.decodeIfPresent(String.self, forKey: .feedbackHint) ?? "Practice the phrase"
        feedbackNative = try container.decodeIfPresent(String.self, forKey: .feedbackNative) ?? "You sound like a native"
        feedbackGood = try container.decodeIfPresent(String.self, forKey: .feedbackGood) ?? "Good! Continue practicing"
        feedbackAlmost = try container.decodeIfPresent(String.self, forKey: .feedbackAlmost) ?? "Almost correct"
        feedbackKeep = try container.decodeIfPresent(String.self, forKey: .feedbackKeep) ?? "Keep practicing"
        transcribing = try container.decodeIfPresent(String.self, forKey: .transcribing) ?? "Transcribing..."
        savePhrase = try container.decodeIfPresent(String.self, forKey: .savePhrase) ?? "Save phrase"
        myPhrases = try container.decodeIfPresent(String.self, forKey: .myPhrases) ?? "My phrases"
        savedPhrasesTitle = try container.decodeIfPresent(String.self, forKey: .savedPhrasesTitle) ?? "Saved phrases"
        savedPhrasesSubtitle = try container.decodeIfPresent(String.self, forKey: .savedPhrasesSubtitle) ?? "Load a phrase to practice again."
        noSavedPhrasesYet = try container.decodeIfPresent(String.self, forKey: .noSavedPhrasesYet) ?? "You do not have saved phrases yet."
        savedPhrasesHint = try container.decodeIfPresent(String.self, forKey: .savedPhrasesHint) ?? "Save a phrase from Lab and it will appear here."
        usePhrase = try container.decodeIfPresent(String.self, forKey: .usePhrase) ?? "Use phrase"
        deletePhrase = try container.decodeIfPresent(String.self, forKey: .deletePhrase) ?? "Delete"
        savedPhraseSavedToast = try container.decodeIfPresent(String.self, forKey: .savedPhraseSavedToast) ?? "Phrase saved."
        savedPhraseUpdatedToast = try container.decodeIfPresent(String.self, forKey: .savedPhraseUpdatedToast) ?? "Phrase updated."
        savedPhraseLoadedToast = try container.decodeIfPresent(String.self, forKey: .savedPhraseLoadedToast) ?? "Phrase loaded."
        savedPhraseDeletedToast = try container.decodeIfPresent(String.self, forKey: .savedPhraseDeletedToast) ?? "Phrase deleted."
        advanced = try container.decodeIfPresent(String.self, forKey: .advanced) ?? "Advanced"
        evaluatingPronunciation = try container.decodeIfPresent(String.self, forKey: .evaluatingPronunciation) ?? "Evaluating pronunciation..."
        transcript = try container.decodeIfPresent(String.self, forKey: .transcript) ?? "Transcript"
        transcriptAdvanced = try container.decodeIfPresent(String.self, forKey: .transcriptAdvanced) ?? "Transcript (Advanced)"
        overall = try container.decodeIfPresent(String.self, forKey: .overall) ?? "Overall"
        accuracy = try container.decodeIfPresent(String.self, forKey: .accuracy) ?? "Accuracy"
        fluency = try container.decodeIfPresent(String.self, forKey: .fluency) ?? "Fluency"
        completeness = try container.decodeIfPresent(String.self, forKey: .completeness) ?? "Completeness"
    }
}

struct ReferenceCopy: Decodable {
    let title: String
    let subtitle: String
}

struct ChatCopy: Decodable {
    let coachChatbotTitle: String
    let coachChatbotSubtitle: String
    let loginRequired: String
    let loginCta: String
    let loadingUser: String
    let inputPlaceholder: String
    let send: String
    let listenAgain: String
    let playingNow: String
    let retrySend: String
    let realtimeDisconnected: String
    let serverUnavailable: String
    let typingAria: String
    let introChatbot: String
}

struct ProfileCopy: Decodable {
    let accessPill: String
    let loginTitle: String
    let loginSubtitle: String
    let loginCta: String
    let rewardsTitle: String
    let rewardsEmpty: String
    let tabPrefs: String
}

struct NativeCopy: Decodable {
    let appTitle: String
    let titleBarSubtitle: String
    let notificationsButton: String
    let logoutButton: String
    let sessionUserLabel: String
    let sessionLocaleLabel: String
    let sessionPlanLabel: String
    let diagnostics: NativeDiagnosticsCopy
    let screens: NativeScreensCopy
}

struct NativeDiagnosticsCopy: Decodable {
    let title: String
    let subtitle: String
    let versionTitle: String
    let bundleTitle: String
    let localeTitle: String
    let userTitle: String
    let tabsTitle: String
    let platformTitle: String
    let assetsTitle: String
}

struct NativeScreensCopy: Decodable {
    let training: NativeScreenCopy
    let lab: NativeScreenCopy
    let reference: NativeScreenCopy
    let you: NativeScreenCopy
    let chat: NativeScreenCopy
}

struct NativeScreenCopy: Decodable {
    let eyebrow: String
    let title: String
    let message: String
    let callout: String
    let asset: String
    let highlights: [String]
}

struct NotificationItem {
    let title: String
    let body: String
    let action: String
    let elapsed: String
    let status: String
    let isNew: Bool
}

enum RootScreen: Int, CaseIterable {
    case training
    case lab
    case reference
    case you
    case chat

    var symbolName: String {
        switch self {
        case .training: return "figure.run"
        case .lab: return "waveform"
        case .reference: return "books.vertical"
        case .you: return "person.crop.circle"
        case .chat: return "bubble.left.and.bubble.right"
        }
    }

    var theme: ScreenTheme {
        switch self {
        case .training:
            return ScreenTheme(
                tint: UIColor(red: 0.08, green: 0.49, blue: 0.67, alpha: 1),
                background: UIColor(red: 0.94, green: 0.98, blue: 1.0, alpha: 1),
                accent: UIColor(red: 0.83, green: 0.93, blue: 0.98, alpha: 1)
            )
        case .lab:
            return ScreenTheme(
                tint: UIColor(red: 0.18, green: 0.49, blue: 0.96, alpha: 1),
                background: UIColor(red: 0.97, green: 0.97, blue: 0.99, alpha: 1),
                accent: UIColor(red: 0.99, green: 0.93, blue: 0.76, alpha: 1)
            )
        case .reference:
            return ScreenTheme(
                tint: UIColor(red: 0.17, green: 0.38, blue: 0.71, alpha: 1),
                background: UIColor(red: 0.95, green: 0.97, blue: 1.0, alpha: 1),
                accent: UIColor(red: 0.87, green: 0.91, blue: 0.98, alpha: 1)
            )
        case .you:
            return ScreenTheme(
                tint: UIColor(red: 0.13, green: 0.49, blue: 0.41, alpha: 1),
                background: UIColor(red: 0.95, green: 0.99, blue: 0.97, alpha: 1),
                accent: UIColor(red: 0.85, green: 0.95, blue: 0.90, alpha: 1)
            )
        case .chat:
            return ScreenTheme(
                tint: UIColor(red: 0.79, green: 0.31, blue: 0.34, alpha: 1),
                background: UIColor(red: 0.99, green: 0.97, blue: 0.95, alpha: 1),
                accent: UIColor(red: 0.97, green: 0.91, blue: 0.88, alpha: 1)
            )
        }
    }
}

struct ScreenTheme {
    let tint: UIColor
    let background: UIColor
    let accent: UIColor
}

extension String {
    func applying(_ replacements: [String: String]) -> String {
        replacements.reduce(into: self) { partialResult, replacement in
            partialResult = partialResult.replacingOccurrences(
                of: "{\(replacement.key)}",
                with: replacement.value
            )
        }
    }
}

final class NativeDebugLogStore {
    static let shared = NativeDebugLogStore()

    private let queue = DispatchQueue(label: "NativeDebugLogStore.queue")
    private var entries: [String] = []
    private let maxEntries = 40

    private init() {}

    func add(_ message: String) {
        let trimmed = message.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let entry = "\(formatter.string(from: Date()))  \(trimmed)"

        queue.sync {
            entries.append(entry)
            if entries.count > maxEntries {
                entries.removeFirst(entries.count - maxEntries)
            }
        }
    }

    func snapshot() -> [String] {
        queue.sync { entries.reversed() }
    }
}
