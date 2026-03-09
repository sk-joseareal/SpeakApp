import UIKit

final class PlaceholderScreenViewController: UIViewController {
    private let screen: RootScreen
    private let sessionStore: AppSessionStore
    private let session: AppSession
    private let copy: AppCopy

    init(screen: RootScreen, sessionStore: AppSessionStore, session: AppSession, copy: AppCopy) {
        self.screen = screen
        self.sessionStore = sessionStore
        self.session = session
        self.copy = copy
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = screen.theme.background
        configureNavigationBar()
        buildLayout()
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        navigationController?.navigationBar.tintColor = screen.theme.tint
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
        if session.isAuthenticated {
            let logoutButton = UIBarButtonItem(
                image: UIImage(systemName: "rectangle.portrait.and.arrow.right"),
                primaryAction: UIAction(title: copy.native.logoutButton) { [weak self] _ in
                    self?.sessionStore.logout()
                }
            )
            navigationItem.rightBarButtonItems = [logoutButton, notificationsButton]
        } else {
            navigationItem.rightBarButtonItem = notificationsButton
        }
    }

    private func buildLayout() {
        let scrollView = UIScrollView()
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.alwaysBounceVertical = true

        let contentStack = UIStackView()
        contentStack.translatesAutoresizingMaskIntoConstraints = false
        contentStack.axis = .vertical
        contentStack.spacing = 18

        view.addSubview(scrollView)
        scrollView.addSubview(contentStack)

        NSLayoutConstraint.activate([
            scrollView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor),

            contentStack.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor, constant: 20),
            contentStack.leadingAnchor.constraint(equalTo: scrollView.frameLayoutGuide.leadingAnchor, constant: 20),
            contentStack.trailingAnchor.constraint(equalTo: scrollView.frameLayoutGuide.trailingAnchor, constant: -20),
            contentStack.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor, constant: -28)
        ])

        contentStack.addArrangedSubview(makeHeroCard())
        contentStack.addArrangedSubview(makeContextCard())
        contentStack.addArrangedSubview(makeHighlightsCard())
    }

    private func makeHeroCard() -> UIView {
        let screenCopy = copy.screenCopy(for: screen)
        let theme = screen.theme

        let card = makeCard(backgroundColor: .white)
        let stack = makeStack(spacing: 14)
        card.addSubview(stack)
        pin(stack, to: card, insets: UIEdgeInsets(top: 22, left: 22, bottom: 22, right: 22))

        let eyebrow = makePill(text: screenCopy.eyebrow, color: theme.tint)
        let titleLabel = makeLabel(text: screenCopy.title, style: .largeTitle)
        titleLabel.font = .systemFont(ofSize: 30, weight: .bold)

        let messageLabel = makeBodyLabel(screenCopy.message)
        let subtitleLabel = makeSecondaryLabel(placeholderSubtitleText())
        let callout = makeCallout(text: screenCopy.callout, tint: theme.tint, fill: theme.accent)

        let imageRow = UIStackView()
        imageRow.axis = .horizontal
        imageRow.spacing = 16
        imageRow.alignment = .center

        let previewCard = UIView()
        previewCard.backgroundColor = theme.accent
        previewCard.layer.cornerRadius = 24
        previewCard.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            previewCard.heightAnchor.constraint(equalToConstant: 164)
        ])

        let heroImage = UIImageView(image: UIImage(named: screenCopy.asset) ?? UIImage(systemName: screen.symbolName))
        heroImage.translatesAutoresizingMaskIntoConstraints = false
        heroImage.contentMode = .scaleAspectFit
        heroImage.tintColor = theme.tint

        previewCard.addSubview(heroImage)
        NSLayoutConstraint.activate([
            heroImage.centerXAnchor.constraint(equalTo: previewCard.centerXAnchor),
            heroImage.centerYAnchor.constraint(equalTo: previewCard.centerYAnchor),
            heroImage.widthAnchor.constraint(lessThanOrEqualToConstant: 140),
            heroImage.heightAnchor.constraint(lessThanOrEqualToConstant: 140),
            heroImage.leadingAnchor.constraint(greaterThanOrEqualTo: previewCard.leadingAnchor, constant: 16),
            heroImage.trailingAnchor.constraint(lessThanOrEqualTo: previewCard.trailingAnchor, constant: -16),
            heroImage.topAnchor.constraint(greaterThanOrEqualTo: previewCard.topAnchor, constant: 16),
            heroImage.bottomAnchor.constraint(lessThanOrEqualTo: previewCard.bottomAnchor, constant: -16)
        ])

        let detailStack = makeStack(spacing: 12)
        detailStack.alignment = .leading
        detailStack.addArrangedSubview(makeMetaBadge(text: copy.tabTitle(for: screen), tint: theme.tint))
        detailStack.addArrangedSubview(makeMetaBadge(text: session.preferredLanguageCode, tint: theme.tint))
        detailStack.addArrangedSubview(makeMetaBadge(text: displayUserLabel(copy: copy, session: session), tint: theme.tint))

        imageRow.addArrangedSubview(previewCard)
        imageRow.addArrangedSubview(detailStack)

        previewCard.widthAnchor.constraint(equalTo: imageRow.widthAnchor, multiplier: 0.58).isActive = true

        stack.addArrangedSubview(eyebrow)
        stack.addArrangedSubview(titleLabel)
        stack.addArrangedSubview(messageLabel)
        stack.addArrangedSubview(subtitleLabel)
        stack.addArrangedSubview(callout)
        stack.addArrangedSubview(imageRow)

        return card
    }

    private func makeContextCard() -> UIView {
        let card = makeCard(backgroundColor: .white)
        let stack = makeStack(spacing: 16)
        card.addSubview(stack)
        pin(stack, to: card, insets: UIEdgeInsets(top: 20, left: 20, bottom: 20, right: 20))

        let titleLabel = makeLabel(text: copy.home.planTitle, style: .title2)
        titleLabel.font = .systemFont(ofSize: 22, weight: .bold)

        let row = UIStackView()
        row.axis = .horizontal
        row.spacing = 10
        row.distribution = .fillEqually

        row.addArrangedSubview(makeMetricTile(title: copy.native.sessionUserLabel, value: displayUserLabel(copy: copy, session: session), tint: screen.theme.tint))
        row.addArrangedSubview(makeMetricTile(title: copy.native.sessionLocaleLabel, value: session.locale.rawValue.uppercased(), tint: screen.theme.tint))
        row.addArrangedSubview(makeMetricTile(title: copy.native.sessionPlanLabel, value: session.planName, tint: screen.theme.tint))

        stack.addArrangedSubview(titleLabel)
        stack.addArrangedSubview(row)
        return card
    }

    private func makeHighlightsCard() -> UIView {
        let screenCopy = copy.screenCopy(for: screen)
        let card = makeCard(backgroundColor: .white)
        let stack = makeStack(spacing: 12)
        card.addSubview(stack)
        pin(stack, to: card, insets: UIEdgeInsets(top: 20, left: 20, bottom: 20, right: 20))

        let titleLabel = makeLabel(text: screenCopy.title, style: .title2)
        titleLabel.font = .systemFont(ofSize: 22, weight: .bold)
        stack.addArrangedSubview(titleLabel)

        for item in screenCopy.highlights {
            let row = UIStackView()
            row.axis = .horizontal
            row.spacing = 12
            row.alignment = .center

            let icon = UIImageView(image: UIImage(systemName: "sparkles"))
            icon.tintColor = screen.theme.tint
            icon.translatesAutoresizingMaskIntoConstraints = false
            NSLayoutConstraint.activate([
                icon.widthAnchor.constraint(equalToConstant: 18),
                icon.heightAnchor.constraint(equalToConstant: 18)
            ])

            let label = makeBodyLabel(item)
            row.addArrangedSubview(icon)
            row.addArrangedSubview(label)
            stack.addArrangedSubview(row)
        }

        return card
    }

    private func presentNotifications() {
        let controller = NotificationsViewController(copy: copy)
        presentInSheet(controller)
    }

    private func presentDiagnostics() {
        let controller = DiagnosticsViewController(session: session, copy: copy)
        presentInSheet(controller)
    }

    private func placeholderSubtitleText() -> String {
        if screen == .you, session.isAuthenticated {
            return session.user?.displayName ?? displayUserLabel(copy: copy, session: session)
        }
        return copy.placeholderSubtitle(for: screen)
    }
}

