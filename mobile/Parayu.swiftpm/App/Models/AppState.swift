import SwiftUI
import Combine

public struct HistoryEntry: Codable, Identifiable {
    public let id: String
    public let text: String
    public let rawText: String
    public let timestamp: Date
    public let words: Int
    public let durationSec: Double
}

public struct DictionaryRule: Codable, Identifiable {
    public var id = UUID()
    public var from: String
    public var to: String
    
    public init(id: UUID = UUID(), from: String, to: String) {
        self.id = id
        self.from = from
        self.to = to
    }
}

public struct Snippet: Codable, Identifiable {
    public var id = UUID()
    public var trigger: String
    public var expansion: String
    
    public init(id: UUID = UUID(), trigger: String, expansion: String) {
        self.id = id
        self.trigger = trigger
        self.expansion = expansion
    }
}

public struct Stats: Codable {
    public var totalWords: Int = 0
    public var lastActiveDate: String? = nil
    public var streak: Int = 0
    public var longestStreak: Int = 0
    public var speakingSeconds: Double = 0
    public var wordsCorrected: Int = 0
    public var dictionaryFixes: Int = 0
}

public struct AppUsageEntry: Codable {
    public var words: Int = 0
    public var count: Int = 0
}

public class AppState: ObservableObject, @unchecked Sendable {
    @Published public var history: [HistoryEntry] = []
    @Published public var dictionary: [DictionaryRule] = []
    @Published public var snippets: [Snippet] = []
    @Published public var stats = Stats()
    @Published public var appUsage: [String: AppUsageEntry] = [:]
    
    @Published public var userName: String = ""
    @Published public var aiCleanup: Bool = true
    @Published public var dictationMode: String = "toggle"
    @Published public var selectedModel: String = "small-q5_1"
    @Published public var inputLanguage: String = "ml"
    @Published public var translateMalayalam: Bool = true
    @Published public var onboarded: Bool = false
    
    // UI Progress State
    @Published public var downloadProgress: Double = 0.0
    @Published public var downloadPhase: String = "idle" // "idle", "downloading", "loading", "transcribing"
    @Published public var currentStatusText: String = ""
    
    // Keyboard Dictation Handoff State
    @Published public var keyboardHandoffActive: Bool = false
    
    private let fileManager = FileManager.default
    
    public init() {
        loadAll()
    }
    
