import AppIntents
import Foundation

enum ParayuShortcutBridge {
    static let pendingActionKey = "pendingShortcutAction"

    static func requestDictation(_ action: String) {
        let defaults = UserDefaults(suiteName: "group.com.parayu.app") ?? .standard
        defaults.set(action, forKey: pendingActionKey)
        defaults.synchronize()
    }
}

struct StartParayuDictationIntent: AppIntent {
    static var title: LocalizedStringResource = "Start Parayu Dictation"
    static var description = IntentDescription("Open Parayu and start a Malayalam to English dictation.")
    static var openAppWhenRun = true

    @MainActor
    func perform() async throws -> some IntentResult {
        ParayuShortcutBridge.requestDictation("dictate")
        return .result()
    }
}

struct QuickDictationToClipboardIntent: AppIntent {
    static var title: LocalizedStringResource = "Quick Dictation to Clipboard"
    static var description = IntentDescription("Open Parayu, dictate, and copy the clean English result to the clipboard.")
    static var openAppWhenRun = true

    @MainActor
    func perform() async throws -> some IntentResult {
        ParayuShortcutBridge.requestDictation("clipboard")
        return .result()
    }
}

struct MalayalamToEnglishIntent: AppIntent {
    static var title: LocalizedStringResource = "Malayalam to English"
    static var description = IntentDescription("Start Parayu in Malayalam to clean English mode.")
    static var openAppWhenRun = true

    @MainActor
    func perform() async throws -> some IntentResult {
        ParayuShortcutBridge.requestDictation("malayalamToEnglish")
        return .result()
    }
}

struct ParayuAppShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: StartParayuDictationIntent(),
            phrases: [
                "Start \(.applicationName) dictation",
                "Dictate with \(.applicationName)"
            ],
            shortTitle: "Start Dictation",
            systemImageName: "mic.fill"
        )

        AppShortcut(
            intent: QuickDictationToClipboardIntent(),
            phrases: [
                "Quick dictation with \(.applicationName)",
                "Dictate to clipboard with \(.applicationName)"
            ],
            shortTitle: "Dictate to Clipboard",
            systemImageName: "doc.on.clipboard"
        )

        AppShortcut(
            intent: MalayalamToEnglishIntent(),
            phrases: [
                "Malayalam to English with \(.applicationName)",
                "Translate Malayalam with \(.applicationName)"
            ],
            shortTitle: "Malayalam to English",
            systemImageName: "text.bubble.fill"
        )
    }
}
