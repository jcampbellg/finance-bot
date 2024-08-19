import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import LocalizedFormat from 'dayjs/plugin/localizedFormat'
import xprisma from '@utils/xprisma'
import { TDocumentDefinitions } from 'pdfmake/interfaces'
import sendPDF from '@utils/sendPDF'
import parseEmoji from '@utils/parseEmoji'
import numeral from 'numeral'
import { FILL_COLOR, LABEL_COLOR } from '@utils/constant'

dayjs.locale('es')
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(LocalizedFormat)

export default async function pdfAccounts(params: ConversationPropsWithBookSelected) {
  const { query, user, bot } = params

  if (!query) {
    throw new Error('query is required')
  }

  const currencies = await xprisma.account.currencies(user)
  const symbols = currencies.map(c => c.symbol).filter((value, index, self) => self.indexOf(value) === index)

  const empty = symbols.map(() => ({}))
  const widths = symbols.map(() => 396 / symbols.length)

  const monthTZStart = query.data.includes('next') ? dayjs().tz(user.timezone).startOf('month').add(1, 'month') : query.data.includes('current') ? dayjs().tz(user.timezone).startOf('month') : dayjs().tz(user.timezone).startOf('month').subtract(1, 'month')
  const monthTZEnd = query.data.includes('next') ? dayjs().tz(user.timezone).endOf('month').add(1, 'month') : query.data.includes('current') ? dayjs().tz(user.timezone).endOf('month') : dayjs().tz(user.timezone).endOf('month').subtract(1, 'month')

  const accounts = await xprisma.account.findManyPDF(user, monthTZStart, monthTZEnd)

  const header = 'Transacciones por Cuentas'
  const filename = 'Cuentas '

  const docDefinition: TDocumentDefinitions = {
    pageSize: 'LETTER',
    content: [
      {
        text: `${filename}${monthTZStart.format('MMMM YYYY')}`,
        marginBottom: 10,
      },
      {
        font: 'RobotoMono',
        layout: 'category',
        table: {
          dontBreakRows: true,
          headerRows: 2,
          widths: [132, ...widths],
          body: [
            [
              { text: `Resumen de ${filename}`, bold: true, colSpan: symbols.length + 1, alignment: 'center' },
              ...empty
            ],
            [
              { text: 'Descripción', bold: true, alignment: 'left', fillColor: FILL_COLOR },
              ...symbols.map(s => ({ bold: true, text: s, alignment: 'right', fillColor: FILL_COLOR }))
            ],
            ...accounts.map(c => {
              return [
                parseEmoji(c.description),
                ...symbols.map(s => {
                  const balance = c.totals[symbols[0]] || 0
                  const isNegative = balance < 0
                  return [
                    { text: numeral(Math.abs(balance)).format('0,0.00'), alignment: 'right', color: isNegative ? 'red' : 'green' },
                  ]
                })
              ]
            })
          ]
        }
      },
      {
        pageBreak: 'before',
        font: 'RobotoMono',
        layout: 'categoryTransactions',
        table: {
          headerRows: 2,
          widths: [132, 132, 132, 132],
          body: [
            [
              { text: header, bold: true, colSpan: 4, alignment: 'center' },
              {}, {}, {}
            ],
            [
              { text: 'Descripción', bold: true, alignment: 'left', fillColor: FILL_COLOR },
              { text: 'Crédito', bold: true, alignment: 'right', fillColor: FILL_COLOR },
              { text: 'Débito', bold: true, alignment: 'right', fillColor: FILL_COLOR },
              { text: 'Balance', bold: true, alignment: 'right', fillColor: FILL_COLOR }
            ],
            ...accounts.map(a => {
              const transactions = a.transactions.map((t) => {
                const isNormal = t.type === 'EXPENSE' || t.type === 'DEPOSIT'
                const spanishDate = dayjs(isNormal ? t.paidAt : t.createdAt).tz(user.timezone).format('D MMM YY')
                const amount = Math.abs(t.amount)
                const isCredit = t.type === 'DEPOSIT' || t.type === 'INCOME' || t.type === 'TRANSFER_IN'
                const isDebit = !isCredit

                return [
                  [
                    parseEmoji(t.description),
                    { text: spanishDate, alignment: 'left', color: LABEL_COLOR },
                    parseEmoji(t.category?.description || 'Sin Categoria'),
                  ],
                  { text: isCredit ? numeral(amount).format('0,0.00') : '-', alignment: 'right' },
                  { text: isDebit ? numeral(amount).format('0,0.00') : '-', alignment: 'right' },
                  { text: numeral(0).format('0,0.00'), alignment: 'right' }
                ]
              })

              return [
                {
                  colSpan: 4,
                  layout: 'transactions',
                  table: {
                    dontBreakRows: true,
                    headerRows: 1,
                    widths: [132, 132, 132, 132],
                    body: [
                      [
                        { ...parseEmoji(`${a.description} - ${a.transactions.length} transacciones`), marginLeft: 8, bold: true, colSpan: 4 },
                        {}, {}, {}
                      ],
                      // [
                      // [
                      //   { text: 'Transacción' },
                      //   { text: '16 ago 24', alignment: 'left', color: LABEL_COLOR },
                      //   { text: 'Seguridad Los Alamos', alignment: 'left', color: LABEL_COLOR },
                      // ],
                      //   { text: numeral(3355).format('0,0.00'), alignment: 'right' },
                      //   { text: '-', alignment: 'right' },
                      //   { text: numeral(20000).format('0,0.00'), alignment: 'right' }
                      // ],
                      ...transactions,
                      ...(transactions.length === 0 ? [[
                        { text: 'No hay transacciones', colSpan: 4, alignment: 'center' },
                        {}, {}, {}
                      ]] : [])
                    ]
                  }
                },
                {}, {}, {}
              ]
            })
          ]
        }
      }
    ]
  }

  await bot.answerCallbackQuery({ callback_query_id: query.id, text: 'Generando PDF...' })
  await sendPDF(filename + monthTZStart.format('MMMM YYYY'), params, docDefinition)
}