var accounting = require("accounting");
var assign = require("object-assign");
var localeCurrency = require("locale-currency");
var currencies = require("./currencies.json");
var localeFormats = require("./localeFormats.json");

var defaultCurrency = {
  symbol: "",
  thousandsSeparator: ",",
  decimalSeparator: ".",
  symbolOnLeft: true,
  spaceBetweenAmountAndSymbol: false,
  decimalDigits: 2,
};

var defaultLocaleFormat = {};

var formatMapping = [
  {
    symbolOnLeft: true,
    spaceBetweenAmountAndSymbol: false,
    format: {
      pos: "%s%v",
      neg: "-%s%v",
      zero: "%s%v",
    },
  },
  {
    symbolOnLeft: true,
    spaceBetweenAmountAndSymbol: true,
    format: {
      pos: "%s %v",
      neg: "-%s %v",
      zero: "%s %v",
    },
  },
  {
    symbolOnLeft: false,
    spaceBetweenAmountAndSymbol: false,
    format: {
      pos: "%v%s",
      neg: "-%v%s",
      zero: "%v%s",
    },
  },
  {
    symbolOnLeft: false,
    spaceBetweenAmountAndSymbol: true,
    format: {
      pos: "%v %s",
      neg: "-%v %s",
      zero: "%v %s",
    },
  },
];

function format(value, options) {
  var code =
    options.code ||
    (options.locale && localeCurrency.getCurrency(options.locale));
  var localeMatch = /^([a-z]+)([_-]([a-z]+))?$/i.exec(options.locale) || [];
  var language = localeMatch[1];
  var region = localeMatch[3];
  var localeFormat = assign(
    {},
    defaultLocaleFormat,
    localeFormats[language] || {},
    localeFormats[language + "-" + region] || {}
  );
  var currency = assign({}, defaultCurrency, findCurrency(code), localeFormat);

  var symbolOnLeft = currency.symbolOnLeft;
  var spaceBetweenAmountAndSymbol = currency.spaceBetweenAmountAndSymbol;

  var format = formatMapping.filter(function (f) {
    return (
      f.symbolOnLeft == symbolOnLeft &&
      f.spaceBetweenAmountAndSymbol == spaceBetweenAmountAndSymbol
    );
  })[0].format;

  var precision =
    typeof options.precision === "number"
      ? options.precision
      : currency.decimalDigits;

  var decimal = isUndefined(options.decimal)
    ? currency.decimalSeparator
    : options.decimal;

  // precision 0: 1.915 to 1
  // precision 1: 1.915 to 1.9
  // precision 2: 1.915 to 1.92
  // precision 3: 1.915 to 1.915
  precision += 1;

  var formatMoney = accounting.formatMoney(value, {
    symbol: isUndefined(options.symbol) ? currency.symbol : options.symbol,

    decimal,

    thousand: isUndefined(options.thousand)
      ? currency.thousandsSeparator
      : options.thousand,

    precision,

    format:
      ["string", "object"].indexOf(typeof options.format) > -1
        ? options.format
        : format,
  });

  // if precision is bigger than 0 we add one more
  // to not have formatMoney round up for example
  // precision 2: 1.915 -> 1.92
  // precision 3: 1.915 -> 1.915
  if (precision > 0) {
    // grab the value already fixed with the precision
    // its basically the same value from formayMoney but without the symbol
    value = accounting.toFixed(value, precision).toString();

    // decimal will always be . on variable value
    var lastIndexOfDecimal = value.lastIndexOf(".");

    // if there are no decimal digits it means it will be filled with zeros
    // 5 -> 5.0
    var decimalDigits =
      lastIndexOfDecimal === -1
        ? 0
        : value.slice(lastIndexOfDecimal + 1, value.length);

    // we only retrieve the actual last digit from value if the decimal
    // digits is bigger or equal than the precision otherwise it will be
    // replaced with a zero
    // i.e. 0.50 -> 0.500
    var lastDigit = decimalDigits.length >= precision ? value.slice(-1) : 0;

    // find the position of the digit within the formatMoney so we can remove it
    var lastIndexOfDigit = formatMoney.lastIndexOf(lastDigit);
    var cutFormatMoneyToIndex =
      precision === 1 ? lastIndexOfDigit - 1 : lastIndexOfDigit;
    var cutFormatMoneyFromIndex =
      precision === 1 ? lastIndexOfDigit + 2 : lastIndexOfDigit + 1;

    // takes out the last character from the formatted currency
    // because it can be anything like "$ 123.456" to "123.456$"
    // so we need to rebuild the string with slice
    var formatMoneyWithoutLastDigit =
      formatMoney.slice(0, cutFormatMoneyToIndex) +
      formatMoney.slice(cutFormatMoneyFromIndex, formatMoney.length);

    return formatMoneyWithoutLastDigit;
  }

  return formatMoney;
}

function findCurrency(currencyCode) {
  return currencies[currencyCode];
}

function isUndefined(val) {
  return typeof val === "undefined";
}

function unformat(value, options) {
  var code =
    options.code ||
    (options.locale && localeCurrency.getCurrency(options.locale));
  var localeFormat = localeFormats[options.locale] || defaultLocaleFormat;
  var currency = assign({}, defaultCurrency, findCurrency(code), localeFormat);
  var decimal = isUndefined(options.decimal)
    ? currency.decimalSeparator
    : options.decimal;
  return accounting.unformat(value, decimal);
}

module.exports = {
  defaultCurrency,
  get currencies() {
    // In favor of backwards compatibility, the currencies map is converted to an array here
    return Object.keys(currencies).map(function (key) {
      return currencies[key];
    });
  },
  findCurrency,
  format,
  unformat,
};
