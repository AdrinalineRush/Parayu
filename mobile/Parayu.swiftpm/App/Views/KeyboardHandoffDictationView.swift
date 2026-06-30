import SwiftUI
import AVFoundation

struct KeyboardHandoffDictationView: View {
    @EnvironmentObject var state: AppState
    @StateObject private var recorder = AudioRecorder()

    @State private var statusText = "Ready to record"
    @State private var transcribedText = ""
    @State private var isProcessing = false
    @State private var processingJobID: UUID?
    @State private var activeTranslator: WhisperSpeechTranslator?
    @State private var secondsRecorded = 0.0
    @State private var timer: Timer? = nil
    @State private var isDone = false
    @State private var didAutoStart = false

    private let transcriptionTimeoutSeconds = 60.0

    var body: some View {
        VStack(spacing: 26) {
            // Header
            VStack(spacing: 8) {
                HStack {
                    Spacer()
                    Button(action: {
                        stopAll()
                        state.keyboardHandoffActive = false
                    }) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 28))
                            .foregroundColor(ParayuTheme.muted)
                    }
                    .padding()
                }

                Text("Parayu")
                    .font(ParayuTheme.font(34, .extrabold))
                    .foregroundColor(ParayuTheme.text)

                Text("Malayalam to clean English")
                    .font(ParayuTheme.font(14, .bold))
                    .foregroundColor(ParayuTheme.accent)
            }
            .padding(.top, 10)

            Spacer()

            // Dictation / Progress Status
            VStack(spacing: 16) {
                if isProcessing {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: ParayuTheme.accent))
                        .scaleEffect(1.3)

                    Text(state.currentStatusText.isEmpty ? "Transcribing…" : state.currentStatusText)
                        .font(ParayuTheme.font(16, .bold))
                        .foregroundColor(ParayuTheme.text)
                } else if isDone {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 52))
                        .foregroundColor(ParayuTheme.success)

                    Text("Inserted")
                        .font(ParayuTheme.font(20, .bold))
                        .foregroundColor(ParayuTheme.text)

                    Text("Return to your app. The Parayu keyboard will place the text in the field.")
                        .font(ParayuTheme.font(13, .regular))
                        .foregroundColor(ParayuTheme.muted)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 40)

                    ScrollView {
                        Text(transcribedText)
                            .font(ParayuTheme.font(15, .medium))
                            .foregroundColor(ParayuTheme.text)
                            .padding()
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(ParayuTheme.card)
                            .cornerRadius(10)
                            .overlay(
                                RoundedRectangle(cornerRadius: 10, style: .continuous)
                                    .stroke(ParayuTheme.border, lineWidth: 1)
                            )
                    }
                    .frame(maxHeight: 100)
                    .padding(.horizontal, 30)
                } else {
                    Text(recorder.isRecording ? "Listening…" : "Ready")
                        .font(ParayuTheme.font(28, .extrabold))
                        .foregroundColor(ParayuTheme.text)

                    Text(recorder.isRecording ? "Tap the mic when you finish. Parayu will insert the clean English back into the keyboard." : (statusText == "Ready to record" ? "Starting microphone…" : statusText))
                        .font(ParayuTheme.font(14, .medium))
                        .foregroundColor(ParayuTheme.muted)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 34)
                }
            }
            .frame(height: 180)

            // Live Waveform
            WaveformView(audioLevel: recorder.audioLevel, isRecording: recorder.isRecording)
                .padding(.vertical, 10)

            // Record Control Button
            VStack(spacing: 12) {
                if isProcessing {
                    ZStack {
                        Circle()
                            .fill(ParayuTheme.accentSoft)
                            .frame(width: 88, height: 88)
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: ParayuTheme.accent))
                            .scaleEffect(1.15)
                    }
                } else {
                    RecordButton(recorder: recorder, action: startRecording, stopAction: stopRecording)
                }

                if isProcessing {
                    Text("Please wait")
                        .font(ParayuTheme.font(12, .semibold))
                        .foregroundColor(ParayuTheme.muted)
                } else if recorder.isRecording {
                    Text(formatDuration(secondsRecorded))
                        .font(.system(size: 14, weight: .bold, design: .monospaced))
                        .foregroundColor(.red)
                } else if isDone {
                    Button(action: {
                        isDone = false
                        transcribedText = ""
                        startRecording()
                    }) {
                        Text("Speak Again")
                            .font(ParayuTheme.font(13, .bold))
                            .foregroundColor(ParayuTheme.accent)
                            .padding(.vertical, 8)
                            .padding(.horizontal, 16)
                            .background(ParayuTheme.accentSoft)
                            .cornerRadius(8)
                    }
                } else {
                    Text("Tap to finish")
                        .font(ParayuTheme.font(12, .semibold))
                        .foregroundColor(ParayuTheme.muted)
                }
            }

            Spacer()

            // Bottom Info
            HStack(spacing: 4) {
                Image(systemName: "lock.shield.fill")
                    .font(.system(size: 11))
                Text("Private by design. Local processing where possible.")
                    .font(ParayuTheme.font(11, .regular))
            }
            .foregroundColor(ParayuTheme.muted)
            .padding(.bottom, 20)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(ParayuTheme.bg.ignoresSafeArea())
        .onAppear {
            autoStartFromKeyboard()
        }
    }

    private func autoStartFromKeyboard() {
        guard !didAutoStart, !recorder.isRecording, !isProcessing else { return }
        didAutoStart = true
        statusText = "Starting microphone…"

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
            guard !recorder.isRecording, !isProcessing, !isDone else { return }
            startRecording()
        }
    }

    private func startRecording() {
        guard !isProcessing else { return }
        isDone = false
        statusText = "Ready to record"
        transcribedText = ""
        secondsRecorded = 0.0

        do {
            try recorder.startRecording()
            timer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { _ in
                secondsRecorded += 0.1
            }
        } catch {
            statusText = "Error: \(error.localizedDescription)"
        }
    }

    private func stopRecording() {
        guard !isProcessing else { return }
        timer?.invalidate()
        timer = nil

        let samples = recorder.stopRecording()
        guard !samples.isEmpty else {
            statusText = "No audio was captured. Please try again."
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
            self.statusText = "Transcription is taking too long. Please force close Parayu once, reopen it, and try a 3-5 second recording."
        }

        jobTranslator.ensureModelAndTranslate(samples: samples, state: state) { result in
            DispatchQueue.main.async {
                guard self.processingJobID == jobID else { return }
                self.isProcessing = false
                self.processingJobID = nil
                self.activeTranslator = nil

                switch result {
                case .success(let text):
                    // Apply dictionary rules, snippets, and cleanup to English
                    let dictResult = TextProcessor.applyDictionary(text: text, rules: state.dictionary)
                    let snipResult = TextProcessor.applySnippets(text: dictResult.text, snippets: state.snippets)

                    var cleanedText = snipResult.text
                    var wordsCorrected = 0
                    if state.aiCleanup {
                        let beforeClean = cleanedText
                        cleanedText = TextProcessor.cleanup(cleanedText)
                        let wc = beforeClean.split(separator: " ").count - cleanedText.split(separator: " ").count
                        wordsCorrected = max(0, wc)
                    }

                    self.transcribedText = cleanedText
                    self.isDone = true

                    // Copy to clipboard as backup
                    UIPasteboard.general.string = cleanedText

                    // Save to shared App Group container
                    let defaults = UserDefaults(suiteName: "group.com.parayu.app") ?? UserDefaults.standard
                    defaults.set(cleanedText, forKey: "latestTranscribedText")
                    defaults.synchronize()

                    // Add history log
                    state.addHistoryEntry(
                        rawText: text,
                        finalText: cleanedText,
                        durationSec: secondsRecorded,
                        wordsCorrected: wordsCorrected,
                        dictionaryFixes: dictResult.count + snipResult.count,
                        shareTarget: "Parayu"
                    )
                case .failure(let error):
                    self.statusText = "Error: \(error.localizedDescription)"
                }
            }
        }
    }

    private func stopAll() {
        timer?.invalidate()
        timer = nil
        _ = recorder.stopRecording()
    }

    private func formatDuration(_ duration: Double) -> String {
        let mins = Int(duration) / 60
        let secs = Int(duration) % 60
        let tenths = Int((duration - Double(Int(duration))) * 10)
        return String(format: "%02d:%02d.%d", mins, secs, tenths)
    }
}
