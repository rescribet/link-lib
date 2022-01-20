export class ComponentCache<T> {
  private lookupCache: { [s: string]: T | null } = {};

  /**
   * Adds a renderer to {this.lookupCache}
   * @param component The render component.
   * @param key The memoization key.
   * @returns The renderer passed with {component}
   */
  public add(component: T | null, key: string): T | null {
    this.lookupCache[key] = component;

    return this.lookupCache[key];
  }

  public clear(): void {
    this.lookupCache = {};
  }

  /**
   * Resolves a renderer from the {lookupCache}.
   * @param key The key to look up.
   * @returns If saved the render component, otherwise undefined.
   */
  public get(key: string): T | null | undefined {
    return this.lookupCache[key];
  }
}
