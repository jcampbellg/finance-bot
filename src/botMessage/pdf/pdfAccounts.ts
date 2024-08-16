import { ConversationPropsWithBookSelected } from '@customTypes/messageTypes'
import sendPDF from '@utils/sendPDF'
import xprisma from '@utils/xprisma'
import { TDocumentDefinitions } from 'pdfmake/interfaces'
import dayjs from 'dayjs'
import 'dayjs/locale/es'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import LocalizedFormat from 'dayjs/plugin/localizedFormat'
import { FILL_COLOR, LABEL_COLOR } from '@utils/constant'
import numeral from 'numeral'
import parseEmoji from '@utils/parseEmoji'

dayjs.locale('es')
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(LocalizedFormat)

export default async function pdfAccounts(params: ConversationPropsWithBookSelected) {
  const { query, user } = params

  if (!query) {
    throw new Error('query is required')
  }

  const currencies = await xprisma.account.currencies(user)
  const symbols = currencies.map(a => a.symbol).filter((value, index, self) => self.indexOf(value) === index)

  const empty = symbols.map(() => ({}))
  const widths = symbols.map(() => '*')

  const monthTZStart = query.data.includes('next') ? dayjs().tz(user.timezone).startOf('month').add(1, 'month') : query.data.includes('current') ? dayjs().tz(user.timezone).startOf('month') : dayjs().tz(user.timezone).startOf('month').subtract(1, 'month')
  const monthTZEnd = query.data.includes('next') ? dayjs().tz(user.timezone).endOf('month').add(1, 'month') : query.data.includes('current') ? dayjs().tz(user.timezone).endOf('month') : dayjs().tz(user.timezone).endOf('month').subtract(1, 'month')

  const accounts = await xprisma.account.findManyPDF(user, monthTZStart, monthTZEnd)

  const header = 'Transacciones por Cuentas'
  const filename = 'Cuentas '

  const docDefinition: TDocumentDefinitions = {
    pageSize: 'LETTER',
    content: [
      {
        text: `${filename} ${monthTZStart.format('MMMM YYYY')}`,
        marginBottom: 10,
      },
      {
        font: 'RobotoMono',
        layout: 'lightHorizontalLines',
        table: {
          dontBreakRows: true,
          headerRows: 2,
          widths: ['*', ...widths],
          body: [
            [
              { text: `Resumen de ${filename}`, bold: true, colSpan: symbols.length + 1, alignment: 'center' },
              ...empty
            ],
            [
              { text: 'Descripción', bold: true, alignment: 'left', fillColor: FILL_COLOR },
              ...symbols.map(s => ({ bold: true, text: s, alignment: 'right', fillColor: FILL_COLOR }))
            ],
            ...accounts.map(a => {
              return [
                parseEmoji(a.description),
                ...symbols.map(s => {
                  const isNegative = a.totals[s] < 0
                  return [
                    { text: numeral(Math.abs(a.totals[s] || 0)).format('0,0.00'), alignment: 'right', color: isNegative ? 'red' : 'green' },
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
          widths: ['*', ...widths],
          body: [
            [
              { text: header, bold: true, colSpan: symbols.length + 1, alignment: 'center' },
              ...empty
            ],
            [
              { text: 'Descripción', bold: true, alignment: 'left', fillColor: FILL_COLOR },
              ...symbols.map(s => ({ bold: true, text: s, alignment: 'right', fillColor: FILL_COLOR }))
            ],
            ...accounts.map(a => {

              return [
                {
                  colSpan: symbols.length + 1,
                  layout: 'transactions',
                  table: {
                    dontBreakRows: true,
                    headerRows: 1,
                    widths: ['*', ...widths],
                    body: [
                      [
                        { ...parseEmoji(`${a.description} - ${a.balances.length} transacciones`), marginLeft: 8, bold: true, colSpan: symbols.length + 1 }, ...empty
                      ],
                      ...a.balances.map(b => {

                        const description = parseEmoji(b.transaction?.description || 'Sin descripción')
                        const isNormal = b.transaction?.type === 'EXPENSE' || b.transaction?.type === 'DEPOSIT'
                        const spanishDate = b.transaction ? dayjs(isNormal ? b.transaction.paidAt : b.transaction.createdAt).tz(user.timezone).format('D MMM YY') : ''
                        const transactionAmount = numeral(b.transaction?.amount || 0).format('0,0.00')

                        return [
                          [
                            description,
                            ...(!!b.transaction ? [{ text: spanishDate, alignment: 'left', color: LABEL_COLOR }] : []),
                            ...(!!b.transaction ? [{ text: transactionAmount, alignment: 'left', color: b.transaction.type === 'DEPOSIT' || b.transaction.type === 'INCOME' || b.transaction.type === 'TRANSFER_IN' ? 'green' : 'red' }] : [])
                          ],
                          ...symbols.map(s => {
                            const isNegative = b.amount < 0
                            const isMatch = b.currency.symbol === s
                            return { text: isMatch ? numeral(Math.abs(b.amount)).format('0,0.00') : '-', alignment: 'right', color: isNegative ? 'red' : 'green' }
                          })
                        ]
                      })
                    ]
                  }
                }
              ]
            })
          ]
        }
      }
    ]
  }

  await sendPDF(filename + monthTZStart.format('MMMM YYYY'), params, docDefinition)
}