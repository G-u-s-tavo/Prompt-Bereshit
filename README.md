# Prompt-Bereshit

**Ideias ganham estrutura.** Prompt-Bereshit é um espaço de trabalho para transformar ideias ou projetos existentes em especificações revisáveis e prompts executáveis. Esta versão aprofunda o fluxo local de descoberta, introduz o caminho **Improve** e estabelece uma fundação modular para futuras integrações com provedores de IA.

> **Estado desta entrega:** fundação local-first funcional. Não é ainda um serviço de produção multiusuário nem possui conexão com um LLM ao vivo.

## Começar

Requisitos: Node.js 20+ para usar os scripts incluídos. Também é possível servir os arquivos com Python 3.

```bash
npm run dev
```

Abra `http://127.0.0.1:4173`.

Alternativa:

```bash
python -m http.server 8000
```

Abra `http://localhost:8000`.

Não é necessário `npm install`: o frontend utiliza módulos JavaScript nativos e não possui dependências npm de runtime.

## Dois fluxos de trabalho

### Create

Ideia → descoberta → perguntas de domínio → requisitos → alertas de contradição → revisão → aprovação → Prompt B.

O Prompt A é o roteiro autossuficiente para continuar a descoberta em qualquer LLM. O Prompt B é liberado somente quando a versão atual da especificação foi aprovada.

### Improve

Projeto existente → estado atual → preservação → áreas de intervenção → análise baseada no material fornecido → lacunas e riscos → escopo → requisitos → aprovação → prompt de melhoria.

O escopo separa **preservar, modificar, expandir e remover**. O projeto não autoriza remoções que não tenham sido expressamente indicadas. O diagnóstico local não afirma ter inspecionado arquivos ou executado código que não foi fornecido.

## Capacidades disponíveis

- Nove módulos: Desenvolvimento Web, UI/UX Design, Identidade de Marca, Design Gráfico, Programação, Pesquisa, Documentação, Análise de Dados e Escrita Criativa.
- Descoberta com profundidade breve, padrão ou abrangente, perguntas de domínio e perguntas adicionais condicionais.
- Respostas ligadas a IDs estáveis de perguntas, evitando associação por posição quando a fila adaptativa muda.
- Requisitos identificáveis com classificação, prioridade, origem, dependências e critérios de aceitação.
- Prioridades: crítico, alto, médio e baixo. A aplicação migra os antigos P0–P3 para esse modelo.
- Detecção local de contradições por regras explícitas, registro de decisões e alertas que permanecem visíveis.
- Especificação versionada. Mudanças materiais invalidam a aprovação anterior e removem o Prompt B vigente até nova aprovação.
- Contexto de projeto com notas, proveniência e opção de fixar informações importantes.
- Refinamentos separados por Prompt A e Prompt B, histórico e comparação de versões. Comparações muito grandes usam resumo limitado para evitar alocação quadrática excessiva.
- Diagnóstico heurístico local de prompts. Os avisos são recomendações, não uma pontuação universal nem garantia semântica.
- Importação/exportação JSON validada, com limite de tamanho e merge que preserva projetos atuais.
- Sete imagens de referência visuais mantidas no pacote.
- Layout responsivo com navegação móvel em faixas roláveis.
- Contrato de operações para futuros adaptadores de IA, sem credenciais ou provedores simulados no frontend.

## Limites conhecidos

- Não há chamadas reais a OpenAI, Anthropic, Google ou outro provedor. A geração de prompts, o diagnóstico e a detecção de contradições atuais são locais.
- A descoberta utiliza um roteiro adaptativo baseado em regras, não uma entrevista conversacional produzida ao vivo por LLM.
- A análise Improve trabalha apenas com a descrição e o texto efetivamente extraído dos materiais fornecidos.
- Arquivos `.txt`, `.md`, `.html`, código e formatos textuais listados na interface podem ser extraídos localmente até 150 KB por arquivo e 700 KB combinados. São aceitos até 20 arquivos por projeto, com limite de 12 MB por arquivo. PDF, DOCX, imagens e ZIP são registrados como metadados, mas ainda não são extraídos nem analisados.
- Projetos ficam no `localStorage` do navegador atual. Não há conta, sincronização, backup automático, criptografia própria, banco remoto ou colaboração.
- `server/dev-server.mjs` é somente um servidor estático de desenvolvimento, vinculado a `127.0.0.1`. Não é API nem backend de produção.
- A aplicação usa Google Fonts quando há conexão. Em modo offline, entram as famílias alternativas definidas no CSS.
- Não foi concluída uma inspeção visual automatizada em navegador nesta execução. Consulte o roteiro de verificação manual em `docs/TESTING.md`.

## Estrutura do projeto

```text
index.html
assets/
  css/main.css
  js/
    app.js
    modules.js
    generator.js
    core/
      persistence.js
      specification.js
    providers/
      contract.js
  references/*.jpg
server/
  dev-server.mjs
tests/
  core.test.js
docs/
  AUDIT.md
  ARCHITECTURE.md
  DECISIONS.md
  ROADMAP.md
  SECURITY-PRIVACY.md
  TESTING.md
```

### Responsabilidades dos módulos

- `app.js`: navegação, renderização, ações, formulários, estado e coordenação da interface.
- `modules.js`: módulos de domínio, perguntas, paleta e metadados visuais.
- `generator.js`: entrevistas, perguntas condicionais, análise Improve, detecção local de conflitos, requisitos, diagnóstico e compilação dos prompts.
- `core/persistence.js`: normalização, migração, validação e merge do workspace.
- `core/specification.js`: snapshots, aprovação, invalidação e comparação de versões.
- `providers/contract.js`: contrato para futuros adaptadores; não é um adaptador ativo.
- `tests/core.test.js`: testes unitários para invariantes principais.

## Verificação

```bash
npm test
npm run check
```

Os testes usam o `node:test` nativo. Não há dependências externas instaladas.

## Direção de produto e visual

A interface mantém a base editorial e delicada das referências, sem adotar um padrão corporativo genérico nem um scrapbook decorativo. Paleta principal: Cloud `#F4EFE6`, Peony `#F7DDD5`, Dusty Rose `#D8A4AF`, Sky `#AFB8CD`, Lavender `#CCC3D1`, Cacao `#6B403B`, Jungle `#65613F`, Grass `#8D8B4C` e Leaf `#C1BC77`.

Fontes web: DM Serif Display, DM Sans, Ballet e Luckiest Guy. As imagens tipográficas fornecidas eram espécimes de referência, não arquivos de fontes instaláveis; portanto, as fontes escolhidas são uma implementação web de direção semelhante, não uma reprodução declarada de Minya, Jerencia ou Fairy Garden.

## Documentação de evolução

- `docs/AUDIT.md`: estado observado, problemas corrigidos e limitações.
- `docs/ARCHITECTURE.md`: arquitetura implementada e arquitetura-alvo.
- `docs/DECISIONS.md`: decisões técnicas e trade-offs.
- `docs/ROADMAP.md`: fases e prioridades de evolução.
- `docs/SECURITY-PRIVACY.md`: privacidade, limites atuais e controles exigidos para produção.
- `docs/PRODUCT-RESEARCH.md`: padrões observados em plataformas de referência e posicionamento recomendado.
- `docs/TESTING.md`: testes automatizados e roteiro manual.
