import api from './api';

export interface Location {
  id: string;
  name: string;
  code?: string | null;
  entityId?: string;
}

export interface LocationCreateInput {
  organizationId: string;
  entityId: string;
  name: string;
  code?: string | null;
}

const locationService = {
  getByOrganization: async (organizationId: string): Promise<Location[]> => {
    const { data } = await api.get<{ data: { locations: Location[] } }>('/locations', {
      params: { organizationId },
    });
    return data.data?.locations ?? [];
  },

  getByEntity: async (organizationId: string, entityId: string): Promise<Location[]> => {
    const { data } = await api.get<{ data: { locations: Location[] } }>('/locations', {
      params: { organizationId, entityId },
    });
    return data.data?.locations ?? [];
  },

  create: async (input: LocationCreateInput): Promise<Location> => {
    const { data } = await api.post<{ data: { location: Location } }>('/locations', input);
    return data.data!.location;
  },
};

export default locationService;
