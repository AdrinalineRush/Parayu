import SwiftUI

struct DictionaryView: View {
    @EnvironmentObject var state: AppState
    @State private var fromText = ""
    @State private var toText = ""
    @State private var errorMessage = ""

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                // Form card
                VStack(alignment: .leading, spacing: 12) {
                    SectionLabel(text: "ADD REPLACEMENT RULE")

                    TextField("Spoken word (e.g. apple)", text: $fromText)
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

                    TextField("Replace with (e.g. Apple)", text: $toText)
                        .parayuField()
                        .autocorrectionDisabled(true)

                    Button(action: addRule) {
                        Text("Add replacement")
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

                if state.dictionary.isEmpty {
                    emptyState
                } else {
                    VStack(spacing: 10) {
                        HStack {
                            SectionLabel(text: "\(state.dictionary.count) \(state.dictionary.count == 1 ? "RULE" : "RULES")")
                            Spacer()
                        }
                        ForEach(state.dictionary) { rule in
                            ruleCard(rule)
                        }
                    }
                }
            }
            .padding(.horizontal, 18)
            .padding(.top, 14)
            .clearsFloatingTabBar()
        }
        .background(ParayuTheme.bg.ignoresSafeArea())
        .navigationTitle("Dictionary Rules")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func ruleCard(_ rule: DictionaryRule) -> some View {
        HStack(spacing: 12) {
            IconBadge(system: "textformat", tint: ParayuTheme.purple, size: 38, iconScale: 0.42)
            VStack(alignment: .leading, spacing: 2) {
                Text(rule.from)
                    .font(ParayuTheme.font(15, .bold))
                    .foregroundColor(ParayuTheme.text)
                    .lineLimit(1)
                Text("Spoken")
                    .font(ParayuTheme.font(10, .semibold))
                    .foregroundColor(ParayuTheme.faint)
            }
            Image(systemName: "arrow.right")
                .font(.system(size: 12, weight: .bold))
                .foregroundColor(ParayuTheme.faint)
            VStack(alignment: .leading, spacing: 2) {
                Text(rule.to)
                    .font(ParayuTheme.font(15, .bold))
                    .foregroundColor(ParayuTheme.accent)
                    .lineLimit(1)
                Text("Becomes")
                    .font(ParayuTheme.font(10, .semibold))
                    .foregroundColor(ParayuTheme.faint)
            }
            Spacer(minLength: 4)
            Button { delete(rule) } label: {
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
            IconBadge(system: "character.book.closed.fill", tint: ParayuTheme.purple, size: 60, iconScale: 0.42)
            Text("No dictionary rules yet")
                .font(ParayuTheme.font(15, .bold))
                .foregroundColor(ParayuTheme.text)
            Text("Rules replace specific words in the final output text.")
                .font(ParayuTheme.font(12, .medium))
                .foregroundColor(ParayuTheme.muted)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 30)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 30)
    }

    private func addRule() {
        let from = fromText.trimmingCharacters(in: .whitespacesAndNewlines)
        let to = toText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !from.isEmpty, !to.isEmpty else {
            errorMessage = "Both fields are required."
            return
        }
        if state.dictionary.contains(where: { $0.from.lowercased() == from.lowercased() }) {
            errorMessage = "A replacement for '\(from)' already exists."
            return
        }
        withAnimation { state.dictionary.append(DictionaryRule(from: from, to: to)) }
        state.saveAll()
        fromText = ""; toText = ""; errorMessage = ""
    }

    private func delete(_ rule: DictionaryRule) {
        if let idx = state.dictionary.firstIndex(where: { $0.id == rule.id }) {
            withAnimation { _ = state.dictionary.remove(at: idx) }
            state.saveAll()
        }
    }
}
