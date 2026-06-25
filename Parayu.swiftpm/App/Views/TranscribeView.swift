import SwiftUI
import AVFoundation

struct WaveformView: View {
    var audioLevel: Float
    var isRecording: Bool
    
    var body: some View {
        HStack(spacing: 5) {
            ForEach(0..<19) { index in
                let factor = CGFloat(sin(Double(index) * 0.35) * 0.4 + 0.6)
                let height = isRecording ? (8 + CGFloat(audioLevel) * 75 * factor) : 6
                
                Capsule()
                    .fill(LinearGradient(
                        gradient: Gradient(colors: [Color(red: 224/255, green: 30/255, blue: 65/255), Color(red: 160/255, green: 43/255, blue: 176/255)]),
                        startPoint: .top,
                        endPoint: .bottom
                    ))
                    .frame(width: 4, height: height)
                    .animation(.interactiveSpring(response: 0.15, dampingFraction: 0.55), value: height)
            }
        }
        .frame(height: 85)
    }
}

struct RecordButton: View {
    @EnvironmentObject var state: AppState
    @ObservedObject var recorder: AudioRecorder
    var action: () -> Void
    var stopAction: () -> Void
    
    var body: some View {
        if state.dictationMode == "hold" {
            // Touch-based hold down
            buttonImage
                .gesture(
                    DragGesture(minimumDistance: 0)
                        .onChanged { _ in
                            if !recorder.isRecording {
                                action()
                            }
                        }
                        .onEnded { _ in
                            if recorder.isRecording {
                                stopAction()
                            }
                        }
                )
        } else {
            // Standard tap
            Button(action: {
                if recorder.isRecording {
                    stopAction()
                } else {
                    action()
                }
            }) {
                buttonImage
            }
        }
    }
    
    private var buttonImage: some View {
        ZStack {
            if recorder.isRecording {
                Circle()
                    .stroke(Color(red: 224/255, green: 30/255, blue: 65/255).opacity(0.3), lineWidth: 4)
                    .scaleEffect(1.2 + CGFloat(recorder.audioLevel * 0.4))
                    .animation(.easeInOut(duration: 0.15), value: recorder.audioLevel)
            }
            
            Circle()
                .fill(LinearGradient(
                    gradient: Gradient(colors: recorder.isRecording ? [Color(red: 255/255, green: 77/255, blue: 77/255), Color(red: 224/255, green: 30/255, blue: 65/255)] : [Color(red: 224/255, green: 30/255, blue: 65/255), Color(red: 160/255, green: 43/255, blue: 176/255)]),
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                ))
                .frame(width: 88, height: 88)
                .shadow(color: Color(red: 224/255, green: 30/255, blue: 65/255).opacity(0.35), radius: 16, x: 0, y: 8)
            
            Image(systemName: recorder.isRecording ? "stop.fill" : "mic.fill")
                .font(.system(size: 30, weight: .semibold))
                .foregroundColor(.white)
        }
    }
}

struct ShareSheetWrapper: UIViewControllerRepresentable {
    let activityItems: [Any]
    
    func makeUIViewController(context: Context) -> UIActivityViewController {
        return UIActivityViewController(activityItems: activityItems, applicationActivities: nil)
    }
    
    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

struct TranscribeView: View {
    @EnvironmentObject var state: AppState
    @StateObject private var recorder = AudioRecorder()
    @StateObject private var translator = WhisperSpeechTranslator()
    
    @State private var textOutput = ""
    @State private var rawTextResult = ""
    @State private var isProcessing = false
    @State private var secondsRecorded = 0.0
    @State private var timer: Timer? = nil
    
    @State private var showShareSheet = false
    @State private var shareText = ""
    @State private var showCopiedAlert = false
    
