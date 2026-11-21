# Roadmap de evolução

## Prioridades imediatas

### P0 — Próxima entrega técnica
- Revisar manualmente todos os fluxos CREATE e IMPROVE em desktop e mobile.
- Corrigir os problemas encontrados nessa validação de usabilidade.
- Adicionar testes de integração de fluxo, persistência e importação.
- Formalizar schemas de projeto, requisito, especificação e prompt.
- Exibir claramente as limitações de extração de arquivos e status de provedor em pontos de entrada.

### P1 — Fundação de produto hospedado
- Migrar núcleo de domínio para TypeScript sem duplicar regra entre frontend e backend.
- API modular (avaliar Fastify).
- Modelo de dados relacional e migrations.
- Autenticação e autorização por projeto.
- Repositório persistente, recuperação de sessão e exclusão de dados.
- Gestão server-side de credenciais e configuração de provedores.

### P1 — Inteligência real
- Adaptador inicial de LLM para descoberta e extração estruturada.
- Saídas validadas com schema, recuperação de erro e retry limitado.
- Perguntas adaptativas construídas a partir da informação já coletada.
- Análise semântica de inconsistências e proposta de resoluções, sempre sujeitas à decisão humana.
- Atualização incremental de requisitos e especificação com proveniência.

### P1 — Improvement Engine completo
- Ingestão controlada de repositórios/projetos e arquivos.
- Inventário dos arquivos realmente inspecionados e seus hashes.
- Mapeamento de componentes, módulos, dependências e funcionalidades.
- Plano de mudança com arquivos/áreas afetados, preservação, riscos e testes de regressão.
- Comparação de estado anterior e posterior.

### P2 — Contexto e referências
- Extração segura de PDF, DOCX, HTML e formatos de código adicionais.
- Extração de metadados e conteúdo de imagens sob demanda.
- Chunking, indexação e recuperação contextual apenas quando escala e qualidade justificarem.
- Proveniência por trecho, página, arquivo e versão.

### P2 — Refinamento e avaliação
- Comparação de versões de prompt e especificação com diff estruturado.
- Conjuntos de casos de teste e avaliadores definidos pelo usuário.
- Execução comparativa de prompts/modelos com métricas interpretáveis.
- Registro de resultados fornecidos pelo usuário, sem alegar conhecer execuções externas.
- Saúde do projeto e diagnóstico de completude baseado em critérios transparentes.

### P3 — Uso profissional e em equipe
- Organizações, membros e papéis Owner/Editor/Viewer.
- Compartilhamento por projeto com controle explícito.
- Comentários e aprovação colaborativa.
- Portfólio de prompts reutilizáveis e templates aprovados.
- Observabilidade, métricas de custo/latência e alertas operacionais.

## Critério de passagem entre fases

Uma fase não é considerada concluída por ter telas ou endpoints criados. É necessário demonstrar testes, estados de erro, autorização, recuperação de dados e critérios de aceitação para cada fluxo crítico.

## O que não deve ser antecipado

- Microserviços antes de haver limites de domínio/carga demonstrados.
- Vetor database antes de busca lexical/contextual simples ser insuficiente.
- Agentes autônomos com permissão irrestrita de editar projetos.
- Colaboração em tempo real antes de versionamento e autorização multiusuário.
- Score universal de qualidade de prompt sem metodologia e conjunto de validação.
