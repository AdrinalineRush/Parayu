#!/usr/bin/env python3
"""Translate one piece of text into one or more target languages using the
local IndicTrans2 distilled models (AI4Bharat). Fully offline once the models
are cached by setup_env.py — no network calls, no cloud API.

Usage: python translate_text.py '{"text": "...", "sourceLang": "ml", "targetLangs": ["en","ta","kn","hi"]}'
Prints one line: "__RESULT__ {json}"
"""
import sys
import json

# IndicTrans2 uses FLORES-200 style language tags.
FLORES = {
    'en': 'eng_Latn',
    'ml': 'mal_Mlym',
    'ta': 'tam_Taml',
    'kn': 'kan_Knda',
    'hi': 'hin_Deva',
}

EN_INDIC_MODEL = 'ai4bharat/indictrans2-en-indic-dist-200M'
INDIC_EN_MODEL = 'ai4bharat/indictrans2-indic-en-dist-200M'
INDIC_INDIC_MODEL = 'ai4bharat/indictrans2-indic-indic-dist-320M'

_loaded = {}


def model_for(source, target):
    if source == 'en':
        return EN_INDIC_MODEL
    if target == 'en':
        return INDIC_EN_MODEL
    return INDIC_INDIC_MODEL


def get_pipeline(model_name):
    if model_name in _loaded:
        return _loaded[model_name]
    import torch
    from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
    from IndicTransToolkit.processor import IndicProcessor

    tokenizer = AutoTokenizer.from_pretrained(model_name, trust_remote_code=True, local_files_only=True)
    model = AutoModelForSeq2SeqLM.from_pretrained(model_name, trust_remote_code=True, local_files_only=True)
    model.eval()
    processor = IndicProcessor(inference=True)
    _loaded[model_name] = (tokenizer, model, processor, torch)
    return _loaded[model_name]


def translate_one(text, source, target):
    if source == target:
        return text
    model_name = model_for(source, target)
    tokenizer, model, processor, torch = get_pipeline(model_name)
    src_tag, tgt_tag = FLORES[source], FLORES[target]
    batch = processor.preprocess_batch([text], src_lang=src_tag, tgt_lang=tgt_tag)
    inputs = tokenizer(batch, padding='longest', truncation=True, max_length=256, return_tensors='pt')
    with torch.no_grad():
        generated = model.generate(
            **inputs, use_cache=True, min_length=0, max_length=256,
            num_beams=5, num_return_sequences=1
        )
    decoded = tokenizer.batch_decode(generated, skip_special_tokens=True, clean_up_tokenization_spaces=True)
    out = processor.postprocess_batch(decoded, lang=tgt_tag)
    return out[0] if out else text


def main():
    payload = json.loads(sys.argv[1])
    text = payload['text']
    source = payload['sourceLang']
    targets = payload['targetLangs']

    translations = {}
    for t in targets:
        try:
            translations[t] = translate_one(text, source, t)
        except Exception as e:
            translations[t] = ''
            sys.stderr.write(f"translate_text: failed {source}->{t}: {e}\n")

    print('__RESULT__ ' + json.dumps({'translations': translations}))
    return 0


if __name__ == '__main__':
    sys.exit(main())
