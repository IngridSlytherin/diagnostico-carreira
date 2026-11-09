# Diagnóstico de carreira internacional

Ferramenta gratuita para devs brasileiros que querem uma **vaga remota em empresa estrangeira**. Você envia o currículo, responde algumas perguntas e recebe:

- notas para o **currículo**, a **compatibilidade com uma vaga**, o **inglês escrito** e o **GitHub**;
- um **plano de ação** com o que fazer primeiro, com passos concretos (ex.: "2 conversas por semana com nativos", "reescreva estes 3 bullets com números");
- os pontos em que **o que você acha de si não bate com o que o currículo mostra** (ex.: "você disse que mostra resultados, mas 0% dos bullets têm números").

Tudo roda no navegador. Não existe servidor, cadastro nem IA: as notas vêm de regras escritas neste repositório, explicadas abaixo.

## Como usar

1. Abra a página (GitHub Pages deste repositório, ou `index.html` direto no navegador).
2. **Currículo:** envie o PDF ou cole o texto. O texto extraído aparece na tela; ele é parecido com o que um ATS (sistema de triagem) "enxerga".
3. **Autoavaliação:** responda as perguntas sobre objetivo, currículo, projetos, inglês e entrevistas.
4. **Extras (opcionais):** cole uma vaga, ative a checagem de inglês e informe seu usuário do GitHub.
5. Clique em **Gerar meu diagnóstico**. Dá para baixar o relatório (.md) ou imprimir/salvar em PDF.

## Privacidade

