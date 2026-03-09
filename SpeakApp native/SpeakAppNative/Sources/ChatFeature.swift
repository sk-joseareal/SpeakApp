import AVFoundation
import UIKit

private struct ChatRealtimeConfig {
    let appKey: String
    let wsHost: String
    let wssPort: Int
    let forceTLS: Bool
    let authEndpoint: URL
    let emitEndpoint: URL
    let ttsAlignedEndpoint: URL
    let stateToken: String
    let channelType: String
    let channelPrefix: String
    let coachID: String

    static let production = ChatRealtimeConfig(
        appKey: "dev-key-123456",
        wsHost: "realtime.curso-ingles.com",
        wssPort: 443,
        forceTLS: true,
        authEndpoint: URL(string: "https://realtime.curso-ingles.com/realtime/auth")!,
        emitEndpoint: URL(string: "https://realtime.curso-ingles.com/realtime/emit")!,
        ttsAlignedEndpoint: URL(string: "https://realtime.curso-ingles.com/realtime/tts/aligned")!,
        stateToken: RealtimeEnvironment.stateToken,
        channelType: "private",
        channelPrefix: "coach",
        coachID: "2"
    )

    func channelName(for userID: String) -> String {
        let base = "\(channelPrefix)\(coachID)-\(userID)"
        if channelType.isEmpty || channelType == "public" {
            return base
        }
        return "\(channelType)-\(base)"
    }

    func webSocketURL() -> URL {
        var components = URLComponents()
        components.scheme = forceTLS ? "wss" : "ws"
        components.host = wsHost
        components.port = wssPort
        components.path = "/app/\(appKey)"
        components.queryItems = [
            URLQueryItem(name: "protocol", value: "7"),
            URLQueryItem(name: "client", value: "swift-native-poc"),
            URLQueryItem(name: "version", value: "0.1.0")
        ]
        return components.url!
    }
}

private enum ChatConnectionState: Equatable {
    case idle
    case connecting
    case connected
    case disconnected
}

private struct IncomingCoachMessage {
    let id: String
    let role: ChatRowRole
    let text: String
    let audioURL: URL?
    let speakText: String
}

private enum ChatRowRole {
    case user
    case bot
    case typing
}

private struct ChatMessageRow: Hashable {
    let id: String
    let role: ChatRowRole
    let text: String
    let audioURL: URL?
    let speakText: String
    let failed: Bool

    var canReplayAudio: Bool {
        role == .bot && (audioURL != nil || !speakText.isEmpty)
    }
}

