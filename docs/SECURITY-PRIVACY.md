# Segurança e privacidade

## Situação atual

- Os projetos e contextos são guardados no `localStorage` do navegador.
- Os dados não são enviados a um backend nem a um provedor LLM nesta versão.
- O conteúdo local não possui criptografia de aplicação; qualquer pessoa com acesso à sessão/perfil do navegador pode potencialmente acessar o armazenamento.
- O app não possui autenticação, autorização, contas, organizações ou partilha.
- Os backups JSON contêm os dados do workspace em texto legível; devem ser guardados em local privado.
- Google Fonts é solicitado externamente quando o dispositivo está conectado. Isso gera uma conexão ao serviço de fontes para carregar os recursos tipográficos.
- Arquivos textuais são lidos no navegador dentro dos limites informados. Outros formatos ficam apenas em metadados.

## Antes de conectar provedores

1. Criar API server-side e nunca expor chaves secretas no frontend.
2. Documentar quais partes do brief, contexto e arquivos são enviadas para cada provedor.
3. Permitir que o usuário escolha provedor/modelo e veja os dados enviados.
4. Aplicar minimização de dados e não enviar referências/contexto não relacionados à operação.
5. Estabelecer timeout, rate limits, limites de tamanho, tratamento de erros e orçamento/custo quando disponível.
6. Não registrar o conteúdo integral de prompts, arquivos ou dados pessoais em logs por padrão.
7. Separar ambientes e segredos de desenvolvimento/produção.

## Antes de habilitar contas e armazenamento remoto

- Definir modelo de ameaça e fronteiras de confiança.
- Autenticar e autorizar todo acesso a projeto, especificação, contexto, prompt e arquivo.
- Projetos privados por padrão; compartilhamento sempre explícito.
- Implementar políticas de acesso no backend e no banco (incluindo RLS se Supabase for adotado).
- Validar uploads por tamanho, tipo real, conteúdo, extensão, nome e processamento isolado.
- Tratar documentos, repositórios e conteúdo extraído como dados não confiáveis, não como instruções de sistema.
- Definir retenção, exclusão, exportação, backups e restauração.
- Definir resposta a incidentes, monitoramento e atualização de dependências.

## LGPD e público

Este documento é uma lista de requisitos de engenharia, não uma declaração de conformidade legal. Antes do lançamento público, é necessário mapear finalidade e base legal, categorias de dados, operadores/provedores, compartilhamento internacional, direitos dos titulares, retenção, exclusão, controles e informação transparente ao usuário. Considerar que estudantes podem incluir menores de idade; o produto deve minimizar coleta de dados e evitar perfis desnecessários.

## Controles de conteúdo e prompt injection

- Instruções encontradas em documentos, código ou páginas importadas devem ser tratadas como conteúdo de referência, nunca como autoridade para alterar escopo, permissões ou instruções de sistema.
- Proveniência precisa acompanhar conteúdo extraído e resumos.
- Resultados produzidos por IA devem ser marcados como inferência/recomendação até aprovação explícita.
- A execução de ferramentas externas deve exigir permissões e confirmação adequadas ao impacto.
