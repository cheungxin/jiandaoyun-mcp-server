#!/usr/bin/env node
import 'dotenv/config';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { JianDaoYunClient } from './client.js';
import { FieldMatcher } from './field-matcher.js';
import { FormData } from './types.js';
import axios from 'axios';

const server = new Server(
  {
    name: 'jiandaoyun-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

let jdyClient: JianDaoYunClient | null = null;

// 应用缓存，避免重复API调用
let appListCache: any[] | null = null;
let appListCacheTime: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

// 环境变量将在运行时检查，支持MCP配置中的env字段
// 不再在启动时强制检查，允许通过MCP服务器配置传递环境变量

// 不再初始化全局客户端，将在每次调用时创建

/**
 * 获取应用列表（带缓存）
 */
async function getAppList(appKey: string): Promise<any[]> {
  const now = Date.now();
  if (appListCache && (now - appListCacheTime) < CACHE_DURATION) {
    return appListCache;
  }

  try {
    const response = await axios.post(
      `${process.env.JIANDAOYUN_BASE_URL || 'https://api.jiandaoyun.com'}/api/v5/app/list`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${appKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    // 简道云API返回格式通常是 { code: 0, data: [...] }
    const apps = response.data?.data || response.data || [];
    appListCache = Array.isArray(apps) ? apps : [];
    appListCacheTime = now;
    return appListCache;
  } catch (error) {
    console.error('Failed to fetch app list:', error);
    return [];
  }
}

/**
 * 智能解析表单ID - 自动判断输入的是应用ID还是表单ID
 */
async function resolveFormId(inputId: string, appKey: string): Promise<{ formId: string; appId?: string; suggestions?: string[] }> {
  // 如果输入看起来像表单ID（通常24位字符），直接返回
  if (inputId.length === 24 && /^[a-f0-9]{24}$/i.test(inputId)) {
    return { formId: inputId };
  }

  // 尝试作为应用ID处理
  const appList = await getAppList(appKey);
  const targetApp = appList.find(app => app.app_id === inputId);
  
  if (targetApp) {
    // 这是一个应用ID，需要获取其下的表单列表
    try {
      const response = await axios.post(
        `${process.env.JIANDAOYUN_BASE_URL || 'https://api.jiandaoyun.com'}/api/v1/app/${inputId}/entry/list`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${appKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const forms = response.data || [];
      if (forms.length === 0) {
        throw new Error(`应用 "${targetApp.name}" 下没有找到可用的表单`);
      }
      
      // 如果只有一个表单，直接返回
      if (forms.length === 1) {
        return { 
          formId: forms[0].entry_id || forms[0]._id,
          appId: inputId
        };
      }
      
      // 多个表单时，返回建议列表
      const suggestions = forms.map((form: any) => 
        `${form.name || '未命名表单'} (${form.entry_id || form._id})`
      );
      
      return {
        formId: forms[0].entry_id || forms[0]._id, // 默认返回第一个
        appId: inputId,
        suggestions
      };
    } catch (error) {
      throw new Error(`无法获取应用 "${targetApp.name}" 下的表单列表: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }
  
  // 既不是标准表单ID也不是已知应用ID，直接尝试使用
  return { formId: inputId };
}

/**
 * 智能字段匹配 - 将用户输入的字段名转换为后台字段名
 */
async function smartFieldMapping(formId: string, userData: any, appKey: string, appId?: string): Promise<any> {
  try {
    // 获取表单字段信息
    const response = await axios.post(
      `${process.env.JIANDAOYUN_BASE_URL || 'https://api.jiandaoyun.com'}/api/v5/app/entry/widget/list`,
      {
        app_id: appId,
        entry_id: formId
      },
      {
        headers: {
          'Authorization': `Bearer ${appKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    // API返回格式: {widgets: [...], sysWidgets: ...}
    const widgets = response.data?.widgets || [];
    const mappedData: any = {};
    
    // 为每个用户输入的字段找到对应的后台字段名
    for (const [userKey, value] of Object.entries(userData)) {
      let matchedField = null;
      
      // 1. 精确匹配label
      matchedField = widgets.find((w: any) => w.label === userKey);
      
      // 2. 如果没找到，尝试包含匹配
      if (!matchedField) {
        matchedField = widgets.find((w: any) => 
          w.label?.includes(userKey) || userKey.includes(w.label || '')
        );
      }
      
      // 3. 如果还没找到，尝试name匹配
      if (!matchedField) {
        matchedField = widgets.find((w: any) => w.name === userKey);
      }
      
      // 4. 常见字段名映射
      if (!matchedField) {
        const commonMappings: { [key: string]: string[] } = {
          '姓名': ['name', 'username', '用户名', '姓名'],
          '电话': ['phone', 'tel', 'mobile', '手机', '电话'],
          '邮箱': ['email', 'mail', '邮件', '邮箱'],
          '地址': ['address', '地址', '住址'],
          '备注': ['remark', 'note', 'comment', '备注', '说明']
        };
        
        for (const [cnName, enNames] of Object.entries(commonMappings)) {
          if (userKey === cnName || enNames.includes(userKey)) {
            matchedField = widgets.find((w: any) => 
              enNames.some(en => w.label?.includes(en) || w.name?.includes(en))
            );
            if (matchedField) break;
          }
        }
      }
      
      if (matchedField) {
        mappedData[matchedField.name] = value;
        console.log(`字段映射: "${userKey}" -> "${matchedField.name}" (${matchedField.label})`);
      } else {
        // 如果找不到匹配字段，保持原样
        mappedData[userKey] = value;
        console.log(`字段未映射: "${userKey}" 保持原样`);
      }
    }
    
    return {
      mappedData,
      fieldInfo: widgets.map((w: any) => ({
        name: w.name,
        label: w.label,
        type: w.type,
        required: w.required
      }))
    };
  } catch (error) {
    console.error('字段映射失败:', error);
    // 如果获取字段信息失败，返回原始数据
    return { mappedData: userData, fieldInfo: [] };
  }
}

/**
 * 增强的错误处理函数
 */
function createEnhancedError(error: any, context: string): McpError {
  let message = `${context}失败`;
  
  if (error.response?.status === 403) {
    message += ': 权限不足，请检查API密钥权限或表单ID是否正确';
  } else if (error.response?.status === 400) {
    const errorData = error.response.data;
    if (errorData?.msg === 'The form does not exist.') {
      message += ': 表单不存在，请检查表单ID是否正确';
    } else {
      message += `: ${errorData?.msg || '请求参数错误'}`;
    }
  } else if (error.response?.status === 404) {
    message += ': 资源不存在';
  } else {
    message += `: ${error.message || '未知错误'}`;
  }
  
  return new McpError(ErrorCode.InternalError, message);
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_form_fields',
        description: 'Get field definitions for a JianDaoYun form',
        inputSchema: {
          type: 'object',
          properties: {
            appId: {
              type: 'string',
              description: 'The JianDaoYun application ID',
            },
            appKey: {
              type: 'string',
              description: 'The JianDaoYun application key (API key) (can be provided via JIANDAOYUN_APP_KEY environment variable)',
            },
            formId: {
              type: 'string',
              description: 'The form ID to query fields for (can be form ID or app ID)',
            },
          },
          required: ['appId', 'formId'],
        },
      },
      {
        name: 'submit_form_data',
        description: 'Submit data to a JianDaoYun form with automatic field type matching',
        inputSchema: {
          type: 'object',
          properties: {
            appId: {
              type: 'string',
              description: 'The JianDaoYun application ID',
            },
            appKey: {
              type: 'string',
              description: 'The JianDaoYun application key (API key) (optional, will use JIANDAOYUN_APP_KEY from environment if not provided)',
            },
            formId: {
              type: 'string',
              description: 'The form ID to submit data to (can be form ID or app ID)',
            },
            data: {
              type: ['object', 'array'],
              description: 'The data to submit (single object or array for batch)',
            },
            autoMatch: {
              type: 'boolean',
              description: 'Whether to automatically match field types (default: true)',
              default: true,
            },
            transactionId: {
              type: 'string',
              description: 'Optional transaction ID for idempotent submissions',
            },
          },
          required: ['appId', 'formId', 'data'],
        },
      },
      {
        name: 'get_form_data',
        description: 'Get a specific data entry from a JianDaoYun form',
        inputSchema: {
          type: 'object',
          properties: {
            appId: {
              type: 'string',
              description: 'The JianDaoYun application ID',
            },
            appKey: {
              type: 'string',
              description: 'The JianDaoYun application key (API key) (optional, will use JIANDAOYUN_APP_KEY from environment if not provided)',
            },
            formId: {
              type: 'string',
              description: 'The form ID (can be form ID or app ID)',
            },
            dataId: {
              type: 'string',
              description: 'The data entry ID',
            },
          },
          required: ['appId', 'formId', 'dataId'],
        },
      },
      {
        name: 'query_form_data',
        description: 'Query multiple form data entries with filtering support',
        inputSchema: {
          type: 'object',
          properties: {
            appId: {
              type: 'string',
              description: 'The JianDaoYun application ID',
            },
            appKey: {
              type: 'string',
              description: 'The JianDaoYun application key (API key) (optional, will use JIANDAOYUN_APP_KEY from environment if not provided)',
            },
            formId: {
              type: 'string',
              description: 'The form ID (can be form ID or app ID)',
            },
            dataId: {
              type: 'string',
              description: 'Last data ID for pagination',
            },
            fields: {
              type: 'array',
              items: { type: 'string' },
              description: 'Fields to return (widget IDs)',
            },
            filter: {
              type: 'object',
              description: 'Data filter conditions',
              properties: {
                rel: {
                  type: 'string',
                  enum: ['and', 'or'],
                  description: 'Relation between conditions',
                },
                cond: {
                  type: 'array',
                  description: 'Filter conditions',
                  items: {
                    type: 'object',
                    properties: {
                      field: { type: 'string' },
                      type: { type: 'string' },
                      method: { type: 'string' },
                      value: {},
                    },
                    required: ['field', 'method'],
                  },
                },
              },
              required: ['rel', 'cond'],
            },
            limit: {
              type: 'number',
              description: 'Number of records to return (1-100, default: 10)',
              minimum: 1,
              maximum: 100,
            },
          },
          required: ['appId', 'formId'],
        },
      },
      {
        name: 'update_form_data',
        description: 'Update an existing form data entry',
        inputSchema: {
          type: 'object',
          properties: {
            appId: {
              type: 'string',
              description: 'The JianDaoYun application ID',
            },
            appKey: {
              type: 'string',
              description: 'The JianDaoYun application key (API key) (optional, will use JIANDAOYUN_APP_KEY from environment if not provided)',
            },
            formId: {
              type: 'string',
              description: 'The form ID (can be form ID or app ID)',
            },
            dataId: {
              type: 'string',
              description: 'The data entry ID to update',
            },
            data: {
              type: 'object',
              description: 'The data to update',
            },
            transactionId: {
              type: 'string',
              description: 'Optional transaction ID',
            },
            isStartTrigger: {
              type: 'boolean',
              description: 'Whether to trigger automation',
            },
          },
          required: ['appId', 'formId', 'dataId', 'data'],
        },
      },
      {
        name: 'delete_form_data',
        description: 'Delete one or more form data entries',
        inputSchema: {
          type: 'object',
          properties: {
            appId: {
              type: 'string',
              description: 'The JianDaoYun application ID',
            },
            appKey: {
              type: 'string',
              description: 'The JianDaoYun application key (API key) (optional, will use JIANDAOYUN_APP_KEY from environment if not provided)',
            },
            formId: {
              type: 'string',
              description: 'The form ID (can be form ID or app ID)',
            },
            dataIds: {
              type: ['string', 'array'],
              description: 'Data ID(s) to delete',
              items: { type: 'string' },
            },
            isStartTrigger: {
              type: 'boolean',
              description: 'Whether to trigger automation',
            },
          },
          required: ['appId', 'formId', 'dataIds'],
        },
      },
      {
        name: 'get_upload_token',
        description: 'Get file upload tokens for file/image fields',
        inputSchema: {
          type: 'object',
          properties: {
            appId: {
              type: 'string',
              description: 'The JianDaoYun application ID',
            },
            appKey: {
              type: 'string',
              description: 'The JianDaoYun application key (API key) (optional, will use JIANDAOYUN_APP_KEY from environment if not provided)',
            },
            formId: {
              type: 'string',
              description: 'The form ID (can be form ID or app ID)',
            },
            transactionId: {
              type: 'string',
              description: 'Transaction ID to bind uploads to',
            },
          },
          required: ['appId', 'formId', 'transactionId'],
        },
      },
      {
        name: 'list_apps_and_forms',
        description: 'List all available applications and their forms that the current API key can access',
        inputSchema: {
          type: 'object',
          properties: {
            appKey: {
              type: 'string',
              description: 'The JianDaoYun application key (API key) (optional, will use JIANDAOYUN_APP_KEY from environment if not provided)',
            },
            appId: {
              type: 'string',
              description: 'Optional: specific app ID to get forms for. If not provided, lists all apps.',
            },
          },
          required: [],
        },
      },
    ],
  };
});

/**
 * 获取参数默认值，appKey从环境变量获取，appId需要用户提供
 */
function getDefaultParams(args: any) {
  return {
    appId: args.appId,
    appKey: args.appKey || process.env.JIANDAOYUN_APP_KEY,
    baseUrl: process.env.JIANDAOYUN_BASE_URL
  };
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'get_form_fields': {
        const { formId } = args as { formId: string };
        const { appId, appKey, baseUrl } = getDefaultParams(args);
        
        // 验证必需参数
        if (!appKey) {
          throw new Error('appKey is required. Please set JIANDAOYUN_APP_KEY in MCP server configuration.');
        }
        if (!appId) {
          throw new Error('appId is required. Please provide it as parameter.');
        }
        
        try {
          // 创建客户端实例
          const jdyClient = new JianDaoYunClient({
            appId,
            appKey,
            baseUrl
          });
          
          const resolved = await resolveFormId(formId, appKey);
          const fields = await jdyClient.getFormFields(resolved.formId);
          
          let responseText = JSON.stringify(fields, null, 2);
          
          // 如果有多个表单建议，添加提示信息
          if (resolved.suggestions && resolved.suggestions.length > 1) {
            responseText = `// 注意: 检测到应用下有多个表单，当前使用第一个表单\n// 可用表单列表:\n${resolved.suggestions.map(s => `// - ${s}`).join('\n')}\n\n${responseText}`;
          }
          
          return {
            content: [
              {
                type: 'text',
                text: responseText,
              },
            ],
          };
        } catch (error) {
          throw createEnhancedError(error, '获取表单字段');
        }
      }

      case 'submit_form_data': {
        const { formId, data, autoMatch = true, transactionId } = args as {
          formId: string;
          data: FormData | FormData[];
          autoMatch?: boolean;
          transactionId?: string;
        };
        const { appId, appKey, baseUrl } = getDefaultParams(args);
        
        // 验证必需参数
        if (!appKey) {
          throw new Error('appKey is required. Please set JIANDAOYUN_APP_KEY in MCP server configuration.');
        }
        if (!appId) {
          throw new Error('appId is required. Please provide it as parameter.');
        }

        // 创建客户端实例
        const jdyClient = new JianDaoYunClient({
          appId,
          appKey,
          baseUrl
        });
        
        let resolved: any;
        let processedData = data;
        let fieldMappingInfo = null;
        let submitResult: any;
        let errorDetails: any = null;

        try {
          resolved = await resolveFormId(formId, appKey);
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error: true,
                  message: `表单ID解析失败: ${error instanceof Error ? error.message : String(error)}`,
                  formUsed: null,
                  appId: appId,
                  originalData: data,
                  processedData: null
                }, null, 2),
              },
            ],
          };
        }

        if (autoMatch) {
          try {
            // 使用智能字段映射
            if (Array.isArray(data)) {
              const mappedResults = [];
              for (const item of data) {
                const mappingResult = await smartFieldMapping(resolved.formId, item, appKey, resolved.appId || appId);
                mappedResults.push(mappingResult.mappedData);
                if (!fieldMappingInfo) fieldMappingInfo = mappingResult.fieldInfo;
              }
              processedData = mappedResults;
            } else {
              const mappingResult = await smartFieldMapping(resolved.formId, data, appKey, resolved.appId || appId);
              processedData = mappingResult.mappedData;
              fieldMappingInfo = mappingResult.fieldInfo;
            }
          } catch (error) {
            console.log('字段映射失败，使用原始数据:', error instanceof Error ? error.message : String(error));
          }
        }

        try {
          submitResult = await jdyClient.submitData({
            formId: resolved.formId,
            data: processedData,
            transactionId,
          });

          let message = `成功提交 ${Array.isArray(data) ? data.length : 1} 条记录`;
          if (resolved.suggestions && resolved.suggestions.length > 1) {
            message += `\n注意: 检测到应用下有多个表单，已使用第一个表单进行提交`;
          }

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  result: submitResult,
                  message,
                  formUsed: resolved.formId,
                  appId: resolved.appId || appId,
                  originalData: data,
                  processedData,
                  fieldMapping: fieldMappingInfo
                }, null, 2),
              },
            ],
          };
        } catch (error) {
          // 返回详细的错误信息而不是抛出错误
          errorDetails = {
            success: false,
            error: true,
            message: '提交表单数据失败',
            formUsed: resolved?.formId || null,
            appId: appId,
            originalData: data,
            processedData: processedData
          };

          if (error && typeof error === 'object' && 'response' in error && (error as any).response?.data) {
            // 简道云API错误
            const apiError = (error as any).response.data;
            errorDetails.apiError = {
              code: apiError.code,
              message: apiError.msg,
              details: apiError
            };
            errorDetails.message = `API错误 ${apiError.code}: ${apiError.msg}`;
            
            // 根据错误代码提供更详细的说明
            if (apiError.code === 3005) {
              errorDetails.suggestion = '请求参数无效，请检查表单ID、字段名称和数据格式是否正确';
            } else if (apiError.code === 3000) {
              errorDetails.suggestion = '表单不存在，请检查表单ID是否正确';
            } else if (apiError.code === 4000) {
              errorDetails.suggestion = '数据提交失败，请检查字段值是否符合表单要求';
            }
          } else if (error instanceof Error) {
            errorDetails.message = error.message;
          }

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(errorDetails, null, 2),
              },
            ],
          };
        }
      }

      case 'get_form_data': {
        const { formId, dataId } = args as { formId: string; dataId: string };
        const { appId, appKey, baseUrl } = getDefaultParams(args);
        
        // 验证必需参数
        if (!appKey) {
          throw new Error('appKey is required. Please set JIANDAOYUN_APP_KEY in MCP server configuration.');
        }
        if (!appId) {
          throw new Error('appId is required. Please provide it as parameter.');
        }
        
        try {
          // 创建客户端实例
          const jdyClient = new JianDaoYunClient({
            appId,
            appKey,
            baseUrl
          });
          
          const resolved = await resolveFormId(formId, appKey);
          const data = await jdyClient.getFormData(resolved.formId, dataId);
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  data,
                  formUsed: resolved.formId,
                  appId: resolved.appId || appId
                }, null, 2),
              },
            ],
          };
        } catch (error) {
          throw createEnhancedError(error, '获取表单数据');
        }
      }

      case 'query_form_data': {
        const { formId, dataId, fields, filter, limit } = args as {
          formId: string;
          dataId?: string;
          fields?: string[];
          filter?: any;
          limit?: number;
        };
        const { appId, appKey, baseUrl } = getDefaultParams(args);
        
        // 验证必需参数
        if (!appKey) {
          throw new Error('appKey is required. Please set JIANDAOYUN_APP_KEY in MCP server configuration.');
        }
        if (!appId) {
          throw new Error('appId is required. Please provide it as parameter.');
        }

        try {
          // 创建客户端实例
          const jdyClient = new JianDaoYunClient({
            appId,
            appKey,
            baseUrl
          });
          
          const resolved = await resolveFormId(formId, appKey);
          const result = await jdyClient.queryFormData({
            formId: resolved.formId,
            dataId,
            fields,
            filter,
            limit,
          });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  ...result,
                  formUsed: resolved.formId,
                  appId: resolved.appId || appId
                }, null, 2),
              },
            ],
          };
        } catch (error) {
          throw createEnhancedError(error, '查询表单数据');
        }
      }

      case 'update_form_data': {
        const { formId, dataId, data, transactionId, isStartTrigger } = args as {
          formId: string;
          dataId: string;
          data: FormData;
          transactionId?: string;
          isStartTrigger?: boolean;
        };
        const { appId, appKey, baseUrl } = getDefaultParams(args);
        
        // 验证必需参数
        if (!appKey) {
          throw new Error('appKey is required. Please set JIANDAOYUN_APP_KEY in MCP server configuration.');
        }
        if (!appId) {
          throw new Error('appId is required. Please provide it as parameter.');
        }

        try {
          // 创建客户端实例
          const jdyClient = new JianDaoYunClient({
            appId,
            appKey,
            baseUrl
          });
          
          const resolved = await resolveFormId(formId, appKey);
          const result = await jdyClient.updateFormData(resolved.formId, dataId, data, {
            transactionId,
            isStartTrigger,
          });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  result,
                  message: '数据更新成功',
                  formUsed: resolved.formId,
                  appId: resolved.appId || appId
                }, null, 2),
              },
            ],
          };
        } catch (error) {
          throw createEnhancedError(error, '更新表单数据');
        }
      }

      case 'delete_form_data': {
        const { formId, dataIds, isStartTrigger } = args as {
          formId: string;
          dataIds: string | string[];
          isStartTrigger?: boolean;
        };
        const { appId, appKey, baseUrl } = getDefaultParams(args);
        
        // 验证必需参数
        if (!appKey) {
          throw new Error('appKey is required. Please set JIANDAOYUN_APP_KEY in MCP server configuration.');
        }
        if (!appId) {
          throw new Error('appId is required. Please provide it as parameter.');
        }

        try {
          // 创建客户端实例
          const jdyClient = new JianDaoYunClient({
            appId,
            appKey,
            baseUrl
          });
          
          const resolved = await resolveFormId(formId, appKey);
          const result = await jdyClient.deleteFormData(resolved.formId, dataIds, {
            isStartTrigger,
          });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  result,
                  message: `成功删除 ${Array.isArray(dataIds) ? dataIds.length : 1} 条记录`,
                  formUsed: resolved.formId,
                  appId: resolved.appId || appId
                }, null, 2),
              },
            ],
          };
        } catch (error) {
          throw createEnhancedError(error, '删除表单数据');
        }
      }

      case 'get_upload_token': {
        const { formId, transactionId } = args as {
          formId: string;
          transactionId: string;
        };
        const { appId, appKey, baseUrl } = getDefaultParams(args);
        
        // 验证必需参数
        if (!appKey) {
          throw new Error('appKey is required. Please set JIANDAOYUN_APP_KEY in MCP server configuration.');
        }
        if (!appId) {
          throw new Error('appId is required. Please provide it as parameter.');
        }

        try {
          // 创建客户端实例
          const jdyClient = new JianDaoYunClient({
            appId,
            appKey,
            baseUrl
          });
          
          const resolved = await resolveFormId(formId, appKey);
          const result = await jdyClient.getUploadToken(resolved.formId, transactionId);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  result,
                  formUsed: resolved.formId,
                  appId: resolved.appId || appId
                }, null, 2),
              },
            ],
          };
        } catch (error) {
          throw createEnhancedError(error, '获取上传令牌');
        }
      }

      case 'list_apps_and_forms': {
        const { appId: specificAppId } = args as { appId?: string };
        const { appId, appKey, baseUrl } = getDefaultParams(args);
        
        // 验证必需参数
        if (!appKey) {
          throw new Error('appKey is required. Please set JIANDAOYUN_APP_KEY in MCP server configuration.');
        }
        
        try {
          const targetAppId = specificAppId || appId;
          if (targetAppId) {
            // 获取特定应用的表单列表
            const jdyClient = new JianDaoYunClient({
              appId: targetAppId,
              appKey,
              baseUrl
            });
            
            try {
              const response = await axios.post(
                `${baseUrl}/api/v1/app/${targetAppId}/entry/list`,
                {},
                {
                  headers: {
                    'Authorization': `Bearer ${appKey}`,
                    'Content-Type': 'application/json'
                  }
                }
              );
              
              const forms = response.data || [];
              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify({
                      appId: targetAppId,
                      forms: forms.map((form: any) => ({
                        id: form.entry_id || form._id,
                        name: form.name || '未命名表单',
                        description: form.description || '',
                        created_time: form.created_time,
                        updated_time: form.updated_time
                      })),
                      total: forms.length
                    }, null, 2),
                  },
                ],
              };
            } catch (error) {
              throw new Error(`无法获取应用 "${targetAppId}" 下的表单列表: ${error instanceof Error ? error.message : '未知错误'}`);
            }
          } else {
            // 获取所有应用列表
            const apps = await getAppList(appKey);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    apps: apps.map(app => ({
                      id: app.app_id,
                      name: app.name,
                      description: app.description || '',
                      created_time: app.created_time,
                      updated_time: app.updated_time
                    })),
                    total: apps.length,
                    message: '使用 list_apps_and_forms 工具并提供 appId 参数可以查看特定应用下的表单列表'
                  }, null, 2),
                },
              ],
            };
          }
        } catch (error) {
          throw createEnhancedError(error, '获取应用和表单列表');
        }
      }

      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${name}`
        );
    }
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    throw new McpError(
      ErrorCode.InternalError,
      `Tool execution failed: ${errorMessage}`
    );
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('JianDaoYun MCP server started');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
