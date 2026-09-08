function numberToWords(num) {
  if (num === 0) return 'Zero Only';

  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convertBelow1000 = (n) => {
    let str = '';
    if (n >= 100) {
      str += ones[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n >= 20) {
      str += tens[Math.floor(n / 10)] + ' ';
      n %= 10;
    }
    if (n > 0) {
      str += ones[n] + ' ';
    }
    return str.trim();
  };

  let amount = Math.round(num);
  let result = '';

  const crores = Math.floor(amount / 10000000);
  amount %= 10000000;
  if (crores > 0) {
    result += convertBelow1000(crores) + ' Crore ';
  }

  const lakhs = Math.floor(amount / 100000);
  amount %= 100000;
  if (lakhs > 0) {
    result += convertBelow1000(lakhs) + ' Lakh ';
  }

  const thousands = Math.floor(amount / 1000);
  amount %= 1000;
  if (thousands > 0) {
    result += convertBelow1000(thousands) + ' Thousand ';
  }

  const hundreds = Math.floor(amount / 100);
  amount %= 100;
  if (hundreds > 0) {
    result += ones[hundreds] + ' Hundred ';
  }

  if (amount > 0) {
    result += convertBelow1000(amount);
  }

  const paise = Math.round((num % 1) * 100);
  if (paise > 0) {
    result += ' and ' + convertBelow1000(paise) + ' Paise';
  }

  return result.trim() + ' Only';
}

module.exports = { numberToWords };
