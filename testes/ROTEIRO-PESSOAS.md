# Roteiro: testar o avaliador com pessoas reais

Os testes automáticos dizem se o código funciona. Este roteiro responde outra pergunta: **o conselho é útil e a pessoa entende o que fazer?**

## Quem chamar (5 pessoas bastam)

Varie os perfis, porque cada um quebra o avaliador de um jeito:

- 1 pessoa com currículo em português
- 1 com currículo de modelo bonito (Canva, duas colunas, foto)
- 1 júnior ou em transição de carreira
- 1 pleno ou sênior que já aplica para fora
- 1 de outra área de tech (QA, dados, design), para ver se as regras servem

Peça permissão para olhar o resultado. Não guarde o currículo de ninguém.

## Como conduzir (20 min por pessoa)

1. Mande só o link, sem explicar nada. Peça para a pessoa ir falando em voz alta o que pensa.
2. **Não ajude.** Onde ela travar é onde a página precisa melhorar. Anote.
3. Quando ela terminar, faça as perguntas abaixo.

## O que anotar enquanto ela usa

- [ ] Entendeu o que fazer sem perguntar?
- [ ] O PDF foi lido? O texto extraído saiu embaralhado?
- [ ] Achou alguma nota injusta? Qual e por quê?
- [ ] Algum item "Crítico" estava **errado** (falso positivo)? Copie a frase do currículo que o causou.
- [ ] Algum problema óbvio do currículo **não** foi apontado (falso negativo)?

## Perguntas no final

1. "Qual é a primeira coisa que você vai fazer depois disso?" Se ela não souber responder, o plano não está claro.
2. "Alguma recomendação parece genérica ou não serve para você?"
3. "Você confiaria nesse resultado para mudar seu currículo?"
4. "Teria vergonha ou receio de enviar seu currículo para um site assim?" (testa o aviso de privacidade)

## Critério para hospedar

- 4 de 5 pessoas conseguem dizer a primeira ação sem ajuda.
- Nenhum falso positivo crítico que se repita em 2 ou mais pessoas.
- Todo falso positivo encontrado vira um caso em `testes/regras.test.js` antes de corrigir a regra.
