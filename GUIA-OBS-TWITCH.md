# 🎬 Guia: Configurar overlays no OBS (Twitch)

> **Substitua `SEU-LINK.vercel.app` pela URL real da sua Vercel em todos os links abaixo.**

---

## 📋 Antes de começar

Atualize o `index.html` no GitHub (a Vercel atualiza sozinha em ~30s):

```powershell
cd C:\Users\Marcos\Downloads\files
git add -A
git commit -m "fix: transparencia OBS + opcoes + chat real twitch"
git push
```

---

## 🎯 O que mudou nessa versão

Quatro coisas importantes que vão resolver tudo que você reportou:

1. **Fundos transparentes no OBS** — agora os "quadrados pretos" onde aparecia o ícone 📷 da webcam ficam transparentes. Você bota a webcam atrás e ela aparece no buraco.
2. **Opção pra esconder "AO VIVO"** — `?hide_live=1` na URL, ou checkbox no painel
3. **Opção pra deixar tudo retangular** — `?square=1` na URL, ou checkbox no painel (tira as bordas redondas da facecam)
4. **Chat REAL da Twitch** — `?twitch=seunick` na URL, ou campo no painel. Conecta de forma anônima (só leitura), não precisa de login/token.

---

## 🚀 Passo a passo: adicionar overlay no OBS

Pra cada cena (Jogo, React, Just Chatting, etc), você faz uma vez:

### 1. Crie uma cena nova no OBS

- Em **Cenas**, clique no **+** e dê o nome (ex: "Live Jogo")

### 2. Adicione o overlay (Browser Source)

- Em **Fontes**, clique no **+** → **Navegador** (Browser Source)
- Nome: "Overlay"
- **URL:** cole o link da cena específica (veja abaixo)
- **Largura:** 1920 (Twitch) ou 1080 (TikTok)
- **Altura:** 1080 (Twitch) ou 1920 (TikTok)
- Deixe marcado: "Atualizar navegador quando a cena ficar ativa"
- OK

### 3. Adicione sua webcam

- **Fontes** → **+** → **Dispositivo de captura de vídeo**
- Escolha sua webcam, OK
- **IMPORTANTE:** arraste essa fonte pra **ABAIXO** do "Overlay" na lista. A regra é: o overlay tem que estar no TOPO da lista (frente), a webcam embaixo (atrás).

### 4. Adicione o jogo / tela / vídeo

- **Fontes** → **+** → **Captura de jogo** (pra jogos) ou **Captura de tela** (pra qualquer coisa)
- Configure e arraste pra abaixo do overlay (mesmo princípio da webcam)

### 5. Posicione e redimensione

Selecione cada fonte (webcam, jogo) e use as **alças vermelhas** pra encaixar no lugar certo:

- **Arrastar canto** = redimensionar
- **Segurar Shift + arrastar canto** = mantém proporção
- **Segurar Alt + arrastar borda** = recorta (crop)

A meta é fazer sua webcam preencher exatamente o espaço onde o overlay desenha o quadradinho da webcam. Olhe pelo retângulo do overlay e ajuste.

---

## 🔗 Links prontos pra cada cena (Twitch 1920×1080)

Cole no campo URL da Browser Source no OBS. **Troque `meucanal` pelo nome do seu canal Twitch** (sem o @).

### Cena de Jogo
```
https://SEU-LINK.vercel.app/?scene=game&format=landscape&obs=1&twitch=meucanal&hide_live=1
```

### Cena de React (filme/série)
```
https://SEU-LINK.vercel.app/?scene=react&format=landscape&obs=1&twitch=meucanal&rtype=movie&rtitle=Interestelar&hide_live=1
```

Pra série, troque `rtype=movie` por `rtype=series` e adicione `&rseason=2&repisode=5`:
```
https://SEU-LINK.vercel.app/?scene=react&format=landscape&obs=1&twitch=meucanal&rtype=series&rtitle=Breaking%20Bad&rseason=3&repisode=7&hide_live=1
```

### Cena de React Livre (qualquer vídeo)
```
https://SEU-LINK.vercel.app/?scene=reactfree&format=landscape&obs=1&twitch=meucanal&hide_live=1
```

