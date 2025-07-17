import { FormField, FormData, FieldType } from './types.js';

export class FieldMatcher {
  private fields: Map<string, FormField>;
  private fieldsByName: Map<string, FormField>;

  constructor(fields: FormField[]) {
    this.fields = new Map();
    this.fieldsByName = new Map();
    
    this.buildFieldMaps(fields);
  }

  private buildFieldMaps(fields: FormField[], prefix = '') {
    for (const field of fields) {
      const fullKey = prefix ? `${prefix}.${field.key}` : field.key;
      this.fields.set(fullKey, field);
      this.fields.set(field.key, field);
      
      const nameLower = field.name.toLowerCase();
      this.fieldsByName.set(nameLower, field);
      
      if (field.subForm) {
        this.buildFieldMaps(field.subForm.fields, fullKey);
      }
    }
  }

  matchAndConvert(data: FormData): FormData {
    const result: FormData = {};

    for (const [inputKey, value] of Object.entries(data)) {
      const field = this.findField(inputKey);
      
      if (!field) {
        console.warn(`No matching field found for key: ${inputKey}`);
        result[inputKey] = value;
        continue;
      }

      const convertedValue = this.convertValue(value, field);
      result[field.key] = convertedValue;
    }

    return result;
  }

  private findField(key: string): FormField | undefined {
    if (this.fields.has(key)) {
      return this.fields.get(key);
    }

    const keyLower = key.toLowerCase();
    const keyNormalized = keyLower.replace(/[_\-\s]/g, '');
    
    for (const [fieldKey, field] of this.fields) {
      const fieldKeyNormalized = fieldKey.toLowerCase().replace(/[_\-\s]/g, '');
      if (fieldKeyNormalized === keyNormalized) {
        return field;
      }
    }

    for (const [fieldName, field] of this.fieldsByName) {
      const fieldNameNormalized = fieldName.replace(/[_\-\s]/g, '');
      if (fieldNameNormalized === keyNormalized) {
        return field;
      }
    }

    return undefined;
  }

  private convertValue(value: any, field: FormField): any {
    if (value === null || value === undefined) {
      return value;
    }

    switch (field.type) {
      case FieldType.TEXT:
      case FieldType.SELECT:
      case FieldType.RADIO:
        return String(value);

      case FieldType.NUMBER:
        if (typeof value === 'string') {
          const num = parseFloat(value);
          return isNaN(num) ? 0 : num;
        }
        return Number(value);

      case FieldType.DATE:
      case FieldType.DATETIME:
        if (value instanceof Date) {
          return value.toISOString();
        }
        if (typeof value === 'string') {
          const date = new Date(value);
          return isNaN(date.getTime()) ? null : date.toISOString();
        }
        return null;

      case FieldType.CHECKBOX:
        if (typeof value === 'boolean') {
          return value;
        }
        if (typeof value === 'string') {
          return value.toLowerCase() === 'true' || value === '1';
        }
        return Boolean(value);

      case FieldType.MULTI_SELECT:
        if (Array.isArray(value)) {
          return value.map(v => String(v));
        }
        if (typeof value === 'string') {
          return value.split(',').map(v => v.trim()).filter(v => v);
        }
        return [String(value)];

      case FieldType.USER:
      case FieldType.DEPT:
        if (Array.isArray(value)) {
          return value;
        }
        if (typeof value === 'string' && value.includes(',')) {
          return value.split(',').map(v => v.trim());
        }
        return [value];

      case FieldType.FILE:
      case FieldType.IMAGE:
        if (Array.isArray(value)) {
          return value.map(v => this.normalizeFileValue(v));
        }
        return [this.normalizeFileValue(value)];

      case FieldType.LOCATION:
        if (typeof value === 'object' && value !== null) {
          return {
            address: value.address || '',
            lat: parseFloat(value.lat || value.latitude || 0),
            lng: parseFloat(value.lng || value.longitude || 0)
          };
        }
        if (typeof value === 'string') {
          const parts = value.split(',');
          if (parts.length >= 2) {
            return {
              address: parts[0].trim(),
              lat: parseFloat(parts[1]) || 0,
              lng: parseFloat(parts[2] || '0') || 0
            };
          }
        }
        return { address: String(value), lat: 0, lng: 0 };

      case FieldType.ADDRESS:
        if (typeof value === 'object' && value !== null) {
          return value;
        }
        return { province: '', city: '', district: '', detail: String(value) };

      case FieldType.PHONE:
        if (typeof value === 'object' && value !== null && value.phone) {
          return value;
        }
        return { phone: String(value) };

      case FieldType.SUBFORM:
        if (!Array.isArray(value)) {
          return [];
        }
        if (field.subForm) {
          const subMatcher = new FieldMatcher(field.subForm.fields);
          return value.map(item => subMatcher.matchAndConvert(item));
        }
        return value;

      default:
        return value;
    }
  }

  private normalizeFileValue(value: any): any {
    if (typeof value === 'string') {
      if (value.startsWith('http://') || value.startsWith('https://')) {
        return { url: value };
      }
      return { name: value };
    }
    if (typeof value === 'object' && value !== null) {
      return value;
    }
    return { name: String(value) };
  }
}