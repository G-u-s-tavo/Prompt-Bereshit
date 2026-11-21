# Pesquisa de referências de produto

Pesquisa documental feita em 20 de novembro de 2026, priorizando documentação e páginas oficiais de plataformas de engenharia de prompts.

## Padrões estabelecidos no mercado

- **Prompt registries e versionamento:** Langfuse descreve gerenciamento centralizado, versões imutáveis, labels para ambientes, comparação de mudanças e rollback. A documentação também relaciona prompts a traces para observar métricas por versão. Referências: [Langfuse Prompt Management](https://langfuse.com/docs/prompt-management/overview), [Prompt Version Control](https://langfuse.com/docs/prompt-management/features/prompt-version-control) e [Link Prompts to Traces](https://langfuse.com/docs/prompt-management/features/link-to-traces).
- **Gestão, colaboração e avaliação:** PromptLayer apresenta registro de prompts, versões, edição visual, testes automatizados, A/B testing e métricas de uso/custo/latência. Referência: [PromptLayer Prompt Management](https://www.promptlayer.com/prompt-management/).
- **Avaliação por datasets e versões:** a documentação do Humanloop descreve comparação de versões de prompt usando datasets e evaluators, com logs associados às execuções. Referências: [Humanloop Prompts](https://humanloop.com/docs/v5/explanation/prompts) e [Run an Evaluation via the UI](https://humanloop.com/docs/guides/evals/run-evaluation-ui).

## Implicação estratégica para Prompt-Bereshit

Versionamento, registry, comparação e avaliação já são capacidades conhecidas em ferramentas de prompt management. Portanto, não devem ser tratadas isoladamente como diferenciação suficiente.

O território recomendado para Bereshit é anterior e adjacente à gestão de prompts:

1. Descoberta de intenção antes da escrita do prompt.
2. Transformação de intenção em requisitos rastreáveis e critérios de aceitação.
3. Proveniência explícita entre resposta do usuário, referência, inferência e recomendação.
4. Análise de mudança em projetos existentes, com preservação e escopo autorizado.
5. Relação verificável entre especificação aprovada, prompt, mudança executada e resultado avaliado.
6. Experiência de descoberta que ajude iniciantes sem reduzir o nível de controle profissional.

## Oportunidade de evolução

No futuro, ligar o ciclo do Bereshit a conjuntos de teste e feedback de execução. A pessoa poderia registrar exemplos de resultado esperado e observado, comparar versões do prompt e identificar quais requisitos não foram atendidos. Métricas de custo, latência e traces devem ser incluídas apenas quando existir execução real via provider e uma política clara de dados.

## Decisão

Não replicar um prompt registry/observability stack completo nesta etapa. Priorizar Discovery, Requirements, Specification, Improvement, Context e Change Intelligence. Avaliação de resultados será uma camada subsequente, com metodologia transparente e conjuntos de casos de teste definidos por projeto.
