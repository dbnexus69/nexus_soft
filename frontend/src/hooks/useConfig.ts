import { useState, useCallback } from 'react';
import * as api from '../api';
import { normalizeRolePermissions, DEFAULT_ASESOR_PERMISSIONS, DEFAULT_FREELANCER_PERMISSIONS, RolePermissions } from '../types';
import { saveConfigCache, loadConfigCache, invalidateConfigCache } from '../utils/configCache';

export interface ConfigData {
  cards: any[];
  paymentMethods: any[];
  documentTypes: any[];
  airlines: any[];
  suppliers: any[];
  airports: any[];
  baggage: any[];
  packages: any[];
  rolePermissions: Record<string, RolePermissions>;
}

const emptyData = {
  config: {
    cards: [],
    paymentMethods: [],
    documentTypes: [],
    airlines: [],
    suppliers: [],
    airports: [],
    baggage: [],
    packages: [],
    rolePermissions: {
      asesor: DEFAULT_ASESOR_PERMISSIONS,
      freelancer: DEFAULT_FREELANCER_PERMISSIONS
    }
  } as ConfigData
};

export function useConfig() {
  const [config, setConfig] = useState(emptyData.config);
  const [loading, setLoading] = useState(false);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const [configAll, asesorPerms, freelancerPerms] = await Promise.all([
        api.getAllConfig().catch(() => ({})),
        api.getRolePermissions('asesor').catch(() => null),
        api.getRolePermissions('freelancer').catch(() => null),
      ]);

      const resolvedRolePermissions = {
        asesor: asesorPerms ? normalizeRolePermissions(asesorPerms) : emptyData.config.rolePermissions.asesor,
        freelancer: freelancerPerms ? normalizeRolePermissions(freelancerPerms) : emptyData.config.rolePermissions.freelancer,
      };

      if (configAll && Object.keys(configAll).length > 0) {
        saveConfigCache({
          cards: configAll.cards || [],
          paymentMethods: configAll['payment-methods'] || [],
          documentTypes: configAll['document-types'] || [],
          airlines: configAll.airlines || [],
          suppliers: configAll.suppliers || [],
          airports: configAll.airports || [],
          baggage: configAll.baggage || [],
          packages: configAll.packages || [],
          rolePermissions: resolvedRolePermissions
        });

        setConfig({
          cards: configAll.cards || [],
          paymentMethods: configAll['payment-methods'] || [],
          documentTypes: configAll['document-types'] || [],
          airlines: configAll.airlines || [],
          suppliers: configAll.suppliers || [],
          airports: configAll.airports || [],
          baggage: configAll.baggage || [],
          packages: configAll.packages || [],
          rolePermissions: resolvedRolePermissions
        });
      }
    } catch (err) {
      console.error("Error fetching config", err);
    } finally {
      setLoading(false);
    }
  }, []);

  
  const addConfigItem = async (section: string, item: Record<string, unknown>): Promise<Record<string, unknown>> => {
    const list = (config as any)[section] || [];
    const maxId = list.reduce((max: number, i: any) => {
      const idNum = Number(i.id);
      return !isNaN(idNum) && idNum > max ? idNum : max;
    }, 0);
    const tempId = maxId + 1;

    const optimisticItem = { id: tempId, ...item };

    setConfig(prev => {
      const nextConfig = {
        ...prev,
        [section]: [...(prev as any)[section], optimisticItem]
      };
      return nextConfig;
    });

    try {
      const created = await api.createConfigItem(section, item);
      setConfig(prev => {
        const nextConfig = {
          ...prev,
          [section]: (prev as any)[section].map((i: any) => i.id === tempId ? created : i)
        };
        return nextConfig;
      });
      return created;
    } catch (err) {
      setConfig(prev => {
        const nextConfig = {
          ...prev,
          [section]: (prev as any)[section].filter((i: any) => i.id !== tempId)
        };
        return nextConfig;
      });
      throw err;
    }
  };

  const updateConfigItem = async (section: string, id: number, itemUpdate: Record<string, unknown>) => {
    const originalItem = (config as any)[section].find((i: any) => i.id === id);

    setConfig(prev => {
      const nextConfig = {
        ...prev,
        [section]: (prev as any)[section].map((i: any) => i.id === id ? { ...i, ...itemUpdate } : i)
      };
      return nextConfig;
    });

    try {
      const updated = await api.updateConfigItem(section, id, itemUpdate);
      setConfig(prev => {
        const nextConfig = {
          ...prev,
          [section]: (prev as any)[section].map((i: any) => i.id === id ? (updated || { ...i, ...itemUpdate }) : i)
        };
        return nextConfig;
      });
    } catch (err) {
      setConfig(prev => {
        const nextConfig = {
          ...prev,
          [section]: (prev as any)[section].map((i: any) => i.id === id ? originalItem : i)
        };
        return nextConfig;
      });
      throw err;
    }
  };

  const deleteConfigItem = async (section: string, id: number) => {
    const originalList = (config as any)[section];

    setConfig(prev => {
      const nextConfig = {
        ...prev,
        [section]: (prev as any)[section].filter((i: any) => i.id !== id)
      };
      return nextConfig;
    });

    try {
      await api.deleteConfigItem(section, id);
    } catch (err) {
      setConfig(prev => {
        const nextConfig = {
          ...prev,
          [section]: originalList
        };
        return nextConfig;
      });
      throw err;
    }
  };

  return { config, setConfig, loading, fetchConfig, addConfigItem, updateConfigItem, deleteConfigItem };
}

