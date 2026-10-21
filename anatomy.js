/* Refined from this project's original editable SVG anatomy. */
  window.createAnatomy = function (uid) {
    const gradient=(name,stops)=>`<linearGradient id="${uid}-${name}" x1="0" y1="0" x2="1" y2=".55">${stops.map(([offset,color])=>`<stop offset="${offset}" stop-color="${color}"/>`).join('')}</linearGradient>`;
    const shade=name=>`url(#${uid}-${name})`;
    const lines=(paths,color,width=1)=>paths.map(d=>`<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`).join('');
    return `<svg class="human" viewBox="0 0 400 660" role="img" aria-label="分层解剖人体插画：器官按相对解剖位置排列，选择器官按钮可查看影响">
      <defs>
        ${gradient('skin',[[0,'#222626'],[.14,'#3b4343'],[.32,'#4f6363'],[.5,'#577171'],[.67,'#4f6060'],[.86,'#353b3b'],[1,'#1e201f']])}
        ${gradient('muscle',[[0,'#222626'],[.2,'#424c4c'],[.42,'#546d6d'],[.55,'#597474'],[.73,'#4c5e5e'],[1,'#282b29']])}
        ${gradient('cavity',[[0,'#141416'],[.45,'#343c3a'],[.7,'#2a2d2d'],[1,'#131819']])}
        ${gradient('brain',[[0,'#9e656b'],[.3,'#e5b0a1'],[.65,'#c58b87'],[1,'#79535c']])}
        ${gradient('lungs',[[0,'#693f48'],[.18,'#a2676b'],[.36,'#d19991'],[.52,'#e2b4a2'],[.69,'#c48b83'],[.87,'#946069'],[1,'#543640']])}
        ${gradient('heart',[[0,'#632f3b'],[.3,'#b45e61'],[.5,'#d08776'],[.8,'#93434e'],[1,'#4d2838']])}
        ${gradient('liver',[[0,'#512c35'],[.27,'#8e4b4d'],[.48,'#b36d61'],[.76,'#754048'],[1,'#442631']])}
        ${gradient('stomach',[[0,'#a36a6b'],[.35,'#e6afa0'],[.6,'#eec0a9'],[.8,'#c7877e'],[1,'#956064']])}
        ${gradient('kidneys',[[0,'#5c2e3b'],[.35,'#b76a62'],[.57,'#cc8e78'],[.84,'#914b50'],[1,'#542b39']])}
        ${gradient('gut',[[0,'#9e6f6b'],[.25,'#dab29a'],[.5,'#edc7a7'],[.8,'#c28e7b'],[1,'#986568']])}
        <radialGradient id="${uid}-halo"><stop stop-color="#33b4cc" stop-opacity=".19"/><stop offset="1" stop-color="#33b4cc" stop-opacity="0"/></radialGradient>
        <pattern id="${uid}-lungTexture" width="8" height="9" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".7" fill="#552c3f" opacity=".35"/><circle cx="6" cy="6" r=".8" fill="#ffe0cb" opacity=".3"/></pattern>

        <radialGradient id="${uid}-soft"><stop offset="0" stop-color="#ffddba" stop-opacity=".15"/><stop offset=".6" stop-color="#a8b79a" stop-opacity=".02"/><stop offset="1" stop-color="#09150f" stop-opacity=".2"/></radialGradient>
        <pattern id="${uid}-tissue" width="5" height="7" patternUnits="userSpaceOnUse"><path d="M0 2q2 2 5 0M1 5q1-1 4 0" fill="none" stroke="#f2c9b3" stroke-width=".22" opacity=".35"/><circle cx="2" cy="4" r=".25" fill="#3a1c2d" opacity=".4"/></pattern>
        <filter id="${uid}-organic" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".45" numOctaves="3" seed="5" result="grain"/><feColorMatrix in="grain" type="saturate" values="0"/><feComposite in2="SourceAlpha" operator="in" result="texture"/><feBlend in="SourceGraphic" in2="texture" mode="soft-light"/></filter>
        <clipPath id="${uid}-lung-clip"><path d="M193 153C183 147 173 155 167 169Q154 188 154 211Q153 232 160 246Q176 250 192 238L194 203Z M207 153C217 147 227 155 233 169Q246 188 246 211Q247 232 240 246Q225 248 216 240Q206 229 210 217Q200 206 206 194Z"/></clipPath>
      </defs>
      <ellipse cx="200" cy="300" rx="175" ry="303" fill="${shade('halo')}" opacity=".3"/>
      <g stroke="#b4baa1" stroke-opacity=".28" stroke-width=".8">
        <path d="M168 65 C166 35 180 17 200 17 C220 17 234 35 232 65 L228 89 Q223 110 200 115 Q177 110 172 89 Z" fill="${shade('skin')}"/>
        <path d="M186 108 L186 132 Q179 139 153 142 Q133 144 125 161 L139 231 Q146 251 139 284 L142 345 Q141 382 164 403 Q181 417 200 419 Q219 417 236 403 Q259 382 258 345 L261 284 Q254 251 261 231 L275 161 Q267 144 247 142 Q221 139 214 132 L214 108 Z" fill="${shade('skin')}"/>
        <path d="M151 143 Q127 139 115 161 L96 220 Q88 245 89 270 L78 328 Q75 344 79 357 L84 376 Q89 383 93 377 L94 356 L101 374 Q107 378 108 370 L105 348 L113 321 L119 280 Q131 253 138 226 L151 176 Z" fill="${shade('muscle')}"/>
        <path d="M249 143 Q273 139 285 161 L304 220 Q312 245 311 270 L322 328 Q325 344 321 357 L316 376 Q311 383 307 377 L306 356 L299 374 Q293 378 292 370 L295 348 L287 321 L281 280 Q269 253 262 226 L249 176 Z" fill="${shade('muscle')}"/>
        <path d="M153 384 Q141 419 147 465 L157 516 L154 570 L150 611 Q138 628 145 637 L179 638 Q186 632 180 621 L179 575 L183 521 L196 453 L200 419 Q174 415 153 384 Z" fill="${shade('skin')}"/>
        <path d="M247 384 Q259 419 253 465 L243 516 L246 570 L250 611 Q262 628 255 637 L221 638 Q214 632 220 621 L221 575 L217 521 L204 453 L200 419 Q226 415 247 384 Z" fill="${shade('skin')}"/>
      </g>
      <g opacity=".4" fill="none" stroke-linecap="round">
        ${lines(['M142 152 Q127 176 127 211','M130 181 Q119 207 118 235','M111 257 Q98 292 99 325','M260 152 Q273 176 273 211','M270 181 Q281 207 282 235','M289 257 Q302 292 301 325','M158 416 Q168 462 168 499','M155 430 Q154 472 163 493','M242 416 Q232 462 232 499','M245 430 Q246 472 237 493','M165 527 Q164 558 163 585','M235 527 Q236 558 237 585'],'#d5d7bb',1.6)}
        ${lines(['M164 157 Q145 179 150 219','M236 157 Q255 179 250 219','M165 403 Q178 422 188 431','M235 403 Q222 422 212 431'],'#253f4e',3)}
      </g>
      <path d="M170 153 Q200 143 230 153 Q249 174 250 209 L246 252 Q246 264 253 292 L250 349 Q248 380 232 391 Q201 407 168 391 Q152 380 150 349 L147 292 Q154 264 154 252 L150 209 Q151 174 170 153 Z" fill="${shade('cavity')}" stroke="#556a69" stroke-width="1.1" stroke-opacity=".6"/>
      <path d="M154 252 Q200 234 246 252" fill="none" stroke="#c29f8c" stroke-width="3" opacity=".7"/>

      <g class="posterior-structures" display="none">
        <path d="M169 150Q147 164 154 197L179 220Q192 198 190 164Z M231 150Q253 164 246 197L221 220Q208 198 210 164Z" fill="${shade('muscle')}" stroke="#5c6a60" stroke-opacity=".4" stroke-width=".7"/>
        <path d="M165 224Q178 234 189 235M162 235Q179 246 189 247M163 248Q179 258 189 259M235 224Q222 234 211 235M238 235Q221 246 211 247M237 248Q221 258 211 259" fill="none" stroke="#b8bf9d" stroke-opacity=".3" stroke-width="2"/>
      </g>
      <g class="organ" data-organ="spine" data-back="true" style="fill:${shade('skin')}">
        <path d="M195 135 Q200 128 205 135 L206 366 Q200 381 194 366 Z"/>
        ${Array.from({length:20},(_,i)=>`<path d="M193 ${146+i*10} Q200 ${150+i*10} 207 ${146+i*10}" fill="none" stroke="#d4ccad" stroke-width="2.3"/>`).join('')}
      </g>
      <g class="organ" data-organ="brain" style="fill:${shade('brain')}">
        <path d="M198 35 C191 27 180 34 177 42 C170 46 170 54 175 60 C169 65 174 77 181 80 C180 88 191 91 198 84 Z M202 35 C209 27 220 34 223 42 C230 46 230 54 225 60 C231 65 226 77 219 80 C220 88 209 91 202 84 Z"/>
        ${lines(['M190 36 Q182 41 189 47 Q178 47 182 56 Q191 54 191 64 Q180 62 178 69 Q181 76 188 73 Q185 84 194 82','M210 36 Q218 41 211 47 Q222 47 218 56 Q209 54 209 64 Q220 62 222 69 Q219 76 212 73 Q215 84 206 82','M194 43 Q201 50 194 57 M206 43 Q199 50 206 57','M193 69 Q198 73 193 78 M207 69 Q202 73 207 78'],'#935b65',1.3)}
      </g>
      <g class="organ" data-organ="eyes" data-front="true" style="fill:#c7c8b6"><path d="M177 83 Q184 78 191 83 Q184 87 177 83 Z M209 83 Q216 78 223 83 Q216 87 209 83 Z"/><circle cx="185" cy="82.7" r="1.8" fill="#536f70"/><circle cx="215" cy="82.7" r="1.8" fill="#536f70"/></g>
      <g class="organ" data-organ="mouth" data-front="true" style="fill:#9b6669"><path d="M189 101 Q200 95 211 101 Q201 109 189 101 Z"/><path d="M191 102 L209 102" fill="none" stroke="#dfb3a0" stroke-width="1"/></g>

      <g class="face-contours" fill="none" stroke-linecap="round">
        <path d="M172 66Q165 57 169 75L174 83M228 66Q235 57 231 75L226 83" stroke="#aa8e73" stroke-width="2"/>
        <path d="M197 86L194 94Q201 98 205 94L203 86M178 88Q182 92 189 89M211 89Q218 92 222 88" stroke="#8c7663" stroke-width=".7"/>
        <path d="M178 95Q181 106 192 109M222 95Q219 106 208 109" stroke="#e0c3a1" stroke-width=".7" opacity=".4"/>
      </g>
      <g class="organ" data-organ="kidneys" style="fill:${shade('kidneys')}">
        <path d="M168 294 C154 288 151 307 154 321 C156 335 171 337 176 324 Q181 314 171 309 Q164 309 171 302 Z M232 294 C246 288 249 307 246 321 C244 335 229 337 224 324 Q219 314 229 309 Q236 309 229 302 Z"/>
        ${lines(['M169 298 Q160 303 161 316 Q162 327 169 328','M231 298 Q240 303 239 316 Q238 327 231 328'],'#d59a83',1.4)}
        ${lines(['M173 314 Q186 321 194 318','M227 314 Q214 321 206 318'],'#b07575',2)}
      </g>
      <g class="organ" data-organ="lungs" style="fill:${shade('lungs')}">
        <path d="M193 153 C183 147 173 155 167 169 Q154 188 154 211 Q153 232 160 246 Q176 250 192 238 L194 203 Z M207 153 C217 147 227 155 233 169 Q246 188 246 211 Q247 232 240 246 Q225 248 216 240 Q206 229 210 217 Q200 206 206 194 Z"/>
        <path d="M193 153 C183 147 173 155 167 169 Q154 188 154 211 Q153 232 160 246 Q176 250 192 238 L194 203 Z M207 153 C217 147 227 155 233 169 Q246 188 246 211 Q247 232 240 246 Q225 248 216 240 Q206 229 210 217 Q200 206 206 194 Z" fill="url(#${uid}-lungTexture)" stroke="none"/>
        ${lines(['M200 123 L200 170 M200 168 L179 188 M200 168 L221 188 M181 185 L173 209 M181 185 L185 214 M221 185 L229 209 M221 185 L215 209'],'#d9c5b4',3)}
        ${lines(['M174 201 L163 210 M174 201 L179 220 M185 211 L181 229 M227 201 L238 214 M226 203 L226 222 M219 192 L216 203'],'#ebd4be',1.1)}
        ${lines(['M157 213 Q175 217 192 203 M160 231 Q178 223 192 216 M210 213 Q227 218 242 230'],'#986471',1)}
        ${lines(['M196 132 L204 132 M196 140 L204 140 M196 148 L204 148 M196 156 L204 156'],'#7f8990',1)}
      </g>
<g class="organ" data-organ="lungs"><g clip-path="url(#${uid}-lung-clip)" fill="none" stroke="#755258" stroke-width=".36" opacity=".48"><path d="M192.0 156.0Q184.4 153.0 176.8 180.1m-2-3 4-2"/><path d="M189.7 158.8Q175.1 155.8 160.4 187.6m-2-3 4-2"/><path d="M187.4 161.5Q179.6 158.5 171.9 176.6m-2-3 4-2"/><path d="M185.1 164.2Q171.5 161.2 158.0 187.4m-2-3 4-2"/><path d="M192.0 167.0Q181.5 164.0 170.9 190.7m-2-3 4-2"/><path d="M189.7 169.8Q178.9 166.8 168.1 195.3m-2-3 4-2"/><path d="M187.4 172.5Q181.9 169.5 176.4 187.0m-2-3 4-2"/><path d="M185.1 175.2Q169.0 172.2 153.0 192.4m-2-3 4-2"/><path d="M192.0 178.0Q182.1 175.0 172.2 204.1m-2-3 4-2"/><path d="M189.7 180.8Q175.4 177.8 161.1 193.7m-2-3 4-2"/><path d="M187.4 183.5Q175.4 180.5 163.5 206.8m-2-3 4-2"/><path d="M185.1 186.2Q180.1 183.2 175.1 209.3m-2-3 4-2"/><path d="M192.0 189.0Q184.2 186.0 176.3 205.7m-2-3 4-2"/><path d="M189.7 191.8Q183.6 188.8 177.5 205.8m-2-3 4-2"/><path d="M187.4 194.5Q169.0 191.5 150.7 212.6m-2-3 4-2"/><path d="M185.1 197.2Q167.7 194.2 150.3 216.0m-2-3 4-2"/><path d="M192.0 200.0Q176.9 197.0 161.8 227.5m-2-3 4-2"/><path d="M189.7 202.8Q174.5 199.8 159.4 215.0m-2-3 4-2"/><path d="M187.4 205.5Q174.9 202.5 162.3 228.2m-2-3 4-2"/><path d="M185.1 208.2Q179.8 205.2 174.6 220.1m-2-3 4-2"/><path d="M192.0 211.0Q172.9 208.0 153.8 231.3m-2-3 4-2"/><path d="M189.7 213.8Q181.9 210.8 174.2 232.8m-2-3 4-2"/><path d="M187.4 216.5Q180.4 213.5 173.5 242.5m-2-3 4-2"/><path d="M185.1 219.2Q175.0 216.2 165.0 231.3m-2-3 4-2"/><path d="M192.0 222.0Q173.7 219.0 155.5 233.8m-2-3 4-2"/><path d="M189.7 224.8Q180.6 221.8 171.6 235.3m-2-3 4-2"/><path d="M187.4 227.5Q172.6 224.5 157.8 239.8m-2-3 4-2"/><path d="M185.1 230.2Q174.7 227.2 164.2 242.1m-2-3 4-2"/><path d="M192.0 233.0Q178.8 230.0 165.6 256.7m-2-3 4-2"/><path d="M189.7 235.8Q176.8 232.8 164.0 254.9m-2-3 4-2"/><path d="M208.0 156.0Q221.3 153.0 234.5 174.7m-2-3 4-2"/><path d="M210.3 158.8Q224.1 155.8 237.9 170.6m-2-3 4-2"/><path d="M212.6 161.5Q223.4 158.5 234.2 176.2m-2-3 4-2"/><path d="M214.9 164.2Q230.4 161.2 246.0 193.0m-2-3 4-2"/><path d="M208.0 167.0Q215.0 164.0 222.0 179.9m-2-3 4-2"/><path d="M210.3 169.8Q225.7 166.8 241.1 191.2m-2-3 4-2"/><path d="M212.6 172.5Q216.6 169.5 220.6 196.6m-2-3 4-2"/><path d="M214.9 175.2Q231.6 172.2 248.3 193.7m-2-3 4-2"/><path d="M208.0 178.0Q219.2 175.0 230.4 199.4m-2-3 4-2"/><path d="M210.3 180.8Q229.2 177.8 248.2 196.0m-2-3 4-2"/><path d="M212.6 183.5Q220.8 180.5 229.1 197.3m-2-3 4-2"/><path d="M214.9 186.2Q226.9 183.2 238.9 205.6m-2-3 4-2"/><path d="M208.0 189.0Q217.8 186.0 227.7 206.8m-2-3 4-2"/><path d="M210.3 191.8Q215.7 188.8 221.0 208.0m-2-3 4-2"/><path d="M212.6 194.5Q231.0 191.5 249.5 216.2m-2-3 4-2"/><path d="M214.9 197.2Q221.7 194.2 228.5 226.0m-2-3 4-2"/><path d="M208.0 200.0Q219.4 197.0 230.7 215.0m-2-3 4-2"/><path d="M210.3 202.8Q215.7 199.8 221.1 215.7m-2-3 4-2"/><path d="M212.6 205.5Q219.3 202.5 226.0 220.1m-2-3 4-2"/><path d="M214.9 208.2Q230.5 205.2 246.2 223.5m-2-3 4-2"/><path d="M208.0 211.0Q217.7 208.0 227.5 233.1m-2-3 4-2"/><path d="M210.3 213.8Q228.9 210.8 247.5 229.6m-2-3 4-2"/><path d="M212.6 216.5Q227.7 213.5 242.8 233.9m-2-3 4-2"/><path d="M214.9 219.2Q225.9 216.2 236.8 241.2m-2-3 4-2"/><path d="M208.0 222.0Q228.1 219.0 248.3 247.1m-2-3 4-2"/><path d="M210.3 224.8Q222.8 221.8 235.2 251.6m-2-3 4-2"/><path d="M212.6 227.5Q221.8 224.5 231.0 245.2m-2-3 4-2"/><path d="M214.9 230.2Q231.8 227.2 248.8 251.2m-2-3 4-2"/><path d="M208.0 233.0Q225.6 230.0 243.2 249.3m-2-3 4-2"/><path d="M210.3 235.8Q228.9 232.8 247.5 258.0m-2-3 4-2"/></g><path d="M155 153H247V247H155Z" clip-path="url(#${uid}-lung-clip)" fill="url(#${uid}-tissue)"/><image href="assets/lung-texture.webp" x="152" y="150" width="96" height="98" preserveAspectRatio="none" clip-path="url(#${uid}-lung-clip)" opacity=".30"/></g>
      <g class="organ" data-organ="heart" data-front="true" style="fill:${shade('heart')}">
        <path d="M201 197 Q197 187 204 185 L210 188 Q220 183 226 195 C233 205 227 223 215 238 Q202 233 197 219 Q192 207 201 197 Z"/>
        <path d="M206 191 L205 182 Q207 174 217 178 L224 187" fill="none" stroke="#ab7070" stroke-width="6"/>
        <path d="M204 193 Q207 211 213 230 M205 205 L217 209 L222 220 M211 213 L204 220" fill="none" stroke="#e2b4a0" stroke-width="1.1"/>
        <path d="M203 200 Q197 211 202 222" fill="none" stroke="#cf9286" stroke-width="2.2" opacity=".7"/>
      </g>
      <g class="organ" data-organ="liver" data-front="true" style="fill:${shade('liver')}">
        <path d="M155 253 Q171 246 192 249 Q214 246 241 256 Q233 267 217 272 Q204 274 194 285 Q177 295 158 282 Q153 271 155 253 Z"/>
        ${lines(['M198 252 Q201 264 194 281','M160 257 Q178 253 190 257'],'#c38d7d',1.2)}
        <path d="M195 279 Q202 277 202 285 Q197 295 192 291Z" fill="#8c9360" stroke="#d0b18b" stroke-width=".5"/>
      </g>
      <g class="organ" data-organ="stomach" data-front="true" style="fill:${shade('stomach')}">
        <path d="M222 263 L222 279 Q242 273 246 290 Q250 309 234 319 Q218 325 209 311 Q203 302 207 299 Q213 304 218 303 Q226 299 219 288 L216 267 Z"/>
        ${lines(['M229 284 Q243 288 239 301 Q237 313 226 314','M226 289 Q235 291 233 301 Q230 308 222 307','M223 293 Q229 297 225 301'],'#b87c77',1.2)}
      </g>
      <g class="organ" data-organ="gut" data-front="true" style="fill:${shade('gut')}">
        <path d="M167 328 Q159 321 159 335 L159 357 Q156 367 166 373 Q180 375 186 372 Q197 379 208 374 Q219 380 230 371 Q243 370 241 357 L242 331 Q243 320 232 323 Q218 317 207 324 Q192 317 181 324 Q174 319 167 328 Z" opacity=".6"/>
        <path d="M167 372 Q156 366 160 355 L159 337 Q155 326 165 325 Q177 329 185 323 Q194 328 204 324 Q213 320 222 326 Q235 321 239 330 L238 350 Q242 361 231 367 Q221 369 217 377 L204 380 L202 391" fill="none" stroke="${shade('gut')}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M180 333 C168 324 169 344 183 340 L216 332 C229 327 234 343 220 343 L185 346 C169 344 174 360 188 354 L217 350 C230 345 232 362 218 361 L188 366" fill="none" stroke="#805b60" stroke-width="6.6" stroke-linecap="round"/>
        <path d="M180 332 C168 323 169 343 183 339 L216 331 C229 326 234 342 220 342 L185 345 C169 343 174 359 188 353 L217 349 C230 344 232 361 218 360 L188 365" fill="none" stroke="${shade('gut')}" stroke-width="4.7" stroke-linecap="round"/>
        ${lines(['M158 336 L164 336 M158 345 L165 345 M158 356 L165 355 M163 366 L169 362 M176 327 L177 321 M190 327 L191 322 M207 328 L208 323 M224 328 L224 323 M235 338 L242 338 M235 349 L242 349 M233 360 L239 362'],'#9f726c',.9)}
      </g>
<g class="organ" data-organ="gut"><image href="assets/gut-texture.png" x="157" y="321" width="85" height="69" preserveAspectRatio="none" opacity=".9"/></g>
      <g fill="none" stroke="#5e9caa" stroke-width=".8" opacity=".42"><path d="M72 135 L72 118 L91 118 M309 118 L328 118 L328 135 M72 394 L72 410 L91 410 M309 410 L328 410 L328 394"/></g>
      <g class="impact-animation" aria-hidden="true" display="none"><path class="path-trace" d="M200 113L200 170L176 194M200 170L224 194" fill="none" stroke="#dcbea0" stroke-width="1.7"/><circle class="path-marker" cx="178" cy="205" r="18" fill="none" stroke="#e2bb91" stroke-width=".8"/></g>
    </svg>`;
  }
