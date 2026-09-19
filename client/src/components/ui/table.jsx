import * as React from 'react'

const tableBase = 'w-full caption-bottom text-sm'
const headerBase = '[&_tr]:border-b'
const bodyBase = '[&_tr:last-child]:border-0'
const rowBase = 'border-b transition-colors hover:bg-slate-50/80 data-[state=selected]:bg-slate-100'
const headBase = 'h-12 px-4 text-left align-middle font-medium text-slate-600 [&:has([role=checkbox])]:pr-0'
const cellBase = 'p-4 align-middle [&:has([role=checkbox])]:pr-0'
const footerBase = 'border-t bg-slate-50/80 font-medium text-slate-900'
const captionBase = 'mt-4 text-sm text-slate-500'

const Table = React.forwardRef(({ className = '', ...props }, ref) => (
  <div className="relative w-full overflow-auto">
    <table ref={ref} className={`${tableBase} ${className}`.trim()} {...props} />
  </div>
))
Table.displayName = 'Table'

const TableHeader = React.forwardRef(({ className = '', ...props }, ref) => (
  <thead ref={ref} className={`${headerBase} ${className}`.trim()} {...props} />
))
TableHeader.displayName = 'TableHeader'

const TableBody = React.forwardRef(({ className = '', ...props }, ref) => (
  <tbody ref={ref} className={`${bodyBase} ${className}`.trim()} {...props} />
))
TableBody.displayName = 'TableBody'

const TableFooter = React.forwardRef(({ className = '', ...props }, ref) => (
  <tfoot ref={ref} className={`${footerBase} ${className}`.trim()} {...props} />
))
TableFooter.displayName = 'TableFooter'

const TableRow = React.forwardRef(({ className = '', ...props }, ref) => (
  <tr ref={ref} className={`${rowBase} ${className}`.trim()} {...props} />
))
TableRow.displayName = 'TableRow'

const TableHead = React.forwardRef(({ className = '', ...props }, ref) => (
  <th ref={ref} className={`${headBase} ${className}`.trim()} {...props} />
))
TableHead.displayName = 'TableHead'

const TableCell = React.forwardRef(({ className = '', ...props }, ref) => (
  <td ref={ref} className={`${cellBase} ${className}`.trim()} {...props} />
))
TableCell.displayName = 'TableCell'

const TableCaption = React.forwardRef(({ className = '', ...props }, ref) => (
  <caption ref={ref} className={`${captionBase} ${className}`.trim()} {...props} />
))
TableCaption.displayName = 'TableCaption'

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
