/**
 * Provider contract for future server-side LLM adapters.
 * This file intentionally does not fake a provider or store credentials in the browser.
 */
export const PROVIDER_OPERATIONS = Object.freeze([
  'discover', 'extractRequirements', 'analyzeProject', 'draftSpecification', 'generatePrompt', 'refinePrompt', 'summarizeContext'
]);

export class ProviderNotConfiguredError extends Error {
  constructor(providerId = 'none') {
    super(`Nenhum provedor de IA está configurado para a operação solicitada (${providerId}).`);
    this.name = 'ProviderNotConfiguredError';
    this.code = 'PROVIDER_NOT_CONFIGURED';
  }
}

export function assertProviderContract(adapter) {
  if (!adapter || typeof adapter.id !== 'string' || !Array.isArray(adapter.operations)) throw new TypeError('Adaptador de IA inválido.');
  for (const operation of adapter.operations) {
    if (!PROVIDER_OPERATIONS.includes(operation) || typeof adapter[operation] !== 'function') throw new TypeError(`Operação de provedor inválida: ${operation}`);
  }
  return adapter;
}

export const providerStatus = Object.freeze({ mode:'local-only', configured:false, message:'A geração local está disponível. Nenhum provedor LLM está conectado.' });
