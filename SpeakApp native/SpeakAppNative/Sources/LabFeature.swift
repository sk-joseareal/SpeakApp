import AVFoundation
import Speech
import UIKit

private let labAzurePhonemeIpaMap: [String: String] = [
    "aa": "ɑ",
    "ae": "æ",
    "ah": "ʌ",
    "ao": "ɔ",
    "aw": "aʊ",
    "ax": "ə",
    "axr": "ɚ",
    "ay": "aɪ",
    "b": "b",
    "ch": "tʃ",
    "d": "d",
    "dh": "ð",
    "eh": "ɛ",
    "er": "ɝ",
    "ey": "eɪ",
    "f": "f",
    "g": "ɡ",
    "h": "h",
    "hh": "h",
    "ih": "ɪ",
    "iy": "iː",
    "jh": "dʒ",
    "k": "k",
    "l": "l",
    "m": "m",
    "n": "n",
    "ng": "ŋ",
    "ow": "oʊ",
    "oy": "ɔɪ",
    "p": "p",
    "r": "ɹ",
    "s": "s",
    "sh": "ʃ",
    "t": "t",
    "th": "θ",
    "uh": "ʊ",
    "uw": "uː",
    "v": "v",
    "w": "w",
    "y": "j",
    "z": "z",
    "zh": "ʒ"
]

private enum LabPlaybackSource {
    case phrase
    case recording
}

private struct LabPlaybackWordSegment {
    let wordIndex: Int
    let startTime: TimeInterval
    let endTime: TimeInterval
}

private struct LabAssessmentScores {
    let overall: Double?
    let accuracy: Double?
    let fluency: Double?
    let completeness: Double?
    let prosody: Double?

    var hasAnyValue: Bool {
        [overall, accuracy, fluency, completeness, prosody].contains { value in
            value != nil
        }
    }
}

private enum LabAdvancedWordStatus: String {
    case ok
    case wrong
    case missing
    case extra
    case issue
    case unknown

    init(rawValue: String) {
        switch rawValue.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() {
        case "ok":
            self = .ok
        case "wrong":
            self = .wrong
        case "missing":
            self = .missing
        case "extra":
            self = .extra
        case "issue":
            self = .issue
        default:
            self = .unknown
        }
    }

    var label: String {
        switch self {
        case .ok:
            return "OK"
        case .wrong:
            return "Incorrect"
        case .missing:
            return "Missing"
        case .extra:
            return "Extra"
        case .issue:
            return "Issue"
        case .unknown:
            return "Unknown"
        }
    }
}

private struct LabAdvancedPhoneme {
    let phoneme: String
    let score: Int?
    let offsetMs: Int?
    let durationMs: Int?
    let endMs: Int?

    var hasPlaybackTiming: Bool {
        offsetMs != nil && endMs != nil
    }

    var summaryText: String {
        if let score {
            return "\(phoneme):\(score)%"
        }
        return phoneme
    }

    static func fromPayload(_ payload: Any) -> LabAdvancedPhoneme? {
        if let raw = payload as? String {
            let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty else { return nil }
            return LabAdvancedPhoneme(phoneme: trimmed, score: nil, offsetMs: nil, durationMs: nil, endMs: nil)
        }

        guard let dict = payload as? [String: Any] else { return nil }
        let phoneme = labString(dict["phoneme"])
        guard !phoneme.isEmpty else { return nil }
        let offsetMs = labDouble(dict["offset_ms"]).map { Int($0.rounded()) }
        let durationMs = labDouble(dict["duration_ms"]).map { Int($0.rounded()) }
        let endMs = labDouble(dict["end_ms"]).map { Int($0.rounded()) } ?? {
            guard let offsetMs else { return nil }
            return offsetMs + max(20, durationMs ?? 0)
        }()
        return LabAdvancedPhoneme(
            phoneme: phoneme,
            score: labDouble(dict["score"]).map { Int($0.rounded()) },
            offsetMs: offsetMs,
            durationMs: durationMs,
            endMs: endMs
        )
    }
}

private struct LabAdvancedWord {
    let expected: String
    let recognized: String
    let status: LabAdvancedWordStatus
    let score: Int?
    let errorType: String
    let phonemes: [LabAdvancedPhoneme]
    let startMs: Int?
    let endMs: Int?

    var durationText: String {
        guard let playbackStartMs, let playbackEndMs, playbackEndMs >= playbackStartMs else { return "—" }
        return "\(playbackEndMs - playbackStartMs) ms"
    }

    var playbackStartMs: Int? {
        startMs ?? phonemes.compactMap(\.offsetMs).min()
    }

    var playbackEndMs: Int? {
        endMs ?? phonemes.compactMap(\.endMs).max()
    }

    var phonemeSummary: String {
        let items = phonemes.map(\.summaryText)
        return items.isEmpty ? "—" : items.joined(separator: " · ")
    }

    static func fromPayload(_ payload: Any) -> LabAdvancedWord? {
        guard let dict = payload as? [String: Any] else { return nil }
        let expected = labFirstNonEmptyString([
            labString(dict["expected"]),
            labString(dict["text"]),
            labString(dict["word"])
        ])
        let recognized = labString(dict["recognized"])
        let status = LabAdvancedWordStatus(rawValue: labString(dict["status"]))
        let phonemes = (dict["phonemes"] as? [Any] ?? []).compactMap(LabAdvancedPhoneme.fromPayload)

        return LabAdvancedWord(
            expected: expected,
            recognized: recognized,
            status: status,
            score: labDouble(dict["score"]).map { Int($0.rounded()) },
            errorType: labString(dict["error_type"]),
            phonemes: phonemes,
            startMs: labDouble(dict["start_ms"]).map { Int($0.rounded()) },
            endMs: labDouble(dict["end_ms"]).map { Int($0.rounded()) }
        )
    }
}

private struct LabAdvancedAssessment {
    let ok: Bool
    let transcript: String
    let recognitionStatus: String
    let errorCode: String
    let errorLabel: String
    let errorMessage: String
    let scores: LabAssessmentScores
    let words: [LabAdvancedWord]

    var summaryText: String {
        guard ok else {
            if !errorLabel.isEmpty {
                return errorLabel
            }
            if !errorCode.isEmpty {
                return errorCode
            }
            return "Error"
        }

        var parts: [String] = []
        func appendScore(_ prefix: String, _ value: Double?) {
            guard let value else { return }
            parts.append("\(prefix)\(Int(value.rounded()))")
        }
        appendScore("O", scores.overall)
        appendScore("A", scores.accuracy)
        appendScore("F", scores.fluency)
        appendScore("C", scores.completeness)
        appendScore("P", scores.prosody)

        if !parts.isEmpty {
            return parts.joined(separator: " · ")
        }
        if !recognitionStatus.isEmpty {
            return recognitionStatus
        }
        return "OK"
    }

    static func fromResponse(data: Data, statusCode: Int) -> LabAdvancedAssessment? {
        guard
            let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else {
            return nil
        }

        let ok = labBool(root["ok"]) ?? ((200 ... 299).contains(statusCode))
        let scoresPayload = root["scores"] as? [String: Any] ?? [:]
        let scores = LabAssessmentScores(
            overall: labDouble(scoresPayload["overall"]),
            accuracy: labDouble(scoresPayload["accuracy"]),
            fluency: labDouble(scoresPayload["fluency"]),
            completeness: labDouble(scoresPayload["completeness"]),
            prosody: labDouble(scoresPayload["prosody"])
        )

        let errorCode = labString(root["error"])
        let errorMessage = labString(root["message"])
        let words = (root["words"] as? [Any] ?? []).compactMap(LabAdvancedWord.fromPayload)
        let errorLabel: String
        switch errorCode {
        case "pronunciation_daily_seconds_limit":
            errorLabel = "Daily limit"
        case "pronunciation_assess_not_configured":
            errorLabel = "Not configured"
        default:
            errorLabel = errorMessage.isEmpty ? errorCode : errorMessage
        }

        return LabAdvancedAssessment(
            ok: ok,
            transcript: labString(root["transcript"]),
            recognitionStatus: labString(root["recognition_status"]),
            errorCode: errorCode,
            errorLabel: errorLabel,
            errorMessage: errorMessage,
            scores: scores,
            words: words
        )
    }
}

private struct LabSavedPhrase: Codable, Hashable {
    let id: String
    let text: String
    let localeCode: String
    let createdAt: TimeInterval
    let updatedAt: TimeInterval
    let lastPracticedAt: TimeInterval
    let useCount: Int

    func updated(text: String, now: TimeInterval) -> LabSavedPhrase {
        LabSavedPhrase(
            id: id,
            text: text,
            localeCode: localeCode,
            createdAt: createdAt,
            updatedAt: now,
            lastPracticedAt: lastPracticedAt,
            useCount: useCount
        )
    }

    func markUsed(now: TimeInterval) -> LabSavedPhrase {
        LabSavedPhrase(
            id: id,
            text: text,
            localeCode: localeCode,
            createdAt: createdAt,
            updatedAt: updatedAt,
            lastPracticedAt: now,
            useCount: useCount + 1
        )
    }
}

private final class LabPhraseStore {
    private enum StorageKey {
        static let phrasePrefix = "SpeakAppNative.lab.text."
        static let savedPrefix = "SpeakAppNative.lab.saved."
        static let maxSavedItems = 120
    }

    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    func storedPhrase(locale: AppLocale) -> String {
        defaults.string(forKey: StorageKey.phrasePrefix + locale.rawValue) ?? ""
    }

    func persistPhrase(_ text: String, locale: AppLocale) {
        defaults.set(text, forKey: StorageKey.phrasePrefix + locale.rawValue)
    }

    func savedPhrases(ownerKey: String, localeCode: String) -> [LabSavedPhrase] {
        guard
            let data = defaults.data(forKey: storageKey(for: ownerKey)),
            let items = try? JSONDecoder().decode([LabSavedPhrase].self, from: data)
        else {
            return []
        }

        return items
            .filter { $0.localeCode == localeCode }
            .sorted(by: sortSavedPhrases)
    }

    @discardableResult
    func savePhrase(_ text: String, ownerKey: String, localeCode: String) -> (item: LabSavedPhrase, updated: Bool)? {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }

        let comparable = normalizedComparableText(trimmed)
        let now = Date().timeIntervalSince1970
        var items = allSavedPhrases(ownerKey: ownerKey)

        if let index = items.firstIndex(where: {
            $0.localeCode == localeCode && normalizedComparableText($0.text) == comparable
        }) {
            let updatedItem = items[index].updated(text: trimmed, now: now)
            items[index] = updatedItem
            persist(items: items, ownerKey: ownerKey)
            return (updatedItem, true)
        }

        let item = LabSavedPhrase(
            id: "lab_\(UUID().uuidString.lowercased())",
            text: trimmed,
            localeCode: localeCode,
            createdAt: now,
            updatedAt: now,
            lastPracticedAt: 0,
            useCount: 0
        )
        items.append(item)
        persist(items: items, ownerKey: ownerKey)
        return (item, false)
    }

    func markPhraseUsed(_ phraseID: String, ownerKey: String) {
        var items = allSavedPhrases(ownerKey: ownerKey)
        guard let index = items.firstIndex(where: { $0.id == phraseID }) else { return }
        items[index] = items[index].markUsed(now: Date().timeIntervalSince1970)
        persist(items: items, ownerKey: ownerKey)
    }

    func deletePhrase(_ phraseID: String, ownerKey: String) {
        let next = allSavedPhrases(ownerKey: ownerKey).filter { $0.id != phraseID }
        persist(items: next, ownerKey: ownerKey)
    }

    private func allSavedPhrases(ownerKey: String) -> [LabSavedPhrase] {
        guard
            let data = defaults.data(forKey: storageKey(for: ownerKey)),
            let items = try? JSONDecoder().decode([LabSavedPhrase].self, from: data)
        else {
            return []
        }
        return items
    }

    private func persist(items: [LabSavedPhrase], ownerKey: String) {
        let sorted = items
            .sorted(by: sortSavedPhrases)
            .prefix(StorageKey.maxSavedItems)
        guard let data = try? JSONEncoder().encode(Array(sorted)) else { return }
        defaults.set(data, forKey: storageKey(for: ownerKey))
    }

    private func storageKey(for ownerKey: String) -> String {
        StorageKey.savedPrefix + ownerKey
    }

    private func normalizedComparableText(_ text: String) -> String {
        text
            .lowercased()
            .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func sortSavedPhrases(_ lhs: LabSavedPhrase, _ rhs: LabSavedPhrase) -> Bool {
        let lhsSort = max(lhs.lastPracticedAt, lhs.updatedAt, lhs.createdAt)
        let rhsSort = max(rhs.lastPracticedAt, rhs.updatedAt, rhs.createdAt)
        if lhsSort != rhsSort {
            return lhsSort > rhsSort
        }
        return lhs.text.localizedCaseInsensitiveCompare(rhs.text) == .orderedAscending
    }
}

private final class LabAlignedTTSClient {
    private struct Payload: Decodable {
        let ok: Bool?
        let audioURL: String?
        let error: String?
        let message: String?

        private enum CodingKeys: String, CodingKey {
            case ok
            case audioURL = "audio_url"
            case error
            case message
        }
    }

    private let endpoint = URL(string: "https://realtime.curso-ingles.com/realtime/tts/aligned")!
    private let token = RealtimeEnvironment.stateToken
    private let decoder = JSONDecoder()
    private let cache = NSCache<NSString, NSData>()

    func fetchAudioData(text: String, localeCode: String, user: AppSessionUser?) async throws -> Data {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            throw NSError(domain: "LabAlignedTTSClient", code: -1)
        }

        let cacheKey = "\(localeCode)::\(trimmed)" as NSString
        if let cached = cache.object(forKey: cacheKey) {
            return Data(referencing: cached)
        }

        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if !token.isEmpty {
            request.setValue(token, forHTTPHeaderField: "x-rt-token")
        }

        var payload: [String: Any] = [
            "text": trimmed,
            "locale": localeCode
        ]
        if let user, !user.id.isEmpty {
            payload["user_id"] = user.id
            payload["user_name"] = user.resolvedDisplayName
        }
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw NSError(domain: "LabAlignedTTSClient", code: -2)
        }

        let alignedResponse = try decoder.decode(Payload.self, from: data)
        guard
            (200 ... 299).contains(http.statusCode),
            alignedResponse.ok == true,
            let rawAudioURL = alignedResponse.audioURL,
            let audioURL = URL(string: rawAudioURL),
            let scheme = audioURL.scheme?.lowercased(),
            scheme == "https" || scheme == "http"
        else {
            let message = alignedResponse.message ?? alignedResponse.error ?? "tts_unavailable"
            throw NSError(
                domain: "LabAlignedTTSClient",
                code: http.statusCode,
                userInfo: [NSLocalizedDescriptionKey: message]
            )
        }

        let (audioData, audioResponse) = try await URLSession.shared.data(from: audioURL)
        guard
            let audioHTTP = audioResponse as? HTTPURLResponse,
            (200 ... 299).contains(audioHTTP.statusCode),
            !audioData.isEmpty
        else {
            throw NSError(domain: "LabAlignedTTSClient", code: -3)
        }

        cache.setObject(audioData as NSData, forKey: cacheKey)
        return audioData
    }
}

private final class LabPronunciationAssessmentClient {
    private let endpoint = URL(string: "https://realtime.curso-ingles.com/realtime/pronunciation/assess")!
    private let token = RealtimeEnvironment.stateToken

    func assess(recordingURL: URL, expectedText: String, localeCode: String, user: AppSessionUser?) async throws -> LabAdvancedAssessment? {
        let audioData = try Data(contentsOf: recordingURL)
        guard !audioData.isEmpty else { return nil }

        let duration = labAudioDuration(for: recordingURL)
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if !token.isEmpty {
            request.setValue(token, forHTTPHeaderField: "x-rt-token")
        }

        var payload: [String: Any] = [
            "expected_text": expectedText,
            "locale": localeCode,
            "audio_base64": audioData.base64EncodedString(),
            "audio_content_type": "audio/wav"
        ]
        if duration > 0 {
            payload["audio_duration_sec"] = duration
        }
        if let user, !user.id.isEmpty {
            payload["user_id"] = user.id
            payload["user_name"] = user.resolvedDisplayName
        }

        request.httpBody = try JSONSerialization.data(withJSONObject: payload)
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            return nil
        }

        return LabAdvancedAssessment.fromResponse(data: data, statusCode: http.statusCode)
    }
}

final class LabViewController: UIViewController {
    fileprivate enum ResultTone {
        case hint
        case good
        case okay
        case bad
        case warn
    }

    private let sessionStore: AppSessionStore
    private let copy: AppCopy
    private let theme = RootScreen.lab.theme
    private let phraseStore = LabPhraseStore()
    private let ttsClient = LabAlignedTTSClient()
    private let assessmentClient = LabPronunciationAssessmentClient()
    private let speechSynthesizer = AVSpeechSynthesizer()