final class LoggedOutProfileViewController: UIViewController {
    private let sessionStore: AppSessionStore
    private let copy: AppCopy
    private let session: AppSession
    private let theme = RootScreen.you.theme

    init(sessionStore: AppSessionStore, copy: AppCopy) {
        self.sessionStore = sessionStore
        self.copy = copy
        self.session = sessionStore.session
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = theme.background
        configureNavigationBar()
        buildLayout()
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
        navigationItem.rightBarButtonItem = UIBarButtonItem(
            image: UIImage(systemName: "bell.badge"),
            primaryAction: UIAction(title: copy.native.notificationsButton) { [weak self] _ in
                self?.presentNotifications()
            }
        )
    }

    private func buildLayout() {
        let scrollView = UIScrollView()
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.alwaysBounceVertical = true

        let stack = makeStack(spacing: 18)
        view.addSubview(scrollView)
        scrollView.addSubview(stack)

        NSLayoutConstraint.activate([
            scrollView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor),

            stack.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor, constant: 20),
            stack.leadingAnchor.constraint(equalTo: scrollView.frameLayoutGuide.leadingAnchor, constant: 20),
            stack.trailingAnchor.constraint(equalTo: scrollView.frameLayoutGuide.trailingAnchor, constant: -20),
            stack.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor, constant: -28)
        ])

        stack.addArrangedSubview(makeHeroCard())
        stack.addArrangedSubview(makeLockedTabsCard())
    }

    private func makeHeroCard() -> UIView {
        let card = makeCard(backgroundColor: .white)
        let stack = makeStack(spacing: 16)
        card.addSubview(stack)
        pin(stack, to: card, insets: UIEdgeInsets(top: 22, left: 22, bottom: 22, right: 22))

        let heroRow = UIStackView()
        heroRow.axis = .horizontal
        heroRow.spacing = 16
        heroRow.alignment = .center

        let previewCard = UIView()
        previewCard.translatesAutoresizingMaskIntoConstraints = false
        previewCard.backgroundColor = theme.accent
        previewCard.layer.cornerRadius = 24
        NSLayoutConstraint.activate([
            previewCard.widthAnchor.constraint(equalToConstant: 132),
            previewCard.heightAnchor.constraint(equalToConstant: 152)
        ])

        let mascot = UIImageView(image: UIImage(named: "Mascot") ?? UIImage(systemName: RootScreen.you.symbolName))
        mascot.translatesAutoresizingMaskIntoConstraints = false
        mascot.contentMode = .scaleAspectFit
        mascot.tintColor = theme.tint
        previewCard.addSubview(mascot)
        NSLayoutConstraint.activate([
            mascot.centerXAnchor.constraint(equalTo: previewCard.centerXAnchor),
            mascot.centerYAnchor.constraint(equalTo: previewCard.centerYAnchor),
            mascot.widthAnchor.constraint(lessThanOrEqualToConstant: 104),
            mascot.heightAnchor.constraint(lessThanOrEqualToConstant: 104),
            mascot.leadingAnchor.constraint(greaterThanOrEqualTo: previewCard.leadingAnchor, constant: 16),
            mascot.trailingAnchor.constraint(lessThanOrEqualTo: previewCard.trailingAnchor, constant: -16),
            mascot.topAnchor.constraint(greaterThanOrEqualTo: previewCard.topAnchor, constant: 16),
            mascot.bottomAnchor.constraint(lessThanOrEqualTo: previewCard.bottomAnchor, constant: -16)
        ])

        let detailStack = makeStack(spacing: 12)
        detailStack.alignment = .leading
        detailStack.addArrangedSubview(makePill(text: copy.profile.accessPill, color: theme.tint))
        detailStack.addArrangedSubview(makeBodyLabel(copy.profile.loginTitle))
        detailStack.addArrangedSubview(makeSecondaryLabel(copy.profile.loginSubtitle))

        heroRow.addArrangedSubview(previewCard)
        heroRow.addArrangedSubview(detailStack)

        let titleLabel = makeLabel(text: copy.profile.loginTitle, style: .largeTitle)
        titleLabel.font = .systemFont(ofSize: 32, weight: .bold)

        let subtitleLabel = makeSecondaryLabel(copy.profile.loginSubtitle)
        let button = makePrimaryButton(title: copy.profile.loginCta, tint: theme.tint)
        button.addAction(UIAction { [weak self] _ in
            self?.presentLogin()
        }, for: .touchUpInside)

        stack.addArrangedSubview(titleLabel)
        stack.addArrangedSubview(subtitleLabel)
        stack.addArrangedSubview(heroRow)
        stack.addArrangedSubview(button)
        return card
    }

    private func makeLockedTabsCard() -> UIView {
        let card = makeCard(backgroundColor: .white)
        let stack = makeStack(spacing: 12)
        card.addSubview(stack)
        pin(stack, to: card, insets: UIEdgeInsets(top: 20, left: 20, bottom: 20, right: 20))

        let titleLabel = makeLabel(text: copy.chat.loginRequired, style: .title2)
        titleLabel.font = .systemFont(ofSize: 22, weight: .bold)
        stack.addArrangedSubview(titleLabel)

        let subtitleLabel = makeSecondaryLabel(copy.chat.coachChatbotSubtitle)
        stack.addArrangedSubview(subtitleLabel)

        for screen in [RootScreen.training, .lab, .reference, .chat] {
            let row = UIStackView()
            row.axis = .horizontal
            row.spacing = 12
            row.alignment = .center

            let icon = UIImageView(image: UIImage(systemName: "lock.fill"))
            icon.tintColor = theme.tint
            icon.translatesAutoresizingMaskIntoConstraints = false
            NSLayoutConstraint.activate([
                icon.widthAnchor.constraint(equalToConstant: 18),
                icon.heightAnchor.constraint(equalToConstant: 18)
            ])

            let label = makeBodyLabel(copy.tabTitle(for: screen))
            row.addArrangedSubview(icon)
            row.addArrangedSubview(label)
            stack.addArrangedSubview(row)
        }

        return card
    }

    private func presentLogin() {
        let controller = LoginViewController(sessionStore: sessionStore, copy: copy)
        let navigationController = UINavigationController(rootViewController: controller)
        if let sheet = navigationController.sheetPresentationController {
            sheet.detents = [.large()]
            sheet.prefersGrabberVisible = true
        }
        present(navigationController, animated: true)
    }

    private func presentNotifications() {
        let controller = NotificationsViewController(copy: copy)
        presentInSheet(controller)
    }

    private func presentDiagnostics() {
        let controller = DiagnosticsViewController(session: session, copy: copy)
        presentInSheet(controller)
    }
}

