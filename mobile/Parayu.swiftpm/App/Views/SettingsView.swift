import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var state: AppState
    @StateObject private var downloader = WhisperModelDownloader()
    @State private var downloadModelId = ""
    @State private var showResetAlert = false

    private let HF_BASE = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/"

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {

                    ScreenHeader(title: "Settings", subtitle: "Personalize Parayu")
                        .padding(.top, 14)

                    // Profile
                    VStack(alignment: .leading, spacing: 12) {
                        SectionLabel(text: "PROFILE")
                        HStack(spacing: 12) {
                            IconBadge(system: "person.fill", tint: ParayuTheme.accent, size: 44, iconScale: 0.45)
                            VStack(alignment: .leading, spacing: 4) {
                                TextField("Your name", text: $state.userName)
                                    .font(ParayuTheme.font(16, .bold))
                                    .foregroundColor(ParayuTheme.text)
                                    .autocorrectionDisabled(true)
                                    .onChange(of: state.userName) { _ in state.persistName() }
                                Text("Shown on your dashboard greeting")
                                    .font(ParayuTheme.font(11, .medium))
                                    .foregroundColor(ParayuTheme.muted)
                            }
                        }
                    }
                    .parayuCard()

                    // SECTION 1: Dictation Settings
                    VStack(alignment: .leading, spacing: 14) {
                        SectionLabel(text: "DICTATION")

                        // Input Language
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Input Language")
                                .font(ParayuTheme.font(14, .semibold))
                                .foregroundColor(ParayuTheme.text)

                            Picker("Input Language", selection: $state.inputLanguage) {
                                Text("Malayalam").tag("ml")
                                Text("English").tag("en")
                            }
                            .pickerStyle(SegmentedPickerStyle())
                            .onChange(of: state.inputLanguage) { _ in
                                state.saveAll()
                            }

                            if state.inputLanguage == "ml" {
                                Toggle(isOn: $state.translateMalayalam) {
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text("Translate to English")
                                            .font(ParayuTheme.font(13, .semibold))
                                            .foregroundColor(ParayuTheme.text)
                                        Text("Translate spoken Malayalam to English instead of transcribing in Malayalam script.")
                                            .font(ParayuTheme.font(11, .regular))
                                            .foregroundColor(ParayuTheme.muted)
                                    }
                                }
                                .toggleStyle(SwitchToggleStyle(tint: ParayuTheme.accent))
                                .padding(.top, 6)
                                .onChange(of: state.translateMalayalam) { _ in
                                    state.saveAll()
                                }
                            }
                        }

                        Divider().background(ParayuTheme.border)

                        // Dictation Mode
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Trigger Mode")
                                .font(ParayuTheme.font(14, .semibold))
                                .foregroundColor(ParayuTheme.text)

                            Picker("Trigger Mode", selection: $state.dictationMode) {
                                Text("Tap to Toggle").tag("toggle")
                                Text("Hold to Speak").tag("hold")
                            }
                            .pickerStyle(SegmentedPickerStyle())
                            .onChange(of: state.dictationMode) { _ in
                                state.saveAll()
                            }
                        }

                        Divider().background(ParayuTheme.border)

                        // AI Cleanup
                        Toggle(isOn: $state.aiCleanup) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("AI Punctuation & Cleanup")
                                    .font(ParayuTheme.font(14, .semibold))
                                    .foregroundColor(ParayuTheme.text)
                                Text("Post-process to remove filler words and fix capitalization/punctuation.")
                                    .font(ParayuTheme.font(11, .regular))
                                    .foregroundColor(ParayuTheme.muted)
                            }
                        }
                        .toggleStyle(SwitchToggleStyle(tint: ParayuTheme.accent))
                        .onChange(of: state.aiCleanup) { _ in
                            state.saveAll()
                        }
                    }
                    .parayuCard()

                    // SECTION 2: Custom Text Expanders
                    VStack(alignment: .leading, spacing: 12) {
                        SectionLabel(text: "CUSTOMIZATIONS")

                        NavigationLink(destination: DictionaryView()) {
                            settingsLinkRow(icon: "character.book.closed.fill", tint: ParayuTheme.purple, title: "Dictionary rules", count: state.dictionary.count)
                        }
                        .buttonStyle(.plain)

                        Divider().background(ParayuTheme.hair)

                        NavigationLink(destination: SnippetsView()) {
                            settingsLinkRow(icon: "text.append", tint: ParayuTheme.blue, title: "Text snippets", count: state.snippets.count)
                        }
                        .buttonStyle(.plain)
                    }
                    .parayuCard()

                    // SECTION 3: Brain Switch — offline speech models (matches the macOS app)
                    BrainSwitchSection(downloader: downloader,
                                       downloadModelId: $downloadModelId,
                                       onDownload: triggerDownload)

                    // SECTION 4: Developer Actions
                    VStack(alignment: .leading, spacing: 14) {
                        SectionLabel(text: "APP MAINTENANCE")

                        Button(action: { showResetAlert = true }) {
                            HStack(spacing: 10) {
                                IconBadge(system: "arrow.counterclockwise", tint: ParayuTheme.accent, size: 32, iconScale: 0.5)
                                Text("Reset onboarding flow")
                                    .font(ParayuTheme.font(14, .semibold))
                                    .foregroundColor(ParayuTheme.text)
                                Spacer()
                            }
                        }
                        .buttonStyle(.plain)
                    }
                    .parayuCard()

                    // Keyboard Diagnostics
                    VStack(alignment: .leading, spacing: 14) {
                        SectionLabel(text: "DIAGNOSTICS")

                        NavigationLink(destination: KeyboardLogView()) {
                            HStack(spacing: 10) {
                                IconBadge(system: "terminal", tint: ParayuTheme.muted, size: 32, iconScale: 0.5)
                                Text("Keyboard debug logs")
                                    .font(ParayuTheme.font(14, .semibold))
                                    .foregroundColor(ParayuTheme.text)
                                Spacer()
                                Image(systemName: "chevron.right").font(.caption).foregroundColor(ParayuTheme.faint)
                            }
                        }
                        .buttonStyle(.plain)
                    }
                    .parayuCard()
                }
                .padding(.horizontal, 18)
                .clearsFloatingTabBar()
            }
            .background(ParayuTheme.bg.ignoresSafeArea())
            .toolbar(.hidden, for: .navigationBar)
            .alert(isPresented: $showResetAlert) {
                Alert(
                    title: Text("Reset App Onboarding?"),
                    message: Text("This will return you to the setup wizard. Your data (history, snippets) will be preserved."),
                    primaryButton: .destructive(Text("Reset")) {
                        state.onboarded = false
                        state.saveAll()
                    },
                    secondaryButton: .cancel()
                )
            }
        }
    }

    private func settingsLinkRow(icon: String, tint: Color, title: String, count: Int) -> some View {
        HStack(spacing: 10) {
            IconBadge(system: icon, tint: tint, size: 32, iconScale: 0.5)
            Text(title)
                .font(ParayuTheme.font(14, .semibold))
                .foregroundColor(ParayuTheme.text)
            Spacer()
            Text("\(count)")
                .font(ParayuTheme.font(12, .bold))
                .foregroundColor(ParayuTheme.faint)
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundColor(ParayuTheme.faint)
        }
    }

    private func triggerDownload(model: WhisperModelInfo) {
        let urlString = HF_BASE + model.file
        guard let url = URL(string: urlString) else { return }

        downloadModelId = model.id

        downloader.downloadModel(url: url) { tempUrl, error in
            if let error = error {
                print("Download failed: \(error.localizedDescription)")
                return
            }

            guard let tempUrl = tempUrl else { return }

            let dest = WhisperModelInfo.modelPath(file: model.file)
            do {
                if FileManager.default.fileExists(atPath: dest.path) {
                    try FileManager.default.removeItem(at: dest)
                }
                try FileManager.default.moveItem(at: tempUrl, to: dest)

                // Set active model automatically
                state.selectedModel = model.id
                state.saveAll()
            } catch {
                print("Failed to save downloaded model: \(error)")
            }
        }
    }
}

