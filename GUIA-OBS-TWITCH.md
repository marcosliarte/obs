# Guia do OBS

Como montar cada cena no OBS com o StreamKit.

## O essencial

- O overlay é uma **moldura transparente** que fica **por cima** de tudo.
- Webcam, jogo e vídeo ficam **abaixo** do overlay na lista de fontes, encaixados nas janelas.
- Cada cena do OBS tem a sua fonte **Navegador** com o link da cena (botão **Links para o OBS** no painel).
- Tudo o que você muda no painel aparece no OBS em até 3 segundos, sem recarregar.

## Montar uma cena

1. **Cenas → +**, dê um nome (ex.: "Jogo").
2. **Fontes → + → Navegador**
   - URL: o link da cena, copiado do painel
   - Largura × altura: `1920 × 1080` (Twitch) ou `1080 × 1920` (TikTok)
   - Marque **Atualizar navegador quando a cena ficar ativa**
   - Para os alertas tocarem som, marque **Controlar áudio via OBS**
3. **Fontes → + → Dispositivo de captura de vídeo** (webcam) e **Captura de jogo** ou **Captura de tela**.
4. Deixe o **Navegador no topo** da lista e as outras fontes abaixo dele.
5. Posicione cada fonte com **botão direito → Transformar → Editar transformação**, usando a tabela abaixo. Se a proporção não bater, use **Alt + arrastar** para recortar em vez de distorcer.

## Posições exatas

Valores de **Posição** (x, y) e **Caixa delimitadora** (largura × altura), com o tipo de caixa delimitadora em "Escalar para preencher a caixa", ou ajuste o tamanho direto.

### Twitch 16:9 (1920 × 1080)

| Cena | Fonte | Posição | Tamanho |
|------|-------|---------|---------|
| Jogo | Captura de jogo | 40, 40 | 1400 × 788 |
| Jogo | Webcam | 1480, 40 | 400 × 300 |
| React / React livre | Vídeo | 40, 40 | 1400 × 788 |
| React / React livre | Webcam | 1480, 40 | 400 × 300 |
| React 2 cams | Vídeo | 40, 40 | 1400 × 788 |
| React 2 cams | Webcam 1 | 1480, 40 | 400 × 488 |
| React 2 cams | Webcam 2 | 1480, 552 | 400 × 488 |
| Just Chatting | Webcam | 40, 40 | 1400 × 788 |
| IRL | Câmera | 0, 0 | 1920 × 1080 |

### TikTok 9:16 (1080 × 1920)

| Cena | Fonte | Posição | Tamanho |
|------|-------|---------|---------|
| Jogo | Webcam | 40, 40 | 1000 × 563 |
| Jogo | Captura de jogo | 40, 627 | 1000 × 563 |
| React / React livre | Vídeo | 40, 40 | 1000 × 563 |
| React / React livre | Webcam | 40, 627 | 1000 × 563 |
| React 2 cams | Vídeo | 40, 40 | 1000 × 563 |
| React 2 cams | Webcam 1 | 40, 627 | 488 × 663 |
| React 2 cams | Webcam 2 | 552, 627 | 488 × 663 |
| Just Chatting | Webcam | 40, 40 | 1000 × 1100 |
| IRL | Câmera | 0, 0 | 1080 × 1920 |

As telas Começando, Volto já e Encerramento não precisam de nenhuma outra fonte.

> **Atualizando da versão 2:** as janelas mudaram de lugar e de tamanho (a área do jogo agora é exatamente 16:9). Reposicione as fontes com a tabela acima.

## Alertas no OBS

Os alertas aparecem em todas as cenas que usam o overlay. Para testar, use os botões em **Alertas → Testar** no painel: o alerta aparece no preview e, em até 3 segundos, no OBS.

## Se algo não funcionar

**Aparece um retângulo escuro onde deveria estar a webcam.** A fonte da webcam está acima do Navegador na lista. Arraste-a para baixo.

**O chat não mostra nada.** Confira o canal no painel (sem @). No Kick, se o "Chatroom ID" ficar vazio, abra `kick.com/api/v2/channels/SEUCANAL`, copie o número em `chatroom → id` e cole no painel.

**As mudanças do painel não chegam ao OBS.** Veja o indicador no topo do painel: precisa estar "Salvo". "Chave de escrita inválida" significa que a chave salva no navegador não é a mesma do Supabase.

**Quero confirmar qual versão o OBS carregou.** Acrescente `&debug=1` ao link: a versão e o horário aparecem no canto inferior direito.
