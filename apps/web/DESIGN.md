<!-- SEED: re-run /impeccable document once there's code to capture the actual tokens and components. -->

---
name: Lost Pets
description: Reunindo pets perdidos com suas famílias, uma comunidade de vizinhos por vez.
---

# Design System: Lost Pets

## Overview

**Creative North Star: "The Porch Light"**

Uma luz de varanda deixada acesa pra alguém encontrar o caminho de volta pra casa — é essa a sensação que o Lost Pets deveria dar. Não é um marketplace frio catalogando itens; é uma vizinhança se ajudando, com a urgência de quem quer que um pet volte pra casa rápido, mas sem transformar isso num painel de alarme. Calor humano com clareza funcional: cada tela existe pra ajudar alguém a achar, postar, ou responder a um anúncio o mais rápido possível.

O sistema explicitly rejeita o clichê genérico de "SaaS cinza com grid de cards" e o neutro bege/creme "quente por padrão" que é o default visual de interfaces geradas por IA. Calor aqui vem de uma cor de marca saturada de verdade (terracota/coral) e de cor semântica funcional — tipo e status do anúncio carregam significado visual real — não de um fundo bege genérico fingindo aconchego.

**Key Characteristics:**
- Acolhedor e comunitário, nunca frio ou corporativo
- Cor como informação (tipo/status do anúncio), não decoração
- Urgência comunicada com clareza, nunca com estética de alarme
- Tipografia humanista, legível rápido sob estresse (formulários, listas, chat)
- Movimento responsivo — a interface reage ao usuário, não coreografa

## Colors

**The Semantic Signal Rule.** Cor não é decorativa neste sistema — tipo de anúncio (perdido/achado/doação) e status (ativo/resolvido/cancelado) usam uma paleta completa e deliberada, cada papel com sua própria cor nomeada, pra que o usuário leia o estado de um anúncio no feed antes mesmo de ler o texto.

### Primary
- **Terracota quente** (hue family: terracota/coral saturado — `[hex a resolver na implementação]`): cor de marca — botões primários, navegação, destaques de interação. Evita o bege/creme neutro "quente por padrão"; é uma cor saturada de verdade.

### Secondary / Tertiary (papéis semânticos — a resolver na implementação)
- **Perdido** — tom de alerta acolhedor (não um vermelho de pânico), pra sinalizar urgência sem estética de emergência.
- **Achado** — tom que comunica alívio/resolução positiva.
- **Doação** — tom distinto dos dois anteriores, neutro em urgência.
- **Status resolvido/cancelado** — variações neutras/dessaturadas das cores de tipo, pra indicar "encerrado" sem introduzir uma quarta família de cor.

### Neutral
- Fundo, texto e bordas neutros com leve tingimento na direção do matiz da marca (não bege/creme genérico) — `[valores a resolver na implementação]`.

### Named Rules
**The No-Cream Rule.** Nenhum fundo neutro cai na faixa bege/creme/areia "quente por padrão" de IA — neutros são tingidos na direção do terracota da marca, não de um "warmth" genérico.

## Typography

**Display Font:** [a escolher na implementação — sans humanista]
**Body Font:** [a escolher na implementação — mesma família ou par próximo, sans humanista]

**Character:** Uma única família sans com curvas humanas (não geométrica/fria), priorizando legibilidade rápida em formulários, listas de anúncios e chat sobre qualquer floreio editorial.

### Hierarchy
- **Display / Headline / Title / Body / Label**: escala completa a definir na implementação, seguindo a direção "sans única humanista e calorosa" — corpo com medida máxima de 65–75ch.

### Named Rules
**The One Voice Rule.** Uma única família tipográfica carrega o sistema inteiro, variando por peso e tamanho — sem par serif/sans, sem segunda família decorativa.

## Elevation

Sistema majoritariamente plano em repouso — elevação aparece só como resposta a interação (hover, foco, feedback de ação), consistente com a energia de movimento "responsivo" escolhida: sem camadas decorativas nem sombras estruturais permanentes.

### Named Rules
**The Flat-By-Default Rule.** Superfícies são planas em repouso. Sombra ou elevação aparecem só como reação a um estado (hover, foco, carregando), nunca como decoração estática.

## Do's and Don'ts

### Do:
- **Do** usar cor semântica deliberada pra tipo (perdido/achado/doação) e status (ativo/resolvido/cancelado) de anúncio — a cor carrega informação, não é decoração.
- **Do** usar uma cor de marca terracota/coral saturada de verdade, não um bege/creme neutro.
- **Do** priorizar clareza e velocidade de leitura em formulários, listas e chat sobre floreio visual.
- **Do** manter movimento responsivo (feedback, transições de estado) sem coreografia de entrada elaborada.

### Don't:
- **Don't** usar um fundo neutro bege/creme/areia "quente por padrão" — é o clichê de IA que este sistema rejeita explicitamente.
- **Don't** usar grid de cards genérico e repetitivo tipo "SaaS cinza" como resposta padrão pra qualquer listagem.
- **Don't** comunicar urgência ("perdido há X dias") com estética de painel de alarme/emergência — urgência aqui é clara, não alarmante.
- **Don't** usar side-stripe borders, gradient text, glassmorphism decorativo, hero-metric template, eyebrow numerado (01/02/03) ou tracked-uppercase-kicker acima de toda seção — bans padrão do sistema de design, sem exceção aberta ainda.
