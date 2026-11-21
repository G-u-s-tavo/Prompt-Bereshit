import { MODULES, CORE_QUESTIONS, PALETTE, REFERENCES } from './modules.js';
import { getModule, getAnswer, getInterviewQueue, scanContradictions, buildRequirements, buildImprovementAnalysis, diagnosePrompt, buildDiscoveryPrompt, buildExecutionPrompt } from './generator.js';
import { WORKSPACE_KEY as KEY, LEGACY_WORKSPACE_KEYS, normalizeWorkspace, normalizeProject, validateImportPayload, mergeWorkspaces, MAX_IMPORT_BYTES } from './core/persistence.js';
import { invalidateSpecification, approveSpecification, isSpecificationApproved, buildTextDiff } from './core/specification.js';
import { providerStatus } from './providers/contract.js';
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
const esc = (v='') => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtDate = (d) => { const date=new Date(d); return Number.isNaN(date.getTime())?'data indisponível':new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short'}).format(date); };
const uuid = () => (crypto?.randomUUID?.() || `pb-${Date.now()}-${Math.random().toString(16).slice(2)}`);

function loadState() {
  try {
    let raw = localStorage.getItem(KEY);
    let migrated = false;
    if (!raw) {
      for (const legacyKey of LEGACY_WORKSPACE_KEYS) {
        raw = localStorage.getItem(legacyKey);
        if (raw) { migrated = true; break; }
      }
    }
    if (raw) {
      const normalized = normalizeWorkspace(JSON.parse(raw), getInterviewQueue);
      if (migrated || normalized.schemaVersion !== 2) localStorage.setItem(KEY, JSON.stringify(normalized));
      return normalized;
    }
  } catch (error) { console.warn('Falha ao carregar o espaço local:', error); }
  return { schemaVersion:2, projects: [], activeProjectId: null, globalNotes: [] };
}
let state = loadState();
let page = 'dashboard';
let interviewIndex = 0;
let promptTab = 'discovery';
let moduleFilter = 'all';
let moduleSearch = '';
let flashTimer = null;
let comparisonHistoryId = null;

function persist() {
  try { state.schemaVersion = 2; localStorage.setItem(KEY, JSON.stringify(state)); return true; }
  catch (error) { showToast('Não foi possível salvar. Exporte um backup e reduza arquivos anexados para liberar espaço.'); console.error(error); return false; }
}
function activeProject() { return state.projects.find(p => p.id === state.activeProjectId) || null; }
function touch(project) { project.updatedAt = new Date().toISOString(); persist(); }
function approved(p) { return isSpecificationApproved(p); }
function changeSpecification(p, reason) { invalidateSpecification(p, reason); p.prompts.discovery = buildDiscoveryPrompt(p); p.promptSpecVersions ||= {}; p.promptSpecVersions.discovery = p.specVersion || 1; }
function rebuildRequirementsPreservingUserItems(project) { const previous=project.requirements||[]; const generated=buildRequirements(project); const priorById=new Map(previous.map(item=>[item.id,item])); const merged=generated.map(item=>{const prior=priorById.get(item.id); if(!prior)return item; return {...item,priority:prior.priority||item.priority,classification:prior.classification||item.classification,criteria:prior.criteria||item.criteria,dependencies:prior.dependencies?.length?prior.dependencies:item.dependencies};}); const manual=previous.filter(item=>item.source?.kind==='user-added'&&!merged.some(item2=>item2.id===item.id)); project.requirements=[...merged,...manual]; }
function statusLabel(p) { return approved(p) ? 'Especificação aprovada' : p.requirements?.length ? (p.approved ? 'Aprovação desatualizada' : 'Em revisão') : 'Descoberta'; }
function setPage(next) { page = next; render(); window.scrollTo({top:0,behavior:'smooth'}); }
function showToast(message) {
  const el = $('#toast'); if (!el) return;
  el.textContent = message; el.classList.add('visible');
  clearTimeout(flashTimer); flashTimer = setTimeout(()=>el.classList.remove('visible'),2600);
}
function moduleLabel(id) { return getModule(id).name; }

function navItem(id, label, icon, active) {
  return `<button class="nav-link ${active===id?'active':''}" data-page="${id}" ${active===id?'aria-current="page"':''}><span class="nav-icon" aria-hidden="true">${icon}</span><span>${label}</span></button>`;
}
function renderShell() {
  const p = activeProject();
  $('#app').innerHTML = `
    <aside class="sidebar">
      <a href="#" class="brand-lockup" data-page="dashboard" aria-label="Prompt-Bereshit home">
        <span class="brand-mark"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 4 28 17 41 12 31 23 43 31 29 30 24 44 19 30 5 34 16 23 7 13 20 17Z"/><circle cx="24" cy="24" r="5"/></svg></span>
        <span class="brand-name">prompt<span>bereshit</span><small>ENGENHARIA DE PROMPTS</small></span>
      </a>
      <div class="side-section-label">ESPAÇO DE TRABALHO</div>
      <nav class="main-nav" aria-label="Navegação principal">
        ${navItem('dashboard','Visão geral','⌂',page)}
        ${navItem('new','Criar projeto','＋',page)}
        ${navItem('improve','Melhorar existente','↗',page)}
        ${navItem('modules','Biblioteca de módulos','▦',page)}
        ${navItem('references','Biblioteca visual','✳',page)}
      </nav>
      <div class="side-section-label project-nav-label">FERRAMENTAS DO PROJETO</div>
      <nav class="main-nav">
        ${navItem('requirements','Requisitos','☷',page)}
        ${navItem('studio','Estúdio de prompts','✎',page)}
        ${navItem('context','Biblioteca de contexto','◫',page)}
      </nav>
      <div class="sidebar-bottom">
        <div class="local-status"><span class="status-dot"></span><div><strong>Espaço local</strong><small>Salvo neste navegador</small></div></div>
        <button class="nav-link settings-link ${page==='settings'?'active':''}" data-page="settings"><span class="nav-icon">⚙</span><span>Configurações e backup</span></button>
        <div class="sidebar-foot">BERESHIT · CRIAÇÃO COMEÇA COM CLAREZA</div>
      </div>
    </aside>
    <main class="main-area">
      <header class="topbar">
        <div class="breadcrumbs"><span>Espaço de trabalho</span><span class="crumb-slash">/</span><strong>${esc(pageTitle())}</strong></div>
        <div class="topbar-actions">
          ${p ? `<span class="active-project-pill"><span class="tiny-dot"></span>${esc(p.brief.title || 'Projeto sem título')}</span>` : ''}
          <button class="quiet-button compact" data-page="new">＋ <span>Novo projeto</span></button>
          <span class="avatar-mark">PB</span>
        </div>
      </header>
      <div id="view" class="view-container">${renderPage()}</div>
      <footer class="app-footer"><span>Prompt-Bereshit</span><span>Ideias ganham estrutura.</span><span>LOCAL-FIRST · 02.0</span></footer>
    </main>
    <div id="toast" class="toast" role="status" aria-live="polite"></div>
    <input type="file" id="import-file" accept="application/json,.json" hidden>
  `;
  bindEvents();
}
function pageTitle() {
  return ({dashboard:'Visão geral',new:'Criar projeto',improve:'Melhorar projeto existente',interview:'Entrevista de descoberta',requirements:'Especificação',studio:'Estúdio de prompts',context:'Biblioteca de contexto',modules:'Biblioteca de módulos',references:'Biblioteca visual',settings:'Configurações e backup'})[page] || 'Espaço de trabalho';
}
function render() { renderShell(); }

function projectCard(p) {
  const mod = getModule(p.moduleId);
  return `<article class="project-card">
    <div class="project-card-top"><span class="project-icon">${mod.icon}</span><span class="status-chip ${approved(p)?'approved':''}">${statusLabel(p)}</span></div>
    <button class="project-title-button" data-action="open-project" data-id="${esc(p.id)}">${esc(p.brief.title || 'Projeto sem título')}</button>
    <p>${esc((p.brief.idea || 'Nenhum resumo adicionado ainda.').slice(0,125))}${(p.brief.idea||'').length>125?'…':''}</p>
    <div class="project-card-meta"><span>${esc(mod.short)}</span><span>${fmtDate(p.updatedAt)}</span></div>
    <div class="project-card-bottom"><button class="text-link" data-action="open-project" data-id="${esc(p.id)}">Abrir projeto <span>↗</span></button><button class="icon-button small" title="Excluir projeto" data-action="delete-project" data-id="${esc(p.id)}">×</button></div>
  </article>`;
}
function renderDashboard() {
  const projects = [...state.projects].sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt));
  const complete = projects.filter((p)=>approved(p)).length;
  const inProgress = projects.length-complete;
  return `
    <section class="welcome-row">
      <div><div class="eyebrow"><span class="eyebrow-star">✳</span> UM ESPAÇO PARA PENSAR COM CLAREZA</div><h1>Todo bom prompt<br>começa <em>em algum lugar.</em></h1><p class="welcome-copy">Transforme a primeira faísca de uma ideia em um briefing cuidadoso, uma especificação clara e um prompt pronto para uso.</p><div class="welcome-actions"><button class="primary-button" data-page="new">Criar do zero <span>↗</span></button><button class="quiet-button" data-page="improve">Melhorar projeto existente</button></div></div>
      <div class="welcome-art" aria-hidden="true"><div class="art-orbit orbit-one"></div><div class="art-orbit orbit-two"></div><div class="art-sun">✳</div><div class="art-note note-one">ideia</div><div class="art-note note-two">estrutura</div><div class="art-note note-three">prompt</div><span class="art-script">comece aqui</span></div>
    </section>
    <section class="stats-row">
      <div class="stat-item"><span class="stat-label">PROJETOS</span><strong>${projects.length.toString().padStart(2,'0')}</strong><small>No seu espaço de trabalho</small></div>
      <div class="stat-item"><span class="stat-label">EM DESCOBERTA</span><strong>${inProgress.toString().padStart(2,'0')}</strong><small>Em desenvolvimento</small></div>
      <div class="stat-item"><span class="stat-label">ESPECIFICAÇÕES APROVADAS</span><strong>${complete.toString().padStart(2,'0')}</strong><small>Prontas para execução</small></div>
      <div class="stat-note"><span class="tiny-star">✳</span><p>Um bom prompt não depende de dizer mais. Depende de deixar o que importa bem definido.</p></div>
    </section>
    <section class="section-block"><div class="section-heading"><div><div class="eyebrow">SUA ÁREA DE TRABALHO</div><h2>Projetos recentes</h2></div><button class="text-link" data-page="new">Criar projeto <span>↗</span></button></div>
      ${projects.length ? `<div class="project-grid">${projects.slice(0,6).map(projectCard).join('')}</div>` : `<div class="empty-state"><div class="empty-illustration">✳</div><h3>Sua primeira ideia começa aqui.</h3><p>Crie um projeto para começar a reunir contexto, requisitos e decisões.</p><button class="primary-button" data-page="new">Criar meu primeiro projeto <span>↗</span></button></div>`}
    </section>
    <section class="section-block"><div class="section-heading"><div><div class="eyebrow">DOIS CAMINHOS DE TRABALHO</div><h2>Comece pelo que você tem.</h2><p class="section-subtitle">Crie uma solução nova ou planeje a evolução de algo que já existe.</p></div></div><div class="workflow-choice-grid"><button class="workflow-choice" data-page="new"><span class="workflow-choice-index">01 / CREATE</span><strong>Criar a partir de uma ideia</strong><small>Descoberta · Requisitos · Especificação · Execução</small><span class="workflow-choice-arrow">↗</span></button><button class="workflow-choice improve-choice" data-page="improve"><span class="workflow-choice-index">02 / IMPROVE</span><strong>Evoluir um projeto existente</strong><small>Auditoria · Preservação · Impacto · Plano de mudança</small><span class="workflow-choice-arrow">↗</span></button></div></section>
    <section class="section-block module-preview-block"><div class="section-heading"><div><div class="eyebrow">PENSAMENTO ESPECIALIZADO</div><h2>Escolha um ponto de partida</h2><p class="section-subtitle">Uma perspectiva de descoberta diferente para cada tipo de trabalho.</p></div><button class="text-link" data-page="modules">Todos os módulos <span>↗</span></button></div><div class="module-preview-grid">${MODULES.slice(0,4).map(m=>`<button class="module-mini" data-action="new-with-module" data-module="${m.id}"><span class="mini-icon">${m.icon}</span><strong>${m.name}</strong><small>${m.category}</small><span class="mini-arrow">↗</span></button>`).join('')}</div></section>
    <section class="quote-strip"><span class="quote-flower">✳</span><p>“Bereshit” — toda criação começa quando uma ideia ganha forma.</p><span class="quote-source">UM NOME PARA O PROCESSO</span></section>
  `;
}

