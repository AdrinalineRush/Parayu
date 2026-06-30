import Foundation
import Combine

public struct WhisperModelInfo: Identifiable, Codable {
    public let id: String
    public let label: String
    public let file: String
    public let bytes: Int64
    public let desc: String
    public var bullets: [String] = []

    public var isEnglishOnly: Bool { id.contains(".en") }

    public var isDownloaded: Bool {
        return WhisperModelInfo.availableModelURL(file: file, expectedBytes: bytes) != nil
    }
    
    public static func availableModelURL(file: String, expectedBytes: Int64) -> URL? {
        if let bundled = bundledModelURL(file: file), isUsableModel(at: bundled, expectedBytes: expectedBytes) {
            return bundled
        }
        let dest = modelPath(file: file)
        
        // Auto-migrate from old application support path if it exists
        if !FileManager.default.fileExists(atPath: dest.path) {
            let oldPaths = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)
            let oldDir = oldPaths[0].appendingPathComponent("Parayu/models", isDirectory: true)
            let oldFile = oldDir.appendingPathComponent(file)
            if FileManager.default.fileExists(atPath: oldFile.path) {
                try? FileManager.default.moveItem(at: oldFile, to: dest)
            }
        }
        
        guard isUsableModel(at: dest, expectedBytes: expectedBytes) else { return nil }
        return dest
    }
    
    public static func bundledModelURL(file: String) -> URL? {
        if let exact = Bundle.main.url(forResource: file, withExtension: nil) {
            return exact
        }
        let url = Bundle.main.resourceURL?.appendingPathComponent(file)
        if let url, FileManager.default.fileExists(atPath: url.path) {
            return url
        }
        let ns = file as NSString
        return Bundle.main.url(forResource: ns.deletingPathExtension, withExtension: ns.pathExtension)
    }
    
    private static func isUsableModel(at url: URL, expectedBytes: Int64) -> Bool {
        guard FileManager.default.fileExists(atPath: url.path) else { return false }
        if let attr = try? FileManager.default.attributesOfItem(atPath: url.path),
           let size = attr[.size] as? Int64 {
            // Sanity check: must be at least 85% of expected bytes
            return size > Int64(Double(expectedBytes) * 0.85)
        }
        return false
    }
    
    public static func modelPath(file: String) -> URL {
        if let groupURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.com.parayu.app") {
            let dir = groupURL.appendingPathComponent("Library/Application Support/Parayu/models", isDirectory: true)
            try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
            return dir.appendingPathComponent(file)
        }
        let paths = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)
        let dir = paths[0].appendingPathComponent("Parayu/models", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent(file)
    }
    
    public static func modelById(_ id: String) -> WhisperModelInfo {
        return WHISPER_MODELS.first { $0.id == id } ?? WHISPER_MODELS.first { $0.id == "small-q5_1" } ?? WHISPER_MODELS[0]
    }

    public static func bestModelFor(language: String, selectedModelId: String) -> WhisperModelInfo {
        // Like the macOS app: a single multilingual model serves both languages;
        // the spoken language is handled by the decoding params, not by swapping models.
        let selected = modelById(selectedModelId)
        // Malayalam needs a multilingual model; an English-only model can't do it.
        if language == "ml" && selected.isEnglishOnly {
            return modelById("small-q5_1")
        }
        return selected
    }
}

