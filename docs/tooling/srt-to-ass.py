#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
把 .srt 字幕转成 .ass，套用产品演示段现有的那条样式。

为什么不用现成工具：这条样式（思源/微软雅黑 42px、3.4 描边、MarginV 62）
是照着画面底部留白量出来的，换工具会丢。样式只在下面 STYLE 里写一次。

用法：
    python docs/tooling/srt-to-ass.py <input.srt> <output.ass>

注意：
- srt 里一条字幕内部的换行，在 ass 里必须写成 \\N。WrapStyle=2 不做自动折行，
  直接留换行符会整条不显示。
- 时间从 00:00:12,345 转成 0:00:12.34（ass 的厘秒，两位，四舍五入）。
"""

import re
import sys

STYLE = (
    "Style: Sub,Microsoft YaHei,42,&H001C2621,&H001C2621,&H00FFFFFF,&H40FFFFFF,"
    "-1,0,0,0,100,100,0.6,0,1,3.4,1.4,2,140,140,62,1"
)

HEADER = """[Script Info]
ScriptType: v4.00+
WrapStyle: 2
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
{style}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""


def to_ass_time(stamp: str) -> str:
    """00:00:12,345 -> 0:00:12.34"""
    h, m, rest = stamp.strip().split(":")
    s, ms = rest.split(",")
    centis = int(round(int(ms) / 10.0))
    total = int(h) * 3600 + int(m) * 60 + int(s)
    if centis >= 100:          # 999ms 四舍五入会进位
        total += 1
        centis = 0
    return "%d:%02d:%02d.%02d" % (total // 3600, total % 3600 // 60, total % 60, centis)


def parse_srt(raw: str):
    blocks = re.split(r"\n\s*\n", raw.replace("\r\n", "\n").strip())
    out = []
    for block in blocks:
        lines = [ln for ln in block.split("\n") if ln.strip()]
        if len(lines) < 2:
            continue
        # 第一行可能是序号，也可能直接是时间码
        if "-->" in lines[0]:
            lines = lines
        else:
            lines = lines[1:]
        timecode = lines[0]
        text = lines[1:]
        m = re.match(r"\s*(\d+:\d+:\d+[,.]\d+)\s*-->\s*(\d+:\d+:\d+[,.]\d+)", timecode)
        if not m:
            raise ValueError("看不懂这行时间码：%r" % timecode)
        start, end = m.group(1), m.group(2)
        out.append((to_ass_time(start.replace(".", ",")), to_ass_time(end.replace(".", ",")),
                    "\\N".join(t.strip() for t in text)))
    return out


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    src, dst = sys.argv[1], sys.argv[2]
    with open(src, encoding="utf-8-sig") as f:
        rows = parse_srt(f.read())
    body = "\n".join(
        "Dialogue: 0,%s,%s,Sub,,0,0,0,,%s" % (a, b, t) for a, b, t in rows
    )
    with open(dst, "w", encoding="utf-8") as f:
        f.write(HEADER.format(style=STYLE) + body + "\n")
    print("%d 条字幕 -> %s" % (len(rows), dst))


if __name__ == "__main__":
    main()
