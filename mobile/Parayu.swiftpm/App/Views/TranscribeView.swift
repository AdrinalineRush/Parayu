import SwiftUI
import AVFoundation

// MARK: - Live waveform (calm dots when idle, animated bars while recording)
struct WaveformView: View {
    var audioLevel: Float
    var isRecording: Bool

    var body: some View {
        HStack(spacing: 5) {
            ForEach(0..<19) { index in
                let factor = CGFloat(sin(Double(index) * 0.35) * 0.4 + 0.6)
                let height = isRecording ? max(5, 8 + CGFloat(audioLevel) * 70 * factor) : 5
                Capsule()
                    .fill(isRecording
                          ? AnyShapeStyle(LinearGradient(colors: [ParayuTheme.accent, ParayuTheme.purple], startPoint: .top, endPoint: .bottom))
                          : AnyShapeStyle(ParayuTheme.accent.opacity(0.18)))
                    .frame(width: 4, height: height)
                    .animation(.interactiveSpring(response: 0.15, dampingFraction: 0.55), value: height)
            }
        }
        .frame(height: 64)
    }
}

// MARK: - Record button (hold or tap) with halo ring
struct RecordButton: View {
    @EnvironmentObject var state: AppState
    @ObservedObject var recorder: AudioRecorder
    var action: () -> Void
    var stopAction: () -> Void

    var body: some View {
        if state.dictationMode == "hold" {
            buttonImage
                .gesture(
                    DragGesture(minimumDistance: 0)
                        .onChanged { _ in if !recorder.isRecording { action() } }
                        .onEnded { _ in if recorder.isRecording { stopAction() } }
                )
        } else {
            Button { recorder.isRecording ? stopAction() : action() } label: { buttonImage }
                .buttonStyle(.plain)
        }
    }

    private var buttonImage: some View {
        ZStack {
            if recorder.isRecording {
                Circle()
                    .stroke(ParayuTheme.accent.opacity(0.28), lineWidth: 4)
                    .frame(width: 104, height: 104)
                    .scaleEffect(1.0 + CGFloat(recorder.audioLevel) * 0.45)
                    .animation(.easeInOut(duration: 0.15), value: recorder.audioLevel)
            } else {
                Circle()
                    .stroke(ParayuTheme.accent.opacity(0.16), style: StrokeStyle(lineWidth: 1.5, dash: [2, 5]))
                    .frame(width: 118, height: 118)
            }

            Circle()
                .fill(Color.white)
                .frame(width: 104, height: 104)
                .softShadow(strong: true)

            Circle()
                .fill(LinearGradient(
                    colors: recorder.isRecording
                        ? [Color(red: 255/255, green: 77/255, blue: 77/255), ParayuTheme.accent]
                        : [ParayuTheme.accentRed, ParayuTheme.accentPink, ParayuTheme.purple],
                    startPoint: .topLeading, endPoint: .bottomTrailing))
                .frame(width: 88, height: 88)
                .shadow(color: ParayuTheme.accentPink.opacity(0.38), radius: 16, x: 0, y: 8)

            Image(systemName: recorder.isRecording ? "stop.fill" : "mic.fill")
                .font(.system(size: 30, weight: .semibold))
                .foregroundColor(.white)
        }
        .frame(width: 124, height: 124)
    }
}

struct ShareSheetWrapper: UIViewControllerRepresentable {
    let activityItems: [Any]
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: activityItems, applicationActivities: nil)
    }
    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

// MARK: - Secondary action tile
struct ActionTile: View {
    let icon: String
    let label: String
    let tint: Color
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundColor(tint)
                Text(label)
                    .font(ParayuTheme.font(12, .semibold))
                    .foregroundColor(ParayuTheme.text)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 15)
            .background(ParayuTheme.card)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(ParayuTheme.hair, lineWidth: 1))
            .softShadow()
        }
        .buttonStyle(.plain)
    }
}

struct TranscribeView: View {
    @EnvironmentObject var state: AppState
    @StateObject private var recorder = AudioRecorder()
    @StateObject private var speech = SpeechService()

    @State private var textOutput = ""
    @State private var rawTextResult = ""
    @State private var isProcessing = false
    @State private var processingJobID: UUID?
    @State private var activeTranslator: WhisperSpeechTranslator?
    @State private var secondsRecorded = 0.0
    @State private var timer: Timer? = nil
    @State private var lastResultDate: Date? = nil

    @State private var showShareSheet = false
    @State private var shareText = ""
    @State private var showCopiedAlert = false

