/**
 * AstralTube v3 - Production Logger
 * Configurable logging system with different levels and production safety
 */

export class Logger {
  constructor(context = 'AstralTube') {
    this.context = context;
    this.isDevelopment = this.isExtensionDevelopment();
    this.isTest = false;
    this.logLevel = this.isDevelopment ? 'debug' : 'warn';
    
    // Log levels in order of severity
    this.levels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
  }

  isExtensionDevelopment() {
    try {
      // Check if this is an unpacked extension (development)
      const manifest = chrome?.runtime?.getManifest?.();
      return !manifest?.update_url; // No update_url = unpacked/development
    } catch (error) {
      return false;
    }
  }

  shouldLog(level) {
    if (this.isTest) {
      return level === 'error'; // Only log errors in tests
    }
    
    return this.levels[level] >= this.levels[this.logLevel];
  }

  formatMessage(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const prefix = `🌟 [${this.context}] ${timestamp} [${level.toUpperCase()}]`;
    
    if (data && Object.keys(data).length > 0) {
      return `${prefix} ${message} ${JSON.stringify(data)}`;
    }
    
    return `${prefix} ${message}`;
  }

  debug(message, data = {}) {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage('debug', message, data));
    }
  }

  info(message, data = {}) {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message, data));
    }
  }

  warn(message, data = {}) {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, data));
    }
  }

  error(message, error = null, data = {}) {
    if (this.shouldLog('error')) {
      const errorData = {
        ...data,
        ...(error && {
          name: error.name,
          message: error.message,
          stack: error.stack
        })
      };
      console.error(this.formatMessage('error', message, errorData));
    }
  }

  // Specialized logging methods
  performance(operation, duration, data = {}) {
    this.debug(`Performance: ${operation} completed in ${duration}ms`, data);
  }

  apiCall(method, url, duration = null, data = {}) {
    const logData = {
      method,
      url,
      ...(duration && { duration: `${duration}ms` }),
      ...data
    };
    this.debug('API Call', logData);
  }

  userAction(action, data = {}) {
    this.info(`User Action: ${action}`, data);
  }

  extensionEvent(event, data = {}) {
    this.info(`Extension Event: ${event}`, data);
  }

  // Create child logger with additional context
  child(childContext) {
    return new Logger(`${this.context}:${childContext}`);
  }

  // Create a timing function
  time(label) {
    const start = performance.now();
    return {
      end: (data = {}) => {
        const duration = performance.now() - start;
        this.performance(label, Math.round(duration), data);
        return duration;
      }
    };
  }
}

// Create default logger instances
export const logger = new Logger('AstralTube');
export const popupLogger = new Logger('Popup');
export const contentLogger = new Logger('Content');
export const backgroundLogger = new Logger('Background');
export const apiLogger = new Logger('API');

// Helper functions for common logging patterns
export const logAsyncOperation = async (operation, fn, context = 'Operation') => {
  const timer = logger.time(context);
  try {
    logger.debug(`Starting: ${operation}`);
    const result = await fn();
    timer.end({ status: 'success' });
    logger.debug(`Completed: ${operation}`);
    return result;
  } catch (error) {
    timer.end({ status: 'error' });
    logger.error(`Failed: ${operation}`, error);
    throw error;
  }
};

export const logPerformance = (operation, fn) => {
  const start = performance.now();
  try {
    const result = fn();
    const duration = performance.now() - start;
    logger.performance(operation, Math.round(duration));
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    logger.performance(operation, Math.round(duration), { error: true });
    throw error;
  }
};

// Export for backwards compatibility
export default logger;