import { getFormSchema as getShared, getFormSchemas as getSharedAll, publicSchema } from '@groove/extraction';

export function getFormSchemas() {
  return getSharedAll();
}

export function getFormSchema(id) {
  return getShared(id);
}

export { publicSchema };
