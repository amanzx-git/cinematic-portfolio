// Retry with a fresh canvas: a canvas cannot switch graphics context types.
export async function selectRenderer(forceWebGL, create) {
  if (!forceWebGL) {
    try {
      return await create(false)
    } catch {
      return await create(true)
    }
  }
  return await create(true)
}
