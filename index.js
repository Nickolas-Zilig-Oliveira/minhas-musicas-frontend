const urlBackend = "https://minhas-musicas-backend-eta.vercel.app"

const listaMusicas = document.getElementById("listaMusicas")

async function buscarMusicas() {
const resposta = await fetch(urlBackend)
const musicas = await resposta.json()

musicas.forEach((musica) => {
listaMusicas.innerHTML += `
<article class="musica" data-spotify="${musica.spotify || ""}">
<h2>${musica.titulo}</h2>
<p class="artista">${musica.artista}</p>
<p class="detalhes">${musica.genero} | ${musica.ano} | ${musica.duracao} min</p>
<div class="acoes">
<button class="tocar" onclick="tocarMusica('${musica.spotify}')">▶ Tocar</button>
<a class="editar" href="editar.html?id=${musica.id}">Editar</a>
<button class="apagar" onclick="apagarMusica(${musica.id})">Apagar</button>
</div>
</article>
`
})

listaMusicas.querySelectorAll(".musica").forEach(prepararCartao)
atualizarCentro()
}

buscarMusicas()

async function apagarMusica(id) {
const confirmou = confirm("Tem certeza que quer apagar essa música?")

if (!confirmou) {
return
}

const resposta = await fetch(`${urlBackend}/apagar/${id}`, {
method: "DELETE"
})

const respostaTransformada = await resposta.json()

alert(respostaTransformada.mensagem)

window.location.reload()
}

const player = document.getElementById("player")
const botaoFecharPlayer = document.getElementById("fecharPlayer")
const avisoSom = document.getElementById("avisoSom")
const caixaDoPlayer = document.getElementById("playerSpotify")

let apiSpotify = null
let controladorSpotify = null
let numeroDoPlayer = 0

let tocarSozinho = true
let somLiberado = false
let tocando = false
let posicao = 0

let uriDesejada = null
let uriNoPlayer = null

let cartaoCentral = null
let esperaParaTocar = null

function uriDe(link) {
const id = idDaFaixa(link)
return id ? "spotify:track:" + id : null
}

/* cada cartão ganha a capa de verdade e as cores dela */
function prepararCartao(cartao) {
buscarCapa(cartao.dataset.spotify).then((capa) => {
if (!capa) {
return
}

cartao.capa = capa
cartao.style.setProperty("--arte", `url("${capa.endereco}")`)
capa.cores.forEach((cor, i) => cartao.style.setProperty(`--c${i + 1}`, cor))
cartao.classList.add("com-capa")

if (cartao === cartaoCentral) {
mudarClima(capa.cores, capa.imagem)
}
})
}

function avisarFundo(cartao) {
if (cartao.capa) {
mudarClima(cartao.capa.cores, cartao.capa.imagem)
return
}

const estilo = getComputedStyle(cartao)
mudarClima(["--c1", "--c2", "--c3"].map((nome) => estilo.getPropertyValue(nome).trim()), null)
}

/* descobre qual música está "aberta", no meio da tela */
function atualizarCentro() {
const caixa = listaMusicas.getBoundingClientRect()
const meio = caixa.left + caixa.width / 2
let escolhido = null
let menor = Infinity

listaMusicas.querySelectorAll(".musica").forEach((cartao) => {
const c = cartao.getBoundingClientRect()
const distancia = Math.abs(c.left + c.width / 2 - meio)
if (distancia < menor) {
menor = distancia
escolhido = cartao
}
})

if (!escolhido || escolhido === cartaoCentral) {
return
}

if (cartaoCentral) {
cartaoCentral.classList.remove("central")
}

cartaoCentral = escolhido
cartaoCentral.classList.add("central")
avisarFundo(cartaoCentral)

clearTimeout(esperaParaTocar)
esperaParaTocar = setTimeout(tocarCentral, 600)
}

function tocarCentral() {
if (!tocarSozinho || !cartaoCentral) {
return
}

const uri = uriDe(cartaoCentral.dataset.spotify)

if (uri) {
abrirNoPlayer(uri)
return
}

uriDesejada = null

if (controladorSpotify) {
controladorSpotify.pause()
}
}

