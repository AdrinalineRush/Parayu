import SwiftUI

struct HistoryRow: View {
    let entry: HistoryEntry
    var onDelete: () -> Void
    var onCopy: () -> Void
    
    @State private var isExpanded = false
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(entry.timestamp, style: .date)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(.secondary)
                Text("•")
                    .font(.system(size: 11))
                    .foregroundColor(.secondary)
                Text(entry.timestamp, style: .time)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(.secondary)
                
                Spacer()
                
                Text("\(entry.words) words")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(Color(red: 224/255, green: 30/255, blue: 65/255))
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color(red: 224/255, green: 30/255, blue: 65/255).opacity(0.1))
                    .cornerRadius(4)
                
                Text(String(format: "%.1fs", entry.durationSec))
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(.secondary)
            }
            
            Text(entry.text)
                .font(.system(size: 14, weight: .medium))
                .foregroundColor(.white)
                .lineLimit(isExpanded ? nil : 2)
            
            if isExpanded {
                VStack(alignment: .leading, spacing: 6) {
                    Divider()
                        .background(Color.white.opacity(0.1))
                    
                    Text("Raw Transcript")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(.secondary)
                        .textCase(.uppercase)
                    
                    Text(entry.rawText.isEmpty ? "None (Identical)" : entry.rawText)
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(.gray)
                    
                    HStack(spacing: 12) {
                        Button(action: onCopy) {
                            Label("Copy", systemImage: "doc.on.doc.fill")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(.white)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 6)
                                .background(Color.white.opacity(0.08))
                                .cornerRadius(6)
                        }
                        
                        Button(action: onDelete) {
                            Label("Delete", systemImage: "trash.fill")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(.red)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 6)
                                .background(Color.red.opacity(0.1))
                                .cornerRadius(6)
                        }
                    }
                    .padding(.top, 4)
                }
                .transition(.opacity)
            }
        }
        .padding()
        .background(Color.white.opacity(0.04))
        .cornerRadius(14)
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(isExpanded ? Color(red: 224/255, green: 30/255, blue: 65/255).opacity(0.3) : Color.white.opacity(0.06), lineWidth: 1)
        )
        .onTapGesture {
            withAnimation(.spring(response: 0.25, dampingFraction: 0.75)) {
                isExpanded.toggle()
            }
        }
    }
}

struct HistoryView: View {
    @EnvironmentObject var state: AppState
    @State private var searchText = ""
    @State private var showCopiedAlert = false
    
    var filteredHistory: [HistoryEntry] {
        if searchText.isEmpty {
            return state.history
        } else {
            return state.history.filter {
                $0.text.localizedCaseInsensitiveContains(searchText) ||
                $0.rawText.localizedCaseInsensitiveContains(searchText)
            }
        }
    }
    
    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Search Bar
                HStack {
                    Image(systemName: "magnifyingglass")
                        .foregroundColor(.secondary)
                    
                    TextField("Search history…", text: $searchText)
                        .foregroundColor(.white)
                        .autocorrectionDisabled(true)
                    
                    if !searchText.isEmpty {
                        Button(action: { searchText = "" }) {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundColor(.secondary)
                        }
                    }
                }
                .padding(10)
                .background(Color.white.opacity(0.05))
                .cornerRadius(10)
                .padding(.horizontal)
                .padding(.vertical, 12)
                
                // History List
                if filteredHistory.isEmpty {
                    VStack(spacing: 12) {
                        Spacer()
                        Image(systemName: "clock.badge.exclamationmark.fill")
                            .font(.system(size: 44))
                            .foregroundColor(.secondary)
                        Text(searchText.isEmpty ? "No history entries yet" : "No matches found")
                            .font(.system(size: 15, weight: .bold))
                            .foregroundColor(.secondary)
                        Spacer()
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    ScrollView {
                        LazyVStack(spacing: 12) {
                            ForEach(filteredHistory) { entry in
                                HistoryRow(
                                    entry: entry,
                                    onDelete: {
                                        if let idx = state.history.firstIndex(where: { $0.id == entry.id }) {
                                            state.history.remove(at: idx)
                                            state.saveAll()
                                        }
                                    },
                                    onCopy: {
                                        UIPasteboard.general.string = entry.text
                                        withAnimation {
                                            showCopiedAlert = true
                                        }
                                        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
                                            withAnimation {
                                                self.showCopiedAlert = false
                                            }
                                        }
                                    }
                                )
                                .padding(.horizontal)
                            }
                        }
                        .padding(.vertical, 8)
                    }
                }
            }
            .navigationTitle("Translation History")
            .navigationBarTitleDisplayMode(.inline)
            .background(Color.black.ignoresSafeArea())
            .overlay(
                Group {
                    if showCopiedAlert {
                        VStack {
                            HStack(spacing: 8) {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundColor(.green)
                                Text("Copied to Clipboard")
                                    .font(.system(size: 13, weight: .bold))
                                    .foregroundColor(.white)
                            }
                            .padding(.horizontal, 16)
                            .padding(.vertical, 10)
                            .background(Color.gray.opacity(0.85))
                            .cornerRadius(20)
                            .shadow(radius: 5)
                        }
                        .transition(.scale.combined(with: .opacity))
                        .zIndex(100)
                    }
                }
            )
        }
    }
}
