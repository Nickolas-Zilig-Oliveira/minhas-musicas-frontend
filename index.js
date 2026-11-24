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
let posicao = 0
let duracao = 0
let ultimoAvanco = 0
let ultimaTentativa = 0
let vigia = null

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
clearInterval(vigia)

if (controladorSpotify) {
controladorSpotify.pause()
}
}

/* "tocando" só vale quando o tempo da música está andando de verdade:
o Spotify avisa que está tocando mesmo quando o navegador bloqueou o som */
function estaTocando() {
return Date.now() - ultimoAvanco < 2000
}

function darPlay() {
ultimaTentativa = Date.now()

if (posicao > 0 && posicao < duracao - 1000) {
controladorSpotify.resume()
} else {
controladorSpotify.play()
}
}

function mostrarAviso(texto) {
avisoSom.textContent = texto
avisoSom.classList.add("visivel")
}

function esconderAviso() {
avisoSom.classList.remove("visivel")
}

/* depois de pedir uma música, confere se ela começou; se não, tenta de novo */
function vigiar() {
clearInterval(vigia)
let tentativas = 0

vigia = setInterval(() => {
if (!tocarSozinho || estaTocando()) {
clearInterval(vigia)
return
}

if (!controladorSpotify) {
return
}

tentativas++

if (navigator.userActivation && !navigator.userActivation.hasBeenActive) {
mostrarAviso("🔊 Clique em qualquer lugar para ligar o som")
}

if (tentativas === 1 || tentativas === 3) {
darPlay()
} else if (tentativas === 2) {
/* um player novo destrava quando o Spotify fica preso */
criarPlayer(uriNoPlayer)
} else {
mostrarAviso("▶ Toque no play do player aqui embaixo")
clearInterval(vigia)
}
}, 2500)
}

function abrirNoPlayer(uri) {
uriDesejada = uri

if (!apiSpotify) {
return
}

player.classList.add("aberto")

if (uri !== uriNoPlayer) {
trocarFaixa(uri)
} else if (controladorSpotify && !estaTocando()) {
darPlay()
}

vigiar()
}

function zerarFaixa(uri) {
uriNoPlayer = uri
posicao = 0
duracao = 0
ultimoAvanco = 0
marcarTocando(false)
}

function marcarTocando(valor) {
window.musicaTocando = valor
document.body.classList.toggle("tocando", valor)
}

function trocarFaixa(uri) {
if (!controladorSpotify) {
criarPlayer(uri)
return
}

zerarFaixa(uri)
controladorSpotify.loadUri(uri)
controladorSpotify.play()
}

function criarPlayer(uri) {
if (controladorSpotify) {
controladorSpotify.destroy()
controladorSpotify = null
}

zerarFaixa(uri)

const numero = ++numeroDoPlayer
const alvo = document.createElement("div")
caixaDoPlayer.replaceChildren(alvo)

apiSpotify.createController(alvo, { uri: uri, width: "100%", height: 80 }, (controlador) => {
/* já foi pedido outro player enquanto este carregava */
if (numero !== numeroDoPlayer) {
controlador.destroy()
return
}

controladorSpotify = controlador

controlador.addListener("ready", () => {
if (tocarSozinho && numero === numeroDoPlayer && !estaTocando()) {
controlador.play()
}
})

controlador.addListener("playback_update", (evento) => {
if (numero !== numeroDoPlayer) {
return
}

const { isPaused, isBuffering, position, duration } = evento.data

if (isPaused) {
ultimoAvanco = 0
} else if (!isBuffering && position > 0 && position !== posicao) {
ultimoAvanco = Date.now()
esconderAviso()
}

posicao = position
duracao = duration
marcarTocando(estaTocando())
})
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

/* qualquer clique, toque ou tecla liga a música aberta, se ela estiver parada */
function aoInteragir(evento) {
if (!tocarSozinho || !cartaoCentral || estaTocando()) {
return
}

if (evento.key === "ArrowLeft" || evento.key === "ArrowRight") {
return
}

if (evento.target.closest && evento.target.closest(".tocar, .apagar, a, #player, .musica:not(.central)")) {
return
}

if (Date.now() - ultimaTentativa < 700) {
return
}

tocarCentral()
}

document.addEventListener("pointerup", aoInteragir)
document.addEventListener("touchend", aoInteragir)
document.addEventListener("keydown", aoInteragir)

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
clearInterval(vigia)

if (controladorSpotify) {
controladorSpotify.pause()
}

player.classList.remove("aberto")
esconderAviso()
marcarTocando(false)
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
