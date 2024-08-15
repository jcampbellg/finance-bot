import EmojiConvertor from 'emoji-js'
import { HTMLToJSON } from 'html-to-json-parser'
import { ContentTable } from 'pdfmake/interfaces'

const emoji = new EmojiConvertor()
emoji.img_set = 'google'
emoji.img_sets.google.path = 'src/assets/64/'

type Node = {
  type: string
  attributes: {
    class: string
    alt: string
    src: string
  }
} | string

type ArrayText = {
  image: string
  width: number
  height: number
} | {
  width: 'auto'
  text: string
  font: string
}

export type ColumnsEmoji = {
  columns: ArrayText[]
  columnGap: number
}

export default async function (input: string, textOptions: Partial<ContentTable> = {}, emojiOptions: Partial<ContentTable> = {}): Promise<ContentTable> {
  const html = emoji.replace_unified(input)
  const json: any = await HTMLToJSON(`<div>${html}</div>`, false)

  let content = []

  for (let i = 0; i < json.content.length; i++) {
    const node: Node = json.content[i]
    if (typeof node === 'string') {
      content.push({
        width: 'auto',
        text: node,
        ...textOptions
      })
    } else {
      if (!!emoji) {
        content.push({
          // @ts-ignore
          image: node.attributes.src,
          width: 12,
          height: 12,
          ...emojiOptions
        })
      }
    }
  }

  return {
    layout: 'noBorders',
    table: {
      widths: content.map(() => 'auto'),
      body: [content],
    }
  } as ContentTable
}