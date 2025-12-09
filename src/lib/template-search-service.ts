import { n8nTemplatesService, N8NTemplate } from './n8n-templates';

export interface TemplateSearchRequest {
  query: string;
  category?: string;
  limit?: number;
}

export interface TemplateSearchResponse {
  templates: N8NTemplate[];
  totalResults: number;
  searchQuery: string;
  suggestedCategories?: string[];
}

export async function searchTemplatesForAstra(
  request: TemplateSearchRequest
): Promise<TemplateSearchResponse> {
  try {
    const result = await n8nTemplatesService.searchTemplates({
      query: request.query,
      category: request.category,
      limit: request.limit || 6,
    });

    return {
      templates: result.workflows,
      totalResults: result.totalWorkflows,
      searchQuery: request.query,
    };
  } catch (error) {
    console.error('Error searching templates for Astra:', error);
    return {
      templates: [],
      totalResults: 0,
      searchQuery: request.query,
    };
  }
}

export function detectTemplateIntent(message: string): {
  isTemplateQuery: boolean;
  searchQuery?: string;
  category?: string;
} {
  const lowerMessage = message.toLowerCase();

  const templateKeywords = [
    'find template',
    'show template',
    'search template',
    'workflow for',
    'automation for',
    'templates for',
    'workflows that',
    'find workflow',
    'show workflow',
    'need a workflow',
    'looking for workflow',
    'looking for template',
  ];

  const isTemplateQuery = templateKeywords.some(keyword =>
    lowerMessage.includes(keyword)
  );

  if (!isTemplateQuery) {
    return { isTemplateQuery: false };
  }

  const categoryMap: Record<string, string> = {
    'ai': 'AI',
    'artificial intelligence': 'AI',
    'chatbot': 'AI',
    'document': 'Document Ops',
    'pdf': 'Document Ops',
    'file': 'Document Ops',
    'it ops': 'IT Ops',
    'devops': 'IT Ops',
    'monitoring': 'IT Ops',
    'marketing': 'Marketing',
    'social media': 'Marketing',
    'content': 'Marketing',
    'sales': 'Sales',
    'crm': 'Sales',
    'lead': 'Sales',
    'support': 'Support',
    'customer service': 'Support',
    'help desk': 'Support',
  };

  let detectedCategory: string | undefined;
  for (const [keyword, category] of Object.entries(categoryMap)) {
    if (lowerMessage.includes(keyword)) {
      detectedCategory = category;
      break;
    }
  }

  let searchQuery = message;
  templateKeywords.forEach(keyword => {
    const regex = new RegExp(keyword, 'gi');
    searchQuery = searchQuery.replace(regex, '').trim();
  });

  searchQuery = searchQuery
    .replace(/^(for|with|using|that|about)\s+/i, '')
    .trim();

  return {
    isTemplateQuery: true,
    searchQuery: searchQuery || message,
    category: detectedCategory,
  };
}

export function getTemplateSuggestions(context?: string): string[] {
  const suggestions = [
    'Find templates for Slack notifications',
    'Show me AI chatbot workflows',
    'Search templates for email automation',
    'Find workflows for CRM integration',
    'Show templates for Google Drive sync',
    'Find workflows for social media posting',
    'Search templates for data processing',
    'Show me document automation workflows',
  ];

  return suggestions.slice(0, 4);
}
