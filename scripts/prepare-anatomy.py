"""Migrate and refine the existing editable anatomy artwork; no image API calls."""
from pathlib import Path
import re, random

root = Path(__file__).resolve().parents[1]
source = root / 'artwork' / 'anatomy-base.js'
text = source.read_text(encoding='utf-8')
start = text.index('  function svgAnatomy(uid) {')
end = len(text)
art = text[start:end].replace('function svgAnatomy(uid)', 'window.createAnatomy = function (uid)')
art = art.replace('class="organ cursor-interaction"', 'class="organ"')
art = art.replace("[[0,'#344d58'],[.27,'#718780'],[.5,'#adb5a1'],[.75,'#647c78'],[1,'#2b4552']]", "[[0,'#4d4239'],[.14,'#887361'],[.32,'#c0a48a'],[.5,'#d4bba0'],[.67,'#baa08a'],[.86,'#75685a'],[1,'#3a3d35']]")
art = art.replace("[[0,'#405c66'],[.4,'#8e9c90'],[.65,'#a5ada0'],[1,'#344e5c']]", "[[0,'#4c423a'],[.2,'#9c806b'],[.42,'#cfb397'],[.55,'#d9c1a4'],[.73,'#b99c81'],[1,'#515347']]")
art = art.replace("[[0,'#824d59'],[.32,'#da9696'],[.56,'#e9b5a5'],[.8,'#bf7c85'],[1,'#71424e']]", "[[0,'#693f48'],[.18,'#a2676b'],[.36,'#d19991'],[.52,'#e2b4a2'],[.69,'#c48b83'],[.87,'#946069'],[1,'#543640']]")
art = art.replace('stroke="#8ba7aa" stroke-opacity=".45"', 'stroke="#b4baa1" stroke-opacity=".28"')
art = art.replace('fill="${shade(\'halo\')}"', 'fill="${shade(\'halo\')}" opacity=".3"')
defs = '''
        <radialGradient id="${uid}-soft"><stop offset="0" stop-color="#ffddba" stop-opacity=".15"/><stop offset=".6" stop-color="#a8b79a" stop-opacity=".02"/><stop offset="1" stop-color="#09150f" stop-opacity=".2"/></radialGradient>
        <pattern id="${uid}-tissue" width="5" height="7" patternUnits="userSpaceOnUse"><path d="M0 2q2 2 5 0M1 5q1-1 4 0" fill="none" stroke="#f2c9b3" stroke-width=".22" opacity=".35"/><circle cx="2" cy="4" r=".25" fill="#3a1c2d" opacity=".4"/></pattern>
        <filter id="${uid}-organic" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".45" numOctaves="3" seed="5" result="grain"/><feColorMatrix in="grain" type="saturate" values="0"/><feComposite in2="SourceAlpha" operator="in" result="texture"/><feBlend in="SourceGraphic" in2="texture" mode="soft-light"/></filter>
        <clipPath id="${uid}-lung-clip"><path d="M193 153C183 147 173 155 167 169Q154 188 154 211Q153 232 160 246Q176 250 192 238L194 203Z M207 153C217 147 227 155 233 169Q246 188 246 211Q247 232 240 246Q225 248 216 240Q206 229 210 217Q200 206 206 194Z"/></clipPath>
'''
art = art.replace('      </defs>', defs+'      </defs>')
random.seed(14)
vessels=[]
for side in (-1,1):
    for i in range(30):
        y=156+i*2.75
        x=200+side*(8+(i%4)*2.3)
        ex=200+side*(20+random.random()*30)
        ey=y+10+random.random()*20
        vessels.append(f'<path d="M{x:.1f} {y:.1f}Q{(x+ex)/2:.1f} {y-3:.1f} {ex:.1f} {ey:.1f}m-2-3 4-2"/>')
lung_add = '<g class="organ" data-organ="lungs"><g clip-path="url(#${uid}-lung-clip)" fill="none" stroke="#755258" stroke-width=".36" opacity=".48">'+''.join(vessels)+'</g><path d="M155 153H247V247H155Z" clip-path="url(#${uid}-lung-clip)" fill="url(#${uid}-tissue)"/><image href="assets/lung-texture.webp" x="152" y="150" width="96" height="98" preserveAspectRatio="none" clip-path="url(#${uid}-lung-clip)" opacity=".30"/></g>'
art = art.replace('      <g class="organ" data-organ="heart"', lung_add+'\n      <g class="organ" data-organ="heart"')
# A thin epidermal opening and face contours keep the head recognizably human.
face='''
      <g class="face-contours" fill="none" stroke-linecap="round">
        <path d="M172 66Q165 57 169 75L174 83M228 66Q235 57 231 75L226 83" stroke="#aa8e73" stroke-width="2"/>
        <path d="M197 86L194 94Q201 98 205 94L203 86M178 88Q182 92 189 89M211 89Q218 92 222 88" stroke="#8c7663" stroke-width=".7"/>
        <path d="M178 95Q181 106 192 109M222 95Q219 106 208 109" stroke="#e0c3a1" stroke-width=".7" opacity=".4"/>
      </g>
'''
art = art.replace('      <g class="organ" data-organ="kidneys"', face+'      <g class="organ" data-organ="kidneys"')
back = '''
      <g class="posterior-structures" display="none">
        <path d="M169 150Q147 164 154 197L179 220Q192 198 190 164Z M231 150Q253 164 246 197L221 220Q208 198 210 164Z" fill="${shade('muscle')}" stroke="#bec5aa" stroke-opacity=".4" stroke-width=".7"/>
        <path d="M165 224Q178 234 189 235M162 235Q179 246 189 247M163 248Q179 258 189 259M235 224Q222 234 211 235M238 235Q221 246 211 247M237 248Q221 258 211 259" fill="none" stroke="#b8bf9d" stroke-opacity=".3" stroke-width="2"/>
      </g>
'''
art = art.replace('      <g class="organ" data-organ="spine"',back+'      <g class="organ" data-organ="spine"')
art = art.replace('    </svg>`;', '''      <g class="impact-animation" aria-hidden="true" display="none"><path class="path-trace" d="M200 113L200 170L176 194M200 170L224 194" fill="none" stroke="#dcbea0" stroke-width="1.7"/><circle class="path-marker" cx="178" cy="205" r="18" fill="none" stroke="#e2bb91" stroke-width=".8"/></g>
    </svg>`;''')
art = art.replace('      <g fill="none" stroke="#5e9caa"', '<g class="organ" data-organ="gut"><image href="assets/gut-texture.png" x="157" y="321" width="85" height="69" preserveAspectRatio="none" opacity=".9"/></g>\n      <g fill="none" stroke="#5e9caa"')
(root/'anatomy.js').write_text("/* Refined from this project's original editable SVG anatomy. */\n"+art,encoding='utf-8')
print('anatomy.js written')
