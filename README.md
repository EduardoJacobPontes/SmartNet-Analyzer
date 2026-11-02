# SmartNet Analyzer

Ferramenta web de análise de infraestrutura para **cidades inteligentes**: a cidade é um grafo (bairros = vértices, vias = arestas com custo/distância) sobre o qual rodam DFS, BFS, Dijkstra, Kruskal e uma análise extra de resiliência.

**Demo (GitHub Pages):** https://eduardojacobpontes.github.io/SmartNet-Analyzer/

## Identificação

| | |
|---|---|
| **Curso** | Engenharia de Computação / Software — Ibmec |
| **Disciplina** | Análise e Complexidade de Algoritmos (IBM3121) — 2026.2 |
| **Professor** | Cassius Figueiredo |
| **Integrantes** | _Nome — Matrícula_ (preencher: até 5 integrantes) |

## Como executar

Aplicação 100% estática (HTML + CSS + JavaScript puro, **sem build e sem dependências**).

- **Online:** abra o link do GitHub Pages acima.
- **Local:** baixe/clone o repositório e abra `index.html` no navegador (duplo clique). Funciona via `file://`.
- **Testes (opcional, Node ≥ 16):** `node tests/run-tests.js` (casos conhecidos) e `node tests/fuzz.js` (validação cruzada em milhares de grafos aleatórios)

### Roteiro de uso
1. **Mapear a cidade (1):** escolha *Direcionado/Não-direcionado* e *Com/Sem pesos*; cadastre bairros e vias pelo **formulário**, cole um **texto** ou abra um **arquivo .txt** (formato abaixo). Pesos das vias podem ser editados direto na lista.
2. Clique em **Carregar Grafo de Teste do Professor** para o grafo oficial (O, A, B, C, D, E, F, T; 14 arestas).
3. **Mapa (2):** arraste bairros; o seletor *Origem / Destino / Interditar vias* define o que o clique faz.
4. **Algoritmos (3):** escolha o algoritmo, a origem (e destino opcional no Dijkstra) e execute. Resultados em tabelas na seção **4**, com player passo a passo (início, anterior, play, próximo, final, velocidade).
5. **Memória (5):** mostra a lista de adjacência real (vetor de cabeças → nós encadeados `[destino | peso | id da via]`), em tempo real, e uma matriz derivada só para comparação.
6. **Limpar grafo** apaga o grafo atual; **Finalizar aplicação** encerra a sessão (apaga o estado e mostra a tela de encerramento, de onde se pode iniciar nova análise).

### Formato de arquivo / texto
```
# comentário
direcionado: não     # ou sim
pesos: sim           # ou não
vertices: X Y        # bairros isolados (opcional)
O A 2                # origem destino peso
A -> B 7             # setas são aceitas
```
Separadores: espaço, vírgula ou ponto-e-vírgula. Erros são listados por linha e nada é aplicado enquanto houver erro. Nomes não podem ter espaços.

## Requisitos do enunciado → onde estão

| Requisito | Implementação |
|---|---|
| Estrutura do zero (lista de adjacência) | [`js/graph.js`](js/graph.js) — `Map<vértice, Array<{to, edge}>>`; direcionado/não, com/sem peso |
| Exibir a memória | Seção 5 (lista de adjacência + visão de matriz derivada + comparação de espaço) |
| DFS | [`js/algorithms.js`](js/algorithms.js) — ordem, árvore, tempos d/f, classificação de arestas, componentes, becos sem saída |
| BFS | fila de execução, níveis, saltos e pais |
| Dijkstra | heap binário próprio; tabela de distâncias e predecessores; rota até um destino |
| Kruskal | Union-Find próprio (compressão + rank); arestas escolhidas, decisão por aresta e custo total |
| Loop interativo / Finalizar | botões *Limpar grafo*, formulário, texto/arquivo e *Finalizar aplicação* |
| Preset do professor | botão *Carregar Grafo de Teste do Professor* |

### Como os cálculos são validados
`tests/fuzz.js` gera milhares de grafos aleatórios (direcionados ou não, com/sem pesos, pesos zero, desconexos, vias interditadas, vértices isolados) e compara:
- **Dijkstra** com Floyd–Warshall (distâncias, alcançabilidade e custo de cada caminho devolvido);
- **BFS** com Floyd–Warshall de peso unitário;
- **DFS** com a alcançabilidade e as propriedades da busca (cada vértice uma vez, intervalos aninhados, tempos 1..2V, componentes);
- **Kruskal** com Prim e, em grafos pequenos, com força bruta sobre todos os subconjuntos de arestas;
- **Pontos de articulação e pontes** com a remoção de cada vértice/aresta e recontagem de componentes.

