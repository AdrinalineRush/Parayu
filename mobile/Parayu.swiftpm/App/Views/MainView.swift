import SwiftUI

struct MainView: View {
    @EnvironmentObject var state: AppState
    @State private var selectedTab = 1 // default to Transcribe tab
    
    var body: some View {
        TabView(selection: $selectedTab) {
            HomeView()
                .tabItem {
                    Label("Dashboard", systemImage: "chart.bar.fill")
                }
                .tag(0)
            
            TranscribeView()
                .tabItem {
                    Label("Transcribe", systemImage: "mic.fill")
                }
                .tag(1)
            
            HistoryView()
                .tabItem {
                    Label("History", systemImage: "clock.fill")
                }
                .tag(2)
            
            SettingsView()
                .tabItem {
                    Label("Settings", systemImage: "gearshape.fill")
                }
        }
        .tint(Color(red: 224/255, green: 30/255, blue: 65/255)) // Parayu accent color
    }
}