private func chatNormalizedRemoteAudioURL(from rawValue: String?) -> URL? {
    let trimmed = String(rawValue ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    guard
        !trimmed.isEmpty,
        let url = URL(string: trimmed),
        let scheme = url.scheme?.lowercased(),
        scheme == "https" || scheme == "http"
    else {
        return nil
    }
    return url
}

private func chatNormalizedRemoteAudioURL(from url: URL?) -> URL? {
    guard let url else { return nil }
    return chatNormalizedRemoteAudioURL(from: url.absoluteString)
}

private func chatStringValue(_ value: Any?) -> String? {
    switch value {
    case let string as String:
        return string
    case let number as NSNumber:
        return number.stringValue
    default:
        return nil
    }
}

private final class CoachRealtimeClient {
    var onStateChange: ((ChatConnectionState) -> Void)?
    var onMessage: ((IncomingCoachMessage) -> Void)?

    private let config: ChatRealtimeConfig
    private let session = URLSession(configuration: .default)

    private var webSocketTask: URLSessionWebSocketTask?
    private var currentUser: AppSessionUser?
    private var channelName = ""
    private var socketID = ""
    private var manualDisconnect = false
    private var reconnectWorkItem: DispatchWorkItem?
    private var state: ChatConnectionState = .idle {
        didSet {
            guard oldValue != state else { return }
            DispatchQueue.main.async { [state, weak self] in
                self?.onStateChange?(state)
            }
        }
    }

    init(config: ChatRealtimeConfig = .production) {
        self.config = config
    }

    deinit {
        disconnect()
    }

    func connect(user: AppSessionUser) {
        guard !user.id.isEmpty else { return }
        if currentUser?.id == user.id, webSocketTask != nil {
            return
        }

        reconnectWorkItem?.cancel()
        currentUser = user
        channelName = config.channelName(for: user.id)
        socketID = ""
        manualDisconnect = false
        state = .connecting

        let task = session.webSocketTask(with: config.webSocketURL())
        webSocketTask = task
        task.resume()
        receiveNextMessage()
    }

    func disconnect() {
        manualDisconnect = true
        reconnectWorkItem?.cancel()
        currentUser = nil
        channelName = ""
        socketID = ""
        tearDownTransport()
        state = .idle
    }

    func send(text: String) async -> Bool {
        guard let user = currentUser, !channelName.isEmpty else {
            return false
        }

        let name = user.displayName.isEmpty ? user.email : user.displayName
        let payload: [String: Any] = [
            "channel": channelName,
            "event": "user_message",
            "data": [
                "text": text,
                "user_id": user.id,
                "userId": user.id,
                "id": user.id,
                "name": name,
                "user_name": name,
                "userName": name
            ]
        ]

        var request = URLRequest(url: config.emitEndpoint)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: payload)

        do {
            let (_, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse else {
                return false
            }
            return (200 ... 299).contains(http.statusCode)
        } catch {
            return false
        }
    }

    private func receiveNextMessage() {
        webSocketTask?.receive { [weak self] result in
            guard let self else { return }

            switch result {
            case let .failure(error):
                self.handleDisconnect(error: error)
            case let .success(message):
                self.handleWebSocketMessage(message)
                self.receiveNextMessage()
            }
        }
    }

    private func handleWebSocketMessage(_ message: URLSessionWebSocketTask.Message) {
        let rawText: String
        switch message {
        case let .string(text):
            rawText = text
        case let .data(data):
            guard let text = String(data: data, encoding: .utf8) else { return }
            rawText = text
        @unknown default:
            return
        }

        guard
            let envelope = jsonDictionary(from: rawText.data(using: .utf8)),
            let event = envelope["event"] as? String
        else {
            return
        }

        let data = normalizedEventData(envelope["data"])
        switch event {
        case "pusher:connection_established":
            guard
                let payload = data as? [String: Any],
                let socketID = stringValue(payload["socket_id"]),
                !socketID.isEmpty
            else {
                handleDisconnect(error: nil)
                return
            }
            self.socketID = socketID
            Task { [weak self] in
                await self?.authenticateAndSubscribe()
            }
        case "pusher_internal:subscription_succeeded", "pusher:subscription_succeeded":
            state = .connected
        case "pusher:ping":
            sendEnvelope(event: "pusher:pong", data: [:])
        case "pusher:error":
            handleDisconnect(error: nil)
        case "chat_message", "bot_message":
            guard let incoming = makeIncomingMessage(from: data) else { return }
            DispatchQueue.main.async { [weak self] in
                self?.onMessage?(incoming)
            }
        default:
            break
        }
    }

    private func authenticateAndSubscribe() async {
        guard
            let user = currentUser,
            !socketID.isEmpty,
            !channelName.isEmpty
        else {
            handleDisconnect(error: nil)
            return
        }

        let userInfo: [String: Any] = [
            "id": user.id,
            "name": user.displayName,
            "email": user.email,
            "avatar": user.imageURL ?? ""
        ]
        let serializedUserInfo = jsonString(from: userInfo) ?? "{}"
        let body: [String: Any] = [
            "socket_id": socketID,
            "channel_name": channelName,
            "user_id": user.id,
            "user_info": serializedUserInfo,
            "token": user.token
        ]

        var request = URLRequest(url: config.authEndpoint)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        do {
            let (data, response) = try await session.data(for: request)
            guard
                let httpResponse = response as? HTTPURLResponse,
                (200 ... 299).contains(httpResponse.statusCode),
                let authPayload = jsonDictionary(from: data),
                let auth = stringValue(authPayload["auth"]),
                !auth.isEmpty
            else {
                handleDisconnect(error: nil)
                return
            }

            var subscribeData: [String: Any] = [
                "channel": channelName,
                "auth": auth
            ]
            if let channelData = authPayload["channel_data"] {
                subscribeData["channel_data"] = channelData
            }

            sendEnvelope(event: "pusher:subscribe", data: subscribeData)
        } catch {
            handleDisconnect(error: error)
        }
    }

    private func sendEnvelope(event: String, data: [String: Any]) {
        guard let webSocketTask else { return }
        let envelope: [String: Any] = [
            "event": event,
            "data": data
        ]
        guard let json = jsonString(from: envelope) else { return }
        webSocketTask.send(.string(json)) { [weak self] error in
            if let error {
                self?.handleDisconnect(error: error)
            }
        }
    }

    private func handleDisconnect(error: Error?) {
        guard !manualDisconnect else { return }
        tearDownTransport()
        state = .disconnected
        scheduleReconnect()
    }

    private func scheduleReconnect() {
        guard let user = currentUser else { return }
        reconnectWorkItem?.cancel()

        let workItem = DispatchWorkItem { [weak self] in
            self?.connect(user: user)
        }
        reconnectWorkItem = workItem
        DispatchQueue.main.asyncAfter(deadline: .now() + 2, execute: workItem)
    }

    private func tearDownTransport() {
        webSocketTask?.cancel(with: .goingAway, reason: nil)
        webSocketTask = nil
        socketID = ""
    }

    private func makeIncomingMessage(from data: Any?) -> IncomingCoachMessage? {
        if let text = data as? String {
            let normalized = normalizeText(text)
            guard !normalized.isEmpty else { return nil }
            return IncomingCoachMessage(
                id: generatedMessageID(),
                role: .bot,
                text: normalized,
                audioURL: nil,
                speakText: normalized
            )
        }

        guard let payload = data as? [String: Any] else { return nil }
        let text = normalizeText(
            stringValue(payload["text"])
                ?? stringValue(payload["message"])
                ?? stringValue(payload["body"])
                ?? stringValue(payload["content"])
        )
        guard !text.isEmpty else { return nil }

        let role = normalizedRole(
            stringValue(payload["role"])
                ?? stringValue(payload["sender"])
                ?? stringValue(payload["from"])
        )
        let audioURL = chatNormalizedRemoteAudioURL(
            from: stringValue(payload["audio_url"]) ?? stringValue(payload["audioUrl"])
        )
        let speakText = normalizeText(
            stringValue(payload["speakText"])
                ?? stringValue(payload["speak_text"])
                ?? text
        )

        return IncomingCoachMessage(
            id: stringValue(payload["id"]) ?? generatedMessageID(),
            role: role,
            text: text,
            audioURL: audioURL,
            speakText: speakText.isEmpty ? text : speakText
        )
    }

    private func normalizedRole(_ value: String?) -> ChatRowRole {
        let normalized = value?.lowercased() ?? ""
        if normalized == "user" || normalized == "student" || normalized == "member" {
            return .user
        }
        return .bot
    }

    private func normalizedEventData(_ value: Any?) -> Any? {
        guard let value else { return nil }
        if let text = value as? String {
            let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty else { return "" }
            if trimmed.first == "{" || trimmed.first == "[" {
                return jsonObject(from: Data(trimmed.utf8))
            }
            return trimmed
        }
        return value
    }

    private func normalizeText(_ value: String?) -> String {
        String(value ?? "")
            .replacingOccurrences(of: "\r", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func jsonDictionary(from data: Data?) -> [String: Any]? {
        guard let json = jsonObject(from: data) else { return nil }
        return json as? [String: Any]
    }

    private func jsonObject(from data: Data?) -> Any? {
        guard let data else { return nil }
        return try? JSONSerialization.jsonObject(with: data)
    }

    private func jsonString(from value: Any) -> String? {
        guard
            JSONSerialization.isValidJSONObject(value),
            let data = try? JSONSerialization.data(withJSONObject: value),
            let string = String(data: data, encoding: .utf8)
        else {
            return nil
        }
        return string
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

    private func generatedMessageID() -> String {
        "chat_\(UUID().uuidString.lowercased())"
    }
}

final class ChatViewController: UIViewController {
    private let sessionStore: AppSessionStore
    private let copy: AppCopy
    private let theme = RootScreen.chat.theme
    private let realtimeClient = CoachRealtimeClient()

    private var messages: [ChatMessageRow] = []
    private var isAwaitingReply = false
    private var connectionState: ChatConnectionState = .idle

    private let headerSubtitleLabel = UILabel()
    private let statusDotView = UIView()
    private let tableView = UITableView(frame: .zero, style: .plain)
    private let composerCard = UIView()
    private let textField = UITextField()
    private var keyboardObservers: [NSObjectProtocol] = []
    private var ttsAudioCache: [String: URL] = [:]
    private var audioDataCache: [String: Data] = [:]
    private var audioPlayer: AVAudioPlayer?
    private let speechSynthesizer = AVSpeechSynthesizer()
    private var activePlaybackMessageID: String?
    private var playbackRequestToken = UUID()

    init(sessionStore: AppSessionStore, copy: AppCopy) {
        self.sessionStore = sessionStore
        self.copy = copy
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    deinit {
        realtimeClient.disconnect()
        keyboardObservers.forEach(NotificationCenter.default.removeObserver(_:))
        audioPlayer?.pause()
        try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
    }

    private var session: AppSession {
        sessionStore.session
    }

    private func logPlayback(_ message: String) {
        NativeDebugLogStore.shared.add("[ChatAudio] \(message)")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        speechSynthesizer.delegate = self
        view.backgroundColor = theme.background
        configureNavigationBar()
        buildLayout()
        observeKeyboardChanges()
        bindRealtimeClient()
        bootstrapConversation()
        connectIfPossible()
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        navigationController?.navigationBar.tintColor = theme.tint
    }

    private func configureNavigationBar() {
        let titleView = TitleBarView(copy: copy, session: session)
        titleView.onDoubleTap = { [weak self] in
            self?.presentDiagnostics()
        }
        navigationItem.titleView = titleView

        let notificationsButton = UIBarButtonItem(
            image: UIImage(systemName: "bell.badge"),
            primaryAction: UIAction(title: copy.native.notificationsButton) { [weak self] _ in
                self?.presentNotifications()
            }
        )

        let logoutButton = UIBarButtonItem(
            image: UIImage(systemName: "rectangle.portrait.and.arrow.right"),
            primaryAction: UIAction(title: copy.native.logoutButton) { [weak self] _ in
                self?.sessionStore.logout()
            }
        )

        navigationItem.rightBarButtonItems = [logoutButton, notificationsButton]
    }

    private func buildLayout() {
        let headerCard = makeHeaderCard()
        headerCard.translatesAutoresizingMaskIntoConstraints = false

        tableView.translatesAutoresizingMaskIntoConstraints = false
        tableView.backgroundColor = .clear
        tableView.separatorStyle = .none
        tableView.keyboardDismissMode = .interactive
        tableView.showsVerticalScrollIndicator = false
        tableView.estimatedRowHeight = 88
        tableView.rowHeight = UITableView.automaticDimension
        tableView.contentInset = UIEdgeInsets(top: 10, left: 0, bottom: 12, right: 0)
        tableView.register(ChatMessageCell.self, forCellReuseIdentifier: ChatMessageCell.reuseIdentifier)
        tableView.dataSource = self

        composerCard.translatesAutoresizingMaskIntoConstraints = false
        composerCard.backgroundColor = .white
        composerCard.layer.cornerRadius = 24
        composerCard.layer.shadowColor = UIColor.black.withAlphaComponent(0.08).cgColor
        composerCard.layer.shadowOpacity = 1
        composerCard.layer.shadowRadius = 18
        composerCard.layer.shadowOffset = CGSize(width: 0, height: 12)

        let composerRow = UIStackView()
        composerRow.translatesAutoresizingMaskIntoConstraints = false
        composerRow.axis = .horizontal
        composerRow.spacing = 12
        composerRow.alignment = .center

        let inputShell = UIView()
        inputShell.translatesAutoresizingMaskIntoConstraints = false
        inputShell.backgroundColor = UIColor.secondarySystemBackground
        inputShell.layer.cornerRadius = 18

        textField.translatesAutoresizingMaskIntoConstraints = false
        textField.placeholder = copy.chat.inputPlaceholder
        textField.font = .systemFont(ofSize: 16, weight: .medium)
        textField.textColor = .label
        textField.returnKeyType = .send
        textField.enablesReturnKeyAutomatically = true
        textField.autocorrectionType = .yes
        textField.delegate = self
        textField.addTarget(self, action: #selector(textFieldDidChange), for: .editingChanged)

        inputShell.addSubview(textField)
        NSLayoutConstraint.activate([
            textField.topAnchor.constraint(equalTo: inputShell.topAnchor, constant: 12),
            textField.leadingAnchor.constraint(equalTo: inputShell.leadingAnchor, constant: 14),
            textField.trailingAnchor.constraint(equalTo: inputShell.trailingAnchor, constant: -14),
            textField.bottomAnchor.constraint(equalTo: inputShell.bottomAnchor, constant: -12)
        ])

        composerRow.addArrangedSubview(inputShell)
        inputShell.setContentHuggingPriority(.defaultLow, for: .horizontal)

        composerCard.addSubview(composerRow)
        chatPin(composerRow, to: composerCard, insets: UIEdgeInsets(top: 14, left: 14, bottom: 14, right: 14))

        view.addSubview(headerCard)
        view.addSubview(tableView)
        view.addSubview(composerCard)

        let keyboardGuide = view.keyboardLayoutGuide
        keyboardGuide.followsUndockedKeyboard = true
        NSLayoutConstraint.activate([
            headerCard.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 20),
            headerCard.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            headerCard.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),

            composerCard.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            composerCard.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
            composerCard.bottomAnchor.constraint(equalTo: keyboardGuide.topAnchor, constant: -12),

            tableView.topAnchor.constraint(equalTo: headerCard.bottomAnchor, constant: 12),
            tableView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            tableView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            tableView.bottomAnchor.constraint(equalTo: composerCard.topAnchor, constant: -8)
        ])

        refreshConnectionUI()
        refreshComposerState()
    }

    private func observeKeyboardChanges() {
        let center = NotificationCenter.default
        keyboardObservers = [
            center.addObserver(
                forName: UIResponder.keyboardWillChangeFrameNotification,
                object: nil,
                queue: .main
            ) { [weak self] notification in
                self?.handleKeyboardTransition(notification)
            },
            center.addObserver(
                forName: UIResponder.keyboardWillHideNotification,
                object: nil,
                queue: .main
            ) { [weak self] notification in
                self?.handleKeyboardTransition(notification)
            }
        ]
    }

    private func makeHeaderCard() -> UIView {
        let card = chatMakeCard(backgroundColor: .white)
        let stack = chatMakeStack(spacing: 14)
        card.addSubview(stack)
        chatPin(stack, to: card, insets: UIEdgeInsets(top: 20, left: 20, bottom: 20, right: 20))

        let eyebrow = PaddingLabel()
        eyebrow.text = copy.tabTitle(for: .chat).uppercased()
        eyebrow.font = .systemFont(ofSize: 12, weight: .bold)
        eyebrow.textColor = theme.tint
        eyebrow.backgroundColor = theme.tint.withAlphaComponent(0.12)
        eyebrow.layer.cornerRadius = 14
        eyebrow.clipsToBounds = true

        let mainRow = UIStackView()
        mainRow.axis = .horizontal
        mainRow.spacing = 16
        mainRow.alignment = .center

        let textStack = chatMakeStack(spacing: 8)
        textStack.alignment = .leading

        let titleLabel = UILabel()
        titleLabel.font = .systemFont(ofSize: 28, weight: .bold)
        titleLabel.textColor = .label
        titleLabel.numberOfLines = 0
        titleLabel.text = copy.chat.coachChatbotTitle

        let subtitleRow = UIStackView()
        subtitleRow.axis = .horizontal
        subtitleRow.spacing = 8
        subtitleRow.alignment = .center

        statusDotView.translatesAutoresizingMaskIntoConstraints = false
        statusDotView.layer.cornerRadius = 5
        NSLayoutConstraint.activate([
            statusDotView.widthAnchor.constraint(equalToConstant: 10),
            statusDotView.heightAnchor.constraint(equalToConstant: 10)
        ])

        headerSubtitleLabel.font = .systemFont(ofSize: 14, weight: .medium)
        headerSubtitleLabel.textColor = .secondaryLabel
        headerSubtitleLabel.numberOfLines = 0

        subtitleRow.addArrangedSubview(statusDotView)
        subtitleRow.addArrangedSubview(headerSubtitleLabel)

        textStack.addArrangedSubview(eyebrow)
        textStack.addArrangedSubview(titleLabel)
        textStack.addArrangedSubview(subtitleRow)

        let avatarShell = UIView()
        avatarShell.translatesAutoresizingMaskIntoConstraints = false
        avatarShell.backgroundColor = theme.accent
        avatarShell.layer.cornerRadius = 24
        NSLayoutConstraint.activate([
            avatarShell.widthAnchor.constraint(equalToConstant: 92),
            avatarShell.heightAnchor.constraint(equalToConstant: 92)
        ])

        let avatarImage = UIImageView(image: UIImage(named: "Chatbot") ?? UIImage(systemName: RootScreen.chat.symbolName))
        avatarImage.translatesAutoresizingMaskIntoConstraints = false
        avatarImage.contentMode = .scaleAspectFit
        avatarImage.tintColor = theme.tint
        avatarShell.addSubview(avatarImage)
        NSLayoutConstraint.activate([
            avatarImage.centerXAnchor.constraint(equalTo: avatarShell.centerXAnchor),
            avatarImage.centerYAnchor.constraint(equalTo: avatarShell.centerYAnchor),
            avatarImage.widthAnchor.constraint(lessThanOrEqualToConstant: 64),
            avatarImage.heightAnchor.constraint(lessThanOrEqualToConstant: 64),
            avatarImage.leadingAnchor.constraint(greaterThanOrEqualTo: avatarShell.leadingAnchor, constant: 12),
            avatarImage.trailingAnchor.constraint(lessThanOrEqualTo: avatarShell.trailingAnchor, constant: -12),
            avatarImage.topAnchor.constraint(greaterThanOrEqualTo: avatarShell.topAnchor, constant: 12),
            avatarImage.bottomAnchor.constraint(lessThanOrEqualTo: avatarShell.bottomAnchor, constant: -12)
        ])

        mainRow.addArrangedSubview(textStack)
        mainRow.addArrangedSubview(avatarShell)

        stack.addArrangedSubview(mainRow)
        return card
    }

    private func bindRealtimeClient() {
        realtimeClient.onStateChange = { [weak self] state in
            self?.connectionState = state
            self?.refreshConnectionUI()
            self?.refreshComposerState()
            if state == .disconnected {
                self?.markLastUserMessageFailed()
                self?.removeTypingIndicator()
            }
        }

        realtimeClient.onMessage = { [weak self] message in
            guard let self else { return }
            removeTypingIndicator()
            let row = appendMessage(
                role: message.role,
                text: message.text,
                audioURL: message.audioURL,
                speakText: message.speakText
            )
            refreshComposerState()
            if message.role == .bot {
                autoplayBotMessage(row)
            }
        }
    }

    private func bootstrapConversation() {
        guard messages.isEmpty else { return }
        appendMessage(role: .bot, text: copy.chat.introChatbot, failed: false, scroll: false)
    }

    private func connectIfPossible() {
        guard let user = session.user else {
            connectionState = .disconnected
            refreshConnectionUI()
            refreshComposerState()
            return
        }
        realtimeClient.connect(user: user)
    }

    @discardableResult
    private func appendMessage(
        role: ChatRowRole,
        text: String,
        audioURL: URL? = nil,
        speakText: String? = nil,
        failed: Bool = false,
        scroll: Bool = true
    ) -> ChatMessageRow {
        let normalized = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty else {
            return ChatMessageRow(
                id: "row_\(UUID().uuidString.lowercased())",
                role: role,
                text: "",
                audioURL: audioURL,
                speakText: "",
                failed: failed
            )
        }
        let row = ChatMessageRow(
            id: "row_\(UUID().uuidString.lowercased())",
            role: role,
            text: normalized,
            audioURL: audioURL,
            speakText: (speakText ?? normalized).trimmingCharacters(in: .whitespacesAndNewlines),
            failed: failed
        )
        messages.append(row)
        tableView.reloadData()
        if scroll {
            scrollToBottom(animated: true)
        }
        return row
    }

    private func removeTypingIndicator() {
        isAwaitingReply = false
        tableView.reloadData()
        scrollToBottom(animated: true)
    }

    private func markLastUserMessageFailed() {
        guard let lastIndex = messages.lastIndex(where: { $0.role == .user && !$0.failed }) else {
            return
        }
        let failedRow = ChatMessageRow(
            id: messages[lastIndex].id,
            role: messages[lastIndex].role,
            text: messages[lastIndex].text,
            audioURL: messages[lastIndex].audioURL,
            speakText: messages[lastIndex].speakText,
            failed: true
        )
        messages[lastIndex] = failedRow
        tableView.reloadData()
    }

    private func refreshConnectionUI() {
        switch connectionState {
        case .idle, .connecting:
            statusDotView.backgroundColor = .systemOrange
            headerSubtitleLabel.text = copy.chat.loadingUser
        case .connected:
            statusDotView.backgroundColor = .systemGreen
            headerSubtitleLabel.text = copy.chat.coachChatbotSubtitle
        case .disconnected:
            statusDotView.backgroundColor = .systemRed
            headerSubtitleLabel.text = copy.chat.realtimeDisconnected
        }
    }

    private func refreshComposerState() {
        textField.isEnabled = connectionState == .connected
        textField.alpha = textField.isEnabled ? 1 : 0.72
    }

    private func sendCurrentDraft() {
        let text = (textField.text ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        guard connectionState == .connected else { return }
        guard !isAwaitingReply else { return }

        appendMessage(role: .user, text: text)
        textField.text = ""
        isAwaitingReply = true
        tableView.reloadData()
        scrollToBottom(animated: true)
        refreshComposerState()
        textField.becomeFirstResponder()

        Task { [weak self] in
            guard let self else { return }
            let ok = await self.realtimeClient.send(text: text)
            await MainActor.run {
                if !ok {
                    self.markLastUserMessageFailed()
                    self.isAwaitingReply = false
                    self.connectionState = .disconnected
                    self.refreshConnectionUI()
                }
                self.refreshComposerState()
                self.textField.becomeFirstResponder()
            }
        }
    }

    private func handleKeyboardTransition(_ notification: Notification) {
        let userInfo = notification.userInfo ?? [:]
        let duration = userInfo[UIResponder.keyboardAnimationDurationUserInfoKey] as? Double ?? 0.25
        let curveRaw = userInfo[UIResponder.keyboardAnimationCurveUserInfoKey] as? UInt ?? 7
        let options = UIView.AnimationOptions(rawValue: curveRaw << 16)

        UIView.animate(
            withDuration: duration,
            delay: 0,
            options: [options, .beginFromCurrentState]
        ) { [weak self] in
            self?.view.layoutIfNeeded()
        } completion: { [weak self] _ in
            self?.scrollToBottom(animated: false)
        }
    }

    private func displayRow(at indexPath: IndexPath) -> ChatMessageRow {
        if indexPath.row < messages.count {
            return messages[indexPath.row]
        }
        return ChatMessageRow(
            id: "typing-indicator",
            role: .typing,
            text: copy.chat.typingAria,
            audioURL: nil,
            speakText: copy.chat.typingAria,
            failed: false
        )
    }

    private func autoplayBotMessage(_ row: ChatMessageRow) {
        playMessageAudio(for: row)
    }

    private func playMessageAudio(for row: ChatMessageRow) {
        guard row.canReplayAudio else { return }

        if activePlaybackMessageID == row.id {
            stopPlayback()
            return
        }

        let speakText = row.speakText.isEmpty ? row.text : row.speakText
        guard row.audioURL != nil || !speakText.isEmpty else { return }
        let requestToken = UUID()
        playbackRequestToken = requestToken
        let remoteAudioURL = chatNormalizedRemoteAudioURL(from: row.audioURL)
        let prefersAlignedAudio = row.role == .bot && !speakText.isEmpty
        logPlayback("play requested id=\(row.id) alignedFirst=\(prefersAlignedAudio) text=\(String(speakText.prefix(64)))")

        Task { [weak self] in
            guard let self else { return }
            let primaryURL: URL?
            let fallbackURL: URL?

            if prefersAlignedAudio {
                primaryURL = await self.fetchAlignedTTSURL(for: speakText)
                fallbackURL = remoteAudioURL
            } else {
                primaryURL = remoteAudioURL
                fallbackURL = speakText.isEmpty ? nil : await self.fetchAlignedTTSURL(for: speakText)
            }

            guard let audioData = await self.resolvePlayableAudioData(primaryURL: primaryURL, fallbackURL: fallbackURL) else {
                self.logPlayback("audio data unavailable id=\(row.id); falling back to local speech")
                guard !speakText.isEmpty else { return }
                await MainActor.run {
                    guard self.playbackRequestToken == requestToken else { return }
                    self.playSpeechFallback(text: speakText, messageID: row.id)
                }
                return
            }

            await MainActor.run {
                guard self.playbackRequestToken == requestToken else { return }
                self.playAudio(data: audioData, messageID: row.id)
            }
        }
    }

    private func fetchAlignedTTSURL(for text: String) async -> URL? {
        let normalizedText = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalizedText.isEmpty else { return nil }

        let locale = session.preferredLanguageCode.isEmpty ? "en-US" : session.preferredLanguageCode
        let cacheKey = "\(locale.lowercased())::\(normalizedText)"
        if let cachedURL = ttsAudioCache[cacheKey] {
            return cachedURL
        }

        var body: [String: Any] = [
            "text": normalizedText,
            "locale": locale
        ]
        if let user = session.user {
            body["user_id"] = user.id
            let userName = user.displayName.isEmpty ? user.email : user.displayName
            if !userName.isEmpty {
                body["user_name"] = userName
            }
        }

        var request = URLRequest(url: ChatRealtimeConfig.production.ttsAlignedEndpoint)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if !ChatRealtimeConfig.production.stateToken.isEmpty {
            request.setValue(ChatRealtimeConfig.production.stateToken, forHTTPHeaderField: "x-rt-token")
        }
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse else {
                logPlayback("aligned tts invalid response text=\(String(normalizedText.prefix(48)))")
                return nil
            }

            let rawBody = String(data: data, encoding: .utf8) ?? "<non-utf8>"
            guard (200 ... 299).contains(httpResponse.statusCode) else {
                logPlayback("aligned tts http=\(httpResponse.statusCode) body=\(String(rawBody.prefix(180)))")
                return nil
            }

            guard let payload = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                logPlayback("aligned tts json parse failed body=\(String(rawBody.prefix(180)))")
                return nil
            }

            let okValue = payload["ok"]
            let ok: Bool
            switch okValue {
            case nil:
                ok = true
            case let bool as Bool:
                ok = bool
            case let number as NSNumber:
                ok = number.boolValue
            case let string as String:
                ok = ["true", "1", "ok"].contains(string.trimmingCharacters(in: .whitespacesAndNewlines).lowercased())
            default:
                ok = false
            }

            let audioURLText =
                chatStringValue(payload["audio_url"])
                ?? chatStringValue(payload["audioUrl"])
                ?? chatStringValue(payload["url"])
            guard ok, let audioURL = chatNormalizedRemoteAudioURL(from: audioURLText) else {
                logPlayback(
                    "aligned tts payload rejected ok=\(String(describing: okValue)) audio=\(audioURLText ?? "nil") body=\(String(rawBody.prefix(180)))"
                )
                return nil
            }

            ttsAudioCache[cacheKey] = audioURL
            logPlayback("aligned tts ok url=\(audioURL.absoluteString)")
            return audioURL
        } catch {
            logPlayback("aligned tts error=\(error.localizedDescription)")
            return nil
        }
    }

    private func resolvePlayableAudioData(primaryURL: URL?, fallbackURL: URL?) async -> Data? {
        if let primaryURL, let primaryData = await fetchAudioData(from: primaryURL) {
            return primaryData
        }
        if let fallbackURL, let fallbackData = await fetchAudioData(from: fallbackURL) {
            return fallbackData
        }
        return nil
    }

    private func fetchAudioData(from url: URL) async -> Data? {
        let cacheKey = url.absoluteString
        if let cached = audioDataCache[cacheKey] {
            logPlayback("audio cache hit url=\(cacheKey)")
            return cached
        }

        do {
            let (data, response) = try await URLSession.shared.data(from: url)
            guard
                let httpResponse = response as? HTTPURLResponse,
                (200 ... 299).contains(httpResponse.statusCode),
                !data.isEmpty
            else {
                logPlayback("audio download rejected url=\(cacheKey)")
                return nil
            }
            audioDataCache[cacheKey] = data
            logPlayback("audio download ok bytes=\(data.count) url=\(cacheKey)")
            return data
        } catch {
            logPlayback("audio download error=\(error.localizedDescription) url=\(cacheKey)")
            return nil
        }
    }

    private func playAudio(data: Data, messageID: String) {
        let audioSession = AVAudioSession.sharedInstance()
        do {
            try audioSession.setCategory(.playback, mode: .default, options: [.duckOthers])
            try audioSession.setActive(true)
        } catch {
            logPlayback("audio session error=\(error.localizedDescription)")
        }

        clearPlaybackState(deactivateAudioSession: false)

        do {
            let player = try AVAudioPlayer(data: data)
            player.delegate = self
            player.volume = 1
            player.prepareToPlay()
            audioPlayer = player
            setActivePlaybackMessageID(messageID)
            let outputs = audioSession.currentRoute.outputs
                .map { "\($0.portType.rawValue):\($0.portName)" }
                .joined(separator: ", ")
            logPlayback("play start id=\(messageID) route=\(outputs.isEmpty ? "-" : outputs)")
            if !player.play() {
                logPlayback("player refused to start id=\(messageID)")
                finishPlayback()
            }
        } catch {
            logPlayback("player decode error=\(error.localizedDescription)")
            finishPlayback()
        }
    }

    private func playSpeechFallback(text: String, messageID: String) {
        let normalizedText = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalizedText.isEmpty else { return }

        let audioSession = AVAudioSession.sharedInstance()
        do {
            try audioSession.setCategory(.playback, mode: .spokenAudio, options: [.duckOthers])
            try audioSession.setActive(true)
        } catch {
            logPlayback("speech fallback session error=\(error.localizedDescription)")
        }

        clearPlaybackState(deactivateAudioSession: false)

        let utterance = AVSpeechUtterance(string: normalizedText)
        utterance.rate = 0.47
        utterance.pitchMultiplier = 1.0
        utterance.volume = 1.0
        utterance.voice = AVSpeechSynthesisVoice(language: session.preferredLanguageCode) ?? AVSpeechSynthesisVoice(language: "en-US")

        let outputs = audioSession.currentRoute.outputs
            .map { "\($0.portType.rawValue):\($0.portName)" }
            .joined(separator: ", ")
        logPlayback(
            "speech fallback start id=\(messageID) voice=\(utterance.voice?.language ?? "-") route=\(outputs.isEmpty ? "-" : outputs)"
        )

        setActivePlaybackMessageID(messageID)
        speechSynthesizer.speak(utterance)
    }

    private func finishPlayback() {
        logPlayback("play finish")
        clearPlaybackState(deactivateAudioSession: true)
    }

    private func stopPlayback() {
        playbackRequestToken = UUID()
        finishPlayback()
    }

    private func clearPlaybackState(deactivateAudioSession: Bool) {
        if deactivateAudioSession {
            try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
        }
        audioPlayer?.pause()
        audioPlayer = nil
        if speechSynthesizer.isSpeaking || speechSynthesizer.isPaused {
            speechSynthesizer.stopSpeaking(at: .immediate)
        }
        setActivePlaybackMessageID(nil)
    }

    private func setActivePlaybackMessageID(_ nextID: String?) {
        guard activePlaybackMessageID != nextID else { return }

        let previousID = activePlaybackMessageID
        activePlaybackMessageID = nextID
        reloadPlaybackRows(for: [previousID, nextID].compactMap { $0 })
    }

    private func reloadPlaybackRows(for ids: [String]) {
        guard !ids.isEmpty else { return }

        let indexPaths = ids.compactMap { id in
            messages.firstIndex(where: { $0.id == id }).map { IndexPath(row: $0, section: 0) }
        }
        guard !indexPaths.isEmpty else { return }

        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            UIView.performWithoutAnimation {
                self.tableView.reloadRows(at: indexPaths, with: .none)
            }
        }
    }

    private func scrollToBottom(animated: Bool) {
        let rowCount = tableView.numberOfRows(inSection: 0)
        guard rowCount > 0 else { return }
        let indexPath = IndexPath(row: rowCount - 1, section: 0)
        DispatchQueue.main.async { [weak self] in
            self?.tableView.scrollToRow(at: indexPath, at: .bottom, animated: animated)
        }
    }

    private func presentNotifications() {
        let controller = UINavigationController(rootViewController: NotificationsViewController(copy: copy))
        if let sheet = controller.sheetPresentationController {
            sheet.detents = [.medium(), .large()]
            sheet.prefersGrabberVisible = true
        }
        present(controller, animated: true)
    }

    private func presentDiagnostics() {
        let controller = UINavigationController(rootViewController: DiagnosticsViewController(session: session, copy: copy))
        if let sheet = controller.sheetPresentationController {
            sheet.detents = [.medium(), .large()]
            sheet.prefersGrabberVisible = true
        }
        present(controller, animated: true)
    }
}

extension ChatViewController: UITableViewDataSource {
    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        messages.count + (isAwaitingReply ? 1 : 0)
    }

    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(
            withIdentifier: ChatMessageCell.reuseIdentifier,
            for: indexPath
        )

        guard let messageCell = cell as? ChatMessageCell else {
            return cell
        }

        let row = displayRow(at: indexPath)
        messageCell.configure(
            with: row,
            theme: theme,
            retryCopy: copy.chat.retrySend,
            replayCopy: copy.chat.listenAgain,
            playingCopy: copy.chat.playingNow,
            isPlaying: row.id == activePlaybackMessageID
        )
        messageCell.onReplayTap = { [weak self] in
            self?.playMessageAudio(for: row)
        }
        return messageCell
    }
}