Os testes foram verificados injetando bugs de propósito (ordenação invertida, relaxamento errado, ponte errada, salto errado): todos foram detectados.

### Resultados esperados no grafo do professor (validados em `tests/`)
- **Dijkstra (origem O):** A=2, B=4, C=4, D=8, E=7, F=14, T=13 (rota até T: O→A→B→D→T)
- **Kruskal:** B–C(1), O–A(2), A–B(2), B–E(3), F–T(3), B–D(4), D–T(5) → **custo 20**
- **BFS (origem O):** níveis `[O] [A C B] [D F E] [T]`
- **DFS (origem O):** O A B C E D T F (vizinhos na ordem de cadastro)

## Funcionalidades extras
- **Interditar vias:** feche ruas no mapa; todos os algoritmos ignoram vias fechadas e **recalculam na hora** (rota de ambulância desvia, a fibra é reprojetada).
- **Carro percorrendo o grafo:** a cada passo do DFS/BFS/Dijkstra um carro dirige pelas ruas até o bairro atual (inclusive as voltas do DFS), com faróis e curvas.
- **Mandar a ambulância 🚑:** no Dijkstra, com origem e destino escolhidos, uma ambulância (sirene piscando) percorre a rota mais rápida, deixando rastro no mapa.
- **Cidadezinha vista de cima:** o mapa é ambientado com árvores, casas, prédios, lagos e gramado ao redor das ruas (decorativos; os bairros são as rotatórias).
- **Central de operações:** cada resultado começa por um veredito em linguagem simples, com abas (Resumo, detalhes, Complexidade) e um diário de bordo clicável com todos os passos.
- **Malha viária:** vias desenhadas como ruas de asfalto com faixa central; interditadas ficam com barreira vermelha.
- **Análise de resiliência (Tarjan):** bairros e vias cuja falha isola parte da cidade (pontos de articulação e pontes) com o impacto de cada falha.
- Player passo a passo com destaque no mapa e na linha da lista de adjacência.
- Escolha entre ordem de cadastro ou alfabética dos vizinhos (DFS/BFS).

## Entendendo cada parte da interface

### Origem e destino: quem usa o quê?

| Algoritmo | Origem | Destino | Por quê |
|---|:---:|:---:|---|
| **DFS** | usa | não usa | Explora a cidade a partir da origem; não procura um bairro específico. A origem define *onde começa* e, por isso, a ordem de visita e a árvore. |
| **BFS** | usa | não usa | A onda de alerta sai da origem e alcança todos os bairros; mostra em quantos saltos cada um é atingido. |
| **Dijkstra** | usa | **opcional** | Sempre calcula o menor custo da origem até **todos** os bairros. Se você escolher um destino, o site também destaca essa rota no mapa e libera o botão **Mandar a ambulância**. |
| **Kruskal** | não usa | não usa | A fibra óptica é uma propriedade da cidade inteira (árvore geradora mínima); não depende de ponto de partida. |
| **Resiliência** | não usa | não usa | Analisa a cidade toda em busca de pontos únicos de falha. |

Ou seja: a **origem importa** para DFS, BFS e Dijkstra (em grafos não conexos ela decide quais bairros são alcançados; no DFS também muda a ordem). O **destino** só serve para o Dijkstra e é opcional. No mapa, o botão **Origem** define de onde o carro sai e o botão **Destino** define aonde se quer chegar.

### Kruskal (rede de fibra óptica, árvore geradora mínima)
Imagine que a prefeitura quer levar fibra óptica a **todos** os bairros gastando o mínimo. Cada rua tem um custo para instalar a fibra. O Kruskal:
1. ordena todas as ruas da mais barata para a mais cara;
2. percorre a lista e **aceita** uma rua se ela liga dois bairros que ainda não estavam conectados entre si (usando Union-Find);
3. **rejeita** a rua se os dois bairros já estão ligados por outro caminho, pois isso só criaria um anel caro e inútil;
4. para quando todos os bairros estão conectados.

O resultado é a **MST (árvore geradora mínima)**: com V bairros, exatamente V−1 trechos, de menor custo total e sem redundância. No grafo do professor: 7 trechos, custo **20**. Se a cidade for desconexa, não existe árvore única; o site devolve uma **floresta** (um MST por ilha) e avisa. Em grafos direcionados a fibra ignora o sentido das ruas.

