# Universo 3D Shorts

Estúdio para produzir **YouTube Shorts sobre curiosidades do universo** com animações 3D feitas em HTML/JavaScript ([Three.js](https://threejs.org)).

- Formato vertical **1080×1920, 30 fps**: o formato que o Shorts espera
- Legendas animadas com destaque em cores, no estilo dos Shorts
- Gravação **quadro a quadro** em MP4. O vídeo sai sem travadas mesmo num PC fraco.
- Trilha ambiente gerada automaticamente (sem direitos autorais), ou a sua própria música
- Arquivo `.txt` com título, descrição, hashtags e tags prontos para o upload

## Shorts incluídos

| # | Short | Duração |
|---|-------|---------|
| 01 | Uma colher de estrela de nêutrons pesa 1 bilhão de toneladas | 34 s |
| 02 | Em Vênus, um dia dura mais que um ano | 36 s |
| 03 | O quão pequena a Terra é? (Terra → Betelgeuse) | 40 s |
| 04 | O que acontece se você cair em um buraco negro? | 36 s |

## Como usar

Requisitos: [Node.js 18+](https://nodejs.org) e [ffmpeg](https://ffmpeg.org/download.html) instalado no PATH.

```bash
npm install                                              # three.js + fonte
npm i -D playwright && npx playwright install chromium   # só para gravar MP4
```

### 1. Assistir / editar (preview ao vivo)

```bash
npm run dev
```
Abra **http://localhost:5173**. Você verá a galeria de shorts. No player:
- `espaço` para play/pause, `←` `→` para avançar ou voltar 1 s, e a barra para navegar
- **zona segura** mostra em vermelho o que a interface do YouTube cobre (botões e título)
- `player.html?s=04-buraco-negro&t=12` congela no segundo 12

### 2. Gravar o MP4

```bash
npm run record -- 01                       # grava out/01-estrela-de-neutrons.mp4 (+ .txt)
npm run record -- 01 --audio musica.mp3    # usa sua música
npm run record -- 01 --no-audio            # sem áudio (para editar no CapCut)
npm run record -- 01 --still 9             # capa PNG do segundo 9
npm run record -- 01 --from 10 --to 15     # só um trecho (para testar)
npm run record:all                         # grava todos
```
A gravação leva alguns minutos por short (num PC com placa de vídeo, bem menos).

### 3. Finalizar e publicar

1. (Opcional) Abra o MP4 no **CapCut** e adicione narração (pode ser a sua voz ou um TTS) e uma música em alta
2. Faça o upload pelo app do YouTube. Vídeos verticais de até 3 min viram Short automaticamente
3. Copie título, descrição e hashtags do arquivo `out/<id>.txt`

Veja o plano do canal e 30 ideias de pauta em [`docs/ESTRATEGIA.md`](docs/ESTRATEGIA.md).

## Criar um short novo

1. Copie `shorts/_modelo.js` para `shorts/05-meu-tema.js`
2. Adicione o novo arquivo em `shorts/manifest.js`
3. Edite as legendas (`captions`), os objetos 3D (`setup`) e a animação (`update`)
4. Abra `http://localhost:5173/player.html?s=05-meu-tema` e ajuste até ficar bom

**Regra de ouro:** `update(t)` deve depender **só do tempo `t`**. Assim cada quadro gravado é idêntico ao preview.

Peças prontas em `engine/space.js`:

| Função | O que faz |
|--------|-----------|
| `createStarMaterial({color, hot})` | superfície de estrela animada (Sol, gigantes vermelhas, anãs azuis) |
| `planetTexture({kind, stops})` | textura procedural: `rocky` (Terra/Marte), `gas` (Júpiter/Saturno), `clouds` |
| `createAtmosphere(raio, cor)` | brilho de atmosfera na borda |
| `createGlow(cor, tamanho)` | halo de luz |
| `createArcArrow({...})` | seta curva indicando movimento |
| `keyframes(t, [[t0,v0],[t1,v1]])` | anima um valor por keyframes com suavização |
| `phase(t, a, b)` | progresso 0→1 suavizado entre os segundos `a` e `b` |

Legendas: `*texto*` fica **amarelo**, `**texto**` fica **ciano** e `\n` quebra a linha.

Troque o @ do canal em `config.js`.

## Estrutura

```
config.js            nome/@ do canal
index.html           galeria
player.html          player/gravador de um short
engine/engine.js     renderer, bloom, legendas, loop
engine/space.js      peças 3D e utilitários
shorts/*.js          um arquivo por short
tools/record.mjs     gravação MP4 (Playwright + ffmpeg)
docs/ESTRATEGIA.md   plano do canal + 30 ideias de pauta
```
