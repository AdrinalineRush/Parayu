#!/usr/bin/env python3
"""Long-lived translation worker for Screenwriting.

Started once by translate.js and kept alive across the whole session so the
IndicTrans2 models are loaded into memory exactly once, instead of being
reloaded from disk on every translated segment. Protocol: one JSON object per
line on stdin -> one JSON object per line on stdout.

Request:  {"id": 1, "text": "...", "sourceLang": "ml", "targetLangs": ["en","ta"]}
Response: {"id": 1, "translations": {"en": "...", "ta": "..."}}
"""
import sys
import json

from translate_text import translate_one


def handle(req):
    translations = {}
    for target in req.get('targetLangs', []):
        try:
            translations[target] = translate_one(req['text'], req['sourceLang'], target)
        except Exception as e:
            translations[target] = ''
            sys.stderr.write(f"translate_worker: failed {req.get('sourceLang')}->{target}: {e}\n")
    return {'id': req.get('id'), 'translations': translations}


def main():
    print('__WORKER_READY__')
    sys.stdout.flush()
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
            result = handle(req)
        except Exception as e:
            result = {'id': None, 'error': str(e)}
        print(json.dumps(result))
        sys.stdout.flush()


if __name__ == '__main__':
    main()
