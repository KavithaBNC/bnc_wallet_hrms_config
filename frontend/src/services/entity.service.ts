import api from './api';

export interface Entity {
  id: string;
  name: string;
  code?: string | null;
  isActive?: boolean;
}

export interface EntityCreateInput {
  organizationId: string;
  name: string;
  code?: string | null;
}

const entityService = {
  getByOrganization: async (organizationId: string): Promise<Entity[]> => {
    const { data } = await api.get<{ data: { entities: Entity[] } }>('/entities', {
      params: { organizationId },
    });
    return data.data?.entities ?? [];
  },

  create: async (input: EntityCreateInput): Promise<Entity> => {
    const { data } = await api.post<{ data: { entity: Entity } }>('/entities', input);
    return data.data!.entity;
  },

  update: async (id: string, input: { name?: string; code?: string | null; isActive?: boolean }): Promise<Entity> => {
    const { data } = await api.put<{ data: { entity: Entity } }>(`/entities/${id}`, input);
    return data.data!.entity;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/entities/${id}`);
  },
};

export default entityService;