    private let transcriptionTimeoutSeconds = 60.0

    private var hasText: Bool { !textOutput.isEmpty && !isProcessing }
    private var wordCount: Int { textOutput.split(whereSeparator: { $0 == " " || $0 == "\n" }).filter { !$0.isEmpty }.count }

    private var ttsLanguage: String {
        (state.inputLanguage == "ml" && !state.translateMalayalam) ? "ml-IN" : "en-US"
    }

    private var subheaderText: String {
        if state.inputLanguage == "ml" {
            return state.translateMalayalam ? "Malayalam speech, English text" : "Malayalam speech, Malayalam text"
        }
        return "English speech, English text"
    }
    private var badgeFrom: String { state.inputLanguage == "ml" ? "MAL" : "ENG" }
    private var badgeTo: String {
        if state.inputLanguage == "ml" { return state.translateMalayalam ? "ENG" : "MAL" }
        return "ENG"
    }
    private var resultTitleText: String {
        (state.inputLanguage == "ml" && !state.translateMalayalam) ? "TRANSCRIBED RESULT" : "TRANSLATED RESULT"
    }
    private var placeholderText: String {
        let verb = (state.inputLanguage == "ml" && state.translateMalayalam) ? "translate" : "transcribe"
        return state.dictationMode == "hold"
            ? "Hold the mic below to record, release to \(verb)."
            : "Tap the mic below to record, tap again to \(verb)."
    }
    private var controlHintLine1: String { state.dictationMode == "hold" ? "Hold to speak," : "Tap to record," }
    private var controlHintLine2: String {
        let verb = (state.inputLanguage == "ml" && state.translateMalayalam) ? "translate" : "transcribe"
        return state.dictationMode == "hold" ? "release to \(verb)" : "tap again to \(verb)"
    }

    var body: some View {
        VStack(spacing: 16) {
            header
            resultCard
                .frame(maxHeight: .infinity)
            if hasText {
                copyButton
                actionTiles
            }
            micSection
        }
        .padding(.horizontal, 18)
        .padding(.top, 14)
        .padding(.bottom, 4)
        .clearsFloatingTabBar()
        .background(ParayuTheme.bg.ignoresSafeArea())
        .sheet(isPresented: $showShareSheet) { ShareSheetWrapper(activityItems: [shareText]) }
        .overlay(copiedToast)
    }

