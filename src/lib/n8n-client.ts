import { supabase } from './supabase';

export interface N8NWorkflow {
  id: string;
  name: string;
  active: boolean;
  nodes: N8NNode[];
  connections: Record<string, any>;
  settings?: Record<string, any>;
  staticData?: Record<string, any>;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface N8NNode {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: [number, number];
  parameters: Record<string, any>;
}

export interface N8NExecution {
  id: string;
  workflowId: string;
  finished: boolean;
  mode: string;
  startedAt: string;
  stoppedAt?: string;
  status: 'success' | 'error' | 'running' | 'waiting';
}

class N8NClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = import.meta.env.VITE_N8N_URL || '';
    this.apiKey = import.meta.env.VITE_N8N_API_KEY || '';
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}/api/v1${endpoint}`;

    const headers = {
      'X-N8N-API-KEY': this.apiKey,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`N8N API Error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  async getWorkflows(): Promise<N8NWorkflow[]> {
    const data = await this.makeRequest('/workflows');
    return data.data || [];
  }

  async getWorkflow(workflowId: string): Promise<N8NWorkflow> {
    return await this.makeRequest(`/workflows/${workflowId}`);
  }

  async createWorkflow(workflow: Partial<N8NWorkflow>): Promise<N8NWorkflow> {
    return await this.makeRequest('/workflows', {
      method: 'POST',
      body: JSON.stringify(workflow),
    });
  }

  async updateWorkflow(workflowId: string, workflow: Partial<N8NWorkflow>): Promise<N8NWorkflow> {
    return await this.makeRequest(`/workflows/${workflowId}`, {
      method: 'PUT',
      body: JSON.stringify(workflow),
    });
  }

  async deleteWorkflow(workflowId: string): Promise<void> {
    await this.makeRequest(`/workflows/${workflowId}`, {
      method: 'DELETE',
    });
  }

  async activateWorkflow(workflowId: string): Promise<N8NWorkflow> {
    return await this.updateWorkflow(workflowId, { active: true });
  }

  async deactivateWorkflow(workflowId: string): Promise<N8NWorkflow> {
    return await this.updateWorkflow(workflowId, { active: false });
  }

  async executeWorkflow(workflowId: string, data?: any): Promise<N8NExecution> {
    return await this.makeRequest(`/workflows/${workflowId}/execute`, {
      method: 'POST',
      body: JSON.stringify({ data }),
    });
  }

  async getExecutions(workflowId?: string): Promise<N8NExecution[]> {
    const endpoint = workflowId
      ? `/executions?workflowId=${workflowId}`
      : '/executions';
    const data = await this.makeRequest(endpoint);
    return data.data || [];
  }

  async getExecution(executionId: string): Promise<N8NExecution> {
    return await this.makeRequest(`/executions/${executionId}`);
  }
}

export const n8nClient = new N8NClient();

// Helper function to check if user has access to N8N features
export async function checkN8NAccess(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return false;

  // Check database for N8N access
  const { data: accessRecord } = await supabase
    .from('n8n_user_access')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_enabled', true)
    .maybeSingle();

  return !!accessRecord;
}

// Helper function to get user's N8N workflows from our database
export async function getUserN8NWorkflows() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('n8n_workflows')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Helper function to save workflow metadata to our database
export async function saveWorkflowMetadata(workflowId: string, name: string, description?: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('n8n_workflows')
    .upsert({
      n8n_workflow_id: workflowId,
      user_id: user.id,
      team_id: user.user_metadata?.team_id,
      name,
      description,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
