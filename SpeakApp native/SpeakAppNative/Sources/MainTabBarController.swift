import UIKit

final class MainTabBarController: UITabBarController {
    private let sessionStore: AppSessionStore
    private let copy: AppCopy
    private var sessionObserver: NSObjectProtocol?

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
        delegate = self
        configureAppearance()
        configureTabs()
        observeSessionChanges()
    }

    deinit {
        if let sessionObserver {
            NotificationCenter.default.removeObserver(sessionObserver)
        }
    }

    private func configureAppearance() {
        let tabAppearance = UITabBarAppearance()
        tabAppearance.configureWithOpaqueBackground()
        tabAppearance.backgroundColor = .white
        tabAppearance.shadowColor = UIColor.separator.withAlphaComponent(0.18)

        tabBar.standardAppearance = tabAppearance
        tabBar.scrollEdgeAppearance = tabAppearance
        tabBar.tintColor = currentTintColor()
        tabBar.unselectedItemTintColor = .secondaryLabel
    }

    private func observeSessionChanges() {
        sessionObserver = NotificationCenter.default.addObserver(
            forName: AppSessionStore.didChangeNotification,
            object: sessionStore,
            queue: .main
        ) { [weak self] _ in
            self?.configureTabs()
        }
    }

    private func configureTabs() {
        let currentScreen = RootScreen(rawValue: selectedIndex)
        let controllers = RootScreen.allCases.map(makeNavigationController(for:))
        setViewControllers(controllers, animated: false)

        for screen in RootScreen.allCases {
            viewControllers?[screen.rawValue].tabBarItem.isEnabled = sessionStore.isAuthenticated || screen == .you
        }

        let targetScreen: RootScreen
        if sessionStore.isAuthenticated {
            targetScreen = currentScreen ?? .you
        } else {
            targetScreen = .you
        }
        selectedIndex = targetScreen.rawValue
        tabBar.tintColor = currentTintColor()
    }

    private func currentTintColor() -> UIColor {
        RootScreen(rawValue: selectedIndex)?.theme.tint ?? RootScreen.you.theme.tint
    }

    private func makeNavigationController(for screen: RootScreen) -> UINavigationController {
        let root: UIViewController
        switch screen {
        case .lab where sessionStore.isAuthenticated:
            root = LabViewController(sessionStore: sessionStore, copy: copy)
        case .reference:
            root = ReferenceViewController(sessionStore: sessionStore, copy: copy)
        case .chat where sessionStore.isAuthenticated:
            root = ChatViewController(sessionStore: sessionStore, copy: copy)
        case .you where sessionStore.isAuthenticated:
            root = ProfileViewController(sessionStore: sessionStore, copy: copy)
        case .you where !sessionStore.isAuthenticated:
            root = LoggedOutProfileViewController(sessionStore: sessionStore, copy: copy)
        default:
            root = PlaceholderScreenViewController(
                screen: screen,
                sessionStore: sessionStore,
                session: sessionStore.session,
                copy: copy
            )
        }
        let navigationController = UINavigationController(rootViewController: root)
        navigationController.navigationBar.tintColor = screen.theme.tint
        navigationController.tabBarItem = UITabBarItem(
            title: copy.tabTitle(for: screen),
            image: UIImage(systemName: screen.symbolName),
            selectedImage: UIImage(systemName: screen.symbolName)
        )
        return navigationController
    }
}

extension MainTabBarController: UITabBarControllerDelegate {
    func tabBarController(_ tabBarController: UITabBarController, didSelect viewController: UIViewController) {
        tabBar.tintColor = currentTintColor()
    }
}
