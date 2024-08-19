import EmojiConvertor from 'emoji-js'
import latinize from 'latinize'

const emoji = new EmojiConvertor()
emoji.img_set = 'google'
emoji.img_sets.google.path = 'src/assets/64/'
emoji.replace_mode = 'unified'
emoji.colons_mode = true

export default function parseSearch(input: string): string {
  const result = emoji.replace_unified(input)

  return latinize(result.toLowerCase())
}