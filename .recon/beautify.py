#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Beautify the giant render line: split on top-level commas, track parens for indentation."""
import re, sys

def beautify(src: str) -> str:
    out = []
    depth = 0
    i = 0
    n = len(src)
    in_str = None
    cur = []
    def flush():
        nonlocal cur
        s = ''.join(cur).strip()
        cur = []
        if s:
            out.append('  ' * depth + s)
    while i < n:
        ch = src[i]
        if in_str:
            cur.append(ch)
            if ch == '\\' and i + 1 < n:
                cur.append(src[i+1]); i += 2; continue
            if ch == in_str:
                in_str = None
            i += 1
            continue
        if ch in ('"', "'", '`'):
            in_str = ch
            cur.append(ch)
            i += 1
            continue
        if ch == '(':
            depth += 1
            cur.append(ch)
            i += 1
            continue
        if ch == ')':
            # flush current content before closing paren
            depth -= 1
            flush()
            out.append('  ' * depth + ')')
            i += 1
            continue
        if ch == ',':
            flush()
            i += 1
            continue
        cur.append(ch)
        i += 1
    flush()
    return '\n'.join(out)

if __name__ == '__main__':
    src = open(sys.argv[1], encoding='utf-8').read()
    print(beautify(src))