function retomar() {
if (posicao > 0) {
controladorSpotify.resume()
} else {
controladorSpotify.play()
}
}

function abrirNoPlayer(uri) {
uriDesejada = uri

if (!apiSpotify) {
return
}

player.classList.add("aberto")

if (uri !== uriNoPlayer) {
criarPlayer(uri)
} else if (controladorSpotify && !tocando) {
retomar()
}
}

/* um player novo a cada música: reaproveitar o antigo faz o Spotify pausar e mostrar anúncio */
function criarPlayer(uri) {
if (controladorSpotify) {
controladorSpotify.destroy()
controladorSpotify = null
}

uriNoPlayer = uri
posicao = 0
tocando = false
window.musicaTocando = false
document.body.classList.remove("tocando")

const numero = ++numeroDoPlayer
const alvo = document.createElement("div")
caixaDoPlayer.replaceChildren(alvo)

apiSpotify.createController(alvo, { uri: uri, width: "100%", height: 80 }, (controlador) => {
/* a pessoa já passou para outra música enquanto este carregava */
if (numero !== numeroDoPlayer) {
controlador.destroy()
return
}

controladorSpotify = controlador

controlador.addListener("ready", () => {
if (tocarSozinho && numero === numeroDoPlayer) {
controlador.play()
}
})

controlador.addListener("playback_update", (evento) => {
if (numero !== numeroDoPlayer) {
return
}

tocando = !evento.data.isPaused
posicao = evento.data.position
window.musicaTocando = tocando
document.body.classList.toggle("tocando", tocando)

if (tocando) {
somLiberado = true
avisoSom.classList.remove("visivel")
}
})

/* se o navegador segurou o som, avisa que falta um clique */
setTimeout(() => {
if (!somLiberado && tocarSozinho) {
avisoSom.classList.add("visivel")
}
}, 3500)
})
}

window.onSpotifyIframeApiReady = (IFrameAPI) => {
apiSpotify = IFrameAPI

if (uriDesejada) {
abrirNoPlayer(uriDesejada)
}
}

function tocarMusica(link) {
const uri = uriDe(link)

if (!uri) {
alert("Essa música não tem link do Spotify.")
return
}

tocarSozinho = true
abrirNoPlayer(uri)
}

/* navegadores só liberam som depois da primeira interação da pessoa */
function primeiroToque(evento) {
if (somLiberado || !tocarSozinho || !controladorSpotify) {
return
}

if (evento.target.closest && evento.target.closest(".tocar, .apagar, a, #player")) {
return
}

retomar()
}

document.addEventListener("pointerdown", primeiroToque)
document.addEventListener("keydown", primeiroToque)

/* clicar em um cartão do lado abre aquela música */
listaMusicas.addEventListener("click", (evento) => {
const cartao = evento.target.closest(".musica")

if (!cartao || cartao === cartaoCentral || evento.target.closest("a, .apagar")) {
return
}

tocarSozinho = true
cartao.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" })
})

let quadroAgendado = false

listaMusicas.addEventListener("scroll", () => {
if (quadroAgendado) {
return
}

quadroAgendado = true
requestAnimationFrame(() => {
quadroAgendado = false
atualizarCentro()
})
}, { passive: true })

botaoFecharPlayer.addEventListener("click", () => {
tocarSozinho = false
clearTimeout(esperaParaTocar)

if (controladorSpotify) {
controladorSpotify.pause()
}

player.classList.remove("aberto")
avisoSom.classList.remove("visivel")
document.body.classList.remove("tocando")
window.musicaTocando = false
})

document.addEventListener("keydown", (evento) => {
if (evento.target.tagName === "INPUT") {
return
}

const passo = listaMusicas.firstElementChild ? listaMusicas.firstElementChild.offsetWidth + 34 : 400

if (evento.key === "ArrowRight") {
listaMusicas.scrollBy({ left: passo, behavior: "smooth" })
}

if (evento.key === "ArrowLeft") {
listaMusicas.scrollBy({ left: -passo, behavior: "smooth" })
}
})
