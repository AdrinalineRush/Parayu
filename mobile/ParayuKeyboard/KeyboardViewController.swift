import UIKit

public struct DictionaryRule: Codable, Identifiable {
    public var id = UUID()
    public var from: String
    public var to: String
    
    public init(id: UUID = UUID(), from: String, to: String) {
        self.id = id
        self.from = from
        self.to = to
    }
}

public struct Snippet: Codable, Identifiable {
    public var id = UUID()
    public var trigger: String
    public var expansion: String
    
    public init(id: UUID = UUID(), trigger: String, expansion: String) {
        self.id = id
        self.trigger = trigger
        self.expansion = expansion
    }
}

private final class KeyboardKeyButton: UIButton {
    var output: String?
}

final class KeyboardViewController: UIInputViewController, UIInputViewAudioFeedback {
    var enableInputClicksWhenVisible: Bool {
        return true
    }

    private func triggerFeedback() {
        UIDevice.current.playInputClick()
        let generator = UIImpactFeedbackGenerator(style: .light)
        generator.prepare()
        generator.impactOccurred()
    }
    private var heightConstraint: NSLayoutConstraint?
    private var pendingTextTimer: Timer?
    private weak var statusLabel: UILabel?

    private let pendingActionKey = "pendingShortcutAction"
    private let appGroupId = "group.com.parayu.app"

    private var lettersLayoutView: UIStackView?
    private var symbolsLayoutView: UIStackView?
    private var letterButtons: [KeyboardKeyButton] = []
    private weak var shiftButton: KeyboardKeyButton?

    private enum KeyboardState {
        case lowercase
        case uppercase
        case symbols
    }

    private var keyboardState: KeyboardState = .lowercase

    private let accentColor = UIColor(red: 224 / 255, green: 30 / 255, blue: 65 / 255, alpha: 1)
    private let keyboardColor = UIColor(red: 27 / 255, green: 27 / 255, blue: 27 / 255, alpha: 1)
    private let statusColor = UIColor(red: 39 / 255, green: 39 / 255, blue: 39 / 255, alpha: 1)
    private let keyColor = UIColor(red: 62 / 255, green: 62 / 255, blue: 62 / 255, alpha: 1)
    private let specialKeyColor = UIColor(red: 45 / 255, green: 45 / 255, blue: 45 / 255, alpha: 1)
    private let disabledKeyColor = UIColor(red: 35 / 255, green: 35 / 255, blue: 35 / 255, alpha: 1)

    override func viewDidLoad() {
        super.viewDidLoad()
        setupKeyboard()
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        checkForPendingText()
        startPendingTextPolling()
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        pendingTextTimer?.invalidate()
        pendingTextTimer = nil
    }

    override func textWillChange(_ textInput: UITextInput?) {
        super.textWillChange(textInput)
        checkForPendingText()
    }

    private func setupKeyboard() {
        setupStandardKeyboardUI()
    }

    private func setupStandardKeyboardUI() {
        if lettersLayoutView == nil || lettersLayoutView?.superview == nil {
            createKeyboardLayouts()
        }

        if keyboardState == .symbols {
            lettersLayoutView?.isHidden = true
            symbolsLayoutView?.isHidden = false
        } else {
            symbolsLayoutView?.isHidden = true
            lettersLayoutView?.isHidden = false
            updateLetterKeysCapitalization()
        }
    }

