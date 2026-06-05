# 🎬 Guia OBS — Configurar overlays na Twitch

> Sua URL: **https://obs-bice.vercel.app/**
> Substitua **`SEUCANAL`** pelo nome do seu canal na Twitch (sem @, tudo minúsculo).

---

## ⚠️ PASSO ZERO: confirmar que a versão nova está no ar

Antes de tudo, você precisa subir o `index.html` novo pro GitHub:

```powershell
cd C:\Users\Marcos\Downloads\files
git add -A
git commit -m "fix: transparencia OBS + chat twitch + opcoes"
git push
```

Aguarde uns 30 segundos pra Vercel atualizar. Pra confirmar que deu certo, abra essa URL no navegador:

**https://obs-bice.vercel.app/**

No painel de cima, você deve ver **três coisas novas**:
- Um campo "Twitch" pra digitar o nome do canal
- Checkbox "Esconder AO VIVO"
- Checkbox "Tudo retangular"

Se essas três coisas aparecerem, está atualizado e pode seguir. Se não, espere mais 1 minuto e dê F5.

---

## 🎯 O essencial em 30 segundos

A regra de ouro do OBS pra esse kit é:

```
🥇 Overlay (Browser Source)  ← TOPO da lista (na frente)
🥈 Webcam (Video Capture)
🥉 Jogo / Tela / Vídeo       ← BASE da lista (atrás)
```

Sua webcam e seu jogo precisam estar **abaixo** do overlay na lista de fontes do OBS. O overlay funciona como uma "moldura transparente" — os "buracos" da moldura mostram o que está atrás.

---

## 🚀 Configurar UMA cena (passo a passo)

Vou usar a cena de Jogo como exemplo. Pras outras é igual, só muda a URL.

### 1. Criar a cena

- No OBS, painel **Cenas** (canto inferior esquerdo)
- Clique em **+**
- Nome: "Live - Jogo"

### 2. Adicionar o overlay

- Painel **Fontes** → **+** → **Navegador** (ou "Browser")
- Nome: "Overlay"
- **URL:** cole isso (troque `SEUCANAL`):
  ```
  https://obs-bice.vercel.app/?scene=game&format=landscape&obs=1&twitch=SEUCANAL&hide_live=1
  ```
- **Largura:** 1920
- **Altura:** 1080
- Marque ✅ "Atualizar navegador quando a cena ficar ativa"
- OK

### 3. Adicionar sua webcam

- **Fontes** → **+** → **Dispositivo de captura de vídeo**
- Nome: "Webcam"
- Selecione sua webcam, OK
- **ARRASTE essa fonte pra ABAIXO do "Overlay"** na lista (muito importante!)

### 4. Adicionar o jogo

- **Fontes** → **+** → **Captura de jogo** (pra jogos) OU **Captura de tela** (qualquer coisa)
- Configure conforme o jogo
- Arraste pra **abaixo** do Overlay e da Webcam

### 5. Encaixar webcam e jogo no lugar certo

Selecione a webcam (ou jogo) e use as alças vermelhas pra redimensionar:

- **Arrastar canto** → redimensiona livre
- **Shift + arrastar canto** → mantém proporção (recomendado)
- **Alt + arrastar borda** → recorta (corta excesso sem distorcer)

Você vai ver o overlay desenhando o quadradinho onde a webcam deve ir. Encaixa ela ali.

**Posições aproximadas pra Twitch (1920×1080):**

| Cena | Webcam | Jogo/Vídeo |
|---|---|---|
| Jogo | Direita topo, ~370×210px | Esquerda, ~1010×680px |
| React | Direita topo, ~370×220px | Esquerda, ~1010×580px |
| React Livre | Direita topo, ~370×220px | Esquerda, ~1010×680px |
| Just Chatting | Esquerda, ~900×700px | (não tem) |
| IRL | Tela toda | (não tem) |

Não precisa ser exato, é só pra você ter ideia. Use o quadradinho do overlay como referência.

---

