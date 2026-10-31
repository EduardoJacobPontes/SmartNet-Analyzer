# Guia do SmartNet Analyzer (explicado para quem tem 8 anos)

## A história

Imagine que você é o **prefeito de uma cidadezinha**. Ela tem vários **bairros** e **ruas** ligando um bairro ao outro. Você precisa responder perguntas, tipo:

- Dá para ir de qualquer bairro até qualquer outro?
- Qual o caminho **mais rápido** para a ambulância chegar no hospital?
- Como passar a internet (fibra óptica) em **todos** os bairros gastando o **mínimo** de dinheiro?
- Se uma rua fechar para obra, a cidade fica dividida?

O **SmartNet Analyzer** é o seu mapa mágico que responde tudo isso. 🏙️

> Nome chique: a cidade inteira se chama **grafo**. Os bairros são os **vértices** e as ruas são as **arestas**. O número em cada rua é o **peso**: quanto custa passar por ela (tempo, distância ou dinheiro).

---

## O que tem em cada pedaço da tela

### 🔝 A faixa de cima (cabeçalho)

| Botão | Para que serve |
|---|---|
| **Carregar Grafo de Teste do Professor** | Cria de uma vez uma cidade pronta com 8 bairros (O, A, B, C, D, E, F, T). É o jeito mais rápido de começar. |
| **Cidade demo** | Outra cidade pronta, com nomes de verdade (Centro, Hospital, Porto...). |
| **Limpar grafo** | Apaga a cidade inteira para você montar uma nova. |
| **Como usar?** | Abre uma janelinha com um resumo rápido. |
| **Finalizar aplicação** | Termina tudo: apaga a cidade e mostra a tela "Aplicação finalizada". Dá para começar de novo em "Iniciar nova análise". |

### 🏷️ As etiquetinhas (logo abaixo)

Mostram o estado da cidade agora: se as ruas são de mão única ou dupla, se têm números, quantos bairros e ruas existem, e se a cidade está **conexa** (inteira) ou **dividida em ilhas**. Também avisa quantas ruas estão fechadas.

---

### ① Mapear a cidade (quadro da esquerda)

É onde você **constrói** a cidade.

1. **Não-direcionado / Direcionado**
   - *Não-direcionado* = ruas de **mão dupla** (vai e volta).
   - *Direcionado* = ruas de **mão única** (só vai em um sentido; aparecem setinhas).
2. **Com pesos / Sem pesos**
   - *Com pesos* = cada rua tem um custo (o número).
   - *Sem pesos* = todas as ruas valem 1.
3. **Formulário**
   - **Novo bairro**: escreva o nome (sem espaços!) e aperte *Adicionar*. Dá para escrever vários separados por vírgula.
   - **Origem / Destino / Peso**: diga de qual bairro a rua sai, para qual vai e quanto custa. Aperte *Criar via*. Se o bairro não existir, ele é criado sozinho.
   - **Bairros**: bolinhas com o nome de cada bairro. O **×** apaga o bairro (e as ruas dele).
   - **Vias**: lista das ruas. Dá para **mudar o número** direto na caixinha, **fechar a rua** (🚧, como uma obra) ou **apagar** (×).
4. **Texto / Arquivo**: em vez de clicar, você pode **escrever** a cidade num texto (ou abrir um arquivo `.txt`) e apertar *Aplicar texto*. Se errar, o site diz **em qual linha** está o erro. *Baixar .txt* guarda a sua cidade num arquivo.

---

### ② Mapa da rede (a cidadezinha vista de cima)

É o desenho da cidade, com **árvores, casas, prédios, postes de luz e carros estacionados** só de enfeite. O que importa:

- **Rotatórias com nome** = os **bairros**.
- **Ruas de asfalto com número** = as ruas e o custo delas.
- **Arraste** um bairro com o mouse para arrumar o mapa.
- O botão **Reorganizar** espalha tudo de novo, bonitinho.
- Os três botões no canto mudam o que o **clique** faz:
  - **Origem**: clique num bairro para dizer **de onde o carro sai**.
  - **Destino**: clique num bairro para dizer **aonde quer chegar** (só o Dijkstra usa).
  - **Interditar vias**: clique numa **rua** para fechar (fica com barreira vermelha). Clique de novo para abrir. Os resultados se **atualizam sozinhos**!
- A **legenda** embaixo explica as cores (atual, visitado, fibra, rota de emergência, rua crítica, rua fechada).

---

### ③ Módulo de inteligência (os desafios)

Cada **cartão** é um desafio diferente. Escolha um, ajuste as opções e aperte **Executar**.

