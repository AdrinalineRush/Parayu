import SwiftUI

struct WpmGauge: View {
    var wpm: Double
    
    var body: some View {
        ZStack {
            Circle()
                .trim(from: 0.5, to: 1.0)
                .stroke(Color.secondary.opacity(0.2), style: StrokeStyle(lineWidth: 8, lineCap: .round))
                .rotationEffect(.degrees(180))
            
            Circle()
                .trim(from: 0.5, to: 0.5 + min(0.5, (wpm / 150.0) * 0.5))
                .stroke(
                    LinearGradient(
                        gradient: Gradient(colors: [Color(red: 224/255, green: 30/255, blue: 65/255), Color(red: 160/255, green: 43/255, blue: 176/255)]),
                        startPoint: .leading,
                        endPoint: .trailing
                    ),
                    style: StrokeStyle(lineWidth: 8, lineCap: .round)
                )
                .rotationEffect(.degrees(180))
                .animation(.spring(), value: wpm)
            
            VStack {
                Spacer()
                Text(String(format: "%.0f", wpm))
                    .font(.system(size: 24, weight: .heavy, design: .rounded))
                Text("WPM")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundColor(.secondary)
            }
            .offset(y: 8)
        }
    }
}

struct StreakHeatmap: View {
    let history: [HistoryEntry]
    
    var dateGrid: [[Date]] {
        let calendar = Calendar.current
        var grid: [[Date]] = Array(repeating: [], count: 7)
        
        let now = Date()
        let weekday = calendar.component(.weekday, from: now)
        let daysToSubtract = weekday - 1
        guard let startOfThisWeek = calendar.date(byAdding: .day, value: -daysToSubtract, to: now) else { return grid }
        guard let startDate = calendar.date(byAdding: .weekOfYear, value: -13, to: startOfThisWeek) else { return grid }
        
        for d in 0..<98 {
            if let date = calendar.date(byAdding: .day, value: d, to: startDate) {
                let wday = calendar.component(.weekday, from: date) - 1
                grid[wday].append(date)
            }
        }
        return grid
    }
    
    func wordsOnDate(_ date: Date) -> Int {
        let targetStr = date.toDateString()
        return history
            .filter { $0.timestamp.toDateString() == targetStr }
            .reduce(0) { $0 + $1.words }
    }
    
    func levelForWords(_ words: Int) -> Int {
        if words == 0 { return 0 }
        if words < 20 { return 1 }
        if words < 50 { return 2 }
        if words < 100 { return 3 }
        return 4
    }
    
    var body: some View {
        HStack(spacing: 4) {
            VStack(alignment: .leading, spacing: 3) {
                Text("S").frame(height: 10)
                Text("M").frame(height: 10)
                Text("T").frame(height: 10)
                Text("W").frame(height: 10)
                Text("T").frame(height: 10)
                Text("F").frame(height: 10)
                Text("S").frame(height: 10)
            }
            .font(.system(size: 8, weight: .bold))
            .foregroundColor(.secondary)
            .padding(.trailing, 4)
            
            VStack(alignment: .leading, spacing: 3) {
                ForEach(0..<7) { row in
                    HStack(spacing: 3) {
                        let dates = dateGrid[row]
                        ForEach(dates, id: \.self) { date in
                            let words = wordsOnDate(date)
                            let level = levelForWords(words)
                            
                            RoundedRectangle(cornerRadius: 1.5)
                                .fill(heatmapColor(for: level))
                                .frame(width: 10, height: 10)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 1.5)
                                        .stroke(Calendar.current.isDateInToday(date) ? Color.white : Color.clear, lineWidth: 0.8)
                                )
                        }
                    }
                }
            }
        }
    }
    
    func heatmapColor(for level: Int) -> Color {
        switch level {
        case 0: return Color.white.opacity(0.06)
        case 1: return Color(red: 224/255, green: 30/255, blue: 65/255).opacity(0.2)
        case 2: return Color(red: 224/255, green: 30/255, blue: 65/255).opacity(0.5)
        case 3: return Color(red: 224/255, green: 30/255, blue: 65/255).opacity(0.8)
        default: return Color(red: 160/255, green: 43/255, blue: 176/255)
        }
    }
}

