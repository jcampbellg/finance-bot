class ClientCache {
  private cache: Record<string, any> = {}

  set(key: string, value: any) {
    this.cache[key] = value
  }
}

export const clientCache = new ClientCache()