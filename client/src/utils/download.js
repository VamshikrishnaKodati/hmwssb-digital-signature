import api from './api'

export async function downloadFile(url, fallbackName, onSuccess) {
  const filename = await downloadExport(url, fallbackName)
  if (onSuccess) onSuccess(filename)
}

export async function downloadExport(url, fallbackName) {
  const res = await api.get(url, { responseType: 'blob' })
  const cd = res.headers['content-disposition'] || ''
  const match = cd.match(/filename="?([^";]+)"?/)
  const filename = match ? match[1] : fallbackName
  const objectUrl = window.URL.createObjectURL(new Blob([res.data]))
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(objectUrl)
  return filename
}