struct StatCard: View {
    let title: String
    let value: String
    let icon: String
    let iconColor: Color
    
    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 8)
                    .fill(iconColor.opacity(0.12))
                    .frame(width: 36, height: 36)
                
                Image(systemName: icon)
                    .font(.body)
                    .foregroundColor(iconColor)
            }
            
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 10, weight: .bold))
                    .foregroundColor(.secondary)
                    .textCase(.uppercase)
                Text(value)
                    .font(.system(size: 14, weight: .bold, design: .rounded))
                    .foregroundColor(.primary)
            }
            Spacer()
        }
        .padding()
        .background(Color.white.opacity(0.04))
        .cornerRadius(14)
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(Color.white.opacity(0.06), lineWidth: 1)
        )
    }
}

struct HomeView: View {
    @EnvironmentObject var state: AppState
    
    var speakingMinutes: Double {
        return Double(state.stats.speakingSeconds) / 60.0
    }
    
    var averageWPM: Double {
        guard state.stats.speakingSeconds > 0 else { return 0 }
        return Double(state.stats.totalWords) / speakingMinutes
    }
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    // Header text
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Dashboard")
                            .font(.system(size: 28, weight: .black, design: .rounded))
                            .foregroundColor(.white)
                        Text("Your Malayalam to English dictation insights")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundColor(.secondary)
                    }
                    .padding(.horizontal)
                    .padding(.top, 16)
                    
                    // Main stats row
                    HStack(spacing: 14) {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Total Words")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(.secondary)
                                .textCase(.uppercase)
                                .tracking(0.5)
                            Text("\(state.stats.totalWords)")
                                .font(.system(size: 38, weight: .heavy, design: .rounded))
                                .foregroundColor(.white)
                            Text("Transcribed & Translated")
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundColor(.secondary)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding()
                        .background(Color.white.opacity(0.04))
                        .cornerRadius(16)
                        .overlay(
                            RoundedRectangle(cornerRadius: 16)
                                .stroke(Color.white.opacity(0.06), lineWidth: 1)
                        )
                        
                        VStack(spacing: 8) {
                            WpmGauge(wpm: averageWPM)
                                .frame(height: 80)
                            Text("Average WPM")
                                .font(.system(size: 11, weight: .bold))
                                .foregroundColor(.secondary)
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.white.opacity(0.04))
                        .cornerRadius(16)
                        .overlay(
                            RoundedRectangle(cornerRadius: 16)
                                .stroke(Color.white.opacity(0.06), lineWidth: 1)
                        )
                    }
                    .padding(.horizontal)
                    
                    // Streak heat map
                    VStack(alignment: .leading, spacing: 14) {
                        HStack {
                            Text("Streak Calendar")
                                .font(.system(size: 15, weight: .bold))
                                .foregroundColor(.white)
                            Spacer()
                            HStack(spacing: 4) {
                                Image(systemName: "flame.fill")
                                    .foregroundColor(.orange)
                                Text("\(state.stats.streak) Day Streak")
                                    .font(.system(size: 13, weight: .bold))
                                    .foregroundColor(.white)
                            }
                        }
                        
                        StreakHeatmap(history: state.history)
                            .padding(.vertical, 4)
                        
                        HStack(spacing: 4) {
                            Text("Less")
                            RoundedRectangle(cornerRadius: 1.5).fill(Color.white.opacity(0.06)).frame(width: 8, height: 8)
                            RoundedRectangle(cornerRadius: 1.5).fill(Color(red: 224/255, green: 30/255, blue: 65/255).opacity(0.2)).frame(width: 8, height: 8)
                            RoundedRectangle(cornerRadius: 1.5).fill(Color(red: 224/255, green: 30/255, blue: 65/255).opacity(0.5)).frame(width: 8, height: 8)
                            RoundedRectangle(cornerRadius: 1.5).fill(Color(red: 224/255, green: 30/255, blue: 65/255).opacity(0.8)).frame(width: 8, height: 8)
                            RoundedRectangle(cornerRadius: 1.5).fill(Color(red: 160/255, green: 43/255, blue: 176/255)).frame(width: 8, height: 8)
                            Text("More")
                        }
                        .font(.system(size: 9, weight: .semibold))
                        .foregroundColor(.secondary)
                    }
                    .padding()
                    .background(Color.white.opacity(0.04))
                    .cornerRadius(16)
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .stroke(Color.white.opacity(0.06), lineWidth: 1)
                    )
                    .padding(.horizontal)
                    
                    // Stat cards grid
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 14) {
                        StatCard(title: "Speaking Time", value: formatSpeakingTime(), icon: "clock.fill", iconColor: .green)
                        StatCard(title: "Fixes Made", value: "\(state.stats.wordsCorrected + state.stats.dictionaryFixes)", icon: "sparkles", iconColor: .yellow)
                        StatCard(title: "Longest Streak", value: "\(state.stats.longestStreak) Days", icon: "flame.fill", iconColor: .orange)
                        StatCard(title: "Dictionary Rules", value: "\(state.dictionary.count)", icon: "character.book.closed.fill", iconColor: .blue)
                    }
                    .padding(.horizontal)
                    
                    // Share targets
                    VStack(alignment: .leading, spacing: 14) {
                        Text("Sharing Tally")
                            .font(.system(size: 15, weight: .bold))
                            .foregroundColor(.white)
                        
                        if state.appUsage.isEmpty {
                            Text("Share your translations to populate this tally.")
                                .font(.system(size: 12, weight: .medium))
                                .foregroundColor(.secondary)
                                .padding(.vertical, 8)
                        } else {
                            VStack(spacing: 12) {
                                ForEach(state.appUsage.sorted(by: { $0.value.words > $1.value.words }), id: \.key) { key, entry in
                                    HStack(spacing: 12) {
                                        ZStack {
                                            RoundedRectangle(cornerRadius: 6)
                                                .fill(appBgColor(for: key))
                                                .frame(width: 28, height: 28)
                                            Image(systemName: appIconName(for: key))
                                                .font(.system(size: 13, weight: .bold))
                                                .foregroundColor(.white)
                                        }
                                        
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(key)
                                                .font(.system(size: 13, weight: .bold))
                                                .foregroundColor(.white)
                                            Text("\(entry.count) shares")
                                                .font(.system(size: 11))
                                                .foregroundColor(.secondary)
                                        }
                                        
                                        Spacer()
                                        
                                        Text("\(entry.words) words")
                                            .font(.system(size: 13, weight: .bold, design: .rounded))
                                            .foregroundColor(.white)
                                    }
                                }
                            }
                        }
                    }
                    .padding()
                    .background(Color.white.opacity(0.04))
                    .cornerRadius(16)
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .stroke(Color.white.opacity(0.06), lineWidth: 1)
                    )
                    .padding(.horizontal)
                    .padding(.bottom, 24)
                }
            }
            .background(Color.black.ignoresSafeArea())
            .navigationBarHidden(true)
        }
    }
    
    private func formatSpeakingTime() -> String {
        let sec = state.stats.speakingSeconds
        if sec < 60 {
            return String(format: "%.0fs", sec)
        } else {
            return String(format: "%.1fm", sec / 60.0)
        }
    }
    
    private func appIconName(for name: String) -> String {
        switch name.lowercased() {
        case "whatsapp": return "message.fill"
        case "notes": return "square.and.pencil"
        case "messages": return "bubble.left.and.bubble.right.fill"
        case "clipboard": return "doc.on.doc.fill"
        default: return "square.and.arrow.up.fill"
        }
    }
    
    private func appBgColor(for name: String) -> Color {
        switch name.lowercased() {
        case "whatsapp": return .green
        case "notes": return .yellow
        case "messages": return .blue
        case "clipboard": return .gray
        default: return .purple
        }
    }
}