final class ProfileViewController: UIViewController {
    private let sessionStore: AppSessionStore
    private let copy: AppCopy
    private let theme = RootScreen.you.theme

    private var session: AppSession {
        sessionStore.session
    }

    init(sessionStore: AppSessionStore, copy: AppCopy) {
        self.sessionStore = sessionStore
        self.copy = copy
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = theme.background
        configureNavigationBar()
        buildLayout()
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
        let scrollView = UIScrollView()
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.alwaysBounceVertical = true

        let stack = makeStack(spacing: 18)
        view.addSubview(scrollView)
        scrollView.addSubview(stack)

        NSLayoutConstraint.activate([
            scrollView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor),

            stack.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor, constant: 20),
            stack.leadingAnchor.constraint(equalTo: scrollView.frameLayoutGuide.leadingAnchor, constant: 20),
            stack.trailingAnchor.constraint(equalTo: scrollView.frameLayoutGuide.trailingAnchor, constant: -20),
            stack.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor, constant: -28)
        ])

        stack.addArrangedSubview(makeHeroCard())
        stack.addArrangedSubview(makeAccountCard())
        stack.addArrangedSubview(makeRewardsCard())
        stack.addArrangedSubview(makeHighlightsCard())
    }

    private func makeHeroCard() -> UIView {
        let card = makeCard(backgroundColor: .white)
        let stack = makeStack(spacing: 14)
        stack.alignment = .center
        card.addSubview(stack)
        pin(stack, to: card, insets: UIEdgeInsets(top: 26, left: 22, bottom: 26, right: 22))

        let avatarView = UserAvatarView(size: 112, tint: theme.tint)
        avatarView.configure(with: session.user)

        let eyebrow = makePill(text: copy.profile.tabPrefs, color: theme.tint)

        let titleLabel = makeLabel(
            text: session.user?.resolvedDisplayName ?? displayUserLabel(copy: copy, session: session),
            style: .largeTitle
        )
        titleLabel.font = .systemFont(ofSize: 30, weight: .bold)
        titleLabel.textAlignment = .center

        let subtitleLabel = makeSecondaryLabel(session.user?.email ?? "")
        subtitleLabel.textAlignment = .center
        subtitleLabel.isHidden = subtitleLabel.text?.isEmpty ?? true

        stack.addArrangedSubview(avatarView)
        stack.addArrangedSubview(eyebrow)
        stack.addArrangedSubview(titleLabel)
        stack.addArrangedSubview(subtitleLabel)

        if !session.rewards.isEmpty {
            stack.addArrangedSubview(makeRewardBadgesRow(rewards: session.rewards, tint: theme.tint, compact: false))
        }

        return card
    }

    private func makeAccountCard() -> UIView {
        let card = makeCard(backgroundColor: .white)
        let stack = makeStack(spacing: 16)
        card.addSubview(stack)
        pin(stack, to: card, insets: UIEdgeInsets(top: 20, left: 20, bottom: 20, right: 20))

        let titleLabel = makeLabel(text: copy.home.planTitle, style: .title2)
        titleLabel.font = .systemFont(ofSize: 22, weight: .bold)

        let row = UIStackView()
        row.axis = .horizontal
        row.spacing = 10
        row.distribution = .fillEqually

        row.addArrangedSubview(
            makeMetricTile(
                title: copy.login.userLabel,
                value: session.user?.email ?? copy.profile.loginTitle,
                tint: theme.tint
            )
        )
        row.addArrangedSubview(
            makeMetricTile(
                title: copy.native.sessionPlanLabel,
                value: session.planName,
                tint: theme.tint
            )
        )

        stack.addArrangedSubview(titleLabel)
        stack.addArrangedSubview(row)
        return card
    }

    private func makeRewardsCard() -> UIView {
        let card = makeCard(backgroundColor: .white)
        let stack = makeStack(spacing: 14)
        card.addSubview(stack)
        pin(stack, to: card, insets: UIEdgeInsets(top: 20, left: 20, bottom: 20, right: 20))

        let titleLabel = makeLabel(text: copy.profile.rewardsTitle, style: .title2)
        titleLabel.font = .systemFont(ofSize: 22, weight: .bold)
        stack.addArrangedSubview(titleLabel)

        if session.rewards.isEmpty {
            stack.addArrangedSubview(makeSecondaryLabel(copy.profile.rewardsEmpty))
        } else {
            stack.addArrangedSubview(makeRewardBadgesRow(rewards: session.rewards, tint: theme.tint, compact: false))
        }

        return card
    }

    private func makeHighlightsCard() -> UIView {
        let screenCopy = copy.screenCopy(for: .you)
        let card = makeCard(backgroundColor: .white)
        let stack = makeStack(spacing: 12)
        card.addSubview(stack)
        pin(stack, to: card, insets: UIEdgeInsets(top: 20, left: 20, bottom: 20, right: 20))

        let titleLabel = makeLabel(text: screenCopy.title, style: .title2)
        titleLabel.font = .systemFont(ofSize: 22, weight: .bold)
        stack.addArrangedSubview(titleLabel)
        stack.addArrangedSubview(makeCallout(text: screenCopy.callout, tint: theme.tint, fill: theme.accent))

        for item in screenCopy.highlights {
            let row = UIStackView()
            row.axis = .horizontal
            row.spacing = 12
            row.alignment = .center

            let icon = UIImageView(image: UIImage(systemName: "sparkles"))
            icon.tintColor = theme.tint
            icon.translatesAutoresizingMaskIntoConstraints = false
            NSLayoutConstraint.activate([
                icon.widthAnchor.constraint(equalToConstant: 18),
                icon.heightAnchor.constraint(equalToConstant: 18)
            ])

            row.addArrangedSubview(icon)
            row.addArrangedSubview(makeBodyLabel(item))
            stack.addArrangedSubview(row)
        }

        return card
    }

    private func presentNotifications() {
        let controller = NotificationsViewController(copy: copy)
        presentInSheet(controller)
    }

    private func presentDiagnostics() {
        let controller = DiagnosticsViewController(session: session, copy: copy)
        presentInSheet(controller)
    }
}