    // MARK: Header
    private var header: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Transcribe")
                    .font(ParayuTheme.font(28, .extrabold))
                    .foregroundColor(ParayuTheme.text)
                Text(subheaderText)
                    .font(ParayuTheme.font(12, .semibold))
                    .foregroundColor(ParayuTheme.muted)
            }
            Spacer()
            HStack(spacing: 5) {
                Text(badgeFrom).foregroundColor(ParayuTheme.accent)
                Image(systemName: "arrow.right").font(.system(size: 11, weight: .bold)).foregroundColor(ParayuTheme.purple.opacity(0.8))
                Text(badgeTo).foregroundColor(ParayuTheme.purple)
            }
            .font(ParayuTheme.font(12, .extrabold))
            .tracking(0.4)
            .padding(.horizontal, 12).padding(.vertical, 8)
            .background(Capsule().fill(ParayuTheme.accentSoft))
            .overlay(Capsule().stroke(ParayuTheme.accent.opacity(0.14), lineWidth: 1))
        }
    }

    // MARK: Result card
    private var resultCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 9) {
                IconBadge(system: "sparkles", tint: ParayuTheme.accent, size: 28, iconScale: 0.5)
                Text(resultTitleText)
                    .font(ParayuTheme.font(11, .bold)).tracking(0.5)
                    .foregroundColor(ParayuTheme.accent)
                Spacer()
                if hasText {
                    Text("\(wordCount) \(wordCount == 1 ? "word" : "words")")
                        .font(ParayuTheme.font(11, .bold))
                        .foregroundColor(ParayuTheme.faint)
                }
            }

            if isProcessing {
                VStack(spacing: 14) {
                    Spacer()
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: ParayuTheme.accent))
                        .scaleEffect(1.2)
                    Text(state.currentStatusText)
                        .font(ParayuTheme.font(13, .bold))
                        .foregroundColor(ParayuTheme.text)
                    if state.downloadPhase == "downloading" {
                        ProgressView(value: state.downloadProgress, total: 1.0)
                            .tint(ParayuTheme.accent)
                            .padding(.horizontal, 30)
                    }
                    Spacer()
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ZStack(alignment: .topLeading) {
                    if textOutput.isEmpty {
                        Text(placeholderText)
                            .font(ParayuTheme.font(15, .medium))
                            .foregroundColor(ParayuTheme.faint)
                            .padding(.top, 8)
                            .padding(.horizontal, 5)
                    }
                    TextEditor(text: $textOutput)
                        .font(ParayuTheme.font(19, .medium))
                        .foregroundColor(ParayuTheme.text)
                        .scrollContentBackground(.hidden)
                        .background(Color.clear)
                        .lineSpacing(3)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            }

            if hasText {
                Divider().background(ParayuTheme.hair)
                HStack {
                    Image(systemName: "waveform")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(ParayuTheme.faint)
                    Text(timeLabel)
                        .font(ParayuTheme.font(12, .semibold))
                        .foregroundColor(ParayuTheme.muted)
                    Spacer()
                    circleButton(icon: speech.isSpeaking ? "stop.fill" : "speaker.wave.2.fill",
                                 active: speech.isSpeaking) {
                        speech.toggle(textOutput, language: ttsLanguage)
                    }
                    circleButton(icon: "doc.on.doc.fill", active: false) {
                        copyToClipboard(logStats: true)
                    }
                }
            }
        }
        .parayuCard(padding: 18, radius: 22, strongShadow: true)
    }

    private func circleButton(icon: String, active: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 14, weight: .bold))
                .foregroundColor(active ? .white : ParayuTheme.accent)
                .frame(width: 38, height: 38)
                .background(Circle().fill(active ? ParayuTheme.accent : ParayuTheme.accentSoft))
                .overlay(Circle().stroke(active ? Color.clear : ParayuTheme.accent.opacity(0.12), lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private var timeLabel: String {
        guard let date = lastResultDate else { return "Ready" }
        if Date().timeIntervalSince(date) < 60 { return "Just now" }
        let f = RelativeDateTimeFormatter()
        f.unitsStyle = .short
        return f.localizedString(for: date, relativeTo: Date())
    }

    // MARK: Primary + secondary actions
    private var copyButton: some View {
        Button { copyToClipboard(logStats: true) } label: {
            HStack(spacing: 9) {
                Image(systemName: "doc.on.doc.fill").font(.system(size: 17, weight: .semibold))
                Text("Copy text").font(ParayuTheme.font(16, .bold))
            }
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(ParayuTheme.accentGradient)
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .shadow(color: ParayuTheme.accentPink.opacity(0.3), radius: 14, x: 0, y: 8)
        }
        .buttonStyle(.plain)
    }

    private var actionTiles: some View {
        HStack(spacing: 10) {
            ActionTile(icon: "message.fill", label: "WhatsApp", tint: ParayuTheme.whatsapp) {
                shareToApp(name: "WhatsApp", urlScheme: "whatsapp://send?text=\(encodeString(textOutput))")
            }
            ActionTile(icon: "bubble.left.fill", label: "Messages", tint: ParayuTheme.blue) {
                shareToApp(name: "Messages", urlScheme: "sms:&body=\(encodeString(textOutput))")
            }
            ActionTile(icon: "square.and.arrow.up", label: "Share", tint: ParayuTheme.purple) {
                shareText = textOutput
                state.addHistoryEntry(rawText: rawTextResult, finalText: textOutput, durationSec: secondsRecorded, wordsCorrected: 0, dictionaryFixes: 0, shareTarget: "Share Sheet")
                showShareSheet = true
            }
        }
    }

    // MARK: Mic section
    private var micSection: some View {
        VStack(spacing: 12) {
            WaveformView(audioLevel: recorder.audioLevel, isRecording: recorder.isRecording)

            if isProcessing {
                ZStack {
                    Circle().fill(ParayuTheme.accentSoft).frame(width: 88, height: 88)
                    ProgressView().progressViewStyle(CircularProgressViewStyle(tint: ParayuTheme.accent)).scaleEffect(1.15)
                }
                .frame(width: 124, height: 124)
            } else {
                RecordButton(recorder: recorder, action: startAudioCapture, stopAction: stopAudioCapture)
            }

            Group {
                if isProcessing {
                    Text("Working on your transcription…")
                        .font(ParayuTheme.font(13, .semibold))
                        .foregroundColor(ParayuTheme.muted)
                } else if recorder.isRecording {
                    Text(formatDuration(secondsRecorded))
                        .font(.system(size: 15, weight: .bold, design: .monospaced))
                        .foregroundColor(ParayuTheme.accent)
                } else {
                    VStack(spacing: 1) {
                        Text(controlHintLine1)
                        Text(controlHintLine2)
                    }
                    .font(ParayuTheme.font(13, .semibold))
                    .foregroundColor(ParayuTheme.muted)
                    .multilineTextAlignment(.center)
                }
            }
            .frame(height: 36)
        }
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

    // MARK: - Recording / translation logic (unchanged behavior)
    private func startAudioCapture() {
        guard !isProcessing else { return }
        speech.stop()
        textOutput = ""
        rawTextResult = ""
        secondsRecorded = 0.0
        do {
            try recorder.startRecording()
            timer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { _ in secondsRecorded += 0.1 }
        } catch {
            textOutput = "Error: \(error.localizedDescription)"
        }
    }

    private func stopAudioCapture() {
        guard !isProcessing else { return }
        timer?.invalidate(); timer = nil

        let samples = recorder.stopRecording()
        guard !samples.isEmpty else {
            textOutput = "No audio was captured. Please try again."
            return
        }

        let jobID = UUID()
        let jobTranslator = WhisperSpeechTranslator()
        processingJobID = jobID
        activeTranslator = jobTranslator
        isProcessing = true
        state.downloadPhase = "transcribing"
        state.currentStatusText = "Preparing audio…"

        DispatchQueue.main.asyncAfter(deadline: .now() + transcriptionTimeoutSeconds) {
            guard self.isProcessing, self.processingJobID == jobID else { return }
            self.isProcessing = false
            self.processingJobID = nil
            self.activeTranslator = nil
            state.downloadPhase = "idle"
            state.currentStatusText = ""
            self.textOutput = "Transcription is taking too long. Please force close Parayu once, reopen it, and try a 3-5 second recording."
        }

        jobTranslator.ensureModelAndTranslate(samples: samples, state: state) { result in
            DispatchQueue.main.async {
                guard self.processingJobID == jobID else { return }
                self.isProcessing = false
                self.processingJobID = nil
                self.activeTranslator = nil

                switch result {
                case .success(let text):
                    self.rawTextResult = text
                    let dictResult = TextProcessor.applyDictionary(text: text, rules: state.dictionary)
                    let snipResult = TextProcessor.applySnippets(text: dictResult.text, snippets: state.snippets)
                    var finalText = snipResult.text
                    var wordsCorrected = 0
                    if state.aiCleanup {
                        let beforeClean = finalText
                        finalText = TextProcessor.cleanup(finalText)
                        let wc = beforeClean.split(separator: " ").count - finalText.split(separator: " ").count
                        wordsCorrected = max(0, wc)
                    }
                    self.textOutput = finalText
                    self.lastResultDate = Date()
                    state.addHistoryEntry(rawText: text, finalText: finalText, durationSec: secondsRecorded, wordsCorrected: wordsCorrected, dictionaryFixes: dictResult.count + snipResult.count, shareTarget: nil)
                case .failure(let error):
                    self.textOutput = "Translation failed:\n\(error.localizedDescription)"
                }
            }
        }
    }

    private func copyToClipboard(logStats: Bool) {
        UIPasteboard.general.string = textOutput
        if logStats {
            state.addHistoryEntry(rawText: rawTextResult, finalText: textOutput, durationSec: secondsRecorded, wordsCorrected: 0, dictionaryFixes: 0, shareTarget: "Clipboard")
        }
        let gen = UINotificationFeedbackGenerator(); gen.notificationOccurred(.success)
        withAnimation { showCopiedAlert = true }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            withAnimation { self.showCopiedAlert = false }
        }
    }

    private func shareToApp(name: String, urlScheme: String) {
        copyToClipboard(logStats: false)
        state.addHistoryEntry(rawText: rawTextResult, finalText: textOutput, durationSec: secondsRecorded, wordsCorrected: 0, dictionaryFixes: 0, shareTarget: name)
        if let url = URL(string: urlScheme) {
            UIApplication.shared.open(url, options: [:]) { opened in
                if !opened { shareText = textOutput; showShareSheet = true }
            }
        } else {
            shareText = textOutput; showShareSheet = true
        }
    }

    private func encodeString(_ text: String) -> String {
        text.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
    }

    private func formatDuration(_ duration: Double) -> String {
        let mins = Int(duration) / 60
        let secs = Int(duration) % 60
        let tenths = Int((duration - Double(Int(duration))) * 10)
        return String(format: "%02d:%02d.%d", mins, secs, tenths)
    }
}
