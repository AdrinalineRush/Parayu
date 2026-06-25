import SwiftUI

struct DictionaryView: View {
    @EnvironmentObject var state: AppState
    @State private var fromText = ""
    @State private var toText = ""
    @State private var errorMessage = ""
    
    var body: some View {
        VStack(spacing: 0) {
            // Form Card
            VStack(alignment: .leading, spacing: 12) {
                Text("Add Replacement Rule")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(.secondary)
                    .textCase(.uppercase)
                    .tracking(0.5)
                
                HStack(spacing: 10) {
                    TextField("Spoken word (e.g. apple)", text: $fromText)
                        .padding(11)
                        .background(Color.white.opacity(0.05))
                        .cornerRadius(10)
                        .foregroundColor(.white)
                        .font(.system(size: 14))
                        .autocorrectionDisabled(true)
                        .textInputAutocapitalization(.never)
                    
                    Image(systemName: "arrow.right")
                        .foregroundColor(.secondary)
                    
                    TextField("Replace with (e.g. Apple)", text: $toText)
                        .padding(11)
                        .background(Color.white.opacity(0.05))
                        .cornerRadius(10)
                        .foregroundColor(.white)
                        .font(.system(size: 14))
                        .autocorrectionDisabled(true)
                }
                
                Button(action: addRule) {
                    Text("Add Replacement")
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
            
            // Rules List
            if state.dictionary.isEmpty {
                VStack(spacing: 12) {
                    Spacer()
                    Image(systemName: "character.book.closed.fill")
                        .font(.system(size: 44))
                        .foregroundColor(.secondary)
                    Text("No dictionary rules yet")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(.secondary)
                    Text("Rules replace specific words in the final output text.")
                        .font(.system(size: 11))
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 40)
                    Spacer()
                }
                .frame(maxHeight: .infinity)
            } else {
                List {
                    ForEach(state.dictionary) { rule in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(rule.from)
                                    .font(.system(size: 15, weight: .bold))
                                    .foregroundColor(.white)
                                Text("Spoken / Transcribed")
                                    .font(.system(size: 10, weight: .semibold))
                                    .foregroundColor(.secondary)
                            }
                            
                            Spacer()
                            Image(systemName: "arrow.right")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            Spacer()
                            
                            VStack(alignment: .trailing, spacing: 2) {
                                Text(rule.to)
                                    .font(.system(size: 15, weight: .bold))
                                    .foregroundColor(Color(red: 224/255, green: 30/255, blue: 65/255))
                                Text("Replaced With")
                                    .font(.system(size: 10, weight: .semibold))
                                    .foregroundColor(.secondary)
                            }
                        }
                        .listRowBackground(Color.white.opacity(0.02))
                    }
                    .onDelete(perform: deleteRules)
                }
                .scrollContentBackground(.hidden)
                .background(Color.clear)
            }
        }
        .navigationTitle("Dictionary Rules")
        .navigationBarTitleDisplayMode(.inline)
        .background(Color.black.ignoresSafeArea())
    }
    
    private func addRule() {
        let from = fromText.trimmingCharacters(in: .whitespacesAndNewlines)
        let to = toText.trimmingCharacters(in: .whitespacesAndNewlines)
        
        guard !from.isEmpty, !to.isEmpty else {
            errorMessage = "Both fields are required."
            return
        }
        
        if state.dictionary.contains(where: { $0.from.lowercased() == from.lowercased() }) {
            errorMessage = "A replacement for '\(from)' already exists."
            return
        }
        
        let newRule = DictionaryRule(from: from, to: to)
        state.dictionary.append(newRule)
        state.saveAll()
        
        fromText = ""
        toText = ""
        errorMessage = ""
    }
    
    private func deleteRules(at offsets: IndexSet) {
        state.dictionary.remove(atOffsets: offsets)
        state.saveAll()
    }
}
