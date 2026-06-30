import SwiftUI

// MARK: - WPM gauge (top semicircle speedometer)
struct WpmGauge: View {
    var wpm: Double
    var body: some View {
        ZStack {
            Circle()
                .trim(from: 0.5, to: 1.0)
                .stroke(ParayuTheme.hair, style: StrokeStyle(lineWidth: 9, lineCap: .round))
                .rotationEffect(.degrees(180))

            Circle()
                .trim(from: 0.5, to: 0.5 + min(0.5, (wpm / 160.0) * 0.5))
                .stroke(
                    LinearGradient(colors: [ParayuTheme.purple, ParayuTheme.accentPink, ParayuTheme.accentRed],
                                   startPoint: .leading, endPoint: .trailing),
                    style: StrokeStyle(lineWidth: 9, lineCap: .round)
                )
                .rotationEffect(.degrees(180))
                .animation(.spring(response: 0.6, dampingFraction: 0.8), value: wpm)

            VStack(spacing: 0) {
                Spacer()
                Text(String(format: "%.0f", wpm))
                    .font(ParayuTheme.font(30, .extrabold))
                    .foregroundColor(ParayuTheme.text)
                Text("WPM")
                    .font(ParayuTheme.font(9, .bold))
                    .tracking(1)
                    .foregroundColor(ParayuTheme.faint)
            }
            .offset(y: 10)
        }
    }
}

// MARK: - Activity heatmap
struct StreakHeatmap: View {
    let history: [HistoryEntry]
    private let weeks = 13
    private let cell: CGFloat = 13
    private let gap: CGFloat = 4

    private var columns: [[Date]] {
        let cal = Calendar.current
        let now = Date()
        let weekday = cal.component(.weekday, from: now) - 1
        guard let startOfWeek = cal.date(byAdding: .day, value: -weekday, to: cal.startOfDay(for: now)) else { return [] }
        guard let start = cal.date(byAdding: .weekOfYear, value: -(weeks - 1), to: startOfWeek) else { return [] }

        var cols: [[Date]] = []
        for w in 0..<weeks {
            var col: [Date] = []
            for d in 0..<7 {
                if let date = cal.date(byAdding: .day, value: w * 7 + d, to: start) {
                    col.append(date)
                }
            }
            cols.append(col)
        }
        return cols
    }

    private func words(on date: Date) -> Int {
        let key = date.toDateString()
        return history.filter { $0.timestamp.toDateString() == key }.reduce(0) { $0 + $1.words }
    }

    private func level(_ w: Int) -> Int {
        if w == 0 { return 0 }
        if w < 20 { return 1 }
        if w < 50 { return 2 }
        if w < 100 { return 3 }
        return 4
    }

    func color(_ level: Int) -> Color {
        switch level {
        case 0: return ParayuTheme.surface
        case 1: return ParayuTheme.accent.opacity(0.22)
        case 2: return ParayuTheme.accent.opacity(0.5)
        case 3: return ParayuTheme.accentPink
        default: return ParayuTheme.purple
        }
    }

    var body: some View {
        HStack(alignment: .top, spacing: gap) {
            VStack(spacing: gap) {
                ForEach(["S","M","T","W","T","F","S"], id: \.self) { d in
                    Text(d)
                        .font(ParayuTheme.font(8, .bold))
                        .foregroundColor(ParayuTheme.faint)
                        .frame(width: 12, height: cell)
                }
            }
            GeometryReader { geo in
                let available = geo.size.width
                let count = max(1, min(columns.count, Int((available + gap) / (cell + gap))))
                let shown = Array(columns.suffix(count))
                HStack(spacing: gap) {
                    ForEach(Array(shown.enumerated()), id: \.offset) { _, col in
                        VStack(spacing: gap) {
                            ForEach(col, id: \.self) { date in
                                RoundedRectangle(cornerRadius: 4, style: .continuous)
                                    .fill(color(level(words(on: date))))
                                    .frame(width: cell, height: cell)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 4, style: .continuous)
                                            .stroke(Calendar.current.isDateInToday(date) ? ParayuTheme.text.opacity(0.55) : Color.clear, lineWidth: 1)
                                    )
                            }
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .trailing)
            }
            .frame(height: cell * 7 + gap * 6)
        }
    }
}

