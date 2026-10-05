import Cocoa
import Carbon
import AVFoundation
import Speech
import ApplicationServices

// ==============================================================================
// Recall Flow — Native macOS Background Companion
// ==============================================================================
// 1. Ultra-Clean Minimal Apple Intelligence Capsule (Zero Clutter, Pure Glass)
// 2. Real Animated Recall Orb View:
//    - Ambient breathing iridescent glow aura (Blue/Cyan/Violet)
//    - 5-bar live audio-reactive equalizer dancing to voice volume (Exact Web Match)
//    - Continuous 3D rotation + rotating iridescent gradient ring during processing
//    - Emerald bloom and spring-bounce checkmark upon successful insertion
// 3. Auto Paste into Original App (WhatsApp, Gmail, Notes, Browser, Slack):
//    - Remembers exact focused text field and frontmost application
//    - Re-focuses target application and pastes via Direct AX or synthesized Cmd+V
//    - NEVER automatically submits/sends the message (paste/insert only)
//    - Preserves transcribed text on clipboard as guaranteed fallback
// 4. Guaranteed Enter key handling via dynamic Carbon HotKey registration
// 5. Shared Server-Side Gemini Transcription & Cleanup via Next.js backend
// 6. Compact, Apple-Grade Control Window (No clutter, single unified inset card)
// ==============================================================================

// ── 1. SHORTCUT PREFERENCES ──────────────────────────────────────────────────

enum ShortcutOption: Int, CaseIterable {
    case optSpace = 0       // Option + Space (Primary Default)
    case ctrlOptR = 1       // Control + Option + R (Fallback without macOS conflict)
    case ctrlShiftSpace = 2 // Control + Shift + Space (Secondary Fallback)

    var title: String {
        switch self {
        case .optSpace: return "⌥ Space (Option + Space)"
        case .ctrlOptR: return "⌃⌥R (Control + Option + R)"
        case .ctrlShiftSpace: return "⌃⇧Space (Control + Shift + Space)"
        }
    }

    var shortTitle: String {
        switch self {
        case .optSpace: return "⌥Space"
        case .ctrlOptR: return "⌃⌥R"
        case .ctrlShiftSpace: return "⌃⇧Space"
        }
    }

    var keyCode: UInt32 {
        switch self {
        case .optSpace: return 49 // kVK_Space = 49 (0x31)
        case .ctrlOptR: return 15  // kVK_ANSI_R = 15 (0x0F)
        case .ctrlShiftSpace: return 49 // kVK_Space = 49 (0x31)
        }
    }

    var modifiers: UInt32 {
        switch self {
        case .optSpace: return UInt32(optionKey)
        case .ctrlOptR: return UInt32(controlKey | optionKey)
        case .ctrlShiftSpace: return UInt32(controlKey | shiftKey)
        }
    }
}

// ── 2. MAIN APPLICATION CONTROLLER ──────────────────────────────────────────

class RecallFlowCompanion: NSObject, NSApplicationDelegate, NSWindowDelegate {
    static let shared = RecallFlowCompanion()

    // Preferences & State
    var isEnabled: Bool = true {
        didSet {
            UserDefaults.standard.set(isEnabled, forKey: "recall_flow_enabled")
            updateState()
        }
    }

    var selectedShortcut: ShortcutOption = .optSpace {
        didSet {
            UserDefaults.standard.set(selectedShortcut.rawValue, forKey: "recall_flow_shortcut")
            registerGlobalHotKey()
            updateState()
        }
    }

    // Default to false for zero desktop clutter; toggleable via Menu Bar or Settings
    var showDesktopOrb: Bool = false {
        didSet {
            UserDefaults.standard.set(showDesktopOrb, forKey: "recall_flow_show_desktop_orb")
            updateDesktopOrbVisibility()
        }
    }

    private(set) var isListening: Bool = false
    private(set) var hasShortcutConflict: Bool = false

    // Saved field memory: element and app focused when shortcut was pressed
    private var savedFocusedElement: AXUIElement?
    private var savedFrontmostApp: NSRunningApplication?

    // Global Key Monitors
    private var globalKeyMonitor: Any?
    private var localKeyMonitor: Any?

    // Menu Bar & Panels
    private var statusItem: NSStatusItem?
    private var statusMenu: NSMenu?
    private var settingsWindow: NSWindow?
    private var desktopOrbPanel: DesktopOrbPanel?
    private var voiceCapsulePanel: NSPanel?

    // Sleek Uncluttered Capsule Subviews (Single unified label & check icon)
    private var capsuleTextLabel: NSTextField?
    private var capsuleOrbView: OrbView?
    private var capsuleCheckIcon: NSImageView?
    private var capsuleOriginalOrigin: NSPoint = .zero

    // Settings UI Subviews
    private var statusBadgeLabel: NSTextField?
    private var statusBadgeView: NSView?
    private var enableToggleSwitch: NSSwitch?
    private var shortcutSegmentControl: NSSegmentedControl?
    private var desktopOrbToggleSwitch: NSSwitch?
    private var permissionsStatusLabel: NSTextField?
    private var permissionsActionButton: NSButton?
    private var permissionsDotsLabel: NSTextField?
    private var permissionsPollTimer: Timer?

    // Audio Engine & Speech Pipeline
    private var audioEngine: AVAudioEngine?
    private var audioFile: AVAudioFile?
    private var recordingURL: URL?
    private var speechRecognizer: SFSpeechRecognizer?
    private var speechRecognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var speechRecognitionTask: SFSpeechRecognitionTask?
    private var liveTranscriptText: String = ""

    // Audio Monitoring & Silence Timers
    private var silenceTimer: Timer?
    private var autoCloseTimer: Timer?
    private var recordingStartTime: Date?
    private var hasSpoken: Bool = false
    private var maxVolumeSeen: Float = 0.0
    private var hasWarnedNoAudio: Bool = false

    // Shared Server Endpoint (Next.js backend)
    private let serverURL = URL(string: "http://localhost:3001/api/ai/flow")!

    // Carbon HotKey References
    private var hotKeyRef: EventHotKeyRef?
    private var returnHotKeyRef: EventHotKeyRef?
    private var escapeHotKeyRef: EventHotKeyRef?

    // ── LIFECYCLE ──

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Run as an accessory background process (no Dock icon, silent background app)
        NSApp.setActivationPolicy(.accessory)

        // Load saved preferences
        if UserDefaults.standard.object(forKey: "recall_flow_enabled") != nil {
            isEnabled = UserDefaults.standard.bool(forKey: "recall_flow_enabled")
        } else {
            isEnabled = true
        }

        let savedShortcutIndex = UserDefaults.standard.integer(forKey: "recall_flow_shortcut")
        selectedShortcut = ShortcutOption(rawValue: savedShortcutIndex) ?? .optSpace

        if UserDefaults.standard.object(forKey: "recall_flow_show_desktop_orb") != nil {
            showDesktopOrb = UserDefaults.standard.bool(forKey: "recall_flow_show_desktop_orb")
        } else {
            showDesktopOrb = false
        }

        // Initialize Speech Recognizer
        speechRecognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US")) ?? SFSpeechRecognizer()

        // Setup Menu Bar Status Item
        setupStatusItem()

        // Setup Floating Draggable Desktop Orb
        setupDesktopOrb()

        // Setup Glass Voice Capsule (appears ONLY when listening/transcribing)
        setupVoiceCapsule()

        // Register Global Carbon Event Handler & HotKey (Option + Space)
        installCarbonEventHandler()
        registerGlobalHotKey()

