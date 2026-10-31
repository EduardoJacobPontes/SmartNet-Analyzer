# SmartNet Analyzer

Ferramenta web de análise de infraestrutura para **cidades inteligentes**: a cidade é um grafo (bairros = vértices, vias = arestas com custo/distância) sobre o qual rodam DFS, BFS, Dijkstra, Kruskal e uma análise extra de resiliência.

**Demo (GitHub Pages):** https://hugowatzl.github.io/smartnet-analyzer/

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
- **Testes do núcleo (opcional, Node ≥ 16):** `node tests/run-tests.js`

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

### Resultados esperados no grafo do professor (validados em `tests/`)
- **Dijkstra (origem O):** A=2, B=4, C=4, D=8, E=7, F=14, T=13 (rota até T: O→A→B→D→T)
- **Kruskal:** B–C(1), O–A(2), A–B(2), B–E(3), F–T(3), B–D(4), D–T(5) → **custo 20**
- **BFS (origem O):** níveis `[O] [A C B] [D F E] [T]`
- **DFS (origem O):** O A B C E D T F (vizinhos na ordem de cadastro)

## Funcionalidades extras
- **Interditar vias:** feche ruas no mapa; todos os algoritmos ignoram vias fechadas e **recalculam na hora** (rota de ambulância desvia, a fibra é reprojetada).
- **Despachar veículo 🚑:** anima a rota de emergência do Dijkstra no mapa.
- **Análise de resiliência (Tarjan):** bairros e vias cuja falha isola parte da cidade (pontos de articulação e pontes) com o impacto de cada falha.
- Player passo a passo com destaque no mapa e na linha da lista de adjacência.
- Escolha entre ordem de cadastro ou alfabética dos vizinhos (DFS/BFS).

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
tests/run-tests.js  testes do núcleo (node)
```
