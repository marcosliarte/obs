# StreamKit

Overlays para OBS em **Twitch 16:9** e **TikTok 9:16**, com painel de controle ao vivo. Sem build e sem instalação: é HTML, CSS e JS puros, hospedados no GitHub Pages. A configuração é sincronizada pelo Supabase.

O painel mostra um preview em escala que é **idêntico** ao que o OBS renderiza: as cenas são desenhadas em pixels na resolução nativa (1920×1080 / 1080×1920).

## Cenas

| Cena | `scene=` | Conteúdo |
|------|----------|----------|
| Jogo | `game` | Captura 16:9, webcam, chat, faixa "Jogando", rodapé com widgets |
| React | `react` | Vídeo, webcam, chat, faixa com filme ou série (temporada/episódio) |
| React livre | `reactfree` | Igual ao React, sem título |
| React 2 cams | `react2cam` | Vídeo + duas webcams, sem chat |
| React sem chat | `reactnochat` | Vídeo sem moldura + webcam com borda fina e faixa do @ |
| Just Chatting | `chatting` | Webcam grande + chat |
| IRL | `irl` | Câmera em tela cheia com localização |
| Começando | `start` | Tela cheia com contagem regressiva e letreiro |
| Volto já | `brb` | Tela cheia com contagem regressiva e letreiro |
| Encerramento | `end` | Tela cheia com mensagem de despedida e redes |

## Recursos

- **Chat real** da Twitch e do Kick (separados ou juntos), com emotes, selos (streamer, mod, VIP, sub), filtro de comandos, bots e palavras, e remoção automática de mensagens apagadas ou de usuários banidos. YouTube e widgets externos entram por iframe.
- **Alertas** na tela para inscrição, reinscrição, sub de presente (agrupa "gift bombs"), raid/host e bits/kicks, com som. Botões de teste no painel disparam o alerta também no OBS.
- **Destaque do chat:** clique numa mensagem no preview para fixá-la na tela.
- **Barra de meta** com botões +1/+5. Opcionalmente soma subs sozinha.
- **Contagem regressiva** nas telas Começando e Volto já (5, 10 ou 15 min, ou até um horário).
- **Tocando agora** do Spotify com capa do álbum (OAuth PKCE, sem backend).
- **Redes sociais**, cor de destaque com contraste automático do texto, fundo (cor, gradiente ou imagem) recortado nas janelas de câmera e jogo.
- **Textos editáveis** das telas cheias (título, destaque, texto, letreiro).
- **Vários overlays** com `?id=` e **chave de escrita** para impedir que outras pessoas alterem a sua config.

## Uso rápido

1. Abra o painel: `https://marcosliarte.github.io/obs/`
2. Configure no painel. Tudo é salvo automaticamente.
3. Clique em **Links para o OBS** e cole cada link numa fonte **Navegador** do OBS, na resolução indicada.
4. Coloque webcam, jogo e vídeo **abaixo** do overlay na lista de fontes, encaixados nas janelas.

O passo a passo completo está em [COMO-USAR.md](COMO-USAR.md).

## Parâmetros de URL

| Parâmetro | Valores | Efeito |
|-----------|---------|--------|
| `obs` | `1` | Modo OBS: sem painel, fundo transparente |
| `scene` | ver tabela de cenas | Cena (modo OBS) |
| `format` | `landscape` · `portrait` | Formato (modo OBS) |
| `id` | texto | Usa outra configuração no Supabase (padrão `default`) |
| `twitch` / `kick` | canal | Força o canal do chat no OBS |
| `kickroom` | número | Chatroom ID do Kick, se a descoberta automática falhar |
| `chat` | `none` `test` `twitch` `kick` `multi` `youtube` `tiktok` `url` | Força a fonte do chat no OBS |
| `hide_live` | `1` | Oculta o selo "Ao vivo" |
| `square` | `1` | Cantos retos nos elementos |
| `debug` | `1` | Mostra versão e horário de carregamento no canto |
| `offline` | `1` | Não acessa a rede (usado nos testes) |

## Segurança

A chave do Supabase no código é pública por natureza. Sem proteção, qualquer pessoa com ela consegue alterar o que aparece na sua live. Para fechar isso, rode [`supabase/setup.sql`](supabase/setup.sql) e informe a chave de escrita no painel, na seção **Segurança**. O arquivo `teste-supabase.html` confere leitura, escrita e se a proteção está ativa.

## Estrutura

```
index.html            marcação do painel e do palco
css/overlay.css       visual do overlay (o que vai pro OBS)
css/panel.css         visual do painel
js/core.js            funções puras: config, chat, emotes, filtros, tempo (testável no Node)
js/env.js             parâmetros de URL e estado global da config
js/store.js           leitura e escrita no Supabase
js/chat.js            conexões Twitch/Kick, histórico, moderação, eventos
js/alerts.js          fila de alertas e som
js/spotify.js         OAuth PKCE e faixa atual
js/scenes.js          layouts das cenas, widgets, fundo e escala
js/panel.js           painel (campos com data-bind)
js/main.js            inicialização e polling do OBS
supabase/setup.sql    tabela, leitura pública e chave de escrita
tests/                testes unitários, de renderização e de interação
```

## Testes

Precisam de Node 18+ e Chrome ou Edge instalados. Não há dependências npm.

```bash
npm test               # funções puras (node:test)
npm run test:browser   # todas as cenas, nos 2 formatos, no Chrome headless
npm run test:panel     # simula o uso do painel (digitar, clicar, salvar)
npm run test:all
```

`node tests/smoke.js --shots pasta` salva screenshots de todas as cenas para revisão visual.