        print("✨ Recall Flow macOS Background Service Active")
        print("⌨️ Global Shortcut: \(selectedShortcut.title)")
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        showSettingsWindow()
        return true
    }

    // ── 3. MENU BAR UI ──────────────────────────────────────────────────────

    private func setupStatusItem() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        updateStatusItemIcon()
        rebuildStatusMenu()
    }

    private func updateStatusItemIcon() {
        guard let button = statusItem?.button else { return }

        let size = NSSize(width: 18, height: 18)
        let image = NSImage(size: size, flipped: false) { rect in
            let circleRect = rect.insetBy(dx: 2.0, dy: 2.0)
            let path = NSBezierPath(ovalIn: circleRect)

            if !self.isEnabled {
                NSColor.secondaryLabelColor.withAlphaComponent(0.4).setStroke()
                path.lineWidth = 1.6
                path.stroke()

                let dotRect = rect.insetBy(dx: 6.5, dy: 6.5)
                let dot = NSBezierPath(ovalIn: dotRect)
                NSColor.secondaryLabelColor.withAlphaComponent(0.5).setFill()
                dot.fill()
            } else if self.isListening {
                let blue = NSColor(calibratedRed: 0.0, green: 0.32, blue: 1.0, alpha: 1.0)
                blue.setFill()
                path.fill()

                let ring = NSBezierPath(ovalIn: rect.insetBy(dx: 0.5, dy: 0.5))
                blue.withAlphaComponent(0.4).setStroke()
                ring.lineWidth = 1.5
                ring.stroke()
            } else {
                let gradient = NSGradient(colors: [
                    NSColor(calibratedRed: 0.0, green: 0.32, blue: 1.0, alpha: 1.0),  // #0052FF
                    NSColor(calibratedRed: 0.47, green: 0.16, blue: 0.79, alpha: 1.0), // #7928CA
                    NSColor(calibratedRed: 0.0, green: 0.82, blue: 1.0, alpha: 1.0)   // #00D2FF
                ])
                gradient?.draw(in: path, angle: 45)

                let inner = NSBezierPath(ovalIn: rect.insetBy(dx: 5.5, dy: 5.5))
                NSColor.white.withAlphaComponent(0.9).setFill()
                inner.fill()
            }
            return true
        }

        image.isTemplate = false
        button.image = image
        button.toolTip = "Recall Flow (\(selectedShortcut.shortTitle))"
    }

    private func rebuildStatusMenu() {
        let menu = NSMenu()

        // 1. Status Indicator
        let statusString = !isEnabled
            ? "○ Recall Flow: Disabled"
            : (isListening ? "● Recall Flow: Listening…" : "● Recall Flow: Active")
        let statusMenuItem = NSMenuItem(title: statusString, action: nil, keyEquivalent: "")
        statusMenuItem.isEnabled = false
        menu.addItem(statusMenuItem)

        // 2. Shortcut Display & Conflict Warning
        let scTitle = hasShortcutConflict
            ? "Shortcut: \(selectedShortcut.shortTitle) ⚠️ (Conflict)"
            : "Shortcut: \(selectedShortcut.shortTitle)"
        let shortcutMenuItem = NSMenuItem(title: scTitle, action: #selector(openSettingsAction), keyEquivalent: "")
        shortcutMenuItem.target = self
        menu.addItem(shortcutMenuItem)

        menu.addItem(NSMenuItem.separator())

        // 3. Enable / Disable Toggle
        let toggleTitle = isEnabled ? "Disable Recall Flow" : "Enable Recall Flow"
        let toggleMenuItem = NSMenuItem(title: toggleTitle, action: #selector(toggleEnableAction), keyEquivalent: "")
        toggleMenuItem.target = self
        menu.addItem(toggleMenuItem)

        // 4. Show Floating Desktop Orb Toggle
        let orbToggleItem = NSMenuItem(title: "Floating Desktop Orb", action: #selector(toggleDesktopOrbAction), keyEquivalent: "")
        orbToggleItem.state = showDesktopOrb ? .on : .off
        orbToggleItem.target = self
        menu.addItem(orbToggleItem)

        menu.addItem(NSMenuItem.separator())

        // 5. Settings Window
        let settingsMenuItem = NSMenuItem(title: "Settings…", action: #selector(openSettingsAction), keyEquivalent: ",")
        settingsMenuItem.target = self
        menu.addItem(settingsMenuItem)

        // 6. Open Recall Web App
        let webMenuItem = NSMenuItem(title: "Open Recall Web App ↗", action: #selector(openRecallWebApp), keyEquivalent: "")
        webMenuItem.target = self
        menu.addItem(webMenuItem)

        menu.addItem(NSMenuItem.separator())

        // 7. Quit
        let quitMenuItem = NSMenuItem(title: "Quit Recall Flow", action: #selector(quitApp), keyEquivalent: "q")
        quitMenuItem.target = self
        menu.addItem(quitMenuItem)

        self.statusMenu = menu
        statusItem?.menu = menu
    }

    @objc func toggleEnableAction() {
        isEnabled.toggle()
    }

    @objc func toggleDesktopOrbAction() {
        showDesktopOrb.toggle()
        rebuildStatusMenu()
    }

    @objc func openSettingsAction() {
        showSettingsWindow()
    }

    // ── 4. GLOBAL HOTKEY ENGINE & EVENT MONITORING ──────────────────────────

    private func installCarbonEventHandler() {
        var eventType = EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyPressed))
        InstallEventHandler(
            GetApplicationEventTarget(),
            { (_, inEvent, _) -> OSStatus in
                var hotKeyID = EventHotKeyID()
                let status = GetEventParameter(
                    inEvent,
                    EventParamName(kEventParamDirectObject),
                    EventParamType(typeEventHotKeyID),
                    nil,
                    MemoryLayout<EventHotKeyID>.size,
                    nil,
                    &hotKeyID
                )
                guard status == noErr else { return noErr }

                DispatchQueue.main.async {
                    if hotKeyID.id == 1 {
                        RecallFlowCompanion.shared.handleGlobalHotKeyTrigger()
                    } else if hotKeyID.id == 2 {
                        RecallFlowCompanion.shared.handleEnterPressed()
                    } else if hotKeyID.id == 3 {
                        RecallFlowCompanion.shared.cancelFlow()
                    }
                }
                return noErr
            },
            1,
            &eventType,
            nil,
            nil
        )
    }

    private func registerGlobalHotKey() {
        unregisterGlobalHotKey()
        guard isEnabled else {
            hasShortcutConflict = false
            rebuildStatusMenu()
            return
        }

        let hotKeyID = EventHotKeyID(signature: OSType(0x52464C57), id: 1) // 'RFLW', 1
        let status = RegisterEventHotKey(
            selectedShortcut.keyCode,
            selectedShortcut.modifiers,
            hotKeyID,
            GetApplicationEventTarget(),
            0,
            &hotKeyRef
        )

        if status == noErr {
            hasShortcutConflict = false
            print("✅ Global shortcut \(selectedShortcut.title) registered successfully")
        } else {
            hasShortcutConflict = true
            print("⚠️ Shortcut conflict detected for \(selectedShortcut.title) (error \(status)). Select alternate in Settings.")
        }

        rebuildStatusMenu()
    }

    private func unregisterGlobalHotKey() {
        if let ref = hotKeyRef {
            UnregisterEventHotKey(ref)
            hotKeyRef = nil
        }
    }

    // Dynamic Carbon registration for Enter & Escape while listening: GUARANTEED to catch Return
    private func registerListeningHotKeys() {
        unregisterListeningHotKeys()

        // 36 = kVK_Return (Enter)
        let returnID = EventHotKeyID(signature: OSType(0x52464C57), id: 2)
        RegisterEventHotKey(36, 0, returnID, GetApplicationEventTarget(), 0, &returnHotKeyRef)

        // 53 = kVK_Escape (Escape)
        let escapeID = EventHotKeyID(signature: OSType(0x52464C57), id: 3)
        RegisterEventHotKey(53, 0, escapeID, GetApplicationEventTarget(), 0, &escapeHotKeyRef)
    }

    private func unregisterListeningHotKeys() {
        if let ref = returnHotKeyRef {
            UnregisterEventHotKey(ref)
            returnHotKeyRef = nil
        }
        if let ref = escapeHotKeyRef {
            UnregisterEventHotKey(ref)
            escapeHotKeyRef = nil
        }
    }

    func handleGlobalHotKeyTrigger() {
        guard isEnabled else { return }

        if isListening {
            finalizeSpeechAndProcess()
        } else {
            startFlow()
        }
    }

    func handleEnterPressed() {
        guard isListening else { return }
        finalizeSpeechAndProcess()
    }

    // ── 5. FOCUSED ELEMENT MEMORY & VOICE ACTIVATION ────────────────────────

    private func captureFocusedElement() {
        savedFrontmostApp = NSWorkspace.shared.frontmostApplication

        let systemWide = AXUIElementCreateSystemWide()
        var focusedAppElement: AnyObject?
        let result = AXUIElementCopyAttributeValue(systemWide, kAXFocusedUIElementAttribute as CFString, &focusedAppElement)

        if result == .success, let element = focusedAppElement {
            savedFocusedElement = (element as! AXUIElement)
            print("🎯 Captured focused UI element in \(savedFrontmostApp?.localizedName ?? "app")")
        } else {
            savedFocusedElement = nil
            print("ℹ️ Standard app focus captured: \(savedFrontmostApp?.localizedName ?? "app")")
        }
    }

    private func startFlow() {
        guard isEnabled else { return }

        // 1. Immediately remember the exact focused text field and frontmost application!
        captureFocusedElement()

        isListening = true
        hasSpoken = false
        maxVolumeSeen = 0.0
        hasWarnedNoAudio = false
        liveTranscriptText = ""
        recordingStartTime = Date()
        updateState()

        // 2. Position the voice capsule smoothly near bottom center
        positionVoiceCapsule()

        // Reset capsule visuals: Single, clean, elegant line of text
        updateCapsuleLayout(hasCheckmark: false)
        capsuleCheckIcon?.isHidden = true
        updateCapsuleText("Listening…", color: NSColor(calibratedRed: 0.0, green: 0.32, blue: 1.0, alpha: 1.0))
        capsuleOrbView?.setListeningVolume(0.0)

        // 3. Show capsule with smooth macOS spring-slide animation WITHOUT stealing focus!
        guard let panel = voiceCapsulePanel else { return }
        capsuleOriginalOrigin = panel.frame.origin
        panel.setFrameOrigin(NSPoint(x: capsuleOriginalOrigin.x, y: capsuleOriginalOrigin.y - 10))
        panel.alphaValue = 0.0
        panel.orderFrontRegardless()

        NSAnimationContext.runAnimationGroup { context in
            context.duration = 0.24
            context.timingFunction = CAMediaTimingFunction(controlPoints: 0.16, 1.0, 0.3, 1.0)
            panel.animator().alphaValue = 1.0
            panel.animator().setFrameOrigin(self.capsuleOriginalOrigin)
        }

        // 4. Install dynamic Carbon hotkeys for Return and Escape (ALWAYS works)
        registerListeningHotKeys()

        // 5. Also install global and local NSEvent monitors as fallback defense-in-depth
        startMonitoringKeys()

        // 6. Start audio capture and live speech recognition
        startAudioCapture()
    }

    private func startMonitoringKeys() {
        stopMonitoringKeys()

        // Global monitor (other apps active)
        globalKeyMonitor = NSEvent.addGlobalMonitorForEvents(matching: .keyDown) { [weak self] event in
            guard let self = self, self.isListening else { return }
            if event.keyCode == 36 { // Return
                DispatchQueue.main.async { self.handleEnterPressed() }
            } else if event.keyCode == 53 { // Escape
                DispatchQueue.main.async { self.cancelFlow() }
            }
        }

        // Local monitor (capsule panel active)
        localKeyMonitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
            guard let self = self, self.isListening else { return event }
            if event.keyCode == 36 {
                DispatchQueue.main.async { self.handleEnterPressed() }
                return nil
            } else if event.keyCode == 53 {
                DispatchQueue.main.async { self.cancelFlow() }
                return nil
            }
            return event
        }
    }

    private func stopMonitoringKeys() {
        if let m = globalKeyMonitor {
            NSEvent.removeMonitor(m)
            globalKeyMonitor = nil
        }
        if let m = localKeyMonitor {
            NSEvent.removeMonitor(m)
            localKeyMonitor = nil
        }
        unregisterListeningHotKeys()
    }

    // ── 6. REAL-TIME AUDIO CAPTURE & LIVE SPEECH ENGINE ─────────────────────

    private func startAudioCapture() {
        cleanupAudio()

        // Preflight Microphone Authorization Check
        let micStatus = AVCaptureDevice.authorizationStatus(for: .audio)
        if micStatus != .authorized {
            if micStatus == .notDetermined {
                AVCaptureDevice.requestAccess(for: .audio) { [weak self] granted in
                    DispatchQueue.main.async {
                        if granted {
                            self?.startAudioCapture()
                        } else {
                            self?.showMicPermissionNeeded()
                        }
                    }
                }
                return
            } else {
                showMicPermissionNeeded()
                return
            }
        }

        let engine = AVAudioEngine()
        self.audioEngine = engine

        let inputNode = engine.inputNode
        let format = inputNode.outputFormat(forBus: 0)

        // Temp file for high-fidelity audio submission
        let tempDir = FileManager.default.temporaryDirectory
        let fileURL = tempDir.appendingPathComponent("recall_flow_\(Int(Date().timeIntervalSince1970)).wav")
        self.recordingURL = fileURL

        do {
            self.audioFile = try AVAudioFile(forWriting: fileURL, settings: format.settings)
        } catch {
            print("⚠️ Failed to create AVAudioFile: \(error)")
        }

        // Setup real-time live speech recognition request
        if SFSpeechRecognizer.authorizationStatus() == .notDetermined {
            SFSpeechRecognizer.requestAuthorization { _ in }
        }

        if speechRecognizer?.isAvailable == true {
            let request = SFSpeechAudioBufferRecognitionRequest()
            request.shouldReportPartialResults = true
            self.speechRecognitionRequest = request

            self.speechRecognitionTask = speechRecognizer?.recognitionTask(with: request) { [weak self] result, error in
                guard let self = self, self.isListening else { return }
                if let result = result {
                    let formatted = result.bestTranscription.formattedString
                    DispatchQueue.main.async {
                        if !formatted.isEmpty {
                            self.liveTranscriptText = formatted
                            // Clean live words smoothly replacing "Listening…"
                            self.updateCapsuleText(formatted, color: NSColor(calibratedWhite: 0.12, alpha: 1.0))
                            self.hasSpoken = true
                            self.resetSilenceTimer()
                        }
                    }
                }
            }
        }

        // Install Audio Tap on Input Node
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, when in
            guard let self = self, self.isListening else { return }

            // 1. Write buffer to WAV file for Gemini transcription
            try? self.audioFile?.write(from: buffer)

            // 2. Stream to Speech Recognizer for real-time live words
            self.speechRecognitionRequest?.append(buffer)

            // 3. Compute live RMS audio power for orb breathing & silence detection
            guard let channelData = buffer.floatChannelData?[0] else { return }
            let frameCount = Int(buffer.frameLength)
            guard frameCount > 0 else { return }

            var sum: Float = 0.0
            for i in 0..<frameCount {
                let sample = channelData[i]
                sum += sample * sample
            }
            let rms = sqrt(sum / Float(frameCount))
            let db = 20.0 * log10(max(rms, 0.00001))

            // Normalize dB (-50 dB -> 0.0, -5 dB -> 1.0)
            let normalizedVolume = max(0.0, min(1.0, (db + 50.0) / 45.0))

            DispatchQueue.main.async {
                guard self.isListening else { return }

                if normalizedVolume > self.maxVolumeSeen {
                    self.maxVolumeSeen = normalizedVolume
                }

                // Update real Recall orb waveform & breathing amplitude with live voice
                self.capsuleOrbView?.setListeningVolume(normalizedVolume)

                // Detect user speech
                if normalizedVolume > 0.10 {
                    self.hasSpoken = true
                    if self.hasWarnedNoAudio {
                        self.updateCapsuleText("Listening…", color: NSColor(calibratedRed: 0.0, green: 0.32, blue: 1.0, alpha: 1.0))
                        self.hasWarnedNoAudio = false
                    }
                    self.resetSilenceTimer()
                }

                // Detect silent microphone (no audio received after 2.5s)
                if !self.hasSpoken && !self.hasWarnedNoAudio,
                   let start = self.recordingStartTime,
                   Date().timeIntervalSince(start) > 2.5 {
                    if self.maxVolumeSeen < 0.05 {
                        self.hasWarnedNoAudio = true
                        self.updateCapsuleText("Microphone not receiving audio", color: NSColor(calibratedRed: 0.9, green: 0.45, blue: 0.0, alpha: 1.0))
                    }
                }
            }
        }

        do {
            try engine.start()
        } catch {
            print("⚠️ Failed to start AVAudioEngine: \(error)")
            showMicPermissionNeeded()
        }
    }

    private func showMicPermissionNeeded() {
        updateCapsuleText("Microphone access required", color: NSColor(calibratedRed: 0.9, green: 0.45, blue: 0.0, alpha: 1.0))
        scheduleAutoClose(3.5)
    }

    private func resetSilenceTimer() {
        silenceTimer?.invalidate()
        guard hasSpoken else { return }

        // Automatic silence detection: 1.3s of pause after speaking auto-finalizes
        silenceTimer = Timer.scheduledTimer(withTimeInterval: 1.3, repeats: false) { [weak self] _ in
            guard let self = self, self.isListening else { return }
            self.finalizeSpeechAndProcess()
        }
    }

    private func finalizeSpeechAndProcess() {
        silenceTimer?.invalidate()
        stopMonitoringKeys()

        // Stop Audio Engine & Finalize WAV file
        if let engine = audioEngine {
            if engine.isRunning {
                engine.stop()
            }
            engine.inputNode.removeTap(onBus: 0)
        }
        audioEngine = nil
        audioFile = nil

        // Finalize speech recognition request
        speechRecognitionRequest?.endAudio()
        speechRecognitionRequest = nil
        speechRecognitionTask?.cancel()
        speechRecognitionTask = nil

        // Verify audio file or live transcript
        var base64Audio: String? = nil
        if let url = recordingURL, FileManager.default.fileExists(atPath: url.path) {
            if let audioData = try? Data(contentsOf: url), audioData.count > 1000 {
                base64Audio = audioData.base64EncodedString()
            }
        }

        let fallbackTranscript = liveTranscriptText.trimmingCharacters(in: .whitespacesAndNewlines)

        guard base64Audio != nil || !fallbackTranscript.isEmpty else {
            showCapsuleNotice("No speech detected")
            scheduleAutoClose(1.8)
            return
        }

        // Visual State 2: Processing (Iridescent rotating ring + 3D continuous rotation)
        capsuleOrbView?.setProcessing()
        updateCapsuleLayout(hasCheckmark: false)
        updateCapsuleText("Understanding…", color: NSColor(calibratedWhite: 0.15, alpha: 1.0))

        // Route through shared server-side transcription and rephrasing service
        sendAudioToServer(base64Audio: base64Audio, fallbackTranscript: fallbackTranscript)
    }

    private func sendAudioToServer(base64Audio: String?, fallbackTranscript: String) {
        var req = URLRequest(url: serverURL)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")

        var body: [String: Any] = [
            "context": [
                "activeApplication": savedFrontmostApp?.localizedName ?? "macOS"
            ]
        ]
        if let audio = base64Audio {
            body["audioBase64"] = audio
            body["mimeType"] = "audio/wav"
        }
        if !fallbackTranscript.isEmpty {
            body["transcript"] = fallbackTranscript
        }

        req.httpBody = try? JSONSerialization.data(withJSONObject: body)

        // Visual State 3: Rephrasing (Flowing gradient motion)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
            if self.isListening {
                self.capsuleOrbView?.setProcessing()
                self.updateCapsuleText("Cleaning message…", color: NSColor(calibratedRed: 0.47, green: 0.16, blue: 0.79, alpha: 1.0))
            }
        }

        URLSession.shared.dataTask(with: req) { [weak self] data, _, error in
            guard let self = self else { return }

            guard let data = data,
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let success = json["success"] as? Bool, success else {
                DispatchQueue.main.async {
                    // Fallback to live transcript if available
                    if !fallbackTranscript.isEmpty {
                        self.handleSuccessfulTranscription(cleanText: fallbackTranscript)
                    } else {
                        self.showCapsuleNotice("Please speak again")
                        self.scheduleAutoClose(2.0)
                    }
                }
                return
            }

            let intent = json["intent"] as? String ?? "write"

            DispatchQueue.main.async {
                // ── MODE A: WRITE (Clean text inserted into active field) ──
                if intent == "write" {
                    let cleanText = (json["rewrittenText"] as? String) ?? fallbackTranscript
                    self.handleSuccessfulTranscription(cleanText: cleanText)
                    return
                }

                // ── MODE B: ACTION (Calendar / WhatsApp) ──
                if intent == "action" {
                    let actionResult = json["actionResult"] as? [String: Any]
                    let headline = (actionResult?["headline"] as? String ?? "Done").replacingOccurrences(of: " ✓", with: "")

                    self.showCapsuleSuccess(text: headline)
                    self.scheduleAutoClose(1.8)
                    return
                }

                // ── MODE C: ASK (Concise answer) ──
                if intent == "ask", let answer = json["assistantResponse"] as? String {
                    self.showCapsuleSuccess(text: answer)
                    self.scheduleAutoClose(3.5)
                    return
                }
            }
        }.resume()
    }

    private func handleSuccessfulTranscription(cleanText: String) {
        guard !cleanText.isEmpty else {
            showCapsuleNotice("Please speak again")
            scheduleAutoClose(2.0)
            return
        }

        // 1. ALWAYS copy to clipboard immediately so the user NEVER loses their transcription!
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(cleanText, forType: .string)

        // 2. Check Accessibility permission for direct field typing
        let isAX = AXIsProcessTrusted()

        if !isAX {
            print("ℹ️ Accessibility permission missing — preserved transcript on clipboard")
            self.showCapsuleCopied()
            self.scheduleAutoClose(2.4)
            return
        }

        // 3. Accessibility granted — insert directly into the active field!
        self.insertTextIntoTargetField(cleanText)
        self.showCapsuleSuccess(text: "Inserted")
        self.scheduleAutoClose(1.3)
    }

    // ── 7. TEXT INSERTION INTO EXACT TARGET FIELD ────────────────────────────

    private func insertTextIntoTargetField(_ text: String) {
        guard let app = savedFrontmostApp else {
            print("⚠️ No saved frontmost app, text remains safely on clipboard")
            return
        }

        // 1. Reactivate the saved frontmost application (WhatsApp, Notes, Chrome, etc.)
        app.activate()
        let pid = app.processIdentifier

        // 2. Direct Accessibility API Text Insertion (works in Notes, TextEdit, Cocoa native fields)
        var didAXInsert = false
        if let element = savedFocusedElement {
            // Restore focus to saved UI element
            AXUIElementSetAttributeValue(element, kAXFocusedAttribute as CFString, kCFBooleanTrue)
            let err = AXUIElementSetAttributeValue(element, kAXSelectedTextAttribute as CFString, text as CFTypeRef)
            if err == .success {
                didAXInsert = true
                print("⚡️ Direct Accessibility insertion succeeded into \(app.localizedName ?? "app")!")
            }
        }

        // 3. Robust Keystroke Synthesis for WhatsApp, Gmail, Chrome, Safari, Slack, Notes
        // NOTE: ONLY pastes the text — NEVER automatically sends the message!
        if !didAXInsert {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) {
                // Ensure target application is active right before typing
                self.savedFrontmostApp?.activate()

                let src = CGEventSource(stateID: .combinedSessionState)
                // 0x09 is kVK_ANSI_V ('v')
                guard let vKeyDown = CGEvent(keyboardEventSource: src, virtualKey: 0x09, keyDown: true),
                      let vKeyUp = CGEvent(keyboardEventSource: src, virtualKey: 0x09, keyDown: false) else { return }

                vKeyDown.flags = .maskCommand
                vKeyUp.flags = .maskCommand

                // Post key down to system event tap and directly to target PID
                vKeyDown.post(tap: .cghidEventTap)
                vKeyDown.postToPid(pid)

                // 25ms pause: CRITICAL for Chromium/Electron message loops (WhatsApp, Slack, Chrome) to register Cmd+V
                usleep(25000)

                // Post key up to system event tap and directly to target PID
                vKeyUp.post(tap: .cghidEventTap)
                vKeyUp.postToPid(pid)

                print("📋 Synthesized Cmd+V paste into \(self.savedFrontmostApp?.localizedName ?? "app") (PID: \(pid))")
            }
        }
    }

    private func updateCapsuleLayout(hasCheckmark: Bool) {
        if hasCheckmark {
            capsuleCheckIcon?.isHidden = false
            capsuleTextLabel?.frame = NSRect(x: 66, y: 12, width: 222, height: 20)
        } else {
            capsuleCheckIcon?.isHidden = true
            capsuleTextLabel?.frame = NSRect(x: 44, y: 12, width: 244, height: 20)
        }
    }

    private func updateCapsuleText(_ text: String, color: NSColor? = nil) {
        guard let label = capsuleTextLabel else { return }
        if label.stringValue == text && (color == nil || label.textColor == color) { return }

        let transition = CATransition()
        transition.duration = 0.12
        transition.type = .fade
        transition.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
        label.layer?.add(transition, forKey: "textFade")

        if let color = color { label.textColor = color }
        label.stringValue = text
    }

    private func showCapsuleSuccess(text: String) {
        capsuleOrbView?.setSuccess()
        updateCapsuleLayout(hasCheckmark: true)
        updateCapsuleText(text, color: NSColor(calibratedRed: 0.05, green: 0.65, blue: 0.35, alpha: 1.0)) // Emerald #059669

        // Spring bounce animation on checkmark icon
        let bounce = CAKeyframeAnimation(keyPath: "transform.scale")
        bounce.values = [0.4, 1.25, 1.0]
        bounce.keyTimes = [0.0, 0.65, 1.0]
        bounce.duration = 0.3
        bounce.timingFunction = CAMediaTimingFunction(name: .easeOut)
        capsuleCheckIcon?.layer?.add(bounce, forKey: "bounce")
    }

    private func showCapsuleCopied() {
        capsuleOrbView?.setSuccess()
        updateCapsuleLayout(hasCheckmark: true)
        updateCapsuleText("Copied to clipboard", color: NSColor(calibratedRed: 0.0, green: 0.45, blue: 0.9, alpha: 1.0))

        let bounce = CAKeyframeAnimation(keyPath: "transform.scale")
        bounce.values = [0.4, 1.25, 1.0]
        bounce.keyTimes = [0.0, 0.65, 1.0]
        bounce.duration = 0.3
        bounce.timingFunction = CAMediaTimingFunction(name: .easeOut)
        capsuleCheckIcon?.layer?.add(bounce, forKey: "bounce")
    }

    private func showCapsuleNotice(_ msg: String) {
        capsuleOrbView?.stopAnimation()
        updateCapsuleLayout(hasCheckmark: false)
        updateCapsuleText(msg, color: NSColor(calibratedWhite: 0.35, alpha: 1.0))
    }

    private func scheduleAutoClose(_ seconds: Double) {
        autoCloseTimer?.invalidate()
        autoCloseTimer = Timer.scheduledTimer(withTimeInterval: seconds, repeats: false) { [weak self] _ in
            self?.cancelFlow()
        }
    }

    @objc func cancelFlow() {
        isListening = false
        silenceTimer?.invalidate()
        autoCloseTimer?.invalidate()
        stopMonitoringKeys()
        cleanupAudio()
        updateState()

        guard let panel = voiceCapsulePanel else { return }
        NSAnimationContext.runAnimationGroup({ context in
            context.duration = 0.18
            context.timingFunction = CAMediaTimingFunction(name: .easeIn)
            self.capsuleOrbView?.stopAnimation()
            panel.animator().alphaValue = 0.0
            panel.animator().setFrameOrigin(NSPoint(x: self.capsuleOriginalOrigin.x, y: self.capsuleOriginalOrigin.y - 6))
        }, completionHandler: {
            panel.orderOut(nil)
            panel.setFrameOrigin(self.capsuleOriginalOrigin)
        })

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.20) {
            if !self.isListening {
                panel.orderOut(nil)
                panel.setFrameOrigin(self.capsuleOriginalOrigin)
            }
        }
    }

    private func cleanupAudio() {
        if let engine = audioEngine {
            if engine.isRunning { engine.stop() }
            engine.inputNode.removeTap(onBus: 0)
        }
        audioEngine = nil
        audioFile = nil

        speechRecognitionRequest?.endAudio()
        speechRecognitionRequest = nil
        speechRecognitionTask?.cancel()
        speechRecognitionTask = nil

        if let url = recordingURL {
            try? FileManager.default.removeItem(at: url)
            recordingURL = nil
        }
    }

    // ── 8. APPLE-LEVEL CLEAN WHITE GLASS CAPSULE PANEL (COMPACT PILL) ───────

    private func setupVoiceCapsule() {
        let width: CGFloat = 300
        let height: CGFloat = 44

        let panel = NSPanel(
            contentRect: NSRect(x: 100, y: 100, width: width, height: height),
            styleMask: [.nonactivatingPanel, .borderless],
            backing: .buffered,
            defer: false
        )

        panel.level = .floating
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.hasShadow = true
        panel.isMovableByWindowBackground = true
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]

        // Apple Light Frosted Glass Background (Luminous white/off-white matching website)
        let glass = NSVisualEffectView(frame: panel.contentView!.bounds)
        glass.autoresizingMask = [.width, .height]
        glass.material = .popover
        glass.blendingMode = .behindWindow
        glass.state = .active
        glass.wantsLayer = true
        glass.layer?.cornerRadius = 22
        glass.layer?.masksToBounds = true
        glass.layer?.backgroundColor = NSColor(calibratedWhite: 0.985, alpha: 0.95).cgColor
        glass.layer?.borderColor = NSColor(calibratedWhite: 0.0, alpha: 0.06).cgColor
        glass.layer?.borderWidth = 1.0

        // Real 3D Recall Orb on Left (Centered vertically: y = 6 in 44px height)
        let orb = OrbView(frame: NSRect(x: 6, y: 6, width: 32, height: 32))
        glass.addSubview(orb)
        self.capsuleOrbView = orb

        // Clean Emerald Checkmark Icon (Hidden until success)
        let checkIcon = NSImageView(frame: NSRect(x: 44, y: 14, width: 16, height: 16))
        checkIcon.image = makeCheckmarkImage()
        checkIcon.wantsLayer = true
        checkIcon.isHidden = true
        glass.addSubview(checkIcon)
        self.capsuleCheckIcon = checkIcon

        // Single Unified Fluid Text Label (Vertically centered at y = 12)
        let label = NSTextField(frame: NSRect(x: 44, y: 12, width: 244, height: 20))
        label.isEditable = false
        label.isBordered = false
        label.backgroundColor = .clear
        label.font = NSFont.systemFont(ofSize: 13, weight: .medium)
        label.textColor = NSColor(calibratedRed: 0.0, green: 0.32, blue: 1.0, alpha: 1.0)
        label.stringValue = "Listening…"
        label.cell?.lineBreakMode = .byTruncatingTail
        glass.addSubview(label)
        self.capsuleTextLabel = label

        panel.contentView = glass
        self.voiceCapsulePanel = panel
    }

    private func positionVoiceCapsule() {
        guard let panel = voiceCapsulePanel else { return }
        let screenRect = NSScreen.main?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1440, height: 900)
        let x = screenRect.midX - (panel.frame.width / 2)
        let y = screenRect.minY + 44
        panel.setFrameOrigin(NSPoint(x: x, y: y))
    }

    private func makeCheckmarkImage() -> NSImage {
        let size = NSSize(width: 16, height: 16)
        let image = NSImage(size: size, flipped: false) { rect in
            let path = NSBezierPath()
            path.move(to: NSPoint(x: 3.0, y: 8.0))
            path.line(to: NSPoint(x: 6.5, y: 4.0))
            path.line(to: NSPoint(x: 13.0, y: 12.0))
            path.lineWidth = 2.2
            path.lineCapStyle = .round
            path.lineJoinStyle = .round
            NSColor(calibratedRed: 0.05, green: 0.65, blue: 0.35, alpha: 1.0).setStroke()
            path.stroke()
            return true
        }
        return image
    }

    // ── 9. FLOATING DRAGGABLE DESKTOP ORB ───────────────────────────────────

    private func setupDesktopOrb() {
        desktopOrbPanel = DesktopOrbPanel()
        updateDesktopOrbVisibility()
    }

    private func updateDesktopOrbVisibility() {
        if isEnabled && showDesktopOrb {
            desktopOrbPanel?.orderFront(nil)
        } else {
            desktopOrbPanel?.orderOut(nil)
        }
    }

    // ── 10. UNIFIED COMPACT APPLE GLASS SETTINGS & CONTROL WINDOW ───────────

    func showSettingsWindow() {
        if settingsWindow == nil {
            buildSettingsWindow()
        }

        guard let window = settingsWindow else { return }
        window.center()
        window.makeKeyAndOrderFront(nil)
        window.orderFrontRegardless()
        NSApp.activate(ignoringOtherApps: true)
        refreshPermissions()
        startPermissionsPolling()
    }

    private func buildSettingsWindow() {
        let width: CGFloat = 308
        let height: CGFloat = 352

        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: width, height: height),
            styleMask: [.titled, .closable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )

        window.title = "Recall Flow"
        window.titlebarAppearsTransparent = true
        window.titleVisibility = .hidden
        window.isMovableByWindowBackground = true
        window.backgroundColor = .clear
        window.hasShadow = true
        window.isReleasedWhenClosed = false
        window.delegate = self

        let visualEffect = NSVisualEffectView(frame: window.contentView!.bounds)
        visualEffect.autoresizingMask = [.width, .height]
        visualEffect.material = .popover
        visualEffect.blendingMode = .behindWindow
        visualEffect.state = .active
        visualEffect.wantsLayer = true
        visualEffect.layer?.cornerRadius = 18
        visualEffect.layer?.masksToBounds = true
        visualEffect.layer?.backgroundColor = NSColor(calibratedWhite: 0.985, alpha: 0.96).cgColor
        visualEffect.layer?.borderColor = NSColor(calibratedWhite: 0.0, alpha: 0.07).cgColor
        visualEffect.layer?.borderWidth = 1.0

        buildSettingsContents(inside: visualEffect)

        window.contentView = visualEffect
        self.settingsWindow = window
    }

    private func buildSettingsContents(inside container: NSView) {
        let width: CGFloat = 308

        // Top Header: Animated Recall Orb + Title + Subtitle + Master Switch
        let orb = OrbView(frame: NSRect(x: 18, y: 298, width: 34, height: 34))
        container.addSubview(orb)

        let titleLabel = NSTextField(frame: NSRect(x: 60, y: 313, width: 140, height: 20))
        titleLabel.isEditable = false
        titleLabel.isBordered = false
        titleLabel.backgroundColor = .clear
        titleLabel.font = NSFont.systemFont(ofSize: 15, weight: .bold)
        titleLabel.textColor = NSColor(calibratedWhite: 0.1, alpha: 1.0)
        titleLabel.stringValue = "Recall Flow"
        container.addSubview(titleLabel)

        let subtitleLabel = NSTextField(frame: NSRect(x: 60, y: 298, width: 140, height: 14))
        subtitleLabel.isEditable = false
        subtitleLabel.isBordered = false
        subtitleLabel.backgroundColor = .clear
        subtitleLabel.font = NSFont.systemFont(ofSize: 10.5, weight: .regular)
        subtitleLabel.textColor = NSColor(calibratedWhite: 0.45, alpha: 1.0)
        subtitleLabel.stringValue = "Voice typing & actions"
        container.addSubview(subtitleLabel)

        let masterSwitch = NSSwitch(frame: NSRect(x: width - 18 - 42, y: 304, width: 42, height: 24))
        masterSwitch.state = isEnabled ? .on : .off
        masterSwitch.target = self
        masterSwitch.action = #selector(masterSwitchToggled(_:))
        self.enableToggleSwitch = masterSwitch
        container.addSubview(masterSwitch)

        // Status Badge Pill
        let badgeView = NSView(frame: NSRect(x: 18, y: 264, width: width - 36, height: 24))
        badgeView.wantsLayer = true
        badgeView.layer?.cornerRadius = 12
        badgeView.layer?.masksToBounds = true
        self.statusBadgeView = badgeView
        container.addSubview(badgeView)

        let badgeLabel = NSTextField(frame: NSRect(x: 0, y: 4, width: width - 36, height: 16))
        badgeLabel.isEditable = false
        badgeLabel.isBordered = false
        badgeLabel.backgroundColor = .clear
        badgeLabel.alignment = .center
        badgeLabel.font = NSFont.systemFont(ofSize: 11, weight: .semibold)
        self.statusBadgeLabel = badgeLabel
        badgeView.addSubview(badgeLabel)

        // Apple Inset Grouped Card (Unified controls: Shortcut, Desktop Orb, Permissions)
        let groupedCard = NSView(frame: NSRect(x: 18, y: 64, width: width - 36, height: 190))
        groupedCard.wantsLayer = true
        groupedCard.layer?.cornerRadius = 12
        groupedCard.layer?.masksToBounds = true
        groupedCard.layer?.backgroundColor = NSColor(calibratedWhite: 1.0, alpha: 0.75).cgColor
        groupedCard.layer?.borderColor = NSColor(calibratedWhite: 0.0, alpha: 0.06).cgColor
        groupedCard.layer?.borderWidth = 1.0
        container.addSubview(groupedCard)

        let cardWidth = width - 36

        // Row 1: Global Shortcut Picker (y: 126 to 180)
        let scTitle = NSTextField(frame: NSRect(x: 12, y: 158, width: 140, height: 16))
        scTitle.isEditable = false
        scTitle.isBordered = false
        scTitle.backgroundColor = .clear
        scTitle.font = NSFont.systemFont(ofSize: 12, weight: .semibold)
        scTitle.textColor = NSColor(calibratedWhite: 0.15, alpha: 1.0)
        scTitle.stringValue = "Global Shortcut"
        groupedCard.addSubview(scTitle)

        let segment = NSSegmentedControl(labels: ["⌥Space", "⌃⌥R", "⌃⇧Space"], trackingMode: .selectOne, target: self, action: #selector(shortcutSegmentChanged(_:)))
        segment.frame = NSRect(x: 12, y: 128, width: cardWidth - 24, height: 24)
        segment.selectedSegment = selectedShortcut.rawValue
        self.shortcutSegmentControl = segment
        groupedCard.addSubview(segment)

        // Divider 1
        let div1 = NSView(frame: NSRect(x: 12, y: 118, width: cardWidth - 24, height: 0.5))
        div1.wantsLayer = true
        div1.layer?.backgroundColor = NSColor(calibratedWhite: 0.0, alpha: 0.08).cgColor
        groupedCard.addSubview(div1)

        // Row 2: Floating Desktop Orb Toggle (y: 72 to 114)
        let orbLabel = NSTextField(frame: NSRect(x: 12, y: 84, width: 160, height: 16))
        orbLabel.isEditable = false
        orbLabel.isBordered = false
        orbLabel.backgroundColor = .clear
        orbLabel.font = NSFont.systemFont(ofSize: 12, weight: .medium)
        orbLabel.textColor = NSColor(calibratedWhite: 0.15, alpha: 1.0)
        orbLabel.stringValue = "Floating Desktop Orb"
        groupedCard.addSubview(orbLabel)

        let orbSwitch = NSSwitch(frame: NSRect(x: cardWidth - 12 - 42, y: 82, width: 42, height: 22))
        orbSwitch.state = showDesktopOrb ? .on : .off
        orbSwitch.target = self
        orbSwitch.action = #selector(desktopOrbSwitchToggled(_:))
        self.desktopOrbToggleSwitch = orbSwitch
        groupedCard.addSubview(orbSwitch)

        // Divider 2
        let div2 = NSView(frame: NSRect(x: 12, y: 68, width: cardWidth - 24, height: 0.5))
        div2.wantsLayer = true
        div2.layer?.backgroundColor = NSColor(calibratedWhite: 0.0, alpha: 0.08).cgColor
        groupedCard.addSubview(div2)

        // Row 3: Unified Permissions Status (y: 10 to 64)
        let permLabel = NSTextField(frame: NSRect(x: 12, y: 38, width: 100, height: 16))
        permLabel.isEditable = false
        permLabel.isBordered = false
        permLabel.backgroundColor = .clear
        permLabel.font = NSFont.systemFont(ofSize: 12, weight: .medium)
        permLabel.textColor = NSColor(calibratedWhite: 0.15, alpha: 1.0)
        permLabel.stringValue = "Permissions"
        groupedCard.addSubview(permLabel)

        let permStatus = NSTextField(frame: NSRect(x: cardWidth - 12 - 120, y: 38, width: 120, height: 16))
        permStatus.isEditable = false
        permStatus.isBordered = false
        permStatus.backgroundColor = .clear
        permStatus.alignment = .right
        permStatus.font = NSFont.systemFont(ofSize: 11, weight: .bold)
        self.permissionsStatusLabel = permStatus
        groupedCard.addSubview(permStatus)

        let dotsLabel = NSTextField(frame: NSRect(x: 12, y: 14, width: 160, height: 16))
        dotsLabel.isEditable = false
        dotsLabel.isBordered = false
        dotsLabel.backgroundColor = .clear
        dotsLabel.font = NSFont.systemFont(ofSize: 10, weight: .medium)
        dotsLabel.textColor = NSColor(calibratedWhite: 0.45, alpha: 1.0)
        self.permissionsDotsLabel = dotsLabel
        groupedCard.addSubview(dotsLabel)

        let permActionBtn = NSButton(frame: NSRect(x: cardWidth - 12 - 86, y: 12, width: 86, height: 20))
        permActionBtn.title = "Fix Access ↗"
        permActionBtn.font = NSFont.systemFont(ofSize: 10, weight: .semibold)
        permActionBtn.isBordered = false
        permActionBtn.wantsLayer = true
        permActionBtn.layer?.cornerRadius = 5
        permActionBtn.layer?.backgroundColor = NSColor(calibratedRed: 0.0, green: 0.32, blue: 1.0, alpha: 0.12).cgColor
        permActionBtn.contentTintColor = NSColor(calibratedRed: 0.0, green: 0.32, blue: 1.0, alpha: 1.0)
        permActionBtn.target = self
        permActionBtn.action = #selector(fixPermissionsAction)
        self.permissionsActionButton = permActionBtn
        groupedCard.addSubview(permActionBtn)

        // Footer Actions: Open Web App & Quit
        let openWebAppBtn = NSButton(frame: NSRect(x: 18, y: 16, width: 146, height: 32))
        openWebAppBtn.title = "Open Web App ↗"
        openWebAppBtn.font = NSFont.systemFont(ofSize: 11, weight: .semibold)
        openWebAppBtn.bezelStyle = .rounded
        openWebAppBtn.wantsLayer = true
        openWebAppBtn.layer?.backgroundColor = NSColor(calibratedWhite: 0.0, alpha: 0.05).cgColor
        openWebAppBtn.layer?.cornerRadius = 8
        openWebAppBtn.target = self
        openWebAppBtn.action = #selector(openRecallWebApp)
        container.addSubview(openWebAppBtn)

        let quitBtn = NSButton(frame: NSRect(x: width - 18 - 110, y: 16, width: 110, height: 32))
        quitBtn.title = "Quit Flow"
        quitBtn.font = NSFont.systemFont(ofSize: 11, weight: .semibold)
        quitBtn.bezelStyle = .rounded
        quitBtn.contentTintColor = NSColor.systemRed
        quitBtn.wantsLayer = true
        quitBtn.layer?.backgroundColor = NSColor.systemRed.withAlphaComponent(0.08).cgColor
        quitBtn.layer?.cornerRadius = 8
        quitBtn.target = self
        quitBtn.action = #selector(quitApp)
        container.addSubview(quitBtn)

        updateState()
        refreshPermissions()
    }

    private func startPermissionsPolling() {
        permissionsPollTimer?.invalidate()
        permissionsPollTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            guard let self = self else { return }
            if self.settingsWindow?.isVisible == true {
                self.refreshPermissions()
            } else {
                self.permissionsPollTimer?.invalidate()
                self.permissionsPollTimer = nil
            }
        }
    }

    @objc func hideSettingsWindow() {
        settingsWindow?.orderOut(nil)
        permissionsPollTimer?.invalidate()
        permissionsPollTimer = nil
    }

    @objc private func masterSwitchToggled(_ sender: NSSwitch) {
        isEnabled = (sender.state == .on)
    }

    @objc private func shortcutSegmentChanged(_ sender: NSSegmentedControl) {
        if let option = ShortcutOption(rawValue: sender.selectedSegment) {
            selectedShortcut = option
        }
    }

    @objc private func desktopOrbSwitchToggled(_ sender: NSSwitch) {
        showDesktopOrb = (sender.state == .on)
    }

    // ── 11. PERMISSION AUDIT & VERIFICATION ACTIONS ──────────────────────────

    @objc func refreshPermissions() {
        let green = NSColor(calibratedRed: 0.05, green: 0.65, blue: 0.35, alpha: 1.0)
        let orange = NSColor.systemOrange

        let micGranted = (AVCaptureDevice.authorizationStatus(for: .audio) == .authorized)
        let axGranted = AXIsProcessTrusted()
        let inputGranted = CGPreflightListenEventAccess()

        let allGranted = micGranted && axGranted && inputGranted

        if allGranted {
            permissionsStatusLabel?.textColor = green
            permissionsStatusLabel?.stringValue = "✓ All Active"
            permissionsActionButton?.isHidden = true
            permissionsDotsLabel?.stringValue = "Mic ✓  •  AX ✓  •  Input ✓"
            permissionsDotsLabel?.textColor = green
        } else {
            permissionsStatusLabel?.textColor = orange
            permissionsStatusLabel?.stringValue = "Action Needed"
            permissionsActionButton?.isHidden = false
            permissionsActionButton?.title = !micGranted ? "Grant Mic ↗" : (!axGranted ? "Grant AX ↗" : "Grant Input ↗")

            let micStr = micGranted ? "Mic ✓" : "Mic ✕"
            let axStr = axGranted ? "AX ✓" : "AX ✕"
            let inStr = inputGranted ? "Input ✓" : "Input ✕"
            permissionsDotsLabel?.stringValue = "\(micStr)  •  \(axStr)  •  \(inStr)"
            permissionsDotsLabel?.textColor = orange
        }
    }

    @objc func fixPermissionsAction() {
        let micGranted = (AVCaptureDevice.authorizationStatus(for: .audio) == .authorized)
        let axGranted = AXIsProcessTrusted()

        if !micGranted {
            let status = AVCaptureDevice.authorizationStatus(for: .audio)
            if status == .notDetermined {
                AVCaptureDevice.requestAccess(for: .audio) { [weak self] _ in
                    DispatchQueue.main.async { self?.refreshPermissions() }
                }
            } else if let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone") {
                NSWorkspace.shared.open(url)
            }
        } else if !axGranted {
            let options: NSDictionary = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true]
            AXIsProcessTrustedWithOptions(options)
            if let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility") {
                NSWorkspace.shared.open(url)
            }
        } else {
            CGRequestListenEventAccess()
            if let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent") {
                NSWorkspace.shared.open(url)
            }
        }
    }

    // ── 12. STATE & MENU UPDATES ────────────────────────────────────────────

    private func updateState() {
        updateStatusItemIcon()
        rebuildStatusMenu()
        updateDesktopOrbVisibility()

        if !isEnabled {
            statusBadgeView?.layer?.backgroundColor = NSColor.secondaryLabelColor.withAlphaComponent(0.12).cgColor
            statusBadgeLabel?.textColor = .secondaryLabelColor
            statusBadgeLabel?.stringValue = "○ Recall Flow Disabled"
            unregisterGlobalHotKey()
        } else if isListening {
            statusBadgeView?.layer?.backgroundColor = NSColor(calibratedRed: 0.0, green: 0.32, blue: 1.0, alpha: 0.15).cgColor
            statusBadgeLabel?.textColor = NSColor(calibratedRed: 0.0, green: 0.32, blue: 1.0, alpha: 1.0)
            statusBadgeLabel?.stringValue = "● Listening to speech…"
        } else if hasShortcutConflict {
            statusBadgeView?.layer?.backgroundColor = NSColor.systemOrange.withAlphaComponent(0.18).cgColor
            statusBadgeLabel?.textColor = NSColor.systemOrange
            statusBadgeLabel?.stringValue = "⚠️ Shortcut conflict — select alternate"
        } else {
            statusBadgeView?.layer?.backgroundColor = NSColor(calibratedRed: 0.05, green: 0.65, blue: 0.35, alpha: 0.15).cgColor
            statusBadgeLabel?.textColor = NSColor(calibratedRed: 0.05, green: 0.65, blue: 0.35, alpha: 1.0)
            statusBadgeLabel?.stringValue = "● Active (\(selectedShortcut.shortTitle))"
            registerGlobalHotKey()
        }
    }

    @objc func openRecallWebApp() {
        if let url = URL(string: "http://localhost:3001") {
            NSWorkspace.shared.open(url)
        }
    }

    @objc func quitApp() {
        print("👋 Quitting Recall Flow cleanly...")
        unregisterGlobalHotKey()
        unregisterListeningHotKeys()
        cleanupAudio()
        NSApp.terminate(nil)
        exit(0)
    }
}