    private var appSupportURL: URL {
        if let sharedURL = fileManager.containerURL(forSecurityApplicationGroupIdentifier: "group.com.parayu.app") {
            let dir = sharedURL.appendingPathComponent("Library/Application Support/Parayu", isDirectory: true)
            try? fileManager.createDirectory(at: dir, withIntermediateDirectories: true)
            return dir
        }
        let paths = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask)
        let dir = paths[0].appendingPathComponent("Parayu", isDirectory: true)
        try? fileManager.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }
    
    public func saveAll() {
        saveFile(history, name: "history.json")
        saveFile(dictionary, name: "dictionary.json")
        saveFile(snippets, name: "snippets.json")
        saveFile(stats, name: "stats.json")
        saveFile(appUsage, name: "app_usage.json")
        
        let defaults = UserDefaults(suiteName: "group.com.parayu.app") ?? UserDefaults.standard
        defaults.set(aiCleanup, forKey: "aiCleanup")
        defaults.set(dictationMode, forKey: "dictationMode")
        defaults.set(selectedModel, forKey: "selectedModel")
        defaults.set(inputLanguage, forKey: "inputLanguage")
        defaults.set(translateMalayalam, forKey: "translateMalayalam")
        defaults.set(onboarded, forKey: "onboarded")
        defaults.set(userName, forKey: "userName")
    }
    
    public func loadAll() {
        history = loadFile("history.json") ?? []
        dictionary = loadFile("dictionary.json") ?? []
        snippets = loadFile("snippets.json") ?? []
        stats = loadFile("stats.json") ?? Stats()
        appUsage = loadFile("app_usage.json") ?? [:]
        
        let defaults = UserDefaults(suiteName: "group.com.parayu.app") ?? UserDefaults.standard
        if defaults.object(forKey: "aiCleanup") != nil {
            aiCleanup = defaults.bool(forKey: "aiCleanup")
        }
        if let dm = defaults.string(forKey: "dictationMode") {
            dictationMode = dm
        }
        if let sm = defaults.string(forKey: "selectedModel") {
            selectedModel = sm
        }
        if let il = defaults.string(forKey: "inputLanguage") {
            inputLanguage = il
        }
        if defaults.object(forKey: "translateMalayalam") != nil {
            translateMalayalam = defaults.bool(forKey: "translateMalayalam")
        }
        onboarded = defaults.bool(forKey: "onboarded")
        if let name = defaults.string(forKey: "userName") {
            userName = name
        }
    }

    /// Lightweight persistence for small preferences (avoids rewriting all JSON files).
    public func persistName() {
        let defaults = UserDefaults(suiteName: "group.com.parayu.app") ?? UserDefaults.standard
        defaults.set(userName, forKey: "userName")
    }

    /// Friendly greeting for the dashboard header.
    public var greeting: String {
        let trimmed = userName.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? "Welcome back 👋" : "Hello, \(trimmed) 👋"
    }
    
    private func saveFile<T: Encodable>(_ data: T, name: String) {
        let url = appSupportURL.appendingPathComponent(name)
        do {
            let encoded = try JSONEncoder().encode(data)
            try encoded.write(to: url, options: .atomic)
        } catch {
            print("Error saving \(name): \(error)")
        }
    }
    
    private func loadFile<T: Decodable>(_ name: String) -> T? {
        let url = appSupportURL.appendingPathComponent(name)
        guard fileManager.fileExists(atPath: url.path) else { return nil }
        do {
            let data = try Data(contentsOf: url)
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            print("Error loading \(name): \(error)")
            return nil
        }
    }
    
    public func addHistoryEntry(rawText: String, finalText: String, durationSec: Double, wordsCorrected: Int, dictionaryFixes: Int, shareTarget: String?) {
        let words = finalText.split(separator: " ").filter { !$0.isEmpty }.count
        let entry = HistoryEntry(
            id: UUID().uuidString,
            text: finalText,
            rawText: rawText,
            timestamp: Date(),
            words: words,
            durationSec: durationSec
        )
        history.insert(entry, at: 0)
        if history.count > 1000 {
            history = Array(history.prefix(1000))
        }
        
        // Update stats
        let today = Date().toDateString()
        if stats.lastActiveDate != today {
            let yesterday = Calendar.current.date(byAdding: .day, value: -1, to: Date())?.toDateString()
            stats.streak = stats.lastActiveDate == yesterday ? stats.streak + 1 : 1
            stats.lastActiveDate = today
        }
        stats.totalWords += words
        stats.longestStreak = max(stats.longestStreak, stats.streak)
        stats.speakingSeconds += durationSec
        stats.wordsCorrected += wordsCorrected
        stats.dictionaryFixes += dictionaryFixes
        
        if let target = shareTarget {
            var entry = appUsage[target] ?? AppUsageEntry()
            entry.words += words
            entry.count += 1
            appUsage[target] = entry
        }
        
        saveAll()
    }

    @MainActor
    public func openKeyboardHandoff() {
        inputLanguage = "ml"
        translateMalayalam = true
        keyboardHandoffActive = true
        saveAll()
    }

    @MainActor
    public func handlePendingShortcutActionIfNeeded() {
        let defaults = UserDefaults(suiteName: "group.com.parayu.app") ?? UserDefaults.standard
        guard let action = defaults.string(forKey: ParayuShortcutBridge.pendingActionKey), !action.isEmpty else {
            return
        }

        defaults.removeObject(forKey: ParayuShortcutBridge.pendingActionKey)
        defaults.synchronize()

        switch action {
        case "dictate", "clipboard", "malayalamToEnglish":
            openKeyboardHandoff()
        default:
            break
        }
    }
}

extension Date {
    func toDateString() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: self)
    }
}
