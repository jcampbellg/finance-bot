import { TDocumentDefinitions } from 'pdfmake/interfaces'
import PdfPrinter from 'pdfmake'
import fs from 'fs'
import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import { FILL_COLOR } from './constant'

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

export default async function (title: string, { bot, chatId }: ConversationPropsWithBookSelected, docDefinition: TDocumentDefinitions) {
  const filename = Math.random().toString(36).substring(7) + '.pdf'
  const filepath = 'src/assets/' + filename
  const stream = fs.createWriteStream(filepath)
  const printer = new PdfPrinter(fonts)

  const pdfDoc = printer.createPdfKitDocument(docDefinition, {
    tableLayouts: {
      category: {
        hLineWidth(i, node) {
          if (i === 0 || i === node.table.body.length) {
            return 0
          }

          if (i === node.table.headerRows)
            return 2

          if (i === (node.table.headerRows || 0) - 1)
            return 1

          return 1
        },
        fillColor() {
          return null
        },
        vLineWidth() {
          return 0
        },
        hLineColor(i) {
          return i === 1 ? 'black' : '#aaa'
        },
        paddingLeft() {
          return 0
        },
        paddingRight() {
          return 0
        }
      },
      categoryTransactions: {
        hLineWidth(i, node) {
          if (i === 0 || i === node.table.body.length) {
            return 0
          }

          if (i === node.table.headerRows)
            return 2

          if (i === (node.table.headerRows || 0) - 1)
            return 1

          return 0
        },
        vLineWidth() {
          return 0
        },
        hLineColor(i) {
          return i === 1 ? 'black' : '#aaa'
        },
        paddingLeft() {
          return 0
        },
        paddingRight() {
          return 0
        }
      },
      transactions: {
        hLineWidth(i, node) {
          if (i === node.table.headerRows)
            return 0

          if (i === node.table.body.length)
            return 0

          return 1
        },
        fillColor(i) {
          if (i === 0)
            return FILL_COLOR

          return null
        },
        vLineWidth() {
          return 0
        },
        hLineColor() {
          return '#aaa'
        },
        paddingLeft() {
          return 0
        },
        paddingRight() {
          return 0
        }
      }
    }
  })
  pdfDoc.pipe(stream)
  pdfDoc.end()

  stream.on('finish', async function () {
    const stream = fs.createReadStream(filepath)
    await bot.sendDocument(chatId, stream, {}, { filename: `${title}_${filename}`, contentType: 'application/pdf' })
    fs.unlink(filepath, () => { })
  })
}