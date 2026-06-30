import SwiftUI

struct HistoryRow: View {
    let entry: HistoryEntry
    var onDelete: () -> Void
    var onCopy: () -> Void

    @State private var isExpanded = false

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Text(entry.timestamp, style: .date)
                    .font(ParayuTheme.font(11, .bold))
                    .foregroundColor(ParayuTheme.muted)
                Text(entry.timestamp, style: .time)
                    .font(ParayuTheme.font(11, .semibold))
                    .foregroundColor(ParayuTheme.faint)
                Spacer()
                Text("\(entry.words) words")
                    .font(ParayuTheme.font(10, .bold))
                    .foregroundColor(ParayuTheme.accent)
                    .padding(.horizontal, 8).padding(.vertical, 3)
                    .background(Capsule().fill(ParayuTheme.accentSoft))
                Button(action: onCopy) {
                    Image(systemName: "doc.on.doc.fill")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(ParayuTheme.accent)
                        .frame(width: 30, height: 30)
                        .background(Circle().fill(ParayuTheme.accentSoft))
                }
                .buttonStyle(.plain)
            }

            Text(entry.text)
                .font(ParayuTheme.font(15, .medium))
                .foregroundColor(ParayuTheme.text)
                .lineLimit(isExpanded ? nil : 2)
                .frame(maxWidth: .infinity, alignment: .leading)
                .lineSpacing(2)

            if isExpanded {
                VStack(alignment: .leading, spacing: 8) {
                    Divider().background(ParayuTheme.hair)
                    SectionLabel(text: "RAW TRANSCRIPT")
                    Text(entry.rawText.isEmpty ? "None (identical)" : entry.rawText)
                        .font(ParayuTheme.font(13, .medium))
                        .foregroundColor(ParayuTheme.muted)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    HStack(spacing: 10) {
                        Spacer()
                        Button(action: onDelete) {
                            HStack(spacing: 5) {
                                Image(systemName: "trash.fill")
                                Text("Delete")
                            }
                            .font(ParayuTheme.font(12, .bold))
                            .foregroundColor(ParayuTheme.accent)
                            .padding(.horizontal, 12).padding(.vertical, 7)
                            .background(Capsule().fill(ParayuTheme.accentSoft))
                        }
                        .buttonStyle(.plain)
                    }
                }
                .transition(.opacity)
            }

            HStack {
                Spacer()
                Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundColor(ParayuTheme.faint)
                Spacer()
            }
        }
        .parayuCard(padding: 15, radius: 18)
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(isExpanded ? ParayuTheme.accent.opacity(0.3) : Color.clear, lineWidth: 1)
        )
        .contentShape(Rectangle())
        .onTapGesture {
            withAnimation(.spring(response: 0.28, dampingFraction: 0.8)) { isExpanded.toggle() }
        }
    }
}

struct HistoryView: View {
    @EnvironmentObject var state: AppState
    @State private var searchText = ""
    @State private var showCopiedAlert = false

    var filteredHistory: [HistoryEntry] {
        if searchText.isEmpty { return state.history }
        return state.history.filter {
            $0.text.localizedCaseInsensitiveContains(searchText) ||
            $0.rawText.localizedCaseInsensitiveContains(searchText)
        }
    }

    var body: some View {
        VStack(spacing: 14) {
            ScreenHeader(title: "History",
                         subtitle: state.history.isEmpty ? "Your saved translations"
                                                          : "\(state.history.count) saved \(state.history.count == 1 ? "translation" : "translations")")
                .padding(.horizontal, 18)
                .padding(.top, 14)

            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(ParayuTheme.faint)
                TextField("Search history", text: $searchText)
                    .font(ParayuTheme.font(15, .medium))
                    .foregroundColor(ParayuTheme.text)
                    .autocorrectionDisabled(true)
                if !searchText.isEmpty {
                    Button { searchText = "" } label: {
                        Image(systemName: "xmark.circle.fill").foregroundColor(ParayuTheme.faint)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 13).padding(.vertical, 11)
            .background(ParayuTheme.card)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(ParayuTheme.hair, lineWidth: 1))
            .softShadow()
            .padding(.horizontal, 18)

            if filteredHistory.isEmpty {
                emptyState
            } else {
                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(filteredHistory) { entry in
                            HistoryRow(
                                entry: entry,
                                onDelete: {
                                    if let idx = state.history.firstIndex(where: { $0.id == entry.id }) {
                                        withAnimation { _ = state.history.remove(at: idx) }
                                        state.saveAll()
                                    }
                                },
                                onCopy: { copy(entry.text) }
                            )
                        }
                    }
                    .padding(.horizontal, 18)
                    .padding(.top, 2)
                    .clearsFloatingTabBar()
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(ParayuTheme.bg.ignoresSafeArea())
        .overlay(copiedToast)
    }

    private var emptyState: some View {
        VStack(spacing: 14) {
            Spacer()
            IconBadge(system: searchText.isEmpty ? "clock.arrow.circlepath" : "magnifyingglass",
                      tint: ParayuTheme.muted, size: 64, iconScale: 0.42)
            Text(searchText.isEmpty ? "No history yet" : "No matches found")
                .font(ParayuTheme.font(16, .bold))
                .foregroundColor(ParayuTheme.text)
            Text(searchText.isEmpty ? "Your translations will appear here." : "Try a different search.")
                .font(ParayuTheme.font(13, .medium))
                .foregroundColor(ParayuTheme.muted)
            Spacer()
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var copiedToast: some View {
        Group {
            if showCopiedAlert {
                VStack {
                    HStack(spacing: 8) {
                        Image(systemName: "checkmark.circle.fill").foregroundColor(.white)
                        Text("Copied to clipboard")
                            .font(ParayuTheme.font(14, .bold))
                            .foregroundColor(.white)
                    }
                    .padding(.horizontal, 20).padding(.vertical, 12)
                    .background(Capsule().fill(ParayuTheme.text.opacity(0.92)))
                    .softShadow(strong: true)
                }
                .transition(.scale.combined(with: .opacity))
                .zIndex(100)
            }
        }
    }

    private func copy(_ text: String) {
        UIPasteboard.general.string = text
        let gen = UINotificationFeedbackGenerator(); gen.notificationOccurred(.success)
        withAnimation { showCopiedAlert = true }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
            withAnimation { self.showCopiedAlert = false }
        }
    }
}
