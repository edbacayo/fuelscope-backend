// Utility functions for CSV export/import for Expenses
const { Parser } = require('json2csv');

const EXPENSE_HEADERS = [
  'type',
  'serviceDetails.serviceType',
  'fuelDetails.fuelBrand',
  'pricePerLiter',
  'liters',
  'recurringInterval',
  'odometer',
  'totalCost',
  'notes',
  'attachmentUrl',
  'isDeleted',
  'date'
];

function buildExpenseCsv(expenses) {
  const fields = EXPENSE_HEADERS;
  const opts = { fields };
  const parser = new Parser(opts);
  // Flatten nested fields for CSV
  const flatExpenses = expenses.map(e => ({
    type: e.type,
    'serviceDetails.serviceType': e.serviceDetails?.serviceType || '',
    'fuelDetails.fuelBrand': e.fuelDetails?.fuelBrand || '',
    pricePerLiter: e.fuelDetails?.pricePerLiter || '',
    liters: e.fuelDetails?.liters || '',
    recurringInterval: e.recurringInterval || '',
    odometer: e.odometer,
    totalCost: e.totalCost,
    notes: e.notes || '',
    attachmentUrl: e.attachmentUrl || '',
    isDeleted: e.isDeleted,
    date: e.date ? new Date(e.date).toISOString() : ''
  }));
  return parser.parse(flatExpenses);
}

module.exports = {
  EXPENSE_HEADERS,
  buildExpenseCsv
};
