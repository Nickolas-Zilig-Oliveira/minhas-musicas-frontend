/* Fundo líquido: um shader de tela cheia que troca de cor com a música do centro */

const canvas = document.getElementById("fundo")
const gl = canvas && canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power" })

const lista = document.getElementById("listaMusicas")
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

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = (uv - 0.5) * vec2(uRes.x / uRes.y, 1.0) * 1.7;
  float t = uTime * (0.06 + 0.10 * uEnergia);

  vec2 q = vec2(fbm(p + t), fbm(p + vec2(5.2, 1.3) - t));
  vec2 r = vec2(fbm(p + 3.0 * q + vec2(1.7, 9.2) + 0.4 * t),
                fbm(p + 3.0 * q + vec2(8.3, 2.8) - 0.4 * t));
  float f = fbm(p + 3.0 * r);

  vec3 cor = mix(uC1, uC2, clamp(f * 1.7, 0.0, 1.0));
  cor = mix(cor, uC3, clamp(length(q) * 0.85, 0.0, 1.0) * 0.7);
  cor = mix(cor, vec3(0.02, 0.02, 0.06), 0.40);
  float lum = dot(cor, vec3(0.299, 0.587, 0.114));
  cor = mix(vec3(lum), cor, 1.45);

  float d = distance(uv, uMouse);
  cor += uC2 * 0.20 * smoothstep(0.5, 0.0, d);

  float pulso = 0.5 + 0.5 * sin(uTime * 2.2 + f * 6.0);
  cor += uC3 * 0.07 * uEnergia * pulso;

  float vinheta = smoothstep(1.35, 0.35, length(uv - 0.5) * 1.5);
  cor *= mix(0.55, 1.0, vinheta);

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
  let hex = texto.trim().replace("#", "")
  if (hex.length === 3) {
    hex = hex.split("").map((letra) => letra + letra).join("")
  }
  const numero = parseInt(hex, 16)
  if (isNaN(numero)) {
    return [0.4, 0.3, 0.9]
  }
  return [(numero >> 16) / 255, ((numero >> 8) & 255) / 255, (numero & 255) / 255]
}

function lerRgb(elemento, variavel) {
  return hexParaRgb(getComputedStyle(elemento).getPropertyValue(variavel))
}

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

    const uRes = gl.getUniformLocation(programa, "uRes")
    const uTime = gl.getUniformLocation(programa, "uTime")
    const uEnergia = gl.getUniformLocation(programa, "uEnergia")
    const uMouse = gl.getUniformLocation(programa, "uMouse")
    const uC1 = gl.getUniformLocation(programa, "uC1")
    const uC2 = gl.getUniformLocation(programa, "uC2")
    const uC3 = gl.getUniformLocation(programa, "uC3")

    document.documentElement.classList.add("com-webgl")

    let escala = 0.5
    let tempo = 0
    let energia = 0
    let ultimo = performance.now()
    let somaQuadros = 0
    let contaQuadros = 0

    let atual = [lerRgb(document.documentElement, "--c1"), lerRgb(document.documentElement, "--c2"), lerRgb(document.documentElement, "--c3")]
    let alvo = atual.map((cor) => cor.slice())
    let mouse = [0.5, 0.5]
    let mouseAlvo = [0.5, 0.5]

    function ajustarTamanho() {
      canvas.width = Math.max(2, Math.floor(window.innerWidth * escala))
      canvas.height = Math.max(2, Math.floor(window.innerHeight * escala))
      gl.viewport(0, 0, canvas.width, canvas.height)
    }

    ajustarTamanho()
    window.addEventListener("resize", ajustarTamanho)

    /* cores = as da música que está no centro do carrossel */
    let agendado = false

    function descobrirCores() {
      agendado = false
      let fonte = document.documentElement

      if (lista) {
        const cartoes = lista.querySelectorAll(".musica")
        if (cartoes.length > 0) {
          const caixa = lista.getBoundingClientRect()
          const centro = caixa.left + caixa.width / 2
          let menor = Infinity
          cartoes.forEach((cartao) => {
            const c = cartao.getBoundingClientRect()
            const distancia = Math.abs(c.left + c.width / 2 - centro)
            if (distancia < menor) {
              menor = distancia
              fonte = cartao
            }
          })
        }
      }

      alvo = [lerRgb(fonte, "--c1"), lerRgb(fonte, "--c2"), lerRgb(fonte, "--c3")]
    }

    function agendar() {
      if (!agendado) {
        agendado = true
        requestAnimationFrame(descobrirCores)
      }
    }

    if (lista) {
      lista.addEventListener("scroll", agendar, { passive: true })
      new MutationObserver(agendar).observe(lista, { childList: true })
    }
    window.addEventListener("resize", agendar)
    agendar()

    /* mouse: luz que segue o cursor e inclinação da capa */
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

      gl.uniform2f(uRes, canvas.width, canvas.height)
      gl.uniform1f(uTime, tempo)
      gl.uniform1f(uEnergia, energia)
      gl.uniform2f(uMouse, mouse[0], mouse[1])
      gl.uniform3fv(uC1, atual[0])
      gl.uniform3fv(uC2, atual[1])
      gl.uniform3fv(uC3, atual[2])
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }

    requestAnimationFrame(desenhar)
  }
}
