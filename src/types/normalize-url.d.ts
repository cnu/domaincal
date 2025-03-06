declare module 'normalize-url' {
  interface Options {
    /**
     * Default: true
     */
    normalizeProtocol?: boolean;

    /**
     * Default: true
     */
    normalizeHttps?: boolean;

    /**
     * Default: true
     */
    normalizeHttp?: boolean;

    /**
     * Default: true
     */
    stripProtocol?: boolean;

    /**
     * Default: true
     */
    stripWWW?: boolean;

    /**
     * Default: true
     */
    removeQueryParameters?: boolean | RegExp | string[];

    /**
     * Default: true
     */
    removeTrailingSlash?: boolean;

    /**
     * Default: true
     */
    removeHash?: boolean;

    /**
     * Default: false
     */
    stripHash?: boolean;

    /**
     * Default: false
     */
    stripAuthentication?: boolean;

    /**
     * Default: true
     */
    removeExplicitPort?: boolean;

    /**
     * Default: false
     */
    sortQueryParameters?: boolean;
  }

  /**
   * Normalize a URL
   * @param url URL to normalize
   * @param options Options for normalization
   */
  function normalizeUrl(url: string, options?: Options): string;

  export = normalizeUrl;
}
