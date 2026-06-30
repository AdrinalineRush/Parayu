import SwiftUI

// MARK: - Parayu Design System (warm, Apple-grade; matches the macOS desktop app)
enum ParayuTheme {
    // Surfaces
    static let bg         = Color(red: 252/255, green: 251/255, blue: 250/255) // page
    static let sidebar    = Color(red: 246/255, green: 244/255, blue: 240/255)
    static let card       = Color.white
    static let surface    = Color(red: 244/255, green: 241/255, blue: 236/255) // tinted chip bg
    static let border     = Color(red: 232/255, green: 229/255, blue: 223/255)
    static let hair       = Color(red: 239/255, green: 236/255, blue: 230/255) // softer hairline

    // Text
    static let text       = Color(red: 28/255,  green: 27/255,  blue: 25/255)
    static let muted      = Color(red: 128/255, green: 122/255, blue: 112/255)
    static let faint      = Color(red: 163/255, green: 157/255, blue: 146/255) // small-caps labels

    // Brand
    static let accent     = Color(red: 224/255, green: 30/255,  blue: 65/255)
    static let accentRed  = Color(red: 232/255, green: 31/255,  blue: 58/255)
    static let accentPink = Color(red: 216/255, green: 29/255,  blue: 84/255)
    static let purple     = Color(red: 160/255, green: 43/255,  blue: 176/255)
    static let success    = Color(red: 31/255,  green: 111/255, blue: 99/255)
    static let accentSoft = Color(red: 224/255, green: 30/255,  blue: 65/255).opacity(0.07)

    // Icon tints (soft bg + saturated fg)
    static let green      = Color(red: 31/255,  green: 111/255, blue: 99/255)
    static let blue       = Color(red: 55/255,  green: 138/255, blue: 221/255)
    static let orange     = Color(red: 232/255, green: 131/255, blue: 36/255)
    static let whatsapp   = Color(red: 37/255,  green: 178/255, blue: 94/255)

    // --accent-grad: #e81f3a -> #d81d54 -> #a02bb0
    static let accentGradient = LinearGradient(
        colors: [accentRed, accentPink, purple],
        startPoint: .topLeading, endPoint: .bottomTrailing)

    static let gaugeGradient = AngularGradient(
        gradient: Gradient(colors: [purple, accentPink, accentRed]),
        center: .center, startAngle: .degrees(180), endAngle: .degrees(360))

    enum Weight { case regular, medium, semibold, bold, extrabold }

    static func font(_ size: CGFloat, _ weight: Weight = .regular) -> Font {
        switch weight {
        case .regular:   return .custom("PlusJakartaSans-Regular",   size: size)
        case .medium:    return .custom("PlusJakartaSans-Medium",    size: size)
        case .semibold:  return .custom("PlusJakartaSans-SemiBold",  size: size)
        case .bold:      return .custom("PlusJakartaSans-Bold",      size: size)
        case .extrabold: return .custom("PlusJakartaSans-ExtraBold", size: size)
        }
    }

    // UIKit mirrors
    static let uiBg      = UIColor(red: 252/255, green: 251/255, blue: 250/255, alpha: 1)
    static let uiSidebar = UIColor(red: 246/255, green: 244/255, blue: 240/255, alpha: 1)
    static let uiBorder  = UIColor(red: 232/255, green: 229/255, blue: 223/255, alpha: 1)
    static let uiText    = UIColor(red: 28/255,  green: 27/255,  blue: 25/255,  alpha: 1)
    static let uiMuted   = UIColor(red: 112/255, green: 107/255, blue: 97/255,  alpha: 1)
    static let uiAccent  = UIColor(red: 224/255, green: 30/255,  blue: 65/255,  alpha: 1)
}

// MARK: - Soft warm shadow (premium depth without heaviness)
struct SoftShadow: ViewModifier {
    var strong: Bool = false
    func body(content: Content) -> some View {
        content
            .shadow(color: Color(red: 0.16, green: 0.12, blue: 0.08).opacity(strong ? 0.07 : 0.05),
                    radius: strong ? 22 : 16, x: 0, y: strong ? 12 : 8)
    }
}
extension View {
    func softShadow(strong: Bool = false) -> some View { modifier(SoftShadow(strong: strong)) }
}

// MARK: - White card style
struct ParayuCard: ViewModifier {
    var padding: CGFloat = 16
    var radius: CGFloat = 20
    var strongShadow: Bool = false
    func body(content: Content) -> some View {
        content
            .padding(padding)
            .background(ParayuTheme.card)
            .clipShape(RoundedRectangle(cornerRadius: radius, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .stroke(ParayuTheme.hair, lineWidth: 1)
            )
            .softShadow(strong: strongShadow)
    }
}
extension View {
    func parayuCard(padding: CGFloat = 16, radius: CGFloat = 20, strongShadow: Bool = false) -> some View {
        modifier(ParayuCard(padding: padding, radius: radius, strongShadow: strongShadow))
    }
}

// MARK: - Squircle icon badge
struct IconBadge: View {
    let system: String
    var tint: Color
    var size: CGFloat = 36
    var iconScale: CGFloat = 0.5
    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: size * 0.32, style: .continuous)
                .fill(tint.opacity(0.13))
            Image(systemName: system)
                .font(.system(size: size * iconScale, weight: .semibold))
                .foregroundColor(tint)
        }
        .frame(width: size, height: size)
    }
}