    private func createKeyboardLayouts() {
        view.subviews.forEach { $0.removeFromSuperview() }
        view.backgroundColor = keyboardColor

        heightConstraint?.isActive = false
        heightConstraint = view.heightAnchor.constraint(equalToConstant: 258)
        heightConstraint?.priority = .required
        heightConstraint?.isActive = true

        let root = UIStackView()
        root.axis = .vertical
        root.alignment = .fill
        root.distribution = .fill
        root.spacing = 6
        root.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(root)

        NSLayoutConstraint.activate([
            root.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 3),
            root.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -3),
            root.topAnchor.constraint(equalTo: view.topAnchor, constant: 4),
            root.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -4)
        ])

        root.addArrangedSubview(makeStatusStrip())

        // 1. Build Letters Layout
        let lettersContainer = UIStackView()
        lettersContainer.axis = .vertical
        lettersContainer.spacing = 6
        lettersContainer.distribution = .fillEqually
        lettersLayoutView = lettersContainer
        root.addArrangedSubview(lettersContainer)
        buildLettersLayout(into: lettersContainer)

        // 2. Build Symbols Layout
        let symbolsContainer = UIStackView()
        symbolsContainer.axis = .vertical
        symbolsContainer.spacing = 6
        symbolsContainer.distribution = .fillEqually
        symbolsLayoutView = symbolsContainer
        root.addArrangedSubview(symbolsContainer)
        buildSymbolsLayout(into: symbolsContainer)
    }

    private func makeStatusStrip() -> UIView {
        let row = UIStackView()
        row.axis = .horizontal
        row.alignment = .center
        row.distribution = .fill
        row.spacing = 8
        row.isLayoutMarginsRelativeArrangement = true
        row.layoutMargins = UIEdgeInsets(top: 0, left: 13, bottom: 0, right: 9)
        row.heightAnchor.constraint(equalToConstant: 34).isActive = true
        row.backgroundColor = statusColor

        let dot = UIImageView(image: UIImage(systemName: "circle.fill"))
        dot.tintColor = UIColor(red: 255 / 255, green: 215 / 255, blue: 68 / 255, alpha: 1)
        dot.contentMode = .scaleAspectFit
        row.addArrangedSubview(dot)
        dot.widthAnchor.constraint(equalToConstant: 8).isActive = true

        let status = UILabel()
        status.text = "Parayu ready - Malayalam -> English"
        status.textColor = UIColor.white.withAlphaComponent(0.82)
        status.font = .systemFont(ofSize: 13, weight: .medium)
        status.adjustsFontSizeToFitWidth = true
        status.minimumScaleFactor = 0.74
        row.addArrangedSubview(status)
        statusLabel = status

        let keyboardIcon = UIImageView(image: UIImage(systemName: "keyboard.chevron.compact.down"))
        keyboardIcon.tintColor = UIColor.white.withAlphaComponent(0.78)
        keyboardIcon.contentMode = .scaleAspectFit
        row.addArrangedSubview(keyboardIcon)
        keyboardIcon.widthAnchor.constraint(equalToConstant: 24).isActive = true

        return row
    }

    private func buildLettersLayout(into container: UIStackView) {
        letterButtons.removeAll()
        
        let row1Keys = ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"]
        let row2Keys = ["a", "s", "d", "f", "g", "h", "j", "k", "l"]
        let row3Keys = ["z", "x", "c", "v", "b", "n", "m"]

        // Row 1
        let row1 = makeRow(height: 43)
        row1.distribution = .fillEqually
        for key in row1Keys {
            let btn = makeCharacterKey(title: key, output: key)
            btn.accessibilityIdentifier = key
            letterButtons.append(btn)
            row1.addArrangedSubview(btn)
        }
        container.addArrangedSubview(row1)

        // Row 2
        let row2Container = UIStackView()
        row2Container.axis = .horizontal
        row2Container.alignment = .fill
        row2Container.distribution = .fill
        row2Container.spacing = 5
        row2Container.heightAnchor.constraint(equalToConstant: 43).isActive = true

        let spacerL = UIView()
        let spacerR = UIView()
        row2Container.addArrangedSubview(spacerL)

        let row2KeysStack = UIStackView()
        row2KeysStack.axis = .horizontal
        row2KeysStack.alignment = .fill
        row2KeysStack.distribution = .fillEqually
        row2KeysStack.spacing = 5
        for key in row2Keys {
            let btn = makeCharacterKey(title: key, output: key)
            btn.accessibilityIdentifier = key
            letterButtons.append(btn)
            row2KeysStack.addArrangedSubview(btn)
        }
        row2Container.addArrangedSubview(row2KeysStack)
        row2Container.addArrangedSubview(spacerR)

        NSLayoutConstraint.activate([
            spacerL.widthAnchor.constraint(equalTo: row2Container.widthAnchor, multiplier: 0.05),
            spacerR.widthAnchor.constraint(equalTo: spacerL.widthAnchor)
        ])
        container.addArrangedSubview(row2Container)

        // Row 3
        let row3 = makeRow(height: 43)

        let shiftBtn = makeKey(title: nil, imageName: "shift", style: .special)
        shiftBtn.addTarget(self, action: #selector(toggleShift), for: .touchUpInside)
        shiftButton = shiftBtn
        row3.addArrangedSubview(shiftBtn)
        shiftBtn.widthAnchor.constraint(equalToConstant: 44).isActive = true

        let row3KeysStack = UIStackView()
        row3KeysStack.axis = .horizontal
        row3KeysStack.alignment = .fill
        row3KeysStack.distribution = .fillEqually
        row3KeysStack.spacing = 5
        for key in row3Keys {
            let btn = makeCharacterKey(title: key, output: key)
            btn.accessibilityIdentifier = key
            letterButtons.append(btn)
            row3KeysStack.addArrangedSubview(btn)
        }
        row3.addArrangedSubview(row3KeysStack)

        let deleteBtn = makeKey(title: nil, imageName: "delete.left", style: .special)
        deleteBtn.addTarget(self, action: #selector(deleteBackward), for: .touchUpInside)
        row3.addArrangedSubview(deleteBtn)
        deleteBtn.widthAnchor.constraint(equalToConstant: 44).isActive = true
        container.addArrangedSubview(row3)

        // Row 4
        let row4 = makeRow(height: 43)

        let toggleBtn = makeKey(title: "123", imageName: nil, style: .special)
        toggleBtn.addTarget(self, action: #selector(toggleKeyboardLayout), for: .touchUpInside)
        row4.addArrangedSubview(toggleBtn)
        toggleBtn.widthAnchor.constraint(equalToConstant: 54).isActive = true

        let micBtn = makeKey(title: nil, imageName: "mic.fill", style: .special)
        micBtn.addTarget(self, action: #selector(openDictation), for: .touchUpInside)
        micBtn.tintColor = accentColor
        row4.addArrangedSubview(micBtn)
        micBtn.widthAnchor.constraint(equalToConstant: 44).isActive = true

        let spaceBtn = makeKey(title: "space", imageName: nil, style: .character)
        spaceBtn.addTarget(self, action: #selector(insertSpace), for: .touchUpInside)
        row4.addArrangedSubview(spaceBtn)

        let returnBtn = makeKey(title: "return", imageName: nil, style: .special)
        returnBtn.addTarget(self, action: #selector(insertReturn), for: .touchUpInside)
        row4.addArrangedSubview(returnBtn)
        returnBtn.widthAnchor.constraint(equalToConstant: 76).isActive = true

        container.addArrangedSubview(row4)
    }

    private func buildSymbolsLayout(into container: UIStackView) {
        let row1Keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"]
        let row2Keys = ["-", "/", ":", ";", "(", ")", "$", "&", "@", "\""]
        let row3Keys = [".", ",", "?", "!", "'"]

        // Row 1
        let row1 = makeRow(height: 43)
        row1.distribution = .fillEqually
        for key in row1Keys {
            row1.addArrangedSubview(makeCharacterKey(title: key, output: key))
        }
        container.addArrangedSubview(row1)

        // Row 2
        let row2 = makeRow(height: 43)
        row2.distribution = .fillEqually
        for key in row2Keys {
            row2.addArrangedSubview(makeCharacterKey(title: key, output: key))
        }
        container.addArrangedSubview(row2)

        // Row 3
        let row3 = makeRow(height: 43)

        let altSymbols = makeKey(title: "#+=", imageName: nil, style: .special)
        row3.addArrangedSubview(altSymbols)
        altSymbols.widthAnchor.constraint(equalToConstant: 44).isActive = true

        let row3KeysStack = UIStackView()
        row3KeysStack.axis = .horizontal
        row3KeysStack.alignment = .fill
        row3KeysStack.distribution = .fillEqually
        row3KeysStack.spacing = 5
        for key in row3Keys {
            row3KeysStack.addArrangedSubview(makeCharacterKey(title: key, output: key))
        }
        row3.addArrangedSubview(row3KeysStack)

        let deleteBtn = makeKey(title: nil, imageName: "delete.left", style: .special)
        deleteBtn.addTarget(self, action: #selector(deleteBackward), for: .touchUpInside)
        row3.addArrangedSubview(deleteBtn)
        deleteBtn.widthAnchor.constraint(equalToConstant: 44).isActive = true
        container.addArrangedSubview(row3)

        // Row 4
        let row4 = makeRow(height: 43)

        let toggleBtn = makeKey(title: "ABC", imageName: nil, style: .special)
        toggleBtn.addTarget(self, action: #selector(toggleKeyboardLayout), for: .touchUpInside)
        row4.addArrangedSubview(toggleBtn)
        toggleBtn.widthAnchor.constraint(equalToConstant: 54).isActive = true

        let micBtn = makeKey(title: nil, imageName: "mic.fill", style: .special)
        micBtn.addTarget(self, action: #selector(openDictation), for: .touchUpInside)
        micBtn.tintColor = accentColor
        row4.addArrangedSubview(micBtn)
        micBtn.widthAnchor.constraint(equalToConstant: 44).isActive = true

        let spaceBtn = makeKey(title: "space", imageName: nil, style: .character)
        spaceBtn.addTarget(self, action: #selector(insertSpace), for: .touchUpInside)
        row4.addArrangedSubview(spaceBtn)

        let returnBtn = makeKey(title: "return", imageName: nil, style: .special)
        returnBtn.addTarget(self, action: #selector(insertReturn), for: .touchUpInside)
        row4.addArrangedSubview(returnBtn)
        returnBtn.widthAnchor.constraint(equalToConstant: 76).isActive = true

        container.addArrangedSubview(row4)
    }

    private func updateLetterKeysCapitalization() {
        let isUpper = (keyboardState == .uppercase)
        for btn in letterButtons {
            if let raw = btn.accessibilityIdentifier {
                let title = isUpper ? raw.uppercased() : raw.lowercased()
                btn.setTitle(title, for: .normal)
                btn.output = title
            }
        }
        shiftButton?.setImage(UIImage(systemName: isUpper ? "shift.fill" : "shift"), for: .normal)
    }

    @objc private func toggleShift() {
        triggerFeedback()
        if keyboardState == .lowercase {
            keyboardState = .uppercase
        } else {
            keyboardState = .lowercase
        }
        updateLetterKeysCapitalization()
    }

    @objc private func toggleKeyboardLayout() {
        triggerFeedback()
        if keyboardState == .symbols {
            keyboardState = .lowercase
        } else {
            keyboardState = .symbols
        }
        setupKeyboard()
    }

    @objc private func insertSpace() {
        triggerFeedback()
        textDocumentProxy.insertText(" ")
    }

    private enum KeyStyle {
        case character
        case special
        case icon
        case brand
    }

    private func makeRow(height: CGFloat = 43) -> UIStackView {
        let row = UIStackView()
        row.axis = .horizontal
        row.alignment = .fill
        row.distribution = .fill
        row.spacing = 5
        row.heightAnchor.constraint(equalToConstant: height).isActive = true
        return row
    }

    private func makeCharacterKey(title: String, output: String) -> KeyboardKeyButton {
        let button = makeKey(title: title, imageName: nil, style: .character)
        button.output = output
        button.addTarget(self, action: #selector(insertCharacter(_:)), for: .touchUpInside)
        return button
    }

    private func makeKey(title: String?, imageName: String?, style: KeyStyle) -> KeyboardKeyButton {
        let button = KeyboardKeyButton(type: .system)
        button.backgroundColor = {
            switch style {
            case .character:
                return keyColor
            case .special, .icon, .brand:
                return specialKeyColor
            }
        }()
        button.tintColor = .white
        button.layer.cornerRadius = 7
        button.layer.cornerCurve = .continuous
        button.layer.shadowColor = UIColor.black.cgColor
        button.layer.shadowOpacity = 0.22
        button.layer.shadowOffset = CGSize(width: 0, height: 1)
        button.layer.shadowRadius = 0
        button.setTitleColor(.white, for: .normal)
        button.setTitleColor(UIColor.white.withAlphaComponent(0.62), for: .highlighted)
        button.titleLabel?.font = {
            switch style {
            case .special, .icon, .brand:
                return .systemFont(ofSize: 15, weight: .medium)
            case .character:
                return .systemFont(ofSize: 20, weight: .regular)
            }
        }()

        if let title {
            button.setTitle(title, for: .normal)
        }

        if let imageName {
            button.setImage(UIImage(systemName: imageName), for: .normal)
            button.imageView?.contentMode = .scaleAspectFit
        }

        return button
    }

    @objc private func insertCharacter(_ sender: KeyboardKeyButton) {
        triggerFeedback()
        guard let output = sender.output else { return }
        textDocumentProxy.insertText(output)
        
        if keyboardState == .uppercase {
            keyboardState = .lowercase
            updateLetterKeysCapitalization()
        }
    }

    @objc private func insertReturn() {
        triggerFeedback()
        textDocumentProxy.insertText("\n")
    }

    @objc private func deleteBackward() {
        triggerFeedback()
        textDocumentProxy.deleteBackward()
    }

    @objc private func openDictation() {
        triggerFeedback()
        // iOS does NOT permit microphone capture inside a keyboard extension:
        // AVAudioEngine returns kAudioUnitErr_CannotDoInCurrentContext (2003329396)
        // and AVAudioRecorder yields 0-frame files. So instead of recording here we
        // hand off to the main Parayu app, which records + runs Whisper, then writes
        // the clean English to the shared App Group ("latestTranscribedText").
        // checkForPendingText() (polled + on viewWillAppear/textWillChange) inserts
        // it automatically once the user returns to this text field.
        showTemporaryStatus("Opening Parayu\u{2026}")
        let url = URL(string: "parayu://dictate")!
        if !openURLThroughResponderChain(url) {
            showTemporaryStatus("Enable Full Access for Parayu Keyboard in Settings")
        }
    }

    @objc private func nextKeyboard() {
        advanceToNextInputMode()
    }

    private func startPendingTextPolling() {
        pendingTextTimer?.invalidate()
        pendingTextTimer = Timer.scheduledTimer(withTimeInterval: 0.45, repeats: true) { [weak self] _ in
            self?.checkForPendingText()
        }
    }

    private func checkForPendingText() {
        let defaults = UserDefaults(suiteName: appGroupId) ?? .standard
        guard let text = defaults.string(forKey: "latestTranscribedText"), !text.isEmpty else {
            return
        }

        textDocumentProxy.insertText(text)
        defaults.removeObject(forKey: "latestTranscribedText")
        defaults.synchronize()
        showTemporaryStatus("Inserted")
    }

    @discardableResult
    private func openURLThroughResponderChain(_ url: URL) -> Bool {
        let selector = NSSelectorFromString("openURL:")
        var responder: UIResponder? = self

        while let current = responder {
            if current.responds(to: selector) {
                current.perform(selector, with: url)
                return true
            }
            responder = current.next
        }

        return false
    }

    private func showTemporaryStatus(_ text: String) {
        statusLabel?.text = text

        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) { [weak self] in
            guard self?.statusLabel?.text == text else { return }
            self?.statusLabel?.text = "Parayu ready - Malayalam -> English"
        }
    }

}
