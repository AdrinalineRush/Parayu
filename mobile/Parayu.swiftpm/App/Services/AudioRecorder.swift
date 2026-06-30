import Foundation
import AVFoundation

public class AudioRecorder: NSObject, ObservableObject {
    private var audioEngine: AVAudioEngine?
    private var inputNode: AVAudioInputNode?
    
    private var recordedSamples: [Float] = []
    private var sampleRate: Double = 16000.0
    
    @Published public var isRecording = false
    @Published public var audioLevel: Float = 0.0 // 0..1
    
    public var onLevelChange: ((Float) -> Void)?
    
    public override init() {
        super.init()
    }
    
    public func startRecording() throws {
        recordedSamples.removeAll()
        
        let audioSession = AVAudioSession.sharedInstance()
        try audioSession.setCategory(.playAndRecord, mode: .measurement, options: [.defaultToSpeaker, .allowBluetoothHFP])
        try audioSession.setActive(true)
        
        audioEngine = AVAudioEngine()
        guard let engine = audioEngine else { return }
        
        let input = engine.inputNode
        inputNode = input
        
        let inputFormat = input.inputFormat(forBus: 0)
        let targetFormat = AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: sampleRate, channels: 1, interleaved: false)!
        
        guard let converter = AVAudioConverter(from: inputFormat, to: targetFormat) else {
            throw NSError(domain: "ParayuAudioError", code: 1, userInfo: [NSLocalizedDescriptionKey: "Failed to create audio format converter"])
        }
        
        input.installTap(onBus: 0, bufferSize: 1024, format: inputFormat) { [weak self] (buffer, time) in
            guard let self = self else { return }
            
            var didProvideInput = false
            let inputCallback: AVAudioConverterInputBlock = { inNumPackets, outStatus in
                if didProvideInput {
                    outStatus.pointee = .noDataNow
                    return nil
                }
                didProvideInput = true
                outStatus.pointee = .haveData
                return buffer
            }
            
            let capacity = max(1, AVAudioFrameCount(Double(buffer.frameLength) * (self.sampleRate / inputFormat.sampleRate)))
            guard let convertedBuffer = AVAudioPCMBuffer(pcmFormat: targetFormat, frameCapacity: capacity) else { return }
            
            var error: NSError?
            converter.convert(to: convertedBuffer, error: &error, withInputFrom: inputCallback)
            
            if let error = error {
                print("Audio conversion error: \(error)")
                return
            }
            
            if let channelData = convertedBuffer.floatChannelData {
                let channelDataPointer = channelData[0]
                let frameLength = Int(convertedBuffer.frameLength)
                guard frameLength > 0 else { return }
                
                let samples = Array(UnsafeBufferPointer(start: channelDataPointer, count: frameLength))
                self.recordedSamples.append(contentsOf: samples)
                
                var sumSquares: Float = 0.0
                for i in 0..<frameLength {
                    let sample = samples[i]
                    sumSquares += sample * sample
                }
                let rms = sqrt(sumSquares / Float(frameLength))
                let uiLevel = min(1.0, rms * 6.0)
                
                DispatchQueue.main.async {
                    self.audioLevel = uiLevel
                    self.onLevelChange?(uiLevel)
                }
            }
        }
        
        engine.prepare()
        try engine.start()
        
        DispatchQueue.main.async {
            self.isRecording = true
        }
    }
    
    public func stopRecording() -> [Float] {
        guard let engine = audioEngine, isRecording else { return [] }
        
        inputNode?.removeTap(onBus: 0)
        engine.stop()
        
        audioEngine = nil
        inputNode = nil
        
        DispatchQueue.main.async {
            self.isRecording = false
            self.audioLevel = 0.0
        }
        
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)

        return recordedSamples
    }
}

// MARK: - Text-to-speech for the "read aloud" button on the result card.
final class SpeechService: NSObject, ObservableObject, AVSpeechSynthesizerDelegate {
    private let synthesizer = AVSpeechSynthesizer()
    @Published var isSpeaking = false

    override init() {
        super.init()
        synthesizer.delegate = self
    }

    /// Speaks the text, or stops if already speaking. `language` is a BCP-47 tag (e.g. "en-US", "ml-IN").
    func toggle(_ text: String, language: String = "en-US") {
        if synthesizer.isSpeaking {
            synthesizer.stopSpeaking(at: .immediate)
            isSpeaking = false
            return
        }

        let clean = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty else { return }

        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, options: [.duckOthers])
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            // Non-fatal — speech will still attempt to play.
        }

        let utterance = AVSpeechUtterance(string: clean)
        utterance.voice = AVSpeechSynthesisVoice(language: language)
            ?? AVSpeechSynthesisVoice(language: "en-US")
        utterance.rate = AVSpeechUtteranceDefaultSpeechRate
        utterance.postUtteranceDelay = 0

        isSpeaking = true
        synthesizer.speak(utterance)
    }

    func stop() {
        synthesizer.stopSpeaking(at: .immediate)
        isSpeaking = false
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        DispatchQueue.main.async { self.isSpeaking = false }
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        DispatchQueue.main.async { self.isSpeaking = false }
    }
}
