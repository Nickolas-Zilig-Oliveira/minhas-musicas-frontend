const urlBackend = "https://minhas-musicas-backend-eta.vercel.app"

const inputTitulo = document.getElementById("titulo")
const inputArtista = document.getElementById("artista")
const inputGenero = document.getElementById("genero")
const inputAno = document.getElementById("ano")
const inputDuracao = document.getElementById("duracao")
const inputSpotify = document.getElementById("spotify")

const botaoCadastrar = document.getElementById("botaoCadastrar")

inputSpotify.addEventListener("input", () => mostrarCapaNoFundo(inputSpotify.value))

botaoCadastrar.addEventListener("click", cadastrarMusica)

async function cadastrarMusica() {
if (
inputTitulo.value === "" ||
inputArtista.value === "" ||
inputGenero.value === "" ||
inputAno.value === "" ||
inputDuracao.value === ""
) {
alert("Preencha todos os campos!")
return
}

const musica = {
titulo: inputTitulo.value,
artista: inputArtista.value,
genero: inputGenero.value,
ano: inputAno.valueAsNumber,
duracao: inputDuracao.valueAsNumber,
spotify: inputSpotify.value
}

const resposta = await fetch(`${urlBackend}/cadastrar`, {
method: "POST",
headers: {
"Content-Type": "application/json"
},
body: JSON.stringify(musica)
})

const respostaTransformada = await resposta.json()

alert(respostaTransformada.mensagem)

window.location.href = "index.html"
}
