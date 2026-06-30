import SwiftUI

struct SnippetsView: View {
    @EnvironmentObject var state: AppState
    @State private var triggerText = ""
    @State private var expansionText = ""
    @State private var errorMessage = ""

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                // Form card
                VStack(alignment: .leading, spacing: 12) {
                    SectionLabel(text: "ADD TEXT SNIPPET")

                    TextField("Abbreviation trigger (e.g. btw)", text: $triggerText)
                        .parayuField()
                        .autocorrectionDisabled(true)
                        .textInputAutocapitalization(.never)

                    HStack {
                        Spacer()
                        Image(systemName: "arrow.down")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(ParayuTheme.faint)
                            .frame(width: 26, height: 26)
                            .background(Circle().fill(ParayuTheme.surface))
                        Spacer()
                    }

                    TextField("Full expansion (e.g. by the way)", text: $expansionText)
                        .parayuField()
                        .autocorrectionDisabled(true)

                    Button(action: addSnippet) {
                        Text("Add snippet")
                            .font(ParayuTheme.font(14, .bold))
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 13)
                            .background(ParayuTheme.accentGradient)
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    }
                    .buttonStyle(.plain)

                    if !errorMessage.isEmpty {
                        Text(errorMessage)
                            .font(ParayuTheme.font(12, .semibold))
                            .foregroundColor(ParayuTheme.accent)
                    }
                }
                .parayuCard(padding: 16, radius: 20)

                if state.snippets.isEmpty {
                    emptyState
                } else {
                    VStack(spacing: 10) {
                        HStack {
                            SectionLabel(text: "\(state.snippets.count) \(state.snippets.count == 1 ? "SNIPPET" : "SNIPPETS")")
                            Spacer()
                        }
                        ForEach(state.snippets) { snippet in
                            snippetCard(snippet)
                        }
                    }
                }
            }
            .padding(.horizontal, 18)
            .padding(.top, 14)
            .clearsFloatingTabBar()
        }
        .background(ParayuTheme.bg.ignoresSafeArea())
        .navigationTitle("Text Snippets")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func snippetCard(_ snippet: Snippet) -> some View {
        HStack(spacing: 12) {
            IconBadge(system: "text.append", tint: ParayuTheme.blue, size: 38, iconScale: 0.42)
            VStack(alignment: .leading, spacing: 2) {
                Text(snippet.trigger)
                    .font(ParayuTheme.font(15, .bold))
                    .foregroundColor(ParayuTheme.text)
                    .lineLimit(1)
                Text(snippet.expansion)
                    .font(ParayuTheme.font(12, .medium))
                    .foregroundColor(ParayuTheme.muted)
                    .lineLimit(1)
            }
            Spacer(minLength: 4)
            Button { delete(snippet) } label: {
                Image(systemName: "trash")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(ParayuTheme.faint)
                    .frame(width: 32, height: 32)
                    .background(Circle().fill(ParayuTheme.surface))
            }
            .buttonStyle(.plain)
        }
        .parayuCard(padding: 13, radius: 16)
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            IconBadge(system: "text.badge.plus", tint: ParayuTheme.blue, size: 60, iconScale: 0.42)
            Text("No snippets yet")
                .font(ParayuTheme.font(15, .bold))
                .foregroundColor(ParayuTheme.text)
            Text("Snippets expand short triggers into their full versions automatically.")
                .font(ParayuTheme.font(12, .medium))
                .foregroundColor(ParayuTheme.muted)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 30)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 30)
    }

    private func addSnippet() {
        let trigger = triggerText.trimmingCharacters(in: .whitespacesAndNewlines)
        let expansion = expansionText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trigger.isEmpty, !expansion.isEmpty else {
            errorMessage = "Both fields are required."
            return
        }
        if state.snippets.contains(where: { $0.trigger.lowercased() == trigger.lowercased() }) {
            errorMessage = "A snippet with trigger '\(trigger)' already exists."
            return
        }
        withAnimation { state.snippets.append(Snippet(trigger: trigger, expansion: expansion)) }
        state.saveAll()
        triggerText = ""; expansionText = ""; errorMessage = ""
    }

    private func delete(_ snippet: Snippet) {
        if let idx = state.snippets.firstIndex(where: { $0.id == snippet.id }) {
            withAnimation { _ = state.snippets.remove(at: idx) }
            state.saveAll()
        }
    }
}
