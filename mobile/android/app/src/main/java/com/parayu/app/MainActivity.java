package com.parayu.app;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.provider.Settings;
import android.speech.RecognizerIntent;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.InputMethodManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import java.util.ArrayList;
import java.util.Locale;

public class MainActivity extends Activity {
    private static final int REQUEST_RECORD_AUDIO = 1001;
    private static final int REQUEST_SPEECH = 1002;

    private TextView resultView;
    private String latestText = "";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        buildUi();
    }

    private void buildUi() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER_HORIZONTAL);
        root.setPadding(32, 48, 32, 32);
        root.setBackgroundColor(Color.rgb(8, 8, 11)); // Deep dark theme matching desktop/iOS

        // Logo Header
        TextView title = new TextView(this);
        title.setText("Parayu");
        title.setTextColor(Color.WHITE);
        title.setTextSize(36);
        title.setTypeface(Typeface.create("sans-serif-black", Typeface.BOLD));
        title.setGravity(Gravity.CENTER);
        root.addView(title, fullWidth());

        TextView subtitle = new TextView(this);
        subtitle.setText("Malayalam Speech to English");
        subtitle.setTextColor(Color.rgb(224, 30, 65)); // Parayu Red
        subtitle.setTypeface(Typeface.DEFAULT_BOLD);
        subtitle.setTextSize(15);
        subtitle.setGravity(Gravity.CENTER);
        root.addView(subtitle, fullWidth());

        // Keyboard Setup Card
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(24, 24, 24, 24);
        GradientDrawable cardBg = new GradientDrawable();
        cardBg.setColor(Color.rgb(24, 24, 30));
        cardBg.setCornerRadius(18);
        cardBg.setStroke(1, Color.rgb(44, 44, 50));
        card.setBackground(cardBg);

        TextView cardTitle = new TextView(this);
        cardTitle.setText("Keyboard Setup Flow");
        cardTitle.setTextColor(Color.WHITE);
        cardTitle.setTextSize(16);
        cardTitle.setTypeface(Typeface.DEFAULT_BOLD);
        cardTitle.setPadding(0, 0, 0, 16);
        card.addView(cardTitle);

        card.addView(stepView("1.", "Tap Enable Keyboard and turn on Parayu Keyboard"));
        card.addView(stepView("2.", "Tap Select Input Method and select Parayu Keyboard"));
        card.addView(stepView("3.", "Open any app (WhatsApp, Notes) and start dictating"));

        LinearLayout.LayoutParams cardParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        cardParams.setMargins(0, 24, 0, 24);
        root.addView(card, cardParams);

        // Buttons
        Button enableBtn = button("Enable Parayu Keyboard");
        enableBtn.setOnClickListener(v -> openKeyboardSettings());
        root.addView(enableBtn, fullWidth());

        Button switchBtn = button("Select Input Method");
        switchBtn.setOnClickListener(v -> showKeyboardPicker());
        root.addView(switchBtn, fullWidth());

        // Test Voice Dictation Area
        TextView testHeader = new TextView(this);
        testHeader.setText("Standard Dictation Test");
        testHeader.setTextColor(Color.rgb(160, 160, 170));
        testHeader.setTextSize(12);
        testHeader.setTypeface(Typeface.DEFAULT_BOLD);
        LinearLayout.LayoutParams testParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        testParams.setMargins(0, 16, 0, 8);
        root.addView(testHeader, testParams);

        resultView = new TextView(this);
        resultView.setText("Tap dictation test to test speech transcribing.");
        resultView.setTextColor(Color.rgb(174, 182, 204));
        resultView.setTextSize(14);
        resultView.setPadding(16, 16, 16, 16);

        ScrollView scrollView = new ScrollView(this);
        scrollView.setBackgroundColor(Color.rgb(18, 18, 22));
        scrollView.addView(resultView);
        LinearLayout.LayoutParams resultParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                0,
                1
        );
        resultParams.setMargins(0, 4, 0, 16);
        root.addView(scrollView, resultParams);

        Button testMicBtn = button("Voice Dictation Test");
        testMicBtn.setOnClickListener(v -> startVoiceInput());
        root.addView(testMicBtn, fullWidth());

        setContentView(root);
    }

    private View stepView(String number, String description) {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setPadding(0, 4, 0, 8);

        TextView numTv = new TextView(this);
        numTv.setText(number + " ");
        numTv.setTextColor(Color.rgb(224, 30, 65));
        numTv.setTypeface(Typeface.DEFAULT_BOLD);
        numTv.setTextSize(14);

        TextView descTv = new TextView(this);
        descTv.setText(description);
        descTv.setTextColor(Color.rgb(174, 182, 204));
        descTv.setTextSize(14);

        row.addView(numTv);
        row.addView(descTv);
        return row;
    }

    private Button button(String text) {
        Button button = new Button(this);
        button.setText(text);
        button.setTextColor(Color.WHITE);
        button.setTextSize(14);
        button.setAllCaps(false);
        GradientDrawable btnBg = new GradientDrawable();
        btnBg.setColor(Color.rgb(224, 30, 65));
        btnBg.setCornerRadius(12);
        button.setBackground(btnBg);
        return button;
    }

    private LinearLayout.LayoutParams fullWidth() {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
        params.setMargins(0, 6, 0, 6);
        return params;
    }

    private void openKeyboardSettings() {
        Intent intent = new Intent(Settings.ACTION_INPUT_METHOD_SETTINGS);
        try {
            startActivity(intent);
        } catch (Exception e) {
            Toast.makeText(this, "Could not open system settings.", Toast.LENGTH_SHORT).show();
        }
    }

    private void showKeyboardPicker() {
        InputMethodManager im = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
        if (im != null) {
            im.showInputMethodPicker();
        }
    }

    private void startVoiceInput() {
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, REQUEST_RECORD_AUDIO);
            return;
        }

        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ml-IN"); // Malayalam transcription test
        intent.putExtra(RecognizerIntent.EXTRA_PROMPT, "Speak Malayalam or English naturally");

        try {
            startActivityForResult(intent, REQUEST_SPEECH);
        } catch (ActivityNotFoundException error) {
            Toast.makeText(this, "No speech recognizer is available on this device.", Toast.LENGTH_LONG).show();
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQUEST_RECORD_AUDIO && grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            startVoiceInput();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQUEST_SPEECH && resultCode == RESULT_OK && data != null) {
            ArrayList<String> matches = data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
            if (matches != null && !matches.isEmpty()) {
                latestText = matches.get(0);
                resultView.setText("Raw Transcript: " + latestText);
            }
        }
    }
}
