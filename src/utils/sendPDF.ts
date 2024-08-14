import { TDocumentDefinitions } from 'pdfmake/interfaces'
import PdfPrinter from 'pdfmake'
import fs from 'fs'
import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'

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

  const pdfDoc = printer.createPdfKitDocument(docDefinition, {})
  pdfDoc.pipe(stream)
  pdfDoc.end()

  stream.on('finish', async function () {
    // const stream = fs.createReadStream(filepath)
    // await bot.sendDocument(chatId, stream, {}, { filename: `${title}_${filename}`, contentType: 'application/pdf' })
    // fs.unlink(filepath, () => { })
  })
}