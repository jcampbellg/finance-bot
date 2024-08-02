import { TDocumentDefinitions } from 'pdfmake/interfaces'
import PdfPrinter from 'pdfmake'
import uEmojiParser from 'universal-emoji-parser'
import { HTMLToJSON } from 'html-to-json-parser'
import emojiJson from 'emoji-datasource-google'
import fs from 'fs'

const fonts = {
  Roboto: {
    normal: 'src/assets/fonts/roboto/Roboto-Regular.ttf',
    bold: 'src/assets/fonts/roboto/Roboto-Bold.ttf',
    italics: 'src/assets/fonts/roboto/Roboto-Italic.ttf',
    bolditalics: 'src/assets/fonts/roboto/Roboto-BoldItalic.ttf'
  },
  RobotoMono: {
    normal: 'src/assets/fonts/robotomono/RobotoMono-Regular.ttf',
    bold: 'src/assets/fonts/robotomono/RobotoMono-Bold.ttf',
    italics: 'src/assets/fonts/robotomono/RobotoMono-Italic.ttf',
    bolditalics: 'src/assets/fonts/robotomono/RobotoMono-BoldItalic.ttf'
  }
}

type Node = {
  type: string
  attributes: {
    class: string
    alt: string
    src: string
  }
} | string

export default async function testEmoji() {
  const text = `👍dedo👍🏼🧩🚈*⃣#⃣🏡🏚️`

  // for loop each character
  const html = uEmojiParser.parseToHtml(text)
  const json: any = await HTMLToJSON(`<div>${html}</div>`, false)

  let content = []

  for (let i = 0; i < json.content.length; i++) {
    const node: Node = json.content[i]
    if (typeof node === 'string') {
      content.push({
        width: 'auto',
        font: 'Roboto',
        text: node
      })
    } else {
      const srcSplit = node.attributes.src.split('/')
      const unifiedSearch = srcSplit[srcSplit.length - 1].replace('.png', '').split('-').map(p => {
        if (p.length === 4) {
          return p.toUpperCase()
        } else {
          return p.toUpperCase().padStart(4, '0')
        }
      })

      let skinKey = ''

      const emoji = emojiJson.find((e) => {
        const pointsNeeded = unifiedSearch.length
        const unified: string[] = e.unified.split('-')

        const pointGain = unified.filter((p: string) => unifiedSearch.includes(p)).length

        if (pointGain === pointsNeeded) {
          return true
        }

        if (!!e.skin_variations) {
          for (const key in e.skin_variations) {
            // @ts-ignore
            const skinVariation: any = e.skin_variations[key]
            const skinUnified = skinVariation.unified.split('-')

            const skinPointGain = skinUnified.filter((p: string) => unifiedSearch.includes(p)).length

            if (skinPointGain === pointsNeeded) {
              skinKey = key
              return true
            }
          }
        }

        return false
      })

      if (!!emoji) {
        content.push({
          // @ts-ignore
          image: `src/assets/64/${!!skinKey ? (emoji.skin_variations[skinKey].image || emoji.image) : emoji.image}`,
          width: 16,
          height: 16
        })
      }
    }
  }

  const docDefinition: TDocumentDefinitions = {
    pageSize: 'LETTER',
    header: 'Header',
    content: [
      {
        columns: content,
        columnGap: 4
      }
    ]
  }

  await sendFile(docDefinition)
}

async function sendFile(docDefinition: TDocumentDefinitions) {
  const filepath = 'src/assets/' + Math.random().toString(36).substring(7) + '.pdf'
  const stream = fs.createWriteStream(filepath)
  const printer = new PdfPrinter(fonts)

  const pdfDoc = printer.createPdfKitDocument(docDefinition, {})
  pdfDoc.pipe(stream)
  pdfDoc.end()

  stream.on('finish', async function () {
    console.log(`PDF created in ${filepath}`)
  })
}

testEmoji()