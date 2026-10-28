# 生成产品演示段的 ASS 字幕
# ASS 而不是 SRT：能锁字体、锁位置、给描边，浅色页面上深字+白边最清楚
import os

SUBS = [
    (0.8, 5.6,   '这是「身知」。它记的不是卡路里，也不是步数'),
    (5.6, 11.2,  '它是一本账：今天，从你身上拿走了多少时间'),
    (11.2, 16.4, '第一次打开是空的。它写「还没开始」，一个数字都不给'),
    (16.4, 21.8, '不知道你今天做了什么，就没有资格替你编一个数'),
    (21.8, 27.6, '点一下行为，再点一个数量'),
    (27.6, 33.4, '没有「提交」按钮——点了数量，就入账了'),
    (33.4, 38.6, '一支烟二十分钟。这个数是折算出来的'),
    (38.6, 44.0, '不是某份研究里写着的一句话'),
    (44.0, 49.4, '所以旁边那行小字写着：估算值，不是你的个人预测'),
    (49.4, 55.6, '右边这具人体，肺、心、脑、口腔会同时亮'),
    (55.6, 62.0, '点肺部，看它今天和这些行为是什么关系'),
    (62.0, 68.6, '每条结论都带出处，也带「这里还没有数据」'),
    (68.6, 75.0, '往下是「如果一直这样」'),
    (75.0, 81.6, '同一份权重，换一个时间尺度：一周、一个月、一年'),
    (81.6, 88.0, '数字全部在本地算，AI 不参与'),
    (88.0, 94.4, '三十条行为里，只有三条能进这张卡'),
    (94.4, 100.0, '资料库可以搜，也可以点开'),
    (100.0, 105.0, '每张卡片讲的是这个行为本身，不是折算规则'),
    (105.0, 111.5, '今日计划只记一件事'),
    (111.5, 118.5, '今天能做到的最小一步'),
    (118.5, 125.0, '它不是打卡。勾完只代表行动完成，不代表身体恢复'),
    (125.0, 131.0, '记录和备份都在本机，断网也能用'),
    (131.0, 137.0, '这个产品所有的克制，都指向同一件事'),
    (137.0, 145.0, '不让你相信一件不成立的事'),
]

def ts(t):
    h = int(t // 3600); m = int(t % 3600 // 60); s = t % 60
    return '%d:%02d:%05.2f' % (h, m, s)

HEAD = """[Script Info]
ScriptType: v4.00+
WrapStyle: 2
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,Microsoft YaHei,42,&H001C2621,&H001C2621,&H00FFFFFF,&H40FFFFFF,-1,0,0,0,100,100,0.6,0,1,3.4,1.4,2,140,140,62,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

lines = []
for a, b, txt in SUBS:
    lines.append('Dialogue: 0,%s,%s,Sub,,0,0,0,,%s' % (ts(a), ts(b), txt))

out = HEAD + '\n'.join(lines) + '\n'
open('.tmpdoc/sub-product.ass', 'w', encoding='utf-8').write(out)
print('字幕条数', len(SUBS), '时长到', SUBS[-1][1], 's')
