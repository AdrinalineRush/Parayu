import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var state: AppState
    @StateObject private var downloader = WhisperModelDownloader()
    @State private var downloadModelId = ""
    @State private var showResetAlert = false
    
    private let HF_BASE = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/"
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    
                    // SECTION 1: Dictation Settings
                    VStack(alignment: .leading, spacing: 14) {
                        Text("Dictation Settings")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundColor(.secondary)
                            .textCase(.uppercase)
                            .tracking(0.5)
                        
                        // Input Language
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Input Language")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundColor(.white)
                            
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
                                            .font(.system(size: 13, weight: .semibold))
                                            .foregroundColor(.white)
                                        Text("Translate spoken Malayalam to English instead of transcribing in Malayalam script.")
                                            .font(.system(size: 11))
                                            .foregroundColor(.secondary)
                                    }
                                }
                                .toggleStyle(SwitchToggleStyle(tint: Color(red: 224/255, green: 30/255, blue: 65/255)))
                                .padding(.top, 6)
                                .onChange(of: state.translateMalayalam) { _ in
                                    state.saveAll()
                                }
                            }
                        }
                        
                        Divider().background(Color.white.opacity(0.08))
                        
                        // Dictation Mode
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Trigger Mode")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundColor(.white)
                            
                            Picker("Trigger Mode", selection: $state.dictationMode) {
                                Text("Tap to Toggle").tag("toggle")
                                Text("Hold to Speak").tag("hold")
                            }
                            .pickerStyle(SegmentedPickerStyle())
                            .onChange(of: state.dictationMode) { _ in
                                state.saveAll()
                            }
                        }
                        
                        Divider().background(Color.white.opacity(0.08))
                        
                        // AI Cleanup
                        Toggle(isOn: $state.aiCleanup) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("AI Punctuation & Cleanup")
                                    .font(.system(size: 14, weight: .semibold))
                                    .foregroundColor(.white)
                                Text("Post-process to remove filler words and fix capitalization/punctuation.")
                                    .font(.system(size: 11))
                                    .foregroundColor(.secondary)
                            }
                        }
                        .toggleStyle(SwitchToggleStyle(tint: Color(red: 224/255, green: 30/255, blue: 65/255)))
                        .onChange(of: state.aiCleanup) { _ in
                            state.saveAll()
                        }
                    }
                    .padding()
                    .background(Color.white.opacity(0.04))
                    .cornerRadius(16)
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .stroke(Color.white.opacity(0.06), lineWidth: 1)
                    )
                    
                    // SECTION 2: Custom Text Expanders
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Customizations")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundColor(.secondary)
                            .textCase(.uppercase)
                            .tracking(0.5)
                        
                        NavigationLink(destination: DictionaryView()) {
                            HStack {
                                Image(systemName: "character.book.closed.fill")
                                    .foregroundColor(Color(red: 224/255, green: 30/255, blue: 65/255))
                                    .frame(width: 24)
                                Text("Dictionary Rules")
                                    .foregroundColor(.white)
                                    .font(.system(size: 14, weight: .medium))
                                Spacer()
                                Text("\(state.dictionary.count)")
                                    .font(.system(size: 12, weight: .bold))
                                    .foregroundColor(.secondary)
                                Image(systemName: "chevron.right")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                            .padding(.vertical, 4)
                        }
                        
                        Divider().background(Color.white.opacity(0.08))
                        
                        NavigationLink(destination: SnippetsView()) {
                            HStack {
                                Image(systemName: "doc.text.fill")
                                    .foregroundColor(Color(red: 160/255, green: 43/255, blue: 176/255))
                                    .frame(width: 24)
                                Text("Text Snippets")
                                    .foregroundColor(.white)
                                    .font(.system(size: 14, weight: .medium))
                                Spacer()
                                Text("\(state.snippets.count)")
                                    .font(.system(size: 12, weight: .bold))
                                    .foregroundColor(.secondary)
                                Image(systemName: "chevron.right")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                            .padding(.vertical, 4)
                        }
                    }
                    .padding()
                    .background(Color.white.opacity(0.04))
                    .cornerRadius(16)
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .stroke(Color.white.opacity(0.06), lineWidth: 1)
                    )
                    
                    // SECTION 3: Models List
                    VStack(alignment: .leading, spacing: 14) {
                        Text("Whisper Translation Models")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundColor(.secondary)
                            .textCase(.uppercase)
                            .tracking(0.5)
                        
                        // Selectable models (Filter down to multilingual models for translation capability)
                        let models = WHISPER_MODELS.filter { !$0.id.hasSuffix(".en") }
                        
                        ForEach(models) { model in
                            let isActive = (state.selectedModel == model.id)
                            let isDownloadingThis = (downloader.isDownloading && downloadModelId == model.id)
                            
                            HStack(alignment: .top, spacing: 12) {
                                VStack(alignment: .leading, spacing: 4) {
                                    HStack(spacing: 8) {
                                        Text(model.label)
                                            .fontWeight(.bold)
                                            .font(.system(size: 14))
                                            .foregroundColor(.white)
                                        
                                        if isActive {
                                            Text("Active")
                                                .font(.system(size: 9, weight: .bold))
                                                .foregroundColor(.white)
                                                .padding(.horizontal, 6)
                                                .padding(.vertical, 2)
                                                .background(Color(red: 224/255, green: 30/255, blue: 65/255))
                                                .cornerRadius(4)
                                        }
                                    }
                                    
                                    Text(model.desc)
                                        .font(.system(size: 11))
                                        .foregroundColor(.secondary)
                                        .lineLimit(2)
                                        .multilineTextAlignment(.leading)
                                }
                                
                                Spacer()
                                
                                VStack(alignment: .trailing, spacing: 6) {
                                    Text("\(Double(model.bytes) / (1024.0 * 1024.0), specifier: "%.0f") MB")
                                        .font(.system(size: 10, weight: .bold))
                                        .foregroundColor(.secondary)
                                    
                                    if model.isDownloaded {
                                        Image(systemName: "checkmark.circle.fill")
                                            .foregroundColor(.green)
                                            .font(.system(size: 16))
                                    } else if isDownloadingThis {
                                        ProgressView(value: downloader.progress, total: 1.0)
                                            .frame(width: 44)
                                            .tint(Color(red: 224/255, green: 30/255, blue: 65/255))
                                    } else {
                                        Button(action: { triggerDownload(model: model) }) {
                                            Image(systemName: "arrow.down.circle.fill")
                                                .foregroundColor(Color(red: 224/255, green: 30/255, blue: 65/255))
                                                .font(.system(size: 18))
                                        }
                                    }
                                }
                            }
                            .padding()
                            .background(Color.white.opacity(isActive ? 0.08 : 0.02))
                            .cornerRadius(12)
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(isActive ? Color(red: 224/255, green: 30/255, blue: 65/255).opacity(0.4) : Color.white.opacity(0.04), lineWidth: 1.2)
                            )
                            .onTapGesture {
                                if model.isDownloaded {
                                    state.selectedModel = model.id
                                    state.saveAll()
                                }
                            }
                        }
                    }
                    .padding()
                    .background(Color.white.opacity(0.04))
                    .cornerRadius(16)
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .stroke(Color.white.opacity(0.06), lineWidth: 1)
                    )
                    
                    // SECTION 4: Developer Actions
                    VStack(alignment: .leading, spacing: 14) {
                        Text("App Maintenance")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundColor(.secondary)
                            .textCase(.uppercase)
                            .tracking(0.5)
                        
                        Button(action: { showResetAlert = true }) {
                            HStack {
                                Image(systemName: "arrow.counterclockwise")
                                Text("Reset Onboarding Flow")
                            }
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(.red)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                    .padding()
                    .background(Color.white.opacity(0.04))
                    .cornerRadius(16)
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .stroke(Color.white.opacity(0.06), lineWidth: 1)
                    )
                    .padding(.bottom, 24)
                }
                .padding()
            }
            .background(Color.black.ignoresSafeArea())
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
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
