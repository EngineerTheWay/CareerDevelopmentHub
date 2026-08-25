import { getClient } from '../../../app-gen-sdk/data';
import type { Interaction } from '../models/interaction-model';
import type { IOperationOptions } from '../../../app-gen-sdk/data/common/types';

const DATA_SOURCE_NAME = 'Interaction';

export class InteractionService {
  static async create(record: Omit<Interaction, 'id'>): Promise<Interaction> {
    const result = await getClient().createRecordAsync(DATA_SOURCE_NAME, record);
    if (!result.success) throw result.error;
    return result.data as Interaction;
  }

  static async update(
    id: string,
    changedFields: Partial<Omit<Interaction, 'id'>>
  ): Promise<Interaction> {
    const result = await getClient().updateRecordAsync(DATA_SOURCE_NAME, id, changedFields);
    if (!result.success) throw result.error;
    return result.data as Interaction;
  }

  static async delete(id: string): Promise<void> {
    const result = await getClient().deleteRecordAsync(DATA_SOURCE_NAME, id);
    if (!result.success) throw result.error;
  }

  static async get(id: string): Promise<Interaction> {
    const result = await getClient().retrieveRecordAsync(DATA_SOURCE_NAME, id);
    if (!result.success) throw result.error;
    return result.data as Interaction;
  }

  static async getAll(options?: IOperationOptions): Promise<Interaction[]> {
    const result = await getClient().retrieveMultipleRecordsAsync(DATA_SOURCE_NAME, options);
    if (!result.success) throw result.error;
    return result.data as Interaction[];
  }
}