function renderNew() {
  const values = window.newDraft || {};
  return `
    <section class="page-intro"><div class="eyebrow"><span class="eyebrow-star">01 / DESCOBERTA</span></div><h1>Dê à ideia<br><em>um lugar para começar.</em></h1><p>Comece pelo que você já sabe. Pode estar incompleto, desorganizado ou ainda tomando forma. A descoberta ajudará a estruturar tudo.</p></section>
    <div class="form-layout">
      <form id="new-project-form" class="form-panel">
        <div class="form-panel-head"><div><span class="step-count">01</span><h2>A semente do projeto</h2><p>Conte o que você está tentando criar.</p></div><span class="required-note">* Obrigatório</span></div>
        <div class="field"><label for="project-title">Título provisório <span>*</span></label><input id="project-title" name="title" required maxlength="90" placeholder="Ex.: uma plataforma pessoal de conhecimento" value="${esc(values.title||'')}"/><small>Um nome temporário funciona perfeitamente.</small></div>
        <div class="field-row"><div class="field"><label for="project-module">Domínio principal <span>*</span></label><select id="project-module" name="moduleId" required>${MODULES.map(m=>`<option value="${m.id}" ${values.moduleId===m.id?'selected':''}>${m.name}</option>`).join('')}</select></div><div class="field"><label for="project-deliverable">Entregável esperado</label><select id="project-deliverable" name="deliverable"><option value="">Ainda não definido</option>${['Um site ou aplicação completos','Um protótipo de alta fidelidade','Um sistema visual ou brand book','Uma implementação de software','Um relatório de pesquisa','Um documento estruturado','Uma análise de dados','Um texto criativo','Um prompt ou fluxo reutilizável','Outro / deixe o modelo recomendar'].map(v=>`<option ${values.deliverable===v?'selected':''}>${v}</option>`).join('')}</select></div></div>
        <div class="field"><label for="project-depth">Profundidade da descoberta</label><select id="project-depth" name="depth"><option value="brief">Breve · somente o essencial</option><option value="standard" selected>Padrão · recomendada</option><option value="comprehensive">Abrangente · maior detalhamento</option></select><small>A profundidade ajusta a quantidade de perguntas, não a importância das respostas.</small></div>
        <div class="field"><label for="project-idea">Descreva a ideia <span>*</span></label><textarea id="project-idea" name="idea" required rows="5" placeholder="Escreva livremente. O que despertou essa ideia? O que deve existir ao final? O que você já sabe?">${esc(values.idea||'')}</textarea><small>Você não precisa conhecer a linguagem técnica. Descreva sua intenção com suas próprias palavras.</small></div>
        <div class="field"><label for="project-goal">O que este trabalho deve possibilitar?</label><textarea id="project-goal" name="goal" rows="2" placeholder="O principal resultado ou mudança que você deseja alcançar">${esc(values.goal||'')}</textarea></div>
        <div class="field"><label for="project-audience">Para quem é este projeto?</label><input id="project-audience" name="audience" placeholder="Ex.: estudantes, criadores independentes, equipes de pesquisa" value="${esc(values.audience||'')}"/></div>
        <div class="field"><label for="project-constraints">Restrições conhecidas ou coisas a evitar</label><textarea id="project-constraints" name="constraints" rows="3" placeholder="Tecnologias, orçamento, exclusões visuais, decisões que precisam ser preservadas...">${esc(values.constraints||'')}</textarea></div>
        <div class="form-actions"><button class="primary-button" type="submit">Continuar para a descoberta <span>↗</span></button><span class="form-footnote">Você poderá revisar estas informações depois.</span></div>
      </form>
      <aside class="form-aside"><div class="aside-note"><span class="aside-ornament">✳</span><span class="eyebrow">UM PEQUENO LEMBRETE</span><h3>Você não precisa de um briefing perfeito para começar.</h3><p>A descoberta existe para identificar o que falta. Comece pela ideia, não pela resposta pronta.</p></div><div class="aside-steps"><div class="aside-step active"><span>01</span><div><strong>Semente do projeto</strong><small>Sua ideia inicial</small></div></div><div class="aside-step"><span>02</span><div><strong>Entrevista adaptativa</strong><small>Perguntas orientadas pelo domínio</small></div></div><div class="aside-step"><span>03</span><div><strong>Requisitos</strong><small>Uma especificação para revisar</small></div></div><div class="aside-step"><span>04</span><div><strong>Estúdio de prompts</strong><small>Prompts de descoberta e execução</small></div></div></div></aside>
    </div>`;
}

