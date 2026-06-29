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
                            .foregroundColor(.secondary)
                    }
                    .padding()
                }
                
                Text("Parayu")
                    .font(.system(size: 34, weight: .black, design: .rounded))
                    .foregroundColor(.white)
                
                Text("Malayalam to clean English")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(Color(red: 224/255, green: 30/255, blue: 65/255))
            }
            .padding(.top, 10)
            
            Spacer()
            
            // Dictation / Progress Status
            VStack(spacing: 16) {
                if isProcessing {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: Color(red: 224/255, green: 30/255, blue: 65/255)))
                        .scaleEffect(1.3)
                    
                    Text(state.currentStatusText.isEmpty ? "Transcribing…" : state.currentStatusText)
                        .font(.system(size: 16, weight: .bold))
                        .foregroundColor(.white)
                } else if isDone {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 52))
                        .foregroundColor(.green)
                    
                    Text("Inserted")
                        .font(.system(size: 20, weight: .bold))
                        .foregroundColor(.white)
                    
                    Text("Return to your app. The Parayu keyboard will place the text in the field.")
                        .font(.system(size: 13))
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 40)
                    
                    ScrollView {
                        Text(transcribedText)
                            .font(.system(size: 15, weight: .medium))
                            .foregroundColor(Color(red: 174/255, green: 182/255, blue: 204/255))
                            .padding()
                            .background(Color.white.opacity(0.04))
                            .cornerRadius(10)
                    }
                    .frame(maxHeight: 100)
                    .padding(.horizontal, 30)
                } else {
                    Text(recorder.isRecording ? "Listening…" : "Ready")
                        .font(.system(size: 28, weight: .black, design: .rounded))
                        .foregroundColor(.white)
                    
                    Text(recorder.isRecording ? "Tap the mic when you finish. Parayu will insert the clean English back into the keyboard." : (statusText == "Ready to record" ? "Starting microphone…" : statusText))
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(.secondary)
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
                            .fill(Color.white.opacity(0.08))
                            .frame(width: 88, height: 88)
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                            .scaleEffect(1.15)
                    }
                } else {
                    RecordButton(recorder: recorder, action: startRecording, stopAction: stopRecording)
                }
                
                if isProcessing {
                    Text("Please wait")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(.secondary)
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
                            .font(.system(size: 13, weight: .bold))
                            .foregroundColor(.white)
                            .padding(.vertical, 8)
                            .padding(.horizontal, 16)
                            .background(Color.white.opacity(0.1))
                            .cornerRadius(8)
                    }
                } else {
                    Text("Tap to finish")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(.secondary)
                }
            }
            
            Spacer()
            
            // Bottom Info
            HStack(spacing: 4) {
                Image(systemName: "lock.shield.fill")
                    .font(.system(size: 11))
                Text("Private by design. Local processing where possible.")
                    .font(.system(size: 11))
            }
            .foregroundColor(.secondary)
            .padding(.bottom, 20)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.black.ignoresSafeArea())
        .preferredColorScheme(.dark)
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
