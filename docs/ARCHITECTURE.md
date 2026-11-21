# Arquitetura

## Arquitetura implementada: local-first

```text
Browser
  ├─ UI / app.js
  ├─ Domain modules / modules.js
  ├─ Discovery + requirements + prompt compiler / generator.js
  ├─ Specification lifecycle / core/specification.js
  ├─ Workspace migration + validation / core/persistence.js
  ├─ Provider contract / providers/contract.js
  └─ localStorage

Static development server (optional)
  └─ Serves files only; no API, auth, provider calls or database
```

### Fronteiras atuais

- `app.js` controla navegação, formulários, eventos e projeção de dados na UI.
- `generator.js` contém regras de domínio para entrevistas, requisitos, diagnóstico e prompts.
- `modules.js` declara módulos e conteúdo especializado.
- `specification.js` mantém versão, snapshots, aprovação e comparação.
- `persistence.js` normaliza dados, migra workspace legado e valida importações.
- `providers/contract.js` descreve operações esperadas de adaptadores futuros e informa que não há provedor ativo.

## Arquitetura-alvo recomendada

```text
Web Client
   │
   ▼
Backend API (TypeScript + Fastify, a validar na Phase 01)
   ├─ AuthN / AuthZ / Project policy
   ├─ Project & Specification service
   ├─ Discovery orchestration
   ├─ Improvement analysis orchestration
   ├─ Context selection & retrieval
   ├─ Prompt compilation / diagnostics
   ├─ File ingestion pipeline
   ├─ Provider registry & adapters
   ├─ Audit / observability
   └─ Persistence repositories
          │
          ├─ PostgreSQL (Supabase como opção, sujeita à avaliação)
          ├─ Object storage
          └─ Provider APIs (server-side only)
```

## Princípios arquiteturais

1. **A especificação é fonte de verdade.** Prompt é uma representação de execução, não substituto da especificação aprovada.
2. **Create e Improve partilham núcleo.** Discovery, Context, Requirements, Specification, Approval e Prompt Generation devem ser serviços compartilhados, com estratégias por workflow.
3. **Proveniência sempre que possível.** Requisitos e recomendações devem guardar fonte/origem; interpretação de IA deve continuar distinta de evidência original.
4. **Provider-neutral, sem abstração prematura.** Começar com interface mínima baseada nas operações reais: `discover`, `extractRequirements`, `analyzeProject`, `draftSpecification`, `generatePrompt`, `refinePrompt`, `summarizeContext`.
5. **Credenciais no servidor.** Chaves de API nunca devem ser entregues ao navegador ou persistidas no workspace.
6. **Context selection, não despejo integral.** Recuperar apenas contexto relevante para a operação, respeitando proveniência e estado de aprovação.
7. **Mudanças explícitas e aprovadas.** Alterações materiais em requisitos invalidam a aprovação associada à versão anterior.
8. **Monólito modular primeiro.** Não há justificativa atual para microserviços, filas ou banco vetorial até que requisitos e gargalos reais os sustentem.

## Contrato de provedor

O módulo atual é somente um contrato em JavaScript para validar operações de um adaptador. A próxima implementação deve definir um tipo compartilhado, schema das entradas/saídas, erros normalizados, timeout, retry seletivo, limites por usuário, custo quando informado e política de dados. Adaptadores concretos devem viver exclusivamente no backend.

## Modelo lógico inicial

Entidades candidatas para uma versão persistente:

- `users`, `organizations`, `memberships`
- `projects`, `project_members`, `project_settings`
- `discovery_sessions`, `discovery_questions`, `discovery_answers`
- `requirements`, `requirement_dependencies`, `requirement_sources`
- `specifications`, `specification_versions`, `approvals`
- `context_items`, `references`, `assets`, `extraction_jobs`
- `prompts`, `prompt_versions`, `prompt_refinements`
- `improvement_analyses`, `change_plans`, `change_impacts`
- `provider_configs`, `usage_records`, `activity_events`

O esquema definitivo deve ser criado por migrations, com chaves estrangeiras, constraints, índices e políticas de acesso por projeto. Não persistir o conteúdo integral de prompts em logs de telemetria por padrão.