// MARK: - Brain Switch (mirrors the macOS desktop model picker)
struct BrainSwitchSection: View {
    @EnvironmentObject var state: AppState
    @ObservedObject var downloader: WhisperModelDownloader
    @Binding var downloadModelId: String
    var onDownload: (WhisperModelInfo) -> Void

    @State private var previewId: String = ""
    @State private var showEnglish: Bool = false

    private var visibleModels: [WhisperModelInfo] {
        WHISPER_MODELS.filter { $0.isEnglishOnly == showEnglish }
    }

    private var preview: WhisperModelInfo {
        visibleModels.first { $0.id == previewId }
            ?? visibleModels.first { $0.id == state.selectedModel }
            ?? visibleModels.first
            ?? WHISPER_MODELS[0]
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 3) {
                Text("Brain Switch")
                    .font(ParayuTheme.font(14, .extrabold))
                    .foregroundColor(ParayuTheme.text)
                Text("Choose offline speech models.")
                    .font(ParayuTheme.font(11, .medium))
                    .foregroundColor(ParayuTheme.muted)
            }

            Picker("", selection: $showEnglish) {
                Text("Multilingual").tag(false)
                Text("English only").tag(true)
            }
            .pickerStyle(.segmented)
            .onChange(of: showEnglish) { _ in
                let set = WHISPER_MODELS.filter { $0.isEnglishOnly == showEnglish }
                if !set.contains(where: { $0.id == previewId }) {
                    previewId = set.first(where: { $0.id == state.selectedModel })?.id ?? set.first?.id ?? previewId
                }
            }