## 🔗 Links prontos pra cada cena

Copie e cole no campo URL da Browser Source. **Substitua `SEUCANAL` pelo seu nick da Twitch:**

### Cena de Jogo
```
https://obs-bice.vercel.app/?scene=game&format=landscape&obs=1&twitch=SEUCANAL&hide_live=1
```

### Cena de React (Filme)
```
https://obs-bice.vercel.app/?scene=react&format=landscape&obs=1&twitch=SEUCANAL&rtype=movie&rtitle=Interestelar&hide_live=1
```

### Cena de React (Série) — exemplo Breaking Bad T3 E7
```
https://obs-bice.vercel.app/?scene=react&format=landscape&obs=1&twitch=SEUCANAL&rtype=series&rtitle=Breaking%20Bad&rseason=3&repisode=7&hide_live=1
```

### Cena de React Livre (qualquer vídeo, sem editor)
```
https://obs-bice.vercel.app/?scene=reactfree&format=landscape&obs=1&twitch=SEUCANAL&hide_live=1
```

### Just Chatting
```
https://obs-bice.vercel.app/?scene=chatting&format=landscape&obs=1&twitch=SEUCANAL&hide_live=1
```

### Começando (tela cheia, não precisa de webcam)
```
https://obs-bice.vercel.app/?scene=start&format=landscape&obs=1
```

### Volto Já (tela cheia, não precisa de webcam)
```
https://obs-bice.vercel.app/?scene=brb&format=landscape&obs=1
```

### Fim (tela cheia, não precisa de webcam)
```
https://obs-bice.vercel.app/?scene=end&format=landscape&obs=1
```

### IRL (live de rua — câmera ocupa tudo)
```
https://obs-bice.vercel.app/?scene=irl&format=landscape&obs=1&twitch=SEUCANAL&irl_loc=Praia%20de%20Copacabana
```

> Aqui eu deixei o "AO VIVO" porque ele é parte do design da IRL. Se quiser tirar, adicione `&hide_live=1`.
> Pra trocar a localização: use `%20` no lugar de espaços (ex: `Centro%20de%20S%C3%A3o%20Paulo`).

---

## 📱 Versões TikTok (1080×1920 portrait)

Mesma lógica, só troca `format=landscape` por `format=portrait` e usa resolução 1080×1920 no Browser Source. Exemplo:

```
https://obs-bice.vercel.app/?scene=game&format=portrait&obs=1&twitch=SEUCANAL&hide_live=1
```

---

## 💬 Conectar o chat (3 modos)

No painel, no grupo "Chat", você escolhe entre 3 modos:

### 1. Teste (fake)
Chat de mentira animado, só pra ver o visual. Use `&chat=test` na URL.

### 2. Twitch (nome do canal)
Conecta direto no chat da Twitch, anônimo (só leitura). Digite o nome do canal no painel, ou use `&twitch=seucanal` na URL.

### 3. URL externa (widget) — funciona com QUALQUER plataforma
Cole o link de um widget de chat e ele aparece dentro da janela. Use `&chat_url=LINK` na URL (o painel codifica automaticamente).

**Onde pegar o link do widget pra cada plataforma:**

- **Kick:** o popout do chat — `https://kick.com/SEUCANAL/chatroom` (ou use um widget tipo o do StreamElements que suporta Kick)
- **StreamElements (qualquer plataforma):** Dashboard → Overlays → crie um widget de chat → copie a URL do overlay
- **Streamlabs:** Dashboard → Chat Box widget → copie a URL
- **Nightbot/Social Stream:** copie a URL do widget gerado
- **YouTube:** use o popout `https://www.youtube.com/live_chat?v=ID_DO_VIDEO` (pode não permitir embed dependendo do navegador do OBS)

> ⚠️ Algumas plataformas bloqueiam ser embutidas em iframe. Se um widget aparecer em branco, use um serviço como StreamElements ou Social Stream Ninja, que são feitos pra isso e funcionam com Twitch, Kick, YouTube etc ao mesmo tempo.

