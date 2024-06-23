import { MsgAndQueryProps, QueryProps } from '@customTypes/messageTypes'
import auth from '@utils/auth'
import { prisma } from '@utils/prisma'
import PdfPrinter from 'pdfmake'
import { TDocumentDefinitions } from 'pdfmake/interfaces'
import fs from 'fs'
import blobStream from 'blob-stream'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import LocalizedFormat from 'dayjs/plugin/localizedFormat'

dayjs.locale('es')
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(LocalizedFormat)

export async function summaryOnStart({ bot, msg, query }: MsgAndQueryProps) {
  const { user, book, userId } = await auth({ bot, msg, query } as MsgAndQueryProps)
  if (!user) return
  if (!book) return

  await prisma.conversation.update({
    where: {
      chatId: userId
    },
    data: {
      state: 'summary',
      data: {}
    }
  })

  const prevMonth = dayjs().utc().startOf('month').subtract(1, 'month')
  const thisMonth = dayjs().utc().startOf('month')
  const nextMonth = dayjs().utc().startOf('month').add(1, 'month')

  await bot.sendMessage(userId, '¿Qué mes deseas ver?', {
    reply_markup: {
      inline_keyboard: [[{
        text: prevMonth.format('MMMM YYYY'),
        callback_data: `${prevMonth.format()}`
      }, {
        text: thisMonth.format('MMMM YYYY'),
        callback_data: `${thisMonth.format()}`
      }, {
        text: nextMonth.format('MMMM YYYY'),
        callback_data: `${nextMonth.format()}`
      }]]
    }
  })
}

export async function summaryOnCallbackQuery({ bot, query }: QueryProps) {
  const { user, book, userId } = await auth({ bot, query } as MsgAndQueryProps)
  if (!user) return
  if (!book) return

  await prisma.conversation.update({
    where: {
      chatId: userId
    },
    data: {
      state: 'summary',
      data: {
        date: query.data
      }
    }
  })

  await bot.sendMessage(userId, `<i>Generando resumen de ${dayjs(query.data).utc().format('MMMM YYYY')}</i>`, {
    parse_mode: 'HTML'
  })

  await createPDF({ bot, query, monthYear: query.data })
}

type CreatePDFProps = QueryProps & {
  monthYear: string
}

const fonts = {
  Roboto: {
    normal: 'src/assets/font/Roboto-Regular.ttf',
    bold: 'src/assets/font/Roboto-Bold.ttf',
    italics: 'src/assets/font/Roboto-Italic.ttf',
    bolditalics: 'src/assets/font/Roboto-BoldItalic.ttf'
  }
}

async function createPDF({ bot, query, monthYear }: CreatePDFProps) {
  const { user, book, userId } = await auth({ bot, query } as MsgAndQueryProps)
  if (!user) return
  if (!book) return

  const monthStart = dayjs(monthYear).utc().startOf('month')
  const monthEnd = dayjs(monthYear).utc().endOf('month')

  const categories = await prisma.category.findMany({
    where: {
      bookId: book.id,
      isPayment: false,
    },
    orderBy: {
      description: 'asc'
    },
    include: {
      limits: {
        where: {
          validFrom: {
            lte: monthStart.format()
          }
        },
        include: {
          amount: true
        }
      },
      expenses: {
        where: {
          createdAt: {
            gte: monthStart.format(),
            lte: monthEnd.format()
          }
        },
        include: {
          amount: true,
          account: true
        }
      }
    }
  }).then(cats => cats.filter(cat => cat.expenses.length > 0))

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
            lte: monthStart.format()
          }
        },
        include: {
          amount: true
        }
      },
      expenses: {
        where: {
          createdAt: {
            gte: monthStart.format(),
            lte: monthEnd.format()
          }
        },
        include: {
          amount: true,
          account: true
        }
      }
    }
  }).then(cats => cats.filter(cat => cat.expenses.length > 0))

  const expensesWithNoCategory = await prisma.expense.findMany({
    where: {
      bookId: book.id,
      categoryId: null,
      createdAt: {
        gte: monthStart.format(),
        lte: monthEnd.format()
      }
    },
    include: {
      amount: true,
      account: true
    }
  })

  const exchangeRates = await prisma.exchangeRate.findMany({
    where: {
      bookId: book.id,
      validFrom: {
        gte: monthStart.format(),
        lte: monthEnd.format()
      }
    }
  })

  const filepath = 'src/assets/' + Math.random().toString(36).substring(7) + '.pdf'
  const stream = blobStream()
  const printer = new PdfPrinter(fonts)
  const docDefinition: TDocumentDefinitions = {
    content: [
      {
        fontSize: 18,
        text: `Resumen de ${monthStart.format('MMMM YYYY')}`,
      }
    ]
  }

  const pdfDoc = printer.createPdfKitDocument(docDefinition, {})
  pdfDoc.pipe(stream)
  pdfDoc.end()

  stream.on('finish', async function () {
    const blob = stream.toBlob('application/pdf')
    const arrayBuffer = await blob.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    await bot.sendDocument(userId, buffer, {}, { filename: `Resumen.pdf`, contentType: 'application/pdf' })
    fs.unlink(filepath, () => { })
  })
}