extension ChatViewController: UITextFieldDelegate {
    @objc private func textFieldDidChange() {
        refreshComposerState()
    }

    func textFieldDidBeginEditing(_ textField: UITextField) {
        scrollToBottom(animated: false)
    }

    func textFieldShouldReturn(_ textField: UITextField) -> Bool {
        sendCurrentDraft()
        return false
    }
}

extension ChatViewController: AVAudioPlayerDelegate {
    func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        finishPlayback()
    }

    func audioPlayerDecodeErrorDidOccur(_ player: AVAudioPlayer, error: Error?) {
        finishPlayback()
    }
}

extension ChatViewController: AVSpeechSynthesizerDelegate {
    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        logPlayback("speech fallback finish")
        finishPlayback()
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        logPlayback("speech fallback cancel")
        finishPlayback()
    }
}

private final class ChatMessageCell: UITableViewCell {
    static let reuseIdentifier = "ChatMessageCell"

    private let bubbleView = UIView()
    private let messageLabel = UILabel()
    private let statusLabel = UILabel()
    private let footerRow = UIStackView()
    private let replayButton = UIButton(type: .system)
    private let footerSpacer = UIView()
    private var userTrailingConstraint: NSLayoutConstraint!
    private var userLeadingLimitConstraint: NSLayoutConstraint!
    private var botLeadingConstraint: NSLayoutConstraint!
    private var botTrailingLimitConstraint: NSLayoutConstraint!
    var onReplayTap: (() -> Void)?

