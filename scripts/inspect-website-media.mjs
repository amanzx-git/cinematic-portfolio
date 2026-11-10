// Read MP4 metadata locally without decoding or changing the delivered media.
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

function boxes(buffer, start = 0, end = buffer.length) {
  const result = []
  for (let at = start; at + 8 <= end;) {
    let size = buffer.readUInt32BE(at), header = 8
    const type = buffer.toString('ascii', at + 4, at + 8)
    if (size === 1) { size = Number(buffer.readBigUInt64BE(at + 8)); header = 16 }
    if (size === 0) size = end - at
    if (size < header || at + size > end) throw Error(`Invalid MP4 box ${type}`)
    result.push({ type, start: at + header, end: at + size, offset: at })
    at += size
  }
  return result
}
for (const name of ['entrance', 'idle', 'play-intro', 'shadow-idle']) {
  const file = `public/media/website/${name}.mp4`
  const buffer = await readFile(file)
  const root = boxes(buffer)
  const moov = root.find(box => box.type === 'moov')
  if (!moov) throw Error(`Missing movie header in ${file}`)
  const child = (box, type) => boxes(buffer, box.start, box.end).find(item => item.type === type)
  const tracks = boxes(buffer, moov.start, moov.end).filter(box => box.type === 'trak').map(track => {
    const media = child(track, 'mdia'), handler = child(media, 'hdlr'), mdhd = child(media, 'mdhd')
    const version = buffer[mdhd.start]
    const timescale = buffer.readUInt32BE(mdhd.start + (version === 1 ? 20 : 12))
    const duration = version === 1 ? Number(buffer.readBigUInt64BE(mdhd.start + 24)) : buffer.readUInt32BE(mdhd.start + 16)
    const table = child(child(media, 'minf'), 'stbl'), descriptions = child(table, 'stsd')
    const codecs = boxes(buffer, descriptions.start + 8, descriptions.end).map(box => box.type)
    const timing = child(table, 'stts')
    let samples = 0
    for (let at = timing.start + 8; at + 8 <= timing.end; at += 8) samples += buffer.readUInt32BE(at)
    return { type: buffer.toString('ascii', handler.start + 8, handler.start + 12), codecs, duration: duration / timescale, samples, samplesPerSecond: samples / (duration / timescale) }
  })
  console.log(JSON.stringify({ file, bytes: buffer.length, sha256: createHash('sha256').update(buffer).digest('hex'), fastStart: moov.offset < root.find(box => box.type === 'mdat').offset, tracks }))
}
