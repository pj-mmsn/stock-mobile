#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import re, sys

def dec_unicode(src: str) -> str:
    # decode \u{XXXXX} and \uXXXX sequences to chars
    def repl(m):
        h = m.group(0)[2:]
        h = h.replace('{', '').replace('}', '')
        return chr(int(h, 16))
    return re.sub(r'\\u\{[0-9a-fA-F]+\}|\\u[0-9a-fA-F]{4}', repl, src)

if __name__ == '__main__':
    src = open(sys.argv[1], encoding='utf-8').read()
    open(sys.argv[2], 'w', encoding='utf-8').write(dec_unicode(src))
    print('ok', len(src))