function renderImprove() {
  const values = window.improveDraft || {};
  const categories = [
    ['visual','Visual / identidade'],['uiux','UI / UX'],['functional','Funcionalidades'],['code','Código'],['architecture','Arquitetura'],['structure','Estrutura'],['performance','Desempenho'],['accessibility','Acessibilidade'],['security','Segurança'],['documentation','Documentação'],['content','Conteúdo'],['expansion','Expansão'],['bugfix','Correções'],['refactor','Refatoração'],['integration','Integrações']
  ];
  const attachments = (window.improveFiles || []).map((asset)=>`<div class="asset-chip"><span>▤</span><span><strong>${esc(asset.name)}</strong><small>${asset.extracted?'Texto extraído':'Somente metadados'} · ${(asset.size/1024).toFixed(1)} KB</small></span></div>`).join('');
  return `
    <section class="page-intro"><div class="eyebrow">01 / IMPROVE · ANÁLISE DE PROJETO EXISTENTE</div><h1>O que existe merece<br><em>uma evolução cuidadosa.</em></h1><p>Descreva o projeto atual e o que precisa melhorar. A análise vai separar o que deve permanecer, o que pode mudar e o que ainda precisa ser investigado.</p></section>
    <div class="improve-callout"><span class="improve-callout-mark">↗</span><div><strong>Melhorar não significa reconstruir.</strong><p>O fluxo começa por entender o estado atual. Nada será considerado autorizado para remoção apenas por uma sugestão automática.</p></div></div>
    <form id="improve-project-form" class="form-panel improve-form">
      <div class="form-panel-head"><div><span class="step-count">01</span><h2>Identifique o projeto</h2><p>Comece pelo que já existe e pelo resultado que procura.</p></div><span class="required-note">* Obrigatório</span></div>
      <div class="field"><label for="improve-title">Nome do projeto <span>*</span></label><input id="improve-title" name="title" required maxlength="90" placeholder="Ex.: Prompt-Bereshit" value="${esc(values.title||'')}"/></div>
      <div class="field-row"><div class="field"><label for="improve-module">Domínio principal <span>*</span></label><select id="improve-module" name="moduleId" required>${MODULES.map((m)=>`<option value="${m.id}" ${values.moduleId===m.id?'selected':''}>${m.name}</option>`).join('')}</select></div><div class="field"><label for="improve-depth">Profundidade da descoberta</label><select id="improve-depth" name="depth"><option value="brief">Breve · essencial</option><option value="standard" selected>Padrão</option><option value="comprehensive">Abrangente</option></select></div></div><div class="field-row"><div class="field"><label for="improve-level">Nível de intervenção</label><select id="improve-level" name="level"><option value="quickfix">Quick Fix · correção pontual</option><option value="refinement" selected>Refinement · melhoria localizada</option><option value="overhaul">Overhaul · reestruturação ampla</option></select></div></div>
      <div class="field"><label for="improve-current">O que existe hoje? <span>*</span></label><textarea id="improve-current" name="currentState" required rows="5" placeholder="Descreva a estrutura, o propósito, o estado atual e como o projeto funciona.">${esc(values.currentState||'')}</textarea><small>Não é necessário escrever um relatório técnico. Descreva o que você conhece.</small></div>
      <div class="field"><label for="improve-goal">O que você deseja melhorar? <span>*</span></label><textarea id="improve-goal" name="goal" required rows="4" placeholder="Quais problemas deseja resolver? Que resultado gostaria de alcançar?">${esc(values.goal||'')}</textarea></div>
      <div class="field"><label>Quais áreas precisam de atenção?</label><div class="category-check-grid">${categories.map(([id,label])=>`<label class="category-check"><input type="checkbox" name="categories" value="${id}" ${values.categories?.includes(id)?'checked':''}/><span>${label}</span></label>`).join('')}</div><small>Selecione uma ou várias áreas. O escopo pode combinar categorias.</small></div>
      <div class="scope-grid">
        <div class="field"><label for="improve-preserve">PRESERVAR · o que não pode regredir?</label><textarea id="improve-preserve" name="preserve" rows="4" placeholder="Funcionalidades, identidade, conteúdos, fluxos e comportamentos que devem continuar intactos.">${esc(values.preserve||'')}</textarea></div>
        <div class="field"><label for="improve-modify">MODIFICAR · o que é alvo da melhoria?</label><textarea id="improve-modify" name="modify" rows="4" placeholder="Componentes, fluxos, estilos, estrutura ou código que podem ser alterados.">${esc(values.modify||'')}</textarea></div>
        <div class="field"><label for="improve-expand">EXPANDIR · o que deve ser acrescentado?</label><textarea id="improve-expand" name="expand" rows="4" placeholder="Novas capacidades, páginas, integrações ou documentação desejadas.">${esc(values.expand||'')}</textarea></div>
        <div class="field"><label for="improve-remove">REMOVER · o que está autorizado a sair?</label><textarea id="improve-remove" name="remove" rows="4" placeholder="Deixe vazio quando nenhuma remoção estiver autorizada.">${esc(values.remove||'')}</textarea><small>Remoções só serão incluídas no escopo quando você as indicar expressamente.</small></div>
      </div>
      <div class="field"><label for="improve-constraints">Restrições e limites</label><textarea id="improve-constraints" name="constraints" rows="3" placeholder="Tecnologias a manter, limites de infraestrutura, prazos, decisões não negociáveis...">${esc(values.constraints||'')}</textarea></div>
      <section class="asset-upload-panel"><div class="section-heading"><div><div class="eyebrow">MATERIAIS PARA ANÁLISE</div><h3>Adicione arquivos do projeto</h3><p class="section-subtitle">Nesta versão, arquivos textuais são extraídos localmente; outros formatos ficam apenas identificados.</p></div><span class="small-count">LOCAL</span></div><label class="upload-dropzone" for="improve-files"><span>＋</span><strong>Selecionar arquivos</strong><small>MD, TXT, HTML, CSS, JS, TS, JSON, CSV, SQL, Python e outros textos · 150 KB por arquivo / 700 KB combinados. PDF, DOCX, imagem e ZIP ficam como metadados nesta versão.</small><input id="improve-files" type="file" multiple accept=".txt,.md,.html,.css,.js,.mjs,.ts,.tsx,.jsx,.json,.csv,.sql,.py,.php,.xml,.yaml,.yml,.toml,.sh,.pdf,.docx,.zip,.png,.jpg,.jpeg,.webp"/></label><div id="improve-asset-list" class="asset-list">${attachments || '<small class="asset-empty">Nenhum arquivo selecionado.</small>'}</div></section>
      <div class="form-actions"><button class="primary-button" type="submit">Iniciar análise e descoberta <span>↗</span></button><span class="form-footnote">O Prompt B só será liberado após a revisão e aprovação da especificação.</span></div>
    </form>`;
}

function createImprovementProject(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  const formData = new FormData(form);
  const categories = formData.getAll('categories');
  const p = {
    id:uuid(), workflowType:'improve', depth:data.depth||'standard', moduleId:data.moduleId,
    brief:{title:data.title,idea:data.currentState,goal:data.goal,audience:'A definir durante a descoberta',deliverable:'Plano de melhoria aprovado e prompt de execução para projeto existente',constraints:data.constraints||''},
    improvement:{currentState:data.currentState,goal:data.goal,preserve:data.preserve||'',modify:data.modify||'',expand:data.expand||'',remove:data.remove||'',level:data.level||'refinement',categories},
    answers:[],questionRegistry:[],requirements:[],specVersion:1,approved:false,approvedSpecVersion:null,specHistory:[],resolutions:{},
    decisions:[],assumptions:[],context:[],assets:(window.improveFiles||[]),refinements:[],prompts:{discovery:'',execution:''},promptHistory:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()
  };
  p.improvementAnalysis = buildImprovementAnalysis(p);
  state.projects.unshift(p); state.activeProjectId=p.id; persist();
  window.improveFiles=[]; window.improveDraft=null; interviewIndex=0; promptTab='discovery'; page='interview'; render();
}

async function readImprovementFiles(fileList) {
  const files = [...(fileList || [])];
  let totalCurrent = (window.improveFiles || []).reduce((sum,asset)=>sum+(asset.text ? new Blob([asset.text]).size : 0),0);
  if (files.length + (window.improveFiles||[]).length > 20) { showToast('O limite é de 20 arquivos por projeto.'); return; }
  for (const file of files) {
    if ((window.improveFiles||[]).some((asset)=>asset.name===file.name && asset.size===file.size)) continue;
    const extension = file.name.split('.').pop().toLowerCase();
    const textExtensions = new Set(['txt','md','html','css','js','mjs','ts','tsx','jsx','json','csv','sql','py','php','xml','yaml','yml','toml','sh','vue','svelte','java','c','cpp','h','go','rs']);
    const isText = textExtensions.has(extension) || file.type.startsWith('text/');
    let text = '';
    let extracted = false;
    let note = '';
    if (file.size > 12 * 1024 * 1024) { note='Arquivo acima do limite de 12 MB; não foi incorporado.'; }
    else if (isText && file.size <= 150 * 1024 && totalCurrent + file.size <= 700 * 1024) {
      try { text = await file.text(); extracted = true; totalCurrent += new Blob([text]).size; } catch { note='Não foi possível ler o conteúdo.'; }
    } else if (isText) note='Arquivo textual acima do limite por arquivo ou do limite combinado de extração; conteúdo não incluído.';
    else note='Formato registrado apenas como metadado; PDF, DOCX, imagens e ZIP ainda não são extraídos nesta versão.';
    window.improveFiles ||= [];
    window.improveFiles.push({id:uuid(),name:file.name,type:file.type||extension,size:file.size,text,extracted,note,createdAt:new Date().toISOString()});
  }
  const list = $('#improve-asset-list');
  if (list) list.innerHTML = window.improveFiles.map((asset)=>`<div class="asset-chip"><span>▤</span><span><strong>${esc(asset.name)}</strong><small>${asset.extracted?'Texto extraído':esc(asset.note)} · ${(asset.size/1024).toFixed(1)} KB</small></span><button type="button" class="icon-button small" data-action="remove-improve-file" data-id="${asset.id}" aria-label="Remover ${esc(asset.name)}">×</button></div>`).join('') || '<small class="asset-empty">Nenhum arquivo selecionado.</small>';
  showToast(`${files.length} arquivo(s) processado(s) localmente.`);
}

function createProject(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  const p = {
    id:uuid(), workflowType:'create', depth:data.depth || 'standard', moduleId:data.moduleId, brief:{title:data.title,idea:data.idea,goal:data.goal,audience:data.audience,deliverable:data.deliverable,constraints:data.constraints},
    answers:[], questionRegistry:[], requirements:[], specVersion:1, approved:false, approvedSpecVersion:null, specHistory:[], resolutions:{}, decisions:[], assumptions:[], context:[], assets:[], refinements:[], prompts:{discovery:'',execution:''}, promptHistory:[], createdAt:new Date().toISOString(), updatedAt:new Date().toISOString()
  };
  state.projects.unshift(p); state.activeProjectId=p.id; persist(); interviewIndex=0; promptTab='discovery'; page='interview'; render();
}

function renderInterview() {
  const p = activeProject(); if (!p) return renderNoProject('Comece criando a semente de um projeto.');
  const queue = getInterviewQueue(p); const q = queue[interviewIndex];
  const answer = getAnswer(p, q, interviewIndex);
  const progress = Math.round(((interviewIndex+1)/queue.length)*100);
  return `
    <section class="page-intro compact-intro"><div class="eyebrow">02 / DESCOBERTA ADAPTATIVA <span class="eyebrow-dot">·</span> ${esc(moduleLabel(p.moduleId).toUpperCase())}</div><h1>Vamos tornar<br><em>o implícito visível.</em></h1><p>Responda ao que souber. Deixe decisões em aberto quando houver dúvida; a especificação final manterá essas incertezas visíveis.</p></section>
    <div class="interview-layout"><aside class="interview-rail"><div class="rail-head"><span class="eyebrow">MAPA DA DESCOBERTA</span><strong>${String(interviewIndex+1).padStart(2,'0')} <small>/ ${queue.length}</small></strong></div><div class="progress-track"><span style="width:${progress}%"></span></div><div class="question-list">${queue.map((item,i)=>{const answer=getAnswer(p,item,i);return `<button class="question-nav ${i===interviewIndex?'current':''} ${answer.value||answer.delegate?'answered':''}" data-action="jump-question" data-index="${i}"><span class="question-nav-num">${String(i+1).padStart(2,'0')}</span><span>${esc(item.title)}</span><span class="q-check">${answer.value||answer.delegate?'✓':''}</span></button>`;}).join('')}</div><div class="rail-tip"><span>✳</span><p>Pule quando necessário. Uma resposta ausente será um ponto em aberto, nunca uma decisão inventada.</p></div></aside>
    <section class="interview-card"><div class="interview-card-top"><span class="question-kicker">${esc(q.group)}</span><span class="question-counter">PERGUNTA ${String(interviewIndex+1).padStart(2,'0')}</span></div><span class="question-step-label">${esc(q.title)}</span><h2>${esc(q.question)}</h2><p class="question-hint">${esc(q.placeholder)}</p><textarea id="interview-answer" rows="7" placeholder="Escreva sua resposta aqui...">${esc(answer.value||'')}</textarea><label class="delegate-option"><input type="checkbox" id="delegate-answer" ${answer.delegate?'checked':''}/><span class="custom-check"></span><span><strong>Deixe o modelo recomendar</strong><small>Ainda não tenho uma decisão. Peça ao LLM de destino que sugira uma opção e explique as vantagens e limitações.</small></span></label><div class="interview-actions"><button class="quiet-button" data-action="prev-question" ${interviewIndex===0?'disabled':''}>← Anterior</button><div class="interview-next-group"><button class="text-link" data-action="skip-question">Pular por enquanto</button>${interviewIndex===queue.length-1?`<button class="primary-button" data-action="finish-interview">Construir minha especificação <span>↗</span></button>`:`<button class="primary-button" data-action="next-question">Próxima pergunta <span>→</span></button>`}</div></div></section></div>`;
}

