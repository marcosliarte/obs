# Guia do Overlay Kit — Como usar no OBS

Este guia explica como instalar as cenas no OBS, trocar a webcam, o chat e o vídeo de verdade (hoje são de mentira só pra demonstração), e como editar os textos.

---

## 1. Visão geral do arquivo

Você tem **um único arquivo**: `index.html` (também disponível como `overlay-kit.html`). Ele contém todas as 7 cenas, nos dois formatos (Twitch 16:9 e TikTok 9:16).

Ao abrir no navegador, aparece um **painel de controle no topo** (que NÃO vai pro OBS). Lá você escolhe formato, cena, cor de destaque e copia o link pronto pra colar no OBS.

As 7 cenas são: **Jogo**, **React**, **React Livre**, **Just Chatting**, **Começando**, **Volto já** e **Fim**.

> A cena **React Livre** é igual à React, mas sem nome de filme/série nem barra de info. Serve pra reagir a qualquer coisa (vídeo, tela do PC, site). Use `scene=reactfree` na URL.

### Hospedado no GitHub Pages

Se você ativou o GitHub Pages (Settings → Pages → branch main), o kit fica acessível por URL:
```
https://marcosliarte.github.io/obs/
```
Aí no OBS você usa a URL direto, sem precisar de arquivo local. Veja exemplos no README.md.

---

## 2. Como o overlay funciona (importante)

Os quadradinhos com ícones 📷 🎮 ▶️ **são apenas marcadores de posição**. O overlay é uma **moldura transparente** que fica POR CIMA das suas fontes reais no OBS. Ou seja:

- O overlay desenha as bordas, títulos das janelas, chat e textos.
- VOCÊ posiciona a webcam, a captura de jogo e o vídeo **embaixo** do overlay, encaixando dentro de cada janela.

Pense no overlay como uma "moldura de quadro" e suas fontes reais como as "fotos" que vão dentro.

---

## 3. Instalando uma cena no OBS

Para cada cena que quiser usar:

1. No OBS, crie uma **Cena** nova (ex: "Jogo", "React", "Volto já").
2. Adicione uma fonte do tipo **Navegador / Browser**.
3. Marque **Arquivo local (Local file)** e selecione o `overlay-kit.html`.
   - OU cole uma **URL** (recomendado — explico no passo 4).
4. Defina a resolução:
   - **Twitch:** Largura `1920`, Altura `1080`
   - **TikTok:** Largura `1080`, Altura `1920`
5. Marque a opção **"Atualizar navegador quando a cena ficar ativa"** (Refresh browser when scene becomes active).

Pronto, a moldura aparece. Agora é só adicionar suas fontes reais (próximo passo).

---

## 4. Travando uma cena pela URL (jeito recomendado)

Em vez de abrir o painel toda vez, você "trava" qual cena quer usando parâmetros na URL. No painel de controle, configure a cena do jeito que quer e clique em **"🔗 Copiar link p/ OBS"** — ele copia a URL pronta. Cole no campo URL da fonte de Navegador no OBS.

A URL tem este formato:

```
.../overlay-kit.html?scene=game&format=landscape&obs=1&color=d6f24b
```

Parâmetros disponíveis:

| Parâmetro | Valores | O que faz |
|-----------|---------|-----------|
| `scene`   | `game`, `react`, `reactfree`, `chatting`, `start`, `brb`, `end` | Qual cena mostrar |
| `format`  | `landscape` (Twitch) ou `portrait` (TikTok) | Formato |
| `obs`     | `1` | Esconde o painel e deixa o fundo transparente |
| `color`   | hex sem `#` (ex: `d6f24b`) | Cor de destaque |

> O `obs=1` é o que faz o painel sumir e o fundo ficar transparente. **Sempre inclua no OBS.**

---

## 5. Editando a cena de REACT (filme / série)

Na aba **React** do painel aparece um editor rápido:

- Botão **🎬 Filme / 📺 Série** — alterna o tipo.
- **Filme:** só o campo de título.
- **Série:** título + temporada + episódio.
- **Nota (opcional):** texto extra que aparece em cinza no final (ex: "parte 2", "rewatch").

Tudo atualiza na hora enquanto você digita. Depois é só clicar em **"🔗 Copiar link da cena"** pra pegar a URL com tudo embutido, por exemplo:

```
...?scene=react&format=landscape&obs=1&rtype=series&rtitle=The%20Last%20of%20Us&rseason=2&repisode=5&rnote=rewatch
```

