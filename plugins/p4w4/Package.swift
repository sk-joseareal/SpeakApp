// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "SokinternetP4w4",
    platforms: [.iOS(.v14)],
    products: [
        .library(
            name: "SokinternetP4w4",
            targets: ["P4w4PluginPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "7.0.0")
    ],
    targets: [
        .target(
            name: "P4w4PluginPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm")
            ],
            path: "ios/Sources/P4w4PluginPlugin"),
        .testTarget(
            name: "P4w4PluginPluginTests",
            dependencies: ["P4w4PluginPlugin"],
            path: "ios/Tests/P4w4PluginPluginTests")
    ]
)