**Exemplo com widget do StreamElements:**
```
https://obs-bice.vercel.app/?scene=game&format=landscape&obs=1&hide_live=1&chat_url=https%3A%2F%2Fstreamelements.com%2Fseu-widget
```

---

## 🎨 Fundo (cor, gradiente ou imagem)

No painel, grupo "Fundo". Ou por URL:

- Cor sólida: `&bg=solid&bg_color=1a0b2e`
- Gradiente: `&bg=gradient&bg_color=ff0080&bg_color2=7928ca&bg_angle=135`
- Imagem: `&bg=image&bg_img=https://link-da-imagem.jpg`

O fundo fica atrás de tudo, inclusive atrás da webcam/jogo.

---

## ➕ Parâmetros extras (mistura e combina)

Junte no final do link com `&`:

| Parâmetro | Exemplo | O que faz |
|---|---|---|
| `twitch` | `&twitch=meucanal` | Conecta chat real da Twitch (anônimo) |
| `hide_live` | `&hide_live=1` | Esconde o badge "AO VIVO/LIVE" |
| `square` | `&square=1` | Tira bordas redondas (deixa retangular) |
| `spotify` | `&spotify=1` | Mostra balão da música (precisa do Snip — só local) |
| `s_tiktok` | `&s_tiktok=meunick` | Badge TikTok com seu @ |
| `s_instagram` | `&s_instagram=meunick` | Badge Instagram |
| `s_youtube` | `&s_youtube=meucanal` | Badge YouTube |
| `color` | `&color=ff0080` | Cor de destaque (hex sem #) |

**Exemplo da hora:** cena de jogo, com chat da Twitch, suas 3 redes, cor rosa, sem AO VIVO:

```
https://obs-bice.vercel.app/?scene=game&format=landscape&obs=1&twitch=SEUCANAL&hide_live=1&s_tiktok=meunick&s_instagram=meunick&s_youtube=meucanal&color=ff0080
```

---

## ✅ Checklist final pra cada cena

Antes de dar OK, confirme:

- [ ] Resolução do Browser Source = 1920×1080 (Twitch) ou 1080×1920 (TikTok)
- [ ] URL termina em `&obs=1` (sem isso, fundos não ficam transparentes)
- [ ] Ordem na lista: Overlay no topo, webcam embaixo
- [ ] `twitch=SEUCANAL` está com o nick correto (sem @, minúsculo)
- [ ] Webcam encaixada no quadradinho desenhado pelo overlay
- [ ] Jogo/tela posicionado no espaço grande à esquerda

---

## ❓ Se algo não funcionar

### "Aparece quadrado preto onde devia estar a webcam"
- A URL não tem `&obs=1`. Adicione no final.
- OU você não atualizou ainda — faça `git push` e aguarde a Vercel.

### "Webcam não aparece de jeito nenhum"
- A webcam está acima do overlay na lista. Arraste pra abaixo.

### "Chat real da Twitch não puxa nada"
- Você não está ao vivo (ou ninguém escreveu ainda)
- O nick do canal está errado (sem @, sem espaços, tudo minúsculo)
- Teste no navegador: abra o link, aperte F12 → "Console" → me mande print se houver erro vermelho

### "Os ícones LIVE/AO VIVO ainda aparecem"
- Você não tem `hide_live=1` na URL. Adicione.
- OU você está numa versão antiga do site (faça push e aguarde).

---

## 🔄 Fluxo recomendado pra começar

1. Faça `git push` pra atualizar a Vercel ⏱️ aguarde 30s
2. Abra https://obs-bice.vercel.app/ pra confirmar que os 3 controles novos aparecem
3. Configure SÓ a cena de Jogo primeiro pra testar
4. Quando funcionar, copia a cena no OBS (clique direito → Duplicar) e troca só a URL do overlay pra outra cena
5. Repete pras outras cenas

---

Boa sorte! Qualquer dúvida ou erro, manda print.