Parâmetros extras do react:

| Parâmetro | Exemplo | Observação |
|-----------|---------|------------|
| `rtype`    | `movie` ou `series` | tipo |
| `rtitle`   | `Interestelar` | espaços viram `%20` |
| `rseason`  | `2` | só série |
| `repisode` | `5` | só série |
| `rnote`    | `rewatch` | opcional |

Dica: se quiser trocar o filme/série no meio da live sem mexer na URL, deixe o arquivo aberto numa aba do navegador, edite os campos, e no OBS clique com botão direito na fonte → **Atualizar (Refresh)**.

---

## 6. Trocando a WEBCAM de verdade

1. Na cena do OBS, adicione uma fonte **Dispositivo de captura de vídeo (Video Capture Device)** e escolha sua webcam.
2. Posicione e redimensione a webcam para encaixar **dentro da janela de cam** do overlay (o quadrado com 📷 e moldura colorida).
3. **Ordem das camadas:** a webcam precisa ficar ABAIXO do overlay na lista de fontes (o overlay/Navegador fica no topo), pra moldura aparecer por cima.
4. Se quiser cantos arredondados na webcam pra combinar com a moldura, use o filtro de máscara: clique direito na webcam → **Filtros** → **+** → **Máscara/Combinação de imagem**, ou instale o plugin de cantos arredondados.

Repita pra captura de jogo (fonte **Captura de jogo / Game Capture**) e pra qualquer outra área.

---

## 7. Colocando o CHAT REAL (hoje é de mentira)

O chat atual mostra mensagens fake (`marina_o`, `pedrohq`, etc.) só pra você ver como fica. Para usar o chat de verdade, há duas opções:

### Opção A — Usar um widget de chat pronto (mais fácil)
Serviços como **StreamElements**, **Streamlabs** ou **Social Stream Ninja** geram uma URL de chat. Nesse caso você:
1. NÃO usa a janela de chat do overlay — adiciona o chat do serviço como uma fonte de Navegador separada.
2. Posiciona esse chat dentro da área onde ficaria a janela de chat.
3. Pode esconder a janela de chat do overlay se quiser (me peça uma versão "sem chat embutido").

### Opção B — Conectar o overlay ao chat da Twitch (integração no código)
O overlay já tem a função pronta pra receber mensagens:

```js
addMessage({ user: 'nome', text: 'mensagem' })   // no chat-overlay simples
// ou, neste kit, as mensagens entram pela função startChat()
```

Para alimentar com a Twitch de verdade, dá pra usar a biblioteca **tmi.js** (conexão anônima ao chat, não precisa de senha). É um trecho de código que escuta o chat e chama a função de adicionar mensagem. **Posso fazer essa integração pra você** — é só me passar o nome do seu canal da Twitch que eu deixo pronto.

> Resumindo: hoje o chat é demonstração. Me diga qual serviço você usa (StreamElements? Twitch direto?) que eu conecto o de verdade.

---

## 8. Editando textos fixos (@seunick, "SEU JOGO", etc.)

Esses textos estão dentro do arquivo `overlay-kit.html`. Para trocar:

1. Abra o arquivo num editor de texto (Bloco de Notas, VS Code, etc.).
2. Use **Localizar e Substituir** (Ctrl+H):
   - Troque `@seunick` pelo seu @.
   - Troque `SEU JOGO AQUI` / `SEU JOGO` pelo nome padrão (ou deixe genérico).
   - Nos textos das telas (Começando, Volto já, Fim) procure pelas frases e edite à vontade.
3. Salve. No OBS, atualize a fonte.

Se preferir, me diga seu @ e os textos que quer, que eu já deixo tudo preenchido.

---

## 9. Trocando a cor de destaque

No painel há 6 cores prontas + um seletor livre. A cor escolhida entra na URL como `color=XXXXXX`. Para fixar uma cor no OBS, é só copiar o link com a cor já selecionada.

---

## 10. Checklist rápido

- [ ] Uma cena do OBS por cena do overlay (Jogo, React, etc.)
- [ ] Fonte de Navegador com `obs=1` na URL
- [ ] Resolução 1920×1080 (Twitch) ou 1080×1920 (TikTok)
- [ ] Webcam / jogo / vídeo posicionados ABAIXO do overlay
- [ ] Chat real conectado (me peça a integração)
- [ ] Textos fixos editados (@ e nomes)

---

Qualquer coisa que queira mudar — proporções, cores, fontes, ou conectar o chat real — é só pedir.