// Brain Switch catalog — phone-tuned tiers (macOS "Brain Switch" style). One model
// serves a language path; HIGH (small-q5_1) is bundled in the app and is the default.
// Sizes capped for phone: PRO = 539MB (the desktop 844MB/2.9GB tiers are not shipped).
public let WHISPER_MODELS = [
    // Multilingual tiers (handle both English and Malayalam)
    WhisperModelInfo(id: "base", label: "MEDIUM", file: "ggml-base.bin", bytes: 148 * 1024 * 1024,
        desc: "Lightweight model with fast inference and a very low memory footprint.",
        bullets: [
            "Fastest transcription speed on any device",
            "Supports 99+ languages locally",
            "Great for quick notes and short dictation",
            "Extremely low memory footprint (ideal for multitasking)"
        ]),
    WhisperModelInfo(id: "small-q5_1", label: "HIGH", file: "ggml-small-q5_1.bin", bytes: 190 * 1024 * 1024,
        desc: "Balanced model delivering solid accuracy with fast, native-GPU inference.",
        bullets: [
            "Recommended balance of speed and accuracy",
            "Strong Malayalam ↔ English translation",
            "Supports 99+ languages locally",
            "Quantized to 5-bit precision for native GPU performance"
        ]),
    WhisperModelInfo(id: "medium-q5_0", label: "PRO", file: "ggml-medium-q5_0.bin", bytes: 539 * 1024 * 1024,
        desc: "Highest on-device accuracy with excellent Malayalam understanding.",
        bullets: [
            "Best Malayalam to English translation quality on phone",
            "Highly sensitive to naming, punctuation, and terms",
            "Robust grammar and spacing recognition",
            "Quantized to 5-bit precision, accelerated on Apple Silicon"
        ]),

    // English-only counterparts (faster + sharper for English; cannot do Malayalam)
    WhisperModelInfo(id: "base.en", label: "MEDIUM", file: "ggml-base.en.bin", bytes: 148 * 1024 * 1024,
        desc: "Lightweight English-only model — the fastest English dictation.",
        bullets: [
            "Fastest English transcription on any device",
            "Sharper than multilingual at the same size for English",
            "Extremely low memory footprint",
            "English only — cannot transcribe Malayalam"
        ]),
    WhisperModelInfo(id: "small.en-q5_1", label: "HIGH", file: "ggml-small.en-q5_1.bin", bytes: 190 * 1024 * 1024,
        desc: "Balanced English-only model — recommended for English dictation.",
        bullets: [
            "Recommended balance of speed and English accuracy",
            "Specialized for English — sharper than multilingual",
            "Low memory footprint",
            "English only — cannot transcribe Malayalam"
        ]),
    WhisperModelInfo(id: "medium.en-q5_0", label: "PRO", file: "ggml-medium.en-q5_0.bin", bytes: 539 * 1024 * 1024,
        desc: "Highest-accuracy English-only model, great with names and accents.",
        bullets: [
            "Top English accuracy, strong with proper nouns",
            "Best for professional English dictation",
            "Robust punctuation and casing",
            "English only — cannot transcribe Malayalam"
        ])
]

public class WhisperModelDownloader: NSObject, ObservableObject, URLSessionDownloadDelegate {
    @Published public var progress: Double = 0.0
    @Published public var isDownloading = false
    
    private var downloadTask: URLSessionDownloadTask?
    private var completionHandler: ((URL?, Error?) -> Void)?
    
    public func downloadModel(url: URL, completion: @escaping (URL?, Error?) -> Void) {
        self.completionHandler = completion
        self.progress = 0.0
        self.isDownloading = true
        
        let config = URLSessionConfiguration.default
        let session = URLSession(configuration: config, delegate: self, delegateQueue: OperationQueue.main)
        
        let task = session.downloadTask(with: url)
        self.downloadTask = task
        task.resume()
    }
    
    public func cancelDownload() {
        downloadTask?.cancel()
        isDownloading = false
    }
    
    public func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didWriteData bytesWritten: Int64, totalBytesWritten: Int64, totalBytesExpectedToWrite: Int64) {
        guard totalBytesExpectedToWrite > 0 else { return }
        DispatchQueue.main.async {
            self.progress = Double(totalBytesWritten) / Double(totalBytesExpectedToWrite)
        }
    }
    
    public func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didFinishDownloadingTo location: URL) {
        self.isDownloading = false
        self.completionHandler?(location, nil)
    }
    
    public func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        self.isDownloading = false
        if let error = error {
            self.completionHandler?(nil, error)
        }
    }
}

