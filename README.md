# Stream Overlay Kit — Minimal

Kit de overlays minimalistas para transmissões ao vivo, pronto para **Twitch 16:9** e **TikTok 9:16**. Um único arquivo HTML, sem instalação, sem dependências, com painel de controle ao vivo via Supabase.

---

## Cenas disponíveis

| Cena | `scene=` | Descrição |
|------|----------|-----------|
| Jogo | `game` | Gameplay + webcam + chat + info de jogo |
| React | `react` | Janela de vídeo + webcam + chat, título de filme/série editável |
| React Livre | `reactfree` | Igual ao React, sem título — para qualquer conteúdo |
| Just Chatting | `chatting` | Câmera grande + chat ao vivo |
| IRL | `irl` | Câmera full-screen com pin de localização |
| Começando | `start` | Tela de abertura com ticker e redes sociais |
| Volto já | `brb` | Tela de pausa com ticker e redes sociais |
| Fim | `end` | Tela de encerramento com mensagem e redes sociais configuráveis |

Cada cena funciona nos dois formatos (16:9 e 9:16) com layout otimizado.

---

## Como funciona

O overlay é uma **moldura transparente** que fica em cima das suas fontes no OBS. Os ícones de câmera/jogo/vídeo são marcadores de posição — você encaixa suas fontes reais embaixo do overlay.

As configurações ficam salvas no **Supabase** (nuvem). O OBS faz polling a cada 2,5 s e aplica qualquer mudança feita no painel sem precisar recarregar a cena.

---

## Configurando no OBS

1. Para **cada cena**, adicione uma **Fonte → Navegador (Browser Source)**
2. Use a URL copiada pelo botão **🔗 Links OBS** no painel
3. Resolução: `1920 × 1080` (Twitch) ou `1080 × 1920` (TikTok)
4. Marque **"Atualizar navegador quando a cena ficar ativa"**
5. Posicione webcam, jogo e vídeo **abaixo** do overlay na lista de fontes

A URL de cada cena tem o formato:
```
https://seu-dominio/?obs=1&scene=game&format=landscape
```

---

## Painel de controle

Abra o `index.html` no navegador (ou via servidor HTTP) sem os parâmetros `?obs=1`. O painel no topo permite configurar tudo em tempo real:

- **Formato** — Twitch 16:9 ou TikTok 9:16
- **Cena** — alterna entre as 8 cenas
- **Cor de destaque** — 6 presets + cor livre (aplicada instantaneamente)
- **Chat** — selecione a plataforma ativa e preencha os dados de todas as plataformas de uma vez
- **Spotify** — ative e conecte via OAuth PKCE (sem backend necessário)
- **Fundo** — transparente, cor sólida, gradiente ou imagem por URL
- **Estilo** — esconder badge "AO VIVO", bordas totalmente retangulares

---

## Chat

Selecione a plataforma ativa no dropdown e preencha os campos de todas as plataformas que você usa. As configurações persistem — você pode trocar de plataforma a qualquer momento sem redigitar.

| Plataforma | Como funciona |
|------------|--------------|
| Twitch | Conexão direta via tmi.js (anônima, só leitura) |
| Kick | iframe do chat oficial do Kick |
| YouTube Live | iframe do live chat (precisa do ID do vídeo) |
| TikTok / URL | iframe de qualquer URL de widget (StreamElements, Streamlabs, etc.) |
| Simulado | Mensagens fake para preview no painel |

---

## Spotify

Integração via **OAuth PKCE** — sem backend, sem segredos expostos.

**Configurar:**
1. Crie um app em [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
2. Adicione a URL do painel como **Redirect URI** no app
3. No painel: cole o **Client ID**, clique **Conectar** e autorize
4. O balão "Tocando agora" aparece automaticamente quando uma música estiver tocando
5. A faixa atual é salva no Supabase — o OBS recebe via polling, sem precisar de tokens

---

## Redes sociais

Configure no painel (seção **Redes sociais**) quais plataformas exibir e com qual @. Os badges aparecem:

- Nas cenas **game / react / reactfree / IRL / Just Chatting**: abaixo ou ao lado da webcam
- Nas cenas **Começando / Volto já / Fim**: centralizados na tela

---

## Fundo no OBS

O overlay usa um canvas para desenhar o fundo e preservar a transparência nas janelas de câmera/jogo/vídeo. Configure em **Fundo**:

- **Transparente** — sem fundo, use a cor de cena do OBS
- **Cor sólida** — cor preenchida com buraco nas janelas de câmera/jogo
- **Gradiente** — gradiente linear com ângulo configurável
- **Imagem (URL)** — imagem cover-fit com buraco nas janelas

---

## Parâmetros da URL (avançado)

| Parâmetro | Valores | Descrição |
|-----------|---------|-----------|
| `obs` | `1` | Modo OBS — esconde painel, fundo transparente |
| `scene` | `game` `react` `reactfree` `chatting` `irl` `start` `brb` `end` | Cena |
| `format` | `landscape` · `portrait` | Formato |
| `hide_live` | `1` | Esconde o badge "AO VIVO" |
| `square` | `1` | Remove cantos arredondados |

---

## Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `index.html` | Overlay completo + painel de controle |
| `COMO-USAR.md` | Guia detalhado passo a passo |
| `GUIA-OBS-TWITCH.md` | Configuração específica para Twitch |
| `teste-supabase.html` | Diagnóstico de conexão com o Supabase |
