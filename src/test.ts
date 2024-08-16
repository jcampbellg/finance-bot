import xprisma from '@utils/xprisma'
import { ContentTable, ContentText, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import LocalizedFormat from 'dayjs/plugin/localizedFormat'
import PdfPrinter from 'pdfmake'
import fs from 'fs'
import EmojiConvertor from 'emoji-js'
import { parse } from 'node-html-parser'

dayjs.locale('es')
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(LocalizedFormat)

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

const emoji = new EmojiConvertor()
emoji.img_set = 'google'
emoji.img_sets.google.path = 'src/assets/64/'

async function main() {
  const user = await xprisma.user.auth(1116747732)

  const monthTZStart = dayjs().tz(user.timezone).startOf('month')
  const monthTZEnd = dayjs().tz(user.timezone).endOf('month')

  const categories = await xprisma.category.findManyPDF(user, 'INCOME', monthTZStart, monthTZEnd)

  const docDefinition: TDocumentDefinitions = {
    pageSize: 'LETTER',
    content: [
      {
        font: 'RobotoMono',
        layout: 'lightHorizontalLines',
        table: {
          dontBreakRows: true,
          headerRows: 1,
          widths: ['*'],
          body: [
            [{ text: 'Transacciones por Pagos Fijos', bold: true, alignment: 'center' }],
            ...categories.map(c => {
              const description = parseEmoji(c.description)
              return [
                description
              ]
            })
          ]
        }
      },
      {
        font: 'RobotoMono',
        layout: 'lightHorizontalLines',
        table: {
          dontBreakRows: true,
          headerRows: 1,
          widths: ['*'],
          body: [
            [{ text: 'Transacciones por Pagos Fijos', bold: true, alignment: 'center' }],
            ...categories.map(c => {
              const description = parseEmoji(c.description)
              return [
                description
              ]
            })
          ]
        }
      }
    ]
  }

  await sendPDF(docDefinition)
}

main()
  .then(async () => {
    await xprisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await xprisma.$disconnect()
    process.exit(1)
  })

async function sendPDF(docDefinition: TDocumentDefinitions) {
  const filename = Math.random().toString(36).substring(7) + '.pdf'
  const filepath = 'src/assets/' + filename
  const stream = fs.createWriteStream(filepath)
  const printer = new PdfPrinter(fonts)

  const pdfDoc = printer.createPdfKitDocument(docDefinition, {})
  pdfDoc.pipe(stream)
  pdfDoc.end()

  stream.on('finish', async function () {
    console.log(filepath)
  })
}

function parseEmoji(input: string): ContentText | ContentTable {
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
      widths: body.map(() => 'auto'),
      body: [body],
    }
  }
}