public actor WhisperCoreTranslator {
    private var context: OpaquePointer?
    private var loadedModelPath: String?
    private let maxSamples = 16000 * 30
    
    public init() {}
    
    deinit {
        if let context = context {
            whisper_free(context)
        }
    }
    
    public func loadModel(path: String) throws {
        if context != nil {
            if loadedModelPath == path {
                return // already loaded
            }
            whisper_free(context)
            context = nil
        }
        
        let pathPointer = (path as NSString).utf8String
        var params = whisper_context_default_params()
        params.use_gpu = true       // Metal GPU backend (compiled in via GGML_USE_METAL)
        params.flash_attn = true    // big speedup + lower memory on Metal
        context = whisper_init_from_file_with_params(pathPointer, params)
        if context == nil {
            throw NSError(domain: "ParayuWhisperError", code: 2, userInfo: [NSLocalizedDescriptionKey: "Failed to initialize whisper context from model file"])
        }
        loadedModelPath = path
    }
    
    public func translate(samples: [Float], language: String, translateToEnglish: Bool) throws -> String {
        guard let context = context else {
            throw NSError(domain: "ParayuWhisperError", code: 3, userInfo: [NSLocalizedDescriptionKey: "Model not loaded"])
        }
        guard !samples.isEmpty else {
            throw NSError(domain: "ParayuWhisperError", code: 7, userInfo: [NSLocalizedDescriptionKey: "No audio was captured. Please try again."])
        }
        let languageIsSupported = language.withCString { languagePointer in
            whisper_lang_id(languagePointer) >= 0
        }
        guard languageIsSupported else {
            throw NSError(domain: "ParayuWhisperError", code: 8, userInfo: [NSLocalizedDescriptionKey: "Unsupported speech language: \(language)"])
        }
        
        var params = whisper_full_default_params(WHISPER_SAMPLING_GREEDY)
        
        params.print_realtime = false
        params.print_progress = false
        params.print_timestamps = false
        params.print_special = false
        params.n_threads = Int32(max(2, ProcessInfo.processInfo.activeProcessorCount - 1))
        params.no_context = true
        params.single_segment = language != "ml"
        params.translate = translateToEnglish
        
        let boundedSamples = samples.count > maxSamples ? Array(samples.prefix(maxSamples)) : samples

        // Trim the encoder window to the actual audio length. Whisper otherwise always
        // runs the encoder over a full 30s window (1500 frames) even for a 5s clip, which
        // dominates latency for short dictation. ~320 samples per audio-ctx frame; add a
        // ~1.3s headroom so we never clip the tail of speech, and clamp to the model max.
        let modelMaxAudioCtx = whisper_model_n_audio_ctx(context)
        if modelMaxAudioCtx > 0 {
            let audioFrames = Int((Double(boundedSamples.count) / 320.0).rounded(.up))
            let clamped = min(Int(modelMaxAudioCtx), max(256, audioFrames + 64))
            params.audio_ctx = Int32(clamped)
        }

        let result = try language.withCString { languagePointer in
            params.language = languagePointer
            return try boundedSamples.withUnsafeBufferPointer { sampleBuffer in
                guard let samplePointer = sampleBuffer.baseAddress else {
                    throw NSError(domain: "ParayuWhisperError", code: 7, userInfo: [NSLocalizedDescriptionKey: "No audio was captured. Please try again."])
                }
                return whisper_full(context, params, samplePointer, Int32(sampleBuffer.count))
            }
        }
        
        if result != 0 {
            throw NSError(domain: "ParayuWhisperError", code: 4, userInfo: [NSLocalizedDescriptionKey: "Whisper inference failed with code \(result). Please try a shorter recording."])
        }
        
        let nSegments = whisper_full_n_segments(context)
        var text = ""
        for i in 0..<nSegments {
            if let segmentTextPointer = whisper_full_get_segment_text(context, i) {
                let segmentText = String(cString: segmentTextPointer)
                text += segmentText
            }
        }
        
        // Clean up common brackets
        text = text.replacingOccurrences(of: "\\[[^\\]]*\\]", with: "", options: .regularExpression)
        text = text.replacingOccurrences(of: "\\([^\\)]*\\)", with: "", options: .regularExpression)
        text = text.replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
        
        let trimmedText = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedText.isEmpty else {
            throw NSError(domain: "ParayuWhisperError", code: 9, userInfo: [NSLocalizedDescriptionKey: "No speech was recognized. Please speak Malayalam clearly for 3-5 seconds and try again."])
        }
        return trimmedText
    }
}

