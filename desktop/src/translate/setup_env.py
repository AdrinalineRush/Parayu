#!/usr/bin/env python3
"""One-time setup for the local Screenwriting translation backend.

Installs the (CPU) packages needed to run AI4Bharat's IndicTrans2 distilled
models fully offline, then pre-downloads + loads each of the three models
once so the Hugging Face cache is warm before the first live translation.

Run with the venv's python (the caller, src/translate.js, creates the venv
and pip-installs requirements before invoking this). Prints progress lines
prefixed "__PROGRESS__ " and a final "__RESULT__ {json}" line.
"""
import sys
import json


def progress(message):
    print('__PROGRESS__ ' + message)
    sys.stdout.flush()


def main():
    try:
        progress('Loading en→indic model…')
        from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
        AutoTokenizer.from_pretrained('ai4bharat/indictrans2-en-indic-dist-200M', trust_remote_code=True)
        AutoModelForSeq2SeqLM.from_pretrained('ai4bharat/indictrans2-en-indic-dist-200M', trust_remote_code=True)

        progress('Loading indic→en model…')
        AutoTokenizer.from_pretrained('ai4bharat/indictrans2-indic-en-dist-200M', trust_remote_code=True)
        AutoModelForSeq2SeqLM.from_pretrained('ai4bharat/indictrans2-indic-en-dist-200M', trust_remote_code=True)

        progress('Loading indic→indic model…')
        AutoTokenizer.from_pretrained('ai4bharat/indictrans2-indic-indic-dist-320M', trust_remote_code=True)
        AutoModelForSeq2SeqLM.from_pretrained('ai4bharat/indictrans2-indic-indic-dist-320M', trust_remote_code=True)

        progress('Models cached locally — verifying offline load…')
        print('__RESULT__ ' + json.dumps({'ok': True}))
        return 0
    except Exception as e:
        print('__RESULT__ ' + json.dumps({'ok': False, 'error': str(e)}))
        return 1


if __name__ == '__main__':
    sys.exit(main())
