# OdontoNeeds | Odontologia Integral em Natal/RN

Site institucional de alto padrão, sem rolagem vertical tradicional.
Zero dependências externas: abre offline, não usa CDN, não precisa de build.

## Rodar

```bash
node server.js
```

→ http://localhost:5180

## Arquitetura

```
nucleo-odonto/
├── index.html     estrutura das 4 camadas Z (hero, hub, painéis, modal)
├── styles.css     design system + camadas + responsivo + reduced-motion
├── app.js         motor de cena (8 módulos, ver cabeçalho do arquivo)
├── server.js      servidor estático de desenvolvimento
└── public/        logo e fotografias
```

### Camadas Z

| Camada | Conteúdo |
|---|---|
| Z-1 | `<canvas>` de partículas, nunca desmonta, reage a cada seção |
| 0   | Hero e Hub |
| +1  | Painéis de conteúdo (expandem via FLIP a partir do tile clicado) |
| +2  | Modal de equipe (expande a partir do card do profissional) |

### Navegação

O menu principal fica sempre visível, com rótulo de texto, e marca a seção
atual. O botão de retorno diz para onde leva ("Voltar", "Início", "Voltar à
equipe"). Cada card do Hub tem afordância permanente ("Ver detalhes →"), sem
depender de hover para revelar que é clicável.

### Rotas

`#/` · `#/hub` · `#/implantes` · `#/estetica` · `#/ortodontia` · `#/clinica` · `#/equipe` · `#/contato`

Deep-link funciona, botão voltar do navegador funciona, `Esc` recua uma camada,
`←` / `→` navegam entre seções irmãs.

## Tema

Claro, clínico. Fundo `#F6FAFD`, tinta `#0E2A42`, acento azul `#1B7FC4`,
apoio menta `#2FA98A`.

O logotipo original é ouro sobre preto e sumiria em fundo branco. Em vez de
abrir exceção para ele, a marca foi revestida na paleta: `recolor-logo.ps1`
remapeia a luminância do ouro para uma rampa azul, preservando o relevo
metálico. Com isso o preloader também virou claro.

## Assets

| Arquivo | Origem | Uso |
|---|---|---|
| `public/logo-odontoneeds.jpeg` | enviado pelo cliente | original do mockup, mantido como fonte |
| `public/marca-alpha.png` · `lockup-alpha.png` | recorte por chave de luminância | intermediários, mantidos como fonte |
| `public/marca-azul.png` | marca revestida na paleta azul | ícone do header e favicon |
| `public/lockup-azul.png` | marca revestida na paleta azul | preloader e og:image |
| `public/foto-*.jpeg` · `src-*.jpg` | enviadas pelo cliente | fontes originais, não publicadas |
| `public/art-implantes.jpg` | recorte + gradação gravada | tile/painel Implantes |
| `public/art-estetica.jpg` | recorte + gradação gravada | tile/painel Estética |
| `public/art-ortodontia.jpg` | recorte + gradação gravada | tile/painel Ortodontia |
| `public/art-clinica.jpg` | recorte + gradação gravada | tile/painel A Clínica |
| `public/art-equipe.jpg` | recorte + gradação gravada | tile/painel Equipe |
| `public/hero-equipe.jpg` | foto real do consultório, gradação gravada | plano de fundo do hero |

**O tratamento de cor está gravado nos arquivos `art-*.jpg`, não no CSS.**
Filtro de cor em runtime sobre imagem grande força repaint a cada frame de
hover. Para trocar uma foto, ponha a nova em `public/src-*.jpg`, ajuste a
linha correspondente e rode:

```bash
powershell -ExecutionPolicy Bypass -File tools/grade.ps1
```

Para mexer na cor da marca, ajuste a rampa em `tools/recolor-logo.ps1` e rode:

```bash
powershell -ExecutionPolicy Bypass -File tools/recolor-logo.ps1
```

## Performance

Decisões tomadas para reduzir tempo de resposta:

| Antes | Depois | Motivo |
|---|---|---|
| `backdrop-filter: blur(28px)` nos painéis | superfície opaca | desfoque de tela cheia é o item mais caro do compositor |
| `filter: blur(6px)` no hub ao abrir painel | opacidade + escala | idem |
| overlay de grão animado em `inset:-50%` | removido | repintava a viewport inteira a cada 6 frames |
| filtros de cor sobre fotografia | gravados nos arquivos | evita repaint no hover |
| `arc()` + `fillStyle` por partícula | `fillRect` agrupado por cor | **-73% no custo de desenho** (0,44 → 0,12 ms/frame a 1920×1080) |
| 1400–1900 partículas | 560–780 (190 no mobile) | menos trabalho por frame em máquina fraca |
| partículas desenhadas sob o painel | render suspenso | painel cobre a tela inteira |
| cursor com `lerp(0.17)` | posição direta no evento | a interpolação era ~100 ms de atraso perceptível |
| `resize` sem throttle | 140 ms de debounce | realocar o array a cada evento travava o arraste |
| abertura 1000 ms / fechamento 720 ms | 480 ms / 300 ms | resposta antes de espetáculo |
| URL empurrada ao fim da animação | no início da navegação | barra de endereço e botão voltar coerentes durante a transição |

## Robustez da máquina de estados

Dois problemas encontrados em teste, ambos corrigidos:

**Linha do tempo congelada.** `anim.finished` (Web Animations API) depende da
linha do tempo do documento. Aba em segundo plano ou webview que não compõe
frames deixam `document.timeline.currentTime` parado em 0, a promessa nunca
resolve, `scene.busy` fica preso e o site perde a navegação por completo.
`settle()` corre a promessa contra um relógio e, no estouro, chama
`anim.finish()` para saltar ao estado final. Verificado com a linha do tempo
efetivamente congelada: as oito rotas continuam navegáveis.

**Dedupe contra estado defasado.** A checagem "já estou nesta seção" comparava
com o painel aberto. Numa rajada de cliques o painel aberto está duas
transições atrás do que foi pedido, então o clique final era descartado e o
usuário parava na seção errada. Agora a comparação é contra `destino()`, que
devolve o alvo enfileirado quando há fila. A reentrada vinda da fila passa
`forced: true` para não ser barrada pelo pedido que ela mesma representa.

## Contato configurado

- WhatsApp **(84) 99413-7144**, botão do header, lista de contato e destino do formulário
- E-mail **franciscol2014@gmail.com**
- Localização: Natal · Rio Grande do Norte

O formulário não tem back-end: ele monta a mensagem e abre o WhatsApp Web/App
já preenchido. O envio final é sempre uma ação do usuário.

## PENDENTE: não publicar sem resolver

| # | Item | Onde | Situação |
|---|---|---|---|
| 1 | **Equipe inteira é fictícia** | `app.js`, const `TEAM` | 6 nomes, CROs e biografias inventados |
| 2 | **CNPJ é placeholder** | `index.html`, `.form__legal` | `12.345.678/0001-90` |
| 3 | **CRO do responsável técnico** | `index.html`, `.form__legal` | `CRO-RN 00.000`, obrigatório em publicidade odontológica |
| 4 | **Endereço completo** | `index.html`, painel Contato | só consta "Natal/RN" |
| 5 | Textos clínicos dos 4 tratamentos | `index.html` | plausíveis, mas não validados pela clínica |
| 6 | Retratos individuais da equipe | `[data-art="7..12"]` | gradientes gerados em CSS |
| 7 | Fontes de marca | `styles.css` | usando fallback do sistema |

Itens 1 a 4 são de risco legal, não estético: publicidade odontológica no
Brasil exige identificação do responsável técnico e proíbe informação
enganosa.

**Nota sobre a foto do consultório.** `public/hero-equipe.jpg` mostra duas
pessoas reais e identificáveis, e está publicada como plano de fundo do
hero. Isso é seguro: ela ilustra o ambiente, sem afirmar quem é quem.

O que continua fora do ar é a ligação dessa foto aos perfis individuais da
seção Equipe, porque os seis nomes e CROs de lá são invenção. Rosto real ao
lado de credencial inventada é pior do que espaço vazio. Com os nomes,
especialidades e CROs verdadeiros em mãos, os retratos entram.

### Sobre imagens geradas por IA

Servem para textura, fundo e render técnico. **Não** servem para retrato de
profissional nem para resultado de tratamento. Rosto sintético apresentado
como dentista da clínica é publicidade enganosa, e "antes e depois" é vedado
pelo Código de Ética Odontológica mesmo com foto verdadeira.

## Acessibilidade

- `prefers-reduced-motion`: desliga partículas, grão e todas as transições.
- Focus trap por painel/modal, `Esc` sempre recua, `aria-live` anuncia a troca.
- Canvas marcado como `aria-hidden` (é decoração).
- Contagem de partículas adaptativa por `hardwareConcurrency` e largura de tela.
- Render pausa quando a aba perde o foco.

## Limitação conhecida

O conteúdo é renderizado client-side. Para SEO real em produção, migrar para
Next.js com uma rota estática por seção (a estrutura de camadas e o motor FLIP
são portáveis sem reescrita), ou pré-renderizar cada painel em HTML servido
por URL própria.

