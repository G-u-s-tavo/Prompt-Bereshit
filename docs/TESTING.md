# Testes e validação

## Comandos automatizados

```bash
npm test
npm run check
```

A suíte atual usa `node:test` e cobre 18 casos: catálogo de módulos, vínculo por ID estável, fila adaptativa, detecção e resolução local de conflitos, proveniência/prioridade de requisitos, limite de análise Improve, refinamentos por tipo, instruções embutidas em anexos como conteúdo não confiável, diagnóstico local, aprovação versionada, diff textual, fallback de diff em prompt grande, migração de dados, normalização, validação de importação, merge de backups e contrato de provider.

`npm run check` usa `node --check` nos módulos centrais para validar sintaxe.

## Validação HTTP do servidor de desenvolvimento

Executar `npm run dev` e verificar:

- `GET /` retorna `index.html`.
- CSS, módulos JS e imagens respondem com conteúdo e MIME esperados.
- O servidor é vinculado a `127.0.0.1` e aceita somente GET/HEAD.
- O servidor contém uma proteção de caminho para evitar servir arquivos fora da raiz.

O servidor não representa um backend de produção.

## Roteiro manual antes de uma demonstração

1. Abrir a aplicação em notebook/desktop e em um viewport de celular.
2. Criar um projeto Create em cada um dos nove domínios.
3. Responder, pular e delegar perguntas; verificar se as respostas continuam ligadas aos títulos corretos após perguntas adicionais.
4. Construir os requisitos, editar um requisito, adicionar um requisito manual e reconstruir para verificar se ele permanece.
5. Criar um alerta de contradição, registrar a decisão e confirmar que o alerta fica marcado como resolvido.
6. Aprovar a especificação e confirmar que Prompt B é liberado.
7. Alterar um requisito e confirmar que a aprovação e Prompt B ficam inválidos até nova aprovação.
8. Salvar duas versões de prompt, comparar e restaurar uma versão ligada à especificação atual.
9. Criar Improve, preencher preservar/modificar/expandir/remover, anexar arquivos de texto e formatos não extraídos e verificar a distinção entre conteúdo lido e metadados.
10. Exportar JSON, limpar dados em um workspace de teste e importar o backup; verificar se o merge preserva os dados atuais e resolve IDs duplicados.
11. Testar navegação por teclado, foco, labels e estados de erro.
12. Avaliar contraste, zoom, leitura e movimento reduzido.

## Resultado desta execução

- Testes unitários: 18 aprovados, 0 falhas.
- Checagem de sintaxe: aprovada.
- Servidor HTTP local: inicialização e resposta de recursos principais verificadas.
- Inspeção visual automatizada headless: inconclusiva neste ambiente. Os itens do roteiro manual permanecem pendentes.