// ── 13. FLOATING DRAGGABLE DESKTOP ORB PANEL ─────────────────────────────────

class DesktopOrbPanel: NSPanel {
    private var dragStartLocation: NSPoint?
    private var isDragging = false

    init() {
        let panelSize: CGFloat = 58
        let orbSize: CGFloat = 46
        let screenRect = NSScreen.main?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1440, height: 900)

        let savedX = UserDefaults.standard.double(forKey: "desktop_orb_x")
        let savedY = UserDefaults.standard.double(forKey: "desktop_orb_y")
        let initialX = savedX > 0 ? CGFloat(savedX) : screenRect.maxX - panelSize - 28
        let initialY = savedY > 0 ? CGFloat(savedY) : screenRect.minY + 28

        super.init(
            contentRect: NSRect(x: initialX, y: initialY, width: panelSize, height: panelSize),
            styleMask: [.nonactivatingPanel, .borderless],
            backing: .buffered,
            defer: false
        )

        self.level = .floating
        self.isOpaque = false
        self.backgroundColor = .clear
        self.hasShadow = false
        self.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]

        let container = NSView(frame: NSRect(x: 0, y: 0, width: panelSize, height: panelSize))
        let orb = OrbView(frame: NSRect(x: (panelSize - orbSize) / 2, y: (panelSize - orbSize) / 2, width: orbSize, height: orbSize))
        container.addSubview(orb)
        self.contentView = container
    }

    override func mouseDown(with event: NSEvent) {
        dragStartLocation = event.locationInWindow
        isDragging = false
    }

    override func mouseDragged(with event: NSEvent) {
        guard let dragStart = dragStartLocation else { return }
        let currentMouseLocation = NSEvent.mouseLocation
        let newX = currentMouseLocation.x - dragStart.x
        let newY = currentMouseLocation.y - dragStart.y
        self.setFrameOrigin(NSPoint(x: newX, y: newY))
        UserDefaults.standard.set(Double(newX), forKey: "desktop_orb_x")
        UserDefaults.standard.set(Double(newY), forKey: "desktop_orb_y")
        isDragging = true
    }

    override func mouseUp(with event: NSEvent) {
        if !isDragging {
            RecallFlowCompanion.shared.handleGlobalHotKeyTrigger()
        }
        dragStartLocation = nil
        isDragging = false
    }
}