| Dado | Onde fica |
|---|---|
| PDF / texto do currículo | Lido no seu navegador (pdf.js). **Nunca é salvo** nem enviado, exceto se você ativar o LanguageTool |
| Respostas da autoavaliação | Rascunho no `localStorage` do seu navegador. O botão "Apagar tudo" remove |
| Verificação de inglês (opcional) | Texto enviado à API pública do [LanguageTool](https://languagetool.org), **sem a primeira linha (provável nome), e-mails, telefones e links** |
| GitHub (opcional) | Consulta à API pública do GitHub direto do seu navegador. Lê só dados públicos |

Quem publica a página não recebe nada de quem usa.

## O que é analisado e quais soluções a ferramenta sugere

### Currículo
Pensado para o padrão americano e para ATS:

- **Formato:** texto legível (PDF não pode ser imagem), uma coluna, sem ícones, foto ou gráficos, 1–2 páginas.
- **Conteúdo:** 100% em inglês; seções padrão (Summary, Experience, Skills, Education); contato (e-mail, LinkedIn, GitHub, localização e fuso); nível de inglês declarado; datas nas experiências.
- **Bullets:** começam com verbo de ação, mostram resultado com número, sem "responsible for/worked on", sem "I/my", sem repetição, até ~32 palavras.
- **O que remover:** dados pessoais que não se usam nos EUA (idade, estado civil, CPF/RG, nacionalidade), clichês ("passionate team player"), campos de modelo esquecidos (`[Seu Nome]`).

Cada problema vem com a **ação** e, quando dá, com os **bullets que precisam ser reescritos**.

### Vaga (opcional)
- Quais tecnologias da vaga estão ou não no seu currículo (dicionário com 76 termos: linguagens, frameworks, bancos, cloud, testes, práticas).
- **Sinais de que aceita o Brasil** ("LATAM", "anywhere", contractor via Deel) ou de que **não aceita** ("authorized to work in the US", "W-2", "US only").
- Anos de experiência pedidos, exigência de inglês, faixa salarial e fuso.

### Inglês escrito (opcional, LanguageTool)
Erros de gramática, ortografia e estilo, com sugestão de correção. Termos técnicos (Laravel, NestJS, camelCase, siglas) são filtrados para não virar "erro de ortografia".

### GitHub (opcional)
Simula a visita de 2 minutos de um tech lead: bio em inglês, README de perfil, projetos próprios, atividade recente, descrição e topics nos repositórios, demo online e a qualidade dos READMEs dos 4 projetos principais (descrição, prints, como rodar, stack, demo, decisões técnicas, em inglês).

### Plano de ação
Junta tudo e prioriza. Exemplos de recomendação:

- Inglês falado "só no rotineiro" → conversar com nativos 2×/semana (apps de troca como Tandem/HelloTalk são gratuitos; tutores como italki/Cambly são pagos) levando roteiros de trabalho.
- Nunca pratica entrevista → 1 simulação gravada por semana, começando pelo "Tell me about yourself" de 1 minuto.
- Sem exemplos para entrevista → montar 6 histórias no formato STAR.
- Sem projeto para mostrar → um projeto pequeno e completo em 3–4 semanas, com README e demo.

## Como os cálculos são feitos

### Escala (igual em todas as notas)

| Nota | Nível | Leitura |
|---|---|---|
| 0–39 | Fraco | Seria descartado nesta etapa |
| 40–59 | Em desenvolvimento | Passa em poucas empresas |
| 60–74 | Competitivo | Passa na maioria das triagens |
| 75–89 | Forte | Destaque entre candidatos de fora |
| 90–100 | Excelente | Nível de quem já trabalha para os EUA |

### Nota do currículo

Cada verificação tem um **peso** e termina com um status:

- **OK** vale o peso inteiro;
- **Melhorar** vale metade do peso;
- **Crítico** vale zero.

```
nota = (soma dos pontos obtidos ÷ soma dos pesos das verificações feitas) × 100
```

Verificações que não se aplicam (ex.: "Summary objetivo" quando não há Summary) ficam fora da conta.

| Verificação | Peso | Critério |
|---|---|---|
| Em inglês | 4 | Crítico se a maior parte estiver em português; Melhorar se misto ou com títulos em português |
| Verbos de ação no início dos bullets | 3 | OK ≥ 80% · Melhorar ≥ 50% · Crítico abaixo |
| Resultados com números | 3 | OK ≥ 50% dos bullets · Melhorar ≥ 25% · Crítico abaixo (anos como "2021" não contam) |
| Bullets de experiência (mínimo 3) | 3 | Crítico se houver menos de 3 |
| Campos de modelo não preenchidos | 3 | Crítico se houver `[...]`, "PREENCHER", "lorem ipsum" |
| Seções padrão | 2 | Melhorar se faltar Summary, Skills ou Education; Crítico se faltar Experience e Projects |
| E-mail | 2 | Crítico se não houver |
| Dados pessoais | 2 | Crítico se houver idade, estado civil, CPF/RG, nacionalidade ou gênero |
| Frases fracas ("responsible for"…) | 2 | OK nenhuma · Melhorar 1–2 · Crítico 3+ |
| Bullets repetidos | 2 | Melhorar; Crítico se forem 3+ ou mais de 20% |
| Tamanho | 1,5 | Crítico com mais de 2 páginas ou menos de 150 palavras; Melhorar com menos de 250, mais de 1000, ou 2 páginas com menos de 550 palavras |
| Layout em colunas | 1,5 | Melhorar |
| LinkedIn, GitHub, localização/fuso | 1 cada | Melhorar se faltar |
| Imagens (foto), ícones | 1 cada | Melhorar |
| "I/my" nos bullets, bullets longos (> 32 palavras) | 1 cada | Melhorar |
| Clichês | 1 | OK nenhum · Melhorar 1–2 · Crítico 3+ |
| Datas nas experiências | 1 | Melhorar se faltar |
| Nível de inglês declarado | 1 | Melhorar se faltar |
| Summary com 25–100 palavras | 1 | Melhorar fora disso |
| Telefone sem +55 | 0,5 | Melhorar |

**Teto (falhas eliminatórias).** Alguns problemas fazem o recrutador descartar o currículo antes de ler o resto. Nesses casos, a nota fica limitada, não importa quão bom seja o resto:

| Falha | Nota máxima |
|---|---|
| PDF sem texto (imagem/escaneado) | 0 |
| Currículo em português · campos de modelo esquecidos | 39 |
| Currículo misto (inglês com trechos em português) · mais de 2 páginas ou menos de 150 palavras · sem e-mail · menos de 3 bullets · muitos bullets repetidos | 59 |
| Layout em duas colunas | 74 |

A tela informa quando a nota foi limitada e por quê.

### Compatibilidade com a vaga

```
compatibilidade = tecnologias da vaga que estão no currículo ÷ tecnologias da vaga reconhecidas × 100
```

Só contam os termos do dicionário que aparecem no anúncio. Se nenhum aparecer, a compatibilidade fica "não avaliada".

### Inglês escrito

```
erros por 100 palavras = (erros graves + 0,3 × erros de estilo) ÷ (máx(palavras, 150) ÷ 100)
nota = 100 − 20 × erros por 100 palavras   (limitada entre 0 e 100)
```

- **Graves:** gramática e ortografia. **Estilo:** sugestões de redação, que pesam menos.
- O mínimo de 150 palavras evita que 2 ou 3 erros num texto curto zerem a nota.
- 1 erro grave a cada 100 palavras resulta em 80; 5 ou mais resultam em 0.

### GitHub

Mesma lógica de pesos do currículo:

| Verificação | Peso | Critério |
|---|---|---|
| READMEs dos 4 projetos principais | 3 | Completude média de 7 itens: OK ≥ 75% · Melhorar ≥ 40% |
| Projetos próprios públicos | 2 | OK ≥ 4 · Melhorar 1–3 · Crítico 0 |
| README de perfil | 1,5 | Melhorar se não houver |
| Atividade recente | 1,5 | OK ≤ 30 dias · Melhorar ≤ 120 · Crítico acima |
| Demo online | 1,5 | Melhorar se nenhum projeto principal tiver |
| Bio (em inglês) | 1 | Melhorar se vazia ou em português |
| Descrição nos repositórios | 1 | OK todos · Melhorar ≥ metade · Crítico abaixo |
| Nome e localização · link de site · topics · excesso de forks | 0,5 cada | Melhorar |

"Projetos principais" são os repositórios próprios (sem forks e arquivados) com mais estrelas, desempatando pelos mais recentes.

### Autoavaliação

Cada resposta vale: sim = 100, em parte = 50, não = 0 (as perguntas de inglês têm 5 níveis: 0, 25, 50, 75, 100). A nota de cada área é a média das respostas dadas, e respostas em branco não contam. "Clareza do objetivo" é a fração dos campos preenchidos (cargo, mercado, nível).

Essas notas aparecem **separadas** ("O que você declarou") porque não são medidas, são percepção.

### Prioridade do plano

1. **Urgente** ("Comece por aqui"): falhas críticas do currículo (até 3), inglês do currículo com nota abaixo de 60, GitHub com problema crítico, vaga que pode não aceitar o Brasil, inglês falado com dificuldade ou só no rotineiro, nunca praticar entrevista, objetivo não definido, nenhum projeto para mostrar, e a divergência "diz que mostra resultados, mas os bullets não têm números".
2. **Depois:** ajustes finos do currículo, melhorias no GitHub, histórias STAR, escrita em inglês etc.

Dentro de cada prioridade, aparece primeiro o que é **divergência** (autoavaliação × evidência), depois **evidência** (medido nos materiais) e por último **autoavaliação**.

## Por que essas regras e esses pesos

- **O que mais pesa é o que mais elimina.** Currículo em inglês (peso 4) é pré-requisito para vaga nos EUA. Verbos de ação e números (peso 3) são o que mostra impacto numa leitura rápida: sem eles, o currículo vira lista de tarefas.
- **Teto porque a triagem é eliminatória, não uma média.** Um currículo impecável em português continua sendo descartado por uma empresa americana. A soma ponderada sozinha dava nota alta a currículos que um recrutador nunca leria até o fim (nos testes, um currículo de 3 páginas com bullets repetidos tirava 85).
- **"Melhorar" vale metade** porque são problemas que não eliminam sozinhos, mas que somados fazem o currículo parecer menos profissional.
- **Separar autoavaliação de evidência** porque a maior parte das pessoas se avalia diferente do que os materiais mostram. A divergência é a parte mais útil do diagnóstico.
- **Regras em vez de IA:** o resultado é igual para a mesma entrada, é explicável linha por linha e não custa nada.

**Seja crítico com os números.** Os pesos e os limites são **escolhas editoriais** baseadas em práticas comuns de recrutamento para vagas remotas nos EUA. Eles **não foram validados estatisticamente** contra resultados reais de contratação. A nota mede forma e evidências (verbos, números, seções, links), não a qualidade real da sua experiência. Use como triagem, não como veredito.

## Limitações conhecidas

- **PDFs complexos:** colunas são detectadas pelo alinhamento do texto. Layouts incomuns (caixas de texto soltas, tabelas) podem não ser detectados.
- **Marcadores (•):** muitos editores desenham os marcadores como gráfico. Quando não há marcadores, a ferramenta analisa as frases das seções Experience e Projects.
- **LanguageTool não avalia naturalidade:** um texto sem erros ainda pode soar traduzido.
- **GitHub sem login:** 60 consultas por hora por rede (cada análise usa cerca de 7). Projetos fixados (Pinned) e repositórios privados não aparecem.
- **Vaga:** o dicionário cobre 76 tecnologias e práticas comuns. Termos fora dele não entram na compatibilidade.

## Rodar localmente

Não precisa instalar nada: abra `index.html` no navegador (Chrome ou Edge). É preciso internet para carregar o pdf.js (CDN) e usar as verificações online.

### Testes

Requer [Node.js](https://nodejs.org) 18+.

```bash
npm test                 # tudo (regras + navegador)
npm run test:regras      # só as regras, rápido, sem navegador
npm run test:navegador   # página real no Chrome/Edge headless com PDFs de teste
npm run fixtures         # gera de novo os PDFs de testes/fixtures a partir dos HTMLs
```

- O teste de navegador precisa de Chrome ou Edge instalado (ou `CHROME_PATH`) e de internet (pdf.js).
- LanguageTool e GitHub são **simulados** nos testes, sem chamadas reais.
- Os testes cobrem: PDFs de uma coluna, duas colunas com foto, PDF imagem, currículo em português e currículo longo; APIs fora do ar; privacidade (o que vai para o LanguageTool e o que fica salvo); e segurança (HTML malicioso no currículo, no LanguageTool e no GitHub não é executado).

Para testar com pessoas reais, veja [testes/ROTEIRO-PESSOAS.md](testes/ROTEIRO-PESSOAS.md).

## Publicar no GitHub Pages

1. Envie este repositório para o GitHub (público).
2. Em **Settings → Pages**, escolha **Deploy from a branch**, branch `main`, pasta `/ (root)`.
3. Em alguns minutos, a página fica em `https://<seu-usuario>.github.io/<nome-do-repositorio>/`.

## Estrutura

```
index.html              página (HTML + CSS)
js/regras.js            todas as regras e cálculos (funções puras, testáveis no Node)
js/integracoes.js       pdf.js, LanguageTool e GitHub API
js/avaliador.js         interface: lê entradas, chama as regras e mostra o resultado
testes/                 testes automáticos, PDFs de teste e roteiro de teste com pessoas
```

## Contribuir

Achou um falso positivo (algo marcado como erro que não é) ou um problema que a ferramenta não viu? Abra uma issue com o trecho do currículo (anonimizado) que causou o problema. Toda correção de regra começa com um caso novo em `testes/regras.test.js`.