### Just Chatting
```
https://SEU-LINK.vercel.app/?scene=chatting&format=landscape&obs=1&twitch=meucanal&hide_live=1
```

### Começando (tela de "começando já")
```
https://SEU-LINK.vercel.app/?scene=start&format=landscape&obs=1
```
> Essa cena é uma tela cheia, não precisa de webcam atrás.

### Volto Já
```
https://SEU-LINK.vercel.app/?scene=brb&format=landscape&obs=1
```

### Fim (tela de "obrigado por assistir")
```
https://SEU-LINK.vercel.app/?scene=end&format=landscape&obs=1
```

### IRL (live de rua, câmera ocupa tudo)
```
https://SEU-LINK.vercel.app/?scene=irl&format=landscape&obs=1&twitch=meucanal&irl_loc=Praia%20de%20Copacabana&hide_live=1
```

> Substitua `Praia%20de%20Copacabana` pela sua localização. Use `%20` no lugar de espaços (ou o gerador de link do painel cuida disso pra você).

---

## ➕ Parâmetros extras

Adicione no final da URL com `&`:

| Parâmetro | Valor | O que faz |
|---|---|---|
| `twitch` | seunick | Conecta o chat real da Twitch |
| `hide_live` | 1 | Esconde o badge "AO VIVO/LIVE" |
| `square` | 1 | Deixa tudo retangular (sem bordas redondas) |
| `spotify` | 1 | Mostra balão com música tocando (precisa do Snip rodando — só local) |
| `s_tiktok` | meunick | Mostra badge do TikTok com seu @ |
| `s_instagram` | meunick | Idem Instagram |
| `s_youtube` | meucanal | Idem YouTube |
| `color` | d6f24b | Cor de destaque em hex sem # (ex: ff0080) |

**Exemplo combinando tudo:**
```
?scene=game&format=landscape&obs=1&twitch=meucanal&hide_live=1&s_instagram=meunick&s_youtube=meucanal&color=ff0080
```

---

## ❓ Problemas comuns

### "A webcam não aparece"
A webcam está acima do overlay na lista de fontes. **Arraste a webcam pra abaixo do overlay.**

### "Aparecem quadrados pretos onde deveria estar a webcam"
Você não está usando `?obs=1` no link. Verifique se o link tem `obs=1`.

### "O chat real não conecta"
- Verifique se digitou o nome correto do canal (sem @, sem espaços, tudo minúsculo)
- O canal precisa estar ao vivo OU recém ao vivo pra mensagens aparecerem
- Abra o link no navegador, aperte F12 e vá em "Console" — se houver erro, me manda print

### "Quero mudar algo só pra uma cena"
Cada cena tem sua própria URL. Mude os parâmetros pra cada uma. Por exemplo, na cena IRL você pode não querer `hide_live=1` (porque é legal mostrar AO VIVO embaixo da câmera de rua).

### "As bordas redondas no TikTok me incomodam"
Adicione `&square=1` na URL ou marque "Tudo retangular" no painel.

---

## 🎮 Ordem na lista de fontes do OBS (resumo)

Pra TODAS as cenas com webcam/jogo, a ordem na lista de fontes deve ser:

```
1. Overlay (Browser Source) ← TOPO (na frente)
2. Webcam (Video Capture)
3. Jogo / Tela / Vídeo
4. Microfone (sem visual, posição não importa)
```

Pras telas de Começando / Volto Já / Fim, só precisa do Overlay (e talvez música no microfone). Não precisa de webcam nem jogo.

---

## 🔄 Como atualizar uma URL

Se você quiser mudar algo (ex: trocar o filme da cena React), você pode:

1. **Editar a Browser Source** no OBS: clique nela → ⚙️ → muda a URL
2. **Ou usar o painel de controle do kit:** abre `https://SEU-LINK.vercel.app/` no navegador, ajusta tudo no painel, clica em "Copiar link p/ OBS", e cola no OBS.

---

Qualquer coisa que não der certo, me manda um print do que aparece no OBS e do que você esperava.
