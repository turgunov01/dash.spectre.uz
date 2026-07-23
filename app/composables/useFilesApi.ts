import type { ApiItem, ApiList, AuthUser, FileUpload, Role } from '~/types/spectre'

/** A staff member as returned by GET /auth/users (publicUser + isActive). */
export interface Employee extends AuthUser {
  isActive: boolean
}

// §7 uploads, §2 employee creation, §6.10 backup.
export function useFilesApi() {
  const api = useApi()

  return {
    // multipart/form-data, field "file": image/jpeg|png|webp or application/pdf, ≤ 5 MB.
    upload: (file: File): Promise<FileUpload> => {
      const form = new FormData()
      form.append('file', file)
      return api<ApiItem<FileUpload>>('/files', { method: 'POST', body: form }).then(r => r.data)
    }
  }
}

export function useEmployeesApi() {
  const api = useApi()

  return {
    // GET /auth/users — ADMIN/OWNER only. Filter by role and/or active-only.
    list: (params?: { role?: Role, active?: boolean }): Promise<Employee[]> =>
      api<ApiList<Employee>>('/auth/users', {
        query: { role: params?.role, active: params?.active ? 'true' : undefined }
      }).then(r => r.data),

    // POST /auth/register — ADMIN/OWNER only.
    register: (body: { email: string, password: string, name?: string, role?: Role }) =>
      api<ApiItem<AuthUser>>('/auth/register', { method: 'POST', body }).then(r => r.data)
  }
}

export function useBackupApi() {
  const api = useApi()

  return {
    run: () => api('/admin/backup', { method: 'POST' })
  }
}