            VStack(spacing: 8) {
                ForEach(visibleModels) { m in
                    selectorRow(m)
                }
            }

            if showEnglish {
                Text("English-only models are faster and sharper for English, but can't do Malayalam.")
                    .font(ParayuTheme.font(11, .regular))
                    .foregroundColor(ParayuTheme.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }

            detailCard(preview)
        }
        .parayuCard()
        .onAppear {
            if previewId.isEmpty {
                previewId = state.selectedModel
                showEnglish = WHISPER_MODELS.first { $0.id == state.selectedModel }?.isEnglishOnly ?? false
            }
        }
    }

    @ViewBuilder
    private func selectorRow(_ m: WhisperModelInfo) -> some View {
        let isSel = (preview.id == m.id)
        Button {
            withAnimation(.easeInOut(duration: 0.18)) { previewId = m.id }
        } label: {
            HStack(spacing: 8) {
                Text(m.label)
                    .font(ParayuTheme.font(13, .bold))
                    .foregroundColor(ParayuTheme.text)
                Text(formatBytes(m.bytes))
                    .font(ParayuTheme.font(11, .semibold))
                    .foregroundColor(ParayuTheme.muted)
                Spacer()
                stateIcon(m)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 11)
            .background(isSel ? ParayuTheme.accentSoft : ParayuTheme.card)
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .stroke(isSel ? ParayuTheme.accent : ParayuTheme.border, lineWidth: 1.5)
            )
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private func stateIcon(_ m: WhisperModelInfo) -> some View {
        if downloader.isDownloading && downloadModelId == m.id {
            Text("\(Int(downloader.progress * 100))%")
                .font(ParayuTheme.font(10, .bold))
                .foregroundColor(ParayuTheme.accent)
        } else if state.selectedModel == m.id {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 15))
                .foregroundColor(ParayuTheme.accent)
        } else if m.isDownloaded {
            Image(systemName: "checkmark")
                .font(.system(size: 13, weight: .bold))
                .foregroundColor(ParayuTheme.success)
        } else {
            Image(systemName: "arrow.down.circle")
                .font(.system(size: 15))
                .foregroundColor(ParayuTheme.muted)
        }
    }

    @ViewBuilder
    private func detailCard(_ m: WhisperModelInfo) -> some View {
        let isActive = (state.selectedModel == m.id)
        VStack(alignment: .leading, spacing: 9) {
            HStack(spacing: 6) {
                Text(m.label)
                    .font(ParayuTheme.font(14, .extrabold))
                    .foregroundColor(ParayuTheme.text)
                Text(formatBytes(m.bytes))
                    .font(ParayuTheme.font(11, .semibold))
                    .foregroundColor(ParayuTheme.muted)
                if m.label == "HIGH" {
                    Text("Recommended")
                        .font(ParayuTheme.font(10, .bold))
                        .foregroundColor(ParayuTheme.accent)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(ParayuTheme.accentSoft)
                        .cornerRadius(6)
                }
                Spacer()
            }

            Text(m.desc)
                .font(ParayuTheme.font(12, .semibold))
                .foregroundColor(ParayuTheme.text)
                .fixedSize(horizontal: false, vertical: true)

            VStack(alignment: .leading, spacing: 5) {
                ForEach(m.bullets, id: \.self) { b in
                    HStack(alignment: .top, spacing: 7) {
                        Circle()
                            .fill(ParayuTheme.muted)
                            .frame(width: 3, height: 3)
                            .padding(.top, 6)
                        Text(b)
                            .font(ParayuTheme.font(11, .regular))
                            .foregroundColor(ParayuTheme.muted)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
            .padding(.top, 2)

            Divider().background(ParayuTheme.border).padding(.top, 2)

            HStack {
                Text(statusText(m))
                    .font(ParayuTheme.font(10, .bold))
                    .foregroundColor(ParayuTheme.muted)
                    .textCase(.uppercase)
                    .tracking(0.4)
                Spacer()
                actionControl(m)
            }
        }
        .padding(15)
        .background(isActive ? ParayuTheme.accentSoft : ParayuTheme.card)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(isActive ? ParayuTheme.accent : ParayuTheme.border, lineWidth: 1.5)
        )
    }

    private func statusText(_ m: WhisperModelInfo) -> String {
        if downloader.isDownloading && downloadModelId == m.id { return "Downloading" }
        if state.selectedModel == m.id { return "Currently Active" }
        if m.isDownloaded { return "Ready to Use" }
        return "Needs Download"
    }

    @ViewBuilder
    private func actionControl(_ m: WhisperModelInfo) -> some View {
        if downloader.isDownloading && downloadModelId == m.id {
            HStack(spacing: 6) {
                ProgressView(value: downloader.progress, total: 1.0)
                    .frame(width: 64)
                    .tint(ParayuTheme.accent)
                Text("\(Int(downloader.progress * 100))%")
                    .font(ParayuTheme.font(11, .bold))
                    .foregroundColor(ParayuTheme.muted)
            }
        } else if state.selectedModel == m.id {
            HStack(spacing: 5) {
                Image(systemName: "checkmark.circle.fill")
                Text("Active")
            }
            .font(ParayuTheme.font(13, .bold))
            .foregroundColor(ParayuTheme.accent)
        } else if m.isDownloaded {
            Button {
                state.selectedModel = m.id
                state.saveAll()
            } label: {
                Text("Use this model")
                    .font(ParayuTheme.font(12, .bold))
                    .foregroundColor(.white)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(ParayuTheme.accentGradient)
                    .cornerRadius(8)
            }
        } else {
            Button {
                onDownload(m)
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "arrow.down.circle")
                    Text("Download")
                }
                .font(ParayuTheme.font(12, .bold))
                .foregroundColor(ParayuTheme.accent)
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(ParayuTheme.accentSoft)
                .cornerRadius(8)
            }
        }
    }

    private func formatBytes(_ bytes: Int64) -> String {
        let gb = 1024.0 * 1024.0 * 1024.0
        if Double(bytes) >= gb {
            return String(format: "%.1f GB", Double(bytes) / gb)
        }
        return "\(Int((Double(bytes) / (1024.0 * 1024.0)).rounded())) MB"
    }
}