final class LoginViewController: UIViewController, UITextFieldDelegate {
    private let sessionStore: AppSessionStore
    private let copy: AppCopy
    private let theme = RootScreen.you.theme

    private let scrollView = UIScrollView()
    private let contentStack = makeStack(spacing: 18)
    private let emailField = UITextField()
    private let passwordField = UITextField()
    private let errorLabel = UILabel()
    private let loadingIndicator = UIActivityIndicatorView(style: .medium)
    private lazy var submitButton = makePrimaryButton(title: copy.login.enter, tint: theme.tint)
    private var keyboardObservers: [NSObjectProtocol] = []
    private weak var activeField: UITextField?
    private var keyboardInset: CGFloat = 0

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
        keyboardObservers.forEach(NotificationCenter.default.removeObserver(_:))
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        title = copy.login.title
        view.backgroundColor = .systemGroupedBackground
        navigationItem.rightBarButtonItem = UIBarButtonItem(
            title: copy.login.close,
            style: .plain,
            target: self,
            action: #selector(handleClose)
        )
        buildLayout()
        observeKeyboardChanges()
    }

    private func buildLayout() {
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.alwaysBounceVertical = true
        scrollView.keyboardDismissMode = .interactive

        view.addSubview(scrollView)
        scrollView.addSubview(contentStack)

        NSLayoutConstraint.activate([
            scrollView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor),

            contentStack.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor, constant: 20),
            contentStack.leadingAnchor.constraint(equalTo: scrollView.frameLayoutGuide.leadingAnchor, constant: 20),
            contentStack.trailingAnchor.constraint(equalTo: scrollView.frameLayoutGuide.trailingAnchor, constant: -20),
            contentStack.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor, constant: -24)
        ])

        scrollView.contentInset = UIEdgeInsets(top: 0, left: 0, bottom: 24, right: 0)
        scrollView.verticalScrollIndicatorInsets = UIEdgeInsets(top: 0, left: 0, bottom: 8, right: 0)

        contentStack.addArrangedSubview(makeHeaderCard())
        contentStack.addArrangedSubview(makeLoginCard())
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
            },
            center.addObserver(
                forName: UIResponder.keyboardDidChangeFrameNotification,
                object: nil,
                queue: .main
            ) { [weak self] _ in
                self?.scrollActiveFieldIntoView(animated: true)
            }
        ]
    }

    private func makeHeaderCard() -> UIView {
        let card = makeCard(backgroundColor: .white)
        let stack = makeStack(spacing: 12)
        card.addSubview(stack)
        pin(stack, to: card, insets: UIEdgeInsets(top: 20, left: 20, bottom: 20, right: 20))

        let eyebrow = makePill(text: copy.profile.accessPill, color: theme.tint)
        let titleLabel = makeLabel(text: copy.login.title, style: .largeTitle)
        titleLabel.font = .systemFont(ofSize: 30, weight: .bold)
        let subtitleLabel = makeSecondaryLabel(copy.profile.loginSubtitle)

        stack.addArrangedSubview(eyebrow)
        stack.addArrangedSubview(titleLabel)
        stack.addArrangedSubview(subtitleLabel)
        return card
    }

    private func makeLoginCard() -> UIView {
        let card = makeCard(backgroundColor: .white)
        let stack = makeStack(spacing: 14)
        card.addSubview(stack)
        pin(stack, to: card, insets: UIEdgeInsets(top: 22, left: 22, bottom: 22, right: 22))

        stack.addArrangedSubview(makeSocialButton(title: copy.login.socialGoogle, systemImage: "globe"))
        stack.addArrangedSubview(makeSocialButton(title: copy.login.socialFacebook, systemImage: "person.2.circle"))
        stack.addArrangedSubview(makeSocialButton(title: copy.login.socialApple, systemImage: "apple.logo"))
        stack.addArrangedSubview(makeDisabledInlineButton(title: copy.login.createWithEmail))
        stack.addArrangedSubview(makeInputCard(label: copy.login.userLabel, placeholder: copy.login.userPlaceholder, textField: emailField, secure: false))
        stack.addArrangedSubview(makeInputCard(label: copy.login.passLabel, placeholder: copy.login.passPlaceholder, textField: passwordField, secure: true))

        errorLabel.font = .systemFont(ofSize: 14, weight: .medium)
        errorLabel.textColor = .systemRed
        errorLabel.numberOfLines = 0
        errorLabel.isHidden = true
        stack.addArrangedSubview(errorLabel)

        submitButton.addAction(UIAction { [weak self] _ in
            self?.handleLoginTap()
        }, for: .touchUpInside)
        stack.addArrangedSubview(submitButton)

        loadingIndicator.hidesWhenStopped = true
        stack.addArrangedSubview(loadingIndicator)
        stack.setCustomSpacing(8, after: loadingIndicator)

        let forgotButton = makeDisabledInlineButton(title: copy.login.forgotPassword)
        stack.addArrangedSubview(forgotButton)

        emailField.keyboardType = .emailAddress
        emailField.textContentType = .username
        emailField.autocapitalizationType = .none
        emailField.autocorrectionType = .no
        emailField.returnKeyType = .next
        emailField.delegate = self

        passwordField.textContentType = .password
        passwordField.isSecureTextEntry = true
        passwordField.returnKeyType = .go
        passwordField.delegate = self

        return card
    }

    private func makeSocialButton(title: String, systemImage: String) -> UIButton {
        let button = makeOutlineButton(title: title, tint: theme.tint, systemImage: systemImage)
        button.isEnabled = false
        button.alpha = 0.48
        return button
    }

    private func makeDisabledInlineButton(title: String) -> UIButton {
        let button = UIButton(type: .system)
        button.translatesAutoresizingMaskIntoConstraints = false
        button.setTitle(title, for: .normal)
        button.titleLabel?.font = .systemFont(ofSize: 15, weight: .semibold)
        button.contentHorizontalAlignment = .left
        button.isEnabled = false
        button.alpha = 0.48
        return button
    }

    private func makeInputCard(label: String, placeholder: String, textField: UITextField, secure: Bool) -> UIView {
        let container = UIView()
        container.translatesAutoresizingMaskIntoConstraints = false
        container.backgroundColor = UIColor.secondarySystemBackground
        container.layer.cornerRadius = 20

        let stack = makeStack(spacing: 8)
        stack.alignment = .fill
        container.addSubview(stack)
        pin(stack, to: container, insets: UIEdgeInsets(top: 14, left: 14, bottom: 14, right: 14))

        let labelView = UILabel()
        labelView.font = .systemFont(ofSize: 13, weight: .semibold)
        labelView.textColor = .secondaryLabel
        labelView.text = label

        textField.translatesAutoresizingMaskIntoConstraints = false
        textField.borderStyle = .none
        textField.font = .systemFont(ofSize: 17, weight: .medium)
        textField.placeholder = placeholder
        textField.isSecureTextEntry = secure
        textField.clearButtonMode = .whileEditing

        stack.addArrangedSubview(labelView)
        stack.addArrangedSubview(textField)
        return container
    }

    private func handleLoginTap() {
        let email = (emailField.text ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let password = passwordField.text ?? ""

        guard email.count >= 3 else {
            setError(copy.login.errors.loginInvalidUser)
            return
        }
        guard password.count >= 3 else {
            setError(copy.login.errors.loginInvalidPassword)
            return
        }

        setError(nil)
        setLoading(true)

        Task { @MainActor [weak self] in
            guard let self else { return }
            do {
                _ = try await sessionStore.login(email: email, password: password)
                dismiss(animated: true)
            } catch let error as AppLoginError {
                setLoading(false)
                setError(error.errorDescription ?? copy.login.errors.loginGeneric)
            } catch {
                setLoading(false)
                let message = error.localizedDescription.isEmpty ? copy.login.errors.loginGeneric : error.localizedDescription
                setError(message)
            }
        }
    }

    private func setLoading(_ isLoading: Bool) {
        submitButton.isEnabled = !isLoading
        emailField.isEnabled = !isLoading
        passwordField.isEnabled = !isLoading
        if isLoading {
            loadingIndicator.startAnimating()
        } else {
            loadingIndicator.stopAnimating()
        }
    }

    private func setError(_ message: String?) {
        errorLabel.text = message
        errorLabel.isHidden = message?.isEmpty ?? true
    }

    private func handleKeyboardTransition(_ notification: Notification) {
        let userInfo = notification.userInfo ?? [:]
        let duration = userInfo[UIResponder.keyboardAnimationDurationUserInfoKey] as? Double ?? 0.25
        let curveRaw = userInfo[UIResponder.keyboardAnimationCurveUserInfoKey] as? UInt ?? 7
        let options = UIView.AnimationOptions(rawValue: curveRaw << 16)
        let keyboardFrameScreen = (userInfo[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect) ?? .zero
        let keyboardFrameView = view.convert(keyboardFrameScreen, from: nil)
        let overlap = max(0, view.bounds.maxY - keyboardFrameView.minY)
        keyboardInset = max(0, overlap - view.safeAreaInsets.bottom)

        UIView.animate(
            withDuration: duration,
            delay: 0,
            options: [options, .beginFromCurrentState]
        ) { [weak self] in
            guard let self else { return }
            self.scrollView.contentInset.bottom = self.keyboardInset + 24
            self.scrollView.verticalScrollIndicatorInsets.bottom = max(self.keyboardInset, 8)
            self.view.layoutIfNeeded()
        } completion: { [weak self] _ in
            self?.scrollActiveFieldIntoView(animated: false)
        }
    }

    private func scrollActiveFieldIntoView(animated: Bool) {
        guard let activeField else { return }
        view.layoutIfNeeded()

        let focusView = activeField.superview?.superview ?? activeField
        let focusFrame = focusView.convert(focusView.bounds, to: view)
        let visibleTop = view.safeAreaInsets.top + 12
        let visibleBottom = view.bounds.height - keyboardInset - 18
        let minOffset = -scrollView.adjustedContentInset.top
        let maxOffset = max(
            minOffset,
            scrollView.contentSize.height - scrollView.bounds.height + scrollView.adjustedContentInset.bottom
        )

        var targetOffset = scrollView.contentOffset.y
        if focusFrame.maxY > visibleBottom {
            targetOffset += focusFrame.maxY - visibleBottom
        } else if focusFrame.minY < visibleTop {
            targetOffset -= visibleTop - focusFrame.minY
        }

        targetOffset = min(max(targetOffset, minOffset), maxOffset)
        guard abs(targetOffset - scrollView.contentOffset.y) > 1 else { return }

        scrollView.setContentOffset(CGPoint(x: 0, y: targetOffset), animated: animated)
    }

    @objc private func handleClose() {
        dismiss(animated: true)
    }

    func textFieldDidBeginEditing(_ textField: UITextField) {
        activeField = textField
        DispatchQueue.main.async { [weak self] in
            self?.scrollActiveFieldIntoView(animated: true)
        }
    }

    func textFieldDidEndEditing(_ textField: UITextField) {
        if activeField === textField {
            activeField = nil
        }
    }

    func textFieldShouldReturn(_ textField: UITextField) -> Bool {
        if textField === emailField {
            passwordField.becomeFirstResponder()
        } else {
            handleLoginTap()
        }
        return false
    }
}

final class NotificationsViewController: UITableViewController {
    private let copy: AppCopy
    private let items: [NotificationItem]

    init(copy: AppCopy) {
        self.copy = copy
        self.items = copy.notificationItems()
        super.init(style: .insetGrouped)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        title = copy.notifications.title
        navigationItem.rightBarButtonItem = dismissButton()
        tableView.backgroundColor = .systemGroupedBackground
        tableView.sectionHeaderTopPadding = 8
    }

    override func numberOfSections(in tableView: UITableView) -> Int {
        1
    }

    override func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        max(items.count, 1)
    }

    override func tableView(_ tableView: UITableView, titleForHeaderInSection section: Int) -> String? {
        copy.notifications.recentActivity
    }

    override func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        if items.isEmpty {
            let cell = UITableViewCell(style: .default, reuseIdentifier: nil)
            var content = cell.defaultContentConfiguration()
            content.text = copy.notifications.empty
            content.textProperties.color = .secondaryLabel
            cell.contentConfiguration = content
            cell.selectionStyle = .none
            return cell
        }

        let reuseIdentifier = "NotificationCell"
        let cell = tableView.dequeueReusableCell(withIdentifier: reuseIdentifier) ?? UITableViewCell(style: .subtitle, reuseIdentifier: reuseIdentifier)
        let item = items[indexPath.row]

        var content = cell.defaultContentConfiguration()
        content.text = item.title
        content.secondaryText = "\(item.body)\n\(item.elapsed) • \(item.action)"
        content.secondaryTextProperties.numberOfLines = 0
        content.textProperties.font = .systemFont(ofSize: 17, weight: .semibold)
        content.secondaryTextProperties.color = .secondaryLabel
        cell.contentConfiguration = content
        cell.selectionStyle = .none
        cell.accessoryView = statusBadge(text: item.status, highlighted: item.isNew)
        return cell
    }

    private func statusBadge(text: String, highlighted: Bool) -> UIView {
        let label = PaddingLabel()
        label.text = text
        label.font = .systemFont(ofSize: 12, weight: .semibold)
        label.textColor = highlighted ? .white : .secondaryLabel
        label.backgroundColor = highlighted ? UIColor.systemBlue : UIColor.secondarySystemBackground
        label.layer.cornerRadius = 12
        label.clipsToBounds = true
        return label
    }
}

