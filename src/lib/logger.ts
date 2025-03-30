/**
 * Logger utility for consistent logging across the application
 * Provides different log levels and context-based logging
 */

// Check if we're in production environment
const isProd = process.env.NODE_ENV === 'production';

/**
 * Logger class with contextual formatting
 */
class Logger {
  private context: string;
  
  constructor(context: string) {
    this.context = context;
  }
  
  /**
   * Debug level logging - disabled in production
   */
  debug(message: string, ...args: unknown[]): void {
    if (!isProd) {
      console.debug(`[${this.context}] ${message}`, ...args);
    }
  }
  
  /**
   * Info level logging
   */
  info(message: string, ...args: unknown[]): void {
    console.info(`[${this.context}] ${message}`, ...args);
  }
  
  /**
   * Warning level logging
   */
  warn(message: string, ...args: unknown[]): void {
    console.warn(`[${this.context}] ${message}`, ...args);
  }
  
  /**
   * Error level logging
   */
  error(message: string, ...args: unknown[]): void {
    console.error(`[${this.context}] ${message}`, ...args);
  }
}

/**
 * Factory function to create logger instances with specific contexts
 */
export const createLogger = (context: string): Logger => {
  return new Logger(context);
};

// Default logger with generic App context
export const logger = new Logger('App');

export default logger;
