/* Fundo líquido: um shader de tela cheia feito com a capa da música do centro */

const canvas = document.getElementById("fundo")
const gl = canvas && canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power" })

const menosMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches

const verticeFonte = `
attribute vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }
`

const fragmentoFonte = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2 uRes;
uniform float uTime;
uniform float uEnergia;
uniform vec2 uMouse;
uniform vec3 uC1;
uniform vec3 uC2;
uniform vec3 uC3;
uniform sampler2D uCapaAntes;
uniform sampler2D uCapaDepois;
uniform float uMistura;
uniform float uTemAntes;
uniform float uTemDepois;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float ruido(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * ruido(p);
    p = p * 2.02 + vec2(7.3, 3.1);
    a *= 0.5;
  }
  return v;
}

mat2 girar(float a) {
  return mat2(cos(a), -sin(a), sin(a), cos(a));
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = (uv - 0.5) * vec2(uRes.x / uRes.y, 1.0) * 1.7;
  float t = uTime * (0.06 + 0.10 * uEnergia);

  vec2 q = vec2(fbm(p + t), fbm(p + vec2(5.2, 1.3) - t));
  vec2 r = vec2(fbm(p + 3.0 * q + vec2(1.7, 9.2) + 0.4 * t),
                fbm(p + 3.0 * q + vec2(8.3, 2.8) - 0.4 * t));
  float f = fbm(p + 3.0 * r);

  /* base: as três cores da capa se misturando */
  vec3 cor = mix(uC1, uC2, clamp(f * 1.7, 0.0, 1.0));
  cor = mix(cor, uC3, clamp(length(q) * 0.85, 0.0, 1.0) * 0.7);

  /* a própria capa, derretida e girando devagar */
  vec2 torto = p * 0.5 + (q - 0.5) * 0.75 + (r - 0.5) * 0.4;
  vec2 st1 = girar(t * 0.55) * torto + 0.5;
  vec2 st2 = girar(-t * 0.4 + 2.1) * torto * 1.5 + 0.5;
  vec3 antes = mix(texture2D(uCapaAntes, st1).rgb, texture2D(uCapaAntes, st2).rgb, r.x);
  vec3 depois = mix(texture2D(uCapaDepois, st1).rgb, texture2D(uCapaDepois, st2).rgb, r.x);
  vec3 comAntes = mix(cor, mix(cor, antes, 0.78), uTemAntes);
  vec3 comDepois = mix(cor, mix(cor, depois, 0.78), uTemDepois);
  cor = mix(comAntes, comDepois, uMistura);

  float lum = dot(cor, vec3(0.299, 0.587, 0.114));
  cor = mix(vec3(lum), cor, 1.85);
  cor = mix(cor, uC1, 0.14);
  cor = mix(cor, vec3(0.02, 0.02, 0.05), 0.30);
  cor *= 1.0 - 0.32 * smoothstep(0.38, 0.78, lum);

  float d = distance(uv, uMouse);
  cor += uC1 * 0.16 * smoothstep(0.5, 0.0, d);

  float pulso = 0.5 + 0.5 * sin(uTime * 2.2 + f * 6.0);
  cor += uC1 * 0.08 * uEnergia * pulso;

  float vinheta = smoothstep(1.35, 0.35, length(uv - 0.5) * 1.5);
  cor *= mix(0.5, 1.0, vinheta);

  cor += (hash(gl_FragCoord.xy + uTime) - 0.5) / 160.0;
  gl_FragColor = vec4(cor, 1.0);
}
`

function compilar(tipo, fonte) {
  const shader = gl.createShader(tipo)
  gl.shaderSource(shader, fonte)
  gl.compileShader(shader)
  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null
}

function hexParaRgb(texto) {
  let hex = String(texto).trim().replace("#", "")
  if (hex.length === 3) {
    hex = hex.split("").map((letra) => letra + letra).join("")
  }
  const numero = parseInt(hex, 16)
  if (isNaN(numero)) {
    return [0.4, 0.3, 0.9]
  }
  return [(numero >> 16) / 255, ((numero >> 8) & 255) / 255, (numero & 255) / 255]
}

/* reduz a capa para 32px: é isso que deixa o fundo macio, como desfocado */
function miniatura(imagem) {
  const meio = document.createElement("canvas")
  meio.width = meio.height = 8
  meio.getContext("2d").drawImage(imagem, 0, 0, 8, 8)
  const tela = document.createElement("canvas")
  tela.width = tela.height = 32
  const pincel = tela.getContext("2d")
  pincel.imageSmoothingQuality = "high"
  pincel.drawImage(meio, 0, 0, 32, 32)
  return tela
}

/* inclinação da capa e luz que seguem o cursor */
let mouseAlvo = [0.5, 0.5]
let moveuAgora = false

window.addEventListener("pointermove", (evento) => {
  mouseAlvo = [evento.clientX / window.innerWidth, 1 - evento.clientY / window.innerHeight]
  if (!moveuAgora) {
    moveuAgora = true
    requestAnimationFrame(() => {
      moveuAgora = false
      const raiz = document.documentElement.style
      raiz.setProperty("--mx", (mouseAlvo[0] * 2 - 1).toFixed(3))
      raiz.setProperty("--my", (mouseAlvo[1] * 2 - 1).toFixed(3))
    })
  }
}, { passive: true })

if (gl) {
  const vs = compilar(gl.VERTEX_SHADER, verticeFonte)
  const fs = compilar(gl.FRAGMENT_SHADER, fragmentoFonte)
  const programa = gl.createProgram()

  if (vs && fs) {
    gl.attachShader(programa, vs)
    gl.attachShader(programa, fs)
    gl.linkProgram(programa)
  }

  if (vs && fs && gl.getProgramParameter(programa, gl.LINK_STATUS)) {
    gl.useProgram(programa)

    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const posicao = gl.getAttribLocation(programa, "p")
    gl.enableVertexAttribArray(posicao)
    gl.vertexAttribPointer(posicao, 2, gl.FLOAT, false, 0, 0)

    const u = {}
    for (const nome of ["uRes", "uTime", "uEnergia", "uMouse", "uC1", "uC2", "uC3", "uCapaAntes", "uCapaDepois", "uMistura", "uTemAntes", "uTemDepois"]) {
      u[nome] = gl.getUniformLocation(programa, nome)
    }

    function criarTextura(unidade) {
      const textura = gl.createTexture()
      gl.activeTexture(gl.TEXTURE0 + unidade)
      gl.bindTexture(gl.TEXTURE_2D, textura)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0]))
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT)
      return textura
    }

    const texturas = [criarTextura(0), criarTextura(1)]

    function enviarImagem(unidade, tela) {
      gl.activeTexture(gl.TEXTURE0 + unidade)
      gl.bindTexture(gl.TEXTURE_2D, texturas[unidade])
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, tela)
    }

    gl.uniform1i(u.uCapaAntes, 0)
    gl.uniform1i(u.uCapaDepois, 1)

    document.documentElement.classList.add("com-webgl")

    let escala = 0.5
    let tempo = 0
    let energia = 0
    let ultimo = performance.now()
    let somaQuadros = 0
    let contaQuadros = 0

    const raiz = getComputedStyle(document.documentElement)
    let atual = ["--c1", "--c2", "--c3"].map((nome) => hexParaRgb(raiz.getPropertyValue(nome)))
    let alvo = atual.map((cor) => cor.slice())
    let mouse = [0.5, 0.5]

    let mistura = 1
    let capaAtual = null
    let temAntes = 0
    let temDepois = 0

    /* chega uma música nova: a capa antiga vai para trás e a nova aparece por cima */
    function aplicarClima(clima) {
      alvo = clima.cores.map(hexParaRgb)
      const nova = clima.imagem ? miniatura(clima.imagem) : null
      if (!nova && !capaAtual) return

      if (capaAtual) enviarImagem(0, capaAtual)
      temAntes = capaAtual ? 1 : 0
      if (nova) enviarImagem(1, nova)
      temDepois = nova ? 1 : 0
      capaAtual = nova
      mistura = 0
    }

    window.addEventListener("clima", (evento) => aplicarClima(evento.detail))
    if (window.climaAtual) aplicarClima(window.climaAtual)

    function ajustarTamanho() {
      canvas.width = Math.max(2, Math.floor(window.innerWidth * escala))
      canvas.height = Math.max(2, Math.floor(window.innerHeight * escala))
      gl.viewport(0, 0, canvas.width, canvas.height)
    }

    ajustarTamanho()
    window.addEventListener("resize", ajustarTamanho)

    function desenhar(agora) {
      requestAnimationFrame(desenhar)

      if (document.hidden) {
        ultimo = agora
        return
      }

      const dt = Math.min((agora - ultimo) / 1000, 0.1)
      ultimo = agora

      /* se o aparelho engasgar, o fundo diminui de resolução sozinho */
      somaQuadros += dt
      contaQuadros++
      if (contaQuadros === 90) {
        const media = somaQuadros / contaQuadros
        if (media > 0.03 && escala > 0.26) {
          escala = escala > 0.4 ? 0.36 : 0.25
          ajustarTamanho()
        }
        somaQuadros = 0
        contaQuadros = 0
      }

      tempo += dt * (menosMovimento ? 0.25 : 1)
      mistura = Math.min(1, mistura + dt / 1.1)

      const suave = 1 - Math.exp(-dt * 2.4)
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          atual[i][j] += (alvo[i][j] - atual[i][j]) * suave
        }
      }

      const suaveMouse = 1 - Math.exp(-dt * 4)
      mouse[0] += (mouseAlvo[0] - mouse[0]) * suaveMouse
      mouse[1] += (mouseAlvo[1] - mouse[1]) * suaveMouse

      const queroEnergia = window.musicaTocando ? 1 : 0
      energia += (queroEnergia - energia) * (1 - Math.exp(-dt * 1.5))

      gl.uniform2f(u.uRes, canvas.width, canvas.height)
      gl.uniform1f(u.uTime, tempo)
      gl.uniform1f(u.uEnergia, energia)
      gl.uniform2f(u.uMouse, mouse[0], mouse[1])
      gl.uniform3fv(u.uC1, atual[0])
      gl.uniform3fv(u.uC2, atual[1])
      gl.uniform3fv(u.uC3, atual[2])
      gl.uniform1f(u.uMistura, mistura)
      gl.uniform1f(u.uTemAntes, temAntes)
      gl.uniform1f(u.uTemDepois, temDepois)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }

    requestAnimationFrame(desenhar)
  }
}
