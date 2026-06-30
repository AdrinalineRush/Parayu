import SwiftUI

@main
struct ParayuApp: App {
    @StateObject private var state = AppState()
    @Environment(\.scenePhase) private var scenePhase
    
    public init() {
        // Light/warm chrome to match the macOS desktop app
        let appearance = UITabBarAppearance()
        appearance.configureWithOpaqueBackground()
        appearance.backgroundColor = ParayuTheme.uiSidebar
        appearance.shadowColor = ParayuTheme.uiBorder
        UITabBar.appearance().standardAppearance = appearance
        UITabBar.appearance().scrollEdgeAppearance = appearance

        let nav = UINavigationBarAppearance()
        nav.configureWithOpaqueBackground()
        nav.backgroundColor = ParayuTheme.uiBg
        nav.shadowColor = .clear
        nav.titleTextAttributes = [.foregroundColor: ParayuTheme.uiText]
        nav.largeTitleTextAttributes = [.foregroundColor: ParayuTheme.uiText]
        UINavigationBar.appearance().standardAppearance = nav
        UINavigationBar.appearance().scrollEdgeAppearance = nav
    }
    
    var body: some Scene {
        WindowGroup {
            Group {
                if state.onboarded {
                    MainView()
                        .environmentObject(state)
                        .preferredColorScheme(.light) // Light/warm theme — matches the macOS app
                } else {
                    OnboardingView()
                        .environmentObject(state)
                        .preferredColorScheme(.light)
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
