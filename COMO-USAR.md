# Como usar o StreamKit

## 1. O painel

Abra `https://marcosliarte.github.io/obs/` (ou o `index.html` por um servidor local). O painel tem três áreas:

- **Topo:** status da sincronização ("Salvo", "Salvando…", erros) e o botão **Links para o OBS**.
- **Barra lateral:** as configurações. A primeira seção muda conforme a cena selecionada.
- **Preview:** a cena exatamente como o OBS vai mostrar. O xadrez indica as áreas transparentes.

Tudo é salvo sozinho no Supabase meio segundo depois de cada alteração. Abrir o painel não salva nada; só as suas alterações salvam.

## 2. Montando no OBS

Veja o [Guia do OBS](GUIA-OBS-TWITCH.md): links, resolução e a posição exata de cada fonte.

### Encaixe automático (sem recortar à mão)

A seção **Encaixe no OBS** do painel mostra a posição, o tamanho e a proporção de cada janela da cena atual. Para o painel encaixar as fontes sozinho:

1. No OBS: **Ferramentas → Configurações do servidor WebSocket → Ativar servidor WebSocket**. Copie a senha em **Mostrar informações de conexão**.
2. No painel, abra **Encaixe no OBS**, cole a senha e clique em **Conectar ao OBS**. Use o painel no mesmo computador do OBS (endereço `ws://127.0.0.1:4455`).
3. Escolha a **cena do OBS**. O painel já sugere a fonte de cada janela (webcam → dispositivo de captura, jogo → captura de jogo). Troque se precisar.
4. Clique em **Encaixar fontes agora**.

Cada fonte é posicionada, escalada e cortada para preencher a janela exatamente:

- **Preencher (corta):** corta as sobras, sem barras pretas.
- **Caber inteira:** mostra a imagem inteira, sobrando espaço.

O overlay também vai para o topo da lista de fontes e ocupa o canvas inteiro. A escolha de fontes fica salva por cena e formato. Se mudar o layout (o formato da webcam, por exemplo), clique em encaixar de novo. A senha fica só neste navegador e nunca vai para o Supabase.

**Formato da webcam:** nas cenas Jogo, React e React livre (16:9) você escolhe 16:9, 4:3 ou quadrada. Com 16:9, uma webcam comum entra sem corte nenhum, e o chat aproveita o espaço que sobra.

## 3. Configurações por cena

| Cena | O que dá para editar |
|------|----------------------|
| Jogo | Nome do jogo, etiqueta ("Agora") e texto antes do jogo ("Jogando") |
| React / React 2/3 cams | Filme, série (temporada e episódio) ou livre, título, observação, etiqueta, texto antes do título ("Reagindo a"), formato do episódio (`T{t} · E{e}`) e texto do modo livre. Na React 2/3 cams: quantidade de pessoas e o nome em cada webcam |
| React livre | Etiqueta e texto da faixa |
| React sem chat | @ da faixa, cor da moldura, espessura da borda, tamanho e canto da webcam |
| Just Chatting | Assunto, etiqueta e texto antes do assunto |
| IRL | Rótulo ("Explorando") e localização |
| Começando / Volto já | Linha de apoio, título, destaque, texto, letreiro e contagem regressiva |
| Encerramento | Linha de apoio, título, destaque, mensagem de despedida e letreiro |

No letreiro, separe os itens com `|`, por exemplo: `Deixa o follow | Ativa as notificações`.

**Todos os textos são editáveis.** Deixe um campo "antes do…" vazio para mostrar só o título. No texto livre, `*palavra*` fica em negrito: `Reagindo com o *chat*`. Os textos que aparecem em várias cenas (selo "Ao vivo", título do chat, "Destaque do chat", "Tocando agora", "Primeira vez", "Último apoio" e o agradecimento) ficam em **Textos gerais**.

**Contagem regressiva:** escolha 5, 10 ou 15 minutos, ou digite um horário e clique em **Até este horário**. Ao zerar, a tela mostra "Agora" por 10 minutos e depois esconde o contador.

## 4. Identidade

- **Nick exibido:** aparece nas faixas de informação e nas telas cheias.
- **Cor de destaque:** 7 cores prontas ou qualquer cor. O texto sobre a cor muda entre preto e branco automaticamente para manter a leitura.
- **Mostrar o nick na faixa:** desligue para a faixa de informação ficar só com o título.

## 5. Chat

| Fonte | Como funciona |
|-------|---------------|
| Twitch | Conexão direta e anônima (só leitura) |
| Kick | Conexão direta e anônima (só leitura). O chatroom ID é descoberto sozinho; se não for, preencha à mão |
| Várias plataformas juntas | Twitch, Kick e YouTube no mesmo chat, com o ícone da plataforma em cada mensagem. Entram as que estiverem preenchidas |
| YouTube Live | Com a chave da API: chat nativo (selos, Super Chats e membros nos alertas). Sem chave: chat oficial por iframe. Cole o link da live a cada transmissão |
| TikTok / URL | Qualquer widget por URL (StreamElements, Streamlabs, Tikfinity…) |
| Simulado | Mensagens de exemplo para testar o visual |

**YouTube no chat:** crie uma chave em console.cloud.google.com (ative a *YouTube Data API v3*) e, em *Restrições do aplicativo*, limite a chave ao site do overlay, porque ela fica visível na config. Só o overlay da cena no ar consulta o YouTube, para economizar a cota grátis (dá umas 3 horas de live por dia). O TikTok não libera o chat para sites; para ele, use *Widget por URL* (ex.: Tikfinity).

**Filtros:** ocultar comandos (`!discord`), ocultar bots (lista editável) e palavras bloqueadas. Mensagens apagadas por moderadores e mensagens de usuários banidos somem do overlay sozinhas.

**Emotes 7TV, BTTV e FFZ:** os globais e os do seu canal aparecem como imagem, além dos emotes nativos da Twitch e do Kick. Mensagens só com emotes mostram os emotes maiores.

**Primeira vez:** na Twitch, quem fala pela primeira vez no canal ganha um selo e um destaque leve.

**Mensagens somem após (s):** com um valor maior que 0, cada mensagem sai da tela depois desse tempo. Fica mais limpo nas cenas de React.

**Reconexão:** se a Twitch ou o Kick cair, ou se o OBS abrir sem internet, o chat tenta de novo sozinho (3 s, 6 s, 12 s… até 1 min).

**Destaque:** clique numa mensagem do chat no preview para fixá-la na tela. Para tirar, clique em **Remover destaque**, ou defina **Destaque some após (s)** para ele sair sozinho.

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

**Último apoio:** com a opção ligada, o rodapé mostra o apoio mais recente (por exemplo, "Ana · 5 subs de presente"), e a tela de **Encerramento** agradece a todos que apoiaram na live. Use **Limpar lista** no começo de cada live.

O som é gerado na hora e não precisa de arquivo. No OBS, marque **Controlar áudio via OBS** na fonte Navegador para ouvir e ajustar o volume no mixer.

## 7. Meta

Ative em **Meta** e escolha o tipo: **Subs**, **Seguidores** ou **Livre**. Em **Seguidores**, com o canal do Kick preenchido, a barra conta sozinha (atualiza a cada minuto, mesmo com o painel fechado). Seguidores da Twitch exigem login, então use os botões. Defina título e objetivo e use **+1 / +5 / −1**. Com **Somar subs automaticamente**, cada inscrição ou sub de presente soma na meta, desde que o painel esteja aberto durante a live.

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
