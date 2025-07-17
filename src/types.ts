export interface JianDaoYunConfig {
  appId: string;
  appKey: string;
  baseUrl?: string;
}

export interface FormField {
  key: string;
  name: string;
  type: string;
  required?: boolean;
  subForm?: {
    fields: FormField[];
  };
}

export interface FormData {
  [key: string]: any;
}

export interface SubmitDataOptions {
  formId: string;
  data: FormData | FormData[];
  transactionId?: string;
  dataCreator?: string;
  isStartWorkflow?: boolean;
  isStartTrigger?: boolean;
}

export interface QueryDataOptions {
  formId: string;
  dataId?: string;
  fields?: string[];
  filter?: DataFilter;
  limit?: number;
}

export interface DataFilter {
  rel: 'and' | 'or';
  cond: FilterCondition[];
}

export interface FilterCondition {
  field: string;
  type?: string;
  method: 'eq' | 'ne' | 'in' | 'nin' | 'range' | 'empty' | 'not_empty' | 'like' | 'verified' | 'unverified';
  value?: any;
}

export interface ApiResponse<T = any> {
  code: number;
  msg: string;
  data?: T;
}

export enum FieldType {
  TEXT = 'text',
  NUMBER = 'number',
  DATE = 'date',
  DATETIME = 'datetime',
  SELECT = 'select',
  MULTI_SELECT = 'multi_select',
  CHECKBOX = 'checkbox',
  RADIO = 'radio',
  USER = 'user',
  DEPT = 'dept',
  FILE = 'file',
  IMAGE = 'image',
  LOCATION = 'location',
  ADDRESS = 'address',
  SUBFORM = 'subform',
  FORMULA = 'formula',
  SERIAL_NO = 'serial_no',
  PHONE = 'phone'
}