import { MsgAndQueryProps } from '@customTypes/messageTypes'
import * as PImage from 'pureimage'
import fs from 'fs'
import { prisma } from '@utils/prisma'
import numeral from 'numeral'

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

  // Create image
  const font = PImage.registerFont('src/assets/font/telegrama_raw.otf', 'monofonto')
  await font.load()

  let imgs: PImage.Bitmap[] = []
  const header = await drawHeader('Resumen de Presupuesto')
  const catSubHeader = await drawSubHeader('Categorías')
  const paySubHeader = await drawSubHeader('Pagos Fijos')

  const categories = await prisma.category.findMany({
    where: {
      bookId: book.id
    },
    orderBy: {
      description: 'asc'
    },
    include: {
      limits: {
        include: {
          amount: true
        }
      }
    }
  })

  imgs.push(header, catSubHeader)
  for (let i = 0; i < categories.length; i++) {
    const cat = categories[i]
    var img = await drawItem(cat.description, '$0.00 00 0')
    imgs.push(img)
  }
  imgs.push(paySubHeader)

  const payments = await prisma.payment.findMany({
    where: {
      bookId: book.id
    },
    orderBy: {
      description: 'asc'
    },
    include: {
      amount: true
    }
  })
  for (let i = 0; i < payments.length; i++) {
    const pay = payments[i]
    var img = await drawItem(pay.description, `${numeral(pay.amount.amount).format('$0,0.00')} ${pay.amount.currency}`)
    imgs.push(img)
  }

  // Final image
  const imgW = imgs[0].width
  const imgH = imgs.reduce((acc, img) => acc + img.height, 0)

  const finalImage = PImage.make(imgW, imgH)
  const ctx = finalImage.getContext('2d')

  let drawY = 0
  for (let i = 0; i < imgs.length; i++) {
    const img = imgs[i]
    ctx.drawImage(img,
      0, 0, img.width, img.height,
      0, drawY, img.width, img.height
    )
    drawY += img.height
  }

  // random filename on src/assets/send
  const filepath = 'src/assets/' + Math.random().toString(36).substring(7) + '.png'
  const stream = fs.createWriteStream(filepath)

  await PImage.encodePNGToStream(finalImage, stream)
  await bot.sendPhoto(userId, filepath, { caption: 'Resumen de Presupuesto' }, { filename: 'resumen.png', contentType: 'image/png' })

  // delete file
  fs.unlink(filepath, () => { })
  return
}

async function drawHeader(text: string): Promise<PImage.Bitmap> {
  const titleImg = await PImage.decodePNGFromStream(fs.createReadStream('src/assets/receipt-01.png'))

  const ctx = titleImg.getContext('2d')
  ctx.fillStyle = '#000000'
  ctx.textAlign = 'center'
  ctx.font = '60pt monofonto'
  ctx.fillText(text, titleImg.width / 2, 276)

  return titleImg
}

async function drawSubHeader(text: string): Promise<PImage.Bitmap> {
  const img = await PImage.decodePNGFromStream(fs.createReadStream('src/assets/receipt-02.png'))

  const ctx = img.getContext('2d')
  ctx.fillStyle = '#000000'
  ctx.textAlign = 'center'
  ctx.font = '40pt monofonto'
  ctx.fillText(text, img.width / 2, img.height / 2)

  return img
}

async function drawItem(left: string, right: string): Promise<PImage.Bitmap> {
  const img = await PImage.decodePNGFromStream(fs.createReadStream('src/assets/receipt-02.png'))

  const ctx = img.getContext('2d')
  ctx.fillStyle = '#000000'
  ctx.font = '50pt monofonto'
  ctx.textAlign = 'left'
  ctx.fillText(left, 120, img.height / 2)

  ctx.textAlign = 'right'
  ctx.fillText(right, img.width - 120, img.height / 2)
  return img
}