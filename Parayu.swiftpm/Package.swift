// swift-tools-version: 5.9
import PackageDescription
import AppleProductTypes

let package = Package(
    name: "Parayu",
    platforms: [
        .iOS("16.0")
    ],
    products: [
        .iOSApplication(
            name: "Parayu",
            targets: ["App"],
            bundleIdentifier: "com.parayu.app",
            teamIdentifier: "",
            displayVersion: "1.0",
            bundleVersion: "1",
            appIcon: .placeholder(paper: .template),
            accentColor: .presetColor(.red),
            supportedDeviceFamilies: [
                .pad,
                .phone
            ],
            supportedInterfaceOrientations: [
                .portrait,
                .landscapeLeft,
                .landscapeRight,
                .portraitUpsideDown
            ],
            capabilities: [
                .microphone(purposeString: "Parayu uses your microphone to transcribe and translate your speech into English text.")
            ]
        )
    ],
    dependencies: [
        .package(url: "https://github.com/ggerganov/whisper.cpp.git", branch: "master")
    ],
    targets: [
        .executableTarget(
            name: "App",
            dependencies: [
                .product(name: "whisper", package: "whisper.cpp")
            ],
            path: "App"
        )
    ]
)
