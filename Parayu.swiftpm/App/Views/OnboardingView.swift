import SwiftUI
import AVFoundation

struct OnboardingView: View {
    @EnvironmentObject var state: AppState
    @State private var currentPage = 0
    @State private var micPermissionStatus = "Not Requested"
    
    var body: some View {
        ZStack {
            // Premium background gradient matching index.html onboarding
            RadialGradient(
                gradient: Gradient(colors: [Color(red: 26/255, green: 36/255, blue: 68/255), Color(red: 10/255, green: 14/255, blue: 26/255)]),
                center: .top,
                startRadius: 0,
                endRadius: 600
            )
            .ignoresSafeArea()
            
            VStack {
                Spacer()
                
                TabView(selection: $currentPage) {
                    // Slide 1: Welcome
                    VStack(spacing: 24) {
                        // Glowing badge mimicking index.html
                        ZStack {
                            Circle()
                                .fill(LinearGradient(
                                    gradient: Gradient(colors: [Color(red: 124/255, green: 92/255, blue: 255/255), Color(red: 61/255, green: 208/255, blue: 255/255)]),
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                ))
                                .frame(width: 120, height: 120)
                                .shadow(color: Color(red: 124/255, green: 92/255, blue: 255/255).opacity(0.4), radius: 25, x: 0, y: 12)
                            
                            Image(systemName: "character.bubble.fill")
                                .font(.system(size: 52))
                                .foregroundColor(.white)
                        }
                        .padding(.top, 40)
                        
                        VStack(spacing: 8) {
                            Text("Parayu")
                                .font(.system(size: 38, weight: .black, design: .rounded))
                                .foregroundColor(.white)
                            
                            Text("Malayalam Speech to English")
                                .font(.system(size: 18, weight: .semibold))
                                .foregroundColor(Color(red: 160/255, green: 43/255, blue: 176/255))
                        }
                        
                        Text("Speak locally in Malayalam and get instant English text translations. Completely offline, secure, and private.")
                            .font(.system(size: 15))
                            .multilineTextAlignment(.center)
                            .foregroundColor(Color(red: 174/255, green: 182/255, blue: 204/255))
                            .lineSpacing(4)
                            .padding(.horizontal, 32)
                        
                        Spacer()
                    }
                    .tag(0)
                    
                    // Slide 2: Dictation Mode & Mic Permission
                    VStack(spacing: 24) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 18)
                                .stroke(Color(red: 124/255, green: 92/255, blue: 255/255).opacity(0.3), lineWidth: 1)
                                .background(Color.white.opacity(0.04))
                                .frame(width: 80, height: 80)
                            
                            Image(systemName: "mic.fill")
                                .font(.system(size: 32))
                                .foregroundColor(Color(red: 180/255, green: 155/255, blue: 255/255))
                        }
                        .padding(.top, 40)
                        
                        Text("Microphone Setup")
                            .font(.system(size: 24, weight: .bold))
                            .foregroundColor(.white)
                        
                        Text("Parayu requires microphone permissions to capture your voice dictation.")
                            .font(.system(size: 14))
                            .multilineTextAlignment(.center)
                            .foregroundColor(Color(red: 174/255, green: 182/255, blue: 204/255))
                            .padding(.horizontal, 32)
                        
                        Button(action: requestMicPermission) {
                            HStack {
                                Image(systemName: micPermissionStatus == "Granted" ? "checkmark.circle.fill" : "hand.tap.fill")
                                Text(micPermissionStatus == "Granted" ? "Permission Granted" : "Grant Microphone Access")
                                    .fontWeight(.semibold)
                            }
                            .foregroundColor(.white)
                            .padding(.vertical, 14)
                            .padding(.horizontal, 24)
                            .background(micPermissionStatus == "Granted" ? Color.green : Color(red: 124/255, green: 92/255, blue: 255/255))
                            .cornerRadius(12)
                        }
                        .disabled(micPermissionStatus == "Granted")
                        
                        VStack(alignment: .leading, spacing: 14) {
                            Text("Dictation Trigger Mode")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(Color(red: 139/255, green: 148/255, blue: 176/255))
                                .tracking(1)
                            
                            HStack(spacing: 12) {
                                Button(action: { state.dictationMode = "toggle" }) {
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text("Tap to Start/Stop")
                                            .fontWeight(.bold)
                                            .font(.system(size: 14))
                                        Text("Tap once to record, tap again to translate")
                                            .font(.system(size: 11))
                                            .opacity(0.7)
                                    }
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .padding()
                                    .background(state.dictationMode == "toggle" ? Color(red: 124/255, green: 92/255, blue: 255/255).opacity(0.2) : Color.white.opacity(0.04))
                                    .cornerRadius(10)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 10)
                                            .stroke(state.dictationMode == "toggle" ? Color(red: 124/255, green: 92/255, blue: 255/255) : Color.clear, lineWidth: 1.5)
                                    )
                                }
                                .foregroundColor(.white)
                                
                                Button(action: { state.dictationMode = "hold" }) {
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text("Hold to Speak")
                                            .fontWeight(.bold)
                                            .font(.system(size: 14))
                                        Text("Hold down to record, release to translate")
                                            .font(.system(size: 11))
                                            .opacity(0.7)
                                    }
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .padding()
                                    .background(state.dictationMode == "hold" ? Color(red: 124/255, green: 92/255, blue: 255/255).opacity(0.2) : Color.white.opacity(0.04))
                                    .cornerRadius(10)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 10)
                                            .stroke(state.dictationMode == "hold" ? Color(red: 124/255, green: 92/255, blue: 255/255) : Color.clear, lineWidth: 1.5)
                                    )
                                }
                                .foregroundColor(.white)
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
                                .fill(Color.white.opacity(0.05))
                                .frame(width: 80, height: 80)
                            
                            Image(systemName: "cpu")
                                .font(.system(size: 34))
                                .foregroundColor(Color(red: 61/255, green: 208/255, blue: 255/255))
                        }
                        .padding(.top, 30)
                        
                        Text("Select Translation Model")
                            .font(.system(size: 24, weight: .bold))
                            .foregroundColor(.white)
                        
                        Text("Parayu operates fully offline. Select a multilingual Whisper model. We recommend the Small model for the best balance of speed and translation quality.")
                            .font(.system(size: 13))
                            .multilineTextAlignment(.center)
                            .foregroundColor(Color(red: 174/255, green: 182/255, blue: 204/255))
                            .padding(.horizontal, 32)
                        
                        VStack(spacing: 10) {
                            ForEach(["base", "small-q5_1"], id: \.self) { modelId in
                                let model = WhisperModelInfo.modelById(modelId)
                                Button(action: { state.selectedModel = modelId }) {
                                    HStack(alignment: .top, spacing: 12) {
                                        VStack(alignment: .leading, spacing: 4) {
                                            Text(model.label)
                                                .fontWeight(.bold)
                                                .font(.system(size: 14))
                                            Text(model.desc)
                                                .font(.system(size: 11))
                                                .multilineTextAlignment(.leading)
                                                .opacity(0.7)
                                        }
                                        Spacer()
                                        Text("\(Double(model.bytes) / (1024.0 * 1024.0), specifier: "%.0f") MB")
                                            .font(.system(size: 11, weight: .bold))
                                            .foregroundColor(Color(red: 61/255, green: 208/255, blue: 255/255))
                                            .padding(.horizontal, 6)
                                            .padding(.vertical, 2)
                                            .background(Color.white.opacity(0.08))
                                            .cornerRadius(4)
                                    }
                                    .padding()
                                    .background(state.selectedModel == modelId ? Color(red: 124/255, green: 92/255, blue: 255/255).opacity(0.2) : Color.white.opacity(0.04))
                                    .cornerRadius(12)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 12)
                                            .stroke(state.selectedModel == modelId ? Color(red: 124/255, green: 92/255, blue: 255/255) : Color.clear, lineWidth: 1.5)
                                    )
                                }
                                .foregroundColor(.white)
                            }
                        }
                        .padding(.horizontal, 24)
                        
                        Spacer()
                    }
                    .tag(2)
                }
                .tabViewStyle(PageTabViewStyle(indexDisplayMode: .never))
                
                // Indicators & Buttons
                VStack(spacing: 16) {
                    HStack(spacing: 8) {
                        ForEach(0..<3) { index in
                            Circle()
                                .fill(index == currentPage ? Color(red: 124/255, green: 92/255, blue: 255/255) : Color.white.opacity(0.2))
                                .frame(width: index == currentPage ? 16 : 7, height: 7)
                                .animation(.spring(), value: currentPage)
                        }
                    }
                    .padding(.bottom, 8)
                    
                    if currentPage < 2 {
                        Button(action: {
                            withAnimation {
                                currentPage += 1
                            }
                        }) {
                            Text("Continue")
                                .fontWeight(.bold)
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 14)
                                .background(LinearGradient(
                                    gradient: Gradient(colors: [Color(red: 124/255, green: 92/255, blue: 255/255), Color(red: 61/255, green: 208/255, blue: 255/255)]),
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                ))
                                .cornerRadius(14)
                                .shadow(color: Color(red: 124/255, green: 92/255, blue: 255/255).opacity(0.25), radius: 8, x: 0, y: 4)
                        }
                        .padding(.horizontal, 24)
                    } else {
                        Button(action: finishOnboarding) {
                            Text("Get Started")
                                .fontWeight(.bold)
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 14)
                                .background(LinearGradient(
                                    gradient: Gradient(colors: [Color(red: 124/255, green: 92/255, blue: 255/255), Color(red: 61/255, green: 208/255, blue: 255/255)]),
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                ))
                                .cornerRadius(14)
                                .shadow(color: Color(red: 124/255, green: 92/255, blue: 255/255).opacity(0.25), radius: 8, x: 0, y: 4)
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
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundColor(Color(red: 126/255, green: 135/255, blue: 163/255))
                        }
                    } else {
                        // spacer to maintain height
                        Text(" ")
                            .font(.system(size: 13))
                    }
                }
                .padding(.bottom, 32)
            }
        }
    }
    
    private func requestMicPermission() {
        AVAudioSession.sharedInstance().requestRecordPermission { granted in
            DispatchQueue.main.async {
                self.micPermissionStatus = granted ? "Granted" : "Denied"
            }
        }
    }
    
    private func finishOnboarding() {
        state.inputLanguage = "ml" // force Malayalam input language as primary
        state.onboarded = true
        state.saveAll()
    }
}