// MARK: - Reusable large screen header (matches Dashboard / Transcribe)
struct ScreenHeader<Trailing: View>: View {
    let title: String
    var subtitle: String? = nil
    @ViewBuilder var trailing: () -> Trailing

    var body: some View {
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(ParayuTheme.font(28, .extrabold))
                    .foregroundColor(ParayuTheme.text)
                if let subtitle {
                    Text(subtitle)
                        .font(ParayuTheme.font(13, .medium))
                        .foregroundColor(ParayuTheme.muted)
                }
            }
            Spacer(minLength: 8)
            trailing()
        }
    }
}
extension ScreenHeader where Trailing == EmptyView {
    init(title: String, subtitle: String? = nil) {
        self.init(title: title, subtitle: subtitle, trailing: { EmptyView() })
    }
}

// MARK: - Small-caps section label
struct SectionLabel: View {
    let text: String
    var body: some View {
        Text(text)
            .font(ParayuTheme.font(11, .bold))
            .tracking(0.6)
            .foregroundColor(ParayuTheme.faint)
    }
}

// MARK: - Text field surface style
struct ParayuFieldStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .font(ParayuTheme.font(15, .medium))
            .foregroundColor(ParayuTheme.text)
            .padding(.horizontal, 13)
            .padding(.vertical, 12)
            .background(ParayuTheme.surface)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(ParayuTheme.hair, lineWidth: 1))
    }
}
extension View {
    func parayuField() -> some View { modifier(ParayuFieldStyle()) }
}

// MARK: - Floating glass tab bar
private struct TabSpec: Identifiable {
    let id: Int
    let icon: String
    let label: String
}

struct FloatingTabBar: View {
    @Binding var selected: Int
    private let tabs = [
        TabSpec(id: 0, icon: "chart.bar.fill", label: "Dashboard"),
        TabSpec(id: 1, icon: "mic.fill",       label: "Transcribe"),
        TabSpec(id: 2, icon: "clock.fill",     label: "History"),
        TabSpec(id: 3, icon: "gearshape.fill", label: "Settings"),
    ]

    var body: some View {
        HStack(spacing: 2) {
            ForEach(tabs) { tab in
                let isActive = selected == tab.id
                Button {
                    if selected != tab.id {
                        let gen = UIImpactFeedbackGenerator(style: .light)
                        gen.impactOccurred()
                    }
                    withAnimation(.spring(response: 0.32, dampingFraction: 0.78)) {
                        selected = tab.id
                    }
                } label: {
                    VStack(spacing: 4) {
                        Image(systemName: tab.icon)
                            .font(.system(size: 19, weight: .semibold))
                            .frame(height: 22)
                        Text(tab.label)
                            .font(ParayuTheme.font(10, isActive ? .bold : .semibold))
                        Capsule()
                            .fill(ParayuTheme.accentGradient)
                            .frame(width: 16, height: 3)
                            .opacity(isActive ? 1 : 0)
                    }
                    .foregroundColor(isActive ? ParayuTheme.accent : ParayuTheme.faint)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 9)
                    .background(
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .fill(isActive ? ParayuTheme.accentSoft : Color.clear)
                    )
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 7)
        .background(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .fill(.ultraThinMaterial)
                .environment(\.colorScheme, .light)
        )
        .background(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .fill(Color.white.opacity(0.72))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .stroke(ParayuTheme.hair, lineWidth: 1)
        )
        .softShadow(strong: true)
        .padding(.horizontal, 18)
    }
}

// MARK: - Root container (custom floating tab bar over a TabView)
struct MainView: View {
    @EnvironmentObject var state: AppState
    @State private var selectedTab = 1 // default to Transcribe

    var body: some View {
        ZStack(alignment: .bottom) {
            ParayuTheme.bg.ignoresSafeArea()

            TabView(selection: $selectedTab) {
                HomeView().tag(0).toolbar(.hidden, for: .tabBar)
                TranscribeView().tag(1).toolbar(.hidden, for: .tabBar)
                HistoryView().tag(2).toolbar(.hidden, for: .tabBar)
                SettingsView().tag(3).toolbar(.hidden, for: .tabBar)
            }

            FloatingTabBar(selected: $selectedTab)
                .padding(.bottom, 4)
        }
        .ignoresSafeArea(.keyboard, edges: .bottom)
    }
}

// Bottom clearance so scroll content / the mic clears the floating tab bar.
extension View {
    func clearsFloatingTabBar() -> some View { self.padding(.bottom, 100) }
}
