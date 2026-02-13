import Foundation

@objc public class P4w4Plugin: NSObject {
    @objc public func echo(_ value: String) -> String {
        print(value)
        return value
    }
}
