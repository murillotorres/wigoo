# 01 · Pipeline de ingestão multi-cliente

Como eu desenharia a ingestão de dados (Google Ads, Meta, TikTok, VTEX) pro BigQuery, todo dia, pra vários clientes, sem que a entrada de um cliente novo exija mexer em código.

## A ideia em uma frase

Um pipeline **genérico**, que recebe "qual cliente" e "qual fonte" como parâmetro, guiado por uma tabela de configuração — não um script por cliente.

## As peças

**Cadastro de clientes (`client_registry`)**
Uma tabela simples com: id do cliente, quais fontes ele usa (Google Ads, Meta, TikTok, VTEX), em qual dataset do BigQuery os dados dele ficam, e onde estão as credenciais dele.

Cadastrar um cliente novo = adicionar uma linha nessa tabela. Sem deploy de código. No começo, esse cadastro pode ser manual (alguém roda um comando ou preenche uma planilha/console) — não precisa de tela bonita agora.

**Um "orquestrador" que dispara o trabalho por cliente + fonte**
Todo dia, ele roda a combinação `cliente × fonte` (Vitalis + Google Ads, Vitalis + Meta, Vitalis + VTEX, Cliente B + Google Ads...) como tarefas separadas. Se uma falhar, as outras continuam. O Meta do cliente A cair não impede o Google Ads do cliente A, nem nada do cliente B.

**Dados "crus" antes dos dados "prontos"**
Cada busca guarda primeiro o que veio da API praticamente sem mexer (`raw`). Só depois isso vira uma versão limpa e organizada (`curated`), que é o que o time de BI usa. Guardar o cru serve pra investigar problema sem precisar chamar a API nem gastar de novo.

**Um "diário de bordo" de cada execução**
Uma tabela de controle que registra: qual cliente, qual fonte, quando rodou, quanto tempo levou, quantas linhas leu e gravou, se deu certo ou não, e qual foi o erro (se teve). Isso é o que permite descobrir "esse pipeline parou de rodar" antes que alguém perceba pelo número errado no relatório.

## Isolamento dos dados

**Decisão: um dataset do BigQuery por cliente**, com as tabelas divididas por data (particionadas).

Por quê: fica impossível uma consulta errada misturar dados de dois clientes sem querer, as permissões de acesso (quem pode ver o quê) ficam simples de configurar, e atende direto o requisito de manter os clientes isolados. Se um dia a Wigoo tiver centenas de clientes, dá pra repensar (datasets demais também tem custo de gestão) — mas para o volume de hoje essa é a opção mais segura e mais fácil de entender.

## Custo do BigQuery

- Tabelas divididas por data (particionadas): cada consulta só lê o pedaço de tempo que precisa, não a tabela inteira.
- Nunca atualizar (`MERGE`) mais do que a janela de dias que realmente pode ter mudado.
- Pegar só as colunas necessárias, nunca "todas as colunas" por padrão.
- Definir um limite de bytes que uma consulta pode processar, pra nenhum erro de código virar uma conta gigante sem querer.

---

## As perguntas do desafio, respondidas direto

### (a) Como lidar com dado que muda depois (retroativo) sem reprocessar tudo todo dia?

Google Ads e Meta corrigem os números de conversão de até 30 dias atrás. Então, todo dia, além do dia de ontem, eu busco de novo os últimos 30 dias — não o histórico inteiro. Esse dado entra na área "crua" e só atualiza (`MERGE`) as partições daqueles 30 dias na tabela final. Assim, correção retroativa é capturada, o histórico antigo nem é tocado, e rodar de novo por engano não duplica nada (porque é atualização, não inserção nova).

### (b) O Meta ficou 6 horas fora do ar ontem à noite. O que o sistema faz sozinho, e quando precisa acordar alguém?

Sozinho: tenta de novo algumas vezes, indo com calma crescente entre tentativas (não martela a API). Se ainda assim não conseguir, marca aquela execução como falha no "diário de bordo" e segue pros outros clientes e fontes — não trava o resto. Na próxima rodada diária, ele tenta buscar de novo, e como a janela de 30 dias cobre isso, o dado acaba entrando sozinho, sem ninguém precisar mexer.

Quando chamar alguém: se a falha continuar por mais de uma rodada seguida, se estiver perto de sair da janela de 30 dias sem conseguir recuperar, ou se acontecer em vários clientes ao mesmo tempo (sinal de que o problema é maior que uma API fora do ar). Uma queda de 6 horas isolada, à noite, sozinha, normalmente **não** precisa acordar ninguém — o próprio sistema se recupera no dia seguinte. É da minha cultura, principalmente ocupando uma posição de liderança - resolver isso sozinho na hora se necessário/possível, prezando em não levar problemas que eu mesmo poderia resolver para a minha equipe fora de hora. 


### (c) Uma plataforma renomeou um campo e alguns clientes passaram a receber `null` sem erro nenhum. Quando e como a gente descobre?

Esse é o pior tipo de problema, porque tecnicamente "não deu erro". Duas camadas pra pegar isso:

1. **Confere o formato na entrada.** Campos importantes (ex.: id da campanha, data, valor gasto) são checados: existem? têm o tipo certo? Se um campo crítico sumiu ou mudou de tipo, a ingestão daquele lote falha visivelmente — em vez de gravar `null` como se estivesse tudo bem.
2. **Confere o resultado depois de gravar.** Um monitor simples observa: quantas linhas vieram hoje comparado com a média, quantos campos estão vindo vazios, se algum cliente ficou sem nenhuma linha. Uma mudança brusca dispara um alerta.

Isso pega tanto o caso "quebrou visivelmente" quanto o caso "continuou rodando, mas o dado está errado".

### (d) O que eu deixaria manual ou simples de propósito na primeira versão, e quando eu voltaria pra automatizar?

Essa é a pergunta que mais importa aqui, então vou direto:

**Cadastro de cliente novo: manual.** Alguém roda um comando ou preenche a tabela `client_registry` e cria a credencial à mão no Secret Manager. Não vou construir uma tela de autoatendimento agora. Eu automatizaria isso quando: entrar cliente virar uma coisa frequente (toda semana, não uma vez por mês), ou quando o processo manual começar a gerar erro por esquecimento, ou quando alguém fora do time técnico precisar fazer isso sozinho.

**Alerta de campo quebrado: simples, sem inteligência.** Regra fixa tipo "esse campo não pode vir vazio" e "esse número não pode cair mais de X% de um dia pro outro" — nada de sistema esperto que aprende o padrão sozinho. Eu evoluiria isso quando os alertas simples começarem a disparar falso alarme com frequência, ou quando aparecerem muitos casos que essas regras simples não pegam.

**Nova tentativa (retry) de API que falhou: poucas tentativas, e para.** Não vou montar uma fila robusta de reprocessamento agora — o próprio ciclo diário, com a janela de 30 dias, já recupera o dado perdido no dia seguinte, sem precisar de infraestrutura extra. Eu criaria uma fila de verdade se: o negócio não puder esperar até o dia seguinte pra ter o dado (ou seja, se existir um prazo/SLA curto), se as falhas começarem a acumular em volume, ou se for necessário reprocessar coisas específicas sem esperar o próximo ciclo inteiro.

**Regra geral que uso pra decidir:** eu automatizo quando o custo de continuar fazendo à mão (tempo gasto, ou risco de erro humano) fica maior que o custo de construir e manter a automação. Não antes disso.