function renderNoProject(message) {
  return `<div class="empty-state"><div class="empty-illustration">✳</div><h3>Nenhum projeto ativo ainda.</h3><p>${esc(message)}</p><button class="primary-button" data-page="new">Começar nova descoberta <span>↗</span></button></div>`;
}

function renderRequisitos() {
  const p=activeProject(); if(!p) return renderNoProject('Crie ou abra um projeto para revisar sua especificação.');
  if(!p.requirements?.length) return `<section class="page-intro"><div class="eyebrow">03 / REQUISITOS</div><h1>Das ideias a<br><em>critérios claros.</em></h1><p>Suas respostas estão prontas para serem organizadas em uma especificação revisável.</p></section><div class="empty-state"><div class="empty-illustration">☷</div><h3>Ainda não há especificação.</h3><p>Conclua a entrevista de descoberta para organizar requisitos e verificar possíveis conflitos.</p><button class="primary-button" data-page="interview">Continuar descoberta <span>↗</span></button></div>`;
  const conflicts=scanContradictions(p);
  const reqs=p.requirements;
  const queue=getInterviewQueue(p);
  const explicitFields=['title','idea','goal','audience','deliverable','constraints'].filter(k=>String(p.brief?.[k]||'').trim()).length + (p.answers||[]).filter(a=>String(a?.value||'').trim()).length;
  const delegatedCount=(p.answers||[]).filter(a=>a?.delegate).length;
  const answeredCount=(p.answers||[]).filter(a=>String(a?.value||'').trim()||a?.delegate).length;
  const openCount=Math.max(0,queue.length-answeredCount);
  const groups=[...new Set(reqs.map(r=>r.category))];
  return `<section class="page-intro compact-intro"><div class="eyebrow">03 / REQUISITOS STUDIO</div><h1>Um briefing com<br><em>limites bem definidos.</em></h1><p>Revise o que está explícito, o que permanece em aberto e quais condições definirão um resultado satisfatório.</p></section>
    <div class="spec-header"><div><span class="project-overline">${esc(moduleLabel(p.moduleId))} · ESPECIFICAÇÃO v${p.specVersion||1} · ${fmtDate(p.updatedAt)}</span><h2>${esc(p.brief.title)}</h2><p>${esc(p.brief.goal||p.brief.idea)}</p></div><span class="status-chip ${approved(p)?'approved':''}">${approved(p)?'Aprovado':p.approved?'Desatualizado':'Em revisão'}</span></div>
    ${p.workflowType==='improve'?renderImprovementAudit(p):''}
    ${conflicts.length?`<section class="conflict-panel"><div class="conflict-head"><span class="conflict-icon">!</span><div><strong>${conflicts.length} possível contradição${conflicts.length>1?'s':''} para revisar</strong><small>Verificações baseadas em regras. São sinais para revisão, não erros definitivos.</small></div></div>${conflicts.map(c=>`<div class="conflict-item ${c.resolved?'conflict-resolved':''}"><div><strong>${esc(c.title)}</strong><span class="conflict-severity">${c.severity==='high'?'Impacto alto':'Impacto médio'}</span></div><p>${esc(c.detail)}</p>${c.resolved?`<small>Decisão registrada: ${esc(c.resolved)}</small>`:`<button class="text-link" data-action="resolve-conflict" data-conflict="${c.id}">Registrar decisão ↗</button>`}</div>`).join('')}</section>`:`<div class="clean-review-note"><span>✓</span><div><strong>Nenhum conflito detectado pelas regras locais.</strong><small>Isso não garante que todos os requisitos sejam compatíveis. Revise a especificação antes de aprová-la.</small></div></div>`}
    <div class="information-map"><div class="information-map-head"><div><span class="eyebrow">CLASSIFICAÇÃO DAS INFORMAÇÕES</span><strong>O que está definido, delegado ou em aberto?</strong></div><span class="classification-note">Nenhuma suposição é tratada como decisão do usuário.</span></div><div class="classification-grid"><div><span class="classification-number">${String(explicitFields).padStart(2,'0')}</span><strong>Entradas explícitas</strong><small>Informações fornecidas diretamente no briefing ou na entrevista.</small></div><div><span class="classification-number">${String(delegatedCount).padStart(2,'0')}</span><strong>Decisões delegadas</strong><small>Questões em que o LLM de destino poderá recomendar uma solução.</small></div><div><span class="classification-number">${String(openCount).padStart(2,'0')}</span><strong>Pontos em aberto</strong><small>Ainda sem resposta; o LLM de destino não deverá inventá-las.</small></div></div><p>Requisitos implícitos e preferências opcionais devem ser propostos separadamente pelo LLM de destino, explicados e confirmados quando afetarem materialmente o projeto.</p></div>
    <div class="requirements-summary"><div><span class="eyebrow">INVENTÁRIO DE REQUISITOS</span><strong>${String(reqs.length).padStart(2,'0')}</strong><small>Itens registrados e derivados</small></div><div class="priority-summary"><span class="priority-dot critical"></span><strong>${reqs.filter(r=>r.priority==='critical').length}</strong><small>Crítico</small></div><div class="priority-summary"><span class="priority-dot high"></span><strong>${reqs.filter(r=>r.priority==='high').length}</strong><small>Alto</small></div><div class="priority-summary"><span class="priority-dot medium"></span><strong>${reqs.filter(r=>r.priority==='medium').length}</strong><small>Médio</small></div><div class="priority-summary"><span class="priority-dot low"></span><strong>${reqs.filter(r=>r.priority==='low').length}</strong><small>Baixo</small></div></div>
    <section class="section-block"><div class="section-heading"><div><div class="eyebrow">ESPECIFICAÇÃO</div><h2>Requisitos</h2><p class="section-subtitle">Edite as prioridades quando necessário. Os identificadores permanecem estáveis nesta especificação.</p></div><button class="quiet-button compact" data-action="rebuild-requirements">↻ Reconstruir a partir das respostas</button></div>
    <div class="requirements-list">${groups.map(g=>`<div class="requirement-group"><div class="requirement-group-title">${esc(g)}</div>${reqs.filter(r=>r.category===g).map(r=>`<article class="requirement-row"><div class="req-id">${esc(r.id)}</div><div class="req-content"><strong>${esc(r.description)}</strong><small><span class="classification-pill">${esc(r.classification||'explicit')}</span> · origem: ${esc(r.source?.kind||'não registrada')} / ${esc(r.source?.ref||'n/a')}</small><small>Critério de aceitação: ${esc(r.criteria)}</small><details class="requirement-edit"><summary>Editar requisito</summary><div class="requirement-edit-grid"><label>Descrição<textarea data-req-field="description" data-req-id="${esc(r.id)}" rows="2">${esc(r.description)}</textarea></label><label>Critério de aceitação<textarea data-req-field="criteria" data-req-id="${esc(r.id)}" rows="2">${esc(r.criteria)}</textarea></label><label>Classificação<select data-req-field="classification" data-req-id="${esc(r.id)}">${['explicit','preference','constraint','inference','recommendation','decision','open-question'].map(v=>`<option value="${v}" ${r.classification===v?'selected':''}>${v}</option>`).join('')}</select></label><label>Dependências (IDs separados por vírgula)<input data-req-field="dependencies" data-req-id="${esc(r.id)}" value="${esc((r.dependencies||[]).join(', '))}"/></label><button type="button" class="text-link danger-text" data-action="delete-requirement" data-id="${esc(r.id)}">Excluir requisito</button></div></details></div><select class="priority-select ${r.priority.toLowerCase()}" aria-label="Prioridade de ${r.id}" data-priority-id="${r.id}">${['critical','high','medium','low'].map(v=>`<option value="${v}" ${r.priority===v?'selected':''}>${({critical:'Crítico',high:'Alto',medium:'Médio',low:'Baixo'})[v]}</option>`).join('')}</select></article>`).join('')}</div>`).join('')}</div></section>
    <section class="custom-requirement-panel"><div><span class="eyebrow">CONTROLE DA ESPECIFICAÇÃO</span><h3>Adicionar requisito manual</h3><p>Use quando uma exigência importante não tiver surgido automaticamente na entrevista.</p></div><form id="custom-requirement-form" class="custom-requirement-form"><input name="description" required maxlength="3000" placeholder="Descreva o requisito..."/><div class="field-row"><select name="classification"><option value="explicit">Explícito</option><option value="constraint">Restrição</option><option value="preference">Preferência</option><option value="recommendation">Recomendação</option><option value="decision">Decisão aprovada</option></select><select name="priority"><option value="critical">Crítico</option><option value="high" selected>Alto</option><option value="medium">Médio</option><option value="low">Baixo</option></select></div><input name="criteria" required maxlength="2000" placeholder="Critério verificável de aceitação..."/><button class="quiet-button compact" type="submit">＋ Adicionar à especificação</button></form></section>
    <section class="review-columns"><div class="review-note-card"><span class="eyebrow">RESTRIÇÕES CONHECIDAS</span><p>${esc(p.brief.constraints||'Nenhuma restrição explícita foi informada.')}</p></div><div class="review-note-card"><span class="eyebrow">DECISÕES EM ABERTO</span><p>${p.answers.filter(a=>!a.value&&!a.delegate).length} itens permanecem sem resposta. O prompt de execução orientará o LLM a não inventá-los.</p></div></section>
    <div class="approval-bar"><div><span class="approval-mark">✳</span><div><strong>${approved(p)?'Especificação aprovada':p.approved?'A aprovação anterior ficou desatualizada':'Pronto para sua aprovação?'}</strong><small>${approved(p)?'O Prompt B está vinculado à versão aprovada.':'A aprovação será vinculada à versão atual e invalidada por mudanças materiais.'}</small></div></div><button class="primary-button" data-action="approve-spec">${approved(p)?'Abrir Estúdio de Prompts':'Aprovar especificação'} <span>↗</span></button></div>`;
}

