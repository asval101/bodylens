# 校验技术文档 PDF：目录页码是否等于章节实际页面
# 用法：envs/default/Scripts/python.exe .tmpdoc/verify-doc.py
from pypdf import PdfReader
import re, sys

PDF = 'docs/身知BodyLens-技术文档.pdf'
r = PdfReader(PDF)
pages = [(p.extract_text() or '').replace('\n', '') for p in r.pages]
print('页数:', len(pages))

# 章节标题（唯一片段）→ 目录里写的页码
CH = [
    ('摘要', 3),
    ('问题与定位', 4),
    ('技术栈：为什么是原生', 6),
    ('架构与数据流', 9),
    ('数字口径：三条铁律', 12),
    ('意图控制：AI协同怎么做的', 14),
    ('演进时间线', 19),
    ('质量保障', 20),
    ('部署与复现', 23),
    ('已知局限', 25),
    ('附录：PRD验收项与当前实现的偏差', 27),
]

ok = True
for title, want in CH:
    key = re.sub(r'\s+', '', title)
    found = None
    for i, t in enumerate(pages):
        if i == 1:      # 跳过目录页
            continue
        if key in re.sub(r'\s+', '', t):
            found = i + 1
            break
    mark = 'OK ' if found == want else '★错'
    if found != want:
        ok = False
    print('%s %-34s 目录写 %2d  实际 %s' % (mark, title, want, found))

# 顺便查有没有接近空白的页
print('\n每页字符数:')
for i, t in enumerate(pages):
    n = len(re.sub(r'\s+', '', t))
    flag = '  ← 偏空' if n < 300 and i not in (0,) else ''
    print('  p%02d %4d%s' % (i + 1, n, flag))

print('\n结论:', '目录页码全部正确' if ok else '有页码不对，需要重排')
sys.exit(0 if ok else 1)