final class DiagnosticsViewController: UIViewController {
    private let session: AppSession
    private let copy: AppCopy

    init(session: AppSession, copy: AppCopy) {
        self.session = session
        self.copy = copy
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        title = copy.native.diagnostics.title
        navigationItem.rightBarButtonItem = dismissButton()
        view.backgroundColor = .systemGroupedBackground
        buildLayout()
    }

    private func buildLayout() {
        let scrollView = UIScrollView()
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        let stack = UIStackView()
        stack.translatesAutoresizingMaskIntoConstraints = false
        stack.axis = .vertical
        stack.spacing = 16

        view.addSubview(scrollView)
        scrollView.addSubview(stack)

        NSLayoutConstraint.activate([
            scrollView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor),

            stack.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor, constant: 20),
            stack.leadingAnchor.constraint(equalTo: scrollView.frameLayoutGuide.leadingAnchor, constant: 20),
            stack.trailingAnchor.constraint(equalTo: scrollView.frameLayoutGuide.trailingAnchor, constant: -20),
            stack.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor, constant: -20)
        ])

        stack.addArrangedSubview(makeHeaderCard())
        stack.addArrangedSubview(makeDiagnosticsCard())
        stack.addArrangedSubview(makeAudioLogsCard())
    }

    private func makeHeaderCard() -> UIView {
        let card = makeCard(backgroundColor: .white)
        let stack = makeStack(spacing: 14)
        card.addSubview(stack)
        pin(stack, to: card, insets: UIEdgeInsets(top: 22, left: 22, bottom: 22, right: 22))

        let headerRow = UIStackView()
        headerRow.axis = .horizontal
        headerRow.spacing = 14
        headerRow.alignment = .center

        let imageView = UIImageView(image: UIImage(named: "BrandMark"))
        imageView.contentMode = .scaleAspectFit
        imageView.tintColor = .label
        imageView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            imageView.widthAnchor.constraint(equalToConstant: 44),
            imageView.heightAnchor.constraint(equalToConstant: 44)
        ])

        let textStack = makeStack(spacing: 6)
        let titleLabel = makeLabel(text: copy.native.diagnostics.title, style: .title2)
        titleLabel.font = .systemFont(ofSize: 24, weight: .bold)
        let subtitleLabel = makeSecondaryLabel(copy.native.diagnostics.subtitle)
        textStack.addArrangedSubview(titleLabel)
        textStack.addArrangedSubview(subtitleLabel)

        headerRow.addArrangedSubview(imageView)
        headerRow.addArrangedSubview(textStack)

        stack.addArrangedSubview(headerRow)
        return card
    }

    private func makeDiagnosticsCard() -> UIView {
        let card = makeCard(backgroundColor: .white)
        let stack = makeStack(spacing: 12)
        card.addSubview(stack)
        pin(stack, to: card, insets: UIEdgeInsets(top: 20, left: 20, bottom: 20, right: 20))

        for row in diagnosticRows() {
            stack.addArrangedSubview(makeDiagnosticRow(title: row.0, value: row.1))
        }

        return card
    }

    private func makeAudioLogsCard() -> UIView {
        let card = makeCard(backgroundColor: .white)
        let stack = makeStack(spacing: 10)
        card.addSubview(stack)
        pin(stack, to: card, insets: UIEdgeInsets(top: 20, left: 20, bottom: 20, right: 20))

        let titleLabel = makeLabel(text: audioLogsTitle(), style: .title3)
        titleLabel.font = .systemFont(ofSize: 20, weight: .bold)
        stack.addArrangedSubview(titleLabel)

        let entries = NativeDebugLogStore.shared.snapshot()
        if entries.isEmpty {
            stack.addArrangedSubview(makeSecondaryLabel(audioLogsEmptyText()))
            return card
        }

        for entry in entries.prefix(12) {
            let label = UILabel()
            label.numberOfLines = 0
            label.font = .monospacedSystemFont(ofSize: 12, weight: .medium)
            label.textColor = .secondaryLabel
            label.text = entry
            stack.addArrangedSubview(label)
        }

        return card
    }

    private func diagnosticRows() -> [(String, String)] {
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "-"
        let build = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "-"
        let bundleID = Bundle.main.bundleIdentifier ?? "-"
        let platform = "\(UIDevice.current.systemName) \(UIDevice.current.systemVersion) • UIKit"
        let tabs = RootScreen.allCases.map(copy.tabTitle(for:)).joined(separator: ", ")

        return [
            (copy.native.diagnostics.versionTitle, "\(version) (\(build))"),
            (copy.native.diagnostics.bundleTitle, bundleID),
            (copy.native.diagnostics.localeTitle, "\(session.locale.rawValue.uppercased()) • \(session.preferredLanguageCode)"),
            (copy.native.diagnostics.userTitle, displayUserLabel(copy: copy, session: session)),
            (copy.native.diagnostics.tabsTitle, tabs),
            (copy.native.diagnostics.platformTitle, platform),
            (copy.native.diagnostics.assetsTitle, "AppIcon, Splash, BrandMark, Chatbot, Mascot, FlagEN")
        ]
    }

    private func makeDiagnosticRow(title: String, value: String) -> UIView {
        let container = UIView()
        let stack = UIStackView()
        stack.translatesAutoresizingMaskIntoConstraints = false
        stack.axis = .vertical
        stack.spacing = 4

        let titleLabel = UILabel()
        titleLabel.font = .systemFont(ofSize: 13, weight: .semibold)
        titleLabel.textColor = .secondaryLabel
        titleLabel.text = title

        let valueLabel = UILabel()
        valueLabel.font = .systemFont(ofSize: 17, weight: .medium)
        valueLabel.textColor = .label
        valueLabel.numberOfLines = 0
        valueLabel.text = value

        stack.addArrangedSubview(titleLabel)
        stack.addArrangedSubview(valueLabel)
        container.addSubview(stack)
        pin(stack, to: container, insets: .zero)

        return container
    }

    private func audioLogsTitle() -> String {
        session.locale == .es ? "Logs de audio" : "Audio logs"
    }

    private func audioLogsEmptyText() -> String {
        session.locale == .es ? "Todavia no hay eventos de audio." : "No audio events yet."
    }
}