    private let scrollView = UIScrollView()
    private let contentStack = UIStackView()
    private let titleLabel = UILabel()
    private let heroCard = UIView()
    private let mascotCard = UIView()
    private let mascotImageView = UIImageView()
    private let heroBubbleLabel = UILabel()
    private let phraseCard = UIView()
    private let phraseTextView = UITextView()
    private let phrasePlaceholderLabel = UILabel()
    private let savePhraseButton = UIButton(type: .system)
    private let myPhrasesButton = UIButton(type: .system)
    private let targetContainer = UIView()
    private let targetLabel = UILabel()
    private let playPhraseButton = UIButton(type: .system)
    private let scoreLineView = UIView()
    private let scoreValueLabel = UILabel()
    private let scoreTextLabel = UILabel()
    private let advancedSummaryLabel = PaddingLabel()
    private let advancedWordsScrollView = UIScrollView()
    private let advancedWordsStack = UIStackView()
    private let advancedWordDetailView = UIView()
    private let advancedWordDetailLabel = UILabel()
    private let advancedPhonemesScrollView = UIScrollView()
    private let advancedPhonemesStack = UIStackView()
    private let transcriptContainer = UIView()
    private let transcriptLabel = UILabel()
    private let actionsRow = UIStackView()
    private let recordButton = UIButton(type: .system)
    private let voiceButton = UIButton(type: .system)
    private let toastLabel = PaddingLabel()

    private var phraseTextViewHeightConstraint: NSLayoutConstraint?
    private var keyboardObservers: [NSObjectProtocol] = []

    private var expectedText = ""
    private var transcriptText = ""
    private var scorePercent: Int?
    private var activeResultTone: ResultTone = .hint
    private var resultMessage = ""
    private var advancedAssessment: LabAdvancedAssessment?
    private var isAdvancedAssessmentPending = false
    private var selectedAdvancedWordIndex: Int?
    private var activePlaybackSource: LabPlaybackSource?
    private var activePlaybackWordIndex: Int?
    private var isRecording = false
    private var isTranscribing = false

    private var audioRecorder: AVAudioRecorder?
    private var audioPlayer: AVAudioPlayer?
    private var playbackWordTimer: Timer?
    private var playbackWordSegments: [LabPlaybackWordSegment] = []
    private var activeAdvancedPhonemes: [LabAdvancedPhoneme] = []
    private var advancedPhonemeLabels: [PaddingLabel] = []
    private var recordingURL: URL?
    private var recognitionTask: SFSpeechRecognitionTask?
    private var recognitionRequestToken = UUID()
    private var toastHideWorkItem: DispatchWorkItem?
    private lazy var mascotTalkFrames: [UIImage] = labLoadMascotTalkFrames()
    private lazy var mascotRestImage: UIImage? = UIImage(named: "MascotTalk08") ?? UIImage(named: "Mascot")

    init(sessionStore: AppSessionStore, copy: AppCopy) {
        self.sessionStore = sessionStore
        self.copy = copy
        self.expectedText = phraseStore.storedPhrase(locale: sessionStore.session.locale)
        self.resultMessage = copy.freeRide.feedbackHint
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        speechSynthesizer.delegate = self
        view.backgroundColor = theme.background
        configureNavigationBar()
        buildLayout()
        installKeyboardObservers()
        installGestures()
        updateUI(animated: false)
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        navigationController?.navigationBar.tintColor = theme.tint
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        updateTextViewHeight()
    }