| Cartão | Em palavras de criança |
|---|---|
| **DFS** — *Auditoria de rotas* | O carro vai **até o fim** de cada rua antes de voltar, como quem explora uma caverna. Descobre se a cidade é inteira ou dividida e onde há **becos sem saída**. |
| **BFS** — *Onda de alerta* | Como jogar uma pedra num lago: o aviso se espalha em **ondas**, primeiro os bairros vizinhos, depois os vizinhos dos vizinhos. Mostra quantos **saltos** até cada bairro. |
| **Dijkstra** — *Rota de emergência* | Acha o **caminho mais rápido** da origem até todos os bairros (ou até um destino que você escolher). |
| **Kruskal** — *Fibra óptica* | Escolhe as ruas onde passar a internet para ligar **todos** os bairros **gastando o mínimo**, sem fazer voltas inúteis. |
| **Resiliência** — *Pontos de falha* | Mostra os bairros e ruas **perigosos**: se quebrarem, a cidade se parte em pedaços. |

**Opções:**
- **Origem**: de onde o carro começa.
- **Destino (opcional)**: aonde quer chegar (Dijkstra).
- **Ordem dos vizinhos**: se o carro prefere as ruas na ordem em que você as criou ou em ordem alfabética.
- **Reproduzir passo a passo**: se ligado, o carro passeia mostrando cada pensamento do computador. Se desligado, mostra direto a resposta.

#### 🚑 E o botão "Mandar a ambulância"?

Ele só aparece no cartão **Dijkstra**. Funciona assim:

1. Escolha uma **Origem** (onde a ambulância está) e um **Destino** (onde está a emergência).
2. Aperte **Executar Dijkstra**. O site descobre o caminho mais rápido.
3. Agora o botão fica aceso. Aperte **Mandar a ambulância**!
4. Uma **ambulância branca com sirene** percorre exatamente o **caminho mais rápido**, deixando um rastro laranja.

Se uma rua estiver fechada, o caminho muda sozinho e a ambulância dá a volta. 😮

---

### ④ Central de operações (as respostas)

Dividida em duas colunas.

**Esquerda — Diário de bordo** (o que o computador está pensando):
- Botões **⏮ ◀ ▶ ▶| ⏭**: ir ao começo, voltar um passo, tocar/pausar, avançar, ir ao fim. A caixinha escolhe a velocidade (Lenta, Normal, Rápida).
- A barra com um **carrinho** mostra quanto do caminho já foi feito.
- O cartão **AGORA** conta, em uma frase, o que está acontecendo neste passo.
- A **lista de passos** é como o GPS: passos já feitos ficam **verdes**, o atual fica **amarelo brilhante**. Clique em qualquer um para ir direto lá.

**Direita — Resultado:**
- A caixa colorida de cima diz **a resposta em uma frase** (verde = tudo certo, laranja = atenção, vermelho = problema).
- Abas: **Resumo** (o principal), as abas do meio (tabelas e detalhes) e **Complexidade** (quanto trabalho o computador teve, para quem quer saber).

---

### ⑤ Dentro da memória

Mostra **como o computador guarda a cidade**. É como a lista telefônica da prefeitura:

- Cada linha é um **bairro** (a plaquinha à esquerda).
- As **placas verdes** são as ruas que saem dele: o nome do bairro de destino e, no círculo amarelo, o **custo**.
- A **faixa listrada vermelha e branca** (∅) é o fim da lista, como uma barreira de "acabou".
- Quando o carro está num bairro, **a linha dele acende**.
- *Matriz (derivada)* é outra forma de desenhar a mesma coisa: uma tabela grandona, só para comparar.
- No fim há um cartão explicando **por que escolhemos "lista"** (ela ocupa bem menos espaço quando a cidade tem poucas ruas).

---

### 🌃 O rodapé

O horizonte da cidade à noite, com os nomes da faculdade, da matéria e do professor.

---

## Um passeio de 2 minutos

1. Aperte **Carregar Grafo de Teste do Professor**.
2. No mapa, deixe a **Origem** em **O** e clique em **Destino** → clique no bairro **T**.
3. No quadro ③, escolha **Dijkstra** → **Executar Dijkstra**. Veja o carrinho passear.
4. Aperte **Mandar a ambulância** e veja a viatura correndo até T.
5. Escolha **Kruskal** → **Executar** e veja a fibra verde acender (custo total **20**).
6. No mapa, escolha **Interditar vias**, feche uma rua do caminho e execute o Dijkstra de novo: a rota **muda sozinha**.
7. Experimente a **Resiliência** para ver se a cidade tem pontos fracos.
8. Terminou? **Finalizar aplicação**.
