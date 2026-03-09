import Foundation

struct CopyStore {
    let locale: AppLocale

    func load() -> AppCopy {
        guard let url = Bundle.main.url(forResource: "AppCopy", withExtension: "json") else {
            return AppCopy.fallback(locale: locale)
        }

        do {
            let data = try Data(contentsOf: url)
            let decoded = try JSONDecoder().decode([String: AppCopy].self, from: data)
            return decoded[locale.rawValue] ?? decoded[AppLocale.en.rawValue] ?? AppCopy.fallback(locale: locale)
        } catch {
            return AppCopy.fallback(locale: locale)
        }
    }
}