    override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated)
        if !isBeingDismissed {
            stopPlayback()
        }
    }

    deinit {
        keyboardObservers.forEach(NotificationCenter.default.removeObserver)
        recognitionTask?.cancel()
    }

    private var session: AppSession {
        sessionStore.session
    }

    private var user: AppSessionUser? {
        session.user
    }

    private var practiceLocaleCode: String {
        session.preferredLanguageCode.isEmpty ? "en-US" : session.preferredLanguageCode
    }

    private var savedPhrasesOwnerKey: String {
        let candidate = user?.id.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return candidate.isEmpty ? "guest" : candidate
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
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.alwaysBounceVertical = true
        scrollView.keyboardDismissMode = .interactive

        contentStack.translatesAutoresizingMaskIntoConstraints = false
        contentStack.axis = .vertical
        contentStack.spacing = 18

        view.addSubview(scrollView)
        scrollView.addSubview(contentStack)
        view.addSubview(toastLabel)

        NSLayoutConstraint.activate([
            scrollView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor),

            contentStack.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor, constant: 18),
            contentStack.leadingAnchor.constraint(equalTo: scrollView.frameLayoutGuide.leadingAnchor, constant: 16),
            contentStack.trailingAnchor.constraint(equalTo: scrollView.frameLayoutGuide.trailingAnchor, constant: -16),
            contentStack.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor, constant: -28),

            toastLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            toastLabel.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -18),
            toastLabel.leadingAnchor.constraint(greaterThanOrEqualTo: view.leadingAnchor, constant: 24),
            toastLabel.trailingAnchor.constraint(lessThanOrEqualTo: view.trailingAnchor, constant: -24)
        ])

        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        titleLabel.font = .systemFont(ofSize: 24, weight: .bold)
        titleLabel.textColor = labPrimaryTextColor()
        titleLabel.text = copy.freeRide.title

        buildHeroCard()
        buildPhraseCard()

        toastLabel.translatesAutoresizingMaskIntoConstraints = false
        toastLabel.font = .systemFont(ofSize: 14, weight: .semibold)
        toastLabel.textColor = .white
        toastLabel.backgroundColor = UIColor.black.withAlphaComponent(0.84)
        toastLabel.layer.cornerRadius = 16
        toastLabel.clipsToBounds = true
        toastLabel.alpha = 0
        toastLabel.isHidden = true
        toastLabel.contentInsets = UIEdgeInsets(top: 10, left: 14, bottom: 10, right: 14)

        contentStack.addArrangedSubview(titleLabel)
        contentStack.addArrangedSubview(heroCard)
        contentStack.addArrangedSubview(phraseCard)
    }

    private func buildHeroCard() {
        heroCard.translatesAutoresizingMaskIntoConstraints = false
        heroCard.backgroundColor = .white
        heroCard.layer.cornerRadius = 20
        heroCard.layer.borderWidth = 1
        heroCard.layer.borderColor = labSurfaceBorderColor().cgColor
        heroCard.layer.shadowColor = labSurfaceShadowColor().cgColor
        heroCard.layer.shadowOpacity = 1
        heroCard.layer.shadowRadius = 12
        heroCard.layer.shadowOffset = CGSize(width: 0, height: 6)

        let stack = UIStackView()
        stack.translatesAutoresizingMaskIntoConstraints = false
        stack.axis = .horizontal
        stack.spacing = 12
        stack.alignment = .center
        heroCard.addSubview(stack)
        labPin(stack, to: heroCard, insets: UIEdgeInsets(top: 14, left: 14, bottom: 14, right: 14))

        mascotCard.translatesAutoresizingMaskIntoConstraints = false
        mascotCard.backgroundColor = theme.accent
        mascotCard.layer.cornerRadius = 16
        mascotCard.layer.cornerCurve = .continuous
        NSLayoutConstraint.activate([
            mascotCard.widthAnchor.constraint(equalToConstant: 58),
            mascotCard.heightAnchor.constraint(equalToConstant: 72)
        ])

        mascotImageView.translatesAutoresizingMaskIntoConstraints = false
        mascotImageView.contentMode = .scaleAspectFit
        mascotImageView.image = mascotRestImage
        mascotCard.addSubview(mascotImageView)
        labPin(mascotImageView, to: mascotCard, insets: UIEdgeInsets(top: 8, left: 8, bottom: 8, right: 8))

        let textStack = UIStackView()
        textStack.translatesAutoresizingMaskIntoConstraints = false
        textStack.axis = .vertical
        textStack.spacing = 6
        textStack.alignment = .leading

        heroBubbleLabel.translatesAutoresizingMaskIntoConstraints = false
        heroBubbleLabel.font = .systemFont(ofSize: 17, weight: .semibold)
        heroBubbleLabel.textColor = labPrimaryTextColor()
        heroBubbleLabel.numberOfLines = 0
        heroBubbleLabel.text = copy.freeRide.subtitle

        textStack.addArrangedSubview(heroBubbleLabel)
        stack.addArrangedSubview(textStack)
        stack.addArrangedSubview(mascotCard)
    }

    private func buildPhraseCard() {
        phraseCard.translatesAutoresizingMaskIntoConstraints = false
        phraseCard.backgroundColor = .white
        phraseCard.layer.cornerRadius = 20
        phraseCard.layer.borderWidth = 1
        phraseCard.layer.borderColor = labSurfaceBorderColor().cgColor
        phraseCard.layer.shadowColor = labSurfaceShadowColor().cgColor
        phraseCard.layer.shadowOpacity = 1
        phraseCard.layer.shadowRadius = 12
        phraseCard.layer.shadowOffset = CGSize(width: 0, height: 6)

        let stack = UIStackView()
        stack.translatesAutoresizingMaskIntoConstraints = false
        stack.axis = .vertical
        stack.spacing = 14
        phraseCard.addSubview(stack)
        labPin(stack, to: phraseCard, insets: UIEdgeInsets(top: 18, left: 14, bottom: 18, right: 14))

        let inputStack = UIStackView()
        inputStack.translatesAutoresizingMaskIntoConstraints = false
        inputStack.axis = .vertical
        inputStack.spacing = 8

        let inputLabel = UILabel()
        inputLabel.font = .systemFont(ofSize: 12, weight: .bold)
        inputLabel.textColor = labSecondaryTextColor()
        inputLabel.text = copy.freeRide.inputLabel

        let inputContainer = UIView()
        inputContainer.translatesAutoresizingMaskIntoConstraints = false
        inputContainer.backgroundColor = .white
        inputContainer.layer.cornerRadius = 14
        inputContainer.layer.cornerCurve = .continuous
        inputContainer.layer.borderWidth = 1
        inputContainer.layer.borderColor = labSurfaceBorderColor().cgColor

        phraseTextView.translatesAutoresizingMaskIntoConstraints = false
        phraseTextView.backgroundColor = .clear
        phraseTextView.font = .systemFont(ofSize: 16, weight: .medium)
        phraseTextView.textColor = labPrimaryTextColor()
        phraseTextView.textContainerInset = UIEdgeInsets(top: 10, left: 2, bottom: 10, right: 2)
        phraseTextView.textContainer.lineFragmentPadding = 0
        phraseTextView.isScrollEnabled = false
        phraseTextView.delegate = self
        phraseTextView.autocorrectionType = .yes
        phraseTextView.autocapitalizationType = .sentences
        phraseTextView.returnKeyType = .default

        phrasePlaceholderLabel.translatesAutoresizingMaskIntoConstraints = false
        phrasePlaceholderLabel.font = .systemFont(ofSize: 16, weight: .medium)
        phrasePlaceholderLabel.textColor = labSecondaryTextColor().withAlphaComponent(0.72)
        phrasePlaceholderLabel.numberOfLines = 0
        phrasePlaceholderLabel.text = copy.freeRide.inputPlaceholder

        inputContainer.addSubview(phraseTextView)
        inputContainer.addSubview(phrasePlaceholderLabel)
        NSLayoutConstraint.activate([
            phraseTextView.topAnchor.constraint(equalTo: inputContainer.topAnchor),
            phraseTextView.leadingAnchor.constraint(equalTo: inputContainer.leadingAnchor, constant: 14),
            phraseTextView.trailingAnchor.constraint(equalTo: inputContainer.trailingAnchor, constant: -14),
            phraseTextView.bottomAnchor.constraint(equalTo: inputContainer.bottomAnchor),

            phrasePlaceholderLabel.topAnchor.constraint(equalTo: inputContainer.topAnchor, constant: 14),
            phrasePlaceholderLabel.leadingAnchor.constraint(equalTo: inputContainer.leadingAnchor, constant: 18),
            phrasePlaceholderLabel.trailingAnchor.constraint(equalTo: inputContainer.trailingAnchor, constant: -18)
        ])
        phraseTextViewHeightConstraint = phraseTextView.heightAnchor.constraint(equalToConstant: 94)
        phraseTextViewHeightConstraint?.isActive = true

        let inputActionsRow = UIStackView()
        inputActionsRow.translatesAutoresizingMaskIntoConstraints = false
        inputActionsRow.axis = .horizontal
        inputActionsRow.spacing = 8
        inputActionsRow.distribution = .fillProportionally

        labConfigureMiniButton(savePhraseButton, title: copy.freeRide.savePhrase, filled: true, tint: theme.tint)
        savePhraseButton.addTarget(self, action: #selector(handleSavePhrase), for: .touchUpInside)
        savePhraseButton.setContentHuggingPriority(.required, for: .horizontal)

        labConfigureMiniButton(myPhrasesButton, title: copy.freeRide.myPhrases, filled: false, tint: theme.tint)
        myPhrasesButton.addTarget(self, action: #selector(handleOpenSavedPhrases), for: .touchUpInside)
        myPhrasesButton.setContentHuggingPriority(.required, for: .horizontal)

        inputActionsRow.addArrangedSubview(savePhraseButton)
        inputActionsRow.addArrangedSubview(myPhrasesButton)
        let inputActionsSpacer = UIView()
        inputActionsSpacer.translatesAutoresizingMaskIntoConstraints = false
        inputActionsRow.addArrangedSubview(inputActionsSpacer)

        inputStack.addArrangedSubview(inputLabel)
        inputStack.addArrangedSubview(inputContainer)
        inputStack.addArrangedSubview(inputActionsRow)

        targetContainer.translatesAutoresizingMaskIntoConstraints = false
        targetContainer.backgroundColor = .clear

        let targetStack = UIStackView()
        targetStack.translatesAutoresizingMaskIntoConstraints = false
        targetStack.axis = .horizontal
        targetStack.spacing = 10
        targetStack.alignment = .top
        targetContainer.addSubview(targetStack)
        labPin(targetStack, to: targetContainer, insets: .zero)

        targetLabel.translatesAutoresizingMaskIntoConstraints = false
        targetLabel.numberOfLines = 0
        targetLabel.font = .systemFont(ofSize: 22, weight: .semibold)
        targetLabel.textColor = labPrimaryTextColor()

        playPhraseButton.translatesAutoresizingMaskIntoConstraints = false
        playPhraseButton.tintColor = theme.tint
        playPhraseButton.backgroundColor = .white
        playPhraseButton.layer.cornerRadius = 20
        playPhraseButton.layer.cornerCurve = .continuous
        playPhraseButton.layer.borderWidth = 1
        playPhraseButton.layer.borderColor = theme.tint.withAlphaComponent(0.18).cgColor
        playPhraseButton.layer.shadowColor = theme.tint.withAlphaComponent(0.16).cgColor
        playPhraseButton.layer.shadowOpacity = 1
        playPhraseButton.layer.shadowRadius = 8
        playPhraseButton.layer.shadowOffset = CGSize(width: 0, height: 4)
        playPhraseButton.setImage(UIImage(systemName: "speaker.wave.2.fill"), for: .normal)
        playPhraseButton.addTarget(self, action: #selector(handlePlayPhrase), for: .touchUpInside)
        NSLayoutConstraint.activate([
            playPhraseButton.widthAnchor.constraint(equalToConstant: 46),
            playPhraseButton.heightAnchor.constraint(equalToConstant: 46)
        ])
        playPhraseButton.setContentCompressionResistancePriority(.required, for: .horizontal)

        targetStack.addArrangedSubview(targetLabel)
        targetStack.addArrangedSubview(playPhraseButton)

        scoreLineView.translatesAutoresizingMaskIntoConstraints = false
        scoreLineView.layer.cornerRadius = 18
        scoreLineView.layer.cornerCurve = .continuous
        scoreLineView.layer.borderWidth = 1

        let scoreStack = UIStackView()
        scoreStack.translatesAutoresizingMaskIntoConstraints = false
        scoreStack.axis = .horizontal
        scoreStack.spacing = 12
        scoreStack.alignment = .center
        scoreLineView.addSubview(scoreStack)
        labPin(scoreStack, to: scoreLineView, insets: UIEdgeInsets(top: 14, left: 14, bottom: 14, right: 14))

        scoreValueLabel.translatesAutoresizingMaskIntoConstraints = false
        scoreValueLabel.font = .monospacedDigitSystemFont(ofSize: 18, weight: .bold)
        scoreValueLabel.textColor = theme.tint
        scoreValueLabel.setContentHuggingPriority(.required, for: .horizontal)

        scoreTextLabel.translatesAutoresizingMaskIntoConstraints = false
        scoreTextLabel.font = .systemFont(ofSize: 14, weight: .semibold)
        scoreTextLabel.numberOfLines = 0
        scoreTextLabel.textColor = labPrimaryTextColor()

        scoreStack.addArrangedSubview(scoreValueLabel)
        scoreStack.addArrangedSubview(scoreTextLabel)

        advancedSummaryLabel.translatesAutoresizingMaskIntoConstraints = false
        advancedSummaryLabel.font = .systemFont(ofSize: 12, weight: .bold)
        advancedSummaryLabel.textColor = theme.tint
        advancedSummaryLabel.backgroundColor = .clear
        advancedSummaryLabel.contentInsets = .zero
        advancedSummaryLabel.numberOfLines = 0
        advancedSummaryLabel.textAlignment = .center
        advancedSummaryLabel.isHidden = true

        advancedWordsScrollView.translatesAutoresizingMaskIntoConstraints = false
        advancedWordsScrollView.showsHorizontalScrollIndicator = false
        advancedWordsScrollView.alwaysBounceHorizontal = true
        advancedWordsScrollView.isHidden = true
        NSLayoutConstraint.activate([
            advancedWordsScrollView.heightAnchor.constraint(equalToConstant: 38)
        ])

        advancedWordsStack.translatesAutoresizingMaskIntoConstraints = false
        advancedWordsStack.axis = .horizontal
        advancedWordsStack.spacing = 8
        advancedWordsStack.alignment = .fill
        advancedWordsScrollView.addSubview(advancedWordsStack)
        NSLayoutConstraint.activate([
            advancedWordsStack.topAnchor.constraint(equalTo: advancedWordsScrollView.contentLayoutGuide.topAnchor),
            advancedWordsStack.leadingAnchor.constraint(equalTo: advancedWordsScrollView.contentLayoutGuide.leadingAnchor),
            advancedWordsStack.trailingAnchor.constraint(equalTo: advancedWordsScrollView.contentLayoutGuide.trailingAnchor),
            advancedWordsStack.bottomAnchor.constraint(equalTo: advancedWordsScrollView.contentLayoutGuide.bottomAnchor),
            advancedWordsStack.heightAnchor.constraint(equalTo: advancedWordsScrollView.frameLayoutGuide.heightAnchor)
        ])

        advancedWordDetailView.translatesAutoresizingMaskIntoConstraints = false
        advancedWordDetailView.backgroundColor = UIColor.systemOrange.withAlphaComponent(0.08)
        advancedWordDetailView.layer.cornerRadius = 14
        advancedWordDetailView.layer.cornerCurve = .continuous
        advancedWordDetailView.layer.borderWidth = 1
        advancedWordDetailView.layer.borderColor = UIColor.separator.withAlphaComponent(0.16).cgColor
        advancedWordDetailView.isHidden = true

        let advancedWordDetailStack = UIStackView()
        advancedWordDetailStack.translatesAutoresizingMaskIntoConstraints = false
        advancedWordDetailStack.axis = .vertical
        advancedWordDetailStack.spacing = 10
        advancedWordDetailView.addSubview(advancedWordDetailStack)
        labPin(
            advancedWordDetailStack,
            to: advancedWordDetailView,
            insets: UIEdgeInsets(top: 10, left: 12, bottom: 10, right: 12)
        )

        advancedWordDetailLabel.translatesAutoresizingMaskIntoConstraints = false
        advancedWordDetailLabel.numberOfLines = 0
        advancedWordDetailLabel.font = .systemFont(ofSize: 12.5, weight: .semibold)
        advancedWordDetailLabel.textColor = labSecondaryTextColor()
        advancedWordDetailLabel.textAlignment = .center
        advancedWordDetailStack.addArrangedSubview(advancedWordDetailLabel)

        advancedPhonemesScrollView.translatesAutoresizingMaskIntoConstraints = false
        advancedPhonemesScrollView.showsHorizontalScrollIndicator = false
        advancedPhonemesScrollView.alwaysBounceHorizontal = true
        advancedPhonemesScrollView.isHidden = true
        NSLayoutConstraint.activate([
            advancedPhonemesScrollView.heightAnchor.constraint(equalToConstant: 34)
        ])

        advancedPhonemesStack.translatesAutoresizingMaskIntoConstraints = false
        advancedPhonemesStack.axis = .horizontal
        advancedPhonemesStack.spacing = 8
        advancedPhonemesStack.alignment = .fill
        advancedPhonemesScrollView.addSubview(advancedPhonemesStack)
        NSLayoutConstraint.activate([
            advancedPhonemesStack.topAnchor.constraint(equalTo: advancedPhonemesScrollView.contentLayoutGuide.topAnchor),
            advancedPhonemesStack.leadingAnchor.constraint(equalTo: advancedPhonemesScrollView.contentLayoutGuide.leadingAnchor),
            advancedPhonemesStack.trailingAnchor.constraint(equalTo: advancedPhonemesScrollView.contentLayoutGuide.trailingAnchor),
            advancedPhonemesStack.bottomAnchor.constraint(equalTo: advancedPhonemesScrollView.contentLayoutGuide.bottomAnchor),
            advancedPhonemesStack.heightAnchor.constraint(equalTo: advancedPhonemesScrollView.frameLayoutGuide.heightAnchor)
        ])
        advancedWordDetailStack.addArrangedSubview(advancedPhonemesScrollView)

        transcriptContainer.translatesAutoresizingMaskIntoConstraints = false
        transcriptContainer.backgroundColor = .clear

        transcriptLabel.translatesAutoresizingMaskIntoConstraints = false
        transcriptLabel.numberOfLines = 0
        transcriptLabel.font = .systemFont(ofSize: 13, weight: .semibold)
        transcriptLabel.textColor = labSecondaryTextColor()
        transcriptLabel.textAlignment = .center
        transcriptContainer.addSubview(transcriptLabel)
        labPin(transcriptLabel, to: transcriptContainer, insets: UIEdgeInsets(top: 2, left: 6, bottom: 2, right: 6))

        actionsRow.translatesAutoresizingMaskIntoConstraints = false
        actionsRow.axis = .horizontal
        actionsRow.spacing = 10
        actionsRow.distribution = .fillEqually

        labConfigureActionButton(recordButton, title: copy.freeRide.sayLabel, iconName: "mic.fill", tint: theme.tint, filled: true)
        recordButton.addTarget(self, action: #selector(handleRecordTapped), for: .touchUpInside)

        labConfigureActionButton(voiceButton, title: copy.freeRide.yourVoiceLabel, iconName: "waveform", tint: theme.tint, filled: false)
        voiceButton.addTarget(self, action: #selector(handlePlayRecording), for: .touchUpInside)

        actionsRow.addArrangedSubview(recordButton)
        actionsRow.addArrangedSubview(voiceButton)

        stack.addArrangedSubview(inputStack)
        stack.addArrangedSubview(targetContainer)
        stack.addArrangedSubview(scoreLineView)
        stack.addArrangedSubview(advancedSummaryLabel)
        stack.addArrangedSubview(advancedWordsScrollView)
        stack.addArrangedSubview(advancedWordDetailView)
        stack.addArrangedSubview(transcriptContainer)
        stack.addArrangedSubview(actionsRow)
    }

    private func installGestures() {
        let heroTap = UITapGestureRecognizer(target: self, action: #selector(handlePlayPhrase))
        heroCard.addGestureRecognizer(heroTap)

        [scoreLineView, transcriptContainer, advancedSummaryLabel].forEach { view in
            let gesture = UITapGestureRecognizer(target: self, action: #selector(handleOpenDetails))
            view.addGestureRecognizer(gesture)
            view.isUserInteractionEnabled = true
        }
    }

    private func installKeyboardObservers() {
        let center = NotificationCenter.default
        let willChange = center.addObserver(
            forName: UIResponder.keyboardWillChangeFrameNotification,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            self?.handleKeyboard(notification)
        }
        let willHide = center.addObserver(
            forName: UIResponder.keyboardWillHideNotification,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            self?.handleKeyboard(notification)
        }
        keyboardObservers = [willChange, willHide]
    }

    private func handleKeyboard(_ notification: Notification) {
        guard
            let userInfo = notification.userInfo,
            let frameValue = userInfo[UIResponder.keyboardFrameEndUserInfoKey] as? NSValue
        else {
            return
        }

        let keyboardFrame = view.convert(frameValue.cgRectValue, from: nil)
        let intersection = view.bounds.intersection(keyboardFrame)
        let bottomInset = max(0, intersection.height - view.safeAreaInsets.bottom) + 18
        scrollView.contentInset.bottom = bottomInset
        scrollView.verticalScrollIndicatorInsets.bottom = bottomInset

        guard phraseTextView.isFirstResponder else { return }
        let visibleRect = phraseTextView.convert(phraseTextView.bounds, to: scrollView)
        scrollView.scrollRectToVisible(visibleRect.insetBy(dx: 0, dy: -40), animated: true)
    }

    @objc private func handleSavePhrase() {
        let result = phraseStore.savePhrase(
            expectedText,
            ownerKey: savedPhrasesOwnerKey,
            localeCode: practiceLocaleCode
        )
        guard let result else { return }
        let message = result.updated ? copy.freeRide.savedPhraseUpdatedToast : copy.freeRide.savedPhraseSavedToast
        showToast(message)
    }

    @objc private func handleOpenSavedPhrases() {
        guard !isRecording, !isTranscribing else { return }
        let controller = LabSavedPhrasesViewController(
            copy: copy,
            phrases: phraseStore.savedPhrases(ownerKey: savedPhrasesOwnerKey, localeCode: practiceLocaleCode)
        )
        controller.onSelectPhrase = { [weak self] phrase in
            guard let self else { return }
            self.expectedText = phrase.text
            self.phraseTextView.text = phrase.text
            self.phraseStore.persistPhrase(phrase.text, locale: self.session.locale)
            self.phraseStore.markPhraseUsed(phrase.id, ownerKey: self.savedPhrasesOwnerKey)
            self.resetPracticeResult(clearRecording: true)
            self.updateUI(animated: false)
            self.showToast(self.copy.freeRide.savedPhraseLoadedToast)
        }
        controller.onDeletePhrase = { [weak self] phrase in
            guard let self else { return }
            self.phraseStore.deletePhrase(phrase.id, ownerKey: self.savedPhrasesOwnerKey)
            self.showToast(self.copy.freeRide.savedPhraseDeletedToast)
        }
        presentLabSheet(controller, from: self)
    }

    @objc private func handleOpenDetails() {
        let controller = LabDetailsViewController(
            copy: copy,
            expectedText: expectedText.trimmingCharacters(in: .whitespacesAndNewlines),
            transcriptText: transcriptText.trimmingCharacters(in: .whitespacesAndNewlines),
            scorePercent: scorePercent,
            advancedAssessment: advancedAssessment,
            recordingURL: recordingURL,
            selectedWordIndex: selectedAdvancedWordIndex
        )
        presentLabSheet(controller, from: self)
    }

    @objc private func handlePlayPhrase() {
        let trimmed = expectedText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        if activePlaybackSource == .phrase {
            stopPlayback()
            return
        }

        stopPlayback()
        Task { [weak self] in
            await self?.playPhraseAudio(text: trimmed)
        }
    }

    @objc private func handlePlayRecording() {
        guard let recordingURL else { return }

        if activePlaybackSource == .recording {
            stopPlayback()
            return
        }

        stopPlayback()
        do {
            try configureAudioSessionForPlayback()
            let player = try AVAudioPlayer(contentsOf: recordingURL)
            player.delegate = self
            audioPlayer = player
            activePlaybackSource = .recording
            syncAdvancedPhonemeProgress()
            startPlaybackFeedbackTimer()
            updateUI(animated: true)
            player.play()
            startMascotPulse()
            NativeDebugLogStore.shared.add("[Lab] play recording start")
        } catch {
            NativeDebugLogStore.shared.add("[Lab] play recording failed \(error.localizedDescription)")
            activePlaybackSource = nil
            updateUI(animated: false)
        }
    }

    @objc private func handleAdvancedWordTapped(_ sender: UIButton) {
        selectedAdvancedWordIndex = sender.tag
        updateUI(animated: true)
    }

    @objc private func handleRecordTapped() {
        if isRecording {
            stopRecording()
        } else {
            Task { [weak self] in
                await self?.startRecording()
            }
        }
    }

    private func startRecording() async {
        guard !isRecording, !isTranscribing else { return }
        let trimmed = expectedText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        stopPlayback()
        view.endEditing(true)

        let microphoneGranted = await requestMicrophonePermission()
        guard microphoneGranted else {
            applyResult(tone: .warn, message: "Microphone access is required.")
            presentPermissionAlert(message: "Enable microphone access in iOS Settings to record your pronunciation.")
            return
        }

        let speechStatus = await requestSpeechPermission()
        guard speechStatus == .authorized else {
            applyResult(tone: .warn, message: "Speech recognition is required.")
            presentPermissionAlert(message: "Enable Speech Recognition in iOS Settings to transcribe your practice.")
            return
        }

        do {
            try configureAudioSessionForRecording()
            let url = FileManager.default.temporaryDirectory.appendingPathComponent("lab-\(UUID().uuidString).wav")
            let recorder = try AVAudioRecorder(url: url, settings: [
                AVFormatIDKey: Int(kAudioFormatLinearPCM),
                AVSampleRateKey: 16_000,
                AVNumberOfChannelsKey: 1,
                AVLinearPCMBitDepthKey: 16,
                AVLinearPCMIsBigEndianKey: false,
                AVLinearPCMIsFloatKey: false
            ])
            recorder.delegate = self
            recorder.isMeteringEnabled = true
            recorder.record()

            recordingURL = nil
            transcriptText = ""
            scorePercent = nil
            advancedAssessment = nil
            isAdvancedAssessmentPending = false
            audioRecorder = recorder
            isRecording = true
            applyResult(tone: .hint, message: copy.freeRide.endLabel)
            NativeDebugLogStore.shared.add("[Lab] record start")
            updateUI(animated: true)
            startMascotPulse()
        } catch {
            applyResult(tone: .warn, message: "Recording failed.")
            NativeDebugLogStore.shared.add("[Lab] record start failed \(error.localizedDescription)")
            updateUI(animated: false)
        }
    }

    private func stopRecording() {
        guard let recorder = audioRecorder else { return }
        if recorder.isRecording {
            recorder.stop()
        } else {
            audioRecorderDidFinishRecording(recorder, successfully: false)
        }
    }

    private func transcribeRecording(at url: URL) {
        let expected = expectedText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !expected.isEmpty else { return }

        recognitionRequestToken = UUID()
        let token = recognitionRequestToken
        isTranscribing = true
        applyResult(tone: .hint, message: copy.freeRide.transcribing)
        updateUI(animated: true)
        NativeDebugLogStore.shared.add("[Lab] transcribe start")

        Task { [weak self] in
            guard let self else { return }
            let transcript = (try? await self.recognizeSpeech(at: url)) ?? ""
            guard token == self.recognitionRequestToken else { return }

            let normalizedTranscript = transcript.trimmingCharacters(in: .whitespacesAndNewlines)
            await MainActor.run {
                self.transcriptText = normalizedTranscript
                self.scorePercent = self.scoreSimilarity(expected: expected, actual: normalizedTranscript)
                self.isTranscribing = false
                self.applyScoredFeedback()
                self.updateUI(animated: true)
                NativeDebugLogStore.shared.add("[Lab] transcribe result \(normalizedTranscript)")
            }
            await self.runAdvancedAssessmentIfPossible(recordingURL: url, expectedText: expected, token: token)
        }
    }

    private func recognizeSpeech(at url: URL) async throws -> String {
        guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: practiceLocaleCode)) else {
            return ""
        }

        recognitionTask?.cancel()
        let request = SFSpeechURLRecognitionRequest(url: url)
        request.shouldReportPartialResults = false

        return try await withCheckedThrowingContinuation { continuation in
            var didResume = false
            recognitionTask = recognizer.recognitionTask(with: request) { [weak self] result, error in
                guard !didResume else { return }
                if let result, result.isFinal {
                    didResume = true
                    self?.recognitionTask = nil
                    continuation.resume(returning: result.bestTranscription.formattedString)
                    return
                }
                if let error {
                    didResume = true
                    self?.recognitionTask = nil
                    continuation.resume(throwing: error)
                }
            }
        }
    }

    private func runAdvancedAssessmentIfPossible(recordingURL: URL, expectedText: String, token: UUID) async {
        guard !expectedText.isEmpty else { return }

        await MainActor.run {
            self.isAdvancedAssessmentPending = true
            self.updateUI(animated: true)
        }

        do {
            let assessment = try await assessmentClient.assess(
                recordingURL: recordingURL,
                expectedText: expectedText,
                localeCode: practiceLocaleCode,
                user: user
            )
            await MainActor.run {
                guard token == self.recognitionRequestToken else { return }
                self.isAdvancedAssessmentPending = false
                self.advancedAssessment = assessment
                self.selectedAdvancedWordIndex = self.defaultAdvancedWordSelectionIndex(for: assessment)
                self.updateUI(animated: true)
                if let assessment {
                    NativeDebugLogStore.shared.add("[Lab] assessment \(assessment.summaryText)")
                }
            }
        } catch {
            await MainActor.run {
                guard token == self.recognitionRequestToken else { return }
                self.isAdvancedAssessmentPending = false
                self.advancedAssessment = nil
                self.selectedAdvancedWordIndex = nil
                self.updateUI(animated: true)
                NativeDebugLogStore.shared.add("[Lab] assessment failed \(error.localizedDescription)")
            }
        }
    }

    private func playPhraseAudio(text: String) async {
        do {
            try configureAudioSessionForPlayback()
            let data = try await ttsClient.fetchAudioData(text: text, localeCode: practiceLocaleCode, user: user)
            try playAudioData(data, source: .phrase, phraseText: text)
            NativeDebugLogStore.shared.add("[Lab] play phrase remote")
        } catch {
            NativeDebugLogStore.shared.add("[Lab] play phrase fallback \(error.localizedDescription)")
            await MainActor.run {
                self.playLocalSpeech(text: text)
            }
        }
    }

    private func playAudioData(_ data: Data, source: LabPlaybackSource, phraseText: String? = nil) throws {
        let player = try AVAudioPlayer(data: data)
        player.delegate = self
        audioPlayer = player
        activePlaybackSource = source
        if source == .phrase, let phraseText {
            preparePhrasePlaybackProgress(text: phraseText, duration: player.duration)
            syncPlaybackWordProgress()
        }
        startPlaybackFeedbackTimer()
        updateUI(animated: true)
        player.play()
        startMascotPulse()
    }

    private func playLocalSpeech(text: String) {
        activePlaybackSource = .phrase
        preparePhraseSpeechProgress(text: text)
        updateUI(animated: true)
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = AVSpeechSynthesisVoice(language: practiceLocaleCode)
        utterance.rate = 0.47
        speechSynthesizer.speak(utterance)
        startMascotPulse()
    }

    private func stopPlayback() {
        playbackWordTimer?.invalidate()
        playbackWordTimer = nil
        playbackWordSegments = []
        activePlaybackWordIndex = nil
        activeAdvancedPhonemes = []
        resetAdvancedPhonemePlaybackState()
        audioPlayer?.stop()
        audioPlayer = nil
        if speechSynthesizer.isSpeaking {
            speechSynthesizer.stopSpeaking(at: .immediate)
        }
        activePlaybackSource = nil
        stopMascotPulse()
        updateUI(animated: true)
    }

    private func configureAudioSessionForRecording() throws {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker, .allowBluetoothHFP])
        try session.setActive(true)
    }

    private func configureAudioSessionForPlayback() throws {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playback, mode: .spokenAudio, options: [.duckOthers])
        try session.setActive(true)
    }

    private func requestMicrophonePermission() async -> Bool {
        await withCheckedContinuation { continuation in
            AVAudioSession.sharedInstance().requestRecordPermission { granted in
                continuation.resume(returning: granted)
            }
        }
    }

    private func requestSpeechPermission() async -> SFSpeechRecognizerAuthorizationStatus {
        await withCheckedContinuation { continuation in
            SFSpeechRecognizer.requestAuthorization { status in
                continuation.resume(returning: status)
            }
        }
    }

    private func applyScoredFeedback() {
        guard let scorePercent else {
            applyResult(tone: .hint, message: copy.freeRide.feedbackHint)
            return
        }

        switch scorePercent {
        case 85...100:
            applyResult(tone: .good, message: copy.freeRide.feedbackNative)
        case 70...84:
            applyResult(tone: .good, message: copy.freeRide.feedbackGood)
        case 60...69:
            applyResult(tone: .okay, message: copy.freeRide.feedbackAlmost)
        default:
            applyResult(tone: .bad, message: copy.freeRide.feedbackKeep)
        }
    }

    private func applyResult(tone: ResultTone, message: String) {
        activeResultTone = tone
        resultMessage = message
    }

    private func resetPracticeResult(clearRecording: Bool) {
        transcriptText = ""
        scorePercent = nil
        advancedAssessment = nil
        isAdvancedAssessmentPending = false
        selectedAdvancedWordIndex = nil
        recognitionTask?.cancel()
        recognitionTask = nil
        recognitionRequestToken = UUID()
        applyResult(tone: .hint, message: copy.freeRide.feedbackHint)

        if clearRecording {
            recordingURL = nil
        }
    }

    private func updateUI(animated: Bool) {
        titleLabel.text = copy.freeRide.title
        heroBubbleLabel.text = copy.freeRide.subtitle

        phrasePlaceholderLabel.isHidden = !expectedText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || phraseTextView.isFirstResponder
        if phraseTextView.text != expectedText {
            phraseTextView.text = expectedText
        }
        updateTextViewHeight()

        let hasPhrase = !expectedText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        let controlsDisabled = isRecording || isTranscribing

        savePhraseButton.isEnabled = hasPhrase && !controlsDisabled
        myPhrasesButton.isEnabled = !controlsDisabled
        playPhraseButton.isEnabled = hasPhrase && !controlsDisabled
        voiceButton.isEnabled = recordingURL != nil && !controlsDisabled
        phraseTextView.isEditable = !controlsDisabled

        let currentRecordTitle = isRecording ? copy.freeRide.endLabel : copy.freeRide.sayLabel
        labUpdateActionButton(
            recordButton,
            title: currentRecordTitle,
            iconName: isRecording ? "stop.fill" : "mic.fill",
            tint: theme.tint,
            filled: true,
            emphasized: isRecording
        )
        labUpdateActionButton(
            voiceButton,
            title: copy.freeRide.yourVoiceLabel,
            iconName: activePlaybackSource == .recording ? "stop.fill" : "waveform",
            tint: labToneColor(for: scoreTone()),
            filled: false,
            emphasized: activePlaybackSource == .recording
        )
        playPhraseButton.setImage(
            UIImage(systemName: activePlaybackSource == .phrase ? "stop.fill" : "speaker.wave.2.fill"),
            for: .normal
        )
        playPhraseButton.backgroundColor = activePlaybackSource == .phrase ? theme.tint : .white
        playPhraseButton.tintColor = activePlaybackSource == .phrase ? .white : theme.tint

        let targetText = expectedText.trimmingCharacters(in: .whitespacesAndNewlines)
        if targetText.isEmpty {
            targetLabel.attributedText = nil
            targetLabel.text = copy.freeRide.emptyPhrase
            targetLabel.textColor = .secondaryLabel
        } else {
            targetLabel.attributedText = makeTargetAttributedText(for: targetText)
            targetLabel.textColor = .label
        }

        updateScoreLine()
        updateTranscriptLine()
        updateAdvancedSummary()
        updateAdvancedWordFeedback()

        if animated {
            UIView.animate(withDuration: 0.20) {
                self.view.layoutIfNeeded()
            }
        }
    }

    private func updateScoreLine() {
        let toneColor = labToneColor(for: activeResultTone)
        scoreLineView.backgroundColor = toneColor.withAlphaComponent(activeResultTone == .hint ? 0.08 : 0.12)
        scoreLineView.layer.borderColor = toneColor.withAlphaComponent(activeResultTone == .hint ? 0.10 : 0.20).cgColor
        scoreValueLabel.textColor = toneColor
        scoreTextLabel.textColor = activeResultTone == .hint ? labSecondaryTextColor() : toneColor

        if let scorePercent {
            scoreValueLabel.text = "\(scorePercent)%"
        } else {
            scoreValueLabel.text = ""
        }
        scoreTextLabel.text = resultMessage
    }

    private func updateTranscriptLine() {
        let transcript = transcriptText.trimmingCharacters(in: .whitespacesAndNewlines)
        let expected = expectedText.trimmingCharacters(in: .whitespacesAndNewlines)

        if transcript.isEmpty {
            transcriptLabel.attributedText = nil
            transcriptLabel.text = copy.freeRide.transcript
            transcriptLabel.textColor = .secondaryLabel
            return
        }

        if expected.isEmpty {
            transcriptLabel.attributedText = nil
            transcriptLabel.text = transcript
            transcriptLabel.textColor = .label
            return
        }

        transcriptLabel.attributedText = makeDiffAttributedText(
            text: transcript,
            against: expected,
            compareExpectedTokens: false
        )
    }

    private func updateAdvancedSummary() {
        if isAdvancedAssessmentPending {
            advancedSummaryLabel.isHidden = false
            advancedSummaryLabel.backgroundColor = .clear
            advancedSummaryLabel.textColor = theme.tint
            advancedSummaryLabel.text = "\(copy.freeRide.advanced) · \(copy.freeRide.evaluatingPronunciation)"
            return
        }

        guard let advancedAssessment else {
            advancedSummaryLabel.isHidden = true
            advancedSummaryLabel.text = nil
            return
        }

        advancedSummaryLabel.isHidden = false
        if advancedAssessment.ok {
            advancedSummaryLabel.backgroundColor = .clear
            advancedSummaryLabel.textColor = UIColor.systemGreen.withAlphaComponent(0.90)
        } else {
            advancedSummaryLabel.backgroundColor = .clear
            advancedSummaryLabel.textColor = UIColor.systemOrange.withAlphaComponent(0.90)
        }
        advancedSummaryLabel.text = "\(copy.freeRide.advanced) · \(advancedAssessment.summaryText)"
    }

    private func updateAdvancedWordFeedback() {
        while let view = advancedWordsStack.arrangedSubviews.first {
            advancedWordsStack.removeArrangedSubview(view)
            view.removeFromSuperview()
        }

        guard let assessment = advancedAssessment, assessment.ok, !assessment.words.isEmpty else {
            advancedWordsScrollView.isHidden = true
            advancedWordDetailView.isHidden = true
            advancedWordDetailLabel.text = nil
            activeAdvancedPhonemes = []
            resetAdvancedPhonemePlaybackState()
            advancedPhonemesScrollView.isHidden = true
            return
        }

        advancedWordsScrollView.isHidden = false
        let selectedIndex = selectedAdvancedWordIndex ?? defaultAdvancedWordSelectionIndex(for: assessment)
        if selectedAdvancedWordIndex == nil {
            selectedAdvancedWordIndex = selectedIndex
        }

        for (index, word) in assessment.words.enumerated() {
            let button = labMakeAdvancedWordChip(
                title: word.expected.isEmpty ? "—" : word.expected,
                tint: labAdvancedToneColor(for: word.status),
                selected: selectedIndex == index,
                playing: activePlaybackSource == .phrase && activePlaybackWordIndex == index
            )
            button.tag = index
            button.addTarget(self, action: #selector(handleAdvancedWordTapped(_:)), for: .touchUpInside)
            advancedWordsStack.addArrangedSubview(button)
        }

        guard
            let selectedIndex,
            assessment.words.indices.contains(selectedIndex)
        else {
            advancedWordDetailView.isHidden = true
            advancedWordDetailLabel.text = nil
            return
        }

        let word = assessment.words[selectedIndex]
        advancedWordDetailView.isHidden = false
        let detailTint = labAdvancedToneColor(for: word.status)
        advancedWordDetailView.backgroundColor = detailTint.withAlphaComponent(0.08)
        advancedWordDetailView.layer.borderColor = detailTint.withAlphaComponent(0.16).cgColor
        advancedWordDetailLabel.attributedText = makeAdvancedWordDetailText(for: word)
        updateAdvancedPhonemeFeedback(for: word)
    }

    private func defaultAdvancedWordSelectionIndex(for assessment: LabAdvancedAssessment?) -> Int? {
        guard let assessment, !assessment.words.isEmpty else { return nil }
        if let index = assessment.words.firstIndex(where: { status in
            status.status == .wrong || status.status == .missing || status.status == .issue
        }) {
            return index
        }
        return assessment.words.indices.first
    }

    private func updateTextViewHeight() {
        let fitting = CGSize(width: phraseTextView.bounds.width, height: .greatestFiniteMagnitude)
        let height = phraseTextView.sizeThatFits(fitting).height
        phraseTextViewHeightConstraint?.constant = max(94, min(180, height))
    }

    private func makeTargetAttributedText(for text: String) -> NSAttributedString {
        let displayTokens = labTokenizeWords(text)
        let transcriptTokens = labTokenizeWords(transcriptText)
        let matched = labMatchedTokenIndexes(lhs: displayTokens.map(\.normalized), rhs: transcriptTokens.map(\.normalized))
        let advancedStatuses = advancedExpectedStatuses(for: displayTokens.count)

        let attributed = NSMutableAttributedString()
        for (index, token) in displayTokens.enumerated() {
            let status = advancedStatuses?[safe: index] ?? .unknown
            let isMatched = matched.lhs.contains(index)
            let isPlaying = activePlaybackSource == .phrase && activePlaybackWordIndex == index
            attributed.append(
                NSAttributedString(
                    string: token.original,
                    attributes: targetTokenAttributes(
                        status: advancedStatuses == nil ? nil : status,
                        isMatched: advancedStatuses == nil ? isMatched : nil,
                        isPlaying: isPlaying
                    )
                )
            )
            if index < displayTokens.count - 1 {
                attributed.append(NSAttributedString(string: " "))
            }
        }
        return attributed
    }

    private func advancedExpectedStatuses(for tokenCount: Int) -> [LabAdvancedWordStatus]? {
        guard let assessment = advancedAssessment, assessment.ok, !assessment.words.isEmpty else {
            return nil
        }

        let expectedWords = assessment.words.filter { $0.status != .extra }
        guard !expectedWords.isEmpty else { return nil }
        return (0 ..< tokenCount).map { index in
            if index < expectedWords.count {
                return expectedWords[index].status
            }
            return .missing
        }
    }

    private func targetTokenAttributes(
        status: LabAdvancedWordStatus?,
        isMatched: Bool?,
        isPlaying: Bool
    ) -> [NSAttributedString.Key: Any] {
        let baseFont = UIFont.systemFont(ofSize: 16, weight: isPlaying ? .bold : .semibold)
        let foregroundColor: UIColor
        let backgroundColor: UIColor

        if isPlaying {
            foregroundColor = .white
            backgroundColor = theme.tint
        } else if let status {
            let tint = labAdvancedToneColor(for: status)
            foregroundColor = tint
            backgroundColor = tint.withAlphaComponent(0.12)
        } else if let isMatched {
            if isMatched {
                foregroundColor = UIColor.systemGreen.withAlphaComponent(0.96)
                backgroundColor = UIColor.systemGreen.withAlphaComponent(0.12)
            } else {
                foregroundColor = UIColor.systemOrange.withAlphaComponent(0.96)
                backgroundColor = UIColor.systemOrange.withAlphaComponent(0.12)
            }
        } else {
            foregroundColor = .label
            backgroundColor = UIColor.clear
        }

        let shadow = NSShadow()
        if isPlaying {
            shadow.shadowColor = theme.tint.withAlphaComponent(0.25)
            shadow.shadowBlurRadius = 10
            shadow.shadowOffset = CGSize(width: 0, height: 4)
        }

        return [
            .font: baseFont,
            .foregroundColor: foregroundColor,
            .backgroundColor: backgroundColor,
            .shadow: shadow
        ]
    }

    private func makeAdvancedWordDetailText(for word: LabAdvancedWord) -> NSAttributedString {
        let expected = word.expected.isEmpty ? "—" : word.expected
        let recognized = word.recognized.isEmpty ? "—" : word.recognized
        let detail = NSMutableAttributedString()
        detail.append(NSAttributedString(
            string: "\(expected) · \(word.status.label)\n",
            attributes: [
                .font: UIFont.systemFont(ofSize: 15, weight: .bold),
                .foregroundColor: UIColor.label
            ]
        ))

        let rows = [
            ("Score", word.score.map { "\($0)%" } ?? "—"),
            ("Recorded", recognized),
            ("Error", labAdvancedErrorDisplayText(word.errorType)),
            ("Duration", word.durationText),
            ("Phonemes", word.phonemeSummary)
        ]

        for (index, row) in rows.enumerated() {
            detail.append(NSAttributedString(
                string: "\(row.0): ",
                attributes: [
                    .font: UIFont.systemFont(ofSize: 13, weight: .bold),
                    .foregroundColor: theme.tint
                ]
            ))
            detail.append(NSAttributedString(
                string: row.1,
                attributes: [
                    .font: UIFont.systemFont(ofSize: 13, weight: .semibold),
                    .foregroundColor: UIColor.secondaryLabel
                ]
            ))
            if index < rows.count - 1 {
                detail.append(NSAttributedString(string: "\n"))
            }
        }

        return detail
    }

    private func updateAdvancedPhonemeFeedback(for word: LabAdvancedWord) {
        while let view = advancedPhonemesStack.arrangedSubviews.first {
            advancedPhonemesStack.removeArrangedSubview(view)
            view.removeFromSuperview()
        }
        advancedPhonemeLabels = []

        let phonemes = labDisplayablePhonemes(for: word)
        activeAdvancedPhonemes = phonemes
        guard !phonemes.isEmpty else {
            advancedPhonemesScrollView.isHidden = true
            return
        }

        advancedPhonemesScrollView.isHidden = false
        for phoneme in phonemes {
            let label = labMakeAdvancedPhonemeChip(
                text: labAdvancedPhonemeDisplayText(phoneme),
                tint: theme.tint
            )
            advancedPhonemeLabels.append(label)
            advancedPhonemesStack.addArrangedSubview(label)
        }

        if activePlaybackSource == .recording {
            syncAdvancedPhonemeProgress()
        } else {
            resetAdvancedPhonemePlaybackState()
        }
    }

    private func resetAdvancedPhonemePlaybackState() {
        for label in advancedPhonemeLabels {
            applyAdvancedPhonemePlaybackState(to: label, tint: theme.tint, isActive: false, isPast: false)
        }
    }

    private func applyAdvancedPhonemePlaybackState(
        to label: PaddingLabel,
        tint: UIColor,
        isActive: Bool,
        isPast: Bool
    ) {
        if isActive {
            label.backgroundColor = tint.withAlphaComponent(0.18)
            label.textColor = labPrimaryTextColor()
            label.layer.borderColor = tint.withAlphaComponent(0.34).cgColor
        } else if isPast {
            label.backgroundColor = tint.withAlphaComponent(0.08)
            label.textColor = tint.withAlphaComponent(0.92)
            label.layer.borderColor = tint.withAlphaComponent(0.16).cgColor
        } else {
            label.backgroundColor = .white
            label.textColor = labSecondaryTextColor()
            label.layer.borderColor = labSurfaceBorderColor().cgColor
        }
    }

    private func preparePhrasePlaybackProgress(text: String, duration: TimeInterval) {
        playbackWordSegments = labTimedWordSegments(for: text, duration: duration)
        activePlaybackWordIndex = playbackWordSegments.first?.wordIndex
    }

    private func preparePhraseSpeechProgress(text: String) {
        playbackWordTimer?.invalidate()
        playbackWordTimer = nil
        playbackWordSegments = labTimedWordSegments(for: text, duration: 0)
        activePlaybackWordIndex = playbackWordSegments.first?.wordIndex
    }

    private func startPlaybackFeedbackTimer() {
        playbackWordTimer?.invalidate()
        guard audioPlayer != nil, activePlaybackSource != nil else { return }
        playbackWordTimer = Timer.scheduledTimer(withTimeInterval: 0.05, repeats: true) { [weak self] _ in
            self?.syncPlaybackFeedbackProgress()
        }
        if let playbackWordTimer {
            RunLoop.main.add(playbackWordTimer, forMode: .common)
        }
    }

    private func syncPlaybackFeedbackProgress() {
        switch activePlaybackSource {
        case .phrase:
            syncPlaybackWordProgress()
        case .recording:
            syncAdvancedPhonemeProgress()
        case nil:
            break
        }
    }

    private func syncPlaybackWordProgress() {
        guard
            activePlaybackSource == .phrase,
            let player = audioPlayer,
            !playbackWordSegments.isEmpty
        else {
            return
        }

        let currentTime = player.currentTime
        let nextIndex = playbackWordSegments.first(where: { segment in
            currentTime >= segment.startTime && currentTime < segment.endTime
        })?.wordIndex ?? playbackWordSegments.last?.wordIndex

        if activePlaybackWordIndex != nextIndex {
            activePlaybackWordIndex = nextIndex
            if let nextIndex {
                revealAdvancedWordChipIfNeeded(index: nextIndex)
            }
            updateUI(animated: false)
        }
    }

    private func syncAdvancedPhonemeProgress() {
        guard
            activePlaybackSource == .recording,
            let player = audioPlayer,
            !activeAdvancedPhonemes.isEmpty,
            !advancedPhonemeLabels.isEmpty
        else {
            resetAdvancedPhonemePlaybackState()
            return
        }

        let currentMs = Int((player.currentTime * 1000).rounded())
        for (index, phoneme) in activeAdvancedPhonemes.enumerated() {
            guard advancedPhonemeLabels.indices.contains(index) else { continue }
            let label = advancedPhonemeLabels[index]
            guard let startMs = phoneme.offsetMs else {
                applyAdvancedPhonemePlaybackState(to: label, tint: theme.tint, isActive: false, isPast: false)
                continue
            }
            let endMs = max(startMs + 20, phoneme.endMs ?? startMs + 120)
            let isActive = currentMs >= startMs && currentMs <= endMs
            let isPast = currentMs > endMs
            applyAdvancedPhonemePlaybackState(to: label, tint: theme.tint, isActive: isActive, isPast: isPast)
        }
    }

    private func revealAdvancedWordChipIfNeeded(index: Int) {
        guard
            advancedWordsStack.arrangedSubviews.indices.contains(index),
            let view = advancedWordsStack.arrangedSubviews[index] as? UIButton
        else {
            return
        }
        let frame = view.convert(view.bounds, to: advancedWordsScrollView)
        advancedWordsScrollView.scrollRectToVisible(frame.insetBy(dx: -16, dy: 0), animated: true)
    }

    private func scoreTone() -> ResultTone {
        guard let scorePercent else { return activeResultTone }
        switch scorePercent {
        case 85...100: return .good
        case 70...84: return .good
        case 60...69: return .okay
        default: return .bad
        }
    }

    private func showToast(_ message: String) {
        toastHideWorkItem?.cancel()
        toastLabel.text = message
        toastLabel.isHidden = false

        UIView.animate(withDuration: 0.20) {
            self.toastLabel.alpha = 1
        }

        let workItem = DispatchWorkItem { [weak self] in
            guard let self else { return }
            UIView.animate(withDuration: 0.20, animations: {
                self.toastLabel.alpha = 0
            }, completion: { _ in
                self.toastLabel.isHidden = true
            })
        }
        toastHideWorkItem = workItem
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.8, execute: workItem)
    }

    private func startMascotPulse() {
        if mascotImageView.isAnimating == false, !mascotTalkFrames.isEmpty {
            mascotImageView.stopAnimating()
            mascotImageView.animationImages = mascotTalkFrames
            mascotImageView.animationDuration = Double(mascotTalkFrames.count) * 0.15
            mascotImageView.animationRepeatCount = 0
            mascotImageView.startAnimating()
        }
        guard mascotCard.layer.animation(forKey: "pulse") == nil else { return }
        let animation = CABasicAnimation(keyPath: "transform.scale")
        animation.fromValue = 1.0
        animation.toValue = 1.03
        animation.duration = 0.36
        animation.autoreverses = true
        animation.repeatCount = .infinity
        animation.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
        mascotCard.layer.add(animation, forKey: "pulse")
        heroBubbleLabel.textColor = theme.tint.withAlphaComponent(0.96)
    }

    private func stopMascotPulse() {
        mascotCard.layer.removeAnimation(forKey: "pulse")
        mascotImageView.stopAnimating()
        mascotImageView.animationImages = nil
        mascotImageView.image = mascotRestImage
        heroBubbleLabel.textColor = labPrimaryTextColor()
    }

    private func presentNotifications() {
        let controller = NotificationsViewController(copy: copy)
        presentLabSheet(controller, from: self)
    }

    private func presentDiagnostics() {
        let controller = DiagnosticsViewController(session: session, copy: copy)
        presentLabSheet(controller, from: self)
    }

    private func presentPermissionAlert(message: String) {
        let alert = UIAlertController(title: copy.login.alertHeader, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: copy.login.alertOk, style: .default))
        present(alert, animated: true)
    }

    private func scoreSimilarity(expected: String, actual: String) -> Int {
        let normalizedExpected = normalizeComparisonText(expected)
        let normalizedActual = normalizeComparisonText(actual)
        guard !normalizedExpected.isEmpty, !normalizedActual.isEmpty else { return 0 }
        let distance = levenshtein(Array(normalizedExpected), Array(normalizedActual))
        let maxLength = max(normalizedExpected.count, normalizedActual.count)
        guard maxLength > 0 else { return 100 }
        let ratio = 1 - Double(distance) / Double(maxLength)
        return max(0, min(100, Int((ratio * 100).rounded())))
    }

    private func normalizeComparisonText(_ text: String) -> String {
        text
            .lowercased()
            .replacingOccurrences(of: "[^a-z0-9\\u00c0-\\u024f\\s]", with: " ", options: .regularExpression)
            .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func levenshtein(_ lhs: [Character], _ rhs: [Character]) -> Int {
        if lhs.isEmpty { return rhs.count }
        if rhs.isEmpty { return lhs.count }

        var previous = Array(0 ... rhs.count)
        for (lhsIndex, lhsCharacter) in lhs.enumerated() {
            var current = [lhsIndex + 1] + Array(repeating: 0, count: rhs.count)
            for (rhsIndex, rhsCharacter) in rhs.enumerated() {
                let cost = lhsCharacter == rhsCharacter ? 0 : 1
                current[rhsIndex + 1] = min(
                    previous[rhsIndex + 1] + 1,
                    current[rhsIndex] + 1,
                    previous[rhsIndex] + cost
                )
            }
            previous = current
        }
        return previous[rhs.count]
    }

    private func makeDiffAttributedText(text: String, against comparisonText: String, compareExpectedTokens: Bool) -> NSAttributedString {
        let displayTokens = labTokenizeWords(text)
        let comparisonTokens = labTokenizeWords(comparisonText)
        let matched = labMatchedTokenIndexes(lhs: displayTokens.map(\.normalized), rhs: comparisonTokens.map(\.normalized))
        let matchedIndexes = compareExpectedTokens ? matched.lhs : matched.rhs

        let attributed = NSMutableAttributedString()
        let baseFont = UIFont.systemFont(ofSize: 16, weight: .semibold)
        let matchedForeground = UIColor.systemGreen.withAlphaComponent(0.96)
        let matchedBackground = UIColor.systemGreen.withAlphaComponent(0.12)
        let unmatchedForeground = UIColor.systemOrange.withAlphaComponent(0.96)
        let unmatchedBackground = UIColor.systemOrange.withAlphaComponent(0.12)

        for (index, token) in displayTokens.enumerated() {
            let isMatched = matchedIndexes.contains(index)
            let attributes: [NSAttributedString.Key: Any] = [
                .font: baseFont,
                .foregroundColor: isMatched ? matchedForeground : unmatchedForeground,
                .backgroundColor: isMatched ? matchedBackground : unmatchedBackground
            ]
            attributed.append(NSAttributedString(string: token.original, attributes: attributes))
            if index < displayTokens.count - 1 {
                attributed.append(NSAttributedString(string: " "))
            }
        }
        return attributed
    }
}

extension LabViewController: UITextViewDelegate {
    func textViewDidBeginEditing(_ textView: UITextView) {
        phrasePlaceholderLabel.isHidden = true
        let visibleRect = phraseTextView.convert(phraseTextView.bounds, to: scrollView)
        scrollView.scrollRectToVisible(visibleRect.insetBy(dx: 0, dy: -40), animated: true)
    }

    func textViewDidChange(_ textView: UITextView) {
        expectedText = textView.text ?? ""
        phraseStore.persistPhrase(expectedText, locale: session.locale)
        phrasePlaceholderLabel.isHidden = !expectedText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || textView.isFirstResponder
        resetPracticeResult(clearRecording: true)
        updateUI(animated: false)
    }

    func textViewDidEndEditing(_ textView: UITextView) {
        phrasePlaceholderLabel.isHidden = !expectedText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
}

extension LabViewController: AVAudioRecorderDelegate {
    func audioRecorderDidFinishRecording(_ recorder: AVAudioRecorder, successfully flag: Bool) {
        isRecording = false
        audioRecorder = nil
        stopMascotPulse()
        updateUI(animated: true)

        guard flag else {
            applyResult(tone: .warn, message: "Recording failed.")
            updateUI(animated: true)
            return
        }

        recordingURL = recorder.url
        NativeDebugLogStore.shared.add("[Lab] record stop \(recorder.url.lastPathComponent)")
        transcribeRecording(at: recorder.url)
    }
}

extension LabViewController: AVAudioPlayerDelegate {
    func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        playbackWordTimer?.invalidate()
        playbackWordTimer = nil
        playbackWordSegments = []
        activePlaybackWordIndex = nil
        resetAdvancedPhonemePlaybackState()
        audioPlayer = nil
        activePlaybackSource = nil
        stopMascotPulse()
        updateUI(animated: true)
    }
}

extension LabViewController: AVSpeechSynthesizerDelegate {
    func speechSynthesizer(
        _ synthesizer: AVSpeechSynthesizer,
        willSpeakRangeOfSpeechString characterRange: NSRange,
        utterance: AVSpeechUtterance
    ) {
        guard activePlaybackSource == .phrase else { return }
        let index = labWordIndex(in: utterance.speechString, for: characterRange)
        guard activePlaybackWordIndex != index else { return }
        activePlaybackWordIndex = index
        if let index {
            revealAdvancedWordChipIfNeeded(index: index)
        }
        updateUI(animated: false)
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        playbackWordSegments = []
        activePlaybackWordIndex = nil
        resetAdvancedPhonemePlaybackState()
        activePlaybackSource = nil
        stopMascotPulse()
        updateUI(animated: true)
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        playbackWordSegments = []
        activePlaybackWordIndex = nil
        resetAdvancedPhonemePlaybackState()
        activePlaybackSource = nil
        stopMascotPulse()
        updateUI(animated: true)
    }
}

private final class LabSavedPhrasesViewController: UIViewController {
    var onSelectPhrase: ((LabSavedPhrase) -> Void)?
    var onDeletePhrase: ((LabSavedPhrase) -> Void)?

    private let copy: AppCopy
    private var phrases: [LabSavedPhrase]
    private let tableView = UITableView(frame: .zero, style: .insetGrouped)
    private let emptyStateLabel = UILabel()

    init(copy: AppCopy, phrases: [LabSavedPhrase]) {
        self.copy = copy
        self.phrases = phrases
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = RootScreen.lab.theme.background
        navigationItem.rightBarButtonItem = UIBarButtonItem(
            systemItem: .done,
            primaryAction: UIAction { [weak self] _ in
                self?.dismiss(animated: true)
            }
        )
        title = copy.freeRide.savedPhrasesTitle
        buildLayout()
        reloadState()
    }

    private func buildLayout() {
        let subtitleLabel = UILabel()
        subtitleLabel.translatesAutoresizingMaskIntoConstraints = false
        subtitleLabel.font = .systemFont(ofSize: 15, weight: .regular)
        subtitleLabel.textColor = .secondaryLabel
        subtitleLabel.numberOfLines = 0
        subtitleLabel.text = copy.freeRide.savedPhrasesSubtitle

        tableView.translatesAutoresizingMaskIntoConstraints = false
        tableView.backgroundColor = .clear
        tableView.dataSource = self
        tableView.delegate = self
        tableView.register(UITableViewCell.self, forCellReuseIdentifier: "PhraseCell")

        emptyStateLabel.translatesAutoresizingMaskIntoConstraints = false
        emptyStateLabel.font = .systemFont(ofSize: 16, weight: .medium)
        emptyStateLabel.textColor = .secondaryLabel
        emptyStateLabel.numberOfLines = 0
        emptyStateLabel.textAlignment = .center
        emptyStateLabel.text = "\(copy.freeRide.noSavedPhrasesYet)\n\n\(copy.freeRide.savedPhrasesHint)"

        view.addSubview(subtitleLabel)
        view.addSubview(tableView)
        view.addSubview(emptyStateLabel)

        NSLayoutConstraint.activate([
            subtitleLabel.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 20),
            subtitleLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            subtitleLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),

            tableView.topAnchor.constraint(equalTo: subtitleLabel.bottomAnchor, constant: 12),
            tableView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            tableView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            tableView.bottomAnchor.constraint(equalTo: view.bottomAnchor),

            emptyStateLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 28),
            emptyStateLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -28),
            emptyStateLabel.centerYAnchor.constraint(equalTo: view.centerYAnchor)
        ])
    }

    private func reloadState() {
        let isEmpty = phrases.isEmpty
        tableView.isHidden = isEmpty
        emptyStateLabel.isHidden = !isEmpty
        tableView.reloadData()
    }
}

