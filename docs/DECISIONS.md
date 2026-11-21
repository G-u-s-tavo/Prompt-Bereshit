# Registro de decisões técnicas

| ID | Decisão | Motivo e trade-off | Estado |
|---|---|---|---|
| ADR-001 | Manter frontend local-first nesta etapa | Permite validar Create/Improve e integridade sem exigir infraestrutura ou chaves; limita colaboração, sincronização e IA ao vivo | Adotada |
| ADR-002 | JavaScript nativo e sem dependências npm de runtime | Mantém protótipo simples e portátil; TypeScript fica para a fundação backend/contratos quando essa fase começar | Adotada para o frontend atual |
| ADR-003 | Usar IDs estáveis para perguntas e respostas | Evita que fila adaptativa associe respostas por posição incorreta | Adotada |
| ADR-004 | Aprovação é vinculada a `specVersion` | Uma especificação alterada não deve continuar liberando Prompt B como se nada tivesse mudado | Adotada |
| ADR-005 | Diferenciar prompt version do specification version | Refinar redação do prompt não altera automaticamente o requisito aprovado; mudanças de escopo precisam retornar à especificação | Adotada |
| ADR-006 | Módulo de provider define contrato, não simula IA | Evita alegar integração inexistente e deixa a fronteira explícita | Adotada |
| ADR-007 | Improve separa preservar/modificar/expandir/remover | Uma tarefa de melhoria não autoriza rewrite ou remoção por inferência | Adotada |
| ADR-008 | Arquivos sem extração são listados como metadados, nunca como inspecionados | Mantém honestidade sobre a base de evidência | Adotada |
| ADR-009 | Importação JSON tem limite e normalização | Reduz risco de payloads grandes ou dados incompatíveis; não substitui validação de backend | Adotada |
| ADR-010 | Diff LCS tem limite de células | Evita alocação de memória quadrática em prompts longos; acima do limite há resumo de trechos alterados | Adotada |
| ADR-011 | Prioridades passam de P0–P3 para crítico/alto/médio/baixo | Segue a diretriz atual e reduz inflação: objetivo e entregável são altos por padrão; preservação e restrições podem ser críticas | Adotada |
| ADR-012 | Postergar auth, Supabase, storage remoto e equipes | Essas peças exigem modelo de dados, controle de acesso, segurança e políticas de privacidade definidos antes de expor dados de usuários | Planejada |

## Decisões que ainda precisam de avaliação

- Fastify versus outra opção de API Node/TypeScript.
- Supabase como stack de PostgreSQL, Auth e Storage, versus serviços separados.
- Provedores iniciais e política de seleção/fallback por operação.
- Quais formatos de arquivo exigem extração no MVP de produção.
- Retenção, exclusão, backup e consentimento para dados enviados a provedores.
- Necessidade e valor de organizações/equipes na primeira versão hospedada.