// MARK: - Metric tile
struct MetricTile: View {
    let label: String
    let value: String
    let sublabel: String
    let icon: String
    let tint: Color
    var sublabelColor: Color = ParayuTheme.faint

    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            IconBadge(system: icon, tint: tint, size: 34, iconScale: 0.5)
            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(ParayuTheme.font(9, .bold))
                    .tracking(0.4)
                    .foregroundColor(ParayuTheme.faint)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                Text(value)
                    .font(ParayuTheme.font(18, .extrabold))
                    .foregroundColor(ParayuTheme.text)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                Text(sublabel)
                    .font(ParayuTheme.font(9, .semibold))
                    .foregroundColor(sublabelColor)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
        }
        .frame(maxWidth: .infinity, minHeight: 96, alignment: .topLeading)
        .parayuCard(padding: 13, radius: 18)
    }
}

struct HomeView: View {
    @EnvironmentObject var state: AppState
    @State private var showNotifications = false

    private var speakingMinutes: Double { Double(state.stats.speakingSeconds) / 60.0 }
    private var averageWPM: Double {
        guard state.stats.speakingSeconds > 0 else { return 0 }
        return Double(state.stats.totalWords) / speakingMinutes
    }

    // % of words that needed no correction — an honest "clean transcription" proxy.
    private var accuracy: Int {
        let total = state.stats.totalWords
        guard total > 0 else { return 100 }
        let fixes = state.stats.wordsCorrected + state.stats.dictionaryFixes
        return Int((max(0, min(1, 1 - Double(fixes) / Double(total)))) * 100)
    }
    private var accuracyLabel: String {
        if accuracy >= 95 { return "Excellent" }
        if accuracy >= 85 { return "Good" }
        return "Fair"
    }

    private func wpm(_ entries: [HistoryEntry]) -> Double {
        let secs = entries.reduce(0) { $0 + $1.durationSec }
        guard secs > 0 else { return 0 }
        let words = entries.reduce(0) { $0 + $1.words }
        return Double(words) / (secs / 60.0)
    }
    private var wpmTrend: Double? {
        let cal = Calendar.current
        let now = Date()
        guard let week = cal.date(byAdding: .day, value: -7, to: now),
              let twoWeeks = cal.date(byAdding: .day, value: -14, to: now) else { return nil }
        let last = state.history.filter { $0.timestamp >= week }
        let prev = state.history.filter { $0.timestamp >= twoWeeks && $0.timestamp < week }
        let prevWPM = wpm(prev)
        guard prevWPM > 0 else { return nil }
        return (wpm(last) - prevWPM) / prevWPM * 100
    }
    private var trendText: String {
        guard let t = wpmTrend else { return "New" }
        return String(format: "%+.0f%%", t)
    }