extension LabSavedPhrasesViewController: UITableViewDataSource, UITableViewDelegate {
    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        phrases.count
    }

    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "PhraseCell", for: indexPath)
        var content = cell.defaultContentConfiguration()
        let phrase = phrases[indexPath.row]
        content.text = phrase.text
        content.textProperties.numberOfLines = 2
        content.secondaryText = labSavedPhraseMetadata(phrase)
        content.secondaryTextProperties.numberOfLines = 2
        content.secondaryTextProperties.color = .secondaryLabel
        cell.contentConfiguration = content
        cell.accessoryType = .disclosureIndicator
        cell.backgroundColor = .clear
        return cell
    }

    func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        let phrase = phrases[indexPath.row]
        dismiss(animated: true) { [weak self] in
            self?.onSelectPhrase?(phrase)
        }
    }

    func tableView(_ tableView: UITableView, trailingSwipeActionsConfigurationForRowAt indexPath: IndexPath) -> UISwipeActionsConfiguration? {
        let phrase = phrases[indexPath.row]
        let delete = UIContextualAction(style: .destructive, title: copy.freeRide.deletePhrase) { [weak self] _, _, completion in
            guard let self else {
                completion(false)
                return
            }
            self.onDeletePhrase?(phrase)
            self.phrases.remove(at: indexPath.row)
            self.reloadState()
            completion(true)
        }
        return UISwipeActionsConfiguration(actions: [delete])
    }
}