// ── 14. REAL RECALL ORB VIEW (3D GRAPHIC + AUDIO WAVE BARS + PHASES) ─────────

class OrbView: NSView {
    private let glowLayer = CAGradientLayer()
    private let ringLayer = CAGradientLayer()
    private let ringShape = CAShapeLayer()
    private let imageLayer = CALayer()
    private let waveformContainer = CALayer()
    private var waveformBars: [CALayer] = []

    private var currentPhase: String = "idle"

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        wantsLayer = true
        setupLayers()
        startBreathing()
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    private func setupLayers() {
        guard let layer = self.layer else { return }

        // 1. Ambient Iridescent Glow Layer behind orb
        glowLayer.frame = bounds.insetBy(dx: -4, dy: -4)
        glowLayer.cornerRadius = glowLayer.bounds.width / 2
        glowLayer.colors = [
            NSColor(calibratedRed: 0.0, green: 0.32, blue: 1.0, alpha: 0.35).cgColor,  // #0052FF Recall Blue
            NSColor(calibratedRed: 0.47, green: 0.16, blue: 0.79, alpha: 0.30).cgColor, // #7928CA Violet
            NSColor(calibratedRed: 0.0, green: 0.82, blue: 1.0, alpha: 0.35).cgColor   // #00D2FF Cyan
        ]
        glowLayer.startPoint = CGPoint(x: 0, y: 0)
        glowLayer.endPoint = CGPoint(x: 1, y: 1)
        glowLayer.opacity = 0.55
        layer.addSublayer(glowLayer)

        // 2. Rotating Iridescent Ring Layer (Processing phase)
        ringLayer.frame = bounds.insetBy(dx: -1.5, dy: -1.5)
        ringLayer.cornerRadius = ringLayer.bounds.width / 2
        ringLayer.colors = [
            NSColor(calibratedRed: 0.0, green: 0.32, blue: 1.0, alpha: 0.9).cgColor,
            NSColor(calibratedRed: 0.0, green: 0.82, blue: 1.0, alpha: 0.9).cgColor,
            NSColor(calibratedRed: 0.47, green: 0.16, blue: 0.79, alpha: 0.9).cgColor
        ]
        ringLayer.startPoint = CGPoint(x: 0, y: 0)
        ringLayer.endPoint = CGPoint(x: 1, y: 1)

        let ringPath = CGMutablePath()
        ringPath.addEllipse(in: ringLayer.bounds.insetBy(dx: 1.0, dy: 1.0))
        ringShape.path = ringPath
        ringShape.fillColor = nil
        ringShape.strokeColor = NSColor.white.cgColor
        ringShape.lineWidth = 1.8
        ringLayer.mask = ringShape
        ringLayer.isHidden = true
        layer.addSublayer(ringLayer)

        // 3. 3D Iridescent Recall Orb Graphic Layer
        imageLayer.frame = bounds
        imageLayer.contentsGravity = .resizeAspect
        if let img = loadRecallOrbImage() {
            imageLayer.contents = img
        }
        imageLayer.shadowColor = NSColor(calibratedRed: 0.0, green: 0.32, blue: 1.0, alpha: 0.4).cgColor
        imageLayer.shadowRadius = 6
        imageLayer.shadowOpacity = 0.45
        imageLayer.shadowOffset = CGSize(width: 0, height: -1)
        layer.addSublayer(imageLayer)

        // 4. Center Audio Reactive Waveform Equalizer (5 white dancing bars - exact website match)
        waveformContainer.frame = bounds
        waveformContainer.isHidden = true
        layer.addSublayer(waveformContainer)

        let barCount = 5
        let barWidth: CGFloat = 2.0
        let barGap: CGFloat = 2.0
        let totalW = CGFloat(barCount) * barWidth + CGFloat(barCount - 1) * barGap // 18px
        let startX = (bounds.width - totalW) / 2.0

        for i in 0..<barCount {
            let bar = CALayer()
            let h: CGFloat = 4.0
            let x = startX + CGFloat(i) * (barWidth + barGap)
            let y = (bounds.height - h) / 2.0
            bar.frame = CGRect(x: x, y: y, width: barWidth, height: h)
            bar.cornerRadius = 1.0
            bar.backgroundColor = NSColor.white.cgColor
            bar.shadowColor = NSColor.white.cgColor
            bar.shadowRadius = 3.0
            bar.shadowOpacity = 0.9
            bar.shadowOffset = .zero
            waveformContainer.addSublayer(bar)
            waveformBars.append(bar)
        }
    }

