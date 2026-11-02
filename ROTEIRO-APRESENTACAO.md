# Roteiro de apresentação (15 minutos)

Critérios do professor: **Correção algorítmica 40%** · **Usabilidade 30%** · **Domínio da complexidade 20%** · **Apresentação 10%**.

## Qual grafo usar?

**Use o "Grafo de Teste do Professor" como principal.** Ele é o grafo da especificação: o professor conhece as respostas e vai conferir os números. A cidade demo serve só para contar a história (hospital → aeroporto, obra fechando rua). Se sobrar tempo, mostre-a no final.

Ele também vai testar um **grafo inédito**. Prepare-se: abra a aba **Texto / Arquivo**, cole o grafo dele e clique em *Aplicar texto* (ou use o formulário). Funciona com direcionado, sem pesos, pesos zero e grafo desconexo.

### Respostas que você deve saber de cor (grafo do professor)
| Algoritmo | Resultado |
|---|---|
| Dijkstra (origem O) | A=2, B=4, C=4, D=8, E=7, F=14, **T=13** (O→A→B→D→T) |
| Kruskal | B–C(1), O–A(2), A–B(2), B–E(3), F–T(3), B–D(4), D–T(5) → **custo 20**, 7 arestas |
| BFS (origem O) | níveis [O] · [A C B] · [D F E] · [T] |
| DFS (origem O) | O A B C E D T F (vizinhos na ordem de cadastro) |
| Memória | V=8, E=14, 28 nós nas listas contra 64 células da matriz (43,8%) |

## Roteiro sugerido

| Tempo | O que fazer | O que falar |
|---|---|---|
| 0:00 | Abrir o site | "O SmartNet Analyzer modela a cidade como um grafo: bairros são vértices e vias são arestas com custo." |
| 1:00 | Carregar o Grafo do Professor; mostrar **Dentro da memória** | "Guardamos em **lista de adjacência**, implementada do zero: um vetor onde cada posição aponta para a lista de vizinhos. Cada nó guarda destino, peso e id da via." |
| 3:00 | **DFS** (origem O) | "Usa uma pilha. Vai até o fim de cada rua antes de voltar. Serve para auditar conectividade e achar becos sem saída. O(V+E)." |
| 4:30 | **BFS** (origem O) | "Usa uma fila. Propaga em ondas e dá o menor número de saltos. Simula alerta de emergência. O(V+E)." |
| 6:00 | **Dijkstra** (O → T) + **Mandar a ambulância** | "Menor custo com pesos não negativos. Usamos heap binário feito por nós: O((V+E) log V). O T custa 13." |
| 8:00 | **Kruskal** | "Ordena as arestas e usa Union-Find para evitar ciclos. Custo 20, 7 arestas. O(E log E)." |
| 9:30 | **Interditar vias** + **Resiliência** (extra) | "Fechei uma rua e tudo recalcula. A resiliência usa Tarjan para achar pontos únicos de falha." |
| 11:00 | Colar um grafo inédito / desconexo / peso zero | "Trata desconexo (∞ e floresta), pesos zero e recusa pesos negativos no Dijkstra." |
| 12:30 | Explicar a complexidade e lista vs matriz (abaixo) | |
| 14:00 | **Finalizar aplicação** | Mostrar o botão exigido. |

## Complexidade: como explicar

V = número de bairros, E = número de vias.

| Algoritmo | Tempo | Espaço | Justificativa em uma frase |
|---|---|---|---|
| **DFS** | O(V+E) | O(V) | Cada vértice entra e sai da pilha uma vez; cada posição das listas é percorrida uma vez. |
| **BFS** | O(V+E) | O(V) | Cada vértice é enfileirado no máximo uma vez. A fila tem índice de cabeça, então desenfileirar é O(1) (sem `shift()`). |
| **Dijkstra** | O((V+E) log V) | O(V+E) | Cada aresta pode causar um push no heap (O(log V)). Sem heap, varrer para achar o mínimo seria O(V²). |
| **Kruskal** | O(E log E) | O(V+E) | Dominado pela ordenação. Union-Find com compressão de caminho e união por rank custa α(V) ≈ constante por operação. Como E ≤ V², log E = O(log V). |
| **Resiliência (Tarjan)** | O(V+E) | O(V) | Uma única DFS com tempos de descoberta e *low-link*. |