private final class LabDetailsViewController: UIViewController, AVAudioPlayerDelegate {
    private let copy: AppCopy
    private let expectedText: String
    private let transcriptText: String
    private let scorePercent: Int?
    private let advancedAssessment: LabAdvancedAssessment?
    private let recordingURL: URL?
    private let initialSelectedWordIndex: Int?
    private let theme = RootScreen.lab.theme

    private let scrollView = UIScrollView()
    private let contentStack = UIStackView()
    private let replayCard = UIView()
    private let replayButton = UIButton(type: .system)
    private let targetCard = UIView()
    private let targetLabel = UILabel()
    private let wordsCard = UIView()
    private let wordsScrollView = UIScrollView()
    private let wordsStack = UIStackView()
    private let wordDetailView = UIView()
    private let wordDetailLabel = UILabel()
    private let phonemesScrollView = UIScrollView()
    private let phonemesStack = UIStackView()

    private var wordButtons: [UIButton] = []
    private var phonemeLabels: [PaddingLabel] = []
    private var activeAdvancedPhonemes: [LabAdvancedPhoneme] = []
    private var selectedWordIndex: Int?
    private var renderedWordIndex: Int?
    private var activePlaybackWordIndex: Int?
    private var audioPlayer: AVAudioPlayer?
    private var playbackTimer: Timer?