function ensurePrompt(p, tab) {
  if (!p.prompts) p.prompts={discovery:'',execution:''};
  p.promptSpecVersions ||= {};
  const stale = p.promptSpecVersions[tab] !== (p.specVersion || 1);
  if (!p.prompts[tab] || stale) {
    p.prompts[tab] = tab==='discovery'?buildDiscoveryPrompt(p):buildExecutionPrompt(p);
    p.promptSpecVersions[tab] = p.specVersion || 1;
  }
  return p.prompts[tab];
}
function renderStudio() {
  const p=activeProject(); if(!p) return renderNoProject('Crie um projeto para gerar um prompt.');
  if(!p.requirements?.length) return `<section class="page-intro"><div class="eyebrow">04 / ESTÚDIO DE PROMPTS</div><h1>Prepare o prompt<br><em>para seguir adiante.</em></h1><p>O estúdio mantém descoberta e execução separadas, para que o modelo não comece a implementar antes da aprovação do briefing.</p></section><div class="empty-state"><div class="empty-illustration">✎</div><h3>Os requisitos vêm primeiro.</h3><p>Conclua a descoberta e revise a especificação antes de preparar o prompt de execução.</p><button class="primary-button" data-page="interview">Continuar descoberta <span>↗</span></button></div>`;
  const discovery=ensurePrompt(p,'discovery');
  const execution=approved(p)?ensurePrompt(p,'execution'):'';
  const current=promptTab==='execution'?execution:discovery;
  const versions=(p.promptHistory||[]).filter(h=>h.type===promptTab).length;
  return `<section class="page-intro compact-intro"><div class="eyebrow">04 / ESTÚDIO DE PROMPTS</div><h1>Dois prompts.<br><em>Uma direção clara.</em></h1><p>A descoberta inicia a conversa e produz uma especificação. A execução recebe a especificação aprovada e orienta o trabalho.</p></section>
    <div class="prompt-project-strip"><div><span class="project-overline">PROJETO ATUAL</span><strong>${esc(p.brief.title)}</strong></div><span class="status-chip ${approved(p)?'approved':''}">${approved(p)?'Especificação aprovada':p.approved?'Especificação desatualizada':'Aprovação necessária'}</span></div>
    <div class="prompt-tabs"><button class="prompt-tab ${promptTab==='discovery'?'active':''}" data-action="prompt-tab" data-tab="discovery"><span class="tab-number">A</span><span><strong>Prompt de descoberta</strong><small>Entrevistar · Esclarecer · Especificar</small></span><span class="tab-open">↗</span></button><button class="prompt-tab ${promptTab==='execution'?'active':''} ${!approved(p)?'locked':''}" data-action="prompt-tab" data-tab="execution" ${!approved(p)?'disabled':''}><span class="tab-number">B</span><span><strong>Prompt de execução</strong><small>Implementar · Validar · Entregar</small></span><span class="tab-open">${approved(p)?'↗':'▣'}</span></button></div>
    ${!approved(p)?`<div class="approval-required-note"><span>▣</span><div><strong>A execução está bloqueada até a aprovação.</strong><small>Revise os requisitos e aprove a especificação para liberar o Prompt B.</small></div><button class="text-link" data-page="requirements">Revisar especificação ↗</button></div>`:''}
    <div class="prompt-editor-heading"><div><span class="eyebrow">${promptTab==='discovery'?'PROMPT A · DESCOBERTA':'PROMPT B · EXECUÇÃO'}</span><h2>${promptTab==='discovery'?'O entrevistador':'O briefing de execução'}</h2><p>${promptTab==='discovery'?'Cole este prompt no LLM de destino para continuar a entrevista adaptativa.':'Uma instrução autossuficiente construída a partir dos requisitos aprovados.'}</p></div><div class="editor-tools"><span class="version-count">${versions} versões salvas</span><button class="quiet-button compact" data-action="regenerate-prompt">↻ Regenerar</button></div></div>
    <div class="editor-shell"><div class="editor-topline"><span><i></i><i></i><i></i></span><small>${promptTab==='discovery'?'discovery.prompt.md':'execution.prompt.md'}</small><span class="editor-language">MARKDOWN</span></div><textarea id="prompt-editor" spellcheck="false" aria-label="Editable generated prompt">${esc(current)}</textarea><div class="editor-footer"><span id="prompt-char-count">${current.length.toLocaleString('pt-BR')} caracteres</span><span>Editável · Alterações salvas localmente</span></div></div>
    <div class="prompt-actions"><button class="primary-button" data-action="copy-prompt">Copiar prompt <span>↗</span></button><button class="quiet-button" data-action="download-prompt">Baixar .md</button><button class="quiet-button" data-action="save-prompt-version">Salvar versão</button></div>
    ${renderPromptDiagnostics(current,p,promptTab)}
    ${renderPromptHistory(p,promptTab,current)}
    <section class="refinement-panel"><div class="refinement-heading"><span class="refinement-icon">✳</span><div><div class="eyebrow">REFINAMENTO ITERATIVO</div><h3>Dê mais uma lapidada no prompt.</h3><p>Registre uma direção para o prompt atualmente aberto. Isso altera o artefato de instrução, não a especificação aprovada. Mudanças de escopo devem ser feitas nos requisitos.</p></div></div><textarea id="refinement-input" rows="3" placeholder="Ex.: preserve a estrutura atual, tornar a hierarquia mais clara e acrescentar critérios verificáveis para o fluxo de onboarding."></textarea><div class="refinement-bottom"><small>${(p.refinements||[]).length} notas de refinamento preservadas</small><button class="quiet-button compact" data-action="apply-refinement">Adicionar refinamento ↗</button></div>${p.refinements?.some(r=>(typeof r==='string'?'execution':r.type)===promptTab)?`<div class="refinement-log">${p.refinements.map((r,i)=>({r,i})).filter(({r})=>(typeof r==='string'?'execution':r.type)===promptTab).map(({r,i},position)=>`<div><span>${String(position+1).padStart(2,'0')}</span><p>${esc(typeof r==='string'?r:r.note)}</p><button class="icon-button small" data-action="remove-refinement" data-index="${i}" title="Remover refinamento">×</button></div>`).join('')}</div>`:''}</section>`;
}

function renderImprovementAudit(project) {
  const analysis=project.improvementAnalysis || buildImprovementAnalysis(project);
  const assets=project.assets||[];
  const counts={read:assets.filter(a=>a.text).length,metadata:assets.filter(a=>!a.text).length};
  const findings=analysis.findings||[];
  return `<section class="improvement-audit"><div class="section-heading"><div><div class="eyebrow">IMPROVEMENT ENGINE / BASE DE EVIDÊNCIAS</div><h2>Limites da análise atual</h2><p class="section-subtitle">O diagnóstico utiliza somente a descrição e os conteúdos efetivamente fornecidos.</p></div><span class="small-count">${counts.read} LIDOS · ${counts.metadata} METADADOS</span></div><div class="audit-grid"><div><strong>${esc(analysis.levelLabel||'Refinement')}</strong><small>Nível de intervenção selecionado</small></div><div><strong>${assets.length}</strong><small>Arquivos associados</small></div><div><strong>${findings.length}</strong><small>Lacunas ou sinais identificados</small></div></div>${findings.length?findings.map(f=>`<article class="audit-finding"><strong>${esc(f.title)}</strong><p>${esc(f.detail)}</p></article>`).join(''):'<p class="audit-clear">Nenhuma lacuna adicional identificada pelas verificações locais. Isso não equivale a uma auditoria semântica ou execução do projeto.</p>'}${(analysis.risks||[]).length?`<div class="audit-risks"><strong>Riscos a considerar</strong>${analysis.risks.map(r=>`<p>• ${esc(r)}</p>`).join('')}</div>`:''}<p class="audit-limit">A versão atual não executa o projeto anexado nem faz análise semântica por IA. Materiais sem extração textual são listados, mas não tratados como inspecionados.</p></section>`;
}

function renderPromptDiagnostics(prompt, project, type) {
  const report=diagnosePrompt(prompt,project,type);
  const icons={high:'!',medium:'•',low:'✓'};
  return `<section class="diagnostic-panel"><div class="diagnostic-head"><div><div class="eyebrow">PROMPT CHECK / DIAGNÓSTICO LOCAL</div><h3>Antes de utilizar</h3></div><span class="diagnostic-count">${report.findings.length} observações</span></div>${report.findings.length?report.findings.map(item=>`<article class="diagnostic-item"><span class="diagnostic-dot ${item.severity}">${icons[item.severity]||'•'}</span><div><strong>${esc(item.title)}</strong><p>${esc(item.detail)}</p><small>Próxima ação: ${esc(item.action)}</small></div></article>`).join(''):'<p class="audit-clear">Nenhum alerta heurístico foi identificado. Isso não garante a qualidade semântica do prompt.</p>'}<small class="diagnostic-disclaimer">${esc(report.note)} ${report.counts.high} alto(s) · ${report.counts.medium} médio(s).</small></section>`;
}