    var body: some View {
        NavigationView {
            VStack(spacing: 20) {
                // Header & Language Toggler
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Transcribe & Translate")
                            .font(.system(size: 24, weight: .black, design: .rounded))
                            .foregroundColor(.white)
                        Text("Malayalam Speech to English Text")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundColor(.secondary)
                    }
                    Spacer()
                    
                    // Compact indicator badge
                    Text(state.inputLanguage == "ml" ? "MAL ➜ ENG" : "ENG ➜ ENG")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(.white)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(Color.white.opacity(0.08))
                        .cornerRadius(8)
                }
                .padding(.horizontal)
                .padding(.top, 16)
                
                // Result Editor
                VStack(alignment: .leading, spacing: 10) {
                    Text("Translated Result")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(.secondary)
                        .textCase(.uppercase)
                        .tracking(0.5)
                    
                    if isProcessing {
                        VStack(spacing: 16) {
                            Spacer()
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: Color(red: 224/255, green: 30/255, blue: 65/255)))
                                .scaleEffect(1.2)
                            
                            Text(state.currentStatusText)
                                .font(.system(size: 13, weight: .bold))
                                .foregroundColor(.white)
                            
                            if state.downloadPhase == "downloading" {
                                ProgressView(value: state.downloadProgress, total: 1.0)
                                    .accentColor(Color(red: 224/255, green: 30/255, blue: 65/255))
                                    .padding(.horizontal, 40)
                            }
                            Spacer()
                        }
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                    } else {
                        TextEditor(text: $textOutput)
                            .font(.system(size: 16, weight: .medium))
                            .foregroundColor(.white)
                            .scrollContentBackground(.hidden)
                            .background(Color.clear)
                            .cornerRadius(12)
                            .overlay(
                                Group {
                                    if textOutput.isEmpty {
                                        VStack(alignment: .leading) {
                                            Text(state.dictationMode == "hold" ? "Hold the microphone button below to record Malayalam speech, release to translate to English." : "Tap the microphone button below to record Malayalam speech, tap again to stop and translate.")
                                                .font(.system(size: 14, weight: .medium))
                                                .foregroundColor(.secondary)
                                                .padding(.horizontal, 6)
                                                .padding(.vertical, 8)
                                            Spacer()
                                        }
                                    }
                                }
                            )
                    }
                }
                .padding()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Color.white.opacity(0.04))
                .cornerRadius(16)
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(Color.white.opacity(0.06), lineWidth: 1)
                )
                .padding(.horizontal)
                
                // Copy/Share Actions (Visible only when text is present)
                if !textOutput.isEmpty && !isProcessing {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Send Translated Text to")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundColor(.secondary)
                            .textCase(.uppercase)
                            .tracking(0.5)
                            .padding(.horizontal)
                        
                        HStack(spacing: 10) {
                            // Copy button
                            Button(action: { copyToClipboard(logStats: true) }) {
                                HStack {
                                    Image(systemName: "doc.on.doc.fill")
                                    Text("Copy")
                                }
                                .font(.system(size: 13, weight: .bold))
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 12)
                                .background(Color.white.opacity(0.08))
                                .cornerRadius(10)
                            }
                            
                            // WhatsApp Tally & Link
                            Button(action: { shareToApp(name: "WhatsApp", urlScheme: "whatsapp://send?text=\(encodeString(textOutput))") }) {
                                HStack {
                                    Image(systemName: "message.fill")
                                    Text("WhatsApp")
                                }
                                .font(.system(size: 13, weight: .bold))
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 12)
                                .background(Color.green.opacity(0.8))
                                .cornerRadius(10)
                            }
                            
                            // SMS Tally & Link
                            Button(action: { shareToApp(name: "Messages", urlScheme: "sms:&body=\(encodeString(textOutput))") }) {
                                HStack {
                                    Image(systemName: "bubble.left.fill")
                                    Text("Messages")
                                }
                                .font(.system(size: 13, weight: .bold))
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 12)
                                .background(Color.blue.opacity(0.8))
                                .cornerRadius(10)
                            }
                            
                            // General share sheet
                            Button(action: {
                                shareText = textOutput
                                state.addHistoryEntry(rawText: rawTextResult, finalText: textOutput, durationSec: secondsRecorded, wordsCorrected: 0, dictionaryFixes: 0, shareTarget: "Share Sheet")
                                showShareSheet = true
                            }) {
                                Image(systemName: "square.and.arrow.up")
                                    .font(.system(size: 14, weight: .bold))
                                    .foregroundColor(.white)
                                    .padding(.vertical, 12)
                                    .padding(.horizontal, 16)
                                    .background(Color.white.opacity(0.08))
                                    .cornerRadius(10)
                            }
                        }
                        .padding(.horizontal)
                    }
                    .transition(.opacity)
                }
                
                // Live Waveform
                WaveformView(audioLevel: recorder.audioLevel, isRecording: recorder.isRecording)
                    .padding(.vertical, 8)
                
                // Record Controls
                VStack(spacing: 6) {
                    RecordButton(recorder: recorder, action: startAudioCapture, stopAction: stopAudioCapture)
                    
                    if recorder.isRecording {
                        Text(formatDuration(secondsRecorded))
                            .font(.system(size: 13, weight: .bold, design: .monospaced))
                            .foregroundColor(.red)
                            .padding(.top, 4)
                    } else {
                        Text(state.dictationMode == "hold" ? "Hold to speak, release to translate" : "Tap to record, tap again to translate")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundColor(.secondary)
                            .padding(.top, 4)
                    }
                }
                .padding(.bottom, 24)
            }
            .background(Color.black.ignoresSafeArea())
            .navigationBarHidden(true)
            .sheet(isPresented: $showShareSheet) {
                ShareSheetWrapper(activityItems: [shareText])
            }
            .overlay(
                Group {
                    if showCopiedAlert {
                        VStack {
                            HStack(spacing: 8) {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundColor(.green)
                                Text("Copied to Clipboard")
                                    .font(.system(size: 14, weight: .bold))
                                    .foregroundColor(.white)
                            }
                            .padding(.horizontal, 20)
                            .padding(.vertical, 12)
                            .background(Color.gray.opacity(0.85))
                            .cornerRadius(24)
                            .shadow(radius: 8)
                        }
                        .transition(.scale.combined(with: .opacity))
                        .zIndex(100)
                    }
                }
            )
        }
    }
    
    private func startAudioCapture() {
        textOutput = ""
        rawTextResult = ""
        secondsRecorded = 0.0
        
        do {
            try recorder.startRecording()
            
            // start timer
            timer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { _ in
                secondsRecorded += 0.1
            }
        } catch {
            textOutput = "Error: \(error.localizedDescription)"
        }
    }
    
    private func stopAudioCapture() {
        timer?.invalidate()
        timer = nil
        
        let samples = recorder.stopRecording()
        guard !samples.isEmpty else { return }
        
        isProcessing = true
        
        // Trigger translation
        translator.ensureModelAndTranslate(samples: samples, state: state) { result in
            DispatchQueue.main.async {
                self.isProcessing = false
                
                switch result {
                case .success(let text):
                    self.rawTextResult = text
                    
                    // Apply dictionary replacements, snippets expansions, and cleanups
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
                    
                    // Automatically add to history if shared/copied (we trigger it on copy/share actions to count app tally correctly, or add to history now with target nil)
                    state.addHistoryEntry(
                        rawText: text,
                        finalText: finalText,
                        durationSec: secondsRecorded,
                        wordsCorrected: wordsCorrected,
                        dictionaryFixes: dictResult.count + snipResult.count,
                        shareTarget: nil
                    )
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
        
        withAnimation {
            showCopiedAlert = true
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            withAnimation {
                self.showCopiedAlert = false
            }
        }
    }
    
    private func shareToApp(name: String, urlScheme: String) {
        copyToClipboard(logStats: false)
        state.addHistoryEntry(rawText: rawTextResult, finalText: textOutput, durationSec: secondsRecorded, wordsCorrected: 0, dictionaryFixes: 0, shareTarget: name)
        
        if let url = URL(string: urlScheme), UIApplication.shared.canOpenURL(url) {
            UIApplication.shared.open(url)
        } else {
            // Fallback to share sheet
            shareText = textOutput
            showShareSheet = true
        }
    }
    
    private func encodeString(_ text: String) -> String {
        return text.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
    }
    
    private func formatDuration(_ duration: Double) -> String {
        let mins = Int(duration) / 60
        let secs = Int(duration) % 60
        let tenths = Int((duration - Double(Int(duration))) * 10)
        return String(format: "%02d:%02d.%d", mins, secs, tenths)
    }
}
