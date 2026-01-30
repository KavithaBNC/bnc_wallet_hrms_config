import api from './api';

export interface Entity {
  id: string;
  name: string;
  code?: string | null;
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
};

export default entityService;
