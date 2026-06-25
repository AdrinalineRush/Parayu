import Foundation

public struct TextProcessor {
    private static let fillers = [
        "um", "uh", "erm", "uhh", "umm", "hmm", "mhm",
        "like", "you know", "i mean", "sort of", "kind of",
        "basically", "actually", "literally", "right"
    ]
    
    public static func normalizeWhitespace(_ text: String) -> String {
        return text.replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
    }
    
    public static func removeFillers(_ text: String) -> String {
        var out = text
        for filler in fillers {
            let pattern = "(^|[\\s,])(\(NSRegularExpression.escapedPattern(for: filler)))(?=[\\s,.!?]|$)"
            if let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive) {
                out = regex.stringByReplacingMatches(in: out, options: [], range: NSRange(location: 0, length: out.utf16.count), withTemplate: "$1")
            }
        }
        if let puncRegex = try? NSRegularExpression(pattern: "\\s+([,.!?])", options: []) {
            out = puncRegex.stringByReplacingMatches(in: out, options: [], range: NSRange(location: 0, length: out.utf16.count), withTemplate: "$1")
        }
        return normalizeWhitespace(out)
    }
    
    public static func removeRepeats(_ text: String) -> String {
        let pattern = "\\b(\\w+)(\\s+\\1\\b)+"
        if let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive) {
            return regex.stringByReplacingMatches(in: text, options: [], range: NSRange(location: 0, length: text.utf16.count), withTemplate: "$1")
        }
        return text
    }
    
    public static func fixCapitalization(_ text: String) -> String {
        var out = text
        let pattern = "(^\\s*|[.!?]\\s+)([a-z])"
        if let regex = try? NSRegularExpression(pattern: pattern, options: []) {
            let nsString = out as NSString
            let matches = regex.matches(in: out, options: [], range: NSRange(location: 0, length: out.utf16.count))
            for match in matches.reversed() {
                let range2 = match.range(at: 2)
                let char = nsString.substring(with: range2).uppercased()
                out = (out as NSString).replacingCharacters(in: range2, with: char)
            }
        }
        if let iRegex = try? NSRegularExpression(pattern: "\\bi\\b", options: []) {
            out = iRegex.stringByReplacingMatches(in: out, options: [], range: NSRange(location: 0, length: out.utf16.count), withTemplate: "I")
        }
        return out
    }
    
    public static func ensureTerminalPunctuation(_ text: String) -> String {
        guard !text.isEmpty else { return text }
        if let regex = try? NSRegularExpression(pattern: "[.!?]$", options: []) {
            let match = regex.firstMatch(in: text, options: [], range: NSRange(location: 0, length: text.utf16.count))
            if match != nil {
                return text
            }
        }
        return text + "."
    }
    
    public static func fixPunctuationSpacing(_ text: String) -> String {
        var out = text
        if let r1 = try? NSRegularExpression(pattern: "\\s+([,.!?;:])", options: []) {
            out = r1.stringByReplacingMatches(in: out, options: [], range: NSRange(location: 0, length: out.utf16.count), withTemplate: "$1")
        }
        if let r2 = try? NSRegularExpression(pattern: "([,.!?;:])(?=[^\\s])", options: []) {
            out = r2.stringByReplacingMatches(in: out, options: [], range: NSRange(location: 0, length: out.utf16.count), withTemplate: "$1 ")
        }
        return normalizeWhitespace(out)
    }
    
    public static func cleanup(_ text: String) -> String {
        guard !text.isEmpty else { return text }
        var out = normalizeWhitespace(text)
        out = removeRepeats(out)
        out = removeFillers(out)
        out = fixPunctuationSpacing(out)
        out = fixCapitalization(out)
        out = ensureTerminalPunctuation(out)
        return out
    }
    
    public static func applyDictionary(text: String, rules: [DictionaryRule]) -> (text: String, count: Int) {
        var out = text
        var count = 0
        for rule in rules {
            guard !rule.from.isEmpty else { continue }
            let escapedFrom = NSRegularExpression.escapedPattern(for: rule.from)
            let pattern = "\\b\(escapedFrom)\\b"
            if let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive) {
                let matches = regex.matches(in: out, options: [], range: NSRange(location: 0, length: out.utf16.count))
                if !matches.isEmpty {
                    count += matches.count
                    out = regex.stringByReplacingMatches(in: out, options: [], range: NSRange(location: 0, length: out.utf16.count), withTemplate: rule.to)
                }
            }
        }
        return (out, count)
    }
    
    public static func applySnippets(text: String, snippets: [Snippet]) -> (text: String, count: Int) {
        var out = text
        var count = 0
        for snippet in snippets {
            guard !snippet.trigger.isEmpty else { continue }
            let escapedTrigger = NSRegularExpression.escapedPattern(for: snippet.trigger)
            let pattern = "\\b\(escapedTrigger)\\b"
            if let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive) {
                let matches = regex.matches(in: out, options: [], range: NSRange(location: 0, length: out.utf16.count))
                if !matches.isEmpty {
                    count += matches.count
                    out = regex.stringByReplacingMatches(in: out, options: [], range: NSRange(location: 0, length: out.utf16.count), withTemplate: snippet.expansion)
                }
            }
        }
        return (out, count)
    }
}
