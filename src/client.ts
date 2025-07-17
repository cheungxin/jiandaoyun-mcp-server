import axios, { AxiosInstance } from 'axios';
import { 
  JianDaoYunConfig, 
  FormField, 
  FormData, 
  SubmitDataOptions, 
  ApiResponse,
  QueryDataOptions,
  FilterCondition
} from './types.js';

export class JianDaoYunClient {
  private config: JianDaoYunConfig;
  private axios: AxiosInstance;

  constructor(config: JianDaoYunConfig) {
    this.config = {
      ...config,
      baseUrl: config.baseUrl || 'https://api.jiandaoyun.com/api'
    };

    this.axios = axios.create({
      baseURL: this.config.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.appKey}`
      }
    });
  }

  async getFormFields(formId: string): Promise<FormField[]> {
    try {
      const response = await this.axios.post<ApiResponse<{ widgets: any[] }>>('/v5/app/entry/widget/list', {
        app_id: this.config.appId,
        entry_id: formId
      });

      // 检查是否有错误响应格式
      if (response.data.code !== undefined && response.data.code !== 0) {
        throw new Error(`Failed to get form fields: ${response.data.msg}`);
      }

      // API返回格式: {widgets: [...], sysWidgets: ...}
      const widgets = (response.data as any).widgets || [];
      return this.transformFields(Array.isArray(widgets) ? widgets : []);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`API request failed: ${error.response?.data?.msg || error.message}`);
      }
      throw error;
    }
  }

  private transformFields(widgets: any[]): FormField[] {
    return widgets.map(widget => {
      const field: FormField = {
        key: widget.name,
        name: widget.label,
        type: this.mapFieldType(widget.type),
        required: widget.required || false
      };

      if (widget.type === 'subform' && widget.items) {
        field.subForm = {
          fields: this.transformFields(widget.items)
        };
      }

      return field;
    });
  }

  private mapFieldType(apiType: string): string {
    const typeMap: { [key: string]: string } = {
      'text': 'text',
      'textarea': 'text',
      'number': 'number',
      'date': 'date',
      'datetime': 'datetime',
      'sn': 'serial_no',
      'address': 'address',
      'location': 'location',
      'image': 'image',
      'file': 'file',
      'single_select': 'select',
      'multiple_select': 'multi_select',
      'checkbox': 'checkbox',
      'radio': 'radio',
      'user': 'user',
      'dept': 'dept',
      'subform': 'subform',
      'formula': 'formula',
      'phone': 'phone'
    };

    return typeMap[apiType] || 'text';
  }

  async submitData(options: SubmitDataOptions): Promise<any> {
    try {
      const dataArray = Array.isArray(options.data) ? options.data : [options.data];
      
      if (dataArray.length > 100) {
        throw new Error('Batch submission limit is 100 records');
      }

      const isBatch = dataArray.length > 1;
      const endpoint = isBatch ? '/v5/app/entry/data/batch_create' : '/v5/app/entry/data/create';

      const requestData: any = {
        app_id: this.config.appId,
        entry_id: options.formId
      };

      if (isBatch) {
        requestData.data_list = dataArray.map(record => this.formatDataForSubmission(record));
      } else {
        requestData.data = this.formatDataForSubmission(dataArray[0]);
      }

      if (options.transactionId) {
        requestData.transaction_id = options.transactionId;
      }

      if (options.dataCreator) {
        requestData.data_creator = options.dataCreator;
      }

      if (options.isStartWorkflow !== undefined) {
        requestData.is_start_workflow = options.isStartWorkflow;
      }

      if (options.isStartTrigger !== undefined) {
        requestData.is_start_trigger = options.isStartTrigger;
      }

      console.log('提交请求数据:', JSON.stringify(requestData, null, 2));
      const response = await this.axios.post<ApiResponse>(endpoint, requestData);
      console.log('API响应:', JSON.stringify(response.data, null, 2));

      if (response.data.code !== undefined && response.data.code !== 0) {
        // 创建包含详细错误信息的错误对象
        const error = new Error(`Failed to submit data: ${response.data.msg || 'Unknown error'}`);
        (error as any).response = { data: response.data };
        throw error;
      }

      return response.data.data || response.data;
    } catch (error) {
      console.error('submitData错误详情:', error);
      if (axios.isAxiosError(error)) {
        console.error('Axios错误响应:', error.response?.data);
        // 创建包含详细错误信息的错误对象，但不重新抛出
        const enhancedError = new Error(`API request failed: ${error.response?.data?.msg || error.message}`);
        (enhancedError as any).response = error.response;
        throw enhancedError;
      }
      throw error;
    }
  }

  private formatDataForSubmission(data: FormData): any {
    const formatted: any = {};

    for (const [key, value] of Object.entries(data)) {
      if (value === null || value === undefined) {
        continue;
      }

      // 如果已经是正确的 {value: ...} 格式，直接使用
      if (typeof value === 'object' && !Array.isArray(value) && value.hasOwnProperty('value')) {
        formatted[key] = value;
        continue;
      }

      // 处理子表单数组（数组中的每个元素都是对象）
      if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
        formatted[key] = {
          value: value.map(item => this.formatDataForSubmission(item))
        };
        continue;
      }

      // 处理复杂对象（如地址、定位等）
      if (typeof value === 'object' && !Array.isArray(value)) {
        formatted[key] = { value };
        continue;
      }

      // 处理基本类型（字符串、数字、布尔值、简单数组等）
      formatted[key] = { value: this.formatValue(value) };
    }

    return formatted;
  }

  private formatValue(value: any): any {
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
      return value.map(item => this.formatDataForSubmission(item));
    }
    return value;
  }

  async getFormData(formId: string, dataId: string): Promise<any> {
    try {
      const response = await this.axios.post<ApiResponse>('/v5/app/entry/data/get', {
        app_id: this.config.appId,
        entry_id: formId,
        data_id: dataId
      });

      if (response.data.code !== 0) {
        throw new Error(`Failed to get form data: ${response.data.msg}`);
      }

      return response.data.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`API request failed: ${error.response?.data?.msg || error.message}`);
      }
      throw error;
    }
  }

  async queryFormData(options: QueryDataOptions): Promise<any> {
    try {
      const requestData: any = {
        app_id: this.config.appId,
        entry_id: options.formId,
        limit: options.limit || 10
      };

      if (options.dataId) {
        requestData.data_id = options.dataId;
      }

      if (options.fields && options.fields.length > 0) {
        requestData.fields = options.fields;
      }

      if (options.filter) {
        requestData.filter = options.filter;
      }

      const response = await this.axios.post<ApiResponse>('/v5/app/entry/data/list', requestData);

      if (response.data.code !== 0) {
        throw new Error(`Failed to query form data: ${response.data.msg}`);
      }

      return response.data.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`API request failed: ${error.response?.data?.msg || error.message}`);
      }
      throw error;
    }
  }

  async updateFormData(formId: string, dataId: string, data: FormData, options?: { transactionId?: string; isStartTrigger?: boolean }): Promise<any> {
    try {
      const requestData: any = {
        app_id: this.config.appId,
        entry_id: formId,
        data_id: dataId,
        data: this.formatDataForSubmission(data)
      };

      if (options?.transactionId) {
        requestData.transaction_id = options.transactionId;
      }

      if (options?.isStartTrigger !== undefined) {
        requestData.is_start_trigger = options.isStartTrigger;
      }

      const response = await this.axios.post<ApiResponse>('/v5/app/entry/data/update', requestData);

      if (response.data.code !== 0) {
        throw new Error(`Failed to update form data: ${response.data.msg}`);
      }

      return response.data.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`API request failed: ${error.response?.data?.msg || error.message}`);
      }
      throw error;
    }
  }

  async deleteFormData(formId: string, dataId: string | string[], options?: { isStartTrigger?: boolean }): Promise<any> {
    try {
      const isMultiple = Array.isArray(dataId);
      const endpoint = isMultiple ? '/v5/app/entry/data/batch_delete' : '/v5/app/entry/data/delete';
      
      const requestData: any = {
        app_id: this.config.appId,
        entry_id: formId
      };

      if (isMultiple) {
        requestData.data_ids = dataId;
      } else {
        requestData.data_id = dataId;
      }

      if (options?.isStartTrigger !== undefined) {
        requestData.is_start_trigger = options.isStartTrigger;
      }

      const response = await this.axios.post<ApiResponse>(endpoint, requestData);

      if (response.data.code !== 0) {
        throw new Error(`Failed to delete form data: ${response.data.msg}`);
      }

      return response.data.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`API request failed: ${error.response?.data?.msg || error.message}`);
      }
      throw error;
    }
  }

  async getUploadToken(formId: string, transactionId: string): Promise<any> {
    try {
      const response = await this.axios.post<ApiResponse>('/v5/app/entry/file/get_upload_token', {
        app_id: this.config.appId,
        entry_id: formId,
        transaction_id: transactionId
      });

      if (response.data.code !== 0) {
        throw new Error(`Failed to get upload token: ${response.data.msg}`);
      }

      return response.data.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`API request failed: ${error.response?.data?.msg || error.message}`);
      }
      throw error;
    }
  }
}