import { supabase } from '../supabaseClient'

function extFromFile(file) {
  const parts = file.name.split('.')
  return parts.length > 1 ? parts.pop().toLowerCase() : 'jpg'
}

async function uploadAndGetPublicUrl(bucket, path, file) {
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: false,
    contentType: file.type || undefined,
  })
  if (error) throw new Error(error.message || 'Upload failed')
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data?.publicUrl || null
}

export async function uploadReviewPhoto(file, userId) {
  if (!file || !userId) return null
  const ext = extFromFile(file)
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  return uploadAndGetPublicUrl('review-photos', path, file)
}

export async function uploadToiletPhoto(file, userId) {
  if (!file || !userId) return null
  const ext = extFromFile(file)
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  return uploadAndGetPublicUrl('toilet-photos', path, file)
}
