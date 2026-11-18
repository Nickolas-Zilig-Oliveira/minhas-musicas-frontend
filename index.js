const urlBackend = "https://minhas-musicas-backend-eta.vercel.app"

const listaMusicas = document.getElementById("listaMusicas")

async function buscarMusicas() {
const resposta = await fetch(urlBackend)
const musicas = await resposta.json()

musicas.forEach((musica) => {
listaMusicas.innerHTML += `
<article class="musica">
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

let apiSpotify = null
let controladorSpotify = null

window.onSpotifyIframeApiReady = (IFrameAPI) => {
apiSpotify = IFrameAPI
}

function tocarMusica(link) {
if (!link || link === "null" || !link.includes("/track/")) {
alert("Essa música não tem link do Spotify.")
return
}

if (!apiSpotify) {
alert("O player do Spotify ainda está carregando, tente de novo.")
return
}

const uri = "spotify:track:" + link.split("/track/")[1].split("?")[0]

player.classList.add("aberto")

if (controladorSpotify) {
controladorSpotify.loadUri(uri)
controladorSpotify.play()
return
}

apiSpotify.createController(document.getElementById("playerSpotify"), { uri: uri, width: "100%", height: 152 }, (controlador) => {
controladorSpotify = controlador
controlador.addListener("ready", () => {
controlador.play()
})
controlador.addListener("playback_update", (evento) => {
window.musicaTocando = !evento.data.isPaused
})
})
}

botaoFecharPlayer.addEventListener("click", () => {
if (controladorSpotify) {
controladorSpotify.pause()
}

player.classList.remove("aberto")
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
