#!/opt/stock-mobile/venv/bin/python
# -*- coding: utf-8 -*-
"""pred.db 原子备份（SQLite 在线备份 API，自动处理 WAL，不阻塞写入）
2026-10-12 修复：原 crontab 备份的是 /tmp/pred.db（53KB 空壳），
真实主库在 /var/lib/stock-mobile/pred.db（2.5GB）——已连续一个月没有有效备份。
用法：backup_db.py [保留天数，默认4]
"""
import os
import sqlite3
import sys
import time
import datetime

SRC = os.environ.get('PRED_DB', '/var/lib/stock-mobile/pred.db')
DST_DIR = '/opt/stock-mobile/backup'
KEEP_DAYS = int(sys.argv[1]) if len(sys.argv) > 1 else 4
MIN_OK = 100 * 1024 * 1024  # 小于 100MB 视为可疑

os.makedirs(DST_DIR, exist_ok=True)
day = datetime.datetime.now().strftime('%Y%m%d')
dst = os.path.join(DST_DIR, 'pred-%s.db' % day)
tmp = dst + '.part'
log_ok = os.path.join(DST_DIR, 'backup_ok.log')
log_warn = os.path.join(DST_DIR, 'backup_warn.log')


def log(path, msg):
    with open(path, 'a', encoding='utf-8') as f:
        f.write('%s  %s\n' % (datetime.datetime.now().strftime('%F %T'), msg))


t0 = time.time()
try:
    for p in (tmp,):
        if os.path.exists(p):
            os.remove(p)
    src = sqlite3.connect('file:%s?mode=ro' % SRC, uri=True)
    dstc = sqlite3.connect(tmp)
    with dstc:
        src.backup(dstc)          # SQLite 在线备份：一致快照，自动包含 WAL 内容
    dstc.close()
    src.close()
    sz = os.path.getsize(tmp)
    if sz < MIN_OK:
        log(log_warn, 'BACKUP SUSPECT size=%d src=%s' % (sz, SRC))
        print('[backup] 可疑：仅 %d 字节（源库 %d 字节）' % (sz, os.path.getsize(SRC)))
        os.remove(tmp)
        sys.exit(1)
    os.replace(tmp, dst)
    log(log_ok, 'ok size=%d elapsed=%.0fs -> %s' % (sz, time.time() - t0, dst))
    print('[backup] 完成 %.1f MB  %.0fs  -> %s' % (sz / 1048576.0, time.time() - t0, dst))

    # 清理超期备份
    cutoff = time.time() - KEEP_DAYS * 86400
    for f in os.listdir(DST_DIR):
        if f.startswith('pred-') and f.endswith('.db'):
            fp = os.path.join(DST_DIR, f)
            try:
                if os.path.getmtime(fp) < cutoff:
                    os.remove(fp)
                    print('[backup] 清理超期 %s' % f)
            except Exception:
                pass
except Exception as e:
    log(log_warn, 'BACKUP FAILED %r' % (e,))
    print('[backup] 失败 %r' % (e,))
    if os.path.exists(tmp):
        try:
            os.remove(tmp)
        except Exception:
            pass
    sys.exit(1)