## Por que lista de adjacência e não matriz?

1. **Cidades são grafos esparsos:** cada bairro liga a poucos vizinhos, então E é muito menor que V². Matriz gasta O(V²) mesmo com poucas ruas. Lista gasta O(V+E).
2. **Os algoritmos pedidos percorrem vizinhos:** com lista, achar os vizinhos de u custa O(grau(u)). Com matriz custaria O(V) por vértice, e o DFS/BFS iriam de O(V+E) para **O(V²)**.
3. **Prova na tela:** no grafo do professor são 28 nós de lista contra 64 células de matriz; numa cidade de 1.000 bairros e 3.000 vias seriam 6.000 nós contra 1.000.000 de células.
4. **Contrapartida honesta:** testar "existe a via u–v?" custa O(grau(u)) na lista e O(1) na matriz. Não precisamos disso nos algoritmos pedidos. **Quando a matriz seria melhor:** grafos densos (E perto de V²) ou quando essa consulta é frequente (por exemplo, Floyd–Warshall).

## Perguntas que o professor pode fazer

**Qual a diferença entre DFS e BFS?** DFS usa pilha (ou recursão) e vai fundo; BFS usa fila e vai por níveis. Só o BFS garante o menor número de saltos.

**O BFS acha o caminho mais barato?** Não, apenas o com menos arestas. Com pesos, é o Dijkstra.

**Por que o Dijkstra não aceita peso negativo?** Ele assume que, ao fixar um vértice, nenhum caminho futuro o melhora. Um peso negativo quebra isso. Nosso site recusa com mensagem clara (Bellman-Ford resolveria).

**Qual a complexidade do Dijkstra sem heap?** O(V²). Com heap binário, O((V+E) log V), melhor em grafos esparsos.

**Por que Kruskal ordena as arestas e para que serve o Union-Find?** Ordenar garante que a próxima aresta aceita é sempre a mais barata. O Union-Find responde em quase O(1) se dois bairros já estão conectados, evitando ciclos.

**O que acontece se o grafo for desconexo?** BFS/Dijkstra marcam os bairros inalcançáveis (∞). DFS gera uma floresta e lista as ilhas. Kruskal devolve uma floresta geradora mínima e avisa.

**Peso zero?** Funciona em todos os algoritmos.

**E se o grafo for direcionado?** DFS, BFS e Dijkstra respeitam o sentido. Kruskal e Resiliência ignoram o sentido, porque MST e articulação são conceitos de grafos não-direcionados; o site avisa na tela.

**Como se desempata no Kruskal e no DFS?** Kruskal mantém a ordem de cadastro das vias (ordenação estável). DFS/BFS seguem a ordem de cadastro ou a alfabética, à escolha do usuário.

**Por que sua BFS é O(V+E) mesmo usando array?** Porque usamos um índice de cabeça em vez de `shift()`, que seria O(n) em cada remoção.

**Como vocês validaram?** Testes com os resultados do grafo do professor e validação cruzada em milhares de grafos aleatórios contra Floyd–Warshall, Prim e força bruta (`node tests/fuzz.js`).

**O que foi implementado do zero?** Lista de adjacência, heap binário, Union-Find, DFS, BFS, Dijkstra, Kruskal e Tarjan. Sem biblioteca de grafos.

## Dicas de apresentação
- Divida as falas entre os integrantes por algoritmo e ensaie com cronômetro (15 minutos no máximo).
- Deixe o **Grafo do Professor** carregado antes de começar e a aba "Como usar?" fechada.
- Use a velocidade **Rápida** no player para economizar tempo; o botão *Ver final* pula a animação.
- Todos precisam estar presentes: quem faltar tem a nota individual reduzida pela metade.
- Entregue o link do repositório por e-mail até **03/11/2026, 23h59**, com o assunto "Entrega AC Complexidade Algoritmos" e os nomes do grupo no corpo.
- Preencha **nomes e matrículas** no README antes de enviar.
