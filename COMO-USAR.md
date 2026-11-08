# Como usar o StreamKit

## 1. O painel

Abra `https://marcosliarte.github.io/obs/` (ou o `index.html` por um servidor local). O painel tem três áreas:

- **Topo:** status da sincronização ("Salvo", "Salvando…", erros) e o botão **Links para o OBS**.
- **Barra lateral:** as configurações. A primeira seção muda conforme a cena selecionada.
- **Preview:** a cena exatamente como o OBS vai mostrar. O xadrez indica as áreas transparentes.

Tudo é salvo sozinho no Supabase meio segundo depois de cada alteração. Abrir o painel não salva nada; só as suas alterações salvam.

## 2. Montando no OBS

Veja o [Guia do OBS](GUIA-OBS-TWITCH.md): links, resolução e a posição exata de cada fonte.

## 3. Configurações por cena

| Cena | O que dá para editar |
|------|----------------------|
| Jogo | Nome do jogo |
| React / React 2 cams / React sem chat | Filme, série (temporada e episódio) ou livre, título e observação |
| React sem chat | @ da faixa, cor da moldura, espessura da borda, tamanho e canto da webcam |
| Just Chatting | Assunto |
| IRL | Rótulo ("Explorando") e localização |
| Começando / Volto já | Linha de apoio, título, destaque, texto, letreiro e contagem regressiva |
| Encerramento | Linha de apoio, título, destaque, mensagem de despedida e letreiro |

No letreiro, separe os itens com `|`, por exemplo: `Deixa o follow | Ativa as notificações`.

**Contagem regressiva:** escolha 5, 10 ou 15 minutos, ou digite um horário e clique em **Até este horário**. Ao zerar, a tela mostra "Agora" por 10 minutos e depois esconde o contador.

## 4. Identidade

- **Nick exibido:** aparece nas faixas de informação e nas telas cheias.
- **Cor de destaque:** 7 cores prontas ou qualquer cor. O texto sobre a cor muda entre preto e branco automaticamente para manter a leitura.

## 5. Chat

| Fonte | Como funciona |
|-------|---------------|
| Twitch | Conexão direta e anônima (só leitura) |
| Kick | Conexão direta e anônima (só leitura). O chatroom ID é descoberto sozinho; se não for, preencha à mão |
| Twitch + Kick | As duas juntas, com a marca T/K em cada mensagem |
| YouTube Live | Chat oficial do YouTube por iframe (informe o ID do vídeo da live) |
| TikTok / URL | Qualquer widget por URL (StreamElements, Streamlabs, Tikfinity…) |
| Simulado | Mensagens de exemplo para testar o visual |

**Filtros:** ocultar comandos (`!discord`), ocultar bots (lista editável) e palavras bloqueadas. Mensagens apagadas por moderadores e mensagens de usuários banidos somem do overlay sozinhas.

**Destaque:** clique numa mensagem do chat no preview para fixá-la na tela. Para tirar, clique em **Remover destaque**.

## 6. Alertas

Ative em **Alertas**. Funcionam com os canais da Twitch e do Kick informados no chat, mesmo que a fonte do chat seja outra (YouTube, por exemplo).

| Evento | Twitch | Kick |
|--------|--------|------|
| Inscrição / reinscrição | Sim | Sim |
| Sub de presente | Sim (agrupa "gift bombs" num alerta só) | Sim |
| Raid / host | Sim | Sim |
| Bits / kicks | Sim | Experimental (o Kick não documenta esse evento) |
| Novo seguidor | Não | Não |

Novos seguidores exigem login na plataforma (OAuth com servidor), o que este kit não usa.

O som é gerado na hora e não precisa de arquivo. No OBS, marque **Controlar áudio via OBS** na fonte Navegador para ouvir e ajustar o volume no mixer.

## 7. Meta

Ative em **Meta**, defina título e objetivo e use **+1 / +5 / −1**. Com **Somar subs automaticamente**, cada inscrição ou sub de presente soma na meta, desde que o painel esteja aberto durante a live.

## 8. Spotify

1. Crie um app em [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard).
2. Em **Redirect URIs**, adicione o endereço mostrado no painel (seção Música).
3. Cole o **Client ID** no painel e clique em **Conectar ao Spotify**.
4. Ative **Mostrar "Tocando agora"**.

O painel consulta a música a cada 5 segundos e grava no Supabase só quando ela muda. O OBS não precisa de login. **O painel precisa ficar aberto durante a live** para a música atualizar.

**Teste manual:** digite `Música - Artista` no campo de teste para ver o visual sem conectar.

## 9. Fundo e estilo

- **Fundo:** transparente, cor sólida, gradiente ou imagem por URL. No OBS, o fundo é recortado nas janelas de câmera, jogo e vídeo para as fontes reais aparecerem.
- **Ocultar selo "Ao vivo"** e **cantos retos**.

## 10. Segurança (recomendado)

Sem proteção, qualquer pessoa que olhe o código do site consegue alterar o que aparece na sua live.

1. No Supabase, abra o **SQL Editor**.
2. Abra `supabase/setup.sql`, troque `TROQUE-POR-UMA-CHAVE-LONGA` por uma senha longa sua e rode **as partes 1 e 2**.
3. No painel, em **Segurança**, cole a mesma chave e clique em **Salvar**. Mude qualquer coisa e confira se o topo mostra "Salvo".
4. Rode a **parte 3** do SQL. A partir daí, só o navegador com a chave consegue salvar.
5. Abra `teste-supabase.html` e clique em **Conferir bloqueio sem chave**: deve aparecer "Protegido".

A chave fica salva só no navegador onde você a digitou. Em outro computador, digite de novo.

## 11. Vários overlays

Use `?id=nome` no painel (ex.: `.../obs/?id=canal2`). Os links para o OBS já saem com o mesmo `id`. Com a proteção ativa, cada `id` precisa da sua linha em `streamkit_keys` (veja o fim do `setup.sql`).