    override func layout() {
        super.layout()
        glowLayer.frame = bounds.insetBy(dx: -4, dy: -4)
        glowLayer.cornerRadius = glowLayer.bounds.width / 2

        ringLayer.frame = bounds.insetBy(dx: -1.5, dy: -1.5)
        ringLayer.cornerRadius = ringLayer.bounds.width / 2
        let ringPath = CGMutablePath()
        ringPath.addEllipse(in: ringLayer.bounds.insetBy(dx: 1.0, dy: 1.0))
        ringShape.path = ringPath

        imageLayer.frame = bounds
        waveformContainer.frame = bounds
    }

    private func loadRecallOrbImage() -> NSImage? {
        if let path = Bundle.main.path(forResource: "recall-logo", ofType: "png"),
           let img = NSImage(contentsOfFile: path) {
            return img
        }
        let candidates = [
            "../public/recall-logo.png",
            "public/recall-logo.png",
            "/Users/krishang/Downloads/whatsaap reminder/public/recall-logo.png"
        ]
        for path in candidates {
            if let img = NSImage(contentsOfFile: path) {
                return img
            }
        }
        return nil
    }

    // ── PHASE ANIMATIONS ──

    // 1. Listening: Real-time 5-bar Equalizer Waveform & Audio Reactive Breathing
    func setListeningVolume(_ volume: Float) {
        if currentPhase != "listening" {
            currentPhase = "listening"
            imageLayer.removeAnimation(forKey: "spin")
            ringLayer.removeAnimation(forKey: "ringSpin")
            ringLayer.isHidden = true
            waveformContainer.isHidden = false
            resetGlowToDefault()
        }

        let vol = CGFloat(max(0.0, min(1.0, volume)))

        // 3D orb volume reactive scale
        let reactiveScale = 1.0 + vol * 0.12
        imageLayer.transform = CATransform3DMakeScale(reactiveScale, reactiveScale, 1.0)

        // Glow expansion
        glowLayer.opacity = Float(0.55 + vol * 0.35)
        let glowScale = 1.0 + vol * 0.18
        glowLayer.transform = CATransform3DMakeScale(glowScale, glowScale, 1.0)

        // 5-bar equalizer waveform dynamic heights
        let baseHeights: [CGFloat] = [3.5, 6.0, 9.5, 6.0, 3.5]
        let multipliers: [CGFloat] = [7.0, 13.0, 17.0, 13.0, 7.0]

        let barWidth: CGFloat = 2.0
        let barGap: CGFloat = 2.0
        let totalW = CGFloat(waveformBars.count) * barWidth + CGFloat(waveformBars.count - 1) * barGap
        let startX = (bounds.width - totalW) / 2.0

        CATransaction.begin()
        CATransaction.setAnimationDuration(0.06)
        for (i, bar) in waveformBars.enumerated() {
            let h = min(bounds.height - 4, baseHeights[i] + vol * multipliers[i])
            let x = startX + CGFloat(i) * (barWidth + barGap)
            let y = (bounds.height - h) / 2.0
            bar.frame = CGRect(x: x, y: y, width: barWidth, height: h)
        }
        CATransaction.commit()
    }