    init(
        copy: AppCopy,
        expectedText: String,
        transcriptText: String,
        scorePercent: Int?,
        advancedAssessment: LabAdvancedAssessment?,
        recordingURL: URL?,
        selectedWordIndex: Int?
    ) {
        self.copy = copy
        self.expectedText = expectedText
        self.transcriptText = transcriptText
        self.scorePercent = scorePercent
        self.advancedAssessment = advancedAssessment
        self.recordingURL = recordingURL
        self.initialSelectedWordIndex = selectedWordIndex
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = RootScreen.lab.theme.background
        title = copy.freeRide.title
        navigationItem.rightBarButtonItem = UIBarButtonItem(
            systemItem: .done,
            primaryAction: UIAction { [weak self] _ in
                self?.dismiss(animated: true)
            }
        )
        selectedWordIndex = initialSelectedWordIndex ?? defaultSelectedWordIndex()
        buildLayout()
        updateUI(animated: false)
    }

    override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated)
        if isBeingDismissed || navigationController?.isBeingDismissed == true {
            stopPlayback()
        }
    }

    deinit {
        playbackTimer?.invalidate()
    }

    private var playbackWords: [LabAdvancedWord] {
        guard let advancedAssessment, advancedAssessment.ok else { return [] }
        return advancedAssessment.words
    }

    private func buildLayout() {
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.alwaysBounceVertical = true

        contentStack.translatesAutoresizingMaskIntoConstraints = false
        contentStack.axis = .vertical
        contentStack.spacing = 14

        view.addSubview(scrollView)
        scrollView.addSubview(contentStack)

        NSLayoutConstraint.activate([
            scrollView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor),

            contentStack.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor, constant: 20),
            contentStack.leadingAnchor.constraint(equalTo: scrollView.frameLayoutGuide.leadingAnchor, constant: 16),
            contentStack.trailingAnchor.constraint(equalTo: scrollView.frameLayoutGuide.trailingAnchor, constant: -16),
            contentStack.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor, constant: -28)
        ])

        if let summaryCard = labDetailSummaryCard(
            copy: copy,
            scorePercent: scorePercent,
            advancedAssessment: advancedAssessment
        ) {
            contentStack.addArrangedSubview(summaryCard)
        }
        if recordingURL != nil {
            contentStack.addArrangedSubview(buildReplayCard())
        }
        if !expectedText.isEmpty {
            contentStack.addArrangedSubview(buildTargetCard())
        }
        if !playbackWords.isEmpty {
            contentStack.addArrangedSubview(buildWordsCard())
        }
        if !transcriptText.isEmpty {
            contentStack.addArrangedSubview(labDetailCard(title: copy.freeRide.transcript, value: transcriptText))
        }
        if let advancedAssessment, !advancedAssessment.transcript.isEmpty {
            contentStack.addArrangedSubview(
                labDetailCard(title: copy.freeRide.transcriptAdvanced, value: advancedAssessment.transcript)
            )
        }

        if contentStack.arrangedSubviews.isEmpty {
            contentStack.addArrangedSubview(labDetailCard(title: copy.freeRide.title, value: copy.freeRide.feedbackHint))
        }
    }

    private func buildReplayCard() -> UIView {
        decorateCard(replayCard)

        let stack = UIStackView()
        stack.translatesAutoresizingMaskIntoConstraints = false
        stack.axis = .vertical
        stack.spacing = 12
        replayCard.addSubview(stack)
        labPin(stack, to: replayCard, insets: UIEdgeInsets(top: 18, left: 18, bottom: 18, right: 18))

        let titleLabel = UILabel()
        titleLabel.font = .systemFont(ofSize: 13, weight: .bold)
        titleLabel.textColor = labSecondaryTextColor()
        titleLabel.text = copy.freeRide.yourVoiceLabel

        replayButton.translatesAutoresizingMaskIntoConstraints = false
        replayButton.addTarget(self, action: #selector(handleReplayTapped), for: .touchUpInside)
        let buttonRow = UIStackView()
        buttonRow.translatesAutoresizingMaskIntoConstraints = false
        buttonRow.axis = .horizontal
        buttonRow.spacing = 8
        let spacer = UIView()
        spacer.translatesAutoresizingMaskIntoConstraints = false
        buttonRow.addArrangedSubview(replayButton)
        buttonRow.addArrangedSubview(spacer)

        stack.addArrangedSubview(titleLabel)
        stack.addArrangedSubview(buttonRow)
        return replayCard
    }

    private func buildTargetCard() -> UIView {
        decorateCard(targetCard)

        let stack = UIStackView()
        stack.translatesAutoresizingMaskIntoConstraints = false
        stack.axis = .vertical
        stack.spacing = 12
        targetCard.addSubview(stack)
        labPin(stack, to: targetCard, insets: UIEdgeInsets(top: 18, left: 18, bottom: 18, right: 18))

        let titleLabel = UILabel()
        titleLabel.font = .systemFont(ofSize: 13, weight: .bold)
        titleLabel.textColor = labSecondaryTextColor()
        titleLabel.text = copy.freeRide.inputLabel

        targetLabel.translatesAutoresizingMaskIntoConstraints = false
        targetLabel.numberOfLines = 0
        targetLabel.lineBreakMode = .byWordWrapping

        stack.addArrangedSubview(titleLabel)
        stack.addArrangedSubview(targetLabel)
        return targetCard
    }

    private func buildWordsCard() -> UIView {
        decorateCard(wordsCard)

        let stack = UIStackView()
        stack.translatesAutoresizingMaskIntoConstraints = false
        stack.axis = .vertical
        stack.spacing = 12
        wordsCard.addSubview(stack)
        labPin(stack, to: wordsCard, insets: UIEdgeInsets(top: 18, left: 18, bottom: 18, right: 18))

        let titleLabel = UILabel()
        titleLabel.font = .systemFont(ofSize: 13, weight: .bold)
        titleLabel.textColor = labSecondaryTextColor()
        titleLabel.text = copy.freeRide.advanced

        wordsScrollView.translatesAutoresizingMaskIntoConstraints = false
        wordsScrollView.alwaysBounceHorizontal = true
        wordsScrollView.showsHorizontalScrollIndicator = false

        wordsStack.translatesAutoresizingMaskIntoConstraints = false
        wordsStack.axis = .horizontal
        wordsStack.spacing = 8

        wordsScrollView.addSubview(wordsStack)
        NSLayoutConstraint.activate([
            wordsStack.topAnchor.constraint(equalTo: wordsScrollView.contentLayoutGuide.topAnchor),
            wordsStack.leadingAnchor.constraint(equalTo: wordsScrollView.contentLayoutGuide.leadingAnchor),
            wordsStack.trailingAnchor.constraint(equalTo: wordsScrollView.contentLayoutGuide.trailingAnchor),
            wordsStack.bottomAnchor.constraint(equalTo: wordsScrollView.contentLayoutGuide.bottomAnchor),
            wordsStack.heightAnchor.constraint(equalTo: wordsScrollView.frameLayoutGuide.heightAnchor)
        ])
        NSLayoutConstraint.activate([
            wordsScrollView.heightAnchor.constraint(equalToConstant: 34)
        ])

        for (index, word) in playbackWords.enumerated() {
            let button = UIButton(type: .system)
            button.translatesAutoresizingMaskIntoConstraints = false
            button.tag = index
            button.addTarget(self, action: #selector(handleWordTapped(_:)), for: .touchUpInside)
            labUpdateAdvancedWordChip(
                button,
                title: word.expected.isEmpty ? "—" : word.expected,
                tint: labAdvancedToneColor(for: word.status),
                selected: false,
                playing: false
            )
            wordButtons.append(button)
            wordsStack.addArrangedSubview(button)
        }

        wordDetailView.translatesAutoresizingMaskIntoConstraints = false
        wordDetailView.layer.cornerRadius = 18
        wordDetailView.layer.cornerCurve = .continuous
        wordDetailView.layer.borderWidth = 1

        let detailStack = UIStackView()
        detailStack.translatesAutoresizingMaskIntoConstraints = false
        detailStack.axis = .vertical
        detailStack.spacing = 10
        wordDetailView.addSubview(detailStack)
        labPin(detailStack, to: wordDetailView, insets: UIEdgeInsets(top: 14, left: 14, bottom: 14, right: 14))

        wordDetailLabel.translatesAutoresizingMaskIntoConstraints = false
        wordDetailLabel.numberOfLines = 0

        phonemesScrollView.translatesAutoresizingMaskIntoConstraints = false
        phonemesScrollView.alwaysBounceHorizontal = true
        phonemesScrollView.showsHorizontalScrollIndicator = false

        phonemesStack.translatesAutoresizingMaskIntoConstraints = false
        phonemesStack.axis = .horizontal
        phonemesStack.spacing = 8
        phonemesScrollView.addSubview(phonemesStack)
        NSLayoutConstraint.activate([
            phonemesStack.topAnchor.constraint(equalTo: phonemesScrollView.contentLayoutGuide.topAnchor),
            phonemesStack.leadingAnchor.constraint(equalTo: phonemesScrollView.contentLayoutGuide.leadingAnchor),
            phonemesStack.trailingAnchor.constraint(equalTo: phonemesScrollView.contentLayoutGuide.trailingAnchor),
            phonemesStack.bottomAnchor.constraint(equalTo: phonemesScrollView.contentLayoutGuide.bottomAnchor),
            phonemesStack.heightAnchor.constraint(equalTo: phonemesScrollView.frameLayoutGuide.heightAnchor),
            phonemesScrollView.heightAnchor.constraint(equalToConstant: 34)
        ])

        detailStack.addArrangedSubview(wordDetailLabel)
        detailStack.addArrangedSubview(phonemesScrollView)

        stack.addArrangedSubview(titleLabel)
        stack.addArrangedSubview(wordsScrollView)
        stack.addArrangedSubview(wordDetailView)
        return wordsCard
    }

    private func decorateCard(_ view: UIView) {
        view.translatesAutoresizingMaskIntoConstraints = false
        view.backgroundColor = .white
        view.layer.cornerRadius = 20
        view.layer.cornerCurve = .continuous
        view.layer.borderWidth = 1
        view.layer.borderColor = labSurfaceBorderColor().cgColor
        view.layer.shadowColor = labSurfaceShadowColor().cgColor
        view.layer.shadowOpacity = 1
        view.layer.shadowRadius = 10
        view.layer.shadowOffset = CGSize(width: 0, height: 4)
    }

    private func updateUI(animated: Bool) {
        updateReplayButton()
        updateTargetLabel()
        updateWordButtons()
        updateSelectedWordFeedback()

        if animated {
            UIView.animate(withDuration: 0.18) {
                self.view.layoutIfNeeded()
            }
        }
    }

    private func updateReplayButton() {
        guard recordingURL != nil else {
            replayCard.isHidden = true
            return
        }

        replayCard.isHidden = false
        let isPlaying = audioPlayer != nil
        var configuration = UIButton.Configuration.filled()
        configuration.title = isPlaying ? copy.freeRide.endLabel : copy.freeRide.yourVoiceLabel
        configuration.image = UIImage(systemName: isPlaying ? "stop.fill" : "waveform")
        configuration.imagePlacement = .leading
        configuration.imagePadding = 8
        configuration.cornerStyle = .capsule
        configuration.contentInsets = NSDirectionalEdgeInsets(top: 10, leading: 14, bottom: 10, trailing: 14)
        configuration.baseForegroundColor = isPlaying ? .white : theme.tint
        configuration.baseBackgroundColor = isPlaying ? theme.tint : theme.tint.withAlphaComponent(0.10)
        configuration.background.strokeColor = theme.tint.withAlphaComponent(isPlaying ? 0 : 0.18)
        configuration.background.strokeWidth = isPlaying ? 0 : 1
        replayButton.configuration = configuration
        replayButton.contentHorizontalAlignment = .leading
    }

    private func updateTargetLabel() {
        guard !expectedText.isEmpty else {
            targetCard.isHidden = true
            return
        }

        targetCard.isHidden = false
        let tokens = labTokenizeWords(expectedText)
        let statuses = expectedStatuses()
        let attributed = NSMutableAttributedString()

        for (index, token) in tokens.enumerated() {
            let status = statuses?[safe: index]
            let isPlaying = activePlaybackWordIndex == index
            attributed.append(NSAttributedString(
                string: token.original,
                attributes: targetTokenAttributes(status: status, isPlaying: isPlaying)
            ))
            if index < tokens.count - 1 {
                attributed.append(NSAttributedString(string: " "))
            }
        }

        targetLabel.attributedText = attributed
    }

    private func expectedStatuses() -> [LabAdvancedWordStatus]? {
        guard !playbackWords.isEmpty else { return nil }
        let expectedWords = playbackWords.filter { $0.status != .extra }
        guard !expectedWords.isEmpty else { return nil }
        return expectedWords.map(\.status)
    }

    private func targetTokenAttributes(
        status: LabAdvancedWordStatus?,
        isPlaying: Bool
    ) -> [NSAttributedString.Key: Any] {
        let baseFont = UIFont.systemFont(ofSize: 16, weight: isPlaying ? .bold : .semibold)
        let foregroundColor: UIColor
        let backgroundColor: UIColor

        if isPlaying {
            foregroundColor = .white
            backgroundColor = theme.tint
        } else if let status {
            let tint = labAdvancedToneColor(for: status)
            foregroundColor = tint
            backgroundColor = tint.withAlphaComponent(0.12)
        } else {
            foregroundColor = labPrimaryTextColor()
            backgroundColor = UIColor.clear
        }

        let shadow = NSShadow()
        if isPlaying {
            shadow.shadowColor = theme.tint.withAlphaComponent(0.24)
            shadow.shadowBlurRadius = 8
            shadow.shadowOffset = CGSize(width: 0, height: 4)
        }

        return [
            .font: baseFont,
            .foregroundColor: foregroundColor,
            .backgroundColor: backgroundColor,
            .shadow: shadow
        ]
    }

    private func updateWordButtons() {
        guard !wordButtons.isEmpty, playbackWords.count == wordButtons.count else { return }
        if selectedWordIndex == nil {
            selectedWordIndex = defaultSelectedWordIndex()
        }

        for (index, button) in wordButtons.enumerated() {
            let word = playbackWords[index]
            labUpdateAdvancedWordChip(
                button,
                title: word.expected.isEmpty ? "—" : word.expected,
                tint: labAdvancedToneColor(for: word.status),
                selected: selectedWordIndex == index,
                playing: activePlaybackWordIndex == index
            )
        }
    }

    private func updateSelectedWordFeedback() {
        guard !playbackWords.isEmpty else {
            wordsCard.isHidden = true
            return
        }

        wordsCard.isHidden = false
        guard
            let selectedWordIndex,
            playbackWords.indices.contains(selectedWordIndex)
        else {
            wordDetailView.isHidden = true
            phonemesScrollView.isHidden = true
            activeAdvancedPhonemes = []
            resetPhonemePlaybackState()
            return
        }

        let word = playbackWords[selectedWordIndex]
        let tint = labAdvancedToneColor(for: word.status)
        let isPlaying = activePlaybackWordIndex == selectedWordIndex

        wordDetailView.isHidden = false
        wordDetailView.backgroundColor = tint.withAlphaComponent(isPlaying ? 0.14 : 0.08)
        wordDetailView.layer.borderColor = tint.withAlphaComponent(isPlaying ? 0.26 : 0.16).cgColor
        wordDetailLabel.attributedText = makeWordDetailText(for: word, tint: tint, isPlaying: isPlaying)

        if renderedWordIndex != selectedWordIndex {
            renderedWordIndex = selectedWordIndex
            rebuildPhonemeFeedback(for: word)
        }

        if audioPlayer != nil {
            syncAdvancedPhonemeProgress()
        } else {
            resetPhonemePlaybackState()
        }
    }

    private func makeWordDetailText(for word: LabAdvancedWord, tint: UIColor, isPlaying: Bool) -> NSAttributedString {
        let expected = word.expected.isEmpty ? "—" : word.expected
        let recognized = word.recognized.isEmpty ? "—" : word.recognized
        let detail = NSMutableAttributedString()
        detail.append(NSAttributedString(
            string: "\(expected) · \(word.status.label)\n",
            attributes: [
                .font: UIFont.systemFont(ofSize: 15, weight: .bold),
                .foregroundColor: isPlaying ? tint : labPrimaryTextColor()
            ]
        ))

        let rows = [
            ("Score", word.score.map { "\($0)%" } ?? "—"),
            ("Recorded", recognized),
            ("Error", labAdvancedErrorDisplayText(word.errorType)),
            ("Duration", word.durationText),
            ("Phonemes", word.phonemeSummary)
        ]

        for (index, row) in rows.enumerated() {
            detail.append(NSAttributedString(
                string: "\(row.0): ",
                attributes: [
                    .font: UIFont.systemFont(ofSize: 13, weight: .bold),
                    .foregroundColor: tint
                ]
            ))
            detail.append(NSAttributedString(
                string: row.1,
                attributes: [
                    .font: UIFont.systemFont(ofSize: 13, weight: .semibold),
                    .foregroundColor: labSecondaryTextColor()
                ]
            ))
            if index < rows.count - 1 {
                detail.append(NSAttributedString(string: "\n"))
            }
        }

        return detail
    }

    private func rebuildPhonemeFeedback(for word: LabAdvancedWord) {
        while let view = phonemesStack.arrangedSubviews.first {
            phonemesStack.removeArrangedSubview(view)
            view.removeFromSuperview()
        }
        phonemeLabels = []

        let phonemes = labDisplayablePhonemes(for: word)
        activeAdvancedPhonemes = phonemes
        guard !phonemes.isEmpty else {
            phonemesScrollView.isHidden = true
            return
        }

        phonemesScrollView.isHidden = false
        for phoneme in phonemes {
            let label = labMakeAdvancedPhonemeChip(
                text: labAdvancedPhonemeDisplayText(phoneme),
                tint: theme.tint
            )
            phonemeLabels.append(label)
            phonemesStack.addArrangedSubview(label)
        }
    }

    private func resetPhonemePlaybackState() {
        for label in phonemeLabels {
            applyPhonemePlaybackState(to: label, tint: theme.tint, isActive: false, isPast: false)
        }
    }

    private func applyPhonemePlaybackState(
        to label: PaddingLabel,
        tint: UIColor,
        isActive: Bool,
        isPast: Bool
    ) {
        if isActive {
            label.backgroundColor = tint.withAlphaComponent(0.18)
            label.textColor = labPrimaryTextColor()
            label.layer.borderColor = tint.withAlphaComponent(0.34).cgColor
        } else if isPast {
            label.backgroundColor = tint.withAlphaComponent(0.08)
            label.textColor = tint.withAlphaComponent(0.92)
            label.layer.borderColor = tint.withAlphaComponent(0.16).cgColor
        } else {
            label.backgroundColor = .white
            label.textColor = labSecondaryTextColor()
            label.layer.borderColor = labSurfaceBorderColor().cgColor
        }
    }

    private func defaultSelectedWordIndex() -> Int? {
        guard !playbackWords.isEmpty else { return nil }
        if let index = playbackWords.firstIndex(where: {
            $0.status == .wrong || $0.status == .missing || $0.status == .issue
        }) {
            return index
        }
        return playbackWords.indices.first
    }

    @objc private func handleReplayTapped() {
        guard let recordingURL else { return }

        if audioPlayer != nil {
            stopPlayback()
            return
        }

        do {
            try configureAudioSessionForPlayback()
            let player = try AVAudioPlayer(contentsOf: recordingURL)
            player.delegate = self
            audioPlayer = player
            activePlaybackWordIndex = nil
            if selectedWordIndex == nil {
                selectedWordIndex = defaultSelectedWordIndex()
            }
            startPlaybackTimer()
            updateUI(animated: true)
            player.play()
            NativeDebugLogStore.shared.add("[Lab] detail replay start \(recordingURL.lastPathComponent)")
        } catch {
            NativeDebugLogStore.shared.add("[Lab] detail replay failed \(error.localizedDescription)")
            stopPlayback()
        }
    }

    @objc private func handleWordTapped(_ sender: UIButton) {
        selectedWordIndex = sender.tag
        updateUI(animated: true)
    }

    private func startPlaybackTimer() {
        playbackTimer?.invalidate()
        guard audioPlayer != nil else { return }
        playbackTimer = Timer.scheduledTimer(withTimeInterval: 0.05, repeats: true) { [weak self] _ in
            self?.syncPlaybackFeedbackProgress()
        }
        if let playbackTimer {
            RunLoop.main.add(playbackTimer, forMode: .common)
        }
    }

    private func syncPlaybackFeedbackProgress() {
        guard let player = audioPlayer, !playbackWords.isEmpty else {
            resetPhonemePlaybackState()
            return
        }

        let currentMs = Int((player.currentTime * 1000).rounded())
        var nextIndex: Int?

        for (index, word) in playbackWords.enumerated() {
            guard let startMs = word.playbackStartMs else { continue }
            let endMs = max(startMs + 30, word.playbackEndMs ?? startMs + 120)
            if currentMs >= startMs && currentMs <= endMs {
                nextIndex = index
                break
            }
            if currentMs > endMs {
                nextIndex = index
            }
        }

        if activePlaybackWordIndex != nextIndex {
            activePlaybackWordIndex = nextIndex
            if let nextIndex {
                selectedWordIndex = nextIndex
                revealWordChipIfNeeded(index: nextIndex)
            }
            updateUI(animated: false)
        }

        syncAdvancedPhonemeProgress()
    }

    private func syncAdvancedPhonemeProgress() {
        guard
            let player = audioPlayer,
            !activeAdvancedPhonemes.isEmpty,
            !phonemeLabels.isEmpty
        else {
            resetPhonemePlaybackState()
            return
        }

        let currentMs = Int((player.currentTime * 1000).rounded())
        for (index, phoneme) in activeAdvancedPhonemes.enumerated() {
            guard phonemeLabels.indices.contains(index) else { continue }
            let label = phonemeLabels[index]
            guard let startMs = phoneme.offsetMs else {
                applyPhonemePlaybackState(to: label, tint: theme.tint, isActive: false, isPast: false)
                continue
            }
            let endMs = max(startMs + 20, phoneme.endMs ?? startMs + 120)
            let isActive = currentMs >= startMs && currentMs <= endMs
            let isPast = currentMs > endMs
            applyPhonemePlaybackState(to: label, tint: theme.tint, isActive: isActive, isPast: isPast)
        }
    }

    private func revealWordChipIfNeeded(index: Int) {
        guard
            wordButtons.indices.contains(index)
        else {
            return
        }
        let button = wordButtons[index]
        let frame = button.convert(button.bounds, to: wordsScrollView)
        wordsScrollView.scrollRectToVisible(frame.insetBy(dx: -16, dy: 0), animated: true)
    }

    private func stopPlayback() {
        playbackTimer?.invalidate()
        playbackTimer = nil
        audioPlayer?.stop()
        audioPlayer = nil
        activePlaybackWordIndex = nil
        resetPhonemePlaybackState()
        updateUI(animated: true)
    }

    private func configureAudioSessionForPlayback() throws {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playback, mode: .spokenAudio, options: [.duckOthers])
        try session.setActive(true)
    }

    func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        stopPlayback()
    }
}

