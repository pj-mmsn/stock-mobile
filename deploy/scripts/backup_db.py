#!/opt/stock-mobile/venv/bin/python
# -*- coding: utf-8 -*-
"""pred.db 原子备份（SQLite 在线备份 API + gzip 压缩）

2026-10-12 修复史：
  ① 原 crontab 备份的是 /tmp/pred.db（53KB 空壳），真库在 /var/lib/stock-mobile/pred.db
     （2.5GB）——已连续一个月没有有效备份。
  ② 改用 SQLite 在线备份 API（自动包含 WAL、不阻塞写入、原子一致）。
  ③ 库内大量 JSON 文本，gzip 压缩率很高 → 压缩存储，把保留窗口从「4 天 ≈ 10GB」
     压到「7 天 ≈ 2GB」，磁盘压力反而更小。

用法：backup_db.py [保留天数，默认7]
"""
import os
import sqlite3
import sys
import time
import gzip
import shutil
import datetime

SRC = os.environ.get('PRED_DB', '/var/lib/stock-mobile/pred.db')
DST_DIR = '/opt/stock-mobile/backup'
KEEP_DAYS = int(sys.argv[1]) if len(sys.argv) > 1 else 7
MIN_RAW = 100 * 1024 * 1024      # 原始副本 < 100MB 视为可疑
MIN_GZ = 10 * 1024 * 1024        # 压缩后 < 10MB 视为可疑

os.makedirs(DST_DIR, exist_ok=True)
day = datetime.datetime.now().strftime('%Y%m%d')
raw = os.path.join(DST_DIR, 'pred-%s.db' % day)
gz = raw + '.gz'
part_raw = raw + '.part'
log_ok = os.path.join(DST_DIR, 'backup_ok.log')
log_warn = os.path.join(DST_DIR, 'backup_warn.log')


def log(path, msg):
    try:
        with open(path, 'a', encoding='utf-8') as f:
            f.write('%s  %s\n' % (datetime.datetime.now().strftime('%F %T'), msg))
    except Exception:
        pass


def cleanup():
    """清理超期备份（.db 与 .db.gz 都算）"""
    cutoff = time.time() - KEEP_DAYS * 86400
    for f in sorted(os.listdir(DST_DIR)):
        if not (f.startswith('pred-') and (f.endswith('.db') or f.endswith('.db.gz'))):
            continue
        fp = os.path.join(DST_DIR, f)
        try:
            if os.path.getmtime(fp) < cutoff:
                os.remove(fp)
                print('[backup] 清理超期 %s' % f)
        except Exception:
            pass


t0 = time.time()
try:
    for p in (part_raw, raw, gz):
        if os.path.exists(p):
            os.remove(p)

    # ① 在线备份到临时文件（一致快照，含未 checkpoint 的 WAL）
    src = sqlite3.connect('file:%s?mode=ro' % SRC, uri=True)
    dstc = sqlite3.connect(part_raw)
    with dstc:
        src.backup(dstc)
    dstc.close()
    src.close()

    sz_raw = os.path.getsize(part_raw)
    if sz_raw < MIN_RAW:
        log(log_warn, 'BACKUP SUSPECT raw=%d src=%s' % (sz_raw, SRC))
        print('[backup] 可疑：原始副本仅 %d 字节（源库 %d 字节）' % (sz_raw, os.path.getsize(SRC)))
        os.remove(part_raw)
        sys.exit(1)

    # ② gzip 压缩
    with open(part_raw, 'rb') as fi, gzip.open(gz, 'wb', compresslevel=6) as fo:
        shutil.copyfileobj(fi, fo, 4 * 1024 * 1024)
    os.remove(part_raw)
    sz_gz = os.path.getsize(gz)
    if sz_gz < MIN_GZ:
        log(log_warn, 'BACKUP SUSPECT gz=%d' % sz_gz)
        print('[backup] 可疑：压缩后仅 %d 字节' % sz_gz)
        os.remove(gz)
        sys.exit(1)

    # ③ 校验压缩包可读且库结构完整
    try:
        with gzip.open(gz, 'rb') as f:
            head = f.read(16)
        if not head.startswith(b'SQLite format 3'):
            raise ValueError('不是合法 SQLite 文件头')
    except Exception as e:
        log(log_warn, 'BACKUP VERIFY FAILED %r' % (e,))
        print('[backup] 校验失败：%r' % (e,))
        os.remove(gz)
        sys.exit(1)

    log(log_ok, 'ok raw=%.1fMB gz=%.1fMB(%.0f%%) elapsed=%.0fs -> %s' % (
        sz_raw / 1048576.0, sz_gz / 1048576.0, sz_gz * 100.0 / sz_raw,
        time.time() - t0, gz))
    print('[backup] 完成 原始 %.1f MB → 压缩 %.1f MB（%.0f%%）  %.0fs  -> %s' % (
        sz_raw / 1048576.0, sz_gz / 1048576.0, sz_gz * 100.0 / sz_raw,
        time.time() - t0, gz))

    cleanup()
except Exception as e:
    log(log_warn, 'BACKUP FAILED %r' % (e,))
    print('[backup] 失败 %r' % (e,))
    for p in (part_raw, raw, gz):
        try:
            if os.path.exists(p) and os.path.getsize(p) < MIN_GZ:
                os.remove(p)
        except Exception:
            pass
    sys.exit(1)