### Resiliência (extra do projeto)
Responde: **"se um bairro ou uma rua falhar, a cidade se parte em pedaços?"**
- **Bairro crítico (ponto de articulação):** bairro que, se for removido (alagamento, queda de energia), deixa outros bairros sem comunicação.
- **Rua crítica (ponte):** rua que, se for fechada (obra, acidente), desconecta parte da cidade.
- O site mostra o **impacto**: quantos blocos isolados sobram e o tamanho de cada um. Os pontos críticos ficam em rosa no mapa.
- Se nada for crítico, a rede é **resiliente**: sempre há rota alternativa.

Usa o algoritmo de Tarjan (DFS com tempos de descoberta e *low-link*), em O(V+E). Combine com **Interditar vias**: feche ruas e veja a rede ficar mais frágil.

### "Dentro da memória" (como o grafo é guardado)
O grafo é armazenado como **lista de adjacência**, escrita do zero em [`js/graph.js`](js/graph.js). Na tela:
- cada **linha** é um bairro (uma posição do vetor de listas, com seu índice);
- as **placas verdes** em seguida são os nós da lista encadeada daquele bairro: cada nó guarda o **vizinho (para onde a rua vai)**, o **peso (círculo amarelo)** e o **id da via** (`#n`);
- a **barreira listrada ∅** é o ponteiro nulo (fim da lista);
- ruas interditadas aparecem em vermelho;
- em grafos não-direcionados cada rua aparece **duas vezes** (uma em cada bairro das pontas), apontando para o mesmo registro de aresta, por isso os "nós nas listas" são 2E;
- durante a execução, a linha do bairro atual **acende**.

Há ainda a aba **Matriz (derivada)**, que desenha a mesma cidade como matriz V×V só para **comparação**: o programa guarda a lista, e a matriz é calculada na hora apenas para mostrar quanto espaço seria desperdiçado (a "ocupação da matriz" mostra a porcentagem de células usadas). O cartão final justifica a escolha da lista: cidades são grafos esparsos, então O(V+E) de espaço compensa os O(V²) da matriz.

## Complexidade e decisões de projeto

| Algoritmo | Tempo | Espaço |
|---|---|---|
| DFS / BFS | O(V + E) | O(V) |
| Dijkstra (heap binário) | O((V + E) log V) | O(V + E) |
| Kruskal (sort + Union-Find) | O(E log E) | O(V + E) |
| Resiliência (Tarjan) | O(V + E) | O(V) |

**Por que lista de adjacência?** Malhas urbanas são grafos esparsos (E ≪ V²). A lista usa O(V + E) de espaço (a matriz, O(V²)) e permite que DFS/BFS/Dijkstra percorram apenas vizinhos reais. O custo é que testar "existe a via u–v?" é O(grau(u)) — irrelevante para os algoritmos pedidos. No grafo do professor, 28 nós de lista contra 64 células de matriz.

### Comportamento em casos de borda
- **Grafo desconexo:** DFS gera floresta e lista as ilhas; BFS/Dijkstra marcam bairros inalcançáveis (∞); Kruskal devolve floresta geradora mínima e avisa.
- **Pesos zero:** aceitos. **Pesos negativos:** Dijkstra recusa com mensagem clara; Kruskal aceita.
- **Direcionado:** Dijkstra/BFS/DFS respeitam o sentido; Kruskal e Resiliência ignoram o sentido (avisam na tela).
- **Sem pesos:** todas as vias valem 1. **Laços** são rejeitados; via repetida atualiza o peso.
- Empates no Kruskal seguem a ordem de cadastro das vias. Todo texto digitado entra no DOM por `textContent` (sem injeção de HTML).

## Guia simples da interface
Veja [GUIA-DO-SITE.md](GUIA-DO-SITE.md) (explicado passo a passo, como para uma criança de 8 anos) ou o botão **Como usar?** no site.

## Estrutura
```
index.html          interface
css/styles.css      design system (dark, fintech/smart-city)
js/graph.js         lista de adjacência (do zero)
js/algorithms.js    DFS, BFS, Dijkstra (MinHeap), Kruskal (UnionFind), Tarjan
js/parser.js        leitura de texto/arquivo
js/presets.js       grafo do professor e cidade demo
js/mapview.js       mapa SVG (layout, arraste, animação)
js/views.js         tabelas de resultado e visão da memória
js/app.js           controlador da interface
tests/run-tests.js  testes de casos conhecidos (node)
tests/fuzz.js       validação cruzada contra Floyd–Warshall, Prim e força bruta
GUIA-DO-SITE.md     guia da interface explicado de forma simples
```