    // 2. Processing: Slower continuous 3D rotation + rotating iridescent ring (Website Match)
    func setProcessing() {
        currentPhase = "processing"
        waveformContainer.isHidden = true
        imageLayer.transform = CATransform3DIdentity

        // Rotate orb graphic continuously
        let spin = CABasicAnimation(keyPath: "transform.rotation.z")
        spin.fromValue = 0
        spin.toValue = 2 * Double.pi
        spin.duration = 3.6
        spin.repeatCount = .infinity
        spin.timingFunction = CAMediaTimingFunction(name: .linear)
        imageLayer.add(spin, forKey: "spin")

        // Rotating iridescent ring
        ringLayer.isHidden = false
        let ringSpin = CABasicAnimation(keyPath: "transform.rotation.z")
        ringSpin.fromValue = 0
        ringSpin.toValue = 2 * Double.pi
        ringSpin.duration = 2.2
        ringSpin.repeatCount = .infinity
        ringSpin.timingFunction = CAMediaTimingFunction(name: .linear)
        ringLayer.add(ringSpin, forKey: "ringSpin")

        // Ambient glow breathing pulse
        let glowPulse = CABasicAnimation(keyPath: "opacity")
        glowPulse.fromValue = 0.5
        glowPulse.toValue = 0.85
        glowPulse.duration = 1.0
        glowPulse.autoreverses = true
        glowPulse.repeatCount = .infinity
        glowLayer.add(glowPulse, forKey: "glowPulse")
    }

