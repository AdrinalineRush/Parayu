import Foundation
import whisper
import Combine

public struct WhisperModelInfo: Identifiable, Codable {
    public let id: String
    public let label: String
    public let file: String
    public let bytes: Int64
    public let desc: String
    
    public var isDownloaded: Bool {
        let dest = WhisperModelInfo.modelPath(file: file)
        guard FileManager.default.fileExists(atPath: dest.path) else { return false }
        if let attr = try? FileManager.default.attributesOfItem(atPath: dest.path),
           let size = attr[.size] as? Int64 {
            // Sanity check: must be at least 85% of expected bytes
            return size > Int64(Double(bytes) * 0.85)
        }
        return false
    }
    
    public static func modelPath(file: String) -> URL {
        let paths = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)
        let dir = paths[0].appendingPathComponent("Parayu/models", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent(file)
    }
    
    public static func modelById(_ id: String) -> WhisperModelInfo {
        return WHISPER_MODELS.first { $0.id == id } ?? WHISPER_MODELS[6] // default to small-q5_1
    }
}

public let WHISPER_MODELS = [
    WhisperModelInfo(id: "tiny.en", label: "Tiny (English)", file: "ggml-tiny.en.bin", bytes: 78 * 1024 * 1024, desc: "English only. Lightning fast, smallest download."),
    WhisperModelInfo(id: "base.en", label: "Base (English)", file: "ggml-base.en.bin", bytes: 148 * 1024 * 1024, desc: "English only. Fast with solid everyday accuracy."),
    WhisperModelInfo(id: "small.en-q5_1", label: "Small (English)", file: "ggml-small.en-q5_1.bin", bytes: 190 * 1024 * 1024, desc: "English only. Recommended balance of accuracy and speed."),
    WhisperModelInfo(id: "medium.en-q5_0", label: "Medium (English)", file: "ggml-medium.en-q5_0.bin", bytes: 539 * 1024 * 1024, desc: "English only. Highest accuracy, best with names/accents."),
    WhisperModelInfo(id: "tiny", label: "Tiny (Multilingual)", file: "ggml-tiny.bin", bytes: 78 * 1024 * 1024, desc: "Supports 99+ languages. Extremely fast, lower translation quality."),
    WhisperModelInfo(id: "base", label: "Base (Multilingual)", file: "ggml-base.bin", bytes: 148 * 1024 * 1024, desc: "Supports 99+ languages. Fast with decent translation accuracy."),
    WhisperModelInfo(id: "small-q5_1", label: "Small (Multilingual)", file: "ggml-small-q5_1.bin", bytes: 190 * 1024 * 1024, desc: "Supports 99+ languages. Recommended balance of translation quality and speed."),
    WhisperModelInfo(id: "medium-q5_0", label: "Medium (Multilingual)", file: "ggml-medium-q5_0.bin", bytes: 539 * 1024 * 1024, desc: "Supports 99+ languages. Highest quality translation, best for complex speech.")
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
        context = whisper_init_from_file(pathPointer)
        if context == nil {
            throw NSError(domain: "ParayuWhisperError", code: 2, userInfo: [NSLocalizedDescriptionKey: "Failed to initialize whisper context from model file"])
        }
        loadedModelPath = path
    }
    
    public func translate(samples: [Float], language: String, translateToEnglish: Bool) throws -> String {
        guard let context = context else {
            throw NSError(domain: "ParayuWhisperError", code: 3, userInfo: [NSLocalizedDescriptionKey: "Model not loaded"])
        }
        
        var params = whisper_full_default_params(WHISPER_SAMPLING_GREEDY)
        
        params.print_realtime = false
        params.print_progress = false
        params.print_timestamps = false
        params.print_special = false
        params.n_threads = Int32(max(2, ProcessInfo.processInfo.activeProcessorCount - 1))
        
        let langPointer = (language as NSString).utf8String
        params.language = langPointer
        
        params.translate = translateToEnglish
        
        let result = whisper_full(context, params, samples, Int32(samples.count))
        if result != 0 {
            throw NSError(domain: "ParayuWhisperError", code: 4, userInfo: [NSLocalizedDescriptionKey: "Whisper inference failed with code \(result)"])
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
        
        return text.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

public class WhisperSpeechTranslator: ObservableObject {
    private let core = WhisperCoreTranslator()
    public let downloader = WhisperModelDownloader()
    
    private var cancellables = Set<AnyCancellable>()
    private let HF_BASE = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/"
    
    public init() {}
    
    public func ensureModelAndTranslate(samples: [Float], state: AppState, completion: @escaping (Result<String, Error>) -> Void) {
        let model = WhisperModelInfo.modelById(state.selectedModel)
        let modelPath = WhisperModelInfo.modelPath(file: model.file)
        
        if model.isDownloaded {
            self.loadAndTranslate(samples: samples, path: modelPath.path, state: state, completion: completion)
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
        
        Task {
            do {
                try await core.loadModel(path: path)
                
                DispatchQueue.main.async {
                    state.downloadPhase = "transcribing"
                    state.currentStatusText = "Transcribing…"
                }
                
                let translate = (state.inputLanguage == "ml") // Translate Malayalam to English
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
