import UIKit

private final class KeyboardKeyButton: UIButton {
    var output: String?
}

final class KeyboardViewController: UIInputViewController {
    private var heightConstraint: NSLayoutConstraint?
    private var pendingTextTimer: Timer?
    private weak var statusLabel: UILabel?

    private let pendingActionKey = "pendingShortcutAction"
    private let appGroupId = "group.com.parayu.app"

    private let accentColor = UIColor(red: 224 / 255, green: 30 / 255, blue: 65 / 255, alpha: 1)
    private let keyboardColor = UIColor(red: 30 / 255, green: 30 / 255, blue: 24 / 255, alpha: 1)
    private let statusColor = UIColor(red: 55 / 255, green: 55 / 255, blue: 37 / 255, alpha: 1)
    private let keyColor = UIColor(red: 78 / 255, green: 78 / 255, blue: 73 / 255, alpha: 1)
    private let specialKeyColor = UIColor(red: 64 / 255, green: 64 / 255, blue: 59 / 255, alpha: 1)
    private let disabledKeyColor = UIColor(red: 83 / 255, green: 83 / 255, blue: 77 / 255, alpha: 1)

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
        root.spacing = 5
        root.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(root)

        NSLayoutConstraint.activate([
            root.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 3),
            root.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -3),
            root.topAnchor.constraint(equalTo: view.topAnchor, constant: 0),
            root.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -6)
        ])

        root.addArrangedSubview(makeStatusStrip())
        root.addArrangedSubview(makeControlRow())
        addSymbolRows(to: root)
        root.addArrangedSubview(makeGlobeRow())
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

    private func makeControlRow() -> UIView {
        let row = makeRow(height: 43)
        row.isLayoutMarginsRelativeArrangement = true
        row.layoutMargins = UIEdgeInsets(top: 0, left: 0, bottom: 0, right: 0)

        let settings = makeKey(title: nil, imageName: "slider.horizontal.3", style: .icon)
        settings.addTarget(self, action: #selector(openDictation), for: .touchUpInside)
        row.addArrangedSubview(settings)
        settings.widthAnchor.constraint(equalToConstant: 47).isActive = true

        let spacer = UIView()
        row.addArrangedSubview(spacer)

        let undo = makeRoundButton(imageName: "arrow.uturn.backward")
        undo.addTarget(self, action: #selector(deleteBackward), for: .touchUpInside)
        row.addArrangedSubview(undo)
        undo.widthAnchor.constraint(equalToConstant: 39).isActive = true
        undo.heightAnchor.constraint(equalToConstant: 39).isActive = true

        let mic = makeRoundButton(imageName: "mic.fill")
        mic.addTarget(self, action: #selector(openDictation), for: .touchUpInside)
        row.addArrangedSubview(mic)
        mic.widthAnchor.constraint(equalToConstant: 39).isActive = true
        mic.heightAnchor.constraint(equalToConstant: 39).isActive = true

        return row
    }

    private func addSymbolRows(to root: UIStackView) {
        root.addArrangedSubview(makeEqualRow(keys: [
            ("1", "1"), ("2", "2"), ("3", "3"), ("4", "4"), ("5", "5"),
            ("6", "6"), ("7", "7"), ("8", "8"), ("9", "9"), ("0", "0")
        ]))

        root.addArrangedSubview(makeEqualRow(keys: [
            ("-", "-"), ("/", "/"), (":", ":"), (";", ";"), ("(", "("),
            (")", ")"), ("$", "$"), ("&", "&"), ("@", "@"), ("\"", "\"")
        ]))

        let third = makeRow()
        let more = makeKey(title: "#+=", imageName: nil, style: .special)
        more.addTarget(self, action: #selector(nextKeyboard), for: .touchUpInside)
        third.addArrangedSubview(more)
        more.widthAnchor.constraint(equalToConstant: 54).isActive = true

        for (title, output) in [(".", "."), (",", ","), ("?", "?"), ("!", "!"), ("'", "'")] {
            third.addArrangedSubview(makeCharacterKey(title: title, output: output))
        }

        let delete = makeKey(title: nil, imageName: "delete.left", style: .special)
        delete.addTarget(self, action: #selector(deleteBackward), for: .touchUpInside)
        third.addArrangedSubview(delete)
        delete.widthAnchor.constraint(equalToConstant: 54).isActive = true
        root.addArrangedSubview(third)

        root.addArrangedSubview(makeBottomActionRow())
    }

    private func makeBottomActionRow() -> UIView {
        let row = makeRow(height: 47)

        let left = makeKey(title: "ABC", imageName: nil, style: .special)
        left.addTarget(self, action: #selector(nextKeyboard), for: .touchUpInside)
        row.addArrangedSubview(left)
        left.widthAnchor.constraint(equalToConstant: 86).isActive = true

        let start = makeKey(title: "Start Parayu", imageName: "waveform", style: .brand)
        start.addTarget(self, action: #selector(openDictation), for: .touchUpInside)
        row.addArrangedSubview(start)

        let returnKey = makeKey(title: nil, imageName: "return", style: .special)
        returnKey.addTarget(self, action: #selector(insertReturn), for: .touchUpInside)
        row.addArrangedSubview(returnKey)
        returnKey.widthAnchor.constraint(equalToConstant: 86).isActive = true

        return row
    }

    private func makeGlobeRow() -> UIView {
        let row = UIStackView()
        row.axis = .horizontal
        row.alignment = .center
        row.distribution = .fill
        row.heightAnchor.constraint(equalToConstant: 31).isActive = true

        let globe = UIButton(type: .system)
        globe.setImage(UIImage(systemName: "globe"), for: .normal)
        globe.tintColor = .white
        globe.addTarget(self, action: #selector(nextKeyboard), for: .touchUpInside)
        row.addArrangedSubview(globe)
        globe.widthAnchor.constraint(equalToConstant: 56).isActive = true

        row.addArrangedSubview(UIView())
        return row
    }

    private enum KeyStyle {
        case character
        case special
        case icon
        case brand
    }

    private func makeEqualRow(keys: [(title: String, output: String)]) -> UIStackView {
        let row = makeRow()
        row.distribution = .fillEqually
        for key in keys {
            row.addArrangedSubview(makeCharacterKey(title: key.title, output: key.output))
        }
        return row
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
            case .special, .icon:
                return specialKeyColor
            case .brand:
                return disabledKeyColor
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
            case .special:
                return .systemFont(ofSize: 15, weight: .medium)
            case .icon:
                return .systemFont(ofSize: 15, weight: .medium)
            case .brand:
                return .systemFont(ofSize: 16, weight: .semibold)
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
            if title != nil {
                button.semanticContentAttribute = .forceLeftToRight
                button.imageEdgeInsets = UIEdgeInsets(top: 0, left: -4, bottom: 0, right: 4)
            }
        }

        return button
    }

    private func makeRoundButton(imageName: String) -> UIButton {
        let button = UIButton(type: .system)
        button.backgroundColor = .white
        button.tintColor = .black
        button.layer.cornerRadius = 19.5
        button.layer.cornerCurve = .continuous
        button.setImage(UIImage(systemName: imageName), for: .normal)
        return button
    }

    @objc private func insertCharacter(_ sender: KeyboardKeyButton) {
        guard let output = sender.output else { return }
        textDocumentProxy.insertText(output)
    }

    @objc private func insertReturn() {
        textDocumentProxy.insertText("\n")
    }

    @objc private func deleteBackward() {
        textDocumentProxy.deleteBackward()
    }

    @objc private func openDictation() {
        guard let url = URL(string: "parayu://dictate") else { return }

        let defaults = UserDefaults(suiteName: appGroupId) ?? .standard
        defaults.set("dictate", forKey: pendingActionKey)
        defaults.set(Date().timeIntervalSince1970, forKey: "pendingShortcutActionAt")
        defaults.synchronize()

        showTemporaryStatus("Starting Parayu...")

        if openURLThroughResponderChain(url) {
            return
        }

        guard let extensionContext else {
            showTemporaryStatus("Enable Full Access")
            return
        }

        extensionContext.open(url) { [weak self] opened in
            guard let self else { return }
            if !opened {
                DispatchQueue.main.async {
                    if !self.openURLThroughResponderChain(url) {
                        self.showTemporaryStatus("Enable Full Access")
                    }
                }
            }
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
