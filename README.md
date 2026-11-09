# Diagnóstico de carreira internacional

👉 https://ingridslytherin.github.io/diagnostico-carreira/

Comecei esse projeto enquanto me preparava para vagas remotas em empresas de fora. Eu tinha muita dúvida do tipo "meu currículo está bom para o mercado americano?", "meu inglês dá conta?", "meu GitHub passa uma boa impressão?", e a maioria das respostas que eu achava era genérica demais. Então resolvi montar algo que olhasse para o **meu** material e dissesse o que fazer primeiro.

Você envia o currículo, responde umas perguntas sobre você e a página devolve notas, um plano de ação e, o que eu acho mais útil, os pontos em que a sua percepção não bate com o que o currículo mostra. Por exemplo: você responde que suas experiências mostram resultados, mas nenhum bullet tem um número sequer.

Não tem servidor, cadastro nem IA. Tudo roda no seu navegador e as notas saem de regras que estão aqui no código. Mais abaixo eu explico cada cálculo.

## Como usar

Abra a página, envie o PDF do currículo (ou cole o texto) e responda a autoavaliação. Se quiser, cole também o texto de uma vaga, ative a verificação de inglês e coloque seu usuário do GitHub. Depois é só clicar em "Gerar meu diagnóstico". Dá para baixar o resultado em .md ou salvar em PDF pela impressão.

Uma dica: depois de enviar o PDF, olha o texto que aparece na caixa. Ele é bem parecido com o que um ATS (aqueles sistemas de triagem que as empresas usam) consegue ler. Se ali estiver embaralhado, lá também vai estar.

## Sobre privacidade

Isso foi uma preocupação desde o começo, porque currículo tem muito dado pessoal.