function renderPromptHistory(project,type,current) {
  const entries=(project.promptHistory||[]).filter(item=>item.type===type);
  const selected=entries.find(item=>item.id===comparisonHistoryId);
  const fullDiff=selected?buildTextDiff(selected.content,current):[];
  const diff=fullDiff.slice(0,80);
  return `<section class="prompt-history"><div class="section-heading"><div><div class="eyebrow">VERSIONAMENTO / RASTREABILIDADE</div><h3>Versões salvas</h3><p class="section-subtitle">Cada versão registra o prompt e a versão da especificação a que estava vinculada.</p></div><span class="small-count">${entries.length} VERSÕES</span></div>${entries.length?entries.map(item=>`<article class="history-item"><div><strong>${esc(item.note||'Versão salva')}</strong><small>${fmtDate(item.createdAt)} · especificação v${item.specVersion}</small><p>${esc(item.content.slice(0,150))}${item.content.length>150?'…':''}</p></div><div class="history-actions"><button class="text-link" data-action="compare-version" data-id="${esc(item.id)}">Comparar</button><button class="text-link" data-action="restore-prompt-version" data-id="${esc(item.id)}">Restaurar</button></div></article>`).join(''):'<p class="audit-clear">Nenhuma versão manual foi salva ainda. Use “Salvar versão” para criar um ponto de recuperação.</p>'}${selected?`<div class="diff-lines"><div class="diff-heading"><strong>Comparação com ${esc(selected.note||'versão salva')}</strong><button class="text-link" data-action="compare-version" data-id="">Fechar comparação</button></div>${diff.map(line=>`<div class="diff-line ${line.type}"><span>${line.type==='added'?'+':line.type==='removed'?'−':' '}</span><code>${esc(line.text||' ')}</code></div>`).join('')}${fullDiff.length>80?'<small>Exibindo as primeiras 80 linhas da comparação.</small>':''}</div>`:''}</section>`;
}

function renderContext() {
  const p=activeProject(); if(!p) return renderNoProject('Crie ou abra um projeto para preservar seu contexto.');
  p.context ||= [];
  return `<section class="page-intro compact-intro"><div class="eyebrow">MEMÓRIA DO PROJETO / PRESERVAÇÃO DE CONTEXTO</div><h1>Mantenha o que importa<br><em>sempre por perto.</em></h1><p>Armazene decisões, definições, notas de referência e restrições que devem sobreviver entre iterações do prompt.</p></section>
    <div class="context-project"><span class="context-project-mark">◫</span><div><small>PROJETO ATIVO</small><strong>${esc(p.brief.title)}</strong><span>${p.context.length} notas preservadas</span></div><span class="context-local-label">LOCAL A ESTE PROJETO</span></div>
    <div class="context-layout"><section class="context-main"><div class="section-heading"><div><div class="eyebrow">NOTAS PRESERVADAS</div><h2>Prateleira de contexto</h2></div><span class="small-count">${String(p.context.length).padStart(2,'0')} NOTAS</span></div>${p.context.length?`<div class="context-list">${p.context.map((n,i)=>`<article class="context-item ${n.pinned?'pinned':''}"><div class="context-item-top"><span class="context-note-tag">${n.pinned?'CONTEXTO FIXADO':esc(n.kind||'NOTA DO PROJETO')}</span><div><button class="icon-button small" data-action="toggle-pin-note" data-index="${i}" title="Alternar fixação">${n.pinned?'★':'☆'}</button><button class="icon-button small" data-action="delete-context-note" data-index="${i}" title="Excluir nota">×</button></div></div><h3>${esc(n.title)}</h3><p>${esc(n.body)}</p><small>Adicionada em ${fmtDate(n.createdAt)}</small></article>`).join('')}</div>`:`<div class="empty-state compact-empty"><div class="empty-illustration">◫</div><h3>A prateleira ainda está vazia.</h3><p>Adicione uma decisão importante ou detalhe do projeto. Notas fixadas recebem destaque no prompt de execução.</p></div>`}</section>
    <aside class="context-add-panel"><span class="eyebrow">ADICIONAR AO CONTEXTO</span><h3>Preserve um detalhe.</h3><form id="context-form"><div class="field"><label for="context-title">Título da nota</label><input id="context-title" name="title" required maxlength="80" placeholder="e.g. Brand voice decision"/></div><div class="field"><label for="context-kind">Tipo de contexto</label><select id="context-kind" name="kind"><option value="decision">Decisão</option><option value="constraint">Restrição</option><option value="preference">Preferência</option><option value="source">Fonte / referência</option><option value="note">Nota de contexto</option></select></div><div class="field"><label for="context-source">Origem ou referência (opcional)</label><input id="context-source" name="source" maxlength="300" placeholder="Ex.: conversa de 20/11, arquivo README.md, decisão aprovada..."/></div><div class="field"><label for="context-body">O que o modelo deve lembrar?</label><textarea id="context-body" name="body" required rows="6" placeholder="Escreva a decisão, definição, fonte, restrição ou contexto relevante..."></textarea></div><label class="delegate-option pin-option"><input type="checkbox" name="pinned"/><span class="custom-check"></span><span><strong>Fixar esta nota</strong><small>Marcar como contexto especialmente importante.</small></span></label><button class="primary-button full-width" type="submit">Salvar nota de contexto <span>↗</span></button></form></aside></div>
    <div class="context-footnote"><span>ⓘ</span> As notas são armazenadas neste navegador e incluídas na geração dos prompts. Exporte um backup do projeto antes de migrar para outro dispositivo.</div>`;
}

function renderModules() {
  const categories=['all',...new Set(MODULES.map(m=>m.category))];
  const filtered=MODULES.filter(m=>(moduleFilter==='all'||m.category===moduleFilter)&&(`${m.name} ${m.description}`).toLowerCase().includes(moduleSearch.toLowerCase()));
  return `<section class="page-intro compact-intro"><div class="eyebrow">MÓDULOS DE DOMÍNIO / DESCOBERTA ESPECIALIZADA</div><h1>Trabalhos diferentes,<br><em>perguntas diferentes.</em></h1><p>Cada módulo possui uma perspectiva própria de descoberta. Selecione um domínio para iniciar um projeto com suas perguntas preparadas.</p></section>
    <div class="module-toolbar"><div class="filter-chips">${categories.map(c=>`<button class="filter-chip ${moduleFilter===c?'active':''}" data-action="module-filter" data-filter="${esc(c)}">${c==='all'?'Todos os módulos':esc(c)}</button>`).join('')}</div><input id="module-search" class="search-input" type="search" placeholder="Buscar módulos..." value="${esc(moduleSearch)}"/></div>
    <div class="module-library-grid">${filtered.map((m,i)=>`<article class="module-card"><div class="module-card-top"><span class="module-card-icon">${m.icon}</span><span class="module-card-num">${String(i+1).padStart(2,'0')}</span></div><span class="module-category">${esc(m.category)}</span><h3>${esc(m.name)}</h3><p>${esc(m.description)}</p><div class="module-card-bottom"><span>${m.questions.length+CORE_QUESTIONS.length} perguntas de descoberta</span><button class="text-link" data-action="new-with-module" data-module="${m.id}">Usar módulo ↗</button></div><details class="module-details"><summary>Ver foco da descoberta</summary><ol>${m.questions.map(q=>`<li><strong>${esc(q[0])}</strong><span>${esc(q[1])}</span></li>`).join('')}</ol></details></article>`).join('') || '<div class="empty-state"><h3>Nenhum módulo encontrado.</h3><p>Tente outro termo ou categoria.</p></div>'}</div>
    <div class="module-library-note"><span class="tiny-star">✳</span><p>Os módulos são estruturas iniciais, não formulários rígidos. Campos sem resposta podem permanecer em aberto, e o LLM de destino recebe a orientação de perguntar apenas o que afeta materialmente o resultado.</p></div>`;
}

function renderReferences() {
  return `<section class="page-intro compact-intro"><div class="eyebrow">DIREÇÃO DE ARTE / ARQUIVO DE REFERÊNCIAS</div><h1>Um sistema delicado<br><em>para trabalhos sérios.</em></h1><p>A biblioteca visual mantém as referências fornecidas disponíveis como material de direção. Elas orientam tom, tipografia, cor e composição.</p></section>
    <section class="palette-panel"><div class="section-heading"><div><div class="eyebrow">SISTEMA DE CORES</div><h2>Paleta Daze Social</h2><p class="section-subtitle">Extraída da prancha de identidade fornecida.</p></div><span class="small-count">09 CORES</span></div><div class="palette-grid">${PALETTE.map(c=>`<button class="palette-swatch" data-action="copy-color" data-color="${c.hex}" title="Copiar ${c.hex}"><span style="background:${c.hex}"></span><strong>${c.name}</strong><small>${c.hex}</small></button>`).join('')}</div></section>
    <section class="type-panel"><div class="section-heading"><div><div class="eyebrow">DIREÇÃO TIPOGRÁFICA</div><h2>Quatro vozes, um sistema</h2><p class="section-subtitle">Combinações de fontes para web inspiradas nos espécimes enviados.</p></div></div><div class="type-grid"><div class="type-specimen serif-spec"><small>SERIFADA EDITORIAL / INSPIRADA EM MINYA</small><strong>Ideias ganham forma.</strong><p>Títulos, momentos editoriais e declarações.</p></div><div class="type-specimen sans-spec"><small>SANS-SERIF FUNCIONAL / INTERFACE</small><strong>Torne a próxima decisão clara.</strong><p>Navegação, formulários, textos explicativos e controles.</p></div><div class="type-specimen script-spec"><small>SCRIPT ORNAMENTAL / INSPIRADO EM FAIRY GARDEN</small><strong>comece com uma ideia</strong><p>Pequenos acentos, assinaturas e etiquetas expressivas.</p></div><div class="type-specimen display-spec"><small>DISPLAY / LUCKIEST GUY</small><strong>MAKE IT CLEAR</strong><p>Etiquetas curtas e pequenos momentos expressivos.</p></div></div><p class="font-note">O ZIP contém imagens de espécimes, não arquivos de fontes instaláveis. Minya, Jerencia e Fairy Garden são representadas neste protótipo por alternativas compatíveis com a web; os arquivos originais poderão substituí-las quando forem fornecidos com direitos adequados de uso web.</p></section>
    <section class="section-block"><div class="section-heading"><div><div class="eyebrow">MATERIAIS FORNECIDOS</div><h2>Arquivo de referências</h2><p class="section-subtitle">As imagens originais foram preservadas nos arquivos do projeto.</p></div><span class="small-count">07 REFERÊNCIAS</span></div><div class="reference-grid">${REFERENCES.map(r=>`<article class="reference-card"><div class="reference-image"><img src="assets/references/${r.file}" alt="${esc(r.title)} reference" loading="lazy"/></div><div class="reference-caption"><strong>${esc(r.title)}</strong><p>${esc(r.caption)}</p></div></article>`).join('')}</div></section>`;
}

