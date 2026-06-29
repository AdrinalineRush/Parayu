import SwiftUI

struct SnippetsView: View {
    @EnvironmentObject var state: AppState
    @State private var triggerText = ""
    @State private var expansionText = ""
    @State private var errorMessage = ""
    
    var body: some View {
        VStack(spacing: 0) {
            // Form Card
            VStack(alignment: .leading, spacing: 12) {
                Text("Add Text Snippet")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(.secondary)
                    .textCase(.uppercase)
                    .tracking(0.5)
                
                VStack(spacing: 10) {
                    TextField("Abbreviation trigger (e.g. btw)", text: $triggerText)
                        .padding(11)
                        .background(Color.white.opacity(0.05))
                        .cornerRadius(10)
                        .foregroundColor(.white)
                        .font(.system(size: 14))
                        .autocorrectionDisabled(true)
                        .textInputAutocapitalization(.never)
                    
                    TextField("Full expansion text (e.g. by the way)", text: $expansionText)
                        .padding(11)
                        .background(Color.white.opacity(0.05))
                        .cornerRadius(10)
                        .foregroundColor(.white)
                        .font(.system(size: 14))
                        .autocorrectionDisabled(true)
                }
                
                Button(action: addSnippet) {
                    Text("Add Snippet")
                        .fontWeight(.bold)
                        .font(.system(size: 13))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(Color(red: 224/255, green: 30/255, blue: 65/255))
                        .cornerRadius(10)
                }
                
                if !errorMessage.isEmpty {
                    Text(errorMessage)
                        .font(.caption)
                        .foregroundColor(.red)
                        .padding(.top, 2)
                }
            }
            .padding()
            .background(Color.white.opacity(0.04))
            .cornerRadius(16)
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(Color.white.opacity(0.06), lineWidth: 1)
            )
            .padding()
            
            // Snippets List
            if state.snippets.isEmpty {
                VStack(spacing: 12) {
                    Spacer()
                    Image(systemName: "doc.text.fill")
                        .font(.system(size: 44))
                        .foregroundColor(.secondary)
                    Text("No text snippets yet")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(.secondary)
                    Text("Snippets automatically expand abbreviation shortcuts into their full versions.")
                        .font(.system(size: 11))
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 40)
                    Spacer()
                }
                .frame(maxHeight: .infinity)
            } else {
                List {
                    ForEach(state.snippets) { snippet in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(snippet.trigger)
                                    .font(.system(size: 15, weight: .bold))
                                    .foregroundColor(.white)
                                Text("Shortcut")
                                    .font(.system(size: 10, weight: .semibold))
                                    .foregroundColor(.secondary)
                            }
                            
                            Spacer()
                            Image(systemName: "chevron.right.2")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            Spacer()
                            
                            VStack(alignment: .trailing, spacing: 2) {
                                Text(snippet.expansion)
                                    .font(.system(size: 15, weight: .bold))
                                    .foregroundColor(Color(red: 224/255, green: 30/255, blue: 65/255))
                                    .lineLimit(1)
                                Text("Expands To")
                                    .font(.system(size: 10, weight: .semibold))
                                    .foregroundColor(.secondary)
                            }
                        }
                        .listRowBackground(Color.white.opacity(0.02))
                    }
                    .onDelete(perform: deleteSnippets)
                }
                .scrollContentBackground(.hidden)
                .background(Color.clear)
            }
        }
        .navigationTitle("Snippets Expansion")
        .navigationBarTitleDisplayMode(.inline)
        .background(Color.black.ignoresSafeArea())
    }
    
    private func addSnippet() {
        let trigger = triggerText.trimmingCharacters(in: .whitespacesAndNewlines)
        let expansion = expansionText.trimmingCharacters(in: .whitespacesAndNewlines)
        
        guard !trigger.isEmpty, !expansion.isEmpty else {
            errorMessage = "Both fields are required."
            return
        }
        
        if state.snippets.contains(where: { $0.trigger.lowercased() == trigger.lowercased() }) {
            errorMessage = "A snippet with trigger '\(trigger)' already exists."
            return
        }
        
        let newSnippet = Snippet(trigger: trigger, expansion: expansion)
        state.snippets.append(newSnippet)
        state.saveAll()
        
        triggerText = ""
        expansionText = ""
        errorMessage = ""
    }
    
    private func deleteSnippets(at offsets: IndexSet) {
        state.snippets.remove(atOffsets: offsets)
        state.saveAll()
    }
}
