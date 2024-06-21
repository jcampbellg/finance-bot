import { MsgAndQueryProps } from '@customTypes/messageTypes'
import fs from 'fs'
import { prisma } from '@utils/prisma'
import numeral from 'numeral'
import emojiRegex from 'emoji-regex'
import PDFDocument from 'pdfkit'
import blobStream from 'blob-stream'
import { AlignmentEnum, AsciiTable3 } from 'ascii-table3'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import LocalizedFormat from 'dayjs/plugin/localizedFormat'

dayjs.locale('es')
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(LocalizedFormat)

const regex = emojiRegex()

const fonts = {
  regular: 'src/assets/font/Roboto-Regular.ttf',
  bold: 'src/assets/font/Roboto-Bold.ttf',
  light: 'src/assets/font/Roboto-Light.ttf',
  black: 'src/assets/font/Roboto-Black.ttf',
  telegrama: 'src/assets/font/telegrama_raw.otf'
}

export async function summaryBudgetOnStart({ bot, msg, query }: MsgAndQueryProps) {
  const userId = msg?.chat.id || query?.message.chat.id as number

  const user = await prisma.user.findUnique({
    where: {
      id: userId
    },
    include: {
      books: {
        where: {
          OR: [
            { ownerId: userId },
            {
              shares: {
                some: {
                  shareWithUserId: userId
                }
              }
            }
          ]
        }
      }
    }
  })

  if (!user) {
    await bot.sendMessage(userId, 'No se encontró el usuario.\n\n Usa /start para comenzar.')
    return
  }

  const book = user.books.find(book => book.id === user.bookSelectedId)

  if (!book) {
    await prisma.conversation.update({
      where: {
        chatId: userId
      },
      data: {
        state: 'waitingForCommand',
        data: {}
      }
    })
    await bot.sendMessage(userId, '<i>Primero necesitas seleccionar un libro contable. Usa /libro.</i>', { parse_mode: 'HTML' })
    return
  }

  const summaryMonth = dayjs().utc().startOf('month')

  const categories = await prisma.category.findMany({
    where: {
      bookId: book.id,
      isPayment: false
    },
    orderBy: {
      description: 'asc'
    },
    include: {
      limits: {
        where: {
          validFrom: {
            lte: summaryMonth.format()
          }
        },
        include: {
          amount: true
        }
      }
    }
  })

  const payments = await prisma.category.findMany({
    where: {
      bookId: book.id,
      isPayment: true
    },
    orderBy: {
      description: 'asc'
    },
    include: {
      limits: {
        where: {
          validFrom: {
            lte: summaryMonth.format()
          }
        },
        include: {
          amount: true
        }
      }
    }
  })

  const filepath = 'src/assets/' + Math.random().toString(36).substring(7) + '.pdf'
  const stream = blobStream()

  const doc = new PDFDocument({
    size: 'LETTER',
    margins: {
      top: 50,
      bottom: 50,
      left: 50,
      right: 50
    }
  })

  doc.pipe(stream)
  doc.font(fonts.black).fontSize(24).text('RESUMEN DE PRESUPUESTO', { align: 'center' })
  doc.moveDown(0.2)
  doc.font(fonts.light).fontSize(16).text(summaryMonth.format('MMMM YYYY'), { align: 'center' })
  doc.moveDown(0.5)
  doc.font(fonts.telegrama).fontSize(12).moveDown(1).text('CATEGORIAS', { align: 'center' })
  doc.font(fonts.telegrama).fontSize(12)

  const catTable = new AsciiTable3().setHeading('Categoria', 'Limite').setStyle('compact').addRowMatrix(categories.map(cat => {
    const description = cat.description.replace(regex, '').trim()
    const limit = cat.limits.length > 0 ? `${numeral(cat.limits[0].amount.amount).format('0,0.00')} ${cat.limits[0].amount.currency}` : '0'
    return [description, limit]
  })).setWidth(1, 30).setWidth(2, 30).setAlign(1, AlignmentEnum.LEFT).setAlign(2, AlignmentEnum.RIGHT)

  // Totals by currency
  const catCur = [...new Set(categories.filter(c => c.limits.length > 0).map(c => c.limits[0].amount.currency))]
  const totalGCatCur: any = catCur.reduce((acc, currency) => {
    const total = categories.filter(c => c.limits.length > 0 && c.limits[0].amount.currency === currency).reduce((acc, curr) => acc + curr.limits[0].amount.amount, 0)
    return { ...acc, [currency]: total }
  }, {})


  const catTotalTable = new AsciiTable3().setStyle('compact').addRowMatrix(catCur.map(currency => {
    return [`TOTAL ${currency}`, `${numeral(totalGCatCur[currency]).format('0,0.00')} ${currency}`]
  })).setWidth(1, 30).setWidth(2, 30).setAlign(1, AlignmentEnum.RIGHT).setAlign(2, AlignmentEnum.RIGHT).setHeadingAlignRight()

  doc.text(catTable.toString(), { align: 'center' })
  doc.text(catTotalTable.toString(), { align: 'center' })

  doc.moveDown(2)
  doc.font(fonts.telegrama).fontSize(12).moveDown(1).text('PAGOS FIJOS', { align: 'center' })
  doc.font(fonts.telegrama).fontSize(12)

  const payTable = new AsciiTable3().setHeading('Pagos', 'Monto').setStyle('compact').addRowMatrix(payments.map(cat => {
    const description = cat.description.replace(regex, '').trim()
    const limit = cat.limits.length > 0 ? `${numeral(cat.limits[0].amount.amount).format('0,0.00')} ${cat.limits[0].amount.currency}` : '0'
    return [description, limit]
  })).setWidth(1, 30).setWidth(2, 30).setAlign(1, AlignmentEnum.LEFT).setAlign(2, AlignmentEnum.RIGHT)

  // Totals by currency
  const payCur = [...new Set(payments.filter(c => c.limits.length > 0).map(c => c.limits[0].amount.currency))]
  const totalGpayCur: any = payCur.reduce((acc, currency) => {
    const total = payments.filter(c => c.limits.length > 0 && c.limits[0].amount.currency === currency).reduce((acc, curr) => acc + curr.limits[0].amount.amount, 0)
    return { ...acc, [currency]: total }
  }, {})

  const payTotalTable = new AsciiTable3().setStyle('compact').addRowMatrix(payCur.map(currency => {
    return [`TOTAL ${currency}`, `${numeral(totalGpayCur[currency]).format('0,0.00')} ${currency}`]
  })).setWidth(1, 30).setWidth(2, 30).setAlign(1, AlignmentEnum.RIGHT).setAlign(2, AlignmentEnum.RIGHT).setHeadingAlignRight()

  doc.text(payTable.toString(), { align: 'center' })
  doc.text(payTotalTable.toString(), { align: 'center' })

  doc.end()
  stream.on('finish', async function () {
    const blob = stream.toBlob('application/pdf')
    const arrayBuffer = await blob.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    await bot.sendDocument(userId, buffer, {}, { filename: `${summaryMonth.format('MMMM YYYY')} Resumen de presupuesto.pdf`, contentType: 'application/pdf' })
    fs.unlink(filepath, () => { })
  })
  return
}