private func presentLabSheet(_ controller: UIViewController, from presenter: UIViewController? = nil) {
    let navigationController = UINavigationController(rootViewController: controller)
    if let sheet = navigationController.sheetPresentationController {
        sheet.detents = [.medium(), .large()]
        sheet.prefersGrabberVisible = true
    }
    (presenter ?? UIApplication.shared.connectedScenes
        .compactMap { $0 as? UIWindowScene }
        .flatMap(\.windows)
        .first(where: \.isKeyWindow)?
        .rootViewController)?
        .present(navigationController, animated: true)
}

private func labPin(_ child: UIView, to parent: UIView, insets: UIEdgeInsets) {
    NSLayoutConstraint.activate([
        child.topAnchor.constraint(equalTo: parent.topAnchor, constant: insets.top),
        child.leadingAnchor.constraint(equalTo: parent.leadingAnchor, constant: insets.left),
        child.trailingAnchor.constraint(equalTo: parent.trailingAnchor, constant: -insets.right),
        child.bottomAnchor.constraint(equalTo: parent.bottomAnchor, constant: -insets.bottom)
    ])
}

private func labConfigureMiniButton(_ button: UIButton, title: String, filled: Bool, tint: UIColor) {
    button.translatesAutoresizingMaskIntoConstraints = false
    var configuration = filled ? UIButton.Configuration.filled() : UIButton.Configuration.bordered()
    configuration.title = title
    configuration.cornerStyle = .capsule
    configuration.contentInsets = NSDirectionalEdgeInsets(top: 8, leading: 12, bottom: 8, trailing: 12)
    configuration.baseForegroundColor = filled ? tint : labPrimaryTextColor()
    configuration.baseBackgroundColor = filled ? tint.withAlphaComponent(0.08) : .white
    configuration.background.strokeColor = filled ? tint.withAlphaComponent(0.18) : labSurfaceBorderColor()
    configuration.background.strokeWidth = 1
    button.configuration = configuration
    button.titleLabel?.font = .systemFont(ofSize: 13, weight: .bold)
}

private func labConfigureActionButton(_ button: UIButton, title: String, iconName: String, tint: UIColor, filled: Bool) {
    button.translatesAutoresizingMaskIntoConstraints = false
    button.layer.cornerRadius = 26
    button.layer.cornerCurve = .continuous
    button.clipsToBounds = true
    button.titleLabel?.font = .systemFont(ofSize: 15, weight: .bold)
    NSLayoutConstraint.activate([
        button.heightAnchor.constraint(equalToConstant: 96)
    ])
    labUpdateActionButton(button, title: title, iconName: iconName, tint: tint, filled: filled, emphasized: false)
}

private func labUpdateActionButton(_ button: UIButton, title: String, iconName: String, tint: UIColor, filled: Bool, emphasized: Bool) {
    var configuration = filled ? UIButton.Configuration.filled() : UIButton.Configuration.bordered()
    configuration.title = title
    configuration.image = UIImage(systemName: iconName)
    configuration.imagePlacement = .top
    configuration.imagePadding = 10
    configuration.cornerStyle = .large
    configuration.contentInsets = NSDirectionalEdgeInsets(top: 16, leading: 12, bottom: 16, trailing: 12)
    configuration.baseForegroundColor = filled ? .white : tint
    configuration.baseBackgroundColor = filled ? (emphasized ? UIColor.systemRed : tint) : .white
    if !filled {
        configuration.background.strokeColor = labSurfaceBorderColor()
        configuration.background.strokeWidth = 1
    }
    button.configuration = configuration
}

private func labMakeAdvancedWordChip(title: String, tint: UIColor, selected: Bool, playing: Bool) -> UIButton {
    let button = UIButton(type: .system)
    button.translatesAutoresizingMaskIntoConstraints = false
    labUpdateAdvancedWordChip(button, title: title, tint: tint, selected: selected, playing: playing)
    return button
}

private func labUpdateAdvancedWordChip(_ button: UIButton, title: String, tint: UIColor, selected: Bool, playing: Bool) {
    var configuration = UIButton.Configuration.plain()
    configuration.title = title
    configuration.baseForegroundColor = selected ? .white : (playing ? tint.withAlphaComponent(0.96) : tint)
    configuration.contentInsets = NSDirectionalEdgeInsets(top: 7, leading: 12, bottom: 7, trailing: 12)
    button.configuration = configuration
    button.titleLabel?.font = .systemFont(ofSize: 14, weight: .bold)
    button.backgroundColor = selected ? tint : tint.withAlphaComponent(playing ? 0.24 : 0.12)
    button.layer.cornerRadius = 14
    button.layer.cornerCurve = .continuous
    button.layer.borderWidth = playing && !selected ? 1.25 : 0
    button.layer.borderColor = playing ? tint.withAlphaComponent(0.36).cgColor : UIColor.clear.cgColor
}

private func labToneColor(for tone: LabViewController.ResultTone) -> UIColor {
    switch tone {
    case .hint:
        return UIColor(red: 0.45, green: 0.47, blue: 0.53, alpha: 1)
    case .good:
        return UIColor(red: 0.16, green: 0.64, blue: 0.39, alpha: 1)
    case .okay:
        return UIColor(red: 0.89, green: 0.58, blue: 0.12, alpha: 1)
    case .bad:
        return UIColor(red: 0.79, green: 0.31, blue: 0.34, alpha: 1)
    case .warn:
        return UIColor(red: 0.79, green: 0.47, blue: 0.11, alpha: 1)
    }
}

private func labAdvancedToneColor(for status: LabAdvancedWordStatus) -> UIColor {
    switch status {
    case .ok:
        return UIColor(red: 0.16, green: 0.64, blue: 0.39, alpha: 1)
    case .wrong, .issue:
        return UIColor(red: 0.89, green: 0.58, blue: 0.12, alpha: 1)
    case .missing, .extra:
        return UIColor(red: 0.79, green: 0.31, blue: 0.34, alpha: 1)
    case .unknown:
        return UIColor(red: 0.45, green: 0.47, blue: 0.53, alpha: 1)
    }
}

private func labAdvancedErrorDisplayText(_ value: String) -> String {
    let normalized = value.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !normalized.isEmpty else { return "—" }
    switch normalized.lowercased() {
    case "none":
        return "None"
    case "mispronunciation":
        return "Mispronunciation"
    case "omission":
        return "Omission"
    case "insertion":
        return "Insertion"
    case "missingbreak":
        return "Missing break"
    case "unexpectedbreak":
        return "Unexpected break"
    default:
        return normalized
    }
}

private func labTokenizeWords(_ text: String) -> [(original: String, normalized: String)] {
    text
        .split(whereSeparator: \.isWhitespace)
        .map { token in
            let original = String(token)
            let normalized = original
                .lowercased()
                .replacingOccurrences(of: "[^a-z0-9\\u00c0-\\u024f]", with: "", options: .regularExpression)
            return (original, normalized)
        }
        .filter { !$0.original.isEmpty }
}

private func labMatchedTokenIndexes(lhs: [String], rhs: [String]) -> (lhs: Set<Int>, rhs: Set<Int>) {
    guard !lhs.isEmpty, !rhs.isEmpty else { return ([], []) }
    let rows = lhs.count + 1
    let cols = rhs.count + 1
    var matrix = Array(repeating: Array(repeating: 0, count: cols), count: rows)

    for row in 1 ..< rows {
        for col in 1 ..< cols {
            if lhs[row - 1] == rhs[col - 1], !lhs[row - 1].isEmpty {
                matrix[row][col] = matrix[row - 1][col - 1] + 1
            } else {
                matrix[row][col] = max(matrix[row - 1][col], matrix[row][col - 1])
            }
        }
    }

    var lhsMatches = Set<Int>()
    var rhsMatches = Set<Int>()
    var row = lhs.count
    var col = rhs.count
    while row > 0 && col > 0 {
        if lhs[row - 1] == rhs[col - 1], !lhs[row - 1].isEmpty {
            lhsMatches.insert(row - 1)
            rhsMatches.insert(col - 1)
            row -= 1
            col -= 1
        } else if matrix[row - 1][col] >= matrix[row][col - 1] {
            row -= 1
        } else {
            col -= 1
        }
    }
    return (lhsMatches, rhsMatches)
}

private func labSavedPhraseMetadata(_ phrase: LabSavedPhrase) -> String {
    let formatter = DateFormatter()
    formatter.dateStyle = .medium
    formatter.timeStyle = .short
    let savedText = formatter.string(from: Date(timeIntervalSince1970: phrase.updatedAt))
    let lastUsedText = phrase.lastPracticedAt > 0
        ? formatter.string(from: Date(timeIntervalSince1970: phrase.lastPracticedAt))
        : "—"
    return "Saved: \(savedText) • Last used: \(lastUsedText) • Uses: \(phrase.useCount)"
}