#if !KEYBOARD
public class WhisperSpeechTranslator: ObservableObject {
    private let core = WhisperCoreTranslator()
    public let downloader = WhisperModelDownloader()
    
    private var cancellables = Set<AnyCancellable>()
    private let HF_BASE = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/"
    
    public init() {}
    
    public func ensureModelAndTranslate(samples: [Float], state: AppState, completion: @escaping (Result<String, Error>) -> Void) {
        let language = state.inputLanguage
        let model = WhisperModelInfo.bestModelFor(language: language, selectedModelId: state.selectedModel)
        let modelPath = WhisperModelInfo.modelPath(file: model.file)
        
        if let availableModel = WhisperModelInfo.availableModelURL(file: model.file, expectedBytes: model.bytes) {
            print("Parayu Whisper: language=\(language), model=\(model.id), path=\(availableModel.path), samples=\(samples.count)")
            self.loadAndTranslate(samples: samples, path: availableModel.path, state: state, completion: completion)
        } else {
            // Needs download
            let urlString = HF_BASE + model.file
            guard let url = URL(string: urlString) else {
                completion(.failure(NSError(domain: "ParayuWhisperError", code: 5, userInfo: [NSLocalizedDescriptionKey: "Invalid HuggingFace download URL"])))
                return
            }
            
            DispatchQueue.main.async {
                state.downloadPhase = "downloading"
                state.downloadProgress = 0.0
                state.currentStatusText = "Downloading model…"
            }
            
            // Connect downloader progress
            downloader.$progress
                .receive(on: RunLoop.main)
                .sink { progress in
                    state.downloadProgress = progress
                    state.currentStatusText = "Downloading model… \(Int(progress * 100))%"
                }
                .store(in: &cancellables)
            
            downloader.downloadModel(url: url) { [weak self] tempUrl, error in
                self?.cancellables.removeAll()
                
                if let error = error {
                    DispatchQueue.main.async {
                        state.downloadPhase = "idle"
                        state.currentStatusText = ""
                    }
                    completion(.failure(error))
                    return
                }
                
                guard let tempUrl = tempUrl else {
                    DispatchQueue.main.async {
                        state.downloadPhase = "idle"
                        state.currentStatusText = ""
                    }
                    completion(.failure(NSError(domain: "ParayuWhisperError", code: 6, userInfo: [NSLocalizedDescriptionKey: "Download completed but temp file path is missing"])))
                    return
                }
                
                do {
                    // Move file to application support
                    if FileManager.default.fileExists(atPath: modelPath.path) {
                        try FileManager.default.removeItem(at: modelPath)
                    }
                    try FileManager.default.moveItem(at: tempUrl, to: modelPath)
                    
                    self?.loadAndTranslate(samples: samples, path: modelPath.path, state: state, completion: completion)
                } catch {
                    DispatchQueue.main.async {
                        state.downloadPhase = "idle"
                        state.currentStatusText = ""
                    }
                    completion(.failure(error))
                }
            }
        }
    }
    
    private func loadAndTranslate(samples: [Float], path: String, state: AppState, completion: @escaping (Result<String, Error>) -> Void) {
        DispatchQueue.main.async {
            state.downloadPhase = "loading"
            state.currentStatusText = "Loading model…"
        }
        
        let core = self.core
        Task.detached(priority: .userInitiated) {
            do {
                try await core.loadModel(path: path)
                
                DispatchQueue.main.async {
                    state.downloadPhase = "transcribing"
                    state.currentStatusText = "Transcribing…"
                }
                
                let translate = (state.inputLanguage == "ml" && state.translateMalayalam) // Translate Malayalam to English if toggle is enabled
                let language = state.inputLanguage
                
                let translatedText = try await core.translate(samples: samples, language: language, translateToEnglish: translate)
                
                DispatchQueue.main.async {
                    state.downloadPhase = "idle"
                    state.currentStatusText = ""
                }
                completion(.success(translatedText))
            } catch {
                DispatchQueue.main.async {
                    state.downloadPhase = "idle"
                    state.currentStatusText = ""
                }
                completion(.failure(error))
            }
        }
    }
}
#endif