function renderSettings() {
  return `<section class="page-intro compact-intro"><div class="eyebrow">PREFERÊNCIAS DO ESPAÇO</div><h1>Seu trabalho,<br><em>sob seu controle.</em></h1><p>O Prompt-Bereshit funciona, nesta versão, como um protótipo local-first. Gerencie backups e entenda onde as informações são armazenadas.</p></section>
    <div class="settings-grid"><section class="settings-card"><span class="settings-icon">⇧</span><div class="eyebrow">BACKUP E PORTABILIDADE</div><h3>Exporte seu espaço de trabalho</h3><p>Baixe todos os projetos, especificações, prompts salvos, notas de refinamento e contextos em um backup JSON.</p><button class="primary-button" data-action="export-workspace">Exportar workspace JSON ↗</button><button class="quiet-button" data-action="import-workspace">Importar um backup</button></section><section class="settings-card"><span class="settings-icon">⌂</span><div class="eyebrow">ARMAZENAMENTO LOCAL</div><h3>Onde seu trabalho fica salvo</h3><p>Os projetos ficam salvos neste navegador usando localStorage. Eles não são enviados a um servidor nem compartilhados automaticamente entre dispositivos.</p><div class="privacy-points"><span>✓ Sem necessidade de conta</span><span>✓ Nenhuma chave de API armazenada</span><span>✓ Dados de projeto exportáveis</span></div></section><section class="settings-card"><span class="settings-icon">✳</span><div class="eyebrow">ENVIO PARA O LLM</div><h3>Pronto para trabalhar com seu modelo</h3><p>O espaço cria prompts autossuficientes que podem ser copiados para o LLM de sua preferência. O chat de IA ao vivo ainda não está conectado nesta versão.</p><div class="integration-badge"><span class="status-dot"></span>${esc(providerStatus.message)}</div></section><section class="settings-card danger-card"><span class="settings-icon">⌫</span><div class="eyebrow">CONTROLE DE DADOS</div><h3>Limpar o espaço deste navegador</h3><p>Esta ação remove projetos e notas do navegador atual. Exporte um backup antes caso precise preservá-los.</p><button class="danger-button" data-action="clear-workspace">Excluir espaço local</button></section></div>
    <div class="settings-footnote"><strong>Limites do protótipo:</strong> orientação estruturada de descoberta, verificações de contradição baseadas em regras e montagem de prompts funcionam localmente. Entrevista semântica por IA, reescrita com modelo, sincronização em nuvem, autenticação e colaboração exigem backend e integração com LLM, ainda não incluídos nesta versão.</div>`;
}

function renderPage() {
  switch(page) {
    case 'new': return renderNew();
    case 'improve': return renderImprove();
    case 'interview': return renderInterview();
    case 'requirements': return renderRequisitos();
    case 'studio': return renderStudio();
    case 'context': return renderContext();
    case 'modules': return renderModules();
    case 'references': return renderReferences();
    case 'settings': return renderSettings();
    default: return renderDashboard();
  }
}

function saveInterviewAnswer() {
  const p=activeProject(); if(!p) return;
  const queue=getInterviewQueue(p); const q=queue[interviewIndex];
  if (!q) return;
  const answer = {id:q.id,value:$('#interview-answer')?.value||'',delegate:$('#delegate-answer')?.checked||false};
  const existing = p.answers.findIndex((item)=>item.id===q.id);
  if(existing >= 0) p.answers[existing] = answer; else p.answers.push(answer);
  touch(p);
}
function finishInterview() {
  saveInterviewAnswer(); const p=activeProject();
  const latestQueue=getInterviewQueue(p);
  if(interviewIndex < latestQueue.length-1) { interviewIndex++; setPage('interview'); return; }
  const previousRequirements=p.requirements||[]; const regenerated=buildRequirements(p); const custom=previousRequirements.filter(item=>item.source?.kind==='user-added'); p.requirements=[...regenerated,...custom.filter(item=>!regenerated.some(req=>req.id===item.id))]; if(previousRequirements.length) changeSpecification(p,'Respostas da descoberta alteradas e requisitos recompostos.'); else { p.specVersion=Math.max(1,p.specVersion||1); p.approved=false; p.approvedSpecVersion=null; p.prompts ||= {discovery:'',execution:''}; p.prompts.execution=''; } p.improvementAnalysis=p.workflowType==='improve'?buildImprovementAnalysis(p):null; p.prompts.discovery=buildDiscoveryPrompt(p); p.prompts.execution='';
  touch(p); setPage('requirements');
}
function downloadFile(name, content, type='text/markdown;charset=utf-8') {
  const blob=new Blob([content],{type}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); showToast('Copiado para a área de transferência.'); }
  catch { const ta=document.createElement('textarea'); ta.value=text; document.body.appendChild(ta); ta.select(); const ok=document.execCommand('copy'); ta.remove(); showToast(ok?'Copiado para a área de transferência.':'Não foi possível copiar. Selecione e copie o texto manualmente.'); }
}

function bindEvents() {
  $('#view')?.addEventListener('click', handleClick);
  $('#view')?.addEventListener('submit', handleSubmit);
  $('#view')?.addEventListener('change', handleChange);
  $('#view')?.addEventListener('input', handleInput);
  $$('[data-page]').forEach(el=>el.addEventListener('click', (e)=>{ e.preventDefault(); const next=el.dataset.page; if(next==='requirements'||next==='studio'||next==='context'){ if(!activeProject()){showToast('Abra ou crie um projeto primeiro.');return;} } setPage(next); }));
  $('#import-file')?.addEventListener('change', handleImport);
}

