import SwiftUI

@main
struct ParayuApp: App {
    @StateObject private var state = AppState()
    @Environment(\.scenePhase) private var scenePhase
    
    public init() {
        // Customize appearance
        let appearance = UITabBarAppearance()
        appearance.configureWithOpaqueBackground()
        appearance.backgroundColor = UIColor.systemBackground
        UITabBar.appearance().standardAppearance = appearance
        UITabBar.appearance().scrollEdgeAppearance = appearance
    }
    
    var body: some Scene {
        WindowGroup {
            Group {
                if state.onboarded {
                    MainView()
                        .environmentObject(state)
                        .preferredColorScheme(.dark) // Match the dark premium theme of Parayu
                } else {
                    OnboardingView()
                        .environmentObject(state)
                        .preferredColorScheme(.dark)
                }
            }
            .onOpenURL { url in
                if url.scheme == "parayu" && (url.host == "dictate" || url.absoluteString.contains("dictate")) {
                    state.openKeyboardHandoff()
                }
            }
            .onAppear {
                state.handlePendingShortcutActionIfNeeded()
            }
            .onChange(of: scenePhase) { phase in
                if phase == .active {
                    state.handlePendingShortcutActionIfNeeded()
                }
            }
            .fullScreenCover(isPresented: Binding(
                get: { state.keyboardHandoffActive },
                set: { state.keyboardHandoffActive = $0 }
            )) {
                KeyboardHandoffDictationView()
                    .environmentObject(state)
            }
        }
    }
}
