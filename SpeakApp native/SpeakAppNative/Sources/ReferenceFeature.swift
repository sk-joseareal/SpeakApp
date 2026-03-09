import UIKit
import WebKit

struct ReferenceDataset: Decodable {
    let generatedAt: String
    let viewFormat: String
    let counts: ReferenceCounts
    let courses: [ReferenceCourse]

    enum CodingKeys: String, CodingKey {
        case generatedAt = "generated_at"
        case viewFormat = "view_format"
        case counts
        case courses = "cursos"
    }
}

struct ReferenceCounts: Decodable {
    let courses: Int
    let units: Int
    let lessons: Int

    enum CodingKeys: String, CodingKey {
        case courses = "cursos"
        case units = "unidades"
        case lessons = "lecciones"
    }
}

struct ReferenceCourse: Decodable {
    let code: Int
    let order: Int
    let slug: [String: String]
    let display: [String: String]
    let units: [ReferenceUnit]

    enum CodingKeys: String, CodingKey {
        case code
        case order
        case slug
        case display
        case units = "unidades"
    }
}

struct ReferenceUnit: Decodable {
    let code: Int
    let order: Int
    let slug: [String: String]
    let display: [String: String]
    let lessons: [ReferenceLesson]

    enum CodingKeys: String, CodingKey {
        case code
        case order
        case slug
        case display
        case lessons = "lecciones"
    }
}

struct ReferenceLesson: Decodable {
    let code: Int
    let order: Int
    let slug: [String: String]
    let display: [String: String]
    let body: [String: String]

    enum CodingKeys: String, CodingKey {
        case code
        case order
        case slug
        case display
        case body = "view"
    }
}

struct ReferenceLessonContext {
    let courseTitle: String
    let unitTitle: String
    let lessonTitle: String
    let markdown: String
}

private struct ReferenceDataStore {
    func load() throws -> ReferenceDataset {
        guard let url = Bundle.main.url(forResource: "reference-data", withExtension: "json") else {
            throw ReferenceDataError.missingResource
        }
        let data = try Data(contentsOf: url)
        return try JSONDecoder().decode(ReferenceDataset.self, from: data)
    }
}

private enum ReferenceDataError: Error {
    case missingResource
}

private struct ReferenceOutlineItem: Hashable {
    enum Kind {
        case course
        case unit
        case lesson
    }

    let id: String
    let kind: Kind
    let title: String
    let subtitle: String
}

final class ReferenceViewController: UIViewController {
    private enum Section {
        case main
    }

    private let sessionStore: AppSessionStore
    private let session: AppSession
    private let copy: AppCopy
    private let theme = RootScreen.reference.theme
    private let dataStore = ReferenceDataStore()

    private lazy var collectionView = makeCollectionView()
    private lazy var dataSource = makeDataSource()
    private let emptyStateLabel = UILabel()
    private let subtitleLabel = UILabel()
    private let countsStack = UIStackView()
    private let datasetMetaLabel = UILabel()

    private var dataset: ReferenceDataset?
    private var lessonContextsByItem: [ReferenceOutlineItem: ReferenceLessonContext] = [:]