struct KeyboardLogView: View {
    @State private var logs: String = "No logs yet. Try using the keyboard first."

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text("Keyboard Diagnostic Logs")
                        .font(ParayuTheme.font(17, .bold))
                        .foregroundColor(ParayuTheme.text)
                    Spacer()
                    Button("Refresh") {
                        loadLogs()
                    }
                    .foregroundColor(ParayuTheme.accent)
                }

                Text(logs)
                    .font(.system(.footnote, design: .monospaced))
                    .foregroundColor(ParayuTheme.text)
                    .padding()
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(ParayuTheme.card)
                    .cornerRadius(8)
                    .overlay(
                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                            .stroke(ParayuTheme.border, lineWidth: 1)
                    )

                Button("Clear Logs", role: .destructive) {
                    clearLogs()
                }
                .padding(.top, 8)
            }
            .padding()
            .clearsFloatingTabBar()
        }
        .background(ParayuTheme.bg.ignoresSafeArea())
        .navigationTitle("Diagnostics")
        .onAppear {
            loadLogs()
        }
    }

    private func loadLogs() {
        let appGroupId = "group.com.parayu.app"
        guard let groupURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupId) else {
            logs = "App Group group.com.parayu.app is not accessible."
            return
        }
        let logURL = groupURL.appendingPathComponent("keyboard_log.txt")
        if let content = try? String(contentsOf: logURL, encoding: .utf8) {
            let lines = content.components(separatedBy: "\n").filter { !$0.isEmpty }
            logs = lines.isEmpty ? "Log file is empty." : lines.reversed().joined(separator: "\n")
        } else {
            logs = "No log file found at: \(logURL.lastPathComponent)"
        }
    }

    private func clearLogs() {
        let appGroupId = "group.com.parayu.app"
        guard let groupURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupId) else { return }
        let logURL = groupURL.appendingPathComponent("keyboard_log.txt")
        try? "".write(to: logURL, atomically: true, encoding: .utf8)
        loadLogs()
    }
}
