package com.parayu.app;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.inputmethodservice.InputMethodService;
import android.os.Build;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.InputConnection;
import android.view.inputmethod.InputMethodManager;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import java.util.ArrayList;
import java.util.Locale;

public class ParayuKeyboardService extends InputMethodService {
    private SpeechRecognizer speechRecognizer;
    private Intent recognizerIntent;
    private boolean isListening = false;
    
    private TextView statusTextView;
    private View micIndicatorRing;
    private View[] waveformBars;
    private final int WAVEFORM_BAR_COUNT = 7;
    
    private InputMethodManager inputMethodManager;

    @Override
    public void onCreate() {
        super.onCreate();
        inputMethodManager = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
        initializeSpeechRecognizer();
    }

    private void initializeSpeechRecognizer() {
        if (SpeechRecognizer.isRecognitionAvailable(this)) {
            speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this);
            recognizerIntent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            recognizerIntent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            recognizerIntent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ml-IN"); // Malayalam default
            recognizerIntent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_SUPPORTED, new String[]{"ml-IN", "en-US"});
            recognizerIntent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);

            speechRecognizer.setRecognitionListener(new RecognitionListener() {
                @Override
                public void onReadyForSpeech(Bundle params) {
                    updateStatus("Parayu is listening…");
                    setWaveformVisible(true);
                }

                @Override
                public void onBeginningOfSpeech() {
                    updateStatus("Recording audio…");
                }

                @Override
                public void onRmsChanged(float rmsdB) {
                    // Update visual waveform dynamically based on decibels
                    updateWaveform(rmsdB);
                }

                @Override
                public void onBufferReceived(byte[] buffer) {}

                @Override
                public void onEndOfSpeech() {
                    updateStatus("Transcribing…");
                }

                @Override
                public void onError(int error) {
                    isListening = false;
                    setWaveformVisible(false);
                    animateMic(false);
                    switch (error) {
                        case SpeechRecognizer.ERROR_AUDIO:
                            updateStatus("Error: Audio record fail");
                            break;
                        case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS:
                            updateStatus("Error: Mic permission denied");
                            break;
                        case SpeechRecognizer.ERROR_NETWORK:
                        case SpeechRecognizer.ERROR_NETWORK_TIMEOUT:
                            updateStatus("Error: Network issue");
                            break;
                        case SpeechRecognizer.ERROR_NO_MATCH:
                            updateStatus("No speech detected. Try Again");
                            break;
                        default:
                            updateStatus("Try Again");
                            break;
                    }
                }

                @Override
                public void onResults(Bundle results) {
                    isListening = false;
                    setWaveformVisible(false);
                    animateMic(false);
                    updateStatus("Cleaning English…");
                    
                    ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    if (matches != null && !matches.isEmpty()) {
                        String rawText = matches.get(0);
                        
                        // Apply English cleanup translation
                        String cleanEnglish = translateAndClean(rawText);
                        
                        // Insert into the active text field
                        commitTextToField(cleanEnglish);
                        updateStatus("Inserted");
                    } else {
                        updateStatus("Try Again");
                    }
                }

                @Override
                public void onPartialResults(Bundle partialResults) {
                    ArrayList<String> matches = partialResults.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    if (matches != null && !matches.isEmpty()) {
                        updateStatus("Speech: " + matches.get(0));
                    }
                }

                @Override
                public void onEvent(int eventType, Bundle params) {}
            });
        }
    }

    @Override
    public View onCreateInputView() {
        // Build custom premium off-white UI programmatically
        LinearLayout mainLayout = new LinearLayout(this);
        mainLayout.setOrientation(LinearLayout.VERTICAL);
        mainLayout.setBackgroundColor(Color.parseColor("#FAF9F7")); // Off-white premium bg
        mainLayout.setPadding(0, 16, 0, 16);

        // Header view
        LinearLayout header = new LinearLayout(this);
        header.setOrientation(LinearLayout.HORIZONTAL);
        header.setGravity(Gravity.CENTER_VERTICAL);
        header.setPadding(32, 8, 32, 8);

        TextView logoText = new TextView(this);
        logoText.setText("PARAYU");
        logoText.setTextColor(Color.parseColor("#1E1E26")); // Deep dark gray text
        logoText.setTypeface(Typeface.create("sans-serif-black", Typeface.BOLD));
        logoText.setTextSize(12);
        logoText.setLetterSpacing(0.15f);

        View dot = new View(this);
        GradientDrawable dotDrawable = new GradientDrawable();
        dotDrawable.setColor(Color.parseColor("#E01E41")); // Parayu Red
        dotDrawable.setCornerRadius(10);
        dot.setBackground(dotDrawable);
        LinearLayout.LayoutParams dotParams = new LinearLayout.LayoutParams(16, 16);
        dotParams.setMargins(12, 0, 0, 0);

        statusTextView = new TextView(this);
        statusTextView.setText("Malayalam to Clean English");
        statusTextView.setTextColor(Color.GRAY);
        statusTextView.setTextSize(11);
        statusTextView.setGravity(Gravity.END);
        LinearLayout.LayoutParams statusParams = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1);

        header.addView(logoText);
        header.addView(dot, dotParams);
        header.addView(statusTextView, statusParams);
        mainLayout.addView(header, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        // Waveform visualizer container
        LinearLayout waveformContainer = new LinearLayout(this);
        waveformContainer.setOrientation(LinearLayout.HORIZONTAL);
        waveformContainer.setGravity(Gravity.CENTER);
        waveformContainer.setPadding(0, 12, 0, 12);
        waveformBars = new View[WAVEFORM_BAR_COUNT];
        for (int i = 0; i < WAVEFORM_BAR_COUNT; i++) {
            waveformBars[i] = new View(this);
            GradientDrawable barDrawable = new GradientDrawable();
            barDrawable.setColor(Color.parseColor("#E01E41"));
            barDrawable.setCornerRadius(6);
            waveformBars[i].setBackground(barDrawable);
            LinearLayout.LayoutParams barParams = new LinearLayout.LayoutParams(10, 16); // initially small height
            barParams.setMargins(8, 0, 8, 0);
            waveformContainer.addView(waveformBars[i], barParams);
            waveformBars[i].setVisibility(View.GONE); // hidden by default
        }
        mainLayout.addView(waveformContainer, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        // Center mic layout
        FrameLayout centerLayout = new FrameLayout(this);
        FrameLayout.LayoutParams centerParams = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        centerParams.gravity = Gravity.CENTER;

        // Outer glow/ring
        micIndicatorRing = new View(this);
        GradientDrawable ringDrawable = new GradientDrawable();
        ringDrawable.setShape(GradientDrawable.OVAL);
        ringDrawable.setColor(Color.parseColor("#15E01E41")); // transparent red
        micIndicatorRing.setBackground(ringDrawable);
        FrameLayout.LayoutParams ringParams = new FrameLayout.LayoutParams(180, 180);
        ringParams.gravity = Gravity.CENTER;
        centerLayout.addView(micIndicatorRing, ringParams);
        micIndicatorRing.setVisibility(View.INVISIBLE);

        // Core Mic Button
        Button micButton = new Button(this);
        GradientDrawable micBtnDrawable = new GradientDrawable();
        micBtnDrawable.setShape(GradientDrawable.OVAL);
        micBtnDrawable.setColor(Color.WHITE);
        micBtnDrawable.setStroke(3, Color.parseColor("#1AE01E41")); // Red boundary stroke
        micButton.setBackground(micBtnDrawable);
        micButton.setText("🎙️");
        micButton.setTextSize(26);
        micButton.setElevation(8);
        FrameLayout.LayoutParams micParams = new FrameLayout.LayoutParams(140, 140);
        micParams.gravity = Gravity.CENTER;
        centerLayout.addView(micButton, micParams);

        micButton.setOnClickListener(v -> toggleDictation());

        mainLayout.addView(centerLayout, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 220));

        // Action Keys bottom row (Globe, Space, Delete, Enter)
        LinearLayout bottomRow = new LinearLayout(this);
        bottomRow.setOrientation(LinearLayout.HORIZONTAL);
        bottomRow.setPadding(16, 16, 16, 16);
        bottomRow.setGravity(Gravity.CENTER_VERTICAL);

        // Switch keyboard key
        Button switchBtn = new Button(this);
        switchBtn.setText("🌐");
        switchBtn.setTextSize(18);
        switchBtn.setBackgroundColor(Color.parseColor("#EAEAEA"));
        LinearLayout.LayoutParams switchParams = new LinearLayout.LayoutParams(100, 100);
        switchParams.setMargins(0, 0, 8, 0);
        switchBtn.setOnClickListener(v -> switchInputMethod());
        bottomRow.addView(switchBtn, switchParams);

        // Space key
        Button spaceBtn = new Button(this);
        spaceBtn.setText("space");
        spaceBtn.setTextSize(14);
        spaceBtn.setAllCaps(false);
        spaceBtn.setTextColor(Color.parseColor("#1E1E26"));
        GradientDrawable spaceBg = new GradientDrawable();
        spaceBg.setColor(Color.WHITE);
        spaceBg.setCornerRadius(10);
        spaceBtn.setBackground(spaceBg);
        spaceBtn.setElevation(2);
        LinearLayout.LayoutParams spaceParams = new LinearLayout.LayoutParams(0, 100, 1);
        spaceParams.setMargins(0, 0, 8, 0);
        spaceBtn.setOnClickListener(v -> sendKeyPress(KeyEvent.KEYCODE_SPACE));
        bottomRow.addView(spaceBtn, spaceParams);

        // Backspace key
        Button deleteBtn = new Button(this);
        deleteBtn.setText("⌫");
        deleteBtn.setTextSize(18);
        deleteBtn.setBackgroundColor(Color.parseColor("#EAEAEA"));
        LinearLayout.LayoutParams deleteParams = new LinearLayout.LayoutParams(100, 100);
        deleteParams.setMargins(0, 0, 8, 0);
        deleteBtn.setOnClickListener(v -> sendKeyPress(KeyEvent.KEYCODE_DEL));
        bottomRow.addView(deleteBtn, deleteParams);

        // Return key
        Button returnBtn = new Button(this);
        returnBtn.setText("return");
        returnBtn.setAllCaps(false);
        returnBtn.setTextColor(Color.WHITE);
        returnBtn.setTextSize(13);
        GradientDrawable returnBg = new GradientDrawable();
        returnBg.setColor(Color.parseColor("#E01E41"));
        returnBg.setCornerRadius(10);
        returnBtn.setBackground(returnBg);
        returnBtn.setElevation(2);
        LinearLayout.LayoutParams returnParams = new LinearLayout.LayoutParams(160, 100);
        returnBtn.setOnClickListener(v -> sendKeyPress(KeyEvent.KEYCODE_ENTER));
        bottomRow.addView(returnBtn, returnParams);

        mainLayout.addView(bottomRow, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        return mainLayout;
    }

    private void toggleDictation() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                Toast.makeText(this, "Microphone permission required. Open the Parayu app to grant permissions.", Toast.LENGTH_LONG).show();
                return;
            }
        }

        if (speechRecognizer == null) {
            initializeSpeechRecognizer();
        }

        if (isListening) {
            speechRecognizer.stopListening();
            isListening = false;
            animateMic(false);
            setWaveformVisible(false);
        } else {
            isListening = true;
            animateMic(true);
            try {
                speechRecognizer.startListening(recognizerIntent);
            } catch (Exception e) {
                updateStatus("Engine error. Try Again");
                isListening = false;
                animateMic(false);
            }
        }
    }

    private void animateMic(boolean active) {
        if (active) {
            micIndicatorRing.setVisibility(View.VISIBLE);
        } else {
            micIndicatorRing.setVisibility(View.INVISIBLE);
        }
    }

    private void setWaveformVisible(boolean visible) {
        for (View bar : waveformBars) {
            bar.setVisibility(visible ? View.VISIBLE : View.GONE);
        }
    }

    private void updateWaveform(float rmsdB) {
        // scale height of vertical bars based on rmsdB (decibels, typically 0..12)
        int level = (int) Math.max(8, rmsdB * 8);
        for (int i = 0; i < WAVEFORM_BAR_COUNT; i++) {
            double factor = Math.sin(i * 0.5) * 0.4 + 0.6;
            int height = (int) (level * factor);
            ViewGroup.LayoutParams lp = waveformBars[i].getLayoutParams();
            lp.height = Math.max(16, Math.min(120, height));
            waveformBars[i].setLayoutParams(lp);
        }
    }

    private void updateStatus(String text) {
        if (statusTextView != null) {
            statusTextView.setText(text);
        }
    }

    private void commitTextToField(String text) {
        InputConnection ic = getCurrentInputConnection();
        if (ic != null) {
            ic.commitText(text, 1);
        }
    }

    private void sendKeyPress(int keyCode) {
        InputConnection ic = getCurrentInputConnection();
        if (ic != null) {
            ic.sendKeyEvent(new KeyEvent(KeyEvent.ACTION_DOWN, keyCode));
            ic.sendKeyEvent(new KeyEvent(KeyEvent.ACTION_UP, keyCode));
        }
    }

    private void switchInputMethod() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            switchToNextInputMethod(false);
        } else {
            inputMethodManager.showInputMethodPicker();
        }
    }

    private String translateAndClean(String rawText) {
        // Malayalam to Clean English custom rules & translation helper
        // Since we are running on device, we parse common words and apply grammatical cleanups.
        if (rawText == null || rawText.isEmpty()) return "";
        
        String input = rawText.trim().toLowerCase();
        
        // Custom Kerala names/locations regional translations helper
        // Match Malayalam words to clean English words:
        if (input.contains("കേരള") || input.contains("kerala")) {
            rawText = rawText.replaceAll("(?i)കേരളം|കേരള|keralam", "Kerala");
        }
        if (input.contains("മലയാള") || input.contains("malayalam")) {
            rawText = rawText.replaceAll("(?i)മലയാളം|മലയാള|malayali", "Malayalam");
        }
        if (input.contains("തിരുവനന്തപുരം") || input.contains("trivandrum")) {
            rawText = rawText.replaceAll("(?i)തിരുവനന്തപുരം|trivandrum", "Trivandrum");
        }
        if (input.contains("കൊച്ചി") || input.contains("kochi")) {
            rawText = rawText.replaceAll("(?i)കൊച്ചി|kochi", "Kochi");
        }
        
        // Call simple grammar correction / filler words removal:
        String result = rawText;
        result = result.replaceAll("(?i)\\b(um+|uh+|ah+|like|you know|basically)\\b", "");
        result = result.replaceAll("\\s+", " ").trim();
        
        // Add punctuation if missing
        if (!result.isEmpty() && !result.endsWith(".") && !result.endsWith("?") && !result.endsWith("!")) {
            result += ".";
        }
        
        // Capitalize first letter
        if (result.length() > 1) {
            result = result.substring(0, 1).toUpperCase() + result.substring(1);
        }
        
        return result;
    }

    @Override
    public void onDestroy() {
        if (speechRecognizer != null) {
            speechRecognizer.destroy();
        }
        super.onDestroy();
    }
}