    init(sessionStore: AppSessionStore, copy: AppCopy) {
        self.sessionStore = sessionStore
        self.session = sessionStore.session
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
        loadReferenceData()
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
        let summaryCard = UIView()
        summaryCard.translatesAutoresizingMaskIntoConstraints = false
        summaryCard.backgroundColor = .white
        summaryCard.layer.cornerRadius = 28
        summaryCard.layer.shadowColor = UIColor.black.withAlphaComponent(0.08).cgColor
        summaryCard.layer.shadowOpacity = 1
        summaryCard.layer.shadowRadius = 18
        summaryCard.layer.shadowOffset = CGSize(width: 0, height: 12)

        let summaryStack = UIStackView()
        summaryStack.translatesAutoresizingMaskIntoConstraints = false
        summaryStack.axis = .vertical
        summaryStack.spacing = 14

        let eyebrow = PaddingLabel()
        eyebrow.text = copy.reference.title.uppercased()
        eyebrow.font = .systemFont(ofSize: 12, weight: .bold)
        eyebrow.textColor = theme.tint
        eyebrow.backgroundColor = theme.tint.withAlphaComponent(0.12)
        eyebrow.layer.cornerRadius = 14
        eyebrow.clipsToBounds = true

        let titleLabel = UILabel()
        titleLabel.font = .systemFont(ofSize: 30, weight: .bold)
        titleLabel.textColor = .label
        titleLabel.numberOfLines = 0
        titleLabel.text = copy.reference.title

        subtitleLabel.font = .systemFont(ofSize: 15, weight: .regular)
        subtitleLabel.textColor = .secondaryLabel
        subtitleLabel.numberOfLines = 0
        subtitleLabel.text = copy.reference.subtitle

        countsStack.axis = .horizontal
        countsStack.spacing = 10
        countsStack.alignment = .leading
        countsStack.distribution = .fillProportionally

        datasetMetaLabel.font = .systemFont(ofSize: 13, weight: .medium)
        datasetMetaLabel.textColor = .secondaryLabel
        datasetMetaLabel.numberOfLines = 0

        summaryStack.addArrangedSubview(eyebrow)
        summaryStack.addArrangedSubview(titleLabel)
        summaryStack.addArrangedSubview(subtitleLabel)
        summaryStack.addArrangedSubview(countsStack)
        summaryStack.addArrangedSubview(datasetMetaLabel)
        summaryCard.addSubview(summaryStack)

        emptyStateLabel.translatesAutoresizingMaskIntoConstraints = false
        emptyStateLabel.textAlignment = .center
        emptyStateLabel.font = .systemFont(ofSize: 16, weight: .medium)
        emptyStateLabel.textColor = .secondaryLabel
        emptyStateLabel.numberOfLines = 0
        emptyStateLabel.isHidden = true

        collectionView.translatesAutoresizingMaskIntoConstraints = false

        view.addSubview(summaryCard)
        view.addSubview(collectionView)
        view.addSubview(emptyStateLabel)

        NSLayoutConstraint.activate([
            summaryStack.topAnchor.constraint(equalTo: summaryCard.topAnchor, constant: 22),
            summaryStack.leadingAnchor.constraint(equalTo: summaryCard.leadingAnchor, constant: 22),
            summaryStack.trailingAnchor.constraint(equalTo: summaryCard.trailingAnchor, constant: -22),
            summaryStack.bottomAnchor.constraint(equalTo: summaryCard.bottomAnchor, constant: -22),

            summaryCard.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 20),
            summaryCard.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            summaryCard.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),

            collectionView.topAnchor.constraint(equalTo: summaryCard.bottomAnchor, constant: 16),
            collectionView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            collectionView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            collectionView.bottomAnchor.constraint(equalTo: view.bottomAnchor),

            emptyStateLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 28),
            emptyStateLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -28),
            emptyStateLabel.centerYAnchor.constraint(equalTo: collectionView.centerYAnchor)
        ])
    }

    private func loadReferenceData() {
        do {
            let dataset = try dataStore.load()
            self.dataset = dataset
            emptyStateLabel.isHidden = true
            collectionView.isHidden = false
            renderSummary(with: dataset)
            applySnapshot(with: dataset)
        } catch {
            collectionView.isHidden = true
            emptyStateLabel.isHidden = false
            emptyStateLabel.text = unavailableText(for: session.locale)
            datasetMetaLabel.text = nil
        }
    }

    private func renderSummary(with dataset: ReferenceDataset) {
        subtitleLabel.text = copy.reference.subtitle
        datasetMetaLabel.text = "Generated \(dataset.generatedAt.prefix(10)) • \(dataset.viewFormat.uppercased())"

        countsStack.arrangedSubviews.forEach { view in
            countsStack.removeArrangedSubview(view)
            view.removeFromSuperview()
        }

        countsStack.addArrangedSubview(makeCountBadge(value: dataset.counts.courses, label: localizedWord(courses: dataset.counts.courses)))
        countsStack.addArrangedSubview(makeCountBadge(value: dataset.counts.units, label: localizedWord(units: dataset.counts.units)))
        countsStack.addArrangedSubview(makeCountBadge(value: dataset.counts.lessons, label: localizedWord(lessons: dataset.counts.lessons)))
    }

    private func makeCountBadge(value: Int, label: String) -> UIView {
        let badge = UIView()
        badge.backgroundColor = theme.accent
        badge.layer.cornerRadius = 18

        let stack = UIStackView()
        stack.translatesAutoresizingMaskIntoConstraints = false
        stack.axis = .vertical
        stack.spacing = 4

        let valueLabel = UILabel()
        valueLabel.font = .systemFont(ofSize: 18, weight: .bold)
        valueLabel.textColor = theme.tint
        valueLabel.text = "\(value)"

        let titleLabel = UILabel()
        titleLabel.font = .systemFont(ofSize: 12, weight: .semibold)
        titleLabel.textColor = .secondaryLabel
        titleLabel.text = label

        stack.addArrangedSubview(valueLabel)
        stack.addArrangedSubview(titleLabel)
        badge.addSubview(stack)

        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: badge.topAnchor, constant: 12),
            stack.leadingAnchor.constraint(equalTo: badge.leadingAnchor, constant: 14),
            stack.trailingAnchor.constraint(equalTo: badge.trailingAnchor, constant: -14),
            stack.bottomAnchor.constraint(equalTo: badge.bottomAnchor, constant: -12)
        ])

        return badge
    }

    private func makeCollectionView() -> UICollectionView {
        var configuration = UICollectionLayoutListConfiguration(appearance: .insetGrouped)
        configuration.showsSeparators = false
        let layout = UICollectionViewCompositionalLayout.list(using: configuration)
        let collectionView = UICollectionView(frame: .zero, collectionViewLayout: layout)
        collectionView.backgroundColor = .clear
        collectionView.delegate = self
        return collectionView
    }

    private func makeDataSource() -> UICollectionViewDiffableDataSource<Section, ReferenceOutlineItem> {
        let cellRegistration = UICollectionView.CellRegistration<UICollectionViewListCell, ReferenceOutlineItem> {
            [weak self] cell, _, item in
            guard let self else { return }

            var content = UIListContentConfiguration.subtitleCell()
            content.text = item.title
            content.secondaryText = item.subtitle
            content.secondaryTextProperties.color = .secondaryLabel

            switch item.kind {
            case .course:
                content.image = UIImage(systemName: "square.stack.3d.up")
                content.textProperties.font = .systemFont(ofSize: 18, weight: .bold)
            case .unit:
                content.image = UIImage(systemName: "rectangle.stack")
                content.textProperties.font = .systemFont(ofSize: 16, weight: .semibold)
            case .lesson:
                content.image = UIImage(systemName: "doc.text")
                content.textProperties.font = .systemFont(ofSize: 15, weight: .medium)
            }

            content.imageProperties.tintColor = self.theme.tint
            cell.contentConfiguration = content
            cell.backgroundConfiguration = UIBackgroundConfiguration.clear()

            switch item.kind {
            case .lesson:
                cell.accessories = [.disclosureIndicator()]
            case .course, .unit:
                cell.accessories = [.outlineDisclosure()]
            }
        }

        return UICollectionViewDiffableDataSource<Section, ReferenceOutlineItem>(
            collectionView: collectionView
        ) { collectionView, indexPath, item in
            collectionView.dequeueConfiguredReusableCell(
                using: cellRegistration,
                for: indexPath,
                item: item
            )
        }
    }

    private func applySnapshot(with dataset: ReferenceDataset) {
        lessonContextsByItem.removeAll()

        var snapshot = NSDiffableDataSourceSnapshot<Section, ReferenceOutlineItem>()
        snapshot.appendSections([.main])
        dataSource.apply(snapshot, animatingDifferences: false)

        var sectionSnapshot = NSDiffableDataSourceSectionSnapshot<ReferenceOutlineItem>()
        var expandableItems: [ReferenceOutlineItem] = []

        for course in dataset.courses.sorted(by: { $0.order < $1.order }) {
            let courseItem = ReferenceOutlineItem(
                id: "course-\(course.code)",
                kind: .course,
                title: course.display.localized(for: session.locale),
                subtitle: "\(course.units.count) \(localizedWord(units: course.units.count))"
            )
            sectionSnapshot.append([courseItem])
            expandableItems.append(courseItem)

            for unit in course.units.sorted(by: { $0.order < $1.order }) {
                let unitItem = ReferenceOutlineItem(
                    id: "unit-\(unit.code)",
                    kind: .unit,
                    title: unit.display.localized(for: session.locale),
                    subtitle: "\(unit.lessons.count) \(localizedWord(lessons: unit.lessons.count))"
                )
                sectionSnapshot.append([unitItem], to: courseItem)
                expandableItems.append(unitItem)

                for lesson in unit.lessons.sorted(by: { $0.order < $1.order }) {
                    let lessonItem = ReferenceOutlineItem(
                        id: "lesson-\(lesson.code)",
                        kind: .lesson,
                        title: lesson.display.localized(for: session.locale),
                        subtitle: unit.display.localized(for: session.locale)
                    )
                    sectionSnapshot.append([lessonItem], to: unitItem)
                    lessonContextsByItem[lessonItem] = ReferenceLessonContext(
                        courseTitle: course.display.localized(for: session.locale),
                        unitTitle: unit.display.localized(for: session.locale),
                        lessonTitle: lesson.display.localized(for: session.locale),
                        markdown: lesson.body.localized(for: session.locale)
                    )
                }
            }
        }

        dataSource.apply(sectionSnapshot, to: Section.main, animatingDifferences: false)
        var expandedSnapshot = dataSource.snapshot(for: Section.main)
        expandedSnapshot.expand(expandableItems)
        dataSource.apply(expandedSnapshot, to: Section.main, animatingDifferences: false)
    }

    private func unavailableText(for locale: AppLocale) -> String {
        switch locale {
        case .es: return "No se pudo cargar el contenido de referencia."
        case .en: return "Reference content could not be loaded."
        }
    }

    private func localizedWord(courses count: Int) -> String {
        switch session.locale {
        case .es: return count == 1 ? "curso" : "cursos"
        case .en: return count == 1 ? "course" : "courses"
        }
    }

    private func localizedWord(units count: Int) -> String {
        switch session.locale {
        case .es: return count == 1 ? "unidad" : "unidades"
        case .en: return count == 1 ? "unit" : "units"
        }
    }

    private func localizedWord(lessons count: Int) -> String {
        switch session.locale {
        case .es: return count == 1 ? "lección" : "lecciones"
        case .en: return count == 1 ? "lesson" : "lessons"
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

extension ReferenceViewController: UICollectionViewDelegate {
    func collectionView(_ collectionView: UICollectionView, didSelectItemAt indexPath: IndexPath) {
        guard let item = dataSource.itemIdentifier(for: indexPath) else { return }
        collectionView.deselectItem(at: indexPath, animated: true)

        switch item.kind {
        case .lesson:
            guard let context = lessonContextsByItem[item] else { return }
            let controller = ReferenceLessonViewController(
                session: session,
                copy: copy,
                context: context
            )
            navigationController?.pushViewController(controller, animated: true)
        case .course, .unit:
            var snapshot = dataSource.snapshot(for: Section.main)
            if snapshot.isExpanded(item) {
                snapshot.collapse([item])
            } else {
                snapshot.expand([item])
            }
            dataSource.apply(snapshot, to: Section.main, animatingDifferences: true)
        }
    }
}

final class ReferenceLessonViewController: UIViewController {
    private let session: AppSession
    private let copy: AppCopy
    private let context: ReferenceLessonContext
    private let webView = WKWebView(frame: .zero)

    init(session: AppSession, copy: AppCopy, context: ReferenceLessonContext) {
        self.session = session
        self.copy = copy
        self.context = context
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = RootScreen.reference.theme.background
        configureNavigationBar()
        buildLayout()
        loadLesson()
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        navigationController?.navigationBar.tintColor = RootScreen.reference.theme.tint
    }

    private func configureNavigationBar() {
        navigationItem.largeTitleDisplayMode = .never

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
        webView.translatesAutoresizingMaskIntoConstraints = false
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.backgroundColor = .clear

        view.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
    }

    private func loadLesson() {
        let html = ReferenceMarkdownRenderer.documentHTML(
            for: context,
            theme: RootScreen.reference.theme,
            locale: session.locale
        )
        webView.loadHTMLString(html, baseURL: nil)
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

private enum ReferenceMarkdownRenderer {
    static func documentHTML(for context: ReferenceLessonContext, theme: ScreenTheme, locale: AppLocale = .en) -> String {
        let tint = theme.tint.cssHex
        let tintSoft = theme.tint.withAlphaComponent(0.14).cssRGBA
        let accent = theme.accent.cssHex
        let bodyHTML = bodyHTML(from: context.markdown)
        let selectedLessonLabel = locale == .es ? "Leccion seleccionada" : "Selected lesson"
        let path = "\(escapeHTML(context.courseTitle)) • \(escapeHTML(context.unitTitle)) • \(escapeHTML(context.lessonTitle))"

        return """
        <!doctype html>
        <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
          <style>
            :root {
              --page: \(theme.background.cssHex);
              --card: #ffffff;
              --ink: #1b2430;
              --muted: #5d6b82;
              --line: #d5def0;
              --tint: \(tint);
              --tint-soft: \(tintSoft);
              --accent: \(accent);
            }
            * { box-sizing: border-box; }
            body {
              margin: 0;
              padding: 0;
              background: linear-gradient(180deg, var(--page) 0%, #f8fbff 100%);
              color: var(--ink);
              font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
              -webkit-font-smoothing: antialiased;
            }
            main {
              max-width: 860px;
              margin: 0 auto;
              padding: 14px 14px 28px;
            }
            .lesson-shell {
              background: #ffffff;
              border-radius: 18px;
              border: 1px solid #e4e7ef;
              box-shadow: 0 14px 30px rgba(20, 30, 50, 0.08);
              padding: 16px;
            }
            .lesson-chip {
              display: inline-flex;
              align-items: center;
              min-height: 32px;
              margin-bottom: 10px;
              padding: 0 12px;
              border-radius: 12px;
              border: 1px solid #d8d8dc;
              background: #ececec;
              color: #4e596d;
              font-size: 13px;
              font-weight: 600;
            }
            .lesson-path {
              color: var(--muted);
              font-size: 13px;
              line-height: 1.4;
              margin-bottom: 8px;
            }
            .lesson-title {
              margin: 0 0 14px;
              color: #1b2430;
              font-size: 28px;
              line-height: 1.1;
              font-weight: 800;
            }
            .reference-markdown {
              border: 1px solid #d9e4f7;
              border-radius: 14px;
              background:
                linear-gradient(180deg, #fbfdff 0%, #f4f8ff 100%),
                radial-gradient(120% 70% at 8% 0%, \(theme.tint.withAlphaComponent(0.08).cssRGBA), transparent 60%);
              padding: 16px 16px 18px;
              line-height: 1.62;
              color: #172033;
              font-size: 15px;
              box-shadow:
                inset 0 1px 0 rgba(255, 255, 255, 0.88),
                0 8px 20px rgba(29, 95, 208, 0.07);
              overflow-wrap: anywhere;
            }
            .reference-markdown > *:first-child {
              margin-top: 0;
            }
            .reference-markdown > *:last-child {
              margin-bottom: 0;
            }
            h1, h2, h3, h4, h5, h6 {
              margin: 16px 0 8px;
              line-height: 1.25;
              color: #143268;
              letter-spacing: 0.01em;
            }
            h1, h2 {
              padding-bottom: 4px;
              border-bottom: 1px solid rgba(29, 95, 208, 0.15);
            }
            h1 { font-size: 1.2rem; }
            h2 { font-size: 1.08rem; }
            h3 { font-size: 1rem; }
            p {
              margin: 11px 0;
            }
            ul, ol {
              margin: 10px 0 12px;
              padding-left: 22px;
            }
            li {
              font-size: 15px;
              line-height: 1.65;
              margin: 0;
            }
            li + li {
              margin-top: 6px;
            }
            li::marker {
              color: var(--tint);
            }
            strong {
              font-weight: 760;
              color: #15356d;
            }
            em { font-style: italic; }
            code {
              font-family: ui-monospace, "SF Mono", Menlo, monospace;
              font-size: 0.86em;
              background: #e7eefc;
              border: 1px solid #cfe0fb;
              border-radius: 6px;
              padding: 1px 6px;
            }
            blockquote {
              margin: 12px 0;
              padding: 10px 12px 10px 14px;
              border: 1px solid rgba(147, 197, 253, 0.9);
              border-left-color: rgba(147, 197, 253, 0.9);
              background: linear-gradient(180deg, #f2f8ff 0%, #eaf3ff 100%);
              border-radius: 10px;
              color: #143261;
            }
            blockquote p:last-child { margin-bottom: 0; }
            .table-wrap {
              overflow-x: auto;
              margin: 12px 0;
              border: 1px solid #d2deef;
              border-radius: 10px;
              background: rgba(255, 255, 255, 0.68);
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 14px;
              table-layout: auto;
            }
            th, td {
              text-align: left;
              vertical-align: top;
              padding: 7px 9px;
              border: 1px solid var(--line);
              overflow-wrap: anywhere;
            }
            th {
              background: #eaf1fb;
              color: #1d355e;
              font-weight: 700;
            }
            tr:nth-child(even) td {
              background: rgba(232, 241, 255, 0.45);
            }
            a {
              color: var(--tint);
              font-weight: 600;
              text-decoration: underline;
              text-decoration-color: rgba(29, 95, 208, 0.45);
              text-underline-offset: 2px;
            }
            hr {
              border: 0;
              border-top: 1px solid #d3def0;
              margin: 16px 0;
            }
            @media (max-width: 480px) {
              main {
                padding: 12px 10px 24px;
              }
              .lesson-shell {
                padding: 13px;
              }
              .lesson-title {
                font-size: 24px;
              }
              .reference-markdown {
                padding: 13px 12px 14px;
                font-size: 14px;
              }
              table {
                font-size: 13px;
              }
              th, td {
                padding: 6px 7px;
              }
            }
          </style>
        </head>
        <body>
          <main>
            <section class="lesson-shell">
              <div class="lesson-chip">\(selectedLessonLabel)</div>
              <div class="lesson-path">\(path)</div>
              <h1 class="lesson-title">\(escapeHTML(context.lessonTitle))</h1>
              <div class="reference-markdown">\(bodyHTML)</div>
            </section>
          </main>
        </body>
        </html>
        """
    }

    private static func bodyHTML(from markdown: String) -> String {
        let normalized = markdown.replacingOccurrences(of: "\r\n", with: "\n")
        let lines = normalized.components(separatedBy: "\n")
        var blocks: [String] = []
        var index = 0

        while index < lines.count {
            let trimmed = lines[index].trimmingCharacters(in: .whitespaces)
            if trimmed.isEmpty {
                index += 1
                continue
            }

            if let heading = headingHTML(for: trimmed) {
                blocks.append(heading)
                index += 1
                continue
            }

            if trimmed.hasPrefix("|") {
                var tableLines: [String] = []
                while index < lines.count {
                    let candidate = lines[index].trimmingCharacters(in: .whitespaces)
                    guard candidate.hasPrefix("|") else { break }
                    tableLines.append(candidate)
                    index += 1
                }
                if let tableHTML = renderTable(lines: tableLines) {
                    blocks.append(tableHTML)
                } else {
                    blocks.append("<p>\(inlineHTML(tableLines.joined(separator: " ")))</p>")
                }
                continue
            }

            if trimmed.hasPrefix(">") {
                var quoteLines: [String] = []
                while index < lines.count {
                    let candidate = lines[index].trimmingCharacters(in: .whitespaces)
                    guard candidate.hasPrefix(">") else { break }
                    let stripped = candidate.drop { $0 == ">" || $0 == " " }
                    quoteLines.append(String(stripped))
                    index += 1
                }
                let quoteHTML = quoteLines.map { "<p>\(inlineHTML($0))</p>" }.joined()
                blocks.append("<blockquote>\(quoteHTML)</blockquote>")
                continue
            }

            if isHorizontalRule(trimmed) {
                blocks.append("<hr>")
                index += 1
                continue
            }

            if let listHTML = listHTML(lines: lines, startIndex: &index) {
                blocks.append(listHTML)
                continue
            }

            var paragraphLines: [String] = []
            while index < lines.count {
                let candidate = lines[index].trimmingCharacters(in: .whitespaces)
                if candidate.isEmpty || candidate.hasPrefix("|") || candidate.hasPrefix(">") || headingHTML(for: candidate) != nil || isHorizontalRule(candidate) || isListLine(candidate) {
                    break
                }
                paragraphLines.append(candidate)
                index += 1
            }
            blocks.append("<p>\(inlineHTML(paragraphLines.joined(separator: " ")))</p>")
        }

        return blocks.joined(separator: "\n")
    }

    private static func listHTML(lines: [String], startIndex: inout Int) -> String? {
        guard startIndex < lines.count else { return nil }
        let firstLine = lines[startIndex].trimmingCharacters(in: .whitespaces)
        let isOrdered = orderedListItemText(from: firstLine) != nil
        let isUnordered = unorderedListItemText(from: firstLine) != nil
        guard isOrdered || isUnordered else { return nil }

        let wrapperTag = isOrdered ? "ol" : "ul"
        var items: [String] = []

        while startIndex < lines.count {
            let candidate = lines[startIndex].trimmingCharacters(in: .whitespaces)
            let itemText = isOrdered ? orderedListItemText(from: candidate) : unorderedListItemText(from: candidate)
            guard let itemText else { break }
            items.append("<li>\(inlineHTML(itemText))</li>")
            startIndex += 1
        }

        guard !items.isEmpty else { return nil }
        return "<\(wrapperTag)>\(items.joined())</\(wrapperTag)>"
    }

    private static func headingHTML(for line: String) -> String? {
        if line.hasPrefix("### ") {
            return "<h3>\(inlineHTML(String(line.dropFirst(4))))</h3>"
        }
        if line.hasPrefix("## ") {
            return "<h2>\(inlineHTML(String(line.dropFirst(3))))</h2>"
        }
        if line.hasPrefix("# ") {
            return "<h1>\(inlineHTML(String(line.dropFirst(2))))</h1>"
        }
        return nil
    }

    private static func renderTable(lines: [String]) -> String? {
        guard lines.count >= 2 else { return nil }
        let header = splitTableRow(lines[0])
        let separator = splitTableRow(lines[1])
        guard !header.isEmpty, isSeparatorRow(separator) else { return nil }

        let rows = lines.dropFirst(2).map(splitTableRow)
        let headerHTML = header.map { "<th>\(inlineHTML($0))</th>" }.joined()
        let rowsHTML = rows.map { row in
            let cells = row.map { "<td>\(inlineHTML($0))</td>" }.joined()
            return "<tr>\(cells)</tr>"
        }.joined()

        return """
        <div class="table-wrap">
          <table>
            <thead><tr>\(headerHTML)</tr></thead>
            <tbody>\(rowsHTML)</tbody>
          </table>
        </div>
        """
    }

    private static func splitTableRow(_ row: String) -> [String] {
        row
            .trimmingCharacters(in: .whitespaces)
            .trimmingCharacters(in: CharacterSet(charactersIn: "|"))
            .components(separatedBy: "|")
            .map { $0.trimmingCharacters(in: .whitespaces) }
    }

    private static func isSeparatorRow(_ cells: [String]) -> Bool {
        let allowed = CharacterSet(charactersIn: "-: ")
        return !cells.isEmpty && cells.allSatisfy { cell in
            !cell.isEmpty && cell.rangeOfCharacter(from: allowed.inverted) == nil
        }
    }

    private static func isHorizontalRule(_ line: String) -> Bool {
        let compact = line.replacingOccurrences(of: " ", with: "")
        return compact == "---" || compact == "***" || compact == "___"
    }

    private static func isListLine(_ line: String) -> Bool {
        unorderedListItemText(from: line) != nil || orderedListItemText(from: line) != nil
    }

    private static func unorderedListItemText(from line: String) -> String? {
        guard line.hasPrefix("- ") || line.hasPrefix("* ") else { return nil }
        return String(line.dropFirst(2)).trimmingCharacters(in: .whitespaces)
    }

    private static func orderedListItemText(from line: String) -> String? {
        guard let regex = try? NSRegularExpression(pattern: #"^\d+\.\s+(.+)$"#) else {
            return nil
        }
        let range = NSRange(line.startIndex..., in: line)
        guard
            let match = regex.firstMatch(in: line, options: [], range: range),
            let textRange = Range(match.range(at: 1), in: line)
        else {
            return nil
        }
        return String(line[textRange]).trimmingCharacters(in: .whitespaces)
    }

    private static func inlineHTML(_ input: String) -> String {
        let breakToken = "___REFERENCE_BR___"
        var output = input.replacingOccurrences(of: "<br>", with: breakToken)
        output = escapeHTML(output)
        output = output.replacingOccurrences(of: breakToken, with: "<br>")
        output = replacing(#"\[([^\]]+)\]\(([^)]+)\)"#, in: output, with: #"<a href="$2">$1</a>"#)
        output = replacing(#"`([^`]+)`"#, in: output, with: #"<code>$1</code>"#)
        output = replacing(#"\*\*(.+?)\*\*"#, in: output, with: #"<strong>$1</strong>"#)
        output = replacing(#"__(.+?)__"#, in: output, with: #"<strong>$1</strong>"#)
        output = replacing(#"(?<!\*)\*([^*]+)\*(?!\*)"#, in: output, with: #"<em>$1</em>"#)
        return output
    }

    private static func replacing(_ pattern: String, in input: String, with template: String) -> String {
        guard let regex = try? NSRegularExpression(pattern: pattern, options: []) else {
            return input
        }
        let range = NSRange(input.startIndex..., in: input)
        return regex.stringByReplacingMatches(in: input, options: [], range: range, withTemplate: template)
    }

    private static func escapeHTML(_ input: String) -> String {
        input
            .replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
            .replacingOccurrences(of: "\"", with: "&quot;")
    }
}

private extension Dictionary where Key == String, Value == String {
    func localized(for locale: AppLocale) -> String {
        self[locale.rawValue] ?? self["en"] ?? self["es"] ?? values.first ?? "-"
    }
}

private extension UIColor {
    var cssHex: String {
        var red: CGFloat = 0
        var green: CGFloat = 0
        var blue: CGFloat = 0
        var alpha: CGFloat = 0
        getRed(&red, green: &green, blue: &blue, alpha: &alpha)
        return String(
            format: "#%02X%02X%02X",
            Int(red * 255),
            Int(green * 255),
            Int(blue * 255)
        )
    }

    var cssRGBA: String {
        var red: CGFloat = 0
        var green: CGFloat = 0
        var blue: CGFloat = 0
        var alpha: CGFloat = 0
        getRed(&red, green: &green, blue: &blue, alpha: &alpha)
        return String(
            format: "rgba(%d, %d, %d, %.3f)",
            Int(red * 255),
            Int(green * 255),
            Int(blue * 255),
            alpha
        )
    }
}