    override init(style: UITableViewCell.CellStyle, reuseIdentifier: String?) {
        super.init(style: style, reuseIdentifier: reuseIdentifier)
        selectionStyle = .none
        backgroundColor = .clear
        contentView.backgroundColor = .clear

        bubbleView.translatesAutoresizingMaskIntoConstraints = false
        bubbleView.layer.cornerRadius = 22
        bubbleView.layer.cornerCurve = .continuous

        let textStack = UIStackView()
        textStack.translatesAutoresizingMaskIntoConstraints = false
        textStack.axis = .vertical
        textStack.spacing = 6

        messageLabel.numberOfLines = 0
        messageLabel.font = .systemFont(ofSize: 16, weight: .medium)

        statusLabel.numberOfLines = 1
        statusLabel.font = .systemFont(ofSize: 12, weight: .semibold)
        statusLabel.isHidden = true

        footerRow.translatesAutoresizingMaskIntoConstraints = false
        footerRow.axis = .horizontal
        footerRow.spacing = 8
        footerRow.alignment = .center
        footerRow.distribution = .fill
        footerRow.isHidden = true

        replayButton.translatesAutoresizingMaskIntoConstraints = false
        replayButton.configuration = .plain()
        replayButton.contentHorizontalAlignment = .leading
        replayButton.setContentHuggingPriority(.required, for: .horizontal)
        replayButton.setContentCompressionResistancePriority(.required, for: .horizontal)
        replayButton.addTarget(self, action: #selector(handleReplayTap), for: .touchUpInside)

        footerSpacer.translatesAutoresizingMaskIntoConstraints = false
        footerSpacer.setContentHuggingPriority(.defaultLow, for: .horizontal)
        footerSpacer.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)

        textStack.addArrangedSubview(messageLabel)
        footerRow.addArrangedSubview(statusLabel)
        footerRow.addArrangedSubview(replayButton)
        footerRow.addArrangedSubview(footerSpacer)
        textStack.addArrangedSubview(footerRow)
        bubbleView.addSubview(textStack)
        contentView.addSubview(bubbleView)

        NSLayoutConstraint.activate([
            bubbleView.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 6),
            bubbleView.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -6),
            bubbleView.widthAnchor.constraint(lessThanOrEqualTo: contentView.widthAnchor, multiplier: 0.78),

            textStack.topAnchor.constraint(equalTo: bubbleView.topAnchor, constant: 14),
            textStack.leadingAnchor.constraint(equalTo: bubbleView.leadingAnchor, constant: 14),
            textStack.trailingAnchor.constraint(equalTo: bubbleView.trailingAnchor, constant: -14),
            textStack.bottomAnchor.constraint(equalTo: bubbleView.bottomAnchor, constant: -14)
        ])

        userTrailingConstraint = bubbleView.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -20)
        userLeadingLimitConstraint = bubbleView.leadingAnchor.constraint(greaterThanOrEqualTo: contentView.leadingAnchor, constant: 90)
        botLeadingConstraint = bubbleView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 20)
        botTrailingLimitConstraint = bubbleView.trailingAnchor.constraint(lessThanOrEqualTo: contentView.trailingAnchor, constant: -90)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func prepareForReuse() {
        super.prepareForReuse()
        userTrailingConstraint.isActive = false
        userLeadingLimitConstraint.isActive = false
        botLeadingConstraint.isActive = false
        botTrailingLimitConstraint.isActive = false
        statusLabel.isHidden = true
        footerRow.isHidden = true
        replayButton.isHidden = true
        replayButton.isEnabled = true
        replayButton.layer.removeAnimation(forKey: "chat-replay-pulse")
        bubbleView.layer.removeAnimation(forKey: "chat-speaking-glow")
        bubbleView.layer.shadowOpacity = 0
        bubbleView.layer.shadowRadius = 0
        bubbleView.layer.borderWidth = 0
        bubbleView.layer.borderColor = nil
        messageLabel.font = .systemFont(ofSize: 16, weight: .medium)
        onReplayTap = nil
    }

    func configure(
        with message: ChatMessageRow,
        theme: ScreenTheme,
        retryCopy: String,
        replayCopy: String,
        playingCopy: String,
        isPlaying: Bool
    ) {
        let isUser = message.role == .user
        let isTyping = message.role == .typing

        bubbleView.layer.removeAnimation(forKey: "chat-speaking-glow")
        replayButton.layer.removeAnimation(forKey: "chat-replay-pulse")
        bubbleView.layer.shadowOpacity = 0
        bubbleView.layer.shadowRadius = 0
        bubbleView.layer.borderWidth = 0
        bubbleView.layer.borderColor = UIColor.clear.cgColor

        userTrailingConstraint.isActive = isUser
        userLeadingLimitConstraint.isActive = isUser
        botLeadingConstraint.isActive = !isUser
        botTrailingLimitConstraint.isActive = !isUser

        messageLabel.text = message.text
        if isTyping {
            messageLabel.font = .italicSystemFont(ofSize: 16)
            messageLabel.textColor = .secondaryLabel
            bubbleView.backgroundColor = theme.accent
            statusLabel.isHidden = true
            footerRow.isHidden = true
            return
        }

        if isUser {
            bubbleView.backgroundColor = message.failed ? UIColor.systemRed : theme.tint
            messageLabel.textColor = .white
            statusLabel.textColor = UIColor.white.withAlphaComponent(0.92)
        } else {
            bubbleView.backgroundColor = .white
            messageLabel.textColor = .label
        }

        replayButton.isHidden = !message.canReplayAudio
        if message.canReplayAudio {
            replayButton.configuration = replayButtonConfiguration(
                title: isPlaying ? playingCopy : replayCopy,
                symbolName: isPlaying ? "speaker.wave.2.fill" : "speaker.wave.1",
                tint: theme.tint,
                active: isPlaying
            )
            replayButton.isEnabled = true
        }

        if message.failed {
            statusLabel.text = retryCopy
            statusLabel.isHidden = false
        } else {
            statusLabel.isHidden = true
        }

        footerRow.isHidden = statusLabel.isHidden && replayButton.isHidden

        if !isUser && isPlaying {
            bubbleView.backgroundColor = theme.accent.withAlphaComponent(0.92)
            bubbleView.layer.borderWidth = 1
            bubbleView.layer.borderColor = theme.tint.withAlphaComponent(0.20).cgColor
            bubbleView.layer.shadowColor = theme.tint.withAlphaComponent(0.55).cgColor
            bubbleView.layer.shadowOffset = CGSize(width: 0, height: 8)
            bubbleView.layer.shadowRadius = 14
            bubbleView.layer.shadowOpacity = 0.14
            addSpeakingAnimations()
        }
    }

    @objc private func handleReplayTap() {
        onReplayTap?()
    }

    private func replayButtonConfiguration(title: String, symbolName: String, tint: UIColor, active: Bool) -> UIButton.Configuration {
        var configuration = UIButton.Configuration.plain()
        configuration.title = title
        configuration.image = UIImage(systemName: symbolName)
        configuration.imagePadding = 6
        configuration.baseForegroundColor = active ? .white : tint
        configuration.cornerStyle = .capsule
        configuration.contentInsets = NSDirectionalEdgeInsets(top: 6, leading: 9, bottom: 6, trailing: 10)
        configuration.background.backgroundColor = active ? tint : tint.withAlphaComponent(0.10)
        configuration.background.strokeColor = active ? tint.withAlphaComponent(0.0) : tint.withAlphaComponent(0.14)
        configuration.background.strokeWidth = active ? 0 : 1
        return configuration
    }

    private func addSpeakingAnimations() {
        let glowAnimation = CABasicAnimation(keyPath: "shadowOpacity")
        glowAnimation.fromValue = 0.10
        glowAnimation.toValue = 0.22
        glowAnimation.duration = 0.9
        glowAnimation.autoreverses = true
        glowAnimation.repeatCount = .infinity
        bubbleView.layer.add(glowAnimation, forKey: "chat-speaking-glow")

        let pulseAnimation = CABasicAnimation(keyPath: "transform.scale")
        pulseAnimation.fromValue = 1.0
        pulseAnimation.toValue = 1.04
        pulseAnimation.duration = 0.9
        pulseAnimation.autoreverses = true
        pulseAnimation.repeatCount = .infinity
        replayButton.layer.add(pulseAnimation, forKey: "chat-replay-pulse")
    }
}

