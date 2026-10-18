"""Read public reference pages during development; no runtime network dependency."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from html.parser import HTMLParser
import urllib.request, json, re, sys

sys.stdout.reconfigure(encoding='utf-8')
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'research'
OUT.mkdir(exist_ok=True)
URLS = {
    'nci-tobacco': 'https://www.cancer.gov/about-cancer/causes-prevention/risk/tobacco/cessation-fact-sheet',
    'who-activity': 'https://www.who.int/news-room/fact-sheets/detail/physical-activity',
    'who-diet': 'https://www.who.int/news-room/fact-sheets/detail/healthy-diet',
    'who-alcohol': 'https://www.who.int/news-room/fact-sheets/detail/alcohol',
    'nhlbi-sleep': 'https://www.nhlbi.nih.gov/health/sleep-deprivation/health-effects',
    'nhs-water': 'https://www.nhs.uk/live-well/eat-well/food-guidelines-and-food-labels/water-drinks-nutrition/',
    'nhs-eyes': 'https://www.nhs.uk/conditions/dry-eyes/',
    'who-oral': 'https://www.who.int/news-room/fact-sheets/detail/oral-health',
    'nhs-hands': 'https://www.nhs.uk/live-well/best-way-to-wash-your-hands/',
    'seer-anatomy': 'https://training.seer.cancer.gov/anatomy/body/',
    'nci-lung': 'https://www.cancer.gov/types/lung',
    'openstax': 'https://openstax.org/books/anatomy-and-physiology-2e/pages/1-2-structural-organization-of-the-human-body',
    'servier': 'https://smart.servier.com/smart_image/digestive-system/',
    'bmj-smoking': 'https://www.bmj.com/content/360/bmj.j5855',
}

class Text(HTMLParser):
    def __init__(self): super().__init__(); self.out=[]; self.skip=0
    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style'): self.skip += 1
    def handle_endtag(self, tag):
        if tag in ('script', 'style'): self.skip = max(0, self.skip-1)
    def handle_data(self, data):
        if not self.skip and data.strip(): self.out.append(data.strip())

def collect(pair):
    key, url = pair
    try:
        req = urllib.request.Request(url, headers={'User-Agent':'Mozilla/5.0 (BodyLens educational project)'})
        data = urllib.request.urlopen(req, timeout=16).read().decode('utf-8')
        parser=Text(); parser.feed(data)
        plain='\n'.join(parser.out)
        (OUT / f'{key}.txt').write_text(url+'\nRetrieved: 2026-10-17\n\n'+plain, encoding='utf-8')
        if key in ('seer-anatomy','nci-lung','openstax','servier'):
            imgs=re.findall(r'(?:src|href)=["\x27]([^"\x27]+(?:png|jpg|jpeg|svg)[^"\x27]*)',data)
            if key=='openstax':
                imgs += re.findall(r'.{0,100}(?:archive|bookId|book-id|contents/).{0,160}',data)[:8]
            return {'key':key,'status':'read','images':[x for x in imgs if not x.startswith('data:')][:20]}
        words=['risk','cancer','salt','sugar','sleep','minutes','tooth','wash','screen','dehydration','20', '25%']
        snippets=[x[:1000] for x in parser.out if len(x)>70 and any(w in x.lower() for w in words)]
        return {'key':key,'status':'read','snippets':snippets[:16]}
    except Exception as exc:
        return {'key':key,'status':'unavailable','reason':str(exc)}

with ThreadPoolExecutor(max_workers=10) as pool:
    results=list(pool.map(collect, URLS.items()))
(OUT / 'retrieval-status.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
for result in results: print(json.dumps(result, ensure_ascii=False))
