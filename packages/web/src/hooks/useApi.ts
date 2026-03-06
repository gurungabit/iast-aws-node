import { useQuery, useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { apiGet, apiPost, apiPatch, apiDelete } from '../services/api'

export function useApiQuery<T>(key: QueryKey, path: string, enabled = true) {
  return useQuery({
    queryKey: key,
    queryFn: () => apiGet<T>(path),
    enabled,
  })
}

export function useApiMutation<TData, TBody = unknown>(
  method: 'post' | 'patch' | 'delete',
  path: string | ((body: TBody) => string),
  invalidateKeys?: QueryKey[],
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (body: TBody) => {
      const url = typeof path === 'function' ? path(body) : path
      switch (method) {
        case 'post':
          return apiPost<TData>(url, body)
        case 'patch':
          return apiPatch<TData>(url, body)
        case 'delete':
          await apiDelete(url)
          return undefined as TData
      }
    },
    onSuccess: () => {
      invalidateKeys?.forEach((key) => queryClient.invalidateQueries({ queryKey: key }))
    },
  })
}
