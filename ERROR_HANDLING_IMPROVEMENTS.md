# 错误处理和重试机制改进建议

## 当前存在的问题

1. **缺少统一的错误处理机制**
   - 错误处理不一致，有些抛出异常，有些返回错误对象
   - 缺少自定义错误类
   - 错误信息不够详细

2. **没有重试机制**
   - 网络请求失败直接报错
   - 没有区分临时性和永久性错误
   - 缺少指数退避算法

3. **日志记录不规范**
   - 使用 console.log/error 而非专业日志库
   - 缺少日志级别控制
   - 生产环境可能泄露敏感信息

## 改进方案

### 1. 实现自定义错误类

```typescript
// src/errors.ts
export class JiandaoyunError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public details?: any,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'JiandaoyunError';
  }
}

export class NetworkError extends JiandaoyunError {
  constructor(message: string, details?: any) {
    super(message, 'NETWORK_ERROR', 0, details, true);
  }
}

export class ApiError extends JiandaoyunError {
  constructor(message: string, statusCode: number, details?: any) {
    const retryable = statusCode >= 500 || statusCode === 429;
    super(message, 'API_ERROR', statusCode, details, retryable);
  }
}

export class ValidationError extends JiandaoyunError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', 400, details, false);
  }
}
```

### 2. 实现重试机制

```typescript
// src/retry.ts
interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  factor?: number;
  shouldRetry?: (error: any) => boolean;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    factor = 2,
    shouldRetry = (error) => error.retryable === true
  } = options;

  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries || !shouldRetry(error)) {
        throw error;
      }
      
      const delay = Math.min(
        initialDelay * Math.pow(factor, attempt),
        maxDelay
      );
      
      console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}
```

### 3. 改进 API 客户端

```typescript
// 在 src/client.ts 中添加重试支持
import { withRetry } from './retry';
import { NetworkError, ApiError } from './errors';

private async makeRequest<T>(config: AxiosRequestConfig): Promise<T> {
  return withRetry(async () => {
    try {
      const response = await this.axios.request<T>(config);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (!error.response) {
          throw new NetworkError(
            'Network connection failed',
            { originalError: error.message }
          );
        }
        
        const { status, data } = error.response;
        throw new ApiError(
          data?.msg || `API request failed with status ${status}`,
          status,
          { response: data }
        );
      }
      throw error;
    }
  });
}
```

### 4. 实现结构化日志

```typescript
// src/logger.ts
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

class Logger {
  private level: LogLevel;
  
  constructor() {
    this.level = process.env.NODE_ENV === 'production' 
      ? LogLevel.INFO 
      : LogLevel.DEBUG;
  }
  
  private log(level: LogLevel, message: string, context?: any) {
    if (level < this.level) return;
    
    const timestamp = new Date().toISOString();
    const levelName = LogLevel[level];
    
    const logEntry = {
      timestamp,
      level: levelName,
      message,
      ...(context && { context })
    };
    
    // 生产环境下过滤敏感信息
    if (process.env.NODE_ENV === 'production') {
      this.filterSensitiveData(logEntry);
    }
    
    console.log(JSON.stringify(logEntry));
  }
  
  private filterSensitiveData(obj: any) {
    const sensitiveKeys = ['password', 'token', 'key', 'secret'];
    
    for (const key in obj) {
      if (sensitiveKeys.some(k => key.toLowerCase().includes(k))) {
        obj[key] = '[REDACTED]';
      } else if (typeof obj[key] === 'object') {
        this.filterSensitiveData(obj[key]);
      }
    }
  }
  
  debug(message: string, context?: any) {
    this.log(LogLevel.DEBUG, message, context);
  }
  
  info(message: string, context?: any) {
    this.log(LogLevel.INFO, message, context);
  }
  
  warn(message: string, context?: any) {
    this.log(LogLevel.WARN, message, context);
  }
  
  error(message: string, context?: any) {
    this.log(LogLevel.ERROR, message, context);
  }
}

export const logger = new Logger();
```

### 5. 添加请求追踪

```typescript
// src/middleware.ts
import { randomUUID } from 'crypto';

export function addRequestId(config: AxiosRequestConfig): AxiosRequestConfig {
  const requestId = randomUUID();
  config.headers = {
    ...config.headers,
    'X-Request-ID': requestId
  };
  
  // 添加到日志上下文
  config.metadata = { requestId };
  
  return config;
}

// 在 axios 实例中使用
axios.interceptors.request.use(addRequestId);
```

### 6. 实现断路器模式

```typescript
// src/circuit-breaker.ts
export class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime?: number;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  constructor(
    private threshold: number = 5,
    private timeout: number = 60000
  ) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime! > this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }
  
  private onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
    }
  }
}
```

## 集成建议

1. **渐进式改进**
   - 先实现自定义错误类
   - 逐步替换现有的错误处理
   - 最后添加重试和断路器

2. **配置化**
   - 通过环境变量控制重试次数和延迟
   - 允许禁用重试机制（用于测试）

3. **监控集成**
   - 记录重试次数和成功率
   - 监控断路器状态
   - 设置告警阈值

4. **测试覆盖**
   - 为错误处理添加单元测试
   - 模拟网络故障场景
   - 验证重试逻辑

## 实施优先级

1. **高优先级**
   - 实现自定义错误类
   - 添加基本的重试机制
   - 替换 console.log 为结构化日志

2. **中优先级**
   - 实现请求追踪
   - 优化错误信息
   - 添加断路器

3. **低优先级**
   - 集成专业日志库
   - 添加性能监控
   - 实现分布式追踪