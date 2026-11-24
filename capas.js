/* Capa do álbum: busca no Spotify, descobre as cores dela e avisa o fundo */

const capasGuardadas = new Map()

function idDaFaixa(link) {
  const achou = String(link || "").match(/track[/:]([A-Za-z0-9]{10,})/)
  return achou ? achou[1] : null
}

function carregarImagem(endereco) {
  return new Promise((resolver, rejeitar) => {
    const imagem = new Image()
    imagem.crossOrigin = "anonymous"
    imagem.onload = () => resolver(imagem)
    imagem.onerror = rejeitar
    imagem.src = endereco
  })
}

function rgbParaHsl(r, g, b) {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  if (d === 0) {
    return [0, 0, l]
  }
  const s = d / (1 - Math.abs(2 * l - 1))
  let h = 0
  if (max === r) h = ((g - b) / d) % 6
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return [(h * 60 + 360) % 360, s, l]
}

function hslParaHex(h, s, l) {
  const a = s * Math.min(l, 1 - l)
  const canal = (n) => {
    const k = (n + h / 30) % 12
    const valor = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(valor * 255).toString(16).padStart(2, "0")
  }
  return "#" + canal(0) + canal(8) + canal(4)
}

function limitar(valor, minimo, maximo) {
  return Math.min(maximo, Math.max(minimo, valor))
}

/* separa os pixels em 12 famílias de cor e fica com as 3 mais marcantes */
function coresDaImagem(imagem) {
  const tela = document.createElement("canvas")
  tela.width = tela.height = 40
  const pincel = tela.getContext("2d", { willReadFrequently: true })
  pincel.drawImage(imagem, 0, 0, 40, 40)
  const pixels = pincel.getImageData(0, 0, 40, 40).data

  const familias = Array.from({ length: 12 }, () => ({ peso: 0, x: 0, y: 0, s: 0, l: 0 }))
  let claridadeTotal = 0

  for (let i = 0; i < pixels.length; i += 4) {
    const [h, s, l] = rgbParaHsl(pixels[i] / 255, pixels[i + 1] / 255, pixels[i + 2] / 255)
    claridadeTotal += l
    const peso = s * s * (1 - Math.abs(l - 0.5) * 1.6)
    if (peso <= 0.02) continue
    const familia = familias[Math.floor(h / 30) % 12]
    familia.peso += peso
    familia.x += Math.cos((h * Math.PI) / 180) * peso
    familia.y += Math.sin((h * Math.PI) / 180) * peso
    familia.s += s * peso
    familia.l += l * peso
  }

  const cores = familias
    .filter((familia) => familia.peso > 2)
    .sort((a, b) => b.peso - a.peso)
    .slice(0, 3)
    .map((familia) => {
      const h = ((Math.atan2(familia.y, familia.x) * 180) / Math.PI + 360) % 360
      return [h, limitar(familia.s / familia.peso, 0.55, 0.95), limitar(familia.l / familia.peso, 0.42, 0.66)]
    })

  /* capa quase sem cor (preto, branco, creme): usa um tom neutro */
  if (cores.length === 0) {
    const media = claridadeTotal / (pixels.length / 4)
    cores.push([30, 0.25, limitar(media, 0.35, 0.65)])
  }

  while (cores.length < 3) {
    const [h, s, l] = cores[0]
    cores.push([(h + 35 * cores.length) % 360, s, limitar(l + (cores.length === 1 ? -0.16 : 0.14), 0.25, 0.72)])
  }

  return cores.map(([h, s, l]) => hslParaHex(h, s, l))
}

function buscarCapa(link) {
  const id = idDaFaixa(link)
  if (!id) {
    return Promise.resolve(null)
  }

  if (!capasGuardadas.has(id)) {
    const promessa = fetch(`https://open.spotify.com/oembed?url=https://open.spotify.com/track/${id}`)
      .then((resposta) => resposta.json())
      .then(async (dados) => {
        const pequena = dados.thumbnail_url
        /* o mesmo endereço com este código entrega a capa em 640px */
        const grande = pequena.replace("ab67616d00001e02", "ab67616d0000b273")
        let endereco = grande
        let imagem
        try {
          imagem = await carregarImagem(grande)
        } catch (erro) {
          endereco = pequena
          imagem = await carregarImagem(pequena)
        }
        return { endereco, imagem, cores: coresDaImagem(imagem) }
      })
      .catch(() => {
        capasGuardadas.delete(id)
        return null
      })
    capasGuardadas.set(id, promessa)
  }

  return capasGuardadas.get(id)
}

function mudarClima(cores, imagem) {
  /* os detalhes da tela (botões, ícones) seguem a mesma capa */
  cores.forEach((cor, i) => document.documentElement.style.setProperty(`--c${i + 1}`, cor))
  window.climaAtual = { cores, imagem }
  window.dispatchEvent(new CustomEvent("clima", { detail: window.climaAtual }))
}

/* usado no cadastro e na edição: o fundo acompanha o link digitado */
let linkPedido = ""

async function mostrarCapaNoFundo(link) {
  linkPedido = link
  const capa = await buscarCapa(link)
  if (capa && linkPedido === link) {
    mudarClima(capa.cores, capa.imagem)
  }
}
