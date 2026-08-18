#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Greedy-line beautifier v2: keep fn( together, fill lines to ~110 chars."""
import re, sys

def tokenize(src: str):
    toks = []
    i, n = 0, len(src)
    while i < n:
        ch = src[i]
        if ch in ' \t\r\n':
            i += 1; continue
        if ch in '()[],':
            toks.append(ch); i += 1; continue
        if ch in ('"', "'", '`'):
            j = i + 1
            while j < n:
                if src[j] == '\\':
                    j += 2; continue
                if src[j] == ch: break
                j += 1
            toks.append(src[i:j+1]); i = j + 1; continue
        j = i
        while j < n and src[j] not in ' \t\r\n()[],"\'`':
            j += 1
        toks.append(src[i:j]); i = j
    return toks

def beautify(src: str, width: int = 115) -> str:
    toks = tokenize(src)
    out = []
    depth = 0
    cur = ''
    def flush():
        nonlocal cur
        if cur:
            out.append('  ' * depth + cur)
            cur = ''
    for t in toks:
        if t == '(':
            # attach directly if cur is a bare identifier (fn name) or already '('/'['
            last = cur[-1] if cur else ''
            if cur and not (last.isalnum() or last in '_$([,'):
                flush()
            cur += '('
            depth += 1
            continue
        if t == ')':
            depth = max(0, depth - 1)
            flush()
            if out and len(out[-1]) + 2 <= width:
                out[-1] += ')'
            else:
                out.append('  ' * depth + ')')
            continue
        if t == ',':
            cur += ','
            flush()
            continue
        if t == '[':
            if cur:
                flush()
            cur += '['
            continue
        if t == ']':
            flush()
            out.append('  ' * depth + ']')
            continue
        # normal token
        if cur and cur[-1] == '[':
            cur += t
            continue
        if cur and len(cur) + len(t) + 1 > width and cur.count('(') <= cur.count(')'):
            flush()
        cur += ('' if not cur or cur[-1] in '(,' or cur[-1] in '.:?=!<>+-*/%&|' else ' ') + t
    flush()
    return '\n'.join(out)

if __name__ == '__main__':
    src = open(sys.argv[1], encoding='utf-8').read()
    print(beautify(src))
