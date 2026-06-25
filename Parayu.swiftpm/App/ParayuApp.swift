import SwiftUI

@main
struct ParayuApp: App {
    @StateObject private var state = AppState()
    
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
    }
}