private func chatMakeCard(backgroundColor: UIColor) -> UIView {
    let card = UIView()
    card.translatesAutoresizingMaskIntoConstraints = false
    card.backgroundColor = backgroundColor
    card.layer.cornerRadius = 28
    card.layer.shadowColor = UIColor.black.withAlphaComponent(0.08).cgColor
    card.layer.shadowOpacity = 1
    card.layer.shadowOffset = CGSize(width: 0, height: 12)
    card.layer.shadowRadius = 18
    return card
}

private func chatMakeStack(spacing: CGFloat) -> UIStackView {
    let stack = UIStackView()
    stack.translatesAutoresizingMaskIntoConstraints = false
    stack.axis = .vertical
    stack.spacing = spacing
    return stack
}

private func chatPin(_ child: UIView, to parent: UIView, insets: UIEdgeInsets) {
    NSLayoutConstraint.activate([
        child.topAnchor.constraint(equalTo: parent.topAnchor, constant: insets.top),
        child.leadingAnchor.constraint(equalTo: parent.leadingAnchor, constant: insets.left),
        child.trailingAnchor.constraint(equalTo: parent.trailingAnchor, constant: -insets.right),
        child.bottomAnchor.constraint(equalTo: parent.bottomAnchor, constant: -insets.bottom)
    ])
}