    private var didDictateToday: Bool {
        state.stats.lastActiveDate == Date().toDateString()
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header

                heroRow

                streakCard

                metricsGrid

                sharingTally
            }
            .padding(.horizontal, 18)
            .padding(.top, 14)
            .clearsFloatingTabBar()
        }
        .background(ParayuTheme.bg.ignoresSafeArea())
        .sheet(isPresented: $showNotifications) {
            NotificationsSheet()
                .environmentObject(state)
                .presentationDetents([.medium, .large])
        }
    }

    // MARK: Header
    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .center, spacing: 12) {
                IconBadge(system: "sparkles", tint: ParayuTheme.accent, size: 46, iconScale: 0.45)
                VStack(alignment: .leading, spacing: 1) {
                    Text(state.greeting)
                        .font(ParayuTheme.font(12, .bold))
                        .foregroundColor(ParayuTheme.muted)
                    Text("Dashboard")
                        .font(ParayuTheme.font(28, .extrabold))
                        .foregroundColor(ParayuTheme.text)
                }
                Spacer()
                Button { showNotifications = true } label: {
                    ZStack(alignment: .topTrailing) {
                        IconBadge(system: "bell", tint: ParayuTheme.text, size: 44, iconScale: 0.42)
                        if !didDictateToday {
                            Circle().fill(ParayuTheme.accent)
                                .frame(width: 9, height: 9)
                                .overlay(Circle().stroke(Color.white, lineWidth: 1.5))
                                .offset(x: 1, y: -1)
                        }
                    }
                }
                .buttonStyle(.plain)
            }
            Text("Your Malayalam to English dictation insights")
                .font(ParayuTheme.font(13, .medium))
                .foregroundColor(ParayuTheme.muted)
        }
    }

    // MARK: Hero row
    private var heroRow: some View {
        HStack(spacing: 12) {
            // Total words
            ZStack(alignment: .bottomTrailing) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("TOTAL WORDS")
                        .font(ParayuTheme.font(10, .bold)).tracking(0.6)
                        .foregroundColor(ParayuTheme.faint)
                    Text("\(state.stats.totalWords)")
                        .font(ParayuTheme.font(42, .extrabold))
                        .foregroundStyle(ParayuTheme.accentGradient)
                        .minimumScaleFactor(0.5)
                        .lineLimit(1)
                    Text("Transcribed & translated")
                        .font(ParayuTheme.font(11, .semibold))
                        .foregroundColor(ParayuTheme.muted)
                    Spacer(minLength: 0)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)

                IconBadge(system: "doc.text.fill", tint: ParayuTheme.accent, size: 34, iconScale: 0.46)
            }
            .padding(16)
            .frame(maxWidth: .infinity)
            .frame(height: 188)
            .background(ParayuTheme.card)
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(ParayuTheme.hair, lineWidth: 1))
            .softShadow()

            // Average WPM
            VStack(spacing: 8) {
                Text("AVERAGE WPM")
                    .font(ParayuTheme.font(10, .bold)).tracking(0.6)
                    .foregroundColor(ParayuTheme.faint)
                WpmGauge(wpm: averageWPM)
                    .frame(height: 74)
                HStack(spacing: 4) {
                    Image(systemName: (wpmTrend ?? 0) >= 0 ? "arrow.up.right" : "arrow.down.right")
                        .font(.system(size: 10, weight: .bold))
                    Text(wpmTrend == nil ? "Start dictating" : "\(trendText) vs last week")
                        .font(ParayuTheme.font(10, .bold))
                }
                .foregroundColor((wpmTrend ?? 0) >= 0 ? ParayuTheme.success : ParayuTheme.accent)
                .padding(.horizontal, 10).padding(.vertical, 5)
                .background(Capsule().fill(ParayuTheme.surface))
            }
            .padding(16)
            .frame(maxWidth: .infinity)
            .frame(height: 188)
            .background(ParayuTheme.card)
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(ParayuTheme.hair, lineWidth: 1))
            .softShadow()
        }
    }

    // MARK: Streak card
    private var streakCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text("Activity")
                    .font(ParayuTheme.font(16, .bold))
                    .foregroundColor(ParayuTheme.text)
                Spacer()
                HStack(spacing: 5) {
                    Image(systemName: "flame.fill").foregroundColor(ParayuTheme.orange)
                    Text("\(state.stats.streak) day streak")
                        .font(ParayuTheme.font(13, .bold))
                        .foregroundColor(ParayuTheme.text)
                }
            }
            StreakHeatmap(history: state.history)
            HStack(spacing: 5) {
                Text("Less")
                ForEach([ParayuTheme.surface, ParayuTheme.accent.opacity(0.22), ParayuTheme.accent.opacity(0.5), ParayuTheme.accentPink, ParayuTheme.purple], id: \.self) { c in
                    RoundedRectangle(cornerRadius: 3, style: .continuous).fill(c).frame(width: 11, height: 11)
                }
                Text("More")
            }
            .font(ParayuTheme.font(9, .bold))
            .foregroundColor(ParayuTheme.faint)
        }
        .parayuCard(padding: 17, radius: 22)
    }

    // MARK: Metrics
    private var metricsGrid: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 3), spacing: 10) {
            MetricTile(label: "SPEAKING", value: formatSpeakingTime(), sublabel: "Total time", icon: "clock.fill", tint: ParayuTheme.green)
            MetricTile(label: "FIXES MADE", value: "\(state.stats.wordsCorrected + state.stats.dictionaryFixes)", sublabel: "Total", icon: "sparkles", tint: ParayuTheme.accent)
            MetricTile(label: "LONGEST", value: "\(state.stats.longestStreak)d", sublabel: "Best streak", icon: "flame.fill", tint: ParayuTheme.orange)
            MetricTile(label: "DICTIONARY", value: "\(state.dictionary.count)", sublabel: "Rules", icon: "character.book.closed.fill", tint: ParayuTheme.purple)
            MetricTile(label: "ACCURACY", value: "\(accuracy)%", sublabel: accuracyLabel, icon: "checkmark.seal.fill", tint: ParayuTheme.blue, sublabelColor: accuracy >= 95 ? ParayuTheme.success : ParayuTheme.faint)
            MetricTile(label: "WPM TREND", value: trendText, sublabel: "vs last week", icon: "chart.line.uptrend.xyaxis", tint: ParayuTheme.purple)
        }
    }

    // MARK: Sharing tally
    private var sharingTally: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Sharing tally")
                .font(ParayuTheme.font(16, .bold))
                .foregroundColor(ParayuTheme.text)

            if state.appUsage.isEmpty {
                HStack(spacing: 10) {
                    IconBadge(system: "paperplane.fill", tint: ParayuTheme.muted, size: 38, iconScale: 0.42)
                    Text("Share a translation and it'll show up here.")
                        .font(ParayuTheme.font(12, .medium))
                        .foregroundColor(ParayuTheme.muted)
                    Spacer()
                }
            } else {
                VStack(spacing: 14) {
                    ForEach(state.appUsage.sorted(by: { $0.value.words > $1.value.words }), id: \.key) { key, entry in
                        HStack(spacing: 12) {
                            IconBadge(system: appIcon(key), tint: appTint(key), size: 38, iconScale: 0.42)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(key)
                                    .font(ParayuTheme.font(14, .bold))
                                    .foregroundColor(ParayuTheme.text)
                                Text("\(entry.count) \(entry.count == 1 ? "share" : "shares")")
                                    .font(ParayuTheme.font(11, .medium))
                                    .foregroundColor(ParayuTheme.muted)
                            }
                            Spacer()
                            Text("\(entry.words) words")
                                .font(ParayuTheme.font(13, .bold))
                                .foregroundColor(ParayuTheme.text)
                            Image(systemName: "chevron.right")
                                .font(.system(size: 11, weight: .bold))
                                .foregroundColor(ParayuTheme.faint)
                        }
                    }
                }
            }
        }
        .parayuCard(padding: 17, radius: 22)
    }

    // MARK: Helpers
    private func formatSpeakingTime() -> String {
        let sec = state.stats.speakingSeconds
        return sec < 60 ? String(format: "%.0fs", sec) : String(format: "%.1fm", sec / 60.0)
    }
    private func appIcon(_ name: String) -> String {
        switch name.lowercased() {
        case "whatsapp": return "message.fill"
        case "notes": return "square.and.pencil"
        case "messages": return "bubble.left.and.bubble.right.fill"
        case "clipboard": return "doc.on.doc.fill"
        default: return "square.and.arrow.up.fill"
        }
    }
    private func appTint(_ name: String) -> Color {
        switch name.lowercased() {
        case "whatsapp": return ParayuTheme.whatsapp
        case "notes": return ParayuTheme.orange
        case "messages": return ParayuTheme.blue
        case "clipboard": return ParayuTheme.muted
        default: return ParayuTheme.purple
        }
    }
}