final class TitleBarView: UIControl {
    var onDoubleTap: (() -> Void)?

    init(copy: AppCopy, session: AppSession) {
        super.init(frame: .zero)
        isUserInteractionEnabled = true
        accessibilityTraits = [.button]
        accessibilityHint = copy.native.titleBarSubtitle

        let gesture = UITapGestureRecognizer(target: self, action: #selector(handleDoubleTap))
        gesture.numberOfTapsRequired = 2
        addGestureRecognizer(gesture)

        let stack = UIStackView()
        stack.translatesAutoresizingMaskIntoConstraints = false
        stack.axis = .horizontal
        stack.spacing = 10
        stack.alignment = .center

        if session.isAuthenticated, let user = session.user {
            let avatarView = UserAvatarView(size: 30, tint: .label)
            avatarView.configure(with: user)

            let textStack = UIStackView()
            textStack.axis = .vertical
            textStack.spacing = 1

            let titleLabel = UILabel()
            titleLabel.font = .systemFont(ofSize: 16, weight: .bold)
            titleLabel.text = user.resolvedDisplayName

            let subtitleLabel = UILabel()
            subtitleLabel.font = .systemFont(ofSize: 11, weight: .medium)
            subtitleLabel.textColor = .secondaryLabel
            subtitleLabel.text = user.email
            subtitleLabel.isHidden = subtitleLabel.text?.isEmpty ?? true

            textStack.addArrangedSubview(titleLabel)
            textStack.addArrangedSubview(subtitleLabel)

            stack.addArrangedSubview(avatarView)
            stack.addArrangedSubview(textStack)

            if !session.rewards.isEmpty {
                let rewardsView = makeRewardBadgesRow(rewards: session.rewards, tint: .label, compact: true)
                stack.addArrangedSubview(rewardsView)
            }
        } else {
            let imageView = UIImageView(image: UIImage(named: "BrandMark"))
            imageView.contentMode = .scaleAspectFit
            imageView.translatesAutoresizingMaskIntoConstraints = false
            imageView.layer.cornerRadius = 8
            imageView.clipsToBounds = true
            NSLayoutConstraint.activate([
                imageView.widthAnchor.constraint(equalToConstant: 28),
                imageView.heightAnchor.constraint(equalToConstant: 28)
            ])

            let textStack = UIStackView()
            textStack.axis = .vertical
            textStack.spacing = 1

            let titleLabel = UILabel()
            titleLabel.font = .systemFont(ofSize: 17, weight: .bold)
            titleLabel.text = copy.native.appTitle

            let subtitleLabel = UILabel()
            subtitleLabel.font = .systemFont(ofSize: 11, weight: .medium)
            subtitleLabel.textColor = .secondaryLabel
            subtitleLabel.text = displayUserLabel(copy: copy, session: session)

            textStack.addArrangedSubview(titleLabel)
            textStack.addArrangedSubview(subtitleLabel)

            stack.addArrangedSubview(imageView)
            stack.addArrangedSubview(textStack)
        }

        addSubview(stack)
        pin(stack, to: self, insets: .zero)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    @objc private func handleDoubleTap() {
        onDoubleTap?()
    }
}

final class PaddingLabel: UILabel {
    var contentInsets = UIEdgeInsets(top: 5, left: 9, bottom: 5, right: 9)

    override func drawText(in rect: CGRect) {
        super.drawText(in: rect.inset(by: contentInsets))
    }

    override var intrinsicContentSize: CGSize {
        let size = super.intrinsicContentSize
        return CGSize(
            width: size.width + contentInsets.left + contentInsets.right,
            height: size.height + contentInsets.top + contentInsets.bottom
        )
    }
}

private extension UIViewController {
    func presentInSheet(_ controller: UIViewController) {
        let navigationController = UINavigationController(rootViewController: controller)
        if let sheet = navigationController.sheetPresentationController {
            sheet.detents = [.medium(), .large()]
            sheet.prefersGrabberVisible = true
        }
        present(navigationController, animated: true)
    }

    func dismissButton() -> UIBarButtonItem {
        UIBarButtonItem(systemItem: .done, primaryAction: UIAction { [weak self] _ in
            self?.dismiss(animated: true)
        })
    }
}

private func makeCard(backgroundColor: UIColor) -> UIView {
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

private func makeStack(spacing: CGFloat) -> UIStackView {
    let stack = UIStackView()
    stack.translatesAutoresizingMaskIntoConstraints = false
    stack.axis = .vertical
    stack.spacing = spacing
    return stack
}

private func pin(_ child: UIView, to parent: UIView, insets: UIEdgeInsets) {
    NSLayoutConstraint.activate([
        child.topAnchor.constraint(equalTo: parent.topAnchor, constant: insets.top),
        child.leadingAnchor.constraint(equalTo: parent.leadingAnchor, constant: insets.left),
        child.trailingAnchor.constraint(equalTo: parent.trailingAnchor, constant: -insets.right),
        child.bottomAnchor.constraint(equalTo: parent.bottomAnchor, constant: -insets.bottom)
    ])
}

private func makePill(text: String, color: UIColor) -> UIView {
    let label = PaddingLabel()
    label.text = text.uppercased()
    label.font = .systemFont(ofSize: 12, weight: .bold)
    label.textColor = color
    label.backgroundColor = color.withAlphaComponent(0.12)
    label.layer.cornerRadius = 14
    label.clipsToBounds = true
    return label
}

private func makeMetaBadge(text: String, tint: UIColor) -> UIView {
    let label = PaddingLabel()
    label.text = text
    label.font = .systemFont(ofSize: 13, weight: .semibold)
    label.textColor = tint
    label.backgroundColor = tint.withAlphaComponent(0.12)
    label.layer.cornerRadius = 14
    label.clipsToBounds = true
    return label
}

private func makeRewardBadgesRow(rewards: [AppRewardTotal], tint: UIColor, compact: Bool) -> UIView {
    let row = UIStackView()
    row.translatesAutoresizingMaskIntoConstraints = false
    row.axis = .horizontal
    row.spacing = compact ? 6 : 10
    row.alignment = .center

    for reward in rewards where reward.quantity > 0 {
        row.addArrangedSubview(makeRewardBadge(reward: reward, tint: tint, compact: compact))
    }

    return row
}

private func makeRewardBadge(reward: AppRewardTotal, tint: UIColor, compact: Bool) -> UIView {
    let container = UIView()
    container.translatesAutoresizingMaskIntoConstraints = false
    container.backgroundColor = tint.withAlphaComponent(compact ? 0.10 : 0.12)
    container.layer.cornerRadius = compact ? 12 : 16

    let stack = UIStackView()
    stack.translatesAutoresizingMaskIntoConstraints = false
    stack.axis = .horizontal
    stack.spacing = compact ? 5 : 7
    stack.alignment = .center
    container.addSubview(stack)
    pin(
        stack,
        to: container,
        insets: UIEdgeInsets(
            top: compact ? 4 : 7,
            left: compact ? 7 : 10,
            bottom: compact ? 4 : 7,
            right: compact ? 7 : 10
        )
    )

    let iconView = UIImageView(image: UIImage(systemName: rewardSymbolName(for: reward.icon)))
    iconView.tintColor = tint
    iconView.translatesAutoresizingMaskIntoConstraints = false
    NSLayoutConstraint.activate([
        iconView.widthAnchor.constraint(equalToConstant: compact ? 11 : 14),
        iconView.heightAnchor.constraint(equalToConstant: compact ? 11 : 14)
    ])

    let valueLabel = UILabel()
    valueLabel.font = .systemFont(ofSize: compact ? 11 : 14, weight: .bold)
    valueLabel.textColor = tint
    valueLabel.text = "\(reward.quantity)"

    stack.addArrangedSubview(iconView)
    stack.addArrangedSubview(valueLabel)
    return container
}

private func rewardSymbolName(for icon: String) -> String {
    switch icon {
    case "diamond":
        return "diamond.fill"
    case "trophy":
        return "trophy.fill"
    case "ribbon":
        return "rosette"
    default:
        return "seal.fill"
    }
}

private func makeCallout(text: String, tint: UIColor, fill: UIColor) -> UIView {
    let label = PaddingLabel()
    label.text = text
    label.font = .systemFont(ofSize: 14, weight: .medium)
    label.textColor = tint
    label.backgroundColor = fill
    label.layer.cornerRadius = 18
    label.clipsToBounds = true
    return label
}

private func makeLabel(text: String, style: UIFont.TextStyle) -> UILabel {
    let label = UILabel()
    label.translatesAutoresizingMaskIntoConstraints = false
    label.text = text
    label.textColor = .label
    label.numberOfLines = 0
    label.font = .preferredFont(forTextStyle: style)
    return label
}

private func makeBodyLabel(_ text: String) -> UILabel {
    let label = makeLabel(text: text, style: .body)
    label.font = .systemFont(ofSize: 16, weight: .medium)
    return label
}

private func makeSecondaryLabel(_ text: String) -> UILabel {
    let label = makeLabel(text: text, style: .subheadline)
    label.textColor = .secondaryLabel
    label.font = .systemFont(ofSize: 15, weight: .regular)
    return label
}

private func makeMetricTile(title: String, value: String, tint: UIColor) -> UIView {
    let tile = UIView()
    tile.backgroundColor = tint.withAlphaComponent(0.10)
    tile.layer.cornerRadius = 18

    let stack = makeStack(spacing: 6)
    stack.alignment = .leading
    tile.addSubview(stack)
    pin(stack, to: tile, insets: UIEdgeInsets(top: 14, left: 14, bottom: 14, right: 14))

    let titleLabel = UILabel()
    titleLabel.font = .systemFont(ofSize: 12, weight: .semibold)
    titleLabel.textColor = tint
    titleLabel.text = title

    let valueLabel = UILabel()
    valueLabel.font = .systemFont(ofSize: 15, weight: .bold)
    valueLabel.textColor = .label
    valueLabel.numberOfLines = 0
    valueLabel.text = value

    stack.addArrangedSubview(titleLabel)
    stack.addArrangedSubview(valueLabel)
    return tile
}

private func makePrimaryButton(title: String, tint: UIColor) -> UIButton {
    let button = UIButton(type: .system)
    button.translatesAutoresizingMaskIntoConstraints = false
    var configuration = UIButton.Configuration.filled()
    configuration.title = title
    configuration.baseBackgroundColor = tint
    configuration.baseForegroundColor = .white
    configuration.cornerStyle = .large
    configuration.contentInsets = NSDirectionalEdgeInsets(top: 14, leading: 18, bottom: 14, trailing: 18)
    button.configuration = configuration
    return button
}

private func makeOutlineButton(title: String, tint: UIColor, systemImage: String) -> UIButton {
    let button = UIButton(type: .system)
    button.translatesAutoresizingMaskIntoConstraints = false
    var configuration = UIButton.Configuration.bordered()
    configuration.title = title
    configuration.image = UIImage(systemName: systemImage)
    configuration.imagePadding = 10
    configuration.baseForegroundColor = tint
    configuration.cornerStyle = .large
    configuration.contentInsets = NSDirectionalEdgeInsets(top: 14, leading: 16, bottom: 14, trailing: 16)
    button.configuration = configuration
    return button
}

private func displayUserLabel(copy: AppCopy, session: AppSession) -> String {
    session.user?.resolvedDisplayName ?? session.userEmail ?? copy.profile.loginTitle
}

private final class RemoteImageLoader {
    static let shared = RemoteImageLoader()

    private let cache = NSCache<NSURL, UIImage>()

    func loadImage(from rawURL: String?, completion: @escaping (UIImage?) -> Void) {
        let trimmedURL = rawURL?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard
            !trimmedURL.isEmpty,
            let url = URL(string: trimmedURL)
        else {
            completion(nil)
            return
        }

        let cacheKey = url as NSURL
        if let cachedImage = cache.object(forKey: cacheKey) {
            completion(cachedImage)
            return
        }

        URLSession.shared.dataTask(with: url) { [weak self] data, _, _ in
            let image = data.flatMap(UIImage.init(data:))
            if let image {
                self?.cache.setObject(image, forKey: cacheKey)
            }
            DispatchQueue.main.async {
                completion(image)
            }
        }.resume()
    }
}

private final class UserAvatarView: UIView {
    private let imageView = UIImageView()
    private let initialsLabel = UILabel()
    private let fallbackView = UIImageView(image: UIImage(systemName: "person.fill"))
    private var currentImageURL: String?

    init(size: CGFloat, tint: UIColor) {
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false
        backgroundColor = tint.withAlphaComponent(0.14)
        layer.cornerRadius = size / 2
        layer.cornerCurve = .continuous
        clipsToBounds = true

        NSLayoutConstraint.activate([
            widthAnchor.constraint(equalToConstant: size),
            heightAnchor.constraint(equalToConstant: size)
        ])

        imageView.translatesAutoresizingMaskIntoConstraints = false
        imageView.contentMode = .scaleAspectFill
        imageView.isHidden = true

        initialsLabel.translatesAutoresizingMaskIntoConstraints = false
        initialsLabel.font = .systemFont(ofSize: max(12, size * 0.30), weight: .bold)
        initialsLabel.textColor = tint
        initialsLabel.textAlignment = .center

        fallbackView.translatesAutoresizingMaskIntoConstraints = false
        fallbackView.contentMode = .scaleAspectFit
        fallbackView.tintColor = tint

        addSubview(imageView)
        addSubview(initialsLabel)
        addSubview(fallbackView)

        pin(imageView, to: self, insets: .zero)
        NSLayoutConstraint.activate([
            initialsLabel.centerXAnchor.constraint(equalTo: centerXAnchor),
            initialsLabel.centerYAnchor.constraint(equalTo: centerYAnchor),
            fallbackView.centerXAnchor.constraint(equalTo: centerXAnchor),
            fallbackView.centerYAnchor.constraint(equalTo: centerYAnchor),
            fallbackView.widthAnchor.constraint(equalTo: widthAnchor, multiplier: 0.44),
            fallbackView.heightAnchor.constraint(equalTo: heightAnchor, multiplier: 0.44)
        ])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    func configure(with user: AppSessionUser?) {
        let requestedURL = user?.imageURL?.trimmingCharacters(in: .whitespacesAndNewlines)
        currentImageURL = requestedURL
        imageView.isHidden = true
        imageView.image = nil

        let initials = user?.initials ?? ""
        initialsLabel.text = initials
        initialsLabel.isHidden = initials.isEmpty
        fallbackView.isHidden = !initials.isEmpty

        RemoteImageLoader.shared.loadImage(from: requestedURL) { [weak self] image in
            guard let self else { return }
            guard self.currentImageURL == requestedURL else { return }
            guard let image else { return }

            self.imageView.image = image
            self.imageView.isHidden = false
            self.initialsLabel.isHidden = true
            self.fallbackView.isHidden = true
        }
    }
}
