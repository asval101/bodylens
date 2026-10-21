/* 分层解剖人体插画。
 *
 * 浅色版的配色规则（翻主题时定的，改之前先读）：
 *   外壳（皮肤/肌肉/体腔）压到 0.78~0.86 的浅灰，退成一个「模型」；
 *   器官压到 0.42~0.68 的中间调，色相和饱和度留着 —— 浅底上器官之间
 *   就是靠色相区分的，全调灰会糊成一团，认不出肺和肠。
 *   描边方向反过来了：深色版是亮线浮在暗底上，现在是暗线浮在白底上。
 *
 * 外壳为什么是 0.78 而不是更浅：一开始按 0.84~0.92 转，结果整个人是
 * 一团白雾 —— 外壳与舞台只差 5% 明度，边界读不出来，器官像漂在空气里。
 * 而描边原值 #9ca387 / 28% / 0.8宽，在 0.65 缩放下不到半个像素，等于没有。
 * 现在描边 #8d9787 / 46% / 1.15宽，外壳再压 4.5%，人形才立住。
 * 教训：浅色主题里「浅」不是安全值，缺了对边界就散了。
 *
 * 器官位置与层级只用于交互科普，不作为临床定位或测量依据。
 */
  window.createAnatomy = function (uid) {
    const gradient=(name,stops)=>`<linearGradient id="${uid}-${name}" x1="0" y1="0" x2="1" y2=".55">${stops.map(([offset,color])=>`<stop offset="${offset}" stop-color="${color}"/>`).join('')}</linearGradient>`;
    const shade=name=>`url(#${uid}-${name})`;
    const lines=(paths,color,width=1)=>paths.map(d=>`<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`).join('');
    return `<svg class="human" viewBox="0 0 400 660" role="img" aria-label="分层解剖人体插画：器官按相对解剖位置排列，选择器官按钮可查看影响">
      <defs>
        ${gradient('skin',[[0,'#c8caca'],[.14,'#cbcdcd'],[.32,'#cfd2d2'],[.5,'#d0d4d4'],[.67,'#cfd1d1'],[.86,'#cacccc'],[1,'#c7c8c8']])}
        ${gradient('muscle',[[0,'#c8caca'],[.2,'#cccece'],[.42,'#d0d3d3'],[.55,'#d1d4d4'],[.73,'#ced1d1'],[1,'#c9cac9']])}
        ${gradient('cavity',[[0,'#b5b5b8'],[.45,'#babdbc'],[.7,'#b9bbbb'],[1,'#b4b9ba']])}
        ${gradient('brain',[[0,'#b9979a'],[.3,'#c36d55'],[.65,'#b77e7a'],[1,'#bfa7ad']])}
        ${gradient('lungs',[[0,'#c9acb3'],[.18,'#b99497'],[.36,'#b9786e'],[.52,'#c0765a'],[.69,'#b8827b'],[.87,'#ba9ca1'],[1,'#cdb6bd']])}
        ${gradient('heart',[[0,'#d3acb5'],[.3,'#c1898b'],[.5,'#c47f70'],[.8,'#ca989f'],[1,'#d5b6c3']])}
        ${gradient('liver',[[0,'#d3b5bc'],[.27,'#c59c9d'],[.48,'#bf9189'],[.76,'#caa6ac'],[1,'#d5bbc4']])}
        ${gradient('stomach',[[0,'#b89494'],[.35,'#c56c53'],[.6,'#cc7245'],[.8,'#bc8078'],[1,'#ba9b9d']])}
        ${gradient('kidneys',[[0,'#d3b0ba'],[.35,'#c08c86'],[.57,'#c18873'],[.84,'#c59b9e'],[1,'#d4b3be']])}
        ${gradient('gut',[[0,'#b69997'],[.25,'#bc8564'],[.5,'#cb8447'],[.8,'#bb8d7c'],[1,'#b89a9c']])}
        <radialGradient id="${uid}-halo"><stop stop-color="#6ebfcf" stop-opacity=".19"/><stop offset="1" stop-color="#6ebfcf" stop-opacity="0"/></radialGradient>
        <pattern id="${uid}-lungTexture" width="8" height="9" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".7" fill="#c194a9" opacity=".35"/><circle cx="6" cy="6" r=".8" fill="#c47f4f" opacity=".3"/></pattern>

        <radialGradient id="${uid}-soft"><stop offset="0" stop-color="#c58c52" stop-opacity=".15"/><stop offset=".6" stop-color="#95a587" stop-opacity=".02"/><stop offset="1" stop-color="#9bceb5" stop-opacity=".2"/></radialGradient>
        <pattern id="${uid}-tissue" width="5" height="7" patternUnits="userSpaceOnUse"><path d="M0 2q2 2 5 0M1 5q1-1 4 0" fill="none" stroke="#c67c55" stroke-width=".22" opacity=".35"/><circle cx="2" cy="4" r=".25" fill="#c797b2" opacity=".4"/></pattern>
        <filter id="${uid}-organic" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".45" numOctaves="3" seed="5" result="grain"/><feColorMatrix in="grain" type="saturate" values="0"/><feComposite in2="SourceAlpha" operator="in" result="texture"/><feBlend in="SourceGraphic" in2="texture" mode="soft-light"/></filter>
        <clipPath id="${uid}-lung-clip"><path d="M193 153C183 147 173 155 167 169Q154 188 154 211Q153 232 160 246Q176 250 192 238L194 203Z M207 153C217 147 227 155 233 169Q246 188 246 211Q247 232 240 246Q225 248 216 240Q206 229 210 217Q200 206 206 194Z"/></clipPath>
      </defs>
      <ellipse cx="200" cy="300" rx="175" ry="303" fill="${shade('halo')}" opacity=".3"/>
      <g stroke="#8d9787" stroke-opacity=".46" stroke-width="1.15">
        <path d="M167 68C165.6 43 180 31 200 31C220 31 234.4 43 233 68C232.4 82 230 92 226 99C221.5 106.8 213 111.6 205.6 112.6Q200 113.4 194.4 112.6C187 111.6 178.5 106.8 174 99C170 92 167.6 82 167 68Z" fill="${shade('skin')}"/>
        <path d="M186 108 L186 132 Q179 139 153 142 Q133 144 125 161 L139 231 Q146 251 139 284 L142 345 Q141 382 164 403 Q181 417 200 419 Q219 417 236 403 Q259 382 258 345 L261 284 Q254 251 261 231 L275 161 Q267 144 247 142 Q221 139 214 132 L214 108 Z" fill="${shade('skin')}"/>
        <path d="M151 143 Q127 139 115 161 L96 220 Q88 245 89 270 L78 328 Q75 344 79 357 L84 376 Q89 383 93 377 L94 356 L101 374 Q107 378 108 370 L105 348 L113 321 L119 280 Q131 253 138 226 L151 176 Z" fill="${shade('muscle')}"/>
        <path d="M249 143 Q273 139 285 161 L304 220 Q312 245 311 270 L322 328 Q325 344 321 357 L316 376 Q311 383 307 377 L306 356 L299 374 Q293 378 292 370 L295 348 L287 321 L281 280 Q269 253 262 226 L249 176 Z" fill="${shade('muscle')}"/>
        <path d="M153 384 Q141 419 147 465 L157 516 L154 570 L150 611 Q138 628 145 637 L179 638 Q186 632 180 621 L179 575 L183 521 L196 453 L200 419 Q174 415 153 384 Z" fill="${shade('skin')}"/>
        <path d="M247 384 Q259 419 253 465 L243 516 L246 570 L250 611 Q262 628 255 637 L221 638 Q214 632 220 621 L221 575 L217 521 L204 453 L200 419 Q226 415 247 384 Z" fill="${shade('skin')}"/>
      </g>
      <path d="M170 153 Q200 143 230 153 Q249 174 250 209 L246 252 Q246 264 253 292 L250 349 Q248 380 232 391 Q201 407 168 391 Q152 380 150 349 L147 292 Q154 264 154 252 L150 209 Q151 174 170 153 Z" fill="${shade('cavity')}" stroke="#9cadac" stroke-width="1.1" stroke-opacity=".6"/>
      <path d="M154 252 Q200 234 246 252" fill="none" stroke="#b28e7b" stroke-width="3" opacity=".7"/>

      <g class="posterior-structures" display="none">
        <path d="M169 150Q147 164 154 197L179 220Q192 198 190 164Z M231 150Q253 164 246 197L221 220Q208 198 210 164Z" fill="${shade('muscle')}" stroke="#9ea9a1" stroke-opacity=".4" stroke-width=".7"/>
        <path d="M165 224Q178 234 189 235M162 235Q179 246 189 247M163 248Q179 258 189 259M235 224Q222 234 211 235M238 235Q221 246 211 247M237 248Q221 258 211 259" fill="none" stroke="#a0a882" stroke-opacity=".3" stroke-width="2"/>
      </g>
      <g class="organ" data-organ="spine" data-back="true" style="fill:${shade('skin')}">
        <path d="M195 135 Q200 128 205 135 L206 366 Q200 381 194 366 Z"/>
        ${Array.from({length:20},(_,i)=>`<path d="M193 ${146+i*10} Q200 ${150+i*10} 207 ${146+i*10}" fill="none" stroke="#aea274" stroke-width="2.3"/>`).join('')}
      </g>
      <g class="organ" data-organ="brain" style="fill:${shade('brain')}">
        <path d="M198.6 38.3C193.3 34.1 185.2 37.9 183 42.3C177.9 44.4 177.9 48.9 181.6 52.2C177.1 55.1 180.8 61.8 186 63.4C185.2 67.8 193.3 69.5 198.6 65.5ZM201.4 38.3C206.7 34.1 214.8 37.9 217 42.3C222.1 44.4 222.1 48.9 218.4 52.2C223 55.1 219.2 61.8 214 63.4C214.8 67.8 206.7 69.5 201.4 65.5Z"/>
        ${lines(['M191.9 34.4Q185.6 37.9 191.3 41.8Q182.5 41.8 185.6 48Q192.9 46.6 192.9 53.4Q184 52.1 182.5 56.8Q184.9 61.6 190.5 59.4Q188 67.1 195.2 65.5','M208.1 34.4Q214.4 37.9 208.7 41.8Q217.5 41.8 214.4 48Q207.1 46.6 207.1 53.4Q216 52.1 217.5 56.8Q215.1 61.6 209.6 59.4Q212 67.1 204.8 65.5','M195.2 39.1Q200.9 44 195.2 48.7M204.8 39.1Q199.2 44 204.8 48.7','M194.4 56.8Q198.5 59.4 194.4 62.8M205.6 56.8Q201.5 59.4 205.6 62.8'],'#b38d94',1.15)}
      </g>
      <g class="organ" data-organ="eyes" data-front="true" style="fill:#cbc2b4"><path d="M178.8 74.2Q186.8 68.4 194.2 74.8Q187 81.7 178.8 74.2ZM205.8 74.8Q213.2 68.4 221.2 74.2Q213 81.7 205.8 74.8Z"/><circle cx="187.3" cy="75" r="3" fill="#6f8588"/><circle cx="212.7" cy="75" r="3" fill="#6f8588"/><circle cx="187.3" cy="75.3" r="1.2" fill="#465659"/><circle cx="212.7" cy="75.3" r="1.2" fill="#465659"/><circle cx="188.3" cy="74.1" r=".8" fill="#fff" opacity=".7"/><circle cx="213.7" cy="74.1" r=".8" fill="#fff" opacity=".7"/><path d="M179.3 74Q186.9 68.7 194 74.6M206 74.6Q213.1 68.7 220.7 74" fill="none" stroke="#a2917f" stroke-width=".85" opacity=".5"/></g>
      <g class="organ" data-organ="mouth" data-front="true"><path d="M191.3 97.7C193.6 96.1 195.8 95.5 198.1 96.5Q200 97.2 201.9 96.5C204.2 95.5 206.4 96.1 208.7 97.7Q200 98.4 191.3 97.7Z" fill="#c2a49c"/><path d="M191.3 97.7Q200 98.4 208.7 97.7C206.8 101.9 193.2 101.9 191.3 97.7Z" fill="#cdb0a8"/><path d="M191.9 97.9Q195.8 98.7 198.1 97.9Q200 97.5 201.9 97.9Q204.4 98.7 208.1 97.9" fill="none" stroke="#a9837c" stroke-width=".55" stroke-linecap="round" opacity=".45"/><ellipse cx="200" cy="100.2" rx="3.4" ry=".9" fill="#dcc3bb" opacity=".45"/></g>

      <g class="face-contours" fill="none" stroke-linecap="round">
        <ellipse cx="196.4" cy="86.8" rx="1.5" ry="1" fill="#a89079" opacity=".55" stroke="none"/>
        <ellipse cx="203.6" cy="86.8" rx="1.5" ry="1" fill="#a89079" opacity=".55" stroke="none"/>
        <path d="M194.6 87.4Q200 88.4 205.4 87.4" stroke="#a08a76" stroke-width=".7" opacity=".4"/>
      </g>
      <g class="organ" data-organ="kidneys" style="fill:${shade('kidneys')}">
        <path d="M168 294 C154 288 151 307 154 321 C156 335 171 337 176 324 Q181 314 171 309 Q164 309 171 302 Z M232 294 C246 288 249 307 246 321 C244 335 229 337 224 324 Q219 314 229 309 Q236 309 229 302 Z"/>
        ${lines(['M169 298 Q160 303 161 316 Q162 327 169 328','M231 298 Q240 303 239 316 Q238 327 231 328'],'#c28269',1.4)}
        ${lines(['M173 314 Q186 321 194 318','M227 314 Q214 321 206 318'],'#b28383',2)}
      </g>
      <g class="organ" data-organ="lungs" style="fill:${shade('lungs')}">
        <path d="M193 153 C183 147 173 155 167 169 Q154 188 154 211 Q153 232 160 246 Q176 250 192 238 L194 203 Z M207 153 C217 147 227 155 233 169 Q246 188 246 211 Q247 232 240 246 Q225 248 216 240 Q206 229 210 217 Q200 206 206 194 Z"/>
        <path d="M193 153 C183 147 173 155 167 169 Q154 188 154 211 Q153 232 160 246 Q176 250 192 238 L194 203 Z M207 153 C217 147 227 155 233 169 Q246 188 246 211 Q247 232 240 246 Q225 248 216 240 Q206 229 210 217 Q200 206 206 194 Z" fill="url(#${uid}-lungTexture)" stroke="none"/>
        ${lines(['M200 123 L200 170 M200 168 L179 188 M200 168 L221 188 M181 185 L173 209 M181 185 L185 214 M221 185 L229 209 M221 185 L215 209'],'#af8d71',3)}
        ${lines(['M174 201 L163 210 M174 201 L179 220 M185 211 L181 229 M227 201 L238 214 M226 203 L226 222 M219 192 L216 203'],'#c08c5a',1.1)}
        ${lines(['M157 213 Q175 217 192 203 M160 231 Q178 223 192 216 M210 213 Q227 218 242 230'],'#af8d96',1)}
        ${lines(['M196 132 L204 132 M196 140 L204 140 M196 148 L204 148 M196 156 L204 156'],'#979ea2',1)}
      </g>
<g class="organ" data-organ="lungs"><g clip-path="url(#${uid}-lung-clip)" fill="none" stroke="#b1969b" stroke-width=".36" opacity=".48"><path d="M192.0 156.0Q184.4 153.0 176.8 180.1m-2-3 4-2"/><path d="M189.7 158.8Q175.1 155.8 160.4 187.6m-2-3 4-2"/><path d="M187.4 161.5Q179.6 158.5 171.9 176.6m-2-3 4-2"/><path d="M185.1 164.2Q171.5 161.2 158.0 187.4m-2-3 4-2"/><path d="M192.0 167.0Q181.5 164.0 170.9 190.7m-2-3 4-2"/><path d="M189.7 169.8Q178.9 166.8 168.1 195.3m-2-3 4-2"/><path d="M187.4 172.5Q181.9 169.5 176.4 187.0m-2-3 4-2"/><path d="M185.1 175.2Q169.0 172.2 153.0 192.4m-2-3 4-2"/><path d="M192.0 178.0Q182.1 175.0 172.2 204.1m-2-3 4-2"/><path d="M189.7 180.8Q175.4 177.8 161.1 193.7m-2-3 4-2"/><path d="M187.4 183.5Q175.4 180.5 163.5 206.8m-2-3 4-2"/><path d="M185.1 186.2Q180.1 183.2 175.1 209.3m-2-3 4-2"/><path d="M192.0 189.0Q184.2 186.0 176.3 205.7m-2-3 4-2"/><path d="M189.7 191.8Q183.6 188.8 177.5 205.8m-2-3 4-2"/><path d="M187.4 194.5Q169.0 191.5 150.7 212.6m-2-3 4-2"/><path d="M185.1 197.2Q167.7 194.2 150.3 216.0m-2-3 4-2"/><path d="M192.0 200.0Q176.9 197.0 161.8 227.5m-2-3 4-2"/><path d="M189.7 202.8Q174.5 199.8 159.4 215.0m-2-3 4-2"/><path d="M187.4 205.5Q174.9 202.5 162.3 228.2m-2-3 4-2"/><path d="M185.1 208.2Q179.8 205.2 174.6 220.1m-2-3 4-2"/><path d="M192.0 211.0Q172.9 208.0 153.8 231.3m-2-3 4-2"/><path d="M189.7 213.8Q181.9 210.8 174.2 232.8m-2-3 4-2"/><path d="M187.4 216.5Q180.4 213.5 173.5 242.5m-2-3 4-2"/><path d="M185.1 219.2Q175.0 216.2 165.0 231.3m-2-3 4-2"/><path d="M192.0 222.0Q173.7 219.0 155.5 233.8m-2-3 4-2"/><path d="M189.7 224.8Q180.6 221.8 171.6 235.3m-2-3 4-2"/><path d="M187.4 227.5Q172.6 224.5 157.8 239.8m-2-3 4-2"/><path d="M185.1 230.2Q174.7 227.2 164.2 242.1m-2-3 4-2"/><path d="M192.0 233.0Q178.8 230.0 165.6 256.7m-2-3 4-2"/><path d="M189.7 235.8Q176.8 232.8 164.0 254.9m-2-3 4-2"/><path d="M208.0 156.0Q221.3 153.0 234.5 174.7m-2-3 4-2"/><path d="M210.3 158.8Q224.1 155.8 237.9 170.6m-2-3 4-2"/><path d="M212.6 161.5Q223.4 158.5 234.2 176.2m-2-3 4-2"/><path d="M214.9 164.2Q230.4 161.2 246.0 193.0m-2-3 4-2"/><path d="M208.0 167.0Q215.0 164.0 222.0 179.9m-2-3 4-2"/><path d="M210.3 169.8Q225.7 166.8 241.1 191.2m-2-3 4-2"/><path d="M212.6 172.5Q216.6 169.5 220.6 196.6m-2-3 4-2"/><path d="M214.9 175.2Q231.6 172.2 248.3 193.7m-2-3 4-2"/><path d="M208.0 178.0Q219.2 175.0 230.4 199.4m-2-3 4-2"/><path d="M210.3 180.8Q229.2 177.8 248.2 196.0m-2-3 4-2"/><path d="M212.6 183.5Q220.8 180.5 229.1 197.3m-2-3 4-2"/><path d="M214.9 186.2Q226.9 183.2 238.9 205.6m-2-3 4-2"/><path d="M208.0 189.0Q217.8 186.0 227.7 206.8m-2-3 4-2"/><path d="M210.3 191.8Q215.7 188.8 221.0 208.0m-2-3 4-2"/><path d="M212.6 194.5Q231.0 191.5 249.5 216.2m-2-3 4-2"/><path d="M214.9 197.2Q221.7 194.2 228.5 226.0m-2-3 4-2"/><path d="M208.0 200.0Q219.4 197.0 230.7 215.0m-2-3 4-2"/><path d="M210.3 202.8Q215.7 199.8 221.1 215.7m-2-3 4-2"/><path d="M212.6 205.5Q219.3 202.5 226.0 220.1m-2-3 4-2"/><path d="M214.9 208.2Q230.5 205.2 246.2 223.5m-2-3 4-2"/><path d="M208.0 211.0Q217.7 208.0 227.5 233.1m-2-3 4-2"/><path d="M210.3 213.8Q228.9 210.8 247.5 229.6m-2-3 4-2"/><path d="M212.6 216.5Q227.7 213.5 242.8 233.9m-2-3 4-2"/><path d="M214.9 219.2Q225.9 216.2 236.8 241.2m-2-3 4-2"/><path d="M208.0 222.0Q228.1 219.0 248.3 247.1m-2-3 4-2"/><path d="M210.3 224.8Q222.8 221.8 235.2 251.6m-2-3 4-2"/><path d="M212.6 227.5Q221.8 224.5 231.0 245.2m-2-3 4-2"/><path d="M214.9 230.2Q231.8 227.2 248.8 251.2m-2-3 4-2"/><path d="M208.0 233.0Q225.6 230.0 243.2 249.3m-2-3 4-2"/><path d="M210.3 235.8Q228.9 232.8 247.5 258.0m-2-3 4-2"/></g><path d="M155 153H247V247H155Z" clip-path="url(#${uid}-lung-clip)" fill="url(#${uid}-tissue)"/><image href="assets/lung-texture.webp" x="152" y="150" width="96" height="98" preserveAspectRatio="none" clip-path="url(#${uid}-lung-clip)" opacity=".30"/></g>
      <g class="organ" data-organ="heart" data-front="true" style="fill:${shade('heart')}">
        <path d="M201 197 Q197 187 204 185 L210 188 Q220 183 226 195 C233 205 227 223 215 238 Q202 233 197 219 Q192 207 201 197 Z"/>
        <path d="M206 191 L205 182 Q207 174 217 178 L224 187" fill="none" stroke="#b18585" stroke-width="6"/>
        <path d="M204 193 Q207 211 213 230 M205 205 L217 209 L222 220 M211 213 L204 220" fill="none" stroke="#c37d5f" stroke-width="1.1"/>
        <path d="M203 200 Q197 211 202 222" fill="none" stroke="#bc7b6f" stroke-width="2.2" opacity=".7"/>
      </g>
      <g class="organ" data-organ="liver" data-front="true" style="fill:${shade('liver')}">
        <path d="M155 253 Q171 246 192 249 Q214 246 241 256 Q233 267 217 272 Q204 274 194 285 Q177 295 158 282 Q153 271 155 253 Z"/>
        ${lines(['M198 252 Q201 264 194 281','M160 257 Q178 253 190 257'],'#b88677',1.2)}
        <path d="M195 279 Q202 277 202 285 Q197 295 192 291Z" fill="#acb08e" stroke="#bb996f" stroke-width=".5"/>
      </g>
      <g class="organ" data-organ="stomach" data-front="true" style="fill:${shade('stomach')}">
        <path d="M222 263 L222 279 Q242 273 246 290 Q250 309 234 319 Q218 325 209 311 Q203 302 207 299 Q213 304 218 303 Q226 299 219 288 L216 267 Z"/>
        ${lines(['M229 284 Q243 288 239 301 Q237 313 226 314','M226 289 Q235 291 233 301 Q230 308 222 307','M223 293 Q229 297 225 301'],'#b4827e',1.2)}
      </g>
      <g class="organ" data-organ="gut" data-front="true" style="fill:${shade('gut')}">
        <path d="M167 328 Q159 321 159 335 L159 357 Q156 367 166 373 Q180 375 186 372 Q197 379 208 374 Q219 380 230 371 Q243 370 241 357 L242 331 Q243 320 232 323 Q218 317 207 324 Q192 317 181 324 Q174 319 167 328 Z" opacity=".6"/>
        <path d="M167 372 Q156 366 160 355 L159 337 Q155 326 165 325 Q177 329 185 323 Q194 328 204 324 Q213 320 222 326 Q235 321 239 330 L238 350 Q242 361 231 367 Q221 369 217 377 L204 380 L202 391" fill="none" stroke="${shade('gut')}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M180 333 C168 324 169 344 183 340 L216 332 C229 327 234 343 220 343 L185 346 C169 344 174 360 188 354 L217 350 C230 345 232 362 218 361 L188 366" fill="none" stroke="#af9498" stroke-width="6.6" stroke-linecap="round"/>
        <path d="M180 332 C168 323 169 343 183 339 L216 331 C229 326 234 342 220 342 L185 345 C169 343 174 359 188 353 L217 349 C230 344 232 361 218 360 L188 365" fill="none" stroke="${shade('gut')}" stroke-width="4.7" stroke-linecap="round"/>
        ${lines(['M158 336 L164 336 M158 345 L165 345 M158 356 L165 355 M163 366 L169 362 M176 327 L177 321 M190 327 L191 322 M207 328 L208 323 M224 328 L224 323 M235 338 L242 338 M235 349 L242 349 M233 360 L239 362'],'#ae908b',.9)}
      </g>
<g class="organ" data-organ="gut"><image href="assets/gut-texture.png" x="157" y="321" width="85" height="69" preserveAspectRatio="none" opacity=".9"/></g>
      <g class="impact-animation" aria-hidden="true" display="none"><path class="path-trace" d="M200 113L200 170L176 194M200 170L224 194" fill="none" stroke="#bd9267" stroke-width="1.7"/><circle class="path-marker" cx="178" cy="205" r="18" fill="none" stroke="#c8945d" stroke-width=".8"/></g>
    </svg>`;
  }
