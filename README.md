# 🎥 Stream Overlay Kit — Minimal

Kit de overlays minimalistas para transmissões ao vivo, prontos para **Twitch (16:9)** e **TikTok (9:16)**. Tudo num único arquivo HTML, sem instalação, sem dependências.

## ✨ O que vem no kit

**7 cenas**, cada uma nos dois formatos:

| Cena | `scene=` | Descrição |
|------|----------|-----------|
| 🎮 Jogo | `game` | Gameplay + webcam + chat |
| 🎬 React | `react` | Janela de vídeo + webcam + chat, com info de filme/série editável |
| ▶️ React Livre | `reactfree` | Igual à React, mas sem nome de nada — pra reagir a qualquer coisa (vídeo, tela do PC, site) |
| 💬 Just Chatting | `chatting` | Câmera grande + chat |
| ⏳ Começando | `start` | Tela de abertura "Começando já" |
| ☕ Volto já | `brb` | Tela de pausa |
| 👋 Fim | `end` | Tela de encerramento |

**Recursos:**
- Seletor de cor de destaque ao vivo (6 presets + cor livre)
- Editor rápido de filme/série na cena React (título, temporada, episódio, nota)
- 📱 Redes sociais (TikTok, Instagram, YouTube) — ative só as que você usa, com @ editável
- 🎵 Balão "Tocando agora" do Spotify (opcional, ativável por URL)
- Botão "copiar link" que monta a URL pronta pro OBS
- Animações suaves (moldura pulsante, brilho flutuante, ticker, chat com entrada animada)
- Relógio ao vivo

---

## 🚀 Como usar (3 opções)

### Opção 1 — Vercel (recomendado se você já usa)

Se você já conectou esse repo na Vercel, ela já gera a URL automaticamente algo como `https://obs-marcosliarte.vercel.app`. Use essa URL no OBS. **Vantagem da Vercel:** atualizações sobem em segundos sem precisar configurar nada.

### Opção 2 — GitHub Pages

1. No GitHub, vá em **Settings → Pages**.
2. Em "Source", escolha a branch **main** e a pasta **/ (root)**. Salve.
3. Aguarde 1-2 min. Seu kit ficará disponível em:
   ```
   https://marcosliarte.github.io/obs/
   ```

### Opção 3 — Arquivo local (necessário para usar Spotify)

1. Baixe os arquivos (clone o repo ou Download ZIP).
2. No OBS: **Fonte → Navegador → Arquivo local** e selecione o `index.html`.

> 💡 Para o **balão do Spotify** funcionar, **precisa** ser via arquivo local — porque o overlay lê um `.txt` do seu PC. Veja COMO-USAR.md.

---

## 🎬 Configurando no OBS

Para **cada cena** que quiser usar, crie uma **Cena** no OBS e adicione uma **Fonte de Navegador (Browser Source)**:

1. **URL** (GitHub Pages) ou **Arquivo local**.
2. Resolução:
   - **Twitch:** `1920` × `1080`
   - **TikTok:** `1080` × `1920`
3. Marque **"Atualizar navegador quando a cena ficar ativa"**.

### Exemplos de URL (GitHub Pages)

Cena de jogo, Twitch:
```
https://marcosliarte.github.io/obs/?scene=game&format=landscape&obs=1&color=d6f24b
```

React de uma série:
```
https://marcosliarte.github.io/obs/?scene=react&format=landscape&obs=1&rtype=series&rtitle=The%20Last%20of%20Us&rseason=2&repisode=5
```

React livre, TikTok:
```
https://marcosliarte.github.io/obs/?scene=reactfree&format=portrait&obs=1
```

> 💡 Dica: abra o `index.html`, configure a cena no painel do topo, e clique em **"🔗 Copiar link p/ OBS"** — ele monta a URL com tudo pronto.

---

## 🧩 Parâmetros da URL

| Parâmetro | Valores | Descrição |
|-----------|---------|-----------|
| `scene` | `game` `react` `reactfree` `chatting` `start` `brb` `end` | Qual cena |
| `format` | `landscape` (Twitch) · `portrait` (TikTok) | Formato |
| `obs` | `1` | **Sempre use no OBS** — esconde o painel e deixa o fundo transparente |
| `color` | hex sem `#` (ex: `d6f24b`) | Cor de destaque |
| `rtype` | `movie` · `series` | (React) tipo |
| `rtitle` | texto | (React) título — espaços viram `%20` |
| `rseason` | número | (React) temporada (só série) |
| `repisode` | número | (React) episódio (só série) |
| `rnote` | texto | (React) nota opcional (ex: "parte 2") |
| `spotify` | `1` | Mostra balão "Tocando agora" do Spotify (requer Snip — veja COMO-USAR.md) |
| `s_tiktok` | texto | @ do TikTok (sem `@`) — exibe badge abaixo da webcam |
| `s_instagram` | texto | @ do Instagram |
| `s_youtube` | texto | @ do YouTube |

---

## 🖼️ Como funciona o overlay

Os ícones 📷 🎮 ▶️ são **apenas marcadores de posição**. O overlay é uma **moldura transparente** que fica POR CIMA das suas fontes reais no OBS.

- O overlay desenha bordas, títulos, chat e textos.
- **Você** posiciona webcam, captura de jogo e vídeo **embaixo** do overlay, encaixando em cada janela.
- No modo OBS (`obs=1`) o fundo é transparente — só as telas Começando/Volto já/Fim têm fundo escuro próprio (porque cobrem tudo).

---

## 💬 Sobre o chat

O chat mostra **mensagens de demonstração** (fake). Para usar o chat real você pode:

- **Widget pronto:** usar StreamElements / Streamlabs como uma fonte de navegador separada, posicionada na área do chat.
- **Integração direta:** conectar ao chat da Twitch via `tmi.js` (conexão anônima). Veja `COMO-USAR.md` para detalhes.

---

## ✏️ Editando textos fixos

O `@seunick` e nomes genéricos como "SEU JOGO" estão dentro do `index.html`. Abra num editor de texto, use Localizar e Substituir (Ctrl+H), troque pelo seu, e salve.

---

## 📄 Documentação completa

Veja **[COMO-USAR.md](COMO-USAR.md)** para o guia detalhado passo a passo.

---

*Feito para transmissões ao vivo. Sem dependências, sem build, sem complicação.*