// MARK: - Notifications sheet (bell)
struct NotificationsSheet: View {
    @EnvironmentObject var state: AppState
    @Environment(\.dismiss) private var dismiss

    private var didDictateToday: Bool { state.stats.lastActiveDate == Date().toDateString() }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Text("Notifications")
                        .font(ParayuTheme.font(22, .extrabold))
                        .foregroundColor(ParayuTheme.text)
                    Spacer()
                    Button { dismiss() } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 26))
                            .foregroundColor(ParayuTheme.faint)
                    }
                    .buttonStyle(.plain)
                }

                row(icon: "flame.fill", tint: ParayuTheme.orange,
                    title: didDictateToday ? "You're on a \(state.stats.streak)-day streak" : "Keep your streak alive",
                    body: didDictateToday ? "Nice work today — come back tomorrow to grow it." : "Dictate once today to keep your \(state.stats.streak)-day streak going.")

                if let last = state.history.first {
                    row(icon: "checkmark.seal.fill", tint: ParayuTheme.blue,
                        title: "Last translation",
                        body: "\(last.words) words • \(relative(last.timestamp))")
                }

                row(icon: "lightbulb.fill", tint: ParayuTheme.purple,
                    title: "Tip",
                    body: "Add dictionary rules in Settings to auto-fix names and terms you use often.")

                Spacer(minLength: 8)
            }
            .padding(20)
        }
        .background(ParayuTheme.bg.ignoresSafeArea())
    }

    private func row(icon: String, tint: Color, title: String, body: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            IconBadge(system: icon, tint: tint, size: 40, iconScale: 0.44)
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(ParayuTheme.font(14, .bold))
                    .foregroundColor(ParayuTheme.text)
                Text(body)
                    .font(ParayuTheme.font(12, .medium))
                    .foregroundColor(ParayuTheme.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer()
        }
        .parayuCard(padding: 14, radius: 16)
    }

    private func relative(_ date: Date) -> String {
        let f = RelativeDateTimeFormatter()
        f.unitsStyle = .full
        return f.localizedString(for: date, relativeTo: Date())
    }
}
