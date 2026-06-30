import SwiftUI
import AVFoundation
import Speech

struct OnboardingView: View {
    @EnvironmentObject var state: AppState
    @State private var currentPage = 0
    @State private var micPermissionStatus = "Not Requested"

    var body: some View {
        ZStack {
            // Warm cream background with a faint accent glow at the top
            ParayuTheme.bg.ignoresSafeArea()
            RadialGradient(
                gradient: Gradient(colors: [ParayuTheme.accent.opacity(0.06), Color.clear]),
                center: .top,
                startRadius: 0,
                endRadius: 500
            )
            .ignoresSafeArea()

            VStack {
                Spacer()

                TabView(selection: $currentPage) {
                    // Slide 1: Welcome
                    VStack(spacing: 24) {
                        // Glowing accent badge
                        ZStack {
                            Circle()
                                .fill(ParayuTheme.accentGradient)
                                .frame(width: 120, height: 120)
                                .shadow(color: ParayuTheme.accent.opacity(0.3), radius: 25, x: 0, y: 12)

                            Image(systemName: "character.bubble.fill")
                                .font(.system(size: 52))
                                .foregroundColor(.white)
                        }
                        .padding(.top, 40)

                        VStack(spacing: 8) {
                            Text("Parayu")
                                .font(ParayuTheme.font(38, .extrabold))
                                .foregroundColor(ParayuTheme.text)

                            Text("Malayalam Speech to English")
                                .font(ParayuTheme.font(18, .semibold))
                                .foregroundColor(ParayuTheme.purple)
                        }

                        Text("Speak locally in Malayalam and get instant English text translations. Completely offline, secure, and private.")
                            .font(ParayuTheme.font(15, .regular))
                            .multilineTextAlignment(.center)
                            .foregroundColor(ParayuTheme.muted)
                            .lineSpacing(4)
                            .padding(.horizontal, 32)

                        Spacer()
                    }
                    .tag(0)

                    // Slide 2: Dictation Mode & Mic Permission
                    VStack(spacing: 24) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 18, style: .continuous)
                                .fill(ParayuTheme.accentSoft)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                                        .stroke(ParayuTheme.accent.opacity(0.3), lineWidth: 1)
                                )
                                .frame(width: 80, height: 80)

                            Image(systemName: "mic.fill")
                                .font(.system(size: 32))
                                .foregroundColor(ParayuTheme.accent)
                        }
                        .padding(.top, 40)

                        Text("Microphone Setup")
                            .font(ParayuTheme.font(24, .bold))
                            .foregroundColor(ParayuTheme.text)

                        Text("Parayu requires microphone and speech recognition permissions to capture and transcribe your voice dictation.")
                            .font(ParayuTheme.font(14, .regular))
                            .multilineTextAlignment(.center)
                            .foregroundColor(ParayuTheme.muted)
                            .padding(.horizontal, 32)

                        Button(action: requestPermissions) {
                            HStack {
                                Image(systemName: micPermissionStatus == "Granted" ? "checkmark.circle.fill" : "hand.tap.fill")
                                Text(micPermissionStatus == "Granted" ? "Permissions Granted" : "Grant Voice Access")
                                    .font(ParayuTheme.font(14, .semibold))
                            }
                            .foregroundColor(.white)
                            .padding(.vertical, 14)
                            .padding(.horizontal, 24)
                            .background(micPermissionStatus == "Granted" ? AnyShapeStyle(ParayuTheme.success) : AnyShapeStyle(ParayuTheme.accentGradient))
                            .cornerRadius(12)
                        }
                        .disabled(micPermissionStatus == "Granted")

                        VStack(alignment: .leading, spacing: 14) {
                            Text("Dictation Trigger Mode")
                                .font(ParayuTheme.font(12, .bold))
                                .foregroundColor(ParayuTheme.muted)
                                .tracking(1)

                            HStack(spacing: 12) {
                                Button(action: { state.dictationMode = "toggle" }) {
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text("Tap to Start/Stop")
                                            .font(ParayuTheme.font(14, .bold))
                                        Text("Tap once to record, tap again to translate")
                                            .font(ParayuTheme.font(11, .regular))
                                            .foregroundColor(ParayuTheme.muted)
                                    }
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .padding()
                                    .background(state.dictationMode == "toggle" ? ParayuTheme.accentSoft : ParayuTheme.sidebar)
                                    .cornerRadius(10)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                                            .stroke(state.dictationMode == "toggle" ? ParayuTheme.accent : ParayuTheme.border, lineWidth: 1.5)
                                    )
                                }
                                .foregroundColor(ParayuTheme.text)

                                Button(action: { state.dictationMode = "hold" }) {
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text("Hold to Speak")
                                            .font(ParayuTheme.font(14, .bold))
                                        Text("Hold down to record, release to translate")
                                            .font(ParayuTheme.font(11, .regular))
                                            .foregroundColor(ParayuTheme.muted)
                                    }
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .padding()
                                    .background(state.dictationMode == "hold" ? ParayuTheme.accentSoft : ParayuTheme.sidebar)
                                    .cornerRadius(10)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                                            .stroke(state.dictationMode == "hold" ? ParayuTheme.accent : ParayuTheme.border, lineWidth: 1.5)
                                    )
                                }
                                .foregroundColor(ParayuTheme.text)
                            }
                        }
                        .padding(.horizontal, 24)
                        .padding(.top, 16)

                        Spacer()
                    }
                    .tag(1)

                    // Slide 3: Model Selector & Finalize
                    VStack(spacing: 24) {
                        ZStack {
                            Circle()
                                .fill(ParayuTheme.accentSoft)
                                .frame(width: 80, height: 80)

                            Image(systemName: "cpu")
                                .font(.system(size: 34))
                                .foregroundColor(ParayuTheme.accent)
                        }
                        .padding(.top, 30)

                        Text("Select Translation Model")
                            .font(ParayuTheme.font(24, .bold))
                            .foregroundColor(ParayuTheme.text)

                        Text("Parayu operates fully offline. Select a multilingual Whisper model. We recommend the Small model for the best balance of speed and translation quality.")
                            .font(ParayuTheme.font(13, .regular))
                            .multilineTextAlignment(.center)
                            .foregroundColor(ParayuTheme.muted)
                            .padding(.horizontal, 32)

                        VStack(spacing: 10) {
                            ForEach(["small-q5_1", "medium-q5_0"], id: \.self) { modelId in
                                let model = WhisperModelInfo.modelById(modelId)
                                Button(action: { state.selectedModel = modelId }) {
                                    HStack(alignment: .top, spacing: 12) {
                                        VStack(alignment: .leading, spacing: 4) {
                                            Text(model.label)
                                                .font(ParayuTheme.font(14, .bold))
                                            Text(model.desc)
                                                .font(ParayuTheme.font(11, .regular))
                                                .multilineTextAlignment(.leading)
                                                .foregroundColor(ParayuTheme.muted)
                                        }
                                        Spacer()
                                        Text("\(Double(model.bytes) / (1024.0 * 1024.0), specifier: "%.0f") MB")
                                            .font(ParayuTheme.font(11, .bold))
                                            .foregroundColor(ParayuTheme.accent)
                                            .padding(.horizontal, 6)
                                            .padding(.vertical, 2)
                                            .background(ParayuTheme.accentSoft)
                                            .cornerRadius(4)
                                    }
                                    .padding()
                                    .background(state.selectedModel == modelId ? ParayuTheme.accentSoft : ParayuTheme.sidebar)
                                    .cornerRadius(12)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                                            .stroke(state.selectedModel == modelId ? ParayuTheme.accent : ParayuTheme.border, lineWidth: 1.5)
                                    )
                                }
                                .foregroundColor(ParayuTheme.text)
                            }
                        }
                        .padding(.horizontal, 24)

                        Spacer()
                    }
                    .tag(2)

                    // Slide 4: Keyboard Setup Guide
                    VStack(spacing: 16) {
                        ZStack {
                            Circle()
                                .fill(ParayuTheme.accentSoft)
                                .frame(width: 80, height: 80)

                            Image(systemName: "keyboard.badge.eye")
                                .font(.system(size: 34))
                                .foregroundColor(ParayuTheme.purple)
                        }
                        .padding(.top, 20)

                        Text("Enable Parayu Keyboard")
                            .font(ParayuTheme.font(24, .bold))
                            .foregroundColor(ParayuTheme.text)

                        Text("Use Parayu voice-to-text in WhatsApp, Notes, Safari, or any app on your iPhone.")
                            .font(ParayuTheme.font(13, .regular))
                            .multilineTextAlignment(.center)
                            .foregroundColor(ParayuTheme.muted)
                            .padding(.horizontal, 32)

                        VStack(alignment: .leading, spacing: 10) {
                            ForEach(Array(keyboardSteps.enumerated()), id: \.offset) { idx, step in
                                HStack(alignment: .top, spacing: 8) {
                                    Text("\(idx + 1).")
                                        .font(ParayuTheme.font(13, .bold))
                                        .foregroundColor(ParayuTheme.accent)
                                    Text(step)
                                        .font(ParayuTheme.font(13, .regular))
                                        .foregroundColor(ParayuTheme.text)
                                }
                            }
                        }
                        .padding()
                        .background(ParayuTheme.sidebar)
                        .cornerRadius(12)
                        .overlay(
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .stroke(ParayuTheme.border, lineWidth: 1)
                        )
                        .padding(.horizontal, 24)

                        Button(action: openSettings) {
                            HStack {
                                Image(systemName: "gearshape.2.fill")
                                Text("Open Keyboard Settings")
                                    .font(ParayuTheme.font(14, .bold))
                            }
                            .foregroundColor(.white)
                            .padding(.vertical, 12)
                            .padding(.horizontal, 20)
                            .background(ParayuTheme.accentGradient)
                            .cornerRadius(10)
                        }
                        .padding(.top, 14)

                        Spacer()
                    }
                    .tag(3)
                }
                .tabViewStyle(PageTabViewStyle(indexDisplayMode: .never))

                // Indicators & Buttons
                VStack(spacing: 16) {
                    HStack(spacing: 8) {
                        ForEach(0..<4) { index in
                            Capsule()
                                .fill(index == currentPage ? AnyShapeStyle(ParayuTheme.accent) : AnyShapeStyle(ParayuTheme.border))
                                .frame(width: index == currentPage ? 16 : 7, height: 7)
                                .animation(.spring(), value: currentPage)
                        }
                    }
                    .padding(.bottom, 8)

                    if currentPage < 3 {
                        Button(action: {
                            withAnimation {
                                currentPage += 1
                            }
                        }) {
                            Text("Continue")
                                .font(ParayuTheme.font(16, .bold))
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 14)
                                .background(ParayuTheme.accentGradient)
                                .cornerRadius(14)
                                .shadow(color: ParayuTheme.accent.opacity(0.25), radius: 8, x: 0, y: 4)
                        }
                        .padding(.horizontal, 24)
                    } else {
                        Button(action: finishOnboarding) {
                            Text("Get Started")
                                .font(ParayuTheme.font(16, .bold))
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 14)
                                .background(ParayuTheme.accentGradient)
                                .cornerRadius(14)
                                .shadow(color: ParayuTheme.accent.opacity(0.25), radius: 8, x: 0, y: 4)
                        }
                        .padding(.horizontal, 24)
                    }

                    if currentPage > 0 {
                        Button(action: {
                            withAnimation {
                                currentPage -= 1
                            }
                        }) {
                            Text("Back")
                                .font(ParayuTheme.font(13, .semibold))
                                .foregroundColor(ParayuTheme.muted)
                        }
                    } else {
                        // spacer to maintain height
                        Text(" ")
                            .font(ParayuTheme.font(13, .regular))
                    }
                }
                .padding(.bottom, 32)
            }
        }
    }

    private let keyboardSteps = [
        "Open iPhone Settings",
        "Go to General → Keyboard → Keyboards",
        "Tap Add New Keyboard",
        "Select Parayu Keyboard",
        "Enable Allow Full Access for local processing"
    ]

    private func requestPermissions() {
        AVAudioSession.sharedInstance().requestRecordPermission { micGranted in
            guard micGranted else {
                DispatchQueue.main.async {
                    self.micPermissionStatus = "Denied"
                }
                return
            }

            SFSpeechRecognizer.requestAuthorization { speechStatus in
                DispatchQueue.main.async {
                    if speechStatus == .authorized {
                        self.micPermissionStatus = "Granted"
                    } else {
                        self.micPermissionStatus = "Denied"
                    }
                }
            }
        }
    }

    private func openSettings() {
        if let url = URL(string: UIApplication.openSettingsURLString) {
            UIApplication.shared.open(url)
        }
    }

    private func finishOnboarding() {
        state.inputLanguage = "ml" // force Malayalam input language as primary
        state.onboarded = true
        state.saveAll()
    }
}
