import { ContentTable, ContentText, TableCell } from 'pdfmake/interfaces'
import 'dayjs/locale/es'
import EmojiConvertor from 'emoji-js'
import { parse } from 'node-html-parser'

const emoji = new EmojiConvertor()
emoji.img_set = 'google'
emoji.img_sets.google.path = 'src/assets/64/'

export default function (input: string): ContentText | ContentTable {
  const description = emoji.replace_unified(input)
  const html = parse(description)

  if (html.childNodes.length === 1 && html.childNodes[0].nodeType === 3) {
    return { text: description }
  }

  let body: TableCell[] = []

  for (let i = 0; i < html.childNodes.length; i++) {
    const node = html.childNodes[i]
    if (node.nodeType === 3) {
      body.push({ text: node.rawText })
    }

    if (node.nodeType === 1) {
      //@ts-ignore
      const imgSrc = node.getAttribute('src')
      body.push({ image: imgSrc, width: 12, height: 12 })
    }
  }

  return {
    layout: 'noBorders',
    table: {
      widths: body.map((b) => {
        if ("image" in b) {
          return 12
        }
        return 'auto'
      }),
      body: [body],
    }
  }
}