- O PDF é lido no próprio navegador, com o pdf.js. O currículo não fica salvo em lugar nenhum.
- As respostas das perguntas ficam guardadas como rascunho no `localStorage`, só para você não perder se fechar a aba. O botão "Apagar tudo" limpa.
- A verificação de inglês é opcional. Se você ativar, o texto vai para a API pública do [LanguageTool](https://languagetool.org), mas antes eu tiro a primeira linha (que normalmente é o nome), e-mails, telefones e links.
- O GitHub também é opcional e só consulta dados públicos, direto do seu navegador.

E eu, que publiquei a página, não recebo nada de quem usa.

## O que ela analisa

**Currículo.** As regras seguem o padrão de currículo americano e o que costuma quebrar em ATS: PDF que é imagem, layout em duas colunas, foto e ícones, mais de duas páginas. Olha também se está tudo em inglês, se tem as seções de sempre (Summary, Experience, Skills, Education), contato com LinkedIn e GitHub, fuso horário e o nível de inglês. Nos bullets, confere se começam com verbo de ação, se mostram resultado com número, se fogem de "responsible for" e "worked on", se não usam "I/my" e se não se repetem. E aponta coisas que a gente coloca no Brasil mas não se usa lá fora, como idade, estado civil, CPF e nacionalidade, além de clichês ("passionate team player") e campos de modelo esquecidos tipo `[Seu Nome]`.

**Vaga.** Mostra quais tecnologias do anúncio estão ou não no seu currículo (são 76 termos no dicionário) e procura sinais de que a vaga aceita gente do Brasil ("LATAM", "anywhere", contrato via Deel) ou de que não aceita ("authorized to work in the US", "W-2").

**Inglês escrito.** Usa o LanguageTool para achar erros de gramática e ortografia. Filtrei os termos técnicos, senão "Laravel" e "NestJS" viravam erro de digitação.

**GitHub.** A ideia é simular a olhada rápida que um tech lead dá no perfil: bio, README de perfil, se você tem projetos próprios, se tem atividade recente, se os repositórios têm descrição, demo e topics, e como estão os READMEs dos 4 projetos principais.

**Plano de ação.** Junta tudo e diz por onde começar, com passos pequenos. Se você disser que só consegue conversar em inglês sobre assuntos rotineiros, por exemplo, ele sugere conversar com nativos duas vezes por semana (Tandem e HelloTalk são gratuitos; italki e Cambly são pagos) levando situações de trabalho para treinar. Se nunca treinou entrevista em voz alta, sugere uma simulação gravada por semana. Se não tem projeto para mostrar, sugere um projeto pequeno e completo em 3 a 4 semanas.

## Como os cálculos funcionam

Usei a mesma escala em todas as notas:

| Nota | Nível | O que quer dizer |
|---|---|---|
| 0–39 | Fraco | Seria descartado nessa etapa |
| 40–59 | Em desenvolvimento | Passa em poucas empresas |
| 60–74 | Competitivo | Passa na maioria das triagens |
| 75–89 | Forte | Se destaca entre candidatos de fora |
| 90–100 | Excelente | Nível de quem já trabalha para os EUA |

### Currículo

Cada verificação tem um peso. Se passou, ganha o peso inteiro; se ficou como "Melhorar", ganha metade; se é "Crítico", não ganha nada. A nota é o quanto você fez do total possível:

```
nota = pontos obtidos ÷ soma dos pesos das verificações que se aplicam × 100
```

Algumas verificações só entram quando fazem sentido. Não dá para avaliar o tamanho do Summary de quem não tem Summary, por exemplo.

| Verificação | Peso | Quando fica Melhorar ou Crítico |
|---|---|---|
| Está em inglês | 4 | Crítico se a maior parte está em português; Melhorar se está misturado ou com títulos em português |
| Bullets começam com verbo de ação | 3 | OK a partir de 80%, Melhorar a partir de 50%, abaixo disso Crítico |
| Bullets com números | 3 | OK a partir de 50%, Melhorar a partir de 25% (anos como "2021" não contam) |
| Pelo menos 3 bullets de experiência | 3 | Crítico se tiver menos |
| Campos de modelo esquecidos | 3 | Crítico se aparecer `[...]`, "PREENCHER" ou "lorem ipsum" |
| Seções padrão | 2 | Melhorar se faltar Summary, Skills ou Education; Crítico se não tiver nem Experience nem Projects |
| E-mail | 2 | Crítico se não tiver |
| Dados pessoais | 2 | Crítico se tiver idade, estado civil, CPF/RG, nacionalidade ou gênero |
| "Responsible for", "worked on" e parecidos | 2 | Melhorar com 1 ou 2; Crítico com 3 ou mais |
| Bullets repetidos | 2 | Melhorar; Crítico se forem 3 ou mais, ou mais de 20% |
| Tamanho | 1,5 | Crítico com mais de 2 páginas ou menos de 150 palavras; Melhorar com menos de 250, mais de 1000, ou 2 páginas com menos de 550 palavras (cabe em uma) |
| Layout em colunas | 1,5 | Melhorar |
| LinkedIn, GitHub, localização | 1 cada | Melhorar se faltar |
| Foto/imagens, ícones | 1 cada | Melhorar |
| "I/my" nos bullets, bullets com mais de 32 palavras | 1 cada | Melhorar |
| Clichês | 1 | Melhorar com 1 ou 2; Crítico com 3 ou mais |
| Datas nas experiências | 1 | Melhorar se faltar |
| Nível de inglês escrito no currículo | 1 | Melhorar se faltar |
| Summary entre 25 e 100 palavras | 1 | Melhorar fora disso |
| Telefone sem o +55 | 0,5 | Melhorar |

Só a soma ponderada não bastava. Nos testes, um currículo de 3 páginas com o mesmo bullet repetido 9 vezes tirava 85, e nenhum recrutador chegaria ao fim dele. Triagem não é média: tem coisa que elimina na hora. Por isso criei um teto para essas falhas. Quando a nota é limitada, a página avisa o motivo.

| Falha | Nota máxima |
|---|---|
| PDF sem texto (escaneado ou imagem) | 0 |
| Currículo em português, ou com campos de modelo esquecidos | 39 |
| Inglês misturado com português, mais de 2 páginas ou menos de 150 palavras, sem e-mail, menos de 3 bullets, muitos bullets repetidos | 59 |
| Duas colunas | 74 |

### Vaga

```
compatibilidade = tecnologias da vaga que aparecem no currículo ÷ tecnologias da vaga que o dicionário reconhece × 100
```

Se o anúncio não cita nenhuma tecnologia do dicionário, a compatibilidade fica como "não avaliada".

### Inglês escrito

```
erros por 100 palavras = (erros graves + 0,3 × erros de estilo) ÷ (máx(palavras, 150) ÷ 100)
nota = 100 − 20 × erros por 100 palavras
```

A nota fica sempre entre 0 e 100. Erro grave é gramática ou ortografia; estilo é sugestão de redação, por isso pesa menos. Com um erro grave a cada 100 palavras, a nota fica em 80; com cinco, chega a zero. O mínimo de 150 palavras veio de um teste em que um texto curto com 4 erros zerava a nota, o que era exagerado.

### GitHub

Funciona igual ao currículo, com pesos:

| Verificação | Peso | Critério |
|---|---|---|
| READMEs dos 4 projetos principais | 3 | Média de 7 itens (descrição, prints, como rodar, stack, demo, decisões técnicas, em inglês): OK a partir de 75%, Melhorar a partir de 40% |
| Projetos próprios públicos | 2 | OK com 4 ou mais, Melhorar com 1 a 3, Crítico sem nenhum |
| README de perfil | 1,5 | Melhorar se não tiver |
| Atividade recente | 1,5 | OK até 30 dias, Melhorar até 120, Crítico depois disso |
| Demo online | 1,5 | Melhorar se nenhum projeto principal tiver |
| Bio em inglês | 1 | Melhorar se estiver vazia ou em português |
| Descrição nos repositórios | 1 | OK se todos têm, Melhorar se pelo menos metade, Crítico abaixo |
| Nome e localização, site, topics, excesso de forks | 0,5 cada | Melhorar |

Os "projetos principais" são os repositórios próprios, sem forks e arquivados, com mais estrelas; em caso de empate, entram os mais recentes.

### Autoavaliação

Cada resposta vale 100 (sim), 50 (em parte) ou 0 (não). As perguntas de inglês têm cinco níveis: 0, 25, 50, 75 e 100. A nota de cada área é a média do que foi respondido, e o que ficou em branco não entra na conta. A clareza do objetivo é só a fração dos campos preenchidos (cargo, mercado e nível).

Essas notas aparecem separadas, como "O que você declarou", porque são percepção, não medida.

### Ordem do plano

O que vai para "Comece por aqui":
- falhas críticas do currículo (até 3);
- inglês do currículo abaixo de 60 e GitHub com problema crítico;
- vaga que pode não aceitar o Brasil;
- inglês falado com dificuldade ou só no rotineiro;
- nunca ter treinado entrevista;
- objetivo indefinido e nenhum projeto para mostrar;
- a divergência "diz que mostra resultados, mas os bullets não têm números".

O resto entra em "Depois". Dentro de cada grupo, primeiro aparecem as divergências entre o que você disse e o que o material mostra, depois o que foi medido e por último o que veio só da autoavaliação.

## Por que esses pesos

O que mais pesa é o que mais elimina. Currículo em inglês tem peso 4 porque é pré-requisito: sem isso, o resto nem é lido. Verbo de ação e número têm peso 3 porque são o que mostra impacto numa leitura rápida; sem eles, o currículo vira lista de tarefas. "Melhorar" vale metade porque são problemas que não derrubam sozinhos, mas que, somados, deixam o currículo com cara de amador.

Escolhi regras em vez de IA porque queria que o resultado fosse sempre o mesmo para o mesmo currículo, que desse para explicar cada ponto e que não custasse nada para ninguém.

Os pesos e limites são escolhas minhas, baseadas no que é comum em recrutamento para vagas remotas nos EUA. Eles não foram validados com dados reais de contratação. A nota mede forma e evidência (verbos, números, seções, links), não se a sua experiência é boa. Use como um primeiro filtro, não como sentença.

## Limitações que eu conheço

- Detecto colunas pelo alinhamento do texto no PDF. Layouts muito diferentes (caixas de texto soltas, tabelas) podem escapar.
- Muitos editores desenham o marcador "•" como imagem, então ele some na leitura. Quando isso acontece, analiso as frases das seções Experience e Projects.
- O LanguageTool acha erro, mas não diz se o texto soa natural. Um texto sem erros ainda pode soar traduzido.
- Sem login, a API do GitHub permite 60 consultas por hora por rede, e cada análise usa umas 7. Projetos fixados e repositórios privados não aparecem.
- O dicionário de vagas tem 76 termos. O que estiver fora dele não entra na compatibilidade.

## Rodando localmente

Basta abrir o `index.html` no Chrome ou no Edge, sem instalar nada. Só precisa de internet para carregar o pdf.js e para as verificações opcionais.

Para os testes, você precisa do [Node.js](https://nodejs.org) 18 ou mais novo:

```bash
npm test                 # roda tudo
npm run test:regras      # só as regras, bem rápido
npm run test:navegador   # abre a página no Chrome/Edge sem janela e testa com PDFs
npm run fixtures         # gera de novo os PDFs de teste a partir dos HTMLs
```

O teste de navegador precisa do Chrome ou do Edge instalado (ou da variável `CHROME_PATH`) e de internet para o pdf.js. O LanguageTool e o GitHub são simulados nos testes. Os testes cobrem currículos de uma coluna, duas colunas com foto, PDF escaneado, currículo em português e currículo longo, além de API fora do ar, o que é enviado e o que fica salvo, e HTML malicioso dentro do currículo ou da resposta das APIs.

Também deixei um [roteiro para testar com pessoas](testes/ROTEIRO-PESSOAS.md), porque teste automático não diz se o conselho faz sentido para quem está lendo.

## Estrutura

```
index.html              a página
js/regras.js            todas as regras e cálculos (funções puras, testáveis no Node)
js/integracoes.js       pdf.js, LanguageTool e API do GitHub
js/avaliador.js         a interface: lê o que foi preenchido e mostra o resultado
testes/                 testes, PDFs de teste e o roteiro com pessoas
```

## Quer ajudar?

Se a ferramenta marcou como erro algo que não é, ou deixou passar um problema óbvio, abre uma issue com o trecho do currículo que causou isso (sem dados pessoais, por favor). Toda correção de regra começa com um teste novo em `testes/regras.test.js`, para o problema não voltar.