function handleClick(e) {
  const btn=e.target.closest('[data-action]'); if(!btn) return;
  const action=btn.dataset.action;
  if(action==='remove-improve-file') { window.improveFiles=(window.improveFiles||[]).filter((asset)=>asset.id!==btn.dataset.id); const list=$('#improve-asset-list'); if(list)list.innerHTML=(window.improveFiles||[]).map((asset)=>`<div class="asset-chip"><span>▤</span><span><strong>${esc(asset.name)}</strong><small>${asset.extracted?'Texto extraído':esc(asset.note)} · ${(asset.size/1024).toFixed(1)} KB</small></span></div>`).join('')||'<small class="asset-empty">Nenhum arquivo selecionado.</small>'; return; }
  if(action==='open-project') { state.activeProjectId=btn.dataset.id; persist(); interviewIndex=0; promptTab='discovery'; setPage('requirements'); return; }
  if(action==='delete-project') { const p=state.projects.find(x=>x.id===btn.dataset.id); if(!p)return; if(!confirm(`Excluir “${p.brief.title}” deste navegador?`))return; state.projects=state.projects.filter(x=>x.id!==p.id); if(state.activeProjectId===p.id)state.activeProjectId=null; persist(); render(); showToast('Projeto excluído.'); return; }
  if(action==='new-with-module') { window.newDraft={moduleId:btn.dataset.module}; setPage('new'); const sel=$('#project-module'); if(sel)sel.value=btn.dataset.module; return; }
  if(action==='jump-question') { saveInterviewAnswer(); interviewIndex=Number(btn.dataset.index); setPage('interview'); return; }
  if(action==='prev-question') { saveInterviewAnswer(); interviewIndex=Math.max(0,interviewIndex-1); setPage('interview'); return; }
  if(action==='next-question') { saveInterviewAnswer(); interviewIndex=Math.min(getInterviewQueue(activeProject()).length-1,interviewIndex+1); setPage('interview'); return; }
  if(action==='skip-question') { saveInterviewAnswer(); interviewIndex=Math.min(getInterviewQueue(activeProject()).length-1,interviewIndex+1); setPage('interview'); return; }
  if(action==='finish-interview') { finishInterview(); return; }
  if(action==='rebuild-requirements') { const p=activeProject(); if(!p)return; const prior=new Map((p.requirements||[]).map(r=>[r.id,r])); const generated=buildRequirements(p).map(r=>{const old=prior.get(r.id);return old?{...r,priority:old.priority||r.priority,classification:old.classification||r.classification,criteria:old.criteria||r.criteria,dependencies:old.dependencies?.length?old.dependencies:r.dependencies}:r;}); const custom=(p.requirements||[]).filter(r=>r.source?.kind==='user-added'&&!generated.some(item=>item.id===r.id)); p.requirements=[...generated,...custom]; changeSpecification(p,'Requisitos reconstruídos a partir das respostas.'); touch(p); render(); showToast('Requisitos reconstruídos; itens manuais foram preservados.'); return; }
  if(action==='resolve-conflict') { const p=activeProject(); if(!p)return; const conflict=scanContradictions(p).find(item=>item.id===btn.dataset.conflict); if(!conflict)return; const decision=window.prompt(`${conflict.title}\n\n${conflict.detail}\n\nRegistre a decisão ou encaminhamento adotado:`); if(!decision?.trim())return; p.resolutions ||= {}; p.resolutions[conflict.id]=decision.trim(); changeSpecification(p,'Decisão registrada para um alerta de consistência.'); touch(p); render(); showToast('Decisão registrada. A especificação precisa de nova aprovação.'); return; }
  if(action==='delete-requirement') { const p=activeProject(); if(!p)return; if(!confirm(`Excluir o requisito ${btn.dataset.id}?`))return; p.requirements=p.requirements.filter(r=>r.id!==btn.dataset.id); changeSpecification(p,`Requisito ${btn.dataset.id} excluído pelo usuário.`); touch(p); render(); showToast('Requisito removido. Aprove novamente a especificação.'); return; }
  if(action==='compare-version') { comparisonHistoryId=btn.dataset.id; render(); return; }
  if(action==='restore-prompt-version') { const p=activeProject(); const item=p?.promptHistory?.find(entry=>entry.id===btn.dataset.id); if(!item)return; if(item.specVersion!==(p.specVersion||1)){showToast('Esta versão pertence a outra versão da especificação. Compare-a, mas gere um novo prompt para o estado atual.');return;} if(item.type==='execution'&&!approved(p)){showToast('A especificação atual não possui aprovação vigente.');return;} if(!confirm('Restaurar esta versão do prompt no editor atual?'))return; p.prompts[item.type]=item.content; p.promptSpecVersions ||= {}; p.promptSpecVersions[item.type]=item.specVersion; promptTab=item.type; touch(p); render(); showToast('Versão restaurada no editor.'); return; }
  if(action==='approve-spec') { const p=activeProject(); if(!p)return; const conflicts=scanContradictions(p).filter((conflict)=>!conflict.resolved); if(conflicts.length && !confirm(`Há ${conflicts.length} alerta(s) sem decisão registrada. Deseja aprovar mesmo assim e manter os avisos no Prompt B?`))return; approveSpecification(p); p.prompts.execution=buildExecutionPrompt(p); p.promptSpecVersions ||= {}; p.promptSpecVersions.execution=p.specVersion||1; touch(p); promptTab='execution'; setPage('studio'); return; }
  if(action==='prompt-tab') { comparisonHistoryId=null; if(btn.dataset.tab==='execution'&&!approved(activeProject())){showToast('Aprove a especificação antes de abrir o prompt de execução.');return;} savePromptEditor(); promptTab=btn.dataset.tab; render(); return; }
  if(action==='regenerate-prompt') { comparisonHistoryId=null; const p=activeProject(); p.prompts[promptTab]=promptTab==='discovery'?buildDiscoveryPrompt(p):buildExecutionPrompt(p); p.promptSpecVersions ||= {}; p.promptSpecVersions[promptTab]=p.specVersion||1; touch(p); render(); showToast('Prompt regenerado com o contexto atual do projeto.'); return; }
  if(action==='copy-prompt') { const p=activeProject(); savePromptEditor(); copyText(p.prompts[promptTab]||''); return; }
  if(action==='download-prompt') { const p=activeProject(); savePromptEditor(); downloadFile(`${slug(p.brief.title)}-${promptTab}.md`,p.prompts[promptTab]||''); return; }
  if(action==='save-prompt-version') { const p=activeProject(); savePromptEditor(); p.promptHistory ||= []; p.promptHistory.unshift({id:uuid(),type:promptTab,content:p.prompts[promptTab],specVersion:p.specVersion||1,note:'Versão salva manualmente',createdAt:new Date().toISOString()}); touch(p); render(); showToast('Versão do prompt salva.'); return; }
  if(action==='apply-refinement') { const p=activeProject(); const note=$('#refinement-input')?.value.trim(); if(!note){showToast('Escreva primeiro uma direção de refinamento.');return;} p.promptHistory ||= []; const previous=p.prompts?.[promptTab]||''; if(previous) p.promptHistory.unshift({id:uuid(),type:promptTab,content:previous,specVersion:p.specVersion||1,note:'Versão anterior ao refinamento',createdAt:new Date().toISOString()}); p.refinements ||= []; p.refinements.push({id:uuid(),type:promptTab,note,createdAt:new Date().toISOString()}); p.prompts ||= {discovery:'',execution:''}; p.prompts[promptTab]=promptTab==='discovery'?buildDiscoveryPrompt(p):buildExecutionPrompt(p); p.promptSpecVersions ||= {}; p.promptSpecVersions[promptTab]=p.specVersion||1; comparisonHistoryId=null; touch(p); render(); showToast('Refinamento aplicado ao prompt. A especificação permanece separada.'); return; }
  if(action==='remove-refinement') { const p=activeProject(); const item=p.refinements[Number(btn.dataset.index)]; const itemType=typeof item==='string'?'execution':item.type; if(itemType!==promptTab){showToast('Abra a aba correspondente para remover esta direção.');return;} const previous=p.prompts?.[promptTab]||''; if(previous){p.promptHistory ||= [];p.promptHistory.unshift({id:uuid(),type:promptTab,content:previous,specVersion:p.specVersion||1,note:'Versão anterior à remoção de refinamento',createdAt:new Date().toISOString()});} p.refinements.splice(Number(btn.dataset.index),1); p.prompts[promptTab]=promptTab==='discovery'?buildDiscoveryPrompt(p):buildExecutionPrompt(p); p.promptSpecVersions ||= {}; p.promptSpecVersions[promptTab]=p.specVersion||1; touch(p); render(); showToast('Direção removida e prompt regenerado.'); return; }
  if(action==='toggle-pin-note') { const p=activeProject(); const n=p.context[Number(btn.dataset.index)]; n.pinned=!n.pinned; rebuildRequirementsPreservingUserItems(p); changeSpecification(p,'Prioridade de contexto alterada.'); touch(p); render(); return; }
  if(action==='delete-context-note') { const p=activeProject(); p.context.splice(Number(btn.dataset.index),1); rebuildRequirementsPreservingUserItems(p); changeSpecification(p,'Nota de contexto removida.'); touch(p); render(); return; }
  if(action==='module-filter') { moduleFilter=btn.dataset.filter; render(); return; }
  if(action==='copy-color') { copyText(btn.dataset.color); return; }
  if(action==='export-workspace') { downloadFile('prompt-bereshit-workspace.json',JSON.stringify(state,null,2),'application/json'); showToast('Backup do workspace exportado.'); return; }
  if(action==='import-workspace') { $('#import-file').click(); return; }
  if(action==='clear-workspace') { if(!confirm('Excluir todos os projetos e notas armazenados neste navegador? Essa ação não poderá ser desfeita.'))return; localStorage.removeItem(KEY); state={schemaVersion:2,projects:[],activeProjectId:null,globalNotes:[]}; page='dashboard'; render(); showToast('Espaço local limpo.'); return; }
}
function slug(v='project') { return v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'project'; }
function savePromptEditor() { const p=activeProject(); const editor=$('#prompt-editor'); if(p&&editor){p.prompts[promptTab]=editor.value; touch(p);} }
function handleSubmit(e) {
  if(e.target.id==='new-project-form') { e.preventDefault(); window.newDraft=null; createProject(e.target); return; }
  if(e.target.id==='improve-project-form') { e.preventDefault(); createImprovementProject(e.target); return; }
  if(e.target.id==='custom-requirement-form') { e.preventDefault(); const p=activeProject(); if(!p)return; const d=Object.fromEntries(new FormData(e.target).entries()); const id=`PB-CUSTOM-${uuid().slice(0,8).toUpperCase()}`; p.requirements.push({id,category:'Requisito manual',description:d.description,classification:d.classification,priority:d.priority,dependencies:[],source:{kind:'user-added',ref:'manual'},criteria:d.criteria,status:'active'}); changeSpecification(p,'Requisito manual adicionado.'); touch(p); render(); showToast('Requisito adicionado à especificação.'); return; }
  if(e.target.id==='context-form') { e.preventDefault(); const p=activeProject(); const d=Object.fromEntries(new FormData(e.target).entries()); p.context ||= []; p.context.push({id:uuid(),title:d.title,body:d.body,kind:d.kind||'note',source:d.source||'',pinned:d.pinned==='on',createdAt:new Date().toISOString()}); rebuildRequirementsPreservingUserItems(p); changeSpecification(p,'Contexto do projeto atualizado.'); touch(p); render(); showToast('Nota de contexto salva.'); }
}
function handleChange(e) {
  if(e.target.id==='improve-files') { readImprovementFiles(e.target.files); e.target.value=''; }
  if(e.target.matches('[data-priority-id]')) { const p=activeProject(); const r=p.requirements.find(x=>x.id===e.target.dataset.priorityId); if(r){r.priority=e.target.value; changeSpecification(p,`Prioridade de ${r.id} alterada.`); touch(p); showToast(`${r.id}: prioridade atualizada. Aprove novamente a especificação para atualizar o Prompt B.`);} }
  if(e.target.matches('[data-req-field]')) { const p=activeProject(); const r=p?.requirements.find(x=>x.id===e.target.dataset.reqId); if(r){const field=e.target.dataset.reqField; r[field]=field==='dependencies'?e.target.value.split(',').map((item)=>item.trim()).filter(Boolean):e.target.value; changeSpecification(p,`${r.id}: ${field} atualizado.`); touch(p); showToast('Requisito atualizado. A aprovação anterior foi invalidada.');} }
}
function handleInput(e) {
  if(e.target.id==='prompt-editor') { const p=activeProject(); if(p){p.prompts[promptTab]=e.target.value; touch(p);} const count=$('#prompt-char-count'); if(count)count.textContent=`${e.target.value.length.toLocaleString('pt-BR')} caracteres`; }
  if(e.target.id==='module-search') { moduleSearch=e.target.value; const pos=e.target.selectionStart; const view=$('#view'); const oldScroll=window.scrollY; view.innerHTML=renderModules(); const inp=$('#module-search'); inp.focus(); inp.setSelectionRange(pos,pos); window.scrollTo(0,oldScroll); }
}
function bindViewOnly() { $('#view')?.addEventListener('click',handleClick); $('#view')?.addEventListener('submit',handleSubmit); $('#view')?.addEventListener('change',handleChange); $('#view')?.addEventListener('input',handleInput); }
function handleImport(e) {
  const file=e.target.files?.[0]; if(!file)return;
  if(file.size > MAX_IMPORT_BYTES) { showToast('O arquivo ultrapassa o limite de 12 MB.'); e.target.value=''; return; }
  const reader=new FileReader();
  reader.onload=()=>{
    try {
      const raw=JSON.parse(String(reader.result||''));
      const incoming=validateImportPayload(raw,file.size);
      if(!confirm(`Importar ${incoming.projects.length} projeto(s)? Os projetos atuais serão preservados. IDs duplicados receberão novos identificadores.`)) return;
      state=mergeWorkspaces(state,incoming,uuid,getInterviewQueue);
      if(!state.activeProjectId && state.projects[0]) state.activeProjectId=state.projects[0].id;
      persist(); page='dashboard'; render(); showToast('Backup validado e importado.');
    } catch(err) { showToast(`Falha na importação: ${err.message}`); }
    finally { e.target.value=''; }
  };
  reader.onerror=()=>{ showToast('Não foi possível ler o arquivo de backup.'); e.target.value=''; };
  reader.readAsText(file);
}

render();