    // 3. Success / Inserted: Clean emerald bloom
    func setSuccess() {
        currentPhase = "success"
        ringLayer.isHidden = true
        ringLayer.removeAnimation(forKey: "ringSpin")
        waveformContainer.isHidden = true
        imageLayer.removeAnimation(forKey: "spin")
        imageLayer.transform = CATransform3DIdentity
        glowLayer.removeAnimation(forKey: "glowPulse")

        glowLayer.colors = [
            NSColor(calibratedRed: 0.05, green: 0.65, blue: 0.35, alpha: 0.40).cgColor,
            NSColor(calibratedRed: 0.10, green: 0.80, blue: 0.50, alpha: 0.35).cgColor,
            NSColor(calibratedRed: 0.05, green: 0.65, blue: 0.35, alpha: 0.40).cgColor
        ]
        glowLayer.opacity = 0.65
    }

    func startBreathing() {
        currentPhase = "idle"
        waveformContainer.isHidden = true
        ringLayer.isHidden = true
        resetGlowToDefault()

        let pulse = CABasicAnimation(keyPath: "transform.scale")
        pulse.fromValue = 1.0
        pulse.toValue = 1.05
        pulse.duration = 2.0
        pulse.autoreverses = true
        pulse.repeatCount = .infinity
        pulse.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
        imageLayer.add(pulse, forKey: "pulse")
    }

    func stopAnimation() {
        imageLayer.removeAllAnimations()
        ringLayer.removeAllAnimations()
        glowLayer.removeAllAnimations()
        ringLayer.isHidden = true
        waveformContainer.isHidden = true
        imageLayer.transform = CATransform3DIdentity
        glowLayer.transform = CATransform3DIdentity
        startBreathing()
    }

    private func resetGlowToDefault() {
        glowLayer.colors = [
            NSColor(calibratedRed: 0.0, green: 0.32, blue: 1.0, alpha: 0.35).cgColor,
            NSColor(calibratedRed: 0.47, green: 0.16, blue: 0.79, alpha: 0.30).cgColor,
            NSColor(calibratedRed: 0.0, green: 0.82, blue: 1.0, alpha: 0.35).cgColor
        ]
        glowLayer.opacity = 0.55
    }
}

// ── 15. RUNNER ENTRY POINT ──────────────────────────────────────────────────

let app = NSApplication.shared
let delegate = RecallFlowCompanion.shared
app.delegate = delegate
app.run()