private func labDetailCard(title: String, value: String) -> UIView {
    let card = UIView()
    card.translatesAutoresizingMaskIntoConstraints = false
    card.backgroundColor = .white
    card.layer.cornerRadius = 20
    card.layer.cornerCurve = .continuous
    card.layer.borderWidth = 1
    card.layer.borderColor = labSurfaceBorderColor().cgColor
    card.layer.shadowColor = labSurfaceShadowColor().cgColor
    card.layer.shadowOpacity = 1
    card.layer.shadowRadius = 10
    card.layer.shadowOffset = CGSize(width: 0, height: 4)

    let stack = UIStackView()
    stack.translatesAutoresizingMaskIntoConstraints = false
    stack.axis = .vertical
    stack.spacing = 10
    card.addSubview(stack)
    labPin(stack, to: card, insets: UIEdgeInsets(top: 18, left: 18, bottom: 18, right: 18))

    let titleLabel = UILabel()
    titleLabel.font = .systemFont(ofSize: 13, weight: .bold)
    titleLabel.textColor = labSecondaryTextColor()
    titleLabel.text = title

    let valueLabel = UILabel()
    valueLabel.font = .systemFont(ofSize: 16, weight: .medium)
    valueLabel.textColor = labPrimaryTextColor()
    valueLabel.numberOfLines = 0
    valueLabel.text = value

    stack.addArrangedSubview(titleLabel)
    stack.addArrangedSubview(valueLabel)
    return card
}

private func labDetailSummaryCard(copy: AppCopy, scorePercent: Int?, advancedAssessment: LabAdvancedAssessment?) -> UIView? {
    var metrics: [(title: String, value: String, tint: UIColor)] = []
    if let scorePercent {
        metrics.append(("Score", "\(scorePercent)%", RootScreen.lab.theme.tint))
    }
    if let advancedAssessment {
        if let overall = advancedAssessment.scores.overall {
            metrics.append((copy.freeRide.overall, "\(Int(overall.rounded()))%", UIColor.systemGreen))
        }
        if let accuracy = advancedAssessment.scores.accuracy {
            metrics.append((copy.freeRide.accuracy, "\(Int(accuracy.rounded()))%", UIColor.systemBlue))
        }
        if let fluency = advancedAssessment.scores.fluency {
            metrics.append((copy.freeRide.fluency, "\(Int(fluency.rounded()))%", UIColor.systemIndigo))
        }
        if let completeness = advancedAssessment.scores.completeness {
            metrics.append((copy.freeRide.completeness, "\(Int(completeness.rounded()))%", UIColor.systemOrange))
        }
        if let prosody = advancedAssessment.scores.prosody {
            metrics.append(("Prosody", "\(Int(prosody.rounded()))%", UIColor.systemPink))
        }
    }

    guard !metrics.isEmpty || advancedAssessment != nil else { return nil }

    let card = UIView()
    card.translatesAutoresizingMaskIntoConstraints = false
    card.backgroundColor = .white
    card.layer.cornerRadius = 20
    card.layer.cornerCurve = .continuous
    card.layer.borderWidth = 1
    card.layer.borderColor = labSurfaceBorderColor().cgColor

    let stack = UIStackView()
    stack.translatesAutoresizingMaskIntoConstraints = false
    stack.axis = .vertical
    stack.spacing = 14
    card.addSubview(stack)
    labPin(stack, to: card, insets: UIEdgeInsets(top: 18, left: 18, bottom: 18, right: 18))

    let titleLabel = UILabel()
    titleLabel.font = .systemFont(ofSize: 13, weight: .bold)
    titleLabel.textColor = labSecondaryTextColor()
    titleLabel.text = advancedAssessment == nil ? "Practice Summary" : copy.freeRide.advanced
    stack.addArrangedSubview(titleLabel)

    if let advancedAssessment {
        let subtitleLabel = UILabel()
        subtitleLabel.font = .systemFont(ofSize: 22, weight: .bold)
        subtitleLabel.textColor = labPrimaryTextColor()
        subtitleLabel.numberOfLines = 0
        subtitleLabel.text = advancedAssessment.summaryText
        stack.addArrangedSubview(subtitleLabel)
    }

    if !metrics.isEmpty {
        stack.addArrangedSubview(labMetricGrid(metrics))
    }

    return card
}

private func labMetricGrid(_ metrics: [(title: String, value: String, tint: UIColor)]) -> UIView {
    let wrapper = UIStackView()
    wrapper.translatesAutoresizingMaskIntoConstraints = false
    wrapper.axis = .vertical
    wrapper.spacing = 10

    var index = 0
    while index < metrics.count {
        let row = UIStackView()
        row.translatesAutoresizingMaskIntoConstraints = false
        row.axis = .horizontal
        row.spacing = 10
        row.distribution = .fillEqually

        let first = labMetricPill(title: metrics[index].title, value: metrics[index].value, tint: metrics[index].tint)
        row.addArrangedSubview(first)

        if index + 1 < metrics.count {
            let second = labMetricPill(
                title: metrics[index + 1].title,
                value: metrics[index + 1].value,
                tint: metrics[index + 1].tint
            )
            row.addArrangedSubview(second)
        } else {
            let spacer = UIView()
            spacer.translatesAutoresizingMaskIntoConstraints = false
            row.addArrangedSubview(spacer)
        }

        wrapper.addArrangedSubview(row)
        index += 2
    }

    return wrapper
}

private func labMetricPill(title: String, value: String, tint: UIColor) -> UIView {
    let pill = UIView()
    pill.translatesAutoresizingMaskIntoConstraints = false
    pill.backgroundColor = tint.withAlphaComponent(0.08)
    pill.layer.cornerRadius = 18
    pill.layer.cornerCurve = .continuous
    pill.layer.borderWidth = 1
    pill.layer.borderColor = tint.withAlphaComponent(0.18).cgColor

    let stack = UIStackView()
    stack.translatesAutoresizingMaskIntoConstraints = false
    stack.axis = .vertical
    stack.spacing = 4
    pill.addSubview(stack)
    labPin(stack, to: pill, insets: UIEdgeInsets(top: 12, left: 12, bottom: 12, right: 12))

    let valueLabel = UILabel()
    valueLabel.font = .systemFont(ofSize: 18, weight: .bold)
    valueLabel.textColor = tint
    valueLabel.text = value

    let titleLabel = UILabel()
    titleLabel.font = .systemFont(ofSize: 12, weight: .semibold)
    titleLabel.textColor = labSecondaryTextColor()
    titleLabel.text = title
    titleLabel.numberOfLines = 2

    stack.addArrangedSubview(valueLabel)
    stack.addArrangedSubview(titleLabel)
    return pill
}

private func labAdvancedWordsSection(title: String, words: [LabAdvancedWord]) -> UIView {
    let card = UIView()
    card.translatesAutoresizingMaskIntoConstraints = false
    card.backgroundColor = .white
    card.layer.cornerRadius = 20
    card.layer.cornerCurve = .continuous
    card.layer.borderWidth = 1
    card.layer.borderColor = labSurfaceBorderColor().cgColor
    card.layer.shadowColor = labSurfaceShadowColor().cgColor
    card.layer.shadowOpacity = 1
    card.layer.shadowRadius = 10
    card.layer.shadowOffset = CGSize(width: 0, height: 4)

    let stack = UIStackView()
    stack.translatesAutoresizingMaskIntoConstraints = false
    stack.axis = .vertical
    stack.spacing = 12
    card.addSubview(stack)
    labPin(stack, to: card, insets: UIEdgeInsets(top: 18, left: 18, bottom: 18, right: 18))

    let titleLabel = UILabel()
    titleLabel.font = .systemFont(ofSize: 13, weight: .bold)
    titleLabel.textColor = labSecondaryTextColor()
    titleLabel.text = title
    stack.addArrangedSubview(titleLabel)

    for (index, word) in words.enumerated() {
        stack.addArrangedSubview(labAdvancedWordBreakdownCard(index: index, word: word))
    }

    return card
}

private func labAdvancedWordBreakdownCard(index: Int, word: LabAdvancedWord) -> UIView {
    let tint = labAdvancedToneColor(for: word.status)
    let card = UIView()
    card.translatesAutoresizingMaskIntoConstraints = false
    card.backgroundColor = tint.withAlphaComponent(0.08)
    card.layer.cornerRadius = 18
    card.layer.cornerCurve = .continuous
    card.layer.borderWidth = 1
    card.layer.borderColor = tint.withAlphaComponent(0.14).cgColor

    let stack = UIStackView()
    stack.translatesAutoresizingMaskIntoConstraints = false
    stack.axis = .vertical
    stack.spacing = 8
    card.addSubview(stack)
    labPin(stack, to: card, insets: UIEdgeInsets(top: 14, left: 14, bottom: 14, right: 14))

    let titleLabel = UILabel()
    titleLabel.font = .systemFont(ofSize: 15, weight: .bold)
    titleLabel.textColor = labPrimaryTextColor()
    titleLabel.numberOfLines = 0
    titleLabel.text = "\(index + 1). \(word.expected.isEmpty ? "—" : word.expected)"

    let statusLabel = PaddingLabel()
    statusLabel.font = .systemFont(ofSize: 12, weight: .bold)
    statusLabel.textColor = tint
    statusLabel.backgroundColor = .white
    statusLabel.layer.cornerRadius = 12
    statusLabel.clipsToBounds = true
    statusLabel.contentInsets = UIEdgeInsets(top: 5, left: 9, bottom: 5, right: 9)
    statusLabel.text = word.status.label

    let topRow = UIStackView()
    topRow.translatesAutoresizingMaskIntoConstraints = false
    topRow.axis = .horizontal
    topRow.spacing = 8
    topRow.alignment = .center
    topRow.addArrangedSubview(titleLabel)
    topRow.addArrangedSubview(statusLabel)
    titleLabel.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
    statusLabel.setContentCompressionResistancePriority(.required, for: .horizontal)
    stack.addArrangedSubview(topRow)

    let detailLabel = UILabel()
    detailLabel.font = .systemFont(ofSize: 13, weight: .semibold)
    detailLabel.textColor = labSecondaryTextColor()
    detailLabel.numberOfLines = 0
    detailLabel.text = [
        word.score.map { "Score \($0)%" } ?? "Score —",
        "Recorded \(word.recognized.isEmpty ? "—" : word.recognized)",
        "Error \(labAdvancedErrorDisplayText(word.errorType))",
        "Duration \(word.durationText)"
    ].joined(separator: " · ")
    stack.addArrangedSubview(detailLabel)

    if !word.phonemes.isEmpty {
        let phonemesLabel = UILabel()
        phonemesLabel.font = .systemFont(ofSize: 12, weight: .medium)
        phonemesLabel.textColor = tint.withAlphaComponent(0.92)
        phonemesLabel.numberOfLines = 0
        phonemesLabel.text = word.phonemeSummary
        stack.addArrangedSubview(phonemesLabel)
    }

    return card
}

private func labDisplayablePhonemes(for word: LabAdvancedWord) -> [LabAdvancedPhoneme] {
    guard word.status != .missing, word.status != .extra, word.score != nil else { return [] }
    return word.phonemes
        .filter { $0.score != nil }
        .sorted { lhs, rhs in
            let lhsHasOffset = lhs.offsetMs != nil
            let rhsHasOffset = rhs.offsetMs != nil
            if let lhsOffset = lhs.offsetMs, let rhsOffset = rhs.offsetMs, lhsOffset != rhsOffset {
                return lhsOffset < rhsOffset
            }
            if lhsHasOffset != rhsHasOffset {
                return lhsHasOffset
            }
            return lhs.phoneme.localizedCaseInsensitiveCompare(rhs.phoneme) == .orderedAscending
        }
}

private func labMakeAdvancedPhonemeChip(text: String, tint: UIColor) -> PaddingLabel {
    let label = PaddingLabel()
    label.translatesAutoresizingMaskIntoConstraints = false
    label.font = .systemFont(ofSize: 12, weight: .bold)
    label.textColor = labSecondaryTextColor()
    label.backgroundColor = .white
    label.layer.cornerRadius = 12
    label.layer.cornerCurve = .continuous
    label.layer.borderWidth = 1
    label.layer.borderColor = labSurfaceBorderColor().cgColor
    label.clipsToBounds = true
    label.contentInsets = UIEdgeInsets(top: 6, left: 10, bottom: 6, right: 10)
    label.text = text
    return label
}

private func labAdvancedPhonemeDisplayText(_ phoneme: LabAdvancedPhoneme) -> String {
    let arpa = phoneme.phoneme.trimmingCharacters(in: .whitespacesAndNewlines)
    let ipa = labAzurePhonemeIpaMap[arpa.lowercased()]
    let phonemeText = ipa.map { "\(arpa)/\($0)/" } ?? arpa
    if let score = phoneme.score {
        return "\(phonemeText) \(score)%"
    }
    return phonemeText
}

private func labLoadMascotTalkFrames() -> [UIImage] {
    (0 ... 7).compactMap { index in
        UIImage(named: String(format: "MascotTalk%02d", index))
    }
}

private func labTimedWordSegments(for text: String, duration: TimeInterval) -> [LabPlaybackWordSegment] {
    let tokens = labTokenizeWords(text)
    guard !tokens.isEmpty else { return [] }

    let effectiveDuration = duration > 0 ? duration : max(Double(tokens.count) * 0.38, 0.38)
    let weights = tokens.map { token in
        max(1.0, Double(token.normalized.count))
    }
    let totalWeight = max(weights.reduce(0, +), 1)
    var elapsed: TimeInterval = 0

    return weights.enumerated().map { index, weight in
        let slice = effectiveDuration * (weight / totalWeight)
        let segment = LabPlaybackWordSegment(
            wordIndex: index,
            startTime: elapsed,
            endTime: index == weights.count - 1 ? effectiveDuration : min(effectiveDuration, elapsed + slice)
        )
        elapsed = segment.endTime
        return segment
    }
}

private func labWordIndex(in text: String, for range: NSRange) -> Int? {
    let ranges = labWordCharacterRanges(in: text)
    guard !ranges.isEmpty else { return nil }
    guard let swiftRange = Range(range, in: text) else { return nil }
    let startOffset = text.distance(from: text.startIndex, to: swiftRange.lowerBound)
    let endOffset = text.distance(from: text.startIndex, to: swiftRange.upperBound)

    for (index, wordRange) in ranges.enumerated() {
        let wordStart = text.distance(from: text.startIndex, to: wordRange.lowerBound)
        let wordEnd = text.distance(from: text.startIndex, to: wordRange.upperBound)
        if startOffset < wordEnd && endOffset > wordStart {
            return index
        }
    }

    return nil
}

private func labWordCharacterRanges(in text: String) -> [Range<String.Index>] {
    var ranges: [Range<String.Index>] = []
    var currentStart: String.Index?
    var cursor = text.startIndex

    while cursor < text.endIndex {
        if text[cursor].isWhitespace {
            if let start = currentStart {
                ranges.append(start ..< cursor)
                currentStart = nil
            }
        } else if currentStart == nil {
            currentStart = cursor
        }
        cursor = text.index(after: cursor)
    }

    if let start = currentStart {
        ranges.append(start ..< text.endIndex)
    }

    return ranges
}

private func labAudioDuration(for url: URL) -> Double {
    guard let file = try? AVAudioFile(forReading: url) else { return 0 }
    let format = file.processingFormat
    guard format.sampleRate > 0 else { return 0 }
    return Double(file.length) / format.sampleRate
}

private func labSurfaceBorderColor() -> UIColor {
    UIColor(red: 0.86, green: 0.89, blue: 0.94, alpha: 1)
}

private func labSurfaceShadowColor() -> UIColor {
    UIColor.black.withAlphaComponent(0.05)
}

private func labPrimaryTextColor() -> UIColor {
    UIColor(red: 0.06, green: 0.09, blue: 0.12, alpha: 1)
}

private func labSecondaryTextColor() -> UIColor {
    UIColor(red: 0.39, green: 0.45, blue: 0.55, alpha: 1)
}

private func labString(_ value: Any?) -> String {
    switch value {
    case let string as String:
        return string.trimmingCharacters(in: .whitespacesAndNewlines)
    case let number as NSNumber:
        return number.stringValue
    default:
        return ""
    }
}

private func labFirstNonEmptyString(_ values: [String]) -> String {
    values
        .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
        .first { !$0.isEmpty } ?? ""
}

private func labDouble(_ value: Any?) -> Double? {
    switch value {
    case let double as Double:
        return double
    case let float as Float:
        return Double(float)
    case let number as NSNumber:
        return number.doubleValue
    case let string as String:
        return Double(string)
    default:
        return nil
    }
}

private func labBool(_ value: Any?) -> Bool? {
    switch value {
    case let value as Bool:
        return value
    case let number as NSNumber:
        return number.boolValue
    case let string as String:
        let normalized = string.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if ["1", "true", "yes", "ok"].contains(normalized) { return true }
        if ["0", "false", "no"].contains(normalized) { return false }
        return nil
    default:
        return nil
    }
}

private extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
